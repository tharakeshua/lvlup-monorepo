/**
 * Aggregation helpers tests.
 *
 * Tests cover:
 *  1. computeOverallScore — weighted combination of autograde and levelup
 *  2. median — statistical median calculation
 *  3. standardDeviation — population std-dev
 *  4. identifyStrengthsAndWeaknesses — subject-level analysis
 *  5. topN / bottomN — array capping utilities
 */
import { describe, it, expect } from "vitest";
import {
  computeOverallScore,
  median,
  standardDeviation,
  identifyStrengthsAndWeaknesses,
  topN,
  bottomN,
} from "../utils/aggregation-helpers";

// ── computeOverallScore ──────────────────────────────────────────────────

describe("computeOverallScore", () => {
  it("computes weighted score (60% autograde, 40% levelup)", () => {
    // autograde 0.8 * 0.6 = 0.48, levelup 75/100 * 0.4 = 0.3 → 0.78
    const result = computeOverallScore(0.8, 75);
    expect(result).toBeCloseTo(0.78, 5);
  });

  it("returns 0 for zero inputs", () => {
    expect(computeOverallScore(0, 0)).toBe(0);
  });

  it("returns 1 for perfect inputs", () => {
    expect(computeOverallScore(1.0, 100)).toBeCloseTo(1.0, 5);
  });

  it("clamps autograde score above 1 to 1", () => {
    const result = computeOverallScore(1.5, 50);
    // clamped to 1 * 0.6 + 0.5 * 0.4 = 0.8
    expect(result).toBeCloseTo(0.8, 5);
  });

  it("clamps negative autograde score to 0", () => {
    const result = computeOverallScore(-0.5, 50);
    // clamped to 0 * 0.6 + 0.5 * 0.4 = 0.2
    expect(result).toBeCloseTo(0.2, 5);
  });

  it("clamps levelup completion above 100 to 100", () => {
    const result = computeOverallScore(0.5, 150);
    // 0.5 * 0.6 + 1.0 * 0.4 = 0.7
    expect(result).toBeCloseTo(0.7, 5);
  });

  it("handles only autograde contribution (levelup 0)", () => {
    const result = computeOverallScore(0.9, 0);
    expect(result).toBeCloseTo(0.54, 5);
  });

  it("handles only levelup contribution (autograde 0)", () => {
    const result = computeOverallScore(0, 80);
    expect(result).toBeCloseTo(0.32, 5);
  });
});

// ── median ───────────────────────────────────────────────────────────────

describe("median", () => {
  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns the single value for array of one", () => {
    expect(median([42])).toBe(42);
  });

  it("returns middle value for odd-length array", () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it("returns average of two middle values for even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("handles unsorted input", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("handles identical values", () => {
    expect(median([7, 7, 7, 7])).toBe(7);
  });

  it("does not mutate original array", () => {
    const arr = [3, 1, 2];
    median(arr);
    expect(arr).toEqual([3, 1, 2]);
  });
});

// ── standardDeviation ────────────────────────────────────────────────────

describe("standardDeviation", () => {
  it("returns 0 for empty array", () => {
    expect(standardDeviation([])).toBe(0);
  });

  it("returns 0 for single element", () => {
    expect(standardDeviation([5])).toBe(0);
  });

  it("returns 0 for identical values", () => {
    expect(standardDeviation([3, 3, 3, 3])).toBe(0);
  });

  it("computes correct std-dev for known values", () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, population std-dev=2
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.0, 5);
  });

  it("computes correct std-dev for two values", () => {
    // [0, 10] → mean=5, sqDiffs=[25,25], variance=25, std=5
    expect(standardDeviation([0, 10])).toBeCloseTo(5.0, 5);
  });
});

// ── identifyStrengthsAndWeaknesses ───────────────────────────────────────

describe("identifyStrengthsAndWeaknesses", () => {
  it("identifies strength above +0.1 from global avg", () => {
    const result = identifyStrengthsAndWeaknesses(
      { math: { avgScore: 0.9, examCount: 5 }, english: { avgScore: 0.5, examCount: 5 } },
      {}
    );
    expect(result.strengths).toContain("math");
    expect(result.weaknesses).toContain("english");
  });

  it("returns empty for uniform subjects", () => {
    const result = identifyStrengthsAndWeaknesses(
      { math: { avgScore: 0.7, examCount: 3 }, english: { avgScore: 0.7, examCount: 3 } },
      {}
    );
    expect(result.strengths).toEqual([]);
    expect(result.weaknesses).toEqual([]);
  });

  it("returns empty for no subjects", () => {
    const result = identifyStrengthsAndWeaknesses({}, {});
    expect(result.strengths).toEqual([]);
    expect(result.weaknesses).toEqual([]);
  });

  it("merges autograde and levelup breakdowns for same subject", () => {
    const result = identifyStrengthsAndWeaknesses(
      { math: { avgScore: 0.9, examCount: 3 } },
      { math: { avgCompletion: 90, spaceCount: 5 }, english: { avgCompletion: 30, spaceCount: 5 } }
    );
    // math appears in both, english only in levelup
    expect(result.strengths).toContain("math");
    expect(result.weaknesses).toContain("english");
  });

  it("handles subjects only in levelup breakdown", () => {
    const result = identifyStrengthsAndWeaknesses(
      {},
      { science: { avgCompletion: 95, spaceCount: 2 }, art: { avgCompletion: 20, spaceCount: 2 } }
    );
    expect(result.strengths).toContain("science");
    expect(result.weaknesses).toContain("art");
  });
});

// ── topN / bottomN ───────────────────────────────────────────────────────

describe("topN", () => {
  it("returns top N items by key descending", () => {
    const items = [
      { id: "a", val: 10 },
      { id: "b", val: 30 },
      { id: "c", val: 20 },
    ];
    const result = topN(items, 2, (i) => i.val);
    expect(result).toEqual([
      { id: "b", val: 30 },
      { id: "c", val: 20 },
    ]);
  });

  it("returns all items when N exceeds array length", () => {
    const items = [{ id: "a", val: 5 }];
    const result = topN(items, 10, (i) => i.val);
    expect(result).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    expect(topN([], 5, () => 0)).toEqual([]);
  });

  it("does not mutate original array", () => {
    const items = [{ val: 1 }, { val: 3 }, { val: 2 }];
    topN(items, 2, (i) => i.val);
    expect(items[0].val).toBe(1);
  });
});

describe("bottomN", () => {
  it("returns bottom N items by key ascending", () => {
    const items = [
      { id: "a", val: 10 },
      { id: "b", val: 30 },
      { id: "c", val: 20 },
    ];
    const result = bottomN(items, 2, (i) => i.val);
    expect(result).toEqual([
      { id: "a", val: 10 },
      { id: "c", val: 20 },
    ]);
  });

  it("returns all items when N exceeds array length", () => {
    const items = [{ id: "a", val: 5 }];
    const result = bottomN(items, 10, (i) => i.val);
    expect(result).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    expect(bottomN([], 5, () => 0)).toEqual([]);
  });
});
