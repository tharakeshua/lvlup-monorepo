# Teacher-Web Autograde Flow — Frontend Audit

**Branch:** `feat/teacher-portal-latex-rendering` **Scope:** Audit the autograde
flow end-to-end from the frontend perspective. Document the contract the
frontend sends to / expects from the backend (callables + Firestore listeners),
and list UI-state issues. **Audit-only — no fixes yet.**

This document will be diff'd against the backend-team's CONTRACT REPORT to find
mismatches and drive a second-pass fix.

---

## 1. End-to-end UI Flow

```
ExamListPage  ──►  ExamCreatePage  ──►  ExamDetailPage  ──►  SubmissionsPage  ──►  GradingReviewPage
 (/exams)         (/exams/new)         (/exams/:id)         (/exams/:id/        (/exams/:id/
                                       Questions /          submissions)         submissions/:subId)
                                       Submissions /
                                       Settings)
```

| Step | User action                                                           | Page                             | Backend op                                                       |
| ---- | --------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| 1    | Browse / filter exams                                                 | `ExamListPage`                   | `useExams` listener                                              |
| 2    | Create exam — metadata, upload PDFs, review, publish                  | `ExamCreatePage` (4-step wizard) | Storage upload + `saveExam` (CREATE)                             |
| 3    | Land on detail; click "Extract Questions"                             | `ExamDetailPage` Questions tab   | `extractQuestions`                                               |
| 4    | Edit rubrics per question, click "Confirm & Publish"                  | `ExamDetailPage`                 | direct `updateDoc` on question + `saveExam` (status='published') |
| 5    | Navigate to submissions; upload answer sheets per student             | `SubmissionsPage`                | Storage upload + `uploadAnswerSheets`                            |
| 6    | Pipeline runs (scouting → grading), submission cards live-update      | `SubmissionsPage`                | listener on submissions collection                               |
| 7    | Click a submission → review per-question AI grade, override or accept | `GradingReviewPage`              | listeners + `gradeQuestion` + direct doc writes                  |
| 8    | Back to submissions, click "Release All Results"                      | `SubmissionsPage`                | `saveExam` (status='results_released')                           |

---

## 2. Frontend Contract Spec

For each backend touchpoint, this section documents **what the frontend SENDS**
and **what it EXPECTS back** (callable response shape and/or Firestore doc
fields the UI reads). All paths are absolute from repo root.

### 2.1 `saveExam` (callable)

**Frontend wrapper:** `callSaveExam` —
`packages/shared-services/src/autograde/exam-callables.ts:39-43` **Frontend
wrapper shape:** `SaveExamRequest = { id?, tenantId, data: {...} }` →
`SaveResponse = { id, created }` **Backend:**
`functions/autograde/src/callable/save-exam.ts:64-68` destructures the **same**
`{ id, tenantId, data }` shape via
`parseRequest(request.data, SaveExamRequestSchema)`. ✅ wrapper agrees with
schema.

**Invocations from frontend:**

| Call site                               | Mode            | Payload sent                                                                                                                                                | Cite                                                             |
| --------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `ExamCreatePage` final publish          | CREATE          | `{ tenantId, data: { title, subject, topics, classIds, totalMarks, passingMarks, duration, examDate, gradingConfig, questionPaperImages, linkedSpaceId } }` | `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx:105-126`    |
| `ExamDetailPage` "Publish"              | UPDATE / status | `{ id, tenantId, data: { status: "published" } }`                                                                                                           | `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx:361`        |
| `ExamDetailPage` "Release Results"      | UPDATE / status | `{ id, tenantId, data: { status: "results_released" } }`                                                                                                    | `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx:367`        |
| `ExamDetailPage` class edit             | UPDATE / field  | `{ id, tenantId, data: { classIds: next } }`                                                                                                                | `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx:448`        |
| `ExamDetailPage` link space             | UPDATE / field  | `{ id, tenantId, data: { linkedSpaceId } }`                                                                                                                 | `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx:473`        |
| `SubmissionsPage` "Release All Results" | UPDATE / status | `useReleaseResults({ tenantId, examId, classIds? })` → internally sends `{ id: examId, tenantId, data: { status: "results_released", classIds } }`          | `packages/shared-hooks/src/queries/useSubmissionMutations.ts:60` |

**Response expected by FE:** `{ id, created }` — only `id` is consumed (for
navigation after create). `created` is ignored.

**Status transitions FE attempts to drive (must satisfy
`VALID_STATUS_TRANSITIONS` on backend):**

- `question_paper_extracted → published` (via Publish button)
- `grading | completed | grading_complete | results_released → results_released`
  (via Release Results; backend allows from those listed valid statuses:
  `save-exam.ts:200-206`)

---

### 2.2 `extractQuestions` (callable)

**Frontend wrapper:** `callExtractQuestions` —
`packages/shared-services/src/autograde/exam-callables.ts:81-87` **Frontend
payload sent (ExamDetailPage):**

- Full extract: `{ tenantId, examId }` — `ExamDetailPage.tsx:375`
- Single re-extract: `{ tenantId, examId, mode: "single", questionNumber }` —
  `ExamDetailPage.tsx:403`

**Frontend response expected:**

- TypeScript wrapper types `questions: unknown[]` — `exam-callables.ts:72`. **FE
  does not consume the return value directly**; it triggers an immediate
  `getDocs` re-fetch of the questions subcollection after the callable resolves
  (`ExamDetailPage.tsx:377-381`). This means FE depends entirely on Firestore
  having the new docs visible by the time the callable resolves.

**Firestore docs FE expects after this call:**
`tenants/{tenantId}/exams/{examId}/questions/{n}` populated with
`{ text, maxMarks, order, rubric: { criteria: [...] }, questionType, extractionConfidence, readabilityIssue }`
— read at `ExamDetailPage.tsx:348-356`.

**FE expects parent exam doc to transition:** `status: question_paper_extracted`
(will be the next re-render via `useExam`).

---

### 2.3 `uploadAnswerSheets` (callable)

**Frontend wrapper:** `useUploadAnswerSheets` —
`packages/shared-hooks/src/queries/useSubmissionMutations.ts:18-36` **FE flow**
(`SubmissionsPage.tsx:108-145`):

1. Validate exam, class, student selection.
2. Upload N files to Storage at path:
   `tenants/{tenantId}/submissions/{examId}/{Date.now()}_{file.name}`
   (`SubmissionsPage.tsx:126`). Collect resulting full paths.
3. Send: `{ tenantId, examId, studentId, classId, imageUrls: storagePaths }`
   (`SubmissionsPage.tsx:132-138`).

**Response expected:** `{ submissionId }`. FE does not use it; instead relies on
the `useSubmissions` listener to surface the new submission card.

**Firestore docs FE expects:**

- New `tenants/{tenantId}/submissions/{id}` with: `pipelineStatus: 'uploaded'`,
  `summary { totalScore, maxScore, percentage, grade, questionsGraded, totalQuestions }`,
  `answerSheets.images`, `resultsReleased: false`, `studentName`, `rollNumber`,
  `classId`, `examId`.
- Exam doc: `stats.totalSubmissions++`, possibly `status: 'grading'`.

---

### 2.4 `gradeQuestion` (callable)

**Frontend wrapper:** `callGradeQuestion` / `useGradeQuestion` —
`exam-callables.ts:45-49`, `useSubmissionMutations.ts:38-55`

**Invocations from `GradingReviewPage`:**

| Action                 | Payload sent                                                                      | Cite                            |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| "AI Grade" button      | `{ tenantId, submissionId, examId, questionId, mode: "ai" }`                      | `GradingReviewPage.tsx:248-254` |
| Manual override submit | `{ tenantId, submissionId, examId, questionId, score, feedback, mode: "manual" }` | `GradingReviewPage.tsx:215-223` |

**Note:** FE sends `examId` for both modes. BE schema does **not** require it
(`grade-question.ts:29-59`); backend looks it up from the questionSubmission
doc. Harmless extra field, but worth confirming BE doesn't validate it strictly.

**Response expected by FE:** `{ success, updatedScore?, gradingStatus? }`. FE
does not consume the response directly — instead relies on the
`questionSubmissions` listener (`GradingReviewPage.tsx:142-152`) to render the
new score / gradingStatus.

**Firestore docs FE listens for after this call:**

- `tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{questionId}`
  with `gradingStatus`, `aiEvaluation`, `manualOverride`, `mapping`.
- `tenants/{tenantId}/submissions/{submissionId}` with `pipelineStatus`,
  `summary` aggregate.

---

### 2.5 Direct Firestore writes (not callables) — RISK ZONE

The frontend writes Firestore documents directly in two places, bypassing the
`gradeQuestion` callable's validation + audit-trail logic:

| Action                   | Doc written                               | Fields set                                                                                                                                        | Cite                            |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Bulk approve             | `questionSubmissions/{qId}` × N (batched) | `gradingStatus: 'manual'`, `reviewSuggested: false`, `manualOverride.overriddenBy`, `manualOverride.overriddenAt`, `updatedAt: serverTimestamp()` | `GradingReviewPage.tsx:293-328` |
| Bulk approve             | `submissions/{subId}`                     | `pipelineStatus: 'reviewed'`, `updatedAt`                                                                                                         | `GradingReviewPage.tsx:307-313` |
| Accept single AI grade   | `questionSubmissions/{qId}`               | `gradingStatus: 'manual'`, `reviewSuggested: false`, `updatedAt`                                                                                  | `GradingReviewPage.tsx:337-343` |
| Edit question text/marks | `exams/{examId}/questions/{qId}`          | `text`, `maxMarks`, `updatedAt`                                                                                                                   | `ExamDetailPage.tsx:420-423`    |
| Edit question rubric     | `exams/{examId}/questions/{qId}`          | `rubric`, `updatedAt`                                                                                                                             | `ExamDetailPage.tsx:391-394`    |

**Risk** — see Issue F-01 below.

---

### 2.6 Firestore listeners (read-side contracts)

| Hook / call site                              | Path                                                                 | Listener?                                   | Cite                                                       |
| --------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `useExam`                                     | `tenants/{tenantId}/exams/{examId}`                                  | NO — one-shot, 30s staleTime                | `packages/shared-hooks/src/queries/useExam.ts:12-18`       |
| `useExams`                                    | `tenants/{tenantId}/exams`                                           | NO — one-shot, 5m staleTime, filter clauses | `packages/shared-hooks/src/queries/useExams.ts:8-36`       |
| `useSubmissions`                              | `tenants/{tenantId}/submissions`                                     | NO — one-shot, 30s staleTime                | `packages/shared-hooks/src/queries/useSubmissions.ts:8-36` |
| Questions read in `ExamDetailPage`            | `tenants/{tenantId}/exams/{examId}/questions` ordered by `order` ASC | NO — `getDocs` one-shot                     | `ExamDetailPage.tsx:348-356`                               |
| Submission live update in `GradingReviewPage` | `tenants/{tenantId}/submissions/{submissionId}`                      | **YES — onSnapshot**                        | `GradingReviewPage.tsx:125-139`                            |
| QuestionSubmissions in `GradingReviewPage`    | `tenants/{tenantId}/submissions/{submissionId}/questionSubmissions`  | **YES — onSnapshot**                        | `GradingReviewPage.tsx:142-152`                            |
| Questions in `GradingReviewPage`              | `tenants/{tenantId}/exams/{examId}/questions`                        | NO — `getDocs` one-shot                     | `GradingReviewPage.tsx:110-121`                            |

**Doc fields the UI reads (expected from backend writers):**

- **`submissions/{id}`**: `pipelineStatus`, `pipelineError`, `retryCount`,
  `summary.{ totalScore, maxScore, percentage, grade, questionsGraded, totalQuestions, needsReviewCount }`,
  `studentName`, `rollNumber`, `classId`, `examId`, `answerSheets.images`,
  `resultsReleased`, `resultsReleasedAt`, `scoutingResult`.
- **`questionSubmissions/{qId}`**: `gradingStatus`,
  `aiEvaluation.{ score, confidence, strengths, weaknesses, rubricBreakdown, feedback }`,
  `manualOverride.{ score, reason, overriddenBy, overriddenAt, originalScore }`,
  `mapping.{ pageIndices, imageUrls, scoutedAt }`, `gradingError`,
  `reviewSuggested`, `retryCount`.
- **`exams/{id}`**: `status`, `title`, `subject`, `topics`, `classIds`,
  `totalMarks`, `passingMarks`, `duration`, `examDate`, `gradingConfig`,
  `questionPaper.images`, `linkedSpaceId`, `linkedSpaceTitle`,
  `stats.{ totalSubmissions, gradedSubmissions, avgScore, passRate }`.
- **`exams/{id}/questions/{n}`**: `text`, `maxMarks`, `order`,
  `rubric.criteria[]`, `questionType`, `extractionConfidence`,
  `readabilityIssue`.

---

### 2.7 Storage paths (write-side)

| FE upload path                                                                    | Trigger watches                                                                                           | Match?                                                                                                                                     |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tenants/{tenantId}/question-papers/{ts}_{name}` (`ExamCreatePage.tsx:84`)        | `tenants/{tenantId}/exams/{examId}/question-paper/{filename}` (`on-question-paper-upload.ts:15`)          | ❌ — trigger never fires for FE flow. FE relies on `saveExam` writing `questionPaper.images` from the `questionPaperImages` payload field. |
| `tenants/{tenantId}/submissions/{examId}/{ts}_{name}` (`SubmissionsPage.tsx:126`) | `tenants/{tenantId}/exams/{examId}/answer-sheets/{studentId}/{filename}` (`on-answer-sheet-upload.ts:20`) | ❌ — trigger never fires for FE flow. FE relies on `uploadAnswerSheets` callable. The trigger is the GCS / scanner alt-path.               |

**Implication:** the two Storage triggers are effectively dead code from the
teacher-web perspective. If the backend ever decides to move logic from the
callables into the triggers (or vice versa), the FE Storage paths will need to
change. Document this clearly so BE doesn't assume the trigger is exercised.

---

## 3. UI-State Issues (prioritized)

Severity: **P0** = breaks the flow / lost data; **P1** = stale or wrong UI state
on success path; **P2** = polish / missing feedback.

### P0 — Frontend bypasses `gradeQuestion` for bulk approve and accept-AI-grade

**Where:** `GradingReviewPage.tsx:293-328` (bulk approve), `:337-343` (accept
single) **Symptom:** Both flows write `gradingStatus: 'manual'` directly via
`updateDoc` / `writeBatch`, never calling the `gradeQuestion` callable.
**Consequences:**

1. **Submission summary not recomputed** — backend `gradeQuestion` (manual mode)
   recalculates
   `submission.summary.totalScore / percentage / grade / questionsGraded` inside
   a transaction (`grade-question.ts:103-157`). Direct FE writes leave the
   summary stale; it only re-aggregates if the `onQuestionSubmissionUpdatedV2`
   trigger fires and runs to completion.
2. **Audit trail incomplete** — bulk approve writes
   `manualOverride.overriddenBy/overriddenAt` but **does not capture
   `originalScore`** or `reason`. Backend's manual-mode override always stores
   `originalScore`.
3. **Score validation absent** — backend enforces `0 ≤ score ≤ maxMarks`
   (`grade-question.ts:68-72`). Direct FE writes can produce out-of-range
   values.
4. **Status taxonomy drift** — bulk approve sets
   `submission.pipelineStatus = 'reviewed'`. Verify this is in the BE state
   machine — the backend's `VALID_STATUS_TRANSITIONS` for the **exam** doc does
   not list `'reviewed'`, but for **submissions** the pipeline statuses come
   from `on-submission-updated.ts`. Cross-check against BE contract report.

**Action:** route both flows through `useGradeQuestion` mode='manual' (with
`score = currentAiScore` for accept, batched per question for bulk approve).

---

### P0 — `useExam` and `useSubmissions` are one-shot queries with multi-minute stale times

**Where:**

- `useExam` — 30s staleTime, no listener (`useExam.ts:18`)
- `useExams` — 5m staleTime (`useExams.ts:36`)
- `useSubmissions` — 30s staleTime (`useSubmissions.ts:36`)

**Symptom:** Long-running grading pipelines (scouting → grading → finalize can
take minutes) update Firestore docs that the UI never sees until the next
refetch tick or a manual reload. **Specifically affected:**

- `ExamDetailPage` displays `exam.status` and `stats` from `useExam`; while
  grading runs in the background, the status badge shows the cached value.
- `SubmissionsPage` submission cards show `pipelineStatus` from
  `useSubmissions`; the pipeline progress bar (`SubmissionsPage.tsx:515-540`)
  renders stale state.
- `ExamListPage` shows `stats.gradedSubmissions / avgScore` from `useExams`; can
  be 5 minutes out of date.

**Action:** convert at minimum `useExam` (single doc) to onSnapshot. For
`useSubmissions`, either snapshot or drop staleTime to near-zero with a manual
invalidation hook.

---

### P0 — Optimistic writes have no rollback

**Where:**

- `ExamDetailPage` rubric save (`:391-395`) and question text/marks save
  (`:420-429`): both update local `questions` state **before** awaiting
  `updateDoc`. If write fails, UI shows the desired value forever (until
  reload).
- `GradingReviewPage` bulk approve (`:319-325`) and accept grade (`:345-349`):
  local `questionSubs` is mutated before/without awaiting the batch commit
  success path.

**Action:** wrap each in try/catch with a rollback to the pre-mutation snapshot
on failure, plus a toast.

---

### P1 — Frontend Storage upload paths don't match Storage trigger paths

**Where:**

- `ExamCreatePage.tsx:84` writes to
  `tenants/{tenantId}/question-papers/{ts}_{name}`; trigger watches
  `tenants/{tenantId}/exams/{examId}/question-paper/{filename}`.
- `SubmissionsPage.tsx:126` writes to
  `tenants/{tenantId}/submissions/{examId}/{ts}_{name}`; trigger watches
  `tenants/{tenantId}/exams/{examId}/answer-sheets/{studentId}/{filename}`.

**Symptom:** the two Storage triggers (`onQuestionPaperUpload`,
`onAnswerSheetUpload`) are completely bypassed by the teacher-web frontend. This
is **functional today** because the callables (`saveExam` with
`questionPaperImages`, `uploadAnswerSheets`) write the doc fields directly. But:

- New developers reading the triggers' code will assume they're load-bearing for
  the FE flow.
- If the callable ever stops writing `questionPaper.images` (assumes the trigger
  does it), exam creation silently breaks.
- Path inconsistency makes pipeline debugging confusing.

**Action:** either (a) align FE paths with trigger paths and remove the
redundancy in the callables, or (b) document in both `on-*-upload.ts` files that
they exist for scanner/GCS-bulk paths only. Confirm choice against backend
contract report.

---

### P1 — `ExamDetailPage` reads questions via one-shot `getDocs`, not a listener

**Where:** `ExamDetailPage.tsx:348-356` **Symptom:** after
`callExtractQuestions` resolves, FE does a one-shot re-fetch (`:377-381`). If
the backend writes question docs asynchronously after the callable resolves (it
doesn't today, but the contract doesn't guarantee atomicity), the list will be
empty. After rubric edits or re-extract, similarly relies on manual re-fetch —
no live updates if a coordinated session modifies them.

**Action:** replace `getDocs` with `onSnapshot` for the questions subcollection.

---

### P1 — `GradingReviewPage` `questionPaperUrls` cached without revalidation

**Where:** `ExamDetailPage.tsx:325-345` **Symptom:** `questionPaperUrls` are
resolved via `getDownloadURL` once on mount and cached. If
`questionPaper.images` changes (e.g. teacher re-uploads), URLs become stale
or 404.

**Action:** depend the effect on the image-paths array hash, not just the exam
id.

---

### P1 — No `gradeError` rollback when listener catches up

**Where:** `GradingReviewPage.tsx:101` `gradeError` state **Symptom:** if the
`gradeQuestion` callable throws, FE sets `gradeError`. There's no mechanism to
clear it when the listener subsequently reports a successful retry — error
remains pinned until user closes and reopens the question card.

**Action:** clear `gradeError[questionId]` whenever the listener emits a
`gradingStatus` ∈ {`'graded'`, `'manual'`} for that question.

---

### P1 — `useExams` / `useSubmissions` cache key uses raw `options` object

**Where:** `useExams.ts:13`, `useSubmissions.ts:13` **Symptom:** TanStack-Query
keys include the raw `options` object. Callers passing a fresh object literal on
every render (which `ExamListPage`, `SubmissionsPage` do —
`{ status: activeTab }` is constructed inline) cause query refetches when only
the reference changes. Cache thrash.

**Action:** stabilize keys via memoization (`useMemo`) of the options object at
call sites, or serialize inside the hook.

---

### P1 — `usePublishExam` constructs a partial `data` payload

**Where:** `useExamMutations.ts:45-57` **Symptom:** `usePublishExam` sends
`{ id, tenantId, data: { status: 'published' } }`. Backend's
generic-status-transition branch (`save-exam.ts:295-313`) only updates
`{ status, updatedAt }` — this works. **But** the lock-check for post-publish
locked fields (`save-exam.ts:332-341`) sits in the field-update branch; if a
future caller adds extra fields to the publish data block, locked-field
violations will surface only at runtime.

**Action:** type the `data` field per status transition (zod discriminated
union), so FE can't accidentally send locked fields.

---

### P2 — Several pages lack error UIs on first load

- `ExamListPage`: no error state if `useExams` fails.
- `ExamDetailPage`: catches errors via `useApiError` but renders nothing on
  failed `useExam`.
- `SubmissionsPage`: no error UI for failed listener.

**Action:** add `{ error }` branches that render a banner + retry button.

---

### P2 — Wizard back-navigation in `ExamCreatePage` discards in-memory draft

**Where:** `ExamCreatePage.tsx:136` **Symptom:** clicking back during the wizard
loses all entered metadata. No "save draft" or confirmation.

**Action:** add a confirm-discard dialog on back, or persist the draft to
`localStorage`.

---

### P2 — No success toast on long mutations

`Release Results`, `Accept Grade`, `Approve All`, exam publish — all complete
silently. Combined with the stale-data issues above, users have no proof the
action took effect until the listener catches up.

**Action:** add toast notifications on mutation success.

---

### P2 — Keyboard shortcut "a" (accept grade) can fire twice

**Where:** `GradingReviewPage.tsx:440-441` **Symptom:** condition checks
`gradingStatus === 'needs_review' || 'graded'` but the local state is mutated
optimistically. Two quick presses while listener is in flight may double-fire.

**Action:** debounce or guard with an in-flight set keyed by questionId.

---

## 4. Open Questions for Backend Contract Diff

These need to be matched against the backend CONTRACT REPORT to confirm shared
truth:

1. Is `submission.pipelineStatus = 'reviewed'` a valid state recognized by
   `on-submission-updated` and `on-results-released`? Bulk approve sets it
   (`GradingReviewPage.tsx:307-313`).
2. Does `gradeQuestion` ignore an extra `examId` field in `manual` mode (FE
   sends it; BE schema doesn't list it)?
3. Are the two Storage triggers (`onQuestionPaperUpload`, `onAnswerSheetUpload`)
   intended to remain dead-code from the FE perspective, or should FE migrate to
   align paths?
4. Is `useReleaseResults` allowed to send
   `data: { status: 'results_released', classIds }` from any of `published`,
   `grading`, `completed`, `grading_complete`, `results_released` — i.e. is the
   BE `validStatuses` whitelist (`save-exam.ts:200-206`) the source of truth?
5. Does the backend always populate `submission.summary` synchronously after
   `gradeQuestion` (manual mode), or only via the
   `onQuestionSubmissionUpdatedV2` trigger? FE depends on the listener for this.
6. Should the FE consume `extractQuestions` response's `questions: unknown[]`
   payload (avoid round-trip re-fetch), or is the contract intentionally
   "callable triggers Firestore write, FE reads from Firestore"?

---

## 5. File Index (paths cited in this audit)

- `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx`
- `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`
- `apps/teacher-web/src/pages/exams/ExamListPage.tsx`
- `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`
- `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- `packages/shared-services/src/autograde/exam-callables.ts`
- `packages/shared-hooks/src/queries/useExam.ts`
- `packages/shared-hooks/src/queries/useExams.ts`
- `packages/shared-hooks/src/queries/useExamMutations.ts`
- `packages/shared-hooks/src/queries/useSubmissions.ts`
- `packages/shared-hooks/src/queries/useSubmissionMutations.ts`
- `packages/shared-hooks/src/data/useFirestoreDoc.ts`
- `packages/shared-hooks/src/data/useFirestoreCollection.ts`
- `functions/autograde/src/callable/save-exam.ts`
- `functions/autograde/src/callable/extract-questions.ts`
- `functions/autograde/src/callable/upload-answer-sheets.ts`
- `functions/autograde/src/callable/grade-question.ts`
- `functions/autograde/src/triggers/on-question-paper-upload.ts`
- `functions/autograde/src/triggers/on-answer-sheet-upload.ts`
- `functions/autograde/src/triggers/on-submission-created.ts`
- `functions/autograde/src/triggers/on-submission-updated.ts`
- `functions/autograde/src/triggers/on-question-submission-updated.ts`
- `functions/autograde/src/triggers/on-results-released.ts`
