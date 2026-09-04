/**
 * Payment Triggers - Firestore triggers for payment and adjustment events.
 *
 * Provides:
 * - onPaymentCreated: Generates a commission when a ticket is fully paid
 * - onAdjustmentCreated: Reverses a commission when an adjustment makes the ticket no longer fully paid
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../utils/firestore";

/**
 * Triggered when a payment document is created.
 * If the associated ticket is fully paid (pendingBalance == 0),
 * generates a commission document for the vendor.
 */
export const onPaymentCreated = onDocumentCreated(
    "tenants/{tenantId}/payments/{paymentId}",
    async (event) => {
        const paymentData = event.data?.data();
        if (!paymentData) return;

        const { tenantId } = event.params;
        const { ticketId, raffleId } = paymentData;

        const db = getDb();

        // Get the ticket to check if fully paid
        const ticketRef = db.doc(
            `tenants/${tenantId}/raffles/${raffleId}/tickets/${ticketId}`
        );
        const ticketSnap = await ticketRef.get();

        if (!ticketSnap.exists) return;

        const ticket = ticketSnap.data()!;

        // Only generate commission if ticket is fully paid
        if (ticket.pendingBalance !== 0) return;

        // Calculate commission (30%) and company profit (70%)
        const commissionAmount = Math.floor(ticket.value * 0.30);
        const companyProfit = Math.ceil(ticket.value * 0.70);

        // Create commission document
        const commissionsRef = db.collection(`tenants/${tenantId}/commissions`);
        await commissionsRef.add({
            ticketId,
            raffleId,
            vendorId: ticket.vendorId,
            ticketValue: ticket.value,
            commissionAmount,
            companyProfit,
            status: "generated",
            generatedAt: FieldValue.serverTimestamp(),
            paidAt: null,
            reversedAt: null,
        });
    }
);

/**
 * Triggered when an adjustment document is created.
 * If the associated ticket is no longer fully paid (pendingBalance > 0),
 * reverses any existing non-reversed commission for that ticket.
 */
export const onAdjustmentCreated = onDocumentCreated(
    "tenants/{tenantId}/adjustments/{adjustmentId}",
    async (event) => {
        const adjustmentData = event.data?.data();
        if (!adjustmentData) return;

        const { tenantId } = event.params;
        const { ticketId, raffleId } = adjustmentData;

        const db = getDb();

        // Get the ticket to check current balance
        const ticketRef = db.doc(
            `tenants/${tenantId}/raffles/${raffleId}/tickets/${ticketId}`
        );
        const ticketSnap = await ticketRef.get();

        if (!ticketSnap.exists) return;

        const ticket = ticketSnap.data()!;

        // Only reverse commissions if ticket is no longer fully paid
        if (ticket.pendingBalance <= 0) return;

        // Query commissions for this ticket that are not already reversed
        const commissionsRef = db.collection(`tenants/${tenantId}/commissions`);
        const commissionsQuery = commissionsRef
            .where("ticketId", "==", ticketId)
            .where("status", "!=", "reversed");

        const commissionsSnap = await commissionsQuery.get();

        if (commissionsSnap.empty) return;

        // Reverse each matching commission
        const batch = db.batch();
        for (const doc of commissionsSnap.docs) {
            batch.update(doc.ref, {
                status: "reversed",
                reversedAt: FieldValue.serverTimestamp(),
            });
        }

        await batch.commit();
    }
);
