# Spaces Library (Space List)

> The teacher/admin landing for content authoring: a browsable, filterable
> library of every Space in the tenant, with create, search, sort, and lifecycle
> quick-actions (edit, duplicate, publish, archive, view-in-store). Conforms to
> the Lyceum foundation (`docs/rebuild-spec/design/00-FOUNDATION.md`).

---

## 1. Purpose & primary user

**Primary user:** Teacher (content author) and tenantAdmin (oversight).
Role-gated by `assertTeacherOrAdmin` server-side.

**Job-to-be-done:** "When I sit down to build or maintain learning content, I
want to see all my Spaces at a glance, find the one I need fast, understand its
lifecycle state and size, and jump straight into editing or move it through its
lifecycle — without leaving this page." This is the _home base_ of the authoring
surface; every content task starts here.

Secondary reader: a tenantAdmin auditing the whole tenant's catalog (sees all
Spaces, not just ones they author). Students and consumers never reach this
screen — they consume the published student/store views; the library is
staff-only.

---

## 2. Entry points & route

- **Route:** `/spaces` (teacher-web `SpaceListPage`). Default landing for the
  Content/Spaces nav item in the `Sidebar`.
- **Entered from:** `Sidebar` "Spaces" nav item; `CommandPalette` (⌘K) "Go to
  Spaces"; `Breadcrumb` root when backing out of `/spaces/:spaceId/edit`.
  Post-create redirect lands in the editor, not here.

**Common-API reads** (`specs/common-api.md` — typed repos, never direct
Firestore):

- `v1.levelup.listSpaces` — paged list, server-filtered by `status` / `type` /
  `accessType`, sorted; `tenantId` derived server-side from auth claims (NOT in
  request body).

**Common-API writes** (versioned callables; these replace the legacy client
`writeBatch`/`getDocs` paths still present in the live `SpaceListPage.tsx`):

- `v1.levelup.saveSpace` — create (no `id`), duplicate, and lifecycle
  transitions (publish/archive/restore-to-draft) plus store listing.
  Consolidated endpoint replacing
  `createSpace`/`updateSpace`/`publishSpace`/`archiveSpace`/`publishToStore`.
- Row/card click → navigate to `/spaces/:spaceId/edit` (the Space Editor
  screen).

> Note: the current live page loads story points + items client-side (`getDocs`)
> to duplicate. The rebuild moves duplication server-side behind `saveSpace` (or
> a dedicated duplicate path) — the UI must NOT touch Firestore directly. Stats
> are trigger-maintained and authoritative; never recompute counts client-side.

---

## 3. Layout — wireframe-as-text

Rendered inside `AppShell` (`Sidebar` + `Topbar`). This screen owns the main
content region only. Max content width 1200; page gutters per FOUNDATION §4
(mobile 16 / tablet 24 / desktop 32).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · ⌘K search · notifications · profile)  │
│         ├──────────────────────────────────────────────────────────────── │
│         │  HEADER ROW                                                       │
│         │  ┌ Spaces (h1, Fraunces)            [ View ▦/≣ ] [+ New Space]  │ │
│         │  └ "Build and manage your learning content" (text.secondary)     │
│         │                                                                   │
│         │  TOOLBAR (sticky on scroll, bg.surface, border.subtle bottom)    │
│         │  ┌ [🔍 Search spaces…]  [Type ▾] [Access ▾]  [Sort ▾]          │ │
│         │  │  Status segmented:  ( All · Draft · Published · Archived )   │ │
│         │  └ active-filter Chips row (dismissible) · "N spaces"           │ │
│         │                                                                   │
│         │  CONTENT — Grid (default) OR Table (toggle)                       │
│         │  GRID  lg: 3 cols · md: 2 cols · sm: 1 col   gap=4 (16px)        │
│         │  ┌SpaceCard┐ ┌SpaceCard┐ ┌SpaceCard┐                            │
│         │  │ thumb   │ │ thumb   │ │ thumb   │   ← status chip top-right  │
│         │  │ title   │ │ title   │ │ title   │   type·access·status       │
│         │  │ chips   │ │ chips   │ │ chips   │   SP · items · students    │
│         │  │ stats   │ │ stats   │ │ stats   │   last-edited · owner · ⋯  │
│         │  └─────────┘ └─────────┘ └─────────┘                            │
│         │  … Pagination (load-more or numbered)                            │
│         └──────────────────────────────────────────────────────────────── │
└────────────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **sm (<640):** single-column card stack; toolbar collapses — search full-width
  on its own row, Type/Access/Sort fold into a single "Filters" `Drawer/Sheet`
  trigger; status segmented control becomes a horizontally scrollable chip row.
  View toggle hidden (cards only). `+ New Space` becomes an `IconButton` or
  pinned bottom action.
- **md (768–1023):** 2-col grid; toolbar stays inline but Sort may collapse into
  the Filters sheet.
- **lg (≥1024):** full toolbar inline, 3-col grid, optional `DataTable` view via
  the ▦/≣ toggle.

**Table view (lg, opt-in):** `DataTable` columns — Title (+ type chip) · Status
· Access · Story points · Items · Students · Last edited · Owner · Actions (⋯).
Sortable headers map to `listSpaces` sort params; selection checkboxes enable
bulk archive.

---

## 4. Components used (FOUNDATION §5 only)

- **Domain:** `SpaceCard` (primary grid unit — anatomy: optional thumbnail,
  title, description clamp, status/type/access chips, stat row, last-edited +
  owner meta, overflow actions).
- **Navigation:** `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb` (root "Spaces"),
  `CommandPalette` (jump-to + "New Space" command).
- **Primitives:** `Button` (primary = New Space; spark variant NOT used here —
  staff utility surface, reserve spark for gamification/hero CTAs), `IconButton`
  (view toggle, card overflow trigger), `Input` (search), `Select`/`Combobox`
  (Type, Access, Sort filters), `Checkbox` (table bulk-select).
- **Containers:** `Card` (SpaceCard base), `Modal/Dialog` (Create Space template
  chooser), `Popover` (card overflow menu of quick actions), `ConfirmDialog`
  (archive/publish confirmations), `Drawer/Sheet` (mobile filters), `Tooltip`
  (truncated stat labels, disabled-action reasons).
- **Data:** `DataTable` (table view), `Chip/Tag` (status, type, access, labels,
  active-filter pills), `Badge`, `Stat/KPI` (compact inline counts),
  `EmptyState`, `Skeleton` (loading), `Pagination`, `Avatar` (owner).
- **Feedback:** `Toast` (sonner — success/error after
  create/duplicate/publish/archive), `InlineAlert/Banner` (publish-validation
  failure detail), `LoadingOverlay` (per-card during duplicate).

**Proposed addition to FOUNDATION:** a small **`SegmentedControl`** primitive
for the Status filter (All/Draft/Published/Archived). FOUNDATION §5 has `Tabs`
but a compact pill-segmented control reads better as a _filter_ than as page
tabs. If not added, fall back to `Tabs` styled as pills (radius `pill`,
`bg.surface-sunken` track, `brand.primary` active fill) — the live page already
approximates this.

---

## 5. States

**Loading (skeleton):** grid of 6 `Skeleton` cards at card height (matches lg
3-col), shimmer at `motion.base`, respecting reduced-motion (static). Toolbar
renders immediately (filters are local UI); only the content region skeletons.

**Empty (no spaces at all):** `EmptyState` — `BookOpen`-class icon, Fraunces
title "No spaces yet", body copy, primary `Button` "Create your first space".
Encouraging-but-precise (staff audience).

**Empty (filtered/searched, but tenant has spaces):** distinct `EmptyState` —
"No matches", secondary `Button` "Clear filters". Never show the create-CTA here
(it implies the tenant is empty when it isn't).

**Partial:** results loaded but `Pagination` "Load more" pending → spinner on
the load-more button only; existing cards stay interactive. Per-card stats may
show `0` legitimately (fresh space) — that is success, not partial.

**Error:** content region replaced by `InlineAlert` (status.error) — "Couldn't
load spaces" + `Button` "Retry" (re-invokes `listSpaces`). Toolbar stays usable.
Transient action errors (failed publish/archive) surface as `Toast`
(status.error) and, for publish-validation failures, an expandable
`InlineAlert`/`Banner` listing the specific reasons returned by
`validatePublish`.

**Success:** populated grid/table; counts and chips reflect server-authoritative
`stats`.

**Permission-gated variations:**

- **teacher:** sees Spaces where they author or are assigned; quick actions
  limited to spaces they own/co-teach (`teacherIds`). Actions on non-owned
  spaces are disabled with a `Tooltip` reason.
- **tenantAdmin:** sees ALL tenant spaces; owner avatar/name shown prominently
  (multi-author oversight); may archive/restore any.
- **student / consumer:** no access to this route (guarded by route manifest +
  `assertTeacherOrAdmin`). They never reach the library.
- **Tenant isolation:** `listSpaces` only ever returns the caller's tenant
  (tenantId from claims) — cross-tenant spaces are physically unreachable. The
  B2C store mirror (`tenants/platform_public`) is a _separate_ surface, surfaced
  here only via the per-card "View in store" link when `publishedToStore`.

---

## 6. Interactions & motion

**Create:** `+ New Space` opens the Create `Modal/Dialog` with a template
`Select` (Blank / Course / Assessment / Practice → maps to `SpaceType`). Confirm
→ `saveSpace` (no `id`) → on success `Toast` "Space created" + navigate to
`/spaces/:id/edit`. Dialog enters at `motion.base` with `ease.entrance`;
backdrop fades.

**Search:** local debounce (~200ms) for instant title filtering of the loaded
page; for full-catalog search the query is passed to `listSpaces` (server-side)
on debounce settle. Clearing search restores the active filter set.

**Filter / sort:** changing Type, Access, Status, or Sort re-invokes
`listSpaces` with new params; content cross-fades (`motion.fast`,
`ease.standard`); active filters render as dismissible `Chip`s; the "N spaces"
count updates. Filter state is URL-synced (querystring) so links/back-button are
shareable.

**Open editor:** click card body or row → navigate to editor (`motion.page`
route transition).

**Quick actions** (card overflow `Popover` / table Actions): Edit · Duplicate ·
Publish · Archive · Restore to draft · View in store.

- **Duplicate:** `LoadingOverlay` on that card; `saveSpace` duplicate path;
  `Toast` "Space duplicated" → navigate to the copy's editor. Optimistic: an
  inert placeholder card may appear at list head, replaced on resolve.
- **Publish (draft→published):** `ConfirmDialog`. Calls
  `saveSpace { status: 'published' }`. If `validatePublish` fails server-side,
  dialog stays open and surfaces the returned reason list in an `InlineAlert`
  (e.g. "Story point X has no items", "Timed test Y needs a duration"). On
  success: card status chip animates draft→published (`motion.base`), `Toast`
  "Published — students notified".
- **Archive (published→archived):** `ConfirmDialog` warning that in-progress
  test sessions will be expired (server side-effect). On success the card
  visually de-emphasizes (lower opacity, muted chips) and, if the Status filter
  excludes archived, animates out (`ease.exit`, `motion.fast`).
- **Restore to draft (archived→draft / published→draft):**
  `saveSpace { status: 'draft' }`; if it was store-listed, the store mirror is
  removed server-side — `ConfirmDialog` mentions this.

**Optimistic updates:** status-chip changes apply optimistically and roll back
on error (chip reverts + `Toast` status.error). Counts are NOT optimistically
edited (server-authoritative).

All transitions use FOUNDATION motion tokens (`instant`/`fast`/`base`/`page`);
no celebratory/spark motion on this staff surface — that energy is reserved for
student gamification per FOUNDATION §1/§4.

---

## 7. Content & copy

Tone: **precise, operator-grade** for staff. No exclamation marks except a
single encouraging beat on the first-run empty state.

- **h1:** "Spaces" (Fraunces).
- **Subtitle:** "Build and manage your learning content."
- **Primary CTA:** "New Space".
- **Search placeholder:** "Search spaces…"
- **Filters:** "Type", "Access", "Sort". Status segments: "All", "Draft",
  "Published", "Archived". Sort options: "Recently edited", "Title A–Z", "Story
  points", "Items", "Students".
- **Status chip labels:** "Draft", "Published", "Archived". **Type chips:**
  "Learning", "Practice", "Assessment", "Resource", "Hybrid". **Access chips:**
  "Class-assigned", "Tenant-wide", "Public store".
- **Card stat row:** "{n} story points · {n} items · {n} students" · "Edited
  {relative time}" · owner name/avatar.
- **Empty (first run):** title "No spaces yet" · body "Create your first space
  to start building learning content." · CTA "Create your first space".
- **Empty (filtered):** title "No matches" · body "No spaces match your current
  filters." · CTA "Clear filters".
- **Quick-action labels:** "Edit", "Duplicate", "Publish", "Archive", "Restore
  to draft", "View in store".
- **Confirms:** Archive — "Archive this space? In-progress test sessions will be
  ended and students will lose access." Publish — "Publish this space? Assigned
  students will be notified."
- **Errors:** load — "Couldn't load spaces. Check your connection and try
  again." Publish-validation banner header — "This space isn't ready to
  publish:" (followed by server reason list). Generic action — "Couldn't
  {action} the space. Try again."

---

## 8. Domain rules surfaced

- **Status lifecycle is gated.** Quick actions only offer transitions allowed by
  `ALLOWED_TRANSITIONS` (draft→published; published→{archived,draft};
  archived→draft). Disallowed transitions are never rendered as options. Publish
  is additionally gated by `validatePublish` (title present, ≥1 story point,
  each timed_test has duration>0, each story point has ≥1 item) — the UI
  surfaces server-returned reasons rather than guessing.
- **Answer-key security:** N/A on this list surface (no item answers shown
  here), but reinforced downstream — never expose answer keys; this screen only
  links into the editor which handles `getItemForEdit` re-merge. Students never
  reach this route.
- **Tenant isolation:** `listSpaces` is tenant-scoped via auth claims;
  `tenantId` is never sent in the request body. No cross-tenant leakage.
- **Stats are server-authoritative** (trigger-maintained): story-point / item /
  student counts come from `space.stats`; the UI displays them verbatim and
  never recomputes.
- **Store mirror is separate:** `publishedToStore` spaces appear in the B2C
  store under `tenants/platform_public`; the card exposes a "View in store" link
  but the store catalog itself is a distinct screen. Listing requires
  `status === 'published'` first (enforced server-side).
- **Server side-effects on transitions:** archive expires active
  `digitalTestSessions`; publish fires student notifications; restore-to-draft
  removes any store listing. Confirm copy must reflect these so staff aren't
  surprised.
- **Ownership:** teachers act only on spaces where they are in `teacherIds`;
  tenantAdmin overrides. Enforced server-side; mirrored as disabled UI with
  explanatory tooltips.

---

## 9. Accessibility

- **Focus order:** skip-link → `Topbar` → header (h1 then New Space) → view
  toggle → toolbar (search → Type → Access → Sort → status segments) →
  active-filter chips → content (cards/rows in DOM order) → pagination.
- **Cards as links:** each `SpaceCard` is a single focusable link to the editor
  with an accessible name = space title + status
  (`aria-label="Algebra Foundations, published"`). Overflow actions are a
  separate nested `IconButton` with its own focus stop and
  `aria-haspopup="menu"`; the action `Popover` is a proper menu (arrow-key
  navigable, `Esc` closes, focus returns to trigger).
- **Status NEVER by color alone:** every status/type/access chip pairs an icon +
  text label (FOUNDATION §2 contrast rule). Confirms and toasts state status in
  words.
- **Keyboard:** ⌘K opens `CommandPalette`; `/` focuses search; status segments
  are a radiogroup (arrow keys); `DataTable` headers are sortable buttons with
  `aria-sort`; bulk-select checkboxes operable and announced ("3 spaces
  selected").
- **Contrast:** all chip text/background pairs meet WCAG AA (4.5:1 body, 3:1
  UI/large); muted meta text on `bg.surface` verified against
  `text.secondary`/`text.muted` tokens.
- **Live regions:** result count and filter changes announced via
  `aria-live="polite"`; action success/failure via toast region. Loading
  skeletons marked `aria-busy`.
- **Reduced motion:** `prefers-reduced-motion` disables card cross-fade,
  skeleton shimmer, and chip-status animation — state changes apply instantly.
- **Targets:** all interactive elements ≥44px touch target (FOUNDATION §4);
  overflow trigger and chips padded accordingly on touch.

---

## 10. Web ↔ mobile divergence

Component names/props match 1:1 between `shared-ui` (web) and `ui-native`
(mobile); only the renderer differs (FOUNDATION §6).

- **Table → cards:** the optional `DataTable` view is **web-only**. Mobile (RN)
  always renders the `SpaceCard` stack; no view toggle.
- **Hover → press:** web card hover (elevation `e1`→`e2`, title→`brand.primary`,
  reveal overflow) becomes press/long-press on mobile; overflow actions surface
  via a bottom `Sheet` action list instead of a hover-revealed `Popover`.
- **⌘K absent:** no `CommandPalette` on mobile; jump-to-space lives in the
  `Topbar`/`Tabbar` search. `/`-to-focus shortcut is web-only.
- **Filters:** web shows inline toolbar at md+; mobile always uses the
  `Drawer/Sheet` filter pattern (also used by web at sm).
- **New Space:** web header `Button`; mobile a floating/pinned action and the
  create flow is a full-screen `Sheet` rather than a centered `Modal`.
- **Density:** mobile uses single-column, larger touch targets, and may hide the
  description clamp to keep cards compact.
- **Navigation chrome:** web `Sidebar`; mobile `Tabbar` + `RoleSwitcher` (merged
  mobile apps).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the "Spaces Library (Space List)" screen for Auto-LevelUp, an EdTech
content-authoring platform. STRICTLY conform to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md — use ONLY its semantic color tokens
(bg.canvas, bg.surface, text.primary/secondary/muted, brand.primary, border.subtle,
status.success/warning/error/info), typography (Fraunces display for h1 + empty-state
titles, Schibsted Grotesk for UI/body/labels/buttons, Spline Sans Mono for numeric
counts), spacing/radius/elevation/motion from §4, and components from §5 only. Do NOT
invent colors, fonts, or component names. Reserve the marigold "spark" accent for
gamification — this is a precise staff utility surface, so use brand.primary for the
primary CTA, not spark.

SCREEN: teacher/admin landing at /spaces. A browsable library of all Spaces in the tenant.

LAYOUT (inside AppShell = Sidebar + Topbar): header row with Fraunces "Spaces" h1,
subtitle "Build and manage your learning content", a grid/table view toggle, and a
brand.primary "New Space" button. Below: a sticky toolbar — search Input, Type and
Access Select filters, a Sort Select, and a pill SegmentedControl for status
(All/Draft/Published/Archived), plus a row of dismissible active-filter Chips and an
"N spaces" count. Main region: responsive grid of SpaceCard components — lg 3 cols,
md 2 cols, sm 1 col, gap 16. Each SpaceCard shows optional thumbnail, title, 2-line
description clamp, a status chip (top-right), type + access chips, a numeric stat row
(story points · items · students, Spline Mono), last-edited relative time, owner avatar,
and an overflow IconButton opening a Popover of quick actions (Edit, Duplicate, Publish,
Archive, Restore to draft, View in store). Include Pagination.

STATES: skeleton grid (6 cards) while loading; first-run EmptyState ("No spaces yet" +
"Create your first space"); filtered-empty EmptyState ("No matches" + "Clear filters");
error InlineAlert with Retry. Status/type/access chips MUST pair an icon with a text
label (never color alone). Cards: rest elevation e1, hover e2 with title → brand.primary.

ACCESSIBILITY: each card is one focusable link (aria-label = title + status); overflow
menu is a separate keyboard-navigable menu; WCAG AA contrast; respect prefers-reduced-
motion (no shimmer/cross-fade). Motion: filter changes cross-fade at 'fast'; dialog
enters at 'base' with ease.entrance.

Generate clean React + Tailwind using the @theme tokens that mirror FOUNDATION, composing
from shared-ui components (SpaceCard, Button, Input, Select, Chip, EmptyState, Skeleton,
Dialog, Popover, Pagination, DataTable). Use realistic sample data (5–6 spaces across
draft/published/archived and learning/practice/assessment types).
```
