# Classes Overview

> The teacher/admin operational index for classes: find a class, read its
> headline health at a glance, and create or edit a class. The launch pad into a
> single class's detail view.

**Route** `/classes` · **Roles** `teacher`, `tenantAdmin` · **Primary APIs**
`classes.list` (repo read) · `teachers.list` (repo read) ·
`analytics.getSummary` scope `class` (repo read, per-row perf) →
`v1.identity.saveClass` (callable write)

> Conforms to `docs/rebuild-spec/design/00-FOUNDATION.md` ("Lyceum / Modern
> Scholarly"). All tokens, type, spacing, radius, elevation, motion, and
> components are cited by semantic name from FOUNDATION — none are invented
> here. Staff register: precise, credible, calm.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` managing their own roster of classes, or a
`tenantAdmin` overseeing every class in the tenant.

**Job-to-be-done:** _"Let me quickly find the right class, judge whether it
needs my attention (avg performance, at-risk count), and get into it — or stand
up a new class in seconds."_

This is an **operational index**, not the student gamified register. No
XP/streak/celebration chrome. The screen answers three questions, in order:
_Which classes do I manage? Which ones are healthy vs. need attention? How do I
open or create one?_ Authoring (spaces/items) and grading live elsewhere — this
screen links **out** to a class's detail view (`/classes/:classId`) and never
embeds authoring or grading surfaces.

**Role split:**

- `teacher` — sees only classes they manage (claim `classIds` /
  `managedClassIds`, with the 15-class JWT-overflow fallback). No
  teacher-reassignment controls.
- `tenantAdmin` — sees all classes in the active tenant, plus an "Assigned
  teachers" column and the ability to reassign teachers (via the class form →
  `v1.identity.saveClass`).

---

## 2. Entry points & route

**Route:** `/classes` (under `PlatformLayout`, in the **People** nav group). Row
click → `/classes/:classId`.

**Entry points:**

- Sidebar **People → Classes** (route-manifest `navMeta` derived; active state
  by longest-prefix match in the shell).
- Dashboard "Classes" summary card / "View all classes" link.
- Command palette (⌘K) → "Classes", and "New class" as a palette action.
- Breadcrumb root for `/classes/:classId` (Classes → {class name}).
- Deep link / browser back from a class detail page.

**APIs powering it** (all via `@levelup/api-client` repositories; no direct
Firestore — see `specs/webapps-design.md` §5.1, `specs/common-api.md` §3.3):

- **Read — class list:** `classes.list` (`ClassesRepo.list`). Server scopes to
  the caller's active tenant from claims (`ctx.activeTenantId`) and, for a
  `teacher`, intersects with `classIds`/`managedClassIds` (overflow fallback).
  `tenantId` is never sent in the request body or shown as a field.
- **Read — per-row performance & at-risk:** `analytics.getSummary` scope `class`
  per visible class, returning the precomputed `ClassProgressSummary`
  (`overallScore`/avg performance, at-risk roster → `atRiskCount`).
  **Server-authoritative** — the client never computes performance or risk.
  Fetched lazily per page of rows (batched), not for the whole list at once.
- **Read — teacher names (admin only):** `teachers.list` (`TeachersRepo.list`)
  to resolve `teacherIds` → names for the "Assigned teachers" column and the
  class-form picker.
- **Write — create/edit:** `v1.identity.saveClass` (`api.identity.saveClass`)
  via `ClassFormDialog`. `save*` upsert convention: no `id` = create, `id`
  present = update. Archive/restore is the same callable with a `status`
  transition. Server provisions/refreshes claims via `syncMembershipClaims` on
  teacher reassignment.

---

## 3. Layout (wireframe-as-text)

Renders inside `PlatformLayout` (`@levelup/shared-ui/layout`): persistent
`AppSidebar` (lg+), `Topbar` (tenant switcher, ⌘K search, `NotificationBell`,
profile), `SkipToContent`, `RouteAnnouncer`, `AppBreadcrumb` (Classes),
`OfflineBanner` slot. Page content sits in the shell's main region at max
content width 1200, page gutters 32 (desktop) / 24 (tablet) / 16 (mobile).

```
┌───────────────────────────────────────────────────────────────────────────┐
│ PageHeader region                                                           │
│  ┌───────────────────────────────┐                 ┌──────────────────────┐ │
│  │ H1  "Classes"      (Fraunces)  │                 │ [+ New class] (Button │ │
│  │ subtitle (text.secondary)      │                 │   variant=primary)   │ │
│  └───────────────────────────────┘                 └──────────────────────┘ │
│  gap-2 below header                                                          │
├───────────────────────────────────────────────────────────────────────────┤
│ Toolbar region (DataTable controls)                                         │
│  [🔎 Search name / grade / section ]  [Session ▾] [Status ▾] [Teacher ▾*]   │
│                                              (* admin only)   right: [count] │
├───────────────────────────────────────────────────────────────────────────┤
│ DataTable region (Card, radius lg, e1)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Class ▴ │ Grade/Sec │ Students │ Spaces │ Exams │ Avg perf │ At-risk │ Session │ │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ Grade 10 — A │ 10 / A │ 32 │ 4 │ 3 │ ▰▰▰▰▱ 78% │ ⚠ 3 │ 2025–26 │ ⋯ │    │
│  │ Grade 9 — B  │  9 / B │ 28 │ 3 │ 2 │ ▰▰▰▱▱ 64% │ ⚠ 5 │ 2025–26 │ ⋯ │    │
│  │ … (rows clickable → /classes/:classId)                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  Pagination (right-aligned)                                                  │
└───────────────────────────────────────────────────────────────────────────┘
```

**Grid / columns (DataTable):**

1. **Class** — name (UI medium), links to detail. Sortable, primary sort.
2. **Grade / Section** — `grade` · `section ?? "—"`. Sortable.
3. **Students** — `studentCount` (mono numeric, `Spline Sans Mono`). Sortable.
4. **Spaces** — assigned spaces count (mono). Sortable.
5. **Exams** — assigned/active exams count (mono). Sortable.
6. **Avg performance** — `ProgressBar` + mono `78%`; bar fill tinted by
   `grade.*` scale band (A→F). From `analytics.getSummary`. Sortable; renders
   skeleton until summary resolves (partial state).
7. **At-risk** — `AtRiskBadge` showing count (e.g. `⚠ 3`); `status.warning` ≥1,
   muted `0`. Never color-only — icon + number + label. Sortable.
8. **Academic session** — `Badge` (pill) with session label, e.g. `2025–26`.
   Sortable.
9. **Row actions** — trailing `IconButton` `⋯` `DropdownMenu`: Open · Edit ·
   Archive/Restore. (Admin row menu also: Reassign teachers.)

A 10th **Assigned teachers** column (AvatarGroup + names) is inserted before
"Session" **only for `tenantAdmin`**.

**Responsive behavior (mobile-first):**

- **`lg` (≥1024):** full `DataTable` with all columns; sidebar persistent;
  sticky table header within the card.
- **`md` (768–1023):** sidebar collapses to icon rail (shell behavior); table
  drops the **Spaces** and **Exams** columns into the row's expandable detail;
  keeps Class, Grade/Sec, Students, Avg perf, At-risk, Session. Horizontal
  scroll is a fallback, not the default.
- **`sm` (<768):** **table → stacked `Card` list** (one card per class, the
  canonical web↔mobile divergence). Each card: title (name) + `Badge` status; a
  two-up stat row (Students · Avg perf); an `AtRiskBadge`; session +
  grade/section as muted caption; tap target = whole card → detail; a trailing
  `⋯` menu. `MobileBottomNav` shows; ⌘K is unavailable. Search collapses into a
  leading icon that expands a full-width `Input`; filters move into a `Sheet`
  ("Filters") triggered from the toolbar. "New class" becomes a bottom-right
  primary `Button` (sticky) or a `+` in the header.

---

## 4. Components used (from FOUNDATION §5 / shared-ui inventory)

All from FOUNDATION §5 and the `specs/webapps-design.md` §2.2 inventory:

- **`PlatformLayout` / `AppShell` / `AppSidebar` / `Topbar` / `AppBreadcrumb` /
  `MobileBottomNav`** (`@levelup/shared-ui/layout`) — the shell.
- **`DataTable`** + headless **`useDataTable`** (`@levelup/shared-ui/data`) —
  owns search, filter, sort, selection, pagination. **Replaces** the live page's
  hand-rolled `useMemo` filter + `Table` primitives. Includes built-in
  **`Pagination`**.
- **`Button`** (variant `primary` for "New class"; `ghost`/`secondary` for
  row/toolbar actions) — FOUNDATION §5 primitive. "New class" is a standard
  primary action (deep ink `brand.primary`), **not** a `spark` CTA — spark is
  reserved for gamification/hero, which this staff surface does not use.
- **`Input`** (search), **`Select`** (Session, Status, Teacher filters) —
  primitives. Radix Select: never use empty `""` as a value (use an explicit
  `"all"` sentinel).
- **`Badge`/`Chip`** (pill) — status (`active`/`archived` via the shared status
  map), academic-session label.
- **`AtRiskBadge`** (domain component, `@levelup/shared-ui/charts`) — at-risk
  count surfaced from `analytics.getSummary`; **never** computed client-side.
- **`ProgressBar`** — avg-performance cell, fill tinted by `grade.*` band.
- **`Avatar` / `AvatarGroup`** — assigned-teacher faces (admin column + form
  picker).
- **`DropdownMenu`** — row `⋯` actions and bulk-action overflow.
- **`Dialog` (`ClassFormDialog`)** — create/edit, built on the `Dialog`
  primitive + RHF (`react-hook-form` + `zodResolver`) over the `saveClass`
  request schema. **Form, not `useState` soup** (per `webapps-design.md`
  checklist #10).
- **`ConfirmDialog`** (`@levelup/shared-ui/data`) — archive confirmation.
- **`EmptyState`** and **`ErrorState`** (distinct components,
  `@levelup/shared-ui/data`) — empty vs. error are not the same surface.
- **`Skeleton`** — loading rows and per-cell summary placeholders (partial
  state).
- **`Toast` (sonner)** — save/archive/restore confirmations.
- **`Card`** — table container (radius `lg`, elevation `e1`) and the `sm`
  stacked-card variant.
- **`Tooltip`** — on truncated teacher lists and the at-risk badge (reason
  hint).
- **`EntityPicker`** (`@levelup/shared-ui/data`) — admin teacher reassignment
  inside the form (multi-select over `teachers.list`).

**Proposed addition:** none required. The avg-performance cell composes
`ProgressBar` + mono text; if this pairing recurs across teacher analytics
screens, promote a small `MetricCell` to `@levelup/shared-ui/charts` — but for
this screen, compose from existing primitives; do not add a token or variant.

---

## 5. States

**Loading (skeleton):** `DataTable` renders header + N (≈8) `Skeleton` rows at
row height; toolbar controls render disabled. On `sm`, 4–5 skeleton `Card`s. No
spinner-only screen.

**Partial (the common steady state):** the class list (`classes.list`) resolves
fast; the per-row **Avg performance** and **At-risk** cells depend on
`analytics.getSummary` and resolve a beat later. Those two cells show inline
cell-level `Skeleton` until their summary lands, while the rest of the row is
interactive. If a class has **no summary yet** (newly created, nightly
aggregation not run), show `—` + a `Tooltip` "No analytics yet — summaries
update after the next nightly run," not a zero (zeros read as truth — see
analytics report). At-risk for an un-summarized class shows `—`, never `0`.

**Empty:**

- _Teacher, no managed classes:_ `EmptyState` — icon (book/layers), title **"No
  classes assigned to you yet"**, body **"Once an administrator assigns you to a
  class, it'll appear here. You can also create a class if your role allows
  it."** Primary `Button` "New class" shown **only if** the teacher has create
  permission; otherwise the body omits the create line and shows no CTA.
- _Admin, tenant has no classes:_ title **"No classes yet"**, body **"Create
  your first class to start enrolling students and assigning spaces and
  exams."**, primary `Button` "New class".
- _Filtered to nothing:_ title **"No classes match your filters"**, body **"Try
  a different search term or clear the session/status filters."**, secondary
  `Button` "Clear filters". (Distinct from the no-data empty — never shows the
  create CTA.)

**Error:** `ErrorState` (distinct from empty) — title **"Couldn't load
classes"**, body maps `error.details.code` via
`ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS` (`common-api.md` §6). Generic fallback:
**"Something went wrong loading your classes. Check your connection and try
again."** Primary `Button` "Retry" (re-runs the query). A per-row summary fetch
failure degrades only those two cells to `—` + a small inline-alert tooltip; it
never blanks the whole table. `TENANT_SUSPENDED` / `PERMISSION_DENIED` surface
their specific recovery copy.

**Success:** populated `DataTable` (or card list). Sticky header; sortable
columns show direction caret; active filters show as removable chips below the
toolbar.

**Permission-gated variants by role:**

- `teacher` — list pre-scoped to managed classes; **no** "Assigned teachers"
  column; row `⋯` has Open/Edit/Archive only (Edit/Archive gated on
  `TeacherPermissions.canManageClasses`-equivalent; if absent, row is read-only
  → only "Open"). "New class" hidden if the teacher lacks create permission.
- `tenantAdmin` — full tenant list; "Assigned teachers" column; row `⋯` adds
  **Reassign teachers**; "New class" always available; bulk-select +
  `BulkActionBar` (Archive selected) enabled. Cross-tenant data never appears
  (server-scoped by `ctx.activeTenantId`).

---

## 6. Interactions & motion (cite FOUNDATION motion tokens)

**Search/filter/sort** (via `useDataTable`):

- Typing in search debounces (~`base` 220ms feel) then re-filters; matched rows
  reflow with `ease.standard`. Search matches name, grade, section (parity with
  current behavior).
- Session / Status / Teacher `Select` apply immediately; active filters render
  as removable chips (enter `fast` 160ms, `ease.entrance`).
- Column sort toggles asc→desc→none; caret rotates `fast` with `ease.standard`.
  Sort is client-side over the loaded page for snappiness; large tenants
  paginate server-side via the §7 cursor fragment.

**Row → detail:** click anywhere on a row (except the `⋯` menu / interactive
cells) navigates to `/classes/:classId`. Hover raises the row to
`bg.surface-sunken` and triggers route **prefetch** (warm the lazy chunk).
`PageTransition` runs the `page` 420ms transition. Whole row is a single link
target (keyboard: Enter on a focused row).

**Create / edit (`ClassFormDialog`):**

- "New class" / "Edit" opens the `Dialog` — overlay fade + content scale-in at
  `fast`/`base` with `ease.entrance`, elevation `e3`. Focus moves to the first
  field (name); `Esc` / overlay click closes (with a dirty-guard confirm if
  edited).
- Fields: **Class name** (required), **Grade** (required), **Section**
  (optional), **Academic session** (`Select` over `academicSessions`), and
  **Assigned teachers** (`EntityPicker`, **admin only**). RHF + `zodResolver`
  over the `saveClass` request schema; inline `FormFieldError` per field; submit
  disabled while invalid or pending.
- **Submit:** button shows inline spinner ("Creating…/Saving…"); on success →
  `Toast` ("Class created" / "Class updated"), dialog closes, the narrow
  class-list query key invalidates (not the whole tenant key), the new/updated
  row animates in (`fast`, `ease.entrance`). **Optimistic create** is avoided
  (server assigns `id` and provisions claims); **optimistic edit** of
  name/grade/section is acceptable with rollback on error. No client Firestore
  writes — all through `api.identity.saveClass`.

**Archive / restore:**

- Archive opens `ConfirmDialog` — **"Archive this class?"** body **"Archived
  classes are hidden from the default view and stop receiving new assignments.
  You can restore it anytime."** Confirm → `saveClass` status transition;
  **optimistic** row dim/remove with rollback + error toast on failure; success
  `Toast` ("Class archived"). Restore is direct (no confirm) → `Toast` ("Class
  restored").
- Admin bulk archive via `BulkActionBar` → one `ConfirmDialog` summarizing
  count.

**Feedback:** all confirmations via sonner `Toast`; errors via `useApiError` →
toast with recovery hint. Reduced-motion: replace scale/slide with opacity-only
cross-fades; disable row-raise translate.

---

## 7. Content & copy (staff tone — precise, credible, calm)

**Page header**

- H1: **Classes**
- Subtitle: **"Find a class, check its health, and manage enrolment."**
  (teacher) / **"All classes in this tenant."** (admin) — count rendered as a
  muted suffix, e.g. _"24 classes"_.

**Toolbar**

- Search placeholder: **"Search by name, grade, or section"**
- Filters: **Session** ("All sessions"), **Status** ("All statuses" / Active /
  Archived), **Teacher** (admin: "All teachers")
- CTA: **New class**

**Column headers:** Class · Grade / Section · Students · Spaces · Exams · Avg
performance · At-risk · Assigned teachers (admin) · Session · (actions,
unlabeled)

**Cell copy:** section empty → `—`; no-summary perf/at-risk → `—` with tooltip
**"No analytics yet — updates after the next nightly run."**; at-risk badge
label (sr-only) **"{n} students at risk"**.

**Row menu:** Open · Edit · Archive / Restore · Reassign teachers (admin)

**Empty states** (see §5 for full copy): "No classes assigned to you yet" / "No
classes yet" / "No classes match your filters".

**Error:** title **"Couldn't load classes"**; generic body **"Something went
wrong loading your classes. Check your connection and try again."**; CTA
**"Retry"**.

**Form (`ClassFormDialog`)**

- Title: **Create class** / **Edit class**
- Description: **"Add a class for this tenant. You can enrol students after it's
  created."** / **"Update this class's details."**
- Labels: **Class name** ("e.g. Grade 10 — Section A"), **Grade** ("10"),
  **Section (optional)** ("A"), **Academic session**, **Assigned teachers**
  (admin)
- Validation: **"Name is required."** · **"Grade is required."**
- Buttons: **Cancel** · **Create class** / **Save changes**

**Confirm (archive):** title **"Archive this class?"**; body as in §6; buttons
**Cancel** / **Archive**.

Tone notes: no exclamation marks, no XP/streak/celebration language, no
"Awesome!"/"Great job!". Direct, second-person, professional.

---

## 8. Domain rules surfaced

- **Tenant isolation:** every read is scoped to `ctx.activeTenantId` (from
  claims) server-side. `tenantId` is never a form field and never shown.
  Cross-tenant classes can never appear; switching tenants in the `Topbar`
  re-scopes the whole list.
- **Role scoping:** `teacher` sees only managed classes (claim `classIds` /
  `managedClassIds`, with the `MAX_CLAIM_CLASS_IDS = 15` overflow fallback to
  the membership doc). `tenantAdmin` sees all classes and may reassign teachers.
  Teacher-only UI (no teacher column, gated edit/create) is conditioned on
  role + `TeacherPermissions`.
- **Server-authoritative stats:** student count, avg performance, and at-risk
  count are **precomputed server-side** (`classes.list` denormalized
  `studentCount`; `analytics.getSummary` `ClassProgressSummary`). The client
  **never** recomputes performance or at-risk — it renders
  `isAtRisk`/`atRiskCount` and `overallScore` as returned. No client
  `getCountFromServer` fan-out.
- **At-risk provenance:** at-risk flags come from the **nightly rule engine**
  (`nightlyAtRiskDetection` → `atRiskReasons`); the badge surfaces the count and
  (on tooltip) reasons, computed nowhere on the client.
- **Reads via repos, writes via callables:** list/summary reads go through
  `@levelup/api-client` repositories; create/edit/archive go through
  `v1.identity.saveClass`. No direct client Firestore writes (no
  `writeBatch`/`updateDoc`). On teacher reassignment, the server runs
  `syncMembershipClaims` so the affected teacher's `managedClassIds`/claims
  refresh (closing the stale-claims drift noted in auth-access §4.2).
- **Out of scope here:** authoring (spaces/items) lives in the SPACES area;
  grading lives in the EXAMS area. This screen only **links out** (row →
  `/classes/:classId`, which in turn deep-links to those areas). Answer keys are
  never present on this surface.

---

## 9. Accessibility

- **Focus order:** Skip-to-content → H1 → "New class" → search → filters → table
  header (sortable headers are buttons) → rows (each a single focusable link
  target) → row `⋯` menus → pagination. Logical, top-to-bottom, left-to-right.
- **Keyboard:** Tab/Shift-Tab throughout; Enter on a focused row navigates to
  detail; sortable headers toggle on Enter/Space and expose `aria-sort`; `⋯`
  menu is a Radix `DropdownMenu` (arrow-key navigable, Esc to close); dialog
  traps focus, Esc closes, focus returns to the invoking control. Bulk-select
  checkboxes reachable and labeled.
- **ARIA / semantics:** `DataTable` renders a real `<table>` with
  `<th scope="col">`; `aria-sort` on sorted columns; row links use `aria-label`
  ("Open {class name}"); icon-only controls (`⋯`, search) have `aria-label`;
  `AtRiskBadge` exposes an sr-only label ("{n} students at risk") so status is
  never color-only (icon + number + text). `EmptyState`/`ErrorState` use
  `role="status"`/`role="alert"` appropriately; `RouteAnnouncer` announces
  navigation.
- **Contrast:** all text/bg pairs meet WCAG AA (4.5:1 body, 3:1 large/UI) using
  FOUNDATION semantic tokens; status conveyed by icon + label + color, never
  color alone; the avg-performance bar pairs `grade.*` fill with a visible
  numeric percentage.
- **Reduced motion:** honor `prefers-reduced-motion` — replace row-raise
  translate, dialog scale, and chip slide with opacity-only fades; no
  parallax/auto-animation.
- **Touch targets:** ≥44px for row actions, filter triggers, and card taps
  (`sm`).

---

## 10. Web↔mobile divergence (RN parity notes)

- **Table → cards:** web `DataTable` at `lg`/`md`; at `sm` and on the **RN
  learner-adjacent / teacher RN** surface, the same `useDataTable` headless
  logic drives a **stacked `Card` list** (one card per class). Component
  **names/props match 1:1** between `shared-ui` (web) and `ui-native`; only the
  renderer differs (FOUNDATION §6). The headless `useDataTable`
  (search/filter/sort/page state) is reused verbatim.
- **Hover → press:** row-hover prefetch + raise becomes long-press / on-mount
  prefetch on RN; the whole card is the press target.
- **⌘K → none:** no command palette on mobile/RN; "New class" is a header `+` /
  sticky FAB; filters live in a bottom `Sheet`.
- **Navigation:** RN consumes the identical route manifest via the
  `react-navigation` renderer; row tap pushes the Class Detail screen (no
  breadcrumb; native back).
- **Data layer identical:** both call the same `@levelup/api-client`
  repos/callables and `shared-hooks/headless` hooks — no Firestore SDK path
  coupling, so the screen's logic is RN-ready unchanged.
- **Motion:** web uses CSS/`framer-motion` with FOUNDATION durations/eases; RN
  uses Reanimated with the same duration tokens (spring reserved for
  gamification, which this screen does not use).

---

## 11. Claude-design prompt

```
You are designing the "Classes Overview" screen for the Auto-LevelUp TEACHER operational web portal.

CONFORM EXACTLY to the Lyceum / "Modern Scholarly" design system in
docs/rebuild-spec/design/00-FOUNDATION.md. Use ONLY its tokens and components —
do not invent colors, fonts, spacing, radii, or component variants. Cite tokens by
semantic name (bg.canvas, bg.surface, text.primary/secondary/muted, border.subtle,
brand.primary, status.warning/error, grade.*, mastery.*). Fonts: Fraunces (display/H1),
Schibsted Grotesk (UI/body/table), Spline Sans Mono (numerics: counts, percentages).
Radius lg cards / md inputs+buttons / pill badges. Elevation e1 card at rest, e3 dialog.
Motion: fast 160ms / base 220ms / page 420ms with ease.standard & ease.entrance; honor
prefers-reduced-motion. Tone: STAFF — precise, credible, calm. NO XP/streak/celebration
chrome, NO spark accent (reserved for gamification); "New class" is a standard primary
(brand.primary) button.

BUILD this screen, route /classes, inside PlatformLayout (AppSidebar + Topbar +
AppBreadcrumb). Compose from @levelup/shared-ui only:
- Header: H1 "Classes" (Fraunces) + muted subtitle + count; primary Button "New class" (top-right).
- Toolbar: Input search ("Search by name, grade, or section"); Select filters Session / Status /
  Teacher (Teacher only for tenantAdmin); active filters as removable chips.
- DataTable (with useDataTable: search/filter/sort/paginate) columns:
  Class (link to /classes/:classId), Grade / Section, Students (mono), Spaces (mono),
  Exams (mono), Avg performance (ProgressBar + mono % tinted by grade.* band), At-risk
  (AtRiskBadge: icon + count + sr-only label), [Assigned teachers — AvatarGroup, admin only],
  Session (Badge), trailing ⋯ DropdownMenu (Open / Edit / Archive·Restore / Reassign teachers[admin]).
  Sticky header; sortable columns with aria-sort; Pagination right-aligned.
- ClassFormDialog (Dialog + react-hook-form + zodResolver over the saveClass schema):
  Class name (required), Grade (required), Section (optional), Academic session (Select),
  Assigned teachers (EntityPicker, admin only). Buttons Cancel / "Create class" | "Save changes".
- ConfirmDialog for archive. Toasts (sonner) for create/update/archive/restore.

STATES to render: loading (Skeleton rows), partial (Avg-performance & At-risk cells show
cell-level Skeleton until analytics resolve; un-summarized classes show "—" + tooltip
"No analytics yet — updates after the next nightly run", never a zero), empty
(teacher: "No classes assigned to you yet"; admin: "No classes yet" + New class CTA;
filtered: "No classes match your filters" + Clear filters), error (ErrorState distinct from
empty: "Couldn't load classes" + Retry). Permission gating: teacher sees only managed
classes, no teacher column, gated edit/create; tenantAdmin sees all + teacher column +
Reassign teachers + bulk archive.

RESPONSIVE: lg full table; md drops Spaces/Exams into expandable detail; sm collapses the
table into a stacked Card list (one card/class: name + status Badge, Students + Avg perf,
AtRiskBadge, grade/section + session caption, ⋯ menu), search collapses to an icon,
filters move into a Sheet, "New class" becomes a sticky primary button. Touch targets ≥44px.

DOMAIN RULES to honor: tenantId is derived from claims server-side — never a field, never
shown; cross-tenant data never appears. studentCount, avg performance, and at-risk count are
server-authoritative (classes.list + analytics.getSummary scope class) — NEVER computed on the
client. At-risk comes from the nightly rule engine. Reads via @levelup/api-client repos; writes
ONLY via v1.identity.saveClass callable — no direct client Firestore writes. Do not embed
authoring or grading; link out via row → /classes/:classId.

A11y: real <table> with scope+aria-sort; rows are single Enter-activatable links with aria-label;
icon buttons labeled; AtRiskBadge never color-only (icon + number + sr-only text); WCAG AA
contrast; reduced-motion = opacity-only. Output clean, accessible React + the shared-ui
components, mapped to the Lyceum tokens.
```
