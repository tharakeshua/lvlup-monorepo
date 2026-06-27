# Learning Spaces Overview (Admin) — Design Spec

> **Design system:** Lyceum (`docs/rebuild-spec/design/00-FOUNDATION.md`). All
> tokens, type, spacing, motion, and components are cited by semantic name and
> composed from the §5 inventory. No new colors/fonts/radii/shadows are
> introduced except where explicitly flagged as a **proposed foundation
> addition**.
>
> **Register:** admin / staff — the _serious_ register. Restraint in chrome,
> mono for numerics, no gamification celebration. The marigold `spark` accent is
> **not** used here except as the single primary-CTA emphasis where a primary
> action exists.

---

## 1. Purpose & primary user

**Primary user:** `tenantAdmin` (school / academy administrator), scoped to
exactly one tenant.

**Job-to-be-done:** _"Give me one cross-teacher view of every learning space
(subject track) in my academy so I can see what's published vs. in draft, how
it's progressing/engaging students, which classes it's assigned to, and spot
spaces that are stalled, unassigned, or unpublished — without editing content
myself."_

This is a **read-first governance / oversight** screen. Authoring lives in the
Teacher Portal; the admin's job here is visibility, triage, and (optionally,
RBAC-gated) lifecycle/assignment actions. Today's live page
(`apps/admin-web/src/pages/SpacesOverviewPage.tsx`) is purely read-only; this
spec describes the rebuild target, which keeps read-first as the default and
gates any write affordances behind permission + confirmation.

The screen renders only spaces belonging to the admin's active tenant — tenant
isolation is a hard boundary (see §8). Super-admin cross-tenant control is **out
of scope** for this screen; that is a separate platform control-plane surface.

---

## 2. Entry points & route

**Route:** `/spaces` (admin-web). Declared in `apps/admin-web/src/App.tsx`;
reachable from `AppSidebar` nav group **Overview** (or **Content**, if `/spaces`
and `/courses` are merged per the rebuild recommendation — see §8). Also
reachable via the `⌘K` CommandPalette ("Spaces", "Learning spaces") and from a
class detail page's "Assigned spaces" link.

**Entry points:**

- Sidebar nav item **Spaces** (active-nav uses `brand.primary`).
- CommandPalette (`⌘K`) → "Go to Spaces".
- Deep link from `/classes/:classId` ("View assigned spaces" →
  `/spaces?classId=…`).
- Hover-prefetch of the lazy chunk via the admin route-prefetch map.

**Reads (from `docs/rebuild-spec/specs/common-api.md`):**

- **`v1.levelup.listSpaces`** — the primary list read. Replaces the current
  direct-Firestore `useSpaces(tenantId)` hook with the API-seam read endpoint
  that wraps `tenants/{tenantId}/spaces/*`. Tenant is implicit from the caller's
  active-tenant claim (no `tenantId` passed from the client beyond an optional
  `tenantOverride` that the server authorizes). Supports the shared cursor
  pagination contract (`{ items, nextCursor }`).
- **`v1.levelup.getSpaceProgress`** — per-space progress/engagement aggregate
  (completion rate, active students) for the SpaceCard metrics. Read
  lazily/batched per visible card or folded into a `listSpaces` projection that
  hydrates `Space.stats` (`totalStoryPoints`, `totalItems`, `totalStudents`,
  `avgCompletionRate`).
- Supporting reads for filter facets: **`useClasses`** (`tenants/{t}/classes`)
  and **`useTeachers`** (`tenants/{t}/teachers`) to resolve `classIds[]` /
  `teacherIds[]` to human-readable names in the assignment column and filter
  dropdowns.

**Writes (RBAC-gated, only if the admin shell exposes lifecycle/assignment
actions — otherwise this screen is pure read):**

- **`v1.levelup.saveSpace`** — lifecycle transitions only (`draft→published`,
  `published→{archived,draft}`, `archived→draft`), enforced server-side by
  `ALLOWED_TRANSITIONS` + `validatePublish` (publish-readiness check) + the
  store-listing side effect. Used for inline "Publish" / "Archive" / "Restore"
  actions and for class assignment edits (`classIds[]`). The client never sets
  `status` arbitrarily — it requests a transition and the server is
  authoritative.

Query keys: hierarchical `spaceKeys.list(tenantOverride)` per the `shared-hooks`
key factory; a `saveSpace` mutation invalidates only `spaceKeys.list(...)`
(narrowest correct scope), not the whole tenant subtree.

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** (Sidebar + Topbar) from §5 Navigation. The page owns
only the content region; Sidebar, Topbar (tenant switcher, `⌘K` search,
NotificationBell, profile/RoleSwitcher), breadcrumb, and `QuotaWarningBanner`
are shell-owned.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AppShell Topbar:  [tenant ▾]        ⌘K search        🔔   [admin ▾]        │
├────────────┬─────────────────────────────────────────────────────────────┤
│            │  Breadcrumb:  Home / Spaces                                   │
│  Sidebar   │                                                              │
│  (role nav)│  ┌── PAGE HEADER ────────────────────────────────────────┐  │
│            │  │  h1  Learning Spaces            [ + New space* ]        │  │
│  Overview  │  │  sub  All subject tracks across your academy           │  │
│  > Spaces  │  └────────────────────────────────────────────────────────┘  │
│  Classes   │                                                              │
│  Users     │  ┌── TOOLBAR (sticky on scroll) ─────────────────────────┐  │
│  Analytics │  │ [🔍 Search spaces…]   Status: All▾ Type▾ Class▾  ⊞ ☰ │  │
│  Config    │  └────────────────────────────────────────────────────────┘  │
│            │                                                              │
│            │  ┌── RESULTS REGION ─────────────────────────────────────┐  │
│            │  │  N spaces · M published · K draft                      │  │
│            │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                │  │
│            │  │  │SpaceCard │ │SpaceCard │ │SpaceCard │   (lg: 3-col)  │  │
│            │  │  └──────────┘ └──────────┘ └──────────┘                │  │
│            │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                │  │
│            │  │  │SpaceCard │ │SpaceCard │ │SpaceCard │                │  │
│            │  │  └──────────┘ └──────────┘ └──────────┘                │  │
│            │  │             [ Load more ]  (cursor pagination)         │  │
│            │  └────────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────────┘
* "New space" only if RBAC permits; admin authoring is typically deferred to Teacher Portal.
```

**Regions:**

1. **Page header** — `h1` "Learning Spaces" (Fraunces, `xl`/`2xl`), one-line
   subhead (Schibsted, `sm`, `text.secondary`). Optional trailing primary
   action.
2. **Toolbar** — search Input (left, flex-1), then Selects for Status / Type /
   Class, then a **view toggle** (Grid ⊞ / Table ☰) as a segmented IconButton
   pair. Sticky to the top of the content region on scroll with `bg.canvas` +
   `border.subtle` bottom rule.
3. **Results count strip** — `sm` `text.secondary` summary line ("12 spaces · 7
   published · 4 draft · 1 archived"), counts in Spline Mono.
4. **Results grid / table** — default **grid of SpaceCards**; optional
   **DataTable** view for dense scanning.

**Responsive grid (gap = spacing.4 / 16px; page gutters per foundation: mobile
16, tablet 24, desktop 32; max content width 1200):**

- **`sm` (<768):** 1 column. Toolbar wraps: search full-width on row 1;
  Status/Type/Class Selects + view toggle wrap to row 2. SpaceCards full-width,
  stacked. Sidebar collapses to the shell's mobile pattern (Tabbar / drawer).
- **`md` (768–1023):** 2 columns. Toolbar in a single row, filters may wrap.
  Sidebar visible (icon-or-expanded per shell).
- **`lg` (≥1024):** 3 columns. Toolbar single row. Full sidebar.
- **`xl` (≥1280):** still 3 columns, capped at 1200 max content width and
  centered; extra width becomes gutter rather than a 4th column (keeps card
  measure comfortable).

**Table view** (alternate, ≥`md` only — falls back to cards on `sm`): DataTable
columns — Space (title + type chip), Status, Subject, Story points (#), Items
(#), Students (#), Avg completion (ProgressBar + %), Classes (count/names),
Updated, ⋯ row actions.

---

## 4. Components used (from FOUNDATION §5 only)

**Navigation (shell-owned):** `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb`,
`CommandPalette` (⌘K), `RoleSwitcher`, `Tabbar` (mobile).

**Primitives:** `Input` (search, with leading search affordance), `Select`
(Status / Type / Class filters — never an empty-string value option, per
foundation lessons), `Button` (primary for "New space" if present;
ghost/secondary for filters), `IconButton` (grid/table view toggle, card
overflow ⋯).

**Containers:** `Card` (base for SpaceCard composition), `Popover` (card ⋯
overflow menu), `Tooltip` (metric labels, truncated assignment names),
`ConfirmDialog` (publish/archive/restore confirmation), `Modal/Dialog`
(assignment editor, if exposed).

**Data:** `DataTable` (sort/filter/paginate/select — alternate table view),
`Badge` (status: draft/published/archived), `Chip/Tag` (type, subject, labels),
`ProgressBar` (avg completion rate), `Stat/KPI` (count strip / optional header
KPIs), `EmptyState`, `Skeleton` (card-grid skeleton on load), `Pagination` /
"Load more" (cursor), `AvatarGroup` (assigned teachers, optional).

**Feedback:** `Toast` (sonner — confirm publish/archive success),
`InlineAlert/Banner` (error / partial-load), `ConfirmDialog`, `LoadingOverlay`
(during an in-flight lifecycle mutation on a card).

**Domain components (cross-app, §5):**

- **`SpaceCard`** — the central domain component for this screen. Anatomy below.
- (Indirectly) `ProgressRing` may substitute `ProgressBar` for the completion
  metric on the card if a compact circular read is preferred — both are in §5.

### `SpaceCard` anatomy (admin variant)

```
┌─ Card (radius lg, e1 at rest → e2 on hover, border.subtle) ──────────┐
│  [thumbnail strip / subject color rail]            [ ⋯ overflow ]    │
│  Title (Fraunces, base/lg, text.primary, 1–2 line clamp)            │
│  ┌ Badge:status ┐  ┌ Chip:type ┐  ┌ Chip:subject ┐                  │
│  Description (Schibsted sm, text.secondary, 2-line clamp)            │
│  ──────────────────────────────────────────────────────────────     │
│  Metrics row (Spline Mono numerics):                                 │
│   Story pts · Items · Students                                       │
│  Avg completion  ▓▓▓▓▓░░░░░  62%   (ProgressBar, mastery scale)      │
│  ──────────────────────────────────────────────────────────────     │
│  Footer: ▣ 3 classes   ◐ 2 teachers   ·   Updated 4d ago             │
└──────────────────────────────────────────────────────────────────────┘
```

- **Status `Badge`** (top-right): `draft` → neutral/`text.muted` outline;
  `published` → `status.success` (green) with check icon; `archived` →
  `text.muted` filled, muted. **Never status-by-color-alone** — each badge
  carries an icon + text label.
- **Type `Chip`**: `learning | practice | assessment | resource | hybrid` —
  neutral outline chips (admin register; do not use `spark`).
- **Avg completion `ProgressBar`**: uses the `mastery` domain scale conceptually
  (`mastery.inProgress` indigo for the fill; full = `mastery.mastered` green).
  Percentage label in Spline Mono. If `avgCompletionRate` is undefined → render
  "—" + "No data" muted, not a 0% bar (see §5 partial state).
- **`⋯` overflow `Popover`** (RBAC-gated): "View in Teacher Portal", "Publish" /
  "Archive" / "Restore" (lifecycle, confirmed), "Edit assignment", "Copy space
  ID". Read-only admins see only "View" + "Copy ID".

**Proposed foundation additions (flagged):**

- **`SegmentedControl` (grid/table view toggle).** §5 lists `Tabs` but not a
  compact 2-state segmented control. If we don't want to add it, compose the
  toggle from two `IconButton`s in a `pill`-radius group instead (no new token
  needed). **Recommendation:** compose from IconButtons; do not add a new
  component unless reused elsewhere.
- No new colors, fonts, spacing, radii, shadows, or motion tokens are required
  for this screen.

---

## 5. States

**Loading (skeleton).** On first load, render the toolbar in a disabled/quiet
state and the results region as a **`Skeleton` card grid** (matches the current
`CardGridSkeleton count={6}` at the responsive column count: 1/2/3 at sm/md/lg).
Each skeleton card mirrors the SpaceCard footprint (title bar, two badge blocks,
a metrics line, a progress bar block). No layout shift when real cards arrive
(reserve card height). Header + breadcrumb render immediately.

**Empty.**

- _No spaces exist at all in tenant:_ `EmptyState` — Fraunces title "No learning
  spaces yet", body "Teachers create spaces in the Teacher Portal. Once
  published, they'll appear here for oversight." Primary action only if admin
  authoring is enabled ("Create a space"); otherwise a secondary link "Open
  Teacher Portal". (Current code copy: "No spaces found / Teachers can create
  spaces from the Teacher Portal" — keep this intent.)
- _Filtered to empty_ (spaces exist but none match search/filters): distinct
  `EmptyState` — "No spaces match your filters", body "Try a different status,
  type, or search term." Action: ghost **Button** "Clear filters". Do **not**
  show the "create" CTA here.

**Error.** If `listSpaces` fails: full-region `InlineAlert/Banner`
(`status.error`, error icon + label, never color alone): "Couldn't load spaces.
<reason>" with a **Retry** button (re-runs the query). Toolbar stays interactive
so filters/search persist on retry. If a per-card `getSpaceProgress` fails but
the list loaded, degrade gracefully (see partial).

**Partial.** List loaded but secondary data missing:

- Per-card metric unavailable (`getSpaceProgress` failed or `stats` undefined) →
  render metric as "—" with a Tooltip "Metrics unavailable" rather than a
  misleading 0. Completion ProgressBar collapses to a muted "No data" label.
- `classIds`/`teacherIds` resolve to names lazily; until resolved, show counts
  ("3 classes") and hydrate names into the Tooltip when
  `useClasses`/`useTeachers` arrive.
- A space mid-transition (optimistic publish/archive in flight) shows a
  card-scoped `LoadingOverlay` + disabled overflow.

**Success.** Grid (or table) of SpaceCards; count strip reflects current
filtered totals; pagination "Load more" appears when `nextCursor` is present.

**Permission-gated variations (by role):**

- **`tenantAdmin` (full):** sees all tenant spaces; overflow exposes lifecycle
  (Publish/Archive/Restore) + assignment edit. Primary "New space" may appear if
  admin authoring is enabled for the tenant.
- **`staff` with limited `StaffPermissions`** (if staff reach this route):
  read-only — overflow shows only "View in Teacher Portal" + "Copy ID"; no
  lifecycle/assignment actions; no "New space"; lifecycle buttons hidden (not
  merely disabled) so the surface matches capability. Drive this off a
  `useCan('manageSpaces')`-style hook.
- **Feature-gated tenant** (`tenant.features.levelLeU`/`levelUp` disabled): if
  the LevelUp feature is off for the tenant, the route shouldn't be in nav at
  all; if reached directly, show a feature-disabled `EmptyState` ("Learning
  Spaces aren't enabled for this academy"), no data fetch.
- **Wrong tenant / role mismatch:** handled upstream by `RequireAuth` (Access
  Denied panel) — never reached here.

---

## 6. Interactions & motion (§4 motion tokens)

**Search.** Typing in the search `Input` filters client-side over `title` +
`subject` (current behavior) for the loaded page; for large tenants the search
debounces (~`base` 220ms) and re-queries `listSpaces` server-side with a `query`
param. Result count strip updates live. No card enter/exit thrash — filtered-out
cards fade/collapse with `fast` (160ms) `ease.exit`; incoming with `base`
`ease.entrance`.

**Filter Selects (Status / Type / Class).** Changing a Select re-derives the
grid. Selecting "All" clears that facet. Cards reflow with a `base` (220ms)
`ease.standard` layout transition; respect `prefers-reduced-motion` (instant
reflow, no fade).

**View toggle (Grid ⊞ ↔ Table ☰).** `instant`/`fast` crossfade between layouts;
selection persisted to local state (and optionally URL `?view=table`).

**Card hover.** Elevation `e1 → e2` over `fast` (160ms) `ease.standard`; cursor
indicates the whole card navigates to detail (read view in Teacher Portal / a
read-only admin detail).

**Lifecycle action (Publish / Archive / Restore)** — RBAC-gated, the only
writes:

1. Open overflow `Popover` → choose action.
2. **`ConfirmDialog`** required for state changes: e.g. Publish → "Publish
   '<title>'? Students in assigned classes will gain access." Archive → "Archive
   '<title>'? It will be hidden from students; existing progress is retained."
   Restore → "Move '<title>' back to draft?".
3. On confirm: **optimistic** status Badge flip + card `LoadingOverlay`; fire
   `v1.levelup.saveSpace` with the requested transition.
4. **Server is authoritative.** If `validatePublish` rejects (e.g. no story
   points / empty items), roll back the optimistic Badge and surface an
   `InlineAlert` on the card or a `Toast` ("Can't publish — this space has no
   content yet."). Success → `Toast` ("'<title>' published") and invalidate
   `spaceKeys.list(...)`.
5. Confirm dialog enter: `Modal/Dialog` uses `e3`, `base` entrance.

**Assignment edit** (assign space to classes): opens a `Modal/Dialog` with a
multi-select Combobox of classes (from `useClasses`); save → `saveSpace` with
updated `classIds[]`; optimistic count update on the card footer; rollback +
Toast on failure.

**Pagination.** "Load more" appends the next cursor page; new cards stagger-in
with `base` `ease.entrance` (stagger ≤ 40ms, capped so it never feels slow).
Reduced-motion → appear instantly.

All motion stays in the _subtle_ register — no spring pops, no marigold burst
(those are reserved for student gamification only).

---

## 7. Content & copy (precise admin tone)

**Page header**

- `h1`: **Learning Spaces** (current: "Spaces Overview" — prefer "Learning
  Spaces" for clarity; subject _tracks_, not generic "spaces").
- Subhead: **All subject tracks across your academy.** (current: "All learning
  spaces across teachers").

**Toolbar**

- Search placeholder: **Search spaces by title or subject…**
- Filter labels: **Status** (All / Draft / Published / Archived), **Type** (All
  / Learning / Practice / Assessment / Resource / Hybrid), **Class** (All /
  <class names>).
- View toggle aria-labels: **Grid view**, **Table view**.

**Count strip:** `{n} spaces · {p} published · {d} draft · {a} archived`
(numerals in mono). When filtered: `{n} of {total} spaces`.

**SpaceCard labels:** Status badges — **Draft**, **Published**, **Archived**.
Metric labels — **Story points**, **Items**, **Students**, **Avg. completion**.
Footer — **{n} classes**, **{n} teachers**, **Updated {relative}**.

**Overflow actions:** **View in Teacher Portal**, **Publish**, **Archive**,
**Restore to draft**, **Edit assignment**, **Copy space ID**.

**Empty states**

- No spaces: title **No learning spaces yet** · body **Teachers create spaces in
  the Teacher Portal. Once published, they'll appear here for oversight.**
- Filtered empty: title **No spaces match your filters** · body **Try a
  different status, type, or search term.** · action **Clear filters**.

**Error:** **Couldn't load spaces.** Sub: **{reason}. Check your connection and
retry.** · action **Retry**.

**Confirm copy**

- Publish: **Publish "{title}"?** — _Students in assigned classes will gain
  access to this space._ · **Publish** / **Cancel**.
- Archive: **Archive "{title}"?** — _It will be hidden from students. Existing
  progress and content are retained and can be restored._ · **Archive** /
  **Cancel**.
- Restore: **Restore "{title}" to draft?** — _It returns to draft and is removed
  from students until republished._ · **Restore** / **Cancel**.

**Toasts:** **Published "{title}".** / **Archived "{title}".** / **Restored
"{title}" to draft.** / **Couldn't publish — this space has no content yet.**

Tone: declarative, consequence-forward ("Students … will gain access"), no
exclamation marks, no playful copy.

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** The screen shows **only** spaces in the
   admin's active tenant. The client never passes a raw `tenantId` to fetch
   arbitrary data; the active tenant comes from custom claims and is enforced
   server-side in `listSpaces` (and re-asserted by `RequireAuth`'s
   `currentMembership.tenantId === currentTenantId` check). Any `tenantOverride`
   is server-authorized. A `tenantAdmin` can **never** see another tenant's
   spaces here; cross-tenant viewing is super-admin control-plane territory and
   is not part of this screen.
2. **RBAC gating.** Lifecycle/assignment write affordances are gated by
   permission (`tenantAdmin` full; limited `staff` read-only). Capability-absent
   actions are **hidden, not disabled**, so the surface matches the role. Drive
   visibility off a central `useCan(...)` hook, not ad-hoc role checks.
3. **Server-authoritative lifecycle.** Status transitions obey
   `ALLOWED_TRANSITIONS` (`draft→published`, `published→{archived,draft}`,
   `archived→draft`) enforced in `v1.levelup.saveSpace`. The client requests a
   transition; it does **not** set `status` freely. `validatePublish`
   (publish-readiness: has story points/items, etc.) can reject a publish — the
   UI must handle rejection (rollback + message), never assume success.
4. **Server-authoritative metrics.** Progress/engagement (`avgCompletionRate`,
   `totalStudents`, completion) come from server aggregates (`getSpaceProgress`
   / denormalized `Space.stats`). The UI displays them read-only and never
   computes "real" mastery client-side. Missing aggregate → "—", never a
   fabricated 0%.
5. **Answer-key never exposed.** This overview never reads or displays item
   answer keys. Even though admins are privileged, answer keys live in a
   server-only subcollection (`saveItem` strips them; only `getItemForEdit`
   re-merges for the authoring editor). The overview deals in counts and
   metadata only.
6. **Audit logging.** Lifecycle transitions and assignment edits are write
   events; `saveSpace` records a `ContentVersion`
   (`changeType: 'published' | 'archived' | 'updated'`, `changedBy`,
   `changedAt`). The UI should reflect "Updated {relative}" from the server,
   sourced from `updatedAt`/version history, not a local clock.
7. **Quota / cost awareness.** The shell's `QuotaWarningBanner` may surface
   tenant quota/AI-budget pressure above this page; the Spaces screen itself
   does not enforce quota but should not present "create"/AI-driven actions when
   the tenant is over quota (defer to shell banner state). Cost budgets are
   governed elsewhere (AI Usage).
8. **Spaces vs Courses consolidation.** Per the admin-web rebuild
   recommendation, `/spaces` and `/courses` are the same `spaces` collection
   viewed twice; the rebuild merges them into a single "Content / Spaces"
   overview. This spec is the canonical overview; `/courses` should redirect
   here.
9. **Soft-delete / archive, not destroy.** Admins archive (recoverable) rather
   than hard-delete from this surface; content + progress are retained. No
   destructive "delete space" action is exposed here.

---

## 9. Accessibility (WCAG AA)

**Focus order:** Skip-to-content (shell) → breadcrumb → `h1` → primary action
(if present) → search Input → Status Select → Type Select → Class Select → view
toggle (Grid/Table) → first SpaceCard → … → "Load more". Logical, left-to-right,
top-to-bottom; matches visual order.

**Keyboard:**

- All filters, toggles, and card actions reachable and operable by keyboard.
  Selects follow the Radix Select pattern (arrow keys, type-ahead, Esc to close)
  — **never an empty-string `value`** (foundation lesson).
- SpaceCard is a focusable element with a clear focus ring (`border.focus`,
  `0 0 0 3px indigo @35%`); Enter activates the primary navigation; the `⋯`
  overflow opens with Enter/Space and is itself a menu (`Popover`) with roving
  focus and Esc-to-close.
- `ConfirmDialog`/`Modal` trap focus, restore focus to the triggering control on
  close, Esc cancels.
- View toggle is a grouped control (`role="group"` / radiogroup) with arrow-key
  movement between Grid/Table.

**ARIA / semantics:**

- Results region: `role="list"` (grid view) / native table semantics (table
  view), cards as `role="listitem"`.
- Status conveyed with **icon + text label** inside each Badge — **never color
  alone** (Draft/Published/Archived are read by screen readers and visually
  distinct beyond hue). Type/subject chips are text.
- Progress: `ProgressBar` exposes `role="progressbar"` with
  `aria-valuenow/min/max` and a visible "62%" label (mono); "No data" announced
  when absent.
- Live regions: the count strip and search/filter results use
  `aria-live="polite"` so result counts are announced after filtering. A route
  announcer (shell) announces page title on navigation.
- Loading skeletons are `aria-hidden` with an accompanying `aria-busy`/"Loading
  spaces" status.

**Contrast:** All text/bg pairs meet AA (body 4.5:1, large/UI 3:1) per
foundation. Muted metadata (`text.muted`) is used only for large/secondary text
or paired with sufficient weight; status badges meet 3:1 against the card
surface.

**Reduced motion:** `prefers-reduced-motion` removes card fade/stagger, hover
elevation transitions, and layout-reflow animation — replaced with instant state
changes. No motion-only feedback (every change has a text/Toast counterpart).

---

## 10. Web ↔ mobile divergence

**This is an admin (`tenantAdmin`) tool and is primarily web / desktop.** There
is no dedicated native admin app screen; admin-web is responsive down to `sm`
for incidental phone/tablet use, but the design target is desktop oversight.

- **Layout:** 3-col grid (lg) → 2-col (md) → single-column stacked SpaceCards
  (sm). The **DataTable (table view) is web/desktop-only** (≥`md`); on `sm` it
  always falls back to stacked SpaceCards (tables don't shrink gracefully — this
  matches the foundation's "table on web → stacked cards on mobile" rule).
- **Toolbar** wraps to two rows on `sm`; filters may collapse into a single
  "Filters" `Drawer/Sheet` trigger on the smallest widths to preserve tap
  targets (≥44px).
- **Interaction:** hover-elevation and hover-prefetch are pointer-only; on
  touch, the whole card is a tap target and the `⋯` overflow opens on tap. No
  hover-dependent affordance.
- **`⌘K` CommandPalette is web-only** (per foundation). On mobile there is no
  command palette; navigation is via the shell's mobile nav (Tabbar / drawer).
- **RoleSwitcher / tenant switcher** live in the shell; on mobile they move into
  the shell's mobile nav. Tenant isolation is identical across form factors.

---

## 11. Claude-design prompt (ready-to-paste)

```
You are designing ONE screen for the Auto-LevelUp admin web app, conforming to the
"Lyceum" design system (docs/rebuild-spec/design/00-FOUNDATION.md). Read that
foundation first and use ONLY its tokens and §5 component inventory — do not invent
colors, fonts, spacing, radii, shadows, motion, or component variants. Cite tokens by
semantic name (brand.primary, bg.surface, text.secondary, status.success, status.error,
mastery.inProgress, border.subtle, e1/e2/e3, motion fast/base, ease.standard). This is
the SERIOUS admin register: restrained chrome, Fraunces for headings, Schibsted Grotesk
for UI/body, Spline Sans Mono for all numerics. Do NOT use the marigold `spark` accent
or any gamification celebration — that's the student register.

SCREEN: "Learning Spaces Overview" — admin-web, route /spaces, audience tenantAdmin
(scoped to ONE tenant; tenant isolation is a hard rule — never show cross-tenant data).

Build it inside AppShell (Sidebar + Topbar + breadcrumb). Content region:
1) Page header: h1 "Learning Spaces" (Fraunces), subhead "All subject tracks across your
   academy." Optional primary Button "New space" (only if RBAC allows; usually omitted).
2) Sticky toolbar: search Input ("Search spaces by title or subject…"), Selects for
   Status (All/Draft/Published/Archived), Type (Learning/Practice/Assessment/Resource/
   Hybrid), Class; and a Grid/Table view toggle (compose from two IconButtons in a pill
   group — do NOT add a new component).
3) Count strip (mono numerals): "12 spaces · 7 published · 4 draft · 1 archived".
4) Responsive grid of SpaceCard domain components: 1 col (sm) / 2 (md) / 3 (lg), gap 16,
   max content width 1200 centered.

SpaceCard (admin variant): Card (radius lg, e1 at rest → e2 on hover). Title (Fraunces,
1–2 line clamp). A status Badge (Draft = muted outline; Published = status.success with a
check icon; Archived = muted) — ALWAYS icon + text label, never color alone. Type + subject
Chips (neutral outline). 2-line description. Divider. Metrics row in Spline Sans Mono:
Story points · Items · Students. "Avg. completion" ProgressBar (mastery.inProgress fill) +
% label; if no data show "—" / "No data", never a fake 0%. Footer: "{n} classes ·
{n} teachers · Updated {relative}". A "⋯" overflow Popover (RBAC-gated): View in Teacher
Portal, Publish, Archive, Restore to draft, Edit assignment, Copy space ID. Read-only
roles see only View + Copy ID.

DATA (read-first): list via v1.levelup.listSpaces (tenant implicit from claims; cursor
pagination → "Load more"); metrics via v1.levelup.getSpaceProgress / Space.stats
(totalStoryPoints, totalItems, totalStudents, avgCompletionRate); class/teacher names via
useClasses/useTeachers. WRITES are lifecycle-only via v1.levelup.saveSpace, server-
authoritative (ALLOWED_TRANSITIONS draft→published, published→{archived,draft},
archived→draft; validatePublish can reject). All status changes require a ConfirmDialog,
do an optimistic Badge flip with a card LoadingOverlay, roll back + Toast on server
rejection. NEVER show answer keys. Status is server-authoritative; metrics are server-
authoritative.

STATES to render: (a) loading skeleton card grid (1/2/3 cols), (b) empty — no spaces
("No learning spaces yet" → Teachers author in the Teacher Portal), (c) filtered-empty
("No spaces match your filters" + "Clear filters"), (d) error InlineAlert + Retry,
(e) partial (missing metric → "—"), (f) success grid. Read-only staff variant: hide
lifecycle/assignment actions (hidden, not disabled).

A11Y: logical focus order (search → filters → view toggle → cards → Load more); cards
focusable with border.focus ring; Selects never use empty-string values; status conveyed
by icon+label not color; ProgressBar has aria-valuenow + visible %; count/results in an
aria-live="polite" region; respect prefers-reduced-motion (instant, no stagger/fade). All
text meets WCAG AA. Table view is desktop-only (≥md); on mobile always stack SpaceCards.
⌘K command palette is web-only.

Deliver: a clean, production-quality React + Tailwind layout that reads Lyceum tokens via
CSS custom properties, composes the components above, and includes all six states. Keep
chrome restrained and credible — this is staff tooling, not the student app.
```
