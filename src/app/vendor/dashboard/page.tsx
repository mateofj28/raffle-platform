"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@heroui/react";
import { DollarSign, TrendingUp, CreditCard, Wallet, Ticket } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { formatCurrency } from "@/utils/formatters";
import { useAuthStore } from "@/store/auth.store";
import { callFunction } from "@/services/firebase-callable";

interface VendorMetrics {
    assignedCount: number;
    soldCount: number;
    paidCount: number;
    installmentCount: number;
    cancelledCount: number;
    pendingCount: number;
    moneyCollected: number;
    commissionGenerated: number;
    commissionPaid: number;
    pendingBalanceToDeliver: number;
}

export default function VendorDashboardPage() {
    const user = useAuthStore((s) => s.user);
    const [metrics, setMetrics] = useState<VendorMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.vendorId) return;
        const load = async () => {
            try {
                const data = await callFunction<VendorMetrics>("getVendorMetrics", { vendorId: user.vendorId });
                setMetrics(data);
            } catch (e) {
                console.error(e);
                // Fallback zeros
                setMetrics({
                    assignedCount: 0, soldCount: 0, paidCount: 0, installmentCount: 0,
                    cancelledCount: 0, pendingCount: 0, moneyCollected: 0,
                    commissionGenerated: 0, commissionPaid: 0, pendingBalanceToDeliver: 0,
                });
            } finally {
                setLoading(false);
            }
    };
      load();
  }, [user?.vendorId]);

    if (loading) return <div><PageHeader title="Mi Panel" /><LoadingSkeleton rows={6} /></div>;

    const m = metrics!;

    return (
        <div>
            <PageHeader title="Mi Panel" description="Resumen de tu actividad como vendedor" />

          {/* Financial metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard title="Dinero recaudado" value={formatCurrency(m.moneyCollected)} icon={<DollarSign className="h-5 w-5" />} />
              <StatCard title="Comisión ganada" value={formatCurrency(m.commissionGenerated)} icon={<TrendingUp className="h-5 w-5" />} />
              <StatCard title="Comisión pagada" value={formatCurrency(m.commissionPaid)} icon={<CreditCard className="h-5 w-5" />} />
              <StatCard title="Por entregar" value={formatCurrency(m.pendingBalanceToDeliver)} icon={<Wallet className="h-5 w-5" />} />
          </div>

          {/* Ticket stats */}
          <Card>
              <CardContent className="p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
                      <Ticket className="h-4 w-4" /> Mis Boletas
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      <MiniStat label="Asignadas" value={m.assignedCount} color="text-amber-400" />
                      <MiniStat label="Vendidas" value={m.soldCount} color="text-blue-400" />
                      <MiniStat label="Pagadas" value={m.paidCount} color="text-emerald-400" />
                      <MiniStat label="Abonadas" value={m.installmentCount} color="text-purple-400" />
                      <MiniStat label="Canceladas" value={m.cancelledCount} color="text-red-400" />
                  </div>
              </CardContent>
          </Card>
      </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="text-center p-3 rounded-lg bg-default-100/50">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-default-500 mt-1">{label}</p>
      </div>
  );
}
