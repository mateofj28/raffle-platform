import {
    getFirestore,
    connectFirestoreEmulator,
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
let _emulatorConnected = false;

function getDb(): Firestore {
    if (_db) return _db;
    _db = getFirestore(getFirebaseApp());

    // Connect to emulator in development
    if (process.env.NODE_ENV === "development" && !_emulatorConnected && typeof window !== "undefined") {
        connectFirestoreEmulator(_db, "localhost", 8080);
        _emulatorConnected = true;
    }

    return _db;
}

export function tenantCollection(tenantId: string, collectionName: string) {
    return collection(getDb(), "tenants", tenantId, collectionName);
}

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
