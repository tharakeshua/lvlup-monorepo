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

/**
 * Coerce legacy seed / Firestore rubric docs (totalPoints + {key,label} dims)
 * into a strict UnifiedRubric. Used by listRubricPresets response validation
 * and server projection so DEV `validateResponses` does not drop presets.
 */
export function coerceUnifiedRubric(raw: unknown, fallbackMaxScore = 10): UnifiedRubric {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const parsed = UnifiedRubricSchema.safeParse(r);
  if (parsed.success) return parsed.data;

  const dimsIn = Array.isArray(r.dimensions) ? (r.dimensions as Record<string, unknown>[]) : [];
  const totalPoints = typeof r.totalPoints === "number" ? r.totalPoints : undefined;
  const passingScore = typeof r.passingScore === "number" ? r.passingScore : undefined;
  const passingPercentage =
    typeof r.passingPercentage === "number"
      ? r.passingPercentage
      : passingScore != null && totalPoints
        ? Math.round((passingScore / totalPoints) * 100)
        : undefined;
  const modelAnswer = typeof r.modelAnswer === "string" ? r.modelAnswer : undefined;
  const evaluatorGuidance =
    typeof r.evaluatorGuidance === "string" ? r.evaluatorGuidance : undefined;

  if (dimsIn.length === 0) {
    return UnifiedRubricSchema.parse({
      scoringMode: "holistic",
      holisticMaxScore: totalPoints ?? fallbackMaxScore,
      holisticGuidance: evaluatorGuidance,
      passingPercentage,
      modelAnswer,
      evaluatorGuidance,
    });
  }

  return UnifiedRubricSchema.parse({
    scoringMode: "dimension_based",
    dimensions: dimsIn.map((d, i) => ({
      id: String(d.id ?? d.key ?? `dim_${i}`),
      name: String(d.name ?? d.label ?? `Dimension ${i + 1}`),
      description: typeof d.description === "string" ? d.description : undefined,
      priority:
        d.priority === "HIGH" || d.priority === "LOW" || d.priority === "MEDIUM"
          ? d.priority
          : "MEDIUM",
      weight: typeof d.weight === "number" ? d.weight : undefined,
      scoringScale: typeof d.scoringScale === "number" ? d.scoringScale : undefined,
      promptGuidance: typeof d.promptGuidance === "string" ? d.promptGuidance : undefined,
    })),
    passingPercentage,
    modelAnswer,
    evaluatorGuidance,
  });
}
