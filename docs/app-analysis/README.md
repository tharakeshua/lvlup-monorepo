# LevelUp Monorepo — Frontend Apps Overview

Synthesized from per-app deep-dive docs in this directory. Each per-app doc
covers routing, state, data layer, components, build, and notable quirks for
exactly one app — read those for source-level detail. This README is the
cross-app picture: what is shared, what differs, and how the apps fit together
as a single product.

| App                    | Path               | Audience                                           | Per-app doc                        |
| ---------------------- | ------------------ | -------------------------------------------------- | ---------------------------------- |
| `@levelup/super-admin` | `apps/super-admin` | LevelUp staff (platform ops/finance)               | [super-admin.md](./super-admin.md) |
| `@levelup/admin-web`   | `apps/admin-web`   | Per-tenant school admins (`tenantAdmin`)           | [admin-web.md](./admin-web.md)     |
| `@levelup/teacher-web` | `apps/teacher-web` | Teachers + tenant admins (content + grading)       | [teacher-web.md](./teacher-web.md) |
| `@levelup/student-web` | `apps/student-web` | B2B school students + B2C consumers (one codebase) | [student-web.md](./student-web.md) |
| `@levelup/parent-web`  | `apps/parent-web`  | Parents tracking linked children                   | [parent-web.md](./parent-web.md)   |

## 1. Product model in one paragraph

LevelUp is a multi-tenant SaaS for schools. Each tenant (school) has its own
admins, teachers, students, and parents; super-admin staff manage tenants
themselves. `student-web` also doubles as the B2C "consumer" learning app
mounted under `/consumer/...` and `/store/...` for self-signup learners on the
`platform_public` tenant — same viewer components, different shell. Backend is
100% Firebase: Auth, Firestore (per-tenant collections under
`tenants/{tid}/...`), Cloud Functions (callables), Storage, and RTDB
(leaderboards + timed-test clock). There is no REST/GraphQL layer.

## 2. The "house style" — patterns every app follows

Every app ships the same skeleton, so onboarding to a second one is mostly about
learning its domain. The common pieces:

- **Stack:** React 18 + TypeScript 5.8, Vite 5 (SWC), `react-router-dom` v7,
  `@tanstack/react-query` v5, Firebase 11, Tailwind 3.4, `next-themes`,
  `sonner`, `lucide-react`.
- **Bootstrap (`src/main.tsx`):**
  `QueryClient(retry: 1, refetchOnWindowFocus: false)` →
  `initializeFirebase({...})` from six `VITE_FIREBASE_*` env vars →
  `ErrorBoundary` → `ThemeProvider(class, system)` → `QueryClientProvider` →
  `BrowserRouter` → `<App />` + `<SonnerToaster richColors top-right />`.
  `reportWebVitals()` is called eagerly. `/sw.js` is registered only in
  `import.meta.env.PROD`, polls hourly, and dispatches `sw-update-available` for
  `<SWUpdateNotification />` to consume.
- **Routing:** all pages `React.lazy`-imported, wrapped per-route in
  `<RouteErrorBoundary>` and a single top-level
  `<Suspense fallback={<PageLoader/>}>`. Hover-prefetch via
  `usePrefetch(<APP>_PREFETCH_MAP)` warms chunks on sidebar hover.
- **Auth:** single `guards/RequireAuth.tsx` per app, `allowedRoles` enforced
  inline ("Access Denied" panel, not a redirect, when role mismatches).
- **State:** React Query for server data (keys shaped
  `["tenants", tenantId, ...]` so tenant switch auto-invalidates), Zustand
  stores from `@levelup/shared-stores` for auth/tenant/cart, plain `useState`
  for UI.
- **Vite build:** dev console-drop, `vite-plugin-compression` (gzip + brotli,
  > 1 KB), manual chunks
  > `vendor-react`/`vendor-firebase`/`vendor-query`/`vendor-radix`, optional
  > `rollup-plugin-visualizer` behind `ANALYZE=true`.
- **Styling:** Tailwind preset from `@levelup/tailwind-config` + shared
  `safelist`; `tailwind.config.ts` content globs include
  `../../packages/shared-ui/src/**` so JIT keeps shared-component classes;
  `index.css` is `@import '@levelup/tailwind-config/variables.css'` + the three
  `@tailwind` directives; `useTenantBranding()` writes per-tenant CSS custom
  properties at runtime.
- **Tests:** Playwright E2E only — every app's `npm test` is a stub. Configs are
  single-worker, video on, 60s timeouts. No unit tests anywhere.
- **PWA:** `public/manifest.json` + hand-rolled `public/sw.js` + `offline.html`,
  `<SWUpdateNotification>`/`<PWAInstallBanner>`/`<OfflineBanner>` rendered
  inside `AppLayout`.

## 3. What each app uniquely adds

The "house style" makes the **deltas** the interesting part.

### super-admin (port 4567)

- **Two-source auth gate:** `RequireAuth` verifies _both_ `user.isSuperAdmin` in
  Firestore _and_ the Firebase custom claim `role === "superAdmin"`
  independently — defense-in-depth, called out in code comments.
- **Recharts** (the only app pulling in a chart lib) drives the platform
  dashboards; everywhere else charts are hand-rolled SVG (`MiniLineChart`,
  `SimpleBarChart`).
- Writes daily snapshots to `platformHealthSnapshots/{YYYY-MM-DD}` with `setDoc`
  — second run on the same day silently overwrites.
- Pagination + sort live in `hooks/usePagination` + `hooks/useSort` (in-memory
  slicing of already-fetched arrays — fine until the tenant table outgrows it).

### admin-web (school admin, port unknown — see vite.config)

- **Onboarding wizard:** `OnboardingGuard` redirects unfinished tenants to
  `/onboarding` before any other route renders.
- Heaviest CSV-import surface (students, parents, teachers) via
  `callBulkImportStudents` and friends.
- AI Usage page exposes a Firestore-backed **dead-letter queue** of failed
  grading attempts — unique to admin.

### teacher-web (port 4569)

- **Heaviest authoring surface** — `SpaceEditorPage` ~1.6 kloc with 5 tabs,
  `dnd-kit` reorder of story points and items, Sheet-based item editor with
  auto-save (separate `onSave` vs `onAutoSave`).
- **Dual storage paths** for items: nested `spaces/{id}/storyPoints/{sp}/items`
  preferred, legacy flat `items` filtered by `storyPointId` as fallback;
  `itemPaths` map remembers the chosen path per story point.
- Live grading: `GradingReviewPage` (~1.3 kloc) uses Firestore `onSnapshot` and
  calls `callGradeQuestion` for AI re-grade; keyboard shortcuts.
- Imports `katex` (`main.tsx:10`) for LaTeX rendering — the only app that needs
  it.
- E2E config has a `baseURL: http://localhost:3002` that doesn't match Vite's
  `4569` (open question in the per-app doc).

### student-web (learner, port 4570)

- **Two layouts on one codebase:** `AppLayout` (B2B school students) and
  `ConsumerLayout` (B2C self-signup). The viewer pages
  (`SpaceViewerPage`/`StoryPointViewerPage`/`TimedTestPage`/`PracticeModePage`)
  are reused across both — they read tenant id from `useAuthStore` and don't
  know which tree they're in. Both trees register `/profile` pointing at
  different components.
- **Server-time-aware countdown:** `TimedTestPage` subscribes to RTDB
  `.info/serverTimeOffset` to defeat client clock skew.
- **Hybrid grading:** `utils/auto-evaluate-client.ts` grades 9 deterministic
  question types entirely in the browser; AI/free-text types call
  `callEvaluateAnswer`. Practice mode feels instant as a result.
- **15 `*Answerer` components** dispatched by `QuestionAnswerer` on
  `payload.questionType` — the broadest question-type surface in the repo.
- RTDB-backed leaderboards and practice scratch (`practice/{uid}/{spaceId}`).
- `useSaveAnswer` and shared `useRecordItemAttempt` both call the same callable
  with **different payload contracts** — documented in a docstring, not in
  types.

### parent-web (port 4571)

- **Read-mostly** — exactly one direct Firestore write across the whole app
  (`setDoc` in `useSaveNotificationPreferences`); everything else is reads or
  `callGenerateReport` for PDFs.
- Charts are hand-rolled SVG (`MiniLineChart` + shared-ui's `SimpleBarChart`) —
  zero charting library.
- Multi-child households drive most of the page set
  (`ChildrenPage`/`ChildProgressPage`/`ChildComparisonPage`).
- Respects Firestore's 30-item `in` cap explicitly via chunked `documentId() in`
  lookups in `useChildSubmissions`/`useChildProgress`/`useSpaceNames`.

## 4. Shared package surface

All five apps depend on the same `@levelup/*` workspace packages, and the split
is consistent:

- **`@levelup/shared-types`** — domain types (`Tenant`, `UnifiedUser`,
  `TenantRole`, `Space`, `StoryPoint`, `UnifiedItem`, `Exam`, `Submission`,
  `QuestionSubmission`, `SpaceProgress`, `UnifiedRubric`, all 15 question-type
  payloads, `EvaluationSettings`, …).
- **`@levelup/shared-services`** — `initializeFirebase`, `getFirebaseServices`,
  all `call*` Cloud Function wrappers, `authService`, `realtimeDBService`,
  adaptive-test helpers (`updateAdaptiveState`, `selectNextQuestion`), media
  helpers. There is a `/auth` subpath (`callUploadTenantAsset`,
  `callSaveTenant`, lifecycle/announcement callables) that pages occasionally
  import from directly — easy to miss when grepping.
- **`@levelup/shared-hooks`** — every React-Query wrapper hook the apps use
  (`useSpaces`, `useExams`, `useSubmissions`, `useStudents`, `useClasses`,
  `useStudentProgressSummary`, `useNotifications` family, `useRealtimeDB`, …)
  plus UX helpers (`useApiError`, `useTenantBranding`, `usePrefetch`,
  `usePrefetch` map type).
- **`@levelup/shared-stores`** — Zustand: `useAuthStore`, `useTenantStore`,
  `useConsumerStore` (student-web only), plus selectors
  `useCurrentUser`/`useCurrentMembership`/`useCurrentTenantId`.
- **`@levelup/shared-ui`** — virtually every visible primitive: shell
  (`AppShell`, `AppSidebar`, `MobileBottomNav`, `RoleSwitcher`,
  `PageTransition`, `RouteAnnouncer`, `SkipToContent`, `NotificationBell`,
  `LogoutButton`, `ThemeToggle`), Radix-based primitives, PWA banners
  (`SWUpdateNotification`, `PWAInstallBanner`, `OfflineBanner`), error/loading
  (`ErrorBoundary`, `RouteErrorBoundary`, `PageLoader`, `NotFoundPage`),
  gamification (`LevelBadge`, `StreakWidget`, `AchievementBadge`,
  `CelebrationBurst`), content (`RichTextEditor`/`RichTextViewer`,
  `MarkdownWithMath`, `DownloadPDFButton`), data viz (`ScoreCard`,
  `SimpleBarChart`, `ProgressRing`, `AtRiskBadge`, `ClassHeatmap`).
- **`@levelup/shared-utils`** — only `/web-vitals` is actually consumed by the
  apps.
- **Dev:** `@levelup/eslint-config`, `@levelup/tailwind-config` (preset +
  variables.css + safelist).

If a feature exists in two apps and isn't in `shared-ui`/`shared-hooks` yet,
that's a refactor candidate. The clearest examples right now are the hand-rolled
`MiniLineChart` (parent-web) and `DataFreshnessIndicator` (parent-web
DashboardPage) — both look reusable.

## 5. How the apps coordinate at runtime

- **Tenant scoping is the API.** Every Firestore path is `tenants/{tid}/...`;
  every React-Query key starts with `["tenants", tenantId, ...]`. Switching
  tenants via `<RoleSwitcher />` calls `useAuthStore.switchTenant`, which flips
  `currentTenantId`; every app's `App.tsx` re-subscribes the tenant doc in a
  `useEffect` keyed on that value, and all query caches invalidate by key shape.
- **Role gates the app, not the route.** Each app pins itself to a single role
  (or pair): `super-admin` → `superAdmin` (claim + flag), `admin-web` →
  `tenantAdmin`, `teacher-web` → `teacher`+`tenantAdmin`, `student-web` →
  `student` (B2B) or no-role (B2C consumer), `parent-web` → `parent`. There's no
  per-route role check beneath that gate.
- **Login is school-code-first** in admin/teacher/student/parent
  (`lookupTenantByCode` → `loginWithSchoolCode`). Super-admin and the
  student-web consumer flow use plain email/password (the consumer flow also has
  Google sign-in).
- **Notifications** flow through the shared `useNotifications` family — every
  app's `<NotificationsPage>` is a thin wrapper over the shared UI.

## 6. Cross-app quirks worth knowing

- **Two `recordItemAttempt` payload contracts** hit the same Cloud Function —
  student-web's `useSaveAnswer` sends a session-based payload, shared
  `useRecordItemAttempt` sends a scored payload. Discriminated-union hook is
  overdue.
- **`process.env` shim** (`define: { "process.env": "{}" }`) is in every app's
  `vite.config.ts` because Firebase's modular SDK still probes `process.env`
  paths in the browser.
- **`drop_console: true`** in every app's terser config + ESLint warning on raw
  `console.log` — production silently swallows debug logs.
- **Charts are deliberately library-free** outside super-admin: hand-rolled SVG
  keeps the learner/parent bundles light, super-admin pays the recharts cost
  because it's an internal app.
- **No unit tests anywhere** — every regression must be caught by Playwright
  (single-worker per app). Pure modules like `auto-evaluate-client.ts`,
  `usePagination`, `useSort`, the timed-test status mapping, and the
  `MiniLineChart` math are obvious vitest candidates.
- **Service worker cache name is a hard-coded constant per app** (e.g.
  `levelup-student-v2`, `levelup-parent-v2`) — needs manual bumping to ship a
  cache-invalidating release.

## 7. Where to start by task

- **Onboarding a new engineer to the monorepo:** read `super-admin.md` for the
  cleanest end-to-end picture (smallest blast radius, no consumer flow, no PWA
  quirks beyond the standard), then read `student-web.md` for the richest
  patterns (RTDB, hybrid grading, dual layouts, 15 question types).
- **Touching shared UI/hooks/services:** read `teacher-web.md` and
  `student-web.md` together — they hit the widest surface of the shared packages
  and are most likely to break first.
- **Multi-tenant / billing / lifecycle work:** start in `super-admin.md` (tenant
  CRUD, lifecycle, data export, audit log, LLM usage) then `admin-web.md`
  (per-tenant view of the same).
- **Anything parent-facing:** `parent-web.md` is small enough to read end-to-end
  in one sitting.
