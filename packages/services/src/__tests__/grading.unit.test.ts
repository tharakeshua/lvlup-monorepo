/**
 * Deterministic grading UNIT tests (U0.1 — question-type normalization gap).
 *
 * REGRESSION: the auto-graded registry type `group-options` had NO entry in the
 * `normalizeQuestionType` map and was NOT in `DETERMINISTIC_TYPES`, so it silently
 * fell through to the AI grader (or scored 0) despite being auto-gradable.
 *
 * This locks the invariant that EVERY `AUTO_EVALUATABLE_TYPES` registry key (the 9
 * auto keys: mcq, mcaq, true-false, numerical, fill-blanks, fill-blanks-dd,
 * matching, jumbled, group-options) normalizes to a member of DETERMINISTIC_TYPES —
 * i.e. NO auto type falls through to the LLM — and that group-options grades
 * deterministically (full / partial / zero credit).
 *
 * short_answer/long_answer (registry `text`/`paragraph`) are INTENTIONALLY `ai` and
 * are covered by the separate text-compare branch in scoreOne — not asserted here.
 */
import { describe, it, expect } from "vitest";
import { AUTO_EVALUATABLE_TYPES } from "@levelup/domain";
import { autoEvaluateDeterministic, DETERMINISTIC_TYPES, normalizeQuestionType } from "../index";

describe("deterministic grading — question-type normalization (U0.1)", () => {
  it("every auto-graded registry key normalizes into DETERMINISTIC_TYPES (no AI fall-through)", () => {
    // Guard: the registry's 9 auto keys are exactly what we expect to cover.
    expect(new Set(AUTO_EVALUATABLE_TYPES)).toEqual(
      new Set([
        "mcq",
        "mcaq",
        "true-false",
        "numerical",
        "fill-blanks",
        "fill-blanks-dd",
        "matching",
        "jumbled",
        "group-options",
      ])
    );

    for (const key of AUTO_EVALUATABLE_TYPES) {
      const normalized = normalizeQuestionType(key);
      expect(
        DETERMINISTIC_TYPES.has(normalized),
        `auto-graded "${key}" normalized to "${normalized}" which is NOT deterministic — it would fall through to the AI grader`
      ).toBe(true);
    }
  });

  it("group-options in particular normalizes to a deterministic type (was the bug)", () => {
    const normalized = normalizeQuestionType("group-options");
    expect(normalized).toBe("grouping");
    expect(DETERMINISTIC_TYPES.has(normalized)).toBe(true);
    // Alias + already-canonical forms resolve too.
    expect(normalizeQuestionType("group_options")).toBe("grouping");
    expect(normalizeQuestionType("grouping")).toBe("grouping");
  });

  describe("group-options deterministic scoring (partial credit by item→group)", () => {
    const key = {
      questionType: "group-options",
      correctAnswer: [
        { itemId: "i1", group: "fruit" },
        { itemId: "i2", group: "fruit" },
        { itemId: "i3", group: "veg" },
        { itemId: "i4", group: "veg" },
      ],
    };

    it("full credit when every item is in its correct group", () => {
      const answer = {
        assignments: [
          { itemId: "i1", group: "fruit" },
          { itemId: "i2", group: "fruit" },
          { itemId: "i3", group: "veg" },
          { itemId: "i4", group: "veg" },
        ],
      };
      const { evaluation, aiPending } = autoEvaluateDeterministic("grouping", key, answer, 4);
      expect(aiPending).toBe(false);
      expect(evaluation.score).toBe(4);
      expect(evaluation.maxScore).toBe(4);
      expect(evaluation.correctness).toBe(1);
      expect(evaluation.percentage).toBe(100);
    });

    it("partial credit proportional to correctly-assigned items", () => {
      // 2 of 4 correct (i1, i3 right; i2, i4 wrong group).
      const answer = [
        { itemId: "i1", group: "fruit" },
        { itemId: "i2", group: "veg" },
        { itemId: "i3", group: "veg" },
        { itemId: "i4", group: "fruit" },
      ];
      const { evaluation, aiPending } = autoEvaluateDeterministic("grouping", key, answer, 4);
      expect(aiPending).toBe(false);
      expect(evaluation.score).toBe(2);
      expect(evaluation.correctness).toBe(0.5);
      expect(evaluation.percentage).toBe(50);
    });

    it("zero credit when no item is in its correct group", () => {
      const answer = [
        { itemId: "i1", group: "veg" },
        { itemId: "i2", group: "veg" },
        { itemId: "i3", group: "fruit" },
        { itemId: "i4", group: "fruit" },
      ];
      const { evaluation, aiPending } = autoEvaluateDeterministic("grouping", key, answer, 4);
      expect(aiPending).toBe(false);
      expect(evaluation.score).toBe(0);
      expect(evaluation.correctness).toBe(0);
      expect(evaluation.percentage).toBe(0);
    });

    it("reads the correct grouping from the prompt `items[].group` shape too", () => {
      // Some payloads carry the ⚷ correct group on each prompt item.
      const itemsKey = {
        questionType: "group-options",
        items: [
          { id: "i1", text: "Apple", group: "fruit" },
          { id: "i2", text: "Carrot", group: "veg" },
        ],
      };
      const answer = [
        { itemId: "i1", group: "fruit" },
        { itemId: "i2", group: "veg" },
      ];
      const { evaluation, aiPending } = autoEvaluateDeterministic("grouping", itemsKey, answer, 2);
      expect(aiPending).toBe(false);
      expect(evaluation.score).toBe(2);
      expect(evaluation.correctness).toBe(1);
    });

    it("is AI-pending only when no answer key exists (never silently)", () => {
      const { aiPending } = autoEvaluateDeterministic("grouping", null, [], 1);
      expect(aiPending).toBe(true);
    });

    it("escalates to AI (not a silent zero) when the key exists but has no usable item→group map", () => {
      // Authoring-error escape: the learner must not be zeroed for a malformed key.
      const malformed = { questionType: "group-options" }; // no assignments/correctAnswer/items
      const { evaluation, aiPending } = autoEvaluateDeterministic(
        "grouping",
        malformed,
        [{ itemId: "i1", group: "fruit" }],
        4
      );
      expect(aiPending).toBe(true);
      expect(evaluation.score).toBe(0); // zeroed placeholder the AI pass overwrites
      const emptyAssignments = { correctAnswer: { assignments: [] } };
      expect(autoEvaluateDeterministic("grouping", emptyAssignments, [], 4).aiPending).toBe(true);
    });
  });

  describe("matching deterministic scoring (partial credit by left→right pair)", () => {
    const key = {
      questionType: "matching",
      pairs: [
        { left: "Impact vs Effort Matrix", right: "Quick visual triage" },
        { left: "RICE Scoring", right: "Quantitative prioritization" },
        { left: "MoSCoW Method", right: "Release scoping" },
        { left: "Cost of Delay", right: "Economic sequencing" },
      ],
    };

    it("full credit when every left maps to its correct right (record shape)", () => {
      const answer = {
        "Impact vs Effort Matrix": "Quick visual triage",
        "RICE Scoring": "Quantitative prioritization",
        "MoSCoW Method": "Release scoping",
        "Cost of Delay": "Economic sequencing",
      };
      const { evaluation, aiPending } = autoEvaluateDeterministic("matching", key, answer, 4);
      expect(aiPending).toBe(false);
      expect(evaluation.score).toBe(4);
      expect(evaluation.correctness).toBe(1);
      expect(evaluation.percentage).toBe(100);
    });

    it("partial credit proportional to correct pairs", () => {
      // 2 of 4 correct.
      const answer = {
        "Impact vs Effort Matrix": "Quick visual triage",
        "RICE Scoring": "Release scoping", // wrong
        "MoSCoW Method": "Quantitative prioritization", // wrong
        "Cost of Delay": "Economic sequencing",
      };
      const { evaluation } = autoEvaluateDeterministic("matching", key, answer, 4);
      expect(evaluation.score).toBe(2);
      expect(evaluation.correctness).toBe(0.5);
      expect(evaluation.percentage).toBe(50);
    });

    it("accepts the canonical learner `matches` array shape too", () => {
      const answer = {
        matches: [
          { left: "Impact vs Effort Matrix", right: "Quick visual triage" },
          { left: "RICE Scoring", right: "Quantitative prioritization" },
          { left: "MoSCoW Method", right: "Release scoping" },
          { left: "Cost of Delay", right: "Economic sequencing" },
        ],
      };
      const { evaluation } = autoEvaluateDeterministic("matching", key, answer, 4);
      expect(evaluation.score).toBe(4);
      expect(evaluation.correctness).toBe(1);
    });

    it("is case/whitespace-insensitive on both sides", () => {
      const answer = { "impact vs effort matrix ": " QUICK VISUAL TRIAGE" };
      const { evaluation } = autoEvaluateDeterministic("matching", key, answer, 4);
      expect(evaluation.score).toBe(1); // 1 of 4
    });

    it("escalates to AI (not a silent zero) when the key has no usable pairs", () => {
      const malformed = { questionType: "matching" }; // no pairs
      const { aiPending, evaluation } = autoEvaluateDeterministic("matching", malformed, {}, 4);
      expect(aiPending).toBe(true);
      expect(evaluation.score).toBe(0);
    });
  });

  describe("existing deterministic scorers still grade the other auto types", () => {
    it("mcq / set-match", () => {
      const { evaluation } = autoEvaluateDeterministic(
        "mcq",
        { correctAnswer: ["a", "b"] },
        ["b", "a"],
        1
      );
      expect(evaluation.score).toBe(1);
    });

    it("numeric with tolerance", () => {
      const { evaluation } = autoEvaluateDeterministic(
        "numeric",
        { correctAnswer: 10, tolerance: 0.5 },
        10.4,
        1
      );
      expect(evaluation.score).toBe(1);
    });

    it("true_false exact match", () => {
      const { evaluation } = autoEvaluateDeterministic(
        "true_false",
        { correctAnswer: true },
        true,
        1
      );
      expect(evaluation.score).toBe(1);
    });
  });
});
