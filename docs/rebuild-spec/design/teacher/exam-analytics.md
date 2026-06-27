# Exam Analytics

> Post-exam performance analysis for staff — pick a **released** exam, then read
> its precomputed analytics: avg/median/pass-rate KPIs, a score-distribution
> histogram, an A–F grade distribution, a per-question difficulty table, and a
> per-class breakdown. A calm, credible reporting console: it _reads
> server-computed `examAnalytics`_ and lets the teacher export a class-summary
> report. It never grades, never re-scores, and never shows answer keys —
> grading lives in the EXAMS area and is linked out.

**Route** `/analytics/exams` · **Roles** `teacher` (own classes only) ·
`tenantAdmin` (all classes) · **Primary APIs** `exams.list` / `exams.get`
(released exams) · `analytics.*` reading `examAnalytics/{examId}`
(`useExamAnalytics`) · `v1.analytics.generateReport` (`type: 'exam-result'`,
class summary)

This spec conforms to `design/00-FOUNDATION.md` ("Lyceum / Modern Scholarly").
All tokens, type, spacing, radius, elevation, motion, and components are cited
by their FOUNDATION semantic names — no new tokens or variants are introduced.
Per FOUNDATION §1 the staff register is **precise, credible, calm**: restraint
in chrome, no XP/streak/celebration; `spark` is reserved for the single primary
CTA (Generate report), never ambient decoration.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` (sees only exams targeting classes they manage) or
a `tenantAdmin` (sees all exams in the active tenant). Both reach this surface
to understand _how an exam went_ after results are released.

**Job-to-be-done:** _"This exam is graded and released — show me how the cohort
performed, which questions were hard, and which class lagged, so I can adjust
teaching and brief students/parents."_ The screen turns the precomputed
`ExamAnalytics` document into a readable performance picture and lets the
teacher export a class-summary PDF.

**Explicitly NOT this screen's job** (FOUNDATION + domain rules):

- **Grading or re-grading.** AI/manual grading, overrides, and bulk-approve live
  in the EXAMS area (`/exams/:examId/submissions(/:submissionId)` —
  GradingReview). This screen links there; it never embeds grade controls.
- **Releasing results.** Release/visibility gating happens on Exam Detail in
  EXAMS. Analytics only _exist_ once results are released, so there is nothing
  to release here.
- **Authoring.** Question/rubric/answer-key authoring is the SPACES area. This
  screen never edits content.
- **Any client recomputation.** Avg, median, pass-rate, buckets, grades,
  difficulty, and per-class breakdown are read verbatim from
  `examAnalytics/{examId}`; the client never recomputes statistics from raw
  submissions.

**Emotional register:** professional, factual, non-celebratory. No grade is
framed as a "win" or "fail" with celebration chrome; status color is always
paired with an icon + label per FOUNDATION §2.

---

## 2. Entry points & route

**Route:** `/analytics/exams`, gated by
`RequireAuth allow={['teacher','tenantAdmin']}` (FOUNDATION §4 single
config-driven guard). Sidebar nav item under group **Analytics**
(`navMeta.group: 'Analytics'`, label "Exams").

The screen supports a deep-linked exam selection via query param `?examId=...`
(and/or `?classId=...` for the per-class focus) so attention-feed rows, the Exam
Detail page, and external links can open straight to a specific exam's
analytics. The selection is a URL param (first-class deep link, RN-nav
friendly), not just local state.

**Entry points:**

- **Analytics → Exams** sidebar item (lands on the picker, defaulting to the
  most-recently-released exam).
- **Teacher Dashboard** "results released" / exam rows →
  `/analytics/exams?examId=...`.
- **Exam Detail** (EXAMS area) "View analytics" button — present only when the
  exam is `results_released` → `/analytics/exams?examId=:examId`.
- **Class Detail** / **Class Analytics** "exam performance" links →
  `/analytics/exams?examId=...&classId=...`.
- `CommandPalette` (⌘K) "Exam analytics".

**Reads powering it** (all via `@levelup/api-client` repositories / hooks — UI
never touches Firestore; see `specs/common-api.md` §3.3):

- `exams.list` (`v1.autograde.listExams`) → the exam picker source, **filtered
  to released exams only** (`status === 'results_released'`;
  `graded`-but-not-released exams are excluded because analytics are computed on
  `results_released`). Server-scoped to `ctx.classIds` for `teacher` (15-class
  overflow fallback) and full-tenant for `tenantAdmin`. `tenantId` is derived
  from claims server-side — never a field.
- `exams.get` (`v1.autograde.getExam`) → the selected exam's metadata for the
  header: `title`, `totalMarks`, `passingMarks`, `classIds`, `status`, release
  timestamp. No questions/answer keys are read for display.
- `analytics.*` → the precomputed `ExamAnalytics` for the selected exam
  (`useExamAnalytics(tenantId, examId)`), reading
  `tenants/{tenantId}/examAnalytics/{examId}` (written by the
  `onExamResultsReleased` trigger, `status/be-analytics.md`). Shape
  (`shared-types/autograde/exam-analytics.ts`): `totalSubmissions`,
  `gradedSubmissions`, `avgScore`, `avgPercentage`, `passRate`, `medianScore`,
  `scoreDistribution.{buckets, gradeDistribution}`, `questionAnalytics{}`
  (per-question `avgScore`, `avgPercentage`, `difficultyIndex`,
  `discriminationIndex`, `commonMistakes`, `commonStrengths`),
  `classBreakdown{}` (`className`, `avgScore`, `passRate`, `submissionCount`),
  `topicPerformance{}`, `computedAt`, `lastUpdatedAt`.
- _(Class names for the breakdown come resolved on `classBreakdown[].className`;
  a `useTenantNames`-style resolver is the fallback only if a placeholder
  `className === classId` is detected, per `status/be-analytics.md` §4
  "className: classId placeholder" caveat.)_

**Writes:** exactly one — **Generate report** →
`v1.analytics.generateReport({ type: 'exam-result', examId, scope: 'class' })`,
returns `{ pdfUrl, expiresAt }` (1-hour signed Storage URL, `report` rate tier).
No other mutation is reachable from this surface; it is otherwise read-only.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (FOUNDATION §5 Navigation;
`specs/webapps-design.md` §3.1): persistent left `Sidebar` (role-driven nav),
`Topbar` (tenant switcher, ⌘K search, `NotificationBell`,
profile/`ThemeToggle`); on mobile a `Tabbar` (`MobileBottomNav`) replaces the
sidebar. This screen owns only the **main content region**. Page gutters follow
FOUNDATION §4 (mobile 16 / tablet 24 / desktop 32); max content width 1200.
Sections are separated by `gap` space-8/`32`; cards use radius `lg`, elevation
`e1` at rest / `e2` on hover; canvas `bg.canvas`, cards `bg.surface`.

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar: [tenant ▾] ……… [⌘K search] [🔔 bell] [theme] [avatar]        │
│ (nav)   ├──────────────────────────────────────────────────────────────────────┤
│         │ MAIN (max-w 1200, gutter 32)                                           │
│         │ ┌─ Page header ───────────────────────────────────────────────────┐   │
│         │ │ h1 "Exam analytics"                                              │   │
│         │ │ Exam picker (Combobox, released only) ▾   [ Generate report ]    │   │
│         │ │ selected: {Exam title} · released {date} · {classes} · computed… │   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ KPI STRIP (Stat/KPI ×4) ───────────────────────────────────────┐   │
│         │ │ ▸Avg score   ▸Median   ▸Pass rate    ▸Submissions graded         │   │
│         │ │  62 / 80      64         71%           128 / 134                  │   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ 2-col region (lg) ─────────────────────────────────────────────┐   │
│         │ │ ┌ SCORE DISTRIBUTION (Card) ──────┐ ┌ GRADE DISTRIBUTION (Card) ┐│   │
│         │ │ │ ScoreDistribution / SimpleBar    │ │ A B C D F bars + GradePill││   │
│         │ │ │ histogram over score buckets     │ │ counts + % per band       ││   │
│         │ │ └──────────────────────────────────┘ └───────────────────────────┘│   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ PER-QUESTION DIFFICULTY (Card) ────────────────────────────────┐   │
│         │ │ DifficultyProgressionChart (difficulty index across Q1..Qn)      │   │
│         │ │ ──────────────────────────────────────────────────────────────  │   │
│         │ │ DataTable: # · prompt(trunc) · avg% · difficulty · [discrim.]    │   │
│         │ │            · common mistakes (chips)                             │   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ PER-CLASS BREAKDOWN (Card) ────────────────────────────────────┐   │
│         │ │ DataTable: Class · #submissions · avg score · pass rate          │   │
│         │ │            → row links to /analytics/classes?classId=…           │   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
│         │ ┌─ Footer note ───────────────────────────────────────────────────┐   │
│         │ │ "Need to review or change grades? Open this exam in Grading →"   │   │
│         │ └──────────────────────────────────────────────────────────────────┘   │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

**Region order & grid:**

1. **Page header** — Fraunces `h1` "Exam analytics"; below it a row with the
   **exam picker** (`Combobox`, released-only) on the left and the **Generate
   report** `Button` (spark variant) right-aligned (md+; wraps below on sm). A
   secondary subline (`text.secondary`) shows the selected exam's title, release
   date, targeted class names, and `computedAt`/`lastUpdatedAt` freshness in
   `text.muted`.
2. **KPI strip** — four `Stat/KPI` cards: `grid-cols-1` (sm) → `grid-cols-2`
   (md) → `grid-cols-4` (lg+). `gap` space-4/`16`. Mono numerics.
3. **Two-column charts** — `grid-cols-1` (sm/md) → `lg:grid-cols-2` (lg+). Left
   = **Score distribution** `Card`; right = **Grade distribution** `Card`. `gap`
   space-6/`24`.
4. **Per-question difficulty** `Card` — a `DifficultyProgressionChart` across
   questions, then a `DataTable` (one row per question). Full width.
5. **Per-class breakdown** `Card` — a `DataTable` (one row per targeted class),
   each row a link to that class's analytics. Full width. (Hidden when the exam
   targets a single class and the breakdown adds nothing.)
6. **Footer note** — a quiet `text.secondary` link-out to Grading in EXAMS.

**Responsive summary:**

- **sm (<768):** single column throughout; picker and Generate-report stack
  (picker full-width, button below); KPIs 1-up then 2-up; charts stacked;
  `DataTable`s render as stacked cards (FOUNDATION §6 "table on web → stacked
  cards on mobile").
- **md (768–1023):** picker left / button right; KPIs 2×2; charts stacked (2-col
  only at lg); tables scroll horizontally inside their card.
- **lg+ (≥1024):** KPIs 4-up; score/grade charts side-by-side; full tables;
  content centered within max-w 1200.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`specs/webapps-design.md`
§2.2). No new primitives.

| Region                  | Component(s)                                                                                                                                       | Notes                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell                   | `AppShell`, `Sidebar`, `Topbar`, `NotificationBell`, `CommandPalette`, `MobileBottomNav` (mobile), `SkipToContent`, `RouteAnnouncer`               | Provided by `PlatformLayout`; not rebuilt here.                                                                                                                                                              |
| Header                  | `Combobox` (exam picker, searchable, released-only), `Button` (spark variant, "Generate report"; ghost "Open in Grading"), `Breadcrumb` (optional) | Fraunces `h1`. `spark` only on the Generate-report CTA.                                                                                                                                                      |
| KPI strip               | `Stat/KPI` ×4 (`StatCard`/`ScoreCard`)                                                                                                             | Mono numerics (Spline Sans Mono). "Avg score" shows `{avgScore} / {totalMarks}`; caption `{avgPercentage}%`.                                                                                                 |
| Score distribution      | `Card`, `ScoreDistribution` (or `SimpleBarChart` fallback)                                                                                         | Histogram over `scoreDistribution.buckets` (`{min,max,count}`); pass-mark guide line at `passingMarks`.                                                                                                      |
| Grade distribution      | `Card`, `SimpleBarChart`, `GradePill` (A–F)                                                                                                        | Bars + `GradePill` labels per band from `scoreDistribution.gradeDistribution` (`Record<grade,count>`); colors from FOUNDATION grade scale (`grade.A..F`). Rendered only when `gradeDistribution` is present. |
| Per-question difficulty | `Card`, `DifficultyProgressionChart`, `DataTable`, `Chip`/`Tag`, `Tooltip`, `ProgressBar`                                                          | Chart of `difficultyIndex` across questions; table of `questionAnalytics` rows. `commonMistakes`/`commonStrengths` as chips. `discriminationIndex` column shown **only when real** (non-zero / non-stub).    |
| Per-class breakdown     | `Card`, `DataTable`, `Badge`, `ProgressBar` (pass rate)                                                                                            | Sortable rows from `classBreakdown`; each row links out to Class Analytics.                                                                                                                                  |
| Loading                 | `Skeleton`                                                                                                                                         | Matches the final layout silhouette (header + KPI + 2 charts + 2 tables).                                                                                                                                    |
| Empty / error           | `EmptyState`, `ErrorState`/`InlineAlert`                                                                                                           | Distinct empty vs error; "no released exams", "no analytics yet", and load-error variants.                                                                                                                   |
| Report feedback         | `Toast` (sonner), `LoadingOverlay`/button spinner                                                                                                  | Report generation progress + success/failure; success opens/downloads the signed PDF URL.                                                                                                                    |
| Footer                  | `Button` (ghost link to Grading), `InlineAlert` (subtle)                                                                                           | Link-out only.                                                                                                                                                                                               |

**Proposed addition — none required.** `ScoreDistribution`, `SimpleBarChart`,
`DifficultyProgressionChart`, `GradePill`, `StatCard`/`ScoreCard`, and
`DataTable` already exist in `shared-ui/charts` and `shared-ui/data`
(`specs/webapps-design.md` §2.2). The "exam picker" is the existing `Combobox`;
the per-question/per-class tables are the shared `DataTable`. No new token or
variant is introduced.

---

## 5. States

The screen has two coordinated phases — **picker** (always present) and
**analytics view** (depends on a selected exam). It is designed for partial
readiness; the picker resolves independently from the analytics document.

**Loading (skeleton).** On first mount with no cached exam list, render a
`Skeleton` for the picker row, then once an exam is selected render the full
analytics silhouette in `Skeleton`: KPI ×4 blocks, two chart cards (bar-shaped
placeholders), and two table skeletons (header + ~5 rows). The region wrapper
carries `role="status"` `aria-label="Loading exam analytics"`. Skeletons
crossfade to content over `base` (220ms) `ease.entrance`. No full-screen
spinner.

**Empty — no released exams.** When `exams.list` (released-only) returns zero,
the whole screen shows a single `EmptyState`: title "No released exams yet",
body "Exam analytics appear here once an exam is graded and its results are
released." with a ghost CTA "Go to Exams →" (`/exams`). The picker is hidden
(nothing to pick).

**Empty — exam selected but no analytics doc.** Rare race: an exam reports
`results_released` but `examAnalytics/{examId}` hasn't materialized yet (trigger
lag). Show an in-view `EmptyState`: title "Analytics are still being computed",
body "We're crunching this exam's results. This usually takes a moment after
release — check back shortly." with a ghost "Refresh" button. No fabricated
zeros are rendered.

**Empty — no submissions.** If `totalSubmissions === 0` (released but no one
submitted), KPIs render as "—" and a calm in-card `EmptyState` in each chart:
"No submissions to analyze for this exam." (factual, not alarming).

**Partial.**

- The picker and KPI strip can render while the heavier charts/tables stream in;
  each chart/table card keeps its own `Skeleton` until the analytics doc
  resolves (the doc is one read, so in practice all settle together — but the
  layout never blocks as a whole).
- **Stubbed metrics are hidden, not shown as zero** (honors
  `status/be-analytics.md` §4 "discriminationIndex/topicPerformance stubs leak
  into reports"): the **discrimination index** column appears only when at least
  one question has a real (non-zero) value; otherwise the column is omitted with
  a quiet `Tooltip`-explained note. **Topic performance** renders only when
  `topicPerformance` is non-empty; an all-empty map omits the section entirely
  rather than showing "0%".

**Error.** Distinct from empty (FOUNDATION §5 / `specs` §2.2 `ErrorState`). A
failed `exams.list` shows a page-level `ErrorState` with "Retry"; a failed
analytics read shows an in-view `ErrorState` scoped to the analytics region with
"Retry" (refetches just that query). A failed **Generate report** call surfaces
a `Toast` (`status.error`) with copy from `error.details.code`
(`specs/common-api.md` §6) and leaves the screen intact. Errors are never
rendered as empty states.

**Permission-gated variants by role:**

- **`teacher`:** the picker lists only released exams targeting their managed
  classes (server-scoped via `ctx.classIds` + overflow fallback); the per-class
  breakdown shows only their classes' rows. They never see another teacher's or
  another tenant's exam. **Generate report** is available for exams they manage
  **only if** their `TeacherPermissions` allow report generation; if not, the
  button is hidden (not disabled) and the read-only analytics remain.
- **`tenantAdmin`:** sees all released exams in the active tenant; full
  per-class breakdown across all targeted classes; Generate report always
  available. Otherwise identical layout.
- No control on this screen mutates grades or release state; the only gated
  action is report generation as above. Grade/override controls are absent for
  both roles (they live in EXAMS).

---

## 6. Interactions & motion

**Core flow (pick → read → optionally export).**

1. **Select exam** — the `Combobox` (searchable by title/class/date) updates the
   URL `?examId=...` and loads `exams.get` + `useExamAnalytics`. Selection is
   debounced; switching exams crossfades the analytics region (`base`,
   `ease.entrance`) without remounting the shell.
2. **Read the analytics** — KPIs, charts, and tables are read-only. Hovering a
   histogram bar shows a `Tooltip` with the bucket range and exact count;
   hovering a difficulty cell shows the index and (when real) discrimination.
   Sorting a `DataTable` column (avg %, difficulty, pass rate) is a pure client
   sort over the already-fetched rows — it reorders, it never recomputes the
   statistics.
3. **Drill into a class** — a per-class breakdown row links to
   `/analytics/classes?classId=...` (navigation, not inline expansion).
4. **Generate report** — clicking the spark `Button` calls
   `v1.analytics.generateReport({ type: 'exam-result', examId, scope: 'class' })`.
   The button enters a loading state (inline spinner, label "Generating…"), and
   a `Toast` confirms "Preparing your report…". On success the returned signed
   `pdfUrl` is opened in a new tab / triggers download, and a success `Toast`
   "Report ready" appears (with a "Download again" action while the 1-hour URL
   is valid). On failure, an error `Toast` with retry. This is the **one**
   mutation/side-effect on the screen.

**Motion (FOUNDATION §4 tokens, "felt not seen"):**

- Section entrance: staggered `FadeIn` `ease.entrance` over `base` (220ms),
  header → KPIs → charts → tables, ~60–100ms apart. `prefers-reduced-motion` →
  no stagger, instant render.
- Exam switch: analytics region crossfade over `base`; KPI numerals do **not**
  animate/count-up (staff register — values appear directly).
- Card hover: `e1` → `e2` + border `border.strong` over `fast` (160ms)
  `ease.standard`.
- Chart bars: a subtle grow-in on first paint (`ease.entrance`, `base`),
  disabled under reduced-motion.
- Report button: spark glow (`spark glow` elevation token) on the CTA only;
  loading spinner replaces the icon.
- **No celebratory motion.** The grade distribution and KPIs are presented
  factually; there is no marigold burst or spring pop on this staff surface
  (FOUNDATION §4 reserves that for student gamification).

**Feedback & optimistic updates:**

- This is a read surface; there are **no optimistic writes** — all numbers are
  server-authoritative and the client never mutates them.
- Report generation is **not** optimistic (it produces a real artifact): the UI
  shows genuine progress and only confirms on the server's signed-URL response.

**Confirmations:** none required — there are no destructive actions.
`CommandPalette` (⌘K) jumps to other exams/analytics; Esc closes it
(`ease.exit`).

**Refresh semantics:** React Query defaults (`refetchOnWindowFocus: false`).
`computedAt`/`lastUpdatedAt` from the analytics doc are surfaced in `text.muted`
so freshness is honest; the screen never implies live recomputation (analytics
update only when the `onExamResultsReleased` trigger re-runs server-side).

---

## 7. Content & copy

Tone: direct, professional, factual (FOUNDATION §1 staff register). Numerals in
mono.

**Header**

- h1: `Exam analytics`
- Picker placeholder: `Select a released exam…`; each option:
  `{Exam title} · released {Mon D} · {n} {class|classes}`.
- Selected subline: `{Exam title}` · `Released {Mon D, YYYY}` · `{class names}`
  · `Computed {relative}` (in `text.muted`).
- Primary CTA: `Generate report`
- Footer link-out:
  `Need to review or change grades? Open this exam in Grading →`

**KPI strip** (label · value · caption)

- `Average score` · `{avgScore} / {totalMarks}` · `{avgPercentage}%`
- `Median score` · `{medianScore} / {totalMarks}` · `mid-cohort`
- `Pass rate` · `{passRate}%` · `pass mark {passingMarks} / {totalMarks}`
- `Submissions graded` · `{gradedSubmissions} / {totalSubmissions}` ·
  `{totalSubmissions} submitted`

**Score distribution (card title):** `Score distribution`

- Subhead: `How the cohort's scores spread across the marks range.`
- Axis/Tooltip: bucket `"{min}–{max} marks"` · `"{count} students"`.
- Pass-mark guide label: `Pass mark`.
- Empty (no submissions): `No submissions to analyze for this exam.`

**Grade distribution (card title):** `Grade distribution`

- Subhead: `Students per grade band (A–F).`
- Each band labeled with a `GradePill` (`A`/`B`/`C`/`D`/`F`) + `{count}` +
  `{pct}%`.
- Rendered only when `gradeDistribution` is present; otherwise the card is
  omitted (no fabricated bands).

**Per-question difficulty (card title):** `Question difficulty`

- Subhead:
  `Lower difficulty index = harder question (fewer marks earned on average).`
- Table columns: `#` · `Question` (truncated prompt, never the answer key) ·
  `Avg %` · `Difficulty` · _(Discrimination — only when real)_ ·
  `Common mistakes`.
- Difficulty cell: a `ProgressBar` + numeric index; `Tooltip` "Difficulty index
  {x} — share of available marks earned on average."
- Discrimination header `Tooltip` (when shown): "How well this question
  separates higher- from lower-scoring students."
- `commonMistakes`/`commonStrengths` as `Chip`s.
- Empty: `No per-question data available for this exam.`

**Per-class breakdown (card title):** `By class`

- Subhead: `Performance for each class that took this exam.`
- Table columns: `Class` · `Submissions` · `Avg score` · `Pass rate`.
- Row link affordance: `View class analytics →`.
- Hidden entirely when the exam targets a single class (breakdown == overall).

**Empty / error copy**

- No released exams (page): title `No released exams yet`, body
  `Exam analytics appear here once an exam is graded and its results are released.`,
  CTA `Go to Exams →`.
- Selected, analytics not yet computed: title
  `Analytics are still being computed`, body
  `We're crunching this exam's results. This usually takes a moment after release — check back shortly.`,
  action `Refresh`.
- Load error (page/region): title `Couldn't load exam analytics`, body
  `Something went wrong fetching this data.`, action `Retry`.
- Report toasts: progress `Preparing your report…`; success `Report ready`
  (action `Download again`); failure
  `Couldn't generate the report. Please try again.`
- Report permission absent (teacher): the CTA is simply not rendered (no nag
  copy).

---

## 8. Domain rules surfaced

- **Only released exams have analytics.** The picker is filtered to
  `status === 'results_released'`; `examAnalytics/{examId}` is written by the
  `onExamResultsReleased` trigger (`status/be-analytics.md`). A
  graded-but-unreleased exam never appears here, and there is no "release"
  action on this screen (that lives on Exam Detail in EXAMS).
- **Results-release / visibility gating.** Because the screen only surfaces
  _released_ exams, it inherently honors `releaseResultsAutomatically` /
  results-released gating — it can never expose results that aren't released.
  Per-question and per-class data are aggregate cohort statistics, not
  individual student scores; individual review is in EXAMS.
- **Answer keys are never shown.** The question table shows only truncated
  **prompts** and aggregate metrics; answer keys live server-side (stripped from
  client reads, `firestore.rules` answer-key deny + `getItemForEdit` merge).
  This screen never requests or renders them.
- **Server-authoritative statistics — no client recompute.** Avg, median, pass
  rate, score buckets, grade distribution, difficulty, discrimination, and
  per-class breakdown are read verbatim from the precomputed `ExamAnalytics`
  doc. The client only sorts/filters the already-computed rows for display; it
  never derives statistics from raw submissions.
- **Stubbed metrics surface only when real.** `discriminationIndex` (and
  `topicPerformance`) are known to be stubbed at `0`/empty server-side
  (`status/be-analytics.md` §4). This screen **omits** those columns/sections
  unless real (non-zero / non-empty) values are present — it never displays a
  stub zero as truth.
- **Tenant isolation.** Everything is scoped to the caller's active tenant;
  `tenantId` is derived from claims server-side, never a field, never shown.
  Switching tenants (Topbar) reloads the picker and clears the selection.
- **Role-scoped exam visibility.** A `teacher` sees only exams targeting classes
  in their claim `classIds` / `managedClassIds` (15-class JWT cap with
  `classIdsOverflow` Firestore fallback, `status/auth-access.md` §1.3); a
  `tenantAdmin` sees all. The per-class breakdown reflects this scope — no class
  the caller can't access ever appears.
- **Reads via repositories, the one write via callable.** All reads go through
  `@levelup/api-client` (`exams.*`, `analytics.*`); the only write — report
  generation — goes through `v1.analytics.generateReport`. No direct client
  Firestore reads or writes (`specs/webapps-design.md` §0).
- **Operational, not grading/authoring.** Per the brief, this screen analyzes
  and exports; grading is linked out to EXAMS, authoring to SPACES. It never
  embeds those.

---

## 9. Accessibility

Conforms to FOUNDATION §2 (contrast) and §4 (reduced-motion), and
`specs/webapps-design.md` §2.4.

- **Landmarks & focus order:** `SkipToContent` first; then `Topbar`, `Sidebar`,
  then `main`. Within `main`, DOM/focus order = exam picker (`Combobox`) →
  Generate report → KPI cards → score chart → grade chart → question table
  (header → rows) → class table (header → rows) → Grading link-out. Order
  matches visual order at every breakpoint.
- **Keyboard:** the `Combobox` is fully keyboard-operable (type to filter,
  Up/Down to move, Enter to select, Esc to close). Every `DataTable` column
  header is a focusable sort toggle (Enter/Space). All link rows and the report
  CTA are real focusable controls with the FOUNDATION focus ring
  (`border.focus`, `0 0 0 3px`). ⌘K opens `CommandPalette`; Esc closes it.
- **Charts are not color-only:**
  `ScoreDistribution`/`SimpleBarChart`/`DifficultyProgressionChart` expose an
  accessible text alternative — each bar/point has an `aria-label` (e.g. "40–50
  marks: 18 students") and the card includes a visually-available data summary
  (the table beside the difficulty chart _is_ the accessible equivalent).
  `GradePill` always carries the letter as text, not color alone (FOUNDATION §2
  "never encode status by color alone").
- **KPIs as labeled groups:** each `Stat/KPI` is a labeled group
  (`aria-label="Average score: 62 of 80, 78 percent"`) so the mono numeral is
  announced with its label and unit.
- **Contrast:** all text/background pairs use semantic tokens meeting WCAG AA
  (4.5:1 body, 3:1 large/UI). Grade-band and pass/fail colors are always paired
  with an icon/letter + label; chart colors meet 3:1 against `bg.surface` and
  are distinguishable by position/label, not hue alone.
- **Reduced motion:** `prefers-reduced-motion` disables the staggered `FadeIn`,
  the chart grow-in, the exam-switch crossfade, and hover elevation transitions
  — content renders immediately.
- **Live regions:** report generation uses a polite live region ("Preparing your
  report…", then "Report ready") so screen-reader users hear progress; hard load
  failures use `role="alert"` (`ErrorState`); empty states do not.

---

## 10. Web↔mobile divergence (RN parity)

Component names/props match 1:1 between `shared-ui` (web) and `ui-native`
(mobile) per FOUNDATION §6; only the renderer differs. The same headless hooks
(`exams.list`/`get`, `useExamAnalytics`, `generateReport`) over
`@levelup/api-client` power both.

- **Shell:** web `Sidebar` + `Topbar`; RN header + `Tabbar`. Tenant switcher is
  a sheet/`Drawer` on RN.
- **Exam picker:** web `Combobox` dropdown → RN a bottom-sheet picker
  (searchable list); identical released-only filtering and `?examId` deep link
  via `react-navigation` params.
- **Tables → stacked cards:** the per-question and per-class `DataTable`s become
  stacked cards on RN (FOUNDATION §6 "table on web → stacked cards on mobile"),
  each card showing the same fields with the same sort affordance moved to a
  sort control above the list.
- **Charts:** `ScoreDistribution`/`SimpleBarChart`/`DifficultyProgressionChart`
  have native chart equivalents; the accessible text summary/tooltips become
  press-to-reveal on RN (hover → press).
- **No ⌘K on mobile:** `CommandPalette` is web-only; RN gets a header search
  affordance.
- **Report:** web opens the signed PDF URL in a new tab / downloads; RN opens it
  via the system viewer / share sheet from the same `generateReport` response.
- **Motion:** web `FadeIn`/`ease.entrance`; RN Reanimated equivalents for
  entrance only — still no celebratory burst on this staff surface.

---

## 11. A Claude-design prompt

```text
You are generating the **Exam Analytics** screen for the Auto-LevelUp teacher-web portal.
Conform EXACTLY to the "Lyceum / Modern Scholarly" design system in
docs/rebuild-spec/design/00-FOUNDATION.md and to this spec
(docs/rebuild-spec/design/teacher/exam-analytics.md). Do NOT invent colors, fonts, spacing,
radius, elevation, or component variants — compose only from FOUNDATION tokens and the
shared-ui inventory, citing semantic names (bg.canvas, bg.surface, text.primary/secondary/
muted, brand.primary, status.success/warning/error, border.subtle/strong/focus, spark, and
the grade scale grade.A..grade.F). Fonts: Fraunces (display/h1), Schibsted Grotesk (UI/body),
Spline Sans Mono (all numerics). Radius lg on cards, md on buttons/inputs. Elevation e1 at
rest, e2 on hover; spark glow only on the primary CTA.

ROUTE: /analytics/exams  ROLES: teacher (own classes only) | tenantAdmin (all classes).
TONE: precise, credible, calm — a staff post-exam reporting console. NO XP/streak/celebration
chrome; status color always paired with an icon/letter + label.

BUILD a responsive screen inside the AppShell/PlatformLayout main region (max-w 1200, desktop
gutter 32, section gap 32), in this order:
1. Header: Fraunces h1 "Exam analytics"; a row with a searchable Combobox exam picker
   (RELEASED exams only) on the left and a right-aligned spark Button "Generate report".
   Subline (text.secondary/muted): selected exam title · "Released {date}" · class names ·
   "Computed {relative}".
2. KPI strip — four Stat/KPI cards (mono values): "Average score" ({avgScore}/{totalMarks},
   caption {avgPercentage}%), "Median score" ({medianScore}/{totalMarks}), "Pass rate"
   ({passRate}%, caption "pass mark {passingMarks}/{totalMarks}"), "Submissions graded"
   ({gradedSubmissions}/{totalSubmissions}). Grid 1→2→4 at sm/md/lg.
3. Two-column charts (lg:grid-cols-2, stacks sm/md): LEFT "Score distribution" Card with a
   ScoreDistribution/SimpleBarChart histogram over scoreDistribution.buckets ({min,max,count})
   with a pass-mark guide line; RIGHT "Grade distribution" Card with SimpleBarChart + GradePill
   labels (A–F) from scoreDistribution.gradeDistribution (render only if present).
4. "Question difficulty" Card: a DifficultyProgressionChart of difficultyIndex across questions,
   then a DataTable of questionAnalytics rows: # · Question (TRUNCATED PROMPT ONLY, never the
   answer key) · Avg % · Difficulty (ProgressBar + index) · [Discrimination — column shown ONLY
   when a real non-zero value exists] · Common mistakes (Chips).
5. "By class" Card: a DataTable from classBreakdown — Class · Submissions · Avg score · Pass
   rate; each row links to /analytics/classes?classId=…. Hide entirely when the exam targets a
   single class.
6. Quiet footer link: "Need to review or change grades? Open this exam in Grading →" (links to
   the EXAMS area; this screen never grades).

DATA (read-only; never recompute on client): exams.list filtered to status==='results_released'
(server-scoped to the caller's classIds with 15-class overflow fallback for teacher, all for
tenantAdmin); exams.get for header; analytics.* reading examAnalytics/{examId} via
useExamAnalytics (avgScore, avgPercentage, passRate, medianScore, scoreDistribution.{buckets,
gradeDistribution}, questionAnalytics{difficultyIndex, discriminationIndex, avgPercentage,
commonMistakes, commonStrengths}, classBreakdown{className, avgScore, passRate, submissionCount},
topicPerformance, computedAt, lastUpdatedAt). tenantId is derived server-side from claims —
never a field. The ONLY write is "Generate report" → v1.analytics.generateReport({ type:
'exam-result', examId, scope:'class' }) returning a signed pdfUrl.

STATES: Skeleton silhouette of the full layout on load; page-level EmptyState "No released exams
yet" → "Go to Exams"; in-view EmptyState "Analytics are still being computed" with Refresh when
the analytics doc hasn't materialized; "No submissions to analyze" when totalSubmissions===0;
distinct ErrorState with Retry; report generation shows progress + success/failure Toasts and
opens the signed PDF. HIDE stubbed metrics (discriminationIndex, topicPerformance) unless real —
never show a stub zero as truth. For a teacher lacking report permission, OMIT the Generate
report button (do not disable). Grade/override controls are absent for both roles.

MOTION: staggered FadeIn (ease.entrance, base 220ms) header→KPIs→charts→tables; exam-switch
crossfade; chart bars grow-in on first paint; card hover e1→e2 over fast 160ms; honor
prefers-reduced-motion (no stagger/animation). No count-up on numerals. No celebratory motion.

A11y: SkipToContent; focus order matching visual order; Combobox fully keyboard-operable; sortable
DataTable headers; charts have per-bar aria-labels and the adjacent table is the accessible
equivalent; GradePill carries the letter as text; KPIs as labeled groups with units; WCAG AA
contrast; status never color-alone; reduced-motion honored; polite live region for report
progress, role="alert" only on hard errors.

Deliver clean React + Tailwind composing @levelup/shared-ui components (Combobox, Button,
Stat/KPI, Card, ScoreDistribution, SimpleBarChart, DifficultyProgressionChart, GradePill,
DataTable, Chip, ProgressBar, EmptyState, ErrorState, Skeleton, Toast, Tooltip). Every drill-in
is a navigation/deep link; this screen reads server-computed analytics and exports a report — it
never grades, re-scores, releases results, or shows answer keys.
```
