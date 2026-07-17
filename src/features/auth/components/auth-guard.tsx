"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { subscribeToAuthState, getUserWithClaims } from "../services/auth.service";
import { ROUTES } from "@/constants/routes";
import type { Role } from "@/constants/roles";

interface AuthGuardProps {
    children: React.ReactNode;
    requiredRole?: Role;
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isAuthenticated, setUser } = useAuthStore();
    const [authChecked, setAuthChecked] = useState(false);

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
