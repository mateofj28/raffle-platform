"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useSession } from "../hooks/use-session";
import { ROUTES } from "@/constants/routes";
import type { Role } from "@/constants/roles";

interface AuthGuardProps {
    children: React.ReactNode;
    requiredRole?: Role;
}

/**
 * Protects routes by checking authentication and role.
 * Redirects to login if not authenticated.
 * Redirects to appropriate dashboard if role doesn't match.
 */
export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading, isAuthenticated } = useAuthStore();

    // Monitor session inactivity
    useSession();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            router.push(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        if (requiredRole && user?.role !== requiredRole) {
            // Redirect to the user's appropriate dashboard
            if (user?.role === "admin") {
                router.push(ROUTES.ADMIN_DASHBOARD);
            } else {
                router.push(ROUTES.VENDOR_DASHBOARD);
            }
        }
    }, [isLoading, isAuthenticated, user, requiredRole, router, pathname]);

    if (isLoading) {
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
