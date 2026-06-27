import { zEnum } from "./enum.js";

export const QUESTION_GRADING_STATUSES = [
  "pending",
  "processing",
  "graded",
  "needs_review",
  "failed",
  "manual",
  "overridden",
] as const;
export type QuestionGradingStatus = (typeof QUESTION_GRADING_STATUSES)[number];
export const zQuestionGradingStatus = zEnum(QUESTION_GRADING_STATUSES);
