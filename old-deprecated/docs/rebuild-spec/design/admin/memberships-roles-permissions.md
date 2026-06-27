# Memberships, Roles & Permissions — Screen Spec (Admin)

> **Design system:** Lyceum. Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. All colors, type, spacing,
> radius, elevation, motion, and components are cited by their semantic token /
> §5 component name — no raw hex, no invented variants. Register: **admin /
> serious** (restraint in chrome; the playful student register does NOT apply
> here). **Ground truth read:**
> `apps/admin-web/src/components/staff/CreateStaffDialog.tsx`,
> `apps/admin-web/src/guards/RequireAuth.tsx`,
> `docs/rebuild-spec/status/auth-access.md`,
> `docs/rebuild-spec/status/be-identity.md`,
> `docs/rebuild-spec/specs/common-api.md`, and the live membership model in
> `packages/shared-types/src/identity/membership.ts`.

This is the **RBAC surface** for a tenant: the membership model (user ↔ tenant ↔
role), the role catalog, the permission matrix, the role-assignment /
permission-edit UI, and the cross-tenant membership switcher (RoleSwitcher /
Topbar tenant switcher). It is both a _conceptual reference_ (how roles and
permissions are modeled) and a _concrete UI spec_ (how an admin views and edits
them).

---

## 1. Purpose & primary user

**Primary user:** `tenantAdmin` — the administrator of exactly **one** tenant (a
school/org). Job-to-be-done: _"See everyone who has access to my school, what
role and permissions each person holds, and safely change a person's role or
fine-grained permissions — without ever crossing into another tenant or
accidentally locking myself out."_

**Secondary surfaces of the same model (referenced, not the focus):**

- `staff` members with `canManageUsers` may reach a read-only-or-scoped subset
  of this screen (permission-gated — see §5).
- `superAdmin` operates a _different_ control plane (platform-wide,
  cross-tenant) and is **out of scope** for this screen; the only super-admin
  touchpoint surfaced here is conceptual contrast (super-admin is the
  `UnifiedUser.isSuperAdmin` boolean, never a tenant membership row —
  `be-identity.md §1.4`). Any super-admin cross-tenant assignment lives in the
  `super-admin` app, not here.

**Why this matters as one screen:** today role/permission editing is scattered
(e.g. `CreateStaffDialog` toggles `StaffPermissions` only at creation time;
teacher permissions are set elsewhere). This screen unifies _viewing_ the
membership/role/permission model and _editing_ it post-creation, which the live
code does not yet offer in one place.

---

## 2. Entry points & route

**Route (admin-web):** cross-cutting — surfaced as `/access` (primary) with
deep-linkable sub-routes:

- `/access/members` — the membership directory (default tab).
- `/access/members/:uid` — a single member's membership detail + role/permission
  editor (drawer or page).
- `/access/roles` — the role catalog + canonical permission matrix (mostly
  reference).

**Entry points:**

- Sidebar (§5 Sidebar, role-driven from the route manifest) → **Access** nav
  item, visible to `tenantAdmin` and to `staff` with `canManageUsers`.
- Topbar (§5 Topbar) **RoleSwitcher / tenant switcher** → "Manage access for
  this tenant".
- Deep links from the Users/Staff pages ("Edit role & permissions") and from
  `CreateStaffDialog`'s success toast ("View staff member").
- ⌘K CommandPalette (web only): "Change role", "Edit permissions", "Find member
  by email".

**Common-API reads/writes that power it** (cite `specs/common-api.md §3.3`;
`tenantId` is derived server-side from `ctx.activeTenantId` — **never** sent in
the body for a tenant-admin, §4.4):

| Action                                                         | Callable                                                                                                         | Notes                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| List members of this tenant (paginated, filter by role/status) | `v1.identity.searchUsers`                                                                                        | §3.3; uses the unified `PageRequest`/`pageResponse` fragment (§7). Server returns membership-projected rows (no N+1).                                                                                                                                              |
| Read a single member's membership + permissions                | `v1.identity.searchUsers` (single-result) or a `get*` read endpoint wrapping `/userMemberships/{uid}_{tenantId}` | Membership is **read-own / write-never-from-client** in rules (`auth-access.md §1.5`) — UI reads it through the API seam, never via `firebase/firestore`.                                                                                                          |
| Change a member's **role**                                     | `v1.identity.saveStudent` / `saveTeacher` / `saveParent` / `saveStaff` (consolidated upsert with `id`)           | Role-specific upsert; create branch provisions membership+claims via one factory (`be-identity.md §1.4`). A true role _change_ is an admin-initiated re-provision; flag as a **proposed contract addition** below if a single `changeMembershipRole` op is wanted. |
| Edit **teacher** granular permissions                          | `v1.identity.saveTeacher` (with `permissions`)                                                                   | Must pass `permissions` for claims to refresh — see drift note in §8.                                                                                                                                                                                              |
| Edit **staff** granular permissions                            | `v1.identity.saveStaff` (with `staffPermissions`)                                                                | Mirrors `CreateStaffDialog`'s toggle set, post-creation.                                                                                                                                                                                                           |
| Activate / suspend a membership                                | `v1.identity.bulkUpdateStatus` (single id) or `deactivate*` path                                                 | Suspension must `revokeRefreshTokens` (`common-api.md §4.5`, `auth-access.md §4 rec 5`).                                                                                                                                                                           |
| Switch active tenant (multi-tenant admin)                      | `v1.identity.switchActiveTenant` → `{ tenantId }`                                                                | Rebuilds claims for target tenant; client forces `getIdToken(true)` (`be-identity.md §1.4`).                                                                                                                                                                       |
| Role catalog + permission matrix (reference)                   | static contract (`shared-types/identity/membership.ts`) + read                                                   | The matrix is derived from `TeacherPermissions` / `StaffPermissions` keys; no write needed for the catalog itself.                                                                                                                                                 |

> **Proposed contract addition (flag):** a dedicated
> `v1.identity.changeMembershipRole({ uid, toRole, links?, idempotencyKey })`
> that internally re-provisions the entity doc, rewrites the membership, and
> calls `syncMembershipClaims` + `revokeRefreshTokens`. The current
> `save*`-per-role pattern can express it, but a single op makes the role-change
> flow atomic and audit-clean. Not part of the foundation; this is an
> API-contract proposal.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5: Sidebar + Topbar). Page gutters per §4
(desktop 32). Max content width 1200; the matrix table may use the full content
width.

```
┌─ AppShell ─────────────────────────────────────────────────────────────────┐
│ Topbar:  [Tenant switcher ▾ SUB001 · Subhang Academy]   ⌘K   🔔   [Avatar ▾] │
├──────────┬──────────────────────────────────────────────────────────────────┤
│ Sidebar  │  Breadcrumb: Access › Members                                     │
│ (role-   │  ┌ Page header ─────────────────────────────────────────────────┐ │
│  driven) │  │ Memberships, Roles & Permissions            [+ Add member ▾] │ │
│  …       │  │ Manage who has access to Subhang Academy and what they can do.│ │
│  Access ◀│  └──────────────────────────────────────────────────────────────┘ │
│  …       │  ┌ Tabs (§5) ──────────────────────────────────────────────────┐  │
│          │  │ [ Members ]  [ Roles & permissions ]                         │  │
│          │  └──────────────────────────────────────────────────────────────┘ │
│          │  ── Members tab ───────────────────────────────────────────────── │
│          │  Toolbar: [🔎 Search email/name]  [Role ▾ all] [Status ▾ active]  │
│          │           [⤓ Export]                          ⟨bulk-action bar⟩    │
│          │  ┌ DataTable (§5) ─────────────────────────────────────────────┐  │
│          │  │ ☐ │ Member        │ Role        │ Permissions │ Status │ ⋯ │  │
│          │  │ ☐ │ ⬤ Asha Rao    │ [Teacher ▾] │ 5 of 8 ›    │ ●Active│ ⋯ │  │
│          │  │   │   asha@…       │             │ (chips)     │       │   │  │
│          │  │ ☐ │ ⬤ R. Iyer     │ [Staff ▾]   │ 2 of 6 ›    │ ●Active│ ⋯ │  │
│          │  │ ☐ │ ⬤ You (admin) │  Admin 🔒    │ Full        │ ●Active│   │  │
│          │  └──────────────────────────────────────────────────────────────┘ │
│          │  Pagination (§5):  ‹ 1 2 3 ›        20 per page                    │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

**Member detail / editor — Drawer (§5 Drawer/Sheet), right-side, opens over the
table:**

```
┌ Drawer: Asha Rao ───────────────────────────────┐
│ ⬤ Asha Rao   asha@school.com   ●Active          │
│ DefinitionList (§5): UID · Joined · Source ·     │
│   Last active · Linked class IDs                 │
│ ── Role ────────────────────────────────────────│
│   Current role:  [ Teacher ▾ ]   (Select §5)     │
│   InlineAlert (§5) on change: "Changing role     │
│   re-provisions access and signs Asha out."      │
│ ── Permissions (role-scoped) ───────────────────│
│   Teacher:                                       │
│    Create exams        [Switch ●]                │
│    Edit rubrics        [Switch ●]                │
│    Manually grade      [Switch ●]                │
│    View all exams      [Switch ○]                │
│    Create spaces       [Switch ○]                │
│    Manage content      [Switch ○]                │
│    View analytics      [Switch ○]                │
│    Configure agents    [Switch ○]                │
│   Managed classes/spaces: Combobox (§5) chips    │
│ ── Danger zone ─────────────────────────────────│
│   [Suspend membership]  (Button danger §5)       │
│ Footer: [Cancel]            [Save changes]       │
└──────────────────────────────────────────────────┘
```

**Roles & permissions tab — the canonical matrix (DataTable §5, read-mostly):**

```
┌ Permission matrix ───────────────────────────────────────────────┐
│ Permission                  │ Admin │ Teacher │ Staff │ Student │ … │
│ Manage users                │  ●    │   —     │  ◐*   │   —     │   │
│ Create exams                │  ●    │   ◐     │  —     │   —     │   │
│ Edit rubrics                │  ●    │   ◐     │  —     │   —     │   │
│ View analytics              │  ●    │   ◐     │  ◐     │   —     │   │
│ Export data                 │  ●    │   —     │  ◐     │   —     │   │
│ Manage billing              │  ●    │   —     │  ◐     │   —     │   │
│ …                                                                 │
│ Legend: ● always · ◐ grantable per-member · — never              │
└───────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **lg (≥1024, the design target):** full layout above; Drawer is a right sheet
  (≈480px) over the table; matrix is a full-width sticky-header DataTable.
- **md (768–1023):** Sidebar collapses to icons (AppShell behavior); DataTable
  keeps key columns (Member, Role, Status, ⋯); "Permissions" column collapses to
  a "N of M ›" link that opens the Drawer; matrix gains horizontal scroll with a
  sticky first column.
- **sm (<768):** admin is desktop-first (see §10). The table degrades to
  **stacked member cards** (§6 cross-platform rule) — one Card (§5) per member
  with Role select + a "Edit permissions" button that opens the Drawer
  full-screen; the permission matrix becomes a vertically stacked accordion (§5
  Accordion) per role. Bulk selection and Export are hidden below md.

---

## 4. Components used (FOUNDATION §5 only)

- **Navigation:** AppShell, Sidebar (role-driven), Topbar (with tenant
  switcher), Breadcrumb, CommandPalette (⌘K, web-only), **RoleSwitcher** (for
  the multi-tenant/role context — surfaced via the Topbar tenant switcher).
- **Containers:** Section, Tabs, Card (stacked-card fallback on mobile),
  Drawer/Sheet (member editor), Modal/Dialog (re-using the `CreateStaffDialog`
  pattern for "Add member"), Popover (row ⋯ menu), Tooltip (matrix legend,
  permission help), Accordion (mobile matrix).
- **Data:** DataTable (members directory + permission matrix;
  sort/filter/paginate/select), DefinitionList (member metadata), Pagination,
  Avatar / AvatarGroup (member identity), Badge (role + status), Chip/Tag
  (granted-permission chips, managed-class chips), Stat/KPI (optional header
  counts: total members by role), EmptyState, Skeleton.
- **Primitives:** Button (primary "Add member"; secondary; ghost row actions;
  **danger** "Suspend"), IconButton (⋯), Input (search), Select (role picker —
  note: never empty-string value, per Radix Select rule in MEMORY), Combobox
  (managed classes/spaces), Switch (each permission toggle — exactly matching
  `CreateStaffDialog`'s Switch usage), Checkbox (row/bulk select).
- **Feedback:** Toast (sonner — success/error, matching live
  `toast.success`/`toast.error`), InlineAlert/Banner (role-change consequences;
  tenant-isolation reminders), ConfirmDialog (suspend / role change),
  FormFieldError, LoadingOverlay (drawer save).

**No new component variants proposed.** The screen composes entirely from §5.
The "permission matrix" is a DataTable configured for boolean cells (● / ◐ / —
rendered as icon+label, not color alone — see §9), not a new component.

> **One proposed foundation note (not a new component):** the matrix uses three
> glyph states (always / grantable / never). These map to existing tokens —
> `status.success` + check icon (granted/always), `text.secondary` + dash
> (never), `border.strong` outline + dot (grantable). If a reusable
> `PermissionCell` is desired it is a _composition_, not a new primitive;
> flagging it as a candidate domain component if reused across admin +
> super-admin.

---

## 5. States

**Loading (skeleton):** mirror `RequireAuth.tsx`'s skeleton language. On first
load show Sidebar skeleton + a DataTable skeleton: a header row + 8 Skeleton
(§5) rows (`h-8`-ish) with avatar circles and chip placeholders. The Drawer,
when opening before its read resolves, shows a DefinitionList skeleton +
permission-row skeletons. Use `bg.surface-sunken` shimmer; respect
reduced-motion (§9).

**Empty:**

- _No members beyond the admin themselves_ — EmptyState (§5) with Fraunces title
  "Just you so far", body "Add teachers, staff, and students to give them access
  to Subhang Academy.", primary Button "Add member". (Tenant-scoped: a fresh
  tenant always has at least the creating admin's membership.)
- _Filter yields nothing_ — EmptyState "No members match these filters", ghost
  Button "Clear filters".

**Error:**

- _List read fails_ — InlineAlert/Banner (`status.error`, icon + label, never
  color-alone) "Couldn't load members" with a "Retry" Button (global React Query
  error boundary surfaces it; not rendered as an empty state — per
  `common-api.md §6.3`).
- _Save fails_ — Toast error using `error.details.code` → `ERROR_MESSAGES`
  (`common-api.md §6`); the Drawer stays open with optimistic state rolled back
  and FormFieldError on the offending field (e.g. `PERMISSION_DENIED`,
  `TENANT_SUSPENDED`).
- _Cross-tenant attempt_ (should be impossible via UI, but server-authoritative)
  → `PERMISSION_DENIED` toast "You can only manage members of this tenant."

**Partial:** mixed-status roster (active + suspended) renders all rows;
suspended rows are dimmed (`text.muted`) with a `status.warning`/`status.error`
"Suspended" Badge (icon + label). A member whose claims are stale vs. membership
(the documented drift, `auth-access.md §4.2) shows a Tooltip "Access syncing —
changes apply on next sign-in" — surfaced, not silently hidden.

**Success:** new/edited member appears or updates in place (optimistic), with a
brief row highlight (§6) and a success Toast.

**Permission-gated variations by role** (guard = `RequireAuth allowedRoles`,
then server re-checks):

- `tenantAdmin` — full screen: can change any non-self role and any grantable
  permission, can suspend, can add members.
- `staff` with `canManageUsers` — sees the screen but **role Select is
  disabled** for roles above their own scope; can edit student/parent and toggle
  the permissions their `staffPermissions` allow; cannot grant
  `canManageBilling`/`canManageSettings` they don't themselves hold. Editing
  controls they lack render disabled with a Tooltip "Requires Manage settings".
- `staff` without `canManageUsers` / `teacher` / `student` / `parent` — the
  **Access** nav item is absent (role-driven Sidebar); direct navigation hits
  the `RequireAuth` "Access Denied" panel (the exact copy from
  `RequireAuth.tsx`: heading "Access Denied", body "You don't have permission to
  access this page.").
- **Self-row guard:** the admin's own row shows role as a locked Badge ("Admin
  🔒") — the role Select and "Suspend" are disabled with a Tooltip "You can't
  change your own role or suspend yourself" (prevents the self-lockout failure
  mode; mirrors the rules' self-elevation block, `auth-access.md §1.5`).

---

## 6. Interactions & motion (§4 motion tokens)

**Open member editor:** row click or ⋯ → "Edit" opens the Drawer. Drawer slides
in with `ease.entrance` over `base` (220ms); backdrop fades `fast` (160ms).
Reduced-motion → instant with a 1px border, no slide.

**Change role (consequential — confirm, not optimistic):**

1. Admin picks a new role in the Select.
2. An InlineAlert appears inside the Drawer (`status.warning`, icon+label):
   _"Changing Asha to Student re-provisions their access and signs them out of
   all sessions."_
3. "Save changes" opens a ConfirmDialog (§5). Confirm → call the role-change op;
   show LoadingOverlay on the Drawer. On success: Toast, claims refresh
   server-side (`syncMembershipClaims`) + `revokeRefreshTokens` (so the member
   re-auths). Role change is **server-authoritative and not optimistic** because
   it triggers token revocation.

**Toggle a granular permission (optimistic):** flipping a Switch updates the
chip count immediately and queues the save; the Switch animates with `fast`
(160ms). On save failure the Switch springs back to its prior state
(`ease.exit`) and a Toast explains. Permission edits batch into one
`saveTeacher`/`saveStaff` call on "Save changes".

**Suspend membership (danger):** "Suspend" Button (danger) → ConfirmDialog
"Suspend Asha's access? They'll be signed out immediately and can't sign in
until reactivated." Confirm → `bulkUpdateStatus` + `revokeRefreshTokens`; row
updates to suspended (dimmed + Badge). Reactivation is the inverse.

**Add member:** "+ Add member ▾" → menu (Popover) of roles → opens the
role-appropriate Dialog. For staff this is exactly the live `CreateStaffDialog`
(firstName/lastName/email/phone + the six `StaffPermissions` Switches),
preserved verbatim. On success: same Toast copy pattern
(`Staff member {name} created`), Dialog closes, table refetches (`onCreated`).

**Switch tenant (multi-tenant admin):** Topbar tenant switcher →
`switchActiveTenant`; the whole screen re-scopes to the new tenant after the
forced token refresh. A page-level transition uses `page` (420ms) fade; an
InlineAlert confirms "Now managing {tenant}". This is the **only** cross-tenant
motion an admin has — they never edit two tenants at once.

**Row highlight on update:** updated row flashes `bg.surface-sunken` →
`bg.surface` over `slow` (320ms), `ease.standard`. No spark/celebration motion
anywhere on this screen — the marigold `spark` and gamification spring are
reserved for the student register (Foundation §1, §4).

---

## 7. Content & copy (precise admin tone)

- **Page title (Fraunces):** "Memberships, Roles & Permissions"
- **Subtitle:** "Manage who has access to {tenantName} and what they can do."
- **Tabs:** "Members" · "Roles & permissions"
- **Toolbar:** search placeholder "Search by name or email"; filters "Role" /
  "Status"; "Export"
- **Table columns:** "Member", "Role", "Permissions", "Status", (actions ⋯)
- **Permissions cell:** "{n} of {m}" → opens editor. Chips use the human labels
  from the live code, e.g. staff: "Manage Users", "Manage Classes", "View
  Analytics", "Export Data", "Manage Settings", "Manage Billing" (verbatim from
  `CreateStaffDialog`'s `STAFF_PERMISSION_LABELS`); teacher: "Create exams",
  "Edit rubrics", "Manually grade", "View all exams", "Create spaces", "Manage
  content", "View analytics", "Configure agents".
- **Status Badges:** "Active" (`status.success`) · "Inactive" (`text.muted`) ·
  "Suspended" (`status.error`) — always icon + label.
- **Role Badges:** "Admin", "Teacher", "Staff", "Student", "Parent", "Scanner"
  (the `TenantRole` catalog minus `superAdmin`, which is not a tenant
  membership).
- **Role-change alert:** "Changing {name} to {role} re-provisions their access
  and signs them out of all sessions."
- **Suspend confirm:** title "Suspend access?", body "{name} will be signed out
  immediately and can't sign in until you reactivate them.", confirm "Suspend",
  cancel "Keep active".
- **Self-row tooltip:** "You can't change your own role or suspend yourself."
- **Stale-claims tooltip:** "Access syncing — changes apply on next sign-in."
- **Empty (fresh tenant):** title "Just you so far", body "Add teachers, staff,
  and students to give them access to {tenantName}.", CTA "Add member".
- **Empty (filtered):** "No members match these filters." / "Clear filters".
- **Errors:** load → "Couldn't load members. Retry."; save → driven by
  `ERROR_MESSAGES` (e.g. permission "You don't have permission to make this
  change.", suspended-tenant "This tenant is suspended; changes are disabled.").
- **Access-denied (guard):** "Access Denied" / "You don't have permission to
  access this page." (matches `RequireAuth.tsx` verbatim).
- **Matrix legend:** "● always · ◐ grantable per member · — never".

Tone throughout: declarative, no exclamation, no encouragement copy. This is
staff tooling.

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** A `tenantAdmin` sees and edits **only**
   their active tenant's memberships. `tenantId` is never in the request body —
   it's derived from `ctx.activeTenantId` (`common-api.md §4.4`). The server
   denies any cross-tenant write (`auth-access.md §1.6`); the UI never offers a
   cross-tenant selector (that's super-admin territory).
2. **Membership is server-authoritative & client-write-never.**
   `/userMemberships/{uid}_{tenantId}` is `write: if false` in rules; all
   changes flow through callables (`auth-access.md §1.5`). The UI reads through
   the API seam, never `firebase/firestore` directly (`common-api.md §2`).
3. **Custom claims are a cache, not the source of truth.** The membership doc is
   canonical; claims are the JWT projection (`be-identity.md §1.4`). Editing
   role/permission must trigger `syncMembershipClaims` server-side; the UI must
   **not** assume the change is live until token refresh — hence the "Access
   syncing" tooltip and the documented `saveStudent`/`saveTeacher` drift warning
   (`auth-access.md §4.2`): a permission edit that omits
   `permissions`/`staffPermissions` would silently not refresh claims, so the
   editor **always** sends the full permission map on save.
4. **Token revocation on lifecycle change.** Suspend / role change must
   `revokeRefreshTokens(uid)` (`common-api.md §4.5`) so a removed/downgraded
   user can't ride stale claims for ~1h (`auth-access.md §4.4`). This is why
   those actions are confirm-gated and non-optimistic.
5. **RBAC gating is layered.** `RequireAuth` (client guard) is **UX only**; real
   enforcement is rules + callable asserts (`assertTenantAdminOrSuperAdmin`).
   The screen must degrade gracefully if the server denies an action the UI
   optimistically allowed.
6. **`superAdmin` is not a tenant role.** Super-admin =
   `UnifiedUser.isSuperAdmin` boolean, never a membership row
   (`auth-access.md §2`, `be-identity.md §1.4`). The role catalog on this screen
   omits it; granting platform super-admin is impossible from here by design
   (self-elevation of `isSuperAdmin` is blocked in rules).
7. **Self-protection / no self-lockout.** The admin cannot change their own role
   or suspend themselves (UI lock mirrors the rules' self-elevation/self-status
   block).
8. **One role per (user, tenant).** The composite membership key enforces a
   single role per tenant; the UI presents role as a single Select, not
   multi-select. A person can hold _different_ roles in _different_ tenants
   (resolved by the tenant switcher), but only one here.
9. **Quota / tenant-status gating.** If the tenant is suspended/expired
   (`isTenantActive` false), write controls disable with a Banner; reads still
   work (defense-in-depth, `auth-access.md §1.5`, `be-identity.md §1.3`).
10. **Audit logging.** Every role/permission/status change is audited
    server-side (`logTenantAction` → one audit-log collection,
    `common-api.md §9`). The UI may optionally show a Timeline (§5) of recent
    access changes in the Roles tab; the audit write itself is non-blocking and
    server-only.
11. **Answer-key irrelevance note:** no answer-key data appears on this screen;
    not applicable, but the same "server-only, never shown to client" discipline
    that hides answer keys governs membership writes here.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Breadcrumb → Tabs → Toolbar (search → filters → export) →
  bulk-select header checkbox → table rows (each row: select checkbox → role
  Select → permissions link → ⋯) → Pagination. Drawer traps focus; on open,
  focus moves to the Drawer title; on close, focus returns to the triggering
  row/action.
- **Keyboard:** Tabs are arrow-navigable (Radix Tabs); Select / Combobox /
  Switch are fully keyboard-operable (Radix). DataTable sort headers are buttons
  (`Enter`/`Space`). ⌘K palette is keyboard-first (web only). `Esc` closes
  Drawer/Dialog/Popover. Confirm dialogs: default focus on the _safe_ action
  (Cancel / "Keep active") for destructive flows.
- **ARIA:** table uses proper `role=table`/row/cell semantics with `aria-sort`
  on sortable headers; permission Switches have `aria-label` = the permission
  label (matching the visible Label, as in `CreateStaffDialog`'s `htmlFor`/`id`
  pairing); status Badges expose text (not color) to AT; the matrix cells have
  `aria-label` like "Create exams: grantable for Teacher". Drawer =
  `role=dialog` with `aria-labelledby` the member name. Live region announces
  optimistic toggles and save results.
- **Contrast:** all text/badge pairs meet AA per Foundation §2 (4.5:1 body, 3:1
  UI). Role/status/matrix states are **never color-alone** — always icon + text
  label (status Badge = colored dot **and** word; matrix = glyph ●/◐/— **and**
  legend). This is a hard Foundation rule (§2.3).
- **Reduced motion:** `prefers-reduced-motion` removes drawer slide,
  row-highlight flash, and Switch spring-back animation — state changes are
  instant with a static border/affordance. No parallax, no gamification motion
  exists here anyway.
- **Touch:** ≥44px targets (Foundation §4) on the mobile stacked-card fallback
  (Switches, role Select, buttons).

---

## 10. Web ↔ mobile divergence

**Admin is primarily web / desktop.** This screen is designed and optimized for
`admin-web` at **lg** and up; that is the canonical experience. Statement of
intent: a tenant admin manages access from a desktop console.

- **⌘K CommandPalette is web-only** (Foundation §6) — no command palette on any
  mobile rendering.
- **No native admin app.** If admin is ever reached on a phone browser, the
  responsive fallbacks in §3 apply: DataTable → **stacked Cards** (one per
  member), permission matrix → **Accordion** per role, bulk-select / Export
  hidden below `md`, Drawer becomes a full-screen Sheet. Hover affordances (row
  ⋯ reveal, tooltips) become **press/tap** (Foundation §6).
- **RoleSwitcher relevance:** the merged-mobile-apps **RoleSwitcher** (§5) is
  conceptually the same model this screen edits — a user with multiple
  memberships switches role/tenant context. On the admin-web Topbar it appears
  as the tenant switcher; on a hypothetical mobile shell it's the RoleSwitcher.
  Both call `switchActiveTenant`. Component **names/props match 1:1** between
  `shared-ui` (web) and `ui-native` (mobile) per Foundation §6; only the
  renderer differs.
- **Parity contract:** Sidebar, Topbar, DataTable, Drawer, Switch, Select, Badge
  all have 1:1 native counterparts; the only true divergence is the command
  palette (web-only) and table→cards layout.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE admin screen for Auto-LevelUp ("Lyceum" design system).
Read and conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md — use ONLY its
semantic color tokens, Fraunces/Schibsted Grotesk/Spline Sans Mono type, the §4
spacing/radius/elevation/motion scales, and the §5 component inventory. Invent NO new
colors, fonts, radii, shadows, motion, or component variants. Cite tokens by semantic
name (brand.primary, bg.surface, status.error, text.muted, etc.). Register = ADMIN /
SERIOUS: restrained chrome, NO spark/marigold gamification, no celebratory motion.

SCREEN: "Memberships, Roles & Permissions" for a tenantAdmin (one tenant only).
Route: /access with tabs Members and "Roles & permissions". Render inside AppShell
(Sidebar + Topbar with tenant switcher; Breadcrumb).

BUILD:
1) Members tab: a DataTable (avatar+name+email, Role as an inline Select, a "N of M ›"
   permissions link, a Status Badge [Active/Suspended/Inactive — icon+label, never
   color-alone], row ⋯ menu). Toolbar: search, Role filter, Status filter, Export.
   Pagination. The signed-in admin's own row shows role as a locked "Admin 🔒" Badge
   with disabled controls (no self-lockout). EmptyState "Just you so far" for a fresh
   tenant; skeleton loading mirroring an 8-row table.
2) Member editor: a right-side Drawer with a DefinitionList (UID, joined, source,
   last active, linked classes), a Role Select that shows an InlineAlert warning on
   change ("re-provisions access and signs them out"), and role-scoped permission
   Switches. Teacher perms: Create exams, Edit rubrics, Manually grade, View all exams,
   Create spaces, Manage content, View analytics, Configure agents. Staff perms:
   Manage Users, Manage Classes, View Analytics, Export Data, Manage Settings,
   Manage Billing. A danger-zone "Suspend membership" Button. Footer Cancel / Save.
3) "Roles & permissions" tab: a read-mostly permission matrix DataTable
   (rows = permissions, columns = Admin/Teacher/Staff/Student) with glyph states
   ● always · ◐ grantable · — never (icon + legend, NOT color-alone).

RULES TO REFLECT VISUALLY:
- Tenant isolation: no cross-tenant selector anywhere (that's super-admin, out of scope).
- superAdmin is NOT a tenant role — omit it from the catalog.
- Role change / suspend = consequential: confirm dialog, non-optimistic, "signs them out".
- Permission toggles = optimistic with spring-back on failure.
- Stale-claims tooltip "Access syncing — changes apply on next sign-in".
- staff-with-canManageUsers see a reduced, permission-gated version; everyone else hits
  an "Access Denied" panel.

STATES: loading (skeleton), empty (fresh + filtered), error (banner with Retry; toasts
from an error-code map), partial (mixed active/suspended), success (row highlight + toast).

A11Y: WCAG AA, full keyboard, focus trap in Drawer, aria-sort on headers, status by
icon+label never color, respect prefers-reduced-motion. Touch targets ≥44px on the
mobile stacked-card fallback (table→cards, matrix→accordion; ⌘K is web-only).

Match the live code: reuse the CreateStaffDialog pattern (firstName/lastName/email/phone
+ 6 staff permission Switches) for "Add staff", and the RequireAuth "Access Denied"
copy verbatim. Desktop-first (lg) is canonical.
Output clean React + Tailwind reading Lyceum tokens via CSS custom properties; use the
§5 component names (AppShell, DataTable, Drawer, Select, Switch, Badge, EmptyState,
Skeleton, Toast, ConfirmDialog, InlineAlert).
```
