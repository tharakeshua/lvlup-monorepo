# Space (Learning) Analytics

> The teacher's read-only console for "how is this **learning space** performing
> across my students and classes" — engagement and completion KPIs, a
> story-point completion funnel, a mastery distribution, per-class / per-student
> completion, time-on-task, and item-level difficulty where the backend supplies
> it. A space picker drives the whole surface. It surveys and deep-links; it
> never authors a space or recomputes a single statistic on the client.
> Authoring lives in SPACES; this screen links out.

**Route** `/analytics/spaces` (space-scoped via `?spaceId=`, optional
`?classId=` filter) · **Roles** `teacher` (assigned/managed spaces + classes
only) · `tenantAdmin` (all) · **Primary APIs** `spaces.list` / `spaces.get`
(picker + space meta) · `analytics.getSummary` (aggregated space
completion/mastery) · `progress.getSpaceProgress` (per-space / per-student
progress aggregates) · `storyPoints.list` (funnel labels) →
`analytics.generateReport` (type `progress`)

This spec conforms to `design/00-FOUNDATION.md` ("Lyceum / Modern Scholarly").
Every token, type, spacing, radius, elevation, motion value, and component is
cited by its FOUNDATION semantic name — no new tokens, fonts, colors, or
component variants are introduced. Per FOUNDATION §1 this is a **staff
operational surface**: it reads credible, focused, and calm — restraint in
chrome, no gamification celebration. The mastery distribution uses the platform
`mastery.*` color scale **read-only** (a teacher viewing learners' state), and
the single permitted `spark` accent is the "Export report" CTA glow — never
ambient decoration, never an XP/streak meter.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` (sees only the spaces they're assigned to
author/teach and the classes they manage) or a `tenantAdmin` (sees every space
in the active tenant). The job-to-be-done is **diagnostic, not transactional**:

> _"Pick a learning space and show me how it's landing — how many students
> started and finished, where in the story-point path they drop off, how mastery
> is distributed (not started / in progress / mastered), which classes and
> students are ahead or behind, how much time it's costing, and which items are
> hardest — without me opening the editor or recomputing anything."_

This is the **understand-a-space** surface. It complements (does not replace):

- **Space Editor** (`/spaces/:spaceId/edit`, SPACES area) — where the space,
  story points, and items are authored. Analytics deep-links _to_ it ("Edit
  space →"); it never edits here.
- **Story-Point Preview**
  (`/spaces/:spaceId/story-points/:storyPointId/preview`) — the authoring
  preview (answer-key-merged). A funnel row may link _to_ a story point's
  preview; this screen never previews content inline.
- **Class Analytics** (`/analytics/classes`) — per-_class_ performance across
  all activity. This screen is per-_space_, aggregated across the students
  assigned to it (optionally narrowed to one class).
- **Student Detail / Progress** (`/students/:studentId/report`) — one learner's
  read-only state (including their gamification state, viewed read-only).
  Per-student rows here link _out_ to it.
- **Assignment Tracker** (`/assignments`) — who's been _assigned_ what and is it
  done. This screen is about _performance_ within a space, not assignment
  bookkeeping.

**Explicitly NOT this screen's job** (FOUNDATION + domain rules): authoring or
editing spaces/items (SPACES area), grading or releasing results (EXAMS area),
assigning content to classes, or **any client-side recomputation of completion,
mastery, funnel counts, time-on-task, or difficulty**. Every number on this
screen is read from a precomputed/server-aggregated source; the client renders,
it never aggregates. In particular, the **legacy per-story-point count
recompute** that the old `SpaceEditorPage` did on the client (`liveCounts` +
per-SP `getCountFromServer`, status-report §1.8/§4) is **removed** — stats are
authoritative and come from the server.

**Emotional register:** precise, calm, professional. The mastery ramp
(`mastery.notStarted` / `mastery.inProgress` / `mastery.mastered`) is shown as
**diagnostic distribution**, not as a learner reward — no burst, no flame, no
level-up. At-risk, where it surfaces on a per-student row, is sober signal
(`AtRiskBadge` + reason text), never punitive or celebratory.

---

## 2. Entry points & route

**Route:** `/analytics/spaces`, gated by
`RequireAuth allow={['teacher','tenantAdmin']}` (FOUNDATION §4 single
config-driven guard; `specs/webapps-design.md` §4.2). It is the **Analytics →
Spaces** nav item (`navMeta.group: 'Analytics'`, label "Spaces"). Space
selection is carried as a URL search param (`/analytics/spaces?spaceId=...`),
and an optional class narrowing as `&classId=...`, so the selected space (and
class filter) is a deep-link / back-button-stable / RN-navigable state — never
local-only component state.

**Entry points:**

- **Analytics → Spaces** sidebar item (`AppSidebar`); the default `spaceId` is
  the first space the caller can see (or none → picker-only empty state).
- **From the Space Editor** (`/spaces/:spaceId/edit`): a "View analytics →"
  action navigates to `/analytics/spaces?spaceId=:spaceId` with that space
  preselected.
- **From the Space List** (`/spaces`): each `SpaceCard` may carry an analytics
  affordance → `/analytics/spaces?spaceId=:spaceId`.
- **From Class Detail / Class Analytics**: a "Space performance" link may open
  `/analytics/spaces?spaceId=:spaceId&classId=:classId` (space narrowed to that
  class).
- `CommandPalette` (⌘K) "Space analytics" → opens with the last-viewed or first
  space.

**Reads powering it** (all via `@levelup/api-client` repositories /
`shared-hooks/headless`; UI never touches Firestore or builds collection paths —
`specs/webapps-design.md` §6, common-api §3.3):

- **`spaces.list`** (`v1.levelup.listSpaces`) → the space-picker option set.
  Server scopes this to the caller's assigned/managed spaces for a `teacher`
  (`teacherIds` / class-assigned via `classIds` intersecting the caller's claim
  classes, with the `classIdsOverflow >15` Firestore fallback per auth-access
  §1.3); full tenant set for a `tenantAdmin`. `tenantId` is derived from claims
  server-side — **never a request field**.
- **`spaces.get`** (`v1.levelup.getSpace`) for the selected space → meta for the
  header: `title`, `type` (`learning|practice|assessment|resource|hybrid`),
  `status` (`draft|published|archived`), `accessType`
  (`class_assigned|tenant_wide|public_store`), assigned `classIds`, and the
  authoritative `stats` (totalStoryPoints/totalItems — server-maintained,
  **not** client-recomputed). Answer keys are never part of this read
  (Admin-SDK-only; auth-access §2).
- **`storyPoints.list`** (`v1.levelup.listStoryPoints`) for the selected space →
  ordered story-point labels/types/`orderIndex` to label the **completion
  funnel** rows (the funnel _counts_ come from the progress aggregate, not from
  these docs).
- **`analytics.getSummary`** — the space-level aggregate. Scope carries the
  space-completion / mastery rollup the backend materializes (the analytics
  package already tracks per-student space-completion in its insight context and
  per-student `levelup` metrics — be-analytics §1, §2: `StudentLevelupMetrics`,
  per-student space completion). Shape consumed for this screen:
  - **engagement/completion**: `enrolledCount`, `startedCount`,
    `completedCount`, `averageCompletion` (0–1), `activeStudentRate` (0–1)
  - **mastery distribution** across the space's story points / items:
    `{ notStarted, inProgress, mastered }` counts (from the progress engine —
    never client-derived)
  - **time-on-task**: `averageTimeOnTaskMinutes` (or per-story-point where
    available)
  - optional **per-class** rollup
    `[{ classId, className, averageCompletion, startedRate }]`
- **`progress.getSpaceProgress`** (`v1.levelup.getSpaceProgress`) → the
  per-story-point **funnel** counts (`startedCount` / `completedCount` per
  `storyPointId`, in `orderIndex` order) and the per-student completion list
  (`[{ studentId, name, completion (0–1), masteredPoints, totalPoints, lastActiveAt, isAtRisk?, atRiskReasons? }]`).
  Optionally narrowed by `classId`. This is the server aggregate that replaces
  the removed client recompute; the client never fans out over `spaceProgress`
  docs.
- **Item-level difficulty (conditional):** where the backend supplies per-item
  difficulty for a space's practice/quiz/test story points (the analytics
  package computes a per-question **difficulty index** for _exams_ in
  `onExamResultsReleased`; an equivalent per-_item_ difficulty within a learning
  space is surfaced **only if present** — never fabricated). When absent, the
  item-difficulty card is omitted entirely (§5.4).

**Writes:** exactly one — **`analytics.generateReport`** with
`type: 'progress'`, `spaceId` = selected space (and `classId` when narrowed),
rate-limited `'report',5` server-side (be-analytics §1). It builds a
space-progress PDF, uploads to `tenants/{tenantId}/reports/progress/...`, and
returns `{ pdfUrl, expiresAt }` — a **1-hour signed URL** (common-api §3.3;
be-analytics §1). No other mutation is reachable from this surface. There is no
inline edit, no stat write-back, no mastery/risk override, no publish/archive
(those live in the Space Editor).

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (FOUNDATION §5 Navigation;
`specs/webapps-design.md` §3.1): persistent left `Sidebar`, `Topbar` (tenant
switcher, ⌘K search, `NotificationBell`, profile / `ThemeToggle`), and on mobile
a `Tabbar` (`MobileBottomNav`) replacing the sidebar. This screen owns only the
**main content region**. Page gutters follow FOUNDATION §4 (mobile 16 / tablet
24 / desktop 32); max content width 1200. Vertical rhythm uses `gap` from the
spacing scale — major sections separated by space-8/`32`, intra-section by
space-4/`16` or space-6/`24`. `bg.canvas` page; cards `bg.surface`, radius `lg`,
elevation `e1` at rest / `e2` on hover (FOUNDATION §4).

```
┌─ AppShell ────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar: [tenant ▾] ………… [⌘K search] [🔔 bell] [theme] [avatar]     │
│ (nav)   ├──────────────────────────────────────────────────────────────────────┤
│         │  MAIN  (max-w 1200, gutter 32)                                         │
│         │  ┌─ Page header ──────────────────────────────────────────────────┐   │
│         │  │ h1 "Space analytics"                                            │   │
│         │  │ [ Space: Algebra Foundations ▾ ] [Class: All ▾]  "Updated 3h"  │   │
│         │  │  Badge(type · status)               [Edit space →]  [Export]    │   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ KPI STRIP (StatCard ×4–5, grid) ──────────────────────────────┐   │
│         │  │ ▸Enrolled  ▸Started  ▸Completed  ▸Avg completion  ▸Avg time    │   │
│         │  │  28         24        11           64%              42 min      │   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ 2-col region (lg) ────────────────────────────────────────────┐   │
│         │  │ ┌ Mastery distribution (Card) ─┐ ┌ Completion funnel (Card) ──┐ │   │
│         │  │ │ ProgressRing + legend:        │ │ StoryPointTrack (aggregate,││   │
│         │  │ │  ◔ mastered  / inProgress /   │ │  read-only) — per-SP nodes ││   │
│         │  │ │    notStarted (mastery.*)     │ │  with started→completed    ││   │
│         │  │ │  counts + %                   │ │  counts; drop-off shading  ││   │
│         │  │ └───────────────────────────────┘ └────────────────────────────┘ │   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ PER-CLASS COMPLETION (Card, full-width) ──────────────────────┐   │
│         │  │ SimpleBarChart OR ClassHeatmap: class × avg completion          │   │
│         │  │  10-A ▇▇▇▇▇ 71%  · 10-B ▇▇▇ 48%  · 10-C ▇▇▇▇ 60%  …            │   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ PER-STUDENT COMPLETION (DataTable, full-width) ───────────────┐   │
│         │  │ [search] [class filter] [sort ▾]            rows: name · class ││   │
│         │  │  · completion% (ProgressRing/bar) · mastered/total · last       │   │
│         │  │  active · [AtRiskBadge?] · "View report →"     [pagination]     │   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ ITEM DIFFICULTY (Card, full-width — IF AVAILABLE) ────────────┐   │
│         │  │ DataTable / SimpleBarChart: item · story point · difficulty     │   │
│         │  │  · attempts · success%   (omitted entirely if not supplied)     │   │
│         │  └────────────────────────────────────────────────────────────────┘   │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

**Region order & grid:**

1. **Page header** — `h1` "Space analytics" (Fraunces display). Below: the
   **space picker** (`Select`/`Combobox`), an optional **class filter**
   (`Select`, default "All classes"), a `Badge` row for the space's `type` +
   `status`, a `lastUpdatedAt` freshness caption (`text.secondary`, e.g.
   "Updated 3h ago"), a ghost **"Edit space →"** link (to the Space Editor), and
   a right-aligned **"Export report"** `Button` (the one permitted
   `spark`/primary CTA). On md+ pickers + Export sit on a row beneath the title;
   on sm they stack.
2. **KPI strip** — four-to-five `StatCard`s in a grid: `grid-cols-1` (sm) →
   `grid-cols-2` (md) → `grid-cols-4`/`grid-cols-5` (lg+). `gap` = space-4/`16`.
   Enrolled · Started · Completed · Average completion · Average time-on-task.
   (Only **real** tiles render — §5.4.)
3. **Mastery + funnel region** — `grid-cols-1` (sm/md) → `lg:grid-cols-2` (lg+),
   `gap` = space-6/`24`. Left = **Mastery distribution** (`ProgressRing`
   segmented by `mastery.*` + a labeled legend with counts/%); right =
   **Completion funnel** (`StoryPointTrack` in **aggregate, read-only** mode —
   each `StoryPointNode` shows started→completed counts with drop-off shading,
   in `orderIndex` order).
4. **Per-class completion** — full-width `Card`. `SimpleBarChart` (per-class avg
   completion) when a handful of classes; `ClassHeatmap` when class×story-point
   density warrants it. Bars/cells always paired with the class label + numeric.
5. **Per-student completion** — full-width `DataTable` (owns its own search /
   class filter / sort / pagination — `specs/webapps-design.md` §2.2
   `@levelup/shared-ui/data`). Columns: student (avatar + name), class,
   completion (`ProgressRing` or bar + %), mastered/total points, last active,
   optional `AtRiskBadge`, and a "View report →" row link to
   `/students/:studentId/report`.
6. **Item difficulty** — full-width `Card` (`DataTable` or `SimpleBarChart`),
   **rendered only when the backend supplies per-item difficulty**; otherwise
   the section does not appear (§5.4).

**Responsive summary:**

- **sm (<768):** single column throughout; KPIs stack 1-up then 2-up; mastery
  ring above the funnel; the funnel (`StoryPointTrack`) renders as a vertical
  node list; per-class chart full-width; the per-student `DataTable` collapses
  to stacked cards (web→mobile table rule, FOUNDATION §6); item-difficulty (if
  present) as stacked cards. Header pickers + "Edit space →" + Export stack
  under the title (Export full-width).
- **md (768–1023):** KPIs 2×2 (+1 wrapping); mastery/funnel stack vertically;
  per-class + per-student full-width; header on two rows (title row, then
  pickers + actions row).
- **lg+ (≥1024):** KPIs 4–5-up; mastery/funnel 2-up; per-class and per-student
  full-width; content centered within max-w 1200.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`specs/webapps-design.md`
§2.2, esp. `@levelup/shared-ui/charts`, `/data`, and the cross-app domain
components). No new primitives are introduced.

| Region                  | Component(s)                                                                                                                                                                                                    | Notes                                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell                   | `AppShell`, `Sidebar`, `Topbar`, `NotificationBell`, `CommandPalette`, `MobileBottomNav` (mobile), `SkipToContent`, `RouteAnnouncer`                                                                            | Provided by `PlatformLayout`; not rebuilt here.                                                                                                                                                                                                                                         |
| Header                  | `Select`/`Combobox` (space picker), `Select` (class filter), `Badge` (space `type` + `status`), `Button` (ghost "Edit space →"; primary "Export report"), `Breadcrumb` (optional: Analytics / Spaces / {title}) | Fraunces `h1`. `spark` permitted only on the Export CTA glow. Freshness is plain `text.secondary`, not a badge.                                                                                                                                                                         |
| KPI strip               | `StatCard` (`Stat/KPI`) ×4–5                                                                                                                                                                                    | Mono numerics (Spline Sans Mono) per FOUNDATION §3. Each: label + value + optional caption (e.g. "of 28 enrolled"). Time-on-task formatted as minutes. Only real tiles render.                                                                                                          |
| Mastery distribution    | `ProgressRing` + legend (`Chip`/text rows)                                                                                                                                                                      | Segmented ring using the `mastery.notStarted` / `mastery.inProgress` / `mastery.mastered` scale (FOUNDATION §2.3) **read-only**; legend always pairs each color with its label + count + %. Never color-only.                                                                           |
| Completion funnel       | `StoryPointTrack` (aggregate mode) composed of `StoryPointNode`                                                                                                                                                 | The learning path rendered **read-only, aggregate**: each node shows the story point's started→completed counts and a drop-off indicator; `mastery.*` shading. Reuses the same domain component students see, in a read-only data mode. Nodes may deep-link to the story-point preview. |
| Per-class completion    | `SimpleBarChart` (per-class) or `ClassHeatmap` (class×SP density)                                                                                                                                               | Single neutral `brand.primary` series; lowest-completion class may carry a `status.warning`/`status.error` tint, always paired with label + numeric.                                                                                                                                    |
| Per-student completion  | `DataTable` + `Avatar` + `ProgressRing`/`ProgressBar` + `AtRiskBadge` + `GradePill`(n/a here) + `Button` (ghost row-link)                                                                                       | `DataTable` owns search / class filter / sort / pagination / selection. Rows link to `/students/:studentId/report`. `AtRiskBadge` is read-only (nightly engine).                                                                                                                        |
| Item difficulty         | `DataTable` or `SimpleBarChart`                                                                                                                                                                                 | Conditional — only if backend supplies it. Difficulty paired with attempts + success% as text, never a lone bar.                                                                                                                                                                        |
| Loading                 | `Skeleton`                                                                                                                                                                                                      | Silhouettes the final layout (header, KPI tiles, ring + track, per-class chart, table rows, optional difficulty block).                                                                                                                                                                 |
| Empty / error / partial | `EmptyState`, `ErrorState`/`InlineAlert`                                                                                                                                                                        | Distinct empty (no space / no progress yet) vs error (read failed). Per-section partial banners (`InlineAlert`) for absent sub-metrics.                                                                                                                                                 |
| Export feedback         | `Toast` (sonner), button spinner                                                                                                                                                                                | Report generation progress + success/failure. No blocking `LoadingOverlay`.                                                                                                                                                                                                             |

**Proposed addition — none required.** Every region composes existing inventory.
The "completion funnel" is `StoryPointTrack`/`StoryPointNode` (the existing
learning-path domain component) run in an **aggregate, read-only data mode** —
this is a _prop/data_ variant of an existing component, not a new token or a new
component; if the team wants to name it `AggregateStoryPointTrack`, it is a thin
composition over `StoryPointTrack` and belongs in the same `shared-ui` domain
module, introducing **no** new design tokens or visual variants. The brief's
named set — `StoryPointTrack` (aggregate, read-only), `ProgressRing`,
`SimpleBarChart`, `ClassHeatmap`, `StatCard`, `DataTable` — already exists in
the `shared-ui/charts` + `/data` + domain inventory (`specs/webapps-design.md`
§2.2; FOUNDATION §5).

---

## 5. States

Every state is rendered from the read hooks over `@levelup/api-client`; no state
derives a metric on the client (the legacy `liveCounts`/`getCountFromServer`
recompute is gone — §1, status-report §4).

**5.1 Loading (skeleton).** On first load (or space change), show a `Skeleton`
matching the final silhouette: header row (title + two picker placeholders +
Edit/Export disabled), 4–5 KPI tiles, a ring block beside a track block, a
full-width per-class chart, a per-student table (header + ~6 shimmer rows), and
— if the last view had it — an item-difficulty block. Skeleton uses
`bg.surface-sunken` shimmer; no layout shift when data resolves. The space
picker loads from `spaces.list` first and stays interactive while the
summary/progress load (so the user can re-pick during a slow fetch).

**5.2 Empty.**

- **No spaces visible** (a `teacher` assigned to zero spaces): `EmptyState` —
  title "No spaces to analyze," body "You're not assigned to any learning spaces
  in this tenant yet. Create one in Spaces, or ask your admin to assign you."
  with a ghost "Go to Spaces →" link. Pickers hidden; no KPI strip.
- **Space selected but no progress yet** (published space with no student
  activity → no progress aggregate, or `enrolledCount === 0`): `EmptyState`
  inside the content area — title "No learner activity yet," body "Analytics
  appear once students start this space's story points." KPI strip, charts,
  funnel, and table are replaced by the single empty card; pickers, "Edit space
  →," and Export-disabled remain.
- **Draft space** (`status === 'draft'`): a quiet `InlineAlert` at the top of
  the content — "This space is a draft. Analytics will populate once it's
  published and students begin." — and the body shows the no-activity empty. (We
  still render the header/picker so the teacher can switch to a published
  space.)
- **Section-level empty** (aggregate exists but a sub-section is empty, e.g. no
  at-risk students, one class only so the per-class chart is trivial, no item
  difficulty): that section shows a quiet inline empty (no card chrome) or is
  omitted per §5.4. The per-student table empty (after a filter) shows "No
  students match these filters."

**5.3 Error.** If `analytics.getSummary` (space) or `progress.getSpaceProgress`
fails: full-content `ErrorState` — title "Couldn't load space analytics," body
"Something went wrong fetching this space's performance." + a "Retry" `Button`
(refetches the queries). The pickers stay usable (switching space/class
re-attempts). A failure of a _non-blocking_ read (e.g. item difficulty,
per-class rollup) degrades to a **partial** state (below) rather than blanking
the page. A `403`/access-denied response (URL hand-edited to a
`spaceId`/`classId` the caller can't reach) renders an "Access denied"
`InlineAlert` in the content region: "You don't have access to this space," and
resets the picker to an allowed space (auth-access §1.6).

**5.4 Partial.** This screen composes several reads and several sub-metrics,
**some of which the backend currently stubs or may not supply** (be-analytics
§4: `streakDays:0`, `discriminationIndex:0`, `topicPerformance:{}`,
`correlationData` fixed stub; per-item space difficulty may simply be absent).
**Show only real metrics — never render a placeholder zero as truth.** Rules:

- If **time-on-task** is unavailable/stubbed → omit the "Average time-on-task"
  KPI tile rather than show `0 min`.
- If **item difficulty** is not supplied → **omit the item-difficulty card
  entirely** (do not draw an empty table). This card is opt-in on data presence.
- If the **per-class rollup** is absent or there's a single class → omit the
  per-class chart (a one-bar chart is noise); the per-student table still
  carries the class column.
- If `getSpaceProgress` fails but `getSummary` succeeds → KPIs + mastery +
  per-class still render; the **funnel** and **per-student table** show an
  inline `InlineAlert` "Per-story-point breakdown unavailable" instead of an
  empty track/table.
- If the space `title` looks like a placeholder (equals the `spaceId`) → fall
  back to the picker's label (from `spaces.list`).
- A small, dismissible `InlineAlert` may note "Some metrics are still being
  computed" only when a section is omitted for staleness — factual, never
  alarming.

**5.5 Success.** Full render: header with selected space + type/status badges +
freshness caption + "Edit space →" + enabled Export; real KPI tiles; mastery
ring; aggregate `StoryPointTrack` funnel; per-class completion (if >1 class);
per-student `DataTable`; item difficulty (if real). All numbers carry their
source freshness from `lastUpdatedAt`.

**5.6 Permission-gated variants by role.**

- **`teacher`:** space picker contains only assigned/managed spaces; class
  filter contains only managed classes;
  `getSummary`/`getSpaceProgress`/`generateReport` are membership-checked
  server-side (`teacherIds` / class-assignment scope, `classIdsOverflow >15`
  fallback — auth-access §1.3). Per-student rows resolve only to students within
  the caller's reach. No tenant-wide rollups, no AI-cost/quota chrome
  (admin/dashboard territory).
- **`tenantAdmin`:** space picker contains all tenant spaces (may be long →
  `Combobox` with search); class filter contains all tenant classes. Otherwise
  identical surface — this screen is per-space for both roles. No extra write
  affordances are unlocked (Export is available to both; "Edit space →" routes
  to the editor, itself permission-gated).
- **Neither role sees** answer keys, raw item content, or unreleased exam
  results — this surface reads aggregates only (domain §8). When a per-student
  row surfaces a learner's gamification/mastery state, it is **read-only** (a
  teacher viewing the student's state), never an interactive XP/streak control.

---

## 6. Interactions & motion

Motion is "felt, not seen" (FOUNDATION §4): subtle entrances, no celebratory
pops on this staff surface. All durations/easings cite FOUNDATION motion tokens.

**6.1 Space switch (primary flow).** Selecting a space in the picker:

- Updates the URL search param (`?spaceId=...`, preserving any `&classId=`) —
  back/forward navigable; RN-portable (route param).
- KPI / mastery / funnel / per-class / per-student / difficulty regions
  cross-fade: outgoing content `ease.exit` over `fast 160ms`, skeleton/new
  content `ease.entrance` over `base 220ms`. No full-page reload, no layout jump
  (skeleton holds the silhouette). The header `Badge`s (type/status), freshness
  caption, "Edit space →" target, and Export's `spaceId` update together.
- React Query caches per `spaceId` (+`classId`), so re-selecting a recently
  viewed space is instant (content swap, no skeleton).

**6.2 Class filter.** Choosing a class in the class filter narrows
`getSpaceProgress`/per-class focus to that class (URL `&classId=`),
recolors/refilters the per-class chart and per-student table, and re-targets
Export (`classId` included). "All classes" clears it. Same cross-fade timing as
§6.1, scoped to the affected regions.

**6.3 Funnel & per-student interactions.**

- **Funnel** (`StoryPointTrack` aggregate): hovering a `StoryPointNode` shows a
  `Tooltip` with the story point's name + started/completed counts + drop-off
  (mono numerics, `instant 100ms` fade). A node may deep-link to that story
  point's preview (`/spaces/:spaceId/story-points/:storyPointId/preview`); hover
  → subtle `e2` lift.
- **Per-student `DataTable`**: search / sort / class-filter / paginate are all
  `DataTable`-owned (no client recompute of the underlying numbers — sorting
  reorders already-server-computed rows). Row hover → `bg.surface-sunken` tint +
  `instant 100ms`; "View report →" routes to `/students/:studentId/report`.

**6.4 Export report.** Clicking **"Export report"**:

- Button enters loading: spinner + label "Generating report…", disabled
  (FOUNDATION button loading state). A `Toast` (sonner) "info" may accompany
  slow generation. The rest of the page stays interactive (no blocking
  `LoadingOverlay`).
- On success (`{ pdfUrl, expiresAt }`): `Toast` "success" — "Space report ready"
  with a "Download" action that opens `pdfUrl` in a new tab. The URL is a
  **1-hour signed URL** (be-analytics §1); a re-click after expiry simply
  regenerates.
- On failure (incl. rate-limit `'report',5`): `Toast` "error" — "Couldn't
  generate the report. Please try again in a moment." Button returns to idle.
  **No optimistic update** — report generation is a real server job; the UI
  reflects the actual callable result.

**6.5 Refresh / freshness.** No auto-refresh (these are precomputed, read-cheap
aggregates; be-analytics §3). The `lastUpdatedAt` caption is the trust signal.
An optional manual "Refresh" `IconButton` next to the caption refetches
`getSummary` + `getSpaceProgress` (spinner during, `base 220ms`).

**6.6 Confirmations.** No destructive actions on this surface → **no
`ConfirmDialog`**. Export and navigation are non-destructive; "Edit space →"
leaves analytics for the editor (a route change, not a mutation here).

**Reduced motion:** with `prefers-reduced-motion`, cross-fades become instant
content swaps, hover lifts drop to a border-only change, the mastery ring and
funnel render at final state (no sweep/fill animation), and chart bars do not
animate-in. (FOUNDATION §4.)

---

## 7. Content & copy

Staff tone: direct, factual, calm. No exclamation marks, no gamified or
congratulatory copy.

**Headings & labels**

- Page title (`h1`): **"Space analytics"**
- Space picker label / placeholder: **"Space"** / **"Select a space"**
- Class filter label / default: **"Class"** / **"All classes"**
- Space meta badges: the space **type** (e.g. "Learning") and **status**
  ("Draft" / "Published" / "Archived")
- Freshness caption: **"Updated {relativeTime}"** (e.g. "Updated 3 hours ago");
  hover `Tooltip` shows the absolute timestamp.
- Header links/buttons: **"Edit space →"** (ghost, to SPACES editor) · **"Export
  report"** (loading: **"Generating report…"**)
- KPI tiles: **"Enrolled"**, **"Started"** (caption "of {enrolled}"),
  **"Completed"** (caption "of {enrolled}"), **"Average completion"**,
  **"Average time-on-task"** (value e.g. "42 min")
- Section titles: **"Mastery distribution"**, **"Completion funnel"**,
  **"Completion by class"**, **"Student completion"**, **"Item difficulty"**
- Mastery legend: **"Mastered"** / **"In progress"** / **"Not started"** (each
  paired with count + %, never color-only)
- Funnel node label: `{story point name}` · **"{started} started · {completed}
  completed"**
- Per-student table headers: **"Student"**, **"Class"**, **"Completion"**,
  **"Mastered"** (value "{mastered}/{total}"), **"Last active"**, **"Status"**
  (`AtRiskBadge` or "—"); row trailing **"View report →"**
- Item difficulty headers: **"Item"**, **"Story point"**, **"Difficulty"**,
  **"Attempts"**, **"Success"**

**Empty-state copy**

- No spaces: title **"No spaces to analyze"** · body **"You're not assigned to
  any learning spaces in this tenant yet. Create one in Spaces, or ask your
  admin to assign you."** · link **"Go to Spaces →"**
- No activity: title **"No learner activity yet"** · body **"Analytics appear
  once students start this space's story points."**
- Draft notice (inline): **"This space is a draft. Analytics will populate once
  it's published and students begin."**
- No at-risk students (status column / teaser): **"No students are currently
  flagged at-risk."**
- Filtered table empty: **"No students match these filters."**
- Per-class / item-difficulty omitted (partial): no copy — the card is simply
  absent.

**Error copy**

- Load failed: title **"Couldn't load space analytics"** · body **"Something
  went wrong fetching this space's performance."** · action **"Retry"**
- Access denied (out-of-scope space): **"You don't have access to this space."**
- Funnel/breakdown unavailable (partial): inline **"Per-story-point breakdown
  unavailable."**
- Export failed: **"Couldn't generate the report. Please try again in a
  moment."**
- Partial-metrics note: **"Some metrics are still being computed."**

**Success copy**

- Export ready: **"Space report ready"** · action **"Download"**

**Numeric formatting:** completion/rates shown as whole-number `%` (Spline Sans
Mono); 0–1 source values formatted at the view edge (×100, rounded). Mastery
shown as both count and % of the cohort. Counts (enrolled/started/completed) are
integers. Time-on-task in minutes (or "{h}h {m}m" past 60). At-risk is a per-row
badge, never a percent.

---

## 8. Domain rules surfaced

- **Read-cheap, precomputed, server-authoritative.** Every metric comes from
  server-aggregated sources — `analytics.getSummary` (space completion/mastery
  rollup), `progress.getSpaceProgress` (per-story-point funnel + per-student
  completion), and the space's own authoritative `stats`. The client **never**
  recomputes completion, mastery, funnel counts, time-on-task, or difficulty
  (FOUNDATION/domain rules; be-analytics §3 precompute-on-write).
- **Legacy per-SP recompute is removed.** The old client-side `liveCounts` +
  per-story-point `getCountFromServer` recompute (because `sp.stats.totalItems`
  was known-stale for seeded data — status-report §1.8/§4) is **gone**. Stats
  are authoritative (trigger/transaction-maintained server-side;
  `specs/webapps-design.md` §5.1 "stats are authoritative"). This screen reads
  them; it never reconstructs counts.
- **Mastery from the progress engine.** The `notStarted / inProgress / mastered`
  distribution comes from the progress engine's per-student / per-story-point
  state (the single transactional progress writer; be-analytics §1, common-api
  §3.3). The UI renders the `mastery.*` scale **read-only** and never derives a
  learner's mastery on the client.
- **At-risk is read-only signal.** Any per-student `isAtRisk`/`atRiskReasons`
  shown comes from the **nightly rule engine** (`nightlyAtRiskDetection` +
  `at-risk-rules.ts`; be-analytics §1). Render reasons verbatim via
  `AtRiskBadge`; never compute risk client-side (note the engine emits
  `zero_streak`, not the unused `no_recent_activity` enum — be-analytics §4:
  don't hardcode a reason vocabulary).
- **Show only real metrics.** Known stubs/absent metrics (`topicPerformance:{}`,
  `discriminationIndex:0`, `streakDays:0`, absent per-item space difficulty;
  be-analytics §4) are **omitted** rather than displayed as misleading zeros
  (§5.4), with a fallback to the picker's real space name when `title` looks
  like a placeholder.
- **Tenant isolation.** All reads/writes are scoped to the caller's active
  tenant; `tenantId` is derived from claims server-side, never a form/URL field.
  No cross-tenant space/class is ever selectable (the pickers are built from
  tenant-scoped `spaces.list`/`classes.list`).
- **Role + assignment scoping.** A `teacher` sees only assigned/managed spaces
  and managed classes (`teacherIds` / class-assignment via `classIds`, with the
  `classIdsOverflow >15` Firestore fallback; auth-access §1.3, §1.6). A
  `tenantAdmin` sees all. `getSummary`/`getSpaceProgress`/`generateReport`
  independently membership-check server-side — a hand-edited out-of-scope id is
  denied, not silently served.
- **No answer keys, no raw content, no unreleased data.** This surface reads
  aggregates only. Answer keys are Admin-SDK-only and never reach the client
  (auth-access §2; FOUNDATION `AnswerKeyLock`). It never renders raw
  item/question content and never surfaces unreleased exam results — space
  aggregates roll up learning progress, and any exam-derived rollup honors
  results-released gating upstream.
- **Reads via repos, writes via callables.** No direct client Firestore access
  (`specs/webapps-design.md` §6); the single write (`generateReport`) is a
  callable returning a signed URL — no client-side PDF assembly, no client
  write-back of stats or mastery.
- **Authoring/grading live elsewhere.** This screen links out to the Space
  Editor (SPACES) and Student Report; it does not author spaces/items, grade,
  release results, or assign content.

---

## 9. Accessibility

Targets WCAG AA (FOUNDATION §2.4, §3; `specs/webapps-design.md` §2.4).

- **Focus order:** Skip-link → Sidebar → Topbar → main `h1` → space picker →
  class filter → "Edit space →" → "Export report" → KPI tiles (focusable only if
  they carry a link) → mastery ring (focusable container with an accessible
  summary) → funnel nodes (focusable if they deep-link) → per-class chart
  container → per-student `DataTable` (search → filters → sort → header cells →
  rows → pagination) → item-difficulty block (if present). Logical
  top-to-bottom, left-to-right within each region.
- **Keyboard:** space/class `Select`/`Combobox` fully operable (type-ahead,
  arrow, Enter, Esc; Radix `Select` — **never** an empty-string value, per the
  repo's own lesson). "Edit space →" and "Export report" are real `button`/link
  elements (Enter/Space). `DataTable` is fully keyboard-navigable (sortable
  headers as buttons with `aria-sort`, paginator buttons, row links via Enter).
  Chart bars and ring segments are not individually focusable; each chart/ring
  exposes an aria-described summary instead.
- **ARIA & semantics:** each section is a `<section>` with `aria-labelledby`
  pointing at its heading. Pickers have visible labels ("Space," "Class"). Each
  `StatCard` exposes label + value to AT (e.g.
  `aria-label="Average completion, 64 percent"`). The **mastery `ProgressRing`**
  carries `role="img"` with an `aria-label` summarizing the split ("Mastery: 11
  mastered, 13 in progress, 4 not started") and a visually-hidden data list. The
  **`StoryPointTrack`** funnel exposes each node's name + started/completed
  counts as text (not color/shape alone) and an overall aria summary. Charts
  (`SimpleBarChart`, `ClassHeatmap`, item difficulty) carry `role="img"` +
  `aria-label` and a visually-hidden data-table alternative — **charts are never
  the only representation**; the numbers are also reachable as text. The
  freshness caption uses a `<time>` element with `datetime`. `AtRiskBadge`
  includes the reason text in its accessible name, not color alone.
- **Contrast & non-color signals:** all text/bg pairs meet AA (FOUNDATION §2).
  **Status is never encoded by color alone** — the mastery ramp pairs
  `mastery.*` with "Mastered / In progress / Not started" labels + counts; the
  funnel pairs drop-off shading with numeric started/completed; the
  lowest-completion class bar pairs its tint with the class name + %; at-risk
  pairs `status.error` with the "At-risk" label + icon + reason text. All series
  remain distinguishable in grayscale.
- **Live regions:** `RouteAnnouncer` announces the route. Space/class switch
  announces the new selection + "loading" then "loaded" politely
  (`aria-live="polite"`). Export announces "Generating report" → "Report ready"
  / "Report failed." Toasts are polite, not assertive. `DataTable` filter/sort
  changes announce result counts politely.
- **Reduced motion:** honored per §6 — instant swaps, no ring fill / track / bar
  animate-in, border-only hover.

---

## 10. Web↔mobile divergence (RN parity)

Component **names and props match 1:1** between `shared-ui` (web) and
`ui-native` (mobile); only the renderer differs (FOUNDATION §6). Parity notes
for this screen:

- **Shell:** web `AppShell` (Sidebar + Topbar) → RN `PlatformLayout` with bottom
  tabs (`MobileBottomNav`); no ⌘K `CommandPalette` on mobile (FOUNDATION §6).
  Space + class selection live in route/nav params, so deep-links carry over.
- **Pickers:** web `Select`/`Combobox` popovers → RN native picker /
  bottom-sheet `Select`. Same option sources (`spaces.list`, `classes.list`),
  same `spaceId`/`classId` route params.
- **Funnel (`StoryPointTrack` aggregate):** the same headless aggregate data;
  web renders the horizontal/path track, RN renders the native track (vertical
  node list on narrow screens — which is also the web sm layout). Node tap (RN)
  replaces hover for the tooltip/deep-link.
- **Mastery `ProgressRing` & charts:** `ProgressRing`, `SimpleBarChart`,
  `ClassHeatmap` render via the RN charting renderer (same headless data, native
  draw). On small screens both platforms reduce chart height and avoid
  horizontal scroll; the heatmap degrades to a per-class bar list on narrow
  widths on _both_.
- **Per-student `DataTable` → stacked cards:** the web table collapses to
  stacked rows/cards on mobile (FOUNDATION §6 table rule), which is the
  **default** RN presentation; `useDataTable` headless
  search/sort/filter/pagination is shared, only the row renderer differs. Row
  tap → student report screen.
- **Export:** the `Toast` "Download" action opens the signed `pdfUrl` in the
  system browser / share sheet on RN rather than a new tab.
- **Interaction:** hover lifts/tooltips (web) → press / tap-to-reveal value
  (RN). Reduced-motion uses the platform flag; aria attributes map to
  `accessibilityLabel`/`accessibilityRole`.
- **No web-only feature is load-bearing:** picker, KPIs, mastery ring, funnel,
  per-class chart, per-student table, and export all have direct RN equivalents
  — this screen is fully portable.

---

## 11. A Claude-design prompt

```
You are designing ONE screen — "Space (Learning) Analytics" — for the Auto-LevelUp
TEACHER operational web portal, in the "Lyceum / Modern Scholarly" design system.

AUTHORITY (read and obey, in order):
1. docs/rebuild-spec/design/00-FOUNDATION.md — the design system. Use ONLY its tokens,
   type families (Fraunces display / Schibsted Grotesk UI / Spline Sans Mono numerics),
   spacing, radius (cards lg, inputs/buttons md, chips pill), elevation (e1 rest / e2 hover),
   and motion tokens (instant 100 / fast 160 / base 220; ease.standard/entrance/exit).
   Do NOT invent colors, fonts, spacing, or component variants. Cite tokens by semantic
   name (bg.canvas, bg.surface, text.secondary, brand.primary, status.error/success/warning,
   spark, and the mastery scale mastery.notStarted/inProgress/mastered). Warm paper neutrals
   + deep indigo primary + a single marigold "spark" reserved for ONE primary CTA glow only.
   No gamification chrome — this is a staff surface; mastery colors are shown read-only.
2. docs/rebuild-spec/design/teacher/space-analytics.md — THIS spec. Follow its layout,
   states, copy, and domain rules exactly.

SCREEN
- Route /analytics/spaces (space-scoped via ?spaceId=, optional &classId=). Roles: teacher
  (assigned spaces + managed classes only), tenantAdmin (all). Inside PlatformLayout →
  AppShell (Sidebar + Topbar; mobile tabs).
- Job: understand ONE learning space — engagement/completion KPIs, a story-point completion
  funnel, mastery distribution (notStarted/inProgress/mastered), per-class + per-student
  completion, time-on-task, item difficulty where available, and a PDF export.

LAYOUT (max-w 1200, desktop gutter 32):
- Header: h1 "Space analytics" (Fraunces) + space picker (Select/Combobox) + class filter
  (Select, default "All classes") + Badge(space type · status) + freshness caption
  "Updated {time}" (text.secondary) + ghost "Edit space →" (to /spaces/:id/edit) +
  right-aligned primary "Export report" button (the ONLY spark CTA).
- KPI strip: StatCard ×(4–5 REAL only) — Enrolled, Started (of N), Completed (of N),
  Average completion, Average time-on-task (omit time tile if stubbed). Mono numerics.
  grid-cols-1 (sm) → 2 (md) → 4/5 (lg).
- Mastery + funnel row (lg:grid-cols-2): LEFT = Mastery distribution = segmented ProgressRing
  using mastery.notStarted/inProgress/mastered + legend (label + count + %, never color-only).
  RIGHT = Completion funnel = StoryPointTrack in AGGREGATE, READ-ONLY mode (StoryPointNodes
  showing started→completed counts + drop-off shading, in orderIndex order; nodes may deep-link
  to the story-point preview).
- Completion by class (full-width): SimpleBarChart (per-class avg completion) OR ClassHeatmap
  (class×story-point) — omit if ≤1 class. Bars paired with class label + %.
- Student completion (full-width): DataTable (owns search / class filter / sort / pagination):
  avatar+name · class · completion% (ProgressRing/bar) · mastered/total · last active ·
  AtRiskBadge(read-only) · "View report →" → /students/:id/report.
- Item difficulty (full-width): DataTable or SimpleBarChart — RENDER ONLY IF backend supplies
  per-item difficulty; otherwise omit the card entirely.

RULES (non-negotiable):
- Read-only analysis. EVERY number is precomputed / server-authoritative (space rollup via
  analytics.getSummary; funnel + per-student via progress.getSpaceProgress; authoritative space
  stats). NEVER recompute a stat on the client — the legacy per-story-point count recompute
  (liveCounts / getCountFromServer) is REMOVED. Mastery comes from the progress engine; at-risk
  from the nightly rule engine — render isAtRisk/atRiskReasons verbatim, never derive on client.
- Show ONLY real metrics: omit any stubbed/absent metric (time-on-task=0, item difficulty
  absent, single-class per-class chart, topicPerformance:{}) rather than display a misleading 0;
  fall back to the picker's real space name if title looks like a placeholder.
- Tenant-isolated; teacher sees only assigned spaces + managed classes; one write only:
  analytics.generateReport (type progress) → returns a 1-hour signed pdfUrl (toast "Space report
  ready" + Download). No answer keys, no raw item content, no unreleased results, no destructive
  actions, no ConfirmDialog. Authoring lives in SPACES — "Edit space →" links out, never edits here.

STATES to render: loading skeleton (silhouette match); empty (no spaces / no activity / draft
notice / empty sub-sections with calm inline copy); error (ErrorState + Retry; access-denied
InlineAlert for out-of-scope spaceId); partial (funnel/breakdown unavailable → InlineAlert not an
empty track; item-difficulty/per-class card absent when stubbed; time tile omitted); success.

MOTION: space/class switch = cross-fade (exit fast 160 / entrance base 220), no layout jump.
Export = button loading spinner, toast on result, NO optimistic update. Respect
prefers-reduced-motion (instant swaps; no ring fill / track / bar animate-in).

A11Y: section landmarks with aria-labelledby; ProgressRing + StoryPointTrack + charts role="img"
+ aria-label summary + a visually-hidden data alternative (never the only representation); status
never color-only (mastery labels + counts, at-risk icon + reason text); StatCards expose
label+value to AT; <time> for freshness; DataTable headers aria-sort; polite live announcements on
space/class switch and export.

Deliver responsive React + the shared-ui components named above (StatCard, ProgressRing,
StoryPointTrack/StoryPointNode (aggregate, read-only), SimpleBarChart, ClassHeatmap, DataTable,
AtRiskBadge, Avatar, Select/Combobox, Button, Badge, Card, EmptyState, ErrorState, InlineAlert,
Toast, Skeleton). No new tokens or variants — compose strictly from FOUNDATION.
```
