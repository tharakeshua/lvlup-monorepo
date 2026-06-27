# STATUS: Shared Frontend Packages

**Scope:** `packages/shared-services`, `shared-hooks`, `shared-stores`,
`shared-ui`, `shared-utils`, `tailwind-config` **Audited:** 2026-06-19
**Cross-referenced:** `docs/shared-packages.md` (2026-02-13, original task doc),
`docs/BACKEND-SHARED-PACKAGES-AUDIT-REPORT.md` (2026-03-01) **Method:** Read
source (index files, service classes, query hooks, stores, package manifests,
app consumption). Verified prior audit claims against current code — many
"missing" items flagged in March are now implemented.

---

## 1. What Exists & How It's Architected

The shared layer is a pnpm workspace of internal packages under the `@levelup/*`
namespace. All apps (`apps/teacher-web`, `student-web`, `admin-web`,
`super-admin`, `parent-web`) depend on the full set via `workspace:*` (confirmed
in each app `package.json`). Packages are consumed as **raw TypeScript source**
(`exports` point at `./src/*.ts`/`.tsx`), transpiled by each app's Vite build —
there is no pre-build step for most packages. The sole exception is
`shared-services`, which ships a hybrid `dist`/`src` export map.

### Dependency graph

```
shared-types (domain model — out of scope, source of truth)
   ↑           ↑           ↑
shared-utils   shared-services ── (firebase, firebase-admin, secret-manager, gemini)
   ↑              ↑     ↑
   │           shared-stores (zustand) ──→ shared-services
   │              ↑
   └──────── shared-hooks (react-query) ──→ shared-services, shared-stores, shared-types
                  ↑
              shared-ui (radix/shadcn, tiptap, recharts, katex) ──→ shared-hooks, shared-utils, shared-types
tailwind-config (standalone, no JS deps)
```

### `@levelup/shared-services` — Firebase/data + AI layer

Entry: `packages/shared-services/src/index.ts`. Organized by concern:

- **`firebase/config.ts`** — singleton `initializeFirebase()` /
  `getFirebaseServices()` returning `{app, auth, db, storage, rtdb, functions}`.
  Functions region hardcoded to `asia-south1` (line 99). Emulator wiring gated
  on `VITE_USE_EMULATORS` via `process.env`. Env loader supports `VITE_` /
  `NEXT_PUBLIC_` / bare prefixes (`getFirebaseConfigFromEnv`).
- **`firestore/index.ts`** — generic `FirestoreService` class +
  `firestoreService` singleton. Generic CRUD (`getDoc`, `getAllDocs`, `setDoc`,
  `updateDoc`, `deleteDoc`, `batch`) scoped to
  `organizations/{orgId}/{collection}` (line 48). Re-exports
  `firebase/firestore` primitives.
- **`storage/index.ts`**, **`realtime-db/index.ts`** — analogous generic
  services, both scoped to `organizations/{orgId}/...` (storage line 37, rtdb
  line 39).
- **`auth/`** — `auth-callables.ts` (typed `httpsCallable` wrappers for ~25
  Cloud Functions: `switchActiveTenant`, `createOrgUser`, `joinTenant`,
  `saveTenant`/`saveClass`/`saveStudent`/`saveTeacher`/`saveParent`/`saveAcademicSession`/`saveStaff`,
  `saveSpace`/`saveStoryPoint`/`saveItem`, `manageNotifications`,
  `bulkImportStudents`/`bulkImportTeachers`,
  `deactivateTenant`/`reactivateTenant`/`exportTenantData`,
  `saveAnnouncement`/`listAnnouncements`, `bulkUpdateStatus`, `rolloverSession`,
  `uploadTenantAsset`, `searchUsers`, `saveGlobalEvaluationPreset`); plus
  `membership-service.ts` (read `userMemberships`), `tenant-lookup.ts` (lookup
  by code, `deriveStudentEmail`), `auth-callables` index.
- **`autograde/exam-callables.ts`**, **`levelup/`** (`content-callables`,
  `assessment-callables`, `store-callables`, `chat-callables`,
  `adaptive-engine`), **`reports/pdf-callables.ts`** — feature-domain callable
  wrappers.
- **`ai/`** (server-only, NOT in main barrel — see index.ts line 9) —
  `llm-wrapper.ts` (Gemini 2.5 Flash via `@google/generative-ai`, retry +
  exponential backoff, circuit breaker via `fallback-handler.ts`),
  `cost-tracker.ts`, `llm-logger.ts`, `secret-manager.ts` (per-tenant GCP Secret
  Manager keys), `usage-quota.ts`. Imported separately via
  `@levelup/shared-services/ai`.

### `@levelup/shared-hooks` — React Query + reactive data

Entry: `packages/shared-hooks/src/index.ts`. Four buckets:

- **`auth/useAuth.ts`** — React Query wrapper around `onAuthStateChanged` (cache
  key `['auth','currentUser']`, `staleTime: Infinity`).
- **`data/`** — `useFirestoreDoc`, `useFirestoreCollection`, `useRealtimeDB`
  (real-time subscription hooks).
- **`ui/`** — `useMediaQuery`, `useDebounce`, `useLocalStorage`,
  `useClickOutside`, `useOnlineStatus`, `usePrefetch`, `use-tenant-branding`.
- **`queries/`** — the bulk: ~50 React Query hooks (`queries/index.ts`). Entity
  lists + mutations
  (classes/students/teachers/parents/spaces/items/exams/submissions/story-points/academic-sessions),
  single-entity details (`useEntityDetails`), assessment (`useTestSessions`),
  AI/chat (`useChatSessions`), analytics (`useStudentSummary`,
  `useClassSummary`, `useExamAnalytics`, `useCostSummary`, `useInsights`,
  `usePerformanceTrends`), gamification (`useAchievements`), notifications,
  rubric presets, space reviews, evaluation settings, tenant management
  (`useTenant`), auth management (`useAuthHooks`).
- **`tenant/use-quota-status.ts`**, **`use-api-error.ts`** — top-level helpers.

> **Important:** The March audit reported shared-hooks at 51% (38/74) with
> story-point/test-session/chat/space-mutation/item-mutation/exam-mutation/submission-mutation
> hooks all "missing." **They now exist** (`queries/index.ts` lines 31-97). The
> coverage gap is largely closed.

### `@levelup/shared-stores` — Zustand global state

Entry: `packages/shared-stores/src/index.ts`. Four stores:

- **`auth-store.ts`** — the most substantial. Firebase auth listener, real-time
  `/users/{uid}` snapshot, membership loading via `getUserMemberships`, tenant
  restoration from token claims,
  `login`/`loginWithSchoolCode`/`loginWithGoogle`/`logout`/`switchTenant` (calls
  `callSwitchActiveTenant` CF + forces token refresh). Maps Firebase auth error
  codes to friendly messages. Exposes selector hooks (`useCurrentUser`,
  `useCurrentMembership`, `useUserRole`, `useCurrentTenantId`, `useIsConsumer`).
- **`tenant-store.ts`** — real-time tenant doc listener, settings/features/name
  selectors.
- **`ui-store.ts`** — sidebar, active modal, toasts (auto-dismiss).
- **`consumer-store.ts`** — B2C cart with `persist` middleware.

### `@levelup/shared-ui` — component library

Entry: `packages/shared-ui/src/index.ts`. A shadcn/ui (Radix) primitive set (~60
components in `components/ui/`) plus higher-order grouped components:

- **`components/auth/`** — `SchoolCodeLoginForm`, `DirectLoginForm`,
  `OrgSwitcher`, `OrgPickerDialog`, `LogoutButton` (full multi-tenant login UX).
- **`components/layout/`** — `AppShell`, `AppSidebar`, `RoleSwitcher`,
  `NotificationBell`/`Dropdown`/`Page`, `MobileBottomNav`, `PWAInstallBanner`,
  `SWUpdateNotification`, `ErrorBoundary`/`RouteErrorBoundary`, `OfflineBanner`,
  `AppBreadcrumb`, `NotFoundPage`.
- **`components/charts/`** — `ScoreCard`, `ProgressRing`, `AtRiskBadge`,
  `SimpleBarChart`, `ClassHeatmap` (recharts).
- **`components/gamification/`** — `AchievementBadge`/`Card`, `LevelBadge`,
  `StreakWidget`, `MilestoneCard`, `StudyGoalCard`.
- **`components/editor/RichTextEditor`** (tiptap),
  **`components/markdown/MarkdownWithMath`** (react-markdown + katex),
  **`components/motion/`** (framer-motion), **`components/feedback/`**.
- Shared widgets at root: `EntityPicker`, `BulkImportDialog`,
  `DownloadPDFButton`.
- Local **`hooks/`** (`use-mobile`, `use-toast`, `use-reduced-motion`,
  `use-sw-update`, `useStoryPointProgress`, metrics tracking hooks) and
  **`services/`** (`MetricsService`, `UserStoryPointProgressService`).
- **`lib/utils.ts`** (`cn` merge), `lib/imageCompression.ts`.

### `@levelup/shared-utils` — pure helpers

Entry: `packages/shared-utils/src/index.ts`. `csv.ts` (bulk import parsing),
`pdf.ts` (pdfjs-dist → base64 images), `validation.ts`, `formatting.ts`
(currency/number/percent/case/bytes), `date.ts`, `web-vitals.ts`. No React, no
Firebase — safe to share with future RN/server.

### `@levelup/tailwind-config` — design tokens

`index.js` (full Tailwind config preset: dark mode, large hand-maintained
`safelist`, theme extension from `theme.js`), `theme.js` (HSL color tokens,
radii, keyframes, animations, shadows, fontSize, spacing, zIndex),
`variables.css` (CSS custom properties), `safelist.js`. Pure config, no build.

---

## 2. Entities / Schemas / Collections / APIs / Routes (with paths)

**Domain types** all come from `@levelup/shared-types` (out-of-scope source of
truth) and are re-exported for convenience from
`shared-hooks/src/queries/index.ts` lines 111-116: `Space`, `Exam`,
`Submission`, `EvaluationSettings`, `UnifiedItem`(as `Item`), `SpaceProgress`(as
`StudentProgress`), `Class`, `Student`, `Teacher`, `Parent`, `AcademicSession`,
`StoryPoint`, `DigitalTestSession`, `ChatSession`, `Tenant`, `UserMembership`,
`UnifiedUser`, `PlatformClaims`.

**Firestore collection paths actually used by the data layer:**

- Generic services (`firestore/index.ts:48`, `storage/index.ts:37`,
  `realtime-db/index.ts:39`): `organizations/{orgId}/{collection}` — **legacy
  path scheme**.
- React Query hooks (all of `shared-hooks/src/queries/*` — e.g.
  `useSpaces.ts:15`): `tenants/{tenantId}/{collection}` — **current path
  scheme**.
- Auth store (`auth-store.ts:115`): top-level `/users/{uid}`; memberships via
  `userMemberships` collection (`membership-service.ts`).
- LLM audit (per March audit, `ai/llm-logger.ts`):
  `tenants/{tenantId}/llmCallLogs`.

**Callable Cloud Function APIs (typed wrappers in
`shared-services/src/auth/auth-callables.ts` + feature callables):**
`switchActiveTenant`, `createOrgUser`, `joinTenant`, `saveTenant`, `saveClass`,
`saveStudent`, `saveTeacher`, `saveParent`, `saveAcademicSession`, `saveStaff`,
`saveSpace`, `saveStoryPoint`, `saveItem`, `manageNotifications`,
`bulkImportStudents`, `bulkImportTeachers`, `bulkUpdateStatus`,
`deactivateTenant`, `reactivateTenant`, `exportTenantData`, `rolloverSession`,
`uploadTenantAsset`, `saveAnnouncement`, `listAnnouncements`, `searchUsers`,
`saveGlobalEvaluationPreset`, plus autograde/levelup/reports callables
(`autograde/exam-callables.ts`, `levelup/*-callables.ts`,
`reports/pdf-callables.ts`).

**No HTTP routes** — the platform is callable-only (Firebase Functions
`httpsCallable`) + direct Firestore reads. There is no REST/RPC abstraction
layer.

---

## 3. Strengths Worth Keeping

1. **Clean package separation by concern** — services / hooks / stores / ui /
   utils / config is the right decomposition and matches how teams reason about
   a frontend platform.
2. **Typed callable wrappers** (`auth-callables.ts`) — every Cloud Function has
   a typed `call*` function returning `result.data`. This is the closest thing
   to an API client and is genuinely good. The `getCallable<Req,Res>` helper is
   clean.
3. **React Query hook conventions are consistent and correct** — hierarchical
   query keys (`['tenants', tenantId, 'spaces', ...]`), `enabled: !!tenantId`,
   sensible `staleTime`, proper invalidation on mutations. The `useSpaces`
   server/client orderBy fallback (avoiding a 3-field composite index) shows
   real Firestore awareness.
4. **`auth-store` is production-grade** — multi-tenant switching via CF + token
   refresh, real-time user doc, school-code login, friendly error mapping. Keep
   this model.
5. **`shared-ui` is broad and modern** — full Radix/shadcn primitive set, plus
   app-level composites (AppShell, AppSidebar, RoleSwitcher, login forms,
   gamification, charts, tiptap, markdown+katex). This is a real design system,
   not a thin wrapper.
6. **`shared-utils` is pure** — no React/Firebase coupling, immediately reusable
   in React Native or backend.
7. **`tailwind-config` centralizes design tokens** as HSL with CSS variables —
   good theming foundation.
8. **AI layer is robust** — retry, circuit breaker, per-tenant secret
   management, cost tracking, audit logging; correctly isolated as server-only
   and kept out of the client barrel.
9. **Strong test coverage** in services and stores (extensive `__tests__/`,
   integration tests with emulator setup).

---

## 4. Pain Points / Tech Debt / Inconsistencies

1. **CRITICAL — Two competing tenant-path schemes; generic Firestore service is
   effectively dead code.**
   `FirestoreService`/`StorageService`/`RealtimeDBService` scope everything to
   `organizations/{orgId}/...` (`firestore/index.ts:48`), but **every real
   data-access path** — all ~50 query hooks and the stores — talk to
   `tenants/{tenantId}/...` using raw `firebase/firestore` calls
   (`getFirebaseServices().db` + `collection(...)`), bypassing the generic
   service entirely. The generic CRUD service is never used for actual app data.
   This is the single biggest architectural inconsistency.
2. **HIGH — Data access is not centralized.** Because hooks call
   `firebase/firestore` directly, collection paths, query construction, and the
   `tenants/{id}/...` convention are duplicated across ~30 hook files. There is
   no single data-access module; changing a path or adding tenant validation
   means editing dozens of files. The `FirestoreService` abstraction exists but
   isn't the one being used.
3. **HIGH — No common API/transport abstraction.** The data layer is hardwired
   to the Firebase client SDK (`firebase/firestore`, `firebase/functions`
   everywhere). Hooks, stores, and services all import `getFirebaseServices()`
   directly. There is no repository/gateway interface, so swapping transport
   (REST gateway, RN-friendly client, offline cache) or supporting a
   non-Firebase consumer is not possible without rewriting every hook.
4. **MEDIUM — Stub services shipped as real exports.**
   `shared-ui/src/services/metrics/MetricsService.ts` and
   `services/progress/UserStoryPointProgressService.ts` are no-op stubs
   ("Implementation will be wired to the analytics backend" / "Implementation
   will subscribe to Firestore"). The metrics tracking hooks
   (`hooks/metrics/useTrack*`) call into a service that does nothing —
   engagement analytics silently don't fire.
5. **MEDIUM — `shared-ui` owns hooks and services that belong elsewhere.** It
   contains its own `hooks/` (incl. metrics) and `services/` (MetricsService,
   progress), duplicating the responsibility of
   `shared-hooks`/`shared-services`. A UI library should not own data/metrics
   services. Toast hook is also triplicated (`hooks/use-toast.ts`,
   `components/ui/use-toast.ts`, `components/ui/use-toast` re-export).
6. **MEDIUM — Inconsistent build/export strategy.** `shared-services` ships
   compiled `dist` (`require`→dist, `default`→src hybrid) while everything else
   exports raw `./src/*.ts`. This split is confusing and means `shared-services`
   needs a build step the others don't. The `require`/`default` condition map is
   fragile.
7. **MEDIUM — `shared-ui` ships an enormous dependency surface** (~40 Radix
   packages + tiptap + recharts + katex + framer-motion + zod +
   react-hook-form). Because it's consumed as source with `export *`, apps can't
   easily tree-shake unused heavy deps (katex, tiptap, recharts) unless Vite's
   analysis is perfect. This bloats every app's `node_modules` and bundle risk.
8. **MEDIUM — Hardcoded region & config drift.** Functions region `asia-south1`
   is hardcoded (`firebase/config.ts:99`). Emulator hosts/ports hardcoded.
   `shared-services` has its own `tailwind.config.ts` and the design-system
   safelist in `tailwind-config` is hand-maintained (drift risk).
9. **LOW — `useAuth` (hook) vs `auth-store` overlap.** Both manage auth state
   via different mechanisms (React Query listener vs Zustand listener). Apps
   could use either; `useCurrentUser` is exported from both
   `shared-hooks/queries` and `shared-stores`. Source-of-truth ambiguity.
10. **LOW — `shared-stores` is `private`/`v0.1.0`** while
    `shared-services`/`shared-utils`/`shared-hooks` are `v1.0.0` — versioning is
    meaningless across the workspace (all `workspace:*`), suggesting it was
    never formalized.
11. **LOW — Type re-export sprawl.** `shared-hooks` re-exports domain types from
    `shared-types` (queries/index.ts), `shared-services` re-exports Firestore
    primitives, `shared-ui` has its own `types/items.ts`. Type ownership is
    diffuse.
12. **Doc drift.** `docs/shared-packages.md` describes only the original 3
    packages with `organizations/`-scoped examples and is badly out of date; the
    March audit's "missing hooks" list is mostly resolved. Future readers will
    be misled.

---

## 5. Recommendations for a Fresh Rebuild

The core concepts are sound — keep the package decomposition, the typed-callable
client, the React Query conventions, the design system, the pure utils, and the
token-based tailwind config. Fix the layering so the data path is centralized
and transport-agnostic, enabling a common API layer and React Native reuse.

### Layering & data access

1. **Introduce a `shared-api` (or `shared-data`) package as the single
   data-access layer.** Define repository/gateway interfaces per entity
   (`SpaceRepository`, `ExamRepository`, …) with one canonical implementation
   over Firebase today. Hooks call repositories, never `firebase/firestore`
   directly. This is what unlocks a common API layer and a future REST/RN
   gateway: swap the implementation, keep the interface.
2. **Pick ONE tenant-path scheme** — standardize on `tenants/{tenantId}/...`
   (it's what the live app uses) and delete the `organizations/{orgId}/...`
   generic services, or rewrite them to the canonical scheme and force ALL
   access through them. Centralize the path builder in one module.
3. **Make `shared-services` transport-agnostic and platform-agnostic.** Split
   into `shared-firebase` (client SDK adapter) and a thin `api-client` (the
   typed callable layer that the rest of the app imports). Keep the
   `getCallable<Req,Res>` pattern but make the underlying transport injectable
   so RN/web/server can each provide their own (callable, fetch+REST, admin
   SDK).
4. **Pull `MetricsService`, `UserStoryPointProgressService`, and the metrics
   hooks OUT of `shared-ui`** into the data/services layer and actually
   implement them (or delete the dead hooks). `shared-ui` should be
   presentational only — no data/metrics/Firestore.

### Platform / RN readiness

5. **Keep `shared-types` and `shared-utils` 100% platform-neutral** (already
   true for utils; preserve it). These become the shared core for web + RN +
   functions.
6. **Split hooks into `headless` (data/query) and `web-ui` (DOM-coupled).**
   Query hooks (entity fetching/mutations via repositories) are RN-reusable;
   `useMediaQuery`/`useClickOutside`/DOM hooks are web-only. Separate packages
   or clear subpaths so RN can import the query hooks without dragging in DOM
   code.
7. **Design tokens before components.** Promote `tailwind-config/theme.js`
   tokens into a framework-neutral token source (JSON/TS) consumable by both
   Tailwind (web) and an RN styling system. Auto-generate the Tailwind safelist
   instead of hand-maintaining it.

### Hygiene

8. **One build/export strategy across all packages.** Either all ship `dist`
   (recommended for stable consumption + tree-shaking + correct types) with
   `tsup`/`tsc`, or all stay source — but not the current mix. Define `exports`
   with `import`/`types` conditions consistently.
9. **Single source of truth for auth state.** Choose Zustand `auth-store`
   (richer, multi-tenant aware) as canonical and have `useAuth`/`useCurrentUser`
   delegate to it; remove the duplicate React Query auth listener.
10. **Split `shared-ui` heavy/optional deps into entrypoints**
    (`@levelup/shared-ui/editor`, `/markdown`, `/charts`) so apps opt into
    tiptap/katex/recharts rather than pulling the whole graph. Verify
    tree-shaking with the existing `ANALYZE` visualizer.
11. **Add tenant-scoping validation in the data layer** (not just Firestore
    rules) — the repository layer is the right place to assert `tenantId`
    matches the active membership before any read/write.
12. **Replace the stale `docs/shared-packages.md`** with generated/maintained
    docs reflecting the `tenants/{id}` scheme and the full hook/callable
    inventory; treat the March backend audit as historical.
13. **Normalize package versions** and decide what (if anything) is published vs
    purely internal; drop the `private`/`1.0.0` inconsistency.

### Keep as-is (low-risk wins)

- The typed callable wrapper pattern (`getCallable<Req,Res>` + `call*`
  functions).
- React Query key/staleTime/invalidation conventions.
- `auth-store` multi-tenant switch + token-refresh flow.
- `shared-ui` Radix/shadcn primitive set and the auth/layout/gamification
  composites.
- `shared-utils` purity and `tailwind-config` HSL token model.
- AI layer (retry/circuit-breaker/secret-manager/cost-tracker) — keep
  server-only isolation.
