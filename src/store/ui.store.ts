"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
    theme: "light" | "dark" | "system";
    sidebarOpen: boolean;
    setTheme: (theme: "light" | "dark" | "system") => void;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            theme: "system",
            sidebarOpen: true,

            setTheme: (theme) => set({ theme }),

            toggleSidebar: () =>
                set((state) => ({ sidebarOpen: !state.sidebarOpen })),

            setSidebarOpen: (open) => set({ sidebarOpen: open }),
        }),
        {
            name: "raffle-ui-storage",
            partialize: (state) => ({
                theme: state.theme,
            }),
        }
    )
);
