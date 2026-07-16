/**
 * Metrics Scheduled Function - Aggregates dashboard metrics every 5 minutes.
 *
 * For each tenant, computes:
 * - Sales metrics (daily/monthly sales, collected/pending money)
 * - Raffle metrics (active/finished counts, ticket statuses)
 * - People metrics (vendor/customer counts, top performers)
 * - Financial metrics (commissions paid/pending, profit, income)
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../utils/firestore.js";

/**
 * Aggregates metrics for all tenants. Runs every 5 minutes.
 */
export const aggregateMetrics = onSchedule("every 5 minutes", async () => {
    const db = getDb();

    // Get all tenant documents
    const tenantsSnap = await db.collection("tenants").get();

    for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;

        try {
            await aggregateTenantMetrics(tenantId);
        } catch (error) {
            console.error(
                `[MetricsScheduled] Failed to aggregate metrics for tenant ${tenantId}:`,
                error
            );
        }
    }
});

/**
 * Aggregates all metrics for a single tenant.
 */
async function aggregateTenantMetrics(tenantId: string): Promise<void> {
    const db = getDb();
    const tenantPath = `tenants/${tenantId}`;

    // --- Raffle Metrics ---
    const rafflesSnap = await db.collection(`${tenantPath}/raffles`).get();

    let activeCount = 0;
    let finishedCount = 0;
    let ticketsSold = 0;
    let ticketsAvailable = 0;
    let ticketsCancelled = 0;

    const raffleNames: Map<string, string> = new Map();

    for (const raffleDoc of rafflesSnap.docs) {
        const raffle = raffleDoc.data();
        raffleNames.set(raffleDoc.id, raffle.name || "");

        if (raffle.status === "active") activeCount++;
        if (raffle.status === "finished") finishedCount++;

        // Count tickets for active and finished raffles
        if (raffle.status === "active" || raffle.status === "finished") {
            const ticketsSnap = await db
                .collection(`${tenantPath}/raffles/${raffleDoc.id}/tickets`)
                .get();

            for (const ticketDoc of ticketsSnap.docs) {
                const ticket = ticketDoc.data();
                if (ticket.status === "sold" || ticket.status === "paid" || ticket.status === "winner") {
                    ticketsSold++;
                } else if (ticket.status === "available") {
                    ticketsAvailable++;
                } else if (ticket.status === "cancelled") {
                    ticketsCancelled++;
                }
            }
        }
    }

    await db.doc(`${tenantPath}/metrics/raffles`).set({
        activeCount,
        finishedCount,
        ticketsSold,
        ticketsAvailable,
        ticketsCancelled,
        lastUpdated: FieldValue.serverTimestamp(),
    });

    // --- Sales Metrics ---
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const paymentsSnap = await db.collection(`${tenantPath}/payments`).get();

    let dailySales = 0;
    let monthlySales = 0;
    let moneyCollected = 0;
    let moneyPending = 0;

    for (const paymentDoc of paymentsSnap.docs) {
        const payment = paymentDoc.data();
        const paymentDate = payment.date || payment.createdAt || "";

        moneyCollected += payment.amount || 0;

        if (paymentDate >= todayStart) {
            dailySales += payment.amount || 0;
        }
        if (paymentDate >= monthStart) {
            monthlySales += payment.amount || 0;
        }
    }

    // Calculate pending money from tickets with pendingBalance > 0
    for (const raffleDoc of rafflesSnap.docs) {
        const raffle = raffleDoc.data();
        if (raffle.status === "active" || raffle.status === "finished") {
            const ticketsSnap = await db
                .collection(`${tenantPath}/raffles/${raffleDoc.id}/tickets`)
                .where("pendingBalance", ">", 0)
                .get();

            for (const ticketDoc of ticketsSnap.docs) {
                const ticket = ticketDoc.data();
                moneyPending += ticket.pendingBalance || 0;
            }
        }
    }

    await db.doc(`${tenantPath}/metrics/sales`).set({
        dailySales,
        monthlySales,
        moneyCollected,
        moneyPending,
        lastUpdated: FieldValue.serverTimestamp(),
    });

    // --- People Metrics ---
    const vendorsSnap = await db.collection(`${tenantPath}/vendors`).get();
    const customersSnap = await db.collection(`${tenantPath}/customers`).get();

    const vendorsCount = vendorsSnap.size;
    const customersCount = customersSnap.size;

    // Top 5 vendors by tickets sold (count tickets with vendorId)
    const vendorSalesMap: Map<string, { name: string; count: number }> = new Map();
    for (const vendorDoc of vendorsSnap.docs) {
        vendorSalesMap.set(vendorDoc.id, {
            name: vendorDoc.data().name || "",
            count: 0,
        });
    }

    // Top raffles by revenue
    const raffleRevenueMap: Map<string, { name: string; revenue: number }> = new Map();

    // Top customers by purchases
    const customerPurchaseMap: Map<string, { name: string; purchases: number }> = new Map();
    for (const customerDoc of customersSnap.docs) {
        customerPurchaseMap.set(customerDoc.id, {
            name: customerDoc.data().name || "",
            purchases: 0,
        });
    }

    // Iterate through payments to build top lists
    for (const paymentDoc of paymentsSnap.docs) {
        const payment = paymentDoc.data();

        // Vendor sales count
        if (payment.vendorId && vendorSalesMap.has(payment.vendorId)) {
            const vendor = vendorSalesMap.get(payment.vendorId)!;
            vendor.count++;
        }

        // Raffle revenue
        if (payment.raffleId) {
            const existing = raffleRevenueMap.get(payment.raffleId);
            if (existing) {
                existing.revenue += payment.amount || 0;
            } else {
                raffleRevenueMap.set(payment.raffleId, {
                    name: raffleNames.get(payment.raffleId) || "",
                    revenue: payment.amount || 0,
                });
            }
        }

        // Customer purchases
        if (payment.customerId && customerPurchaseMap.has(payment.customerId)) {
            const customer = customerPurchaseMap.get(payment.customerId)!;
            customer.purchases++;
        }
    }

    const topVendors = [...vendorSalesMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([id, data]) => ({ id, name: data.name, salesCount: data.count }));

    const topRaffles = [...raffleRevenueMap.entries()]
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(([raffleId, data]) => ({ id: raffleId, name: data.name, revenue: data.revenue }));

    const topCustomers = [...customerPurchaseMap.entries()]
        .sort((a, b) => b[1].purchases - a[1].purchases)
        .slice(0, 5)
        .map(([id, data]) => ({ id, name: data.name, purchases: data.purchases }));

    await db.doc(`${tenantPath}/metrics/people`).set({
        vendorsCount,
        customersCount,
        topVendors,
        topRaffles,
        topCustomers,
        lastUpdated: FieldValue.serverTimestamp(),
    });

    // --- Financial Metrics ---
    const commissionsSnap = await db.collection(`${tenantPath}/commissions`).get();

    let commissionsPaid = 0;
    let commissionsPending = 0;
    let totalProfit = 0;

    const profitByRaffleMap: Map<string, { name: string; profit: number }> = new Map();

    for (const commissionDoc of commissionsSnap.docs) {
        const commission = commissionDoc.data();

        if (commission.status === "paid") {
            commissionsPaid += commission.commissionAmount || 0;
        } else if (commission.status === "generated") {
            commissionsPending += commission.commissionAmount || 0;
        }

        if (commission.status !== "reversed") {
            totalProfit += commission.companyProfit || 0;

            if (commission.raffleId) {
                const existing = profitByRaffleMap.get(commission.raffleId);
                if (existing) {
                    existing.profit += commission.companyProfit || 0;
                } else {
                    profitByRaffleMap.set(commission.raffleId, {
                        name: raffleNames.get(commission.raffleId) || "",
                        profit: commission.companyProfit || 0,
                    });
                }
            }
        }
    }

    // Daily and monthly income from payments
    const dailyIncome = dailySales;
    const monthlyIncome = monthlySales;

    await db.doc(`${tenantPath}/metrics/financial`).set({
        commissionsPaid,
        commissionsPending,
        totalProfit,
        profitByRaffle: [...profitByRaffleMap.entries()]
            .sort((a, b) => b[1].profit - a[1].profit)
            .map(([raffleId, data]) => ({ raffleId, name: data.name, profit: data.profit })),
        dailyIncome,
        monthlyIncome,
        lastUpdated: FieldValue.serverTimestamp(),
    });
}
