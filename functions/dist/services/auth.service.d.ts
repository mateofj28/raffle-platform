/**
 * Auth Service - Cloud Functions for user authentication and custom claims.
 *
 * Provides:
 * - setCustomClaims: Sets custom claims (tenantId, role, vendorId) on a user's auth token
 * - createUser: Admin-only function to create a new Firebase Auth user and assign to tenant
 * - recordLoginAttempt: Tracks failed login attempts with account lockout (5 attempts / 15 min)
 * - checkAccountLock: Checks if an account is currently locked
 */
/**
 * Sets custom claims (tenantId, role, vendorId) on a user's auth token.
 * Only admins can set custom claims on other users.
 */
export declare const setCustomClaims: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
/**
 * Creates a new Firebase Auth user and assigns them to the caller's tenant.
 * Admin-only function.
 */
export declare const createUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    uid: string;
    message: string;
}>, unknown>;
/**
 * Records a failed login attempt and enforces account lockout.
 * Locks the account after MAX_LOGIN_ATTEMPTS failed attempts for LOCKOUT_DURATION_MS.
 */
export declare const recordLoginAttempt: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    locked: boolean;
    attempts: number;
    lockedUntil: string | null;
} | {
    locked: boolean;
    attempts: number;
}>, unknown>;
/**
 * Checks if an account is currently locked due to too many failed login attempts.
 */
export declare const checkAccountLock: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    locked: boolean;
    attempts: number;
    lockedUntil: null;
} | {
    locked: boolean;
    attempts: number;
    lockedUntil: string;
}>, unknown>;
//# sourceMappingURL=auth.service.d.ts.map