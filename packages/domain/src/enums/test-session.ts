import { zEnum } from "./enum.js";

// Reconciled to the testsession-progress + levelup-content plans (more detailed
// than domain-core §7.2's placeholder). Terminal states: completed/expired/abandoned.
export const TEST_SESSION_STATUSES = ["in_progress", "completed", "expired", "abandoned"] as const;
export type TestSessionStatus = (typeof TEST_SESSION_STATUSES)[number];
export const zTestSessionStatus = zEnum(TEST_SESSION_STATUSES);

export const TEST_SESSION_TYPES = ["timed_test", "quiz", "practice"] as const;
export type TestSessionType = (typeof TEST_SESSION_TYPES)[number];
export const zTestSessionType = zEnum(TEST_SESSION_TYPES);

// 5-status question model (testsession-progress §38).
export const QUESTION_STATUSES = [
  "not_visited",
  "not_answered",
  "answered",
  "marked_for_review",
  "answered_and_marked",
] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
export const zQuestionStatus = zEnum(QUESTION_STATUSES);

export const PROGRESS_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];
export const zProgressStatus = zEnum(PROGRESS_STATUSES);

export const QUESTION_PROGRESS_STATUSES = ["pending", "correct", "incorrect", "partial"] as const;
export type QuestionProgressStatus = (typeof QUESTION_PROGRESS_STATUSES)[number];
export const zQuestionProgressStatus = zEnum(QUESTION_PROGRESS_STATUSES);
