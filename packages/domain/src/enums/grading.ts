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
