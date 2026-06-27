/**
 * Stale Submission Watchdog — Detects submissions stuck in processing states.
 *
 * Runs every 15 minutes. Finds submissions in 'scouting' or 'grading' status
 * for > 10 minutes and either retries them or escalates to manual review.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const MAX_WATCHDOG_RETRIES = 3;
const STALE_STATUSES = ["scouting", "grading"] as const;

export const staleSubmissionWatchdog = onSchedule(
  {
    schedule: "every 15 minutes",
    region: "asia-south1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const staleThreshold = new Date(now - STALE_THRESHOLD_MS);

    // Query all tenants
    const tenantsSnap = await db.collection("tenants").get();
    let totalStale = 0;
    let totalRetried = 0;
    let totalEscalated = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;

      for (const status of STALE_STATUSES) {
        const staleSnap = await db
          .collection(`tenants/${tenantId}/submissions`)
          .where("pipelineStatus", "==", status)
          .where("updatedAt", "<", Timestamp.fromDate(staleThreshold))
          .limit(50)
          .get();

        for (const subDoc of staleSnap.docs) {
          totalStale++;
          const subData = subDoc.data();
          const retryCount = (subData.watchdogRetryCount ?? 0) + 1;

          if (retryCount > MAX_WATCHDOG_RETRIES) {
            // Escalate to manual review
            await subDoc.ref.update({
              pipelineStatus: "manual_review_needed",
              pipelineError: `Submission stuck in '${status}' state. Watchdog retry limit exceeded (${MAX_WATCHDOG_RETRIES} attempts).`,
              watchdogRetryCount: retryCount,
              updatedAt: FieldValue.serverTimestamp(),
            });
            totalEscalated++;
            console.warn(
              `[watchdog] Escalated ${subDoc.id} in tenant ${tenantId}: stuck in '${status}' for too long (${retryCount} retries).`
            );
          } else {
            // Retry: reset to previous stage trigger
            const resetStatus = status === "grading" ? "scouting_complete" : "uploaded";
            await subDoc.ref.update({
              pipelineStatus: resetStatus,
              watchdogRetryCount: retryCount,
              pipelineError: null,
              updatedAt: FieldValue.serverTimestamp(),
            });
            totalRetried++;
            console.log(
              `[watchdog] Retried ${subDoc.id} in tenant ${tenantId}: reset from '${status}' to '${resetStatus}' (attempt ${retryCount}).`
            );
          }
        }
      }
    }

    if (totalStale > 0) {
      console.log(
        `[watchdog] Processed ${totalStale} stale submissions: ${totalRetried} retried, ${totalEscalated} escalated.`
      );
    }
  }
);
