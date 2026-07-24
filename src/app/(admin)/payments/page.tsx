"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Chip, Input, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from "@heroui/react";
import { CreditCard, Filter, X, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, orderBy } from "firebase/firestore";
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

    // Filters
    const [filterType, setFilterType] = useState<string>("");
    const [filterMethod, setFilterMethod] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");

    // Pagination
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    useEffect(() => {
        if (!tenantId) return;
        const load = async () => {
            setLoading(true);
            try {
                // Load payments
                const col = tenantCollection(tenantId, "payments");
                const q = query(col, orderBy("createdAt", "desc"));
                const snap = await getDocs(q);
                setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);

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
    }, [tenantId]);

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
                  <div className="flex flex-wrap gap-3 mb-4">
                      <Chip size="sm" variant="soft">Total: {filtered.length} pagos</Chip>
                      <Chip size="sm" variant="soft" color="success">Recaudado: {formatCurrency(totalCollected)}</Chip>
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
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-default-200">
                              {paginated.map((payment) => (
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
                                      <td className="px-4 py-3 text-default-600">{METHOD_LABELS[payment.method] || payment.method}</td>
                                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                                  </tr>
                              ))}
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
              </>
          )}
      </div>
  );
}
