# Assignment Tracker

A monitoring matrix that answers one operational question across all of a
teacher's classes — _who has, and hasn't, done what_ — for both assigned
learning spaces and exams. Rows are students (or classes), columns are assigned
content, cells show server-authoritative completion / score / submission state,
with overdue called out in `status.error`. Staff tone throughout: precise,
credible, calm. Conforms to the Lyceum foundation
(`docs/rebuild-spec/design/00-FOUNDATION.md`).

> **Route** `/assignments` · **Roles** `teacher` (managed classes only) ·
> `tenantAdmin` (all classes) · **Primary APIs** `analytics.getSummary`(scope
> `class`), `progress.*`
> (`v1.levelup.getSpaceProgress`/`getStoryPointProgress`), `submissions.list`
> (`v1.autograde.listSubmissions`), `spaces.list`+`exams.list` (assigned-content
> columns), `classes.list`/`students.list` (axis labels) — **read-only screen;
> no writes.** Drill-out → `student-detail-progress` or the Exams grading area.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` running a compliance/coverage check across the
content they've assigned — confirming that every student in every managed class
has started, progressed, completed, or submitted what was due, and catching
overdue work and stalled students before they become a problem. Secondary user:
a `tenantAdmin` auditing assignment completion for any class in the tenant.

**Job to be done:** _"Show me a single grid of who has and hasn't done each
assigned space and exam, flag what's overdue, and let me jump straight to the
student or the grading queue for any cell that needs me."_

This screen is **operational monitoring, not authoring and not grading**. It
surfaces state and links out; it never edits space content (Spaces area,
`/spaces/:spaceId/edit`) and never grades submissions (Exams area,
`/exams/:examId/submissions/...`). Every figure shown is server-precomputed —
the screen reads summaries and progress, it does not recompute completion or
score on the client.

It complements `teacher-dashboard` (at-a-glance, single class or aggregate KPIs)
and `class-analytics` (distribution/trend depth). The Tracker's distinct value
is the **two-axis matrix**: content × student, with overdue derived from the
assignment window.

---

## 2. Entry points & route

**Route:** `/assignments` (`navMeta`: group **Analytics**, label **Assignment
Tracker**, icon `clipboard-list`). A first-class sidebar item; deep-linkable
with filter state encoded in the query string (`?class=&content=&status=&axis=`)
so a filtered view is shareable and restorable.

**Entry points:**

- Sidebar → Analytics ▸ Assignment Tracker.
- Dashboard "Needs attention" / "Overdue" widgets → deep-link with
  `status=overdue` (or a single content column) preselected.
- `class-detail-roster` "Assigned content" tab → "Track completion" link,
  deep-linked to `?class={classId}`.
- CommandPalette (⌘K) "Assignment tracker".

**Reads (via `@levelup/api-client` repositories / hooks — never Firestore
directly):**

- `classes.list()` → class axis labels + scope (the teacher's managed classes
  only; server-scoped).
- `students.list({ classId })` → student axis rows (resolved names, roll
  numbers).
- `spaces.list({ classId })` and `exams.list({ classId })` → the **column set**
  of assigned content (server-filtered to the class; no client-side
  `.filter(s.classIds.includes(...))`). Each carries its assignment window
  (`assignedAt`/`dueDate`/`window`) used to derive overdue.
- `analytics.getSummary({ scope: 'class', classId })` → precomputed
  `ClassProgressSummary` for aggregate counts and the per-student
  `overallScore`, `isAtRisk`/`atRiskReasons` used in the row gutter and
  class-axis rollups.
- `progress.getSpaceProgress` / `progress.getStoryPointProgress`
  (`v1.levelup.*`) → per-student space completion cells (`notStarted` /
  `inProgress` / `mastered`, plus % when partial).
- `submissions.list` (`v1.autograde.listSubmissions`, released/teacher
  projection) → per-student exam cells (`notSubmitted` / `submitted` / `grading`
  / `graded` + score), and the overdue derivation when no submission exists past
  the window.

All list endpoints use the unified `PageRequest`/`pageResponse` pagination
fragment (`common-api.md §7`). The cell grid is built server-side where possible
(a summary projection) and assembled client-side only for presentation — never
recomputed for correctness. Maps to `common-api.md §3.3`:
`v1.analytics.getSummary`,
`v1.levelup.getSpaceProgress`/`getStoryPointProgress`,
`v1.autograde.listSubmissions`, `v1.levelup.listSpaces`,
`v1.autograde.listExams`, `v1.identity` class/student reads.

**Writes:** none. This is a pure monitoring surface. The only actions navigate
elsewhere.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (sidebar + topbar). The screen
owns the main content column; gutters follow foundation page-gutter tokens
(mobile 16 / tablet 24 / desktop 32), max content width 1200 (the matrix may
exceed reading width and scroll horizontally inside its own container).

```
AppShell ── Sidebar (Analytics ▸ Assignment Tracker active) ── Topbar (tenant switcher · ⌘K · bell · profile)
└── Main (PageTransition, RouteAnnouncer)
    ┌──────────────────────────────────────────────────────────────────────┐
    │ HEADER (Section, card-less band)                                       │
    │  Assignment Tracker                              [ Export CSV ] (ghost)│  Fraunces 2xl title
    │  Who has — and hasn't — done what, across your classes.                │  text.secondary sub
    ├──────────────────────────────────────────────────────────────────────┤
    │ FILTER BAR (sticky, Panel)                                             │
    │  [Class ▾]  [Content ▾]  [Status ▾]   Axis: ( Students | Classes )     │  Select × Toggle group
    │  [Search students/content]                  Showing 28 of 31 · Clear   │  Input + count + reset
    ├──────────────────────────────────────────────────────────────────────┤
    │ LEGEND (inline, always visible)                                        │
    │  ● Not started  ◐ In progress  ✓ Mastered   ◇ Submitted  ⬚ Graded      │  icon+label chips
    │  ⚠ Overdue (status.error)                              [score key →]   │
    ├──────────────────────────────────────────────────────────────────────┤
    │ MATRIX  (ClassHeatmap; horizontal scroll within container)            │
    │                ┌── Spaces ──┐ ┌──── Exams ────┐                        │
    │  Student     │ Algebra  Cells │ Midterm  Unit-3 │  Row rollup          │  sticky col-1 + col-groups
    │  Aanya Rao   │   ✓       ◐    │   ⬚ 84%   ◇      │  6/7 ·  —            │  cell = icon+label+state
    │  Dev Kumar   │   ●       ●    │   ⚠       ⬚ 41%  │  2/7 · ⚠ At risk     │  AtRiskBadge in gutter
    │  Mira Shah   │   ✓       ✓    │   ⬚ 91%   ⬚ 88%  │  7/7 ·  —            │
    │  …                                                                     │  virtualized rows
    │                              [ column rollup: 18/28 mastered · 4 overdue]│  footer summary row
    ├──────────────────────────────────────────────────────────────────────┤
    │ Pagination (students)                                                  │
    └──────────────────────────────────────────────────────────────────────┘
   Cell click → Popover (state, score, window, last activity) → "Open student" / "Open grading"
```

- **Axis toggle** flips rows between **Students** (default) and **Classes**
  (rows = the teacher's classes, cells = aggregate completion % for that class ×
  content, drill-in expands to the class's students).
- **Column groups**: assigned **Spaces** and **Exams** are grouped under
  labelled headers so space vs exam cell vocabularies don't blur.
- **Row rollup gutter** (right): `done/total` for the row + `AtRiskBadge` when
  `isAtRisk` (students axis only).
- **Footer summary row**: per-column rollup (`{mastered/submitted} of {n}` and
  overdue count).

**Responsive behavior:**

- **`lg` (≥1024):** full matrix; sticky first column (student/class name) +
  sticky header row; horizontal scroll only inside the matrix container when
  columns overflow. Filter bar on one row. Footer rollup visible.
- **`md` (768–1023):** filter bar wraps (Search drops to its own row); matrix
  keeps sticky first column and scrolls horizontally; column groups collapse
  their group labels into a tooltip when space is tight. Legend wraps to two
  rows.
- **`sm` (<768):** the matrix **does not** attempt a wide grid. It becomes a
  **grouped, stacked list**: one expandable card per student (or class), each
  listing its assigned content as rows with state chip + overdue flag + score.
  Filters move into a `Drawer/Sheet` ("Filters") triggered from a sticky
  toolbar; Status/Class/Content selects live inside. Axis toggle persists.
  Sidebar collapses to `MobileBottomNav`. Touch targets ≥44px; cell tap opens
  the same Popover content as a bottom `Sheet`.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`webapps-design.md §2.2`,
`charts` and `data` subpaths). One small addition proposed and justified.

| Region                                    | Component(s)                                                                                                                                        | Notes                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Header                                    | `Section`, `Button` (ghost "Export CSV")                                                                                                            | Export is a client-side CSV of the currently filtered matrix (no server write). |
| Filter bar                                | `Panel` (sticky), `Select`/`Combobox` (Class, Content, Status), `Switch`/segmented `Tabs` (axis toggle), `Input` (search), `Button` (ghost "Clear") | State reflected in the query string; `useDataTable`-style headless filter core. |
| Legend                                    | `Chip/Tag` + lucide icons                                                                                                                           | Every state pairs **icon + label** (never color-only).                          |
| Matrix                                    | `ClassHeatmap` (`@levelup/shared-ui/charts`) as the grid renderer; sticky first column + grouped headers                                            | Cells are state tokens, not raw colors. Rows virtualized for large classes.     |
| Cell                                      | `Badge`/`Chip` (state) + mono score (`Spline Sans Mono`) inside the heatmap cell; `Tooltip` on hover                                                | Space cells: `mastery.*`; exam cells: submission/grade state.                   |
| Score in cell                             | `GradePill` / mono numeric                                                                                                                          | Tabular figures; appears only once a score exists and is released.              |
| Overdue marker                            | `Badge` (danger, `status.error`) with `⚠` icon + "Overdue" label                                                                                    | Derived from assignment window; icon+label, never hue alone.                    |
| Row rollup gutter                         | `ProgressBar` (compact) + `AtRiskBadge`                                                                                                             | `done/total` + risk flag (students axis only).                                  |
| Cell drill                                | `Popover` (web) / `Sheet` (mobile): `DefinitionList` (state, score, window, last activity) + two `Button` links                                     | "Open student" → `student-detail-progress`; "Open grading" → Exams grading.     |
| Aggregate strip (optional, top of matrix) | `Stat`/`StatCard` ×3 (Assigned · Completed · Overdue)                                                                                               | Read-only counts from the summary.                                              |
| Pagination                                | `Pagination`                                                                                                                                        | Student-axis paging via opaque `cursor`.                                        |
| States                                    | `Skeleton`, `EmptyState`, `ErrorState`, `InlineAlert/Banner`, `Toast` (sonner)                                                                      | See §5.                                                                         |
| Drill-out                                 | `Link` + prefetch on hover (`usePrefetch`)                                                                                                          | To student detail / grading review.                                             |

**Proposed addition — `HeatmapCell` (a documented sub-part of `ClassHeatmap`,
not a new top-level component):** a single matrix cell variant that composes an
icon + state label + optional mono score + optional overdue badge, with a hover
`Tooltip` and click → `Popover`. **Justification:** `ClassHeatmapis` already in
the charts inventory but is specified at the grid level; the Tracker needs a
consistent, accessible _cell_ contract (icon+label, focusable, aria-described,
score-aware) reused across space and exam columns and across web/RN. This is an
internal anatomy clarification of an existing component, kept inside
`ClassHeatmap`, not a divergent new variant — it composes only existing
primitives (`Badge`, mono text, `Tooltip`, `Popover`).

No other additions: `Select`, `Switch`, `Input`, `Panel`, `ProgressBar`,
`AtRiskBadge`, `GradePill`, `Popover`, `Tooltip`, `StatCard`, `Pagination`,
`EmptyState`, `ErrorState` all exist. `DataTable`'s headless `useDataTable`
supplies search/filter/sort/select/paginate for the stacked (mobile /
classes-axis) views.

---

## 5. States

**Loading (skeleton):**

- Header + filter bar render immediately; Selects are disabled until
  `classes.list` resolves.
- Matrix: `ClassHeatmap` skeleton — a grid of `Skeleton` cells matching the
  resolved column count (placeholder columns until `spaces.list`/`exams.list`
  return), 6–10 skeleton rows. Sticky first column shows name-bar skeletons.
- The aggregate strip and the per-cell progress resolve **independently**
  (separate queries): columns can render before every cell's progress/submission
  state arrives — **partial** is expected and surfaced (see below).

**Empty:**

- **No classes managed:** full-region `EmptyState` — title "No classes to
  track", body "You don't manage any classes yet. Once a class is assigned to
  you, its assignments appear here." (No action — class assignment is an admin
  task.)
- **Classes exist but no content assigned:** `EmptyState` — title "Nothing
  assigned yet", body "Assign a space or exam to a class to start tracking
  completion." + `Button` "Go to Classes" → `/classes`.
- **Filtered to nothing:** in-matrix `EmptyState` — "No assignments match these
  filters." + `Button` "Clear filters". (Distinct from "nothing assigned".)

**Error:**

- **Whole-screen read failure** (e.g. `classes.list` fails): full-region
  `ErrorState` — "Couldn't load the assignment tracker." + "Retry". Distinct
  from any empty state (resolves the "errors render as empty states" gap,
  `common-api.md §6.3`).
- **Per-source partial failure** (e.g. `submissions.list` fails but space
  progress loaded): `InlineAlert/Banner` (warning) above the matrix — "Exam
  status couldn't be loaded — completion for spaces is still shown. Retry." The
  space columns stay usable; exam cells render a neutral "—" with an unavailable
  tooltip, not a false "not submitted".
- **Out-of-scope class** (teacher requests a `classId` outside their claim) →
  that class simply never appears in the Class filter; a deep-link to it
  resolves to the generic empty/error path (no existence leak; server
  `NOT_FOUND`/`PERMISSION_DENIED` surfaced identically).

**Partial:** the defining normal state of this screen.

- A cell whose progress/submission hasn't resolved shows a **neutral pending**
  glyph (mono "·") with an aria-label "Loading", **never** `notStarted` —
  absence of data must not read as a real "not started" / "safe" state.
- `overallScore` / risk pending in the gutter → score shows "—", `AtRiskBadge`
  absent (absence ≠ "not at risk"; no false-green).
- Released-gate: an exam cell where results aren't released shows
  `Submitted`/`Graded` _status_ without a _score_ (the number is withheld, not
  faked).

**Success:** populated matrix with all cells in a definite state, working
filters (reflected in URL), aggregate strip counts, footer column rollups, and
functional cell drill-down popovers.

**Permission-gated variants (by role):**

- `teacher`: Class filter and axis are pre-scoped to managed classes (claim
  `classIds`/`managedClassIds`, 15-class `classIdsOverflow` fallback resolved
  server-side). Drill-out to grading is gated by `TeacherPermissions` (a teacher
  without a grading permission sees "Open student" but not "Open grading" in the
  cell popover).
- `tenantAdmin`: all classes in the tenant available in the Class filter; same
  matrix, no scope filter.
- No role sees answer keys, grading controls, or authoring on this screen —
  those are linked out, never embedded.

---

## 6. Interactions & motion

Motion uses foundation tokens only; `prefers-reduced-motion` removes transforms
and keeps opacity ≤ `fast`. This is a staff surface — **no gamification
celebration anywhere**.

- **Page entry:** `PageTransition` fade/slide at `page` (420ms) `ease.entrance`.
- **Filter changes:** Selecting a Class/Content/Status or typing in search
  updates the URL query and re-queries the narrowest scope; the matrix
  re-renders with a `fast` (160ms) opacity cross-fade — **no layout jump** of
  the sticky column/header. A "Showing N of M" count updates live; "Clear"
  resets all filters and the URL.
- **Axis toggle (Students ⇄ Classes):** swaps the row source; matrix cross-fades
  at `base` (220ms) `ease.standard`. Selection/scroll position resets; focus
  moves to the matrix region with an announced change.
- **Cell hover:** `Tooltip` at `instant`/`fast` showing state + score + window
  summary. Hover lifts the cell's affordance subtly (border emphasis, not a
  transform on reduced-motion).
- **Cell click → Popover** (`e2`, enters at `fast`): a `DefinitionList` —
  `State`, `Score` (if released), `Assigned`/`Due` window, `Last activity` — and
  two link buttons. "Open student" → `student-detail-progress` (prefetch on
  hover). "Open grading" → `/exams/:examId/submissions?student={id}` (Exams
  area). Esc / outside-click closes and restores focus to the cell.
- **Sticky scroll:** first column and header row stay pinned while the matrix
  scrolls horizontally; scroll is contained (page doesn't scroll sideways).
- **Export CSV:** ghost button serializes the _currently filtered_ matrix to CSV
  client-side and triggers a download; a `Toast` confirms ("Exported {n} rows").
  No server call, no PDF here (full report PDFs are `analytics.generateReport`,
  reached from analytics/report screens, not this monitor).
- **No optimistic updates / no confirmations:** there are no mutations. The
  screen is read-only; "feedback" is limited to filter/scroll/drill affordances
  and load/error toasts.
- **Reduced motion:** cross-fades become instant opacity swaps; no cell-lift
  transforms; popovers appear without scale.

---

## 7. Content & copy

**Header**

- Title: `Assignment Tracker`.
- Subtitle: `Who has — and hasn't — done what, across your classes.`
- Action: `Export CSV`.

**Filter bar**

- Class select placeholder: `All my classes` (admin: `All classes`).
- Content select: `All content` (groups: `Spaces`, `Exams`).
- Status select: `Any status` → options `Not started`, `In progress`,
  `Mastered`, `Not submitted`, `Submitted`, `Grading`, `Graded`, `Overdue`.
- Axis toggle labels: `Students` · `Classes`.
- Search placeholder: `Search students or content`.
- Count + reset: `Showing {n} of {m}` · `Clear`.

**Legend (state vocabulary)**

- Spaces: `Not started` · `In progress` · `Mastered`.
- Exams: `Not submitted` · `Submitted` · `Grading` · `Graded`.
- `Overdue` (status.error) — `Past the due date with no completed submission.`
- Score key tooltip: `Scores appear once results are released.`

**Cell popover**

- Header: `{Student name} · {Content title}`.
- Rows: `State` · `Score` · `Assigned` · `Due` · `Last activity`.
- When no score yet: `Score: not released` (or `Score: not yet graded`).
- Actions: `Open student` · `Open grading`.

**Aggregate strip (optional)**

- StatCards: `Assigned` · `Completed` · `Overdue`.

**Row gutter / rollups**

- Row rollup: `{done}/{total}`.
- At-risk: `At risk` (tooltip `Flagged by nightly review: {reasons}`).
- Footer column rollup: `{completed} of {n} · {overdue} overdue`.

**Empty states**

- No classes: title `No classes to track`; body
  `You don't manage any classes yet. Once a class is assigned to you, its assignments appear here.`
- Nothing assigned: title `Nothing assigned yet`; body
  `Assign a space or exam to a class to start tracking completion.`; action
  `Go to Classes`.
- Filtered to nothing: `No assignments match these filters.`; action
  `Clear filters`.

**Errors (staff tone, direct)**

- Whole screen: `Couldn't load the assignment tracker.` · `Retry`.
- Partial (exams):
  `Exam status couldn't be loaded — completion for spaces is still shown.` ·
  `Retry`.
- Export: `Couldn't export. Please try again.`

---

## 8. Domain rules surfaced

- **Tenant isolation:** every read is scoped to the caller's active tenant;
  `tenantId` is derived from claims server-side and is **never** a form field,
  filter, or visible value. Cross-tenant classes/students/content never appear;
  an out-of-tenant deep-link resolves to the generic empty/error path (no
  existence leak).
- **Teacher class scope:** a `teacher` sees only classes in their claim
  `classIds`/`managedClassIds`, with the 15-class **`classIdsOverflow`**
  Firestore fallback resolved server-side (`auth-access.md §1.3`). The Class
  filter and Classes-axis are pre-scoped; the view trusts the server scope and
  does not re-derive access from local membership. `tenantAdmin` sees all
  classes.
- **Reads = repositories; no client Firestore, no client writes:** the matrix is
  assembled from `analytics.getSummary`, `progress.*`, `submissions.list`, and
  the assigned-content lists — all through `@levelup/api-client`. The current
  code's client-side join (`useExams` + `useSubmissions` + `useClasses`
  filtered/aggregated in `useMemo`) is replaced by server-scoped reads; the
  screen performs **no** completion/score recomputation.
- **Completion & score are server-authoritative:** space completion
  (`notStarted`/`inProgress`/`mastered`, %) comes from
  `progress.*`/`ClassProgressSummary`; exam state and score come from
  `submissions.list`/the released projection. The client renders these states;
  it never derives "mastered" or a percentage itself.
- **Overdue is derived from the assignment window, server-side where possible:**
  a cell is `Overdue` when the content's `dueDate`/window has passed and there
  is no completed submission/mastery. This derivation belongs to the server
  projection; the client only renders the `Overdue` flag (icon + label +
  `status.error`), never invents a deadline.
- **At-risk is server-computed only:** `isAtRisk` + `atRiskReasons` in the row
  gutter come from the nightly rule engine (`be-analytics.md`
  `nightlyAtRiskDetection` / `at-risk-rules.ts`). Rendered read-only; never
  computed on the client. Absence of the flag is neutral, not a positive "safe"
  state.
- **Results-released gating:** exam **scores** appear only when results are
  released (`releaseResultsAutomatically` / results-released gate). Until then
  the cell shows submission/grading _status_ without a number — the score is
  withheld, not faked. The released/teacher projection of `submissions.list`
  enforces this server-side (`common-api.md §3.3`).
- **Answer keys never reach the client; no grading or authoring here:** answer
  keys are server-only; grading and content authoring are reached via drill-out
  links to the Exams and Spaces areas, never embedded.
- **Pending ≠ not-started:** unresolved cells render a distinct neutral
  "loading" glyph, preserving the integrity of the `notStarted` state and
  preventing false negatives in a compliance view.

---

## 9. Accessibility

- **Focus order:** Header (Export) → Filter bar (Class → Content → Status → Axis
  toggle → Search → Clear) → matrix region → Pagination. Popovers trap focus and
  restore it to the originating cell on close.
- **Keyboard:**
  - Filters: standard Select/Combobox keyboard; axis toggle is a labelled
    segmented control (Left/Right or Space to switch).
  - Matrix: cells are focusable in a 2-D grid pattern (`role="grid"`; Arrow keys
    move between cells, Home/End to row ends, PageUp/PageDown across rows);
    Enter/Space opens the cell `Popover`. First column (names) and header row
    are exposed as row/column headers.
  - Popover: Esc closes; Tab cycles the two link buttons; Enter follows.
  - ⌘K opens CommandPalette (web only).
- **ARIA / semantics:** the matrix uses `role="grid"` with
  `role="columnheader"`/`role="rowheader"`; each cell carries an `aria-label`
  that states the full meaning ("Dev Kumar — Midterm: Overdue, not submitted,
  due May 3") so screen readers never rely on the visual glyph.
  Status/overdue/mastery are conveyed by **icon + text label**, never color
  alone; the legend is part of the accessible name resolution. `AtRiskBadge`
  exposes reasons via `aria-label`. `RouteAnnouncer` announces the screen and
  significant filter changes ("Showing 12 students, filtered to Overdue").
- **Contrast:** all text/background and state pairings meet WCAG AA via semantic
  tokens (`text.primary`/`text.secondary` on `bg.surface`; `status.error` for
  overdue, `mastery.*` for spaces, `status.success`/`warning` for grades) — and
  because every state also carries an icon + label, meaning is never
  hue-dependent. Mono scores carry the figure, not just a color.
- **Reduced motion:** `prefers-reduced-motion` disables matrix cross-fades and
  cell-lift; opacity-only at `fast`; popovers appear without scale. No
  gamification motion exists here to suppress.
- **Touch targets:** ≥44px for filter controls, axis toggle, cells (on `sm`),
  and pagination. On small screens the matrix becomes the stacked list so cells
  are not sub-44px grid squares.

---

## 10. Web↔mobile divergence (RN parity)

Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
(mobile); the headless cores (the filter/axis state, the cell-state resolver,
the matrix data assembly over `@levelup/api-client`) are reused verbatim — only
renderers differ.

- **Matrix:** web `ClassHeatmap` grid with sticky column/header + horizontal
  scroll → RN **grouped, stacked list** (one expandable card per student/class,
  each listing assigned content rows with state chip, overdue flag, and score).
  A dense two-axis grid is not attempted on phone-width.
- **Filters:** web inline filter `Panel` → RN **filter `Sheet`/bottom-sheet**
  triggered from a sticky toolbar; same Class/Content/Status selects and axis
  toggle.
- **Cell drill:** web `Popover` → RN bottom `Sheet` with the same
  `DefinitionList` + "Open student"/"Open grading" actions.
- **Hover → press:** cell hover-tooltip becomes long-press / tap-to-open on RN;
  prefetch-on-hover has no RN analog (navigate-then-load with skeletons).
- **Export:** web CSV download → RN share-sheet export (same serialized rows) or
  hidden if unsupported.
- **No ⌘K:** CommandPalette is web-only; RN uses native search/navigation.
- **Data parity:** identical reads via the same repositories
  (`analytics.getSummary`, `progress.*`, `submissions.list`, assigned-content
  lists), so RN shows the same scope-gated, server-authoritative, overdue-aware
  completion state with no extra logic.

This is primarily a teacher-web/admin operational surface; an RN teacher build,
if shipped, reuses this spec's data layer and cell-state resolver unchanged.

---

## 11. Claude-design prompt

```
You are generating the "Assignment Tracker" screen for the Auto-LevelUp TEACHER
operational web portal. Conform EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md and this spec
(docs/rebuild-spec/design/teacher/assignment-tracker.md). Do NOT invent tokens, fonts,
colors, spacing, radii, or component variants — compose only from FOUNDATION §2–§5,
citing semantic token names (bg.surface, bg.surface-sunken, text.primary, text.secondary,
brand.primary, status.error, status.success, status.warning, mastery.notStarted/
inProgress/mastered, e1/e2, radius md/lg/pill, motion instant/fast/base/page,
ease.standard/ease.entrance). Fonts: Fraunces (display/headings), Schibsted Grotesk
(UI/body/filters), Spline Sans Mono (scores/IDs). Warm paper neutrals + deep indigo
primary; marigold "spark" is NOT used (staff surface — precise, credible, calm).

Route: /assignments. Render inside PlatformLayout/AppShell (sidebar Analytics▸Assignment
Tracker active, topbar with tenant switcher/⌘K/bell/profile). This is a READ-ONLY
monitoring matrix — no writes, no forms, no grading, no authoring. Build:

HEADER: title "Assignment Tracker" (Fraunces 2xl), subtitle "Who has — and hasn't —
done what, across your classes.", and a ghost "Export CSV" button (client-side CSV of
the filtered matrix).

FILTER BAR (sticky Panel): Class select ("All my classes"), Content select ("All
content", grouped Spaces/Exams), Status select ("Any status": Not started, In progress,
Mastered, Not submitted, Submitted, Grading, Graded, Overdue), an axis toggle
(Students | Classes, segmented), a search input ("Search students or content"), a live
"Showing N of M" count and a "Clear" reset. Reflect all filter + axis state in the URL
query string (?class=&content=&status=&axis=).

LEGEND (always visible, icon+label chips, NEVER color-only): Not started / In progress /
Mastered (spaces, mastery.* tokens); Not submitted / Submitted / Grading / Graded (exams);
Overdue (status.error, ⚠ icon + "Overdue").

MATRIX (ClassHeatmap from @levelup/shared-ui/charts): rows = students (default) or
classes (axis toggle); columns = assigned content, grouped under "Spaces" and "Exams"
labelled headers. Sticky first column (name) + sticky header row; horizontal scroll
INSIDE the matrix container only. Each cell composes icon + state label + optional mono
score (GradePill, only when results released) + optional Overdue badge; hover Tooltip;
click → Popover with a DefinitionList (State, Score, Assigned, Due, Last activity) and
two links: "Open student" → student-detail-progress, "Open grading" →
/exams/:examId/submissions?student={id} (gated by TeacherPermissions). Right-gutter row
rollup "{done}/{total}" + AtRiskBadge (students axis, only when isAtRisk, tooltip =
atRiskReasons). Footer summary row: per-column "{completed} of {n} · {overdue} overdue".
Virtualize rows. Optional top StatCard strip: Assigned / Completed / Overdue.

STATES: skeleton heatmap (cells + sticky column) with columns/cells resolving
independently — PARTIAL is normal: unresolved cells show a neutral "loading" glyph, NEVER
"not started". Distinct EmptyState vs ErrorState (errors are NOT empty states): "No
classes to track" / "Nothing assigned yet" (+ Go to Classes) / "No assignments match
these filters" (+ Clear filters) vs whole-screen "Couldn't load the assignment tracker"
(+ Retry) and a partial InlineAlert when exam status fails but space progress loaded.
Permission-gated: teacher scoped to managed classes (no Class option outside scope; no
"Open grading" without grading permission); tenantAdmin sees all classes.

DOMAIN RULES (must hold): tenantId derived from claims server-side — never a field,
filter, or visible value; teachers see only managed classes (classIds/managedClassIds
claim, 15-class overflow fallback) — trust server scope, don't re-derive; reads are
repositories (analytics.getSummary scope class, progress.getSpaceProgress/
getStoryPointProgress, submissions.list released projection, spaces.list/exams.list for
columns) — NO direct client Firestore, NO client recomputation of completion/score/risk;
overdue derived from the assignment window server-side (client only renders the flag);
exam SCORES shown only when results are released (status without number otherwise — never
faked); isAtRisk/atRiskReasons from the nightly rule engine, rendered read-only; pending
cells must NOT read as notStarted; no answer keys, grading, or authoring on this screen
(link out only).

MOTION: PageTransition (page); filter/axis changes cross-fade the matrix at fast/base
with NO sticky-column layout jump; cell hover Tooltip (instant/fast); cell Popover at e2
(fast). No optimistic updates, no confirmations (read-only). Honor prefers-reduced-motion
(opacity-only, no transforms; no gamification celebration anywhere).

A11Y: matrix as role="grid" with rowheader/columnheader; Arrow-key 2-D navigation,
Enter/Space opens cell Popover; every cell has an aria-label stating full meaning
("Dev Kumar — Midterm: Overdue, not submitted, due May 3"); state conveyed by icon+label
(never color alone); AtRiskBadge aria-label lists reasons; RouteAnnouncer announces
filter result counts; focus trap + restore in Popover; ≥44px touch targets; WCAG AA
contrast via semantic tokens.

RESPONSIVE: lg = full sticky matrix, single-row filter bar, footer rollup; md = wrapping
filter bar, sticky first column + horizontal scroll, two-row legend; sm = matrix becomes
a grouped STACKED list (one expandable card per student/class listing content rows with
state chip + overdue + score), filters move into a Drawer/Sheet, sidebar →
MobileBottomNav. Keep component names/props 1:1 with a future RN (ui-native) build.

Output a single React + Tailwind screen composed from shared-ui components, with the
exact headings, labels, legend, empty-state, and error copy from §7 of this spec.
```
