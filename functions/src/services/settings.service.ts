/**
 * Settings Service - Cloud Functions para la configuración del tenant.
 *
 * Provides:
 * - getSettings: Devuelve los settings del tenant (cualquier usuario autenticado).
 * - updateSettings: Actualiza los settings del tenant (admin-only).
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth";
import { validateData } from "../middleware/validation";
import { handleError } from "../utils/errors";
import { getDb } from "../utils/firestore";
import { getTenantSettings, PAYMENT_METHOD_VALUES } from "../utils/settings";

// --- Zod Schema ---

// Todos los campos son opcionales: se hace merge parcial sobre los settings actuales.
const updateSettingsSchema = z.object({
    commissionRate: z.number().min(0).max(1).optional(),
    activePaymentMethods: z
        .array(z.enum(PAYMENT_METHOD_VALUES))
        .min(1, "Debe haber al menos un método de pago activo")
        .optional(),
    defaultTicketPrice: z.number().int().positive().optional(),
    minInstallment: z.number().int().positive().optional(),
    businessInfo: z
        .object({
            name: z.string().max(120).optional(),
            nit: z.string().max(40).optional(),
            phone: z.string().max(20).optional(),
        })
        .optional(),
});

// --- Callable Functions ---

/**
 * Devuelve los settings normalizados del tenant del usuario autenticado.
 */
export const getSettings = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            const settings = await getTenantSettings(context.tenantId);
            return { settings };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Actualiza (merge parcial) los settings del tenant. Admin-only.
 * Devuelve los settings resultantes ya normalizados.
 */
export const updateSettings = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(updateSettingsSchema, request.data);

            const db = getDb();
            const tenantRef = db.doc(`tenants/${context.tenantId}`);

            // Construir el objeto de merge solo con los campos provistos,
            // usando notación de punto para no pisar otros campos de settings.
            const updates: Record<string, unknown> = {
                "settings.updatedAt": FieldValue.serverTimestamp(),
                "settings.updatedBy": context.uid,
            };

            if (data.commissionRate !== undefined) updates["settings.commissionRate"] = data.commissionRate;
            if (data.activePaymentMethods !== undefined) updates["settings.activePaymentMethods"] = data.activePaymentMethods;
            if (data.defaultTicketPrice !== undefined) updates["settings.defaultTicketPrice"] = data.defaultTicketPrice;
            if (data.minInstallment !== undefined) updates["settings.minInstallment"] = data.minInstallment;
            if (data.businessInfo !== undefined) {
                if (data.businessInfo.name !== undefined) updates["settings.businessInfo.name"] = data.businessInfo.name;
                if (data.businessInfo.nit !== undefined) updates["settings.businessInfo.nit"] = data.businessInfo.nit;
                if (data.businessInfo.phone !== undefined) updates["settings.businessInfo.phone"] = data.businessInfo.phone;
            }

            await tenantRef.update(updates);

            const settings = await getTenantSettings(context.tenantId);
            return { success: true, settings };
        } catch (error) {
            handleError(error);
        }
    }
);
