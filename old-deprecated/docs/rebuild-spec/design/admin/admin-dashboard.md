# Admin Dashboard (Tenant Home / Overview)

> Per-screen design spec. Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md` ("Lyceum"). All tokens are cited
> by semantic name — no hex is re-pasted. This is **admin tooling**: the
> serious, precise register (restraint in chrome), NOT the playful student
> register.

- **Area:** admin
- **Route:** `/`
- **Role / audience:** `tenantAdmin` (single-tenant scope). `superAdmin` may
  view it while impersonating/operating inside one tenant, but cross-tenant
  control lives in super-admin, not here.
- **Live code this replaces:** `apps/admin-web/src/pages/DashboardPage.tsx`,
  `components/dashboard/QuotaUsageCard.tsx`,
  `components/skeletons/DashboardSkeleton.tsx`, shell `layouts/AppLayout.tsx`.

---

## 1. Purpose & primary user

**Primary user:** the tenant (academy / school) administrator — `tenantAdmin`.

**Job-to-be-done:** _"In ten seconds, tell me whether my academy is healthy
today, and let me jump to whatever needs my attention."_ The dashboard is the
orientation surface and the launch pad for the whole console. It answers four
questions at a glance:

1. **Scale** — how many students, teachers, classes, spaces, exams do I have?
   (counts / KPIs)
2. **Risk** — is anything off? (at-risk students, quota near limit, AI budget,
   onboarding incomplete, suspended tenant)
3. **Performance** — how are classes doing? (avg exam score per class,
   engagement)
4. **Spend & limits** — what is AI costing me today, and where am I against my
   plan's quotas?

It is **read-only / navigational** — the dashboard itself performs no
destructive mutations. Every card is an entry point that deep-links into
Management / Analytics / Configuration. The only write that can originate here
is _mark notification read_ (via the topbar bell) and _dismiss_ of the
quota/onboarding banners (client-local preference, not a server write).

---

## 2. Entry points & route

**Route:** `/` (index route inside `AppLayout`, guarded by
`RequireAuth allowedRoles={["tenantAdmin"]}` + the
`tenantId === currentTenantId` assertion, and by `OnboardingGuard` which
redirects to `/onboarding` when `tenant.onboarding.completed !== true` — see
§8).

**Entry points:**

- Default landing after tenant login / tenant switch (`switchActiveTenant` →
  token refresh → land on `/`).
- "Dashboard" item in the **Overview** sidebar nav group; "Home" in the mobile
  bottom nav.
- Logo / breadcrumb root click.

**Reads that power it** — all via `packages/shared-hooks` →
`packages/api-client` (no direct `firebase/firestore`; this is the rebuild seam
from `specs/common-api.md` §2/§8). `tenantId` is derived server-side from
`ctx.activeTenantId`, not passed in the body (`common-api.md` §4.4):

| Region                                              | Hook (rebuild)                                                          | Callable (`common-api.md` §3.3)                             | Notes                                                                                                                                                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Tenant header, plan, status, features, quota maxes  | `useTenant()` (live tenant doc subscription via `useTenantStore`)       | reads `/tenants/{tenantId}` (subscription); identity module | `tenant.stats`, `tenant.subscription`, `tenant.usage`, `tenant.features`, `tenant.branding`, `tenant.onboarding`, `tenant.status`                                                                                                 |
| KPI counts (students/teachers/classes/spaces/exams) | `useGetSummary({ scope: 'class' })` aggregate + `tenant.stats` fallback | `v1.analytics.getSummary` (`scope:'class'`)                 | Prefer server-authoritative `tenant.stats.*`; live list counts only when cheaper than a count()                                                                                                                                   |
| Class performance chart + at-risk count             | `useGetSummary({ scope: 'class' })`                                     | `v1.analytics.getSummary` (`scope:'class'`)                 | Returns `ClassProgressSummary[]`: `className`, `autograde.averageClassScore`, `atRiskCount`. Server-aggregated (kills the per-class N+1 the legacy `useClassSummaries` fan-out caused — `be-analytics.md` §"Precompute-on-write") |
| AI cost (today's spend / calls)                     | `useDailyCostSummaries({ start: today, end: today })`                   | analytics read endpoint over `costSummaries/daily/{date}`   | `DailyCostSummary.totalCostUsd`, `.totalCalls`. Written by `dailyCostAggregation` cron (`be-analytics.md`)                                                                                                                        |
| Quota usage vs plan                                 | `useTenant()` (`tenant.usage.*` + `tenant.subscription.max*`)           | `/tenants/{tenantId}`                                       | Server-authoritative; client never recomputes the maxes                                                                                                                                                                           |
| Notification badge (topbar bell)                    | `useNotifications`, `useUnreadCount`, `useMarkRead`, `useMarkAllRead`   | `v1.identity.manageNotifications` (`action:'list'           | 'markRead'`)                                                                                                                                                                                                                      | Lives in `AppLayout`, not the page body |

**Writes from this screen:** only `manageNotifications(action:'markRead')` via
the bell. Banner dismissals are client-local. All deep-link CTAs navigate; they
do not mutate.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar** (4 nav
groups), **Topbar** (breadcrumb + right cluster: ThemeToggle, NotificationBell),
and the scrollable main region. Page gutters per foundation §4 (mobile 16 /
tablet 24 / desktop 32); max content width 1200.

```
┌───────────── AppShell ─────────────────────────────────────────────────────┐
│ Sidebar (lg: 260px fixed │ Topbar: [Breadcrumb: Dashboard]      [☼] [🔔3]    │
│  collapsible)            ├──────────────────────────────────────────────────┤
│  ── Overview             │ QuotaWarningBanner  (only if any quota ≥ 90% or   │
│    • Dashboard  ◀active   │   AI budget ≥ 80% or tenant suspended)  [InlineAlert]
│  ── Management           │ OnboardingBanner (only if onboarding incomplete)  │
│    • Users               │                                                   │
│    • Classes             │  ┌ Page header ───────────────────────────────┐  │
│    • Exams               │  │ h1 "Dashboard"   ·  "{Tenant name} · {plan}"│  │
│    • Spaces              │  │ subhead "Welcome back, {name}"  [tenant badge]│ │
│    • Courses             │  └─────────────────────────────────────────────┘  │
│    • Staff & Permissions │                                                   │
│    • Announcements       │  ┌ KPI ROW — Stat/KPI cards ────────────────────┐ │
│  ── Analytics            │  │ [Students][Teachers][Classes][Spaces][Exams] │ │
│    • Analytics           │  │ [At-Risk]   (each → deep link)               │ │
│    • Reports             │  └──────────────────────────────────────────────┘ │
│    • AI Usage            │                                                   │
│  ── Configuration        │  ┌ Class Performance ───────┐ ┌ AI Cost ───────┐ │
│    • Academic Sessions   │  │ Section + bar chart      │ │ Stat: $ today  │ │
│    • Data Export         │  │ (avg exam score / class) │ │ Stat: calls    │ │
│    • Settings            │  │ empty-state if no data   │ ├────────────────┤ │
│  ───────────────────────  │  └──────────────────────────┘ │ Tenant Info    │ │
│  [RoleSwitcher ▼]        │                               │ (DefinitionList)│ │
│  [Avatar ▾ profile menu] │  ┌ Subscription Usage (Panel) ─────────────────┐ │
│                          │  │ header: title · [plan Badge] · "View details"│ │
│                          │  │ 5× QuotaUsageCard (ProgressBar + value/max)  │ │
│                          │  │ footer: "Subscription expires {date}"        │ │
│                          │  └──────────────────────────────────────────────┘ │
│                          │  ┌ Features (Panel) ───────────────────────────┐ │
│                          │  │ grid of feature chips (on/off, dot+label)    │ │
│                          │  └──────────────────────────────────────────────┘ │
└──────────────────────────┴──────────────────────────────────────────────────┘
            (Mobile: sidebar → Drawer/Sheet via "More"; MobileBottomNav: Home·Users·Classes·Analytics·More)
```

**Responsive grid (foundation §4 breakpoints):**

- **KPI row** — `grid` with `gap` 4 (16px): `sm` 2 cols → `md` 3 cols → `lg` 6
  cols (one row of six). Mirrors the live
  `grid-cols-2 md:grid-cols-3 lg:grid-cols-6`.
- **Mid section** — single column on `sm`/`md`; **2 columns on `lg`** (left =
  Class Performance, right = AI Cost stacked over Tenant Info), `gap` 6 (24px).
- **Subscription Usage** — QuotaUsageCard grid: `sm` 1 → `md`/`lg` up to 3 →
  `xl` 5 across.
- **Features** — `sm` 2 cols → `md` 4 cols.
- **`< md`:** sidebar collapses to the Drawer/Sheet opened from the
  **MobileBottomNav** "More" button (web-responsive only — see §10). Topbar
  keeps bell + theme toggle; RoleSwitcher moves into the sheet footer.

All regions are vertically stacked with `gap` 6 (24px) (`space-y-6` in live
code).

---

## 4. Components used (FOUNDATION §5 only)

**Containers:** `AppShell` (sidebar + topbar), `Sidebar` (role-driven nav from
the route manifest — the 4 nav groups), `Topbar` (breadcrumb, notifications;
**no tenant _search_ and no global ⌘K on this screen by default**), `Card`
(radius `lg`, elevation `e1`), `Panel` (Subscription Usage, Features), `Section`
(Class Performance, AI Cost headers).

**Data / display:**

- `Stat/KPI` — the six KPI cards (label, value in **Spline Sans Mono** numeric,
  lucide icon, optional `trend`/`trendValue` for At-Risk). Replaces the live
  `ScoreCard`.
- `ProgressBar` — inside each QuotaUsageCard (the quota fill). _(See proposed
  addition below re: QuotaUsageCard.)_
- `DefinitionList` — Tenant Info (Tenant Code / Plan / Status / Contact). Tenant
  Code rendered in **mono**.
- `Badge` — plan badge (`variant` neutral/outline), tenant `status` badge.
- `Chip/Tag` — feature on/off pills in the Features panel (dot + label).
- `EmptyState` — Class Performance with no data.
- `Skeleton` — loading state (see §5).
- `Avatar` / `AvatarGroup` — profile in sidebar footer.

**Feedback / nav:**

- `InlineAlert/Banner` — **QuotaWarningBanner** (quota ≥ 90% / AI budget ≥ 80% /
  tenant suspended) and **Onboarding-incomplete banner**, both `status.warning`
  (suspended = `status.error`).
- `NotificationBell` (Topbar), `RoleSwitcher` (sidebar footer), `ThemeToggle`
  (Topbar), `MobileBottomNav` (mobile), `Breadcrumb`.
- `Button` (`secondary`/`ghost` for "View details" / "Complete Setup"),
  `IconButton`.
- `Toast` (sonner) — only for the bell's mark-all-read confirmation and any
  read-error.

**A bar chart is required for Class Performance.** The foundation §5 inventory
has no chart primitive.

> **Proposed foundation additions (flag, do not invent silently):**
>
> 1. **`MiniBarChart`** (the live `SimpleBarChart`) — a small
>    horizontal/vertical categorical bar chart for dashboard summaries. Should
>    consume semantic tokens only: bars `brand.primary`, gridlines
>    `border.subtle`, labels `text.secondary`, axis numerics **Spline Sans
>    Mono**. Needs `role="img"` + `aria-label` + an accessible data-table
>    fallback (§9). Recommend adding to §5 "Data" as a charting primitive shared
>    with Analytics/AI-Usage.
> 2. **`QuotaMeter`** (the live `QuotaUsageCard`) — a labeled usage meter =
>    `ProgressBar` + `{current}/{max}` value + threshold coloring. Threshold
>    colors MUST map to semantic tokens, NOT raw `red-500`/`amber-500`:
>    `> 0.9 → status.error`, `0.7–0.9 → status.warning`,
>    `≤ 0.7 → brand.primary`, `unlimited → brand.primary @ low opacity` +
>    "Unlimited" label. The legacy component hardcodes
>    `bg-red-500/bg-amber-500/bg-primary`; the rebuild must token these.
>    Recommend `QuotaMeter` enter §5 "Data".

Everything else composes from existing primitives — no other new components.

---

## 5. States

**Loading (skeleton)** — `DashboardSkeleton` (the live one, retokenized):
page-header `Skeleton` (title + subhead), a 6-up KPI `Skeleton` grid
(`lg:grid-cols-6`), then the 2-col mid block (one tall left skeleton + two
stacked right skeletons). Skeleton fill uses `bg.inset`; shimmer respects
`prefers-reduced-motion` (no shimmer → static `bg.inset`). The shell
(sidebar/topbar) renders immediately; only the page body shows skeletons.
Because reads are independent hooks, **render regions progressively** — show
each card's own skeleton until its query resolves rather than blocking the whole
page (see Partial).

**Empty** — a brand-new academy just past onboarding:

- KPI counts show real zeros (e.g. `0` students) — never blank.
- Class Performance shows an `EmptyState`: chart-bar icon, _"No performance data
  yet"_ + helper _"Class averages appear after the first exam is graded."_ with
  a `secondary` Button → `/classes` ("Add a class") or `/exams`.
- AI Cost shows `$0.00` / `0` calls (zero is a valid value, not empty).
- Subscription Usage renders with `0 / max` meters.

**Error** — per-region, not a whole-page crash. A failed query renders an
`InlineAlert` (`status.error`) inside that card: _"Couldn't load {region}."_ + a
`ghost` **Retry** Button (re-runs the query). The KPI row degrades gracefully:
any individual count that errors falls back to `tenant.stats.*`
(server-authoritative) and, failing that, an em-dash `—` with the error state
announced (never a misleading `0`). A global React Query error boundary
(`common-api.md` §6.3) catches non-recoverable errors; transient ones surface as
the inline retry, not an empty state.

**Partial** — the common case. The tenant doc (header, plan, quotas, features)
arrives first via the live subscription; the analytics summary (chart + at-risk)
and cost summary arrive later. Each region shows its own skeleton then content
independently. At-Risk KPI shows a small inline spinner in the value slot until
`getSummary` resolves, then the count. Quota maxes present but `usage.*` missing
→ meter shows `current` over `— ` and a muted "usage syncing" caption rather
than a wrong ratio.

**Success** — all regions populated as in §3.

**Permission-gated variations by role:**

- **`tenantAdmin` (full):** all regions, all deep links, all nav groups. This is
  the canonical view.
- **`staff` (delegated admin):** if the rebuild enforces `StaffPermissions` in
  the shell (`app-admin-web.md` rec #9), the dashboard hides or disables regions
  the staff member can't act on:
  - No `canViewBilling`/billing perm → **Subscription Usage** and the **AI
    Cost** card are hidden (or shown read-only with a "Limited access" caption);
    the QuotaWarningBanner's _budget_ variant is suppressed; nav "AI
    Usage"/"Settings" hidden.
  - No `canManageUsers` → KPI cards still display counts (read-only metrics) but
    their deep links route to read-only list views; "Add a class" CTA hidden.
  - Drive visibility off a single `useCan(permission)` hook; never render a
    control the role can't use.
- **`superAdmin` operating inside a tenant:** sees the full `tenantAdmin` view;
  the `OnboardingGuard` is bypassed for super-admin (live behavior);
  cross-tenant data is never shown here (that's the super-admin app).
- **Suspended/deactivated tenant** (`tenant.status` ∉ `['active','trial']`): top
  **QuotaWarningBanner** switches to `status.error` ("This academy is suspended
  — contact platform support"); KPIs remain visible (read-only); deep links to
  mutating pages may be gated downstream.

---

## 6. Interactions & motion (foundation §4 motion tokens)

**Page entry:** `PageTransition` on `location.pathname` — fade/slide-up over
`page 420ms` with `ease.entrance`. Region cards stagger in subtly (each
`fast 160ms`, `ease.standard`, ~40ms stagger) — restrained, not bouncy.
Reduced-motion → instant opacity only.

**KPI / card hover:** cards that are links lift from `e1` → `e2` and border goes
`border.subtle` → `border.strong` over `fast 160ms` `ease.standard`; cursor
pointer; entire card is the hit target. **Hover also prefetches** the
destination lazy chunk (the `ADMIN_PREFETCH_MAP` / `usePrefetch` pattern) for
near-instant navigation.

**Deep-link click:** standard route navigation; the destination shows its own
skeleton. No optimistic mutation here (dashboard is read-only).

**Quota meter fill:** width animates from 0 → `percentage` over `base 220ms`
`ease.standard` on first paint. Crossing a threshold (≤0.7 → 0.7–0.9 → >0.9)
changes the bar color token with a `fast 160ms` cross-fade. **No celebratory
motion** — this is admin chrome; the single spark/spring celebratory moment is
reserved for the _student_ register (foundation §4) and never appears in admin.

**Banners:** QuotaWarningBanner / Onboarding banner enter with a height+opacity
reveal over `base 220ms` `ease.entrance`; dismiss (if dismissible) collapses
over `fast 160ms` `ease.exit`. Dismiss is client-local for the session; a
server-side `quotaExceeded` truth re-shows it next load.

**Notification bell:** opening the popover = `fast 160ms` scale/opacity (`e2`).
Clicking an unread item optimistically marks it read (badge decrements
immediately), fires `manageNotifications(markRead)`; on failure, the badge
reverts and a `status.error` Toast appears. "Mark all read" → optimistic clear +
Toast confirm.

**Tenant switch (RoleSwitcher):** selecting another tenant calls
`switchActiveTenant` → forces ID-token refresh → the live tenant subscription
resets → dashboard re-renders for the new tenant (full skeleton during the
swap). A `LoadingOverlay` may cover the body during the token refresh.

**Refresh-on-focus:** TanStack Query refetches stale summaries on window
refocus; updates fade in (no layout jump — reserve space with min-heights).

---

## 7. Content & copy (precise admin tone)

Tone: factual, restrained, second-person where it aids action. No exclamation
marks, no student-style encouragement.

- **h1:** `Dashboard` (Fraunces display). _(Live uses "School Admin Dashboard" —
  shorten; the breadcrumb already says Dashboard and the context line names the
  tenant.)_
- **Context subhead:** `Welcome back, {displayName | email}` · separate muted
  line: `{Tenant name} · {Plan} · {Status}`.
- **KPI labels (exact):** `Students` · `Teachers` · `Classes` · `Spaces` ·
  `Exams` · `At-Risk Students`.
  - At-Risk `trendValue`: `Needs attention` (when `> 0`, `trend: "down"`, paired
    with a warning icon) / `All clear` (when `0`, `trend: "neutral"`). Never
    color-only — always icon + label (§9).
- **Class Performance:** section title `Class Performance` · caption
  `Average exam score by class`. Empty: title `No performance data yet`, body
  `Class averages appear after the first exam is graded.`, CTA `Add a class`.
- **AI Cost:** section title `AI Cost` · stat labels `Today's spend` ($, 2dp,
  mono) and `Today's calls` (integer, mono). Footer link `View AI usage →` →
  `/ai-usage`.
- **Tenant Info (DefinitionList):** `Tenant code` (mono) · `Plan` (capitalized)
  · `Status` (Badge) · `Contact` (email). Missing values render `—`.
- **Subscription Usage:** title `Subscription usage` · plan `Badge` · link
  `View details →` → `/settings`. Meter labels: `Students` · `Teachers` ·
  `Spaces` · `Exams / month` · `AI calls / month`. Footer:
  `Subscription expires {localized date}`. Unlimited meter caption: `Unlimited`.
- **Features:** title `Features`. Each chip: humanized flag name (e.g.
  `Auto grade`, `AI chat`, `Parent portal`); disabled chip appends ` (off)` and
  uses the muted dot.
- **Onboarding banner:** title `Complete your academy setup` · body
  `Finish the setup wizard to unlock all features.` · CTA `Complete setup →` →
  `/onboarding`.
- **QuotaWarningBanner copy:**
  - Near-limit:
    `You're approaching your {plan} plan limit for {resource} ({current}/{max}). Upgrade or archive to free up space.`
    CTA `Review plan →`.
  - At-limit:
    `You've reached your {resource} limit. New {resource} can't be added until you upgrade or archive.`
  - AI budget:
    `AI spend is at {pct}% of this month's budget (${spend}/${budget}).` CTA
    `View AI usage →`.
  - Suspended (error):
    `This academy is suspended. Contact platform support to restore access.`
- **Error copy (per region):** `Couldn't load {region}.` + `Retry`. (e.g.
  _Couldn't load class performance._) Avoid blame; offer the action.

---

## 8. Domain rules surfaced

- **Tenant isolation (hard rule).** Every read is scoped to the caller's active
  tenant; `tenantId` is derived server-side from `ctx.activeTenantId` (claims),
  never trusted from the client body (`common-api.md` §4.4; `auth-access.md`
  §1.3–1.5). The dashboard can show **only this one tenant's** data. Switching
  tenants requires `switchActiveTenant` + token refresh; the live tenant
  subscription resets cleanly. No cross-tenant aggregation here — that is
  super-admin's control plane.
- **RBAC gating.** Route is guarded to `tenantAdmin` (+
  `tenantId === currentTenantId` assertion); `superAdmin` may operate inside.
  Within the page, `StaffPermissions`/`TenantFeatures` gate region visibility
  via `useCan` (§5). Real enforcement is server-side (rules + callable asserts,
  `auth-access.md` §1.5–1.6); the UI gating is UX only and must never be the
  sole gate.
- **Server-authoritative values.** Counts, quota `usage.*`, plan `max*`, AI cost
  totals, class averages, at-risk counts are **all computed server-side**
  (analytics triggers + `dailyCostAggregation` cron, precompute-on-write,
  `be-analytics.md`). The client never derives a quota ratio's _max_, never sums
  cost client-side, never recomputes at-risk. It only renders. `tenant.stats.*`
  are the authoritative fallback for KPI counts.
- **Quota enforcement.** Quotas are enforced at write time on the backend
  (`assertQuota`, `common-api.md` §9); the dashboard only _visualizes_ proximity
  to limits and warns. Hitting a limit here changes copy/color, not the ability
  to bypass — the server rejects over-limit writes regardless of UI.
- **AI cost budgets.** Today's spend/calls are read-only projections of
  `costSummaries`. The 80%/100% monthly-budget thresholds
  (`subscription.monthlyBudgetUsd`) drive the AI-budget banner. The dashboard
  surfaces the signal; budget _caps_ are configured in Settings/AI-Usage.
- **Onboarding gate.** `OnboardingGuard` redirects incomplete tenants to
  `/onboarding`; if reached with `onboarding.completed !== true` (e.g.
  super-admin bypass), the onboarding banner shows.
- **Answer-key invariant.** Not directly rendered here, but reinforced: the
  dashboard reads only summaries/metrics — no exam answer keys, no submission
  contents. Answer keys are Admin-SDK-only and never reach any client
  (`auth-access.md` §1.5).
- **Audit / no destructive actions.** The dashboard performs no mutating action
  beyond marking notifications read. Any future action originating here must go
  through a callable that writes the tenant audit log (`common-api.md` §9).
  Banner dismissal is local and unaudited (no server state changes).

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Skip-to-content link (already in shell) → topbar (theme
  toggle, notification bell) → any active banner (and its CTA) → page `h1` → KPI
  cards in DOM order → Class Performance (+ its CTA) → AI Cost / Tenant Info
  links → Subscription Usage ("View details") → Features. Sidebar nav is a
  separate landmark reachable via skip-nav.
- **Landmarks / headings:** main region is `<main id="main-content">`; one `h1`
  ("Dashboard"); each section uses `h2`/`h3` in order (no skipped levels).
  Sidebar = `<nav aria-label="Primary">`; topbar = `<header>`.
- **Keyboard:** every KPI card is a single focusable link (`Enter`/`Space`
  activates); visible focus ring = `border.focus` (the 3px indigo @35% ring,
  foundation §4). The whole card is the target — no nested duplicate tab stops.
  RoleSwitcher and bell are fully keyboard-operable (arrow keys in menus, `Esc`
  closes).
- **Chart accessibility:** the bar chart carries `role="img"` + a descriptive
  `aria-label` (e.g. _"Bar chart: average exam score by class. Highest: Grade
  8A, 82%. Lowest: Grade 6C, 41%."_) AND an associated visually-hidden `<table>`
  of the same class/score pairs as the canonical accessible representation.
  Quota meters expose `role="progressbar"` with `aria-valuenow/min/max` and an
  `aria-label` like _"Students quota: 142 of 200 used."_
- **Never status-by-color-alone (foundation §2.4/§8).** At-Risk uses icon +
  "Needs attention" text, not just a red trend. Quota thresholds pair color with
  the `{current}/{max}` numeric and (at danger) the word "limit". Feature on/off
  pairs the dot with explicit "(off)" text. Tenant status uses a Badge with a
  label, not a bare colored dot.
- **Contrast:** all text/bg pairs meet AA (4.5:1 body, 3:1 large/UI) —
  guaranteed by composing only semantic tokens. Mono numerics on `bg.surface`
  and muted captions on cards verified against `text.secondary`/`text.muted`.
  Quota threshold colors used for _fill_, not for small text; the textual value
  uses `text.primary`/`text.secondary`.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables skeleton
  shimmer, card-stagger, quota-fill animation, and page transition (instant
  opacity); content is never conveyed by motion.
- **Live regions:** `RouteAnnouncer` announces "Dashboard" on entry.
  Notification badge count uses `aria-live="polite"` so screen readers hear
  new-count changes. Per-region async loads announce "Loading class performance"
  → "Class performance loaded" politely.

---

## 10. Web↔mobile divergence

**This is a desktop-first web admin tool.** The optimal experience is a wide
viewport with the persistent sidebar; there is **no dedicated React Native admin
app** in scope (the RN apps are learner + scanner only — `common-api.md` §1).
Admin "mobile" means the **responsive web** layout, not a native build.

- **Sidebar → Sheet:** at `< md`, the 4-group `Sidebar` collapses behind the
  **MobileBottomNav** "More" button, opening a `Drawer/Sheet`. RoleSwitcher +
  profile menu move into the sheet footer.
- **MobileBottomNav** (web responsive):
  `Home · Users · Classes · Analytics · More` — a 5-item bar with ≥44px touch
  targets (foundation §4).
- **Grids stack:** KPI 6-up → 2-up; the 2-col mid block → single column; quota
  meters → 1-up. Cards become full-width with `gap` 4.
- **Hover → no hover on touch:** card lift/prefetch-on-hover are pointer-only;
  on touch, prefetch triggers on `touchstart`/intent and the lift is omitted;
  tap navigates directly.
- **⌘K command palette is web-only** and is **not part of this screen's default
  chrome** (the topbar here exposes bell + theme toggle, not global search). If
  a command palette is later added to the admin shell, it is
  desktop/keyboard-only and must not be relied on for any mobile-reachable
  action — foundation §6 / §5 mark CommandPalette as web-only.
- **Charts:** the MiniBarChart remains horizontally scrollable or switches to a
  compact list on narrow viewports; the accessible table fallback (§9) is
  identical across widths.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for "Auto-LevelUp", using our design system "Lyceum".
FIRST read and conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT
invent colors, fonts, spacing, radii, shadows, motion, or component variants — compose
ONLY from Lyceum tokens (cite semantic names like brand.primary, bg.surface, spark,
status.error, text.secondary) and the §5 component inventory. Tone = PRECISE / CREDIBLE
admin tooling (the serious register, restraint in chrome) — NOT the playful student
register; no celebratory motion, no spark accents except sparingly on a single primary CTA.

SCREEN: Admin Dashboard (Tenant Home / Overview). Route "/". Role: tenantAdmin
(single-tenant scope; multi-tenant isolation is a hard rule — show ONE tenant only).

Render inside AppShell: left Sidebar with 4 nav groups (Overview / Management / Analytics /
Configuration), Topbar with breadcrumb + ThemeToggle + NotificationBell. Above the page
body, conditionally render a QuotaWarningBanner (status.warning; status.error if the tenant
is suspended) and an Onboarding-incomplete banner.

PAGE BODY (vertical stack, gap-24px, max-width 1200, foundation gutters):
1. Page header: Fraunces h1 "Dashboard"; muted line "Welcome back, {name}" and
   "{Tenant name} · {Plan} · {Status}".
2. KPI row of six Stat/KPI cards (label + mono numeric value + lucide icon), each a deep
   link: Students, Teachers, Classes, Spaces, Exams, At-Risk Students. At-Risk shows a
   trend chip "Needs attention" (warning icon+label, never color-only) or "All clear".
   Grid: sm 2-col → md 3-col → lg 6-col. Cards lift e1→e2 on hover (pointer only).
3. Two-column block (single col below lg): LEFT = "Class Performance" Section with a
   small categorical bar chart "Average exam score by class" (role=img + aria-label +
   hidden data table; bars use brand.primary; EmptyState if no data). RIGHT = stacked
   "AI Cost" card (Today's spend $0.00 mono, Today's calls mono) over a Tenant Info
   DefinitionList (Tenant code [mono], Plan, Status [Badge], Contact).
4. "Subscription usage" Panel: header title + plan Badge + "View details →"; a grid of 5
   QuotaMeter cards (label + ProgressBar + "{current}/{max}", thresholds mapped to tokens:
   >90% status.error, 70–90% status.warning, ≤70% brand.primary, unlimited = brand.primary
   low-opacity + "Unlimited"); footer "Subscription expires {date}".
5. "Features" Panel: grid of on/off chips (dot + humanized label; "(off)" suffix when off).

STATES: skeleton (DashboardSkeleton: header + 6 KPI + 2-col), per-region loading/partial
(render progressively), per-region inline error (status.error InlineAlert + Retry, never a
misleading 0 or empty state), empty (zeros are valid; chart EmptyState only). Staff-role
variant hides billing/AI-cost/quota regions via useCan(). Suspended tenant → error banner.

DOMAIN RULES (must hold): tenant isolation (server-derived tenantId, one tenant only);
all counts/quotas/cost/averages are SERVER-AUTHORITATIVE — render only, never recompute;
quota enforcement is server-side (UI only warns); no answer keys / no destructive actions
here (read-only + mark-notification-read). RBAC: route gated to tenantAdmin.

MOTION (foundation §4): PageTransition page-420ms ease.entrance; card hover fast-160ms
ease.standard + route prefetch on hover; quota fill base-220ms; NO celebratory motion.
Respect prefers-reduced-motion (disable shimmer/stagger/fills).

A11Y (WCAG AA): logical focus order (skip-link → topbar → banner → h1 → KPIs → sections),
each KPI a single focusable link with the border.focus ring, chart + meters have ARIA +
table fallback, never status-by-color-alone, polite live regions for async + badge count.

WEB↔MOBILE: desktop-first web admin (no native admin app). Below md, sidebar → Sheet via
MobileBottomNav "More"; grids stack (6→2→1); hover effects are pointer-only; ⌘K is web-only
and NOT part of this screen's chrome.

Output: a responsive React + Tailwind implementation using ONLY shared-ui components and
Lyceum semantic tokens (no raw hex). Flag any needed new component (e.g. MiniBarChart,
QuotaMeter) as a proposed foundation addition rather than inventing ad-hoc styles.
```
