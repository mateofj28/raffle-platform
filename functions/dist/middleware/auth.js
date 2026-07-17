"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuth = validateAuth;
exports.requireAdmin = requireAdmin;
exports.requireVendorOwnership = requireVendorOwnership;
const errors_1 = require("../utils/errors");
/**
 * Validates authentication and extracts tenant + role from custom claims.
 * Must be called at the start of every callable function.
 */
function validateAuth(request) {
    const auth = request.auth;
    if (!auth) {
        throw new errors_1.AppError(errors_1.AppErrorCode.UNAUTHORIZED, "Authentication is required.");
    }
    const { tenantId, role, vendorId } = auth.token;
    if (!tenantId || typeof tenantId !== "string") {
        throw new errors_1.AppError(errors_1.AppErrorCode.UNAUTHORIZED, "Missing or malformed tenant identifier.");
    }
    if (role !== "admin" && role !== "vendor") {
        throw new errors_1.AppError(errors_1.AppErrorCode.UNAUTHORIZED, "Invalid user role.");
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
function requireAdmin(context) {
    if (context.role !== "admin") {
        throw new errors_1.AppError(errors_1.AppErrorCode.FORBIDDEN, "Insufficient permissions. Administrator role required.");
    }
}
/**
 * Validates that a vendor is operating on their own data.
 */
function requireVendorOwnership(context, resourceVendorId) {
    if (context.role === "admin")
        return;
    if (context.vendorId !== resourceVendorId) {
        throw new errors_1.AppError(errors_1.AppErrorCode.FORBIDDEN, "You are not authorized to access this resource.");
    }
}
//# sourceMappingURL=auth.js.map