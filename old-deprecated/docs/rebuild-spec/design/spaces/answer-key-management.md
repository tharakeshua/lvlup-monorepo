# Answer Key Management & Protection — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All colors, type, spacing,
> radii, elevation, motion, and components are cited by token/name — never
> re-defined here.

This is a **domain-rules-heavy** spec. The "screen" is not a standalone route —
it is the _answer-key isolation UX_ embedded inside the **Item Editor** for
`timed_test` / `test` story points. Its whole job is to make a piece of
invisible backend security (server-only `answerKeys` subcollection) **legible,
trustworthy, and safe to edit** for staff.

---

## 1. Purpose & primary user

**Primary user:** `teacher` (space author) and `tenantAdmin`, in the role of
_assessment author_.

**Job-to-be-done:** "When I author a gradable question inside a timed test, let
me set and edit the correct answer with confidence that (a) students can never
read it, and (b) I will never accidentally wipe a real answer key by saving a
blanked-out form." The UX must surface a backend invariant — answer keys live in
a client-deny subcollection — without exposing the teacher to its plumbing.

**Non-goal:** Students never see any part of this. There is no student-facing
variant; the protection is defined by its _absence_ from the student SDK
surface.

---

## 2. Entry points & route

Not independently routed. Reached **within the Item Editor** at
`/spaces/:spaceId/edit` → `SpaceEditorPage` → `ItemEditor`
(`apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`,
`apps/teacher-web/src/components/spaces/ItemEditor.tsx`) when **both** hold:

- the selected item `type === "question"` **and** is a gradable question type,
  and
- the parent story point `type === "timed_test"` or `"test"` (`isTimedTestSP`).

For non-test story points the answer simply lives inline in the payload with no
isolation — this entire affordance is dormant.

**Common-API reads/writes** (`docs/rebuild-spec/specs/common-api.md`):

- **Read — `getItemForEdit`**
  (`functions/levelup/src/callable/get-item-for-edit.ts`): teacher/admin-only
  callable that **re-merges** the stripped `answerKeys` doc back into
  `payload.questionData` via `mergeAnswerKey()`. This is the _only_ path that
  returns a populated key. A plain Firestore item read (used by the student
  runner) returns the stripped payload.
- **Write — `saveItem`** (`functions/levelup/src/callable/save-item.ts`): on
  save it calls `extractAnswerKey()` → writes/updates the `answerKeys/{itemId}`
  doc, then `stripAnswerFromPayload()` → re-persists the blanked payload back
  onto the item document. Create and update both re-strip.
- **Client guard — `answerKeyLooksStripped()`** (`ItemEditor.tsx`): pure client
  check that powers the P0-1 warning banner _before_ save.

---

## 3. Layout — wireframe-as-text

This is an **inline region inside the existing Item Editor panel**, not a new
page. The editor is the detail pane of `SpaceEditorPage` inside `AppShell`
(sidebar + topbar). No new shell. The answer-key UX is composed of three stacked
zones within the editor's question form:

```
AppShell ▸ SpaceEditorPage ▸ [Story-point list] | [ ItemEditor panel ]
                                                  ┌───────────────────────────────────┐
  (A) Protection header strip ──────────────────▶ │ 🔒 AnswerKeyLock  "Server-protected"│  e1, pill badge
                                                  │     micro-explainer link ›          │
                                                  ├───────────────────────────────────┤
  (B) Answer-editing affordance (per type) ─────▶ │  Correct answer ─────────────────  │
        QuestionCard / AnswerInput author mode    │  [ MCQ options w/ ✓ correct ]       │
                                                  │  [ numerical value + tolerance ]    │
                                                  │  [ text + acceptable answers ]      │
                                                  │  …dispatches over question type     │
                                                  ├───────────────────────────────────┤
  (C) Strip-warning banner (conditional) ───────▶ │ ⚠ InlineAlert: "Answer key looks    │  status.warning
        only when answerKeyLooksStripped===true    │   empty — saving may erase it"      │
                                                  └───────────────────────────────────┘
                              [ Cancel ]  [ Save ]  ← footer, Save gated by validation
```

**Grid / responsive** (foundation §4 breakpoints, gutters mobile 16 / tablet 24
/ desktop 32):

- **lg (≥1024):** two-pane — story-point track left, editor right (single
  reading column ≤720). Zones A/B/C stack vertically with `gap=6 (24)`.
- **md (768–1023):** editor becomes a `Drawer/Sheet` over the track; same
  vertical stack.
- **sm (<768):** full-screen editor (author mode). Zones stack with
  `gap=4 (16)`; protection header collapses its explainer link into the lock
  badge tap target.

---

## 4. Components used (from §5)

| Zone | Component                                                | Notes                                                                                                                                         |
| ---- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | **`AnswerKeyLock`** (domain, "server-only guard visual") | Primary artifact of this spec. Pill `Badge` + lock glyph + label, sits above the answer fields.                                               |
| A    | **Popover** / **Tooltip**                                | The "How is this protected?" micro-explainer.                                                                                                 |
| B    | **`QuestionCard`** (author mode) + **`AnswerInput`**     | Dispatch over the 15 question types; in author mode `AnswerInput` exposes the _correct-answer_ controls (e.g. MCQ "mark correct" checkmarks). |
| B    | **Checkbox / Radio / Input / Textarea / Combobox**       | Primitives composed by `AnswerInput` per type (MCQ checkmarks, numerical value+tolerance, text acceptable-answers list).                      |
| C    | **InlineAlert/Banner** (`status.warning`)                | The strip-warning.                                                                                                                            |
| —    | **ConfirmDialog**                                        | Confirmation when saving while `answerKeyLooksStripped`.                                                                                      |
| —    | **Toast (sonner)**                                       | Save success / failure, re-fetch result.                                                                                                      |
| —    | **Skeleton**, **LoadingOverlay**                         | While `getItemForEdit` re-merges the key.                                                                                                     |
| —    | **DefinitionList**                                       | Inside the explainer Popover (where the key lives, who can read it).                                                                          |

**Proposed addition (justify):** `AnswerKeyLock` is named in §5 as a
"server-only guard visual" but has no state spec. Proposing it gains **three
states** — `protected` (key present & isolated), `fetching` (re-merging via
`getItemForEdit`), `stripped-warning` (client thinks key is blank). Add this to
§5's `AnswerKeyLock` entry; no new tokens introduced.

---

## 5. States

**Loading (re-merge):** When the editor opens a gradable timed-test item, it
must call `getItemForEdit` (not use the cached stripped payload). While in
flight: `AnswerKeyLock` shows `fetching` with a `Skeleton` over zone B and a
`LoadingOverlay` blocking edits — you must not author on top of an unmerged
(blank) key, or save would strip a real key. Copy: "Fetching the protected
answer key…".

**Empty (new question):** No `answerKeys` doc yet. `AnswerKeyLock` shows
`protected` with copy "This answer will be stored server-side once you save."
Answer fields empty and editable; no warning.

**Error (re-merge failed):** `getItemForEdit` throws → editor enters a
**read-only safety lock**: answer fields disabled, `InlineAlert`
(`status.error`): "Couldn't load the protected answer key. Editing is locked to
prevent overwriting it." Primary action **Retry** (re-calls `getItemForEdit`).
This is the critical fail-safe — never let authoring proceed on an unverified
key.

**Partial (merge succeeded, some sub-keys absent):** e.g. `fill-blanks` where
only some blanks have keys. Show populated fields; `answerKeyLooksStripped` only
fires when **all** are empty (`blanks.every((b) => !b.correctAnswer)`), so
partial keys do not trigger the banner.

**Success:** Key merged, fields populated. `AnswerKeyLock` `protected`. Editing
freely; autosave/save re-strips.

**Strip-warning (the P0-1 state):**
`isQuestion && isTimedTestSP && answerKeyLooksStripped(qPayload)` is true → zone
C `InlineAlert` (`status.warning`) appears, and Save routes through
`ConfirmDialog`.

**Permission-gated:** Only `teacher`/`tenantAdmin` can ever reach this (callable
asserts `assertTeacherOrAdmin`; `firestore.rules` `answerKeys` block is
`allow read, write: if false`). A teacher who is **not** the space `createdBy`
can still _read_ for edit via the callable, but `saveItem` rejects the write
(rules require `createdBy == auth.uid` for non-admins) — surface this as a
disabled Save with tooltip "Only the space owner or a tenant admin can edit
answer keys here." `tenantAdmin` bypasses the ownership check.

---

## 6. Interactions & motion (cite §4 motion tokens)

1. **Open item → re-fetch:** Editor mounts → `getItemForEdit` fires.
   `AnswerKeyLock` cross-fades `fetching`→`protected` over
   `base 220ms / ease.standard`. Skeleton fades out `fast 160ms`.
2. **Mark/enter correct answer:** Each `AnswerInput` change marks
   `setHasUnsavedChanges` and clears the strip-warning the instant
   `answerKeyLooksStripped` flips false (banner exits `exit / fast 160ms`).
3. **Autosave (optimistic):** `performAutoSave` debounces; **but** if
   `looksAnswerKeyStripped` is true, autosave is **suppressed** and the manual
   `ConfirmDialog` is required — optimistic save is unsafe because a stripped
   overwrite is destructive and irreversible.
4. **Confirm destructive save:** If the teacher hits Save while stripped →
   `ConfirmDialog` (`e3` modal): title "Save with an empty answer key?", body
   explains the existing server key will be **replaced with blanks**.
   Destructive primary uses **Button `danger`**. Cancel returns focus to the
   answer field.
5. **Save → re-strip feedback:** On success, Toast (sonner) "Answer key saved &
   protected." with a brief lock-icon settle (no celebratory spring —
   staff/precision register, not gamification; the marigold burst is reserved
   for student XP only per §4).
6. **Explainer:** Tapping `AnswerKeyLock` opens a Popover (`e2`) entrance
   `entrance / base 220ms`. Respect `prefers-reduced-motion`: all of the above
   degrade to instant opacity swaps.

---

## 7. Content & copy (precise/staff tone)

- **Lock badge label:** "Server-protected answer key"
- **Lock sublabel (protected):** "Stored separately. Students can never read
  this."
- **Explainer Popover (DefinitionList):**
  - _Where:_ "Kept in a server-only `answerKeys` collection, split out from the
    question."
  - _Who can read:_ "Only graders and this editor — via a secured endpoint. The
    student app physically cannot fetch it."
  - _When stripped:_ "Every time you save, the answer is moved back out of the
    question."
- **Fetching:** "Fetching the protected answer key…"
- **Empty/new:** "This answer will be stored server-side once you save."
- **Strip-warning banner (P0-1):** title "This answer key looks empty." body
  "Saving now may erase the correct answer students are graded against. Re-open
  the question or re-enter the answer first."
- **Confirm destructive:** title "Save with an empty answer key?" body "The
  protected answer key for this question will be replaced with blank values.
  Submissions can't be auto-graded until you set it again." confirm "Save
  anyway" / cancel "Keep editing".
- **Re-merge error:** "Couldn't load the protected answer key. Editing is locked
  to prevent overwriting it." action "Retry".
- **Ownership-blocked Save tooltip:** "Only the space owner or a tenant admin
  can edit answer keys here."
- **Save success Toast:** "Answer key saved & protected."

Tone: factual, reassuring-by-precision. No exclamation, no emoji in body copy;
the lock glyph carries the affect.

---

## 8. Domain rules surfaced (real backend invariants)

1. **Client-deny subcollection.** `firestore.rules` declares
   `match /answerKeys/{keyId} { allow read, write: if false; }` under **both**
   the nested (`…/storyPoints/{spId}/items/{itemId}/answerKeys`) and flat
   (`…/items/{itemId}/answerKeys`) item paths. No client SDK — teacher _or_
   student — can read/write it. Mutation is Admin-SDK-only inside `saveItem`.
2. **Split happens only for `timed_test`/`test` + `question`.** `save-item.ts`:
   `isTimedTest = storyPoint.type === "timed_test" || "test"`,
   `isQuestion = data.type === "question"`, and `payload.questionData` present.
   Otherwise the answer stays inline (no isolation).
3. **`extractAnswerKey()` shape is per-type** (`create-item.ts`): MCQ/MCAQ →
   array of correct option `id`s; true-false/numerical/text → `correctAnswer`
   (numerical `tolerance` packed as `acceptableAnswers:[{tolerance}]`);
   fill-blanks → `[{id,correctAnswer,acceptableAnswers}]`; fill-blanks-dd →
   `[{id,correctOptionId}]`; matching → `[{id,left,right}]`; jumbled →
   `correctOrder`; group-options → `[{id,correctItems}]`. **AI-evaluated types**
   (paragraph, code, audio, image_evaluation, chat_agent_question) return `null`
   from `extractAnswerKey` — they carry `evaluationGuidance` / `modelAnswer`
   instead, merged via the `default` branch. The author affordance must render
   the correct control set per type.
4. **`stripAnswerFromPayload()` is the inverse** and runs on **every** create
   and update where a key exists — the item document persisted to Firestore is
   always blank. For **matching**, strip does _not_ delete the right column; it
   relies on shuffled mapping (so `answerKeyLooksStripped` deliberately returns
   `false` for matching — undetectable client-side).
5. **`mergeAnswerKey()` (read path) is the only un-strip.** `getItemForEdit` is
   teacher/admin-gated; for non-question items it returns the item untouched; if
   no `answerKeys` doc exists it returns the item as-is.
6. **P0-1 guard.** `answerKeyLooksStripped()` detects an all-blank key (MCQ:
   every option `!isCorrect`; numerical/true-false/text: `correctAnswer`
   undefined; fill-blanks: every blank blank; etc.) and blocks silent overwrite
   via warning + confirm. It is a **client heuristic**, not a server guarantee —
   the server still strips whatever it's given, so the UX must prevent the bad
   save, not the server.
7. **Delete cascades the key.** Soft-delete in `saveItem` (`data.deleted`)
   batch-deletes the entire `answerKeys` subcollection before deleting the item
   — surface this in the item-delete confirm.
8. **Tenant isolation.** All paths are tenant-scoped (`tenants/{tenantId}/…`);
   the callable asserts `assertTeacherOrAdmin(callerUid, tenantId)`.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Lock badge/explainer trigger → answer-editing controls (DOM
  order per type) → strip-warning banner (if present, `role="alert"`, focusable
  for SR) → footer Save/Cancel.
- **Keyboard:** Explainer Popover opens on Enter/Space, closes on Esc, returns
  focus to the badge. `ConfirmDialog` traps focus, Esc = cancel (the safe
  default). Save's disabled state is reachable and announces its tooltip via
  `aria-describedby`.
- **ARIA:** `AnswerKeyLock` is `aria-label="Answer key, server-protected"`;
  strip-warning uses `role="alert"` so SRs announce it immediately on
  appearance. The fetching state sets `aria-busy="true"` on zone B.
- **Status never by color alone** (§2.3): lock glyph + text; warning = ⚠ icon +
  amber + text; error = icon + red + text. All pairs meet AA (4.5:1 body / 3:1
  UI) using `status.warning`/`status.error`/`text.*`.
- **Reduced motion:** all cross-fades/popovers degrade to opacity-only / instant
  per `prefers-reduced-motion`.
- **Contrast:** `AnswerKeyLock` badge uses `bg.inset` + `text.secondary` + lock
  in `brand.primary` — AA.

---

## 10. Web ↔ mobile divergence

The teacher portal is the canonical authoring surface; on **mobile (Expo /
`ui-native`)**:

- `AnswerKeyLock`, `InlineAlert`, `ConfirmDialog`, `AnswerInput` keep **1:1
  names/props** (§6).
- Explainer **Popover → bottom `Sheet`** (no hover; tap to open). No
  `⌘K`/command palette involvement.
- Hover affordances on the lock badge → press states; touch targets ≥44px (§4).
- The re-merge `LoadingOverlay` is full-width on mobile (single column) vs.
  scoped to zone B on web.
- Destructive `ConfirmDialog` → native action-sheet style but same copy and
  `danger` styling.
- The student native app **never** renders any of this — same invariant: the
  stripped item is all the student SDK can fetch.

---

## 11. Claude-design prompt

```text
Design the "Answer Key Management & Protection" affordance for the Auto-LevelUp teacher portal,
strictly conforming to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md
("Modern Scholarly": warm paper neutrals, deep indigo brand.primary — NOT SaaS blue, marigold spark
reserved for student gamification only, Fraunces display / Schibsted Grotesk UI / Spline Sans Mono
numerics; banned: Inter/Roboto, #3B82F6, glass morphism). Use ONLY foundation §5 components.

Context: this is an INLINE region inside the Item Editor (not a standalone page), shown only when a
gradable question lives inside a timed_test/test story point. Its purpose is to make a server-only,
client-deny answer-key subcollection legible and safe to edit for teachers/tenantAdmins.

Compose three stacked zones in the editor's reading column (≤720px):
(A) AnswerKeyLock — a pill badge with a lock glyph (brand.primary), bg.inset background, label
    "Server-protected answer key" + sublabel "Stored separately. Students can never read this.",
    with a tappable "How is this protected?" Popover containing a DefinitionList (where/who/when).
    Give it three states: protected, fetching (Skeleton + LoadingOverlay over the answer fields,
    aria-busy), and stripped-warning.
(B) AnswerInput in AUTHOR mode dispatched per question type (MCQ correct checkmarks, numerical
    value+tolerance, text + acceptable-answers list, fill-blanks per-blank answers, etc.).
(C) An InlineAlert (status.warning, role="alert") titled "This answer key looks empty." shown only
    when the client guard answerKeyLooksStripped is true; saving in that state routes through a
    ConfirmDialog with a danger primary ("Save anyway"/"Keep editing").

Also render the re-merge ERROR fail-safe: if loading the protected key fails, lock the answer fields
read-only with a status.error InlineAlert + Retry, so a teacher can never overwrite an unverified key.

Tone: precise, reassuring, staff register — no celebratory motion (no marigold burst here). Use §4
motion: base/220ms ease.standard cross-fades, fast/160ms banner exit; respect prefers-reduced-motion.
Meet WCAG AA, never encode status by color alone (icon + text always). Produce desktop (lg two-pane)
and mobile (Sheet instead of Popover, full-width overlay) variants.
```
