# EXAMS (AutoGrade) — Design Specs

The **AutoGrade** area is Auto-LevelUp's AI physical-exam grading pipeline:
teachers and admins turn a stack of scanned paper exams into confidence-routed,
human-reviewed, releasable results. The end-to-end flow is:

> **Upload question paper → Gemini extraction** (`extractQuestions` mode:full
> mines questions + rubrics) **→ teacher review/correct → publish → upload
> answer sheets** (`uploadAnswerSheets` creates a Submission) **→ Panopticon
> scouting → RELMS per-question grading → confidence routing → teacher review /
> override → release** to students/parents.

Every screen is **multi-tenant** (all reads/writes tenant-scoped,
server-authoritative), built on the Lyceum design system, and conforms to
[`../00-FOUNDATION.md`](../00-FOUNDATION.md). The flagship cockpit of the whole
area is **[Grading Review ★](./grading-review.md)** — the human-in-the-loop
surface where AI scores are reviewed, overridden, and trusted.

---

## Pipeline lifecycle (how the screens connect)

Three server-authoritative status machines thread through these screens;
understanding them is the fastest way to see how one screen hands off to the
next.

- **`ExamStatus`** — the exam's authoring lifecycle, written only by the
  `saveExam` callable (`VALID_STATUS_TRANSITIONS`):
  `draft → published → in_progress → completed → results_released` (plus
  `archived`). `POST_PUBLISH_LOCKED_FIELDS` freeze metadata/questions/marks once
  published. Drives: **Exams List**, the **Create wizard**, **Detail/Overview**,
  **Questions Editor**, **Settings**, **Results Release**.
- **`SubmissionPipelineStatus`** — one student's answer sheet moving through the
  grading pipeline:
  `uploaded → scouting → grading → needs_review / graded → released`. The
  create-trigger auto-starts the pipeline; a 15-min stale watchdog escalates to
  the dead-letter queue. Drives: **Answer Sheet Upload**, **Submissions Grading
  Queue**, **Pipeline & Dead-Letter Monitor**.
- **`QuestionGradingStatus`** — per-question grading state inside a submission:
  `pending → graded → needs_review → reviewed / overridden`. **Confidence
  routing** compares each question's confidence against the tenant's
  `EvaluationSettings.confidenceConfig` thresholds (`0.7` / `0.9`) to sort
  `needs_review` (low) first, collapse auto-approved (high), and keep every
  override non-destructive (`originalScore` + `reason`). Drives: **Grading
  Review ★**, **Manual Override**, **Submission Detail**.

The answer key / rubric model answer is **staff-only** at every step
(`AnswerKeyLock`) and is never crossed over to students/parents — who can read a
sanitized `ResultSummary` only once `resultsReleased === true`.

---

## All screens

| Screen                                                             | Route                                             | One-liner                                                                                                                                                                                     | Key components                                                                                                                                                                                                                                     | Domain highlight                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Exams List](./exams-list.md)                                      | `/exams`                                          | Tenant-scoped, status-aware exam index to triage every exam by pipeline state, filter/search/sort, and launch the create wizard.                                                              | DataTable, Badge, ProgressBar, Button (spark), EmptyState, Skeleton, Chip/Tag, ConfirmDialog, Pagination, AppShell                                                                                                                                 | Status is server-authoritative (`saveExam`); `needs_review` exams bubble up under the default Attention sort; "Completed" vs "Results released" badges distinguish graded-but-hidden from learner-visible.                                                                    |
| [Exam Create — Setup (Wizard)](./exam-create-setup.md)             | `/exams/new`                                      | Step 1 of the 4-step wizard: a metadata form that creates the draft Exam via `saveExam` and frames the lock-gated stepper.                                                                    | Stepper _(proposed)_, Card, Input, Select, Combobox, DatePicker, Chip/Tag, Button, InlineAlert, FormFieldError, Toast, ConfirmDialog, EmptyState, AppShell                                                                                         | Creates the Exam as `draft` via `saveExam`; `POST_PUBLISH_LOCKED_FIELDS` disable on re-entry; tenant-scoped; drafts never visible to students.                                                                                                                                |
| [Question Paper Upload & Extraction](./question-paper-upload.md)   | `/exams/new` (Upload step) + `/exams/:examId`     | Upload scanned QP pages and run Gemini extraction (`extractQuestions` mode:full) to mine questions + rubrics, with per-page state and 540s extraction progress.                               | FileDrop, UploadQueueItem, ScanFrame, ExtractionProgress _(proposed)_, ConfidenceBadge, QuestionCard, ContentRenderer, ProgressRing, InlineAlert, Panel                                                                                            | `extractionConfidence` maps to platform `confidence.low/med/high` and drives which extracted question needs a human check; extracted rubrics/model-answers stay staff-only.                                                                                                   |
| [Exam Detail — Overview & Status Hub](./exam-detail-overview.md)   | `/exams/:examId`                                  | The persistent exam workspace shell: lifecycle header, KPI strip from `exam.stats`, and deep-linked Questions/Submissions/Settings tabs.                                                      | AppShell, Tabs, Timeline (LifecycleStepper), StatusBadge, Stat/KPI, ConfirmDialog, AnswerKeyLock                                                                                                                                                   | Status is server-authoritative (`VALID_STATUS_TRANSITIONS`); Release is gated until all `needs_review` submissions resolve; `POST_PUBLISH_LOCKED_FIELDS` lock after publish.                                                                                                  |
| [Exam Questions Editor](./exam-questions-editor.md)                | `/exams/:examId` (Questions tab)                  | Review surface for AI-extracted questions — correct text/marks/order, manage sub-questions and rubrics, re-extract, then publish via `saveExam`.                                              | QuestionCard, ContentRenderer, ConfidenceBadge, RubricBreakdown, AnswerKeyLock, Tabs, Accordion, card stack, InlineAlert, ConfirmDialog                                                                                                            | Extraction confidence (paper→question) is distinct from grading confidence; correcting low-confidence extractions is the trust gate before publish; `saveExam` locks questions/marks once published.                                                                          |
| [Rubric Editor (Question / Sub-question)](./subquestion-rubric.md) | `/exams/:examId` (rubric Drawer/Modal)            | Drawer editor for one question's (or sub-question's) `UnifiedRubric` — switch scoring mode, tune criteria, lock the model answer, reconcile points vs `maxMarks`.                             | Drawer/Sheet, Accordion, Stat/KPI (points reconciler), SegmentedControl, AnswerKeyLock, RubricBreakdown, ContentRenderer, ConfidenceBadge                                                                                                          | Model answer is staff-only (`AnswerKeyLock`); `saveExam` is the sole writer enforcing the status machine + post-publish locks; confidence thresholds inherit tenant → exam → question.                                                                                        |
| [Exam Settings (Grading Config)](./exam-settings.md)               | `/exams/:examId` (Settings tab)                   | Configuration/governance for one exam — `gradingConfig` toggles, evaluation profile, remediation link, post-publish-locked metadata, and the archive/delete cascade.                          | Section, Switch (ToggleEffectRow), Select, Combobox, ConfidenceBar, AnswerKeyLock, ConfirmDialog, InlineAlert                                                                                                                                      | `POST_PUBLISH_LOCKED_FIELDS` + server-authoritative `saveExam`: locked metadata shows a lock affordance, but enforcement is server-side — client disabling is only a UX mirror.                                                                                               |
| [Evaluation Settings](./evaluation-settings.md)                    | `/evaluation-settings`                            | Tenant-level control room for grading dimensions, confidence-routing thresholds, student-facing display, and AI usage budgets governing every AutoGrade exam.                                 | Tabs, Panel, Slider, Switch, ConfidenceBar, DefinitionList, ProgressBar, DataTable, FeedbackPanel, Badge                                                                                                                                           | `confidenceConfig` thresholds (`0.7` / `0.9`) here are the source of the `needs_review` / spot-check / auto-accept routing surfaced on Grading Review.                                                                                                                        |
| [Answer Sheet Upload](./answer-sheet-upload.md)                    | `/exams/:examId/submissions` (upload)             | Intake screen to attach a student's scanned answer-sheet pages and fire `uploadAnswerSheets`, creating a Submission that auto-starts the pipeline.                                            | Drawer/Sheet, FileDrop, UploadQueueItem, ScanFrame, Combobox, Select, ProgressBar, InlineAlert, ConfirmDialog, Accordion                                                                                                                           | `uploadAnswerSheets` creates the Submission; the create-trigger auto-starts Panopticon scouting → RELMS grading; status is server-authoritative; no answer key is shown.                                                                                                      |
| [Submissions Grading Queue](./submissions-grading-queue.md)        | `/exams/:examId/submissions`                      | Live, server-authoritative queue of every submission for one exam — pipeline status, grading progress, scores, bulk review/release actions.                                                   | DataTable, SubmissionCard, Badge, ProgressBar, GradePill, Stat/KPI, ConfirmDialog, ConfidenceBadge                                                                                                                                                 | Confidence routing drives review priority; optimistic retry/release UI is reconciled by the next `onSnapshot`; results stay hidden until owner-gated `resultsReleased`.                                                                                                       |
| **[Grading Review ★ (FLAGSHIP)](./grading-review.md)**             | `/exams/:examId/submissions/:submissionId`        | **The human-in-the-loop cockpit** to review, override, or retry AI grading per question — answer-sheet image pane beside a confidence-routed, keyboard-driven review pane.                    | AnswerSheetViewer _(proposed)_, QuestionCard, ConfidenceBadge + ConfidenceBar, RubricBreakdown + FeedbackPanel, ManualOverrideControl + OverrideTimeline, ResultSummary + GradePill, ReviewQueueToolbar _(proposed)_, ConfirmDialog, AnswerKeyLock | Confidence routing drives the whole workflow: per-question confidence vs `confidenceConfig` (`0.7` / `0.9`) sorts `needs_review` first, collapses auto-approved, keeps overrides non-destructive (`originalScore` + `reason`) — all server-authoritative and tenant-isolated. |
| [Manual Override Control & Timeline](./manual-override.md)         | `/exams/:examId/submissions/:submissionId`        | Audit-tracked control to override an AI question score with a bounded value + reason, showing original-vs-new and a full override timeline.                                                   | ManualOverrideControl, OverrideTimeline, ConfidenceBadge, GradePill, Slider, ConfirmDialog, ResultSummary, AnswerKeyLock                                                                                                                           | The only path to write `manualOverride{…}`: `gradeQuestion(mode:'manual')` stamps actor/time server-side, preserves `originalScore`, sets `gradingStatus → overridden`, and recomputes `Submission.summary`.                                                                  |
| [Submission Detail / Result Summary](./submission-detail.md)       | `/exams/:examId/submissions/:submissionId`        | Read-only result view of a graded submission — full teacher view (rubric, confidence, override audit, cost, release) vs sanitized `AnswerKeyLock`-gated student/parent view.                  | ResultSummary, GradePill, ConfidenceBadge, RubricBreakdown, Accordion, AnswerKeyLock, OverrideTimeline, Panel                                                                                                                                      | Released-results sanitization is server-authoritative: model answer, raw confidence, and AI cost are teacher-only; students/parents read only once `resultsReleased === true`.                                                                                                |
| [Results Release](./results-release.md)                            | `/exams/:examId` (release flow)                   | Gated flow to make graded submissions visible to students/parents — per-submission or bulk — with pre-release checklist, what-they-see preview, and confirmation that fans out notifications. | ConfirmDialog, DataTable, AnswerKeyLock, InlineAlert, Switch, Drawer/Sheet, SubmissionCard, Toast                                                                                                                                                  | Explicit, server-authoritative release is the only gate before students/parents read results; answer key, AI confidence, and cost never cross over; needs-review/ungraded submissions excluded with loud warnings.                                                            |
| [Exam Analytics & Results](./exam-analytics-results.md)            | `/exams/:examId` (Analytics) + `/analytics/exams` | Read-only, trigger-computed dashboard turning a graded exam into KPIs, score/grade distributions, per-question item analysis, and class/topic at-risk signals with export.                    | Stat/KPI, DataTable, DistributionChart _(proposed)_, GradeDistributionChart _(proposed)_, GradePill, AtRiskBadge, InsightCard, EmptyState                                                                                                          | Analytics are server/trigger-computed and tenant-isolated; class aggregates, `questionAnalytics`, and model answers are never exposed to students — who only see their own post-release `ResultSummary`.                                                                      |
| [Pipeline & Dead-Letter Monitor](./pipeline-deadletter-monitor.md) | `/exams/:examId` (pipeline) + admin `/ai-usage`   | Staff-facing ops console for grading-pipeline health and the `GradingDeadLetterEntry` queue, with retry/manual-grade/dismiss resolution.                                                      | DataTable, Stat/KPI, ProgressBar, PipelineStatusBadge _(proposed)_, ConfidenceBadge, InlineAlert, ConfirmDialog, Accordion, OverrideTimeline                                                                                                       | Status is server-authoritative — client only requests retries (`gradeQuestion(mode:retry)`) and writes DLQ resolution fields; the 15-min stale watchdog owns auto retry/escalation; vestigial `ocr_*` states are never surfaced.                                              |

★ = **flagship** screen.

---

## Screens by journey

### A. Setup & authoring

Authoring an exam and its grading contract before any answer sheet exists —
driven by `ExamStatus` and the `saveExam` status machine, with answer keys
staff-only from the first keystroke.

1. [Exams List](./exams-list.md) — `/exams`
2. [Exam Create — Setup (Wizard)](./exam-create-setup.md) — `/exams/new`
3. [Question Paper Upload & Extraction](./question-paper-upload.md) —
   `/exams/new` (Upload) + `/exams/:examId`
4. [Exam Detail — Overview & Status Hub](./exam-detail-overview.md) —
   `/exams/:examId`
5. [Exam Questions Editor](./exam-questions-editor.md) — `/exams/:examId`
   (Questions tab)
6. [Rubric Editor (Question / Sub-question)](./subquestion-rubric.md) —
   `/exams/:examId` (rubric Drawer/Modal)
7. [Exam Settings (Grading Config)](./exam-settings.md) — `/exams/:examId`
   (Settings tab)
8. [Evaluation Settings](./evaluation-settings.md) — `/evaluation-settings`
   (tenant-level)

### B. Ingestion & grading

Student answer sheets entering the pipeline and being graded, reviewed, and
overridden — driven by `SubmissionPipelineStatus` and `QuestionGradingStatus`
confidence routing.

1. [Answer Sheet Upload](./answer-sheet-upload.md) —
   `/exams/:examId/submissions` (upload)
2. [Submissions Grading Queue](./submissions-grading-queue.md) —
   `/exams/:examId/submissions`
3. **[Grading Review ★](./grading-review.md)** —
   `/exams/:examId/submissions/:submissionId` _(flagship)_
4. [Manual Override Control & Timeline](./manual-override.md) —
   `/exams/:examId/submissions/:submissionId`
5. [Submission Detail / Result Summary](./submission-detail.md) —
   `/exams/:examId/submissions/:submissionId`

### C. Outcomes & ops

Releasing results, reading analytics, and keeping the pipeline healthy — the
gated, read-only, and staff-operations tail of the flow.

1. [Results Release](./results-release.md) — `/exams/:examId` (release flow)
2. [Exam Analytics & Results](./exam-analytics-results.md) — `/exams/:examId`
   (Analytics) + `/analytics/exams`
3. [Pipeline & Dead-Letter Monitor](./pipeline-deadletter-monitor.md) —
   `/exams/:examId` (pipeline) + admin `/ai-usage`

---

## Conformance

Every spec in this area conforms to the Lyceum foundation
([`../00-FOUNDATION.md`](../00-FOUNDATION.md)):

- **Tokens, never hex.** Specs cite Lyceum color/typography/spacing/motion
  tokens by name (e.g. `bg.surface`, `marigold-500` spark, `ink-900`) and never
  re-paste raw hex values.
- **§5 inventory only.** Screens are composed exclusively from the §5 Core
  Component Inventory; anything new (e.g. `ExtractionProgress`,
  `AnswerSheetViewer`, `PipelineStatusBadge`, `DistributionChart`) is flagged
  _(proposed)_ for promotion into the foundation before use.
- **§7 11-point template.** Each per-screen spec follows the §7 structure:
  Purpose & primary user; Entry points & route (with common-API reads/writes);
  Layout (AppShell, responsive sm/md/lg); Components used; States; Interactions
  & motion; Content & copy; Domain rules surfaced; Accessibility; Web↔mobile
  divergence; and a ready-to-paste Claude-design prompt.
