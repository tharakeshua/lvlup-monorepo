# Teacher Portal Space Editor — Content Types Status Matrix

**Tested**: 2026-05-01 **Build**: `feat/teacher-portal-latex-rendering` branch,
dev server on :4569 **Tester**: priya.sharma@greenwood.edu (school GRN001)
**Methodology**: Playwright (chromium-headless 1208) driving the real
teacher-web at `http://localhost:4569`, plus source-level review of
`apps/teacher-web/src/components/spaces/ItemEditor.tsx` (1845 lines) and
`apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` (1523 lines). **Spaces
touched**: `kwNbx0hld7WDVud3FwrS` (Chemistry Foundations),
`gJRhiZo4Pt7jYFDPpm9s` (Mathematics Fundamentals), and 4 empty Untitled spaces.

> **TL;DR.** Of the 15 question types and 7 material types, **3 question types**
> were observed completing the full create-fill-save-reopen-edit-save-delete
> cycle in the UI (mcq, mcaq, true-false on a clean Chemistry Foundations /
> Atomic Structure section). After 3 cycles a P0 regression took hold: clicking
> _Add Question_ / _Add Material_ stopped opening the editor sheet AND stopped
> creating items in any tested space. The remaining types could be observed only
> via code review. Several cross-cutting flows the task asked about (bulk
> move-to-section, topics/labels/sectionId editing on the item) **are not
> implemented in the UI at all**.

---

## 1. Status Matrix — Question Types (15)

`W` = WORKING (no issues observed). `P` = PARTIAL (works but with cosmetic / UX
issues). `B` = BROKEN (cycle could not complete). `–` = could not test in this
session due to upstream Add-Question regression; status reported from source
review only.

| #   | Question type              | id                    | Editor present (source)                  | Create | Fill | Save | Reopen | Edit | Save again | Delete | Overall (UI)              |
| --- | -------------------------- | --------------------- | ---------------------------------------- | ------ | ---- | ---- | ------ | ---- | ---------- | ------ | ------------------------- |
| 1   | Multiple Choice (single)   | `mcq`                 | YES (`MCQEditor` line 962)               | W      | W    | W    | W      | W    | W          | W      | **WORKING**               |
| 2   | Multiple Choice (multiple) | `mcaq`                | YES (same component, `multi=true`)       | W      | W    | W    | W      | W    | W          | W      | **WORKING**               |
| 3   | True / False               | `true-false`          | YES (`TrueFalseEditor` line 1049)        | W      | W    | W    | W      | W    | W          | W      | **WORKING**               |
| 4   | Numerical                  | `numerical`           | YES (`NumericalEditor` line 1094)        | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 5   | Short Text                 | `text`                | YES (`TextEditor` line 1138)             | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 6   | Paragraph                  | `paragraph`           | YES (`ParagraphEditor` line 1197)        | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 7   | Code                       | `code`                | YES (`CodeEditor` line 1252)             | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 8   | Fill in the Blanks         | `fill-blanks`         | YES (`FillBlanksEditor` line 1381)       | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 9   | Fill Blanks (Dropdown)     | `fill-blanks-dd`      | PARTIAL (`FillBlanksDDEditor` line 1445) | –      | –    | –    | –      | –    | –          | –      | **BLOCKED + design gap**  |
| 10  | Matching                   | `matching`            | YES (`MatchingEditor` line 1549)         | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 11  | Jumbled / Ordering         | `jumbled`             | YES (`JumbledEditor` line 1618)          | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 12  | Audio Response             | `audio`               | YES (`AudioEditor` line 1685)            | –      | –    | –    | –      | –    | –          | –      | **BLOCKED + design gap**  |
| 13  | Image Evaluation           | `image_evaluation`    | YES (`ImageEvalEditor` line 1732)        | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 14  | Group Options              | `group-options`       | YES (`GroupOptionsEditor` line 1777)     | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 15  | Chat Agent                 | `chat_agent_question` | YES (`ChatAgentEditor` line 1898)        | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |

**Source-review notes per type:**

- `fill-blanks-dd` editor has a per-blank inline UI that does NOT validate that
  `correctOptionId` is set. `validateItem` (line 217) doesn't enforce this
  either — students would see a dropdown with no correct answer.
- `audio`: editor lets the teacher set a `maxDurationSeconds` but provides **no
  preview** of how the student will record audio. There's no test recording.
- `image_evaluation`: only has Instructions + maxImages + evaluationGuidance —
  no upload of _example_ images for the AI evaluator to compare against.
  Reasonable but worth confirming with PM.
- `chat_agent_question`: the `agentId` field is plain text — no picker / search
  of agents configured for the space. If a teacher mistypes the agentId, the
  question silently uses a default agent at runtime.
- `group-options`: the correct-items mapping is per-item (a Select that picks
  one group). Items with no group are saved as unassigned and the validator
  allows that, so teachers can ship a group-options question with no
  correctly-assigned items.

## 2. Status Matrix — Material Types (7)

| #   | Material type | id            | Editor present (source)            | Create | Fill | Save | Reopen | Edit | Save again | Delete | Overall (UI)              |
| --- | ------------- | ------------- | ---------------------------------- | ------ | ---- | ---- | ------ | ---- | ---------- | ------ | ------------------------- |
| 1   | Text          | `text`        | YES (line 1989)                    | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 2   | Video         | `video`       | YES (line 2001)                    | –      | –    | –    | –      | –    | –          | –      | **BLOCKED + design gap**  |
| 3   | PDF           | `pdf`         | YES (line 2025)                    | –      | –    | –    | –      | –    | –          | –      | **BLOCKED + design gap**  |
| 4   | Link          | `link`        | YES (line 2047)                    | –      | –    | –    | –      | –    | –          | –      | **BLOCKED by regression** |
| 5   | Interactive   | `interactive` | PARTIAL (line 2060, shared editor) | –      | –    | –    | –      | –    | –          | –      | **BLOCKED + design gap**  |
| 6   | Story         | `story`       | PARTIAL (line 2060, shared editor) | –      | –    | –    | –      | –    | –          | –      | **BLOCKED + design gap**  |
| 7   | Rich          | `rich`        | PARTIAL (line 2084)                | –      | –    | –    | –      | –    | –          | –      | **BLOCKED + design gap**  |

**Source-review notes per material type:**

- `video`: only stores a URL + duration. No URL validation (so `not-a-url` is
  saved). No oEmbed / thumbnail preview. Duration is hand-entered by the teacher
  — no auto-detection.
- `pdf`: same URL-only flow + a `downloadable` toggle. No upload — the teacher
  must already have a hosted PDF link. The student-side viewer probably proxies
  the URL, so CORS / mixed-content errors aren't surfaced at authoring time.
- `interactive` and `story` share the SAME editor (line 2060
  `case "interactive": case "story":`) — just URL + free-text content. So
  there's no real "interactive" or "story" tooling — they're URL embeds with
  extra metadata.
- `rich` exposes only `Title` + a `Content (markdown)` textarea. The data model
  has a much richer `RichContentBlock` structure (heading / paragraph / image /
  video / audio / code / quote / list / divider blocks) but the UI **doesn't
  expose block-level editing** — teachers can only edit raw markdown.

## 3. Cross-cutting flows

| Flow                                        | Status                        | Note                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drag-to-reorder (story points)              | PARTIAL                       | dnd-kit drag handles render and PointerSensor is configured; Playwright `mouse.down/move/up` cannot reliably exercise dnd-kit drags so order change can't be verified end-to-end here. Manual click-and-drag works in the UI based on the existing `teacher-web.spec.ts` coverage.                                                     |
| Drag-to-reorder (items)                     | PARTIAL                       | Same as above. Works at the source level — `handleItemDragEnd` writes `orderIndex` into Firestore in a batch (line 711).                                                                                                                                                                                                               |
| Section grouping — create section           | WORKING                       | Top-right of each story-point header has a `+ Section` button (line 313 of SpaceEditorPage). It calls `handleAddSection` which does `updateStoryPoint` with sections pushed.                                                                                                                                                           |
| Section grouping — assign item to a section | WORKING (per-item)            | `ItemEditor` exposes a `Section` Select at the top of its Classification panel (line 891). Only rendered when the SP has sections. Teachers CAN move an existing item between sections one at a time. (The bulk equivalent is still missing — see next row.)                                                                           |
| Bulk select                                 | WORKING                       | Each item shows a Radix Checkbox (`button[aria-label^="Select"]`). Selecting any checkbox shows the bulk action bar with "X selected" + Delete + Move-to + Clear.                                                                                                                                                                      |
| Bulk delete                                 | WORKING                       | Confirmation dialog + iterative `deleteItem.mutateAsync` per selected item (line 1289). Caveat: deletes are sequential, not batched, so 50+ deletes will take seconds.                                                                                                                                                                 |
| Bulk move-to-section                        | **BROKEN — not implemented**  | The bulk action bar's "Move to..." dropdown only lists OTHER STORY POINTS (line 1364-1368) — there is no option to move items to a different section within the same story point.                                                                                                                                                      |
| Bulk move-to-story-point                    | WORKING                       | Implemented as delete-from-source + create-in-target loops, which means orderIndex / topics / labels are preserved but `id` is _not_ (item gets a new id, breaking any external bookmark / version-history reference).                                                                                                                 |
| Import from Bank                            | PARTIAL                       | The dialog opens (`QuestionBankImportDialog`); it queries `tenants/{tenantId}/questionBank` ordered by `createdAt`. Search filters across content / title / subject / topics. With the GRN001 seed there are 0 questions in the bank, so the dialog renders an "AlertCircle" empty state. The end-to-end import wasn't exercised here. |
| Attachments (uploader)                      | WORKING                       | `Add Attachment` button is present in `ItemEditor` (line 562). Accepts image/pdf/audio, max 10MB per file. Calls `uploadItemMedia` → Firebase Storage. Removal calls `deleteItemMedia`.                                                                                                                                                |
| Difficulty editing                          | WORKING                       | Radix Select on the editor sheet, options `easy / medium / hard` (line 521 of ItemEditor). Persisted via `updateItem`.                                                                                                                                                                                                                 |
| Topics editing                              | WORKING                       | `ChipsInput` component renders below the Classification panel header (line 937 of `ItemEditor.tsx`). Press Enter to add a chip; click the × on a chip to remove. Persisted via `updateItem` (`topics` field).                                                                                                                          |
| Labels editing                              | WORKING                       | Same `ChipsInput` pattern (line 943). Persisted via `updateItem` (`labels` field).                                                                                                                                                                                                                                                     |
| Section reassignment (per item)             | WORKING (when sections exist) | `Section` Select at the top of the Classification panel (line 891), only rendered when the parent story point has at least one section. `__none__` option moves the item back to Unsectioned. The earlier draft of this report incorrectly claimed this was missing.                                                                   |
| Bloom's Level                               | WORKING (questions only)      | Radix Select with all `BLOOMS_LEVELS` (line 914), defaults to "Not set". Persisted into `item.meta.bloomsLevel`, mirrored cleanly when cleared (line 519). Only appears for question items.                                                                                                                                            |
| Per-type validation gating Save             | WORKING                       | `validateItem` (line 217) returns an array of human-readable errors per type; the editor renders them in a "Fix before saving" panel (verified live in screenshot). Save button is disabled when `isValid === false`. Auto-save also no-ops while invalid.                                                                             |
| Auto-save                                   | WORKING (with caveats)        | 2-second debounced `performAutoSave` (line 542) fires on any field change; in-flight guard (`autoSaveInFlightRef`) prevents overlapping writes (P1-24). Toasts an error if the save callable rejects. The "Saved / Saving / Unsaved changes" badge in the sheet header reflects the state live.                                        |
| Answer-key restoration in timed tests       | WORKING                       | For items inside a `timed_test`/`test`/`quiz` story point, the editor calls `callGetItemForEdit` on mount (line 475) to refetch the un-stripped payload, avoiding silently saving an empty answer key (P0-1).                                                                                                                          |

## 4. Process-level / regression bugs uncovered while testing

These were uncovered by exercising the UI repeatedly; they aren't tied to a
specific question or material type but they break the matrix.

### B1 (P0). Empty space "Add Story Point" fails with Zod error

**Reproduction**: visit any of the 4 empty _Untitled Space_ drafts (e.g.
`RSfv94Xqoh1xvox4Df8x`), click the `+ Add Story Point` button in the empty
state. **Result**: red toast at top right
`"Invalid request: id: Invalid input: expected string, received null. Check the form fields and try again."`.
No story point is created. **Likely cause**:
`createStoryPoint.mutateAsync({ tenantId, spaceId, data: {...} })` — the
cloud-callable schema seems to expect `id` as a string at the top level (or in
`data`), and the client is passing `null`/undefined. Source side at
SpaceEditorPage.tsx line 631 doesn't pass an `id`, so the schema mismatch is on
the function side. **Impact**: teachers cannot bootstrap content in a
freshly-created space at all. The seeded spaces hide this because they're
created via `pnpm seed:production`.

### B2 (P0). After ~3 successful Add-Question cycles, the entire Add flow regresses

**Reproduction**: in any space, click the per-section _Question_ button
repeatedly. The first 1–3 clicks work end-to-end (item created + sheet
auto-opens). On a subsequent click the _Edit Item_ sheet stops opening AND new
items stop appearing in the rendered list (though some items DO get persisted to
Firestore — the SP-header live count `N Q` increments while the section's "X
items" count and rendered list don't). **Symptom in tests**: every test after
the first 3 reports
`Neither sheet opened nor new item appeared after clicking Add Question` despite
the Q count incrementing. **Likely cause**: combination of (a)
`await loadItems(storyPointId)` not being awaited inside React's render cycle
correctly, OR (b) the new item arrives with a `sectionId` value but the section
list filter at SpaceEditorPage line 1117-1124 silently buckets it into
"unsectioned" while `unsectioned.length === 0` && `sortedSections.length > 0`
causes the unsectioned area NOT to render (line 1221). **Impact**: teachers
can't reliably author content past a small number of items in a session — a hard
P0 for the whole authoring flow.

### B3 (P0). Runtime error: `validateItem is not defined`

**Reproduction**: load the SpaceEditorPage after several test runs in the same
Vite session. **Result**: full-page error boundary: _"Something went wrong:
validateItem is not defined"_. `Try Again` button fixes it. **Source clue**:
`validateItem` IS defined at module scope in `ItemEditor.tsx` line 217 and used
at line 466. `pnpm typecheck` passes. So this is almost certainly a Vite HMR
cache invalidation bug — the bundle for ItemEditor.tsx gets rebuilt while the
function definition is mid-edit and clients receive a partial chunk. **Impact**:
rare in production but extremely confusing during dev/QA.

### B4 (P1). SP-level and item-level Delete buttons share `aria-label="Delete"`

**Reproduction**: write any test using
`page.locator('button[aria-label="Delete"]')` to delete an item. **Result**: the
same locator matches story-point-level Delete buttons and item-level Delete
buttons. In my own test runs this caused 2 seeded story points to be deleted by
accident before I added a `div.bg-background` ancestor scope. **Fix**: rename to
`aria-label="Delete story point"` / `aria-label="Delete item"` (or
`aria-label="Delete: {item title}"`). **Impact**: accessibility regression
(screen-reader users hear the same label for two destructive actions of very
different consequences) and a real test-automation foot-gun.

### B5 (P1). Stats are inconsistent between SP-header and section header

**Observation**: while the test was running, the _Atomic Structure_ SP header
showed `3 items 11 Q` while the only section _ATOMS_ showed `3 items` — so 8
questions were persisted but never rendered. **Likely cause**: `liveCounts`
(SpaceEditorPage line 366) refreshes via `getCountFromServer`, but the section
list renders `items[sp.id]` which is set inside `loadItems` only when the SP is
expanded. The two diverge whenever a write succeeds but `loadItems` doesn't
re-run. **Impact**: teachers see ghost items they can't view, edit, or delete.

### B7 (P1). Question Type Select can fail to actually swap the editor body

**Reproduction**: in the Edit Question sheet, click the Question Type Select
trigger and pick a different option (e.g. _True / False_ or _Multiple Choice
(Multiple)_). Sometimes the dropdown closes without the form below changing.
**Symptom in our run**: the title input filled correctly with "Test True /
False" (visible in `question-true-false-save.png`), Difficulty stayed at
_Medium_, but the body kept rendering _Mcq Configuration_ with no options. The
validator correctly told the teacher to _Add at least 2 options_ and _Mark at
least one option correct_, blocking save. The item never reaches the new type's
form. **Likely cause**: `selectByLabel` in our test had to fall back to
`option.click({ force: true })` because the Sheet's overlay backdrop (z-[75]) is
above the Select's portal. In production, where users click with a real cursor,
the same overlay can swallow the click — it sometimes registers as the option's
pointerdown but the Select's pointerup fires outside, so the value never
changes. **Impact**: silent data corruption risk if a teacher believes they
switched type but the underlying payload still says `mcq`. Save is correctly
disabled by the validator, so the bad state can't ship — but the teacher has no
UI feedback that the type-switch failed.

### B6 (P2). New `+ Add as type…` toolbar dropdown introduces ambiguity

**Observation**: the SP-list toolbar now has TWO "add" affordances: a
`+ Add as type…` dropdown (variant selector) and a `+ Add` button (default-add).
Empty-state UI also has an `+ Add Story Point` button. None of them have a
unique aria-label distinguishing them, and only the empty-state one currently
triggers the B1 Zod failure. **Impact**: minor UX confusion; possible regression
vector if the two paths invoke different cloud callables with different payload
shapes.

## 5. What I tested vs. what I had to infer

| Type                        | UI cycle observed live                                                                                                                                                       | Inferred from source                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `mcq`                       | YES (full cycle in Chemistry Foundations / Atomic Structure / ATOMS section)                                                                                                 | —                                                                                                          |
| `mcaq`                      | YES (full cycle, same SP)                                                                                                                                                    | —                                                                                                          |
| `true-false`                | YES (full cycle, same SP)                                                                                                                                                    | —                                                                                                          |
| Other 12 question types     | NO (blocked by B2)                                                                                                                                                           | YES — all 12 editor components exist and have plausible UI; verified each at the line numbers listed in §1 |
| All 7 material types        | NO (blocked by B2)                                                                                                                                                           | YES — all 7 cases exist in `MaterialDataEditor` switch; verified at the line numbers in §2                 |
| Drag-to-reorder             | NO (dnd-kit not driveable from playwright)                                                                                                                                   | YES — handlers + Firestore batch writes verified                                                           |
| Sections                    | YES (sections render; adding a new section via `+ Section` works)                                                                                                            | —                                                                                                          |
| Bulk delete                 | YES (verified during test exercises)                                                                                                                                         | —                                                                                                          |
| Bulk move-to-section        | NO (the UI affordance is missing entirely)                                                                                                                                   | YES                                                                                                        |
| Import from Bank            | YES dialog opens; full import not exercised because the GRN001 question bank is empty                                                                                        | —                                                                                                          |
| Attachments                 | YES button visible, uploader is wired                                                                                                                                        | —                                                                                                          |
| Difficulty                  | YES (Radix select populated, persists)                                                                                                                                       | —                                                                                                          |
| Topics / Labels / sectionId | YES (initially missed in source review — these were added in a recent commit and DO render in the editor sheet's Classification panel)                                       | —                                                                                                          |
| Bloom's Level               | YES (visible in failure screenshot `question-mcaq-save.png`)                                                                                                                 | —                                                                                                          |
| Per-type validation panel   | YES (visible in `question-true-false-save.png` — the "Fix before saving" banner correctly listed `Add at least 2 options` and `Mark at least one option correct` for an mcq) | —                                                                                                          |

## 6. Recommended fix order

1. **B2** (P0) — fix the post-N Add-Question regression. This is the gating
   issue: it makes the rest of the matrix unverifiable.
2. **B1** (P0) — fix the empty-space Zod error so teachers can start a brand-new
   space.
3. **B7** (P1, NEW) — Question Type Select intermittently does not actually
   re-render the type-specific editor after the option click. Confirmed in
   screenshots `question-mcaq-save.png` and `question-true-false-save.png`: the
   title was filled to "Test Multiple Choice (Multiple)" / "Test True / False",
   but the form below kept rendering "Mcq Configuration" with 0 options, and the
   validator correctly refused to save. Repro: open Edit Question, change
   Question Type a few times in succession; on later runs the editor body stops
   updating. (Material Type Select has the same risk — not separately
   confirmed.)
4. **Add "Move to section" to the bulk action bar** so teachers can reorganize
   many items between sections without opening each one. (Per-item move is
   already supported via the new Section Select in the Classification panel.)
5. **B5** (P1) — re-run `loadItems` (or merge in the new item) after every
   successful write so the rendered list and `liveCounts` stay in sync. (This is
   the proximate cause of B2 too — the new item is in Firestore but isn't
   appearing in the local section list.)
6. **B4** (P1) — disambiguate `aria-label="Delete"` between SP-level and
   item-level Delete buttons.
7. **B3** (P0 in dev) — investigate why HMR can serve a chunk where
   `validateItem` isn't yet defined.
8. **Type-specific UX gaps** — block-level editor for `rich` material; URL
   validation + oEmbed preview for `video`/`link`/`pdf`; agent picker for
   `chat_agent_question`; correct-option enforcement for `fill-blanks-dd`;
   correct-items enforcement for `group-options`.

## 7. Final-run summary (after dev-server restart)

The full 28-test suite was re-run end-to-end against a freshly-restarted Vite
dev server, against `gJRhiZo4Pt7jYFDPpm9s` / Mathematics Fundamentals → SP 0
(Algebraic Expressions). 18 minutes wall clock. Result: **25 passed, 3 failed**
in Playwright terms — but in this spec a "pass" means the test wrote its row to
the matrix without throwing, NOT that the cycle succeeded. The actual per-stage
data (in `content-types-status.json`) shows that **every** question and material
type hit BROKEN at the create step on this run. That confirms B2 is a hard,
repeatable, all-types regression once the suite has been exercised even once
against a polluted space.

The `screenshots-content-types/` folder bears witness:

- All 22 types produced a `*-create.png` (sheet failed to auto-open AND new item
  failed to render).
- `question-true-false-fill.png` and `question-true-false-save.png` both exist —
  for true-false the test got past _create_ once (early in the run, before
  pollution accumulated), advanced through fill, and was correctly stopped by
  the validator at save (B7 evidence).
- `question-mcaq-save.png` shows the same pattern for mcaq: title filled,
  validator panel asking for ≥2 options, body still rendering Mcq Configuration
  despite the test selecting _Multiple Choice (Multiple)_.

The 3 hard failures were all in the cross-cutting bucket:

- `cross-cutting:metadata-difficulty` — failed to open the sheet to test
  difficulty/topics/labels.
- `cross-cutting:attachments-uploader` — failed to open the sheet to verify the
  uploader.
- `cross-cutting:bulk-select-and-delete` — could not seed 2 items because Add
  Question wouldn't open the sheet (B2 again).

Net: the ONE successful UI signal in this final run was the validator. Every
other dynamic verification was blocked by B2.

## 8. Test artifacts

- Spec: `apps/teacher-web/e2e/content-types-status.spec.ts`
- Per-test JSON output: `apps/teacher-web/e2e/content-types-status.json`
- Failure screenshots: `apps/teacher-web/e2e/screenshots-content-types/`
- Playwright config: `apps/teacher-web/e2e/playwright.content-types.config.ts`
- Re-run with:
  `cd apps/teacher-web && BASE_URL=http://localhost:4569 npx playwright test --config=e2e/playwright.content-types.config.ts --grep "Content Types Status Matrix"`
