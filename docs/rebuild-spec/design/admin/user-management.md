# User Management (Students / Teachers / Parents) — Screen Spec

> **Area:** admin (Tenant / Academy Admin portal) · **Route:** `/users` ·
> **Role:** `tenantAdmin` **Design system:** Lyceum — conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. All
> colors/type/spacing/radius/elevation/motion are cited by **semantic token name
> only**; no raw hex, no invented variants. Register: **precise/credible admin**
> (restraint in chrome — NOT the playful student register).

---

## 1. Purpose & primary user

**Primary user:** the **Tenant Admin** (`tenantAdmin`) — a school/academy
administrator. (`superAdmin` may also reach it via tenant-scoped impersonation,
but the screen is always operating _inside one tenant_; there is no cross-tenant
view here — that lives in super-admin.)

**Job-to-be-done:** _"Maintain the people directory for my academy."_ In one
place the admin must be able to: find any teacher / student / parent fast;
onboard new users one at a time or in bulk (CSV); fix profile data; assign
students/teachers to classes; link parents to children; and archive/reactivate
accounts when people leave or return — without ever touching another tenant's
data and without handling raw credentials.

This is the **operational hub** of the admin app: it is the most-used management
page after the dashboard, so it must be legible at a glance, keyboard-fast, and
forgiving (confirm destructive actions, optimistic where safe).

---

## 2. Entry points & route

**Route:** `/users` (lazy route in `apps/admin-web/src/App.tsx`, gated by
`RequireAuth allowedRoles={["tenantAdmin"]}` which asserts
`currentMembership.tenantId === currentTenantId`).

**Entry points:**

- Sidebar → **Management** nav group → **Users** (active-nav uses
  `brand.primary`).
- Dashboard quick-action / "Add your first teacher" empty-state CTA.
- `⌘K` command palette (web only): "Add teacher", "Add student", "Go to Users".
- Deep links from Class Detail ("manage roster") and from a parent/notification
  context.

**Tab state** is reflected in the URL (`/users?tab=teachers|students|parents`,
default `teachers`) so a tab is linkable and survives refresh.

**Common-API reads/writes** (per `specs/common-api.md` §3.3; tenantId is derived
server-side from `ctx.activeTenantId`, _not_ sent in the body):

| Action                                  | Callable / read (rebuild `v1.*` registry)                                      | Notes                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| List teachers                           | `v1.identity.listTeachers` (new read endpoint replacing direct Firestore read) | paginated fragment §7                                                       |
| List students                           | `v1.identity.listStudents`                                                     | paginated                                                                   |
| List parents                            | `v1.identity.listParents`                                                      | paginated                                                                   |
| List classes (for assignment + filters) | `v1.identity.listClasses`                                                      | drives class chips, EntityPicker, create-student class select               |
| Create one user                         | `v1.identity.createOrgUser` (`role: teacher\|student\|parent`)                 | provisions Auth user + entity + membership + claims (saga + idempotencyKey) |
| Edit teacher / class assign             | `v1.identity.saveTeacher` (`id` present = update)                              | `SaveResponse { id, created }`; must call `syncMembershipClaims`            |
| Edit student / class + parent link      | `v1.identity.saveStudent` (`id` present = update)                              | claims re-sync on class change                                              |
| Edit parent                             | `v1.identity.saveParent`                                                       |                                                                             |
| Bulk CSV import students                | `v1.identity.bulkImportStudents` (`dryRun` first)                              | idempotencyKey; returns per-row result                                      |
| Bulk CSV import teachers                | `v1.identity.bulkImportTeachers` (`dryRun` first)                              |                                                                             |
| Bulk archive / reactivate               | `v1.identity.bulkUpdateStatus` (`entityType`, `entityIds[]`, `newStatus`)      | server validates status transition                                          |

> **Rebuild correction vs. live code:** today `UsersPage.tsx` reads via
> `useTeachers/useStudents/useParents` (direct Firestore) and writes via
> `callCreateOrgUser` etc. The rebuild routes **every read and write** through
> `packages/api-client` hooks (`specs/common-api.md` §5.3). The screen design is
> unchanged by this; only the data seam moves.

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** (`§5 Navigation`): persistent **Sidebar**
(role-driven nav, Management group active) + **Topbar** (tenant name/switcher,
search, NotificationBell, profile). This spec owns only the **main content
region**. Page gutters: desktop `space-8` (32), tablet `space-6` (24), mobile
`space-4` (16). Max content width 1200; the table is allowed to fill the column
and scroll-x on narrow widths.

```
AppShell
┌──────────┬───────────────────────────────────────────────────────────────┐
│          │ Topbar: [tenant ▾]            [⌘K search]   [🔔]  [avatar ▾]    │
│ Sidebar  ├───────────────────────────────────────────────────────────────┤
│  Overview│  Breadcrumb: Home › Users                                       │
│ ►Manage  │                                                                 │
│   Users◄ │  ┌── PAGE HEADER (flex row, wrap) ───────────────────────────┐ │
│   Classes│  │ H1 "User Management"            [Import CSV ▾] [+ Add ▾]   │ │
│   ...    │  │ sub "Manage teachers, students & parents in {Tenant}"     │ │
│ Analytics│  └───────────────────────────────────────────────────────────┘ │
│ Config   │                                                                 │
│          │  ┌── TABS (segmented) ───────────────────────────────────────┐ │
│          │  │ [ Teachers · 24 ] [ Students · 312 ] [ Parents · 198 ]    │ │
│          │  └───────────────────────────────────────────────────────────┘ │
│          │                                                                 │
│          │  ┌── TOOLBAR (filter row) ───────────────────────────────────┐ │
│          │  │ [🔍 Search teachers…]   [Status ▾] [Class ▾]   [⤓ Export] │ │
│          │  └───────────────────────────────────────────────────────────┘ │
│          │                                                                 │
│          │  ┌── DATATABLE ──────────────────────────────────────────────┐ │
│          │  │ [☐] Name      Subjects   Designation  Classes  Status  ⋯  │ │
│          │  │ [☐] A. Rao    Math,Phys  HOD          3        ●Active ⋯  │ │
│          │  │ [☐] …                                                     │ │
│          │  └───────────────────────────────────────────────────────────┘ │
│          │  Pagination:  ‹ 1 2 3 ›        Rows: [25 ▾]   25 of 312        │ │
│          │                                                                 │
│          │        ┌─ floating bulk bar (when rows selected) ─┐            │
│          │        │ 8 selected  [Archive] [Reactivate] [✕]   │            │
│          │        └──────────────────────────────────────────┘            │
└──────────┴───────────────────────────────────────────────────────────────┘
```

**Region breakdown**

- **Page header:** `h1` (Fraunces, `text-2xl`) + secondary subtitle (Schibsted,
  `text-sm`, `text.secondary`) that names the active tenant (reinforces tenant
  scope). Right-aligned action cluster: **Import CSV** (secondary Button, split
  for Students/Teachers) and **+ Add** (primary Button, label adapts to active
  tab: _Add Teacher / Add Student / Add Parent_).
- **Tabs:** the three roles. Each tab shows a live count Badge (`pill`). Tab
  change resets search, filters, and selection.
- **Toolbar:** Search Input (with leading search icon), Status Select (All /
  Active / Archived), Class Combobox filter (teachers/students only), and an
  **Export current view** action.
- **DataTable:** the per-role columns (see §4). Row-level overflow `⋯`
  IconButton opens a Popover menu of row actions.
- **Pagination:** server-cursor pagination (rebuild) via the unified
  `PageRequest`/`pageResponse` fragment; page-size select 25/50/100.
- **Floating bulk action bar:** appears centered near the bottom when ≥1 row
  selected; `bg.surface`, `e3`, `radius.lg`.

**Responsive behavior**

- **lg (≥1024):** full layout as drawn; sidebar expanded; table shows all
  columns.
- **md (768–1023):** sidebar collapses to icons (AppShell behavior); table keeps
  key columns, secondary columns (Designation, Grade) hide; toolbar filters
  collapse into a single **Filters** Popover button.
- **sm (<768):** admin is desktop-first (see §10), but it must not break. The
  page header action cluster stacks; **the DataTable becomes a stacked list of
  Cards** — one Card per user with name + status Badge + a 2–3 field
  DefinitionList + an overflow action menu. Tabs become horizontally scrollable.
  The floating bulk bar spans full width with safe-area padding; touch targets
  ≥44px.

---

## 4. Components used (FOUNDATION §5 only)

**Navigation:** AppShell, Sidebar, Topbar, Breadcrumb, CommandPalette (⌘K,
web-only).

**Containers / structure:** Tabs (role switch), Card (mobile stacked rows;
dialog bodies), Section (header block), Modal/Dialog (Create, Edit, Assign,
Link), ConfirmDialog (bulk archive/reactivate, single deactivate), Drawer/Sheet
(mobile filter panel — optional), Popover (row `⋯` actions; collapsed filters),
Tooltip (icon-only actions).

**Data:** **DataTable** (sort/filter/paginate/**select** — the §5B-recommended
shared primitive; replaces the duplicated `usePagination`/`useSort`/`Set`
plumbing in today's tabs), Pagination, Checkbox (header select-all + row
select), Badge (status, subjects, class chips), Chip/Tag (class assignment
chips, linked-children chips), Avatar (name cell leading avatar with initials),
DefinitionList (mobile card fields & confirm-dialog summaries), EmptyState,
Skeleton (table loading), Stat/KPI (tab count badges).

**Primitives / forms:** Button (primary `+ Add`, secondary `Import`, ghost row
actions, **danger** archive, **spark is NOT used here** — admin chrome stays
restrained), IconButton (`⋯`, close), Input (search + form text), Select (status
filter, role, class on create), Combobox (class filter + multi-select assignment
via EntityPicker pattern), FileDrop (CSV upload inside import dialog), Switch
(n/a unless feature gate toggles surface), Label, FormFieldError.

**Feedback:** Toast (sonner — create/import/bulk results), InlineAlert/Banner
(import dry-run validation summary; partial-failure banner; quota/feature gate
notice), LoadingOverlay (during bulk submit), FormFieldError.

**Domain components:** none of the assessment-specific domain components apply
here (this is identity/people, not learning/grading). `AnswerKeyLock`,
`GradePill`, etc. are intentionally absent.

**Proposed foundation additions (flag):**

1. **`StatusBadge` variant set** — a thin, named composition over Badge mapping
   `active → status.success`, `archived → text.muted/border.strong`,
   `pending/invited → status.info`, each **always icon + label** (never color
   alone, per §2.3). This is a _composition_, not a new token; if the team
   prefers, treat it as a documented usage of Badge rather than a new component.
   **Flagged for foundation inclusion** because Users, Classes, Staff, and Exams
   all need the identical mapping.
2. **`BulkActionBar`** — the floating, centered, selection-context action bar.
   Not in §5 today. Used here and on Classes/Staff. Proposed as a shared
   container component (uses `bg.surface`, `e3`, `radius.lg`, `ease.entrance`).
   **Flagged for foundation inclusion.**

---

## 5. States

All states are **per-tab** (loading the Students tab does not block Teachers).
Counts in tab labels come from the list response `total`.

**Loading (skeleton):** DataTable body renders Skeleton rows (header + N shimmer
rows matching column count) using `bg.surface-sunken` shimmer; tab count badges
show a small Skeleton pill until counts resolve. No layout shift between
skeleton and data. Toolbar/header remain interactive (search is debounced and
queued).

**Empty (zero users in tenant, no filter applied):** EmptyState centered in the
table region — Fraunces title, one-line guidance, and the primary CTA inline:

- Teachers: _"No teachers yet"_ → **Add teacher** + **Import CSV** secondary.
- Students: _"No students yet"_ → **Add student** + **Import CSV**.
- Parents: _"No parents yet"_ → "Parents are usually created when you import
  students" + **Add parent**.

**Empty (filtered / searched, no matches):** distinct copy — _"No teachers match
your filters"_ with a **Clear filters** ghost button. (Do not show the
onboarding CTA here.)

**Partial:**

- **Bulk import partial success:** after a real (non-dry-run) import, an
  InlineAlert/Banner summarizes _"284 imported · 12 skipped · 4 errors"_ with a
  "View details" disclosure listing per-row errors (row #, field, message).
  Successful rows are committed; failed rows are not — no all-or-nothing.
- **Bulk status partial:** if `bulkUpdateStatus` reports some ids couldn't
  transition (e.g. already archived), toast + Banner: _"6 archived · 2
  unchanged"_.
- **Stale-claims caveat surfaced:** when a class reassignment succeeds, a subtle
  InlineAlert notes propagation may take a moment (server re-syncs membership
  claims; tokens refresh) — set expectations, don't alarm.

**Error:**

- **List load failure:** the table region shows an error state (not an empty
  state) — InlineAlert with `status.error` icon+label, the server
  `error.details.message` (from the typed error envelope, `common-api.md` §6),
  and a **Retry** Button.
- **Mutation failure:** Toast `status.error` with title +
  `error.details.message`; the optimistic row reverts (see §6). Form dialogs
  show inline FormFieldError per `validationErrors[]` path.
- **Tenant suspended (`TENANT_SUSPENDED`):** writes are blocked server-side; the
  page shows a top Banner explaining the tenant is suspended and disables
  create/import/bulk actions (read-only).

**Permission-gated variations by role:**

- **`tenantAdmin` (full):** all actions enabled.
- **`staff` with `canManageUsers = false`:** (rebuild enforcement,
  `app-admin-web.md` rec #9 / `common-api.md` auth) — page is **read-only**:
  search/filter/view allowed; **Add**, **Import**, **Edit**, **Assign**,
  **Link**, and **bulk** actions are hidden (not just disabled). A subtle
  InlineAlert: _"You have view-only access to users."_
- **Feature gate `bulkImport = false`** (`TenantFeatures`): Import CSV buttons
  are hidden; a Tooltip on a disabled affordance explains it's unavailable on
  the current plan. Inline-create still works.
- **`superAdmin` impersonating:** identical to tenantAdmin but the Topbar shows
  an impersonation banner (owned by AppShell, not this screen).

---

## 6. Interactions & motion (§4 motion tokens)

**Tab switch:** content cross-fades `fast` (160ms, `ease.standard`); the active
tab indicator slides `base` (220ms). Search/filters/selection reset on switch.
Respect `prefers-reduced-motion` (instant swap, no slide).

**Search:** debounced ~250ms; in the rebuild this drives a server query (cursor
reset to page 1). Result region fades in `fast`. The search Input keeps focus.

**Create user (Modal):**

1. **+ Add** opens the Create Dialog (`Modal` enters `base`, `ease.entrance`,
   scrim fade; `e3`). Title and fields adapt to the active role.
2. Form uses react-hook-form + the shared Zod schema (rebuild) so client/server
   validate the same contract. Inline FormFieldError on blur/submit.
3. **Create** → button enters loading (spinner, label "Creating…", disabled). On
   success: Dialog closes `fast`, a new row **optimistically prepends** to the
   table with a one-shot `bg.surface-sunken → transparent` highlight (`slow`
   320ms), Toast `status.success` _"Teacher added"_. On error: dialog stays
   open, FormFieldError populated from `validationErrors[]`, Toast error.
   **Credentials are never shown** — the server delivers any temp password via a
   short-lived signed link out-of-band (see §8); the UI only confirms creation.

**Inline edit / class assign / parent link (Modals):**

- Class assignment uses the multi-select EntityPicker/Combobox of classes;
  parent link uses the parents EntityPicker. Save is **optimistic**: chips
  update immediately; on failure they revert and a Toast error appears. A subtle
  InlineAlert notes claim propagation latency on class change.

**Row selection → BulkActionBar:** selecting a row animates the bar in from
below (`base`, `ease.entrance`, slide+fade). Header checkbox selects all rows
**on the current page** (with an optional "Select all N across pages" affordance
when filtered). Deselect or ✕ dismisses the bar (`fast`, `ease.exit`).

**Bulk archive / reactivate (ConfirmDialog):** never optimistic for destructive
scope. **Archive Selected** opens ConfirmDialog summarizing count + effect
(_"Archived users are hidden from active views and lose portal access."_).
Confirm shows LoadingOverlay on the bar; on success rows update (archived ones
drop from the default "Active" filter), selection clears, Toast
`status.success`. Partial results → Banner (§5).

**Bulk CSV import (Dialog, two-phase):**

1. FileDrop accepts a `.csv`; the dialog shows required/optional columns.
2. **Dry-run first:** parse client-side, then call import with `dryRun: true`;
   render a validation summary Banner + per-row error table (`confidence`-style
   coloring not used — use `status.error`/`status.warning` icon+label).
3. **Import N valid rows** (real run) only enabled when there is ≥1 valid row.
   Progress via LoadingOverlay; result summary per §5 partial state. Toast on
   completion.

**Feedback principles:** safe, easily-reversible mutations (create, edit,
assign, link) are **optimistic** with revert-on-error; **destructive/bulk**
mutations are **confirm-then-commit** (never optimistic). All confirmations use
ConfirmDialog with explicit consequence copy. No celebratory motion anywhere —
this is the serious register; the marigold `spark` and spring pops are reserved
for the student app.

---

## 7. Content & copy (precise admin tone)

**Headings**

- Page H1: **User Management**
- Subtitle: **Manage teachers, students, and parents in {TenantName}.**
- Tabs: **Teachers · {n}** / **Students · {n}** / **Parents · {n}**

**Buttons / labels**

- Primary: **Add teacher** / **Add student** / **Add parent** (adapts to tab)
- Secondary: **Import CSV** (Students: "Import students" · Teachers: "Import
  teachers")
- Toolbar: search placeholder **Search teachers…** (adapts), filters **Status**,
  **Class**, **Export view**
- Row actions (`⋯`): **Edit**, **Assign classes**, **Link parents** (students),
  **Archive** / **Reactivate**, **Resend invite** (where applicable)
- Bulk bar: **{n} selected** · **Archive** · **Reactivate** · **Clear**

**Column headers**

- Teachers: Name · Subjects · Designation · Classes · Status · _(actions)_
- Students: Name · Roll number · Grade · Class(es) · Parents · Status ·
  _(actions)_
- Parents: Name · Linked children · Status · _(actions)_

**Empty states**

- Teachers (true empty): **No teachers yet** — _Add your first teacher, or
  import a roster from CSV._
- Students (true empty): **No students yet** — _Add a student, or bulk-import
  your roster._
- Parents (true empty): **No parents yet** — _Parent accounts are usually
  created automatically when you import students._
- Filtered empty: **No {role} match your filters** — _Try a different search or_
  **Clear filters**.

**Confirm copy**

- Single archive: **Archive {name}?** — _They'll be hidden from active views and
  lose portal access. You can reactivate them later._
- Bulk archive: **Archive {n} {role}?** — _Archived {role} are hidden from
  active views and lose portal access. You can reactivate them later._
- Reactivate: **Reactivate {n} {role}?** — _They'll reappear in active views and
  regain portal access._

**Error copy** (sourced from the typed error envelope `ERROR_MESSAGES`;
examples)

- Generic create: **Couldn't add the user.** _{server message}. Please check the
  details and try again._
- Duplicate email/roll: **That email is already in use in this academy.**
- Import validation: **{n} rows have errors.** _Fix them in your CSV or import
  the valid rows only._
- Tenant suspended: **This academy is suspended.** _User management is read-only
  until it's reactivated._
- Permission: **You don't have permission to manage users.**

**Tone rules:** plain, exact, no exclamation marks, no emoji, no gamified
language. Never reveal credentials, internal ids, or another tenant's data in
any string.

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** Every list/read/write is scoped to the
   caller's active tenant. In the rebuild, `tenantId` is **derived server-side
   from `ctx.activeTenantId`** (claims), never trusted from the request body
   (`common-api.md` §4.4). The UI never offers a cross-tenant view; the subtitle
   names the current tenant to make scope visible. Path-based isolation
   (`tenants/{tenantId}/{students|teachers|parents}`) is enforced by Firestore
   rules as defense-in-depth.
2. **RBAC / permission gating.** Only `tenantAdmin` (or `superAdmin`) may
   mutate. `staff.canManageUsers` gates write affordances (rebuild enforcement).
   `bulkImport` is a `TenantFeatures` flag — Import is hidden when off. UI
   gating is UX only; the callable re-checks authorization server-side.
3. **Credentials are never client-visible.** `createOrgUser` provisions the Auth
   user and (for emailless roll-number students) a **synthetic email**
   `{rollNumber}@{tenantId}.levelup.internal`. Temp passwords are delivered via
   **short-lived signed URLs out-of-band**, never returned in the callable
   response or rendered. The screen only confirms "user added".
4. **Server-authoritative status state machine.** `active ⇄ archived`
   transitions go through `saveStudent/saveTeacher`/`bulkUpdateStatus`; the
   server validates allowed transitions. The UI optimism never invents a status
   the server didn't return.
5. **Claims must re-sync on role/class/permission change.** Class reassignment
   (`saveStudent`/`saveTeacher`) must call `syncMembershipClaims` server-side
   (closes the live stale-claims bug, `auth-access.md` §4.2). The UI surfaces an
   InlineAlert that access changes may take a moment to propagate (token refresh
   window).
6. **Membership/entity provisioning is server-only & idempotent.**
   `/userMemberships` is write-never-from-client; all creation goes through the
   callable saga with an `idempotencyKey` so retried submits don't create
   duplicate Auth users/entities.
7. **Audit logging.** Every mutating action (create, edit, assign, link,
   archive, import) writes to the single audit-log collection server-side
   (best-effort, non-blocking). The UI does not surface the audit trail here,
   but actions are attributable to the acting admin.
8. **Quota / cost.** User creation may count against tenant quotas/usage; on
   `QUOTA_EXCEEDED` the create/import is blocked with the typed error and a
   Banner pointing to plan/usage. (No AI cost budgets apply on this screen — no
   LLM calls here.)
9. **Soft-delete only.** Archive is non-destructive (status flip). There is no
   hard delete in the UI; deactivation triggers (`onStudentArchived`) fan out
   roster cleanup server-side.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Skip-to-content → page header (H1, then action buttons) →
  Tabs (arrow-key roving tabindex, `role="tablist"`) → toolbar (search → filters
  → export) → DataTable (header select-all checkbox → column headers if sortable
  → rows → row actions) → Pagination → (when present) BulkActionBar. Opening any
  Dialog **traps focus**; Escape closes; focus returns to the triggering
  control.
- **Keyboard:** Tabs navigable with ←/→ and Home/End. Table is fully operable:
  Space toggles a focused row checkbox; Enter on a row opens its primary action;
  the `⋯` menu is a Popover with arrow-key items. `⌘K` opens the command palette
  (web). All actions reachable without a pointer.
- **ARIA:** Tabs use `role=tablist/tab/tabpanel` with `aria-selected` and
  `aria-controls`; each tab announces its count (`aria-label="Teachers, 24"`).
  DataTable uses semantic `<table>` with `<th scope="col">`; select-all checkbox
  has `aria-label="Select all teachers on this page"`; each row checkbox labels
  with the user's name. The BulkActionBar is an `aria-live="polite"` region
  announcing "{n} selected". Toasts announce via `role="status"` (success) /
  `role="alert"` (error). Loading regions expose `aria-busy`.
- **Status never by color alone (§2.3):** every status uses **icon + text
  label** Badge (Active = filled dot + "Active" on `status.success`; Archived =
  outline dot + "Archived" on `text.muted`). Class/subject chips carry text, not
  color meaning.
- **Contrast:** all text/bg pairs meet AA (4.5:1 body, 3:1 large/UI) —
  guaranteed by Lyceum semantic tokens (`text.primary` on `bg.surface`,
  `text.secondary` for subtitles). `border.focus` ring (indigo @35%, the `focus`
  elevation token) on every interactive element; never remove the outline.
- **Reduced motion:** `prefers-reduced-motion` disables tab slide, row highlight
  pulse, and bulk-bar slide — content swaps instantly; no information is
  motion-only.
- **Targets:** ≥44px touch targets on mobile; icon-only buttons have Tooltip +
  `aria-label`.

---

## 10. Web ↔ mobile divergence

**Admin is primarily web / desktop** — this screen is designed for a wide table
on a pointer device, and that is the canonical experience. There is **no
dedicated admin React Native app**; admins on a phone use the responsive web
app.

- **Table → cards:** at `sm` the DataTable collapses to a **stacked Card list**
  (one Card per user: Avatar + name, StatusBadge, a 2–3 row DefinitionList of
  key fields, overflow `⋯` menu). Selection persists across the card layout for
  bulk actions.
- **Hover → press:** row hover affordances (highlight, inline action reveal)
  become always-visible on touch; the `⋯` menu replaces hover-revealed inline
  actions.
- **Filters:** the inline toolbar filters collapse into a **Filters**
  Popover/Sheet on `md`/`sm`.
- **⌘K command palette is web-only.** On touch, the same actions are reachable
  via the header **+ Add** and **Import** buttons and the Topbar search.
- **BulkActionBar** becomes full-width with safe-area inset padding on mobile.
- Token parity is automatic: web reads the Lyceum tokens via Tailwind `@theme`;
  any future RN reuse reads the same token JSON via NativeWind (component
  names/props match 1:1, §6 of foundation).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen of the Auto-LevelUp admin web app using the "Lyceum"
design system. Conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md — do NOT
invent colors, fonts, spacing, radii, shadows, motion, or component variants. Compose
only from the §5 component inventory and reference tokens by semantic name
(brand.primary, bg.surface, bg.surface-sunken, text.primary, text.secondary, text.muted,
border.subtle, border.strong, border.focus, status.success, status.warning, status.error,
status.info). The marigold `spark` accent and any celebratory/spring motion are FORBIDDEN
here — this is the admin "serious/credible" register, restraint in chrome.

SCREEN: Tenant-Admin "User Management" at /users.
ROLE: tenantAdmin (tenant-scoped only — no cross-tenant view). Tone: precise, credible,
no emoji, no exclamation marks, no gamified language.

LAYOUT: Render inside AppShell (left Sidebar with Management>Users active, Topbar with
tenant name + search + notifications + profile, Breadcrumb "Home › Users"). Main region:
  - Page header: Fraunces H1 "User Management" + secondary subtitle naming the tenant;
    right cluster = secondary "Import CSV" + primary "Add teacher/student/parent" (label
    follows active tab).
  - Tabs: Teachers · Students · Parents, each with a live count Badge (pill).
  - Toolbar: search Input (leading icon), Status Select (All/Active/Archived), Class
    Combobox filter, Export-view action.
  - DataTable (the shared sortable/filterable/paginated/selectable primitive) with a
    header select-all Checkbox + per-row Checkbox, Avatar+name cell, role-specific columns:
      Teachers: Name, Subjects (Badge chips), Designation, Classes (count), Status, ⋯
      Students: Name, Roll number, Grade, Class(es) (chips), Parents (count), Status, ⋯
      Parents:  Name, Linked children (chips), Status, ⋯
    Status uses an icon+label Badge (Active=status.success, Archived=text.muted) — NEVER
    color alone.
  - Pagination (cursor-based, page-size 25/50/100).
  - A floating, centered BulkActionBar (bg.surface, e3, radius.lg) appears when rows are
    selected: "{n} selected · Archive · Reactivate · Clear".

DIALOGS: Create-user Modal (fields adapt by role; react-hook-form + zod; inline
FormFieldError; NEVER display passwords/credentials), Assign-classes Modal (multi-select
class Combobox), Link-parents Modal (parents Combobox), Edit-parent Modal, two-phase CSV
Import Dialog (FileDrop → dry-run validation Banner with per-row errors → "Import N valid
rows"), and ConfirmDialog for archive/reactivate (with explicit consequence copy).

STATES: skeleton table on load; distinct true-empty (with onboarding CTA) vs filtered-empty
(Clear filters); list-error InlineAlert with Retry; partial import/bulk result Banner;
read-only variant when staff.canManageUsers is false or tenant is suspended.

MOTION (§4 tokens only): tab cross-fade `fast`, bulk-bar slide-in `base`/ease.entrance,
optimistic new-row highlight `slow`; respect prefers-reduced-motion. Safe edits are
optimistic with revert-on-error; destructive/bulk actions are confirm-then-commit.

ACCESSIBILITY: WCAG AA contrast via tokens; full keyboard operation (roving tab list,
checkbox Space toggle, focus-trapped dialogs, visible border.focus ring); status by
icon+label not color; aria-live "{n} selected"; toasts as status/alert.

RESPONSIVE: lg full table; md hides secondary columns + collapses filters into a Popover;
sm turns the table into stacked Cards (Avatar+name, StatusBadge, DefinitionList, ⋯ menu)
and full-width bulk bar. Admin is desktop-first; ⌘K command palette is web-only.

DOMAIN RULES TO RESPECT: hard tenant isolation (tenantId derived server-side, never shown
cross-tenant); credentials never rendered; server-authoritative active⇄archived status;
soft-delete (archive) only; RBAC + bulkImport feature gating hides (not just disables)
actions; show a subtle "access changes may take a moment" note after class reassignment.

Deliver a single responsive React + Tailwind screen using the Lyceum tokens and the §5
components. No new tokens or variants; if something seems missing, note it as a proposed
foundation addition rather than inventing it.
```
