/**
 * `extractQuestionsService` — the LIVE two-pass extraction pipeline
 * (docs/autograde-extraction/ARCHITECTURE-PLAN.md §2).
 *
 *   Pass 1 (`examQuestionExtraction`): ONE vision call over the paper images →
 *           questions (text/marks/order/type). Persisted immediately with a
 *           placeholder rubric (`rubricStatus:"pending"`); exam →
 *           `question_paper_extracted`. UI renders questions here.
 *   Pass 2 (`examRubricGeneration`): the questions are chunked into batches
 *           (RUBRIC_BATCH_SIZE, ≤RUBRIC_BATCH_CONCURRENCY in flight); each batch
 *           is a text-only call that returns criteria-based rubrics. Each finished
 *           batch upserts its question docs (real rubric, `rubricStatus:"generated"`)
 *           and ticks the RTDB counter — the rubric phase is incremental in the UI.
 *
 * Progress is projected to the slim RTDB channel `v1.autograde.extractionStatus`
 * (counters + phase only — never ⚷ content). The channel is best-effort; a ticker
 * failure never fails extraction. `mode:'rubrics'` resumes Pass 2 for questions
 * still `pending` (partial-failure recovery). `tenantId` from ctx; authoring authorize.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize, assertTransition } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { mapWithConcurrency, chunkList } from "../shared/concurrency.js";
import {
  projectExtractionStatus,
  bumpRubricsGenerated,
  type ExtractionPhase,
} from "./pipeline/extraction-projection.js";

type Req = ReqOf<"v1.autograde.extractQuestions">;
type Res = ResOf<"v1.autograde.extractQuestions">;

const RUBRIC_BATCH_SIZE = Math.max(1, Number(process.env["LEVELUP_RUBRIC_BATCH_SIZE"] ?? 5));
const RUBRIC_BATCH_CONCURRENCY = Math.max(
  1,
  Number(process.env["LEVELUP_RUBRIC_BATCH_CONCURRENCY"] ?? 3)
);

const RUBRIC_SCORING_MODES = new Set(["criteria_based", "dimension_based", "holistic", "hybrid"]);

/**
 * Gemini structured-output schemas must describe array items. A bare
 * `{ type: "array" }` is rejected by generateContent with HTTP 400 before the
 * model runs, so keep the provider-facing shapes alongside the parser that
 * consumes them.
 */
const QUESTION_EXTRACTION_RESPONSE_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      text: { type: "string" },
      maxMarks: { type: "number" },
      order: { type: "integer" },
      questionType: { type: "string" },
      subQuestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            maxMarks: { type: "number" },
            order: { type: "integer" },
            questionType: { type: "string" },
          },
          required: ["text"],
        },
      },
      extractionConfidence: { type: "number" },
      readabilityIssue: { type: "boolean" },
    },
    required: ["text", "maxMarks", "order", "readabilityIssue"],
  },
} as const;

const RUBRIC_GENERATION_RESPONSE_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      order: { type: "integer" },
      rubric: {
        type: "object",
        properties: {
          scoringMode: { type: "string", enum: ["criteria_based"] },
          criteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                maxScore: { type: "number" },
              },
              required: ["id", "name", "description", "maxScore"],
            },
          },
          modelAnswer: { type: "string" },
          evaluatorGuidance: { type: "string" },
        },
        required: ["scoringMode", "criteria", "modelAnswer", "evaluatorGuidance"],
      },
    },
    required: ["order", "rubric"],
  },
} as const;

interface ExtractedQuestionRaw {
  text?: string;
  maxMarks?: number;
  order?: number;
  questionType?: string;
  subQuestions?: unknown[];
  extractionConfidence?: number;
  readabilityIssue?: boolean;
}

/** A Pass-1 question (no rubric yet). */
interface PassQuestion {
  text: string;
  maxMarks: number;
  order: number;
  questionType?: string;
  subQuestions?: unknown[];
  extractionConfidence?: number;
  readabilityIssue?: boolean;
}

/**
 * Coerce an untrusted LLM rubric into a STRICT-valid `UnifiedRubric` (the view is
 * strict-validated client-side for teachers via `listQuestions`). Whitelists the
 * criterion keys (`maxPoints`→`maxScore`), keeps `modelAnswer`/`evaluatorGuidance`
 * INSIDE the rubric (AD-11 ⚷ channel), drops everything unrecognized.
 */
function sanitizeRubric(raw: unknown, maxMarks: number): Record<string, unknown> {
  const r = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) ?? {};
  const modeIn = typeof r["scoringMode"] === "string" ? (r["scoringMode"] as string) : "";
  const scoringMode = RUBRIC_SCORING_MODES.has(modeIn) ? modeIn : "criteria_based";

  const criteriaIn = Array.isArray(r["criteria"])
    ? (r["criteria"] as Record<string, unknown>[])
    : [];
  const criteria = criteriaIn.map((c, i) => {
    const maxScore =
      typeof c["maxScore"] === "number"
        ? (c["maxScore"] as number)
        : typeof c["maxPoints"] === "number"
          ? (c["maxPoints"] as number)
          : 0;
    const crit: Record<string, unknown> = {
      id: typeof c["id"] === "string" ? c["id"] : `c${i + 1}`,
      name:
        typeof c["name"] === "string" && c["name"] ? (c["name"] as string) : `Criterion ${i + 1}`,
      maxScore,
    };
    if (typeof c["description"] === "string") crit["description"] = c["description"];
    if (typeof c["weight"] === "number") crit["weight"] = c["weight"];
    return crit;
  });

  const out: Record<string, unknown> = { scoringMode, criteria };
  if (typeof r["holisticGuidance"] === "string") out["holisticGuidance"] = r["holisticGuidance"];
  if (typeof r["holisticMaxScore"] === "number") out["holisticMaxScore"] = r["holisticMaxScore"];
  if (typeof r["passingPercentage"] === "number") out["passingPercentage"] = r["passingPercentage"];
  if (typeof r["showModelAnswer"] === "boolean") out["showModelAnswer"] = r["showModelAnswer"];
  // ⚷ guidance — accept from inside the rubric OR a sibling field on the batch item.
  const modelAnswer = r["modelAnswer"] ?? r["model_answer"];
  const guidance = r["evaluatorGuidance"] ?? r["evaluationGuidance"];
  if (typeof modelAnswer === "string") out["modelAnswer"] = modelAnswer;
  if (typeof guidance === "string") out["evaluatorGuidance"] = guidance;
  // Best-effort: if criteria are absent but a maxMarks is known, leave criteria [].
  void maxMarks;
  return out;
}

/** Minimal strict-valid placeholder rubric shown while Pass 2 is pending. */
function placeholderRubric(): Record<string, unknown> {
  return { scoringMode: "criteria_based", criteria: [] };
}

/** Pass 1 — ONE vision call → questions only (no rubric). */
async function runQuestionPass(
  exam: Record<string, unknown>,
  images: string[],
  mode: string,
  questionNumber: string | undefined,
  ctx: AuthContext,
  tenantId: string,
  examId: string
): Promise<{ questions: PassQuestion[]; tokensUsed: number; costUsd: number }> {
  const ai = await ctx.ai.generate(
    {
      promptKey: "examQuestionExtraction",
      feature: "autograde.question_paper",
      operation: "questions.extract",
      variables: {
        examTitle: String(exam["title"] ?? ""),
        examType: String(exam["examType"] ?? "standard"),
        mode,
        questionNumber: questionNumber ?? "",
        totalMarks: (exam["totalMarks"] as number | undefined) ?? "unspecified",
      },
      // Storage PATHS — the ai gateway downloads + inlines the bytes (P0-B seam).
      images: images.map((path) => ({ storagePath: path })),
      responseSchema: QUESTION_EXTRACTION_RESPONSE_SCHEMA,
    },
    {
      tenantId,
      uid: ctx.uid,
      role: ctx.role ?? "teacher",
      resourceType: "exam",
      resourceId: examId,
      now: ctx.now,
      examId,
      usage: {
        actorUserId: ctx.uid,
        actorRole: ctx.role ?? "teacher",
        initiatedByUserId: ctx.uid,
        billingUserId: ctx.uid,
        initiatorRole: ctx.role ?? "teacher",
        related: { examId },
      },
    }
  );
  const raw = (Array.isArray(ai.json) ? ai.json : []) as ExtractedQuestionRaw[];
  const questions = raw.map((q, i) => ({
    text: q.text ?? "",
    maxMarks: q.maxMarks ?? 0,
    order: q.order ?? i + 1,
    questionType: q.questionType,
    subQuestions: q.subQuestions,
    extractionConfidence: q.extractionConfidence,
    readabilityIssue: q.readabilityIssue,
  }));
  return { questions, tokensUsed: ai.tokensUsed ?? 0, costUsd: ai.costUsd ?? 0 };
}

/** Pass 2 — one text-only call generating rubrics for a BATCH of questions. */
async function runRubricBatch(
  batch: PassQuestion[],
  exam: Record<string, unknown>,
  ctx: AuthContext,
  tenantId: string,
  examId: string
): Promise<{ rubrics: Map<number, Record<string, unknown>>; tokensUsed: number; costUsd: number }> {
  const ai = await ctx.ai.generate(
    {
      promptKey: "examRubricGeneration",
      feature: "autograde.question_paper",
      operation: "questions.generate_rubrics",
      variables: {
        examTitle: String(exam["title"] ?? ""),
        examType: String(exam["examType"] ?? "standard"),
        questions: JSON.stringify(
          batch.map((q) => ({
            order: q.order,
            text: q.text,
            maxMarks: q.maxMarks,
            questionType: q.questionType,
            subQuestions: q.subQuestions,
          }))
        ),
      },
      responseSchema: RUBRIC_GENERATION_RESPONSE_SCHEMA,
    },
    {
      tenantId,
      uid: ctx.uid,
      role: ctx.role ?? "teacher",
      resourceType: "exam",
      resourceId: examId,
      now: ctx.now,
      examId,
      usage: {
        actorUserId: ctx.uid,
        actorRole: ctx.role ?? "teacher",
        initiatedByUserId: ctx.uid,
        billingUserId: ctx.uid,
        initiatorRole: ctx.role ?? "teacher",
        related: { examId },
      },
    }
  );
  const raw = (Array.isArray(ai.json) ? ai.json : []) as Record<string, unknown>[];
  const rubrics = new Map<number, Record<string, unknown>>();
  for (const item of raw) {
    const order = typeof item["order"] === "number" ? (item["order"] as number) : undefined;
    if (order == null) continue;
    const maxMarks = batch.find((q) => q.order === order)?.maxMarks ?? 0;
    rubrics.set(order, sanitizeRubric(item["rubric"] ?? item, maxMarks));
  }
  return { rubrics, tokensUsed: ai.tokensUsed ?? 0, costUsd: ai.costUsd ?? 0 };
}

export async function extractQuestionsService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "questions.extract", { examId: input.examId, tenantId });

  const examId = input.examId;
  const exam = await ctx.repos.exams.get(tenantId, examId);
  if (!exam) fail("NOT_FOUND", `exam ${examId} not found`);

  const mode = input.mode ?? "full";
  const paper = exam["questionPaper"] as Record<string, unknown> | undefined;
  // The question-paper object as it stands after Pass 1 — carried into the finalize
  // write so setting `rubricsGeneratedAt` never clobbers questionCount/extractedAt.
  let currentPaper: Record<string, unknown> = paper ?? {};

  const project = (
    phase: ExtractionPhase,
    extra: {
      totalQuestions?: number;
      rubricsGenerated?: number;
      error?: string;
      failedPhase?: "questions" | "rubrics";
    } = {}
  ): Promise<void> =>
    projectExtractionStatus(ctx, tenantId, {
      examId,
      phase,
      totalQuestions: extra.totalQuestions ?? 0,
      rubricsGenerated: extra.rubricsGenerated ?? 0,
      mode: mode as "full" | "single" | "rubrics",
      ...(extra.error ? { error: extra.error } : {}),
      ...(extra.failedPhase ? { failedPhase: extra.failedPhase } : {}),
    });

  // ─────────────────────────── PASS 1 (questions) ───────────────────────────
  let questions: PassQuestion[];
  let pass1Tokens = 0;
  let pass1Cost = 0;
  // Projection counters. For a `rubrics` resume these reflect the WHOLE exam
  // (all question docs) with the rubric counter SEEDED at the already-generated
  // count — setStatus writes the seed, per-batch bumpRubrics increments on top.
  // Full/single runs count only this run's questions (seed 0).
  let totalForProjection: number;
  let seedRubricsGenerated = 0;

  if (mode === "rubrics") {
    // Resume path: skip Pass 1; load persisted questions still awaiting a rubric.
    const stored = await ctx.repos.exams.list(tenantId, {
      filter: (d) => d["_kind"] === "examQuestion" && d["examId"] === examId,
      limit: 500,
    });
    totalForProjection = stored.items.length;
    seedRubricsGenerated = stored.items.filter((d) => d["rubricStatus"] === "generated").length;
    questions = stored.items
      .filter((d) => (d["rubricStatus"] ?? "pending") !== "generated")
      .map((d) => ({
        text: String(d["text"] ?? ""),
        maxMarks: (d["maxMarks"] as number | undefined) ?? 0,
        order: (d["order"] as number | undefined) ?? 0,
        questionType: d["questionType"] as string | undefined,
        subQuestions: d["subQuestions"] as unknown[] | undefined,
      }));
    if (questions.length === 0) {
      // Nothing to resume — treat as already complete.
      await project("complete", {
        totalQuestions: totalForProjection,
        rubricsGenerated: seedRubricsGenerated,
      });
      return buildResponse([], [], {
        questionCount: 0,
        tokensUsed: 0,
        cost: 0,
        extractedAt: ctx.now(),
        imageQualityAcceptable: true,
        mode,
      });
    }
  } else {
    const images = (paper?.["images"] as string[] | undefined) ?? [];
    if (images.length === 0) {
      fail("FAILED_PRECONDITION", "cannot extract: no question-paper images uploaded");
    }
    await project("extracting_questions", { totalQuestions: 0 });
    try {
      const r = await runQuestionPass(
        exam,
        images,
        mode,
        input.questionNumber,
        ctx,
        tenantId,
        examId
      );
      questions = r.questions;
      pass1Tokens = r.tokensUsed;
      pass1Cost = r.costUsd;
    } catch (err) {
      await project("failed", { failedPhase: "questions", error: errMessage(err) });
      throw err;
    }

    // Persist Pass-1 questions (placeholder rubric, rubricStatus pending) + exam status.
    const priorCount = (paper?.["questionCount"] as number | undefined) ?? 0;
    const now = ctx.now();
    currentPaper = {
      ...(paper ?? {}),
      questionCount: mode === "single" && priorCount > 0 ? priorCount : questions.length,
      extractedAt: now,
    };
    await ctx.repos.tx(async (tx) => {
      const seenIds = new Set<string>();
      for (const q of questions) {
        let id = `${examId}_q${q.order}`;
        while (seenIds.has(id)) id = `${id}_dup`;
        seenIds.add(id);
        tx.upsert("exams", tenantId, {
          id,
          examId,
          text: q.text,
          maxMarks: q.maxMarks,
          order: q.order,
          questionType: q.questionType,
          subQuestions: q.subQuestions,
          extractionConfidence: q.extractionConfidence,
          readabilityIssue: q.readabilityIssue,
          rubric: placeholderRubric(),
          rubricStatus: "pending",
          _kind: "examQuestion",
        });
      }
      tx.upsert("exams", tenantId, {
        id: examId,
        status: "question_paper_extracted",
        questionPaper: currentPaper,
      });
    });

    // Recover a stuck `draft` (paper present but status never advanced); enforce transition.
    const storedStatus = (exam["status"] as string) ?? "question_paper_uploaded";
    const currentStatus = storedStatus === "draft" ? "question_paper_uploaded" : storedStatus;
    if (currentStatus !== "question_paper_extracted") {
      assertTransition("exam", currentStatus, "question_paper_extracted");
    }
    totalForProjection = questions.length;
  }

  await project("questions_extracted", {
    totalQuestions: totalForProjection,
    rubricsGenerated: seedRubricsGenerated,
  });

  // ─────────────────────────── PASS 2 (rubrics) ───────────────────────────
  await project("generating_rubrics", {
    totalQuestions: totalForProjection,
    rubricsGenerated: seedRubricsGenerated,
  });

  const batches = chunkList(questions, RUBRIC_BATCH_SIZE);
  const finalRubrics = new Map<number, Record<string, unknown>>();
  let rubricsGenerated = seedRubricsGenerated;
  let pass2Tokens = 0;
  let pass2Cost = 0;
  let anyBatchFailed = false;

  await mapWithConcurrency(batches, RUBRIC_BATCH_CONCURRENCY, async (batch) => {
    let result: Awaited<ReturnType<typeof runRubricBatch>> | null = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try {
        result = await runRubricBatch(batch, exam, ctx, tenantId, examId);
      } catch {
        if (attempt === 1) result = null;
      }
    }
    if (!result) {
      anyBatchFailed = true;
      return; // leave this batch's questions rubricStatus:"pending"
    }
    pass2Tokens += result.tokensUsed;
    pass2Cost += result.costUsd;

    // Persist this batch's rubrics + tick.
    const now = ctx.now();
    let persisted = 0;
    await ctx.repos.tx(async (tx) => {
      for (const q of batch) {
        const rubric = result!.rubrics.get(q.order);
        if (!rubric) {
          anyBatchFailed = true;
          continue; // missing from the model's response — stays pending
        }
        finalRubrics.set(q.order, rubric);
        persisted++;
        tx.upsert("exams", tenantId, {
          id: `${examId}_q${q.order}`,
          examId,
          rubric,
          rubricStatus: "generated",
          updatedAt: now,
        });
      }
    });
    if (persisted > 0) {
      rubricsGenerated += persisted;
      await bumpRubricsGenerated(ctx, tenantId, examId, persisted);
    }
  });

  // ─────────────────────────── finalize ───────────────────────────
  // Rubric-completion gate (opens uploadAnswerSheets): set `rubricsGeneratedAt`
  // ONLY when the exam is genuinely rubric-complete. For `full` runs that's the
  // whole exam, so `!anyBatchFailed` suffices. For `single`/`rubrics` runs only a
  // SUBSET is (re)generated — a single-question re-extract after a prior partial
  // rubric failure must NOT falsely mark the exam complete and open the gate. So
  // list every question doc and require EVERY one to be `rubricStatus:'generated'`.
  let rubricComplete: boolean;
  if (mode === "full") {
    rubricComplete = !anyBatchFailed;
  } else {
    const all = await ctx.repos.exams.list(tenantId, {
      filter: (d) => d["_kind"] === "examQuestion" && d["examId"] === examId,
      limit: 500,
    });
    rubricComplete =
      all.items.length > 0 && all.items.every((d) => d["rubricStatus"] === "generated");
  }

  if (rubricComplete) {
    const now = ctx.now();
    await ctx.repos.tx(async (tx) => {
      tx.upsert("exams", tenantId, {
        id: examId,
        questionPaper: { ...currentPaper, rubricsGeneratedAt: now },
      });
    });
  }

  if (anyBatchFailed) {
    await project("failed", {
      totalQuestions: totalForProjection,
      rubricsGenerated,
      failedPhase: "rubrics",
    });
  } else {
    await project("complete", { totalQuestions: totalForProjection, rubricsGenerated });
  }

  const warnings: string[] = [];
  if (questions.some((q) => q.readabilityIssue)) {
    warnings.push("one or more questions had readability issues");
  }
  if (anyBatchFailed) {
    warnings.push("rubric generation did not complete for all questions — retry rubric generation");
  }
  if (mode !== "full" && !rubricComplete) {
    warnings.push("exam still has questions awaiting rubric generation");
  }
  const imageQualityAcceptable = !questions.some((q) => q.readabilityIssue);

  const respQuestions = questions.map((q) => ({
    id: `${examId}_q${q.order}` as never,
    text: q.text,
    maxMarks: q.maxMarks,
    order: q.order,
    rubric: (finalRubrics.get(q.order) ?? placeholderRubric()) as never,
    questionType: q.questionType,
    subQuestions: q.subQuestions as never,
    extractionConfidence: q.extractionConfidence,
    readabilityIssue: q.readabilityIssue,
    rubricStatus: (finalRubrics.has(q.order) ? "generated" : "pending") as "pending" | "generated",
  }));

  return buildResponse(respQuestions, warnings, {
    questionCount: questions.length,
    tokensUsed: pass1Tokens + pass2Tokens,
    cost: pass1Cost + pass2Cost,
    extractedAt: ctx.now(),
    imageQualityAcceptable,
    mode,
  });
}

function buildResponse(
  questions: unknown[],
  warnings: string[],
  metadata: {
    questionCount: number;
    tokensUsed: number;
    cost: number;
    extractedAt: string;
    imageQualityAcceptable: boolean;
    mode: string;
  }
): Res {
  return {
    success: true,
    questions,
    warnings,
    metadata: { ...metadata, mode: metadata.mode as "full" | "single" | "rubrics" },
  } as Res;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
