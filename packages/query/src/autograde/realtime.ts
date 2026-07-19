/**
 * autograde realtime hooks (domain plan §Realtime hooks).
 *
 * Thin binds over the generic `useSubscription` cache-write seam (§11). Each
 * writes its channel payload into the SAME cache key the REST read populates
 * (via `SUBSCRIPTION_TARGET_KEYS`), so the live grading ticker reconciles into
 * the cache the grading-review screens already read (server wins):
 *
 *   useGradingStatus(submissionId)   → v1.autograde.gradingStatus → submission detail
 *   useExamGradingProgress(examId)   → v1.autograde.examGrading   → exam grading sub-key
 */
import { useSubscription, type UseSubscriptionResult } from "../realtime/useSubscription.js";

/** Live per-submission pipeline progress (drives the grading-review progress bar). */
export function useGradingStatus(submissionId: string): UseSubscriptionResult {
  return useSubscription("v1.autograde.gradingStatus", {
    submissionId: submissionId as never,
  });
}

/** Aggregate live grading progress for an exam (drives the exam dashboard counts). */
export function useExamGradingProgress(examId: string): UseSubscriptionResult {
  return useSubscription("v1.autograde.examGrading", {
    examId: examId as never,
  });
}

/**
 * Live question-extraction + rubric-generation progress for an exam. The optional
 * `onPayload` runs on every phase/counter tick — the ExamDetailPage uses it to
 * refetch the authoritative (role-filtered) questions from `listQuestions` as the
 * pipeline advances (⚷ content never rides the RTDB channel). When `onPayload` is
 * omitted the slim payload is written to `examKeys.sub(examId,"extraction")`.
 */
export function useExtractionProgress(
  examId: string,
  onPayload?: Parameters<typeof useSubscription>[2]
): UseSubscriptionResult {
  return useSubscription("v1.autograde.extractionStatus", { examId: examId as never }, onPayload);
}
