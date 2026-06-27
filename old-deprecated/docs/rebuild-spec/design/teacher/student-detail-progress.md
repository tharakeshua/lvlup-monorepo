# Student Detail — Progress & Report

A deep, read-mostly single-student view for a teacher or tenant admin: identity,
server-authoritative overall score (60% autograde / 40% levelup),
strengths/weaknesses, at-risk status from the nightly rule engine, AutoGrade
exam history (released results only), LevelUp space/story-point progress with
mastery states, read-only gamification data, insight cards, and a one-click
signed-PDF progress report.

> **Route** `/students/:studentId/report` · **Roles** `teacher` (own classes
> only), `tenantAdmin` (all classes) · **Primary APIs** `analytics.getSummary`
> (scope `student`), `students.get`, `submissions.list` + `exams.get`,
> `questionSubmissions.list` (released projection), `progress.getSpaceProgress`
> / `progress.listStoryPointProgress`, `insights.list` → write:
> `v1.analytics.generateReport` (type `progress`)

This spec conforms to **`docs/rebuild-spec/design/00-FOUNDATION.md`** ("Lyceum /
Modern Scholarly"). All tokens, type, spacing, radius, elevation, motion, and
components are cited by their semantic names from FOUNDATION — no new tokens or
variants are introduced. This is a **staff operational surface**: precise,
credible, calm. No celebration chrome; gamification appears as read-only data
only.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` reviewing one of their students before a parent
meeting, an intervention, or a grading decision; secondarily a `tenantAdmin`
auditing any student in the tenant.

**Job to be done:** "Show me everything I'm allowed to know about this one
student's performance — across exams _and_ learning spaces — in one
authoritative place, tell me if the system has flagged them at-risk and why, let
me drill into the evidence (released exam results, story-point mastery), and let
me export a clean PDF I can share."

**Non-goals (link out, do not rebuild here):**

- Authoring spaces/items → **Spaces** area (`/spaces/:spaceId/edit`).
- Grading / rubric overrides → **Exams** area
  (`/exams/:examId/submissions/:submissionId`). This screen surfaces a
  **read-only** `RubricBreakdown` that _links_ to grading; it never mutates a
  grade.
- Editing the student record (name, roll, class) → **Student form dialog** on
  `/students`. This screen offers at most a single "Edit student" affordance
  that opens that shared dialog; it does not inline-edit.

**Authority model:** every score, strength/weakness, and at-risk flag shown here
is **computed server-side** (analytics triggers + nightly rule engine). The
client renders precomputed values and **never recomputes** score or risk. (See
§8.)

---

## 2. Entry points & route

**Route:** `/students/:studentId/report` rendered inside teacher-web's
`PlatformLayout` (AppShell: sidebar + topbar), under the **People** nav group.
Not itself a sidebar item — it is a detail route (no `navMeta`), reached from:

- **Students list** (`/students`) — row click / "View report" action.
- **Class detail** (`/classes/:classId`) — student roster row.
- **Class / exam analytics** drill-downs and **at-risk rosters** (Dashboard,
  `/analytics/classes`) — clicking an at-risk student.
- **Notifications** — an at-risk milestone notification deep-links here.
- Deep link / breadcrumb: `People › Students › {Student name}`.

**Reads (typed repositories over `@levelup/api-client`, per webapps-design §5.1
and common-api §3.3):**

- `students.get(studentId)` → identity entity (`tenants/{t}/students/{id}`).
  Tenant derived from claims server-side.
- `analytics.getSummary({ scope: 'student', studentId })` → the precomputed
  `StudentProgressSummary`: `overallScore`, `autograde` section
  (`averagePercentage`, `completedExams`, `recentExams[]`), `levelup` section
  (`averageCompletion`, `completedSpaces`, `totalSpaces`, `streakDays`,
  story-point/mastery rollups), `strengthAreas[]`, `weaknessAreas[]`,
  `isAtRisk`, `atRiskReasons[]`.
- `submissions.list({ studentId })` + `exams.get(examId)` (or batched) → exam
  history rows; **only `results_released` submissions surface released detail**
  (server projection).
- `questionSubmissions.list({ submissionId, released: true })` → per-question
  rubric breakdown for an expanded exam (released-only projection; teacher gets
  full, but **answer keys are never included**).
- `progress.getSpaceProgress` / `progress.listStoryPointProgress({ studentId })`
  → per-space completion + per-story-point mastery states for the LevelUp track.
- `insights.list({ studentId })` → active (non-dismissed) `LearningInsight`
  docs.

**Write (callable via `api.analytics.generateReport`, common-api §3.3
analytics):**

- `v1.analytics.generateReport({ type: 'progress', studentId })` →
  `{ pdfUrl, expiresAt }` (1-hour signed Storage URL at
  `tenants/{t}/reports/progress/...`). This is the **only** mutation-shaped
  action on the screen, and it produces an artifact, not a data change.

No direct Firestore reads/writes from the client (webapps-design §0.3 /
inconsistency #7, #8). All `tenantId` scoping is server-derived from claims
(common-api §4.4).

---

## 3. Layout (wireframe-as-text)

Rendered in `PlatformLayout` → `AppShell` (persistent `AppSidebar` left,
`Topbar` with tenant switcher / search / `NotificationBell` / profile). This
screen owns the **main content region** only. Page gutters and max-width follow
FOUNDATION §4 (desktop gutter `space-8` = 32; content max-width 1200). Vertical
rhythm uses `gap` on a single column flex stack (`space-6` = 24 between major
regions). `RouteAnnouncer` announces the student name on load; `Breadcrumb` sits
above the header.

```
┌─ AppShell ────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant · search · ⌘K · bell · profile)                   │
│         ├──────────────────────────────────────────────────────────────────┤
│ People  │ Breadcrumb: People › Students › Aanya Rao                         │
│  ▸ Stu… │                                                                   │
│         │ ┌─ A. IDENTITY HEADER (Card / Panel, e1) ───────────────────────┐ │
│         │ │ [Avatar] Aanya Rao            [AtRiskBadge]   [Generate report]│ │
│         │ │          Roll 24 · Grade 9 · Sec B · Class 9B  [Edit student] │ │
│         │ │          Active · enrolled 12 Jan 2026                         │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│         │                                                                   │
│         │ ┌─ B. SCORE KPI ROW (grid, 4 × Stat/KPI, e1) ──────────────────┐ │
│         │ │ [Overall 74%]  [Exam avg 81% · 6 exams]                       │ │
│         │ │ [Space compl. 62% · 5/8]  [Streak 9d]                         │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│         │                                                                   │
│         │ ┌─ C. AT-RISK PANEL (InlineAlert/Banner — only if isAtRisk) ───┐ │
│         │ │ ⚠ Flagged at-risk · reasons: Low exam average, Zero streak    │ │
│         │ │   Detected by nightly review · last run 20 Jun 02:00          │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│         │                                                                   │
│         │ ┌─ D. TABS: Overview · AutoGrade · LevelUp · Insights ─────────┐ │
│         │ │  (Overview default)                                           │ │
│         │ │  ┌ ProgressRing ×3 (Overall · Exams · Spaces) ┐ ┌ Strengths ┐│ │
│         │ │  │  72%        81%        62%                  │ │ Chips      ││ │
│         │ │  └────────────────────────────────────────────┘ │ Weaknesses ││ │
│         │ │                                                  └ Chips ─────┘│ │
│         │ │  ── Subject performance (SimpleBarChart) ──                    │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

**Region detail**

- **A. Identity header** — `Panel` (radius `lg`, elevation `e1`). `Avatar`
  (initials) + display name (`Fraunces` h2, `text.primary`) + a
  `DefinitionList`-style meta line (`text.secondary`, `Schibsted`): roll, grade,
  section, class name(s), status, enrolled date. Right-aligned action cluster:
  primary **`Button` (spark)** "Generate report"; optional ghost **`Button`**
  "Edit student"; `AtRiskBadge` inline when flagged. On `md`/`lg` the action
  cluster sits top-right; on `sm` it wraps below the meta line full-width.

- **B. Score KPI row** — 4 × `Stat/KPI` in a CSS grid. Each KPI: label
  (`text.secondary`, caption tracking), big numeric in `Spline Sans Mono`
  (`text.primary`), optional sub-label (`text.muted`). Grid: `lg` 4-up, `md`
  2×2, `sm` single column stacked. Overall uses `brand.primary` numeral; Streak
  numeral uses `spark` as **data color only** (no flame animation).

- **C. At-risk panel** — rendered **only when `summary.isAtRisk`**, as an
  `InlineAlert/Banner` (`status.warning` treatment, icon + label, never
  color-alone). Lists `atRiskReasons` as `Chip`s and states detection provenance
  ("Detected by nightly review"). Read-only.

- **D. Tabbed body** — `Tabs` with four tabs. Default **Overview**. Tabs keep
  the page scannable and defer heavy lists (submission rows, story-point track)
  until selected, aiding perf and a11y.
  - **Overview:** 3 × `ProgressRing` (Overall / Exams / Spaces) in a `Card`; a
    `Card` with Strengths/Weaknesses `Chip` clusters (`status.success` for
    strengths, `status.error` for weaknesses — paired with a small label, never
    color alone); `SimpleBarChart` of per-subject exam performance.
  - **AutoGrade:** `Timeline` of exam history (most recent first), each row a
    `SubmissionCard`-lite with exam title, date, `GradePill`, score/maxScore
    (mono). Released rows are expandable into a read-only `RubricBreakdown` with
    a "Open in grading" link. Unreleased exams render a muted, non-expandable
    "Results not released" row.
  - **LevelUp:** per-space cards each containing a read-only `StoryPointTrack`
    (`StoryPointNode` mastery states), space completion `ProgressBar`, and a
    read-only gamification strip (`XPMeter`/`StreakFlame`/`LevelBadge` rendered
    as **static data**, not animated).
  - **Insights:** stack of `InsightCard`s (active, non-dismissed). Empty when
    none.

**Responsive grid (FOUNDATION breakpoints):**

- `sm` (≤640): single column; KPIs stacked; ProgressRings wrap to a row of up to
  2; Tabs become horizontally scrollable; action cluster full-width.
- `md` (768): KPIs 2×2; ProgressRings 3-up; two-column Overview where space
  allows.
- `lg` (≥1024): full layout as drawn; content capped at max-width 1200,
  centered.

---

## 4. Components used

All from FOUNDATION §5 / the shared-ui inventory (webapps-design §2.2). No new
variants.

| Component                                                              | Source / subpath         | Use here                                                      |
| ---------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------- |
| `AppShell` / `PlatformLayout` / `AppSidebar` / `Topbar` / `Breadcrumb` | `shared-ui/layout`       | Shell + breadcrumb chrome                                     |
| `Panel` / `Card` (`CardHeader`/`Content`/`Title`)                      | §5 Containers            | Header, KPI row, tab panels                                   |
| `Avatar`                                                               | §5 Data                  | Student identity glyph                                        |
| `DefinitionList`                                                       | §5 Data                  | Identity meta (roll/grade/section/class/status)               |
| `Stat`/`KPI` (`ScoreCard`/`StatCard`)                                  | `shared-ui/charts`       | Overall / Exam avg / Space completion / Streak                |
| `ProgressRing`                                                         | `shared-ui/charts`       | Overall · Exams · Spaces dials                                |
| `ProgressBar`                                                          | §5 Data                  | Per-space completion                                          |
| `AtRiskBadge`                                                          | `shared-ui/charts`       | Risk flag (header + at-risk panel)                            |
| `InlineAlert`/`Banner`                                                 | §5 Feedback              | At-risk reasons panel; partial-data notice                    |
| `Tabs`                                                                 | §5 Containers            | Overview / AutoGrade / LevelUp / Insights                     |
| `Timeline`                                                             | §5 Data                  | Exam history (chronological)                                  |
| `GradePill`                                                            | Domain (§5)              | Per-exam letter/grade chip (`grade.*` scale)                  |
| `RubricBreakdown`                                                      | `shared-ui/feedback`     | Read-only per-question breakdown (released only)              |
| `StoryPointTrack` / `StoryPointNode`                                   | Domain (§5)              | Read-only learning path + mastery states                      |
| `SimpleBarChart`                                                       | `shared-ui/charts`       | Subject performance                                           |
| `Chip`/`Tag`                                                           | §5 Data                  | Strengths / weaknesses / at-risk reasons                      |
| `InsightCard`                                                          | Domain (§5)              | Insight cards                                                 |
| `XPMeter` / `StreakFlame` / `LevelBadge`                               | `shared-ui/gamification` | Read-only gamification **data** (static, no celebration)      |
| `Button` (spark / ghost)                                               | §5 Primitives            | "Generate report" (spark), "Edit student" (ghost)             |
| `Toast` (sonner)                                                       | §5 Feedback              | Report-ready / error feedback                                 |
| `Skeleton`                                                             | §5 Data                  | Loading state                                                 |
| `EmptyState` / `ErrorState`                                            | `shared-ui/data`         | Empty + error variants                                        |
| `ConfirmDialog`                                                        | §5 Feedback              | (Not needed — generate-report is non-destructive; no confirm) |

**Proposed adjustment (justified, not a new token):** the gamification
components (`XPMeter`/`StreakFlame`/`LevelBadge`) must support a
**`static`/`readOnly` prop** that suppresses the spring pop + marigold burst
celebration (FOUNDATION §4 reserves the one celebratory moment for the _student_
earning it). If that prop does not yet exist, add it to the gamification
components rather than re-skinning here — staff surfaces must render these as
inert data. No new visual tokens are introduced; the `spark` color is still
used, only as a static fill.

---

## 5. States

Loading / empty / error / partial / success, plus role-gated variants.

**Loading (skeleton).** Mirror the final layout to avoid shift: `Skeleton` for
the header block (avatar + two text lines), a 4-up `Skeleton` grid for KPIs
(height ~`space-24`), and a tall `Skeleton` for the active tab body.
`students.get` and `analytics.getSummary` are the gating reads;
submission/progress reads can resolve later (see Partial). Honor
`prefers-reduced-motion` — skeleton shimmer is subtle, disabled under reduced
motion.

**Empty (valid student, no analytics yet).** When `students.get` succeeds but
`analytics.getSummary` returns no materialized summary (new student, never
assessed): render the identity header normally and replace the KPI row + tabs
with an `EmptyState` — title (`Fraunces`), body, and no celebratory art. Copy in
§7. "Generate report" is **disabled** with a tooltip ("No progress data to
report yet").

**Error.** Distinct from empty (webapps-design fix #17 ethos). If `students.get`
fails → full-region `ErrorState` (student not found / not accessible). If
`analytics.getSummary` fails → `ErrorState` in the body with a **Retry** action;
header still renders if the student read succeeded. Errors map via `useApiError`
from `error.details.code` (common-api §6.3): `NOT_FOUND` (student/summary),
`PERMISSION_DENIED` (out-of-scope student), `TENANT_SUSPENDED`. Cross-tenant or
out-of-class access yields `PERMISSION_DENIED` server-side and renders the "no
access" panel — never partial cross-tenant data.

**Partial.** Common case: summary present, but exam-detail or progress reads
still loading or one failing. Show the resolved regions; render a small inline
`Skeleton` or an `InlineAlert` (`status.info`) in the unresolved tab ("Couldn't
load exam history — Retry"). The Overview KPIs and rings never block on the
per-tab detail reads. If some exams are graded-but-not-released, those rows
render as "Results not released" rather than being hidden (transparency without
exposing scores).

**Success.** All regions populated. "Generate report" enabled. At-risk panel
present iff `isAtRisk`.

**Permission-gated variants by role:**

- **`teacher`:** may open this route **only for a student in a class they
  manage** (`classIds` / `managedClassIds`, with the 15-class overflow
  fallback). The server scopes `students.get`/`getSummary` to the caller; an
  out-of-scope `studentId` returns `PERMISSION_DENIED` → "You don't manage this
  student's class." The client also pre-checks the student's
  `classId ∈ claims.classIds` to render the access panel without a round-trip
  where possible, but the **server decision is authoritative**.
- **`tenantAdmin`:** sees any student in the tenant; no class scoping. "Edit
  student" affordance shown (admins can edit); teachers see it only if
  `TeacherPermissions.canManageStudents`.
- **Report generation** is available to both roles for in-scope students
  (rate-tier `report`, 5/window per common-api §3.1 / analytics rate limit). If
  rate-limited → `RATE_LIMITED` toast with retry hint.
- Gamification strip, at-risk reasons, rubric breakdown, insights are visible to
  both roles read-only; **answer keys are never present in any payload or any
  state** (see §8).

---

## 6. Interactions & motion

Motion is "felt, not seen" — cite FOUNDATION §4 tokens. Reduced-motion replaces
every transition with an instant state change.

**Page entrance.** Main region fades/translates in with `motion.page` (420ms,
`ease.entrance`). `RouteAnnouncer` reads the student name. Breadcrumb and header
settle first; KPI row and tab body cross-fade as data resolves (`motion.base`
220ms, `ease.standard`).

**Tab switch.** `Tabs` content cross-fades at `motion.fast` (160ms,
`ease.standard`); active-tab underline slides at the same duration. Tab content
is lazy — first activation triggers the per-tab read; subsequent switches are
cached (React Query).

**KPI / ring reveal.** `ProgressRing` arcs animate from 0 to value once on first
paint of the Overview tab (`motion.slow` 320ms, `ease.standard`); no
re-animation on tab return. Under reduced motion, rings render at final value
with no sweep.

**Expand exam row → RubricBreakdown.** `Timeline`/`SubmissionCard` row expands
with a height/opacity transition at `motion.base`; collapses with `ease.exit`.
The breakdown is read-only; "Open in grading" navigates to
`/exams/:examId/submissions/:submissionId` (full page nav, not modal).

**Generate report (the one write).**

1. User clicks the spark `Button` "Generate report". No confirm dialog
   (non-destructive).
2. Button enters **loading** state (spinner, disabled, label → "Generating…");
   this is _not_ optimistic — we wait for the server, because the artifact
   (signed URL) only exists after `generateReport` returns. A `LoadingOverlay`
   is **not** used; only the button blocks.
3. On success: `api.analytics.generateReport({ type: 'progress', studentId })`
   returns `{ pdfUrl, expiresAt }`. We trigger the download (open `pdfUrl`) and
   show a `Toast` (success) "Progress report ready" with a "Download again"
   action (valid until `expiresAt`). Button returns to rest.
4. On error: button returns to rest; `Toast` (error) with the mapped message and
   recovery hint (`ERROR_RECOVERY_HINTS`). `RATE_LIMITED` → "Too many reports —
   try again in a minute."

**At-risk badge interaction.** `AtRiskBadge` is informational; hovering/focusing
reveals a `Tooltip` summarizing reasons and detection time. It is **not** a
control and never triggers recomputation.

**No optimistic mutations of data.** This screen reads server-authoritative
values and only generates a report artifact; there is no inline data edit to
optimistically update. (Editing the student record happens in the shared
`StudentFormDialog` reached via "Edit student", which owns its own optimistic
flow.)

**Confirmations.** None required on this screen — the only action is
non-destructive.

---

## 7. Content & copy

Precise, professional, staff tone. No exclamation chrome.

**Breadcrumb:** `People › Students › {displayName}`.

**Header:**

- Title: `{student.displayName ?? student.name}` (fallback "Student report" only
  if name missing).
- Meta line (separated by middots): `Roll {rollNo}` · `Grade {grade}` ·
  `Sec {section}` · `{className}` · `{Active|Inactive}` · `Enrolled {date}`.
- Primary action: **"Generate report"** (loading: "Generating…").
- Secondary action: **"Edit student"** (role/permission-gated).

**KPI labels:**

- "Overall score" — value `{round(overallScore×100)}%`.
- "Exam average" — value `{round(autograde.averagePercentage)}%`, sub
  `{completedExams} exams`.
- "Space completion" — value `{round(levelup.averageCompletion)}%`, sub
  `{completedSpaces}/{totalSpaces} spaces`.
- "Current streak" — value `{levelup.streakDays}d` (sub: "consecutive active
  days").

**At-risk panel (only if flagged):**

- Heading: **"Flagged at-risk"** (with warning icon).
- Body: "This student was flagged by the nightly review. Reasons: {reason
  chips}."
- Footnote: "Detected by automated rules — review the evidence before acting."
- Reason chip labels (humanized `atRiskReasons`): "Low exam average", "Declining
  trend", "Incomplete spaces", "Zero streak" (map enum values; never show raw
  codes).

**Tabs:** "Overview" · "AutoGrade" · "LevelUp" · "Insights".

**Overview sub-headings:** "Performance overview" (rings), "Strengths" / "Needs
improvement" (chip clusters), "Subject performance" (chart).

**AutoGrade tab:**

- Section: "Exam history".
- Released row: `{examTitle}` · `{date}` · `{GradePill}` · `{score}/{maxScore}`.
- Unreleased row (muted): "{examTitle} — Results not released".
- Expanded breakdown footer link: "Open in grading".
- Empty: title "No exam results yet", body "This student hasn't completed any
  graded exams in your classes."

**LevelUp tab:**

- Per-space header: `{spaceName}` + `{round(completion)}% complete`.
- Mastery legend: "Not started" / "In progress" / "Mastered" (paired with
  `mastery.*` colors + distinct node shapes/icons).
- Gamification strip label: "Gamification (read-only)" — "XP {xp}" · "Streak
  {streakDays}d" · "Level {level}".
- Empty: title "No space progress yet", body "This student hasn't started any
  learning spaces."

**Insights tab:**

- Empty: title "No insights yet", body "Insights appear after the student has
  enough activity for the system to analyze."

**Empty state (no summary at all):**

- Title: "No progress data yet".
- Body: "This student hasn't been assessed yet. Once they complete an exam or a
  learning space, their progress and report will appear here."

**Error copy:**

- Student not found / no access: title "Can't open this student", body "This
  student isn't in a class you manage, or no longer exists." (`teacher`) / "This
  student record couldn't be found." (`tenantAdmin`).
- Summary load failed: "Couldn't load progress" + **Retry**.
- Exam history failed (partial): "Couldn't load exam history" + **Retry**.

**Toasts:**

- Report success: "Progress report ready" (action: "Download again").
- Report error: "Couldn't generate report" + recovery hint.
- Rate-limited: "Too many reports — try again in a minute."

**Tone guardrails:** never "Great job!", "Keep it up!", or emoji. State facts.
"Flagged at-risk" not "Uh-oh".

---

## 8. Domain rules surfaced

- **Server-authoritative scoring.** `overallScore` = **60% autograde + 40%
  levelup**, computed by analytics triggers (`computeOverallScore`, be-analytics
  §1 util layer). The client **renders** it; it never recomputes the blend or
  derives strengths/weaknesses locally.
- **At-risk is read-only from the nightly rule engine.** `isAtRisk` +
  `atRiskReasons` come from `nightlyAtRiskDetection` / `evaluateAtRiskRules`
  (be-analytics). The UI **must not** compute or infer risk client-side, and
  must label provenance ("nightly review"). Reasons are mapped from the enum to
  human copy (avoid the known `no_recent_activity` vs `zero_streak` drift —
  render only what the payload contains).
- **Released-results gating.** Exam detail (scores, rubric breakdown) is shown
  **only for `results_released` submissions**, honoring
  `releaseResultsAutomatically` / results-released state. Graded-but-unreleased
  exams render as "Results not released" — never their scores. The released-only
  projection is enforced **server-side** (`questionSubmissions.list` released
  projection, common-api §3.3 autograde).
- **Answer keys are never client-side.** No payload on this screen includes
  answer keys (they live in the server-only `answerKeys` subcollection,
  `firestore.rules:314-316`). `RubricBreakdown` shows the student's response +
  rubric scoring + feedback, never the key. `AnswerKeyLock` is not even needed
  here because nothing key-bearing is requested.
- **Tenant isolation.** All reads are scoped to the caller's active tenant via
  server-derived `tenantId` (claims, common-api §4.4). Cross-tenant data can
  never appear.
- **Class scoping for teachers.** A `teacher` may view only students in classes
  they manage (`classIds` / `managedClassIds`, 15-class overflow fallback to the
  membership doc per auth-access §1.3). Out-of-scope access →
  `PERMISSION_DENIED`. `tenantAdmin` is unscoped within the tenant.
- **Reads via repositories, writes via callables.** No client Firestore access;
  the single mutation (`generateReport`) is a callable returning a signed URL
  (be-analytics §1 / common-api §3.3). No client recompute of stats.
- **Gamification is data, not celebration.** XP/streak/level render statically
  (FOUNDATION §4 — the celebratory moment belongs to the student earning it, not
  a staff viewer).
- **Stubbed-metric honesty.** Where analytics currently stubs values (e.g.
  `streakDays` historically `0`, `topicPerformance` empty — be-analytics §4),
  the UI shows the server value as-is; it must not fabricate. If a metric is
  absent, hide that KPI/section rather than render a misleading zero.

---

## 9. Accessibility

Targets WCAG AA (FOUNDATION §2.3, §2.4).

- **Focus order:** Skip-to-content → Breadcrumb → Header title → "Generate
  report" → "Edit student" → KPI cards (non-interactive, skipped) → Tab list →
  active tab panel content → expandable exam rows → "Open in grading" links.
  Logical top-to-bottom, left-to-right.
- **Keyboard:** `Tabs` follow the WAI-ARIA tab pattern (Left/Right to move
  between tabs, Home/End to first/last, Enter/Space to activate;
  `aria-selected`, `role="tablist"/"tab"/"tabpanel"` with
  `aria-controls`/`aria-labelledby`). Exam rows are buttons (`aria-expanded`)
  toggled by Enter/Space. "Generate report" is a real `<button>`; its loading
  state sets `aria-busy` and `aria-disabled`.
- **ARIA / semantics:** the icon-only avatar is `aria-hidden` with the name as
  visible text. `AtRiskBadge` carries an `aria-label` ("At risk: low exam
  average, zero streak"). `ProgressRing` exposes `role="img"` + `aria-label`
  ("Overall score 74 percent"). KPI numerals have visible labels; the streak's
  `spark` color is paired with the "Current streak" label (never color-alone).
  Strength/weakness chips and grade pills carry text, not color alone —
  `GradePill` shows the letter; mastery nodes show an icon + label.
- **Live regions:** report generation announces "Generating report" then "Report
  ready" / "Couldn't generate report" via an `aria-live="polite"` region (in
  addition to the toast). `RouteAnnouncer` announces the student name on
  navigation.
- **Contrast:** all text/bg pairs meet AA (body 4.5:1, large/UI 3:1).
  `status.warning` at-risk text uses the `status.warning` token on `bg.surface`,
  paired with icon + label. Mastery/grade/confidence scales (FOUNDATION §2.3)
  are always icon+label backed.
- **Reduced motion:** `prefers-reduced-motion` disables ring sweeps, tab
  cross-fades, row expand transitions, and skeleton shimmer — content appears at
  final state instantly.
- **Touch targets:** ≥44px (FOUNDATION §4) for tabs, buttons, and expandable
  rows on mobile/RN.

---

## 10. Web↔mobile divergence (RN parity)

Component **names and props match 1:1** between `shared-ui` (web) and
`ui-native` (mobile); only the renderer differs (FOUNDATION §6). This screen is
teacher-facing; a teacher RN client (if/when built) would reuse the same
headless data hooks over `@levelup/api-client` unchanged (common-api §4.5).

- **Shell:** web uses `AppShell` sidebar + `Topbar` + `Breadcrumb` + `⌘K`; RN
  uses `Tabbar`/stack navigation with a back affordance and **no command palette
  / no hover** — the same route is a pushed detail screen.
  `RouteAnnouncer`/skip-link are web-only; RN relies on native screen-reader
  focus.
- **Tabs:** web horizontal `Tabs`; RN keeps the same four segments as a top
  segmented control or swipeable pager. Behavior identical, presentation native.
- **Exam history:** web `Timeline`/expandable rows; RN renders stacked
  `SubmissionCard`s that push a detail screen (or expand inline) —
  `RubricBreakdown` is read-only on both; "Open in grading" is a native push
  instead of a route nav.
- **`StoryPointTrack`:** identical mastery semantics; RN renders the path
  natively (vertical scroll), web horizontally where space allows.
- **Interactions:** hover tooltips (at-risk, KPI sub-labels) become **long-press
  / inline helper text** on RN. Report download: web opens the signed `pdfUrl`
  in a new tab; RN opens the system share/viewer sheet with the same URL.
- **Motion:** web uses the CSS `ease.*` tokens; RN uses Reanimated with the
  matching durations and the spring reserved for gamification — but here
  gamification is `static`, so no spring fires on either platform.
- **Data path:** identical — both consume the same `analytics.getSummary` /
  repositories; no Firestore SDK coupling in the UI (the RN prerequisite).

---

## 11. Claude-design prompt

```
You are generating ONE screen for the Auto-LevelUp **teacher** web portal, strictly
conforming to the "Lyceum / Modern Scholarly" design system in
docs/rebuild-spec/design/00-FOUNDATION.md and the spec in
docs/rebuild-spec/design/teacher/student-detail-progress.md.

SCREEN: "Student Detail — Progress & Report" at route /students/:studentId/report.
ROLES: teacher (own classes only) and tenantAdmin (all). Staff tone: precise,
credible, calm. NO gamification celebration chrome — XP/streak/level render as
STATIC read-only data only.

USE ONLY FOUNDATION tokens and shared-ui components (cite semantic names, never hex):
- Color: bg.canvas/surface, text.primary/secondary/muted, brand.primary, spark
  (static fill only), status.success/warning/error/info, grade.*, mastery.*.
- Type: Fraunces (h1–h3 + hero numbers), Schibsted Grotesk (UI/body/labels),
  Spline Sans Mono (scores/IDs/numerics).
- Spacing 4px scale; radius lg cards / md buttons / pill chips; elevation e1 cards;
  motion: page 420ms ease.entrance entrance, base 220ms / fast 160ms ease.standard,
  slow 320ms ring sweep. Honor prefers-reduced-motion.

LAYOUT (inside PlatformLayout → AppShell, content max-width 1200, gutter 32, gap 24):
1) Identity header Panel: Avatar + name (Fraunces) + meta DefinitionList
   (roll · grade · section · class · status · enrolled) + AtRiskBadge (if flagged)
   + spark Button "Generate report" + ghost Button "Edit student" (perm-gated).
2) Score KPI row: 4× Stat/KPI — Overall score, Exam average (+exam count),
   Space completion (+x/y spaces), Current streak (Nd). lg 4-up / md 2×2 / sm stacked.
3) At-risk InlineAlert/Banner — render ONLY if isAtRisk; status.warning, icon+label,
   reasons as Chips, provenance "Detected by nightly review". Read-only.
4) Tabs (Overview default): Overview (3× ProgressRing Overall/Exams/Spaces + Strengths/
   Weaknesses Chip clusters + SimpleBarChart subjects); AutoGrade (Timeline of exam
   history, GradePill + score/maxScore mono; released rows expand to read-only
   RubricBreakdown with "Open in grading" link; unreleased rows show "Results not
   released"); LevelUp (per-space read-only StoryPointTrack + ProgressBar + static
   XPMeter/StreakFlame/LevelBadge); Insights (InsightCard stack).

DATA (typed repos / callables over @levelup/api-client — NEVER firebase/firestore,
tenantId derived server-side from claims):
- reads: students.get, analytics.getSummary({scope:'student',studentId}),
  submissions.list+exams.get, questionSubmissions.list (released projection),
  progress.getSpaceProgress/listStoryPointProgress, insights.list.
- write: api.analytics.generateReport({type:'progress',studentId}) → {pdfUrl,expiresAt};
  spark button shows loading "Generating…", on success opens pdfUrl + success Toast,
  on error Toast with recovery hint. No confirm dialog (non-destructive).

STATES: skeleton (mirror layout), empty (valid student no summary → EmptyState,
disable Generate report), error (ErrorState distinct from empty + Retry, map
error.details.code), partial (resolved regions render; per-tab inline retry).
Teacher out-of-scope student → PERMISSION_DENIED access panel.

DOMAIN RULES (must hold): overallScore is server-computed 60% autograde / 40% levelup —
DO NOT recompute. isAtRisk/atRiskReasons are read-only from the nightly engine — DO NOT
compute risk client-side; label provenance. Show exam detail ONLY for results_released
submissions; unreleased → "Results not released". Answer keys NEVER appear. Tenant
isolation + teacher class scoping enforced server-side.

A11Y: ARIA tab pattern, ProgressRing role=img + aria-label, AtRiskBadge aria-label,
status never color-alone (icon+label), focus-visible rings from border.focus,
aria-live for report generation, reduced-motion disables sweeps/cross-fades,
touch targets ≥44px.

Output: a React + TypeScript page composed from @levelup/shared-ui components and
@levelup/shared-hooks (headless) over @levelup/api-client. Presentational only;
no Firebase imports. Match shared-ui prop names so the same logic ports to RN.
```
