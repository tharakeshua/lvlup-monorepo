# Platform Overview (Super-Admin Dashboard)

> **Screen spec — ADMIN area.** Conforms to the Lyceum design foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All visual values are cited by
> **semantic token name** only (e.g. `bg.canvas`, `brand.primary`,
> `status.error`, `spark`). No new colors/fonts/spacing/radii/shadows/motion are
> invented; any proposed addition is flagged inline. **Register:** serious /
> precision tooling (admin), not the playful student register — restraint in
> chrome.

- **Area / route:** admin · `super-admin` app · `/`
- **Role / audience:** `superAdmin` only (platform control-plane home)
- **Source-of-truth code read:** `apps/super-admin/src/pages/DashboardPage.tsx`,
  `apps/super-admin/src/layouts/AppLayout.tsx`
- **Ground-truth docs:** `status/app-super-admin.md`, `auth-access.md`,
  `be-identity.md`, `be-analytics.md`, `specs/common-api.md`

---

## 1. Purpose & primary user

**Primary user:** the **super-admin** — platform operator running the
multi-tenant control plane. This is the _cross-tenant_ role (distinct from a
tenant-admin who is scoped to one tenant). Identity-wise it is the
`isSuperAdmin === true` flag on `/users/{uid}` plus the `role === "superAdmin"`
ID-token claim, both required by the route guard (`auth-access.md` §1.5–1.7;
`app-super-admin.md` §1.3).

**Job-to-be-done:** _"When I open the control plane, I want a single,
trustworthy read on the health and shape of the whole platform — how many
tenants and users exist, whether we're growing, how engaged users are, how plans
are distributed, and what just happened across all tenants — so I can decide
where to act (provision, investigate, intervene) within seconds and jump
straight there."_

This is a **read-first, glanceable** screen: KPIs + trends + a recent platform
activity log + fast entry points to the heavy tools (Tenants, System Health,
Settings). It is **not** a tool for editing tenant data inline — all mutation
lives one click away on `/tenants/:tenantId`. The dashboard's job is orientation
and triage, in the credible, restrained admin register.

---

## 2. Entry points & route

**Route:** `/` (the app's index route), rendered inside
`RequireAuth → AppLayout` (`apps/super-admin/src/App.tsx`). It is the post-login
landing page for super-admins and the "Dashboard" / "Home" item in both the
sidebar (Overview group) and the mobile bottom-nav (`AppLayout.tsx:80-84,174`).

**Entry points:**

- Direct post-login redirect (default authenticated landing).
- Sidebar **Overview → Dashboard** (`LayoutDashboard` icon).
- Mobile bottom-nav **Home**.
- Logo / app-name click in the topbar.
- ⌘K command palette → "Go to Dashboard" (web only; see §10).

**Reads/writes that power it (via `specs/common-api.md` — the rebuild moves
_all_ reads behind the typed API; no direct Firestore from the browser, killing
today's split-brain + client-side aggregation):**

| Need                                                                                                        | Rebuild callable (`api-contract` registry)                                                                                                                                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform KPIs (total/active/trial tenants, total users/exams/spaces), growth, engagement, plan distribution | **`v1.analytics.getSummary`** with `scope: 'platform'` (super-admin only)                                                                                                                              | Today this logic is **computed in the browser** in `usePlatformStats()` (`DashboardPage.tsx:56-125`) — fetching the full `tenants` collection and summing `stats.*` client-side, plus a `users where lastLoginAt >= 7d-ago` count. **Domain/perf note:** `app-super-admin.md` §4.1 and `be-analytics.md` §101 flag this client-side aggregation + full-collection scans as the dominant debt; the rebuild **moves aggregation server-side** behind `getSummary` and backs it with precomputed `platformMetrics` rollups / `.count()` aggregates (`be-analytics.md` rec #7, `common-api.md` §3.3 + §5.1) so the dashboard is one cheap read. |
| Recent platform activity log (cross-tenant audit feed, 10 most recent)                                      | **`v1.analytics.getSummary` (`scope:'platform'`)** returning an `activity[]` projection, **or** a dedicated `v1.identity.listPlatformActivity` paginated read (`common-api.md` §7 pagination fragment) | Today: direct `getDocs(platformActivityLog, orderBy(createdAt,'desc'), limit(10))` in `useActivityFeed()` (`DashboardPage.tsx:127-143`). Audit rows are written server-side by every mutating callable via `writePlatformActivity` (`app-super-admin.md` §1.4).                                                                                                                                                                                                                                                                                                                                                                             |
| "Recent Tenants" / "Top tenants by users" lists                                                             | Included in the `getSummary` platform payload (a small `recentTenants[]` + `topTenants[]` projection) **or** `v1.identity.listTenants` (paginated)                                                     | Avoids re-scanning the whole tenants collection just to show 5 rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

**Writes:** none on this screen. The only state-changing actions are
**navigations** (Quick Actions → `/tenants`, `/system`, `/settings`) and
**sign-out** (`logout()` from `useAuthStore`). Provisioning, lifecycle, and
config all happen on their own screens.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(role-driven nav, three groups: Overview / Platform / System) + **Topbar**
(here: theme toggle + — in the rebuild — tenant-context
indicator/search/profile). A **Breadcrumb** ("Dashboard") sits above the page
body; `PageTransition` wraps the outlet (`AppLayout.tsx:180-192`). The dashboard
content is a single vertical stack inside the main content column, max width per
foundation (1200 desktop, 32px gutter; `§4`).

```
┌─ AppShell ──────────────────────────────────────────────────────────────┐
│ Sidebar (lg: fixed 248–272px)        │ Topbar: [theme] [search ⌘K] [me] │
│  Overview ▸ ● Dashboard              ├──────────────────────────────────┤
│  Platform ▸ Tenants · User Analytics │ Breadcrumb: Dashboard            │
│            Feature Flags · Presets    │                                  │
│            LLM Usage · Announcements  │  ┌── PageHeader ───────────────┐ │
│            Users                      │  │ "Platform Overview"  h1     │ │
│  System   ▸ System Health · Settings  │  │ "Signed in as <admin>"      │ │
│  ─────────                            │  │            [Sign out ghost]  │ │
│  footer: <admin email>               │  └─────────────────────────────┘ │
│                                       │                                  │
│                                       │  REGION A — KPI row              │
│                                       │  [Stat][Stat][Stat][Stat]        │
│                                       │  Tenants · Users · Exams · Spaces│
│                                       │                                  │
│                                       │  REGION B — Growth & engagement  │
│                                       │  [KPI New Tenants][Active 7d]    │
│                                       │  [Engagement %]                  │
│                                       │                                  │
│                                       │  REGION C — Charts               │
│                                       │  [Top Tenants bar][Plan donut]   │
│                                       │                                  │
│                                       │  REGION D — Activity & tenants   │
│                                       │  [Recent Activity][Recent Tenants│
│                                       │                       → View all]│
│                                       │                                  │
│                                       │  REGION E — Quick actions        │
│                                       │  [Create Tenant][Health][Settings│
└───────────────────────────────────────────────────────────────────────┘
            (mobile/sm: sidebar collapses → MobileBottomNav: Home·Tenants·Health·Settings)
```

**Regions (top → bottom):**

- **PageHeader** — h1 "Platform Overview", secondary line "Signed in as
  {displayName|email}", trailing **Sign out** (ghost Button).
- **A · KPI row** — 4 `Stat/KPI` cards: Total Tenants (sub: "N active · M
  trial"), Total Users, Total Exams, Total Spaces. Each value is mono numeric
  (`Spline Sans Mono`, §3).
- **B · Growth & engagement** — 3 `Stat/KPI` cards: New Tenants (this month,
  with up/down delta vs last month), Active Users (7d), Engagement Rate
  (active/total %). Delta uses a directional **Badge** (icon + sign + label) —
  never color-only (§9).
- **C · Charts** — 2 Cards: "Top Tenants by Users" (bar) and "Users by Plan"
  (donut). Charts use `brand.primary` + the foundation status hues for series;
  no new chart palette is invented (see §4 proposed-addition note).
- **D · Activity & tenants** — 2 Cards: "Recent Platform Activity"
  (`Timeline`/activity list, 10 rows, cross-tenant) and "Recent Tenants" (5 rows
  → "View all" link to `/tenants`).
- **E · Quick actions** — 3 navigational Cards/Buttons: Create Tenant (→
  `/tenants`), System Health (→ `/system`), Settings (→ `/settings`).

**Responsive grid** (foundation breakpoints `sm 640 · md 768 · lg 1024`):

- **lg (≥1024, primary target):** KPI row = 4-up; Growth = 3-up; Charts = 2-up;
  Activity/Tenants = 2-up; Quick actions = 3-up. Sidebar fixed-open.
- **md (768–1023):** KPI = 2×2; Growth = 3-up (or 2+1); Charts stack to 1-up if
  cramped; Activity/Tenants = 2-up; Quick actions = 3-up. Sidebar collapsible.
- **sm (<768):** everything **single-column stacked** in the same vertical
  order; sidebar hidden behind a trigger, **MobileBottomNav** shown
  (Home/Tenants/Health/Settings, `AppLayout.tsx:173-178`). Charts keep
  `ResponsiveContainer` full-width with reduced height. Touch targets ≥44px
  (§4).

Spacing between regions: `gap` token `6` (24px); within card grids `gap` `4`
(16px). Cards use radius `lg`, elevation `e1` at rest (§4).

---

## 4. Components used (FOUNDATION §5 only)

**Navigation:** `AppShell` (sidebar+topbar) · `Sidebar` (role-driven nav from
the route manifest) · `Topbar` (theme toggle, search, profile; tenant-switcher
slot is **N/A for super-admin** — see §8) · `Breadcrumb` · `Tabbar` (mobile
bottom-nav) · `CommandPalette` (⌘K, web only).

**Data:** `Stat/KPI` (all 7 metric cards) · `Card` (chart, activity, tenant,
quick-action containers) · `Section` (region grouping) · `Timeline` (Recent
Platform Activity feed) · `Badge` (growth delta, plan tag, activity action
category) · `Chip/Tag` (tenant status pills via the status badge pattern) ·
`Avatar` (optional actor avatar in activity rows) · `EmptyState` (empty activity
/ no tenants) · `Skeleton` (loading) · `Pagination` (only if activity list grows
beyond the 10-row glance; default glance has none).

**Primitives / feedback:** `Button` (ghost "Sign out", outline quick-action,
link "View all") · `IconButton` (refresh) · `InlineAlert/Banner` (error state) ·
`Toast` (sonner — background refresh failure) · `LoadingOverlay` (not used;
prefer skeletons) · `Tooltip` (chart hover, abbreviated tenant names).

**Domain components:** none of the assessment/gamification domain components
apply here (this is platform chrome). `AtRiskBadge`/`InsightCard` are explicitly
**not** used — at-risk is a _learner_ concern, not a platform-control-plane
concern.

**Charts:** rendered with the app's existing `recharts` integration
(`DashboardPage.tsx:9-21`) but **styled exclusively from foundation tokens** —
bars/primary series = `brand.primary`; grid/axis = `border.subtle` /
`text.muted`; tooltip surface = `bg.surface` + `border.subtle` + `text.primary`.

> **⚠ Proposed foundation addition (flag):** Foundation §2 defines no
> **multi-series categorical chart palette**. The plan donut needs ≥4
> distinguishable colors. The current code uses ad-hoc `--chart-2..5` HSL
> fallbacks (`DashboardPage.tsx:39-45`) — that is **off-system and must not ship
> as-is**. _Proposal:_ derive a 5-step **`chart.series-1..5`** semantic set from
> existing primitives in a fixed, AA-distinguishable order — `brand.primary`
> (indigo-600), `status.success` (green-600), `spark` (marigold-500),
> `status.info` (sky-600), `status.warning` (amber-600) — and add it to
> Foundation §2 before this screen is built. Pair every series with a legend
> **label** (never color-only, §9).

---

## 5. States

All states render inside the same AppShell/PageHeader frame; only the body
changes.

- **Loading (skeleton):** `Skeleton` placeholders matching the final grid — 4
  KPI cards (label/value/subtext bars), 3 growth cards, 2 chart blocks (header
  bar + chart-area block), and a 5-row activity skeleton (dot + two text lines).
  Mirrors today's `isLoading` branch (`DashboardPage.tsx:251-285`) and the
  activity `feedLoading` branch (`:431-442`). Wrapper carries `role="status"` +
  `aria-label="Loading platform overview"`. No layout shift on resolve (skeleton
  occupies final dimensions).

- **Empty:**
  - _No tenants yet (fresh platform):_ KPI row shows zeros (mono `0`), charts
    and "Recent Tenants" are **replaced by an `EmptyState`** ("No tenants yet" +
    primary "Create your first tenant" CTA → `/tenants`). Charts are not
    rendered against an empty dataset (today they are conditionally hidden when
    `tenants.length === 0`, `DashboardPage.tsx:349`, `:472`).
  - _No recent activity:_ the Recent Activity card shows a quiet inline
    `EmptyState` ("No platform activity in the last 24 hours") rather than an
    empty list.

- **Error:** a top-of-body `InlineAlert/Banner` (variant `error`, `status.error`
  token) with title "Couldn't load platform metrics", the server `message`, and
  a **Try again** action that refetches (mirrors `DashboardPage.tsx:238-249`).
  KPIs render as `—` placeholders, not stale/guessed zeros. Per `common-api.md`
  §6.3, the error comes from the typed envelope (`error.details.code`) and is
  surfaced via the global React-Query error boundary, not silently as an empty
  state.

- **Partial:** the KPI/growth/charts block and the activity feed load
  **independently** (two queries today: `usePlatformStats` + `useActivityFeed`).
  If metrics succeed but activity fails, metrics render normally and only the
  activity card shows a small inline error + retry; the converse holds. Each KPI
  tolerates a missing sub-metric by rendering `—` for that field only (e.g.
  engagement = `—` when `totalUsers` is 0, as today
  `DashboardPage.tsx:338-341`).

- **Success:** full dashboard as in §3, values mono-formatted, deltas with
  directional badge, charts populated, activity feed with 10 rows, recent
  tenants with status pills.

**Permission-gated variations (RBAC):**

- **super-admin (only allowed role):** full screen.
- **tenant-admin / teacher / student / parent / staff:** **never reach this
  route.** `RequireAuth` denies anyone lacking `isSuperAdmin` + the `superAdmin`
  claim (`auth-access.md` §1.5; `app-super-admin.md` §1.3) → redirect to login /
  unauthorized. There is no "degraded" tenant-admin view of this screen; the
  equivalent for a tenant-admin is the _tenant-scoped_ admin dashboard in the
  `admin-web` app, a separate screen. The server `getSummary(scope:'platform')`
  independently re-checks super-admin (defense-in-depth, `be-analytics.md` §16),
  so even a forged client can't read platform aggregates.

---

## 6. Interactions & motion (foundation §4 motion tokens)

- **Page entrance:** route transition via `PageTransition` — content
  fades/translates in over **`page` 420ms / `ease.entrance`**. KPI/chart cards
  may stagger subtly (each `fast` 160ms, `ease.standard`) but **no celebratory
  motion** — this is the serious register; the marigold spring/burst is reserved
  for student gamification only (§4).
- **Skeleton → content:** cross-fade over **`base` 220ms**, no layout jump.
- **Hover/focus on cards & nav:** background/elevation shift `e1 → e2` over
  **`fast` 160ms / `ease.standard`**. Sidebar links **prefetch** their route on
  hover (`usePrefetch` + `SA_PREFETCH_MAP`, `AppLayout.tsx:73`) so navigation
  feels instant.
- **Quick actions / "View all" / Recent-tenant rows:** standard link navigation;
  pressed state `instant` 100ms. No confirmation needed (read-only
  destinations).
- **Refresh:** an `IconButton` (refresh) re-runs both queries; while in flight
  the affected cards show an inline spinner/`aria-busy`, not a full skeleton
  wipe (background refresh keeps last-good values).
- **Optimistic updates:** **none** — this screen has no mutations. (Optimism
  belongs to the screens that write, e.g. tenant create/deactivate.)
- **Confirmations:** only **Sign out** warrants friction; use a lightweight
  `ConfirmDialog` ("Sign out of the control plane?") to prevent accidental loss
  of an admin session, then `logout()`. Navigations are unconfirmed.
- **Feedback on background failure:** if a silent background refetch fails, a
  non-blocking `Toast` (sonner) "Couldn't refresh metrics — showing last known
  values" rather than tearing down the screen.
- **Reduced motion:** all of the above collapse to instant opacity changes when
  `prefers-reduced-motion` is set (§4, §9).

---

## 7. Content & copy (precise admin tone)

**Page header**

- Title (h1, `Fraunces`): **"Platform Overview"** (the current code says "Super
  Admin Dashboard" — rebuild copy is "Platform Overview" to match the route's
  job; subtitle conveys role).
- Subtitle (`text.secondary`): **"Signed in as {displayName | email} · Super
  admin"**
- Action: **"Sign out"**

**KPI row (A)**

- "Total Tenants" — sub: "{active} active · {trial} trial"
- "Total Users" — sub: "Across all tenants"
- "Total Exams" — sub: "Across all tenants"
- "Total Spaces" — sub: "Across all tenants"

**Growth & engagement (B)**

- "New Tenants" — caption: "this month"; delta badge: "▲ 12% vs last month" / "▼
  8% vs last month" (icon + label, never color-only).
- "Active Users (7d)" — caption: "Signed in within the last 7 days"
- "Engagement Rate" — caption: "Active ÷ total users"; value `—` when no users.

**Charts (C)**

- "Top Tenants by Users"
- "Users by Plan" (legend labels capitalize plan names: Free / Starter / Growth
  / Enterprise — exact plan set from `TenantPlan`)

**Activity (D)**

- Card title: **"Recent Platform Activity"**
- Row: "{Action label} — {actor email} — {tenant name}" + relative/short
  timestamp + an action-category `Badge`. Action labels (from `ACTION_LABELS`,
  `DashboardPage.tsx:47-54`): Tenant created · Tenant updated · Tenant
  deactivated · Tenant reactivated · User created · Users bulk imported.
- Empty: **"No platform activity in the last 24 hours."**

**Recent Tenants (D)**

- Card title: **"Recent Tenants"**, trailing link **"View all →"**
- Row: tenant name · "{tenantCode} · {contactEmail}" · "{userCount} users" ·
  status pill ({active|trial|suspended|expired|deactivated}).
- Empty: **"No tenants yet."** + CTA **"Create your first tenant"**.

**Quick actions (E)**

- "Create Tenant" — "Provision a new organization"
- "System Health" — "Monitor platform services"
- "Settings" — "Platform configuration"

**Error copy**

- Banner title: **"Couldn't load platform metrics"**; body: the server `message`
  (falls back to "An unexpected error occurred."); action **"Try again"**.
- Background refresh toast: **"Couldn't refresh metrics — showing last known
  values."**

**Tone rules:** declarative, neutral, factual; no exclamation marks, no emoji,
no encouraging "Welcome back!" warmth (that register is for students). Numbers
are exact and server-authoritative.

---

## 8. Domain rules surfaced

- **Tenant isolation vs. cross-tenant scope (hard rule).** Tenant isolation
  (`tenants/{tenantId}/...` path scoping) is the platform's central invariant
  (`auth-access.md` §1.2, §1.5). The **super-admin is the one deliberate
  exception**: this screen _aggregates across tenants_ and the activity feed is
  _cross-tenant_. That cross-tenant read is a **privileged operation** — it must
  be authorized server-side (`getSummary(scope:'platform')` is
  super-admin-gated, `be-analytics.md` §16), never assembled by trusting the
  client. A tenant-admin must **never** see another tenant's data; this screen
  does not exist for them.
- **RBAC gating, defense-in-depth.** Access requires `isSuperAdmin === true`
  **and** the `superAdmin` ID-token claim **and** Firebase auth
  (`auth-access.md` §1.5–1.7). The route guard is UX-only; the real gate is the
  callable's own super-admin assertion. The rebuild proposes promoting
  super-admin to a **claim** (`auth-access.md` rec #2) so this check avoids a
  per-eval `get()`.
- **Server-authoritative values (perf + correctness).** Every number on this
  screen (counts, growth %, engagement %, plan distribution) must be **computed
  and validated on the server**, not in the browser. The current client-side
  aggregation in `usePlatformStats()` (full `tenants` scan + in-browser sums +
  `users` 7-day query, `DashboardPage.tsx:56-125`) is the explicit anti-pattern
  flagged by `app-super-admin.md` §4.1 and `be-analytics.md` §101 (≤6 unbounded
  count queries). The rebuild moves it behind `getSummary`/precomputed
  `platformMetrics` rollups (`be-analytics.md` rec #7) — closing the N+1 /
  full-scan scaling wall and giving a single contract reusable by future RN
  clients (`common-api.md` §3.3).
- **Audit logging is the data source for the activity feed.** The feed renders
  `platformActivityLog` entries written by every mutating callable
  (`writePlatformActivity`/`logTenantAction`, `app-super-admin.md` §1.4). The
  dashboard is a **read** of that immutable audit trail; it must not be editable
  and must show the real `actorEmail`. (Note: `platformActivityLog` composite
  indexes are missing today, `app-super-admin.md` §4.6 — they must be wired into
  `firestore.indexes.json` before the filtered-by-tenant variant of this query
  ships.)
- **No answer keys / no assessment content.** This is a platform-metrics screen;
  it never surfaces exam content, answer keys, or per-student submissions. The
  answer-key-never-exposed rule isn't triggered here, but the screen must not
  become a backdoor to drill into tenant-private content — drill-down stops at
  the tenant boundary (`/tenants/:id`, itself super-admin-scoped).
- **Quota / cost budgets:** the dashboard _links to_ but does not enforce
  billing. Cost/budget enforcement lives on `/llm-usage`
  (`DailyCostSummary.budgetLimitUsd`). The overview may surface a single derived
  **platform cost / budget** KPI **only if** it comes pre-aggregated from the
  server (otherwise omit, to avoid resurrecting the N+1 cost fan-out,
  `app-super-admin.md` §4.1).
- **Soft lifecycle visibility:** tenant status pills must reflect the full
  `TenantStatus` set including `deactivated` (soft-delete is the platform's
  deletion model, `app-super-admin.md` §1.5/§3.5); the UI must not imply hard
  deletion.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Skip-to-content link → main content → PageHeader (Sign out) →
  KPI cards (if interactive, else skipped) → growth cards → chart cards → Recent
  Activity (rows non-interactive unless linked) → Recent Tenants rows (links, in
  DOM order) → "View all" → Quick action links. Sidebar/topbar are reachable but
  the page provides `SkipToContent` (`AppLayout.tsx:182`) to bypass nav.
- **Keyboard:** every interactive element (Sign out, refresh, "View all",
  recent-tenant rows, quick actions, sidebar links, ⌘K) is tab-reachable and
  Enter/Space-activatable. ⌘K opens the command palette (web). Focus ring uses
  the foundation **focus ring** token (`0 0 0 3px indigo @35%`, §4) — visible on
  all controls.
- **ARIA / semantics:** main region `id="main-content"` with a `RouteAnnouncer`
  announcing "Dashboard" on navigation (`AppLayout.tsx:184`). Loading wrapper
  `role="status"` + `aria-label`. KPI cards expose label + value to SRs as an
  accessible name (e.g. "Total Tenants, 42, 38 active, 4 trial"). Charts have a
  text alternative: each chart card includes a visually-hidden summary or an
  adjacent data table toggle (recharts SVG alone is not sufficient) — **the
  donut and bar must not be the only way to obtain the data**. Activity rows use
  a list structure (`<ul>/<li>` or `role="list"`).
- **Status never by color alone (§2.4):** growth deltas pair the color with a
  ▲/▼ icon **and** "vs last month" text; tenant status pills pair color with the
  status word; chart series are paired with legend labels. A red engagement
  number is never the only signal.
- **Contrast:** all text/bg pairs meet AA (4.5:1 body, 3:1 large/UI) via the
  foundation semantic tokens; mono KPI numbers on `bg.surface` use
  `text.primary`. Chart axis/legend text uses `text.secondary`/`text.muted`
  which remain AA on surface.
- **Reduced motion:** `prefers-reduced-motion` disables
  entrance/stagger/cross-fade and any chart animation; content appears
  immediately (§4).
- **Targets:** all tappable elements ≥44px on mobile (§4).

---

## 10. Web ↔ mobile divergence

**Admin is primarily web/desktop.** The super-admin control plane is a desktop
SPA + PWA (`app-super-admin.md` §1.1); the dense KPI-grid-plus-charts layout is
tuned for ≥1024px. There is **no native mobile super-admin app** — the
foundation's `RoleSwitcher` (merged mobile student/teacher apps) does **not**
apply to super-admin.

Responsive (within web) behavior:

- **Desktop/lg:** fixed-open sidebar, 4-up KPIs, 2-up charts/cards, ⌘K command
  palette available.
- **Tablet/md:** collapsible sidebar, 2×2 KPIs, charts may stack.
- **Phone/sm (PWA in a mobile browser):** single-column stack in the §3 order;
  sidebar replaced by **MobileBottomNav** (Home · Tenants · Health · Settings,
  `AppLayout.tsx:173-178`); charts shrink height but stay full-width via
  `ResponsiveContainer`; "Recent Tenants" / "Recent Activity" rows become
  full-width stacked cards; hover-prefetch degrades to tap. **⌘K command palette
  is web-only** and is hidden on touch; the bottom-nav is the navigation
  affordance there.
- **Tenant-switcher:** the topbar tenant-switcher slot is **empty/disabled for
  super-admin** — super-admin is not "inside" a single tenant; it operates the
  control plane across all of them. (Tenant-scoped switching is a
  tenant-admin/teacher concern.)

No React-Native parity is required for this screen. If/when an admin RN
companion is ever built, it would consume the **same**
`getSummary(scope:'platform')` contract (the API is RN-ready, `common-api.md`
§3.3), and the table-→-stacked-card rule (foundation §6) would apply to the
tenant/activity lists.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp "Lyceum" design system. Read and conform
EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, spacing,
radii, shadows, motion, or component variants — compose ONLY from the foundation tokens
(cite them by semantic name: bg.canvas, bg.surface, text.primary/secondary/muted, brand.primary,
spark, status.success/warning/error/info, border.subtle/strong, focus ring) and the §5 component
inventory. If something is genuinely missing, flag it as a proposed foundation addition (do not
silently invent it).

SCREEN: "Platform Overview" — the super-admin (platform control-plane) dashboard at route "/".
AUDIENCE: superAdmin only. REGISTER: serious, precise, credible admin tooling — restraint in
chrome, NO playful/gamified motion (no marigold spring/burst; that is reserved for students).
Typography: Fraunces for h1/empty-state titles, Schibsted Grotesk for UI/labels, Spline Sans Mono
for all numeric KPI values and timestamps.

LAYOUT (inside AppShell = left Sidebar [Overview/Platform/System groups] + Topbar [theme,
search ⌘K, profile] + Breadcrumb "Dashboard"; main content max-width 1200, 32px gutter):
A vertical stack —
  • PageHeader: h1 "Platform Overview", subtitle "Signed in as {admin} · Super admin",
    trailing ghost "Sign out".
  • Region A — 4 Stat/KPI cards: Total Tenants (sub "N active · M trial"), Total Users,
    Total Exams, Total Spaces.
  • Region B — 3 Stat/KPI cards: New Tenants (this month + ▲/▼ delta badge with icon+label,
    NEVER color-only), Active Users (7d), Engagement Rate (active/total %).
  • Region C — 2 chart Cards: "Top Tenants by Users" (bar) and "Users by Plan" (donut). Use
    brand.primary + status hues for series; pair every series with a legend label. (NOTE: the
    foundation has no multi-series chart palette — propose a chart.series-1..5 set derived from
    brand.primary, status.success, spark, status.info, status.warning, and flag it.)
  • Region D — 2 Cards: "Recent Platform Activity" (cross-tenant audit Timeline, 10 rows:
    action label — actor email — tenant — short timestamp + category Badge) and "Recent Tenants"
    (5 rows: name · code · email · user count · status pill {active|trial|suspended|expired|
    deactivated}; trailing "View all →").
  • Region E — 3 navigational Quick-action cards: Create Tenant, System Health, Settings.

GRID: lg = KPI 4-up / Growth 3-up / Charts 2-up / Activity+Tenants 2-up / Actions 3-up.
md = KPI 2×2, charts may stack. sm = single-column stack in the same order; sidebar → MobileBottomNav
(Home·Tenants·Health·Settings); ⌘K is web-only/hidden on touch.

STATES: skeleton (mirrors final grid, role="status"); empty (no tenants → EmptyState "No tenants yet"
+ "Create your first tenant"; no activity → "No platform activity in the last 24 hours"); error
(InlineAlert "Couldn't load platform metrics" + Try again, KPIs render as —); partial (metrics and
activity load independently — one can fail while the other shows). Success = full dashboard.

DOMAIN RULES TO HONOR: super-admin is the ONLY cross-tenant role (tenant isolation is otherwise a
hard rule); all KPI/growth/engagement/plan numbers are SERVER-AUTHORITATIVE (computed by
analytics getSummary(scope:'platform'), NOT in the browser — no full-tenants-collection scan, no
client aggregation); the activity feed is a read of the immutable platformActivityLog audit trail;
no answer keys or assessment content ever appear here; tenant deletion is soft (show "deactivated"
status, never imply hard delete). No mutations on this screen except Sign out (ConfirmDialog).

A11Y (WCAG AA): skip-to-content; logical focus order; full keyboard; charts have a text/data
alternative (SVG alone insufficient); status NEVER by color alone (icon+label on deltas, status
pills, chart legends); foundation focus ring on every control; respect prefers-reduced-motion
(disable entrance/stagger/chart animation). Motion: entrance = page 420ms ease.entrance,
hover = fast 160ms ease.standard, skeleton→content = base 220ms — and nothing celebratory.

Output: a single responsive React + Tailwind screen composed from the shared-ui components
(AppShell, Sidebar, Topbar, Breadcrumb, Stat/KPI, Card, Section, Timeline, Badge, EmptyState,
Skeleton, Button, InlineAlert, Tooltip), reading data via the typed api-client hook
useSummary({ scope: 'platform' }) — never firebase/firestore directly.
```
