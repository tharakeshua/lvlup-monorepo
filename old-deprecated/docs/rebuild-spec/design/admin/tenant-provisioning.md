# Tenant Provisioning — Tenants List + Create

> **Area:** Admin (super-admin control plane) · **Route:** `/tenants` ·
> **Audience:** `superAdmin` Conforms to **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). Tokens are cited by semantic
> name only; no hex is re-pasted. Register: the **serious /
> precision-instrument** end of Lyceum (restraint in chrome, no gamification
> spark, no student warmth).

---

## 1. Purpose & primary user

**Primary user:** Platform **super-admin** (the only role that can reach this
screen). Identity is the `isSuperAdmin === true` flag on `/users/{uid}` plus the
verified custom-claim path — there is no `tenantId` scope on this user; they
operate **cross-tenant** on the platform control plane.

**Job-to-be-done:** "Show me every organization on the platform, let me find one
fast, and let me **provision a new tenant** (organization) — give it a name, a
unique tenant code, a starting plan, and a first admin contact — without leaving
this screen." Secondary jobs: triage by status (active / trial / suspended /
expired / deactivated), and jump into any tenant's detail page to manage its
lifecycle, features, billing, and audit trail.

This is **provisioning and triage**, not deep management. Every per-tenant deep
action (deactivate, reactivate, export, feature flags, billing) lives on the
tenant-detail page at `/tenants/:tenantId`. This screen owns: **list +
search/filter + create**.

---

## 2. Entry points & route

**Route:** `/tenants` — lazy-loaded, wrapped by `RequireAuth` (super-admin
guard) → `AppShell` (`AppSidebar` "Tenants" item under the **Platform** nav
group, active state = `brand.primary`).

**Entry points:**

- Sidebar "Tenants" nav item.
- Dashboard (`/`) "Total tenants" KPI / "Provision tenant" quick action
  deep-links here (and may open the create dialog via `?create=1`).
- `⌘K` command palette (web only): "Create tenant", "Go to tenants".
- Breadcrumb root for `/tenants/:tenantId` (back navigation).

**Common-API reads/writes** (per `specs/common-api.md` — the rebuild routes
**all** reads through the typed client; no direct `firebase/firestore` in the
page, unlike today's `getDocs(collection(db,"tenants"))`):

| Action        | Callable (registry name)                                         | Notes                                                                                                                                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List tenants  | `v1.identity.listTenants` _(proposed read endpoint — see below)_ | Server-side paginated via the §7 pagination fragment (`cursor` + `limit`, `nextCursor`, optional `total`). Super-admin only; returns the platform-wide projection of `Tenant`. Replaces the current full-collection client scan.                                                                                      |
| Create tenant | `v1.identity.saveTenant`                                         | The `save*` upsert: **no `id`** in the request ⇒ create branch. Transactional `tenantCode` reservation via `/tenantCodes/{code}`, default `features`/`settings`/`usage`/`stats` seeding, creator `tenantAdmin` membership + claims, optional Secret-Manager Gemini key, audit `tenant_created`. Server-authoritative. |

**Proposed foundation/API addition (flag):** `app-super-admin.md` §5.1 already
mandates moving platform reads behind callables; the common-API inventory lists
new `list*`/`get*` read endpoints for other modules but **does not yet name
`v1.identity.listTenants`**. This spec assumes it and flags it as a **required
new contract entry** (`module: identity`, `authMode: authed`, super-admin only,
`rateTier: read`, request =
`PageRequest & { query?: string; status?: TenantStatus | 'all' }`, response =
`pageResponse(TenantListItem)`). Server performs search + status filter so the
screen no longer filters a fully-loaded array in the browser.

`TenantListItem` projection (derived from `Tenant`, the only fields this screen
renders):
`id, name, tenantCode, contactEmail, status, subscription.plan, stats.totalStudents, stats.totalTeachers (→ derived userCount), createdAt`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): left `Sidebar` (role-driven nav,
"Tenants" active), top `Topbar` (platform-scope — **no tenant switcher** for
super-admin here; search, notifications, profile, theme toggle). Page region
uses the standard content max-width 1200, desktop gutter 32. Vertical rhythm:
regions separated by spacing `6` (24px).

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar  (platform · search · notifications · profile)               │
│ ───────┐│────────────────────────────────────────────────────────────────────│
│ Overview││  ┌─ PageHeader ───────────────────────────────────────────────┐    │
│  Dashbd ││  │ Tenants                                  [+ Create tenant]  │    │
│ Platform││  │ Provision and manage all organizations.   (Button primary) │    │
│ ▸Tenants││  └────────────────────────────────────────────────────────────┘    │
│  Analyt.││                                                                     │
│  Flags  ││  ┌─ Toolbar (filter row) ─────────────────────────────────────┐    │
│  Presets││  │ [🔎 SearchInput  name / code / email……………] [Status: All ▾] │    │
│  LLM    ││  └────────────────────────────────────────────────────────────┘    │
│ System  ││  Status segmented filter (lg): All · Active · Trial · Suspended ·   │
│  Health ││                                Expired · Deactivated  (Chip group)  │
│  Settngs││                                                                     │
│  Announc││  ┌─ Card (DataTable) ─────────────────────────────────────────┐    │
│         ││  │ NAME            CODE        PLAN     USERS  STATUS    ⋯     │◀── │
│         ││  │ Springfield HS  SPRINGFLD   premium   842   ● Active  View →│    │
│         ││  │ admin@spr.edu                                              │    │
│         ││  │ Riverdale Acad  RIVERDALE   trial      37   ● Trial   View →│    │
│         ││  │ …                                                          │    │
│         ││  ├────────────────────────────────────────────────────────────┤    │
│         ││  │ Showing 1–20 of 142     [‹]  1 2 3 … 8  [›]   Rows: 20 ▾   │    │
│         ││  └────────────────────────────────────────────────────────────┘    │
└─────────┘└─────────────────────────────────────────────────────────────────────┘
```

**Grid & responsive:**

- **lg (≥1024, the primary target — admin is desktop-first):** Sidebar
  persistent. Filter row is a single horizontal line: `SearchInput` flex-grows,
  `Select`/segmented status filter pinned right. Full 6-column DataTable (Name,
  Code, Plan, Users, Status, Actions). Create opens a centered `Modal/Dialog`
  (max-width ~480 / `28rem`).
- **md (768–1023):** Sidebar collapses to icon rail or drawer (AppShell
  behavior). Filter row wraps: search full-width on row 1, status filter on
  row 2. Table keeps all columns but Plan/Users may use tighter padding;
  horizontal scroll allowed for the table region only (never the page).
- **sm (<768):** Sidebar → Tabbar (mobile bottom-nav, 4 items). **DataTable →
  stacked SubmissionCard-style list rows**: each tenant is a `Card` showing name
  (display), code (mono Badge), status (Badge with icon+label), plan + user
  count as a `DefinitionList`, full-row tap → detail. Create dialog →
  full-height `Drawer/Sheet`. Search is full-width; status filter becomes a
  `Select`, not a segmented control. (Admin on phone is a fallback, not the
  design center — see §10.)

---

## 4. Components used (from FOUNDATION §5 only)

**Navigation:** `AppShell`, `Sidebar`, `Topbar`, `Tabbar` (sm), `Breadcrumb`
(for detail back-nav), `CommandPalette` (⌘K, web only).

**Containers:** `Card` (table wrapper + sm stacked rows, radius `lg`, elevation
`e1`), `Modal/Dialog` (create, web), `Drawer/Sheet` (create, sm).

**Data:** `DataTable` (sort + paginate + the search/status filter bound to it),
`Pagination` (server-cursor mode), `EmptyState`, `Skeleton`, `Badge` (status +
plan + mono code chip), `Stat/KPI` _(optional header strip — see note)_,
`DefinitionList` (sm stacked rows), `Avatar` _(optional tenant logo/initials in
the name cell)_.

**Primitives:** `Button` (primary = "Create tenant"; ghost = row "View";
secondary/danger inside dialog footer), `IconButton` (row overflow ⋯ if used),
`Input` (search + form text fields), `Combobox`/`Select` (status filter + plan
select), `FileDrop` _(not used here — logo upload lives on detail)_.

**Feedback:** `Toast` (sonner) for create success/error, `InlineAlert/Banner`
(list-load error, maintenance/degraded notice), `FormFieldError`,
`ConfirmDialog` _(not on create — create needs no confirm; reserved for
destructive lifecycle on detail)_, `LoadingOverlay` _(create-submit pending,
optional)_.

**Status colors:** map `TenantStatus` to semantic tokens (icon + label + color,
never color alone): `active → status.success`, `trial → status.info`,
`suspended → status.warning`, `expired → status.error`,
`deactivated → text.muted` (neutral/struck). Plan uses a neutral `Badge`
(text.secondary on `bg.surface-sunken`) — plan is **not** a status and must not
borrow status hues.

**Proposed addition (flag):** A small **header KPI strip** (Total tenants ·
Active · Trial · Suspended) using existing `Stat/KPI` would aid triage and reuse
a §5 component with **no new tokens** — included as optional. If the team wants
it default-on, it's pure composition, not a foundation change.

---

## 5. States

All states render inside the persistent AppShell; only the page region changes.

**Loading (skeleton):** PageHeader renders immediately (title + disabled "Create
tenant" until session resolves). Filter row renders enabled. Table body = 5–8
`Skeleton` rows mirroring the real column widths (name + sub-line, code chip,
plan, users, status pill, actions) — matches today's 5-row skeleton. Pagination
shows a muted placeholder. Reduced-motion: skeletons are static (no shimmer).

**Empty (no tenants at all):** `EmptyState` inside the table card — `Building2`
glyph in a muted circle, Fraunces title "No tenants yet", body copy, and a
primary **"Create your first tenant"** button that opens the create dialog.
(Distinct from the filtered-empty copy below.)

**Empty (filtered / no search results):** Same `EmptyState` shell, copy switches
to "No tenants match your search" + "Clear filters" ghost action. Reached when
search/status yields zero rows.

**Error (list load failed):** `InlineAlert/Banner` variant `error` above the
table — `status.error` icon + "Couldn't load tenants" + the server message (from
the typed `ApiErrorDetails` envelope, §6 common-API) + a "Try again" `Button`
(link/ghost) that re-runs the query. Table region shows nothing or its last good
page. A `PERMISSION_DENIED` code (non-super-admin who slipped the guard) renders
a dedicated "You don't have access to the platform control plane" alert with no
retry.

**Partial:** (a) **Pagination loading** — current page stays visible, the next
page shows an inline spinner/skeleton on the affected rows; cursor-based, so no
full reload. (b) **Stale create** — after a successful create the new tenant may
not appear until the list query invalidates; show the success toast immediately
and refetch page 1 (optimistic insert optional, see §6). (c) **Degraded
platform** — if a maintenance/health banner is active platform-wide, show a
`status.warning` `InlineAlert` at the top of the page (read-only of platform
config), but creation stays enabled unless explicitly blocked.

**Success:** Populated, sortable, paginated table. Create dialog closes, success
`Toast`, list refreshes with the new tenant on page 1 (sorted newest-first by
`createdAt` if that sort is active).

**Permission-gated variations by role:** This route is **super-admin-only**.
There is **no tenant-admin variant** — a tenant-admin is scoped to one tenant
and never sees a cross-tenant list (domain rule §8). If a non-super-admin
reaches the route, `RequireAuth` redirects/blocks; the page itself renders the
permission error alert as defense-in-depth. The "Create tenant" button and the
`v1.identity.saveTenant` create branch are both super-admin-gated server-side;
the UI never shows a create affordance to a non-super-admin.

---

## 6. Interactions & motion

Motion uses §4 tokens only; this is the **restrained** register — no spark, no
celebratory pops.

**Open create dialog:** Click "Create tenant" (or ⌘K → "Create tenant", or
`?create=1`). `Modal/Dialog` enters with `base` (220ms) `ease.entrance`,
backdrop fades `fast` (160ms), elevation `e3`. Focus moves to the first field
(Organization name). Form is `react-hook-form` + Zod (`createTenantSchema`):

- **name** — required, min 1.
- **tenantCode** — required, `^[A-Z0-9-]+$`; input force-uppercases and strips
  invalid chars live (mirrors current `onChange` transform); helper "Uppercase
  letters, numbers, and hyphens only". Server reserves uniqueness — a clash
  returns a typed error (see below).
- **contactEmail** — required, valid email (this seeds the first tenant-admin
  contact / invite).
- **contactPerson** — optional.
- **plan** — `Select`: Trial · Basic · Premium · Enterprise (default Trial).
  _(`free` exists in `TenantPlan` but is intentionally not offered at
  provisioning — see §8; if product wants it, add it here AND ensure
  `saveTenant` seeds it consistently.)_

**Submit (create flow):**

1. Client pre-validates via the registry `requestSchema` (no `tenantId`/`id` in
   body ⇒ create).
2. Submit button → label "Creating…", disabled; `LoadingOverlay`/inline spinner
   optional. Other fields disabled. No optimistic close (creation is
   transactional + server-authoritative; we wait).
3. **Success:** dialog exits (`fast` `ease.exit`), `form.reset()`, success
   `Toast` ("Tenant created · {name}"), invalidate `["platform","tenants"]` +
   `["platform","stats"]`, refetch page 1. **Optional optimistic insert:**
   prepend a placeholder row with a subtle pulse, reconciled on refetch —
   acceptable since the server returns `{ id, created }`.
4. **Error:** dialog stays open, fields re-enabled, error surfaced via
   `useApiError` reading the typed `code`:
   - `VALIDATION_ERROR` → per-field `FormFieldError` from `validationErrors[]`.
   - Tenant-code clash (uniqueness reservation fail) → inline error under the
     code field ("That tenant code is already taken") rather than a toast.
   - `RATE_LIMITED` / `PERMISSION_DENIED` / generic → `InlineAlert` inside the
     dialog + recovery hint.

**Cancel / dismiss:** Cancel button, `Esc`, or backdrop click closes without
saving (no confirm — nothing destructive). If the form is dirty, a lightweight
"Discard changes?" `ConfirmDialog` MAY guard dismissal (optional; default is
dismiss-freely to match current behavior).

**Search:** Debounced (~250ms) input → re-queries `v1.identity.listTenants` with
`query`. Server-side search across name / code / contactEmail. Result swap is
instant (no layout animation beyond row fade). Clearing the field resets to
page 1.

**Status filter:** Segmented `Chip`/`Button` group (lg) or `Select` (sm).
Selecting re-queries with `status`. Active chip = `brand.primary` fill; inactive
= ghost. Only ONE active at a time; "All" clears the status constraint.

**Sort:** Click a sortable column header (`Name`, `Code`, `Plan`, `Users`,
`Status`) → toggles asc/desc; the API takes a sort param (cursor-paginated,
server-sorted). Active sort header shows a direction caret; transition `instant`
(100ms).

**Row → detail:** "View →" ghost button (revealed on row hover / focus-within,
always visible on touch) or full-row click (sm cards) navigates to
`/tenants/:tenantId`. Hover prefetches the detail route + its `getTenant` query
(carry forward the existing hover-prefetch UX).

**Reduced motion:** All dialog/drawer enters become opacity-only fades at
`fast`; no slide/scale; no shimmer; pagination row swaps are instant.

---

## 7. Content & copy (precise admin tone)

- **Page title (Fraunces):** `Tenants`
- **Page description:**
  `Provision and manage every organization on the platform.`
- **Primary action:** `Create tenant`
- **Search placeholder:** `Search by name, code, or email…`
- **Status filter labels:**
  `All · Active · Trial · Suspended · Expired · Deactivated`
- **Table column headers:** `Name` · `Code` · `Plan` · `Users` · `Status` ·
  _(actions, unlabeled / sr-only "Actions")_
- **Row "View" action:** `View` (with external/→ affordance)
- **Pagination summary:** `Showing {start}–{end} of {total}` · `Rows per page`

**Create dialog:**

- **Title:** `Create tenant`
- **Description:**
  `Provision a new organization. You'll be added as its first administrator.`
- **Field labels:** `Organization name *` · `Tenant code *` · `Contact email *`
  · `Contact person` · `Subscription plan`
- **Field placeholders:** name `e.g. Springfield High School`; code
  `e.g. SPRINGFIELD-HS`; email `admin@school.edu`; person `Jane Doe`
- **Tenant-code helper:**
  `Uppercase letters, numbers, and hyphens only. Must be unique across the platform.`
- **Contact-email helper:**
  `The first administrator's email for this organization.`
- **Footer:** `Cancel` · `Create tenant` (pending: `Creating…`)

**Empty-state copy:**

- No tenants: title `No tenants yet` / body
  `Provision your first organization to bring it onto the platform.` / action
  `Create your first tenant`
- Filtered empty: title `No tenants match your search` / body
  `Adjust your search terms or status filter.` / action `Clear filters`

**Error copy:**

- List load: title `Couldn't load tenants` / body `{server message}` / action
  `Try again`
- Permission: title `Access restricted` / body
  `The tenant control plane is available to platform super-admins only.` (no
  retry)
- Create — code clash (under field):
  `That tenant code is already taken. Choose another.`
- Create — generic: `Couldn't create the tenant. {recovery hint}`
- Create success toast: `Tenant created · {name}`

Tone: declarative, operator-grade, no exclamation marks, no student-facing
warmth or emoji.

---

## 8. Domain rules surfaced

- **Tenant isolation is absolute.** This cross-tenant list exists **only**
  because the viewer is a super-admin operating the platform control plane. A
  tenant-admin is scoped to exactly one tenant and must NEVER see this list or
  any other tenant's data — there is no scoped variant of this screen.
- **RBAC gating, server-authoritative.** Both reads (`listTenants`) and the
  create write (`saveTenant`) are gated server-side on `isSuperAdmin`. The UI
  guard (`RequireAuth` + claim check) is defense-in-depth UX only; the server is
  the authority. The create button never appears for non-super-admins.
- **Tenant-code uniqueness is server-reserved.** `saveTenant` transactionally
  reserves `/tenantCodes/{code}`. The client cannot pre-confirm availability
  authoritatively — it validates format only; the server is the source of truth
  and returns a typed clash error.
- **Server-seeded defaults.** Default `features`, `settings`, `usage`, `stats`,
  and the creator's `tenantAdmin` membership + custom claims are seeded by the
  server, not the client. The form never sends feature flags or stats.
  Plan-derived quotas (`maxStudents`, `maxSpaces`, `maxExamsPerMonth`, etc.) are
  server-set per plan.
- **Privilege-gated mutable fields.** `status`, `subscription`, and `features`
  can only be changed by a super-admin (a tenant-admin cannot self-upgrade). At
  creation the super-admin sets only the starting `plan`; status defaults
  server-side (trial/active per plan). All later status/plan/feature changes
  happen on the detail page, also super-admin-gated.
- **Soft lifecycle only.** There is no destructive create-then-delete from this
  screen. Deactivation (soft, membership-suspending, audited) lives on detail.
  "Deactivated" tenants appear in the list, rendered neutral/struck, never
  silently dropped.
- **Quota / cost context.** This screen surfaces user counts (a quota signal)
  but does not enforce quotas; budget/cost enforcement and `dailyCostSummaries`
  rollups live in LLM-usage / detail. No cost figure is shown per-row here.
- **Audit logging.** Tenant creation writes `tenant_created` to the platform
  activity log (`logTenantAction` + `writePlatformActivity`) server-side. The UI
  need not display it here, but the action is non-optional and non-blocking
  server-side.
- **Answer-key / secret isolation.** N/A to fields shown, but reinforced: the
  optional Gemini API key (if ever collected at provisioning) is written to
  Secret Manager (`tenant-{id}-gemini`) and is never read back to or rendered in
  the client — only a `geminiKeySet: boolean` is ever surfaced (on detail).

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Skip-to-content → Sidebar → Topbar → PageHeader "Create
  tenant" → SearchInput → status filter group → table headers (sortable,
  focusable) → row actions → pagination. Logical, top-to-bottom, left-to-right.
- **Keyboard:**
  - Status filter = a `radiogroup` of toggle chips; arrow keys move within the
    group, one tab stop.
  - Sortable headers are `<button>`s inside `<th>`; `Enter`/`Space` toggles
    sort; `aria-sort` reflects `ascending`/`descending`/`none`.
  - Pagination buttons are reachable and labeled (`aria-label="Next page"`,
    current page `aria-current="page"`).
  - Row "View" is a real link/button; full-row click (sm) has a
    keyboard-reachable equivalent.
  - **Create dialog:** focus is trapped, first field auto-focused, `Esc` closes,
    focus returns to the "Create tenant" trigger on close. `role="dialog"`,
    `aria-modal="true"`, `aria-labelledby` → title, `aria-describedby` →
    description.
- **Forms:** every field has a programmatic `<label>`; required marked with `*`
  AND `aria-required="true"` (not asterisk alone). `FormFieldError` linked via
  `aria-describedby`; invalid fields get `aria-invalid="true"`. The code field's
  live transform must not steal focus or reset caret unexpectedly; announce the
  format constraint via the persistent helper text, not only on error.
- **Status never by color alone:** every status renders **icon + text label +
  color** (`active → success`, `trial → info`, `suspended → warning`,
  `expired → error`, `deactivated → muted`). `Badge` includes the text; screen
  readers read the word, not the hue.
- **Contrast:** all text/background pairs meet AA (4.5:1 body, 3:1 large/UI).
  Mono code chips on `bg.surface-sunken`, secondary email sub-line on
  `text.secondary`, and ghost-button "View" all verified against the token
  pairings in foundation §2.2. Status badges use the `*-600` (light)
  on-tinted-`*-50`/`-200` pairings that meet 3:1+.
- **Live regions:** list load errors and create success/error announced via
  `aria-live="polite"` (toast + alert). A `RouteAnnouncer` announces "Tenants"
  on navigation. Loading skeletons carry `aria-busy="true"` on the table region.
- **Reduced motion:** honor `prefers-reduced-motion` — fades only, no
  slide/scale/shimmer (§6).
- **Touch targets:** ≥44px on sm (stacked rows, full-width buttons, `Select`
  triggers).

---

## 10. Web ↔ mobile divergence

**Admin is primarily web / desktop — state explicitly.** The super-admin control
plane is a desktop-first operator tool; the design center is **lg (≥1024)** with
a persistent sidebar and a 6-column DataTable. There is **no native React Native
super-admin app** in scope; "mobile" here means the responsive web app on a
small viewport (a fallback for on-call triage, not a primary surface).

Divergences (same component **names/props** per foundation §6, renderer/layout
differs):

- **DataTable → stacked Cards (sm):** below md, the table degrades to a vertical
  list of `Card` rows (name + mono code + status Badge + `DefinitionList` for
  plan/users), full-row tap → detail.
- **Create Dialog → Drawer/Sheet (sm):** the centered modal becomes a
  full-height bottom sheet for thumb reach; same form, same validation.
- **Sidebar → Tabbar (sm):** persistent sidebar collapses to the mobile
  bottom-nav (4 items).
- **Status filter:** segmented chip group (lg/md) → `Select` (sm).
- **Hover affordances → always-visible (touch):** the hover-revealed "View"
  action and hover route-prefetch have no hover on touch; "View" is always
  visible and prefetch fires on focus/tap-intent.
- **⌘K command palette is web-only** — the "Create tenant" / "Go to tenants"
  palette entries do not exist on touch; the on-screen "Create tenant" button is
  the canonical entry there.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp super-admin web app using the "Lyceum"
design system. Read and conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md — use ONLY
its tokens (semantic names) and its §5 component inventory. Do NOT invent colors, fonts, spacing,
radii, shadows, motion, or new component variants. This is admin tooling: the SERIOUS, restrained
register of Lyceum — NO gamification spark, NO marigold accents, NO student warmth.

SCREEN: "Tenant Provisioning" — Tenants list + Create.
ROUTE: /tenants. ROLE: platform super-admin only (cross-tenant control plane; tenant isolation is a
hard rule — a tenant-admin must NEVER see this).

Render inside AppShell: persistent left Sidebar ("Tenants" active under a "Platform" nav group),
top Topbar (platform scope — NO tenant switcher here; search, notifications, profile, theme).
Desktop-first (design at lg ≥1024).

CONTENT REGIONS (top to bottom, gap = spacing 6):
1. PageHeader — title "Tenants" (Fraunces display), description "Provision and manage every
   organization on the platform.", and a PRIMARY Button "Create tenant" (brand.primary) on the right.
2. Toolbar — a flex row: a SearchInput (grows, placeholder "Search by name, code, or email…") and a
   status filter on the right. Status filter = a segmented chip/Button group: All · Active · Trial ·
   Suspended · Expired · Deactivated (one active at a time, active = brand.primary fill).
3. A Card wrapping a DataTable (radius lg, elevation e1). Columns: Name (with a muted secondary line
   for contact email below it), Code (a mono Badge/chip, Spline Sans Mono), Plan (neutral Badge — NOT
   a status color), Users (mono tabular number), Status, and a trailing actions cell with a ghost
   "View →" link to /tenants/:id (revealed on row hover/focus, always visible on touch). Name, Code,
   Plan, Users, Status are sortable (aria-sort, direction caret). Footer = Pagination
   ("Showing 1–20 of N", page controls, rows-per-page).

STATUS TOKENS (icon + label + color, NEVER color alone): active→status.success, trial→status.info,
suspended→status.warning, expired→status.error, deactivated→text.muted.

CREATE: a centered Modal/Dialog (max-width ~28rem; on small screens a bottom Drawer/Sheet). Title
"Create tenant", description "Provision a new organization. You'll be added as its first
administrator." Fields (react-hook-form + Zod): Organization name * (text), Tenant code * (text,
force-uppercase live, allow A–Z 0–9 - only, helper "Uppercase letters, numbers, and hyphens only.
Must be unique across the platform."), Contact email * (email, helper "The first administrator's
email for this organization."), Contact person (optional text), Subscription plan (Select: Trial /
Basic / Premium / Enterprise, default Trial). Footer: ghost "Cancel" + primary "Create tenant"
(pending label "Creating…"). On submit show pending state, then a sonner success Toast
"Tenant created · {name}" and close; on a tenant-code clash show an inline error under the code field
"That tenant code is already taken. Choose another." Do NOT add a confirm step to create.

STATES to show: skeleton table (5–8 rows mirroring column widths), empty ("No tenants yet" +
"Create your first tenant"), filtered-empty ("No tenants match your search" + "Clear filters"),
list-load error as an InlineAlert (status.error, "Couldn't load tenants" + "Try again"), and the
populated success state.

MOTION (foundation §4 only): dialog enter base/ease.entrance, exit fast/ease.exit, sort toggle
instant, NO celebratory pops. Respect prefers-reduced-motion (fades only).

A11Y: super-admin only; status filter is a radiogroup; sortable headers are buttons with aria-sort;
dialog traps focus, returns focus on close, aria-modal; required fields use aria-required; status
conveyed by icon+label+color; all pairs meet WCAG AA.

RESPONSIVE: lg = full table + sidebar. md = wrapped toolbar, sidebar rail. sm = DataTable becomes
stacked Cards (name + mono code + status Badge + DefinitionList for plan/users, full-row tap → detail),
create Dialog becomes a Drawer/Sheet, Sidebar becomes a Tabbar, status filter becomes a Select.
⌘K command palette entries ("Create tenant", "Go to tenants") are WEB ONLY.

Output: a single React + Tailwind screen composed from shared-ui components, tokens by semantic name,
no hardcoded hex, no new variants.
```
