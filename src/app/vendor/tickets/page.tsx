"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Chip, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem, Tooltip } from "@heroui/react";
import { Ticket, ChevronDown, ShoppingCart, DollarSign, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useSettingsStore } from "@/store/settings.store";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Ticket as TicketType, Customer } from "@/types/api.types";

export default function VendorTicketsPage() {
    const user = useAuthStore((s) => s.user);
    const commissionRate = useSettingsStore((s) => s.settings.commissionRate);
    const commissionPct = Math.round(commissionRate * 100);
    const router = useRouter();
    const [tickets, setTickets] = useState<TicketType[]>([]);
    const [customers, setCustomers] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [raffleName, setRaffleName] = useState("");
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const PAGE_SIZE = 20;

    useEffect(() => {
        if (!user?.tenantId || !user?.vendorId) return;
        const load = async () => {
            setLoading(true);
            try {
                // Find the active raffle
                const rafflesCol = tenantCollection(user.tenantId, "raffles");
                const rafflesQ = query(rafflesCol, where("status", "in", ["active", "draft"]), orderBy("createdAt", "desc"));
                const rafflesSnap = await getDocs(rafflesQ);

                if (rafflesSnap.empty) {
                    setTickets([]);
                    return;
                }

                const activeRaffle = rafflesSnap.docs[0];
                setRaffleName(activeRaffle.data().name);

                // Get vendor's tickets
                const ticketsCol = tenantCollection(user.tenantId, `raffles/${activeRaffle.id}/tickets`);
                const q = query(ticketsCol, where("vendorId", "==", user.vendorId), orderBy("number", "asc"));
                const snap = await getDocs(q);
                setTickets(snap.docs.map(d => d.data() as TicketType));

                // Load customers for name resolution
                const customersSnap = await getDocs(tenantCollection(user.tenantId, "customers"));
                const cMap = new Map<string, string>();
                customersSnap.docs.forEach(d => cMap.set(d.id, d.data().name));
                setCustomers(cMap);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [user?.tenantId, user?.vendorId]);

    // Filters
    const filtered = tickets.filter(t => {
        if (statusFilter && t.status !== statusFilter) return false;
        if (search) {
            const term = search.toLowerCase();
            const matchesNumber = String(t.number).includes(term);
            const customerName = t.customerId ? customers.get(t.customerId)?.toLowerCase() || "" : "";
            if (!matchesNumber && !customerName.includes(term)) return false;
        }
        return true;
    });

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedTickets = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const assigned = tickets.filter(t => t.status === "assigned").length;
    const sold = tickets.filter(t => t.status === "sold").length;
    const paid = tickets.filter(t => t.status === "paid").length;
    const installment = tickets.filter(t => t.status === "installment").length;

    // Financial metrics
    const totalCollected = tickets.reduce((sum, t) => sum + (t.value - t.pendingBalance), 0);
    const recaudadoPagadas = tickets.filter(t => t.status === "paid").reduce((sum, t) => sum + t.value, 0);
    const recaudadoAbonadas = tickets.filter(t => t.status === "installment").reduce((sum, t) => sum + (t.value - t.pendingBalance), 0);
    const commission = Math.floor(totalCollected * commissionRate);

    if (loading) return <div><PageHeader title="Mis Boletas" /><LoadingSkeleton rows={6} /></div>;

    return (
        <div>
            <PageHeader title="Mis Boletas" description={raffleName ? `Rifa: ${raffleName}` : "Boletas asignadas a ti"} />

          {tickets.length === 0 ? (
              <EmptyState title="Sin boletas" description="Aún no te han asignado boletas" icon={<Ticket className="h-12 w-12" />} />
          ) : (
              <>
                  {/* Summary chips */}
                  <div className="flex gap-2 flex-wrap mb-4">
                            <Chip size="sm" variant="soft" className="px-3 py-1">Total: {tickets.length}</Chip>
                            <Chip size="sm" variant="soft" color="warning" className="px-3 py-1">Asignadas: {assigned}</Chip>
                            <Chip size="sm" variant="soft" color="accent" className="px-3 py-1">Vendidas: {sold}</Chip>
                            <Chip size="sm" variant="soft" color="success" className="px-3 py-1">Pagadas: {paid}</Chip>
                            <Chip size="sm" variant="soft" color="danger" className="px-3 py-1">Abonadas: {installment}</Chip>
                  </div>

                        {/* Financial cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                            <div className="p-4 rounded-lg border border-default-200">
                                <p className="text-xs text-default-500 mb-1">Total recaudado</p>
                                <p className="text-lg font-bold">{formatCurrency(totalCollected)}</p>
                            </div>
                            <div className="p-4 rounded-lg border border-default-200">
                                <p className="text-xs text-default-500 mb-1">Recaudado (pagadas)</p>
                                <p className="text-lg font-bold text-emerald-500">{formatCurrency(recaudadoPagadas)}</p>
                            </div>
                            <div className="p-4 rounded-lg border border-default-200">
                                <p className="text-xs text-default-500 mb-1">Recaudado (abonadas)</p>
                                <p className="text-lg font-bold text-emerald-500">{formatCurrency(recaudadoAbonadas)}</p>
                            </div>
                            <div className="p-4 rounded-lg border border-default-200">
                                <p className="text-xs text-default-500 mb-1">Mi comisión ({commissionPct}%)</p>
                                <p className="text-lg font-bold text-amber-500">{formatCurrency(commission)}</p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <Input
                                placeholder="Buscar por # boleta o cliente..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="w-full sm:w-80"
                            />
                            <Select
                                aria-label="Filtrar por estado"
                                selectedKey={statusFilter || null}
                                onSelectionChange={(key) => { setStatusFilter(key ? String(key) : ""); setPage(1); }}
                                placeholder="Todos los estados"
                                className="w-48"
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                    <SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator>
                                </SelectTrigger>
                                <SelectPopover>
                                    <ListBox>
                                        <ListBoxItem id="" textValue="Todos los estados">Todos los estados</ListBoxItem>
                                        <ListBoxItem id="assigned" textValue="Asignada">Asignada</ListBoxItem>
                                        <ListBoxItem id="sold" textValue="Vendida">Vendida</ListBoxItem>
                                        <ListBoxItem id="paid" textValue="Pagada">Pagada</ListBoxItem>
                                        <ListBoxItem id="installment" textValue="Abonada">Abonada</ListBoxItem>
                                    </ListBox>
                                </SelectPopover>
                            </Select>
                            {(search || statusFilter) && (
                                <Button variant="ghost" size="sm" onPress={() => { setSearch(""); setStatusFilter(""); setPage(1); }}>
                                    ✕ Limpiar
                                </Button>
                            )}
                            <span className="text-xs text-default-500 ml-auto">{filtered.length} boletas</span>
                        </div>

                  {/* Table */}
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Ticket className="h-8 w-8 text-default-400 mb-2" />
                                <p className="text-sm text-default-600">Sin resultados</p>
                                <p className="text-xs text-default-400">No hay boletas que coincidan con los filtros</p>
                            </div>
                        ) : (
                                <div className="overflow-x-auto rounded-lg border border-default-200">
                                    <table className="w-full text-sm">
                                        <thead className="bg-default-100">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium">#</th>
                                                <th className="px-4 py-3 text-left font-medium">Estado</th>
                                                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                                                <th className="px-4 py-3 text-right font-medium">Abonado</th>
                                                <th className="px-4 py-3 text-right font-medium">Saldo</th>
                                                <th className="px-4 py-3 text-center font-medium">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-default-200">
                                            {paginatedTickets.map((ticket) => {
                                                const amountPaid = ticket.value - ticket.pendingBalance;
                                                const customerName = ticket.customerId ? customers.get(ticket.customerId) || "—" : "—";
                                                return (
                                                    <tr key={ticket.number} className="hover:bg-default-50">
                                                        <td className="px-4 py-3 font-mono font-bold">{ticket.number}</td>
                                                        <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                                                        <td className="px-4 py-3">{customerName}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {amountPaid > 0
                                                                ? <span className="text-emerald-500 font-medium">{formatCurrency(amountPaid)}</span>
                                                                : <span className="text-default-400">$0</span>
                                                            }
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {ticket.pendingBalance > 0
                                                                ? <span className="text-red-400 font-medium">{formatCurrency(ticket.pendingBalance)}</span>
                                                                : <span className="text-white font-medium">$0</span>
                                                            }
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {(ticket.status === "assigned" || ticket.status === "sold" || ticket.status === "installment" || ticket.status === "paid") && (
                                                                    <Tooltip>
                                                                        <Tooltip.Trigger>
                                                                            <Button variant="ghost" size="sm" isIconOnly onPress={() => router.push(`/vendor/edit-ticket/${ticket.number}?action=client`)} aria-label="Asignar/Cambiar cliente">
                                                                                <Pencil className="h-4 w-4 text-amber-400" />
                                                                            </Button>
                                                                        </Tooltip.Trigger>
                                                                        <Tooltip.Content>{ticket.status === "assigned" ? "Asignar cliente" : "Cambiar cliente"}</Tooltip.Content>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
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
                              <Button variant="ghost" size="sm" isDisabled={page === totalPages} onPress={() => setPage(p => p + 1)}>Siguiente</Button>
                          </div>
                      </div>
                  )}
              </>
          )}
      </div>
  );
}
