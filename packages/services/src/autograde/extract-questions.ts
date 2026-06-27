/**
 * `extractQuestionsService` (autograde.md §"Command services"). AI extraction of
 * questions + resolved rubric snapshot from the uploaded question paper via the
 * `ctx.ai` seam (per-tenant key, quota, cost rollup — all inside the gateway).
 * Writes question docs + sets exam → `question_paper_extracted`. `mode:'single'`
 * re-extracts one question. `tenantId` from ctx; authoring authorize.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize, assertTransition } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";

type Req = ReqOf<"v1.autograde.extractQuestions">;
type Res = ResOf<"v1.autograde.extractQuestions">;

interface ExtractedQuestionRaw {
  text?: string;
  maxMarks?: number;
  order?: number;
  rubric?: unknown;
  questionType?: string;
  subQuestions?: unknown[];
  extractionConfidence?: number;
  readabilityIssue?: boolean;
}

export async function extractQuestionsService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "questions.extract", { examId: input.examId, tenantId });

  const exam = await ctx.repos.exams.get(tenantId, input.examId);
  if (!exam) fail("NOT_FOUND", `exam ${input.examId} not found`);

  const paper = exam["questionPaper"] as Record<string, unknown> | undefined;
  const images = (paper?.["images"] as string[] | undefined) ?? [];
  if (images.length === 0) {
    fail("FAILED_PRECONDITION", "cannot extract: no question-paper images uploaded");
  }

  const mode = input.mode ?? "full";
  const now = ctx.now();

  const ai = await ctx.ai.generate(
    {
      promptKey: "questionExtraction",
      operation: "questions.extract",
      variables: {
        examId: input.examId,
        mode,
        questionNumber: input.questionNumber,
        totalMarks: exam["totalMarks"],
      },
      images: images.map((path) => ({ base64: path, mimeType: "image/jpeg" })),
      responseSchema: { type: "array" },
    },
    { tenantId, uid: ctx.uid, now: ctx.now, examId: input.examId }
  );

  const raw = (Array.isArray(ai.json) ? ai.json : []) as ExtractedQuestionRaw[];
  const questions = raw.map((q, i) => ({
    text: q.text ?? "",
    maxMarks: q.maxMarks ?? 0,
    order: q.order ?? i + 1,
    rubric: q.rubric,
    questionType: q.questionType,
    subQuestions: q.subQuestions,
    extractionConfidence: q.extractionConfidence,
    readabilityIssue: q.readabilityIssue,
  }));

  const warnings: string[] = [];
  if (questions.some((q) => q.readabilityIssue)) {
    warnings.push("one or more questions had readability issues");
  }
  const imageQualityAcceptable = !questions.some((q) => q.readabilityIssue);

  // Persist questions into the nested questions collection (resolved rubric snapshot).
  await ctx.repos.tx(async (tx) => {
    for (const q of questions) {
      tx.upsert("exams", tenantId, {
        // questions are stored as a nested collection in the real adapter; the
        // testing twin flattens. We mark the parent + write via the exam repo path.
        examId: input.examId,
        ...q,
        _kind: "examQuestion",
      });
    }
    tx.upsert("exams", tenantId, {
      id: input.examId,
      status: "question_paper_extracted",
      questionPaper: { ...(paper ?? {}), questionCount: questions.length, extractedAt: now },
    });
  });

  // Enforce the lifecycle transition (data already written above is idempotent).
  const currentStatus = (exam["status"] as string) ?? "question_paper_uploaded";
  if (currentStatus !== "question_paper_extracted") {
    assertTransition("exam", currentStatus, "question_paper_extracted");
  }

  return {
    success: true,
    questions,
    warnings,
    metadata: {
      questionCount: questions.length,
      tokensUsed: ai.tokensUsed,
      cost: ai.costUsd,
      extractedAt: now,
      imageQualityAcceptable,
      mode,
    },
  } as Res;
}
