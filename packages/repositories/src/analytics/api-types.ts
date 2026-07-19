/**
 * Minimal structural view of the `@levelup/api-client` public surface that the
 * **analytics** repos depend on (SDK-LAYERS-PLAN §1.2 — repos import
 * `@levelup/api-client` + `@levelup/domain` ONLY). `@levelup/api-client` is built
 * concurrently in the same wave; this file pins the plan-specified namespaced
 * shape (`api.<module>.<op>(req) → Promise<res>`) so this domain typechecks
 * against the declared public surface and the typecheck/fix wave reconciles any
 * field-level drift.
 *
 * The shape mirrors api-client-core.md §3.2:
 *   { identity, levelup, autograde, analytics, subscribe, call }
 * Each callable is `(req) => Promise<res>`. We type only the `v1.analytics.*`
 * callables this domain invokes; every other namespace keeps a permissive `[op]`
 * tail so the real (superset) `ApiClient` stays assignable to this view.
 *
 * Contract source: analytics.md §"API contract" + SDK-LAYERS-PLAN §3.2
 * `v1.analytics.*`. **No request schema declares `tenantId`** (claim-derived
 * server-side — D2).
 */
import type {
  StudentId,
  ClassId,
  ExamId,
  UserId,
  SpaceId,
  StoryPointId,
  InsightId,
  StudentProgressSummary,
  ClassProgressSummary,
  ExamAnalytics,
  LearningInsight,
  DailyCostSummary,
  MonthlyCostSummary,
  HealthSnapshot,
  PlatformActivityLog,
  LeaderboardEntry,
  CostSummaryGranularity,
  Timestamp,
} from "@levelup/domain";

// ---------------------------------------------------------------------------
// Contract pagination fragment (§3.5) — repos thread the opaque cursor verbatim.
// ---------------------------------------------------------------------------

// DP-1: canonical wire envelopes from api-contract. `cursor` is `string`
// (optional, NOT nullable — the strict contract rejects `null`).
import type {
  PageRequestInput as PageRequest,
  PageResponse,
  SubscriptionHandle,
  Callable,
  ReqOf,
  ResOf,
} from "@levelup/api-contract";

export type { PageRequest, PageResponse, SubscriptionHandle };

// ---------------------------------------------------------------------------
// getSummary — discriminated by scope (analytics.md §getSummary).
// Platform / health scopes are tenant-less + super-admin only. The view-model
// shapes for platform/health are defined here (no domain entity exists; they are
// pure read projections).
// ---------------------------------------------------------------------------

export type SummaryScope = "student" | "class" | "platform" | "health";

export interface GetSummaryRequest {
  scope: SummaryScope;
  studentId?: StudentId;
  classId?: ClassId;
}

/** Super-admin platform roll-up projection (read-only view-model). */
export interface PlatformSummary {
  tenantCount: number;
  studentCount: number;
  teacherCount: number;
  examCount: number;
  spaceCount: number;
  activeStudents?: number;
  recentActivity?: PlatformActivityLog[];
}

/** Super-admin platform health projection (read-only view-model). */
export interface HealthSummary {
  status: HealthSnapshot["status"];
  services: HealthSnapshot["services"];
  checkedAt: Timestamp;
  recentSnapshots?: HealthSnapshot[];
}

export type GetSummaryResponse =
  | { scope: "student"; studentSummary: StudentProgressSummary }
  | { scope: "class"; classSummary: ClassProgressSummary }
  | { scope: "platform"; platformSummary: PlatformSummary }
  | { scope: "health"; healthSummary: HealthSummary };

// ---------------------------------------------------------------------------
// generateReport (idem, report tier) — server-authoritative PDF artifact.
// ---------------------------------------------------------------------------

export type ReportType = "exam-result" | "progress" | "class";

export interface GenerateReportRequest {
  type: ReportType;
  examId?: ExamId;
  studentId?: StudentId;
  classId?: ClassId;
}
export interface GenerateReportResponse {
  pdfUrl: string;
  expiresAt: Timestamp;
}

// ---------------------------------------------------------------------------
// getExamAnalytics (new READ — replaces direct examAnalytics/{examId} read).
// ---------------------------------------------------------------------------

export interface GetExamAnalyticsRequest {
  examId: ExamId;
}

// ---------------------------------------------------------------------------
// listInsights + dismissInsight.
// ---------------------------------------------------------------------------

export interface ListInsightsRequest extends PageRequest {
  studentId: StudentId;
  includeDismissed?: boolean;
}

export interface DismissInsightRequest {
  insightId: InsightId;
}
export interface DismissInsightResponse {
  id: InsightId;
  dismissedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// getPerformanceTrends (new — common-api §156). Server already aggregates; the
// repo only maps the points to chart shape.
// ---------------------------------------------------------------------------

export type TrendGranularity = "week" | "month" | "term";

export interface TrendRange {
  from: Timestamp;
  to: Timestamp;
}

export interface GetPerformanceTrendsRequest {
  subjectId?: string;
  studentId?: StudentId;
  classId?: ClassId;
  granularity: TrendGranularity;
  range?: TrendRange;
}

/** `PerformanceTrendPoint` (analytics.md entity table — new). */
export interface PerformanceTrendPoint {
  periodStart: Timestamp;
  periodEnd: Timestamp;
  avgPercentage: number;
  examCount: number;
  completionPct: number;
  overallScore: number;
}
export interface GetPerformanceTrendsResponse {
  points: PerformanceTrendPoint[];
}

// ---------------------------------------------------------------------------
// Parent endpoints — getChildSummary, listLinkedChildren (N+1 collapse).
// ---------------------------------------------------------------------------

export interface GetChildSummaryRequest {
  studentId: StudentId;
}
export interface GetChildSummaryResponse {
  studentSummary: StudentProgressSummary;
  recentInsights: LearningInsight[];
}

/** A single linked-child row (server shapes; the parent fan-out is collapsed). */
export interface ChildSummaryRow {
  studentId: StudentId;
  name: string;
  classNames: string[];
  overallScore: number;
  isAtRisk: boolean;
}
export type ListLinkedChildrenRequest = PageRequest;

// ---------------------------------------------------------------------------
// getCostSummary (new READ, admin) — normalized costSummaries/{daily|monthly}.
// ---------------------------------------------------------------------------

export interface CostRange {
  from: string;
  to: string;
}

export interface GetCostSummaryRequest {
  granularity: CostSummaryGranularity;
  /** YYYY-MM-DD (daily) */
  date?: string;
  /** YYYY-MM (monthly) */
  month?: string;
  range?: CostRange;
}
export interface GetCostSummaryResponse {
  summaries: (DailyCostSummary | MonthlyCostSummary)[];
}

// ---------------------------------------------------------------------------
// getLeaderboard (new READ) — shapes the RTDB leaderboard snapshot + myEntry.
// ---------------------------------------------------------------------------

export type LeaderboardScope = "tenant" | "space" | "storyPoint";

export interface GetLeaderboardRequest {
  scope: LeaderboardScope;
  spaceId?: SpaceId;
  storyPointId?: StoryPointId;
  limit?: number;
}
export interface GetLeaderboardResponse {
  entries: LeaderboardEntry[];
  myEntry?: LeaderboardEntry;
}

export type GetSpaceAnalyticsRequest = ReqOf<"v1.analytics.getSpaceAnalytics">;
export type GetSpaceAnalyticsResponse = ResOf<"v1.analytics.getSpaceAnalytics">;

// ---------------------------------------------------------------------------
// The `v1.analytics.*` namespace surface — only the ops the analytics repos
// invoke. The permissive `[op]` tail keeps the real (superset) client
// assignable.
// ---------------------------------------------------------------------------

export interface AnalyticsNamespace {
  getSummary: Callable<GetSummaryRequest, GetSummaryResponse>;
  generateReport: Callable<GenerateReportRequest, GenerateReportResponse>;
  getExamAnalytics: Callable<GetExamAnalyticsRequest, ExamAnalytics>;
  listInsights: Callable<ListInsightsRequest, PageResponse<LearningInsight>>;
  dismissInsight: Callable<DismissInsightRequest, DismissInsightResponse>;
  getPerformanceTrends: Callable<GetPerformanceTrendsRequest, GetPerformanceTrendsResponse>;
  getChildSummary: Callable<GetChildSummaryRequest, GetChildSummaryResponse>;
  listLinkedChildren: Callable<ListLinkedChildrenRequest, PageResponse<ChildSummaryRow>>;
  getCostSummary: Callable<GetCostSummaryRequest, GetCostSummaryResponse>;
  getLeaderboard: Callable<GetLeaderboardRequest, GetLeaderboardResponse>;
  getSpaceAnalytics: Callable<GetSpaceAnalyticsRequest, GetSpaceAnalyticsResponse>;
  // permissive tail — other analytics callables exist on the real client.
  [op: string]: (req: never) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Realtime subscribe pass-through (§3.7) — leaderboard live + notification badge.
// `SubscriptionHandle` is the canonical api-contract type (imported above).
// ---------------------------------------------------------------------------

export type SubscribeFn = (
  name: string,
  params: Record<string, unknown>,
  cb: (payload: unknown) => void
) => SubscriptionHandle;

/**
 * The structural slice of `ApiClient` the analytics repos consume. The real
 * client (a superset) is assignable to this; sibling namespaces stay permissive
 * so the analytics factory does not over-constrain the shared client object.
 */
export interface ApiClient {
  analytics: AnalyticsNamespace;
  identity: Record<string, (req: never) => Promise<unknown>>;
  levelup: Record<string, (req: never) => Promise<unknown>>;
  autograde: Record<string, (req: never) => Promise<unknown>>;
  subscribe?: SubscribeFn;
}
