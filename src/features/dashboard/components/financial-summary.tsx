"use client";

import { Card, CardContent } from "@heroui/react";
import { TrendingUp, HandCoins, Clock } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import type { DashboardMetrics } from "../types/dashboard.types";

interface FinancialSummaryProps {
    financial: DashboardMetrics["financial"];
}

export function FinancialSummary({ financial }: FinancialSummaryProps) {
    const items = [
        {
            label: "Ganancia Total",
            value: formatCurrency(financial.totalProfit),
            icon: <TrendingUp className="h-5 w-5 text-success" />,
        },
        {
            label: "Comisiones Pagadas",
            value: formatCurrency(financial.commissionsPaid),
            icon: <HandCoins className="h-5 w-5 text-primary" />,
        },
        {
            label: "Comisiones Pendientes",
            value: formatCurrency(financial.commissionsPending),
            icon: <Clock className="h-5 w-5 text-warning" />,
        },
    ];

    return (
        <Card>
            <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Resumen Financiero</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {items.map((item) => (
                        <div key={item.label} className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-default-100">
                                {item.icon}
                            </div>
                            <div>
                                <p className="text-sm text-default-500">{item.label}</p>
                                <p className="text-lg font-bold">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
