import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Simple rate limiter using Firestore.
 * Tracks calls per user per action type within a sliding window.
 */
export async function enforceRateLimit(
  tenantId: string,
  userId: string,
  actionType: string,
  maxPerMinute: number
): Promise<void> {
  const db = admin.firestore();
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const docId = `${userId}_${actionType}`;
  const ref = db.doc(`tenants/${tenantId}/rateLimits/${docId}`);

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data();

    if (data) {
      // Filter to only timestamps within the window
      const timestamps: number[] = (data.timestamps || []).filter(
        (t: number) => now - t < windowMs
      );

      if (timestamps.length >= maxPerMinute) {
        throw new HttpsError(
          "resource-exhausted",
          `Rate limit exceeded: max ${maxPerMinute} ${actionType} requests per minute`
        );
      }

      timestamps.push(now);
      tx.update(ref, { timestamps, updatedAt: FieldValue.serverTimestamp() });
    } else {
      tx.set(ref, {
        userId,
        actionType,
        timestamps: [now],
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
}
