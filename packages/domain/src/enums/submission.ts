import { zEnum } from "./enum.js";

// ocr_processing / ocr_failed DROPPED (vestigial — REVIEW open-Q / domain-core §7.2).
export const SUBMISSION_PIPELINE_STATUSES = [
  "uploaded",
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
export const zSubmissionPipelineStatus = zEnum(SUBMISSION_PIPELINE_STATUSES);
