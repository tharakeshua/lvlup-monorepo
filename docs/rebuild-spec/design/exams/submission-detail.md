# Submission Detail / Result Summary

_Read-oriented result view of a single graded/reviewed `Submission` — the
`ResultSummary` counterpart to the active grading interface, and the canonical
shape that feeds the sanitized parent/student released-results view._

---

## 1. Purpose & primary user

**Job-to-be-done.** Give a verified, scannable answer to one question: _"How did
this student do on this exam, and is the result trustworthy/releasable?"_ This
is the **read** view of a `Submission` after the pipeline has reached
`ready_for_review`, `reviewed`, or beyond — not the live grading workspace.

**Primary user — Teacher (full view).** Sees everything: per-question
`score`/`maxMarks`, `ConfidenceBadge`, `manualOverride` indicators with audit
trail, `RubricBreakdown`, model answer, token/cost, and the entry point back
into grading-review and into results-release. Job: confirm the grade is sound,
spot anything that still needs a human, then release.

**Secondary user — Student / Parent (released view).** Same screen shape,
**stripped**: sees `summary` (score, percentage, `GradePill`, grade band) and
_sanitized_ per-question feedback only. Model answer, raw `confidence`,
`costUsd`/tokens, rubric internals, and any "needs review" routing language are
hidden behind `AnswerKeyLock`. They reach this only when
`resultsReleased === true`.

This screen is intentionally calm and precise (staff register) in the teacher
variant; warm but minimal in the released variant. It is never an editing
surface — every mutation is a navigation _out_ to grading-review or a release
action.

---

## 2. Entry points & route

**Route:** `/exams/:examId/submissions/:submissionId` (read view).

**Entry points:**

- Submissions list/table row (`/exams/:examId/submissions`) → click a
  `SubmissionCard`/`DataTable` row.
- After completing grading-review → "Done"/back navigation lands here as the
  confirmation read.
- From `/exams/:examId` Submissions tab → row deep-link.
- Released-results deep link (student/parent apps) resolve to the sanitized
  variant of this same route shape.
- `CommandPalette` (⌘K) jump-to-submission by `rollNumber`/`studentName`
  (teacher-web only).

**Common-API reads/writes** (per `specs/common-api.md`, all tenant-scoped,
region `asia-south1`):

- `submissions.getLive(examId, submissionId)` — live `Submission` (summary,
  `pipelineStatus`, `resultsReleased`, `scoutingResult`).
- `questionSubmissions.listLive(examId, submissionId)` — per-question
  `QuestionSubmission` docs (`evaluation`, `gradingStatus`, `manualOverride`,
  `mapping`). `mapping.imageUrls` arrive as resolved HTTPS URLs from the API,
  never raw Storage paths.
- `exams.get(examId)` — `Exam` for `title`, `subject`, `totalMarks`,
  `passingMarks`, `gradingConfig`, `questions` metadata
  (text/`maxMarks`/`order`/`rubric`/`modelAnswer`).
- **Writes (navigation-only from this screen):** entering grading-review routes
  to `/exams/:examId/submissions/:submissionId` (active mode) which calls
  `gradeQuestion`; release is the `saveExam`/release action (sets
  `resultsReleased`, `resultsReleasedAt`/`By`) surfaced via the **Release
  results** affordance. This read screen itself issues no grading mutations.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). `Breadcrumb`: Exams ›
{Exam.title} › Submissions › {studentName}. Max content width 1200; reading
column for feedback capped ~720.

### lg (≥1024) — two-column

```
┌ AppShell ───────────────────────────────────────────────────────────────┐
│ Topbar: tenant · search · notifications · profile                        │
├──────────┬───────────────────────────────────────────────────────────────┤
│ Sidebar  │ Breadcrumb: Exams › Algebra Midterm › Submissions › A. Sharma  │
│          │                                                                │
│          │ ┌ Header row ──────────────────────────────────────────────┐  │
│          │ │ ⟨Avatar⟩ Aanya Sharma   Roll 24   ·   Class X-B          │  │
│          │ │ Pipeline: ✓ Reviewed       [Open grading review]  [Release│  │
│          │ │                                              results ▸]   │  │
│          │ └──────────────────────────────────────────────────────────┘  │
│          │ ┌ MAIN (≈720, scroll) ──────────────┐ ┌ ASIDE (sticky) ─────┐ │
│          │ │ ┌ ResultSummary (Card) ─────────┐ │ │ Release state Panel │ │
│          │ │ │ ⟨GradePill B+⟩   78 / 100      │ │ │  • resultsReleased? │ │
│          │ │ │ 78%  ·  PASS (≥40)            │ │ │  • releasedAt / By  │ │
│          │ │ │ 12/12 graded · done 14:03     │ │ │ Confidence rollup   │ │
│          │ │ └───────────────────────────────┘ │ │  (teacher only):    │ │
│          │ │                                   │ │   high 9·med 2·low 1│ │
│          │ │ Per-question Accordion (collapsed)│ │ Cost (teacher only) │ │
│          │ │ ┌ Q1 · 8/10 ⟨conf.high⟩      ▸ ┐ │ │  $0.014 · 4.2k tok  │ │
│          │ │ ┌ Q2 · 5/10 ⟨conf.low⟩ ⚑rev  ▸ ┐ │ └─────────────────────┘ │
│          │ │ ┌ Q3 · 10/10 ⟨override⟩      ▾ ┐ │                         │ │
│          │ │ │   RubricBreakdown (criteria)  │ │                         │ │
│          │ │ │   strengths · weaknesses      │ │                         │ │
│          │ │ │   structuredFeedback          │ │                         │ │
│          │ │ │   ⟨OverrideTimeline⟩ 7→10     │ │                         │ │
│          │ │ │   Model answer (teacher only) │ │                         │ │
│          │ │ └───────────────────────────────┘ │                         │ │
│          │ └───────────────────────────────────┘                         │ │
└──────────┴───────────────────────────────────────────────────────────────┘
```

### md (768–1023) — single column

ASIDE (Release state / confidence rollup / cost) collapses to a **horizontal
`Stat`/KPI strip** directly under `ResultSummary`, before the question list.
Header actions wrap to a second line.

### sm (<768) — stacked

`ResultSummary` becomes a full-bleed `Card`; KPI strip becomes a 2-up grid of
`Stat`s; per-question `Accordion` items become full-width stacked
`SubmissionCard`-style rows (tap to expand). Action buttons become a sticky
bottom bar (touch ≥44px). On mobile released apps, only the sanitized variant
ever renders.

---

## 4. Components used (Lyceum inventory only)

- **AppShell**, **Sidebar**, **Topbar**, **Breadcrumb** — chrome.
- **Card** (radius lg) — `ResultSummary` container and per-question expanded
  body.
- **Panel** — release-state / confidence-rollup aside.
- **Accordion** — per-question collapsed list (the spine of the page).
- **ResultSummary** (domain) — header score block.
- **GradePill** (domain) — letter grade, colored by `grade.A–F`, always with
  letter + label (never color alone).
- **ConfidenceBadge** (domain) — per-question `confidence.low/med/high`, icon +
  label.
- **RubricBreakdown** (domain) — `rubricBreakdown[]` criteria/dimensions on
  expand.
- **ManualOverrideControl** (domain, **read/disabled state here**) +
  **OverrideTimeline** (feedback pkg) — shows `manualOverride`
  `originalScore → score`, `reason`, `overriddenBy`, `overriddenAt`.
- **ConfidenceBar** (feedback pkg) — optional rollup visualization in aside.
- **AnswerKeyLock** (domain) — guards model-answer/confidence/cost regions in
  the released/student variant.
- **ContentRenderer** (domain, md+KaTeX) — question text, model answer, feedback
  bodies.
- **Avatar**, **Badge**, **Chip/Tag** — student identity, pipeline status,
  override/needs-review markers.
- **Stat/KPI** — score, percentage, graded-count, cost, confidence counts (md/sm
  strip).
- **Button** (primary/secondary/ghost/spark) — "Open grading review"
  (secondary), "Release results" (spark, hero action), per-question "Edit grade"
  deep-link (ghost).
- **InlineAlert/Banner** — partial/failed pipeline notices; "not yet released"
  reminder.
- **Skeleton** — loading.
- **EmptyState** — no-questions / not-yet-graded edge.
- **Toast (sonner)** — confirmation after release action returns from the modal.
- **ConfirmDialog / Modal** — release-results confirmation (the actual release
  happens here, then returns to this read view).
- **Tooltip** — explain confidence bands, override audit, locked regions.

_No additions required; all needs compose from the inventory._

---

## 5. States

**Loading** — `Skeleton`: header identity line, a `ResultSummary`-shaped block,
and 6–8 collapsed `Accordion` row skeletons. Aside Panel shows shimmer rows. No
layout shift on resolve (reserve heights).

**Empty / not-yet-graded** — if `submissions.getLive` resolves but
`summary.questionsGraded === 0` or
`pipelineStatus ∈ {uploaded, scouting, scouting_complete, grading}`: render
`EmptyState` ("Grading in progress") inside the main column with a live pipeline
`Badge` and progress copy from `gradingProgress.*`; suppress score/aside. Do
**not** surface vestigial `ocr_*` states.

**Partial** — `pipelineStatus ∈ {grading_partial, manual_review_needed}` or any
question with `gradingStatus ∈ {needs_review, failed}`: show `InlineAlert`
(warning) above the list — "{n} questions still need review" — and badge those
rows with `confidence.low`/⚑. `ResultSummary` shows graded-so-far with an
explicit "{graded}/{total} graded" qualifier; release action is **disabled**
with a tooltip reason.

**Error** — read failure (`submissions.getLive` rejects, tenant mismatch, or
`pipelineStatus ∈ {scouting_failed, grading_failed, finalization_failed, failed}`):
`InlineAlert` (error) with the `pipelineError` and a "Open grading review"
recovery CTA. Tenant-isolation/permission failure renders a generic "Submission
not found" (never leaks cross-tenant existence).

**Success** — `pipelineStatus ∈ {grading_complete, ready_for_review, reviewed}`:
full `ResultSummary` + populated `Accordion`. If `resultsReleased`, aside Panel
shows released chip + `releasedAt/By`; if not, shows "Not released yet" with the
release CTA.

**Permission / role-gated variations**

- **Teacher (full):** confidence, model answer, rubric internals, cost/tokens,
  override audit, grading-review + release CTAs all visible.
- **Student/Parent (released):** only when `resultsReleased === true`. Model
  answer, raw `confidence`, `costUsd`/tokens, "needs review" routing language,
  and `OverrideTimeline` internals are removed (not merely hidden in DOM — gated
  server-side; `AnswerKeyLock` renders where a locked region would be). No
  grading-review or release CTAs. Pre-release deep link → "Results not yet
  available."

---

## 6. Interactions & motion

- **Expand/collapse question** — `Accordion` body animates height/opacity at
  `base 220ms`, `ease.standard`. Chevron rotates `fast 160ms`. Only one need not
  stay open; multiple-open allowed. `mapping.imageUrls` (answer crops) lazy-load
  on first expand.
- **Open grading review** (secondary `Button`) — `page 420ms` transition to the
  active grading mode at the same route family; this read view is the natural
  return target.
- **Release results** (spark `Button`, hero) — opens `ConfirmDialog`/`Modal`
  (`e3` elevation) summarizing score + "Students and parents will be able to see
  this result." Confirm calls the release action; on success: modal exits
  (`ease.exit`), aside Panel flips to "Released" state, and a single `Toast`
  confirms. Respects `requireOverrideReason`/release gating; if any question is
  `needs_review`, the confirm is blocked with an inline reason rather than
  silently failing.
- **Optimistic update** — the aside release chip flips optimistically to
  "Released" on confirm; rolls back with an error `Toast` if the write rejects.
  No optimistic mutation of scores (this screen never edits scores).
- **Live updates** — `getLive`/`listLive` subscriptions; if a value changes
  underneath the user (e.g. a parallel grading-review finishes), the affected
  row/summary cross-fades `fast 160ms` rather than hard-swapping.
- **Reduced motion** — all height/cross-fade/spring replaced by instant opacity
  per `prefers-reduced-motion`. No celebratory spring here (gamification owns
  the one celebratory moment, not staff/result views).

---

## 7. Content & copy

- **Breadcrumb:** Exams › {Exam.title} › Submissions › {studentName}.
- **Header:** "{studentName}" (display), "Roll {rollNumber} · {className}"
  (secondary), pipeline `Badge` label ("Reviewed", "Ready for review",
  "Grading…", "Needs review").
- **ResultSummary:** big "{totalScore} / {maxScore}" (mono), "{percentage}%",
  "PASS" / "BELOW PASS ({passingMarks})", "{questionsGraded}/{totalQuestions}
  graded", "Completed {completedAt}".
- **Per-question row:** "Q{order} · {score}/{maxMarks}", confidence chip label
  "High / Spot-check / Review", "Overridden" chip when `manualOverride` present.
- **Aside (teacher):** "Release status" → "Released {date} by {name}" or "Not
  released yet". "Confidence" → "High {n} · Spot-check {n} · Review {n}". "AI
  cost" → "${costUsd} · {input+output} tokens" (teacher-only, with tooltip
  "Visible to staff only").
- **Empty:** title "Grading in progress" — body "We're still grading
  {studentName}'s answers. This page updates automatically."
- **Partial alert:** "{n} question(s) still need a human review before this
  result can be released."
- **Error:** "We couldn't load this submission." / "Grading failed on {step}.
  Open grading review to retry." Permission/tenant: "Submission not found."
- **Released (student/parent):** "Your result" / "Score: {totalScore}/{maxScore}
  ({percentage}%)". Locked regions read "Model answers are not shared." Tone:
  warm, plain, no AI/confidence jargon.

Tone: teacher copy is terse and precise; released copy is encouraging and free
of internal pipeline/confidence/cost vocabulary.

---

## 8. Domain rules surfaced

- **Answer key never shown to students.** `rubric.modelAnswer`,
  `showModelAnswer` internals, and raw rubric criteria are teacher-only; the
  released variant renders `AnswerKeyLock` in their place. Sanitization is
  **server-authoritative**, not CSS-hidden.
- **Confidence routing is visible to staff only.** `confidence.low (<0.7)` →
  review-required chip; `med (0.7–0.9)` → spot-check; `high (>0.9)` →
  auto-accepted. Thresholds come from `EvaluationSettings.confidenceConfig`
  (`confidenceThreshold` 0.7 / `autoApproveThreshold` 0.9). Students never see
  raw confidence or "needs review" language.
- **Release gating.** Students/parents can only read once
  `resultsReleased === true` (manual release or
  `gradingConfig.releaseResultsAutomatically`). `resultsReleasedAt`/`By` are the
  audit trail. Release is disabled while any question is `needs_review`/`failed`
  or pipeline is partial.
- **Override audit.** `manualOverride` retains `originalScore`, `reason`,
  `overriddenBy`, `overriddenAt` — surfaced via `OverrideTimeline` (teacher) and
  never exposed to students. `requireOverrideReason` is enforced upstream in
  grading-review.
- **Server-authoritative status.** `pipelineStatus` / `gradingStatus` drive
  every state; the UI reflects, never invents, status. Vestigial `ocr_*` states
  are not surfaced.
- **Tenant isolation.** Every read (`exams.get`, `submissions.getLive`,
  `questionSubmissions.listLive`) is tenant-scoped; cross-tenant access returns
  "not found", not a leak.
- **Post-publish locks.** This screen exists only post-publish; it never edits
  `Exam` locked fields and respects `gradingConfig.allowManualOverride` for
  whether grading-review entry is offered.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → header actions (Open grading review → Release
  results) → `ResultSummary` → each `Accordion` trigger in `order` → aside
  Panel. Modal traps focus and returns it to the Release button on close.
- **Keyboard:** `Accordion` triggers operate on Enter/Space, expose
  `aria-expanded`/`aria-controls`; arrow-key roving between rows. Release
  confirm reachable and operable via keyboard; Esc closes.
- **ARIA:** `ConfidenceBadge`, `GradePill`, override and pipeline chips carry
  text labels (icon-only is never used to convey status). Locked regions use
  `aria-hidden` content plus a visible "not shared" label. Live regions
  (`aria-live="polite"`) announce pipeline/release state changes.
- **Contrast:** all grade/confidence/status pairs meet WCAG AA (4.5:1 text, 3:1
  large/UI) per foundation; status always icon + label, never color alone.
- **Reduced motion:** `prefers-reduced-motion` swaps all transitions for instant
  opacity; no parallax/spring.
- **Numerics:** scores/IDs/cost use Spline Sans Mono (tabular) for unambiguous
  reading; touch targets ≥44px on mobile.

---

## 10. Web ↔ mobile divergence

| Aspect          | teacher-web (today)                 | future RN / student-parent / scanner-web                                            |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Question list   | `Accordion` rows, hover affordances | stacked `SubmissionCard`-style tap-to-expand                                        |
| Aside Panel     | sticky right column (lg)            | inline KPI strip / collapsed section                                                |
| Actions         | inline buttons + ⌘K jump            | sticky bottom action bar, no ⌘K                                                     |
| Hover           | tooltips on hover                   | long-press / info tap                                                               |
| Variant         | full teacher view                   | released apps render **only** the sanitized variant; `AnswerKeyLock` always present |
| Cost/confidence | shown                               | never rendered (server omits)                                                       |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only the
renderer differs. scanner-web (planned intake) does not render this result view
at all — it only feeds `uploadSource: "scanner"` submissions upstream.

---

## 11. Claude-design prompt

```
You are designing the "Submission Detail / Result Summary" screen for Auto-LevelUp's
teacher-web app. Conform EXACTLY to the Lyceum design system
(docs/rebuild-spec/design/00-FOUNDATION.md) — Modern Scholarly. Cite tokens by name
(bg.canvas, bg.surface, text.primary/secondary, brand.primary, spark, border.subtle,
confidence.low/med/high, grade.A–F, status.*); do NOT invent tokens, fonts, or variants.
Fonts: Fraunces (display/hero numbers), Schibsted Grotesk (UI/body/tables),
Spline Sans Mono (scores, IDs, cost, tabular). Radius lg cards / md buttons / pill chips.
Motion base 220ms ease.standard; respect prefers-reduced-motion; NO celebratory motion here.

Route: /exams/:examId/submissions/:submissionId (READ view). Render inside AppShell
(Sidebar + Topbar + Breadcrumb: Exams › {Exam.title} › Submissions › {studentName}).

This is the read-only result view of one graded Submission. Build BOTH variants:

TEACHER (full):
- Header: Avatar + studentName, "Roll {rollNumber} · {className}", pipeline status Badge,
  secondary Button "Open grading review", spark Button "Release results".
- ResultSummary Card: GradePill (grade.A–F, letter+label), "{totalScore}/{maxScore}" (mono),
  "{percentage}%", PASS/BELOW PASS vs passingMarks, "{questionsGraded}/{totalQuestions} graded",
  completedAt.
- Per-question Accordion (collapsed): "Q{order} · {score}/{maxMarks}", ConfidenceBadge
  (confidence.low/med/high, icon+label), "Overridden" chip when manualOverride exists.
  On expand: RubricBreakdown (rubricBreakdown[] criteria), strengths/weaknesses,
  structuredFeedback (ContentRenderer md+KaTeX), OverrideTimeline (originalScore→score, reason,
  overriddenBy, overriddenAt), and model answer.
- Aside Panel (sticky lg): Release status (resultsReleased / releasedAt / By), confidence rollup
  (High/Spot-check/Review counts), AI cost (costUsd + tokens, "staff only" tooltip).

STUDENT/PARENT (released, only when resultsReleased === true): SAME shape, STRIPPED — hide
model answer, raw confidence, cost/tokens, "needs review" language, override internals; render
AnswerKeyLock where locked regions would be. Warm, jargon-free copy. No grading/release CTAs.

States: Skeleton loading; "Grading in progress" EmptyState; partial (InlineAlert "{n} need review",
release disabled); error (pipelineError + recovery CTA); success. NEVER surface ocr_* states.
Never encode status by color alone — always icon + label. Tenant-isolated reads; "Submission not
found" on permission failure. md → single column + KPI strip; sm → stacked cards + sticky bottom
actions, touch ≥44px. Use only Lyceum inventory components (AppShell, Card, Panel, Accordion,
ResultSummary, GradePill, ConfidenceBadge, RubricBreakdown, ManualOverrideControl, OverrideTimeline,
AnswerKeyLock, ContentRenderer, Stat, Button, InlineAlert, Skeleton, EmptyState, Toast, ConfirmDialog).
Output production-ready React + Tailwind reading the Lyceum @theme tokens.
```
