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
import { validateAuth, requireAdmin, requireVendorOwnership, type AuthContext } from "../middleware/auth";
import { validateData } from "../middleware/validation";
import { AppError, AppErrorCode, handleError } from "../utils/errors";
import { getDb } from "../utils/firestore";
import { createAuditEntry } from "./audit.service";

// --- Zod Schemas ---

const registerPaymentSchema = z.object({
    raffleId: z.string().min(1),
    ticketNumber: z.number().int().min(0).max(9999),
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
    return String(num).padStart(4, "0");
}

// --- Callable Functions ---

/**
 * Registers a payment or installment for a ticket.
 * Vendor or Admin can call.
 */
export const registerPayment = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
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
                    throw new AppError(AppErrorCode.NOT_FOUND, "Boleta no encontrada.");
                }

                const ticket = ticketSnap.data()!;

                // Validate ticket status can accept payment
                const acceptableStatuses = ["assigned", "sold", "installment"];
                if (!acceptableStatuses.includes(ticket.status)) {
                    throw new AppError(
                        AppErrorCode.INVALID_TRANSITION,
                        "La boleta debe estar asignada, vendida o en abonos para aceptar pagos."
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
                        "La boleta ya está completamente pagada"
                    );
                }

                // Validate amount does not exceed pending balance
                if (amount > pendingBalance) {
                    throw new AppError(
                        AppErrorCode.PAYMENT_EXCEEDS_BALANCE,
                        `El pago excede el saldo pendiente de la boleta #${ticketDocId}. Máximo: $${pendingBalance.toLocaleString("es-CO")}`
                    );
                }

                // Calculate new pending balance and status
                const newPendingBalance = pendingBalance - amount;
                let ticketStatus: string;

                if (newPendingBalance === 0) {
                    ticketStatus = "paid";
                } else if (newPendingBalance > 0) {
                    // Any partial payment moves to installment (whether from assigned, sold, or already installment)
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

            // Audit trail
            await createAuditEntry(context.tenantId, "payment_registered", "payment", paymentRef.id, context.uid, null, {
                ticketNumber, raffleId, amount, type, method,
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
    { region: "us-central1", timeoutSeconds: 120 },
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
                throw new AppError(AppErrorCode.NOT_FOUND, "Pago no encontrado.");
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

            // Calculate the effective amount to reverse (what hasn't been reversed yet)
            const effectiveAmount = Math.max(0, payment.amount - existingReversals);

            // Get ticket reference
            const ticketRef = db.doc(
                `tenants/${context.tenantId}/raffles/${payment.raffleId}/tickets/${payment.ticketId}`
            );

            // Create adjustment and update ticket in a transaction
            const adjustmentRef = adjustmentsCol.doc();

            const result = await db.runTransaction(async (transaction) => {
                const ticketSnap = await transaction.get(ticketRef);

                if (!ticketSnap.exists) {
                    throw new AppError(AppErrorCode.NOT_FOUND, "Boleta no encontrada.");
                }

                const ticket = ticketSnap.data()!;

                // Only adjust balance for the portion not yet reversed
                if (effectiveAmount > 0) {
                    const newPendingBalance = ticket.pendingBalance + effectiveAmount;

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
                        amount: effectiveAmount,
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
                }

                // Always delete the payment document
                transaction.delete(paymentRef);

                const finalBalance = effectiveAmount > 0
                    ? ticket.pendingBalance + effectiveAmount
                    : ticket.pendingBalance;
                const finalStatus = finalBalance > 0 ? "installment" : ticket.status;

                return { newPendingBalance: finalBalance, ticketStatus: finalStatus };
            });

            // Audit trail
            await createAuditEntry(context.tenantId, "payment_deleted", "payment", paymentId, context.uid, null, {
                amount: effectiveAmount, reason, ticketId: payment.ticketId,
            });

            return {
                adjustmentId: effectiveAmount > 0 ? adjustmentRef.id : null,
                newPendingBalance: result.newPendingBalance,
                ticketStatus: result.ticketStatus,
            };
        } catch (error) {
            handleError(error);
        }
    }
);


/**
 * Corrects a payment amount. Admin-only.
 * Reverses the original payment and creates a new one with the correct amount.
 */
export const correctPayment = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const schema = z.object({
                paymentId: z.string().min(1),
                newAmount: z.number().int().min(1),
                reason: z.string().min(1).default("Corrección de monto"),
            });

            const data = validateData(schema, request.data);
            const { paymentId, newAmount, reason } = data;

            const db = getDb();
            const paymentRef = db.doc(`tenants/${context.tenantId}/payments/${paymentId}`);
            const paymentSnap = await paymentRef.get();

            if (!paymentSnap.exists) {
                throw new AppError(AppErrorCode.NOT_FOUND, "Pago no encontrado.");
            }

            const payment = paymentSnap.data()!;
            const oldAmount = payment.amount as number;
            const ticketDocId = payment.ticketId as string;
            const raffleId = payment.raffleId as string;

            // Get ticket
            const ticketRef = db.doc(`tenants/${context.tenantId}/raffles/${raffleId}/tickets/${ticketDocId}`);

            await db.runTransaction(async (transaction) => {
                const ticketSnap = await transaction.get(ticketRef);
                if (!ticketSnap.exists) throw new AppError(AppErrorCode.NOT_FOUND, "Boleta no encontrada.");

                const ticket = ticketSnap.data()!;
                const currentBalance = ticket.pendingBalance as number;

                // Calculate new balance: add back old amount, subtract new amount
                const newBalance = currentBalance + oldAmount - newAmount;

                if (newBalance < 0) {
                    throw new AppError(AppErrorCode.PAYMENT_EXCEEDS_BALANCE, "El nuevo monto excede el valor de la boleta.");
                }

                // Update the payment document with new amount
                transaction.update(paymentRef, {
                    amount: newAmount,
                    observations: `${payment.observations || ""} [Corregido: $${oldAmount.toLocaleString()} → $${newAmount.toLocaleString()}. ${reason}]`,
                    updatedAt: FieldValue.serverTimestamp(),
                    correctedBy: context.uid,
                });

                // Update ticket balance
                const newStatus = newBalance === 0 ? "paid" : "installment";
                transaction.update(ticketRef, {
                    pendingBalance: newBalance,
                    status: newStatus,
                    updatedAt: FieldValue.serverTimestamp(),
                });

                // Create audit adjustment record
                const adjustmentsCol = db.collection(`tenants/${context.tenantId}/adjustments`);
                transaction.set(adjustmentsCol.doc(), {
                    paymentId,
                    ticketId: ticketDocId,
                    raffleId,
                    amount: newAmount - oldAmount, // difference (can be positive or negative)
                    reason: `Corrección: $${oldAmount.toLocaleString()} → $${newAmount.toLocaleString()}. ${reason}`,
                    authorizedBy: context.uid,
                    createdAt: FieldValue.serverTimestamp(),
                });
            });

            // Audit trail
            await createAuditEntry(context.tenantId, "payment_corrected", "payment", paymentId, context.uid, null, {
                oldAmount, newAmount, reason,
            });

            return { success: true, oldAmount, newAmount };
        } catch (error) {
            handleError(error);
        }
    }
);
