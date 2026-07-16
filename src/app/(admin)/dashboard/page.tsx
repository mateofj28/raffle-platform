"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useDashboardMetrics } from "@/features/dashboard/hooks/use-dashboard-metrics";
import { formatCurrency } from "@/utils/formatters";
import { DollarSign, Ticket, Users, BarChart3, TrendingUp, CreditCard } from "lucide-react";
import { Button } from "@heroui/react";

export default function AdminDashboardPage() {
    const { data, isLoading, isError, refetch } = useDashboardMetrics();

    if (isLoading) {
        return (
            <div>
                <PageHeader title="Dashboard" />
                <LoadingSkeleton rows={8} />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div>
                <PageHeader title="Dashboard" />
                <div className="text-center py-12">
                    <p className="text-default-500 mb-4">No se pudieron cargar las métricas</p>
                    <Button variant="outline" onPress={() => refetch()}>Reintentar</Button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <PageHeader title="Dashboard" description="Resumen general del negocio" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard title="Ventas del día" value={formatCurrency(data.sales.dailySales)} icon={<DollarSign className="h-6 w-6" />} />
                <StatCard title="Ventas del mes" value={formatCurrency(data.sales.monthlySales)} icon={<TrendingUp className="h-6 w-6" />} />
                <StatCard title="Dinero recaudado" value={formatCurrency(data.sales.moneyCollected)} icon={<CreditCard className="h-6 w-6" />} />
                <StatCard title="Dinero pendiente" value={formatCurrency(data.sales.moneyPending)} icon={<DollarSign className="h-6 w-6" />} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard title="Rifas activas" value={data.raffles.activeCount} icon={<Ticket className="h-6 w-6" />} />
                <StatCard title="Rifas finalizadas" value={data.raffles.finishedCount} icon={<Ticket className="h-6 w-6" />} />
                <StatCard title="Boletas vendidas" value={data.raffles.ticketsSold.toLocaleString()} icon={<BarChart3 className="h-6 w-6" />} />
                <StatCard title="Boletas disponibles" value={data.raffles.ticketsAvailable.toLocaleString()} icon={<BarChart3 className="h-6 w-6" />} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Vendedores" value={data.people.vendorsCount} icon={<Users className="h-6 w-6" />} />
                <StatCard title="Clientes" value={data.people.customersCount} icon={<Users className="h-6 w-6" />} />
                <StatCard title="Ganancia total" value={formatCurrency(data.financial.totalProfit)} icon={<TrendingUp className="h-6 w-6" />} />
            </div>
        </div>
    );
}
