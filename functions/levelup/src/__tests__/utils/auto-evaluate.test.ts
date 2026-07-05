import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock firebase-admin/firestore for Timestamp.now()
// ---------------------------------------------------------------------------
vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: vi.fn(() => ({
      seconds: 1700000000,
      nanoseconds: 0,
      toDate: () => new Date("2023-11-14T22:13:20Z"),
      toMillis: () => 1700000000000,
    })),
  },
}));

import { autoEvaluateSubmission } from "../../utils/auto-evaluate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeItem(payload: Record<string, unknown>, totalPoints = 1) {
  return {
    id: "item-1",
    payload: { ...payload },
    meta: { totalPoints },
  };
}

function makeSub(questionType: string, answer: unknown) {
  return { questionType, answer };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("autoEvaluateSubmission", () => {
  // ── MCQ ────────────────────────────────────────────────────────────
  describe("MCQ", () => {
    const qData = {
      options: [
        { id: "a", text: "3", isCorrect: false },
        { id: "b", text: "4", isCorrect: true },
      ],
    };

    it("scores correct answer full marks", () => {
      const item = makeItem({ questionData: qData, basePoints: 2 }, 2);
      const result = autoEvaluateSubmission(item as any, makeSub("mcq", "b") as any);

      expect(result).not.toBeNull();
      expect(result!.score).toBe(2);
      expect(result!.correctness).toBe(1);
    });

    it("scores wrong answer zero", () => {
      const item = makeItem({ questionData: qData, basePoints: 2 }, 2);
      const result = autoEvaluateSubmission(item as any, makeSub("mcq", "a") as any);

      expect(result!.score).toBe(0);
      expect(result!.correctness).toBe(0);
    });
  });

  // ── MCAQ ───────────────────────────────────────────────────────────
  describe("MCAQ", () => {
    const qData = {
      options: [
        { id: "a", isCorrect: true },
        { id: "b", isCorrect: true },
        { id: "c", isCorrect: false },
      ],
    };

    it("scores all correct selections full marks", () => {
      const item = makeItem({ questionData: qData, basePoints: 4 }, 4);
      const result = autoEvaluateSubmission(item as any, makeSub("mcaq", ["a", "b"]) as any);

      expect(result!.score).toBe(4);
      expect(result!.correctness).toBe(1);
    });

    it("gives partial credit for partial selections", () => {
      const item = makeItem({ questionData: qData, basePoints: 4 }, 4);
      const result = autoEvaluateSubmission(item as any, makeSub("mcaq", ["a"]) as any);

      expect(result!.score).toBe(2);
      expect(result!.correctness).toBe(0.5);
    });

    it("penalizes wrong selections", () => {
      const item = makeItem({ questionData: qData, basePoints: 4 }, 4);
      const result = autoEvaluateSubmission(item as any, makeSub("mcaq", ["a", "c"]) as any);

      // 1 correct - 1 wrong = 0 out of 2 correct => 0/2 * 4 = 0
      expect(result!.score).toBe(0);
    });
  });

  // ── True/False ─────────────────────────────────────────────────────
  describe("True-false", () => {
    it("scores correct answer", () => {
      const item = makeItem({ questionData: { correctAnswer: true }, basePoints: 1 }, 1);
      const result = autoEvaluateSubmission(item as any, makeSub("true-false", true) as any);

      expect(result!.score).toBe(1);
    });

    it("scores incorrect answer zero", () => {
      const item = makeItem({ questionData: { correctAnswer: true }, basePoints: 1 }, 1);
      const result = autoEvaluateSubmission(item as any, makeSub("true-false", false) as any);

      expect(result!.score).toBe(0);
    });
  });

  // ── Numerical ──────────────────────────────────────────────────────
  describe("Numerical", () => {
    it("scores exact match", () => {
      const item = makeItem(
        { questionData: { correctAnswer: 42, tolerance: 0 }, basePoints: 2 },
        2
      );
      const result = autoEvaluateSubmission(item as any, makeSub("numerical", "42") as any);

      expect(result!.score).toBe(2);
    });

    it("accepts answer within tolerance", () => {
      const item = makeItem(
        { questionData: { correctAnswer: 3.14, tolerance: 0.01 }, basePoints: 1 },
        1
      );
      const result = autoEvaluateSubmission(item as any, makeSub("numerical", "3.145") as any);

      expect(result!.score).toBe(1);
    });

    it("rejects answer outside tolerance", () => {
      const item = makeItem(
        { questionData: { correctAnswer: 3.14, tolerance: 0.001 }, basePoints: 1 },
        1
      );
      const result = autoEvaluateSubmission(item as any, makeSub("numerical", "3.20") as any);

      expect(result!.score).toBe(0);
    });

    it("returns zero for NaN answer", () => {
      const item = makeItem(
        { questionData: { correctAnswer: 42, tolerance: 0 }, basePoints: 1 },
        1
      );
      const result = autoEvaluateSubmission(item as any, makeSub("numerical", "abc") as any);

      expect(result!.score).toBe(0);
    });
  });

  // ── Fill-blanks ────────────────────────────────────────────────────
  describe("Fill-blanks", () => {
    it("scores all correct blanks full marks", () => {
      const qData = {
        blanks: [
          { id: "b1", correctAnswer: "Paris", caseSensitive: false },
          { id: "b2", correctAnswer: "London", caseSensitive: false },
        ],
      };
      const item = makeItem({ questionData: qData, basePoints: 2 }, 2);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("fill-blanks", { b1: "paris", b2: "london" }) as any
      );

      expect(result!.score).toBe(2);
      expect(result!.correctness).toBe(1);
    });

    it("gives partial credit for partially correct blanks", () => {
      const qData = {
        blanks: [
          { id: "b1", correctAnswer: "Paris", caseSensitive: false },
          { id: "b2", correctAnswer: "London", caseSensitive: false },
        ],
      };
      const item = makeItem({ questionData: qData, basePoints: 2 }, 2);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("fill-blanks", { b1: "paris", b2: "wrong" }) as any
      );

      expect(result!.score).toBe(1);
      expect(result!.correctness).toBe(0.5);
    });

    it("respects case sensitivity", () => {
      const qData = {
        blanks: [{ id: "b1", correctAnswer: "Paris", caseSensitive: true }],
      };
      const item = makeItem({ questionData: qData, basePoints: 1 }, 1);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("fill-blanks", { b1: "paris" }) as any
      );

      expect(result!.score).toBe(0);
    });

    it("ignores case when caseSensitive is false", () => {
      const qData = {
        blanks: [{ id: "b1", correctAnswer: "Paris", caseSensitive: false }],
      };
      const item = makeItem({ questionData: qData, basePoints: 1 }, 1);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("fill-blanks", { b1: "PARIS" }) as any
      );

      expect(result!.score).toBe(1);
    });

    it("accepts acceptable answers", () => {
      const qData = {
        blanks: [
          {
            id: "b1",
            correctAnswer: "USA",
            caseSensitive: false,
            acceptableAnswers: ["United States", "US"],
          },
        ],
      };
      const item = makeItem({ questionData: qData, basePoints: 1 }, 1);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("fill-blanks", { b1: "United States" }) as any
      );

      expect(result!.score).toBe(1);
    });
  });

  // ── Fill-blanks-dd ─────────────────────────────────────────────────
  describe("Fill-blanks-dd", () => {
    const qData = {
      blanks: [
        { id: "b1", correctOptionId: "opt-a" },
        { id: "b2", correctOptionId: "opt-b" },
      ],
    };

    it("scores correct option selection", () => {
      const item = makeItem({ questionData: qData, basePoints: 2 }, 2);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("fill-blanks-dd", { b1: "opt-a", b2: "opt-b" }) as any
      );

      expect(result!.score).toBe(2);
    });

    it("scores wrong option selection", () => {
      const item = makeItem({ questionData: qData, basePoints: 2 }, 2);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("fill-blanks-dd", { b1: "opt-a", b2: "opt-x" }) as any
      );

      expect(result!.score).toBe(1);
    });
  });

  // ── Matching ───────────────────────────────────────────────────────
  describe("Matching", () => {
    const qData = {
      pairs: [
        { id: "p1", left: "France", right: "Paris" },
        { id: "p2", left: "UK", right: "London" },
      ],
    };

    // Standard-pairs grading maps leftPairId → rightPairId (same pair id =
    // correct match) — answers carry pair IDs, not right-side display values.
    it("scores all correct matches full marks", () => {
      const item = makeItem({ questionData: qData, basePoints: 2 }, 2);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("matching", { p1: "p1", p2: "p2" }) as any
      );

      expect(result!.score).toBe(2);
      expect(result!.correctness).toBe(1);
    });

    it("gives partial credit for partial matches", () => {
      const item = makeItem({ questionData: qData, basePoints: 2 }, 2);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("matching", { p1: "p1", p2: "p3" }) as any
      );

      expect(result!.score).toBe(1);
    });
  });

  // ── Jumbled ────────────────────────────────────────────────────────
  describe("Jumbled", () => {
    const qData = { correctOrder: ["c", "a", "b"] };

    it("scores correct order full marks", () => {
      const item = makeItem({ questionData: qData, basePoints: 3 }, 3);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("jumbled", ["c", "a", "b"]) as any
      );

      expect(result!.score).toBe(3);
    });

    it("scores wrong order zero", () => {
      const item = makeItem({ questionData: qData, basePoints: 3 }, 3);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("jumbled", ["a", "b", "c"]) as any
      );

      expect(result!.score).toBe(0);
    });

    it("scores zero when lengths differ", () => {
      const item = makeItem({ questionData: qData, basePoints: 3 }, 3);
      const result = autoEvaluateSubmission(item as any, makeSub("jumbled", ["c", "a"]) as any);

      expect(result!.score).toBe(0);
    });
  });

  // ── Group-options ──────────────────────────────────────────────────
  describe("Group-options", () => {
    const qData = {
      groups: [
        { id: "g1", correctItems: ["x", "y"] },
        { id: "g2", correctItems: ["z"] },
      ],
    };

    it("scores all correct placements full marks", () => {
      const item = makeItem({ questionData: qData, basePoints: 3 }, 3);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("group-options", { g1: ["x", "y"], g2: ["z"] }) as any
      );

      expect(result!.score).toBe(3);
      expect(result!.correctness).toBe(1);
    });

    it("gives partial credit for partial placements", () => {
      const item = makeItem({ questionData: qData, basePoints: 3 }, 3);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("group-options", { g1: ["x"], g2: ["z"] }) as any
      );

      // 2 correct, 0 wrong, 3 total => (2/3) * 3 = 2
      expect(result!.score).toBe(2);
    });

    it("penalizes wrong group placements", () => {
      const item = makeItem({ questionData: qData, basePoints: 3 }, 3);
      const result = autoEvaluateSubmission(
        item as any,
        makeSub("group-options", { g1: ["x", "y", "z"], g2: ["wrong"] }) as any
      );

      // g1: x correct, y correct, z wrong (not in g1 correct set)
      // g2: wrong is not in g2 correct set
      // correctItems=2, wrongItems=2, totalItems=3
      // score = max(0, (2-2)/3) * 3 = 0
      expect(result!.score).toBe(0);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────
  describe("Edge cases", () => {
    it("returns null for unknown question type", () => {
      const item = makeItem({ questionData: {}, basePoints: 1 }, 1);
      const result = autoEvaluateSubmission(item as any, makeSub("essay", "answer") as any);

      expect(result).toBeNull();
    });

    it("returns null when no qData is available", () => {
      const item = { id: "item-1", payload: {}, meta: { totalPoints: 1 } };
      const result = autoEvaluateSubmission(item as any, makeSub("mcq", "a") as any);

      expect(result).toBeNull();
    });
  });
});
