import { signIn, signOut, getIdTokenResult, onAuthChange } from "@/lib/firebase/auth";
import type { User } from "firebase/auth";
import type { AuthUser } from "../types/auth.types";

/**
 * Authenticates a user with email and password.
 */
export async function login(email: string, password: string) {
    const credential = await signIn(email, password);
    return credential.user;
}

/**
 * Signs out the current user.
 */
export async function logout() {
    return signOut();
}

/**
 * Extracts AuthUser from a Firebase User by reading custom claims.
 */
export async function getUserWithClaims(user: User): Promise<AuthUser> {
    const tokenResult = await getIdTokenResult(user);
    const claims = tokenResult.claims;

    return {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName,
        tenantId: (claims.tenantId as string) || "",
        role: (claims.role as "admin" | "vendor") || "vendor",
        vendorId: claims.vendorId as string | undefined,
    };
}

/**
 * Subscribes to auth state changes.
 */
export function subscribeToAuthState(callback: (user: User | null) => void) {
    return onAuthChange(callback);
}
