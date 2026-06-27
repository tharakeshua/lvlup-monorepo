# Billing & Subscriptions (Platform) — Super-Admin Screen Spec

> **Design system:** Lyceum. Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. All tokens cited by semantic
> name; no new colors/fonts/spacing/radii/shadows/motion or component variants
> are invented except where explicitly flagged as a **proposed foundation
> addition**. **Register:** the serious/credible admin register — restraint in
> chrome, no playful student energy, no `spark` celebratory motion. **Scope
> honesty (grounded in `status/app-super-admin.md` §4.11):** there is **no real
> invoicing today**. "Billing" = (a) **subscription metadata** management
> against real `TenantSubscription` fields, and (b) **cost observability**
> (LLM/AI spend). Razorpay exists in env but is unused. This spec specs the real
> metadata UI and clearly fences off anything that requires a payment provider
> as **(proposed) payment integration — not built**.

---

## 1. Purpose & primary user

**Primary user:** `superAdmin` — the platform operator running the cross-tenant
control plane.

**Job-to-be-done:** "For a given tenant, let me see and set their commercial
relationship with the platform — what plan they're on, the billing cycle and
current period, whether they're set to cancel, where invoices/receipts should go
(billing email) — and reconcile that against what they actually _cost_ us in AI
spend, so I can decide whether to upgrade, downgrade, extend a trial, set a
budget, or flag overspend."

This is **not** a self-serve customer billing portal (a tenant-admin never sees
this). It is an internal commercial-ops surface. Two halves:

1. **Subscription / plan management** — server-authoritative edits to
   `TenantSubscription` (plan tier, quota caps, billing cycle, period dates,
   `cancelAtPeriodEnd`, billing email, expiry). Privilege-gated to super-admin
   only (`status/app-super-admin.md` §1.5: only super-admin may change
   `status`/`subscription`/`features`).
2. **Cost reconciliation** — per-tenant AI cost for the period (from
   `dailyCostSummaries`) and budget-vs-actual, so plan decisions are informed by
   real spend.

The audience is staff/admin: copy is precise and operational, never encouraging.

---

## 2. Entry points & route

**Routes:**

- Tenant-scoped subscription panel: `/tenants/:tenantId` (the Billing
  tab/section of `TenantDetailPage`). This is where the `TenantSubscriptionCard`
  lives today.
- Cross-tenant cost view: `/llm-usage` (the existing `LLMUsagePage`), which this
  spec treats as the **platform-wide billing/cost ledger** and links
  bidirectionally with the tenant panel.

**Entry points:**

- Sidebar → **Platform → LLM Usage & Costs** (cross-tenant ledger).
- Tenant list (`/tenants`) → row → `/tenants/:tenantId` → **Billing** section.
- Cost ledger row → "View tenant" → `/tenants/:tenantId` Billing section (cost
  row deep-links to the tenant it belongs to).
- ⌘K command palette (web only): "Edit subscription — <tenant>", "Open cost
  ledger".

**Common-API reads/writes** (per `specs/common-api.md` §3.3, §4.4 — super-admin
cross-tenant ops pass an explicit, audited `tenantOverride`; reads go through
the SDK, never direct Firestore):

| Action                                                         | Callable (`api-contract` registry)                                                                                                                                                                                                                 | Notes                                                                                                                                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Load tenant (incl. `subscription`, `status`, `usage`, `stats`) | `v1.identity.getTenant` _(proposed read endpoint — `status/app-super-admin.md` §5.1 calls for moving `getDoc(tenants/{id})` behind a callable)_                                                                                                    | replaces today's direct `getDoc`. Returns the full `Tenant`.                                                                                                                                                        |
| Update subscription                                            | `v1.identity.saveTenant` (`{ tenantOverride: tenantId, data: { subscription: {…} } }`)                                                                                                                                                             | exactly the call `TenantSubscriptionCard` makes today via `callSaveTenant({ id, data: { subscription }})`; server gates `subscription` edits to super-admin and writes `logTenantAction` + `writePlatformActivity`. |
| Platform/per-tenant AI cost for a month                        | `v1.analytics.getSummary` (`{ scope: 'platform', tenantOverride?, month }`) _(server-side aggregation, replacing the in-browser N+1 fan-out flagged in `status/app-super-admin.md` §4.1 and `LLMUsagePage.tsx:82-95`)_                             | returns platform totals, `byPurpose`, `dailyTrend`, and per-tenant rows (`DailyCostSummary` rollups incl. `budgetLimitUsd`, `budgetUsedPercent`).                                                                   |
| Set per-tenant AI budget                                       | `v1.identity.saveTenant` (`{ tenantOverride, data: { subscription                                                                                                                                                                                  | settings budget field } }`) *(budget today lives on `DailyCostSummary.budgetLimitUsd`; a writable budget needs a tenant-level field — see §8 / proposed addition)\*                                                 | flagged: where the budget is authored is a backend decision; UI surfaces it next to cost. |
| Recent billing-related audit entries                           | `v1.analytics.getSummary` (`scope:'platform'`) or `v1.identity.listAnnouncements`-style `listPlatformActivity` filtered to `subscription_updated` _(per `status/app-super-admin.md` §5.4 — needs the `platformActivityLog` composite index added)_ | shows who last changed the plan and when.                                                                                                                                                                           |
| **(Proposed, not built) invoices / payment status**            | —                                                                                                                                                                                                                                                  | no callable exists; Razorpay unused. Rendered as a disabled/"not configured" zone.                                                                                                                                  |

Pagination on the cost ledger uses the unified `PageRequest`/`pageResponse`
fragment (`specs/common-api.md` §7) — opaque `cursor` + `limit`, replacing
today's client-side `usePagination` slicing.

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(role-driven super-admin nav), **Topbar** (tenant switcher / search /
notifications / profile), main content region with **Breadcrumb**. Admin is
desktop-first; max content width 1200, page gutters desktop 32 / tablet 24 /
mobile 16.

### 3A. Tenant Billing section — `/tenants/:tenantId` (lg ≥1024)

```
AppShell
 ├─ Sidebar (Overview · Platform[Tenants*·LLM Usage·…] · System)
 └─ Main
    ├─ Breadcrumb:  Tenants / Acme Coaching / Billing
    ├─ PageHeader region
    │    H1 (Fraunces)  "Acme Coaching"      <Badge status=active>  <Badge plan=premium>
    │    sub (Schibsted, text.secondary)  tenantCode ACME001 (mono) · contactEmail
    │    [ Tabs: Overview · Members · Billing* · Features · Activity ]
    ├─ ── Billing tab content ── 12-col grid, gap 24 ───────────────────────────
    │   ┌─ col-span-7 ───────────────────────┐  ┌─ col-span-5 ──────────────────┐
    │   │ Card: "Subscription"               │  │ Card: "Cost this period"       │
    │   │  [Edit plan ▸] (Button secondary)  │  │  Stat: $cost  (mono, lg)       │
    │   │  DefinitionList (server values):   │  │  Stat: API calls               │
    │   │   Plan ............ Premium        │  │  ProgressBar budget vs limit   │
    │   │   Status .......... Active         │  │   72% of $50.00  (label+icon)  │
    │   │   Billing cycle ... Annual         │  │  [View full ledger ▸]          │
    │   │   Current period .. Jan 1–Dec 31   │  └────────────────────────────────┘
    │   │   Renews/Expires .. Dec 31, 2026   │  ┌─ col-span-5 ──────────────────┐
    │   │   Cancel at end ... No  <Switch ro>│  │ Card: "Quota usage"            │
    │   │   Billing email ... ar@acme.co     │  │  DefinitionList usage/limit:   │
    │   │  ── Quota caps ──                  │  │   Students 142 / 200           │
    │   │   Max students 200 · teachers 20   │  │   Teachers 12 / 20             │
    │   │   Max spaces 30 · exams/mo 50      │  │   Spaces  9 / 30  (ProgressBar)│
    │   └────────────────────────────────────┘  └────────────────────────────────┘
    │   ┌─ col-span-12 ─ InlineAlert (info) ──────────────────────────────────────┐
    │   │ ⓘ Invoicing is not configured. Subscription fields here are metadata     │
    │   │   only; no payments are processed. [Payment integration: proposed]       │
    │   └──────────────────────────────────────────────────────────────────────────┘
    │   ┌─ col-span-12 ─ Card "Recent billing activity" (audit, optional) ────────┐
    │   │ Timeline / compact DataTable: who · changed plan trial→premium · when    │
    │   └──────────────────────────────────────────────────────────────────────────┘
    └─ Edit plan → Modal/Dialog (see §6)
```

### 3B. Platform Cost Ledger — `/llm-usage`

```
 └─ Main
    ├─ PageHeader  H1 "LLM Usage & Costs"  sub "Platform-wide AI spend & per-tenant budgets"
    ├─ Month switcher row:  [‹ IconButton] [ Calendar  June 2026 ] [IconButton ›(disabled@current)]
    ├─ 4× Stat/KPI grid (lg: 4-col · md: 2-col · sm: 1-col):
    │    Monthly Cost $· Total API Calls · Input Tokens · Output Tokens   (values mono)
    ├─ Card "Daily Cost Trend"  — bar chart (recharts), brand.primary bars
    ├─ Card "Cost by Task Type" — ProgressBar list (grading/tutoring/extraction…)
    └─ Card "Per-Tenant Usage" — DataTable
         Tenant | Calls | Cost | Budget | Usage(ProgressBar+%) | [→ tenant]
         sort by Cost desc · cursor Pagination
```

**Responsive:**

- **lg (≥1024):** 3A two-column 7/5 grid as drawn; 3B four-up KPI row + full
  DataTable.
- **md (768–1023):** 3A collapses to single column, cards stack (Subscription →
  Cost → Quota → Alert → Activity); 3B KPIs 2-up; DataTable keeps horizontal
  scroll for numeric columns.
- **sm (<768):** single column throughout; KPIs 1-up; DataTable → **stacked
  SubmissionCard-style rows** (Tenant name + tenantCode, then Cost/Calls/Budget
  as label:value pairs, ProgressBar full-width). Month switcher stays a compact
  3-segment control. (Admin is web-first; this is a graceful narrow-viewport
  fallback, not a primary target — see §10.)

---

## 4. Components used (FOUNDATION §5 only)

**Containers:** AppShell, Sidebar, Topbar, Breadcrumb, Card, Panel, Section,
Tabs, Modal/Dialog, Popover, Tooltip. **Primitives:** Button (`secondary` for
"Edit plan", `ghost` for "View ledger"/links, `primary` for "Save changes" in
dialog, `danger` for the destructive confirm path on
downgrade/cancel-at-period-end), IconButton (month nav), Input (quota numbers,
billing email), Select (plan, billing cycle), DatePicker (expiry / period
dates), Switch (`cancelAtPeriodEnd`). **Data:** DefinitionList (subscription +
quota read view), Stat/KPI (cost cards), DataTable (per-tenant ledger —
sort/paginate), ProgressBar (budget %, quota usage), Timeline (billing
activity), Badge (plan tier, tenant status), Chip/Tag (cycle,
cancel-at-period-end flag), Pagination (cursor), Skeleton, EmptyState.
**Feedback:** Toast (sonner) for save success, InlineAlert/Banner (the
"invoicing not configured" notice; budget-exceeded warning), ConfirmDialog
(downgrade / set cancel-at-period-end), FormFieldError, LoadingOverlay (dialog
submit). **Navigation:** CommandPalette (⌘K, web only).

**Token mapping (cited, not re-pasted):**

- Surfaces `bg.surface` on `bg.canvas`; card radius `lg`; rest elevation `e1`,
  dialog `e3`, popover `e2`.
- Plan/status **Badge**: status uses
  `status.success`/`status.warning`/`status.error`/`text.muted` per
  `TenantStatus` (active/trial → success/info; suspended/expired →
  warning/error; deactivated → muted) — **always icon + label, never color
  alone** (§2 contrast rule).
- Budget ProgressBar: <80% `status.info`/`brand.primary`; ≥80% `status.warning`;
  ≥100% `status.error`. (Replaces the raw `amber-500`/`destructive` Tailwind
  classes in `LLMUsagePage.tsx:437-455` with semantic tokens.)
- Numerics (cost `$`, calls, tokens, quota counts, tenantCode) use **Spline Sans
  Mono**, tabular.
- Headings Fraunces (H1 tenant name, empty-state titles); labels/body Schibsted
  Grotesk.
- No `spark`, no spark-glow shadow, no spring motion anywhere on this screen
  (admin register).

**Proposed foundation additions (flagged):**

1. **`MetadataNotice` is just InlineAlert(`info`)** — no new component; using
   existing variant.
2. **"Payment / Invoices" empty zone** — composed from existing EmptyState + a
   disabled Button; no new component. If a real Razorpay integration is later
   built, an `InvoiceTable` would reuse DataTable (no new primitive expected).
3. No new color/spacing/radii required.

---

## 5. States

**Loading (skeleton):**

- 3A Billing tab: Subscription DefinitionList → 6× Skeleton rows; Cost card →
  Skeleton stat blocks + Skeleton ProgressBar; Quota card → 3× Skeleton rows.
  Match `LLMUsagePage` skeleton pattern (Card-wrapped Skeletons).
- 3B ledger: 4× KPI Skeleton cards + one chart Skeleton (h-[200px]), then a
  DataTable body of Skeleton rows.

**Empty:**

- Subscription with no `subscription` object (legacy tenant): DefinitionList
  renders `—`/"Not set" per field; primary CTA becomes "Set up subscription".
  (Mirror the `?? "--"` / `?? "Unlimited"` / `?? "No expiry"` fallbacks already
  in `TenantSubscriptionCard`.)
- Cost ledger empty: EmptyState — `DollarSign` icon, title "No AI usage this
  month", body "No tenants recorded AI API calls for <Month Year>. Usage appears
  once tenants use AI grading, tutoring, or evaluation." (carried from
  `LLMUsagePage` empty copy).
- No budget set on a tenant row: cell shows muted "No budget" (not `0`).

**Error:**

- Load error: InlineAlert(`destructive`) with `AlertCircle` + "Failed to load
  …" + **Try again** Button(`link`) calling `refetch()` (pattern from
  `LLMUsagePage.tsx:228-239`). Per `specs/common-api.md` §6.3, copy/recovery
  hint comes from `ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS` keyed on
  `error.details.code`; errors never silently render as empty states.
- Save error in dialog: inline `Alert(destructive)` inside the Modal (as today,
  `TenantSubscriptionCard:181-186`), keyed off `details.code`
  (`VALIDATION_ERROR` → field-level `FormFieldError`; `PERMISSION_DENIED` →
  "Only platform admins can change subscriptions"; `TENANT_SUSPENDED` → block +
  explain).

**Partial:**

- Tenant loads but `getSummary` cost call fails: render Subscription/Quota cards
  normally; Cost card shows its own inline error + retry (independent React
  Query keys, no whole-page failure).
- Stale claim / token refresh mid-edit: server returns `PERMISSION_DENIED`;
  surface and prompt re-auth.

**Success:**

- Read view: full DefinitionList + Cost + Quota populated from
  server-authoritative values.
- After save: Toast(success) "Subscription updated", dialog closes, query keys
  `["platform","tenant",tenantId]` + `["platform","tenants"]` invalidated (exact
  invalidation today, `TenantSubscriptionCard:74-79`).

**Permission-gated variations by role:**

- **`superAdmin`:** full read + edit, both halves, cross-tenant. Only role that
  reaches this route (route guard requires `isSuperAdmin` Firestore flag **and**
  `role === 'superAdmin'` claim — `RequireAuth.tsx`).
- **`tenantAdmin` / any tenant role:** **never** see this screen — it is a
  platform control-plane surface. If a tenant-admin ever needs to view their own
  plan, that is a _different, read-only_ screen in the tenant-admin app, out of
  scope here. (Server gates `subscription` edits to super-admin regardless —
  `save-tenant.ts` privilege gating; defense-in-depth even if UI leaked.)

---

## 6. Interactions & motion (motion tokens from §4)

**Edit plan flow:**

1. "Edit plan" (Button `secondary`) opens **Modal/Dialog** (elevation `e3`,
   entrance `fast`/`ease.entrance` scale+fade; reduced-motion → fade only). Form
   pre-filled from current server `subscription` (the `openSubscription` reset
   in `TenantSubscriptionCard:83-97` — plan, quota caps, expiry; **plus**
   billing cycle Select, period-start/end DatePickers, billing-email Input, and
   the `cancelAtPeriodEnd` Switch which today have no UI per
   `status/app-super-admin.md` §4.11).
2. Fields: **Plan** Select (free·trial·basic·premium·enterprise — note: include
   `free`, fixing the enum gap flagged in §4.10 of the status report where the
   form omits it); **Billing cycle** Select (monthly·annual); **Current period
   start / end** DatePicker; **Expiry / renews** DatePicker; **Billing email**
   Input (email-validated); **Cancel at period end** Switch; quota caps **Max
   students/teachers/spaces/exams-per-month** number Inputs (empty = Unlimited,
   placeholder "Leave empty for unlimited").
3. **No optimistic update** for subscription writes — these are commercially
   load-bearing and server-authoritative; show LoadingOverlay/"Saving…" on the
   submit Button (disabled while `isPending`) and only update the read view
   after the server confirms + query invalidation. (Optimistic UI is reserved
   for low-stakes toggles; not here.)
4. **Confirmation (ConfirmDialog)** required for destructive/risky transitions:
   - **Downgrade** to a lower tier whose quota caps are **below current usage**
     → ConfirmDialog: "Acme is using 142/200 students; Basic caps at 50.
     Existing data is retained but new <X> will be blocked. Continue?" (`danger`
     confirm). This surfaces the quota-enforcement domain rule (§8).
   - **Set `cancelAtPeriodEnd` = true** → ConfirmDialog naming the exact
     period-end date.
   - **Set expiry in the past** / status implications → warn.
5. On success: Modal exits (`fast`/`ease.exit`), Toast(success) slides in
   (sonner), DefinitionList values cross-fade to new server values
   (`base`/`ease.standard`).

**Cost ledger:**

- Month nav: `‹`/`›` IconButtons; next disabled at current month (as today).
  Data swap on month change uses `fast` content fade; KPIs re-render without
  layout jump.
- Budget threshold crossing renders a per-row InlineAlert/Badge state change —
  informational, no animation beyond `instant` color token transition; never
  color-alone (icon + "% of budget" label).
- Row "→ tenant" navigates to 3A; page transition `page`/`ease.standard`.

All motion respects `prefers-reduced-motion` (§4): dialogs/fades degrade to
opacity-only or none. No `spark` burst, no spring — this is the serious
register.

---

## 7. Content & copy (precise admin tone)

**Headings:** H1 = tenant name (3A) / "LLM Usage & Costs" (3B). Section titles:
"Subscription", "Cost this period", "Quota usage", "Recent billing activity",
"Per-Tenant Usage", "Daily Cost Trend", "Cost by Task Type".

**Labels (subscription):** Plan · Status · Billing cycle · Current period ·
Renews / Expires · Cancel at period end · Billing email · Max students · Max
teachers · Max spaces · Max exams / month. **Dialog title:** "Edit
subscription". **Submit:** "Save changes" / "Saving…". **Cancel:** "Cancel".

**Metadata notice (InlineAlert info — always shown):** "Invoicing is not
configured. Fields below are subscription metadata only — no payments are
processed and no invoices are generated. Payment integration is proposed, not
yet built."

**Empty-state copy:**

- No subscription: "No subscription set for this tenant." CTA "Set up
  subscription".
- No cost data: "No AI usage this month — No tenants recorded AI API calls for
  <Month Year>." (matches `LLMUsagePage`).
- No budget: "No budget".

**Error copy (keyed to `AppErrorCode`, `specs/common-api.md` §6):**

- Load: "Couldn't load this tenant's billing details." + Try again.
- `PERMISSION_DENIED`: "Only platform administrators can change subscriptions."
- `VALIDATION_ERROR`: field-level, e.g. "Enter a valid billing email." / "Max
  students must be 0 or greater."
- `TENANT_SUSPENDED`: "This tenant is deactivated. Reactivate it before editing
  the subscription."
- `RATE_LIMITED`: "Too many changes — try again shortly."

**Confirm copy:** downgrade warning quotes exact `usage` vs new cap;
cancel-at-period-end quotes the exact `currentPeriodEnd` date. Avoid hedging;
state consequence plainly.

**Tone rules:** declarative, numbers exact (mono, 2-dp for `$`), no exclamation,
no emoji, no "Great job"-style affect. Dates absolute and unambiguous (e.g. "Dec
31, 2026"), with a relative hint in Tooltip if useful.

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** Every read/write is scoped to one tenant.
   Cross-tenant action only via super-admin's explicit, **audited**
   `tenantOverride` (`specs/common-api.md` §4.4). The cost ledger aggregates
   across tenants but each row stays attributed to its tenant; never co-mingle
   tenant data in a single record.
2. **RBAC gating / server-authoritative.** `subscription`, `status`, and
   `features` are super-admin-only edits — enforced server-side in
   `save-tenant.ts` regardless of UI (`status/app-super-admin.md` §1.5, §3.7).
   The UI reflects, never owns, these values; all displayed plan/quota/period
   values come from the server `Tenant.subscription`.
3. **Quota enforcement.**
   `maxStudents`/`maxTeachers`/`maxSpaces`/`maxExamsPerMonth` are caps the rest
   of the platform enforces. Downgrading below current `usage` is allowed (data
   retained) but **blocks new creation** — surfaced in the downgrade
   ConfirmDialog so the operator understands the consequence.
4. **Cost budgets.** Budget vs actual comes from
   `DailyCostSummary.budgetLimitUsd` / `budgetUsedPercent`. ≥80% = warning,
   ≥100% = over-budget — shown with semantic color **plus** icon + "% of budget"
   label (never color alone). _(Flag: today the budget lives per-day on
   `DailyCostSummary`; making it editable here needs a tenant-level budget field
   — proposed backend addition, not a UI invention.)_
5. **Audit logging.** Every subscription change writes `logTenantAction` +
   `writePlatformActivity` server-side (`status/app-super-admin.md` §1.4); the
   "Recent billing activity" Timeline reads `platformActivityLog` filtered to
   subscription events (requires the missing composite index, §5.4).
   Who/what/when must be reconstructable.
6. **No real invoicing (scope fence).** No money moves. Anything implying
   payment (charge, refund, invoice PDF, card on file) is rendered as a disabled
   "not configured" zone, not a live control. Prevents the UI from
   over-promising relative to backend reality (`status/app-super-admin.md`
   §4.11).
7. **Lifecycle coupling.** A `deactivated` tenant's subscription is read-only
   until reactivated (status state machine; `TENANT_SUSPENDED` error). Don't let
   plan edits resurrect a soft-deleted tenant implicitly.
8. **Server-authoritative period/expiry.** Period and expiry dates are stored as
   Firestore timestamps; the UI must coerce safely (the status report §4.8 flags
   fragile `expiresAt.seconds` casts — use the single shared timestamp util, not
   ad-hoc shims).

> Not applicable here but honored platform-wide: answer-key never shown,
> confidence routing, server-authoritative test timer.

---

## 9. Accessibility (WCAG AA)

- **Focus order (3A):** Breadcrumb → Tabs → "Edit plan" Button → DefinitionList
  (static, skippable) → "View full ledger" link → audit Timeline. Dialog traps
  focus; on open, focus first field (Plan Select); on close, return focus to
  "Edit plan".
- **Keyboard:** Tabs are arrow-navigable (Radix Tabs roving tabindex). Dialog:
  `Esc` cancels (with unsaved-change guard if dirty), `Enter` submits from any
  field. Month nav IconButtons are real buttons with
  `aria-label="Previous month"/"Next month"` (as today). DataTable headers
  sortable via Enter/Space, `aria-sort` reflecting state.
- **ARIA:** DefinitionList uses semantic `<dl>/<dt>/<dd>`. Budget/quota
  ProgressBars expose `role="progressbar"` + `aria-valuenow/min/max` +
  `aria-label` ("Budget used: 72% of $50.00"). Status/plan Badges include
  visually-hidden text so screen readers get "Status: active", "Plan: Premium".
  InlineAlert region `role="status"` (info) / `role="alert"` (errors). Dialog
  has labelled title + `aria-describedby` on the metadata-notice.
- **Contrast:** all text/bg pairs meet AA per §2 (body 4.5:1, large/UI 3:1);
  mono numerics on `bg.surface` verified. Budget thresholds use
  `status.warning`/`status.error` tokens chosen for AA.
- **Never status-by-color-alone:** budget %, plan tier, tenant status,
  cancel-at-period-end all pair color with an icon and a text label (e.g.
  over-budget = red bar **+** alert icon **+** "112% of budget").
- **Reduced motion:** `prefers-reduced-motion` removes dialog scale and content
  fades; value changes appear instantly. No motion conveys state.
- **Forms:** each Input/Select labelled; `FormFieldError` linked via
  `aria-describedby`; email field `type="email"` + inline validation; number
  fields `min={0}` with clear "0 or empty = unlimited" hint text.

---

## 10. Web ↔ mobile divergence

**Admin is primarily a web/desktop surface.** The super-admin control plane is a
desktop tool; there is no native super-admin app in scope. Stated explicitly:
this screen targets web at lg/xl.

- **⌘K command palette is web-only** ("Edit subscription — <tenant>", "Open cost
  ledger") — no command palette on mobile (FOUNDATION §6).
- **Responsive fallback (not a separate mobile app):** at sm the two-column
  billing grid **stacks to single column** and the per-tenant cost **DataTable
  becomes stacked cards** (Tenant + tenantCode header, then Cost/Calls/Budget as
  label:value rows, full-width budget ProgressBar) — the standard Lyceum "table
  on web → stacked cards on mobile" rule (§6). Hover affordances (row hover,
  prefetch-on-hover) degrade to press/tap. Month switcher stays a compact
  3-segment control.
- Touch targets ≥44px for IconButtons/Buttons/Switch on narrow viewports.
- All component **names/props are identical** to any future `ui-native`
  equivalents (DefinitionList, Stat, ProgressBar, Badge); only the renderer
  differs — but no RN super-admin build is planned, so this is parity-readiness,
  not a shipped target.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for "Auto-LevelUp", a multi-tenant learning + autograding
platform. Conform EXACTLY to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md
(Modern Scholarly): warm paper neutrals (bg.canvas, bg.surface), deep indigo brand.primary,
marigold "spark" RESERVED for student gamification — DO NOT use spark, spark-glow, or spring
motion here. This is the SERIOUS ADMIN register: restrained chrome, precise tone.
Fonts: Fraunces (display/H1, empty-state titles), Schibsted Grotesk (UI/body/labels),
Spline Sans Mono (all numerics: $cost, calls, tokens, quota counts, tenantCode). Radius: cards lg,
inputs/buttons md, badges pill. Elevation e1 cards / e3 dialog. Motion: fast/base with
ease.standard; respect prefers-reduced-motion. Compose ONLY from the §5 inventory; cite tokens
by semantic name; never invent colors/spacing/variants.

SCREEN: "Billing & Subscriptions (Platform)" for the superAdmin role, inside AppShell
(left Sidebar + Topbar + Breadcrumb). Two surfaces:

(A) Tenant Billing section at /tenants/:tenantId — a "Billing" tab in the tenant detail.
    PageHeader: H1 tenant name + status Badge + plan Badge; sub-line tenantCode (mono) + contactEmail.
    12-col grid (lg). LEFT col-7: Card "Subscription" with secondary "Edit plan" button and a
    semantic <dl> DefinitionList of SERVER-AUTHORITATIVE values: Plan, Status, Billing cycle (monthly/
    annual), Current period (start–end), Renews/Expires, Cancel at period end (read-only Switch),
    Billing email, and quota caps (Max students/teachers/spaces/exams-per-month; empty = "Unlimited").
    RIGHT col-5 stacked: Card "Cost this period" (Stat $cost + API calls + budget ProgressBar
    "72% of $50.00" with icon+label) and Card "Quota usage" (usage/limit DefinitionList + ProgressBars).
    Full-width InlineAlert(info): "Invoicing is not configured — subscription fields are metadata only;
    no payments processed. Payment integration is proposed, not built." Optional Timeline "Recent
    billing activity" (who changed plan, when).
    "Edit plan" opens a Modal/Dialog form: Plan Select (free/trial/basic/premium/enterprise),
    Billing cycle Select, Current period start/end DatePickers, Expiry DatePicker, Billing email Input,
    cancelAtPeriodEnd Switch, quota number Inputs (placeholder "Leave empty for unlimited").
    NO optimistic update — show "Saving…", confirm a downgrade-below-usage or cancel-at-period-end via
    ConfirmDialog (danger) that quotes exact numbers/dates. On success: sonner toast "Subscription updated".

(B) Platform Cost Ledger at /llm-usage: PageHeader + month switcher (‹ / › IconButtons, next disabled
    at current month, centered "June 2026" with calendar icon). 4 Stat/KPI cards (Monthly Cost, Total
    API Calls, Input Tokens, Output Tokens — mono values). Card "Daily Cost Trend" (recharts bars,
    brand.primary). Card "Cost by Task Type" (ProgressBar list). Card "Per-Tenant Usage" DataTable:
    Tenant(name + mono tenantCode) | Calls | Cost | Budget | Usage(ProgressBar + %) | → tenant link;
    sort by Cost desc; cursor Pagination. Budget bar: <80% info, ≥80% warning, ≥100% error — ALWAYS
    icon + "% of budget" label, NEVER color alone.

STATES: skeleton (Card-wrapped Skeletons), empty (DollarSign EmptyState "No AI usage this month"),
error (destructive InlineAlert + "Try again"), partial (cost card fails independently), success.
Only superAdmin reaches this; tenant-admins never see it.

ACCESSIBILITY (WCAG AA): semantic <dl>; ProgressBars with role/aria-valuenow + aria-label; Badges with
visually-hidden "Status: active"/"Plan: Premium"; dialog focus-trap, Esc/Enter, first-field focus;
month IconButtons aria-labelled; DataTable aria-sort; never status-by-color-alone; reduced-motion safe.

RESPONSIVE: lg two-column; md single column stacked; sm DataTable → stacked cards, ⌘K palette web-only.
Output: a single React + Tailwind screen using shared-ui component names (AppShell, Card, DefinitionList,
Stat, DataTable, ProgressBar, Badge, Dialog, Select, DatePicker, Switch, InlineAlert, Toast), tokens via
CSS custom properties from the Lyceum @theme. Admin tone: precise, no emoji, exact numbers.
```
