# Exam Settings (Grading Config)

_The control room for one exam's grading pipeline: toggle AI behavior, bind an
EvaluationSettings profile and a LevelUp remediation space, edit (still-mutable)
metadata, and gate the destructive cascade — every write goes through `saveExam`
against a server-authoritative status machine._

---

## 1. Purpose & primary user

**Primary user:** Teacher (exam owner) or Tenant Admin operating inside their
tenant.

**Job-to-be-done:** "Before I start grading — and sometimes mid-flight — I need
to configure _how_ this exam is graded and reviewed: whether the AI grades
automatically, whether I can edit rubrics, whether overrides require a reason,
which evaluation profile (and confidence thresholds) applies, and whether
results auto-release. I also want to correct exam metadata while it's still
legal to, link this exam to a learning space so weak students get remediation,
and — at the end — archive or delete the exam cleanly."

This is the **configuration + governance** surface of `exam-detail`. It is not
where grading happens (that's Submissions / GradingReview); it is where the
_rules_ for grading and review are set, and where the exam's lifecycle ends.
Tone throughout is **precise, staff-facing** — every toggle states its
downstream effect on the pipeline and on the review UX.

---

## 2. Entry points & route

**Route:** `/exams/:examId` → **Settings** tab (third tab, after Questions and
Submissions). Tab state held in URL search param (`?tab=settings`) so it is
deep-linkable and survives refresh.

**Entry points:**

- Tab bar on `exam-detail` (Questions / Submissions / **Settings**).
- CommandPalette (⌘K) → "Exam settings" jumps here for the active exam.
- Deep links from onboarding/empty states ("Configure grading" CTA after
  question extraction).
- Danger-zone deep link from admin tooling (rare).

**Reads (live repos):**

- `exams.get(examId)` — live `Exam` doc: `gradingConfig`, `status`, metadata,
  `linkedSpaceId/linkedStoryPointId`, `stats`. This is the form's source of
  truth.
- `evaluationSettings` list (repo read, tenant-scoped) — populates the
  EvaluationSettings profile `Select` (id, name, isDefault, isPublic,
  confidenceConfig summary).
- LevelUp cross-domain reads for the linked-space picker: spaces list +
  story-points list for the chosen space (Combobox-backed search; resolves
  `linkedSpaceTitle`).
- `submissions.listLive(examId)` (count only) — drives lock copy and danger-zone
  cascade preview ("N submissions will be deleted").

**Writes (callables — clients never write Firestore directly):**

- **`saveExam`** — the single consolidated CRUD write for everything on this
  screen: `gradingConfig.*` toggles, `evaluationSettingsId`,
  `linkedSpaceId/linkedStoryPointId/linkedSpaceTitle`, editable metadata, and
  `status` transitions (archive). Server enforces the status machine and
  `POST_PUBLISH_LOCKED_FIELDS`; client-side disabling is a UX mirror, not the
  gate.
- **Delete** — `saveExam` (archive path → `status: archived`) for soft removal;
  hard delete triggers the **`onExamDeleted`** cascade (deletes `questions/`,
  `submissions/` + nested `questionSubmissions/`, `examAnalytics/`). Surfaced
  behind a strong `ConfirmDialog`.

All reads/writes are tenant-scoped; `examId` alone is never trusted without the
caller's tenant claim.

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** (Sidebar + Topbar). Breadcrumb:
`Exams / {exam.title} / Settings`. The exam-detail header (title, status
`Badge`, primary status-action button) and the Questions/Submissions/Settings
`Tabs` are shared chrome owned by `exam-detail` and persist above this panel.

Content column capped at **max content width 1200**, single reading column for
form sections (each `Section` body ≤ 720 reading width). Desktop gutters 32.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant · search · ⌘K · notifications · profile)         │
│         ├──────────────────────────────────────────────────────────────── │
│         │ Breadcrumb: Exams / Algebra Unit 3 / Settings                    │
│         │ ┌─ Exam header (shared) ──────────────────────────────────────┐ │
│         │ │ Algebra Unit 3   [Badge: grading]        [Status action ▾]  │ │
│         │ │ [Questions] [Submissions] [• Settings]                      │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │                                                                  │
│         │ ┌─ Section: Grading behavior ─────────────────────────────────┐ │
│         │ │ Switch  Auto-grade with AI            [on]                   │ │
│         │ │   ↳ helper: pipeline runs RELMS automatically after scout   │ │
│         │ │ Switch  Allow rubric editing          [on]                  │ │
│         │ │ Switch  Allow manual override         [on]                  │ │
│         │ │ Switch  Require override reason       [on]  (dep. on above) │ │
│         │ │ Switch  Release results automatically [off]                 │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Section: Evaluation profile ───────────────────────────────┐ │
│         │ │ Select  Evaluation settings  [ Default rubric profile ▾ ]   │ │
│         │ │   ↳ ConfidenceBar preview: <0.7 review · 0.7–0.9 · >0.9 auto │ │
│         │ │   [Manage profiles →]                                       │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Section: Remediation link (LevelUp) ───────────────────────┐ │
│         │ │ Combobox  Learning space   [ Search spaces… ]               │ │
│         │ │ Combobox  Story point      [ (enabled after space) ]        │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Section: Exam details ─────────────────────────────────────┐ │
│         │ │ Input  Title    Input Subject    Chip[] Topics              │ │
│         │ │ DatePicker Exam date   Input Duration   Input Total/Passing │ │
│         │ │ (locked fields show 🔒 + InlineAlert once published)        │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Section: Danger zone (border.error) ───────────────────────┐ │
│         │ │ Archive exam   [Archive]                                    │ │
│         │ │ Delete exam    [Delete]  ⚠ cascades N submissions + analytics│ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │                                                                  │
│         │ ┌─ Sticky save bar (appears when dirty) ──────────────────────┐ │
│         │ │ Unsaved changes        [Discard]  [Save changes]            │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **lg (≥1024):** as above — single reading column, Sidebar expanded, sticky
  save bar spans the content column. Switch label + helper text on one row,
  control right-aligned.
- **md (768–1023):** Sidebar collapses to icon rail; content full-width within
  gutters 24; metadata grid collapses from 2-up to 1-up.
- **sm (<768):** Tabs become a horizontally scrollable `Tabbar`; each `Section`
  is a stacked full-bleed card; Switch rows wrap (label/helper above, control
  below, control still ≥44px touch target); sticky save bar pins to bottom
  safe-area. Danger zone is last and always fully expanded (no accordion) so
  destructive actions are never hidden behind a tap.

---

## 4. Components used (Lyceum inventory)

**Containers:** `AppShell`, `Section` (one per group: Grading behavior,
Evaluation profile, Remediation link, Exam details, Danger zone), `Card`,
`Panel`, `Tabs` (shared from exam-detail), `Breadcrumb`, `Modal/Dialog`,
`Popover` (lock explainer), `Tooltip`.

**Primitives:** `Switch` (the five gradingConfig toggles), `Select`
(evaluationSettingsId), `Combobox` (linked space + story point search), `Input`
(title, subject, duration, marks), `Textarea` (n/a here), `Chip/Tag` (topics
editor), `DatePicker` (examDate), `Button` (secondary Discard, primary Save,
danger Archive/Delete, ghost "Manage profiles").

**Data / feedback:** `Badge` (exam status, shared), `InlineAlert/Banner`
(post-publish lock explainer, dependent-toggle notices), `ConfirmDialog`
(archive, delete-with-cascade), `Toast` (sonner — save success/failure),
`FormFieldError`, `LoadingOverlay` (during `saveExam` in flight), `Skeleton`
(initial load), `Stat/KPI` (submission count in cascade preview).

**Domain (cross-app):**

- `ConfidenceBar` (feedback pkg) — read-only preview of the selected profile's
  `confidenceConfig` thresholds: confidence.low / confidence.med /
  confidence.high bands and what each routes to.
- `AnswerKeyLock` — small server-only-guard visual on the Evaluation profile
  section, reminding that `modelAnswer`/rubric guidance is teacher-only and
  never reaches students.

**Proposed addition (justify):**

- **`ToggleEffectRow`** — a thin composition (not a new primitive): `Switch` +
  label + a one-line **downstream-effect helper** rendered in text.secondary,
  plus an optional dependency notice. Every gradingConfig toggle on this screen
  must explain its pipeline/review consequence inline; standardizing the row
  guarantees consistent copy placement and helper styling. It composes only
  existing primitives (`Switch`, text tokens, `InlineAlert` for dependencies) —
  added to the inventory rather than invented ad hoc.

---

## 5. States

**Loading (initial):** `Section` skeletons — each toggle row a `Skeleton` bar
(label + control), Selects/Comboboxes as muted placeholders. Header/Tabs already
painted by exam-detail. No layout shift when data lands.

**Loaded / success (default):** form hydrated from `exams.get`. Save bar hidden
until a field changes (dirty). After successful `saveExam`: success `Toast`
("Settings saved"), save bar retracts (motion.fast), values reconcile to server
echo.

**Empty:**

- **No EvaluationSettings profiles in tenant:** Select shows disabled "No
  profiles yet" with a ghost `Button` → "Create evaluation profile" (routes to
  evaluation-settings). `ConfidenceBar` preview falls back to platform defaults
  (0.7 / 0.9) with a muted note.
- **No LevelUp spaces:** Remediation `Combobox` shows EmptyState-style inline
  hint "No learning spaces to link" — section remains, link is optional.

**Partial:**

- **Grading in progress (`status: grading` / `grading_partial`):** screen loads
  fully but `POST_PUBLISH_LOCKED_FIELDS` and several toggles are disabled (see
  §8). A persistent `InlineAlert` (status.info) at top: "Grading is underway —
  some settings are locked." Live submission count may still be increasing;
  cascade preview reflects current count.
- **Cross-domain space resolved but story-point list still loading:**
  story-point Combobox shows inline `Skeleton`; space value already
  committed-safe.

**Error:**

- **Load failure (`exams.get`):** full-section `InlineAlert` (status.error)
  "Couldn't load exam settings" + Retry `Button`. No partial form.
- **Save failure (`saveExam` rejects):** `LoadingOverlay` clears, error `Toast`
  with the server reason (e.g. "Field locked after publish", "Permission
  denied"); dirty state preserved so the user can correct and retry. Field-level
  rejections map to `FormFieldError` under the offending input.
- **Cascade/delete failure:** ConfirmDialog stays open, shows inline error, does
  not optimistically remove the exam.

**Permission / role-gated:**

- **Exam owner / Admin:** full read-write incl. danger zone.
- **Non-owner teacher (if shared):** read-only form (controls disabled, save bar
  never appears) + danger zone hidden entirely. Tooltip on disabled controls:
  "Only the exam owner or an admin can change these."
- **Scanner role:** has no route to this screen (intake only) — guarded at the
  router.
- **`archived` exam:** entire form read-only with an unarchive action replacing
  the save bar; danger zone offers Delete only.

---

## 6. Interactions & motion

**Dirty tracking + sticky save bar:** any control change marks the form dirty →
sticky save bar slides up (translateY, motion.base, ease.entrance). Discard
reverts to last server snapshot (motion.fast); Save fires `saveExam`.

**Save flow (non-optimistic for governance fields):** governance settings are
**not** optimistically applied — a `LoadingOverlay` covers the form during the
`saveExam` round-trip because the server may reject locked-field edits or
reshape `status`. On success, reconcile to the server echo and Toast; on
failure, keep dirty state. (Rationale: showing a toggle as "on" before the
server confirms could misrepresent how the pipeline will actually grade.)

**Dependent toggles (immediate UX feedback, still server-confirmed on save):**

- `requireOverrideReason` is only meaningful when `allowManualOverride` is on.
  Turning `allowManualOverride` off disables and visually greys
  `requireOverrideReason` with an `InlineAlert` micro-note ("Enable manual
  override to require reasons"). Turning override back on restores the prior
  `requireOverrideReason` value.
- `autoGrade` off surfaces a note that submissions will sit at
  `ready_for_review` requiring manual grading per question (RELMS skipped); the
  EvaluationSettings profile selection is then de-emphasized (still saved, used
  if you later flip autoGrade on or run AI grading per-question from
  GradingReview).

**Evaluation profile change:** selecting a profile animates the `ConfidenceBar`
preview (band widths re-tween, motion.base) to reflect that profile's
`confidenceConfig` (confidenceThreshold / autoApproveThreshold). No grading is
re-run from here — copy clarifies "applies to future grading."

**Linked-space picker:** space `Combobox` is debounced-search over LevelUp
spaces; on select, story-point `Combobox` enables and loads that space's story
points; on save, `linkedSpaceId` + resolved `linkedSpaceTitle` +
`linkedStoryPointId` persist together.

**Archive:** `ConfirmDialog` (motion e3 modal) — "Archive this exam? It moves to
Archived and stops accepting submissions. You can unarchive later." Primary
`Button` (danger-tone but reversible copy). On confirm → `saveExam` status
transition.

**Delete (destructive cascade):** strong `ConfirmDialog` — lists the cascade
explicitly with a live `Stat`: "This permanently deletes the exam, its
**{questionCount} questions**, **{submissionCount} submissions** and all
**analytics**. This cannot be undone." Requires typing the exam title to enable
the danger `Button` (type-to-confirm). On confirm → hard delete →
`onExamDeleted` cascade; route back to `/exams` with a Toast.

**Reduced motion:** save bar appears/disappears with opacity only; ConfidenceBar
bands snap instead of tween; modals fade without scale.

---

## 7. Content & copy

**Section headings (Fraunces h4/h5):** "Grading behavior" · "Evaluation profile"
· "Remediation link" · "Exam details" · "Danger zone".

**Toggle labels + downstream-effect helpers (text.secondary, the load-bearing
copy):**

- **Auto-grade with AI** — "When on, submissions run through scouting then AI
  grading (RELMS) automatically. When off, they stop at _Ready for review_ and
  you grade each question yourself."
- **Allow rubric editing** — "Lets graders adjust the rubric while reviewing.
  When off, the published rubric is fixed for this exam."
- **Allow manual override** — "Lets reviewers replace an AI score. The original
  AI score is always kept for audit."
- **Require override reason** — "Reviewers must enter a reason before an
  override is saved. (Requires manual override.)"
- **Release results automatically** — "When on, results become visible to
  students and parents as soon as grading completes. When off, you release them
  manually after review."

**Evaluation profile:** label "Evaluation settings"; helper "Sets the
dimensions, display options, and confidence thresholds AI uses. Confidence below
the review threshold is routed to you; above the auto-approve threshold is
accepted automatically." Link: "Manage profiles".

**Remediation link:** label "Learning space" / "Story point"; helper "Link this
exam to a LevelUp space so students with weak topics get targeted practice.
Optional."

**Post-publish lock InlineAlert:** "Published — total marks, passing marks, and
questions are locked to keep grading consistent. Title and linked space can
still change."

**Danger zone:** "Archive" helper "Stops new submissions; reversible." ·
"Delete" helper "Removes the exam and everything graded under it. Permanent."

**Empty copy:** "No evaluation profiles yet — create one to customize how AI
grades." · "No learning spaces to link."

**Error copy:** "Couldn't load exam settings." / "Couldn't save — {server
reason}." / "That field is locked after publishing." Tone: precise, declarative,
no exclamation, no blame.

---

## 8. Domain rules surfaced

- **Server-authoritative status machine:** `saveExam` enforces legal `status`
  transitions; the UI mirrors them by disabling controls but never decides them.
  The client's disabled state is advisory.
- **`POST_PUBLISH_LOCKED_FIELDS`:** once `status` ≥ `published`, locked metadata
  (e.g. `totalMarks`, `passingMarks`, question structure) renders with a 🔒
  affordance + `InlineAlert` explanation and disabled inputs. A `saveExam`
  attempt on a locked field is rejected server-side — the lock UI is a courtesy,
  not the enforcement.
- **Confidence routing (flagship):** the selected EvaluationSettings profile's
  `confidenceConfig` (`confidenceThreshold` 0.7, `autoApproveThreshold` 0.9)
  drives per-question routing — `<0.7` → `needs_review` (human required), `>0.9`
  → auto-approve, middle → `graded` + reviewSuggested. The `ConfidenceBar`
  preview makes this visible before grading runs. Service errors degrade to
  `needs_review`, captured in `gradingDeadLetter`.
- **Answer-key / model-answer never shown to students:** `AnswerKeyLock` visual
  on the profile section reinforces that rubric `modelAnswer` /
  `evaluatorGuidance` are teacher-only; this screen configures them, students
  never read them.
- **Override audit invariant:** "Allow manual override" + "Require override
  reason" govern the override flow elsewhere; copy states that
  `manualOverride.originalScore` is always retained (audit via
  OverrideTimeline). `requireOverrideReason` gating is enforced server-side at
  override time.
- **Explicit release:** unless "Release results automatically"
  (`releaseResultsAutomatically`) is on, `resultsReleased` stays false and
  students/parents cannot read results — surfaced as the toggle's downstream
  effect.
- **Tenant isolation:** every read (exam, evaluationSettings, spaces,
  submissions) and every `saveExam`/delete is scoped to the caller's tenant;
  `examId` is never trusted alone.
- **Cascade integrity:** delete invokes `onExamDeleted`, which removes
  `questions/`, `submissions/` (+ `questionSubmissions/`), and `examAnalytics/`
  — the ConfirmDialog enumerates exactly this so the teacher understands the
  blast radius.
- **`autoGrade` off ≠ no grading:** submissions still flow through scouting and
  land at `ready_for_review`; RELMS is simply not auto-invoked. Copy avoids
  implying grading is disabled entirely.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → Tabs → Grading-behavior switches (top-to-bottom)
  → Evaluation Select → "Manage profiles" → Remediation Comboboxes → metadata
  inputs (DOM order matching visual) → Danger-zone buttons → (when dirty)
  Discard → Save. Sticky save bar is reachable via tab without a keyboard trap.
- **Switches:** native `role="switch"` with `aria-checked`; label is the
  clickable target (≥44px); helper text linked via `aria-describedby` so screen
  readers announce the downstream effect. Dependent disable announces via the
  `InlineAlert` being `aria-live="polite"`.
- **Select / Combobox:** Radix-backed, full keyboard (type-ahead, arrow, Esc);
  `aria-expanded`/`aria-activedescendant`; never use empty string as an option
  value (per project lesson — use a sentinel like "none").
- **ConfirmDialogs:** focus moves to the dialog, trapped while open, returns to
  the triggering button on close; type-to-confirm input is labeled and its
  danger button stays `aria-disabled` until the title matches.
- **Locked fields:** `aria-disabled` + `aria-describedby` pointing at the lock
  InlineAlert so the reason is announced, not just the disabled state.
- **Contrast:** all toggle/label/helper, status Badges, and danger-zone text
  meet WCAG AA; status never by color alone — Badges and the ConfidenceBar carry
  icon + label (e.g. "Review required").
- **Reduced motion:** honors `prefers-reduced-motion` — save-bar and
  ConfidenceBar animations reduce to opacity/snap; no spring (this is staff
  config, not gamification — no celebratory motion here at all).
- **Live regions:** save success/failure announced via Toast with `aria-live`;
  in-flight `LoadingOverlay` exposes `aria-busy` on the form region.

---

## 10. Web ↔ mobile divergence

| Aspect          | teacher-web (today)                             | Future RN / scanner-web                                                                     |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Shell           | AppShell sidebar + topbar, ⌘K CommandPalette    | Tabbar nav; no ⌘K                                                                           |
| Tabs            | Inline Tabs row                                 | Horizontally scrollable Tabbar; sticky                                                      |
| Form layout     | Single reading column, 2-up metadata grid       | Stacked full-bleed `Section` cards, 1-up                                                    |
| Toggle rows     | Label+helper left, Switch right, hover tooltips | Label+helper stacked above Switch; press (no hover) → tooltips become tap-to-expand Popover |
| Save            | Sticky bar in content column                    | Bottom safe-area pinned bar                                                                 |
| Select/Combobox | Popover dropdown                                | Native bottom `Sheet` picker                                                                |
| ConfirmDialog   | Centered Modal (e3)                             | Full-height `Sheet` with the same cascade enumeration + type-to-confirm                     |
| Danger zone     | Collapsible-free section                        | Always expanded, last, extra spacing to avoid mis-tap                                       |
| scanner-web     | n/a                                             | This screen is **not** exposed — scanner role is intake-only and routed away                |

Component **names/props match 1:1** across shared-ui ↔ ui-native; only the
renderer differs (per Foundation §6).

---

## 11. Claude-design prompt

```
You are designing the "Exam Settings (Grading Config)" screen for Auto-LevelUp's teacher-web app.
CONFORM EXACTLY to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md):
Modern Scholarly — warm paper neutrals (bg.canvas/bg.surface), deep indigo brand.primary,
marigold spark reserved for gamification (NONE here — this is staff config), Fraunces for
section headings, Schibsted Grotesk for labels/body/buttons, Spline Sans Mono for any
numerics/IDs. Cite tokens by name (brand.primary, border.subtle, status.error, confidence.low/
med/high, text.secondary); never invent colors/fonts. Radius: cards lg, inputs/buttons md.
Motion: base 220 / fast 160, ease.standard; respect prefers-reduced-motion; no celebratory motion.

CONTEXT: Settings tab of /exams/:examId. The screen edits one Exam's gradingConfig and metadata
and ends its lifecycle. Render inside AppShell (Sidebar + Topbar), under a shared exam header
(title, status Badge, status-action) and Tabs (Questions / Submissions / Settings). Single reading
column, max width 1200, sections ≤720 reading width.

BUILD these sections (each a Lyceum `Section`), reading top to bottom:
1. Grading behavior — five `Switch` rows, each with a one-line downstream-effect helper in
   text.secondary: autoGrade ("AI grades automatically vs stops at Ready for review"),
   allowRubricEdit, allowManualOverride, requireOverrideReason (DISABLED unless allowManualOverride
   is on, with an aria-live InlineAlert note), releaseResultsAutomatically ("results visible to
   students/parents when on"). Compose as a ToggleEffectRow (Switch + label + helper + optional
   dependency notice).
2. Evaluation profile — a `Select` for evaluationSettingsId, a read-only `ConfidenceBar` preview
   showing the profile's thresholds (<0.7 review = confidence.low, 0.7–0.9 = confidence.med,
   >0.9 auto = confidence.high), an `AnswerKeyLock` visual (rubric/model-answer is teacher-only),
   and a ghost "Manage profiles" link. Empty: disabled Select + "Create evaluation profile" CTA.
3. Remediation link — two `Combobox`es (LevelUp Learning space → Story point), optional, story-point
   disabled until a space is chosen.
4. Exam details — title/subject Inputs, topics as `Chip` editor, examDate `DatePicker`, duration and
   total/passing marks Inputs. After publish, POST_PUBLISH_LOCKED_FIELDS render with a 🔒 affordance,
   disabled inputs, and an InlineAlert (status.info) explaining the lock.
5. Danger zone — border.error framed: Archive (reversible ConfirmDialog) and Delete (strong
   ConfirmDialog enumerating the onExamDeleted cascade: N questions + N submissions + analytics,
   type-the-title-to-confirm, danger Button).

Add a sticky save bar (Discard / Save changes) that slides up only when the form is dirty; saving
shows a LoadingOverlay (governance fields are NOT optimistic) and a sonner Toast on success/failure.

STATES: skeleton on load; empty (no profiles / no spaces); partial+locked while status is grading;
load error (InlineAlert + Retry); save error (Toast + preserved dirty + FormFieldError); read-only
for non-owner (hide danger zone) and archived (read-only + Unarchive).

DOMAIN RULES to make visible: every toggle states its pipeline/review effect; confidence routing
preview; answer-key never reaches students; saveExam is server-authoritative and rejects locked
fields; manualOverride keeps originalScore for audit; tenant-scoped throughout; delete cascade
spelled out before confirm.

A11y: logical focus order, role="switch" + aria-describedby helpers, Radix Select/Combobox (no
empty-string values), trapped ConfirmDialog focus, aria-disabled + reason on locked fields, WCAG AA,
status by icon+label never color alone.

Responsive: lg single column 2-up metadata; md icon-rail sidebar 1-up; sm scrollable Tabbar, stacked
full-bleed section cards, bottom-pinned save bar, danger zone always expanded last.

Output production-quality React + Tailwind (Lyceum @theme tokens) using shared-ui components only.
```
