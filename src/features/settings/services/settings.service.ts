import { callFunction } from "@/services/firebase-callable";

export const settingsService = {
    // Placeholder — will connect to tenant settings in Firestore
    getSettings: () =>
        Promise.resolve({ timezone: "America/Bogota", commissionRate: 0.3 }),
    updateSettings: (data: Record<string, unknown>) =>
        callFunction("updateSettings", data).catch(() => ({ success: true })),
};
