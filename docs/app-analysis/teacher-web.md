# teacher-web — Architecture Analysis

> Source: `apps/teacher-web` (package `@levelup/teacher-web`, v0.1.0). Generated
> from a read-only walk of the source tree. Dev server was not started.

## 1. Purpose & audience

`teacher-web` is the **Teacher Portal** of the LevelUp platform — a tenant-aware
(multi-school) React SPA where teachers and tenant admins author learning
content, run exams, and grade student work. The HTML title is explicit:
_"LevelUp - Teacher Portal — Create spaces, grade exams, and track student
progress"_ (`index.html:7,18`). `RequireAuth` only admits roles `teacher` and
`tenantAdmin` (`src/App.tsx:61`). The page set spans the full teacher workflow:
dashboard, "Spaces" content authoring (story points + unified items), question
bank, rubric presets, exams (create → upload → grade → analytics), classes,
students, assignment tracking, batch grading, and notifications.

## 2. Tech stack

Per `package.json`:

- **Framework**: React 18.3, TypeScript 5.8.
- **Build**: Vite 5.4 with `@vitejs/plugin-react-swc`, Terser,
  `vite-plugin-compression` (gzip+brotli), `rollup-plugin-visualizer`.
- **Routing**: `react-router-dom@7.1` (classic `<Routes>`, not data routes).
- **State**: `@tanstack/react-query@5.62` + Zustand stores exposed via
  `@levelup/shared-stores`.
- **Backend SDK**: `firebase@11.2` (Auth, Firestore, Storage, Functions) routed
  through `@levelup/shared-services`.
- **UI**: Tailwind 3.4 + `@levelup/shared-ui` (Radix-based), `lucide-react`,
  `next-themes`, `sonner`.
- **Interaction**: `@dnd-kit/core` + `@dnd-kit/sortable` for reorder.
- **Content rendering**: `react-markdown` and `katex` (`main.tsx:10`) for LaTeX
  in questions/answers.

## 3. Entry & bootstrap

- `index.html` declares the PWA manifest (`/manifest.json`) and preconnects to
  `firebaseinstallations`, `firestore`, and `identitytoolkit` Google endpoints —
  a real LCP win for a Firebase-only frontend.
- `src/main.tsx` builds the provider tree top-down: `ErrorBoundary` →
  `ThemeProvider attribute="class" defaultTheme="system" enableSystem` →
  `QueryClientProvider` (`retry: 1, refetchOnWindowFocus: false`) →
  `BrowserRouter` wrapping `<App />` and
  `<SonnerToaster richColors position="top-right" />`.
- Firebase is initialised once at module load via `initializeFirebase({...})`
  reading `VITE_FIREBASE_*` env vars (apiKey, authDomain, projectId,
  storageBucket, messagingSenderId, appId, databaseURL).
- A **service worker** is registered for PWA support in production only
  (`main.tsx:48-71`); it self-updates hourly, emits `sw-update-available`, and
  reloads on `controllerchange`. `reportWebVitals()` runs eagerly.
- `vite.config.ts` pins the dev server to **port 4569**, sets `@` → `./src`,
  dedupes React + Router, and uses `manualChunks` to bucket `vendor-react` /
  `vendor-firebase` / `vendor-query` / `vendor-radix`. `ANALYZE=true` produces
  `dist/bundle-report.html`.

## 4. Routing map

All routes are in `src/App.tsx`. Every authenticated route is wrapped in
`RouteErrorBoundary` (shared-ui) and lazy-loaded via `React.lazy` +
`<Suspense fallback={<PageLoader/>}>`.

| Path                                                  | Component                                   | Notes                                                           |
| ----------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| `/login`                                              | `LoginPage`                                 | Two-step (school code → email/password); inside `AuthLayout`.   |
| `/`                                                   | `DashboardPage`                             | KPI cards, class perf, grading queue.                           |
| `/spaces`                                             | `SpaceListPage`                             | Filter/search; create from template; duplicate.                 |
| `/spaces/:spaceId/edit`                               | `SpaceEditorPage`                           | 5-tab editor (Settings/Content/Rubric/Agents/History).          |
| `/spaces/:spaceId/story-points/:storyPointId/preview` | `TestPreviewPage`                           | Student-view preview.                                           |
| `/question-bank`, `/rubric-presets`                   | `QuestionBankPage`, `RubricPresetsPage`     | Tenant-wide libraries.                                          |
| `/exams`                                              | `ExamListPage`                              | Status-tab filter.                                              |
| `/exams/new`                                          | `ExamCreatePage`                            | 4-step wizard (metadata → upload → review → publish).           |
| `/exams/:examId`                                      | `ExamDetailPage`                            | Questions, rubric, classes, publish/share.                      |
| `/exams/:examId/submissions[/:submissionId]`          | `SubmissionsPage`, `GradingReviewPage`      | Pipeline view + per-question grading.                           |
| `/classes[/:classId]`                                 | `ClassesPage`, `ClassDetailPage`            | CRUD + enrolment + progress.                                    |
| `/analytics/{classes,exams,spaces,tests}`             | analytics pages                             | Aggregations via `useExamAnalytics`, `useClassProgressSummary`. |
| `/assignments`, `/grading`                            | `AssignmentTrackerPage`, `BatchGradingPage` | Read-only roll-ups.                                             |
| `/students[/:studentId/report]`                       | `StudentsPage`, `StudentReportPage`         | Admin + PDF report.                                             |
| `/settings`, `/notifications`                         | `SettingsPage`, `NotificationsPage`         | Tenant settings; inbox.                                         |
| `*`                                                   | `NotFoundPage`                              | 20-line fallback.                                               |

**Route protection** (`src/guards/RequireAuth.tsx`): redirects to `/login` with
`state.from` when no `firebaseUser`; when role isn't in `allowedRoles` it
renders an inline "Access Denied" panel rather than redirecting.

## 5. Pages & key components

Sizing gives a complexity hint: `SpaceEditorPage` 1.6 kloc, `GradingReviewPage`
1.3 kloc, `ExamDetailPage` 1.2 kloc — three big "screens", everything else under
~600 lines.

- `DashboardPage` — KPI cards, class-performance bar chart, heatmap, recent
  spaces/exams, grading queue.
- `spaces/SpaceListPage` — status-tab grid; create from template
  (blank/course/assessment/practice); hover-duplicate loads SPs+items via
  Firestore then calls `useDuplicateSpace`.
- `spaces/SpaceEditorPage` — five tabs (Settings/Content/Rubric/Agents/History);
  DnD-kit reorder; per-item Sheet editor; bulk select/move/delete;
  section-grouped item lists; student-preview dialog.
- `spaces/QuestionBankPage` — `callListQuestionBank` /
  `callSaveQuestionBankItem` with subject/topic/type filters.
- `exams/ExamCreatePage` — 4-step wizard uploading PDFs/images to Storage,
  optionally linking a space.
- `exams/ExamDetailPage` — tabbed page using `callSaveExam`,
  `callGenerateReport`, `callExtractQuestions`; embeds `RubricEditor`,
  `ClassMultiSelect`, `ExamMetadataEditDialog`.
- `exams/SubmissionsPage` — pipeline icons across
  `uploaded → ocr_processing → scouting → grading → ready_for_review`; uploads
  via `callUploadAnswerSheets`.
- `exams/GradingReviewPage` — per-question grading with live `onSnapshot`
  subscriptions and AI re-grade via `callGradeQuestion`; keyboard shortcuts.
- `ClassesPage` / `ClassDetailPage`, `StudentsPage` / `StudentReportPage` —
  admin pages.
- `Assignment`/`BatchGrading`/`RubricPresets`/`TestPreview`/`Settings`/`Notifications`
  — read-only roll-ups or thin shared-ui wrappers.

Local components mirror the page split: `components/spaces` (ItemEditor,
ItemPreview, StoryPointEditor, SpaceSettingsPanel, RubricEditor,
AgentConfigPanel, QuestionBankImportDialog), `components/exam`
(ClassMultiSelect, ExamMetadataEditDialog), `components/class`,
`components/student`, `components/rubric/RubricPresetPicker`,
`components/question-bank/QuestionBankEditor`,
`components/shared/ConfirmDialog`.

## 6. State management

No app-local Zustand/Context store — global state comes from shared packages:

- **`@levelup/shared-stores`** — `useAuthStore` (firebaseUser, user profile,
  memberships, currentMembership, currentTenantId; actions
  `initialize`/`loginWithSchoolCode`/`switchTenant`/`logout`) and
  `useTenantStore` (subscribes to the tenant doc). `App.tsx:42-53` wires
  `initialize()` once and re-subscribes on `currentTenantId` change. Selector
  helpers `useCurrentUser` / `useCurrentTenantId` are used throughout.
- **TanStack Query** is the server cache. Pages pull a wide hook surface from
  `@levelup/shared-hooks`: spaces/story-points/items CRUD (`useSpaces`,
  `use{Create|Update|Publish|Archive|Duplicate}Space`,
  `use{Create|Update|Delete}{StoryPoint|Item}`),
  `useExams/useExam/useExamAnalytics/useSpaceAnalytics`, `useSubmissions`,
  `useClasses/useClassSummaries/useClassProgressSummary`,
  `useStudents/useStudent/useStudentProgressSummary`,
  `useNotifications/useUnreadCount/useMark{Read,AllRead}`,
  `useRubricPresets/useSaveRubricPreset`, `useEvaluationSettings`, plus UX
  helpers (`useApiError`, `useTenantBranding`, `usePrefetch`).
- **Local UI state** — `useState` per page for tabs/filters/dialogs; no shared
  wizard store.

## 7. Data layer

Three Firebase paths, in roughly this preference order:

1. **`@levelup/shared-services` callables** (Cloud Functions) — the canonical
   _write_ path. Pages import `callSaveExam`, `callSaveStudent`,
   `callSaveClass`, `callSaveQuestionBankItem`, `callSaveRubricPreset`,
   `callUploadAnswerSheets`, `callUploadTenantAsset`, `callGradeQuestion`,
   `callGenerateReport`, `callExtractQuestions`, `callImportFromBank`,
   `callListQuestionBank`, `callListVersions`, `callGetItemForEdit`,
   `lookupTenantByCode`. Most are wrapped by shared-hooks mutations; a handful
   are used inline with `useMutation`.
2. **Direct Firestore SDK** for reads not covered by a hook — story-point and
   item collections (`spaces/{id}/storyPoints` and `…/items` plus the legacy
   flat `items`), live counts (`getCountFromServer`), live submission state
   (`onSnapshot` in `GradingReviewPage`), tenant-name lookup in the role
   switcher. All go through `getFirebaseServices().db`. A few writes also bypass
   callables (story-point reorder uses `writeBatch`; `SettingsPage` writes
   evaluationSettings with `updateDoc`).
3. **Firebase Storage SDK** — `ref`/`uploadBytes`/`getDownloadURL` for answer
   sheets, exam PDFs, and tenant assets.

No REST/fetch calls — end-to-end Firebase.

## 8. Shared package usage

All six monorepo packages are dependencies (`package.json:20-25`):

- **`@levelup/shared-types`** — domain types (`Space`, `StoryPoint`,
  `UnifiedItem`, `Exam`, `Submission`, `Student`, `Class`, `UnifiedRubric`, all
  15 question-type payloads, `RubricPreset`, `EvaluationSettings`,
  `TenantRole`).
- **`@levelup/shared-services`** — Firebase init/services, the `call*` set
  above, media helpers (`uploadItemMedia`, `deleteItemMedia`), plus a `/auth`
  subpath (`callUploadTenantAsset`).
- **`@levelup/shared-hooks`** — react-query wrappers + UX helpers
  (`useApiError`, `useTenantBranding`, `usePrefetch`).
- **`@levelup/shared-stores`** — auth + tenant Zustand stores.
- **`@levelup/shared-ui`** — almost the entire UI: shell (`AppShell`,
  `AppSidebar`, `RoleSwitcher`, `MobileBottomNav`, PWA banners,
  `RouteErrorBoundary`, `PageLoader`); the Radix-wrapper kit
  (Button/Input/Sheet/Dialog/Tabs/Select/Switch/Card/Skeleton/Table); data viz
  (`ScoreCard`, `SimpleBarChart`, `ClassHeatmap`, `ProgressRing`,
  `AtRiskBadge`); content (`RichTextEditor`, `RichTextViewer`,
  `MarkdownWithMath`, `DownloadPDFButton`); `sonnerToast`.
- **`@levelup/shared-utils`** — `/web-vitals` subpath only.
- Dev: `@levelup/eslint-config`, `@levelup/tailwind-config` (preset + safelist).

## 9. Auth & permissions

- **Sign-in** (`LoginPage.tsx`): two-step. Step 1 calls
  `lookupTenantByCode(schoolCode)` and checks `status === "active"`; step 2
  calls `useAuthStore().loginWithSchoolCode(code,email,password)` and navigates
  to `location.state.from?.pathname || "/"`.
- **Bootstrap**: `App.tsx:42` runs `useAuthStore().initialize()` (sets up
  `onAuthStateChanged`) and re-subscribes the tenant doc whenever
  `currentTenantId` changes.
- **Route protection**:
  `<RequireAuth allowedRoles={["teacher","tenantAdmin"]} />` wraps the entire
  app shell. The header `RoleSwitcher` lets multi-tenant teachers hop between
  tenants; `AppLayout.tsx:195-223` filters memberships to teacher/admin and
  resolves sibling-tenant display names with a Promise.all of
  `getDoc(tenants/{id})` (one-shot, no react-query).
- Notifications and branding are scoped per `currentTenantId` everywhere.

## 10. Styling

Tailwind v3.4 with `presets: [sharedConfig]`. `content` globs include both the
app and `packages/shared-ui/src/**` so JIT picks up classes in shared
components; `safelist` is re-exported from `@levelup/tailwind-config/safelist`
so tenant-driven dynamic classes survive purging. `src/index.css` imports
`@levelup/tailwind-config/variables.css` then the three `@tailwind` directives —
design tokens (`--primary`, `--muted-foreground`, etc.) live in shared CSS
variables. `next-themes` with `attribute="class"` powers light/dark;
`useTenantBranding()` (`AppLayout.tsx:73`) sets per-tenant CSS custom properties
on the root. `katex/dist/katex.min.css` is imported once in `main.tsx:10`.

## 11. Build & tooling

`vite.config.ts`: `target: 'es2020'`, `cssCodeSplit`, sourcemap,
`chunkSizeWarningLimit: 800`, Terser with `drop_console`/`drop_debugger`;
`manualChunks` splits vendor bundles; output uses hashed
`assets/`/`chunks/`/`entries/`. Route-level **code splitting**: every page
(except `LoginPage`) is `React.lazy(() => import(...))`; `AppLayout.tsx:32-47`
defines `TEACHER_PREFETCH_MAP` and passes it to `usePrefetch` so hovering a
sidebar link warms the lazy chunk before navigation. ESLint
(`eslint.config.cjs`) is flat-config layering `@eslint/js`,
`@typescript-eslint/recommended`, and
`eslint-plugin-react-hooks recommended-latest`; `console.*` is warned (except
`warn`/`error`), `any` is warned, `prefer-const`/`no-var` are errors. TS uses
the standard Vite split (`tsconfig.app.json`, `tsconfig.node.json`). Scripts:
`dev`, `build`, `preview`, `lint`, `typecheck`, `test:e2e`, `analyze`.

## 12. Tests

- **No unit tests** — `npm test` literally echoes "No unit tests for
  teacher-web" (`package.json:12`).
- **Playwright E2E** under `apps/teacher-web/e2e/` (`playwright.config.ts`):
  chromium-only, `baseURL: http://localhost:3002`, `fullyParallel: false`,
  `workers: 1`, `timeout: 30s`, retries 2 in CI. Spec coverage: `auth`,
  `space-crud`, `space-settings-redesign`, `exam-crud`, `exam-class-edit`,
  `grading`, `class-crud`, `student-enroll`, `responsive`,
  `content-types-status`, plus diagnostic/explore specs and a second
  `playwright.content-types.config.ts`.

## 13. Notable patterns or quirks

- **Lazy + prefetch hybrid**: `React.lazy` pages plus an explicit
  `TEACHER_PREFETCH_MAP` warmed via `usePrefetch` on link hover.
- **PWA shell**: `AppShell` is wrapped with `MobileBottomNav`, `OfflineBanner`,
  `SWUpdateNotification`, `PWAInstallBanner`, `SkipToContent`.
- **Dual storage paths for items**: `SpaceEditorPage.loadItems` (line 415) tries
  the canonical nested `storyPoints/{id}/items` first and falls back to the
  legacy flat `items` filtered by `storyPointId`, remembering the chosen path
  per story point in `itemPaths` so subsequent reorder writes target the right
  place. Inline comments document the migration.
- **Stats reconciliation**: `liveCounts` uses `getCountFromServer` because
  seeded data bypasses the stats-incrementing callable, leaving
  `sp.stats.totalItems` stale (`SpaceEditorPage.tsx:362-367, 454-492`).
- **Auto-save inside Sheet**: `ItemEditor` gets both `onSave` (closes) and
  `onAutoSave` (keeps open) — see the deliberate `persistItem` split at
  `SpaceEditorPage.tsx:858-903`.
- **`Sheet`-based heavy editors** (Item, StoryPoint) instead of modal Dialogs,
  so list scroll context is preserved.
- **Imperative writes** mixed with callables for atomicity/speed (e.g.
  story-point reorder, evaluation settings).
- **Deep subpath import**: `SpaceSettingsPanel` pulls `callUploadTenantAsset`
  from `@levelup/shared-services/auth`, not the root — easy to miss when
  grepping.

## 14. Open questions / TODOs

- **Playwright `baseURL` mismatch** — `e2e/playwright.config.ts:13` says
  `http://localhost:3002` but Vite runs on `4569`. Either Playwright targets a
  different harness/preview, or the config is stale; specs would fail out of the
  box.
- **`_bulkSelectSP` is dead state** in `SpaceEditorPage.tsx:377`
  (underscore-prefixed for the linter) — read or write nowhere; either forgotten
  cleanup or feature-in-progress.
- **`SettingsPage` widens types locally** via `EvaluationSettingsWithFields`
  (`SettingsPage.tsx:22-27`) because shared types don't yet include
  `autoGrade`/`requireOverrideReason`/`releaseResultsAutomatically`/`defaultStrictness`
  — push these upstream.
- **Hard navigations** via `window.location.href = "/spaces"` in `DashboardPage`
  empty states (lines 191, 234) instead of `navigate(...)` — full-page reload,
  loses SPA state.
- **No unit tests at all** — every regression is caught by the serial E2E suite.
- **`AgentConfigPanel`** writes agent configs to Firestore with
  `setDoc`/`deleteDoc` directly; no callable enforces validation.
- **Effect waterfalls** in `SpaceEditorPage` (story points, items, version
  history, live counts) all depend on `tenantId`/`spaceId` — a coalesced loader
  would reduce flicker.
- **Diagnostic specs** (`diagnose.spec.ts`, `explore.spec.ts`) and
  screenshot/JSON artifacts sit alongside real specs in `e2e/`; quarantine or
  remove before CI integration.
