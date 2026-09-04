"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TenantSettings } from "@/types/api.types";
import { DEFAULT_TENANT_SETTINGS } from "@/types/api.types";

interface SettingsStore {
    settings: TenantSettings;
    loaded: boolean;
    setSettings: (settings: TenantSettings) => void;
    reset: () => void;
}

/**
 * Store de la configuración del tenant. Se hidrata tras el login llamando
 * a la Cloud Function getSettings. Mientras no cargue, usa los defaults,
 * de modo que la UI siempre tenga valores coherentes.
 */
export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            settings: DEFAULT_TENANT_SETTINGS,
            loaded: false,
            setSettings: (settings) => set({ settings, loaded: true }),
            reset: () => set({ settings: DEFAULT_TENANT_SETTINGS, loaded: false }),
        }),
        {
            name: "raffle-settings-storage",
        }
    )
);
