# STATUS: Cross-App Routing, App Shell & Navigation

Audit scope: routing approach, route guards by role, shared layout/navigation,
deployment (Firebase hosting targets), and the `start.sh` / `RUNNING_APPS.md`
dev orchestration across the 5 primary web apps (`teacher-web`, `student-web`,
`admin-web`, `super-admin`, `parent-web`), plus the separate `autograde/`
sub-monorepo.

---

## 1. What Currently Exists & How It's Architected

### 1.1 The 5 primary web apps (apps/\*)

All five are Vite + React + TypeScript SPAs that share an identical
architectural skeleton:

- **Entry**: `apps/<app>/src/main.tsx` — creates the React root, wraps the tree
  in (top → bottom): `ErrorBoundary` → `ThemeProvider` (next-themes) →
  `QueryClientProvider` (@tanstack/react-query) → `BrowserRouter` → `<App />` +
  `SonnerToaster`. Calls `initializeFirebase(...)` from env vars, calls
  `reportWebVitals()`, and registers a service worker (`/sw.js`) in production.
  Verified identical in `apps/teacher-web/src/main.tsx`; the same pattern
  repeats across apps.
- **Router root**: `apps/<app>/src/App.tsx` — uses `react-router-dom` v6
  `<Routes>/<Route>` (declarative JSX route tree, not the
  data-router/`createBrowserRouter` API). Pages are `lazy()`-loaded inside a
  single top-level `<Suspense fallback={<PageLoader />}>`.
- **Auth bootstrap in App.tsx**: every app calls
  `useAuthStore((s) => s.initialize)` in a `useEffect` and (except super-admin)
  subscribes the `useTenantStore` to `currentTenantId`. This duplicated
  `useEffect` block appears verbatim in `teacher-web`, `student-web`,
  `admin-web`, `parent-web` App.tsx (super-admin omits the tenant subscription
  because it is tenant-agnostic).

**Route nesting pattern** (consistent): a public `AuthLayout` branch holds
`/login`, then a `RequireAuth` guard wraps an `AppLayout` element that renders
the authenticated chrome and an `<Outlet/>`. Each leaf route is wrapped in
`<RouteErrorBoundary>`
(`packages/shared-ui/src/components/layout/RouteErrorBoundary.tsx`). A `*`
fallback renders `NotFoundPage`.

Per-app route inventories:

- **teacher-web** (`apps/teacher-web/src/App.tsx`): `/`, `/spaces`,
  `/spaces/:spaceId/edit`,
  `/spaces/:spaceId/story-points/:storyPointId/preview`, `/question-bank`,
  `/rubric-presets`, `/exams`, `/exams/new`, `/exams/:examId`,
  `/exams/:examId/submissions`, `/exams/:examId/submissions/:submissionId`,
  `/classes`, `/classes/:classId`, `/analytics/{classes,exams,spaces,tests}`,
  `/assignments`, `/grading`, `/students`, `/students/:studentId/report`,
  `/settings`, `/notifications`.
- **student-web** (`apps/student-web/src/App.tsx`): two guarded branches — a B2B
  branch under `AppLayout` (role `student`) and a **B2C "consumer" branch**
  under `ConsumerLayout` (no role required). B2B: `/`, `/spaces`,
  `/spaces/:spaceId`, `.../story-points/:storyPointId`,
  `.../test/:storyPointId(/analytics)`, `.../practice/:storyPointId`,
  `/exams/:examId/results`, `/notifications`, `/leaderboard`, `/tests`,
  `/settings`, `/profile`. B2C: `/consumer`, `/my-spaces`,
  `/consumer/spaces/...`, `/store`, `/store/checkout`, `/store/:spaceId`,
  `/profile`.
- **admin-web** (`apps/admin-web/src/App.tsx`): role `tenantAdmin`; `/`,
  `/users`, `/classes(/:classId)`, `/exams`, `/spaces`, `/ai-usage`,
  `/settings`, `/academic-sessions`, `/reports`, `/analytics`, `/courses`,
  `/notifications`, `/staff`, `/announcements`, `/data-export`, `/onboarding`.
  Has a bespoke **`OnboardingGuard`** function component defined inline that
  wraps every authenticated page and redirects `tenantAdmin` users with
  `tenant.onboarding.completed !== true` to `/onboarding` (super-admins bypass).
- **super-admin** (`apps/super-admin/src/App.tsx`): no `allowedRoles` prop;
  relies on a custom guard. Routes: `/`, `/tenants(/:tenantId)`, `/analytics`,
  `/feature-flags`, `/presets`, `/llm-usage`, `/system`, `/settings`,
  `/announcements`, `/users`.
- **parent-web** (`apps/parent-web/src/App.tsx`): role `parent`; `/`,
  `/children`, `/results`, `/progress`, `/child-progress`, `/alerts`,
  `/compare`, `/notifications`, `/settings`.

### 1.2 Route guards by role

Guard lives at `apps/<app>/src/guards/RequireAuth.tsx` — **5 separately
maintained copies** with drifted behavior:

- **teacher / parent** (`teacher-web`, `parent-web`): identical baseline. Reads
  `firebaseUser, currentMembership, loading` from `useAuthStore`; shows a
  "Loading..." text on `loading`; `<Navigate to="/login">` if no `firebaseUser`;
  "Access Denied" if `allowedRoles` set and membership role not in list. teacher
  allows `["teacher","tenantAdmin"]`.
- **student** (`student-web/src/guards/RequireAuth.tsx`): same baseline but with
  a **spinner** loading UI and a special branch — if no `currentMembership` (a
  consumer/B2C user) it `<Navigate to="/consumer">` instead of showing Access
  Denied. This is what powers the B2B/B2C split.
- **admin** (`admin-web/src/guards/RequireAuth.tsx`): uses a full **sidebar+grid
  Skeleton** loading UI, and adds an extra assertion
  `currentMembership.tenantId !== currentTenantId` to the access check (stricter
  tenant binding than the others).
- **super-admin** (`super-admin/src/guards/RequireAuth.tsx`): **completely
  different model** — takes no `allowedRoles`, performs an async
  `firebaseUser.getIdTokenResult()` to verify `claims.role === "superAdmin"`
  (defense-in-depth, comments labeled "Fix C1/C2"), checks both
  `user.isSuperAdmin` (Firestore doc) AND the live custom claim, and renders an
  inline `LogoutButton` on denial. Has its own `claimsVerified` state machine.

Authorization source of truth is the Zustand `useAuthStore`
(`packages/shared-stores/src/auth-store.ts`): `initialize()` subscribes to
Firebase `onAuthStateChange`, listens to `/users/{uid}` in realtime, loads
memberships via `getUserMemberships(uid)`, and restores the active tenant from
the `tenantId` custom claim (or auto-selects if exactly one membership).
`switchTenant()` calls the `callSwitchActiveTenant` cloud function then
force-refreshes the ID token.

### 1.3 Shared layout / navigation

The authenticated chrome is composed from shared primitives in
`packages/shared-ui/src/components/layout/`:

- `AppShell.tsx` — `SidebarProvider` + `SidebarInset` + sticky header (mobile
  `SidebarTrigger`, optional breadcrumb, `headerRight` slot) + `<main>`;
  reads/writes a `sidebar:state` cookie for persistence; supports `bottomNav`.
- `AppSidebar.tsx` — data-driven sidebar from a `NavGroup[]` config
  (`{label, items: {title, url, icon, badge, isActive}}`), `appName`,
  `footerContent`, injectable `LinkComponent` (so the package stays
  router-agnostic), and an auto-close-on-navigation behavior for mobile. Defines
  an `AppRole` union locally.
- `RoleSwitcher.tsx`, `MobileBottomNav.tsx`, `NotFoundPage.tsx`,
  `RouteErrorBoundary.tsx`, plus `AppBreadcrumb` (used only by super-admin).

**Each app implements its own `layouts/AppLayout.tsx`** that hand-builds the
`navGroups`, `mobileNavItems`, `headerRight`, prefetch map, and sidebar footer,
then passes them into `AppShell`/`AppSidebar`. So the _primitives_ are shared
but the _navigation config and assembly are duplicated per app_ (e.g.
`apps/teacher-web/src/layouts/AppLayout.tsx` lines 84–303). `isActive` flags are
computed with ad-hoc, inconsistent `location.pathname ===` vs `.startsWith()`
logic in every layout. `AuthLayout.tsx` (a centered card) is duplicated and
trivially identical across all 5 apps. student-web additionally has
`ConsumerLayout.tsx` for the B2C surface.

Navigation niceties present in some layouts but not others: `usePrefetch(...)`
route-hover prefetch (teacher, super-admin, student, parent — each with a
hand-maintained map), `useTenantBranding()` (teacher),
`PWAInstallBanner`/`OfflineBanner` (teacher only has OfflineBanner),
`AppBreadcrumb` (super-admin only), `RoleSwitcher`
(teacher/student/parent/admin, not super-admin).

### 1.4 Deployment (Firebase hosting targets)

Root `firebase.json` defines **6 hosting targets**: `admin-web`, `parent-web`,
`student-web`, `super-admin`, `teacher-web`, `website` — each serving
`apps/<app>/dist` (website → `website/dist`) with SPA rewrite `** → /index.html`
and immutable cache headers on JS/CSS/map. Same file defines 4 function
codebases (`identity`, `autograde`, `levelup`, `analytics`) and emulators (auth
9099, functions 5001, firestore 8080, db 9000, UI 4000). `.firebaserc` maps
targets to deploy site IDs under project `lvlup-ff6fa` (e.g.
`teacher-web → lvlup-ff6fa-teacher`).

The `autograde/` sub-monorepo is a **separate Firebase project**
(`autograde/.firebaserc` → `autograde-339f4`) with its own
`autograde/firebase.json` and 3 hosting targets: `client-admin`, `super-admin`,
`scanner-app`.

### 1.5 Dev orchestration (`start.sh` + `RUNNING_APPS.md`)

`start.sh` is a bash launcher with an `APPS` registry
(`label|dir|port|description`). It starts **8 apps** in the background — the 5
primary (`pnpm run dev`, ports 4567-4571) plus the 3 autograde apps
(`npm run dev`, ports 4572-4574) — writes PIDs to `.start-pids`, logs to
`.start-logs/`, and supports `start|stop|status`. Vite `server.port` in each
app's `vite.config.ts` is hard-pinned to match (super-admin 4567, admin-web
4568, teacher 4569, student 4570, parent 4571). `RUNNING_APPS.md` documents
ports, URLs, and seeded test credentials, and notes that `start.sh` runs against
**production Firebase** (not emulators), while the docs separately describe an
emulator+seed flow.

### 1.6 autograde/ — a divergent second pattern

`autograde/apps/client-admin/src/App.tsx` shows a fundamentally different
approach from the primary apps: a **single app serving multiple roles via path
prefixes** (`/admin/*` vs `/student/*`), `BrowserRouter` declared _inside_ `App`
(not in main), a React-Context `AuthProvider` instead of Zustand, a
`ProtectedRoute` wrapper component
(`autograde/apps/client-admin/src/components/shared/ProtectedRoute.tsx`) taking
`allowedRoles` as children-wrapper (not an `<Outlet>` guard), `react-hot-toast`
instead of Sonner, role roots redirecting via `<Navigate>`, and "Coming Soon"
placeholder routes. The scanner-app has its own `RequireAuth`.

---

## 2. Entities / Schemas / Collections / APIs / Routes (with file paths)

- **`TenantRole`** (`packages/shared-types/src/identity/membership.ts:9`):
  `superAdmin | tenantAdmin | teacher | student | parent | scanner | staff`.
  Note `scanner`/`staff` exist in the type but have no primary web app of their
  own (scanner lives in autograde). `AppRole` is re-declared locally in
  `AppSidebar.tsx:53` (`tenantAdmin|teacher|student|parent|superAdmin`) — a
  divergent subset.
- **`UserMembership`** (`packages/shared-types/src/identity/membership.ts:92`):
  composite key `{uid}_{tenantId}`, collection
  `/userMemberships/{uid}_{tenantId}`; carries `role`, `status`, `permissions`
  (`TeacherPermissions`), `staffPermissions`, and role-specific entity links
  (`teacherId/studentId/parentId/...`). This is the role authority used by every
  guard via `currentMembership.role`.
- **Auth store** (`packages/shared-stores/src/auth-store.ts`): `AuthState` with
  `user, firebaseUser, currentMembership, allMemberships, currentTenantId, loading`;
  actions
  `initialize, login, loginWithSchoolCode, loginWithGoogle, logout, switchTenant, loadMemberships, refreshToken`.
  Selectors: `useCurrentMembership, useUserRole, useIsConsumer`
  (`allMemberships.length === 0`).
- **Tenant store** (`packages/shared-stores/src/tenant-store.ts`):
  `subscribe(tenantId)` / `reset()` — subscribed from App.tsx and read for
  branding/onboarding.
- **Callable used in routing flow**: `callSwitchActiveTenant` (re-stamps custom
  claims) — invoked by `auth-store.switchTenant` / `loginWithSchoolCode`.
- **Shared layout API** (`packages/shared-ui/src/components/layout/`):
  `AppShell` (`AppShellProps`), `AppSidebar` (`NavGroup`, `NavItem`,
  `AppSidebarProps`), `RoleSwitcher` (`TenantOption`), `MobileBottomNav`
  (`MobileNavItem`), `AppBreadcrumb` (`BreadcrumbSegmentResolver`),
  `RouteErrorBoundary`, `NotFoundPage`, `PageLoader`.
- **Guards**:
  `apps/{teacher-web,student-web,admin-web,super-admin,parent-web}/src/guards/RequireAuth.tsx`;
  autograde `ProtectedRoute.tsx` / scanner `RequireAuth.tsx`.
- **Layouts**: `apps/<app>/src/layouts/{AppLayout,AuthLayout}.tsx`;
  `student-web/.../ConsumerLayout.tsx`.
- **Deploy config**: `firebase.json` (hosting array), `.firebaserc` (target→site
  map), `autograde/firebase.json`, `autograde/.firebaserc`.
- **Dev orchestration**: `start.sh`, `RUNNING_APPS.md`, per-app `vite.config.ts`
  `server.port`.

---

## 3. Strengths Worth Keeping

1. **Consistent shell primitives**: `AppShell`/`AppSidebar` are clean,
   data-driven, and **router-agnostic** (injectable `LinkComponent`) — exactly
   the shape needed to share between web and React Native. The `NavGroup[]`
   config model is the right abstraction.
2. **Single Zustand auth store** as the cross-app source of truth for identity,
   membership, and active tenant — already platform-agnostic (no DOM/router
   dependencies), reusable as-is in RN.
3. **Per-route error isolation**: every leaf wrapped in `RouteErrorBoundary` so
   a crash in one page doesn't blank the app.
4. **Code-splitting + prefetch**: `lazy()` per page + a single top-level
   `Suspense`, with hover-prefetch maps for near-instant nav.
5. **Multi-tenant claims model**: `switchTenant` re-stamps custom claims
   server-side then refreshes the token — correct and secure pattern; guards can
   trust the membership.
6. **B2B/B2C split via consumer routes**: student-web cleanly separates
   tenant-bound learners from membership-less consumers using a guard redirect +
   dedicated `ConsumerLayout`.
7. **Clean Firebase hosting setup**: one target per app, correct SPA rewrites,
   immutable asset caching — ready for per-app deploy.
8. **Defense-in-depth in super-admin guard**: verifies both Firestore
   `isSuperAdmin` and the live custom claim.

---

## 4. Pain Points / Tech Debt / Inconsistencies

1. **Five hand-copied `RequireAuth.tsx` that have drifted.** Same intent,
   divergent code: different loading UIs (text vs spinner vs skeleton),
   teacher/parent vs admin differ on the `tenantId === currentTenantId` check,
   student has a consumer-redirect branch, super-admin is an entirely separate
   async-claims implementation. No single guard, so a security fix (like the
   admin's tenant-binding check) lands in one app and not others.
2. **`AppLayout.tsx` is duplicated per app** with hand-built `navGroups`,
   `mobileNavItems`, prefetch maps, and footers. ~250 lines of near-boilerplate
   per app. `isActive` logic is reinvented inconsistently (`===` vs
   `.startsWith`) everywhere.
3. **`AuthLayout.tsx` is byte-for-byte duplicated** across all 5 apps for no
   reason.
4. **Inconsistent app-shell features**: breadcrumbs only in super-admin;
   `useTenantBranding` only in teacher; `OfflineBanner`/`PWAInstallBanner`
   present in some layouts, absent in others; `RoleSwitcher` everywhere except
   super-admin.
5. **Inline one-off guards**: admin-web's `OnboardingGuard` is defined inside
   `App.tsx` and manually wrapped around _every_ route element — verbose,
   error-prone, and not reusable. It belongs in the guard/layout layer.
6. **`NotFoundPage` / `LoginPage` import inconsistency**: some apps import
   `NotFoundPage` from `@levelup/shared-ui`, teacher-web imports a local
   `./pages/NotFoundPage`; `LoginPage` is static-imported in teacher/parent but
   `lazy()` in student/admin/super-admin.
7. **Declarative `<Routes>` only — no data router.** No use of
   `createBrowserRouter`, loaders, actions, or route-level error elements; data
   fetching is bolted on per-page via React Query. Route config is not
   centralized/typed (no route manifest), so deep-link paths are stringly-typed
   and duplicated between `App.tsx`, layout nav configs, and prefetch maps.
8. **`AppRole` (shared-ui) vs `TenantRole` (shared-types) duplication/drift** —
   two role unions, the UI one a stale subset missing `scanner`/`staff`.
9. **Two completely different routing architectures in one repo.** The
   `autograde/*` apps use Context-based auth, in-component `BrowserRouter`,
   `ProtectedRoute` children-wrapper, multi-role-in-one-app path prefixes,
   `react-hot-toast`, and `npm` — none of it shares the primary platform's
   stores, guards, or shell. It's effectively a second platform stapled on, and
   it's a separate Firebase project.
10. **`start.sh` straddles two package managers** (pnpm for primary, npm for
    autograde) and **points dev at production Firebase** (per the script's own
    banner and RUNNING_APPS.md), contradicting the documented emulator flow —
    risky for local dev and easy to corrupt prod data.
11. **Ports are pinned in two places** (`vite.config.ts` and `start.sh`) with no
    shared source — drift risk. The scanner-app (port 4574) is
    documented/launched but has no entry in any `firebase.json` hosting block
    beyond autograde's `scanner-app`.
12. **Duplicated `initialize()/subscribeTenant` `useEffect`** in 4 of 5 App.tsx
    files.

---

## 5. Concrete Recommendations for a Fresh Rebuild

Keep the core concepts (membership/claims-driven RBAC, per-app shells,
multi-tenant switching, B2B/B2C split, code-splitting) but consolidate the
duplication and prepare for a shared API layer + React Native.

1. **One shared `RequireAuth`/route-guard in `packages/shared-ui` (or a new
   `shared-routing` package).** Make it config-driven:
   `RequireAuth({ allow, requireTenantMatch, onConsumerRedirect, fallback })`.
   Encode super-admin's claim verification and admin's
   `tenantId === currentTenantId` check as opt-in flags, so all apps get the
   strongest behavior by default. Delete the 5 copies.
2. **Centralize route definitions as a typed manifest** per app: a single
   `routes.ts` exporting `{ path, element, lazyImport, allow, navMeta }`. Derive
   the `<Routes>` tree, the sidebar `navGroups`, the prefetch map, and
   `isActive` from this one source — eliminating the three-way duplication and
   the ad-hoc `startsWith` logic. Consider migrating to `createBrowserRouter`
   (data router) for typed params, route-level error elements, and loaders that
   can call the new common API layer.
3. **Promote app chrome into a single `<PlatformLayout config={...}>`** in
   `shared-ui` that takes
   `{ appName, navGroups, headerRight, features: { breadcrumbs, branding, roleSwitcher, offlineBanner, pwaBanner } }`.
   Each app reduces to a small config object instead of a 250-line layout.
   Standardize `AuthLayout` and `ConsumerLayout` as shared components too.
4. **Single role union.** Delete `AppRole` from `shared-ui`; import `TenantRole`
   from `shared-types` everywhere. Drive nav visibility off role + `permissions`
   so the same manifest renders the right items per role.
5. **Generalize `OnboardingGuard` into a composable "gate" pattern** (an array
   of guard predicates the router runs before rendering), instead of inline
   per-route wrappers.
6. **Make routing platform-agnostic for React Native.** Keep the auth/tenant
   Zustand stores exactly as they are (no DOM deps — RN-ready). Define
   navigation as data (the route manifest + `NavGroup`) and provide two thin
   adapters: a `react-router-dom` renderer for web and a `react-navigation`
   renderer for RN that consume the _same_ manifest, guards, and role/permission
   checks. The injectable `LinkComponent` pattern already proves this is
   feasible.
7. **Introduce a common API/data layer** (typed callable + REST client in
   `shared-services`) that both web route loaders and RN screens call, so
   routing/guard logic stays UI-thin and data access is shared. Replace per-page
   React Query wiring with shared query hooks keyed off the route manifest.
8. **Unify dev orchestration.** Single package manager (pnpm) across primary +
   autograde, derive ports from one shared config consumed by both
   `vite.config.ts` and the launcher, and **default `start.sh` to emulators**
   with an explicit `--prod` opt-in. Prefer `turbo`/`pnpm` workspace tasks over
   the bespoke bash PID launcher.
9. **Decide autograde's fate explicitly.** Either fold it into the primary
   platform (reuse the shared stores, guards, shell, single Firebase project,
   and the `scanner`/`staff` roles already in `TenantRole`) or formally document
   it as a separate product. The current half-merged state (separate project,
   separate auth model, separate toast lib, duplicated entities) is the single
   largest source of architectural inconsistency.
10. **Keep the Firebase hosting model** (one target per app, SPA rewrite,
    immutable caching) but generate `firebase.json` hosting + `.firebaserc`
    targets from the same app registry that drives `start.sh`, so
    apps/ports/targets never drift.
