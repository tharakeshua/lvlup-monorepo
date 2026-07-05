/**
 * `processAnswerMappingService` — Panopticon scouting (autograde.md §"Pipeline").
 * AI maps answer-sheet pages → questions, writes `scoutingResult` on the submission
 * and creates one `QuestionSubmission` per question (status `pending`). Structured
 * AI output via `ctx.ai`. Single-writer (only writer of `scoutingResult`).
 */
import type { SystemContext } from "../../shared/context.js";
import { requireTenant, fail } from "../../shared/context.js";
import { listExamQuestions } from "./questions.js";
import { projectSubmissionStatus } from "./grading-projection.js";

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
  const pages =
    ((sub["answerSheets"] as Record<string, unknown> | undefined)?.["images"] as
      | string[]
      | undefined) ?? [];
  // Scouting without pages would leave every question unmapped and grading blind
  // (P0-C) — fail loudly; the pipeline reducer DLQs scouting failures.
  if (pages.length === 0) {
    fail("FAILED_PRECONDITION", "cannot scout: submission has no answer-sheet images");
  }

  const ai = await ctx.ai.generate(
    {
      promptKey: "answerMapping",
      operation: "answer.mapping",
      variables: {
        submissionId: input.submissionId,
        examId,
        // The `answerMapping` prompt requires {questions, pageCount} (registry
        // requiredVariables); page indices in the reply are ZERO-BASED.
        questions: questions.map((q) => q["id"]),
        pageCount: pages.length,
      },
      // Storage PATHS — the ai gateway downloads + inlines the bytes (P0-B seam).
      images: pages.map((path) => ({ storagePath: path })),
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

  // Create one QuestionSubmission per question (status pending). The mapping
  // invariant (P0-C): `imageUrls` carries the REAL storage paths of the pages the
  // scout routed to this question — RELMS grades exactly these pages.
  for (const q of questions) {
    const qid = q["id"] as string;
    const pageIndices = (routingMap[qid] ?? []).filter(
      (i) => Number.isInteger(i) && i >= 0 && i < pages.length
    );
    const imageUrls = pageIndices.map((i) => pages[i] as string);
    await ctx.repos.submissions.upsert(
      tenantId,
      {
        // Deterministic id — a re-scout (scouting_failed → scouting) UPSERTS the
        // same QuestionSubmission docs instead of duplicating them (P2-H class).
        id: `${input.submissionId}_${qid}`,
        submissionId: input.submissionId,
        questionId: qid,
        examId,
        mapping: { pageIndices, imageUrls, scoutedAt: now },
        gradingStatus: "pending",
        gradingRetryCount: 0,
        _kind: "questionSubmission",
      },
      now
    );
  }

  // AG-5: seed the live ticker with the scouting baseline — status `scouting`, the
  // now-known question total, zero graded. Slim counts only (no answer-key / score).
  await projectSubmissionStatus(ctx, tenantId, {
    submissionId: input.submissionId,
    examId,
    studentId: sub["studentId"] as string,
    pipelineStatus: "scouting",
    gradingProgress: { graded: 0, total: questions.length },
  });
}
