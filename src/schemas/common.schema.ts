import { z } from "zod";

// --- Shared Schemas ---

export const paginationSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(100),
});

export const dateRangeSchema = z.object({
    startDate: z.string().date(),
    endDate: z.string().date(),
});

export const idSchema = z.string().min(1, "ID es requerido");

// --- Customer Schema ---

export const customerSchema = z.object({
    name: z.string().min(1, "Nombre es requerido").max(100, "Máximo 100 caracteres"),
    document: z.string().min(1, "Documento es requerido").max(20, "Máximo 20 caracteres"),
    phone: z.string().min(1, "Teléfono es requerido").max(15, "Máximo 15 caracteres"),
    whatsapp: z.string().max(15, "Máximo 15 caracteres").optional().default(""),
    address: z.string().max(200, "Máximo 200 caracteres").optional().default(""),
    city: z.string().max(50, "Máximo 50 caracteres").optional().default(""),
});

// --- Vendor Schema ---

export const vendorSchema = z.object({
    name: z.string().min(1, "Nombre es requerido").max(100),
    document: z.string().min(1, "Documento es requerido").max(20),
    phone: z.string().min(1, "Teléfono es requerido").max(15),
    whatsapp: z.string().max(15).optional().default(""),
    email: z.string().email("Email inválido"),
});

// --- Payment Schema ---

export const paymentSchema = z.object({
    ticketId: z.string().min(1),
    raffleId: z.string().min(1),
    amount: z.number().int().min(1, "Monto mínimo es 1"),
    type: z.enum(["payment", "installment"]),
    method: z.enum(["cash", "transfer", "card", "nequi", "daviplata", "other"]),
    observations: z.string().max(500).optional().default(""),
});

// --- Reversal Schema ---

export const reversalSchema = z.object({
    paymentId: z.string().min(1),
    amount: z.number().int().min(1),
    reason: z.string().min(10, "Mínimo 10 caracteres").max(500, "Máximo 500 caracteres"),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type VendorInput = z.infer<typeof vendorSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ReversalInput = z.infer<typeof reversalSchema>;
