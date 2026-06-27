# Platform Analytics (User Analytics)

> Per-screen design spec. Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md` ("Lyceum"). All tokens are cited
> by semantic name — no hex is re-pasted. This is **super-admin platform
> control-plane tooling**: the serious, precise register (restraint in chrome),
> NOT the playful student register. Cross-tenant data is sensitive — chrome
> stays calm, numbers stay honest.

- **Area:** admin (super-admin / platform control plane)
- **Route:** `/analytics`
- **Role / audience:** `superAdmin` ONLY (cross-tenant). No `tenantAdmin`, no
  scoped-tenant view of this page.
- **Live code this replaces:**
  `apps/super-admin/src/pages/UserAnalyticsPage.tsx` (and its in-page
  `usePlatformUserStats` hook), shell
  `apps/super-admin/src/layouts/AppLayout.tsx`.

---

## 1. Purpose & primary user

**Primary user:** the platform operator — a human with `isSuperAdmin === true`
on `/users/{uid}` (the platform-wide super-admin boolean, not a tenant
membership row — `auth-access.md` §"Roles" lines 137–139). They operate the
control plane _across all tenants_; they are not scoped to one academy.

**Job-to-be-done:** _"Across the whole platform, who is signing up, who is
actually using it, which tenants are growing or stalling, and how does plan mix
and engagement compare tenant-to-tenant — so I know which accounts to invest in,
upsell, or rescue."_

This is the **user/engagement analytics** surface of the platform (distinct from
`/llm-usage`, which is cost/AI spend, and `/system`, which is health/uptime). It
answers four questions:

1. **Scale** — total users on the platform, split students vs teachers, across
   how many tenants.
2. **Growth** — new signups this period vs the prior period (week-over-week,
   month-over-month), trend over time.
3. **Engagement / retention** — active users in the last 7 days, retention
   curve, the ratio of active-to-total.
4. **Per-tenant comparison** — a sortable, comparable breakdown so the operator
   can rank tenants by size, growth, or engagement and drill into any one.

It is **read-only / navigational / analytical**. The page performs **no
mutations** — its only "writes" are local-to-client view state (date-range
selection, tenant-table sort/filter/page, segment toggles) and an audited
_export_ request (CSV/JSON of the aggregate). Every tenant row is an entry point
that deep-links into `/tenants/:tenantId`.

> **Why a rebuild, not a re-skin.** The legacy page does a full client-side
> `getDocs(collection(db,"tenants"))` scan and derives every number in the
> browser from `tenant.stats.totalStudents` / `tenant.stats.totalTeachers`
> (`UserAnalyticsPage.tsx:55–96`). The status report flags this as the dominant
> debt: it does not scale past a few dozen tenants, can't be reused by future RN
> clients, and bypasses the API layer (`app-super-admin.md` §4.1, §5.1). The
> rebuild moves **all** aggregation server-side behind one callable and presents
> real growth/retention charts the legacy page never had.

---

## 2. Entry points & route

**Route:** `/analytics`, an authenticated route inside `AppLayout`, guarded by
`RequireAuth` which (per `app-super-admin.md` §1.3 / `auth-access.md`) denies
unless `firebaseUser` exists **and** Firestore `user.isSuperAdmin === true`
**and** the ID-token custom claim `role === "superAdmin"`. There is **no**
tenant-scoped variant — a `tenantAdmin` who somehow reaches this URL gets the
permission-gated denial in §5.

**Entry points:**

- "Platform Analytics" item in the **Platform** sidebar nav group (super-admin
  shell, `AppLayout.tsx`).
- "Users by tenant" / "View user analytics" deep-links from the super-admin
  **Dashboard** (`/`) growth widgets.
- ⌘K command palette → "Platform Analytics" (web only — §10).

**Reads that power it** — all via `packages/shared-hooks` →
`packages/api-client` (no direct `firebase/firestore` from the browser; this is
the rebuild seam, `common-api.md` §2, §5.3). Because the caller is super-admin
operating cross-tenant, requests use the **platform** scope; per-tenant rows
come back already aggregated server-side, so there is **no** browser-side
full-collection scan.

| Region                                                                                        | Hook (rebuild)                                                   | Callable (`common-api.md` §3)                                                                                             | Notes                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headline KPIs (total users, students, teachers, active tenants) + per-tenant table + plan mix | `useGetSummary({ scope: 'platform', section: 'userAnalytics' })` | `v1.analytics.getSummary` (`scope:'platform'`, super-admin only — `be-analytics.md` §1 "platform/health superAdmin only") | Replaces `usePlatformUserStats`'s browser scan. Server returns `totalUsers / totalStudents / totalTeachers / activeTenants / totalTenants`, `usersByPlan`, and the per-tenant rows (`tenantId, tenantName, tenantCode, status, students, teachers, total`) already summed and sorted. **Proposed contract addition** — see callout below. |
| Growth metrics (new signups this/last week & month, deltas)                                   | `useGetSummary({ scope: 'platform' })` `.platformSummary`        | `v1.analytics.getSummary` (`scope:'platform'`)                                                                            | Already returns `newTenantsThisMonth/LastMonth`, `newUsersThisWeek/LastWeek`, `activeUsersLast7d`, `recentActivity` (`get-summary.ts:258–267`). Powers the growth KPIs + delta arrows.                                                                                                                                                    |
| Signups & active-users **time series** (for the trend charts)                                 | `useGetPerformanceTrends({ scope: 'platform', metric, range })`  | `v1.analytics.getPerformanceTrends` (`common-api.md` §3 "New: getPerformanceTrends")                                      | Time-bucketed series for the line/area charts; super-admin/platform variant. **Proposed: add a `scope:'platform'` branch** (today it's described for parent-web). See callout.                                                                                                                                                            |
| Per-tenant table paging (when tenant count is large)                                          | same hook, unified **PageRequest** fragment                      | `common-api.md` §7 (`cursor` + `limit`, `nextCursor`)                                                                     | Real cursor pagination replacing the legacy client-slice `usePagination` (`app-super-admin.md` §4.7).                                                                                                                                                                                                                                     |
| Export aggregate (CSV/JSON)                                                                   | `useExportPlatformAnalytics()`                                   | `v1.analytics.generateReport`-style export, OR `callExportTenantData`'s platform sibling                                  | Returns a 1-hour signed URL (same pattern as `export-tenant-data.ts`, `generate-report.ts`). Audited (§8). **Proposed addition.**                                                                                                                                                                                                         |

> **⚠ Proposed contract additions (flag for the API spec).** Three things this
> screen needs are not yet in the live contract and must be added to
> `api-contract` before build:
>
> 1. **`getSummary` platform scope must include a `userAnalytics` section** (the
>    `usersByPlan` map + the per-tenant rows). Today the legacy page computes
>    these in the browser from `tenant.stats`; the rebuild requires the server
>    to materialize them (extend the `dailyCostAggregation`-style precompute
>    into a `platformMetrics` / `platformDailyRollup` rollup doc —
>    `app-super-admin.md` §5.1, `be-analytics.md` rec #7 "replace count queries
>    with snapshots"). Server-authoritative
>    `tenant.stats.totalStudents/totalTeachers` remain the source.
> 2. **`getPerformanceTrends` needs a `scope:'platform'` branch** returning
>    `{ buckets: { date, signups, activeUsers, retainedPct }[] }` for the trend
>    charts.
> 3. **A platform-analytics export endpoint** returning a signed URL. None of
>    these are new _foundation_ tokens — they are API-contract additions; no new
>    design-system primitives are needed.

**Writes from this screen:** none to domain data. Export is a
read-that-produces-a-file (audited). View state (range, sort, filter, page,
segment) is client-local.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(super-admin nav groups: Overview / Platform / System), **Topbar** (breadcrumb +
right cluster: global search, ⌘K, ThemeToggle, NotificationBell, profile — note
the super-admin Topbar has **no tenant switcher**: this operator is cross-tenant
by definition, not scoped to one tenant), and the scrollable main region. Page
gutters per foundation §4 (mobile 16 / tablet 24 / desktop 32); max content
width 1200; numerics in `Spline Sans Mono` (tabular).

```
┌───────────── AppShell ──────────────────────────────────────────────────────────┐
│ Sidebar (lg 260px,   │ Topbar: [Breadcrumb: Platform › Analytics]   [⌕][⌘K][☼][🔔][◔]│
│  collapsible)        ├───────────────────────────────────────────────────────────┤
│  Overview            │  PageHeader                                                  │
│   · Dashboard        │  ┌─────────────────────────────────────────────────────────┐│
│  Platform            │  │ "Platform Analytics"          [Range ▾ 30d][Export ▾]   ││  ← title row
│   · Tenants          │  │  Cross-tenant user & engagement analytics               ││
│   · Analytics ◀──────│  └─────────────────────────────────────────────────────────┘│
│   · Feature Flags    │                                                              │
│   · Presets          │  KPI ROW  (Stat/KPI cards — §5 Data)                          │
│   · LLM Usage        │  ┌──────────┬──────────┬──────────┬──────────┐               │
│  System              │  │TotalUsers│ Students │ Teachers │ Active 7d│               │
│   · System Health    │  │ 12,480   │  9,120   │  3,360   │  4,210   │               │
│   · Settings         │  │ ▲ 6.2% wk│ 73% users│ 27% users│ 34% MAU* │               │
│   · Announcements    │  └──────────┴──────────┴──────────┴──────────┘               │
│   · Users            │   (* "of total" / "WoW" deltas; icon+label, never color-only)│
│                      │                                                              │
│                      │  TRENDS  (two charts side by side @ lg)                       │
│                      │  ┌───────────────────────────┬───────────────────────────┐   │
│                      │  │ Signups over time         │ Active users / retention  │   │
│                      │  │  (area, Card e1)          │  (line, Card e1)          │   │
│                      │  │  ╱╲    ╱╲                  │  ───╲___╱───              │   │
│                      │  └───────────────────────────┴───────────────────────────┘   │
│                      │                                                              │
│                      │  PLAN MIX  (Card — horizontal segmented bars)                │
│                      │  ┌─────────────────────────────────────────────────────────┐│
│                      │  │ Users by subscription plan                              ││
│                      │  │ Enterprise ████████████ 5,200 (42%)                     ││
│                      │  │ Premium    ███████ 3,100 (25%)   …                      ││
│                      │  └─────────────────────────────────────────────────────────┘│
│                      │                                                              │
│                      │  PER-TENANT COMPARISON  (DataTable — §5 Data)                 │
│                      │  ┌─────────────────────────────────────────────────────────┐│
│                      │  │ Users by tenant   [⌕ filter]  sorted: Total ▾           ││
│                      │  │ Tenant │ Code │ Students │ Teachers │ Total │ Active │St ││
│                      │  │ ──────────────────────────────────────────────────────  ││
│                      │  │ Acme Ac│ ACME │   820    │   210    │ 1,030 │  41%   │● ▸││  ← row → /tenants/:id
│                      │  │  …                                                       ││
│                      │  │                              [‹ Prev]  page  [Next ›]    ││  ← cursor paging
│                      │  └─────────────────────────────────────────────────────────┘│
│                      │  (perf note banner shown only in dev/legacy fallback — §5)   │
└──────────────────────┴───────────────────────────────────────────────────────────┘
```

**Grid & responsive:**

- **lg (≥1024):** Sidebar fixed (collapsible to icon rail). KPI row = 4 columns
  (`grid-cols-4`, gap 16 / spacing-4). Trends = 2 columns. Plan mix and tenant
  table full-width. Content max-width 1200, gutter 32.
- **md (768–1023):** Sidebar collapses to icon rail or off-canvas Drawer. KPI
  row = 2×2 (`md:grid-cols-2`). Trends **stack** to 1 column. Table keeps all
  columns; horizontal scroll if needed; gutter 24.
- **sm (<768):** Single column throughout. KPI cards stack 1-up. Charts
  full-width, reduced height. **Table → stacked SubmissionCard-style rows** (one
  card per tenant: name + code header, Students/Teachers/Total/Active as a 2×2
  mini DefinitionList, StatusBadge, tap → detail). Range/Export controls
  collapse into an overflow `…` IconButton. Gutter 16. (Admin is primarily
  desktop — §10 — but the shell must not break on a phone.)

---

## 4. Components used (FOUNDATION §5 only)

**Navigation:** `AppShell` (Sidebar + Topbar), `Sidebar` (role-driven,
super-admin route manifest), `Topbar` (search, ⌘K, ThemeToggle, notifications,
profile — **no tenant switcher** here), `Breadcrumb`, `CommandPalette` (⌘K,
web-only).

**Containers:** `Card` (KPI cards, chart cards, plan-mix card, table card —
radius `lg`, elevation `e1` at rest, `e2` on hover for interactive tenant rows),
`Section` (KPI / Trends / Plan / Tenant groupings), `Panel` (optional filter
panel on sm), `Tooltip` (chart datapoint readouts, delta-arrow explanations),
`Popover` (Range picker, Export menu).

**Primitives:** `Button` (`secondary` for Export, `ghost` for "Try again" in
error state), `IconButton` (overflow `…`, refresh), `Select` / `Combobox`
(date-range presets: 7d / 30d / 90d / custom; segment filter), `DatePicker`
(custom range), `Input` (table filter/search).

**Data:** `Stat/KPI` (the 4 headline cards — value in mono, label, sub-delta),
`DataTable` (per-tenant: sortable columns, client filter, **cursor** pagination,
row select → navigate), `Pagination` (cursor-driven Prev/Next), `Badge` /
`StatusBadge` (tenant status: active / trial / suspended / expired / deactivated
— icon + label, never color-only), `ProgressBar` (plan-mix segmented bars +
per-tenant "active %" inline bar), `DefinitionList` (sm stacked-card body),
`EmptyState` (no tenants), `Skeleton` (loading), `Chip/Tag` (active
segment/range indicator).

**Feedback:** `InlineAlert/Banner` (the **perf / partial-data** note — see
§5/§8), `Toast` (sonner — export ready / export failed), `LoadingOverlay`
(export-in-progress, optional).

**Charts.** The two trend visualizations (signups area chart,
active-users/retention line chart) and the plan-mix bars. Foundation §5 lists
`ProgressBar` / `ProgressRing` but **no line/area chart primitive**. The legacy
app already standardizes on `recharts` (`app-super-admin.md` §1.1). **Proposed
foundation addition:** a `Chart` family (`LineChart`, `AreaChart`, `BarChart`)
wrapping recharts, themed strictly to Lyceum tokens — axis/grid in
`border.subtle`, primary series in `brand.primary`, the "spark/energy" series
(e.g. new-signups highlight) in `spark`, success/retention in `status.success`,
gridlines never pure black (warm-tinted like elevation shadows), tooltips on
`bg.surface` at `e2`, mono numerics. **This is the one genuinely new component
this screen needs and must be added to the foundation §5 inventory before
build.** No new colors/fonts/spacing are introduced — the chart composes
existing semantic tokens only.

---

## 5. States

All states render inside AppShell with `PageHeader` ("Platform Analytics")
always present so the operator keeps orientation.

**Loading (skeleton)** — `useGetSummary`/`useGetPerformanceTrends` pending.
Mirror the final layout: 4 `Skeleton` KPI cards (label bar + big-number bar +
sub bar), two chart-card skeletons (header bar + a shimmer block at chart
height), a plan-mix skeleton (3–4 rows of label + bar), and a table skeleton
(header row + 6–8 shimmer rows). Motion: skeleton shimmer respects
`prefers-reduced-motion` (static muted fill when reduced). Matches the legacy
skeleton shape (`UserAnalyticsPage.tsx:117–144`) but extended for charts.

**Empty** — platform has tenants but zero users, or (edge) zero tenants.
`EmptyState` (§5): `Building2`/`Users` glyph in a `bg.surface-sunken` circle,
Fraunces title, secondary body, no destructive CTA. Tenant table shows its own
inline empty row ("No tenants found" — preserved from
`UserAnalyticsPage.tsx:273–283`). Charts render an axis frame with a centered
"No data for this range" caption rather than a blank box.

**Error** — query `isError`. `InlineAlert` `variant="error"` (status.error,
AlertCircle icon + title + message), with a `ghost`/`link` **Try again** Button
calling `refetch()` (preserves legacy behavior `UserAnalyticsPage.tsx:147–162`).
Copy in §7. The whole analytical body is replaced by the alert; PageHeader
stays.

**Partial** — server returns headline KPIs and plan mix but the **trend series
is stale/unavailable** (e.g. the `platformDailyRollup` precompute hasn't run
yet, or a sub-query timed out). Render what we have; over the affected chart
show an `InlineAlert` (`variant="info"`, status.info) "Trend data is being
recomputed — last updated {relative time}." KPIs marked "as of {timestamp}" so
the operator never reads a stale number as live. This is the honest-numbers rule
(§8).

**Perf-note banner (legacy/fallback only)** — if the deployment is still on the
**client-scan fallback** (the API rollup not yet shipped), surface a dismissible
dev/staging `InlineAlert` `variant="warning"`: "Analytics are computed
client-side in this build and may be slow or capped at N tenants. The server
rollup is pending." This makes the flagged perf debt (`app-super-admin.md` §4.1)
visible instead of silent. Hidden in production once the server rollup lands.

**Success** — full layout per §3.

**Permission-gated variations by role:**

- `superAdmin` (claim + flag both true) → full page.
- **Any non-super-admin** (incl. `tenantAdmin`, `teacher`, etc.) → never reaches
  the page body; `RequireAuth` blocks at the route. If a stale-claim user passes
  the route guard but the **server** `getSummary(scope:'platform')` rejects (it
  independently re-checks super-admin — `be-analytics.md` §1), the page shows a
  full-bleed `EmptyState`/`InlineAlert` `variant="error"`: "Platform analytics
  are restricted to platform administrators." (server-authoritative, never trust
  the client gate alone — §8).

---

## 6. Interactions & motion

All motion uses §4 tokens; nothing here is celebratory — this is the serious
register.

- **Initial mount:** KPI cards + cards fade/translate-in (`base` 220ms,
  `ease.entrance`), staggered ~40ms left-to-right; charts draw their series with
  a subtle path reveal (`slow` 320ms, `ease.standard`). Reduced-motion: no
  translate, no path reveal — content simply appears.
- **Range change (Select/DatePicker):** updates KPI deltas, charts, and
  (optionally) tenant "active %" together. Charts cross-fade the series (`base`,
  `ease.standard`); a `Chip` reflects the active range. No layout shift — chart
  frame is reserved. While refetching, KPI numbers show an inline `Skeleton`
  over the value only (not the whole card), so labels stay put.
- **Tenant table sort:** click a column header → server (or client, if data
  already loaded) re-sorts; sort indicator (caret) animates `fast` 160ms;
  default sort is **Total desc** (preserved from legacy `tenantStats.sort`
  `UserAnalyticsPage.tsx:86`). Sort is keyboard-activatable (Enter/Space on the
  header).
- **Table filter:** typing in the filter `Input` debounces ~200ms then filters
  rows; result count updates live; empty result shows the inline empty row.
- **Pagination:** cursor Prev/Next (`common-api.md` §7) — fetch next page, fade
  rows (`fast`), keep header fixed; disabled Next when `nextCursor === null`.
- **Row → drill-in:** hovering a tenant row raises it `e1→e2` and shows a `▸`
  affordance; click/Enter navigates to `/tenants/:tenantId` (page transition
  `page` 420ms). This is navigation, not mutation — no confirm.
- **Chart hover/focus:** crosshair + `Tooltip` on `bg.surface` `e2` showing the
  exact value (mono) and date for that bucket; keyboard users tab to a focusable
  series and arrow through datapoints (an aria-described readout updates).
- **Export flow:** Export `Popover` → choose CSV / JSON (and current
  range/segment) → optimistic `Toast` "Preparing export…", then on success
  `Toast` "Export ready" with a "Download" action opening the 1-hour signed URL;
  on failure `Toast` `error` "Export failed — try again." Export is the **only**
  server side-effect and is audited (§8). No destructive `ConfirmDialog` is
  needed (read-only export); if an export could include PII at platform scale,
  gate behind a `ConfirmDialog` ("This export contains cross-tenant user counts.
  Continue?") — flagged for the API/compliance owner.
- **Refresh:** an `IconButton` (refresh) re-runs the queries; spins `fast` while
  pending.

There are **no optimistic domain updates** on this screen — every number is
server-authoritative; the client never edits an aggregate.

---

## 7. Content & copy

Tone: precise, neutral, credible. No exclamation marks, no student-facing
warmth, no emoji.

- **Page title (Fraunces):** "Platform Analytics"
- **Subtitle (Schibsted, text.secondary):** "Cross-tenant user and engagement
  analytics." (Legacy used "Platform-wide user statistics and growth" — keep
  that as an acceptable alternate.)
- **KPI labels:** "Total Users" · "Students" · "Teachers" · "Active Tenants"
  (optionally a 5th: "Active Users (7d)").
- **KPI sub-text:** "{n} tenants" · "{pct}% of users" · "of {n} total" · delta
  forms "▲ 6.2% vs last week" / "▼ 1.1% vs last month" (arrow is an icon
  **with** a sign and a "vs …" label — never color-only).
- **Trend chart titles:** "Signups over time" · "Active users & retention". Axis
  labels: "New signups", "Active users", date axis.
- **Plan-mix card title:** "Users by subscription plan." Row format: "{Plan} —
  {n} users ({pct}%)" with plan name capitalized.
- **Tenant table:** card title "Users by tenant"; helper "Sorted by total users,
  descending." Columns: "Tenant", "Code", "Students", "Teachers", "Total",
  "Active %", "Status". Caption (sr-only): "Cross-tenant user breakdown table."
- **Range control:** "Last 7 days" / "Last 30 days" / "Last 90 days" / "Custom
  range…". **Export:** "Export" → "CSV" / "JSON".
- **Empty (no users):** title "No platform users yet" — body "Once tenants
  onboard students and teachers, signups, engagement, and per-tenant comparisons
  will appear here."
- **Empty (no tenants):** inline "No tenants found." (preserved).
- **Empty (range has no data):** "No data for the selected range."
- **Error:** title "Failed to load analytics" — body "{server message, or} An
  unexpected error occurred while loading platform analytics." action "Try
  again".
- **Partial / stale:** "Trend data is being recomputed — last updated {relative
  time}." and KPI footnote "as of {timestamp}."
- **Perf-note (fallback build):** "Analytics are computed client-side in this
  build and may be slow or capped. The server rollup is pending."
- **Permission denial:** "Platform analytics are restricted to platform
  administrators."
- **Export toasts:** "Preparing export…" / "Export ready" (+ "Download") /
  "Export failed — try again."

---

## 8. Domain rules surfaced

- **Super-admin only, cross-tenant by design.** Access requires
  `isSuperAdmin === true` (the `/users/{uid}` boolean) **and** the
  `role:"superAdmin"` claim — defense-in-depth (`app-super-admin.md` §1.3,
  `auth-access.md`). This page is the one legitimate place tenant isolation is
  **deliberately crossed**, but only for _aggregate, read-only_ counts. The
  server `getSummary(scope:'platform')` independently re-verifies super-admin
  (`be-analytics.md` §1); the client gate is never trusted alone.
- **Tenant isolation still holds for drill-down.** Aggregates are cross-tenant;
  the moment the operator clicks into `/tenants/:tenantId`, normal tenant-scoped
  rules and audit apply. This page never exposes a single student's identity or
  PII — only per-tenant counts and rates.
- **Server-authoritative values.** Every KPI, plan-mix %, growth delta, and
  per-tenant total is computed server-side
  (`tenant.stats.totalStudents/totalTeachers` and the
  `platformDailyRollup`/`getSummary` aggregation) and presented as-is. The
  client does **not** recompute or "fix up" numbers — the legacy in-browser
  derivation is explicitly removed (`app-super-admin.md` §5.1). Stale data is
  labeled ("as of …"), never silently shown as live.
- **No mutation surface.** The page writes no domain data. The only server
  side-effect is **export**, which is **audit-logged** (`writePlatformActivity`
  / `logTenantAction` pattern, `app-super-admin.md` §1.4) with actor email,
  scope, range, and format — consistent with how every other platform action is
  audited.
- **No answer-key / assessment-content leakage.** This is user/engagement
  analytics; it surfaces no exam content, rubrics, or answer keys (the
  `AnswerKeyLock` rule is N/A here but the principle — server-only sensitive
  data — is honored: no per-student records are returned to the client).
- **Cost vs users separation.** AI cost / budget lives on `/llm-usage` (and
  `DailyCostSummary` / budget thresholds, `be-analytics.md`); this page
  intentionally does **not** show spend, to keep the engagement story
  uncluttered. Cross-link, don't duplicate.
- **Perf budget made visible.** The flagged full-collection-scan debt
  (`app-super-admin.md` §4.1) is replaced by server aggregation; while any
  fallback remains, the perf-note banner (§5) surfaces it rather than shipping a
  silent slow page.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Skip-to-content → PageHeader → Range Select → Export → KPI
  cards (each a focusable region with an accessible name "Total Users, 12,480,
  up 6.2% versus last week") → chart 1 → chart 2 → plan-mix bars → table filter
  → table (header cells sortable via keyboard) → pagination. Logical
  top-to-bottom, left-to-right.
- **Keyboard:** All controls operable without a pointer. Sortable `DataTable`
  headers are `<th>` with `aria-sort` (`ascending`/`descending`/`none`) and
  Enter/Space toggle. Cursor pagination buttons reachable and labeled ("Previous
  page" / "Next page", `aria-disabled` when no cursor). Charts expose a
  focusable series; arrow keys move between datapoints with a live
  `aria-live="polite"` readout of date + value. ⌘K palette fully keyboard-driven
  (web).
- **ARIA / semantics:** Charts are not decorative — each has a `role="img"` with
  an `aria-label` summary AND a visually-hidden data table fallback (`<table>`
  of the same series) so screen-reader users get the numbers, not just "chart."
  KPI deltas use `aria-label` carrying direction in words ("increased 6.2%") —
  **never direction-by-color/arrow alone**. `StatusBadge` pairs icon + text
  label (active/suspended/…); status is **never encoded by color alone**
  (foundation §2.3). Plan-mix bars include the numeric "% / count" in text
  adjacent to the bar, not only the bar length.
- **Contrast:** All text/number/background pairs meet AA (4.5:1 body, 3:1
  large/UI) using Lyceum semantic pairs; chart series colors are distinguishable
  not only by hue but by label + (where series overlap) line style / direct
  labeling, satisfying "not color-alone." Focus ring = `border.focus` 3px
  (foundation §4).
- **Reduced motion:** `prefers-reduced-motion` disables stagger, path-reveal,
  cross-fades, and skeleton shimmer; content and chart series appear statically.
  No essential information is conveyed only through motion.

---

## 10. Web ↔ mobile divergence

**Admin / super-admin is primarily a web/desktop tool** — this control plane is
built and optimized for desktop, and the super-admin app is a Vite React SPA +
PWA (`app-super-admin.md` §1.1), not part of the React Native learner/scanner
apps. State this explicitly: there is **no native mobile super-admin app**;
"mobile" here means the responsive web shell on a small viewport.

- **⌘K Command Palette is web-only** (foundation §6). On small viewports it is
  not offered; navigation falls back to the sidebar Drawer / mobile bottom-nav.
- **Tenant comparison table → stacked cards on sm** (foundation §6 "table on web
  → stacked cards on mobile"): the `DataTable` becomes one `Card` per tenant
  with a mini `DefinitionList`; hover affordances become press; row tap
  navigates to detail.
- **Hover → press:** chart tooltips and row-raise (`e1→e2`) become
  tap/long-press readouts on touch.
- **Charts** reduce to single-column, shorter height on sm; legends move below
  the plot; the sr-only data-table fallback is unchanged.
- **Range/Export controls** collapse into a single overflow `…` IconButton +
  Popover on sm.
- No camera/scanner/offline-queue concerns apply here (this is not a
  scanner/learner RN surface).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for Auto-LevelUp's SUPER-ADMIN control plane: "Platform Analytics
(User Analytics)" at route /analytics. Audience: a platform super-admin operating ACROSS all
tenants. Register: serious, precise, credible admin tooling — restraint in chrome, NOT the playful
student register. No emoji, no exclamation marks.

DESIGN SYSTEM — "Lyceum" (conform EXACTLY; invent nothing):
- Direction "Modern Scholarly": warm paper neutrals (never pure #FFF, never cool slate), deep
  scholarly indigo primary (NOT SaaS blue), a single marigold "spark" reserved for energy accents,
  warm-tinted shadows.
- Tokens (cite by semantic name, never hex): bg.canvas / bg.surface / bg.surface-sunken,
  text.primary / .secondary / .muted, border.subtle / .strong / .focus, brand.primary (+ hover),
  spark, status.success / .warning / .error / .info. Status colors ALWAYS paired with icon + label,
  never color alone.
- Type: Fraunces (serif display, h1–h3, hero numbers, empty-state titles), Schibsted Grotesk
  (UI/body/labels/buttons/tables), Spline Sans Mono (all numerics — KPIs, counts, %, IDs; tabular).
- Spacing 4px base; gutters mobile 16 / tablet 24 / desktop 32; max content width 1200.
  Radius: cards lg(14), inputs/buttons md(10), chips/badges pill. Elevation e1 cards at rest,
  e2 on hover/popover, e3 modals; focus ring 3px border.focus.
- Motion (felt, not seen): instant100/fast160/base220/slow320/page420 with ease.standard &
  ease.entrance; respect prefers-reduced-motion. Nothing celebratory on this screen.

SHELL: render inside AppShell — left Sidebar (super-admin nav: Overview/Platform/System, "Analytics"
active under Platform), Topbar with breadcrumb "Platform › Analytics" + global search + ⌘K +
theme toggle + notifications + profile. IMPORTANT: the super-admin Topbar has NO tenant switcher
(this operator is cross-tenant by definition).

LAYOUT (desktop-first, responsive):
1) PageHeader: title "Platform Analytics", subtitle "Cross-tenant user and engagement analytics",
   right-aligned Range select (7d/30d/90d/Custom) + secondary Export button.
2) KPI ROW — 4 Stat/KPI cards: Total Users, Students, Teachers, Active Tenants (optional 5th:
   Active Users 7d). Big mono value, label, and a delta sub-line "▲ 6.2% vs last week" where the
   direction is shown by icon + sign + words (accessible), not color alone.
3) TRENDS — two cards side-by-side at lg (stack at md/sm): an AREA chart "Signups over time" and a
   LINE chart "Active users & retention". Axes/grid in border.subtle, primary series brand.primary,
   highlighted/new series in spark, retention in status.success; tooltips on bg.surface at e2.
   (Charts are a proposed Lyceum addition wrapping recharts, themed to tokens only.)
4) PLAN MIX — a card with horizontal ProgressBar segments per subscription plan (Enterprise /
   Premium / Basic / Trial / None), each labeled "{Plan} — {n} users ({pct}%)".
5) PER-TENANT COMPARISON — a DataTable: columns Tenant, Code (mono chip), Students, Teachers, Total
   (bold), Active %, Status (StatusBadge with icon+label). Sortable headers (default Total desc),
   a filter Input, and cursor pagination (Prev/Next). Each row is a navigation entry point to
   /tenants/:id (raise e1→e2 on hover, ▸ affordance). NO inline editing — read-only.

RESPONSIVE: lg = 4-col KPIs + 2-col charts + full-width table. md = 2×2 KPIs, stacked charts,
sidebar collapses to rail/drawer. sm = single column; the tenant TABLE becomes stacked cards
(one per tenant: name+code header, 2×2 mini definition list, StatusBadge); ⌘K is hidden;
Range/Export collapse into an overflow … menu.

STATES: skeletons mirroring the layout (KPI/chart/plan/table); empty ("No platform users yet");
error InlineAlert (status.error) with a ghost "Try again"; PARTIAL (KPIs present but trend data
stale → info InlineAlert "Trend data is being recomputed — last updated …", KPIs labeled
"as of {timestamp}"); a dismissible WARNING perf-note banner shown only in a client-scan fallback
build. Numbers are SERVER-AUTHORITATIVE — never recomputed client-side; stale data is labeled,
never shown as live.

ACCESSIBILITY: WCAG AA contrast; every chart has role="img" + aria-label summary AND a visually
hidden data-table fallback; sortable headers use aria-sort + Enter/Space; KPI deltas carry
direction in words; status never by color alone; reduced-motion disables stagger/reveal/shimmer.

DOMAIN: super-admin only (cross-tenant aggregates, read-only); the only server side-effect is an
audited Export (CSV/JSON → 1-hour signed URL, toasts: "Preparing export…" / "Export ready" +
Download / "Export failed — try again"). No PII, no per-student rows, no exam/answer-key content.

Output: a clean, accessible React + Tailwind implementation composing ONLY Lyceum tokens and the
listed components. Do not introduce new colors, fonts, spacing, radii, shadows, or motion.
```
