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
  /** ⚷ answer-bearing guidance from the model — folded into the rubric. */
  modelAnswer?: string;
  evaluationGuidance?: string;
}

/**
 * Merge extractor-emitted `modelAnswer`/`evaluationGuidance` into the question's
 * rubric (`rubric.modelAnswer` / `rubric.evaluatorGuidance` — UnifiedRubric's ⚷
 * server-only fields). Values already inside the rubric win; without a rubric
 * object the guidance still needs a home, so a minimal rubric is created.
 */
function foldGuidanceIntoRubric(q: ExtractedQuestionRaw): unknown {
  const hasGuidance = q.modelAnswer !== undefined || q.evaluationGuidance !== undefined;
  const rubric =
    q.rubric && typeof q.rubric === "object" ? (q.rubric as Record<string, unknown>) : undefined;
  if (!hasGuidance) return q.rubric;
  const merged: Record<string, unknown> = { ...(rubric ?? {}) };
  if (merged["modelAnswer"] === undefined && q.modelAnswer !== undefined) {
    merged["modelAnswer"] = q.modelAnswer;
  }
  if (merged["evaluatorGuidance"] === undefined && q.evaluationGuidance !== undefined) {
    merged["evaluatorGuidance"] = q.evaluationGuidance;
  }
  return merged;
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
      // The `questionExtraction` template's requiredVariables are
      // {examTitle, examType, mode} — locked by the prompt-contract test.
      variables: {
        examTitle: String(exam["title"] ?? ""),
        examType: String(exam["examType"] ?? "standard"),
        mode,
        questionNumber: input.questionNumber ?? "",
        totalMarks: (exam["totalMarks"] as number | undefined) ?? "unspecified",
      },
      // Storage PATHS — the ai gateway downloads + inlines the bytes (P0-B seam).
      images: images.map((path) => ({ storagePath: path })),
      responseSchema: { type: "array" },
    },
    { tenantId, uid: ctx.uid, now: ctx.now, examId: input.examId }
  );

  const raw = (Array.isArray(ai.json) ? ai.json : []) as ExtractedQuestionRaw[];
  const questions = raw.map((q, i) => ({
    text: q.text ?? "",
    maxMarks: q.maxMarks ?? 0,
    order: q.order ?? i + 1,
    // ⚷ answer-bearing guidance lives INSIDE the rubric (`modelAnswer` /
    // `evaluatorGuidance`) — the one channel `projectRubric` strips for
    // non-authoring roles (AD-11). Never persist it as top-level doc fields:
    // the view whitelist drops those for EVERYONE, making them dead data.
    rubric: foldGuidanceIntoRubric(q),
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
  // Ids are DETERMINISTIC (`{examId}_q{order}`) so a re-extract (full or single)
  // UPSERTS the same docs instead of duplicating them (P2-H).
  const priorCount = (paper?.["questionCount"] as number | undefined) ?? 0;
  await ctx.repos.tx(async (tx) => {
    const seenIds = new Set<string>();
    for (const q of questions) {
      let id = `${input.examId}_q${q.order}`;
      while (seenIds.has(id)) id = `${id}_dup`;
      seenIds.add(id);
      tx.upsert("exams", tenantId, {
        // questions are stored as a nested collection in the real adapter; the
        // testing twin flattens. We mark the parent + write via the exam repo path.
        id,
        examId: input.examId,
        ...q,
        _kind: "examQuestion",
      });
    }
    tx.upsert("exams", tenantId, {
      id: input.examId,
      status: "question_paper_extracted",
      questionPaper: {
        ...(paper ?? {}),
        // A single-question re-extract must not clobber the full paper's count.
        questionCount: mode === "single" && priorCount > 0 ? priorCount : questions.length,
        extractedAt: now,
      },
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
