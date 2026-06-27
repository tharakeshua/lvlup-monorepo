import type { TransitionMap } from "./types.js";
import type { QuestionGradingStatus } from "../enums/question-grading.js";

// autograde §"ALLOWED_TRANSITIONS.questionGrading".
export const QUESTION_GRADING_TRANSITIONS = {
  pending: ["processing"],
  processing: ["graded", "needs_review", "failed"],
  graded: ["overridden"],
  needs_review: ["graded", "manual", "overridden"],
  failed: ["pending", "manual"],
  manual: ["overridden"],
  overridden: [],
} as const satisfies TransitionMap<QuestionGradingStatus>;
