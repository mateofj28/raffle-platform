"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BATCH_SIZE = void 0;
exports.initAdmin = initAdmin;
exports.getDb = getDb;
exports.tenantRef = tenantRef;
exports.tenantCollection = tenantCollection;
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
/**
 * Initializes Firebase Admin if not already initialized.
 */
function initAdmin() {
    if ((0, app_1.getApps)().length === 0) {
        (0, app_1.initializeApp)();
    }
    return (0, app_1.getApp)();
}
/**
 * Returns the Firestore instance.
 */
function getDb() {
    initAdmin();
    return (0, firestore_1.getFirestore)();
}
/**
 * Returns a reference to a tenant's root document.
 */
function tenantRef(tenantId) {
    return getDb().collection("tenants").doc(tenantId);
}
/**
 * Returns a reference to a collection within a tenant.
 */
function tenantCollection(tenantId, collectionName) {
    return tenantRef(tenantId).collection(collectionName);
}
/**
 * BATCH_SIZE constant for Firestore batch operations.
 */
exports.BATCH_SIZE = 500;
//# sourceMappingURL=firestore.js.map