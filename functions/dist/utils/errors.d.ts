import { HttpsError } from "firebase-functions/v2/https";
export declare enum AppErrorCode {
    UNAUTHORIZED = "unauthorized",
    FORBIDDEN = "forbidden",
    NOT_FOUND = "not-found",
    CONFLICT = "conflict",
    VALIDATION_ERROR = "validation-error",
    INVALID_TRANSITION = "invalid-transition",
    PAYMENT_EXCEEDS_BALANCE = "payment-exceeds-balance",
    ALREADY_REVERSED = "already-reversed",
    EXPORT_LIMIT_EXCEEDED = "export-limit-exceeded"
}
export declare class AppError extends Error {
    readonly code: AppErrorCode;
    readonly fields?: Record<string, string>;
    constructor(code: AppErrorCode, message: string, fields?: Record<string, string>);
    toHttpsError(): HttpsError;
}
export declare function handleError(error: unknown): never;
