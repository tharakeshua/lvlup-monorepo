# Exam Analytics & Results

_Post-grading analytics dashboard that turns an exam's graded submissions into
class-, question-, and topic-level insight — KPIs, score/grade distributions,
item analysis, and at-risk signals — so teachers can act on results and admins
can compare exams across the program._

---

## 1. Purpose & primary user

**Primary user — Teacher (exam owner).** Job-to-be-done: _"My exam is graded;
tell me how the class did, which questions worked, which students/topics are at
risk, and give me something I can share."_ They need to read distributions at a
glance, drill into weak questions, and export a report for a department head or
parent meeting.

**Secondary user — Admin / Program lead.** Job-to-be-done: _"Compare exams
across classes and sessions; find systematically broken items (poor
discriminators) and topic-level gaps."_ Reached via the cross-exam route
`/analytics/exams`.

This screen is **read-only and trigger-computed** — it never grades or mutates
submissions. It surfaces the `ExamAnalytics` document that backend triggers
recompute as grading completes and results are released. The teacher's _job_
here is sense-making and decision-making, not data entry.

---

## 2. Entry points & route

**Routes**

- `/exams/:examId` → **Analytics** tab (per-exam, alongside Questions /
  Submissions / Settings). Default landing when `status` is `completed` or
  `results_released`.
- `/analytics/exams` → cross-exam analytics index (pick an exam, then the same
  per-exam panels render inline or link through).

**Entry points**

- Exam detail status actions: after grading reaches `grading_complete` →
  `ready_for_review`, an "View analytics" affordance appears.
- Sidebar → Analytics → Exams.
- CommandPalette (⌘K): "Analytics: <exam title>".
- Deep link from an `InsightCard` elsewhere (e.g. nightly at-risk insight
  referencing this exam).

**Common-API reads (live repos — all tenant-scoped)**

- `examAnalytics` repo / `examAnalytics` collection → the `ExamAnalytics` doc
  (KPIs, `scoreDistribution`, `questionAnalytics`, `classBreakdown`,
  `topicPerformance`). Trigger-computed; may be absent → empty state.
- `exams.get(examId)` → `Exam` for header context: `title`, `subject`,
  `topics[]`, `totalMarks`, `passingMarks`, `status`, `stats`,
  `linkedSpaceTitle`.
- `submissions.listLive(examId)` → only to reconcile counts / show "N
  submissions still grading" partial banner; not the primary data source.
- Question labels resolved from the `questions/` subcollection
  (`ExamQuestion.text`, `order`, `maxMarks`) to render the per-question table
  with human text rather than raw `questionId`.

**Writes**

- `generateReport` / **Export** — produces a shareable PDF/CSV from the current
  `ExamAnalytics` snapshot. No domain mutation. (If `generateReport` is not yet
  a callable, Export is a client-side render of the loaded analytics + exam
  header.)
- No `saveExam` / `gradeQuestion` calls originate here — those live on
  Submissions / GradingReview.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). Content max width 1200; page
gutters desktop 32 / tablet 24 / mobile 16.

### lg (≥1024) — per-exam Analytics tab

```
┌ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · ⌘K · notifications · profile)            │
│         ├──────────────────────────────────────────────────────────────────┤
│         │ Breadcrumb: Exams / {title}                                        │
│         │ ┌ Exam header (Fraunces title · subject Chip · status Badge) ───┐  │
│         │ │ {Exam.title}        [ Export report ▼ ] [ Open submissions → ]│  │
│         │ └──────────────────────────────────────────────────────────────┘  │
│         │ [ Tabs: Questions · Submissions · Analytics(active) · Settings ]  │
│         │                                                                    │
│         │ ┌ KPI row — 6 Stat/KPI cards (mono numerics) ──────────────────┐  │
│         │ │ Submissions │ Graded │ Avg score │ Avg % │ Pass rate │ Median │  │
│         │ │  142 / 150  │  142   │  31.8/50  │ 63.6% │  71.1% ▲  │  33.0  │  │
│         │ └──────────────────────────────────────────────────────────────┘  │
│         │ ┌ Distribution row (grid 12 → 7 / 5) ──────────────────────────┐  │
│         │ │ Score distribution (histogram, buckets)  │ Grade distribution │  │
│         │ │  ▁▃▅█▇▅▂   colored by grade band         │ A B C D F donut/bar│  │
│         │ └──────────────────────────────────────────────────────────────┘  │
│         │ ┌ InsightCard strip (0–3) ─────────────────────────────────────┐  │
│         │ │ ⚠ Q7 is a poor discriminator (idx 0.04) — review item.       │  │
│         │ └──────────────────────────────────────────────────────────────┘  │
│         │ ┌ Per-question analysis (DataTable, sortable) ─────────────────┐  │
│         │ │ # │ Question        │ Avg │ Avg% │ Difficulty │ Discrim │ ⚑  │  │
│         │ │ 1 │ Define entropy… │ 4.2 │ 84%  │ ▓▓▓▓░ easy │ 0.41    │    │  │
│         │ │ 7 │ Derive the…     │ 1.1 │ 22%  │ ▓░░░░ hard │ 0.04 ⚠  │ ⚑  │  │
│         │ │   ▸ expand → commonMistakes[] · commonStrengths[]            │  │
│         │ └──────────────────────────────────────────────────────────────┘  │
│         │ ┌ Class breakdown (Card) ──────┐ ┌ Topic performance (Card) ──┐ │  │
│         │ │ DataTable: class · avg ·     │ │ topic · avg% · weak count  │ │  │
│         │ │ pass% · count                │ │ Calculus  41% · 18 AtRisk  │ │  │
│         │ └──────────────────────────────┘ └────────────────────────────┘ │  │
└─────────┴────────────────────────────────────────────────────────────────────┘
```

### md (768–1023)

- KPI row wraps 6 → 3×2.
- Distribution row stacks: Score histogram full width, Grade distribution below.
- Class breakdown and Topic performance stack to single column.
- Per-question DataTable keeps columns but horizontally scrolls within its Card;
  flag (`⚑`) and Discrimination pinned.

### sm (≤767) — mobile-first

- KPI cards → 2-wide grid (Submissions/Graded/Pass rate prioritized first),
  remainder scroll.
- All charts full width; histogram becomes a vertical bar list if width < bucket
  count threshold.
- Per-question DataTable → stacked **Cards** (one card per question: text, Avg%,
  ProgressBar difficulty, Discrimination chip, expandable mistakes/strengths).
- Class/Topic tables → stacked Cards. Export moves into an overflow IconButton
  menu in the header.

### `/analytics/exams` index

- Top: Section with exam picker (Combobox over `exams.list`, filterable by
  class/session/status≥`completed`) + summary KPI strip for the selected exam.
- Below: the identical per-exam panel set, read-only. A "compare" secondary
  affordance is reserved for a future iteration (out of scope here).

---

## 4. Components used (Lyceum inventory)

**Navigation / shell:** AppShell, Sidebar, Topbar, Breadcrumb, Tabs
(Questions/Submissions/Analytics/Settings), CommandPalette (entry only).

**Containers:** Card (each chart/table region), Panel (page region wrapper),
Section (`/analytics/exams` groups), Accordion (per-question expand for
mistakes/strengths — or DataTable row expansion).

**Data:** Stat/KPI (the 6 headline metrics, **Spline Sans Mono** numerics),
DataTable (per-question, class, topic — sort/filter/paginate), DefinitionList
(KPI deltas / metric definitions in tooltips), Badge (status, grade band),
Chip/Tag (subject, difficulty band, discrimination quality), ProgressBar
(difficultyIndex per row), Pagination (long question/class lists), Skeleton
(loading), EmptyState (no analytics yet).

**Domain components:** GradePill (grade band cells, `grade.A–F`), AtRiskBadge
(topicPerformance `weakStudentCount` > 0), InsightCard (auto-generated callouts,
e.g. poor discriminator / low pass rate), ResultSummary (compact exam-level
recap in header / export preview). ConfidenceBadge is **not** used here
(confidence routing is a grading-time concern; analytics is post-release).

**Feedback:** Toast (sonner) for export success/failure, InlineAlert/Banner
(partial: "N submissions still grading"; stale analytics), LoadingOverlay
(export generation), Tooltip (metric definitions: difficultyIndex,
discriminationIndex).

**Charts — proposed additions (justified).** The inventory has no chart
primitive. Propose two thin, token-bound chart components rather than pulling an
opinionated library theme:

- **`DistributionChart`** — vertical bar histogram over
  `scoreDistribution.buckets[]`. Bars colored by the grade band each bucket
  falls into (`grade.A–F`); axis/gridlines use `border.subtle`, labels
  `text.secondary`, numerics mono. Hover/press → Tooltip with bucket range +
  count.
- **`GradeDistributionChart`** — horizontal stacked bar (or 5-segment donut)
  over `gradeDistribution`, one segment per grade using `grade.A/B/C/D/F`.
  Always paired with a legend listing grade + count + % (never color-only).

Both MUST consume Lyceum semantic/domain tokens only, respect
`prefers-reduced-motion` (no entrance sweep when set), and degrade to an
accessible data table behind a "View as table" toggle.

---

## 5. States

**Loading (skeleton).** AppShell + header render immediately from `exams.get`.
KPI row → 6 Stat Skeletons; charts → rectangular Skeleton blocks at chart
aspect; tables → Skeleton rows (5). No layout shift on resolve (reserve
heights).

**Empty — analytics not yet computed.** `ExamAnalytics` doc absent or
`gradedSubmissions === 0`. Center **EmptyState** (Fraunces title): _"Analytics
aren't ready yet."_ Body explains analytics compute automatically after grading
completes and results are reviewed. Primary action routes to **Submissions**
(`/exams/:examId/submissions`). If `status` is `draft`/`published`/`grading`,
copy adapts (see §7).

**Partial.** Some but not all submissions graded, or analytics recomputing.
Render available KPIs/charts plus a top **InlineAlert/Banner**: _"{n} of {total}
submissions are still grading — numbers will update."_ Ungraded contributions
excluded from averages (state this). `medianScore`/`discriminationIndex` for
thin samples render with a "low sample" Chip and tooltip caveat.

**Error.** `examAnalytics` read fails → InlineAlert (status.error icon + label,
never color alone): _"Couldn't load analytics."_ with **Retry** (re-subscribes
the repo). Header/tabs stay usable. Export failure → Toast error, panels
untouched.

**Success.** Full dataset; all six KPIs, both charts, all three tables
populated; InsightCards present when triggers flagged issues. Deltas (e.g. pass
rate ▲ vs class/session baseline) show only when a comparison baseline exists.

**Permission / role-gated.**

- **Teacher (owner)** — full view + Export.
- **Teacher (non-owner, same tenant)** — read-only analytics; Export gated by
  tenant policy (hide if disallowed).
- **Admin** — full view + cross-exam `/analytics/exams`; may see cost/usage
  hooks elsewhere (DLQ/AI usage), not on this screen.
- **Student / Parent — NO ACCESS.** This route is teacher-web only. Even
  post-release, students see _their own_ `ResultSummary`, never class
  distributions, `questionAnalytics`, or `commonMistakes[]` aggregates. Model
  answers / rubric guidance never appear here regardless of role.

---

## 6. Interactions & motion

**Page entry.** Panels fade+rise on mount, **base 220ms**, `ease.entrance`,
staggered ~40ms (KPI row → charts → tables). Charts bars grow from baseline on
first paint only, **slow 320ms** `ease.standard`. All entrance motion suppressed
under `prefers-reduced-motion` (render final state).

**KPI hover/focus.** Stat cards lift to **e2** on hover (**fast 160ms**); focus
shows the indigo focus ring. Tooltip on the metric label defines it (e.g.
_"Discrimination index: correlation between item score and total score; <0.1
flags a weak item."_), **instant 100ms** open.

**Per-question table.**

- Sort by any column (default: `order`; common re-sorts: Avg% ascending to
  surface hardest, Discrimination ascending to surface broken items). Sort
  indicator + `aria-sort`.
- Row click / Enter → expand (Accordion/row expansion, **base 220ms**
  `ease.standard`) revealing `commonMistakes[]` and `commonStrengths[]` as two
  labeled lists.
- Poor-discriminator rows (`discriminationIndex < 0.1`, e.g. ⚠) get a
  status.warning flag chip + tooltip; never color-only.

**Charts.** Hover/press a bar → Tooltip (bucket range + count + % of cohort), no
chart mutation. "View as table" toggle swaps chart ↔ DataTable, **fast 160ms**
crossfade.

**Export / generateReport.** Click **Export report ▼** → menu (PDF report / CSV
data). On select: button enters loading, **LoadingOverlay** if server-rendered;
on success → **Toast** (_"Report ready"_) with download; on failure → Toast
error + Retry. No optimistic UI — export reflects the loaded snapshot only.

**Live updates.** Repos are live; if `ExamAnalytics` recomputes (more grading
lands), values update in place with a brief **fast 160ms** highlight on changed
Stat cards (suppressed under reduced-motion). The partial banner clears
automatically when `gradedSubmissions === totalSubmissions`.

**No celebratory motion.** This is staff analytics — the single spring+marigold
burst is reserved for student gamification and is never used here.

---

## 7. Content & copy

Tone: **precise, staff-facing**, neutral. Numbers are mono and exact; prose is
short.

**Header:** `{Exam.title}` (Fraunces). Subject as Chip, status as Badge
("Results released" / "Completed" / "Grading"). Secondary: _"Open submissions"_,
_"Export report"_.

**KPI labels (exact):** "Submissions" (`{graded}/{total}` style for graded
coverage), "Graded", "Avg score" (`avgScore`/`totalMarks`), "Avg %"
(`avgPercentage`), "Pass rate" (`passRate`, with `passingMarks` in tooltip),
"Median" (`medianScore`).

**Chart titles:** "Score distribution" (sub: _"by marks, {bucketCount} bands"_),
"Grade distribution".

**Per-question table headers:** "#", "Question", "Avg", "Avg %", "Difficulty",
"Discrimination", "" (flag). Empty-cell fallback "—". Expanded sections: "Common
mistakes", "Common strengths".

**Class breakdown headers:** "Class", "Avg score", "Pass rate", "Submissions".
**Topic performance headers:** "Topic", "Avg %", "At-risk students" (AtRiskBadge
with `weakStudentCount`).

**Empty state (no analytics):** title _"Analytics aren't ready yet."_ — body:
_"Class analytics are computed automatically once submissions are graded and
results are reviewed. Head to Submissions to check grading progress."_ CTA: _"Go
to submissions"_.

- If `status === 'draft' | 'published'`: _"No submissions have been graded for
  this exam yet."_
- If `status === 'grading'`: _"Grading is in progress — analytics will appear as
  submissions complete."_

**Partial banner:** _"{n} of {total} submissions are still grading. Averages
exclude ungraded work and will update automatically."_

**Error copy:** _"Couldn't load analytics. Check your connection and retry."_
(Retry button.)

**Insight examples (InsightCard):** _"Q7 is a poor discriminator (0.04). High
and low scorers performed similarly — consider revising or dropping this item."_
/ _"Pass rate (52%) is below this class's session average. The {topic} questions
drove most lost marks."_

**Metric definition tooltips:** difficultyIndex (_"proportion of available marks
earned; lower = harder"_), discriminationIndex (_"how well the item separates
strong and weak students; <0.1 is weak"_).

---

## 8. Domain rules surfaced

- **Answer keys / model answers never appear.** `UnifiedRubric.modelAnswer`,
  `holisticGuidance`, `evaluatorGuidance` are grading-internal and are **never**
  rendered on analytics — and certainly never reachable by students.
  AnswerKeyLock semantics hold platform-wide.
- **No student/parent access.** Aggregate distributions, `questionAnalytics`,
  `commonMistakes[]` are teacher/admin only. Students get their own
  `ResultSummary` post-release elsewhere; release gating (`resultsReleased` /
  `releaseResultsAutomatically`) controls _that_, not this screen.
- **Tenant isolation on every read.** `examAnalytics`, `exams`, `submissions`,
  `questions` are all tenant-scoped; region asia-south1; no cross-tenant
  aggregation, including on `/analytics/exams`.
- **Trigger-computed, server-authoritative.** `ExamAnalytics` is written by
  backend triggers (on-submission-graded / on-exam-results-released); the client
  never computes or writes these numbers. Stale/absent docs are surfaced
  honestly (empty/partial), not fabricated client-side.
- **Confidence routing is upstream.** Analytics reflects _finalized_ scores
  including any `manualOverride` (override uses `score`, retaining
  `originalScore` for audit). Confidence/needs-review live in grading, not here
  — so `ConfidenceBadge` is intentionally absent.
- **Post-publish locks.** `POST_PUBLISH_LOCKED_FIELDS` (via `saveExam`)
  constrain edits elsewhere; this read-only screen never edits the exam, but the
  header reflects locked, published state accurately.
- **Override audit integrity.** Where a question's average reflects overrides,
  the underlying audit trail (OverrideTimeline) lives on GradingReview;
  analytics shows the resulting numbers only.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → header actions (Export, Open submissions) → Tabs
  → KPI cards (left→right) → chart "View as table" toggles → per-question table
  (header sort buttons → rows → row-expand) → class table → topic table. Logical
  and linear.
- **Keyboard:** Tabs via arrow keys + Home/End (Radix Tabs pattern). DataTable:
  sortable headers are buttons (Enter/Space toggles, `aria-sort` reflects
  state); rows expandable via Enter/Space with `aria-expanded`. Export menu
  fully keyboard-operable; Esc closes. All targets ≥44px touch.
- **Charts:** each chart has an accessible name + summary (`aria-label`
  describing distribution), a visually-hidden data table equivalent, and the
  explicit "View as table" toggle. Bars are not the sole information channel.
- **Color is never the only signal:** grade bands pair color with letter label
  (GradePill) + value; difficulty pairs ProgressBar with band text ("hard");
  discrimination flag pairs warning color with icon + "weak" label; at-risk
  pairs AtRiskBadge color with count + label. All pairs meet WCAG AA (4.5:1
  body, 3:1 large/UI).
- **Live regions:** partial/recompute updates announced via
  `aria-live="polite"`; export status via Toast with `role="status"`. Avoid
  noisy announcements on every micro-update.
- **Reduced motion:** `prefers-reduced-motion` removes entrance stagger,
  bar-grow, and change-highlight; final states render instantly.
  Tooltips/expansions appear without transform.
- **Typography:** numerics in Spline Sans Mono (tabular alignment); headings
  Fraunces; labels/tables Schibsted Grotesk. Caption-size text uses +0.01em
  tracking.

---

## 10. Web ↔ mobile divergence

| Concern                           | teacher-web (today)                     | future RN / scanner-web                                                            |
| --------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| Per-question / class / topic data | DataTable, sortable columns, row-expand | Stacked SubmissionCard-style Cards; sort via a Select; expand via press/disclosure |
| Charts                            | Hover Tooltips; "View as table" toggle  | Press-and-hold for bucket detail; table view default-friendly on narrow screens    |
| KPI row                           | 6 cards in a row                        | 2-wide grid, horizontal-scroll remainder                                           |
| Export                            | Export menu (PDF/CSV) in header         | Overflow IconButton → share sheet; CSV may defer to web                            |
| Command palette                   | ⌘K to jump to an exam's analytics       | No ⌘K; reach via Tabbar → Analytics list                                           |
| Navigation chrome                 | Sidebar + Topbar (AppShell)             | Tabbar + RoleSwitcher; Breadcrumb collapses to back affordance                     |
| Interaction model                 | hover/focus                             | press; ≥44px targets enforced                                                      |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only
renderers differ. `DistributionChart` / `GradeDistributionChart` ship in both,
token-driven.

---

## 11. Claude-design prompt

```
You are designing the "Exam Analytics & Results" screen for Auto-LevelUp's teacher-web app.
CONFORM EXACTLY to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md):
"Modern Scholarly" — warm paper neutrals, deep indigo brand.primary, marigold spark reserved
for gamification only (NOT used here, this is staff analytics). Type: Fraunces (display/headings,
empty-state titles), Schibsted Grotesk (UI/body/labels/tables/buttons), Spline Sans Mono (ALL
numerics — KPIs, scores, percentages, indices). Use only Lyceum tokens by name (bg.canvas,
bg.surface, text.primary/secondary/muted, border.subtle/strong/focus, brand.primary,
status.success/warning/error/info, and domain scales grade.A–F, confidence.* (NOT shown here),
AtRiskBadge). Radius: cards lg, buttons/inputs md, chips pill. Elevation e1 cards / e2 hover.
Motion: base 220ms entrance stagger, fast 160ms hover, slow 320ms bar-grow; respect
prefers-reduced-motion. WCAG AA; never encode status by color alone (always icon + label).

BUILD: a read-only, trigger-computed analytics dashboard for one exam, inside AppShell
(Sidebar + Topbar + Breadcrumb), as the "Analytics" tab of /exams/:examId (also reused at
/analytics/exams). Compose ONLY from the Lyceum inventory: AppShell, Tabs, Card, Section,
Stat/KPI, DataTable, Accordion, Badge, Chip, ProgressBar, Pagination, Skeleton, EmptyState,
Tooltip, InlineAlert, Toast, plus domain GradePill, AtRiskBadge, InsightCard, ResultSummary.
Add two token-bound chart components: DistributionChart (histogram over ExamAnalytics
.scoreDistribution.buckets[], bars colored by grade band) and GradeDistributionChart
(stacked bar/donut over gradeDistribution, with a legend — never color-only). Each chart needs
a "View as table" toggle + accessible data equivalent.

SECTIONS top-to-bottom:
1) Exam header: Fraunces title, subject Chip, status Badge, "Export report" menu (PDF/CSV),
   "Open submissions" secondary button.
2) KPI row — 6 Stat/KPI (mono): Submissions (graded/total), Graded, Avg score (avgScore/totalMarks),
   Avg % (avgPercentage), Pass rate (passRate), Median (medianScore).
3) Distribution row: DistributionChart (7 cols) + GradeDistributionChart (5 cols), stack on md.
4) InsightCard strip (0–3) for flagged items (e.g. poor discriminators, low pass rate).
5) Per-question DataTable (questionAnalytics): #, Question text, Avg, Avg %, Difficulty
   (ProgressBar + band label), Discrimination (flag <0.1 with warning icon+label), expandable row
   revealing commonMistakes[] and commonStrengths[].
6) Two Cards side by side: Class breakdown (className, avgScore, passRate, submissionCount) and
   Topic performance (topic, avgPercentage, AtRiskBadge for weakStudentCount).

DATA: ExamAnalytics from the examAnalytics repo; Exam header from exams.get; question labels from
the questions/ subcollection. Read-only — no grading/override here.

STATES: loading (Skeletons, no layout shift), empty ("Analytics aren't ready yet." → Go to
submissions; copy adapts by Exam.status), partial ("{n} of {total} still grading…" InlineAlert,
averages exclude ungraded), error (InlineAlert + Retry), success (full).

DOMAIN RULES: NEVER render model answers / rubric guidance; NO student/parent access to aggregates;
tenant-isolated reads; numbers are server/trigger-computed (never client-computed); reflects
finalized scores incl. manualOverride; ConfidenceBadge intentionally absent.

RESPONSIVE: lg as above; md wraps KPIs 3×2 and stacks charts/tables; sm turns tables into stacked
Cards, KPIs into a 2-wide grid, Export into an overflow menu. Output clean React + the project's
shared-ui components and Lyceum tokens; mono for every number; AA contrast; reduced-motion safe.
```
