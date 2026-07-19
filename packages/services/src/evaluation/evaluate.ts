/**
 * `evaluateWithAi` — the single-shot Evaluation Core call every AI-graded path
 * converges on (AI-EVALUATION-CORE-PLAN.md D1/D5): compose the prompt (persona +
 * question + answer + rubric + dimensions), build the dimension-derived
 * responseSchema, run ONE gateway call, and normalize the model output into a
 * clamped, fully-populated `EvaluationOutcome`.
 *
 * Callers own persistence, authorization, idempotency, and confidence routing —
 * this module owns ONLY prompt → model → normalized result.
 */
import { FEEDBACK_SEVERITIES, MISTAKE_CLASSIFICATIONS } from "@levelup/domain";
import type { AiGateway, AiCallContext } from "../shared/ai.js";
import { buildEvaluationPrompt } from "./prompt.js";
import { buildEvaluationResponseSchema, enabledDimensionIds } from "./response-schema.js";
import type { Doc, EvaluationOutcome, EvaluationRequest } from "./types.js";

const SEVERITY_SET = new Set<string>(FEEDBACK_SEVERITIES);
const MISTAKE_SET = new Set<string>(MISTAKE_CLASSIFICATIONS);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const numOr = (v: unknown, fb: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fb;
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? (v as unknown[]).map(String).filter(Boolean) : [];

function normalizeSummary(raw: Doc): { keyTakeaway: string; overallComment: string } | undefined {
  const s = raw["summary"];
  if (s && typeof s === "object") {
    const d = s as Doc;
    const keyTakeaway = String(d["keyTakeaway"] ?? "");
    const overallComment = String(d["overallComment"] ?? d["keyTakeaway"] ?? "");
    if (keyTakeaway || overallComment) return { keyTakeaway, overallComment };
  }
  if (typeof s === "string" && s) return { keyTakeaway: s, overallComment: s };
  // Legacy models emitted a flat `feedback` string.
  const feedback = raw["feedback"];
  if (typeof feedback === "string" && feedback)
    return { keyTakeaway: feedback, overallComment: feedback };
  return undefined;
}

function normalizeStructuredFeedback(
  raw: Doc,
  dimIds: string[]
): EvaluationOutcome["structuredFeedback"] {
  if (dimIds.length === 0) return undefined;
  const src = (raw["structuredFeedback"] as Doc | undefined) ?? {};
  const out: NonNullable<EvaluationOutcome["structuredFeedback"]> = {};
  // Whitelist to the ENABLED dimensions only — extra model-invented keys dropped.
  for (const id of dimIds) {
    const items = Array.isArray(src[id]) ? (src[id] as Doc[]) : [];
    out[id] = items
      .filter((f) => f && typeof f === "object" && typeof f["message"] === "string")
      .map((f) => ({
        severity: SEVERITY_SET.has(String(f["severity"])) ? String(f["severity"]) : "minor",
        message: String(f["message"]),
        ...(typeof f["suggestion"] === "string" && f["suggestion"]
          ? { suggestion: String(f["suggestion"]) }
          : {}),
      }));
  }
  return out;
}

function normalizeRubricBreakdown(
  raw: Doc,
  maxScore: number
): EvaluationOutcome["rubricBreakdown"] {
  const src = raw["rubricBreakdown"];
  if (!Array.isArray(src) || src.length === 0) return undefined;
  return (src as Doc[])
    .filter((b) => b && typeof b === "object")
    .map((b) => {
      const criterionMax = Math.max(0, numOr(b["maxScore"], maxScore));
      return {
        ...(typeof b["criterionId"] === "string" && b["criterionId"]
          ? { criterionId: String(b["criterionId"]) }
          : {}),
        criterionName: String(b["criterionName"] ?? b["criterionId"] ?? ""),
        score: clamp(numOr(b["score"], 0), 0, criterionMax),
        maxScore: criterionMax,
        ...(typeof b["comment"] === "string" && b["comment"]
          ? { comment: String(b["comment"]) }
          : typeof b["feedback"] === "string" && b["feedback"]
            ? { comment: String(b["feedback"]) }
            : {}),
      };
    });
}

/** Run one unified evaluation. Throws only when the gateway itself throws. */
export async function evaluateWithAi(
  ai: AiGateway,
  callCtx: AiCallContext,
  req: EvaluationRequest
): Promise<EvaluationOutcome> {
  const maxScore = Math.max(0, req.question.maxScore);
  const prompt = buildEvaluationPrompt(req);
  const responseSchema = buildEvaluationResponseSchema(req.settings ?? null, req.rubric ?? null);
  const dimIds = enabledDimensionIds(req.settings ?? null);

  const agent = req.agent ?? null;
  const modelOverride =
    agent && typeof agent["modelOverride"] === "string"
      ? (agent["modelOverride"] as string)
      : undefined;
  const temperatureOverride =
    agent && typeof agent["temperatureOverride"] === "number"
      ? (agent["temperatureOverride"] as number)
      : undefined;

  const result = await ai.generate(
    {
      purpose: "answer_grading",
      promptKey: "unifiedEvaluation",
      operation: req.operation,
      ...(req.feature ? { feature: req.feature } : {}),
      ...(req.modelPolicyId ? { modelPolicyId: req.modelPolicyId } : {}),
      variables: { evaluationPrompt: prompt },
      ...(req.answer.media && req.answer.media.length > 0 ? { images: req.answer.media } : {}),
      responseSchema,
      ...(modelOverride ? { model: modelOverride } : {}),
      ...(temperatureOverride !== undefined ? { temperature: temperatureOverride } : {}),
    },
    callCtx
  );

  const raw = (result.json as Doc | undefined) ?? {};
  const score = clamp(numOr(raw["score"], 0), 0, maxScore);
  const ratio = maxScore > 0 ? clamp(score / maxScore, 0, 1) : 0;
  const mistake = String(raw["mistakeClassification"] ?? "");

  return {
    score,
    maxScore,
    correctness: clamp(numOr(raw["correctness"], ratio), 0, 1),
    percentage: clamp(numOr(raw["percentage"], ratio * 100), 0, 100),
    confidence: clamp(numOr(raw["confidence"], 0), 0, 1),
    strengths: strArr(raw["strengths"]),
    weaknesses: strArr(raw["weaknesses"]),
    missingConcepts: strArr(raw["missingConcepts"]),
    ...(dimIds.length > 0
      ? { structuredFeedback: normalizeStructuredFeedback(raw, dimIds), dimensionsUsed: dimIds }
      : {}),
    ...(normalizeRubricBreakdown(raw, maxScore)
      ? { rubricBreakdown: normalizeRubricBreakdown(raw, maxScore) }
      : {}),
    ...(normalizeSummary(raw) ? { summary: normalizeSummary(raw) } : {}),
    ...(MISTAKE_SET.has(mistake) ? { mistakeClassification: mistake } : {}),
    tokensUsed: result.tokensUsed,
    costUsd: result.costUsd,
    model: result.model,
  };
}
