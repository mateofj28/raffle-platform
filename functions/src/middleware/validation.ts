import { z } from "zod";
import { AppError, AppErrorCode } from "../utils/errors.js";

/**
 * Validates request data against a Zod schema.
 * Returns typed data on success, throws AppError with field details on failure.
 */
export function validateData<T extends z.ZodTypeAny>(
    schema: T,
    data: unknown
): z.infer<T> {
    const result = schema.safeParse(data);

    if (!result.success) {
        const fields: Record<string, string> = {};
        for (const issue of result.error.issues) {
            const path = issue.path.join(".");
            fields[path] = issue.message;
        }

        throw new AppError(
            AppErrorCode.VALIDATION_ERROR,
            "Validation failed.",
            fields
        );
    }

    return result.data;
}
