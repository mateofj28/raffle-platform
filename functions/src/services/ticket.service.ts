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
import { validateAuth, requireAdmin, requireVendorOwnership, type AuthContext } from "../middleware/auth";
import { validateData } from "../middleware/validation";
import { AppError, AppErrorCode, handleError } from "../utils/errors";
import { getDb, BATCH_SIZE } from "../utils/firestore";

// --- Zod Schemas ---

const assignTicketsSchema = z.object({
    raffleId: z.string().min(1),
    vendorId: z.string().min(1),
    // Supports either a range (fromNumber/toNumber) or a list of specific numbers
    fromNumber: z.number().int().min(1).optional(),
    toNumber: z.number().int().min(1).optional(),
    ticketNumbers: z.array(z.number().int().min(1)).optional(),
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
            const { raffleId, vendorId, fromNumber, toNumber, ticketNumbers } = data;

            const db = getDb();

            // Validate raffle exists and is active or draft
            const raffleRef = db.doc(`tenants/${context.tenantId}/raffles/${raffleId}`);
            const raffleSnap = await raffleRef.get();

            if (!raffleSnap.exists) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Raffle not found.");
            }

            const raffle = raffleSnap.data()!;

            if (raffle.status !== "active" && raffle.status !== "draft") {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    "Raffle must be active or draft to assign tickets."
                );
            }

            // Determine which tickets to assign
            let numbersToAssign: number[] = [];

            if (ticketNumbers && ticketNumbers.length > 0) {
                // Mode: specific ticket numbers
                numbersToAssign = ticketNumbers;
            } else if (fromNumber && toNumber) {
                // Mode: range
                if (fromNumber > toNumber) {
                    throw new AppError(
                        AppErrorCode.VALIDATION_ERROR,
                        "fromNumber must be less than or equal to toNumber.",
                        { fromNumber: "Must be <= toNumber" }
                    );
                }
                for (let n = fromNumber; n <= toNumber; n++) {
                    numbersToAssign.push(n);
                }
            } else {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "Provide either ticketNumbers array or fromNumber/toNumber range."
                );
            }

            // Batch assign tickets
            const ticketsBasePath = `tenants/${context.tenantId}/raffles/${raffleId}/tickets`;
            let assigned = 0;
            let skipped = 0;

            for (let i = 0; i < numbersToAssign.length; i += BATCH_SIZE) {
                const batch = db.batch();
                const chunk = numbersToAssign.slice(i, i + BATCH_SIZE);

                for (const num of chunk) {
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
