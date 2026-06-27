# Class Detail — Admin (`tenantAdmin`)

> **Design system:** Lyceum. Conforms to
> `docs/rebuild-spec/design/00-FOUNDATION.md`. All colors, type, spacing, radii,
> elevation, motion, and components are cited by semantic token / §5 component
> name — no raw hex, no invented variants. Register: **precise / credible admin
> chrome** (the serious register), not the playful student register. **Area:**
> `admin` · **Slug:** `class-detail` · **Audience:** tenant administrators (one
> tenant, scoped).

---

## 1. Purpose & primary user

**Primary user:** a tenant administrator (`tenantAdmin` role) — a school/academy
admin scoped to exactly one tenant. (Super-admin may view via cross-tenant
impersonation but operates from the platform control plane, not this screen; see
§8.)

**Job-to-be-done:** "Give me one authoritative view of a single class so I can
confirm and adjust who is in it (roster), who teaches it (assigned teachers),
what learning and assessment is attached to it (linked spaces/courses/exams),
when it runs (schedule), and how it is configured (class-level settings) — and
let me make roster/teacher changes safely without leaving the page."

The current live page (`apps/admin-web/src/pages/ClassDetailPage.tsx`) is
**read-only**: it derives enrolled students from `Student.classIds`, assigned
teachers from `Class.teacherIds`, and lists up to 5 linked exams/spaces, with
four read-only tabs (Students / Teachers / Exams / Spaces). This rebuild keeps
that deep-view spine and adds the **write** affordances called out in the scope
(add/remove students, assign/unassign teachers, class settings) plus an explicit
**Schedule** section. The class header surfaces grade, section, academic
session, and `status` (`active | archived`).

---

## 2. Entry points & route

**Route:** `/classes/:classId` (`ClassDetailPage`), declared in
`apps/admin-web/src/App.tsx`, rendered inside the authenticated `AppLayout`
shell.

**Entry points:**

- Row click / "View" from `/classes` (`ClassesPage`).
- Breadcrumb deep-link: Dashboard › Classes › _{class name}_.
- ⌘K command palette (web-only) → "Go to class…" → class picker.
- Notifications / activity that reference a class (e.g. rollover, bulk import
  completion).

**Reads (via `packages/shared-hooks` → `api-client`, per `specs/common-api.md`
§3.3, §5.3 — no direct Firestore reads in the rebuild).** The live page composes
from broad list hooks (`useClasses`, `useTeachers`, `useStudents`, `useExams`,
`useSpaces`, `useAcademicSessions`) and filters client-side. In the rebuild this
is replaced by scoped, server-aggregated reads:

| Need                  | Rebuild callable (common-api §3.3)                                                              | Notes                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| The class doc         | `v1.identity.getClass` _(proposed read endpoint, see §4)_ or `v1.identity.listClasses` filtered | `tenantId` derived from `ctx.activeTenantId`, **not** body (§4.4)                     |
| Enrolled students     | `v1.identity.listStudents` (scoped to `classId`)                                                | server filters `Student.classIds.includes(classId)`; paginated (§7)                   |
| Assigned teachers     | `v1.identity.listTeachers` (scoped to `classId`)                                                | resolves `Class.teacherIds` server-side; folds in `subjects`, `designation`, `status` |
| Linked exams          | `v1.autograde.listExams` (scoped to `classId`)                                                  | released-only fields irrelevant here (admin gets full projection)                     |
| Linked spaces/courses | `v1.levelup.listSpaces` (scoped to `classId`)                                                   | one concept (Spaces) — "Courses" is the same collection (status report §4.3)          |
| Academic session name | `v1.identity.listAcademicSessions`                                                              | resolve `Class.academicSessionId → name`                                              |
| (optional) class KPIs | `v1.analytics.getSummary` `{ scope: 'class' }`                                                  | avg score / at-risk count strip (see §4, proposed)                                    |

**Writes (callables, common-api §3.3 — all go through `api-client`, never raw
`httpsCallable`):**

| Action                                                      | Callable                                                                                                                          | Contract notes                                                                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add / remove students                                       | `v1.identity.saveStudent` (per student `classIds` upsert) **or** `v1.identity.bulkUpdateStatus` / a `bulkAssignClass` op for many | `save*` upsert convention; server must call `syncMembershipClaims` so the moved student's JWT `classIds` refresh (auth-access §4.2, common-api §4.5) |
| Assign / unassign teacher                                   | `v1.identity.saveClass` (`teacherIds[]`) and/or `v1.identity.saveTeacher` (`classIds[]`)                                          | both sides must stay consistent; claims re-synced server-side                                                                                        |
| Edit class settings (name, grade, section, session, status) | `v1.identity.saveClass`                                                                                                           | `id` present ⇒ update; `status` transition `active ⇄ archived` is server-validated                                                                   |
| Archive / restore class                                     | `v1.identity.saveClass` (`status`)                                                                                                | confirmation required (§6)                                                                                                                           |
| Bulk import students into class                             | `v1.identity.bulkImportStudents`                                                                                                  | CSV path, idempotent, batched                                                                                                                        |

All writes are tenant-scoped server-side; `tenantId` comes from the caller's
active-tenant claim (common-api §4.4), and Firestore rules remain
defense-in-depth (`isTenantAdmin(tenantId)` on class/student/teacher
subcollections — auth-access §1.5/§2).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar** (admin
nav groups: Overview / Management / Analytics / Configuration), **Topbar**
(tenant switcher, search, NotificationBell, profile). This screen owns the
content region only.

Content region uses the page grid (max content width **1200**, desktop gutter
**32**, vertical rhythm via `gap` tokens `space.6`/`space.8` — never ad-hoc
margins).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AppShell: Sidebar │  Topbar (tenant switcher · search · bell · profile)    │
├───────────────────┴──────────────────────────────────────────────────────┤
│ Breadcrumb:  Dashboard ›  Classes ›  Grade 9 — Section A                   │
│                                                                            │
│ ┌── Header band ───────────────────────────────────────────────────────┐  │
│ │ [‹ Back]  Grade 9 — Section A   [Badge: Active]      [Edit] [Archive] │  │
│ │ Grade 9 · Section A · 2025–26 Session                  (primary CTAs)  │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Stat ─┐ ┌─ Stat ─┐ ┌─ Stat ─┐ ┌─ Stat ─┐   (4 KPI cards)              │
│ │Students│ │Teachers│ │ Exams  │ │ Spaces │                               │
│ │   28   │ │   3    │ │   5    │ │   4    │                               │
│ └────────┘ └────────┘ └────────┘ └────────┘                               │
│                                                                            │
│ Tabs:  [ Students ]  [ Teachers ]  [ Exams ]  [ Spaces ]  [ Settings ]    │
│ ──────────────────────────────────────────────────────────────────────── │
│ ┌── Active tab panel (Students shown) ─────────────────────────────────┐  │
│ │  [Search students…]            [+ Add students] [Import CSV]          │  │
│ │  ┌────────────────────────────────────────────────────────────────┐  │  │
│ │  │ ☐ │ Name        │ Roll No │ Grade │ Status   │  (row actions ⋯) │  │  │
│ │  │ ☐ │ Aisha Khan  │ 09A-014 │  9    │ ● Active │      Remove      │  │  │
│ │  │ … (DataTable: sort / filter / select / paginate)                │  │  │
│ │  └────────────────────────────────────────────────────────────────┘  │  │
│ │  ── floating bar when rows selected: [3 selected] [Remove] [Move…] ── │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

**Responsive behaviour:**

- **lg (≥1024) / xl:** layout as drawn. KPI strip is a 4-up grid. Tabs
  horizontal. DataTable shows all columns; row actions inline.
- **md (768–1023):** KPI strip 2×2. Tabs remain horizontal (may scroll-x with a
  fade edge). Table keeps key columns (Name, Roll/Subjects, Status); secondary
  columns collapse into a row-expand or `⋯` menu. Header CTAs may wrap below the
  title.
- **sm (<768):** single column, page gutter **16**. KPI strip becomes a
  horizontally scrollable rail of Stat cards or a 2-up grid. Tabs become a
  scrollable segmented control. **DataTable → stacked record cards** (Foundation
  §6 rule: table on web → stacked cards on mobile): each student/teacher renders
  as a Card with label:value DefinitionList and a single overflow action.
  Selection mode toggles a top action bar. Admin is desktop-first (see §10) —
  small screens are functional, not the primary target.

The **Settings** tab is a `Section`-based form (DefinitionList in read mode →
inline form in edit mode), full-width single column capped to reading measure
(~720) so label/control pairs don't sprawl.

---

## 4. Components used (Foundation §5 only)

**Navigation:** `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb`, `CommandPalette`
(⌘K, web-only).

**Containers:** `Card` (KPI stats, mobile record cards, header band), `Section`
(Settings groups), `Tabs` (Students / Teachers / Exams / Spaces / Settings),
`Modal/Dialog` (Add students, Edit settings), `Drawer/Sheet` (mobile
add-students picker, optional), `Popover` (row `⋯` menu), `Tooltip` (status /
disabled-action hints), `ConfirmDialog` (remove / archive).

**Data:** `DataTable` (sort/filter/select/paginate — the rebuild's shared
primitive replacing the per-tab hand-rolled `<Table>` plumbing, status report
§4.4), `DefinitionList` (header meta + Settings read view), `Stat/KPI` (the 4
count cards), `EmptyState`, `Skeleton`, `Pagination`, `Avatar` / `AvatarGroup`
(assigned teachers), `Badge`, `Chip/Tag` (teacher subjects), `Combobox`
(student/teacher picker in Add dialogs).

**Primitives:** `Button` (`primary` for Add/Save, `secondary` for Edit, `ghost`
for Back, `danger` for Remove/Archive), `IconButton` (row `⋯`, back), `Input`
(table search), `Select` (status/session/grade in Settings), `Checkbox` (row
selection), `FileDrop` (Import CSV).

**Feedback:** `Toast` (sonner — success/failure of mutations),
`InlineAlert/Banner` (archived-class read-only notice; partial-load warning),
`ConfirmDialog`, `FormFieldError`, `LoadingOverlay` (during dialog submit).

**Domain components:** `AtRiskBadge` (optional, on student rows if
`v1.analytics.getSummary class` is wired — see proposed below), `GradePill`
(optional, exam tab average).

**Proposed foundation/spec additions (flagged, not silently invented):**

1. **Schedule section data + UI.** The current `Class` type
   (`packages/shared-types/src/tenant/class.ts`) has **no schedule fields**
   (only `grade`, `section`, `academicSessionId`, `teacherIds[]`,
   `studentIds[]`, `studentCount`, `status`). The scope's "schedule" therefore
   requires a **new `Class.schedule` field** (e.g.
   `{ days[], startTime, endTime, room }`) and is rendered with existing
   `Timeline` / `DefinitionList` + `DatePicker`/`Select` primitives — **no new
   component**, but a **schema addition** that must be added to `shared-types`
   and the `saveClass` contract first. Until then, the Schedule sub-section
   renders an `EmptyState` ("No schedule configured").
2. **Class KPI strip enrichment** (avg score, at-risk count) needs
   `v1.analytics.getSummary { scope: 'class' }`; composed from existing
   `Stat/KPI`, `GradePill`, `AtRiskBadge` — no new component.

No new colors, type, radii, shadows, or motion are introduced.

---

## 5. States

**Loading (skeleton):** Replace the live page's bare "Loading class details…"
text (`ClassDetailPage.tsx:95-101`) with structured `Skeleton`: breadcrumb
shimmer → header band (title bar + status pill placeholder) → 4 `Stat` skeletons
→ tab bar → 6–8 skeleton table rows. Skeletons use `bg.surface-sunken` with a
subtle shimmer; respect `prefers-reduced-motion` (static placeholder, no shimmer
sweep).

**Empty:**

- **Class not found** (keep live behaviour, `ClassDetailPage.tsx:103-117`):
  `EmptyState` titled "Class not found" with body "This class doesn't exist or
  has been removed." and a `ghost` "Back to Classes" button. Display-serif
  (`Fraunces`) title.
- **No students:** `EmptyState` in the Students tab — illustration-light, title
  "No students enrolled yet", body + primary `Button` "Add students" and
  secondary "Import CSV".
- **No teachers:** "No teachers assigned" + "Assign a teacher".
- **No exams / No spaces:** "No exams linked to this class" / "No spaces linked
  to this class" — these are typically read-only from here (creation lives in
  teacher-web), so the empty state is informational, no primary CTA (or a
  `ghost` link to the exams/spaces overview).

**Error:** A global React Query error boundary (common-api §6.3) surfaces
non-empty-state failures as an `InlineAlert` (variant `error`, `status.error` +
alert icon + label — never color alone) with a "Retry" `Button`. Per-mutation
failures raise a `Toast` (error) whose copy derives from `error.details.code` →
`ERROR_MESSAGES` (e.g. `PERMISSION_DENIED`, `QUOTA_EXCEEDED`,
`INVALID_TRANSITION`, `TENANT_SUSPENDED`).

**Partial:** If the class doc loads but a secondary read fails (e.g. teachers
list errors while students succeed), render loaded panels normally and scope the
failure to the affected tab: a small `InlineAlert` inside that tab panel
("Couldn't load teachers. Retry.") instead of failing the whole page. KPI counts
for a failed source show an em-dash placeholder, not `0`, with a tooltip
"Unavailable".

**Success:** Header, KPIs, and the active tab's `DataTable` (or stacked cards on
mobile) render fully; counts in tab labels match server totals.

**Permission-gated variations (RBAC):**

- **`tenantAdmin` (primary):** full read + write — Add/Remove students,
  assign/unassign teachers, edit settings, archive/restore.
- **`staff` with limited `StaffPermissions`** (e.g. no `canManageUsers`):
  roster/teacher **write** controls are hidden or rendered disabled with a
  `Tooltip` ("You don't have permission to change the roster"); read view stays.
  Drive this off a `useCan(permission)` hook (status report rec #9) — never
  expose a control the server will reject.
- **Archived class:** entire screen enters a **read-only** affordance — a top
  `InlineAlert` ("This class is archived. Restore it to make changes.") + write
  buttons disabled except a single `primary` "Restore". Mirrors server `status`
  state machine.
- **Super-admin (impersonating):** identical UI but the Topbar carries the
  cross-tenant impersonation indicator; actions are audit-logged (§8).

---

## 6. Interactions & motion (Foundation §4 motion tokens)

**Tab switch:** content cross-fades / slides with `fast 160ms`, `ease.standard`.
Active tab indicator slides under the label (`base 220ms`, `ease.standard`). Tab
state is URL-synced (`?tab=teachers`) so deep-links and back/forward work.

**Add students flow:**

1. Click `primary` "Add students" → `Modal/Dialog` enters (`base 220ms`,
   `ease.entrance`, scrim fade, elevation `e3`).
2. Inside: a `Combobox` (search tenant students not already in this class) with
   multi-select chips; or `FileDrop` for CSV.
3. Confirm → **optimistic update**: selected students appear immediately in the
   roster table and the Students KPI/tab count increments; the affected rows
   show a subtle "pending" treatment (reduced opacity + inline spinner) until
   `v1.identity.saveStudent`/`bulkImportStudents` resolves. On success: rows
   settle, `Toast` "Added 3 students to Grade 9 — Section A." On failure:
   optimistic rows roll back, `Toast` error with recovery hint; nothing is left
   in a half-state.

**Remove student:** row `⋯` → "Remove from class" → `ConfirmDialog` ("Remove
Aisha Khan from this class? They'll lose access to this class's spaces and
exams."). Confirm → optimistic removal; server re-syncs the student's claims
(auth-access §4.2). Bulk: select rows → floating action bar (`Move…` / `Remove`)
— destructive action is `danger` variant and always confirmed.

**Assign / unassign teacher:** same dialog/optimistic pattern; `AvatarGroup` in
the header animates the added/removed avatar with a small `fast` fade (no
celebratory motion — this is admin chrome, the restrained register; the marigold
`spark` celebratory pop is reserved for student gamification only, §4).

**Edit settings:** Settings tab "Edit" toggles `DefinitionList` read view →
inline form (`Input`/`Select`). "Save" → `LoadingOverlay` on the section,
`saveClass`, then `Toast` "Class settings updated." Cancel restores read view
with no write.

**Archive / Restore:** `danger` "Archive" → `ConfirmDialog` ("Archive Grade 9 —
Section A? Students and teachers stay assigned, but the class becomes
read-only."). On success the header `Badge` flips to "Archived"
(status.warning-tinted neutral) and the read-only banner appears.

**Feedback model:** all mutations confirm via `Toast` (sonner); destructive ones
via `ConfirmDialog` first; long ops show `LoadingOverlay`. Motion stays subtle
(`instant`/`fast`/`base`); `prefers-reduced-motion` collapses transitions to
opacity-only or none.

---

## 7. Content & copy (precise admin tone)

**Header:** class `name` (e.g. "Grade 9 — Section A") + status `Badge` ("Active"
/ "Archived"). Sub-line (DefinitionList-style):
`Grade {grade} · Section {section} · {sessionName}` — em-dash (—) for any
missing piece (keep live `—` convention).

**KPI cards:** labels "Students", "Teachers", "Exams", "Spaces". Numerics in
mono (`Spline Sans Mono`).

**Tabs:** "Students ({n})", "Teachers ({n})", "Exams", "Spaces", "Settings".

**Students table headers:** Name · Roll Number · Grade · Status. **Teachers:**
Name · Subjects · Designation · Status. **Exams:** Title · Subject · Date ·
Total Marks · Status. **Spaces:** Title · Type · Subject · Status. (Matches live
columns; missing values → "—".)

**Buttons:** "Add students", "Import CSV", "Assign teacher", "Edit", "Save
changes", "Cancel", "Archive class", "Restore class", "Remove from class", "Back
to Classes".

**Empty-state copy:**

- Students: title "No students enrolled yet" · body "Add students to this class
  or import a roster from CSV." · CTA "Add students".
- Teachers: title "No teachers assigned" · body "Assign at least one teacher so
  this class can run exams and spaces." · CTA "Assign teacher".
- Exams: title "No exams linked" · body "Exams created for this class will
  appear here."
- Spaces: title "No spaces linked" · body "Learning spaces assigned to this
  class will appear here."
- Not found: title "Class not found" · body "This class doesn't exist or has
  been removed." · CTA "Back to Classes".
- Schedule (proposed): title "No schedule configured" · body "Add class timings
  to show them here."

**Error copy (derived from `AppErrorCode` → `ERROR_MESSAGES`):**

- Generic load: "We couldn't load this class. Retry." (InlineAlert + Retry).
- Permission: "You don't have permission to change the roster."
  (disabled-control Tooltip / toast).
- Archived write attempt: "This class is archived. Restore it to make changes."
- Mutation failure: "Couldn't add students. {recovery hint}" / "Couldn't remove
  {name}. Try again."

Tone throughout: factual, second person, no exclamation marks, no emoji, no
playful copy. This is staff tooling.

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** Every read and write is scoped to the
   caller's active tenant; `tenantId` is derived server-side from claims, never
   trusted from the request body (common-api §4.4). Firestore rules
   (`isTenantAdmin(tenantId)`) remain defense-in-depth on class/student/teacher
   subcollections (auth-access §1.5/§2). A `tenantAdmin` can only ever see/edit
   classes within their one tenant; cross-tenant access is impossible from this
   screen.
2. **RBAC gating.** Write affordances are gated by role + granular
   `StaffPermissions`/`TeacherPermissions` via a `useCan()` hook; the UI never
   renders a control the server would reject (status report rec #9). Super-admin
   cross-tenant viewing uses explicit `tenantOverride` and is audited
   (common-api §4.4, §9).
3. **Server-authoritative roster & counts.** `studentCount`, enrollment, and
   `teacherIds` are server-owned. Optimistic UI is allowed but the server
   response is the source of truth; on mismatch the UI reconciles to the server
   value.
4. **Claims re-sync on membership change.** Moving a student into/out of a
   class, or assigning/unassigning a teacher, must trigger
   `syncMembershipClaims` server-side so the affected user's JWT `classIds` (and
   thus their class/space/exam visibility) are correct — closing the known
   stale-claims drift bug (auth-access §4.2, common-api §4.5). The UI may
   surface "Access updates may take a moment to propagate" only if needed.
5. **Status state machine.** `Class.status` transitions `active ⇄ archived` are
   server-validated; an invalid transition returns `INVALID_TRANSITION`
   (common-api §6.2). Archived classes are read-only in the UI.
6. **Answer keys never shown.** Linked exams list metadata only (title, subject,
   date, marks, status). Answer keys / rubric solutions are server-only and
   never reach this admin client (auth-access §2 "answerKeys deny-all";
   foundation §8).
7. **Quota / feature gating.** Bulk import and (if shown) analytics KPIs respect
   tenant quotas and `TenantFeatures` flags (`bulkImport`, `analytics`);
   disabled features hide their controls with an explanatory tooltip, and
   over-quota writes return `QUOTA_EXCEEDED`.
8. **Audit logging.** Every mutating action (add/remove student, assign/unassign
   teacher, settings edit, archive/restore) writes to the single audit-log
   collection best-effort (common-api §9). Destructive actions are confirmed and
   auditable.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Breadcrumb → Back → header actions (Edit, Archive) → KPI
  cards (as a group, not individually tabbable unless interactive) → Tab list →
  active tab's search/add controls → table (header sort buttons → rows → row
  actions) → pagination. Logical, top-to-bottom, left-to-right.
- **Tabs:** `role="tablist"`/`tab`/`tabpanel` with roving `tabindex`; Arrow keys
  move between tabs, Enter/Space activate, `aria-selected` on the active tab,
  `aria-controls` linking tab→panel. URL sync does not break keyboard nav.
- **DataTable:** real `<table>` semantics with `<th scope="col">`; sortable
  headers expose `aria-sort`. Row selection checkboxes have accessible labels
  ("Select Aisha Khan"). Row `⋯` menus are `aria-haspopup` Popovers with full
  keyboard operation and focus return to the trigger on close.
- **Dialogs:** `Modal`/`ConfirmDialog` trap focus, are labelled
  (`aria-labelledby`/`aria-describedby`), restore focus to the invoking control
  on close, and close on Esc.
- **Status never by color alone (Foundation §2):** every status `Badge` pairs an
  icon + text label ("● Active", "Archived"); the archived read-only state is
  announced via a text `InlineAlert`, not just a tint. KPI deltas / at-risk
  badges (if present) carry text.
- **Contrast:** all text/background pairs meet AA — body 4.5:1, large/UI 3:1 —
  using semantic tokens (`text.primary` on `bg.surface`, `text.secondary` for
  meta). `status.error`/`status.warning` used with sufficient contrast and never
  as the sole signal.
- **Live regions:** optimistic add/remove and async results announce via
  `aria-live="polite"` (e.g. "3 students added"). The route announcer in
  `AppLayout` announces page title on navigation.
- **Targets & motion:** interactive targets ≥44px (Foundation §4).
  `prefers-reduced-motion` disables tab slide, dialog scale, and skeleton
  shimmer (opacity/instant only). Focus ring uses the `border.focus` 3px ring
  (Foundation §4 elevation).

---

## 10. Web ↔ mobile divergence

Admin (`admin-web`) is **primarily a web / desktop experience** — this screen is
built and optimized for desktop admin workflows. There is **no dedicated React
Native admin app**; mobile here means a responsive small-viewport web layout,
not a native client.

- **Tables → stacked cards:** on sm, each `DataTable` becomes a list of record
  `Card`s with `DefinitionList` label:value pairs and one overflow action
  (Foundation §6).
- **Hover → press:** row hover affordances and tooltips collapse to
  tap/long-press; row actions move into an explicit `⋯`/overflow rather than
  hover-reveal.
- **⌘K command palette is web-only** (Foundation §6); on touch viewports the
  equivalent is the Topbar search field.
- **KPI strip** scrolls horizontally as a rail on narrow screens instead of a
  4-up grid.
- **Tabs** become a horizontally scrollable segmented control on sm.
- Multi-select roster editing remains available on small screens via a
  selection-mode toggle and a top action bar (no floating hover bar).
- Token parity holds: the same semantic tokens drive both layouts (Foundation
  §6); only renderer/affordance differs.

---

## 11. Claude-design prompt (ready to paste, web)

```
You are designing the "Class Detail" admin screen for Auto-LevelUp, conforming to the
Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md. Use ONLY that
foundation's tokens and §5 component inventory — never invent colors, fonts, spacing,
radii, shadows, motion, or component variants. Cite tokens by semantic name.

CONTEXT
- Audience: tenant administrator (tenantAdmin), scoped to ONE tenant. Multi-tenant
  isolation is a hard rule. Tone = precise/credible admin chrome (the serious register),
  NOT the playful student register. No emoji, no exclamation copy.
- Route: /classes/:classId, rendered inside AppShell (left Sidebar + Topbar).
- This is a single-class deep view: header (name + Active/Archived Badge + grade/section/
  session meta + Edit/Archive actions), a 4-up Stat/KPI strip (Students, Teachers, Exams,
  Spaces), and Tabs: Students | Teachers | Spaces | Exams | Settings.

DATA (server-authoritative; reads/writes via the common API, never raw Firestore)
- Class: name, grade, section, academicSessionId→name, teacherIds[], studentIds[],
  studentCount, status (active|archived).
- Students table: Name, Roll Number, Grade, Status. Teachers: Name, Subjects(chips),
  Designation, Status. Exams: Title, Subject, Date, Total Marks, Status (metadata only —
  answer keys are NEVER shown). Spaces: Title, Type, Subject, Status.

REQUIREMENTS
- Compose from §5 components: AppShell, Breadcrumb, Card, Stat/KPI, Tabs, DataTable
  (sort/filter/select/paginate), DefinitionList, Badge, Chip/Tag, AvatarGroup, Combobox,
  Modal/Dialog, ConfirmDialog, Toast, InlineAlert, EmptyState, Skeleton, Pagination,
  Button (primary/secondary/ghost/danger), IconButton, FileDrop.
- Write flows: Add students (Combobox multi-select + CSV FileDrop) and Remove (ConfirmDialog),
  Assign/Unassign teacher, Edit settings (DefinitionList → inline form), Archive/Restore.
  Use optimistic updates with rollback; confirm destructive actions; success via Toast.
- States: skeleton loading; empty (per tab + "Class not found"); error (InlineAlert + retry);
  partial (scope failure to the affected tab); archived = read-only with a banner + disabled
  writes (only Restore enabled). Gate write controls by role/permission (disabled + tooltip
  when not allowed) — never show a control the server would reject.
- Motion: Foundation §4 tokens only (fast/base, ease.standard/entrance). NO celebratory
  marigold spark here — that is reserved for student gamification. Respect prefers-reduced-motion.
- A11y: WCAG AA contrast; tablist/tab/tabpanel semantics with arrow-key nav; real table
  semantics with aria-sort; status as icon+label (never color alone); focus-trapped dialogs;
  aria-live for optimistic results; ≥44px targets; visible focus ring (border.focus).
- Responsive: lg as drawn; md = 2×2 KPI + collapsed columns; sm = stacked record cards,
  scrollable tabs/KPI rail, selection-mode action bar. ⌘K is web-only.

Produce a desktop-first layout (max content width 1200, gutter 32) plus the sm stacked
variant, using warm paper neutrals, ink text, indigo primary actions, and the semantic
status tokens — strictly per the Lyceum foundation.
```
