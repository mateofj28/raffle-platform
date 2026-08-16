import { type CallableRequest } from "firebase-functions/v2/https";
import { AppError, AppErrorCode } from "../utils/errors";

export interface AuthContext {
    uid: string;
    tenantId: string;
    role: "admin" | "cashier" | "vendor";
    vendorId?: string;
}

/**
 * Validates authentication and extracts tenant + role from custom claims.
 * Must be called at the start of every callable function.
 */
export function validateAuth(request: CallableRequest): AuthContext {
    const auth = request.auth;

    if (!auth) {
        throw new AppError(
            AppErrorCode.UNAUTHORIZED,
            "Authentication is required."
        );
    }

    const { tenantId, role, vendorId } = auth.token as Record<string, unknown>;

    if (!tenantId || typeof tenantId !== "string") {
        throw new AppError(
            AppErrorCode.UNAUTHORIZED,
            "Missing or malformed tenant identifier."
        );
    }

    if (role !== "admin" && role !== "cashier" && role !== "vendor") {
        throw new AppError(
            AppErrorCode.UNAUTHORIZED,
            "Invalid user role."
        );
    }

    return {
        uid: auth.uid,
        tenantId: tenantId as string,
        role: role as "admin" | "cashier" | "vendor",
        vendorId: typeof vendorId === "string" ? vendorId : undefined,
    };
}

/**
 * Ensures the authenticated user has admin role.
 */
export function requireAdmin(context: AuthContext): void {
    if (context.role !== "admin") {
        throw new AppError(
            AppErrorCode.FORBIDDEN,
            "Insufficient permissions. Administrator role required."
        );
    }
}

/**
 * Ensures the user is admin or cashier (can perform operational tasks).
 */
export function requireAdminOrCashier(context: AuthContext): void {
    if (context.role !== "admin" && context.role !== "cashier") {
        throw new AppError(
            AppErrorCode.FORBIDDEN,
            "Insufficient permissions. Admin or cashier role required."
        );
    }
}

/**
 * Validates that a vendor is operating on their own data.
 */
export function requireVendorOwnership(
    context: AuthContext,
    resourceVendorId: string
): void {
    if (context.role === "admin") return;

    if (context.vendorId !== resourceVendorId) {
        throw new AppError(
            AppErrorCode.FORBIDDEN,
            "You are not authorized to access this resource."
        );
    }
}
