/**
 * Response-schema builder (AI-EVALUATION-CORE-PLAN.md D3/D5) — this is where
 * Evaluation Settings become "the output structure of the AI response": the
 * enabled dimensions generate explicit `structuredFeedback` properties and the
 * rubric criteria generate the `rubricBreakdown` array, so the model is
 * schema-FORCED to cover every configured dimension/criterion instead of
 * free-forming into `{ type: "object" }`.
 *
 * The shape targets the Gemini structured-output subset (type/properties/
 * required/items/enum only — no additionalProperties/patternProperties).
 */
import { FEEDBACK_SEVERITIES, MISTAKE_CLASSIFICATIONS } from "@levelup/domain";
import type { Doc } from "./types.js";

type Schema = Record<string, unknown>;

const NUMBER: Schema = { type: "number" };
const STRING: Schema = { type: "string" };
const STRING_ARRAY: Schema = { type: "array", items: STRING };

const FEEDBACK_ITEM: Schema = {
  type: "object",
  properties: {
    severity: { type: "string", enum: [...FEEDBACK_SEVERITIES] },
    message: STRING,
    suggestion: STRING,
  },
  required: ["severity", "message"],
};

/** Dimension ids the settings enable (order preserved, blanks dropped). */
export function enabledDimensionIds(settings: Doc | null | undefined): string[] {
  const dims = Array.isArray(settings?.["enabledDimensions"])
    ? (settings["enabledDimensions"] as Doc[])
    : [];
  return dims.map((d) => String(d["id"] ?? "")).filter(Boolean);
}

/** Build the evaluation responseSchema from the settings dimensions + rubric criteria. */
export function buildEvaluationResponseSchema(
  settings: Doc | null | undefined,
  rubric: Doc | null | undefined
): Schema {
  const properties: Record<string, Schema> = {
    score: { type: "number", description: "Points awarded (0..maxScore)." },
    maxScore: NUMBER,
    correctness: { type: "number", description: "Normalized 0-1." },
    percentage: { type: "number", description: "0-100." },
    confidence: { type: "number", description: "Your confidence in this evaluation, 0-1." },
    strengths: STRING_ARRAY,
    weaknesses: STRING_ARRAY,
    missingConcepts: STRING_ARRAY,
    summary: {
      type: "object",
      properties: {
        keyTakeaway: { type: "string", description: "One-sentence key feedback." },
        overallComment: { type: "string", description: "Detailed overall comment." },
      },
      required: ["keyTakeaway", "overallComment"],
    },
    mistakeClassification: { type: "string", enum: [...MISTAKE_CLASSIFICATIONS] },
  };
  const required = ["score", "confidence", "strengths", "weaknesses", "missingConcepts", "summary"];

  const criteria = Array.isArray(rubric?.["criteria"]) ? (rubric["criteria"] as Doc[]) : [];
  if (criteria.length > 0) {
    properties["rubricBreakdown"] = {
      type: "array",
      description: "One entry per rubric criterion, in order.",
      items: {
        type: "object",
        properties: {
          criterionId: STRING,
          criterionName: STRING,
          score: NUMBER,
          maxScore: NUMBER,
          comment: STRING,
        },
        required: ["criterionName", "score", "maxScore"],
      },
    };
    required.push("rubricBreakdown");
  }

  const dimIds = enabledDimensionIds(settings);
  if (dimIds.length > 0) {
    const dimProps: Record<string, Schema> = {};
    for (const id of dimIds) {
      dimProps[id] = { type: "array", items: FEEDBACK_ITEM };
    }
    properties["structuredFeedback"] = {
      type: "object",
      description: "Feedback items per evaluation dimension (empty array when nothing notable).",
      properties: dimProps,
      required: dimIds,
    };
    required.push("structuredFeedback");
  }

  return { type: "object", properties, required };
}
