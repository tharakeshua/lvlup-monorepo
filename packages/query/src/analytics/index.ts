/**
 * `analytics/` domain barrel (domain plan analytics.md §Query hooks).
 *
 * The dashboard read hooks + the two write hooks (`useDismissInsight` ✅ optimistic,
 * `useGenerateReport` ❌ never optimistic), the domain-shaped key helpers, and the
 * typed repo seam accessor.
 */
export {
  // summaries
  useStudentSummary,
  useClassSummary,
  usePlatformSummary,
  useHealthSummary,
  // exam analytics / insights / cost / trends
  useExamAnalytics,
  useInsights,
  useCostSummary,
  usePerformanceTrends,
  // parent dashboards
  useLinkedChildren,
  useChildSummary,
  // leaderboard (snapshot + live) + badge
  useLeaderboard,
  useLeaderboardLive,
  useNotificationBadge,
  // mutations
  useDismissInsight,
  useGenerateReport,
} from "./hooks.js";

export { analyticsQueryKeys } from "./keys.js";
export { analyticsRepos } from "./repos.js";
export type {
  AnalyticsDomainRepos,
  SummaryRepoSeam,
  ExamAnalyticsRepoSeam,
  InsightRepoSeam,
  CostRepoSeam,
  TrendsRepoSeam,
  ParentRepoSeam,
  ReportRepoSeam,
  LeaderboardRepoSeam,
  CostGranularity,
  CostFilter,
  GetPerformanceTrendsRequest,
  GetLeaderboardRequest,
  ListInsightsRequest,
} from "./repos.js";
