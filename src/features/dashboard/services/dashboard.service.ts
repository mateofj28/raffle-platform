import { callFunction } from "@/services/firebase-callable";
import type { DashboardMetrics } from "@/types/api.types";

export const dashboardService = {
    getMetrics: () => callFunction<DashboardMetrics>("getDashboardMetrics"),
};
