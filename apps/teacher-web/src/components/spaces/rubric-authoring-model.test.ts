import { describe, expect, it } from "vitest";
import { UnifiedRubricSchema, type RubricScoringMode } from "@levelup/domain";
import { buildRubric, validateRubricDraft, type RubricDraft } from "./rubric-authoring-model";

function draft(mode: RubricScoringMode): RubricDraft {
  return {
    mode,
    criteria: [
      {
        id: "criterion_1",
        name: "Accuracy",
        maxScore: 10,
        levels: [
          { score: 0, label: "Missing" },
          { score: 10, label: "Complete", description: "Fully correct" },
        ],
      },
    ],
    dimensions: [
      {
        id: "dimension_1",
        name: "Reasoning",
        priority: "HIGH",
        weight: 1,
        scoringScale: 10,
        promptGuidance: "Check the reasoning.",
      },
    ],
    holisticGuidance: "Judge the response as a whole.",
    holisticMaxScore: 20,
    passingPercentage: 60,
    evaluatorGuidance: "Use evidence.",
    modelAnswer: "Reference response",
    showModelAnswer: true,
  };
}

describe("rubric authoring model", () => {
  it.each<RubricScoringMode>(["criteria_based", "dimension_based", "holistic", "hybrid"])(
    "builds a strict canonical %s rubric",
    (mode) => {
      const value = draft(mode);
      expect(validateRubricDraft(value)).toEqual([]);
      expect(UnifiedRubricSchema.safeParse(buildRubric(value)).error).toBeUndefined();
    }
  );

  it("reports actionable scoring errors", () => {
    const value = draft("criteria_based");
    value.criteria[0] = { ...value.criteria[0], name: "", maxScore: 0 };
    value.passingPercentage = 101;
    expect(validateRubricDraft(value)).toEqual(
      expect.arrayContaining([
        "Criterion 1 needs a name",
        "Criterion 1 needs a positive maximum score",
        "Passing percentage must be between 0 and 100",
      ])
    );
  });
});
