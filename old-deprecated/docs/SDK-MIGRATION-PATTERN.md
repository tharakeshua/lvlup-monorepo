# Web App → @levelup/query SDK Migration — Canonical Pattern

> Hand this to every web-app migration. The 3 mobile apps
> (mobile-student/teacher/admin) are the **reference implementation** — they are
> 100% on @levelup/query. Copy their pattern.

## Target architecture

apps (lean UI) → **@levelup/query** → @levelup/repositories →
@levelup/api-client → @levelup/transport-firebase → @levelup/api-contract (SSOT
seam w/ Backend) → @levelup/domain

Apps must NOT touch `firebase/firestore` directly except inside the SDK
composition root.

## Step 1 — package.json deps

ADD (workspace:\*): `@levelup/query`, `@levelup/api-client`,
`@levelup/repositories`, `@levelup/transport-firebase`, `@levelup/domain`,
`@levelup/api-contract`. REMOVE once unused: `@levelup/shared-hooks`,
`@levelup/shared-stores`, and the legacy parts of `@levelup/shared-services` you
replace. (Keep `@levelup/shared-ui` / `@levelup/shared-utils` for now unless
your app brief says otherwise — UI is not part of this migration.) **DO NOT run
`pnpm install` yourself** — the Frontend-Lead runs ONE consolidated install to
avoid concurrent-install corruption in the shared worktree. The SDK deps are
PRE-STAGED for you.

## Step 2 — SDK composition root (src/sdk/), copy from apps/mobile-student/src/sdk/

- `firebase.ts` — `getFirebaseServices()`. WEB DIFF vs mobile: use
  `getAuth(app)` (browser persistence) instead of
  `initializeAuth(app,{persistence:getReactNativePersistence(...)})`; no
  AsyncStorage. Keep emulator wiring if your app uses emulators.
- `api.ts` — `getSdk()`: `createFirebaseTransport(services)` →
  `createApiClient(transport)` → attach
  `createFirebaseAuthHandle(services.auth)` → `createRepositories(api)`. Returns
  `{transport, api, repos}`.
- `SdkProvider.tsx` — mounts
  `<ApiProvider api={api} repos={repos} transport={transport} notify={notify} isDev={import.meta.env.DEV} queryClientOptions={{throwReadErrorsToBoundary:false}}>`.
  WEB DIFF: `notify` adapter wraps your existing web toast (e.g. `sonner`)
  instead of RN `Alert`.
- App entry (`main.tsx`/`App.tsx`): wrap the tree in `<SdkProvider>`. **Remove
  the app's own `QueryClientProvider`** — ApiProvider owns the QueryClient.

## Step 3 — replace data access in pages/hooks

OLD: `import {useAuthStore} from '@levelup/shared-stores'` +
`useQuery({queryFn: () => getDocs(...)})` NEW:
`import {useStudents, useClasses} from '@levelup/query'` →
`const {data,isLoading,isError,refetch}=useStudents()`.

- Delete direct `firebase/firestore` imports
  (`getDoc/getDocs/onSnapshot/query/where`) from pages & app hooks.
- Hook `data` is typed `unknown` in mobile usage — read defensively or cast via
  domain types.
- States: `isLoading`→skeleton, `isError`→error+retry, else render. Don't
  swallow `isError` as empty.

## @levelup/query exported hooks (by domain) — use these names

- **identity**: useMe, useSwitchTenant, useJoinTenant, useTenants, useTenant,
  useLookupTenantByCode, useSaveTenant, useDeactivateTenant,
  useReactivateTenant, useExportTenantData, useStudents, useStudent,
  useSaveStudent, useTeachers, useTeacher, useSaveTeacher, useParents,
  useParent, useSaveParent, useStaff, useSaveStaff, useClasses, useClass,
  useSaveClass, useAcademicSessions, useSaveAcademicSession, useRolloverSession,
  useCreateOrgUser, useBulkImportStudents, useBulkImportTeachers,
  useBulkUpdateStatus, useNotifications, useMarkNotificationRead,
  useMarkAllNotificationsRead, useNotificationPreferences,
  useNotificationBadgeQuery, useSaveNotificationPreferences,
  useNotificationCenter, useNotificationBadge, useAnnouncements,
  useSaveAnnouncement, useMarkAnnouncementRead, useSearchUsers
- **autograde**: useExams, useExam, useSaveExam, useExtractQuestions,
  useReleaseResults, useExamQuestions, useReExtractQuestion, useSubmissions,
  useSubmission, useUploadAnswerSheets, useQuestionSubmissions, useGradeManual,
  useRetryGrading, useAiGradeQuestion, useEvaluationSettings,
  useSaveEvaluationSettings, useDeadLetterEntries, useResolveDeadLetter,
  useExamAnalytics, useGradingReviewBundle, useExamGradingOverview,
  useGradingStatus, useExamGradingProgress
- **analytics**: useClassSummary, usePlatformSummary, useHealthSummary,
  useInsights, useCostSummary, usePerformanceTrends, useLinkedChildren,
  useChildSummary, useLeaderboard, useLeaderboardLive, useGenerateReport
- **gamification**: useGamificationSummary, useStudentLevel,
  useAchievementCatalog, useStudentAchievements, useLeaderboardSnapshot,
  useStudyGoals, useStudySessions, useGamificationLeaderboardLive,
  useAchievementUnlockStream, useStudentLevelLive, useMarkAchievementsSeen,
  useSaveStudyGoal, useArchiveStudyGoal, useSaveAchievementDefinition
- **levelup-content**: useSpaces, useSpace, useSpaceDetailView, useStoryPoints,
  useItems, useItemForEdit, useVersions, useQuestionBank, useRubricPresets,
  useAgents, useStoreSpaces, useStoreSpace, useSpaceReviews, useChatSessions,
  useChatSession, useSaveSpace, useSaveStoryPoint, useSaveItem,
  useImportFromBank, useSaveAgent, useSaveRubricPreset, useSaveQuestionBankItem,
  useSendChatMessage, useSaveSpaceReview, usePurchaseSpace, useChatStream,
  useServerTime
- **testsession-progress**: useSpaceProgress, useStoryPointProgress,
  useTestSession, useTestSessions, useLearningInsights, useStudentSummary,
  useStartTestSession, useSubmitTestSession, useEvaluateAnswer,
  useRecordItemAttempt, useDismissInsight, useTestSessionDeadline
- **infra/error**: ApiProvider, useApi, useRepos, useApiClient, useTransport,
  useNotify, useApiError, ApiErrorBoundary, useSubscription,
  resetForTenantSwitch (call on tenant switch to flush cache)

## KNOWN PARITY GAPS — flag to Frontend-Lead, do NOT silently drop

- `usePrefetch` (super-admin, admin-web, student-web, parent-web): NO query
  equivalent. Replace hover-prefetch with TanStack `queryClient.prefetchQuery`
  using the domain `*Keys` factory, OR drop prefetch.
- `useDuplicateSpace` (teacher-web): NO equivalent. Needs a backend callable or
  app-level compose; escalate.
- `useRealtimeDB` (student-web): RTDB (not Firestore). Migrate to
  `useSubscription` or keep as a thin app-local adapter; escalate if unclear.
- `useTenantBranding` (student-web, parent-web): gap — likely still in
  shared-services; keep using shared-services for branding only, or escalate for
  a query hook.
- `useQuotaStatus` (admin-web): gap — quota/billing not in query; keep
  shared-services for it, or escalate.

## Reference files

- packages/query/src/index.ts (full export surface)
- apps/mobile-student/src/sdk/{firebase,api,SdkProvider}.tsx (composition root)
- apps/mobile-student/src/screens/home/HomeScreen.tsx,
  learn/SpacesListScreen.tsx (consumption)
- packages/api-contract/src/index.ts (SSOT seam)

## Gate (each owner verifies before reporting DONE)

1. `pnpm --filter <app> exec tsc --noEmit` → 0 errors
2. `pnpm --filter <app> build` (vite) → exit 0
3. `grep -r "@levelup/shared-hooks" src | wc -l` → 0 (and direct
   firebase/firestore in pages → 0)
