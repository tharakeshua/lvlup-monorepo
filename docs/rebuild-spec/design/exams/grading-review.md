# Grading Review (FLAGSHIP)

_The human-in-the-loop cockpit where a teacher confirms, overrides, or retries
AI grading for one student's submission — answer-sheet pane on the left,
confidence-routed per-question review on the right, driven almost entirely by
the keyboard._

---

## 1. Purpose & primary user

**Primary user:** the **teacher/grader** (and tenant **admin** acting as
grader). Sub-role: an **exam-coordinator** who triages many submissions and
wants to clear the `needs_review` queue fast.

**Job-to-be-done:** _"The AI graded this student's answer sheet. Show me where
it is unsure (low confidence), let me see the answer image side-by-side with the
rubric and AI reasoning per question, let me approve the confident ones in bulk,
fix the ones it got wrong with an auditable override, retry the ones that failed
— and mark the whole submission reviewed — without lifting my hands off the
keyboard."_

This is the **flagship screen** of AutoGrade because it is where the product's
core promise — _trustworthy AI grading with a human safety net_ — is either
earned or lost. Every confidence-routing, audit, and tenant-isolation rule
converges here. The screen's success metric is
**seconds-per-submission-cleared** while keeping **zero ungrounded overrides**
(every score change traceable to a rubric criterion + reason).

---

## 2. Entry points & route

**Route:** `/exams/:examId/submissions/:submissionId` (GradingReview).

**Entry points:**

- From `/exams/:examId/submissions` (Submissions list) — clicking a
  `SubmissionCard` whose `pipelineStatus` is `ready_for_review`,
  `grading_partial`, `manual_review_needed`, or `reviewed`.
- From `/exams/:examId` Submissions tab "Review next" action (jumps to the next
  un-reviewed submission with `needs_review` questions).
- Deep-link from a notification ("3 submissions need review") and from the DLQ
  admin view (`/ai-usage` → a `GradingDeadLetterEntry` resolves to
  `submissionId` + `questionSubmissionId`).
- `CommandPalette` (⌘K) → "Go to submission {rollNumber}".

**Reads (live, tenant-scoped):**

- `submissions.getLive(examId, submissionId)` → the `Submission` (header
  summary, `pipelineStatus`, `gradingProgress.*`,
  `scoutingResult.routingMap`/`confidence`, `resultsReleased`).
- `questionSubmissions.listLive(examId, submissionId)` → all
  `QuestionSubmission` docs (per-question `evaluation: UnifiedEvaluationResult`,
  `gradingStatus`, `manualOverride`, `mapping.imageUrls`).
- `exams.get(examId)` → `Exam.questions` order/`maxMarks`/`rubric`
  (UnifiedRubric) + `gradingConfig` (`allowManualOverride`,
  `requireOverrideReason`, `releaseResultsAutomatically`,
  `evaluationSettingsId`) — drives whether override controls render and whether
  a reason is mandatory.
- `evaluationSettings.get(evaluationSettingsId)` (cached) →
  `confidenceConfig.confidenceThreshold` (0.7) / `autoApproveThreshold` (0.9)
  for routing labels & filters.

**Writes (Firebase callables — never direct Firestore):**

- `gradeQuestion({ mode: 'manual', ... })` → ManualOverrideControl submit
  (score + reason, persists
  `manualOverride{score,reason,overriddenBy,overriddenAt,originalScore}`, sets
  `gradingStatus: overridden`).
- `gradeQuestion({ mode: 'ai' | 'retry' })` → re-run a single
  failed/needs_review question through RELMS.
- `gradeQuestion({ mode: 'manual', bulkApprove: true, questionSubmissionIds: [...] })`
  → server-side **Approve All** (accepts AI scores for the selected/eligible
  questions; sets `gradingStatus: graded`).
- `saveExam` is **not** called here; marking the submission reviewed flips
  `Submission.pipelineStatus → reviewed` via a dedicated callable path
  (`gradeQuestion` finalization or a `reviewSubmission` callable) — status
  machine is server-authoritative.

The image URLs in `mapping.imageUrls` are **HTTPS URLs resolved by the API**,
not raw Storage paths — the pane renders them directly.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). Breadcrumb:
`Exams / {Exam.title} / Submissions / {rollNumber}`. Max content width is
**not** clamped to 1200 here — the split workspace uses the full available width
(this is a tool, not reading content), gutters per breakpoint.

### lg (≥1024) — the canonical two-pane workspace

```
┌─ AppShell ────────────────────────────────────────────────────────────────────────┐
│ Topbar: tenant · ⌘K search · notifications · profile                                │
│ Breadcrumb: Exams / Physics Mid-Term / Submissions / R-042                          │
├────────────────────────────────────────────────────────────────────────────────────┤
│ SUBMISSION HEADER (sticky, e1)                                                       │
│ ┌──────────────────────────────────────────────────────────────────────────────┐  │
│ │ Avatar  Aarav Mehta · R-042 · Class 10-B          PipelineStatusBadge: Ready   │  │
│ │         ResultSummary: ⟨ 34 / 50 ⟩ 68%  GradePill[C]   ▕ 3 need review ▏       │  │
│ │ gradingProgress ▓▓▓▓▓▓▓▓░░ 8/10 graded     [Approve All] [Mark reviewed ✓]     │  │
│ └──────────────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────┬─────────────────────────────────────────────────┤
│ ANSWER-SHEET PANE (≈45%, sunken)  │ REVIEW PANE (≈55%, scroll)                       │
│                                   │ ┌─ Toolbar (sticky) ──────────────────────────┐ │
│  ┌────────────────────────────┐   │ │ Filter: [All][Needs review•3][Low conf]     │ │
│  │                            │   │ │ Sort: needs-review → low-conf → order  · ?  │ │
│  │   answer page image        │   │ └─────────────────────────────────────────────┘ │
│  │   (mapping.imageUrls[i])   │   │                                                 │
│  │   pan / zoom               │   │ ┌─ Q3  ◀ FOCUSED (j/k) ───────────────────────┐ │
│  │                            │   │ │ ConfidenceBadge[LOW 0.58]  Needs review      │ │
│  └────────────────────────────┘   │ │ ContentRenderer: question text + KaTeX       │ │
│  ◀ Page 2 / 4 ▶   [1][2•Q3][3][4] │ │ Score ⟨ 4 / 8 ⟩  ConfidenceBar ▓▓░░░░        │ │
│  pages mapped to focused Q hi-lit │ │ RubricBreakdown (criterion · awarded/max)    │ │
│                                   │ │ FeedbackPanel: issue · whyItMatters · howTo  │ │
│  Thumbnail rail (all pages)       │ │ strengths · weaknesses · missingConcepts     │ │
│  [t1][t2][t3][t4]                 │ │ mistakeClassification: Conceptual            │ │
│                                   │ │ ┌ Actions ─────────────────────────────────┐ │ │
│                                   │ │ │ [Approve a] [Override o] [Retry]          │ │ │
│                                   │ │ └───────────────────────────────────────────┘ │
│                                   │ └──────────────────────────────────────────────┘ │
│                                   │ ┌─ Q1  graded · ConfidenceBadge[HIGH 0.94] ▸ ─┐ │
│                                   │ │ (collapsed: score 8/8, auto-approved)        │ │
│                                   │ └──────────────────────────────────────────────┘ │
└──────────────────────────────────┴─────────────────────────────────────────────────┘
```

- **Focused question** (j/k target) drives the answer pane: when Q3 is focused,
  the pane auto-navigates to the first page in `scoutingResult.routingMap['q3']`
  / `mapping.pageIndices`, and those pages are highlighted in the page nav +
  thumbnail rail.
- The divider is **draggable** (40–65% range, persisted to localStorage per
  user). Default 45/55.
- Header is **sticky**; review pane scrolls independently; answer pane is
  fixed-position with its own zoom/pan.

### md (768–1023) — tabbed panes

Single column. A `Tabs` toggles **[Answer sheet] / [Review]**; focusing a
question (or pressing `Enter` on it) auto-switches to the Answer tab scrolled to
the mapped page, then `Esc`/back returns to Review. Header stays sticky. Actions
move into a sticky bottom action bar within each question card.

### sm (<768) — stacked, review-first (future RN)

Review pane is primary. Each `QuestionCard` shows a compact summary + a "View
answer page" button that opens the answer image full-screen in a `Drawer/Sheet`.
Filters collapse into a `Select`; sort fixed to default. Keyboard shortcuts are
unavailable; large touch buttons (≥44px) for Approve / Override / Retry. Bulk
"Approve All" lives in the sticky header.

---

## 4. Components used (Lyceum inventory)

**Navigation/containers:** `AppShell`, `Breadcrumb`, `Tabs` (md/sm pane toggle),
`Drawer/Sheet` (mobile answer image), `Panel` (the two panes), `Card`
(per-question), `Accordion` (collapse graded/auto-approved questions), `Popover`
(keyboard-help `?`), `Tooltip`, `Section`.

**Primitives:** `Button` (primary = Mark reviewed; secondary = Override; ghost =
Retry; **spark is NOT used here** — this is staff tooling, not gamification),
`IconButton` (page nav, zoom, thumbnail), `Select` (mobile filter), `Textarea`
(override reason), `Slider` (override score, optional), `Input` (override score
numeric).

**Data:** `ConfidenceBadge`, `ConfidenceBar` (feedback pkg), `GradePill`,
`RubricBreakdown`, `Badge`/`Chip` (mistakeClassification, status), `Stat/KPI`
(ResultSummary score/percentage), `ProgressBar` (`gradingProgress`), `Avatar`,
`DefinitionList` (strengths/weaknesses/missingConcepts), `Skeleton`,
`Pagination` (page nav within pane), `Timeline` → **`OverrideTimeline`**
(feedback pkg, shows originalScore → overridden audit).

**Feedback:** `Toast` (sonner — "Q3 approved", "Override saved", "Retry
queued"), `InlineAlert/Banner` (partial/failed pipeline, quota-degraded),
`ConfirmDialog` (Approve All, Mark reviewed when items still need review),
`LoadingOverlay` (per-question retry spinner), `FormFieldError` (override reason
required).

**Domain (cross-app):** `SubmissionCard` (header identity block),
`ResultSummary`, `QuestionCard` (review card per question), `ContentRenderer`
(question text, md+KaTeX — **answer-key/model-answer is NOT piped to any
student-facing renderer**), `ConfidenceBadge`, `ConfidenceBar`,
`RubricBreakdown`, `FeedbackPanel` (structuredFeedback:
issue/whyItMatters/howToFix/severity), `ManualOverrideControl` (→
`manual-override` spec), `GradePill`, `AnswerKeyLock` (server-only guard visual
on `showModelAnswer` regions), `OverrideTimeline`.

**Proposed additions (justified, scoped to this screen):**

- **`AnswerSheetViewer`** — the left pane: zoom/pan image canvas + page nav +
  thumbnail rail + "mapped-page highlight" tied to the focused question's
  `mapping.pageIndices`. Justified because no existing primitive does image
  pan/zoom with cross-pane page-mapping highlight; `ScanFrame` is
  camera-capture, not review.
- **`ReviewQueueToolbar`** — filter (all / needs_review / low_confidence) + sort
  (needs-review → low-confidence → order) + counts + `?` help. Thin composition
  over `Chip`/`Select`; named for reuse in the Submissions list bulk-review
  mode.
- **`KeyboardHelpPopover`** — the `?` cheat-sheet (composition of `Popover` +
  `DefinitionList`).

---

## 5. States

| State                    | Condition                                                                      | Treatment                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading**              | `getLive` / `listLive` pending                                                 | AppShell + breadcrumb render immediately. Header shows `Skeleton` for identity/score. Answer pane: one large `Skeleton` block + thumbnail skeletons. Review pane: 3 stacked `QuestionCard` skeletons (title bar + rubric rows). No layout shift when data lands.                                                                                      |
| **Empty (no questions)** | `questionSubmissions` empty but submission exists                              | `EmptyState` (Fraunces title) "No graded questions yet" + body "Scouting hasn't mapped this sheet to questions." + action mirroring pipeline state (see partial/failed).                                                                                                                                                                              |
| **Partial**              | `pipelineStatus: grading_partial` or some `gradingStatus: failed/needs_review` | `InlineAlert` (status.warning) at top of review pane: "Some questions couldn't be graded automatically." Failed cards float to top (sort honors them), each with a **Retry** action. Header progress shows e.g. `8/10 graded`. Approve All is enabled but only acts on eligible (`graded`/high-confidence) questions; ConfirmDialog states the count. |
| **Pipeline running**     | `scouting`, `grading`                                                          | Read-only review actions disabled with `Tooltip` "Grading in progress…"; live `ProgressBar` from `gradingProgress.*`; cards stream in as they complete (entrance motion).                                                                                                                                                                             |
| **Error (load)**         | `getLive` error / not found / cross-tenant                                     | Full-pane `InlineAlert` (status.error) "Couldn't load this submission" + Retry + "Back to submissions". 404/permission → generic not-found (never leak existence across tenants).                                                                                                                                                                     |
| **Error (action)**       | callable rejects                                                               | `Toast` (error) + the card stays in its prior state (optimistic update rolled back). Quota / circuit-breaker / rate-limit → `InlineAlert` "AI grading is temporarily unavailable; this question is queued for manual review" and the question degrades to `needs_review` (matches server DLQ behavior).                                               |
| **Success**              | all questions `graded`/`overridden`/`auto-approved`, none `needs_review`       | Header banner (status.success) "All questions reviewed." `Mark reviewed` becomes primary/emphasized. After review → header shows `reviewed` badge; if `releaseResultsAutomatically` true, a follow-on toast notes results released.                                                                                                                   |
| **Already reviewed**     | `pipelineStatus: reviewed`                                                     | Banner "Reviewed by {name} · {time}". Cards are read-only but **re-openable** (override still allowed if `allowManualOverride`); changing a score reverts submission to `ready_for_review` until re-marked.                                                                                                                                           |
| **Results released**     | `resultsReleased: true`                                                        | Lock chip "Results released {time}" near header; overrides still possible (audited) but a `ConfirmDialog` warns "Students can already see these results."                                                                                                                                                                                             |

**Permission/role gating:**

- **Grader/teacher/admin:** full screen.
- **`gradingConfig.allowManualOverride === false`:** Override controls hidden;
  only Approve / Retry / Mark reviewed.
- **`requireOverrideReason === true`:** reason `Textarea` is required
  (`FormFieldError` blocks submit).
- **scanner role:** has no read access to grading; route 403s — scanner is
  intake-only (`uploadSource: scanner`).
- **student/parent:** **never** reach this route. They read released results via
  a separate result view; rubric `modelAnswer`/answer-key is **server-stripped**
  from their payloads.

---

## 6. Interactions & motion

**Keyboard-driven grading (the defining interaction).** Focus model: exactly one
question card is "focused" at a time (outline = `border.focus`,
`0 0 0 3px indigo @35%`). Global handlers (when not in a text field):

| Key             | Action                                                                                  |
| --------------- | --------------------------------------------------------------------------------------- |
| `j` / `↓`       | focus next question (respecting current filter+sort)                                    |
| `k` / `↑`       | focus previous question                                                                 |
| `a`             | **Approve** focused question's AI score (`gradeQuestion mode:'manual'` accept)          |
| `o`             | open inline **Override** (`ManualOverrideControl`) on focused question                  |
| `r`             | **Retry** focused question if `failed`/`needs_review` (`gradeQuestion mode:'retry'`)    |
| `Enter`         | commit the open override / confirm focused action; on md/sm, jump to mapped answer page |
| `Esc`           | close override / help / return Review tab                                               |
| `[` / `]`       | previous / next **answer page** in the left pane                                        |
| `+` / `-` / `0` | zoom answer image in / out / reset                                                      |
| `A` (shift)     | **Approve All** (opens ConfirmDialog)                                                   |
| `?`             | toggle `KeyboardHelpPopover`                                                            |

After `a`/override-commit, focus **auto-advances** to the next `needs_review`
question (configurable), so a grader can clear the queue with `a a a`. Each
action emits a `Toast`.

**Optimistic updates.** Approve / Override apply immediately to the card (score
updates, badge flips to `graded`/`overridden` with a `fast 160ms` color/opacity
transition), header `ResultSummary` + `GradePill` recompute live,
`gradingProgress` bar fills (`base 220ms` width ease.standard). On callable
failure → roll back with an error `Toast`; card returns to prior state.

**Confidence-driven entrance.** On first render, cards animate in top-to-bottom
(`ease.entrance`, staggered ~30ms). `needs_review`/low-confidence cards are
expanded; `graded` high-confidence (auto-approved) cards are **collapsed** in an
`Accordion` ("✓ 5 auto-approved — expand") to reduce review surface.

**Pane sync.** Focusing a question scrolls/zooms the answer pane to its first
mapped page (`fast 160ms` scroll, mapped pages get a `confidence.*`-tinted
highlight ring). Dragging the divider is `instant` (no transition while
dragging).

**Confirmations.**

- **Approve All** → `ConfirmDialog`: "Approve {N} AI-graded questions for
  {rollNumber}? Low-confidence questions ({M}) are excluded." Primary "Approve
  {N}". Runs the server-side bulk `gradeQuestion`.
- **Mark reviewed while items remain** → `ConfirmDialog`: "{M} questions still
  need review. Mark submission reviewed anyway?" (discourages skipping).
- **Override** → no modal; inline commit, but if `requireOverrideReason`, empty
  reason blocks with `FormFieldError`. Reason + `originalScore` persist for
  `OverrideTimeline`.

**Motion discipline.** No celebratory spring, no marigold spark here — staff
tooling stays calm (`fast`/`base`, `ease.standard`). The single LoadingOverlay
on retry uses `LoadingOverlay`. `prefers-reduced-motion` → all transitions
become opacity-only/instant; auto-advance still works.

---

## 7. Content & copy (precise, staff tone)

- **Header identity:** `{studentName} · {rollNumber} · {className}`. Score:
  ResultSummary `{totalScore} / {maxScore}` (Spline Mono) · `{percentage}%` ·
  GradePill. Needs-review chip: `"{n} need review"`.
- **Pipeline status labels** (map enum → human, icon + label, never color-only):
  `ready_for_review` → "Ready for review", `grading_partial` → "Partially
  graded", `manual_review_needed` → "Needs manual review", `reviewed` →
  "Reviewed", `grading` → "Grading…", `scouting` → "Mapping pages…",
  `grading_failed` → "Grading failed". (`ocr_*` states are vestigial — never
  surfaced.)
- **Confidence labels:** `ConfidenceBadge` reads "High 0.94 · Auto-accepted",
  "Medium 0.82 · Spot-check", "Low 0.58 · Needs review" — value in mono, label
  in UI font.
- **Question grading-status chips:** `graded` "AI graded", `needs_review` "Needs
  review", `overridden` "Overridden", `failed` "Failed", `manual` "Manually
  graded", `processing` "Grading…".
- **Mistake classification chip:** "Conceptual" / "Silly error" / "Knowledge
  gap" / "—".
- **Actions:** "Approve" · "Override" · "Retry" · "Approve all" · "Mark
  reviewed".
- **Filters:** "All" · "Needs review" · "Low confidence". **Sort:** "Review
  priority" (needs-review → low-confidence → question order).
- **Empty:** title "No graded questions yet" / body "Scouting hasn't mapped this
  sheet to questions."
- **Error (load):** "Couldn't load this submission. It may have moved or you may
  not have access."
- **Error (quota/circuit):** "AI grading is temporarily unavailable. This
  question is queued for manual review."
- **Override reason placeholder:** "Why are you changing this score? (e.g.
  'Awarded method marks per rubric C2')."
- **Confirm Approve All:** "Approve {N} AI-graded questions? {M} low-confidence
  questions are excluded and stay for review."
- **Success banner:** "All questions reviewed." → after marking: "Reviewed by
  {name} · {relativeTime}."
- **Help popover title:** "Keyboard shortcuts" (Fraunces). Tone throughout:
  terse, instrument-panel, no exclamation marks, no encouragement language (that
  register is for students).

---

## 8. Domain rules surfaced

1. **Answer-key / model-answer never leaks to students.** `rubric.modelAnswer` /
   `showModelAnswer` content renders here only for the teacher and only through
   the staff `ContentRenderer`; the student result payload is server-stripped.
   `AnswerKeyLock` visual marks any model-answer region as "Staff only — not
   shown to students."
2. **Confidence routing is the organizing principle.** Per-question:
   `confidence < confidenceThreshold (0.7)` → `needs_review` (human required,
   surfaced first / red `confidence.low`); `> autoApproveThreshold (0.9)` →
   auto-approved (collapsed, green `confidence.high`); middle → `graded` +
   reviewSuggested (amber `confidence.med`). Thresholds come from the tenant's
   `EvaluationSettings.confidenceConfig`, not hard-coded in the UI.
3. **Server-authoritative status machine.** The client never sets
   `pipelineStatus`/`gradingStatus` directly — it calls `gradeQuestion` / the
   review-finalize callable and re-renders from the live read. UI mirrors enums;
   it does not invent transitions. Marking reviewed is a server transition to
   `reviewed`.
4. **Override audit is mandatory and non-destructive.** `manualOverride` always
   stores `originalScore`, `overriddenBy`, `overriddenAt`;
   `gradeQuestion mode:'manual'` keeps history → rendered as `OverrideTimeline`.
   `requireOverrideReason` gates the submit.
5. **Tenant isolation on every read.** `getLive`/`listLive` are tenant-scoped;
   cross-tenant access returns not-found (no existence leak). Per-tenant Gemini
   key powers retries; region `asia-south1`.
6. **Results release gate.** Students/parents see scores only after explicit
   release or `gradingConfig.releaseResultsAutomatically`. Overriding after
   `resultsReleased: true` is allowed but warned (students may already have seen
   the prior score) — and is itself audited.
7. **Degrade-to-review on service failure.** Quota / circuit-breaker /
   rate-limit during retry does not silently fail — the question goes
   `needs_review`, a `GradingDeadLetterEntry` is written, and the UI shows it as
   manually gradeable.
8. **Bulk approve is server-enforced.** "Approve All" calls the server-side bulk
   path which itself excludes ineligible (`needs_review`/`failed`) questions —
   the UI's count is advisory, the server is the gate.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → header actions (Approve All, Mark reviewed) →
  review toolbar (filter chips, sort, `?`) → question cards in DOM order →
  answer pane controls. The "focused question" is a **roving tabindex** list
  (`role="list"` / `role="listitem"`, `aria-activedescendant` on the list
  container) so `j/k` move a virtual cursor without stealing browser tab focus;
  `Tab` still reaches actionable controls.
- **Keyboard:** every pointer action has a key (§6). Shortcuts are disabled
  while a `Textarea`/`Input` is focused (so typing a reason never triggers
  `a`/`r`). `?` lists all bindings; `Esc` closes overlays. Drag-divider has
  keyboard handles (`←/→` resize when the divider handle is focused).
- **ARIA:** each card `aria-labelledby` the question heading; `ConfidenceBadge`
  carries `aria-label="Confidence low, 0.58, needs review"`; status conveyed by
  **icon + text**, never color alone (satisfies the no-color-only rule).
  `ProgressBar` has `aria-valuenow/min/max`. `Toast` region is
  `aria-live="polite"`; pipeline-failure `InlineAlert` is `role="alert"` /
  `aria-live="assertive"`. The answer image has descriptive `alt` ("Answer sheet
  page 2 of 4, mapped to Q3") and zoom controls are labeled.
- **Contrast:** all confidence/grade/status pairs are WCAG AA (foundation
  guarantees); mono scores meet 4.5:1 on `bg.surface`. Focus ring
  `0 0 0 3px indigo @35%` on every interactive element.
- **Reduced motion:** `prefers-reduced-motion` removes stagger/scroll/zoom
  transitions (opacity/instant only); auto-advance and pane-sync still function,
  just without animation.
- **Screen-reader flow for grading:** approving announces "Q3 approved, 8 of 10
  graded"; override-commit announces "Q3 overridden to 6 of 8."

---

## 10. Web ↔ mobile divergence

| Aspect                      | teacher-web (today)                           | md tablet               | future RN / scanner-web                                     |
| --------------------------- | --------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| Layout                      | Side-by-side split panes (draggable)          | `Tabs`: Answer / Review | Stacked, review-first; answer in `Drawer/Sheet` full-screen |
| Question list               | Cards in scroll column, roving cursor         | Same                    | Stacked compact cards, no virtual cursor                    |
| Answer image                | `AnswerSheetViewer` pan/zoom + thumbnail rail | Same in Answer tab      | Pinch-zoom sheet; "View answer page" button per question    |
| Grading input               | **Keyboard `j/k/a/o/r`** primary              | Keyboard + touch        | Touch buttons only (≥44px); no shortcuts                    |
| Filters/sort                | Chip row + sort menu                          | Chip row                | Collapsed into `Select`; sort fixed to review-priority      |
| Approve All / Mark reviewed | Header buttons + `Shift+A` / shortcut         | Header buttons          | Sticky header buttons, ConfirmDialog as bottom sheet        |
| Help                        | `?` `KeyboardHelpPopover`                     | `?`                     | none (no shortcuts to document)                             |
| ⌘K entry                    | CommandPalette                                | CommandPalette          | none                                                        |
| Hover affordances           | Tooltips on hover                             | Press-and-hold          | Press; no hover                                             |

Component **names/props are 1:1** across `shared-ui` (web) and `ui-native`
(mobile) per foundation §6 — only the renderer and the input modality differ.
scanner-web never renders this screen (intake-only).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the FLAGSHIP "Grading Review" screen for Auto-LevelUp (AutoGrade),
route /exams/:examId/submissions/:submissionId, using the "Lyceum" design system
(docs/rebuild-spec/design/00-FOUNDATION.md). Conform EXACTLY — compose only from Lyceum
tokens and components; cite tokens by name (e.g. brand.primary, confidence.low,
confidence.med, confidence.high, grade.A–F, status.warning); do not invent colors/fonts.
Fraunces for display/empty-state titles, Schibsted Grotesk for UI/body/buttons/tables,
Spline Sans Mono for scores/confidence values/IDs/progress. Radius: cards lg, buttons/inputs
md, chips pill. Elevation e1 cards / e3 modals; focus ring indigo@35%. Motion fast/base with
ease.standard; NO spark/marigold and NO celebratory spring (this is calm staff tooling).
Respect prefers-reduced-motion.

GOAL: a teacher reviews ONE student Submission's AI grading, per question, human-in-the-loop.
Render inside AppShell (Sidebar+Topbar) with Breadcrumb Exams / {exam} / Submissions / {roll}.

LAYOUT (desktop ≥1024): a sticky SUBMISSION HEADER (Avatar + studentName · rollNumber · class,
PipelineStatus badge with icon+label, ResultSummary {totalScore}/{maxScore} + {percentage}% +
GradePill, gradingProgress ProgressBar, "Approve all" + "Mark reviewed" buttons), then a
two-pane split below: LEFT AnswerSheetViewer (pan/zoom image from mapping.imageUrls, page nav,
thumbnail rail, mapped-page highlight tied to the focused question) ~45%; RIGHT review pane ~55%
with a sticky ReviewQueueToolbar (filter chips: All / Needs review / Low confidence; sort:
review-priority = needs-review then low-confidence then order; a "?" keyboard-help Popover) and a
scroll column of per-question Cards. Tablet (768–1023): collapse to Tabs [Answer | Review].
Mobile: stacked review-first, answer image in a Drawer.

EACH QUESTION CARD: ConfidenceBadge + ConfidenceBar (confidence.low <0.7 needs_review / med
0.7–0.9 spot-check / high >0.9 auto-accepted; value in mono, never color-only — always icon+label),
question text via ContentRenderer (Markdown+KaTeX), score {score}/{maxScore}, RubricBreakdown
(criterion · awarded/max · feedback), FeedbackPanel for structuredFeedback (issue · whyItMatters ·
howToFix · severity critical/major/minor), strengths/weaknesses/missingConcepts as DefinitionLists,
mistakeClassification chip, and an actions row [Approve][Override][Retry]. Override uses
ManualOverrideControl (score + reason Textarea, reason required when requireOverrideReason;
shows OverrideTimeline with originalScore for audit). High-confidence auto-approved questions are
collapsed in an Accordion. Mark any model-answer region with AnswerKeyLock ("Staff only — not
shown to students").

CONFIDENCE ROUTING is central: needs_review (low) cards surface first and expanded; auto-approved
(high) collapsed; reviewSuggested (med) expanded with a softer cue. Thresholds come from
EvaluationSettings.confidenceConfig (confidenceThreshold 0.7 / autoApproveThreshold 0.9).

KEYBOARD-DRIVEN: one focused card (roving cursor, border.focus ring). j/k navigate, a approve,
o override, r retry, [ ] change answer page, +/-/0 zoom, Shift+A Approve All, Enter commit,
Esc close, ? help. Approving auto-advances to the next needs_review card. Shortcuts disabled while
typing in the reason field.

STATES: skeleton load (no layout shift); empty ("No graded questions yet"); partial
(grading_partial → status.warning InlineAlert, failed cards on top with Retry); error (load → full
InlineAlert + Retry/Back; quota/circuit → "AI grading temporarily unavailable, queued for manual
review" and degrade card to needs_review); success ("All questions reviewed" → Mark reviewed
emphasized); already-reviewed (read-only, re-openable); results-released lock chip + warning on
late override. Permission: hide Override if gradingConfig.allowManualOverride is false.

DOMAIN RULES to honor visually: answer-key/model-answer never shown to students; server-authoritative
status (client calls gradeQuestion / review-finalize callables, never sets status); override always
keeps originalScore + reason for audit; tenant isolation (cross-tenant = not found); results release
gate; bulk Approve All excludes ineligible questions server-side.

A11Y: roving-tabindex list with aria-activedescendant; status as icon+text (never color alone);
ConfidenceBadge aria-labels; ProgressBar aria-valuenow; Toast aria-live polite, failure InlineAlert
role=alert; WCAG AA; focus rings everywhere; reduced-motion = opacity/instant only.

Deliver: a React + Tailwind (Lyceum @theme tokens) implementation, decomposed into a useGradingReview
state machine hook (load, filter/sort, focus cursor, keyboard handlers, optimistic approve/override/
retry/bulk, mark-reviewed) and a presentational GradingReviewView composed of the components above.
Use real entity/field/status names from the AutoGrade data model (Submission, QuestionSubmission,
UnifiedEvaluationResult, manualOverride, pipelineStatus, gradingStatus, mapping.imageUrls).
```
