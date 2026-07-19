/**
 * UnifiedEvaluationResult — the server-authoritative grading output (REVIEW §6.5).
 * Shared by levelup test submissions and autograde question submissions.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zFeedbackSeverity, zMistakeClassification } from "../../enums/content.js";

export const FeedbackItemSchema = zObject({
  severity: zFeedbackSeverity,
  message: z.string(),
  dimension: z.string().optional(),
  suggestion: z.string().optional(),
});
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

/**
 * EvaluationSummary — the AI grader's headline verdict. Stored (and rendered)
 * as an OBJECT; both the evaluation writer (services/evaluation) and every
 * grading UI use `{ keyTakeaway, overallComment }`.
 */
export const EvaluationSummarySchema = zObject({
  keyTakeaway: z.string(),
  overallComment: z.string(),
});
export type EvaluationSummary = z.infer<typeof EvaluationSummarySchema>;

/**
 * Input coercion for `summary`: the canonical shape is the object above, but
 * some legacy / needs_review evaluations still carry a bare STRING (the raw
 * `feedback` fallback the old read projection emitted). Accept either and
 * normalize a string into the object shape so EVERY client (which strict-parses
 * this response) sees a uniform object — a needs_review row's string summary can
 * no longer fail the parse and blank out the whole grading view. The read
 * projection (autograde/reads.ts) also normalizes, so this is belt-and-suspenders
 * until every backend is redeployed.
 */
const EvaluationSummaryInputSchema = z.union([
  EvaluationSummarySchema,
  z.string().transform((s) => ({ keyTakeaway: s, overallComment: s })),
]);

export const RubricBreakdownItemSchema = zObject({
  criterionId: z.string().optional(),
  criterionName: z.string(),
  score: z.number(),
  maxScore: z.number(),
  comment: z.string().optional(),
});
export type RubricBreakdownItem = z.infer<typeof RubricBreakdownItemSchema>;

export const UnifiedEvaluationResultSchema = zObject({
  score: z.number(),
  maxScore: z.number(),
  correctness: z.number(),
  percentage: z.number(),
  structuredFeedback: z.record(z.string(), z.array(FeedbackItemSchema)).optional(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  missingConcepts: z.array(z.string()).default([]),
  rubricBreakdown: z.array(RubricBreakdownItemSchema).optional(),
  summary: EvaluationSummaryInputSchema.optional(),
  confidence: z.number(),
  mistakeClassification: zMistakeClassification.optional(),
  // ⚷ cost telemetry — projected out for clients.
  tokensUsed: z.number().optional(),
  costUsd: z.number().optional(),
  evaluationRubricId: z.string().optional(),
  dimensionsUsed: z.array(z.string()).optional(),
  gradedAt: zTimestamp,
});
export type UnifiedEvaluationResult = z.infer<typeof UnifiedEvaluationResultSchema>;
