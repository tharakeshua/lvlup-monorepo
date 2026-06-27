# Story Point Editor

> The create/edit surface for a single **StoryPoint** — title, type, difficulty,
> time estimate, named sections, rubric override, ordering, and (for assessment
> types) a link into Assessment Config. Lives inside the Space Editor Content
> tab as a focused panel.

Conforms to **Lyceum** (`00-FOUNDATION.md`). All tokens, type families, spacing,
radii, elevation, motion, and components are cited by name from FOUNDATION
§2–§5. No new primitives are invented except where flagged as a **Proposed
addition to FOUNDATION**.

---

## 1. Purpose & primary user

**Primary user:** Teacher (role `teacher`) authoring inside their tenant;
secondarily Tenant Admin (`tenantAdmin`) with the same edit rights tenant-wide.

**Job-to-be-done:** _"Define a coherent unit of a learning path — what it is (a
lesson vs. a timed test), how hard, how long, how its items are grouped into
sections, and which rubric grades it — without ever leaking exam answer keys or
breaking the path ordering."_

A StoryPoint is the middle tier of the hierarchy **Space → StoryPoint →
UnifiedItem**. This screen edits the StoryPoint _envelope_ (metadata, structure,
assessment policy). It does **not** edit the items themselves — item authoring
is the Item Editor, reached from the item list this StoryPoint surfaces. The
canonical home is `tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}`.

The screen carries the platform's two emotional registers from FOUNDATION §1,
but here it is squarely the **precision-instrument** register: dense, confident,
staff-facing. No gamification chrome.

---

## 2. Entry points & route

**Route:** Nested inside the Space Editor. `/spaces/:spaceId/edit` → **Content**
tab → select or create a StoryPoint → opens the editor as a **Drawer**
(right-side Sheet on `lg`) or a full **Modal/Dialog** (`md` and below).
Deep-linkable as `/spaces/:spaceId/edit?tab=content&sp=:spId` so a save toast /
version link can re-open the exact StoryPoint.

**Common-API wiring (reference `specs/common-api.md`; UI never touches Firestore
directly):**

| Action                                           | Endpoint                                                          | Notes                                                                                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolve which StoryPoint to edit                 | `v1.levelup.listStoryPoints`                                      | Already loaded by the parent Content tab; editor receives the entity as a prop.                                                             |
| Read item count + section item distribution      | `v1.levelup.listItems` (scoped to `storyPointId`)                 | Read-only; powers "Sections (3) · 12 items" and per-section counts. **Stats are trigger-maintained — never recompute counts client-side.**  |
| Resolve effective rubric for inheritance preview | resolved via `resolveRubric` (tenant → space → storyPoint → item) | Read; shows what an item would inherit if no override is set.                                                                               |
| Create / update / delete StoryPoint              | `v1.levelup.saveStoryPoint`                                       | Upsert: no `id` → create; `id` present → update; `data.deleted = true` → delete StoryPoint + its items + answerKeys, decrement Space stats. |
| Reorder StoryPoints in the path                  | `v1.levelup.reorderItems` (atomic, identity-preserving)           | Drag-reorder of StoryPoints in the parent list; this editor only exposes the resulting `orderIndex`, it does not own the drag surface.      |
| Edit Assessment Config                           | links to **Assessment Config** screen                             | For `quiz` / `timed_test` types — its own spec.                                                                                             |

`tenantId` is **derived server-side from auth claims** and is never sent in the
request body (FOUNDATION domain rule + rebuild seam). The client sends
`spaceId`, optional `id`, and `data`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar) which remains visible behind the
Drawer/Modal scrim. The editor itself is a **Drawer** (`lg`/`xl`) or **Modal**
(`sm`/`md`). Content max measure ~720 (FOUNDATION §4 reading width); the form
column is single-track to keep label→field scanning linear.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Topbar: tenant switcher · search · notifications · profile                 │
│ Sidebar │  Space Editor — /spaces/:spaceId/edit                            │
│         │  [ Overview | Content* | Versions | Settings | Agents ]          │
│         │                                                                  │
│         │   …Content tab (StoryPoint list)…    ░░░░ scrim ░░░░             │
│         │                              ┌──── Drawer (lg) / Modal (≤md) ──┐ │
│         │                              │ HEADER                          │ │
│         │                              │  ‹ Back   Edit Story Point   ⌫  │ │
│         │                              │  Breadcrumb: Space › StoryPoint │ │
│         │                              ├─────────────────────────────────┤ │
│         │                              │ BODY (scroll, 720 measure)      │ │
│         │                              │                                 │ │
│         │                              │  [Title          ............]  │ │
│         │                              │  [Description (Textarea)     ]  │ │
│         │                              │                                 │ │
│         │                              │  ┌ Type ─┐ ┌ Difficulty ┐ ┌Time┐│ │
│         │                              │  │Select │ │ Slider     │ │ #  ││ │
│         │                              │  └───────┘ └────────────┘ └────┘│ │
│         │                              │                                 │ │
│         │                              │  ▸ Assessment policy  (if quiz/ │ │
│         │                              │     timed_test) → InlineAlert + │ │
│         │                              │     "Open Assessment Config →"  │ │
│         │                              │                                 │ │
│         │                              │  Sections (3) · 12 items        │ │
│         │                              │   ╞ Accordion ═══════════════╡  │ │
│         │                              │   ⠿ Warm-up        4 items  ⌄  │ │
│         │                              │   ⠿ Core           6 items  ⌄  │ │
│         │                              │   ⠿ Stretch        2 items  ⌄  │ │
│         │                              │   [+ Add section]               │ │
│         │                              │                                 │ │
│         │                              │  ▸ Default rubric (override)    │ │
│         │                              │     Inherited from: Space ›…    │ │
│         │                              │     [Override rubric ▾]         │ │
│         │                              ├─────────────────────────────────┤ │
│         │                              │ FOOTER (sticky)                 │ │
│         │                              │  Last saved 2m ago · [Cancel]   │ │
│         │                              │                  [Save changes] │ │
│         │                              └─────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

**Responsive (FOUNDATION breakpoints `sm 640 · md 768 · lg 1024`):**

- **`lg`+ (≥1024):** right **Drawer** ~560–640px wide, AppShell + StoryPoint
  list stay visible (context preserved). Header and Footer are pinned; Body
  scrolls.
- **`md` (768–1023):** full-screen **Modal/Dialog**; the Type/Difficulty/Time
  row stays 3-up.
- **`sm` (<768):** full-screen **Modal**; the 3-up row collapses to stacked
  single-column; Footer becomes a sticky bottom bar with full-width **Save
  changes**, **Cancel** as a ghost link above it. Page gutter 16 (FOUNDATION
  §4).

Spacing rhythm uses the §4 scale: section gap `6 (24)`, field gap `4 (16)`,
label→input `1 (4)`. Inputs/buttons radius `md (10)`; the panel/Drawer surface
radius `lg (14)`; Accordion section chips `pill`.

---

## 4. Components used (FOUNDATION §5 only)

**Containers:** Drawer/Sheet (lg) · Modal/Dialog (≤md) · Section · Accordion
(sections) · Panel (assessment + rubric sub-blocks) · Tabs (parent Space Editor)
· Tooltip · Popover (rubric picker). **Primitives:** Input (title, est. time
`number`, section title/description) · Textarea (description) · Select (type) ·
**Slider** (difficulty, 4 detents easy/medium/hard/expert) · Switch (assessment
toggles, surfaced as a _preview_; full control on the Assessment Config screen)
· Button (`primary` Save, `ghost` Cancel/Back, `danger` Delete, `secondary` "Add
section") · IconButton (back, delete-section, drag handle). **Data/feedback:**
Badge / Chip (type, difficulty, item count) · DefinitionList (rubric inheritance
source) · EmptyState (no sections yet) · Skeleton (loading) · Toast/sonner
(save/delete) · InlineAlert/Banner (assessment hand-off, answer-key warning) ·
ConfirmDialog (delete) · FormFieldError · LoadingOverlay (save in-flight) ·
Breadcrumb. **Domain components:** `AnswerKeyLock` — server-only guard visual,
shown when the StoryPoint is `timed_test` to remind the author keys are stripped
client-side (see §8). `RubricBreakdown` (read-only preview of the resolved
rubric in the override Popover).

**Proposed additions to FOUNDATION** (flagged, not silently invented):

- **`DifficultyScale`** — a 4-detent labeled **Slider** wrapper mapping
  `easy · medium · hard · expert` to color domain tokens (`status.success` →
  `spark` → `status.error` ramp), with the active detent label in
  `text.primary`. _Rationale:_ difficulty is authored on this screen and several
  others (Item Editor); a shared, labeled-detent variant of the §5 Slider keeps
  it consistent. If rejected, fall back to a plain §5 **Select** (as the current
  live code uses).
- **`SectionRow`** — a draggable Accordion header row = drag handle
  (IconButton) + inline-editable title Input + item-count Badge + delete
  IconButton. Composed entirely from §5 primitives; registering it as a named
  domain component avoids re-spec across the editor and the item list.

---

## 5. States

| State                      | Treatment                                                                                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading**                | Drawer/Modal opens immediately with a **Skeleton**: title bar shimmer, three field blocks, one Accordion skeleton row. Uses `bg.surface-sunken` shimmer; respects reduced-motion (static placeholder).                                                                                   |
| **Empty (new StoryPoint)** | No `id` yet. Title focused and empty with placeholder; type defaults to `standard`; difficulty `medium`; Sections region shows **EmptyState**: "No sections yet — items will sit directly in this story point." Save disabled until title is non-blank (`!title.trim()`, per live code). |
| **Empty (no items)**       | Item count reads `0 items`; per-section counts hidden; an InlineAlert (info, `status.info`) hints: "Add items from the Content tab once this story point is saved."                                                                                                                      |
| **Partial**                | Editing an existing StoryPoint whose item read (`listItems`) is still in flight: metadata fields render from the passed entity; section item counts show inline Skeleton chips until counts resolve. The form is fully usable during this.                                               |
| **Error — load**           | If the StoryPoint can't be resolved (deleted under you / permission lost): **InlineAlert** (`status.error`) "This story point could not be loaded. It may have been deleted." with a **Back to content** button.                                                                         |
| **Error — save**           | `saveStoryPoint` failure → Toast (`status.error`) + inline FormFieldError on the offending field when the server returns `invalid-argument` (e.g. missing title/type on create). Form state preserved; no optimistic close.                                                              |
| **Success**                | Toast (`status.success`) "Story point saved." Footer "Last saved" timestamp updates. On create, the editor stays open and rebinds to the returned `id` so the author can immediately add sections/items.                                                                                 |

**Permission-gated variations:**

- **teacher / tenantAdmin:** full read-write. tenantAdmin sees identical
  controls (rights are tenant-wide, surface unchanged).
- **student / consumer:** **never reach this screen.** No authoring route is
  exposed; `saveStoryPoint` is gated by `assertTeacherOrAdmin` server-side. If a
  student URL-forces the route, AppShell route-manifest denies and redirects to
  their learning view. Answer-key-bearing config is doubly protected (see §8).
- **Across tenants:** a teacher cannot open a StoryPoint outside their tenant —
  `tenantId` from claims must match the path; server
  `loadSpace`/`loadStoryPoint` enforce isolation.

---

## 6. Interactions & motion

**Open:** Drawer slides in from right over `base 220ms` with `ease.entrance`;
scrim fades `fast 160ms`. Modal (≤md) scales from 0.98→1 + fade over `base`,
`ease.entrance` (elevation `e3`, FOUNDATION §4). Reduced-motion → instant fade
only.

**Type change:** switching to `quiz` / `timed_test` reveals the **Assessment
policy** block via Accordion expand (`base`, `ease.standard`) — _not_ a layout
jump; the block height animates open. The block is a **preview + hand-off**, not
the full config: it shows duration, max attempts, passing %, and a
`primary`-outlined **"Open Assessment Config →"** that routes to the Assessment
Config screen. Switching _away_ from an assessment type does **not** silently
destroy `assessmentConfig`; it collapses with a soft InlineAlert "Assessment
settings kept; they apply only to assessment types." (Avoids the live code's
`undefined` wipe.)

**Difficulty Slider:** dragging snaps to detents with a `fast 160ms`
`ease.standard` thumb settle; the active label and its color token update live.
Keyboard arrows step detents.

**Sections — add:** "+ Add section" appends a `SectionRow` that animates in
(height + fade, `base`, `ease.entrance`) with its title Input auto-focused.
**Reorder:** drag handle (⠿) reorders rows; on drop, an **optimistic** local
reorder is applied instantly, then persisted in the StoryPoint's
`sections[].orderIndex` on next Save — section reordering is part of the
StoryPoint document, not a separate `reorderItems` call. **Remove:** delete
IconButton on a section _that contains items_ opens a **ConfirmDialog** ("Items
in this section will become unsectioned — they are not deleted."); an empty
section removes immediately with an Undo Toast.

**Save:** **optimistic** for low-risk metadata — Footer flips to "Saving…" with
a quiet **LoadingOverlay** only on the footer button (not the whole form). On
success → Toast + timestamp; on failure → revert button, surface error (§5).
Save is disabled while title is blank.

**Delete StoryPoint:** `danger` IconButton (⌫) in the header opens a
**ConfirmDialog** with explicit blast-radius copy: _"Delete this story point and
its N items? This also removes any answer keys and cannot be undone."_ Confirm
sends `data.deleted = true`. No optimistic delete — wait for server, then close
Drawer + Toast.

**Cancel / dismiss:** Esc, scrim click, or Cancel. If the form is dirty, a
**ConfirmDialog** "Discard unsaved changes?" guards the close.

All motion uses FOUNDATION §4 tokens (`instant/fast/base/slow`,
`ease.standard/entrance/exit`). No spring here — springs are reserved for
student gamification.

---

## 7. Content & copy

Tone: **precise, staff-facing.** Plain nouns, no exclamation, no encouragement
language (that register is for learners).

- **Header:** "Edit Story Point" / "New Story Point" · Breadcrumb
  `‹Space title› › ‹StoryPoint title›`.
- **Labels:** "Title" · "Description" · "Type" · "Difficulty" · "Estimated time
  (min)" · "Sections" · "Default rubric".
- **Type option labels:** Standard · Practice · Quiz · Timed test. _(Drop the
  legacy "Test" option — the rebuild removes the duplicate `test` type; the
  Select offers exactly four.)_
- **Type helper microcopy (under Select):** "Standard = lesson/content. Practice
  = ungraded reps. Quiz / Timed test = scored assessment with its own config."
- **Difficulty detents:** Easy · Medium · Hard · Expert.
- **Assessment hand-off InlineAlert:** "This is an assessment. Set duration,
  attempts, scheduling, and retry rules in **Assessment Config**." + button
  "Open Assessment Config →".
- **Answer-key reminder (timed_test, with `AnswerKeyLock`):** "Answer keys for
  timed tests are stored server-side and are never sent to students."
- **Sections empty state:** title (Fraunces, §3) "No sections yet" · body "Group
  items into named sections, or leave them ungrouped." · action "Add section".
- **Section placeholders:** title "Section title" · description "Description
  (optional)".
- **Remove-section confirm:** "Items in this section will become unsectioned.
  They are not deleted. Continue?"
- **Rubric inheritance line (DefinitionList):** "Inherited from: **Space
  default**" (or Tenant default) · action "Override for this story point".
- **Footer:** "Last saved {relative}" · "Cancel" · "Save changes".
- **Save success Toast:** "Story point saved."
- **Delete confirm:** "Delete "{title}" and its {n} items? Answer keys are
  removed too. This can't be undone."
- **Errors:** missing title → "Add a title to save." · save failure → "Couldn't
  save story point. Try again." · load failure → "This story point could not be
  loaded. It may have been deleted."

Numerics (est. time, item counts, durations, passing %) render in **Spline Sans
Mono** (FOUNDATION §3). Headings/empty-state titles in **Fraunces**; all
labels/body/buttons in **Schibsted Grotesk**.

---

## 8. Domain rules surfaced

1. **Answer keys are never shown to students — and are stripped server-side.**
   For `timed_test` StoryPoints, correct answers on child items are split into a
   server-only `answerKeys` subcollection denied to all clients by
   `firestore.rules`. This editor edits the _envelope_, not item answers, but it
   surfaces the **`AnswerKeyLock`** badge + reminder so authors understand why
   item editing for timed tests behaves differently (the Item Editor re-merges
   via `getItemForEdit` and guards against overwriting a stripped key). The
   Student view of this StoryPoint never carries keys.
2. **StoryPoint type drives downstream UX and is constrained to four values** in
   the rebuild: `standard | practice | quiz | timed_test` (the legacy `test` is
   dropped). `quiz`/`timed_test` require Assessment Config; this screen links
   out and previews it but does not own validation of timing/scheduling.
3. **Server-authoritative everything.** Timers, schedules, passing logic live in
   `assessmentConfig` and are enforced server-side at run time — the editor only
   records intent. The "Available from/until" window is stored as Firestore
   timestamps; runtime gating is not the client's job.
4. **Stats are trigger-maintained.** Item counts ("12 items", per-section
   counts, `stats.totalPoints`) come from `listItems` / denormalized `stats`.
   The editor **must not** recompute or write counts. Deleting a StoryPoint
   decrements Space `stats.totalStoryPoints`/`totalItems` server-side (per
   `saveStoryPoint`).
5. **Rubric inheritance chain:** tenant → space → **storyPoint** → item. Setting
   "Default rubric" here overrides the Space default for all items in this
   StoryPoint that don't set their own. The override Popover shows a read-only
   `RubricBreakdown` of what's currently resolved so the author sees the effect
   of _not_ overriding.
6. **Tenant isolation.** `tenantId` is derived from auth claims, never accepted
   from the body. `assertTeacherOrAdmin` + `loadSpace`/`loadStoryPoint` enforce
   that the caller owns the tenant and the StoryPoint exists within it.
7. **Delete is destructive and cascading.** `data.deleted = true` removes the
   StoryPoint, all its items, and each item's `answerKeys` subcollection, then
   decrements Space stats. Always behind a ConfirmDialog stating the item count.
8. **Versioning is automatic.** Create/update/delete write a `ContentVersion`
   (`spaces/{id}/versions`) server-side; the editor surfaces nothing here beyond
   the Versions tab existing — no client version write.

---

## 9. Accessibility (WCAG AA)

- **Focus management:** opening the Drawer/Modal moves focus to the first field
  (Title) and traps focus within (Esc closes, guarded by dirty-check). On close,
  focus returns to the triggering StoryPoint row.
- **Focus order:** Back → Title → Description → Type → Difficulty → Est. time →
  (Assessment block: preview fields → "Open Assessment Config") → Sections (each
  SectionRow: handle → title → description → delete) → Add section → Default
  rubric → Cancel → Save → Delete.
- **Keyboard:** Slider operable via arrows (step detents), Home/End to ends.
  Accordion sections toggle with Enter/Space; section reordering exposes a
  keyboard alternative (Up/Down on a focused drag handle moves the row) — drag
  is not mouse-only. ⌘K command palette is unaffected (web-only, see §10).
- **ARIA:** Drawer/Modal `role="dialog"` `aria-modal="true"` `aria-labelledby`
  the header. Slider `role="slider"` with `aria-valuetext="Hard"` (the _label_,
  not a bare number). Item counts use `aria-label="12 items"`. The
  `AnswerKeyLock` reminder is an `aria-live="polite"` region when it appears on
  type change.
- **Status never by color alone** (FOUNDATION §2.3 rule): difficulty shows
  label + color; assessment alert shows icon + text; error states pair
  `status.error` with an icon and message; the answer-key lock shows a lock
  icon + text.
- **Contrast:** all label/field/button pairs meet AA (4.5:1 body, 3:1 UI per
  FOUNDATION §2). Mono numerics on `bg.surface` verified for small-text
  contrast.
- **Reduced motion:** `prefers-reduced-motion` disables Drawer slide, Accordion
  height animation, and SectionRow entrance — substitute instant opacity changes
  (FOUNDATION §4).
- **Targets:** all interactive controls ≥44px touch target on mobile (§4).

---

## 10. Web ↔ mobile divergence

The teacher authoring surface is **web-primary** (`shared-ui`); native authoring
on `ui-native` is read-mostly. Where mobile authoring exists, names/props match
1:1 (FOUNDATION §6):

- **Container:** web uses right **Drawer** on `lg`; mobile (RN) uses a
  full-screen **Sheet** pushed onto the stack — no side-by-side context.
- **Sections list:** web Accordion with inline drag handles → mobile **stacked
  cards** with a long-press drag affordance and a kebab for delete
  (table/inline-row patterns become cards per §6).
- **Hover → press:** web hover tooltips (e.g. on `AnswerKeyLock`) become
  tap-to-reveal Popovers on mobile.
- **⌘K / CommandPalette:** absent on mobile (§6) — no quick-jump between
  StoryPoints; navigation is via the back stack.
- **Difficulty Slider:** identical detent semantics; mobile uses a larger
  thumb + spring-free settle to meet the 44px target.
- **Datetime (schedule, on Assessment Config):** web `datetime-local` input →
  native date/time picker sheets.
- **Save footer:** web sticky footer → mobile a pinned bottom action bar with
  full-width primary Save, respecting safe-area insets.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the "Story Point Editor" screen for the Auto-LevelUp teacher web app.
STRICTLY conform to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md —
use ONLY its semantic color tokens (§2: bg.canvas, bg.surface, text.primary/secondary/muted,
brand.primary, spark, status.success/warning/error/info, domain scale §2.3 for difficulty),
its type families (§3: Fraunces display, Schibsted Grotesk UI, Spline Sans Mono for numerics),
and its spacing/radius/elevation/motion tokens (§4). Compose ONLY from the Core Component
Inventory (§5). Do NOT invent colors, fonts, spacing, radii, shadows, or component names. Cite
tokens by name.

CONTEXT: This edits ONE StoryPoint (middle tier of Space → StoryPoint → UnifiedItem). It lives
inside /spaces/:spaceId/edit on the Content tab, opening as a right-side Drawer on lg+ and a
full-screen Modal on md and below, inside AppShell (sidebar + topbar stay visible behind a scrim).

BUILD a single-column form (≈720px measure) with:
- Header: back IconButton, "Edit Story Point" (Fraunces), breadcrumb Space › StoryPoint,
  a danger delete IconButton.
- Fields: Title (Input), Description (Textarea), then a 3-up row — Type (Select with EXACTLY four
  options: Standard, Practice, Quiz, Timed test), Difficulty (a 4-detent labeled Slider:
  Easy/Medium/Hard/Expert ramped success→spark→error), Estimated time minutes (numeric Input in
  Spline Sans Mono). On sm, stack to one column.
- When Type is Quiz or Timed test: reveal (Accordion expand, motion `base`, ease.standard) an
  "Assessment policy" Panel that PREVIEWS duration / max attempts / passing % and shows a primary
  outline button "Open Assessment Config →". For Timed test, show an AnswerKeyLock badge with the
  reminder "Answer keys for timed tests are stored server-side and are never sent to students."
- Sections: an Accordion of draggable SectionRows (drag handle, inline-edit title Input, item-count
  Badge, delete IconButton) with a "+ Add section" secondary button and an EmptyState
  ("No sections yet — group items into named sections, or leave them ungrouped.").
- Default rubric: a DefinitionList line "Inherited from: Space default" + an "Override for this
  story point" Popover showing a read-only RubricBreakdown.
- Sticky footer: "Last saved {relative}" + ghost Cancel + primary "Save changes" (disabled when
  title is blank).

STATES: render skeleton loading, empty (new), error (InlineAlert status.error), and success (sonner
Toast "Story point saved."). Save is optimistic on the footer button only (LoadingOverlay scoped to
it). Delete uses a ConfirmDialog stating the item count and that answer keys are removed.

RULES TO HONOR: never show answer keys; tenantId is server-derived (not a field); item counts are
read-only/trigger-maintained (never recompute); status is never color-alone (always icon + label);
respect prefers-reduced-motion; WCAG AA contrast; dialog focus-trap with return-focus; Slider
aria-valuetext uses the difficulty label.

Output clean, accessible React (shared-ui component names from §5) with Tailwind classes that read
the Lyceum CSS custom properties. Editorial, precise, staff-facing tone — no gamification chrome.
```
