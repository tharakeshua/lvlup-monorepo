import type { TransitionMap } from "./types.js";
import type { SubmissionPipelineStatus } from "../enums/submission.js";

// autograde §"ALLOWED_TRANSITIONS.submission" (pipeline machine).
export const SUBMISSION_TRANSITIONS = {
  uploaded: ["scouting"],
  scouting: ["scouting_complete", "scouting_failed"],
  scouting_failed: ["scouting", "manual_review_needed"],
  scouting_complete: ["grading"],
  grading: ["grading_complete", "grading_partial", "grading_failed", "manual_review_needed"],
  grading_partial: ["grading"],
  grading_failed: ["grading", "manual_review_needed"],
  grading_complete: ["ready_for_review", "finalization_failed"],
  finalization_failed: ["grading_complete"],
  ready_for_review: ["reviewed"],
  reviewed: [],
  manual_review_needed: ["grading", "reviewed"],
  failed: [],
} as const satisfies TransitionMap<SubmissionPipelineStatus>;
