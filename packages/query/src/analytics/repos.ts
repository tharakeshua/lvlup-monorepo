/**
 * Typed accessor for the analytics repos off the shared `Repositories` bag
 * (domain plan analytics.md §Repositories).
 *
 * The root `createRepositories(api)` bag folds every domain factory into one flat
 * record; this domain's repos (`summaryRepo`/`examAnalyticsRepo`/`insightRepo`/
 * `costRepo`/`trendsRepo`/`parentRepo`/`reportRepo`/`leaderboardRepo`) are reached
 * through the bag's open `Record<string, Repo>` tail. This module re-states the
 * repo seams (structurally compatible with `@levelup/repositories`' analytics
 * exports) so the hooks call them with full typing — NO `firebase`/transport
 * import; repos are injected (query-infra.md §2).
 *
 * Analytics is a read + derived-projection domain (no `ALLOWED_TRANSITIONS`); the
 * ONLY mutating surfaces are `dismissInsight` (✅ optimistic) and `generateReport`
 * (❌ never optimistic — returns a signed URL).
 */
import type {
  ClassId,
  ClassProgressSummary,
  DailyCostSummary,
  ExamAnalytics,
  ExamId,
  InsightId,
  LeaderboardEntry,
  LearningInsight,
  MonthlyCostSummary,
  StudentId,
  StudentProgressSummary,
} from "@levelup/domain";

// ── pagination envelopes (read-only here) ───────────────────────────────────
export interface PageRequest {
  cursor?: string;
  limit?: number;
}
export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

// ── derived/projection shapes carried over the repo seam ─────────────────────
export interface PlatformSummary {
  [k: string]: unknown;
}
export interface HealthSummary {
  [k: string]: unknown;
}
export interface PerformanceTrendPoint {
  date: string;
  value: number;
  [k: string]: unknown;
}
export interface ChildSummaryRow {
  studentId: StudentId;
  [k: string]: unknown;
}
export interface GetChildSummaryResponse {
  studentSummary: StudentProgressSummary;
  recentInsights: LearningInsight[];
}
export interface GenerateReportResponse {
  pdfUrl: string;
  expiresAt: string;
}
export interface DismissInsightResponse {
  id: InsightId;
  dismissedAt?: string;
  dismissed?: true;
}
export interface GetLeaderboardResponse {
  entries: LeaderboardEntry[];
  myEntry?: LeaderboardEntry;
  [k: string]: unknown;
}

// ── request filters ──────────────────────────────────────────────────────────
export interface ListInsightsRequest extends PageRequest {
  studentId?: StudentId;
  type?: string;
  includeDismissed?: boolean;
}
export type CostGranularity = "daily" | "monthly";
export interface CostRange {
  from: string;
  to: string;
}
export interface CostFilter {
  date?: string;
  month?: string;
  range?: CostRange;
}
export type TrendGranularity = "week" | "month" | "term";
export interface GetPerformanceTrendsRequest {
  studentId?: StudentId;
  classId?: ClassId;
  subjectId?: string;
  granularity: TrendGranularity;
  range?: { from: string; to: string };
}
export type ListLinkedChildrenRequest = PageRequest;
export type LeaderboardScope = "tenant" | "space" | "storyPoint";
export interface GetLeaderboardRequest {
  scope: LeaderboardScope;
  spaceId?: string;
  storyPointId?: string;
  limit?: number;
}
export interface LeaderboardSubParams {
  scope: LeaderboardScope;
  spaceId?: string;
  storyPointId?: string;
  limit?: number;
}
export interface SubscriptionHandle {
  unsubscribe(): void;
}

// ── repo seams (the methods the hooks use) ───────────────────────────────────

/** `summaryRepo` — student/class/platform/health summary reads. */
export interface SummaryRepoSeam {
  getStudent(studentId: StudentId): Promise<StudentProgressSummary>;
  getClass(classId: ClassId): Promise<ClassProgressSummary>;
  getPlatform(): Promise<PlatformSummary>;
  getHealth(): Promise<HealthSummary>;
}

/** `examAnalyticsRepo` — one exam's analytics. */
export interface ExamAnalyticsRepoSeam {
  get(examId: ExamId): Promise<ExamAnalytics>;
}

/** `insightRepo` — paginated insights + the ✅ optimistic dismiss. */
export interface InsightRepoSeam {
  list(filter: ListInsightsRequest): Promise<PageResponse<LearningInsight>>;
  recordDismiss(insightId: InsightId): Promise<DismissInsightResponse>;
}

/** `costRepo` — admin cost summaries (daily / monthly). */
export interface CostRepoSeam {
  listDaily(filter: CostFilter): Promise<DailyCostSummary[]>;
  listMonthly(filter: CostFilter): Promise<MonthlyCostSummary[]>;
}

/** `trendsRepo` — performance-trend points (server already aggregated). */
export interface TrendsRepoSeam {
  get(filter: GetPerformanceTrendsRequest): Promise<PerformanceTrendPoint[]>;
}

/** `parentRepo` — linked-children dashboards (N+1-collapsed). */
export interface ParentRepoSeam {
  listChildren(filter?: ListLinkedChildrenRequest): Promise<PageResponse<ChildSummaryRow>>;
  getChildSummary(studentId: StudentId): Promise<GetChildSummaryResponse>;
}

/** `reportRepo` — signed-URL PDF commands (never optimistic). */
export interface ReportRepoSeam {
  getExamReport(input: { examId: ExamId; studentId?: StudentId }): Promise<GenerateReportResponse>;
  getProgressReport(input: { studentId: StudentId }): Promise<GenerateReportResponse>;
  getClassReport(input: { classId: ClassId }): Promise<GenerateReportResponse>;
}

/** `leaderboardRepo` — snapshot read + realtime live seam. */
export interface LeaderboardRepoSeam {
  get(filter: GetLeaderboardRequest): Promise<GetLeaderboardResponse>;
  getLive(
    params: LeaderboardSubParams,
    cb: (payload: GetLeaderboardResponse) => void
  ): SubscriptionHandle;
}

/** The slice of the repo bag this domain reaches for. */
export interface AnalyticsDomainRepos {
  summaryRepo: SummaryRepoSeam;
  examAnalyticsRepo: ExamAnalyticsRepoSeam;
  insightRepo: InsightRepoSeam;
  costRepo: CostRepoSeam;
  trendsRepo: TrendsRepoSeam;
  parentRepo: ParentRepoSeam;
  reportRepo: ReportRepoSeam;
  leaderboardRepo: LeaderboardRepoSeam;
}

/** Narrow the open repo bag to this domain's seams (one cast, here). */
export function analyticsRepos(repos: unknown): AnalyticsDomainRepos {
  return repos as AnalyticsDomainRepos;
}
