# Rubric Editor (4 scoring modes) — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens, type, spacing,
> motion and components are cited by name — never re-pasted or invented.

Authors a `UnifiedRubric` (`packages/shared-types/src/content/rubric.ts`) across
four scoring modes — `criteria_based`, `dimension_based`, `holistic`, `hybrid` —
and surfaces the **inheritance chain** (tenant → space → storyPoint → item) so
an author always knows whether they are editing an inherited default or a local
override.

---

## 1. Purpose & primary user

**Primary user:** `teacher` and `tenantAdmin` (content authors).

**Job-to-be-done:** "When I configure how an open-ended answer gets graded, I
want to choose a scoring model and define its criteria/dimensions/guidance once
— and clearly see whether I'm changing the tenant-wide default, this space, this
story point, or just this one item — so AI grading and human review apply the
same fair standard everywhere it should, and only diverge where I deliberately
override."

This is a precision-instrument surface for staff: tone is **precise and
unambiguous**, not playful. The single spark of energy on this screen is
reserved for the inheritance-override indicator and the save-success toast, not
decoration.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/edit` → **Rubric** tab (space-level default
rubric).

**Per-scope overrides** open the same editor in a `Drawer` (foundation §5
Drawer/Sheet) from:

- **Story-point editor** (`StoryPointTrack` node → settings) → edits
  `storyPoint.defaultRubric`.
- **Item editor** (`ItemEditor.tsx` → "Grading" section) → edits `item.rubric`.

A scope chip in the header always states which level is being authored: **Tenant
default · Space · Story point · Item**.

**Common-API reads/writes** (cite `docs/rebuild-spec/specs/common-api.md`):

- **Write (space-level):** `v1.levelup.saveSpace` — persists
  `space.defaultRubric`. Upsert convention (`save*`, id present = update). The
  `ALLOWED_TRANSITIONS` lifecycle + `validatePublish` are unaffected by rubric
  edits (rubric is metadata, not a lifecycle field).
- **Write (story-point):** `v1.levelup.saveStoryPoint` — persists
  `storyPoint.defaultRubric`.
- **Write (item):** `v1.levelup.saveItem` — persists `item.rubric`. Note
  `saveItem` strips answer keys into the server-only subcollection;
  `modelAnswer` here is evaluator guidance, **not** the student-visible answer
  key (see §8).
- **Read:** the parent editor page already loads the space/storyPoint/item via
  the spaces read hooks; the inheritance chain is computed client-side by the
  shared `resolveRubric(tenantDefault, space, storyPoint, item)` resolver,
  mirroring the backend resolver used at grade time.
- **Preset apply:** "Apply from preset" links the **Rubric Presets** screen,
  backed by `v1.levelup.saveRubricPreset` / preset list; applying copies a
  preset's `UnifiedRubric` into local editor state (no save until the author
  confirms).

---

## 3. Layout — wireframe-as-text

Hosted inside **AppShell** (foundation §5: Sidebar + Topbar) → SpaceEditorPage
tab strip. The editor itself is a single-column **Panel** with a max reading
width of ~`720` (foundation §4 reading measure) so long guidance text stays
legible; the live preview docks to the right on `lg`.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar (role nav)              Topbar (tenant switcher · search · profile)│
├────────────────────────────────────────────────────────────────────────── │
│ Breadcrumb: Spaces / {Space name} / Edit                                   │
│ Tabs: Overview · Story Points · Items · [Rubric] · Settings                │
│                                                                            │
│ ┌─ Inheritance chain bar (sticky) ─────────────────────────────────────┐  │
│ │  Tenant default → Space ▰ → Story point ○ → Item ○                    │  │
│ │  Scope chip: [ Editing: Space default ]   [Reset to inherited ↺]     │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ lg grid: [ Editor column · 1fr ]            [ Preview rail · 380px ]       │
│ ┌──────────────────────────────────────┐   ┌──────────────────────────┐   │
│ │ Scoring Mode  (4-up segmented cards)  │   │ RubricBreakdown (live)   │   │
│ │  ▸ criteria  ▸ dimension              │   │  preview of how a sample │   │
│ │  ▸ holistic  ▸ hybrid                 │   │  score renders to grader │   │
│ │                                       │   │  + students              │   │
│ │ ── mode-specific body ──              │   │ Pass line @ {passing%}   │   │
│ │  (Accordion of criteria / dimensions  │   │ AnswerKeyLock note       │   │
│ │   / holistic guidance)                │   └──────────────────────────┘   │
│ │ ── Shared settings (Section) ──       │                                  │
│ │  passingPercentage · evaluator        │   (Preview rail collapses to a   │
│ │  guidance · model answer · showModel  │    "Preview" toggle below editor │
│ │                                       │    at md/sm)                     │
│ │ [ Apply from preset ]  [ Save Rubric ]│                                  │
│ └──────────────────────────────────────┘                                  │
└────────────────────────────────────────────────────────────────────────── ┘
```

**Responsive (foundation §4 breakpoints):**

- **`sm` (<640):** single column, gutters `16`. Preview rail becomes a collapsed
  `Accordion` ("Preview") below the form. Scoring-mode cards stack 1-up. Sticky
  action bar (Save / Apply preset) pinned to bottom.
- **`md` (768):** scoring-mode cards 2×2; preview still below as a toggle.
- **`lg` (1024+):** two-column grid `editor 1fr / preview 380px`, gutters `32`;
  inheritance bar sticky at top of the panel.

---

## 4. Components used (from §5)

- **AppShell**, **Sidebar**, **Topbar**, **Breadcrumb**, **Tabs** — page chrome.
- **Panel**, **Section**, **Accordion** — editor body; one accordion item per
  criterion / dimension.
- **Drawer/Sheet** — per-storyPoint / per-item override surface.
- **Segmented scoring-mode cards** — built from **Card** + **Radio** semantics
  (single-select group of 4). The current code uses bare `<button>`s; this spec
  upgrades them to Card+Radio for accessibility (foundation §5 Radio).
- **Input**, **Textarea**, **Select**, **Slider** (for `passingPercentage` 0–100
  with a numeric **Input** echo), **Switch** (`showModelAnswer`), **Label**,
  **Button** (primary "Save Rubric", secondary "Apply from preset", ghost icon
  "remove"), **IconButton** (add/remove rows).
- **Chip/Tag** — scope chip and inheritance nodes; **Badge** — "Overridden" /
  "Inherited" markers.
- **RubricBreakdown** (domain, §5) — the live preview rail; reused verbatim so
  author preview === grader/student render.
- **AnswerKeyLock** (domain, §5) — guard visual next to Model Answer, clarifying
  it is evaluator-only and never shown to students unless `showModelAnswer` +
  post-release rules permit.
- **InlineAlert/Banner** — inheritance/override explainer and validation
  warnings.
- **ConfirmDialog** — "Reset to inherited" and destructive mode-switch
  (data-loss) confirmations.
- **Toast** (sonner) — save success/error.
- **Skeleton**, **EmptyState**, **LoadingOverlay**, **FormFieldError** — states
  (§5).

**Proposed addition (justified):** **`InheritanceChain`** — a small horizontal
stepper (4 nodes: tenant → space → storyPoint → item) rendering each node's
state as `inherited` / `defined-here` / `overridden-downstream`, with a "Reset
to inherited" affordance. It is a thin composition of Chip + Badge + Tooltip but
recurs across Rubric, Settings, and AnswerKey scopes, so it earns a named domain
component. Added to the §5 inventory pending review.

---

## 5. States

- **Loading:** parent provides space/storyPoint/item; while resolving, render
  **Skeleton** rows for the scoring-mode cards and shared settings; inheritance
  bar shows skeleton chips. Use `bg.surface-sunken` placeholders.
- **Empty / no local rubric (inherited):** editor renders the **resolved**
  rubric (read-only-styled, `text.secondary`) with an **InlineAlert**: "This
  {scope} inherits the {parent} rubric." Primary affordance: **"Override here"**
  (clones resolved rubric into editable local state). Until edited, no write is
  sent.
- **Defined-here (success/edit):** all fields editable; "Reset to inherited"
  enabled; **Badge** `Overridden` on the active inheritance node (`marigold-200`
  fill, `marigold-600` text — the one place spark appears in chrome).
- **Partial:** mode is `criteria_based`/`hybrid` but `criteria` is empty →
  **EmptyState** inside the criteria Accordion ("No criteria yet — add one or
  apply a preset"). `dimension_based` with no enabled dimension → warning that
  grading falls back to holistic.
- **Validation error:** `passingPercentage` outside 0–100, criterion
  `maxPoints ≤ 0`, dimension `weight ≤ 0`, or duplicate criterion names →
  **FormFieldError** + Save disabled, summarized in an **InlineAlert** at the
  top.
- **Save error:** **Toast** error ("Couldn't save rubric — retry") with retry;
  form stays dirty; optimistic state rolls back (§6).
- **Permission-gated by role:**
  - `teacher` — full edit at space/storyPoint/item scope within their tenant.
  - `tenantAdmin` — additionally edits the **tenant default** scope (chip
    enabled); for non-admins the tenant node is read-only with a Tooltip "Set by
    tenant admin."
  - Read-only viewer roles see the resolved rubric with all inputs disabled and
    no Save.

---

## 6. Interactions & motion (cite §4 motion)

- **Switch scoring mode:** selecting a mode card animates the mode-specific body
  in with `ease.entrance` / `base 220ms`; outgoing body exits `ease.exit`. If
  switching away from a mode that holds data (e.g. criteria → holistic) where
  fields would be dropped at save, open a **ConfirmDialog**: "Switching to
  Holistic will discard 3 criteria. Continue?" (data is retained in memory until
  save, matching the current `handleSave` field-pruning by mode).
- **Add/remove criterion/dimension/level:** new Accordion row expands with
  `fast 160ms` height+opacity; remove collapses with `ease.exit`. Default new
  criterion seeds 3 levels (Missing/Partial/Excellent) per current code; new
  dimension seeds `priority: MEDIUM`, `weight: 1`, `scoringScale: 10`,
  `enabled: true`.
- **Live preview:** every keystroke debounces (~200ms) into **RubricBreakdown**,
  recomputing the sample weighted total and pass line; the pass marker slides to
  the new `passingPercentage` with `instant 100ms`.
- **Override / Reset:** "Override here" clones resolved rubric (no motion beyond
  enabling fields). "Reset to inherited" → **ConfirmDialog**, then the
  inheritance node's `Overridden` badge fades out `fast`.
- **Optimistic save:** on "Save Rubric", local state is treated as
  source-of-truth immediately (button → loading spinner, `instant`); the `save*`
  callable runs in background. Success → **Toast** with the **one** allowed
  celebratory spark micro-pop (spring, marigold burst per §4) confirming "Rubric
  saved." Failure → rollback + error Toast.
- **Reduced motion:** all of the above degrade to opacity-only / no spring per
  `prefers-reduced-motion` (§4).

---

## 7. Content & copy

- **Tab / heading:** "Rubric" (Fraunces, text-xl). Subhead (Schibsted, text-sm,
  `text.secondary`): "Define how open-ended answers are scored by AI and
  reviewers."
- **Inheritance bar:** "Editing: {Space default · Story point · Item}".
  Inherited state: "Inherits {parent} rubric." Override CTA: "Override here".
  Reset CTA: "Reset to inherited".
- **Scoring mode labels/desc (verbatim from source):**
  - Criteria Based — "Traditional rubric with criteria and levels"
  - Dimension Based — "AI evaluation dimensions with weights and scoring scales"
  - Holistic — "Single overall score with guidance text"
  - Hybrid — "Combination of criteria and holistic scoring"
- **Field labels:** Name · Max Points · Weight · Description · Levels (Score /
  Label / Description) · Priority (High/Medium/Low) · Scale · Prompt Guidance ·
  Max Score · Guidance · **Passing Percentage** · **Evaluator Guidance** ·
  **Model Answer** · "Show model answer to students" (Switch →
  `showModelAnswer`).
- **Empty states:** criteria — "No criteria yet. Add one or apply a preset to
  get started." dimensions — "No evaluation dimensions. AI grading will fall
  back to holistic until you add at least one enabled dimension."
- **Error copy:** "Passing percentage must be between 0 and 100." · "Max points
  must be greater than 0." · "Two criteria share the same name — names must be
  unique." · Save fail — "Couldn't save the rubric. Your changes are kept —
  retry."
- **AnswerKeyLock note:** "Model answer guides the evaluator. Students never see
  it unless you enable it and results are released."
- **Tone:** precise, declarative, second-person; no exclamation except the save
  Toast.

---

## 8. Domain rules surfaced

- **Inheritance / resolution:** the live grading rubric is
  `resolveRubric(tenantDefault → space.defaultRubric → storyPoint.defaultRubric → item.rubric)`
  — nearest defined scope wins (the AutoGrade analog is
  `tenant → exam → question`, per the `UnifiedRubric` doc comment). The UI must
  show _which_ scope supplied each effective value so authors don't double-edit.
  This mirrors the backend resolver kept "verbatim" in common-api
  (`rubric inheritance` is listed among preserved backend invariants).
- **Mode ↔ field activation:** only the active mode's fields persist.
  `saveItem`/`saveStoryPoint`/`saveSpace` store `criteria` for
  `criteria_based|hybrid`, `dimensions` for `dimension_based`,
  `holisticGuidance`/`holisticMaxScore` for `holistic|hybrid` — matching
  `handleSave`'s pruning. Shared fields (`passingPercentage`,
  `evaluatorGuidance`, `modelAnswer`, `showModelAnswer`) persist in all modes.
- **Dimensions are RELMS/agent contract:** `EvaluationDimension` (`priority`,
  `promptGuidance`, `weight`, `scoringScale`, `enabled`, `isDefault`,
  `isCustom`) feeds the AI evaluator prompt. `promptGuidance` is
  author-controlled instruction text injected at grade time — editing it changes
  grading behavior, so it carries a precise label and a help tooltip.
- **Answer-key isolation:** `saveItem` strips student-facing answer keys into a
  server-only subcollection (common-api §"saveItem strips answer keys"). The
  rubric's `modelAnswer` is **evaluator guidance**, not the protected key; it is
  shown to students only when `showModelAnswer` is true _and_ exam/results
  release rules allow — **AnswerKeyLock** makes this boundary visually explicit
  (foundation §8 "answer-key never shown to students").
- **Tenant isolation:** all reads/writes are tenant-scoped; the tenant-default
  scope is editable only by `tenantAdmin`.
- **Passing line:** `passingPercentage` (default 40 per source) defines
  pass/fail against the weighted total and is the line drawn in
  **RubricBreakdown** and surfaced later in `ResultSummary`/`GradePill`.

---

## 9. Accessibility

- **Scoring-mode group:** a labelled `radiogroup` (the 4 cards), not loose
  buttons — arrow keys move selection, `Space`/`Enter` selects, `aria-checked`
  on the active card. Selected card uses `border.focus` + `indigo-50` fill (not
  color alone — a check glyph + "Selected" SR text).
- **Focus order:** Inheritance bar → scope chip / reset → scoring-mode
  radiogroup → mode body (criteria/dimension/holistic, row by row, add buttons
  last in each group) → shared settings → Apply preset → Save. Logical and
  linear.
- **Accordion rows:** each criterion/dimension is a labelled region; add/remove
  **IconButton**s have `aria-label` ("Add criterion", "Remove criterion",
  "Remove level" — already present in source) and ≥44px touch targets (§4).
- **Slider** `passingPercentage`: paired numeric **Input** for exact entry;
  `aria-valuemin/max/now`, `%` announced.
- **Live preview:** **RubricBreakdown** updates are debounced and wrapped in
  `aria-live="polite"` so SR users hear the recomputed total without spam.
- **Contrast:** all text/UI pairs meet WCAG AA (§2) — `text.secondary` on
  `bg.surface`, marigold `Overridden` badge uses `marigold-600` text on
  `marigold-200` for ≥4.5:1. Status (Inherited/Overridden) always pairs icon +
  label + color, never color alone (§2).
- **Reduced motion:** honor `prefers-reduced-motion` for accordion, mode-switch,
  and the save spark pop (§4).
- **Errors:** **FormFieldError** linked via `aria-describedby`; the top
  **InlineAlert** receives focus on failed save.

---

## 10. Web ↔ mobile divergence

- Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
  (mobile) (§6); only the renderer differs.
- **Layout:** the `lg` two-column editor/preview split is **web-only**. On
  mobile the preview is a collapsible **Accordion**/bottom sheet ("Preview").
- **Scoring-mode cards:** web hover states → mobile **press** states; 2×2 grid →
  1-up stack.
- **Override surface:** web uses a side **Drawer** for per-item/per-storyPoint;
  mobile uses a full-height bottom **Sheet**.
- **No ⌘K / CommandPalette** on mobile (§6) — "Apply from preset" is a button,
  not a palette action.
- **Dense criterion/level rows** (3 inline inputs) reflow to stacked fields on
  mobile to keep ≥44px targets; numeric inputs trigger numeric keypads.
- **Sticky bottom action bar** (Save / Apply preset) on mobile replaces the
  inline desktop buttons.

---

## 11. Claude-design prompt

```
Design the "Rubric Editor" screen for the Auto-LevelUp teacher web app, conforming
EXACTLY to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md.
Do NOT invent colors, fonts, or components — compose only from its tokens and §5
inventory. No Inter/Roboto, no SaaS blue #3B82F6, no glass morphism.

CONTEXT: Staff (teacher / tenantAdmin) author a UnifiedRubric that drives AI grading
and human review of open-ended answers. Precise, instrument-like tone — NOT playful.
The one allowed spark (marigold) is the "Overridden" indicator + the save-success toast.

LAYOUT (inside AppShell: Sidebar + Topbar + Breadcrumb + Tabs, Rubric tab active):
- Sticky InheritanceChain bar: nodes Tenant default → Space → Story point → Item,
  each marked Inherited / Defined-here / Overridden; a scope chip "Editing: Space default"
  and a "Reset to inherited" action.
- lg: two columns — editor (1fr, max ~720 reading width) + RubricBreakdown live
  preview rail (380px). md/sm: single column, preview as a collapsed Accordion below.
- Editor: a radiogroup of 4 scoring-mode Cards (criteria_based, dimension_based,
  holistic, hybrid) with label+description; then a mode-specific body:
    • criteria/hybrid → Accordion of criteria (Name, Max Points, Weight, Description,
      and Levels rows of Score/Label/Description, add/remove IconButtons).
    • dimension_based → Accordion of EvaluationDimensions (Name, Priority High/Medium/Low
      Select, Weight, Scale, Description, Prompt Guidance Textarea, enabled Switch).
    • holistic/hybrid → Max Score + Guidance Textarea.
- Shared Settings Section: passingPercentage (Slider 0–100 + numeric Input, default 40),
  Evaluator Guidance Textarea, Model Answer Textarea with an AnswerKeyLock note, and a
  "Show model answer to students" Switch.
- Actions: secondary "Apply from preset", primary "Save Rubric".

TOKENS: bg.canvas / bg.surface; Fraunces for the "Rubric" heading (text-xl),
Schibsted Grotesk for body/labels, Spline Sans Mono for scores/weights/percentages.
Cards radius lg, inputs/buttons md, chips pill; elevation e1 at rest, e2 on the preview
rail. Use brand.primary for the active mode card + Save; marigold spark ONLY for the
Overridden badge and the save toast. Motion: mode-switch ease.entrance/base 220ms,
add/remove fast 160ms, save toast a single spring marigold pop. Respect prefers-reduced-motion.

STATES to show: inherited (read-only with "Override here" InlineAlert), defined-here
(editable, Overridden badge), empty criteria EmptyState, validation FormFieldError
(passing% out of range / duplicate names), loading Skeleton, save-error Toast. Render
RubricBreakdown identically to how graders/students see it, with the pass line at
passingPercentage. Make the scoring-mode group a real WCAG-AA radiogroup (arrow-key
nav, aria-checked), all status cues = icon + label + color. Deliver responsive sm/md/lg.
```
