import { callFunction } from "@/services/firebase-callable";
import type { TenantSettings } from "@/types/api.types";

export const settingsService = {
    /** Lee la configuración del tenant desde el backend. */
    getSettings: async (): Promise<TenantSettings> => {
        const res = await callFunction<{ settings: TenantSettings }>("getSettings");
        return res.settings;
    },
    /** Actualiza (merge parcial) la configuración del tenant. Admin-only. */
    updateSettings: async (data: Partial<TenantSettings>): Promise<TenantSettings> => {
        const res = await callFunction<{ success: boolean; settings: TenantSettings }, Partial<TenantSettings>>(
            "updateSettings",
            data
        );
        return res.settings;
    },
};
