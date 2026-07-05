import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { isoNow, toTimestamp } from "@levelup/domain";

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
    // B8: createdAt is a Timestamp on pre-U3.2 docs and an ISO string after.
    // Firestore range filters only match values of the operand's type, so the
    // two representations need one query each.
    const staleThresholdIso = toTimestamp(staleThreshold);

    // Query across all tenants using collectionGroup
    const baseQuery = db
      .collectionGroup("digitalTestSessions")
      .where("status", "==", "in_progress");
    const [tsSnap, isoSnap] = await Promise.all([
      baseQuery.where("createdAt", "<", staleThreshold).limit(500).get(),
      baseQuery.where("createdAt", "<", staleThresholdIso).limit(500).get(),
    ]);
    const staleDocs = [...tsSnap.docs, ...isoSnap.docs];

    if (staleDocs.length === 0) {
      logger.info("No stale test sessions (24h) found");
      return;
    }

    logger.info(`Found ${staleDocs.length} stale test sessions (24h+) to mark as abandoned`);

    // Batch update
    const batch = db.batch();
    let count = 0;

    for (const sessionDoc of staleDocs) {
      batch.update(sessionDoc.ref, {
        status: "abandoned",
        // U3.5: session timing fields stay Firestore Timestamps at rest.
        endedAt: now,
        autoSubmitted: true,
        abandonedReason: "stale_24h",
        updatedAt: isoNow(),
      });
      count++;
    }

    await batch.commit();
    logger.info(`Marked ${count} stale test sessions as abandoned`);
  }
);
