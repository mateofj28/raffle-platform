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
