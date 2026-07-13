import { describe, it, expect } from "vitest";
import type { AdaptiveConfig } from "@levelup/shared-types";
import {
  createInitialAdaptiveState,
  getNextDifficulty,
  updateAdaptiveState,
  selectNextQuestion,
} from "../../levelup/adaptive-engine";
import type { AdaptiveState, QuestionMeta } from "../../levelup/adaptive-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseConfig: AdaptiveConfig = {
  enabled: true,
  initialDifficulty: "medium",
  difficultyAdjustment: "gradual",
  minQuestionsPerDifficulty: 2,
  maxConsecutiveSameDifficulty: 5,
};

const aggressiveConfig: AdaptiveConfig = {
  ...baseConfig,
  difficultyAdjustment: "aggressive",
};

function makeState(overrides: Partial<AdaptiveState> = {}): AdaptiveState {
  return {
    currentDifficulty: "medium",
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    answeredByDifficulty: { easy: 0, medium: 0, hard: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("adaptive-engine", () => {
  // ── createInitialAdaptiveState ────────────────────────────────────

  describe("createInitialAdaptiveState", () => {
    it("sets initialDifficulty from config", () => {
      const state = createInitialAdaptiveState({ ...baseConfig, initialDifficulty: "easy" });
      expect(state.currentDifficulty).toBe("easy");
    });

    it("zeroes all counters", () => {
      const state = createInitialAdaptiveState(baseConfig);
      expect(state.consecutiveCorrect).toBe(0);
      expect(state.consecutiveIncorrect).toBe(0);
      expect(state.answeredByDifficulty).toEqual({ easy: 0, medium: 0, hard: 0 });
    });

    it("respects hard initialDifficulty", () => {
      const state = createInitialAdaptiveState({ ...baseConfig, initialDifficulty: "hard" });
      expect(state.currentDifficulty).toBe("hard");
    });
  });

  // ── getNextDifficulty ─────────────────────────────────────────────

  describe("getNextDifficulty", () => {
    it("stays at same difficulty when below minQuestionsPerDifficulty", () => {
      // Only 0 questions answered at medium, minQuestionsPerDifficulty = 2
      const state = makeState({
        currentDifficulty: "medium",
        consecutiveCorrect: 2,
        answeredByDifficulty: { easy: 0, medium: 0, hard: 0 },
      });

      const next = getNextDifficulty(state, baseConfig, true);
      expect(next).toBe("medium");
    });

    it("shifts up after threshold consecutive correct (aggressive = 2)", () => {
      // 1 consecutive correct already + 1 new correct = 2 >= aggressive threshold
      const state = makeState({
        currentDifficulty: "medium",
        consecutiveCorrect: 1,
        answeredByDifficulty: { easy: 0, medium: 3, hard: 0 },
      });

      const next = getNextDifficulty(state, aggressiveConfig, true);
      expect(next).toBe("hard");
    });

    it("shifts up after threshold consecutive correct (normal = 3)", () => {
      // 2 consecutive correct + 1 new correct = 3 >= gradual threshold
      const state = makeState({
        currentDifficulty: "easy",
        consecutiveCorrect: 2,
        answeredByDifficulty: { easy: 4, medium: 0, hard: 0 },
      });

      const next = getNextDifficulty(state, baseConfig, true);
      expect(next).toBe("medium");
    });

    it("shifts down after threshold consecutive incorrect", () => {
      // 2 consecutive incorrect + 1 new incorrect = 3 >= gradual threshold
      const state = makeState({
        currentDifficulty: "hard",
        consecutiveIncorrect: 2,
        answeredByDifficulty: { easy: 0, medium: 0, hard: 4 },
      });

      const next = getNextDifficulty(state, baseConfig, false);
      expect(next).toBe("medium");
    });

    it("does not shift above hard", () => {
      const state = makeState({
        currentDifficulty: "hard",
        consecutiveCorrect: 5,
        answeredByDifficulty: { easy: 0, medium: 0, hard: 4 },
      });

      const next = getNextDifficulty(state, baseConfig, true);
      expect(next).toBe("hard");
    });

    it("does not shift below easy", () => {
      const state = makeState({
        currentDifficulty: "easy",
        consecutiveIncorrect: 5,
        answeredByDifficulty: { easy: 4, medium: 0, hard: 0 },
      });

      const next = getNextDifficulty(state, baseConfig, false);
      expect(next).toBe("easy");
    });

    it("forces shift up after maxConsecutiveSameDifficulty when correct", () => {
      // 4 already answered at medium + 1 = 5 >= maxConsecutiveSameDifficulty
      const state = makeState({
        currentDifficulty: "medium",
        consecutiveCorrect: 0,
        answeredByDifficulty: { easy: 0, medium: 4, hard: 0 },
      });

      const next = getNextDifficulty(state, baseConfig, true);
      expect(next).toBe("hard");
    });

    it("forces shift down after maxConsecutiveSameDifficulty when incorrect", () => {
      const state = makeState({
        currentDifficulty: "medium",
        consecutiveIncorrect: 0,
        answeredByDifficulty: { easy: 0, medium: 4, hard: 0 },
      });

      const next = getNextDifficulty(state, baseConfig, false);
      expect(next).toBe("easy");
    });

    it("stays at same difficulty when not enough consecutive answers", () => {
      const state = makeState({
        currentDifficulty: "medium",
        consecutiveCorrect: 0,
        answeredByDifficulty: { easy: 0, medium: 2, hard: 0 },
      });

      const next = getNextDifficulty(state, baseConfig, true);
      expect(next).toBe("medium");
    });
  });

  // ── updateAdaptiveState ───────────────────────────────────────────

  describe("updateAdaptiveState", () => {
    it("increments consecutiveCorrect on correct answer", () => {
      const state = makeState({
        currentDifficulty: "medium",
        consecutiveCorrect: 1,
        answeredByDifficulty: { easy: 0, medium: 1, hard: 0 },
      });

      const updated = updateAdaptiveState(state, baseConfig, true);

      expect(updated.consecutiveCorrect).toBe(2);
    });

    it("resets consecutiveCorrect on incorrect answer", () => {
      const state = makeState({
        currentDifficulty: "medium",
        consecutiveCorrect: 2,
        answeredByDifficulty: { easy: 0, medium: 1, hard: 0 },
      });

      const updated = updateAdaptiveState(state, baseConfig, false);

      expect(updated.consecutiveCorrect).toBe(0);
    });

    it("increments answeredByDifficulty for the current difficulty", () => {
      const state = makeState({
        currentDifficulty: "easy",
        answeredByDifficulty: { easy: 2, medium: 0, hard: 0 },
      });

      const updated = updateAdaptiveState(state, baseConfig, true);

      expect(updated.answeredByDifficulty.easy).toBe(3);
    });

    it("resets consecutive counters when difficulty changes", () => {
      // Enough consecutive correct to trigger a shift: 2 already + 1 = 3 >= threshold
      const state = makeState({
        currentDifficulty: "easy",
        consecutiveCorrect: 2,
        answeredByDifficulty: { easy: 4, medium: 0, hard: 0 },
      });

      const updated = updateAdaptiveState(state, baseConfig, true);

      // Difficulty should change from easy to medium
      expect(updated.currentDifficulty).toBe("medium");
      expect(updated.consecutiveCorrect).toBe(0);
      expect(updated.consecutiveIncorrect).toBe(0);
    });

    it("increments consecutiveIncorrect on incorrect answer", () => {
      const state = makeState({
        currentDifficulty: "medium",
        consecutiveIncorrect: 1,
        answeredByDifficulty: { easy: 0, medium: 1, hard: 0 },
      });

      const updated = updateAdaptiveState(state, baseConfig, false);

      expect(updated.consecutiveIncorrect).toBe(2);
    });
  });

  // ── selectNextQuestion ────────────────────────────────────────────

  describe("selectNextQuestion", () => {
    it("returns exact difficulty match", () => {
      const state = makeState({ currentDifficulty: "medium" });
      const questions: QuestionMeta[] = [
        { id: "q1", difficulty: "easy" },
        { id: "q2", difficulty: "medium" },
        { id: "q3", difficulty: "hard" },
      ];

      const result = selectNextQuestion(state, questions);
      expect(result).toBe("q2");
    });

    it("falls back to nearest higher difficulty", () => {
      const state = makeState({ currentDifficulty: "medium" });
      const questions: QuestionMeta[] = [{ id: "q1", difficulty: "hard" }];

      const result = selectNextQuestion(state, questions);
      expect(result).toBe("q1");
    });

    it("falls back to nearest lower difficulty", () => {
      const state = makeState({ currentDifficulty: "hard" });
      const questions: QuestionMeta[] = [
        { id: "q1", difficulty: "easy" },
        { id: "q2", difficulty: "medium" },
      ];

      const result = selectNextQuestion(state, questions);
      expect(result).toBe("q2");
    });

    it("returns null when no questions remain", () => {
      const state = makeState({ currentDifficulty: "medium" });

      const result = selectNextQuestion(state, []);
      expect(result).toBeNull();
    });
  });
});
