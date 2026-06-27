# UX/UI Audit Report: Teacher Web App

**Date:** 2026-03-09 **Scope:** `/apps/teacher-web/src/` — all 41 source files
**Stack:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Firebase +
dnd-kit + React Markdown

---

## Executive Summary — Top 5 Critical Issues

| #   | Issue                                                                                   | Severity | Impact                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **SpaceEditorPage is a monolithic ~800-line component with no autosave**                | Critical | Teachers risk losing extensive content work on navigation, browser crash, or timeout. The component's complexity makes it fragile and hard to maintain.                                                       |
| 2   | **No form validation consistency — several forms accept invalid/empty data**            | Critical | ExamCreatePage allows comma-separated class IDs (no multi-select), SubmissionsPage defaults student name to "Unknown", space creation always succeeds with "Untitled Space" — leading to data quality issues. |
| 3   | **RequireAuth guard has bare "Loading..." text and no-escape access-denied state**      | High     | Users see a flash of unstyled "Loading..." on every protected page load. Access-denied state has no logout button or redirect — users are stuck.                                                              |
| 4   | **StudentsPage is read-only with no CRUD, no links to student reports**                 | High     | Teachers cannot manage students from the teacher app. The student list is a dead-end — no way to view individual student reports, add, edit, or remove students.                                              |
| 5   | **No pagination on list pages (Spaces, Exams, Questions) — client-side filtering only** | High     | As content grows, all items are loaded and filtered in memory. This will degrade performance for schools with hundreds of spaces/exams and create poor UX with long scroll lists.                             |

---

## Detailed Findings by Flow

### 1. Authentication Flow

#### 1.1 RequireAuth Loading State

- **Description:** The `RequireAuth` guard renders bare `<p>Loading...</p>` text
  while checking authentication status, with no spinner, skeleton, or branded
  loading screen.
- **Severity:** High
- **Current behavior:** Every protected route flashes plain "Loading..." text
  before content renders. This is especially jarring on slower connections.
- **Recommendation:** Replace with a full-page branded loading skeleton (logo +
  spinner) consistent with the app's design system. Use the existing `Loader2`
  icon from lucide-react with animation.

#### 1.2 Access Denied Dead-End

- **Description:** When a user lacks the required role, `RequireAuth` shows
  "Access Denied — You do not have permission to view this page" with no way to
  navigate away.
- **Severity:** High
- **Current behavior:** Users are stuck on a blank page with no logout button,
  no link to dashboard, and no redirect to the appropriate app for their role.
- **Recommendation:** Add a "Go to Dashboard" button, a logout button, and if
  the user has a different role (e.g., student), suggest redirecting to the
  correct app.

#### 1.3 No Forgot Password Flow

- **Description:** The LoginPage has no "Forgot password?" link or password
  reset flow.
- **Severity:** Medium
- **Current behavior:** Teachers who forget their password have no self-service
  recovery option.
- **Recommendation:** Add a "Forgot password?" link that triggers Firebase
  Auth's `sendPasswordResetEmail`. Show a success message with instructions to
  check email.

#### 1.4 School Code Lookup UX

- **Description:** The first step of login requires entering a "school code" to
  identify the tenant. There's no hint about what this code is or where to find
  it.
- **Severity:** Low
- **Current behavior:** An input field labeled "School Code" with placeholder
  "Enter your school code". Error shown inline if not found.
- **Recommendation:** Add helper text like "Ask your school administrator for
  this code" and consider allowing login by school name with autocomplete as an
  alternative.

---

### 2. Dashboard

#### 2.1 `window.location.href` Instead of React Router

- **Description:** The empty state for "Recent Spaces" uses
  `window.location.href = "/spaces"` instead of React Router's `navigate()` or
  `<Link>`.
- **Severity:** Medium
- **Current behavior:** Clicking "Create your first space" triggers a full page
  reload instead of client-side navigation, breaking the SPA experience and
  losing React state.
- **Recommendation:** Replace with `navigate("/spaces")` or a
  `<Link to="/spaces">` component. This pattern should be audited across all
  pages.

#### 2.2 At-Risk Students Alert Not Actionable

- **Description:** The at-risk students panel shows student names and reasons
  but doesn't link to individual student reports.
- **Severity:** Medium
- **Current behavior:** Teachers see "John Doe — Low exam scores" but cannot
  click through to the student's profile or report page.
- **Recommendation:** Make each at-risk student entry a clickable link to
  `/students/{studentId}/report`.

#### 2.3 Dashboard Stats Not Clickable

- **Description:** The four stat cards (Total Students, Active Exams, Total
  Spaces, At-Risk Students) are display-only.
- **Severity:** Low
- **Current behavior:** Cards show numbers but clicking them does nothing.
- **Recommendation:** Make each card a link to its respective list page (e.g.,
  clicking "Total Spaces" navigates to `/spaces`).

---

### 3. Content Creation — Spaces

#### 3.1 SpaceEditorPage Monolithic Complexity

- **Description:** The SpaceEditorPage is ~800+ lines handling 5 tabs (Settings,
  Content, Rubric, Agents, Versions), drag-and-drop, bulk operations, item
  editing, and version history in a single component.
- **Severity:** Critical
- **Current behavior:** A single component manages all editor state, making it
  fragile. Any bug in one section can cascade. The component is extremely
  difficult to test or modify.
- **Recommendation:** Extract each tab into its own component (ContentTab,
  RubricTab, AgentTab, VersionTab). Extract drag-and-drop logic into a custom
  hook. Consider a state machine (XState) for editor modes.

#### 3.2 No Autosave

- **Description:** The SpaceEditorPage has no autosave functionality. All
  changes require explicit save actions.
- **Severity:** Critical
- **Current behavior:** Teachers must remember to manually save. If the browser
  crashes, they navigate away accidentally, or the session times out, all
  unsaved work is lost.
- **Recommendation:** Implement autosave with debounced writes (e.g., 2-second
  delay after last edit). Show a "Saving..." / "Saved" / "Unsaved changes"
  indicator in the header. Add a `beforeunload` listener to warn about unsaved
  changes.

#### 3.3 No Unsaved Changes Warning

- **Description:** There is no prompt when navigating away from the
  SpaceEditorPage with unsaved changes.
- **Severity:** High
- **Current behavior:** Teachers can navigate away from the editor (via sidebar,
  browser back, etc.) and lose all their work without any warning.
- **Recommendation:** Use React Router's `useBlocker` or `beforeunload` event to
  prompt users before navigation when there are unsaved changes.

#### 3.4 Drag-and-Drop Lacks Visual Feedback

- **Description:** The dnd-kit implementation for reordering story points and
  items provides minimal visual feedback during drag operations.
- **Severity:** Medium
- **Current behavior:** Items can be dragged but there are no prominent drop
  zone indicators, no placeholder showing where the item will land, and no
  animation on drop.
- **Recommendation:** Add a highlighted drop zone indicator, a ghost/placeholder
  at the target position, and smooth animation on drop using dnd-kit's built-in
  overlay and transition features.

#### 3.5 Keyboard Shortcuts Not Discoverable

- **Description:** The SpaceEditorPage has keyboard shortcuts (Ctrl+Enter to
  save, Ctrl+N for new item, Escape to close) that are not surfaced to users.
- **Severity:** Low
- **Current behavior:** Shortcuts work but are completely hidden. No keyboard
  shortcut help panel, no tooltips on buttons mentioning shortcuts.
- **Recommendation:** Add a small "Keyboard shortcuts" button (or `?` icon) in
  the editor toolbar that opens a shortcuts reference panel. Add shortcut hints
  to button tooltips (e.g., "Save (Ctrl+Enter)").

#### 3.6 Space Creation Always Produces "Untitled Space"

- **Description:** When creating a blank space, the title is always "Untitled
  Space" with no option to set the name upfront.
- **Severity:** Low
- **Current behavior:** The create dialog only offers template selection, not a
  name field. Teachers must create the space then edit the title in settings.
- **Recommendation:** Add a title input field to the create dialog, pre-filled
  with the template name but editable. Focus the field on dialog open.

---

### 4. Content Creation — Exams

#### 4.1 Class Selection Uses Comma-Separated Text Input

- **Description:** In ExamCreatePage, the "Linked Classes" field is a plain text
  input expecting comma-separated class IDs.
- **Severity:** High
- **Current behavior:** Teachers must know and type exact class IDs separated by
  commas. There is no dropdown, autocomplete, or multi-select. Typos in class
  IDs silently create invalid links.
- **Recommendation:** Replace with a searchable multi-select component that
  lists available classes by name. Use combobox/tag-input pattern from
  shadcn/ui.

#### 4.2 No Confirmation Before Publishing Exam

- **Description:** Publishing an exam (changing status from draft to published)
  has no confirmation dialog.
- **Severity:** Medium
- **Current behavior:** Clicking "Publish" immediately changes the exam status.
  This is an irreversible action that makes the exam visible to students.
- **Recommendation:** Add a confirmation dialog: "Publishing this exam will make
  it visible to students in the linked classes. This cannot be undone.
  Continue?"

#### 4.3 Question Extraction Confidence Not Actionable

- **Description:** The ExamDetailPage shows AI confidence badges
  (high/medium/low) on extracted questions but doesn't clearly guide teachers on
  what to do with low-confidence items.
- **Severity:** Medium
- **Current behavior:** Low-confidence questions show a yellow/red badge.
  Teachers can click "Re-extract" but there's no inline editing guidance or
  suggestion for manual review.
- **Recommendation:** Add a "Review Required" banner above low-confidence
  questions with guidance. Sort questions so low-confidence items appear first.
  Add inline editing suggestions.

#### 4.4 ExamCreatePage File Upload Lacks Progress

- **Description:** The file upload step in the exam wizard shows a loading
  spinner but no upload progress percentage.
- **Severity:** Low
- **Current behavior:** After selecting a file, a spinner appears until upload
  completes. For large PDFs, this can take significant time with no progress
  indication.
- **Recommendation:** Use Firebase Storage's `uploadBytesResumable` to show a
  progress bar during upload. Show file size and estimated time remaining.

---

### 5. Grading Flow

#### 5.1 GradingReviewPage Monolithic Complexity

- **Description:** Similar to SpaceEditorPage, the GradingReviewPage is ~800+
  lines with complex state management for keyboard navigation, image lightbox,
  grade overrides, and submission navigation.
- **Severity:** High
- **Current behavior:** A single component handles all grading review
  functionality. While keyboard navigation is excellent (j/k, arrows, a=accept,
  o=override), the component size makes it fragile.
- **Recommendation:** Extract into sub-components: QuestionPanel,
  GradeOverrideForm, SubmissionNavigator, KeyboardShortcutHandler,
  ImageLightbox. Use a reducer for grading state.

#### 5.2 No Bulk Grade Override

- **Description:** While there's a "Bulk Approve" button for accepting all AI
  grades, there's no way to bulk-override grades (e.g., give all students full
  marks on a question that was incorrectly graded).
- **Severity:** Medium
- **Current behavior:** Teachers must override grades one question at a time per
  submission. For a class of 40 students with a systematically mis-graded
  question, this means 40 individual overrides.
- **Recommendation:** Add a "Bulk Override" option that lets teachers select a
  question and apply a score override across all submissions at once.

#### 5.3 Submission Upload Defaults Student Name to "Unknown"

- **Description:** In SubmissionsPage, the student name field defaults to
  "Unknown" if left empty, instead of requiring a name.
- **Severity:** Medium
- **Current behavior:** Teachers can upload answer sheets without entering a
  student name. The submission is created with name "Unknown", making it
  difficult to identify later.
- **Recommendation:** Make student name a required field. Add form validation
  that prevents submission until name is provided. Consider auto-suggesting
  names from the class roster.

#### 5.4 No Bulk Upload for Answer Sheets

- **Description:** The SubmissionsPage only allows uploading one answer sheet at
  a time.
- **Severity:** Medium
- **Current behavior:** Teachers must upload each student's answer sheet
  individually — selecting file, entering name, entering roll number, clicking
  upload. For a class of 40, this is 40 repetitions.
- **Recommendation:** Add a bulk upload flow: drag-drop multiple files,
  auto-extract student info from filenames (e.g., "john_doe_101.pdf"), or show a
  grid where teachers can map files to students.

#### 5.5 Grading Pipeline Status Unclear

- **Description:** The pipeline status in SubmissionsPage uses small icons with
  technical labels that may not be clear to non-technical teachers.
- **Severity:** Low
- **Current behavior:** Status shows as pipeline steps (uploaded → extracted →
  graded → reviewed) with small icons. The `PipelineStepIndicator` component
  uses compact icon layout.
- **Recommendation:** Add a progress bar with human-readable labels ("Processing
  answer sheet...", "AI is grading...", "Ready for review"). Consider adding
  estimated completion time.

---

### 6. Student Management

#### 6.1 StudentsPage is Read-Only

- **Description:** The StudentsPage displays a table of students but offers no
  CRUD operations.
- **Severity:** High
- **Current behavior:** Teachers can only view student names, roll numbers,
  admission numbers, grades, sections, and status. There are no add, edit,
  import, or remove actions.
- **Recommendation:** Add an "Add Student" button, inline edit capability, CSV
  import, and a delete (with confirmation) option. Consider bulk actions for
  status changes.

#### 6.2 No Link to Student Reports

- **Description:** The StudentsPage table rows are not clickable and don't link
  to the StudentReportPage.
- **Severity:** High
- **Current behavior:** Despite having a fully-built
  `/students/:studentId/report` page with comprehensive analytics, the
  StudentsPage table provides no way to navigate there.
- **Recommendation:** Make table rows clickable, linking to
  `/students/{studentId}/report`. Add a "View Report" action button in the table
  row.

#### 6.3 Student Search is Client-Side Only

- **Description:** The student search filters in-memory after loading all
  students.
- **Severity:** Medium
- **Current behavior:** All students are fetched from Firestore, then filtered
  by search text in the browser. No server-side filtering.
- **Recommendation:** For now this works, but add pagination (20-50 per page)
  and consider server-side search for schools with large student populations
  (500+).

---

### 7. Navigation & Information Architecture

#### 7.1 Sidebar Has 14 Items Across 5 Groups — Overwhelming

- **Description:** The sidebar navigation contains 14 items organized into 5
  groups (Overview, Content, Analytics, People, System). The Content section
  alone has 6 items.
- **Severity:** Medium
- **Current behavior:** All 14 navigation items are visible at all times. New
  teachers may feel overwhelmed by the number of options.
- **Recommendation:** Consider collapsible nav groups (default collapsed for
  Analytics). Move "Rubric Presets" and "Batch Grading" into the Spaces/Exams
  flows respectively as sub-pages rather than top-level navigation. Consider
  progressive disclosure.

#### 7.2 Mobile Bottom Nav Only Shows 5 Items

- **Description:** The mobile bottom navigation shows only 5 items (Home,
  Spaces, Exams, Students, Analytics), leaving 9 features inaccessible without
  opening the sidebar.
- **Severity:** Medium
- **Current behavior:** On mobile, features like Batch Grading, Question Bank,
  Assignments, Rubric Presets, and Settings require opening the hamburger menu /
  sidebar.
- **Recommendation:** Add a "More" item to the mobile bottom nav that opens a
  sheet/drawer with the remaining navigation items. Alternatively, use a
  contextual action menu.

#### 7.3 Inconsistent Breadcrumb Usage

- **Description:** Some pages have breadcrumbs (ExamDetailPage, ClassDetailPage,
  GradingReviewPage) while others don't (Dashboard, SpaceListPage, StudentsPage,
  Settings, BatchGrading, Assignments).
- **Severity:** Low
- **Current behavior:** Breadcrumbs appear on detail/nested pages but not on
  list pages. Users on deeper pages sometimes have no way to navigate up except
  the sidebar.
- **Recommendation:** Add breadcrumbs consistently to all pages. For top-level
  pages, show "Home > [Page Name]". For nested pages, show the full path.

#### 7.4 Analytics Split Across 4 Separate Pages

- **Description:** Analytics is split into Class Analytics, Exam Analytics,
  Space Analytics, and Class Test Analytics — each a separate page with its own
  data selector.
- **Severity:** Low
- **Current behavior:** Teachers must navigate between 4 pages and select
  entities on each to view different analytics. There's no unified analytics
  dashboard.
- **Recommendation:** Consider a unified analytics page with tabs, or at least
  cross-links between analytics pages (e.g., from Exam Analytics, link to the
  Space Analytics for the linked space).

---

### 8. Forms & Input Patterns

#### 8.1 Inconsistent Validation Patterns

- **Description:** Form validation is inconsistent across the app. Some forms
  validate inline (LoginPage), some validate on submit (ExamCreatePage), and
  some don't validate at all (SubmissionsPage student name).
- **Severity:** High
- **Current behavior:** LoginPage shows inline errors. ExamCreatePage validates
  on wizard step transition. SpaceSettings has no required field indicators.
  SubmissionsPage has no validation.
- **Recommendation:** Standardize on inline validation with error messages
  appearing below fields. Use a form library (react-hook-form + zod)
  consistently across all forms. Mark required fields with asterisks.

#### 8.2 RubricEditor Complex UI Not Guided

- **Description:** The RubricEditor supports 4 scoring modes (criteria_based,
  dimension_based, holistic, hybrid) with different UI for each. There's no
  guidance on which to choose.
- **Severity:** Medium
- **Current behavior:** A dropdown selects the scoring mode, and the UI changes
  completely. No descriptions, examples, or recommendations are shown for each
  mode.
- **Recommendation:** Add descriptions for each scoring mode in the dropdown or
  as helper text. Consider a "Recommended for..." label. Add a "Quick Start"
  option that pre-fills a basic rubric.

#### 8.3 SpaceSettingsPanel Has Many Fields Without Grouping

- **Description:** The SpaceSettingsPanel has metadata fields, assessment
  config, and store listing fields all in a single scrollable form.
- **Severity:** Low
- **Current behavior:** Title, description, type, access, subject, labels, time
  limits, retakes, show answers, price, currency, thumbnail are all in one long
  form with minimal visual separation.
- **Recommendation:** Group related fields into collapsible sections (Basic
  Info, Assessment Settings, Store Listing). Add section headers with
  descriptions.

---

### 9. Loading, Error, and Empty States

#### 9.1 Inconsistent Loading States

- **Description:** Loading states vary between pages — some use skeleton loaders
  (DashboardPage, SpaceListPage), some use spinners, and RequireAuth uses plain
  text.
- **Severity:** Medium
- **Current behavior:** DashboardPage uses card-shaped skeletons. SpaceListPage
  uses grid-shaped skeletons. ExamListPage uses a centered Loader2 spinner.
  RequireAuth shows "Loading..." text.
- **Recommendation:** Standardize on skeleton loaders for content areas
  (matching the shape of expected content) and a branded spinner for full-page
  loads. Create a reusable `PageSkeleton` component.

#### 9.2 Error States Missing on Several Pages

- **Description:** Several pages don't handle error states from their data
  hooks.
- **Severity:** Medium
- **Current behavior:** SpaceListPage, SpaceAnalyticsPage, and
  AssignmentTrackerPage have no explicit error handling for failed data fetches.
  If the Firestore query fails, the page shows the empty state instead of an
  error message.
- **Recommendation:** Add error boundaries and explicit error state handling.
  Show a "Something went wrong" message with a "Retry" button. Use the `isError`
  state from React Query hooks.

#### 9.3 Empty States Lack Guidance

- **Description:** While most pages have empty states, some lack helpful
  guidance or actions.
- **Severity:** Low
- **Current behavior:** SpaceListPage empty state has a "Create Space" button
  (good). But ExamListPage, BatchGradingPage, and AssignmentTrackerPage show
  only text messages without action buttons.
- **Recommendation:** Ensure every empty state includes: (1) an illustrative
  icon, (2) a clear message, and (3) a primary action button to resolve the
  empty state.

---

### 10. Bulk Operations & Data Tables

#### 10.1 SpaceEditorPage Bulk Select Limited

- **Description:** The SpaceEditorPage has checkbox-based bulk selection for
  items, but the only bulk action is delete.
- **Severity:** Medium
- **Current behavior:** Teachers can select multiple items within a story point
  and delete them in bulk. There's no bulk move, bulk copy, bulk change
  difficulty, or bulk reorder.
- **Recommendation:** Add a bulk actions toolbar that appears when items are
  selected, offering: Move to Story Point, Duplicate, Change Difficulty, Change
  Section, Export.

#### 10.2 StudentsPage Table Not Sortable

- **Description:** The students table has columns (Name, Roll Number, etc.) but
  none are sortable or filterable beyond text search.
- **Severity:** Medium
- **Current behavior:** The table is a flat list filtered only by a single
  search input. No column sorting, no filter by grade/section/status.
- **Recommendation:** Add sortable column headers (click to sort asc/desc). Add
  dropdown filters for Grade, Section, and Status. Consider using a proper data
  table component with these features built in.

#### 10.3 BatchGradingPage Pagination is Client-Side

- **Description:** BatchGradingPage loads all submissions and paginates
  client-side (10 per page).
- **Severity:** Medium
- **Current behavior:** All submissions for all exams are fetched, filtered by
  status/exam in memory, then paginated to show 10 at a time. The "total" count
  and page navigation work, but initial load can be slow.
- **Recommendation:** Implement server-side pagination using Firestore's
  `startAfter`/`limit` queries. Only load the current page of data.

#### 10.4 CSV Export Only on SubmissionsPage

- **Description:** Only the SubmissionsPage has CSV export functionality. Other
  data-heavy pages (Students, Exams, Analytics) lack export.
- **Severity:** Low
- **Current behavior:** Teachers can export submission data as CSV. But student
  lists, exam results, and analytics data cannot be exported.
- **Recommendation:** Add CSV/PDF export to StudentsPage, ExamDetailPage
  (results), and analytics pages. Teachers commonly need to share this data with
  administration.

---

### 11. Direct Firestore Calls (Architecture Concern)

#### 11.1 Inconsistent Data Access Patterns

- **Description:** Multiple pages make direct Firestore calls instead of using
  shared hooks, creating inconsistent data access patterns.
- **Severity:** Medium
- **Current behavior:** SpaceAnalyticsPage, AgentConfigPanel, SpaceEditorPage
  (version history), AppLayout (tenant names), and SpaceListPage (duplicate) all
  make direct `getDocs`/`getDoc`/`setDoc` calls to Firestore. Other pages use
  `@levelup/shared-hooks` consistently.
- **Recommendation:** Migrate all Firestore calls to shared hooks. This ensures
  consistent caching (React Query), error handling, loading states, and makes
  the code easier to test. Create hooks like `useSpaceAnalytics`,
  `useAgentConfigs`, `useVersionHistory`.

---

### 12. Accessibility

#### 12.1 Good Foundations Present

- **Description:** The app has several accessibility features already in place.
- **Severity:** N/A (positive finding)
- **Current behavior:** `SkipToContent` link, `RouteAnnouncer` for page
  navigation, keyboard shortcuts in GradingReviewPage, proper ARIA labels on
  many components, `#main-content` landmark.
- **Recommendation:** Continue this pattern. Audit remaining interactive
  elements for keyboard accessibility, ensure all images have alt text (some use
  `alt=""`), and test with screen readers.

#### 12.2 Drag-and-Drop Not Keyboard Accessible

- **Description:** The dnd-kit drag-and-drop in SpaceEditorPage may not be fully
  keyboard accessible.
- **Severity:** Medium
- **Current behavior:** While dnd-kit supports keyboard interaction, the current
  implementation doesn't appear to include keyboard-specific activation
  (Enter/Space to grab, arrows to move, Enter to drop) or ARIA live
  announcements for drag state.
- **Recommendation:** Enable dnd-kit's keyboard sensor with proper
  announcements. Add ARIA live region updates: "Grabbed [item]. Use arrow keys
  to move. Press Enter to drop."

---

## Quick Wins vs. Long-Term Improvements

### Quick Wins (1-2 days each)

| #   | Fix                                                                      | Files Affected        | Effort |
| --- | ------------------------------------------------------------------------ | --------------------- | ------ |
| 1   | Replace RequireAuth "Loading..." with branded spinner                    | `RequireAuth.tsx`     | 30 min |
| 2   | Add logout + dashboard link to RequireAuth access-denied state           | `RequireAuth.tsx`     | 30 min |
| 3   | Fix `window.location.href` to use React Router in DashboardPage          | `DashboardPage.tsx`   | 15 min |
| 4   | Make StudentsPage rows clickable → link to student report                | `StudentsPage.tsx`    | 1 hr   |
| 5   | Make dashboard stat cards clickable links                                | `DashboardPage.tsx`   | 30 min |
| 6   | Make at-risk students clickable → link to student report                 | `DashboardPage.tsx`   | 30 min |
| 7   | Add name field to space creation dialog                                  | `SpaceListPage.tsx`   | 30 min |
| 8   | Add confirmation dialog before publishing exam                           | `ExamDetailPage.tsx`  | 30 min |
| 9   | Make student name required on submission upload                          | `SubmissionsPage.tsx` | 30 min |
| 10  | Add action buttons to empty states (ExamList, BatchGrading, Assignments) | 3 pages               | 1 hr   |
| 11  | Add beforeunload warning to SpaceEditorPage                              | `SpaceEditorPage.tsx` | 30 min |
| 12  | Add keyboard shortcut help to SpaceEditorPage                            | `SpaceEditorPage.tsx` | 1 hr   |
| 13  | Add "Forgot password?" link to LoginPage                                 | `LoginPage.tsx`       | 1 hr   |

### Medium-Term (3-5 days each)

| #   | Improvement                                                                      | Scope                                 |
| --- | -------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | Replace comma-separated class IDs with searchable multi-select in ExamCreatePage | ExamCreatePage + new component        |
| 2   | Add autosave to SpaceEditorPage with save status indicator                       | SpaceEditorPage + custom hook         |
| 3   | Add sortable columns and filters to StudentsPage table                           | StudentsPage + shared table component |
| 4   | Standardize loading states with reusable skeleton components                     | All pages                             |
| 5   | Add student CRUD operations to StudentsPage                                      | StudentsPage + hooks                  |
| 6   | Add bulk upload for answer sheets                                                | SubmissionsPage + upload component    |
| 7   | Improve drag-and-drop visual feedback and keyboard accessibility                 | SpaceEditorPage                       |
| 8   | Standardize form validation with react-hook-form + zod                           | All forms                             |
| 9   | Add CSV/PDF export to Students, Exams, and Analytics pages                       | Multiple pages                        |
| 10  | Add server-side pagination to BatchGradingPage and student-heavy pages           | Multiple pages + Firestore queries    |

### Long-Term (1-2 weeks each)

| #   | Improvement                                                                 | Scope                             |
| --- | --------------------------------------------------------------------------- | --------------------------------- |
| 1   | Decompose SpaceEditorPage into sub-components with state machine            | SpaceEditorPage → 5+ components   |
| 2   | Decompose GradingReviewPage into sub-components                             | GradingReviewPage → 4+ components |
| 3   | Migrate all direct Firestore calls to shared hooks                          | ~6 pages/components               |
| 4   | Build unified analytics dashboard with cross-linked insights                | 4 analytics pages → unified view  |
| 5   | Redesign navigation IA — collapsible groups, progressive disclosure         | AppLayout + all routes            |
| 6   | Implement comprehensive bulk operations (move, copy, grade override)        | SpaceEditor, GradingReview        |
| 7   | Add full mobile optimization for complex pages (SpaceEditor, GradingReview) | Responsive redesign               |
| 8   | Add real-time collaboration indicators for spaces (who's editing)           | New feature across editor         |

---

## Summary Metrics

| Category                 | Count |
| ------------------------ | ----- |
| Critical issues          | 2     |
| High severity            | 7     |
| Medium severity          | 16    |
| Low severity             | 8     |
| Positive findings        | 1     |
| Quick wins identified    | 13    |
| Medium-term improvements | 10    |
| Long-term improvements   | 8     |
| Total findings           | 34    |

---

## Appendix: File Inventory

All 41 files in `apps/teacher-web/src/` were reviewed:

**Core (5 files):** App.tsx, main.tsx, index.css, lib/utils.ts, vite-env.d.ts
**Layouts (2):** AppLayout.tsx, AuthLayout.tsx **Guards (1):** RequireAuth.tsx
**Pages (24):** LoginPage, DashboardPage, ClassDetailPage, SpaceListPage,
SpaceEditorPage, QuestionBankPage, ExamListPage, ExamCreatePage, ExamDetailPage,
SubmissionsPage, GradingReviewPage, StudentsPage, BatchGradingPage,
AssignmentTrackerPage, SettingsPage, NotificationsPage, ClassAnalyticsPage,
ExamAnalyticsPage, SpaceAnalyticsPage, StudentReportPage,
ClassTestAnalyticsPage, RubricPresetsPage, TestPreviewPage, NotFoundPage
**Components (9):** ConfirmDialog, RubricEditor, AgentConfigPanel, ItemEditor,
StoryPointEditor, QuestionBankImportDialog, SpaceSettingsPanel,
QuestionBankEditor, RubricPresetPicker
