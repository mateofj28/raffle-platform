/**
 * Commission Service - Cloud Functions for commission management.
 *
 * Provides:
 * - payCommission: Marks a generated commission as paid (admin-only)
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth.js";
import { validateData } from "../middleware/validation.js";
import { AppError, AppErrorCode, handleError } from "../utils/errors.js";
import { getDb } from "../utils/firestore.js";

// --- Zod Schemas ---

const payCommissionSchema = z.object({
    commissionId: z.string().min(1),
});

// --- Callable Functions ---

/**
 * Marks a commission as paid.
 * Admin-only. Only commissions with status "generated" can be paid.
 */
export const payCommission = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(payCommissionSchema, request.data);
            const { commissionId } = data;

            const db = getDb();
            const commissionRef = db.doc(
                `tenants/${context.tenantId}/commissions/${commissionId}`
            );

            const commissionSnap = await commissionRef.get();

            if (!commissionSnap.exists) {
                throw new AppError(
                    AppErrorCode.NOT_FOUND,
                    "Commission not found."
                );
            }

            const commission = commissionSnap.data()!;

            if (commission.status === "reversed") {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    "Cannot pay a reversed commission"
                );
            }

            if (commission.status === "paid") {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    "Commission is already paid"
                );
            }

            if (commission.status !== "generated") {
                throw new AppError(
                    AppErrorCode.INVALID_TRANSITION,
                    "Only generated commissions can be paid."
                );
            }

            await commissionRef.update({
                status: "paid",
                paidAt: FieldValue.serverTimestamp(),
            });

            return { success: true };
        } catch (error) {
            handleError(error);
        }
    }
);
