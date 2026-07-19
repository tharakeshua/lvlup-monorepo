/**
 * Admin-RTDB `ExtractionProjectionPort` adapter — the concrete writer behind
 * `ctx.repos.extractionProjections`. Feeds the live `v1.autograde.extractionStatus`
 * subscription:
 *
 *   extractionProgress/{t}/exam/{examId}/status   ← slim status (client-read)
 *
 * Pure SIDE-CHANNEL (authority stays in Firestore): every write is BEST-EFFORT —
 * a failure is logged and swallowed so extraction never fails because the ticker
 * couldn't tick. `setStatus` overwrites the whole node (last-write-wins, resets a
 * stale `failed`); `bumpRubrics` uses a transaction so parallel Pass-2 batches
 * can't lose a tick.
 */
import { getDatabase } from "firebase-admin/database";
import { logger } from "firebase-functions/v2";
import type { ExtractionProjectionPort, ExtractionStatusProjection } from "@levelup/services";

export function createRtdbExtractionProjections(): ExtractionProjectionPort {
  return {
    async setStatus(
      tenantId: string,
      examId: string,
      status: ExtractionStatusProjection
    ): Promise<void> {
      try {
        await getDatabase().ref(`extractionProgress/${tenantId}/exam/${examId}/status`).set(status);
      } catch (e) {
        logger.error(`extractionProjection write failed: setStatus ${tenantId}/${examId}`, e);
      }
    },

    async bumpRubrics(tenantId: string, examId: string, delta: number, now: string): Promise<void> {
      try {
        await getDatabase()
          .ref(`extractionProgress/${tenantId}/exam/${examId}/status`)
          .transaction((current: ExtractionStatusProjection | null) => {
            if (current == null) return current; // status node not created yet — skip
            return {
              ...current,
              rubricsGenerated: (current.rubricsGenerated ?? 0) + delta,
              updatedAt: now,
            };
          });
      } catch (e) {
        logger.error(`extractionProjection write failed: bumpRubrics ${tenantId}/${examId}`, e);
      }
    },
  };
}
