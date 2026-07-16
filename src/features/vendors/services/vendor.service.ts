import { callFunction } from "@/services/firebase-callable";

export const vendorService = {
    create: (data: { name: string; document: string; phone: string; whatsapp?: string; userId: string }) =>
        callFunction<{ vendorId: string }>("createVendor", data),

    update: (vendorId: string, data: Record<string, unknown>) =>
        callFunction<{ success: boolean }>("updateVendor", { vendorId, ...data }),

    getMetrics: (vendorId: string, raffleId?: string) =>
        callFunction<Record<string, number>>("getVendorMetrics", { vendorId, raffleId }),
};
