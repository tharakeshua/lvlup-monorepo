/**
 * `@levelup/services` autograde barrel — every service exported by name, ready to
 * be shelled by `functions/autograde` (Phase 5). Commands, pipeline reducer + steps,
 * reads, triggers, and the watchdog scheduler.
 */

// command services
export { saveExamService, POST_PUBLISH_LOCKED_FIELDS } from "./save-exam.js";
export { saveExamQuestionService } from "./save-exam-question.js";
export { releaseResultsService } from "./release-results.js";
export { extractQuestionsService } from "./extract-questions.js";
export { uploadAnswerSheetsService, validatePathsInTenant } from "./upload-answer-sheets.js";
export { gradeQuestionService } from "./grade-question.js";
export { saveEvaluationSettingsService } from "./save-evaluation-settings.js";
export { resolveDeadLetterService } from "./resolve-dead-letter.js";
export { requestUploadUrlService, buildScopedPath } from "./request-upload-url.js";

// pipeline (task-driven)
export { advancePipelineService, enqueuePipelineAdvance } from "./pipeline/advance-pipeline.js";
export type { PipelineStep, PipelineEnqueueHook } from "./pipeline/advance-pipeline.js";
export { processAnswerMappingService } from "./pipeline/process-answer-mapping.js";
export { processAnswerGradingService } from "./pipeline/process-answer-grading.js";
export { finalizeSubmissionService, gradeFor } from "./pipeline/finalize-submission.js";
export { resolveRubricService } from "./pipeline/resolve-rubric.js";
// AG-5 live grading ticker — the RTDB projection port (FIX-2 wires the concrete
// Admin-RTDB adapter onto `ctx.repos.gradingProjections`) + the pure count reducer
// the adapter's exam-aggregate transaction reuses.
export {
  projectSubmissionStatus,
  reduceExamCounts,
  bucketForPhase,
} from "./pipeline/grading-projection.js";
export type {
  GradingProjectionPort,
  SubmissionStatusProjection,
  ExamGradingAggregate,
  ExamBucket,
} from "./pipeline/grading-projection.js";

// reads
export {
  listExamsService,
  getExamService,
  listQuestionsService,
  listSubmissionsService,
  getSubmissionService,
  listQuestionSubmissionsService,
  getExamAnalyticsService as getExamAnalyticsReadService,
  listEvaluationSettingsService,
  listDeadLetterService,
  getSubmissionForExamService,
} from "./reads.js";

// triggers
export {
  onSubmissionCreatedService,
  onSubmissionUpdatedService,
  onQuestionSubmissionUpdatedService,
  onExamPublishedService,
  onResultsReleasedService,
  onExamDeletedService,
} from "./triggers/index.js";

// schedulers
export { staleSubmissionWatchdogService } from "./schedulers/stale-submission-watchdog.js";
