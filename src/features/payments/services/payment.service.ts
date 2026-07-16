import { callFunction } from "@/services/firebase-callable";

export const paymentService = {
    register: (data: { raffleId: string; ticketNumber: number; amount: number; type: string; method: string; observations?: string }) =>
        callFunction<{ paymentId: string; newPendingBalance: number; ticketStatus: string }>("registerPayment", data),

    reverse: (data: { paymentId: string; amount: number; reason: string }) =>
        callFunction<{ adjustmentId: string; newPendingBalance: number; ticketStatus: string }>("reversePayment", data),
};
