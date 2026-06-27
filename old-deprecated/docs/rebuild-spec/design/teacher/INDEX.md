# Teacher Portal — Design Spec Index ("Lyceum")

> The **TEACHER operational portal** design set for Auto-LevelUp: the surfaces a
> `teacher` or `tenantAdmin` uses to **run their classes** day to day — class
> ops and rosters, content assignment, learner monitoring, and read-only
> analytics/insights. These are _operational_ surfaces: they survey state,
> triage attention, and deep-link out to where work actually happens.
>
> Two adjacent jobs live in **separate spec sets** and are linked, not
> duplicated, here:
>
> - **Authoring** (building spaces, story points, and content items) lives in
>   the **SPACES** area.
> - **Grading** (submission review, rubric breakdowns, confidence routing,
>   manual override, results release) lives in the **EXAMS** area.
>
> Everything in this folder conforms to
> [`design/00-FOUNDATION.md`](../00-FOUNDATION.md) ("Lyceum / Modern
> Scholarly"). Tokens, type, spacing, radius, elevation, motion, and components
> are cited by their FOUNDATION semantic names — no new tokens or variants. Per
> FOUNDATION §1, staff surfaces read **credible and focused**: restraint in
> chrome, no gamification celebration except where a teacher views a student's
> read-only state.

---

## Screens (17) by navigation section

Grouped per FOUNDATION §3 nav groups (Overview · People · Analytics · System),
with a **Content / Assignment** band broken out from People for the two
content-routing surfaces. Routes, roles, and APIs are taken verbatim from each
spec's header line.

### Overview

| Screen                                    | Route | Roles                                         | One-line purpose                                                                                                                         | Primary APIs                                                                                                                |
| ----------------------------------------- | ----- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [Teacher Dashboard](teacher-dashboard.md) | `/`   | `teacher` (own classes) · `tenantAdmin` (all) | Operational landing/triage surface — "what needs my attention today across my classes"; surveys and deep-links, never authors or grades. | `analytics.getSummary` (scope `class`) · `analytics.dailyCost` (admin) · `classes.list` · `exams.list` · notifications repo |

### People

| Screen                                                  | Route                         | Roles                                   | One-line purpose                                                                                                                          | Primary APIs                                                                                                                                                                                          |
| ------------------------------------------------------- | ----------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Classes Overview](classes-overview.md)                 | `/classes`                    | `teacher` · `tenantAdmin`               | Operational index of classes — find a class, read its headline health, create/edit; the launch pad into a single class.                   | `classes.list` · `teachers.list` · `analytics.getSummary` (scope `class`) → `v1.identity.saveClass`                                                                                                   |
| [Class Detail / Roster](class-detail-roster.md)         | `/classes/:classId`           | `teacher` (managed) · `tenantAdmin`     | A single class's detail and roster — teachers, enrolled students, assigned spaces/exams, headline performance; light enroll/remove admin. | `classes.get` · `teachers.list` · `students.list` · `spaces.list`+`exams.list` · `analytics.getSummary` → `v1.identity.saveClass`, `v1.identity.saveStudent`                                          |
| [Students Directory](students-directory.md)             | `/students`                   | `teacher` · `tenantAdmin`               | Cross-class searchable/filterable register of every visible student — locate anyone fast, jump to report, light roster admin in-table.    | `students.list` · `classes.list` · `analytics.getSummary` (scope `student`) → `v1.identity.saveStudent`, `v1.analytics.generateReport`, message callable                                              |
| [Student Detail / Progress](student-detail-progress.md) | `/students/:studentId/report` | `teacher` (own classes) · `tenantAdmin` | Per-student read-only report — score, submissions, released question detail, space/story-point progress, and insights, exportable to PDF. | `analytics.getSummary` (scope `student`) · `students.get` · `submissions.list`+`exams.get` · `questionSubmissions.list` · `progress.*` · `insights.list` → `v1.analytics.generateReport` (`progress`) |

### Content / Assignment

| Screen                                                | Route                                                             | Roles                               | One-line purpose                                                                                                                                            | Primary APIs                                                                                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Assign Content to Class](assign-content-to-class.md) | `/assign` (+ Drawer overlay from `/classes`, `/classes/:classId`) | `teacher` · `tenantAdmin`           | Route an existing space or exam to one or more classes — the one write surface that bridges authored content to a roster (authoring stays in SPACES/EXAMS). | reads `spaces.list`, `exams.list`, `classes.list` → `v1.levelup.assignContent` (proposed; falls back to `saveSpace`/`saveExam`)                          |
| [Assignment Tracker](assignment-tracker.md)           | `/assignments`                                                    | `teacher` (managed) · `tenantAdmin` | Read-only completion matrix — assigned content × class/student progress and submission state; drills out to a learner report or grading.                    | `analytics.getSummary` (scope `class`) · `progress.*` · `submissions.list` · `spaces.list`+`exams.list` · `classes.list`/`students.list` — **no writes** |

### Analytics

| Screen                                                    | Route                                          | Roles                                      | One-line purpose                                                                                                                                                               | Primary APIs                                                                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Class Analytics & Insights](class-analytics-insights.md) | `/analytics/classes` (`?classId=`)             | `teacher` (own) · `tenantAdmin` (all)      | Read-only single-class analysis console — KPIs, score distribution, trend, top/bottom performers, per-topic strengths, at-risk teaser, insight cards, PDF export.              | `analytics.getSummary` (scope `class`) · `analytics.getPerformanceTrends` · `classes.list` → `analytics.generateReport` (`class`)                                              |
| [Exam Analytics](exam-analytics.md)                       | `/analytics/exams`                             | `teacher` (own) · `tenantAdmin` (all)      | Post-exam analysis of a **released** exam — avg/median/pass-rate, score histogram, A–F grade spread, per-question difficulty, per-class breakdown; never grades or shows keys. | `exams.list`/`exams.get` · `analytics.*` (`examAnalytics/{examId}`) → `v1.analytics.generateReport` (`exam-result`)                                                            |
| [Space Analytics](space-analytics.md)                     | `/analytics/spaces` (`?spaceId=`, `?classId=`) | `teacher` (assigned) · `tenantAdmin` (all) | Read-only learning-space performance — engagement/completion KPIs, story-point funnel, mastery distribution, per-class/student completion, time-on-task, item difficulty.      | `spaces.list`/`spaces.get` · `analytics.getSummary` · `progress.getSpaceProgress` · `storyPoints.list` → `analytics.generateReport` (`progress`)                               |
| [Class Test Analytics](class-test-analytics.md)           | `/analytics/tests`                             | `teacher` (own) · `tenantAdmin` (all)      | Class-level analysis of **in-space timed tests/quizzes** (distinct from formal exams) — attempts, score/time distributions, question breakdown, retake patterns.               | `classes.list` · `spaces.list`/`storyPoints.list` (test/quiz) · `testSessions.*` aggregates · `analytics.getSummary` (scope `class`) → `v1.analytics.generateReport` (`class`) |
| [At-Risk Students](at-risk-students.md)                   | `/analytics/at-risk` (`?classId=`, `?reason=`) | `teacher` (managed) · `tenantAdmin` (all)  | Intervention-triage worklist of nightly-flagged at-risk students — sort by severity, filter by class/reason, deep-link to report, bulk message/follow-up/export.               | `analytics.getSummary` (scope `class` → at-risk roster) · `students.list` → `analytics.generateReport` (`progress`), `identity.manageNotifications` / message                  |

### System / Shell

| Screen                                              | Route                                                          | Roles                                                 | One-line purpose                                                                                                                                                           | Primary APIs                                                                                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Exams Overview](exams-overview.md)                 | `/exams`                                                       | `teacher` · `tenantAdmin`                             | Operational monitoring list of exams across classes — status, submission progress, awaiting-review backlog, release state; deep-links into EXAMS grading/detail.           | `exams.list` · `submissions` counts / denormalized `ExamStats` · `analytics.getSummary` (scope `class`) → `v1.autograde.saveExam` (release results)                                 |
| [Announcements — Compose](announcements-compose.md) | `/announcements`                                               | `teacher` (managed) · `tenantAdmin` (all)             | Compose/list staff announcements to class or tenant audiences — draft/publish/archive/soft-delete; no platform-scope (that is super-admin).                                | read `listAnnouncements` (`v1.identity.listAnnouncements`) · write `v1.identity.saveAnnouncement` · audiences via `classes.list`/`useTenantNames`                                   |
| [Notifications](notifications.md)                   | `/notifications`                                               | `teacher` (own feed) · `tenantAdmin` (own feed)       | Recipient-scoped reverse-chron notification feed (at-risk, grading, releases, budget, system) with read state and source deep-links; full-page sibling of the topbar bell. | `notifications` repo (`identity.manageNotifications` `list`, Firestore + RTDB unread mirror) → `manageNotifications` `markRead`; optional `notificationPreferences.*`               |
| [Teacher Settings](teacher-settings.md)             | `/settings`                                                    | `teacher` (personal) · `tenantAdmin` (+ Evaluation)   | Personal preferences (profile/display, theme, notification prefs) plus admin-only Evaluation settings; edits prefs only — every write via callable.                        | `identity.manageNotifications` (read) → `saveNotificationPreferences` (NEW) · `evaluationSettings.get` → `v1.autograde.saveEvaluationSettings` (NEW) · `users.get` → profile upsert |
| [Tenant Switcher](tenant-switcher.md)               | none — `headerRight` control in `PlatformLayout` Topbar (+ ⌘K) | any caller with ≥1 `teacher`/`tenantAdmin` membership | Topbar/command-palette control to switch the active tenant for multi-membership staff; single-membership users see a static label.                                         | read `useMemberships()` + `useTenantNames(ids)` (NEW) → `v1.identity.switchActiveTenant` then `getIdToken(true)`                                                                    |

---

## Shared patterns

Cross-screen conventions every spec in this set honors (so they read as one
portal, not 17 one-offs):

- **Shell & nav.** Every screen renders inside `PlatformLayout` / `AppShell`
  (sidebar + topbar). Sidebar entries, grouping (Overview / People / Analytics /
  System), and active state are **driven by the route manifest** — never
  hand-wired per screen. The Topbar carries the **Tenant Switcher**, search, the
  notification bell, and profile.
- **Reads via repositories, writes via callables.** All reads go through
  `@levelup/api-client` repositories (`classes.*`, `students.*`, `spaces.*`,
  `exams.*`, `analytics.*`, `progress.*`, `submissions.*`, notifications). All
  mutations go through versioned callables (`v1.identity.*`, `v1.autograde.*`,
  `v1.levelup.*`, `v1.analytics.*`). **No direct client Firestore writes**
  anywhere in this set; where a legacy `updateDoc` exists it is being replaced
  by a callable (e.g. Teacher Settings → `saveEvaluationSettings`).
- **Server-authoritative stats & risk.** KPIs, distributions, trends, mastery,
  completion, and at-risk flags are **precomputed server-side**
  (`analytics.getSummary`, `examAnalytics/{examId}`, the nightly at-risk rule
  engine, RTDB unread mirror). Screens **read and present**; they never compute,
  re-score, or recompute a statistic on the client.
- **Tone.** Precise, credible staff voice — operational and quantitative. No
  student-facing gamification celebration except inside read-only views of a
  student's own state.
- **Tenant isolation & role gating.** Every query is scoped to the active
  tenant; `teacher` sees only managed classes/students, `tenantAdmin` sees all
  in-tenant. Role-gated sections (e.g. Evaluation settings, AI-cost KPIs) are
  permission-checked, not merely hidden.
- **One ContentRenderer.** All Markdown + math (question text, rubric notes,
  announcement bodies, released answers) renders through the single FOUNDATION
  `ContentRenderer` (Markdown + KaTeX) — never an ad-hoc renderer.
- **Shared data & forms.** Tabular surfaces use the shared `DataTable`
  (sort/filter/paginate/select); editing/compose surfaces use the shared Form
  primitives with `FormFieldError`. Status is always icon + label, never color
  alone.
- **Lyceum tokens only.** Color, type, spacing, radius, elevation, and motion
  compose from FOUNDATION §2–§4 semantic tokens; domain visuals (`AtRiskBadge`,
  `InsightCard`, `GradePill`, `ConfidenceBadge`, `ProgressRing`, mastery scales)
  come from the §5 inventory.

---

## Coverage & boundaries

**Covered here (TEACHER operational portal):**

- Operational landing/triage (Dashboard), class index + detail/roster,
  cross-class student directory and per-student report.
- Content **routing** (Assign Content to Class) and **monitoring** (Assignment
  Tracker, Exams Overview).
- The full read-only analytics suite (Class, Exam, Space, Class-Test) plus the
  At-Risk triage worklist.
- Staff communication and shell (Announcements compose, Notifications feed,
  Settings, Tenant Switcher).

**Deferred to SPACES (authoring) — linked, not specced here:**

- Building/editing learning spaces, story-point tracks, and the 15+ content-item
  types; the live timed-test runtime. Analytics screens here _read_ space/test
  aggregates and **link out** to SPACES for any change.

**Deferred to EXAMS (grading) — linked, not specced here:**

- Exam authoring, submission review, rubric breakdown, confidence-routed human
  review, manual override, answer keys, and results release UX. Exams Overview
  and Exam/Student analytics **deep-link** into the EXAMS area; they never
  grade, re-score, or display answer keys.

**Proposed but not yet shipped (flagged inside specs):**

- `v1.levelup.assignContent` (canonical assign callable — Assign Content falls
  back to `saveSpace`/`saveExam`).
- `saveNotificationPreferences` and `v1.autograde.saveEvaluationSettings`
  callables (Teacher Settings — replacing legacy direct writes).
- `useTenantNames(ids)` hook (Tenant Switcher / announcement audience
  resolution).

**Not in this set (other portals):** platform-scope announcements and any
cross-tenant administration belong to the **super-admin** surface, not the
teacher portal.

---

## How to use these specs

1. **Read the foundation first.**
   [`design/00-FOUNDATION.md`](../00-FOUNDATION.md) is the single source of
   truth for tokens, type, components, and cross-platform rules. Every screen
   below cites it by reference rather than re-pasting tokens.
2. **Each spec follows FOUNDATION §7.** Open any screen file for its full
   structure: Purpose & primary user · Entry points & route · Layout
   (wireframe-as-text, responsive) · Components used · States · Interactions &
   motion · Content & copy · Domain rules surfaced · Accessibility · Web↔mobile
   divergence.
3. **Generate from the per-screen prompt block.** Each spec ends with a
   ready-to-paste **Claude-design prompt** (FOUNDATION §7 item 11) that
   references this foundation — drop it into Claude on web to produce the
   screen. Use it as the build-ready entry point; the rest of the spec is the
   contract it must satisfy.
