import type {
  EvaluationDimension,
  RubricCriterion,
  RubricScoringMode,
  UnifiedRubric,
} from "@levelup/domain";

export interface RubricDraft {
  mode: RubricScoringMode;
  criteria: RubricCriterion[];
  dimensions: EvaluationDimension[];
  holisticGuidance: string;
  holisticMaxScore: number;
  passingPercentage: number;
  evaluatorGuidance: string;
  modelAnswer: string;
  showModelAnswer: boolean;
}

export function validateRubricDraft(draft: RubricDraft): string[] {
  const errors: string[] = [];
  if ((draft.mode === "criteria_based" || draft.mode === "hybrid") && draft.criteria.length === 0) {
    errors.push("Add at least one scoring criterion");
  }
  draft.criteria.forEach((criterion, index) => {
    if (!criterion.name.trim()) errors.push(`Criterion ${index + 1} needs a name`);
    if (!Number.isFinite(criterion.maxScore) || criterion.maxScore <= 0) {
      errors.push(`Criterion ${index + 1} needs a positive maximum score`);
    }
    criterion.levels?.forEach((level, levelIndex) => {
      if (!level.label.trim()) {
        errors.push(`Criterion ${index + 1}, level ${levelIndex + 1} needs a label`);
      }
      if (level.score < 0 || level.score > criterion.maxScore) {
        errors.push(`Criterion ${index + 1} level scores must be within its maximum`);
      }
    });
  });

  if (draft.mode === "dimension_based" && draft.dimensions.length === 0) {
    errors.push("Add at least one evaluation dimension");
  }
  draft.dimensions.forEach((dimension, index) => {
    if (!dimension.name.trim()) errors.push(`Dimension ${index + 1} needs a name`);
    if ((dimension.weight ?? 0) < 0) {
      errors.push(`Dimension ${index + 1} weight cannot be negative`);
    }
    if ((dimension.scoringScale ?? 1) <= 0) {
      errors.push(`Dimension ${index + 1} needs a positive scoring scale`);
    }
  });

  if (draft.mode === "holistic" || draft.mode === "hybrid") {
    if (!draft.holisticGuidance.trim()) errors.push("Holistic guidance is required");
    if (!Number.isFinite(draft.holisticMaxScore) || draft.holisticMaxScore <= 0) {
      errors.push("Holistic maximum score must be positive");
    }
  }
  if (
    !Number.isFinite(draft.passingPercentage) ||
    draft.passingPercentage < 0 ||
    draft.passingPercentage > 100
  ) {
    errors.push("Passing percentage must be between 0 and 100");
  }

  return [...new Set(errors)];
}

export function buildRubric(draft: RubricDraft): UnifiedRubric {
  return {
    scoringMode: draft.mode,
    criteria:
      draft.mode === "criteria_based" || draft.mode === "hybrid"
        ? draft.criteria.map((criterion) => ({
            id: criterion.id,
            name: criterion.name.trim(),
            description: criterion.description?.trim() || undefined,
            maxScore: criterion.maxScore,
            weight: criterion.weight,
            levels: criterion.levels?.map((level) => ({
              label: level.label.trim(),
              description: level.description?.trim() || undefined,
              score: level.score,
            })),
          }))
        : undefined,
    dimensions:
      draft.mode === "dimension_based"
        ? draft.dimensions.map((dimension) => ({
            id: dimension.id,
            name: dimension.name.trim(),
            description: dimension.description?.trim() || undefined,
            priority: dimension.priority,
            weight: dimension.weight,
            scoringScale: dimension.scoringScale,
            promptGuidance: dimension.promptGuidance?.trim() || undefined,
          }))
        : undefined,
    holisticGuidance:
      draft.mode === "holistic" || draft.mode === "hybrid"
        ? draft.holisticGuidance.trim()
        : undefined,
    holisticMaxScore:
      draft.mode === "holistic" || draft.mode === "hybrid" ? draft.holisticMaxScore : undefined,
    passingPercentage: draft.passingPercentage,
    evaluatorGuidance: draft.evaluatorGuidance.trim() || undefined,
    modelAnswer: draft.modelAnswer.trim() || undefined,
    showModelAnswer: draft.showModelAnswer,
  };
}
