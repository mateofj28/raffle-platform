/**
 * Customer Service - Cloud Functions for customer management.
 *
 * Provides:
 * - createCustomer: Creates a new customer (vendor or admin)
 * - updateCustomer: Updates customer fields (admin-only)
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth.js";
import { validateData } from "../middleware/validation.js";
import { AppError, AppErrorCode, handleError } from "../utils/errors.js";
import { getDb } from "../utils/firestore.js";

// --- Zod Schemas ---

const createCustomerSchema = z.object({
    name: z.string().min(1).max(100),
    document: z.string().min(1).max(20),
    phone: z.string().min(1).max(15),
    whatsapp: z.string().max(15).optional().default(""),
    address: z.string().max(200).optional().default(""),
    city: z.string().max(50).optional().default(""),
});

const updateCustomerSchema = z.object({
    customerId: z.string().min(1),
    name: z.string().min(1).max(100).optional(),
    document: z.string().min(1).max(20).optional(),
    phone: z.string().min(1).max(15).optional(),
    whatsapp: z.string().max(15).optional(),
    address: z.string().max(200).optional(),
    city: z.string().max(50).optional(),
});

// --- Callable Functions ---

/**
 * Creates a new customer within the tenant.
 * Vendor or Admin can call.
 * Validates document uniqueness within the tenant.
 */
export const createCustomer = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);

            const data = validateData(createCustomerSchema, request.data);

            const db = getDb();
            const customersCol = db.collection(
                `tenants/${context.tenantId}/customers`
            );

            // Validate document uniqueness within tenant
            const duplicateQuery = await customersCol
                .where("document", "==", data.document)
                .limit(1)
                .get();

            if (!duplicateQuery.empty) {
                throw new AppError(
                    AppErrorCode.CONFLICT,
                    "A customer with this document already exists"
                );
            }

            // Create customer document
            const newCustomerRef = customersCol.doc();

            await newCustomerRef.set({
                name: data.name,
                document: data.document,
                phone: data.phone,
                whatsapp: data.whatsapp,
                address: data.address,
                city: data.city,
                createdBy: context.uid,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            return { customerId: newCustomerRef.id };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Updates customer fields.
 * Admin-only. Validates customer exists and document uniqueness if changed.
 */
export const updateCustomer = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = validateData(updateCustomerSchema, request.data);
            const { customerId, ...updateFields } = data;

            const db = getDb();
            const customerRef = db.doc(
                `tenants/${context.tenantId}/customers/${customerId}`
            );

            const customerSnap = await customerRef.get();

            if (!customerSnap.exists) {
                throw new AppError(
                    AppErrorCode.NOT_FOUND,
                    "Customer not found."
                );
            }

            // If document is being changed, validate uniqueness
            if (updateFields.document !== undefined) {
                const currentDocument = customerSnap.data()?.document;

                if (updateFields.document !== currentDocument) {
                    const customersCol = db.collection(
                        `tenants/${context.tenantId}/customers`
                    );
                    const duplicateQuery = await customersCol
                        .where("document", "==", updateFields.document)
                        .limit(1)
                        .get();

                    if (!duplicateQuery.empty) {
                        throw new AppError(
                            AppErrorCode.CONFLICT,
                            "A customer with this document already exists"
                        );
                    }
                }
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

            await customerRef.update(updateData);

            return { success: true };
        } catch (error) {
            handleError(error);
        }
    }
);
