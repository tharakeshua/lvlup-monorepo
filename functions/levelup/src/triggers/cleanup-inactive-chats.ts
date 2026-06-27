import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

/**
 * Scheduled function: deactivate inactive chat sessions (7-day threshold).
 *
 * Runs daily at 3:00 AM UTC. Finds chat sessions that are:
 * - isActive === true
 * - updatedAt is older than 7 days
 *
 * These sessions are deactivated (isActive = false) to reduce
 * query overhead and signal to the frontend that the session is stale.
 * The data is preserved for reference but won't appear in active session lists.
 */
export const cleanupInactiveChats = onSchedule(
  {
    schedule: "every day 03:00",
    region: "asia-south1",
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = Timestamp.now();

    // 7 days ago
    const inactiveThreshold = Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);

    // Query across all tenants using collectionGroup
    const inactiveSessions = await db
      .collectionGroup("chatSessions")
      .where("isActive", "==", true)
      .where("updatedAt", "<", inactiveThreshold)
      .limit(500)
      .get();

    if (inactiveSessions.empty) {
      logger.info("No inactive chat sessions (7d) found");
      return;
    }

    logger.info(`Found ${inactiveSessions.size} inactive chat sessions (7d+) to deactivate`);

    // Process in batches of 450 (Firestore batch limit)
    const docs = inactiveSessions.docs;
    let totalDeactivated = 0;

    for (let i = 0; i < docs.length; i += 450) {
      const chunk = docs.slice(i, i + 450);
      const batch = db.batch();

      for (const sessionDoc of chunk) {
        batch.update(sessionDoc.ref, {
          isActive: false,
          deactivatedAt: now,
          deactivatedReason: "inactive_7d",
          updatedAt: now,
        });
      }

      await batch.commit();
      totalDeactivated += chunk.length;
    }

    logger.info(`Deactivated ${totalDeactivated} inactive chat sessions`);
  }
);
