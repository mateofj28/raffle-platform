"use client";

import {
    DollarSign,
    Calendar,
    Wallet,
    Clock,
    Ticket,
    BarChart3,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/utils/formatters";
import type { DashboardMetrics } from "../types/dashboard.types";

interface MetricsGridProps {
    metrics: DashboardMetrics;
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
    const items = [
        {
            title: "Ventas del Día",
            value: formatCurrency(metrics.sales.dailySales),
            icon: <DollarSign className="h-6 w-6" />,
        },
        {
            title: "Ventas del Mes",
            value: formatCurrency(metrics.sales.monthlySales),
            icon: <Calendar className="h-6 w-6" />,
        },
        {
            title: "Dinero Recaudado",
            value: formatCurrency(metrics.sales.moneyCollected),
            icon: <Wallet className="h-6 w-6" />,
        },
        {
            title: "Dinero Pendiente",
            value: formatCurrency(metrics.sales.moneyPending),
            icon: <Clock className="h-6 w-6" />,
        },
        {
            title: "Rifas Activas",
            value: metrics.raffles.activeCount,
            icon: <Ticket className="h-6 w-6" />,
        },
        {
            title: "Boletas Vendidas",
            value: metrics.raffles.ticketsSold,
            icon: <BarChart3 className="h-6 w-6" />,
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
                <StatCard
                    key={item.title}
                    title={item.title}
                    value={item.value}
                    icon={item.icon}
                />
            ))}
        </div>
    );
}
