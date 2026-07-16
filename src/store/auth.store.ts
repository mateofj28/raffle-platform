"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/features/auth/types/auth.types";

interface AuthStore {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    setUser: (user: AuthUser | null) => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            isLoading: true,
            isAuthenticated: false,

            setUser: (user) =>
                set({
                    user,
                    isAuthenticated: user !== null,
                    isLoading: false,
                }),

            setLoading: (isLoading) => set({ isLoading }),

            reset: () =>
                set({
                    user: null,
                    isLoading: false,
                    isAuthenticated: false,
                }),
        }),
        {
            name: "raffle-auth-storage",
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
