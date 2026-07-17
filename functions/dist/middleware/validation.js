"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateData = validateData;
const errors_1 = require("../utils/errors");
/**
 * Validates request data against a Zod schema.
 * Returns typed data on success, throws AppError with field details on failure.
 */
function validateData(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const fields = {};
        for (const issue of result.error.issues) {
            const path = issue.path.join(".");
            fields[path] = issue.message;
        }
        throw new errors_1.AppError(errors_1.AppErrorCode.VALIDATION_ERROR, "Validation failed.", fields);
    }
    return result.data;
}
//# sourceMappingURL=validation.js.map