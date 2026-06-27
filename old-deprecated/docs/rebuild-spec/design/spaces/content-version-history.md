# Content Version History — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens, type, spacing,
> motion and components are cited by name — never re-pasted or invented.

The **History** tab of the space editor: a paginated, read-heavy **Timeline** of
`ContentVersion` entries for a space — who changed what, when, the change type,
and the status at the time — with the ability to inspect a version snapshot and
(rebuild) **restore** or **branch** from it. It surfaces the audit trail that
every `save*` callable silently produces.

---

## 1. Purpose & primary user

**Primary user:** `teacher` and `tenantAdmin` (content authors / reviewers).

**Job-to-be-done:** "When I (or a co-author) have been editing a space over
days, I want to see an honest, time-ordered record of every change — who
published it, who archived it, who edited a story point or item — so I can
understand how the current state came to be, inspect what a past version looked
like, and safely roll back or branch from it if a recent edit broke something."

This is a forensic, **precise** staff surface — closer to a git log than to a
student feed. Tone is calm, factual, second-person. There is **no** gamification
spark here; the only accent energy is the `brand.primary` "now" node and the
restore-success Toast. The screen is overwhelmingly **read**: the one mutating
action (restore/branch) is deliberately gated behind confirmation.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/edit` → **History** tab (`SpaceEditorPage.tsx`,
`TabsContent value="versions"`).

Reachable from:

- The space editor **Tabs** strip: Overview · Story Points · Items · Rubric ·
  Settings · **History**.
- A deep link / row action elsewhere (e.g. a "View history" link on a
  published-status banner) lands on this tab with an optional
  `?entityType=&entityId=` filter pre-applied.

**Common-API reads/writes** (cite `docs/rebuild-spec/specs/common-api.md`):

- **Read (primary):** `v1.levelup.listVersions` — paged over
  `tenants/{tenantId}/spaces/{spaceId}/versions`, ordered `changedAt desc`, with
  **opaque cursor** (`startAfter` = last document id; response carries
  `hasMore` + `lastId`). Optional server-side filters `entityType`
  (`space|storyPoint|item`) and `entityId`. `tenantId` is derived
  **server-side** from auth claims in the rebuild — never sent from the request
  body for trust (see §8). Backend returns the lean projection
  (`id, version, entityType, entityId, changeType, changeSummary, changedBy, changedAt`)
  — the `ContentVersion` shape from
  `packages/shared-types/src/levelup/space.ts`.
- **Read (snapshot detail):** **NEW callable `v1.levelup.getVersionSnapshot`** —
  fetches the full point-in-time payload for one version id (the entity document
  as it was at that version), for the snapshot drawer / diff. The list endpoint
  intentionally omits the heavy snapshot body; this fetches it on demand.
  _Proposed addition to common-api — note below._
- **Read (author resolution):** `changedBy` is a uid; resolve to display
  name/avatar via the existing tenant member directory read (batched), or a
  **NEW** `v1.levelup.resolveUsers(uids[])` lookup if no batch read exists.
  _Proposed addition._
- **Write (restore / branch):** **NEW callable `v1.levelup.restoreVersion`**
  `{ spaceId, versionId, mode: 'restore' | 'branch' }` — `restore` re-applies
  the snapshot to the live entity via the normal `save*` path (producing a _new_
  forward version, never rewriting history); `branch` clones the snapshot into a
  new draft space. _Proposed addition to common-api._ Both flow through
  `saveSpace`/`saveStoryPoint`/`saveItem` so answer-key stripping and
  `validatePublish` invariants are preserved.

> **Proposed additions to FOUNDATION / common-api:** `getVersionSnapshot`,
> `restoreVersion`, and a user-batch resolver are not yet in the audited
> callable list. They are required for the snapshot-view + restore/branch scope
> of this screen and are flagged here rather than invented silently.

---

## 3. Layout — wireframe-as-text

Hosted inside **AppShell** (foundation §5: Sidebar + Topbar) → `SpaceEditorPage`
tab strip. The History body is a single-column **Timeline** capped at the
reading measure (~`720`, foundation §4) so each entry stays scannable; on `lg` a
snapshot opens in a right-docked **Drawer** rather than navigating away.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar (role nav)              Topbar (tenant switcher · search · profile)│
├──────────────────────────────────────────────────────────────────────────┤
│ Breadcrumb: Spaces / {Space name} / Edit                                   │
│ Tabs: Overview · Story Points · Items · Rubric · Settings · [History]      │
│                                                                            │
│ ┌─ Filter bar ─────────────────────────────────────────────────────────┐  │
│ │ Heading "Version history"   [Scope: All ▾] [Change type: All ▾]       │  │
│ │ {N changes}  · entity filter chip (clearable) when deep-linked        │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Timeline (vertical rail) ───────────────────────────────────────────┐  │
│ │  ● now ── current published version (brand.primary node)             │  │
│ │  │                                                                    │  │
│ │  ◐  v12 · Published        Maya R. · 2h ago        [View] [⋯]        │  │
│ │  │   "Published space to class"   · Space · status: Published         │  │
│ │  │                                                                    │  │
│ │  ○  v11 · Updated          Sam K. · yesterday      [View] [⋯]        │  │
│ │  │   "Edited 3 items in Arrays story point" · Item                    │  │
│ │  │                                                                    │  │
│ │  ○  v10 · Archived         Maya R. · Jun 14        [View] [⋯]        │  │
│ │  ⋮                                                                    │  │
│ │              [ Load older versions ]   (cursor pagination)            │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  (lg) Snapshot Drawer docks right ▸                                        │
│  ┌──────────────────────────────┐                                         │
│  │ v11 snapshot · Sam K.         │  DefinitionList: version / type /       │
│  │ ── DefinitionList ──          │  author / timestamp / change summary    │
│  │ ContentRenderer (md+math)     │  Snapshot body via ContentRenderer      │
│  │ [Restore this version]        │  [Branch to new draft]                  │
│  └──────────────────────────────┘                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Responsive (foundation §4 breakpoints):**

- **`sm` (<640):** single column, gutters `16`. Timeline rail hugs the left edge
  (node at `left-4`); each entry's `[View]`/`[⋯]` actions collapse into the row
  tap target (whole row opens the snapshot **Sheet**, full-height bottom).
  Filters become a single "Filter" button opening a Sheet. "Load older" is a
  full-width button.
- **`md` (768):** timeline single column at reading width; filters inline;
  snapshot opens a centered **Modal** (no room for a side drawer).
- **`lg` (1024+):** timeline column + right-docked snapshot **Drawer**
  (~`420px`) so the list stays visible while inspecting; gutters `32`.

---

## 4. Components used (from §5)

- **AppShell**, **Sidebar**, **Topbar**, **Breadcrumb**, **Tabs** — page chrome.
- **Timeline** (data, §5) — the spine of this screen; one node per
  `ContentVersion`, ordered `changedAt desc`, with the "now" node at top.
- **Pagination** (§5) — cursor variant: a "Load older versions" **Button**
  (ghost) driven by `hasMore` + `lastId`, _not_ numbered pages (the cursor is
  opaque, list grows downward). Infinite-scroll sentinel as a progressive
  enhancement.
- **DefinitionList** (§5) — the snapshot drawer's metadata: Version · Change
  type · Entity · Author · Timestamp · Summary.
- **EmptyState** (§5) — "No version history yet."
- **Skeleton** (§5) — 5 timeline-row skeletons during load (matches current
  code's `length: 5`).
- **Drawer/Sheet**, **Modal/Dialog** — snapshot viewer per breakpoint.
- **Badge** — `changeType` (`created` / `updated` / `published` / `archived`)
  and `entityType` (`space` / `storyPoint` / `item`); each pairs an icon +
  label + color (never color alone, §2).
- **Chip/Tag** — active entity-scope filter chip (clearable when deep-linked).
- **Select** — Scope filter (`All / Space / Story point / Item`) and Change-type
  filter (`All / Created / Updated / Published / Archived`).
- **Avatar** / **AvatarGroup** — `changedBy` author face next to each entry.
- **ContentRenderer** (domain, §5) — renders the snapshot body (Markdown +
  KaTeX) **identically** to authoring preview / student / grading; the single
  canonical renderer, no second path.
- **Button** (ghost "View", ghost "Load older"; secondary "Branch to new draft";
  primary "Restore this version"), **IconButton** (row "⋯" overflow),
  **Popover** (overflow menu: View snapshot · Restore · Branch · Copy version
  id).
- **ConfirmDialog** — restore (live re-apply) and branch confirmations.
- **Toast** (sonner) — restore/branch success + error.
- **InlineAlert/Banner** — partial-load and stale-data notices; restore warning.
- **LoadingOverlay** — drawer body while `getVersionSnapshot` resolves.
- **AnswerKeyLock** (domain, §5) — guard note in the snapshot drawer clarifying
  answer keys are restored securely and never shown here (see §8).

**No proposed new visual component** — this screen composes entirely from §5.
(The new work is API-side, §2.)

---

## 5. States

- **Loading:** render the **Timeline** rail with 5 **Skeleton** rows
  (`bg.surface-sunken` placeholders), matching `versionsLoading` in source.
  Filters render but are disabled until first page resolves.
- **Empty:** **EmptyState** with `History` icon — title "No version history yet"
  (Fraunces), body "Changes are tracked automatically when you publish, archive,
  or edit content." No CTA (history is a byproduct, not something you create).
- **Empty after filter:** if filters yield zero, show a distinct EmptyState "No
  changes match this filter" + a "Clear filters" ghost Button (so it's not
  confused with a truly empty space).
- **Partial:** first page loaded, `hasMore = true` → "Load older versions"
  Button visible. If a "Load older" call fails, keep already-loaded entries and
  show an **InlineAlert** "Couldn't load older versions — retry" with a retry
  Button (never blank the list).
- **Snapshot loading:** opening a version opens the Drawer/Sheet immediately
  with a **LoadingOverlay**/Skeleton while `getVersionSnapshot` resolves;
  metadata **DefinitionList** (already in the list payload) renders instantly,
  body fills in.
- **Snapshot error:** Drawer shows an InlineAlert "Couldn't load this
  snapshot" + retry; restore/branch buttons disabled until body loads.
- **Restore in flight:** ConfirmDialog → primary button enters loading; on
  success the new forward version appears at the top of the timeline (optimistic
  insert) + success **Toast**; on failure rollback + error Toast.
- **Stale list:** if a save happened in another tab while viewing, the next
  "now" mismatch surfaces a subtle InlineAlert "New changes since you opened
  this — refresh" (manual, non-destructive).
- **Permission-gated by role:**
  - `teacher` — view full history within their tenant; **restore** and
    **branch** allowed for spaces they author.
  - `tenantAdmin` — same, plus restore/branch across the tenant;
    `archived`-status snapshots remain inspectable.
  - **Read-only viewer** roles — timeline + snapshot view only;
    "Restore"/"Branch"/mutating actions are hidden (not just disabled), and the
    overflow menu shows only "View snapshot" + "Copy version id".

---

## 6. Interactions & motion (cite §4 motion)

- **Initial reveal:** timeline rows stagger in top-to-bottom with
  `ease.entrance` / `base 220ms`, ~24ms per-row offset (capped) so the list
  feels assembled, not dumped. Reduced motion → instant opacity only.
- **Open snapshot:** click row / "View" → Drawer slides in from right
  (`ease.entrance`, `base`) on `lg`; Modal scales/fades in (`fast 160ms`) on
  `md`; bottom Sheet rises (`base`) on `sm`. The selected timeline node gets a
  `border.focus` ring and stays highlighted while the drawer is open.
- **Load older (cursor pagination):** "Load older versions" → Button enters
  loading (`instant`), new rows append below with the same staggered
  `fast 160ms` entrance; the cursor (`lastId`) advances. No layout jump — the
  rail extends downward, scroll position preserved.
- **Filter change:** changing Scope/Change-type Select resets the cursor and
  refetches page 1; the list cross-fades (`fast`) rather than hard-swapping.
  Active filter shows a clearable **Chip**.
- **Restore:** "Restore this version" → **ConfirmDialog** ("Restore v11? This
  creates a new version that re-applies this snapshot. Current content is
  preserved in history."). Confirm → optimistic new top node inserted with a
  brief `border.focus` pulse, success **Toast** ("Restored to v11 as v13.").
  This is the one place a small motion accent lives — a single subtle node
  pulse, **not** a gamification spark/burst (§4 reserves the celebratory pop for
  XP/streak only).
- **Branch:** "Branch to new draft" → ConfirmDialog → on success Toast with a
  "Open draft" action linking the new space; no timeline mutation on the current
  space.
- **Copy version id:** overflow → "Copy version id" → micro Toast "Version id
  copied."
- **Reduced motion:** all entrances degrade to opacity-only; no slide, no pulse
  (§4).

---

## 7. Content & copy

- **Tab / heading:** "Version history" (Fraunces, text-xl). Subhead (Schibsted,
  text-sm, `text.secondary`): "Every publish, archive, and edit, newest first."
- **Filters:** "Scope: All / Space / Story point / Item" · "Change type: All /
  Created / Updated / Published / Archived". Count: "{N} changes".
- **Timeline row:** `changeSummary` as the primary line (Schibsted, text-sm,
  `text.primary`). Meta line (text-xs, `text.secondary`):
  `{changeType} · {entityType} · {author} · {relative time}`. The `version`
  number renders in **Spline Sans Mono** (e.g. `v12`) per §3 (numerics).
  Absolute timestamp on hover/long-press via **Tooltip**.
- **"Now" node:** label "Current" (the live published/draft head),
  `brand.primary` node.
- **changeType copy (Badge label, sentence case):** Created · Updated ·
  Published · Archived.
- **Snapshot drawer:** title "v{n} snapshot · {author}". DefinitionList terms:
  "Version", "Change type", "Entity", "Changed by", "Changed at", "Summary".
- **Empty:** "No version history yet." / "Changes are tracked automatically when
  you publish, archive, or edit content."
- **Filtered-empty:** "No changes match this filter." + "Clear filters".
- **Confirm copy:** Restore — "Restore v{n}? This re-applies the snapshot as a
  new version. Your current content stays safe in history." Branch — "Create a
  new draft space from v{n}? The current space is left unchanged."
- **Success Toasts:** "Restored to v{n} as v{m}." · "Branched v{n} into a new
  draft." · "Version id copied."
- **Error copy:** "Couldn't load version history — retry." · "Couldn't load
  older versions — retry." · "Couldn't load this snapshot." · "Couldn't restore
  — your content was not changed. Retry."
- **Tone:** factual, reassuring on the destructive-sounding actions ("stays safe
  in history"), second-person, no exclamation marks, no playful copy.

---

## 8. Domain rules surfaced

- **History is append-only & trigger-produced:** entries are written by the
  `save*` callables / triggers, not by the UI. The screen is read-only over
  `versions`; even **restore** writes a _new forward_ version rather than
  mutating or deleting past entries — the log is immutable. This mirrors "Stats
  are authoritative (trigger-maintained); no client recompute."
- **Tenant isolation:** `tenantId` is derived **server-side from auth claims**,
  not from the request body (rebuild invariant). `listVersions` enforces
  `assertTeacherOrAdmin(uid, tenantId)` and rate-limits reads — the UI must
  never construct cross-tenant paths.
- **Opaque cursor pagination:** the client treats `lastId` as opaque, passes it
  back as `startAfter`, and trusts `hasMore`. It must **not** compute offsets,
  recount, or assume stable numbering (concurrent saves can insert at the head).
- **Entity scope filter maps to backend `entityType`/`entityId`:** the Scope
  Select and any deep-link `entityId` chip pass straight through to
  `listVersions` — server filters, client does not post-filter a partial page
  (which would mis-paginate).
- **changeType ↔ status semantics:** `published` / `archived` entries reflect
  `Space.status` lifecycle transitions (`ALLOWED_TRANSITIONS`: draft→published,
  published→{archived,draft}, archived→draft). The Badge for a `published` entry
  is the historical fact that a publish happened then — it is **not** a live
  status control (publishing is done on the Settings/Overview tab, gated by
  `validatePublish`).
- **Answer-key isolation on restore:** snapshot bodies are fetched via
  `getVersionSnapshot` and re-applied through `saveItem`, which **strips answer
  keys into the server-only `answerKeys` subcollection**. The History snapshot
  view therefore must **never** render a timed-test answer key to the client; if
  a restored item carried keys, they are re-stripped server-side, and the
  snapshot drawer shows an **AnswerKeyLock** note "Answer keys are restored
  securely and not shown here" (foundation §8: answer-key never shown to
  students; also never leaked into an audit view).
- **Canonical content rendering:** the snapshot body uses the **single**
  `ContentRenderer` (Markdown + KaTeX) — same renderer as
  authoring/student/grading. No dual renderer, no raw-markdown dump.
- **Author resolution is display-only:** `changedBy` (uid) is resolved to a
  name/avatar for humans; the raw uid is still copyable for audit but is never
  the primary display.

---

## 9. Accessibility (WCAG AA)

- **Timeline as a list:** the rail is a semantic `<ol>` (or `role="list"` with
  `listitem`s) in reverse-chronological order; the visual connector line is
  decorative (`aria-hidden`). Each row is a single focusable element exposing
  "Version {n}, {changeType}, {entityType}, by {author}, {absolute timestamp},
  {summary}" to screen readers (relative time is decorative; absolute time is
  the accessible name).
- **Focus order:** Tabs → filters (Scope, Change type, clear-chip) → timeline
  rows top-to-bottom → "Load older versions" → (when open) snapshot drawer
  (close → metadata → snapshot body → Branch → Restore). Logical and linear.
- **Keyboard:** rows reachable by `Tab`; `Enter`/`Space` opens the snapshot.
  Within the snapshot Drawer/Modal, focus is trapped, `Esc` closes and returns
  focus to the originating row. The overflow "⋯" menu is a keyboard-navigable
  menu (arrow keys, `Esc`).
- **Newly appended rows:** "Load older" appends rows into the list and moves
  focus to the first newly loaded row (or announces "{k} older versions loaded"
  via `aria-live="polite"`), so keyboard users aren't stranded.
- **Status never color-alone (§2):** every `changeType`/`entityType` Badge pairs
  an icon + text label + color (e.g. Published = check-into-circle icon +
  "Published" + `status.success`; Archived = box icon + "Archived" +
  `text.muted`). The "Current"/now node carries the text "Current", not just the
  `brand.primary` dot.
- **Contrast:** all text/background pairs meet WCAG AA (§2) — `text.secondary`
  meta on `bg.surface`, Badge fills chosen for ≥4.5:1 body / ≥3:1 UI.
- **Reduced motion:** honor `prefers-reduced-motion` — disable row stagger,
  drawer slide, and the restore node pulse; fall back to instant opacity (§4).
- **Touch targets:** rows, "View", "⋯", and "Load older" are ≥44px (§4); on
  mobile the whole row is the tap target.
- **Errors:** retry InlineAlerts are `role="alert"`; the snapshot-error alert
  receives focus when the body fails to load.

---

## 10. Web ↔ mobile divergence

- Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
  (mobile) (§6); only the renderer differs.
- **Snapshot surface:** `lg` right-docked **Drawer** (web, list stays visible) →
  `md` centered **Modal** → `sm`/mobile full-height bottom **Sheet**.
- **Filters:** inline **Select**s on web → a single "Filter" button opening a
  Sheet on mobile.
- **Pagination:** "Load older versions" Button on both; mobile adds pull-to-load
  / infinite-scroll sentinel as the primary gesture, button as fallback.
- **Row actions:** web shows hover-revealed "View" + "⋯"; mobile uses
  tap-to-open + a long-press context menu (hover → press, §6).
- **No ⌘K / CommandPalette** on mobile (§6) — "Copy version id" lives in the row
  overflow menu only.
- **Restore/Branch ConfirmDialog** → bottom-sheet confirm on mobile, centered
  ConfirmDialog on web.
- **Timeline density:** web shows author **Avatar** + relative + absolute
  (tooltip); mobile drops the hover tooltip and shows relative time only
  (absolute revealed in the snapshot Sheet).

---

## 11. Claude-design prompt

```
Design the "Content Version History" screen (the History tab of the space editor) for the
Auto-LevelUp teacher web app, conforming EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, or components —
compose only from its tokens and §5 inventory. No Inter/Roboto, no SaaS blue #3B82F6,
no glass morphism.

CONTEXT: Staff (teacher / tenantAdmin) review an append-only, time-ordered audit log of a
space's ContentVersion entries (who changed what, when, change type, status at the time),
inspect a past snapshot, and optionally restore or branch from it. Read-heavy, forensic,
git-log-like. Precise, calm, factual tone — NO gamification spark. The only accent energy
is the brand.primary "Current" node and a single subtle restore-success Toast.

LAYOUT (inside AppShell: Sidebar + Topbar + Breadcrumb + Tabs, History tab active):
- Filter bar: "Version history" heading (Fraunces, text-xl) + subhead "Every publish,
  archive, and edit, newest first."; Scope Select (All/Space/Story point/Item),
  Change-type Select (All/Created/Updated/Published/Archived), and an {N} changes count.
- A vertical Timeline (semantic ordered list, newest first): top node = "Current"
  (brand.primary). Each row: changeSummary (primary line), a meta line with changeType
  Badge + entityType Badge + author Avatar + relative time, and "View" / "⋯" actions.
  Version numbers render in Spline Sans Mono (e.g. v12). Below the list a ghost
  "Load older versions" Button (opaque-cursor pagination — NOT numbered pages).
- Snapshot viewer: on lg a right-docked Drawer (~420px) keeping the list visible; on md a
  centered Modal; on sm a full-height bottom Sheet. It shows a DefinitionList
  (Version / Change type / Entity / Changed by / Changed at / Summary), the snapshot body
  rendered by the single shared ContentRenderer (Markdown + KaTeX), an AnswerKeyLock note
  ("Answer keys are restored securely and not shown here"), a secondary "Branch to new
  draft" Button, and a primary "Restore this version" Button.

TOKENS: bg.canvas / bg.surface; Fraunces for the heading + EmptyState title, Schibsted
Grotesk for body/labels/meta, Spline Sans Mono for version numbers and ids. Cards/drawer
radius lg, inputs/buttons md, badges pill; elevation e1 timeline rows at rest, e2/e3 for
the snapshot Drawer/Modal. brand.primary for the "Current" node + Restore button. NO
marigold spark on this screen. Motion: timeline rows stagger in ease.entrance/base 220ms,
appended rows fast 160ms, drawer slide ease.entrance/base, restore = a single subtle node
pulse (NOT a celebratory burst). Respect prefers-reduced-motion (opacity-only).

STATES to show: loading (5 Skeleton timeline rows), empty ("No version history yet"),
filtered-empty ("No changes match this filter" + Clear filters), partial (list + "Load
older" + a retry InlineAlert if a page fails), snapshot loading (LoadingOverlay in the
drawer with metadata already shown), restore ConfirmDialog + success Toast, and a
read-only viewer variant where Restore/Branch are HIDDEN (not just disabled).

DOMAIN RULES to honor visually: history is append-only (restore creates a NEW forward
version, never rewrites the log); pagination cursor is opaque (no offsets/numbered pages);
every changeType/entityType cue is icon + label + color (never color alone); snapshot
bodies NEVER render timed-test answer keys (AnswerKeyLock note); tenantId is server-
derived. Make the timeline a real WCAG-AA ordered list with full SR row labels, keyboard
open/close with focus return, and aria-live announcements for appended pages. Deliver
responsive sm (bottom Sheet) / md (Modal) / lg (right Drawer).
```
