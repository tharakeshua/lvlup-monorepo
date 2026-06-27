/**
 * `gradeQuestionService` (autograde.md §"Command services"). Dispatched by `mode`:
 *   - `manual`: writes a `ManualOverride` (score + reason) + recomputes the
 *     `SubmissionSummary` (single writer). Score authority ⚷.
 *   - `retry`:  resets failed QuestionSubmissions → pending + submission → grading
 *     and re-drives the pipeline.
 *   - `ai`:     runs the AI grading pipeline for one question.
 * `tenantId` from ctx. The client NEVER writes its own score.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { listQuestionSubmissions } from "./pipeline/questions.js";
import { processAnswerGradingService } from "./pipeline/process-answer-grading.js";
import { finalizeSubmissionService } from "./pipeline/finalize-submission.js";
import { enqueuePipelineAdvance } from "./pipeline/advance-pipeline.js";

type Req = ReqOf<"v1.autograde.gradeQuestion">;
type Res = ResOf<"v1.autograde.gradeQuestion">;

export async function gradeQuestionService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);

  switch (input.mode) {
    case "manual":
      authorize(ctx, "grade.manual", { submissionId: input.submissionId, tenantId });
      return manualGrade(input, ctx, tenantId);
    case "retry":
      authorize(ctx, "grade.retry", { submissionId: input.submissionId, tenantId });
      return retryGrade(input, ctx, tenantId);
    case "ai":
      authorize(ctx, "grade.ai", { submissionId: input.submissionId, tenantId });
      return aiGrade(input, ctx, tenantId);
    default:
      return fail("INVALID_ARGUMENT", "unknown gradeQuestion mode");
  }
}

async function manualGrade(
  input: Extract<Req, { mode: "manual" }>,
  ctx: AuthContext,
  tenantId: string
): Promise<Res> {
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const qsub = qsubs.find((q) => q["questionId"] === input.questionId);
  if (!qsub) fail("NOT_FOUND", `question submission for ${input.questionId} not found`);

  const now = ctx.now();
  const prevEval = qsub["evaluation"] as Record<string, unknown> | undefined;
  const originalScore = (prevEval?.["score"] as number | undefined) ?? 0;

  await ctx.repos.submissions.upsert(
    tenantId,
    {
      id: qsub["id"],
      manualOverride: {
        score: input.score,
        reason: input.feedback ?? "",
        overriddenBy: ctx.uid,
        overriddenAt: now,
        originalScore,
      },
      gradingStatus: "overridden",
      _kind: "questionSubmission",
    },
    now
  );

  // Recompute the submission summary (single writer) via finalize.
  await finalizeSubmissionService({ submissionId: input.submissionId }, ctx);

  return { success: true, updatedScore: input.score, gradingStatus: "overridden" } as Res;
}

async function retryGrade(
  input: Extract<Req, { mode: "retry" }>,
  ctx: AuthContext,
  tenantId: string
): Promise<Res> {
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const questionIds = input.questionIds as string[] | undefined;
  const targets = questionIds
    ? qsubs.filter((q) => questionIds.includes(q["questionId"] as string))
    : qsubs.filter((q) => q["gradingStatus"] === "failed");

  const now = ctx.now();
  let retriedCount = 0;
  for (const q of targets) {
    await ctx.repos.submissions.upsert(
      tenantId,
      { id: q["id"], gradingStatus: "pending", gradingError: null, _kind: "questionSubmission" },
      now
    );
    retriedCount += 1;
  }

  // submission grading_partial → grading, then re-drive.
  await ctx.repos.submissions.upsert(
    tenantId,
    { id: input.submissionId, pipelineStatus: "grading" },
    now
  );
  await enqueuePipelineAdvance(ctx, input.submissionId, "grading");

  return { success: true, retriedCount, gradingStatus: "processing" } as Res;
}

async function aiGrade(
  input: Extract<Req, { mode: "ai" }>,
  ctx: AuthContext,
  tenantId: string
): Promise<Res> {
  const result = await processAnswerGradingService(
    { submissionId: input.submissionId, questionIds: [input.questionId] },
    ctx
  );
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const qsub = qsubs.find((q) => q["questionId"] === input.questionId);
  const evaluation = qsub?.["evaluation"] as Record<string, unknown> | undefined;
  return {
    success: result.failedCount === 0,
    updatedScore: evaluation?.["score"] as number | undefined,
    gradingStatus: qsub?.["gradingStatus"] as Res["gradingStatus"],
  } as Res;
}
