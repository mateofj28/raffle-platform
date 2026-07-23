"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Chip } from "@heroui/react";
import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { Ticket as TicketType } from "@/types/api.types";

export default function VendorTicketsPage() {
    const user = useAuthStore((s) => s.user);
    const [tickets, setTickets] = useState<TicketType[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    useEffect(() => {
        if (!user?.tenantId || !user?.vendorId) return;
        const load = async () => {
            setLoading(true);
            try {
                // Get all raffles to find vendor's tickets
                const rafflesSnap = await getDocs(tenantCollection(user.tenantId, "raffles"));
                const allTickets: TicketType[] = [];

                for (const raffleDoc of rafflesSnap.docs) {
                    const ticketsCol = tenantCollection(user.tenantId, `raffles/${raffleDoc.id}/tickets`);
                    const q = query(ticketsCol, where("vendorId", "==", user.vendorId), orderBy("number", "asc"));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => allTickets.push(d.data() as TicketType));
                }

                setTickets(allTickets);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [user?.tenantId, user?.vendorId]);

    const totalPages = Math.ceil(tickets.length / PAGE_SIZE);
    const paginatedTickets = tickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const assigned = tickets.filter(t => t.status === "assigned").length;
    const sold = tickets.filter(t => t.status === "sold").length;
    const paid = tickets.filter(t => t.status === "paid").length;
    const installment = tickets.filter(t => t.status === "installment").length;

    if (loading) return <div><PageHeader title="Mis Boletas" /><LoadingSkeleton rows={6} /></div>;

    return (
        <div>
          <PageHeader title="Mis Boletas" description="Todas las boletas asignadas a ti" />

          {tickets.length === 0 ? (
              <EmptyState title="Sin boletas" description="Aún no te han asignado boletas" icon={<Ticket className="h-12 w-12" />} />
          ) : (
              <>
                  {/* Summary chips */}
                  <div className="flex gap-2 flex-wrap mb-4">
                      <Chip size="sm" variant="soft">Total: {tickets.length}</Chip>
                      <Chip size="sm" variant="soft" color="warning">Asignadas: {assigned}</Chip>
                      <Chip size="sm" variant="soft" color="accent">Vendidas: {sold}</Chip>
                      <Chip size="sm" variant="soft" color="success">Pagadas: {paid}</Chip>
                      <Chip size="sm" variant="soft" color="danger">Abonadas: {installment}</Chip>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-lg border border-default-200">
                      <table className="w-full text-sm">
                          <thead className="bg-default-100">
                              <tr>
                                  <th className="px-4 py-3 text-left font-medium">#</th>
                                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-default-200">
                              {paginatedTickets.map((ticket) => (
                                  <tr key={ticket.number} className="hover:bg-default-50">
                                      <td className="px-4 py-3 font-mono font-bold">{ticket.number}</td>
                                      <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                                      <td className="px-4 py-3 text-right">{formatCurrency(ticket.value)}</td>
                                      <td className="px-4 py-3 text-right">
                                          {ticket.pendingBalance === 0
                                              ? <span className="text-success font-medium">$0</span>
                                              : <span className="text-warning font-medium">{formatCurrency(ticket.pendingBalance)}</span>
                                          }
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                          <p className="text-xs text-default-500">
                              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, tickets.length)} de {tickets.length}
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
