"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator, Chip, AlertDialog } from "@heroui/react";
import { ArrowLeft, User, Phone, Hash, Ticket, UserMinus, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { ticketService } from "@/features/raffles/services/ticket.service";
import { getDocs, query, where, orderBy, doc, getDoc } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import type { Vendor, Ticket as TicketType } from "@/types/api.types";

interface TicketWithCustomer extends TicketType {
    customerName?: string;
}

// --- Main Page ---

export default function VendorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const vendorId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const { activeRaffle } = useRaffleStore();

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [tickets, setTickets] = useState<TicketWithCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!activeRaffle) router.push("/raffles");
    }, [activeRaffle, router]);

    useEffect(() => {
        if (!tenantId || !vendorId) return;
        const load = async () => {
            try {
                const vendorDoc = await getDoc(doc(getDb(), "tenants", tenantId, "vendors", vendorId));
                if (vendorDoc.exists()) setVendor({ id: vendorDoc.id, ...vendorDoc.data() } as Vendor);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
    };
      load();
  }, [tenantId, vendorId]);

    useEffect(() => {
        if (!tenantId || !vendorId || !activeRaffle) return;
        const load = async () => {
            setTicketsLoading(true);
            try {
                const customersSnap = await getDocs(tenantCollection(tenantId, "customers"));
                const customersMap = new Map<string, string>();
                customersSnap.docs.forEach(d => {
                    customersMap.set(d.id, d.data().name);
                });

                const ticketsCol = tenantCollection(tenantId, `raffles/${activeRaffle.id}/tickets`);
                const q = query(ticketsCol, where("vendorId", "==", vendorId), orderBy("number", "asc"));
                const ticketsSnap = await getDocs(q);

                setTickets(ticketsSnap.docs.map(d => {
                    const data = d.data() as TicketType;
                    return { ...data, customerName: data.customerId ? customersMap.get(data.customerId) || data.customerId : undefined };
                }));
            } catch (e) { console.error(e); }
            finally { setTicketsLoading(false); }
        };
        load();
    }, [tenantId, vendorId, activeRaffle, reloadKey]);


    if (!activeRaffle) return null;
    if (loading) return <div><PageHeader title="Vendedor" /><LoadingSkeleton rows={6} /></div>;
    if (!vendor) return <div><PageHeader title="Vendedor no encontrado" /></div>;

    const assigned = tickets.filter(t => t.status === "assigned").length;
    const sold = tickets.filter(t => t.status === "sold").length;
    const paid = tickets.filter(t => t.status === "paid").length;
    const installment = tickets.filter(t => t.status === "installment").length;

    return (
      <div>
          <PageHeader
              title={vendor.name}
              description={`Boletas en "${activeRaffle.name}"`}
              actions={<Link href="/vendors"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button></Link>}
          />

          {/* Vendor info */}
      <Card className="mb-6">
              <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10"><User className="h-5 w-5 text-primary" /></div>
                          <div><p className="text-xs text-default-500">Nombre</p><p className="font-semibold text-sm">{vendor.name}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-warning/10"><Hash className="h-5 w-5 text-warning" /></div>
                          <div><p className="text-xs text-default-500">Documento</p><p className="font-semibold text-sm">{vendor.document}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-success/10"><Phone className="h-5 w-5 text-success" /></div>
                          <div><p className="text-xs text-default-500">Teléfono</p><p className="font-semibold text-sm">{vendor.phone}</p></div>
                      </div>
                  </div>
              </CardContent>
          </Card>

          <Separator className="my-6" />

          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Ticket className="h-5 w-5" /> Boletas en esta rifa
          </h2>

          {ticketsLoading ? <LoadingSkeleton rows={5} /> : (
              <>
                  <div className="flex gap-2 flex-wrap mb-4">
                      <Chip size="sm" variant="soft">Total: {tickets.length}</Chip>
                      <Chip size="sm" variant="soft" color="warning">Asignadas: {assigned}</Chip>
                      <Chip size="sm" variant="soft" color="accent">Vendidas: {sold}</Chip>
                      <Chip size="sm" variant="soft" color="success">Pagadas: {paid}</Chip>
                        <Chip size="sm" variant="soft" color="danger">Abonadas: {installment}</Chip>
                  </div>

                  {tickets.length === 0 ? (
                      <EmptyState title="Sin boletas" description="Este vendedor no tiene boletas en esta rifa" icon={<Ticket className="h-12 w-12" />} />
                  ) : (
                            <TicketsTableWithUnassign tickets={tickets} raffleId={activeRaffle.id} onReload={() => setReloadKey(k => k + 1)} onSell={(num) => router.push(`/sell/${num}`)} />
                  )}
              </>
          )}

      </div>
  );
}

// --- Table with unassign (SRP) ---

function TicketsTableWithUnassign({ tickets, raffleId, onReload, onSell }: { tickets: TicketWithCustomer[]; raffleId: string; onReload: () => void; onSell: (ticketNum: number) => void }) {
    const [confirmTicket, setConfirmTicket] = useState<number | null>(null);
    const [unassigning, setUnassigning] = useState(false);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const totalPages = Math.ceil(tickets.length / PAGE_SIZE);
    const paginatedTickets = tickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleUnassign = async () => {
        if (confirmTicket === null) return;
        setUnassigning(true);
        try {
            await ticketService.unassign(raffleId, [confirmTicket]);
            setConfirmTicket(null);
            onReload();
        } catch (e) { console.error(e); }
        finally { setUnassigning(false); }
    };

    return (
      <>
          <div className="overflow-x-auto rounded-lg border border-default-200">
              <table className="w-full text-sm">
                  <thead className="bg-default-100">
                      <tr>
                          <th className="px-4 py-3 text-left font-medium">#</th>
                          <th className="px-4 py-3 text-left font-medium">Estado</th>
                          <th className="px-4 py-3 text-left font-medium">Cliente</th>
                          <th className="px-4 py-3 text-right font-medium">Valor</th>
                          <th className="px-4 py-3 text-right font-medium">Saldo</th>
                          <th className="px-4 py-3 text-center font-medium">Acción</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                        {paginatedTickets.map((ticket) => (
              <tr key={ticket.number} className="hover:bg-default-50">
                    <td className="px-4 py-3 font-mono font-bold">{ticket.number}</td>
                    <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                    <td className="px-4 py-3">
                        {ticket.customerName ? (
                            <span className={ticket.pendingBalance === 0 ? "text-success font-medium" : ""}>
                                {ticket.customerName}
                                {ticket.pendingBalance === 0 && <span className="ml-1 text-xs">(Pagado ✓)</span>}
                            </span>
                        ) : (
                                          <span className="text-danger italic">Sin cliente</span>
                        )}
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(ticket.value)}</td>
                    <td className="px-4 py-3 text-right">
                        {ticket.pendingBalance === 0
                            ? <span className="text-success font-medium">$0</span>
                            : <span className="text-warning font-medium">{formatCurrency(ticket.pendingBalance)}</span>
                        }
                    </td>
                    <td className="px-4 py-3 text-center">
                        {ticket.status === "assigned" && (
                                      <div className="flex items-center justify-center gap-1">
                                          <Button variant="ghost" size="sm" onPress={() => onSell(ticket.number)} aria-label="Vender">
                                              <ShoppingCart className="h-4 w-4 text-blue-400" />
                                          </Button>
                                          <Button variant="ghost" size="sm" onPress={() => setConfirmTicket(ticket.number)} aria-label="Desasignar">
                                              <UserMinus className="h-4 w-4 text-danger" />
                                          </Button>
                                      </div>
                        )}
                    </td>
              </tr>
            ))}
                  </tbody>
              </table>
          </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-xs text-default-500">
                        Mostrando {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, tickets.length)} de {tickets.length}
                    </p>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" isDisabled={page === 1} onPress={() => setPage(p => p - 1)}>
                            Anterior
                        </Button>
                        <span className="text-xs text-default-500 px-2">{page} / {totalPages}</span>
                        <Button variant="ghost" size="sm" isDisabled={page === totalPages} onPress={() => setPage(p => p + 1)}>
                            Siguiente
                        </Button>
                    </div>
                </div>
            )}

          {/* Confirmation dialog */}
          <AlertDialog.Backdrop isOpen={confirmTicket !== null} onOpenChange={(open) => { if (!open) setConfirmTicket(null); }} isDismissable>
              <AlertDialog.Container placement="center" size="sm">
                  <AlertDialog.Dialog>
                      <AlertDialog.CloseTrigger />
                      <AlertDialog.Header>
                          <AlertDialog.Icon status="warning" />
                          <AlertDialog.Heading>¿Desasignar boleta #{confirmTicket}?</AlertDialog.Heading>
                      </AlertDialog.Header>
                      <AlertDialog.Body>
                          <p>La boleta volverá a estar <strong>disponible</strong> y se quitará de este vendedor.</p>
                          <p className="text-sm text-default-500 mt-2">Solo aplica para boletas que aún no han sido vendidas a un cliente.</p>
                      </AlertDialog.Body>
                      <AlertDialog.Footer>
                          <Button slot="close" variant="tertiary">Cancelar</Button>
                          <Button variant="danger" isDisabled={unassigning} onPress={handleUnassign}>
                              {unassigning ? "Desasignando..." : "Sí, desasignar"}
                          </Button>
                      </AlertDialog.Footer>
                  </AlertDialog.Dialog>
              </AlertDialog.Container>
          </AlertDialog.Backdrop>
      </>
  );
}
