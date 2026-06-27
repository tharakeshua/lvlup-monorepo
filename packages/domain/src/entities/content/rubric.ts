/**
 * UnifiedRubric + sub-schemas — the shared content core consumed by levelup AND
 * autograde (single shape, no fork). `modelAnswer`/`evaluatorGuidance`/
 * `promptGuidance` are ⚷ authoring-only (server projects them out for non-authoring
 * roles); they remain on the schema because the schema is shared with the server.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zRubricScoringMode, zDimensionPriority } from "../../enums/content.js";

export const RubricCriterionLevelSchema = zObject({
  label: z.string(),
  description: z.string().optional(),
  score: z.number(),
});
export type RubricCriterionLevel = z.infer<typeof RubricCriterionLevelSchema>;

export const RubricCriterionSchema = zObject({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  maxScore: z.number(),
  weight: z.number().optional(),
  levels: z.array(RubricCriterionLevelSchema).optional(),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const EvaluationDimensionSchema = zObject({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  priority: zDimensionPriority,
  weight: z.number().optional(),
  scoringScale: z.number().optional(),
  // ⚷ authoring-only — leaks how to score.
  promptGuidance: z.string().optional(),
});
export type EvaluationDimension = z.infer<typeof EvaluationDimensionSchema>;

export const UnifiedRubricSchema = zObject({
  scoringMode: zRubricScoringMode,
  criteria: z.array(RubricCriterionSchema).optional(),
  dimensions: z.array(EvaluationDimensionSchema).optional(),
  holisticGuidance: z.string().optional(),
  holisticMaxScore: z.number().optional(),
  passingPercentage: z.number().optional(),
  showModelAnswer: z.boolean().optional(),
  // ⚷ authoring-only.
  modelAnswer: z.string().optional(),
  evaluatorGuidance: z.string().optional(),
});
export type UnifiedRubric = z.infer<typeof UnifiedRubricSchema>;
