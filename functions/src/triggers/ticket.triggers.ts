/**
 * Ticket Triggers - Firestore triggers for ticket status changes.
 *
 * Provides:
 * - onTicketStatusChanged: Updates real-time counters when a ticket's status changes
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../utils/firestore.js";

/**
 * Status fields in the metrics/raffles document that correspond to ticket statuses.
 */
function getCounterField(status: string): string | null {
    switch (status) {
        case "sold":
        case "paid":
        case "winner":
            return "ticketsSold";
        case "available":
            return "ticketsAvailable";
        case "cancelled":
            return "ticketsCancelled";
        default:
            return null;
    }
}

/**
 * Triggered when a ticket document is updated.
 * If the status field changed, updates the counters in the tenant's metrics/raffles document.
 */
export const onTicketStatusChanged = onDocumentUpdated(
    "tenants/{tenantId}/raffles/{raffleId}/tickets/{ticketId}",
    async (event) => {
        const beforeData = event.data?.before.data();
        const afterData = event.data?.after.data();

        if (!beforeData || !afterData) return;

        const oldStatus = beforeData.status as string;
        const newStatus = afterData.status as string;

        // Only act if status actually changed
        if (oldStatus === newStatus) return;

        const { tenantId } = event.params;
        const db = getDb();
        const metricsRef = db.doc(`tenants/${tenantId}/metrics/raffles`);

        const oldField = getCounterField(oldStatus);
        const newField = getCounterField(newStatus);

        // Build the update object
        const updateData: Record<string, FieldValue> = {};

        if (oldField) {
            updateData[oldField] = FieldValue.increment(-1);
        }
        if (newField) {
            updateData[newField] = FieldValue.increment(1);
        }

        if (Object.keys(updateData).length === 0) return;

        try {
            await metricsRef.update(updateData);
        } catch (error) {
            // If the metrics doc doesn't exist yet, create it with defaults
            console.warn(
                `[TicketTrigger] Metrics doc not found for tenant ${tenantId}, skipping counter update.`,
                error
            );
        }
    }
);
