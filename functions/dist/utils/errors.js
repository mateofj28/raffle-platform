"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.AppErrorCode = void 0;
exports.handleError = handleError;
const https_1 = require("firebase-functions/v2/https");
var AppErrorCode;
(function (AppErrorCode) {
    AppErrorCode["UNAUTHORIZED"] = "unauthorized";
    AppErrorCode["FORBIDDEN"] = "forbidden";
    AppErrorCode["NOT_FOUND"] = "not-found";
    AppErrorCode["CONFLICT"] = "conflict";
    AppErrorCode["VALIDATION_ERROR"] = "validation-error";
    AppErrorCode["INVALID_TRANSITION"] = "invalid-transition";
    AppErrorCode["PAYMENT_EXCEEDS_BALANCE"] = "payment-exceeds-balance";
    AppErrorCode["ALREADY_REVERSED"] = "already-reversed";
    AppErrorCode["EXPORT_LIMIT_EXCEEDED"] = "export-limit-exceeded";
})(AppErrorCode || (exports.AppErrorCode = AppErrorCode = {}));
const ERROR_CODE_TO_HTTPS = {
    [AppErrorCode.UNAUTHORIZED]: "unauthenticated",
    [AppErrorCode.FORBIDDEN]: "permission-denied",
    [AppErrorCode.NOT_FOUND]: "not-found",
    [AppErrorCode.CONFLICT]: "already-exists",
    [AppErrorCode.VALIDATION_ERROR]: "invalid-argument",
    [AppErrorCode.INVALID_TRANSITION]: "failed-precondition",
    [AppErrorCode.PAYMENT_EXCEEDS_BALANCE]: "invalid-argument",
    [AppErrorCode.ALREADY_REVERSED]: "failed-precondition",
    [AppErrorCode.EXPORT_LIMIT_EXCEEDED]: "resource-exhausted",
};
class AppError extends Error {
    code;
    fields;
    constructor(code, message, fields) {
        super(message);
        this.code = code;
        this.fields = fields;
        this.name = "AppError";
    }
    toHttpsError() {
        const httpCode = ERROR_CODE_TO_HTTPS[this.code];
        return new https_1.HttpsError(httpCode, this.message, {
            code: this.code,
            fields: this.fields,
        });
    }
}
exports.AppError = AppError;
function handleError(error) {
    if (error instanceof AppError) {
        throw error.toHttpsError();
    }
    if (error instanceof https_1.HttpsError) {
        throw error;
    }
    console.error("Unexpected error:", error);
    throw new https_1.HttpsError("internal", "An unexpected error occurred.");
}
//# sourceMappingURL=errors.js.map