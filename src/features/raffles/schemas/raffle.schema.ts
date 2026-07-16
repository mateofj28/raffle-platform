import { z } from "zod";

export const createRaffleSchema = z.object({
    name: z.string().min(1, "Nombre es requerido").max(150, "Máximo 150 caracteres"),
    description: z.string().min(1, "Descripción es requerida").max(1000, "Máximo 1000 caracteres"),
    prize: z.string().min(1, "Premio es requerido").max(200, "Máximo 200 caracteres"),
    startDate: z.string().min(1, "Fecha inicio es requerida"),
    endDate: z.string().min(1, "Fecha fin es requerida"),
    drawDate: z.string().min(1, "Fecha sorteo es requerida"),
    lottery: z.string().min(1, "Lotería es requerida"),
    ticketPrice: z.number().int().positive("Debe ser mayor a 0"),
    totalTickets: z.number().int().min(1).max(50000, "Máximo 50,000 boletas"),
});

export const assignTicketsSchema = z.object({
    raffleId: z.string().min(1),
    vendorId: z.string().min(1, "Vendedor es requerido"),
    fromNumber: z.coerce.number().int().min(1, "Mínimo 1"),
    toNumber: z.coerce.number().int().min(1, "Mínimo 1"),
});

export type CreateRaffleFormData = z.infer<typeof createRaffleSchema>;
export type AssignTicketsFormData = z.infer<typeof assignTicketsSchema>;
