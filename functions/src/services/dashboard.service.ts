/**
 * Dashboard Service - Cloud Functions for admin dashboard metrics.
 *
 * Provides:
 * - getDashboardMetrics: Returns pre-aggregated metrics for the tenant
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth";
import { handleError } from "../utils/errors";
import { getDb } from "../utils/firestore";
import type {
    SalesMetrics,
    RaffleMetrics,
    PeopleMetrics,
    FinancialMetrics,
} from "../types/index";

// --- Default values ---

const DEFAULT_SALES_METRICS: SalesMetrics = {
    dailySales: 0,
    monthlySales: 0,
    moneyCollected: 0,
    moneyPending: 0,
    lastUpdated: "",
};

const DEFAULT_RAFFLE_METRICS: RaffleMetrics = {
    activeCount: 0,
    finishedCount: 0,
    ticketsSold: 0,
    ticketsAvailable: 0,
    ticketsCancelled: 0,
    lastUpdated: "",
};

const DEFAULT_PEOPLE_METRICS: PeopleMetrics = {
    vendorsCount: 0,
    customersCount: 0,
    topVendors: [],
    topRaffles: [],
    topCustomers: [],
    lastUpdated: "",
};

const DEFAULT_FINANCIAL_METRICS: FinancialMetrics = {
    commissionsPaid: 0,
    commissionsPending: 0,
    totalProfit: 0,
    profitByRaffle: [],
    dailyIncome: 0,
    monthlyIncome: 0,
    lastUpdated: "",
};

// --- Callable Functions ---

/**
 * Returns pre-aggregated dashboard metrics for the authenticated tenant.
 * Admin-only. No input required.
 */
export const getDashboardMetrics = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const db = getDb();
            const metricsPath = `tenants/${context.tenantId}/metrics`;

            const [salesSnap, rafflesSnap, peopleSnap, financialSnap] =
                await Promise.all([
                    db.doc(`${metricsPath}/sales`).get(),
                    db.doc(`${metricsPath}/raffles`).get(),
                    db.doc(`${metricsPath}/people`).get(),
                    db.doc(`${metricsPath}/financial`).get(),
                ]);

            const sales: SalesMetrics = salesSnap.exists
                ? (salesSnap.data() as SalesMetrics)
                : DEFAULT_SALES_METRICS;

            const raffles: RaffleMetrics = rafflesSnap.exists
                ? (rafflesSnap.data() as RaffleMetrics)
                : DEFAULT_RAFFLE_METRICS;

            const people: PeopleMetrics = peopleSnap.exists
                ? (peopleSnap.data() as PeopleMetrics)
                : DEFAULT_PEOPLE_METRICS;

            const financial: FinancialMetrics = financialSnap.exists
                ? (financialSnap.data() as FinancialMetrics)
                : DEFAULT_FINANCIAL_METRICS;

            return { sales, raffles, people, financial };
        } catch (error) {
            handleError(error);
        }
    }
);
