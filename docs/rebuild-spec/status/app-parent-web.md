# Status Report — `apps/parent-web` (Parent Portal)

**Audited:** 2026-06-19 **Scope:** `apps/parent-web` source, cross-referenced
against `docs/PARENT-WEB-AUDIT-REPORT.md` (2026-03-01),
`requirements/parent-web/requirements.md` (2026-03-22), `firestore.rules`,
`firestore.indexes.json`, and `packages/shared-*`.

> NOTE: The existing `docs/PARENT-WEB-AUDIT-REPORT.md` (dated 2026-03-01) is
> **stale**. Nearly all of its CRITICAL/HIGH findings have since been fixed in
> the current code. This report reflects the _current_ state and surfaces a
> different, more serious class of issues (Firestore security-rule / index
> gaps).

---

## 1. What Currently Exists & How It's Architected

The Parent Portal is a Vite + React 18 + TypeScript SPA that lets a parent (one
Firebase Auth user with one or more `parent`-role memberships) view their linked
children's learning progress, exam results, performance alerts, and
notifications across one or more schools (tenants).

### Stack

- **Build/Runtime:** Vite 5 + `@vitejs/plugin-react-swc`, React 18.3, React
  Router 7, TypeScript 5.8 (`apps/parent-web/package.json`).
- **Data layer:** TanStack React Query 5 + Firebase Web SDK 11 (direct Firestore
  reads from the client; no dedicated API gateway).
- **State:** Zustand stores from `@levelup/shared-stores` (`useAuthStore`,
  `useTenantStore`, plus selectors `useCurrentUser`, `useCurrentMembership`,
  `useCurrentTenantId`).
- **UI:** `@levelup/shared-ui` (AppShell, AppSidebar, RoleSwitcher, ScoreCard,
  ProgressRing, AtRiskBadge, EmptyState, Accordion, SimpleBarChart,
  DownloadPDFButton, NotificationBell, theming, PWA banners).
- **Styling:** Tailwind 3 via `@levelup/tailwind-config`, `next-themes` for
  light/dark/system.
- **PWA:** service worker (`public/sw.js`), `manifest.json`, offline page,
  hourly SW update check, install/offline banners (`src/main.tsx:46-67`).
- **Tests:** Playwright E2E only (`e2e/auth.spec.ts`, `e2e/dashboard.spec.ts`,
  `e2e/responsive.spec.ts`); `package.json` test script is a no-op stub — **no
  unit tests**.

### App shell & bootstrap

- `src/main.tsx` — initializes Firebase from `import.meta.env.VITE_FIREBASE_*`
  (now properly typed, env-driven), wraps app in `ErrorBoundary` →
  `ThemeProvider` → `QueryClientProvider` → `BrowserRouter`, mounts
  `SonnerToaster`, reports Web Vitals, registers SW in prod. (The old audit's
  M-8/M-9 concerns about `import.meta as any` and missing ErrorBoundary are
  resolved; React.StrictMode is still not used.)
- `src/App.tsx` — Auth state init + tenant subscription effects; `Routes` with
  lazy-loaded pages, `RequireAuth allowedRoles={["parent"]}`, per-route
  `RouteErrorBoundary`, and `NotFoundPage` catch-all (old H-8 resolved).
- `src/layouts/AppLayout.tsx` — `AppShell` with three nav groups (Overview / My
  Children / Account), `RoleSwitcher` for multi-school parents (now resolves
  real tenant names via `useTenantNames`, fixing old C-2/H-2), `MobileBottomNav`
  (Home/Children/Results/Alerts), `NotificationBell`, `ThemeToggle`, route
  prefetch-on-hover (`usePrefetch` + `PARENT_PREFETCH_MAP`), tenant branding
  (`useTenantBranding`).
- `src/layouts/AuthLayout.tsx` — login chrome.
- `src/guards/RequireAuth.tsx` — loading / unauthenticated-redirect /
  role-denied gate.

### Pages (`src/pages/`) — all 9 routes implemented

| Route             | File                        | Purpose                                                                                                                                                                                                                    |
| ----------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`          | `LoginPage.tsx`             | Two-step school code → email/password; forgot-password via Firebase `sendPasswordResetEmail`.                                                                                                                              |
| `/`               | `DashboardPage.tsx`         | Summary cards (children count, avg perf, school code, at-risk count), quick actions, per-child overview cards, data-freshness indicator.                                                                                   |
| `/children`       | `ChildrenPage.tsx`          | Detailed per-child cards (exam avg, space completion, streak, recent exams) + links to progress/results scoped via `?student=<uid>`.                                                                                       |
| `/child-progress` | `ChildProgressPage.tsx`     | Per-child deep dive: stat cards, at-risk banner, strengths/weaknesses, improvement recommendations, `PerformanceTrendsChart`, subject breakdown bar charts, recent exams/activity, PDF download. Child selector tabs.      |
| `/results`        | `ExamResultsPage.tsx`       | Released-only exam submissions in an accordion; **per-question structured feedback** (score bar, rubric breakdown, strengths/weaknesses, mistake classification), PDF download, recommendations. (Old C-3 + H-1 resolved.) |
| `/progress`       | `SpaceProgressPage.tsx`     | Space progress grouped by child, resolved space titles, status/percentage/points/story-point counts.                                                                                                                       |
| `/alerts`         | `PerformanceAlertsPage.tsx` | Derived alerts per child (at-risk danger, low-score warning, low-streak info, low-completion warning).                                                                                                                     |
| `/compare`        | `ChildComparisonPage.tsx`   | Side-by-side comparison (progress rings, metric table with best-performer highlight, bar chart). Requires ≥2 children.                                                                                                     |
| `/notifications`  | `NotificationsPage.tsx`     | Wraps shared `NotificationsPageUI`; filter all/unread, mark read/all read, action-URL navigation.                                                                                                                          |
| `/settings`       | `SettingsPage.tsx`          | Read-only profile, **persisted** notification preferences (load + save + dirty-state + toast), logout. (Old C-1 resolved.)                                                                                                 |

### Data-access hooks (`src/hooks/`)

- `useLinkedStudents.ts` — queries root `userMemberships` by
  `tenantId + parentId + role=="student"`; exposes `useLinkedStudentIds`
  derivative.
- `useChildProgress.ts` — `tenants/{tenantId}/spaceProgress` where
  `userId in [batch of 30]`.
- `useChildSubmissions.ts` — `tenants/{tenantId}/submissions` where
  `studentId in batch` + `resultsReleased==true` + `orderBy createdAt desc`;
  then batch-resolves exam title/subject via `where(documentId() in ...)` with
  per-doc fallback (old H-6 N+1 resolved).
- `useQuestionSubmissions.ts` — `submissions/{id}/questionSubmissions`
  subcollection.
- `useNotificationPreferences.ts` / `useSaveNotificationPreferences.ts` —
  read/write `tenants/{tenantId}/notificationPreferences/{userId}` (merge).
- `useStudentNames.ts`, `useSpaceNames.ts`, `useTenantNames.ts` — name
  resolution with React Query caching.
- `components/PerformanceTrendsChart.tsx` uses shared `usePerformanceTrends`.

### Shared hooks consumed (`@levelup/shared-hooks`)

- `useStudentSummaries` / `useStudentProgressSummary`
  (`packages/shared-hooks/src/queries/useStudentSummary.ts`) — read
  `tenants/{tenantId}/studentProgressSummaries/{studentId}`.
- `usePerformanceTrends`
  (`packages/shared-hooks/src/queries/usePerformanceTrends.ts`) — reads
  `submissions` by `studentId` (see pain point P-3).
- `useNotifications`, `useUnreadCount`, `useMarkRead`, `useMarkAllRead`,
  `useTenantBranding`, `usePrefetch`.

### Shared services consumed (`@levelup/shared-services`)

- `initializeFirebase`, `getFirebaseServices` (`auth`, `db`).
- `lookupTenantByCode` (`packages/shared-services/src/auth/tenant-lookup.ts`)
  for two-step login.
- `callGenerateReport` (`packages/shared-services/src/reports/pdf-callables.ts`)
  — callable for `exam-result` and `student-progress-report` PDFs.

---

## 2. Entities / Schemas / Collections / APIs / Routes

### Firestore collections read (all via client SDK)

| Collection / Path                                         | Read by                                            | Notes                                                                              |
| --------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `userMemberships` (root)                                  | `useLinkedStudents`                                | Filtered `tenantId+parentId+role`. See P-1/P-2.                                    |
| `tenants/{tenantId}/studentProgressSummaries/{studentId}` | `useStudentSummaries`, `useStudentProgressSummary` | **No matching security rule** — see P-1.                                           |
| `tenants/{tenantId}/spaceProgress`                        | `useChildProgress`                                 | `where userId in batch`.                                                           |
| `tenants/{tenantId}/submissions`                          | `useChildSubmissions`, `usePerformanceTrends`      | Parents: `resultsReleased==true` required by rules.                                |
| `tenants/{tenantId}/submissions/{id}/questionSubmissions` | `useQuestionSubmissions`                           | Per-question grading. **Parent has no read rule on this subcollection** — see P-1. |
| `tenants/{tenantId}/exams`                                | `useChildSubmissions`                              | Title/subject resolution.                                                          |
| `tenants/{tenantId}/spaces`                               | `useSpaceNames`                                    | Space title resolution.                                                            |
| `tenants/{tenantId}/notificationPreferences/{userId}`     | prefs hooks                                        | RW gated to own uid (`firestore.rules:251-255`).                                   |
| `tenants/{tenantId}/notifications`                        | shared notification hooks                          | recipientId-gated (`firestore.rules:234-248`).                                     |
| `users` (root)                                            | `useStudentNames`                                  | Display name resolution.                                                           |
| `tenants/{tenantId}` (+ `tenantCodes`)                    | login + `useTenantNames`                           | `get` allowed pre-auth (`firestore.rules:133`, `:149`).                            |

### Domain types (source of truth: `packages/shared-types/src`)

- `UserMembership` — `identity/membership.ts:92` (fields: `uid`, `tenantId`,
  `tenantCode`, `role`, `status`, role-specific link ids
  `studentId`/`parentId`/etc., `parentLinkedStudentIds?`). **No `parentId` field
  is documented on a _student_ membership** — see P-2.
- `StudentProgressSummary` — `progress/summary.ts:66` (`autograde`/`levelup`
  metric blocks, `overallScore`, `strengthAreas`, `weaknessAreas`, `isAtRisk`,
  `atRiskReasons`).
- `Submission`, `Exam` — `autograde/*`.
- `QuestionSubmission` — `autograde/question-submission.ts:25` (`evaluation`
  with `percentage`, `score`/`maxScore`, `summary.overallComment`,
  `rubricBreakdown[]`, `strengths[]`, `weaknesses[]`, `mistakeClassification`,
  `gradingStatus`).
- `SpaceProgress`, `Space`, `Tenant`, `UnifiedUser`, `TenantRole`.

### Callable APIs

- `callGenerateReport({ tenantId, type, examId?, studentId? }) → { pdfUrl }`
  (`packages/shared-services/src/reports/pdf-callables.ts`), used in
  `ExamResultsPage` and `ChildProgressPage`.
- `lookupTenantByCode(code) → Tenant | null`
  (`packages/shared-services/src/auth/tenant-lookup.ts`).
- `useAuthStore.loginWithSchoolCode(code, email, password)` for the two-step
  flow.

### Security rules touching parents (`firestore.rules`)

- `isParent(tenantId)` helper (`:55-56`); parent read predicates rely on
  **custom-claim tokens** `request.auth.token.studentIds` and
  `request.auth.token.parentId`.
- Parent reads gated on: `students` (`:164`), `parents` own doc (`:192`),
  `exams` completed/released (`:360-362`), `submissions` released-only
  (`:400-402`), `spaceProgress` (`:444-445`), `storyPointProgress` (`:461-462`).
- `notificationPreferences` (`:251-255`), `notifications` (`:234-248`).

### Relevant composite indexes (`firestore.indexes.json`)

- `userMemberships`: `uid+status`, `tenantId+role+status`.
- `submissions`: `studentId+createdAt`, `studentId+submittedAt`,
  `examId+resultsReleased+classId`, etc.
- `spaceProgress`: several.

---

## 3. Strengths Worth Keeping

1. **Clean separation of concerns** — pages are thin; all Firestore access lives
   in small, single-purpose, React-Query-wrapped hooks with sensible `queryKey`s
   and `staleTime`s and `enabled` guards.
2. **Consistent name-resolution pattern** —
   `useStudentNames`/`useSpaceNames`/`useTenantNames` +
   `getStudentDisplayName`/`getInitials` helpers eliminate the raw-ID UX bugs
   the old audit flagged (C-2, H-7, L-3).
3. **Batched `where(... in ...)` queries** capped at 30 (`useChildProgress`,
   `useChildSubmissions`, `useSpaceNames`) respect the Firestore limit.
4. **Reuse of the shared-ui/shared-hooks/shared-services/shared-stores
   packages** — the portal is mostly composition; notifications, theming, PWA,
   error boundaries, charts, and PDF download are all shared primitives.
5. **Strong accessibility & UX scaffolding** — per-page skeletons, shared
   `EmptyState`, `role`/`aria-*` on charts and progress bars, `SkipToContent`,
   `RouteAnnouncer`, `PageTransition`, mobile bottom nav, prefetch-on-hover.
6. **Per-question structured feedback** (`ExamResultsPage`
   `QuestionFeedbackSection`) and **improvement recommendations** are fully
   built — the two biggest gaps in the old audit are closed.
7. **Persisted, dirty-tracked notification preferences** with toast feedback and
   merge semantics.
8. **Two-step tenant-scoped login** with forgot-password and proper role
   guarding.
9. **Build hygiene** — lazy routes, vendor chunk splitting, gzip/Brotli
   compression, Web Vitals reporting (per `vite.config.ts` / NFRs).

---

## 4. Pain Points / Tech Debt / Inconsistencies

### P-1 (CRITICAL — security/runtime): `studentProgressSummaries` and parent `questionSubmissions` have NO security rule → default-deny

- `firestore.rules` contains **no `match` block for
  `tenants/{tenantId}/studentProgressSummaries`**. The Dashboard, Children,
  Child Progress, Comparison, and Alerts pages all depend on
  `useStudentSummaries`/`useStudentProgressSummary` reading that collection.
  With no rule and no catch-all (the file ends at `firestore.rules` closing
  braces with two explicit `if false` blocks only), these reads **default-deny
  in production**. Either this collection is only ever read in the emulator/with
  relaxed rules, or the entire parent analytics surface is broken under real
  rules.
- The `questionSubmissions` read rule (`firestore.rules:418-425`) grants access
  to superAdmin/tenantAdmin/teacher/**student** — but **not `isParent`**.
  `ExamResultsPage`'s `QuestionFeedbackSection` (via `useQuestionSubmissions`)
  will be **denied for parents**, so the headline "structured per-question
  feedback" feature cannot actually load for a parent under current rules.

### P-2 (HIGH — data-model mismatch): `useLinkedStudents` filters student memberships by a `parentId` field that the membership schema does not define for students

- `useLinkedStudents.ts:21-26` queries `userMemberships` with
  `where("parentId","==",parentId)` on `role=="student"` docs. The
  `UserMembership` type (`identity/membership.ts:92`) documents `parentId?` only
  as the link from a _parent_ membership to its parent entity doc, and models
  the parent→children relationship via `parentLinkedStudentIds?` on the
  _parent's_ membership. The student→parent denormalization the query relies on
  is undocumented and may not be populated consistently by the seeding/cloud
  functions.
- The `userMemberships` read rule (`firestore.rules:120-122`) only allows
  `request.auth.uid == resource.data.uid`. A parent reading a _child's_
  membership doc (where `uid` is the student) is **not permitted by this rule**
  at all — so this query is also a likely permission failure independent of P-1.

### P-3 (HIGH — security bypass attempt that will fail): `usePerformanceTrends` queries submissions without `resultsReleased`

- `usePerformanceTrends.ts:30-34` queries `submissions` by `studentId` +
  `orderBy createdAt` + `limit 100`, with **no `resultsReleased==true`
  constraint**. Parent rules (`firestore.rules:400-402`) require
  `resultsReleased==true`. For a parent this query will be denied (or silently
  return nothing), so the Performance Trends chart on `ChildProgressPage` is
  effectively non-functional for parents.

### P-4 (HIGH — missing index): no composite index for the parent submissions query

- `useChildSubmissions` issues
  `where studentId in [...] + where resultsReleased == true + orderBy createdAt desc`.
  `firestore.indexes.json` has `studentId+createdAt` and
  `examId+resultsReleased+classId`, but **no
  `studentId+resultsReleased+createdAt`** index. An `in` + equality + orderBy
  needs a matching composite index; the query will throw a "needs index" error
  at runtime.

### P-5 (HIGH — missing index): no composite index for `useLinkedStudents`

- The `tenantId + parentId + role` query has no composite index
  (`firestore.indexes.json` only has `uid+status` and `tenantId+role+status`).
  Even if the rule/data-model issues (P-1/P-2) were resolved, the query needs a
  3-field composite index.

### P-6 (MEDIUM — fabricated recommendations): improvement recommendations are heuristic, not AI-derived

- `ChildProgressPage.tsx:255-303` and `ExamResultsPage.tsx:387-417` generate
  "recommendations" with hard-coded string templates driven by thresholds
  (`<40`, `<50`, `<3` streak, weakness-area names). Requirement FR-036 expects
  "AI-generated improvement recommendations when available in the submission
  data," but the code never reads such a field — it manufactures advice
  client-side. This is misleading-by-design and diverges from the requirement.

### P-7 (MEDIUM — client-side analytics aggregation): summaries/trends computed/fanned-out on the client

- `useStudentSummaries` fans out one `getDoc` per child via `useQueries`;
  `usePerformanceTrends` pulls up to 100 submissions and aggregates in the
  browser; alerts are derived client-side in `PerformanceAlertsPage`. This
  couples parent UX to raw collection shapes, leaks business logic into the
  client, and is duplicated across teacher/student/parent apps.

### P-8 (MEDIUM — no error surfacing): query `error`/`isError` states are unused

- Pages branch only on `isLoading` and "empty data," so any permission-denied /
  missing-index / network error (very likely given P-1–P-5) renders as a benign
  empty state, masking real failures. `RouteErrorBoundary` only catches
  render-time throws, not React Query errors.

### P-9 (LOW — duplicate notifications fetch): `AppLayout` and `NotificationsPage` both call `useNotifications` with different options

- `AppLayout.tsx:64-67` (default) vs `NotificationsPage.tsx:13-17`
  (`unreadOnly`/`limit:50`) produce non-aligned query keys → two reads. (Old
  audit M-2 still partially applies.)

### P-10 (LOW — direct-SDK coupling / no API layer): every page talks to Firestore directly

- There is no domain/service abstraction between the UI and Firestore.
  Collection paths, batching rules, and the released-only/at-risk business rules
  are scattered across app-local hooks and shared hooks. This blocks a clean
  React Native port and a common API layer.

### P-11 (LOW — testing gap): no unit/integration tests; `test` script is a stub.

### P-12 (LOW — minor): `React.StrictMode` not enabled (`main.tsx`); `getStudentDisplayName` falls back to `student.studentId` (an ID) before a generic label, which can still surface IDs when names fail to resolve.

---

## 5. Recommendations for a Fresh Rebuild

Keep the **core concept**: a parent authenticates within a tenant, sees a roster
of linked children, and for each child views progress (LevelUp), released exam
results with per-question feedback (AutoGrade), derived alerts, comparisons,
notifications, and downloadable reports. Improve the design as follows.

### Architecture / API layer

1. **Introduce a common API layer (callable functions or a thin BFF) for all
   read paths the parent uses** — `getLinkedChildren`, `getChildSummary`,
   `getChildSubmissions(releasedOnly)`, `getQuestionFeedback`,
   `getPerformanceTrends`, `getAlerts`. This removes direct Firestore coupling
   (P-10), centralizes the released-only / at-risk / recommendation business
   rules server-side, and is the single most important enabler for **future
   React Native apps** (which can hit the same callables). Keep React Query, but
   point it at typed callables instead of raw `getDocs`.
2. **Define shared, framework-agnostic "data contracts"** in
   `@levelup/shared-types` for every parent-facing read (e.g.,
   `ParentDashboardView`, `ChildSummaryView`, `ExamResultView`) so web and
   native consume identical typed payloads.
3. **Move all aggregation server-side** (P-7): the backend already produces
   `studentProgressSummaries` via scheduled functions — extend that to also
   produce trends and alert payloads, so the client never aggregates raw
   submissions. This also closes P-3 (no client query against `submissions`
   without `resultsReleased`).

### Security & data model (must-fix)

4. **Add the missing security rules** (P-1): a
   `match /tenants/{tenantId}/studentProgressSummaries/{studentId}` block
   allowing parent reads when
   `request.auth.token.studentIds.hasAny([studentId])`, and **extend the
   `questionSubmissions` read rule to include `isParent`** (gated on the
   submission's `studentId` ∈ parent's `studentIds` AND
   `resultsReleased==true`).
5. **Fix the parent→child linkage model** (P-2): standardize on the parent
   membership's `parentLinkedStudentIds` (or a dedicated, indexed
   `tenants/{tenantId}/parents/{parentId}` doc holding `childStudentIds`) as the
   authoritative link, and resolve children from the **parent's own**
   membership/claims — never by querying child membership docs the parent cannot
   read. Mirror the link into the custom-claim `studentIds` (already used by
   rules) at write time.
6. **Add required composite indexes** (P-4, P-5):
   `submissions: studentId + resultsReleased + createdAt(desc)` and
   `userMemberships: tenantId + parentId + role` (if that query survives the
   model redesign — ideally it does not, per #5).

### UX / correctness

7. **Replace fabricated recommendations with real data** (P-6): read
   AI-generated recommendation fields from `QuestionSubmission.evaluation` /
   `StudentProgressSummary` and render them; only fall back to generic copy when
   truly absent, and label it as generic.
8. **Surface query errors** (P-8): add an `isError` branch (distinct from empty)
   on every data-bound page and a global React Query error toast/banner; do not
   let permission-denied masquerade as "no data."
9. **Consolidate notifications fetching** (P-9): a single shared notifications
   query/store consumed by both the bell and the page, with identical keys.
10. **Standardize child selection via route params** —
    `/children/:childId/progress`, `/children/:childId/results` — instead of
    `?student=` query strings, so deep links and native navigation are
    first-class (the old H-5 intent, but cleaner).

### Hygiene

11. **Add a real test suite** (P-11): unit tests for hooks/selectors (mock the
    callable layer), plus keep the Playwright E2E. Make `pnpm test` meaningful.
12. **Enable `React.StrictMode`**, keep the existing strong a11y/PWA/prefetch
    scaffolding, and centralize the display-name fallback so IDs never leak to
    the UI.
13. **Preserve the shared-package composition model** — it is working well; the
    rebuild should deepen it (shared data-contracts + a shared API client)
    rather than re-fragment per app.
