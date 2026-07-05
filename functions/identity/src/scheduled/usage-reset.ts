/**
 * Monthly Usage Counter Reset — Runs on the 1st of each month at 00:00 UTC.
 *
 * Resets monthly counters (examsThisMonth, aiCallsThisMonth) for all
 * active and trial tenants. Processes in batches of 450.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";

const BATCH_SIZE = 450;

export const monthlyUsageReset = onSchedule(
  {
    schedule: "0 0 1 * *", // 1st of every month at 00:00 UTC
    region: "asia-south1",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    let resetCount = 0;

    // Query active and trial tenants
    const tenantsSnap = await db
      .collection("tenants")
      .where("status", "in", ["active", "trial"])
      .get();

    const docs = tenantsSnap.docs;

    // Process in batches
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const doc of chunk) {
        batch.update(doc.ref, {
          "usage.examsThisMonth": 0,
          "usage.aiCallsThisMonth": 0,
          // B8: timestamps at rest are canonical ISO strings.
          "usage.lastUpdated": isoNow(),
          updatedAt: isoNow(),
        });
        resetCount++;
      }

      await batch.commit();
    }

    logger.info(`Monthly usage reset: ${resetCount} tenants reset`);
  }
);
