# Import from Question Bank — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens, type, spacing,
> motion, and components are cited by name from that file — never redefined
> here.

A modal multi-select picker that lets staff pull existing, vetted questions out
of the tenant-wide **question bank** and copy them into the story point they're
currently editing. Server-side copy keeps answer keys safe and bumps each source
question's usage count.

---

## 1. Purpose & primary user

**Primary user:** `teacher` and `tenantAdmin` (gated by `assertTeacherOrAdmin`).
**Job-to-be-done:** _"I'm building a story point's content. I've already
authored good questions before — let me find them in the bank, preview them,
pick several, and drop copies into this story point without re-typing or
re-grading."_

This is a **reuse / authoring-efficiency** flow, not a student-facing surface.
Tone is **precise for staff** (see §7). The screen never exposes student
gamification chrome (`spark`, `XPMeter`, `StreakFlame`).

---

## 2. Entry points & route

- **Not a route.** It is a `Modal/Dialog` (`QuestionBankImportDialog`) launched
  from within the **Space Editor** (`SpaceEditorPage`) — specifically from the
  **Content tab / item picker** of a selected story point (an "Import from bank"
  action sits beside "Add item" / `ItemEditor`).
- Opens with context already bound: `{ tenantId, spaceId, storyPointId }` and an
  optional `sectionId`.
- On success it calls `onImported()` so the parent re-fetches the story point's
  item list, then closes.

**Common-API powering it** (`docs/rebuild-spec/specs/common-api.md`
§"v1.levelup.\*"):

- **Read:** `listQuestionBank` — paginated/filterable list of `QuestionBankItem`
  for the tenant. Supports server filters (`subject`, `difficulty`,
  `bloomsLevel`, `questionType`), `sortBy`/`sortDir`, cursor paging
  (`startAfter` → `lastId` / `hasMore`), and client-side `search` / `topics` /
  `tags` narrowing. _(The current implementation reads the `questionBank`
  collection directly; the rebuild routes through `listQuestionBank` so RN and
  web share identical paging — common-api §pagination.)_
- **Write:** `importFromBank` — server copies selected items into the story
  point's `items` subcollection, assigns monotonic `orderIndex`, sets
  `createdBy`, and `FieldValue.increment(1)`s each source's `usageCount` (+
  `lastUsedAt`). Returns `{ success, importedCount, itemIds }`. Uses
  `db.getAll(...)` batch reads to load all selected bank docs in one round-trip.

---

## 3. Layout — wireframe-as-text

The dialog renders above the `AppShell`/`PlatformLayout` of `SpaceEditorPage` on
a scrim (`e3` modal elevation, scrim = `ink-900` @ ~50%). Width clamps to
~`max-w-2xl` (672px); height clamps to `max-h-[80vh]` with the body region
scrolling, header + footer pinned.

```
┌─ Modal/Dialog · radius lg · e3 ─────────────────────────────┐
│ HEADER (pinned)                                              │
│  [Library icon]  Import from Question Bank      (text-xl/    │
│                                                  Fraunces)   │
│  Pull vetted questions into this story point.  (text-sm/sec.)│
├─────────────────────────────────────────────────────────────┤
│ FILTER BAR (pinned)                                         │
│  [🔍 Search content, subject, topic…]  (Input, full width) │
│  [Type ▾][Difficulty ▾][Bloom's ▾][Subject ▾]  (Chips/      │
│                                       QuestionBankFilter)    │
├─────────────────────────────────────────────────────────────┤
│ RESULTS LIST (scroll · min-h 200 · max-h ~400)             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [✓] Question title or content (line-clamp-2)          │ │
│  │     [MCQ] [medium] · Algebra · Used 4×    [Preview ▸] │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [ ] Another question…                                 │ │
│  └───────────────────────────────────────────────────────┘ │
│  …                                                          │
├─────────────────────────────────────────────────────────────┤
│ FOOTER (pinned · border.subtle top)                        │
│  3 questions selected      [Cancel]  [Import (3)] (spark?)  │
└─────────────────────────────────────────────────────────────┘
```

**Optional preview pane (lg):** at `lg` the dialog may widen to a two-pane split
— left = results list, right = `ContentRenderer` preview of the focused/hovered
item (rendered question + metadata, **answer key masked** via `AnswerKeyLock`).
At `sm` the preview collapses into a tap-to-expand row (`Accordion`-style) so
the list stays single-column.

**Target placement (optional):** a small "Add to: this story point ▸ section"
`Select`/`Combobox` row may sit above the footer when the parent passes a list
of sections, mapping to the `sectionId` arg. Default target is the
currently-edited story point with `sectionId: null`.

**Responsive:**

- **sm (<768):** dialog becomes a near-full-screen `Drawer/Sheet` from the
  bottom; filters collapse into a single "Filters" `Button` that opens a
  `Popover`; no side preview (inline expand only); footer stays pinned.
- **md (768–1023):** centered modal, single-column list, inline filter chips,
  preview-on-expand.
- **lg (≥1024):** centered modal, optional two-pane list + live
  `ContentRenderer` preview.

---

## 4. Components used (from §5)

- **`Modal/Dialog`** (`e3`) — container; → `Drawer/Sheet` on `sm`.
- **`Input`** with leading `Search` icon — text search.
- **`QuestionBankFilter`** _(proposed addition, see below)_ composed from
  `Select`/`Combobox` + `Chip/Tag` for `questionType` / `difficulty` /
  `bloomsLevel` / `subject`.
- **`QuestionCard`** (compact/list variant) — each result row dispatches over
  the 15 question types for the preview; in list mode it shows title + `Badge`s.
  Selection adds a leading `Checkbox`.
- **`Checkbox`** — per-row multi-select (replaces the ad-hoc square-Check button
  in the current code).
- **`Badge` / `Chip/Tag`** — `questionType` (outline), `difficulty`
  (capitalized, color-mapped via `grade`/`confidence`-adjacent neutral chips),
  `subject`, `Used N×` (`Spline Sans Mono` for the numeral).
- **`ContentRenderer`** — md + KaTeX preview of question content (preview pane /
  expanded row).
- **`AnswerKeyLock`** — visual guard in preview confirming the answer key exists
  but is server-held and copied server-side (never rendered here).
- **`Select`/`Combobox`** — optional target story-point/section picker
  (`sectionId`).
- **`Skeleton`** — 4 row placeholders during load.
- **`EmptyState`** — empty-bank and no-results variants (`Library` icon).
- **`InlineAlert`/`Banner`** — error state inside the dialog.
- **`Button`** — `secondary` Cancel, `primary` (or `spark` for emphasis) Import;
  **`IconButton`** for "Preview".
- **`Toast` (sonner)** — post-import confirmation with count.
- **`Pagination`** / "Load more" — drives `listQuestionBank` cursor (`hasMore` /
  `lastId`).

**Proposed addition — `QuestionBankFilter`:** a small composite (not a new
primitive) wrapping `Select`s + a search `Input` that emits the
`listQuestionBank` filter args. Justified because the brief explicitly names it
and it standardizes bank filtering across this dialog and the standalone
Question Bank page. Built entirely from existing §5 primitives — no new tokens.

---

## 5. States

| State                  | Trigger                                                                    | Treatment                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading**            | dialog opens / filter or page change                                       | 4× `Skeleton` rows (`h-16`, radius `lg`); filter bar interactive but list dimmed; footer disabled.                                                            |
| **Empty (bank)**       | `items.length === 0` and no filters                                        | `EmptyState`: `Library` icon (muted), "Your question bank is empty." + link "Add questions on the Question Bank page."                                        |
| **Empty (no results)** | filters/search return nothing                                              | `EmptyState`: "No matches." + `Button` "Clear filters".                                                                                                       |
| **Partial**            | `hasMore === true`                                                         | List + "Load more" / `Pagination`; selection persists across pages (selected set keyed by item id).                                                           |
| **Error (load)**       | `listQuestionBank` rejects                                                 | `InlineAlert` (`status.error`, `AlertCircle`) "We couldn't load the question bank." + "Retry"; list area hidden.                                              |
| **Importing**          | Import pressed                                                             | Footer Import button → spinner + "Importing…"; list + filters disabled; Cancel disabled; rows non-interactive.                                                |
| **Error (import)**     | `importFromBank` rejects                                                   | `InlineAlert` above footer with server message (e.g. "Cannot import more than 50 questions at once"); selection preserved so the user can deselect and retry. |
| **Success**            | import resolves                                                            | `Toast` "Imported N questions into this story point." · dialog closes · `onImported()` re-fetches items.                                                      |
| **Partial-import**     | server skipped invalid/missing bank docs (`importedCount < selected.size`) | `Toast` (warning tone) "Imported N of M — K questions were skipped." (server `continue`s past invalid `QuestionBankItem`s and non-existent docs).             |

**Permission-gated:** the entire dialog is unreachable to non-staff — the
launching action only renders for `teacher`/`tenantAdmin`. `tenantAdmin` sees
bank items from any author; both roles are scoped to **their own tenant**
(`tenants/{tenantId}/questionBank`). No role sees answer keys (§8).

---

## 6. Interactions & motion

- **Open:** scrim fades + dialog scales/translates in over `base` 220ms
  `ease.entrance` (sheet slides up on `sm`). **Close/exit:** `fast` 160ms
  `ease.exit`.
- **Type/filter:** search input debounced (~250ms); server filters (`Select`)
  refetch via `listQuestionBank`. List swaps with a `fast` cross-fade; the
  selected set is **preserved** across filter and page changes.
- **Row select:** clicking a row (or its `Checkbox`) toggles membership;
  selected row gets `brand.primary` border + `indigo-50` (`bg`) tint, checkbox
  fills `brand.primary` with a `Check`; transition `instant` 100ms
  `ease.standard`. Footer count updates live.
- **Preview:** hover (web) or tap "Preview" focuses the right pane / expands the
  row; `ContentRenderer` animates open `fast`. `AnswerKeyLock` badge shown —
  never the key.
- **Select-all (visible):** an optional header checkbox toggles all _currently
  filtered_ rows.
- **Import (no optimistic write):** because the server assigns `orderIndex` and
  resolves which bank docs are valid, the copy is **not** optimistic. Pressing
  Import shows the in-button spinner; on resolve we surface the authoritative
  `importedCount` via `Toast`. (Optimistic UI would risk showing copies the
  server skipped.)
- **Confirmation:** no extra `ConfirmDialog` for normal imports (additive,
  reversible by deleting items). The UI should cap selection at 50 and disable
  further checkboxes with a tooltip rather than let the user trip the server's
  50-item `invalid-argument` error.
- **Reduced motion:** all scale/translate/cross-fade collapse to opacity-only or
  instant per `prefers-reduced-motion` (§4).

---

## 7. Content & copy

**Tone:** precise, efficient, staff-facing — verbs over adjectives, no
exclamation, no student gamification copy.

- **Title:** "Import from Question Bank"
- **Description:** "Pull vetted questions into this story point. Copies are
  independent — editing them won't change the originals."
- **Search placeholder:** "Search content, subject, or topic…"
- **Filter labels:** "Type", "Difficulty", "Bloom's", "Subject"
- **Row meta:** `[questionType]` · `[difficulty]` · `subject` · "Used N×" (mono
  numeral)
- **Footer count:** "{n} question{s} selected"
- **Primary CTA:** "Import" → "Import (3)" when selected → "Importing…" while
  pending
- **Empty (bank):** title "Your question bank is empty" · body "Author questions
  on the Question Bank page, then import them here."
- **Empty (no results):** title "No matches" · body "Try clearing a filter or
  broadening your search." · action "Clear filters"
- **Error (load):** "We couldn't load the question bank. Check your connection
  and try again." · "Retry"
- **Error (cap):** "You can import up to 50 questions at once. Deselect a few
  and try again."
- **Toast (success):** "Imported {n} questions into this story point."
- **Toast (partial):** "Imported {n} of {m}. {k} questions couldn't be copied
  and were skipped."
- **Cancel:** "Cancel"

---

## 8. Domain rules surfaced

Grounded in `functions/levelup/src/callable/import-from-bank.ts` and
`list-question-bank.ts`:

1. **Answer keys are server-held.** The dialog renders question content/metadata
   only. `importFromBank` copies `questionData` (which carries the key)
   **server-side** into the new `items` doc — the key never transits the client
   preview. Surface this with `AnswerKeyLock`. (be-levelup: answer keys never
   shipped to clients.)
2. **Copy, not link.** Each import creates a **new** `UnifiedItem`
   (`type: "question"`) under `…/storyPoints/{storyPointId}/items` with a fresh
   id and `linkedQuestionId: null`. Originals are untouched; later edits
   diverge. (Confirmed by the per-doc `batch.set` of a new `itemRef`.)
3. **Monotonic ordering.** New items get
   `orderIndex = max(existing nested, legacy flat) + 1…`, appended in selection
   order — they land at the end of the story point's item list.
4. **Usage tracking.** Each successfully copied source gets `usageCount += 1`
   and `lastUsedAt = now`. This feeds the "Used N×" chip and bank sorting.
5. **Hard cap: 50 per import.** Server throws `invalid-argument` "Cannot import
   more than 50 questions at once" — the UI must enforce a 50-item selection cap
   pre-emptively.
6. **Skip-invalid, don't fail-all.** Bank docs that don't exist or fail
   `QuestionBankItemSchema` validation are logged and **skipped**; the batch
   still commits the valid ones → `importedCount` may be < selection (drives the
   partial-import toast).
7. **Tenant isolation.** All reads/writes are under `tenants/{tenantId}/…`;
   `assertTeacherOrAdmin(callerUid, tenantId)` gates both callables. A teacher
   can only see/import their own tenant's bank.
8. **Rate limited.** `importFromBank` enforces a write rate limit (30);
   `listQuestionBank` a read limit (60). Surface a friendly throttle message if
   exceeded rather than a raw error.
9. **Story point must exist.** Server calls `loadStoryPoint(...)` first; a
   deleted/invalid story point fails the import — the dialog should close and
   re-fetch if context is stale.

---

## 9. Accessibility

- **Dialog semantics:** `role="dialog"` `aria-modal="true"`, labelled by the
  title, described by the description; focus trapped within; `Esc` closes; focus
  returns to the launching control on close.
- **Focus order:** Search input → filter selects → results list → (optional
  target select) → footer count (read-only) → Cancel → Import.
- **List as a listbox of checkboxes:** each row is a labelled `Checkbox`
  (`aria-checked`), navigable with arrow keys; `Space`/`Enter` toggles; the
  row's accessible name = question title + type + difficulty so screen-reader
  users get context without entering preview.
- **Live regions:** the footer "{n} selected" count is `aria-live="polite"`; the
  success/partial outcome is announced via the `Toast` live region.
- **Loading/empty/error:** `Skeleton` rows marked `aria-busy`; `EmptyState` and
  `InlineAlert` are real text, not color-only; error uses `AlertCircle` icon +
  text (never color alone — §2 contrast rule).
- **Contrast:** selected-row `indigo-50` tint keeps `text.primary` ≥4.5:1; chips
  and `text.muted` meta meet 3:1 large/UI minimums (§2). Touch targets ≥44px on
  the sheet variant.
- **Reduced motion:** honor `prefers-reduced-motion` — opacity-only transitions,
  no scale pops.

---

## 10. Web ↔ mobile divergence

`shared-ui` (web) and `ui-native` (Expo) keep `QuestionBankImportDialog` props
1:1 (§6 cross-platform rule).

- **Container:** web = centered `Modal/Dialog`; mobile = bottom `Drawer/Sheet`,
  near-full-height, drag-to-dismiss.
- **Selection:** web = click row / hover affordance; mobile = tap row, larger
  ≥44px hit targets, no hover.
- **Filters:** web = inline filter chips/selects; mobile = a single "Filters"
  button → `Popover`/sheet to save vertical space.
- **Preview:** web `lg` = side-by-side `ContentRenderer` pane; mobile =
  tap-to-expand inline (`Accordion`), never a second pane.
- **Search:** identical debounced `Input`; mobile relies on the OS keyboard
  "search" key.
- **No ⌘K / CommandPalette** entry on mobile — only the in-editor "Import from
  bank" button launches it.
- **Paging:** both share `listQuestionBank` opaque-cursor logic; mobile uses
  on-scroll "load more", web a `Pagination`/"Load more" control.

---

## 11. Claude-design prompt

```text
Design the "Import from Question Bank" dialog for the Auto-LevelUp teacher web app, STRICTLY following the
Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md. Compose ONLY from its tokens and components
— do not invent colors, fonts, or variants. Banned: Inter/Roboto, SaaS blue #3B82F6, glass morphism, gradients.

Context: a teacher/tenantAdmin is editing a story point in the Space Editor and wants to copy existing
questions from the tenant question bank into it.

Build a centered Modal/Dialog (radius lg, elevation e3, warm paper scrim), max-w ~672px, max-h 80vh, with a
pinned header, pinned filter bar, a scrolling results list, and a pinned footer:

- HEADER: Library icon + "Import from Question Bank" in Fraunces (text-xl), subtitle in Schibsted Grotesk
  (text-sm, text.secondary): "Pull vetted questions into this story point. Copies are independent."
- FILTER BAR: a full-width search Input with a leading Search icon; below it a QuestionBankFilter row of
  Selects/Chips for Type, Difficulty, Bloom's, Subject.
- RESULTS LIST: stacked selectable rows (compact QuestionCard variant) each with a leading Checkbox, a
  line-clamped title/content, and a meta row of Badges: questionType (outline), difficulty (capitalized,
  color-mapped to grade/confidence scale), subject (text.muted), and "Used N×" with the numeral in Spline Sans
  Mono. Selected rows get a brand.primary (indigo-600) border + indigo-50 tint + filled checkbox. At lg, add a
  right-hand preview pane rendering the focused question via ContentRenderer (md+KaTeX) with an AnswerKeyLock
  badge — NEVER show the answer key.
- FOOTER: left = "{n} questions selected" (aria-live), right = secondary "Cancel" + primary "Import (3)".

States to render: skeleton loading (4 rows), empty-bank EmptyState (Library icon, "Your question bank is
empty"), no-results EmptyState ("No matches" + Clear filters), load error InlineAlert (status.error,
AlertCircle, Retry), importing (in-button spinner "Importing…", list disabled), and a success Toast "Imported N
questions into this story point."

Motion: dialog enters at 220ms ease.entrance, exits 160ms ease.exit, row selection 100ms ease.standard;
respect prefers-reduced-motion. Accessibility: role=dialog aria-modal, focus trap, arrow-key checkbox list,
WCAG AA contrast, status conveyed by icon+text never color alone. Mobile: render as a bottom Drawer/Sheet with
≥44px targets, filters behind a single button, tap-to-expand preview, no hover, no ⌘K.

Data shape: rows from listQuestionBank (QuestionBankItem: title, content, questionType, difficulty, subject,
topics, usageCount). Import button calls importFromBank({ tenantId, spaceId, storyPointId, sectionId?,
questionBankItemIds }) and returns { importedCount }. Do not implement answer-key handling on the client.
```
