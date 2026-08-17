"use client";

import { useEffect, useState, useRef } from "react";
import { Button, Card, CardContent, Chip, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from "@heroui/react";
import { Input } from "@/components/ui/input";
import { CreditCard, Filter, X, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PaymentMethodBadge } from "@/components/shared/payment-method-badge";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, orderBy, where, limit, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Payment } from "@/types/api.types";

const TYPE_LABELS: Record<string, string> = { payment: "Pago completo", installment: "Abono" };
const METHOD_LABELS: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", nequi: "Nequi", daviplata: "Daviplata", other: "Otro" };

export default function PaymentsPage() {
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const { activeRaffle } = useRaffleStore();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [vendors, setVendors] = useState<Map<string, string>>(new Map());
    const [customers, setCustomers] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [hasMorePayments, setHasMorePayments] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const lastPaymentDocRef = useRef<QueryDocumentSnapshot | null>(null);

    // Filters
    const [filterType, setFilterType] = useState<string>("");
    const [filterMethod, setFilterMethod] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");

    // Pagination
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const INITIAL_LOAD = 200;

    useEffect(() => {
        if (!tenantId || !activeRaffle) return;
        const load = async () => {
            setLoading(true);
            try {
                // Load payments filtered by active raffle with limit
                const col = tenantCollection(tenantId, "payments");
                const q = query(col, where("raffleId", "==", activeRaffle.id), orderBy("createdAt", "desc"), limit(INITIAL_LOAD));
                const snap = await getDocs(q);
                setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);
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
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [tenantId, activeRaffle]);

    // Apply filters
    const filtered = payments.filter(p => {
        if (filterType && p.type !== filterType) return false;
        if (filterMethod && p.method !== filterMethod) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const vendorName = vendors.get(p.vendorId)?.toLowerCase() || "";
            const customerName = customers.get(p.customerId)?.toLowerCase() || "";
            if (!vendorName.includes(term) && !customerName.includes(term) && !p.ticketId.includes(term)) return false;
        }
        return true;
    });

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const totalCollected = filtered.reduce((sum, p) => sum + p.amount, 0);
    const hasFilters = filterType || filterMethod || searchTerm;

    const clearFilters = () => { setFilterType(""); setFilterMethod(""); setSearchTerm(""); setPage(1); };

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
                                                <ListBoxItem id="card" textValue="Tarjeta">Tarjeta</ListBoxItem>
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
                                        const vendorCommission = Math.floor(payment.amount * 0.10);
                                        const companyProfit = payment.amount - vendorCommission;
                                        return (
                                  <tr key={payment.id} className="hover:bg-default-50">
                                      <td className="px-4 py-3 text-xs text-default-500">
                                          {payment.createdAt ? formatDateTime(payment.createdAt) : "—"}
                                      </td>
                                      <td className="px-4 py-3 font-mono font-bold">{payment.ticketId}</td>
                                      <td className="px-4 py-3">{customers.get(payment.customerId) || "—"}</td>
                                      <td className="px-4 py-3 text-default-600">{vendors.get(payment.vendorId) || "—"}</td>
                                      <td className="px-4 py-3">
                                          <span className={payment.type === "payment" ? "text-success font-medium" : "text-amber-400"}>
                                              {TYPE_LABELS[payment.type] || payment.type}
                                          </span>
                                      </td>
                                      <td className="px-4 py-3 text-default-600"><PaymentMethodBadge method={payment.method} /></td>
                                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                                          <td className="px-4 py-3 text-right text-amber-500 font-medium">{formatCurrency(vendorCommission)}</td>
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
                                        const q = query(col, where("raffleId", "==", activeRaffle.id), orderBy("createdAt", "desc"), startAfter(lastPaymentDocRef.current), limit(INITIAL_LOAD));
                                        const snap = await getDocs(q);
                                        const morePayments = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[];
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
