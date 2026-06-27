/**
 * `processAnswerGradingService` — RELMS per-question scoring (autograde.md
 * §"Pipeline"). Resolves the rubric chain, grades each pending QuestionSubmission
 * via `ctx.ai` (cost rolled up in the gateway), routes by confidence to HITL
 * (`needs_review`), and DLQ's on failure. Score authority is ⚷ — only this service
 * (and `gradeQuestion(manual)`) writes a `QuestionSubmission` score. Returns
 * `{ allGraded }` so the reducer picks `grading_complete` vs `grading_partial`.
 */
import type { SystemContext } from "../../shared/context.js";
import { requireTenant, fail } from "../../shared/context.js";
import { listExamQuestions, listQuestionSubmissions } from "./questions.js";
import { resolveRubricService } from "./resolve-rubric.js";

export interface ProcessAnswerGradingInput {
  submissionId: string;
  /** Optional subset (retry path); default = all pending. */
  questionIds?: string[];
}

export interface ProcessAnswerGradingResult {
  allGraded: boolean;
  gradedCount: number;
  needsReviewCount: number;
  failedCount: number;
}

interface AiGradeJson {
  score?: number;
  maxScore?: number;
  confidence?: number;
  feedback?: unknown;
  breakdown?: unknown;
}

export async function processAnswerGradingService(
  input: ProcessAnswerGradingInput,
  ctx: SystemContext
): Promise<ProcessAnswerGradingResult> {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail("NOT_FOUND", `submission ${input.submissionId} not found`);
  const examId = sub["examId"] as string;
  const exam = await ctx.repos.exams.get(tenantId, examId);
  if (!exam) fail("NOT_FOUND", `exam ${examId} not found`);

  const questionsById = new Map(
    (await listExamQuestions(ctx, tenantId, examId)).map((q) => [q["id"] as string, q])
  );
  const qsubs = await listQuestionSubmissions(ctx, tenantId, input.submissionId);
  const targetSet = input.questionIds ? new Set(input.questionIds) : null;

  let gradedCount = 0;
  let needsReviewCount = 0;
  let failedCount = 0;
  let batchIndex = 0;

  for (const qsub of qsubs) {
    const status = qsub["gradingStatus"] as string;
    const questionId = qsub["questionId"] as string;
    if (targetSet && !targetSet.has(questionId)) continue;
    if (status !== "pending" && status !== "failed") {
      if (status === "graded" || status === "overridden" || status === "manual") gradedCount += 1;
      if (status === "needs_review") needsReviewCount += 1;
      continue;
    }

    const question = questionsById.get(questionId);
    if (!question) {
      failedCount += 1;
      continue;
    }
    const { rubric, confidenceConfig } = await resolveRubricService(ctx, tenantId, exam, question);
    const now = ctx.now();

    try {
      await markQuestionStatus(ctx, tenantId, qsub, "pending", "processing");
      const ai = await ctx.ai.generate(
        {
          promptKey: "answerGrading",
          operation: "grade.ai",
          variables: {
            questionId,
            maxMarks: question["maxMarks"],
            rubric,
            mapping: qsub["mapping"],
          },
          responseSchema: { type: "object" },
        },
        { tenantId, uid: ctx.uid, now: ctx.now }
      );
      const result = (ai.json as AiGradeJson) ?? {};
      const score = result.score ?? 0;
      const maxScore = result.maxScore ?? (question["maxMarks"] as number) ?? 0;
      const confidence = result.confidence ?? 0;
      const threshold = (confidenceConfig?.["confidenceThreshold"] as number) ?? 0.7;
      const needsReview = confidence < threshold;

      const evaluation = {
        score,
        maxScore,
        confidence,
        feedback: result.feedback,
        breakdown: result.breakdown,
        costUsd: ai.costUsd,
        tokenUsage: ai.tokensUsed,
      };

      await ctx.repos.submissions.upsert(
        tenantId,
        {
          id: qsub["id"],
          evaluation,
          gradingStatus: needsReview ? "needs_review" : "graded",
          _kind: "questionSubmission",
        },
        now
      );
      // valid machine moves: processing → graded | needs_review
      if (needsReview) needsReviewCount += 1;
      else gradedCount += 1;
    } catch (err) {
      failedCount += 1;
      await ctx.repos.submissions.upsert(
        tenantId,
        {
          id: qsub["id"],
          gradingStatus: "failed",
          gradingError: String((err as Error)?.message ?? err),
          gradingRetryCount: ((qsub["gradingRetryCount"] as number) ?? 0) + 1,
          _kind: "questionSubmission",
        },
        now
      );
      // DLQ the terminal failure (operator can retry/manual/dismiss).
      await ctx.repos.outbox.enqueue(tenantId, {
        _kind: "gradingDeadLetter",
        submissionId: input.submissionId,
        questionSubmissionId: qsub["id"],
        pipelineStep: "grading",
        error: String((err as Error)?.message ?? err),
        attempts: ((qsub["gradingRetryCount"] as number) ?? 0) + 1,
        lastAttemptAt: now,
        resolvedAt: null,
        createdAt: now,
      });
    }
    batchIndex += 1;
    // Persist a live progress counter for the gradingStatus subscription.
    await ctx.repos.submissions.upsert(
      tenantId,
      {
        id: input.submissionId,
        gradingProgress: { graded: gradedCount, total: qsubs.length, batchIndex },
      },
      now
    );
  }

  const allGraded = failedCount === 0;
  return { allGraded, gradedCount, needsReviewCount, failedCount };
}

async function markQuestionStatus(
  ctx: SystemContext,
  tenantId: string,
  qsub: Record<string, unknown>,
  _from: string,
  to: string
): Promise<void> {
  await ctx.repos.submissions.upsert(
    tenantId,
    { id: qsub["id"], gradingStatus: to, _kind: "questionSubmission" },
    ctx.now()
  );
}
