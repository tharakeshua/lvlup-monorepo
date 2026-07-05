/**
 * Grade-boundary cross-check — U1.2 (DATA-MODEL-FIX-PLAN, divergence B5).
 *
 * Locks the canonical `gradeForPercentage()` (8-letter `{letter,min}` scale) against:
 *   1. the legacy 7-letter `calculateGrade` (functions/autograde grading-helpers) —
 *      proving AGREEMENT on the bands both scales share (≥60 and 0–32) and
 *      documenting the deliberate DIVERGENCE on 33–59 where the canonical scale
 *      inserts `C+`/`C`/`D` and the DOMAIN table wins;
 *   2. the enum round-trip — `C+` survives `zGradeLetter` and the lenient
 *      `zLegacyGradeLetterRead` read-adapter.
 *
 * `calculateGrade` is transcribed here (READ-ONLY reference — the real fn migrates
 * in U3.4 and must NOT be imported/edited from the new spine).
 */
import { describe, it, expect } from "vitest";
import {
  GRADE_THRESHOLDS,
  GRADE_LETTERS,
  gradeForPercentage,
  zGradeLetter,
} from "../enums/grading.js";
import { zLegacyGradeLetterRead } from "../enums/legacy.js";

/** Verbatim copy of functions/autograde/src/utils/grading-helpers.ts:calculateGrade. */
function legacyCalculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}

describe("gradeForPercentage — canonical boundary", () => {
  it("returns a valid canonical GradeLetter for every percentage 0..100", () => {
    for (let pct = 0; pct <= 100; pct++) {
      expect(GRADE_LETTERS).toContain(gradeForPercentage(pct));
    }
  });

  it("maps each threshold's exact `min` to its own letter (lower-bound inclusive)", () => {
    for (const { letter, min } of GRADE_THRESHOLDS) {
      expect(gradeForPercentage(min)).toBe(letter);
    }
  });

  it("clamps out-of-range / non-finite input to F (min: 0)", () => {
    expect(gradeForPercentage(-5)).toBe("F");
    expect(gradeForPercentage(NaN)).toBe("F");
    expect(gradeForPercentage(0)).toBe("F");
    expect(gradeForPercentage(150)).toBe("A+");
  });
});

describe("cross-check vs legacy calculateGrade (B5)", () => {
  it("AGREES with legacy on the shared bands: [60,100] and [0,33)", () => {
    const shared = [
      ...range(60, 100), // A+/A/B+/B — identical in both scales
      ...range(0, 32), // F — identical in both scales
    ];
    for (const pct of shared) {
      expect(gradeForPercentage(pct)).toBe(legacyCalculateGrade(pct));
    }
  });

  it("DIVERGES on 33..59 — the DOMAIN 8-letter table wins", () => {
    // The canonical scale inserts C+ (50–59), shifts C down to 40–49, and adds a
    // D floor at 33. Legacy has no C+, keeps C at 50–59, D at 40–49, F below 40.
    // Each row: [pct, canonical (asserted), legacy (documented, NOT asserted)].
    const divergences: Array<[number, string, string]> = [
      [59, "C+", "C"],
      [55, "C+", "C"],
      [50, "C+", "C"],
      [49, "C", "D"],
      [45, "C", "D"],
      [40, "C", "D"],
      [39, "D", "F"],
      [33, "D", "F"],
    ];
    for (const [pct, canonical, legacy] of divergences) {
      expect(gradeForPercentage(pct)).toBe(canonical); // domain wins
      expect(legacyCalculateGrade(pct)).toBe(legacy); // legacy behavior documented
      expect(canonical).not.toBe(legacy); // the band genuinely diverges
    }
  });

  it("32 is the last shared F; 33 is the first D-only (canonical D floor)", () => {
    expect(gradeForPercentage(32)).toBe("F");
    expect(legacyCalculateGrade(32)).toBe("F");
    expect(gradeForPercentage(33)).toBe("D");
    expect(legacyCalculateGrade(33)).toBe("F");
  });
});

describe("C+ round-trips through the enum + legacy read-adapter", () => {
  it("50–59 resolves to C+ and survives zGradeLetter", () => {
    const letter = gradeForPercentage(55);
    expect(letter).toBe("C+");
    expect(zGradeLetter.parse(letter)).toBe("C+");
  });

  it("C+ passes the lenient legacy read-adapter (canonical passes through)", () => {
    expect(zLegacyGradeLetterRead.parse("C+")).toBe("C+");
  });

  it("every canonical letter round-trips through zLegacyGradeLetterRead", () => {
    for (const letter of GRADE_LETTERS) {
      expect(zLegacyGradeLetterRead.parse(letter)).toBe(letter);
    }
  });
});

/** Inclusive integer range [lo, hi]. */
function range(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) out.push(n);
  return out;
}
