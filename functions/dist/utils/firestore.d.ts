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
//# sourceMappingURL=firestore.d.ts.map