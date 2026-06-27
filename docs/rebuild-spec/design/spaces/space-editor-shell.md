# Space Editor — Tabbed Shell

> The container for the entire space authoring experience: a persistent editor
> header (inline-editable title, status pill, autosave indicator, Save / Publish
> / Preview, breadcrumb back to the library) wrapping a five-tab workspace
> (Settings · Content · Rubric · Agents · History). This spec defines the
> **shell only** — layout, tab navigation, the save model (autosave 2s
> debounce + manual ⌘/Ctrl+S), the unsaved-changes guard, and the contract by
> which sub-tab screens compose inside it. The individual tab bodies live in
> their own specs.

Conforms to **Lyceum / `00-FOUNDATION.md`** — all tokens, type, spacing, motion,
and components are cited by name from that file; nothing here invents new ones.

---

## 1. Purpose & primary user

**Primary user:** the **teacher** (content author) — and, with elevated reach,
the **tenantAdmin**.

**Job-to-be-done:** _"I'm building or revising one LevelUp space. Give me a
single, stable workspace where I can move between its configuration, its content
tree, its grading rubric, its AI agents, and its change history without losing
context, without losing my edits, and where I always know whether my work is
saved and whether the space is live for students."_

The shell's whole reason to exist is **orientation + safety**: the author should
always know _where they are_ (which space, which tab, what status), _whether
it's saved_ (autosave indicator), and _what publishing will do_ (status
transition gate). Tab bodies do the real authoring work; the shell guarantees
they never silently lose it.

Students and consumers **never see this screen** — it is teacher/admin-only
chrome. Their view of the same space is the read-only learner runtime (separate
specs).

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/edit`. The shell owns the URL; the active tab is
reflected as `?tab=settings|content|rubric|agents|history` so a tab is
deep-linkable and survives reload.

**Entry points:**

- "Edit" action on a `SpaceCard` in the Spaces library.
- "Create space" flow → server returns a draft `spaceId` → redirect into
  `…/edit?tab=settings`.
- Direct deep link / bookmark (e.g. someone shared `…/edit?tab=content`).
- Breadcrumb returns to `/spaces`.

**common-API reads (via typed read endpoints — never direct Firestore in the
rebuild):**

- `v1.levelup.getSpace` — the space document that powers the header (title,
  `status`, `type`, `accessType`, store fields) and seeds the Settings/Rubric
  tabs.
- Tab bodies fetch their own data on activation: `v1.levelup.listStoryPoints` +
  `listItems` (Content), `listVersions` (History), space `agents` (Agents). The
  shell only orchestrates _when_ (lazy on first tab activation) — it does not
  fetch tab payloads itself.

**common-API writes (the shell owns the save seam):**

- `v1.levelup.saveSpace` — fired **debounced (2s)** on header-title edits and on
  Settings/Rubric changes bubbled up to the shell, and **immediately** on manual
  ⌘/Ctrl+S. `tenantId` is derived server-side from auth claims and is **never**
  placed in the request body.
- Status transitions also route through `saveSpace` (status patch) behind a
  `validatePublish` gate: **draft→published**, **published→{archived,draft}**,
  **archived→draft**.
- Content-tab structural writes (`saveStoryPoint`, `saveItem`, `getItemForEdit`,
  `reorderItems`, `moveItems`, `importFromBank`) are owned by the Content
  sub-screen, **not** the shell. The shell exposes only the save-state bus they
  report into so the autosave indicator stays truthful across tabs.

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** (§5 Navigation: Sidebar + Topbar). The editor
occupies the AppShell content region; the sidebar/topbar persist. Max content
width 1200 (FOUNDATION §4); page gutters 32 desktop / 24 tablet / 16 mobile.

```
┌─ AppShell content region ───────────────────────────────────────────────┐
│  Breadcrumb:  Spaces  ›  Algebra I — Linear Equations        (region A)  │
│                                                                          │
│ ┌─ Editor header (region B, sticky top within content) ───────────────┐ │
│ │ [←]  ⟪Algebra I — Linear Equations⟫✎   [● Published]  learning      │ │
│ │       (Fraunces, inline-editable)        (status pill)              │ │
│ │                                  · Saved 2s ago   [Preview][Publish]│ │
│ │                                   (autosave ind.)  (ghost) (spark/  │ │
│ │                                                          green)     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Tab bar (region C, Tabs §5) ───────────────────────────────────────┐ │
│ │  [⚙ Settings] [☰ Content] [▤ Rubric] [🤖 Agents] [⟲ History]        │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Tab body (region D — owned by sub-screen) ─────────────────────────┐ │
│ │                                                                     │ │
│ │   (Settings / Content / Rubric / Agents / History composes here)    │ │
│ │                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘

Overlays mounted by the shell, above region D:
  • Item editor → Drawer/Sheet (right, sm:max-w-2xl)        [Content tab]
  • Story-point editor → Drawer/Sheet (right, sm:max-w-xl)  [Content tab]
  • Student Preview → Modal/Dialog (max-w-3xl)              [header Preview]
  • ConfirmDialog (archive / discard-unsaved / destructive) [global]
```

**Regions**

- **A Breadcrumb** (§5 Breadcrumb): `Spaces › {space.title}`. Current page is
  non-link.
- **B Editor header** — sticky to the top of the content region so status + save
  state stay visible while the tab body scrolls. Three zones: back IconButton +
  inline title + status pill (left); autosave indicator (center-right); action
  cluster (right).
- **C Tab bar** (§5 Tabs) — five triggers, icon + label. Active trigger uses
  `brand.primary`.
- **D Tab body** — a single mount point; the active tab's sub-screen renders
  here.

**Responsive**

- **lg (≥1024):** header zones on one row; all five tab labels visible; tab body
  up to 1200.
- **md (768–1023):** header wraps the action cluster under the title row; tabs
  still show labels; Sheets at `sm:max-w` widths.
- **sm (<768):** header collapses to back + title + status pill on row 1,
  autosave indicator + an **overflow IconButton** (Preview / Publish / Archive
  in a Popover) on row 2. Tabs become **horizontally scrollable, icon-first**
  (labels truncate); on the narrowest widths the Tab bar may render as the
  mobile **Tabbar** pattern. Sheets/Dialogs go full-width.

---

## 4. Components used (from FOUNDATION §5 only)

- **AppShell**, **Breadcrumb**, **Tabs** (TabsList / TabsTrigger / TabsContent).
- **Button** — variants: `ghost` (back, secondary header actions),
  `secondary`/outline (Preview, Unpublish, Archive, Restore), **`spark`**
  reserved for the single highest-energy action (see Domain note on Publish),
  `danger` for destructive confirms.
- **IconButton** — back arrow, mobile overflow.
- **Input** — the inline title editor (borderless display → bordered on focus).
- **Badge / Chip** — the **status pill** (draft / published / archived) and the
  space `type` chip; pill **always pairs an icon + text label**, never color
  alone (§2 contrast rule).
- **Drawer/Sheet** — item editor and story-point editor (Content tab overlays
  mounted at shell level).
- **Modal/Dialog** — Student Preview.
- **ConfirmDialog** — archive, discard-unsaved guard, destructive structural
  actions.
- **Toast (sonner)** — save success/failure, publish/archive results.
- **InlineAlert/Banner** — publish-blocked reasons (`validatePublish` failures),
  answer-key-stripped warning passthrough, archived/read-only banner.
- **Skeleton** — header + tab-bar + body skeleton during `getSpace`.
- **Tooltip** — autosave-indicator detail, disabled-action reasons, ⌘S hint.
- **EmptyState** — the "Space not found" / no-access fallback.
- **ContentRenderer** (md + KaTeX) — used inside Student Preview (the one
  canonical renderer; no second HTML renderer).

**Proposed addition to FOUNDATION:** an **AutosaveIndicator** micro-component
(status text + dot: `Saving…` / `Saved {relative time}` / `Unsaved changes` /
`Save failed — retry`). It is small but appears on every authoring shell
(spaces, exams, question bank) and should be standardized rather than re-styled
per screen. Until adopted, compose it from Chip + Tooltip + a spinner/check icon
using `text.secondary` and `status.*` tokens.

---

## 5. States

**Loading** (`getSpace` pending): Skeleton header (avatar-sized back block,
title bar, short status bar), a Skeleton tab strip, and a tall Skeleton body
block. No tab is interactive yet.

**Empty / not-found:** if `getSpace` returns null or the caller's tenant doesn't
own this space, render an **EmptyState** — Fraunces title "Space not found",
body "It may have been deleted, archived, or it belongs to another workspace.",
primary `secondary` Button "Back to Spaces". (Tenant mismatch is treated as
not-found — never confirm a foreign space exists.)

**Error:** network/permission failure on `getSpace` → EmptyState with "Couldn't
load this space" + "Try again" (refetch) + "Back to Spaces". Errors from
`saveSpace` flip the autosave indicator to **Save failed — retry** (clickable)
and raise a `status.error` Toast; they do **not** wipe the editor's local
buffer.

**Partial:** the shell renders as soon as `getSpace` resolves even while a tab
body is still loading its own data — the header + tabs are live; the active body
shows its own Skeleton. Switching to a not-yet-loaded tab triggers that tab's
lazy fetch with its own loading state.

**Success:** header shows real title/status/type; active tab body interactive;
autosave indicator reads **Saved {relative time}**.

**Permission-gated variations**

- **teacher (owner author):** full shell — all tabs, Save/Publish/Archive, all
  overlays.
- **tenantAdmin:** identical authoring power; may additionally manage
  `accessType`/store fields surfaced inside Settings (gated there, not in the
  shell).
- **archived space (any staff):** persistent **InlineAlert** banner — "This
  space is archived and read-only. Restore to Draft to edit." Tab bodies render
  read-only; the only enabled header action is **Restore to Draft**
  (`archived→draft`).
- **published space:** header shows **Unpublish** + **Archive**; editing content
  is allowed (changes versioned), but structural edits surface a reminder that
  the space is live.
- **student / consumer:** **no route access** — guard redirects to the learner
  runtime. This screen never renders for them.

---

## 6. Interactions & motion

**Tab switch:** `instant`/`fast` (100–160ms) cross-fade of the body using
`ease.standard`; the URL `?tab=` updates without a full navigation. Active
TabsTrigger underline/indicator slides with `base` (220ms). Tab data is fetched
lazily on first activation and cached for the session.

**Inline title edit:** click (or focus + Enter) on the title turns it into an
**Input** in place (border + `border.focus` ring); blur or Enter commits →
debounced `saveSpace`. Escape reverts to the last saved value. The committed
title also live-updates the breadcrumb.

**Save model (the heart of the shell):**

- **Autosave:** edits in the header and in Settings/Rubric debounce **2s** then
  call `saveSpace`. While the debounce/write is in flight the indicator reads
  **Saving…** (subtle spinner, `fast`); on success it springs to **Saved just
  now** with a tiny check (`instant`, respects reduced-motion).
- **Manual save:** **⌘S / Ctrl+S** flushes the pending debounce immediately and
  shows **Saving… → Saved**. A Tooltip on the indicator exposes the shortcut.
- **Optimistic:** the local buffer is the source of truth for the field the
  moment you type; the indicator — not the field — reflects persistence. A
  failed write keeps your text and offers retry; it never reverts your input.

**Unsaved-changes guard:** if a write is pending/failed and the user navigates
away (breadcrumb, back button, route change, tab close), a **ConfirmDialog**
intercepts — "You have unsaved changes" / "Save and leave" (primary) · "Discard
changes" (danger) · "Keep editing". Same guard fires on closing the
item/story-point Sheets with dirty content.

**Status actions:**

- **Publish** (`draft→published`): runs `validatePublish`; on block, an
  **InlineAlert** lists reasons (e.g. "Add at least one story point", "Story
  Point 3 has no items"); on pass, optimistic pill flip + success Toast.
- **Unpublish** (`published→draft`) and **Restore to Draft** (`archived→draft`):
  immediate, success Toast.
- **Archive** (`published→archived`): **ConfirmDialog** — "Archive this space?
  Students will lose access." → archive + Toast + read-only banner.

**Overlays:** Sheets slide in with `ease.entrance` / out with `ease.exit`
(`base`); Student Preview Dialog uses `e3` elevation and a backdrop fade. Focus
moves into the overlay on open and returns to the trigger on close.

**Motion discipline:** per FOUNDATION §4, all shell chrome stays subtle
(`fast`/`base`, `ease.standard`). There is **no** celebratory burst here — the
one marigold spring is reserved for student gamification, not authoring.

---

## 7. Content & copy

Tone: **precise, calm, instrument-like** for staff (no exclamation marks, no
learner cheerleading).

- **Breadcrumb:** `Spaces` › `{space.title}`.
- **Tabs:** `Settings` · `Content` · `Rubric` · `Agents` · `History`.
- **Status pill labels:** `Draft` · `Published` · `Archived`.
- **Header actions:** `Preview`, `Publish`, `Unpublish`, `Archive`,
  `Restore to Draft`.
- **Autosave indicator:** `Saving…` · `Saved just now` / `Saved 2m ago` ·
  `Unsaved changes` · `Save failed — retry`.
- **Inline title placeholder (untitled):** `Untitled space`.
- **Unsaved guard:** title "Unsaved changes"; body "Your latest edits haven't
  been saved yet."; buttons "Save and leave" / "Discard changes" / "Keep
  editing".
- **Publish blocked (InlineAlert):** heading "Can't publish yet"; body lists
  concrete fixes from `validatePublish`.
- **Archive confirm:** title "Archive space"; body "Students will no longer be
  able to access this space. You can restore it to draft later."; confirm
  "Archive".
- **Archived banner:** "This space is archived and read-only. Restore to Draft
  to make changes."
- **Not-found empty:** title "Space not found"; body "It may have been deleted,
  archived, or it belongs to another workspace."; action "Back to Spaces".
- **Save failure Toast:** "Couldn't save changes. Check your connection and try
  again."
- **Preview Dialog title:** "Student preview — {space.title}".

---

## 8. Domain rules surfaced

- **Answer-key never reaches the client/student.** For `timed_test` story
  points, correct answers live in the server-only `answerKeys` subcollection
  denied to all clients by firestore.rules. The shell's **Student Preview**
  renders via `ContentRenderer` and shows **no answer keys**. The item-edit
  Sheet (mounted by the shell, body owned by ItemEditor) re-merges keys via
  `getItemForEdit` and must guard against overwriting a stripped key — the
  **`answerKeyLooksStripped`** warning surfaces as an InlineAlert; the shell's
  save guard must not blindly persist a blank key over a real one.
- **Status transitions are constrained.** Only `draft→published`,
  `published→{archived,draft}`, `archived→draft` are offered; the header renders
  exactly the actions legal for the current status. Publish is gated by
  `validatePublish`.
- **Tenant isolation.** `tenantId` is derived server-side from auth claims,
  never sent in the body. A space whose tenant ≠ caller's tenant renders as
  **not-found** (never confirmed to exist).
- **Stats are server-authoritative.** Item/question/point counts shown in tab
  bodies come from trigger-maintained `stats`; the shell does not recompute
  counts client-side.
- **Rubric inheritance.** The Rubric tab edits the **space-level** default in
  the chain tenant → space → storyPoint → item (`resolveRubric`); the shell
  frames it as "the space default," not the only rubric.
- **One canonical content representation.** Preview and all authoring use the
  single Markdown-with-math `ContentRenderer`; there is no second (HTML)
  renderer in the rebuild.
- **Versioning is automatic.** History reflects server-written `ContentVersion`
  entries (publish/archive/edit); the shell does not let authors hand-author
  versions.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → back IconButton → title (Input) → status pill
  (info, non-interactive) → autosave indicator (status, `aria-live="polite"`) →
  Preview → status actions → Tabs (roving tabindex) → tab body.
- **Tabs:** standard ARIA tablist — `role="tablist"`/`tab`/`tabpanel`,
  `aria-selected`, Left/Right arrow roving focus, `Home`/`End`; each `tabpanel`
  is focusable and labelled by its trigger. Tab change updates `?tab=` so
  screen-reader users get a stable, reload-safe location.
- **Inline title:** the edit affordance is a real focusable control with
  `aria-label="Space title"`; Enter commits, Escape cancels.
- **Autosave indicator** is an `aria-live="polite"` region so "Saving… / Saved /
  Save failed" is announced without stealing focus. "Save failed — retry" is a
  real button.
- **Shortcuts:** ⌘/Ctrl+S handled at shell level (preventDefault on save), but
  never the _only_ way to save (blur autosaves); Escape closes the topmost
  overlay. Shortcuts are documented in Tooltips.
- **Overlays:** Sheets/Dialogs trap focus, `aria-modal`, ESC to close, focus
  returns to trigger; ConfirmDialog default focus on the safest action ("Keep
  editing").
- **Contrast & status:** all pairs meet WCAG AA (§2). **Status is never
  color-alone** — the pill, autosave states, and publish-blocked alert always
  pair an icon + text label.
- **Reduced motion:** `prefers-reduced-motion` disables the tab cross-fade,
  indicator spring, and Sheet slide — instant show/hide instead (FOUNDATION §4).

---

## 10. Web ↔ mobile divergence

`shared-ui` (web) and `ui-native` (Expo / NativeWind) keep component **names and
props 1:1**; only the renderer differs.

- **Header:** web keeps title + status + full action cluster on one row; native
  stacks them and moves Preview/Publish/Archive into an overflow menu (kebab →
  ActionSheet).
- **Tabs:** web uses the top **Tabs** strip; native uses a **scrollable
  segmented control** or the mobile **Tabbar** pattern, icon-first with
  truncated labels; `?tab=` still drives state.
- **Overlays:** web right-side **Sheet** for item/story-point editing → native
  bottom **Sheet** (drag-to-dismiss). Web modal Preview → native full-screen
  Preview route.
- **Save:** web exposes **⌘/Ctrl+S**; native has **no keyboard shortcut and no
  ⌘K** — autosave-on-blur + an explicit "Save" affordance carry the load; the
  unsaved guard hooks the hardware/back-gesture instead of `beforeunload`.
- **Hover → press:** web hover tooltips/affordances become press/long-press on
  native; touch targets ≥44px (§4).
- **Breadcrumb:** web shows the full crumb; native collapses to a single back
  chevron + truncated title.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp teacher web app, strictly conforming to
our design system "Lyceum" (docs/rebuild-spec/design/00-FOUNDATION.md). Do NOT invent colors,
fonts, spacing, radii, shadows, or component names — compose only from FOUNDATION §5 and cite
tokens by semantic name (brand.primary, spark, status.error/success/warning, text.secondary,
border.focus, paper/ink scales; Fraunces display / Schibsted Grotesk UI / Spline Sans Mono).

SCREEN: "Space Editor — Tabbed Shell" at /spaces/:spaceId/edit. This is the SHELL only — the
five tab bodies are separate screens; render their region as a labelled placeholder.

Build, inside AppShell (sidebar + topbar):
1. Breadcrumb: "Spaces › {space title}".
2. A sticky editor header: back IconButton (ghost), an INLINE-EDITABLE space title in Fraunces,
   a status pill (Draft/Published/Archived — icon + text, never color alone), a space-type chip,
   an autosave indicator (Saving… / Saved just now / Unsaved changes / Save failed — retry,
   aria-live polite), and a right-aligned action cluster. Show actions per status:
   Draft → Preview + Publish; Published → Preview + Unpublish + Archive; Archived → Preview +
   Restore to Draft + a read-only banner.
   Reserve the `spark` Button variant for the single highest-energy action only; use status.success
   styling for Publish; ghost/secondary for the rest.
3. A Tabs bar: Settings · Content · Rubric · Agents · History (icon + label), active = brand.primary,
   reflected in the URL as ?tab=.
4. The active tab body as a placeholder card.
5. Mount (closed) overlays: a right-side Sheet (item editor), a Modal (Student preview), and a
   ConfirmDialog (unsaved-changes guard: "Save and leave / Discard changes / Keep editing").

Behavior to express in the design:
- Autosave on 2s debounce + manual ⌘/Ctrl+S; the indicator (not the field) reflects persistence;
  a failed save keeps the text and offers retry.
- Status transitions limited to draft→published, published→{archived,draft}, archived→draft;
  Publish is gated and can show an InlineAlert "Can't publish yet" listing fixes.
- Student preview shows NO answer keys.

Show states: loading (Skeleton header + tabs + body), not-found EmptyState ("Space not found"),
archived read-only banner, save-failed indicator.

Use FOUNDATION motion: tab cross-fade fast/ease.standard, Sheet ease.entrance/exit, no celebratory
burst (that's reserved for student gamification). Meet WCAG AA, full keyboard tab roving, and respect
prefers-reduced-motion. Tone: precise and calm for staff — no learner cheerleading.

Deliver responsive at sm/md/lg per FOUNDATION breakpoints (sm collapses actions into an overflow
menu and makes the tab strip icon-first/scrollable).
```
