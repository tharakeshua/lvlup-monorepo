/**
 * coerceUnifiedRubric — maps legacy seed / Firestore rubric docs (totalPoints +
 * {key,label} dimensions) into a strict UnifiedRubric so DEV `validateResponses`
 * (listRubricPresets response + server projection) does not drop presets.
 *
 * Extracted with PR #24 (fix/teacher-rubric-presets-coerce) onto the clean
 * staging base; the SSOT lives in domain (the inter-team seam).
 */
import { describe, it, expect } from "vitest";
import { coerceUnifiedRubric, UnifiedRubricSchema } from "../entities/content/rubric.js";

describe("coerceUnifiedRubric", () => {
  it("passes an already-strict holistic rubric through unchanged", () => {
    const strict = {
      scoringMode: "holistic" as const,
      holisticMaxScore: 20,
      holisticGuidance: "grade generously",
    };
    const out = coerceUnifiedRubric(strict);
    expect(out).toEqual(strict);
    // Output is always a valid UnifiedRubric.
    expect(() => UnifiedRubricSchema.parse(out)).not.toThrow();
  });

  it("coerces a legacy dimensionless rubric (totalPoints only) to holistic", () => {
    const legacy = { totalPoints: 15, passingScore: 9, evaluatorGuidance: "focus on clarity" };
    const out = coerceUnifiedRubric(legacy);
    expect(out.scoringMode).toBe("holistic");
    expect(out.holisticMaxScore).toBe(15);
    // passingScore/totalPoints → percentage.
    expect(out.passingPercentage).toBe(60);
    expect(out.evaluatorGuidance).toBe("focus on clarity");
    expect(() => UnifiedRubricSchema.parse(out)).not.toThrow();
  });

  it("falls back to the default max score when totalPoints is absent", () => {
    const out = coerceUnifiedRubric({}, 12);
    expect(out.scoringMode).toBe("holistic");
    expect(out.holisticMaxScore).toBe(12);
  });

  it("coerces legacy {key,label} dimensions into dimension_based", () => {
    const legacy = {
      dimensions: [
        { key: "clarity", label: "Clarity", priority: "HIGH" },
        { key: "depth", label: "Depth", weight: 2 },
      ],
      totalPoints: 10,
      passingScore: 5,
    };
    const out = coerceUnifiedRubric(legacy);
    expect(out.scoringMode).toBe("dimension_based");
    expect(out.dimensions).toHaveLength(2);
    expect(out.dimensions?.[0]).toMatchObject({ id: "clarity", name: "Clarity", priority: "HIGH" });
    // Missing/invalid priority defaults to MEDIUM.
    expect(out.dimensions?.[1]).toMatchObject({ id: "depth", name: "Depth", priority: "MEDIUM" });
    expect(out.passingPercentage).toBe(50);
    expect(() => UnifiedRubricSchema.parse(out)).not.toThrow();
  });

  it("synthesizes ids/names for dimensions missing key and label", () => {
    const out = coerceUnifiedRubric({ dimensions: [{}] });
    expect(out.scoringMode).toBe("dimension_based");
    expect(out.dimensions?.[0]).toMatchObject({
      id: "dim_0",
      name: "Dimension 1",
      priority: "MEDIUM",
    });
  });

  it("treats null/undefined/non-object input as an empty holistic rubric", () => {
    for (const bad of [null, undefined, 42, "nope"]) {
      const out = coerceUnifiedRubric(bad);
      expect(out.scoringMode).toBe("holistic");
      expect(out.holisticMaxScore).toBe(10);
    }
  });
});
