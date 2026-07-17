"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/utils/formatters";
import { DollarSign, Ticket, Users, BarChart3, TrendingUp, CreditCard } from "lucide-react";
import { Button } from "@heroui/react";
import { useDashboardMetrics } from "@/features/dashboard/hooks/use-dashboard-metrics";

export default function AdminDashboardPage() {
    const { data, isLoading, isError, refetch } = useDashboardMetrics();

    if (isError || (!isLoading && !data)) {
        return (
            <div>
            <PageHeader title="Dashboard" description="Resumen general del negocio" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard title="Ventas del día" value={formatCurrency(0)} icon={<DollarSign className="h-6 w-6" />} />
                <StatCard title="Ventas del mes" value={formatCurrency(0)} icon={<TrendingUp className="h-6 w-6" />} />
                <StatCard title="Dinero recaudado" value={formatCurrency(0)} icon={<CreditCard className="h-6 w-6" />} />
                <StatCard title="Dinero pendiente" value={formatCurrency(0)} icon={<DollarSign className="h-6 w-6" />} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard title="Rifas activas" value={0} icon={<Ticket className="h-6 w-6" />} />
                <StatCard title="Boletas vendidas" value={0} icon={<BarChart3 className="h-6 w-6" />} />
                <StatCard title="Vendedores" value={0} icon={<Users className="h-6 w-6" />} />
                <StatCard title="Clientes" value={0} icon={<Users className="h-6 w-6" />} />
            </div>
            {isError && (
                <div className="text-center">
                    <p className="text-sm text-default-500 mb-2">No se pudieron cargar métricas del servidor</p>
                    <Button variant="outline" size="sm" onPress={() => refetch()}>Reintentar</Button>
                </div>
            )}
          </div>
      );
  }

    const metrics = data;

    return (
        <div>
            <PageHeader title="Dashboard" description="Resumen general del negocio" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard title="Ventas del día" value={formatCurrency(metrics?.sales?.dailySales ?? 0)} icon={<DollarSign className="h-6 w-6" />} />
              <StatCard title="Ventas del mes" value={formatCurrency(metrics?.sales?.monthlySales ?? 0)} icon={<TrendingUp className="h-6 w-6" />} />
              <StatCard title="Dinero recaudado" value={formatCurrency(metrics?.sales?.moneyCollected ?? 0)} icon={<CreditCard className="h-6 w-6" />} />
              <StatCard title="Dinero pendiente" value={formatCurrency(metrics?.sales?.moneyPending ?? 0)} icon={<DollarSign className="h-6 w-6" />} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Rifas activas" value={metrics?.raffles?.activeCount ?? 0} icon={<Ticket className="h-6 w-6" />} />
              <StatCard title="Boletas vendidas" value={(metrics?.raffles?.ticketsSold ?? 0).toLocaleString()} icon={<BarChart3 className="h-6 w-6" />} />
              <StatCard title="Vendedores" value={metrics?.people?.vendorsCount ?? 0} icon={<Users className="h-6 w-6" />} />
              <StatCard title="Clientes" value={metrics?.people?.customersCount ?? 0} icon={<Users className="h-6 w-6" />} />
          </div>
      </div>
  );
}
