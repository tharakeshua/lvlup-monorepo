/**
 * Unit tests for callable/create-item.ts
 *
 * Tests the pure utility functions: extractAnswerKey and stripAnswerFromPayload.
 * These have no Firebase dependencies and can be tested directly.
 */
import { describe, it, expect } from "vitest";
import { extractAnswerKey, stripAnswerFromPayload } from "../../callable/create-item";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload(
  questionType: string,
  questionData: Record<string, unknown>
): Record<string, unknown> {
  return { questionType, questionData };
}

// ── extractAnswerKey ────────────────────────────────────────────────────────

describe("extractAnswerKey", () => {
  it("returns null when questionData is missing", () => {
    expect(extractAnswerKey({ questionType: "mcq" })).toBeNull();
  });

  it("returns null when questionType is missing", () => {
    expect(extractAnswerKey({ questionData: { options: [] } })).toBeNull();
  });

  it("returns null for empty payload", () => {
    expect(extractAnswerKey({})).toBeNull();
  });

  // ── MCQ ──

  describe("mcq", () => {
    it("returns correct option IDs", () => {
      const payload = makePayload("mcq", {
        options: [
          { id: "opt-1", text: "A", isCorrect: true },
          { id: "opt-2", text: "B", isCorrect: false },
          { id: "opt-3", text: "C", isCorrect: false },
        ],
      });

      const result = extractAnswerKey(payload);
      expect(result).toEqual({ correctAnswer: ["opt-1"] });
    });

    it("returns empty array when no correct option", () => {
      const payload = makePayload("mcq", {
        options: [
          { id: "opt-1", text: "A", isCorrect: false },
          { id: "opt-2", text: "B", isCorrect: false },
        ],
      });

      const result = extractAnswerKey(payload);
      expect(result).toEqual({ correctAnswer: [] });
    });

    it("handles missing options gracefully", () => {
      const payload = makePayload("mcq", {});
      const result = extractAnswerKey(payload);
      expect(result).toEqual({ correctAnswer: [] });
    });
  });

  // ── MCAQ ──

  describe("mcaq", () => {
    it("returns multiple correct option IDs", () => {
      const payload = makePayload("mcaq", {
        options: [
          { id: "opt-1", text: "A", isCorrect: true },
          { id: "opt-2", text: "B", isCorrect: true },
          { id: "opt-3", text: "C", isCorrect: false },
          { id: "opt-4", text: "D", isCorrect: true },
        ],
      });

      const result = extractAnswerKey(payload);
      expect(result).toEqual({ correctAnswer: ["opt-1", "opt-2", "opt-4"] });
    });

    it("returns empty array when no options are correct", () => {
      const payload = makePayload("mcaq", {
        options: [{ id: "opt-1", text: "A", isCorrect: false }],
      });

      const result = extractAnswerKey(payload);
      expect(result).toEqual({ correctAnswer: [] });
    });
  });

  // ── True/False ──

  describe("true-false", () => {
    it("returns correctAnswer true", () => {
      const payload = makePayload("true-false", { correctAnswer: true });
      expect(extractAnswerKey(payload)).toEqual({ correctAnswer: true });
    });

    it("returns correctAnswer false", () => {
      const payload = makePayload("true-false", { correctAnswer: false });
      expect(extractAnswerKey(payload)).toEqual({ correctAnswer: false });
    });
  });

  // ── Numerical ──

  describe("numerical", () => {
    it("returns correctAnswer with tolerance", () => {
      const payload = makePayload("numerical", {
        correctAnswer: 42,
        tolerance: 0.5,
      });

      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: 42,
        acceptableAnswers: [{ tolerance: 0.5 }],
      });
    });

    it("returns correctAnswer without tolerance when tolerance is null", () => {
      const payload = makePayload("numerical", {
        correctAnswer: 42,
        tolerance: null,
      });

      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: 42,
        acceptableAnswers: undefined,
      });
    });

    it("returns correctAnswer without tolerance when tolerance is undefined", () => {
      const payload = makePayload("numerical", { correctAnswer: 100 });
      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: 100,
        acceptableAnswers: undefined,
      });
    });

    it("handles zero tolerance", () => {
      const payload = makePayload("numerical", {
        correctAnswer: 10,
        tolerance: 0,
      });

      // tolerance 0 is != null, so it IS included
      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: 10,
        acceptableAnswers: [{ tolerance: 0 }],
      });
    });
  });

  // ── Text ──

  describe("text", () => {
    it("returns correctAnswer and acceptableAnswers", () => {
      const payload = makePayload("text", {
        correctAnswer: "photosynthesis",
        acceptableAnswers: ["photo-synthesis", "Photo Synthesis"],
      });

      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: "photosynthesis",
        acceptableAnswers: ["photo-synthesis", "Photo Synthesis"],
      });
    });

    it("returns correctAnswer without acceptableAnswers when not provided", () => {
      const payload = makePayload("text", { correctAnswer: "hello" });
      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: "hello",
        acceptableAnswers: undefined,
      });
    });
  });

  // ── Fill Blanks ──

  describe("fill-blanks", () => {
    it("returns array of blank answers", () => {
      const payload = makePayload("fill-blanks", {
        blanks: [
          { id: "b1", correctAnswer: "Paris", acceptableAnswers: ["paris"] },
          { id: "b2", correctAnswer: "France", acceptableAnswers: [] },
        ],
      });

      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: [
          { id: "b1", correctAnswer: "Paris", acceptableAnswers: ["paris"] },
          { id: "b2", correctAnswer: "France", acceptableAnswers: [] },
        ],
      });
    });

    it("handles empty blanks array", () => {
      const payload = makePayload("fill-blanks", { blanks: [] });
      expect(extractAnswerKey(payload)).toEqual({ correctAnswer: [] });
    });

    it("handles missing blanks field", () => {
      const payload = makePayload("fill-blanks", {});
      expect(extractAnswerKey(payload)).toEqual({ correctAnswer: [] });
    });
  });

  // ── Fill Blanks Dropdown ──

  describe("fill-blanks-dd", () => {
    it("returns blank IDs with correct option IDs", () => {
      const payload = makePayload("fill-blanks-dd", {
        blanks: [
          { id: "b1", correctOptionId: "opt-a", options: ["opt-a", "opt-b"] },
          { id: "b2", correctOptionId: "opt-c", options: ["opt-c", "opt-d"] },
        ],
      });

      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: [
          { id: "b1", correctOptionId: "opt-a" },
          { id: "b2", correctOptionId: "opt-c" },
        ],
      });
    });
  });

  // ── Matching ──

  describe("matching", () => {
    it("returns pairs with left-right mappings", () => {
      const payload = makePayload("matching", {
        pairs: [
          { id: "p1", left: "Dog", right: "Bark" },
          { id: "p2", left: "Cat", right: "Meow" },
        ],
      });

      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: [
          { id: "p1", left: "Dog", right: "Bark" },
          { id: "p2", left: "Cat", right: "Meow" },
        ],
      });
    });

    it("handles empty pairs", () => {
      const payload = makePayload("matching", { pairs: [] });
      expect(extractAnswerKey(payload)).toEqual({ correctAnswer: [] });
    });
  });

  // ── Jumbled ──

  describe("jumbled", () => {
    it("returns correctOrder array", () => {
      const payload = makePayload("jumbled", {
        correctOrder: ["c", "a", "b", "d"],
      });

      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: ["c", "a", "b", "d"],
      });
    });
  });

  // ── Group Options ──

  describe("group-options", () => {
    it("returns groups with correct items", () => {
      const payload = makePayload("group-options", {
        groups: [
          { id: "g1", name: "Fruits", correctItems: ["apple", "banana"] },
          { id: "g2", name: "Vegetables", correctItems: ["carrot", "peas"] },
        ],
      });

      expect(extractAnswerKey(payload)).toEqual({
        correctAnswer: [
          { id: "g1", correctItems: ["apple", "banana"] },
          { id: "g2", correctItems: ["carrot", "peas"] },
        ],
      });
    });
  });

  // ── AI-evaluated types ──

  describe("AI-evaluated types", () => {
    it.each(["paragraph", "code", "audio", "image_evaluation", "chat_agent_question"])(
      "returns null for %s type",
      (type) => {
        const payload = makePayload(type, { prompt: "Write something" });
        expect(extractAnswerKey(payload)).toBeNull();
      }
    );

    it("returns null for unknown question type", () => {
      const payload = makePayload("unknown-type", { data: "test" });
      expect(extractAnswerKey(payload)).toBeNull();
    });
  });
});

// ── stripAnswerFromPayload ──────────────────────────────────────────────────

describe("stripAnswerFromPayload", () => {
  it("returns payload as-is when questionData is missing", () => {
    const payload = { questionType: "mcq" };
    expect(stripAnswerFromPayload(payload)).toEqual(payload);
  });

  it("returns payload as-is when questionType is missing", () => {
    const payload = { questionData: { options: [] } };
    expect(stripAnswerFromPayload(payload)).toEqual(payload);
  });

  // ── MCQ / MCAQ ──

  describe("mcq/mcaq", () => {
    it("removes isCorrect from MCQ options", () => {
      const payload = makePayload("mcq", {
        text: "What is 2+2?",
        options: [
          { id: "opt-1", text: "3", isCorrect: false },
          { id: "opt-2", text: "4", isCorrect: true },
          { id: "opt-3", text: "5", isCorrect: false },
        ],
      });

      const result = stripAnswerFromPayload(payload);
      const qd = result.questionData as Record<string, unknown>;
      const options = qd.options as any[];

      expect(options).toHaveLength(3);
      for (const opt of options) {
        expect(opt.isCorrect).toBeUndefined();
        // Should preserve other fields
        expect(opt.id).toBeDefined();
        expect(opt.text).toBeDefined();
      }
      // Preserves question text
      expect(qd.text).toBe("What is 2+2?");
    });

    it("removes isCorrect from MCAQ options", () => {
      const payload = makePayload("mcaq", {
        options: [
          { id: "opt-1", text: "A", isCorrect: true },
          { id: "opt-2", text: "B", isCorrect: true },
        ],
      });

      const result = stripAnswerFromPayload(payload);
      const options = (result.questionData as any).options as any[];

      for (const opt of options) {
        expect(opt.isCorrect).toBeUndefined();
      }
    });
  });

  // ── True/False ──

  describe("true-false", () => {
    it("removes correctAnswer", () => {
      const payload = makePayload("true-false", {
        statement: "The earth is flat",
        correctAnswer: false,
      });

      const result = stripAnswerFromPayload(payload);
      const qd = result.questionData as Record<string, unknown>;

      expect(qd.correctAnswer).toBeUndefined();
      expect(qd.statement).toBe("The earth is flat");
    });
  });

  // ── Numerical ──

  describe("numerical", () => {
    it("removes correctAnswer and tolerance", () => {
      const payload = makePayload("numerical", {
        text: "What is pi to 2 decimal places?",
        correctAnswer: 3.14,
        tolerance: 0.01,
        unit: "none",
      });

      const result = stripAnswerFromPayload(payload);
      const qd = result.questionData as Record<string, unknown>;

      expect(qd.correctAnswer).toBeUndefined();
      expect(qd.tolerance).toBeUndefined();
      // Preserves non-answer fields
      expect(qd.text).toBe("What is pi to 2 decimal places?");
      expect(qd.unit).toBe("none");
    });
  });

  // ── Text ──

  describe("text", () => {
    it("removes correctAnswer and acceptableAnswers", () => {
      const payload = makePayload("text", {
        text: "Name the process",
        correctAnswer: "photosynthesis",
        acceptableAnswers: ["photo synthesis"],
        caseSensitive: false,
      });

      const result = stripAnswerFromPayload(payload);
      const qd = result.questionData as Record<string, unknown>;

      expect(qd.correctAnswer).toBeUndefined();
      expect(qd.acceptableAnswers).toBeUndefined();
      // caseSensitive is removed as part of the spread since it is in strippedData
      // but the switch case only deletes correctAnswer and acceptableAnswers
      expect(qd.caseSensitive).toBe(false);
    });
  });

  // ── Fill Blanks ──

  describe("fill-blanks", () => {
    it("strips answer info from blanks, keeps only id", () => {
      const payload = makePayload("fill-blanks", {
        text: "The capital of ___ is ___",
        blanks: [
          { id: "b1", correctAnswer: "France", acceptableAnswers: ["france"] },
          { id: "b2", correctAnswer: "Paris", acceptableAnswers: [] },
        ],
      });

      const result = stripAnswerFromPayload(payload);
      const qd = result.questionData as Record<string, unknown>;
      const blanks = qd.blanks as any[];

      expect(blanks).toHaveLength(2);
      expect(blanks[0]).toEqual({ id: "b1" });
      expect(blanks[1]).toEqual({ id: "b2" });
      // Preserves text
      expect(qd.text).toBe("The capital of ___ is ___");
    });
  });

  // ── Fill Blanks Dropdown ──

  describe("fill-blanks-dd", () => {
    it("removes correctOptionId, keeps id and options", () => {
      const payload = makePayload("fill-blanks-dd", {
        blanks: [{ id: "b1", correctOptionId: "opt-a", options: ["opt-a", "opt-b", "opt-c"] }],
      });

      const result = stripAnswerFromPayload(payload);
      const blanks = (result.questionData as any).blanks as any[];

      expect(blanks[0]).toEqual({
        id: "b1",
        options: ["opt-a", "opt-b", "opt-c"],
      });
      expect(blanks[0].correctOptionId).toBeUndefined();
    });
  });

  // ── Matching ──

  describe("matching", () => {
    it("preserves pair structure (id, left, right)", () => {
      const payload = makePayload("matching", {
        pairs: [
          { id: "p1", left: "Dog", right: "Bark", extra: "data" },
          { id: "p2", left: "Cat", right: "Meow" },
        ],
      });

      const result = stripAnswerFromPayload(payload);
      const pairs = (result.questionData as any).pairs as any[];

      // The implementation maps to { id, left, right } so extra fields are dropped
      expect(pairs[0]).toEqual({ id: "p1", left: "Dog", right: "Bark" });
      expect(pairs[1]).toEqual({ id: "p2", left: "Cat", right: "Meow" });
    });
  });

  // ── Jumbled ──

  describe("jumbled", () => {
    it("removes correctOrder", () => {
      const payload = makePayload("jumbled", {
        items: ["a", "b", "c", "d"],
        correctOrder: ["c", "a", "b", "d"],
      });

      const result = stripAnswerFromPayload(payload);
      const qd = result.questionData as Record<string, unknown>;

      expect(qd.correctOrder).toBeUndefined();
      expect(qd.items).toEqual(["a", "b", "c", "d"]);
    });
  });

  // ── Group Options ──

  describe("group-options", () => {
    it("removes correctItems, keeps id and name", () => {
      const payload = makePayload("group-options", {
        groups: [
          { id: "g1", name: "Fruits", correctItems: ["apple", "banana"] },
          { id: "g2", name: "Vegetables", correctItems: ["carrot"] },
        ],
      });

      const result = stripAnswerFromPayload(payload);
      const groups = (result.questionData as any).groups as any[];

      expect(groups[0]).toEqual({ id: "g1", name: "Fruits" });
      expect(groups[1]).toEqual({ id: "g2", name: "Vegetables" });
      expect(groups[0].correctItems).toBeUndefined();
    });
  });

  // ── Immutability ──

  describe("immutability", () => {
    it("does not mutate the original payload", () => {
      const original = makePayload("mcq", {
        text: "What?",
        options: [
          { id: "opt-1", text: "A", isCorrect: true },
          { id: "opt-2", text: "B", isCorrect: false },
        ],
      });

      // Deep copy for comparison
      const originalCopy = JSON.parse(JSON.stringify(original));

      stripAnswerFromPayload(original);

      // Original should not be mutated
      expect(original).toEqual(originalCopy);
    });

    it("returns a new object (not the same reference)", () => {
      const payload = makePayload("text", {
        correctAnswer: "hello",
      });

      const result = stripAnswerFromPayload(payload);
      expect(result).not.toBe(payload);
      expect(result.questionData).not.toBe(payload.questionData);
    });

    it("does not mutate original numerical payload", () => {
      const original = makePayload("numerical", {
        correctAnswer: 42,
        tolerance: 0.5,
        unit: "cm",
      });

      const originalData = original.questionData as Record<string, unknown>;

      stripAnswerFromPayload(original);

      // Original should still have correctAnswer and tolerance
      expect(originalData.correctAnswer).toBe(42);
      expect(originalData.tolerance).toBe(0.5);
    });
  });

  // ── Preserves non-answer fields ──

  describe("preserves non-answer fields", () => {
    it("preserves top-level payload fields", () => {
      const payload = {
        questionType: "mcq",
        questionData: {
          options: [{ id: "o1", text: "A", isCorrect: true }],
        },
        title: "My Question",
        difficulty: "hard",
        tags: ["math", "algebra"],
      };

      const result = stripAnswerFromPayload(payload);
      expect(result.title).toBe("My Question");
      expect(result.difficulty).toBe("hard");
      expect(result.tags).toEqual(["math", "algebra"]);
      expect(result.questionType).toBe("mcq");
    });

    it("preserves non-answer questionData fields for numerical", () => {
      const payload = makePayload("numerical", {
        text: "Calculate the area",
        correctAnswer: 25,
        tolerance: 0.1,
        unit: "cm2",
        hint: "Think about squares",
      });

      const result = stripAnswerFromPayload(payload);
      const qd = result.questionData as Record<string, unknown>;

      expect(qd.text).toBe("Calculate the area");
      expect(qd.unit).toBe("cm2");
      expect(qd.hint).toBe("Think about squares");
    });
  });

  // ── Unknown types pass through ──

  it("returns payload unchanged for unknown question type", () => {
    const payload = makePayload("paragraph", {
      prompt: "Write an essay",
      rubric: "content + grammar",
    });

    const result = stripAnswerFromPayload(payload);
    const qd = result.questionData as Record<string, unknown>;

    expect(qd.prompt).toBe("Write an essay");
    expect(qd.rubric).toBe("content + grammar");
  });
});
