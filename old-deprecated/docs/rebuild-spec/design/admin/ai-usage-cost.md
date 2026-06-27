# AI Usage & Cost (Tenant) — Screen Spec

> **Area:** admin · **Route:** `/ai-usage` · **Audience:** `tenantAdmin`
> (tenant-scoped) Conforms to **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). Tokens cited by semantic name
> only. Register: **precise / credible** (serious admin chrome — restraint, not
> the student spark register). Spark is permitted only where the foundation
> already reserves it (it does **not** belong on cost dashboards; see §4).

---

## 1. Purpose & primary user

**Primary user:** `tenantAdmin` — a single-tenant administrator (claims
`role: tenantAdmin`, scoped to one `tenantId`; `tenantAdmin gets nothing extra`
in claims per auth-access §1.3, so all scoping is server-enforced).

**Job-to-be-done:** _"Is my school's AI spend under control this month, where is
it going, and am I about to hit the budget?"_ The admin needs to (a) see
month-to-date AI/LLM cost against the configured monthly budget, (b) understand
which **purposes** (extraction, grading, evaluation, tutoring) and which
**models** drive cost, (c) read the **daily trend** and a **month-end
projection**, and (d) be unmistakably warned when usage approaches or breaches
the quota — because **quota breach pauses AI grading** (a real operational
consequence, surfaced in the live `AIUsagePage` over-quota banner). Secondary
job: triage **failed grading attempts** (dead-letter queue) that may be silently
burning retries.

This is a **read-only monitoring + diagnosis** screen. The only mutating action
is a deep-link to **Settings** to change the budget/quota (the budget itself is
edited elsewhere, never inline here).

---

## 2. Entry points & route

**Route:** `/ai-usage` (admin-web). Rendered inside **AppShell** (Sidebar +
Topbar). Sidebar nav entry ("AI Usage & Cost") is role-gated to `tenantAdmin`;
route guard rejects other roles (auth-access §1.7 client route guards) and the
server re-checks on every read.

**Entry points:**

- Sidebar → "AI Usage & Cost".
- **QuotaWarningBanner** (global, rendered in AppShell topbar region) → "View
  usage" deep-links here when `useQuotaStatus()` level is `amber` / `red` /
  `expired`.
- Admin Dashboard **QuotaUsageCard** → "View details" → here.
- ⌘K CommandPalette (web-only) → "AI Usage & Cost".

**Reads/writes powering it** (reference `specs/common-api.md` §3 analytics + the
API seam in §144/§151):

| Data                          | Source (rebuild)                                                                                                                                                                                                                                                                                                                                                                       | Notes                                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------- | -------------------------- |
| Monthly cost rollups + trend  | `v1.analytics.getSummary` with **`scope: 'health'`** is superAdmin-only; for tenant cost this screen reads the **materialized `DailyCostSummary` docs** for the selected month via `shared-hooks` `useDailyCostSummaries(tenantId, {start,end})` (today's hook), to be promoted behind a tenant-scoped read endpoint `v1.analytics.listDailyCostSummaries` (see §4 proposed addition). | `tenants/{tenantId}/costSummaries/daily/{date}` → `DailyCostSummary` (`shared-types/src/progress/analytics.ts:15`). be-analytics §2 written by `dailyCostAggregation` cron `5 0 * * *`. |
| Budget / quota config         | `useTenantSettings(tenantId)` → `tenantSettings.usageQuota` `{ monthlyBudgetUsd, dailyCallLimit, warningThresholdPercent }` (also `subscription.monthlyBudgetUsd`, be-analytics §1).                                                                                                                                                                                                   | Server-authoritative. Edited only in Settings.                                                                                                                                          |
| Live quota banner level       | `useQuotaStatus()` → `{ level: 'none'                                                                                                                                                                                                                                                                                                                                                  | 'amber'                                                                                                                                                                                 | 'red' | 'expired', message }`. | Drives QuotaWarningBanner. |
| Failed grading attempts (DLQ) | `tenants/{tenantId}/gradingDeadLetter` (orderBy `lastAttemptAt` desc, limit 50).                                                                                                                                                                                                                                                                                                       | Per live `AIUsagePage`; in rebuild fold behind `v1.analytics.getSummary scope:'health'` for superAdmin, but tenant-scoped DLQ read stays tenant-rules-gated.                            |

`DailyCostSummary` shape (verified): `date`, `totalCalls`, `totalInputTokens`,
`totalOutputTokens`, `totalCostUsd`,
`byPurpose: Record<purpose,{calls,inputTokens,outputTokens,costUsd}>`,
**`byModel: Record<model,{...}>`** (present in the type but **not** surfaced in
today's UI — the rebuild surfaces it; see §3), `budgetLimitUsd?`,
`budgetUsedPercent?`.

---

## 3. Layout — wireframe-as-text

Rendered in **AppShell**: persistent **Sidebar** (left, role-driven nav) +
**Topbar** (tenant name — single tenant, no switcher for a single-membership
admin; search; notifications; profile). The page body is the scroll region with
desktop gutter 32 (foundation §4), max content width 1200.

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar [tenant name · search · ⌘K · notifications · profile]        │
│         ├──────────────────────────────────────────────────────────────────── │
│         │ ┌ QuotaWarningBanner (only if useQuotaStatus.level != none) ───────┐ │
│         │ │ ⚠ icon  message text ………………………………………………………  [View usage] [×]   │ │
│         │ └──────────────────────────────────────────────────────────────────┘ │
│         │                                                                       │
│         │ PAGE HEADER (Section header row)                                      │
│         │   h1 "AI Usage & Cost"   subtitle               [‹ 2026-06 ›] month  │
│         │                                                  picker  [Export ⌄]   │
│         │                                                                       │
│         │ ROW A — KPI strip  (Stat/KPI ×4, mono figures)                        │
│         │  ┌Monthly Cost┐ ┌Total Calls┐ ┌Input Tokens┐ ┌Output Tokens┐         │
│         │  │ $1,284.50  │ │  18,402   │ │   42.1M    │ │   9.3M      │         │
│         │  └────────────┘ └───────────┘ └────────────┘ └─────────────┘         │
│         │                                                                       │
│         │ ROW B — Budget panel (Card, full width)                              │
│         │  "Monthly Budget Usage"        $1,284.50 / $2,000.00  (mono)          │
│         │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  ProgressBar  64% of budget   [status pill]      │
│         │  Month-end projection: $1,930.00  ·  $64.20/day avg · 20 days elapsed │
│         │                                                                       │
│         │ ROW C — two-up (lg) / stacked (sm,md)                                 │
│         │  ┌ Daily Cost Trend (Card) ──────┐ ┌ Cost by Purpose (Card) ───────┐ │
│         │  │ bar chart, $/day, mono axis    │ │ horizontal bars per purpose   │ │
│         │  └────────────────────────────────┘ └───────────────────────────────┘ │
│         │                                                                       │
│         │ ROW D — Purpose breakdown (Card > DataTable)                          │
│         │   Operation | Calls | Cost | Avg Cost/Call            (mono numerics) │
│         │                                                                       │
│         │ ROW E — Model breakdown (Card > DataTable)  [NEW — byModel]           │
│         │   Model | Calls | Input tok | Output tok | Cost                       │
│         │                                                                       │
│         │ ROW F — Daily breakdown (Card > DataTable, paginated 25/pg)           │
│         │   Date | Calls | Input Tokens | Output Tokens | Cost                  │
│         │                                                                       │
│         │ ROW G — Failed Grading Attempts (Card > DataTable, collapsed if 0)    │
│         │   ⚠ Submission | Question | Step | Error | Attempts | Last Attempt    │
│         └──────────────────────────────────────────────────────────────────── │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Grid & responsive:**

- **lg (≥1024):** ROW A is a 4-col grid (`gap-4`/16); ROW C is 2-col; tables
  full width. Page gutter 32.
- **md (768–1023):** ROW A → 2×2 grid; ROW C → stacked (Card per row); tables
  keep columns, horizontal scroll on overflow (`overflow-x-auto`). Gutter 24.
- **sm (<768):** single column throughout; KPI cards stack 1-up; **DataTables
  collapse to stacked definition rows** per the foundation cross-platform rule
  (table on web → stacked cards), with the Cost figure as the primary line;
  month picker wraps under the title; gutter 16. Touch targets ≥44px.

---

## 4. Components used (FOUNDATION §5 only)

- **AppShell** (Sidebar + Topbar) — container chrome.
- **Section** — page header row (title + subtitle + actions cluster).
- **InlineAlert/Banner** — the QuotaWarningBanner (amber `status.warning` / red
  `status.error` / expired `status.error`); also the in-page
  over-/approaching-quota notice.
- **Stat/KPI** — ROW A four metric cards. Figures in **Spline Sans Mono**
  (foundation §3 mono for numerics).
- **Card** — budget panel and each chart/table container (radius lg,
  `bg.surface`, elevation `e1`).
- **ProgressBar** — budget usage bar.
- **Badge** / **Chip/Tag** (pill) — budget status pill ("On track" /
  "Approaching" / "Over budget"), purpose labels, model-name tags.
- **DataTable** (sort/paginate) — Purpose breakdown, Model breakdown, Daily
  breakdown (25/pg via **Pagination**), Failed Grading Attempts.
- **DefinitionList** — sm-breakpoint stacked rendering of the daily/purpose
  tables.
- **Button** — month picker prev/next (`secondary`/ghost IconButton), "Export"
  (`secondary`), "Go to Settings" link-button (`ghost`).
- **IconButton** — month nav chevrons, banner dismiss (×).
- **Skeleton** — loading state for KPI strip, charts, tables.
- **EmptyState** — no-usage-this-month.
- **Tooltip** — token-count abbreviations ("42.1M" → exact on hover),
  avg-cost/call definition.
- **Toast (sonner)** — export success / failure feedback.
- **LoadingOverlay** — during PDF export generation.

**Proposed foundation additions (flagged):**

1. **`CostTrendChart`** — a bar chart for `$/day` (and a horizontal bar variant
   for by-purpose). The foundation §5 has **no chart primitive**; the live app
   uses `SimpleBarChart`. _Proposed addition:_ add a minimal **Chart** family
   (BarChart / horizontal BarChart) to §5 Data components, using only existing
   tokens — bars `brand.primary`, axis/grid `border.subtle`, labels
   `text.secondary`, value labels mono. Until adopted, this screen composes
   ProgressBar rows as a fallback bar list. **Do not** introduce new chart
   palette colors; purpose series map deterministically to existing semantic
   hues (`brand.primary`, `status.info`, `status.success`, `spark` reserved last
   — see note).
2. **`listDailyCostSummaries` tenant read endpoint** — API addition
   (specs/common-api.md), not a UI component: a tenant-scoped projection of
   `costSummaries/daily/*` so the client stops reading Firestore directly
   (be-analytics §4 notes no security rule covers these collections today).

> **Spark note:** `spark` (marigold) is reserved for XP/streaks/hero-CTA only
> (foundation §2.2). It is **not** used as a generic chart accent here. A cost
> dashboard is the serious register; the only "hot" color permitted is
> `status.error` for over-budget, used with an icon + label (never color-alone).

---

## 5. States (per role)

**Permission gate:** non-`tenantAdmin` never reaches this route (sidebar entry
hidden + route guard + server rejects the reads). `superAdmin` may view via the
platform-health surface but **not** here — this screen is single-tenant by
construction.

| State                     | Trigger                                                                                     | Presentation                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading**               | `useDailyCostSummaries` / `useTenantSettings` pending                                       | **Skeleton** KPI strip (4 cards), skeleton budget bar, two skeleton chart blocks (height ~220), skeleton table rows. No layout shift on resolve.                                                                                                |
| **Empty**                 | month resolved, `dailyCosts.length === 0`                                                   | **EmptyState** in the trend region: icon, "No AI usage recorded for {month}." Sub: "Costs appear here once AI grading or tutoring runs in this month." KPI strip shows `$0.00 / 0 / 0 / 0`. Budget panel still renders (0% if a budget is set). |
| **Partial**               | usage present but **no budget configured** (`usageQuota.monthlyBudgetUsd` null/0)           | Budget panel renders an **InlineAlert** (info, `status.info`): "No monthly AI budget set. Spend is unlimited and unmonitored." with ghost button → Settings. No ProgressBar, no projection-vs-budget; projection still shown as raw figure.     |
| **Partial**               | budget set but month is **historical** (`monthOffset !== 0`)                                | Projection card hidden (only meaningful for current month). Banner suppressed for past months.                                                                                                                                                  |
| **Error**                 | read failure / permission error / data-integrity (Zod re-validation drift, be-analytics §3) | Card-level **InlineAlert** (`status.error`) replacing the failed region: "Couldn't load AI usage. Retry." + Retry button. Tenant-isolation/permission error → "You don't have access to this tenant's usage." (no data leaked).                 |
| **Success — on track**    | `quotaPercent < warningThresholdPercent`                                                    | Budget bar `status.success`, pill "On track". No banner.                                                                                                                                                                                        |
| **Success — approaching** | `quotaPercent ≥ warningThresholdPercent` (default 80) and `< 100`                           | Banner (amber `status.warning`) + bar amber + pill "Approaching budget".                                                                                                                                                                        |
| **Success — over budget** | `quotaPercent ≥ 100`                                                                        | Banner (red `status.error`): "Monthly AI budget exceeded — AI grading is paused." Bar `status.error`, pill "Over budget". Projection figure red if `projected > budget`.                                                                        |
| **DLQ present**           | `gradingDeadLetter` non-empty                                                               | ROW G renders with a `status.error` skull/warning icon header + count Badge.                                                                                                                                                                    |
| **DLQ empty**             | none                                                                                        | ROW G omitted entirely (no empty shell).                                                                                                                                                                                                        |

---

## 6. Interactions & motion (foundation §4 motion tokens)

- **Month navigation:** prev/next IconButtons step `monthOffset`; next is
  **disabled** at the current month (no future months). On change, regions
  re-fetch → **Skeleton** swap with `fast 160ms` cross-fade (`ease.standard`).
  The month label uses mono. Reduced-motion: instant swap.
- **Banner dismiss:** `×` collapses the in-page banner for the session (height
  collapse `base 220ms`, `ease.exit`). The **global** QuotaWarningBanner
  re-evaluates from server `useQuotaStatus()` on next mount — dismiss is
  client-local and never alters server state.
- **No optimistic updates:** every figure is **server-authoritative**
  (materialized by the `dailyCostAggregation` cron). The UI never computes or
  mutates spend; it only re-aggregates already-stored daily docs client-side for
  display. No inline edit, so no confirmation dialogs on this screen.
- **Go to Settings:** the "set budget" / "increase quota" link routes to
  Settings; no ConfirmDialog here.
- **Export (PDF/CSV):** triggers `v1.analytics.generateReport` (or a CSV
  builder); shows **LoadingOverlay** on the action button, then **Toast**
  success with the signed-URL download (1-hour expiry, be-analytics §1) or a
  `status.error` toast on failure.
- **Table sort:** DataTable column sort animates row reorder subtly
  (`fast 160ms`); default sort: Purpose/ Model by cost desc, Daily by date desc.
- **Chart hover:** tooltip on bar hover (`instant 100ms` fade) showing exact
  `$x.xx` and the date/purpose.
- **Hover→press** parity: on mobile, hover affordances become press; tooltips
  become tap-to-reveal.

---

## 7. Content & copy (precise admin tone)

**Headings & labels**

- h1: **"AI Usage & Cost"** · subtitle: **"AI and LLM consumption and cost for
  {tenant name}, by month."**
- KPI labels: **"Monthly Cost"**, **"Total Calls"**, **"Input Tokens"**,
  **"Output Tokens"**.
- Budget panel: **"Monthly Budget Usage"**; figure `"${spend} / ${budget}"`;
  caption `"{n}% of monthly budget used"`; projection
  `"Month-end projection: ${proj}"`, sub `"Based on ${avg}/day over {n} days"`.
- Status pill: **"On track"** / **"Approaching budget"** / **"Over budget"**.
- Section titles: **"Daily Cost Trend"**, **"Cost by Purpose"**, **"Cost by
  Purpose"** table header **"Purpose breakdown"** (cols: _Purpose · Calls · Cost
  · Avg cost/call_), **"Cost by Model"** (cols: _Model · Calls · Input tokens ·
  Output tokens · Cost_), **"Daily breakdown"** (cols: _Date · Calls · Input
  tokens · Output tokens · Cost_), **"Failed Grading Attempts"**.
- Purpose values are humanized from the raw key (`underscore → space`,
  capitalized): _Extraction, Grading, Evaluation, Tutoring_ (the four canonical
  purposes from the live `PURPOSE_COLORS`).

**Empty state**

- Title: **"No AI usage this month"** · body: **"No AI grading, extraction, or
  tutoring ran in {month}. Costs will appear here once activity is recorded."**

**Partial — no budget**

- **"No monthly AI budget set."** · **"Spend is unlimited and unmonitored. Set a
  budget in Settings to enable quota warnings and projections."** · CTA: **"Set
  budget"**.

**Warnings (must pair icon + text, never color alone)**

- Approaching: **"Approaching monthly AI budget — {n}% used
  (${spend} /
  ${budget})."**
- Over: **"Monthly AI budget exceeded. AI grading is paused. Increase the budget
  in Settings to resume."** Figures: **"${spend} / ${budget}"**.

**Errors**

- Generic: **"Couldn't load AI usage. Retry."**
- Permission/tenant: **"You don't have access to this tenant's usage."**
- Export fail: **"Export failed. Try again."**

**Microcopy:** "Avg cost/call" tooltip — _"Total cost divided by total calls for
this purpose."_ Token abbreviations ("42.1M") carry a tooltip with the exact
integer. Currency always `$` with 2 decimals for totals, 4 decimals for
per-call.

---

## 8. Domain rules surfaced

- **Tenant isolation (hard rule):** every read is scoped to the admin's single
  `tenantId` from claims; the server re-checks membership on `getSummary`/cost
  reads. `tenantAdmin` claims carry **no extra scope** (auth-access §1.3), so
  there is no cross-tenant view and no tenant switcher relevance here. The UI
  never accepts a `tenantId` from the client for these reads — it derives it
  from the session.
- **RBAC:** route + sidebar entry are `tenantAdmin`-only; `superAdmin`
  platform/health cost lives on a separate platform surface
  (`getSummary scope:'health'`), not this screen.
- **Server-authoritative values:** all cost/usage figures are **materialized**
  by the `dailyCostAggregation` scheduler (cron `5 0 * * *`, be-analytics §1)
  into `costSummaries/daily/{date}`. The client only sums and formats; it never
  derives authoritative spend. Per-call and per-token figures come straight from
  `DailyCostSummary` (`totalInputTokens`, `byPurpose`, `byModel`). Re-validate
  with the `DailyCostSummary` schema at the boundary (be-analytics §3 defensive
  Zod pattern).
- **Quota / budget semantics:** budget = `usageQuota.monthlyBudgetUsd` (or
  `subscription.monthlyBudgetUsd`); warning threshold =
  `warningThresholdPercent` (default 80); **100% = AI grading paused**
  (operational consequence, must be stated in copy). Daily call cap =
  `dailyCallLimit` (surface in tooltip/secondary, optional). Budget is **never
  edited inline here** — only in Settings.
- **Audit:** viewing is read-only and needs no audit entry; the budget change it
  links to **is** an audited action in Settings (outside this screen's scope) —
  copy should not imply the admin changes spend here.
- **Known backend caveats to respect:** be-analytics §4 notes budget breach
  currently only `console.warn`s (no `ai_budget_alert` notification yet) and
  `costSummaries` path shape is inconsistent — the UI must tolerate a
  missing/partial month doc gracefully (treat as empty, never error), and the
  QuotaWarningBanner is the user-facing breach signal until the notification is
  wired.
- **Stubbed metrics:** do not present known-stub fields as truth (be-analytics
  §4: `streakDays:0`, `discriminationIndex:0`) — none are shown on this screen,
  and none should be added.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** banner (dismiss + "View usage") → page header (month prev,
  month label, month next, Export) → KPI strip (non-interactive, skipped) →
  budget panel ("Set budget"/Settings link if present) → charts (focusable
  region with text alternative) → each DataTable (column headers as sort
  buttons, then rows) → pagination → DLQ table.
- **Keyboard:** month nav, Export, Settings link, table sort, and pagination are
  all native buttons — Enter/Space activate; next-month button is `disabled`
  (not focusable) at current month. DataTable supports arrow/Home/End within the
  grid per the component spec.
- **ARIA / non-visual:** charts get `role="img"` with a descriptive `aria-label`
  (e.g. _"Bar chart of daily AI cost for {month}, ranging ${min} to ${max}"_)
  **and** the equivalent figures are always available in the Daily breakdown
  table below — chart data is never the only representation. Budget ProgressBar
  uses `role="progressbar"` with `aria-valuenow/min/max` and an accessible label
  including the dollar figures. Status is conveyed by **icon + text label +
  value**, never by bar color alone (foundation §2 rule). The status pill text
  ("Over budget") is the source of truth, color is reinforcement.
- **Contrast:** mono figures use `text.primary` on `bg.surface`; muted secondary
  figures use `text.secondary` (meets 4.5:1). `status.error`/`status.warning`
  banner text/background pairs are the foundation's AA-checked semantic pairs.
  Token abbreviation tooltips give the exact value for users who can't parse
  "42.1M".
- **Reduced motion:** `prefers-reduced-motion` → skeleton/region swaps and chart
  fades become instant; no bar-grow animation on the ProgressBar (jump to final
  width); banner collapse is instant.
- **Screen-reader announcements:** month change announces the new period and a
  loading status (`aria-live` polite); over-budget banner is `role="alert"` so
  it's announced immediately on load.

---

## 10. Web ↔ mobile divergence

**Admin is web-first.** This screen ships on **admin-web** only; there is no
first-class native admin app. Explicit divergences if/when surfaced in a future
RN admin or RoleSwitcher context:

- **⌘K CommandPalette** entry to this screen is **web-only** (foundation §6);
  mobile uses Tabbar/menu nav.
- **DataTables** (purpose, model, daily, DLQ) render as full tables on web; on a
  narrow/native viewport they **collapse to stacked DefinitionList cards** with
  Cost as the lead figure (foundation §6 rule).
- **Charts** are interactive (hover tooltips) on web; on touch they become
  **tap-to-reveal**; the table below remains the canonical data source.
- **Month picker** prev/next chevrons stay; on mobile they wrap below the title
  and grow to ≥44px targets.
- **Export → LoadingOverlay → Toast** pattern is identical across platforms (web
  Toast = sonner; native = ui-native Toast with matching props/name per
  foundation §6 1:1 parity rule).

---

## 11. Claude-design prompt (ready to paste)

```
Design the "AI Usage & Cost (Tenant)" admin screen for Auto-LevelUp, conforming EXACTLY to the
Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md). Serious/precise admin register —
restraint in chrome, NOT the playful student spark register. Do NOT invent colors, fonts, spacing,
radii, shadows, or component variants; compose only from the foundation tokens and §5 component
inventory, and cite tokens by semantic name.

Context: tenantAdmin (single-tenant, server-scoped), route /ai-usage, rendered inside AppShell
(Sidebar + Topbar, single tenant so no tenant switcher). Read-only monitoring of tenant AI/LLM
cost. All figures are server-authoritative, materialized daily by a cron into DailyCostSummary
docs (fields: date, totalCalls, totalInputTokens, totalOutputTokens, totalCostUsd,
byPurpose{calls,inputTokens,outputTokens,costUsd}, byModel{...}, budgetLimitUsd, budgetUsedPercent).
Budget/quota from tenantSettings.usageQuota {monthlyBudgetUsd, dailyCallLimit, warningThresholdPercent}.

Layout (max width 1200, desktop gutter 32):
- Optional QuotaWarningBanner at top (InlineAlert; amber=status.warning approaching, red=status.error
  over-budget; over-budget copy: "Monthly AI budget exceeded. AI grading is paused.").
- Section header: h1 "AI Usage & Cost" (Fraunces) + subtitle (Schibsted Grotesk) + right-aligned
  month picker (prev/next IconButtons, mono "YYYY-MM" label, next disabled at current month) + Export.
- KPI strip: 4 Stat/KPI cards (Monthly Cost, Total Calls, Input Tokens, Output Tokens) — ALL numeric
  values in Spline Sans Mono.
- Budget panel (Card): "Monthly Budget Usage", "$spend / $budget" (mono), ProgressBar
  (status.success on track / status.warning approaching / status.error over), "{n}% of budget used",
  status pill (Badge: On track / Approaching budget / Over budget), and a month-end projection line.
- Two-up (lg) / stacked (sm,md): "Daily Cost Trend" bar chart ($/day) and "Cost by Purpose" horizontal
  bars. Charts get role="img" + aria-label AND a matching data table below (never chart-only).
- DataTables (mono numerics): Purpose breakdown (Purpose/Calls/Cost/Avg cost/call), Cost by Model
  (Model/Calls/Input tok/Output tok/Cost), Daily breakdown (paginated 25/pg), and a conditional
  "Failed Grading Attempts" table with a status.error icon header (omitted entirely if empty).

States: Skeleton loading (no layout shift); EmptyState "No AI usage this month"; partial "No monthly
AI budget set" info alert with a Settings CTA; status.error InlineAlert with Retry on read failure;
permission/tenant-isolation error reveals no data.

Typography: Fraunces (h1), Schibsted Grotesk (UI/body/labels/table), Spline Sans Mono (every figure,
dollar value, token count, date). Radius: cards lg, buttons/inputs md, pills pill. Elevation e1 cards.
Motion (foundation §4): fast/base swaps, ease.standard; respect prefers-reduced-motion (instant).
Spark/marigold is NOT used here (reserved for student gamification).

Accessibility: status conveyed by icon + label + value, never color alone; ProgressBar with
role=progressbar + aria-value*; charts role=img with text alt + table fallback; AA contrast on all
text; over-budget banner role=alert. Web-first (⌘K is web-only; tables collapse to stacked cards on
narrow viewports). Output a single desktop (lg) hero comp plus the budget-over-quota and empty states.
```
