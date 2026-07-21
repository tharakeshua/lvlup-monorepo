# Teacher-web Design Surface Audit

**Scope:** teacher-web (`apps/teacher-web`) vs. Lyceum design system
prototypes  
**Screened:** 53 surfaces — 17 teacher/, 16 exams/, 20 spaces/
(content-authoring subset)  
**Result: 10 missing · 32 partial · 11 implemented**

---

## Missing (10)

These surfaces have **no equivalent route or page** in teacher-web.

### Teacher

| Screen                    | Reason                                                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `announcements-compose`   | No `/announcements` route or `AnnouncementsPage`. Design shows compose/list/schedule/pin announcements.                                                                                                                    |
| `assign-content-to-class` | No `/assign` route or `AssignContentPage`. Design shows multi-step wizard to route spaces/exams to classes. `AssignmentTrackerPage` is read-only tracking, not creation.                                                   |
| `at-risk-students`        | No page or route. Design shows an intervention triage worklist sorted by severity with bulk action bar.                                                                                                                    |
| `teacher-settings`        | `SettingsPage` has only an Evaluation Settings tab (4 toggles + strictness). Design specifies a tabbed layout: Profile, Appearance, Notifications, and Evaluation — with slider controls, AI budget quota, and mute-until. |

### Exams

| Screen                        | Reason                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pipeline-deadletter-monitor` | No page or route. Design is an ops/admin tool for dead-letter queue monitoring with retry/manual-grade/dismiss actions.                                              |
| `results-release`             | No dedicated page. `ExamDetailPage` has a Release Results button but no pre-release checklist, auto-release toggle, or per-student release state table.              |
| `subquestion-rubric`          | No interactive rubric editor for individual questions. `GradingReviewPage` shows rubric read-only; `RubricPresetsPage` manages presets but not per-question editing. |

### Spaces

| Screen                  | Reason                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `answer-key-management` | Design shows a dedicated answer-key editor sheet with server-protection lock UI, status pills, re-merge error handling, MCQ option editing, and multi-state save feedback. `ItemEditor` has only minimal stripping warnings. |
| `item-type-picker`      | Design specifies a modal catalog of 15 question types + 7 materials with search, category tabs, and grading badges. `SpaceEditorPage` has add-item buttons that go directly to `ItemEditor` — no visual picker exists.       |
| `space-detail-overview` | Design shows a read-only overview page with KPI stats, story-point track visualization, and metadata sidebar. Only `SpaceEditorPage` (write) and `SpaceListPage` (list) exist — no dedicated read-only detail view.          |

---

## Partial (32)

These surfaces have a matching route/page but are missing significant sections
or functionality from the spec.

### Teacher

| Screen                     | File                               | Gaps                                                                                                                                                                                                                                                                                            |
| -------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assignment-tracker`       | `pages/AssignmentTrackerPage.tsx`  | Design shows student×content completion matrix with filters, cell popovers, and export. Implementation shows status-summary cards grouped by exam — no grid/matrix, no filtering, no export.                                                                                                    |
| `class-analytics-insights` | `pages/ClassAnalyticsPage.tsx`     | 4-KPI header and class picker implemented; missing score distribution histogram, performance-over-time trend chart, topic strengths/weaknesses, top/bottom performers lists, at-risk section, and insight cards.                                                                                |
| `class-detail-roster`      | `pages/ClassDetailPage.tsx`        | Roster tab, enroll/edit modals, breadcrumb, and multi-tab layout implemented. Diverges: "Spaces"/"Exams" are separate tabs (not grouped under "Assigned content"); "Overview" replaces "Snapshot" with different layout; analytics tab is simplified.                                           |
| `class-test-analytics`     | `pages/ClassTestAnalyticsPage.tsx` | Core KPI cards and question table implemented; missing time-usage chart with time bands, retakes/completion segmented bar, generate report button, and state variants.                                                                                                                          |
| `classes-overview`         | `pages/ClassesPage.tsx`            | Basic list with search, create, edit, archive. Missing: session/status/teacher filter dropdowns, active filter chips, Spaces/Exams/Avg-performance/At-risk/Assigned-teachers columns, sortable headers, pagination.                                                                             |
| `teacher/exam-analytics`   | `pages/ExamAnalyticsPage.tsx`      | Core KPI cards, exam picker, per-question table, score chart implemented. Missing: grade distribution bands, question difficulty progression chart, per-class breakdown table, loading/empty/error state variants.                                                                              |
| `teacher/exams-overview`   | `pages/exams/ExamListPage.tsx`     | Search and status filter tabs implemented. Missing: class filter, full table layout (currently simplified cards), submissions progress bar, awaiting-review count, results-state column, row action menu, pagination.                                                                           |
| `notifications`            | `pages/NotificationsPage.tsx`      | Read filter (all/unread), mark-read, basic notification display implemented. Missing: type filter dropdown, date-based grouping (Today/Yesterday/Earlier), status-specific icon chips, colored dot indicators, new-arrival refresh pill.                                                        |
| `space-analytics`          | `pages/SpaceAnalyticsPage.tsx`     | Space selector, KPI grid, completion overview, engagement stats, per-student table, error/empty states implemented. Missing: class filter, completion funnel (per-story-point breakdown), per-class completion bars, export report button.                                                      |
| `student-detail-progress`  | `pages/StudentReportPage.tsx`      | Identity header, score KPIs, at-risk alert, performance overview, subject performance, strengths/weaknesses, recent exams implemented. Missing: tabbed interface (Overview/AutoGrade/LevelUp/Insights), rubric breakdowns in exam details, space blocks with story-point tracks, insight cards. |
| `students-directory`       | `pages/StudentsPage.tsx`           | Page header, search, basic table (name/roll/admission/grade/section/status), edit/archive actions. Missing: filter dropdowns (class/status/at-risk/sort), bulk selection bar with message/export actions, score/at-risk/last-active/classes columns, pagination.                                |
| `teacher-dashboard`        | `pages/DashboardPage.tsx`          | Core layout and data exist but significantly different composition. Design: attention feed, notifications card, AI usage card, my-classes grid. Implementation: stats cards, class performance chart, at-risk alerts, recent spaces/exams, class heatmap.                                       |
| `tenant-switcher`          | `layouts/AppLayout.tsx`            | `RoleSwitcher` component wired and functional. Design positions it in topbar headerRight with a popover, multi-state handling (loading/switching/error), and Cmd-K integration. Implementation places it in sidebar footer without those state variants.                                        |

### Exams

| Screen                   | File                                | Gaps                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evaluation-settings`    | `pages/SettingsPage.tsx`            | Basic tenant settings implemented (auto-grade, override reason, auto-release, strictness toggles). Missing: multi-profile system, dimensions editor with priorities/weights/scoring scales, confidence routing band with dual-threshold UI, AI usage meter.                                                                             |
| `exam-analytics-results` | `pages/ExamAnalyticsPage.tsx`       | Core KPIs, score/grade distribution, per-question table implemented. Missing: expandable row details, insight callouts, class breakdown table, exam header/tabs, export menu, visual histogram style.                                                                                                                                   |
| `exam-create-setup`      | `pages/exams/ExamCreatePage.tsx`    | Step 1 setup form (title, subject, topics, marks, duration, classes, linked space) implemented. Missing: autosave chip, topic chip input (plain text field instead), academic session field, section multiselect, post-publish field locking, form card structure, sticky footer nav, discard confirmation.                             |
| `exam-detail-overview`   | `pages/exams/ExamDetailPage.tsx`    | Header, KPI strip, 3 tabs (Questions/Submissions/Settings), status badge implemented. Missing: lifecycle stepper visualization (draft→extracted→published→grading→completed→released). Submissions tab shows only first 10, not full design table.                                                                                      |
| `exam-questions-editor`  | `pages/exams/ExamDetailPage.tsx`    | Embedded as Questions tab: question list, mark/confidence/rubric display, inline text edit, rubric edit button, re-extract button. Missing: dedicated full-page editor, draggable reordering, live markdown preview split-pane, sub-questions accordion, question type selector, source scan thumbnail, flagged card styling.           |
| `exam-settings`          | `pages/exams/ExamDetailPage.tsx`    | Settings tab exists but shows READ-ONLY grading config display + class management + space link. Missing: editable toggles for all 5 grading behaviors, evaluation profile selector with confidence bar, remediation space/story-point combobox, exam details fields (title/subject/date/topics/duration), danger zone (archive/delete). |
| `exams-list`             | `pages/exams/ExamListPage.tsx`      | Search and status tab filtering implemented. Missing: full table layout with sortable headers (currently simplified card list), subject/class filter dropdowns, submissions progress bars, classes column with chips, row actions (Review button, kebab menu), pagination footer.                                                       |
| `grading-review`         | `pages/exams/GradingReviewPage.tsx` | Per-question review, keyboard shortcuts (j/k/a/o), bulk approve, override audit trail, keyboard help (?) implemented. Missing: two-pane split (answer sheet visualization + zoom/page-nav on left, review pane on right), resizable divider, answer sheet image rendering, auto-approved questions accordion.                           |
| `manual-override`        | `pages/exams/GradingReviewPage.tsx` | Override form with score input, reason textarea, and audit timeline exists. Missing: slider control, sticky right-sidebar popover layout, original vs new score comparison grid, modal alert for lowering grades.                                                                                                                       |
| `submission-detail`      | `pages/exams/GradingReviewPage.tsx` | Teacher grading review (per-question details, AI evaluation, confidence, overrides) is partially related, but this screen is NOT the student-facing dual-mode result summary the design specifies. Missing: student-sanitized results variant, release status panel, AnswerKeyLock gates, result-summary header card.                   |

### Spaces

| Screen                    | File                                             | Gaps                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-version-history` | `pages/spaces/SpaceEditorPage.tsx` (History tab) | Timeline display with change-type badges and basic metadata implemented. Missing: scope filter (space/story-point/item), change-type filter, snapshot drawer with view/restore/branch actions, entity-specific deep-linking.                                                                                                       |
| `question-bank`           | `pages/spaces/QuestionBankPage.tsx`              | Search, filters, add/edit/delete, preview dialog implemented. Missing: table layout (currently card-based), Updated/Avg-Score columns, sort by usage/avg, role-switcher toggle (Teacher/Admin), topics display in list, pagination.                                                                                                |
| `question-bank-import`    | `components/spaces/QuestionBankImportDialog.tsx` | Import modal with basic selection and import wired. Missing: 4 filter dropdowns (Type/Difficulty/Bloom's/Subject), dedicated preview pane, 50-question cap UI feedback, empty-bank / load-error states, partial import error handling.                                                                                             |
| `rubric-editor`           | `components/spaces/RubricEditor.tsx`             | All 4 scoring modes, criteria/dimensions editing, passing percentage implemented. Missing: inheritance chain visualization with scope nodes (tenant→space→story-point→item), live preview rail with weighted scoring breakdown, "Reset to inherited" flow, mode-switching confirmation dialogs.                                    |
| `rubric-presets`          | `pages/RubricPresetsPage.tsx`                    | CRUD operations, category filtering, create/edit sheet implemented. Missing: full row menu (preview/apply/clone/duplicate/edit/delete), detailed scoring mode and usage count in list, "Apply (clone)" action, question-type applicability toggles, system defaults visually locked/read-only. Uses card-grid instead of table.    |
| `space-editor-shell`      | `pages/spaces/SpaceEditorPage.tsx`               | Tabbed authoring shell (Settings/Content/Rubric/Agents/History), header with status badge and type chip, action buttons (Preview, Publish/Unpublish/Archive/Restore), item editor sheet, confirm dialogs implemented. Missing: autosave indicator (no visual save-state feedback), inline title editing.                           |
| `space-review-publish`    | `components/spaces/PublishReadinessDialog.tsx`   | Publish checklist with progress bar, status messaging, and Fix buttons implemented. Missing: lifecycle stepper (Draft→Published→Archived), side effects section (student notification counts, class assignments), store mirror section (price/description/thumbnail), lifecycle timeline, right-drawer layout (currently a modal). |
| `spaces-library`          | `pages/spaces/SpaceListPage.tsx`                 | Grid view with search, status filtering, space cards with title/description/type/stats implemented. Missing: full action menu (overflow with edit/publish/archive/restore), table view toggle, type/access filter dropdowns, sort selector.                                                                                        |
| `storypoint-editor`       | `components/spaces/StoryPointEditor.tsx`         | Title, description, type, difficulty, estimated time, assessment settings, draggable sections implemented. Missing: 4-detent difficulty slider (uses dropdown instead), item samples displayed inline within section rows, default rubric override popover, right-drawer layout (uses Sheet modal).                                |

---

## Implemented (11)

These surfaces have functional coverage matching the design intent.

### Exams

| Screen                      | File                              | Notes                                                                                                                                                                                              |
| --------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `answer-sheet-upload`       | `pages/exams/SubmissionsPage.tsx` | Full upload workflow: class/student selection, drag-drop file queue, error handling, replace confirmation.                                                                                         |
| `question-paper-upload`     | `pages/exams/ExamCreatePage.tsx`  | Full 4-step wizard: metadata → upload (drag-drop + progress) → review (extracted questions with confidence badges) → publish. Uses `useUploadImage` (question-paper kind) + `useExtractQuestions`. |
| `submissions-grading-queue` | `pages/exams/SubmissionsPage.tsx` | Live queue with pipeline statuses, KPI counts (Total/Graded/Needs Review/Failed/Released), filtering, search, bulk release via `releaseResults` callable, progress tracking.                       |

### Spaces

| Screen                    | File                                                                     | Notes                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-config`            | `components/spaces/AgentConfigPanel.tsx`                                 | 510-line component with agent CRUD, model policy selector, system prompts, language support, objectives editor, live preview chat, safety posture, role-based agent types. Integrated into Space Editor Agents tab.               |
| `ai-content-generation`   | `components/spaces/GenerateContentPanel.tsx`                             | 619-line component with 2-phase wizard (configure + review), topic/PDF/follow-up sources, question-type chip toggles, Bloom's distribution sliders, cost preview, streaming draft review cards (accept/discard/edit/regenerate).  |
| `assessment-config`       | `components/spaces/StoryPointEditor.tsx`                                 | Comprehensive assessment settings: timing (duration + instructions), question order (sequential/shuffle/adaptive), attempts & retries policy, scoring threshold slider, availability window, retry rules.                         |
| `item-editor`             | `components/spaces/ItemEditor.tsx`                                       | Per-type editors (MCQ/text/code/etc.), answer-key lock warning, field validation, classification section (difficulty/section/Bloom's/topics/labels), attachments, autosave with save-status chip, unsaved-change confirm dialogs. |
| `item-preview`            | `pages/TestPreviewPage.tsx`                                              | Student-mode preview with timer, question navigation, section badges, answer-key toggle (staff-only), all question type rendering, mark-for-review flags, previous/next navigation.                                               |
| `space-content-structure` | `pages/spaces/SpaceEditorPage.tsx` (Content tab)                         | Sortable story points, expandable sections with grouped items, section headers with add buttons (Question/Material), bulk selection bar, import-from-question-bank dialog, item preview expansion with answer-key protection.     |
| `space-create`            | `components/spaces/SpaceCreationDialog.tsx`                              | Two-step wizard (template → details), title/type/subject/description/access-type fields, class/teacher entity pickers, labels input, session selector, validation, discard guard, success toast.                                  |
| `space-editor-settings`   | `pages/spaces/SpaceEditorPage.tsx` (Settings tab → `SpaceSettingsPanel`) | Core (title/slug/description/thumbnail), Classification (type/subject/labels), Assignment (classes/sections/teachers), AI defaults, Assessment defaults, sticky save bar.                                                         |

---

## Coverage Summary

| Category           | Screens | Missing | Partial | Implemented |
| ------------------ | ------- | ------- | ------- | ----------- |
| Teacher            | 17      | 4       | 13      | 0           |
| Exams              | 16      | 3       | 10      | 3           |
| Spaces (authoring) | 20      | 3       | 9       | 8           |
| **Total**          | **53**  | **10**  | **32**  | **11**      |

**Highest-priority missing surfaces:** `results-release`, `at-risk-students`,
`subquestion-rubric`, `item-type-picker`, `answer-key-management`  
**Largest partial gaps:** `grading-review` (no answer-sheet viewer),
`teacher-settings` (only eval tab), `exam-settings` (read-only),
`evaluation-settings` (no dimensions editor), `class-analytics-insights` (2
cards vs full analytics)
