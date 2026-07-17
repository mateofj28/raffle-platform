import { z } from "zod";

export const vendorSchema = z.object({
    name: z.string().min(1, "Nombre es requerido").max(100, "Máximo 100 caracteres"),
    document: z.string().min(1, "Documento es requerido").max(20, "Máximo 20 caracteres"),
    phone: z.string().min(1, "Teléfono es requerido").max(15, "Máximo 15 caracteres"),
    whatsapp: z.string().max(15, "Máximo 15 caracteres"),
    email: z.string().min(1, "Email es requerido").email("Email inválido"),
});

export type VendorFormData = z.infer<typeof vendorSchema>;
