"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useRaffleStore } from "@/store/raffle.store";
import {
    login,
    logout,
    getUserWithClaims,
    vendorHasTicketsInOfficialRaffle,
} from "../services/auth.service";
import { ROUTES } from "@/constants/routes";

/** Mensaje que ve el vendedor sin boletas al intentar entrar. */
export const NO_TICKETS_MESSAGE =
    "No tienes boletas asignadas en la rifa actual. Contacta al administrador.";

export function useAuth() {
    const router = useRouter();
    const { user, isLoading, isAuthenticated, setUser, setLoading, reset } =
        useAuthStore();
    const clearActiveRaffle = useRaffleStore((s) => s.clearActiveRaffle);

    const handleLogin = async (email: string, password: string) => {
        setLoading(true);
        try {
            const firebaseUser = await login(email, password);
            const authUser = await getUserWithClaims(firebaseUser);

            // Un vendedor SIN boletas asignadas en la rifa actual no puede entrar.
            // Se verifica antes de poblar el store; si no tiene, se cierra la sesión
            // (signInWithEmailAndPassword ya creó la sesión) y se rechaza el acceso.
            if (authUser.role === "vendor") {
                const hasTickets = await vendorHasTicketsInOfficialRaffle(
                    authUser.tenantId,
                    authUser.vendorId || ""
                );
                if (!hasTickets) {
                    await logout();
                    reset();
                    const err = new Error(NO_TICKETS_MESSAGE);
                    err.name = "NoTicketsError";
                    throw err;
                }
            }

            setUser(authUser);

            // Al iniciar sesión, limpiar cualquier rifa "activa" que quedara guardada
            // en este dispositivo de una sesión anterior. Así el usuario SIEMPRE
            // arranca en la rifa oficial (la actual), no en la que consultó la última vez.
            clearActiveRaffle();

            // Redirect based on role
            if (authUser.role === "admin" || authUser.role === "cashier") {
                router.push(ROUTES.ADMIN_DASHBOARD);
            } else {
                router.push(ROUTES.VENDOR_DASHBOARD);
            }
        } catch (error) {
            setLoading(false);
            throw error;
        }
    };

    const handleLogout = async () => {
        await logout();
        reset();
        clearActiveRaffle();
        router.push(ROUTES.LOGIN);
    };

    return {
        user,
        isLoading,
        isAuthenticated,
        login: handleLogin,
        logout: handleLogout,
    };
}
