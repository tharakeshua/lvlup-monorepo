/**
 * StoredEvaluation — compact projection of UnifiedEvaluationResult for revisit
 * display (testsession-progress §"StoredEvaluation"). Domain stays clean
 * (`.optional()`); the api-contract request schema is the layer that uses
 * `.nullish()` for the Firebase callable `undefined → null` quirk.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zMistakeClassification } from "../../enums/content.js";
import { FeedbackItemSchema, RubricBreakdownItemSchema } from "./evaluation-result.js";

export const StoredEvaluationSummarySchema = zObject({
  keyTakeaway: z.string(),
  overallComment: z.string(),
});
export type StoredEvaluationSummary = z.infer<typeof StoredEvaluationSummarySchema>;

export const StoredEvaluationSchema = zObject({
  score: z.number(),
  maxScore: z.number(),
  correctness: z.number(),
  percentage: z.number(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  missingConcepts: z.array(z.string()).default([]),
  summary: StoredEvaluationSummarySchema.optional(),
  mistakeClassification: zMistakeClassification.optional(),
  // Evaluation-Core enrichments (AI-EVALUATION-CORE-PLAN.md D7) — optional so
  // pre-existing stored evaluations stay valid.
  confidence: z.number().optional(),
  structuredFeedback: z.record(z.string(), z.array(FeedbackItemSchema)).optional(),
  rubricBreakdown: z.array(RubricBreakdownItemSchema).optional(),
});
export type StoredEvaluation = z.infer<typeof StoredEvaluationSchema>;
