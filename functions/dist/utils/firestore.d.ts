/**
 * Initializes Firebase Admin if not already initialized.
 */
export declare function initAdmin(): import("firebase-admin/app").App;
/**
 * Returns the Firestore instance.
 */
export declare function getDb(): FirebaseFirestore.Firestore;
/**
 * Returns a reference to a tenant's root document.
 */
export declare function tenantRef(tenantId: string): FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>;
/**
 * Returns a reference to a collection within a tenant.
 */
export declare function tenantCollection(tenantId: string, collectionName: string): FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>;
/**
 * BATCH_SIZE constant for Firestore batch operations.
 */
export declare const BATCH_SIZE = 500;
/**
 * Devuelve el id de la rifa OFICIAL del tenant: la más reciente por createdAt
 * entre las que están "active" o "draft". Es la única rifa en la que se pueden
 * realizar operaciones (vender, pagar, asignar). Retorna null si no hay ninguna.
 */
export declare function getOfficialRaffleId(tenantId: string): Promise<string | null>;
