"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator, Chip } from "@heroui/react";
import { ArrowLeft, User, Phone, MapPin, Hash, Ticket, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
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
                // Tickets across raffles
                const rafflesSnap = await getDocs(tenantCollection(tenantId, "raffles"));
                const allTickets: TicketWithRaffle[] = [];

                for (const raffleDoc of rafflesSnap.docs) {
                    const raffleName = raffleDoc.data().name;
                    const ticketsCol = tenantCollection(tenantId, `raffles/${raffleDoc.id}/tickets`);
                    const q = query(ticketsCol, where("customerId", "==", customerId));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => {
                        allTickets.push({ ...d.data() as TicketType, raffleName });
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

    return (
        <div>
          <PageHeader
              title={customer.name}
              description="Historial del cliente"
              actions={
                  <Link href="/customers">
                      <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button>
                  </Link>
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
              <Chip size="sm" variant="soft" color="success">Pagado: {formatCurrency(totalPaid)}</Chip>
              <Chip size="sm" variant="soft" color="warning">Pendiente: {formatCurrency(totalPending)}</Chip>
              <Chip size="sm" variant="soft">Boletas: {tickets.length}</Chip>
              <Chip size="sm" variant="soft">Pagos: {payments.length}</Chip>
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
                                      <th className="px-4 py-3 text-left font-medium">Rifa</th>
                                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                                      <th className="px-4 py-3 text-right font-medium">Valor</th>
                                      <th className="px-4 py-3 text-right font-medium">Saldo</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-default-200">
                                  {tickets.map((ticket, i) => (
                                      <tr key={`${ticket.number}-${i}`} className="hover:bg-default-50">
                                          <td className="px-4 py-3 font-mono font-bold">{ticket.number}</td>
                                          <td className="px-4 py-3 text-default-600">{ticket.raffleName || "—"}</td>
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
                  )}

                  {/* Payments */}
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5" /> Historial de pagos
                  </h2>

                  {payments.length === 0 ? (
                      <EmptyState title="Sin pagos" description="Este cliente no ha realizado pagos" icon={<CreditCard className="h-10 w-10" />} />
                  ) : (
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
                                  {payments.map((payment) => (
                                      <tr key={payment.id} className="hover:bg-default-50">
                                          <td className="px-4 py-3 text-xs text-default-500">{payment.createdAt ? formatDateTime(payment.createdAt) : "—"}</td>
                                          <td className="px-4 py-3 font-mono font-bold">{payment.ticketId}</td>
                                          <td className="px-4 py-3">
                                              <span className={payment.type === "payment" ? "text-success font-medium" : "text-amber-400"}>
                                                  {payment.type === "payment" ? "Pago completo" : "Abono"}
                                              </span>
                                          </td>
                                          <td className="px-4 py-3 text-default-600">
                                              {{ cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", nequi: "Nequi", daviplata: "Daviplata", other: "Otro" }[payment.method] || payment.method}
                                          </td>
                                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  )}
              </>
          )}
      </div>
  );
}
