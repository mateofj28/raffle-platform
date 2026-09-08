import { getFirestore } from "firebase-admin/firestore";
import { getApp, getApps, initializeApp } from "firebase-admin/app";

/**
 * Initializes Firebase Admin if not already initialized.
 */
export function initAdmin() {
    if (getApps().length === 0) {
        initializeApp();
    }
    return getApp();
}

/**
 * Returns the Firestore instance.
 */
export function getDb() {
    initAdmin();
    return getFirestore();
}

/**
 * Returns a reference to a tenant's root document.
 */
export function tenantRef(tenantId: string) {
    return getDb().collection("tenants").doc(tenantId);
}

/**
 * Returns a reference to a collection within a tenant.
 */
export function tenantCollection(tenantId: string, collectionName: string) {
    return tenantRef(tenantId).collection(collectionName);
}

/**
 * BATCH_SIZE constant for Firestore batch operations.
 */
export const BATCH_SIZE = 500;

/**
 * Devuelve el id de la rifa OFICIAL del tenant: la más reciente por createdAt
 * entre las que están "active" o "draft". Es la única rifa en la que se pueden
 * realizar operaciones (vender, pagar, asignar). Retorna null si no hay ninguna.
 */
export async function getOfficialRaffleId(tenantId: string): Promise<string | null> {
    const snap = await tenantCollection(tenantId, "raffles")
        .where("status", "in", ["active", "draft"])
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

    if (snap.empty) return null;
    return snap.docs[0].id;
}
