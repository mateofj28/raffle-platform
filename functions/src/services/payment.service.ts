/**
 * Payment Service - Cloud Functions for payment management.
 *
 * Provides:
 * - registerPayment: Records a payment or installment for a ticket
 * - reversePayment: Creates a financial adjustment (reversal) for a payment
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, requireVendorOwnership, type AuthContext } from "../middleware/auth.js";
import { validateData } from "../middleware/validation.js";
import { AppError, AppErrorCode, handleError } from "../utils/errors.js";
import { getDb } from "../utils/firestore.js";

// --- Zod Schemas ---

const registerPaymentSchema = z.object({
    raffleId: z.string().min(1),
    ticketNumber: z.number().int().min(1),
    amount: z.number().int().min(1),
    type: z.enum(["payment", "installment"]),
    method: z.enum(["cash", "transfer", "card", "nequi", "daviplata", "other"]),
    observations: z.string().max(500).optional().default(""),
});

const reversePaymentSchema = z.object({
    paymentId: z.string().min(1),
    amount: z.number().int().min(1),
    reason: z.string().min(10).max(500),
});

// --- Helpers ---

function padTicketNumber(num: number): string {
    return String(num).padStart(5, "0");
}

// --- Callable Functions ---

/**
 * Registers a payment or installment for a ticket.
 * Vendor or Admin can call.
 */
export const registerPayment = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);

            const data = validateData(registerPaymentSchema, request.data);
            const { raffleId, ticketNumber, amount, type, method, observations } = data;

            const db = getDb();
            const ticketDocId = padTicketNumber(ticketNumber);
            const ticketRef = db.doc(
                `tenants/${context.tenantId}/raffles/${raffleId}/tickets/${ticketDocId}`
            );
            const paymentsCol = db.collection(`tenants/${context.tenantId}/payments`);
            const paymentRef = paymentsCol.doc();

            const result = await db.runTransaction(async (transaction) => {
                const ticketSnap = await transaction.get(ticketRef);

                // Validate ticket exists
                if (!ticketSnap.exists) {
                    throw new AppError(AppErrorCode.NOT_FOUND, "Ticket not found.");
                }

                const ticket = ticketSnap.data()!;

                // Validate ticket status can accept payment
                const acceptableStatuses = ["sold", "installment"];
                if (!acceptableStatuses.includes(ticket.status)) {
                    throw new AppError(
                        AppErrorCode.INVALID_TRANSITION,
                        "Ticket must be in sold or installment status to accept payments."
                    );
                }

                // If vendor role, validate ownership
                if (context.role === "vendor") {
                    requireVendorOwnership(context, ticket.vendorId);
                }

                const pendingBalance: number = ticket.pendingBalance;

                // Validate ticket is not already fully paid
                if (pendingBalance <= 0) {
                    throw new AppError(
                        AppErrorCode.VALIDATION_ERROR,
                        "Ticket is already fully paid"
                    );
                }

                // Validate amount does not exceed pending balance
                if (amount > pendingBalance) {
                    throw new AppError(
                        AppErrorCode.PAYMENT_EXCEEDS_BALANCE,
                        `Payment exceeds pending balance. Maximum: ${pendingBalance}`
                    );
                }

                // Calculate new pending balance and status
                const newPendingBalance = pendingBalance - amount;
                let ticketStatus: string;

                if (newPendingBalance === 0) {
                    ticketStatus = "paid";
                } else if (newPendingBalance > 0 && type === "installment") {
                    ticketStatus = "installment";
                } else {
                    ticketStatus = ticket.status;
                }

                // Create payment document
                transaction.set(paymentRef, {
                    ticketId: ticketDocId,
                    raffleId,
                    customerId: ticket.customerId,
                    vendorId: ticket.vendorId,
                    amount,
                    type,
                    method,
                    date: FieldValue.serverTimestamp(),
                    observations,
                    createdAt: FieldValue.serverTimestamp(),
                    createdBy: context.uid,
                });

                // Update ticket
                transaction.update(ticketRef, {
                    pendingBalance: newPendingBalance,
                    status: ticketStatus,
                    updatedAt: FieldValue.serverTimestamp(),
                });

                return { newPendingBalance, ticketStatus };
            });

            return {
                paymentId: paymentRef.id,
                newPendingBalance: result.newPendingBalance,
                ticketStatus: result.ticketStatus,
            };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Reverses (partially or fully) a payment by creating an adjustment record.
 * Admin-only.
 */
export const reversePayment = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(reversePaymentSchema, request.data);
            const { paymentId, amount, reason } = data;

            const db = getDb();
            const paymentRef = db.doc(`tenants/${context.tenantId}/payments/${paymentId}`);
            const adjustmentsCol = db.collection(`tenants/${context.tenantId}/adjustments`);

            // Read original payment
            const paymentSnap = await paymentRef.get();

            if (!paymentSnap.exists) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Payment not found.");
            }

            const payment = paymentSnap.data()!;

            // Query existing reversals for this payment
            const existingReversalsSnap = await adjustmentsCol
                .where("paymentId", "==", paymentId)
                .get();

            let existingReversals = 0;
            for (const doc of existingReversalsSnap.docs) {
                existingReversals += doc.data().amount as number;
            }

            // Validate not already fully reversed
            if (existingReversals >= payment.amount) {
                throw new AppError(
                    AppErrorCode.ALREADY_REVERSED,
                    "Transaction has already been fully reversed"
                );
            }

            // Validate amount does not exceed remaining reversible amount
            const remaining = payment.amount - existingReversals;
            if (existingReversals + amount > payment.amount) {
                throw new AppError(
                    AppErrorCode.ALREADY_REVERSED,
                    `Maximum reversible amount remaining: ${remaining}`
                );
            }

            // Get ticket reference
            const ticketRef = db.doc(
                `tenants/${context.tenantId}/raffles/${payment.raffleId}/tickets/${payment.ticketId}`
            );

            // Create adjustment and update ticket in a transaction
            const adjustmentRef = adjustmentsCol.doc();

            const result = await db.runTransaction(async (transaction) => {
                const ticketSnap = await transaction.get(ticketRef);

                if (!ticketSnap.exists) {
                    throw new AppError(AppErrorCode.NOT_FOUND, "Ticket not found.");
                }

                const ticket = ticketSnap.data()!;
                const newPendingBalance = ticket.pendingBalance + amount;

                // Determine new status
                let ticketStatus = ticket.status;
                if (newPendingBalance > 0 && ticket.status === "paid") {
                    ticketStatus = "installment";
                }

                // Create adjustment document
                transaction.set(adjustmentRef, {
                    paymentId,
                    ticketId: payment.ticketId,
                    raffleId: payment.raffleId,
                    amount,
                    reason,
                    authorizedBy: context.uid,
                    createdAt: FieldValue.serverTimestamp(),
                });

                // Update ticket
                transaction.update(ticketRef, {
                    pendingBalance: newPendingBalance,
                    status: ticketStatus,
                    updatedAt: FieldValue.serverTimestamp(),
                });

                return { newPendingBalance, ticketStatus };
            });

            return {
                adjustmentId: adjustmentRef.id,
                newPendingBalance: result.newPendingBalance,
                ticketStatus: result.ticketStatus,
            };
        } catch (error) {
            handleError(error);
        }
    }
);
