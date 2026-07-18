"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator, Chip } from "@heroui/react";
import { ArrowLeft, User, Phone, Mail, Hash, Ticket } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, where, orderBy, doc, getDoc, collectionGroup } from "firebase/firestore";
import { tenantCollection, getDb } from "@/lib/firebase/firestore";
import type { Vendor, Ticket as TicketType } from "@/types/api.types";

// --- Sub-components following SRP ---

function VendorInfoCard({ vendor }: { vendor: Vendor }) {
    return (
        <Card className="mb-6">
            <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    <InfoItem icon={<User className="h-5 w-5 text-primary" />} label="Nombre" value={vendor.name} />
                    <InfoItem icon={<Hash className="h-5 w-5 text-warning" />} label="Documento" value={vendor.document} />
                    <InfoItem icon={<Phone className="h-5 w-5 text-success" />} label="Teléfono" value={vendor.phone} />
                    <InfoItem icon={<Mail className="h-5 w-5 text-default-500" />} label="Estado" value={vendor.status} badge />
                </div>
            </CardContent>
        </Card>
    );
}

function InfoItem({ icon, label, value, badge }: { icon: React.ReactNode; label: string; value: string; badge?: boolean }) {
    const VENDOR_STATUS: Record<string, { label: string; color: string }> = {
        active: { label: "Activo", color: "success" },
        inactive: { label: "Inactivo", color: "default" },
        suspended: { label: "Suspendido", color: "danger" },
    };

    return (
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-default-100">{icon}</div>
            <div>
                <p className="text-xs text-default-500">{label}</p>
                {badge ? (
                    <StatusBadge status={value} statusConfig={VENDOR_STATUS} />
                ) : (
                    <p className="font-semibold text-sm">{value}</p>
                )}
            </div>
        </div>
    );
}

function VendorMetricsRow({ tickets }: { tickets: TicketType[] }) {
    const assigned = tickets.filter(t => t.status === "assigned").length;
    const sold = tickets.filter(t => t.status === "sold").length;
    const paid = tickets.filter(t => t.status === "paid").length;
    const installment = tickets.filter(t => t.status === "installment").length;
    const cancelled = tickets.filter(t => t.status === "cancelled").length;
    const total = tickets.length;

    return (
        <div className="flex gap-2 flex-wrap mb-4">
            <Chip size="sm" variant="soft">Total: {total}</Chip>
            <Chip size="sm" variant="soft" color="warning">Asignadas: {assigned}</Chip>
            <Chip size="sm" variant="soft" color="accent">Vendidas: {sold}</Chip>
            <Chip size="sm" variant="soft" color="success">Pagadas: {paid}</Chip>
            <Chip size="sm" variant="soft" color="accent">Abonadas: {installment}</Chip>
            <Chip size="sm" variant="soft" color="danger">Canceladas: {cancelled}</Chip>
        </div>
    );
}

interface TicketWithCustomer extends TicketType {
    customerName?: string;
    raffleName?: string;
}

function VendorTicketsTable({ tickets }: { tickets: TicketWithCustomer[] }) {
    if (tickets.length === 0) {
        return (
            <EmptyState
                title="Sin boletas asignadas"
                description="Este vendedor aún no tiene boletas asignadas"
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
                        <th className="px-4 py-3 text-left font-medium">Rifa</th>
                        <th className="px-4 py-3 text-left font-medium">Estado</th>
                        <th className="px-4 py-3 text-left font-medium">Cliente</th>
                        <th className="px-4 py-3 text-right font-medium">Valor</th>
                        <th className="px-4 py-3 text-right font-medium">Saldo</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                    {tickets.map((ticket) => (
                        <TicketRow key={`${ticket.number}-${ticket.raffleName}`} ticket={ticket} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TicketRow({ ticket }: { ticket: TicketWithCustomer }) {
    const isPaid = ticket.pendingBalance === 0;

    return (
        <tr className="hover:bg-default-50">
            <td className="px-4 py-3 font-mono font-bold">{ticket.number}</td>
            <td className="px-4 py-3 text-default-600">{ticket.raffleName || "—"}</td>
            <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
            <td className="px-4 py-3">
                {ticket.customerName ? (
                    <span className={isPaid ? "text-success font-medium" : "text-default-600"}>
                        {ticket.customerName}
                        {isPaid && <span className="ml-1 text-xs">(Pagado ✓)</span>}
                    </span>
                ) : (
                    <span className="text-default-400 italic">Sin cliente</span>
                )}
            </td>
            <td className="px-4 py-3 text-right">{formatCurrency(ticket.value)}</td>
            <td className="px-4 py-3 text-right">
                {isPaid ? (
                    <span className="text-success font-medium">$0</span>
                ) : (
                    <span className="text-warning font-medium">{formatCurrency(ticket.pendingBalance)}</span>
                )}
            </td>
        </tr>
    );
}

// --- Main Page Component (Composition) ---

export default function VendorDetailPage() {
    const params = useParams();
    const vendorId = params.id as string;
    const tenantId = useAuthStore((s) => s.user?.tenantId);

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [tickets, setTickets] = useState<TicketWithCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketsLoading, setTicketsLoading] = useState(true);

    // Load vendor info (SRP: data fetching separated from UI)
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

    // Load vendor's tickets across all raffles
    useEffect(() => {
        if (!tenantId || !vendorId) return;
        const load = async () => {
            setTicketsLoading(true);
            try {
                const db = getDb();
                // Get all raffles to search tickets
                const rafflesSnap = await getDocs(tenantCollection(tenantId, "raffles"));
                const allTickets: TicketWithCustomer[] = [];

                // Get customers for name resolution
                const customersSnap = await getDocs(tenantCollection(tenantId, "customers"));
                const customersMap = new Map<string, string>();
                customersSnap.docs.forEach(d => {
                    customersMap.set(d.id, d.data().name);
                });

                for (const raffleDoc of rafflesSnap.docs) {
                    const raffleName = raffleDoc.data().name;
                    const ticketsCol = tenantCollection(tenantId, `raffles/${raffleDoc.id}/tickets`);
                    const q = query(ticketsCol, where("vendorId", "==", vendorId), orderBy("number", "asc"));
                    const ticketsSnap = await getDocs(q);

                    ticketsSnap.docs.forEach(d => {
                        const data = d.data() as TicketType;
                        allTickets.push({
                            ...data,
                            raffleName,
                            customerName: data.customerId ? customersMap.get(data.customerId) || data.customerId : undefined,
                        });
                    });
                }

                setTickets(allTickets);
            } catch (e) { console.error(e); }
            finally { setTicketsLoading(false); }
        };
        load();
    }, [tenantId, vendorId]);

    if (loading) {
        return <div><PageHeader title="Detalle del Vendedor" /><LoadingSkeleton rows={6} /></div>;
    }

    if (!vendor) {
        return <div><PageHeader title="Vendedor no encontrado" /><p className="text-default-500">No se encontró el vendedor.</p></div>;
    }

    return (
        <div>
          <PageHeader
              title={vendor.name}
              description="Información del vendedor y sus boletas"
              actions={
                  <Link href="/vendors">
                      <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button>
                  </Link>
              }
          />

          <VendorInfoCard vendor={vendor} />

          <Separator className="my-6" />

          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Ticket className="h-5 w-5" /> Boletas asignadas
          </h2>

          {ticketsLoading ? (
              <LoadingSkeleton rows={5} />
          ) : (
              <>
                  <VendorMetricsRow tickets={tickets} />
                  <VendorTicketsTable tickets={tickets} />
              </>
          )}
      </div>
  );
}
