# Class Test Analytics

> Class-level performance analysis for **in-space timed tests / quizzes** (the
> `test` / `timed_test` / `quiz` story points inside learning spaces) — distinct
> from formal AutoGrade **exams**. Pick a class, then a test story point, and
> read its server-computed aggregates: attempt counts, score distribution,
> time-usage vs the allotted limit, a question-level breakdown, retake patterns,
> and completion. A calm, credible reporting console that _reads_
> `testSessions.*` aggregates and `analytics.*` summaries — it never administers
> a test, never re-scores, never starts/stops a clock, and never shows answer
> keys. Authoring lives in SPACES; the live test runtime is
> server-authoritative.

**Route** `/analytics/tests` · **Roles** `teacher` (own classes only) ·
`tenantAdmin` (all classes) · **Primary APIs** `classes.list` · `spaces.list` /
`storyPoints.list` (filter to `type ∈ {test, timed_test, quiz}`) ·
`testSessions.*` aggregates · `analytics.getSummary` (`scope:'class'`) ·
`v1.analytics.generateReport` (`type:'class'`)

This spec conforms to `design/00-FOUNDATION.md` ("Lyceum / Modern Scholarly").
All tokens, type, spacing, radius, elevation, motion, and components are cited
by their FOUNDATION semantic names — no new tokens or variants are introduced.
Per FOUNDATION §1 the staff register is **precise, credible, calm**: restraint
in chrome, no XP/streak/celebration; `spark` is reserved for the single primary
CTA (Generate report), never ambient decoration.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` (sees only classes they manage and the
spaces/tests assigned to those classes) or a `tenantAdmin` (sees all classes and
spaces in the active tenant). Both reach this surface to understand _how a
cohort performed on an in-space test or quiz_, after students have attempted it.

**Job-to-be-done:** _"My class took the timed test (or quiz) inside this space —
show me how many attempted it and finished, how scores spread, whether students
ran out of time, which questions tripped them up, and who is re-taking it
repeatedly, so I can re-teach the weak spots and pace the test better."_

This screen turns server-computed **test-session aggregates** (per
`test`/`timed_test`/`quiz` story point, scoped to a class) into a readable
performance picture, and lets the teacher export a class report.

**This screen vs Exam Analytics (read this — the two are deliberately
separate):**

- **Class Test Analytics (THIS screen)** analyzes **in-space assessments**:
  `test` / `timed_test` / `quiz` **story points** authored inside learning
  **spaces**, attempted via the student **test runtime** (`startTestSession` /
  `submitTestSession`). Its data source is `testSessions.*` aggregates + the
  class summary, not `examAnalytics`.
- **Exam Analytics** (`/analytics/exams`, sibling spec `exam-analytics.md`)
  analyzes the **formal AutoGrade exam flow**: uploaded answer sheets, AI/HITL
  grading, released results, `examAnalytics/{examId}`.
- A teacher confused about "test vs exam" is told plainly in the header subline
  ("In-space tests & quizzes — for formal exam results, see Exam analytics →").

**Explicitly NOT this screen's job** (FOUNDATION + domain rules):

- **Administering or grading a test.** Starting/submitting a test session, the
  countdown, and the deadline are owned by the **server-authoritative** student
  runtime (`startTestSession`/`submitTestSession`). This screen reads outcomes;
  it never runs a clock or scores an attempt.
- **Authoring.** Creating/editing the test story point, its items, rubric, time
  limit, or answer key is the SPACES area (`/spaces/:spaceId/edit`). This screen
  links out to it; it never edits content.
- **Per-student review.** Individual attempt drill-down (one student's answers)
  is the student-detail / progress surface; this screen stays at the
  cohort/aggregate level and links out.
- **Any client recomputation.** Attempt counts, score distribution, time-usage,
  completion, difficulty, and retake stats are read verbatim from
  server-computed aggregates; the client never derives statistics from raw
  session documents.

**Emotional register:** professional, factual, non-celebratory. A low score or a
"ran out of time" signal is presented as an operational fact (status color
always paired with an icon + label per FOUNDATION §2), never as a "fail" with
celebration chrome.

---

## 2. Entry points & route

**Route:** `/analytics/tests`, gated by
`RequireAuth allow={['teacher','tenantAdmin']}` (FOUNDATION §4 single
config-driven guard; `specs/webapps-design.md` §4.2). Sidebar nav item under
group **Analytics** (`navMeta.group: 'Analytics'`, label "Tests").

The screen supports deep-linked selection via query params
`?classId=…&spaceId=…&storyPointId=…` so dashboard rows, Class Detail, Space
Analytics, and external links can open straight to a specific test's analytics.
Selection is URL state (first-class deep link, RN-nav friendly), not local-only
state — switching tenants or roles re-resolves it.

**Entry points:**

- **Analytics → Tests** sidebar item (lands on the picker, defaulting to the
  caller's first managed class and the most-recently-active test story point in
  it).
- **Teacher Dashboard** "test activity" / class rows →
  `/analytics/tests?classId=…`.
- **Class Detail** (PEOPLE area) "Test performance" link →
  `/analytics/tests?classId=:classId`.
- **Space Analytics** (`/analytics/spaces`) → "View test analytics" on a
  `test`/`timed_test`/`quiz` story point →
  `/analytics/tests?spaceId=…&storyPointId=…`.
- **Space Editor** (SPACES area, read-only crosslink) on a test story point →
  "View class results".
- `CommandPalette` (⌘K) "Test analytics".

**Reads powering it** (all via `@levelup/api-client` repositories / headless
hooks — UI never touches Firestore; see `specs/common-api.md` §3.3 and
`specs/webapps-design.md` §6):

- `classes.list` → the **class picker** source. Server-scoped to `ctx.classIds`
  for `teacher` (15-class JWT cap `MAX_CLAIM_CLASS_IDS=15` with
  `classIdsOverflow` → `managedClassIds` Firestore fallback,
  `status/auth-access.md` §1.3) and full-tenant for `tenantAdmin`. `tenantId` is
  derived from claims server-side — never a field.
- `spaces.list` (`v1.levelup.listSpaces`) + `storyPoints.list`
  (`v1.levelup.listStoryPoints`) → the **test picker** source: published spaces
  assigned to the selected class (`classIds` intersect + `accessType`), filtered
  to story points with `type ∈ {test, timed_test, quiz}`. Each option carries
  `estimatedTimeMinutes` / `assessmentConfig` time limit so the picker can label
  timed vs untimed.
- `testSessions.*` aggregates → the precomputed per-(class, storyPoint) **test
  analytics**: `attemptCount`, `uniqueAttemptees`, `completionRate`,
  `avgScorePct`, `medianScorePct`, `scoreDistribution.buckets[]`, `timeUsage`
  (`avgSeconds`, `medianSeconds`, `allottedSeconds`,
  `overTimeCount`/`autoSubmittedCount`, `timeUsedPctBuckets`),
  `questionBreakdown[]` (per item: `avgPct`, `difficultyIndex`, `attemptCount`,
  `commonMistakes`), `retake` (`reattemptRate`, `avgAttemptsPerStudent`,
  `scoreImprovementAvg`), `firstVsLatestAttempt`, `computedAt`/`lastUpdatedAt`.
  _(These are server-side rollups over `testSessions` — the same documents the
  student runtime writes via `submitTestSession`. The client reads the rollup,
  never the raw sessions.)_
- `analytics.getSummary` (`scope:'class'`) → the **class-context strip** (cohort
  size, at-risk count) so test results sit in class context. `isAtRisk` /
  `atRiskReasons` are surfaced read-only from the precomputed
  `ClassProgressSummary` (`status/be-analytics.md`) — never computed on the
  client.
- _(Class & space names resolve from the picker reads; a `useTenantNames`-style
  resolver is the fallback only if a placeholder name is detected.)_

**Writes:** exactly one — **Generate report** →
`v1.analytics.generateReport({ type:'class', classId, spaceId, storyPointId })`,
returning `{ pdfUrl, expiresAt }` (1-hour signed Storage URL, `report` rate
tier, `status/be-analytics.md` §1). No other mutation is reachable; the surface
is otherwise read-only.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (FOUNDATION §5 Navigation;
`specs/webapps-design.md` §3.1): persistent left `Sidebar` (role-driven nav),
`Topbar` (tenant switcher, ⌘K search, `NotificationBell`,
profile/`ThemeToggle`); on mobile a `Tabbar` (`MobileBottomNav`) replaces the
sidebar. This screen owns only the **main content region**. Page gutters follow
FOUNDATION §4 (mobile 16 / tablet 24 / desktop 32); max content width 1200.
Sections separated by `gap` space-8/`32`; cards use radius `lg`, elevation `e1`
at rest / `e2` on hover; canvas `bg.canvas`, cards `bg.surface`.

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar: [tenant ▾] ……… [⌘K search] [🔔 bell] [theme] [avatar]        │
│ (nav)   ├──────────────────────────────────────────────────────────────────────┤
│         │ MAIN (max-w 1200, gutter 32)                                           │
│         │ ┌─ Page header ───────────────────────────────────────────────────┐   │
│         │ │ h1 "Test analytics"                                              │   │
│         │ │ [ Class ▾ ]  [ Test / quiz ▾ ]            [ Generate report ]    │   │
│         │ │ {Space} › {Test title} · timed {12:00} · {n} in class · computed…│   │
│         │ │ "In-space tests & quizzes — for formal exams see Exam analytics→"│   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ KPI STRIP (Stat/KPI ×4) ───────────────────────────────────────┐   │
│         │ │ ▸Attempted  ▸Completion  ▸Avg score   ▸Median time / allotted    │   │
│         │ │  28 / 31     90%          64%          08:42 / 12:00             │   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ 2-col region (lg) ─────────────────────────────────────────────┐   │
│         │ │ ┌ SCORE DISTRIBUTION (Card) ──────┐ ┌ TIME USAGE (Card) ────────┐│   │
│         │ │ │ ScoreDistribution histogram      │ │ TimerBar context (avg/    ││   │
│         │ │ │ over score buckets; pass guide   │ │ allotted) + SimpleBarChart││   │
│         │ │ │                                  │ │ of time-used % buckets;   ││   │
│         │ │ │                                  │ │ "ran out of time" count   ││   │
│         │ │ └──────────────────────────────────┘ └───────────────────────────┘│   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ QUESTION BREAKDOWN (Card) ─────────────────────────────────────┐   │
│         │ │ DataTable: # · prompt(trunc) · attempts · avg% · difficulty bar  │   │
│         │ │            · common mistakes (chips)                             │   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ RETAKE & COMPLETION (Card) ────────────────────────────────────┐   │
│         │ │ Stat row: reattempt rate · avg attempts/student · improvement    │   │
│         │ │ ProgressBar: completion (completed vs started vs not-attempted)  │   │
│         │ │ DataTable: first-vs-latest attempt summary                       │   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ Footer note ───────────────────────────────────────────────────┐   │
│         │ │ "Edit this test or its time limit? Open it in Spaces →"          │   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

**Region order & grid:**

1. **Page header** — Fraunces `h1` "Test analytics"; a control row with the
   **class picker** (`Combobox`) and the **test picker** (`Combobox`, dependent
   on class, listing only `test`/`timed_test`/`quiz` story points) on the left,
   and the **Generate report** `Button` (spark variant) right-aligned (md+;
   wraps below on sm). A subline (`text.secondary`) shows
   `{Space} › {Test title}`, the time-limit chip (timed vs untimed), class
   cohort size, and `computedAt`/`lastUpdatedAt` freshness in `text.muted`. A
   second, quieter line disambiguates from exams and links to Exam analytics.
2. **KPI strip** — four `Stat/KPI` cards: `grid-cols-1` (sm) → `grid-cols-2`
   (md) → `grid-cols-4` (lg+). `gap` space-4/`16`. Mono numerics.
3. **Two-column charts** — `grid-cols-1` (sm/md) → `lg:grid-cols-2` (lg+). Left
   = **Score distribution** `Card`; right = **Time usage** `Card` (the
   timed-test-specific view). `gap` space-6/`24`.
4. **Question breakdown** `Card` — a `DataTable`, one row per item in the test.
   Full width.
5. **Retake & completion** `Card` — a small `Stat` row (retake metrics), a
   `ProgressBar` for completion, and a compact `DataTable` (first-vs-latest
   attempt). Full width.
6. **Footer note** — a quiet `text.secondary` link-out to SPACES (authoring /
   time-limit).

**Responsive summary:**

- **sm (<768):** single column throughout; class & test pickers stack
  full-width, Generate-report below; KPIs 1-up then 2-up; charts stacked;
  `DataTable`s render as stacked cards (FOUNDATION §6 "table on web → stacked
  cards on mobile").
- **md (768–1023):** pickers left / button right; KPIs 2×2; charts stacked
  (2-col only at lg); tables scroll horizontally inside their card.
- **lg+ (≥1024):** KPIs 4-up; score/time charts side-by-side; full tables;
  content centered within max-w 1200.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`specs/webapps-design.md`
§2.2). No new primitives.

| Region              | Component(s)                                                                                                                                                                                                                                           | Notes                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell               | `AppShell`, `Sidebar`, `Topbar`, `NotificationBell`, `CommandPalette`, `MobileBottomNav` (mobile), `SkipToContent`, `RouteAnnouncer`                                                                                                                   | Provided by `PlatformLayout`; not rebuilt here.                                                                                                                                                   |
| Header              | `Combobox` (class picker; test picker — searchable, dependent, **filtered to `test`/`timed_test`/`quiz`**), `Button` (spark variant "Generate report"; ghost "Open in Spaces"), `Chip`/`Tag` (timed/untimed time-limit label), `Breadcrumb` (optional) | Fraunces `h1`. `spark` only on Generate-report.                                                                                                                                                   |
| KPI strip           | `Stat/KPI` ×4 (`StatCard`/`ScoreCard`)                                                                                                                                                                                                                 | Mono numerics (Spline Sans Mono). "Median time" renders `mm:ss / mm:ss` (used / allotted).                                                                                                        |
| Score distribution  | `Card`, `ScoreDistribution` (or `SimpleBarChart` fallback)                                                                                                                                                                                             | Histogram over `scoreDistribution.buckets` (`{min,max,count}`); pass-mark guide line where the test defines a pass threshold.                                                                     |
| Time usage          | `Card`, `TimerBar` (**read-only context display, not a live countdown**), `SimpleBarChart`, `ProgressBar`, `Tooltip`                                                                                                                                   | `TimerBar` shows avg/median used against `allottedSeconds` as static context; `SimpleBarChart` over time-used-% buckets; an `InlineAlert`-style callout for `overTimeCount`/`autoSubmittedCount`. |
| Question breakdown  | `Card`, `DataTable`, `ProgressBar` (difficulty), `Chip`/`Tag` (mistakes), `Tooltip`                                                                                                                                                                    | One row per item; difficulty as a `ProgressBar` + numeric index.                                                                                                                                  |
| Retake & completion | `Card`, `Stat/KPI` (retake metrics), `ProgressBar` (completion), `DataTable` (first-vs-latest), `Badge`                                                                                                                                                | Completion bar segments completed / started-not-finished / not-attempted.                                                                                                                         |
| Class context       | `Stat/KPI`, `AtRiskBadge`                                                                                                                                                                                                                              | Cohort size + at-risk count from `ClassProgressSummary` (read-only).                                                                                                                              |
| Loading             | `Skeleton`                                                                                                                                                                                                                                             | Matches the final layout silhouette.                                                                                                                                                              |
| Empty / error       | `EmptyState`, `ErrorState`/`InlineAlert`                                                                                                                                                                                                               | Distinct empty vs error; "no test story points", "no attempts yet", and load-error variants.                                                                                                      |
| Report feedback     | `Toast` (sonner), `LoadingOverlay`/button spinner                                                                                                                                                                                                      | Report progress + success/failure; success opens/downloads the signed PDF URL.                                                                                                                    |
| Footer              | `Button` (ghost link to Spaces), `InlineAlert` (subtle)                                                                                                                                                                                                | Link-out only.                                                                                                                                                                                    |

**Proposed addition — none required.** `ScoreDistribution`, `SimpleBarChart`,
`StatCard`/`ScoreCard`, `ProgressBar`, `DataTable`, `AtRiskBadge`, and
`TimerBar` already exist in `shared-ui/charts`, `shared-ui/data`, and the domain
inventory (FOUNDATION §5; `specs/webapps-design.md` §2.2). `TimerBar` is reused
here in a **static, read-only context mode** (no server-authoritative countdown
is run on this screen) — a presentation-only usage of the existing component,
not a new variant. Pickers are the existing `Combobox`; all tables are the
shared `DataTable`. No new token or variant is introduced.

---

## 5. States

The screen has two coordinated phases — **pickers** (class → test, always
present) and **analytics view** (depends on a selected test story point). It is
designed for partial readiness; pickers resolve independently from the aggregate
document.

**Loading (skeleton).** On first mount with no cached class list, render a
`Skeleton` for the picker row, then once a test is selected render the full
analytics silhouette in `Skeleton`: KPI ×4 blocks, two chart cards (bar-shaped
placeholders, the time card showing a `TimerBar`-shaped placeholder), the
question table (header + ~5 rows), and the retake/completion card. The region
wrapper carries `role="status"` `aria-label="Loading test analytics"`. Skeletons
crossfade to content over `base` (220ms) `ease.entrance`. No full-screen
spinner.

**Empty — no test story points.** When the selected class has no published space
containing a `test`/`timed_test`/`quiz` story point, the analytics region shows
a single `EmptyState`: title "No tests for this class yet", body "Timed tests
and quizzes you assign inside a space appear here once students start attempting
them." with a ghost CTA "Open Spaces →" (`/spaces`). The class picker stays; the
test picker is empty/disabled.

**Empty — test selected but no attempts.** A test story point exists but
`attemptCount === 0` (assigned, nobody attempted). Show an in-view `EmptyState`:
title "No attempts yet", body "Analytics appear here once students start this
test. Check assignment and timing in Spaces." with a ghost "Open in Spaces →".
No fabricated zeros are rendered as results.

**Empty — aggregate not yet computed.** Rare race: attempts exist in
`testSessions` but the rollup hasn't materialized (aggregation lag). Show an
in-view `EmptyState`: title "Results are still being computed", body "We're
crunching this test's attempts. This usually takes a moment — check back
shortly." with a ghost "Refresh".

**Partial.**

- The pickers and KPI strip can render while the heavier charts/tables stream
  in; each card keeps its own `Skeleton` until the aggregate resolves. (The
  aggregate is one read, so in practice all settle together — but the layout
  never blocks as a whole.)
- **Untimed quizzes:** if the selected story point is a `quiz`/`test` with no
  time limit (`allottedSeconds` absent), the **Time usage** card is **omitted
  entirely** (not shown with empty/zero values), and the "Median time /
  allotted" KPI collapses to "Median time" without a denominator. The Time-usage
  card only renders for genuinely timed tests.
- **Stubbed / unavailable metrics are hidden, not shown as zero** (honors
  `status/be-analytics.md` §4 "stubs leak into reports as real-looking values"):
  `difficultyIndex`'s discrimination companion and any `topicPerformance` map
  render only when real (non-zero / non-empty). `scoreImprovementAvg` shows only
  when there is a meaningful re-attempt population.

**Error.** Distinct from empty (FOUNDATION §5 / `specs` §2.2 `ErrorState`). A
failed `classes.list`/`spaces.list` shows a page-level `ErrorState` with
"Retry"; a failed aggregate read shows an in-view `ErrorState` scoped to the
analytics region with "Retry" (refetches just that query). A failed **Generate
report** call surfaces a `Toast` (`status.error`) with copy mapped from
`error.details.code` (`specs/common-api.md` §6) and leaves the screen intact.
Errors are never rendered as empty states.

**Permission-gated variants by role:**

- **`teacher`:** the class picker lists only their managed classes
  (server-scoped via `ctx.classIds` + 15-class overflow fallback); the test
  picker lists only tests in spaces assigned to those classes; analytics reflect
  only that class's sessions. They never see another teacher's class or another
  tenant's data. **Generate report** is available **only if** their
  `TeacherPermissions` allow report generation; if not, the button is hidden
  (not disabled) and read-only analytics remain.
- **`tenantAdmin`:** sees all classes and all assigned tests in the active
  tenant; Generate report always available. Otherwise identical layout.
- No control on this screen administers, grades, or releases anything; the only
  gated action is report generation as above. Test-runtime and authoring
  controls are absent for both roles (they live in the student runtime and
  SPACES respectively).

---

## 6. Interactions & motion

**Core flow (pick class → pick test → read → optionally export).**

1. **Select class** — the class `Combobox` updates the URL `?classId=…`, reloads
   `spaces.list`/`storyPoints.list` (test picker source) and the class summary,
   and **resets** the test selection. Crossfades the analytics region (`base`,
   `ease.entrance`) without remounting the shell.
2. **Select test** — the test `Combobox` (searchable by space/title; each option
   labels timed vs untimed and shows the time limit) updates
   `?spaceId=…&storyPointId=…` and loads the `testSessions.*` aggregate.
   Switching tests crossfades the analytics region.
3. **Read the analytics** — KPIs, charts, and tables are read-only. Hovering a
   score-distribution bar shows a `Tooltip` with the bucket range and exact
   count; hovering a time-usage bar shows the time-used band and how many
   attempts auto-submitted at the deadline. Sorting a `DataTable` column
   (attempts, avg %, difficulty) is a pure client sort over already-fetched rows
   — it reorders, it never recomputes statistics.
4. **Drill out** — a question row or the completion table can link out to the
   relevant student-detail/progress surface for per-student review (navigation,
   not inline expansion); the footer links to SPACES to edit the test or its
   time limit.
5. **Generate report** — clicking the spark `Button` calls
   `v1.analytics.generateReport({ type:'class', classId, spaceId, storyPointId })`.
   The button enters a loading state (inline spinner, label "Generating…"), and
   a `Toast` confirms "Preparing your report…". On success the returned signed
   `pdfUrl` opens in a new tab / triggers download, and a success `Toast`
   "Report ready" appears (with a "Download again" action while the 1-hour URL
   is valid). On failure, an error `Toast` with retry. This is the **one**
   mutation/side-effect on the screen.

**Motion (FOUNDATION §4 tokens, "felt not seen"):**

- Section entrance: staggered `FadeIn` `ease.entrance` over `base` (220ms),
  header → KPIs → charts → tables, ~60–100ms apart. `prefers-reduced-motion` →
  no stagger, instant render.
- Class/test switch: analytics region crossfade over `base`; KPI numerals do
  **not** animate/count-up (staff register — values appear directly).
- Card hover: `e1` → `e2` + border `border.strong` over `fast` (160ms)
  `ease.standard`.
- Chart bars / `TimerBar` fill: a subtle grow-in on first paint
  (`ease.entrance`, `base`), disabled under reduced-motion. The `TimerBar` here
  is **static** — it fills once to its avg/median value and stays; it never
  ticks.
- Report button: spark glow (`spark glow` elevation token) on the CTA only;
  loading spinner replaces the icon.
- **No celebratory motion.** Scores, completion, and time usage are presented
  factually; there is no marigold burst or spring pop on this staff surface
  (FOUNDATION §4 reserves that for student gamification).

**Feedback & optimistic updates:**

- This is a read surface; there are **no optimistic writes** — all numbers are
  server-authoritative and the client never mutates them.
- Report generation is **not** optimistic (it produces a real artifact): the UI
  shows genuine progress and confirms only on the server's signed-URL response.

**Confirmations:** none required — there are no destructive actions.
`CommandPalette` (⌘K) jumps to other classes/tests/analytics; Esc closes it
(`ease.exit`).

**Refresh semantics:** React Query defaults (`refetchOnWindowFocus: false`).
`computedAt`/`lastUpdatedAt` from the aggregate are surfaced in `text.muted` so
freshness is honest; the screen never implies live recomputation (aggregates
update only when the server-side rollup re-runs).

---

## 7. Content & copy

Tone: direct, professional, factual (FOUNDATION §1 staff register). Numerals in
mono.

**Header**

- h1: `Test analytics`
- Class picker placeholder: `Select a class…`
- Test picker placeholder: `Select a test or quiz…`; each option:
  `{Space} › {Test title} · {timed mm:ss | untimed}`.
- Selected subline: `{Space}` › `{Test title}` · `Timed {mm:ss}` _(or
  `Untimed`)_ · `{n} in class` · `Computed {relative}` (last token in
  `text.muted`).
- Disambiguation line (`text.secondary`):
  `In-space tests & quizzes — for formal exam results, see Exam analytics →`
- Primary CTA: `Generate report`
- Footer link-out: `Edit this test or its time limit? Open it in Spaces →`

**KPI strip** (label · value · caption)

- `Attempted` · `{uniqueAttemptees} / {cohortSize}` ·
  `{attemptCount} attempts total`
- `Completion` · `{completionRate}%` · `finished vs started`
- `Average score` · `{avgScorePct}%` · `median {medianScorePct}%`
- `Median time` · `{mm:ss} / {mm:ss}` · `used / allotted` _(timed only; untimed
  → value `{mm:ss}`, caption `time spent`)_

**Score distribution (card title):** `Score distribution`

- Subhead: `How the class's scores spread on this test.`
- Axis/Tooltip: bucket `"{min}–{max}%"` · `"{count} students"`.
- Pass-mark guide label (when the test defines one): `Pass mark`.
- Empty: `No attempts to analyze for this test.`

**Time usage (card title):** `Time usage` _(timed tests only)_

- Subhead:
  `How much of the allotted time students used. The test clock is enforced server-side.`
- `TimerBar` context label: `Median {mm:ss} of {mm:ss}` and
  `Average {mm:ss} of {mm:ss}`.
- Time-band bars labeled `"{min}–{max}% of time used"` · `"{count} attempts"`.
- Auto-submit callout (when `autoSubmittedCount > 0`):
  `{n} attempts hit the time limit and were auto-submitted.` (neutral
  `status.warning`, paired with icon + label).
- Omitted entirely for untimed quizzes.

**Question breakdown (card title):** `Question breakdown`

- Subhead: `Per-question performance across all attempts.`
- Table columns: `#` · `Question` (truncated prompt, **never the answer key**) ·
  `Attempts` · `Avg %` · `Difficulty` · `Common mistakes`.
- Difficulty cell: a `ProgressBar` + numeric index; `Tooltip` "Difficulty index
  {x} — share of available marks earned on average (lower = harder)."
- `commonMistakes` as `Chip`s.
- Empty: `No per-question data for this test yet.`

**Retake & completion (card title):** `Retakes & completion`

- Subhead: `Re-attempt patterns and how far the class got.`
- Retake stats: `Re-attempt rate {x}%` · `Avg attempts / student {x}` ·
  `Avg score change on retake {±x}%` _(last shown only when meaningful)_.
- Completion bar segments + legend: `Completed {n}` ·
  `Started, not finished {n}` · `Not attempted {n}`.
- First-vs-latest table columns: `Attempt` · `Avg score` · `Completion` (e.g.
  rows "First attempt", "Latest attempt").
- Empty: `Not enough attempts to show retake patterns.`

**Class context (inline, header-adjacent or KPI caption):**

- `{cohortSize} students` · `{atRiskCount} at risk` (the at-risk count uses
  `AtRiskBadge` and links to Class analytics; surfaced from the server summary,
  never computed here).

**Empty / error copy**

- No tests (region): title `No tests for this class yet`, body
  `Timed tests and quizzes you assign inside a space appear here once students start attempting them.`,
  CTA `Open Spaces →`.
- No attempts (region): title `No attempts yet`, body
  `Analytics appear here once students start this test. Check assignment and timing in Spaces.`,
  action `Open in Spaces →`.
- Aggregate not yet computed: title `Results are still being computed`, body
  `We're crunching this test's attempts. This usually takes a moment — check back shortly.`,
  action `Refresh`.
- Load error (page/region): title `Couldn't load test analytics`, body
  `Something went wrong fetching this data.`, action `Retry`.
- Report toasts: progress `Preparing your report…`; success `Report ready`
  (action `Download again`); failure
  `Couldn't generate the report. Please try again.`
- Report permission absent (teacher): the CTA is simply not rendered (no nag
  copy).

---

## 8. Domain rules surfaced

- **Tests are in-space assessments, not exams.** This screen reads `test` /
  `timed_test` / `quiz` **story points** (FOUNDATION §5
  `StoryPointTrack`/`StoryPointNode`; `StoryPoint.type` per
  `status/app-teacher-web.md` §1.8) attempted via the student test runtime,
  aggregated from `testSessions.*`. It is explicitly distinct from the formal
  AutoGrade **exam** flow (`examAnalytics`), which has its own screen
  (`exam-analytics.md`). The picker is filtered to those three story-point
  types; exams never appear here, and there is no answer-sheet/grading concept
  on this surface.
- **The test clock is server-authoritative.** The deadline, countdown, and
  clock-skew handling are enforced server-side by the student runtime
  (`startTestSession`/`submitTestSession`); `autoSubmittedCount` /
  `overTimeCount` reflect server-enforced deadlines. This screen **displays**
  time usage (`TimerBar` in static context mode) but **never runs a clock** and
  never re-derives whether an attempt was within time — it reads the server's
  verdict (`status/be-analytics.md`; `specs/common-api.md` §3.3
  `startTestSession`/`submitTestSession`).
- **Server-authoritative statistics — no client recompute.** Attempt counts,
  completion, score distribution, time usage, difficulty, and retake metrics are
  read verbatim from the precomputed `testSessions.*` aggregate. The client only
  sorts/filters already-computed rows for display; it never derives statistics
  from raw session documents (`specs/webapps-design.md` §0; FOUNDATION-aligned
  with the analytics precompute model in `status/be-analytics.md`).
- **Answer keys are never shown.** The question table shows only truncated
  **prompts** and aggregate metrics; answer keys live server-side (stripped from
  client reads, re-merged only by `getItemForEdit` for the authoring editor;
  `status/app-teacher-web.md` §1.9). This screen never requests or renders them
  (`AnswerKeyLock` model, FOUNDATION §5).
- **Stubbed metrics surface only when real.** Where server metrics are known to
  be stubbed/empty (`status/be-analytics.md` §4 — e.g. discrimination, topic
  performance, score-improvement when no re-attempt population), this screen
  **omits** the column/section rather than displaying a stub zero as truth.
- **At-risk is server-derived, read-only.** Any at-risk count/badge comes from
  the precomputed `ClassProgressSummary` (nightly rule engine,
  `status/be-analytics.md` §1/§3); the client surfaces
  `isAtRisk`/`atRiskReasons` and never computes risk.
- **Tenant isolation.** Everything is scoped to the caller's active tenant;
  `tenantId` is derived from claims server-side, never a field, never shown.
  Switching tenants (Topbar) reloads the pickers and clears the selection.
- **Role-scoped class & test visibility.** A `teacher` sees only classes in
  their claim `classIds` / `managedClassIds` (15-class JWT cap
  `MAX_CLAIM_CLASS_IDS` with `classIdsOverflow` Firestore fallback,
  `status/auth-access.md` §1.3) and only tests in spaces assigned to those
  classes; a `tenantAdmin` sees all. No class/test the caller can't access ever
  appears.
- **Reads via repositories, the one write via callable.** All reads go through
  `@levelup/api-client` (`classes.*`, `spaces.*`/`storyPoints.*`,
  `testSessions.*`, `analytics.getSummary`); the only write — report generation
  — goes through `v1.analytics.generateReport`. No direct client Firestore reads
  or writes.
- **Operational, not authoring/runtime.** Per the brief, this screen analyzes
  and exports; the live test runtime is the student app, and authoring (items,
  rubric, time limit) is SPACES. It links out to both; it never embeds them.

---

## 9. Accessibility

Conforms to FOUNDATION §2 (contrast) and §4 (reduced-motion), and
`specs/webapps-design.md` §2.4.

- **Landmarks & focus order:** `SkipToContent` first; then `Topbar`, `Sidebar`,
  then `main`. Within `main`, DOM/focus order = class picker (`Combobox`) → test
  picker (`Combobox`) → Generate report → KPI cards → score chart → time-usage
  chart → question table (header → rows) → retake/completion card → Spaces
  link-out. Order matches visual order at every breakpoint.
- **Keyboard:** both `Combobox`es are fully keyboard-operable (type to filter,
  Up/Down to move, Enter to select, Esc to close), with the test picker disabled
  until a class is chosen. Every `DataTable` column header is a focusable sort
  toggle (Enter/Space). All link rows and the report CTA are real focusable
  controls with the FOUNDATION focus ring (`border.focus`, `0 0 0 3px`). ⌘K
  opens `CommandPalette`; Esc closes it.
- **Charts are not color-only:** `ScoreDistribution`/`SimpleBarChart` and the
  `TimerBar` context expose accessible text alternatives — each bar/segment has
  an `aria-label` (e.g. "60–70%: 9 students"; "75–100% of time used: 6
  attempts"), and the question `DataTable` is the accessible equivalent of the
  difficulty view. The completion `ProgressBar` exposes its segments as labeled
  values ("Completed 22, started not finished 4, not attempted 5"), not hue
  alone (FOUNDATION §2 "never encode status by color alone").
- **KPIs as labeled groups:** each `Stat/KPI` is a labeled group
  (`aria-label="Average score: 64 percent, median 58 percent"`;
  `aria-label="Median time: 8 minutes 42 seconds of 12 minutes allotted"`) so
  the mono numeral is announced with its label and unit. The time KPI announces
  minutes/seconds, not the raw `mm:ss` glyphs.
- **Contrast:** all text/background pairs use semantic tokens meeting WCAG AA
  (4.5:1 body, 3:1 large/UI). Pass/fail, difficulty, and time-overrun colors are
  always paired with an icon + label; chart colors meet 3:1 against `bg.surface`
  and are distinguishable by position/label, not hue alone. The auto-submit
  callout pairs `status.warning` with an icon + text.
- **Reduced motion:** `prefers-reduced-motion` disables the staggered `FadeIn`,
  the chart/`TimerBar` grow-in, the class/test-switch crossfade, and hover
  elevation transitions — content renders immediately.
- **Live regions:** report generation uses a polite live region ("Preparing your
  report…", then "Report ready") so screen-reader users hear progress; hard load
  failures use `role="alert"` (`ErrorState`); empty states do not.

---

## 10. Web↔mobile divergence (RN parity)

Component names/props match 1:1 between `shared-ui` (web) and `ui-native`
(mobile) per FOUNDATION §6; only the renderer differs. The same headless hooks
(`classes.list`, `spaces.list`/`storyPoints.list`, the `testSessions.*`
aggregate read, `analytics.getSummary`, `generateReport`) over
`@levelup/api-client` power both.

- **Shell:** web `Sidebar` + `Topbar`; RN header + `Tabbar`. Tenant switcher is
  a sheet/`Drawer` on RN.
- **Pickers:** web `Combobox` dropdowns → RN bottom-sheet pickers (searchable
  lists), with the same dependent class→test behavior, the same
  `test`/`timed_test`/`quiz` filter, and the same
  `?classId/spaceId/storyPointId` deep link via `react-navigation` params.
- **Tables → stacked cards:** the question and first-vs-latest `DataTable`s
  become stacked cards on RN (FOUNDATION §6), each card showing the same fields
  with the sort affordance moved to a sort control above the list.
- **Charts & TimerBar:** `ScoreDistribution`/`SimpleBarChart` and the static
  `TimerBar` context have native equivalents; tooltips become press-to-reveal on
  RN (hover → press). The `TimerBar` remains static/read-only on both platforms
  (no live countdown anywhere on this screen).
- **No ⌘K on mobile:** `CommandPalette` is web-only; RN gets a header search
  affordance.
- **Report:** web opens the signed PDF URL in a new tab / downloads; RN opens it
  via the system viewer / share sheet from the same `generateReport` response.
- **Motion:** web `FadeIn`/`ease.entrance`; RN Reanimated equivalents for
  entrance only — still no celebratory burst on this staff surface.

---

## 11. A Claude-design prompt

```text
You are generating the **Class Test Analytics** screen for the Auto-LevelUp teacher-web portal.
Conform EXACTLY to the "Lyceum / Modern Scholarly" design system in
docs/rebuild-spec/design/00-FOUNDATION.md and to this spec
(docs/rebuild-spec/design/teacher/class-test-analytics.md). Do NOT invent colors, fonts, spacing,
radius, elevation, or component variants — compose only from FOUNDATION tokens and the shared-ui
inventory, citing semantic names (bg.canvas, bg.surface, text.primary/secondary/muted,
brand.primary, status.success/warning/error, border.subtle/strong/focus, spark). Fonts: Fraunces
(display/h1), Schibsted Grotesk (UI/body), Spline Sans Mono (all numerics, times, percentages).
Radius lg on cards, md on buttons/inputs; elevation e1 at rest, e2 on hover; spark glow only on the
primary CTA.

ROUTE: /analytics/tests  ROLES: teacher (own classes only) | tenantAdmin (all classes).
TONE: precise, credible, calm — a staff reporting console for IN-SPACE timed tests & quizzes. NO
XP/streak/celebration chrome; status color always paired with an icon/label.

CRITICAL DISTINCTION: this screen analyzes the test/timed_test/quiz STORY POINTS authored inside
learning SPACES (attempted via the server-authoritative student test runtime), aggregated from
testSessions.* — NOT the formal AutoGrade exam flow. Make this explicit in a subline that links to
Exam analytics. The test clock is enforced server-side; this screen only DISPLAYS time usage and
never runs a countdown.

BUILD a responsive screen inside the AppShell/PlatformLayout main region (max-w 1200, desktop
gutter 32, section gap 32), in this order:
1. Header: Fraunces h1 "Test analytics"; a control row with a searchable Combobox CLASS picker and a
   dependent Combobox TEST picker (listing ONLY test/timed_test/quiz story points in spaces assigned
   to the class, each labeled timed mm:ss or untimed), left-aligned; a right-aligned spark Button
   "Generate report". Subline (text.secondary/muted): "{Space} › {Test title} · Timed mm:ss · {n} in
   class · Computed {relative}". Second quiet line: "In-space tests & quizzes — for formal exam
   results, see Exam analytics →".
2. KPI strip — four Stat/KPI cards (mono values): "Attempted" ({uniqueAttemptees}/{cohortSize},
   caption "{attemptCount} attempts total"), "Completion" ({completionRate}%), "Average score"
   ({avgScorePct}%, caption "median {medianScorePct}%"), "Median time" ({mm:ss}/{mm:ss}, caption
   "used / allotted"). Grid 1→2→4 at sm/md/lg. (Untimed test → the time KPI drops its denominator.)
3. Two-column charts (lg:grid-cols-2, stacks sm/md): LEFT "Score distribution" Card with a
   ScoreDistribution/SimpleBarChart histogram over scoreDistribution.buckets ({min,max,count}) with a
   pass-mark guide line when defined; RIGHT "Time usage" Card (TIMED TESTS ONLY — omit for untimed)
   with a STATIC read-only TimerBar showing median/avg used vs allotted, a SimpleBarChart over
   time-used-% buckets, and a status.warning callout "{n} attempts hit the time limit and were
   auto-submitted." Never run a live countdown.
4. "Question breakdown" Card: a DataTable of per-item rows: # · Question (TRUNCATED PROMPT ONLY,
   never the answer key) · Attempts · Avg % · Difficulty (ProgressBar + index) · Common mistakes
   (Chips).
5. "Retakes & completion" Card: a small Stat row (re-attempt rate, avg attempts/student, avg score
   change on retake — last shown only when meaningful), a segmented completion ProgressBar
   (Completed / Started-not-finished / Not attempted) with legend, and a compact DataTable of
   first-vs-latest attempt (Avg score, Completion).
6. Quiet footer link: "Edit this test or its time limit? Open it in Spaces →" (links to the SPACES
   area; this screen never authors or administers).

DATA (read-only; never recompute on client): classes.list (server-scoped to caller's classIds with
15-class overflow fallback for teacher, all for tenantAdmin); spaces.list + storyPoints.list filtered
to type in {test,timed_test,quiz} and assigned to the class; testSessions.* aggregate per (class,
storyPoint): attemptCount, uniqueAttemptees, completionRate, avg/median scorePct,
scoreDistribution.buckets, timeUsage{avgSeconds, medianSeconds, allottedSeconds, autoSubmittedCount,
timeUsedPctBuckets}, questionBreakdown[{avgPct, difficultyIndex, attemptCount, commonMistakes}],
retake{reattemptRate, avgAttemptsPerStudent, scoreImprovementAvg}, firstVsLatestAttempt, computedAt;
analytics.getSummary(scope:'class') for cohort size + at-risk (read-only, surfaced via AtRiskBadge).
tenantId is derived server-side from claims — never a field. The ONLY write is "Generate report" →
v1.analytics.generateReport({ type:'class', classId, spaceId, storyPointId }) returning a signed
pdfUrl. Selection lives in URL params ?classId/spaceId/storyPointId.

STATES: Skeleton silhouette on load; region EmptyState "No tests for this class yet" → "Open Spaces";
in-view EmptyState "No attempts yet" when attemptCount===0; "Results are still being computed" with
Refresh on aggregation lag; distinct ErrorState with Retry; report shows progress + success/failure
Toasts and opens the signed PDF. OMIT the Time-usage card for untimed quizzes; HIDE stubbed metrics
(discrimination, topic performance, retake improvement when no re-attempt population) rather than show
a zero. For a teacher lacking report permission, OMIT the Generate report button (do not disable).

MOTION: staggered FadeIn (ease.entrance, base 220ms) header→KPIs→charts→tables; class/test-switch
crossfade; chart bars and TimerBar grow-in once on first paint (TimerBar is STATIC — never ticks);
card hover e1→e2 over fast 160ms; honor prefers-reduced-motion. No count-up on numerals. No
celebratory motion.

A11y: SkipToContent; focus order matching visual order; both Combobox pickers fully keyboard-operable
(test picker disabled until a class is chosen); sortable DataTable headers; charts and TimerBar have
per-bar/segment aria-labels and the question table is the accessible equivalent; completion bar
exposes labeled segment values; KPIs as labeled groups with units (announce minutes/seconds for time);
WCAG AA contrast; status never color-alone; reduced-motion honored; polite live region for report
progress, role="alert" only on hard errors.

Deliver clean React + Tailwind composing @levelup/shared-ui components (Combobox, Button, Stat/KPI,
Card, ScoreDistribution, SimpleBarChart, TimerBar, DataTable, ProgressBar, Chip, AtRiskBadge,
EmptyState, ErrorState, Skeleton, Toast, Tooltip). Every drill-in is a navigation/deep link; this
screen reads server-computed test-session analytics and exports a report — it never administers a
test, runs a clock, re-scores, or shows answer keys.
```
