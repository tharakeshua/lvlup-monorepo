# Manual Override Control & Timeline

_The teacher's audit-tracked control to correct an AI question score — set a new
mark + reason, see original vs new at a glance, and read the full override
history — backed by a server-recomputed submission summary._

---

## 1. Purpose & primary user

**Primary user:** Teacher / Grader (role with `allowManualOverride` granted on
the exam's `gradingConfig`). Secondary viewer: Tenant Admin auditing grading
decisions.

**Job-to-be-done:** "When the AI's RELMS evaluation for a question is wrong,
borderline, or flagged `needs_review` by confidence routing, I want to set the
authoritative score myself — with a documented reason — so the student's result
is correct and every change is auditable."

This is a **focused control + audit surface**, not a full page. It lives inside
the GradingReview screen (`/exams/:examId/submissions/:submissionId`) as the
override affordance attached to each `QuestionSubmission`, plus the
`OverrideTimeline` that records who changed what, when, and why. The flagship
domain concept it serves is **human-in-the-loop confidence routing**:
low-confidence questions (`confidence < confidenceThreshold` → `needs_review`)
are precisely the ones a human is expected to override here.

---

## 2. Entry points & route

**Route:** `/exams/:examId/submissions/:submissionId` — the override flow is the
action layer on the GradingReview screen, opened per-question.

**Entry points:**

- Inline **"Override score"** action on a `QuestionSubmission` row/card in
  GradingReview (always available when
  `gradingConfig.allowManualOverride === true`).
- Direct call-to-action on questions in `gradingStatus: needs_review` /
  `manual_review_needed` (confidence-routed) — the override control is the
  primary next step there.
- **Bulk approve** path from the Submissions list / review header
  (`gradeQuestion` server-side bulk-approve), which writes
  `manualOverride.reason = 'Bulk approved'` across selected high-confidence
  questions.

**Common-API reads/writes** (see `specs/common-api.md`):

- **Read (live):** `questionSubmissions.listLive(examId, submissionId)` → each
  `QuestionSubmission{ evaluation(UnifiedEvaluationResult), gradingStatus, manualOverride? }`.
  `submissions.getLive(examId, submissionId)` →
  `Submission.summary{ totalScore, maxScore, percentage, grade }`,
  `gradingConfig` flags. `exams.get(examId)` →
  `gradingConfig{ allowManualOverride, requireOverrideReason, allowRubricEdit }`
  and per-question `maxMarks`.
- **Write (callable):**
  `gradeQuestion({ examId, submissionId, questionId, mode: 'manual', score, reason })`
  → writes
  `QuestionSubmission.manualOverride{ score, reason, overriddenBy, overriddenAt, originalScore }`,
  sets `gradingStatus → overridden`, and **server-recomputes**
  `Submission.summary` (`totalScore`, `percentage`, `grade`, `questionsGraded`).
  Bulk approve =
  `gradeQuestion({ mode: 'manual' /* bulk */, reason: 'Bulk approved' })`
  server-side fan-out.
- No client ever writes `manualOverride` directly; the callable is the only
  authority (server stamps `overriddenBy`/`overriddenAt` and preserves
  `originalScore`).

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** (Sidebar + Topbar) on the GradingReview page. The
override control is a **Popover** (lg) anchored to the question, or a right-side
**Sheet** on smaller widths; the **OverrideTimeline** is a **Section** within
the question detail.

### lg (≥1024) — GradingReview with override Popover + Timeline

```
┌ AppShell ─────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant · search · ⌘K · profile)                          │
│         ├──────────────────────────────────────────────────────────────────┤
│ Exams   │ Breadcrumb: Exams / {title} / Submissions / {studentName}         │
│ ▸active │ ┌─ ResultSummary ──────────────────────────────────────────────┐ │
│         │ │ {totalScore}/{maxScore} · {percentage}% · GradePill {grade}   │ │
│         │ │ {questionsGraded}/{totalQuestions} graded · summary recompute │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Question detail (selected) ──────────┐ ┌ Override Popover ───┐ │
│         │ │ QuestionCard · ContentRenderer        │ │ Override · Q{order} │ │
│         │ │ RubricBreakdown                       │ │ Original (AI): 6/10 │ │
│         │ │ ConfidenceBadge {low/med/high}        │ │ ┌ Score ──────────┐ │ │
│         │ │ Score: 6/10  GradeContext             │ │ │ Slider 0──●──10 │ │ │
│         │ │ ┌ ManualOverrideControl trigger ────┐ │ │ │ Input [ 8 ]/10  │ │ │
│         │ │ │ [Override score]  (Button 2ndary) │ │ │ └─────────────────┘ │ │
│         │ │ └───────────────────────────────────┘ │ │ Reason * (Textarea) │ │
│         │ │                                       │ │ [____________]      │ │
│         │ │ ── OverrideTimeline (Section) ──────  │ │ FormFieldError      │ │
│         │ │  ● 6→8  Ms. Rao · 2m ago · "Partial   │ │ [Cancel] [Save ▸]   │ │
│         │ │    credit for method, see step 2"     │ └─────────────────────┘ │
│         │ │  ● AI graded 6/10 · conf 0.62 (low)   │                         │
│         │ └───────────────────────────────────────┘                         │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

### md (768–1023)

- Override Popover becomes a **Drawer/Sheet** sliding from the right
  (full-height, max ~420). Question detail + Timeline stack to single column.
  ResultSummary stays sticky at top.

### sm (<768, future RN/scanner-web)

- Override = **bottom Sheet** (Drawer). Slider + numeric Input stacked, Reason
  Textarea full-width, sticky `[Save]` footer with ≥44px targets. Timeline
  collapses into an Accordion ("History · {n}"). ⌘K unavailable.

**Region notes:** the **AnswerKeyLock** visual sits adjacent to
model-answer/rubric content to signal it is staff-only and never
student-visible. Max content width 1200; reading column for ContentRenderer
≤720.

---

## 4. Components used (Lyceum inventory)

**Domain:** `ManualOverrideControl` (the composite — trigger + score input +
reason + submit), `OverrideTimeline` (audit list), `ConfidenceBadge`,
`GradePill`, `RubricBreakdown`, `QuestionCard`, `ContentRenderer`,
`ResultSummary`, `AnswerKeyLock`, `SubmissionCard` (in the surrounding review
list context).

**Primitives:** `Slider` (bounded 0..`maxMarks`, step matched to rubric
granularity), `Input` (numeric mirror of the slider, bounded), `Textarea`
(reason), `Button` (secondary trigger "Override score"; primary "Save override";
ghost "Cancel"; **danger** confirm when lowering), `IconButton`.

**Containers:** `Popover` (lg override surface) / `Drawer/Sheet` (md/sm),
`Section` (Timeline), `Accordion` (collapsed history on mobile), `Card`/`Panel`.

**Feedback:** `Toast` (sonner — "Score overridden · summary updated"),
`ConfirmDialog` (lowering score), `FormFieldError` (reason required),
`InlineAlert/Banner` (override disabled / locked states), `LoadingOverlay`
(during recompute on the affected summary), `Skeleton`.

**Data:** `Timeline` (the base for OverrideTimeline), `Badge`/`Chip` (status
pills, "Manual", "Overridden", "Bulk approved"), `Avatar` (who in timeline),
`DefinitionList` (original vs new score pairing).

**Proposed addition (justified):** none required — `OverrideTimeline` and
`ManualOverrideControl` are already in the domain inventory; this spec composes
the standard `Timeline`, `Slider`, and `ConfirmDialog` into them.

---

## 5. States

**Loading:** `Skeleton` for ResultSummary, question detail, and a 2-row Timeline
skeleton while `questionSubmissions.listLive` / `submissions.getLive` resolve.
Override trigger disabled until data loaded.

**Empty (no overrides yet):** OverrideTimeline shows a single non-interactive
entry — the AI grading event
(`AI graded {score}/{max} · confidence {value} ({low/med/high})`). No "empty
state" illustration; the AI event is always the timeline's origin.

**Error:**

- Read error → `InlineAlert` (error) "Couldn't load grading details. Retry."
  with retry.
- `gradeQuestion` failure → roll back optimistic value, `Toast` (error)
  "Override didn't save. Try again." Control re-opens with entered values
  preserved.
- Service-degraded question (`gradingStatus: needs_review` /
  `manual_review_needed` from quota/circuit/rate-limit, captured in
  `gradingDeadLetter`) → `InlineAlert` (warning) "AI couldn't grade this — set
  the score manually." Override control is the primary action; there is no AI
  score to strike through (original shown as "—").

**Partial:** Submission in `grading_partial` / `grading_complete` with some
questions still `pending`/`processing` — ungraded questions show override
**disabled** with tooltip "Available once grading completes." Already-graded
questions remain overridable.

**Success:** After save, the question score shows **new value** with the
**original struck-through** (`6` strike → `8`), `gradingStatus → overridden`
(Badge "Overridden · Manual"), Timeline gains a new entry at top, ResultSummary
recomputes (server-authoritative). One subtle highlight pulse on the changed
score.

**Permission / role-gated:**

- `gradingConfig.allowManualOverride === false` → trigger hidden; `InlineAlert`
  (info) "Manual override is disabled for this exam." Read-only Timeline still
  visible to admins.
- `gradingConfig.requireOverrideReason === true` → Reason `Textarea` marked
  required; Save disabled + `FormFieldError` "A reason is required to override
  this score." until non-empty.
- Student/parent: this control and the AnswerKeyLock-guarded rubric/model-answer
  are **never rendered** for them; they only ever see released `summary` fields.

---

## 6. Interactions & motion

**Open override:** click "Override score" (secondary `Button`) → Popover enters
`fast 160ms` `ease.entrance` (Sheet on md/sm slides `base 220ms`). Focus moves
to the Slider; original AI score is pre-loaded as the starting value so a no-op
is visible.

**Set score:** `Slider` and numeric `Input` are two-way bound and clamped to
`0..maxMarks`. Dragging is `instant 100ms`. The "new vs original"
`DefinitionList` updates live; if `new < originalScore`, the Save button
switches to **danger** variant and label hint "Lower score".

**Reason:** typing clears `FormFieldError`. With `requireOverrideReason`, Save
stays disabled while empty.

**Submit (optimistic):**

1. On Save, optimistically apply new score to the question and ResultSummary,
   set Badge → "Overridden", add a provisional Timeline entry
   (`overriddenBy = current user`, `overriddenAt = now`).
2. Call `gradeQuestion({ mode: 'manual', score, reason })`.
3. On success: reconcile with server `manualOverride` (server-stamped
   `overriddenBy`/`overriddenAt`, recomputed `summary`), `Toast` (success,
   sonner) "Score overridden · summary updated." Changed score does the single
   subtle highlight (no celebratory spring — that's reserved for gamification
   only).
4. On failure: revert optimistic state `fast 160ms` `ease.exit`, `Toast`
   (error), reopen control with values intact.

**Confirm on lowering:** if `score < originalScore`, intercept Save with a
`ConfirmDialog` (e3 modal, `base 220ms`): "Lower this score? This reduces the
student's result and is recorded in the audit timeline." Buttons: ghost "Cancel"
/ danger "Lower score". (Raising or equal scores skip the dialog.)

**Bulk approve:** from review header, `gradeQuestion` server bulk-approve writes
`manualOverride{ reason: 'Bulk approved' }` to selected high-confidence
questions; each gains a Timeline entry labeled "Bulk approved", `Toast` "{n}
questions approved." A `ConfirmDialog` precedes bulk approve summarizing count
and that originals are preserved.

**Recompute feedback:** while the server recomputes `summary`, a light
`LoadingOverlay` sits over the ResultSummary only (not the whole page); resolves
on the live read.

All motion respects `prefers-reduced-motion` (cross-fades replace slides/pulse).

---

## 7. Content & copy

Tone: **precise, neutral, audit-aware** (staff-facing).

- **Override trigger:** `Override score`
- **Popover/Sheet title:** `Override · Q{order}` (or
  `Override · {subQuestion.label}` for multi-part)
- **Original score line:** `Original (AI): {originalScore}/{maxMarks}` · with
  `ConfidenceBadge`. If no AI score: `Original: — (not graded by AI)`
- **New score label:** `New score` · helper `0–{maxMarks}`
- **Reason label:** `Reason` (suffix `*` when required) · placeholder
  `Why are you changing this score? (visible in the audit timeline)`
- **FormFieldError:** `A reason is required to override this score.`
- **Buttons:** `Save override` / `Cancel`; danger path `Lower score`
- **ConfirmDialog (lower):** title `Lower this score?` body
  `This reduces the student's result and is recorded in the audit timeline.`
- **ConfirmDialog (bulk):** title `Approve {n} questions?` body
  `AI scores are accepted as final and logged as "Bulk approved". Original AI scores are preserved.`
- **Toasts:** success `Score overridden · summary updated.` · bulk
  `{n} questions approved.` · error `Override didn't save. Try again.`
- **Timeline entries:**
  - Override: `{originalScore} → {score}` · `{overriddenBy}` ·
    `{relative overriddenAt}` · reason quoted
  - AI origin: `AI graded {score}/{maxMarks}` ·
    `confidence {value} ({low/med/high})`
  - Bulk: `Bulk approved · {overriddenBy} · {time}`
- **Disabled banner:** `Manual override is disabled for this exam.`
- **Degraded banner:** `AI couldn't grade this — set the score manually.`
- **Partial tooltip:** `Available once grading completes.`

---

## 8. Domain rules surfaced

- **Audit-tracked & server-authoritative:** override is written only via
  `gradeQuestion(mode:'manual')`; the server stamps
  `overriddenBy`/`overriddenAt`, preserves `originalScore`, sets
  `gradingStatus → overridden`, and **recomputes `Submission.summary`**
  (totalScore/percentage/grade). The client never computes the final summary or
  writes `manualOverride` directly. The `OverrideTimeline` (original → new, who,
  when, why) is the visible audit trail.
- **`originalScore` is never lost:** every override keeps the prior value for
  audit; the struck-through original in the UI mirrors this. Successive
  overrides each append to the Timeline.
- **Gating:** `allowManualOverride` controls whether the control exists;
  `requireOverrideReason` gates submit on a non-empty reason. Both come from the
  exam's `gradingConfig`.
- **Confidence routing drives priority:**
  `confidence < confidenceThreshold (0.7)` → `needs_review` (override expected
  here); `> autoApproveThreshold (0.9)` → auto-approved (override still allowed
  but de-emphasized); service errors degrade to
  `needs_review`/`manual_review_needed` and are captured in `gradingDeadLetter`.
- **Answer-key never shown to students:** rubric, `modelAnswer`, evaluator
  guidance, and the override control sit behind `AnswerKeyLock` and render only
  for authorized staff. Students/parents see only released `summary` fields, and
  only after results are released.
- **Bounded score:** new score is clamped `0..maxMarks` for the question (or
  sub-question), enforced both client-side and by `gradeQuestion`.
- **Tenant isolation:** all reads/writes are tenant-scoped; `gradeQuestion`
  validates the caller's tenant + role before mutating.
- **Post-publish locks:** override operates on grading data, not the locked exam
  metadata; it does not touch `POST_PUBLISH_LOCKED_FIELDS`. Lowering scores
  after release still routes through the same audited path.

---

## 9. Accessibility

- **Focus order:** trigger → Popover/Sheet opens → focus on Slider → Input →
  Reason Textarea → Cancel → Save. Focus trapped within the
  Popover/Sheet/Dialog; on close, focus returns to the trigger.
- **Keyboard:** Slider operable with arrow keys (±1), Home/End to bounds;
  numeric Input fully editable; Tab cycles controls; Esc closes (with
  unsaved-changes guard if values changed); Enter on Save submits (routing
  through ConfirmDialog when lowering).
- **ARIA:** Popover/Sheet `role="dialog"` `aria-modal`, labelled by
  `Override · Q{order}`. Slider `role="slider"` with `aria-valuemin=0`
  `aria-valuemax={maxMarks}` `aria-valuenow`
  `aria-valuetext="{score} of {maxMarks}"`. Reason has `aria-required` when
  gated and `aria-describedby` → FormFieldError. Timeline is an ordered `list`;
  each entry announces score change, actor, time, reason. ConfirmDialog
  `role="alertdialog"`.
- **Status not by color alone:** `ConfidenceBadge`, `GradePill`, and
  "Overridden"/"Bulk approved" Badges always carry an icon + text label; the
  struck-through original is paired with the explicit `Original (AI):` label,
  not color alone.
- **Contrast:** all pairs meet WCAG AA; danger Save and confidence/grade tokens
  verified against `bg.surface`.
- **Reduced motion:** highlight pulse, slide-ins, and overlay transitions
  degrade to instant cross-fades under `prefers-reduced-motion`.
- **Targets:** all interactive elements ≥44px on touch; Slider thumb enlarged on
  coarse pointers.

---

## 10. Web ↔ mobile divergence

| Aspect           | teacher-web (today)                                 | Future RN / scanner-web                               |
| ---------------- | --------------------------------------------------- | ----------------------------------------------------- |
| Override surface | Popover anchored to question (lg); right Sheet (md) | Bottom **Sheet** / Drawer, sticky Save footer         |
| Score input      | Slider + numeric Input side-by-side                 | Slider + stepper Input stacked, large thumb           |
| Timeline         | Inline `Section` with full `Timeline`               | Collapsed `Accordion` "History · {n}", expand to list |
| Original vs new  | Inline strikethrough + DefinitionList               | Stacked rows, "was {original} → now {new}"            |
| Confirm (lower)  | `ConfirmDialog` modal                               | Native action-sheet style confirm                     |
| Interaction      | hover reveals row actions                           | press; long-press for question actions                |
| Command palette  | ⌘K available                                        | none                                                  |
| Bulk approve     | header multi-select + DataTable selection           | select mode on stacked SubmissionCards                |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only the
renderer (Popover vs bottom Sheet) differs.

---

## 11. Claude-design prompt

```
Design the "Manual Override Control & Timeline" surface for Auto-LevelUp's AutoGrade
(teacher-web), conforming EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md. Cite tokens by name; do not invent any.

CONTEXT: This is the override action layer inside GradingReview
(/exams/:examId/submissions/:submissionId). A teacher corrects an AI question score.
Render inside AppShell (Sidebar + Topbar). Compose ONLY from the Lyceum inventory:
ManualOverrideControl, OverrideTimeline, ConfidenceBadge, GradePill, RubricBreakdown,
ResultSummary, AnswerKeyLock, ContentRenderer, plus Slider, Input, Textarea, Button,
Popover/Sheet, ConfirmDialog, Toast (sonner), InlineAlert, FormFieldError, Timeline,
Badge, DefinitionList, Skeleton, LoadingOverlay.

BUILD:
1. A ManualOverrideControl opened as a Popover (lg) / right Sheet (md) / bottom Sheet (sm):
   - "Original (AI): {originalScore}/{maxMarks}" with a ConfidenceBadge (low/med/high).
   - A Slider bound two-way to a numeric Input, clamped 0..maxMarks.
   - A required-when-gated Reason Textarea (requireOverrideReason) with FormFieldError.
   - Buttons: secondary "Override score" trigger, primary "Save override", ghost "Cancel".
     When new score < original, Save becomes the DANGER variant and is gated by a
     ConfirmDialog "Lower this score?".
2. An OverrideTimeline (Section, built on Timeline): newest first, each entry shows
   "{original} → {new}", actor (Avatar + name), relative time, and quoted reason; the
   origin entry is "AI graded {score}/{max} · confidence {value} (low/med/high)".
3. A ResultSummary header that recomputes (server-authoritative) after save, with a
   scoped LoadingOverlay during recompute and a GradePill.
4. Show the new score with the ORIGINAL struck-through, and an "Overridden · Manual" Badge.

BEHAVIOR: optimistic update on Save → gradeQuestion(mode:'manual'); success Toast
"Score overridden · summary updated.", reconcile with server-stamped manualOverride;
on failure revert and reopen with values intact. Include a bulk-approve confirm that
writes reason "Bulk approved".

DOMAIN RULES TO HONOR: answer-key/rubric/modelAnswer behind AnswerKeyLock, never shown
to students; originalScore always preserved (audit); allowManualOverride hides the
control when false; requireOverrideReason gates submit; tenant-scoped; status by
icon + label, never color alone.

TYPE: Fraunces for the override/empty titles and hero numbers; Schibsted Grotesk for
labels/buttons/timeline body; Spline Sans Mono for scores/IDs. Radius: cards lg,
inputs/buttons md, chips pill. Elevation e2 for Popover, e3 for ConfirmDialog, focus
ring per spec. Motion: Popover fast 160ms ease.entrance, Sheet base 220ms, revert
ease.exit; NO celebratory spring (reserved for gamification); honor
prefers-reduced-motion. Light + dark themes from semantic tokens.
Deliver a responsive React + Tailwind implementation using shared-ui components.
```
