"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "../services/dashboard.service";

export function useDashboardMetrics() {
    return useQuery({
        queryKey: ["dashboard-metrics"],
        queryFn: () => dashboardService.getMetrics(),
        refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    });
}
