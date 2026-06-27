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
  summary: z.string().optional(),
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
