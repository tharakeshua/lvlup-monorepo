# Item Editor (15 question + 7 material types) — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All colors, type, spacing,
> radius, elevation, motion, and components are cited by token/name — never
> re-defined here. Grounded in
> `apps/teacher-web/src/components/spaces/ItemEditor.tsx` (~2736 lines) and
> `packages/shared-types/src/content/item.ts`.

---

## 1. Purpose & primary user

**Primary user:** `teacher` (content author) and `tenantAdmin` (curriculum
owner) inside the Spaces authoring flow.

**Job-to-be-done:** "Author or revise one content atom — a question, a material,
or another item type — with the _right_ per-type configuration (options, test
cases, blanks, pairs, rubric) so it validates, saves, and behaves correctly for
students, without ever leaking an answer key on a timed test."

This is the **polymorphic content authoring surface**. A single `UnifiedItem`
(`item.ts` §UnifiedItem) is the atom; the editor dispatches over `ItemType`
(`question · material · interactive · assessment · discussion · project · checkpoint`)
and, for questions, over 15 `QuestionType`s and, for materials, 7
`MaterialType`s. Each subtype has a sub-editor for its `questionData` / material
payload, but they share one chrome: title, content (single `ContentRenderer`),
classification (difficulty / Bloom's / topics / labels / section), attachments,
validation, autosave.

---

## 2. Entry points & route

**Entry:** opened as a **Drawer/Sheet** (right-side panel) from the **Content
tab** of `SpaceEditorPage` (`/spaces/:spaceId/edit` → Content). Triggered by
"Add item" on a `StoryPointNode`/section or by clicking an existing item row.
Not a standalone route — it is a panel over the Space editor, so deep links
resolve to `?item=:itemId` on the editor route.

**Common-API reads/writes** (cite `specs/common-api.md`):

- **Write — `v1.levelup.saveItem`** (`rateTier: write`): create / update /
  delete the item. Server **strips answer keys into the server-only
  subcollection** on save (§3.3 levelup). Wired through the `onSave` /
  `onAutoSave` props the panel receives.
- **Read — `v1.levelup.getItemForEdit`** (`callGetItemForEdit`): for
  `timed_test` / `test` story points, **re-merges the stripped answer key** back
  into the payload so the editor edits real values rather than silently
  overwriting the key with blanks (P0-1).
- **Media:** `uploadItemMedia` / `deleteItemMedia` (Storage) for `attachments`
  (image / pdf / audio).
- Surrounding reads (`v1.levelup.listItems`, `getSpace`, `listStoryPoints`)
  belong to the parent Space editor, not this panel.

---

## 3. Layout — wireframe-as-text

Rendered inside the AppShell (Sidebar + Topbar) Space-editor route; the editor
itself is a **Drawer/Sheet** (§5 Containers, `e3` elevation, `bg.surface`).
Internal layout is a single scrolling column, reading-measure capped (~720, per
§4), with a sticky header and sticky footer action bar.

```
┌─ Drawer (right sheet, bg.surface, radius lg, e3) ───────────────┐
│ HEADER (sticky)                                                 │
│  [‹ back IconButton]  Edit Question        [● Saved  badge]     │  ← save-status chip
├────────────────────────────────────────────────────────────────┤
│ ⚠ Timed-test answer-key banner (conditional InlineAlert)        │
│ ⚠ Validation summary (InlineAlert, status.error)                │
│                                                                 │
│ ── SHARED FIELDS ──                                             │
│  Title*            [Input]                                       │
│  Type              [Select: question/material/…]  (locked once  │
│                     created — `type` is read-only state)         │
│  Question type     [Select: 15 types]   ← only when question    │
│  Difficulty        [Select: easy/medium/hard]                   │
│  Content           [ContentRenderer editor — md + KaTeX]        │
│                                                                 │
│ ── PER-TYPE SUB-EDITOR (registry-dispatched) ──                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  <QuestionCard authoring view> | <Material sub-editor>    │  │
│  │  options / test cases / blanks / pairs / groups / blocks │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ── CLASSIFICATION (collapsible Section) ──                      │
│  Base points [Input·mono]   Section [Select]                    │
│  Bloom's level [Select]                                         │
│  Topics  [Chip/Tag combobox]   Labels [Chip/Tag combobox]       │
│                                                                 │
│ ── ATTACHMENTS ──                                               │
│  [FileDrop]   UploadQueueItem · UploadQueueItem (image/pdf/aud) │
├────────────────────────────────────────────────────────────────┤
│ FOOTER (sticky)   [Cancel]            [Save  ⌘/Ctrl+Enter]      │
└────────────────────────────────────────────────────────────────┘
```

**Responsive:**

- **lg (≥1024):** drawer ~560–640px wide overlay; parent Space editor remains
  visible beneath the scrim.
- **md (768–1023):** drawer expands to ~75vw; classification Section collapsed
  by default.
- **sm (<768):** full-screen Sheet (bottom-up on mobile parity); footer action
  bar pinned; per-type sub-editors stack to one column; drag handles become
  press-and-hold.

---

## 4. Components used (§5 only)

- **Containers:** Drawer/Sheet (host), Section + Accordion (classification,
  advanced per-type opts), Tabs only if a sub-editor needs Preview/Edit split.
- **Primitives:** Input, Textarea, Select, Combobox (topics/labels), Switch
  (`shuffleOptions`, `caseSensitive`, `downloadable`, `isHidden`),
  Checkbox/Radio (correct-answer marking), Slider/Input·mono (tolerance,
  maxTurns, timeoutMs), FileDrop (attachments), Button (primary Save, ghost
  Cancel/back IconButton).
- **Data / feedback:** Badge (save-status chip), Chip/Tag (topics, labels),
  EmptyState (sub-editor with zero options/blanks), Skeleton (loading merged
  payload), InlineAlert/Banner (validation summary + answer-key warning),
  Toast/sonner (save / upload outcomes), ConfirmDialog (close-with-unsaved,
  destructive question-type change), FormFieldError (per-field inline).
- **Domain components:**
  - **`ContentRenderer`** — the **single** markdown + KaTeX surface for
    `content` (webapps-design §2.3: retire the TipTap/HTML split; one renderer
    for authoring preview and student view).
  - **`QuestionCard`** — drives the per-type **registry dispatch** in authoring
    mode.
  - **`AnswerInput`** — the per-type answer-config primitive (the authoring twin
    of the student answer surface).
  - **`AnswerKeyLock`** — the server-only-guard visual shown when a timed-test
    key is protected.
  - **`RubricBreakdown`** — surfaced read-only when an item-level `rubric`
    overrides the story-point default (AI-graded types).
  - `StoryPointNode` context chip in the header crumb (which node this item
    lives under).

**Proposed addition (justified):** a **`PerTypeEditorRegistry`** — a thin map
`QuestionType | MaterialType → sub-editor component`. It is **composition glue,
not a new visual primitive**: every sub-editor is built from the §5 primitives
above. Register it under §5 domain components so all 22 sub-editors share one
dispatch contract (`{ data, onChange, errors }`) and the same registry powers
`QuestionCard`'s student render. **No per-type bespoke UI is invented** beyond
the input shapes enumerated in §8.

---

## 5. States

**Loading (timed-test merge):** while `callGetItemForEdit` is in flight, the
per-type sub-editor shows a **Skeleton** (option/blank rows) and an
`AnswerKeyLock` placeholder; shared fields are editable immediately. Header chip
reads `Saved`.

**Empty (new item):** `type` defaults from the add action; question defaults to
`mcq` with `defaultQuestionData` (empty options). Sub-editor shows an
**EmptyState** ("No options yet — add at least 2") with a primary "Add option"
Button.

**Error:**

- **Validation:** `validateItem()` returns a message array → an **InlineAlert**
  summary (`status.error`) lists every blocker; **FormFieldError** marks the
  offending field; Save is `disabled` (`disabled={saving || !isValid}`).
- **Save/upload failure:** sonner **Toast** error (`Auto-save failed: …`);
  status chip returns to `Unsaved changes`; no data loss.
- **Merge failure:** if `getItemForEdit` rejects, fall back to the stripped
  payload **plus** the answer-key warning banner (best-effort, never blocks
  editing).

**Partial:** `saveStatus` chip is the partial-state indicator — `Saved`
(`status.success`), `Saving…` (`status.warning`), `Unsaved changes`
(`spark`/marigold-tinted). Autosave is **dropped while invalid** and while a
save is in flight (`autoSaveInFlightRef`).

**Success:** manual Save closes the sheet via `onSave`; autosave keeps it open
and flips the chip to `Saved`.

**Permission-gated variations:**

- `teacher` / `tenantAdmin`: full editor.
- On a **timed_test / test** story point: the answer-key fields are
  server-merged read-back; if the merge is unavailable the `AnswerKeyLock`
  visual replaces editable correct-answer controls and the banner warns before
  any overwrite.
- Viewer/observer roles never reach this panel (gated upstream by the Space
  editor route).

---

## 6. Interactions & motion

- **Open/close:** Drawer slides in on `ease.entrance` at `base` (220ms); exit on
  `ease.exit`. `prefers-reduced-motion` → opacity-only.
- **Autosave:** 2s debounce after the last edit (`setTimeout(…, 2000)`);
  validity-gated and in-flight-guarded. Chip transitions
  `Unsaved changes → Saving… → Saved` use `fast` (160ms) color/opacity, never
  layout shift.
- **Save shortcut:** **⌘/Ctrl+Enter** triggers `handleSave` (preventing
  default); manual Save clears the pending autosave timer first.
- **Optimistic feel:** attachments append to the list immediately on
  upload-resolve via `UploadQueueItem`; correct-answer toggles update inline
  with no round-trip until the debounce fires.
- **Destructive confirms (ConfirmDialog):**
  - **Close with unsaved changes** → "You have unsaved changes. Are you sure you
    want to close?"
  - **Change question type with configured data** → "Changing question type will
    reset the question's configuration. Continue?" (compares against
    `defaultQuestionData`).
- **Drag-reorder:** options / blanks / jumbled items / blocks reorder via
  dnd-kit; drop settles on `ease.standard` `fast`; keyboard sensor supported
  (see §9).
- **Celebration:** none — authoring stays calm; the one celebratory marigold
  spring moment (§4) is reserved for the _student_ learning surface, not this
  staff tool.

---

## 7. Content & copy

Tone: **precise, instructional** (staff register — not the encouraging student
voice).

- **Header:** `Edit Question` / `Edit Material` (verb adapts to `isQuestion`).
- **Status chip:** `Saved` · `Saving…` · `Unsaved changes`.
- **Field labels:** `Title`, `Question type`, `Difficulty`, `Content`,
  `Base points`, `Section`, `Bloom's level`, `Topics`, `Labels`, `Attachments`.
- **Answer-key banner (timed_test):** "This is a timed-test question. The
  correct answer is stored in protected server storage and is shown here only
  for editing — it is never sent to students."
- **Validation samples (verbatim from `validateItem`):** "Title is required" ·
  "Add at least 2 options" · "Mark at least one option correct" · "Add at least
  one test case" · "All blanks need a correct answer" · "Assign every item to a
  group" · "A valid http(s) URL is required".
- **Empty sub-editor:** "No options yet — add at least 2." / "No test cases yet
  — add at least one."
- **Save outcomes:** "Files uploaded" · "Attachment removed" · "Auto-save
  failed: {message}".
- **Footer hint:** "⌘/Ctrl+Enter to save".

---

## 8. Domain rules surfaced

Grounded in `item.ts` and `ItemEditor.tsx`:

1. **Answer keys never reach students.** `saveItem` strips correct-answer fields
   into a **server-only subcollection** (common-api §3.3). The editor only
   re-hydrates them via `getItemForEdit` for `timed_test`/`test` story points.
   The client-side `answerKeyLooksStripped()` guard detects a probable stripped
   key (e.g. MCQ with every `isCorrect:false`) and raises the banner **before**
   the teacher overwrites it with blanks (P0-1).
2. **Auto- vs AI-evaluatable split** (`item.ts`): `AUTO_EVALUATABLE_TYPES` =
   mcq, mcaq, true-false, numerical, fill-blanks, fill-blanks-dd, matching,
   jumbled, group-options → must carry a concrete key. `AI_EVALUATABLE_TYPES` =
   text, paragraph, code, audio, image_evaluation, chat_agent_question → carry
   `evaluationGuidance` / `modelAnswer` / objectives instead of a deterministic
   key.
3. **Per-type validation gates Save** (`validateItem`): Save is disabled until
   the type-specific invariants pass.
4. **Content mirroring:** on save the top-level `content` is mirrored into
   `qPayload.content` exactly (no `||` fallback) so server and student views
   stay in sync (P1-21).
5. **Bloom's mirrors into `meta`:** `bloomsLevel` is written to
   `item.meta.bloomsLevel` and _removed_ from meta when cleared.
6. **`type` is immutable post-create** (state has no setter); only the _subtype_
   (questionType/materialType) is changeable, and changing it resets
   `questionData` to `defaultQuestionData`.
7. **Tenant isolation:** `tenantId` is derived server-side from the
   active-tenant claim (common-api §3.3); `getItemForEdit` is scoped by
   `{ tenantId, spaceId, storyPointId, itemId }`.

**Input shape each subtype needs** (registry contract — `questionData` per
`item.ts`):

| Subtype                           | Required authoring inputs                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `mcq`                             | `options[] {text, isCorrect, explanation?}`, exactly-one-correct, `shuffleOptions`                                                 |
| `mcaq`                            | same options, ≥1 correct, `minSelections`/`maxSelections`                                                                          |
| `true-false`                      | `correctAnswer:boolean`, `explanation?`                                                                                            |
| `numerical`                       | `correctAnswer:number`, `tolerance≥0`, `unit?`, `decimalPlaces?`                                                                   |
| `text`                            | `correctAnswer` and/or `acceptableAnswers[]`, `caseSensitive`, `maxLength`                                                         |
| `paragraph`                       | `modelAnswer?`, `evaluationGuidance?`, `min/maxLength` (AI-graded)                                                                 |
| `code`                            | `language`, `starterCode?`, `testCases[] {input, expectedOutput, isHidden?, points?}`, `timeoutMs>0`, `memoryLimitMb>0`            |
| `fill-blanks`                     | `textWithBlanks`, `blanks[] {correctAnswer, acceptableAnswers?, caseSensitive}`                                                    |
| `fill-blanks-dd`                  | `textWithBlanks`, `blanks[] {options[], correctOptionId}`                                                                          |
| `matching`                        | `pairs[] {left, right}`, `shufflePairs`                                                                                            |
| `jumbled`                         | `items[] {text}` (≥2), derived `correctOrder[]`                                                                                    |
| `audio`                           | `maxDurationSeconds>0`, `language`, `evaluationGuidance?` (AI-graded)                                                              |
| `image_evaluation`                | `instructions`, `maxImages≥1`, `evaluationGuidance?` (AI-graded)                                                                   |
| `group-options`                   | `groups[] {name, correctItems[]}` (≥2), `items[]` (≥2), every item assigned                                                        |
| `chat_agent_question`             | `objectives[]` (≥1), `conversationStarters?`, `maxTurns≥1`, `agentId?` (AI-graded)                                                 |
| **Material** `text`               | `content` (md)                                                                                                                     |
| **Material** `video`/`pdf`/`link` | valid http(s) `url`, `duration?`, `downloadable?`                                                                                  |
| **Material** `interactive`        | valid embed `url`                                                                                                                  |
| **Material** `story`/`rich`       | `content` md and/or `richContent.blocks[]` (RichContentBlock builder: heading/paragraph/image/video/audio/code/quote/list/divider) |

---

## 9. Accessibility

- **Focus order:** back IconButton → Title → Type selects → Content → per-type
  sub-editor controls (top-to-bottom, including dynamically added option/blank
  rows) → classification → attachments → Cancel → Save. New rows receive focus
  on add; removed rows return focus to the add button.
- **Keyboard:** all Selects/Comboboxes are arrow-navigable; ⌘/Ctrl+Enter saves;
  Esc cancels (via ConfirmDialog when dirty). Drag-reorder is fully
  keyboard-operable via dnd-kit's `KeyboardSensor` +
  `sortableKeyboardCoordinates` (grab with Space, move with arrows).
- **ARIA:** invalid URL fields set `aria-invalid`; the validation InlineAlert
  uses `role="status"`/`aria-live="polite"`; the save chip is announced politely
  on transition; each FormFieldError is linked via `aria-describedby`; drag
  handles carry `aria-label` and `aria-roledescription="sortable"`.
- **Contrast:** status chips and `status.error`/`status.success`/`spark` text
  meet WCAG AA (4.5:1 body, 3:1 UI). **Never status-by-color-alone** (§2.4) —
  chip pairs an icon + text label; correct-answer marking uses a checkmark icon,
  not green fill alone.
- **Reduced motion:** drawer and chip transitions degrade to opacity/instant
  under `prefers-reduced-motion`.

---

## 10. Web ↔ mobile divergence

Component names/props match 1:1 across `shared-ui` and `ui-native` (§6); only
renderers differ.

- **Container:** web right-side **Drawer**; mobile bottom **Sheet**,
  full-height, with a grab handle.
- **Save shortcut:** **⌘/Ctrl+Enter exists on web only.** Mobile relies on the
  pinned footer Save button; autosave (2s debounce) is the safety net.
- **Drag-reorder:** hover affordance on web → **press-and-hold** on mobile; both
  keep the dnd-kit keyboard path on web.
- **Attachments:** web FileDrop (drag-in) → mobile system file/photo/audio
  picker via `UploadQueueItem`.
- **Dense per-type grids** (test-case tables, group/item matrices) reflow from
  side-by-side columns → **stacked cards** on `sm`.
- **ContentRenderer** authoring uses the same md+KaTeX engine on both; mobile
  shows an Edit/Preview Tabs toggle since there's no room for live side-by-side.
- No CommandPalette/⌘K on mobile.

---

## 11. Claude-design prompt

```
Design the "Item Editor" drawer for the Auto-LevelUp teacher web app, strictly following the
Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md). Modern Scholarly direction:
warm paper neutrals (bg.canvas/bg.surface), deep indigo brand.primary, marigold "spark" reserved
for energy only, Fraunces for the header (text-xl), Schibsted Grotesk for labels/body, Spline Sans
Mono for numeric inputs (base points, tolerance, timeouts). NO Inter/Roboto, NO #3B82F6 SaaS blue,
NO glass morphism.

Build it as a right-side Drawer/Sheet (e3 elevation, radius lg) over a Space editor. It authors ONE
polymorphic UnifiedItem and dispatches over item type. Show the QUESTION variant with the questionType
Select offering all 15 types (mcq, mcaq, true-false, numerical, text, paragraph, code, fill-blanks,
fill-blanks-dd, matching, jumbled, audio, image_evaluation, group-options, chat_agent_question), and
render the MCQ sub-editor: a draggable options list (text + "mark correct" radio + optional
explanation), a "shuffle options" Switch, and an "Add option" button. Treat sub-editors as a
PerTypeEditorRegistry — same contract { data, onChange, errors } — composed only from Lyceum primitives.

Sticky header: back IconButton, "Edit Question" (Fraunces), and a save-status Badge cycling
Saved / Saving… / Unsaved changes (success/warning/spark tints, icon+label, never color alone).
Shared fields: Title, Difficulty Select, a single ContentRenderer (markdown + KaTeX) for content.
A collapsible "Classification" Section: Base points (mono Input), Section Select, Bloom's level Select,
Topics + Labels Chip/Tag comboboxes. An Attachments FileDrop with UploadQueueItem rows.

States to show: a validation InlineAlert (status.error) listing blockers with the Save button disabled,
and a conditional timed-test answer-key warning banner with an AnswerKeyLock visual. Sticky footer:
ghost Cancel + primary Save with a "⌘/Ctrl+Enter to save" hint. Motion: drawer in on ease.entrance/base,
chip transitions on fast, respect prefers-reduced-motion. WCAG AA contrast; full keyboard + dnd-kit
keyboard reorder. Responsive: full-screen Sheet on mobile, no ⌘K, footer Save pinned.
```
