import { describe, it, expect } from "vitest";
import {
  calculateGrade,
  resolveRubric,
  calculateSubmissionSummary,
} from "../utils/grading-helpers";
import { makeExamQuestion, makeQuestionSubmission } from "../../../test-utils/test-data";

/**
 * Tests for the grading helpers used by the RELMS pipeline.
 *
 * These are the pure functions that calculate grades, resolve rubrics,
 * and aggregate submission scores.
 */

describe("calculateGrade", () => {
  it.each([
    [95, "A+"],
    [90, "A+"],
    [85, "A"],
    [80, "A"],
    [75, "B+"],
    [70, "B+"],
    [65, "B"],
    [60, "B"],
    [55, "C"],
    [50, "C"],
    [45, "D"],
    [40, "D"],
    [35, "F"],
    [0, "F"],
  ])("should return %s for percentage %d", (percentage, expectedGrade) => {
    expect(calculateGrade(percentage)).toBe(expectedGrade);
  });
});

describe("resolveRubric", () => {
  it("should return question rubric as-is", () => {
    const question = makeExamQuestion() as any;
    const { rubric, dimensions } = resolveRubric(question, null, null);

    expect(rubric).toBe(question.rubric);
    expect(dimensions).toEqual([]);
  });

  it("should resolve enabled dimensions from exam settings", () => {
    const question = makeExamQuestion() as any;
    const examSettings = {
      enabledDimensions: [
        { id: "d1", name: "Clarity", enabled: true },
        { id: "d2", name: "Accuracy", enabled: false },
        { id: "d3", name: "Depth", enabled: true },
      ],
    } as any;

    const { dimensions } = resolveRubric(question, examSettings, null);

    expect(dimensions).toHaveLength(2);
    expect(dimensions.map((d: any) => d.id)).toEqual(["d1", "d3"]);
  });

  it("should fall back to tenant defaults when exam settings are null", () => {
    const question = makeExamQuestion() as any;
    const tenantDefaults = {
      enabledDimensions: [{ id: "d1", name: "Grammar", enabled: true }],
    } as any;

    const { dimensions } = resolveRubric(question, null, tenantDefaults);

    expect(dimensions).toHaveLength(1);
    expect(dimensions[0].name).toBe("Grammar");
  });
});

describe("calculateSubmissionSummary", () => {
  it("should aggregate graded question scores", () => {
    const qSubs = [
      makeQuestionSubmission({
        id: "Q1",
        gradingStatus: "graded",
        evaluation: { score: 8, maxScore: 10 },
      }),
      makeQuestionSubmission({
        id: "Q2",
        gradingStatus: "graded",
        evaluation: { score: 6, maxScore: 10 },
      }),
    ] as any[];

    const result = calculateSubmissionSummary(qSubs, 3);

    expect(result.totalScore).toBe(14);
    expect(result.maxScore).toBe(20);
    expect(result.percentage).toBe(70);
    expect(result.grade).toBe("B+");
    expect(result.questionsGraded).toBe(2);
    expect(result.totalQuestions).toBe(3);
  });

  it("should use manual override scores when present", () => {
    const qSubs = [
      makeQuestionSubmission({
        id: "Q1",
        gradingStatus: "overridden",
        evaluation: { score: 5, maxScore: 10 },
        manualOverride: { score: 9, reason: "Teacher review" },
      }),
    ] as any[];

    const result = calculateSubmissionSummary(qSubs, 1);

    expect(result.totalScore).toBe(9);
    expect(result.maxScore).toBe(10);
    expect(result.percentage).toBe(90);
    expect(result.grade).toBe("A+");
  });

  it("should skip non-graded question submissions", () => {
    const qSubs = [
      makeQuestionSubmission({
        id: "Q1",
        gradingStatus: "graded",
        evaluation: { score: 10, maxScore: 10 },
      }),
      makeQuestionSubmission({ id: "Q2", gradingStatus: "pending" }),
      makeQuestionSubmission({ id: "Q3", gradingStatus: "failed" }),
    ] as any[];

    const result = calculateSubmissionSummary(qSubs, 3);

    expect(result.questionsGraded).toBe(1);
    expect(result.totalScore).toBe(10);
  });

  it("should handle empty submissions", () => {
    const result = calculateSubmissionSummary([], 0);

    expect(result.totalScore).toBe(0);
    expect(result.maxScore).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.grade).toBe("F");
  });

  it("should handle manual status as graded", () => {
    const qSubs = [
      makeQuestionSubmission({
        id: "Q1",
        gradingStatus: "manual",
        evaluation: { score: 7, maxScore: 10 },
        manualOverride: { score: 7, reason: "Manual grading" },
      }),
    ] as any[];

    const result = calculateSubmissionSummary(qSubs, 1);

    expect(result.questionsGraded).toBe(1);
    expect(result.totalScore).toBe(7);
  });
});
