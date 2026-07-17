import { z } from "zod";

export const customerSchema = z.object({
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
  address: z.string().max(200, "Máximo 200 caracteres"),
  city: z.string().max(50, "Máximo 50 caracteres"),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
