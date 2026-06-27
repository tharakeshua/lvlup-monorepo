# Rubric Editor (Question / Sub-question)

_A focused Drawer/Modal editor for authoring a single `ExamQuestion`'s (or
sub-question's) `UnifiedRubric` — switch scoring mode, tune criteria/dimensions,
lock the answer key, and reconcile points against `maxMarks` before grading
runs._

This spec conforms exactly to the Lyceum foundation
(`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens are cited by name;
none are re-pasted.

---

## 1. Purpose & primary user

**Primary user:** Teacher / exam author (and Content Manager) — the staff role
that owns an exam's grading contract.

**Job-to-be-done:** "Before I let the AI grade student answers, I need to define
_exactly how_ this question earns its marks — pick a scoring philosophy
(criteria, dimensions, holistic, or hybrid), set point values that add up to the
question's `maxMarks`, attach a model answer the AI may use but students may
never see, and preview how a grade breaks down — without leaving the questions
editor."

The rubric is the single most load-bearing artifact in AutoGrade: it is the
prompt contract handed to the "RELMS" per-question grader and the basis for
`UnifiedEvaluationResult.rubricBreakdown`, confidence routing, and every
downstream override. This editor must feel like a precision instrument, not a
form.

---

## 2. Entry points & route

**Route:** `/exams/:examId` — the rubric editor is **not** a standalone page. It
is a **Drawer** (desktop ≥ lg) / **Sheet** (mobile) launched from the Questions
tab of the Exam Detail page, anchored to one `ExamQuestion` row (or one
`subQuestions[]` entry when `questionType === 'multi-part'`).

**Entry points:**

- Questions tab → a question's `RubricBreakdown` preview chip → "Edit rubric".
- Extraction review step of the exam wizard (`/exams/new`) → "Refine rubric" on
  an extracted question (`extractedBy: 'ai'`).
- Sub-question editor row → "Edit sub-question rubric" (scopes the editor to
  `subQuestions[i].rubric`).

**Reads (live repos / callables — see `specs/common-api.md`):**

- `exams.get(examId)` → `Exam` for `gradingConfig.allowRubricEdit`,
  `gradingConfig.evaluationSettingsId`, `status`, `totalMarks`, and POST_PUBLISH
  locking context.
- `questionSubmissions`-adjacent read not needed here; the editor reads the
  question via the parent Questions tab's `exams.get` + `questions/`
  subcollection (already loaded).
- `evaluationSettings` repo → resolve the inheritance chain: **tenant default
  `EvaluationSettings`** → exam (`gradingConfig.evaluationSettingsId`) → this
  question's `rubric`. Tenant default supplies `enabledDimensions[]` and
  `confidenceConfig` shown as inherited placeholders.

**Writes (callables):**

- `saveExam` — the **only** writer. The editor builds a patch for
  `questions/{questionId}.rubric` (or `subQuestions[i].rubric`) and submits via
  `saveExam`, which enforces the server status machine and
  `POST_PUBLISH_LOCKED_FIELDS`. The client never writes Firestore directly.
- No `gradeQuestion` / `extractQuestions` calls originate here, though
  "Re-extract rubric" defers to `extractQuestions(mode: 'single')` on the
  parent.

---

## 3. Layout — wireframe-as-text

Rendered over the `AppShell` (sidebar + topbar persist, dimmed by Modal scrim).
Drawer is right-anchored, width `clamp(420px, 40vw, 560px)`; content max-width
respects the 720 reading measure for guidance prose.

### Desktop (lg / xl) — right Drawer

```
┌ AppShell (sidebar + topbar, scrim e3 over canvas) ──────────────────────────┐
│                                              ┌─ Drawer (bg.surface, e3) ────┐│
│  Exam Detail · Questions tab (dimmed)        │ Header                        ││
│                                              │  Q3 · "Derive the…"   [Q3]    ││  ← title Fraunces, ID mono
│                                              │  Rubric editor        ✕       ││
│                                              ├───────────────────────────────┤│
│                                              │ ⚠ InlineAlert (if locked /    ││  ← conditional banners
│                                              │   allowRubricEdit=false)      ││
│                                              ├───────────────────────────────┤│
│                                              │ Scoring mode  [Segmented]     ││  ← criteria│dimension│holistic│hybrid
│                                              │ ( Criteria | Dimension |      ││
│                                              │   Holistic | Hybrid )         ││
│                                              ├───────────────────────────────┤│
│                                              │ �equation Points reconciler    ││  ← sticky Stat strip
│                                              │  Σ 8.0 / maxMarks 10  ⚠ −2.0  ││     mono numerals
│                                              ├───────────────────────────────┤│
│                                              │ MODE BODY (scrolls) ───────── ││
│                                              │  ┌ Criteria mode ───────────┐ ││
│                                              │  │ ▸ Card: "Sets up integral"│ ││  ← Accordion of criteria
│                                              │  │   maxPoints [4.0] wt[1.0]│ ││
│                                              │  │   description …          │ ││
│                                              │  │   levels[] (optional)    │ ││
│                                              │  │     4 Excellent · 2 Part │ ││
│                                              │  ├ Card: "Correct bounds"   │ ││
│                                              │  └ + Add criterion          ┘ ││
│                                              ├───────────────────────────────┤│
│                                              │ Shared fields ─────────────── ││
│                                              │  passingPercentage  [40 %]    ││
│                                              │  evaluatorGuidance  [textarea]││
│                                              │  ┌ AnswerKeyLock ───────────┐ ││
│                                              │  │ 🔒 Model answer (staff)  │ ││  ← never shown to students
│                                              │  │ showModelAnswer [switch] │ ││
│                                              │  │ modelAnswer [ContentRen.]│ ││
│                                              │  └──────────────────────────┘ ││
│                                              ├───────────────────────────────┤│
│                                              │ ▸ RubricBreakdown preview     ││  ← collapsible, sample award
│                                              ├───────────────────────────────┤│
│                                              │ Footer (sticky)               ││
│                                              │  [Cancel]        [Save rubric]││  ← Save disabled until valid
│                                              └───────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Hybrid mode** stacks two labelled sub-sections inside the mode body: a
**Criteria** block + a **Dimension** block, each with its own Σ contribution
feeding one reconciler.

### Tablet (md) — Drawer narrows to `clamp(360px, 55vw, 480px)`; segmented control wraps to two rows if needed; reconciler stays sticky.

### Mobile (sm) — full-height **Sheet** (bottom-anchored, drag handle). Scoring-mode segmented control becomes a `Select`. Criteria/dimension Accordion cards stack full-bleed. Footer pins to safe-area bottom; reconciler pins under the header. ⌘K and hover affordances drop (see §10).

---

## 4. Components used

From the Lyceum inventory (§5) only:

- **Containers:** `Drawer/Sheet` (host), `Modal/Dialog` (mobile fallback host is
  Sheet), `Panel`, `Section`, `Accordion` (criteria & dimensions as expandable
  cards), `Card`, `Tooltip`, `Popover` (level editor).
- **Primitives:** `Input` (point/weight numerics — mono), `Textarea`
  (description, promptGuidance, evaluatorGuidance, holisticGuidance), `Select`
  (priority HIGH/MED/LOW; scoringScale; mobile mode switch), `Switch`
  (`enabled`, `showModelAnswer`), `Slider` (weight, optional), `Button` (primary
  "Save rubric", secondary "Cancel", ghost "+ Add criterion / dimension", danger
  "Remove"), `IconButton` (close, drag-reorder handle).
- **Data:** `Stat/KPI` (the points reconciler Σ / maxMarks), `Badge`, `Chip/Tag`
  (priority chips, `isDefault`/`isCustom`/`inherited` tags, `extractedBy: ai`),
  `DefinitionList` (read-only locked view), `EmptyState` (no criteria yet),
  `Skeleton` (loading).
- **Feedback:** `InlineAlert/Banner` (lock + reconciliation warnings), `Toast`
  (sonner — save success/failure), `FormFieldError`, `ConfirmDialog` (discard
  unsaved / remove criterion), `LoadingOverlay` (during `saveExam`).
- **Domain:** `RubricBreakdown` (preview), `ContentRenderer` (md + KaTeX for
  description / model answer / guidance), `AnswerKeyLock` (the model-answer
  guard visual), `ConfidenceBadge` (in preview, illustrating routing thresholds
  inherited from `confidenceConfig`).

**Proposed addition (justified):** a thin **SegmentedControl** variant of `Tabs`
for the four scoring modes — it is a `Tabs` styled as a single pill-grouped
control (radius pill, brand.primary active fill). If the team prefers, this is
implemented as `Tabs` with the `pill` variant rather than a new component; no
new tokens introduced either way.

---

## 5. States

**Loading:** Drawer opens immediately with header populated (question text/ID
already in hand). Mode body and reconciler render `Skeleton` rows while the
`evaluationSettings` inheritance chain resolves (so inherited dimensions /
`confidenceConfig` placeholders are accurate). Skeleton uses bg.surface-sunken
shimmer.

**Empty:** New question or freshly extracted question with no
`rubric.criteria`/`dimensions` → `EmptyState` inside the mode body: serif
(Fraunces) title "No criteria yet", body "Add a criterion to define how this
question earns marks.", primary ghost CTA "+ Add criterion". Dimension mode
pre-populates inherited `enabledDimensions[]` from `EvaluationSettings` as
starter cards tagged `inherited`.

**Partial:** Reconciliation mismatch — Σ of `maxPoints` (or holistic/hybrid
totals) ≠ question `maxMarks`. Reconciler `Stat` flips to status.warning with
delta (`⚠ −2.0` / `+1.5`) and label "Points don't match question max (10)". Save
remains allowed but surfaces a `ConfirmDialog` ("Save with mismatch?") — grading
tolerates it, but it's flagged. A criterion missing a name → inline
`FormFieldError`, that criterion's Accordion header gets a status.warning dot.

**Error:** `saveExam` rejects (validation, locked field, network) →
`InlineAlert` (status.error) at footer + destructive `Toast`; the Drawer stays
open with edits intact (never lose work). Inheritance-chain read failure →
non-blocking `InlineAlert` (status.info): "Couldn't load tenant defaults;
inherited values shown as blank."

**Success:** `saveExam` resolves → success `Toast` "Rubric saved", Drawer closes
with exit motion, parent Questions tab's `RubricBreakdown` chip updates from the
live `exams.get` read.

**Permission / role-gated variations:**

- `gradingConfig.allowRubricEdit === false` → **read-only mode**: all inputs
  become a `DefinitionList`, footer shows only "Close", a status.info
  `InlineAlert` explains "Rubric editing is disabled for this exam."
  (`allowRubricEdit` gating).
- Exam `status` is post-publish (`published` and beyond) and rubric is a
  `POST_PUBLISH_LOCKED_FIELDS` member → locked banner (status.warning) "This
  exam is published — rubric is locked. Unpublish to edit." Inputs disabled;
  `saveExam` would reject server-side regardless (server-authoritative).
- Role lacks exam-author capability → editor not reachable (parent route guard);
  never partially rendered.

---

## 6. Interactions & motion

**Open / close:** Drawer enters with `ease.entrance` at `base` (220ms) slide-in
from right; scrim fades `fast`. Close uses `ease.exit` at `fast`. Mobile Sheet
uses spring only for the drag-dismiss gesture; otherwise `ease.entrance`/`exit`.
Respect `prefers-reduced-motion` → cross-fade, no translate.

**Mode switch:** Selecting a scoring mode in the SegmentedControl cross-fades
the mode body at `fast` (160ms). Switching modes **does not discard** data —
criteria, dimensions, and holistic fields are each retained per-mode so a
teacher can flip between criteria↔hybrid without loss; only the active mode's
payload is written to `rubric.scoringMode`. Switching away from a populated mode
surfaces a subtle `Tooltip` hint ("Your criteria are kept"), not a confirm.

**Add / remove / reorder:** "+ Add criterion/dimension" appends an expanded
Accordion card with entrance `fast` and autofocuses the name `Input`. Remove
triggers a `ConfirmDialog` only if the card has content; empty cards delete
silently. Reorder via drag handle (`IconButton`) updates `order`/array index
with `instant` reflow.

**Live reconciliation (optimistic):** Every keystroke in a
`maxPoints`/`holisticMaxScore`/sub-question total input recomputes Σ client-side
and animates the reconciler `Stat` number with a `fast` tabular-mono tick (no
spring — this is staff precision, not gamification). Match state =
status.success check + label "Matches max"; mismatch = status.warning.

**Levels editor:** Optional `levels[]` per criterion opens in a `Popover` ("+
Add level" → rows of `score` (mono `Input`) / `label` / `description`). Scores
must be ≤ the criterion's `maxPoints`; violation → `FormFieldError`.

**Model answer (AnswerKeyLock):** Toggling `showModelAnswer` reveals the
`modelAnswer` `ContentRenderer` editor with a `fast` height expand. The
`AnswerKeyLock` chrome persists regardless, signalling "staff-only — never shown
to students."

**Preview:** Expanding `RubricBreakdown` renders a sample award (e.g. full
marks, or a mid-confidence partial) so the teacher sees the exact shape RELMS
will produce, including an illustrative `ConfidenceBadge` driven by inherited
`confidenceConfig` thresholds.

**Save:** "Save rubric" → `LoadingOverlay` on the Drawer body during the
`saveExam` round-trip (this is the one place we are NOT optimistic — the server
status machine and field locks are authoritative). On resolve, success `Toast` +
close.

**Discard guard:** Closing with unsaved edits → `ConfirmDialog` "Discard rubric
changes?" (danger confirm). Clean state closes immediately.

---

## 7. Content & copy

Tone: precise, staff-facing, instructional — no encouragement language (that
register is for students elsewhere).

- **Header:** `{Question order} · "{truncated text}"` with the question ID
  rendered in Spline Sans Mono chip.
- **Mode labels:** "Criteria", "Dimensions", "Holistic", "Hybrid". Sub-caption
  under each: Criteria → "Award points per named criterion"; Dimensions → "Score
  against weighted evaluation dimensions"; Holistic → "One overall judgement
  against guidance"; Hybrid → "Criteria plus dimensions".
- **Reconciler labels:** matched → "Points match question max ({maxMarks})";
  mismatch → "Points don't match question max ({maxMarks}) — off by {delta}".
- **Field labels:** "Max points", "Weight", "Description", "Priority", "Scoring
  scale", "Prompt guidance (for the grader)", "Passing %", "Evaluator guidance",
  "Holistic guidance", "Holistic max score".
- **AnswerKeyLock:** title "Model answer · staff only", helper "Used by the AI
  grader. Never shown to students or parents."
- **Empty state:** title "No criteria yet" / body "Add a criterion to define how
  this question earns marks."
- **Locked banner (publish):** "This exam is published — the rubric is locked.
  Unpublish to edit."
- **Disabled banner (`allowRubricEdit`):** "Rubric editing is turned off for
  this exam (Settings → Grading)."
- **Errors:** save fail → "Couldn't save the rubric. Your changes are still here
  — try again."; criterion name missing → "Name this criterion."; level over max
  → "Level score can't exceed max points ({maxPoints})."
- **Discard confirm:** "Discard rubric changes? This can't be undone."

---

## 8. Domain rules surfaced

- **Answer key never reaches students:** `modelAnswer` / `showModelAnswer` live
  exclusively inside `AnswerKeyLock`; copy and chrome make the staff-only
  guarantee explicit. Mirrors the platform rule (model answer / rubric
  model-answer never served to student/parent reads).
- **Confidence routing is downstream but previewed:** the editor reads
  `EvaluationSettings.confidenceConfig` (`confidenceThreshold` 0.7,
  `autoApproveThreshold` 0.9) from the inheritance chain and the
  `RubricBreakdown` preview shows the `ConfidenceBadge` those thresholds would
  produce — teachers understand that this rubric drives routing to
  `needs_review` vs auto-approve.
- **Inheritance chain:** tenant-default `EvaluationSettings` → exam
  `gradingConfig.evaluationSettingsId` → this question's `rubric`. Inherited
  dimensions and thresholds render as tagged placeholders (`inherited`) so
  authors see what they override.
- **Server-authoritative writes & status machine:** the editor never writes
  Firestore; only `saveExam` does, and it enforces the `ExamStatus` machine.
  Save is non-optimistic for exactly this reason.
- **Post-publish field locks:** when the exam is `published`+ and rubric is in
  `POST_PUBLISH_LOCKED_FIELDS`, inputs lock and `saveExam` would reject — the UI
  mirrors the server rather than guessing.
- **`allowRubricEdit` gating:** false → read-only `DefinitionList`, no writer.
- **Tenant isolation:** every read (`exams.get`, `evaluationSettings`) is
  tenant-scoped; the editor surfaces only this tenant's defaults and
  Gemini-derived extraction artifacts.
- **Reconciliation is advisory, not blocking:** Σ ≠ `maxMarks` warns and
  confirms but grading tolerates it (RELMS normalizes), matching the data
  model's permissiveness.

---

## 9. Accessibility

- **Focus management:** Drawer traps focus; on open, focus lands on the
  scoring-mode SegmentedControl (or the first invalid field if reopened on an
  error). On close, focus returns to the launching "Edit rubric" trigger.
- **Focus order:** header close → mode control → reconciler (read-only,
  `aria-live="polite"` so Σ changes are announced) → mode body fields
  top-to-bottom → shared fields → AnswerKeyLock → preview disclosure → footer
  Cancel → Save.
- **Keyboard:** `Esc` requests close (routed through the discard guard).
  SegmentedControl is arrow-key navigable (roving tabindex, `role="tablist"`).
  Accordion headers toggle on Enter/Space. All numeric `Input`s accept type +
  arrow-step. Drag-reorder has a keyboard equivalent (move up/down via
  `IconButton` with `aria-label`).
- **ARIA:** mode control `role="tablist"`/`tab`/`tabpanel`; reconciler `Stat`
  wrapped in `aria-live="polite"` region announcing "Points 8 of 10, off by 2";
  AnswerKeyLock has
  `aria-label="Staff-only model answer, not shown to students"`; locked/disabled
  banners use `role="status"`.
- **Status never by color alone:** reconciler match/mismatch, priority chips,
  and confidence preview all pair an icon + text label (foundation rule).
  Priority HIGH/MED/LOW chips carry text, not just hue.
- **Contrast:** all pairs meet WCAG AA per foundation; status.warning/error text
  on bg.surface verified for 4.5:1.
- **Reduced motion:** `prefers-reduced-motion` disables slide/height transitions
  (cross-fade only) and the reconciler number tick (instant value swap).

---

## 10. Web ↔ mobile divergence

| Concern                  | teacher-web (today)            | Future RN / scanner-web                                                                               |
| ------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Host                     | right-anchored `Drawer`        | bottom `Sheet` with drag handle, full-height                                                          |
| Scoring-mode control     | SegmentedControl (`Tabs` pill) | `Select` dropdown                                                                                     |
| Criteria/dimension cards | `Accordion`, hover affordances | stacked full-bleed cards, press affordances                                                           |
| Reorder                  | drag handle + hover            | long-press drag or up/down `IconButton`s                                                              |
| Levels editor            | `Popover`                      | inline expanding `Section` (no floating popovers)                                                     |
| Reconciler               | sticky `Stat` strip            | pinned under header, condensed                                                                        |
| ⌘K / CommandPalette      | available (parent shell)       | none                                                                                                  |
| Save                     | footer buttons                 | safe-area pinned footer                                                                               |
| scanner-web              | n/a                            | rubric editing not exposed (scanner role = intake only; `uploadSource: 'scanner'`); read-only at most |

Component **names and props match 1:1** across `shared-ui` and `ui-native`; only
the host (Drawer vs Sheet) and the mode-switch primitive differ.

---

## 11. Claude-design prompt

```
You are designing ONE screen for Auto-LevelUp's teacher-web app, conforming EXACTLY to the
Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md "Modern Scholarly").
Do NOT invent tokens, fonts, or component variants — compose only from the Lyceum inventory.
Cite tokens by semantic name (brand.primary, status.warning, confidence.med, spark, etc.).

SCREEN: Rubric Editor (Question / Sub-question) — a right-anchored Drawer (mobile: bottom Sheet)
launched from /exams/:examId Questions tab, editing one ExamQuestion's UnifiedRubric (or one
subQuestions[i].rubric for multi-part). Rendered over the AppShell with an e3 scrim.

REQUIREMENTS:
- Header: question order + truncated text (Fraunces) + question ID (Spline Sans Mono chip) + close IconButton.
- SegmentedControl (Tabs pill variant) to switch scoringMode: Criteria | Dimensions | Holistic | Hybrid.
  Switching modes must PRESERVE each mode's data (no data loss).
- Sticky points reconciler as a Stat/KPI: Σ of maxPoints vs question maxMarks, mono numerals,
  status.success when matched, status.warning + delta when off (advisory, not blocking).
- Criteria mode: Accordion of criterion Cards — name Input, Max points (mono Input), Weight,
  Description (Textarea via ContentRenderer md+KaTeX), optional levels[] editor in a Popover
  (score/label/description). EmptyState ("No criteria yet") with a ghost "+ Add criterion".
- Dimension mode: EvaluationDimension cards — name, Priority Select (HIGH/MED/LOW chips, text+icon
  never color alone), promptGuidance Textarea, weight, scoringScale, enabled Switch; inherited
  dimensions from tenant EvaluationSettings tagged "inherited".
- Holistic mode: holisticGuidance Textarea + holisticMaxScore. Hybrid: stacked Criteria + Dimension blocks.
- Shared fields: passingPercentage, evaluatorGuidance, and an AnswerKeyLock block containing
  showModelAnswer Switch + modelAnswer ContentRenderer — STAFF ONLY, "never shown to students."
- Collapsible RubricBreakdown preview showing a sample award + illustrative ConfidenceBadge
  (driven by inherited confidenceConfig thresholds 0.7 / 0.9).
- Sticky footer: secondary Cancel + primary "Save rubric" (disabled until valid). Saving shows a
  LoadingOverlay (NON-optimistic — saveExam is server-authoritative and enforces POST_PUBLISH locks).

STATES: skeleton load (resolving tenant-default → exam → question inheritance chain); empty;
reconciliation mismatch (warning + ConfirmDialog on save); save error (InlineAlert + Toast, keep edits);
read-only when gradingConfig.allowRubricEdit === false (DefinitionList) or exam is published/locked
(status.warning banner).

DOMAIN RULES TO SURFACE: model answer never shown to students (AnswerKeyLock); confidence routing
previewed; saveExam is the only writer and is server-authoritative; post-publish field locks;
tenant isolation; reconciliation is advisory.

TYPE: Fraunces (header/empty-state title), Schibsted Grotesk (labels/body/buttons),
Spline Sans Mono (points, scores, IDs, the Σ reconciler).
MOTION: Drawer ease.entrance @ base; mode switch cross-fade @ fast; reconciler number tick @ fast
(no spring — staff precision); respect prefers-reduced-motion. Radius: cards lg, inputs/buttons md,
chips pill. Elevation: Drawer e3. Focus ring per foundation. WCAG AA; status always icon + label.

Output: a responsive React + Tailwind (Lyceum @theme tokens) implementation of this Drawer with all
states, using shared-ui component names (Drawer, Accordion, Stat, Switch, Textarea, Button, Toast,
ConfirmDialog, ContentRenderer, RubricBreakdown, AnswerKeyLock, ConfidenceBadge).
```
