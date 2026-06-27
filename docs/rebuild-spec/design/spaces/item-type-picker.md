# Add Item — Type Picker — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). Compose only from its tokens
> and §5 components; values are cited by name, never re-pasted.

The decision surface that sits **in front of** `item-editor.md`. When a teacher
clicks "Add Item" on a StoryPoint's Content tab, they don't drop straight into
an editor — they first choose **what** they're authoring: one of the top-level
`ItemType`s, and for a question one of the **15** `QuestionType`s, for material
one of the **7** `MaterialType`s. The picker makes the consequential distinction
visible up front: **auto-graded vs AI-graded** (`AUTO_EVALUATABLE_TYPES` vs
`AI_EVALUATABLE_TYPES`), so teachers understand the grading cost/latency they're
committing to before they invest in authoring.

---

## 1. Purpose & primary user

**Role:** `teacher` (primary author) and `tenantAdmin` (full content authority).
Students never see this surface.

**Job-to-be-done:** _"I want to add a new piece of content to this StoryPoint,
and I need to pick the right type for what I'm teaching — without memorizing
which of 22 subtypes exist or which are graded automatically vs by AI."_ The
picker turns an implicit, lossy `<Select>` (today's `QUESTION_TYPES` /
`MATERIAL_TYPES` dropdowns inside `ItemEditor.tsx`) into a browsable, searchable
gallery with descriptions and a grading-mode signal — then hands the chosen type
to the editor with correct defaults already seeded.

---

## 2. Entry points & route

**Entry points:**

- **Content tab "Add Item" button** on `storypoint-editor.md` /
  `space-content-structure.md` (the dominant path) — opens this picker as a
  **Modal/Dialog** (§5).
- Optional split-button / kebab affordance "Import from question bank" routes
  laterally to `question-bank-import.md` instead of opening the editor.

**Route:** No standalone URL — it is a modal layered over the current
space-editor route (e.g. `/spaces/:spaceId/story-points/:storyPointId/content`).
It is dismissible (Esc / overlay click / Cancel) without side effects.

**Common-API reads/writes** (`docs/rebuild-spec/specs/common-api.md`):

- The picker itself performs **no writes**. Selecting a type constructs a draft
  `UnifiedItem` in memory (with `payload` seeded by `defaultQuestionData(qt)`
  for questions, or a minimal `MaterialPayload` for materials) and opens
  `item-editor.md` with it.
- The first **persist** happens downstream in the editor via
  **`v1.levelup.saveItem`** (upsert; strips answer keys into the server-only
  subcollection for test StoryPoints). For test/timed-test StoryPoints the
  editor re-hydrates via **`v1.levelup.getItemForEdit`**.
- The "Pick from question bank" entry point hands off to
  `question-bank-import.md`, powered by **`v1.levelup.listQuestionBank`** and
  **`v1.levelup.importFromBank`**.
- Section options for the downstream editor come from the already-loaded
  `listStoryPoints` / `listItems` data (StoryPoint `sections`); the picker does
  not re-fetch.

---

## 3. Layout — wireframe-as-text

Rendered inside a **Modal/Dialog** (§5) sized `lg` on desktop, full-height
**Sheet** on mobile. Lives over **AppShell** (the space-editor route's content
region); the dialog uses elevation **e3** (modal) and the **focus ring** token.

```
┌─ Modal (e3) ──────────────────────────────────────────── max-w 880, radius lg ─┐
│  Add an item                                                            [ ✕ ]   │  ← Fraunces text-xl header + IconButton close
│  Choose what you want to create. You can change details later.                 │  ← text.secondary, Schibsted base
│                                                                                 │
│  [🔎 Search types…                                            ]   ← Combobox/Input, full-width, sticky
│                                                                                 │
│  ┌── Step 1: top-level (segmented, only when >1 ItemType offered) ──────────┐  │
│  │  ( Question )  ( Material )  ( Interactive )  ( Assessment ) …            │  │  ← Tabs/segmented Chips, pill radius
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  QUESTIONS · Auto-graded            ← Section label (Schibsted sm, text.muted) │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ ▣ MCQ        │ │ ▣ MCAQ       │ │ ◐ True/False │ │ # Numerical  │  …grid   │  ← TypeTile cards (e1)
│  │ Single answer│ │ Multi answer │ │ Binary       │ │ Number+tol.  │         │
│  │ [Auto] badge │ │ [Auto]       │ │ [Auto]       │ │ [Auto]       │         │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
│  …fill-blanks · fill-blanks-dd · matching · jumbled · group-options           │
│                                                                                 │
│  QUESTIONS · AI-graded              ← second section                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                           │
│  │ ¶ Paragraph  │ │ {} Code      │ │ ♪ Audio      │  text · image_evaluation  │
│  │ Essay, AI    │ │ Run tests+AI │ │ Spoken, AI   │  · chat_agent_question    │
│  │ [AI ✦]       │ │ [Auto+AI]    │ │ [AI ✦]       │                           │
│  └──────────────┘ └──────────────┘ └──────────────┘                           │
│                                                                                 │
│  ┌─ Inline banner ─────────────────────────────────────────────────────────┐ │
│  │ 📚 Reuse a question you've already written — Pick from question bank →    │ │  ← links to question-bank-import
│  └─────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Grid (responsive):**

- **lg (≥1024):** dialog `max-w 880`; tile grid 4 columns, `gap 4 (16px)`.
- **md (768–1023):** 3 columns; dialog `max-w ~720`.
- **sm (<768):** full-screen **Sheet**; tiles collapse to a **single-column
  stacked list** (icon + label + description + grading badge inline), search
  pinned to the top, segmented top-level control becomes a horizontally
  scrollable Chip row. Touch targets ≥44px.

When only one top-level type is relevant (the common "Add Item" flow seeds
Question by default), **Step 1 is hidden** and the grid shows question subtypes
immediately, with a quiet "Switch to Material" affordance.

---

## 4. Components used (from §5)

- **Modal/Dialog** — the container; **Drawer/Sheet** on mobile.
- **Input / Combobox** — the search field (filters across label + description +
  keywords).
- **Tabs** or segmented **Chip/Tag** row — Step-1 top-level `ItemType` switch.
- **Section** — the grouping headers (Auto-graded / AI-graded / Materials).
- **Card** (`TypeTile` usage) — each selectable type. Anatomy: leading lucide
  icon, **Schibsted Grotesk** label (text-base/medium), one-line description
  (text.secondary, text-sm), and a **Badge** grading chip.
- **Badge** (pill radius) — grading-mode indicator: `Auto` (status.success /
  green), `AI ✦` (brand.primary indigo + spark glyph), `Auto + AI` for `code`.
  Always **icon + label**, never color alone (FOUNDATION §2 contrast rule).
- **InlineAlert/Banner** — the "Pick from question bank" entry point.
- **EmptyState** — search returns nothing.
- **Button** (ghost/secondary) — Cancel; the question-bank link is a
  Button(ghost) inside the banner.
- **Tooltip** — optional, on a tile's grading badge to explain "graded
  instantly" vs "scored by AI, may take a moment".

**Proposed addition (justify):** **`TypeTile`** — a thin, named composition of
Card + icon + Badge specialized for type-selection galleries. It is reused by
`question-bank-import.md` filters and the exam-question type picker
(`assessment-config.md`), so promoting it to a named domain pattern (in the
family of `SpaceCard`) avoids three divergent ad-hoc cards. Add to §5 domain
inventory.

---

## 5. States

- **Default / success:** full gallery rendered; first tile in reading order is
  focusable. The 15 question types map exactly to `QUESTION_TYPES` and the 7
  materials to `MATERIAL_TYPES` in `ItemEditor.tsx`; grading badges derive from
  `AUTO_EVALUATABLE_TYPES` / `AI_EVALUATABLE_TYPES` in `content/item.ts`.
- **Loading:** the picker has no fetch of its own, so it opens instantly. If
  section metadata (for the downstream editor) is still loading, the gallery is
  fully usable; only the eventual editor shows the **Skeleton**. No skeleton
  needed here.
- **Empty (search):** "No types match '<query>'." **EmptyState** with Fraunces
  title, a "Clear search" Button(ghost), and a hint listing the closest matches.
- **Error:** the only error path is the question-bank handoff failing to open —
  surfaced as a **Toast** (sonner) "Couldn't open the question bank. Try again."
  The picker stays open.
- **Partial:** if a tenant feature flag disables a subtype family (e.g.
  `chat_agent_question` requires an agent configured on the space), that tile is
  **disabled** with a Tooltip "Configure an agent in the Agent Config tab first"
  — mirroring the in-editor `ChatAgentEditor` guidance copy.
- **Permission-gated by role:** `teacher` and `tenantAdmin` see identical
  galleries (both can author). If a non-author role ever reaches this route,
  render nothing and bounce — content authoring is staff-only; **students never
  see item internals or answer keys** (domain rule §8).

---

## 6. Interactions & motion

- **Open:** dialog enters with overlay fade + content scale/translate using
  **motion `base` (220ms) / `ease.entrance`**; respects `prefers-reduced-motion`
  (fade only). Focus moves to the search field.
- **Search:** filters tiles live (no debounce needed — purely client-side over
  ~22 entries). Matching is over label + one-line description + a small synonym
  list (e.g. "essay"→paragraph, "ordering"→jumbled, "drag"→jumbled/matching).
- **Top-level switch:** changing Step-1 segment cross-fades the grid (motion
  `fast` 160ms); does not reset search.
- **Tile hover/press:** rest **e1** → hover lifts to **e2** with a `fast`
  transition; border shifts to **border.focus**. On mobile, hover→**press**
  (active scale 0.98, `instant` 100ms).
- **Select a type (commit):** clicking a tile **immediately** closes the picker
  and opens `item-editor.md` with a draft `UnifiedItem` whose `payload` is
  seeded —
  `{ questionType, content: '', questionData: defaultQuestionData(qt) }` for
  questions, `{ materialType }` for materials. No confirm step; this is a cheap,
  reversible action (the editor itself is the commit point via `saveItem`). The
  transition is a `page` (420ms) forward push so authors feel they've stepped
  deeper, not jumped sideways.
- **Pick from question bank:** the banner link closes the picker and routes to
  `question-bank-import.md` (handoff, not editor).
- **No optimistic writes** — nothing is persisted in this surface, so there is
  nothing to roll back.
- **Cancel/dismiss:** Esc, overlay click, or Cancel closes with `ease.exit` (no
  confirm — no unsaved state exists yet).

---

## 7. Content & copy

Tone: **precise and efficient** (staff-facing), with light helpfulness — not
gamified.

- **Header:** "Add an item"
- **Subhead:** "Choose what you want to create. You can change the details on
  the next step."
- **Search placeholder:** "Search types — e.g. essay, code, video…"
- **Section labels:** "Questions · Auto-graded", "Questions · AI-graded",
  "Materials".
- **Grading badges:** `Auto` · `AI` (with ✦) · `Auto + AI` (for `code`).
- **Question one-liners (exact intent):**
  - MCQ — "One correct answer from a list."
  - MCAQ — "Several correct answers; set min/max."
  - True / False — "A single binary choice."
  - Numerical — "A number, with optional tolerance and unit."
  - Short Text — "A short exact answer; accepts alternatives."
  - Paragraph — "An open essay, scored by AI against your guidance."
  - Code — "Code run against test cases, plus AI review."
  - Fill in the Blanks — "Type the missing words."
  - Fill Blanks (Dropdown) — "Pick the missing words from menus."
  - Matching — "Match items in the left column to the right."
  - Jumbled / Ordering — "Put shuffled items in the correct order."
  - Audio Response — "A spoken answer, transcribed and AI-scored."
  - Image Evaluation — "Learner uploads images; AI evaluates them."
  - Group Options — "Sort items into the correct groups."
  - Chat Agent — "A guided conversation against your objectives."
- **Material one-liners:** Text — "Plain written content." · Video — "Embed a
  video by URL." · PDF — "Link a PDF, optionally downloadable." · Link — "An
  external resource." · Interactive — "Embed a tool or simulation." · Story —
  "Long-form narrative with blocks." · Rich Content — "Structured article with
  media blocks."
- **Question-bank banner:** "Reuse a question you've already written — **Pick
  from question bank →**"
- **Empty state:** title "Nothing matches '<query>'", body "Try a broader word,
  or browse all types.", action "Clear search".
- **Disabled-tile tooltip (chat agent):** "Configure an agent in the Agent
  Config tab on this space first."

---

## 8. Domain rules surfaced

- **22 authorable subtypes, fixed sets.** Questions = the 15 `QuestionType`
  members; materials = the 7 `MaterialType` members (`content/item.ts`). The
  picker must never offer a type the editor can't render.
- **Grading mode is a real backend partition.** `AUTO_EVALUATABLE_TYPES`
  (`mcq, mcaq, true-false, numerical, fill-blanks, fill-blanks-dd, matching, jumbled, group-options`)
  are scored deterministically server-side; `AI_EVALUATABLE_TYPES`
  (`text, paragraph, code, audio, image_evaluation, chat_agent_question`) route
  through AI evaluation (confidence-routed review downstream). `code` is the
  dual case — deterministic test-case execution **plus** AI review — and is the
  only tile that earns the "Auto + AI" badge. This distinction is load-bearing
  for cost, latency, and the grading-review queue, so it is surfaced **before**
  authoring, not after.
- **Defaults are typed.** Choosing a question type seeds
  `defaultQuestionData(qt)` so the editor opens valid-by-construction (e.g.
  `numerical` → `{ correctAnswer: 0, tolerance: 0 }`); choosing a material seeds
  `{ materialType }`. The picker must use these exact factories so validation
  (`validateItem`) behaves identically to the in-editor path.
- **Answer keys are server-only.** The picker never touches answer-key fields.
  For test / `timed_test` StoryPoints the editor later re-merges keys via
  `getItemForEdit`; the picker stays out of that path entirely (no key data is
  ever in the picker's memory).
- **Tenant isolation.** All downstream writes (`saveItem`, `importFromBank`) are
  scoped to `tenantId` + `spaceId` + `storyPointId`; the picker carries these
  IDs through to the editor unchanged.
- **Authoring is staff-only.** Only `teacher` / `tenantAdmin` reach this
  surface; students never see type internals.

---

## 9. Accessibility

- **Dialog semantics:** `role="dialog"` `aria-modal="true"`, labelled by the
  "Add an item" heading. Focus is trapped; on open focus lands on the search
  input; on close focus returns to the triggering "Add Item" button.
- **Focus order:** close button → search → top-level segmented control → tiles
  in reading order (DOM order = visual order) → question-bank banner → Cancel.
- **Tile semantics:** each `TypeTile` is a `role="button"` (or native
  `<button>`) with an accessible name combining label + grading mode, e.g.
  "Paragraph, AI-graded question". Grading is conveyed by **badge text + icon**,
  never color alone.
- **Keyboard:** Arrow keys move within the tile grid (roving tabindex);
  Enter/Space selects; Esc closes; `/` or Cmd/Ctrl+F focuses search (no global
  ⌘K dependency). Type-ahead in the grid jumps to the first tile whose label
  starts with the typed letters.
- **Contrast:** all tile text/badges meet **WCAG AA** (4.5:1 body, 3:1 UI) per
  the foundation palette; disabled tiles keep ≥3:1 and add the explanatory
  tooltip so state isn't color-only.
- **Reduced motion:** `prefers-reduced-motion` disables the scale/lift
  transitions — fade only.

---

## 10. Web↔mobile divergence

- **Container:** web = centered **Modal** (e3); mobile (React Native /
  `ui-native`) = full-height **Sheet** sliding from the bottom.
- **Layout:** web = 4/3-column **tile grid**; mobile = **single-column stacked
  list** (icon + label + description + grading badge per row) — the §6
  "table→cards" analogue applied to the gallery.
- **Top-level switch:** web = segmented Tabs/Chips; mobile = horizontally
  scrollable Chip row.
- **Hover→press:** web tiles lift on hover (e1→e2); mobile tiles use a
  press/active state (scale 0.98) — no hover.
- **No ⌘K / command palette on mobile**; search is the in-sheet Input.
  Type-ahead grid navigation is web-only; mobile relies on scroll + search.
- **Motion:** web uses `ease.entrance/exit` curves; mobile uses the Reanimated
  spring for the sheet, standard easing for content. Component **names and props
  match 1:1** across `shared-ui` and `ui-native`; only the renderer differs.

---

## 11. Claude-design prompt

```
Design the "Add Item — Type Picker" modal for the Auto-LevelUp teacher portal,
strictly following the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md).
Use ONLY Lyceum tokens and components — do not invent colors, fonts, or variants.

CONTEXT
A teacher clicks "Add Item" on a StoryPoint's Content tab. Before opening the item
editor, they pick WHAT to author. This modal is a grouped, searchable gallery of
content types. Authors are staff (teacher / tenantAdmin); students never see it.

TYPES TO SHOW (exact)
- 15 question subtypes: mcq, mcaq, true-false, numerical, text, paragraph, code,
  fill-blanks, fill-blanks-dd, matching, jumbled, audio, image_evaluation,
  group-options, chat_agent_question.
- 7 material subtypes: text, video, pdf, link, interactive, story, rich.
- Group questions into "Auto-graded" (mcq, mcaq, true-false, numerical, fill-blanks,
  fill-blanks-dd, matching, jumbled, group-options) and "AI-graded" (text, paragraph,
  code, audio, image_evaluation, chat_agent_question). `code` shows an "Auto + AI" badge.

LAYOUT
- Lyceum Modal/Dialog at elevation e3, max-w ~880, radius lg, warm paper surface.
- Header "Add an item" in Fraunces (text-xl); subhead in Schibsted Grotesk
  (text.secondary). A sticky search Input ("Search types — e.g. essay, code, video…").
- Optional top-level segmented control (Question / Material) using pill-radius Chips.
- Section headers (Schibsted sm, text.muted). Below each, a responsive grid of TypeTile
  cards: lg=4 cols, md=3 cols, sm=single-column stacked list. gap 16.
- Each TypeTile: leading lucide icon, label (Schibsted base/medium), one-line
  description (text.secondary, text-sm), and a grading Badge (pill): "Auto" in
  status.success green, "AI ✦" in brand.primary indigo, "Auto + AI" for code.
  Convey grading by icon + text, never color alone.
- An InlineAlert banner near the bottom: "Reuse a question you've already written —
  Pick from question bank →" (ghost Button link).

STATES
- Default gallery; search empty-state ("Nothing matches '<query>'" with Clear search);
  one disabled tile (chat_agent_question) with tooltip "Configure an agent first".

INTERACTION & MOTION (Lyceum §4)
- Modal enters with overlay fade + scale, motion base 220ms / ease.entrance.
- Tile rest e1 → hover e2 (fast 160ms), border → border.focus.
- Selecting a tile closes the modal and forward-pushes into the item editor (page 420ms).
- Respect prefers-reduced-motion (fade only).

ACCESSIBILITY
- role="dialog" aria-modal, focus trap, focus starts on search, returns to trigger on
  close. Tiles are buttons with names like "Paragraph, AI-graded question". Arrow-key
  grid navigation, Enter selects, Esc closes. WCAG AA contrast throughout.

Render the desktop modal and the mobile bottom-Sheet (single-column list) variant.
Tone: precise, efficient, staff-facing — NOT gamified. No SaaS-blue #3B82F6, no
Inter/Roboto, no glass morphism.
```
