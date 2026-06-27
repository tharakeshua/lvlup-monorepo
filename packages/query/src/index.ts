/**
 * `@levelup/query` — public surface (query-infra.md §10).
 *
 * Top of the SDK trust cake; consumed only by the 8 apps. Depends strictly
 * downward on `@levelup/repositories`/`@levelup/api-contract`/`@levelup/domain`
 * (+ the seam types). One runtime peer the layers below don't bring:
 * `@tanstack/react-query` v5 (+ react). No firebase, no DOM, no node — RN-safe.
 *
 * Infrastructure only here: ApiProvider wiring, key factories + registry, the
 * cross-domain invalidation graph, the conservative optimistic recipe framework,
 * the error boundary + `useApiError`, and the realtime cache-write seam.
 * Per-domain hooks (`useSpaces`, `useGradeQuestion`, …) are authored on top of
 * these primitives by the per-domain plans.
 */

// ── provider ───────────────────────────────────────────────────────────────
export {
  ApiProvider,
  ApiContext,
  useApi,
  useRepos,
  useApiClient,
  useTransport,
  useNotify,
  useOffline,
  useIsDev,
  useApiQueryClient,
  makeQueryClient,
  resetForTenantSwitch,
} from "./provider/index.js";
export type {
  ApiContextValue,
  ApiProviderProps,
  ApiProviderOptions,
  NotifyAdapter,
  Transport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  OfflineQueueLike,
} from "./provider/index.js";

// ── keys ─────────────────────────────────────────────────────────────────────
export * from "./keys/index.js";

// ── invalidation ─────────────────────────────────────────────────────────────
export {
  INVALIDATION_GRAPH,
  invalidateForCallable,
  buildGraphFromContract,
} from "./invalidation/index.js";
export type { InvalidationRule, FanoutResolver, InvalidatingClient } from "./invalidation/index.js";

// ── mutation framework ───────────────────────────────────────────────────────
export {
  defineMutation,
  isAuthoritySensitive,
  isOptimisticAllowed,
  OPTIMISTIC_ALLOWLIST,
  OPTIMISTIC_COUNTER_ALLOWLIST,
  appendToList,
  patchDetail,
  decrementBadge,
  incrementCounter,
  snapshot,
  restore,
} from "./mutation/index.js";
export type {
  MutationSpec,
  MutationKind,
  OptimisticConfig,
  OptimisticClient,
  Snapshot,
} from "./mutation/index.js";

// ── error ─────────────────────────────────────────────────────────────────────
export {
  ApiErrorBoundary,
  useApiError,
  asApiError,
  shouldThrowOnError,
  defaultRetry,
  globalQueryErrorHandler,
} from "./error/index.js";
export type {
  ApiErrorBoundaryProps,
  ErrorFallbackProps,
  ErrorFallbackComponent,
  UseApiErrorResult,
  NormalizedApiError,
  QueryLike,
} from "./error/index.js";

// ── realtime seam consumer ───────────────────────────────────────────────────
export { useSubscription, SUBSCRIPTION_TARGET_KEYS } from "./realtime/index.js";
export type {
  SubscriptionStatus,
  UseSubscriptionResult,
  TargetKeyFactory,
} from "./realtime/index.js";

// ── per-domain hooks authored on top of the infra ───────────────────────────
// testsession-progress (digital-test runtime + learning-progress aggregates).
export {
  useSpaceProgress,
  useStoryPointProgress,
  useTestSession,
  useTestSessions,
  useLearningInsights,
  useStudentSummary,
  useStartTestSession,
  useSubmitTestSession,
  useEvaluateAnswer,
  useRecordItemAttempt,
  makeRecordItemAttemptMutation,
  useDismissInsight,
  useTestSessionDeadline,
  testSessionProgressKeys,
  testSessionProgressRepos,
} from "./testsession-progress/index.js";
export type {
  TestSessionProgressRepos,
  StartTestSessionInput,
  SubmitTestSessionInput,
  EvaluateAnswerInput,
  RecordItemAttemptInput,
  ListTestSessionsFilter,
  ListLearningInsightsFilter,
} from "./testsession-progress/index.js";

// identity (session/tenant/entities/announcements/notifications/users).
export {
  useMe,
  useSwitchTenant,
  useJoinTenant,
  useTenants,
  useTenant,
  useLookupTenantByCode,
  useSaveTenant,
  useDeactivateTenant,
  useReactivateTenant,
  useExportTenantData,
  useStudents,
  useStudent,
  useSaveStudent,
  useTeachers,
  useTeacher,
  useSaveTeacher,
  useParents,
  useSaveParent,
  useStaff,
  useSaveStaff,
  useClasses,
  useClass,
  useSaveClass,
  useAcademicSessions,
  useSaveAcademicSession,
  useRolloverSession,
  useCreateOrgUser,
  useBulkImportStudents,
  useBulkImportTeachers,
  useBulkUpdateStatus,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotificationPreferences,
  useNotificationBadgeQuery,
  useSaveNotificationPreferences,
  useNotificationCenter,
  useAnnouncements,
  useSaveAnnouncement,
  useMarkAnnouncementRead,
  useSearchUsers,
  useNotificationBadge,
} from "./identity/index.js";

// autograde (exams · grading pipeline · submissions · evaluation settings · DLQ ·
// exam analytics · cross-entity grading-review dashboards). All mutations are
// authority-sensitive ⚷ → no optimistic recipes (spec §5.5).
export {
  // exams
  useExams,
  useExam,
  useSaveExam,
  useExtractQuestions,
  useReleaseResults,
  // exam questions
  useExamQuestions,
  useReExtractQuestion,
  // submissions
  useSubmissions,
  useSubmission,
  useUploadAnswerSheets,
  // question submissions (grading)
  useQuestionSubmissions,
  useGradeManual,
  useRetryGrading,
  useAiGradeQuestion,
  // evaluation settings
  useEvaluationSettings,
  useSaveEvaluationSettings,
  // dead-letter queue
  useDeadLetterEntries,
  useResolveDeadLetter,
  // read-only views
  useExamAnalytics,
  useGradingReviewBundle,
  useExamGradingOverview,
  // realtime
  useGradingStatus,
  useExamGradingProgress,
  // keys + repos accessor
  autogradeKeys,
  autogradeRepos,
} from "./autograde/index.js";
export type { AutogradeReposSlice } from "./autograde/index.js";

// analytics (dashboards: summaries · exam analytics · insights · cost · trends ·
// parent dashboards · leaderboard). The ONLY ✅ optimistic surface is
// `useDismissInsight`; `useGenerateReport` returns a signed URL (never optimistic).
// NOTE: the names colliding with other domains in this wave (`useStudentSummary`,
// `useDismissInsight`, `useExamAnalytics`, `useNotificationBadge`) are owned by
// their canonical domain barrel above; the analytics versions are reachable via
// the `@levelup/query` `./analytics` subpath and re-exported here under the
// non-colliding names. The typecheck/fix wave dedupes the conceptual overlaps.
export {
  useClassSummary,
  usePlatformSummary,
  useHealthSummary,
  useInsights,
  useCostSummary,
  usePerformanceTrends,
  useLinkedChildren,
  useChildSummary,
  useLeaderboard,
  useLeaderboardLive,
  useGenerateReport,
  analyticsQueryKeys,
  analyticsRepos,
} from "./analytics/index.js";
export type {
  AnalyticsDomainRepos,
  CostGranularity as AnalyticsCostGranularity,
  CostFilter as AnalyticsCostFilter,
  GetPerformanceTrendsRequest as AnalyticsTrendsRequest,
  GetLeaderboardRequest as AnalyticsLeaderboardRequest,
  ListInsightsRequest as AnalyticsListInsightsRequest,
} from "./analytics/index.js";

// gamification (DERIVED/server-authoritative slice: achievements · levels/XP ·
// study goals · study sessions · leaderboard board · the composed gamification
// home). The ONLY ✅ optimistic surface is `useMarkAchievementsSeen` (mark-read
// class — flip `seen` + decrement the `unseenCount` counter); every other write
// (`useSaveStudyGoal`/`useArchiveStudyGoal`/`useSaveAchievementDefinition`)
// round-trips because the underlying fields are server-derived/authority
// (gamification.md §Authority boundary). Leaderboard snapshot + live use the
// non-colliding names `useLeaderboardSnapshot`/`useGamificationLeaderboardLive`
// (analytics owns the root `useLeaderboard`/`useLeaderboardLive`); the
// typecheck/fix wave dedupes the conceptual overlap.
export {
  // reads
  useGamificationSummary,
  useStudentLevel,
  useAchievementCatalog,
  useStudentAchievements,
  useLeaderboardSnapshot,
  useStudyGoals,
  useStudySessions,
  // realtime
  useGamificationLeaderboardLive,
  useAchievementUnlockStream,
  useStudentLevelLive,
  // mutations
  useMarkAchievementsSeen,
  useSaveStudyGoal,
  useArchiveStudyGoal,
  useSaveAchievementDefinition,
  // keys + repos accessor
  gamificationQueryKeys,
  gamificationRepos,
} from "./gamification/index.js";
export type {
  GamificationDomainRepos,
  AchievementWithEarnedState as GamificationAchievementWithEarnedState,
  GetLeaderboardRequest as GamificationLeaderboardRequest,
  GetLeaderboardResponse as GamificationLeaderboardResponse,
  ListAchievementsRequest as GamificationListAchievementsRequest,
  ListStudentAchievementsRequest as GamificationListStudentAchievementsRequest,
  ListStudyGoalsRequest as GamificationListStudyGoalsRequest,
  ListStudySessionsRequest as GamificationListStudySessionsRequest,
  SaveStudyGoalRequest as GamificationSaveStudyGoalRequest,
  MarkAchievementsSeenRequest,
  MarkAchievementsSeenResponse,
  SaveAchievementDefinitionRequest,
} from "./gamification/index.js";

// levelup-content (CONTENT slice: spaces · story points · items · agents ·
// question bank · rubric presets · store/reviews · AI-tutor chat · versions ·
// the space-detail view). Learning progress + test sessions are the sibling
// `testsession-progress` domain. The only ✅ optimistic surface is
// `useSendChatMessage`; all authoring saves + `usePurchaseSpace` round-trip.
export {
  // reads
  useSpaces,
  useSpace,
  useSpaceDetailView,
  useStoryPoints,
  useItems,
  useItemForEdit,
  useVersions,
  useQuestionBank,
  useRubricPresets,
  useAgents,
  useStoreSpaces,
  useStoreSpace,
  useSpaceReviews,
  useChatSessions,
  useChatSession,
  // mutations
  useSaveSpace,
  useSaveStoryPoint,
  useSaveItem,
  useImportFromBank,
  useSaveAgent,
  useSaveRubricPreset,
  useSaveQuestionBankItem,
  useSendChatMessage,
  useSaveSpaceReview,
  usePurchaseSpace,
  // realtime
  useChatStream,
  useServerTime,
} from "./levelup-content/index.js";
export type { ServerTime } from "./levelup-content/index.js";
