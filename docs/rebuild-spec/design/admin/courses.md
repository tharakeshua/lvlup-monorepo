# Courses — Admin Screen Spec

> **Area:** admin (tenant administrator console) · **Route:** `/courses` ·
> **Role:** `tenantAdmin` **Design system:** Lyceum — conforms to
> [`../00-FOUNDATION.md`](../00-FOUNDATION.md). All tokens, type, spacing,
> motion, and components are cited by semantic name from that foundation;
> nothing new is invented except where explicitly flagged as a **proposed
> foundation addition**. **Register:** serious / precise (admin tooling).
> Restraint in chrome; no student-facing playful energy. The single `spark`
> accent is **not** used here except where a CTA legitimately maps to it (see
> §4).

---

## 1. Purpose & primary user

**Primary user:** the **tenant administrator** (`tenantAdmin`) of a single
academy/school. Scoped to exactly one tenant — never cross-tenant (that is
super-admin's control plane). A `staff` user with the relevant
content-permission may reach a read-only variant (see §5, §8); a `superAdmin`
operating "as tenant" sees the same screen plus an explicit tenant context
banner.

**Job-to-be-done:** _"As the academy admin, I need a catalog-level view of every
learning Space (course) in my tenant — its publish status, type, subject, which
classes and teachers it's mapped to, and how big it is — so I can audit
coverage, find gaps (unassigned / unpublished spaces), and govern the curriculum
structure without editing question content myself."_

**Important domain nuance from live code & status report:** today `/courses`
(`CoursesPage.tsx`) is a **read-only overview** over the tenant's `spaces`
collection, and it overlaps with `/spaces` (`SpacesOverviewPage.tsx`) — the
status report flags this duplication (admin-web report §4.3, rec #5: _merge
`/spaces` and `/courses`_). **This spec treats `/courses` as the canonical,
consolidated "Content / Courses" catalog** and folds the spaces overview into
it. Authoring (creating/editing story points, items, answer keys) remains the
**Teacher Portal's** job; admin governs _mapping, lifecycle, and structure_, not
question content. Where this spec introduces admin-initiated writes
(class/teacher mapping, lifecycle transitions), those are explicitly noted as
scope expansions over today's read-only page and are flagged in §8.

---

## 2. Entry points & route

**Route:** `/courses` (React Router v7, lazy + Suspense), rendered inside
`AppLayout` (the authenticated `AppShell`). Reached from the **Management** nav
group in `AppSidebar`. Hover-prefetched via `ADMIN_PREFETCH_MAP`. Deep-link
target for dashboard "coverage" cards and from a class detail page ("Spaces
assigned to this class").

**Common-API reads** (per
[`../../specs/common-api.md`](../../specs/common-api.md) §3.3 — all reads move
behind the typed `api-client`; the UI never touches `firebase/firestore`
directly):

- `v1.levelup.listSpaces` — paginated catalog of the tenant's spaces (replaces
  today's direct `useSpaces(tenantId)` Firestore read). Uses the unified
  `PageRequest` / `pageResponse` fragment (§7). `tenantId` is **derived
  server-side from `ctx.activeTenantId`** (§4.4) — not sent in the body.
- `v1.identity.saveClass` is _not_ read here; the **class list** for the
  filter + name resolution comes from a classes read hook (the rebuild's
  `listClasses` read endpoint behind `api-client`, replacing today's
  `useClasses(tenantId)`). Used to resolve `classIds → class name` (today done
  by `getClassName`).
- Teacher-name resolution for the "teachers" facet uses the identity
  teacher-list read endpoint (replacing today's raw count of
  `space.teacherIds`).
- _(Optional, lazy)_ `v1.analytics.getSummary` (`scope: 'class'`) is **not**
  called on this catalog screen by default — coverage rollups shown here come
  from the denormalized `space.stats` (`totalStoryPoints`, `totalItems`,
  `totalStudents`, `avgCompletionRate`). Deep analytics live on `/analytics`.

**Common-API writes** (scope expansion beyond today's read-only page — gated,
see §5/§8):

- `v1.levelup.saveSpace` — the `save*` upsert (`id` present = update). Used for
  admin-initiated **class/teacher re-mapping** (`classIds`, `teacherIds`,
  `accessType`) and **lifecycle transitions** (`status`), which the server
  validates against `ALLOWED_TRANSITIONS` (`draft→published`,
  `published→{archived,draft}`, `archived→draft`) and `validatePublish`. Admin
  **never** edits story-point/item/answer-key content from here.
- Bulk lifecycle (archive/restore across a selection) maps to repeated
  `v1.levelup.saveSpace` status transitions; the server is authoritative and
  rejects illegal transitions per space (`INVALID_TRANSITION` error code, §6 of
  common-API).

All errors arrive via the typed `ApiErrorDetails` envelope (common-API §6) and
are surfaced through `useApiError` → `ERROR_MESSAGES` / `ERROR_RECOVERY_HINTS`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (§5 Navigation): persistent left **Sidebar**
(role-driven nav, "Courses" active in the Management group), top **Topbar**
(tenant switcher, ⌘K search, NotificationBell, profile). A **Breadcrumb**
(`Home / Courses`) sits at the top of the content region. Page content max-width
1200, page gutters per foundation §4 (desktop 32).

```
┌─ AppShell ─────────────────────────────────────────────────────────────────┐
│ Sidebar │  Topbar: [tenant ▾]  [⌘K search]            [🔔]  [avatar ▾]      │
│ (nav)   ├──────────────────────────────────────────────────────────────────┤
│ Over-   │  Breadcrumb: Home / Courses                                       │
│ view    │                                                                   │
│ ▸Mgmt   │  ┌─ Page header ────────────────────────────────────────────────┐│
│  Users  │  │ H1 "Courses"     subtitle (text.secondary)     [+ New course] ││  ← primary Button, right-aligned
│  Class  │  └──────────────────────────────────────────────────────────────┘│
│ ►Courses│                                                                   │
│  Exams  │  ┌─ Subject coverage strip (Stat/KPI cards) ────────────────────┐│
│ ▸Analy. │  │ [Math: 12 total · 9 pub] [Physics: 8·6] [CS: 6·6] [+N more]   ││  ← grid, horizontally scannable
│ ▸Config │  └──────────────────────────────────────────────────────────────┘│
│         │                                                                   │
│         │  ┌─ Toolbar ───────────────────────────────────────────────────┐ │
│         │  │ [🔍 Search courses…]  [Class ▾]  [Status ▾]  [Type ▾]        │ │  ← Input + 3 Selects
│         │  │                                  [view: ▤ table | ▦ grouped] │ │  ← segmented toggle (proposed, see §4)
│         │  └─────────────────────────────────────────────────────────────┘ │
│         │                                                                   │
│         │  ┌─ DataTable (default view) ──────────────────────────────────┐ │
│         │  │ ☐  Course ▾ │ Status │ Type │ Subject │ Classes │ Teachers │…│ │
│         │  │ ☐  Algebra I│ ●Pub   │ Learn│ Math    │ 7A,7B   │ 2        │⋯│ │
│         │  │ ☐  Kinematics ●Draft │ Asmt │ Physics │ —       │ 1        │⋯│ │
│         │  │ …                                                            │ │
│         │  └─────────────────────────────────────────────────────────────┘ │
│         │  [selection bar appears when rows checked] · [Pagination ◂ 1 ▸]  │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

**Regions:**

1. **Page header** — `H1` "Courses" (Fraunces, display token), a one-line
   subtitle (`text.secondary`), and a right-aligned primary action
   `[+ New course]` (admin-only; opens a create dialog that mirrors the Teacher
   Portal's space-create contract).
2. **Subject coverage strip** — `Stat/KPI` cards (one per subject), each showing
   total / published counts. This is today's `subjectGroups` overview, promoted
   to KPI components. Sorted by space count desc (matching live code).
3. **Toolbar** — `Input` (search title/subject/description), three `Select`s
   (Class / Status / Type), and a **view toggle** (table vs subject-grouped).
   Filters are client-applied over the fetched page in v1, server-applied when
   the catalog exceeds one page.
4. **Catalog** — a `DataTable` (sort / filter / select / paginate) of courses;
   this replaces today's hand-rolled card list and the duplicated
   `usePagination`/`useSort` plumbing (status report rec #4). A
   **subject-grouped card** alternative view (using `SpaceCard`-style rows under
   `Section` headers) is available via the toggle for visual scanning.
5. **Selection action bar** — appears (slide-up) when ≥1 row is checked: bulk
   **Archive** / **Restore** / **Reassign class**. `Pagination` sits at the
   table footer.

**Responsive behavior:**

- **`lg` (≥1024):** full layout as drawn. Sidebar expanded. DataTable shows all
  columns (Course, Status, Type, Subject, Classes, Teachers, Items, Updated,
  row-actions `⋯`).
- **`md` (768–1023):** Sidebar collapses to icon rail. Coverage strip wraps to 2
  columns. DataTable drops lower-priority columns (Items, Updated) behind a row
  "details" disclosure; toolbar Selects wrap to a second line.
- **`sm` (<768):** AppShell switches to **MobileBottomNav** + Topbar; the
  **Tabbar** replaces the sidebar. The DataTable degrades to a **stacked card
  list** (foundation §6 rule: table on web → stacked cards on mobile) — each
  course is a Card with title + Status/Type `Badge`s, a Classes `Chip` row, and
  a `⋯` action sheet. Coverage strip becomes a horizontal-scroll row of compact
  stats. The view toggle is hidden (cards only).

---

## 4. Components used (from FOUNDATION §5 only)

**Navigation:** `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb`, `Tabbar`
(mobile), `CommandPalette` (⌘K, web-only). **Containers:** `Card`, `Section`,
`Panel` (for the create/edit/reassign side `Drawer/Sheet`), `Modal/Dialog`
(create course), `Popover` (row `⋯` actions), `Tooltip` (truncated chip
overflow), `Tabs` (only inside the create/edit drawer if multi-step).
**Primitives:** `Button` (primary = "New course"; secondary; ghost row-actions;
**danger** = Archive/Delete confirm), `IconButton` (row `⋯`, sort carets),
`Input` (search), `Select` (Class / Status / Type filters), `Checkbox` (row +
header select), `Combobox` (class/teacher pickers inside the reassign drawer).
**Data:** `DataTable` (sort/filter/paginate/**select**) — the core of this
screen; `Stat/KPI` (subject coverage cards); `EmptyState`; `Skeleton` (loading);
`Pagination`; `Badge` (status, type, subject); `Chip/Tag` (assigned class names,
with overflow "+N"); `DefinitionList` (inside the row-detail / edit drawer);
`ProgressBar` (optional `avgCompletionRate` in row-detail). **Feedback:**
`Toast` (sonner — save/transition confirmations), `InlineAlert/Banner`
(partial-data, feature-disabled, tenant-context), `ConfirmDialog`
(archive/restore/reassign), `FormFieldError` (in drawers), `LoadingOverlay`
(during bulk transition).

**Status & type encoding (cite domain scales, foundation §2.2/§2.3):**

- Status `Badge`: `draft` → neutral `border.strong` + dot; `published` →
  `status.success` + check icon + "Published"; `archived` → `text.muted` +
  archive icon + "Archived". **Never color-alone** (icon + label always — §9).
- Type `Badge` (`learning|practice|assessment|resource|hybrid`): use neutral
  `border.subtle` outline chips with distinct lucide icons per type; no new
  colors.
- Subject `Badge`: outline (`border.subtle`), `text.secondary`.

**`spark` usage:** the page is in the serious register, so `spark` (marigold) is
reserved and **not** used for chrome. The only legitimate `spark` candidate is
the hero primary CTA glow on `[+ New course]`; per foundation §4 the spark glow
is "hero CTA only" — admin tooling stays restrained, so **"New course" uses
`brand.primary`, not `spark`.** (Stated explicitly so no one adds marigold
here.)

**Proposed foundation additions (flagged, not invented silently):**

1. **`SegmentedControl` / view toggle** (table ↔ grouped) is not in §5's
   inventory. Proposed addition to **Primitives** (two/three-segment toggle,
   pill radius, `brand.primary` active fill). Until ratified, fall back to two
   ghost `IconButton`s in a `border.subtle` container.
2. **`FilterBar`** as a named composition is not in §5; treat it as an ad-hoc
   layout of existing `Input` + `Select` (no new component needed). Listed for
   clarity only.

---

## 5. States

**Loading (skeleton).** On first mount: coverage strip → 4 `Skeleton` `Stat`
cards; toolbar renders enabled-but-empty; DataTable → 8 `Skeleton` rows (shimmer
respecting reduced-motion). No spinner text — replaces today's bare "Loading
courses…" string with structural skeletons (foundation §5 Skeleton).

**Empty (no courses at all).** `EmptyState` centered in the table region:
`BookOpen` glyph, Fraunces title "No courses yet", body copy (see §7), and —
**admin only** — a primary `[+ New course]` and a secondary "Learn how teachers
build courses" link. For **staff (read-only)**, the CTA is omitted and copy
explains teachers author content in the Teacher Portal.

**Empty (filters exclude all).** Distinct from no-data: `EmptyState` with "No
courses match these filters" + a ghost `[Clear filters]` `Button` that resets
search + all three Selects to `all`. (Filter values use sentinel `"all"`, never
empty string — matches memory lesson on Radix Select.)

**Error.** Read failure surfaces as an `InlineAlert` (status.error) banner above
the table: title from `ERROR_MESSAGES[code]`, a `[Retry]` ghost button (re-runs
the React Query fetch), and `ERROR_RECOVERY_HINTS` body. A global React Query
error boundary catches non-empty-state failures (common-API §6.3) — errors must
**never** render as a misleading empty state.

**Partial.** If `listSpaces` succeeds but class/teacher name resolution fails,
the catalog renders with class/teacher cells showing the raw fallback (truncated
id, as today's `getClassName` does) plus a dismissible `InlineAlert` "Some class
names couldn't be loaded." `space.stats` absent → show "—" not "0".

**Success.** Coverage strip + populated DataTable + Pagination. Sort indicator
on the active column. Active filters reflected as removable `Chip`s under the
toolbar (optional, web).

**Permission-gated variations by role (foundation domain rule, status report rec
#9 — drive UI off `currentMembership` permissions + `tenant.features`):**

- **`tenantAdmin`:** full screen — create, lifecycle transitions, class/teacher
  reassignment, bulk archive/restore. All writes go through callables (server
  re-authorizes).
- **`staff`** with a content/read permission: **read-only** catalog.
  `[+ New course]`, row `⋯` write actions, and the selection bar are hidden (not
  just disabled) via a `useCan(...)` gate. A subtle `Badge` "View only" sits
  beside H1.
- **`staff` without** the relevant permission / **feature-disabled tenant**
  (`tenant.features.levelUp === false`): the route itself is hidden from the
  Sidebar; direct navigation hits an `InlineAlert` "This feature isn't enabled
  for your academy" (`FEATURE_DISABLED`).
- **`superAdmin` (operating in tenant context):** full admin abilities **plus**
  a persistent `InlineAlert`/Banner "Viewing as super-admin — tenant: «name»" so
  cross-tenant context is never ambiguous (tenant isolation, §8).

---

## 6. Interactions & motion (foundation §4 motion tokens)

**Page entrance.** Content region fades/translates in over `page 420ms` with
`ease.entrance`; coverage cards stagger (`instant 100ms` apart) — subtle, not
celebratory. Respects `prefers-reduced-motion` (opacity-only).

**Search.** Debounced (~200ms); filters the current page client-side instantly;
when the catalog spans multiple pages, the debounce triggers a server
`listSpaces` with the search param. Result count updates in an
`aria-live="polite"` region.

**Filtering (Class / Status / Type).** `Select` change applies immediately
(`fast 160ms` row reflow). Filters compose (AND), exactly mirroring today's
`filtered` predicate. Filter chips animate in/out (`fast`, `ease.standard`).

**Sorting.** Column header click cycles asc → desc → none; caret rotates
`fast 160ms`. Default sort: Updated desc.

**Row click / open.** Clicking a course row (outside the checkbox/`⋯`) opens a
right-side **Drawer/Sheet** (`base 220ms`, `ease.entrance`) with a
`DefinitionList` of the space's structure: type, subject, accessType,
story-point & item counts (`stats`), assigned classes/teachers, version,
created/updated, createdBy. Drawer is read-first; an admin "Edit mapping" toggle
reveals `Combobox` pickers.

**Create course (admin).** `[+ New course]` opens a `Modal/Dialog` → on submit
calls `v1.levelup.saveSpace` (create branch, no `id`). **Optimistic** insert of
a pending row (muted, with a small `Skeleton` shimmer on stats) using a temp
key; on success the server `id` reconciles and a `Toast` "Course created"
appears; on error the optimistic row rolls back and `FormFieldError` / a `Toast`
(status.error) shows the `ApiErrorDetails` message.

**Lifecycle transition (publish / archive / restore).** From the row `⋯`
`Popover` or the selection bar. Each is a server-authoritative transition; the
client **pre-validates** against the shared `ALLOWED_TRANSITIONS` map
(common-API §6.2) so illegal options are disabled with a `Tooltip` ("Archived
courses must be restored to draft first"). Archiving opens a `ConfirmDialog`
(danger): "Archive «title»? Students lose access; teachers can restore it."
Optimistic status `Badge` flip with rollback on `INVALID_TRANSITION`.

**Reassign class/teacher.** Drawer or bulk action → `Combobox` multi-select →
`v1.levelup.saveSpace` with new `classIds`/`teacherIds`. Server re-derives
access + may refresh affected student claims (§8). Optimistic chip update;
`Toast` confirm.

**Bulk actions.** Selecting rows slides up the selection bar (`base 220ms`).
Bulk archive/restore shows a `LoadingOverlay` on the table during the sequence
and a summary `Toast` ("4 archived, 1 skipped — already archived"). Per-item
server rejection is reported in the toast, not silently dropped.

**Feedback rule.** All confirmations are `Toast` (sonner); all
destructive/irreversible-feeling actions go through `ConfirmDialog`. No motion
exceeds `slow 320ms` except the page entrance. No marigold burst (that
celebratory moment is reserved for the student gamification register, foundation
§4).

---

## 7. Content & copy (precise admin tone)

- **H1:** `Courses`
- **Subtitle:**
  `Audit and govern every learning space in your academy — status, class mapping, and structure.`
- **Primary CTA:** `New course`
- **Coverage card:** `«Subject»` · `«N» total` · `«M» published`
- **Search placeholder:** `Search courses by title, subject, or description`
- **Filter labels / default options:** `All classes`, `All statuses` (Draft /
  Published / Archived), `All types` (Learning / Practice / Assessment /
  Resource / Hybrid)
- **Table columns:** `Course`, `Status`, `Type`, `Subject`, `Classes`,
  `Teachers`, `Items`, `Updated`
- **Status labels:** `Draft`, `Published`, `Archived` (always with icon)
- **Unassigned class cell:** `Not assigned` (not blank)
- **Empty (no data, admin):** title `No courses yet` · body
  `Courses are learning spaces your teachers build in the Teacher Portal. Create one here to map it to classes, or ask a teacher to publish theirs.`
- **Empty (no data, staff read-only):** body
  `No courses yet. Teachers author and publish courses from the Teacher Portal.`
- **Empty (filtered):** title `No courses match these filters` · action
  `Clear filters`
- **Archive confirm:** title `Archive this course?` · body
  `«Title» will be hidden from students. Teachers can restore it to draft later.`
  · confirm `Archive` (danger) · cancel `Keep course`
- **Restore confirm:** title `Restore to draft?` · body
  `«Title» returns to draft. Re-publish it to make it visible to students again.`
- **Reassign success toast:** `Course mapping updated`
- **Create success toast:** `Course created`
- **Error banner (read):** title from `ERROR_MESSAGES`, e.g.
  `Couldn't load courses` · action `Retry` · hint from `ERROR_RECOVERY_HINTS`
- **Feature-disabled:**
  `Courses aren't enabled for your academy. Contact your platform administrator.`
- **Super-admin context banner:**
  `Viewing as super-admin — tenant: «Tenant name»`

Tone: declarative, no exclamation marks, no emoji, no second-person
cheerleading. "Course" is the admin-facing label; the underlying entity is a
**Space** (kept consistent with the Teacher Portal — never expose both terms in
the same view).

---

## 8. Domain rules surfaced

- **Tenant isolation (hard rule).** The catalog shows **only this tenant's**
  spaces. `tenantId` is derived server-side from `ctx.activeTenantId`
  (common-API §4.4) — never sent or selectable in the body. No cross-tenant
  data, ids, or names ever appear. Super-admin cross-tenant access is the _only_
  exception and is made explicit via the context banner + an audited
  `tenantOverride` (§5).
- **RBAC gating.** Reads gated to `isTenantAdmin(tenantId)` (= tenantAdmin or
  superAdmin) per `firestore.rules`; writes (`saveSpace`) re-authorized
  server-side. UI mirrors this with `useCan(...)`-driven visibility for
  staff/feature-gated tenants (rec #9). Rules are **defense-in-depth**, not the
  UI's authority.
- **Authoring stays in the Teacher Portal.** Admin **never** views or edits
  story-point/item content, rubrics' answers, or question payloads here. The
  catalog surfaces _structure and mapping_ only. The **answer key is never
  shown** — answer keys live in a deny-all server-only subcollection
  (`firestore.rules` `…/items/{id}/answerKeys/**`) and are out of scope for any
  admin screen. `AnswerKeyLock` semantics apply by absence: there is simply no
  path to them.
- **Server-authoritative lifecycle.** Status transitions obey
  `ALLOWED_TRANSITIONS` + `validatePublish` on the server; the client only
  _pre-disables_ illegal options for UX. A publish may be rejected server-side
  (e.g. empty space) → surfaced as `INVALID_TRANSITION` / validation error,
  never assumed.
- **Server-authoritative values.** `stats.*` (story points, items, students,
  avgCompletionRate), `version`, `publishedAt`/`archivedAt`, and `createdBy` are
  read-only server values — displayed, never edited from this screen.
- **Claims/access propagation.** Reassigning `classIds`/`accessType` changes
  which students can see the space; the rebuild's `saveSpace` must trigger the
  single `syncMembershipClaims` primitive for affected members (auth-access rec
  #3) so access isn't stale. The UI should not promise instant student
  visibility — copy says "re-publish to make visible."
- **Quota / feature gates.** The screen and its create action respect
  `tenant.features.levelUp`; "New course" additionally respects any
  content/space quota (`assertQuota`) — quota exhaustion returns
  `QUOTA_EXCEEDED` and is shown as an `InlineAlert`, not a silent failure.
- **Audit logging.** Every admin-initiated write (create, transition, reassign,
  bulk) is recorded to the single audit-log collection server-side (common-API
  §9). The UI does not need to display it but must not imply local-only changes.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Skip-link → Sidebar → Topbar (tenant switcher → ⌘K →
  notifications → profile) → Breadcrumb → H1 → New course → coverage strip →
  search → filters → view toggle → table header (select-all → sortable headers)
  → rows → pagination. Logical, top-to-bottom, left-to-right.
- **Keyboard:** All actions reachable without a pointer. `Select`/`Combobox` are
  Radix-based (typeahead, arrow nav, Esc to close). DataTable: `Tab` to a row,
  `Enter`/`Space` opens the detail drawer, `Space` on the row checkbox toggles
  selection; column headers are `<button>`s toggling sort (`aria-sort` set). Row
  `⋯` Popover is keyboard-triggerable and focus-trapped; Esc closes and returns
  focus to the trigger. The create `Modal` and reassign `Drawer` trap focus and
  restore it on close.
- **ARIA:** Table uses semantic `<table>` with `<th scope="col">` + `aria-sort`.
  Selection count and filtered result count announced via `aria-live="polite"`.
  Status `Badge`s expose text (`Published`, not just a colored dot) to AT. The
  coverage strip uses a labelled `role="group"`. `LoadingOverlay` sets
  `aria-busy` on the table.
- **Contrast:** All text/bg pairs meet AA (4.5:1 body, 3:1 UI) per foundation §2
  — `text.secondary` on `bg.surface`, status badges, and chip text all verified
  token pairs. Focus ring = `border.focus` `0 0 0 3px @35%` (foundation §4),
  visible on every interactive element.
- **Never status-by-color-alone:** every status, type, and confidence-like
  indicator pairs **icon + text label** with the color (foundation §2.2
  mandate). A red archived badge always reads "Archived" with an icon.
- **Reduced motion:** `prefers-reduced-motion` disables entrance
  translate/stagger, drawer slide, and badge-flip animations — replaced by
  instant opacity or no transition. Skeleton shimmer becomes a static muted
  block.
- **Touch targets:** ≥44px on all controls (foundation §4), critical for the
  `sm` stacked-card variant.

---

## 10. Web ↔ mobile divergence

Admin-web is **primarily a web/desktop tool** — this screen is designed
desktop-first and that is its main surface; there is no dedicated admin React
Native app in the rebuild. Divergence is therefore **responsive web only**, not
a separate native build:

- **Table → stacked cards.** On `sm`, the `DataTable` becomes a vertical list of
  `Card`s (foundation §6 rule). Sorting collapses into a single "Sort" `Select`;
  multi-column comparison is unavailable on the narrow viewport.
- **Sidebar → Tabbar / MobileBottomNav.** The role-driven Sidebar is replaced by
  the bottom nav on `sm`; Breadcrumb persists.
- **Hover → press.** Row hover affordances and hover-prefetch are pointer-only;
  touch uses press + the `⋯` action sheet.
- **⌘K CommandPalette is web-only** (foundation §5 / §6). The command palette
  ("jump to course", "create course") is not offered on touch; equivalent
  actions live in the visible toolbar.
- **Coverage strip** scrolls horizontally on `sm` instead of wrapping into a
  grid.
- The view toggle (table/grouped) is **hidden on `sm`** (cards only) — it is a
  desktop scanning aid.

No behavior, data, or permission differs by surface — only layout/affordance.
All reads/writes use the identical `api-client` hooks regardless of viewport
(and would on a future RN admin client, per common-API §2/§5).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen — "Courses" — for the Auto-LevelUp ADMIN web app,
using the "Lyceum" design system. Read and conform EXACTLY to
docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, spacing,
radii, shadows, motion, or component variants — compose only from Lyceum's tokens
and the §5 component inventory, citing tokens by semantic name (brand.primary,
bg.surface, status.success, text.secondary, border.subtle, etc.). This is admin
tooling: the SERIOUS, precise register — restrained chrome, NO marigold/spark in
chrome, no student playfulness.

CONTEXT
- Role: tenantAdmin (single tenant, hard tenant isolation — never cross-tenant).
- Route /courses inside AppShell (left Sidebar with role nav, Topbar with tenant
  switcher + ⌘K + notifications + profile, Breadcrumb "Home / Courses").
- Entity: a "Course" = a learning Space (tenants/{tenantId}/spaces). Fields:
  title, description, type (learning|practice|assessment|resource|hybrid),
  subject, status (draft|published|archived), accessType
  (class_assigned|tenant_wide|public_store), classIds[], teacherIds[],
  stats{totalStoryPoints,totalItems,totalStudents,avgCompletionRate}, version,
  createdBy, createdAt, updatedAt. Admin governs MAPPING + LIFECYCLE only —
  NEVER question content, rubrics, or answer keys (answer keys are server-only and
  must never appear).

BUILD
Typography: Fraunces (display H1), Schibsted Grotesk (UI/body), Spline Sans Mono
(numeric stats/ids). Light theme on bg.canvas, cards on bg.surface, radius/elevation
per foundation §4.

Layout (desktop-first, responsive sm/md/lg per the spec):
1. Page header: H1 "Courses" + one-line subtitle (text.secondary) + right-aligned
   primary Button "New course" (brand.primary, NOT spark).
2. Subject coverage strip: Stat/KPI cards, one per subject, "<N> total · <M> published",
   sorted by count desc.
3. Toolbar: search Input + three Selects (Class / Status / Type, default "All …",
   sentinel value "all" — never empty string) + a table/grouped view toggle.
4. DataTable (sort/filter/select/paginate): columns Course, Status, Type, Subject,
   Classes (Chips with "+N" overflow), Teachers, Items (mono), Updated, row "⋯".
   Status & Type as Badges that ALWAYS pair icon + text label + color (never color
   alone): Published=status.success+check, Draft=neutral border.strong+dot,
   Archived=text.muted+archive icon.
5. Selection action bar (slides up when rows checked): Archive / Restore /
   Reassign class. Pagination at footer.
6. Row click opens a right Drawer with a DefinitionList of structure + an admin
   "Edit mapping" mode (Combobox pickers for classes/teachers).

States: skeleton loading (cards + 8 table rows), empty (no data — admin sees
"New course" CTA, staff read-only does not), empty (filtered — "Clear filters"),
error InlineAlert with Retry, partial (raw id fallback for unresolved class names).
Role variants: tenantAdmin full; staff read-only (hide write actions, "View only"
badge); feature-disabled InlineAlert; superAdmin shows a "Viewing as super-admin —
tenant: <name>" banner.

Motion (foundation §4 tokens only): page entrance 420ms ease.entrance with subtle
card stagger; filters/sort 160ms; drawer 220ms; optimistic create/transition with
rollback; Toast (sonner) confirmations; ConfirmDialog (danger) for archive. Respect
prefers-reduced-motion.

Accessibility: semantic table with aria-sort, focus-trapped Modal/Drawer/Popover,
aria-live result + selection counts, ≥44px targets, WCAG AA contrast, status never
by color alone.

Mobile/responsive: on sm, DataTable → stacked Cards, Sidebar → MobileBottomNav,
coverage strip scrolls horizontally, view toggle + ⌘K hidden.

Deliver clean, production-ready React + Tailwind composed from Lyceum tokens/components
only. Flag anything that would require a NEW token or component (e.g. the segmented
view toggle) as a proposed foundation addition rather than inventing it silently.
```
