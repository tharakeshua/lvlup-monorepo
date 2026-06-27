# AI Content Generation — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All colors, type, spacing,
> radius, elevation, motion, and components are cited by token/name — never
> re-defined here. Grounded in `docs/rebuild-spec/specs/ai-spec.md` (§4.4
> GenerationResult, §5.4 `generateContent`),
> `docs/rebuild-spec/specs/common-api.md` (AI seam),
> `packages/shared-types/src/content/item.ts` (15 `QuestionType`s, 7
> `MaterialType`s, `AUTO_EVALUATABLE_TYPES`/`AI_EVALUATABLE_TYPES`), and the
> `content-item-generator` skill patterns.

---

## 1. Purpose & primary user

**Primary user:** `teacher` (content author) and `tenantAdmin` (curriculum
owner) inside the Spaces authoring flow.

**Job-to-be-done:** "Draft a batch of well-formed content items — questions
across the 15 types, plus material — from a topic, a learning objective, or a
source PDF, with control over type mix / count / difficulty / Bloom's
distribution, then _review and edit each one_ before committing it into a Story
Point — without ever auto-publishing a hallucinated answer key and without
blowing the tenant AI budget."

This is the **AI-assisted authoring surface**, a draft factory that feeds the
per-type **Item Editor** (`item-editor.md`). It never replaces authorship: every
generated `GeneratedItem` (`ai-spec.md` §4.4) lands as a reviewable **draft** in
the same per-type sub-editor a human would use, and only a deliberate accept
persists it via `saveItem`. The screen wraps the C8 capability
(`ai.generation.generateItems`) behind the gateway, so cost logging, quota, and
moderation cannot be bypassed (`ai-spec.md` §0.5, §2.3).

---

## 2. Entry points & route

**Entry:** opened as a **Drawer/Sheet** (right-side panel, §5 Containers) from
two places:

- the **Content tab** of `SpaceEditorPage` (`/spaces/:spaceId/edit` → Content),
  via a **"Generate with AI"** spark Button on a `StoryPointNode`/section
  header;
- the **Item Editor** header ("Generate similar" / "Generate from topic"), which
  seeds `from_topic` or `adaptive_followup`.

Not a standalone route — it is a panel over the Space editor, so deep links
resolve to `?generate=1&storyPoint=:spId` on the editor route.

**Common-API reads/writes** (cite `common-api.md` §3.3 levelup + `ai-spec.md`
§5.4, §6):

- **NEW — `v1.levelup.generateContent`** (`rateTier: ai`): the generation call.
  Contract:
  `generateContent({ spaceId?, storyPointId?, mode, source }) -> { items: GeneratedItem[] }`
  where `mode: 'from_topic' | 'from_pdf' | 'adaptive_followup'` and
  `source: { topic?, objective?, difficulty?, count?, questionTypeMix?, bloomsLevels?, materialTypes?, rubricPresetId?, pdfStoragePaths?, seedItemIds? }`.
  Runs through `callLLM` with `generation.v1` + `GenerationResultSchema`; output
  `payload` is validated against the discriminated `UnifiedItemPayload` union
  (`ai-spec.md` §5.4). `tenantId` is derived server-side from the active-tenant
  claim (`common-api.md` §4.4) — **never** in the request body.
- **Streaming:** generation streams item-by-item via the realtime seam
  (`common-api.md` §10 / `ai-spec.md` §2.2 `generateStream`) so cards appear as
  they're produced; non-streaming fallback returns the full `items[]` array.
- **Write — `v1.levelup.saveItem`** (`rateTier: write`): each accepted draft
  persists exactly as in the Item Editor; server strips answer keys into the
  server-only subcollection on save (`common-api.md` §3.3).
- **Read (context only):** `v1.levelup.getSpace`, `v1.levelup.listStoryPoints`,
  and the rubric-preset list behind `saveRubricPreset` for the rubric picker —
  these belong to the parent editor and the rubric chooser, not the generation
  call itself.
- **PDF source:** `uploadItemMedia` (Storage) for `from_pdf`; the server reuses
  the autograde PDF→base64 download path (`ai-spec.md` §5.4).

---

## 3. Layout — wireframe-as-text

Rendered inside the AppShell (Sidebar + Topbar) Space-editor route; the panel
itself is a **Drawer/Sheet** (§5 Containers, `e3` elevation, `bg.surface`). Two
internal phases share one chrome: **(A) Configure** and **(B) Review** — a
two-step flow inside the drawer (not separate routes). A thin step indicator
sits in the sticky header.

```
┌─ Drawer (right sheet, bg.surface, radius lg, e3) ─────────────────┐
│ HEADER (sticky)                                                   │
│  [‹ back IconButton]  Generate content   ① Configure → ② Review  │  ← step indicator
├──────────────────────────────────────────────────────────────────┤
│ PHASE A — CONFIGURE (scrolling column, reading-measure ~720)     │
│  ── SOURCE (Tabs) ──                                              │
│   [ From topic ] [ From PDF ] [ Follow-up from items ]           │
│   Topic / objective  [Textarea]                                   │
│   (PDF tab → FileDrop · UploadQueueItem)                          │
│   (Follow-up tab → seed item Chips picked from this Story Point)  │
│                                                                  │
│  ── MIX & SHAPE ──                                                │
│   Total count        [Slider 1–20 · mono value]                  │
│   Difficulty         [Select easy/medium/hard]  (or per-Bloom)   │
│   Question-type mix  [Chip/Tag multiselect of the 15 types]      │
│                      └ per-chip count Stepper (mono)             │
│   Material types     [Chip/Tag multiselect of the 7 types]       │
│   Bloom's distribution                                           │
│      Remember ▓▓░░  Understand ▓▓▓░  Apply ▓▓░░ … (Sliders)      │
│   Rubric (AI-graded types)  [Select rubric preset / inherit]     │
│                                                                  │
│  ── COST PREVIEW (InsightCard, status.info) ──                   │
│   ~Est. 6–9k tokens · ~$0.01 · within monthly budget            │
├──────────────────────────────────────────────────────────────────┤
│ FOOTER (sticky)   [Cancel]        [✦ Generate  N items]          │  ← spark Button
└──────────────────────────────────────────────────────────────────┘

┌─ PHASE B — REVIEW (same drawer, after Generate) ─────────────────┐
│ HEADER  [‹ back]  Review 7 drafts   ① ── ② Review                │
│  [⟲ Regenerate all]   accepted 3 / 7   (ProgressBar)            │
├──────────────────────────────────────────────────────────────────┤
│  STREAMING / RESULT LIST (column of draft cards)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ QuestionCard (authoring preview)  [mcq · Apply · medium]  │   │
│  │  via ContentRenderer (md + KaTeX)                         │   │
│  │  [✎ Edit]  [↻ Regenerate this]  [✕ Discard]  [✓ Accept]   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ QuestionCard  [code · Apply · hard]  ⚠ needs answer-key   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  … (Skeleton card while next item streams in)                    │
├──────────────────────────────────────────────────────────────────┤
│ FOOTER (sticky)  [Discard all]      [✓ Accept all valid (4)]     │  ← bulk-accept
└──────────────────────────────────────────────────────────────────┘
```

**Editing a draft:** "✎ Edit" expands the card in place into the full **Item
Editor** sub-editor (registry-dispatched, `item-editor.md` §4), or opens the
Item Editor drawer stacked above — the same `{ data, onChange, errors }`
contract. Edits stay local until Accept.

**Responsive:**

- **lg (≥1024):** drawer ~600–680px overlay; parent Space editor visible beneath
  the scrim; Bloom's sliders side-by-side.
- **md (768–1023):** drawer ~80vw; cost InsightCard and Bloom's sliders stack to
  one column.
- **sm (<768):** full-screen **Sheet** (bottom-up); Source Tabs become a
  scrollable segmented control; draft cards single-column; the per-card action
  row collapses Edit/Regenerate/Discard into an overflow IconButton, leaving
  Accept primary.

---

## 4. Components used (§5 only)

- **Containers:** Drawer/Sheet (host), Tabs (Source: topic / PDF / follow-up),
  Section (Mix & Shape, Cost), Accordion (advanced per-type counts on `sm`).
- **Primitives:** Textarea (topic/objective), FileDrop (PDF), Slider (total
  count, Bloom's distribution), Select (difficulty, rubric preset), Combobox /
  Chip-Tag multiselect (the 15 question types, 7 material types, seed items),
  Stepper via Input·mono (per-type count), Button (`spark` **Generate**, primary
  **Accept all**, ghost Cancel/Discard, danger Discard all), IconButton (back,
  regenerate, discard, overflow).
- **Data / feedback:** Badge / Chip-Tag (type · Bloom's · difficulty tags on
  each draft card), ProgressBar (accepted N/total, generation progress),
  Skeleton (streaming-in draft placeholder card), EmptyState (no source
  provided; zero results), InlineAlert/Banner (quota soft-warn at 80%,
  blocked-content notice, per-card answer-key warning), Toast/sonner (accept /
  save / regenerate outcomes), ConfirmDialog (discard-all,
  close-with-unaccepted-drafts), LoadingOverlay (only for the brief
  non-streaming fallback), FormFieldError (per-config-field).
- **Domain components:**
  - **`ContentRenderer`** — the **single** markdown + KaTeX surface rendering
    each draft's `content` in the review card (authoring preview = student view,
    one renderer; webapps-design §2.3).
  - **`QuestionCard`** — drives the per-type authoring preview of each generated
    draft via the registry dispatch (the same dispatch the Item Editor and
    student runner use).
  - **`InsightCard`** — the **cost & token estimate** card (status.info) before
    Generate, and the post-run actual-cost summary.
  - **`AnswerKeyLock`** — the server-only-guard visual on any draft of an
    `AUTO_EVALUATABLE` type whose key would be stripped on save (timed-test
    context).
  - **`RubricBreakdown`** — read-only preview of the `suggestedRubric`
    (`ai-spec.md` §4.4) attached to AI-graded draft types.
  - `StoryPointNode` context chip in the header crumb (which node these drafts
    will land under).

**Proposed addition to FOUNDATION (justified):** a **`GenerationConfigPanel`** +
**`DraftReviewCard`** pair under §5 domain components. Both are **composition
glue, not new visual primitives**: `GenerationConfigPanel` arranges existing
Slider/Select/Chip-Tag/Textarea primitives into the Mix & Shape contract;
`DraftReviewCard` is a `Card` wrapping `QuestionCard` + a fixed action row
(Edit/Regenerate/Discard/Accept) and a status Badge. They share the Item
Editor's `{ data, onChange, errors }` registry contract so no per-type bespoke
UI is invented. Register them so the streaming generation list and the
bulk-accept queue have one card contract.

---

## 5. States

**Loading — Configure:** rubric-preset Select and seed-item picker show
**Skeleton** rows while presets/items load; the rest of the form is usable
immediately.

**Loading — Generation (streaming):** on Generate, Phase B mounts with a
**ProgressBar** ("Generating 0/7…") and a column of **Skeleton** draft cards;
each completed `GeneratedItem` replaces a skeleton via the stream
(`generateStream`). For the non-streaming fallback, a single **LoadingOverlay**
with copy "Drafting your items…" covers the list until `items[]` resolves.

**Empty:**

- **No source yet:** Generate is `disabled`; an **EmptyState** under the source
  Tabs reads "Describe a topic, drop a PDF, or pick items to follow up on."
- **Zero results:** model returned `items: []` → **EmptyState** ("No items
  generated — try a more specific topic or fewer constraints") with a
  **Regenerate** Button.

**Error:**

- **Quota:** `AI_QUOTA_EXCEEDED` (`ai-spec.md` §2.5) → **InlineAlert**
  (`status.error`) "Monthly AI budget reached — generation is paused"; Generate
  `disabled`. Soft-warn at 80% shows a `status.warning` banner but allows
  generation.
- **Blocked content:** `AI_CONTENT_BLOCKED` (moderation, `ai-spec.md` §5.7) →
  InlineAlert "This topic was blocked by the safety filter. Edit and retry."
  Generate stays enabled after edit.
- **Circuit open / provider outage:** `AI_CIRCUIT_OPEN` → InlineAlert "AI is
  temporarily unavailable. Try again shortly." with `retryable` hint.
- **Schema/parse failure** (rare; `ai-spec.md` §2.3 step 8 fails loud): per-card
  **InlineAlert** "Couldn't parse this item" with a **Regenerate this** action;
  other valid drafts are unaffected.
- **Save failure on accept:** sonner **Toast** error; the draft card returns to
  its un-accepted state; no data loss.

**Partial:** the common, expected state — some drafts accepted, some pending,
some invalid. The header **ProgressBar** reads `accepted N / total`; each card
carries a status Badge (`Draft` `spark` · `Needs edits` `status.warning` ·
`Accepted` `status.success`). **"Accept all valid"** acts only on cards that
pass `validateItem` (Item Editor §8), counting them in the button label.

**Success:** all desired drafts accepted → Toast "4 items added to {Story
Point}"; drawer offers **"Generate more"** (returns to Phase A with config
retained) or **Done** (closes and refreshes the parent Content tab).

**Permission-gated variations:**

- `teacher` / `tenantAdmin`: full screen.
- Generated items are **always drafts** — there is no auto-publish path for any
  role (`ai-spec.md` §5.4).
- On a **timed_test / test** Story Point: accepted `AUTO_EVALUATABLE` drafts
  surface the `AnswerKeyLock` visual and the answer-key warning before save,
  identical to the Item Editor (the key is stripped server-side on `saveItem`).
- Viewer/observer roles never reach this panel (gated upstream by the Space
  editor route).

---

## 6. Interactions & motion

- **Open/close:** Drawer slides in on `ease.entrance` at `base` (220ms); exit on
  `ease.exit`. `prefers-reduced-motion` → opacity-only.
- **Phase transition (Configure → Review):** horizontal slide on `ease.standard`
  at `slow` (320ms); step indicator fills on `fast` (160ms). Reduced-motion →
  crossfade.
- **Streaming reveal:** each arriving draft card fades + rises 8px on
  `ease.entrance` `fast`; the ProgressBar advances on `base`. The
  skeleton-to-card swap never shifts layout (skeleton matches card height).
- **Generate Button:** `spark` variant with the §4 spark-glow shadow (the one
  allowed energetic accent on this staff tool); on click it shows an inline
  spinner and label "Generating…". This is config-trigger energy, **not** the
  gamification celebration moment (reserved for the student surface, §4).
- **Per-card actions:**
  - **Accept** — optimistic: card flips to `Accepted` (`status.success`,
    checkmark icon) immediately; `saveItem` fires; on failure it reverts with a
    Toast.
  - **Regenerate this** — replaces the single card with a Skeleton, re-calls
    `generateContent` for that one slot (same config, `count: 1`), settles on
    `ease.entrance`.
  - **Edit** — expands the card into the registry sub-editor inline; edits are
    local until Accept.
  - **Discard** — card collapses on `ease.exit` `fast` and is removed from the
    queue.
- **Bulk actions (ConfirmDialog-gated):**
  - **Accept all valid** — sequentially `saveItem`s each valid draft with a
    per-card progress tick; partial failures leave failed cards in place with a
    Toast summary.
  - **Discard all** / **Close with un-accepted drafts** → "You have N
    un-accepted drafts. Discard them?"
- **Cost feedback:** the InsightCard estimate updates live (debounced
  `instant`/100ms) as count / types / Bloom's change; after the run it flips to
  the **actual** cost from `LlmResponse.costUsd`.

---

## 7. Content & copy

Tone: **precise, instructional** (staff register — not the encouraging student
voice). AI is framed as a drafting assistant, never an authority.

- **Header:** `Generate content` → `Review {N} drafts`.
- **Source Tabs:** `From topic` · `From PDF` · `Follow-up from items`.
- **Config labels:** `Topic or learning objective`, `Total count`, `Difficulty`,
  `Question-type mix`, `Material types`, `Bloom's distribution`,
  `Rubric for graded items`.
- **Generate Button:** `✦ Generate {N} items` → `Generating…`.
- **Cost InsightCard (pre-run):** "Estimated ~{tokens} tokens · ~${cost}. Counts
  against this month's AI budget."
- **Cost InsightCard (post-run):** "Used {tokens} tokens · ${cost} this run."
- **Soft budget warning:** "You've used 80% of this month's AI budget."
- **Hard budget block:** "Monthly AI budget reached — generation is paused. Ask
  an admin to raise the cap."
- **Safety block:** "This topic was blocked by the safety filter. Edit it and
  try again."
- **Empty — no source:** "Describe a topic, drop a PDF, or pick items to follow
  up on."
- **Empty — zero results:** "No items generated — try a more specific topic or
  fewer constraints."
- **Per-card badges:** `Draft` · `Needs edits` · `Accepted`.
- **Answer-key note (timed test):** "Correct answers are stored in protected
  server storage on save — never sent to students."
- **Draft disclaimer (review header):** "AI drafts — review and edit each item
  before adding it."
- **Accept outcomes:** "{N} items added to {Story Point}" · "Couldn't save this
  item — try again."
- **Bulk confirm:** "You have {N} un-accepted drafts. Discard them?"

---

## 8. Domain rules surfaced

Grounded in `ai-spec.md`, `item.ts`, and `common-api.md`:

1. **Drafts only — never auto-publish.** `generateContent` returns
   `GeneratedItem` drafts; nothing persists until a human Accepts → `saveItem`
   (`ai-spec.md` §5.4). The review step is mandatory; there is no "generate and
   publish" shortcut.
2. **Answer keys never reach students.** Every accepted `AUTO_EVALUATABLE` draft
   (mcq, mcaq, true-false, numerical, fill-blanks, fill-blanks-dd, matching,
   jumbled, group-options — `item.ts`) carries a concrete key that `saveItem`
   strips into the **server-only subcollection** (`common-api.md` §3.3). The
   `AnswerKeyLock` visual surfaces this on timed-test Story Points.
3. **Auto- vs AI-evaluatable split drives the draft shape.** `AI_EVALUATABLE`
   types (text, paragraph, code, audio, image_evaluation, chat_agent_question —
   `item.ts`) are generated with `evaluationGuidance` / `modelAnswer` /
   `objectives` and an optional `suggestedRubric` (`ai-spec.md` §4.4), not a
   deterministic key — shown via `RubricBreakdown`.
4. **Discriminated-union validation.** The generated `payload` is validated
   server-side against the `UnifiedItemPayload` discriminated union
   (`ai-spec.md` §5.4) — closing the `z.record(unknown)` hole — so a malformed
   draft fails loud rather than persisting garbage. The same client
   `validateItem()` gates Accept.
5. **Cost & quota are gateway-enforced, not advisory.** Every generation goes
   through `callLLM` → `enforceQuota` (80% soft alert, 100% hard block) + cost
   logging on `llmCallLogs` with `promptName`/`promptVersion` (`ai-spec.md`
   §2.3, §2.5). The UI surfaces this state but cannot bypass it.
6. **Safety gate before the model.** `ai.safety.moderate` (regex pre-filter +
   model pass, `ai-spec.md` §5.7) runs on the topic/objective/PDF text before
   generation; blocked input never reaches the provider.
7. **Reproducibility.** Generation uses the versioned `generation.v1` prompt
   template; the version is logged per call (`ai-spec.md` §3) — surfaced subtly
   in the post-run InsightCard for audit.
8. **Tenant isolation.** `tenantId` is derived server-side from the
   active-tenant claim (`common-api.md` §4.4); the per-tenant Gemini/Claude key
   comes only from Secret Manager (`ai-spec.md` §2.7) — never client-side.
9. **Stats stay authoritative.** Accepting drafts triggers trigger-maintained
   Story Point / Space stat updates; the client never recomputes item counts.

---

## 9. Accessibility

- **Focus order:** back IconButton → step indicator → Source Tabs → source input
  (Textarea / FileDrop / seed picker) → count Slider → difficulty → type-mix
  Chips → Bloom's sliders → rubric Select → Cancel → Generate. In Review: back →
  Regenerate-all → first draft card (Edit → Regenerate → Discard → Accept within
  each) → Discard all → Accept all. New streamed cards do **not** steal focus
  (announced via live region instead); the bulk-accept button receives focus
  when the stream completes.
- **Keyboard:** all Tabs/Selects/Comboboxes/Sliders are arrow-navigable; Sliders
  adjust with arrows + Home/End; Enter on a focused draft card triggers Accept,
  `E` Edit, `R` Regenerate (documented in a footer hint); Esc cancels
  (ConfirmDialog when drafts are un-accepted). Chip-Tag multiselect supports
  type-ahead and Backspace-to-remove.
- **ARIA:** the generation ProgressBar uses `role="progressbar"` with
  `aria-valuenow`/`aria-valuetext` ("3 of 7 generated"); streamed cards announce
  via an `aria-live="polite"` region ("Item 4 ready: code question"); the cost
  InsightCard updates are `aria-live="polite"`; quota/safety InlineAlerts use
  `role="alert"`; each FormFieldError links via `aria-describedby`; the
  `AnswerKeyLock` carries an `aria-label` describing the protection.
- **Contrast:** spark Generate Button, status Badges, and
  `status.error`/`status.warning`/`status.success` text meet WCAG AA (4.5:1
  body, 3:1 UI). **Never status-by-color-alone** (§2.4) — every draft Badge
  pairs an icon + text label (`Draft`/`Needs edits`/`Accepted`); Bloom's
  distribution shows numeric labels alongside the bar fills.
- **Reduced motion:** drawer, phase transition, streaming reveal, and the
  spark-glow degrade to opacity/instant under `prefers-reduced-motion`; the
  ProgressBar still advances (informational, not decorative).

---

## 10. Web ↔ mobile divergence

Component names/props match 1:1 across `shared-ui` and `ui-native` (§6); only
renderers differ.

- **Container:** web right-side **Drawer**; mobile bottom **Sheet**,
  full-height, with a grab handle.
- **Phases:** web shows the step indicator + horizontal slide; mobile uses a
  stacked two-screen Sheet flow (Configure → Review) with a back affordance.
- **Source picker:** web FileDrop (drag-in PDF) → mobile system document/photo
  picker via `UploadQueueItem`.
- **Bloom's sliders:** side-by-side on web → stacked full-width on mobile;
  per-type count Steppers reflow from inline to one-per-row.
- **Draft card actions:** web shows Edit/Regenerate/Discard/Accept inline →
  mobile collapses Edit/Regenerate/Discard into an overflow IconButton, Accept
  stays primary; press replaces hover.
- **Streaming:** identical `generateStream` contract on both; mobile reveals
  cards one at a time with the spring-free `ease.entrance` fade.
- **ContentRenderer** preview uses the same md+KaTeX engine on both; on mobile
  the inline Edit expands into the Item Editor Sheet's Edit/Preview Tabs (no
  side-by-side room).
- **Keyboard shortcuts (E/R/Accept, Esc):** web only; mobile relies on the
  footer buttons and the per-card overflow.
- No CommandPalette/⌘K on mobile.

---

## 11. Claude-design prompt

```
Design the "AI Content Generation" drawer for the Auto-LevelUp teacher web app, strictly following
the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md). Modern Scholarly direction:
warm paper neutrals (bg.canvas/bg.surface), deep indigo brand.primary, marigold "spark" reserved for
energy — here the Generate button only, with the spark-glow shadow. Fraunces for the header (text-xl),
Schibsted Grotesk for labels/body, Spline Sans Mono for numerics (counts, token/cost estimates).
NO Inter/Roboto, NO #3B82F6 SaaS blue, NO glass morphism.

Build it as a right-side Drawer/Sheet (e3 elevation, radius lg) over a Space editor, with a TWO-PHASE
flow shown by a step indicator in the sticky header: ① Configure → ② Review.

PHASE A (Configure): a Source Tabs row (From topic / From PDF / Follow-up from items) with a Textarea
for topic/objective; a "Mix & Shape" Section with a count Slider (mono value), a Difficulty Select, a
Chip/Tag multiselect of all 15 question types (mcq, mcaq, true-false, numerical, text, paragraph, code,
fill-blanks, fill-blanks-dd, matching, jumbled, audio, image_evaluation, group-options,
chat_agent_question) each with a mono count stepper, a Chip/Tag multiselect of the 7 material types, a
Bloom's distribution as labelled Sliders, and a rubric-preset Select for AI-graded types. Below it an
InsightCard (status.info) showing "~Est. {tokens} tokens · ~${cost} · within monthly budget". Sticky
footer: ghost Cancel + a spark Button "✦ Generate {N} items".

PHASE B (Review): a header with a ProgressBar "accepted 3 / 7" and a Regenerate-all action; a streaming
column of draft cards. Each draft card = a Card wrapping a QuestionCard authoring preview (rendered via
ContentRenderer, markdown + KaTeX) + type/Bloom's/difficulty Badges + a status Badge (Draft spark /
Needs edits status.warning / Accepted status.success, icon+label, never color alone) + an action row
[✎ Edit] [↻ Regenerate this] [✕ Discard] [✓ Accept]. Show a Skeleton card streaming in, and one card
with an AnswerKeyLock + answer-key warning. Sticky footer: danger "Discard all" + primary "Accept all
valid (4)".

States to show: a quota soft-warning InlineAlert (status.warning) and a hard-block InlineAlert
(status.error) with Generate disabled; an empty source EmptyState; a zero-results EmptyState. Motion:
drawer in on ease.entrance/base, phase slide on ease.standard/slow, streamed cards fade+rise on
ease.entrance/fast, respect prefers-reduced-motion. Drafts are NEVER auto-published — every item is a
reviewable draft. WCAG AA contrast; full keyboard; aria-live for streamed cards and cost updates.
Responsive: full-screen Sheet on mobile with stacked Configure→Review screens, overflow-collapsed card
actions, no ⌘K.
```
