# Answer Sheet Upload

_Teacher/scanner workflow to attach a student's scanned answer-sheet pages to an
exam and create a Submission that auto-starts the AutoGrade pipeline (Panopticon
scouting → RELMS grading → confidence-routed review)._

---

## 1. Purpose & primary user

**Primary user:** Teacher (or a `scanner` role operator at an intake station)
for a single tenant. **Job-to-be-done:** "I have a stack of scanned answer
sheets for a published exam; I need to get each student's pages into the system,
mapped to the right student, so AI grading starts without me babysitting it."

This screen is the **intake gate** for the grading pipeline. It does not grade,
score, or review — it validates identity (class + student + ≥1 readable page),
uploads images, and fires the `uploadAnswerSheets` callable, which creates a
`Submission` with `pipelineStatus = uploaded` and triggers the downstream
pipeline server-side. The user's success criterion is "every student in this
stack has a queued submission with no upload errors."

Two modes from the same screen:

- **Per-student** — pick one student, drop their pages, upload (the common case
  at a teacher's desk).
- **Bulk** — queue several students' page-sets in one session, upload
  sequentially (intake station, end-of-exam batch).

---

## 2. Entry points & route

**Route:** `/exams/:examId/submissions` in **upload sub-mode** — opened as a
Drawer/Sheet or full-page intake view layered over the submissions list (see
§3). Entered via:

- **"Upload answer sheets"** primary button on `/exams/:examId/submissions` (the
  Submissions list/table).
- **"Upload submissions"** action in the status-action cluster on
  `/exams/:examId` (exam detail), available once `Exam.status` is `published` or
  later (`grading`, `completed`).
- Deep link from a dashboard "X submissions pending" InsightCard.
- (Future) the separate **scanner-web** intake app calls the **same**
  `uploadAnswerSheets` callable with `uploadSource = scanner`; this screen is
  the `uploadSource = web` path.

**Common-API reads/writes** (see `specs/common-api.md`):

- `exams.get(examId)` — load `Exam` for `title`, `classIds`, `sectionIds?`,
  `totalMarks`, `status`, and `gradingConfig` (to surface auto-start behavior).
  Read is tenant-scoped.
- **Class/student roster read** — students for the picker come from the roster
  repo filtered to `Exam.classIds` (and `sectionIds` if set):
  `students.listByClass(classId)` returning `studentId`, `studentName`,
  `rollNumber`. Tenant-scoped.
- `submissions.listLive(examId)` — live read of existing `Submission`s to (a)
  detect duplicates (student already has a submission) and (b) reflect
  newly-created submissions appearing with
  `pipelineStatus = uploaded → scouting`.
- **Storage upload** — page images are uploaded to tenant-scoped Storage paths
  first (client → Storage), yielding storage paths.
- **`uploadAnswerSheets` callable (write)** — payload
  `{ examId, classId, studentId, studentName, rollNumber, answerSheets: { imagePaths[], uploadSource: 'web' }, }`.
  Server creates the `Submission` doc (`answerSheets.images[]`, `uploadedAt`,
  `uploadedBy`, `uploadSource`), sets `pipelineStatus = uploaded`, and the
  create-trigger kicks off scouting. Returns `{ submissionId, pipelineStatus }`.
  `scanner` role is permitted to call this with `uploadSource = 'scanner'`.

No grading/answer-key data is read or written here.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). The upload experience is a
right-side **Drawer/Sheet** (lg/md) over the Submissions list, or a **full-page
Sheet** (sm). Breadcrumb: `Exams / {Exam.title} / Submissions / Upload`.

### lg (≥1024) — Drawer over list, two-pane intake

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant · search · notifications · profile)                  │
│         ├──────────────────────────────────────────────────────────────────── │
│         │ Breadcrumb: Exams / Midterm – Physics / Submissions / Upload         │
│         │ ┌─ Submissions list (dimmed under drawer) ──────────────────────┐    │
│         │ │ DataTable: roll · student · status · score                    │    │
│         │ └───────────────────────────────────────────────────────────────┘    │
│  ┌──────────────── Drawer/Sheet  (width 560, e3, slides from right) ────────┐  │
│  │ Header:  Upload answer sheets        [Bulk ▢]            [✕ close]        │  │
│  │ Exam chip: Midterm – Physics · /100 · status: published                  │  │
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │ STEP 1 — Identify                                                         │  │
│  │  Class    [ Select  ▾  10-A ]                                             │  │
│  │  Student  [ Combobox  ▾  search roll / name … ]                          │  │
│  │           ↳ #23 · Aarav Mehta            (✓ no existing submission)       │  │
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │ STEP 2 — Pages                                                            │  │
│  │  ┌─ FileDrop ───────────────────────────────────────────────────────┐    │  │
│  │  │   ScanFrame guide ▢   Drop scanned pages or browse                 │    │  │
│  │  │   JPG/PNG/PDF · multi-page · keep pages in order                   │    │  │
│  │  └───────────────────────────────────────────────────────────────────┘    │  │
│  │  UploadQueueItem list (reorderable):                                      │  │
│  │   ▤ p1.jpg  ████████ done   1.2MB  ✓ readable      [↑][↓][✕]            │  │
│  │   ▤ p2.jpg  ████░░░░ 48%    0.9MB                   [↑][↓][✕]            │  │
│  │   ▤ p3.jpg  ⚠ low quality — may be unreadable       [↑][↓][✕][retry]    │  │
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │ InlineAlert (info): Grading starts automatically after upload.           │  │
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │ Footer:  [Add another student]            [Cancel]  [Upload & start ▸]    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
```

When **Bulk** is on, STEP 1 + STEP 2 collapse into a per-student **Accordion**
stack; each row is one student's identity + page queue; footer reads **"Upload
all (N) & start ▸"** with an aggregate ProgressBar.

### md (768–1023) — Sheet at ~80% width, single column

Same regions, full-width fields, queue items stack with controls in an overflow
Popover (`⋯`) to preserve touch targets. Submissions list fully obscured.

### sm (<768) — full-page Sheet, mobile-first

Single column, page gutter 16. Header collapses exam chip into a one-line
summary. FileDrop becomes **"Add pages"** (file picker / future camera).
UploadQueueItem rows become stacked cards. Footer is a sticky action bar
(`Upload & start`) pinned bottom, ≥44px. Bulk mode uses a full Accordion; the
active student auto-expands.

---

## 4. Components used

From the Lyceum inventory (§5):

- **AppShell**, **Sidebar**, **Topbar**, **Breadcrumb** — chrome.
- **Drawer/Sheet** — the intake container (full-page on sm).
- **Section**, **Accordion** (bulk per-student rows), **Card** (mobile queue
  rows).
- **Select** — Class picker (options from `Exam.classIds`).
- **Combobox** — Student picker, searchable by `rollNumber` / `studentName`.
- **FileDrop** — multi-file drop/browse (JPG/PNG/PDF).
- **UploadQueueItem** (domain) — per-page row: thumbnail, filename, ProgressBar,
  size, quality flag, reorder/remove/retry. Carries offline/queued status.
- **ScanFrame** (domain) — capture/alignment guidance affordance inside FileDrop
  (and the camera surface on future mobile/scanner).
- **ProgressBar** — per-file and bulk aggregate progress.
- **InlineAlert/Banner** — "Grading starts automatically", quota/error notices.
- **Button** (primary `Upload & start`, secondary `Add another student`, ghost
  `Cancel`), **IconButton** (reorder/remove/retry/close).
- **Badge / Chip** — exam status chip, `uploadSource` chip, "no existing
  submission" / "already submitted" flags.
- **Stat/KPI** — bulk session counter (queued / uploaded / failed).
- **Toast (sonner)** — success/failure confirmations.
- **ConfirmDialog** — overwrite/duplicate confirmation; close-with-unsaved-queue
  guard.
- **Skeleton**, **EmptyState**, **LoadingOverlay**, **FormFieldError**.
- **Tooltip** — quality-flag explanation, disabled-button reason.

**Proposed addition (justify):** none required. `UploadQueueItem` already
specifies offline status; its `quality flag` (readability warning, mirroring
`ExamQuestion.readabilityIssue`) and `reorder` affordance are treated as
in-scope variants of that component rather than new components — noted here so
the component spec captures them.

---

## 5. States

**Loading.** Drawer opens immediately; STEP 1 fields show **Skeleton** while
`exams.get` + class roster resolve. Exam chip skeletonized until `Exam` loads.

**Empty.**

- _No classes on exam:_ EmptyState "This exam has no classes assigned" + link to
  exam Settings to assign `classIds`; upload disabled.
- _Class chosen, no roster:_ Combobox empty state "No students found in 10-A" +
  retry.
- _No pages yet:_ FileDrop is the resting empty state with ScanFrame guidance
  copy.

**Partial.**

- _Some files uploaded to Storage, some still uploading:_ aggregate ProgressBar;
  `Upload & start` disabled until all in-queue files reach `done` (or user
  removes the pending ones).
- _Low-quality page flagged:_ amber **warning** UploadQueueItem (status.warning,
  icon + label) — non-blocking; Tooltip explains AI may struggle and routing may
  push it to `needs_review`.
- _Bulk: one student fails, others succeed:_ per-row status; session Stat shows
  `uploaded N · failed M`; failed rows keep a **Retry** action; succeeded rows
  lock with a `submissionId` + "scouting started" chip.

**Error.**

- _Storage upload failure (one file):_ that UploadQueueItem turns **error**
  (status.error) with Retry; does not block other files.
- _`uploadAnswerSheets` callable failure:_ InlineAlert at footer with reason
  (network / permission / quota) + Retry; nothing is half-created (server create
  is atomic per submission).
- _Quota/budget pressure (EvaluationSettings.usageQuota warning ≥
  warningThresholdPercent):_ non-blocking InlineAlert "Tenant grading budget at
  84% — uploads still allowed; grading may queue."
- _Duplicate:_ if `submissions.listLive` shows this student already has a
  submission → ConfirmDialog "Aarav Mehta already has a submission for this
  exam. Add another (creates a separate submission) or Cancel."

**Success.** Toast "Submission created — grading started for Aarav Mehta (#23)."
Drawer either resets STEP 2 (if "Add another student" flow) or closes; the
Submissions list shows the new row transitioning `uploaded → scouting`. Bulk
success Toast: "12 submissions created — grading started."

**Permission / role-gated.**

- **Teacher (creator/tenant teacher):** full screen.
- **scanner role:** identical intake, but the screen is reached via scanner-web
  (future) and writes `uploadSource = 'scanner'`; the exam status chip and
  roster are read-only; no navigation to grading/review.
- **Exam not yet `published`** (`draft`, `question_paper_uploaded`,
  `question_paper_extracted`): entry button disabled with Tooltip "Publish the
  exam before uploading answer sheets." Server also rejects.
- **Read-only roles (parent/student):** no access; route guarded;
  answer-key/grading surfaces are never part of this screen regardless.

---

## 6. Interactions & motion

**Open.** Drawer slides in from right (`ease.entrance`, `slow 320ms`); backdrop
fades (`base 220ms`). sm: full-page Sheet rises (`ease.entrance`).

**Identify.** Selecting Class (Select) repopulates the Student Combobox;
choosing a Student triggers a duplicate check against `submissions.listLive` and
renders a `✓ no existing submission` / `⚠ already submitted` Chip inline
(`fast 160ms` fade).

**Add pages.** Drop/browse adds UploadQueueItem rows with an `entrance` stagger
(`fast 160ms`, capped). Each row's **Storage upload starts immediately**
(optimistic queue): ProgressBar animates linearly to actual progress; on done, a
`✓ readable` check stamps in (`instant 100ms`). Reorder via drag or `↑/↓`
IconButtons updates page order (order is preserved in `answerSheets.images[]`).
Remove (`✕`) collapses the row (`exit`, `fast 160ms`).

**Upload & start.** Button enabled only when class + student + ≥1 file (all
`done`). On click → LoadingOverlay scoped to the Drawer footer (button →
spinner), calls `uploadAnswerSheets`. **Not optimistic for submission creation**
— we wait for the server `{ submissionId }` because the pipeline trigger is the
contract. On success: spring is NOT used (this is staff tooling, not
gamification — the celebratory spring+marigold is reserved for student XP only);
a subtle success Toast + footer state flip suffices.

**Bulk.** "Upload all" disables the footer, runs callables sequentially
(rate-friendly), advances the aggregate ProgressBar and the `uploaded/failed`
Stat per completion; each Accordion row flips to a locked "scouting started"
state as it resolves.

**Confirmations.**

- Closing with un-uploaded pages or queued-but-not-submitted students →
  ConfirmDialog "Discard queued pages?" (Modal e3, `base 220ms`).
- Duplicate student → ConfirmDialog before allowing a second submission.

**Reduced motion.** All slides/stagger/progress easing collapse to opacity-only
or instant per `prefers-reduced-motion`.

---

## 7. Content & copy

Tone: precise, operational, staff-facing — terse imperatives, no
encouragement-speak.

- **Drawer title:** "Upload answer sheets"
- **Exam chip:** `{Exam.title} · /{totalMarks} · {status}`
- **Step labels:** "1 — Identify", "2 — Pages"
- **Class field:** label "Class", placeholder "Select class"
- **Student field:** label "Student", placeholder "Search roll number or name…"
- **Identity flags:** "✓ No existing submission" / "⚠ Already submitted —
  uploading creates a separate submission"
- **FileDrop:** "Drop scanned pages or browse" · helper "JPG, PNG, or PDF ·
  multiple pages · keep pages in reading order."
- **ScanFrame guidance:** "Align the page within the frame · flat, well-lit,
  full margins visible."
- **Quality warning (UploadQueueItem):** "Low image quality — may be unreadable;
  AI may route this to review."
- **Auto-start InlineAlert:** "Grading starts automatically after upload. You'll
  review flagged questions on the Submissions tab."
- **Primary button:** "Upload & start" (bulk: "Upload all (N) & start")
- **Secondary:** "Add another student" · "Cancel"
- **Success Toast:** "Submission created — grading started for {studentName}
  (#{rollNumber})."
- **Bulk success:** "{N} submissions created — grading started."
- **Empty (no classes):** "This exam has no classes assigned. Assign classes in
  Settings to upload sheets."
- **Empty (no roster):** "No students found in {className}."
- **Error (upload):** "Couldn't upload {filename}. Check the file and retry."
- **Error (callable):** "Couldn't create the submission. {reason}. Retry."
- **Quota notice:** "Tenant grading budget at {pct}%. Uploads continue; grading
  may queue."
- **Disabled-pre-publish Tooltip:** "Publish the exam before uploading answer
  sheets."

---

## 8. Domain rules surfaced

- **Pipeline auto-start is the contract.** `uploadAnswerSheets` creates the
  `Submission` with `pipelineStatus = uploaded`; the create-trigger starts
  **Panopticon scouting** → RELMS grading. The InlineAlert makes this explicit
  so users don't look for a "start grading" button. We surface only meaningful
  states downstream; **vestigial `ocr_*` states are never shown.**
- **Server-authoritative status.** The client never sets pipeline status; it
  sends storage paths + identity and trusts the returned
  `{ submissionId, pipelineStatus }`. Submission creation is not optimistically
  rendered.
- **Answer key / rubric / model answer never appear here** (and never to
  students anywhere). This is pure intake; `UnifiedRubric`, `modelAnswer`, and
  any `UnifiedEvaluationResult` are out of scope for this surface — consistent
  with `AnswerKeyLock`.
- **Tenant isolation** on every read/write: `exams.get`, roster,
  `submissions.listLive`, Storage paths, and the callable are all tenant-scoped;
  a teacher can only upload for exams in their tenant.
- **Identity required.** Submission must carry `studentId`, `studentName`,
  `rollNumber`, `classId` (within `Exam.classIds`). Validation gates upload on
  class + student + ≥1 file.
- **uploadSource provenance.** `web` from this screen; the planned
  **scanner-web** intake hits the same callable with `scanner` — recorded on
  `Submission.answerSheets.uploadSource` for audit.
- **Confidence routing is downstream, not here** — but copy primes the user:
  low-quality pages are flagged because they're likely to grade below
  `confidenceThreshold (0.7)` and land in `needs_review`.
- **Post-publish field locks** (`POST_PUBLISH_LOCKED_FIELDS`, enforced by
  `saveExam`) are not edited here, but the exam-status gate (must be
  `published`+) reflects the same server-authoritative status machine.
- **`answerSheets.images[]` resolve to HTTPS URLs from the API**, not raw
  Storage paths, when later read in review.

---

## 9. Accessibility

- **Focus order:** Drawer open → focus title → Class Select → Student Combobox →
  FileDrop (operable via keyboard: Enter/Space opens browse) → queue items
  (reorder/remove reachable via Tab, `↑/↓` IconButtons keyboard-actuated) →
  InlineAlert → footer (Add another / Cancel / Upload & start). Focus trapped
  within Drawer; `Esc` triggers the discard ConfirmDialog (not silent close)
  when queue is dirty.
- **Keyboard:** Combobox full arrow/type-ahead/Enter; reorder via focused row +
  `↑/↓`; remove via `Delete`/button; all actions have visible focus ring
  (`border.focus`, 3px indigo @35%).
- **ARIA:** Drawer `role="dialog"` `aria-modal` `aria-labelledby`; FileDrop
  `aria-describedby` the format helper; each UploadQueueItem exposes
  `aria-label` "Page 2, uploading 48 percent" and quality warnings via
  `role="status"` (polite); aggregate progress via `aria-live="polite"` on the
  Stat counter; success/error Toasts announced.
- **Status never by color alone:** every state
  (done/uploading/warning/error/queued) pairs an **icon + text label**
  (FOUNDATION §2 rule). Quality warning is amber **and** "Low image quality"
  text + ⚠ icon.
- **Contrast:** all pairs WCAG AA; warning/error text on warm surfaces verified
  (status.warning/status.error tokens).
- **Touch targets ≥44px** on sm; reorder/remove move into a `⋯` Popover on md/sm
  to keep targets large.
- **Reduced motion:** honor `prefers-reduced-motion` — opacity/instant only.

---

## 10. Web↔mobile divergence

| Aspect              | teacher-web (today)                                      | Future RN teacher / scanner-web                                                                                                       |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Container           | Drawer/Sheet over Submissions DataTable                  | Full-screen Sheet / dedicated intake screen                                                                                           |
| File intake         | FileDrop (drag/drop + browse), ScanFrame as visual guide | **Camera capture** primary; ScanFrame is the live alignment overlay; FileDrop secondary                                               |
| Queue layout        | UploadQueueItem rows in a list, hover affordances        | Stacked Cards; press (no hover); swipe-to-remove                                                                                      |
| Reorder             | drag or `↑/↓` IconButtons                                | drag-handle / long-press reorder                                                                                                      |
| Offline             | online-assumed; queue retries on failure                 | **UploadQueueItem offline status** is first-class — pages queue locally and upload when connectivity returns; callable fired on flush |
| `uploadSource`      | `web`                                                    | `scanner` (scanner-web) / `web` (RN teacher)                                                                                          |
| Bulk                | Accordion stack + aggregate ProgressBar                  | sequential per-student capture flow                                                                                                   |
| ⌘K / CommandPalette | available in AppShell                                    | none on mobile (Tabbar nav)                                                                                                           |
| Confirm/Toast       | ConfirmDialog modal, sonner Toast                        | native sheet confirm, toast equivalent                                                                                                |

Component **names/props match 1:1** across `shared-ui`/`ui-native`; only
renderer + capture source differ.

---

## 11. Claude-design prompt

```
Design the "Answer Sheet Upload" screen for Auto-LevelUp's teacher-web app, conforming
EXACTLY to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md). Do not
invent tokens, fonts, or component variants — compose only from Lyceum. Cite tokens by
name (bg.canvas, bg.surface, brand.primary, status.warning, status.error, confidence.low/
med/high, border.focus, spark — and note spark/celebratory spring is FORBIDDEN here since
this is staff tooling, not student gamification). Type: Fraunces for the section/empty-
state titles, Schibsted Grotesk for labels/buttons/body, Spline Sans Mono for file sizes,
roll numbers, submissionId, and progress %.

Context (AutoGrade domain): A teacher or scanner operator uploads a student's scanned
answer-sheet pages for a published Exam to create a Submission. Calling the
`uploadAnswerSheets` callable (uploadSource 'web') creates a Submission with
pipelineStatus = 'uploaded', which server-side triggers the grading pipeline (Panopticon
scouting → RELMS grading → confidence-routed review). The screen does NOT grade or show
any answer key / rubric / model answer (those are never shown here or to students).

Build it as a right-side Drawer/Sheet (e3) over the Submissions DataTable on lg, an ~80%
Sheet on md, and a full-page Sheet on sm. Render inside AppShell (Sidebar + Topbar) with
Breadcrumb "Exams / {Exam.title} / Submissions / Upload".

Layout:
- Header: title "Upload answer sheets", a Bulk toggle (Switch), close IconButton, and a
  Badge/Chip showing "{Exam.title} · /{totalMarks} · {status}".
- STEP 1 — Identify: Select "Class" (options from Exam.classIds) and a searchable Combobox
  "Student" (by rollNumber / studentName). Inline Chip shows "✓ No existing submission" or
  "⚠ Already submitted" from a live submissions read.
- STEP 2 — Pages: a FileDrop ("Drop scanned pages or browse", JPG/PNG/PDF, multi-page) with
  ScanFrame alignment guidance, followed by a reorderable list of UploadQueueItem rows
  (thumbnail, filename, ProgressBar, size in mono, readable ✓ / low-quality ⚠ warning,
  reorder ↑↓, remove ✕, retry). Low-quality pages get a status.warning row with icon+label.
- An InlineAlert (status.info): "Grading starts automatically after upload."
- Footer: secondary "Add another student", ghost "Cancel", primary "Upload & start"
  (enabled only when class + student + ≥1 fully-uploaded file). Bulk mode collapses STEP 1+2
  into an Accordion of per-student rows with an aggregate ProgressBar and an
  uploaded/failed Stat counter; footer reads "Upload all (N) & start".

States to show: loading (Skeleton fields), empty (no classes / no roster), per-file
uploading + partial, low-quality warning, file error with Retry, duplicate-student
ConfirmDialog, callable error InlineAlert, quota-warning InlineAlert, and success (sonner
Toast "Submission created — grading started for {studentName} (#{rollNumber})", new row
appears in the list transitioning uploaded → scouting).

Rules: never render any answer key/rubric/grade; status is server-authoritative (don't
optimistically create the submission — wait for {submissionId}); every status uses icon +
label, never color alone; all pairs WCAG AA; tenant-scoped reads/writes. Respect
prefers-reduced-motion; motion uses ease.entrance for the Drawer (slow 320ms), fast 160ms
for row stagger, no celebratory spring. Radius lg cards / md inputs+buttons / pill chips;
warm-tinted elevation e1 cards, e3 drawer/modal; focus ring border.focus 3px indigo @35%.
Touch targets ≥44px; on sm, reorder/remove live in a ⋯ Popover.
```
