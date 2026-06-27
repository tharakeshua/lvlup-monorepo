/**
 * `@levelup/services` analytics barrel — read services, server-only recompute /
 * projection / notify / leaderboard / orchestrator / cost / report services, the
 * pure rule engines, and the trigger/scheduler services. Ready to be shelled by
 * `functions/analytics` (Phase 5).
 */

// pure rule engines (shared, no IO)
export {
  evaluateAtRiskRules,
  generateInsightsForStudent,
  computeOverallScore,
  median,
  isDeclining,
  topN,
  bottomN,
} from "./rules.js";
export type {
  AtRiskReason,
  AtRiskInput,
  AtRiskResult,
  InsightSeed,
  InsightContext,
} from "./rules.js";

// read / shared services
export {
  getSummaryService,
  getExamAnalyticsService,
  listInsightsService,
  getPerformanceTrendsService,
  getChildSummaryService,
  listLinkedChildrenService,
  listParentAlertsService,
  listPlatformActivityService,
  getCostSummaryService,
  getLeaderboardService,
} from "./reads.js";

// server-only projection / recompute
export {
  recomputeStudentSummaryService,
  recomputeClassSummaryService,
  recomputeExamAnalyticsService,
  detectAtRiskService,
  generateInsightsService,
  INSIGHT_CAP,
} from "./recompute.js";

// notify (single badge writer) + leaderboard + orchestrator
export { sendNotificationService, sendBulkNotificationsService } from "./notify.js";
export { updateLeaderboardService, tierFor } from "./leaderboard.js";
export { recomputeOrchestratorService } from "./orchestrator.js";

// cost aggregation + dismiss + report
export {
  aggregateDailyCostService,
  dismissInsightService,
  generateReportService,
} from "./cost-and-report.js";

// triggers
export {
  onSubmissionGradedService,
  onSpaceProgressUpdatedService,
  onExamResultsReleasedService,
  recomputeOrchestratorHandler,
} from "./triggers/index.js";

// schedulers
export {
  dailyCostAggregationService,
  nightlyAtRiskDetectionService,
  generateInsightsScheduler,
} from "./schedulers/index.js";
