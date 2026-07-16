"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { ROUTES } from "@/constants/routes";

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Monitors user session for inactivity and redirects to login after timeout.
 * Preserves the intended destination URL as a query parameter.
 */
export function useSession() {
    const router = useRouter();
    const { isAuthenticated, reset } = useAuthStore();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleTimeout = useCallback(() => {
        if (isAuthenticated) {
            reset();
            const currentPath = window.location.pathname;
            router.push(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(currentPath)}`);
        }
    }, [isAuthenticated, reset, router]);

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (isAuthenticated) {
            timeoutRef.current = setTimeout(handleTimeout, INACTIVITY_TIMEOUT_MS);
        }
    }, [isAuthenticated, handleTimeout]);

    useEffect(() => {
        if (!isAuthenticated) return;

        const events = ["mousedown", "keydown", "scroll", "touchstart"];
        events.forEach((event) => window.addEventListener(event, resetTimer));
        resetTimer();

        return () => {
            events.forEach((event) => window.removeEventListener(event, resetTimer));
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [isAuthenticated, resetTimer]);
}
