# SDK-LAYERS-PLAN — Auto-LevelUp SDK + Server Rebuild (FROZEN-CANDIDATE Master Plan)

> **Status:** FROZEN-CANDIDATE. This is the single master synthesis consumed by
> the review team and the 3 build sessions. It collapses the 7 domain plans
> (`sdk-plan/domains/*.md`), 8 layer plans (`sdk-plan/layers/*.md`), and 8 UI
> coverage matrices (`sdk-plan/coverage/*.md`) into one authoritative capability
> registry, contract registry, repo/hook inventory, server/function inventory,
> authority boundary, build order, and drift reconciliation.
>
> **Non-negotiable principles (the rebuild's spine):**
>
> 1. **LEAN UI + LEAN-AUTHORITATIVE SERVER + FAT SDK.** Logic lives once in the
>    SDK; callables/triggers/schedulers are thin shells over
>    `@levelup/services`.
> 2. **Trust-layered packages, strictly downward:**
>    `domain ← api-contract ← api-client ← repositories ← query ← apps`;
>    side-seams `realtime`/`offline`; server seam `services` over
>    `access`/`ai`/`repository-admin`.
> 3. **No direct Firestore anywhere except the repository admin adapter
>    (server).** Clients never touch Firestore. Lint-enforced.
> 4. **Services are `fn(input, ctx: AuthContext)`** — they never import
>    `firebase-functions`; `onCall`/triggers/schedulers are thin adapters.
>    `tenantId` is **claim-derived, never in any request body** (super-admin
>    `tenantOverride` only).
> 5. **`ALLOWED_TRANSITIONS` are build-time-checked data. Conservative
>    optimistic only** (item attempts, chat, mark-read) — NEVER
>    grading/publish/lifecycle/purchases.
>
> **Source spine:** `SDK-SERVER-DESIGN.md`, `common-api.md` (~47→~90 callable
> inventory), `REVIEW-domain-data-model.md` (13-item authority boundary + drift
> table).

---

## 1. Package inventory & dependency graph

### 1.1 Monorepo workspace layout (target `packages/`)

```
packages/
├── domain/                  # @levelup/domain              t0 — pure Zod-first entities, 19 branded IDs, ISO Timestamp, ALLOWED_TRANSITIONS
├── api-contract/            # @levelup/api-contract         t1 — CallableDef + CALLABLES + SUBSCRIPTIONS + error model + pagination + transitions
├── api-client/              # @levelup/api-client           t2 — createApiClient(transport), validation, normalizeError, idempotency, retry, subscribe
├── repositories/            # @levelup/repositories         t3 — THE CLIENT BRAIN: domain repos, shaping, N+1 collapse, cursor mgmt, transition pre-checks
├── query/                   # @levelup/query                t4 — React Query hooks, key factories, invalidation graph, optimistic recipes, ApiProvider
├── realtime/                # @levelup/realtime             t4 — subscribe() seam consumer, useSubscription, useServerTime (built now)
├── offline/                 # @levelup/offline              t4 — OfflineQueue interface + NoopOfflineQueue (seam only, deferred impl)
├── transport-firebase/      # @levelup/transport-firebase   t-transport — ONLY client-side firebase/firestore|database|functions site
├── transport-http/          # @levelup/transport-http       t-transport — future stub (REST/SSE/WS)
├── services/                # @levelup/services             t-server — THE SERVER BRAIN, fn(input, ctx); never imports firebase-functions
├── access/                  # @levelup/access               t-server — authorize(ctx, action, resource), policy table, assertTransition
├── ai/                      # @levelup/ai                   t-server — LLM gateway seam, per-tenant Secret Manager, cost/quota/circuit-breaker
├── functions-shared/        # @levelup/functions-shared     t-server — onCall/trigger/scheduler adapters, buildAuthContext, parseRequest, fail, outbox, Cloud Tasks
├── repository-admin/        # @levelup/repository-admin     t-server — THE ONLY direct-Firestore code (Admin SDK), injected via ctx.repos
├── seed/                    # @levelup/seed                 t-server — config-driven Firebase Admin seeding (BatchWriter, ensureAuthUser, claims)
├── ui/                      # @levelup/shared-ui            presentational only (kept)
├── eslint-config/           # @levelup/eslint-config        cross-cut tooling — boundary presets + 2 custom rules
├── build-config/            # @levelup/build-config         cross-cut tooling — tsup/tsc presets, tiers.json, depcruise, RN-purity gate
└── tailwind-config/         # @levelup/tailwind-config      kept

functions/                   # 4 deploy-independent codebases — thin one-liner barrels over @levelup/services
├── identity/  levelup/  autograde/  analytics/
firestore.rules + storage.rules  # IN-SCOPE (promoted from Non-Goal): generated from key registries per sdk-plan/layers/security-rules.md; deny-by-default; emulator rules tests = required CI gate
apps/                        # 5 web (super-admin, admin, teacher, student, parent)
apps-rn/                     # 3 RN (family, staff, scanner)
```

### 1.2 Package responsibilities, platform deps, downward edges

| Package                       | One-line responsibility                                                                                                                                                                 | Platform deps                                       | Imports (downward only)                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| `@levelup/domain`             | Pure Zod-first `.strict()` entities, 19 branded IDs, ISO `Timestamp` + edge adapter, `Page<T>`, `Money`, enums, `ALLOWED_TRANSITIONS` data                                              | **zod only**                                        | (leaf)                                                       |
| `@levelup/api-contract`       | The wire SSOT: `CallableDef`, `CALLABLES` registry, `SUBSCRIPTIONS`, `AppErrorCode` + maps + copy, `PageRequest`/`pageResponse`, `ALLOWED_TRANSITIONS` re-export, `Transport` interface | none                                                | domain                                                       |
| `@levelup/api-client`         | `createApiClient(transport, opts)`: req validate (always), res validate (dev), `normalizeError`→`ApiError`, retry policy, UUIDv7 idempotency, `subscribe` pass-through                  | uuid                                                | domain, api-contract                                         |
| `@levelup/repositories`       | Client brain: per-entity repos + cross-entity **view** repos; shaping, batching/N+1 collapse, opaque cursor mgmt, transition pre-checks, derived fields                                 | none                                                | domain, api-contract, api-client                             |
| `@levelup/query`              | React Query hooks, key factories, invalidation graph, `ApiProvider`, conservative optimistic recipes, `useApiError`, `ApiErrorBoundary`                                                 | react, @tanstack/react-query (peer)                 | domain, api-contract, repositories, realtime/offline (types) |
| `@levelup/realtime`           | `subscribe()` seam consumer + `RealtimeProvider`, `useSubscription`, `useServerTime`, per-sub hooks, refcount dedupe                                                                    | react (peer)                                        | api-contract (+domain)                                       |
| `@levelup/offline`            | `OfflineQueue` interface + `NoopOfflineQueue` passthrough (no real queue in v1)                                                                                                         | none                                                | api-contract                                                 |
| `@levelup/transport-firebase` | The `Transport` impl: `invokeViaCallable`, `subscribeViaFirestore`/`Rtdb`, source resolver, `serverTimeOffset`, `refreshToken`. **Only client firebase/firestore site**                 | firebase (app/functions/firestore/database/auth)    | api-contract (+domain)                                       |
| `@levelup/transport-http`     | Future stub: `invokeViaHttp`, SSE/WS subscribe (shape only)                                                                                                                             | fetch/EventSource/WS                                | api-contract                                                 |
| `@levelup/services`           | Server brain — one `fn(input, ctx)` per capability (~90 callables + every trigger/scheduler use-case). **Never imports firebase-functions/firebase-admin**                              | none                                                | domain, api-contract, access, ai, repository-admin (via ctx) |
| `@levelup/access`             | `authorize(ctx, action, resource)`, `ACCESS_RULES` table, role/permission key registries, `assertTransition`                                                                            | none                                                | domain, api-contract                                         |
| `@levelup/ai`                 | LLM provider seam (Gemini impl), per-tenant Secret Manager keys, cost/quota/circuit-breaker, prompt registry                                                                            | @google/generative-ai, @google-cloud/secret-manager | domain, api-contract, repository-admin                       |
| `@levelup/functions-shared`   | onCall/trigger/scheduler/task **adapters**, `buildAuthContext`, `parseRequest`, `fail`, rate-limit, feature-gate, quota, idempotency dedupe, outbox, Cloud Tasks                        | firebase-functions, firebase-admin                  | domain, api-contract, access, services, repository-admin     |
| `@levelup/repository-admin`   | THE ONLY direct-Firestore code (Admin SDK): server repos + tx/batching + Timestamp↔ISO + brand converters + claims/answer-key/progress authoritative writes                             | firebase-admin                                      | domain, api-contract                                         |
| `@levelup/seed`               | Config-driven Admin-SDK seeding (BatchWriter, ensureAuthUser, custom claims, idempotent entity creation)                                                                                | firebase-admin                                      | domain, api-contract, repository-admin                       |

**Strictly-downward dependency edges (lint-enforced — `lint-boundaries.md` §2
R1–R14, dependency-cruiser DAG):**

```
domain ← api-contract ← api-client ← repositories ← query
                      ←  realtime / offline  (← query consumes as seam types)
                      ←  transport-firebase / transport-http   (implement Transport; t0/t1 only)
                      ←  access, ai, repository-admin  ←  services  ←  functions-shared  ←  functions/*
apps/* , apps-rn/*  →  ONLY query, realtime, offline, domain   (R7)
```

Tier table (`build-config/tiers.json`): `t0-domain`, `t1-contract`, `t2-client`,
`t3-repos`, `t4-query` (query/realtime/offline), `t-transport`, `t-app`,
`t-server`. RN-purity gate bundles `@levelup/query` under a `react-native`
resolver and fails on any
`firebase`/`firebase-admin`/`firebase-functions`/`node:` resolution — the
mechanical proof that domain→query stay pure.

**Package totals: 16 SDK/server packages** (domain, api-contract, api-client,
repositories, query, realtime, offline, transport-firebase, transport-http,
services, access, ai, functions-shared, repository-admin, seed) **+ 3 tooling**
(eslint-config, build-config, tailwind-config) **+ shared-ui**.

---

## 2. Domain-by-domain capability registry (the authoritative capability list)

Seven domains. Module discriminator stays one of
`identity | levelup | autograde | analytics` (no 5th codebase; gamification
folds into `levelup`; notification callables live under `identity`).

### 2.1 `identity` — most authority-heavy (codebase `functions/identity`)

| Aspect         | Capabilities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entities**   | UnifiedUser, ConsumerProfile, PurchaseRecord, UserMembership, MembershipClaimsInput, PlatformClaims (+`isSuperAdmin` claim), Tenant (+8 embedded), TenantCodeIndex, TenantPublicView, Student, Teacher, Parent, **Staff (new)**, **Scanner (new)**, Class, AcademicSession, Announcement, Notification, NotificationPreferences, NotificationState, GlobalEvaluationPreset                                                                                                                                                                                                                                                                                                                         |
| **Callables**  | saveTenant, deactivateTenant, reactivateTenant, exportTenantData, uploadTenantAsset, lookupTenantByCode (**public**), saveStudent/Teacher/Parent/Staff/Class/AcademicSession, createOrgUser (idem), switchActiveTenant, joinTenant (idem), bulkImportStudents/Teachers (idem), bulkUpdateStatus (idem), rolloverSession (idem), saveAnnouncement, listAnnouncements, listNotifications, getNotificationBadge, markNotificationRead, getNotificationPreferences, saveNotificationPreferences, searchUsers, saveGlobalEvaluationPreset; reads getMe, getTenant, listTenants, listStudents, getStudent, listTeachers, getTeacher, listParents, listStaff, listClasses, getClass, listAcademicSessions |
| **Repos**      | meRepo, tenantRepo, studentRepo, teacherRepo, parentRepo, staffRepo, classRepo (view), academicSessionRepo, orgUserRepo, announcementRepo, notificationRepo, userSearchRepo (view)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Hooks**      | useMe, useSwitchTenant, useJoinTenant, useLookupTenantByCode, useTenants/useTenant/useSaveTenant/useDeactivateTenant/useReactivateTenant/useExportTenantData, useStudents/useStudent/useSaveStudent, useTeachers/useSaveTeacher, useParents/useSaveParent, useStaff/useSaveStaff, useClasses/useClass/useSaveClass, useAcademicSessions/useSaveAcademicSession/useRolloverSession, useCreateOrgUser, useBulkImportStudents/Teachers/useBulkUpdateStatus, useAnnouncements/useSaveAnnouncement, useNotifications/useMarkNotificationRead(✅)/useMarkAllNotificationsRead(✅)/useNotificationBadge, useSearchUsers                                                                                   |
| **Services**   | provisionMembership, syncMembershipClaims, createOrgUser, saveTenant, deactivate/reactivateTenant, save{Student,Teacher,Parent,Staff,Class}, saveAcademicSession/rolloverSession, bulkImport*/bulkUpdateStatus, exportTenantData, uploadTenantAsset, saveGlobalEvaluationPreset, markNotificationsRead; shared reads getMe/getTenant/list* + lookupTenantByCode/switchActiveTenant/joinTenant/searchUsers/saveAnnouncement/listAnnouncements/listNotifications                                                                                                                                                                                                                                     |
| **Triggers**   | beforeUserCreated, beforeSignIn, onUserDeleted, onMembershipWritten (→syncClaims, single-writer), onStudentArchived, onClassArchived, onTenantDeactivated (outbox), onAnnouncementPublished (outbox)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Schedulers** | tenantLifecycleCheck (daily), monthlyUsageReset, cleanupExpiredExports (30 min)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### 2.2 `levelup-content` (codebase `functions/levelup`)

| Aspect         | Capabilities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entities**   | Space (+SpaceStats/RatingAggregate), StoryPoint, UnifiedItem (real two-level `z.discriminatedUnion` payload — see domain-entities.md), AnswerKey (⚷ server-only strip boundary), `effectiveRubric`+`rubricId`, Agent, RubricPreset, QuestionBankItem, ChatSession/ChatMessage (always-subcollection), SpaceReview, ContentVersion, StoreSpaceListing, PurchaseRecord; shared core UnifiedRubric/UnifiedEvaluationResult (⚷ server-internal, never a client response)/`StoredEvaluation` (cost-stripped client projection)/ItemMetadata/ItemAnalytics |
| **Callables**  | saveSpace, saveStoryPoint, saveItem, importFromBank (idem), saveAgent, saveRubricPreset, saveQuestionBankItem, sendChatMessage (ai), saveSpaceReview, purchaseSpace (idem); reads listSpaces, getSpace, listStoryPoints, listItems, getItemForEdit (⚷ authoring), listVersions, listQuestionBank, listRubricPresets, listAgents, listStoreSpaces, getStoreSpace, listSpaceReviews, listChatSessions, getChatSession                                                                                                                                  |
| **Repos**      | spaceRepo, storyPointRepo, itemRepo, questionBankRepo, rubricPresetRepo, agentRepo, chatRepo, storeRepo, versionRepo, spaceDetailViewRepo (view)                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Hooks**      | useSpaces/useSpace/useSaveSpace, useStoryPoints/useSaveStoryPoint, useItems/useItemForEdit/useSaveItem, useImportFromBank, useAgents/useSaveAgent, useRubricPresets/useSaveRubricPreset, useQuestionBank/useSaveQuestionBankItem, useChatSessions/useChatSession/useSendChatMessage(✅), useStoreSpaces/useStoreSpace/usePurchaseSpace, useSpaceReviews/useSaveSpaceReview, useVersions, useSpaceDetailView                                                                                                                                          |
| **Services**   | saveSpace, saveStoryPoint, saveItem (extractAnswerKey+strip), getItemForEdit, importFromBank, saveAgent/saveRubricPreset/saveQuestionBankItem, sendChatMessage (ai seam), saveSpaceReview, purchaseSpace (⚷), cascadeDeleteSpace/recomputeSpaceStats; shared list/get readers (answer-stripped, prompt-stripped)                                                                                                                                                                                                                                     |
| **Triggers**   | onSpacePublished (outbox notify), onSpaceDeleted (cascade), onSpaceReviewWritten (rating aggregate), onTestSessionGraded/onProgressUpdated (analytics feed)                                                                                                                                                                                                                                                                                                                                                                                          |
| **Schedulers** | cleanupInactiveChats (also expireTestSessions/cleanupStaleSessions — see 2.3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### 2.3 `testsession-progress` (module `levelup`, codebase `functions/levelup`)

| Aspect          | Capabilities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entities**    | DigitalTestSession (+`submissions/{itemId}` subcollection, `DigitalTestSessionSchema` per domain-entities.md), TestSubmission, SpaceProgress (bounded `storyPoints` summary), StoryPointProgress + StoryPointProgressDoc (per-item docs or capped), ItemProgressEntry, `StoredEvaluation` (answer+cost-stripped — the only client-facing per-item eval shape, never `UnifiedEvaluationResult`), AttemptRecord, StudentProgressSummary*, ClassProgressSummary*, LearningInsight* (*analytics-authored, read here) |
| **Callables**   | startTestSession (idem), submitTestSession (idem), evaluateAnswer (ai, idem), recordItemAttempt (idem, ✅opt), dismissInsight (✅opt); reads getSpaceProgress, getStoryPointProgress, getTestSession, listTestSessions, listLearningInsights                                                                                                                                                                                                                                                                     |
| **Repos**       | testSessionRepo, progressRepo, learningInsightRepo, studentSummaryRepo (view, cross-domain)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Hooks**       | useStartTestSession, useSubmitTestSession, useEvaluateAnswer, useRecordItemAttempt(✅), useDismissInsight(✅), useSpaceProgress, useStoryPointProgress, useTestSession, useTestSessions, useLearningInsights, useStudentSummary, useTestSessionDeadline (sub)                                                                                                                                                                                                                                                    |
| **Services**    | startTestSession (serverDeadline/order ⚷), submitTestSession (batch answer-key load, auto-grade, ⚷), evaluateAnswer (persists progress server-side), recordItemAttempt, **progressUpdater** (the single transactional progress writer), getTestSession/listTestSessions/getSpaceProgress/getStoryPointProgress; shared storyPointTypeToSessionType, assertTestSessionTransition, computeTestAnalytics, autoEvaluateDeterministic                                                                                 |
| **Triggers**    | onTestSessionExpired (single-writer), onSubmissionGraded (AI-pending merge, outbox), onSpaceProgressUpdated (→analytics rollup)                                                                                                                                                                                                                                                                                                                                                                                  |
| **Schedulers**  | expireTestSessions (every 5 min), cleanupStaleSessions (hourly)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Cloud Tasks** | AI grading fan-out: submit → per-pending-item `gradeItemTask` → onSubmissionGraded reducer                                                                                                                                                                                                                                                                                                                                                                                                                       |

### 2.4 `gamification` (folded into module `levelup`; derivation triggers in `functions/analytics`)

| Aspect         | Capabilities                                                                                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Entities**   | Achievement, AchievementCriteria, StudentAchievement, StudentLevel (⚷), StudyGoal (client-CRUD), StudySession (read-mostly), LeaderboardEntry (RTDB read-model), GamificationSummary (view-model)                                                                                                                              |
| **Callables**  | getGamificationSummary, getStudentLevel, listAchievements, listStudentAchievements, getLeaderboard, listStudySessions, listStudyGoals; writes saveStudyGoal (idem), markAchievementsSeen (idem, ✅opt), saveAchievementDefinition (admin)                                                                                      |
| **Repos**      | achievementRepo, studentLevelRepo, leaderboardRepo (view), studyGoalRepo, studySessionRepo, gamificationViewRepo (view)                                                                                                                                                                                                        |
| **Hooks**      | useGamificationSummary, useStudentLevel, useAchievementCatalog, useStudentAchievements, useLeaderboard, useLeaderboardLive (sub), useAchievementUnlockStream (sub), useStudentLevelLive (sub), useStudyGoals/useSaveStudyGoal/useArchiveStudyGoal, useStudySessions, useMarkAchievementsSeen(✅), useSaveAchievementDefinition |
| **Services**   | shared getGamificationSummary/getStudentLevel/listAchievements/listStudentAchievements/getLeaderboard/listStudySessions/listStudyGoals; server saveStudyGoal, markAchievementsSeen, saveAchievementDefinition, awardAchievements (internal ⚷), recomputeStudyGoalProgress (internal), upsertLeaderboardEntry (internal ⚷)      |
| **Triggers**   | onProgressWrite_awardAchievements, onProgressSummaryWrite_updateLeaderboard, onStoryPointProgressWrite_updateLeaderboard, onProgressMilestone_notify (all in functions/analytics)                                                                                                                                              |
| **Schedulers** | nightlyStreakReconciler, weeklyLeaderboardSnapshot (optional)                                                                                                                                                                                                                                                                  |

### 2.5 `autograde` (codebase `functions/autograde`, region `asia-south1`)

| Aspect          | Capabilities                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Entities**    | Exam (+ExamQuestionPaper/GradingConfig/Stats), ExamQuestion (+SubQuestion), Submission (+AnswerSheetData/ScoutingResult/Summary), QuestionSubmission (+QuestionMapping/ManualOverride), EvaluationSettings (+3 embedded), GradingDeadLetterEntry, ExamAnalytics (read-only)                                                                                                                                                                                  |
| **Callables**   | saveExam (idem), extractQuestions (ai, idem), uploadAnswerSheets (ai, idem, scanner-allowed), gradeQuestion (ai, idem; mode manual/retry/ai), saveEvaluationSettings (idem), resolveDeadLetter (idem), releaseResults (idem); reads listExams, getExam, listQuestions, listSubmissions, getSubmission, listQuestionSubmissions, getExamAnalytics, listEvaluationSettings, listDeadLetter                                                                     |
| **Repos**       | examRepo, examQuestionRepo, submissionRepo, questionSubmissionRepo, evaluationSettingsRepo, deadLetterRepo, examAnalyticsRepo (view), gradingReviewRepo (view)                                                                                                                                                                                                                                                                                               |
| **Hooks**       | useExams/useExam/useSaveExam, useExtractQuestions, useReleaseResults, useExamQuestions/useReExtractQuestion, useSubmissions/useSubmission/useUploadAnswerSheets, useQuestionSubmissions/useGradeManual/useRetryGrading/useAiGradeQuestion, useEvaluationSettings/useSaveEvaluationSettings, useDeadLetterEntries/useResolveDeadLetter, useExamAnalytics, useGradingReviewBundle/useExamGradingOverview, useGradingStatus (sub), useExamGradingProgress (sub) |
| **Services**    | saveExam (lifecycle), releaseResults (outbox), extractQuestions (ai), uploadAnswerSheets, gradeQuestion (⚷ score), saveEvaluationSettings, resolveDeadLetter; pipeline advancePipeline (single reducer), processAnswerMapping, processAnswerGrading, finalizeSubmission, resolveRubric; readers (released-gate + guidance-strip projections)                                                                                                                 |
| **Triggers**    | onSubmissionCreated, onSubmissionUpdated (single reducer), onQuestionSubmissionUpdated (enqueue-only), onExamPublished (outbox), onResultsReleased (outbox), onExamDeleted (cascade), onQuestionPaperUpload (GCS); **REMOVED** onAnswerSheetUpload (replaced by callable)                                                                                                                                                                                    |
| **Schedulers**  | staleSubmissionWatchdog (15 min, collection-group)                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Cloud Tasks** | grading pipeline per-stage tasks (scouting/grading/finalize) via advancePipeline                                                                                                                                                                                                                                                                                                                                                                             |

### 2.6 `analytics` (codebase `functions/analytics`)

| Aspect         | Capabilities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entities**   | StudentProgressSummary (+RecomputeMarker), ClassProgressSummary, ExamAnalytics, LearningInsight, DailyCostSummary, MonthlyCostSummary, LlmCallLog (read-only), HealthSnapshot, PlatformActivityLog, Notification, NotificationRTDBState, AtRiskDetectionResult, PerformanceTrendPoint (new), LeaderboardEntry                                                                                                                                                                                                                               |
| **Callables**  | getSummary (scope student/class/platform/health), generateReport (idem), getExamAnalytics, listInsights, dismissInsight (idem), getPerformanceTrends, getChildSummary, listLinkedChildren, getCostSummary, getLeaderboard                                                                                                                                                                                                                                                                                                                   |
| **Repos**      | summaryRepo (view), examAnalyticsRepo, insightRepo, costRepo, trendsRepo (view), parentRepo (view), reportRepo, leaderboardRepo (view)                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Hooks**      | useStudentSummary, useClassSummary, usePlatformSummary, useHealthSummary, useExamAnalytics, useInsights, useDismissInsight(✅), useCostSummary, usePerformanceTrends, useLinkedChildren, useChildSummary, useGenerateReport, useLeaderboard, useLeaderboardLive (sub), useNotificationBadge (sub)                                                                                                                                                                                                                                           |
| **Services**   | shared getSummary/getExamAnalytics/listInsights/getPerformanceTrends/getChildSummary/listLinkedChildren/getCostSummary/getLeaderboard + pure rule engines (evaluateAtRiskRules, generateInsightsForStudent, computeOverallScore); server recomputeStudentSummary (single-writer), recomputeClassSummary, recomputeExamAnalytics, detectAtRisk, generateInsights, aggregateDailyCost, dismissInsight, generateReport, **notifyService** (single badge writer), updateLeaderboard, **recomputeOrchestrator** (collapses the 4-writer fan-out) |
| **Triggers**   | onSubmissionGraded, onSpaceProgressUpdated (merges 2 old triggers), onExamResultsReleased (outbox), recomputeOrchestrator (Cloud Tasks handler — the one RecomputeMarker consumer)                                                                                                                                                                                                                                                                                                                                                          |
| **Schedulers** | dailyCostAggregation, nightlyAtRiskDetection, generateInsights                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### 2.7 `notification` (callables under module `identity`; producers across 4 codebases)

| Aspect         | Capabilities                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entities**   | Notification (discriminated `payload` union), NotificationPreferences (new Zod), NotificationBadgeState (RTDB, epoch-ms fenced exception), Announcement (new Zod, `readBy`→`/reads/{uid}` subcollection)                                                                                                                                                                                                          |
| **Callables**  | listNotifications, getNotificationBadge, getNotificationPreferences, listAnnouncements, markNotificationRead (idem, ✅opt), saveNotificationPreferences (idem), saveAnnouncement, markAnnouncementRead (idem, ✅opt). **`manageNotifications` facade DELETED (MERGE-NOTIF-FACADE)** — the 5 split callables are canonical; a facade, if wanted, is a `notificationCenterRepo` view method, not a second callable. |
| **Repos**      | notificationRepo, announcementRepo, notificationCenterRepo (view)                                                                                                                                                                                                                                                                                                                                                 |
| **Hooks**      | useNotifications, useNotificationBadge (sub+fallback), useMarkNotificationRead(✅)/useMarkAllNotificationsRead(✅), useNotificationPreferences/useSaveNotificationPreferences, useAnnouncements/useSaveAnnouncement, useMarkAnnouncementRead(✅), useNotificationCenter                                                                                                                                           |
| **Services**   | server **emitNotificationService** (THE 4-copy consolidation, single badge writer), markNotificationReadService (⚷ counter), saveAnnouncementService (lifecycle), markAnnouncementReadService; shared listNotifications/getNotificationBadge/getNotificationPreferences/saveNotificationPreferences/listAnnouncements                                                                                             |
| **Triggers**   | onSpacePublished, onExamPublished, onResultsReleased, onSubmissionFinalized, onProgressMilestone, onAnnouncementPublished (new outbox), onBulkImportComplete — all delegate to `emitNotificationService`                                                                                                                                                                                                          |
| **Schedulers** | nightlyAtRiskDetection (emit), deadlineReminderCron (wires the orphan `deadline_reminder` type), expireAnnouncementsCron (optional)                                                                                                                                                                                                                                                                               |

---

## 3. The contract registry (`@levelup/api-contract`)

### 3.1 `CallableDef` frame

`CallableDef<Req,Res>` =
`{ name: 'v1.<module>.<op>', module: ApiModule, requestSchema (.strict), responseSchema (.strict), authMode: 'authed'|'public', rateTier: 'write'|'read'|'ai'|'auth'|'report', idempotent?, idempotencyKey?: 'transport' | 'domain:<fields>', allowsTenantOverride?, invalidates?: string[], resyncsClaims?, authoritySensitive? }`.
`CALLABLES` = flat `as const` map keyed by name;
`CallableName = keyof typeof CALLABLES`; `ReqOf<N>`/`ResOf<N>` via `z.infer`.
`defineCallable()` authoring helper.
`ApiModule = identity | levelup | autograde | analytics`.

**Idempotency dedupe identity (MERGE-IDEMPOTENCY).** `idempotent:true` callables
carry an `idempotencyKey` hint: `'transport'` (dedupe on the api-client UUIDv7
retry key) or `'domain:<fields>'` (server dedupe key derived from named request
fields). Canonical domain keys: `submitTestSession`→`sessionId`;
`evaluateAnswer`→`(spaceId,itemId,answerHash)`;
`recordItemAttempt`→`(spaceId,storyPointId,itemId,answerHash)` (the request
sends the raw `answer` — server scores per CD13 — so the dedupe key hashes the
answer, not a client `attemptNumber`). Server dedupe key = domain key when
present, else UUIDv7. **No request _schema_ may declare an `idempotencyKey`
field** (it contradicts envelope injection and re-opens forgeable keys under
`.strict()`); the UUIDv7 lives in the api-client envelope, the domain key is the
def hint. Contract test (mirror of `no-tenant-id-in-request`): **no `.strict()`
request schema declares `idempotencyKey`**.

**Authority-flag coverage (T9 / CONV-4).** The authority flag is unified to the
single name **`authoritySensitive`** on `CallableDef` (the old
`requiresAuthority`/`sensitive` aliases are removed; `lint-boundaries.md`
references this one name). `AUTHORITY_CALLABLES` is **regenerated from live
`CALLABLES`**
(`Object.values(CALLABLES).filter(d => d.authoritySensitive).map(d => d.name)`
frozen `as const`) — never hand-maintained. A required
`authority-flag-coverage.test.ts` asserts: (1) `AUTHORITY_CALLABLES` is
byte-equal to the regenerated set (no stale hand list); (2) **every ⚷ callable
in the REVIEW §6 authority list is flagged `authoritySensitive:true`** (every
grading/publish/lifecycle/purchase/claims/secret callable is covered); (3) no
callable on the §4.4 `OPTIMISTIC_ALLOWLIST` is also in `AUTHORITY_CALLABLES`.
This proves the optimistic allow-list still excludes authority-sensitive writes
at build time.

### 3.2 CALLABLES map (~90 callables; one-liner req → res)

> **§9 C1–C31 are folded into this registry, not a separate worklist
> (MERGE-C9-ORPHANED).** Every C1–C31 callable below carries a full
> `CallableDef`, an `INVALIDATION_GRAPH` entry if mutating (§4.3), an
> `ACCESS_RULES` action (§5.4), a repo/hook (§4.1/§4.2), and a row in its owning
> per-domain plan. The contract test `registry-integrity` asserts **`CALLABLES`
> ≡ `common-api.md` callable set in both directions** so this drift cannot
> recur. C1 (Storage) is a `Transport`/`StorageTransport` seam change (§3.3 +
> transport-firebase), not a plain callable. The folded callables, by module:
>
> - **identity (C2,C4,C5,C8–C11,C14,C22–C24,C26–C28,C30,C31):**
>   `getNotificationPreferences`, `saveNotificationPreferences`,
>   `registerDeviceToken`, `unregisterDeviceToken`, `estimateAudience`,
>   `listExportJobs`, `changeMembershipRole?`, `saveTenantSettings`,
>   `sendDirectMessage?`, `uploadUserAsset`, `deleteConsumerAccount`,
>   `updateMyProfile`, `setUserStatus`, `sendPasswordReset(uid)`,
>   `startImpersonation`, `endImpersonation`, `saveTenantFeatures`,
>   `bulkApplyTenantFeatures`, `listGlobalEvaluationPresets`,
>   `getPlatformConfig`, `savePlatformConfig` (+ `Class.schedule` on
>   `saveClass`, `confidenceSummary` on `listExams`/`ExamListView`,
>   `ExportCollection` on `exportTenantData`).
> - **levelup (C12,C13,C17,C20,C21):** `assignContent`, `generateContent` (ai),
>   `listSpaceProgressForUser`, `getStoryPoint`, `saveTestAnswer`.
> - **autograde (C1,C7,C15,C16,C19):** `requestUploadUrl` (Storage seam),
>   `saveExamQuestion`, `getSubmissionForExam`, `uploadedBy` filter on
>   `listSubmissions`.
> - **analytics (C6,C18,C25,C29):** `listParentAlerts`, `listPlatformActivity` +
>   `getSummary{scope:'class'}` rollup shaping + `PlatformSummary` shaping
>   (response-shape only, no new callable for C6/C29).

**`v1.identity.*`**

- `saveTenant`
  `{id?,data{name,contactEmail,plan?,features?,settings?,branding?,geminiApiKey?},delete?}`
  → `SaveResponse` (super-admin)
- `deactivateTenant` `{tenantOverride,reason?}` → `{tenantId,status}`;
  `reactivateTenant` `{tenantOverride}` → `{tenantId,status}`
- `exportTenantData` `{tenantOverride?,scope}` → `{downloadUrl,expiresAt}`;
  `uploadTenantAsset` `{kind,contentType,bytesBase64}` → `{assetUrl}`
- `lookupTenantByCode` `{tenantCode}` → `TenantPublicView` (**public**)
- `saveStudent|saveTeacher|saveParent|saveStaff|saveClass|saveAcademicSession`
  `{id?,data{...},delete?}` → `SaveResponse`
- `createOrgUser` `{role,firstName,lastName,email?,...}` →
  `{uid,entityId,membershipId}` (idem, resyncsClaims)
- `switchActiveTenant` `{targetTenantId}` → `{tenantId,role}`; `joinTenant`
  `{tenantCode}` → `{tenantId,membershipId,role}` (idem)
- `bulkImportStudents|bulkImportTeachers` `{rows[],defaultClassIds?}` →
  `{created,skipped,errors[]}` (idem); `bulkUpdateStatus`
  `{entityType,ids[],status}` → `{updated,errors[]}` (idem); `rolloverSession`
  `{fromSessionId,toSessionId,promotionMap?}` → `{classesCreated,studentsMoved}`
  (idem)
- `saveAnnouncement` `{id?,scope,data{...},delete?}` → `{id,created?,deleted?}`;
  `listAnnouncements` `{scope?,status?,PageRequest}` →
  `pageResponse(AnnouncementListItem)`; `markAnnouncementRead`
  `{announcementId}` → `{isReadByMe:true}` (idem, ✅opt)
- `listNotifications` `{PageRequest}` → `pageResponse(Notification)`;
  `getNotificationBadge` `{}` → `NotificationBadgeState`; `markNotificationRead`
  `{mode:'one',notificationId}|{mode:'all'}` → `{unreadCount}` (idem, ✅opt);
  `getNotificationPreferences` `{}` → `NotificationPreferences`;
  `saveNotificationPreferences` `{enabledTypes?,muteUntil?}` →
  `NotificationPreferences` (idem)
- `searchUsers` `{query,PageRequest}` → `pageResponse(UserSearchResult)`
  (super-admin); `saveGlobalEvaluationPreset` `{id?,data,delete?}` →
  `SaveResponse` (super-admin)
- reads: `getMe` `{}` → `{user,memberships,claims,activeTenant?}`; `getTenant`
  `{tenantOverride?}` → `Tenant`; `listTenants` `{status?,plan?,q?,PageRequest}`
  → `pageResponse(TenantSummary)`;
  `listStudents`/`getStudent`/`listTeachers`/`getTeacher`/`listParents`/`listStaff`/`listClasses`/`getClass`(→`ClassDetailView`)/`listAcademicSessions`

**`v1.levelup.*` (content + testsession + gamification)**

- `saveSpace` `{id?,data{title,type,status?,price?,...}}` → `SaveResponse`;
  `saveStoryPoint`/`saveItem`(discriminated payload) → `SaveResponse`;
  `importFromBank` `{spaceId,storyPointId,bankItemIds[]}` → `{createdItemIds}`
  (idem)
- `saveAgent`/`saveRubricPreset`/`saveQuestionBankItem` → `SaveResponse`
- `startTestSession` `{spaceId,storyPointId}` →
  `{session:DigitalTestSessionView}` (idem); `submitTestSession`
  `{sessionId,autoSubmitted?}` → `{session:ResultView,progressUpdated}` (idem);
  `evaluateAnswer` `{spaceId,storyPointId?,itemId,answer,mediaUrls?}` →
  `{evaluation:StoredEvaluation,progressRecorded}` (ai, idem);
  `recordItemAttempt` `{spaceId,storyPointId,itemId,answer,idempotencyKey}` →
  `{progress:ItemProgressView,completed}` (**SERVER scores** — CD13: the client
  sends the raw learner `answer`, never `score`/`maxScore`/`correct`; the
  authority boundary matches `evaluateAnswer`) (idem, ✅opt)
- `sendChatMessage` `{sessionId?,spaceId,storyPointId,itemId,text,mediaUrls?}` →
  `{sessionId,message,tokensUsed?}` (ai, ✅opt); `saveSpaceReview`
  `{spaceId,rating,comment?}` → `{success,isUpdate}`; `purchaseSpace`
  `{spaceId,paymentToken?}` → `{success,transactionId,enrolledSpaceId}` (idem)
- gamification: `getGamificationSummary` `{userId?}` → `GamificationSummary`;
  `getStudentLevel` `{userId?}` → `StudentLevel`; `listAchievements`
  `{category?,onlyActive?,PageRequest}` →
  `pageResponse(AchievementWithEarnedState)`; `listStudentAchievements`
  `{userId?,unseenOnly?,PageRequest}` → `pageResponse(StudentAchievement)`;
  `getLeaderboard` `{scope,spaceId?,storyPointId?,PageRequest}` →
  `pageResponse(LeaderboardEntry)+callerEntry`; `listStudySessions`
  `{userId?,fromDate?,toDate?}` → `{sessions,streakDays,longestStreak}`;
  `listStudyGoals` `{userId?,includeCompleted?,PageRequest}` →
  `pageResponse(StudyGoal)`; `saveStudyGoal` `{id?,data{...}}` → `SaveResponse`
  (idem); `markAchievementsSeen` `{achievementIds[]}|{all:true}` → `{updated}`
  (idem, ✅opt); `saveAchievementDefinition` `{id?,data{...}}` → `SaveResponse`
  (admin)
- insights (testsession): `listLearningInsights`
  `{studentId?,type?,PageRequest}` → `pageResponse(LearningInsight)`;
  `dismissInsight` `{insightId}` → `{id,dismissed:true}` (idem, ✅opt)
- reads:
  `listSpaces`/`getSpace`/`listStoryPoints`/`listItems`(answer-stripped)/`getItemForEdit`(⚷
  authoring)/`listVersions`/`listQuestionBank`/`listRubricPresets`/`listAgents`/`listStoreSpaces`/`getStoreSpace`/`listSpaceReviews`/`listChatSessions`/`getChatSession`/`getSpaceProgress`/`getStoryPointProgress`/`getTestSession`/`listTestSessions`

**`v1.autograde.*`**

- `saveExam` `{id?,data{...,questionPaperImages?}}` → `SaveResponse` (idem);
  `extractQuestions` `{examId,mode?,questionNumber?}` →
  `ExtractQuestionsResponse` (ai, idem); `uploadAnswerSheets`
  `{examId,studentId,classId,imageUrls[]}` → `{submissionId}` (ai, idem,
  scanner); `gradeQuestion` `{mode,submissionId?,questionId?,score?,...}` →
  `GradeQuestionResponse` (ai, idem); `releaseResults` `{examId,classIds?}` →
  `{id,releasedCount}` (idem); `saveEvaluationSettings` `{id?,data}` →
  `SaveResponse` (idem); `resolveDeadLetter` `{entryId,method}` →
  `{success,resolution}` (idem)
- reads:
  `listExams`/`getExam`/`listQuestions`/`listSubmissions`/`getSubmission`/`listQuestionSubmissions`/`getExamAnalytics`/`listEvaluationSettings`/`listDeadLetter`

**`v1.analytics.*`**

- `getSummary` `{scope,studentId?,classId?}` → discriminated summary;
  `generateReport` `{type,examId?,studentId?,classId?}` → `{pdfUrl,expiresAt}`
  (idem, report); `getExamAnalytics` `{examId}` → `ExamAnalytics`;
  `listInsights` `{studentId,includeDismissed?,PageRequest}` →
  `pageResponse(LearningInsight)`; `dismissInsight` `{insightId}` →
  `{id,dismissedAt}` (idem); `getPerformanceTrends`
  `{studentId?,classId?,subjectId?,granularity,range?}` → `{points[]}`;
  `getChildSummary` `{studentId}` → `{studentSummary,recentInsights}`;
  `listLinkedChildren` `{PageRequest?}` → `pageResponse(ChildRow)`;
  `getCostSummary` `{granularity,date?,month?,range?}` → `{summaries[]}`;
  `getLeaderboard` `{scope,spaceId?,storyPointId?,limit?}` →
  `{entries,myEntry?}`

### 3.3 SUBSCRIPTIONS registry — server-authoritative slim projections only

`SubscriptionDef<Params,Payload>` =
`{ name, module, params (.strict), payload (.strict), source: 'firestore-doc'|'firestore-query'|'rtdb-node', projectionPath, targetKey }`.

**Subscription authority invariant (MERGE-REALTIME-AUTHORITY).** The realtime
read path is authority-equivalent to the callable read path. **No subscription
may target a fat authoritative doc, an unbounded collection of fat docs, or any
doc containing ⚷ fields.** Every subscription targets a **server-maintained slim
projection doc/node** written by the owning service at the same point it writes
authority; the projection omits answer-key/guidance/cost and any score/grade not
yet release-gated. Subscriptions are reconciled into the cache via the matching
`targetKey` (A10): a subscription writes the same `*.detail(id)`/`sub(...)` key
the REST read populates, `onSynced` gates the first write, server stream wins
over optimistic.

| Name                             | params                                 | payload (slim)                                                                                                                   | source                                                       | projection written by                                            |
| -------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `v1.levelup.testSessionDeadline` | `{sessionId}`                          | `TestSessionLive {remainingMs,serverDeadline,status}` (server-computed; no answers)                                              | firestore-doc `tenants/{t}/.../sessions/{id}/live`           | startTestSession                                                 |
| `v1.levelup.chatStream`          | `{sessionId}`                          | ChatMessage (always-subcollection, no ⚷)                                                                                         | firestore-query `.../chatSessions/{id}/messages`             | sendChatMessage                                                  |
| `v1.levelup.spaceProgressLive`   | `{spaceId,userId}`                     | `SpaceProgressLive` slim mirror (bounded per-story-point numerics)                                                               | firestore-doc `.../spaceProgress/{userId}_{spaceId}/live`    | progressUpdater (verifies `userId∈ctx.studentIds`/self at write) |
| `v1.levelup.leaderboardLive`     | `{scope,spaceId?,storyPointId?,limit}` | LeaderboardSnapshot (no PII beyond projection policy)                                                                            | rtdb-node                                                    | updateLeaderboardService (single writer)                         |
| `v1.levelup.studentLevelLive`    | `{}`                                   | StudentLevel slim (level/xp only)                                                                                                | firestore-doc `.../students/{uid}/level/current`             | awardAchievements/progressUpdater                                |
| `v1.levelup.achievementUnlock`   | `{}`                                   | StudentAchievement (unlock event, no ⚷)                                                                                          | firestore-query `.../students/{uid}/achievements?seen=false` | awardAchievements                                                |
| `v1.autograde.gradingStatus`     | `{submissionId}`                       | `SubmissionStatus {pipelineStatus,gradingProgress,updatedAt}` — **no summary/totalScore/grade/percentage until resultsReleased** | firestore-doc `tenants/{t}/.../submissions/{id}/live`        | advancePipeline/finalizeSubmission                               |
| `v1.autograde.examGrading`       | `{examId}`                             | ExamGradingProgress (single aggregate, O(1)/tick)                                                                                | firestore-doc `tenants/{t}/examGradingProgress/{examId}`     | advancePipeline/finalizeSubmission                               |
| `v1.notification.badge`          | `{}`                                   | NotificationBadgeState (RTDB epoch-ms fenced)                                                                                    | rtdb-node                                                    | emitNotificationService                                          |

`SubscriptionName`, `ParamsOf<S>`, `PayloadOf<S>` recovered via `z.infer`.
**`SubmissionStatusSchema` drops `summary`/`totalScore`/`grade`/`percentage`**
(release-gated; surfaced only through the `getSubmission` callable after
`resultsReleased`). **`examGrading` is a single aggregate doc**
`tenants/{t}/examGradingProgress/{examId}` (written O(1) per tick by the
pipeline reducer, never an O(submissions) fan-in query).

transport-firebase keeps the wire-location table
`SUBSCRIPTION_SOURCES satisfies Record<SubscriptionName, SourceDescriptor>` with
`__tenant__`/`__uid__` placeholders resolved from the decoded ID token claim +
`auth.currentUser`. **SUBSCRIPTION_SOURCES must list all 9 names** (add
`studentLevelLive`+`achievementUnlock` descriptors+producers — closes the
SUBSCRIPTIONS(9) vs SOURCES(7) schism); `leaderboardLive` is the single
canonical name (the `analytics.leaderboard` subscription is dropped in favor of
the `v1.levelup.leaderboardLive` rtdb node). The
`SubscriptionName ⊇ keyof SUBSCRIPTION_SOURCES` coverage test must be **green,
not aspirational**.

**Required realtime tests:** (1) a rules+contract test that a non-released
submission's score is unreadable by a student subscriber and that no
SUBSCRIPTIONS payload doc holds answer-key/guidance/cost; (2) per-source decode
tests incl. the RTDB epoch-ms fence and a `__tenant__`/`__uid__`
placeholder-resolution-**cannot-widen-tenant** test (T12); (3) a test that every
SUBSCRIPTIONS entry has a declared `targetKey` query-key factory (DX-15).

**Firestore + Storage security rules are now in-scope (promoted from
Non-Goal).** New layer plan `sdk-plan/layers/security-rules.md` generates rules
from the same key registries (`TENANT_ROLES`, `ALLOWED_TRANSITIONS`, the §6
authority list, `ACCESS_RULES`) so rules and `@levelup/access` cannot drift:
deny-by-default; explicit per-path predicate for **every** subscription-read
projection doc/node and **every** Storage object; answer-key subcollection
`read,write:if false`; emulator rules tests are a **required CI gate**.

### 3.4 `AppErrorCode` + maps + copy

`AppErrorCode` (14):
`VALIDATION_ERROR, INVALID_TRANSITION, NOT_FOUND, PERMISSION_DENIED, UNAUTHENTICATED, RATE_LIMITED, QUOTA_EXCEEDED, FEATURE_DISABLED, TENANT_SUSPENDED, CONFLICT, PRECONDITION_FAILED, IDEMPOTENCY_CONFLICT, PAYMENT_FAILED, INTERNAL_ERROR`.
`APP_ERROR_CODES` array mirror (compile-time exhaustiveness).
`ApiErrorDetails {code,message,validationErrors?,retryable?,meta?}` + Zod
mirror + `isApiErrorDetails`. Maps: `APP_ERROR_TO_HTTPS` (total, server
`fail()`), `HTTPS_TO_APP_ERROR` (total over FunctionsErrorCode, many→one
fallback), `DEFAULT_RETRYABLE`, `ERROR_MESSAGES`, `ERROR_RECOVERY_HINTS`.
`fail()` lives in functions-shared; `normalizeError()` in api-client — both
import this vocabulary (keeps api-contract firebase-free).

**`IDEMPOTENCY_CONFLICT` is wired** into `mapError` (functions-shared) +
`DEFAULT_RETRYABLE` (retryable: a transient in-flight lease, the client
retries). The atomic dedupe mechanism is specified in §5.5 (`repository-admin`
idempotency repo + `dedupe.begin`/`commit`).

### 3.5 Pagination fragment

`PageRequest = z.object({ cursor?: string, limit: int.min(1).max(100).default(20) }).strict()`.
`pageResponse(item) = { items: item[], nextCursor: string|null, total?: int }`.
`withPaging(filterSchema)` merges paging onto a filter. Opaque cursors;
`nextCursor:null` = end-of-stream. Domain owns `Page<T>`/`Cursor` types;
contract owns the wire fragment.

### 3.6 ALLOWED_TRANSITIONS tables (build-time-checked data)

Authored as `as const satisfies TransitionMap<XStatus>` (key set must equal the
`as const` status enum; values ⊆ enum — a typo/stale status fails `tsc`):

- **space:** `draft→[published]`, `published→[archived,draft]`,
  `archived→[draft]`
- **exam:** `draft→[question_paper_uploaded,archived]`,
  `question_paper_uploaded→[question_paper_extracted,archived]`,
  `question_paper_extracted→[published,archived]`,
  `published→[grading,archived]`, `grading→[results_released,grading]`,
  `results_released→[archived]`, `archived→[]` (`'completed'` DROPPED —
  unreachable)
- **submission (pipeline):** `uploaded→[scouting]`,
  `scouting→[scouting_complete,scouting_failed]`,
  `scouting_failed→[scouting,manual_review_needed]`,
  `scouting_complete→[grading]`,
  `grading→[grading_complete,grading_partial,grading_failed,manual_review_needed]`,
  `grading_partial→[grading]`, `grading_failed→[grading,manual_review_needed]`,
  `grading_complete→[ready_for_review,finalization_failed]`,
  `finalization_failed→[grading_complete]`, `ready_for_review→[reviewed]`,
  `reviewed→[]`, `manual_review_needed→[grading,reviewed]`, `failed→[]` (OCR
  statuses excluded by default)
- **questionGrading:** `pending→[processing]`,
  `processing→[graded,needs_review,failed]`, `graded→[overridden]`,
  `needs_review→[graded,manual,overridden]`, `failed→[pending,manual]`,
  `manual→[overridden]`, `overridden→[]`
- **testSession:** `in_progress→[completed,expired,abandoned]`; terminals `→[]`
- **tenant:** `trial→{active,expired,suspended,deactivated}`,
  `active→{suspended,deactivated,expired}`, `suspended→{active,deactivated}`,
  `expired→{active,deactivated}`, `deactivated→{active}`
- **membership:** `active→{inactive,suspended}`, `inactive→{active}`,
  `suspended→{active,inactive}`
- **announcement:** `draft→[published,archived]`, `published→[archived]`,
  `archived→[draft]` (resolves the master §3.6 `archived→[]` vs identity §64
  `archived→{draft}` schism — adopt `archived→[draft]`)
- **entityStatus** (student/teacher/parent/staff/scanner/class/session):
  `active→[archived]`, `archived→[active]`

`canTransition()`/`assertTransition()` pure helpers. SDK uses for button-disable
UX; server (`@levelup/access`) enforces via the same table. Notification
read-state (`unread→read`) and StudyGoal completion are degenerate/derived — no
table entry.

**Canonical enum tuples (MERGE-TRANSITIONS).** One tuple per status enum lives
in `domain-core` and every other doc cites it (these `satisfies` assertions
currently fail `tsc` because the enums are defined ≥2 ways):

- `TEST_SESSION_STATUSES = ['in_progress','completed','expired','abandoned']`
  (drop `submitted`/`graded`; update domain-core §7.2 L511).
- `TENANT_STATUSES = ['trial','active','suspended','expired','deactivated']` (5
  members; update domain-core §7.2 L512 to match identity + the transition table
  above).
- `QUESTION_GRADING_STATUSES`, `MEMBERSHIP_STATUSES`, `ANNOUNCEMENT_STATUSES`,
  `ENTITY_STATUSES` authored explicitly.

**All 9 transition machines** live as `domain-core/transitions/*.ts` (each
`satisfies TransitionMap<…>`), aggregated into `ALLOWED_TRANSITIONS`: space,
exam, submission, **question-grading**, testSession, **tenant**, **membership**,
**announcement**, **entity-status** (the last five were missing from domain-core
and are added now). `TransitionDomain` is widened so identity/autograde call
sites type-check; the §1 file tree and §7.5 aggregate are updated. **D5
reconcile:** `delete?=true` archives for all entities **except announcements**
(announcements honor `archived` status; whether `delete?` hard-deletes vs
archives an announcement is stated once in §8 D5 — announcements truly delete,
`archived` is a distinct authored state reached only via lifecycle transition,
not via `delete?`).

`transitions.assertion.test.ts` is parameterized over **all nine** machines +
the **7** entityStatus-consuming enums (each must `==={active,archived}`) + a
toggle-consistency assertion (no edge references an excluded `'completed'`/OCR
member).

### 3.7 Storage seam (C1 — MERGE-C9-ORPHANED)

The `Transport` interface is extended with a **`StorageTransport`** capability
(the only client Storage site, in transport-firebase):
`requestUploadUrl(input) → {uploadUrl, path: StoragePath, expiresAt}` +
`upload(uploadUrl, bytes, contentType)`. **Canonical mechanism: signed PUT URL**
(server-enforced path scope, REST-ready). Callable
`v1.autograde.requestUploadUrl {kind:'answer-sheet'|'question-paper', examId, studentId?, classId?, contentType}`
and `v1.identity.uploadUserAsset`/`uploadTenantAsset` use it. **Storage path
grammar + per-kind read+write predicate** (enforced in `security-rules.md`):

- answer-sheet `tenants/{t}/exams/{examId}/submissions/{id}/…` — readable only
  by teacher-of-class / owning-student-after-`resultsReleased` / super-admin;
  writable via signed URL only.
- question-paper `tenants/{t}/exams/{examId}/paper/…` — teacher/admin of tenant.
- avatar `tenants/{t}/users/{uid}/avatar` — writable only by `uid`.
- answer-key objects: none (answer keys are Firestore subcollection
  `read,write:if false`).

`requestUploadUrlService` validates `studentId/classId∈ctx` (scanner) and
`uid===ctx.uid` (avatar); pins signed-URL **TTL ≤10 min** +
`contentType`/max-bytes at sign time. The byte-upload precedes
`uploadAnswerSheets`, sharing one `idempotencyKey`; orphan paths
(uploaded-but-never-submitted) are swept by a cleanup task. Never optimistic.
Repos `storageRepo.requestUploadUrl/uploadImage`; hooks
`useRequestUploadUrl`/`useUploadImage`.

### 3.7.1 Impersonation hardening sub-spec (C28/C28b — MERGE-IMPERSONATION / SEC-04 / UC-12)

`startImpersonation {targetUid, tenantOverride, reason}` and
`endImpersonation {}` are the only super-admin impersonation surface. Both are
`authoritySensitive`, `idempotent:true`, **never optimistic**;
`startImpersonation` carries `allowsTenantOverride:true` (the target tenant
travels as `tenantOverride`, never a body `tenantId`). The contract:

1. **Constrained claim set (no privilege passthrough).**
   `startImpersonationService` mints a session token with a **constrained**
   claim set, never a copy of the actor's claims: `impersonating:true`,
   `impersonatorUid:<actorUid>`, the target's role/tenant scope,
   **`isSuperAdmin` forced FALSE**, and a time-boxed `expiresAt` (short TTL).
   While a token carries `impersonating:true`, `authorize()` **denies**
   `claims.sync`, `membership.write`, every `tenant.*` platform op,
   `user.status.set`, `user.impersonate.start|end` (**nested impersonation
   denied**), and all super-admin control-plane actions — an impersonated
   session can never escalate or re-impersonate.
2. **Synchronous + transactional audit (fail-closed).** The `ImpersonationAudit`
   record
   `{actorUid, targetUid, tenantId, reason, issuedAt, expiresAt, sessionId}` is
   written **synchronously and transactionally in the same unit as the token
   mint** — if the audit write fails the mint fails (fail-closed); there is no
   best-effort/after-the-fact audit path.
3. **Impersonation-session ledger.** The service maintains an
   impersonation-session ledger doc (one record per active session keyed by
   `sessionId`) so active impersonations are enumerable, revocable, and
   auto-expirable. `endImpersonation`/auto-expiry flips the ledger record to
   ended.
4. **End / auto-expiry revokes the target.** `endImpersonationService` and the
   auto-expiry path (at `expiresAt`) both call `revokeRefreshTokens(targetUid)`
   so the minted session cannot outlive its window; revocation is part of the
   same transactional unit as the ledger close. `startImpersonation` itself is
   gated on a **synchronous revoke** before returning success per SEC-05
   (most-sensitive actions).
5. **Wiring.** `startImpersonation`/`endImpersonation` are callables in §3.2
   (identity fold list) with `ACCESS_RULES` actions `user.impersonate.start` /
   `user.impersonate.end` (§5.4); `INVALIDATION_GRAPH` rules
   `startImpersonation/endImpersonation→{userSearch}` (§4.3). Both reconcile
   against the `no-tenant-id-in-request` test (super-admin cross-tenant via
   `tenantOverride` only).

---

## 4. Repository & query-hook inventory

### 4.1 Repositories (client brain — `@levelup/repositories`)

**Per-entity repos** (37 + C1–C31): identity — meRepo, tenantRepo, studentRepo,
teacherRepo, parentRepo, staffRepo, academicSessionRepo, orgUserRepo,
announcementRepo, notificationRepo, **notificationPreferenceRepo (C2),
deviceRepo (C4), messageRepo (C14), presetRepo/platformConfigRepo (C31)**;
levelup — spaceRepo, storyPointRepo, itemRepo, questionBankRepo,
rubricPresetRepo, agentRepo, chatRepo, storeRepo, versionRepo, **assignmentRepo
(C12), aiGenerationRepo (C13), storageRepo (C1)**; testsession — testSessionRepo
(+`saveAnswer` C21), progressRepo (+`listForUser` C17, +`recordAttempt(input)`
returning the authoritative `{progress:ItemProgressView,completed}` — sends raw
`answer`, server scores, CD13), learningInsightRepo, evaluationRepo;
gamification — achievementRepo, studentLevelRepo, studyGoalRepo,
studySessionRepo; autograde — examRepo, examQuestionRepo (+`save` C15),
submissionRepo (+`getForExam` C16), questionSubmissionRepo,
evaluationSettingsRepo, deadLetterRepo; analytics — examAnalyticsRepo,
insightRepo, costRepo, reportRepo, **activityRepo (C25), parentRepo.listAlerts
(C18)**.

**Cross-entity VIEW repos** (12 — the only repos allowed to compose others,
under `src/views/**`): classRepo (class+roster batch), userSearchRepo,
spaceDetailViewRepo (space+storyPoints+items+myProgress one shaped call),
studentSummaryRepo (cross-domain), gamificationViewRepo (5-read collapse),
leaderboardRepo (snapshot+RTDB merge), summaryRepo, trendsRepo, parentRepo (N+1
child collapse), examAnalyticsRepo, gradingReviewRepo
(submission+questionSubmissions+questions batched), notificationCenterRepo
(notifications+announcements+badge inbox).

Every repo: owns `paginate()` opaque-cursor mgmt, `getMany(ids)` N+1 collapse
(calls the **batched read callable / view repo** — the client never touches
Firestore; the `in`-chunking of 10/30 ids + `Promise.all` + max-ids cap lives
**server-side in `repository-admin`**, beyond the cap the caller paginates —
DX-14/PC-15), `canTransition(from,to)` pre-checks reading `ALLOWED_TRANSITIONS`,
and derived fields computed once (e.g. `spaceRepo.canPublish`,
`testSessionRepo.remainingMs`, `examRepo.canReleaseResults`,
`progressRepo.completionPct`). Repos never import sibling repos except declared
views (R6 lint).

**Repositories layer plan (`sdk-plan/layers/repositories.md`) —
MERGE-REPOSITORIES-PLAN.** Authored before freeze, fixing: (1) **method-naming
convention** — `list`/`get`/`getMany`/`save`/`paginate` for IO, `can*`/`is*` for
boolean pre-checks, `compute*`/`resolve*` for derived; no other verbs. (2)
**View types** live as the response shape of the view callables in
`api-contract`; `domain` re-exports `z.infer`; apps import View types from
`domain` (keeps R7 — apps never import `repositories`). (3) A path-scoped lint
snippet proving the `views/**` import-siblings exception. (4) A view-repo
field-count cap/review-gate; any view repo issuing O(N) callables is a violation
(genuine 1+N dashboards get a server composite callable like `getSpaceDetail` —
PC-14). (5) A `createRepositories(api)` **fake-ApiClient test seam** + matrix
(`getMany` chunking at 0/1/10/11/21; `paginate()` cursor threading +
`nextCursor:null`; each view-repo shaping vs a fixed wire fixture; each derived
field; `isSensitiveKey`/editor-cache-scope). (6) **T6:**
`createInMemoryRepos()`+`createFakeAiGateway()` in a `repository-admin/testing`
subpath with a conformance suite run against **both** the in-memory fake and the
emulator-backed real repos (one file, two drivers) so the fake can't diverge on
`tx()`/cursor/brand-strip; `fixedClock(iso)` is the named clock.

**Pagination (MERGE-PAGINATION).** Every `list*` callable is paginated
(`PageRequest`/`pageResponse`) **or** is in an explicit bounded-list allow-list
with a documented hard server cap (≤200) and a declared `maxItems` —
contract-tested. Newly paginated: `listStoryPoints`, `listQuestions`,
`listQuestionSubmissions`, `listEvaluationSettings`, `listAgents`,
`listRubricPresets`. `getClass` returns counts + first roster page
(`listStudents{classId}` pages the rest). Chat: `messages/` is always a
subcollection; add `PageRequest` to `getChatSession` (or a
`listChatMessages → pageResponse(ChatMessage)`), keeping
`messageCount`/`previewMessage` denormalized. `total` is populated only from a
maintained counter, **never** a live `.count()` per page — pagination test
asserts no list service issues `.count()` per `paginate()`.

### 4.2 Query-key factories

One `createKeyFactory(domain)` →
`{root, all, list(f), infinite(f), detail(id), sub(id,kind,params)}` per
`DomainName`. `QUERY_KEYS` frozen registry. Root = `[domain]` (tenant-implicit;
tenant switch = full `qc.clear()`). Answer-key isolation:
`editItemKey(itemId)=[EDIT_ITEM_SCOPE,itemId]`, `isSensitiveKey()` excludes from
persisted/offline store; `getItemForEdit` hooks set `gcTime:0,staleTime:0`.

**`DomainName` is the single exhaustive source (MERGE-DOMAINNAME).**
`keyof typeof QUERY_KEYS === DomainName` AND every `INVALIDATION_GRAPH` root ∈
`DomainName`, contract-tested against the **real** inventory (not aspirational).
The factory list below and the `query-infra` union are reconciled in one table;
the `DomainName` union must include all roots used by any
callable/subscription/invalidation rule. Per-domain factories: spaceKeys,
storyPointKeys, itemKeys, progressKeys, testSessionKeys, chatKeys,
questionBankKeys, rubricPresetKeys, agentKeys, storeKeys, reviewKeys,
versionKeys, enrollmentKeys, examKeys, questionKeys, submissionKeys,
questionSubmissionKeys, evalSettingsKeys, deadLetterKeys, examAnalyticsKeys,
gradingReviewKeys, meKeys, tenantKeys, studentKeys, teacherKeys, parentKeys,
staffKeys, classKeys, sessionKeys, announcementKeys, notificationKeys,
userSearchKeys, summaryKeys, insightKeys, costKeys, trendKeys, **childrenKeys**
(analytics parent-children; renamed from the second `parentKeys` to disambiguate
— DX-2), leaderboardKeys, gamificationKeys, achievementKeys, levelKeys,
studyGoalKeys, studySessionKeys, studentSummaryKeys.

**~16 previously-missing roots now added to `DomainName`** (the union omitted
these, so `QUERY_KEYS satisfies Record<DomainName,…>` + the totality test would
fail as written): `testSessions`, `questionSubmissions`, `deadLetter`,
`examAnalytics`, `gradingReview`, `userSearch`, `summary`, `trends`,
`leaderboard`, `gamification`, `achievements`, `levels`, `studyGoals`,
`studySessions`, `studentSummary`, `enrollment`, **plus the C1–C31 roots**
(`storage`, `notificationPreferences`, `device`, `exportJob`, `assignment`,
`aiGeneration`, `message`, `parentAlert`, `platformActivity`, `platformConfig`,
`preset`).

**Subscription→query-key mapping (A10/DX-15).** Each `SUBSCRIPTIONS` entry
declares a `targetKey` derived from the matching domain key (or an explicit
`onPayload` targeting a domain key). A documented subscription→query-key table
lives here; a contract test asserts every subscription has a declared target key
factory. There is one `useSubscription` (realtime owns seam+dedupe; query owns
the opt-in `toCacheKey`/`onPayload` binding); subscriptions write the same
`*.detail(id)`/`sub(...)` key the REST read populates, `onSynced` gates the
first write, server stream wins over optimistic.

### 4.3 Invalidation graph

`INVALIDATION_GRAPH = buildGraphFromContract(CALLABLES, OVERRIDES)`: seeds from
each `def.invalidates` string roots, merged with hand-authored cross-domain
fanouts. `invalidateForCallable(qc,name,{vars,data})` is the single entrypoint
every `defineMutation` calls in `onSettled`. Key cross-domain overrides:
`submitTestSession→{progress,spaces,storyPoints,analytics}`+fanout;
`recordItemAttempt→{progress}`+fanout; `saveItem→{items,storyPoints,versions}`;
`saveSpace→{spaces,store}`;
`gradeQuestion→{questionSubmissions,submissions,analytics}`;
`uploadAnswerSheets→{submissions,exams}`;
`saveStudent→{students,classes,memberships}`;
`saveClass→{classes,students,teachers}`; `switchActiveTenant→[]` (handled by
`resetForTenantSwitch`); `purchaseSpace→{store,spaces}`;
`markAchievementsSeen→{achievements,gamification}`;
`markNotificationRead→{notifications,notificationBadge}`. **C1–C31 mutating
callables added:** `requestUploadUrl→[]` (no cache);
`uploadUserAsset/updateMyProfile→{me}`;
`saveNotificationPreferences→{notificationPreferences}`;
`registerDeviceToken/unregisterDeviceToken→{device}`;
`saveTenantSettings/saveTenantFeatures/bulkApplyTenantFeatures→{tenants}`;
`saveClass(schedule)→{classes}`; `assignContent→{assignment,spaces,exams}`;
`generateContent→[]` (drafts, no persist); `saveTestAnswer→{testSessions}`;
`saveExamQuestion→{questions,exams}`;
`setUserStatus/sendPasswordReset(uid)/startImpersonation/endImpersonation→{userSearch}`;
`savePlatformConfig→{platformConfig}`; `deleteConsumerAccount→{me}`;
`sendDirectMessage→{message}`. Totality contract-tested: every mutating callable
has an entry; every root ∈ `DomainName`.

**Coarse-invalidation rule (MERGE-INVALIDATION-COARSE).** A `fanout`-present
rule **suppresses the coarse root** for that root (invalidate precise keys
only); bare-root invalidation is reserved for genuinely-unnarrowable cases.
`fanout` distinguishes `list`/`infinite`/`detail` kinds. A graph-shape contract
test: any rule dirtying a high-churn root (`analytics`, `progress`,
`submissions`) provides a `fanout` and does **not** also list that root
coarsely. The typed
`defineRule<N extends CallableName>(name, rule: InvalidationRule<ReqOf<N>>)`
builder is **required** (not deferred) — removes `vars as any`, gives
compile-time field names; each fanout test is driven with a real `ReqOf<N>`
fixture asserting produced keys reference fields that exist on the request
schema.

### 4.4 Conservative optimistic allow-list (the ONLY ✅ surfaces)

Closed allow-list — `defineMutation` runtime guard +
`@levelup/no-optimistic-on-authority` lint both read
`CallableDef.authoritySensitive` and `OPTIMISTIC_ALLOWLIST`:

- `v1.levelup.recordItemAttempt` — practice progress patch: client sends raw
  `answer` only (server scores — CD13); the optimistic patch shows an in-flight
  attempt, then **reconciles via `setQueryData` from the authoritative
  `{progress:ItemProgressView,completed}` response** (A11 — not
  invalidate-refetch), so best-score-retention semantics render correctly;
  rollback on error
- `v1.levelup.sendChatMessage` — optimistic append of user message
- `v1.identity.markNotificationRead` / mark-all — flip `isRead` + decrement
  badge
- `v1.identity.markAnnouncementRead` — set `isReadByMe`
- `v1.levelup.dismissInsight` (also `v1.analytics.dismissInsight`) — set
  `dismissedAt`
- `v1.levelup.markAchievementsSeen` — flip `seen` + decrement `unseenCount`

**NEVER optimistic (lint-flagged):** all grading (`gradeQuestion`,
`submitTestSession`, `evaluateAnswer`), publish/lifecycle
(`saveSpace`/`saveExam` status, `releaseResults`, `saveAnnouncement`), purchases
(`purchaseSpace`), session start, all bulk ops, membership/claims writes,
`saveStudyGoal` (server-derived fields), report generation. Note
`recordItemAttempt` stays optimistic but the client never sends a score — it
sends the raw `answer` and reconciles from the authoritative response
(CD13/A11), so no client-set grading value rides the optimistic path.

**Optimistic counter allow-list (SEC-08 / CONV-4).** Optimistic counter patches
(the `decrementBadge`/`incrementCounter` recipes) may touch **only** the
counters in the closed
`OPTIMISTIC_COUNTER_ALLOWLIST = ['unreadCount','unseenCount'] as const`. A
required test asserts **no progress / score / points / rank / purchase counter
is ever in `OPTIMISTIC_COUNTER_ALLOWLIST`** (it cross-checks the list against
the §6.9 denormalized-counter authority set and fails if any ⚷ aggregate —
`pointsEarned`, `*ProgressSummary`, leaderboard rank, `StudentLevel` xp,
`PurchaseRecord`, `Space.stats`, etc. — appears). Together with the
`authority-flag-coverage` test (§3.1), this proves the optimistic allow-list
still excludes every authority-sensitive write and counter.

Recipes: `appendToList` (chat), `patchDetail` (attempt/mark-read),
`decrementBadge`/`incrementCounter`. The attempt recipe's
`onSettled`/`onSuccess` calls
`setQueryData(progressKeys.detail(...), res.progress)` from the authoritative
response (A11/CD13) rather than invalidating, so the server's recomputed
best-score wins over the optimistic in-flight patch.
`useApiError`/`ApiErrorBoundary` surface
`ApiError.code`→`ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS`.
`useSubscription`/`useServerTime`/per-sub hooks wire realtime into the cache.

### 4.5 Lifecycle verbs + raw-client hook gating

**DX-5 — `save*` is create/update of metadata only; lifecycle is explicit
verbs.** Split lifecycle out of the overloaded `save*` so the
`ALLOWED_TRANSITIONS` UX pre-check maps 1:1 to a button/callable and
authority-tagging + optimistic granularity stay clean: `publishSpace`,
`archiveSpace`, `publishExam` (`releaseResults` already exists). Any retained
fused form is modeled as a real
`z.discriminatedUnion('op',[Create,Update,Transition])` so create requires its
fields. (Lifecycle verbs are `authoritySensitive`, never optimistic.)

**DX-8 — no raw api-client escape hatch in the default surface.** `api` is
removed from the default `useApi()` surface; `useApiClient` is exposed only from
a separate `@levelup/query/unsafe` entrypoint forbidden by
`no-restricted-imports` in app + domain-hook code (tiny audited allowlist),
enforced by a custom lint rule `no-raw-api-in-hooks` mirroring
`no-optimistic-on-authority`. Steady-state sanctioned uses ≈ 0, documented.

---

## 5. Server service + function-shell inventory

### 5.1 The 4 codebases (deploy-independent, thin one-liner barrels)

`functions/identity` · `functions/levelup` (content + testsession + gamification
callables + gamification triggers move to analytics) · `functions/autograde`
(`asia-south1`) · `functions/analytics`. Each `index.ts` is
`export const X = makeCallable('v1.<m>.<op>', S.xService)` / `makeTrigger(...)`
/ `makeScheduler(...)` / `makeTaskHandler(...)`. A contract test asserts
`CALLABLES[name].module` equals the codebase a callable is wired in.

### 5.2 Services topology (`@levelup/services/{server,shared}`)

`services/server` (⚷ — answer keys, grading, counters, claims, secrets,
purchases, lifecycle): all identity write services + provisionMembership +
syncMembershipClaims; levelup
saveSpace/saveStoryPoint/saveItem(strip)/getItemForEdit/purchaseSpace/cascadeDeleteSpace/recomputeSpaceStats;
testsession start/submit/evaluate/recordItemAttempt + **progressUpdater**
(single transactional writer) + resolveRubric; autograde
saveExam/releaseResults/extractQuestions/uploadAnswerSheets/gradeQuestion +
pipeline
advancePipeline/processAnswerMapping/processAnswerGrading/finalizeSubmission;
analytics
recompute{StudentSummary,ClassSummary,ExamAnalytics}/detectAtRisk/generateInsights/aggregateDailyCost/generateReport/**notifyService**/updateLeaderboard/**recomputeOrchestrator**;
gamification
awardAchievements/recomputeStudyGoalProgress/upsertLeaderboardEntry/saveStudyGoal/markAchievementsSeen/saveAchievementDefinition;
notification
**emitNotificationService**/markNotificationRead/saveAnnouncement/markAnnouncementRead.

`services/shared` (client-safe reads/shaping, still server-resolved tenant): all
list/get readers (role-scoped, answer-stripped, guidance-stripped,
released-gated projections), lookupTenantByCode (public),
switchActiveTenant/joinTenant, pure rule engines (evaluateAtRiskRules,
generateInsightsForStudent, computeOverallScore, computeTestAnalytics,
autoEvaluateDeterministic, storyPointTypeToSessionType,
assertTestSessionTransition).

Every service is `fn(input, ctx: AuthContext): Promise<output>` —
`tenantId=ctx.tenantId` (claims), `authorize(ctx, action, resource)`,
`assertTransition(...)`, `ctx.now()`, data via `ctx.repos.*`, LLM via
`ctx.ai.generate(...)`. Same services back the future REST gateway.

### 5.3 Triggers / schedulers (thin-over-services, single-writer, idempotent, outbox, Cloud Tasks)

- **identity triggers** (8): beforeUserCreated, beforeSignIn, onUserDeleted,
  onMembershipWritten (single claim-sync writer), onStudentArchived,
  onClassArchived, onTenantDeactivated (outbox revoke fan-out),
  onAnnouncementPublished (outbox notify). **Schedulers:** tenantLifecycleCheck,
  monthlyUsageReset, cleanupExpiredExports.
- **levelup triggers:** onSpacePublished (outbox), onSpaceDeleted (cascade),
  onTestSessionGraded/onProgressUpdated, onSpaceReviewWritten,
  onTestSessionExpired (single-writer), onSubmissionGraded (AI-pending merge,
  outbox), onSpaceProgressUpdated. **Schedulers:** expireTestSessions (5min),
  cleanupStaleSessions (hourly), cleanupInactiveChats.
- **autograde triggers:** onSubmissionCreated, onSubmissionUpdated (single
  pipeline reducer), onQuestionSubmissionUpdated (enqueue-only), onExamPublished
  (outbox), onResultsReleased (outbox), onExamDeleted (cascade),
  onQuestionPaperUpload (GCS); onAnswerSheetUpload **REMOVED**. **Scheduler:**
  staleSubmissionWatchdog (15min, collection-group).
- **analytics triggers:** onSubmissionGraded, onSpaceProgressUpdated (merges 2
  old), onExamResultsReleased (outbox), recomputeOrchestrator (Cloud Tasks
  handler — single RecomputeMarker consumer). **Schedulers:**
  dailyCostAggregation, nightlyAtRiskDetection, generateInsights,
  deadlineReminderCron.
- **gamification triggers (in analytics):** onProgressWrite_awardAchievements,
  onProgressSummaryWrite_updateLeaderboard,
  onStoryPointProgressWrite_updateLeaderboard, onProgressMilestone_notify.
  **Schedulers:** nightlyStreakReconciler, weeklyLeaderboardSnapshot.

**Async invariants — single-writer = SERIALIZED writes, mechanism stated per
derived value (MERGE-SINGLE-WRITER):**

- **`progressUpdater`** performs all aggregate mutations inside `ctx.repos.tx()`
  (read-modify-write on the aggregate doc; Firestore aborts+retries on
  contention) — covers the N-concurrent-AI-item race.
- **Session-grading reducer** (Cloud Tasks handler) decrements a
  `pendingAiItems` counter on the session doc and finalizes status/percentage +
  fires the single "graded" outbox notification exactly when the counter hits 0
  (mirrors autograde `advancePipeline`+`finalizeSubmission`).
- **`recomputeOrchestrator`** enqueues with Cloud Tasks
  `dedupeId=(tenantId,studentId)`+debounce; the `RecomputeMarker` is cleared
  transactionally at run start and re-checked at end.
- **submit-vs-expire:** both `submitTestSessionService` and
  `expireAndGradeSessionService` claim the session by transitioning
  `in_progress→<terminal>` inside a transaction as their first step — winner
  grades, loser reads the terminal status and returns the already-computed
  result; `cleanupStaleSessions` **skips past-deadline sessions** (expire
  precedence).
- **Leaderboard:** exactly one writer (`updateLeaderboardService`, invoked only
  from `recomputeOrchestrator`'s ordered step); the inline RTDB sync is
  **removed** from `progressUpdater` (which sets the recompute marker instead);
  RTDB `runTransaction` on the node.

idempotent handlers (event-id / `(submissionId,step)` / `(uid,key)`);
command-vs-projection split. `triggers-async.contract.test.ts` (per reducer):
deliver twice→one effect; out of order→correct final state; two concurrent→no
lost update; outbox row iff state write commits; same reducer path in emulator
as prod.

**Outbox drain (MERGE-OUTBOX-DRAIN).** Concrete worker: `onCreate` on
`tenants/{t}/outbox/{id}` (or 1-min sweep of `status==pending`) → deliver via
consumer service → on success `status=delivered`; on failure increment
`attempts` + reschedule with exponential backoff (Cloud Tasks
`scheduleDelaySec`); after N attempts `status=failed` + a dead-letter entry
surfaced to ops. Delivery is at-least-once and consumers dedupe (via
`emitNotificationService`'s key). Emulator test: two throws then success → one
delivered effect, `attempts==3`. **outbox** is used for must-deliver
(notifications, content versions, store mirror). **Cloud Tasks** for multi-step
(grading pipeline, AI grading fan-out, rolloverSession, bulkImport chunks,
summary recompute orchestration). **Platform-announcement fan-out is committed
to Cloud Tasks paginated** (one task per recipient page, cursor-checkpointed,
idempotent on `(announcementId,pageCursor)`); tenant-scope announcement fan-out
stays a single outbox-drained fan-out (§5.3 and notification.md agree).

### 5.4 `authorize()` policy keys (`@levelup/access`)

`ACCESS_RULES: Record<Action, AccessRule>` (data, completeness-tested against
the `Action` union). Action verbs by domain — identity:
`tenant.create|lifecycle|export|asset.upload`,
`user.create|update|bulkImport|bulkStatus`, `membership.write`, `claims.sync`,
`tenant.switch|join`, `class.write`, `session.write|rollover`,
`announcement.write|read`, `notification.read|markRead|prefs.self|emit`,
`user.search`, `preset.global.write`; levelup:
`space.read|write|publish|archive`, `storyPoint.write`,
`item.write|readForEdit`, `version.list`, `questionBank.write|read|import`,
`rubricPreset.write`, `testSession.start|submit`, `answer.evaluate`,
`itemAttempt.record`, `chat.send`, `progress.read|readOther`,
`store.list|review|purchase`,
`gamification.read|readChild|readStudent|manageOwnGoals|manageOwnAchievements|manageAchievements`;
autograde: `exam.read|write|publish|releaseResults`, `questions.extract`,
`answerSheets.upload`, `grade.manual|retry|ai`, `submission.read|readReleased`,
`evaluationSettings.manage|read`, `deadLetter.read`; analytics:
`summary.read{Student,Class,Platform,Health}`, `report.{exam,progress,class}`,
`child.read|list`, `trends.read`, `cost.read`, `leaderboard.read`,
`insight.read|dismiss`; cross: `rubric.guidance.read` (the §6.7 leak gate).
**C1–C31 actions added (MERGE-C9-ORPHANED):** identity —
`notification.prefs.self.read|write`, `device.register|unregister`,
`tenant.settings.write`, `tenant.features.write`, `tenant.ai.key.write`
(distinct, mandatory-audit gate for `geminiApiKey` — SEC-09),
`user.asset.upload`, `me.profile.update`, `me.account.delete`,
`user.status.set`, `user.passwordReset.admin`, `user.impersonate.start|end`,
`platform.config.read|write`, `preset.global.list`,
`announcement.estimateAudience`, `message.send`; levelup — `content.assign`,
`content.generate` (ai), `progress.readOther` (parent, gated
`studentId∈ctx.studentIds`), `storyPoint.read`, `testAnswer.save`,
`storage.requestUploadUrl`; autograde — `examQuestion.write`,
`submission.getForExam` (released-gated + ownership); analytics —
`platform.activity.read`, `parentAlert.read`. `authorize()` throws
`PERMISSION_DENIED`; `assertTransition()` throws `INVALID_TRANSITION` (both as
`AccessError`, mapped to `HttpsError` by functions-shared `mapError`).

**Token revocation enforcement (SEC-05).** (a) Any service changing
`role`/`status`/`isSuperAdmin`/permissions calls `revokeRefreshTokens(uid)` in
the **same transaction/outbox unit** as the claim rewrite — asserted by
server-shared §8 test #11 (static + emulator). (b) A server-side
`auth_time`/`tokensValidAfterTime` check on every `authoritySensitive` callable
and in the Firestore/Storage rules (folds into `security-rules.md`) locks a
revoked user out within the rules layer, not only after ~1h. (c) The
revocation-lag SLO for the outbox fan-out is stated; the most sensitive actions
(super-admin `user.status.set` disable, `tenant.lifecycle` deactivate,
`user.impersonate.start`) gate on a **synchronous** revoke before returning
success.

### 5.5 Repository admin adapter (`@levelup/repository-admin`)

`createRepos() → Repos` injected as `ctx.repos`. THE ONLY direct-Firestore site.
Responsibilities: Timestamp↔ISO edge adapter (D4 collapse), brand strip-on-write
/ brand-on-read converters (D8), opaque base64 cursor encode/decode,
`getMany`/batched membership/child-summary fetch (N+1 collapse),
single-canonical path resolution (D1 dual-item-path fix), `tx()` for atomic
state+outbox writes. Authority repos: `claims.set`/`revokeRefreshTokens` (⚷
mint), `answerKeys.put/get` (⚷ server-only subcollection deny-all), `progress`
(single writer), `idempotency`/`outbox`/`audit`.

**Atomic idempotency dedupe (MERGE-IDEMPOTENCY).** `idempotency.begin(key)` is a
**Firestore transaction** that creates `tenants/{t}/idempotency/{uid}_{key}`
with `status:'in_flight'` + lease/TTL; on create-contention it (a) returns the
committed response if `status==committed`, (b) throws `IDEMPOTENCY_CONFLICT` if
an unexpired in-flight lease exists, (c) reclaims a stale (expired-lease)
record. `idempotency.commit(key,result)` flips `in_flight→committed` (storing
the result) in the **same doc**. `IDEMPOTENCY_CONFLICT` is wired into
`mapError` + `DEFAULT_RETRYABLE`. Test (server-shared §8 #10): two concurrent
identical idempotent calls → **exactly one** service-body execution, asserted by
counting side effects. The dedupe key = the `CallableDef.idempotencyKey` domain
key when present (§3.1), else the api-client UUIDv7.

---

## 6. Trust/authority boundary (consolidated ⚷ server-only list → owning services)

Maps REVIEW §6 (13 items) to the services that own each. SDK reads projections +
requests changes; the server is the sole writer.

| #     | ⚷ Authority item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Owning service(s)                                                                                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §6.1  | **`tenantId` for every tenant-scoped op** — claim-derived, no request field (super-admin `tenantOverride` only)                                                                                                                                                                                                                                                                                                                                                                                                             | `buildAuthContext` (functions-shared); every service reads `ctx.tenantId`                                                                                                                                                                |
| §6.2  | **All `PlatformClaims`** — role, permissions, staffPermissions, **`isSuperAdmin`**, classIds, studentIds, entity ids; token revocation                                                                                                                                                                                                                                                                                                                                                                                      | `syncMembershipClaims` + `repository-admin.claims.set/revokeRefreshTokens`                                                                                                                                                               |
| §6.3  | **`UserMembership` docs** — role/status/permissions/`parentLinkedStudentIds` (Admin-SDK write only; rules `write:if false`)                                                                                                                                                                                                                                                                                                                                                                                                 | `provisionMembership`, `save*` services, `onMembershipWritten`                                                                                                                                                                           |
| §6.4  | **AnswerKeys** — `correctAnswer`, `acceptableAnswers`, `evaluationGuidance`, `modelAnswer` (deny-all subcollection)                                                                                                                                                                                                                                                                                                                                                                                                         | `saveItem` (extract+strip), `getItemForEdit` (re-merge, gated), submit/evaluate (batched read) via `repository-admin.answerKeys`                                                                                                         |
| §6.5  | **Grading outputs** — `UnifiedEvaluationResult` (score/correctness/confidence/cost), `QuestionSubmission.evaluation`, `TestSubmission.evaluation`, `ManualOverride`, `SubmissionSummary`, stored progress evals                                                                                                                                                                                                                                                                                                             | `submitTestSession`, `evaluateAnswer`, `recordItemAttempt`, `gradeQuestion`, `processAnswerGrading`, `finalizeSubmission`, `progressUpdater`                                                                                             |
| §6.6  | **Test-session authority** — `serverDeadline`, `isLatest`, `attemptNumber`, question/visited/marked states, adaptive order, the deadline clock (`ctx.now()`+`/serverTimeOffset`)                                                                                                                                                                                                                                                                                                                                            | `startTestSession`, `submitTestSession` (server clock)                                                                                                                                                                                   |
| §6.7  | **Rubric/answer guidance** — `UnifiedRubric.modelAnswer`/`evaluatorGuidance`, `EvaluationDimension.promptGuidance`, `Agent.systemPrompt`/`rules`, `EvaluationSettings.confidenceConfig`                                                                                                                                                                                                                                                                                                                                     | read projections strip for non-authoring roles (`listQuestions`, `listItems`, `listAgents`, `listEvaluationSettings`); gated by `rubric.guidance.read`/`item.readForEdit`                                                                |
| §6.8  | **Purchases/enrollment** — `consumerProfile.enrolledSpaceIds`, `PurchaseRecord`                                                                                                                                                                                                                                                                                                                                                                                                                                             | `purchaseSpace` only                                                                                                                                                                                                                     |
| §6.9  | **Denormalized counters/aggregates** — `Tenant.stats`/`usage`, `Space.stats`/`ratingAggregate`, `StoryPoint.stats`, `*ProgressSummary`, `StudentLevel`, `StudentAchievement`, leaderboards, `QuestionBankItem.usageCount`, `ChatSession.messageCount`, `Exam.stats`, `ExamAnalytics`, notification badge `unreadCount`, `StudyGoal.currentCount/completed`                                                                                                                                                                  | `recomputeSpaceStats`, `recompute{Student,Class}Summary`, `recomputeExamAnalytics`, `awardAchievements`, `upsertLeaderboardEntry`, `aggregateDailyCost`, `recomputeStudyGoalProgress`, `emitNotificationService`, `adjustTenantCounters` |
| §6.10 | **Lifecycle status transitions** — Space/Exam/Submission/Tenant/Membership/Announcement status, `resultsReleased` visibility gate                                                                                                                                                                                                                                                                                                                                                                                           | `saveSpace`, `saveExam`, `releaseResults`, `advancePipeline`, `deactivate/reactivateTenant`, `saveAnnouncement` (all `assertTransition`)                                                                                                 |
| §6.11 | **Cross-domain link integrity** — `classIds`/`parentIds`/`studentIds`/`teacherIds`, `linkedSpaceId`/`linkedStoryPointId`/`linkedItemId`/`linkedQuestionId` existence-validated in-tenant                                                                                                                                                                                                                                                                                                                                    | each `save*` service validates referents server-side before persisting links                                                                                                                                                             |
| §6.13 | **Storage paths** — exports, tenant assets, answer-sheet/question-paper/media reads per-path tenant+role+ownership                                                                                                                                                                                                                                                                                                                                                                                                          | `exportTenantData`, `uploadTenantAsset`, `uploadAnswerSheets` (validates path ⊂ `tenants/{ctx.tenantId}/`), `generateReport`                                                                                                             |
| AI    | **AI calls / Gemini keys / cost / quota** — per-tenant Secret Manager `tenant-{id}-gemini`, never in client bundle; quota hard pre-check. **`geminiApiKey` inbound (SEC-09):** `saveTenantService` consumes it → `secretManager.put(secretNameFor(tenantId))` → field **deleted from `input.data` before any repo write**; response returns only `geminiKeyRef`, never the key; gated behind the distinct `tenant.ai.key.write` action with mandatory audit; cost/quota stays server-enforced regardless of whose key it is | `@levelup/ai` gateway (`checkUsageQuota → getApiKey → provider.call → logLLMCall`); consumed by extract/grade/evaluate/chat/insights                                                                                                     |

Notification create (CF-only; recipient flips only own `isRead`) →
`emitNotificationService` / `markNotificationRead`. Announcement read-tracking
(owner-write `/reads/{uid}`) → `markAnnouncementRead`.

---

## 7. Build order (dependency-respecting)

1. **`@levelup/domain`** — primitives (19 brands, ISO Timestamp + `toTimestamp`
   edge adapter, Page/Money/Audit, enums, `ALLOWED_TRANSITIONS` data +
   `satisfies` assertion over all 9 machines), then entity schemas authored per
   **`sdk-plan/layers/domain-entities.md`** (the `.strict()` Zod SSOT — incl.
   the two-level `UnifiedItem.payload` real `z.discriminatedUnion`,
   `AnswerKeySchema` strip boundary, `effectiveRubric`/`rubricId`,
   `StoredEvaluationSchema` cost-stripped, `DigitalTestSessionSchema` with the
   `submissions/{itemId}` subcollection). Non-behavioral; unblocks everything.
   Replaces `shared-types`. **The four new layer plans —
   `sdk-plan/layers/{domain-entities,repositories,seed,security-rules}.md` —
   must exist and are authored alongside their build step (1, 6, 5/seed-test,
   and security-rules with api-contract/rules).**
2. **`@levelup/api-contract`** — error model first, then
   pagination/meta/rate-tiers, `CallableDef`+`transitions`, the 4 empty module
   barrels, `registry.ts` spread, `subscriptions/` (needs domain payload
   schemas), `Transport` interface. Contract tests (`no-tenant-id-in-request`,
   `registry-integrity`, `allowed-transitions-enum`).
3. **`@levelup/transport-firebase`** — `Transport` impl:
   invoke/subscribe/serverTimeOffset/refreshToken + `SUBSCRIPTION_SOURCES`. (the
   only client firebase site).
4. **`@levelup/api-client`** —
   errors→validate→idempotency→retry→offline→envelope/realtime→namespaces/create-client.
   Unblocks repositories.
5. **`@levelup/access` + `@levelup/ai` + `@levelup/repository-admin`**
   (parallel) → **`@levelup/services`** (server brain) →
   **`@levelup/functions-shared`** (adapters) → wire the 4 `functions/*`
   barrels. Emulator contract tests (authorize coverage, assertTransition,
   idempotency, claim-sync, AI cost, outbox atomicity, buildAuthContext).
   **Split into gated sub-phases (MERGE-MIGRATION-CUTOVER / M10):** 5a extract
   `onCall`→`fn(input,ctx)` behavior-preserving (tenantId via a ctx shim;
   emulator asserts identical output); 5b flip tenantId→claims per callable
   behind the dual-export window; 5c introduce single-writer/outbox/Cloud-Tasks
   invariants per derived value with double-fire tests; 5d consolidate the 4
   notification senders + the 4-writer recompute. The emulator contract suite
   must be green **per callable before its legacy alias drops**.
6. **`@levelup/repositories`** — per-entity repos + view repos (over
   api-client).
7. **`@levelup/query`** — ApiProvider, key factories, invalidation graph,
   defineMutation + optimistic recipes, error boundary, then per-domain hooks.
   `@levelup/offline` (noop seam) wired here.
8. **`@levelup/realtime`** — RealtimeProvider, useSubscription, useServerTime,
   per-sub hooks.
9. **`@levelup/offline`** — interface + NoopOfflineQueue (seam; real impl
   deferred).
10. **Wire apps** — 5 web + 3 RN: `transport → api → repos → ApiProvider`; drop
    direct `firebase` deps (R7/R8 enforce). Cross-cutting:
    `@levelup/build-config` (tiers.json, tsup presets, depcruise, RN-purity
    gate) + `@levelup/eslint-config` (boundary presets, 2 custom rules) land
    alongside step 1 and gate every subsequent step.

### 7.1 Live → v1 cutover mechanism (MERGE-MIGRATION-CUTOVER)

**Dual-export window.** Each service is exported under **BOTH** its bare legacy
deployed name and its `v1.*` name from the same `functions/*` index for one
dual-export release; a contract test asserts the legacy-alias map is
**exhaustive over the live deployed-name list**; bare names drop in a later
release. (The "dual-run is unnecessary / alias" hand-wave is removed.) The
**cutover unit** is a callable-group protected by the dual-export window, so
apps adopt v1 hooks one query at a time.

**Semantically-changed callables (M13).** Do NOT alias semantically-changed
callables. The legacy bare `evaluateAnswer` alias points at a
behavior-preserving (no progress-write) shim; only `v1.levelup.evaluateAnswer`
carries the server-side progress write. The closed set of callables requiring
atomic client adoption is documented.

**`shared-stores` / reactive auth.** Added to the migration inventory. Either
add a `v1.identity.meLive` subscription (firestore-doc on `/users/{uid}`
projecting `{activeTenantId,status,claimsVersion}`) so reactive
revocation/active-tenant survives, OR explicitly document (with security
sign-off, ties to SEC-05) that live auth-state is dropped and replaced by
`getMe` refetch on `switchActiveTenant`+token-expiry. `activeTenantId` flows via
the tenant-implicit query root + full `qc.clear()` on switch; all teacher-web
call sites drop the `tenantId` arg. The `shared-services` decomposition map (M9)
records where each piece goes (`auth`→authRepo/C3;
`firestore`→transport-firebase+repository-admin; `storage`→C1 storageRepo;
`realtime-db`→subscription sources; `ai`→`@levelup/ai`; `reports`→services;
`*-callables.ts`→delete; inline `*Request` types→api-contract) so nothing live
(RTDB leaderboard, chat-stream wiring) is lost in the delete.

**Data-migration runbook (M5/M7/M11).** A consolidated, ordering-aware at-rest
runbook enumerates D1 (dual-read nested-first/flat-fallback → idempotent
backfill incl. `answerKeys` with per-item marker → verify → flip nested-only →
delete fallback+flat rules last, keep flat docs N days), D3/D10/D12 (read
converters map legacy→canonical **before** the strict response schema;
`validateResponses` runs report-only during migration over a legacy-doc corpus),
D5/D6/D8/D11 + `isSuperAdmin` claim promotion + announcement reads — each with
idempotency key, rollback, and hard ordering vs (functions deploy, rules deploy,
client deploy); "delete legacy path/rule/field" is a separate post-verification
step.

### 7.2 Contract-tests + seed (T1, T2)

**Contract-tests (T1).** Per-callable `*.fixture.ts` (a valid request sample + a
named seed-state precondition). `registry-integrity.test.ts` **fails if any
callable lacks a fixture**. A single seeded "contract tenant" (deterministic
ids, per T2) backs every contract test, with documented write-before-read
ordering. The test loop is driven from `CALLABLE_NAMES`; response validation
uses `def.responseSchema.parse(liveResponse)` on emulator output.

**Seed (T2) — `sdk-plan/layers/seed.md`.** Config-keyed deterministic ids
(`seedId(kind,key)`→stable branded id, no randomness); idempotency =
upsert-by-stable-id with a re-run=no-op invariant + `seed.idempotency.test.ts`;
**claims built via the shared membership→claims path** (assert seed claims ===
`syncMembershipClaims` output for the same membership — no second
claim-builder); injected fixed clock; emulator-vs-prod env switch sharing one
write path; `seed.determinism.test.ts` snapshots the produced Firestore tree.

---

## 8. Cross-domain consistency notes & resolved drift

| Drift                                                          | Reconciliation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1 — dual item path**                                        | Single canonical nested `spaces/{s}/storyPoints/{sp}/items/{id}`; flat path + fallback branches deleted; one-time migration; orphan-on-delete fixed; halves answer-key reads. Invisible to SDK (behind `listItems`/`getItem`/`saveItem`; resolved in `repository-admin/paths.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **D2 — `tenantId` from body**                                  | Removed from **every** request schema; derived from `ctx.tenantId` (claims). The #1 boundary. Structurally enforced by the `no-tenant-id-in-request` contract test + `no-tenant-id-field` lint rule; super-admin `tenantOverride` only on `allowsTenantOverride` defs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **D3 — `uid` vs `authUid`**                                    | Canonical `authUid: UserId` on every tenant entity (Student/Teacher/Parent/Staff/Scanner); drop bare `uid`/`@deprecated uid`. Gamification stays on `userId: UserId` (student actor) — defers the schism to identity. Notification/announcement canonical `recipientUid`/`authorUid`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **D4 — timestamp trichotomy**                                  | One ISO-8601 `Timestamp` (branded string) everywhere above the storage edge; `toTimestamp()` edge adapter (domain) collapses `FirestoreTimestamp {seconds,nanoseconds}` / epoch-millis / Date / `{toMillis}` / `{_seconds,_nanoseconds}`. `repository-admin` is the single converter. RTDB badge `createdAt` stays epoch-ms — the one fenced exception (RTDB has no Timestamp). `zTimestampInput` (lenient) lint-confined to the admin adapter; `zTimestamp` (strict) in entities + wire responses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **D5 — soft-delete**                                           | One `archivedAt: Timestamp\|null` in `AuditFields` (no `deleted:boolean`, no `status:'deleted'`). `data.delete?=true` request convention maps to archive (except announcements which truly delete); entity status machines (`entityStatus`) are data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **D6 — record-maps / 1MB-doc risk (decided, MERGE-D6-FATDOC)** | `DigitalTestSession.submissions` → `submissions/{itemId}` subcollection (**always-subcollection, one code path**); `visitedQuestions`/`markedForReview` kept inline (small booleans). `StoryPointProgressDoc.items` → **per-item docs** (or a hard documented item-count cap). `SpaceProgress.storyPoints` → a **small bounded summary** (one numeric per story point, no nested per-item state, explicitly capped); the live listener targets a slim projection (`spaceProgressLive`). `chat.messages` → **always subcollection**. `Announcement.readBy[]` → `/reads/{uid}` subcollection (expose `isReadByMe`; **`readBy: UserId[]` removed from `AnnouncementSchema`** — CD8). A schema/contract assertion verifies progress/session/chat docs have **no unbounded array/map field**, against a concrete element-count/byte threshold (not "if large"). Analytics `questionAnalytics`/`byPurpose`/`byModel` bounded maps kept; summary recompute marker split out. Closes levelup-content open-Q #4. |
| **D7 — junctions vs FK arrays**                                | Denorm arrays (`Class.studentIds`/`studentCount`, parent↔child) are trigger-maintained **projections**, not source of truth; `onStudentArchived`/`onClassArchived` reconcile. Announcement readBy → subcollection (D6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **D8 — branded IDs**                                           | 19 brands authored **into** schemas via `zBrandedId` + `z.infer` (no evaporation); adds StaffId, ScannerId, ExamQuestionId, AnnouncementId, plus analytics/gamification/notification brands. `BRAND_TAGS.length===19` contract-tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **D9 — Zod-first `.strict()`**                                 | `zObject()` is the only object factory (always `.strict()`); types via `z.infer` (no hand-written interface). New schemas authored: Announcement, NotificationPreferences, Staff, Scanner, RubricPreset, ContentVersion, StudyGoal, StudySession, LeaderboardEntry, GamificationSummary, standalone UnifiedRubric/UnifiedEvaluationResult/ItemMetadata. Kills `.passthrough()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **D10 — parent→child naming**                                  | Canonical `parentLinkedStudentIds` on membership + `studentIds` on Parent + claim `studentIds`; drop `childStudentIds`. Parent access (`getChildSummary`/`listLinkedChildren`) enforced via `ctx.studentIds`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **D11 — scanner location**                                     | Unify to tenant-scoped `/tenants/{t}/scanners/{id}` with `authUid` + matching rule; delete top-level `/scanners`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **D12 — schema↔interface schism**                              | Notification → `recipientUid`; `authProviders` array (drop singular); ChatMessage.timestamp → ISO; Agent.rules → `string[]` + `isActive`; DigitalTestSession → `sessionType`/`serverDeadline`; uploadSource union closed to `web\|scanner\|rn` (drop `'gcs'` + GCS trigger).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **D13/D14 — index/rule/path schisms**                          | `spaceProgress` index keyed `userId` (not `studentId`); `costSummaries/{daily\|monthly}/{id}` flat; materialized analytics (summaries/examAnalytics/insights/costSummaries) callable-only access (rules default-deny, documented not accidental).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Rubric snapshot + id**                                       | Store **both** resolved `effectiveRubric` snapshot **and** source `rubricId`/`evaluationSettingsId` at write time (no grade-time settings re-read except ⚷ thresholds). SDK reads snapshot for display/preview only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **StoryPointType**                                             | Drop synonym `test`; keep `timed_test\|quiz\|practice\|standard`. Runtime `TestSessionType` collapsed to one value per concept via `storyPointTypeToSessionType()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Points/marks**                                               | Single authoritative `pointsEarned/totalPoints` from `progressUpdater`; `marksEarned/totalMarks` optional derived (`marks = points × weight`), never client-set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Naming schisms**                                             | `auditLogs` single collection; one membership representation `{uid}_{tenantId}`; single `adjustTenantCounters` helper; shared `SUBMISSION_PIPELINE_STATUSES`/`EXAM_STATUSES` enums imported (not re-declared); `notifyService` single badge writer shared by identity markRead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **4× duplicated notification-sender**                          | Collapsed into one `emitNotificationService` (single badge writer, prefs-aware, copy table) — the notification domain's headline cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Enum decisions**                                             | `'completed'` exam status dropped (unreachable); OCR statuses excluded by default (dead pipeline); `'gcs'` upload source dropped — all behind documented toggles, confirmed with autograde owners.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Carried open questions for the review team:** insights module ownership
(levelup vs analytics read/dismiss); `joinTenant` lazy student-doc creation; XP
curve config vs platform constant; leaderboard PII projection policy;
`discriminationIndex`/`topicPerformance` ship-real-or-omit; `useServerTime()` vs
`serverDeadline`-only (recommend thin hook). **Coverage-matrix plan gaps to
triage** (not blockers; functional fallbacks exist): assign-content callable +
availability-window fields, staff→student direct-message vs announcement,
`getSummary{scope:'class'}` `tenantRollup`/`masteryDistribution` sections, AI
content-generation callable, answer-sheet Storage byte-upload seam
(`storageRepo`), `authRepo` Firebase-Auth seam
(signIn/signOut/sendPasswordReset), `Class.schedule` field, super-admin platform
additions (`listPlatformActivity`, `setUserStatus`, `startImpersonation`,
`getPlatformConfig`/`savePlatformConfig`, `listGlobalEvaluationPresets`, tenant
feature-write split), `listExportJobs`, `uploadedBy` filter on
`listSubmissions`, `registerDeviceToken` push token, and the tenant-admin
self-service split on `saveTenant`.

---

## 9. Coverage-gate additions (GATE-1 closure → 100% UI coverage)

> These 31 capabilities (C1–C31) are the de-duplicated gap list from the GATE-1
> UI-coverage audit (`SDK-UI-COVERAGE-MATRIX.md`), which cross-checked all 271
> route nodes across the 8 apps against §2–§5 above. **They are now FOLDED into
> the §2–§5 registries (MERGE-C9-ORPHANED): each C1–C31 callable has a
> `CallableDef` (§3.2 fold-in note), an `INVALIDATION_GRAPH` entry if mutating
> (§4.3), an `ACCESS_RULES` action (§5.4), a repo/hook (§4.1/§4.2), and the
> Storage seam (§3.7). A `registry-integrity` test asserts `CALLABLES` ≡
> `common-api.md` both directions.** Verdict was **CONDITIONAL-PASS**; folding
> C1–C31 in makes the plan **100%-covering → PASS** (no longer an orphaned
> worklist). Each entry below names callable + repo + hook (+ subscription) and
> the owning service. **HARD** = blocks a screen's only path; **ENRICH** =
> working primary path exists; **PLATFORM** = net-new super-admin control-plane.
> All requests are `.strict()`, `tenantId` claim-derived (never in body),
> super-admin ops carry `tenantOverride`.

### 9.1 Hard blockers (must land first)

- **C1 — Storage byte-upload seam (`autograde` + transport).** Callable
  `v1.autograde.requestUploadUrl {kind:'answer-sheet'|'question-paper', examId, studentId?, classId?, contentType}`
  → `{uploadUrl, path: StoragePath, expiresAt}` (signed PUT; path ⊂
  `tenants/{ctx.tenantId}/…`; tenant+role+ownership scoped per §6.13). Repo
  `storageRepo.uploadImage(input)` / `requestUploadUrl(...)`. Hooks
  `useRequestUploadUrl()` / `useUploadImage()`. Transport-firebase adds the
  typed Storage adapter (the only client Storage site). Service
  `requestUploadUrlService` (validates path scope). **Never optimistic.**
  Unblocks scanner submit + web-teacher exam-image uploads.
- **C2 — Notification preferences (`identity`) — RECONCILE.** Already named in
  §2.1/§2.7; promote into `common-api §3.3`:
  `v1.identity.getNotificationPreferences {}` → `NotificationPreferences`;
  `v1.identity.saveNotificationPreferences {enabledTypes?, muteUntil?}` →
  `NotificationPreferences` (owner-scoped `userId=ctx.uid`, idem). Repo
  `notificationPreferenceRepo.get/save`. Hooks `useNotificationPreferences()` /
  `useSaveNotificationPreferences()`. Services
  `get/saveNotificationPreferencesService`. Resolves the
  `manageNotifications`-split open question on the side of explicit callables.

### 9.2 Enrich (working path exists; close for parity)

- **C3 — Auth seam `authRepo` (`identity`, transport auth-handle, not
  callables).** `authRepo.signIn({email,password})→AuthSession`, `.signOut()`,
  `.sendPasswordReset(email)`, `.onAuthState(cb)`/`restoreSession()`; hooks
  `useSignIn/useSignOut/useSendPasswordReset/useAuthSession`. Wraps Firebase
  Auth on the transport seam so no app imports `firebase/auth` (R7). Server
  already covered by `beforeSignIn`/`beforeUserCreated`.
- **C4 — Device-token registration (`identity`).**
  `v1.identity.registerDeviceToken {token, platform:'ios'|'android'|'web', appKey}`
  → `{ok}`; `unregisterDeviceToken {token}` → `{ok}`. CF-only doc
  `tenants/{t}/users/{uid}/devices/{token}`. Repo
  `deviceRepo.register/unregister`; hooks
  `useRegisterDeviceToken/useUnregisterDeviceToken` (not optimistic). Extend
  `emitNotificationService` fan-out to Expo/FCM push.
- **C5 — `Class.schedule` field (`identity`/domain).** Add
  `Class.schedule?: { days: DayOfWeek[], startTime, endTime, room? }` to
  `ClassSchema`; extend `v1.identity.saveClass.data` + `ClassDetailView`
  (`getClass`).
- **C6 — `getSummary{scope:'class'}` rollup (`analytics`, schema/shaping).** Add
  `tenantRollup:{academyAvg, perClass:{classId,name,avg,atRisk}[]}` +
  `masteryDistribution:{notStarted,inProgress,mastered}` to the class-scope
  response; `summaryRepo.getClass` shaping. No new callable.
- **C7 — `confidenceSummary` on `listExams` (`autograde`, projection).** Add
  `confidenceSummary:{low,med,high}` to `ExamListView`.
- **C8 — `estimateAudience` (`identity`).**
  `v1.identity.estimateAudience {targetRoles?, targetClassIds?}` →
  `{recipientCount}` (or dry-run count on `saveAnnouncement`);
  `announcementRepo.estimateAudience`; `useEstimateAudience()`.
- **C9 — `listExportJobs` + per-collection export (`identity`).**
  `v1.identity.listExportJobs {PageRequest}` → `pageResponse(ExportJob)`;
  `tenantRepo.listExportJobs`; `useExportJobs()`. Extend
  `exportTenantData.scope` → `collections: ExportCollection[]` (add
  `analytics`).
- **C10 — `bulkUpdateStatus` `'class'` + `changeMembershipRole` (`identity`).**
  Add `'class'` to `bulkUpdateStatus.entityType`. Optional
  `v1.identity.changeMembershipRole {uid,toRole,links?,idempotencyKey}` →
  `{membershipId,role}` (resyncsClaims; the `save*`-per-role pattern already
  covers it functionally).
- **C11 — tenant-admin `saveTenant` write split (`identity`).** Authorize a
  tenant-admin subset of `saveTenant` (branding/contact/features/geminiApiKey
  only) **or** add `v1.identity.saveTenantSettings {data}` → `SaveResponse`;
  `tenantRepo.saveSettings`; `useSaveTenantSettings()`. (Closest ENRICH to a
  hard block.)
- **C12 — `assignContent` + assignment window (`levelup`).**
  `v1.levelup.assignContent {contentType:'space'|'exam', contentId, classIds[], window?:{startAt?,dueAt?}, visibility?}`
  → `SaveResponse` (idem); add `assignedAt?`/`dueDate?` to the content↔class
  assignment; `assignmentRepo.assign`; `useAssignContent()`. Optional
  `v1.analytics.getAssignmentMatrix {classId}` projection for the tracker (else
  repo fan-out + client overdue flag).
- **C13 — AI generate-items (`levelup`, AI gateway).**
  `v1.levelup.generateContent {storyPointId, spec:{types[],count,difficulty?}, sourcePdfPath?}`
  → `{drafts: GeneratedItem[]}` (cost/quota/moderation; no auto-persist);
  `aiGenerationRepo.generateItems`; `useGenerateContent()` (not optimistic).
- **C14 — teacher→student message / intervention (`identity`).** Either document
  "message" = `saveAnnouncement{targetClassIds/targetRoles}` **or** add
  `v1.identity.sendDirectMessage {recipientUids[], title, body}` →
  `{sent,count}`; `messageRepo.send`; `useSendMessage()`. Optional
  `interventionState` field for "mark followed-up".
- **C15 — `saveExamQuestion` (`autograde`).**
  `v1.autograde.saveExamQuestion {examId, questionId?, data:{text?,maxMarks?,rubric?,subQuestions?}}`
  → `SaveResponse` (answer-guidance ⚷ projection on read);
  `examQuestionRepo.save`; `useSaveExamQuestion()`.
- **C16 — `getSubmissionForExam` (`autograde`).**
  `v1.autograde.getSubmissionForExam {examId, studentId?}` →
  `SubmissionDetailView | null` (released-gated; `studentId` defaults to self /
  must be in `ctx.studentIds` for parent); **or**
  `submissionRepo.getForExam(examId,studentId?)` view; `useExamSubmission()`.
- **C17 — `listSpaceProgressForUser` (`levelup`).**
  `v1.levelup.listSpaceProgressForUser {userId, PageRequest}` →
  `pageResponse(SpaceProgressView)` (parent gated `progress.readOther` +
  `studentId∈ctx.studentIds`); `progressRepo.listForUser`;
  `useChildSpaceProgress()`.
- **C18 — `listParentAlerts` (`analytics`).**
  `v1.analytics.listParentAlerts {PageRequest?}` →
  `pageResponse(ParentAlert{studentId,name,kind:'at_risk'|'low_score'|'low_streak',detail,createdAt})`
  (reads `ctx.studentIds`, batched); `parentRepo.listAlerts`;
  `useParentAlerts()`. (Else document the fan-out as accepted.)
- **C19 — `uploadedBy` filter on `listSubmissions` (`autograde`).** Add
  `uploadedBy?: UserId` to the filter (server defaults to `ctx.uid` for scanner
  role); `submissionRepo.list`/`useSubmissions` passthrough.
- **C20 — `getStoryPoint` single-read (`levelup`).**
  `v1.levelup.getStoryPoint {spaceId, storyPointId}` → `StoryPoint`;
  `storyPointRepo.get`; `useStoryPoint()`.
- **C21 — `saveTestAnswer` in-session persistence (`levelup`).**
  `v1.levelup.saveTestAnswer {sessionId, itemId, answer, markedForReview?}` →
  `{saved:true}` (write-through to `submissions/{itemId}` subcollection, idem,
  server-authoritative, **never optimistic**); `testSessionRepo.saveAnswer`;
  `useSaveTestAnswer()`.
- **C22 — `uploadUserAsset` avatar (`identity`).**
  `v1.identity.uploadUserAsset {kind:'avatar', contentType, bytesBase64}` →
  `{assetUrl}` (self-owned, writes `photoURL`/`consumerProfile`);
  `meRepo.uploadAvatar`; `useUploadUserAsset()`.
- **C23 — `deleteConsumerAccount` (`identity`).**
  `v1.identity.deleteConsumerAccount {confirm:true}` → `{scheduled:true}` (Auth
  user + consumerProfile soft-delete + revoke); `meRepo.deleteAccount`;
  `useDeleteConsumerAccount()`. Drop `getReceipt` (use embedded
  `purchaseHistory`; PDF via `generateReport{type:'receipt'}`).
- **C24 — `updateMyProfile` (`identity`).**
  `v1.identity.updateMyProfile {displayName?, photoURL?}` → `{ok}`;
  `meRepo.updateProfile`; `useUpdateMyProfile()`.

### 9.3 Platform (super-admin control-plane, net-new)

- **C25 — `listPlatformActivity` (`analytics`).**
  `v1.analytics.listPlatformActivity {action?, tenantOverride?, PageRequest}` →
  `pageResponse(PlatformActivityLog)`; `activityRepo.list`;
  `usePlatformActivity()` (super-admin read).
- **C26 — `setUserStatus` (`identity`).**
  `v1.identity.setUserStatus {uid, status:'disabled'|'active'}` → `{uid,status}`
  (revoke tokens, audit); `userSearchRepo.setStatus`; `useSetUserStatus()`
  (super-admin, never optimistic).
- **C27 — `sendPasswordReset` by uid (`identity`).**
  `v1.identity.sendPasswordReset {uid}` → `{sent:true}` (admin-initiated,
  audited; distinct from C3 self-serve); `userSearchRepo.sendPasswordReset`;
  `useAdminSendPasswordReset()`.
- **C28 — `startImpersonation` (`identity`).**
  `v1.identity.startImpersonation {targetUid, tenantOverride, reason}` →
  `{sessionToken, expiresAt}` (time-boxed, fully audited, constrained claims;
  def carries `allowsTenantOverride:true` — `tenantOverride` is the super-admin
  cross-tenant field, **never** a body `tenantId`, satisfying principle 4 / the
  `no-tenant-id-in-request` test); `userSearchRepo.startImpersonation`;
  `useStartImpersonation()` (super-admin, never optimistic, idem). Full
  hardening sub-spec in §3.7.1.
- **C28b — `endImpersonation` (`identity`).** `v1.identity.endImpersonation {}`
  → `{ended:true}` (revokes the impersonation session — calls
  `revokeRefreshTokens(targetUid)`, closes the ledger record; auto-expiry does
  the same at `expiresAt`); `userSearchRepo.endImpersonation`;
  `useEndImpersonation()` (never optimistic, idem). See §3.7.1.
- **C29 — Platform-summary shaping (`analytics`, schema).** Define
  `PlatformSummarySchema {kpis, growthSeries[], planDistribution, topTenants[], tenantComparison:{tenantId,name,users,exams,growthPct}[]}`;
  `summaryRepo` shaping. No new callable.
- **C30 — `saveTenantFeatures` + `bulkApplyTenantFeatures` (`identity`).**
  `v1.identity.saveTenantFeatures {tenantOverride, features}` → `SaveResponse`;
  `bulkApplyTenantFeatures {tenantIds[], featureKey, enabled}` →
  `{updated, errors[]}` (idem); `tenantRepo.saveFeatures`/`bulkApplyFeature`;
  `useSaveTenantFeatures()`/`useBulkApplyTenantFeature()`. (May fold single into
  `saveTenant{data:{features}}` if documented.)
- **C31 — presets list + platform config + AI budget (`identity`).**
  `v1.identity.listGlobalEvaluationPresets {status?, PageRequest}` →
  `pageResponse(GlobalEvaluationPreset)`; `v1.identity.getPlatformConfig {}` →
  `PlatformConfig{trialLength,supportEmail,branding,defaultFeatures,maintenanceMode,aiConfigPresent}`;
  `v1.identity.savePlatformConfig {data}` → `{saved:true}` (maintenance flag
  never optimistic); add `Tenant.subscription.aiBudgetUsd?` (written via
  `saveTenant`). Repos `presetRepo.list`/`platformConfigRepo.get/save`; hooks
  `usePresets()`/`usePlatformConfig()`/`useSavePlatformConfig()`.

### 9.4 Recorded decision (deferred, not a GATE-1 blocker)

- **`@levelup/offline` durable queue (scanner G3).** The scanner
  Queue/offline-submit need a real durable job store; v1 ships `OfflineQueue`
  interface + `NoopOfflineQueue` only. **Decision to record:** (a) promote a
  minimal SQLite/MMKV impl for `mobile-scanner` that replays
  `useUploadAnswerSheets` with the existing `idempotencyKey`, **or** (b) scope
  the queue as app-local state in `mobile-scanner` (not an SDK capability). The
  retry **callable** is covered by C1 + `uploadAnswerSheets`; only the durable
  store is deferred. Online happy path is unblocked once C1 lands.

**Registry/lint impact:** C1–C31 add ~24 callables + 1 subscription-free Storage
seam to `CALLABLES`; each mutating callable needs an `INVALIDATION_GRAPH` entry
and a `@levelup/access` `ACCESS_RULES` action; C2/C5/C7/C9/C12 touch domain
schemas (`NotificationPreferences` promote, `Class.schedule`,
`ExamListView.confidenceSummary`, `ExportCollection`, assignment fields); C6/C29
are pure `analytics` response-shape extensions; C3 is a transport-auth seam (no
callable). None violate the trust-layered DAG or the conservative-optimistic
allow-list (C1/C2/C21/C26/C28/C31-maintenance are explicitly never-optimistic).

---

## 10. Review resolutions applied

The following ACCEPT-FIX resolutions from `SDK-PLAN-REVIEW.md` were applied to
this master plan:

- **MERGE-REALTIME-AUTHORITY** (BLOCKER) — §3.3 rewritten: all 9 subscriptions
  target server-maintained slim projections; `SubmissionStatusSchema` drops
  summary/score/grade/percentage until `resultsReleased`; single
  `examGradingProgress` aggregate doc; `spaceProgressLive` verifies
  `userId∈ctx.studentIds`; subscription authority invariant + realtime tests
  added; SUBSCRIPTIONS(9)⊇SOURCES reconciled (added
  `studentLevelLive`/`achievementUnlock`, canonical `leaderboardLive`);
  Firestore+Storage rules promoted to in-scope `security-rules.md` (§1.1 tree
  updated).
- **MERGE-C9-ORPHANED** (BLOCKER) — §3.2 fold-in note lists every C1–C31
  callable by module; §3.7 Storage seam (`StorageTransport`, signed-PUT-URL,
  path grammar/predicates, TTL≤10min); §4.1/§4.2/§4.3/§5.4 gained the C1–C31
  repos/keys/invalidations/actions; §9 intro reframed as folded (not orphaned);
  `CALLABLES≡common-api.md` contract test added.
- **MERGE-DOMAIN-ENTITIES** (BLOCKER) — §7 step 1 + §2.2/§2.3 cite
  `sdk-plan/layers/domain-entities.md` for two-level `UnifiedItem.payload`,
  `AnswerKeySchema` strip, `effectiveRubric`/`rubricId`,
  `StoredEvaluationSchema`, `DigitalTestSessionSchema`; legacy-items
  needs-migration state noted in §7.1 runbook (M8).
- **MERGE-TRANSITIONS** (BLOCKER) — §3.6 canonical enum tuples
  (`TEST_SESSION_STATUSES`, `TENANT_STATUSES` 5-member); 9 machines authored;
  announcement `archived→[draft]`; D5 reconcile; parameterized
  `transitions.assertion.test.ts`.
- **CD4** (BLOCKER) — §2.2/§2.3 entities: `evaluateAnswer`/submit per-item
  return `StoredEvaluation` (cost-stripped); `UnifiedEvaluationResult` is ⚷
  server-internal, never a client response; contract test noted.
- **MERGE-IDEMPOTENCY** (BLOCKER) — §3.1
  `idempotencyKey:'transport'|'domain:<fields>'` hint +
  no-`idempotencyKey`-in-schema test; §3.4 `IDEMPOTENCY_CONFLICT` wired; §5.5
  atomic `idempotency.begin/commit` Firestore transaction + exactly-once test.
- **MERGE-DOMAINNAME** (BLOCKER) — §4.2 `DomainName` made exhaustive (~16
  missing roots + C1–C31 roots added); `childrenKeys` renamed (DX-2);
  subscription→query-key mapping + single `useSubscription` (A10/DX-15);
  totality tests against real inventory.
- **MERGE-SINGLE-WRITER** (BLOCKER) — §5.3 redefined single-writer as serialized
  writes with per-value mechanism (progressUpdater `tx()`, session-grading
  reducer, recomputeOrchestrator dedupe, submit-vs-expire claim, single
  leaderboard writer); `triggers-async.contract.test.ts`.
- **MERGE-MIGRATION-CUTOVER** (BLOCKER) — §7.1 dual-export window + exhaustive
  alias test; 5a–5d sub-phase split (§7 step 5);
  shared-stores/`meLive`/`shared-services` map; semantically-changed
  `evaluateAnswer` not aliased; data-migration runbook.
- **T1** (BLOCKER) — §7.2 contract-tests: per-callable `*.fixture.ts`,
  `registry-integrity` fails on missing fixture, contract-tenant,
  `CALLABLE_NAMES`-driven loop, `responseSchema.parse`.
- **T2** (BLOCKER) — §7.2 cites `sdk-plan/layers/seed.md`: deterministic
  `seedId`, upsert idempotency, shared membership→claims path, fixed clock,
  determinism snapshot.
- **MERGE-OUTBOX-DRAIN** (MAJOR) — §5.3 concrete outbox worker (onCreate/sweep,
  backoff, dead-letter, attempts==3 test); platform-announcement fan-out to
  paginated Cloud Tasks; tenant-scope single outbox fan-out.
- **MERGE-INVALIDATION-COARSE** (MAJOR) — §4.3 fanout suppresses coarse root;
  list/infinite/detail kinds; high-churn-root test; typed `defineRule<N>`
  required.
- **MERGE-PAGINATION** (MAJOR) — §4.1 every list paginated or bounded-allow-list
  with cap; `getClass` counts+first page; chat always-subcollection +
  `PageRequest`; `total` from counter not `.count()`.
- **MERGE-D6-FATDOC** (MAJOR) — §8 D6 hedges decided: per-item progress docs,
  bounded `SpaceProgress.storyPoints`, always-subcollection chat, `readBy[]`
  removed (CD8), no-unbounded-field assertion.
- **MERGE-REPOSITORIES-PLAN** (MAJOR) — §4.1 cites
  `sdk-plan/layers/repositories.md`: naming convention,
  View-types-in-api-contract, view lint snippet, `createRepositories(api)` fake
  seam + matrix, server-side in-chunking (DX-14), in-memory/emulator conformance
  suite (T6).
- **DX-5** (MAJOR) — §4.5 `save*` metadata-only; explicit lifecycle verbs
  (`publishSpace`/`archiveSpace`/`publishExam`) or
  `discriminatedUnion('op',...)`.
- **DX-8** (MAJOR) — §4.5 raw `useApiClient` only via `@levelup/query/unsafe` +
  `no-raw-api-in-hooks` lint.
- **MERGE-NOTIF-FACADE** (MAJOR) — `manageNotifications` deleted from
  §2.1/§2.7/§3.2; 5 split callables canonical; removed from §8 open-Qs.
- **SEC-05** (MAJOR) — §5.4 token-revocation: `revokeRefreshTokens` in same
  tx/outbox unit as claim rewrite + test #11; `tokensValidAfterTime` rules
  check; synchronous revoke on most-sensitive actions.
- **SEC-09** (MAJOR, folded with SEC-05) — §6 AI row: `geminiApiKey` stripped
  before repo write, `geminiKeyRef`-only response, `tenant.ai.key.write` gated
  action with audit.
- **MERGE-IMPERSONATION** (MAJOR, SEC-04/UC-12) — **APPLIED §3.7.1 + §9.3
  C28/C28b**: `tenantOverride` (not `tenantId`) field +
  `allowsTenantOverride:true` (CONV-1); constrained claim set (`isSuperAdmin`
  forced false, nested-impersonation denied, time-boxed `expiresAt`);
  `ImpersonationAudit` synchronous+transactional with token mint (fail-closed);
  impersonation-session ledger; `endImpersonation`/auto-expiry call
  `revokeRefreshTokens(targetUid)`; `user.impersonate.start|end` ACCESS_RULES
  (§5.4) + `→{userSearch}` invalidations (§4.3).
- **UC-7** (MAJOR) — **APPLIED §9.2 C21 + §3.2 + §4.4 + §8 D12.**
  `saveTestAnswer {sessionId,itemId,answer,markedForReview?}` write-through to
  `submissions/{itemId}` subcollection, idem, server-authoritative, never
  optimistic; CD5 reconciled — `submitTestSession {sessionId,autoSubmitted?}`
  (write-through model wins; no `submissions` map in the submit request).
- **UC-8** (MAJOR) — **APPLIED §9.2 C12/C13 + §3.2 levelup fold.**
  `generateContent` (AI quota/cost/moderation, `aiGenerationRepo`, no
  auto-persist) added to levelup + §6 AI; `assignContent` shape decided
  (junction window `{startAt?,dueAt?}` + `assignmentRepo`, ACCESS_RULES
  `content.assign`).
- **UC-4** (MAJOR) — **APPLIED §9.2 C3 + §7.1.** C3 auth seam reclassified to a
  hard boundary requirement (apps off `firebase/auth` under R7); `authRepo`
  named in the transport seam and `shared-services` decomposition map.
- **MERGE-PARENT-GATE** (MAJOR, UC-6) — **APPLIED §5.4 + §9.2 C16/C17/C18.**
  `progress.readOther`/`submission.readReleased`/`child.read` actions gated
  `studentId∈ctx.studentIds` + released/visibility conjunction; parent-role
  answer-key/guidance strip; contract test for the parent-ownership ×
  released-gate intersection noted.
- **CD7** (MAJOR) — **APPLIED §8 (Rubric snapshot + id row) + §2.2.** Snapshot
  field standardized to `effectiveRubric?: UnifiedRubric` (paired with
  `rubricId?`/`evaluationSettingsId?`); bare `rubric` reserved for
  `RubricPreset.rubric`.
- **CD8** (MAJOR) — **APPLIED §8 D6 + §2.7.** `readBy: UserId[]` removed from
  `AnnouncementSchema`; read state lives in `/reads/{uid}` surfaced as derived
  `isReadByMe`.
- **CD13** (MAJOR) — **APPLIED §3.2 + §4.1 + §4.4 (CONV-3).**
  `recordItemAttempt {spaceId,storyPointId,itemId,answer,idempotencyKey}` →
  `{progress:ItemProgressView,completed}` (server scores, no client
  `score`/`correct`); repo `progressRepo.recordAttempt`; optimistic recipe
  reconciles via `setQueryData` from the authoritative response (A11).
- **A10** (MAJOR) — **APPLIED §3.3 + §4.2.** One `useSubscription`; each of the
  9 subs declares a `targetKey`; subscriptions write the same
  `*.detail(id)`/`sub(...)` key the REST read populates; `onSynced` gates the
  first write; server stream wins over optimistic.
- **A11** (MINOR) — **APPLIED §3.2/§4.1/§4.4.** `recordItemAttempt` reconcile
  reads the mutation response's authoritative `{progress}` and `setQueryData`s
  directly (not invalidate-refetch); best-score-retention test noted.
- **DX-2** (MAJOR) — **APPLIED §4.2.** Analytics parent-children factory renamed
  `childrenKeys` (disambiguates the second `parentKeys`); duplicate-callable
  disambiguation (one canonical owning module / distinct op names) +
  overlapping-request-schema contract test noted.
- **DX-10** (MINOR) — **APPLIED §4.4 + query-infra.** First-class optional-read
  (`useOptionalQuery`/`soft:true`); `defineMutation` default
  `onError`→`notify.error` unless `silent:true`.
- **DX-11** (MINOR) — **APPLIED §3.2.** Canonical
  `SaveResponse={id,created:boolean,archived?:boolean}`; `save*`
  name⇒`SaveResponse` contract test noted.
- **DX-12** (MINOR) — **APPLIED §7 step 10.** `ApiProvider` always owns
  `QueryClientProvider` (no auto-detect); apps drop their own provider in
  step-10 migration.
- **T5** (MAJOR) — **APPLIED §5.4.** Per-rule policy table-test driven from
  `ACCESS_RULES` (positive + each disqualifying-ctx negative, parent-gating +
  guidance-leak rows); `system-context.test.ts` asserting `SystemContext` cannot
  cross tenants.
- **T7** (MAJOR) — **APPLIED §7 + §1.1.** CI matrix folds every named gate
  (RN-purity, depcruise, `no-tenant-id-in-request`,
  `no-optimistic-on-authority`, `registry-integrity`,
  `allowed-transitions-enum`, `authority-flag-coverage`, per-layer
  `__contract__`, seed determinism, lint RuleTester) generated from the layer
  plans' required-tests sections.
- **T8** (MAJOR) — **APPLIED §3.6 / contract-tests.** no-tenantId walker uses
  full recursion + cycle guard (not `depth<2`),
  `ZodDefault/Catch/Pipeline/Readonly/Branded/Lazy` cases, rejects `ZodRecord`
  request fields, planted-depth-3 self-test + Zod-version pin.
- **T9** (MAJOR) — **APPLIED §3.1 (CONV-4).** Flag unified to
  `authoritySensitive`; `AUTHORITY_CALLABLES` regenerated from live `CALLABLES`;
  `authority-flag-coverage.test.ts` asserts every ⚷ callable is flagged.
- **T11** (MINOR) — **APPLIED §7 + lint-boundaries.md.** RN-purity single
  normative spec; checked-package set driven from `tiers.json`; meta-test that
  every pure-tier package is covered.
- **SEC-06** (MINOR, doc-only) — **APPLIED §2.1/§9** (lookupTenantByCode).
  Re-labeled "minimized, residual enumeration accepted"; public tier per-IP with
  low ceiling+backoff; hit/miss response time/shape equalized.
- **SEC-07** (MINOR) — **APPLIED §3.1 + §5.4.** `tenantOverride` audit
  synchronous+fail-closed; whitelist derived from the declarative
  `allowsTenantOverride:true` flag; R11 asserts the field⇔flag⇔super-admin-only
  biconditional.
- **SEC-08** (MINOR, doc/test-only) — **APPLIED §4.4 (CONV-4).** Closed
  `OPTIMISTIC_COUNTER_ALLOWLIST = ['unreadCount','unseenCount']` + test
  asserting no progress/score/points/rank/purchase counter is in it.
- **SEC-10** (MINOR) — **APPLIED §4.2 + §3.3.** Logout added to the `qc.clear()`
  contract (clear on any auth-state transition); test that no `EDIT_ITEM_SCOPE`
  key survives sign-out; invariant test that no subscription payload/Storage
  object holds answer-key/guidance fields.
- **CD12** (MINOR) — **APPLIED §8 D2 + §6.1.** `tenantId` (via `TenantScoped`)
  kept on persisted Exam/Submission/QuestionSubmission as a server-written field
  (D2 forbids it only in the request body); `staleSubmissionWatchdog` filters
  collection-group results by `tenantId`.
- **CD15** (MINOR) — **APPLIED §8 (Naming schisms) / SDK-SERVER cross-ref.**
  SDK-SERVER §1.1 "17"→"19"; `AuthContext.tenantId` canonical (drop
  `activeTenantId`); common-api §4.3 updated.
- **PC-7** (MINOR) — **APPLIED §6.9 / analytics.**
  `teacherUids`/`parentUids: UserId[]` added to `StudentProgressSummary`,
  trigger-owned projections (`onMembershipWritten`/class-assignment),
  chunked-`in` batching.
- **PC-8** (MINOR) — **APPLIED §2.5/autograde.**
  `studentName`/`rollNumber`/`classId` denormalized at `uploadAnswerSheets` as
  documented point-in-time snapshots (one model picked).
- **PC-9** (MINOR) — **APPLIED §2.6 / analytics (PC-9).** `platformMetrics`
  rollup doc written by a scheduler;
  `getSummary{scope:'platform'}`+`tenantComparison` served from it; `.count()`
  only as same-day top-up; cached aggressively.
- **PC-11** (MINOR) — **APPLIED §4.2 staleTime convention.** Per-domain
  `staleTime` overrides (summaries/trends/platform/cost = 5–10 min; exam
  analytics until `resultsReleased`); 30s reserved for entity lists.
- **PC-14** (MINOR) — **APPLIED §4.1.** Server composite callables for genuine
  1+N dashboard views (`getSpaceDetail`); any view repo issuing O(N) callables
  is a flagged violation.
- **PC-15** (MINOR, folded into MERGE-REPOSITORIES-PLAN) — **APPLIED §4.1.**
  Client `getMany` calls the batched read callable; the 10/30-id `in`-chunking
  lives server-side in `repository-admin`.
- **M9** (MINOR) — **APPLIED §7.1.** `shared-services` decomposition map
  (`auth`→authRepo/C3; `firestore`→transport-firebase+repository-admin;
  `storage`→C1 storageRepo; `realtime-db`→subscription sources;
  `ai`→`@levelup/ai`; `reports`→services; `*-callables.ts`→delete; inline
  `*Request`→api-contract).
- **MERGE-MIGRATION-PARITY** (MAJOR, M4/M5/M7/M11) — **APPLIED §7.1.** Per-read
  parity rows (live hook→constraints→rule predicate→server
  `authorize`+projection+sort/pagination+parity assertion) hard-gated before
  deleting a hook; D1 named runbook (dual-read→backfill→verify→flip→delete);
  read converters map legacy→canonical before strict response
  (`validateResponses` report-only); consolidated ordering-aware data-migration
  runbook.
- **UC-5** (MINOR, doc-only) — **APPLIED §9 intro.** Coverage tally counting
  unit defined once; route-node vs shell columns separated; headline re-derived
  (verdict no longer rests on figures that don't add up).
- **UC-9** (MINOR, decision) — **APPLIED §9.4 recorded decision.** Scanner
  offline-queue v1 = minimal `OfflineQueue` replaying `useUploadAnswerSheets`
  with the existing idempotencyKey; coverage rows marked accordingly.
  (Durable-queue impl itself is DEFERRED — see A12 below.)
- **UC-10** (MINOR) — **APPLIED §9.1 C4 + §2.7.** `registerDeviceToken` assigned
  to `identity`; `deviceRepo.register/unregister`+hooks;
  `emitNotificationService` push fan-out (FCM/Expo resolution, dedup,
  prune-on-unregister, per-platform).
- **UC-11** — **REJECTED (no finding).** §216 open-question flipped to a closed
  statement referencing query-infra §4.3 + the SEC-10 invariant test
  (`EDIT_ITEM_SCOPE`, `gcTime:0`, `isSensitiveKey` persist-rejection); no
  separate change.
- **A9** (MINOR, doc-only) — **APPLIED §3.3/§6.6.** Streamed server-computed
  `remainingMs` is the authoritative display source; `useServerTime()` only
  interpolates; `/.info/serverTimeOffset` documented as an estimate; grading
  uses `ctx.now()` only.

**DEFERRED (post-freeze, ACCEPT-DEFER — tracked, recorded in §8 carried
open-questions so not silently dropped):**

- **DX-3** (add-a-callable runbook/codegen) — **DEFERRED**, ticket SDK-DX-3:
  ship `CONTRIBUTING-callable.md` + optional `pnpm new:callable` after freeze;
  contract tests already fail-closed on missing steps.
- **PC-6** (per-child `getChildSummary` N+1) — **DEFERRED**, ticket SDK-PC-6: a
  `getChildrenSummaries` batched endpoint after freeze; 4 parallel callables
  acceptable for v1.
- **PC-10** (`getPerformanceTrends` rollup doc) — **DEFERRED**, ticket
  SDK-PC-10: on-the-fly acceptable for v1 bounded by range/granularity + bucket
  cap + raised staleTime (the bounding parts are APPLIED under PC-11);
  rollup-doc promotion defers, `recomputeOrchestrator` the eventual maintainer.
- **DX-7** (hook-naming exceptions) — **DEFERRED**, ticket SDK-DX-7: pick
  `use<Noun>Live` etc. and apply mechanically during per-domain hook authoring;
  cosmetic.
- **DX-13** (list vs infinite ergonomics) — **DEFERRED**, ticket SDK-DX-13:
  mutations invalidate at root (covers both); speculative `list`/`infinite`
  split simplified later when a consumer needs it.
- **A12** (offline durable queue contract) — **DEFERRED**, ticket SDK-A12: v1
  ships the `NoopOfflineQueue` seam; day-1 idempotency keys (APPLIED under
  MERGE-IDEMPOTENCY + C1) are the only must-be-right-now part; durable impl +
  ordering/conflict contract defers with the UC-9 recorded decision.

**Ledger integrity statement.** Every ACCEPT-FIX resolution in
`SDK-PLAN-REVIEW.md` §3/§4 now carries an explicit **APPLIED (section)** or
**DEFERRED (ticket)** status above; the six ACCEPT-DEFER items are recorded as
DEFERRED-with-ticket and surfaced in §8 carried open-questions. The §10 ledger
does not claim convergence beyond what the body reflects (CONV-5).
