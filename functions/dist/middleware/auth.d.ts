import { type CallableRequest } from "firebase-functions/v2/https";
export interface AuthContext {
    uid: string;
    tenantId: string;
    role: "admin" | "vendor";
    vendorId?: string;
}
/**
 * Validates authentication and extracts tenant + role from custom claims.
 * Must be called at the start of every callable function.
 */
export declare function validateAuth(request: CallableRequest): AuthContext;
/**
 * Ensures the authenticated user has admin role.
 */
export declare function requireAdmin(context: AuthContext): void;
/**
 * Validates that a vendor is operating on their own data.
 */
export declare function requireVendorOwnership(context: AuthContext, resourceVendorId: string): void;
//# sourceMappingURL=auth.d.ts.map