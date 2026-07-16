import { callFunction } from "@/services/firebase-callable";

export const customerService = {
    create: (data: { name: string; document: string; phone: string; whatsapp?: string; address?: string; city?: string }) =>
        callFunction<{ customerId: string }>("createCustomer", data),

    update: (customerId: string, data: Record<string, unknown>) =>
        callFunction<{ success: boolean }>("updateCustomer", { customerId, ...data }),
};
