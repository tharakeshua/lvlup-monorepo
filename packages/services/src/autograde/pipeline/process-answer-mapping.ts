/**
 * `processAnswerMappingService` — Panopticon scouting (autograde.md §"Pipeline").
 * AI maps answer-sheet pages → questions, writes `scoutingResult` on the submission
 * and creates one `QuestionSubmission` per question (status `pending`). Structured
 * AI output via `ctx.ai`. Single-writer (only writer of `scoutingResult`).
 */
import type { SystemContext } from "../../shared/context.js";
import { requireTenant, fail } from "../../shared/context.js";
import { listExamQuestions } from "./questions.js";

export interface ProcessAnswerMappingInput {
  submissionId: string;
}

export async function processAnswerMappingService(
  input: ProcessAnswerMappingInput,
  ctx: SystemContext
): Promise<void> {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail("NOT_FOUND", `submission ${input.submissionId} not found`);

  const examId = sub["examId"] as string;
  const questions = await listExamQuestions(ctx, tenantId, examId);
  const images = (sub["answerSheets"] as Record<string, unknown> | undefined)?.["images"] as
    | string[]
    | undefined;

  const ai = await ctx.ai.generate(
    {
      promptKey: "answerMapping",
      operation: "answer.mapping",
      variables: {
        submissionId: input.submissionId,
        examId,
        // The `answerMapping` prompt requires a `questions` variable (registry
        // requiredVariables); pass the question-id list under that exact name.
        questions: questions.map((q) => q["id"]),
      },
      images: (images ?? []).map((path) => ({ base64: path, mimeType: "image/jpeg" })),
      responseSchema: { type: "object" },
    },
    { tenantId, uid: ctx.uid, now: ctx.now, examId }
  );

  const mapping =
    (ai.json as { routingMap?: Record<string, number[]>; confidence?: Record<string, number> }) ??
    {};
  const routingMap = mapping.routingMap ?? {};
  const confidence = mapping.confidence ?? {};
  const now = ctx.now();

  // Write scoutingResult on the submission (single-writer).
  await ctx.repos.submissions.upsert(
    tenantId,
    {
      id: input.submissionId,
      scoutingResult: { routingMap, confidence, completedAt: now },
      summary: {
        ...(sub["summary"] as Record<string, unknown>),
        totalQuestions: questions.length,
      },
    },
    now
  );

  // Create one QuestionSubmission per question (status pending).
  for (const q of questions) {
    const qid = q["id"] as string;
    const pageIndices = routingMap[qid] ?? [];
    await ctx.repos.submissions.upsert(
      tenantId,
      {
        submissionId: input.submissionId,
        questionId: qid,
        examId,
        mapping: { pageIndices, imageUrls: [], scoutedAt: now },
        gradingStatus: "pending",
        gradingRetryCount: 0,
        _kind: "questionSubmission",
      },
      now
    );
  }
}
