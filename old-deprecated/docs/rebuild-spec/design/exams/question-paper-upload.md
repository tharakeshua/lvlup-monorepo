# Question Paper Upload & Extraction

_Teacher uploads scanned question-paper images, then triggers Gemini extraction
(`extractQuestions` mode:full) to mine questions + rubrics — surfacing per-page
upload state, long-running extraction progress, and per-question
`extractionConfidence` / `readabilityIssue` flags before advancing to the
questions editor._

---

## 1. Purpose & primary user

**Primary user:** Teacher (or tenant Admin acting as teacher). Role-gated to
staff with `exams:write` on the tenant; never students or parents.

**Job-to-be-done:** _"I have a scanned PDF/photos of the exam paper. I want to
hand it to AutoGrade, have it pull out every question and a sensible rubric
automatically, and confirm the machine read each page correctly — without
re-typing 20 questions by hand."_

This is the **Upload step** of the exam-creation wizard (and the equivalent
action on an existing exam-detail page). It is the bridge between raw scanned
images and a structured `ExamQuestion[]` subcollection. The screen's two
responsibilities:

1. **Ingest** — drag/drop or capture scanned pages into a managed, reorderable
   upload queue (`Exam.questionPaper.images`).
2. **Extract** — run the Gemini extraction pipeline, show its long-running
   progress (up to a **540s budget**), and let the teacher validate output
   quality (confidence + readability) before committing to the editor.

The teacher must leave this screen trusting that _every_ question was captured
and that any low-confidence / unreadable page is visibly flagged for their
attention.

---

## 2. Entry points & route

**Routes:**

- `/exams/new` — wizard **Upload step** (step 2 of: Metadata → Upload → Review →
  Publish). Reached after `saveExam` creates the draft `Exam` (status `draft`).
- `/exams/:examId` — exam-detail **Questions tab** shows an "Upload question
  paper" action when `Exam.questionPaper` is absent or `status` is `draft` /
  `question_paper_uploaded`. Re-extract is reachable here too.

**Entry points:**

- "Continue" from the wizard Metadata step.
- "Upload question paper" CTA on a draft exam-detail page.
- "Re-extract" / "Add pages" action on an exam already at
  `question_paper_extracted` (re-runs full extraction or single-question
  `mode:single`).

**Common-API reads/writes** (see `specs/common-api.md`): | Action | Callable /
repo | Notes | |---|---|---| | Read current exam | `exams.get(examId)` (live) |
Drives `status`, `questionPaper`, `gradingConfig`. | | Save draft metadata /
images list | `saveExam` | Writes `questionPaper.images[]`, advances status
`draft → question_paper_uploaded`. Server-enforced status machine. | | Upload
image bytes | Storage upload → returns storage paths; `saveExam` persists paths.
`mapping.imageUrls`/image refs resolve to **HTTPS URLs from API**, not raw
Storage paths. | | Run extraction (all) |
`extractQuestions({ examId, mode: 'full' })` | Gemini QP → questions + rubric.
Long-running (540s budget). On success advances
`question_paper_uploaded → question_paper_extracted`. | | Re-extract one
question | `extractQuestions({ examId, mode: 'single', questionId })` | Re-runs
a single `ExamQuestion`. | | Read extracted questions | `questions`
subcollection via `exams.get` / questions repo (live) | Renders
`extractionConfidence`, `readabilityIssue`, `extractedBy`. |

All reads/writes are **tenant-scoped**; the per-tenant Gemini key powers
extraction. Region `asia-south1`.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). In the wizard, a horizontal
**wizard stepper** sits below the Topbar; on exam-detail this region is the
**Tabs** bar instead.

### Desktop (lg ≥ 1024) — two-column working surface

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Topbar: tenant switcher · search · ⌘K · notifications · profile           │
├───────────────┬───────────────────────────────────────────────────────────┤
│ Sidebar (nav) │ Breadcrumb: Exams / New / Upload paper                     │
│  Exams ◀      │ ┌ Wizard stepper ─────────────────────────────────────┐   │
│  Spaces       │ │ ① Metadata ──── ②•Upload ──── ③ Review ──── ④ Publish│   │
│  Analytics    │ └──────────────────────────────────────────────────────┘   │
│  AI Usage     │                                                             │
│               │  h2  "Upload question paper"   [Badge: status]             │
│               │  caption: "Drop scanned pages — AI extracts questions."    │
│               │                                                             │
│               │ ┌── LEFT (Panel, ~38%) ──┐ ┌── RIGHT (Panel, ~62%) ─────┐ │
│               │ │  FileDrop zone          │ │  Extraction results / state │ │
│               │ │  ┌────────────────────┐ │ │  ┌── ScanFrame guidance ──┐ │ │
│               │ │  │  ⬆ Drag pages here │ │ │  │ (pre-extract: quality  │ │ │
│               │ │  │  or browse · JPG/  │ │ │  │  tips + ScanFrame demo) │ │ │
│               │ │  │  PNG/PDF · ≤20MB   │ │ │  └────────────────────────┘ │ │
│               │ │  └────────────────────┘ │ │                             │ │
│               │ │                         │ │  (post-extract: question    │ │
│               │ │  Upload queue:          │ │   list w/ confidence +      │ │
│               │ │  ▸ UploadQueueItem p.1  │ │   readability flags)        │ │
│               │ │    [thumb] done ✓ ⠿drag │ │  ┌─ Q1  maxMarks 5 ──────┐  │ │
│               │ │  ▸ UploadQueueItem p.2  │ │  │ ConfidenceBadge high   │  │ │
│               │ │    [thumb] 64% ▓▓░ ✕    │ │  │ text preview… [Re-extr]│  │ │
│               │ │  ▸ UploadQueueItem p.3  │ │  └────────────────────────┘  │ │
│               │ │    [thumb] ⚠ readability│ │  ┌─ Q2 ⚠ readabilityIssue ┐  │ │
│               │ │                         │ │  │ ConfidenceBadge low →   │  │ │
│               │ │  + Add pages            │ │  │ "review page" [Re-extr] │  │ │
│               │ └─────────────────────────┘ │  └────────────────────────┘  │ │
│               │                             └─────────────────────────────┘ │
│               │ ┌ Sticky action bar ────────────────────────────────────┐  │
│               │ │ [Back]              [Extract questions ▸] (or Continue)│  │
│               │ └────────────────────────────────────────────────────────┘  │
└───────────────┴───────────────────────────────────────────────────────────┘
```

- **Left Panel** = ingestion (FileDrop + reorderable upload queue of
  `UploadQueueItem`). Page order maps to `questionPaper.images[]` order.
- **Right Panel** = extraction. _Before_ extraction: ScanFrame quality
  guidance + a primary "Extract questions" CTA. _During_: a centered progress
  block (ProgressBar/ProgressRing + per-page thumbnail strip lighting up).
  _After_: the extracted question list with `ConfidenceBadge` + readability
  chips per `ExamQuestion`.
- **Sticky action bar** pins Back/Extract/Continue at the bottom of the content
  column.

### Tablet (md 768–1023) — stacked Panels

FileDrop + upload queue Panel on top; extraction Panel below. Action bar stays
sticky. Question result cards go single-column.

### Mobile (sm < 768) — single column, sheet-driven

- FileDrop becomes a tappable capture tile ("Add pages") that opens the OS
  file/camera picker; on future scanner-web/RN it opens **ScanFrame** live
  camera.
- Upload queue = vertical stacked `UploadQueueItem` cards.
- Extraction progress and the question result list are full-width stacked cards.
- Action bar collapses to a single full-width primary button (`Extract` → then
  `Continue`); Back lives in the Topbar/Breadcrumb.

---

## 4. Components used (Lyceum inventory)

**Navigation / shell:** AppShell, Sidebar, Topbar, Breadcrumb, Tabs
(exam-detail), CommandPalette (⌘K, web only).

**Containers:** Panel (left ingest / right extract), Card (per-question result),
Section, Sheet (mobile picker), Modal/Dialog (re-extract confirm,
destructive-replace confirm), Tooltip, Popover (quality-tip explainer).

**Primitives:** FileDrop (multi-file JPG/PNG/PDF), Button (`primary`
Extract/Continue, `secondary` Back/Add pages, `ghost` Re-extract per card,
`danger` Remove page), IconButton (drag-handle, remove, retry).

**Data / feedback:** ProgressBar + ProgressRing (extraction + per-file upload),
Skeleton (loading), EmptyState (no pages yet), Badge (exam `status`), Chip/Tag
(`readabilityIssue`, `extractedBy: ai|manual`), Stat/KPI ("18 questions · 75
marks" summary), Toast (sonner), InlineAlert/Banner (extraction failure,
partial, budget warning), ConfirmDialog, LoadingOverlay (during the
`extractQuestions` round-trip blocking the action bar).

**Domain components:**

- **FileDrop** + **`UploadQueueItem`** — each queued page: thumbnail, page index
  label (mono), upload progress, done/error state, drag-to-reorder handle,
  remove. (`UploadQueueItem` carries an offline/queued visual that matters most
  on scanner-web/RN.)
- **`ScanFrame`** — pre-extraction guidance card showing the camera-guide
  framing + quality checklist (lighting, full page, no skew). On web today it's
  an illustrative guide; on scanner-web/RN it's the live capture frame.
- **`ConfidenceBadge`** — per extracted question, bound to
  `ExamQuestion.extractionConfidence` (low/med/high scale).
- **`ContentRenderer`** — renders extracted `ExamQuestion.text` (Markdown +
  KaTeX) in each result card so math/diagrams preview faithfully.
- **`QuestionCard`** (compact preview variant) — extracted-question result row.

**Proposed addition (justify):** **`ExtractionProgress`** — a domain composite
(ProgressRing + page-thumbnail strip + elapsed mono timer + step label "Reading
page 3 of 6…") tuned for the 540s long-running extraction. Justification:
existing ProgressBar/Skeleton don't convey _which page_ is being read or
_elapsed vs. budget_; this is reused by re-extract and by submission
scouting/grading progress, so it earns a named domain component rather than
ad-hoc composition. Add to the foundation domain inventory.

---

## 5. States

| State                         | Trigger                                                               | UI                                                                                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading (initial)**         | `exams.get` in flight                                                 | Skeleton for both Panels: skeleton FileDrop block, 3 skeleton queue rows, skeleton right-panel card.                                                                                                                   |
| **Empty (no pages)**          | `questionPaper` absent / `images` empty                               | Left: prominent FileDrop with EmptyState copy. Right: ScanFrame guidance + disabled "Extract questions" (needs ≥1 page).                                                                                               |
| **Uploading (partial)**       | files transferring to Storage                                         | Each `UploadQueueItem` shows ProgressRing %; "Extract" disabled until all uploads resolve (no in-flight uploads).                                                                                                      |
| **Uploaded, pre-extract**     | all pages uploaded, status `question_paper_uploaded`                  | Right Panel shows page count Stat + ScanFrame tips; "Extract questions" enabled (`primary`).                                                                                                                           |
| **Extracting (long-running)** | `extractQuestions` running                                            | `ExtractionProgress` in right Panel: ProgressRing, elapsed mono timer vs **540s** budget, "Reading page N of M". Action bar shows LoadingOverlay; left Panel locked (no add/remove/reorder mid-run).                   |
| **Budget-warning**            | elapsed > ~80% of 540s                                                | InlineAlert (`status.warning`): "Extraction is taking longer than usual — large/dense papers can take up to 9 minutes." No auto-cancel.                                                                                |
| **Success**                   | extraction returns, status `question_paper_extracted`                 | Right Panel = extracted question list (QuestionCard previews) each with `ConfidenceBadge` + readability chip; Stat header "N questions · M marks". Toast success. "Continue" replaces "Extract".                       |
| **Partial / low-confidence**  | some questions `extractionConfidence` low or `readabilityIssue: true` | Those cards get `confidence.low` `ConfidenceBadge` + amber `readabilityIssue` chip + per-card "Re-extract" / "Edit manually" affordance. Banner: "K questions need a quick check." Continue allowed but nudges review. |
| **Extraction failed**         | callable error / Gemini error                                         | Right Panel InlineAlert (`status.error`): cause + "Retry extraction" (`primary`) + "Edit manually" fallback. Exam stays `question_paper_uploaded`.                                                                     |
| **Timeout / budget exceeded** | exceeded 540s, no result                                              | Error variant: "Extraction timed out. Try fewer/clearer pages or extract in parts." Retry + manual fallback.                                                                                                           |
| **Re-extracting single**      | `extractQuestions mode:single`                                        | Only that QuestionCard shows inline `ExtractionProgress`; rest interactive.                                                                                                                                            |
| **Permission-gated**          | user lacks `exams:write`                                              | Whole screen read-only: FileDrop/queue/actions hidden or disabled with Tooltip "You don't have permission to edit exams." Students/parents never routed here (tenant + role guard).                                    |
| **Post-publish lock**         | exam already `published`+                                             | Upload/extract disabled; InlineAlert: "Questions are locked after publishing." (server `POST_PUBLISH_LOCKED_FIELDS`).                                                                                                  |

---

## 6. Interactions & motion

**Add pages.** Drop/select files → optimistic `UploadQueueItem` cards append
immediately (`ease.entrance`, `fast 160ms` fade+rise) with ProgressRing; each
resolves to done ✓ or error ✕. Storage failures keep the item with a `danger`
retry IconButton. Toast on full-batch completion.

**Reorder.** Drag-handle reorders queue; page index labels re-number live. Drop
commits new `questionPaper.images[]` order via `saveExam` (debounced). Reorder
is disabled during extraction.

**Remove page.** `danger` IconButton → if pages already extracted, ConfirmDialog
("Removing a page may require re-extraction."). Otherwise immediate, with an
undo Toast (`base 220ms`).

**Trigger extraction.** "Extract questions" → action bar enters LoadingOverlay;
right Panel cross-fades (`base 220ms`, `ease.standard`) from ScanFrame guidance
to `ExtractionProgress`. Page-thumbnail strip lights each thumbnail as it's
read. Elapsed timer ticks in Spline Sans Mono. This is **server-authoritative**:
progress reflects pipeline state, not a fake client animation.

**On success.** `ExtractionProgress` cross-fades to the question list; cards
stagger in (`fast 160ms`, `ease.entrance`, reduced-motion → simple fade).
Success Toast "Extracted N questions." Action bar primary flips to "Continue ▸".
**No celebratory spark** — this is precision staff work, not gamification;
reserve the marigold burst for student XP only.

**Re-extract one.** Per-card "Re-extract" → inline confirm Popover (if it'd
overwrite manual edits) → that card shows `ExtractionProgress`; on return it
morphs back with updated text + `ConfidenceBadge`.

**Confirmations / guards:** destructive replace of an extracted paper, removing
extracted pages, and overwriting manual edits each gate behind ConfirmDialog.
Extraction failure never silently discards uploaded images.

All motion respects `prefers-reduced-motion` (cross-fades → instant opacity, no
stagger). Timings cite `instant 100 / fast 160 / base 220 / slow 320 / page 420`
and `ease.standard / entrance / exit`.

---

## 7. Content & copy (precise, staff tone)

**Headings:** h2 "Upload question paper" · sub-caption "Drop your scanned pages
— AutoGrade reads them and pulls out each question and rubric."

**FileDrop:** "Drag question-paper pages here, or browse" · helper "JPG, PNG or
PDF · up to 20 MB per file · keep pages in order."

**ScanFrame quality tips:** "For the cleanest read: good lighting · the full
page in frame · flat, not skewed · text in focus."

**Empty state:** title (Fraunces) "No pages yet" · body "Add the scanned
question paper to get started. You can reorder pages before extracting."

**Primary actions:** "Extract questions" → (post-success) "Continue" · secondary
"Add pages", "Back", "Re-extract".

**Progress copy:** "Reading page {n} of {m}…" · timer "{elapsed} / up to 9:00" ·
warning "Dense papers can take up to 9 minutes — hang tight."

**Success Toast:** "Extracted {n} questions · {marks} marks." · Banner (partial)
"{k} question(s) need a quick check — low confidence or a hard-to-read page."

**Per-question flags:** ConfidenceBadge labels (always icon + word) "High
confidence" / "Check" / "Review" — **never color alone**. Readability chip:
"Hard to read".

**Error copy:**

- Generic: "Extraction couldn't finish. Your pages are saved. Try again, or add
  questions manually."
- Timeout: "Extraction timed out. Try fewer or clearer pages, or extract in
  parts."
- Quota/key: "AI grading is unavailable for your school right now. Contact your
  admin or add questions manually."
- Upload fail: "Couldn't upload page {n}. Retry?"

Tone: precise, blame-free, always offering the **manual fallback** so the
teacher is never blocked.

---

## 8. Domain rules surfaced

- **Answer-key / model-answer never leaks.** Extracted `rubric` (incl.
  `modelAnswer`, `evaluatorGuidance`) is staff-only — this whole route is
  role-gated; nothing here is ever rendered to students/parents. `AnswerKeyLock`
  semantics apply downstream.
- **Server-authoritative status machine.** Status transitions
  (`draft → question_paper_uploaded → question_paper_extracted`) are owned by
  `saveExam` / `extractQuestions`, never set client-side. The status `Badge`
  reflects server truth.
- **Tenant isolation.** Every read/write is tenant-scoped; extraction uses the
  **per-tenant Gemini key**. No cross-tenant page or exam is reachable.
- **Post-publish field locks.** Once `published`, question-paper images and
  extraction are immutable (`POST_PUBLISH_LOCKED_FIELDS`); UI disables +
  explains rather than failing silently.
- **Confidence as first-class.** `extractionConfidence` maps to the platform
  `confidence.low/med/high` scale and visibly drives "which question to
  double-check," foreshadowing the same human-in-the-loop routing used in
  grading review.
- **Provenance.** `extractedBy: ai|manual` is shown so teachers know what the
  machine produced vs. what they edited; re-extract overwrites are confirmed to
  protect manual work.
- **Long-running budget honesty.** The 540s budget is surfaced (elapsed vs. cap)
  instead of pretending it's instant.
- **`mapping.imageUrls` resolve to HTTPS** from the API, not raw Storage paths —
  thumbnails use resolved URLs.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → wizard stepper → FileDrop (focusable,
  Enter/Space opens picker) → each `UploadQueueItem` (reorder via keyboard:
  focus handle, ↑/↓ to move, with `aria-live` announcing "Page 2 moved to
  position 1") → "Extract questions" → result cards → action bar.
- **FileDrop a11y:** real `<input type=file>` behind it; full keyboard operable;
  drop zone has `aria-label` and announces accepted/rejected files via
  `aria-live="polite"`.
- **Progress:** `ExtractionProgress` uses `role="progressbar"` with
  `aria-valuenow/min/max`; the "Reading page n of m" step is announced via
  `aria-live="polite"` (throttled, not every tick) so screen-reader users hear
  advancement without spam.
- **Status never by color alone:** `ConfidenceBadge` and `readabilityIssue`
  chips always pair icon + text label; all pairs meet WCAG AA (4.5:1 text, 3:1
  UI/large).
- **Errors:** InlineAlert is `role="alert"`; retry buttons are reachable and
  labeled. FormFieldError-style messaging tied to the offending page.
- **Reduced motion:** `prefers-reduced-motion` disables cross-fades/staggers
  (instant opacity), keeps progress as a static-updating bar.
- **Touch:** all controls ≥44px; drag-handle has an accessible non-drag
  alternative (kebab menu: "Move up / Move down / Remove").
- **Modals/Dialogs:** focus-trapped, Esc-dismiss, return focus to trigger.

---

## 10. Web ↔ mobile divergence

| Aspect              | teacher-web (today)                               | Future RN / scanner-web                                                                                      |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Layout              | Two-column Panels (FileDrop + queue ‖ extraction) | Single-column stacked cards; sheet-driven pickers                                                            |
| Ingest              | FileDrop (drag/drop + browse), file picker        | **ScanFrame live camera** capture; multi-shot; `UploadQueueItem` shows **offline/queued** status prominently |
| Reorder             | Drag-handle + keyboard                            | Long-press drag; kebab move up/down                                                                          |
| Hover affordances   | Hover popovers for quality tips                   | Press → Popover/Sheet; no hover                                                                              |
| Command palette     | ⌘K available                                      | None                                                                                                         |
| Extraction progress | `ExtractionProgress` panel                        | Full-screen progress sheet; resilient to backgrounding (server-authoritative, resumes on return)             |
| Tables/lists        | (no dense table here)                             | Same card model — already card-based, minimal divergence                                                     |
| Upload source       | persists `uploadSource: 'web'` (paper images)     | scanner-web persists `uploadSource: 'scanner'`                                                               |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only the
renderer differs. `UploadQueueItem`'s offline status is largely inert on web but
load-bearing on scanner-web/RN.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for "Auto-LevelUp" using our in-house design system
"Lyceum" (Modern Scholarly). Conform EXACTLY to the Lyceum foundation
(docs/rebuild-spec/design/00-FOUNDATION.md): cite tokens by NAME, never invent
colors/fonts/variants. Fonts: Fraunces (display/headings/empty-state titles),
Schibsted Grotesk (UI/body/labels/buttons/tables), Spline Sans Mono (timers,
scores, page indices, elapsed time). Warm paper bg.canvas/bg.surface, ink text,
brand.primary (indigo) for primary actions, spark (marigold) reserved for
gamification ONLY (do NOT use it here). Radius: cards lg, buttons/inputs md,
chips pill. Elevation e1 cards / e3 modals; focus ring indigo @35%. Motion:
instant100/fast160/base220/slow320/page420 with ease.standard/entrance/exit;
respect prefers-reduced-motion. Confidence scale: confidence.low/med/high —
NEVER status by color alone (always icon + label).

SCREEN: "Question Paper Upload & Extraction" — the Upload step of the exam-creation
wizard (route /exams/new) and the equivalent action on /exams/:examId. Primary user:
a teacher. Render inside AppShell (Sidebar + Topbar + Breadcrumb), with a wizard
stepper (Metadata → Upload → Review → Publish).

Build a two-column working surface (desktop lg):
- LEFT Panel "ingest": a FileDrop (JPG/PNG/PDF, ≤20MB) + a reorderable upload queue
  of UploadQueueItem cards (thumbnail, mono page index, upload ProgressRing, done/
  error state, drag handle, remove). "+ Add pages".
- RIGHT Panel "extract":
  * pre-extract: a ScanFrame quality-guidance card (lighting / full page / not skewed
    / in focus) + a primary "Extract questions" button (disabled until ≥1 page uploaded).
  * extracting (long-running, up to a 540s budget): an ExtractionProgress composite —
    ProgressRing + a page-thumbnail strip lighting up + an elapsed-vs-budget mono timer +
    "Reading page n of m…". Show a status.warning InlineAlert past ~80% of budget.
  * success: a list of extracted-question preview cards (QuestionCard + ContentRenderer
    for md+KaTeX text), each with a ConfidenceBadge (extractionConfidence) and an amber
    "Hard to read" chip when readabilityIssue is true, plus per-card "Re-extract".
    Header Stat: "N questions · M marks".
- A sticky bottom action bar: [Back]  [Extract questions ▸] (becomes [Continue ▸] after
  success).

Show these states: loading (Skeleton), empty (EmptyState in FileDrop), uploading
(partial, Extract disabled), uploaded/pre-extract, extracting, budget-warning, success,
partial/low-confidence (banner "K questions need a quick check"), extraction-failed
(status.error InlineAlert + Retry + "Edit manually" fallback), and a read-only
post-publish-locked variant.

Domain rules to honor in the UI: extracted rubrics/model-answers are STAFF-ONLY (never
student-facing); status (draft → question_paper_uploaded → question_paper_extracted) is
SERVER-authoritative shown as a Badge; extraction is long-running and honest about its
540s budget; provenance shown via extractedBy ai|manual; post-publish fields are locked;
always offer a manual fallback so the teacher is never blocked.

Tone: precise, blame-free, staff-facing (no playful copy). Accessibility: keyboard-
operable FileDrop + reorder, role="progressbar" with aria-live page announcements,
status never by color alone, WCAG AA, ≥44px touch targets, reduced-motion fallbacks.

Deliver responsive layouts for lg (two-column), md (stacked Panels), and sm (single
column, sheet-driven picker). Use ONLY Lyceum components: AppShell, Sidebar, Topbar,
Breadcrumb, Tabs, Panel, Card, FileDrop, Button, IconButton, ProgressBar, ProgressRing,
Skeleton, EmptyState, Badge, Chip, Stat, Toast, InlineAlert, ConfirmDialog,
LoadingOverlay, Tooltip, Popover, plus domain components UploadQueueItem, ScanFrame,
ConfidenceBadge, ContentRenderer, QuestionCard, and the proposed ExtractionProgress.
```
