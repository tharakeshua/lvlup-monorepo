/**
 * Minimal structural view of the `@levelup/api-client` public surface that the
 * autograde repos depend on (SDK-LAYERS-PLAN §1.2 / §4.1 — repos import
 * `@levelup/api-client` ONLY). `@levelup/api-client` is built concurrently in the
 * same wave; this file pins the plan-specified namespaced shape
 * (`api.<module>.<op>(req) → Promise<res>`) so this domain typechecks against the
 * declared public surface and the typecheck/fix wave reconciles any drift.
 *
 * The shape mirrors api-client-core.md §3.2:
 *   { identity, levelup, autograde, analytics, subscribe, call }
 * Each callable is `(req) => Promise<res>`. We type only the callables this
 * domain invokes; everything else stays a permissive index so the real
 * `ApiClient` (a superset) is assignable to this view.
 *
 * Authored against the FROZEN `sdk-plan/domains/autograde.md` contract; the real
 * api-contract `.strict()` schemas are the SSOT and the typecheck/fix wave
 * reconciles field-level drift. **No request shape carries `tenantId`** (D2 — the
 * #1 boundary; claim-derived server-side).
 */
import type {
  ExamId,
  ExamQuestionId,
  SubmissionId,
  QuestionSubmissionId,
  EvaluationSettingsId,
  DeadLetterEntryId,
  ClassId,
  StudentId,
  SpaceId,
  StoryPointId,
  Exam,
  ExamQuestion,
  ExamStats,
  Submission,
  SubmissionSummary,
  QuestionSubmission,
  EvaluationSettings,
  EvaluationDimension,
  GradingDeadLetterEntry,
  ExamAnalytics,
  ExamStatus,
  SubmissionPipelineStatus,
} from "@levelup/domain";

// ---------------------------------------------------------------------------
// Contract pagination fragment (§3.5) — repos thread the opaque cursor verbatim.
// ---------------------------------------------------------------------------

// DP-1: canonical wire envelopes from api-contract. `cursor` is `string`
// (optional, NOT nullable — the strict contract rejects `null`).
import type {
  PageRequestInput as PageRequest,
  PageResponse,
  SaveResponse,
  Callable,
} from "@levelup/api-contract";

export type { PageRequest, PageResponse, SaveResponse };

// ---------------------------------------------------------------------------
// View-model projections (domain plan §Reads). These are the answer-key /
// guidance-stripped, release-gated client projections — NEVER the fat
// authoritative doc. Authored loosely (extending the domain entity) so the
// typecheck/fix wave can swap in the exact api-contract view schemas.
// ---------------------------------------------------------------------------

/** `listExams` row projection (denormalized counts only; no ⚷ fields). */
export type ExamListView = Exam;
/** `getExam` detail projection. */
export type ExamDetailView = Exam;
/** `listQuestions` projection — rubric `evaluatorGuidance`/`modelAnswer` stripped by role server-side. */
export type ExamQuestionView = ExamQuestion;
/** `listSubmissions` row projection — server pre-joins studentName/rollNumber/classId (N+1 collapse). */
export type SubmissionListView = Submission;
/** `getSubmission` detail projection — released-only for student/parent. */
export type SubmissionDetailView = Submission;
/** `listQuestionSubmissions` projection — released-gate + answer-key projection (⚷). */
export type QuestionSubmissionView = QuestionSubmission;
/** `listEvaluationSettings` projection — thresholds visible to authoring roles only. */
export type EvaluationSettingsView = EvaluationSettings;
/** `listDeadLetter` row projection. */
export type DeadLetterView = GradingDeadLetterEntry;
/** `getExamAnalytics` projection (read-only; analytics-fn authored). */
export type ExamAnalyticsView = ExamAnalytics;

// ---------------------------------------------------------------------------
// Request / response shapes — writes / commands (domain plan §Writes).
// ---------------------------------------------------------------------------

/** `saveExam` data payload — metadata only; lifecycle via dedicated verbs (DX-5). */
export interface SaveExamData {
  title?: string;
  subject?: string;
  topics?: string[];
  classIds?: ClassId[];
  sectionIds?: string[];
  examDate?: string;
  duration?: number;
  academicSessionId?: string;
  totalMarks?: number;
  passingMarks?: number;
  gradingConfig?: Record<string, unknown>;
  linkedSpaceId?: SpaceId;
  linkedSpaceTitle?: string;
  linkedStoryPointId?: StoryPointId;
  status?: ExamStatus;
  evaluationSettingsId?: EvaluationSettingsId;
  questionPaperImages?: string[];
}
export interface SaveExamInput {
  id?: ExamId;
  data?: SaveExamData;
  delete?: boolean;
}

export interface ExtractQuestionsRequest {
  examId: ExamId;
  mode?: "full" | "single";
  questionNumber?: string;
}
export interface ExtractedQuestion {
  questionId?: ExamQuestionId;
  text: string;
  maxMarks: number;
  order: number;
}
export interface ExtractQuestionsResponse {
  success: boolean;
  questions: ExtractedQuestion[];
  warnings: string[];
  metadata: {
    questionCount: number;
    tokensUsed: number;
    cost: number;
    extractedAt: string;
    imageQualityAcceptable: boolean;
    mode?: "full" | "single";
  };
}

export interface UploadAnswerSheetsRequest {
  examId: ExamId;
  studentId: StudentId;
  classId: ClassId;
  imageUrls: string[];
}
export interface UploadAnswerSheetsResponse {
  submissionId: SubmissionId;
}

export type GradeQuestionMode = "manual" | "retry" | "ai";
export interface GradeQuestionRequest {
  mode: GradeQuestionMode;
  submissionId?: SubmissionId;
  questionId?: ExamQuestionId;
  score?: number;
  feedback?: string;
  examId?: ExamId;
  questionIds?: ExamQuestionId[];
}
export interface GradeQuestionResponse {
  success: boolean;
  updatedScore?: number;
  gradingStatus?: string;
  retriedCount?: number;
}

export interface SaveEvaluationSettingsData {
  name?: string;
  description?: string;
  isDefault?: boolean;
  isPublic?: boolean;
  enabledDimensions?: EvaluationDimension[];
  displaySettings?: Record<string, unknown>;
  confidenceConfig?: Record<string, unknown>;
  usageQuota?: Record<string, unknown>;
}
export interface SaveEvaluationSettingsInput {
  id?: EvaluationSettingsId;
  data?: SaveEvaluationSettingsData;
  delete?: boolean;
}

export type DeadLetterResolutionMethod = "retry" | "manual_grade" | "dismiss";
export interface ResolveDeadLetterRequest {
  entryId: DeadLetterEntryId;
  method: DeadLetterResolutionMethod;
}
export interface ResolveDeadLetterResponse {
  success: boolean;
  resolution: DeadLetterResolutionMethod;
}

export interface ReleaseResultsRequest {
  examId: ExamId;
  classIds?: ClassId[];
}
export interface ReleaseResultsResponse {
  id: ExamId;
  releasedCount: number;
  created: false;
}

// ---------------------------------------------------------------------------
// Request shapes — reads (domain plan §Reads).
// ---------------------------------------------------------------------------

export interface ExamFilter {
  status?: ExamStatus;
  classId?: ClassId;
  academicSessionId?: string;
  subject?: string;
  linkedSpaceId?: SpaceId;
}
export interface ListExamsRequest extends PageRequest {
  filter?: ExamFilter;
}
export interface GetExamRequest {
  id: ExamId;
}

export interface ListQuestionsRequest {
  examId: ExamId;
}
export interface ListQuestionsResponse {
  questions: ExamQuestionView[];
}

export interface SubmissionFilter {
  examId: ExamId;
  classId?: ClassId;
  studentId?: StudentId;
  pipelineStatus?: SubmissionPipelineStatus;
  resultsReleasedOnly?: boolean;
}
export interface ListSubmissionsRequest extends PageRequest {
  filter: SubmissionFilter;
}
export interface GetSubmissionRequest {
  id: SubmissionId;
}

export interface ListQuestionSubmissionsRequest {
  submissionId: SubmissionId;
}
export interface ListQuestionSubmissionsResponse {
  questionSubmissions: QuestionSubmissionView[];
}

export interface GetExamAnalyticsRequest {
  examId: ExamId;
}

export interface ListEvaluationSettingsRequest {
  includePublic?: boolean;
}
export interface ListEvaluationSettingsResponse {
  settings: EvaluationSettingsView[];
}

export interface DeadLetterFilter {
  resolved?: boolean;
  pipelineStep?: "scouting" | "grading";
}
export interface ListDeadLetterRequest extends PageRequest {
  filter?: DeadLetterFilter;
}

// ---------------------------------------------------------------------------
// View-repo composite reads (§4.1 ⊕). The cross-entity dashboards prefer a
// server composite (PC-14) and fall back to a SMALL FIXED set of batched reads.
// ---------------------------------------------------------------------------

export interface GradingReviewBundleRequest {
  submissionId: SubmissionId;
}
export interface GradingReviewView {
  submission: SubmissionDetailView;
  questionSubmissions: QuestionSubmissionView[];
  questions: ExamQuestionView[];
}

export interface ExamGradingOverviewRequest {
  examId: ExamId;
}
export interface ExamGradingOverview {
  exam: ExamDetailView;
  submissions: SubmissionListView[];
  analytics: ExamAnalyticsView | null;
}

// ---------------------------------------------------------------------------
// The autograde namespace surface — only the ops the autograde repos invoke.
// The permissive `[op]` tail keeps the real (superset) client assignable.
// ---------------------------------------------------------------------------

// `Callable<Req, Res>` imported from `@levelup/api-contract` (DP-1).

export interface AutogradeNamespace {
  // writes
  saveExam: Callable<SaveExamInput, SaveResponse>;
  extractQuestions: Callable<ExtractQuestionsRequest, ExtractQuestionsResponse>;
  uploadAnswerSheets: Callable<UploadAnswerSheetsRequest, UploadAnswerSheetsResponse>;
  gradeQuestion: Callable<GradeQuestionRequest, GradeQuestionResponse>;
  saveEvaluationSettings: Callable<SaveEvaluationSettingsInput, SaveResponse>;
  resolveDeadLetter: Callable<ResolveDeadLetterRequest, ResolveDeadLetterResponse>;
  releaseResults: Callable<ReleaseResultsRequest, ReleaseResultsResponse>;
  // reads
  listExams: Callable<ListExamsRequest, PageResponse<ExamListView>>;
  getExam: Callable<GetExamRequest, ExamDetailView>;
  listQuestions: Callable<ListQuestionsRequest, ListQuestionsResponse>;
  listSubmissions: Callable<ListSubmissionsRequest, PageResponse<SubmissionListView>>;
  getSubmission: Callable<GetSubmissionRequest, SubmissionDetailView>;
  listQuestionSubmissions: Callable<
    ListQuestionSubmissionsRequest,
    ListQuestionSubmissionsResponse
  >;
  getExamAnalytics: Callable<GetExamAnalyticsRequest, ExamAnalyticsView>;
  listEvaluationSettings: Callable<ListEvaluationSettingsRequest, ListEvaluationSettingsResponse>;
  listDeadLetter: Callable<ListDeadLetterRequest, PageResponse<DeadLetterView>>;
  // optional server composites for the view repos (PC-14)
  getGradingReviewBundle?: Callable<GradingReviewBundleRequest, GradingReviewView>;
  getExamGradingOverview?: Callable<ExamGradingOverviewRequest, ExamGradingOverview>;
  // permissive tail — other autograde callables exist on the real client.
  [op: string]: ((req: never) => Promise<unknown>) | undefined;
}

/**
 * The structural slice of `ApiClient` the autograde repos consume. The real
 * client (a superset) is assignable to this. Repos accept this so they are
 * testable against the fake ApiClient seam.
 */
export interface ApiClient {
  autograde: AutogradeNamespace;
  identity: Record<string, (req: never) => Promise<unknown>>;
  levelup: Record<string, (req: never) => Promise<unknown>>;
  analytics: Record<string, (req: never) => Promise<unknown>>;
}

// Re-export the borrowed domain types repos reference in their shaping signatures.
export type {
  Exam,
  ExamQuestion,
  ExamStats,
  Submission,
  SubmissionSummary,
  QuestionSubmission,
  EvaluationSettings,
  GradingDeadLetterEntry,
  ExamAnalytics,
  ExamStatus,
  SubmissionPipelineStatus,
  ExamId,
  SubmissionId,
  ExamQuestionId,
  EvaluationSettingsId,
  DeadLetterEntryId,
  ClassId,
};
