"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator, Chip, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox, ListBoxItem } from "@heroui/react";
import { ArrowLeft, User, Phone, MapPin, Hash, Ticket, CreditCard, Pencil, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentMethodBadge } from "@/components/shared/payment-method-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDateTime, formatTicketNumber } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, where, orderBy, doc, getDoc } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import type { Customer, Ticket as TicketType, Payment } from "@/types/api.types";

interface TicketWithRaffle extends TicketType {
    raffleName?: string;
}

export default function CustomerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const customerId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const { activeRaffle } = useRaffleStore();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [tickets, setTickets] = useState<TicketWithRaffle[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(true);

    // Filtros del historial de pagos
    const [filterTicket, setFilterTicket] = useState("");
    const [filterType, setFilterType] = useState("");
    const [filterMethod, setFilterMethod] = useState("");

    // Load customer
    useEffect(() => {
        if (!tenantId || !customerId) return;
        const load = async () => {
            try {
                const customerDoc = await getDoc(doc(getDb(), "tenants", tenantId, "customers", customerId));
                if (customerDoc.exists()) setCustomer({ id: customerDoc.id, ...customerDoc.data() } as Customer);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [tenantId, customerId]);

    // Load tickets + payments for this customer
    useEffect(() => {
        if (!tenantId || !customerId) return;
        const load = async () => {
            setDataLoading(true);
            try {
                // Tickets for the active raffle only
                const { activeRaffle } = useRaffleStore.getState();
                const allTickets: TicketWithRaffle[] = [];

                if (activeRaffle) {
                    const ticketsCol = tenantCollection(tenantId, `raffles/${activeRaffle.id}/tickets`);
                    const q = query(ticketsCol, where("customerId", "==", customerId));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => {
                        allTickets.push({ ...d.data() as TicketType, raffleName: activeRaffle.name });
                    });
                }
                setTickets(allTickets);

                // Payments
                const paymentsCol = tenantCollection(tenantId, "payments");
                const pq = query(paymentsCol, where("customerId", "==", customerId), orderBy("createdAt", "desc"));
                const paymentsSnap = await getDocs(pq);
                setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[]);
            } catch (e) { console.error(e); }
            finally { setDataLoading(false); }
        };
        load();
    }, [tenantId, customerId]);

    if (loading) return <div><PageHeader title="Cliente" /><LoadingSkeleton rows={6} /></div>;
    if (!customer) return <div><PageHeader title="Cliente no encontrado" /></div>;

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = tickets.reduce((sum, t) => sum + t.pendingBalance, 0);

    // Pagos filtrados por boleta, tipo y método
    const filteredPayments = payments.filter((p) => {
        if (filterTicket && !String(p.ticketId).includes(filterTicket.trim())) return false;
        if (filterType && p.type !== filterType) return false;
        if (filterMethod && p.method !== filterMethod) return false;
        return true;
    });

    return (
        <div>
          <PageHeader
              title={customer.name}
              description="Historial del cliente"
              actions={
                  <div className="flex items-center gap-2">
                      <Link href={`/customers/${customerId}/edit`}>
                          <Button variant="outline" size="sm"><Pencil className="h-4 w-4" /> Editar</Button>
                      </Link>
                      <Link href="/customers">
                          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button>
                      </Link>
                  </div>
              }
          />

          {/* Customer info */}
          <Card className="mb-6">
              <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10"><User className="h-5 w-5 text-primary" /></div>
                          <div><p className="text-xs text-default-500">Nombre</p><p className="font-semibold text-sm">{customer.name}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-warning/10"><Hash className="h-5 w-5 text-warning" /></div>
                          <div><p className="text-xs text-default-500">Cédula</p><p className="font-semibold text-sm">{customer.document}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-success/10"><Phone className="h-5 w-5 text-success" /></div>
                          <div><p className="text-xs text-default-500">Teléfono</p><p className="font-semibold text-sm">{customer.phone}</p></div>
                      </div>
                      {customer.city && (
                          <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-default-100"><MapPin className="h-5 w-5 text-default-600" /></div>
                              <div><p className="text-xs text-default-500">Ciudad</p><p className="font-semibold text-sm">{customer.city}</p></div>
                          </div>
                      )}
                  </div>
              </CardContent>
          </Card>

          {/* Financial summary */}
          <div className="flex flex-wrap gap-3 mb-6">
                <Chip size="sm" variant="soft" color="success" className="px-3 py-1">Pagado: {formatCurrency(totalPaid)}</Chip>
                <Chip size="sm" variant="soft" color="warning" className="px-3 py-1">Pendiente: {formatCurrency(totalPending)}</Chip>
                <Chip size="sm" variant="soft" className="px-3 py-1">Boletas: {tickets.length}</Chip>
                <Chip size="sm" variant="soft" className="px-3 py-1">Pagos: {payments.length}</Chip>
          </div>

          {dataLoading ? <LoadingSkeleton rows={5} /> : (
              <>
                  {/* Tickets */}
                  <Separator className="my-6" />
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Ticket className="h-5 w-5" /> Boletas compradas
                  </h2>

                  {tickets.length === 0 ? (
                      <EmptyState title="Sin boletas" description="Este cliente no ha comprado boletas" icon={<Ticket className="h-10 w-10" />} />
                  ) : (
                      <div className="overflow-x-auto rounded-lg border border-default-200 mb-8">
                          <table className="w-full text-sm">
                              <thead className="bg-default-100">
                                  <tr>
                                            <th className="px-4 py-3 text-left font-medium">#</th>
                                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                                            <th className="px-4 py-3 text-right font-medium">Pagado</th>
                                            <th className="px-4 py-3 text-right font-medium">Pendiente</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-default-200">
                                  {tickets.map((ticket, i) => (
                                      <tr key={`${ticket.number}-${i}`} className="hover:bg-default-50">
                                          <td className="px-4 py-3 font-mono font-bold">{formatTicketNumber(ticket.number)}</td>
                                          <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                                          <td className="px-4 py-3 text-right">
                                              <span className="text-success font-medium">{formatCurrency(ticket.value - ticket.pendingBalance)}</span>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                              {ticket.pendingBalance === 0
                                                  ? <span className="text-white font-medium">$0</span>
                                                  : <span className="text-warning font-medium">{formatCurrency(ticket.pendingBalance)}</span>
                                              }
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  )}

                  {/* Payments */}
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5" /> Historial de pagos
                  </h2>

                  {payments.length === 0 ? (
                      <EmptyState title="Sin pagos" description="Este cliente no ha realizado pagos" icon={<CreditCard className="h-10 w-10" />} />
                  ) : (
                            <>
                                {/* Filtros */}
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <Input
                                        placeholder="Buscar por # boleta..."
                                        value={filterTicket}
                                        onChange={(e) => setFilterTicket(e.target.value.replace(/\D/g, ""))}
                                        inputMode="numeric"
                                        className="w-full sm:w-56"
                                    />
                                    <Select aria-label="Tipo de pago" selectedKey={filterType || null} onSelectionChange={(key) => setFilterType(key ? String(key) : "")} placeholder="Todos los tipos" className="w-44">
                                        <SelectTrigger><SelectValue /><SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator></SelectTrigger>
                                        <SelectPopover>
                                            <ListBox>
                                                <ListBoxItem id="" textValue="Todos los tipos">Todos los tipos</ListBoxItem>
                                                <ListBoxItem id="payment" textValue="Pago completo">Pago completo</ListBoxItem>
                                                <ListBoxItem id="installment" textValue="Abono">Abono</ListBoxItem>
                                            </ListBox>
                                        </SelectPopover>
                                    </Select>
                                    <Select aria-label="Método de pago" selectedKey={filterMethod || null} onSelectionChange={(key) => setFilterMethod(key ? String(key) : "")} placeholder="Todos los métodos" className="w-52">
                                        <SelectTrigger><SelectValue /><SelectIndicator><ChevronDown className="h-4 w-4" /></SelectIndicator></SelectTrigger>
                                        <SelectPopover>
                                            <ListBox>
                                                <ListBoxItem id="" textValue="Todos los métodos">Todos los métodos</ListBoxItem>
                                                <ListBoxItem id="cash" textValue="Efectivo">Efectivo</ListBoxItem>
                                                <ListBoxItem id="nequi" textValue="Nequi">Nequi</ListBoxItem>
                                                <ListBoxItem id="daviplata" textValue="Daviplata">Daviplata</ListBoxItem>
                                                <ListBoxItem id="transfer" textValue="Bancolombia Ahorros">Bancolombia Ahorros</ListBoxItem>
                                                <ListBoxItem id="other" textValue="Otro">Otro</ListBoxItem>
                                            </ListBox>
                                        </SelectPopover>
                                    </Select>
                                    {(filterTicket || filterType || filterMethod) && (
                                        <Button variant="ghost" size="sm" onPress={() => { setFilterTicket(""); setFilterType(""); setFilterMethod(""); }}>✕ Limpiar</Button>
                                    )}
                                    <span className="text-xs text-default-500 ml-auto">{filteredPayments.length} pago(s)</span>
                                </div>

                                <div className="overflow-x-auto rounded-lg border border-default-200">
                                    <table className="w-full text-sm">
                                        <thead className="bg-default-100">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                                                <th className="px-4 py-3 text-left font-medium">Boleta</th>
                                                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                                                <th className="px-4 py-3 text-left font-medium">Método</th>
                                                <th className="px-4 py-3 text-right font-medium">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-default-200">
                                            {filteredPayments.length === 0 ? (
                                                <tr><td colSpan={5} className="px-4 py-8 text-center text-default-400 text-sm">No hay pagos que coincidan con los filtros</td></tr>
                                            ) : filteredPayments.map((payment) => (
                                                <tr key={payment.id} className="hover:bg-default-50">
                                                    <td className="px-4 py-3 text-xs text-default-500">{payment.createdAt ? formatDateTime(payment.createdAt) : "—"}</td>
                                                    <td className="px-4 py-3 font-mono font-bold">{payment.ticketId}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={payment.type === "payment" ? "text-success font-medium" : "text-amber-400"}>
                                                            {payment.type === "payment" ? "Pago completo" : "Abono"}
                                                        </span>
                                                    </td>
                                              <td className="px-4 py-3"><PaymentMethodBadge method={payment.method} /></td>
                                              <td className="px-4 py-3 text-right font-semibold text-success">{formatCurrency(payment.amount)}</td>
                                          </tr>
                                      ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                  )}
              </>
          )}
      </div>
  );
}
