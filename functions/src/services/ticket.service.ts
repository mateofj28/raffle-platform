/**
 * Ticket Service - Cloud Functions for ticket management.
 *
 * Provides:
 * - generateTickets: Batch generates tickets for a raffle (internal, non-callable)
 * - assignTickets: Assigns a range of tickets to a vendor (admin-only)
 * - sellTicket: Sells a ticket to a customer (vendor or admin)
 * - cancelTicket: Cancels a ticket (admin-only)
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, requireVendorOwnership, type AuthContext } from "../middleware/auth.js";
import { validateData } from "../middleware/validation.js";
import { AppError, AppErrorCode, handleError } from "../utils/errors.js";
import { getDb, BATCH_SIZE } from "../utils/firestore.js";

// --- Zod Schemas ---

const assignTicketsSchema = z.object({
    raffleId: z.string().min(1),
    vendorId: z.string().min(1),
    fromNumber: z.number().int().min(1),
    toNumber: z.number().int().min(1),
});

const sellTicketSchema = z.object({
    raffleId: z.string().min(1),
    ticketNumber: z.number().int().min(1),
    customerId: z.string().min(1),
});

const cancelTicketSchema = z.object({
    raffleId: z.string().min(1),
    ticketNumber: z.number().int().min(1),
});

// --- Helpers ---

function padTicketNumber(num: number): string {
    return String(num).padStart(5, "0");
}

// --- Internal Function (non-callable) ---

/**
 * Batch generates tickets for a raffle.
 * Called internally by raffle service during raffle creation.
 */
export async function generateTickets(
    tenantId: string,
    raffleId: string,
    totalTickets: number,
    ticketPrice: number
): Promise<void> {
    const db = getDb();
    const ticketsBasePath = `tenants/${tenantId}/raffles/${raffleId}/tickets`;

    for (let i = 0; i < totalTickets; i += BATCH_SIZE) {
        const batch = db.batch();
        const end = Math.min(i + BATCH_SIZE, totalTickets);

        for (let num = i + 1; num <= end; num++) {
            const docId = padTicketNumber(num);
            const ticketRef = db.collection(ticketsBasePath).doc(docId);

            batch.set(ticketRef, {
                number: num,
                status: "available",
                customerId: null,
                vendorId: null,
                saleDate: null,
                value: ticketPrice,
                pendingBalance: ticketPrice,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }

        await batch.commit();
    }
}

// --- Callable Functions ---

/**
 * Assigns a range of tickets to a vendor.
 * Admin-only. Updates available tickets to "assigned" status with the given vendorId.
 */
export const assignTickets = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(assignTicketsSchema, request.data);
            const { raffleId, vendorId, fromNumber, toNumber } = data;

            const db = getDb();

            // Validate raffle exists and is active
            const raffleRef = db.doc(`tenants/${context.tenantId}/raffles/${raffleId}`);
            const raffleSnap = await raffleRef.get();

            if (!raffleSnap.exists) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Raffle not found.");
            }

            const raffle = raffleSnap.data()!;

            if (raffle.status !== "active") {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    "Raffle must be active to assign tickets."
                );
            }

            // Validate range
            if (fromNumber > toNumber) {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "fromNumber must be less than or equal to toNumber.",
                    { fromNumber: "Must be <= toNumber" }
                );
            }

            if (toNumber > raffle.totalTickets) {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "toNumber exceeds total tickets in raffle.",
                    { toNumber: "Exceeds raffle total tickets" }
                );
            }

            // Batch assign tickets
            const ticketsBasePath = `tenants/${context.tenantId}/raffles/${raffleId}/tickets`;
            let assigned = 0;
            let skipped = 0;

            for (let i = fromNumber; i <= toNumber; i += BATCH_SIZE) {
                const batch = db.batch();
                const end = Math.min(i + BATCH_SIZE - 1, toNumber);

                for (let num = i; num <= end; num++) {
                    const docId = padTicketNumber(num);
                    const ticketRef = db.collection(ticketsBasePath).doc(docId);
                    const ticketSnap = await ticketRef.get();

                    if (!ticketSnap.exists) {
                        skipped++;
                        continue;
                    }

                    const ticket = ticketSnap.data()!;

                    if (ticket.status !== "available") {
                        skipped++;
                        continue;
                    }

                    batch.update(ticketRef, {
                        status: "assigned",
                        vendorId,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    assigned++;
                }

                await batch.commit();
            }

            return { assigned, skipped };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Sells a ticket to a customer using a Firestore transaction.
 * Vendor or Admin can call.
 */
export const sellTicket = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);

            const data = validateData(sellTicketSchema, request.data);
            const { raffleId, ticketNumber, customerId } = data;

            const db = getDb();
            const ticketDocId = padTicketNumber(ticketNumber);
            const ticketRef = db.doc(
                `tenants/${context.tenantId}/raffles/${raffleId}/tickets/${ticketDocId}`
            );
            const raffleRef = db.doc(
                `tenants/${context.tenantId}/raffles/${raffleId}`
            );

            await db.runTransaction(async (transaction) => {
                const ticketSnap = await transaction.get(ticketRef);
                const raffleSnap = await transaction.get(raffleRef);

                // Validate ticket exists
                if (!ticketSnap.exists) {
                    throw new AppError(AppErrorCode.NOT_FOUND, "Ticket not found.");
                }

                const ticket = ticketSnap.data()!;

                // Validate ticket status is "assigned"
                if (ticket.status !== "assigned") {
                    throw new AppError(
                        AppErrorCode.CONFLICT,
                        "Ticket is no longer available."
                    );
                }

                // If vendor role, validate ownership
                if (context.role === "vendor") {
                    requireVendorOwnership(context, ticket.vendorId);
                }

                // Validate raffle is active
                if (!raffleSnap.exists) {
                    throw new AppError(AppErrorCode.NOT_FOUND, "Raffle not found.");
                }

                const raffle = raffleSnap.data()!;

                if (raffle.status !== "active") {
                    throw new AppError(
                        AppErrorCode.INVALID_TRANSITION,
                        "Raffle is not active."
                    );
                }

                // Update ticket
                transaction.update(ticketRef, {
                    status: "sold",
                    customerId,
                    saleDate: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
            });

            return { success: true };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Cancels a ticket.
 * Admin-only. Cannot cancel tickets in "paid" or "winner" state.
 */
export const cancelTicket = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(cancelTicketSchema, request.data);
            const { raffleId, ticketNumber } = data;

            const db = getDb();
            const ticketDocId = padTicketNumber(ticketNumber);
            const ticketRef = db.doc(
                `tenants/${context.tenantId}/raffles/${raffleId}/tickets/${ticketDocId}`
            );

            const ticketSnap = await ticketRef.get();

            if (!ticketSnap.exists) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Ticket not found.");
            }

            const ticket = ticketSnap.data()!;

            // Validate ticket can be cancelled
            const cancellableStatuses = ["available", "assigned", "sold"];
            if (!cancellableStatuses.includes(ticket.status)) {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    `Cannot cancel a ticket in ${ticket.status} state.`
                );
            }

            await ticketRef.update({
                status: "cancelled",
                updatedAt: FieldValue.serverTimestamp(),
            });

            return { success: true };
        } catch (error) {
            handleError(error);
        }
    }
);
