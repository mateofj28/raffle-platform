import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(100, "Máximo 100 caracteres"),
  document: z.string().min(1, "Documento es requerido").max(20, "Máximo 20 caracteres"),
  phone: z.string().min(1, "Teléfono es requerido").max(15, "Máximo 15 caracteres"),
  whatsapp: z.string().max(15, "Máximo 15 caracteres"),
  address: z.string().max(200, "Máximo 200 caracteres"),
  city: z.string().max(50, "Máximo 50 caracteres"),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
