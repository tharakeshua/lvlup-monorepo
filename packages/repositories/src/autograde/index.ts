/**
 * @levelup/repositories — `autograde` domain factory
 * (SDK-LAYERS-PLAN §4.1, §2.5, domain plan sdk-plan/domains/autograde.md).
 *
 * The root `createRepositories(api)` assembly (src/index.ts) is owned by the
 * 'identity' agent; this domain exports `createAutogradeRepos(api)` — the
 * plan-specified per-domain factory the root assembler folds in.
 *
 * Per-entity repos: examRepo, examQuestionRepo, submissionRepo,
 * questionSubmissionRepo, evaluationSettingsRepo, deadLetterRepo.
 * Cross-entity VIEW repos (src/views/**, R6 exception): examAnalyticsRepo,
 * gradingReviewRepo — returned alongside so the assembler places them in the bag.
 *
 * Every repo imports `@levelup/api-client` (via the `ApiClient` view) +
 * `@levelup/domain` ONLY — never a sibling repo (R6).
 */
import type { ApiClient } from "./api-types.js";
import { createExamRepo, type ExamRepo } from "./exam.js";
import { createExamQuestionRepo, type ExamQuestionRepo } from "./exam-question.js";
import { createSubmissionRepo, type SubmissionRepo } from "./submission.js";
import {
  createQuestionSubmissionRepo,
  type QuestionSubmissionRepo,
} from "./question-submission.js";
import {
  createEvaluationSettingsRepo,
  type EvaluationSettingsRepo,
} from "./evaluation-settings.js";
import { createDeadLetterRepo, type DeadLetterRepo } from "./dead-letter.js";
import { createExamAnalyticsRepo, type ExamAnalyticsRepo } from "../views/exam-analytics.js";
import { createGradingReviewRepo, type GradingReviewRepo } from "../views/grading-review.js";

export interface AutogradeRepos {
  examRepo: ExamRepo;
  examQuestionRepo: ExamQuestionRepo;
  submissionRepo: SubmissionRepo;
  questionSubmissionRepo: QuestionSubmissionRepo;
  evaluationSettingsRepo: EvaluationSettingsRepo;
  deadLetterRepo: DeadLetterRepo;
  // cross-entity VIEW repos (src/views/**, R6 exception)
  examAnalyticsRepo: ExamAnalyticsRepo;
  gradingReviewRepo: GradingReviewRepo;
}

export function createAutogradeRepos(api: ApiClient): AutogradeRepos {
  return {
    examRepo: createExamRepo(api),
    examQuestionRepo: createExamQuestionRepo(api),
    submissionRepo: createSubmissionRepo(api),
    questionSubmissionRepo: createQuestionSubmissionRepo(api),
    evaluationSettingsRepo: createEvaluationSettingsRepo(api),
    deadLetterRepo: createDeadLetterRepo(api),
    examAnalyticsRepo: createExamAnalyticsRepo(api),
    gradingReviewRepo: createGradingReviewRepo(api),
  };
}

// Public re-exports (types + sub-factories) for the root assembler + apps.
export type {
  ApiClient,
  PageRequest,
  PageResponse,
  SaveResponse,
  ExamListView,
  ExamDetailView,
  ExamQuestionView,
  SubmissionListView,
  SubmissionDetailView,
  QuestionSubmissionView,
  EvaluationSettingsView,
  DeadLetterView,
  ExamAnalyticsView,
  ExamFilter,
  SubmissionFilter,
  DeadLetterFilter,
  SaveExamInput,
  SaveEvaluationSettingsInput,
  ExtractQuestionsRequest,
  ExtractQuestionsResponse,
  UploadAnswerSheetsRequest,
  UploadAnswerSheetsResponse,
  GradeQuestionRequest,
  GradeQuestionResponse,
  ResolveDeadLetterRequest,
  ResolveDeadLetterResponse,
  ReleaseResultsResponse,
  GradingReviewView,
  ExamGradingOverview,
} from "./api-types.js";
export { createExamRepo, type ExamRepo, type PublishCheck } from "./exam.js";
export { createExamQuestionRepo, type ExamQuestionRepo } from "./exam-question.js";
export { createSubmissionRepo, type SubmissionRepo, type PipelinePhase } from "./submission.js";
export {
  createQuestionSubmissionRepo,
  type QuestionSubmissionRepo,
  type ConfidenceBand,
  type GradeManualInput,
  type RetryGradingInput,
  type GradeAiInput,
} from "./question-submission.js";
export {
  createEvaluationSettingsRepo,
  type EvaluationSettingsRepo,
} from "./evaluation-settings.js";
export {
  createDeadLetterRepo,
  type DeadLetterRepo,
  type ResolveDeadLetterInput,
} from "./dead-letter.js";
export {
  createExamAnalyticsRepo,
  type ExamAnalyticsRepo,
  type AnalyticsRow,
  type GradeDistributionSlice,
} from "../views/exam-analytics.js";
export {
  createGradingReviewRepo,
  type GradingReviewRepo,
  type GradingReviewBundleView,
  type GradedQuestionRow,
} from "../views/grading-review.js";
export { paginate, listOnce, batchGetMany, type PageBag, type Paged } from "./paginate.js";
