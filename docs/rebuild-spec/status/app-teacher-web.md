# Status Report — `apps/teacher-web`

Audit of the teacher-facing web app in the auto-levelup monorepo. Maps pages,
routing, guards, state, services, backend callables, and Firestore collections.
Cites real file paths. Closes with a concrete rebuild plan that keeps core
concepts while supporting a common API layer and future React Native apps.

---

## 1. What exists & how it's architected

### 1.1 Stack & entry

- Vite + React 18 + TypeScript, React Router v7, TanStack Query v5,
  Zustand-backed shared stores, Tailwind 3, `next-themes`, `sonner` toasts.
  (`apps/teacher-web/package.json`)
- Dev server on port 4569. Build uses terser (`drop_console`), gzip+brotli
  compression, manual vendor chunks (react / firebase / query / radix), source
  maps, bundle visualizer behind `ANALYZE=true`.
  (`apps/teacher-web/vite.config.ts`)
- Entry (`src/main.tsx`): initializes Firebase from `VITE_FIREBASE_*` env,
  mounts `ErrorBoundary` > `ThemeProvider` > `QueryClientProvider` >
  `BrowserRouter` > `App`, imports `katex/dist/katex.min.css` globally,
  registers a PWA service worker (`/sw.js`) in PROD with hourly update checks.
  QueryClient defaults: `retry: 1`, `refetchOnWindowFocus: false`.

### 1.2 Routing & guards (`src/App.tsx`)

- All pages except `LoginPage` are `lazy()`-loaded and wrapped in
  `<RouteErrorBoundary>`.
- Auth bootstrap: `useAuthStore.initialize()` on mount;
  `useTenantStore.subscribe(currentTenantId)` reacts to tenant changes.
- Guard: `RequireAuth allowedRoles={["teacher","tenantAdmin"]}`
  (`src/guards/RequireAuth.tsx`) — checks `firebaseUser` +
  `currentMembership.role`; shows Loading / redirects to `/login` / renders an
  inline "Access Denied" panel.
- Route map (all under `AppLayout`):
  - `/` Dashboard
  - Content: `/spaces`, `/spaces/:spaceId/edit`,
    `/spaces/:spaceId/story-points/:storyPointId/preview`, `/question-bank`,
    `/rubric-presets`
  - Exams: `/exams`, `/exams/new`, `/exams/:examId`,
    `/exams/:examId/submissions`, `/exams/:examId/submissions/:submissionId`
  - Classes: `/classes`, `/classes/:classId`
  - Analytics: `/analytics/classes`, `/analytics/exams`, `/analytics/spaces`,
    `/analytics/tests`
  - `/assignments`, `/grading` (batch), `/students`,
    `/students/:studentId/report`, `/settings`, `/notifications`, `*` NotFound.

### 1.3 Layout (`src/layouts/AppLayout.tsx`)

- Uses shared-ui shell primitives: `AppShell`, `AppSidebar`, `RoleSwitcher`,
  `LogoutButton`, `NotificationBell`, `ThemeToggle`, `PageTransition`,
  `RouteAnnouncer`, `MobileBottomNav`, `SWUpdateNotification`,
  `PWAInstallBanner`, `OfflineBanner`, `SkipToContent`.
- Nav grouped: Overview / Content / Analytics / People / System (lucide icons).
- `useTenantBranding()` injects tenant colors via CSS custom properties;
  `usePrefetch(TEACHER_PREFETCH_MAP)` warms lazy chunks on link hover.
- Notifications wired via
  `useNotifications`/`useUnreadCount`/`useMarkRead`/`useMarkAllRead`.
- Tenant switcher: filters `allMemberships` to `teacher`/`tenantAdmin`, fetches
  other tenant names with a raw `getDoc(doc(db,"tenants",id))` (direct Firestore
  read inside the layout).

### 1.4 Pages inventory (`src/pages`)

- Spaces: `SpaceListPage`, `spaces/SpaceEditorPage` (the largest, ~1640 lines),
  `spaces/QuestionBankPage`, `TestPreviewPage`, `RubricPresetsPage`.
- Exams: `exams/ExamListPage`, `exams/ExamCreatePage` (4-step wizard),
  `exams/ExamDetailPage`, `exams/SubmissionsPage`, `exams/GradingReviewPage`
  (~1330 lines), `BatchGradingPage`.
- People: `ClassesPage`, `ClassDetailPage`, `StudentsPage`, `StudentReportPage`.
- Analytics: `ClassAnalyticsPage`, `ExamAnalyticsPage`, `SpaceAnalyticsPage`,
  `ClassTestAnalyticsPage`, `AssignmentTrackerPage`.
- System: `DashboardPage`, `SettingsPage`, `NotificationsPage`, `LoginPage`,
  `NotFoundPage`.

### 1.5 Components (`src/components`)

- `spaces/`: `ItemEditor` (~2700 lines — all 15 question + 7 material editors,
  validation, autosave), `ItemPreview`, `StoryPointEditor`, `RubricEditor`,
  `AgentConfigPanel`, `SpaceSettingsPanel`, `QuestionBankImportDialog`.
- `exam/`: `ClassMultiSelect`, `ExamMetadataEditDialog`.
- `class/`: `ClassFormDialog`, `EnrollStudentDialog`.
  `student/StudentFormDialog`. `question-bank/QuestionBankEditor`.
  `rubric/RubricPresetPicker`. `shared/ConfirmDialog`.

### 1.6 The data-access model (the central architectural fact)

A consistent **CQRS-ish split** runs through the whole app:

- **Reads = direct Firestore from the browser** via TanStack Query hooks in
  `@levelup/shared-hooks` (`packages/shared-hooks/src/queries/*`). e.g.
  `useSpaces` does `getDocs(collection(db, 'tenants/{tid}/spaces'))`
  (`useSpaces.ts`), `useExams` (`useExams.ts`), `useSubmissions` uses live
  `onSnapshot` (`useSubmissions.ts`). Pages also do their own ad-hoc
  `getDocs`/`onSnapshot` (SpaceEditorPage, GradingReviewPage, ExamDetailPage,
  AgentConfigPanel, SpaceListPage).
- **Writes = Cloud Function callables** wrapped in `@levelup/shared-services`
  (`callSaveSpace`, `callSaveStoryPoint`, `callSaveItem`, `callSaveExam`,
  `callGradeQuestion`, `callImportFromBank`, `callSaveRubricPreset`,
  `callGetItemForEdit`, `callListVersions`, `callExtractQuestions`,
  `callGenerateReport`, `callUploadAnswerSheets`, etc.). Mutation hooks
  (`useSpaceMutations.ts`, `useExamMutations.ts`, `useItemMutations.ts`,
  `useSubmissionMutations.ts`) call `httpsCallable(functions, 'saveSpace')` and
  invalidate query keys.
- **But several writes bypass callables and write Firestore directly from the
  client**, which is the main consistency hazard:
  - SpaceEditorPage reorder of story points / items via `writeBatch`
    (`SpaceEditorPage.tsx` `handleDragEnd`, `handleItemDragEnd`).
  - GradingReviewPage "Approve All" via `writeBatch` setting
    `gradingStatus:"manual"` + `manualOverride` + `pipelineStatus:"reviewed"`
    directly (`GradingReviewPage.tsx` `handleBulkApprove`) — bypasses the
    server-side summary recompute that the single-question `callGradeQuestion`
    path uses.
  - AgentConfigPanel CRUD via `setDoc`/`deleteDoc` on `spaces/{id}/agents`
    (`AgentConfigPanel.tsx`).
  - SettingsPage saves evaluation settings via `updateDoc` (`SettingsPage.tsx`).
  - ExamDetailPage uses `updateDoc` for some fields,
    `callSaveExam`/`callExtractQuestions`/`callGenerateReport` for others.

### 1.7 LaTeX / rich-content rendering (two parallel systems — a real inconsistency)

- **Authoring** uses TipTap, producing **HTML**: `RichTextEditor` +
  `RichTextViewer`
  (`packages/shared-ui/src/components/editor/RichTextEditor.tsx`).
  `RichTextViewer` heuristically detects HTML and renders via
  `dangerouslySetInnerHTML`, else plain text. ItemEditor's "Content" field and
  the SpaceEditorPage preview dialog use this.
- **Display** of question/answer text uses **Markdown + KaTeX**:
  `MarkdownWithMath`
  (`packages/shared-ui/src/components/markdown/MarkdownWithMath.tsx`) —
  `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`. It carries a
  large `preprocessMath()` normalizer: ~190-entry `LATEX_CMD_LIST`, collapsing
  double-escaped `\\frac`, converting `\[ \]`/`\( \)`/bare
  `[...]`/`\begin{tabular}` to `$$`, and auto-wrapping bare LaTeX commands
  outside math mode. ExamDetailPage renders question text with
  `MarkdownWithMath`.
- Net effect: teachers author HTML (TipTap) but math is rendered through a
  Markdown/KaTeX pipe — the two formats do not fully overlap (HTML content won't
  go through the math preprocessor; Markdown content won't carry TipTap
  formatting). This is the in-flight work on branch
  `feat/teacher-portal-latex-rendering` (large diffs in `ItemEditor.tsx`,
  `SpaceSettingsPanel.tsx`, `GradingReviewPage.tsx`).

### 1.8 SpaceEditorPage internals (representative of the authoring complexity)

- 5 tabs: Settings / Content (story points) / Rubric / Agent Config / History
  (versions via `callListVersions`).
- Drag-and-drop reorder of story points and items via `@dnd-kit`.
- Items live at canonical nested path `spaces/{id}/storyPoints/{spId}/items`,
  with **legacy fallback to flat `spaces/{id}/items` filtered by
  `storyPointId`**; the page tracks per-SP `itemPaths: "nested" | "flat"` so
  writes target the right location (`loadItems`).
- Maintains `liveCounts` because `sp.stats.totalItems` is **known-stale for
  seeded data** (seed bypasses the stats-incrementing `saveItem` callable) —
  comment in code explicitly states this.
- Story-point types: `standard | practice | quiz | test | timed_test`. Sections
  supported within a story point.
- Item lifecycle uses callables:
  `useCreateStoryPoint/useUpdateStoryPoint/useDeleteStoryPoint`,
  `useCreateItem/useUpdateItem/useDeleteItem`,
  `useUpdateSpace/usePublishSpace/useArchiveSpace`. Autosave (2s debounce) +
  manual save in ItemEditor; `Cmd/Ctrl+Enter` saves.
- "Move items between story points" is implemented as **delete + recreate**
  (loses audit fields) (`SpaceEditorPage.tsx` bulk move Select).

### 1.9 ItemEditor (`src/components/spaces/ItemEditor.tsx`)

- Supports **15 question types**: mcq, mcaq, true-false, numerical, text,
  paragraph, code, fill-blanks, fill-blanks-dd, matching, jumbled, audio,
  image_evaluation, group-options, chat_agent_question; and **7 material
  types**: text, video, pdf, link, interactive, story, rich.
- Per-type `validateItem()` produces human-readable errors that disable Save and
  gate autosave.
- For `timed_test`/`test` story points, fetches the merged answer key via
  `callGetItemForEdit` (answer keys live server-side / stripped from client
  reads) and warns if the key looks stripped (`answerKeyLooksStripped`) to avoid
  silently overwriting it (the P0-1 mitigation). This reflects a real
  **answer-key protection scheme** at the function layer.
- Attachments via `uploadItemMedia`/`deleteItemMedia` (Storage). Bloom's level,
  topics, labels, sections classification.

### 1.10 Grading review (`src/pages/exams/GradingReviewPage.tsx`)

- Live listeners on the submission doc and its `questionSubmissions`
  subcollection.
- AI grade / re-grade / accept / manual override all routed through
  `callGradeQuestion` (`mode: "ai" | "manual"`) — server recomputes
  `submission.summary` transactionally.
- Resolves Storage **paths** in `questionSubmission.mapping.imageUrls` to HTTPS
  URLs via `getDownloadURL` (paths, not URLs, are persisted — a known data shape
  quirk).
- Keyboard nav (j/k/Enter/a/o/?), confidence bars, rubric breakdown, override
  audit timeline, bulk approve, prev/next submission navigation.

---

## 2. Entities, schemas, collections, callables, routes (with paths)

### 2.1 Domain entities (source of truth: `packages/shared-types/src`)

- `Space` (`levelup/space.ts`):
  `type: learning|practice|assessment|resource|hybrid`,
  `status: draft|published|archived`,
  `accessType: class_assigned|tenant_wide|public_store`, `classIds`,
  `teacherIds`, `defaultRubric`, store fields (`price`, `publishedToStore`...),
  `stats`, `version`, audit. Also `ContentVersion`.
- `StoryPoint` (`levelup/story-point.ts`): `type`, `sections`,
  `assessmentConfig`, `defaultRubric`, `difficulty`, `estimatedTimeMinutes`,
  `orderIndex`, `stats`.
- `UnifiedItem` (`content/item.ts`): polymorphic `payload` (`QuestionPayload` /
  `MaterialPayload`), `questionData` per type, `rubric`, `attachments`, `meta`
  (incl. `bloomsLevel`), `sectionId`, `orderIndex`.
- `Exam` (`autograde/exam.ts`): `classIds`, `totalMarks`, `passingMarks`,
  `duration`, `questionPaper`, `gradingConfig` (`autoGrade`,
  `allowManualOverride`, `requireOverrideReason`,
  `releaseResultsAutomatically`), `linkedSpaceId`, `status`, `stats`.
- `ExamQuestion` (`autograde/exam-question.ts`), `Submission` + `pipelineStatus`
  (`autograde/submission.ts`), `QuestionSubmission` with `evaluation`,
  `mapping`, `manualOverride`, `gradingStatus`
  (`autograde/question-submission.ts`), `EvaluationSettings`
  (`autograde/evaluation-settings.ts`), `ExamAnalytics`
  (`autograde/exam-analytics.ts`).
- Content support: `content/rubric.ts` (`UnifiedRubric`),
  `content/rubric-preset.ts`, `content/evaluation.ts`,
  `levelup/question-bank.ts`, `levelup/agent.ts`, `levelup/answer-key.ts`.

### 2.2 Firestore collections used by teacher-web (`firestore.rules`)

- `tenants/{t}/spaces/{s}` (+ `/storyPoints/{sp}/items/{i}`, legacy `/items`,
  `/agents`, `/versions`) — rules at `firestore.rules:262-347`. Teacher write
  gated on `createdBy == uid` or class/tenant scope.
- `tenants/{t}/exams/{e}` (+ `/questions`) — `firestore.rules:350-392`.
- `tenants/{t}/submissions/{sub}` (+ `/questionSubmissions`) —
  `firestore.rules:395-430`.
- `tenants/{t}/classes`, `/students`, `/teachers` — `firestore.rules:157-260`.
- `tenants/{t}/evaluationSettings`, `/questionBank`, `/rubricPresets`,
  `/academicSessions`, `/notifications`, `/dailyCostSummaries`,
  `/studentSummaries`, `/classSummaries`.
- `tenants` (top-level, for tenant-name lookups & branding).

### 2.3 Callables (`packages/shared-services/src`) used by teacher-web

- Content: `callSaveSpace`, `callSaveStoryPoint`, `callSaveItem`,
  `callGetItemForEdit`, `callListVersions`, `callImportFromBank`,
  `callListQuestionBank`, `callSaveQuestionBankItem`, `callSaveRubricPreset`,
  `callSaveSpaceReview` (`levelup/content-callables.ts`,
  `assessment-callables.ts`).
- Autograde: `callSaveExam`, `callExtractQuestions`, `callGradeQuestion`,
  `callUploadAnswerSheets`, `callEvaluateAnswer` (`autograde/exam-callables.ts`,
  `autograde/index.ts`).
- People/identity: `callSaveClass`, `callSaveStudent`, `callSaveTeacher`
  (`auth/auth-callables.ts`).
- Reports: `callGenerateReport` (`reports/pdf-callables.ts`).
- Backing functions live in `functions/{levelup,autograde,identity,analytics}`.

### 2.4 Shared hooks consumed (`packages/shared-hooks/src/queries`)

`useSpaces/useSpace/useStoryPoints/useStoryPoint/useItems/useItem`,
`useSpaceMutations` (create/update/publish/archive/duplicate + story-point/item
CRUD + reorder),
`useExams/useExam/useExamMutations/usePublishExam/useReleaseResults`,
`useSubmissions` (live),
`useSubmissionMutations/useGradeQuestion/useUploadAnswerSheets`,
`useClasses/useClass`, `useStudents/useStudent`, `useTeachers`,
`useRubricPresets/useSaveRubricPreset`, `useEvaluationSettings`,
`useExamAnalytics`, `useClassProgressSummary/useStudentProgressSummary`,
`useNotifications/useUnreadCount/useMarkRead/useMarkAllRead`,
`useTenant/useTenantBranding/useTenantSettings`, `useApiError`.

---

## 3. Strengths worth keeping

- **Clean CQRS intent**: writes through typed callables that enforce invariants
  (stats increments, summary recompute, answer-key protection, versioning) is
  the right backbone for a future common API + RN clients.
- **Strong shared-package layering**: `shared-types` is a real single source of
  truth; `shared-hooks`/`shared-services`/`shared-ui`/`shared-stores` are reused
  across all five web apps, so the teacher app is mostly composition.
- **Answer-key security model**: timed-test answer keys stripped from client
  reads and re-merged via `callGetItemForEdit`, with a UI guard against
  accidental overwrite (`ItemEditor.answerKeyLooksStripped`). Genuinely good
  design — keep it.
- **Rich, validated content authoring**: 15 question types + 7 material types
  with per-type validation, autosave with in-flight guards,
  Bloom's/topics/labels/sections taxonomy. This domain model is valuable IP.
- **Grading UX**: live listeners, AI confidence surfacing,
  low-confidence/needs-review filtering & sorting, override audit trail,
  keyboard-driven review, prev/next paging — a mature reviewer experience.
- **Performance & PWA hygiene**: route-level lazy loading + hover prefetch,
  manual vendor chunking, compression, web-vitals reporting, service worker,
  offline/update banners, accessibility primitives (`SkipToContent`,
  `RouteAnnouncer`, aria labels throughout).
- **Resilience to legacy data**: nested/flat item-path fallback and `liveCounts`
  recomputation keep seeded/legacy data working.

---

## 4. Pain points / tech debt / inconsistencies

- **Writes bypass the callable layer in multiple places**, defeating server-side
  invariants:
  - GradingReview "Approve All" writes `manualOverride`/`pipelineStatus` via
    `writeBatch` instead of `callGradeQuestion`, so `submission.summary` is
    **not** recomputed server-side the way single-question grading does
    (`GradingReviewPage.tsx` `handleBulkApprove`).
  - Story-point/item reorder via client `writeBatch` (`SpaceEditorPage.tsx`).
  - AgentConfigPanel `setDoc`/`deleteDoc`, SettingsPage `updateDoc`,
    ExamDetailPage `updateDoc`. Security rules become the only guard, and
    business logic is split across client and server.
- **Two rendering systems for content**: TipTap **HTML** authoring
  (`RichTextEditor`/`RichTextViewer`) vs Markdown+KaTeX **display**
  (`MarkdownWithMath`). Round-tripping is lossy; the large `preprocessMath`
  heuristic exists precisely because content format is not normalized at write
  time. (This is the active branch's churn.)
- **Stale denormalized stats**: `sp.stats.totalItems` is unreliable for seeded
  data; the page recomputes counts at runtime with N `getCountFromServer` calls
  per story point — a read-amplification cost and a correctness smell. Stats
  should be authoritative.
- **Legacy dual item paths** (nested vs flat) carried in the client. Should be
  migrated once and removed.
- **Move-items = delete+recreate** loses item identity/audit fields and is
  non-atomic (`SpaceEditorPage.tsx`).
- **God components**: `ItemEditor.tsx` (~2700 lines) and `SpaceEditorPage.tsx`
  (~1640) and `GradingReviewPage.tsx` (~1330) mix data orchestration, business
  rules, and presentation; hard to unit-test and to reuse in RN.
- **`questionSubmission.mapping.imageUrls` stores Storage paths, not URLs** —
  every consumer must resolve via `getDownloadURL`, duplicated logic
  (GradingReviewPage). Inconsistent data contract.
- **Ad-hoc `any` casts and "extra field" type extensions** (e.g.
  `QuestionSubmission & { reviewSuggested?: boolean }`,
  `{ gradingError?: string }`) signal that the shared-types schema lags the
  actual function output.
- **No unit tests** for teacher-web (`package.json` test script is a placeholder
  echo); only Playwright e2e exists.
- **Mixed timestamp handling** in UI (`._seconds`, `.toDate()`, raw casts)
  scattered through GradingReview/SpaceEditor — no shared timestamp formatter.
- **Tenant-name lookup is done inside `AppLayout`** with raw Firestore `getDoc`s
  rather than a hook — layout shouldn't fetch.
- **No optimistic-write abstraction**: each page hand-rolls optimistic update +
  rollback (reorder, bulk approve), duplicating patterns.

---

## 5. Recommendations for a fresh rebuild

Keep the domain (spaces > story points > items; exams > questions >
submissions > questionSubmissions; rubrics; question bank; answer-key
protection) and the CQRS direction; fix the seams.

1. **One API layer, no direct client writes.** Move every mutation (including
   reorder, bulk-approve, agent config, settings, exam field edits) behind
   callables / a thin REST/RPC gateway so all invariants (stats, summary
   recompute, versioning, answer-key) live server-side. Treat Firestore security
   rules as defense-in-depth, not the business layer. This is the prerequisite
   for RN parity.
2. **Make the API transport-agnostic and typed end-to-end.** Define
   request/response contracts in `shared-types` (the
   `Save*Request`/`SaveResponse` pattern in `content-callables.ts` is a good
   start) and generate a client SDK consumable by web and React Native. Prefer a
   callable gateway exposed over both `httpsCallable` (web) and plain HTTPS
   (RN/mobile, where the Functions SDK is heavier).
3. **Normalize content format at write time.** Pick ONE content representation
   (recommend portable Markdown-with-math, or a structured block model) and
   store it canonically; render with a single shared renderer used by authoring
   preview, student view, and grading. Retire the TipTap-HTML vs KaTeX split and
   shrink `preprocessMath` to a migration-only shim.
4. **Authoritative stats & no client recompute.** Maintain
   `stats.totalItems`/counts via function triggers (or transactions in the save
   callables) and backfill seeded data once. Remove `liveCounts` and per-SP
   `getCountFromServer`.
5. **Eliminate legacy dual item paths.** Migrate flat `/items` into nested
   `storyPoints/{id}/items` and delete the fallback branches.
6. **Fix the image-URL contract.** Persist resolvable HTTPS URLs (or a typed
   `{path, url}`) for `mapping.imageUrls`; centralize any resolution in one
   hook.
7. **Decompose god components into feature modules** with a headless core
   (data + business logic in hooks/state machines) and thin platform views, so
   the same logic powers web and RN. Candidate split: `useSpaceEditor`,
   `useItemEditor` (per-type sub-editors as a registry), `useGradingReview`
   state machine.
8. **Move-items as a real server operation** (atomic, identity-preserving)
   instead of delete+recreate.
9. **Shared cross-cutting utilities**: a timestamp formatter, an
   optimistic-mutation helper (with rollback), and an error/toast adapter — all
   in `shared-hooks`/`shared-utils` so RN reuses them.
10. **Tighten the type contracts**: fold the ad-hoc
    `& { reviewSuggested?, gradingError? }` extensions into
    `QuestionSubmission`; remove `any` casts in QuestionDataEditor dispatch.
11. **Layout shouldn't fetch**: replace `AppLayout`'s raw tenant-name `getDoc`s
    with a `useTenantNames(ids)` hook.
12. **Add a unit-test layer** for the extracted business hooks/validation (the
    per-type `validateItem`, grading-state transitions) — currently zero
    coverage.
13. **Keep the good UX wholesale**: lazy routes + hover prefetch, PWA, a11y
    primitives, keyboard-driven grading, confidence surfacing, version history,
    answer-key guard.

---

### Cited files

- `apps/teacher-web/src/App.tsx`, `src/main.tsx`, `vite.config.ts`,
  `package.json`
- `src/guards/RequireAuth.tsx`, `src/layouts/AppLayout.tsx`
- `src/pages/spaces/SpaceEditorPage.tsx`,
  `src/components/spaces/ItemEditor.tsx`,
  `src/components/spaces/AgentConfigPanel.tsx`
- `src/pages/exams/{ExamCreatePage,ExamDetailPage,GradingReviewPage}.tsx`,
  `src/pages/{BatchGradingPage,SettingsPage}.tsx`
- `packages/shared-ui/src/components/markdown/MarkdownWithMath.tsx`,
  `packages/shared-ui/src/components/editor/RichTextEditor.tsx`
- `packages/shared-services/src/levelup/content-callables.ts`,
  `.../autograde/*`, `.../auth/auth-callables.ts`,
  `.../reports/pdf-callables.ts`
- `packages/shared-hooks/src/queries/{useSpaces,useExams,useSubmissions,useSpaceMutations,useExamMutations}.ts`
- `packages/shared-types/src/{levelup/space.ts,levelup/story-point.ts,content/item.ts,autograde/exam.ts,autograde/submission.ts,autograde/question-submission.ts,autograde/exam-question.ts}`
- `firestore.rules` (lines 157-430), `firestore.indexes.json`
