/**
 * Minimal structural view of the `@levelup/api-client` public surface that the
 * testsession-progress repos depend on (SDK-LAYERS-PLAN §1.2 — repos import
 * `@levelup/api-client` ONLY). `@levelup/api-client` is built concurrently in the
 * same wave; this file pins the plan-specified namespaced shape
 * (`api.<module>.<op>(req) → Promise<res>`) so this domain typechecks against the
 * declared public surface and the typecheck/fix wave reconciles any drift.
 *
 * The shape mirrors api-client-core.md §3.2:
 *   { identity, levelup, autograde, analytics, subscribe, call }
 * Each callable is `(req) => Promise<res>`. We type only the callables this
 * domain invokes; everything else stays a permissive index so the real
 * `ApiClient` is assignable to this view.
 */
import type {
  SpaceId,
  StoryPointId,
  ItemId,
  TestSessionId,
  UserId,
  InsightId,
  DigitalTestSession,
  StoryPointProgressDoc,
  SpaceProgress,
  ItemProgressEntry,
  LearningInsight,
  StoredEvaluation,
  StudentProgressSummary,
  ClassProgressSummary,
  TestSessionStatus,
  TestSessionType,
} from "@levelup/domain";

/** Contract pagination fragment (`PageRequest` — §3.5). */
export interface PageRequest {
  cursor?: string;
  limit?: number;
}

/** Contract `pageResponse(item)` envelope (§3.5). */
export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

// ---------------------------------------------------------------------------
// Request / response shapes for the callables this domain owns (§3.2 / domain
// plan). Authored against the FROZEN contract; the real api-contract schemas are
// the SSOT and the typecheck/fix wave reconciles field-level drift.
// ---------------------------------------------------------------------------

export interface StartTestSessionRequest {
  spaceId: SpaceId;
  storyPointId: StoryPointId;
}
/** Answer-key-free session projection (domain plan — `DigitalTestSessionView`). */
export type DigitalTestSessionView = DigitalTestSession;
export interface StartTestSessionResponse {
  session: DigitalTestSessionView;
}

export interface SubmitTestSessionRequest {
  sessionId: TestSessionId;
  autoSubmitted?: boolean;
}
export interface SubmitTestSessionResponse {
  session: DigitalTestSessionView;
  progressUpdated: boolean;
}

export interface EvaluateAnswerRequest {
  spaceId: SpaceId;
  storyPointId?: StoryPointId;
  itemId: ItemId;
  answer: unknown;
  mediaUrls?: string[];
}
export interface EvaluateAnswerResponse {
  evaluation: StoredEvaluation;
  progressRecorded: boolean;
}

/**
 * recordItemAttempt — CD13: the client sends the RAW learner `answer` only and
 * NEVER a client-set score/maxScore/correct; the server scores (§4.4, §6.5).
 */
export interface RecordItemAttemptRequest {
  spaceId: SpaceId;
  storyPointId: StoryPointId;
  itemId: ItemId;
  answer: unknown;
  timeSpent?: number;
}
export type ItemProgressView = ItemProgressEntry;
export interface RecordItemAttemptResponse {
  progress: ItemProgressView;
  completed: boolean;
}

export interface GetTestSessionRequest {
  sessionId: TestSessionId;
}
export interface GetTestSessionResponse {
  session: DigitalTestSessionView;
}

export interface ListTestSessionsRequest extends PageRequest {
  spaceId?: SpaceId;
  storyPointId?: StoryPointId;
  userId?: UserId;
  status?: TestSessionStatus;
  latestOnly?: boolean;
}
/** List projection (no submissions) — domain plan `DigitalTestSessionSummary`. */
export interface DigitalTestSessionSummary {
  id: TestSessionId;
  sessionType: TestSessionType;
  status: TestSessionStatus;
  attemptNumber: number;
  percentage?: number;
  submittedAt?: string;
}

export interface GetSpaceProgressRequest {
  spaceId: SpaceId;
  userId?: UserId;
}
export type SpaceProgressView = SpaceProgress;
export interface GetSpaceProgressResponse {
  progress: SpaceProgressView | null;
}

export interface GetStoryPointProgressRequest {
  spaceId: SpaceId;
  storyPointId: StoryPointId;
  userId?: UserId;
}
export type StoryPointProgressDocView = StoryPointProgressDoc;
export interface GetStoryPointProgressResponse {
  progress: StoryPointProgressDocView | null;
}

export interface ListLearningInsightsRequest extends PageRequest {
  studentId?: UserId;
  type?: string;
  includeDismissed?: boolean;
}

export interface DismissInsightRequest {
  insightId: InsightId;
}
export interface DismissInsightResponse {
  id: InsightId;
  dismissed: true;
}

// ---------------------------------------------------------------------------
// Cross-domain (view repo) — StudentProgressSummary is authored by analytics
// triggers; surfaced here for learner/parent dashboards (domain plan open-Q #3).
// The read endpoint lives under `v1.analytics.*`; the view repo is a thin
// composer over it (R6 view exception).
// ---------------------------------------------------------------------------

export interface GetChildSummaryRequest {
  studentId: UserId;
}
export interface GetChildSummaryResponse {
  studentSummary: StudentProgressSummary;
  recentInsights: LearningInsight[];
}
export interface GetSummaryRequest {
  scope: "student" | "class" | "platform" | "health";
  studentId?: UserId;
  classId?: string;
}

/** A levelup-module callable surface (only the ops this domain calls). */
type Callable<Req, Res> = (req: Req) => Promise<Res>;

export interface LevelupNamespace {
  startTestSession: Callable<StartTestSessionRequest, StartTestSessionResponse>;
  submitTestSession: Callable<SubmitTestSessionRequest, SubmitTestSessionResponse>;
  evaluateAnswer: Callable<EvaluateAnswerRequest, EvaluateAnswerResponse>;
  recordItemAttempt: Callable<RecordItemAttemptRequest, RecordItemAttemptResponse>;
  getTestSession: Callable<GetTestSessionRequest, GetTestSessionResponse>;
  listTestSessions: Callable<ListTestSessionsRequest, PageResponse<DigitalTestSessionSummary>>;
  getSpaceProgress: Callable<GetSpaceProgressRequest, GetSpaceProgressResponse>;
  getStoryPointProgress: Callable<GetStoryPointProgressRequest, GetStoryPointProgressResponse>;
  listLearningInsights: Callable<ListLearningInsightsRequest, PageResponse<LearningInsight>>;
  dismissInsight: Callable<DismissInsightRequest, DismissInsightResponse>;
  // permissive tail — other levelup callables exist on the real client.
  [op: string]: (req: never) => Promise<unknown>;
}

/**
 * Batched student-summary read — the N+1 collapse for parent/teacher dashboards
 * (§4.1 getMany: the client sends the full id list in ONE request; the 10/30-id
 * `in`-chunking + max-ids cap lives SERVER-SIDE in repository-admin, the client
 * never touches Firestore).
 */
export interface GetStudentSummariesRequest {
  studentIds: UserId[];
}
export interface GetStudentSummariesResponse {
  items: StudentProgressSummary[];
}

/** Class roll-up read — class summary + member summaries in one shaped call. */
export interface GetClassSummaryRequest {
  classId: string;
}
export interface GetClassSummaryResponse {
  classSummary: ClassProgressSummary;
  members: StudentProgressSummary[];
}

export interface AnalyticsNamespace {
  getChildSummary: Callable<GetChildSummaryRequest, GetChildSummaryResponse>;
  getSummary: Callable<
    GetSummaryRequest,
    { summary: ClassProgressSummary | StudentProgressSummary }
  >;
  getStudentSummaries: Callable<GetStudentSummariesRequest, GetStudentSummariesResponse>;
  getClassSummary: Callable<GetClassSummaryRequest, GetClassSummaryResponse>;
  [op: string]: (req: never) => Promise<unknown>;
}

/**
 * The structural slice of `ApiClient` this domain consumes. The real client (a
 * superset) is assignable to this. Repos accept this so they are testable
 * against the fake ApiClient seam.
 */
export interface ApiClient {
  levelup: LevelupNamespace;
  analytics: AnalyticsNamespace;
  identity: Record<string, (req: never) => Promise<unknown>>;
  autograde: Record<string, (req: never) => Promise<unknown>>;
}
