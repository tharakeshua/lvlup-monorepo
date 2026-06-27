import type { TransitionMap } from "./types.js";
import type { ExamStatus } from "../enums/exam.js";

// autograde §"ALLOWED_TRANSITIONS.exam" ('completed' dropped; grading→results_released direct).
export const EXAM_TRANSITIONS = {
  draft: ["question_paper_uploaded", "archived"],
  question_paper_uploaded: ["question_paper_extracted", "archived"],
  question_paper_extracted: ["published", "archived"],
  published: ["grading", "archived"],
  grading: ["results_released", "grading"],
  results_released: ["archived"],
  archived: [],
} as const satisfies TransitionMap<ExamStatus>;
