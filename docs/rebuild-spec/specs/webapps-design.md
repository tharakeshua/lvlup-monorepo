# Fresh-Build Spec — Web Apps & Design System

**Scope:** The five primary web apps (`teacher-web`, `student-web`, `admin-web`,
`super-admin`, `parent-web`) and the shared design system / app-shell / routing
layer that all of them compose. This section specifies a rebuilt frontend that
(a) keeps every core domain concept intact, (b) eliminates the cross-app
inconsistencies catalogued in the status reports, and (c) is built so a single
common API layer can be shared verbatim by web **and** future React Native apps.

> Ground-truth sources: `status/app-teacher-web.md`,
> `status/app-student-web.md`, `status/app-admin-web.md`,
> `status/app-super-admin.md`, `status/app-parent-web.md`,
> `status/shared-packages.md`, `status/routing-appmgmt.md`.

> A separate scanner-web app (answer-sheet intake) is planned (see
> `status/app-legacy-and-scanner.md`). This spec defines the shell/design-system
> contract it must conform to, but does not enumerate its pages.

---

## 0. Design principles (non-negotiable)

1. **One source per concern.** Exactly one route guard, one app-shell, one
   auth-layout, one role union, one design-token source, one data-access layer.
   No per-app copies that drift.
2. **Apps are configuration, not code.** Each web app reduces to: a typed
   **route manifest**, a small **app config**, and per-app **page components**.
   Everything cross-cutting (shell, nav rendering, guards, prefetch, error
   isolation, branding) is shared.
3. **UI never touches Firebase or builds collection paths.** All reads and
   writes go through the `@levelup/api-client` (see §6). This is the seam that
   lets React Native reuse the same logic and lets us swap transport later.
4. **Headless logic separate from presentation.** Business logic lives in
   framework-agnostic hooks/state machines (RN-reusable). `shared-ui` is
   presentational only.
5. **Keep the strong UX wholesale.** Lazy routes + hover prefetch, PWA +
   offline/update banners, per-route error boundaries, a11y primitives
   (`SkipToContent`, `RouteAnnouncer`, aria), keyboard-driven grading,
   confidence surfacing, server-authoritative timed tests, multi-tenant
   switching, B2B/B2C split, answer-key protection guard.

---

## 1. Package topology (frontend)

```
shared-types          domain model + Zod schemas (source of truth; z.infer types)
shared-tokens   (NEW) framework-neutral design tokens (JSON/TS) -> Tailwind + RN
shared-utils          pure helpers (csv, pdf, format, date, timestamp normalizer)
shared-api      (NEW) transport-agnostic typed client: repositories + callable registry
shared-stores         Zustand (auth, tenant, ui, consumer) — already DOM-free, RN-ready
shared-hooks          React Query hooks, split into:
                        /headless  (data hooks over shared-api — RN-reusable)
                        /web       (DOM hooks: useMediaQuery, useClickOutside, usePrefetch)
shared-ui             presentational component library (web). Headless layer beneath:
                        /primitives (Radix/shadcn), /composites, /editor, /markdown,
                        /charts, /gamification, /layout
shared-routing  (NEW) RequireAuth guard, route-manifest types, gate predicates,
                       PlatformLayout, web <Routes> renderer (RN gets a parallel renderer)
```

**Changes vs current:**

- **NEW `shared-api`** owns all data access (resolves status-report finding: ~30
  hook files call `firebase/firestore` directly; the generic `FirestoreService`
  scoped to `organizations/{orgId}` is dead code). Standardize on
  `tenants/{tenantId}/...` only.
- **NEW `shared-tokens`** so tokens are consumable by both Tailwind and RN;
  safelist is generated, not hand-maintained.
- **NEW `shared-routing`** so the guard, layout, and route manifest are defined
  once.
- **Move** `MetricsService` / `UserStoryPointProgressService` and metrics hooks
  OUT of `shared-ui` into `shared-api`/`shared-hooks` and actually implement
  them (currently no-op stubs).
- **One build/export strategy** across all packages (all ship `dist` via
  `tsup`/`tsc` with consistent `import`/`types` conditions). Today only
  `shared-services` ships `dist`; the mix is fragile.

---

## 2. Design system

### 2.1 Design tokens (`shared-tokens`)

Single framework-neutral token module (TS objects, no Tailwind/RN dependency).
Tailwind preset and the RN theme both _consume_ it; neither defines tokens.

```ts
// shared-tokens/src/tokens.ts
export const tokens = {
  color: {
    // semantic, HSL triplets (current model in tailwind-config/theme.js)
    background: '0 0% 100%',     foreground: '222 47% 11%',
    primary: '...', primaryFg: '...',
    secondary: '...', muted: '...', accent: '...',
    destructive: '...', success: '...', warning: '...', info: '...',
    border: '...', input: '...', ring: '...',
    // domain status colors (single source for badges/charts)
    statusDraft: '...', statusPublished: '...', statusArchived: '...',
    gradeNeedsReview: '...', gradeAuto: '...', gradeFailed: '...',
    confidenceLow: '...', confidenceMed: '...', confidenceHigh: '...',
    atRisk: '...',
  },
  radius: { sm, md, lg, xl, full },
  space:  { /* 0..96 scale */ },
  fontSize: { xs..4xl with lineHeight },
  fontFamily: { sans, mono },
  shadow: { sm, md, lg },
  zIndex: { dropdown, sticky, modal, popover, toast },
  motion: { durationFast, durationBase, easeStandard, easeEnter, easeExit },
} as const;
```

- **Dark mode**: CSS variables flip at `:root` / `.dark` (web); RN reads a
  `colorScheme` switch over the same token names.
- **Tenant branding**: a tenant may override `primary`, `accent`, and logo. Web
  injects these as CSS custom properties at the `PlatformLayout` boundary (today
  only teacher-web does this via `useTenantBranding`); the spec makes branding
  injection a **shell feature flag** available to every app.
- **Tailwind safelist** is generated from the token enums + status maps at build
  time (eliminates the hand-maintained, drift-prone safelist).

### 2.2 Component library (`shared-ui`)

Keep the broad, modern set already present; organize into clear subpath
entrypoints so apps tree-shake heavy deps (tiptap/katex/recharts/framer-motion).
Single role union `TenantRole` from `shared-types` (delete the divergent
`AppRole` subset in `AppSidebar.tsx`).

| Subpath                           | Components                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@levelup/shared-ui/primitives`   | Button, Input, Select, Checkbox, Radio, Switch, Textarea, Dialog, Drawer, Popover, Tooltip, Tabs, Accordion, Card, Badge, Avatar, Table, Skeleton, Toast(Sonner), DropdownMenu, Command, Calendar, Pagination, Breadcrumb, Progress, Separator, ScrollArea, Sheet, Form (RHF wrappers)                                  |
| `@levelup/shared-ui/layout`       | `PlatformLayout`, `AppShell`, `AppSidebar`, `MobileBottomNav`, `RoleSwitcher`, `AppBreadcrumb`, `RouteErrorBoundary`, `NotFoundPage`, `PageLoader`, `OfflineBanner`, `PWAInstallBanner`, `SWUpdateNotification`, `SkipToContent`, `RouteAnnouncer`, `ThemeToggle`, `AuthLayout`, `ConsumerLayout`, `QuotaWarningBanner` |
| `@levelup/shared-ui/auth`         | `SchoolCodeLoginForm`, `DirectLoginForm`, `OrgSwitcher`, `OrgPickerDialog`, `LogoutButton`, `ForgotPasswordForm` (NEW)                                                                                                                                                                                                  |
| `@levelup/shared-ui/data` (NEW)   | `DataTable` (owns search/filter/sort/selection/pagination — replaces per-page `usePagination`/`useSort`/`filteredX` arrays), `BulkActionBar`, `EmptyState`, `ErrorState` (distinct from empty), `EntityPicker`, `BulkImportDialog`, `ConfirmDialog`                                                                     |
| `@levelup/shared-ui/charts`       | `ScoreCard`, `StatCard`, `ProgressRing`, `AtRiskBadge`, `SimpleBarChart`, `ClassHeatmap`, `DifficultyProgressionChart`, `ScoreDistribution`                                                                                                                                                                             |
| `@levelup/shared-ui/gamification` | `AchievementBadge`/`Card`, `LevelBadge`, `StreakWidget`, `MilestoneCard`, `StudyGoalCard`, `CelebrationBurst`                                                                                                                                                                                                           |
| `@levelup/shared-ui/editor`       | `RichTextEditor` (authoring)                                                                                                                                                                                                                                                                                            |
| `@levelup/shared-ui/markdown`     | `ContentRenderer` (the single content renderer — see §2.3)                                                                                                                                                                                                                                                              |
| `@levelup/shared-ui/feedback`     | `FeedbackPanel`, `RubricBreakdown`, `ConfidenceBar`, `OverrideTimeline`                                                                                                                                                                                                                                                 |

A **headless layer** sits beneath DOM-coupled composites (e.g. `useDataTable`,
`useGradingReview` state machine, `useTestRunner`, `useItemEditor`) so RN reuses
logic with native presentation.

### 2.3 Content rendering — eliminate the dual-system inconsistency

**Current problem:** authoring uses TipTap → HTML
(`RichTextEditor`/`RichTextViewer`), display uses Markdown+KaTeX
(`MarkdownWithMath`) with a ~190-command `preprocessMath` heuristic. Round-trip
is lossy; the active `feat/teacher-portal-latex-rendering` branch exists only to
paper over this.

**Spec:** pick ONE canonical content representation — **portable
Markdown-with-math** (GFM + `$…$`/`$$…$$`) stored at write time.

- `RichTextEditor` authors and emits canonical Markdown (not HTML).
- A single `ContentRenderer` renders that Markdown (react-markdown +
  remark-gfm + remark-math + rehype-katex) for **authoring preview, student
  view, and grading view** — one renderer, no per-surface drift.
- `preprocessMath` is demoted to a **one-time migration shim** that converts
  legacy TipTap-HTML to canonical Markdown, then is deleted from the runtime
  path.

### 2.4 Accessibility & motion

- WCAG AA: focus-visible rings from `ring` token, `SkipToContent`,
  `RouteAnnouncer` on every app, aria-labels on icon buttons, keyboard nav for
  grading (j/k/Enter/a/o/?), reduced-motion honored (`use-reduced-motion`).
- All five apps get the **same** a11y primitives via `PlatformLayout` (today
  inconsistent — some apps lack breadcrumbs, banners, etc.).

---

## 3. App shell & navigation

### 3.1 `PlatformLayout` — one layout to replace five `AppLayout.tsx`

Today each app hand-builds a ~250-line `AppLayout.tsx` with its own `navGroups`,
`mobileNavItems`, prefetch map, `isActive` logic (inconsistent `===` vs
`.startsWith()`), and footer. Replace with a single configured layout:

```ts
// shared-routing/src/PlatformLayout.tsx
interface PlatformLayoutConfig {
  appName: string;
  navGroups: NavGroup[]; // derived from the route manifest (§4)
  mobileNav: MobileNavItem[]; // derived from manifest navMeta
  headerRight?: ReactNode; // app-specific header slot
  features: {
    breadcrumbs?: boolean;
    tenantBranding?: boolean; // inject tenant primary/accent + logo
    roleSwitcher?: boolean; // tenant/role switcher
    offlineBanner?: boolean;
    pwaBanner?: boolean;
    notifications?: boolean; // NotificationBell wired to shared hook
    quotaBanner?: boolean; // admin only
  };
}
```

- `isActive` computed once in the shell from the manifest (longest-prefix
  match), not reinvented per app.
- `RoleSwitcher` available to every app that has multiple memberships (currently
  absent in super-admin) — but super-admin uses a platform-level switcher
  variant (no tenant binding).
- `AuthLayout` and `ConsumerLayout` are shared components (today `AuthLayout` is
  byte-for-byte duplicated across all 5 apps).
- Notifications: one shared query/store feeds both the bell and the
  notifications page (today parent-web double-fetches with misaligned keys).

### 3.2 Navigation as data

Navigation is **derived from the route manifest** (§4).
`NavGroup[]`/`MobileNavItem[]` are computed from `navMeta` on each route,
filtered by the current user's `role` + `permissions`. The same manifest also
drives the prefetch map and `<Routes>` tree — eliminating the three-way
stringly-typed duplication (App.tsx ↔ nav config ↔ prefetch map).

RN consumes the identical manifest through a `react-navigation` renderer (the
injectable `LinkComponent` pattern already proves this is feasible).

---

## 4. Routing & route guards

### 4.1 Typed route manifest (per app)

```ts
// e.g. apps/teacher-web/src/routes.ts
import { RouteManifest } from "@levelup/shared-routing";

export const routes: RouteManifest = [
  {
    path: "/",
    lazy: () => import("./pages/DashboardPage"),
    allow: ["teacher", "tenantAdmin"],
    navMeta: {
      group: "Overview",
      label: "Dashboard",
      icon: "home",
      mobile: true,
    },
  },
  {
    path: "/spaces",
    lazy: () => import("./pages/SpaceListPage"),
    allow: ["teacher", "tenantAdmin"],
    navMeta: { group: "Content", label: "Spaces", icon: "layers" },
  },
  {
    path: "/spaces/:spaceId/edit",
    lazy: () => import("./pages/spaces/SpaceEditorPage"),
    allow: ["teacher", "tenantAdmin"],
  }, // no navMeta = not in sidebar
  // ...
];
```

```ts
// shared-routing types
type RouteDef = {
  path: string;
  lazy: () => Promise<{ default: ComponentType }>;
  allow?: TenantRole[]; // role gate (from shared-types)
  gates?: GatePredicate[]; // composable pre-render gates (e.g. onboarding)
  navMeta?: {
    group: string;
    label: string;
    icon: IconName;
    mobile?: boolean;
    permission?: keyof TeacherPermissions | keyof StaffPermissions;
  };
};
type RouteManifest = RouteDef[];
```

A web renderer turns the manifest into the `<Routes>` tree (each leaf wrapped in
`RouteErrorBoundary` + lazy `Suspense`), and into the sidebar/prefetch/isActive
data. `NotFoundPage` and `LoginPage` are imported from `shared-ui` everywhere
(today inconsistent: teacher has a local NotFound; LoginPage is static in some,
lazy in others — standardize on lazy).

### 4.2 One `RequireAuth` (config-driven)

Replace the 5 drifted copies with one guard. Encode the _strongest_ behaviors as
opt-in flags so every app benefits:

```ts
interface RequireAuthProps {
  allow?: TenantRole[]; // role(s) permitted
  requireTenantMatch?: boolean; // admin's currentMembership.tenantId === currentTenantId
  requireSuperAdminClaim?: boolean; // super-admin: verify live custom claim AND isSuperAdmin
  onMissingMembership?: "denied" | "consumerRedirect"; // student B2C fallback
  gates?: GatePredicate[]; // e.g. onboardingGate (admin)
}
```

- Single loading UI (skeleton variant by app), single redirect-to-`/login`,
  single Access-Denied panel.
- `requireSuperAdminClaim` folds in the super-admin async claims verification
  (Firestore `isSuperAdmin` + live JWT `role === 'superAdmin'`).
- `onMissingMembership: 'consumerRedirect'` folds in student-web's
  B2B→`/consumer` redirect.
- `gates` generalizes admin-web's inline `OnboardingGuard` into a composable
  predicate array run before render (no per-route inline wrappers).

```ts
// gate example
const onboardingGate: GatePredicate = ({ membership, tenant, isSuperAdmin }) =>
  isSuperAdmin ||
  membership?.role !== "tenantAdmin" ||
  tenant?.onboarding?.completed
    ? { ok: true }
    : { ok: false, redirect: "/onboarding" };
```

### 4.3 Auth source of truth

`shared-stores/auth-store` (Zustand) is the single source of truth — already
production-grade (multi-tenant switch via `switchActiveTenant` CF + token
refresh, real-time `/users/{uid}`, school-code login, friendly error mapping).
Remove the duplicate React Query `useAuth` listener; `useAuth`/`useCurrentUser`
delegate to the store. The store is DOM-free and RN-ready as-is — keep it.

### 4.4 Data router consideration

Adopt `createBrowserRouter` (data router) so route-level error elements, typed
params, and loaders are available. Loaders call `@levelup/api-client`
repositories (never Firestore directly), so the same data access is shared with
RN screens.

---

## 5. Per-app page inventory → common API mapping

All reads/writes below route through `@levelup/api-client` repositories (§6).
"Callable" names map 1:1 to the existing function surface; "repo read" means a
typed repository method backed by Firestore today.

### 5.1 teacher-web (roles: `teacher`, `tenantAdmin`)

| Route                                                 | Page                     | API (repo read → / callable ←)                                                                                                                      |
| ----------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                   | Dashboard                | `analytics.classSummaries`, `analytics.dailyCost`, notifications                                                                                    |
| `/spaces`                                             | SpaceList                | `spaces.list`                                                                                                                                       |
| `/spaces/:spaceId/edit`                               | SpaceEditor              | `spaces.get`, `storyPoints.list`, `items.list` → `saveSpace`, `saveStoryPoint`, `saveItem`, `reorderItems` (NEW), `moveItems` (NEW), `listVersions` |
| `/spaces/:spaceId/story-points/:storyPointId/preview` | TestPreview              | `items.getForEdit` (answer-key merge)                                                                                                               |
| `/question-bank`                                      | QuestionBank             | `questionBank.list` → `saveQuestionBankItem`, `importFromBank`                                                                                      |
| `/rubric-presets`                                     | RubricPresets            | `rubricPresets.list` → `saveRubricPreset`                                                                                                           |
| `/exams`                                              | ExamList                 | `exams.list`                                                                                                                                        |
| `/exams/new`                                          | ExamCreate (wizard)      | → `saveExam`, `extractQuestions`, `uploadAnswerSheets`                                                                                              |
| `/exams/:examId`                                      | ExamDetail               | `exams.get` → `saveExam`, `extractQuestions`, `generateReport`                                                                                      |
| `/exams/:examId/submissions`                          | Submissions              | `submissions.listLive`                                                                                                                              |
| `/exams/:examId/submissions/:submissionId`            | GradingReview            | `submissions.getLive`, `questionSubmissions.listLive` → `gradeQuestion` (single AND **bulk-approve** now server-side)                               |
| `/classes`, `/classes/:classId`                       | Classes / ClassDetail    | `classes.*`, `teachers.*`, `students.*`, `exams.*`, `spaces.*` → `saveClass`                                                                        |
| `/analytics/{classes,exams,spaces,tests}`             | Analytics                | `analytics.*`                                                                                                                                       |
| `/assignments`                                        | AssignmentTracker        | `analytics.*`                                                                                                                                       |
| `/grading`                                            | BatchGrading             | `submissions.listLive` → `gradeQuestion`                                                                                                            |
| `/students`, `/students/:studentId/report`            | Students / StudentReport | `students.*`, `analytics.studentSummary` → `saveStudent`, `generateReport`                                                                          |
| `/settings`                                           | Settings                 | `evaluationSettings.get` → `saveEvaluationSettings` (NEW callable; today `updateDoc`)                                                               |
| `/notifications`                                      | Notifications            | notifications repo                                                                                                                                  |

**Key fixes:** bulk-approve, story-point/item reorder, agent config, settings,
exam field edits all move from direct client `writeBatch`/`updateDoc`/`setDoc`
to callables (server recomputes `submission.summary`, stats, versions).
Move-items becomes an atomic identity-preserving `moveItems` callable (not
delete+recreate). `mapping.imageUrls` returns resolvable HTTPS URLs from the API
(one resolution point), not Storage paths. Tenant-name lookups in the layout
move to a `useTenantNames(ids)` hook (no `getDoc` in layout). Stats are
authoritative (trigger-maintained) — remove `liveCounts` + per-SP
`getCountFromServer`.

### 5.2 student-web (role `student`; B2C consumer no role)

| Route                                                               | Page                      | API                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                                                 | Dashboard (B2B)           | `analytics.studentSummary`, `exams.list`, `progress.allSpaces`, gamification                                                   |
| `/spaces`, `/spaces/:spaceId`                                       | SpacesList / SpaceViewer  | `spaces.*`, `storyPoints.list`, `progress.*`                                                                                   |
| `/spaces/:spaceId/story-points/:storyPointId`                       | StoryPointViewer          | `items.list`, `progress.storyPoint` → `evaluateAnswer`, `recordItemAttempt`                                                    |
| `/spaces/:spaceId/practice/:storyPointId`                           | PracticeMode              | `items.list` → `recordItemAttempt`; practice cache via realtime repo                                                           |
| `/spaces/:spaceId/test/:storyPointId(/analytics)`                   | TimedTest / TestAnalytics | `testSessions.*` → `startTestSession`, `submitTestSession`, `recordItemAttempt`; serverDeadline + clock skew via realtime repo |
| `/exams/:examId/results`                                            | ExamResult                | `exams.get`, `submissions.*`, `questionSubmissions.list`                                                                       |
| `/tests`, `/leaderboard`, `/notifications`, `/settings`, `/profile` | misc                      | `testSessions.list`, `leaderboard.read`, notifications, `notificationPreferences.*`                                            |
| `/consumer`, `/my-spaces`, `/consumer/spaces/...`                   | Consumer (B2C)            | `spaces.*` scoped to `platform_public`; `user.consumerProfile`                                                                 |
| `/store(/checkout)(/:spaceId)`                                      | Store                     | → `listStoreSpaces`, `purchaseSpace`, `saveSpaceReview`; cart in `consumer-store`                                              |
| `/achievements`, `/progress`                                        | Achievements / Progress   | **WIRE UP these routes** (currently dead links / unrouted pages)                                                               |

**Key fixes:** B2B vs B2C resolved by a `LearnerContext` that abstracts the data
source (tenant vs `platform_public`) — route on context, not path prefix; drop
duplicate route copies. Delete local hook duplicates (`useStoryPoints`,
`useTestSession`, etc.) — use shared headless hooks over `@levelup/api-client`.
The single deterministic evaluator (`auto-evaluate`) becomes a **shared
package** imported by both client and server (no scoring drift). "AI Analytics"
tab renamed to "Insights" or backed by real analytics functions. God components
(`TimedTestPage`, `StoryPointViewerPage`) decompose into `useTestRunner` +
`useTestTimer` + presentational pieces. Remove unrouted dead pages or wire them.

### 5.3 admin-web (role `tenantAdmin`)

| Route                                   | Page                                   | API                                                                                                                                            |
| --------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/onboarding`                 | Login / OnboardingWizard               | `lookupTenantByCode`, `login` / `saveTenant`, `saveAcademicSession`, `saveClass`                                                               |
| `/`                                     | Dashboard                              | `analytics.classSummaries`, `analytics.dailyCost`                                                                                              |
| `/users`                                | Users (Teachers/Students/Parents tabs) | `teachers/students/parents.*` → `createOrgUser`, `bulkImportStudents/Teachers`, `bulkUpdateStatus`, `saveParent`, `saveStudent`, `saveTeacher` |
| `/classes(/:classId)`                   | Classes / ClassDetail                  | `classes.*` → `saveClass`, `bulkUpdateStatus`                                                                                                  |
| `/content` (merge `/spaces`+`/courses`) | ContentOverview                        | `spaces.list` (read-only) — **merged** (today two duplicate pages)                                                                             |
| `/exams`                                | ExamsOverview                          | `exams.list`, `teachers.list`                                                                                                                  |
| `/academic-sessions`                    | AcademicSessions                       | `academicSessions.*` → `saveAcademicSession`, `rolloverSession`                                                                                |
| `/staff`                                | Staff                                  | `staff.list` (via `listTenantStaff` callable, NOT client read of global `userMemberships`) → `saveStaff`, `saveTeacher`                        |
| `/announcements`                        | Announcements                          | → `saveAnnouncement`, `listAnnouncements`                                                                                                      |
| `/analytics`, `/reports`                | Analytics / Reports                    | `analytics.*` → `generateReport`                                                                                                               |
| `/data-export`                          | DataExport                             | → `exportTenantData`                                                                                                                           |
| `/ai-usage`                             | AIUsage                                | `analytics.dailyCost`, `tenant.settings`, `gradingDeadLetter.list` (via repo)                                                                  |
| `/settings`                             | Settings                               | `evaluationSettings.get`, `tenant.get` → `saveTenant`, `saveEvaluationSettings`, `uploadTenantAsset`                                           |
| `/billing` (NEW)                        | Billing                                | `tenant.subscription` (governance UI on existing `TenantSubscription`)                                                                         |
| `/notifications`                        | Notifications                          | notifications repo                                                                                                                             |

**Key fixes:** Settings/Staff/AIUsage/AppLayout inline Firestore reads move
behind repos/callables (incl. `listTenantStaff`). Merge `/spaces`+`/courses`
into one `/content`. Replace per-page `usePagination`/`useSort`/`filteredX` with
shared `DataTable`. Standardize forms on `react-hook-form` + `zodResolver`
reusing the existing Zod `callable-schemas`. Narrow cache invalidation to
specific entity keys (not whole `["tenants", tenantId]`). Gate nav/routes on
`StaffPermissions`/`TenantFeatures` via a `useCan(permission)` hook.

### 5.4 super-admin (platform role; `requireSuperAdminClaim`)

| Route                  | Page                   | API                                                                                                                           |
| ---------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/`                    | Dashboard              | → `getPlatformSummary` (server-aggregated; no client full-collection scans)                                                   |
| `/tenants(/:tenantId)` | Tenants / TenantDetail | `tenants.list`, `tenants.get` (paged, server-side) → `saveTenant`, `deactivateTenant`, `reactivateTenant`, `exportTenantData` |
| `/analytics`           | UserAnalytics          | → `getPlatformSummary` (user scope)                                                                                           |
| `/feature-flags`       | FeatureFlags           | `tenants.list` → `saveTenantFeatures` (NEW, single registry)                                                                  |
| `/presets`             | GlobalPresets          | `globalPresets.list` → `saveGlobalEvaluationPreset`                                                                           |
| `/llm-usage`           | LLMUsage               | → `getPlatformSummary` (cost scope; eliminates N+1 per-tenant query)                                                          |
| `/system`              | SystemHealth           | → `getPlatformSummary` (health scope); health probes server-driven                                                            |
| `/settings`            | Settings               | → `savePlatformConfig` (NEW; validated/audited, not direct client write)                                                      |
| `/announcements`       | Announcements          | → `saveAnnouncement`, `listAnnouncements` (single announcement system)                                                        |
| `/users`               | GlobalUsers            | → `searchUsers`                                                                                                               |

**Key fixes:** all reads move to server-aggregated platform callables (no
browser full-collection scans, no N+1 in LLMUsage). Single feature-flag registry
consumed by `TenantFeatures` + FeatureFlags + Settings + tenant-seeding. One
announcements system. `platform/config` writes go through a validated callable.
Cursor-based pagination.

### 5.5 parent-web (role `parent`)

| Route                                                              | Page                     | API                                                                    |
| ------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------- |
| `/login`, `/`                                                      | Login / Dashboard        | `lookupTenantByCode`, `login` / `getLinkedChildren`, `getChildSummary` |
| `/children`, `/children/:childId/progress`                         | Children / ChildProgress | `getLinkedChildren`, `getChildSummary`, `getPerformanceTrends`         |
| `/children/:childId/results`, `/children/:childId/results/:examId` | Results / ResultDetail   | `getChildSubmissions(releasedOnly)`, `getQuestionFeedback`             |
| `/alerts`                                                          | Alerts                   | `getAlerts` (server-derived)                                           |
| `/compare`                                                         | Compare                  | `getChildSummary` (multi-child)                                        |
| `/notifications`, `/settings`                                      | Notifications / Settings | notifications, `notificationPreferences.*`                             |
| (PDF)                                                              | report download          | → `generateReport`                                                     |

**Key fixes:** introduce parent-facing read callables (`getLinkedChildren`,
`getChildSummary`, `getChildSubmissions`, `getQuestionFeedback`,
`getPerformanceTrends`, `getAlerts`) so the client never aggregates raw
submissions or relies on undocumented `parentId` queries. Use route params
(`/children/:childId/...`) instead of `?student=` query strings (first-class
deep links + RN nav). Surface query errors distinctly from empty states. (Note:
missing Firestore rules for `studentProgressSummaries` / parent
`questionSubmissions` reads are an access-model concern handled in the
auth-access spec; moving reads behind callables also resolves the client-rule
gap.)

---

## 6. Common API layer (`@levelup/api-client`) — the RN seam

The single contract web and RN share. Two collaborating pieces:

### 6.1 Typed callable registry + client

```ts
// shared-api/src/registry.ts — one entry per callable, schema-colocated
export const registry = {
  saveSpace:    { req: SaveSpaceRequestSchema,    res: SaveResponseSchema },
  saveItem:     { req: SaveItemRequestSchema,     res: SaveResponseSchema },
  gradeQuestion:{ req: GradeQuestionRequestSchema,res: GradeQuestionResponseSchema },
  reorderItems: { req: ReorderItemsRequestSchema, res: SaveResponseSchema },   // NEW
  moveItems:    { req: MoveItemsRequestSchema,    res: SaveResponseSchema },   // NEW
  getPlatformSummary: { req: ..., res: ... },
  // ... all ~47 callables
} as const;

// transport-injectable: Firebase httpsCallable (web/RN) or fetch+REST (gateway later)
export function createCallableClient(registry, transport: Transport) {
  return new Proxy({}, { /* name -> validated invoke(name, data) */ });
}
```

- One generic `invoke(name, data)` interface (replaces the copy-pasted
  `getCallable` factory and stringly-typed names in 3+ places).
- Requests validated client-side against the Zod schema; responses validated
  with `safeParse` behind a dev flag to catch contract drift.
- `tenantId` is derived from auth claims server-side, not passed in every
  request body.

### 6.2 Repositories (read side)

```ts
interface SpacesRepo {
  list(opts): Promise<Space[]>;
  get(spaceId): Promise<Space>;
  listLive(opts, cb): Unsubscribe; // for onSnapshot views (grading, submissions)
}
// + ExamsRepo, SubmissionsRepo, ProgressRepo, TestSessionRepo, ChatRepo,
//   ClassesRepo, StudentsRepo, AnalyticsRepo, NotificationsRepo, TenantsRepo ...
```

- Backed by Firestore today (the only place that imports `firebase/firestore`);
  swap to REST later without touching UI.
- Centralizes the `tenants/{tenantId}/...` path builder in ONE module and
  validates every response through Zod before it enters React state (kills
  `as Type` casts and unsafe timestamp casts).
- Timestamps normalized to epoch-millis at the repo edge (one `toEpochMillis`
  util) — transport-neutral, RN/JSON-safe.

### 6.3 Hooks consume repositories

`shared-hooks/headless` React Query hooks call repos/registry, never Firebase.
Hierarchical query keys via a central key factory; `enabled: !!tenantId`;
mutations invalidate the narrowest scope. RN imports these hooks unchanged. DOM
hooks live in `shared-hooks/web`.

```
UI (web pages / RN screens)
      │  uses
shared-hooks/headless (React Query)
      │  calls
@levelup/api-client  (repositories + callable registry, Zod-validated)
      │  via injected Transport
Firebase SDK (today)  ──or──  REST/tRPC gateway (later)
```

---

## 7. Inconsistencies to eliminate (checklist)

| #   | Current inconsistency                                                                                                                                  | Resolution                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | 5 hand-copied `RequireAuth.tsx` (drifted loading UIs, tenant-match only in admin, consumer-redirect only in student, async-claims only in super-admin) | One config-driven guard (§4.2)                                     |
| 2   | 5 hand-built `AppLayout.tsx` (~250 lines each), inconsistent `isActive`                                                                                | One `PlatformLayout` + route-manifest-derived nav (§3)             |
| 3   | `AuthLayout.tsx` byte-for-byte duplicated ×5                                                                                                           | Shared `AuthLayout`/`ConsumerLayout`                               |
| 4   | Inconsistent shell features (breadcrumbs/branding/banners/role-switcher present in some apps only)                                                     | Shell feature flags; same primitives everywhere                    |
| 5   | `AppRole` (shared-ui) vs `TenantRole` (shared-types) drift                                                                                             | Single `TenantRole` everywhere                                     |
| 6   | Two content systems (TipTap HTML vs Markdown+KaTeX), lossy `preprocessMath`                                                                            | One canonical Markdown + one `ContentRenderer` (§2.3)              |
| 7   | ~30 hook files build Firestore paths inline; dead `organizations/{orgId}` generic service                                                              | `@levelup/api-client` repos; one path builder; `tenants/{id}` only |
| 8   | Direct client writes bypass callables (bulk-approve, reorder, agent config, settings, exam edits)                                                      | All writes via callables (server invariants)                       |
| 9   | Per-page table plumbing (`usePagination`/`useSort`/`filteredX`)                                                                                        | Shared `DataTable` + `useDataTable`                                |
| 10  | Ad-hoc `useState` forms despite RHF+Zod deps                                                                                                           | RHF + `zodResolver` reusing `callable-schemas`                     |
| 11  | Coarse cache invalidation (`["tenants", tenantId]`)                                                                                                    | Hierarchical key factory; narrow invalidation                      |
| 12  | super-admin client full-collection scans + LLMUsage N+1                                                                                                | Server-aggregated platform summary callables                       |
| 13  | `/spaces` + `/courses` duplicate admin pages                                                                                                           | Merge to `/content`                                                |
| 14  | student-web dead/unrouted pages + `/achievements`,`/results` 404s                                                                                      | Wire or remove                                                     |
| 15  | student-web duplicate local hooks vs shared-hooks                                                                                                      | Delete local; use shared headless                                  |
| 16  | "AI Analytics" tab is client heuristics, not AI                                                                                                        | Rename to Insights or back with real analytics                     |
| 17  | `mapping.imageUrls` stores Storage paths, resolved per consumer                                                                                        | API returns HTTPS URLs                                             |
| 18  | Layout fetches tenant names via raw `getDoc`                                                                                                           | `useTenantNames(ids)` hook                                         |
| 19  | Stringly-typed callable names in 3+ places; copy-pasted `getCallable`                                                                                  | Typed callable registry + `invoke`                                 |
| 20  | Zero frontend unit tests                                                                                                                               | Vitest + RTL for headless hooks/guards/state machines              |
| 21  | Stub `MetricsService`/progress service shipped from shared-ui                                                                                          | Implement in shared-api or delete; shared-ui presentational only   |
| 22  | Hand-maintained Tailwind safelist; tokens only Tailwind-shaped                                                                                         | `shared-tokens` (RN+web) + generated safelist                      |
| 23  | Mixed package build/export strategy                                                                                                                    | All ship `dist` consistently                                       |
| 24  | Inline `OnboardingGuard` wrapped per route                                                                                                             | Composable gate predicates (§4.2)                                  |

---

## 8. Migration note (from current code)

1. **Tokens & build first (no behavior change).** Extract `shared-tokens` from
   `tailwind-config/theme.js`; point the Tailwind preset at it; auto-generate
   the safelist. Standardize all packages on `dist` builds. Low-risk, unblocks
   RN later.
2. **Stand up `@levelup/api-client`** wrapping current Firestore reads and the
   existing callable wrappers behind repositories + the registry. Migrate hooks
   app-by-app to call repos; delete the dead `organizations/` generic service
   and the inline path strings. Add Zod validation + timestamp normalization at
   the repo edge.
3. **Add the missing/changed callables** server-side: `reorderItems`,
   `moveItems`, `saveEvaluationSettings`, `saveTenantFeatures`,
   `savePlatformConfig`, `listTenantStaff`, parent read callables,
   server-aggregated `getPlatformSummary` scopes, and server-side bulk-approve
   in `gradeQuestion`. Switch the offending client
   `writeBatch`/`updateDoc`/`setDoc` call sites to these.
4. **Introduce `shared-routing`:** define the per-app route manifest, the single
   `RequireAuth`, `PlatformLayout`, and gate predicates. Delete the 5
   `RequireAuth.tsx`, 5 `AppLayout.tsx`, and the duplicated `AuthLayout.tsx`.
   Derive nav/prefetch/isActive from the manifest. Optionally move to
   `createBrowserRouter`.
5. **Unify content rendering:** ship the single `ContentRenderer`; make
   `RichTextEditor` emit canonical Markdown; run the `preprocessMath` migration
   shim once over existing HTML content, then remove it from the runtime. This
   retires the `feat/teacher-portal-latex-rendering` churn.
6. **Decompose god components** (`SpaceEditorPage`, `ItemEditor`,
   `GradingReviewPage`, `TimedTestPage`, `StoryPointViewerPage`) into headless
   hooks/state machines + thin presentational views; this is also where the
   first frontend unit tests land.
7. **Per-app cleanups:** merge admin `/spaces`+`/courses`; wire/remove student
   dead routes and switch to `LearnerContext`; convert parent query-string nav
   to route params; adopt `DataTable` + RHF across admin/super-admin/teacher
   tables and forms; gate nav on `useCan`.
8. **Keep untouched** (already RN-ready / correct): `auth-store`,
   `tenant-store`, `consumer-store`; the Firebase hosting model (one target per
   app, SPA rewrite, immutable caching) — but generate
   `firebase.json`/`.firebaserc` and dev ports from one app registry so they
   never drift.
