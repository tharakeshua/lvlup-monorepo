/**
 * Shared autograde wire fragments — view-model (read) schemas and the
 * `CallableDef` re-import used by every def in this module.
 *
 * Per the FROZEN SDK plan (domains/autograde.md §"API contract"):
 *   - NO request schema in this module carries a `tenantId` field (claim-derived
 *     server-side; D2 — the #1 boundary).
 *   - Answer-key / rubric guidance (`UnifiedRubric.modelAnswer`,
 *     `evaluatorGuidance`, `EvaluationDimension.promptGuidance`) and AI cost
 *     telemetry are ⚷ server-only; the VIEW schemas below are the *projected*
 *     shapes the server emits — guidance fields are `.optional()` because they are
 *     present only for authoring roles and stripped for everyone else.
 *
 * The `CallableDef` type is owned by the api-contract CORE (`src/registry.ts`).
 * We import it **type-only** so there is no runtime import cycle (core's registry
 * spreads our `AUTOGRADE_CALLABLES` barrel). Defs are authored with a trailing
 * `satisfies CallableDef<…>` rather than the `defineCallable()` value helper for
 * the same cycle-avoidance reason.
 */
import { z } from "zod";
import { PageRequest } from "../../pagination.js";
import {
  zObject,
  zTimestamp,
  // branded ids
  zExamId,
  zExamQuestionId,
  zSubmissionId,
  zQuestionSubmissionId,
  zEvaluationSettingsId,
  zDeadLetterEntryId,
  zClassId,
  zStudentId,
  zSpaceId,
  zStoryPointId,
  zSectionId,
  zAcademicSessionId,
  // status enums
  zExamStatus,
  zSubmissionPipelineStatus,
  zQuestionGradingStatus,
  zUploadSource,
  zGradeLetter,
  // embedded shared content schemas (projected)
  UnifiedRubricSchema,
  UnifiedEvaluationResultSchema,
  // embedded autograde schemas reused by views
  ExamQuestionPaperSchema,
  ExamGradingConfigSchema,
  ExamStatsSchema,
  SubQuestionSchema,
  AnswerSheetDataSchema,
  ScoutingResultSchema,
  SubmissionSummarySchema,
  GradingProgressSchema,
  QuestionMappingSchema,
  ManualOverrideSchema,
  EvaluationDisplaySettingsSchema,
  EvaluationConfidenceConfigSchema,
  UsageQuotaConfigSchema,
  EvaluationDimensionSchema,
  ScoreDistributionSchema,
  QuestionAnalyticsEntrySchema,
  ClassBreakdownEntrySchema,
  TopicPerformanceEntrySchema,
  GRADING_PIPELINE_STEPS,
  DEAD_LETTER_RESOLUTION_METHODS,
} from "@levelup/domain";

// Re-export the CORE page-request fragment shape so every read def spreads the
// SAME wire envelope (`cursor?`, `limit` default 20). `tenantId` is structurally
// absent — the no-tenant-id-in-request contract test passes by construction.
export const zPageParamsShape = PageRequest.shape;

// ---------------------------------------------------------------------------
// SHARED RESPONSE FRAGMENT — SaveResponse (write callables)
// ---------------------------------------------------------------------------
export const SaveExamResponseSchema = zObject({
  id: zExamId,
  created: z.boolean(),
});
export type SaveExamResponse = z.infer<typeof SaveExamResponseSchema>;

export const SaveEvaluationSettingsResponseSchema = zObject({
  id: zEvaluationSettingsId,
  created: z.boolean(),
});
export type SaveEvaluationSettingsResponse = z.infer<typeof SaveEvaluationSettingsResponseSchema>;

// ---------------------------------------------------------------------------
// EXAM VIEWS
// ---------------------------------------------------------------------------

/** Row projection for `listExams` — denormalized counters from `stats`. */
export const ExamListViewSchema = zObject({
  id: zExamId,
  title: z.string(),
  subject: z.string(),
  topics: z.array(z.string()),
  classIds: z.array(zClassId),
  examDate: zTimestamp,
  duration: z.number().int(),
  totalMarks: z.number(),
  passingMarks: z.number(),
  status: zExamStatus,
  academicSessionId: zAcademicSessionId.optional(),
  linkedSpaceId: zSpaceId.optional(),
  linkedSpaceTitle: z.string().optional(),
  stats: ExamStatsSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type ExamListView = z.infer<typeof ExamListViewSchema>;

/** Full projection for `getExam`. `tenantId` intentionally absent (path-scoped). */
export const ExamDetailViewSchema = zObject({
  id: zExamId,
  title: z.string(),
  subject: z.string(),
  topics: z.array(z.string()),
  classIds: z.array(zClassId),
  sectionIds: z.array(zSectionId).optional(),
  examDate: zTimestamp,
  duration: z.number().int(),
  academicSessionId: zAcademicSessionId.optional(),
  totalMarks: z.number(),
  passingMarks: z.number(),
  status: zExamStatus,
  questionPaper: ExamQuestionPaperSchema.optional(),
  gradingConfig: ExamGradingConfigSchema,
  evaluationSettingsId: zEvaluationSettingsId.optional(),
  linkedSpaceId: zSpaceId.optional(),
  linkedSpaceTitle: z.string().optional(),
  linkedStoryPointId: zStoryPointId.optional(),
  stats: ExamStatsSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type ExamDetailView = z.infer<typeof ExamDetailViewSchema>;

/**
 * Question projection for `listQuestions`. `rubric` carries the resolved snapshot;
 * its `modelAnswer`/`evaluatorGuidance` and dimension `promptGuidance` are present
 * ONLY for authoring roles (server strips them otherwise) — already optional in the
 * shared `UnifiedRubricSchema`, so the single schema serves both projections.
 */
export const ExamQuestionViewSchema = zObject({
  id: zExamQuestionId,
  examId: zExamId,
  text: z.string(),
  imageUrls: z.array(z.string()).optional(),
  maxMarks: z.number(),
  order: z.number().int(),
  rubric: UnifiedRubricSchema,
  questionType: z.string().optional(),
  subQuestions: z.array(SubQuestionSchema).optional(),
  extractionConfidence: z.number().optional(),
  readabilityIssue: z.boolean().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type ExamQuestionView = z.infer<typeof ExamQuestionViewSchema>;

/** One extracted question (extractQuestions response item). */
export const ExtractedQuestionSchema = zObject({
  id: zExamQuestionId.optional(),
  text: z.string(),
  maxMarks: z.number(),
  order: z.number().int(),
  rubric: UnifiedRubricSchema.optional(),
  questionType: z.string().optional(),
  subQuestions: z.array(SubQuestionSchema).optional(),
  extractionConfidence: z.number().optional(),
  readabilityIssue: z.boolean().optional(),
});
export type ExtractedQuestion = z.infer<typeof ExtractedQuestionSchema>;

// ---------------------------------------------------------------------------
// SUBMISSION VIEWS
// ---------------------------------------------------------------------------

/**
 * Row projection for `listSubmissions`. The server pre-joins
 * `studentName`/`rollNumber`/`classId` (denormalized) so the repo never fans out
 * per student (N+1 collapse — REVIEW flag).
 */
export const SubmissionListViewSchema = zObject({
  id: zSubmissionId,
  examId: zExamId,
  studentId: zStudentId,
  studentName: z.string(),
  rollNumber: z.string(),
  classId: zClassId,
  pipelineStatus: zSubmissionPipelineStatus,
  summary: SubmissionSummarySchema,
  gradingProgress: GradingProgressSchema.optional(),
  resultsReleased: z.boolean(),
  uploadedBy: z.string().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type SubmissionListView = z.infer<typeof SubmissionListViewSchema>;

/**
 * Full projection for `getSubmission`. Released-only for student/parent; full for
 * teacher (server enforces). `summary` score fields are server-computed.
 */
export const SubmissionDetailViewSchema = zObject({
  id: zSubmissionId,
  examId: zExamId,
  studentId: zStudentId,
  studentName: z.string(),
  rollNumber: z.string(),
  classId: zClassId,
  answerSheets: AnswerSheetDataSchema,
  scoutingResult: ScoutingResultSchema.optional(),
  // ⚷ release-gated: the score summary is WITHHELD (omitted) for an owner reading
  // BEFORE results are released (§6.10 stripped projection), so it is optional here.
  summary: SubmissionSummarySchema.optional(),
  pipelineStatus: zSubmissionPipelineStatus,
  pipelineError: z.string().optional(),
  retryCount: z.number().int(),
  gradingProgress: GradingProgressSchema.optional(),
  resultsReleased: z.boolean(),
  resultsReleasedAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type SubmissionDetailView = z.infer<typeof SubmissionDetailViewSchema>;

/**
 * Per-question projection for `listQuestionSubmissions`. `evaluation` is the shared
 * `UnifiedEvaluationResult` and is returned ONLY when the result is visible
 * (released-gate); the answer key is NEVER returned. Cost telemetry inside
 * `evaluation` is ⚷ and stripped server-side (the field stays optional here).
 */
export const QuestionSubmissionViewSchema = zObject({
  id: zQuestionSubmissionId,
  submissionId: zSubmissionId,
  questionId: zExamQuestionId,
  examId: zExamId,
  mapping: QuestionMappingSchema,
  evaluation: UnifiedEvaluationResultSchema.optional(),
  gradingStatus: zQuestionGradingStatus,
  gradingError: z.string().optional(),
  manualOverride: ManualOverrideSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type QuestionSubmissionView = z.infer<typeof QuestionSubmissionViewSchema>;

// ---------------------------------------------------------------------------
// EVALUATION-SETTINGS VIEW
// ---------------------------------------------------------------------------

/**
 * `listEvaluationSettings` projection. `confidenceConfig` thresholds and dimension
 * `promptGuidance` are visible to authoring roles only — optional here, stripped by
 * the projection service for everyone else.
 */
export const EvaluationSettingsViewSchema = zObject({
  id: zEvaluationSettingsId,
  name: z.string(),
  description: z.string().optional(),
  isDefault: z.boolean(),
  isPublic: z.boolean().optional(),
  enabledDimensions: z.array(EvaluationDimensionSchema),
  displaySettings: EvaluationDisplaySettingsSchema,
  confidenceConfig: EvaluationConfidenceConfigSchema.optional(),
  usageQuota: UsageQuotaConfigSchema.optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type EvaluationSettingsView = z.infer<typeof EvaluationSettingsViewSchema>;

// ---------------------------------------------------------------------------
// DEAD-LETTER VIEW
// ---------------------------------------------------------------------------

export const DeadLetterViewSchema = zObject({
  id: zDeadLetterEntryId,
  submissionId: zSubmissionId,
  questionSubmissionId: zQuestionSubmissionId.optional(),
  pipelineStep: z.enum(GRADING_PIPELINE_STEPS),
  error: z.string(),
  attempts: z.number().int(),
  lastAttemptAt: zTimestamp,
  resolvedAt: zTimestamp.nullable(),
  resolutionMethod: z.enum(DEAD_LETTER_RESOLUTION_METHODS).optional(),
  createdAt: zTimestamp,
});
export type DeadLetterView = z.infer<typeof DeadLetterViewSchema>;

// ---------------------------------------------------------------------------
// EXAM-ANALYTICS VIEW (read-only; analytics-fn-owned source)
// ---------------------------------------------------------------------------

export const ExamAnalyticsViewSchema = zObject({
  examId: zExamId,
  totalSubmissions: z.number().int(),
  gradedSubmissions: z.number().int(),
  avgScore: z.number(),
  avgPercentage: z.number(),
  passRate: z.number(),
  medianScore: z.number(),
  scoreDistribution: ScoreDistributionSchema,
  questionAnalytics: z.record(z.string(), QuestionAnalyticsEntrySchema),
  classBreakdown: z.record(z.string(), ClassBreakdownEntrySchema),
  topicPerformance: z.record(z.string(), TopicPerformanceEntrySchema),
  computedAt: zTimestamp,
  lastUpdatedAt: zTimestamp,
});
export type ExamAnalyticsView = z.infer<typeof ExamAnalyticsViewSchema>;
