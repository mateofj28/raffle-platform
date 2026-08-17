"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { subscribeToAuthState, getUserWithClaims } from "../services/auth.service";
import { onAuthChange } from "@/lib/firebase/auth";
import { getAuth } from "firebase/auth";
import { ROUTES } from "@/constants/routes";
import type { Role } from "@/constants/roles";

const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MAX_REFRESH_FAILURES = 3; // Allow up to 3 consecutive failures before logout

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
    const failureCountRef = useRef(0);

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

        // Safety timeout — if auth doesn't resolve in 10s, stop waiting
        const timeout = setTimeout(() => {
            setAuthChecked(true);
        }, 10000);

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
                    // User gone — could be temporary, increment failure count
                    failureCountRef.current++;
                    if (failureCountRef.current >= MAX_REFRESH_FAILURES) {
                        reset();
                        router.push(ROUTES.LOGIN);
                    }
                    return;
                }

                // Force refresh token — this will fail if account is disabled/deleted
                const tokenResult = await currentUser.getIdTokenResult(true);
                const claims = tokenResult.claims;

                // Reset failure counter on success
                failureCountRef.current = 0;

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
                // Token refresh failed — could be transient network error
                failureCountRef.current++;
                if (failureCountRef.current >= MAX_REFRESH_FAILURES) {
                    reset();
                    router.push(ROUTES.LOGIN);
                }
            }
        };

        // Run first refresh after a short delay to let emulator stabilize
        const initialDelay = setTimeout(refreshToken, 3000);
        intervalRef.current = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);

        return () => {
            clearTimeout(initialDelay);
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
            // Cashiers can access admin pages (they share the panel)
            if (requiredRole === "admin" && user?.role === "cashier") {
                return; // Allow access
            }
            if (user?.role === "admin" || user?.role === "cashier") {
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
        // Cashiers can access admin pages
        if (!(requiredRole === "admin" && user?.role === "cashier")) {
            return null;
        }
    }

    return <>{children}</>;
}
