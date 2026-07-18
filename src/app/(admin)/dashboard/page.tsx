"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Separator } from "@heroui/react";
import { DollarSign, Ticket, Users, TrendingUp, CreditCard, BarChart3, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/utils/formatters";
import { useRaffleStore } from "@/store/raffle.store";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";

interface RaffleMetrics {
    totalTickets: number;
    available: number;
    assigned: number;
    sold: number;
    paid: number;
    installment: number;
    cancelled: number;
    totalCollected: number;
    totalPending: number;
    vendorsCount: number;
    customersCount: number;
}

export default function AdminDashboardPage() {
    const router = useRouter();
    const { activeRaffle } = useRaffleStore();
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const [metrics, setMetrics] = useState<RaffleMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    // Redirect to raffle selection if none is active
    useEffect(() => {
        if (!activeRaffle) {
            router.push("/raffles");
        }
    }, [activeRaffle, router]);

    // Load metrics for the active raffle
    useEffect(() => {
        if (!tenantId || !activeRaffle) return;
        const load = async () => {
            setLoading(true);
            try {
                const ticketsCol = tenantCollection(tenantId, `raffles/${activeRaffle.id}/tickets`);
                const ticketsSnap = await getDocs(query(ticketsCol, orderBy("number", "asc")));

                let available = 0, assigned = 0, sold = 0, paid = 0, installment = 0, cancelled = 0;
                let totalCollected = 0, totalPending = 0;
                const vendorIds = new Set<string>();
                const customerIds = new Set<string>();

                ticketsSnap.docs.forEach(d => {
                    const t = d.data();
                    switch (t.status) {
                        case "available": available++; break;
                        case "assigned": assigned++; break;
                        case "sold": sold++; break;
                        case "paid": paid++; break;
                        case "installment": installment++; break;
                        case "cancelled": cancelled++; break;
                    }
                    if (t.vendorId) vendorIds.add(t.vendorId);
                    if (t.customerId) customerIds.add(t.customerId);
                    totalCollected += (t.value - t.pendingBalance);
                    totalPending += t.pendingBalance;
                });

                setMetrics({
                    totalTickets: ticketsSnap.size,
                    available, assigned, sold, paid, installment, cancelled,
                    totalCollected, totalPending,
                    vendorsCount: vendorIds.size,
                    customersCount: customerIds.size,
                });
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [tenantId, activeRaffle]);

    if (!activeRaffle) return null;

    return (
        <div>
          <PageHeader
              title={activeRaffle.name}
              description="Panel de administración de esta rifa"
              actions={
                  <Link href="/raffles">
                      <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Cambiar Rifa</Button>
                  </Link>
              }
          />

          {/* Raffle status */}
          <div className="flex items-center gap-3 mb-6">
              <StatusBadge status={activeRaffle.status} />
              <span className="text-sm text-default-500">
                  {activeRaffle.totalTickets.toLocaleString()} boletas × {formatCurrency(activeRaffle.ticketPrice)}
              </span>
          </div>

          {loading ? (
              <LoadingSkeleton rows={6} />
          ) : metrics ? (
              <>
                  {/* Financial metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <StatCard title="Dinero recaudado" value={formatCurrency(metrics.totalCollected)} icon={<DollarSign className="h-6 w-6" />} />
                      <StatCard title="Dinero pendiente" value={formatCurrency(metrics.totalPending)} icon={<CreditCard className="h-6 w-6" />} />
                      <StatCard title="Vendedores activos" value={metrics.vendorsCount} icon={<Users className="h-6 w-6" />} />
                      <StatCard title="Clientes" value={metrics.customersCount} icon={<Users className="h-6 w-6" />} />
                  </div>

                  {/* Ticket metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                      <MiniStat label="Disponibles" value={metrics.available} color="text-default-600" />
                      <MiniStat label="Asignadas" value={metrics.assigned} color="text-amber-400" />
                      <MiniStat label="Vendidas" value={metrics.sold} color="text-blue-400" />
                      <MiniStat label="Pagadas" value={metrics.paid} color="text-emerald-400" />
                      <MiniStat label="Abonadas" value={metrics.installment} color="text-purple-400" />
                      <MiniStat label="Canceladas" value={metrics.cancelled} color="text-red-400" />
                  </div>

                      {/* Progress */}
                      <Card>
                          <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">Progreso de venta</span>
                                  <span className="text-sm text-default-500">
                                      {metrics.sold + metrics.paid + metrics.installment} / {metrics.totalTickets} vendidas
                                  </span>
                              </div>
                              <div className="w-full h-3 bg-default-100 rounded-full overflow-hidden">
                                  <div
                                      className="h-full bg-primary rounded-full transition-all"
                                      style={{ width: `${((metrics.sold + metrics.paid + metrics.installment) / metrics.totalTickets) * 100}%` }}
                                  />
                              </div>
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
      <Card>
          <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-default-500">{label}</p>
          </CardContent>
      </Card>
  );
}
