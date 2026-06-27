# Audit: Question Creation & Editing Flows — Teacher Portal

**Scope:** All 15 question types + 7 material types in the space editor. **Files
audited:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` (1469 lines)
- `apps/teacher-web/src/components/spaces/ItemEditor.tsx` (1720 lines)
- `apps/teacher-web/src/components/spaces/StoryPointEditor.tsx` (576 lines)
- `functions/levelup/src/callable/save-item.ts` (262 lines)
- `functions/levelup/src/callable/create-item.ts` (172 lines, answer-key
  extraction utilities)
- `packages/shared-types/src/schemas/callable-schemas.ts`
  (`SaveItemRequestSchema`)
- `packages/shared-types/src/content/item.ts` (canonical types)

**Question types covered:** mcq, mcaq, true-false, numerical, text, paragraph,
code, fill-blanks, fill-blanks-dd, matching, jumbled, audio, image_evaluation,
group-options, chat_agent_question. **Material types covered:** text, video,
pdf, link, interactive, story, rich.

---

## P0 — Critical (data-loss / fundamentally broken behavior)

### P0-1. Editing items in `timed_test` story points DESTROYS the answer key

The server-side `saveItem` callable strips answer info from `payload` and stores
it in a server-only `answerKeys/{itemId}` subcollection for `timed_test`/`test`
story points (`save-item.ts:130-149`, `create-item.ts:106-171`). The teacher
portal **never reads** that subcollection, so when `ItemEditor` opens an
existing timed-test question (`ItemEditor.tsx:129` — `useState(item.payload)`),
the displayed payload has `options[].isCorrect = undefined`,
`correctAnswer = undefined`, `correctOrder = undefined`, `pairs[].right`
(mappings) erased, etc.

When the teacher saves, `extractAnswerKey` (`create-item.ts:33-100`) computes a
NEW answer key from the empty data and overwrites the existing answer key
(`save-item.ts:236-247`). **Net effect: a single edit click on a timed-test
question silently deletes the correct answer.** Affects: mcq, mcaq, true-false,
numerical, text, fill-blanks, fill-blanks-dd, matching, jumbled, group-options.

**Fix:** Need a server callable like `getItemForEdit` that merges
`payload + answerKeys` and returns the unified payload to the teacher; or stop
stripping for teacher reads (use security rules to scope answer-key reads to
teacher role). The current architecture has no path to safely edit timed-test
items.

### P0-2. Auto-save closes the editor sheet on every fire

`performAutoSave` (`ItemEditor.tsx:171-189`) calls `onSave`, which is
`handleSaveItem` in `SpaceEditorPage.tsx:759-790`. `handleSaveItem`
unconditionally runs `setEditingItem(null); setEditingItemSPId(null)` after
every successful save (lines 784-785), including the autosave debounce (2s after
last edit, `ItemEditor.tsx:159`). **Effect:** while editing any item, the sheet
slams shut every 2 seconds. Teachers cannot continue typing after the first idle
pause.

**Fix:** Split `onSave` into `onAutoSave` (no sheet close) and `onManualSave`
(close on success); or move the `setEditingItem(null)` call into the manual
`handleSave` path only.

### P0-3. `Cmd/Ctrl+Enter` closes editor without saving

`SpaceEditorPage.tsx:459-463` — `Cmd+Enter` runs `setEditingItem(null)`
directly. No save call, no unsaved-changes confirm. If the user typed faster
than the 2-second autosave debounce, the latest edits are lost. Industry
convention is "Cmd+Enter to save."

**Fix:** Trigger `handleSave()` via a ref forwarded from `ItemEditor`, or remove
the shortcut.

### P0-4. No client-side validation; Save button is always enabled

`ItemEditor.tsx:499-507` — Save button has no disabled guard. Empty/invalid
items can be saved cleanly:

- MCQ/MCAQ with zero options or no `isCorrect: true`
- Numerical defaulting to `correctAnswer: 0` because `defaultQuestionData` seeds
  it (line 96)
- True/false silently defaults to `true` (line 94) — teacher who never clicks
  the radios saves "true"
- `image_evaluation.instructions` is non-optional in the type (`item.ts:177`)
  but editor allows empty save
- `chat_agent_question.objectives` non-optional, can be saved empty
- Code with zero test cases
- Fill-blanks with no blanks defined
- Empty title (StoryPointEditor guards `!title.trim()`, ItemEditor does not)
- Material with no URL / empty content

**Fix:** Implement per-type validators called before `onSave`; disable Save and
show inline errors when invalid.

### P0-5. Server schema accepts arbitrary garbage payloads

`SaveItemRequestSchema` defines
`payload: z.record(z.string(), z.unknown()).optional()`
(`callable-schemas.ts:469`). There is no validation that `questionType` is one
of the 15 allowed values, that `questionData` matches the type's required shape,
or that mandatory fields exist. Anything that's an object passes — including
`{}`. Combined with P0-4, malformed items can land in production data.

**Fix:** Replace `z.record()` with a
`z.discriminatedUnion('questionType', [...])` for `QuestionPayload`, and an
analogous union for `MaterialPayload`.

### P0-6. `basePoints` and `meta.totalPoints` are never synchronized

`ItemEditor.tsx:401-414` only edits `payload.basePoints`. The story-point and
space `stats.totalPoints` are computed exclusively from `data.meta.totalPoints`
at create time (`save-item.ts:181-186`) and updated at delete time. Editing
`basePoints` does NOT propagate to `meta.totalPoints`, so the points totals
shown on the story-point header (`SpaceEditorPage.tsx:240-242`) and the space
stats become stale immediately on first edit.

**Fix:** Either (a) collapse to a single source of truth (use `basePoints`,
computed at server in stats), or (b) when `payload.basePoints` is sent, server
should mirror it into `meta.totalPoints` and adjust delta against the stored
value. Currently neither happens.

### P0-7. Topics, labels, sectionId, rubric, bloomsLevel — entirely missing from `ItemEditor`

The schema supports them (`UnifiedItem`, `ItemMetadata`) and the `saveItem`
callable accepts them (`UPDATABLE_FIELDS` in `save-item.ts:13-26`). UI exposes
none. Items always saved with `topics=[]`, `labels=[]`, `sectionId=null`, no
rubric, no blooms. The "Unsectioned" group in `SpaceEditorPage.tsx:1093-1110`
exists because nothing ever writes `sectionId`.

**Fix:** Add a "Classification" panel to `ItemEditor`: section dropdown (from
parent SP's `sections[]`), topic chips, label chips, blooms select, and per-item
rubric override (reuse `RubricEditor`).

### P0-8. Rich material editor doesn't edit blocks

`MaterialDataEditor` for `materialType: 'rich'` (`ItemEditor.tsx:1679-1711`)
only edits `richContent.title` and a flat `content` markdown textarea. The
`RichContentBlock` schema supports structured `blocks[]` of types
`heading | paragraph | image | video | audio | code | quote | list | divider`
(`item.ts:249-266`). None of those are accessible from the UI. This is a major
feature gap, not a polish issue.

### P0-9. MCAQ editor missing `minSelections` / `maxSelections`

`MCAQData` defines these for grading semantics (`item.ts:71-76`);
`defaultQuestionData("mcaq")` seeds `minSelections: 1` (`ItemEditor.tsx:92`).
The editor (`ItemEditor.tsx:563-646`) shares the MCQ editor and exposes only
`shuffleOptions` + options list. Teacher cannot configure how many selections a
learner must choose, which changes the grading rule.

### P0-10. Numerical editor missing `decimalPlaces`

`NumericalData.decimalPlaces` is part of the schema (`item.ts:83-88`) and used
by autograders for float comparison precision; `NumericalEditor`
(`ItemEditor.tsx:695-735`) only exposes `correctAnswer`, `tolerance`, `unit`.

### P0-11. FillBlanks editor missing per-blank `acceptableAnswers` + `caseSensitive`

`FillBlank` defines both (`item.ts:121-126`); `FillBlanksEditor`
(`ItemEditor.tsx:982-1042`) only edits `correctAnswer`. Teachers cannot accept
multiple spellings or toggle case-sensitivity per blank.

### P0-12. FillBlanksDD editor: no way to delete a single dropdown option

`FillBlanksDDEditor` (`ItemEditor.tsx:1101-1125`) renders each option with a
radio + text input but no `Trash2` button. Once an option is added, it's
permanent unless the entire blank is deleted.

### P0-13. JumbledEditor doesn't allow reordering items

`JumbledEditor` (`ItemEditor.tsx:1219-1282`) has no drag handle. Items must be
entered in the correct order at insert time; reorder = delete + re-add.
`correctOrder` is auto-derived from `items.map(i => i.id)`
(`ItemEditor.tsx:1244, 1257, 1273`), so the teacher has no way to set a
different correct order than insertion order.

### P0-14. CodeEditor missing test-case `description` and `points` fields

`CodeTestCase` defines `description?` and `points?` (`item.ts:104-111`);
`CodeEditor` (`ItemEditor.tsx:853-978`) only exposes `input`, `expectedOutput`,
`isHidden`. Teacher cannot weight test cases differently or label them.

### P0-15. ChatAgent: `agentId` is a free-text input, not bound to configured agents

`ChatAgentEditor` (`ItemEditor.tsx:1499-1568`) provides a text `<Input>` for
`agentId`. The space has an `AgentConfigPanel` tab
(`SpaceEditorPage.tsx:1280-1282`) where agents are configured, but there's no
integration. Teachers must hand-copy IDs.

**Fix:** Replace input with a `<Select>` populated from the space's agents
collection; allow inline "Create new agent" if none exist.

### P0-16. Material URL fields have no validation

`<Input type="url">` only validates inside an HTML `<form>`. ItemEditor never
wraps its inputs in a form, so video/pdf/link/interactive/story/rich URL fields
(`ItemEditor.tsx:1601, 1626, 1647, 1664`) accept any string including empty,
plain text, or invalid URLs.

### P0-17. `interactive` and `story` material types share the same generic editor

`MaterialDataEditor` falls into a single shared case for `interactive | story`
(`ItemEditor.tsx:1655-1678`) — just URL + content. `story` should expose
`richContent` (story material is a long-form narrative), and `interactive`
should expose `InteractivePayload`-style fields (`interactiveType`,
`embeddable`, `parameters`, `instructions` per `item.ts:281-287`). Currently
`InteractivePayload` itself is unreachable from the UI.

### P0-18. `handleAddItem` create-then-fabricate flow shows wrong data on first open

`SpaceEditorPage.tsx:689-725` creates the item via `createItem.mutateAsync`,
then constructs a local `newItem` object **with the unstripped payload**
(`payload: { questionType: "mcq", content: "", questionData: { options: [] } }`)
and shoves it into the editor. For timed-test SPs the server-stored payload is
already stripped. Sequence:

1. Editor shows local fabricated payload.
2. Autosave fires (P0-2 closes the sheet — see #2).
3. Re-open: now displays the stripped server version.
4. Combined with P0-1, the answer key gets nuked on re-open + save.

The fabricated `newItem` also lacks `createdAt`, `updatedAt`, `meta`,
`analytics`, `version`, `createdBy` — which the editor then spreads back via
`await onSave({ ...item, ... })` (line 174), pushing the missing fields as
undefined and quietly failing to update them.

### P0-19. `useState(item.payload)` snapshot is never re-synced

`ItemEditor.tsx:129` — when the parent passes a new `editingItem` (e.g. after a
refetch), the child does not reset state because `useState(initial)` only reads
on mount. Any background refresh (loadItems, etc.) is invisible to the open
editor. This is the React `key` antipattern — currently the parent does set
`editingItem` to the same identity on re-render, so this lurks but is invisible.

**Fix:** Add `key={item.id}` to `<ItemEditor>` in `SpaceEditorPage.tsx:1356`, or
use `useEffect` to sync state on item.id change.

### P0-20. handleAddStoryPoint hardcodes `type: 'standard'`

`SpaceEditorPage.tsx:577-582` always creates new story points as `standard`.
There's no UI to choose `timed_test | quiz | practice | test` at creation; user
must add then edit. Combined with P0-1, accidentally toggling an existing
standard SP to `timed_test` after items were added will reveal the editor's
broken state immediately.

---

## P1 — High (UX-breaking but recoverable)

### P1-21. `content || qPayload.content` clobber

`ItemEditor.tsx:181` and `:257` —
`payload: { ...qPayload, content: content || qPayload.content }`. If the teacher
clears the rich-text content (empty string is falsy), the save falls back to the
previous `qPayload.content`. The top-level item.content gets cleared, but
`payload.content` stays stale. The two diverge on every "clear" action.

### P1-22. Changing question type silently nukes existing data

`handleChangeQuestionType` (`ItemEditor.tsx:196-203`) replaces `questionData`
with the type's defaults without prompting. One mis-click destroys all
configuration.

### P1-23. Auto-save errors are silently swallowed

`performAutoSave` `catch {}` block (`ItemEditor.tsx:186-188`) only flips status
to "unsaved" — no toast, no console log, no analytics. Network failures are
invisible to the teacher.

### P1-24. Auto-save races on rapid edits

The 2-second debounce timer is cleared on every change, but there's no guard
against a second autosave firing while the previous one is in flight. Two saves
can race; later edits could be overwritten by an in-flight earlier save.

### P1-25. MCQ `updateOption` has redundant correctness sweeping

`ItemEditor.tsx:583-594` — first the `.map` partially handles single-MCQ
exclusivity, then a separate `.forEach` does the full sweep. Functionally
correct but two diverging code paths to maintain.

### P1-26. TextEditor acceptable-answers parser is comma-only

`ItemEditor.tsx:758-771` — `e.target.value.split(",")` means teachers can't
include literal commas in an acceptable answer (e.g. "Albuquerque, NM"). No
multi-line, no semicolon support.

### P1-27. GroupOptions: deleting a group leaves orphan IDs in items

`ItemEditor.tsx:1424` —
`onClick={() => onChange({ groups: groups.filter(...) })}`. Items that were
assigned to the deleted group still appear unassigned (because the lookup
`groups.find(...)?.id ?? "unassigned"` returns "unassigned" when the group is
gone), but there's no garbage collection. The `correctItems` arrays themselves
don't have stale IDs (they were on the group, which was removed), but the
visible state is misleading.

### P1-28. GroupOptions: deleting an item leaves stale IDs in groups

`ItemEditor.tsx:1487` — deleting an item from `data.items` does NOT remove that
item's id from any group's `correctItems`. Server keeps the orphan ID forever.
Auto-evaluation against orphan IDs may produce incorrect grading.

### P1-29. Numerical: `tolerance` accepts negative values

`ItemEditor.tsx:716-719` — no `min={0}` on tolerance input. Negative tolerance
is nonsensical.

### P1-30. Code timeout / memory limits: no min/max bounds

`ItemEditor.tsx:893-908` — `timeoutMs` and `memoryLimitMb` accept any number
including 0 and negatives. Server side has no clamp either.

### P1-31. Audio language is free-text, not enum

`ItemEditor.tsx:1308-1314` — should be a constrained list (e.g. ISO codes en,
hi, es, ...) or at least a placeholder/datalist.

### P1-32. ItemEditor save button has no `!title.trim()` guard

`StoryPointEditor` guards (`StoryPointEditor.tsx:568`) but ItemEditor
(`ItemEditor.tsx:500`) does not. Items can be saved with empty title (already
covered by P0-4 but worth singling out).

### P1-33. ImageEvaluation `maxImages`: HTML-only `min={1}`

`ItemEditor.tsx:1356-1359` — `min` on `<input type="number">` is just a hint.
User can paste 0 or negative. No client-side or server-side validation.

### P1-34. StoryPointEditor doesn't expose `defaultRubric`

`StoryPoint.defaultRubric` exists in the type, callable accepts it
(`save-story-point.ts`), but no UI in `StoryPointEditor.tsx`. Only space-level
rubric is editable via `RubricEditor` (`SpaceEditorPage.tsx:1273-1277`).

### P1-35. Cancel doesn't await in-flight save

`ItemEditor.tsx:273-281` — clicking Cancel during the autosave debounce window
catches the `hasUnsavedChanges=true` confirm prompt, but if the user has
just-saved (status=`saved`, hasUnsavedChanges=false) and then types again before
clicking Cancel before the next debounce, changes are lost without prompt
because the state hasn't flipped to unsaved yet between keystroke and Cancel
click. Tight race.

### P1-36. Bulk move duplicates-then-deletes (non-atomic)

`SpaceEditorPage.tsx:1170-1208` — the move flow runs `deleteItem` then
`createItem` per item. If the page reloads between the two, items are in NEITHER
SP. Item ID, attempts, analytics, audit history are also reset.

### P1-37. handleAddItem creates the item BEFORE the user fills it out

`SpaceEditorPage.tsx:689-725` — calling "Add Question" creates an empty
server-side item immediately. If the user hits Escape or closes the sheet
without saving, the empty item lingers in the SP forever. Better: open editor
with a draft local item; persist on first save.

### P1-38. handleSaveItem uses `editingItemSPId` from state, not `item.storyPointId`

`SpaceEditorPage.tsx:760-790` — should use `item.storyPointId` for safety. In
practice they match, but it's a footgun if state is stale (e.g., quick edit
during navigation).

### P1-39. handleAddStoryPoint reloads via raw Firestore, other paths use React Query

`SpaceEditorPage.tsx:583-589` reads via `getDocs` and `setStoryPoints`, while
elsewhere mutations rely on the React Query cache. Two state sources, eventual
divergence.

### P1-40. handleItemDragEnd writes via Firestore directly, bypassing the saveItem callable

`SpaceEditorPage.tsx:668-687` — uses `writeBatch` directly. Bypasses
`enforceRateLimit`, audit logging via `writeContentVersion`, and any future
server-side validation. Inconsistent with create/update paths.

---

## P2 — Medium / Low (polish)

### P2-41. Manual save shows no success toast in ItemEditor

`ItemEditor.tsx:245-265` — sets status badge to "Saved" but no toast. Compare
`SpaceEditorPage.tsx:786` which DOES show `sonnerToast.success("Item saved")`
from the parent path (which only fires on the manual save closing the sheet —
see P0-2). End user sees nothing on autosave.

### P2-42. No browser-level "leave page" warning when unsaved changes exist

ItemEditor handles in-app cancel via `window.confirm`
(`ItemEditor.tsx:274-280`), but doesn't add a `beforeunload` handler for tab
close / back navigation.

### P2-43. `MaterialDataEditor` default branch is unreachable

`ItemEditor.tsx:1712-1717` — every MaterialType maps to an explicit case. The
default fallback is dead code.

### P2-44. Capitalization for `chat_agent_question` heading is wrong

`ItemEditor.tsx:389-391` — `questionType?.replace(/[-_]/g, " ")` + `capitalize`
CSS gives "Chat agent question" (only first word). Other compound types display
similarly. Cosmetic.

### P2-45. Save status badge has no `aria-live` or accessible label

`ItemEditor.tsx:289-297` — color-coded only (green/yellow/orange). Screen
readers don't announce status changes.

### P2-46. `FillBlanksDD` placeholder helper text is buried

`ItemEditor.tsx:1064-1068` — instructions live as a `<p>` but no example. A
teacher's first interaction is confusing.

### P2-47. Default question type "mcq" is hardcoded twice

`SpaceEditorPage.tsx:696` and `ItemEditor.tsx:317` (`?? "mcq"`). Inconsistent
with `defaultQuestionData("mcq")` shape (one passes `shuffleOptions: false`, the
other doesn't).

### P2-48. Sortable item list re-renders entire DnDContext per expand toggle

`SpaceEditorPage.tsx:1055-1113` — IIFE inside JSX re-creates the `DndContext`
for every render. Performance issue at scale (>50 items per SP).

### P2-49. Reorder uses raw Firestore writes; create uses callables

Mixed privilege paths (`SpaceEditorPage.tsx:621-687`). Two failure modes, two
security-rule paths.

### P2-50. Image / audio attachments live separately from material type

`ItemEditor.tsx:444-497` — Attachments panel allows uploading images/PDFs/audio
for ANY item type. But for `materialType: 'video'` or `'audio'`, the natural
flow would be "upload media → it becomes the URL." Currently teachers must
upload separately and then paste the URL manually.

---

## Summary by question type

| Type                | Default OK?      | Editor renders? | Validation? | Save round-trip? | Edit-load? | Notes                                  |
| ------------------- | ---------------- | --------------- | ----------- | ---------------- | ---------- | -------------------------------------- |
| mcq                 | ✓                | ✓               | ✗           | ✓ (non-test)     | ✗ for test | P0-1, P0-4                             |
| mcaq                | partial          | partial         | ✗           | ✓ (non-test)     | ✗ for test | P0-9 (no min/max)                      |
| true-false          | biased to `true` | ✓               | ✗           | ✓ (non-test)     | ✗ for test | P0-4                                   |
| numerical           | ✓                | partial         | ✗           | ✓ (non-test)     | ✗ for test | P0-10 (no decimalPlaces), P1-29        |
| text                | ✓                | ✓               | ✗           | ✓ (non-test)     | ✗ for test | P1-26 (comma parser)                   |
| paragraph           | ✓                | ✓               | ✗           | ✓                | ✓          | AI-graded, no answer-key concern       |
| code                | partial          | partial         | ✗           | ✓                | ✓          | P0-14 (no per-test description/points) |
| fill-blanks         | ✓                | partial         | ✗           | ✓ (non-test)     | ✗ for test | P0-11 (no per-blank options)           |
| fill-blanks-dd      | ✓                | partial         | ✗           | ✓ (non-test)     | ✗ for test | P0-12 (no option delete)               |
| matching            | ✓                | ✓               | ✗           | ✓ (non-test)     | ✗ for test | P0-1 wipes mappings                    |
| jumbled             | ✓                | partial         | ✗           | ✓ (non-test)     | ✗ for test | P0-13 (no reorder)                     |
| audio               | ✓                | ✓               | ✗           | ✓                | ✓          | P1-31 (lang freetext)                  |
| image_evaluation    | ✓                | ✓               | ✗           | ✓                | ✓          | P0-4 (instructions can be empty)       |
| group-options       | ✓                | partial         | ✗           | ✓ (non-test)     | ✗ for test | P1-27, P1-28 (orphan IDs)              |
| chat_agent_question | ✓                | partial         | ✗           | ✓                | ✓          | P0-15 (no agent dropdown)              |

| Material type | Editor OK? | Notes                                                       |
| ------------- | ---------- | ----------------------------------------------------------- |
| text          | ✓          |                                                             |
| video         | partial    | P0-16 (no URL validation), P2-50                            |
| pdf           | partial    | P0-16                                                       |
| link          | partial    | P0-16                                                       |
| interactive   | broken     | P0-17 (shares story editor; InteractivePayload unreachable) |
| story         | broken     | P0-17                                                       |
| rich          | broken     | P0-8 (no block editor)                                      |

---

## Recommended fix order

**Sprint 1 (data-loss):** P0-1, P0-2, P0-5, P0-6, P0-18 — these can corrupt or
destroy data. **Sprint 2 (functional gaps that block teachers):** P0-7, P0-8,
P0-9..P0-15, P0-17 — incomplete editors. **Sprint 3 (validation + UX):** P0-3,
P0-4, P0-16, P0-19, P0-20, P1-21..P1-25. **Sprint 4 (polish + perf):**
remainder.
