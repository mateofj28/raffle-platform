"use client";

import { useEffect, useState, useRef } from "react";
import { Button, Card, CardContent, Chip, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { CreditCard, Filter, X, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PaymentMethodBadge } from "@/components/shared/payment-method-badge";
import { formatCurrency, formatDateTime, formatTicketNumbers } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { pairingService } from "@/features/raffles/services/pairing.service";
import { vendorCommission } from "@/utils/money";
import { getDocs, query, orderBy, where, limit, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment } from "@/types/api.types";

const TYPE_LABELS: Record<string, string> = { payment: "Pago completo", installment: "Abono" };
const METHOD_LABELS: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", nequi: "Nequi", daviplata: "Daviplata", other: "Otro" };

export default function PaymentsPage() {
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const userRole = useAuthStore((s) => s.user?.role);
    const userUid = useAuthStore((s) => s.user?.uid);
    const { activeRaffle } = useRaffleStore();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [vendors, setVendors] = useState<Map<string, string>>(new Map());
    const [customers, setCustomers] = useState<Map<string, string>>(new Map());
    // Mapa número base (min de la pareja) → [a, b], para mostrar la pareja en la tabla.
    const [pairsByBase, setPairsByBase] = useState<Map<number, number[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [hasMorePayments, setHasMorePayments] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const lastPaymentDocRef = useRef<QueryDocumentSnapshot | null>(null);

    // Filters
    const [filterType, setFilterType] = useState<string>("");
    const [filterMethod, setFilterMethod] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    // Filtro rápido: "" (todo), "today", "week" (lun-dom), "month" (este mes).
    const [filterQuick, setFilterQuick] = useState("");
    // Filtro por mes concreto: "" o "YYYY-M". Excluyente con el filtro rápido.
    const [filterMonth, setFilterMonth] = useState("");

    // Pagination
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const INITIAL_LOAD = 200;

    useEffect(() => {
        if (!tenantId || !activeRaffle) return;
        const load = async () => {
            setLoading(true);
            try {
                const col = tenantCollection(tenantId, "payments");
                // El cajero solo ve los pagos que él registró (createdBy). El admin ve todos los de la rifa.
                const isCashier = userRole === "cashier";
                const q = isCashier
                    ? query(col, where("createdBy", "==", userUid), orderBy("createdAt", "desc"), limit(INITIAL_LOAD))
                    : query(col, where("raffleId", "==", activeRaffle.id), orderBy("createdAt", "desc"), limit(INITIAL_LOAD));
                const snap = await getDocs(q);
                // Para el cajero, la query es por createdBy (todas las rifas); acotamos a la rifa activa en memoria.
                let rows = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[];
                if (isCashier) rows = rows.filter(p => p.raffleId === activeRaffle.id);
                setPayments(rows);
                lastPaymentDocRef.current = snap.docs[snap.docs.length - 1] || null;
                setHasMorePayments(snap.docs.length === INITIAL_LOAD);

                // Load vendors for name resolution
                const vendorsSnap = await getDocs(tenantCollection(tenantId, "vendors"));
                const vMap = new Map<string, string>();
                vendorsSnap.docs.forEach(d => vMap.set(d.id, d.data().name));
                setVendors(vMap);

                // Load customers for name resolution
                const customersSnap = await getDocs(tenantCollection(tenantId, "customers"));
                const cMap = new Map<string, string>();
                customersSnap.docs.forEach(d => cMap.set(d.id, d.data().name));
                setCustomers(cMap);

                // Parejas del tenant: SOLO aplican si la rifa activa es de 2 números.
                // En rifas de 1 número cada boleta juega un solo número, así que NO
                // se deben usar las parejas (evita mostrar "5000 · 7886").
                if (activeRaffle.numbersPerTicket === 2) {
                    try {
                        const res = await pairingService.get();
                        if (res.pairs && res.pairs.length > 0) {
                            const pMap = new Map<number, number[]>();
                            res.pairs.forEach(([a, b]) => { pMap.set(Math.min(a, b), [Math.min(a, b), Math.max(a, b)]); });
                            setPairsByBase(pMap);
                        }
                    } catch { /* sin parejas: se ignora */ }
                } else {
                    setPairsByBase(new Map());
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [tenantId, activeRaffle, userRole, userUid]);

    // Etiqueta de la boleta de un pago: muestra la pareja "0000 · 1111" si existe,
    // o el número base. `ticketId` es el docId (min de la pareja).
    const ticketLabel = (ticketId: string): string => {
        const base = parseInt(ticketId, 10);
        const nums = pairsByBase.get(base);
        return formatTicketNumbers(nums, base);
    };

    // Fecha de un pago (Timestamp de Firestore o string) a Date.
    const paymentDate = (p: Payment): Date | null => {
        const c = p.createdAt as unknown;
        if (!c) return null;
        if (typeof c === "string") { const d = new Date(c); return isNaN(d.getTime()) ? null : d; }
        const anyC = c as { toDate?: () => Date; seconds?: number };
        if (typeof anyC.toDate === "function") return anyC.toDate();
        if (typeof anyC.seconds === "number") return new Date(anyC.seconds * 1000);
        return null;
    };

    const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthOptions = Array.from(
        new Set(payments.map((p) => { const d = paymentDate(p); return d ? `${d.getFullYear()}-${d.getMonth()}` : null; }).filter(Boolean) as string[])
    )
        .sort((a, b) => (a < b ? 1 : -1))
        .map((key) => { const [y, m] = key.split("-").map(Number); return { key, label: `${MONTH_NAMES[m]} ${y}` }; });

    // Inicio de la semana actual (lunes 00:00) en hora local.
    const startOfWeekMonday = (ref: Date): Date => {
        const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
        const dow = d.getDay(); // 0=domingo..6=sábado
        const diff = (dow + 6) % 7; // días desde el lunes
        d.setDate(d.getDate() - diff);
        return d;
    };

    const matchesPeriod = (p: Payment): boolean => {
        // Filtro por mes concreto (excluyente con el rápido).
        if (filterMonth) {
            const d = paymentDate(p);
            if (!d) return false;
            const [y, m] = filterMonth.split("-").map(Number);
            return d.getFullYear() === y && d.getMonth() === m;
        }
        // Filtro rápido.
        if (!filterQuick) return true;
        const d = paymentDate(p);
        if (!d) return false;
        const now = new Date();
        if (filterQuick === "today") {
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        }
        if (filterQuick === "week") {
            const start = startOfWeekMonday(now);
            const end = new Date(start); end.setDate(start.getDate() + 7);
            return d >= start && d < end;
        }
        if (filterQuick === "month") {
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        return true;
    };

    // Apply filters
    const filtered = payments.filter(p => {
        if (filterType && p.type !== filterType) return false;
        if (filterMethod && p.method !== filterMethod) return false;
        if (!matchesPeriod(p)) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const vendorName = vendors.get(p.vendorId)?.toLowerCase() || "";
            const customerName = customers.get(p.customerId)?.toLowerCase() || "";
            const pairLabel = ticketLabel(p.ticketId).toLowerCase();
            if (!vendorName.includes(term) && !customerName.includes(term) && !p.ticketId.includes(term) && !pairLabel.includes(term)) return false;
        }
        return true;
    });

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const totalCollected = filtered.reduce((sum, p) => sum + p.amount, 0);
    const hasFilters = filterType || filterMethod || searchTerm || filterQuick || filterMonth;

    const clearFilters = () => { setFilterType(""); setFilterMethod(""); setSearchTerm(""); setFilterQuick(""); setFilterMonth(""); setPage(1); };

    if (loading) return <div><PageHeader title="Pagos" /><LoadingSkeleton rows={8} /></div>;

    return (
        <div>
          <PageHeader title="Pagos" description={`Historial de pagos${activeRaffle ? ` — ${activeRaffle.name}` : ""}`} />

          {payments.length === 0 ? (
              <EmptyState title="Sin pagos registrados" description="Los pagos aparecerán aquí cuando se registren ventas" icon={<CreditCard className="h-12 w-12" />} />
          ) : (
              <>
                  {/* Summary */}
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <Chip size="sm" variant="soft" className="px-3 py-1">Total: {filtered.length} pagos</Chip>
                            <Chip size="sm" variant="soft" color="success" className="px-3 py-1">Recaudado: {formatCurrency(totalCollected)}</Chip>
                  </div>

                  {/* Filters */}
                  <Card className="mb-4">
                      <CardContent className="p-4">
                          <div className="flex flex-wrap items-center gap-3">
                              <Filter className="h-4 w-4 text-default-400" />

                              <Input
                                  placeholder="Buscar vendedor, cliente o boleta..."
                                  value={searchTerm}
                                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                  className="w-full sm:w-64"
                              />

                                    {/* Filtro rápido: hoy / esta semana / este mes. */}
                                    <Select
                                        aria-label="Período"
                                        selectedKey={filterQuick || null}
                                        onSelectionChange={(key) => { setFilterQuick(key ? String(key) : ""); setFilterMonth(""); setPage(1); }}
                                        placeholder="Todo el tiempo"
                                        className="w-44"
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                            <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                        </SelectTrigger>
                                        <SelectPopover>
                                            <ListBox>
                                                <ListBoxItem id="" textValue="Todo el tiempo">Todo el tiempo</ListBoxItem>
                                                <ListBoxItem id="today" textValue="Hoy">Hoy</ListBoxItem>
                                                <ListBoxItem id="week" textValue="Esta semana">Esta semana</ListBoxItem>
                                                <ListBoxItem id="month" textValue="Este mes">Este mes</ListBoxItem>
                                            </ListBox>
                                        </SelectPopover>
                                    </Select>

                                    {/* Filtro por mes: solo aparece si hay pagos en 2+ meses. */}
                                    {monthOptions.length >= 2 && (
                                        <Select
                                            aria-label="Mes"
                                            selectedKey={filterMonth || null}
                                            onSelectionChange={(key) => { setFilterMonth(key ? String(key) : ""); setFilterQuick(""); setPage(1); }}
                                            placeholder="Por mes"
                                            className="w-48"
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                                <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                            </SelectTrigger>
                                            <SelectPopover>
                                                <ListBox>
                                                    <ListBoxItem id="" textValue="Todos los meses">Todos los meses</ListBoxItem>
                                                    {monthOptions.map((m) => (
                                                        <ListBoxItem key={m.key} id={m.key} textValue={m.label}>{m.label}</ListBoxItem>
                                                    ))}
                                                </ListBox>
                                            </SelectPopover>
                                        </Select>
                                    )}

                                    <Select
                                        aria-label="Tipo de pago"
                                        selectedKey={filterType || null}
                                        onSelectionChange={(key) => { setFilterType(key ? String(key) : ""); setPage(1); }}
                                        placeholder="Todos los tipos"
                                        className="w-44"
                              >
                                        <SelectTrigger>
                                            <SelectValue />
                                            <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                        </SelectTrigger>
                                        <SelectPopover>
                                            <ListBox>
                                                <ListBoxItem id="" textValue="Todos los tipos">Todos los tipos</ListBoxItem>
                                                <ListBoxItem id="payment" textValue="Pago completo">Pago completo</ListBoxItem>
                                                <ListBoxItem id="installment" textValue="Abono">Abono</ListBoxItem>
                                            </ListBox>
                                        </SelectPopover>
                                    </Select>

                                    <Select
                                        aria-label="Método de pago"
                                        selectedKey={filterMethod || null}
                                        onSelectionChange={(key) => { setFilterMethod(key ? String(key) : ""); setPage(1); }}
                                        placeholder="Todos los métodos"
                                        className="w-48"
                              >
                                        <SelectTrigger>
                                            <SelectValue />
                                            <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                        </SelectTrigger>
                                        <SelectPopover>
                                            <ListBox>
                                                <ListBoxItem id="" textValue="Todos los métodos">Todos los métodos</ListBoxItem>
                                                <ListBoxItem id="cash" textValue="Efectivo">Efectivo</ListBoxItem>
                                                <ListBoxItem id="transfer" textValue="Transferencia">Transferencia</ListBoxItem>
                                                <ListBoxItem id="nequi" textValue="Nequi">Nequi</ListBoxItem>
                                                <ListBoxItem id="daviplata" textValue="Daviplata">Daviplata</ListBoxItem>
                                                <ListBoxItem id="other" textValue="Otro">Otro</ListBoxItem>
                                            </ListBox>
                                        </SelectPopover>
                                    </Select>

                              {hasFilters && (
                                  <Button variant="ghost" size="sm" onPress={clearFilters}>
                                      <X className="h-4 w-4" /> Limpiar
                                  </Button>
                              )}
                          </div>
                      </CardContent>
                  </Card>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-lg border border-default-200">
                      <table className="w-full text-sm">
                          <thead className="bg-default-100">
                              <tr>
                                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                                  <th className="px-4 py-3 text-left font-medium">Boleta</th>
                                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                                  <th className="px-4 py-3 text-left font-medium">Vendedor</th>
                                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                                  <th className="px-4 py-3 text-left font-medium">Método</th>
                                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                                        <th className="px-4 py-3 text-right font-medium">Comisión</th>
                                        <th className="px-4 py-3 text-right font-medium">Empresa</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-default-200">
                                    {paginated.map((payment) => {
                                        const commission = vendorCommission(payment.amount);
                                        const companyProfit = payment.amount - commission;
                                        return (
                                  <tr key={payment.id} className="hover:bg-default-50">
                                      <td className="px-4 py-3 text-xs text-default-500">
                                          {payment.createdAt ? formatDateTime(payment.createdAt) : "—"}
                                      </td>
                                                <td className="px-4 py-3 font-mono font-bold">{ticketLabel(payment.ticketId)}</td>
                                      <td className="px-4 py-3">{customers.get(payment.customerId) || "—"}</td>
                                      <td className="px-4 py-3 text-default-600">{vendors.get(payment.vendorId) || "—"}</td>
                                      <td className="px-4 py-3">
                                          <span className={payment.type === "payment" ? "text-success font-medium" : "text-amber-400"}>
                                              {TYPE_LABELS[payment.type] || payment.type}
                                          </span>
                                      </td>
                                      <td className="px-4 py-3 text-default-600"><PaymentMethodBadge method={payment.method} /></td>
                                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                                                <td className="px-4 py-3 text-right text-amber-500 font-medium">{formatCurrency(commission)}</td>
                                          <td className="px-4 py-3 text-right text-success font-medium">{formatCurrency(companyProfit)}</td>
                                  </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>

                  {/* No results after filter */}
                  {filtered.length === 0 && hasFilters && (
                      <div className="text-center py-8">
                          <p className="text-default-500 text-sm">No se encontraron pagos con estos filtros</p>
                      </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                          <p className="text-xs text-default-500">
                              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                          </p>
                          <div className="flex gap-1">
                              <Button variant="ghost" size="sm" isDisabled={page === 1} onPress={() => setPage(p => p - 1)}>Anterior</Button>
                              <span className="text-xs text-default-500 flex items-center px-2">{page} / {totalPages}</span>
                              <Button variant="ghost" size="sm" isDisabled={page === totalPages} onPress={() => setPage(p => p + 1)}>Siguiente</Button>
                          </div>
                      </div>
                  )}

                        {/* Load more from server */}
                        {hasMorePayments && (
                            <div className="mt-3 text-center">
                                <Button variant="outline" size="sm" isDisabled={loadingMore} onPress={async () => {
                                    if (!tenantId || !activeRaffle || !lastPaymentDocRef.current) return;
                                    setLoadingMore(true);
                                    try {
                                        const col = tenantCollection(tenantId, "payments");
                                        const isCashier = userRole === "cashier";
                                        const q = isCashier
                                            ? query(col, where("createdBy", "==", userUid), orderBy("createdAt", "desc"), startAfter(lastPaymentDocRef.current), limit(INITIAL_LOAD))
                                            : query(col, where("raffleId", "==", activeRaffle.id), orderBy("createdAt", "desc"), startAfter(lastPaymentDocRef.current), limit(INITIAL_LOAD));
                                        const snap = await getDocs(q);
                                        let morePayments = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[];
                                        if (isCashier) morePayments = morePayments.filter(p => p.raffleId === activeRaffle.id);
                                        setPayments(prev => [...prev, ...morePayments]);
                                        lastPaymentDocRef.current = snap.docs[snap.docs.length - 1] || null;
                                        setHasMorePayments(snap.docs.length === INITIAL_LOAD);
                                    } catch (e) { console.error(e); }
                                    finally { setLoadingMore(false); }
                                }}>
                                    {loadingMore ? "Cargando..." : "Cargar más pagos"}
                                </Button>
                            </div>
                        )}
              </>
          )}
      </div>
  );
}
