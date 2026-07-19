/**
 * AutoGrade domain types — re-exported from @levelup/shared-types.
 * All canonical types live in packages/shared-types/src/.
 */

import { FieldValue } from "firebase-admin/firestore";

// ─── Content types (rubric, evaluation) ─────────────────────────────────────
export type {
  RubricScoringMode,
  RubricCriterion,
  RubricCriterionLevel,
  EvaluationDimension,
  UnifiedRubric,
  UnifiedEvaluationResult,
  FeedbackItem,
  RubricBreakdownItem,
} from "@levelup/shared-types";

// ─── AutoGrade domain types ─────────────────────────────────────────────────
export type {
  Exam,
  ExamQuestionPaper,
  ExamGradingConfig,
  ExamStats,
  ExamQuestion,
  SubQuestion,
  Submission,
  AnswerSheetData,
  ScoutingResult,
  SubmissionSummary,
  QuestionSubmission,
  QuestionMapping,
  ManualOverride,
  EvaluationSettings,
  EvaluationDisplaySettings,
  GradingDeadLetterEntry,
  DeadLetterPipelineStep,
  DeadLetterResolutionMethod,
  ExamAnalytics,
  ScoreDistributionBucket,
  QuestionAnalyticsEntry,
  ClassBreakdownEntry,
  TopicPerformanceEntry,
} from "@levelup/shared-types";

// ─── Constants / status types ───────────────────────────────────────────────
export type {
  ExamStatus,
  SubmissionPipelineStatus,
  QuestionGradingStatus,
} from "@levelup/shared-types";

// ─── Backward-compat alias ──────────────────────────────────────────────────
// Some autograde files reference EvaluationFeedbackRubric which is EvaluationSettings
export { type EvaluationSettings as EvaluationFeedbackRubric } from "@levelup/shared-types";

// ─── Utility type for Firestore writes (firebase-admin specific) ────────────
export type WithFieldValue<T> = {
  [K in keyof T]: T[K] | FieldValue;
};
