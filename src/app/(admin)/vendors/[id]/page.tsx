"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator, Chip, AlertDialog, Input, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from "@heroui/react";
import { ArrowLeft, User, Phone, Hash, Ticket, UserMinus, ShoppingCart, ChevronDown, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { ticketService } from "@/features/raffles/services/ticket.service";
import { callFunction } from "@/services/firebase-callable";
import { getDocs, query, where, orderBy, doc, getDoc } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import type { Vendor, Ticket as TicketType, Customer } from "@/types/api.types";

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
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);

    // Sell modal state
    const [sellTicketNum, setSellTicketNum] = useState<number | null>(null);
    const [sellCustomerId, setSellCustomerId] = useState("");
    const [sellPaymentOption, setSellPaymentOption] = useState<"none" | "full" | "partial">("none");
    const [sellPaymentAmount, setSellPaymentAmount] = useState("");
    const [customerSearch, setCustomerSearch] = useState("");
    const [selling, setSelling] = useState(false);
    const [sellError, setSellError] = useState<string | null>(null);

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
                const customersList: Customer[] = [];
                customersSnap.docs.forEach(d => {
                    customersMap.set(d.id, d.data().name);
                    customersList.push({ id: d.id, ...d.data() } as Customer);
                });
                setCustomers(customersList);

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

    // Sell ticket to customer
    const handleSell = async () => {
        if (!sellTicketNum || !sellCustomerId || !activeRaffle) return;
        setSelling(true);
        setSellError(null);
        try {
            // 1. Sell the ticket
            await callFunction("sellTicket", {
                raffleId: activeRaffle.id,
                ticketNumber: sellTicketNum,
                customerId: sellCustomerId,
            });

            // 2. Register payment if selected
            if (sellPaymentOption === "full") {
                await callFunction("registerPayment", {
                    raffleId: activeRaffle.id,
                    ticketNumber: sellTicketNum,
                    amount: activeRaffle.ticketPrice,
                    type: "payment",
                    method: "cash",
                    observations: "Pago completo al momento de la venta",
                });
            } else if (sellPaymentOption === "partial" && sellPaymentAmount) {
                const amount = parseInt(sellPaymentAmount);
                if (amount > 0) {
                    await callFunction("registerPayment", {
                        raffleId: activeRaffle.id,
                        ticketNumber: sellTicketNum,
                        amount,
                        type: "installment",
                        method: "cash",
                        observations: "Abono al momento de la venta",
                    });
                }
            }

            setSellTicketNum(null);
            setSellCustomerId("");
            setSellPaymentOption("none");
            setSellPaymentAmount("");
            setCustomerSearch("");
            setReloadKey(k => k + 1);
        } catch (e) {
            setSellError(e instanceof Error ? e.message : "Error al vender la boleta");
        } finally {
            setSelling(false);
        }
    };

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
                      <Chip size="sm" variant="soft" color="accent">Abonadas: {installment}</Chip>
                  </div>

                  {tickets.length === 0 ? (
                      <EmptyState title="Sin boletas" description="Este vendedor no tiene boletas en esta rifa" icon={<Ticket className="h-12 w-12" />} />
                  ) : (
                            <TicketsTableWithUnassign tickets={tickets} raffleId={activeRaffle.id} customers={customers} onReload={() => setReloadKey(k => k + 1)} onSell={(num) => setSellTicketNum(num)} />
                  )}
              </>
          )}

            {/* Sell ticket modal */}
            <AlertDialog.Backdrop isOpen={sellTicketNum !== null} onOpenChange={(open) => { if (!open) { setSellTicketNum(null); setSellCustomerId(""); setSellError(null); setSellPaymentOption("none"); setSellPaymentAmount(""); setCustomerSearch(""); } }} isDismissable>
                <AlertDialog.Container placement="center" size="md">
                    <AlertDialog.Dialog>
                        <AlertDialog.CloseTrigger />
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="accent" />
                            <AlertDialog.Heading>Vender boleta #{sellTicketNum}</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            {/* Customer search */}
                            <div className="space-y-2 mb-5">
                                <label className="text-sm font-medium">Cliente</label>
                                <Input
                                    placeholder="Buscar por nombre o cédula..."
                                    value={customerSearch}
                                    onChange={(e) => { setCustomerSearch(e.target.value); setSellCustomerId(""); }}
                                    className="w-full"
                                />
                                {customerSearch.length >= 2 && !sellCustomerId && (
                                    <div className="max-h-32 overflow-y-auto rounded-lg border border-default-200 divide-y divide-default-100">
                                        {customers
                                            .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.document.includes(customerSearch))
                                            .slice(0, 5)
                                            .map(c => (
                                                <button key={c.id} type="button" onClick={() => { setSellCustomerId(c.id); setCustomerSearch(c.name); }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-default-100 transition-colors">
                                                    <span className="font-medium">{c.name}</span>
                                                    <span className="text-default-500 ml-2 text-xs">CC {c.document}</span>
                                                </button>
                                            ))
                                        }
                                        {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.document.includes(customerSearch)).length === 0 && (
                                            <div className="px-3 py-2 text-xs text-default-500">No encontrado. <Link href="/customers/new" className="text-primary underline">Crear cliente</Link></div>
                                        )}
                                    </div>
                                )}
                                {sellCustomerId && <p className="text-xs text-success">✓ Cliente seleccionado</p>}
                            </div>

                            {/* Payment options */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">¿Cómo paga?</label>
                                <div className="grid grid-cols-1 gap-2">
                                    <button type="button" onClick={() => setSellPaymentOption("none")} className={`text-left p-3 rounded-lg border text-sm transition-colors ${sellPaymentOption === "none" ? "border-primary bg-primary/5" : "border-default-200 hover:bg-default-50"}`}>
                                        <span className="font-medium">Solo asignar al cliente</span>
                                        <span className="text-xs text-default-500 block mt-0.5">Queda pendiente. Pagará después.</span>
                                    </button>
                                    <button type="button" onClick={() => setSellPaymentOption("full")} className={`text-left p-3 rounded-lg border text-sm transition-colors ${sellPaymentOption === "full" ? "border-emerald-500 bg-emerald-500/5" : "border-default-200 hover:bg-default-50"}`}>
                                        <span className="font-medium">Pago completo</span>
                                        <span className="text-xs text-default-500 block mt-0.5">Paga {formatCurrency(activeRaffle?.ticketPrice || 0)} ahora.</span>
                                    </button>
                                    <button type="button" onClick={() => setSellPaymentOption("partial")} className={`text-left p-3 rounded-lg border text-sm transition-colors ${sellPaymentOption === "partial" ? "border-amber-500 bg-amber-500/5" : "border-default-200 hover:bg-default-50"}`}>
                                        <span className="font-medium">Abono parcial</span>
                                        <span className="text-xs text-default-500 block mt-0.5">Paga una parte ahora.</span>
                                    </button>
                                </div>
                                {sellPaymentOption === "partial" && (
                                    <Input type="number" placeholder="Monto del abono" value={sellPaymentAmount} onChange={(e) => setSellPaymentAmount(e.target.value)} className="w-full mt-2" inputMode="numeric" />
                                )}
                            </div>

                            {sellError && <p className="text-xs text-danger mt-3">{sellError}</p>}
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="tertiary">Cancelar</Button>
                            <Button variant="primary" isDisabled={!sellCustomerId || selling} onPress={handleSell}>
                                {selling ? "Procesando..." : "Confirmar venta"}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
      </div>
  );
}

// --- Table with unassign (SRP) ---

function TicketsTableWithUnassign({ tickets, raffleId, customers, onReload, onSell }: { tickets: TicketWithCustomer[]; raffleId: string; customers: Customer[]; onReload: () => void; onSell: (ticketNum: number) => void }) {
    const [confirmTicket, setConfirmTicket] = useState<number | null>(null);
    const [unassigning, setUnassigning] = useState(false);

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
                      {tickets.map((ticket) => (
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
                            <span className="text-default-400 italic">Sin cliente</span>
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
