import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

/**
 * Scheduled function: cleanup truly stale test sessions (24h threshold).
 *
 * Runs hourly. Finds sessions that are:
 * - status === 'in_progress'
 * - createdAt is older than 24 hours
 *
 * These are sessions that were never properly submitted or expired via
 * the deadline-based expiry trigger. They are marked as 'abandoned'.
 *
 * This is distinct from on-test-session-expired.ts which handles
 * deadline-based expiry (serverDeadline + 30s grace).
 */
export const cleanupStaleSessions = onSchedule(
  {
    schedule: "every 1 hours",
    region: "asia-south1",
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = Timestamp.now();

    // 24 hours ago
    const staleThreshold = Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);

    // Query across all tenants using collectionGroup
    const staleSessions = await db
      .collectionGroup("digitalTestSessions")
      .where("status", "==", "in_progress")
      .where("createdAt", "<", staleThreshold)
      .limit(500)
      .get();

    if (staleSessions.empty) {
      logger.info("No stale test sessions (24h) found");
      return;
    }

    logger.info(`Found ${staleSessions.size} stale test sessions (24h+) to mark as abandoned`);

    // Batch update
    const batch = db.batch();
    let count = 0;

    for (const sessionDoc of staleSessions.docs) {
      batch.update(sessionDoc.ref, {
        status: "abandoned",
        endedAt: now,
        autoSubmitted: true,
        abandonedReason: "stale_24h",
        updatedAt: now,
      });
      count++;
    }

    await batch.commit();
    logger.info(`Marked ${count} stale test sessions as abandoned`);
  }
);
