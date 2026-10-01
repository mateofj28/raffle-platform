import { callFunction } from "@/services/firebase-callable";

export const customerService = {
    create: (data: { name: string; document: string; phone: string; phoneCountry?: string; whatsapp?: string; address?: string; city?: string; department?: string }) =>
        callFunction<{ customerId: string }>("createCustomer", data),

    update: (customerId: string, data: Record<string, unknown>) =>
        callFunction<{ success: boolean }>("updateCustomer", { customerId, ...data }),

    remove: (customerId: string) =>
        callFunction<{ success: boolean }>("deleteCustomer", { customerId }),
};
