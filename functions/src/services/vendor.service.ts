/**
 * Vendor Service - Cloud Functions for vendor management.
 *
 * Provides:
 * - createVendor: Creates a new vendor (admin-only)
 * - updateVendor: Updates vendor fields (admin-only)
 * - getVendorMetrics: Retrieves vendor performance metrics (vendor or admin)
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, requireVendorOwnership, type AuthContext } from "../middleware/auth.js";
import { validateData } from "../middleware/validation.js";
import { AppError, AppErrorCode, handleError } from "../utils/errors.js";
import { getDb } from "../utils/firestore.js";

// --- Zod Schemas ---

const createVendorSchema = z.object({
    name: z.string().min(1).max(100),
    document: z.string().min(1).max(20),
    phone: z.string().min(1).max(15),
    whatsapp: z.string().max(15).optional().default(""),
    userId: z.string().min(1),
});

const updateVendorSchema = z.object({
    vendorId: z.string().min(1),
    name: z.string().min(1).max(100).optional(),
    document: z.string().min(1).max(20).optional(),
    phone: z.string().min(1).max(15).optional(),
    whatsapp: z.string().max(15).optional(),
    status: z.enum(["active", "inactive", "suspended"]).optional(),
});

const getVendorMetricsSchema = z.object({
    vendorId: z.string().min(1),
    raffleId: z.string().min(1).optional(),
});

// --- Callable Functions ---

/**
 * Creates a new vendor within the tenant.
 * Admin-only.
 */
export const createVendor = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(createVendorSchema, request.data);

            const db = getDb();
            const vendorsCol = db.collection(
                `tenants/${context.tenantId}/vendors`
            );

            const newVendorRef = vendorsCol.doc();

            await newVendorRef.set({
                name: data.name,
                document: data.document,
                phone: data.phone,
                whatsapp: data.whatsapp,
                userId: data.userId,
                status: "active",
                createdBy: context.uid,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            return { vendorId: newVendorRef.id };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Updates vendor fields.
 * Admin-only. Validates vendor exists.
 */
export const updateVendor = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(updateVendorSchema, request.data);
            const { vendorId, ...updateFields } = data;

            const db = getDb();
            const vendorRef = db.doc(
                `tenants/${context.tenantId}/vendors/${vendorId}`
            );

            const vendorSnap = await vendorRef.get();

            if (!vendorSnap.exists) {
                throw new AppError(
                    AppErrorCode.NOT_FOUND,
                    "Vendor not found."
                );
            }

            // Build update object with only provided fields
            const updateData: Record<string, unknown> = {
                updatedAt: FieldValue.serverTimestamp(),
            };

            for (const [key, value] of Object.entries(updateFields)) {
                if (value !== undefined) {
                    updateData[key] = value;
                }
            }

            await vendorRef.update(updateData);

            return { success: true };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Retrieves vendor performance metrics.
 * Vendor or Admin can call. Vendor must be accessing their own data.
 * Optionally scoped to a single raffle.
 */
export const getVendorMetrics = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);

            const data = validateData(getVendorMetricsSchema, request.data);
            const { vendorId, raffleId } = data;

            // If vendor role, validate they are accessing their own data
            if (context.role === "vendor") {
                requireVendorOwnership(context, vendorId);
            }

            const db = getDb();
            const tenantPath = `tenants/${context.tenantId}`;

            // --- Query tickets ---
            let ticketsQuery: FirebaseFirestore.Query = db.collectionGroup("tickets")
                .where("vendorId", "==", vendorId);

            if (raffleId) {
                ticketsQuery = ticketsQuery.where("raffleId", "==", raffleId);
            }

            const ticketsSnap = await ticketsQuery.get();

            let assignedCount = 0;
            let soldCount = 0;
            let availableCount = 0;
            let paidCount = 0;
            let installmentCount = 0;
            let cancelledCount = 0;
            let pendingCount = 0;

            for (const doc of ticketsSnap.docs) {
                // Only include tickets belonging to this tenant
                if (!doc.ref.path.startsWith(tenantPath)) continue;

                const ticket = doc.data();
                switch (ticket.status) {
                    case "assigned":
                        assignedCount++;
                        break;
                    case "sold":
                        soldCount++;
                        break;
                    case "available":
                        availableCount++;
                        break;
                    case "paid":
                        paidCount++;
                        break;
                    case "installment":
                        installmentCount++;
                        break;
                    case "cancelled":
                        cancelledCount++;
                        break;
                    default:
                        pendingCount++;
                        break;
                }
            }

            // --- Query payments ---
            let paymentsQuery: FirebaseFirestore.Query = db.collection(
                `${tenantPath}/payments`
            ).where("vendorId", "==", vendorId);

            if (raffleId) {
                paymentsQuery = paymentsQuery.where("raffleId", "==", raffleId);
            }

            const paymentsSnap = await paymentsQuery.get();

            let moneyCollected = 0;
            for (const doc of paymentsSnap.docs) {
                const payment = doc.data();
                moneyCollected += payment.amount as number;
            }

            // --- Query commissions ---
            let commissionsQuery: FirebaseFirestore.Query = db.collection(
                `${tenantPath}/commissions`
            ).where("vendorId", "==", vendorId);

            if (raffleId) {
                commissionsQuery = commissionsQuery.where("raffleId", "==", raffleId);
            }

            const commissionsSnap = await commissionsQuery.get();

            let commissionGenerated = 0;
            let commissionPaid = 0;

            for (const doc of commissionsSnap.docs) {
                const commission = doc.data();
                if (commission.status !== "reversed") {
                    commissionGenerated += commission.commissionAmount as number;
                }
                if (commission.status === "paid") {
                    commissionPaid += commission.commissionAmount as number;
                }
            }

            const pendingBalanceToDeliver = moneyCollected - commissionGenerated;

            return {
                assignedCount,
                soldCount,
                availableCount,
                paidCount,
                installmentCount,
                cancelledCount,
                pendingCount,
                moneyCollected,
                commissionGenerated,
                commissionPaid,
                pendingBalanceToDeliver,
            };
        } catch (error) {
            handleError(error);
        }
    }
);
