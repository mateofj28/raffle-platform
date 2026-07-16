import { AppError, AppErrorCode } from "../utils/errors.js";
/**
 * Validates authentication and extracts tenant + role from custom claims.
 * Must be called at the start of every callable function.
 */
export function validateAuth(request) {
    const auth = request.auth;
    if (!auth) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, "Authentication is required.");
    }
    const { tenantId, role, vendorId } = auth.token;
    if (!tenantId || typeof tenantId !== "string") {
        throw new AppError(AppErrorCode.UNAUTHORIZED, "Missing or malformed tenant identifier.");
    }
    if (role !== "admin" && role !== "vendor") {
        throw new AppError(AppErrorCode.UNAUTHORIZED, "Invalid user role.");
    }
    return {
        uid: auth.uid,
        tenantId: tenantId,
        role: role,
        vendorId: typeof vendorId === "string" ? vendorId : undefined,
    };
}
/**
 * Ensures the authenticated user has admin role.
 */
export function requireAdmin(context) {
    if (context.role !== "admin") {
        throw new AppError(AppErrorCode.FORBIDDEN, "Insufficient permissions. Administrator role required.");
    }
}
/**
 * Validates that a vendor is operating on their own data.
 */
export function requireVendorOwnership(context, resourceVendorId) {
    if (context.role === "admin")
        return;
    if (context.vendorId !== resourceVendorId) {
        throw new AppError(AppErrorCode.FORBIDDEN, "You are not authorized to access this resource.");
    }
}
//# sourceMappingURL=auth.js.map