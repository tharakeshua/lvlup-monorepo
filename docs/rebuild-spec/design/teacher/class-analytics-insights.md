# Class Analytics & Insights

> The teacher's read-only analysis console for a single class — "how is this
> class performing, where is it strong or weak, and who needs attention." A
> precise, credible reporting surface built entirely on precomputed,
> server-authoritative summaries: a class picker, a KPI strip, a
> score-distribution chart, a performance-over-time trend, top/bottom
> performers, a per-topic strength/weakness breakdown, an at-risk roster teaser,
> generated insight cards, and a PDF export. It surveys and deep-links; it never
> authors, grades, or recomputes a single statistic on the client.

**Route** `/analytics/classes` (class-scoped via `?classId=` / from
`/classes/:classId`) · **Roles** `teacher` (own classes only) · `tenantAdmin`
(all classes) · **Primary APIs** `analytics.getSummary` (scope `class`) ·
`analytics.getPerformanceTrends` (class) · `classes.list` (picker) →
`analytics.generateReport` (type `class`)

This spec conforms to `design/00-FOUNDATION.md` ("Lyceum / Modern Scholarly").
Every token, type, spacing, radius, elevation, motion value, and component is
cited by its FOUNDATION semantic name — no new tokens, fonts, colors, or
component variants are introduced. Per FOUNDATION §1 this is a **staff
operational surface**: it reads credible, focused, and calm — restraint in
chrome, no gamification celebration. The one place `spark` may appear is a
single primary "Export report" CTA glow; never as ambient decoration.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` (sees only the classes they manage) or a
`tenantAdmin` (sees every class in the active tenant). The job-to-be-done is
**diagnostic, not transactional**:

> _"Show me one class's performance at a glance, surface its score distribution
> and trend over time, tell me which topics it's strong and weak in, point me at
> the students who are slipping, and let me export a shareable report — without
> me recomputing anything or digging into raw submissions."_

This is the **understand-the-class** surface. It complements (does not replace):

- **Class Detail / Roster** (`/classes/:classId`) — the operational roster
  (enroll, assign, manage). Analytics deep-links _to_ it.
- **At-Risk Students** (`/students` filtered, or the at-risk surface) — the full
  intervention roster. The at-risk teaser here links _out_ to it.
- **Student Detail / Progress** (`/students/:studentId/report`) — a single
  learner's read-only state. Performer rows and the at-risk teaser link _out_ to
  it.
- **Exam Analytics** (`/analytics/exams`) — per-_exam_
  item-difficulty/discrimination analysis. This screen is per-_class_,
  aggregated across activity.

**Explicitly NOT this screen's job** (FOUNDATION + domain rules): authoring
spaces/items (SPACES area), grading or releasing results (EXAMS area /
GradingReview), editing rosters, or **any client-side recomputation of scores,
pass rates, completion, or risk**. Every number on this screen is read from a
precomputed summary document; the client renders, it never aggregates.

**Emotional register:** precise, calm, professional. No XP meter, streak flame,
or level-up burst. At-risk is surfaced soberly (`AtRiskBadge` + reason text),
framed as _signal for intervention_, never as a punitive or celebratory accent.

---

## 2. Entry points & route

**Route:** `/analytics/classes`, gated by
`RequireAuth allow={['teacher','tenantAdmin']}` (FOUNDATION §4 single
config-driven guard; `specs/webapps-design.md` §4.2). It is the **Analytics →
Classes** nav item (`navMeta.group: 'Analytics'`, label "Classes"). Class
selection is carried as a URL search param (`/analytics/classes?classId=...`) so
a selected class is a deep-link / back-button-stable / RN-navigable state —
never local-only component state.

**Entry points:**

- **Analytics → Classes** sidebar item (`AppSidebar`); the default `classId` is
  the first class the caller can see (or none → picker-only empty state).
- **From Class Detail** (`/classes/:classId`): a "View analytics →" action
  navigates to `/analytics/classes?classId=:classId` with that class
  preselected.
- **From the Dashboard** "View analytics →" header CTA and from the
  "low-performing classes" attention rows.
- `CommandPalette` (⌘K) "Class analytics" → opens with the last-viewed or first
  class.

**Reads powering it** (all via `@levelup/api-client` repositories /
`shared-hooks/headless`; UI never touches Firestore or builds collection paths —
`specs/webapps-design.md` §6, common-api §3.3):

- **`classes.list`** → the class picker option set. Server scopes this to
  `ctx.classIds` (claim `classIds` / `managedClassIds`, with the
  `classIdsOverflow >15` Firestore fallback per auth-access §1.3) for a
  `teacher`; full tenant set for a `tenantAdmin`. `tenantId` is derived from
  claims server-side — **never a request field**.
- **`analytics.getSummary`** with `scope: 'class'`, `classId` = the selected
  class. Membership-checked server-side; returns the precomputed
  **`ClassProgressSummary`** (`classProgressSummaries/{classId}`, written by the
  `onStudentSummaryUpdated` trigger — be-analytics §2). Shape consumed:
  - `className`, `studentCount`
  - `autograde`: `averageClassScore` (0–1), `examCompletionRate` (0–1),
    `topPerformers[]`/`bottomPerformers[]` (`{studentId, name, avgScore}`)
  - `levelup`: `averageClassCompletion` (0–1), `activeStudentRate` (0–1),
    `topPointEarners[]`
  - `atRiskStudentIds[]`, `atRiskCount`, `lastUpdatedAt`
- **`analytics.getPerformanceTrends`** (class scope) → the
  **performance-over-time** series (avg score / completion sampled over recent
  periods) and, where the backend supplies it, the **score-distribution
  buckets** and **per-topic strength/weakness** breakdown. This is the
  server-side aggregation endpoint (common-api §3.3, new) — the client never
  reconstructs trend by fanning out over submissions.

**Writes:** exactly one — **`analytics.generateReport`** with `type: 'class'`,
`classId` = selected class (rate-limited `'report',5` server-side; be-analytics
§1). It builds a class PDF, uploads to `tenants/{tenantId}/reports/classes/...`,
and returns `{ pdfUrl, expiresAt }` — a **1-hour signed URL** (common-api §3.3;
be-analytics §1). No other mutation is reachable from this surface. There is no
inline edit, no stat write-back, no risk override.

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
│         │  │ h1 "Class analytics"                                            │   │
│         │  │ [ Class: Grade 10 — Section A  ▾ ]   "Updated 2h ago"  [Export]│   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ KPI STRIP (StatCard ×4, grid) ────────────────────────────────┐   │
│         │  │ ▸Avg score   ▸Pass rate   ▸Completion   ▸At-risk               │   │
│         │  │  72%          81%          64%            3 of 28              │   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ 2-col charts region (lg) ─────────────────────────────────────┐   │
│         │  │ ┌ Score distribution (Card) ──┐ ┌ Performance over time (Card)┐│   │
│         │  │ │ ScoreDistribution histogram │ │ SimpleBarChart / line trend ││   │
│         │  │ │  buckets 0–20 … 81–100      │ │  last N periods, avg score  ││   │
│         │  │ └─────────────────────────────┘ └─────────────────────────────┘│   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ TOPIC STRENGTH / WEAKNESS (Card, full-width) ─────────────────┐   │
│         │  │ ClassHeatmap  OR  SimpleBarChart (per-topic avg)               │   │
│         │  │  Algebra ▇▇▇▇▇  · Geometry ▇▇  · Trig ▇▇▇▇  …   [strong|weak]  │   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ 2-col performers + at-risk (lg) ──────────────────────────────┐   │
│         │  │ ┌ Top & bottom performers (Card) ┐ ┌ Needs attention (Card) ──┐│   │
│         │  │ │ DefinitionList / row list:      │ │ AtRiskBadge roster teaser ││   │
│         │  │ │  Top 5  · name · avg% → report  │ │  • name · reasons →       ││   │
│         │  │ │  Bottom 5 · name · avg% → report│ │  • name · reasons →       ││   │
│         │  │ └─────────────────────────────────┘ │  [ View all at-risk →  ]  ││   │
│         │  │                                      └───────────────────────────┘│   │
│         │  └────────────────────────────────────────────────────────────────┘   │
│         │  ┌─ INSIGHTS (InsightCard list, full-width) ──────────────────────┐   │
│         │  │ • InsightCard (generated) — type · summary · [dismiss] [open →]│   │
│         │  │ • InsightCard …                                                │   │
│         │  └────────────────────────────────────────────────────────────────┘   │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

**Region order & grid:**

1. **Page header** — `h1` "Class analytics" (Fraunces display). Below/right: the
   **class picker** (`Select`/`Combobox`), a `lastUpdatedAt` freshness caption
   (`text.secondary`, e.g. "Updated 2h ago"), and a right-aligned **"Export
   report"** `Button` (the one permitted `spark`/primary CTA). On md+ the picker
   and Export sit on one row with the title; on sm they stack.
2. **KPI strip** — four `StatCard`s in a grid: `grid-cols-1` (sm) →
   `grid-cols-2` (md) → `grid-cols-4` (lg+). `gap` = space-4/`16`. Avg score ·
   Pass rate · Completion · At-risk count (`n of studentCount`).
3. **Charts region** — `grid-cols-1` (sm/md) → `lg:grid-cols-2` (lg+), `gap` =
   space-6/`24`. Left = **Score distribution** (`ScoreDistribution`); right =
   **Performance over time** (`SimpleBarChart`/trend).
4. **Topic strength/weakness** — full-width `Card`. `ClassHeatmap` when
   topic×cohort data is dense; otherwise a horizontal per-topic `SimpleBarChart`
   labeled strong (`status.success`) → weak (`status.error`).
5. **Performers + at-risk** — `grid-cols-1` (sm/md) → `lg:grid-cols-2` (lg+),
   `gap` = space-6/`24`. Left = **Top & bottom performers**
   (`DefinitionList`/row list from `topPerformers`/`bottomPerformers`); right =
   **Needs attention** at-risk teaser (`AtRiskBadge` rows, capped at ~5, with
   "View all at-risk →").
6. **Insights** — full-width list of `InsightCard`s (generated server-side; see
   §8). Omitted entirely if none.

**Responsive summary:**

- **sm (<768):** single column throughout; KPIs stack 1-up then 2-up; charts
  stack (distribution first, then trend); topic chart full-width; performers
  then at-risk stacked; header picker and Export stack under the title (Export
  full-width). Charts render at reduced height with horizontal scroll suppressed
  (bars wrap to the container).
- **md (768–1023):** KPIs 2×2; charts stack vertically (distribution above
  trend); performers/at-risk stack; header on two rows (title row, then picker +
  Export row).
- **lg+ (≥1024):** KPIs 4-up; charts 2-up; performers/at-risk 2-up; content
  centered within max-w 1200; topic chart spans full width.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`specs/webapps-design.md`
§2.2, esp. `@levelup/shared-ui/charts` and `/data`). No new primitives are
introduced.

| Region                    | Component(s)                                                                                                                                                                                                                              | Notes                                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell                     | `AppShell`, `Sidebar`, `Topbar`, `NotificationBell`, `CommandPalette`, `MobileBottomNav` (mobile), `SkipToContent`, `RouteAnnouncer`                                                                                                      | Provided by `PlatformLayout`; not rebuilt here.                                                                                                                                                                                                |
| Header                    | `Select`/`Combobox` (class picker), `Button` (primary "Export report"; ghost on disabled), `Breadcrumb` (optional: Analytics / Classes / {className}), `Badge` (freshness/`lastUpdatedAt` caption is plain `text.secondary`, not a badge) | Fraunces `h1`. `spark` permitted only on the Export CTA glow.                                                                                                                                                                                  |
| KPI strip                 | `StatCard` (a.k.a. `Stat/KPI`) ×4                                                                                                                                                                                                         | Mono numerics (Spline Sans Mono) per FOUNDATION §3. Each: label + value + optional small caption (e.g. "x of N"). At-risk KPI value uses `status.error` text tint when `atRiskCount > 0` (paired with the "At-risk" label — never color-only). |
| Score distribution        | `ScoreDistribution` (charts)                                                                                                                                                                                                              | Histogram over score buckets from `getPerformanceTrends`. Bars use neutral `brand.primary`; failing bucket (<passing) may tint `status.error`.                                                                                                 |
| Performance over time     | `SimpleBarChart` (charts)                                                                                                                                                                                                                 | Avg score (or completion) over recent periods. Single series, `brand.primary`.                                                                                                                                                                 |
| Topic strength/weakness   | `ClassHeatmap` (dense topic×metric) or `SimpleBarChart` (per-topic)                                                                                                                                                                       | Strong→weak ramp uses `status.success` → `status.warning` → `status.error` (FOUNDATION §2.3 mastery/grade scales), always paired with the topic label + numeric.                                                                               |
| Top & bottom performers   | `DefinitionList` (or row list) + `Avatar` + `GradePill`/inline `%` + `Button` (ghost row-link)                                                                                                                                            | Each row links to `/students/:studentId/report`.                                                                                                                                                                                               |
| Needs attention (at-risk) | `Card` + `AtRiskBadge` + reason `Chip`/text + `Avatar` + `Button` (ghost "View all at-risk →")                                                                                                                                            | `AtRiskBadge` renders `isAtRisk` + `atRiskReasons` **read-only**; never computed client-side.                                                                                                                                                  |
| Insights                  | `InsightCard` (list), `Button` (ghost "Open →"), `IconButton` (dismiss)                                                                                                                                                                   | Generated server-side by `generateInsights`; see §8.                                                                                                                                                                                           |
| Loading                   | `Skeleton`                                                                                                                                                                                                                                | Silhouettes the final layout (header, 4 KPI tiles, 2 chart blocks, topic block, 2 columns, insight rows).                                                                                                                                      |
| Empty / error / partial   | `EmptyState`, `ErrorState`/`InlineAlert`                                                                                                                                                                                                  | Distinct empty (no class / no data yet) vs error (read failed). Per-section partial banners (`InlineAlert`) for absent sub-metrics.                                                                                                            |
| Export feedback           | `Toast` (sonner), `LoadingOverlay`/button spinner                                                                                                                                                                                         | Report generation progress + success/failure.                                                                                                                                                                                                  |

**Proposed addition — none required.** "Performer row," "topic row," and the
at-risk teaser row are compositions of existing `DefinitionList` / `Avatar` /
`AtRiskBadge` / `Chip` / `Button` parts, not new primitives. If the team later
wants a named `ClassMetricRow` composite it belongs in `shared-ui/data` as pure
composition — **not** a new token or variant. The "ScoreDistribution /
SimpleBarChart / ClassHeatmap / StatCard / InsightCard / AtRiskBadge /
DefinitionList" set named in this screen's brief already exists in the
`shared-ui/charts` + `/data` inventory (`specs/webapps-design.md` §2.2).

---

## 5. States

Every state is rendered from the read hooks over `@levelup/api-client`; no state
derives a metric on the client.

**5.1 Loading (skeleton).** On first load (or class change), show a `Skeleton`
matching the final silhouette: header row (title + picker placeholder + Export
disabled), 4 KPI tiles, 2 chart blocks, 1 full-width topic block, a 2-column
performers/at-risk pair, and 2–3 insight rows. Skeleton uses `bg.surface-sunken`
shimmer; no layout shift when data resolves. The class picker itself loads from
`classes.list` first and stays interactive while the summary/trends load (so the
user can re-pick during a slow fetch).

**5.2 Empty.**

- **No classes visible** (a `teacher` with zero managed classes): `EmptyState` —
  title "No classes to analyze," body "You don't manage any classes in this
  tenant yet. Ask your admin to assign you a class." Picker hidden; no KPI
  strip. (Permission-correct: server returned an empty `classes.list`.)
- **Class selected but no analytics computed yet** (new class, no graded
  activity → no `classProgressSummaries/{classId}` doc, or
  `studentCount === 0`): `EmptyState` inside the content area — title "No data
  for this class yet," body "Analytics appear once students complete exams or
  learning activity in this class." KPI strip, charts, and insights are replaced
  by the single empty card; the picker and Export-disabled remain.
- **Section-level empty** (summary exists but a sub-section is empty, e.g. no
  insights, no at-risk students): that section shows a quiet inline empty (no
  card chrome) — e.g. "No students currently flagged at-risk." / "No insights
  generated for this class yet." The at-risk _empty_ is a calm, positive-neutral
  line, not a success celebration.

**5.3 Error.** If `getSummary` (class) fails: full-content `ErrorState` — title
"Couldn't load class analytics," body "Something went wrong fetching this
class's summary." + a "Retry" `Button` (refetches the query). The picker stays
usable (switching class re-attempts). A `getPerformanceTrends` failure does
**not** blank the whole page — it degrades to a **partial** state (below). A
`403`/membership-denied response (e.g. URL hand-edited to a `classId` the caller
can't access) renders the same `RequireAuth`-style "Access denied" `InlineAlert`
in the content region: "You don't have access to this class," and resets the
picker to an allowed class.

**5.4 Partial.** This screen composes several reads and several sub-metrics,
**some of which the backend currently stubs** (be-analytics §4: `streakDays:0`,
`discriminationIndex:0`, `topicPerformance:{}`, `className` placeholder,
`correlationData` fixed stub). **Show only real metrics — never render a
placeholder zero as truth.** Rules:

- If `getPerformanceTrends` fails or returns no series → KPI strip +
  distribution + performers + at-risk still render from `getSummary`; the
  **Performance-over-time** card shows an inline `InlineAlert` "Trend data
  unavailable" (not a zero-line chart).
- If **topic performance** is empty/stubbed (`topicPerformance: {}`) → **omit
  the topic card entirely** (do not draw an empty heatmap). The section simply
  does not appear.
- If a specific KPI's source is a known stub → omit that tile rather than show
  `0%`. The KPI strip renders 2–4 real tiles, not always 4.
- If `className` looks like a placeholder (equals the `classId`) → fall back to
  the picker's label (from `classes.list`), which carries the real name.
- A small, dismissible `InlineAlert` may note "Some metrics are still being
  computed" only when a section is omitted for staleness — keep it factual,
  never alarming.

**5.5 Success.** Full render: header with selected class + freshness caption +
enabled Export; 2–4 real KPI tiles; score distribution; performance trend (if
available); topic strength/weakness (if real); top/bottom performers; at-risk
teaser (or its calm empty); insights (or omitted). All numbers carry their
source freshness from `lastUpdatedAt`.

**5.6 Permission-gated variants by role.**

- **`teacher`:** picker contains only managed classes;
  `getSummary`/`getPerformanceTrends`/`generateReport` are membership-checked
  server-side. No tenant-wide rollups, no cross-class comparison, no
  AI-cost/quota chrome (that is admin/dashboard territory). At-risk teaser and
  performer rows link only to students within the caller's reach.
- **`tenantAdmin`:** picker contains all tenant classes (may be long →
  `Combobox` with search). Otherwise identical surface — this screen is
  per-class for both roles; an admin who wants cross-class comparison uses a
  separate overview, not this screen. No extra write affordances are unlocked
  (Export is available to both roles).
- **Neither role sees** answer keys, raw per-question content, or unreleased
  exam results — this surface reads aggregates only (domain §8).

---

## 6. Interactions & motion

Motion is "felt, not seen" (FOUNDATION §4): subtle entrances, no celebratory
pops on this staff surface. All durations/easings cite FOUNDATION motion tokens.

**6.1 Class switch (primary flow).** Selecting a class in the picker:

- Updates the URL search param (`?classId=...`) — back/forward navigable;
  RN-portable (route param).
- KPI/charts/performers/at-risk/insight regions cross-fade: outgoing content
  `ease.exit` over `fast 160ms`, skeleton/new content `ease.entrance` over
  `base 220ms`. No full-page reload, no layout jump (skeleton holds the
  silhouette).
- The freshness caption and Export's `classId` update together.
- React Query caches per `classId`, so re-selecting a recently viewed class is
  instant (no skeleton; just a content swap).

**6.2 Export report.** Clicking **"Export report"**:

- Button enters loading: spinner + label "Generating report…", disabled
  (FOUNDATION button loading state). A `Toast` (sonner) "info" may accompany on
  slow generation. Optionally a `LoadingOverlay` is **not** used (non-blocking;
  the rest of the page stays interactive).
- On success (`{ pdfUrl, expiresAt }`): a `Toast` "success" — "Class report
  ready" with a "Download" action that opens `pdfUrl` in a new tab. Because the
  URL is a **1-hour signed URL** (be-analytics §1), the toast/affordance notes
  nothing about expiry inline, but a re-click after expiry simply regenerates.
- On failure (incl. rate-limit `'report',5`): `Toast` "error" — "Couldn't
  generate the report. Please try again in a moment." Button returns to idle. No
  optimistic state — report generation is a real server job, so there is **no
  optimistic update**; the UI reflects the actual callable result.

**6.3 Dismiss an insight.** The `InsightCard` dismiss (`IconButton`) is the only
other mutation-shaped action and is **optional** (an insight is dismissed via
the notifications/insights write path, not a direct Firestore write). If wired:
optimistic removal of the card (`ease.exit` collapse over `fast 160ms`) with
rollback + `Toast` "error" on failure. If not wired in v1, the dismiss control
is hidden and `InsightCard` is read-only with an "Open →" deep-link only.

**6.4 Row navigation.** Performer rows and at-risk rows are links (hover → `e2`
elevation lift + `bg.surface-sunken` row tint, `instant 100ms`). "View all
at-risk →" routes to the at-risk students surface pre-filtered to this class.
"Open →" on an `InsightCard` routes to the insight's target (a student report or
class detail).

**6.5 Chart interaction.** Hovering a distribution/trend bar shows a `Tooltip`
(FOUNDATION `Tooltip`) with the bucket range + count / period + value (mono
numerics). Tooltips fade `instant 100ms`. No drill-down click in v1 (charts are
read-only summaries); a bar may optionally link the distribution bucket to a
filtered roster later, but that is out of scope here.

**6.6 Refresh / freshness.** No auto-refresh (these are precomputed, read-cheap
single docs; be-analytics §3). The `lastUpdatedAt` caption is the trust signal.
An optional manual "Refresh" `IconButton` next to the caption refetches
`getSummary` + `getPerformanceTrends` (spinner during, `base 220ms`).

**6.7 Confirmations.** No destructive actions on this surface → **no
`ConfirmDialog`**. Export and dismiss are non-destructive; navigation is free.

**Reduced motion:** with `prefers-reduced-motion`, cross-fades become instant
content swaps, hover lifts drop to a border-only change, and chart bars do not
animate-in (they render at final height). (FOUNDATION §4.)

---

## 7. Content & copy

Staff tone: direct, factual, calm. No exclamation marks, no gamified or
congratulatory copy.

**Headings & labels**

- Page title (`h1`): **"Class analytics"**
- Class picker label / placeholder: **"Class"** / **"Select a class"**
- Freshness caption: **"Updated {relativeTime}"** (e.g. "Updated 2 hours ago");
  on hover, a `Tooltip` shows the absolute timestamp.
- Export button: **"Export report"** (loading: **"Generating report…"**)
- KPI tiles: **"Average score"**, **"Pass rate"**, **"Completion"**,
  **"At-risk"** (value rendered as **"{n} of {studentCount}"**)
- Section titles: **"Score distribution"**, **"Performance over time"**,
  **"Topic strengths & weaknesses"**, **"Top & bottom performers"** (subheads
  **"Top performers"** / **"Bottom performers"**), **"Needs attention"**,
  **"Insights"**
- Performers row: `{name}` · `{avgScore}%` · trailing **"View report →"**
- At-risk row: `{name}` + `AtRiskBadge` + reason chips; trailing **"View student
  →"**; footer link **"View all at-risk →"**
- Topic legend: **"Strong"** / **"Needs work"** (paired with the color ramp;
  never color-only)

**Empty-state copy**

- No classes: title **"No classes to analyze"** · body **"You don't manage any
  classes in this tenant yet. Ask your admin to assign you a class."**
- No data for class: title **"No data for this class yet"** · body **"Analytics
  appear once students complete exams or learning activity in this class."**
- No at-risk students: **"No students are currently flagged at-risk."**
- No insights: **"No insights generated for this class yet."**
- Trend/topic omitted (partial): inline **"Trend data unavailable"** / topic
  card simply absent (no copy needed).

**Error copy**

- Summary load failed: title **"Couldn't load class analytics"** · body
  **"Something went wrong fetching this class's summary."** · action **"Retry"**
- Access denied (out-of-scope class): **"You don't have access to this class."**
- Export failed: **"Couldn't generate the report. Please try again in a
  moment."**
- Partial-metrics note: **"Some metrics are still being computed."**

**Success copy**

- Export ready: **"Class report ready"** · action **"Download"**

**Numeric formatting:** percentages shown as whole-number `%` (Spline Sans
Mono); 0–1 source values are formatted at the view edge (`avgScore`,
`examCompletionRate`, etc. ×100, rounded). At-risk is a count, not a percent.

---

## 8. Domain rules surfaced

- **Read-cheap, precomputed, server-authoritative.** Every metric comes from
  `classProgressSummaries/{classId}` (via `analytics.getSummary` scope `class`)
  or the server-side `analytics.getPerformanceTrends` aggregation. The client
  **never** recomputes average score, pass rate, completion, distribution, or
  risk (FOUNDATION/domain rules; be-analytics §3 precompute-on-write).
- **At-risk is read-only signal.** `atRiskStudentIds`/`atRiskCount` (class) and
  `isAtRisk`/`atRiskReasons` (per student) come from the **nightly rule engine**
  (`nightlyAtRiskDetection` + `at-risk-rules.ts`; be-analytics §1). The UI
  surfaces them verbatim via `AtRiskBadge` + reason text and **never derives
  risk on the client**. Note: the rule engine emits `zero_streak`; the
  `no_recent_activity` enum value is never produced (be-analytics §4) — render
  whatever reasons the summary carries, don't hardcode a reason vocabulary.
- **Show only real metrics.** Several backend metrics are known stubs
  (`topicPerformance:{}`, `discriminationIndex:0`, `streakDays:0`,
  `correlationData` fixed, `className`=`classId` placeholder; be-analytics §4).
  Per §5.4 the screen **omits** any stubbed/empty metric rather than display a
  misleading zero, and falls back to the picker's real class name.
- **Tenant isolation.** All reads/writes are scoped to the caller's active
  tenant; `tenantId` is derived from claims server-side, never a form/URL field.
  No cross-tenant class is ever selectable (the picker is built from
  `classes.list`, itself tenant-scoped).
- **Role scoping.** A `teacher` sees only managed classes (claim
  `classIds`/`managedClassIds`, with the `classIdsOverflow >15` Firestore
  fallback; auth-access §1.3). A `tenantAdmin` sees all tenant classes.
  `getSummary`/`getPerformanceTrends`/`generateReport` independently
  membership-check server-side — a hand-edited out-of-scope `classId` is denied,
  not silently served (auth-access §1.6).
- **No answer keys, no raw results, no unreleased data.** This surface reads
  aggregates only. It never exposes answer keys (Admin-SDK-only; auth-access
  §2), never renders raw per-question submission content, and never surfaces
  unreleased exam results — aggregates honor results-released gating upstream
  (the summaries only roll up released/graded activity).
- **Reads via repos, writes via callables.** No direct client Firestore access
  (`specs/webapps-design.md` §6); the single write (`generateReport`) is a
  callable returning a signed URL — there is no client-side PDF assembly and no
  client write-back of stats.
- **Authoring/grading live elsewhere.** This screen links out to Class Detail,
  Student Report, and the at-risk roster; it does not author spaces/items or
  grade/release exams.

---

## 9. Accessibility

Targets WCAG AA (FOUNDATION §2.4, §3; `specs/webapps-design.md` §2.4).

- **Focus order:** Skip-link → Sidebar → Topbar → main `h1` → class picker →
  Export button → KPI tiles (each focusable if it carries a link, else not in
  tab order) → chart cards (focusable container with an accessible summary) →
  topic card → performer rows (links) → at-risk rows + "View all" → insight
  cards (Open / dismiss). Logical top-to-bottom, left-to-right within each
  region.
- **Keyboard:** class `Select`/`Combobox` fully operable (type-ahead, arrow,
  Enter, Esc; Radix `Select` — never an empty-string value, per the repo's own
  lesson). Export is a real `button` (Enter/Space). All row links are
  `<a>`/router links (Enter). `IconButton` dismiss has an accessible name. Chart
  bars are not individually focusable; instead each chart exposes an
  aria-described summary (see below).
- **ARIA & semantics:** each section is a `<section>` with an `aria-labelledby`
  pointing at its heading. The class picker has a visible label "Class." Each
  `StatCard` exposes label + value to AT (e.g.
  `aria-label="Average score, 72 percent"`); the at-risk tile reads "At-risk, 3
  of 28." `AtRiskBadge` includes the reason text in its accessible name, not
  color alone. **Charts** (`ScoreDistribution`, `SimpleBarChart`,
  `ClassHeatmap`) carry `role="img"` with an `aria-label` summarizing the data
  ("Score distribution: most students in the 61–80 band") and, where present, a
  visually-hidden data table alternative for screen-reader users — charts are
  **never the only representation**; the underlying numbers are also reachable
  as text. Freshness caption uses a `<time>` element with `datetime`.
- **Contrast & non-color signals:** all text/bg pairs meet AA (FOUNDATION §2).
  **Status is never encoded by color alone** — at-risk pairs `status.error` with
  the "At-risk" label + an icon + reason text; the topic strong→weak ramp always
  pairs the color with the topic name and its numeric value and a "Strong /
  Needs work" legend; failing distribution buckets carry a label, not just a red
  bar. Chart series remain distinguishable in grayscale.
- **Live regions:** `RouteAnnouncer` announces the route. Class switch announces
  the new class + "loading" then "loaded" politely (`aria-live="polite"`).
  Export announces "Generating report" → "Report ready" / "Report failed."
  Toasts are polite, not assertive.
- **Reduced motion:** honored per §6 — instant swaps, no chart animate-in,
  border-only hover.

---

## 10. Web↔mobile divergence (RN parity)

Component **names and props match 1:1** between `shared-ui` (web) and
`ui-native` (mobile); only the renderer differs (FOUNDATION §6). Parity notes
for this screen:

- **Shell:** web `AppShell` (Sidebar + Topbar) → RN `PlatformLayout` with bottom
  tabs (`MobileBottomNav`); no ⌘K `CommandPalette` on mobile (FOUNDATION §6).
  Class selection still lives in the route/nav params, so deep-links carry over.
- **Class picker:** web `Select`/`Combobox` popover → RN native picker /
  bottom-sheet `Select`. Same option source (`classes.list`), same `classId`
  route param.
- **Charts:** `ScoreDistribution` / `SimpleBarChart` / `ClassHeatmap` render via
  the RN charting renderer (same headless data, native draw). On small screens
  both platforms reduce chart height and avoid horizontal scroll; the heatmap
  degrades to the per-topic bar list on narrow widths on _both_.
- **Layout:** web's 2-up chart and performer/at-risk grids collapse to
  single-column stacks — which is the **default** RN layout. Page gutters map to
  RN safe-area + the FOUNDATION mobile gutter (16).
- **Interaction:** hover lifts/tooltips (web) → press states / long-press or
  tap-to-reveal value (RN). The Export `Toast` "Download" action opens the
  signed `pdfUrl` in the system browser / share sheet on RN rather than a new
  tab.
- **Tables→cards:** performer "rows" are already row/list compositions (not a
  `DataTable`), so they render natively as stacked rows on RN without a
  web-table fallback.
- **Reduced motion / a11y:** the same tokens and the same aria/data-table chart
  alternative apply; RN uses the platform reduce-motion flag and
  `accessibilityLabel`/`accessibilityRole` equivalents of the web aria
  attributes.
- **No web-only feature is load-bearing:** everything (picker, KPIs, charts,
  performers, at-risk, insights, export) has a direct RN equivalent — this
  screen is fully portable.

---

## 11. A Claude-design prompt

```
You are designing ONE screen — "Class Analytics & Insights" — for the Auto-LevelUp
TEACHER operational web portal, in the "Lyceum / Modern Scholarly" design system.

AUTHORITY (read and obey, in order):
1. docs/rebuild-spec/design/00-FOUNDATION.md — the design system. Use ONLY its tokens,
   type families (Fraunces display / Schibsted Grotesk UI / Spline Sans Mono numerics),
   spacing, radius (cards lg, inputs/buttons md, chips pill), elevation (e1 rest / e2 hover),
   and motion tokens (instant 100 / fast 160 / base 220; ease.standard/entrance/exit).
   Do NOT invent colors, fonts, spacing, or component variants. Cite tokens by semantic
   name (bg.canvas, bg.surface, text.secondary, brand.primary, status.error/success/warning,
   spark). Warm paper neutrals + deep indigo primary + a single marigold "spark" reserved
   for ONE primary CTA glow only. No gamification chrome — this is a staff surface.
2. docs/rebuild-spec/design/teacher/class-analytics-insights.md — THIS spec. Follow its
   layout, states, copy, and domain rules exactly.

SCREEN
- Route /analytics/classes (class-scoped via ?classId=). Roles: teacher (own classes),
  tenantAdmin (all classes). Inside PlatformLayout → AppShell (Sidebar + Topbar; mobile tabs).
- Job: understand ONE class — performance, distribution, trend, topic strengths/weaknesses,
  top/bottom performers, at-risk teaser, generated insights, and a PDF export.

LAYOUT (max-w 1200, desktop gutter 32):
- Header: h1 "Class analytics" (Fraunces) + class picker (Select/Combobox) + freshness
  caption "Updated {time}" (text.secondary) + right-aligned primary "Export report" button
  (the ONLY spark CTA).
- KPI strip: StatCard ×(2–4 REAL only) — Average score, Pass rate, Completion, At-risk
  ("{n} of {N}", value tinted status.error when >0, paired with label+icon). Mono numerics.
  grid-cols-1 (sm) → 2 (md) → 4 (lg).
- Charts row (lg:grid-cols-2): ScoreDistribution (histogram) | SimpleBarChart
  (performance over time). brand.primary bars; failing bucket may tint status.error.
- Topic strengths & weaknesses (full-width): ClassHeatmap OR per-topic SimpleBarChart,
  strong→weak ramp status.success→warning→error, ALWAYS paired with label + numeric +
  a "Strong / Needs work" legend. OMIT this card entirely if topic data is empty/stubbed.
- Performers + at-risk (lg:grid-cols-2): left = Top & bottom performers (DefinitionList /
  rows: avatar · name · avg% · "View report →" link to /students/:id/report); right =
  "Needs attention" at-risk teaser (AtRiskBadge + reason text, ≤5 rows, "View all at-risk →").
- Insights (full-width): InsightCard list (type · summary · "Open →"), omitted if none.

RULES (non-negotiable):
- Read-only analysis. EVERY number is precomputed/server-authoritative (ClassProgressSummary
  via analytics.getSummary scope=class; trend/distribution/topics via analytics.getPerformanceTrends).
  NEVER recompute a stat on the client. At-risk comes from the nightly rule engine — render
  isAtRisk/atRiskReasons verbatim, never derive risk client-side.
- Show ONLY real metrics: omit any stubbed/empty metric (topicPerformance:{}, zeros) rather
  than display a misleading 0; fall back to the picker's real class name if className looks
  like a placeholder.
- Tenant-isolated; teacher sees only managed classes; one write only: analytics.generateReport
  (type class) → returns a 1-hour signed pdfUrl (toast "Class report ready" + Download). No
  answer keys, no raw results, no destructive actions, no ConfirmDialog.

STATES to render: loading skeleton (silhouette match); empty (no classes / no data for class /
empty sub-sections with calm inline copy); error (ErrorState + Retry; access-denied InlineAlert
for out-of-scope classId); partial (trend unavailable → InlineAlert, not a zero chart; topic card
absent when stubbed); success.

MOTION: class switch = cross-fade (exit fast 160 / entrance base 220), no layout jump.
Export = button loading spinner, toast on result, NO optimistic update. Respect
prefers-reduced-motion (instant swaps, no chart animate-in).

A11Y: section landmarks with aria-labelledby; charts role="img" + aria-label summary + a
visually-hidden data-table alternative (charts never the only representation); status never
color-only (icon + label + reason text); StatCards expose label+value to AT; <time> for
freshness; polite live announcements on class switch and export.

Deliver responsive React + the shared-ui components named above (StatCard, ScoreDistribution,
SimpleBarChart, ClassHeatmap, InsightCard, AtRiskBadge, DefinitionList, Select/Combobox, Button,
Card, EmptyState, ErrorState, InlineAlert, Toast, Skeleton). No new tokens or variants — compose
strictly from FOUNDATION.
```
