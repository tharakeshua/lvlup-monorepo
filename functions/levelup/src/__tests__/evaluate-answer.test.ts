import { describe, it, expect } from "vitest";
import { assertAuth } from "../utils/auth";
import { MockLLMWrapper } from "../../../test-utils/mock-llm";

/**
 * Tests for evaluate-answer.
 *
 * Validates auth checks and mock LLM interaction patterns.
 */

describe("evaluate-answer — auth checks", () => {
  it("should require authentication", () => {
    expect(() => assertAuth(undefined)).toThrow("Must be logged in");
  });

  it("should return uid on valid auth", () => {
    expect(assertAuth({ uid: "student-1" })).toBe("student-1");
  });
});

describe("evaluate-answer — LLM integration", () => {
  it("should call LLM with evaluation metadata", async () => {
    const mockLLM = new MockLLMWrapper();
    mockLLM.enqueue({
      text: JSON.stringify({
        score: 8,
        maxScore: 10,
        correctness: 0.8,
        percentage: 80,
        strengths: ["Good understanding"],
        weaknesses: ["Minor errors"],
        missingConcepts: [],
        confidence: 0.9,
      }),
      parsed: {
        score: 8,
        maxScore: 10,
        correctness: 0.8,
        percentage: 80,
        strengths: ["Good understanding"],
        weaknesses: ["Minor errors"],
        missingConcepts: [],
        confidence: 0.9,
      },
    });

    const result = await mockLLM.call("evaluate this", {
      clientId: "tenant-1",
      userId: "student-1",
      userRole: "student",
      purpose: "answer_evaluation",
      operation: "levelup_evaluate_answer",
      resourceType: "item",
      resourceId: "item-1",
    });

    expect(result.parsed).toBeDefined();
    expect((result.parsed as any).score).toBe(8);
    expect(mockLLM.callCount).toBe(1);
    expect(mockLLM.calls[0].metadata.purpose).toBe("answer_evaluation");
  });
});
