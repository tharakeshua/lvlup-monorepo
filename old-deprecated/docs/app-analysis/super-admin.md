# super-admin — Architecture

Read-only analysis of `apps/super-admin` based on source inspection only (no
build / runtime).

## 1. Purpose & audience

`@levelup/super-admin` (`apps/super-admin/package.json:2`) is the **platform
control plane** for LevelUp staff. It is _not_ a tenant-facing app — every
authenticated user must have `user.isSuperAdmin === true` _and_ a Firebase
custom claim of `role === "superAdmin"` (`src/guards/RequireAuth.tsx:22,48`).
The route names — Tenants, Global Presets, Feature Flags, LLM Usage, System
Health, Announcements, Global Users — make the role explicit: this is an
ops/finance console for managing the multi-tenant SaaS, not for delivering
classroom features. Branding in `src/layouts/AuthLayout.tsx:14` ("Super Admin
Control Center") confirms the audience.

## 2. Tech stack

From `apps/super-admin/package.json`:

- **Framework**: React 18.3 + Vite 5.4 with `@vitejs/plugin-react-swc`.
- **Router**: `react-router-dom` v7 (`BrowserRouter`, `Routes`, `Outlet`, lazy
  routes).
- **Server state**: `@tanstack/react-query` v5 — every data fetch goes through
  it.
- **Client state**: Zustand via `@levelup/shared-stores` (`useAuthStore`).
- **Forms**: `react-hook-form` + `@hookform/resolvers` + `zod` for schema
  validation.
- **Backend**: `firebase` v11 (Auth + Firestore, plus callable Cloud Functions
  via shared services).
- **UI**: Tailwind v3.4 (`presets: [sharedConfig]` in `tailwind.config.ts:6`) +
  `@levelup/shared-ui` (shadcn-style primitives) + `lucide-react` icons +
  `recharts` for charts + `sonner` for toasts + `next-themes` for dark mode.
- **Utilities**: `clsx` + `tailwind-merge` → `cn()` (`src/lib/utils.ts:4`).
- **Tooling**: TypeScript 5.8, ESLint (flat config) with `@typescript-eslint`
  and `eslint-plugin-react-hooks`, Playwright for e2e (declared via the
  workspace, not in this `package.json`).

## 3. Entry & bootstrap

- `index.html` mounts `<div id="root">`, declares the PWA manifest
  (`/manifest.json`), apple-touch-icon, theme color `#6366f1`, and adds
  `preconnect`/`dns-prefetch` hints for Firebase Auth/Firestore/Installations
  endpoints to shave first-paint latency (`index.html:15-19`).
- `src/main.tsx` is the bootstrap:
  - Creates a single `QueryClient` with `retry: 1` and
    `refetchOnWindowFocus: false` (`main.tsx:11-18`).
  - `initializeFirebase(...)` from `@levelup/shared-services` is fed
    `VITE_FIREBASE_*` env vars (`main.tsx:20-28`) — apiKey, authDomain,
    projectId, storageBucket, messagingSenderId, appId, databaseURL.
  - Provider stack (outer→inner): `ErrorBoundary` →
    `ThemeProvider attribute="class" defaultTheme="system"` →
    `QueryClientProvider` → `BrowserRouter` → `<App />` +
    `<SonnerToaster richColors position="top-right" />`.
  - `reportWebVitals()` (from `@levelup/shared-utils/web-vitals`) wires
    FCP/LCP/CLS/FID/TTFB.
  - Registers `/sw.js` in production only (`main.tsx:47-67`), polls every hour
    for SW updates, and dispatches a `sw-update-available` event that
    `SWUpdateNotification` consumes in the layout.
- `vite.config.ts` runs on port 4567, aliases `@ → ./src`, dedupes React +
  react-router, gzip+brotli compresses anything > 1 KB, sets `target: es2020`,
  `minify: 'terser'` with `drop_console`/`drop_debugger`, splits manual chunks
  into `vendor-react`, `vendor-firebase`, `vendor-query`, `vendor-radix`, and
  emits `assets/[name]-[hash]`. `ANALYZE=true` enables
  `rollup-plugin-visualizer` writing `dist/bundle-report.html`
  (`vite.config.ts:7,17`).
- `tailwind.config.ts` extends `@levelup/tailwind-config` and pulls `safelist`
  from `@levelup/tailwind-config/safelist`. Content globs include
  `../../packages/shared-ui/src/**/*.{ts,tsx}` so utilities used in shared
  components are kept.

## 4. Routing map

All routes live in `src/App.tsx:33-54`. Every protected page is wrapped in
`RouteErrorBoundary` (from shared-ui) and lazy-loaded via `React.lazy` +
`<Suspense fallback={<PageLoader/>}>` for code splitting.

| Path                 | Component           | Guard / Layout                             |
| -------------------- | ------------------- | ------------------------------------------ |
| `/login`             | `LoginPage`         | `AuthLayout` (no auth)                     |
| `/`                  | `DashboardPage`     | `RequireAuth` → `AppLayout`                |
| `/tenants`           | `TenantsPage`       | `RequireAuth` → `AppLayout`                |
| `/tenants/:tenantId` | `TenantDetailPage`  | `RequireAuth` → `AppLayout`                |
| `/analytics`         | `UserAnalyticsPage` | `RequireAuth` → `AppLayout`                |
| `/feature-flags`     | `FeatureFlagsPage`  | `RequireAuth` → `AppLayout`                |
| `/presets`           | `GlobalPresetsPage` | `RequireAuth` → `AppLayout`                |
| `/llm-usage`         | `LLMUsagePage`      | `RequireAuth` → `AppLayout`                |
| `/system`            | `SystemHealthPage`  | `RequireAuth` → `AppLayout`                |
| `/settings`          | `SettingsPage`      | `RequireAuth` → `AppLayout`                |
| `/announcements`     | `AnnouncementsPage` | `RequireAuth` → `AppLayout`                |
| `/users`             | `GlobalUsersPage`   | `RequireAuth` → `AppLayout`                |
| `*`                  | `NotFoundPage`      | both inside and outside the protected tree |

## 5. Pages & key components

Pages live in `src/pages/`. One-liners:

- `LoginPage.tsx` — email/password sign-in calling `useAuthStore().login`;
  redirects back to `location.state.from` after success.
- `DashboardPage.tsx` (545 lines) — Platform-wide KPIs (tenants, users, exams,
  spaces), month-over-month growth, active-users-7d, a Recharts bar chart of top
  tenants, a pie chart of users-by-plan, an activity feed from
  `platformActivityLog`, and a recent-tenants list.
- `TenantsPage.tsx` — paginated/sortable/searchable table of all tenants with a
  "Create Tenant" dialog (zod + react-hook-form) calling `callSaveTenant`.
- `TenantDetailPage.tsx` — header + 4 stat cards + subsection cards composed
  from `components/tenant-detail/` (subscription, lifecycle, data export, audit
  log) + Edit / Delete dialogs.
- `FeatureFlagsPage.tsx` — flag matrix: list of `KNOWN_FLAGS` (autoGrade,
  levelUpSpaces, scannerApp, aiChat, aiGrading, analytics, parentPortal,
  bulkImport, apiAccess) toggled per tenant, batched into `callSaveTenant`.
- `GlobalPresetsPage.tsx` — CRUD for global evaluation-dimension presets
  (clarity/accuracy/...); calls `callSaveGlobalEvaluationPreset`.
- `LLMUsagePage.tsx` — month picker that queries `dailyCostSummaries` collection
  with `where`/`orderBy`, rendering totals and per-tenant breakdown with
  Recharts.
- `UserAnalyticsPage.tsx` — student/teacher counts and plan distribution
  aggregated from `tenants` documents.
- `SystemHealthPage.tsx` — runs Firestore, Auth, Cloud Functions, and
  AI-pipeline probes; writes a daily snapshot to
  `platformHealthSnapshots/{YYYY-MM-DD}`; pulls a summary via
  `callGetPlatformSummary`.
- `AnnouncementsPage.tsx` — tabbed CRUD over announcements via
  `callListAnnouncements` / `callSaveAnnouncement`.
- `SettingsPage.tsx` — reads/writes `platform/config` (announcement,
  maintenanceMode, defaultPlan, etc.).
- `GlobalUsersPage.tsx` — debounced (300 ms) global user search via
  `callSearchUsers`; clicking a result navigates to the user's first tenant.

`src/components/tenant-detail/` contains six focused cards/dialogs:

- `EditTenantDialog.tsx` — zod-validated edit form →
  `callSaveTenant({ id, data })`.
- `DeleteTenantDialog.tsx` — "type the tenant code to confirm" gate →
  `callDeactivateTenant`.
- `TenantSubscriptionCard.tsx` — plan/limits editor.
- `TenantLifecycleCard.tsx` — Deactivate / Reactivate buttons calling
  `callDeactivateTenant` / `callReactivateTenant`.
- `TenantDataExportCard.tsx` — CSV/JSON export via `callExportTenantData`
  (students, teachers, classes, exams, submissions).
- `TenantAuditLogCard.tsx` — paginated `auditLogs` Firestore query filtered by
  `tenantId`.

## 6. State management

Two clean layers:

- **Server state** — `@tanstack/react-query` everywhere. Query keys follow a
  `["platform", <entity>, …]` convention: `["platform", "stats"]`,
  `["platform", "tenants"]`, `["platform", "tenant", id]`,
  `["platform", "tenantFlags"]`, `["platform", "config"]`,
  `["platform", "globalUserSearch", q]`, etc. Stale times are typically 30–60 s.
  Mutations call `queryClient.invalidateQueries` on success to keep the cache
  consistent (e.g., `TenantsPage.tsx:102-103`).
- **Client/auth state** — `useAuthStore` from `@levelup/shared-stores`
  (Zustand). `App.tsx:24-29` calls `initialize()` once at mount and uses the
  returned unsubscribe as a cleanup, which is the canonical `onAuthStateChanged`
  lifecycle. The store exposes `firebaseUser`, `user` (Firestore profile),
  `loading`, `error`, `login`, `logout`, `clearError`, plus `useCurrentUser()`
  selector hook.

Local UI state is `useState`/`useReducer` per component. Two small custom hooks
back the tables:

- `hooks/usePagination.ts` — generic, resets to page 1 when `items.length`
  changes.
- `hooks/useSort.ts` — three-state cycle (asc → desc → none) with
  `localeCompare({ numeric: true })`.

## 7. Data layer

Two channels, both proxied through `@levelup/shared-services`:

1. **Direct Firestore reads** via `getFirebaseServices().db` and the v9 modular
   SDK (`collection`, `getDocs`, `getDoc`, `doc`, `query`, `where`, `orderBy`,
   `limit`, `setDoc`). Used for list/aggregate views: `tenants`,
   `platformActivityLog`, `platform/config`, `dailyCostSummaries`, `auditLogs`,
   `users` (active-7d), `platformHealthSnapshots`.
2. **Callable Cloud Functions** invoked via typed wrappers re-exported from
   `@levelup/shared-services` (and a sub-path `@levelup/shared-services/auth`
   for the announcement / lifecycle / export ones). The set actually used in
   this app:
   - `callSaveTenant` (create + update)
   - `callDeactivateTenant`, `callReactivateTenant`
   - `callExportTenantData`
   - `callSearchUsers`
   - `callGetPlatformSummary`
   - `callSaveAnnouncement`, `callListAnnouncements`
   - `callSaveGlobalEvaluationPreset`

`SystemHealthPage.tsx:81-86` also writes daily snapshots back to Firestore
directly (`platformHealthSnapshots/{date}`), bypassing the callable layer.

There is no GraphQL or REST client; Firestore + callables is the entire data
layer.

## 8. Shared package usage

- `@levelup/shared-services` — `initializeFirebase`, `getFirebaseServices`, all
  `call*` callables. Includes a deep import path `@levelup/shared-services/auth`
  for auth/lifecycle callables.
- `@levelup/shared-stores` — `useAuthStore`, `useCurrentUser`.
- `@levelup/shared-hooks` — `usePrefetch` (route prefetch on hover),
  `useApiError` (toast + log helper used inside every mutation `onError`).
- `@levelup/shared-ui` — almost every visible primitive: `AppShell`,
  `AppSidebar`, `AppBreadcrumb`, `MobileBottomNav`, `PageTransition`,
  `RouteAnnouncer`, `SkipToContent`, `SWUpdateNotification`, `ErrorBoundary`,
  `RouteErrorBoundary`, `PageLoader`, `NotFoundPage`, `LogoutButton`,
  `ThemeToggle`, `SonnerToaster` + the shadcn-style `Button`, `Card*`,
  `Dialog*`, `AlertDialog*`, `Form*`, `Input`, `Label`, `Select*`, `Tabs*`,
  `Table*`, `DataTablePagination`, `SortableTableHead`, `Skeleton`, `Alert*`,
  `StatCard`, `StatusBadge`, `PageHeader`, `Progress`, `Switch`, `Tooltip*`,
  `Checkbox`, `Textarea`, `Badge`, `SearchInput`, plus `sonnerToast` alias.
- `@levelup/shared-types` — `Tenant`, `PlatformActivityLog`,
  `EvaluationSettings`, `EvaluationDimension`, `HealthSummaryResponse`,
  `DailyCostSummary`, `SearchUsersResponse`, `SaveAnnouncementRequest`,
  `ListAnnouncementsResponse`.
- `@levelup/shared-utils` — `web-vitals` reporter.
- Dev: `@levelup/tailwind-config` (preset + variables.css + safelist),
  `@levelup/eslint-config`.

The takeaway: this app is _almost entirely_ a presentation layer over the shared
packages.

## 9. Auth & permissions

- Sign-in: `LoginPage.tsx` calls `useAuthStore().login(email, password)`, then
  redirects to `location.state.from?.pathname` (default `/`).
- Route protection: `guards/RequireAuth.tsx` is the only guard component. It
  does **defense-in-depth**:
  1. Wait for `useAuthStore().loading` to settle.
  2. If no `firebaseUser` → `<Navigate to="/login" state={{ from }} replace />`.
  3. Independently call `firebaseUser.getIdTokenResult()` and verify
     `claims.role === "superAdmin"` (`RequireAuth.tsx:18-32`).
  4. Block render unless `user.isSuperAdmin && claimsVerified` — both the
     Firestore flag _and_ the custom claim must agree (`RequireAuth.tsx:48`).
     Failures render an inline "Access Denied" panel with a sign-out button,
     deliberately avoiding a redirect loop.
- There are no per-route role checks below the super-admin gate — every
  protected route is equally restricted.
- Logout is centralized via `LogoutButton` + `useAuthStore().logout`.

## 10. Styling

- Tailwind v3.4 with PostCSS + Autoprefixer. The local config
  (`tailwind.config.ts`) is a thin extension of `@levelup/tailwind-config`
  (preset + shared safelist).
- `src/index.css` imports `@levelup/tailwind-config/variables.css` (the HSL
  CSS-variable design tokens), declares `@tailwind base/components/utilities`,
  and adds a few `@layer base` rules (`scroll-behavior: smooth`, accessible
  `:focus-visible` ring) and overrides for `recharts-default-tooltip` to honor
  the popover tokens.
- Theming is `next-themes` with `attribute="class"` and `defaultTheme="system"`
  (`main.tsx:32`); the toggle is `<ThemeToggle />` in the header
  (`AppLayout.tsx:170`). Dark-mode classes appear throughout (e.g.,
  `dark:bg-emerald-950/30`).
- All visible UI is built from `@levelup/shared-ui` primitives
  (shadcn/Radix-style). The app barely contains any hand-rolled CSS beyond
  layout utility classes.

## 11. Build & tooling

- Scripts (`package.json:6-14`): `dev` (vite, port 4567), `build`, `preview`,
  `lint` (eslint on `src/**/*.{ts,tsx}`), `typecheck` (`tsc --noEmit`), `test`
  (echoes "No unit tests for super-admin"), `analyze` (`ANALYZE=true vite build`
  → `dist/bundle-report.html`).
- `vite.config.ts` plugins: `@vitejs/plugin-react-swc`, two
  `vite-plugin-compression` instances (gzip + brotli, threshold 1 KB), and a
  conditional `rollup-plugin-visualizer`.
- Manual chunks split vendor code into `vendor-react`, `vendor-firebase`,
  `vendor-query`, `vendor-radix`; assets hashed under `assets/`, `chunks/`,
  `entries/`.
- TypeScript split into `tsconfig.app.json` + `tsconfig.node.json` (the standard
  Vite layout), with incremental `tsbuildinfo` files committed alongside.
- ESLint flat config (`eslint.config.cjs`): JS recommended,
  `@typescript-eslint/recommended`, react-hooks recommended-latest,
  `no-explicit-any: warn`, `no-console: ['warn', { allow: ['warn','error'] }]`,
  `prefer-const`, `no-var`.
- Env handling: only `import.meta.env.VITE_FIREBASE_*` and
  `import.meta.env.PROD` are read; nothing app-specific beyond Firebase config.
- PWA: `public/manifest.json`, `public/sw.js` (registered only in prod),
  `public/offline.html`, and PNG icons in `public/icons/`.

## 12. Tests

- No unit tests in the app (npm test is a no-op).
- Playwright e2e under `apps/super-admin/e2e/`: `auth.spec.ts`,
  `dashboard.spec.ts`, `tenant-management.spec.ts`, `responsive.spec.ts`, plus
  `helpers.ts` with `loginAsSuperAdmin` / `logoutSuperAdmin` and credentials
  `superadmin@levelup.app / Test@12345` (`e2e/helpers.ts:3-6`).
- `playwright.config.ts`: `baseURL: http://localhost:4567`, `workers: 1`,
  `fullyParallel: false`, 60 s test timeout, 15 s expect/action timeouts, video
  always on, traces on first retry, screenshots on failure. The runner expects a
  dev server already up — there is no `webServer` block.
- Tags are baked into test titles (`P0:`, `P1:`) for filtering.

## 13. Notable patterns or quirks

- **Two-source role check.** Super-admin gating verifies _both_ the Firestore
  `user.isSuperAdmin` flag and the Firebase custom claim `role === "superAdmin"`
  independently in `RequireAuth.tsx:11-32,48`. Comments call out fixes "C1"/"C2"
  — they're intentional belt-and-braces.
- **Route prefetch on hover.** `AppLayout.tsx:73` calls
  `usePrefetch(SA_PREFETCH_MAP)` so the lazy chunk for a route is fetched the
  moment the user hovers the sidebar link.
- **Layout combines AppShell + MobileBottomNav.** Desktop uses `<AppSidebar>`
  inside `<AppShell hasBottomNav>`, mobile gets `<MobileBottomNav>` (Home /
  Tenants / Health / Settings — a 4-tab subset of the desktop nav, not all of
  it).
- **`PageTransition pageKey={location.pathname}`** wraps `<Outlet />` for
  animated route changes; `RouteAnnouncer` announces nav for screen readers;
  `SkipToContent` + `id="main-content"` is correctly wired for a11y.
- **Service worker** is only registered in `import.meta.env.PROD`, polls for
  updates hourly, and emits a custom `sw-update-available` event that
  `SWUpdateNotification` (in the layout) consumes — there is no toast hard-coded
  into bootstrap.
- **Firestore writes from the client** are limited to `platform/config`
  (`SettingsPage`) and `platformHealthSnapshots/{date}` (`SystemHealthPage`);
  everything else is callable-mediated. A reader pricing/security audit should
  focus on these two paths.
- **Daily-summary writes** in `SystemHealthPage` use `setDoc` with the date as
  the doc id — running the page twice in a day silently overwrites the earlier
  snapshot.
- **`process.env` shim.** `vite.config.ts:26` defines `process.env: '{}'` so
  dependencies that probe `process.env.NODE_ENV` don't blow up in the browser
  bundle.
- **`SortableTableHead` ↔ `useSort`** are deliberately decoupled — the hook
  tracks `{ key, direction }`, the head renders the arrow.
- **No global error toast pipe.** Errors surface via `useApiError().handleError`
  inside each mutation's `onError`, plus per-page
  `<Alert variant="destructive">` for query errors with a "Try again"
  `refetch()` button.

## 14. Open questions / TODOs

- **`SystemHealthPage` overwrites snapshots within a day.** If multiple admins
  run a probe, only the last result is preserved. A history collection or
  `{date}/{checkedAt}` sub-doc would be more useful.
- **`EditTenantDialog` schema lacks `deactivated`.** The zod enum allows
  `deactivated` (`EditTenantDialog.tsx:40`) but the `<SelectContent>` only
  renders `active / trial / suspended / expired`
  (`EditTenantDialog.tsx:120-124`) — a deactivated tenant cannot be re-set to
  deactivated from the dialog (probably fine, but worth confirming the intent).
- **`activeUsers7d` swallows index errors.** `DashboardPage.tsx:106` silently
  sets the metric to 0 if the `users.lastLoginAt` Firestore index is missing —
  the dashboard will quietly under-report instead of surfacing the issue.
- **`GlobalUsersPage` row click is lossy.** It navigates to the user's _first_
  tenant only (`GlobalUsersPage.tsx:72-75`); multi-tenant users have no way to
  pick another from this view.
- **No unit tests.** The `test` script is a placeholder. All confidence rides on
  the four Playwright specs and on the shared packages' own tests.
- **Pagination cursor is in memory.** `usePagination` slices an already-fetched
  array — fine for a few hundred tenants, but `TenantsPage` and
  `FeatureFlagsPage` will start paying for that once the platform scales past a
  few thousand documents.
- **No central feature-flag gating on the client.** `FeatureFlagsPage` writes
  flags to tenants, but this app itself doesn't read them — gating logic lives
  in other apps. Worth confirming the flag names listed in `KNOWN_FLAGS`
  (`FeatureFlagsPage.tsx:26-36`) match what tenant-facing apps actually check.
