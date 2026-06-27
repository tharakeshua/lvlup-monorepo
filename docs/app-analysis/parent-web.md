# parent-web — Architecture Notes

## 1. Purpose & Audience

`@levelup/parent-web` is the **Parent Portal** in the LevelUp monorepo: a
read-mostly React SPA that lets a parent monitor their linked children's
progress at a specific school (tenant). Inferred from `package.json`
(`"name": "@levelup/parent-web"`), the `<title>` in `index.html` ("LevelUp -
Parent Portal"), and the page set under `src/pages/`.

Access is restricted to `parent` memberships — `RequireAuth` in `App.tsx:45` is
gated on `allowedRoles={["parent"]}`. Login is school-code-first
(`LoginPage.tsx`): the parent enters a tenant short code, then email/password —
implying parents may belong to multiple schools but each session is scoped to
one. The `RoleSwitcher` in `AppLayout.tsx` surfaces only parent-role
memberships.

## 2. Tech Stack

From `package.json`: React 18.3 + Vite 5.4 (SWC) + TS 5.8; `react-router-dom`
v7; `@tanstack/react-query` v5; `firebase` v11 (Auth + Firestore from the
browser); `react-hook-form` + `@hookform/resolvers` + `zod` (only `LoginPage`
and `SettingsPage` have forms — and `LoginPage` doesn't actually use them);
Tailwind 3.4 via `@levelup/tailwind-config`; `clsx` + `tailwind-merge`;
`next-themes`; `lucide-react`; `sonner`. Workspace deps:
`@levelup/shared-{ui,hooks,services,stores,utils}`.

## 3. Entry & Bootstrap

- `index.html` — single `<div id="root">`, theme color `#6366f1`, registers
  `/manifest.json`, preconnects to the three Firebase hosts
  (firestore/identitytoolkit/firebaseinstallations).
- `src/main.tsx` (lines 11–67): builds a `QueryClient` (`retry: 1`,
  `refetchOnWindowFocus: false`); calls `initializeFirebase({...})` with seven
  `VITE_FIREBASE_*` env vars; wraps the tree in
  `ErrorBoundary → ThemeProvider → QueryClientProvider → BrowserRouter → App`
  and mounts `<SonnerToaster>`; calls `reportWebVitals()`; in production
  registers `/sw.js` with an hourly update poll and dispatches
  `sw-update-available` on new installs.
- `vite.config.ts`: dev port **4571**; plugins `@vitejs/plugin-react-swc`,
  gzip + brotli compression, optional bundle visualizer (`ANALYZE=true`); alias
  `@ → ./src`; `dedupe` for react/react-dom/react-router-dom;
  `define: { "process.env": "{}" }` shim; target ES2020, terser `drop_console`,
  `cssCodeSplit`, manual vendor chunks (§11).

## 4. Routing Map

All routes live in `App.tsx:39-62`. Every authenticated route sits under
`RequireAuth allowedRoles={["parent"]}` → `AppLayout` and is wrapped in
`RouteErrorBoundary`. Page components are `lazy()`-imported under one top-level
`<Suspense fallback={<PageLoader />}>`.

| Path              | Component               | Notes                                                                        |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `/login`          | `LoginPage`             | `AuthLayout`. Two-step (school code → credentials); Firebase password reset. |
| `/`               | `DashboardPage`         | Children + at-risk overview.                                                 |
| `/children`       | `ChildrenPage`          | List of linked students.                                                     |
| `/results`        | `ExamResultsPage`       | Released submissions, per-question accordion.                                |
| `/progress`       | `SpaceProgressPage`     | Space-level progress per child.                                              |
| `/child-progress` | `ChildProgressPage`     | Drill-down trends; reads `?student=` query param.                            |
| `/alerts`         | `PerformanceAlertsPage` | At-risk + low-score alerts.                                                  |
| `/compare`        | `ChildComparisonPage`   | Side-by-side metrics across children.                                        |
| `/notifications`  | `NotificationsPage`     | Wraps `NotificationsPageUI`.                                                 |
| `/settings`       | `SettingsPage`          | Notification prefs + logout.                                                 |
| `*`               | `NotFoundPage`          | Defined both inside and outside the authenticated shell.                     |

## 5. Pages & Key Components

- **DashboardPage** — header + inline `DataFreshnessIndicator`
  (DashboardPage.tsx:64-105), four `ScoreCard`s, `AnimatedList` of children,
  quick links. Driven by `useStudentSummaries`.
- **ChildrenPage** — grid with `ProgressRing` + `AtRiskBadge` + per-child links.
- **ChildProgressPage** — child tabs, summary cards, embeds
  `PerformanceTrendsChart`, `DownloadPDFButton` → `callGenerateReport`.
- **ExamResultsPage** — submission `Accordion`; nested `QuestionFeedbackSection`
  lazily fetches per-question feedback via `useQuestionSubmissions`.
- **SpaceProgressPage** — groups `SpaceProgress` by student; joins names via
  `useSpaceNames`.
- **PerformanceAlertsPage** — derives alerts per child from
  `useStudentProgressSummary`.
- **ChildComparisonPage** — static `METRICS` table (lines ~40–80) → one
  `SimpleBarChart` per metric.
- **NotificationsPage** — thin wrapper over `NotificationsPageUI`.
- **SettingsPage** — notification toggles via
  `useNotificationPreferences`/`useSaveNotificationPreferences`; embeds
  `LogoutButton`.
- **LoginPage** — see §1; only form using local `useState` instead of
  `react-hook-form`.

The only custom UI component: **`components/PerformanceTrendsChart.tsx`** —
`usePerformanceTrends`-fed line chart on a hand-rolled SVG `MiniLineChart`.

## 6. State Management

Three layers, no Context/Redux/custom store inside `src/`:

1. **React Query** for all server state. Every custom hook in `src/hooks/` is a
   `useQuery`/`useMutation` with stable keys shaped like
   `["tenants", tenantId, <kind>, ...args]` and explicit `staleTime`s (5–10 min
   for reference lookups, 60 s for live `useChildProgress`).
2. **Zustand stores from `@levelup/shared-stores`**: `useAuthStore` (Firebase
   user, `currentMembership`, `currentTenantId`, `allMemberships`,
   `loading`/`error`, `loginWithSchoolCode`, `logout`, `switchTenant`,
   `initialize`) and `useTenantStore` (real-time tenant doc subscription).
   `App.tsx:26-37` runs `initialize()` once and resubscribes the tenant doc on
   every `currentTenantId` change. Selectors
   `useCurrentUser`/`useCurrentMembership`/`useCurrentTenantId` are imported
   throughout.
3. **Local `useState`** for ephemeral UI only (login step, password visibility,
   filter toggles, dirty flags).

## 7. Data Layer

The app talks to Firebase **directly** via the modular SDK — no REST/API layer.
`getFirebaseServices()` from `@levelup/shared-services` returns
`{ db, auth, ... }`; every hook destructures `db` inside its `queryFn`.
Collection paths used locally:

- `userMemberships` filtered by `tenantId + parentId + role=="student"` —
  `useLinkedStudents` (parent→student linkage).
- `tenants/{tid}/submissions` filtered by `studentId in [...]` +
  `resultsReleased == true`, ordered by `createdAt desc` —
  `useChildSubmissions`, with a follow-up `documentId() in` against
  `tenants/{tid}/exams` for `examTitle/examSubject`.
- `tenants/{tid}/submissions/{sid}/questionSubmissions` —
  `useQuestionSubmissions`.
- `tenants/{tid}/spaceProgress` filtered by `userId in [...]` —
  `useChildProgress`.
- `tenants/{tid}/spaces`, `users/{uid}`, `tenants/{tid}` — id-resolution hooks
  (`useSpaceNames`, `useStudentNames`, `useTenantNames`).
- `tenants/{tid}/notificationPreferences/{uid}` — read +
  `setDoc({ merge: true })` (the **only direct write** in the app).

Firestore's 30-item `in` cap is respected via
`for (let i; i < ids.length; i += 30)` batching in `useChildSubmissions`,
`useChildProgress`, `useSpaceNames`. The only Cloud Function call is
`callGenerateReport` (PDF, used by `ChildProgressPage` and `ExamResultsPage`).
Notifications come through
`useNotifications`/`useUnreadCount`/`useMarkRead`/`useMarkAllRead` in
`@levelup/shared-hooks`.

## 8. Shared Package Usage

Files importing, descending:

- **`shared-ui`** (15) — shell (`AppShell`, `AppSidebar`, `MobileBottomNav`,
  `RoleSwitcher`, `NotificationBell`, `NotificationsPage`), error/loading
  (`ErrorBoundary`, `RouteErrorBoundary`, `PageLoader`, `PageTransition`,
  `RouteAnnouncer`, `SkipToContent`, `NotFoundPage`), PWA chrome
  (`SWUpdateNotification`, `PWAInstallBanner`, `OfflineBanner`), primitives,
  domain widgets (`ScoreCard`, `ProgressRing`, `AtRiskBadge`, `SimpleBarChart`,
  `DownloadPDFButton`, `LogoutButton`), motion, toasts, `ThemeToggle`.
- **`shared-types`** (14) — `Tenant`, `UserMembership`, `Submission`, `Exam`,
  `QuestionSubmission`, `SpaceProgress`, `Space`, `StudentProgressSummary`,
  `UnifiedUser`, `TenantRole`.
- **`shared-stores`** (13) — `useAuthStore`, `useTenantStore`,
  `useCurrent{User,Membership,TenantId}` selectors.
- **`shared-services`** (13) — `initializeFirebase`, `getFirebaseServices`,
  `lookupTenantByCode`, `callGenerateReport`.
- **`shared-hooks`** (8) — `useStudentSummaries`, `useStudentProgressSummary`,
  `usePerformanceTrends`,
  `useNotifications`/`useUnreadCount`/`useMarkRead`/`useMarkAllRead`,
  `useTenantBranding`, `usePrefetch`.
- **`shared-utils/web-vitals`** (1) — `reportWebVitals`.

## 9. Auth & Permissions

Sign-in is **school-code + email/password** (`LoginPage`):
`lookupTenantByCode(code)` validates the tenant and its `status === "active"`,
then `useAuthStore.loginWithSchoolCode(code, email, password)` performs the
Firebase sign-in scoped to that tenant. Password reset uses
`sendPasswordResetEmail(auth, email)` directly (LoginPage.tsx:84-93).
`useAuthStore.initialize()` runs once on mount (App.tsx:27) and returns the
`onAuthStateChanged` unsubscribe. `RequireAuth` shows a loader while `loading`,
redirects to `/login` preserving `state.from`, or renders an "Access Denied"
panel on role mismatch. `allMemberships` is filtered to parent rows for the
`RoleSwitcher`; `switchTenant(...)` flips `currentTenantId` and App.tsx:31-37
resubscribes the tenant doc.

## 10. Styling

Tailwind 3.4 via the `@levelup/tailwind-config` preset. `tailwind.config.ts`
extends content paths to `../../packages/shared-ui/src/**/*.{ts,tsx}` and
imports `sharedSafelist`; local `theme.extend.colors` adds
`success`/`warning`/`info` palettes bound to CSS vars. `src/index.css` just
imports `@levelup/tailwind-config/variables.css` + the three `@tailwind`
directives. Dark mode is `next-themes` (class strategy, system default).
`useTenantBranding()` in `AppLayout` applies per-tenant colors as CSS custom
properties at runtime. `cn()` (`src/lib/utils.ts`) is `clsx + tailwind-merge`.

## 11. Build & Tooling

Scripts: `dev` (4571), `build`, `preview`, `lint`, `typecheck`, `analyze`
(toggles `ANALYZE=true` → visualizer); `test` is a stub. Every route is
`lazy()`-imported; `PARENT_PREFETCH_MAP` (AppLayout.tsx:21-33) feeds
`usePrefetch` to warm bundles on link hover. Manual chunks split out
`vendor-{react,firebase,query,radix}` (vite.config.ts:33-44).
`vite-plugin-compression` emits `.gz` + `.br` for assets > 1 KB; production
source maps stay on; terser drops `console.log`/`debugger`. ESLint (flat)
extends `@typescript-eslint/recommended` + `react-hooks` recommended-latest;
warns on `any`/`console`, errors on `var`/reassignment. Runtime env: seven
`VITE_FIREBASE_*` keys (main.tsx:20-28).

## 12. Tests

No unit tests. Playwright E2E in `e2e/`: `playwright.config.ts` runs serially
(`fullyParallel: false`, 1 worker, `baseURL: http://localhost:4571`,
`video: 'on'`, 60 s test / 15 s expect timeouts). `auth.spec.ts` covers the
login flow (redirect, school-code step, credentials step, sign-in, dashboard
render); `dashboard.spec.ts` covers authenticated content; `responsive.spec.ts`
covers mobile-nav. `helpers.ts` ships `SCHOOL_CODE='GRN001'` + two seeded parent
credential pairs and `loginAsParent` / `logoutParent` drivers. Tests assume seed
data in dev/emulator Firebase; no runner is wired to `npm test`.

## 13. Notable Patterns & Quirks

- **PWA**: installable `public/manifest.json` + hand-written `public/sw.js`
  (cache `levelup-parent-v2`, max 60 entries, `SKIP_CACHE_DOMAINS` for every
  Firebase host so auth tokens never go stale). `SWUpdateNotification` /
  `PWAInstallBanner` / `OfflineBanner` mount in `AppLayout`.
- **Dual chrome**: `AppSidebar` (desktop) + `MobileBottomNav` (mobile) ship as
  separate item lists; `AppShell`'s `hasBottomNav` adjusts padding.
- **Tenant-scoped query keys**: every key starts with
  `["tenants", tenantId, ...]`; switching tenants invalidates automatically — no
  manual `invalidateQueries`.
- **Data freshness UI**: `DashboardPage` defines an inline
  `DataFreshnessIndicator` (DashboardPage.tsx:64-105) showing `dataUpdatedAt` +
  manual refetch — not yet replicated elsewhere.
- **No charting library**: `MiniLineChart` (PerformanceTrendsChart.tsx:22-60)
  and shared-ui's `SimpleBarChart` are hand-rolled SVG.
- **`process.env` shim**: `define: { "process.env": "{}" }` keeps Firebase's
  modular SDK happy in the browser.
- **Read-mostly**: a single direct Firestore write across the whole app
  (`setDoc` in `useSaveNotificationPreferences`); everything else is reads or a
  Cloud Function call.

## 14. Open Questions / TODOs

- `useSpaceNames` and the exam-title join in `useChildSubmissions` swallow batch
  errors with empty `catch {}` — partial failures (denied reads) are invisible.
  Worth instrumenting.
- `useStudentNames` falls back to `uid.slice(0, 8)`; `getStudentDisplayName`
  falls back again to `studentId`/`Child N`. Overlapping fallbacks complicate
  debugging.
- `LoginPage` is the only form not using `react-hook-form`/`zod` (both already
  in deps).
- `useChildSubmissions` queries `resultsReleased == true` only — no UI
  affordance for _pending_ submissions. Likely intentional but worth confirming.
- `manifest.json` uses `"purpose": "any maskable"` which Chromium now flags as
  ambiguous; should be split.
- No unit tests; Playwright covers happy paths only — no negative tests for
  tenant switching or multi-child households beyond the two seeded credentials.
- The outer `*` route (`App.tsx:59`) renders bare `NotFoundPage` for
  unauthenticated random paths instead of redirecting to `/login`.
