/**
 * Audit Service - Internal helper for creating audit trail entries.
 *
 * Provides:
 * - createAuditEntry: Creates an audit trail document with retry logic
 *
 * This is NOT a callable Cloud Function — it's used internally by other services.
 */

import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../utils/firestore.js";

/**
 * Creates an audit trail entry with retry logic (up to 3 attempts).
 * Audit failures are logged but never thrown — they must not break the calling operation.
 */
export async function createAuditEntry(
    tenantId: string,
    operationType: string,
    entityType: string,
    entityId: string,
    userId: string,
    ipAddress: string | null,
    metadata: Record<string, unknown>
): Promise<void> {
    const maxRetries = 3;
    const baseDelay = 100; // ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const db = getDb();
            const auditRef = db.collection(
                `tenants/${tenantId}/auditTrail`
            );

            await auditRef.add({
                operationType,
                entityType,
                entityId,
                userId,
                tenantId,
                ipAddress,
                metadata,
                timestamp: FieldValue.serverTimestamp(),
            });

            // Success — exit early
            return;
        } catch (error) {
            if (attempt < maxRetries) {
                // Exponential backoff: 100ms, 200ms, 400ms
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await sleep(delay);
            } else {
                // All retries exhausted — log and swallow
                console.error(
                    `[AuditService] Failed to create audit entry after ${maxRetries} attempts.`,
                    {
                        tenantId,
                        operationType,
                        entityType,
                        entityId,
                        userId,
                        error,
                    }
                );
            }
        }
    }
}

/**
 * Simple sleep utility for retry backoff.
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
