# student-web

## 1. Purpose & audience

`@levelup/student-web` (`apps/student-web/package.json:2`) is the
**learner-facing PWA** of LevelUp. It serves two audiences off one codebase:

- **B2B students** — school-tenant users who sign in with a school code +
  roll-number/email, take assigned spaces and timed tests, and appear on tenant
  leaderboards.
- **B2C consumers** — self-signup learners on a `platform_public` tenant who
  browse a "Store", purchase Spaces, and consume the same lesson UI.

The split is driven entirely by `currentMembership.role` and routed through two
parallel layouts (`AppLayout`, `ConsumerLayout`). The content-viewer pages
(Space/StoryPoint/Test/Practice) are **reused across both flows** — the consumer
flow just mounts them under `/consumer/...`.

## 2. Tech stack

From `package.json`: React 18 + TypeScript 5.8, Vite 5 (SWC plugin),
`react-router-dom` v7, `@tanstack/react-query` v5, Firebase 11 (Auth, Firestore,
RTDB, Functions), Zustand via `@levelup/shared-stores`, `@levelup/shared-ui`
(shadcn/Radix-based), `lucide-react`, `next-themes`, `sonner`, Tailwind 3.4 with
a shared preset. Build add-ons: `vite-plugin-compression` (gzip + brotli),
`rollup-plugin-visualizer` (gated by `ANALYZE=true`), terser. PWA via a
hand-rolled service worker. **Testing is Playwright E2E only** — `npm test`
literally echoes "No unit tests".

## 3. Entry & bootstrap

- `index.html` sets PWA meta (`theme-color #6366f1`, manifest, icons) and
  **preconnects/dns-prefetches** the three Firebase hosts (`firestore`,
  `identitytoolkit`, `firebaseinstallations`) to cut first-paint latency.
- `src/main.tsx` constructs a `QueryClient` (`retry: 1`,
  `refetchOnWindowFocus: false`), calls `initializeFirebase({...})` reading
  `import.meta.env.VITE_FIREBASE_*` (apiKey, authDomain, projectId,
  storageBucket, messagingSenderId, appId, databaseURL), then renders
  `ErrorBoundary → ThemeProvider (next-themes, class attr, system default) → QueryClientProvider → BrowserRouter → App`
  plus `<SonnerToaster>`. It calls `reportWebVitals()` and, in prod only,
  registers `/sw.js`, polls `registration.update()` hourly, and dispatches a
  `sw-update-available` window event for `<SWUpdateNotification>` on
  `updatefound`.
- `vite.config.ts`: dev port `4570`; `@/*` alias to `./src`;
  `dedupe: ['react','react-dom','react-router-dom']`;
  `process.env`/`process.stdout`/`process.stderr` shims; ES2020 target with
  terser dropping `console`/`debugger`; **manual chunks** for `vendor-react`,
  `vendor-firebase`, `vendor-query`, `vendor-radix`; sourcemaps +
  `cssCodeSplit: true`; gzip + brotli for assets >1 KB.
- `tailwind.config.ts` extends `@levelup/tailwind-config`, applies its safelist,
  and crucially scans `../../packages/shared-ui/src/**/*.{ts,tsx}` so utility
  classes used inside the shared library survive purge.

## 4. Routing map

All routes are lazy-imported in `src/App.tsx`. The two authenticated trees use
`RequireAuth` with `allowedRoles={['student']}` (B2B) or no role filter (B2C).
Every leaf is wrapped in `<RouteErrorBoundary>`; `*` falls through to shared
`<NotFoundPage />`.

| Path                                                                     | Component                                            | Layout           |
| ------------------------------------------------------------------------ | ---------------------------------------------------- | ---------------- |
| `/login`                                                                 | `LoginPage`                                          | `AuthLayout`     |
| `/`                                                                      | `DashboardPage`                                      | `AppLayout`      |
| `/spaces`                                                                | `SpacesListPage`                                     | `AppLayout`      |
| `/spaces/:spaceId`                                                       | `SpaceViewerPage`                                    | `AppLayout`      |
| `/spaces/:spaceId/story-points/:storyPointId`                            | `StoryPointViewerPage`                               | `AppLayout`      |
| `/spaces/:spaceId/test/:storyPointId`                                    | `TimedTestPage`                                      | `AppLayout`      |
| `/spaces/:spaceId/test/:storyPointId/analytics`                          | `TestAnalyticsPage`                                  | `AppLayout`      |
| `/spaces/:spaceId/practice/:storyPointId`                                | `PracticeModePage`                                   | `AppLayout`      |
| `/exams/:examId/results`                                                 | `ExamResultPage`                                     | `AppLayout`      |
| `/notifications`, `/leaderboard`, `/tests`, `/settings`, `/profile`      | matching `*Page`                                     | `AppLayout`      |
| `/consumer`, `/my-spaces`                                                | `ConsumerDashboardPage`                              | `ConsumerLayout` |
| `/consumer/spaces/:spaceId(/story-points\|test\|practice/:storyPointId)` | shared viewers                                       | `ConsumerLayout` |
| `/store`, `/store/:spaceId`, `/store/checkout`                           | `StoreListPage` / `StoreDetailPage` / `CheckoutPage` | `ConsumerLayout` |
| `/profile` (consumer)                                                    | `ConsumerProfilePage`                                | `ConsumerLayout` |

`RequireAuth` (`src/guards/RequireAuth.tsx:24-43`): if no `firebaseUser` →
`/login` preserving `location`; if `allowedRoles` is set but `currentMembership`
is missing → `/consumer` (so a B2C user landing on a `/` route bounces
correctly); if membership exists but role mismatches → "Access Denied" card.

## 5. Pages & key components

- **`LoginPage`** — host for 4 auth sub-forms (`components/auth/`): school-code
  → credentials, consumer-login ↔ consumer-signup.
- **`DashboardPage`** — student home; cross-system summary,
  level/streak/achievements, upcoming exams, recommendations.
- **`SpaceViewerPage`** — tabs Contents / Overview / AI Analytics; computes a
  Resume target; celebrates 100% with `CelebrationBurst`.
- **`StoryPointViewerPage`** — sequential reader for `UnifiedItem`s (material vs
  question); uses both server `callEvaluateAnswer` and local
  `autoEvaluateClient`; embeds `ChatTutorPanel`.
- **`TimedTestPage`** (~600 LOC, the heaviest page) — RTDB `serverTimeOffset`
  for clock-skew-safe countdown; restores in-progress sessions; tracks
  `QuestionStatus` per question; per-question time refs; race-safe auto-submit;
  uses `selectNextQuestion` + `updateAdaptiveState` for adaptive sequencing.
- **`PracticeModePage`** — persists evaluations to RTDB
  `practice/{uid}/{spaceId}`; `beforeunload` guard; difficulty filtering and
  chat-tutor escalation.
- **`StoreListPage` / `StoreDetailPage` / `CheckoutPage`** — marketplace; cart
  in `useConsumerStore`; checkout sequentially calls `callPurchaseSpace` per
  item with per-item error capture.
- **`LeaderboardPage`** — subscribes to RTDB `leaderboards/{spaceId}` (or
  `leaderboards/overall`) via `useRealtimeDB`.
- **`NotificationsPage`** — thin shell over `<NotificationsPage>` shared UI.

Reusable component clusters in `src/components/`: **`questions/`** — 15
`*Answerer` components dispatched by `QuestionAnswerer` on
`payload.questionType` (MCQ, MCAQ, TrueFalse, Numerical, Text, Paragraph, Code,
FillBlanks ×2, Matching, Jumbled, Audio, ImageEvaluation, GroupOptions,
ChatAgent); **`test/`** — `QuestionNavigator`, `CountdownTimer`,
`NetworkStatusBanner`; **`common/`** — `FeedbackPanel`, `ProgressBar`,
`AttemptHistoryPanel`, `ImageLightbox`, `SectionErrorBoundary`; plus widgets
under `analytics/`, `dashboard/`, `leaderboard/`, `materials/`, `spaces/`,
`chat/`.

## 6. State management

- **React Query** is the source of truth for all server data. Cache keys are
  tenant-scoped (`['tenants', tenantId, ...]`). Per-hook `staleTime` ranges from
  5 s (live test session) to 5 min (notification prefs, story points, items).
  The `useTestSession` hook also sets `refetchInterval: 10 s`.
- **Zustand via `@levelup/shared-stores`**: `useAuthStore` (firebase user,
  membership, role, login/logout/switchTenant/initialize), `useTenantStore`
  (tenant doc subscription), `useConsumerStore` (cart). Selector helpers
  `useCurrentUser`/`useCurrentMembership`/`useCurrentTenantId` are also
  re-exported.
- **Local UI state** is plain `useState`/refs — no app-level Redux/Jotai store.
  `TimedTestPage` keeps its in-flight answers/statuses/timing locally since
  they're ephemeral until session submit.
- `App.tsx` runs `useAuthStore.initialize()` once and re-subscribes
  `useTenantStore.subscribe(currentTenantId)` whenever tenant changes.

## 7. Data layer

Three back-end vectors:

1. **Direct Firestore reads** via `getFirebaseServices().db` for simple
   tenant-scoped collections — `tenants/{tid}/spaces/{sid}/storyPoints`,
   `…/items`, `…/digitalTestSessions`, `…/chatSessions`,
   `…/notificationPreferences`, `…/submissions/{sid}/questionSubmissions`. Most
   live in `src/hooks/use*.ts`.
2. **Realtime Database** via `getFirebaseServices().rtdb` for live data:
   leaderboards (`leaderboards/{spaceId}`), practice scratch
   (`practice/{uid}/{spaceId}`), and `.info/serverTimeOffset` for the timed-test
   clock.
3. **Cloud Functions** via named `call*` helpers from
   `@levelup/shared-services`: `callStartTestSession`, `callSubmitTestSession`,
   `callEvaluateAnswer`, `callSendChatMessage`, `callListStoreSpaces`,
   `callPurchaseSpace`, `lookupTenantByCode`, `callUploadTenantAsset`, plus one
   direct `httpsCallable(functions, 'recordItemAttempt')` in `useSaveAnswer`.

**Client-side auto-evaluation** lives in `src/utils/auto-evaluate-client.ts` and
mirrors the server's deterministic evaluators for nine question types
(MCQ/MCAQ/true-false/numerical/fill-blanks/fill-blanks-dd/matching/jumbled/group-options).
AI-graded types still hit `callEvaluateAnswer`. `useSaveAnswer`'s docstring
(`src/hooks/useTestSession.ts:84-97`) calls out that `recordItemAttempt` accepts
both a session-based and a scored-result contract.

## 8. Shared package usage

- **`@levelup/shared-services`** — `initializeFirebase`, `getFirebaseServices`,
  `authService`, `realtimeDBService`, the `call*` callable wrappers, adaptive
  helpers (`updateAdaptiveState`, `selectNextQuestion`).
- **`@levelup/shared-hooks`** —
  `useSpaces`/`useSpace`/`useProgress`/`useAllSpaceProgress`,
  `useStudentProgressSummary`/`useStudentAchievements`/`useStudentLevel`,
  `useExams`, `useRecordItemAttempt`, `useRealtimeDB`, notifications hooks,
  `useTenantBranding`, `usePrefetch`, `useApiError`.
- **`@levelup/shared-stores`** — `useAuthStore`, `useTenantStore`,
  `useConsumerStore`, selector helpers.
- **`@levelup/shared-ui`** — all primitives, shell (`AppShell`, `AppSidebar`,
  `MobileBottomNav`, `RouteAnnouncer`, `PageTransition`), gamification
  (`LevelBadge`, `StreakWidget`, `AchievementBadge`, `CelebrationBurst`,
  `CountUp`, `FadeIn`, `AnimatedCard`), PWA banners (`SWUpdateNotification`,
  `PWAInstallBanner`, `OfflineBanner`), `RouteErrorBoundary`,
  `NotificationBell`, `ThemeToggle`, `RoleSwitcher`.
- **`@levelup/shared-types`** — `Space`, `StoryPoint`, `UnifiedItem` + per-type
  `*Data`, `DigitalTestSession`, `QuestionSubmission`, `StoredEvaluation`,
  `UnifiedEvaluationResult`, `TenantRole`, `AdaptiveState`,
  `AUTO_EVALUATABLE_TYPES`.
- **`@levelup/shared-utils/web-vitals`** for `reportWebVitals`. Dev-only:
  `@levelup/eslint-config`, `@levelup/tailwind-config`.

## 9. Auth & permissions

Sign-in is initialised by `useAuthStore.initialize()` (the firebase
`onAuthStateChanged` subscription lives upstream).

- **School-code path** (`SchoolCodeForm` → `SchoolCredentialsForm`):
  `lookupTenantByCode(code)` validates the code and returns tenant name +
  status; if `status === 'active'`, the user enters credentials and
  `loginWithSchoolCode(code, credential, password)` runs. Credentials field
  toggles between roll-number and email via shared `Tabs`.
- **Consumer login**: `login(email, password)` or `loginWithGoogle()`; both
  navigate to `/consumer`.
- **Consumer signup**: `authService.signUp(...)` +
  `authService.updateUserProfile(...)`.

`RequireAuth` is the only route guard; role enforcement is by `allowedRoles`.
Tenant switching is via `<RoleSwitcher>` in the student sidebar footer, which
calls `switchTenant` and triggers `useTenantStore.subscribe` re-bind in
`App.tsx`.

## 10. Styling

Tailwind 3.4 with the shared `@levelup/tailwind-config` preset and safelist. The
app's `content` glob includes `packages/shared-ui/src/**` so shared component
classes survive purge. Dark mode is delivered by `next-themes`
(`attribute="class"`, system-aware) and toggled by `<ThemeToggle>`. All visual
primitives come from `@levelup/shared-ui` (shadcn/Radix-based); there is no
app-local design system. Tenant branding is applied at runtime by
`useTenantBranding()` inside `AppLayout`, which writes CSS custom properties
from the tenant doc. `index.css` is the single global stylesheet; route
transitions use `<PageTransition>` keyed on `location.pathname`.

## 11. Build & tooling

- **Scripts**: `dev`, `build`, `preview`, `lint`, `typecheck`, `test:e2e`,
  `analyze` (`ANALYZE=true vite build` → `dist/bundle-report.html`).
- **Code splitting**: every page in `App.tsx` is `lazy()`-imported; vendor
  splits explicit in `vite.config.ts`; CSS code-splitting on; output paths
  hashed (`entries/`, `chunks/`, `assets/`).
- **Prefetch on hover**: `AppLayout` calls `usePrefetch(STUDENT_PREFETCH_MAP)`
  (`src/layouts/AppLayout.tsx:33-41`), mapping each sidebar URL to its lazy
  `import()` so hovering a nav link warms the chunk.
- **PWA**: `public/sw.js` (cache `levelup-student-v2`) precaches
  `/offline.html`, skips Firebase/Google API hosts, supports a `SKIP_WAITING`
  message; `main.tsx` polls `registration.update()` hourly.
- **Env**: only `VITE_FIREBASE_*` is consumed; tenant runtime config arrives via
  Firestore.
- **ESLint** (`eslint.config.cjs`): flat config extending
  `@typescript-eslint/recommended` + `react-hooks/recommended-latest`; custom
  unused-vars (`^_` ignore); `no-explicit-any: warn`; `no-console` allow
  `warn`/`error`.

## 12. Tests

- **No unit tests**.
- **Playwright E2E** (`apps/student-web/e2e/`): functional specs for `auth`,
  `dashboard`, `space-viewer`, `tests-page`, `timed-test`, `practice`,
  `results`, `chat`, `store`, `leaderboard`, `notifications`, `navigation`,
  `responsive`, `accessibility`, `states`, `consumer`; plus four multi-cycle
  "learner journey" specs (`learner-{dsa,lld,sysdesign,behavioral}-cycle*`) from
  the academy-evolution work. Config is single-worker, Chrome-desktop only, 60 s
  timeout, 2× retries on CI, `baseURL: http://localhost:4570`.

## 13. Notable patterns or quirks

- **Two layouts, one viewer set** — the consumer flow doesn't fork the lesson
  UI; it just remounts the viewer pages under `/consumer/...`. Viewers don't
  know which tree they're in; they read tenant id from `useAuthStore`.
- **Server-time-aware countdown** — `TimedTestPage` subscribes to RTDB
  `.info/serverTimeOffset` to defeat client clock skew.
- **Hybrid grading** — deterministic question types are graded entirely
  client-side via `autoEvaluateClient`; only AI/free-text types hit
  `callEvaluateAnswer`. Practice mode feels instant as a result.
- **Dual-contract `recordItemAttempt`** — `useSaveAnswer` here sends the
  timed-test payload `{sessionId, itemId, answer, timeSpentSeconds}`; the shared
  `useRecordItemAttempt` sends the scored payload. Both hit the same callable.
- **Consumer fan-out reads** — `ConsumerDashboardPage` batches
  `where('__name__', 'in', ...)` reads in chunks of 30 (Firestore's `in` cap).
- **Tenant-scoped React Query keys** — `['tenants', tenantId, ...]` for clean
  invalidation on tenant switch.
- **Per-route error isolation** — every leaf wrapped in `<RouteErrorBoundary>`
  so one page crash doesn't break the shell.

## 14. Open questions / TODOs

- **`useChatSession` dynamic-imports `firebase/firestore` inside its `queryFn`**
  (`src/hooks/useChatTutor.ts:22-24`) while the rest of the file imports the
  same symbols statically — looks like a stale code-splitting experiment.
- **`recordItemAttempt` is called three different ways** (`useSaveAnswer`,
  shared `useRecordItemAttempt`, direct `httpsCallable`). A single
  discriminated-union hook would be safer; today the dual contract is only
  documented in a docstring.
- **Several pages exist but aren't routed** — `ChatTutorPage`,
  `AchievementsPage`, `ProgressPage`, `StudyPlannerPage` live under `src/pages/`
  but are not registered in `App.tsx`. Either in-progress or dead.
- **`/profile` collision** — both trees register `/profile`, pointing at
  different components. Works because the trees are guarded separately, but it's
  a fragility.
- **`MatchingData` legacy branch** in `auto-evaluate-client.ts` uses `as any`
  for a "legacy leftItems/rightItems/correctPairs format (from seed data)" —
  worth migrating and removing.
- **No unit tests at all** — every regression must be caught by Playwright
  (single-worker). The pure pieces (`auto-evaluate-client.ts`, the timed-test
  status mapping) are obvious candidates for fast unit coverage.
- **SW cache version is a hard-coded constant**
  (`CACHE_NAME = 'levelup-student-v2'`) — tie to a build-time env var to avoid
  manual bumps.
