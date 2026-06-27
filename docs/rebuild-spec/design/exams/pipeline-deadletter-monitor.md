# Pipeline & Dead-Letter Monitor

_A staff-facing operations console for grading-pipeline health and the
GradingDeadLetterEntry queue — precise, dense, mono numerics — surfaced per-exam
at `/exams/:examId` and tenant-wide under admin `/ai-usage`._

---

## 1. Purpose & primary user

**Primary user:** Teacher-admin / tenant operations staff (and platform admins
in the `/ai-usage` context). Role-gated to users who can act on the grading
pipeline — `gradeQuestion` callers and DLQ resolvers. Students and parents NEVER
see this surface.

**Job-to-be-done:** "When AutoGrade stalls or fails on some submissions, I need
to see _exactly_ which stage broke, why (in teacher-friendly language), and
resolve it fast — retry the stage, hand it to manual grading, or dismiss it —
without losing audit trail and without ever exposing answer-key/rubric internals
to the wrong audience."

This is the operational counterpart to GradingReview. GradingReview is about
pedagogical correctness of a graded answer; this monitor is about _pipeline
liveness_: which submissions are stuck in `scouting`/`grading`, which exceeded
the stale watchdog window, which landed in `gradingDeadLetter`, and how much
Gemini spend/quota the failures are burning.

---

## 2. Entry points & route

**Routes:**

- `/exams/:examId` — the **Pipeline** tab/panel inside ExamDetailPage (alongside
  Questions / Submissions / Settings). Scoped to one exam.
- `/ai-usage` (admin) — a tenant-wide **Dead-Letter & Pipeline** section
  aggregating DLQ across all exams, tied into cost/quota panels.

**Entry points:**

- ExamDetailPage status banner: when `Exam.status === grading` and any
  submission is
  `grading_partial | grading_failed | finalization_failed | manual_review_needed`
  (or stale), a "Pipeline needs attention" InlineAlert deep-links here.
- Submissions table row context: a submission with `pipelineStatus` in a failure
  state shows a "View in pipeline" action.
- Admin `/ai-usage`: a "Dead-letter queue ({n})" Stat/KPI links into the
  aggregated view.
- CommandPalette (⌘K): "Open pipeline monitor", "Show dead-letter queue".

**Common-API reads (live):**

- `submissions.listLive(examId)` → per-submission `pipelineStatus`,
  `pipelineError`, `retryCount`, `gradingProgress.*`,
  `scoutingResult.completedAt`. Drives the health overview + stale detection.
- `questionSubmissions.listLive(submissionId)` → per-question `gradingStatus`,
  `gradingError`, `gradingRetryCount` for drill-down.
- `gradingDeadLetter` repo live read (tenant-scoped, filtered by `examId` on the
  exam route; unfiltered/aggregated on `/ai-usage`) → the DLQ table rows:
  `submissionId`, `questionSubmissionId?`, `pipelineStep`, `error`,
  `errorStack?`, `attempts`, `lastAttemptAt`, `resolvedAt?/By?`,
  `resolutionMethod?`.
- `examAnalytics` (read, optional) → `gradedSubmissions` vs `totalSubmissions`
  for completion ratio.
- `EvaluationSettings.confidenceConfig` + `usageQuota` (UsageQuotaConfig) →
  quota/budget tie-in on the `/ai-usage` context.

**Common-API writes (callables):**

- `gradeQuestion({ mode: 'retry', submissionId, questionSubmissionId })` —
  re-run RELMS grading for a single failed question (also `mode: 'ai'` to
  re-grade, and server-side bulk-approve for high-confidence batches).
- `gradeQuestion` re-run of a stage / `saveExam` is NOT used here for status
  mutation — **status is server-authoritative**; the watchdog and callables own
  transitions. The client only requests retries; it never writes
  `pipelineStatus`/`gradingStatus` directly.
- DLQ resolution write (repo/callable) → sets `resolvedAt`, `resolvedBy`,
  `resolutionMethod` (`retry_success | manual_grade | dismissed`).
  `manual_grade` navigates to GradingReview; the actual override happens there
  via `gradeQuestion({ mode: 'manual' })`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). On `/exams/:examId` it lives
under the exam header + status actions + tab bar; on `/ai-usage` it lives under
the admin usage header.

### lg (≥1024) — two-region: health overview (top) + DLQ table (main)

```
┌ AppShell ────────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · search · ⌘K · notifications · profile)    │
│         ├──────────────────────────────────────────────────────────────────── │
│         │ Breadcrumb: Exams / {Exam.title} / Pipeline                          │
│         │ Section: Pipeline & Dead-Letter Monitor      [Refresh ⟳] [Retry all▾]│
│         │                                                                       │
│         │ ┌ Panel: Pipeline health ───────────────────────────────────────────┐│
│         │ │ Stat   Stat   Stat   Stat   Stat   Stat   Stat                    ││
│         │ │ uploaded scouting grading complete partial failed needs-review     ││
│         │ │   12      3       5      40      2      4        6                  ││
│         │ │ ── ProgressBar: 40/52 graded (77%) ──────────────────────────────  ││
│         │ │ InlineAlert(warning): 2 submissions stale >10min in scouting →[view]││
│         │ └───────────────────────────────────────────────────────────────────┘│
│         │                                                                       │
│         │ ┌ Tabs: [ Dead-letter (16) ] [ Stuck/Stale (5) ] [ In-flight (8) ] ──┐│
│         │ │ Toolbar: filter[step ▾][status ▾][unresolved ✓]  search  · 16 rows ││
│         │ │ ┌ DataTable ──────────────────────────────────────────────────────┐││
│         │ │ │☐│Submission│Step    │Error (friendly)      │Att│Last attempt │⋯ │││
│         │ │ │☐│SUB·a1f2 │grading │Gemini quota exceeded │ 3 │2m ago 14:22 │▸ │││
│         │ │ │☐│SUB·9c0e │scouting│Page mapping low conf │ 1 │5m ago 14:19 │▸ │││
│         │ │ │ └ (expanded row) errorStack ▾ · [Retry][Manual grade][Dismiss] │││
│         │ │ └─────────────────────────────────────────────────────────────────┘││
│         │ │ Pagination · 1 2 3 …                                                ││
│         │ └────────────────────────────────────────────────────────────────────┘│
└─────────┴────────────────────────────────────────────────────────────────────────┘
```

- **Bulk action bar** appears (slides down, motion `fast`) when ≥1 row selected:
  "{n} selected · [Retry selected] [Dismiss selected]".
- **Drill-down** uses an expanded inline row (Accordion-in-row) for
  `errorStack` + per-entry actions; a Drawer/Sheet opens for full submission
  context (its `questionSubmissions` list with `gradingStatus`).

### md (768–1023)

- Health Stats wrap to 2 rows of KPIs; ProgressBar full-width.
- DataTable keeps core columns (Submission, Step, Error, Last attempt, actions
  overflow into a Popover `⋯` menu).

### sm (<768)

- Health overview collapses into a horizontally-scrollable Stat strip + the
  stale InlineAlert.
- DataTable → stacked **SubmissionCard**-style rows: each DLQ entry becomes a
  Card with `submissionId` (mono), a step Badge, friendly error text,
  `attempts`/`lastAttemptAt` as a DefinitionList, and a primary [Retry] button +
  `⋯` Popover (Manual grade / Dismiss / View stack).

---

## 4. Components used (Lyceum inventory)

**Navigation/containers:** AppShell, Sidebar, Topbar, Breadcrumb, Section,
Panel, Card, Tabs, Accordion (in-row stack-trace expand), Drawer/Sheet
(submission context), Popover (overflow actions), Tooltip.

**Data:** DataTable (sort/filter/paginate/select — the DLQ list), Stat/KPI
(status counts), ProgressBar (graded ratio + per-batch `gradingProgress`),
DefinitionList (entry metadata on mobile), Badge, Chip/Tag, Pagination,
EmptyState, Skeleton, Timeline (resolution history of a resolved entry).

**Feedback:** Toast (sonner), InlineAlert/Banner (stale watchdog, quota
warnings), ConfirmDialog (Dismiss), LoadingOverlay (bulk retry), FormFieldError
(dismiss-reason validation if required).

**Primitives:** Button (primary = Retry; secondary = Manual grade; ghost/danger
= Dismiss; spark NOT used here — ops surface, no celebration), IconButton,
Select (step/status filters), Checkbox (row select), Textarea (optional dismiss
note), Input (search).

**Domain components:**

- `SubmissionCard` (mobile stacked rows; also the Drawer header).
- `ConfidenceBadge` — surfaced where a DLQ/`needs_review` cause is low
  confidence routing (`confidence.low`).
- `OverrideTimeline` (feedback pkg) / Timeline — shows resolution lineage for
  resolved entries (`attempts` → `resolvedAt/By` → `resolutionMethod`).
- `AnswerKeyLock` — visual guard reminder when an entry deep-links toward
  content that includes rubric/model-answer, reinforcing that those are
  review-only.

**Proposed additions (justified):**

- **`PipelineStatusBadge`** — a thin specialization of Badge mapping each
  `SubmissionPipelineStatus` / `QuestionGradingStatus` to icon + label +
  semantic color (e.g. `grading_complete` → status.success check;
  `grading_partial` → status.warning;
  `grading_failed`/`scouting_failed`/`finalization_failed`/`manual_review_needed`
  → status.error; `scouting`/`grading` in-flight → status.info spinner).
  Justified because these enums are platform-specific and must render
  identically across Submissions table, GradingReview, and this monitor. **Never
  color-only** — always icon + text label. `ocr_*` states are vestigial and
  explicitly NOT rendered.
- **`StaleWatchdogChip`** — a Chip variant that shows elapsed-in-stage in mono
  (e.g. `14m32s`) and flips to status.warning past the 10-min stale threshold,
  status.error past escalation. Composed from Chip + a mono ticking counter.

---

## 5. States

**Loading:** Skeleton for the Stat row (7 placeholder KPIs), a shimmer
ProgressBar, and 6–8 Skeleton table rows. Health Panel and DataTable load
independently from their respective live reads so a slow `gradingDeadLetter`
read doesn't block the health overview.

**Empty:**

- _No DLQ entries, pipeline healthy:_ EmptyState in the Dead-letter tab —
  illustration + Fraunces title "Queue is clear", body "No failed grading
  entries for this exam. Submissions are flowing through scouting and grading
  normally." Health Panel still shows live counts.
- _No submissions at all:_ "Nothing to monitor yet — upload answer sheets to
  start grading," with a link to the Submissions tab / `uploadAnswerSheets`
  flow.

**Error:** If a live read fails, an InlineAlert(error) at the top of the
affected region: "Couldn't load the dead-letter queue. [Retry]" — the rest of
the page (health vs DLQ) stays usable. A persistent read failure shows the
last-known data with a "Stale — last updated {time}" caption (text.muted, mono
timestamp).

**Partial:** This is the _normal busy state_ and gets first-class treatment:

- `grading_partial` submissions counted in a dedicated Stat and filterable.
  Their row shows `gradingProgress` ("4 / 7 questions graded") as a ProgressBar.
- A submission can be both in-flight AND have DLQ children (one question failed
  while others grade) — the row links to both the in-flight progress and its DLQ
  entries.

**Success / resolved:** Resolving an entry animates it out and (if "show
resolved" is on) moves it to a muted, struck-through state showing
`resolutionMethod` Chip + `resolvedBy`/`resolvedAt`. A Toast confirms ("Retry
queued" / "Sent to manual grading" / "Entry dismissed").

**Permission / role-gated variations:**

- Read-only viewer (no grade permission): action buttons (Retry/Manual
  grade/Dismiss) hidden or disabled with Tooltip "Requires grading permission";
  the monitor is still observable.
- Platform admin on `/ai-usage`: gains the cross-tenant aggregate counts only
  within their tenant scope — **tenant isolation enforced server-side**; the UI
  never offers a cross-tenant toggle.
- `requireOverrideReason` (from `gradingConfig`): when an entry routes to manual
  grade, the downstream GradingReview enforces the reason; the Dismiss action
  here can independently require a note if tenant policy demands (Textarea +
  FormFieldError).

---

## 6. Interactions & motion

**Live updates:** Counts and rows stream from live reads. New DLQ entries
fade+slide in (motion `base`, `ease.entrance`); a subtle status.error dot pulses
on the Dead-letter tab label when a new unresolved entry arrives (respect
reduced-motion → static count bump). Resolved entries collapse out (`fast`,
`ease.exit`).

**Retry (single):** Click Retry → button enters loading state (spinner,
`instant`), optimistic: row's step Badge flips to an in-flight "Retrying…"
PipelineStatusBadge. Calls
`gradeQuestion({ mode:'retry', submissionId, questionSubmissionId })`. On
success the live read reflects `graded`/`grading_complete`, entry auto-resolves
with `resolutionMethod: retry_success`, Toast "Question re-graded — entry
resolved." On failure, optimistic state reverts, row shows new `attempts`
count + InlineAlert in the expanded row.

**Retry all / selected (bulk):** "Retry all" in a Popover with a ConfirmDialog
("Re-run grading for {n} failed entries? This consumes Gemini quota."). Shows
estimated impact if quota data available. Executes batched `gradeQuestion`
retries; a LoadingOverlay with ProgressBar tracks completion; per-entry results
stream back. Quota guard: if `usageQuota.dailyCallLimit` would be exceeded, the
dialog blocks with status.warning and disables confirm.

**Manual grade:** Navigates to `/exams/:examId/submissions/:submissionId`
(GradingReview) at the offending `questionId`. The DLQ entry is tentatively
marked pending-resolution; it finalizes to `resolutionMethod: manual_grade` once
the override is saved there.

**Dismiss:** Danger-ghost Button → ConfirmDialog ("Dismiss this entry? It won't
be retried. The submission stays {status}."). Optional/required note Textarea.
On confirm, sets `resolutionMethod: dismissed` + `resolvedAt/By`; row animates
to resolved/muted; Toast with **Undo** affordance (sonner, ~6s window) that
clears the resolution fields if clicked.

**Expand stack trace:** Accordion-in-row toggle reveals `errorStack` in a mono,
scrollable, syntax-muted block with a "Copy" IconButton (Toast "Stack trace
copied"). Default collapsed — teacher-friendly `error` (via
`formatGradingError`) is always visible; raw stack is opt-in.

**Stale watchdog:** The `StaleWatchdogChip` ticks client-side in mono; crossing
10min flips warning, and the health InlineAlert appears. Actual retry/escalation
is owned server-side by the 15-min watchdog — the UI surfaces it, the client
doesn't drive it.

All confirmations use ConfirmDialog (Modal, `e3`, focus-trapped). Motion tokens:
button feedback `instant`/`fast`; row enter/exit `base`; modal `base` with
`ease.entrance`. No celebratory spark anywhere — this is an instrument, not a
reward.

---

## 7. Content & copy

Tone: terse, precise, operational. Mono for all numerics, IDs, timestamps,
durations.

- **Section title:** "Pipeline & Dead-Letter Monitor" (Fraunces).
- **Health Stat labels:** "Uploaded", "Scouting", "Grading", "Complete",
  "Partial", "Failed", "Needs review". Each pairs PipelineStatusBadge icon +
  count.
- **ProgressBar caption:** "{gradedSubmissions} / {totalSubmissions} submissions
  graded ({pct}%)".
- **Stale alert:** "{n} submission(s) stuck >10 min in {stage}. The watchdog
  will retry automatically; you can also retry now." [View] [Retry now].
- **Quota warning (ai-usage):** "Gemini usage at {pct}% of {period} budget.
  Retries may be throttled." (status.warning past `warningThresholdPercent`,
  default 80).
- **DataTable columns:** "Submission" (mono `SUB·{shortId}`, with
  `studentName`/`rollNumber` in a Tooltip), "Step" (`scouting` | `grading` Chip
  — never `ocr`), "Error", "Attempts" (mono), "Last attempt" (relative + mono
  absolute), actions.
- **Error copy:** always the `formatGradingError` friendly string, e.g. "Gemini
  quota exceeded — will retry when quota resets", "Page mapping confidence too
  low — needs human review", "Grading service timed out". Raw stack only inside
  the expand.
- **Action labels:** "Retry", "Manual grade", "Dismiss". Resolved Chips:
  "Resolved by retry", "Sent to manual grading", "Dismissed".
- **Empty states:** "Queue is clear" / "Nothing to monitor yet".
- **Confirm copy:** Dismiss — "Dismiss this entry? It won't be retried and the
  submission keeps its current status." Retry-all — "Re-run grading for {n}
  entries? This consumes Gemini quota."
- **Error toast:** "Retry failed — attempt {n}. See the expanded error for
  details."

---

## 8. Domain rules surfaced

- **Answer-key / rubric model-answer never shown to students** — this is
  staff-only; nonetheless `AnswerKeyLock` reinforces that drilling into a
  question's grading content (rubric, `modelAnswer`) is review-context only and
  never leaks to student/parent surfaces.
- **Confidence routing drives review priority** — entries that reached
  `needs_review` due to `confidence < confidenceThreshold (0.7)` show
  `ConfidenceBadge` (`confidence.low`); service errors
  (quota/circuit/rate-limit) that _degraded_ to `needs_review` are flagged as
  "service" causes vs "low-confidence" causes so staff triage correctly.
- **Server-authoritative status** — the client never writes
  `pipelineStatus`/`gradingStatus`. It requests retries via `gradeQuestion` and
  writes only DLQ resolution fields. The stale watchdog (every 15 min) owns
  automatic retry/escalation; the UI reflects, never overrides, server state.
- **Vestigial states hidden** — `ocr_*` SubmissionPipelineStatus values and
  `ocr` pipelineStep are NEVER surfaced; only `scouting` and `grading` steps
  appear.
- **Tenant isolation on every read** — `gradingDeadLetter`, submissions, and
  analytics reads are tenant-scoped; `/ai-usage` aggregation stays within the
  tenant; no cross-tenant view exists.
- **Audit preservation** — resolving an entry never deletes it; it stamps
  `resolvedAt/By` + `resolutionMethod`. Manual-grade resolutions preserve
  `manualOverride.originalScore` downstream (visible via OverrideTimeline).
  `attempts` history is retained.
- **requireOverrideReason / post-publish locks** — overrides reached via "Manual
  grade" obey `gradingConfig.requireOverrideReason`; POST_PUBLISH_LOCKED_FIELDS
  on the exam are unaffected here since this surface mutates pipeline/DLQ ops,
  not exam metadata.
- **Per-tenant thresholds** — confidence + quota thresholds come from
  `EvaluationSettings.confidenceConfig` / `usageQuota`, not hardcoded.

---

## 9. Accessibility

- **Focus order:** Refresh/Retry-all toolbar → tab list → DataTable toolbar
  (filters, search) → table header (sortable, `aria-sort`) → rows (each row
  focusable; Enter expands stack trace, primary action reachable via Tab) →
  Pagination. Bulk action bar inserts itself logically after selection and
  announces "{n} selected" via `aria-live=polite`.
- **Keyboard:** Full table operable without mouse; row expand toggled by
  Enter/Space on the disclosure control; ConfirmDialog focus-trapped with
  Esc-to-cancel; ⌘K opens CommandPalette.
- **ARIA:** Status counts in an `aria-live=polite` region so new failures are
  announced without stealing focus. PipelineStatusBadge exposes status via text
  label + `aria-label` (e.g. "Grading failed"), never color alone. DLQ table
  uses `role=grid` semantics with column headers; the stack-trace block is
  `aria-expanded`-linked to its toggle.
- **Contrast:** All status/confidence/grade colors meet WCAG AA (3:1 UI, 4.5:1
  text); mono numerics on `bg.surface` use `text.primary`. Disabled actions use
  `text.muted` with explanatory Tooltip (not color-only).
- **Reduced motion:** `prefers-reduced-motion` disables row slide/fade and the
  tab-dot pulse — entries appear/disappear instantly, counts update without
  animation. The stale-counter still ticks (informational), but without pulsing.

---

## 10. Web↔mobile divergence

| Aspect              | teacher-web (today)                                 | Future RN / scanner-web                                                                                                           |
| ------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| DLQ list            | DataTable (sort/filter/paginate/select)             | Stacked `SubmissionCard` rows with DefinitionList metadata                                                                        |
| Row actions         | Inline buttons + `⋯` Popover                        | Primary [Retry] button + bottom-sheet action menu (Drawer)                                                                        |
| Stack trace         | Inline Accordion expand, hover-copy                 | Tap-to-expand sheet; long-press to copy                                                                                           |
| Bulk select         | Checkbox column + sticky bulk bar                   | Disabled or simplified (single-entry focus); no multi-select on small screens                                                     |
| Hover affordances   | Tooltips on hover (student name on Submission cell) | Tap/press; persistent secondary line instead of hover Tooltip                                                                     |
| Command palette     | ⌘K to jump to monitor/queue                         | No ⌘K; reached via nav/Tabbar                                                                                                     |
| Health overview     | 7-up KPI grid + full ProgressBar                    | Horizontally-scrollable Stat strip + alert                                                                                        |
| Scanner-web context | n/a                                                 | Read-mostly: scanner operators see upload/scouting health for `uploadSource: scanner`; resolution actions gated to teacher-admins |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only the
renderer differs.

---

## 11. Claude-design prompt

```
Design the "Pipeline & Dead-Letter Monitor" screen for the Auto-LevelUp teacher-web app.
Conform EXACTLY to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md):
Modern Scholarly — warm paper neutrals (bg.canvas/bg.surface), deep indigo brand.primary,
marigold spark RESERVED (do NOT use spark here — this is an ops instrument, no celebration).
Fonts: Fraunces (section/empty-state titles), Schibsted Grotesk (UI/body/tables/buttons),
Spline Sans Mono (ALL numerics: counts, attempts, durations, timestamps, submission IDs).
Cite tokens by name (brand.primary, status.warning/error/info/success, confidence.low/med/high,
border.subtle, text.muted, radius lg cards / md buttons, elevation e1/e2/e3, motion
instant/fast/base + ease.standard/entrance/exit). All status uses icon + label, never color alone.

Context: staff-facing operational monitor for the AutoGrade grading pipeline.
Render inside AppShell (Sidebar + Topbar + Breadcrumb). Two regions:
1) Pipeline health Panel — a row of Stat/KPI tiles counting SubmissionPipelineStatus
   (Uploaded, Scouting, Grading, Complete, Partial, Failed, Needs review — DO NOT show any
   ocr_* states, they are vestigial), a ProgressBar "{gradedSubmissions}/{totalSubmissions}
   graded", and an InlineAlert(warning) for stale submissions (>10min in scouting/grading,
   shown via a ticking mono StaleWatchdogChip).
2) Dead-letter queue — Tabs [Dead-letter | Stuck/Stale | In-flight], a filter/search toolbar,
   and a DataTable of GradingDeadLetterEntry rows: Submission (mono SUB·{shortId}), Step
   (scouting|grading Chip), Error (teacher-friendly via formatGradingError), Attempts (mono),
   Last attempt (relative + mono absolute), and per-row actions [Retry][Manual grade][Dismiss].
   Rows expand (Accordion-in-row) to reveal a collapsible mono errorStack with copy. Support
   row multi-select with a sticky bulk action bar (Retry selected / Dismiss selected).

Use a proposed PipelineStatusBadge (Badge specialization: icon+label+semantic color per status)
and ConfidenceBadge (confidence.low) where a failure cause is low-confidence routing.
Include states: Skeleton loading (7 KPI + ProgressBar + 8 rows), EmptyState "Queue is clear"
(Fraunces title), error InlineAlert with retry, partial (grading_partial rows show a per-batch
gradingProgress ProgressBar). ConfirmDialog for Dismiss and Retry-all (warn about Gemini quota).
Toasts (sonner) for outcomes with Undo on dismiss.

Domain rules to honor visually: server-authoritative status (client only requests retries via
gradeQuestion mode:retry, never writes status); answer-key/rubric never exposed (AnswerKeyLock
reminder); tenant isolation; resolved entries keep audit (resolutionMethod + resolvedAt/By,
OverrideTimeline). Dense, precise, AA contrast, full keyboard nav, aria-live count region,
respect prefers-reduced-motion. Provide a responsive layout: lg two-region grid, md wrapped
KPIs + condensed table, sm horizontally-scrollable Stat strip + stacked SubmissionCard rows.
```
