import { describe, it, expect } from "vitest";
import { autoEvaluateSubmission } from "../utils/auto-evaluate";
import { makeItem } from "../../../test-utils/test-data";

/**
 * Tests for submit-test-session — auto-evaluation of deterministic question types.
 */

describe("autoEvaluateSubmission", () => {
  describe("MCQ", () => {
    it("should grade correct MCQ answer", () => {
      const item = makeItem({
        payload: {
          questionType: "mcq",
          questionData: {
            options: [
              { id: "a", text: "3", isCorrect: false },
              { id: "b", text: "4", isCorrect: true },
            ],
          },
          basePoints: 1,
        },
        meta: { totalPoints: 1 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "mcq", answer: "b" } as any
      );

      expect(result).not.toBeNull();
      expect(result!.score).toBe(1);
      expect(result!.correctness).toBe(1);
    });

    it("should grade incorrect MCQ answer", () => {
      const item = makeItem({
        payload: {
          questionType: "mcq",
          questionData: {
            options: [
              { id: "a", text: "3", isCorrect: false },
              { id: "b", text: "4", isCorrect: true },
            ],
          },
          basePoints: 2,
        },
        meta: { totalPoints: 2 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "mcq", answer: "a" } as any
      );

      expect(result).not.toBeNull();
      expect(result!.score).toBe(0);
    });
  });

  describe("MCAQ (multiple correct)", () => {
    it("should grade fully correct MCAQ", () => {
      const item = makeItem({
        payload: {
          questionType: "mcaq",
          questionData: {
            options: [
              { id: "a", isCorrect: true },
              { id: "b", isCorrect: true },
              { id: "c", isCorrect: false },
            ],
          },
          basePoints: 4,
        },
        meta: { totalPoints: 4 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "mcaq", answer: ["a", "b"] } as any
      );

      expect(result).not.toBeNull();
      expect(result!.score).toBe(4);
      expect(result!.correctness).toBe(1);
    });

    it("should deduct for wrong selections", () => {
      const item = makeItem({
        payload: {
          questionType: "mcaq",
          questionData: {
            options: [
              { id: "a", isCorrect: true },
              { id: "b", isCorrect: true },
              { id: "c", isCorrect: false },
            ],
          },
          basePoints: 4,
        },
        meta: { totalPoints: 4 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "mcaq", answer: ["a", "c"] } as any
      );

      expect(result).not.toBeNull();
      // 1 correct - 1 wrong = 0 out of 2 correct => 0/2 * 4 = 0
      expect(result!.score).toBe(0);
    });
  });

  describe("True/False", () => {
    it("should grade correct true/false", () => {
      const item = makeItem({
        payload: {
          questionType: "true-false",
          questionData: { correctAnswer: true },
          basePoints: 1,
        },
        meta: { totalPoints: 1 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "true-false", answer: true } as any
      );

      expect(result!.score).toBe(1);
    });
  });

  describe("Numerical", () => {
    it("should grade exact numerical answer", () => {
      const item = makeItem({
        payload: {
          questionType: "numerical",
          questionData: { correctAnswer: 42, tolerance: 0 },
          basePoints: 2,
        },
        meta: { totalPoints: 2 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "numerical", answer: "42" } as any
      );

      expect(result!.score).toBe(2);
    });

    it("should accept answer within tolerance", () => {
      const item = makeItem({
        payload: {
          questionType: "numerical",
          questionData: { correctAnswer: 3.14, tolerance: 0.01 },
          basePoints: 1,
        },
        meta: { totalPoints: 1 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "numerical", answer: "3.14159" } as any
      );

      // |3.14159 - 3.14| = 0.00159 which is within 0.01 tolerance
      expect(result!.score).toBe(1);
    });

    it("should reject answer outside tolerance", () => {
      const item = makeItem({
        payload: {
          questionType: "numerical",
          questionData: { correctAnswer: 3.14, tolerance: 0.001 },
          basePoints: 1,
        },
        meta: { totalPoints: 1 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "numerical", answer: "3.15" } as any
      );

      // |3.15 - 3.14| = 0.01 which is > 0.001 tolerance
      expect(result!.score).toBe(0);
    });
  });

  describe("Jumbled", () => {
    it("should grade correct order", () => {
      const item = makeItem({
        payload: {
          questionType: "jumbled",
          questionData: { correctOrder: ["c", "a", "b"] },
          basePoints: 3,
        },
        meta: { totalPoints: 3 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "jumbled", answer: ["c", "a", "b"] } as any
      );

      expect(result!.score).toBe(3);
    });

    it("should grade wrong order as 0", () => {
      const item = makeItem({
        payload: {
          questionType: "jumbled",
          questionData: { correctOrder: ["c", "a", "b"] },
          basePoints: 3,
        },
        meta: { totalPoints: 3 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "jumbled", answer: ["a", "b", "c"] } as any
      );

      expect(result!.score).toBe(0);
    });
  });

  describe("Non-auto-evaluatable types", () => {
    it("should return null for text questions (AI required)", () => {
      const item = makeItem({
        payload: { questionType: "text", basePoints: 5 },
        meta: { totalPoints: 5 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "text", answer: "Some long answer" } as any
      );

      expect(result).toBeNull();
    });

    it("should return null for paragraph questions", () => {
      const item = makeItem({
        payload: { questionType: "paragraph", basePoints: 10 },
        meta: { totalPoints: 10 },
      });

      const result = autoEvaluateSubmission(
        item as any,
        { questionType: "paragraph", answer: "Essay answer" } as any
      );

      expect(result).toBeNull();
    });
  });
});
