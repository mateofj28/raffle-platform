import { z } from "zod";
/**
 * Validates request data against a Zod schema.
 * Returns typed data on success, throws AppError with field details on failure.
 */
export declare function validateData<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T>;
//# sourceMappingURL=validation.d.ts.map