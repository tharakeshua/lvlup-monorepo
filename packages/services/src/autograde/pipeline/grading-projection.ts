/**
 * `grading-projection` — AG-5: the ONLY writer of the autograde live-ticker RTDB
 * projections (DATA-MODEL-FIX-PLAN.md §10 AD-12; SDK-LAYERS-PLAN §3.3 gradingStatus
 * / examGrading rows).
 *
 * The two autograde realtime subscriptions read SLIM, SERVER-MAINTAINED projections
 * (`v1.autograde.gradingStatus` per submission, `v1.autograde.examGrading` per exam)
 * from RTDB — never Firestore, never a fat authoritative doc. This module projects
 * the MINIMAL progress state on each pipeline transition:
 *
 *   • per-submission `status` = `{ pipelineStatus, gradingProgress?, updatedAt }`
 *     (exactly the `SubmissionStatusSchema` slim payload — NO summary / totalScore /
 *     grade / percentage / answer-key / rubric guidance; the release-gate invariant).
 *   • per-exam `agg` = `{ examId, totalSubmissions, gradedSubmissions,
 *     failedSubmissions, pendingSubmissions, phase?, updatedAt }` (the
 *     `ExamGradingProgressSchema` slim payload — bounded counts only, O(1) per tick).
 *
 * **Seam (FIX-2 owns the composition root).** The producers reach the RTDB writer as
 * an OPTIONAL port on `ctx.repos` (`gradingProjections`). The port INTERFACE is
 * declared here (services-local); FIX-2 wires the concrete Admin-RTDB adapter into
 * `functions-shared`/bootstrap so `ctx.repos.gradingProjections` is present at
 * runtime. Until then (and in any ctx that omits it) every projection call
 * DEGRADES GRACEFULLY to a no-op — the pipeline never fails because the ticker
 * isn't wired. The projection is a pure SIDE-CHANNEL: authority stays in Firestore.
 *
 * **Idempotency.** `setSubmissionStatus` is a last-write-wins overwrite (same
 * transition → same node). `recordExamPhase` is a read-modify-write over the exam
 * `_index` (submissionId → phase) map, so re-applying the same `(submissionId,
 * phase)` yields an identical aggregate. `bucketForPhase` is the single source of
 * truth for count classification (the adapter imports it for its transaction).
 */
import type { SystemContext } from "../../shared/context.js";

/** The slim per-submission status projection — mirrors `SubmissionStatusSchema`. */
export interface SubmissionStatusProjection {
  pipelineStatus: string;
  gradingProgress?: { graded: number; total: number; batchIndex?: number };
  updatedAt: string;
}

/** The slim per-exam aggregate projection — mirrors `ExamGradingProgressSchema`. */
export interface ExamGradingAggregate {
  examId: string;
  totalSubmissions: number;
  gradedSubmissions: number;
  failedSubmissions: number;
  pendingSubmissions: number;
  phase?: string;
  updatedAt: string;
}

/**
 * The RTDB projection writer port. FIX-2 supplies the concrete Admin-RTDB adapter
 * on `ctx.repos.gradingProjections`; the shapes here are the injection contract.
 *
 * Node layout the adapter MUST honor (so the flipped subscription-sources node
 * paths resolve):
 *   • `gradingProgress/{t}/submission/{submissionId}/status`         ← client-read
 *   • `gradingProgress/{t}/submission/{submissionId}/ownerStudentId` ← rules gate
 *   • `gradingProgress/{t}/exam/{examId}/agg`                        ← client-read
 *   • `gradingProgress/{t}/exam/{examId}/_index/{submissionId}`      ← server-only
 */
export interface GradingProjectionPort {
  /**
   * Overwrite the per-submission live status projection (idempotent set). Writes the
   * slim `status` child + the `ownerStudentId` sibling gate (used by RTDB read rules
   * to grant the owning student — and only that student — read of their own status).
   */
  setSubmissionStatus(
    tenantId: string,
    submissionId: string,
    input: { ownerStudentId: string; status: SubmissionStatusProjection }
  ): Promise<void>;
  /**
   * Record a submission's current phase into the exam aggregate and recompute the
   * bounded counts (idempotent, O(1)-per-tick over the exam `_index` map — never a
   * cross-submission fan-in query). The adapter classifies each phase via the
   * exported `bucketForPhase`.
   */
  recordExamPhase(
    tenantId: string,
    examId: string,
    submissionId: string,
    phase: string,
    now: string
  ): Promise<void>;
}

/** Minimal shape we cast `ctx.repos` to for the optional projection port. */
interface WithGradingProjections {
  gradingProjections?: GradingProjectionPort;
}

/** The optional port, or `null` when the composition root hasn't wired it. */
function port(ctx: SystemContext): GradingProjectionPort | null {
  return (ctx.repos as unknown as WithGradingProjections).gradingProjections ?? null;
}

/** Aggregate bucket a pipeline phase counts toward (single source of truth). */
export type ExamBucket = "graded" | "failed" | "pending";

/** Terminal-graded phases (a submission whose grading is done / under review). */
const GRADED_PHASES = new Set(["grading_complete", "ready_for_review", "reviewed"]);
/** Failure / dead-end phases (needs a human or gave up). */
const FAILED_PHASES = new Set([
  "scouting_failed",
  "grading_failed",
  "finalization_failed",
  "failed",
  "manual_review_needed",
]);

/** Classify a submission pipeline phase into its exam-aggregate bucket. */
export function bucketForPhase(phase: string): ExamBucket {
  if (GRADED_PHASES.has(phase)) return "graded";
  if (FAILED_PHASES.has(phase)) return "failed";
  return "pending"; // uploaded / scouting / scouting_complete / grading / grading_partial
}

/**
 * Recompute the bounded exam counts from an `_index` (submissionId → phase) map.
 * Pure — the concrete adapter and the unit-test spy both derive counts through this
 * so the classification can never silently diverge.
 */
export function reduceExamCounts(
  examId: string,
  index: Record<string, string>,
  now: string
): ExamGradingAggregate {
  let graded = 0;
  let failed = 0;
  let pending = 0;
  let latestPending: string | undefined;
  for (const phase of Object.values(index)) {
    switch (bucketForPhase(phase)) {
      case "graded":
        graded += 1;
        break;
      case "failed":
        failed += 1;
        break;
      default:
        pending += 1;
        latestPending = phase;
    }
  }
  const total = graded + failed + pending;
  return {
    examId,
    totalSubmissions: total,
    gradedSubmissions: graded,
    failedSubmissions: failed,
    pendingSubmissions: pending,
    // Coarse exam-wide phase: still-working while any submission is pending, else a
    // terminal phase. Kept optional (a hint for the teacher ticker, not authority).
    phase: pending > 0 ? (latestPending ?? "grading") : failed > 0 ? "grading_partial" : "reviewed",
    updatedAt: now,
  };
}

/**
 * Project a submission's live status + bump its exam aggregate. Called at each
 * pipeline transition (the reducer's `setPipelineStatus`, the grading batch loop,
 * and finalize). No-op when the port isn't wired.
 *
 * `studentId` is the submission's OWNER (the RTDB rules gate). `gradingProgress` is
 * the optional `{ graded, total, batchIndex? }` counter the grading step emits.
 */
export async function projectSubmissionStatus(
  ctx: SystemContext,
  tenantId: string,
  submission: {
    submissionId: string;
    examId: string;
    studentId: string;
    pipelineStatus: string;
    gradingProgress?: { graded: number; total: number; batchIndex?: number };
  }
): Promise<void> {
  const p = port(ctx);
  if (!p) return; // ticker not wired (FIX-2 injection pending) — pipeline is unaffected
  const now = ctx.now();
  const status: SubmissionStatusProjection = {
    pipelineStatus: submission.pipelineStatus,
    updatedAt: now,
  };
  if (submission.gradingProgress) status.gradingProgress = submission.gradingProgress;
  await p.setSubmissionStatus(tenantId, submission.submissionId, {
    ownerStudentId: submission.studentId,
    status,
  });
  await p.recordExamPhase(
    tenantId,
    submission.examId,
    submission.submissionId,
    submission.pipelineStatus,
    now
  );
}
