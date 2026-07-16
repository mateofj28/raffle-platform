"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import {
    login,
    logout,
    getUserWithClaims,
    subscribeToAuthState,
} from "../services/auth.service";
import { ROUTES } from "@/constants/routes";

export function useAuth() {
    const router = useRouter();
    const { user, isLoading, isAuthenticated, setUser, setLoading, reset } =
        useAuthStore();

    useEffect(() => {
        const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const authUser = await getUserWithClaims(firebaseUser);
                    setUser(authUser);
                } catch {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
        });

        return () => unsubscribe();
    }, [setUser]);

    const handleLogin = async (email: string, password: string) => {
        setLoading(true);
        try {
            const firebaseUser = await login(email, password);
            const authUser = await getUserWithClaims(firebaseUser);
            setUser(authUser);

            // Redirect based on role
            if (authUser.role === "admin") {
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
