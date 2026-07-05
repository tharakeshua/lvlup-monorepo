import { zEnum } from "./enum.js";

export const GRADE_LETTERS = ["A+", "A", "B+", "B", "C+", "C", "D", "F"] as const;
export type GradeLetter = (typeof GRADE_LETTERS)[number];
export const zGradeLetter = zEnum(GRADE_LETTERS);

/** Lower-bound percentage thresholds (descending) for each grade letter. */
export const GRADE_THRESHOLDS = [
  { letter: "A+", min: 90 },
  { letter: "A", min: 80 },
  { letter: "B+", min: 70 },
  { letter: "B", min: 60 },
  { letter: "C+", min: 50 },
  { letter: "C", min: 40 },
  { letter: "D", min: 33 },
  { letter: "F", min: 0 },
] as const satisfies readonly { letter: GradeLetter; min: number }[];

/**
 * Canonical percentage → letter boundary (DATA-MODEL-FIX-PLAN U1.2, B5).
 *
 * The ONE place the new spine derives a grade from a score: returns the highest
 * `GRADE_THRESHOLDS` entry whose `min <= pct`. Because the table is exhaustive
 * (`F` at `min: 0`) every finite `pct >= 0` resolves; negatives clamp to 0.
 *
 * This is the 8-letter canonical scale (incl. `C+` at 50–59). It intentionally
 * DIVERGES from the legacy 7-letter `calculateGrade`
 * (`functions/autograde/.../grading-helpers.ts`) on the 33–59 range — see
 * `grading.boundary.test.ts` for the band-by-band contract. All new grade
 * computation MUST route through here rather than re-hardcoding thresholds.
 */
export function gradeForPercentage(pct: number): GradeLetter {
  const p = Number.isFinite(pct) ? Math.max(0, pct) : 0;
  // GRADE_THRESHOLDS is descending by `min`; first match is the highest band.
  return (GRADE_THRESHOLDS.find((t) => p >= t.min) ?? GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1])
    .letter;
}

export const BLOOMS_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
] as const;
export type BloomsLevel = (typeof BLOOMS_LEVELS)[number];
export const zBloomsLevel = zEnum(BLOOMS_LEVELS);

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const zDifficulty = zEnum(DIFFICULTIES);

export const AUTHORING_DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type AuthoringDifficulty = (typeof AUTHORING_DIFFICULTIES)[number];
export const zAuthoringDifficulty = zEnum(AUTHORING_DIFFICULTIES);
