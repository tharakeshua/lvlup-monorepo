# STATUS REPORT — `apps/student-web`

Audited at commit `15035e7` (branch `feat/teacher-portal-latex-rendering`). All
paths relative to repo root `/Users/subhang/Desktop/Projects/auto-levleup`.

The student-web app is the learner-facing PWA. It serves **two distinct
audiences from one codebase**: B2B school students (tenant-scoped, role
`student`) and B2C "consumer" learners (self-serve, no tenant membership, served
from a synthetic `platform_public` tenant). It is a Vite + React 18 + TypeScript
SPA that consumes the workspace `@levelup/*` packages and talks to Firebase
(Auth, Firestore, RTDB) + Cloud Functions callables.

---

## 1. What exists & how it's architected

### Stack

- Vite 5 + `@vitejs/plugin-react-swc`, React 18.3, react-router-dom 7, TanStack
  Query 5, Zustand (via `@levelup/shared-stores`), Tailwind 3, `firebase` v11,
  `sonner` toasts, `next-themes`. PWA assets (`public/sw.js`,
  `public/manifest.json`, `public/offline.html`). See
  `apps/student-web/package.json`, `apps/student-web/vite.config.ts`.
- Depends on workspace packages: `@levelup/shared-types`, `shared-services`,
  `shared-hooks`, `shared-stores`, `shared-ui`, `shared-utils`.

### Routing & shell (`src/App.tsx`)

- All pages lazy-loaded with `Suspense`/`PageLoader`; every route wrapped in
  `RouteErrorBoundary`.
- Three layouts: `AuthLayout` (login), `AppLayout` (B2B student shell),
  `ConsumerLayout` (B2C shell).
- **Guard** `src/guards/RequireAuth.tsx`: checks `firebaseUser` + (optionally)
  `currentMembership.role` against `allowedRoles`. Consumer fallback: users with
  no membership are redirected from B2B routes to `/consumer`.
- B2B route tree (role `student`): `/` dashboard, `/spaces`, `/spaces/:spaceId`,
  `/spaces/:spaceId/story-points/:storyPointId`,
  `/spaces/:spaceId/test/:storyPointId`, `.../test/:storyPointId/analytics`,
  `.../practice/:storyPointId`, `/exams/:examId/results`, `/notifications`,
  `/leaderboard`, `/tests`, `/settings`, `/profile`.
- B2C route tree (no role): `/consumer`, `/my-spaces`, `/consumer/spaces/...`
  (shares
  `SpaceViewerPage`/`StoryPointViewerPage`/`TimedTestPage`/`PracticeModePage`),
  `/store`, `/store/checkout`, `/store/:spaceId`, `/profile`.

### App bootstrap (`src/App.tsx`)

- `useAuthStore.initialize()` subscribes to Firebase auth;
  `useTenantStore.subscribe(currentTenantId)` applies tenant branding. Auth
  state lives in `packages/shared-stores/src/auth-store.ts` (real-time
  `/users/{uid}` snapshot, memberships, active tenant from token claims).

### Layouts

- `src/layouts/AppLayout.tsx`: `AppShell` + `AppSidebar` + `MobileBottomNav`,
  `NotificationBell` (via `useNotifications`/`useUnreadCount`/`useMarkRead`),
  `RoleSwitcher` across student memberships, `ThemeToggle`,
  `useTenantBranding()`, `usePrefetch(STUDENT_PREFETCH_MAP)` (hover-prefetch
  lazy chunks), PWA banners. Sidebar nav: Dashboard / My Spaces / Tests /
  Leaderboard / Profile / Settings.
- `src/layouts/ConsumerLayout.tsx`: similar shell, nav = My Learning / Store /
  Cart / Profile; cart badge from `useConsumerStore`.

### Learning experience pages

- **`DashboardPage.tsx`** (B2B): cross-system summary via
  `useStudentProgressSummary` (overall score, autograde avg, levelup completion,
  streak), `LevelBadge`/`StreakWidget`/`AchievementBadge` gamification,
  strengths/weaknesses, at-risk badge, recent exam results, upcoming exams
  (`useExams`), `RecommendationsSection`, space cards with progress
  (`useAllSpaceProgress`). **Links to `/achievements` and `/results` which have
  NO routes** (dead links).
- **`SpacesListPage.tsx`**: list of published spaces.
- **`SpaceViewerPage.tsx`**: space detail. `useSpace` + local `useStoryPoints` +
  `useProgress`. Tabs: Contents (story-point cards routed by `type`:
  `timed_test`/`test`→`/test`, `practice`→`/practice`, else `/story-points`),
  Overview (module-type/difficulty breakdown computed client-side), **"AI
  Analytics" tab that is NOT AI — it's client-side `useMemo` heuristics**
  (completion rate, weakest/strongest module, canned recommendation strings).
  `SpaceReviewSection` for ratings. `CelebrationBurst` on 100%.
- **`StoryPointViewerPage.tsx`** (1300+ lines combined logic): learning/standard
  story points. Groups `UnifiedItem[]` by `sectionId` into collapsible sections
  each with an `ItemNavigator` (numbered buttons, one-item-at-a-time). Materials
  via `MaterialViewer`; questions via `QuestionAnswerer`. On submit: tries
  `autoEvaluateClient` (local deterministic scoring), else `useEvaluateAnswer`
  callable, then `useRecordItemAttempt`. Intentionally does NOT restore
  in-memory evaluations on revisit (fresh form, status colors from persisted
  `questionData.status`). Per-item attempt history via `AttemptHistoryPanel`.
  Inline `ChatTutorPanel`.
- **`PracticeModePage.tsx`**: unlimited-retry practice. Difficulty filter, mini
  navigator, per-question evaluation. **Persists session evaluations to RTDB**
  (`practice/{userId}/{spaceId}`) via `useRealtimeDB`/`realtimeDBService` as a
  fast cache AND to Firestore via `useRecordItemAttempt` for durable progress.
  `beforeunload` warning.
- **`TimedTestPage.tsx`** (1340 lines, the heaviest file): full state-machine
  `landing | test | results`. Server-time offset from RTDB
  `.info/serverTimeOffset`; server-authoritative deadline
  (`activeSession.serverDeadline`). Start/submit/save via
  `useStartTest`/`useSubmitTest`/`useSaveAnswer` (local
  `src/hooks/useTestSession.ts`). Schedule gating (startAt/endAt),
  retry/cooldown/lock-after-passing from `assessmentConfig`. **Client-side
  adaptive question selection** via `updateAdaptiveState`/`selectNextQuestion`
  (from `@levelup/shared-services`). NTA-style `QuestionNavigator` with statuses
  (not_visited/not_answered/answered/marked_for_review/answered_and_marked),
  per-question time tracking, auto-submit on timeout, results view with
  difficulty/Bloom's/section/topic breakdowns + difficulty progression chart +
  confetti.
- **`TestAnalyticsPage.tsx`**: deeper per-session analytics;
  `AttemptComparison`, `StudyRecommendations`.
- **`ExamResultPage.tsx`** (autograde domain): exam results from
  `useExam`/`useSubmissions` + local `useQuestionSubmissions` reading
  `submissions/{id}/questionSubmissions`. Print support.
- **`TestsPage.tsx`**, **`LeaderboardPage.tsx`** (`LeaderboardTable`),
  **`NotificationsPage.tsx`**, **`SettingsPage.tsx`** (notification prefs via
  `useNotificationPreferences`/`useSaveNotificationPreferences`),
  **`ProfilePage.tsx`**.

### Consumer (B2C) pages

- **`ConsumerDashboardPage.tsx`**: reads
  `user.consumerProfile.enrolledSpaceIds`/`plan`/`totalSpend`; batched Firestore
  `in` query against `tenants/platform_public/spaces` (chunks of 30).
- **`StoreListPage.tsx`** (`callListStoreSpaces`), **`StoreDetailPage.tsx`**,
  **`CheckoutPage.tsx`** (`callPurchaseSpace`, cart in `useConsumerStore`
  persisted to localStorage), **`ConsumerProfilePage.tsx`**.

### Question type components (`src/components/questions/`)

Per-type answerers dispatched by `QuestionAnswerer.tsx` switch on
`payload.questionType`: `mcq`, `mcaq`, `true-false`, `numerical`, `text`,
`paragraph`, `code`, `fill-blanks`, `fill-blanks-dd`, `matching`, `jumbled`,
`audio`, `image_evaluation`, `group-options`, `chat_agent_question` (15 types).
Has runtime `asString/asStringArray/asRecord` guards against corrupted answer
state. `FeedbackPanel`, `ImageLightbox` for attachments.

### Client-side auto-evaluation (`src/utils/auto-evaluate-client.ts`)

Mirrors server logic for deterministic types
(mcq/mcaq/true-false/numerical/fill-blanks/fill-blanks-dd/matching/jumbled/group-options)
gated by `AUTO_EVALUATABLE_TYPES`. Includes legacy `leftItems/correctPairs`
matching fallback. Returns `null` for AI-graded types → falls through to
callable.

### AI tutoring (`src/components/chat/ChatTutorPanel.tsx` + `src/hooks/useChatTutor.ts`)

Floating panel keyed to a content item; `useChatSession`/`useItemChatSessions`
query `tenants/{tid}/chatSessions`; `useSendChatMessage` → `callSendChatMessage`
(`sendChatMessage` callable). Multi-session per item with session list. Also
embedded in `ChatAgentAnswerer` as a question type.

### Local hooks (`src/hooks/`)

`useStoryPoints`, `useSpaceItems` (`useStoryPointItems`/`useSectionItems`),
`useTestSession`
(`useTestSessions`/`useTestSession`/`useStartTest`/`useSubmitTest`/`useSaveAnswer`),
`useEvaluateAnswer`, `useChatTutor`, `useNotificationPreferences`,
`useSaveNotificationPreferences`, `usePWAInstall`.

### Tests

Extensive Playwright E2E suite under `e2e/` (auth, dashboard, practice,
timed-test, chat, leaderboard, results, accessibility, responsive, plus persona
"learner-\*-cycle" specs). **No unit tests**
(`"test": "echo 'No unit tests for student-web'"`).

---

## 2. Entities / schemas / collections / APIs / routes (with file paths)

### Firestore collections read/written (tenant-scoped under `tenants/{tenantId}/`)

- `spaces/{spaceId}` — `useSpace`
  (`packages/shared-hooks/src/queries/useSpace.ts`), `useSpaces`.
- `spaces/{spaceId}/storyPoints/{spId}` — `src/hooks/useStoryPoints.ts` (ordered
  by `orderIndex`).
- `spaces/{spaceId}/storyPoints/{spId}/items/{itemId}` —
  `src/hooks/useSpaceItems.ts` (`UnifiedItem`, ordered by `orderIndex`; section
  filter by `sectionId`).
- `spaceProgress/{userId}_{spaceId}` —
  `packages/shared-hooks/src/queries/useProgress.ts` (deterministic ID;
  `SpaceProgress`).
- `spaceProgress/{userId}_{spaceId}/storyPointProgress/{spId}` —
  `useStoryPointProgress` (`StoryPointProgressDoc`; **with legacy fallback**
  synthesizing from a flat `items` map on the parent doc).
- `digitalTestSessions/{sessionId}` — `src/hooks/useTestSession.ts`
  (`DigitalTestSession`).
- `chatSessions/{sessionId}` — `src/hooks/useChatTutor.ts` (`ChatSession`).
- `submissions/{id}` + `submissions/{id}/questionSubmissions` —
  `ExamResultPage.tsx`, `useSubmissions`.
- `notifications` — `useNotifications` (shared-hooks).
- RTDB: `practice/{userId}/{spaceId}` (practice cache), `.info/serverTimeOffset`
  (test clock).
- Consumer: `tenants/platform_public/spaces` (synthetic public tenant);
  `users/{uid}.consumerProfile`.

### Cloud Function callables (wrappers in `packages/shared-services/src/`, impls in `functions/levelup/src/callable/` & `functions/autograde/src/callable/`)

- `startTestSession`, `submitTestSession`, `evaluateAnswer`, `recordItemAttempt`
  — `packages/shared-services/src/levelup/assessment-callables.ts` (impls:
  `functions/levelup/src/callable/start-test-session.ts`,
  `submit-test-session.ts`, `evaluate-answer.ts`, `record-item-attempt.ts`).
- `sendChatMessage` — `packages/shared-services/src/levelup/chat-callables.ts`
  (impl `functions/levelup/src/callable/send-chat-message.ts`).
- `listStoreSpaces`, `purchaseSpace`, `saveSpaceReview` —
  `packages/shared-services/src/levelup/store-callables.ts` (impls
  `list-store-spaces.ts`, `purchase-space.ts`, `save-space-review.ts`).
- `switchActiveTenant` — auth callable
  (`packages/shared-services/src/auth/auth-callables.ts`).
- **Note:** `recordItemAttempt` callable overloads two contracts — a
  session-based timed-test save and a scored-result item-attempt save
  (documented in `src/hooks/useTestSession.ts` JSDoc).

### Domain types (`packages/shared-types/src/`)

- `levelup/space.ts`, `levelup/story-point.ts` (`StoryPoint`,
  `StoryPointSection`, `assessmentConfig`, `adaptiveConfig`, `retryConfig`,
  `schedule`), `levelup/test-session.ts` (`DigitalTestSession`,
  `QuestionStatus`, `AdaptiveState`), `levelup/progress.ts` (`SpaceProgress`,
  `StoryPointProgressDoc`, `AttemptRecord`), `levelup/chat.ts` (`ChatSession`),
  `levelup/space-review.ts`.
- `content/` (`UnifiedItem`, `QuestionPayload`, 15 question data shapes,
  `ItemAttachment`).
- `progress/` (`UnifiedEvaluationResult`, `StoredEvaluation`).
- `autograde/` (`Exam`, `QuestionSubmission`).
- `identity/` (`UnifiedUser`, `UserMembership`, `TenantRole`,
  `consumerProfile`).
- Constants: `AUTO_EVALUATABLE_TYPES`.

### Access model (`firestore.rules`)

- `isStudent(tenantId)` gate. `spaceProgress` read/write requires
  `resource.data.userId == request.auth.uid` (lines ~439-466).
  `submissions`/exam reads gate on `request.auth.token.studentId` (token claim),
  **inconsistent with `userId == auth.uid` used for progress**.
  `storyPointProgress` subcollection rules `get()` the parent doc to check
  ownership (extra reads per check).

---

## 3. Strengths worth keeping

- **Server-authoritative timed tests** — deadline + clock skew via RTDB
  `serverTimeOffset`, concurrent-submit guard (`isSubmitting` ref), best-effort
  answer save before submit, per-question time tracking, auto-submit. This is
  genuinely robust (`TimedTestPage.tsx`).
- **Hybrid evaluation** — deterministic types scored client-side
  (`auto-evaluate-client.ts`) for instant feedback + zero cost; AI/subjective
  types fall through to a callable. Clean, well-factored split.
- **Unified item model + dispatcher** — one `UnifiedItem` shape and a single
  `QuestionAnswerer` switch covers 15 question types; same renderer reused
  across story-point/practice/test views.
- **Section-aware adaptive engine** — adaptive difficulty selection logic shared
  with the server (`updateAdaptiveState`/`selectNextQuestion`), NTA-style
  navigator with full status taxonomy.
- **Performance hygiene** — lazy routes, hover-prefetch map,
  `RouteErrorBoundary` per route, query `staleTime` tuning, PWA + offline
  banner, image `loading="lazy"`.
- **Rich results analytics** — difficulty/Bloom's/section/topic breakdowns,
  attempt comparison, difficulty progression chart, weak-area recommendations.
- **Gamification surfaced** — level/XP, streaks, achievements integrated into
  the dashboard via shared-ui + shared-hooks.
- **Backward-compat migration handling** — `useStoryPointProgress` legacy-items
  fallback, `matching` legacy `correctPairs` shape — shows real production data
  evolution was handled.
- **Strong E2E coverage** including persona-based learner journeys.

---

## 4. Pain points / tech debt / inconsistencies

- **Two products in one app.** B2B (school, tenant role) and B2C (consumer,
  `platform_public`) share routing, layouts, and the same viewer pages but
  diverge in data source, auth, and navigation. This is the single biggest
  source of conditional complexity (e.g., `RequireAuth` consumer fallback, dual
  `/spaces` vs `/consumer/spaces` route copies pointing at the same components).
- **Dead/orphaned pages.** `ChatTutorPage.tsx`, `StudyPlannerPage.tsx`,
  `AchievementsPage.tsx`, `ProgressPage.tsx` exist but are **not routed in
  `App.tsx`**. `DashboardPage` links to `/achievements` and `/results` which
  have **no matching routes** (404s).
- **Duplicate hooks.** `useStoryPoints`, `useTestSessions`/`useTestSession`,
  `useStoryPointItems`/`useSpaceItems`, `useChatSession` exist BOTH as local
  `apps/student-web/src/hooks/*` AND in `packages/shared-hooks/src/queries/*`
  (`useStoryPoints.ts`, `useTestSessions.ts`, `useChatSessions.ts`,
  `useItems.ts`). The app imports the local copies — drift risk and unclear
  source of truth.
- **Direct Firestore access scattered through the UI layer.** Pages/hooks build
  collection paths as raw template strings
  (`tenants/${tid}/spaces/${sid}/storyPoints/...`) inline (`useSpaceItems.ts`,
  `useTestSession.ts`, `useChatTutor.ts`, `ConsumerDashboardPage.tsx`,
  `ExamResultPage.tsx`, `AppLayout.tsx`). No repository/data-access abstraction
  — every consumer must know the schema layout. **This is the core blocker for a
  common API layer / React Native.**
- **Firebase SDK assumed everywhere.** Components import `firebase/firestore`,
  `firebase/functions`, `firebase/database` directly. Timestamp handling is
  ad-hoc with unsafe casts (`as unknown as { seconds: number }` litters
  `TimedTestPage.tsx`). Not portable to a transport-agnostic client.
- **"AI Analytics" is not AI.** `SpaceViewerPage`'s AI Analytics tab and
  recommendation strings are hardcoded `useMemo` heuristics — misleading naming
  and duplicates logic that the analytics functions already compute server-side.
- **God components.** `TimedTestPage.tsx` (~1340 lines) and
  `StoryPointViewerPage.tsx` (~600 lines) mix data fetching, timer, adaptive
  logic, view-state machine, and presentation. Hard to test, reuse, or port.
- **Type-safety gaps at the data boundary.** Firestore reads cast with `as Type`
  (no runtime validation despite a `zod-schema-validation` skill and `schemas/`
  package existing). `payload.questionData as MCQData` etc. trust unvalidated
  docs.
- **Evaluation contract duplicated client+server.** `auto-evaluate-client.ts`
  must be kept in lockstep with the server auto-evaluator; divergence = silent
  scoring mismatch.
- **Access-model inconsistency.** Progress rules key on `auth.uid`,
  submission/exam rules key on `auth.token.studentId` — two notions of "the
  student" complicate a unified identity.
- **Notification preferences / settings hooks are app-local** rather than
  shared, despite other apps needing them.
- **No unit tests at all** for a financially/academically consequential surface
  (scoring, timer, submission).

---

## 5. Recommendations for a fresh rebuild

### Core concepts to preserve (non-negotiable domain)

- The `UnifiedItem` + 15 question-type model and the single-dispatcher answerer
  pattern.
- Hybrid evaluation (deterministic-local + AI-callable) — but make the
  deterministic evaluator a **single shared package** imported by both client
  and server (one source of truth, no drift).
- Server-authoritative timed-test sessions with clock-skew correction, status
  taxonomy, adaptive selection, schedule/retry/cooldown gating.
- Progress model: space-level summary + story-point-level + per-item attempts;
  gamification (level/XP/streak/achievements).
- AI chat tutoring keyed to items with multi-session history.

### Architecture changes

1. **Introduce a transport-agnostic API/data layer.** Replace inline Firestore
   string paths and direct callable wiring with a typed `@levelup/api-client`
   (repositories like `SpacesRepo`, `ProgressRepo`, `TestSessionRepo`,
   `ChatRepo`) exposing intent-level methods (`getStoryPointItems`, `startTest`,
   `submitAnswer`). Back it today with Firestore/callables; later swap to
   REST/GraphQL without touching UI. This is the prerequisite for React Native
   reuse.
2. **Validate at the boundary with Zod.** Parse every Firestore/callable
   response through schemas in `shared-types/src/schemas` before it enters React
   state. Kill the `as Type` casts and unsafe timestamp casts (centralize
   timestamp → epoch-ms conversion in one util).
3. **Split B2B and B2C cleanly.** Either two apps sharing a
   `@levelup/learner-core` package, or one app with a single `LearnerContext`
   that abstracts "where do spaces/progress come from" (tenant vs
   `platform_public`). Stop duplicating routes; route on context, not on path
   prefix.
4. **Extract feature modules from God components.** `TimedTest` →
   `useTestRunner` (session state machine) + `useTestTimer` + presentational
   components. Same for `StoryPointViewer`. Put adaptive logic, timer, and
   submission orchestration in framework-agnostic hooks/services so RN can reuse
   them.
5. **Consolidate hooks into `shared-hooks`.** Delete the local
   `apps/student-web/src/hooks` duplicates; have one canonical query/mutation
   per entity, parameterized by the API client. Move notification-preference
   hooks into shared.
6. **Promote shared logic to packages** so future RN apps consume the same:
   question answerers behind a thin platform-adapter (web inputs vs RN inputs),
   evaluation engine, test runner, progress aggregation. Keep `shared-ui`
   web-only; introduce a headless layer beneath it.
7. **Unify identity.** One canonical "current learner" id and one ownership
   predicate in security rules (pick `auth.uid` or a claim, not both); align
   consumer and student paths.
8. **Make analytics honest.** Either call the real analytics functions for the
   "AI Analytics" tab or rename to "Insights" and keep client heuristics — but
   don't duplicate server-computed metrics client-side.
9. **Add unit tests** for the evaluation engine, test-runner state machine,
   timer/clock-skew, and progress aggregation; keep the strong Playwright suite.
10. **Remove dead code** (`ChatTutorPage`, `StudyPlannerPage`,
    `AchievementsPage`, `ProgressPage` or wire up routes + fix `/achievements`
    and `/results` dead links) during the rebuild inventory.
