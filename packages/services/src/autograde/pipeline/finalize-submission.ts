/**
 * `finalizeSubmissionService` — THE ONE place final submission status + summary are
 * computed (autograde.md §"Pipeline"; be-autograde §4 fix: deletes the duplicate in
 * `on-question-submission-updated`). Computes `SubmissionSummary` + grade from the
 * graded question submissions, sets `ready_for_review`, and enqueues the outbox
 * notification. `needs_review` tentative AI scores are EXCLUDED from `totalScore`
 * until confirmed (be-autograde §4 — the score-leak fix).
 */
import { assertTransition } from "@levelup/access";
import { gradeForPercentage } from "@levelup/domain";
import type { SystemContext } from "../../shared/context.js";
import { requireTenant, fail } from "../../shared/context.js";
import { listQuestionSubmissions } from "./questions.js";
import { enqueueOutboxEvent } from "../../shared/side-effects.js";
import { projectSubmissionStatus } from "./grading-projection.js";

export interface FinalizeSubmissionInput {
  submissionId: string;
}

/** Counted toward `totalScore` only when the grade is confirmed (not tentative). */
const CONFIRMED_STATUSES = new Set(["graded", "overridden", "manual"]);

export async function finalizeSubmissionService(
  input: FinalizeSubmissionInput,
  ctx: SystemContext
): Promise<void> {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail("NOT_FOUND", `submission ${input.submissionId} not found`);

  const examId = sub["examId"] as string;
  const exam = await ctx.repos.exams.get(tenantId, examId);
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);

  let totalScore = 0;
  let maxScore = 0;
  let questionsGraded = 0;
  for (const qs of qsubs) {
    const evaluation = qs["evaluation"] as Record<string, unknown> | undefined;
    const override = qs["manualOverride"] as Record<string, unknown> | undefined;
    const status = qs["gradingStatus"] as string;
    const qMax = (evaluation?.["maxScore"] as number | undefined) ?? 0;
    maxScore += qMax;
    if (CONFIRMED_STATUSES.has(status)) {
      const score =
        (override?.["score"] as number | undefined) ??
        (evaluation?.["score"] as number | undefined) ??
        0;
      totalScore += score;
      questionsGraded += 1;
    }
  }

  const totalMarks = (exam?.["totalMarks"] as number | undefined) ?? maxScore;
  const passingMarks = (exam?.["passingMarks"] as number | undefined) ?? 0;
  const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;
  const now = ctx.now();

  const summary = {
    totalScore,
    maxScore: totalMarks,
    percentage,
    grade: gradeForPercentage(percentage),
    questionsGraded,
    totalQuestions: qsubs.length,
    completedAt: now,
    passed: totalScore >= passingMarks,
  };

  const currentStatus = (sub["pipelineStatus"] as string) ?? "grading_complete";
  if (currentStatus === "grading_complete") {
    assertTransition("submission", "grading_complete", "ready_for_review");
  }

  await ctx.repos.tx(async (tx) => {
    tx.upsert("submissions", tenantId, {
      id: input.submissionId,
      summary,
      pipelineStatus: "ready_for_review",
    });
    enqueueOutboxEvent(tx, {
      type: "submission.finalized",
      tenantId,
      payload: { submissionId: input.submissionId, examId },
      createdAt: now,
    });
  });

  // AG-5: project the final `ready_for_review` transition onto the RTDB live ticker
  // (per-submission status + exam aggregate). Slim status only — the `summary`
  // (totalScore/grade/percentage) NEVER rides this channel (release-gate invariant).
  if (currentStatus === "grading_complete") {
    await projectSubmissionStatus(ctx, tenantId, {
      submissionId: input.submissionId,
      examId,
      studentId: sub["studentId"] as string,
      pipelineStatus: "ready_for_review",
    });
  }
}

/**
 * Server-authoritative letter grade from a percentage.
 *
 * Delegates to the canonical domain boundary `gradeForPercentage` (U1.2/B5,
 * `@levelup/domain`) — the ONE place thresholds live. This intentionally diverges
 * from the legacy 7-letter table on the 33–59 range (C+ 50–59, C 40–49, D floor
 * 33; a locked domain decision) and clamps negative/NaN to 'F'. NEVER re-hardcode
 * thresholds here.
 */
export const gradeFor = gradeForPercentage;
