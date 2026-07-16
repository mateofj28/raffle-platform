/**
 * Export Service - Data export functionality.
 *
 * Provides:
 * - exportData: Exports data in Excel or PDF format (simplified version)
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth.js";
import { validateData } from "../middleware/validation.js";
import { AppError, AppErrorCode, handleError } from "../utils/errors.js";
import { tenantCollection } from "../utils/firestore.js";

// --- Schema ---

const exportDataSchema = z.object({
    type: z.enum(["raffles", "tickets", "customers", "vendors", "payments"]),
    format: z.enum(["excel", "pdf"]),
    filters: z.object({
        raffleId: z.string().optional(),
        status: z.string().optional(),
        vendorId: z.string().optional(),
        customerId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
    }).optional(),
});

// --- Constants ---

const EXCEL_MAX_ROWS = 100_000;
const PDF_MAX_ROWS = 10_000;

// --- Callable Function ---

/**
 * Exports data as Excel or PDF.
 * Admin-only. Simplified version that queries and counts results.
 * Actual file generation will be implemented when exceljs/pdfkit deps are added.
 */
export const exportData = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(exportDataSchema, request.data);
            const { type, format, filters } = data;

            // Determine the max allowed rows based on format
            const maxRows = format === "excel" ? EXCEL_MAX_ROWS : PDF_MAX_ROWS;

            // Query the appropriate collection
            const count = await countRecords(context.tenantId, type, filters);

            // Validate dataset size
            if (count === 0) {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "No data available to export"
                );
            }

            if (count > maxRows) {
                throw new AppError(
                    AppErrorCode.EXPORT_LIMIT_EXCEEDED,
                    "Dataset exceeds the export limit. Apply additional filters."
                );
            }

            // Generate a placeholder export ID
            const exportId = `export_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

            return {
                exportId,
                status: "ready",
                count,
                downloadUrl: null,
                message: "Export generation queued",
            };
        } catch (error) {
            handleError(error);
        }
    }
);

// --- Helpers ---

async function countRecords(
    tenantId: string,
    type: string,
    filters?: z.infer<typeof exportDataSchema>["filters"]
): Promise<number> {
    if (type === "tickets") {
        return countTickets(tenantId, filters);
    }

    if (type === "payments") {
        return countPayments(tenantId, filters);
    }

    // For raffles, customers, vendors — top-level tenant collections
    const collRef = tenantCollection(tenantId, type);
    let query: FirebaseFirestore.Query = collRef;

    if (filters?.status) {
        query = query.where("status", "==", filters.status);
    }
    if (filters?.vendorId) {
        query = query.where("vendorId", "==", filters.vendorId);
    }
    if (filters?.customerId) {
        query = query.where("customerId", "==", filters.customerId);
    }

    const snap = await query.count().get();
    return snap.data().count;
}

async function countTickets(
    tenantId: string,
    filters?: z.infer<typeof exportDataSchema>["filters"]
): Promise<number> {
    // Tickets require a raffleId since they are subcollections
    if (!filters?.raffleId) {
        throw new AppError(
            AppErrorCode.VALIDATION_ERROR,
            "A raffleId filter is required when exporting tickets."
        );
    }

    const ticketsRef = tenantCollection(tenantId, "raffles")
        .doc(filters.raffleId)
        .collection("tickets");

    let query: FirebaseFirestore.Query = ticketsRef;

    if (filters.status) {
        query = query.where("status", "==", filters.status);
    }
    if (filters.vendorId) {
        query = query.where("vendorId", "==", filters.vendorId);
    }
    if (filters.customerId) {
        query = query.where("customerId", "==", filters.customerId);
    }

    const snap = await query.count().get();
    return snap.data().count;
}

async function countPayments(
    tenantId: string,
    filters?: z.infer<typeof exportDataSchema>["filters"]
): Promise<number> {
    // Payments are subcollections under raffles
    if (!filters?.raffleId) {
        throw new AppError(
            AppErrorCode.VALIDATION_ERROR,
            "A raffleId filter is required when exporting payments."
        );
    }

    const paymentsRef = tenantCollection(tenantId, "raffles")
        .doc(filters.raffleId)
        .collection("payments");

    let query: FirebaseFirestore.Query = paymentsRef;

    if (filters.vendorId) {
        query = query.where("vendorId", "==", filters.vendorId);
    }
    if (filters.customerId) {
        query = query.where("customerId", "==", filters.customerId);
    }

    const snap = await query.count().get();
    return snap.data().count;
}
