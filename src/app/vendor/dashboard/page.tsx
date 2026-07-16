"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DollarSign, TrendingUp, CreditCard, Wallet } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";

export default function VendorDashboardPage() {
    // Placeholder data — will be connected to getVendorMetrics
    const metrics = {
        moneyCollected: 0,
        commissionGenerated: 0,
        commissionPaid: 0,
        pendingBalanceToDeliver: 0,
    };

    return (
        <div>
            <PageHeader title="Mi Panel" description="Resumen de tu actividad como vendedor" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Dinero recaudado" value={formatCurrency(metrics.moneyCollected)} icon={<DollarSign className="h-6 w-6" />} />
                <StatCard title="Comisión generada" value={formatCurrency(metrics.commissionGenerated)} icon={<TrendingUp className="h-6 w-6" />} />
                <StatCard title="Comisión pagada" value={formatCurrency(metrics.commissionPaid)} icon={<CreditCard className="h-6 w-6" />} />
                <StatCard title="Saldo por entregar" value={formatCurrency(metrics.pendingBalanceToDeliver)} icon={<Wallet className="h-6 w-6" />} />
            </div>
        </div>
    );
}
