import { z } from "zod";
import { PHONE_COUNTRIES } from "@/constants/phone-countries";

export const customerSchema = z.object({
  name: z.string().min(1, "Nombre es requerido").max(100, "Máximo 100 caracteres"),
  document: z
    .string()
    .min(1, "Documento es requerido")
    .max(10, "Máximo 10 dígitos")
    .regex(/^\d+$/, "Solo se permiten números"),
  // Indicativo del país, ej. "+57". El default lo pone el formulario.
  phoneCountry: z
    .string()
    .min(1, "Indicativo requerido"),
  // Número local (solo dígitos). La longitud se valida según el país en superRefine.
  phone: z
    .string()
    .min(1, "Teléfono es requerido")
    .regex(/^\d+$/, "Solo se permiten números"),
  department: z.string().min(1, "Departamento es requerido"),
  city: z.string().min(1, "Ciudad es requerida"),
  address: z.string().max(200, "Máximo 200 caracteres"),
}).superRefine((data, ctx) => {
  // Validar la cantidad de dígitos del número según el indicativo elegido.
  const country = PHONE_COUNTRIES.find((c) => c.code === data.phoneCountry);
  const expected = country?.digits ?? 10;
  if (data.phone && /^\d+$/.test(data.phone) && data.phone.length !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phone"],
      message: `El número debe tener ${expected} dígitos para ${country?.name ?? "este país"}.`,
    });
  }
});

export type CustomerFormData = z.infer<typeof customerSchema>;
