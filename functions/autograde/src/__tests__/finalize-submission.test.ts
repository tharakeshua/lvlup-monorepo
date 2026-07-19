import { describe, it, expect } from "vitest";
import { calculateSubmissionSummary, calculateGrade } from "../utils/grading-helpers";

/**
 * Tests for the finalize-submission pipeline step.
 *
 * finalizeSubmission calls calculateSubmissionSummary and writes to Firestore.
 * We test the summary calculation logic and grade assignment.
 */

describe("finalize-submission — score aggregation", () => {
  it("should produce correct summary for a fully graded submission", () => {
    const questionSubs = [
      { gradingStatus: "graded", evaluation: { score: 8, maxScore: 10 } },
      { gradingStatus: "graded", evaluation: { score: 15, maxScore: 20 } },
      { gradingStatus: "graded", evaluation: { score: 12, maxScore: 20 } },
      { gradingStatus: "graded", evaluation: { score: 20, maxScore: 25 } },
      { gradingStatus: "graded", evaluation: { score: 18, maxScore: 25 } },
    ] as any[];

    const summary = calculateSubmissionSummary(questionSubs, 5);

    expect(summary.totalScore).toBe(73);
    expect(summary.maxScore).toBe(100);
    expect(summary.percentage).toBe(73);
    expect(summary.grade).toBe("B+");
    expect(summary.questionsGraded).toBe(5);
    expect(summary.totalQuestions).toBe(5);
  });

  it("should handle partial grading (some failed)", () => {
    const questionSubs = [
      { gradingStatus: "graded", evaluation: { score: 10, maxScore: 20 } },
      { gradingStatus: "failed", evaluation: null },
      { gradingStatus: "graded", evaluation: { score: 15, maxScore: 20 } },
    ] as any[];

    const summary = calculateSubmissionSummary(questionSubs, 3);

    expect(summary.questionsGraded).toBe(2);
    expect(summary.totalScore).toBe(25);
    expect(summary.maxScore).toBe(40);
  });

  it("should produce F grade for zero score", () => {
    const questionSubs = [
      { gradingStatus: "graded", evaluation: { score: 0, maxScore: 50 } },
    ] as any[];

    const summary = calculateSubmissionSummary(questionSubs, 1);

    expect(summary.percentage).toBe(0);
    expect(summary.grade).toBe("F");
  });

  it("should handle perfect score", () => {
    const questionSubs = [
      { gradingStatus: "graded", evaluation: { score: 10, maxScore: 10 } },
      { gradingStatus: "graded", evaluation: { score: 20, maxScore: 20 } },
    ] as any[];

    const summary = calculateSubmissionSummary(questionSubs, 2);

    expect(summary.percentage).toBe(100);
    expect(summary.grade).toBe("A+");
  });

  it("should compute all grade boundaries correctly", () => {
    expect(calculateGrade(100)).toBe("A+");
    expect(calculateGrade(89)).toBe("A");
    expect(calculateGrade(79)).toBe("B+");
    expect(calculateGrade(69)).toBe("B");
    expect(calculateGrade(59)).toBe("C");
    expect(calculateGrade(49)).toBe("D");
    expect(calculateGrade(39)).toBe("F");
  });
});
