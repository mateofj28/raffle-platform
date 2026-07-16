import { HttpsError, type FunctionsErrorCode } from "firebase-functions/v2/https";

export enum AppErrorCode {
    UNAUTHORIZED = "unauthorized",
    FORBIDDEN = "forbidden",
    NOT_FOUND = "not-found",
    CONFLICT = "conflict",
    VALIDATION_ERROR = "validation-error",
    INVALID_TRANSITION = "invalid-transition",
    PAYMENT_EXCEEDS_BALANCE = "payment-exceeds-balance",
    ALREADY_REVERSED = "already-reversed",
    EXPORT_LIMIT_EXCEEDED = "export-limit-exceeded",
}

const ERROR_CODE_TO_HTTPS: Record<AppErrorCode, FunctionsErrorCode> = {
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
    public readonly code: AppErrorCode;
    public readonly fields?: Record<string, string>;

    constructor(
        code: AppErrorCode,
        message: string,
        fields?: Record<string, string>
    ) {
        super(message);
        this.code = code;
        this.fields = fields;
        this.name = "AppError";
    }

    toHttpsError(): HttpsError {
        const httpCode = ERROR_CODE_TO_HTTPS[this.code];
        return new HttpsError(httpCode, this.message, {
            code: this.code,
            fields: this.fields,
        });
    }
}

export function handleError(error: unknown): never {
    if (error instanceof AppError) {
        throw error.toHttpsError();
    }
    if (error instanceof HttpsError) {
        throw error;
    }
    console.error("Unexpected error:", error);
    throw new HttpsError("internal", "An unexpected error occurred.");
}
