"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuth = validateAuth;
exports.requireAdmin = requireAdmin;
exports.requireAdminOrCashier = requireAdminOrCashier;
exports.requireVendorOwnership = requireVendorOwnership;
const errors_1 = require("../utils/errors");
/**
 * Validates authentication and extracts tenant + role from custom claims.
 * Must be called at the start of every callable function.
 */
function validateAuth(request) {
    const auth = request.auth;
    if (!auth) {
        throw new errors_1.AppError(errors_1.AppErrorCode.UNAUTHORIZED, "Se requiere autenticación.");
    }
    const { tenantId, role, vendorId } = auth.token;
    if (!tenantId || typeof tenantId !== "string") {
        throw new errors_1.AppError(errors_1.AppErrorCode.UNAUTHORIZED, "Identificador de organización ausente o inválido.");
    }
    if (role !== "admin" && role !== "cashier" && role !== "vendor") {
        throw new errors_1.AppError(errors_1.AppErrorCode.UNAUTHORIZED, "Rol de usuario inválido.");
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
        throw new errors_1.AppError(errors_1.AppErrorCode.FORBIDDEN, "Permisos insuficientes. Se requiere rol de administrador.");
    }
}
/**
 * Ensures the user is admin or cashier (can perform operational tasks).
 */
function requireAdminOrCashier(context) {
    if (context.role !== "admin" && context.role !== "cashier") {
        throw new errors_1.AppError(errors_1.AppErrorCode.FORBIDDEN, "Permisos insuficientes. Se requiere rol de administrador o cajero.");
    }
}
/**
 * Validates that a vendor is operating on their own data.
 */
function requireVendorOwnership(context, resourceVendorId) {
    if (context.role === "admin")
        return;
    if (context.vendorId !== resourceVendorId) {
        throw new errors_1.AppError(errors_1.AppErrorCode.FORBIDDEN, "No tienes autorización para acceder a este recurso.");
    }
}
//# sourceMappingURL=auth.js.map