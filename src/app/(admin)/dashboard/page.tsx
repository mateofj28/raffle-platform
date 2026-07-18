"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent } from "@heroui/react";
import { DollarSign, Users, CreditCard, ArrowLeft, TrendingUp, Percent } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/utils/formatters";
import { useRaffleStore } from "@/store/raffle.store";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, orderBy } from "firebase/firestore";
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
    totalPotential: number;
    vendorsCount: number;
    customersCount: number;
    commissionGenerated: number;
    companyProfit: number;
}

export default function AdminDashboardPage() {
    const router = useRouter();
    const { activeRaffle } = useRaffleStore();
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const [metrics, setMetrics] = useState<RaffleMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (!activeRaffle) { router.push("/raffles"); }
  }, [activeRaffle, router]);

    useEffect(() => {
        if (!tenantId || !activeRaffle) return;
        const load = async () => {
            setLoading(true);
            try {
          // Load all tickets for this raffle
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

          const totalPotential = activeRaffle.totalTickets * activeRaffle.ticketPrice;
          const commissionGenerated = Math.floor(totalCollected * 0.30);
          const companyProfit = totalCollected - commissionGenerated;

          setMetrics({
              totalTickets: ticketsSnap.size,
              available, assigned, sold, paid, installment, cancelled,
            totalCollected, totalPending, totalPotential,
            vendorsCount: vendorIds.size,
            customersCount: customerIds.size,
            commissionGenerated, companyProfit,
        });
          } catch (e) { console.error(e); }
          finally { setLoading(false); }
      };
      load();
  }, [tenantId, activeRaffle]);

    if (!activeRaffle) return null;

    const soldTotal = metrics ? metrics.sold + metrics.paid + metrics.installment : 0;
    const progressPercent = metrics ? Math.round((soldTotal / metrics.totalTickets) * 100) : 0;

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

          <div className="flex flex-wrap items-center gap-3 mb-6">
              <StatusBadge status={activeRaffle.status} />
              <span className="text-sm text-default-500">
                  {activeRaffle.totalTickets.toLocaleString()} boletas × {formatCurrency(activeRaffle.ticketPrice)}
              </span>
          </div>

          {loading ? (
              <LoadingSkeleton rows={8} />
          ) : metrics ? (
                  <div className="space-y-6">
                      {/* Row 1: Financial */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                          <StatCard title="Recaudado" value={formatCurrency(metrics.totalCollected)} icon={<DollarSign className="h-5 w-5" />} />
                          <StatCard title="Pendiente por cobrar" value={formatCurrency(metrics.totalPending)} icon={<CreditCard className="h-5 w-5" />} />
                          <StatCard title="Ganancia empresa" value={formatCurrency(metrics.companyProfit)} icon={<TrendingUp className="h-5 w-5" />} />
                          <StatCard title="Comisión vendedores" value={formatCurrency(metrics.commissionGenerated)} icon={<Percent className="h-5 w-5" />} />
                      </div>

                      {/* Row 2: People */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <StatCard title="Vendedores" value={metrics.vendorsCount} icon={<Users className="h-5 w-5" />} />
                          <StatCard title="Clientes" value={metrics.customersCount} icon={<Users className="h-5 w-5" />} />
                          <StatCard title="Potencial total" value={formatCurrency(metrics.totalPotential)} icon={<DollarSign className="h-5 w-5" />} />
                          <StatCard title="% Vendido" value={`${progressPercent}%`} icon={<TrendingUp className="h-5 w-5" />} />
                      </div>

                      {/* Row 3: Ticket status grid */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                          <MiniStat label="Disponibles" value={metrics.available} color="text-zinc-400" />
                          <MiniStat label="Asignadas" value={metrics.assigned} color="text-amber-400" />
                          <MiniStat label="Vendidas" value={metrics.sold} color="text-blue-400" />
                          <MiniStat label="Pagadas" value={metrics.paid} color="text-emerald-400" />
                          <MiniStat label="Abonadas" value={metrics.installment} color="text-purple-400" />
                          <MiniStat label="Canceladas" value={metrics.cancelled} color="text-red-400" />
                      </div>

                      {/* Row 4: Progress bar */}
                      <Card>
                          <CardContent className="p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                  <span className="text-sm font-medium">Progreso de venta</span>
                                  <span className="text-sm text-default-500">
                                      {soldTotal} de {metrics.totalTickets} boletas vendidas ({progressPercent}%)
                                  </span>
                              </div>
                              <div className="w-full h-4 bg-default-100 rounded-full overflow-hidden">
                                  <div
                                      className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
                                      style={{ width: `${progressPercent}%` }}
                                  />
                              </div>
                          </CardContent>
                      </Card>
              </div>
          ) : null}
      </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <Card>
            <CardContent className="p-3 text-center">
              <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] sm:text-xs text-default-500 mt-1">{label}</p>
          </CardContent>
      </Card>
  );
}
