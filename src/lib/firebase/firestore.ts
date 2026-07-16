import {
    getFirestore,
    collection,
    doc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    getDoc,
    onSnapshot,
    type DocumentData,
    type QueryConstraint,
    type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "./config";

let _db: Firestore | null = null;

function getDb(): Firestore {
    if (_db) return _db;
    _db = getFirestore(getFirebaseApp());
    return _db;
}

/**
 * Returns a reference to a tenant-scoped collection.
 */
export function tenantCollection(tenantId: string, collectionName: string) {
    return collection(getDb(), "tenants", tenantId, collectionName);
}

/**
 * Returns a reference to a document within a tenant-scoped collection.
 */
export function tenantDoc(
    tenantId: string,
    collectionName: string,
    docId: string
) {
    return doc(getDb(), "tenants", tenantId, collectionName, docId);
}

export {
    collection,
    doc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    getDoc,
    onSnapshot,
    type DocumentData,
    type QueryConstraint,
};

export { getDb };
