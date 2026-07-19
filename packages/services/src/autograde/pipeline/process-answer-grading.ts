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
import { projectSubmissionStatus } from "./grading-projection.js";
import { evaluateWithAi } from "../../evaluation/evaluate.js";

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

export async function processAnswerGradingService(
  input: ProcessAnswerGradingInput,
  ctx: SystemContext
): Promise<ProcessAnswerGradingResult> {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail("NOT_FOUND", `submission ${input.submissionId} not found`);
  const examId = sub["examId"] as string;
  const causation = (sub["llmCausation"] as Record<string, string | undefined> | undefined) ?? {};
  const studentId = sub["studentId"] as string;
  const student = await ctx.repos.students.get(tenantId, studentId);
  const subjectUserId = causation["subjectUserId"] ?? (student?.["authUid"] as string | undefined);
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
    const { rubric, confidenceConfig, settings } = await resolveRubricService(
      ctx,
      tenantId,
      exam,
      question
    );
    const now = ctx.now();

    // The pages the scout mapped to THIS question (P0-C invariant: written by
    // processAnswerMapping as real storage paths). RELMS grades exactly these.
    const mappedImageUrls =
      ((qsub["mapping"] as Record<string, unknown> | undefined)?.["imageUrls"] as
        | string[]
        | undefined) ?? [];

    if (mappedImageUrls.length === 0) {
      // No mapped pages ⇒ nothing for the model to read. Grading anyway would
      // HALLUCINATE a score — route to HITL instead (score 0, needs_review).
      const now2 = ctx.now();
      await ctx.repos.submissions.upsert(
        tenantId,
        {
          id: qsub["id"],
          evaluation: {
            score: 0,
            maxScore: (question["maxMarks"] as number) ?? 0,
            confidence: 0,
            feedback:
              "No answer-sheet pages were mapped to this question (possibly unanswered) — needs teacher review.",
          },
          gradingStatus: "needs_review",
          _kind: "questionSubmission",
        },
        now2
      );
      needsReviewCount += 1;
      continue;
    }

    try {
      await markQuestionStatus(ctx, tenantId, qsub, "pending", "processing");
      // Context-isolation note (extraction-architect seam): mapped pages may also
      // carry OTHER questions' answers — tell the grader to score only this one.
      const otherQuestionIds =
        ((qsub["mapping"] as Record<string, unknown> | undefined)?.["otherQuestionIds"] as
          | string[]
          | undefined) ?? [];
      const gradingNote =
        `The student's handwritten answer is in the ${mappedImageUrls.length} ` +
        "attached answer-sheet image(s). Grade ONLY what is written there." +
        (otherQuestionIds.length > 0
          ? ` The attached pages may ALSO contain answers to other questions (${otherQuestionIds.join(", ")}) — evaluate ONLY the answer to THIS question and ignore the rest.`
          : "");

      // Evaluation Core (AI-EVALUATION-CORE-PLAN.md Phase 3): same engine as the
      // online path — persona (none for autograde v-now) + rubric snapshot +
      // settings dimensions → dimension-derived responseSchema.
      const outcome = await evaluateWithAi(
        ctx.ai,
        {
          tenantId,
          uid: ctx.uid,
          role: ctx.role ?? "system",
          resourceType: "questionSubmission",
          resourceId: String(qsub["id"]),
          now: ctx.now,
          examId,
          submissionId: input.submissionId,
          questionId,
          usage: {
            actorUserId: ctx.uid,
            actorRole: ctx.role ?? "system",
            ...(causation["initiatedByUserId"]
              ? { initiatedByUserId: causation["initiatedByUserId"] }
              : {}),
            ...(causation["initiatorRole"] ? { initiatorRole: causation["initiatorRole"] } : {}),
            ...(subjectUserId ? { subjectUserId, billingUserId: subjectUserId } : {}),
            related: { examId, submissionId: input.submissionId, questionId },
          },
        },
        {
          question: {
            text: String(question["text"] ?? ""),
            questionType: String(question["questionType"] ?? "subjective"),
            maxScore: (question["maxMarks"] as number) ?? 0,
          },
          answer: {
            note: gradingNote,
            // The mapped pages as storage paths — the ai gateway inlines the bytes.
            media: mappedImageUrls.map((path) => ({ storagePath: path })),
          },
          agent: null,
          rubric: rubric ?? null,
          settings: settings ?? null,
          mode: "batch",
          operation: "grade.ai",
          feature: "autograde.answer_sheet",
        }
      );
      const score = outcome.score;
      const maxScore = outcome.maxScore || ((question["maxMarks"] as number) ?? 0);
      const confidence = outcome.confidence;
      const threshold = (confidenceConfig?.["confidenceThreshold"] as number) ?? 0.7;
      const needsReview = confidence < threshold;

      const evaluation = {
        score,
        maxScore,
        confidence,
        // `feedback`/`breakdown` keep their historical field names (teacher-web
        // reads them); the Core enrichments ride alongside.
        feedback: outcome.summary?.overallComment ?? "",
        breakdown: outcome.rubricBreakdown ?? [],
        strengths: outcome.strengths,
        weaknesses: outcome.weaknesses,
        missingConcepts: outcome.missingConcepts,
        ...(outcome.structuredFeedback ? { structuredFeedback: outcome.structuredFeedback } : {}),
        ...(outcome.rubricBreakdown ? { rubricBreakdown: outcome.rubricBreakdown } : {}),
        ...(outcome.summary ? { summary: outcome.summary } : {}),
        ...(outcome.mistakeClassification
          ? { mistakeClassification: outcome.mistakeClassification }
          : {}),
        costUsd: outcome.costUsd,
        tokenUsage: outcome.tokensUsed,
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
    const gradingProgress = { graded: gradedCount, total: qsubs.length, batchIndex };
    // Persist a live progress counter for the gradingStatus subscription.
    await ctx.repos.submissions.upsert(tenantId, { id: input.submissionId, gradingProgress }, now);
    // AG-5: mirror the counter onto the RTDB live ticker (status stays `grading`;
    // slim counts only — no per-question score/answer ever rides this channel).
    await projectSubmissionStatus(ctx, tenantId, {
      submissionId: input.submissionId,
      examId,
      studentId: sub["studentId"] as string,
      pipelineStatus: "grading",
      gradingProgress,
    });
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
