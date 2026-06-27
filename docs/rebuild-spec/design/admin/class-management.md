# Class Management (List) — Design Spec

> **Area:** admin-web (Tenant / Academy Admin console) · **Route:** `/classes` ·
> **Role:** `tenantAdmin` Conforms to **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens cited by semantic
> name; no new colors/fonts/spacing/radii/motion are introduced except where
> explicitly flagged as a **proposed foundation addition**. Register: the
> **serious/admin** register — restraint in chrome, precision-instrument tone,
> _no_ student-facing playfulness or marigold spark celebration.

---

## 1. Purpose & primary user

**Primary user:** `tenantAdmin` (school / academy administrator), scoped to
exactly **one** tenant.

**Job-to-be-done:** _"Give me the operational roster of all teaching units
(classes / sections / cohorts) in my school so I can create them, see at a
glance who teaches each and how many students are enrolled, fix assignments
quickly, and tidy up at term boundaries — without ever touching another school's
data."_

Concretely this screen lets the admin:

- Scan the full set of **active** classes for the tenant in one sortable,
  paginated table.
- **Create** a new class (name, grade, section; optionally bound to an academic
  session/term).
- **Assign teachers** and **assign students** (enrollment) to a class inline.
- **Filter** by grade (and, per scope notes, by session / teacher) and
  **search** by name/grade/section.
- **Edit** or **archive** a class; **bulk-archive / bulk-activate** a
  multi-selection.
- Drill into a single class via a link to **class-detail**
  (`/classes/:classId`).

This is the admin's per-class control surface. It is _not_ a learning surface;
no XP, streaks, mastery rings, or spark accents appear here.

---

## 2. Entry points & route

**Route:** `/classes` (declared in `apps/admin-web/src/App.tsx`, lazy-loaded).
Rendered inside `AppLayout` → `AppShell`.

**Entry points:**

- Sidebar → **Management** nav group → "Classes" (active-nav uses
  `brand.primary`).
- Dashboard "Classes" KPI / quick action (`DashboardPage` `useClassSummaries`).
- Onboarding wizard completion ("Create your first class" → lands here once
  classes exist).
- `⌘K` Command Palette → "Go to Classes" / "Create class" (web only — see §10).
- Breadcrumb root for `/classes/:classId` back-navigation.

**Common-API reads/writes that power it** (per `specs/common-api.md`; today's
callable names shown in parentheses where the rebuild renames them). `tenantId`
is **derived server-side from `ctx.activeTenantId`** (claim), never sent in the
request body for a normal tenant-admin call (§4.4 of common-api).

| Action                                  | Rebuild callable                                                                                          | Today (live code)                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| List classes                            | `v1.identity.listClasses` _(new read endpoint replacing direct Firestore read)_                           | `useClasses(tenantId)`                               |
| List teachers (for assign + filter)     | `v1.identity.listTeachers`                                                                                | `useTeachers(tenantId)`                              |
| List students (for enrollment + counts) | `v1.identity.listStudents`                                                                                | `useStudents(tenantId)`                              |
| List academic sessions (term filter)    | `v1.identity.listAcademicSessions`                                                                        | academic-session hooks                               |
| Create / edit class                     | `v1.identity.saveClass` (`SaveResponse{ id, created }`)                                                   | `useCreateClass` / `useUpdateClass`                  |
| Assign teachers                         | `v1.identity.saveClass` (`teacherIds[]`)                                                                  | `useUpdateClass({ teacherIds })`                     |
| Assign / enroll students                | `v1.identity.saveClass` enrollment branch (server reconciles `Student.classIds[]` + `Class.studentCount`) | per-student `useUpdateStudent({ classIds })` fan-out |
| Archive (single)                        | `v1.identity.saveClass` (`status: 'archived'`)                                                            | `useDeleteClass` (soft archive)                      |
| Bulk archive / activate                 | `v1.identity.bulkUpdateStatus` (`entityType:'class'`)                                                     | `callBulkUpdateStatus`                               |

> **Rebuild improvement to surface in the spec:** today the student-assignment
> flow fans out one `updateStudent` write per added/removed student in the
> client (`ClassesPage.handleAssignStudents`, computing `toAdd`/`toRemove`). The
> rebuild moves this reconciliation **server-side** into a single `saveClass`
> enrollment call so `Student.classIds[]` and the **server-authoritative**
> `Class.studentCount` stay transactionally consistent and claims are re-synced
> (`syncMembershipClaims`). The UI sends the _desired_ student set; it does not
> compute diffs.

> List reads use the unified pagination fragment (`PageRequest`/`pageResponse`,
> §7) when the tenant's class count grows; today's table paginates client-side
> at 25/page (`usePagination`). Spec assumes server pagination for large
> tenants, client pagination as the small-tenant fast path.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent **Sidebar**
(role-driven nav, "Classes" active in the _Management_ group) + **Topbar**
(tenant name/switcher, `⌘K` search, `NotificationBell`, `RoleSwitcher`,
`ThemeToggle`, profile). A `QuotaWarningBanner` may sit above the page region
when the tenant nears a plan limit. The content region sits on `bg.canvas`; the
table is a `Card` on `bg.surface`.

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar  │  Topbar: [Tenant ▾]      ⌘K Search        🔔  [Role ▾]  ☼  (avatar) │
│ (Mgmt:   │──────────────────────────────────────────────────────────────────── │
│  Classes │  Breadcrumb:  Home / Classes                                         │
│  active) │                                                                      │
│          │  ┌─ Page header ───────────────────────────────────────────────┐    │
│          │  │ H1  Classes & Sections          [ + Create Class ] (primary) │    │
│          │  │ sub  Manage your school's classes, sections, and cohorts.    │    │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │                                                                      │
│          │  ┌─ Filter bar ────────────────────────────────────────────────┐    │
│          │  │ [🔍 Search classes…            ]  [Session ▾] [Grade ▾] [Teacher ▾]│
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │                                                                      │
│          │  ┌─ DataTable (Card, e1) ──────────────────────────────────────┐    │
│          │  │ ☐  Name↕     Grade↕  Section↕  Term   Teachers  Students  …  │    │
│          │  │ ─────────────────────────────────────────────────────────── │    │
│          │  │ ☐  Math 10A  10      A         T1'26  👨‍🏫 2     👥 31    ⋯   │    │
│          │  │ ☐  Sci 9B    9       B         T1'26  👨‍🏫 1     👥 28    ⋯   │    │
│          │  │ …                                                            │    │
│          │  ├─ Pagination ─────────────────────────────────────────────── │    │
│          │  │ Rows per page [25 ▾]      1–25 of 142        ‹ 1 2 3 … ›     │    │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │                                                                      │
│          │        ┌─ Floating Bulk Action Bar (when ≥1 selected, e3) ──┐        │
│          │        │ 3 selected   [Archive Selected] [Activate Selected] │        │
│          │        └─────────────────────────────────────────────────────┘        │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

**Grid & spacing:** content max-width 1200; desktop page gutter 32 (`space.8`).
Vertical rhythm between header → filter → table is `gap` 24 (`space.6`). Filter
bar is a flex row, `gap` 12 (`space.3`). Table cells pad 12–16.

**Row actions** collapse into a single trailing **⋯ overflow IconButton** →
Popover menu (Edit / Archive / View detail) at md and below; at lg they may show
as inline ghost IconButtons (Edit, Archive) as today. Standardize on the
overflow menu to keep the action column narrow and consistent.

**Responsive:**

- **lg (≥1024):** full DataTable, all columns (☐ select · Name · Grade · Section
  · Term · Teachers · Students · Status · Actions). Sidebar expanded.
- **md (768–1023):** sidebar collapses to icon rail (AppShell behavior). Filter
  bar wraps to two rows (search full-width, selects below). Lower-priority
  columns (Term) may hide behind a column-visibility control; Teachers/Students
  stay.
- **sm (<768):** admin is desktop-first (see §10). The DataTable degrades to a
  **stacked card list** (one `Card` per class: name as title, grade/section/term
  as a `DefinitionList`, teacher & student counts as `Chip`s, ⋯ actions).
  Filters become a `Drawer/Sheet` triggered by a "Filters" Button. Bulk bar
  docks to the bottom of the viewport. This is a usable-but-secondary mode.

---

## 4. Components used (from FOUNDATION §5 only)

**Navigation:** AppShell, Sidebar, Topbar, Breadcrumb, CommandPalette (⌘K,
web-only).

**Containers:** Card (table container + sm stacked rows), Section (page header),
Modal/Dialog (Create / Edit / Assign Teachers / Assign Students), Popover
(row-action overflow menu, column-visibility), Drawer/Sheet (sm filter panel),
Tooltip (icon-only controls).

**Primitives:** Button (`primary` = Create Class & dialog confirm;
`secondary`/`ghost` = Cancel & row actions; `danger` = Archive confirm),
IconButton (row overflow ⋯, clear-search), Input (search + name field), Select
(Grade, Section, Session, Teacher filters), Combobox (the **EntityPicker** for
teacher/student multi-assign — see proposed addition), Checkbox (select-all +
per-row select).

**Data:** DataTable (sort / filter / select / paginate — the canonical primitive
the rebuild consolidates onto, replacing per-page
`usePagination`/`useSort`/`Set` glue), Pagination, EmptyState, Skeleton (table
skeleton), Badge (status: Active / Archived), Chip/Tag (assigned teacher chips,
term chip), Avatar/AvatarGroup (teacher faces in the Teachers cell — optional
richer affordance), DefinitionList (sm stacked-card fields), Stat/KPI (optional
header summary: total classes / unassigned classes).

**Feedback:** Toast (sonner) for success/failure, ConfirmDialog (single
archive + bulk archive/activate — `AlertDialog` today), InlineAlert/Banner
(partial-load / over-quota warning), LoadingOverlay (dialog submit),
FormFieldError (Create/Edit validation).

**Domain components:** none of the assessment/gamification domain components
apply here (no answer keys, grading, XP). Notably **AnswerKeyLock**,
**GradePill**, **ConfidenceBadge**, **XPMeter** are _deliberately absent_ — this
is administrative tooling.

### Proposed foundation additions (flag)

1. **`EntityPicker`** — a searchable multi-select used for "Assign Teachers" and
   "Assign Students" (exists in code as `@levelup/shared-ui` `EntityPicker` with
   `items/selected/onChange/searchPlaceholder/emptyText`). It is a **Combobox**
   composition (Combobox + Checkbox list + selected-Chip summary). Recommend
   formalizing it in §5 as a named **Combobox (multi-select / EntityPicker)**
   variant rather than a brand-new component, so it inherits Combobox tokens
   (radius md, `border.subtle`, focus ring `border.focus`).
2. **Floating Bulk Action Bar** — the centered, bottom-docked selection toolbar
   (`e3`, pill-ish `radius.lg`). Recommend adding it to §5 Feedback as
   **BulkActionBar** (a contextual action surface bound to a multi-row
   selection), since multiple admin tables (Users, Classes, Staff) reuse it.
   Until then it is a `Card` at `e3` composed from Buttons.

---

## 5. States

All states render inside the same Card/region so layout doesn't jump.

**Loading (skeleton):** `Skeleton` table — header row + 8 shimmer rows matching
the real column count, on `bg.surface`. No spinner. Filters render disabled.
(Today: `TableSkeleton columns={8}`.)

**Empty (no classes at all):** centered `EmptyState` inside a dashed-border
panel (`border.strong`, dashed):

- Title (Fraunces): "No classes yet"
- Body (`text.secondary`): "Create your first class to start organizing teachers
  and students."
- Primary action: **+ Create Class**.

**Empty (filtered to zero):** distinct copy — "No classes match these filters."
with a **Clear filters** `ghost` Button. Never reuse the cold-start empty state
for a filtered-out result.

**Error (list read failed):** `InlineAlert` (status.error, paired with an error
icon + text — never color alone) inside the table region: "Couldn't load
classes." + **Retry** Button (re-invokes `listClasses`). A global React Query
error boundary catches unhandled cases (common-api §6.3); this screen prefers
the inline, retryable form.

**Partial:** classes loaded but a dependency (teachers/students/sessions) still
loading or failed → the table renders with **counts** (server-authoritative
`studentCount`, `teacherIds.length`) but the assign dialogs show their own
loading/empty state ("Loading teachers…" / "No teachers found."). A non-blocking
`InlineAlert` ("Some teacher names couldn't load — counts are still accurate.")
covers a failed teacher/student fetch so counts remain trustworthy.

**Success:** populated DataTable; row links active; sort/filter/pagination live;
bulk bar appears on selection.

**Permission-gated variations by role:**

- `tenantAdmin` (the primary, in-scope role): full create / edit / assign /
  archive / bulk.
- `staff` with `canManageUsers`/class-management permission (if a staff user
  reaches this route): same table, but **Create / Edit / Archive / Assign**
  controls are gated by `useCan(...)` — hidden or `disabled` with a Tooltip
  ("Requires class-management permission") when absent. Read-only viewers see
  the table + drill-in only.
- `teacher` / `student` / `parent`: **never reach this route** — `RequireAuth`
  (`allowedRoles={["tenantAdmin"]}`) redirects to an Access-Denied panel.
  `superAdmin` bypasses (cross-tenant) but operates from the super-admin control
  plane, not here.
- Feature/quota gating: if the tenant has hit a class quota, **Create Class** is
  `disabled` with a Tooltip + a `QuotaWarningBanner` ("You've reached your
  plan's class limit"). The button is never silently removed.

---

## 6. Interactions & motion (§4 motion tokens)

**Create class:** Click **+ Create Class** → `Modal/Dialog` enters (overlay
fade + content scale/slide, `base 220ms`, `ease.entrance`). Fields: Name (Input,
required), Grade (Select, required), Section (Select, optional), Term/Session
(Select, optional). Confirm is `disabled` until Name + Grade present. On submit
→ Button shows inline "Creating…" + `LoadingOverlay`; on success → dialog exits
(`fast 160ms`, `ease.exit`), success Toast "Class created", new row appears. The
table does **not** optimistically insert (id + `studentCount` are
server-assigned, server-authoritative) — it refetches/invalidates the narrow
`classKeys.list()` scope.

**Edit class:** Row ⋯ → Edit → Dialog pre-filled. Same submit pattern; Toast
"Class updated". Field-level changes here may be optimistically reflected
(name/section are client-known); counts/ids are not.

**Assign teachers:** Row Teachers cell (or ⋯ → Assign teachers) → Dialog with
**EntityPicker** (search teachers, multi-check, selected shown as Chips,
descriptions show subjects/designation). Save → Toast "Teachers assigned"; the
Teachers count chip updates after server confirm.

**Assign students (enrollment):** Row Students cell → Dialog with student
EntityPicker pre-seeded with the class's current enrollment. The admin edits the
desired set; **Save sends the full desired set** to `saveClass` (server
reconciles add/remove, updates `studentCount`). Toast "Students enrolled". The
Students count is **server-authoritative** and only updates after the response.

**Sort:** Click a `SortableTableHead` (Name / Grade / Section) → toggles
asc/desc/none; caret animates `instant 100ms`. Sort is server-side for paginated
tenants.

**Filter / search:** Typing in search debounces, then re-queries; Select filters
(Session / Grade / Teacher) re-query immediately. Active filters show as
removable `Chip`s under the filter bar; **Clear filters** resets. Row count
updates with a subtle `fast` cross-fade — no layout jump.

**Bulk select → archive/activate:** Checking rows raises the **Floating Bulk
Action Bar** (slides up from bottom, `base 220ms`, `ease.entrance`). "Archive
Selected" / "Activate Selected" each open a **ConfirmDialog** stating the count
and consequence. Confirm → Button shows "Processing…", calls `bulkUpdateStatus`;
on success the selection clears, bar exits, Toast "N class(es)
archived/activated". Failure → error Toast with the server message; selection is
preserved so the admin can retry. **No optimistic mutation** for bulk status
(it's an audited, server-authoritative state-machine transition).

**Single archive:** ⋯ → Archive → `danger` ConfirmDialog quoting the class name;
consequence text "This will hide the class from active views." Confirm → Toast
"Class archived"; row leaves the active list.

**Drill-in:** Click class **Name** → navigates to `/classes/:classId`
(`page 420ms` route transition).

**Reduced motion:** all of the above degrade to instant opacity-only transitions
under `prefers-reduced-motion` (§4). No spring/marigold burst anywhere —
gamification celebration is reserved for the student register and must not
appear in admin chrome.

---

## 7. Content & copy (precise admin tone)

**Page header**

- H1: `Classes & Sections`
- Subtitle: `Manage your school's classes, sections, and cohorts.`
- Primary CTA: `+ Create Class`

**Filter bar**

- Search placeholder: `Search classes…`
- Grade Select: `All Grades` (default) / `Grade 1…12`
- Session/Term Select: `All Terms` / `<session name>`
- Teacher Select: `All Teachers` / `<teacher name>`

**Table columns** `Name` · `Grade` · `Section` · `Term` · `Teachers` ·
`Students` · `Status` · (actions, no header label or `sr-only` "Actions"). Empty
section cell renders an em-dash `—`. Status `Badge`: `Active` / `Archived`.

**Create / Edit dialog**

- Titles: `Create Class` / `Edit Class`. Descriptions:
  `Add a new class to your school.` / `Update class details.`
- Labels: `Class Name` (placeholder `e.g. Mathematics 10A`), `Grade`, `Section`,
  `Term`.
- Buttons: `Cancel` / `Create` (→ `Creating…`) · `Save Changes` (→ `Saving…`).

**Assign dialogs**

- `Assign Teachers` — "Select teachers to assign to {className}." / picker
  placeholder `Select teachers…` / search `Search teachers…` / empty
  `No teachers found.`
- `Assign Students` — "Select students to enroll in {className}." /
  `Select students…` / `Search students…` / `No students found.`

**Confirmations**

- Single archive title: `Archive class?` Body:
  `Archive "{className}"? It will be hidden from active views. You can restore it later.`
- Bulk title: `Archive {n} class(es)?` / `Activate {n} class(es)?` Body:
  `Archived classes are hidden from active views.` /
  `Activated classes reappear in active views.`
- Confirm buttons: `Archive` (danger) / `Activate` / `Cancel`.

**Empty states**

- Cold start title: `No classes yet` — body
  `Create your first class to start organizing teachers and students.`
- Filtered-empty: `No classes match these filters.` + `Clear filters`.

**Errors / toasts**

- List error: `Couldn't load classes.` + `Retry`.
- Success: `Class created` · `Class updated` · `Class archived` ·
  `Teachers assigned` · `Students enrolled` · `{n} class(es) archived` /
  `{n} class(es) activated`.
- Failure: `Failed to {create|update|archive} class` with description
  `Please try again` or the server `message`.
- Quota:
  `You've reached your plan's class limit. Contact your account owner to add more.`

Tone rule: declarative, operational, no exclamation marks, no second-person
cheerleading. "Enroll", "assign", "archive" — verbs an administrator expects.

---

## 8. Domain rules surfaced

- **Tenant isolation (hard rule).** Every class belongs to exactly one tenant
  (`/tenants/{tenantId}/classes/{classId}`). The list is implicitly scoped to
  `ctx.activeTenantId` from the caller's claim — `tenantId` is **not** a
  client-chosen filter and is never in the request body for a tenant-admin
  (common-api §4.4). A `tenantAdmin` can never see or mutate another tenant's
  classes; `RequireAuth` additionally asserts
  `currentMembership.tenantId === currentTenantId`.
- **RBAC gating.** Route is `allowedRoles={["tenantAdmin"]}`. Mutations re-check
  authorization server-side (`assertTenantAdminOrSuperAdmin`); the UI's
  hidden/disabled controls are UX only — rules + callables are the real
  enforcement. `staff` actions are gated by `StaffPermissions` via `useCan`.
- **Server-authoritative values.** `Class.studentCount` and enrollment are
  computed/reconciled server-side; the UI **displays** them and never derives
  the count locally as truth. Enrollment edits send the desired student set; the
  server computes add/remove, updates `Student.classIds[]` + `studentCount`, and
  re-syncs claims (`syncMembershipClaims` — fixes the stale-`managedClassIds`
  drift noted in auth-access §4.2 when a student's classes change).
- **Soft-delete / state machine.** Archive is a soft status transition
  (`active → archived`), reversible via activate — destructive deletes are not
  exposed here. Bulk status changes go through `bulkUpdateStatus` (idempotent,
  batched, audited).
- **Quota enforcement.** Class creation is subject to plan limits
  (`TenantUsage`/`TenantSubscription`); the Create button reflects quota state
  and a `QuotaWarningBanner` surfaces near-limit/over-limit.
- **Feature gates.** If a tenant feature flag relevant to a column (e.g.
  analytics-driven enrollment health) is off, that affordance is hidden — but
  core class CRUD is always available to a tenant-admin.
- **Audit logging.** Every mutating action (create/edit/archive/assign/bulk)
  writes to the tenant audit log server-side (common-api §9) — the admin's
  actions are accountable.
- **No assessment data here.** Answer keys, rubrics, grades, and confidence
  values do not appear on this screen and have no code path to it (answer-key
  isolation is enforced regardless). This screen never renders student-facing
  gamification.

---

## 9. Accessibility (WCAG AA)

- **Contrast:** all text/background pairs meet AA (4.5:1 body, 3:1 large/UI)
  using Lyceum semantic tokens. Status is **never color-alone**: the `Badge`
  pairs a label ("Active"/"Archived") with its color; Teachers/Students counts
  pair an icon + number + an `aria-label`.
- **Focus order:** Skip-to-content → Sidebar → Topbar → page H1 → Create Class →
  search → filters → table (header controls → rows) → pagination → bulk bar
  (when present). Dialogs **trap focus**, return focus to the invoking control
  on close, and `Esc` cancels.
- **Keyboard:** every action reachable without a pointer. Sortable headers are
  `<button>`s toggled with Enter/Space and expose `aria-sort`. Select-all and
  per-row checkboxes are keyboard-operable with descriptive `aria-label`s
  ("Select all classes on page", "Select {className}"). Row links and the ⋯
  overflow menu are tab-reachable; the Popover menu supports arrow-key
  navigation. `⌘K` opens the command palette (web).
- **ARIA:** table uses proper `table`/`row`/`columnheader`/`cell` semantics; the
  DataTable announces row count and sort changes via a polite live region (the
  route announcer already exists in `AppLayout`). Toasts are `role="status"`
  (polite); the destructive ConfirmDialog is `role="alertdialog"`. The Bulk
  Action Bar announces "{n} selected" politely on selection change.
- **Targets:** all interactive controls ≥44px touch target (checkboxes get
  adequate padding even when visually small).
- **Reduced motion:** `prefers-reduced-motion` removes dialog scale/slide and
  the bulk-bar slide, leaving instant opacity changes. No motion is essential to
  comprehension.
- **Forms:** every field has an associated `<label>`; validation errors use
  `FormFieldError` with `aria-describedby`, not color/placeholder alone.
  Required fields are marked in label text, not by color.

---

## 10. Web ↔ mobile divergence

Admin-web is **primarily a web / desktop product.** There is no dedicated React
Native admin app; tenant-admin work is expected on a laptop. This screen is
therefore designed desktop-first.

- **Command palette (`⌘K`) is web-only** — it is absent on any mobile/RN surface
  (foundation §6). Mobile users reach Classes via the `MobileBottomNav` /
  sidebar drawer.
- **Table → stacked cards on small viewports.** At sm the DataTable becomes a
  vertical list of `Card`s (foundation §6 "table on web → stacked cards on
  mobile"): title = class name, a `DefinitionList` for grade/section/term, count
  `Chip`s for teachers/students, ⋯ for actions. Sort/multi-select degrade to a
  single sort `Select` and a "Select" toggle per card.
- **Filters → Sheet** on sm (the inline filter row collapses behind a "Filters"
  Button opening a bottom `Drawer/Sheet`).
- **Hover → press.** Hover-only affordances (row hover highlight, inline ghost
  action reveal, link-prefetch-on-hover) collapse to always-visible controls and
  tap on touch.
- **Bulk bar** docks to the bottom safe-area on mobile rather than floating
  centered.
- Component **names/props match 1:1** between web `shared-ui` and any future
  `ui-native`; only the renderer differs. No admin-specific RN screen is in
  scope for the rebuild.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp admin console using the "Lyceum"
design system. Read and conform EXACTLY to docs/rebuild-spec/design/00-FOUNDATION.md
— do NOT invent colors, fonts, spacing, radii, shadows, motion, or component variants;
compose only from Lyceum semantic tokens (e.g. bg.canvas, bg.surface, text.primary,
text.secondary, border.subtle, border.strong, border.focus, brand.primary,
status.success, status.error, status.warning) and the §5 component inventory. NEVER
re-paste hex; cite tokens by semantic name.

REGISTER: serious / precision-instrument ADMIN tooling for school administrators.
Restraint in chrome. NO marigold "spark", NO XP/streak/mastery, NO gamification
celebration, NO student playfulness. Typography: Fraunces for the H1/empty-state
title, Schibsted Grotesk for UI/labels/table, Spline Sans Mono for the numeric
counts (teacher/student counts, "1–25 of 142").

SCREEN: "Class Management (List)" — route /classes, role tenantAdmin, inside the
AppShell (left Sidebar with "Classes" active in the Management group + Topbar with
tenant switcher, ⌘K search, notification bell, role switcher, theme toggle, profile).

BUILD:
- Page header: H1 "Classes & Sections", subtitle "Manage your school's classes,
  sections, and cohorts.", and a primary Button "+ Create Class" top-right.
- A filter bar: search Input ("Search classes…") + Selects for Term, Grade, Teacher;
  active filters shown as removable Chips with a "Clear filters" ghost button.
- A DataTable in a Card (elevation e1): columns ☐(select) · Name (link, sortable) ·
  Grade (sortable) · Section (sortable) · Term (Chip) · Teachers (icon + mono count,
  clickable to assign) · Students (icon + mono count, clickable to enroll) · Status
  (Badge: Active/Archived, label + color, never color alone) · ⋯ overflow action menu.
  Include a select-all header checkbox and DataTablePagination ("Rows per page",
  "1–25 of N", page controls).
- A Floating Bulk Action Bar (elevation e3, bottom-center) shown when ≥1 row selected:
  "{n} selected", "Archive Selected" (danger), "Activate Selected".
- Dialogs (Modal): Create Class / Edit Class (Name Input required, Grade Select
  required, Section Select, Term Select); Assign Teachers and Assign Students each
  with a searchable multi-select EntityPicker (Combobox + checkbox list + selected
  Chips); destructive Archive ConfirmDialog.
- States: skeleton table (loading), two empty states (cold-start "No classes yet" vs
  filtered "No classes match these filters."), inline retryable error "Couldn't load
  classes.", and a partial state where counts still show if teacher/student names fail.

MOTION: use Lyceum §4 tokens — dialogs enter base 220ms ease.entrance, exit fast
160ms ease.exit, bulk bar slides up base 220ms; respect prefers-reduced-motion
(opacity-only). No spring, no marigold burst.

RULES TO HONOR: tenant isolation (this admin only ever sees their own tenant; no
tenant field in the UI); student count and enrollment are SERVER-AUTHORITATIVE
(display only, never computed as truth client-side); archive is a reversible soft
status transition; Create Class is disabled + tooltip when a plan/class quota is hit
(plus a QuotaWarningBanner). Accessibility: full keyboard, aria-sort on sortable
headers, focus-trapped dialogs returning focus on close, status never by color alone,
≥44px targets, AA contrast. Desktop-first; provide a sm fallback where the table
becomes stacked Cards and filters move into a Sheet (⌘K is web-only).

Output production-ready React + Tailwind that reads Lyceum tokens via CSS custom
properties / @theme, composing the shared-ui components named above.
```
