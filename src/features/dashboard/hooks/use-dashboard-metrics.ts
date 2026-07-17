"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "../services/dashboard.service";

export function useDashboardMetrics() {
    return useQuery({
        queryKey: ["dashboard-metrics"],
        queryFn: () => dashboardService.getMetrics(),
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
      // Don't hang forever - fail fast
      gcTime: 10 * 60 * 1000,
  });
}
