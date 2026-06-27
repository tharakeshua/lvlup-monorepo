# Submissions Grading Queue

_A live, server-authoritative queue of every student submission for one exam —
pipeline status, grading progress, scores, and the bulk-review actions a teacher
needs to move from "papers uploaded" to "results released."_

---

## 1. Purpose & primary user

**Primary user:** Teacher (exam owner / `createdBy`) and Teaching Assistant with
grading rights, scoped to the active tenant.

**Job-to-be-done:** "I've uploaded answer sheets for this exam. Now I need to
watch the AI pipeline grade them, see at a glance which submissions are done /
need my review / failed, jump into the ones the confidence router flagged, and
once I've reviewed them, release results in bulk." This screen is the
operational cockpit between intake (answer-sheet upload) and outcome
(grading-review → results release). It surfaces the **Panopticon scouting →
RELMS grading → confidence routing** pipeline as a calm, scannable list, and
turns the human-in-the-loop moments (`needs_review`, `manual_review_needed`,
`grading_failed`) into clear next actions.

Secondary viewers: Admin (read + DLQ link), and the watchdog/escalation surface
for stale submissions.

---

## 2. Entry points & route

**Route:** `/exams/:examId/submissions` (within `AppShell`, under the Exams nav
section).

**Entry points:**

- Exam Detail (`/exams/:examId`) → **Submissions** tab.
- Direct deep-link from notifications ("3 submissions need review").
- Post-upload redirect from **answer-sheet-upload** (`uploadAnswerSheets`
  success → land here).
- Breadcrumb: `Exams / {exam.title} / Submissions`.

**Reads (live, onSnapshot):**

- `submissions.listLive(examId)` → array of `Submission` (drives every row;
  re-renders on `pipelineStatus`, `gradingProgress.*`, `summary`,
  `resultsReleased` changes).
- `exams.get(examId)` → `Exam` for header context (`title`, `status`,
  `totalMarks`, `passingMarks`, `stats`).
- `examAnalytics(examId)` (optional, lightweight) → reconciliation of the counts
  strip if present; otherwise counts are derived client-side from the live
  submissions array.

**Writes (Firebase callables):**

- `gradeQuestion` (server-side **bulk-approve** mode) → powers **Release
  reviewed** bulk action by finalizing/releasing eligible submissions.
- `gradeQuestion` (`mode: retry`) → powers **Retry failed** for `grading_failed`
  / `manual_review_needed` rows (re-enqueues RELMS).
- `uploadAnswerSheets` is **not** called here directly — the **Upload more**
  entry navigates to answer-sheet-upload.

**Cross-references:** `gradingDeadLetter` entries are linked (not edited) from
failed rows via the **DLQ** link; full DLQ management lives in admin
`/ai-usage`.

All reads/writes are tenant-scoped; `examId` is validated against the active
tenant server-side.

---

## 3. Layout — wireframe-as-text

Rendered inside `AppShell` (Sidebar + Topbar). Content max-width 1200, page
gutters per breakpoint (mobile 16 / tablet 24 / desktop 32).

### lg (≥1024) — DataTable cockpit

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · search · ⌘K · notifications · profile)     │
│         ├──────────────────────────────────────────────────────────────────────┤
│         │ Breadcrumb: Exams / Physics Mid-Term / Submissions                    │
│         │                                                                        │
│         │ ┌ Header row ────────────────────────────────────────────────────┐    │
│         │ │ h2 "Submissions"   status:[Grading ⟳]    [Upload more ▸] (btn)  │    │
│         │ └────────────────────────────────────────────────────────────────┘    │
│         │                                                                        │
│         │ ┌ Counts strip (Stat/KPI ×5, mono numerics) ────────────────────┐     │
│         │ │ Total 42 │ ✔ Graded 28 │ ⚑ Needs review 9 │ ✕ Failed 2 │ 📤 Rel 14│   │
│         │ └────────────────────────────────────────────────────────────────┘    │
│         │                                                                        │
│         │ ┌ Toolbar ───────────────────────────────────────────────────────┐    │
│         │ │ [Filter: pipelineStatus ▾]  [Search roll/name]   ⟲ live • 14:32 │    │
│         │ │ ──when rows selected──> [Release reviewed (5)] [Retry failed(2)]│    │
│         │ └────────────────────────────────────────────────────────────────┘    │
│         │                                                                        │
│         │ ┌ DataTable ─────────────────────────────────────────────────────┐    │
│         │ │ ☐ │ Student / Roll │ Class │ Status        │ Progress │ Score   │    │
│         │ │ ☐ │ A. Rao  · R-01 │ X-A   │ ✔ Grading complete │▓▓▓▓▓│ 41/50 B │    │
│         │ │ ☑ │ B. Sen  · R-02 │ X-A   │ ⚑ Ready for review │▓▓▓▓▓│ 38/50 C │    │
│         │ │ ☐ │ C. Iyer · R-03 │ X-B   │ ⟳ Grading      │▓▓▓░░ 6/9│  —      │    │
│         │ │ ☐ │ D. Bose · R-04 │ X-B   │ ⚑ Needs review │▓▓▓▓▓│ 22/50 F │ DLQ │    │
│         │ │ ☐ │ E. Das  · R-05 │ X-A   │ ✕ Grading failed │— │  —    [Retry]│    │
│         │ └────────────────────────────────────────────────────────────────┘    │
│         │ Pagination ◂ 1 2 3 ▸                                                    │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

Row click (anywhere outside checkbox/inline-action) →
`/exams/:examId/submissions/:submissionId` (grading-review).

### md (768–1023) — condensed table

Drop **Class** into a secondary line under the student name; collapse the counts
strip to a 3-up wrap (Total · Needs review · Failed) with the rest behind a
"more" Popover. Toolbar filter + bulk actions stay; search collapses to an
IconButton that expands an Input.

### sm (<768) — stacked `SubmissionCard` list

Table → vertical list of `SubmissionCard`. Counts strip becomes a horizontally
scrollable Chip row of `Stat` mini-pills. Filter + bulk actions move into a
sticky bottom `Drawer` ("Filter & actions") to keep cards full-width. Selection
via long-press / a checkbox in the card's top-left.

```
┌ SubmissionCard ───────────────────┐
│ B. Sen · R-02 · X-A          [☐]  │
│ ⚑ Ready for review                │
│ ▓▓▓▓▓ 9/9 graded                   │
│ 38/50 · 76% · [GradePill C]       │
│ Released ✓ 12 Jun           [Open]│
└────────────────────────────────────┘
```

---

## 4. Components used (Lyceum inventory)

- **AppShell** (Sidebar + Topbar), **Breadcrumb** — chrome.
- **DataTable** (sort by roll/status/score, filter by status, paginate, **row
  select**) — lg/md primary surface.
- **SubmissionCard** (domain) — sm surface and the per-row visual model; shows
  student/roll/class, status, progress, score.
- **Stat/KPI** ×5 — counts strip (Total, Graded, Needs review, Failed,
  Released).
- **Badge** — `pipelineStatus` chip; **icon + label**, underscores → spaces,
  pill radius.
- **ProgressBar** — live `gradingProgress.*` (graded batches / total).
- **GradePill** (domain) — letter grade from `summary.grade`, colored on
  `grade.*` scale.
- **Select** — pipelineStatus filter.
- **Input** (search) — roll/name lookup.
- **Button** (primary `Upload more`, secondary `Release reviewed`, ghost
  `Retry failed`, danger only inside confirm), **IconButton** (collapsed
  search/refresh).
- **ConfirmDialog** — bulk release / bulk retry confirmation.
- **Toast** (sonner) — action results, watchdog escalations.
- **InlineAlert/Banner** — pipeline-wide problems (e.g. "Gemini quota exhausted
  — grading paused").
- **Skeleton** — loading rows.
- **EmptyState** — no submissions yet.
- **Pagination**, **Tooltip**, **Popover** (status legend, overflow counts),
  **Drawer/Sheet** (mobile filter/actions), **Chip/Tag** (active filter, mobile
  stat pills), **Avatar** (optional student initial).
- **ConfidenceBadge** (domain) — optional inline hint on `needs_review` rows
  summarizing the lowest per-question confidence band.
- **LoadingOverlay** — brief, scoped to a row during optimistic retry/release.

**Proposed addition (justified):** `LiveSyncIndicator` — a tiny "live • {hh:mm}"
affordance (mono) confirming the `onSnapshot` stream is connected. Not in §5;
justified because every read here is real-time and staff need confidence the
queue is fresh (vs. stale). Composed from a `Badge` + pulsing dot; degrades to
"reconnecting…" on stream error. If rejected, fold into the toolbar as plain
`text.muted` caption.

---

## 5. States

**Loading:** Header + counts strip render as `Skeleton` Stats; DataTable shows
6–8 `Skeleton` rows (shimmer at `fast`). No layout shift when live data arrives.

**Empty (no submissions):** `EmptyState` with Fraunces title "No submissions
yet", body "Upload scanned answer sheets to start grading.", primary
`Upload more` Button → answer-sheet-upload. Counts strip hidden.

**Empty (filtered to zero):** Inline `EmptyState` inside the table area: "No
submissions are {status}." + ghost "Clear filter".

**Partial:** The default real state — rows in mixed pipeline stages. In-flight
rows (`scouting`, `grading`) show animated `ProgressBar` + spinner-status
`Badge`; completed rows show `summary` + `GradePill`. `grading_partial` rows
show ProgressBar at its stalled fraction with an amber `Badge` "Partially
graded" and a Tooltip ("Some questions failed; review or retry"). Counts strip
updates live as snapshots arrive.

**Success (terminal-ready):** All rows
`ready_for_review`/`reviewed`/`grading_complete`; **Release reviewed** enabled.
After release, rows flip to a `resultsReleased` ✓ state and exam header status
can advance to `results_released`.

**Error:**

- _Stream error:_ `InlineAlert` (warning) "Live updates interrupted — showing
  last known state" + `LiveSyncIndicator` → "reconnecting…"; data stays visible,
  never blanks.
- _Pipeline-wide block_ (quota/circuit/rate-limit, detected via degraded
  statuses): `Banner` (error) "Grading paused — AI service unavailable. Affected
  submissions moved to Needs review." with DLQ link.
- _Action failure:_ optimistic change reverts, `Toast` (error) with reason.

**Role-gated variations:**

- **Teacher/TA (grader):** full bulk actions, retry, release.
- **Admin:** read + DLQ link + retry; **Release reviewed** hidden unless also
  owner (release is an exam-owner action). Surfaced via disabled Button +
  Tooltip "Only the exam owner can release results."
- **No grading rights:** read-only table, selection checkboxes hidden, action
  toolbar absent.

---

## 6. Interactions & motion

**Live snapshot updates:** Row status/progress changes animate in place —
`Badge` cross-fades (`fast`/`ease.standard`), `ProgressBar` width tweens
(`base`). A row transitioning to a terminal score gets a subtle `e1→e2` lift
then settle (`base`), no celebratory spring (this is staff tooling — the one
spring is reserved for student gamification).

**Filter:** `Select` change re-filters client-side instantly (`instant`); active
filter shows as a removable `Chip`. Sort headers toggle asc/desc (`instant`).

**Row → grading-review:** Whole row is a click target (cursor pointer, hover
tint at `border.subtle`); navigates with `page` transition. Keyboard `Enter` on
focused row does the same.

**Bulk select → release (optimistic + confirmed):**

1. Select rows (header checkbox = select-all-eligible; only
   `reviewed`/`ready_for_review` are eligible — ineligible checkboxes disabled
   with Tooltip).
2. **Release reviewed (n)** → `ConfirmDialog`: "Release results for {n}
   submissions? Students and parents will be able to see scores and feedback."
   (Confirm = spark? No — primary Button; release is significant but not
   gamified.)
3. On confirm: optimistic `resultsReleased` ✓ on rows + row-scoped
   `LoadingOverlay`; call `gradeQuestion` bulk-approve/release. Success →
   `Toast` "Released {n} submissions." Failure → revert + `Toast` error per the
   data contract.

**Bulk / single retry:** **Retry failed (n)** or inline row `[Retry]` →
`gradeQuestion` (`mode: retry`). Optimistic status → `grading` with reset
ProgressBar; `Toast` "Retrying {n}…". Server re-enqueues RELMS; live snapshot
resolves the true outcome.

**Watchdog / stale surfacing:** When the 15-min stale-submission watchdog
escalates a row, it arrives via snapshot as `manual_review_needed` (or a retried
status). A non-blocking `Toast` ("1 submission was auto-retried by the
watchdog") and a subtle row highlight (`marigold-50` wash, fading over `slow`)
draw the eye without stealing focus.

**Confirmations:** Destructive/irreversible-feeling actions (release) always
`ConfirmDialog`. Retry is reversible-in-effect, no confirm for single; bulk
retry of >10 gets a lightweight confirm.

All motion respects `prefers-reduced-motion` (cross-fades become instant swaps;
ProgressBar jumps).

---

## 7. Content & copy

Tone: precise, operational, staff-facing. No exclamation marks, no gamified
language.

**Headings:** `h2` "Submissions". Status chip in header mirrors `Exam.status`
(e.g. "Grading", "Results released").

**Counts strip labels:** "Total", "Graded", "Needs review", "Failed", "Released"
— each with a leading icon and mono count.

**Status `Badge` labels** (full `SubmissionPipelineStatus` set, underscores →
spaces, sentence case; `ocr_*` states never surfaced):

- uploaded → "Uploaded"
- scouting → "Scouting" (⟳)
- scouting_failed → "Scouting failed" (✕)
- scouting_complete → "Scouted"
- grading → "Grading" (⟳)
- grading_partial → "Partially graded" (⚑)
- grading_failed → "Grading failed" (✕)
- grading_complete → "Grading complete" (✔)
- finalization_failed → "Finalization failed" (✕)
- ready_for_review → "Ready for review" (⚑)
- reviewed → "Reviewed" (✔)
- manual_review_needed → "Needs review" (⚑)
- failed → "Failed" (✕)

**Filter options:** "All statuses", "Uploaded", "Scouting", "Grading", "Ready
for review", "Needs review", "Failed".

**Buttons:** "Upload more", "Release reviewed (n)", "Retry failed (n)", "Retry",
"Open", "Clear filter", "View in DLQ".

**Empty:** title "No submissions yet"; body "Upload scanned answer sheets to
start grading." Filtered-empty: "No submissions are {status}."

**Errors:**

- Stream: "Live updates interrupted — showing last known state."
- Quota/circuit: "Grading paused — AI service unavailable. Affected submissions
  moved to Needs review."
- Action: "Couldn't release results — {reason}. No changes were made."

**Confirm (release):** "Release results for {n} submissions? Students and
parents will be able to see their scores and feedback once released." Buttons:
"Release" / "Cancel".

**Tooltips:** disabled-release "Only `ready_for_review` or `reviewed`
submissions can be released." · DLQ "Open this submission's error in the
dead-letter queue."

---

## 8. Domain rules surfaced

- **Answer-key / rubric model-answer never leaves the server boundary here.**
  This screen shows scores, grades, and status only — no `modelAnswer`, no
  rubric internals. (`AnswerKeyLock` semantics are upheld by simply not
  rendering them.)
- **Confidence routing drives review priority.** Rows land in `needs_review` /
  `manual_review_needed` because per-question
  `confidence < confidenceThreshold (0.7)` or because a service error degraded
  the question to manually-gradeable. The optional `ConfidenceBadge` and the
  "Needs review" status make this the visual priority. Thresholds are per-tenant
  via `EvaluationSettings.confidenceConfig`.
- **Server-authoritative status.** The client never invents `pipelineStatus` —
  it reflects what `submissions.listLive` streams. Optimistic UI (retry/release)
  is provisional and always reconciled by the next snapshot; the server's status
  machine wins.
- **Results released explicitly.** Students/parents cannot read results until
  `resultsReleased` is true (or `releaseResultsAutomatically` on the exam).
  Release is gated to the exam owner; the bulk action is the controlled path.
- **Override audit preserved.** Manual overrides made in grading-review keep
  `originalScore`; this queue reflects the post-override `summary` but does not
  erase audit trail (visible in OverrideTimeline downstream).
- **Tenant isolation** on every read/write; `examId` validated against the
  active tenant.
- **Post-publish field locks** are an Exam-level concern (`saveExam` /
  `POST_PUBLISH_LOCKED_FIELDS`) — surfaced upstream; this screen does not edit
  exam metadata.
- **`uploadSource` (web | scanner)** is honored: scanner-originated submissions
  appear identically in the queue (small "scanner" Chip/Tag when
  `answerSheets.uploadSource === 'scanner'`).

---

## 9. Accessibility

- **Focus order:** Breadcrumb → Upload more → counts strip (skippable,
  `aria-label="Submission counts"`) → filter Select → search Input → DataTable
  (header checkbox → sortable headers → rows). Bulk-action buttons enter the tab
  order only when ≥1 row is selected, announced via `aria-live="polite"` ("5
  selected").
- **Keyboard:** arrow-key roving within table rows; `Space` toggles row
  checkbox; `Enter` opens grading-review; sort headers are `button`s toggled
  with `Enter`/`Space`; ConfirmDialog traps focus and restores to the triggering
  button on close.
- **ARIA:** each status `Badge` has visible icon **and** text (never
  color-only); `ProgressBar` uses `role="progressbar"` with
  `aria-valuenow/min/max` and a label "Grading progress, 6 of 9 questions".
  `LiveSyncIndicator` is `aria-live="polite"` ("Live updates connected" /
  "Reconnecting"). Watchdog Toasts use polite live region. DataTable is a proper
  `table` with scope-d headers; selection state via `aria-selected`.
- **Contrast:** all status/grade colors meet WCAG AA against `bg.surface`;
  confidence/grade hues always paired with icon + label so color is never the
  sole signal.
- **Reduced motion:** `prefers-reduced-motion` → ProgressBar jumps instead of
  tween, Badge swaps instead of cross-fade, watchdog highlight omitted; no
  functional difference.
- **Touch:** all interactive targets ≥44px on mobile cards.

---

## 10. Web ↔ mobile divergence

| Concern               | teacher-web (today)                       | future RN / scanner-web                                                                    |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| List surface          | `DataTable` (sort/filter/paginate/select) | Stacked `SubmissionCard` list, infinite scroll                                             |
| Row affordance        | Hover tint + click target                 | Press state; tap opens grading-review                                                      |
| Counts strip          | 5 inline `Stat`s                          | Horizontally scrollable `Stat` chip row                                                    |
| Filter + bulk actions | Inline toolbar                            | Sticky bottom `Drawer/Sheet`                                                               |
| Selection             | Header + row checkboxes                   | Long-press to enter select mode                                                            |
| Search                | Inline Input                              | Collapsed IconButton → expandable Input                                                    |
| Command palette       | `⌘K` (jump to submission by roll)         | None                                                                                       |
| Retry/release         | Buttons + `ConfirmDialog`                 | Same components, sheet-presented confirm                                                   |
| Live sync             | `onSnapshot` + `LiveSyncIndicator`        | Same stream; indicator in header; offline → `UploadQueueItem` semantics for pending intake |
| scanner-web role      | n/a                                       | Intake-only; this queue is read-mostly, no release action                                  |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only the
renderer differs.

---

## 11. Claude-design prompt

```
You are designing the "Submissions Grading Queue" screen for Auto-LevelUp's teacher-web app.
Conform EXACTLY to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md):
"Modern Scholarly" — warm paper neutrals (bg.canvas/bg.surface), deep indigo brand.primary,
marigold spark reserved for gamification only (NOT here), Fraunces for display headings,
Schibsted Grotesk for UI/body/tables, Spline Sans Mono for all numerics (scores, counts,
progress, IDs, timestamps). Cite tokens by name; never hardcode hex. Radius: cards lg,
inputs/buttons md, chips/badges pill. Elevation e1 cards / e2 hover. Motion: instant/fast/
base/slow with ease.standard; respect prefers-reduced-motion. No celebratory spring here.

ROUTE: /exams/:examId/submissions, inside AppShell (Sidebar + Topbar + Breadcrumb
"Exams / {exam.title} / Submissions").

BUILD a live, real-time queue of Submissions for one exam (data via submissions.listLive
onSnapshot). Compose ONLY from the Lyceum inventory:
- Header: h2 "Submissions", exam-status Badge, primary Button "Upload more".
- Counts strip: 5 Stat/KPI (Total, Graded, Needs review, Failed, Released) with icon + mono count.
- Toolbar: pipelineStatus Select filter, search Input, a live-sync indicator (Badge + pulse).
  When rows are selected: secondary Button "Release reviewed (n)", ghost Button "Retry failed (n)".
- DataTable (sort/filter/paginate/select) with columns: checkbox · Student/Roll · Class ·
  Status Badge · ProgressBar · Score+GradePill. Each row clickable → grading-review.

STATUS Badge MUST render icon + label (never color-only), mapping the full
SubmissionPipelineStatus set with underscores → spaces and sentence case (Uploaded, Scouting,
Scouted, Grading, Partially graded, Grading failed, Grading complete, Finalization failed,
Ready for review, Reviewed, Needs review, Failed). NEVER surface ocr_* states. Use
confidence.low/med/high and grade.A–F scales only via GradePill / ConfidenceBadge, always with
icon + label.

LIVE behavior: in-flight rows (scouting/grading) animate an ARIA progressbar from
gradingProgress.*; completed rows show summary (totalScore/maxScore, percentage, GradePill);
released rows show a resultsReleased ✓.

STATES: skeleton rows (loading); EmptyState "No submissions yet" + Upload more (empty);
InlineAlert "Live updates interrupted" (stream error); Banner "Grading paused — AI service
unavailable" (quota/circuit). Release uses ConfirmDialog ("Release results for {n} submissions?
Students and parents will be able to see scores and feedback.") with optimistic update + Toast,
reverting on failure. Retry uses gradeQuestion(mode: retry), optimistic → Grading.

DOMAIN RULES to honor: never render model answers / rubric internals; results visible to
students only after explicit release (resultsReleased); release gated to exam owner (Admin sees
disabled Button + Tooltip); confidence routing makes "Needs review" the priority; status is
server-authoritative (optimistic UI reconciled by next snapshot); tenant-isolated reads; show a
small "scanner" Chip when uploadSource === 'scanner'; link failed rows to the gradingDeadLetter
(DLQ).

RESPONSIVE: lg DataTable; md condensed (Class on a secondary line, search → IconButton); sm
stacked SubmissionCard list with counts as a scrollable chip row and filter/bulk actions in a
bottom Drawer. Mobile has no ⌘K. Touch targets ≥44px.

A11Y: roving tab in table, Space toggles selection, Enter opens row; progressbar has
aria-valuenow/min/max + label; status Badges have text + icon; bulk selection announced via
aria-live; ConfirmDialog traps + restores focus; all pairs WCAG AA.

Output: a single responsive React + Tailwind (@theme tokens) screen using shared-ui components,
production-ready, no placeholder lorem beyond the sample rows.
```
