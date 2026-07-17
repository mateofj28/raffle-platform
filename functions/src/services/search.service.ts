/**
 * Search Service - Global search across all entity types.
 *
 * Provides:
 * - globalSearch: Searches customers, vendors, raffles, and tickets in parallel
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth";
import { validateData } from "../middleware/validation";
import { handleError } from "../utils/errors";
import { tenantCollection } from "../utils/firestore";

// --- Schema ---

const globalSearchSchema = z.object({
    query: z.string().min(2),
    filters: z.object({
        status: z.string().optional(),
        vendorId: z.string().optional(),
        customerId: z.string().optional(),
        city: z.string().optional(),
        lottery: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        raffleId: z.string().optional(),
    }).optional(),
});

// --- Helper Types ---

interface SearchResultItem {
    id: string;
    type: string;
    primaryText: string;
    secondaryText: string;
    status: string;
}

// --- Callable Function ---

/**
 * Global search across customers, vendors, raffles, and tickets.
 * Admin-only.
 */
export const globalSearch = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(globalSearchSchema, request.data);
            const { query, filters } = data;

            // Prefix matching bounds
            const endStr = query.slice(0, -1) +
                String.fromCharCode(query.charCodeAt(query.length - 1) + 1);

            const [customers, vendors, raffles, tickets] = await Promise.all([
                searchCustomers(context.tenantId, query, endStr, filters),
                searchVendors(context.tenantId, query, endStr, filters),
                searchRaffles(context.tenantId, query, endStr, filters),
                searchTickets(context.tenantId, query, filters),
            ]);

            return { customers, vendors, raffles, tickets };
        } catch (error) {
            handleError(error);
        }
    }
);

// --- Search Helpers ---

async function searchCustomers(
    tenantId: string,
    query: string,
    endStr: string,
    filters?: z.infer<typeof globalSearchSchema>["filters"]
): Promise<SearchResultItem[]> {
    const customersRef = tenantCollection(tenantId, "customers");

    // Search by name prefix
    let nameQuery = customersRef
        .where("name", ">=", query)
        .where("name", "<", endStr);

    if (filters?.city) {
        nameQuery = nameQuery.where("city", "==", filters.city);
    }

    const nameSnap = await nameQuery.limit(10).get();

    // Search by document match
    const docQuery = customersRef
        .where("document", "==", query)
        .limit(10);

    const docSnap = await docQuery.get();

    // Merge results, avoiding duplicates
    const seen = new Set<string>();
    const results: SearchResultItem[] = [];

    for (const doc of [...nameSnap.docs, ...docSnap.docs]) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);

        const d = doc.data();
        results.push({
            id: doc.id,
            type: "customer",
            primaryText: d.name ?? "",
            secondaryText: d.document ?? "",
            status: "active",
        });
    }

    return results.slice(0, 10);
}

async function searchVendors(
    tenantId: string,
    query: string,
    endStr: string,
    filters?: z.infer<typeof globalSearchSchema>["filters"]
): Promise<SearchResultItem[]> {
    const vendorsRef = tenantCollection(tenantId, "vendors");

    // Search by name prefix
    let nameQuery = vendorsRef
        .where("name", ">=", query)
        .where("name", "<", endStr);

    if (filters?.status) {
        nameQuery = nameQuery.where("status", "==", filters.status);
    }

    const nameSnap = await nameQuery.limit(10).get();

    // Search by document match
    const docQuery = vendorsRef
        .where("document", "==", query)
        .limit(10);

    const docSnap = await docQuery.get();

    // Merge results, avoiding duplicates
    const seen = new Set<string>();
    const results: SearchResultItem[] = [];

    for (const doc of [...nameSnap.docs, ...docSnap.docs]) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);

        const d = doc.data();
        results.push({
            id: doc.id,
            type: "vendor",
            primaryText: d.name ?? "",
            secondaryText: d.document ?? "",
            status: d.status ?? "active",
        });
    }

    return results.slice(0, 10);
}

async function searchRaffles(
    tenantId: string,
    query: string,
    endStr: string,
    filters?: z.infer<typeof globalSearchSchema>["filters"]
): Promise<SearchResultItem[]> {
    const rafflesRef = tenantCollection(tenantId, "raffles");

    let raffleQuery = rafflesRef
        .where("name", ">=", query)
        .where("name", "<", endStr);

    if (filters?.status) {
        raffleQuery = raffleQuery.where("status", "==", filters.status);
    }
    if (filters?.lottery) {
        raffleQuery = raffleQuery.where("lottery", "==", filters.lottery);
    }

    const snap = await raffleQuery.limit(10).get();

    return snap.docs.map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            type: "raffle",
            primaryText: d.name ?? "",
            secondaryText: d.lottery ?? "",
            status: d.status ?? "draft",
        };
    });
}

async function searchTickets(
    tenantId: string,
    query: string,
    filters?: z.infer<typeof globalSearchSchema>["filters"]
): Promise<SearchResultItem[]> {
    const ticketNumber = parseInt(query, 10);

    // Only search tickets if query is a numeric value
    if (isNaN(ticketNumber)) {
        return [];
    }

    // Need a specific raffleId to search tickets (they are subcollections)
    const raffleId = filters?.raffleId;
    if (!raffleId) {
        return [];
    }

    const ticketsRef = tenantCollection(tenantId, "raffles")
        .doc(raffleId)
        .collection("tickets");

    let ticketQuery = ticketsRef.where("number", "==", ticketNumber);

    if (filters?.status) {
        ticketQuery = ticketQuery.where("status", "==", filters.status);
    }
    if (filters?.vendorId) {
        ticketQuery = ticketQuery.where("vendorId", "==", filters.vendorId);
    }
    if (filters?.customerId) {
        ticketQuery = ticketQuery.where("customerId", "==", filters.customerId);
    }

    const snap = await ticketQuery.limit(10).get();

    return snap.docs.map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            type: "ticket",
            primaryText: `Ticket #${d.number}`,
            secondaryText: `Raffle: ${raffleId}`,
            status: d.status ?? "available",
        };
    });
}
