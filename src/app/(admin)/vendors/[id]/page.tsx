"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator, Chip } from "@heroui/react";
import { ArrowLeft, User, Phone, Hash, Ticket } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import { getDocs, query, where, orderBy, doc, getDoc } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import type { Vendor, Ticket as TicketType } from "@/types/api.types";

// --- Sub-components (SRP) ---

function VendorInfoCard({ vendor }: { vendor: Vendor }) {
    const VENDOR_STATUS: Record<string, { label: string; color: string }> = {
        active: { label: "Activo", color: "success" },
        inactive: { label: "Inactivo", color: "default" },
        suspended: { label: "Suspendido", color: "danger" },
    };

    return (
      <Card className="mb-6">
          <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
  );
}

function TicketMetricsRow({ tickets }: { tickets: TicketWithCustomer[] }) {
    const assigned = tickets.filter(t => t.status === "assigned").length;
    const sold = tickets.filter(t => t.status === "sold").length;
    const paid = tickets.filter(t => t.status === "paid").length;
    const installment = tickets.filter(t => t.status === "installment").length;

    return (
        <div className="flex gap-2 flex-wrap mb-4">
          <Chip size="sm" variant="soft">Total: {tickets.length}</Chip>
          <Chip size="sm" variant="soft" color="warning">Asignadas: {assigned}</Chip>
          <Chip size="sm" variant="soft" color="accent">Vendidas: {sold}</Chip>
          <Chip size="sm" variant="soft" color="success">Pagadas: {paid}</Chip>
          <Chip size="sm" variant="soft" color="accent">Abonadas: {installment}</Chip>
      </div>
  );
}

interface TicketWithCustomer extends TicketType {
    customerName?: string;
}

function TicketsTable({ tickets }: { tickets: TicketWithCustomer[] }) {
    if (tickets.length === 0) {
        return (
            <EmptyState
              title="Sin boletas en esta rifa"
              description="Este vendedor no tiene boletas asignadas en esta rifa"
              icon={<Ticket className="h-12 w-12" />}
          />
      );
  }

    return (
        <div className="overflow-x-auto rounded-lg border border-default-200">
            <table className="w-full text-sm">
                <thead className="bg-default-100">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">#</th>
                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                      <th className="px-4 py-3 text-left font-medium">Cliente</th>
                      <th className="px-4 py-3 text-right font-medium">Valor</th>
                      <th className="px-4 py-3 text-right font-medium">Saldo</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-default-200">
                  {tickets.map((ticket) => (
              <tr key={ticket.number} className="hover:bg-default-50">
                  <td className="px-4 py-3 font-mono font-bold">{ticket.number}</td>
                  <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                  <td className="px-4 py-3">
                {ticket.customerName ? (
                          <span className={ticket.pendingBalance === 0 ? "text-success font-medium" : "text-default-600"}>
                              {ticket.customerName}
                              {ticket.pendingBalance === 0 && <span className="ml-1 text-xs">(Pagado ✓)</span>}
                          </span>
                ) : (
                              <span className="text-default-400 italic">Sin cliente</span>
                )}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(ticket.value)}</td>
                  <td className="px-4 py-3 text-right">
                      {ticket.pendingBalance === 0 ? (
                          <span className="text-success font-medium">$0</span>
                ) : (
                              <span className="text-warning font-medium">{formatCurrency(ticket.pendingBalance)}</span>
                )}
                  </td>
              </tr>
          ))}
              </tbody>
          </table>
      </div>
  );
}

// --- Main Page (Composition) ---

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

    // Redirect if no active raffle
    useEffect(() => {
        if (!activeRaffle) router.push("/raffles");
    }, [activeRaffle, router]);

    // Load vendor info
    useEffect(() => {
        if (!tenantId || !vendorId) return;
        const load = async () => {
            try {
                const vendorDoc = await getDoc(doc(getDb(), "tenants", tenantId, "vendors", vendorId));
                if (vendorDoc.exists()) {
                    setVendor({ id: vendorDoc.id, ...vendorDoc.data() } as Vendor);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [tenantId, vendorId]);

    // Load tickets for this vendor IN THE ACTIVE RAFFLE only
    useEffect(() => {
      if (!tenantId || !vendorId || !activeRaffle) return;
      const load = async () => {
          setTicketsLoading(true);
          try {
          // Get customers for name resolution
          const customersSnap = await getDocs(tenantCollection(tenantId, "customers"));
          const customersMap = new Map<string, string>();
          customersSnap.docs.forEach(d => customersMap.set(d.id, d.data().name));

          // Query tickets in the active raffle for this vendor
          const ticketsCol = tenantCollection(tenantId, `raffles/${activeRaffle.id}/tickets`);
          const q = query(ticketsCol, where("vendorId", "==", vendorId), orderBy("number", "asc"));
          const ticketsSnap = await getDocs(q);

          const vendorTickets: TicketWithCustomer[] = ticketsSnap.docs.map(d => {
              const data = d.data() as TicketType;
            return {
                ...data,
              customerName: data.customerId ? customersMap.get(data.customerId) || data.customerId : undefined,
          };
        });

              setTickets(vendorTickets);
          } catch (e) { console.error(e); }
          finally { setTicketsLoading(false); }
      };
      load();
  }, [tenantId, vendorId, activeRaffle]);

    if (!activeRaffle) return null;

    if (loading) {
        return <div><PageHeader title="Detalle del Vendedor" /><LoadingSkeleton rows={6} /></div>;
    }

    if (!vendor) {
      return <div><PageHeader title="Vendedor no encontrado" /></div>;
  }

    return (
        <div>
            <PageHeader
                title={vendor.name}
              description={`Boletas en "${activeRaffle.name}"`}
              actions={
                  <Link href="/vendors">
                      <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button>
                  </Link>
              }
          />

          <VendorInfoCard vendor={vendor} />

          <Separator className="my-6" />

          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Ticket className="h-5 w-5" /> Boletas en esta rifa
          </h2>

          {ticketsLoading ? (
              <LoadingSkeleton rows={5} />
          ) : (
              <>
                  <TicketMetricsRow tickets={tickets} />
                  <TicketsTable tickets={tickets} />
              </>
          )}
      </div>
  );
}
