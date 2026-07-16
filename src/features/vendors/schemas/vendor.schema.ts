import { z } from "zod";

export const vendorSchema = z.object({
    name: z.string().min(1, "Nombre es requerido").max(100),
    document: z.string().min(1, "Documento es requerido").max(20),
    phone: z.string().min(1, "Teléfono es requerido").max(15),
    whatsapp: z.string().max(15),
    email: z.string().email("Email inválido"),
});

export type VendorFormData = z.infer<typeof vendorSchema>;
