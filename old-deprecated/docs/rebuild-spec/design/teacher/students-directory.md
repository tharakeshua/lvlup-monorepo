# Students Directory

> A cross-class, searchable, filterable register of every student the signed-in
> teacher (or tenant admin) is allowed to see — built to locate any student in
> seconds, jump to their report, and do light roster admin without leaving the
> table.

**Route** `/students` · **Roles** `teacher`, `tenantAdmin` · **Primary APIs**
`students.list` (repo read) · `classes.list` (filter facets) ·
`analytics.getSummary` `scope: 'student'` (score / at-risk column) →
`v1.identity.saveStudent` (Add / archive / restore),
`v1.analytics.generateReport` (bulk export), `v1.identity.manageNotifications` /
message callable (bulk message)

This spec conforms to **`design/00-FOUNDATION.md` ("Lyceum / Modern
Scholarly")**. It cites tokens and components by semantic name only — never
re-pasting hex, type, or spacing values. This is a **staff operational
surface**: precise, credible, calm. No gamification celebration chrome lives
here; XP/streak/level state appears only as read-only data a teacher inspects,
never as animated reward.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` or `tenantAdmin` running day-to-day class
operations.

**Job-to-be-done:** "I need to find a specific student — or a cohort of students
— fast, see at a glance how they're doing and whether they need attention, and
then act: open their report, or do light roster admin (add a student,
archive/restore, message or export a selection)."

**Why this screen exists separately from `/classes/:classId`:** ClassDetail is
scoped to one class. The Directory is the **cross-class** view — the single
place to search the entire visible student body, regardless of which class a
student belongs to. It is the entry hub into the per-student report
(`/students/:studentId/report`).

**Explicitly out of scope (link out, do not redesign here):**

- **Authoring** of spaces/story-points/items lives in the SPACES area.
- **Grading** lives in the EXAMS area (GradingReview).
- **Bulk import of students** is an admin provisioning flow — surfaced here as a
  secondary link that routes to the admin import experience
  (`bulkImportStudents`); it is not implemented inline on this screen.
- The **per-student report** itself (deep analytics, history, gamification
  read-out) is its own screen (`students-report.md`).

---

## 2. Entry points & route

**Route:** `/students` (no `navMeta.permission` gate on the route itself — both
roles may read the directory; write actions inside are permission-gated, see
§5/§8). Defined in the teacher-web route manifest with
`allow: ['teacher','tenantAdmin']` and
`navMeta: { group: 'People', label: 'Students', icon: 'users', mobile: true }`.

**Entry points:**

- Sidebar → **People → Students** (active state via longest-prefix match in
  `PlatformLayout`).
- Mobile bottom nav (People).
- CommandPalette (⌘K) → "Students" and direct "Go to student: <name>".
- Deep links from elsewhere (e.g. a class roster "View all students" link, a
  dashboard "at-risk students" InsightCard → `/students?atRisk=true`).
- Row click → `/students/:studentId/report`.

**APIs powering it** (all through `@levelup/api-client` repositories / callable
registry — the UI never imports `firebase/firestore` or calls `httpsCallable`
with a stringly-typed name):

| Concern                         | Call                                                                                                                                                                           | Notes                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Student rows (paged)            | `students.list({ cursor, limit, classId?, status?, atRisk?, q? })`                                                                                                             | Server scopes to caller's visible students (managed classes for teacher; all for admin). Returns the unified `PageRequest`/`pageResponse` fragment (`common-api §7`). Server-side `q`, filter, sort.                                                                 |
| Class filter facets             | `classes.list()`                                                                                                                                                               | Populates the "Class" filter Combobox; teacher receives only managed classes.                                                                                                                                                                                        |
| Overall score + at-risk per row | `analytics.getSummary({ scope: 'student', studentId })`, OR a precomputed `overallScore` / `isAtRisk` / `atRiskReasons` projection returned inline on each `students.list` row | **Prefer precomputed.** Summaries are materialized server-side (`be-analytics §1`); `overallScore` = 60% autograde / 40% levelup. If the row projection omits score, fetch lazily per visible row (see §5 "partial"). **Never compute score or risk on the client.** |
| Add / edit / archive / restore  | `v1.identity.saveStudent`                                                                                                                                                      | Upsert convention (no `id` = create; `id` = update; `data.status` transition for archive/restore). Server provisions membership + claims + syncs `managedClassIds`.                                                                                                  |
| Bulk message                    | `v1.identity.manageNotifications` (or the messaging callable)                                                                                                                  | Permission-gated; one server call with the selected `studentIds`.                                                                                                                                                                                                    |
| Bulk export                     | `v1.analytics.generateReport({ type: 'class'                                                                                                                                   | 'progress', studentIds })`                                                                                                                                                                                                                                           | Returns `{ pdfUrl, expiresAt }` (1-hour signed URL). |

---

## 3. Layout (wireframe-as-text)

Rendered inside **`PlatformLayout` → `AppShell`** (sidebar + topbar from
FOUNDATION §5 Navigation). This screen owns only the main content region. Page
gutters and max content width follow FOUNDATION §4 (desktop gutter 32, content
max 1200). Vertical rhythm uses the spacing scale via `gap` (no ad-hoc margins).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · ⌘K search · NotificationBell · profile)│
│ (People │────────────────────────────────────────────────────────────────│
│  active)│  Breadcrumb:  People  ›  Students                                │
│         │                                                                   │
│         │  ┌─ Page header ─────────────────────────────────────────────┐  │
│         │  │ H1 "Students"      [ Import students ↗ ] [ + Add student ] │  │
│         │  │ sub: "N students across your classes"                      │  │
│         │  └───────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         │  ┌─ Toolbar (DataTable controls) ───────────────────────────┐   │
│         │  │ [🔎 Search name, roll, admission no.]  [Class ▾][Status ▾]│   │
│         │  │                                        [At-risk ▾] [Sort ▾]│   │
│         │  └───────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         │  ┌─ BulkActionBar (appears only when rows selected) ─────────┐   │
│         │  │ ☑ 4 selected   [ Message ] [ Export ]        [ Clear ]    │   │
│         │  └───────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         │  ┌─ DataTable ───────────────────────────────────────────────┐  │
│         │  │ ☐ | Student        | Roll | Classes | Status | Score | ⚠ | │  │
│         │  │   |                |      |         |        |       |   | Last│
│         │  │───┼────────────────┼──────┼─────────┼────────┼───────┼───┼────│
│         │  │ ☐ |◯ Aarav Sharma  | 21   | 8-A,Mat | ●Active| 84 ▮▮▮| – |2d  │
│         │  │ ☐ |◯ Diya Nair     | 07   | 9-B     | ●Active| 41 ▮  |⚠️ |9d  │
│         │  │ ☐ |◯ Kabir Rao     | 33   | 8-A     | ◌Arch. | –     | – |31d │
│         │  └───────────────────────────────────────────────────────────┘  │
│         │  ┌─ Pagination ──────────────────────────────────────────────┐  │
│         │  │  Showing 1–20      [‹ Prev]  Page 1      [Next ›]          │  │
│         │  └───────────────────────────────────────────────────────────┘  │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

**Column inventory** (DataTable):

1. **Select** — Checkbox; header checkbox selects all on page.
2. **Student** — `Avatar` (initials) + name (primary) + a muted second line with
   admission/UID. Sortable by name.
3. **Roll** — `Spline Sans Mono` (numeric/tabular), right-aligned. Sortable.
4. **Classes** — up to 2 `Chip`s + "+N" overflow Chip (Popover lists the rest).
   Not the sort key.
5. **Status** — `Badge` with icon + label (`Active` `status.success` ·
   `Archived` `text.muted`/`mastery.notStarted`). Filterable.
6. **Overall score** — mono number 0–100 + a slim `ProgressBar`; color via
   `grade.*` scale by band. `–` (em dash) when no summary yet. Sortable.
   Server-authoritative.
7. **At-risk** — `AtRiskBadge` (icon + "At risk") only when `isAtRisk`;
   Popover/Tooltip lists `atRiskReasons`. Filterable. Never client-computed.
8. **Last active** — relative time (mono), e.g. "2d", "31d", "—". Sortable; this
   is the default sort (most-recent-first) is **off** — default sort is name A→Z
   (deterministic for a register). "Last active" is an opt-in sort.

**Responsive behavior:**

- **lg (≥1024):** full table, all 8 columns, toolbar on one row. BulkActionBar
  is a sticky inline bar above the table.
- **md (768–1023):** table retains Student / Classes / Status / Score / At-risk;
  Roll and Last-active collapse into the Student cell's secondary line. Filters
  collapse into a single **"Filters" Button → Popover/Sheet** (badge shows
  active filter count). Header actions may wrap.
- **sm (<768):** DataTable switches to **stacked cards** (the FOUNDATION
  cross-platform rule §6: table on web → stacked cards on small screens). Each
  card: Avatar + name, roll·classes as a chip row, Status + At-risk badges,
  Score with ProgressBar, "Last active" caption, full-width tap target → report.
  Selection via a per-card Checkbox; BulkActionBar docks to the bottom as a
  `Sheet`/sticky bar. Search stays pinned at top; filters live behind a
  "Filters" Sheet. "Add student" becomes a floating/primary action in the header
  (icon + label, ≥44px touch target).

---

## 4. Components used

All from FOUNDATION §5 inventory / the `shared-ui` data & layout entrypoints
(`webapps-design §2.2`). No bespoke variants invented.

- **Layout / shell:** `PlatformLayout`, `AppShell`, `Sidebar`, `Topbar`,
  `Breadcrumb` (`AppBreadcrumb`), `SkipToContent`, `RouteAnnouncer`,
  `PageLoader`, `OfflineBanner` — provided by the shell, not re-implemented.
- **Data:** **`DataTable`** (owns search, filter, sort, selection, pagination —
  replaces any per-page `usePagination`/`useSort`/`filtered*` plumbing; backed
  by the headless `useDataTable`), **`BulkActionBar`**, **`Pagination`**,
  **`EmptyState`**, **`ErrorState`** (distinct from empty), **`Skeleton`**.
- **Primitives:** `Button` (primary for "Add student" / "Add your first
  student"; ghost for "Import students ↗"; danger never used for archive —
  archive is a reversible status change, uses a `ConfirmDialog` with a neutral
  confirm), `IconButton` (row kebab `DropdownMenu` trigger), `Input` (search,
  with leading search icon), `Combobox`/`Select` (Class, Status, At-risk, Sort),
  `Checkbox` (row + header select), `DropdownMenu` (row actions), `Popover`
  (class overflow, at-risk reasons), `Tooltip`, `Dialog`/`Modal`
  (StudentFormDialog), `ConfirmDialog`, `Sheet` (mobile filters / bulk bar),
  `Card` (mobile stacked rows).
- **Display / domain:** `Avatar`, `Badge`/`Chip`/`Tag` (status, classes),
  `ProgressBar` (score), **`AtRiskBadge`** (domain component — icon + label,
  surfaces `isAtRisk`), `Stat`/`StatCard` is **not** used here (no KPI band on
  the directory; keep it lean), `DefinitionList` only inside the at-risk reasons
  Popover if needed.
- **Forms:** **`StudentFormDialog`** = `Dialog` + RHF (`react-hook-form` +
  `zodResolver`) over the `saveStudent` request schema. Fields: display name,
  roll number, admission number, class assignment (`EntityPicker`/`Combobox` of
  managed classes), status. `tenantId` is **never** a field (derived from claims
  server-side — §8). No answer-key, no XP fields.
- **Feedback:** `Toast` (sonner) for save/archive/restore/export results;
  `InlineAlert`/`Banner` for partial-load notice; `FormFieldError` inside the
  dialog; `LoadingOverlay` only on the dialog during submit, never over the
  whole table.

**Proposed addition:** none. Everything composes from the existing inventory.
(`AtRiskBadge` already exists in §5 domain components / `shared-ui/charts`.)

---

## 5. States

The `DataTable` renders one of: loading / empty / error / partial / success.
Permission and role gate the action affordances, never the read.

**Loading (skeleton):** Toolbar renders enabled (search + filters interactive
immediately, debounced). Table body = `Skeleton` rows (≈10) matching column
widths; mobile = `Skeleton` cards. Header/breadcrumb render instantly (no
full-page spinner). Pagination disabled. Filter facets (`classes.list`) load in
parallel — Class Combobox shows its own small loading state without blocking the
table.

**Empty — no students at all (true empty):** `EmptyState` with `Users` glyph,
title and body in staff tone (§7). For roles/permissions that allow it, a
primary "Add student" CTA + a secondary "Import students ↗" link. For a teacher
with **no managed classes**, the body explains they have no assigned classes yet
and points to their admin (no Add CTA).

**Empty — filtered/search no-match:** distinct copy ("No students match these
filters") + a "Clear filters" Button. Never reuse the true-empty CTA here (don't
invite "Add student" when the user is just searching).

**Error:** `ErrorState` (visually distinct from empty — `status.error` accent,
`InlineAlert`), title + body + "Try again" Button (refetch). Surfaces
`error.details.code`/message via `useApiError` → `ERROR_MESSAGES`
(`common-api §6`). A `TENANT_SUSPENDED`/`PERMISSION_DENIED` code renders a calm
"You don't have access" panel rather than a retry. Errors are **never** rendered
as empty states.

**Partial (score column lazy / summary missing):** Rows render immediately from
`students.list`; the Score and At-risk cells show an inline mini-`Skeleton`
while `analytics.getSummary` resolves per visible row (only if not precomputed).
If a student's summary has never been materialized (new student, no activity),
the cell shows `–` with a Tooltip "No activity yet" — not a zero, not an error.
A top-of-table `Banner` appears only if a batch of summaries fails: "Some scores
couldn't load. [Retry]" — the rest of the table stays usable.

**Success:** Populated table, working sort/filter/search/pagination, row hover
affordance, selectable rows, BulkActionBar on selection.

**Permission-gated variants by role:**

- **`tenantAdmin`:** sees **all** tenant students. "Add student", edit,
  archive/restore, "Import students ↗", bulk message, bulk export all available
  (subject to feature flags).
- **`teacher`:** sees only students in **managed classes** (claim
  `classIds`/`managedClassIds`, with the 15-class overflow fallback resolved
  server-side). Write actions are gated by `TeacherPermissions` via a
  `useCan(permission)` hook:
  - No `manageStudents` permission → "Add student", edit, archive/restore are
    hidden (not merely disabled) and the row kebab shows only "View report".
  - No messaging permission → "Message" omitted from BulkActionBar.
  - No export permission → "Export" omitted.
  - A teacher can always **read** the directory and open reports for their
    managed-class students.
- **Cross-tenant:** impossible by construction — `students.list` is scoped to
  `ctx.activeTenantId`; no student from another tenant can appear, and the
  tenant switcher (Topbar) re-scopes the whole view.

---

## 6. Interactions & motion

Motion is "felt, not seen" (FOUNDATION §4). No celebratory/gamification motion
on this staff screen.

**Search:** debounced (~250ms) server-side query; the table body cross-fades to
the loading skeleton using `fast`/`base` with `ease.standard`. Result count in
the header updates with the new page. Clearing search restores the unfiltered
(paged) list.

**Filter (Class / Status / At-risk):** changing a filter resets pagination to
page 1 and refetches server-side. Active filters show as removable `Chip`s under
the toolbar (md/sm: a count badge on the "Filters" button). "Clear filters"
resets all. Selecting `?atRisk=true` via deep link pre-applies the At-risk
filter and reflects it in the toolbar.

**Sort:** clicking a sortable column header toggles asc/desc with an `aria-sort`
indicator and a small caret that rotates over `instant`. Sort is server-side
(stable, deterministic); default is name A→Z.

**Pagination:** cursor-based (`PageRequest`/`nextCursor`, `common-api §7`).
Prev/Next; the table body swaps with a `fast` cross-fade. Keep selection scoped
to the current page (selection does not silently persist across pages — see bulk
actions).

**Row → report:** clicking a row (anywhere outside the checkbox/kebab) navigates
to `/students/:studentId/report` with a `PageTransition` (`page` duration,
`ease.entrance`). Row hover raises to `e1`→subtle highlight; keyboard focus
shows the focus ring (`border.focus`, 3px @35%).

**Row actions (kebab `DropdownMenu`):** View report · Edit (perm) ·
Archive/Restore (perm). Menu opens with `fast` `ease.entrance`.

**Add / Edit student:**

1. "Add student" (or row → Edit) opens `StudentFormDialog` (`Modal` at `e3`,
   scrim fade `base`, content `ease.entrance`).
2. RHF validates against the `saveStudent` Zod schema; `FormFieldError` inline;
   the primary submit shows a `LoadingOverlay` only over the dialog.
3. On submit → `v1.identity.saveStudent`. **Optimistic insert/patch** of the row
   with rollback on failure; the narrowest query key is invalidated
   (`studentKeys.list(filters)`), not the whole tenant scope.
4. Success → dialog closes, `Toast` "Student added" / "Changes saved", the
   new/updated row briefly highlights (a one-shot `base` background fade — not a
   spark burst).
5. Failure → dialog stays open, optimistic change rolled back,
   `FormFieldError`/`Toast` from the typed error envelope (`validationErrors`
   mapped to fields).

**Archive / Restore:** kebab → Archive opens a `ConfirmDialog` ("Archive this
student? They'll be hidden from active rosters. You can restore them anytime.").
Confirm → `saveStudent({ id, data: { status: 'archived' } })`, optimistic status
flip, `Toast` with an **Undo** action (calls restore). Restore mirrors this.
Archive is reversible, so the confirm uses a neutral (not danger) primary.

**Bulk actions:** selecting rows raises the `BulkActionBar` (slide/fade in,
`base`, `ease.entrance`) showing the count. **Message** → composer Modal → one
server call with selected `studentIds` → `Toast` "Message sent to N students".
**Export** → `generateReport` → button enters a loading state, then `Toast` with
a "Download" action opening the signed `pdfUrl` (1-hour). Because pagination is
cursor-based, the bar shows "N selected on this page"; a "Select all matching
(M)" affordance (admin, when a filter is active) escalates to a server-side
selection for export/message. "Clear" deselects.

**Reduced motion:** `prefers-reduced-motion` removes cross-fades, slide-ins, and
the row highlight pulse — state changes are instant; focus rings and `aria-live`
announcements remain.

---

## 7. Content & copy

Tone: precise, professional, calm. No exclamation marks, no gamified language.

**Header**

- H1: **Students**
- Subtitle (admin): "All students in {tenantName} — {N} total."
- Subtitle (teacher): "Students across the classes you manage — {N} total."
- Primary button: **Add student**
- Secondary link: **Import students ↗** (tooltip: "Bulk-add students via the
  admin import tool")

**Toolbar**

- Search placeholder: **Search by name, roll, or admission number**
- Class filter label: **Class** (default option "All classes")
- Status filter label: **Status** (options: All · Active · Archived)
- At-risk filter label: **At risk** (options: All · At risk only · Not at risk)
- Sort label: **Sort** (Name A–Z · Name Z–A · Score high–low · Score low–high ·
  Recently active)

**Column headers:** Student · Roll · Classes · Status · Overall score · At risk
· Last active

**Cell copy**

- Status badges: **Active** · **Archived**
- At-risk badge label: **At risk** (Tooltip header: "Flagged by the nightly
  review", body lists reasons, e.g. "Low recent scores", "No activity in 14
  days")
- Score empty: **—** (Tooltip: "No activity yet")
- Last active: relative ("2d", "3w") · empty: **—** (Tooltip: "No recorded
  activity")
- Class overflow chip Popover header: "All classes"

**Empty — true empty (admin/perm):**

- Title: **No students yet**
- Body: "Add your first student, or import a roster to get started."
- CTA: **Add student** · link: **Import students ↗**

**Empty — teacher, no managed classes:**

- Title: **No classes assigned to you yet**
- Body: "Once you're assigned to a class, its students will appear here. Contact
  your administrator if this looks wrong."

**Empty — filtered no-match:**

- Title: **No students match these filters**
- Body: "Try a different search or clear the filters."
- Action: **Clear filters**

**Error:**

- Title: **Couldn't load students**
- Body: "Something went wrong fetching the directory. This isn't your fault."
- Action: **Try again**
- Permission/suspended variant title: **You don't have access to this** / body:
  "Your role doesn't permit viewing this directory."

**Partial score banner:** "Some scores couldn't load right now. **Retry**"

**Dialogs / toasts**

- Add dialog title: **Add student** · Edit: **Edit student** · submit: **Save**
- Toasts: "Student added" · "Changes saved" · "Student archived" (with **Undo**)
  · "Student restored" · "Message sent to {N} students" · "Report ready" (with
  **Download**)
- Archive confirm: title **Archive student?** · body "They'll be hidden from
  active rosters. You can restore them anytime." · confirm **Archive** · cancel
  **Cancel**

---

## 8. Domain rules surfaced

- **Tenant isolation:** every row, facet, and write is scoped to the caller's
  active tenant via server-derived `ctx.activeTenantId`. `tenantId` is **never**
  a form field or query param the client controls (`common-api §4.4`). Switching
  tenants (Topbar) re-scopes the entire directory. Cross-tenant students can
  never appear.
- **Role-scoped visibility:** `teacher` sees only students in their managed
  classes (`classIds`/`managedClassIds` claim, with the
  `MAX_CLAIM_CLASS_IDS = 15` overflow → membership-doc fallback resolved
  **server-side**, never in the client). `tenantAdmin` sees all tenant students.
  Enforced by `students.list` server-side; the UI does not filter for security,
  only for UX.
- **Reads = repositories, writes = callables.** No direct client Firestore
  writes. Add/edit/archive/restore go through `v1.identity.saveStudent`, which
  provisions/updates membership + claims and runs `syncMembershipClaims` (closes
  the stale-`managedClassIds` drift in `auth-access §4.2`). The client never
  writes student/membership docs (`/userMemberships` is
  write-never-from-client).
- **Server-authoritative analytics.** `overallScore`, `isAtRisk`, and
  `atRiskReasons` come from precomputed summaries / the nightly at-risk rule
  engine (`be-analytics §1`, §3). The client **never** recomputes score or risk
  — it only displays `isAtRisk` + reasons. A missing summary renders `—` ("No
  activity yet"), not `0`.
- **At-risk is read-only here.** The Directory surfaces the flag for triage; it
  does not let a teacher set/clear risk. Reasons come verbatim from
  `atRiskReasons` (the enum the rule engine actually emits).
- **Gamification stays read-only and off-surface.** No XP/streak/level chrome on
  this staff screen. (Those appear only inside the student's report, presented
  as data.)
- **Bulk import is an admin flow** — the Directory links out to it
  (`bulkImportStudents`); it is not performed inline.
- **Answer keys / exam results** are not exposed here at all; this screen never
  touches submission internals. (Stated for completeness — results-released
  gating lives in the EXAMS area.)
- **Defense-in-depth:** Firestore rules remain the backstop; the API layer is
  the business-rule layer. The UI assumes the server is the source of truth and
  treats any client-side filter as cosmetic.

---

## 9. Accessibility

Targets WCAG AA (FOUNDATION §2.3 contrast; never status-by-color-alone — every
Badge/AtRiskBadge pairs icon + text label).

- **Landmarks & skip:** `SkipToContent` jumps to the table region;
  `RouteAnnouncer` announces "Students" on navigation. The main region is a
  `<main>` with an accessible name; the table is a real `<table>` (or
  `role="grid"` from the `DataTable` primitive) with a `<caption>`/`aria-label`
  "Students directory".
- **Focus order:** Breadcrumb → header actions (Import, Add) → search → filters
  (Class, Status, At-risk, Sort) → BulkActionBar (when present) → header
  select-all checkbox → row cells → pagination. Logical, top-to-bottom,
  left-to-right.
- **Keyboard:**
  - Search reachable by Tab; `Esc` clears focus.
  - Filters/Sort are Combobox/Select — full arrow-key + type-ahead + `Esc`
    support from the primitive.
  - Sortable headers are focusable buttons; `Enter`/`Space` toggles sort;
    `aria-sort` reflects state.
  - Row navigation: arrow keys move between rows (grid semantics); `Enter` on a
    focused row opens the report; the row checkbox is `Space`-togglable; the
    kebab opens with `Enter` and is arrow-navigable.
  - Select-all (header checkbox) has an indeterminate state with correct
    `aria-checked="mixed"`.
  - Dialogs (`StudentFormDialog`, `ConfirmDialog`) trap focus, restore focus to
    the trigger on close, close on `Esc`, and label fields/errors via
    `aria-describedby` (`FormFieldError`).
- **ARIA & live regions:** filter/search result changes announce row count via
  an `aria-live="polite"` status ("Showing 1–20 of 84 students"). The score
  lazy-load and partial-error banner are `aria-live="polite"`. The BulkActionBar
  count is announced on selection change. Icon-only controls (search icon
  decorative `aria-hidden`; kebab IconButton has
  `aria-label="Actions for {name}"`).
- **Contrast:** Score color bands (`grade.*`) meet 3:1 for the UI element and
  are reinforced by the numeric value and ProgressBar position — color is never
  the only signal. `text.muted` is used only where AA-large applies.
- **Touch targets:** ≥44px on mobile (checkboxes, kebab, row tap area, Add
  button) per FOUNDATION §4.
- **Reduced motion:** `prefers-reduced-motion` disables cross-fades, slide-ins,
  the new-row highlight, and the caret rotation; everything resolves instantly
  while preserving focus management and announcements.

---

## 10. Web↔mobile divergence (RN parity)

Component **names and props match 1:1** between `shared-ui` (web) and
`ui-native` (RN); only the renderer differs (FOUNDATION §6). The same headless
`useDataTable` + the same `students.list`/`getSummary` hooks (over
`@levelup/api-client`) drive both.

- **Table → cards:** web renders the full `DataTable`; RN (and web <sm) renders
  **stacked `Card` rows** with the same fields. Selection, sort, filter live
  behind native controls.
- **Hover → press:** RN has no hover; row affordance is the press/active state;
  the kebab becomes a long-press or an explicit "⋯" `IconButton` opening an
  action `Sheet`.
- **Filters/Sort:** web Combobox/Select popovers → RN bottom `Sheet` pickers
  (same options, same data source).
- **Bulk bar:** web sticky inline `BulkActionBar` → RN bottom-docked action
  bar/`Sheet`.
- **⌘K command palette → absent on RN** (no global palette); student search is
  the in-screen search field (FOUNDATION §6 example divergence).
- **Pagination:** web Prev/Next pager → RN infinite-scroll/"Load more" consuming
  the same `nextCursor` cursor — identical paging contract (`common-api §7`).
- **Export/report download:** web opens the signed `pdfUrl` in a new tab; RN
  hands the URL to the native share/download sheet.
- **Permission gating, tenant scoping, and at-risk/score read-only semantics are
  identical** across platforms (enforced server-side; the client only renders).

---

## 11. A Claude-design prompt

```
You are designing the "Students Directory" screen for the Auto-LevelUp TEACHER
operational web portal. Conform EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md and to this spec
(docs/rebuild-spec/design/teacher/students-directory.md). Do NOT invent tokens,
fonts, colors, spacing, radius, elevation, or component variants — compose ONLY
from FOUNDATION §5 / the shared-ui inventory, citing semantic token names
(bg.surface, text.secondary, brand.primary, status.error, grade.*, mastery.*,
border.focus) — never hardcode hex.

CONTEXT
- Route /students. Staff tool. Roles: teacher and tenantAdmin. Tone: precise,
  credible, calm. NO gamification/celebration chrome. Fonts: Fraunces (display),
  Schibsted Grotesk (UI/body), Spline Sans Mono (numbers/roll/score/last-active).
- It is a cross-class searchable register: locate any student fast, jump to their
  report (/students/:studentId/report), do light roster admin.

BUILD
- Render inside PlatformLayout/AppShell (sidebar People→Students active, topbar
  with tenant switcher + ⌘K search + notifications + profile, breadcrumb
  "People › Students").
- Page header: H1 "Students", a role-aware subtitle with a total count, a ghost
  "Import students ↗" link, and a primary "Add student" button (permission-gated).
- A DataTable (shared-ui/data — owns search, filter, sort, selection, pagination)
  with columns: Select · Student (Avatar + name + muted admission/UID) · Roll
  (mono) · Classes (≤2 Chips + "+N" Popover) · Status (Badge: Active/Archived,
  icon+label) · Overall score (mono 0–100 + slim ProgressBar, colored by grade.*
  bands, "—" when no summary) · At risk (AtRiskBadge with a reasons Tooltip, only
  when isAtRisk) · Last active (relative, mono). Default sort: name A–Z.
- Toolbar: search Input ("Search by name, roll, or admission number") + Combobox
  filters for Class / Status / At risk + Sort. A BulkActionBar appears on
  selection with Message and Export (permission-gated) and Clear.
- States: skeleton rows while loading; distinct EmptyState (true-empty with
  "Add student" + "Import students ↗"; teacher-no-classes; and filtered-no-match
  with "Clear filters"); ErrorState distinct from empty with "Try again"; a
  partial state where the Score/At-risk cells show mini-skeletons then resolve,
  or "—" with a "No activity yet" tooltip.
- Row click → report (PageTransition). Row kebab DropdownMenu: View report / Edit /
  Archive (ConfirmDialog, reversible, Undo toast). "Add student" opens a
  StudentFormDialog (RHF + zodResolver over saveStudent; NO tenantId field).

RESPONSIVE: lg full table; md collapse Roll/Last-active into the Student cell and
move filters behind a "Filters" Popover; sm switch to stacked Cards with a
bottom-docked bulk Sheet. Touch targets ≥44px.

MOTION: FOUNDATION tokens only (fast/base, ease.standard/entrance). Subtle
cross-fades on data swap; no spark/celebration. Honor prefers-reduced-motion.

ACCESSIBILITY: real table/grid semantics with aria-sort, aria-live row-count
announcements, focus order (header→search→filters→table→pagination), keyboard
row nav (arrows/Enter), labeled icon buttons, AA contrast, status never by color
alone.

DATA/RULES (display only — never compute on client): students.list (paged,
server-scoped to the caller's visible students), classes.list (filter facets),
analytics.getSummary scope=student (overallScore + isAtRisk + atRiskReasons,
precomputed server-side). Writes via v1.identity.saveStudent (add/edit/archive),
generateReport (export), manageNotifications (message). Tenant is derived from
claims server-side and never shown. Teacher sees only managed-class students;
tenantAdmin sees all. Gate write actions on TeacherPermissions (hide, don't just
disable).

Output a single React + Tailwind screen composed from shared-ui components,
production-ready, matching the Lyceum aesthetic.
```
