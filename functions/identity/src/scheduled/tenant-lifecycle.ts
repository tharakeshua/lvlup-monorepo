/**
 * Tenant Lifecycle Automation — Daily trial expiry check.
 *
 * Runs daily at 00:00 UTC:
 * 1. Transitions trial tenants past expiresAt → expired
 * 2. Flags long-expired tenants (>30 days, no activity) for admin review
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { isoNow, toMillis, toTimestamp } from "@levelup/domain";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const tenantLifecycleCheck = onSchedule(
  {
    schedule: "every day 00:00",
    region: "asia-south1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    // B8: timestamps at rest are canonical ISO strings; compare in epoch millis.
    const nowMs = Date.now();
    let expiredCount = 0;
    let flaggedCount = 0;

    // ── Step 1: Expire trial tenants past their subscription expiry ──
    const trialSnap = await db.collection("tenants").where("status", "==", "trial").get();

    for (const doc of trialSnap.docs) {
      const data = doc.data();
      const expiresAt = data.subscription?.expiresAt ?? data.trialEndsAt;
      if (!expiresAt) continue;

      // B8 read: a legacy doc field may be a Firestore Timestamp OR an ISO string —
      // collapse both shapes through the domain edge adapter.
      const expiryMs = toMillis(toTimestamp(expiresAt));
      if (expiryMs > nowMs) continue;

      // Transition to expired
      await doc.ref.update({
        status: "expired",
        updatedAt: isoNow(),
      });

      // Write audit log
      await db.collection(`tenants/${doc.id}/auditLog`).add({
        action: "trial_expired",
        tenantId: doc.id,
        actorId: "system",
        details: {
          previousStatus: "trial",
          expiresAt: toTimestamp(expiresAt),
        },
        createdAt: isoNow(),
      });

      expiredCount++;
    }

    // ── Step 2: Flag long-expired tenants for admin review ──
    const expiredSnap = await db.collection("tenants").where("status", "==", "expired").get();

    for (const doc of expiredSnap.docs) {
      const data = doc.data();
      const expiresAt = data.subscription?.expiresAt ?? data.trialEndsAt;
      if (!expiresAt) continue;

      // B8 read: collapse Firestore-Timestamp-or-ISO through the domain edge adapter.
      const expiryMs = toMillis(toTimestamp(expiresAt));
      const daysSinceExpiry = nowMs - expiryMs;

      if (daysSinceExpiry < THIRTY_DAYS_MS) continue;

      // Check for recent activity (updated in last 30 days)
      const updatedAtMs = data.updatedAt ? toMillis(toTimestamp(data.updatedAt)) : null;
      if (updatedAtMs !== null && nowMs - updatedAtMs < THIRTY_DAYS_MS) {
        continue; // Has recent activity, skip
      }

      // Flag for admin review via platformActivityLog
      await db.collection("platformActivityLog").add({
        action: "tenant_review_needed",
        actorId: "system",
        tenantId: doc.id,
        metadata: {
          tenantName: data.name,
          status: "expired",
          expiredSince: toTimestamp(expiresAt),
          daysSinceExpiry: Math.floor(daysSinceExpiry / (24 * 60 * 60 * 1000)),
        },
        createdAt: isoNow(),
      });

      flaggedCount++;
    }

    logger.info(
      `Tenant lifecycle check: ${expiredCount} trials expired, ${flaggedCount} flagged for review`
    );
  }
);
