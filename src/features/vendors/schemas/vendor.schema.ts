import { z } from "zod";

export const vendorSchema = z.object({
    name: z.string().min(1, "Nombre es requerido").max(100, "Máximo 100 caracteres"),
    document: z
        .string()
        .min(1, "Documento es requerido")
        .max(10, "Máximo 10 dígitos")
        .regex(/^\d+$/, "Solo se permiten números"),
    phone: z
        .string()
        .min(1, "Teléfono es requerido")
        .max(10, "Máximo 10 dígitos")
        .regex(/^\d+$/, "Solo se permiten números"),
    email: z.string().min(1, "Email es requerido").email("Email inválido"),
});

export type VendorFormData = z.infer<typeof vendorSchema>;
