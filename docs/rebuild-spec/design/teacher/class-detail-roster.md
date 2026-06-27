# Class Detail — Roster & Overview

The operational hub for a single class: a teacher opens one of their managed
classes to see who is enrolled, what content/exams are assigned, and a compact
performance snapshot — then jumps out to authoring, grading, analytics, or an
individual student. Staff tone throughout: precise, credible, calm. Conforms to
the Lyceum foundation (`docs/rebuild-spec/design/00-FOUNDATION.md`).

> **Route** `/classes/:classId` · **Roles** `teacher` (managed classes only) ·
> `tenantAdmin` (all classes) · **Primary APIs** `classes.get`, `teachers.list`,
> `students.list`(by classId), `spaces.list`+`exams.list`(filtered to class),
> `analytics.getSummary`(scope `class`) → writes `v1.identity.saveClass`,
> `v1.identity.saveStudent` (enroll/remove)

---

## 1. Purpose & primary user

**Primary user:** a `teacher` doing day-to-day class operations — auditing the
roster, confirming the right spaces/exams are assigned, and spotting at-risk
students before a parent or admin asks. Secondary user: a `tenantAdmin`
reviewing or correcting any class in the tenant.

**Job to be done:** _"Open my class and, in one screen, know who's in it, what
they're working on, and who's falling behind — then act (enroll, edit, remove,
or drill into a student / analytics)."_

This screen is **operational, not authoring and not grading**. It surfaces and
links; it never edits space content or grades submissions. Authoring lives in
the Spaces area (`/spaces/:spaceId/edit`); grading lives in the Exams area
(`/exams/:examId/submissions/...`). The roster row and snapshot are read-mostly;
the only writes here are class metadata edits and enroll/remove (membership),
all via callables.

---

## 2. Entry points & route

**Route:** `/classes/:classId` (no `navMeta` — reached by navigation, not a
sidebar item). Deep-linkable; `classId` is a typed route param.

**Entry points:**

- `/classes` (Classes list) → row click.
- Dashboard "My classes" widget.
- Breadcrumb / back-links from `student-detail-progress` and `class-analytics`.
- CommandPalette (⌘K) "Go to class…".

**Reads (via `@levelup/api-client` repositories / hooks — never Firestore
directly):**

- `classes.get(classId)` → class header (name, grade, section, teacherIds,
  studentCount, status).
- `teachers.list({ ids: class.teacherIds })` → teacher chips (resolve names; no
  per-id `getDoc` in the view).
- `students.list({ classId })` → roster rows.
- `spaces.list({ classId })` and `exams.list({ classId })` → Assigned content
  (server-filtered to the class; no client-side
  `.filter(s.classIds.includes(...))`).
- `analytics.getSummary({ scope: 'class', classId })` → precomputed
  `ClassProgressSummary` for the snapshot (server-authoritative; never
  recomputed client-side).

**Writes (callables only):**

- `v1.identity.saveClass` ← ClassFormDialog (edit header / metadata).
- `v1.identity.saveStudent` ← EnrollStudentDialog (add `classId` to a student's
  `classIds`) and roster Remove (drop `classId`). Server re-syncs membership +
  claims via `syncMembershipClaims` (see §8).

Reads map to `common-api.md §3.3` (`v1.levelup.listSpaces`,
`v1.autograde.listExams`, `v1.identity` student/teacher/class reads,
`v1.analytics.getSummary`). All list endpoints use the unified
`PageRequest`/`pageResponse` pagination fragment.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` → `AppShell` (sidebar + topbar). This screen
owns only the main content column; gutters follow foundation page-gutter tokens
(mobile 16 / tablet 24 / desktop 32), max content width 1200.

```
AppShell ── Sidebar (People ▸ Classes active) ── Topbar (tenant switcher · ⌘K · bell · profile)
└── Main (PageTransition, RouteAnnouncer)
    ┌──────────────────────────────────────────────────────────────────────┐
    │ Breadcrumb:  Classes  ›  {Class name}                                  │  AppBreadcrumb
    ├──────────────────────────────────────────────────────────────────────┤
    │ HEADER (Section, card-less band)                                       │
    │  {Class name}  ·  Grade {n} · Section {x}  · [status Badge]            │  Fraunces 2xl name
    │  Teachers: [AvatarGroup + chips]    {N} students                       │
    │                                          [ Edit class ]  (secondary)   │  → ClassFormDialog
    ├──────────────────────────────────────────────────────────────────────┤
    │ TABS:  Roster | Assigned content | Snapshot                            │  Tabs (3)
    ├──────────────────────────────────────────────────────────────────────┤
    │ TAB · Roster (default)                                                 │
    │  [ Search students ]            [ Enroll students ] (primary)          │  DataTable toolbar + BulkActionBar
    │  ┌──────────────────────────────────────────────────────────────────┐ │
    │  │ Name | Roll | Status | Overall | Risk | Last active |        ⋯   │ │  DataTable (sort/filter/paginate/select)
    │  │ Aanya Rao | 12 | Active | 84% | — | 2d ago |         [Remove]    │ │  row → student-detail-progress
    │  │ Dev Kumar | 07 | Active | 41% | ⚠ At risk | 11d ago| [Remove]    │ │  AtRiskBadge
    │  └──────────────────────────────────────────────────────────────────┘ │
    │  Pagination                                                           │
    ├──────────────────────────────────────────────────────────────────────┤
    │ TAB · Assigned content                                                 │
    │  Spaces   [ Assign content ▸ ] (links to assign-content-to-class)      │
    │   [SpaceCard grid]   ·   each → /spaces/:id/edit                       │
    │  Exams                                                                  │
    │   [DataTable: Title | Subject | Marks | Status | View→/exams/:id]      │
    ├──────────────────────────────────────────────────────────────────────┤
    │ TAB · Snapshot                                                         │
    │  [StatCard ×4: Students · Avg exam score · Avg space completion · At-risk] │
    │  [InsightCard teaser]  →  "Open class analytics" (class-analytics)     │
    └──────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **`lg` (≥1024):** header on one row (name/meta left, teachers + count + Edit
  right). Snapshot StatCards in a 4-col grid; Assigned-content Spaces as a 3-col
  SpaceCard grid. Roster is a full DataTable with all columns.
- **`md` (768–1023):** header wraps Edit under the title row; StatCards 2×2;
  SpaceCards 2-col; Roster keeps the DataTable but `Student ID`/secondary
  columns collapse into a row-expand or are hidden behind a column toggle.
- **`sm` (<768):** Tabs become a horizontally scrollable `TabsList`. **Roster
  table → stacked rows** (name + status + overall + AtRiskBadge per card; Remove
  in a per-row overflow menu). StatCards single column. SpaceCards single
  column. Enroll action moves into the sticky bottom area; primary actions stay
  ≥44px touch targets. Sidebar collapses to `MobileBottomNav`.

---

## 4. Components used

All from FOUNDATION §5 / the `shared-ui` inventory (`webapps-design.md §2.2`).
No new components required.

| Region             | Component(s)                                                                                                                               | Notes                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Breadcrumb         | `AppBreadcrumb` / `Breadcrumb`                                                                                                             | `Classes › {name}`; derived, not hand-built.                                                |
| Header status      | `Badge` (status variant: draft/active/archived)                                                                                            | Status pairs icon+label (never color-only).                                                 |
| Teachers           | `AvatarGroup` + `Chip/Tag`                                                                                                                 | Names resolved via `teachers.list` / `useTenantNames`-style hook — no `getDoc` in the view. |
| Header actions     | `Button` (secondary "Edit class") → `Modal/Dialog` (`ClassFormDialog`)                                                                     | Edit gated by role/permission (§5).                                                         |
| Tabs               | `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`                                                                                        | Roster default.                                                                             |
| Roster             | `DataTable` (`@levelup/shared-ui/data`) with `useDataTable` headless core; `Avatar`, `Badge`, `AtRiskBadge`, `Pagination`, `BulkActionBar` | Owns search/sort/filter/select/paginate.                                                    |
| Overall score cell | `GradePill` / mono numeric (`Spline Sans Mono`)                                                                                            | Tabular figures for scores.                                                                 |
| Risk cell          | `AtRiskBadge`                                                                                                                              | Renders only when `isAtRisk`; tooltip lists `atRiskReasons`.                                |
| Enroll             | `Button` (primary) → `Modal/Dialog` (`EnrollStudentDialog`): `Input` (search), multi-select list, `Checkbox`                               | Multi-select, server upsert per student.                                                    |
| Remove             | `IconButton`/`Button` (ghost) → `ConfirmDialog` (danger)                                                                                   | Unenroll, not delete.                                                                       |
| Assigned · Spaces  | `SpaceCard` grid; `Button` "Assign content" (links out); `EmptyState`                                                                      | Read-only cards link to `/spaces/:id/edit`.                                                 |
| Assigned · Exams   | `DataTable`                                                                                                                                | Links to `/exams/:id`.                                                                      |
| Snapshot           | `StatCard` ×4, `ProgressRing`, `InsightCard` (teaser), `Button` (ghost link → class-analytics)                                             | KPIs are read-only from the summary.                                                        |
| States             | `Skeleton`, `EmptyState`, `ErrorState`, `InlineAlert/Banner`, `Toast` (sonner), `LoadingOverlay`                                           | See §5.                                                                                     |
| Drill-out          | row click + `Link`                                                                                                                         | → `student-detail-progress`.                                                                |

**Justification for no additions:** `DataTable` + `useDataTable` subsume the
per-page table plumbing the current `ClassDetailPage` hand-rolls
(`webapps-design.md` inconsistency #9). `AtRiskBadge`, `StatCard`/`ScoreCard`,
`ProgressRing`, `SpaceCard`, `InsightCard` already exist in the charts/domain
inventory.

---

## 5. States

**Loading (skeleton):**

- Header: `Skeleton` for class name (lg bar), meta line, teacher avatars, and
  the Edit button (disabled).
- Roster tab: `DataTable` skeleton — 6–8 `Skeleton` rows matching column count;
  toolbar present but Search/Enroll disabled.
- Assigned content: 3 `Skeleton` SpaceCards; exam table skeleton.
- Snapshot: 4 `StatCard` skeletons + ring skeleton. Snapshot loads independently
  of roster (separate query) so the roster is interactive before analytics
  resolves — **partial** is normal.

**Empty:**

- **Class has no students:** `EmptyState` (icon, "No students enrolled yet",
  body "Enroll students from your tenant directory to start tracking this
  class.", primary `Button` "Enroll students").
- **No assigned spaces:** `EmptyState` "No spaces assigned to this class" + link
  `Button` "Assign content" → assign-content-to-class flow.
- **No exams:** `EmptyState` "No exams target this class yet" + link to
  `/exams/new`.
- **No analytics yet:** `EmptyState` in Snapshot "No analytics yet — figures
  appear after exams are graded and spaces are used." (matches the
  precompute-on-write model; summary doc may not exist).

**Error:**

- **Class not found / not in your scope:** full-region `ErrorState`, not a table
  empty — "Class unavailable. It may not exist, or it isn't one of the classes
  you manage." with a `Button` "Back to Classes". (A `teacher` requesting a
  `classId` outside their claim `classIds` hits this — server
  `PERMISSION_DENIED`/`NOT_FOUND` is surfaced identically so
  cross-tenant/cross-scope existence isn't leaked.)
- **Per-tab read error** (e.g. `analytics.getSummary` fails):
  `InlineAlert/Banner` (error) scoped to that tab with a "Retry" action; the
  rest of the page stays usable. Errors are distinguished from empties (resolves
  the "errors render as empty states" gap from `common-api.md §6.3`).
- **Mutation error** (enroll/remove/edit): `Toast` (error) with copy from
  `ERROR_MESSAGES` keyed on `error.details.code`; optimistic row change rolls
  back.

**Partial:** roster present but `overallScore`/risk pending → score cell shows
mono "—" and risk cell shows nothing (absence ≠ "not at risk" visually; no
false-green). Teacher chips resolve lazily — show initials until names arrive.

**Success:** full header, populated roster DataTable with working
sort/filter/paginate/select, SpaceCards + exam table, 4 StatCards + InsightCard
teaser.

**Permission-gated variants (by role):**

- `teacher` who **manages** this class: full read + Edit class + Enroll/Remove,
  gated additionally by `TeacherPermissions` (e.g. a teacher without a
  manage-students permission sees the roster read-only — Enroll/Remove hidden,
  not just disabled, and the row Remove control is absent).
- `teacher` who does **not** manage this class: never reaches a populated screen
  — routed to the `ErrorState` above (claim `classIds` / `managedClassIds` gate,
  with the 15-class `classIdsOverflow` fallback resolved server-side).
- `tenantAdmin`: full access to any class in the tenant; same UI, no scope
  filter.
- Answer-key / grading actions are **not present** here regardless of role (this
  screen never exposes them).

---

## 6. Interactions & motion

Motion uses foundation tokens only; `prefers-reduced-motion` removes
transforms/celebration and keeps opacity ≤ `fast`.

- **Page entry:** `PageTransition` fade/slide at `page` (420ms) `ease.entrance`.
  Tab content swaps at `base` (220ms) `ease.standard`.
- **Tab switch:** instant focus move to the panel; `TabsContent` cross-fades at
  `fast` (160ms). Active tab underline slides at `base`.
- **Roster row hover/press:** surface lift to `e2` at `fast`; whole row is the
  click target → navigates to `student-detail-progress`. The Remove control
  `stopPropagation`s so it never triggers navigation.
- **Sort/filter/paginate:** handled by `useDataTable` (client-side for the
  loaded page; server pagination via opaque `cursor`). Column sort toggles with
  an aria-sorted header; no layout jump.
- **Enroll flow:** open `EnrollStudentDialog` (`Modal` enters at `base`, `e3`).
  Search filters eligible students (those not already in this class, not
  archived). Multi-select via Checkbox; confirm calls `v1.identity.saveStudent`
  per selected student. **Optimistic:** selected students appear in the roster
  immediately with a subtle pending shimmer; on success a single `Toast` ("3
  students enrolled"); on any failure, that student rolls out of the roster and
  the toast names the failure. `studentCount` in the header reflects the
  server-confirmed count (authoritative), reconciling after the callable
  returns.
- **Remove flow:** `ConfirmDialog` (danger) — "Remove {name} from {class}? The
  student record itself isn't deleted." Confirm → `v1.identity.saveStudent` with
  `classId` dropped. Optimistic row removal + rollback on error.
- **Edit class:** `ClassFormDialog` → `v1.identity.saveClass`; on success the
  header updates and a `Toast` confirms. No celebratory chrome (staff surface).
- **Assign content:** primary action links out to the assign-content-to-class
  flow (no inline authoring). SpaceCard and exam rows are plain links (prefetch
  on hover via `usePrefetch`).
- **No gamification motion:** the single celebratory spring/marigold burst is
  reserved for the student app; a teacher viewing a student's gamification state
  sees it **read-only** on `student-detail-progress`, not here.

---

## 7. Content & copy

**Header**

- Title: the class name (e.g. "Grade 10 — Physics A").
- Meta line: `Grade {n}` · `Section {x}` · status `Badge` (Draft / Active /
  Archived).
- Teachers label: `Taught by` + chips. Count: `{N} students`.
- Action: `Edit class`.

**Tabs:** `Roster` · `Assigned content` · `Snapshot`.

**Roster**

- Toolbar: search placeholder `Search by name or roll number`; primary
  `Enroll students`.
- Columns: `Name` · `Roll no.` · `Status` · `Overall score` · `Risk` ·
  `Last active` · (actions).
- At-risk cell label: `At risk` (with tooltip
  `Flagged by nightly review: {reasons}`).
- Row action: `Remove`.
- Empty: title `No students enrolled yet`; body
  `Enroll students from your tenant directory to start tracking this class.`;
  action `Enroll students`.

**Enroll dialog**

- Title `Enroll students` · description
  `Add existing students to {class name}. They keep their records and any other class enrollments.`
- Empty/no-match: `No eligible students match "{query}".`
- Footer: `Cancel` · `Enroll {n} student(s)`.

**Remove confirm**

- Title `Remove student from class?`
- Body
  `{name} will be unenrolled from {class name}. The student record itself is not deleted.`
- Confirm `Remove` (danger) · `Cancel`.

**Assigned content**

- Spaces heading `Spaces` + action `Assign content`. Empty:
  `No spaces assigned to this class.`
- Exams heading `Exams`. Empty: `No exams target this class yet.`

**Snapshot**

- StatCards: `Students` · `Avg exam score` · `Avg space completion` ·
  `At-risk students`.
- Teaser: `InsightCard` headline from the summary; link `Open class analytics`.
- Empty:
  `No analytics yet — figures appear after exams are graded and spaces are used.`

**Errors (staff tone, direct):**

- Class scope:
  `Class unavailable. It may not exist, or it isn't one of the classes you manage.`
- Tab read failure:
  `Couldn't load {roster | assigned content | snapshot}. Retry.`
- Enroll/remove failure: `Couldn't update enrollment. Please try again.`
  (specific code message preferred when available).

---

## 8. Domain rules surfaced

- **Tenant isolation:** every read/write is scoped to the caller's active
  tenant; `tenantId` is derived from claims server-side and is **never** a form
  field or visible value. Cross-tenant classes/students never appear, and an
  out-of-tenant `classId` resolves to the same generic `ErrorState` (no
  existence leak).
- **Teacher class scope:** a `teacher` may open only classes in their claim
  `classIds` / `managedClassIds`, with the 15-class **`classIdsOverflow`**
  Firestore fallback resolved server-side (`auth-access.md §1.3`). `tenantAdmin`
  sees all classes. The view trusts the server scope check; it does not
  re-derive access from local membership.
- **Reads = repositories, writes = callables:** no direct client Firestore
  writes. Enroll/remove go through `v1.identity.saveStudent`; class edits
  through `v1.identity.saveClass`. The current code's direct `callSaveStudent`
  with client-built `classIds` arrays is replaced by the callable that owns the
  membership/class-roster mutation atomically.
- **Membership + claims sync is a server responsibility:** enrolling/removing a
  student must re-derive `managedClassIds` and refresh claims via the single
  `syncMembershipClaims` primitive (`auth-access.md §4.5`, rec #3). The known
  **claims-drift caveat** (today `saveStudent`'s update branch doesn't refresh
  claims, so a moved student can keep stale class access for up to ~1h until
  token refresh) is called out here as a **server-side responsibility** — the UI
  does **not** attempt to patch claims, show a tenantId field, or warn the user
  about JWT timing. The screen optimistically reflects the roster and trusts the
  server to converge.
- **Server-authoritative stats:** `studentCount`, `overallScore`, and the
  snapshot KPIs come from `classes.get` and the precomputed
  `ClassProgressSummary` (`analytics.getSummary` scope `class`). The client
  never recomputes scores or counts (no `getCountFromServer` fan-out).
- **At-risk is server-computed only:** `isAtRisk` + `atRiskReasons` come from
  the nightly rule engine (`be-analytics.md` `nightlyAtRiskDetection` /
  `at-risk-rules.ts`). The UI renders the flag and reasons read-only; it never
  computes risk on the client. Absence of a flag is shown as neutral, not as a
  positive "safe" state.
- **No answer keys, no grading, no authoring here:** answer keys are server-only
  and never reach this client; grading and content authoring are linked out, not
  embedded.
- **Results visibility:** exam rows show status/metadata only; per-student
  result figures honor `releaseResultsAutomatically` / results-released gating
  where surfaced, and detailed results are reached via the Exams area, not
  inline.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → Edit class → Tabs (`TabsList` roving tabindex) →
  active panel. In Roster: Search → Enroll → DataTable (header sort buttons,
  then rows) → Pagination. Dialogs trap focus and restore it to the triggering
  control on close.
- **Keyboard:**
  - Tabs: Left/Right move between triggers, Enter/Space activate, Home/End jump.
  - DataTable: sortable headers are buttons (Enter/Space toggles, announces
    `aria-sort`); rows are reachable and Enter activates the student drill-in;
    Remove is a separate focusable control with its own label.
  - Dialogs: Esc cancels, Enter confirms (except destructive `ConfirmDialog`,
    which requires explicit focus on Remove). ⌘K opens CommandPalette.
- **ARIA / semantics:** roster is a real `<table>` with `<th scope="col">`;
  `AtRiskBadge` exposes its reasons via `aria-label`/tooltip text (not color
  alone). Status badges include text. Icon-only buttons (back, Remove) have
  `aria-label`s. `RouteAnnouncer` announces the class name on navigation.
  StatCards expose label+value to assistive tech as a labelled group.
- **Contrast:** all text/background pairs meet WCAG AA via semantic tokens
  (`text.primary`/`text.secondary` on `bg.surface`); status and risk use
  icon+label so meaning never relies on `status.error`/`status.warning` hue
  alone. Score `GradePill` carries the numeric, not just a color.
- **Reduced motion:** `prefers-reduced-motion` disables row-lift transforms, tab
  slide, and dialog scale — opacity-only at `fast`. No gamification motion
  exists on this screen to suppress.
- **Touch targets:** ≥44px for Enroll, Remove, tab triggers, and pagination on
  `sm`.

---

## 10. Web↔mobile divergence (RN parity)

Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
(mobile); the headless cores (`useDataTable`, the enroll/remove mutation hooks
over `@levelup/api-client`) are reused verbatim — only renderers differ.

- **Roster:** web `DataTable` → RN **stacked cards** (one card per student:
  name, status, overall, `AtRiskBadge`, last active; Remove in a row overflow /
  swipe action). Sort/filter become a filter sheet rather than column headers.
- **Tabs:** web `Tabs` → RN segmented control or a top tab navigator; same three
  sections.
- **Hover → press:** row hover-lift becomes press feedback; prefetch-on-hover
  has no RN analog (navigate-then-load, with skeletons).
- **Dialogs:** `EnrollStudentDialog`/`ClassFormDialog`/`ConfirmDialog` → RN
  `Sheet`/bottom-sheet equivalents; same fields and callable calls.
- **No ⌘K:** CommandPalette is web-only; RN uses native search/navigation.
- **Header actions:** Edit/Enroll move into a header kebab or a sticky action
  bar on small screens.
- **Data parity:** identical reads/writes via the same repositories + callable
  registry, so RN shows the same scope-gated, server-authoritative roster and
  snapshot with no extra logic.

This is primarily a teacher-web/admin operational surface; an RN teacher build,
if shipped, reuses this spec's data layer unchanged.

---

## 11. Claude-design prompt

```
You are generating the "Class Detail — Roster & Overview" screen for the Auto-LevelUp
TEACHER operational web portal. Conform EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md and this spec
(docs/rebuild-spec/design/teacher/class-detail-roster.md). Do NOT invent tokens, fonts,
colors, spacing, radii, or component variants — compose only from FOUNDATION §2–§5,
citing semantic token names (bg.surface, text.secondary, brand.primary, status.error,
status.warning, spark, e1/e2/e3, radius md/lg/pill, motion fast/base/page,
ease.standard/ease.entrance). Fonts: Fraunces (display/headings), Schibsted Grotesk
(UI/body/tables), Spline Sans Mono (scores/IDs). Warm paper neutrals + deep indigo
primary; marigold "spark" is NOT used here (staff surface — precise, credible, calm).

Route: /classes/:classId. Render inside PlatformLayout/AppShell (sidebar People▸Classes
active, topbar with tenant switcher/⌘K/bell/profile). Build:

HEADER: class name (Fraunces 2xl), meta line "Grade {n} · Section {x}" + status Badge,
teacher AvatarGroup + chips, "{N} students", and a secondary "Edit class" button
(opens ClassFormDialog).

TABS (Tabs from shared-ui), Roster default:
1) Roster — DataTable (from @levelup/shared-ui/data, headless useDataTable): columns
   Name, Roll no., Status (Badge), Overall score (mono GradePill), Risk (AtRiskBadge,
   only when at-risk, tooltip = atRiskReasons), Last active, and a ghost Remove action
   (stopPropagation). Toolbar: search "Search by name or roll number" + primary
   "Enroll students" (EnrollStudentDialog, multi-select). Row click → /students/:id
   (student-detail-progress). Pagination.
2) Assigned content — Spaces as SpaceCard grid (→ /spaces/:id/edit) with an "Assign
   content" button linking to the assign-content-to-class flow; Exams as a DataTable
   (Title, Subject, Marks, Status, View→/exams/:id). Distinct EmptyStates per section.
3) Snapshot — 4 StatCards (Students, Avg exam score, Avg space completion, At-risk
   students) + a ProgressRing and an InsightCard teaser linking to class-analytics.

STATES: skeletons per region (roster/snapshot load independently); distinct EmptyState
vs ErrorState (errors are NOT empty states); out-of-scope/not-found class → a generic
ErrorState "Class unavailable. It may not exist, or it isn't one of the classes you
manage." with "Back to Classes". Permission-gated: a teacher without manage-students
permission sees roster read-only (no Enroll/Remove); tenantAdmin sees all classes.

DOMAIN RULES (must hold): tenantId is derived from claims server-side — never a field or
visible value; teachers see only their managed classes (classIds/managedClassIds claim,
15-class overflow fallback) — trust the server scope, don't re-derive; reads are
repositories, writes are callables (v1.identity.saveStudent for enroll/remove,
v1.identity.saveClass for edit) — no direct client Firestore writes; enrolling re-syncs
membership/claims server-side (do NOT patch claims or warn about JWT timing in the UI);
studentCount/scores/KPIs are server-authoritative (no client recompute); isAtRisk +
atRiskReasons come from the nightly rule engine (render read-only, never compute risk
client-side); no answer keys, grading, or content authoring on this screen (link out).

MOTION: PageTransition (page), tab cross-fade (fast), row hover-lift to e2 (fast),
dialogs at e3 (base); honor prefers-reduced-motion (opacity-only, no transforms; no
gamification celebration anywhere on this staff screen).

A11Y: roving-tabindex Tabs; real <table> with scope="col"; sortable header buttons
announce aria-sort; AtRiskBadge/status never color-only (icon+label, aria-label lists
reasons); icon buttons have aria-labels; focus trap + restore in dialogs; RouteAnnouncer
on nav; ≥44px touch targets; WCAG AA contrast via semantic tokens.

RESPONSIVE: lg = full DataTable + 4-col StatCards + 3-col SpaceCards; md = 2×2 cards,
2-col SpaceCards, collapsing secondary columns; sm = roster becomes stacked cards,
single-column cards, scrollable TabsList, Remove in a row overflow menu, sidebar →
MobileBottomNav. Keep component names/props 1:1 with a future RN (ui-native) build.

Output a single React + Tailwind screen composed from shared-ui components, with the
exact headings, labels, empty-state, and error copy from §7 of this spec.
```
