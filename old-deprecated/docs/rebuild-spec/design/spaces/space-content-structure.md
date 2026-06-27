# Space Editor — Content Structure (Story Point Track)

> The structural heart of authoring: an ordered, drag-reorderable track of story
> points, each expandable into its sections and items, with atomic reorder/move,
> inline add/edit/delete, bulk operations, and entry into the item editor — all
> conforming to the Lyceum foundation (`00-FOUNDATION.md`).

---

## 1. Purpose & primary user

**Primary user:** Teacher / content author (role `teacher`), secondarily
`tenantAdmin` doing the same authoring job. Not a student-facing screen.

**Job-to-be-done:** _"Lay out and rearrange my space's learning path — the spine
of story points and the items inside each — quickly and confidently, without
fear of breaking ordering, losing answer keys, or corrupting identity when I
move things around."_

This is the **Content tab** of the Space Editor. It is spatial and structural:
the author thinks in terms of sequence ("this comes before that"), grouping
("these items belong to the Warm-up section"), and composition ("this story
point is a timed test, that one is reading material"). Authoring the _contents_
of a single item happens in the Item Editor sheet (separate spec); authoring the
_configuration_ of a single story point happens in the Story Point Editor sheet
(separate spec). This screen owns the **track**.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/edit`, Content tab (`?tab=content` or in-page
`Tabs` state). Reached from the Spaces list (`SpaceCard` → "Edit"), from
breadcrumb `Spaces / {space.title}`, or from the Settings tab via the tab strip.

**common-API reads (typed read endpoints — never raw Firestore in the
rebuild):**

- `v1.levelup.getSpace` — header (title, type, status, accessType) + breadcrumb.
- `v1.levelup.listStoryPoints` — the ordered track (`orderBy orderIndex`).
  Returns server-authoritative `stats` (totalItems/Questions/Materials/Points) —
  **do not recompute client-side**. The live-count fallback in today's code
  (`getCountFromServer` against nested/flat paths) is **retired**; the rebuild
  trusts trigger-maintained `stats`.
- `v1.levelup.listItems` — items for an expanded story point, scoped to the
  canonical nested path
  `tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}/items`,
  `orderBy orderIndex`. The legacy flat-path fallback is **dropped** — rebuild
  targets nested only.

**common-API writes (versioned callables):**

- `v1.levelup.saveStoryPoint` — create / inline-rename a story point (also
  powers the Story Point Editor sheet).
- `v1.levelup.saveItem` — create a stub item before opening the Item Editor;
  inline edits route through the sheet.
- `v1.levelup.reorderItems` **(NEW)** — atomic, identity-preserving reorder of
  items within one story point. **Replaces** the client `writeBatch` loop in
  today's `handleItemDragEnd`.
- `v1.levelup.moveItems` **(NEW)** — atomic, identity-preserving move of one or
  more items to another story point. **Replaces** the delete-then-recreate loop
  in today's bulk "Move to…" Select (which destroys item identity, history, and
  stripped answer keys).
- Story-point reorder is **also `reorderItems`-class** behavior — propose it
  goes through a sibling atomic callable `v1.levelup.reorderStoryPoints` (see §4
  proposed addition); it must not be a client `writeBatch`.

`tenantId` is derived server-side from auth claims; the UI never sends it in the
request body.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (`Sidebar` + `Topbar`); this screen is the main
content region. Content max-width 1200 (`§4`), page gutters 16/24/32 at
mobile/tablet/desktop.

```
┌ AppShell main region ───────────────────────────────────────────────┐
│ Breadcrumb:  Spaces / Algebra I — Foundations                        │
│                                                                       │
│ ┌ Header row ───────────────────────────────────────────────────┐   │
│ │ [←]  Algebra I — Foundations            [Preview] [Publish ▸]  │   │  ← title Fraunces xl
│ │      [StatusBadge: Draft] · learning                            │   │  ← StatusBadge + type
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ Tabs:  [ Settings ] [ Content ◂ ] [ Rubric ] [ Agents ] [ History ]  │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                       │
│ ┌ Content tab body ─────────────────────────────────────────────┐   │
│ │ Story Points (5)                  [+ Add as type… ▾]  [+ Add]  │   │  ← section head (UI lg)
│ │                                                                 │   │
│ │ ┌ StoryPointNode (collapsed) ─────────────────────────────┐   │   │
│ │ │ ⠿  ▸  1. Linear Equations   standard   12 items · 8 Q ·  │   │   │  ← grip, chevron, badges
│ │ │       4 M · 40 pts · medium        [⚙] [🗑]              │   │   │
│ │ └─────────────────────────────────────────────────────────┘   │   │
│ │ ┌ StoryPointNode (EXPANDED) ──────────────────────────────┐   │   │
│ │ │ ⠿  ▾  2. Quadratics   timed_test  10 items  [👁][+Section]│  │   │  ← 👁 preview (test types)
│ │ │       [⚙] [🗑]                                            │   │   │
│ │ │  ┌ section group ───────────────────────────────────┐    │   │   │
│ │ │  │ WARM-UP · 3 items        [+ Question] [+ Material]│    │   │   │  ← section header
│ │ │  │  ☐ ⠿ ▸ ❓ Solve x²−4=0   mcq        [✎][🗑]      │    │   │   │  ← SortableItem row
│ │ │  │  ☐ ⠿ ▸ 📄 Factoring recap  text     [✎][🗑]      │    │   │   │
│ │ │  └──────────────────────────────────────────────────┘    │   │   │
│ │ │  ┌ UNSECTIONED · 7 items   [+ Question] [+ Material]┐    │   │   │
│ │ │  │  …rows…                                           │    │   │   │
│ │ │  └──────────────────────────────────────────────────┘    │   │   │
│ │ │  ┌ Bulk bar (when ≥1 selected) ─────────────────────┐    │   │   │
│ │ │  │ 3 selected  [🗑 Delete] [Move to… ▾]  [Clear]     │    │   │   │  ← sticky within node
│ │ │  └──────────────────────────────────────────────────┘    │   │   │
│ │ │  [⌁ Import from Bank]                                     │   │   │
│ │ └─────────────────────────────────────────────────────────┘   │   │
│ │ …more StoryPointNodes…                                          │   │
│ └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘

Right-edge overlays (Drawer/Sheet, §5):
 • Item Editor Sheet      (max-w-2xl)  — opens on add/edit item
 • Story Point Editor Sheet (max-w-xl) — opens on ⚙
 • Question Bank Import Dialog (Modal)  — opens on Import from Bank
```

**Responsive (`§4` breakpoints):**

- **lg (≥1024):** as drawn. Track at full reading width; badges inline on one
  row; Sheets slide from right at their max-w, leaving the track visible behind
  a scrim.
- **md (768–1023):** header actions may wrap to a second row; story-point stat
  badges collapse to `12 items · medium` (drop per-type counts behind a tooltip
  on the count). Sheets widen to ~90vw.
- **sm (<768):** Sheets become full-screen (`w-full`). Stat badges become a
  single count chip. The `+ Add as type…` Select collapses into the `+ Add`
  button's split-menu. Grip handles enlarge to ≥44px touch targets; drag becomes
  **press-and-hold** (see §10). Bulk bar pins to bottom of viewport as a
  `Drawer`-style action bar.

The track itself is a single-column vertical list at all sizes
(`StoryPointTrack`) — it never becomes multi-column; sequence must stay legible
as a spine.

---

## 4. Components used (from FOUNDATION §5 only)

**Domain components:**

- `StoryPointTrack` — the ordered vertical list container (the learning path);
  hosts the story-point `DndContext`.
- `StoryPointNode` — each row in the track. In the authoring context it renders
  the collapsed/expanded structural affordances (grip, chevron, type label, stat
  badges, ⚙/🗑/👁). Note: `StoryPointNode`'s student-facing **mastery states**
  (`mastery.notStarted/inProgress/mastered`, §2.3) are not used here — authoring
  shows _structure_, not learner progress. Document this as an authoring variant
  of the same component.
- `ContentRenderer` — renders the inline item preview (the expand-a-row preview)
  from canonical Markdown+KaTeX. The legacy `ItemPreview`/`RichTextViewer`
  (TipTap-HTML) is **retired**; one renderer only.
- `AnswerKeyLock` — server-only guard visual; shown on item rows / preview for
  `timed_test` items where the answer key is stripped server-side (see §8).

**Containers / navigation:** `AppShell`, `Breadcrumb`, `Tabs`
(Settings/Content/Rubric/Agents/History), `Drawer/Sheet` (Item + Story Point
editors), `Modal/Dialog` (Bank import, student preview), `Section`,
`Accordion`-style expand (the row expand uses grid-rows transition, an Accordion
behavior).

**Primitives / data / feedback:** `Button` (variants: primary for _Add_,
`secondary`/ghost for row actions, `danger` for delete, `spark` reserved for the
hero _Publish_ CTA only — see §8), `IconButton` (grip, chevron, ⚙, ✎, 🗑, 👁),
`Select` (Add-as-type, bulk Move-to), `Checkbox` (item multi-select),
`Badge`/`Chip` (story-point type, stat counts — pill radius), `Skeleton`
(loading), `EmptyState` (no story points / empty section), `Toast` (sonner —
success/error), `ConfirmDialog` (destructive ops), `InlineAlert/Banner`
(stripped-key / answer-key warnings), `Tooltip` (collapsed badge details, action
labels).

**Proposed additions to FOUNDATION:**

1. **`reorderStoryPoints` callable** is an API concern, but the **drag-handle +
   drop-indicator** visual for a reorderable list is a reusable pattern not
   named in §5. Propose adding a `SortableList` / `DragHandle` primitive
   (anatomy: grip `IconButton`, drop-indicator line at `border.focus`,
   lifted-item elevation `e2`) to §5 so both this track and item lists share one
   spec. Until added, compose from `IconButton` + a `border.focus` rule line.
2. **`SplitButton`** (primary action + attached dropdown of variants) for the
   `+ Add ▾` story-point control. Today it's a `Select` beside a `Button`; a
   `SplitButton` is cleaner. Flag as a proposed §5 primitive rather than
   inventing inline.

No new colors, fonts, spacing, radii, or shadows are introduced.

---

## 5. States

**Loading (skeleton):** Header `Skeleton` (avatar-square + two text lines), a
tab-strip skeleton, and 3–4 `Skeleton` rows at `StoryPointNode` height in the
track. Matches today's top-level skeleton; extend it to the track. Per-row item
lists show 2 inset skeleton rows when an expanded node is fetching items.

**Empty:**

- _No story points:_ `EmptyState` inside a dashed `border.subtle` panel — `List`
  glyph, title "No story points yet" (Fraunces), body "Build your learning path
  by adding the first story point.", primary `Button` "Add Story Point".
- _Empty section:_ muted italic line "No items in this section yet." with the
  section's `+ Question` / `+ Material` buttons still present.
- _Story point with zero items, expanded:_ the "Items" group renders with only
  its add buttons.

**Error:** Failed `listStoryPoints` → `InlineAlert` (status.error) above the
track: "Couldn't load this space's content. Retry." with a Retry `Button`.
Failed item load on expand → inline error row within the node, not a page-level
error. All write failures → `Toast` (status.error) + **optimistic rollback**
(see §6). Space-not-found → centered `EmptyState` "Space not found" + link back
to Spaces.

**Partial:** Track loaded but an expanded node's items still streaming → node
shows its stat badge from `stats` while item rows skeleton in. Reorder in flight
→ moved row holds optimistic position with a subtle `instant` opacity dip until
the callable confirms.

**Success:** Track renders; reorder/move/add/delete confirmed by `Toast` and
stable final order.

**Permission-gated variations:**

- `teacher` / `tenantAdmin`: full edit — all drag, add, delete, move, publish
  controls.
- A teacher viewing a space they don't own within the tenant (if tenant policy
  restricts): track is **read-only** — grips, add/delete/move hidden, rows
  expand for preview only; a `Banner` notes "You have view-only access to this
  space."
- `student` / `consumer`: **never reach this route.** The student consumes the
  published space via the learner `StoryPointTrack` (mastery states), where
  structural edit affordances and answer keys do not exist. Tenant isolation
  (§8) prevents cross-tenant access entirely.

---

## 6. Interactions & motion

All motion cites §4 tokens; honor `prefers-reduced-motion` (reduce to
opacity-only, no transform).

**Reorder story points (drag):** Grip → lift (`e2` elevation, `fast` 160ms
`ease.standard`); a drop-indicator line (`border.focus`) shows insertion point;
on drop, list settles `base` 220ms. **Optimistic:** local order updates
immediately; `reorderStoryPoints` fires; on failure, snap back to previous order
(`fast`) + `Toast` "Couldn't reorder story points." Keyboard: focus grip,
`Space` to pick up, arrows to move, `Space` to drop (dnd-kit keyboard sensor).

**Reorder items within a story point (drag):** Identical pattern, scoped to the
node's `DndContext`; calls `reorderItems`. Items can be dragged across section
group boundaries within the same story point — dropping into a different section
group reassigns `sectionId` as part of the same atomic `reorderItems` (with
`sectionId` deltas), never a delete+recreate.

**Move items across story points (bulk):** Select rows via `Checkbox` → bulk bar
appears (`fast` slide-in). "Move to…" `Select` lists sibling story points →
choosing one calls **`moveItems`** (atomic, identity-preserving). Optimistic:
selected rows fade out of source (`fast`), reappear in target on its next
expand. `Toast` "Moved 3 items to Quadratics." **This replaces the destructive
delete+recreate loop** in current code.

**Add story point:** `+ Add` (primary) appends a `standard` story point;
`+ Add as type…` Select appends with a chosen type. New node animates in
(`entrance` ease, `base`), scrolls into view, and enters inline title-edit.
`Toast` "Story point added."

**Add item:** `+ Question` / `+ Material` (per section or unsectioned) calls
`saveItem` to create a stub at the correct `orderIndex`/`sectionId`, then
**opens the Item Editor Sheet** (`Drawer/Sheet` slides from right, `slow` 320ms
`ease.entrance`) focused on the new item. Closing the sheet returns focus to the
originating add button.

**Inline edit / open editor:** Row title or ✎ opens the Item Editor Sheet; ⚙
opens the Story Point Editor Sheet. Row chevron toggles an inline
`ContentRenderer` preview (grid-rows expand, `base` 220ms `ease.standard`).

**Delete:** 🗑 (single) or bulk Delete → `ConfirmDialog` ("This can't be
undone."). Confirmed delete is optimistic (row collapses, `fast`) with
rollback + `Toast` on failure. No silent deletes.

**Confirmations:** required for delete (single/bulk), story-point delete (warns
it deletes contained items), and archive/unpublish in the header. Reorder and
move are **not** gated by a dialog (cheap, reversible) — they rely on
optimistic + toast + undo-on-error.

**The one celebratory moment** (§4) belongs to gamification, not authoring —
there are **no** spring pops or marigold bursts on this screen. Publish success
is a calm `status.success` toast, not a celebration.

---

## 7. Content & copy

Tone: **precise for staff** — terse, action-led, never cute.

- Section head: `Story Points ({n})`. Add controls: `+ Add as type…`
  (placeholder), `+ Add`.
- Add-as-type options: `Standard`, `Practice`, `Quiz`, `Timed Test`. **Drop the
  legacy `Test`** option (rebuild collapses `test`→`timed_test`; see §8).
- Story-point row: `{orderIndex+1}. {title}` · type label (lowercase) · stat
  badges `{n} items`, `{q} Q`, `{m} M`, `{p} pts`, `{difficulty}`. Section
  header: `{TITLE} · {n} items` with `+ Question` / `+ Material`.
- Item row: `{title || "Untitled"}` + muted `{questionType | materialType}`
  label (hyphens/underscores → spaces).
- Bulk bar: `{n} selected`, `Delete`, `Move to…`, `Clear`.
- Import button: `Import from Bank`.
- **Empty states:** "No story points yet" / "Build your learning path by adding
  the first story point." · "No items in this section yet."
- **Confirm copy:** Delete item — "Delete "{title}"? This action cannot be
  undone." · Delete story point — "Delete "{title}"? This will also delete all
  items within it." · Bulk — "Delete {n} item(s)? This action cannot be undone."
  · Archive — "Archive this space? Students will no longer be able to access
  it."
- **Error copy (toasts):** "Couldn't reorder story points." · "Couldn't reorder
  items." · "Couldn't move items." · "Couldn't add item." · "Couldn't delete." ·
  Load: "Couldn't load this space's content."
- **Success copy:** "Story point added." · "Item saved." · "Moved {n} items to
  {title}." · "Deleted {n} items." · "Space published."

Numerals (item counts, points, orderIndex) render in `Spline Sans Mono` (§3) for
tabular alignment.

---

## 8. Domain rules surfaced

- **Answer-key security (critical):** For `timed_test` story points, correct
  answers are stripped server-side into the server-only `answerKeys`
  subcollection that `firestore.rules` denies to all clients. On this screen:
  - The inline preview (`ContentRenderer`) and item rows for timed-test
    questions **must not display correct answers** — show `AnswerKeyLock`
    ("Answer key stored securely — open the editor to view/edit").
  - Opening the Item Editor re-merges keys via `getItemForEdit`; on save the UI
    must guard `answerKeyLooksStripped` and never overwrite a stripped key with
    empty (warn via `InlineAlert`). Reorder/move **must preserve** the stripped
    key linkage — another reason these are atomic `reorderItems`/`moveItems`,
    not delete+recreate (delete+recreate would orphan or destroy the answer
    key).
- **Identity-preserving structure ops:** `reorderItems` / `moveItems` keep
  `itemId` stable so attempts, version history, and answer keys remain bound.
  The legacy delete+recreate move is a domain bug — call it out and forbid it.
- **Hierarchy & path:** Space → StoryPoint → UnifiedItem at
  `tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}/items/{itemId}`.
  Sections are an ordering grouping _within_ a story point (`sectionId` on
  items), not a separate collection.
- **Story-point types:** `standard | practice | quiz | timed_test`. The `test`
  type is **dropped** in the rebuild — do not offer it. Test/quiz/timed_test
  types reveal assessment config (in the SP editor) and the
  `👁 Preview as student` action; standard/practice do not.
- **Status transitions:** ALLOWED_TRANSITIONS draft→published (gated by
  `validatePublish`), published→{archived,draft}, archived→draft. The header
  Publish/Unpublish/Archive/Restore buttons reflect exactly the legal transition
  for the current status; Publish is the `spark`/primary hero CTA (the one place
  spark glow `§4` is permitted on this screen).
- **Stats are server-authoritative:** stat badges read `stats` maintained by
  triggers (`saveItem`/`moveItems`/delete). The UI must not recompute counts
  client-side.
- **Rubric inheritance:** items inherit rubric tenant → space → storyPoint →
  item; this screen surfaces it only indirectly (the Rubric tab / Item editor),
  but reorder/move never alter inheritance.
- **Tenant isolation:** `tenantId` from auth claims server-side; a user can only
  see/edit story points and items within their tenant. Cross-tenant access is
  impossible by rules.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Breadcrumb → back → header actions → tab strip → Add controls
  → each `StoryPointNode` (grip → expand toggle → ⚙ → 🗑 → 👁) → within expanded
  node, section groups in order (add buttons → item rows: checkbox → grip →
  expand → edit → delete) → bulk bar → Import. Opening a Sheet traps focus
  inside it; closing restores focus to the trigger.
- **Keyboard:** Full dnd-kit keyboard reorder (grip focus → `Space` lift →
  arrows → `Space` drop, `Esc` cancel) for both tracks and item lists.
  `Ctrl/Cmd+N` adds a story point when no editor is open. `Esc` closes the
  active Sheet. Every `IconButton` is tabbable with an `aria-label` ("Drag to
  reorder", "Edit", "Delete", "Toggle details", "Preview as student").
- **ARIA:** expand toggles set `aria-expanded`; reorderable lists use dnd-kit's
  announcements (`aria-live` "Picked up item…/Moved to position N…/Dropped");
  bulk bar count is `aria-live="polite"`; checkboxes have labels "Select
  {title}".
- **Status never by color alone (§2):** story-point type and difficulty are text
  labels, not just color; `AnswerKeyLock` pairs a lock icon + text;
  confirm/destructive actions use icon + label + the `danger` button shape, not
  red alone.
- **Contrast:** all text/UI pairs meet AA (4.5:1 body, 3:1 large/UI) per §2;
  muted stat text uses `text.secondary`, never below threshold on `bg.surface`.
- **Reduced motion:** `prefers-reduced-motion` removes drag transforms and
  expand slides — falls back to instant show/hide and opacity-only feedback.
  Drop indicator (a `border.focus` line) still conveys position without motion.
- **Touch targets:** ≥44px on sm (§4) for grips, chevrons, and row actions.

---

## 10. Web ↔ mobile divergence

The track exists on both `shared-ui` (web) and `ui-native` (mobile);
`StoryPointTrack` / `StoryPointNode` names and props match 1:1 (§6).

- **Reorder:** Web uses `@dnd-kit` (pointer + keyboard sensors). Mobile (RN)
  uses **press-and-hold to lift** + drag
  (Reanimated/`react-native-reorderable`); no keyboard reorder. Both call the
  same `reorderItems` / `reorderStoryPoints` / `moveItems`.
- **Hover → press:** web hover affordances (action buttons revealing on row
  hover) become always-visible compact icons on mobile (no hover state).
  Tooltips become long-press popovers or are omitted.
- **Editors:** web Item/Story-Point editors are right-side `Sheet`s; on mobile
  they are full-screen `Drawer/Sheet`s pushed from the bottom. Bank import
  `Dialog` → full-screen modal on mobile.
- **Bulk move:** web uses a `Select`; mobile uses a bottom-sheet picker of
  target story points.
- **⌘K / shortcuts:** `CommandPalette` and `Ctrl/Cmd+N` are **web-only**; absent
  on mobile (no command palette per §5/§6). Mobile relies on the `+ Add`
  button + Tabbar.
- **Density:** web shows full inline stat badges; mobile collapses to a single
  count chip with details on tap. Sections render as stacked card groups rather
  than bordered inline groups.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp web app (teacher portal), in React +
Tailwind, strictly conforming to our design system at
docs/rebuild-spec/design/00-FOUNDATION.md ("Lyceum"). Read FOUNDATION first and use ONLY
its tokens and components — do not invent colors, fonts, spacing, radii, shadows, or
component names. Cite tokens by semantic name (brand.primary, spark, status.error,
border.focus, text.secondary, e1/e2/e3, motion fast/base/slow). Fonts: Fraunces (display/
headings), Schibsted Grotesk (UI/body/labels/buttons), Spline Sans Mono (counts/numerics).

SCREEN: Space Editor — Content tab — "Story Point Track" (structural authoring).
Route /spaces/:spaceId/edit, Content tab. Primary user: teacher/content author.

Render inside AppShell (Sidebar + Topbar). Above the body: Breadcrumb (Spaces / {title}),
a header row (back IconButton, space title in Fraunces xl, StatusBadge + type label,
right-aligned [Preview] secondary button and a status-aware hero CTA — Publish uses the
spark/primary treatment, the ONLY spark glow allowed here), then a Tabs strip
(Settings / Content[active] / Rubric / Agents / History).

Content body = "Story Points ({n})" section head with a SplitButton "+ Add ▾" (variants:
Standard, Practice, Quiz, Timed Test — NO "Test"). Below: a vertical StoryPointTrack of
StoryPointNode rows. Each row: drag grip (IconButton), expand chevron (aria-expanded),
"{n}. {title}", lowercase type label, stat badges ({n} items / {q} Q / {m} M / {p} pts /
difficulty) in Spline Sans Mono, and right-aligned actions: 👁 Preview (only for quiz/
timed_test), ⚙ settings, 🗑 delete. Expanded: items grouped by section — each group has a
header "{TITLE} · {n} items" with "+ Question"/"+ Material" buttons, then SortableItem
rows: checkbox, grip, expand chevron, type icon, title + muted type label, ✎ edit, 🗑
delete. When ≥1 item selected, show a bulk bar ("{n} selected", Delete (danger), "Move
to…" Select, Clear). A dashed "Import from Bank" button per node.

Behaviors to depict: dnd-kit reorder of story points and of items (drop indicator =
border.focus line, lifted row = e2, settle = base 220ms ease.standard); optimistic
updates with rollback toast; ConfirmDialog for deletes; Item Editor and Story Point
Editor as right-side Sheets; Bank import as Dialog.

Domain rules to honor visually: for timed_test items, NEVER show correct answers — show an
AnswerKeyLock ("Answer key stored securely"). Stat counts are server-authoritative (read,
don't compute). Status never by color alone (icon + label + shape).

States to include: skeleton loading (track rows), empty state ("No story points yet" /
"Build your learning path by adding the first story point.", primary Add button),
error InlineAlert with Retry, and the populated success state.

Accessibility: full keyboard reorder, focus trap in Sheets, aria-live drag announcements,
WCAG AA contrast, prefers-reduced-motion fallback (opacity-only). Touch targets ≥44px.

Output: a single responsive React component (lg/md/sm per FOUNDATION breakpoints) composed
only from FOUNDATION §5 components, with realistic copy from this spec. No new design tokens.
```
