# Analytics (Tenant)

> Per-screen design spec. Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md` ("Lyceum"). All tokens are cited
> by semantic name — no hex is re-pasted. This is **tenant-admin tooling**: the
> serious, precise register (restraint in chrome), NOT the playful student
> register. This page is scoped to **ONE tenant** — tenant isolation is a hard
> domain rule here.

- **Area:** admin (tenant control plane)
- **Route:** `/analytics`
- **Role / audience:** `tenantAdmin` (scoped to their single tenant). Sibling
  page, NOT this one, serves cross-tenant super-admins:
  `docs/rebuild-spec/design/admin/platform-analytics.md` is `superAdmin`-only at
  the same path in the _super-admin_ app.
- **Live code this replaces:** `apps/admin-web/src/pages/AnalyticsPage.tsx`,
  shell `apps/admin-web/src/layouts/AppLayout.tsx`.

---

## 1. Purpose & primary user

**Primary user:** a `tenantAdmin` — an academy administrator with an active
`tenantAdmin` membership row for exactly one tenant (`auth-access.md` line 55,
lines 101–103: identity functions `assertTenantAdminOrSuperAdmin`, verified via
the membership doc + `active`). They are **not** cross-tenant; everything on
this page is bounded to `useCurrentTenantId()`.

**Job-to-be-done:** _"Across my academy, how are students performing on exams,
how far through their learning spaces are they, which classes are lagging, and
which students are at risk — so I know where to intervene, who to congratulate,
and which class to drill into."_

This is the **engagement + performance + at-risk** surface for one academy. It
is distinct from `/llm-usage` (AI cost/budget — `DailyCostSummary`,
`be-analytics.md` §1) and from teacher-web's per-class views. It answers four
questions:

1. **Performance** — average exam score across the academy and per class.
2. **Progress** — average learning-space completion across the academy and per
   class.
3. **Risk** — how many students are flagged at-risk, and in which classes they
   cluster.
4. **Drill-down** — for any one class, its top/bottom performers, completion
   rate, and at-risk roster — plus per-student **insights**.

It is **read-only / analytical / navigational**. The page performs **no domain
mutations**. Its only "writes" are client-local view state (selected class,
sort, range) and an audited _report export_ (PDF) request. Class rows and
at-risk students are entry points that deep-link to `/classes/:classId` and
`/students/:studentId`.

> **Why a rebuild, not a re-skin.** The legacy page (`AnalyticsPage.tsx:23–85`)
> does a **client-side fan-out**: `useClasses` + `useStudents`, then
> `useClassSummaries(tenantId, classIds)` fires one Firestore `getDoc` **per
> class** (`useClassSummary.ts:29–58`), and every headline KPI (`avgClassScore`,
> `avgCompletion`, `totalAtRisk`) is reduced **in the browser**
> (`AnalyticsPage.tsx:33–52`). `be-analytics.md` §4 flags exactly this: there
> are no security rules for `classProgressSummaries`/`studentProgressSummaries`,
> and several apps read summaries directly anyway (access gap), and
> platform/tenant metrics should be served through one callable, not derived
> client-side. The rebuild routes **all** reads through
> `v1.analytics.getSummary` (`common-api.md` §3, scope `class`, tenant-scoped +
> membership-checked — `be-analytics.md` §1) so the server is the single
> authority for every number, and `InsightCard`/`AtRiskBadge` become first-class
> Lyceum domain components instead of raw-Tailwind one-offs.

---

## 2. Entry points & route

**Route:** `/analytics`, an authenticated route inside `AppLayout`, guarded by
`RequireAuth` (`apps/admin-web/src/guards/RequireAuth.tsx`, `auth-access.md`
lines 114–115) which denies unless `firebaseUser` exists **and** the user has an
active `tenantAdmin` membership for the current tenant (claim `role` +
membership doc, `auth-access.md` lines 101–103). There is **no** super-admin
cross-tenant variant of this page in admin-web — that lives in the super-admin
app.

**Entry points:**

- "Analytics" item in the tenant-admin **Sidebar** nav (admin shell,
  `AppLayout.tsx`).
- "View analytics" / at-risk widgets from the tenant-admin **Dashboard**
  (`admin-dashboard.md`).
- Per-class "Analytics" link from `/classes/:classId` (`class-detail.md`)
  deep-links here with the class preselected.
- ⌘K command palette → "Analytics" (web only — §10).

**Reads that power it** — all via `packages/shared-hooks` →
`packages/api-client` (no direct `firebase/firestore` from the browser; this is
the rebuild seam, `common-api.md` §2, §5.3). All requests carry the caller's
tenant; the server scopes every read to that tenant and re-checks membership.

| Region                                                                                                          | Hook (rebuild)                                                      | Callable (`common-api.md` §3)                                                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headline KPIs (avg exam score, avg space completion, at-risk count, total students) + per-class comparison rows | `useGetSummary({ scope: 'class', section: 'tenantRollup' })`        | `v1.analytics.getSummary` (`scope:'class'`, tenant-scoped, membership-checked — `be-analytics.md` §1)                        | Replaces the legacy `useClasses`+`useStudents`+`useClassSummaries` client fan-out (`AnalyticsPage.tsx:23–31`) and the in-browser `reduce` rollups (`:33–52`). Server returns the academy-level averages and the per-class array already summed. **Proposed contract addition** — see callout below.                                                                                       |
| Per-class summary (drill-down: top/bottom performers, completion rate, at-risk roster)                          | `useGetSummary({ scope: 'class', classId })` → `classSummary`       | `v1.analytics.getSummary` (`scope:'class'`)                                                                                  | Returns one `ClassProgressSummary` (`shared-types/src/progress/summary.ts:99`): `className`, `studentCount`, `autograde.{averageClassScore, examCompletionRate, topPerformers, bottomPerformers}`, `levelup.{averageClassCompletion, activeStudentRate, topPointEarners}`, `atRiskStudentIds`, `atRiskCount`, `lastUpdatedAt`. Replaces the per-class `getDoc` (`useClassSummary.ts:29`). |
| Per-student insights (for the drill-down / at-risk roster)                                                      | `useInsights({ classId })` or `useGetSummary` insights section      | `v1.analytics.getSummary` (`scope:'student'`) per flagged student, OR a class-insights branch                                | `LearningInsight` (`shared-types/src/progress/insight.ts:21`): `type`, `priority`, `title`, `description`, `actionType`, `actionEntityId/Title`, `dismissedAt`. Powers `InsightCard`. **Proposed: a class-scoped insights read** so the admin sees top active insights without N+1 student calls.                                                                                         |
| Mastery distribution (not-started / in-progress / mastered counts across the academy)                           | `useGetSummary({ scope: 'class', section: 'masteryDistribution' })` | `v1.analytics.getSummary` (`scope:'class'`)                                                                                  | The `mastery.{notStarted,inProgress,mastered}` buckets (foundation §2.3). **Proposed addition** — the live page has no mastery view yet; this is new.                                                                                                                                                                                                                                     |
| Export report (PDF)                                                                                             | `useGenerateReport({ type: 'class' })`                              | `v1.analytics.generateReport` (`type:'class'`) → `{ pdfUrl, expiresAt }` (`common-api.md` §3 line 155; `generate-report.ts`) | Returns a 1-hour signed URL at `tenants/{tenantId}/reports/classes/...pdf`. Audited (§8).                                                                                                                                                                                                                                                                                                 |

> **⚠ Proposed contract additions (flag for the API spec).** Three things this
> screen needs are not yet in the live contract and must be added to
> `api-contract` before build:
>
> 1. **`getSummary scope:'class'` must support a `tenantRollup` section** — the
>    academy-level averages (`avgClassScore`, `avgCompletion`, `totalAtRisk`,
>    `totalStudents`) and the per-class comparison array — so the rebuild stops
>    reducing in the browser (`be-analytics.md` rec #7 "replace count queries
>    with snapshots/aggregations"; rec #1 "transport-agnostic service layer").
>    Server-authoritative `ClassProgressSummary` docs remain the source.
> 2. **A class-scoped insights / at-risk-roster read** that returns top active
>    `LearningInsight`s and the at-risk student list with names, without one
>    call per student (avoids the `nightlyAtRiskDetection` O(N) pattern flagged
>    in `be-analytics.md` §4).
> 3. **A mastery-distribution section** (`notStarted/inProgress/mastered`
>    counts) — new to this screen; not in the live page. None introduce new
>    _foundation_ tokens — they are API-contract additions. The one genuinely
>    new design-system item this screen needs is the `Chart` family and the
>    `InsightCard` component (see §4).

**Writes from this screen:** none to domain data. Export is a
read-that-produces-a-file (audited). View state (selected class, sort, range) is
client-local. (The live `selectedClassId` toggle, `AnalyticsPage.tsx:25`,
becomes the drill-down selection here.)

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(tenant-admin nav, "Analytics" active), **Topbar** (breadcrumb + right cluster:
search, ⌘K, ThemeToggle, NotificationBell, profile, and — because this is a
tenant-scoped admin — the **tenant context indicator** showing the current
academy; tenantAdmins belong to one tenant so this is a label, not a
cross-tenant switcher), and the scrollable main region. Page gutters per
foundation §4 (mobile 16 / tablet 24 / desktop 32); max content width 1200;
numerics in `Spline Sans Mono` (tabular).

```
┌───────────── AppShell ──────────────────────────────────────────────────────────┐
│ Sidebar (lg 260px,   │ Topbar: [Breadcrumb: Academy › Analytics]  [⌕][⌘K][☼][🔔][◔]│
│  collapsible)        ├───────────────────────────────────────────────────────────┤
│  · Dashboard         │  PageHeader                                                  │
│  · Classes           │  ┌─────────────────────────────────────────────────────────┐│
│  · Students          │  │ "Analytics"                  [Class ▾ All][Export ▾]    ││  ← title row
│  · Spaces            │  │  Student performance, progress, and at-risk indicators  ││
│  · Exams             │  └─────────────────────────────────────────────────────────┘│
│  · Analytics ◀───────│                                                              │
│  · LLM Usage         │  KPI ROW  (Stat/KPI cards — §5 Data)                          │
│  · Staff             │  ┌──────────┬──────────┬──────────┬──────────┐               │
│  · Settings          │  │Avg Exam  │Avg Space │ At-Risk  │ Total    │               │
│                      │  │ Score    │Completion│ Students │ Students │               │
│                      │  │  78%     │  64%     │   12     │  1,030   │               │
│                      │  │          │          │ ⚠ attn   │          │               │
│                      │  └──────────┴──────────┴──────────┴──────────┘               │
│                      │   (at-risk uses status.error icon+label, never color-only)   │
│                      │                                                              │
│                      │  CHARTS  (two cards side by side @ lg)                        │
│                      │  ┌───────────────────────────┬───────────────────────────┐   │
│                      │  │ Exam performance by class │ Space completion by class │   │
│                      │  │  (bar, Card e1)           │  (bar, Card e1)           │   │
│                      │  │  ▆▆ ▆▆ ▅▅ ▄▄ ▃▃           │  ▆▆ ▅▅ ▅▅ ▄▄ ▂▂           │   │
│                      │  └───────────────────────────┴───────────────────────────┘   │
│                      │                                                              │
│                      │  AT-RISK & MASTERY  (two cards @ lg)                          │
│                      │  ┌───────────────────────────┬───────────────────────────┐   │
│                      │  │ At-risk students by class │ Mastery distribution      │   │
│                      │  │  (bar, status.error)      │  notStarted/inProg/master ││   │
│                      │  │  ▆▆ ▅▅ ▃▃                  │  ███▒▒▒░░ (segmented bar)  │   │
│                      │  └───────────────────────────┴───────────────────────────┘   │
│                      │                                                              │
│                      │  INSIGHTS  (Section — InsightCard list, top active)          │
│                      │  ┌─────────────────────────────────────────────────────────┐│
│                      │  │ ◆ high · "12 students struggling with Recursion" → space ││  ← InsightCard
│                      │  │ ◆ med  · "Class 10-B improving week over week"  → review ││
│                      │  └─────────────────────────────────────────────────────────┘│
│                      │                                                              │
│                      │  CLASS DRILL-DOWN  (Section — class selector + detail)        │
│                      │  ┌─────────────────────────────────────────────────────────┐│
│                      │  │ Class detail   [10-A][10-B][9-C] …  (Chip selector)     ││
│                      │  │ ┌────────┬────────┬────────┬────────┐                    ││
│                      │  │ │ExamAvg │Students│At-Risk │Complet.│  (ProgressRing+Stat)││
│                      │  │ │ ◔ 78%  │  34    │  3 ⚠   │  64%   │                    ││
│                      │  │ └────────┴────────┴────────┴────────┘                    ││
│                      │  │ Top performers        │ Needs improvement               ││
│                      │  │ • Asha   92%          │ • Rahul  41%                    ││
│                      │  │ • …                   │ • …                             ││
│                      │  │ At-risk roster: [AtRiskBadge ⚠ At Risk] Rahul → student ││  ← row → /students/:id
│                      │  └─────────────────────────────────────────────────────────┘│
└──────────────────────┴───────────────────────────────────────────────────────────┘
```

**Grid & responsive:**

- **lg (≥1024):** Sidebar fixed (collapsible to icon rail). KPI row = 4 columns
  (`grid-cols-4`, gap 16 / spacing-4 — matches live `lg:grid-cols-4`,
  `AnalyticsPage.tsx:97`). Charts = 2 columns (`lg:grid-cols-2`, `:123`).
  At-risk + mastery = 2 columns. Insights full-width. Drill-down full-width; its
  inner stat row = 4 columns (`md:grid-cols-4`, `:204`), top/bottom = 2 columns
  (`md:grid-cols-2`, `:241`). Content max-width 1200, gutter 32.
- **md (768–1023):** Sidebar collapses to icon rail or off-canvas Drawer. KPI
  row = 2×2 (`md:grid-cols-2`). Charts **stack** to 1 column. At-risk/mastery
  stack. Drill-down stat row stays 4-up if it fits, else 2×2; top/bottom stays
  2-col. Gutter 24.
- **sm (<768):** Single column throughout. KPI cards stack 1-up. Charts
  full-width, reduced height. Class selector chips wrap and scroll horizontally.
  Top/bottom performer lists stack. The at-risk roster becomes one stacked
  `SubmissionCard`-style row per student (name + `AtRiskBadge` + reasons, tap →
  `/students/:id`). Class/Export controls collapse into an overflow `…`
  IconButton. Gutter 16. (Admin is desktop-first — §10 — but the shell must not
  break on a phone.)

---

## 4. Components used (FOUNDATION §5 only)

**Navigation:** `AppShell` (Sidebar + Topbar), `Sidebar` (role-driven,
tenant-admin route manifest, "Analytics" active), `Topbar` (search, ⌘K,
ThemeToggle, notifications, profile, tenant context label — single-tenant, not a
cross-tenant switcher), `Breadcrumb` ("Academy › Analytics"), `CommandPalette`
(⌘K, web-only).

**Containers:** `Card` (KPI cards, chart cards, mastery card, drill-down card —
radius `lg`, elevation `e1` at rest, `e2` on hover for interactive rows),
`Section` (KPI / Charts / At-risk+Mastery / Insights / Drill-down groupings),
`Tooltip` (chart datapoint readouts; at-risk reason expansion), `Popover` (Class
filter, Export menu), `Accordion` (optional: collapse the per-class top/bottom
lists on sm).

**Primitives:** `Button` (`secondary` for Export, `ghost` for "Try again" in
error state), `IconButton` (overflow `…`, refresh), `Select` / `Combobox` (class
filter / drill-down picker; date-range presets if added), `Chip/Tag` (the
class-selector toggles — replacing the live ad-hoc `<button>` chips at
`AnalyticsPage.tsx:183–199`; active range/segment indicator).

**Data:** `Stat/KPI` (the 4 headline cards — value in mono, label, optional
sub-line; replaces the live `ScoreCard`), `ProgressRing` (drill-down "Exam Avg"
— already used live at `:207`), `ProgressBar` (mastery-distribution segmented
bar; per-class "active %" inline bar), `Badge` (priority on insights, class
status), `EmptyState` (no classes / no insights / no at-risk), `Skeleton`
(loading), `DefinitionList` (drill-down stat block; sm stacked-card body),
`Avatar` (top/bottom performer rows, optional).

**Feedback:** `InlineAlert/Banner` (partial / stale-data note — §5/§8), `Toast`
(sonner — export ready / export failed), `LoadingOverlay` (export-in-progress,
optional).

**Domain components (cross-app, foundation §5):**

- **`AtRiskBadge`** — the at-risk status pill (foundation §5 "AtRiskBadge").
  **It exists today**
  (`packages/shared-ui/src/components/charts/AtRiskBadge.tsx`) but is hardcoded
  to raw Tailwind `bg-green-100/700` and `bg-red-100/700` — **NOT** Lyceum
  tokens. **Required rework (not a new addition):** retoken to `status.success`
  ("On Track", `CheckCircle2`) and `status.error` ("At Risk", `AlertTriangle`),
  pairing icon + label so status is never color-alone (foundation §2.3). Reasons
  surface on hover/focus (`AtRiskReason` enum — `analytics.ts:48`). Keep its
  `role="status"`.
- **`InsightCard`** — renders one `LearningInsight` (foundation §5 lists
  "InsightCard"). **It does not exist in `shared-ui` yet** (no file under
  `packages/shared-ui/src` matches). **Proposed foundation addition / build
  item:** a Card (`lg`, `e1`) showing the insight `title` (Schibsted 600),
  `description` (text.secondary), a priority `Badge` (`high`→status.error,
  `medium`→status.warning, `low`→status.info — icon + label, never color-only),
  and a primary/ghost `Button` whose label + target derive from `actionType`
  (`practice_space`→"Open space", `review_exam`→"Review exam", `seek_help`→"Get
  help", `celebrate`→a quiet acknowledgement — **no** celebratory marigold burst
  here; this is the admin register). Composes existing tokens only.

**Charts.** The "exam performance by class", "space completion by class", and
"at-risk by class" bar charts (live `SimpleBarChart`,
`AnalyticsPage.tsx:132/150/169`) plus the mastery segmented bar. Foundation §5
lists `ProgressBar`/`ProgressRing` but **no bar/line chart primitive**.
**Proposed foundation addition (shared with `platform-analytics.md`):** a
`Chart` family (`BarChart`, `LineChart`, `AreaChart`) wrapping the app's
existing chart lib, themed strictly to Lyceum tokens — axes/grid in
`border.subtle` (warm-tinted, never pure black), the primary series in
`brand.primary`, at-risk series in `status.error`, mastery segments in
`mastery.notStarted`/`mastery.inProgress`/`mastery.mastered` (foundation §2.3),
tooltips on `bg.surface` at `e2`, mono numerics. **This is the one genuinely new
component family this screen needs and must be added to foundation §5 before
build.** It must replace the live `SimpleBarChart`'s raw
`hsl(var(--primary))`/`hsl(var(--destructive))` inline colors
(`AnalyticsPage.tsx:69/79`) with semantic tokens. No new colors/fonts/spacing
are introduced.

---

## 5. States

All states render inside AppShell with `PageHeader` ("Analytics") always present
so the admin keeps orientation.

**Loading (skeleton)** — `useGetSummary` pending. Mirror the final layout: 4
`Skeleton` KPI cards (label bar + big-number bar), two chart-card skeletons
(header bar + shimmer block at chart height), an at-risk/mastery skeleton, an
insights skeleton (2–3 card rows), and a drill-down skeleton (chip row + 4 stat
blocks + two lists). Motion: shimmer respects `prefers-reduced-motion` (static
muted fill when reduced).

**Empty** — tenant has classes but no graded exams / no space activity yet, so
summaries are zero. KPIs render `0%` / `0` honestly (not blank). Each chart
renders an axis frame with a centered "No data yet" caption rather than a blank
box (the live page hides charts entirely when empty,
`AnalyticsPage.tsx:125/143/162` — the rebuild keeps the frame for orientation).
Insights `EmptyState`: "No insights yet." Drill-down preserves the live empty
copy: with classes present, "Select a class above to view detailed analytics";
with no classes, "No classes available" (`AnalyticsPage.tsx:289–293`).

**Error** — query `isError`. `InlineAlert` `variant="error"` (status.error,
AlertCircle icon + title + message) with a `ghost` **Try again** Button calling
`refetch()`. The analytical body is replaced by the alert; PageHeader stays.
Copy in §7.

**Partial** — server returns headline KPIs but a per-class summary or the
insight/mastery section is **stale or still recomputing** (the trigger fan-out /
5-minute debounce, `be-analytics.md` §1 `onStudentSummaryUpdated`, may leave a
class summary momentarily behind). Render what we have; over the affected card
show an `InlineAlert` (`variant="info"`, status.info): "This class summary is
being recomputed — last updated {relative time, from `lastUpdatedAt`}." KPIs
labeled "as of {timestamp}" so the admin never reads a stale number as live.
Honest-numbers rule (§8).

**Permission-gated variations by role:**

- `tenantAdmin` (active membership for this tenant) → full page.
- **Any non-tenant-admin** (teacher, student, parent, staff without admin perm)
  → never reaches the body; `RequireAuth` blocks at the route. If a stale-claim
  user passes the route guard but the **server** `getSummary(scope:'class')`
  rejects (it independently re-checks tenant membership — `be-analytics.md` §1),
  the page shows a full-bleed `InlineAlert` `variant="error"`: "Analytics are
  restricted to academy administrators." (server-authoritative — never trust the
  client gate alone, §8).
- **Cross-tenant attempt** — a `tenantAdmin` of tenant A cannot read tenant B's
  data; the server scopes by the caller's tenant and rejects any mismatched
  `classId` (§8).

**Success** — full layout per §3.

---

## 6. Interactions & motion

All motion uses §4 tokens; nothing here is celebratory — this is the serious
register. The ONE celebratory moment in Lyceum (XP/streak/level-up spring pop)
belongs to the _student_ surfaces, never here.

- **Initial mount:** KPI cards + cards fade/translate-in (`base` 220ms,
  `ease.entrance`), staggered ~40ms left-to-right; chart series draw with a
  subtle reveal (`slow` 320ms, `ease.standard`). Reduced-motion: no translate,
  no reveal — content appears.
- **Class filter / drill-down select:** choosing a class (top-right `Select`, or
  a `Chip` in the drill-down selector) sets `selectedClassId` and loads that
  `ClassProgressSummary`. The drill-down block cross-fades (`base`,
  `ease.standard`); the active chip raises and gains an `aria-pressed` state
  (replacing the live toggle button at `AnalyticsPage.tsx:184–198`). Re-clicking
  the active chip deselects (toggle, preserved from `:187`). No layout shift —
  the block reserves height.
- **Chart hover/focus:** crosshair + `Tooltip` on `bg.surface` `e2` showing the
  exact value (mono) and class label; keyboard users tab to a focusable series
  and arrow through bars (an `aria-live="polite"` readout updates).
- **At-risk badge / roster:** hovering/focusing an `AtRiskBadge` reveals its
  `atRiskReasons` in a `Tooltip` (e.g. "Low exam score, Zero streak"). Clicking
  an at-risk student row navigates to `/students/:studentId` (page transition
  `page` 420ms) — navigation, not mutation, no confirm.
- **Insight action:** the `InsightCard` action `Button` navigates to the
  insight's target (`actionEntityId` → space/exam/student). No optimistic
  mutation. (Admins do not "dismiss" student insights here — `dismissedAt` is a
  student-side action; the admin view is read-only.)
- **Class row → drill-in:** hovering a class bar/row raises it `e1→e2`; click
  navigates to `/classes/:classId` (`class-detail.md`).
- **Export flow:** Export `Popover` → choose scope (current class / whole
  academy) and format → optimistic `Toast` "Preparing report…", then on success
  `Toast` "Report ready" with a "Download" action opening the 1-hour signed URL
  (`generateReport` → `{ pdfUrl, expiresAt }`); on failure `Toast` `error`
  "Export failed — try again." Export is the **only** server side-effect and is
  audited (§8). No destructive `ConfirmDialog` is needed.
- **Refresh:** an `IconButton` (refresh) re-runs the queries; spins `fast` 160ms
  while pending.

There are **no optimistic domain updates** on this screen — every number is
server-authoritative; the client never edits an aggregate.

---

## 7. Content & copy

Tone: precise, neutral, credible. No exclamation marks, no student-facing
warmth, no emoji. (Preserve the live subtitle phrasing where it already reads
correctly.)

- **Page title (Fraunces):** "Analytics"
- **Subtitle (Schibsted, text.secondary):** "Student performance, progress, and
  at-risk indicators." (Live used "Student performance, class comparisons, and
  at-risk indicators" — `AnalyticsPage.tsx:92` — keep as an acceptable
  alternate.)
- **KPI labels:** "Avg Exam Score" · "Avg Space Completion" · "At-Risk Students"
  · "Total Students" (mirrors live `:99/106/110/116`). At-risk sub-line: "Needs
  attention" when `> 0`, "All on track" when `0` (live used "All good" — `:113`;
  "All on track" is the more precise admin form).
- **Chart titles:** "Exam performance by class" · "Space completion by class" ·
  "At-risk students by class" · "Mastery distribution".
- **Mastery legend:** "Not started" · "In progress" · "Mastered" with counts and
  % (icon/label, not color-only).
- **Insights section title:** "Insights." Empty: "No insights yet — they appear
  as students complete exams and spaces." Insight priority labels: "High" /
  "Medium" / "Low".
- **Drill-down card title:** "Class detail." Stat labels: "Exam Avg" ·
  "Students" · "At-Risk" · "Completion Rate" (mirrors live `:218/224/230`).
  Sub-sections: "Top performers" · "Needs improvement" (mirrors live
  `:245/267`).
- **At-risk roster row:** name + `AtRiskBadge` ("At Risk" / "On Track") +
  reasons on hover.
- **Class selector helper:** "Select a class to view detailed analytics."
- **Empty (no classes):** "No classes available." (preserved, `:292`).
- **Empty (no data in a section):** "No data yet."
- **Error:** title "Failed to load analytics" — body "{server message, or} An
  unexpected error occurred while loading analytics." action "Try again".
- **Partial / stale:** "This class summary is being recomputed — last updated
  {relative time}." and KPI footnote "as of {timestamp}."
- **Permission denial:** "Analytics are restricted to academy administrators."
- **Export toasts:** "Preparing report…" / "Report ready" (+ "Download") /
  "Export failed — try again."

---

## 8. Domain rules surfaced

- **Tenant isolation is a hard boundary.** Every read is scoped to the caller's
  single tenant (`useCurrentTenantId()`, `AnalyticsPage.tsx:22`). `tenantAdmin`
  is bound to ONE tenant (`auth-access.md` line 55). The server
  `getSummary(scope:'class')` independently re-verifies the caller's tenant
  membership and rejects any `classId` outside it (`be-analytics.md` §1
  "tenant-scoped, membership-checked"). The client gate (`RequireAuth`) is never
  trusted alone. This page **never** shows cross-tenant data — that is the
  super-admin page's job (`platform-analytics.md`), not this one.
- **RBAC.** Access requires an active `tenantAdmin` membership (`auth-access.md`
  lines 101–103, `assertTenantAdminOrSuperAdmin`). Teachers see their own
  classes in teacher-web, not this academy-wide view. `firestore.rules`
  currently has **no** `match` for
  `studentProgressSummaries`/`classProgressSummaries`/`insights`
  (`be-analytics.md` §4) — the rebuild closes this access gap by serving
  summaries **only** through the membership-checked `getSummary` callable (rec
  #8), so the browser never reads these collections directly.
- **Server-authoritative values.** Every KPI, average, completion %, at-risk
  count, and mastery bucket is computed server-side (the trigger-materialized
  `ClassProgressSummary`/`StudentProgressSummary` docs) and presented as-is. The
  client does **not** recompute or "fix up" — the legacy in-browser `reduce`
  rollups (`AnalyticsPage.tsx:33–52`) are explicitly removed. Stale data is
  labeled ("as of …" via `lastUpdatedAt`), never silently shown as live (note
  the known `streakDays: 0` and `discriminationIndex: 0` stubs,
  `be-analytics.md` §4 — the UI must not present a stub zero as a measured
  value; where a metric is a known stub, omit it rather than display a false
  zero).
- **No mutation surface.** The page writes no domain data. The only server
  side-effect is **export** (`generateReport`), which is **audit-logged** (actor
  email, tenant, scope, format — consistent with `auditLogs`, `auth-access.md`
  line 156) and returns a **1-hour signed URL** that expires
  (`generate-report.ts`).
- **No answer-key / assessment-content leakage.** This is performance/engagement
  analytics; it surfaces scores and completion rates, never exam questions,
  rubrics, or answer keys (the `AnswerKeyLock` rule, foundation §5 — N/A to
  render here but the principle holds: no sensitive assessment content is
  returned to the client).
- **At-risk is server-derived, not editable here.** `isAtRisk`/`atRiskReasons`
  come from the nightly rule engine (`at-risk-rules.ts`, `be-analytics.md` §1);
  the admin views and acts on them but cannot toggle them. `AtRiskReason` values
  (`low_exam_score`, `low_space_completion`, `declining_performance`,
  `zero_streak` — `analytics.ts:48`; note `no_recent_activity` is in the type
  but never emitted, `be-analytics.md` §4) must be mapped to human-readable
  reason labels.
- **Cost vs performance separation.** AI cost / budget lives on `/llm-usage`
  (`DailyCostSummary`, budget thresholds — `be-analytics.md` §1,
  `llm-usage.md`); this page intentionally does **not** show spend. Cross-link,
  don't duplicate.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Skip-to-content → PageHeader → Class filter Select → Export →
  KPI cards (each a focusable region named e.g. "Avg Exam Score, 78%") → chart 1
  → chart 2 → at-risk chart → mastery → insight cards (title + priority +
  action) → class-selector chips → drill-down stats → top/bottom lists → at-risk
  roster rows. Logical top-to-bottom, left-to-right.
- **Keyboard:** All controls operable without a pointer. Class-selector `Chip`s
  are toggle buttons with `aria-pressed` and Enter/Space (replacing the live
  `<button>` toggles). Charts expose a focusable series; arrow keys move between
  bars with a live `aria-live="polite"` readout of class + value. Export
  `Popover` and Class `Select` are fully keyboard-driven. ⌘K palette web-only.
- **ARIA / semantics:** Charts are not decorative — each has `role="img"` with
  an `aria-label` summary (the live page already does this,
  `AnalyticsPage.tsx:131/149/168/206`) **and** a visually-hidden data-table
  fallback of the same series so screen-reader users get the numbers, not just
  "chart." `AtRiskBadge` keeps `role="status"` and pairs
  `AlertTriangle`/`CheckCircle2` icon **with** the text "At Risk"/"On Track" —
  status is **never** color-alone (foundation §2.3). Insight priority shows an
  icon + word ("High"), not just a colored dot. Mastery segments carry the
  count/% in adjacent text, not only bar length. KPI at-risk "Needs attention"
  is text, not a red color cue alone.
- **Contrast:** All text/number/background pairs meet AA (4.5:1 body, 3:1
  large/UI) using Lyceum semantic pairs; chart series are distinguishable by
  label + direct numbering, not hue alone. Focus ring = `border.focus` 3px
  (foundation §4). The live `AtRiskBadge`'s raw green/red Tailwind must be
  replaced by `status.*` tokens that are verified AA on `bg.surface`.
- **Reduced motion:** `prefers-reduced-motion` disables stagger, chart reveal,
  cross-fades, and skeleton shimmer; content and series appear statically. No
  essential information is conveyed only through motion.

---

## 10. Web ↔ mobile divergence

**Admin (tenant-admin) is primarily a web/desktop tool** — admin-web is a Vite
React SPA (`AppLayout.tsx`), not part of the React Native learner/scanner apps.
State this explicitly: there is **no native mobile tenant-admin app**; "mobile"
here means the responsive web shell on a small viewport.

- **⌘K Command Palette is web-only** (foundation §6). On small viewports it is
  not offered; navigation falls back to the sidebar Drawer.
- **Charts** reduce to single-column, shorter height on sm; the sr-only
  data-table fallback is unchanged.
- **Class drill-down**: the chip selector wraps/scrolls; top/bottom performer
  lists stack; the **at-risk roster becomes stacked cards** (one per student:
  name + `AtRiskBadge` + reasons, tap → `/students/:id`) — foundation §6 "table
  on web → stacked cards on mobile."
- **Hover → press:** chart tooltips, at-risk reason tooltips, and row-raise
  (`e1→e2`) become tap/long-press readouts on touch.
- **Class filter / Export** collapse into a single overflow `…` IconButton +
  Popover on sm.
- No camera/scanner/offline-queue concerns apply here (this is not a
  scanner/learner RN surface).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for Auto-LevelUp's TENANT-ADMIN control plane: "Analytics" at route
/analytics. Audience: a tenantAdmin scoped to ONE academy (tenant). Register: serious, precise,
credible admin tooling — restraint in chrome, NOT the playful student register. No emoji, no
exclamation marks.

DESIGN SYSTEM — "Lyceum" (conform EXACTLY; invent nothing):
- Direction "Modern Scholarly": warm paper neutrals (never pure #FFF, never cool slate), deep
  scholarly indigo primary (NOT SaaS blue), a single marigold "spark" reserved for energy accents
  (do NOT use spark here — admin register), warm-tinted shadows.
- Tokens (cite by semantic name, never hex): bg.canvas / bg.surface / bg.surface-sunken,
  text.primary / .secondary / .muted, border.subtle / .strong / .focus, brand.primary (+ hover),
  status.success / .warning / .error / .info, and the domain scales mastery.notStarted /
  mastery.inProgress / mastery.mastered. Status ALWAYS paired with icon + label, never color alone.
- Type: Fraunces (serif display, h1–h3, hero numbers, empty-state titles), Schibsted Grotesk
  (UI/body/labels/buttons/tables), Spline Sans Mono (all numerics — scores, %, counts; tabular).
- Spacing 4px base; gutters mobile 16 / tablet 24 / desktop 32; max content width 1200.
  Radius: cards lg(14), inputs/buttons md(10), chips/badges pill. Elevation e1 cards at rest,
  e2 on hover/popover, e3 modals; focus ring 3px border.focus.
- Motion (felt, not seen): instant100/fast160/base220/slow320/page420 with ease.standard &
  ease.entrance; respect prefers-reduced-motion. Nothing celebratory on this screen.

SHELL: render inside AppShell — left Sidebar (tenant-admin nav, "Analytics" active), Topbar with
breadcrumb "Academy › Analytics" + search + ⌘K + theme toggle + notifications + profile + a
single-tenant context label (this admin belongs to ONE tenant — NOT a cross-tenant switcher).

LAYOUT (desktop-first, responsive):
1) PageHeader: title "Analytics", subtitle "Student performance, progress, and at-risk indicators",
   right-aligned Class filter (All / per class) + secondary Export button.
2) KPI ROW — 4 Stat/KPI cards: "Avg Exam Score" (%), "Avg Space Completion" (%), "At-Risk Students"
   (count, sub-line "Needs attention" when >0 / "All on track" when 0 — text+icon, not color alone),
   "Total Students". Big mono values.
3) CHARTS — two bar-chart cards side-by-side at lg (stack at md/sm): "Exam performance by class" and
   "Space completion by class". Axes/grid in border.subtle, series in brand.primary; tooltips on
   bg.surface at e2. (Charts are a proposed Lyceum addition wrapping the app chart lib, themed to
   tokens only — replace any raw hsl(var(--primary)) inline colors.)
4) AT-RISK & MASTERY — two cards at lg: an "At-risk students by class" bar chart (series in
   status.error, icon+label) and a "Mastery distribution" segmented ProgressBar using
   mastery.notStarted / mastery.inProgress / mastery.mastered, each segment labeled with count + %.
5) INSIGHTS — a Section listing InsightCard items (top active LearningInsights): each card shows
   title (Schibsted 600), description (text.secondary), a priority Badge (high→status.error,
   medium→status.warning, low→status.info, icon+label), and an action Button whose label derives
   from actionType (practice_space→"Open space", review_exam→"Review exam", seek_help→"Get help",
   celebrate→a quiet acknowledgement — NO marigold burst). InsightCard is a proposed new component.
6) CLASS DRILL-DOWN — a Section: a Chip class selector (toggle, aria-pressed) → then a 4-up stat
   block (ProgressRing "Exam Avg", "Students", "At-Risk", "Completion Rate"), two columns
   "Top performers" / "Needs improvement" (name + % rows), and an at-risk roster where each student
   shows an AtRiskBadge ("At Risk"/"On Track", AlertTriangle/CheckCircle2 icon + label, reasons on
   hover) and links to /students/:id. AtRiskBadge already exists but MUST be retoken-ed from raw
   green/red Tailwind to status.success / status.error.

RESPONSIVE: lg = 4-col KPIs + 2-col charts + 2-col at-risk/mastery + full-width insights & drill-down.
md = 2×2 KPIs, stacked charts, sidebar collapses to rail/drawer. sm = single column; the at-risk
ROSTER becomes stacked cards (name + AtRiskBadge + reasons, tap → student); ⌘K is hidden;
Class/Export collapse into an overflow … menu.

STATES: skeletons mirroring the layout; empty (KPIs render honest 0%/0, charts show an axis frame
with "No data yet", insights "No insights yet", drill-down "Select a class…" / "No classes
available"); error InlineAlert (status.error) with a ghost "Try again"; PARTIAL (KPIs present but a
class summary stale → info InlineAlert "This class summary is being recomputed — last updated …",
KPIs labeled "as of {timestamp}"). Numbers are SERVER-AUTHORITATIVE — never recomputed client-side;
stale data is labeled, known stub metrics (streakDays/discriminationIndex = 0) are OMITTED not shown.

DOMAIN: tenant isolation is a HARD boundary — everything is scoped to ONE tenant; a tenantAdmin never
sees another tenant's data (the server re-checks membership and rejects out-of-tenant classIds). RBAC:
tenantAdmin membership required; non-admins are blocked (server-authoritative). Read-only — the only
server side-effect is an audited Export (PDF → 1-hour signed URL; toasts "Preparing report…" /
"Report ready" + Download / "Export failed — try again"). No answer-key/exam content, no cross-tenant
data, no editing of server-derived at-risk flags.

ACCESSIBILITY: WCAG AA contrast; every chart has role="img" + aria-label summary AND a visually
hidden data-table fallback; class-selector chips use aria-pressed + Enter/Space; status (at-risk,
priority, mastery) never by color alone (icon + label + numeric text); reduced-motion disables
stagger/reveal/shimmer.

Output: a clean, accessible React + Tailwind implementation composing ONLY Lyceum tokens and the
listed components. Do not introduce new colors, fonts, spacing, radii, shadows, or motion.
```
