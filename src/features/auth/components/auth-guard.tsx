"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { subscribeToAuthState, getUserWithClaims } from "../services/auth.service";
import { onAuthChange } from "@/lib/firebase/auth";
import { getAuth } from "firebase/auth";
import { ROUTES } from "@/constants/routes";
import type { Role } from "@/constants/roles";

const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface AuthGuardProps {
    children: React.ReactNode;
    requiredRole?: Role;
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isAuthenticated, setUser, reset } = useAuthStore();
    const [authChecked, setAuthChecked] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Subscribe to Firebase Auth state
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
            setAuthChecked(true);
        });

        // Safety timeout — if auth doesn't resolve in 5s, stop waiting
        const timeout = setTimeout(() => {
            setAuthChecked(true);
        }, 5000);

        return () => {
            unsubscribe();
            clearTimeout(timeout);
        };
    }, [setUser]);

    // Periodic token refresh: validates session is still active and claims haven't changed
    useEffect(() => {
        if (!isAuthenticated) return;

        const refreshToken = async () => {
            try {
                const auth = getAuth();
                const currentUser = auth.currentUser;
                if (!currentUser) {
                    // User gone — force logout
                    reset();
                    router.push(ROUTES.LOGIN);
                    return;
                }

                // Force refresh token — this will fail if account is disabled/deleted
                const tokenResult = await currentUser.getIdTokenResult(true);
                const claims = tokenResult.claims;

                // Check if claims changed (role removed, tenant changed, etc.)
                const newRole = (claims.role as string) || "";
                const newTenantId = (claims.tenantId as string) || "";

                if (user && (newRole !== user.role || newTenantId !== user.tenantId)) {
                    // Claims changed — update store and redirect if needed
                    const authUser = await getUserWithClaims(currentUser);
                    setUser(authUser);

                    // If role was revoked or changed, redirect
                    if (requiredRole && authUser.role !== requiredRole) {
                        if (authUser.role === "admin") {
                            router.push(ROUTES.ADMIN_DASHBOARD);
                        } else if (authUser.role === "vendor") {
                            router.push(ROUTES.VENDOR_DASHBOARD);
                        } else {
                            reset();
                            router.push(ROUTES.LOGIN);
                        }
                    }
                }
            } catch {
                // Token refresh failed — account disabled or deleted
                reset();
                router.push(ROUTES.LOGIN);
            }
        };

        // Run immediately once, then every 5 minutes
        refreshToken();
        intervalRef.current = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isAuthenticated, user?.role, user?.tenantId]);

    // Handle redirects after auth is resolved
    useEffect(() => {
        if (!authChecked) return;

        if (!isAuthenticated) {
            router.push(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        if (requiredRole && user?.role !== requiredRole) {
            if (user?.role === "admin") {
                router.push(ROUTES.ADMIN_DASHBOARD);
            } else {
                router.push(ROUTES.VENDOR_DASHBOARD);
            }
        }
    }, [authChecked, isAuthenticated, user, requiredRole, router, pathname]);

    // Show loading while checking auth (max 5 seconds)
    if (!authChecked) {
        return (
            <div className="flex min-h-dvh items-center justify-center">
                <div className="animate-pulse text-default-400">Cargando...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (requiredRole && user?.role !== requiredRole) {
        return null;
    }

    return <>{children}</>;
}
