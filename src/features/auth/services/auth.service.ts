import { signIn, signOut, getIdTokenResult, onAuthChange } from "@/lib/firebase/auth";
import type { User } from "firebase/auth";
import { getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import type { AuthUser } from "../types/auth.types";

/**
 * ¿El vendedor tiene al menos una boleta asignada en la rifa OFICIAL (la actual)?
 * Un vendedor sin boletas en la rifa vigente no puede operar, así que se usa para
 * impedirle el acceso. Si no hay rifa oficial, retorna false (nada que hacer).
 */
export async function vendorHasTicketsInOfficialRaffle(tenantId: string, vendorId: string): Promise<boolean> {
    if (!tenantId || !vendorId) return false;
    // Rifa oficial: la más reciente activa/borrador.
    const rafflesSnap = await getDocs(query(
        tenantCollection(tenantId, "raffles"),
        where("status", "in", ["active", "draft"]),
        orderBy("createdAt", "desc"),
        limit(1)
    ));
    if (rafflesSnap.empty) return false;
    const raffleId = rafflesSnap.docs[0].id;
    // ¿Tiene al menos una boleta con su vendorId en esa rifa?
    const ticketsSnap = await getDocs(query(
        tenantCollection(tenantId, `raffles/${raffleId}/tickets`),
        where("vendorId", "==", vendorId),
        limit(1)
    ));
    return !ticketsSnap.empty;
}

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
        role: (claims.role as "admin" | "cashier" | "vendor") || "vendor",
        vendorId: claims.vendorId as string | undefined,
    };
}

/**
 * Subscribes to auth state changes.
 */
export function subscribeToAuthState(callback: (user: User | null) => void) {
    return onAuthChange(callback);
}
