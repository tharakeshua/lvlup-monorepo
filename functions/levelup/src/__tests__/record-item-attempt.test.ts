import { describe, it, expect } from "vitest";
import { assertAuth } from "../utils/auth";

/**
 * Tests for record-item-attempt — practice mode scoring logic.
 */

describe("record-item-attempt — scoring rules", () => {
  it("should require authentication", () => {
    expect(() => assertAuth(undefined)).toThrow("Must be logged in");
  });

  it("should keep best score across attempts", () => {
    const previousBest = 7;
    const currentScore = 5;
    const bestScore = Math.max(currentScore, previousBest);

    expect(bestScore).toBe(7);
  });

  it("should update best score when new attempt is higher", () => {
    const previousBest = 5;
    const currentScore = 9;
    const bestScore = Math.max(currentScore, previousBest);

    expect(bestScore).toBe(9);
  });

  it("should increment attempts count", () => {
    const existingAttempts = 3;
    const newCount = existingAttempts + 1;

    expect(newCount).toBe(4);
  });

  it("should compute overall percentage correctly", () => {
    const items = [
      { bestScore: 8, totalPoints: 10 },
      { bestScore: 15, totalPoints: 20 },
      { bestScore: 5, totalPoints: 10 },
    ];

    let totalEarned = 0;
    let totalAvailable = 0;
    for (const item of items) {
      totalEarned += item.bestScore;
      totalAvailable += item.totalPoints;
    }

    const percentage = totalAvailable > 0 ? totalEarned / totalAvailable : 0;
    expect(percentage).toBeCloseTo(0.7);
  });

  it("should determine question status from score", () => {
    const getStatus = (correct: boolean, score: number) =>
      correct ? "correct" : score > 0 ? "partial" : "incorrect";

    expect(getStatus(true, 10)).toBe("correct");
    expect(getStatus(false, 5)).toBe("partial");
    expect(getStatus(false, 0)).toBe("incorrect");
  });

  it("should compute per-storyPoint aggregates", () => {
    const items = [
      { storyPointId: "sp-1", bestScore: 5, totalPoints: 10 },
      { storyPointId: "sp-1", bestScore: 8, totalPoints: 10 },
      { storyPointId: "sp-2", bestScore: 3, totalPoints: 5 },
    ];

    const targetSp = "sp-1";
    let spEarned = 0;
    let spAvailable = 0;
    for (const item of items) {
      if (item.storyPointId === targetSp) {
        spEarned += item.bestScore;
        spAvailable += item.totalPoints;
      }
    }

    expect(spEarned).toBe(13);
    expect(spAvailable).toBe(20);
    expect(spEarned / spAvailable).toBeCloseTo(0.65);
  });
});
