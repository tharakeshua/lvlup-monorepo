/**
 * `@levelup/services` — the server brain. One `fn(input, ctx)` per capability;
 * NEVER imports `firebase-functions`/`firebase-admin` (data via `ctx.repos`, LLM
 * via `ctx.ai`, authority via `@levelup/access`). The four function codebases
 * (identity/levelup/autograde/analytics) become thin shells over these exports.
 *
 * This barrel re-exports the autograde + analytics server slice
 * (services-autograde-analytics) plus the shared `AuthContext`/`AiGateway` seams.
 * The identity + levelup slices are exported by their own sibling waves and merged
 * here at reconciliation.
 */

// shared seams (the structural ctx + ai shapes every service consumes)
export type { AuthContext, SystemContext, EntityIds } from "./shared/context.js";
export { requireTenant, fail, ServiceError } from "./shared/context.js";
export type { AiGateway, AiGenerateInput, AiGenerateResult } from "./shared/ai.js";
export type { TriggerEvent } from "./shared/trigger.js";
export {
  isAuthoringRole,
  isTeacherish,
  projectRubric,
  projectQuestion,
  stripEvaluationCost,
  projectEvaluationSettings,
} from "./shared/projections.js";
export { enqueueOutboxEvent, buildOutboxRecord } from "./shared/side-effects.js";
export type { OutboxEventType, OutboxEventInput } from "./shared/side-effects.js";
export { withIdempotency } from "./shared/idempotency.js";

// extended-repo seam (identity / levelup-runtime / notification authority repos)
export type {
  ExtendedRepos,
  UserRepo,
  MembershipRepo,
  ConsumerProfileRepo,
  BadgeRepo,
  NotificationReadRepo,
  AnnouncementReadRepo,
  DeviceRepo,
  TestSubmissionRepo,
  StoryPointProgressRepo,
  GamificationRepo,
  LeaderboardRepo,
  InsightRepo,
  StudyGoalRepo,
  SecretRepo,
  ImpersonationRepo,
  SpaceReviewRepo,
  ContentVersionRepo,
} from "./shared/extended-repos.js";
export { xrepos } from "./shared/extended-repos.js";

// Server-only Supabase connection for the LLM telemetry adapter. The application
// still authenticates through Firebase; no Supabase Auth session crosses this seam.
export {
  createSupabaseServerClient,
  getSupabaseServerClient,
  isSupabaseTelemetryConfigured,
  resetSupabaseServerClientForTesting,
  resolveSupabaseServerConfig,
} from "./supabase/client.js";
export type { CreateSupabaseServerClientOptions, SupabaseServerConfig } from "./supabase/client.js";
export {
  createSupabaseLlmTelemetrySink,
  llmTelemetryRowMappers,
} from "./supabase/llm-telemetry.js";
export {
  getTenantLlmUsage,
  getUserLlmUsage,
  getPlatformLlmUsage,
} from "./llm/usage-reads.js";
export type {
  LlmUsageRange,
  TenantLlmUsageSummary,
  UserLlmUsageSummary,
} from "./llm/usage-reads.js";
export {
  startScannerSession,
  attachScannerQr,
  uploadScannerPage,
  closeScannerSession,
} from "./scanner/orchestration.js";
export type {
  StartScannerSessionInput,
  StartScannerSessionResult,
  AttachScannerQrInput,
  AttachScannerQrResult,
  UploadScannerPageInput,
  CloseScannerSessionInput,
  CloseScannerSessionResult,
} from "./scanner/orchestration.js";

// identity slice (claims mint, membership writes, tenant lifecycle, org users,
// bulk ops, impersonation, presets, reads, triggers/schedulers)
export * from "./identity/index.js";

// levelup runtime slice (test sessions, progress writer, practice, purchase,
// gamification, triggers/schedulers)
export * from "./levelup/index.js";

// notification slice (emit fan-out + single badge writer, announcements,
// preferences, devices, outbox drain)
export * from "./notification/index.js";

// autograde slice
export * from "./autograde/index.js";

// analytics slice. Four service names collide with the levelup/gamification slice
// because the same capability exists under both contract modules
// (`v1.analytics.*` vs `v1.levelup.*`): `dismissInsight`, `getLeaderboard`,
// `updateLeaderboard`, and the merged `onSpaceProgressUpdated` trigger. The
// analytics-canonical versions are re-exported under `analytics`-prefixed aliases
// so both module shells can wire the correct one; everything else is `export *`.
export {
  // pure rule engines
  evaluateAtRiskRules,
  generateInsightsForStudent,
  computeOverallScore,
  median,
  isDeclining,
  topN,
  bottomN,
  // reads
  getSummaryService,
  getExamAnalyticsService,
  listInsightsService,
  getPerformanceTrendsService,
  getChildSummaryService,
  listLinkedChildrenService,
  listParentAlertsService,
  listPlatformActivityService,
  getCostSummaryService,
  // server-only projection / recompute
  recomputeStudentSummaryService,
  recomputeClassSummaryService,
  recomputeExamAnalyticsService,
  detectAtRiskService,
  generateInsightsService,
  INSIGHT_CAP,
  // notify (single badge writer)
  sendNotificationService,
  sendBulkNotificationsService,
  tierFor,
  recomputeOrchestratorService,
  // cost aggregation + report
  aggregateDailyCostService,
  generateReportService,
  // class assignment-tracker matrix (C12, LVL-2)
  getAssignmentMatrixService,
  getSpaceAnalyticsService,
  // triggers
  onSubmissionGradedService,
  onExamResultsReleasedService,
  recomputeOrchestratorHandler,
  // schedulers
  dailyCostAggregationService,
  nightlyAtRiskDetectionService,
  generateInsightsScheduler,
  // disambiguated (analytics-canonical) names
  dismissInsightService as dismissInsightAnalyticsService,
  getLeaderboardService as getLeaderboardAnalyticsService,
  updateLeaderboardService as updateLeaderboardAnalyticsService,
  onSpaceProgressUpdatedService as onSpaceProgressUpdatedAnalyticsService,
} from "./analytics/index.js";
export type {
  AtRiskReason,
  AtRiskInput,
  AtRiskResult,
  InsightSeed,
  InsightContext,
} from "./analytics/index.js";
