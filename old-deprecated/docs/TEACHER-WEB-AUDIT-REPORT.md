# Teacher-Web (apps/teacher-web) — Full Audit Report

**Auditor:** Teacher-Web Auditor Agent **Date:** 2026-03-01 **Files reviewed:**
24 source files (all .ts/.tsx in src/) **Architecture reference:** Section 7.2
of docs/unified-design-plan/UNIFIED-ARCHITECTURE-BLUEPRINT.md

---

## Issue Summary

| Severity        | Count  |
| --------------- | ------ |
| CRITICAL (HIGH) | 8      |
| MEDIUM          | 17     |
| LOW             | 13     |
| **Total**       | **38** |

---

## CRITICAL ISSUES (Severity: HIGH)

### 1. Missing Class Detail page — entire feature absent

- **File:** `src/App.tsx` (routes, lines 51-79)
- **Type:** Missing Feature
- **Description:** The blueprint (Section 7.2) specifies a full "Class Detail"
  screen with Overview, Spaces Tab, Exams Tab, Students Tab, and Analytics Tab.
  No `/classes/:classId` route exists anywhere in the app. No `ClassDetailPage`
  component exists. This is one of the core screens for a teacher — viewing
  per-class details with all assigned content and student progress — and it is
  completely unimplemented. Teachers currently have no way to view a single
  class in detail.

---

### 2. Missing Agent Config for Spaces

- **File:** `src/pages/spaces/SpaceEditorPage.tsx` (lines 61, 406-410 — tab
  definitions)
- **Type:** Missing Feature
- **Description:** The blueprint specifies "Agent Config (evaluator/tutor
  setup)" under Space Editor. The SpaceEditorPage has three tabs: Settings,
  Content, and Rubric. There is no Agent Config tab. No Firestore queries target
  `/tenants/{tenantId}/spaces/{spaceId}/agents`. Teachers cannot configure AI
  evaluators or tutors for their spaces, which is a key part of the LevelUp
  AI-powered learning experience.

---

### 3. Missing Space Analytics page

- **File:** `src/App.tsx` (routes, lines 69-71)
- **Type:** Missing Feature
- **Description:** The blueprint specifies "Space Analytics (completion rates,
  engagement)" under Analytics. Only `ClassAnalyticsPage` (`/analytics/classes`)
  and `ExamAnalyticsPage` (`/analytics/exams`) exist. There is no dedicated
  Space Analytics page showing per-space completion rates, student engagement
  metrics, or content usage data. The class analytics page has a brief LevelUp
  section showing aggregate completion, but this does not replace a full space
  analytics view.

---

### 4. No error handling on Space creation (fire-and-forget callable)

- **File:** `src/pages/spaces/SpaceListPage.tsx`, lines 53-66
- **Type:** Bug / Error Handling
- **Description:** `handleCreateSpace` calls `httpsCallable('createSpace')` with
  no `try/catch` block. If the Cloud Function call fails due to network error,
  permission denied, quota exceeded, or any other reason, the error propagates
  as an unhandled promise rejection. The user receives no feedback that creation
  failed, and the `navigate()` on line 65 never executes, leaving them on the
  list page with no explanation.

```typescript
// Current code — no error handling
const handleCreateSpace = async () => {
  if (!tenantId || !firebaseUser) return;
  const { functions } = getFirebaseServices();
  const createSpace = httpsCallable(...)(functions, "createSpace");
  const result = await createSpace({ tenantId, title: "Untitled Space", type: "learning" });
  navigate(`/spaces/${result.data.spaceId}/edit`);
};
```

---

### 5. No error handling on Space publish/archive/unpublish

- **File:** `src/pages/spaces/SpaceEditorPage.tsx`, lines 199-217
- **Type:** Bug / Error Handling
- **Description:** Three critical lifecycle operations — `handlePublish`,
  `handleArchive`, and `handleUnpublish` — all call Cloud Functions or
  `updateDoc` with no `try/catch`. If any of these operations fail:
  - `handlePublish` (line 199): calls `httpsCallable(functions, "publishSpace")`
    — no error handling
  - `handleArchive` (line 207): calls `httpsCallable(functions, "archiveSpace")`
    — no error handling
  - `handleUnpublish` (line 215): calls
    `handleSaveSettings({ status: "draft" })` — `handleSaveSettings` has a
    `finally` block but no `catch`, so errors propagate silently

---

### 6. No error handling on story point and item CRUD operations

- **File:** `src/pages/spaces/SpaceEditorPage.tsx`, lines 219-327
- **Type:** Bug / Error Handling
- **Description:** Multiple Firestore write operations have no `try/catch`:
  - `handleAddStoryPoint` (line 219): `addDoc` call — no error handling
  - `handleDeleteStoryPoint` (line 241): `deleteDoc` call — no error handling
  - `handleDragEnd` (line 249): `writeBatch` + `batch.commit()` — no error
    handling
  - `handleAddItem` (line 276): `addDoc` call — no error handling
  - `handleDeleteItem` (line 309): `deleteDoc` call — no error handling
  - `handleSaveItem` (line 329): `updateDoc` call — no error handling
  - `handleSaveStoryPoint` (line 349): `updateDoc` call — no error handling

  Any Firestore write failure results in an unhandled promise rejection. The
  local state may have already been optimistically updated (e.g.,
  `handleDragEnd` updates `storyPoints` before `batch.commit()`), causing UI to
  show a state that doesn't match the database.

---

### 7. Direct Firestore writes bypass server-side validation

- **Files and lines:**
  - `src/pages/spaces/SpaceEditorPage.tsx:186-197` — `handleSaveSettings` uses
    `updateDoc`
  - `src/pages/spaces/SpaceEditorPage.tsx:329-347` — `handleSaveItem` uses
    `updateDoc`
  - `src/pages/spaces/SpaceEditorPage.tsx:349-357` — `handleSaveStoryPoint` uses
    `updateDoc`
  - `src/pages/spaces/SpaceEditorPage.tsx:219-239` — `handleAddStoryPoint` uses
    `addDoc`
  - `src/pages/spaces/SpaceEditorPage.tsx:276-307` — `handleAddItem` uses
    `addDoc`
  - `src/pages/spaces/SpaceEditorPage.tsx:241-247` — `handleDeleteStoryPoint`
    uses `deleteDoc`
  - `src/pages/spaces/SpaceEditorPage.tsx:309-327` — `handleDeleteItem` uses
    `deleteDoc`
  - `src/pages/exams/ExamDetailPage.tsx:68-79` — `handleSaveQuestionRubric` uses
    `updateDoc`
  - `src/pages/exams/SubmissionsPage.tsx:102-116` — `handleReleaseResults` uses
    `writeBatch`
  - `src/pages/exams/GradingReviewPage.tsx:96-146` — `handleOverride` uses
    `updateDoc`
  - `src/pages/exams/GradingReviewPage.tsx:148-190` — `handleBulkApprove` uses
    `writeBatch`
  - `src/pages/SettingsPage.tsx:38-57` — `handleSave` uses `updateDoc`
  - `src/pages/StudentsPage.tsx:30-51` — direct `getDocs` query
- **Type:** Architecture Violation
- **Description:** The blueprint's architecture decision #8 states "Server-side
  AI only — All LLM calls go through Cloud Functions for security, cost
  tracking, and key management." While this specifically references AI calls,
  the pattern established by the codebase uses Cloud Functions (callables) for
  mutations in many places (e.g., `callSaveExam`, `callPublishExam`,
  `callReleaseExamResults`, `callUploadAnswerSheets`, `callLinkExamToSpace`,
  `createSpace`, `publishSpace`, `archiveSpace`). However, a large number of
  write operations go directly to Firestore from the client, bypassing any
  server-side business logic validation. This creates an inconsistent mutation
  pattern — some writes go through functions, others directly to Firestore.
  While Firestore Security Rules may prevent unauthorized writes, server-side
  validation (e.g., checking that a space has content before publishing, or that
  marks don't exceed maximums) cannot be enforced on client-side direct writes.

---

### 8. StudentsPage uses raw Firestore query instead of shared hook

- **File:** `src/pages/StudentsPage.tsx`, lines 28-56
- **Type:** Architecture Violation / Consistency
- **Description:** Every other data-fetching page in the app uses shared hooks
  from `@levelup/shared-hooks` (e.g., `useSpaces`, `useExams`, `useSubmissions`,
  `useClasses`, `useStudents`). The DashboardPage even imports and uses
  `useStudents`. However, the StudentsPage manually constructs a Firestore query
  using `collection`, `query`, `where`, `getDocs` from the Firebase SDK. This
  means:
  - No TanStack Query caching or deduplication
  - No automatic refetch on focus/mount
  - No loading error state handling (only a boolean `loading` flag)
  - No refetch capability after mutations
  - Inconsistent with every other page in the app
  - The `useStudents` hook already exists and is used elsewhere — this page
    should use it too

---

## MEDIUM ISSUES (Severity: MEDIUM)

### 9. Dashboard fetches ALL submissions tenant-wide with no pagination

- **File:** `src/pages/DashboardPage.tsx`, lines 37-39
- **Type:** Performance
- **Description:** `useSubmissions(tenantId, { status: "ready_for_review" })`
  fetches all submissions with `ready_for_review` status for the entire tenant.
  For large schools with many active exams, this could be hundreds or thousands
  of documents loaded on every dashboard render. The dashboard only shows the
  first 5 (line 252: `submissions.slice(0, 5)`), so fetching all is wasteful.
  Should use a `limit` parameter.

---

### 10. Dashboard fetches ALL spaces, exams, classes, students on mount

- **File:** `src/pages/DashboardPage.tsx`, lines 35-41
- **Type:** Performance
- **Description:** Five separate queries fire simultaneously when the dashboard
  loads:
  1. `useSpaces(tenantId)` — all spaces
  2. `useExams(tenantId)` — all exams
  3. `useSubmissions(tenantId, { status: "ready_for_review" })` — all pending
     submissions
  4. `useClasses(tenantId)` — all classes
  5. `useStudents(tenantId)` — all students

  None have pagination or limits. In a school with hundreds of each entity, this
  is very expensive and slow. The dashboard only displays counts and the first 5
  items of each list.

---

### 11. useClassSummaries called for ALL classes simultaneously

- **File:** `src/pages/DashboardPage.tsx`, lines 43-47
- **Type:** Performance / N+1 Query
- **Description:** `useClassSummaries(tenantId, classIds)` creates N parallel
  TanStack Query instances — one per class. For a teacher with 20 classes, this
  fires 20 concurrent Firestore reads on every dashboard load. Should use a
  batch query or aggregate endpoint.

---

### 12. No pagination on StudentsPage

- **File:** `src/pages/StudentsPage.tsx`, lines 35-51
- **Type:** Performance
- **Description:** `getDocs(q)` fetches ALL student memberships for the tenant
  with `where("role", "==", "student")`. Schools with thousands of students will
  see major performance issues — large payload download, slow render of a
  massive table, and high Firestore read costs. No cursor-based pagination or
  limit is applied.

---

### 13. No pagination on ExamListPage or SpaceListPage

- **File:** `src/pages/exams/ExamListPage.tsx`, line 49;
  `src/pages/spaces/SpaceListPage.tsx`, line 45
- **Type:** Performance
- **Description:** Both pages call `useExams(tenantId, { status })` and
  `useSpaces(tenantId, { status })` respectively, fetching all exams/spaces for
  the tenant with no limit or cursor-based pagination. The entire list is loaded
  into memory and filtered client-side. For tenants with hundreds of exams or
  spaces, this becomes slow and expensive.

---

### 14. SubmissionsPage fetches all submissions without pagination

- **File:** `src/pages/exams/SubmissionsPage.tsx`, line 58
- **Type:** Performance
- **Description:** `useSubmissions(tenantId, { examId })` fetches all
  submissions for an exam. Popular exams in large classes could have hundreds of
  submissions. No limit, pagination, or virtualization is applied.

---

### 15. Missing 404/catch-all route

- **File:** `src/App.tsx`, lines 51-79
- **Type:** Missing Feature
- **Description:** No wildcard `*` or catch-all route exists. If a user
  navigates to an invalid URL (e.g., `/foo/bar`), they see a blank page inside
  the AppLayout (since RequireAuth renders `<Outlet />` and no route matches).
  Should display a "Page Not Found" message with navigation back to the
  dashboard.

---

### 16. No confirmation dialog on destructive actions

- **Files and lines:**
  - `src/pages/spaces/SpaceEditorPage.tsx:241-247` — delete story point
  - `src/pages/spaces/SpaceEditorPage.tsx:309-327` — delete item
  - `src/pages/spaces/SpaceEditorPage.tsx:207-213` — archive space
- **Type:** UX / Data Safety
- **Description:** Story point deletion, item deletion, and space archiving
  happen immediately on click with no confirmation dialog. A single accidental
  click permanently deletes content (story points and items) or archives a
  space. These are destructive operations that should require confirmation ("Are
  you sure? This cannot be undone.").

---

### 17. Tenant name shows tenantId instead of actual name in RoleSwitcher

- **File:** `src/layouts/AppLayout.tsx`, lines 106-112
- **Type:** Bug
- **Description:** The `tenantOptions` mapping sets `tenantName: m.tenantId` —
  it uses the raw tenant ID (e.g., `ten_abc123`) as the display name. The
  `UserMembership` type has a `tenantCode` field but no `tenantName`. The
  RoleSwitcher will display cryptic IDs instead of human-readable school names
  like "Springfield High School". The tenant name should be fetched from the
  tenant document or cached on the membership.

```typescript
// Current code
const tenantOptions: TenantOption[] = allMemberships
  .filter((m) => m.role === "teacher" || m.role === "tenantAdmin")
  .map((m) => ({
    tenantId: m.tenantId,
    tenantName: m.tenantId, // BUG: should be actual tenant name
    role: m.role,
  }));
```

---

### 18. SettingsPage uses extensive (as any) casting

- **File:** `src/pages/SettingsPage.tsx`, lines 27-34
- **Type:** Code Quality / Type Safety
- **Description:** All settings reads cast to `(settings as any).autoGrade`,
  `(settings as any).requireOverrideReason`, etc. This suggests either:
  - The `EvaluationSettings` type doesn't include these fields, or
  - The settings document shape doesn't match the type

  Using `as any` defeats TypeScript's safety checks. If a field is renamed in
  the database or type, the UI will silently read `undefined` and show incorrect
  defaults. The type should be updated to include these fields, or a proper type
  guard should be used.

---

### 19. ExamCreatePage uses examDate: new Date().toISOString() — always "now"

- **File:** `src/pages/exams/ExamCreatePage.tsx`, line 80
- **Type:** Missing Feature
- **Description:** The exam creation wizard has no date picker for scheduling
  the exam. The `examDate` is hardcoded to `new Date().toISOString()`, which is
  always the current timestamp at the moment of creation. Teachers cannot
  schedule exams for future dates. The blueprint implies exam scheduling is a
  core teacher workflow.

---

### 20. ExamCreatePage classIds is a free-text comma-separated input

- **File:** `src/pages/exams/ExamCreatePage.tsx`, lines 202-211
- **Type:** UX
- **Description:** Teachers must manually type raw class IDs (e.g., "class_10a,
  class_10b") into a text input. There is no class picker dropdown or
  multi-select. Teachers won't know the internal Firestore document IDs for
  their classes — they should select from a list of their assigned classes with
  human-readable names. The `useClasses` hook is available and used elsewhere in
  the app but not utilized here.

---

### 21. rollNumber is collected but never sent to backend

- **File:** `src/pages/exams/SubmissionsPage.tsx`, lines 61, 84-88
- **Type:** Bug
- **Description:** The upload form collects `rollNumber` (line 61:
  `const [rollNumber, setRollNumber] = useState("")`) and displays an input for
  it (lines 166-170), but `handleUploadSubmission` never passes `rollNumber` to
  `callUploadAnswerSheets`. The function call on line 84 uses
  `studentId: studentName || "Unknown"` — it sends the student's name as the
  studentId and completely ignores the roll number. The roll number field is
  useless in its current state.

```typescript
// Line 84-89 — rollNumber not included
await callUploadAnswerSheets({
  tenantId,
  examId,
  studentId: studentName || "Unknown", // Should be actual studentId
  classId: classId || "",
  imageUrls: urls,
  // Missing: rollNumber
});
```

---

### 22. SubmissionsPage \_bulkFiles state is declared but never used

- **File:** `src/pages/exams/SubmissionsPage.tsx`, line 64
- **Type:** Dead Code
- **Description:** `const [_bulkFiles, _setBulkFiles] = useState<File[]>([])` is
  declared with underscore prefixes (indicating intentionally unused) but
  neither the state nor the setter is ever referenced anywhere in the component.
  This suggests a bulk upload feature was planned but never implemented. Should
  be removed to reduce confusion, or the bulk upload feature should be
  completed.

---

### 23. GradingReviewPage bulk approve sets gradingStatus to "manual" instead of "reviewed"

- **File:** `src/pages/exams/GradingReviewPage.tsx`, lines 157-166
- **Type:** Potential Bug / Semantic Error
- **Description:** `handleBulkApprove` changes question submission status from
  `"graded"` to `"manual"`:

```typescript
if (qs.gradingStatus === "graded") {
  batch.update(..., { gradingStatus: "manual", ... });
}
```

The button is labeled "Approve All" (line 239) and the submission itself is
marked as `"reviewed"` (line 172). Setting individual question statuses to
`"manual"` is semantically inconsistent — "manual" implies a manual
override/re-grade, not an approval of the AI grade. This could cause confusion
in downstream analytics or reports that distinguish between AI-graded and
manually-graded questions.

---

### 24. SpaceEditorPage story point items not loaded on initial render

- **File:** `src/pages/spaces/SpaceEditorPage.tsx`, lines 142-184
- **Type:** UX / Stale Data
- **Description:** Items for story points are only loaded when a story point is
  expanded (via `expandedSP` state triggering `loadItems`). The collapsed story
  point view shows an item count from `sp.stats?.totalItems`, which is a
  cached/denormalized value on the story point document. If items have been
  added or deleted since the last stats update, the displayed count will be
  stale and misleading. Additionally, when a teacher first enters the editor,
  they have no visibility into what content exists inside each story point
  without manually expanding each one.

---

### 25. No loading or error state for ExamDetailPage questions fetch

- **File:** `src/pages/exams/ExamDetailPage.tsx`, lines 42-54
- **Type:** UX / Error Handling
- **Description:** Questions are loaded via a raw `useEffect` + `getDocs` call
  with no loading indicator and no error handling. While the main exam data
  shows a loading spinner (via `useExam` hook on line 33), the questions fetch
  runs independently. If the questions query fails (permissions error, network
  issue), the user sees an empty questions list with the message "No questions
  yet" — which is misleading because questions may exist but failed to load. No
  `try/catch` wraps the async operation.

---

## LOW ISSUES (Severity: LOW)

### 26. No logout confirmation

- **File:** `src/pages/DashboardPage.tsx`, lines 79-83
- **Type:** UX
- **Description:** The "Sign Out" button immediately calls `logout()` with no
  confirmation dialog. An accidental click logs the user out and redirects to
  the login page. While not critical, this is a common UX pattern to prevent
  accidental logouts, especially for teachers who may have unsaved work.

---

### 27. Login page doesn't restore previous location after login

- **File:** `src/pages/LoginPage.tsx`, lines 53-54
- **Type:** UX
- **Description:** After successful login, the page always navigates to `"/"`
  (line 54: `navigate("/", { replace: true })`). However, the `RequireAuth`
  guard saves the attempted location in router state (line 22 of
  RequireAuth.tsx: `<Navigate to="/login" state={{ from: location }} />`). The
  login page should read `location.state?.from` and redirect back to the
  originally requested URL, preserving deep links. Currently, if a teacher
  shares a link to `/exams/abc123` and the recipient isn't logged in, they'll be
  redirected to the dashboard after login instead of the exam page.

---

### 28. No form validation on ExamCreatePage number fields

- **File:** `src/pages/exams/ExamCreatePage.tsx`, lines 176-201
- **Type:** Validation
- **Description:** The `totalMarks`, `passingMarks`, and `duration` number
  inputs accept any value including 0 and negative numbers. There is no
  validation that:
  - `totalMarks > 0`
  - `passingMarks >= 0 && passingMarks <= totalMarks`
  - `duration > 0`
  - These fields are not empty/NaN

  The "Next" button only checks `!title.trim() || !subject.trim()` (line 231). A
  teacher could create an exam with 0 total marks or a passing mark higher than
  the total.

---

### 29. NotificationsPage has no "load more" functionality

- **File:** `src/pages/NotificationsPage.tsx`, line 15
- **Type:** Missing Feature
- **Description:** The page fetches notifications with `{ limit: 50 }` and
  passes `hasMore={data?.hasMore}` to the shared `NotificationsPageUI`
  component. However, there is no `onLoadMore` callback passed to load
  additional pages. If a teacher has more than 50 notifications, there is no way
  to view older ones. The `hasMore` flag is shown but not actionable.

---

### 30. SpaceSettingsPanel doesn't include class assignment

- **File:** `src/components/spaces/SpaceSettingsPanel.tsx` (entire file)
- **Type:** Missing Feature
- **Description:** The blueprint (Section 7.2) specifies "Space Settings (title,
  type, class assignment)" under Space Editor. The current settings panel
  includes title, description, type, access type, subject, labels, and
  assessment defaults — but no class assignment. There is no way for a teacher
  to assign a space to specific classes from within the Space Editor. The
  `Space` type likely has `classIds` or `assignedClassIds`, but this field is
  not editable in the settings panel.

---

### 31. SpaceEditorPage uses (item.payload as any) casting

- **File:** `src/pages/spaces/SpaceEditorPage.tsx`, lines 580-581
- **Type:** Type Safety
- **Description:** When displaying item type labels in the collapsed item view:

```typescript
{
  item.type === "question"
    ? (item.payload as any)?.questionType
    : (item.payload as any)?.materialType;
}
```

The payload is cast to `any` to access `questionType` or `materialType`. Since
`UnifiedItem` has a `payload` field typed as
`QuestionPayload | MaterialPayload`, proper type narrowing based on `item.type`
should be used instead of `as any`.

---

### 32. No keyboard accessibility on custom tab components

- **Files:**
  - `src/pages/spaces/SpaceEditorPage.tsx`, lines 478-493
  - `src/pages/exams/ExamDetailPage.tsx`, lines 259-273
  - `src/pages/exams/ExamListPage.tsx`, lines 88-101 (status filter tabs)
  - `src/pages/spaces/SpaceListPage.tsx`, lines 98-112 (status filter tabs)
- **Type:** Accessibility (a11y)
- **Description:** All tab components are implemented as plain `<button>`
  elements with `onClick` handlers but lack proper ARIA attributes
  (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`) and
  keyboard navigation (arrow key support to move between tabs). Screen readers
  cannot properly identify these as tab interfaces.

---

### 33. \_membership declared but unused in DashboardPage

- **File:** `src/pages/DashboardPage.tsx`, line 32
- **Type:** Dead Code
- **Description:** `const _membership = useCurrentMembership()` is declared with
  an underscore prefix indicating it's intentionally unused. However, the
  `useCurrentMembership()` hook call still triggers a Firestore
  subscription/query on every render. If the value isn't needed, the hook call
  should be removed entirely to avoid unnecessary database reads.

---

### 34. Imports in DashboardPage could be consolidated

- **File:** `src/pages/DashboardPage.tsx`, lines 25-27
- **Type:** Code Quality
- **Description:** Three separate `import type` statements from
  `@levelup/shared-types`:

```typescript
import type { Space } from "@levelup/shared-types";
import type { Exam } from "@levelup/shared-types";
import type { Submission } from "@levelup/shared-types";
```

Should be consolidated into a single import:
`import type { Space, Exam, Submission } from "@levelup/shared-types"`.

---

### 35. RubricEditor shared between Space and Exam contexts but located under spaces/

- **File:** `src/components/spaces/RubricEditor.tsx` (used in
  `SpaceEditorPage.tsx` and `ExamDetailPage.tsx`)
- **Type:** Architecture / File Organization
- **Description:** `RubricEditor` lives under `src/components/spaces/` but is
  also imported and used for exam question rubric editing in
  `ExamDetailPage.tsx` (line 16 and line 133). Since it's shared across both
  Space and Exam domains, it should be located in a shared/common components
  directory (e.g., `src/components/shared/` or `src/components/common/`) or
  moved to the `@levelup/shared-ui` package.

---

### 36. main.tsx uses (import.meta as any) casting for all env vars

- **File:** `src/main.tsx`, lines 18-24
- **Type:** Type Safety
- **Description:** Every environment variable access casts `import.meta` to
  `any`:

```typescript
apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY as string,
```

Vite provides proper typing via the `ImportMetaEnv` interface. A `src/env.d.ts`
file should declare the expected environment variables:

```typescript
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  // ... etc
}
```

This would provide compile-time safety for missing or misspelled env vars.

---

### 37. No React StrictMode wrapper

- **File:** `src/main.tsx`, lines 27-33
- **Type:** Best Practice
- **Description:** The app is rendered without `<React.StrictMode>`. StrictMode
  helps catch common bugs during development by:
  - Double-invoking render and effect functions to find impure renders
  - Warning about deprecated APIs
  - Detecting unexpected side effects

  It has no effect in production builds, so there's no downside to enabling it.

---

### 38. Space Picker dialog uses hardcoded bg-white (dark mode incompatible)

- **File:** `src/pages/exams/ExamDetailPage.tsx`, line 428
- **Type:** UI / Theming
- **Description:** The Space Picker modal dialog uses
  `className="... bg-white ..."` instead of the Tailwind CSS theme token
  `bg-card` or `bg-background`. If the app supports dark mode (the design system
  uses CSS custom properties like `--background`, `--card`), this modal will
  appear as a bright white box against a dark background, breaking the visual
  consistency.

---

## Missing Features vs. Blueprint (Section 7.2)

| Blueprint Feature                              | Implementation Status | Notes                                                            |
| ---------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| Login (school code -> credentials)             | IMPLEMENTED           | Two-step flow working correctly                                  |
| Dashboard - My Classes (cards)                 | NOT IMPLEMENTED       | Dashboard shows stats but no class cards                         |
| Dashboard - Recent Activity                    | PARTIAL               | Shows recent spaces/exams but not activity feed                  |
| Dashboard - Quick Actions                      | NOT IMPLEMENTED       | No quick action buttons (create space, create exam) on dashboard |
| Class Detail - Overview                        | NOT IMPLEMENTED       | Entire Class Detail page missing                                 |
| Class Detail - Spaces Tab                      | NOT IMPLEMENTED       | No per-class space assignment view                               |
| Class Detail - Exams Tab                       | NOT IMPLEMENTED       | No per-class exam list                                           |
| Class Detail - Students Tab                    | NOT IMPLEMENTED       | No per-class student roster                                      |
| Class Detail - Analytics Tab                   | NOT IMPLEMENTED       | No per-class analytics                                           |
| Space Editor - Settings                        | IMPLEMENTED           | Full settings panel with all fields                              |
| Space Editor - Story Point List                | IMPLEMENTED           | With drag-to-reorder via dnd-kit                                 |
| Space Editor - Story Point Editor              | IMPLEMENTED           | Type, sections, assessment config                                |
| Space Editor - Item Editor (15 question types) | IMPLEMENTED           | All 15 question types have editors                               |
| Space Editor - Item Editor (7 material types)  | IMPLEMENTED           | All 7 material types have editors                                |
| Space Editor - Agent Config                    | NOT IMPLEMENTED       | No agent/evaluator/tutor configuration                           |
| Space Editor - Publish Controls                | IMPLEMENTED           | Publish, unpublish, archive buttons                              |
| Exam Editor - Settings                         | IMPLEMENTED           | Grading config displayed                                         |
| Exam Editor - Question Paper Upload            | IMPLEMENTED           | In exam creation wizard                                          |
| Exam Editor - Question Review                  | IMPLEMENTED           | Extracted questions with rubric editing                          |
| Exam Editor - Submission Manager               | IMPLEMENTED           | Upload + list with pipeline status                               |
| Exam Editor - Grading Review                   | IMPLEMENTED           | Per-question with override capability                            |
| Exam Editor - Results Release                  | IMPLEMENTED           | Per-submission and bulk release                                  |
| Exam-Space Linkage                             | IMPLEMENTED           | Link exam to published space                                     |
| Analytics - Class Overview                     | IMPLEMENTED           | Cross-system AutoGrade + LevelUp                                 |
| Analytics - Exam Analytics                     | IMPLEMENTED           | Score distribution + per-question analysis                       |
| Analytics - Space Analytics                    | NOT IMPLEMENTED       | No dedicated space analytics page                                |
| Analytics - At-Risk Students                   | PARTIAL               | Shown on dashboard, not standalone page                          |
| Profile & Settings                             | PARTIAL               | Evaluation settings exist, no teacher profile                    |
| Notifications                                  | IMPLEMENTED           | Bell + full page with read/unread filters                        |

---

## Recommendations (Priority Order)

1. **Implement Class Detail page** — This is the highest-impact missing feature.
   Teachers need to view per-class details.
2. **Add try/catch error handling** to all async operations across all pages.
   Display error toasts/banners to the user.
3. **Add confirmation dialogs** for all destructive actions (delete, archive).
4. **Add pagination** to all list pages (students, exams, spaces, submissions).
5. **Implement Agent Config** tab in Space Editor.
6. **Implement Space Analytics** page.
7. **Fix tenant name display** in RoleSwitcher (show actual school name, not
   ID).
8. **Fix rollNumber handling** in SubmissionsPage — pass it to the backend.
9. **Replace direct Firestore writes** with Cloud Function callables for
   consistency.
10. **Refactor StudentsPage** to use the `useStudents` shared hook.
