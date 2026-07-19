/**
 * Adaptive question selection engine.
 * Pure functions — no Firestore dependency, fully testable.
 * @module levelup/adaptive-engine
 */

import type { AdaptiveConfig } from "@levelup/shared-types";

export interface AdaptiveState {
  currentDifficulty: "easy" | "medium" | "hard";
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  answeredByDifficulty: Record<string, number>;
}

export interface QuestionMeta {
  id: string;
  difficulty: "easy" | "medium" | "hard";
}

const DIFFICULTY_ORDER: ReadonlyArray<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];

/**
 * Creates the initial adaptive state based on config.
 */
export function createInitialAdaptiveState(config: AdaptiveConfig): AdaptiveState {
  return {
    currentDifficulty: config.initialDifficulty,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    answeredByDifficulty: { easy: 0, medium: 0, hard: 0 },
  };
}

/**
 * Determine the next difficulty level based on the current adaptive state
 * and the student's answer correctness.
 */
export function getNextDifficulty(
  state: AdaptiveState,
  config: AdaptiveConfig,
  wasCorrect: boolean
): "easy" | "medium" | "hard" {
  const threshold = config.difficultyAdjustment === "aggressive" ? 2 : 3;
  const minPerDifficulty = config.minQuestionsPerDifficulty ?? 2;
  const maxConsecutive = config.maxConsecutiveSameDifficulty ?? 5;

  // Update consecutive counts
  const consecutiveCorrect = wasCorrect ? state.consecutiveCorrect + 1 : 0;
  const consecutiveIncorrect = wasCorrect ? 0 : state.consecutiveIncorrect + 1;

  const currentIdx = DIFFICULTY_ORDER.indexOf(state.currentDifficulty);
  const currentAnswered = (state.answeredByDifficulty[state.currentDifficulty] ?? 0) + 1;

  // Check if we've hit minimum questions at current difficulty
  if (currentAnswered < minPerDifficulty) {
    return state.currentDifficulty;
  }

  // Force shift if stuck at same difficulty too long
  if (currentAnswered >= maxConsecutive) {
    if (wasCorrect && currentIdx < 2) {
      return DIFFICULTY_ORDER[currentIdx + 1] as "easy" | "medium" | "hard";
    }
    if (!wasCorrect && currentIdx > 0) {
      return DIFFICULTY_ORDER[currentIdx - 1] as "easy" | "medium" | "hard";
    }
  }

  // Shift up on consecutive correct
  if (consecutiveCorrect >= threshold && currentIdx < 2) {
    return DIFFICULTY_ORDER[currentIdx + 1] as "easy" | "medium" | "hard";
  }

  // Shift down on consecutive incorrect
  if (consecutiveIncorrect >= threshold && currentIdx > 0) {
    return DIFFICULTY_ORDER[currentIdx - 1] as "easy" | "medium" | "hard";
  }

  return state.currentDifficulty;
}

/**
 * Update adaptive state after an answer is submitted.
 */
export function updateAdaptiveState(
  state: AdaptiveState,
  config: AdaptiveConfig,
  wasCorrect: boolean
): AdaptiveState {
  const newDifficulty = getNextDifficulty(state, config, wasCorrect);
  const difficultyChanged = newDifficulty !== state.currentDifficulty;

  return {
    currentDifficulty: newDifficulty,
    consecutiveCorrect: difficultyChanged ? 0 : wasCorrect ? state.consecutiveCorrect + 1 : 0,
    consecutiveIncorrect: difficultyChanged ? 0 : wasCorrect ? 0 : state.consecutiveIncorrect + 1,
    answeredByDifficulty: {
      ...state.answeredByDifficulty,
      [state.currentDifficulty]: (state.answeredByDifficulty[state.currentDifficulty] ?? 0) + 1,
    },
  };
}

/**
 * Select the next question based on current adaptive state.
 * Picks the first remaining question matching the target difficulty.
 * Falls back to nearest available difficulty if no match.
 */
export function selectNextQuestion(
  state: AdaptiveState,
  remainingQuestions: QuestionMeta[]
): string | null {
  if (remainingQuestions.length === 0) return null;

  // Try exact difficulty match first
  const exactMatch = remainingQuestions.find((q) => q.difficulty === state.currentDifficulty);
  if (exactMatch) return exactMatch.id;

  // Fallback: find nearest difficulty
  const currentIdx = DIFFICULTY_ORDER.indexOf(state.currentDifficulty);
  for (let offset = 1; offset <= 2; offset++) {
    if (currentIdx + offset < 3) {
      const up = remainingQuestions.find(
        (q) => q.difficulty === DIFFICULTY_ORDER[currentIdx + offset]
      );
      if (up) return up.id;
    }
    if (currentIdx - offset >= 0) {
      const down = remainingQuestions.find(
        (q) => q.difficulty === DIFFICULTY_ORDER[currentIdx - offset]
      );
      if (down) return down.id;
    }
  }

  // Last resort: any remaining
  return remainingQuestions[0]?.id ?? null;
}
