import { HttpsError } from "firebase-functions/v2/https";
export var AppErrorCode;
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
})(AppErrorCode || (AppErrorCode = {}));
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
export class AppError extends Error {
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
        return new HttpsError(httpCode, this.message, {
            code: this.code,
            fields: this.fields,
        });
    }
}
export function handleError(error) {
    if (error instanceof AppError) {
        throw error.toHttpsError();
    }
    if (error instanceof HttpsError) {
        throw error;
    }
    console.error("Unexpected error:", error);
    throw new HttpsError("internal", "An unexpected error occurred.");
}
//# sourceMappingURL=errors.js.map