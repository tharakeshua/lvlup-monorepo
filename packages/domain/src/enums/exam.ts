import { zEnum } from "./enum.js";

// 'completed' DROPPED (unreachable — REVIEW open-Q / domain-core §7.2).
export const EXAM_STATUSES = [
  "draft",
  "question_paper_uploaded",
  "question_paper_extracted",
  "published",
  "grading",
  "results_released",
  "archived",
] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];
export const zExamStatus = zEnum(EXAM_STATUSES);
