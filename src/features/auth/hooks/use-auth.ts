"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import {
    login,
    logout,
    getUserWithClaims,
} from "../services/auth.service";
import { ROUTES } from "@/constants/routes";

export function useAuth() {
    const router = useRouter();
    const { user, isLoading, isAuthenticated, setUser, setLoading, reset } =
        useAuthStore();

    const handleLogin = async (email: string, password: string) => {
        setLoading(true);
        try {
            const firebaseUser = await login(email, password);
            const authUser = await getUserWithClaims(firebaseUser);
            setUser(authUser);

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
