/**
 * Cleanup Scheduled Function - Removes stale export files.
 *
 * Runs daily and deletes export files older than 24 hours from Cloud Storage.
 * Currently a placeholder implementation until Storage bucket is configured.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

/**
 * Cleans up expired export files from Cloud Storage.
 * Runs every 24 hours.
 */
export const cleanupExports = onSchedule("every 24 hours", async () => {
    // Placeholder: actual Storage cleanup depends on the bucket being configured.
    // When ready, this will:
    // 1. List files in `tenants/*/exports/`
    // 2. Delete files older than 24 hours
    logger.info("Export cleanup executed");
});
