# Teacher Portal Tour — Visual Audit Report

- **App:** `apps/teacher-web` @ http://localhost:4569
- **Tenant / school code:** Subhang Academy (`SUB001`)
- **Account used:** `subhang.rocklee@gmail.com` (multi-role: tenantAdmin +
  teacher)
- **Spec:** `tests/e2e/teacher-portal-tour.spec.ts`
- **Config:** `tests/e2e/teacher-portal-tour.config.ts`
- **Run command:**
  `npx playwright test --config tests/e2e/teacher-portal-tour.config.ts --reporter=list`
- **Browser:** chromium @ 1440×900, full-page, networkidle + 1500 ms settle

## Captured (18 of 20 planned)

| #   | File                     | Route                               |
| --- | ------------------------ | ----------------------------------- |
| 01  | 01-login.png             | `/login`                            |
| 02  | 02-dashboard.png         | `/`                                 |
| 03  | 03-spaces-list.png       | `/spaces`                           |
| 04  | 04-question-bank.png     | `/question-bank`                    |
| 05  | 05-rubric-presets.png    | `/rubric-presets`                   |
| 06  | 06-exams-list.png        | `/exams`                            |
| 07  | 07-exams-new.png         | `/exams/new`                        |
| 08  | 08-analytics-classes.png | `/analytics/classes`                |
| 09  | 09-analytics-exams.png   | `/analytics/exams`                  |
| 10  | 10-analytics-spaces.png  | `/analytics/spaces`                 |
| 11  | 11-analytics-tests.png   | `/analytics/tests`                  |
| 12  | 12-assignments.png       | `/assignments`                      |
| 13  | 13-grading.png           | `/grading`                          |
| 14  | 14-students.png          | `/students`                         |
| 15  | 15-settings.png          | `/settings`                         |
| 16  | 16-notifications.png     | `/notifications`                    |
| 18  | 18-space-edit.png        | `/spaces/zRMBmxWdz2yEENbwg1Ka/edit` |
| 19  | 19-exam-detail.png       | `/exams/Z03sroJjVCIVPv1Vguuy`       |

### Skipped

- **17 `/classes/:classId`** — `/analytics/classes` is empty ("No analytics data
  yet") and exposes no anchor or row click that navigates to a class detail
  page. No discoverable classId from the UI.
- **20 `/students/:studentId/report`** — `/students` lists 6 students in a
  table, but the rows have no `onClick`, no `<Link>`, and no anchor wrapping.
  The route exists in the router but is not reachable from the UI. Per brief:
  "do not invent IDs", so skipped.

---

## Per-route findings

### 01 — `/login`

- **Title / H1:** "Teacher Portal" / "Sign in to your teaching dashboard"
- **Layout:** Centered card on a near-white background, no top nav.
- **Step 1 of 2:** School Code field (`#schoolCode`) + "Continue" button. After
  validating tenant code, step transitions to email/password.
- **Login flow:** two-step (school code → credentials) using
  `loginWithSchoolCode` from the auth store.
- **Real data:** `SUB001` resolves to "Subhang Academy"; credential step accepts
  the seeded teacher account.

### 02 — `/` (Dashboard)

- **H1:** "Teacher Dashboard" — "Welcome back, Subhang"
- **Sidebar (persistent, present on every authed page):** Overview → Dashboard;
  Content → Spaces, Question Bank, Exams, Rubric Presets, Assignments, Batch
  Grading; Analytics → Class Analytics, Exam Analytics, Space Analytics; People
  → Students; System → Settings. Footer: user avatar + Sign Out.
- **KPI cards:** Total Students = 6, Active Exams = 2, Total Spaces = 12,
  At-Risk Students = 0 ("All good").
- **Recent Spaces panel** with "View all →": shows 5 published Hybrid spaces
  with story-point counts (System Design Interview Prep V2 (HLD) — 28 SP, LLD —
  17, HLD V1 — 28, Domain-Driven Design (Eric Evans) — 34, Designing
  Data-Intensive Applications — 24).
- **Recent Exams panel:** Math (Published, 100 marks), jk
  (Question_paper_uploaded, 100 marks).
- **Real data, healthy state.**

### 03 — `/spaces` (Space list)

- **H1:** "Spaces — Manage your learning spaces and content"
- **Top bar:** Search input + tab filters (All / Draft / Published / Archived) +
  primary "+ New Space" button (top-right).
- **Card grid (3 columns):** 12+ space cards each with thumbnail (or gradient
  placeholder), title, status badge (Published / Draft), modality (Hybrid),
  counts of "story points / chapters / items", subject + labels chip row, and ⋯
  menu. One card has a "Duplicate" action visible.
- **Notable cards:** System Design Interview Prep V2 (HLD), Low-Level Design
  Interview Prep (LLD), Java Programming, Domain-Driven Design (Eric Evans),
  Designing Data-Intensive Applications, Untitled Space (Draft), DSA, Low-Level
  Design & OOP, System Design (Published & Draft), Behavioral Interview Mastery.
- **Real data; rich content seeded.**

### 04 — `/question-bank` ⚠️ ERROR

- **State:** Generic `RouteErrorBoundary` fallback ("Something went wrong" with
  red triangle + "Try Again" button).
- **Error message:** _"A `<Select.Item />` must have a value prop that is not an
  empty string. This is because the Select value can be set to an empty string
  to clear the selection and show the placeholder."_
- **Root cause:** Radix Select used somewhere in `QuestionBankPage` is being
  passed `value=""`. This matches the project memory note "Radix Select: never
  use empty string as value prop".
- **Impact:** Question Bank route is fully broken for this account / tenant —
  page never renders. **P0 / regression.**

### 05 — `/rubric-presets`

- **Breadcrumb / H1:** "Rubric Presets — Evaluation Presets / Reusable rubric
  templates for consistent grading"
- **Controls:** Category filter dropdown (default "All"), primary "+ New Preset"
  button (top-right).
- **State:** Empty illustration ("No presets yet. Create one to get started.").

### 06 — `/exams` (Exam list)

- **H1:** "Exams — Create and manage exams, grade submissions"
- **Filters:** Search bar + status pill tabs (All / Draft / Published / Grading
  / Completed / Archived). "+ New Exam" button.
- **List (2 items):** "Math" (Published — 100 marks · 60 min · All) with 0
  submissions / 0 graded / 0% avg score; "jk" (Question Paper Uploaded — 100
  marks · 60 min · jk) similar zero metrics.
- **Real data, no submissions yet.**

### 07 — `/exams/new` (Create exam)

- **H1:** "Create Exam" with a 4-step wizard header: 1 Exam Details · 2 Upload
  Question Paper · 3 Review · 4 Publish.
- **Step 1 form:** Exam Title, Subject (default "Mathematics"), Topics
  (comma-separated), Total Marks (100), Passing Marks (40), Duration min (60),
  Class IDs (comma-separated, e.g. `class_10a, class_10b`), Link to Space
  (optional Select, default "None").
- **Action:** "Next →" button.

### 08 — `/analytics/classes`

- **H1:** "Class Analytics — Cross-system performance overview per class"
- **Top-right:** numeric Select (default value "10").
- **State:** "No analytics data yet. Data will appear after exams are graded and
  spaces are used." Empty.

### 09 — `/analytics/exams`

- **H1:** "Exam Analytics — Per-exam grade distribution and question analysis"
- **Top-right:** Select displays "No graded exams" — disabled selector.
- **State:** Empty illustration "No graded exams yet. Analytics appear after
  exam results are released."

### 10 — `/analytics/spaces`

- **H1:** "Space Analytics — Completion rates and engagement metrics per space"
- **Top-right:** Select scoped to a space (default first space "System Design
  Intervie...").
- **State:** Empty "No student progress data yet. Data will appear as students
  use this space."

### 11 — `/analytics/tests`

- **H1:** "Class Test Analytics — Test performance and student insights per
  class"
- **KPI cards:** Total Exams 0, Learning Spaces 0, Avg Pass Rate ‑‑, Avg Score
  ‑‑.
- **Body:** Empty "No graded exams for this class yet. Analytics appear after
  exam results are released."
- **Top-right class selector ("10"):** likely class id selector — same control
  as `/analytics/classes`.

### 12 — `/assignments`

- **H1:** "Assignment Tracker — Track exam assignments across all your classes"
- **Status tiles:** Active = 1, Pending Grading = 0, In Review = 0, Completed
  = 0.
- **Active Assignments list:** single row "Math (Active) · Math · 0 submissions"
  with chevron → drill into the assignment.
- **Real data.**

### 13 — `/grading` (Batch Grading)

- **H1:** "Batch Grading — Review and approve pending submissions"
- **Counters:** "0 pending · 0 reviewed".
- **Filters:** Status select ("All Pending"), Exam select ("All Exams").
- **State:** Empty success ("No submissions to review — All pending submissions
  have been reviewed. Great job!").

### 14 — `/students`

- **H1:** "Students — Students enrolled in your classes (6 total)"
- **Search:** name / roll number / admission number.
- **Table columns:** Name, Roll Number, Admission No., Grade, Section, Status.
- **6 rows:** Test Student (2026001, Active), Test Student (2026001, Active —
  duplicate roll number), Raghav (2026002), Kusala (2026002), Kushal (2026003),
  Vamshi (2026003). Admission No / Grade / Section all "‑".
- **Issue:** Table rows are not clickable — there is no path from this list to
  `/students/:studentId/report`. Sparse profile fields on every row.

### 15 — `/settings`

- **H1:** "Settings — Evaluation and grading configuration"
- **Card "Evaluation Settings":** Auto Grade (on), Require Override Reason (on),
  Auto-release Results (off), Default AI Strictness (Select, default
  "Moderate").
- **Footnote:** "No evaluation settings configured for this tenant yet." (i.e.
  defaults shown until first save)

### 16 — `/notifications`

- **H1:** "Notifications" with "Mark all as read" button (top-right).
- **Tabs:** All / Unread.
- **State:** Empty ("No notifications yet").

### 18 — `/spaces/:spaceId/edit` (Space Editor — System Design Interview Prep V2 (HLD))

- **Breadcrumb:** Spaces › System Design Interview Prep V2 (HLD)
- **Header:** Title + Published / Hybrid badges; actions: Preview, Unpublish,
  Archive.
- **Tabs:** Settings (active), Content, Rubric, Agent Config, History.
- **Settings form:** Title, Description (rich preview), Thumbnail (Upload / URL
  with drop zone), Type (Select = Hybrid), Access Type (Class Assigned), Subject
  (System Design), Labels (chip-style — system design, hld, interview prep),
  Assessment Defaults (Time Limit min, Allow Retakes toggle on, Max Retakes 3,
  Show correct answers after submission toggle on), Store Listing card with
  "Publish to Store" toggle. Primary "Save Settings" button.

### 19 — `/exams/:examId` (Exam Detail — Math Test)

- **Breadcrumb:** Exams › Math Test
- **Header:** Title + "Question Paper Extracted" badge, meta (Math · 100 marks ·
  60 min), actions: Preview, Link to Space, Submissions.
- **KPI strip:** Submissions / Graded / Avg Score / Pass Rate (all 0).
- **Tabs:** Questions (active), Submissions, Settings.
- **Yellow callout banner:** "Review the extracted questions below. Edit any
  inaccuracies, then confirm to publish." with green primary "Confirm & Publish"
  button.
- **Question list:** ~30 extracted Math questions (Q1..Q30) —
  circle/parabola/ellipse/hyperbola problems, each with marks pill, "Auto
  extracted by AI" hint, "Rubric: Criteria_based" tag, plus per-row Edit /
  Rubric actions.
- **Real data, very rich** — biggest screenshot in the set (525 KB).

---

## Summary

The teacher portal is the staff-facing console of the Auto-LevelUp platform: a
Vite/React SPA scoped to a single tenant (`tenant_subhang` / school code
`SUB001`) and protected for `teacher` and `tenantAdmin` roles. The login flow is
a two-step "school code → email/password" hand-off backed by Firebase Auth and
the `lookupTenantByCode` lookup. After auth, the app is wrapped in a
sidebar-driven `AppLayout` with five logical sections — Overview, Content,
Analytics, People, System — and a Notifications bell + light/dark toggle in the
top bar.

The portal centers on three workflows: **content authoring**, **assessment**,
and **monitoring**. Content authoring lives under Spaces (a card grid of
learning paths with rich seeded data — DSA, LLD, HLD, DDIA, Java, Behavioral)
and a Space Editor with Settings, Content, Rubric, Agent Config and History
tabs. The Question Bank and Rubric Presets are the two reusable-asset stores,
although Question Bank is currently broken behind a Radix Select error boundary.
Assessment is built around Exams, with a 4-step Create Exam wizard, an exam
detail screen that shows AI-extracted question lists awaiting confirmation, an
Assignments tracker that follows exams from Active through Pending Grading / In
Review / Completed, and a Batch Grading queue. Monitoring is split across four
analytics pages (Class, Exam, Space, Class Test) all of which are empty in this
tenant because no exams have been graded yet, plus a Students roster (6 rows)
and a Notifications inbox.

Standout features: AI-graded submissions with override-reason enforcement
(Settings card), AI strictness levels, agent-configurable spaces (per-space
`Agent Config` tab), AI-powered question paper extraction (visible on the Math
exam detail), Store-listing toggle to publish a space to a marketplace, and
tenant-scoped multi-class assignment with comma-separated class IDs in the
Create Exam form. Two friction points worth flagging: (1) the **Question Bank
route is broken (P0 regression)** with a Radix Select empty-string violation,
and (2) the **Students table has no row drill-down** to the per-student report
route, leaving `/students/:studentId/report` orphaned in the UI.
