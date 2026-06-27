/**
 * @levelup/repositories — `analytics` domain factory (SDK-LAYERS-PLAN §4.1,
 * §2.6, domain plan analytics.md §Repositories).
 *
 * The root `createRepositories(api)` assembly (src/index.ts) is owned by the
 * 'identity' agent; this domain exports `createAnalyticsRepos(api)` — the
 * plan-specified per-domain factory the root assembler folds in.
 *
 * Analytics is a read + derived-projection domain (NO ALLOWED_TRANSITIONS — it
 * owns no lifecycle state machine; all "state" is server-recomputed). Repos:
 *   • per-entity: insightRepo, costRepo, reportRepo
 *   • cross-entity VIEW repos (under views/**): summaryRepo, examAnalyticsRepo,
 *     trendsRepo, parentRepo, leaderboardRepo
 *
 * Every repo imports `@levelup/api-client` (via the `ApiClient` view) +
 * `@levelup/domain` ONLY — never a sibling repo (R6).
 */
import type { ApiClient } from "./api-types.js";
import { createInsightRepo, type InsightRepo } from "./insight.js";
import { createCostRepo, type CostRepo } from "./cost.js";
import { createReportRepo, type ReportRepo } from "./report.js";
import { createSummaryRepo, type SummaryRepo } from "./views/summary.js";
import { createExamAnalyticsRepo, type ExamAnalyticsRepo } from "./views/exam-analytics.js";
import { createTrendsRepo, type TrendsRepo } from "./views/trends.js";
import { createParentRepo, type ParentRepo } from "./views/parent.js";
import { createLeaderboardRepo, type LeaderboardRepo } from "./views/leaderboard.js";

export interface AnalyticsRepos {
  // per-entity
  insightRepo: InsightRepo;
  costRepo: CostRepo;
  reportRepo: ReportRepo;
  // cross-entity VIEW repos (src/analytics/views/**)
  summaryRepo: SummaryRepo;
  examAnalyticsRepo: ExamAnalyticsRepo;
  trendsRepo: TrendsRepo;
  parentRepo: ParentRepo;
  leaderboardRepo: LeaderboardRepo;
}

export function createAnalyticsRepos(api: ApiClient): AnalyticsRepos {
  return {
    insightRepo: createInsightRepo(api),
    costRepo: createCostRepo(api),
    reportRepo: createReportRepo(api),
    summaryRepo: createSummaryRepo(api),
    examAnalyticsRepo: createExamAnalyticsRepo(api),
    trendsRepo: createTrendsRepo(api),
    parentRepo: createParentRepo(api),
    leaderboardRepo: createLeaderboardRepo(api),
  };
}

// Public re-exports (types + sub-factories) for the root assembler + apps.
export type {
  ApiClient,
  PageRequest,
  PageResponse,
  SummaryScope,
  GetSummaryRequest,
  GetSummaryResponse,
  PlatformSummary,
  HealthSummary,
  ReportType,
  GenerateReportRequest,
  GenerateReportResponse,
  ListInsightsRequest,
  DismissInsightResponse,
  TrendGranularity,
  GetPerformanceTrendsRequest,
  PerformanceTrendPoint,
  ChildSummaryRow,
  GetChildSummaryResponse,
  ListLinkedChildrenRequest,
  GetCostSummaryRequest,
  GetCostSummaryResponse,
  LeaderboardScope,
  GetLeaderboardRequest,
  GetLeaderboardResponse,
} from "./api-types.js";
export { paginate, listOnce, type PageBag, type Paged } from "./paginate.js";

export { createInsightRepo, type InsightRepo, type InsightsByPriority } from "./insight.js";
export {
  createCostRepo,
  type CostRepo,
  type CostRow,
  type BudgetBand,
  type BudgetStatus,
} from "./cost.js";
export { createReportRepo, type ReportRepo } from "./report.js";
export {
  createSummaryRepo,
  type SummaryRepo,
  type OverallBand,
  type AtRiskBadge,
  type SubjectRow,
} from "./views/summary.js";
export {
  createExamAnalyticsRepo,
  type ExamAnalyticsRepo,
  type QuestionRow,
  type ClassRow,
  type DistributionBucket,
} from "./views/exam-analytics.js";
export { createTrendsRepo, type TrendsRepo, type TrendSeriesPoint } from "./views/trends.js";
export { createParentRepo, type ParentRepo, type ChildCard } from "./views/parent.js";
export {
  createLeaderboardRepo,
  type LeaderboardRepo,
  type RankedEntry,
  type LeaderboardSubParams,
} from "./views/leaderboard.js";
