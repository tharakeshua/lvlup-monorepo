/**
 * Grade calculation constants and helpers.
 * Used by both AutoGrade and LevelUp modules.
 */

export const GRADE_THRESHOLDS = [
  { min: 90, grade: "A+" },
  { min: 80, grade: "A" },
  { min: 70, grade: "B+" },
  { min: 60, grade: "B" },
  { min: 50, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" },
] as const;

export type GradeLetter = (typeof GRADE_THRESHOLDS)[number]["grade"];

export const BLOOMS_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
] as const;

export type BloomsLevel = (typeof BLOOMS_LEVELS)[number];

/** Submission pipeline status values. */
export const SUBMISSION_PIPELINE_STATUSES = [
  "uploaded",
  "ocr_processing",
  "ocr_failed",
  "scouting",
  "scouting_failed",
  "scouting_complete",
  "grading",
  "grading_partial",
  "grading_failed",
  "grading_complete",
  "finalization_failed",
  "ready_for_review",
  "reviewed",
  "failed",
  "manual_review_needed",
] as const;

export type SubmissionPipelineStatus = (typeof SUBMISSION_PIPELINE_STATUSES)[number];

/** Per-question grading status values. */
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

/** Exam lifecycle status values. */
export const EXAM_STATUSES = [
  "draft",
  "question_paper_uploaded",
  "question_paper_extracted",
  "published",
  "grading",
  "completed",
  "results_released",
  "archived",
] as const;

export type ExamStatus = (typeof EXAM_STATUSES)[number];
