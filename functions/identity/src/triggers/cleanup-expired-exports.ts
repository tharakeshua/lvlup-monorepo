import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

/**
 * Scheduled trigger: runs every 30 minutes to delete expired credential export files.
 * Files are tagged with `deleteAfter` metadata during bulk import.
 */
export const cleanupExpiredExports = onSchedule(
  {
    schedule: "every 30 minutes",
    region: "asia-south1",
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: "exports/" });

    const now = new Date();
    let deletedCount = 0;

    for (const file of files) {
      const deleteAfter = file.metadata?.metadata?.deleteAfter;
      if (!deleteAfter || typeof deleteAfter !== "string") continue;

      const expiresAt = new Date(deleteAfter);
      if (isNaN(expiresAt.getTime())) continue;

      if (now >= expiresAt) {
        try {
          await file.delete();
          deletedCount++;
          logger.info(`Deleted expired export file: ${file.name}`);
        } catch (err) {
          logger.warn(`Failed to delete expired export file: ${file.name}`, err);
        }
      }
    }

    logger.info(
      `Cleanup complete: ${deletedCount} expired files deleted out of ${files.length} total`
    );
  }
);
