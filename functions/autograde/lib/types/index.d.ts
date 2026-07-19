/**
 * AutoGrade domain types — re-exported from @levelup/shared-types.
 * All canonical types live in packages/shared-types/src/.
 */
import { FieldValue } from "firebase-admin/firestore";
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
export type {
  ExamStatus,
  SubmissionPipelineStatus,
  QuestionGradingStatus,
} from "@levelup/shared-types";
export { type EvaluationSettings as EvaluationFeedbackRubric } from "@levelup/shared-types";
export type WithFieldValue<T> = {
  [K in keyof T]: T[K] | FieldValue;
};
