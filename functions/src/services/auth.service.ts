/**
 * Auth Service - Cloud Functions for user authentication and custom claims.
 *
 * Provides:
 * - setCustomClaims: Sets custom claims (tenantId, role, vendorId) on a user's auth token
 * - createUser: Admin-only function to create a new Firebase Auth user and assign to tenant
 * - recordLoginAttempt: Tracks failed login attempts with account lockout (5 attempts / 15 min)
 * - checkAccountLock: Checks if an account is currently locked
 */

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { validateAuth, requireAdmin, type AuthContext } from "../middleware/auth.js";
import { AppError, AppErrorCode, handleError } from "../utils/errors.js";
import { getDb, tenantCollection } from "../utils/firestore.js";

// --- Constants ---

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// --- Interfaces ---

interface SetCustomClaimsData {
    uid: string;
    tenantId: string;
    role: "admin" | "vendor";
    vendorId?: string;
}

interface CreateUserData {
    email: string;
    password: string;
    displayName: string;
    role: "admin" | "vendor";
    vendorId?: string;
}

interface LoginAttemptDoc {
    attempts: number;
    lastAttempt: FirebaseFirestore.Timestamp;
    lockedUntil: FirebaseFirestore.Timestamp | null;
}

// --- Helpers ---

function validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        throw new AppError(
            AppErrorCode.VALIDATION_ERROR,
            "A valid email address is required.",
            { email: "Invalid email format" }
        );
    }
}

function validateRole(role: unknown): asserts role is "admin" | "vendor" {
    if (role !== "admin" && role !== "vendor") {
        throw new AppError(
            AppErrorCode.VALIDATION_ERROR,
            "Role must be 'admin' or 'vendor'.",
            { role: "Invalid role value" }
        );
    }
}

function getLoginAttemptsRef(tenantId: string, email: string) {
    return tenantCollection(tenantId, "loginAttempts").doc(email);
}

// --- Callable Functions ---

/**
 * Sets custom claims (tenantId, role, vendorId) on a user's auth token.
 * Only admins can set custom claims on other users.
 */
export const setCustomClaims = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = request.data as SetCustomClaimsData;

            // Validate required fields
            if (!data.uid || typeof data.uid !== "string") {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "Target user UID is required.",
                    { uid: "Required field" }
                );
            }

            if (!data.tenantId || typeof data.tenantId !== "string") {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "Tenant ID is required.",
                    { tenantId: "Required field" }
                );
            }

            validateRole(data.role);

            // Admins can only set claims for their own tenant
            if (data.tenantId !== context.tenantId) {
                throw new AppError(
                    AppErrorCode.FORBIDDEN,
                    "Cannot set claims for a different tenant."
                );
            }

            // If role is vendor, vendorId is required
            if (data.role === "vendor" && !data.vendorId) {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "Vendor ID is required when role is 'vendor'.",
                    { vendorId: "Required for vendor role" }
                );
            }

            // Build claims object
            const claims: Record<string, unknown> = {
                tenantId: data.tenantId,
                role: data.role,
            };

            if (data.vendorId) {
                claims.vendorId = data.vendorId;
            }

            // Set custom claims on the target user
            await getAuth().setCustomUserClaims(data.uid, claims);

            return { success: true, message: "Custom claims updated successfully." };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Creates a new Firebase Auth user and assigns them to the caller's tenant.
 * Admin-only function.
 */
export const createUser = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);
            requireAdmin(context);

            const data = request.data as CreateUserData;

            // Validate required fields
            validateEmail(data.email);

            if (!data.password || data.password.length < 6) {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "Password must be at least 6 characters.",
                    { password: "Minimum 6 characters required" }
                );
            }

            if (!data.displayName || data.displayName.trim().length === 0) {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "Display name is required.",
                    { displayName: "Required field" }
                );
            }

            validateRole(data.role);

            // If role is vendor, vendorId is required
            if (data.role === "vendor" && !data.vendorId) {
                throw new AppError(
                    AppErrorCode.VALIDATION_ERROR,
                    "Vendor ID is required when role is 'vendor'.",
                    { vendorId: "Required for vendor role" }
                );
            }

            // Check if user already exists with this email
            try {
                await getAuth().getUserByEmail(data.email);
                throw new AppError(
                    AppErrorCode.CONFLICT,
                    "A user with this email already exists."
                );
            } catch (error) {
                // If error is our AppError (CONFLICT), re-throw it
                if (error instanceof AppError) {
                    throw error;
                }
                // Otherwise, user doesn't exist - this is expected, continue
            }

            // Create the Firebase Auth user
            const userRecord = await getAuth().createUser({
                email: data.email,
                password: data.password,
                displayName: data.displayName.trim(),
            });

            // Build and set custom claims
            const claims: Record<string, unknown> = {
                tenantId: context.tenantId,
                role: data.role,
            };

            if (data.vendorId) {
                claims.vendorId = data.vendorId;
            }

            await getAuth().setCustomUserClaims(userRecord.uid, claims);

            // Store user record in tenant's users subcollection
            const db = getDb();
            await db
                .collection("tenants")
                .doc(context.tenantId)
                .collection("users")
                .doc(userRecord.uid)
                .set({
                    email: data.email,
                    displayName: data.displayName.trim(),
                    role: data.role,
                    vendorId: data.vendorId || null,
                    createdAt: FieldValue.serverTimestamp(),
                    createdBy: context.uid,
                    disabled: false,
                });

            return {
                success: true,
                uid: userRecord.uid,
                message: "User created successfully.",
            };
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Records a failed login attempt and enforces account lockout.
 * Locks the account after MAX_LOGIN_ATTEMPTS failed attempts for LOCKOUT_DURATION_MS.
 */
export const recordLoginAttempt = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);

            const { email, success } = request.data as {
                email: string;
                success: boolean;
            };

            validateEmail(email);

            const attemptRef = getLoginAttemptsRef(context.tenantId, email);
            const now = new Date();

            if (success) {
                // Reset attempts on successful login
                await attemptRef.set({
                    attempts: 0,
                    lastAttempt: now,
                    lockedUntil: null,
                });

                return { locked: false, attempts: 0 };
            }

            // Failed login attempt - use transaction for consistency
            const result = await getDb().runTransaction(async (transaction) => {
                const doc = await transaction.get(attemptRef);
                const data = doc.data() as LoginAttemptDoc | undefined;

                let attempts = 1;
                let lockedUntil: Date | null = null;

                if (data) {
                    // Check if lockout has expired
                    if (data.lockedUntil) {
                        const lockExpiry = data.lockedUntil.toDate();
                        if (now < lockExpiry) {
                            // Still locked
                            return {
                                locked: true,
                                attempts: data.attempts,
                                lockedUntil: lockExpiry.toISOString(),
                            };
                        }
                        // Lock expired, reset counter
                        attempts = 1;
                    } else {
                        attempts = data.attempts + 1;
                    }
                }

                // Check if lockout threshold reached
                if (attempts >= MAX_LOGIN_ATTEMPTS) {
                    lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
                }

                transaction.set(attemptRef, {
                    attempts,
                    lastAttempt: now,
                    lockedUntil,
                });

                return {
                    locked: attempts >= MAX_LOGIN_ATTEMPTS,
                    attempts,
                    lockedUntil: lockedUntil?.toISOString() || null,
                };
            });

            return result;
        } catch (error) {
            handleError(error);
        }
    }
);

/**
 * Checks if an account is currently locked due to too many failed login attempts.
 */
export const checkAccountLock = onCall(
    { region: "us-central1" },
    async (request: CallableRequest) => {
        try {
            const context: AuthContext = validateAuth(request);

            const { email } = request.data as { email: string };

            validateEmail(email);

            const attemptRef = getLoginAttemptsRef(context.tenantId, email);
            const doc = await attemptRef.get();

            if (!doc.exists) {
                return { locked: false, attempts: 0, lockedUntil: null };
            }

            const data = doc.data() as LoginAttemptDoc;
            const now = new Date();

            if (data.lockedUntil) {
                const lockExpiry = data.lockedUntil.toDate();
                if (now < lockExpiry) {
                    return {
                        locked: true,
                        attempts: data.attempts,
                        lockedUntil: lockExpiry.toISOString(),
                    };
                }

                // Lock has expired - reset
                await attemptRef.update({
                    attempts: 0,
                    lockedUntil: null,
                });
            }

            return {
                locked: false,
                attempts: data.attempts,
                lockedUntil: null,
            };
        } catch (error) {
            handleError(error);
        }
    }
);
