# Staff Management — Design Spec

> **Area:** admin-web (Tenant / Academy Admin console) · **Route:** `/staff` ·
> **Role:** `tenantAdmin` Conforms to **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens cited by semantic
> name; no new colors/fonts/spacing/radii/motion are introduced except where
> explicitly flagged as a **proposed foundation addition**. Register: the
> **serious/admin** register — restraint in chrome, precision-instrument tone,
> _no_ student-facing playfulness, _no_ marigold spark celebration. This is
> permission-granting tooling: the visual language must read as **deliberate and
> accountable**.

---

## 1. Purpose & primary user

**Primary user:** `tenantAdmin` (school / academy administrator), scoped to
exactly **one** tenant.

**Job-to-be-done:** _"Give me one place to control everyone who runs my school
but isn't a student — the teachers and the administrative staff — so I can
invite new people, see who can do what, grant or revoke individual capabilities,
and deactivate someone who has left, without ever touching another school's
people or being able to over-grant beyond what I myself hold."_

Concretely this screen lets the admin:

- See the tenant's **non-student staff** split into two cohorts via Tabs:
  **Teachers** (instructional staff, with `TeacherPermissions`) and **Staff**
  (administrative staff: coordinators, office admins, with `StaffPermissions`).
- **Invite / create** a new administrative staff member (`CreateStaffDialog`):
  name, email, phone, and an initial permission grant.
- **Search** within each cohort by name or email.
- See at a glance, per person: **status** (active / inactive / suspended) and a
  **permission count** ("3/8 permissions").
- **Edit the permission grant** for a teacher or staff member via a toggle
  dialog.
- **Deactivate / reactivate** a staff member (status transition), severing or
  restoring their access.

This is the admin's **people-and-capabilities control surface** for staff. It is
the _application_ of the roles model (the canonical permission matrix lives in
the separate roles-model spec); this screen is where an admin _operates_ it for
real humans. It is **not** the Users page (`/users`, which owns Students/Parents
and bulk import), and it is **not** a learning surface — no XP, streaks,
mastery, grades, or spark accents appear here.

> **Scope note — Teachers appear in two places.** Teachers are created/imported
> on `/users` (Teachers tab + bulk import); `/staff` is where their
> _permissions_ are edited. This spec preserves that division (matching today's
> `StaffPage` Teachers tab being permission-only with a pointer to `/users`)
> while owning the full lifecycle for administrative **Staff** (create →
> permission → deactivate).

---

## 2. Entry points & route

**Route:** `/staff` (declared in `apps/admin-web/src/App.tsx`, lazy-loaded).
Rendered inside `AppLayout` → `AppShell`. Sits in the sidebar **Configuration**
nav group (governance/access tooling), distinct from the **Management** group
that holds Users/Classes.

**Entry points:**

- Sidebar → **Configuration** nav group → "Staff & Permissions" (active-nav uses
  `brand.primary`).
- From `/users` Teachers tab → "Manage permissions" deep-link (cross-reference
  to a teacher row's permission editor here).
- `⌘K` Command Palette → "Go to Staff" / "Invite staff member" / "Edit
  permissions for {name}" (web only — see §10).
- Onboarding follow-up nudge ("Invite the people who help you run the school").

**Common-API reads/writes that power it** (per `specs/common-api.md`; today's
live code shown in the right column where the rebuild renames or relocates the
call). `tenantId` is **derived server-side from `ctx.activeTenantId`** (claim)
for a normal tenant-admin call and is **not** sent in the request body
(common-api §4.4). Critically, today's `StaffPage`/`StaffTab` read the **global
`userMemberships` collection from the browser** and filter by tenant in memory —
a perf + rules-surface concern flagged in app-admin-web §4.13 and auth-access
§4. The rebuild moves both the entity list and the membership/permission join
**server-side** behind read endpoints.

| Action                            | Rebuild callable (`api-contract`)                                                                                                                                 | Today (live code)                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| List teachers + their permissions | `v1.identity.listTeachers` _(new read endpoint; server joins membership permissions — replaces direct `tenants/{t}/teachers` + global `userMemberships` reads)_   | `useTeachersList` (Firestore `tenants/{t}/teachers`) + `useMemberships` (global `userMemberships where tenantId==,role=='teacher'`) |
| List staff + their permissions    | `v1.identity.listStaff` _(new read endpoint; server-side membership join)_                                                                                        | `useStaffList` (Firestore `tenants/{t}/staff`) + `useStaffMemberships` (global `userMemberships where role=='staff'`)               |
| Invite / create staff             | `v1.identity.createOrgUser` (`role:'staff'`, saga + idempotency key; provisions Auth user + `tenants/{t}/staff/{id}` entity + membership + claims in one factory) | `callCreateOrgUser({ role:'staff', firstName, lastName, email, phone })`                                                            |
| Edit teacher permissions          | `v1.identity.saveTeacher` (`data.permissions: TeacherPermissions`; **must** call `syncMembershipClaims`)                                                          | `callSaveTeacher({ id, tenantId, data:{ permissions } })`                                                                           |
| Edit staff permissions            | `v1.identity.saveStaff` (`data.staffPermissions: StaffPermissions`; **must** call `syncMembershipClaims`)                                                         | `callSaveStaff({ id, tenantId, data:{ staffPermissions } })`                                                                        |
| Deactivate / reactivate staff     | `v1.identity.saveStaff` (`data.status: 'inactive'                                                                                                                 | 'active'`) → suspends/restores membership + **`revokeRefreshTokens(uid)`\*\*                                                        | _(not implemented today — proposed; see §5/§8)_ |

> **Rebuild improvements to surface in the spec:**
>
> 1. **Reads move behind the API seam.** No browser ever reads the global
>    `userMemberships` collection. `listTeachers`/`listStaff` return each person
>    already joined with their effective permission map, so the client renders
>    directly without a client-side `uid → membership` lookup (today's
>    `getMembershipForTeacher`/`getMembershipForStaff`). This kills the
>    `staff.uid` / `teacher.uid` dual-read fragility (the deprecated `uid` vs
>    `authUid` drift noted in app-admin-web §4.9).
> 2. **Claims sync on every permission/status change.** A permission edit or
>    deactivation must call the single `syncMembershipClaims(uid, tenantId)`
>    primitive and, on deactivate, `revokeRefreshTokens(uid)` (auth-access
>    §4.4/rec 3 & 5) — closing the ~1h stale-claim window so a revoked
>    capability stops working immediately, not at next token refresh.
> 3. **List endpoints use the unified pagination fragment**
>    (`PageRequest`/`pageResponse`, common-api §7) for large tenants; small
>    tenants keep the client-side search/filter fast path.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent **Sidebar**
(role-driven nav, "Staff & Permissions" active in the _Configuration_ group) +
**Topbar** (tenant name/switcher, `⌘K` search, `NotificationBell`,
`RoleSwitcher`, `ThemeToggle`, profile). A `QuotaWarningBanner` may sit above
the page region when the tenant nears a seat/staff limit. The content region
sits on `bg.canvas`; each person row sits in a `Card`/list-row on `bg.surface`.

The page is **Tabs**-based (`Teachers` | `Staff`), preserving today's structure.
Each tab is a search bar + a row list + a permission editor `Dialog`; the Staff
tab additionally has an **Invite Staff** primary action and a Create dialog.

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar  │  Topbar: [Tenant ▾]      ⌘K Search        🔔  [Role ▾]  ☼  (avatar) │
│ (Config: │──────────────────────────────────────────────────────────────────── │
│  Staff   │  Breadcrumb:  Home / Staff & Permissions                             │
│  active) │                                                                      │
│          │  ┌─ Page header ───────────────────────────────────────────────┐    │
│          │  │ H1  Staff & Permissions                                      │    │
│          │  │ sub  Invite teachers and administrators and control what     │    │
│          │  │      each person can do in your school.                      │    │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │                                                                      │
│          │  ┌─ Tabs ──────────────────────────────────────────────────────┐    │
│          │  │ [ Teachers ]  [ Staff ]                                       │    │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │                                                                      │
│          │  ── Staff tab shown ───────────────────────────────────────────     │
│          │  ┌─ Toolbar ───────────────────────────────────────────────────┐    │
│          │  │ [🔍 Search staff by name or email…   ]      [ + Invite Staff ]│   │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │                                                                      │
│          │  ┌─ Person row (Card, e1) ─────────────────────────────────────┐    │
│          │  │ (avatar)  Jane Doe   [● Active]                              │    │
│          │  │            jane@school.com · Admissions · 🔐 3/6 permissions │    │
│          │  │                                  [ 🛡 Permissions ]   [ ⋯ ]  │    │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │  ┌─ Person row ────────────────────────────────────────────────┐    │
│          │  │ (avatar)  Sam Lee    [○ Inactive]                           │    │
│          │  │            sam@school.com · Front Office · 🔐 0/6           │    │
│          │  │                                  [ 🛡 Permissions ]   [ ⋯ ]  │    │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │  …                                                                   │
└──────────┴──────────────────────────────────────────────────────────────────────┘

   ── Permission editor Dialog (e3, opens over the row) ──────────────
   ┌───────────────────────────────────────────────────────────┐
   │ Edit Permissions — Jane Doe                            [✕] │
   │ Toggle what this staff member can do in your school.       │
   │ ───────────────────────────────────────────────────────── │
   │  Manage Users            ……………………………………………  [ ⛌——● ]   │
   │  Manage Classes          ……………………………………………  [ ●——⛌ ]   │
   │  View Analytics          ……………………………………………  [ ⛌——● ]   │
   │  Export Data             ……………………………………………  [ ●——⛌ ]   │
   │  Manage Settings         ……………………………………………  [ ●——⛌ ]   │
   │  Manage Billing          ……………………………………………  [ ●——⛌ ]   │
   │ ───────────────────────────────────────────────────────── │
   │                              [ Cancel ]  [ Save Permissions ]│
   └───────────────────────────────────────────────────────────┘
```

**Grid & spacing:** content max-width 1200; desktop page gutter 32 (`space.8`).
Vertical rhythm header → tabs → toolbar → list uses `gap` 24 (`space.6`); the
row list uses `gap` 8 (`space.2`) between rows (matching today's `space-y-2`).
Each person `Card` pads 16 (`space.4`). The Tabs list is capped to a compact
width (two equal triggers), left-aligned. Toolbar is a flex row, search grows to
fill, **Invite Staff** pinned right.

**Person row anatomy (left→right):** Avatar (initials) · name (Schibsted 500) +
status `Badge` inline · meta line (`text.secondary`): email ·
department/subjects · permission count in `Spline Sans Mono` ("3/6") · trailing
actions: **Permissions** `secondary` Button (shield icon) + **⋯ overflow
IconButton** (Deactivate / Reactivate / Copy invite link). On the **Teachers**
tab the meta line shows **subjects** instead of department, and the count is
"{n}/8" (teacher permission set); there is no Invite button (teachers are
created on `/users`).

**Responsive:**

- **lg (≥1024):** rows are single-line with trailing inline actions as drawn.
  Sidebar expanded.
- **md (768–1023):** sidebar collapses to icon rail (AppShell behavior); rows
  keep one line but the meta line may wrap; the **Permissions** Button label may
  reduce to its shield icon with a Tooltip.
- **sm (<768):** admin is desktop-first (see §10). Each person becomes a taller
  stacked `Card`: avatar + name + status on row one, meta as a small
  `DefinitionList`, and a full-width **Permissions** Button with the **⋯**
  beside it. The permission editor Dialog becomes a bottom **Drawer/Sheet**. The
  **Invite Staff** action moves into the sticky header.

---

## 4. Components used (from FOUNDATION §5 only)

**Navigation:** AppShell, Sidebar, Topbar, Breadcrumb, Tabs (Teachers | Staff),
CommandPalette (⌘K, web-only).

**Containers:** Card (person rows + sm stacked cards), Section (page header),
Tabs/TabsList/TabsTrigger/TabsContent (cohort switch), Modal/Dialog (Invite
Staff, Permission editor), Drawer/Sheet (sm permission editor), Popover (row ⋯
overflow menu), Tooltip (icon-only controls, disabled-control reasons).

**Primitives:** Button (`primary` = Invite Staff & dialog "Create"/"Save
Permissions" confirm; `secondary` = Permissions/Cancel; `danger` = Deactivate
confirm), IconButton (row ⋯ overflow, clear-search), Input (search +
name/email/phone fields), Switch (per-permission toggle in both the Create and
Edit dialogs — the core control of this screen), Label (each permission row +
form fields), Avatar (person initials).

**Data:** EmptyState (cold-start "No staff members" / "No teachers found"),
Skeleton (row-list skeleton — header-less 16px-tall rows matching today's
`Skeleton h-16`), Badge (status: Active / Inactive / Suspended), Chip/Tag
(subjects on teacher rows, optional permission-summary chips), DefinitionList
(sm stacked-card meta), Avatar/AvatarGroup, Stat/KPI (optional header summary:
"{n} active staff" / "{n} pending invites").

**Feedback:** Toast (sonner) for success/failure (today: "Permissions updated",
"Staff member {name} created"), ConfirmDialog (Deactivate / Reactivate —
`role="alertdialog"`), InlineAlert/Banner (list-load failure; "you cannot grant
more than you hold" guard — see §8), LoadingOverlay (dialog submit),
FormFieldError (Invite form validation).

**Domain components:** **none of the assessment/gamification domain components
apply.** `AnswerKeyLock`, `GradePill`, `ConfidenceBadge`, `XPMeter`,
`StreakFlame` are _deliberately absent_ — this is governance tooling.

### Proposed foundation additions (flag)

1. **`PermissionToggleList`** — the labelled `Switch`-row stack used identically
   in both the Create dialog and the Edit dialog (label left, Switch right,
   repeated per permission key). It already exists as ad-hoc markup in three
   places today (`StaffPage`, `StaffTab`, `CreateStaffDialog`) and should be
   formalized in §5 as a **composition of Label + Switch + Section** rather than
   a new primitive, so it inherits Switch/Label tokens (radius pill on the
   track, `border.subtle`, focus ring `border.focus`). Recommend it carry an
   optional `disabled` + Tooltip per row to express the "can't grant beyond your
   own permissions" guard (§8).
2. **`PersonRow` (StaffRow)** — the avatar + name + status `Badge` + meta +
   trailing-actions row. Reused across Staff and Teachers (and structurally
   close to the Users page member rows). Recommend formalizing in §5 Data as a
   **list-row variant of Card** (not a DataTable row, since there is no
   multi-column sort/select here) so Users/Staff share one row component. Until
   then it is a `Card` composed from Avatar + Badge + Buttons.
3. **Status `Badge` semantic mapping** — three statuses (`active` →
   `status.success`, `inactive` → `text.muted`/neutral, `suspended` →
   `status.warning`), each **icon + label**, never color-alone. This uses
   existing semantic tokens; flag only that `STATUS_VARIANT` (today in
   `src/lib/constants.ts`) should map all three and not collapse
   inactive/suspended into a single "secondary".

---

## 5. States

All states render inside the active tab's region so switching tabs and loading
don't jump layout.

**Loading (skeleton):** a stack of 3–5 `Skeleton` rows (`h-16`, full width,
`bg.surface`, `radius.lg`) matching the person-row height. No spinner. The
search Input and Invite button render present but disabled. (Today:
`Array.from({length:3|5}).map(() => <Skeleton h-16 />)`.)

**Empty (cold start — no staff at all):** centered `EmptyState` in a
dashed-border panel (`border.strong`, dashed):

- Icon: a neutral people/user-cog glyph (`text.muted`).
- Title (Fraunces): `No staff members`.
- Body (`text.secondary`):
  `Invite administrators and coordinators to help you run your school.`
- Primary action: **+ Invite Staff** (mirrors today's in-empty-state CTA).
- _Teachers tab cold start_ is distinct: title `No teachers found`, body
  `Add teachers on the Users page, then manage their permissions here.`, with a
  **Go to Users** secondary Button (no Invite here — teachers aren't created on
  this screen).

**Empty (filtered to zero):** distinct copy — `No staff match "{query}".` with a
**Clear search** `ghost` Button. Never reuse the cold-start empty state for a
filtered-out result.

**Error (list read failed):** `InlineAlert` (`status.error`, paired with an
error icon + text — never color alone) inside the tab region:
`Couldn't load staff.` + **Retry** Button (re-invokes
`listStaff`/`listTeachers`). The global React Query error boundary catches
unhandled cases (common-api §6.3); this screen prefers the inline retryable
form. `useApiError().handleError` already surfaces the server `message`.

**Partial:** rare here (the rebuild returns each person pre-joined with
permissions). If a person row's permission join is missing (legacy membership
absent / `uid` unlinked), the count renders `— permissions` (em-dash,
`text.muted`) with a Tooltip "Permissions unavailable for this account" rather
than a misleading "0/6", and the Permissions editor opens with all toggles at
their server defaults plus a non-blocking `InlineAlert` noting the membership
could not be resolved.

**Success:** populated person list; status `Badge`s and permission counts shown;
Permissions opens the editor; ⋯ offers Deactivate/Reactivate; Invite opens the
Create dialog.

**Permission-gated variations by role:**

- `tenantAdmin` (the primary, in-scope role): full invite / edit-permissions /
  deactivate.
- `staff` **with `canManageUsers`** (if a staff user reaches this route): may
  **view** the list and **edit a _subset_ of permissions they themselves hold**
  (the "no privilege escalation" guard, §8); **Invite Staff**, **Deactivate**,
  and any toggle they don't hold are `disabled` with a Tooltip ("Requires the
  Manage Users permission" / "You can't grant a permission you don't have").
  `staff` **without** `canManageUsers` are not given this route in nav and are
  redirected.
- `teacher` / `student` / `parent`: **never reach this route** — `RequireAuth`
  (`allowedRoles={["tenantAdmin"]}`, plus `staff`+`canManageUsers` in the
  rebuild) redirects to an Access-Denied panel.
- `superAdmin`: bypasses (cross-tenant) but operates from the super-admin
  control plane, not here.
- **Self-guard:** the currently signed-in admin **cannot deactivate their own
  account** from this screen and cannot remove their own
  `canManageUsers`-equivalent capability (the ⋯ Deactivate is `disabled` on
  their own row with a Tooltip "You can't deactivate your own account").
  Prevents lock-out.
- **Seat/quota gating:** if the tenant has hit a staff-seat limit, **Invite
  Staff** is `disabled` with a Tooltip + a `QuotaWarningBanner`. The button is
  never silently removed.

---

## 6. Interactions & motion (§4 motion tokens)

**Switch tab (Teachers ↔ Staff):** Tabs content cross-fades (`fast 160ms`,
`ease.standard`); the active trigger underline/indicator slides (`base 220ms`).
Search query and scroll reset per tab.

**Invite staff:** Click **+ Invite Staff** → `Modal/Dialog` enters (overlay
fade + content scale/slide, `base 220ms`, `ease.entrance`). Fields: First Name
(required), Last Name (required), Email (required, validated), Phone (optional),
then a **PermissionToggleList** of the 6 `StaffPermissions` (all default off per
`DEFAULT_STAFF_PERMISSIONS` except `canViewAnalytics`, which defaults on).
Confirm ("Create Staff") is `disabled` until First/Last/Email are present and
email is valid. On submit → Button shows "Creating…" + `LoadingOverlay`; on
success → dialog exits (`fast 160ms`, `ease.exit`), success Toast
`Staff member {first} {last} invited`, new row appears. **No optimistic insert**
— `createOrgUser` is a server saga (Auth user + entity + membership + claims,
idempotency-keyed); the list invalidates the narrow `staffKeys.list()` scope and
refetches.

**Edit permissions:** Click **Permissions** (or ⋯ → Edit permissions) → Dialog
enters; toggles are pre-seeded from the person's **server-returned** permission
map. Each `Switch` flips `instant 100ms`. Toggling a permission the admin does
not themselves hold is blocked (disabled Switch + Tooltip, §8). **Save
Permissions** → "Saving…" → `saveTeacher`/`saveStaff` → `syncMembershipClaims`
server-side → on success dialog exits, Toast `Permissions updated`. The
permission count on the row updates **after server confirm** (not optimistically
— claims and effective permissions are server-authoritative). Cancel/`Esc`
closes with no write.

**Deactivate staff:** ⋯ → **Deactivate** → `danger` ConfirmDialog
(`role="alertdialog"`) quoting the person's name: consequence text "{name} will
lose access immediately and their sessions will be signed out." Confirm →
"Processing…" → `saveStaff({ status:'inactive' })` which suspends the membership
**and revokes refresh tokens** (immediate, not deferred). On success the row's
status `Badge` flips to **Inactive** and the Toast reads `{name} deactivated`.
**Reactivate** mirrors this (status → active, no token revocation needed) with a
non-destructive ConfirmDialog. **No optimistic status flip** — it's an audited,
server-authoritative state-machine transition.

**Search / filter:** Typing debounces (`~250ms`) then filters the current tab
(client-side for small tenants; re-queries for paginated tenants). Row count
updates with a subtle `fast` cross-fade — no layout jump. **Clear search**
resets.

**Copy invite link (optional ⋯ action):** copies the staff member's
first-sign-in / set-password link to the clipboard with a Toast
`Invite link copied` — useful for a freshly invited member who hasn't received
email.

**Reduced motion:** all of the above degrade to instant opacity-only transitions
under `prefers-reduced-motion` (§4). **No spring, no marigold burst anywhere** —
gamification celebration is reserved for the student register and must never
appear in admin chrome, least of all on a permission screen.

---

## 7. Content & copy (precise admin tone)

**Page header**

- H1: `Staff & Permissions`
- Subtitle:
  `Invite teachers and administrators and control what each person can do in your school.`

**Tabs**

- `Teachers` · `Staff`

**Toolbar**

- Search placeholder (Staff): `Search staff by name or email…`
- Search placeholder (Teachers): `Search teachers by name or email…`
- Primary CTA (Staff tab only): `+ Invite Staff`

**Person row**

- Status `Badge`: `Active` · `Inactive` · `Suspended` (label + color + icon).
- Permission count: `{n}/{total} permissions` rendered with the
  numerator/denominator in `Spline Sans Mono`.
- Action Button: `Permissions` (shield icon).
- Overflow (⋯): `Edit permissions` · `Deactivate` (or `Reactivate`) ·
  `Copy invite link`.

**Invite Staff dialog**

- Title: `Invite Staff Member`. Description:
  `Create an administrative staff account for your school. They'll be able to sign in with their email.`
- Field labels: `First Name *` · `Last Name *` · `Email *` (placeholder
  `name@school.com`) · `Phone` (placeholder `+91 98765 43210`).
- Permissions section label: `Permissions` with helper
  `Grant only what this person needs. You can change these any time.`
- Buttons: `Cancel` / `Create Staff` (→ `Creating…`).
- Validation: `First name, last name, and email are required.` ·
  `Enter a valid email address.`

**Permission editor dialog**

- Title: `Edit Permissions — {name}`. Description (Staff):
  `Toggle what this staff member can do in your school.` Description (Teachers):
  `Toggle what this teacher can do.`
- Staff permission labels (`StaffPermissions`): `Manage Users` ·
  `Manage Classes` · `View Analytics` · `Export Data` · `Manage Settings` ·
  `Manage Billing`.
- Teacher permission labels (`TeacherPermissions`): `Create Exams` ·
  `Edit Rubrics` · `Manually Grade` · `View All Exams` · `Create Spaces` ·
  `Manage Content` · `View Analytics` · `Configure AI Agents`.
- Disabled-toggle Tooltip (escalation guard):
  `You can't grant a permission you don't have.`
- Buttons: `Cancel` / `Save Permissions` (→ `Saving…`).

**Confirmations**

- Deactivate title: `Deactivate {name}?` Body:
  `{name} will lose access to your school immediately and any active sessions will be signed out. You can reactivate them later.`
  Confirm: `Deactivate` (danger) / `Cancel`.
- Reactivate title: `Reactivate {name}?` Body:
  `{name} will regain access with their previous permissions.` Confirm:
  `Reactivate` / `Cancel`.

**Empty states**

- Staff cold start: title `No staff members` — body
  `Invite administrators and coordinators to help you run your school.` +
  `+ Invite Staff`.
- Teachers cold start: title `No teachers found` — body
  `Add teachers on the Users page, then manage their permissions here.` +
  `Go to Users`.
- Filtered-empty: `No {staff|teachers} match "{query}".` + `Clear search`.

**Errors / toasts**

- List error: `Couldn't load staff.` / `Couldn't load teachers.` + `Retry`.
- Success: `Staff member {first} {last} invited` · `Permissions updated` ·
  `{name} deactivated` · `{name} reactivated` · `Invite link copied`.
- Failure: `Failed to invite staff member` · `Failed to update permissions` ·
  `Failed to update status` — with description `Please try again` or the server
  `message` (via `useApiError`).
- Quota:
  `You've reached your plan's staff-seat limit. Contact your account owner to add more.`

Tone rule: declarative, operational, accountable. No exclamation marks, no
second-person cheerleading. "Invite", "grant", "revoke", "deactivate" — verbs an
administrator expects on an access-control screen.

---

## 8. Domain rules surfaced

- **Tenant isolation (hard rule).** Every staff/teacher entity lives at
  `/tenants/{tenantId}/{staff|teachers}/{id}`, and their membership at
  `/userMemberships/{uid}_{tenantId}`. The list is implicitly scoped to
  `ctx.activeTenantId` from the caller's claim — `tenantId` is **not** a
  client-chosen filter and is never in the request body for a tenant-admin
  (common-api §4.4). A `tenantAdmin` can never see, invite, permission, or
  deactivate another tenant's people; `RequireAuth` additionally asserts
  `currentMembership.tenantId === currentTenantId`. The rebuild specifically
  **stops reading the global `userMemberships` collection from the browser**
  (today's cross-tenant `where('tenantId','==',...)` query) — that join is
  server-side, so no other tenant's membership IDs ever reach the client.
- **RBAC gating + server enforcement.** Route is
  `allowedRoles={["tenantAdmin"]}` (plus `staff` with `canManageUsers` in the
  rebuild). Every mutation re-checks authorization server-side
  (`assertTenantAdminOrSuperAdmin` for identity callables); the UI's
  hidden/disabled controls are UX only — rules + callables are the real
  enforcement.
- **No privilege escalation (key rule on this screen).** An admin/staff user may
  only grant permissions **they themselves hold or below**; the server must
  reject a `saveStaff`/`saveTeacher` that would grant a capability the caller
  lacks. The UI mirrors this by **disabling** toggles the caller doesn't hold
  (Tooltip "You can't grant a permission you don't have"). Granting "Manage
  Billing" or "Manage Users" cannot be used by a sub-admin to exceed their own
  grant.
- **Claims are server-authoritative and re-synced on change.** Permission and
  status edits write the membership doc and call the single
  `syncMembershipClaims(uid, tenantId)` primitive (auth-access rec 3), so the
  JWT permission map stays consistent. The permission **count and effective
  grants shown on each row are server-returned** — the UI never computes "what
  this person can do" as truth locally.
- **Immediate revocation on deactivate.** Deactivation suspends the membership
  **and calls `revokeRefreshTokens(uid)`** (auth-access rec 5), closing the ~1h
  stale-claim window. The copy ("signed out immediately") reflects a real server
  guarantee, not a soft soon-ish.
- **Create is a server saga (idempotent).** `createOrgUser` provisions the Auth
  account, the `staff` entity, the membership, and claims
  atomically/idempotently (idempotency key, common-api §9) — the client never
  creates an Auth user or membership directly, and a retried Invite does not
  create duplicates.
- **Soft lifecycle, not destructive delete.** Staff are deactivated (status
  `active → inactive`), reversible via reactivate — there is **no hard-delete**
  of a person exposed here. Status transitions go through the server state
  machine and are audited.
- **Audit logging.** Every mutating action (invite, permission grant/revoke,
  deactivate/reactivate) writes to the tenant audit log server-side (common-api
  §9). Granting access is exactly the kind of action that must be accountable.
- **Quota / seat enforcement.** Inviting staff is subject to plan seat limits
  (`TenantUsage`/`TenantSubscription`); the Invite button reflects quota state
  and a `QuotaWarningBanner` surfaces near-limit/over-limit.
- **No assessment data.** Answer keys, rubrics, grades, and confidence values do
  not appear and have no code path here (answer-key isolation is enforced
  platform-wide regardless). This screen never renders student-facing
  gamification.

---

## 9. Accessibility (WCAG AA)

- **Contrast:** all text/background pairs meet AA (4.5:1 body, 3:1 large/UI)
  using Lyceum semantic tokens. **Status is never color-alone:** each status
  `Badge` pairs a label ("Active"/"Inactive"/"Suspended") with an icon and
  color; the permission count is text, not a colored dot. The permission
  `Switch` exposes its on/off state to assistive tech via `role="switch"` +
  `aria-checked`, not by track color alone.
- **Focus order:** Skip-to-content → Sidebar → Topbar → page H1 → Tabs
  (Teachers/Staff) → search → Invite Staff → first person row (Permissions → ⋯)
  → … → end. Dialogs/Sheets **trap focus**, return focus to the invoking control
  on close, and `Esc` cancels. The destructive Deactivate ConfirmDialog defaults
  focus to **Cancel**, not the destructive action.
- **Keyboard:** every action reachable without a pointer. Tabs are arrow-key
  navigable with `aria-selected`/`role="tab"`/`role="tabpanel"`. Each permission
  `Switch` toggles with Space/Enter and has an associated `<label htmlFor>`
  (today already wired: `id={key}` / `htmlFor`). The ⋯ overflow opens a Popover
  menu navigable with arrow keys. `⌘K` opens the command palette (web).
- **ARIA:** the person list is a `list`/`listitem` structure (it is not a
  sortable multi-column table, so DataTable grid semantics are not used). Toasts
  are `role="status"` (polite); the Deactivate ConfirmDialog is
  `role="alertdialog"`. The permission editor announces "{name} permissions" as
  its dialog accessible name. A polite live region announces "Permissions
  updated" / "{name} deactivated" (the route announcer in `AppLayout` is
  reused).
- **Targets:** all interactive controls ≥44px touch target — the `Switch` rows
  get adequate vertical padding even though the track is visually small; the ⋯
  IconButton meets the target with padding.
- **Reduced motion:** `prefers-reduced-motion` removes dialog/sheet scale-slide
  and tab-indicator slide, leaving instant opacity changes. No motion is
  essential to comprehension.
- **Forms:** every Invite field has an associated `<label>`; validation errors
  use `FormFieldError` with `aria-describedby`, not color/placeholder alone.
  Required fields are marked in label text ("Email \*"), not by color. The
  escalation-disabled toggles expose `aria-disabled` + an accessible reason (the
  Tooltip text is also `aria-describedby`).

---

## 10. Web ↔ mobile divergence

Admin-web is **primarily a web / desktop product.** There is no dedicated React
Native admin app; granting permissions and deactivating staff are deliberate,
accountability-bearing actions expected on a laptop. This screen is therefore
designed desktop-first.

- **Command palette (`⌘K`) is web-only** — absent on any mobile/RN surface
  (foundation §6). Mobile users reach Staff via the `MobileBottomNav` / sidebar
  drawer.
- **Rows stay as Cards** (this screen never uses a multi-column DataTable), so
  the web→mobile shift is gentler than the Classes/Users tables: on sm each
  person `Card` grows taller, the meta line becomes a `DefinitionList`, and the
  **Permissions** Button goes full-width with the **⋯** beside it.
- **Permission editor → Sheet.** On sm the editor `Dialog` becomes a bottom
  **Drawer/Sheet** so the long `Switch` list scrolls comfortably; the Invite
  dialog likewise becomes a Sheet.
- **Invite action** moves into the sticky page header on sm.
- **Hover → press.** Hover-only affordances (row hover
  elevation/`hover:shadow-sm`, link-prefetch-on-hover) collapse to
  always-visible controls and tap on touch.
- Component **names/props match 1:1** between web `shared-ui` and any future
  `ui-native` (Tabs, Switch, Dialog/Sheet, Badge, Avatar); only the renderer
  differs. No admin-specific RN screen is in scope for the rebuild.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp admin console using the "Lyceum"
design system. Read and conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md
— do NOT invent colors, fonts, spacing, radii, shadows, motion, or component variants;
compose only from Lyceum semantic tokens (e.g. bg.canvas, bg.surface, text.primary,
text.secondary, text.muted, border.subtle, border.strong, border.focus, brand.primary,
status.success, status.warning, status.error) and the §5 component inventory. NEVER
re-paste hex; cite tokens by semantic name.

REGISTER: serious / precision-instrument ADMIN tooling for school administrators —
specifically an ACCESS-CONTROL screen, so the language must read as deliberate and
accountable. Restraint in chrome. NO marigold "spark", NO XP/streak/mastery, NO
gamification celebration, NO student playfulness. Typography: Fraunces for the H1 and
empty-state titles, Schibsted Grotesk for UI/labels/buttons, Spline Sans Mono for the
numeric permission counts ("3/6 permissions").

SCREEN: "Staff & Permissions" — route /staff, role tenantAdmin, inside the AppShell
(left Sidebar with "Staff & Permissions" active in the Configuration group + Topbar
with tenant switcher, ⌘K search, notification bell, role switcher, theme toggle,
profile).

BUILD:
- Page header: H1 "Staff & Permissions", subtitle "Invite teachers and administrators
  and control what each person can do in your school."
- Tabs: "Teachers" | "Staff".
- Toolbar: a search Input ("Search staff by name or email…") that grows to fill, and a
  primary Button "+ Invite Staff" pinned right (Staff tab only; Teachers tab shows no
  invite — teachers are created on the Users page).
- A vertical list of person rows, each a Card (elevation e1): Avatar (initials) · name
  + a status Badge inline (Active = status.success / Inactive = neutral muted /
  Suspended = status.warning, each icon + label, NEVER color alone) · a meta line in
  text.secondary (email · department-or-subjects · "{n}/{total} permissions" with the
  count in Spline Sans Mono) · trailing actions: a "Permissions" secondary Button with a
  shield icon, and a ⋯ overflow IconButton (Edit permissions / Deactivate or Reactivate
  / Copy invite link).
- Invite Staff Dialog (Modal): First Name*, Last Name*, Email*, Phone, then a labelled
  Switch list of 6 staff permissions (Manage Users, Manage Classes, View Analytics,
  Export Data, Manage Settings, Manage Billing); Cancel / "Create Staff".
- Permission editor Dialog: title "Edit Permissions — {name}", a labelled Switch row per
  permission (8 for teachers: Create Exams, Edit Rubrics, Manually Grade, View All Exams,
  Create Spaces, Manage Content, View Analytics, Configure AI Agents; 6 for staff as
  above); Cancel / "Save Permissions". Toggles the admin can't themselves grant are
  disabled with a Tooltip "You can't grant a permission you don't have."
- Deactivate flow: a danger ConfirmDialog (role=alertdialog) "Deactivate {name}?" warning
  that access is removed immediately and sessions are signed out; Cancel focused by
  default.
- States: skeleton rows (loading), two cold-start empty states (Staff: "No staff
  members" + Invite; Teachers: "No teachers found" + "Go to Users"), a filtered-empty
  state ("No staff match \"{query}\"." + Clear search), and an inline retryable error
  "Couldn't load staff." + Retry.

MOTION: use Lyceum §4 tokens — dialogs enter base 220ms ease.entrance, exit fast 160ms
ease.exit, tab indicator slides base 220ms, switches flip instant 100ms; respect
prefers-reduced-motion (opacity-only). No spring, no marigold burst.

RULES TO HONOR: tenant isolation (this admin only ever sees their own tenant's people;
no tenant field in the UI; the membership/permission join is server-side, never a
browser read of a global collection); permission grants and status are SERVER-
AUTHORITATIVE (the row's permission count + the editor's toggle states come from the
server, not computed client-side); NO privilege escalation (an admin can only grant
permissions they hold — disable the rest); deactivation revokes access immediately
(signs the user out, not deferred); invite/permission/deactivate are all audited;
Invite is disabled + tooltip when a staff-seat quota is hit (plus a QuotaWarningBanner);
the signed-in admin cannot deactivate their own account. Accessibility: full keyboard,
arrow-key Tabs with aria-selected, Switches as role=switch with aria-checked and bound
labels, focus-trapped dialogs returning focus on close, Deactivate confirm focusing
Cancel, status never by color alone, ≥44px targets, AA contrast. Desktop-first; provide
a sm fallback where rows become taller stacked Cards and the permission editor becomes a
bottom Sheet (⌘K is web-only).

Output production-ready React + Tailwind that reads Lyceum tokens via CSS custom
properties / @theme, composing the shared-ui components named above (Tabs, Card, Avatar,
Badge, Switch, Label, Button, IconButton, Dialog, ConfirmDialog, EmptyState, Skeleton,
Toast).
```
