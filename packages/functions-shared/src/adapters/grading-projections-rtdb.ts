/**
 * Admin-RTDB `GradingProjectionPort` adapter (AG-5 seam; FIX-2 composition root).
 * The concrete writer behind `ctx.repos.gradingProjections` — the autograde
 * live-ticker projections the two realtime subscriptions read:
 *
 *   gradingProgress/{t}/submission/{subId}/status          ← slim status (client-read)
 *   gradingProgress/{t}/submission/{subId}/ownerStudentId  ← rules gate
 *   gradingProgress/{t}/exam/{examId}/agg                  ← bounded counts (client-read)
 *   gradingProgress/{t}/exam/{examId}/_index/{subId}       ← server-only phase map
 *
 * The projection is a pure SIDE-CHANNEL (authority stays in Firestore), so every
 * write here is BEST-EFFORT: an RTDB failure is logged and swallowed — grading
 * must never fail because the ticker couldn't tick. Count classification goes
 * through the services-exported `reduceExamCounts` so it can never diverge from
 * the unit-test spy's.
 */
import { getDatabase } from "firebase-admin/database";
import { logger } from "firebase-functions/v2";
import {
  reduceExamCounts,
  type GradingProjectionPort,
  type SubmissionStatusProjection,
} from "@levelup/services";

export function createRtdbGradingProjections(): GradingProjectionPort {
  return {
    async setSubmissionStatus(
      tenantId: string,
      submissionId: string,
      input: { ownerStudentId: string; status: SubmissionStatusProjection }
    ): Promise<void> {
      try {
        // Multipath set on the submission node: slim status child + owner gate.
        await getDatabase()
          .ref(`gradingProgress/${tenantId}/submission/${submissionId}`)
          .update({ status: input.status, ownerStudentId: input.ownerStudentId });
      } catch (e) {
        // Greppable ops marker (Core sign-off requirement): systematic RTDB
        // failures must be spottable in logs even though each is swallowed.
        logger.error(
          `gradingProjection write failed: setSubmissionStatus ${tenantId}/${submissionId}`,
          e
        );
      }
    },

    async recordExamPhase(
      tenantId: string,
      examId: string,
      submissionId: string,
      phase: string,
      now: string
    ): Promise<void> {
      try {
        // Transaction over the exam node: fold the submission's phase into the
        // `_index` map and recompute the bounded `agg` counts atomically.
        await getDatabase()
          .ref(`gradingProgress/${tenantId}/exam/${examId}`)
          .transaction((current: { _index?: Record<string, string> } | null) => {
            const node = current ?? {};
            const index = { ...(node._index ?? {}), [submissionId]: phase };
            return { ...node, _index: index, agg: reduceExamCounts(examId, index, now) };
          });
      } catch (e) {
        logger.error(
          `gradingProjection write failed: recordExamPhase ${tenantId}/${examId}/${submissionId}`,
          e
        );
      }
    },
  };
}
