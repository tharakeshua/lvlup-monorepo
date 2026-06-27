# Feature Flags (Per-Tenant Toggles)

> **Screen spec — ADMIN area.** Conforms to the Lyceum design foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All visual values are cited by
> **semantic token name** only (e.g. `bg.canvas`, `bg.surface`, `brand.primary`,
> `status.success`, `status.error`, `text.muted`, `border.subtle`). No new
> colors/fonts/spacing/radii/shadows/motion are invented; any proposed addition
> is flagged inline as a **FOUNDATION ADDITION**. **Register:** serious /
> precision tooling (admin) — restraint in chrome, NOT the playful student
> register.

- **Area / route:** admin · `super-admin` app · `/feature-flags`
- **Role / audience:** `superAdmin` only (cross-tenant platform control-plane
  operation)
- **Source-of-truth code read:**
  `apps/super-admin/src/pages/FeatureFlagsPage.tsx`,
  `apps/super-admin/src/pages/SettingsPage.tsx` (default-flags duplication),
  `apps/super-admin/src/layouts/AppLayout.tsx`,
  `packages/shared-types/src/identity/tenant.ts` (`TenantFeatures`,
  `TenantPlan`)
- **Ground-truth docs:** `status/app-super-admin.md` (§4.3 flag drift; §1.4
  split-brain reads; §5.2 single registry rec), `auth-access.md` (§1.5–1.7
  superAdmin gate, tenant isolation), `be-identity.md` (§1.4 `saveTenant`
  privilege gating of `features`), `specs/common-api.md` (§3.3 identity
  endpoints, §4.4 `tenantOverride`, §6 error model, §7 pagination)

---

## 1. Purpose & primary user

**Primary user:** the **super-admin** — the platform operator running the
multi-tenant control plane. This is the _cross-tenant_ role, distinct from a
tenant-admin who is scoped to one tenant. Identity-wise it is
`isSuperAdmin === true` on `/users/{uid}` **plus** the `role === "superAdmin"`
ID-token claim, both required by the route guard (`auth-access.md` §1.5–1.7;
`app-super-admin.md` §1.3). No other role may reach this screen.

**Job-to-be-done:** _"When a tenant upgrades, churns, or needs a capability
turned on/off, I want to see at a glance which features each tenant has enabled
— and which their plan even permits — and flip a toggle with confidence that the
change is intentional, audited, and reversible, without ever leaking one
tenant's configuration into another's."_

This screen is a **per-tenant feature toggle matrix**: every tenant × every
canonical feature flag. Today the flag catalog is **hardcoded in three divergent
places** — `FeatureFlagsPage.tsx:26-36` (9 flags), `SettingsPage.tsx`
`DEFAULT_FEATURE_FLAGS` (7 flags), and the `TenantFeatures` type
(`tenant.ts:34-44`, 9 fields) — and adding a flag requires editing all three
(`app-super-admin.md` §4.3). **This spec assumes that drift is fixed:** there is
**one canonical flag registry** (`api-contract`, per `app-super-admin.md` §5.2)
defining each flag's `key`, `label`, `description`, `default`, and
**plan-gating** (`minPlan`), consumed identically by this page, by `saveTenant`
seeding, and by every app's `assertFeatureEnabled` gate. The UI **never invents
a flag list** — it renders whatever the registry returns.

The screen is **read-glance + targeted-write**: orient on platform-wide
adoption, then change one tenant's flags deliberately. It is not a bulk-rollout
console (a bulk "enable for all on plan X" action is flagged as a future
addition in §6).

---

## 2. Entry points & route

**Route:** `/feature-flags`, rendered inside `RequireAuth → AppLayout`
(`apps/super-admin/src/App.tsx`). Lazy-loaded with `Suspense` + `PageLoader` and
a per-route `RouteErrorBoundary` (`app-super-admin.md` §1.2).

**Entry points:**

- Sidebar **Platform → Feature Flags** (`AppLayout.tsx` nav group "Platform");
  route prefetch on hover (`usePrefetch` + `SA_PREFETCH_MAP`).
- Breadcrumb: **Platform Control Plane / Feature Flags**.
- From **Tenant Detail** (`/tenants/:tenantId`) — a "Manage feature flags" link
  deep-links here pre-filtered to that tenant (`?tenant=<code>`).
- ⌘K command palette → "Feature Flags" (web only; see §10).

**Reads/writes that power it** — the rebuild moves **all** reads behind the
typed API; **no direct `getDocs(collection(db,"tenants"))` from the browser**
(today's split-brain, `app-super-admin.md` §1.4 / §4.1). Cite
`specs/common-api.md`:

| Need                                                                           | Rebuild callable (`api-contract` registry)                                                           | Notes                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The canonical flag catalog (keys, labels, descriptions, defaults, plan-gating) | `v1.identity.getFeatureFlagRegistry` → `{ flags: FeatureFlagDef[] }`                                 | **Proposed new read endpoint** (see §4). Single source of truth replacing the 3 hardcoded lists. Cacheable (`rateTier: 'read'`, long `staleTime`).                                                                                                                                         |
| Tenants + their current `features` map + `plan` + `status`                     | `v1.identity.listTenants` (paginated, §7 fragment) → `{ items: TenantSummary[], nextCursor, total }` | Server-side projection includes `{ tenantId, name, tenantCode, status, subscription.plan, features }`. Replaces the full-collection client scan. Cursor-based, `limit ≤ 100`.                                                                                                              |
| Persist a tenant's flag changes                                                | `v1.identity.saveTenantFeatures` → `SaveResponse{ id }`                                              | **Proposed**, replacing the generic `callSaveTenant({ features })` (`app-super-admin.md` §5.2). Super-admin only; validates against the registry + plan-gating; writes audit. Today: `callSaveTenant` (`save-tenant.ts` update branch privilege-gates `features` — `be-identity.md` §1.4). |
| (Cross-tenant write) which tenant to write                                     | request carries `tenantOverride` (the only place super-admin may target another tenant)              | `common-api.md` §4.4 — normal callers never send `tenantId`; super-admin cross-tenant ops pass an audited `tenantOverride`.                                                                                                                                                                |

**Server-side adoption rollup (the "Flag Overview" summary):** computed
server-side in `listTenants`/a dedicated `getFeatureFlagAdoption` rather than
counted in-browser (`flagSummary` loop, `FeatureFlagsPage.tsx:147-151`) so it
scales and is reusable by RN. **Proposed:** fold
`adoption: { [flagKey]: { enabled, total } }` into the `listTenants` response
meta, or a thin `v1.identity.getFeatureFlagAdoption`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (`§5 Navigation`): persistent **Sidebar**
(role-driven nav, "Feature Flags" active in the Platform group) + **Topbar**
(tenant-switcher is **hidden/disabled** for super-admin cross-tenant context —
super-admin is not scoped to one tenant; topbar shows platform search,
notifications, profile). Page region is `bg.canvas`; cards are `bg.surface` with
`border.subtle`, radius `lg`, elevation `e1`. Page gutters per foundation
(mobile 16 / tablet 24 / desktop 32), max content width 1200.

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar          │ Topbar: [Platform Control Plane]      [⌘K] [🔔] [super ▾]   │
│  Overview        ├────────────────────────────────────────────────────────────┤
│  Platform        │  Breadcrumb: Platform / Feature Flags                       │
│   • Tenants      │                                                            │
│   • Feature ◀──  │  ┌ PageHeader ─────────────────────────────────────────┐   │
│     Flags        │  │ Feature Flags                                        │   │
│   • Presets      │  │ Per-tenant feature toggles across the platform.      │   │
│   • LLM Usage    │  └──────────────────────────────────────────────────────┘   │
│  System          │                                                            │
│                  │  ┌ Panel · "Flag adoption" ────────────────────────────┐   │
│                  │  │ Grid of flag Stat tiles (lg:3 · md:2 · sm:1):        │   │
│                  │  │ ┌─────────────────┐ ┌─────────────────┐              │   │
│                  │  │ │ AI Grading      │ │ Parent Portal   │  ...         │   │
│                  │  │ │ ProgressBar ▓▓░ │ │ ProgressBar ▓░░ │              │   │
│                  │  │ │ 18/24 · mono    │ │  6/24 · mono    │              │   │
│                  │  │ │ [Premium+] chip │ │ [Basic+] chip   │              │   │
│                  │  │ └─────────────────┘ └─────────────────┘              │   │
│                  │  └──────────────────────────────────────────────────────┘   │
│                  │                                                            │
│                  │  ┌ Toolbar ─────────────────────────────────────────────┐  │
│                  │  │ [🔎 SearchInput: name / code…]   [Plan ▾] [Flag ▾]    │  │
│                  │  │                                  [View: Cards|Grid]   │  │
│                  │  └──────────────────────────────────────────────────────┘  │
│                  │                                                            │
│                  │  ── lg/xl: DENSE MATRIX (DataTable) ───────────────────────│
│                  │  ┌──────────────────────────────────────────────────────┐  │
│                  │  │ Tenant ▾   Plan   │AGrd│LvUp│Scan│Chat│AIGr│Anly│ ...  │  │
│                  │  │ Acme HS    Premium│ ◉  │ ◉  │ ○  │ ◉  │ ◉  │ ◉  │ [Save]│ │
│                  │  │ SUB001            │    │    │ 🔒 │    │    │    │  ●    │  │
│                  │  │ Bright Ac. Basic  │ ◉  │ ◉  │ 🔒 │ ○  │ 🔒 │ ◉  │ [—]   │  │
│                  │  │ …                 │    │    │    │    │    │    │       │  │
│                  │  └──────────────────────────────────────────────────────┘  │
│                  │  [DataTablePagination: ‹ 1 2 3 › · rows/page ▾ · 24 total] │
│                  │                                                            │
│                  │  ── md/sm: STACKED tenant Cards (one card per tenant) ──── │
│                  │  ┌ Card · Acme HS  [Premium] [active] · SUB001 ──────────┐ │
│                  │  │  Flag toggle grid (sm:1 · md:2):                       │ │
│                  │  │  [Switch] AI Grading      [Switch] Parent Portal       │ │
│                  │  │  [Switch] Analytics       [🔒 Scanner — Premium+]      │ │
│                  │  │  ── dirty ──            [Discard]  [Save changes ●]    │ │
│                  │  └────────────────────────────────────────────────────────┘ │
└──────────────────┴────────────────────────────────────────────────────────────┘
```

**Region breakdown**

1. **PageHeader** — title "Feature Flags" + description; no primary CTA in the
   header (writes are per-row/per-card).
2. **Flag adoption Panel** — one Stat tile per _canonical_ flag: label,
   `ProgressBar` (enabled/total), mono `enabled/total` count, and a plan-gating
   **Chip** (e.g. "Premium+"). Adoption is server-computed.
3. **Toolbar** — `SearchInput` (name/code) + filter `Select`s (**Plan**,
   **Flag** = "show tenants where flag X is on/off"). On `lg+`, a **view
   toggle** (Matrix ↔ Cards). `tenantOverride`-only context: this is
   platform-wide, never tenant-scoped.
4. **Matrix / Cards** — responsive (below).
5. **Pagination** — cursor-based `DataTablePagination` (server paging;
   `common-api.md` §7).

**Responsive (mobile-first; admin is desktop-first in practice — §10):**

- **sm (<768):** Toolbar stacks vertically; **stacked tenant Cards**, one flag
  per row (`Switch` + label + plan chip). No matrix. Save/Discard pinned at card
  foot.
- **md (768–1023):** Stacked Cards, flag grid `md:2`. Adoption tiles `md:2`.
- **lg (≥1024):** **DataTable matrix** becomes available and default — tenants
  as rows, flags as columns, `Switch` per cell; sticky first column (Tenant) +
  sticky header row; per-row Save. Adoption tiles `lg:3`. View toggle lets the
  operator drop back to Cards for a focused single-tenant edit.
- **xl (≥1280):** Matrix gains breathing room; column headers show full flag
  labels (md/lg may abbreviate with a `Tooltip`).

---

## 4. Components used — FOUNDATION §5 only

**Navigation:** `AppShell`, `Sidebar` (role-driven), `Topbar`, `Breadcrumb`,
`CommandPalette` (⌘K, web-only). **Containers:** `Panel` (adoption + matrix
wrapper), `Card` (per-tenant stacked view), `Section`, `Tooltip` (abbreviated
flag headers, plan-gating explanation), `Popover` (column header "what is this
flag?"), `ConfirmDialog` (high-impact toggles — see §6). **Primitives:**
`Switch` (the canonical per-flag toggle — replaces today's custom `<button>` +
`ToggleLeft/Right`, `FeatureFlagsPage.tsx:299-321`), `Button` (`primary` Save,
`ghost` Discard), `IconButton`, `Input`/`SearchInput`, `Select` (Plan/Flag
filters, rows-per-page). **Data:** `DataTable` (the lg+ matrix — sort by
tenant/plan, sticky header + first column, row selection reserved for future
bulk), `Stat/KPI` (adoption tiles), `ProgressBar` (adoption ratio), `Pagination`
(`DataTablePagination`, cursor mode), `Badge` (tenant `status`:
active/trial/suspended/expired/deactivated), `Chip/Tag` (plan-gating "Premium+",
"Basic+"), `Skeleton` (loading), `EmptyState`. **Feedback:** `Toast` (sonner —
"Feature flags saved"), `InlineAlert/Banner` (load error, plan-gated-attempt
warning), `ConfirmDialog`, `LoadingOverlay` (per-row save), `FormFieldError`
(n/a but available).

**Domain components:** none of the assessment-specific domain components apply
(no answer keys, grading, XP, etc.). `AnswerKeyLock`’s **lock visual language**
(a `lock` icon + muted state) is the precedent reused for the **plan-gated**
state — see proposal below.

**Proposed FOUNDATION ADDITIONS (flagged):**

- **`FeatureToggleCell`** — a thin composition (not a new primitive): a §5
  `Switch` + an inline `status`/`spark` independent of color (icon + label)
  inside a DataTable cell, with a disabled+`lock` "plan-gated" variant. Built
  only from existing tokens (`status.success` for on, `text.muted` +
  `border.strong` for off, `lock` + `Tooltip` for gated). **No new tokens.**
  Listed here for component-inventory completeness; if the team prefers, this is
  just `DataTable` cell content and needs no inventory entry.
- **`PlanGateChip`** — a `Chip/Tag` (pill radius) preset that renders a flag's
  `minPlan` as "Premium+", "Basic+", etc., using `text.secondary` on
  `bg.surface-sunken`. Pure composition of the existing `Chip` — flagged only
  because its semantics (plan-gating) are domain-specific.

Everything else composes from §5 with **no new colors, fonts, spacing, radii,
shadows, or motion**.

---

## 5. States

| State                               | Treatment                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading**                         | `Skeleton`: adoption tiles → 3 (lg) skeleton tiles; matrix → sticky header skeleton + 5–8 shimmer rows (`fast`→`base` shimmer); stacked cards → 3 `Card` skeletons each with a label bar + 6 toggle-row skeletons (mirrors `FeatureFlagsPage.tsx:220-237`). No content flash.                                                    |
| **Empty — no tenants**              | `EmptyState`: `building` icon in a muted circle, title **"No tenants yet"**, body **"Provision a tenant to manage its feature flags."**, primary `Button` → `/tenants` (create). Distinct from "no search results".                                                                                                              |
| **Empty — no search/filter match**  | `EmptyState`, title **"No tenants match your filters"**, body **"Try a different name, code, plan, or flag filter."**, `ghost` Button **"Clear filters"**.                                                                                                                                                                       |
| **Error — registry load failed**    | Page-level `InlineAlert` (`variant: destructive`, `status.error` + `alert-circle` icon + **text label**, never color-alone): **"Couldn’t load the feature-flag registry."** + **"Retry"** action. Without the registry the matrix cannot render (it is the source of truth) — show the alert in place of the matrix.             |
| **Error — tenant list load failed** | Same `InlineAlert` pattern with **"Retry"** (re-`refetch`), surfaced where the matrix/cards would be. Uses `useApiError` → `error.details.code` → `ERROR_MESSAGES` (`common-api.md` §6.3).                                                                                                                                       |
| **Error — save failed**             | Toast `error` with the server message; the row/card **stays dirty** (changes are not lost), the failed `Switch` rolls back to server truth, and a `FormFieldError`-style inline note appears under the row Save button. `QUOTA_EXCEEDED`/`FEATURE_DISABLED`/`TENANT_SUSPENDED`/`PERMISSION_DENIED` codes get specific copy (§7). |
| **Partial — dirty (unsaved)**       | Row/card gains a left `brand.primary` accent border + a "● Unsaved" `Badge`; Save becomes `primary` enabled, Discard `ghost` appears. Matrix shows a sticky footer count: "3 tenants have unsaved changes". Navigating away triggers an unsaved-changes `ConfirmDialog`.                                                         |
| **Saving**                          | Per-row `LoadingOverlay`/spinner on its Save button (label → "Saving…"), other rows remain interactive (optimistic — §6). Button `disabled` while in-flight.                                                                                                                                                                     |
| **Success**                         | `Toast` success **"Feature flags saved for {tenant}"**; transient inline **"Saved ✓"** (`status.success` + check **icon + label**) for ~2s (matches today's `savedTenants` 2000ms behavior, `FeatureFlagsPage.tsx:98-105`), then row returns to clean state.                                                                     |
| **Plan-gated cell**                 | Toggle is **disabled**, rendered with a `lock` icon + `text.muted` + a `Tooltip`/`PlanGateChip`: "Requires Premium plan. Upgrade {tenant} to enable." Reading is allowed; flipping is blocked client-side AND server-side (§8).                                                                                                  |
| **Suspended/expired tenant row**    | Tenant `Badge` shows `suspended`/`expired`; toggles are **read-only** with a banner reason "Tenant is suspended — reactivate to change features." (server also rejects via `assertTenantAccessible`, `be-identity.md` §1.4).                                                                                                     |

**Permission-gated variations by role:** there is exactly **one** role here —
`superAdmin`. Any non-super-admin who reaches `/feature-flags` is bounced by
`RequireAuth` before render (`auth-access.md` §1.5–1.7). A **tenant-admin**
(scoped to one tenant) has **no entry point** to this screen and no API
authorization for `saveTenantFeatures` (server returns `PERMISSION_DENIED`).
There is no "view-only super-admin" tier today; if one is introduced, the
toggles render `disabled` with a "Read-only" banner — flagged as a future
addition, not built now.

---

## 6. Interactions & motion (§4 tokens)

**Core flow — toggle then save (batched per tenant, matching today’s
pending-changes model `FeatureFlagsPage.tsx:74-137`):**

1. Operator flips a `Switch` in a tenant row/card → **optimistic** local state
   change; the `Switch` thumb animates `fast` (160ms) `ease.standard`; the row
   enters **dirty** state (accent border fades in `base`/220ms, "Unsaved"
   `Badge` `fade-in`).
2. Operator may flip several flags for the same tenant; all accumulate as
   pending until **Save**. (Each tenant batches independently — pending state is
   keyed by tenant.)
3. **Save** → optimistic: button → "Saving…" + spinner; call
   `api.identity.saveTenantFeatures({ tenantOverride: tenantId, features })`. On
   success: `Toast` success, dirty state clears (`fast` exit), transient "Saved
   ✓" for 2s. On error: rollback the changed cells to server truth (`base`
   ease.exit), keep the row dirty, show error toast + inline note.
4. **Discard** → reverts all pending flags for that tenant to server truth
   (`fast`); dirty state clears.

**High-impact confirmation (new vs today’s no-confirm):** toggling a
**destructive-leaning** flag **off** for an active tenant — specifically
`levelUpEnabled`, `autoGradeEnabled`, or `apiAccessEnabled` (capabilities
students/teachers/integrations are actively using) — opens a `ConfirmDialog`:
**"Disable {flag} for {tenant}? Students/teachers will lose access immediately.
This is reversible."** Confirm proceeds; cancel reverts the single toggle.
Turning a flag **on** never confirms. Motion: dialog enters `base`
`ease.entrance`, scrim `fast`.

**Plan-gated attempt:** if a flag's `minPlan` exceeds the tenant's plan, the
`Switch` is already `disabled`; a click on its label surfaces a
`Tooltip`/`Popover` (no state change) — "Requires Premium. [Manage subscription
→]" deep-linking to the tenant's billing (`super-admin-billing.md`). The server
**also** rejects (`FEATURE_DISABLED`/`QUOTA_EXCEEDED`) as the authority (§8).

**Filtering/search:** `SearchInput` debounced; Plan/Flag `Select`s refilter
server-side via `listTenants` params (`base` content cross-fade, respecting
reduced-motion). Result count animates with mono tabular numerals.

**Adoption tiles:** `ProgressBar` fill animates `base` `ease.entrance` on load
only; not re-animated on every keystroke.

**No celebratory motion.** This is the serious register — no spark burst, no
spring pops. `spark` is reserved for student gamification (§2 foundation) and is
**not** used here.

**Future (flagged, not built):** a header **"Bulk apply"** action — "Enable
{flag} for all tenants on {plan}" — gated behind a typed `ConfirmDialog` showing
the affected count, writing one audited batch. Listed in the matrix's reserved
row-selection affordance.

---

## 7. Content & copy (precise admin tone)

- **Page title:** `Feature Flags`
- **Page description:** `Per-tenant feature toggles across the platform.`
- **Breadcrumb:** `Platform / Feature Flags`
- **Adoption panel title:** `Flag adoption`
- **Adoption tile count:** `{enabled}/{total}` (Spline Sans Mono, tabular)
- **Plan chip:** `Premium+` · `Basic+` · `Enterprise` (derived from `minPlan`;
  "+" means "this plan or higher")
- **Search placeholder:** `Search tenants by name or code…`
- **Filter labels:** `Plan` · `Flag` (`Flag` options: "AI Grading: on", "AI
  Grading: off", …)
- **View toggle:** `Matrix` · `Cards`
- **Matrix columns:** `Tenant` · `Plan` · then one column per flag (full `label`
  at xl; abbreviated + `Tooltip` below)
- **Row meta:** tenant name (Schibsted), `tenantCode` (mono, `text.muted`),
  `status` Badge
- **Canonical flag labels & descriptions** (from the single registry — the
  values below mirror `FeatureFlagsPage.tsx:26-36`, the **9-flag superset**, and
  become the one source of truth; `TenantFeatures` keys in `tenant.ts:34-44`):
  - `autoGradeEnabled` → **AutoGrade** — "Automated exam grading system."
  - `levelUpEnabled` → **LevelUp Spaces** — "Interactive learning spaces."
  - `scannerAppEnabled` → **Scanner App** — "Mobile exam scanning."
  - `aiChatEnabled` → **AI Chat Tutor** — "AI-powered student chat tutoring."
  - `aiGradingEnabled` → **AI Grading** — "AI-powered answer evaluation."
  - `analyticsEnabled` → **Analytics** — "Advanced analytics dashboards."
  - `parentPortalEnabled` → **Parent Portal** — "Parent dashboard access."
  - `bulkImportEnabled` → **Bulk Import** — "CSV / Excel bulk data import."
  - `apiAccessEnabled` → **API Access** — "External API access."
- **Toggle state labels (a11y, never color-alone):** on → **"Enabled"**, off →
  **"Disabled"**, gated → **"Locked — requires {Plan}"**.
- **Dirty:** `● Unsaved changes` · Save button `Save changes` (saving →
  `Saving…`) · `Discard`
- **Success toast:** `Feature flags saved for {tenant}.`
- **Inline saved:** `Saved ✓`
- **Disable confirm (ConfirmDialog):** title `Disable {flag} for {tenant}?` ·
  body
  `Students and teachers in this tenant will lose access immediately. You can re-enable it at any time.`
  · confirm `Disable` (danger) · cancel `Keep enabled`
- **Plan-gate tooltip:**
  `Requires the {Plan} plan. Upgrade {tenant} to enable this feature.` + link
  `Manage subscription →`
- **Suspended banner:**
  `{tenant} is suspended. Reactivate the tenant to change its features.`
- **Empty — no tenants:** title `No tenants yet` · body
  `Provision a tenant to manage its feature flags.` · CTA `Go to Tenants`
- **Empty — no match:** title `No tenants match your filters` · body
  `Try a different name, code, plan, or flag filter.` · CTA `Clear filters`
- **Error — registry:** title `Couldn’t load the feature-flag registry` · body
  `The flag catalog is required to render this page.` · action `Retry`
- **Error — tenants:** title `Couldn’t load tenants` · body `{server message}` ·
  action `Retry`
- **Error — save (by code):** `QUOTA_EXCEEDED` → "This tenant's plan doesn't
  include {flag}." · `TENANT_SUSPENDED` → "Tenant is suspended — reactivate to
  change features." · `PERMISSION_DENIED` → "You don't have permission to change
  feature flags." · `RATE_LIMITED` → "Too many changes too fast — try again in a
  moment." · default → "Couldn't save feature flags. Try again."

Tone throughout: factual, terse, reversibility stated explicitly (admin needs to
act without anxiety). No exclamation marks, no encouragement copy.

---

## 8. Domain rules surfaced

- **Tenant isolation is a hard rule.** Each row writes **only** its own tenant
  via the audited `tenantOverride` field — the single sanctioned cross-tenant
  write path for super-admin (`common-api.md` §4.4). One tenant's `features` map
  can never bleed into another's; pending changes are keyed strictly by
  `tenantId`. No request ever batches flags across tenants without an explicit,
  audited multi-write.
- **Super-admin-only, server-authoritative.** Only `isSuperAdmin === true` +
  `role === "superAdmin"` may read or write (`auth-access.md` §1.5–1.7).
  `saveTenant`/`saveTenantFeatures` **privilege-gates `features`** server-side —
  a tenant-admin cannot self-enable a feature (`be-identity.md` §1.4;
  `app-super-admin.md` §3 strength #7). The client toggle is a request, **not**
  the authority.
- **Single canonical flag registry.** The UI renders the registry returned by
  the API — it does **not** hardcode the flag list (fixing `app-super-admin.md`
  §4.3 drift across `FeatureFlagsPage`, `SettingsPage`, `TenantFeatures`).
  Adding/removing a flag is a registry change, surfaced everywhere
  automatically.
- **Plan-gating per flag.** Each flag declares a `minPlan` (`TenantPlan`:
  `free | trial | basic | premium | enterprise`, `tenant.ts:16`). A flag whose
  `minPlan` exceeds the tenant's `subscription.plan` is **locked** in the UI and
  **rejected** server-side (`FEATURE_DISABLED`/`QUOTA_EXCEEDED`). The UI's lock
  is convenience; the server is the gate.
- **Tenant-status gating.** Suspended/expired tenants are read-only here; the
  server's `assertTenantAccessible` (write status set) rejects feature writes
  for non-active tenants (`be-identity.md` §1.4).
- **Audit logging.** Every flag change writes `logTenantAction` (tenant audit) +
  `writePlatformActivity` (platform activity feed) — appears in the tenant's
  audit card and the dashboard activity feed (`app-super-admin.md` §3 strength
  #6, §1.5). The UI states changes are tracked; the spec does **not** expose an
  answer-key, grading, or PII surface (none apply here).
- **Effect propagation (operator must understand):** flipping a flag changes the
  tenant's `features` map immediately; downstream apps honor it via
  `assertFeatureEnabled` on their next call (claims/config are not flag-cached,
  so effect is near-immediate). Disabling an in-use capability
  (`levelUpEnabled`, `apiAccessEnabled`) cuts access immediately — hence the §6
  confirm.
- **Validated both directions.** Request validated server-side; response
  validated client-side in dev against the contract (`common-api.md` §1, §5.2) —
  no `as Tenant` casts (fixes the type-erosion read boundary,
  `app-super-admin.md` §4.13).

---

## 9. Accessibility (WCAG AA)

- **Toggle semantics:** each flag uses a real `Switch` with `role="switch"` +
  `aria-checked`, an accessible name combining flag label + tenant ("AI Grading
  — Acme High School"), and `aria-disabled` + `aria-describedby` (pointing to
  the plan-gate reason) when locked. **Never status-by-color-alone** (foundation
  §2.4): on/off is conveyed by switch position **+** the text label
  ("Enabled"/"Disabled") **+** (locked) a `lock` icon and visible/SR text.
- **Matrix navigation:** the `DataTable` is a proper `<table>` with
  `<th scope="col">` flag headers and `<th scope="row">` tenant names; the
  sticky first column keeps the row label visible. Arrow-key cell navigation
  within the grid; `Space`/`Enter` toggles the focused `Switch`; abbreviated
  column labels have an accessible full name via the header
  `Tooltip`/`aria-label`.
- **Focus order:** Skip-to-content → PageHeader → adoption tiles → Toolbar
  (search → Plan → Flag → view toggle) → matrix/cards (left-to-right,
  top-to-bottom; per-row Save reachable after its row) → pagination. Logical and
  linear in both matrix and stacked-card layouts.
- **Dirty / save feedback:** the "Unsaved" badge and save status are announced
  via an `aria-live="polite"` region ("Acme High School has unsaved changes" /
  "Feature flags saved"). Errors announced `assertive`.
- **Confirm dialog:** `ConfirmDialog` traps focus,
  `aria-labelledby`/`aria-describedby` wired, `Esc` cancels, focus returns to
  the originating `Switch`.
- **Contrast:** all token pairs meet AA — `text.primary` on `bg.surface` (body
  4.5:1), `status.success`/`status.error`/`brand.primary` on surfaces meet 3:1
  for UI/large; the `lock` + muted gated state pairs `text.muted` with an icon
  and text so it is not contrast-only signalling.
- **Touch targets:** every `Switch` ≥44px hit area even when visually compact in
  the matrix (padded cell).
- **Reduced motion:** `prefers-reduced-motion` removes the switch-thumb slide,
  progress-bar fill animation, dirty-border fade, and dialog scale — states
  change instantly; no parallax/none introduced.
- **Keyboard-only:** entire flow (search, filter, toggle, confirm, save,
  discard, paginate) operable without a pointer; ⌘K is an accelerator, not a
  requirement.

---

## 10. Web ↔ mobile divergence

**Admin is primarily web/desktop.** The `super-admin` control plane is a
desktop-first SPA; there is **no React Native super-admin app** and the dense
**matrix view is a desktop (lg+) affordance**. State this explicitly:
feature-flag administration is expected to happen on a large screen.

- **Matrix (DataTable) is lg+ only.** On `sm`/`md` (and on the PWA-installed
  mobile shell, `app-super-admin.md` §1.1) the screen falls back to **stacked
  tenant Cards** with one `Switch` per flag row — the same responsive
  table→cards rule from foundation §6.
- **Hover → press:** column-header `Tooltip`/`Popover` (plan-gate explanation,
  abbreviated label) open on tap on touch devices; no hover-only information.
- **⌘K command palette is web-only** (foundation §5; this screen is reachable
  via the palette on web only). Mobile uses the sidebar/bottom-nav (the
  super-admin mobile bottom-nav carries 4 items; "Feature Flags" is reached via
  the Platform group, not the bottom-nav).
- **Tenant-switcher (topbar):** super-admin operates cross-tenant, so the topbar
  tenant-switcher is **not** used to scope this screen — selection is in-grid.
  (The `RoleSwitcher`/merged-app pattern does not apply; this is a single-role
  web app.)
- **Tokens are shared** (foundation §6): were a future RN admin built, `Switch`,
  `Card`, `Badge`, `Chip` names/props match 1:1 with `shared-ui`; only the
  renderer differs. The matrix would remain web-only by design.

---

## 11. Claude-design prompt (ready-to-paste)

```
You are designing ONE screen for the Auto-LevelUp "super-admin" web app, conforming to the
Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md). Read that foundation and use
ONLY its tokens and §5 component inventory — invent no new colors, fonts, spacing, radii,
shadows, motion, or component variants. Cite tokens by semantic name (bg.canvas, bg.surface,
brand.primary, status.success, status.error, text.muted, border.subtle, spark). Register:
serious / precision tooling for a platform operator — restrained chrome, NO playful student
energy, NO spark burst, NO celebratory motion.

SCREEN: Feature Flags — per-tenant feature toggles. Route /feature-flags. Role: superAdmin ONLY
(cross-tenant control plane). Rendered inside AppShell (Sidebar with "Feature Flags" active in
the Platform group + Topbar; NO tenant-switcher scoping — this screen is platform-wide).

BUILD:
1. PageHeader: "Feature Flags" / "Per-tenant feature toggles across the platform." (no header CTA).
2. "Flag adoption" Panel: one Stat tile per canonical flag — label, ProgressBar (enabled/total),
   mono enabled/total count, and a plan-gating Chip ("Premium+", "Basic+"). Data is server-computed.
3. Toolbar: SearchInput (name/code), Plan Select, Flag Select ("flag X on/off"), and a lg+ view
   toggle Matrix|Cards.
4. lg+ DEFAULT = DataTable MATRIX: tenants as rows, flags as columns, a Switch per cell, sticky
   header + sticky first column, Plan + status Badge per row, a per-row Save button. Below lg =
   stacked tenant Cards (one Switch per flag row, Save/Discard at the card foot).
5. Toggling is OPTIMISTIC and BATCHED per tenant: flipping flags marks the row "dirty" (brand.primary
   accent border + "● Unsaved" badge); Save persists, Discard reverts. Disabling levelUpEnabled,
   autoGradeEnabled, or apiAccessEnabled on an active tenant opens a ConfirmDialog (reversible-but-
   immediate copy). Enabling never confirms.
6. PLAN-GATING: a flag whose minPlan exceeds the tenant's plan is a DISABLED switch with a lock icon +
   muted style + Tooltip "Requires {Plan} plan." Reading allowed; flipping blocked.

CANONICAL FLAGS (single registry — do NOT hardcode a divergent list): AutoGrade, LevelUp Spaces,
Scanner App, AI Chat Tutor, AI Grading, Analytics, Parent Portal, Bulk Import, API Access.

STATES: skeleton (adoption tiles + matrix rows / card stacks), empty-no-tenants vs empty-no-match
(distinct copy), registry-load error (InlineAlert + Retry, matrix hidden), tenant-load error, save
error (toast + row stays dirty + rollback), dirty/unsaved, saving (per-row spinner), success (toast +
transient "Saved ✓"), plan-gated lock, suspended/expired tenant = read-only.

A11Y: real Switch role/aria-checked, accessible name = "flag — tenant", NEVER status-by-color-alone
(position + "Enabled"/"Disabled" text + lock icon for gated), proper <table> th scopes, sticky row
label, arrow-key cell nav, aria-live for dirty/save announcements, focus-trapped ConfirmDialog,
WCAG AA contrast, prefers-reduced-motion removes switch slide / progress fill / dialog scale, ≥44px
targets. ⌘K is web-only; matrix is lg+ only (md/sm = stacked cards).

Use the foundation's motion tokens (fast 160ms switch thumb, base 220ms dirty/dialog,
ease.standard / ease.entrance / ease.exit). Output a single responsive React + Tailwind screen
composed from shared-ui components; no new tokens.
```
