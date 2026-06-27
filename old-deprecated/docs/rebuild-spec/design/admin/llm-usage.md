# LLM Usage & Cost (Platform) — Screen Spec

> Area: **admin / super-admin (platform control plane)** · Route: `/llm-usage` ·
> Audience: **superAdmin only** Conforms to the Lyceum foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All visual values cite semantic
> tokens by name; nothing new is invented except where explicitly flagged as a
> **proposed foundation addition** (§4). Register: **precise / credible admin
> chrome** (the serious register — restraint, not the playful student spark),
> per Foundation §1.

---

## 1. Purpose & primary user

**Primary user:** the **superAdmin** operating the platform control plane —
cross-tenant, not scoped to a single tenant. (Identity is the `isSuperAdmin`
boolean on `/users/{uid}`, not a membership row — auth-access §1.2, §2.)

**Job-to-be-done:** _"As the platform operator, I need a single monthly view of
how much LLM spend the whole platform is incurring, which tenants are driving
it, which tenants are approaching or over their AI budget, and what task types /
models the money is going to — so I can spot runaway cost, enforce budgets, and
forecast infra spend before the bill lands."_

This is the **platform-wide** observability screen. It is deliberately
**distinct from the per-tenant `ai-usage-cost` screen** (which a tenantAdmin
sees, scoped to their one tenant). This screen aggregates _across every tenant_;
the per-tenant screen aggregates _within one_. Same `DailyCostSummary` source
data, different scope and audience.

**Read-only by design.** This screen observes; it does not set budgets. Budget
_limits_ are configured on the tenant record (Tenant Detail →
subscription/billing). This screen surfaces `budgetUsedPercent` and flags
breaches, but the only actions here are scope/time navigation, drill-through to
a tenant, and CSV export.

---

## 2. Entry points & route

- **Route:** `/llm-usage` inside the `super-admin` app shell. Guarded by
  `RequireAuth` allowing **superAdmin only** (auth-access §1.7). A
  tenantAdmin/teacher/etc. who reaches this URL gets the standard not-authorized
  redirect — they are routed to the per-tenant `ai-usage-cost` screen instead.
- **Entry points:**
  - Super-admin **Sidebar** → "Platform" group → "LLM Usage & Cost".
  - **CommandPalette (⌘K)** → "LLM usage", "AI cost", "spend" (web only).
  - Deep-link from **Platform Health** ("LLM error rate" tile → this screen) and
    from **Tenant Detail** ("View AI spend" → this screen, pre-filtered to that
    tenant).

### Common-API reads/writes (`specs/common-api.md`)

This screen is **read-only** and goes entirely through the typed client SDK —
**no `firebase/firestore` in the UI** (common-API §2 "Key shift", §3.3). The
current live page does a **per-tenant N+1 fan-out from the browser**
(`apps/super-admin/src/pages/LLMUsagePage.tsx` loops every tenant and queries
each `tenants/{tenantId}/dailyCostSummaries` subcollection client-side). The
status report explicitly flags this (`be-analytics.md §4`, common-API §2). **The
rebuild replaces it with one server-side rollup call.**

| Need                                 | Callable                                                                                                                   | Notes                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform LLM cost rollup for a month | `v1.analytics.getSummary` with `scope: 'platform'` (discriminated combined-mode endpoint, common-API §3.1, §3.3 analytics) | Server fans out `dailyCostSummaries` across tenants **server-side** and returns the aggregated shape (totals, per-tenant rows, daily trend, by-purpose, by-model). Closes the N+1. `tenantId` is **not** in the request body; super-admin scope is authorized from claims (common-API §4.4). |
| (Drill-through) one tenant's detail  | navigate to `ai-usage-cost` with `tenantOverride`                                                                          | super-admin cross-tenant op carries an explicit, **audited** `tenantOverride` (common-API §4.4).                                                                                                                                                                                             |
| Export current view to CSV           | client-side serialization of the already-fetched rollup                                                                    | no extra call; nothing sensitive (answer keys, raw prompts) is ever in this payload.                                                                                                                                                                                                         |

> **Proposed contract addition (flag to backend):**
> `getSummary scope:'platform'` today returns identity/health counts
> (be-analytics §1 `get-summary.ts`). It must be **extended** to return (or a
> sibling `scope:'platform-cost'` added for) the LLM-cost rollup
> `{ month, platformTotalCost, platformTotalCalls, platformTotalInput, platformTotalOutput, activeTenants, tenantCosts[], dailyTrend[], byPurpose[], byModel[] }`,
> with `PageRequest` paging on `tenantCosts` (common-API §7). Server-side rollup
> is the explicit recommendation in be-analytics §4 / common-API §2. Until that
> exists, this screen is a **partial/perf-degraded** state (§5).

**Request shape (month selection):** `{ scope: 'platform', month: 'YYYY-MM' }`
(the live page derives a month window via `monthOffset`; the rebuild passes an
explicit `month` string so the server owns the date math and the client stays
transport-agnostic). Paging fragment (§7 common-API): `cursor` + `limit` on the
tenant table.

**Source fields (ground truth — `DailyCostSummary`,
`packages/shared-types/src/progress/analytics.ts`):** `tenantId`, `date`,
`totalCalls`, `totalInputTokens`, `totalOutputTokens`, `totalCostUsd`,
`byPurpose{ calls, inputTokens, outputTokens, costUsd }`,
`byModel{ calls, inputTokens, outputTokens, costUsd }`, `budgetLimitUsd?`,
`budgetUsedPercent?`, `budgetAlertSent?`, `computedAt`. Per-tenant identity
(`name`, `tenantCode`, `status`) joins from the `Tenant` doc. **`byModel` is in
the type but the current page never surfaces it — the rebuild adds a by-model
breakdown (§4).**

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Foundation §5 Navigation): persistent **Sidebar**
(super-admin platform nav, active item highlighted with `brand.primary`) +
**Topbar** (no tenant switcher for this platform screen — super-admin is
cross-tenant; Topbar shows global search, notifications, profile). Page gutters
per Foundation §4: 32 desktop / 24 tablet / 16 mobile; content max-width 1200.

```
┌─ AppShell ────────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (search · notifications · profile)                            │
│ (plat-  ├──────────────────────────────────────────────────────────────────────┤
│  form   │ ┌ PAGE HEADER ──────────────────────────────────────────────────────┐ │
│  nav,   │ │ H1 "LLM Usage & Cost"   ·  sub "Platform-wide AI spend across all  │ │
│ LLM     │ │ tenants"            [ Export CSV ]  ← secondary Button (right)     │ │
│ Usage   │ └───────────────────────────────────────────────────────────────────┘ │
│ active) │ ┌ CONTROL BAR (sticky on scroll) ───────────────────────────────────┐ │
│         │ │ [‹ prev]  ⌗ June 2026  [next ›]   ·   [All tenants ▾] [All models ▾]│ │
│         │ └───────────────────────────────────────────────────────────────────┘ │
│         │ ┌ KPI ROW — 4 × Stat/KPI (mono numerics) ───────────────────────────┐ │
│         │ │ ┌Monthly Cost┐ ┌Total Calls┐ ┌Input Tokens┐ ┌Output Tokens┐       │ │
│         │ │ │ $1,284.50  │ │  482,193  │ │  91.4M     │ │  22.7M      │       │ │
│         │ │ │ 14 tenants │ │ all tenants│ │ total in   │ │ total out   │       │ │
│         │ │ └────────────┘ └───────────┘ └────────────┘ └─────────────┘       │ │
│         │ └───────────────────────────────────────────────────────────────────┘ │
│         │ ┌ TREND CARD ───────────────────┐ ┌ BREAKDOWN CARDS (stacked md+) ──┐ │
│         │ │ "Daily Cost Trend"            │ │ Card "Cost by Task Type"        │ │
│         │ │ [ bar chart, mono $ axis ]    │ │  grading  ███████ $612 (48%)     │ │
│         │ │ height 260                    │ │  tutoring ████ $321 (25%) …      │ │
│         │ │                               │ │ Card "Cost by Model"            │ │
│         │ │                               │ │  claude-… ███████ $980 (76%) …  │ │
│         │ └───────────────────────────────┘ └─────────────────────────────────┘ │
│         │ ┌ PER-TENANT TABLE (DataTable) ─────────────────────────────────────┐ │
│         │ │ Tenant │ Status │ Calls │ Cost ▾ │ Budget │ Used % (bar+label)    │ │
│         │ │ Acme HS · ACME01 │ ●Active │ 41,233 │ $612.40 │ $750 │ ▓▓▓▓░ 82% ⚠ │ │
│         │ │ …                                                          (rows)   │ │
│         │ │                                          [ DataTablePagination ]    │ │
│         │ └───────────────────────────────────────────────────────────────────┘ │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

**Grid & responsive:**

- **lg (≥1024):** KPI row = 4 columns. Trend (≈8/12) and Breakdown column
  (≈4/12) sit side-by-side; if vertical rhythm reads cramped, Trend spans full
  width above a 2-up Breakdown row. Table full width, all columns visible.
- **md (768–1023):** KPI = 2×2. Trend full width; the two Breakdown cards stack
  full width beneath it. Table keeps all columns; horizontal scroll only if
  needed.
- **sm (<768) — admin is web-first, this is a degraded fallback (§10):** KPI =
  single column (4 stacked Stat cards). Charts full width, reduced height.
  **Table collapses to stacked SubmissionCard-style rows** (label → value pairs)
  per Foundation §6 (table on web → stacked cards on mobile). Control bar wraps;
  month stepper on its own row above the filter selects.

**Mono numerics** (Foundation §3 — Spline Sans Mono for all numbers, tabular
alignment): every dollar amount, call count, token count, percentage, and the
month tick labels render in mono, right-aligned in their columns.

---

## 4. Components used (Foundation §5 only)

- **AppShell**, **Sidebar**, **Topbar** — navigation chrome (no tenant switcher
  in Topbar on this screen).
- **CommandPalette (⌘K)** — entry point (web only).
- **Section** / **PageHeader pattern** via Section + Display heading — title +
  subtitle + right-aligned action.
- **Button** — `secondary` for "Export CSV"; **IconButton** (ghost) for month
  prev/next steppers.
- **Select** — "All tenants" and "All models" filters (Foundation §5
  primitives). Never empty-string values (memory lesson — Radix Select).
- **Stat/KPI** — the 4 summary tiles (label, mono value, mono subtext, lucide
  icon).
- **Card** / **Panel** — Trend, Breakdown (Task Type / Model), and Table
  containers (`bg.surface`, radius `lg`, elevation `e1`).
- **ProgressBar** — by-purpose / by-model share bars, and the per-tenant
  **budget-used** bar.
- **DataTable** (sort / paginate / row-select) + **Pagination** — the per-tenant
  table, default sort `Cost desc`.
- **Badge** — tenant `status` (Active / Trial / Suspended) and a
  **budget-state** badge (OK / Near / Over).
- **Chip/Tag** — active filter chips ("Tenant: Acme HS ✕", "Model: claude-… ✕")
  when filters applied.
- **Skeleton** — loading state for KPIs, chart, and table rows.
- **EmptyState** — zero-usage month.
- **InlineAlert/Banner** — the **N+1 perf / stale-data** notice and the
  partial-rollup warning (§5).
- **Toast (sonner)** — export success/failure; refetch confirmation.
- **Tooltip** — chart hover (date → cost), truncated tenant names, budget-bar
  exact percentage.
- **DefinitionList** — (mobile-stacked table rows render as label/value
  DefinitionLists).
- **LoadingOverlay** — month-change refetch over already-rendered data (subtle,
  non-blocking).

**Charts:** the live page uses `recharts` (bar chart). Recharts is **not** a
Foundation §5 component. **Proposed foundation addition — flag:** a thin
**`Chart`/`BarChart` wrapper** that maps the recharts surface to Lyceum tokens
(bars = `brand.primary`; grid = `border.subtle`; axis/tick text = `text.muted`;
tooltip surface = `bg.surface` + `border.subtle` + `e2`; cursor fill =
`bg.inset`). No raw hex in the chart; all colors flow from semantic tokens. Add
this wrapper to §5 Data components before build.

**Proposed addition — "Cost by Model" card:** mirrors the existing "Cost by Task
Type" card but iterates `byModel`. Composes only from Card + ProgressBar + mono
text — **no new primitive**, just a second instance of an existing pattern. (The
data already exists on `DailyCostSummary.byModel`; current page omits it.)

No other additions. Everything else composes from existing tokens/components.

---

## 5. States

**Loading (skeleton).** Sidebar/Topbar render immediately. KPI row → 4 Skeleton
Stat cards (label bar, large value bar, subtext bar). Trend → Card with a
260-tall Skeleton block. Breakdown → 4–5 Skeleton rows with bar placeholders.
Table → header rendered, 8 Skeleton rows (mono columns shown as right-aligned
bars). Control bar month label and steppers are interactive but disabled until
first load resolves.

**Empty (zero usage this month).** Server returns `activeTenants: 0`, empty
`tenantCosts`/`dailyTrend`. Replace the chart + table region with a single
centered **EmptyState** (DollarSign icon in a muted circle, serif title, body
copy — see §7). KPIs still render as `$0.00` / `0` (truthful zeros, not
skeletons). Month stepper stays active so the operator can page to a month with
data.

**Error.** `getSummary` throws → **InlineAlert (destructive)** at top of the
content region: AlertCircle icon + title + the typed
`error.details.code`/message (common-API §6.3 `useApiError`), with a **"Try
again"** ghost Button that refetches. Charts/table are not rendered. A React
Query error boundary catches anything the inline alert doesn't (common-API §6.3
— "errors never render as empty states").

**Partial.**

- **Per-tenant rollup degraded / N+1 fallback:** if the server-side rollup is
  unavailable and the client is on the legacy per-tenant fan-out path (or some
  tenant subcollections failed/timed out), show a **warning InlineAlert**:
  _"Showing partial data — N of M tenants rolled up."_ Successfully-fetched
  tenants still render; the failed set is listed by code. This is the documented
  N+1 perf risk (be-analytics §4, scope note) made visible rather than silently
  wrong.
- **Missing budget on a tenant:** `budgetLimitUsd` undefined → Budget cell shows
  `—` and Used-% cell shows a muted "No budget" label (never a 0% bar, which
  would imply a configured-but-unused budget).
- **Stale rollup:** `dailyCostAggregation` runs cron `5 0 * * *` (be-analytics
  §1) so the current day is always incomplete. Show a subtle caption under the
  KPI row: _"Aggregated nightly · last computed {computedAt}."_

**Success.** Full render: KPIs, Trend, Cost-by-Task-Type, Cost-by-Model,
sortable/paginated per-tenant table with budget bars and status/budget badges.

**Permission-gated variations by role.**

- **superAdmin:** full screen, all tenants, drill-through, export. (The only
  intended role.)
- **tenantAdmin / teacher / staff / parent / student:** **no access** —
  `RequireAuth` blocks the route (auth-access §1.7). They are redirected to the
  per-tenant `ai-usage-cost` screen (tenantAdmin) or to their home. There is
  **no "scoped" variant of this screen** — cross-tenant data is a hard isolation
  boundary (§8).

---

## 6. Interactions & motion (Foundation §4 motion tokens)

- **Month stepper.** Prev/next IconButtons change the requested `month`; "next"
  is **disabled at the current month** (no future data). On change: a
  **LoadingOverlay** fades in over the existing content (`fast 160ms`,
  `ease.standard`) while the new month's rollup loads, then KPI values
  **cross-fade** to new numbers (`base 220ms`). Existing data stays visible
  underneath — no full-page skeleton flash on navigation.
- **Filters (tenant / model Select).** Client-side filter of the already-fetched
  rollup where possible (instant, no refetch); applied filters surface as
  removable **Chips**. Filtering recomputes KPI subtext counts and the table in
  place; chart re-animates bars with `base 220ms` `ease.entrance`.
- **Table sort.** Clicking a sortable header toggles asc/desc; the sort
  indicator and row reorder animate at `fast 160ms`. Default `Cost desc`.
- **Row drill-through.** Clicking a tenant row navigates to that tenant's
  `ai-usage-cost` with an **audited** `tenantOverride` (§8). Row hover =
  `bg.surface-sunken` at `instant 100ms`.
- **Export CSV.** Click → client serializes the current (filtered) view →
  browser download → **Toast** "Exported {month} LLM usage ({N} tenants)."
  Failure → destructive Toast with retry.
- **Refetch / "Try again".** From the error alert; spinner in the button, then
  content swaps in at `base 220ms`.
- **No celebratory motion.** This is the serious admin register (Foundation §1,
  §4). **No spark burst, no spring pop** — the marigold `spark` token and
  gamification motion are reserved for the student surface and must not appear
  here. Budget-breach emphasis uses `status.error` + icon + label, not
  animation.
- **No optimistic mutations** — the screen is read-only; nothing to
  optimistically update.
- **Reduced motion:** all of the above collapse to instant opacity swaps under
  `prefers-reduced-motion` (§9).

---

## 7. Content & copy (precise admin tone)

**Headings & labels**

- H1: **"LLM Usage & Cost"** · subtitle: **"Platform-wide AI spend across all
  tenants."**
- Control bar: month label e.g. **"June 2026"** (mono); filter Selects **"All
  tenants"**, **"All models"**.
- KPI tiles: **"Monthly Cost"** (`${platformTotalCost}`, subtext
  _"{activeTenants} tenants with usage"_) · **"Total API Calls"** (subtext
  _"across all tenants"_) · **"Input Tokens"** (subtext _"total input"_) ·
  **"Output Tokens"** (subtext _"total output"_).
- Cards: **"Daily Cost Trend"** · **"Cost by Task Type"** · **"Cost by Model"**
  · **"Per-Tenant Usage"** (caption _"Sorted by cost, descending"_).
- Table columns: **Tenant · Status · Calls · Cost · Budget · Usage**.
- Stale caption: **"Aggregated nightly · last computed {relativeTime}."**
- Budget badges: **"On budget"** / **"Near limit"** (≥80%) / **"Over budget"**
  (≥100%).

**Empty-state copy**

- Title (serif): **"No AI usage this month."**
- Body: **"No tenant recorded any LLM activity for {Month YYYY}. Usage appears
  here once tenants use AI grading, tutoring, or question extraction. Cost data
  aggregates nightly."**

**Error copy**

- Title: **"Couldn't load platform LLM usage."**
- Body: **"{error message}. This view reads a nightly cost rollup — if the
  problem persists, the aggregation job may not have run."** Action: **"Try
  again."**

**Partial / perf copy**

- N+1 fallback: **"Showing partial data — {N} of {M} tenants rolled up. The
  platform cost rollup is the authoritative source; per-tenant client
  aggregation is a fallback."**
- No-budget cell: **"No budget"**.

**Tone:** declarative, numeric, no exclamation, no encouragement. This is
operator tooling.

---

## 8. Domain rules surfaced

- **Tenant isolation is the hard boundary — super-admin is the only cross-tenant
  viewer.** This screen reads _every_ tenant's `dailyCostSummaries`, which is
  only permissible because the caller is `isSuperAdmin` (auth-access §1.2,
  §1.5). No tenant-scoped role may ever see another tenant's cost. The rebuild
  routes the cross-tenant read through `getSummary scope:'platform'` whose
  **server-side** authorization checks `isSuperAdmin` from claims (common-API
  §4.3–4.4) — the browser never assembles cross-tenant data from raw Firestore
  (which the current N+1 page does, relying on rules; the rebuild removes that
  path).
- **`tenantOverride` is audited.** Any drill-through that scopes to one tenant
  carries an explicit, audited `tenantOverride` (common-API §4.4, §9 audit).
  Cross-tenant access is logged.
- **Server-authoritative values.** Every dollar/token/percentage is computed
  server-side by the nightly `dailyCostAggregation` scheduler and `getSummary`
  rollup. The client **never** recomputes cost from raw `llmCallLogs`; it only
  renders and (optionally) client-filters the server's numbers.
  `budgetUsedPercent` and budget thresholds are server-derived against the
  tenant's `subscription.monthlyBudgetUsd`.
- **Budgets observed, not enforced here.** Budget _limits_ live on the tenant
  record; this screen is read-only observability. (Note from be-analytics §4:
  the scheduler currently only `console.warn`s on breach and does not notify —
  surfacing breaches visibly here partly compensates until `ai_budget_alert`
  notifications are wired.)
- **No raw prompts / completions / answer keys.** The cost rollup contains only
  aggregate counts and costs (`DailyCostSummary` / `LLMCallLog` cost fields).
  Prompt text, model outputs, student answers, and **answer keys are never
  present** in this payload — answer keys are Admin-SDK-only and invisible to
  all clients (auth-access §1.5; Foundation `AnswerKeyLock`). Nothing on this
  screen risks exposing them.
- **RBAC gating.** Route + callable both gate on `isSuperAdmin`; UI guard is
  UX-only, server authorization is the real boundary (auth-access §1.6–1.7).
- **Never status-by-color-alone.** Tenant status and budget state always pair a
  Badge **label + icon** with the color (§9, Foundation §2.3).

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Skip-link → Sidebar (active "LLM Usage") → Topbar controls →
  Export button → month prev / month-label / month next → Tenant filter → Model
  filter → (any active filter Chips, each with a focusable ✕) → chart region
  (focusable group with text summary) → Cost-by-Task / Cost-by-Model lists →
  table (header sort buttons → rows → Pagination). Logical top-to-bottom,
  left-to-right.
- **Keyboard:** all steppers/filters/sort headers/pagination operable via
  Enter/Space; Select via arrow keys; table sortable headers are `<button>`s
  with `aria-sort` on the column header. Drill-through rows are reachable via a
  focusable tenant link in the first cell (not a whole-row click trap). ⌘K opens
  CommandPalette.
- **ARIA / semantics:** `<main>` landmark; H1 → card H2/H3 hierarchy. Table is a
  real `<table>` with `<caption class="sr-only">` "LLM usage by tenant" and
  scoped `<th>`s. KPI Stat cards expose label + value to SR as a single readable
  string ("Monthly Cost, $1,284.50, 14 tenants with usage"). Charts carry an
  `aria-label` summary and an SR-only data table fallback (date → cost) so the
  bar chart isn't purely visual. LoadingOverlay sets `aria-busy="true"` on the
  region; live region announces "Loaded {Month}" after refetch.
- **Contrast:** mono numerics use `text.primary` on `bg.surface` (AA body
  4.5:1). `text.muted` subtext meets AA. Budget bar fills: OK = `brand.primary`,
  Near = `status.warning`, Over = `status.error` — and the percentage **label**
  uses the matching text token at AA, so the state is never color-only.
- **Status never by color alone:** tenant status Badge = dot **+ word** ("●
  Active"); budget state = colored bar **+ icon** (AlertTriangle for Over/Near)
  **+ "{pct}%"** mono label **+** badge word ("Over budget"). A colorblind or
  grayscale operator reads the state from icon/text.
- **Reduced motion:** `prefers-reduced-motion` → no chart bar grow animation, no
  cross-fades; content swaps instantly. The LoadingOverlay becomes a static
  "Loading…" caption.
- **Touch targets** ≥44px for steppers/filter controls (Foundation §4), relevant
  on the mobile fallback.

---

## 10. Web ↔ mobile divergence

**Admin is primarily web / desktop. This screen is web-first and not a primary
mobile target** — the super-admin control plane is operated from a desktop.
There is **no dedicated React Native build** of this screen; the only mobile
consideration is responsive degradation of the web app on a small viewport.

- **⌘K CommandPalette is web-only** (Foundation §6) — no command-palette entry
  point on mobile.
- **Tables → stacked cards** on `sm`: the per-tenant DataTable collapses to
  stacked **DefinitionList** rows (Tenant + code header, then Status / Calls /
  Cost / Budget / Used-% as label→value pairs with the budget bar inline). Sort
  becomes a single Select; pagination unchanged. (Foundation §6: table on web →
  stacked cards on mobile.)
- **Hover → press:** chart tooltips and row hover affordances become tap/press
  on touch; budget-bar exact % is shown inline rather than tooltip-only on small
  screens.
- **Charts:** retain full width, reduced height; horizontal axis tick density
  reduced on narrow viewports.
- The KPI row stacks to a single column; the two breakdown cards stack
  full-width under the trend chart.

No data, permission, or domain-rule divergence between viewports — same server
rollup, same isolation rules.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp super-admin web app, conforming to the
Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md). Read the foundation first
and use ONLY its semantic tokens and §5 component inventory — do not invent colors, fonts,
spacing, radii, shadows, or component variants. This is ADMIN tooling: the serious, precise,
credible register — restraint in chrome, NO student gamification spark, NO celebratory motion.

SCREEN: "LLM Usage & Cost (Platform)" · route /llm-usage · audience superAdmin ONLY (cross-tenant).
Distinct from the per-tenant ai-usage-cost screen. Read-only observability.

Render inside AppShell (Sidebar with "LLM Usage" active + Topbar — NO tenant switcher, since
super-admin is cross-tenant). Page gutter 32 desktop. Typography: Fraunces for the H1, Schibsted
Grotesk for UI/labels, Spline Sans Mono for ALL numerics (dollars, calls, tokens, %), tabular,
right-aligned in tables.

LAYOUT (top to bottom):
1. PageHeader: H1 "LLM Usage & Cost", subtitle "Platform-wide AI spend across all tenants",
   right-aligned secondary Button "Export CSV".
2. Control bar (sticky): month stepper [‹] "June 2026" [›] (next disabled at current month),
   plus two Selects "All tenants" / "All models"; applied filters show as removable Chips.
   Caption beneath: "Aggregated nightly · last computed 2h ago."
3. KPI row — 4 Stat/KPI cards (mono values): Monthly Cost ($1,284.50, "14 tenants with usage"),
   Total API Calls (482,193, "across all tenants"), Input Tokens (91.4M), Output Tokens (22.7M).
4. Daily Cost Trend — Card with a bar chart: bars use brand.primary, grid = border.subtle,
   axis text = text.muted, mono "$" Y-axis, tooltip surface = bg.surface + border.subtle + e2.
5. Two breakdown Cards (stack on md): "Cost by Task Type" and "Cost by Model" — each a list of
   rows with a label, a mono "$X.XX (NN%) · N calls", and a ProgressBar of the share.
6. Per-Tenant Usage — DataTable sorted Cost desc, columns: Tenant (name + mono code) · Status
   (Badge: dot+word) · Calls (mono) · Cost (mono) · Budget (mono or "—") · Usage (ProgressBar +
   mono "%"). Budget bar: brand.primary <80%, status.warning ≥80% ("Near limit"), status.error
   ≥100% ("Over budget") — ALWAYS pair color with an icon + label, never color alone. Rows link
   to that tenant's ai-usage-cost (drill-through). DataTablePagination below.

STATES: skeleton (4 KPI + chart + 8 rows); empty ("No AI usage this month."); destructive
InlineAlert error with "Try again"; partial warning InlineAlert "Showing partial data — N of M
tenants rolled up"; "No budget" muted cell when a tenant has no budgetLimitUsd.

MOTION (Foundation §4): month change = LoadingOverlay fade (160ms) over existing data + KPI
cross-fade (220ms); sort/filter 160ms; row hover = bg.surface-sunken instant. NO spark burst,
NO spring pop. Respect prefers-reduced-motion (instant swaps).

A11Y: real <table> + sr-only caption; sortable <th> buttons with aria-sort; chart has aria-label
summary + sr-only data-table fallback; status/budget state conveyed by icon+label+color (never
color alone); WCAG AA contrast; logical focus order Sidebar→Topbar→Export→stepper→filters→table.

DATA (server-authoritative, read-only via api.analytics.getSummary scope:'platform'; NO direct
Firestore reads): { month, platformTotalCost, platformTotalCalls, platformTotalInput,
platformTotalOutput, activeTenants, tenantCosts:[{tenantId,tenantName,tenantCode,status,totalCost,
totalCalls,totalInputTokens,totalOutputTokens,budgetLimitUsd?,budgetUsedPercent?}], dailyTrend:
[{date,label,cost,calls}], byPurpose:[{name,costUsd,calls}], byModel:[{name,costUsd,calls}] }.
No prompts, completions, student answers, or answer keys are ever in this payload.

Deliver responsive: lg = 4-col KPI + side-by-side trend/breakdown + full table; md = 2x2 KPI,
stacked cards; sm = single-column KPI, charts full-width, table collapses to stacked
label/value cards. Tenant isolation is absolute — only super-admin sees cross-tenant data.
```
