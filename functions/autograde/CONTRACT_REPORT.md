# AutoGrade Pipeline — Backend Contract Report

**Scope:** the new monorepo backend at `functions/autograde/` (NOT the legacy
`/autograde/` submodule). **Validation:** every contract below is exercised
end-to-end by `src/__tests__/e2e-pipeline.test.ts` with the LLM mocked.

> All `(file:line)` references are clickable in editors. Stage shapes are
> authoritative because the test drives the real callable/pipeline code against
> an in-memory Firestore + a `MockLLMWrapper` that returns deterministic JSON
> fixtures.

---

## Stage Map (state-machine view)

```
draft ── saveExam(create w/ images) ──► question_paper_uploaded
                                        │
                                        ▼ extractQuestions (AI)
                                  question_paper_extracted
                                        │
                                        ▼ saveExam({status:'published'})
                                     published
                                        │
                                        ▼ uploadAnswerSheets (1st sub)
                                     grading        ──► submission.pipelineStatus = 'uploaded'
                                                              │
                                                              ▼ onSubmissionCreated trigger
                                                          scouting
                                                              │
                                                              ▼ processAnswerMapping (AI)
                                                       scouting_complete
                                                              │
                                                              ▼ onSubmissionUpdated trigger
                                                           grading
                                                              │
                                                              ▼ processAnswerGrading (AI, per Q)
                                              ┌── grading_complete ── finalizeSubmission ──► ready_for_review
                                              │
                                              ├── grading_partial  (some failed)
                                              └── manual_review_needed (all failed/quota)
exam status: grading → completed (via saveExam) → results_released (via saveExam)
```

---

## Stage 1 — `saveExam` (create)

**Endpoint:** `src/callable/save-exam.ts:64` (`onCall`, region `asia-south1`,
512 MiB, 300s) **Request schema:** `SaveExamRequestSchema` —
`packages/shared-types/src/schemas/callable-schemas.ts:581`

### Request shape (when creating)

```ts
{
  tenantId: string,                    // firestoreId (no slashes)
  data: {
    title: string, subject: string,
    classIds: string[],                // required at least 1
    topics?: string[], sectionIds?: string[],
    examDate?: ISOString, duration?: number,
    totalMarks?: number, passingMarks?: number,
    academicSessionId?: string,
    gradingConfig?: { autoGrade?, allowRubricEdit?, evaluationSettingsId?,
                      allowManualOverride?, requireOverrideReason?,
                      releaseResultsAutomatically? },
    linkedSpaceId?, linkedSpaceTitle?, linkedStoryPointId?,
    evaluationSettingsId?,
    questionPaperImages?: string[]     // STORAGE PATHS, e.g. tenants/<t>/question-papers/<file>
  }
}
```

### Response shape

`{ id: string, created: true }` (or `{ id, created: false }` on update) — see
`src/callable/save-exam.ts:140`.

### Firestore writes (`tenants/{tenantId}/exams/{examId}`)

`src/callable/save-exam.ts:91-132` writes:

```ts
{
  id, tenantId, title, subject,
  topics: [], classIds, sectionIds: [],
  examDate: Timestamp | null,
  duration, totalMarks, passingMarks,
  academicSessionId,
  gradingConfig: { autoGrade, allowRubricEdit, allowManualOverride,
                   requireOverrideReason, releaseResultsAutomatically,
                   evaluationSettingsId },
  questionPaper: hasQP ? { images: string[], uploadedAt: serverTimestamp } : null,
  linkedSpaceId, linkedSpaceTitle, linkedStoryPointId,
  evaluationSettingsId,
  status: hasQP ? 'question_paper_uploaded' : 'draft',
  stats: { totalSubmissions: 0, gradedSubmissions: 0, avgScore: 0, passRate: 0 },
  createdBy, createdAt, updatedAt
}
```

Also increments `tenants/{tenantId}.usage.examsThisMonth`
(`save-exam.ts:135-138`).

### Hand-off to next stage

`exam.questionPaper.images` is the field `extractQuestions` reads at
`src/callable/extract-questions.ts:50-66` to download images and call Gemini.

---

## Stage 2 — `extractQuestions` (AI)

**Endpoint:** `src/callable/extract-questions.ts:22` (`onCall`, 540s, 2 GiB)
**Request schema:** `ExtractQuestionsRequestSchema` — `callable-schemas.ts:640`

### Request shape

`{ tenantId, examId, mode?: 'full'|'single', questionNumber?: string }`

### Pre-conditions (extract-questions.ts:39-52)

- `exam.status === 'question_paper_uploaded'` (full mode)
- `exam.questionPaper.images.length > 0`

### LLM call (extract-questions.ts:172-186)

- `purpose: 'question_extraction'`, `operation: 'extractQuestions'`,
  `temperature: 0.1`, `maxTokens: 65536`
- System prompt: `EXTRACTION_SYSTEM_PROMPT` (prompts/extraction.ts:6)
- Returns JSON
  `{ questions: [{ questionNumber, text, maxMarks, rubric:{criteria:[{name,maxPoints}]}, ... }] }`
- Parsed by `parseExtractionResponse` (extraction.ts:104) — auto-fixes criteria
  sum mismatch.

### Firestore writes

**Per question:** `tenants/{t}/exams/{e}/questions/{questionNumber}`
(`extract-questions.ts:215-265`)

```ts
{
  id: questionNumber, examId,
  text, maxMarks, order,
  rubric: { criteria: [{ id, name, description, maxPoints }],
            scoringMode: 'criteria_based', dimensions: [] },
  questionType: 'standard'|'diagram'|'multi-part',
  extractionConfidence, readabilityIssue,
  subQuestions: [{ label, text, maxMarks, rubric? }],
  extractedBy: 'ai',
  extractedAt, createdAt, updatedAt
}
```

**Exam update** (`extract-questions.ts:268-274`):

```ts
{
  status: 'question_paper_extracted',
  'questionPaper.extractedAt': serverTimestamp,
  'questionPaper.questionCount': N,
  updatedAt
}
```

Both writes commit in a single batch (atomic).

### Response shape

```ts
{
  success: true,
  questions: SavedQuestion[],   // same shape as Firestore docs above (minus id'd-by-batch)
  warnings: string[],
  metadata: { questionCount, tokensUsed, cost, extractedAt, imageQualityAcceptable }
}
```

### Hand-off

The downstream callable (`processAnswerMapping`, `processAnswerGrading`) read
these questions via `getExamQuestions(tenantId, examId)` —
`utils/firestore-helpers.ts:31` — which orders by `order asc` and validates
against `ExamQuestionSchema`.

---

## Stage 3 — `saveExam` (publish transition)

Endpoint same as Stage 1. **Trigger arm:** `save-exam.ts:152-194`.

### Request shape

`{ tenantId, id: examId, data: { status: 'published' } }`

### Preconditions

- Current `exam.status === 'question_paper_extracted'` (`save-exam.ts:155-160`)
- At least one question exists, and every question's `rubric.criteria` sums to
  `maxMarks` (`save-exam.ts:163-186`).

### Firestore write

`tenants/{t}/exams/{e}` → `{ status: 'published', updatedAt }`.

### Response

`{ id, created: false }`.

---

## Stage 4 — `uploadAnswerSheets`

**Endpoint:** `src/callable/upload-answer-sheets.ts:17` (300s, 256 MiB)
**Request schema:** `UploadAnswerSheetsRequestSchema` —
`callable-schemas.ts:649`

### Request shape

```ts
{
  tenantId: string,
  examId: string,
  studentId: string,
  classId: string,
  imageUrls: string[]    // STORAGE PATHS (historical name); each MUST start with `tenants/{tenantId}/`
}
```

### Preconditions

- All `imageUrls` start with `tenants/${tenantId}/`
  (upload-answer-sheets.ts:28-36)
- `exam.status` is `published` or `grading` (line 48)
- `exam.classIds.includes(classId)` (line 56)
- No existing submission for `(examId, studentId)` (lines 65-77)

### Firestore writes

**Submission doc** `tenants/{t}/submissions/{auto-id}` (lines 91-118):

```ts
{
  id, tenantId, examId, studentId,
  studentName: '<first> <last>'.trim() ?? studentId,
  rollNumber: student.rollNumber ?? '',
  classId,
  answerSheets: {
    images: string[],          // = data.imageUrls
    uploadedAt: serverTimestamp,
    uploadedBy: caller.uid,
    uploadSource: 'web'|'scanner'|'gcs'   // 'scanner' iff caller.role === 'scanner', else 'web'
  },
  summary: {
    totalScore: 0, maxScore: exam.totalMarks,
    percentage: 0, grade: '',
    questionsGraded: 0,
    totalQuestions: exam.questionPaper?.questionCount ?? 0
  },
  pipelineStatus: 'uploaded',
  retryCount: 0,
  resultsReleased: false,
  createdAt, updatedAt
}
```

**Exam update** (lines 121-132): increments `stats.totalSubmissions`; flips
`status` to `'grading'` iff was `'published'`.

### Response

`{ submissionId: string }`.

### Hand-off

Writing `pipelineStatus: 'uploaded'` fires `onSubmissionCreated` (Stage 5).

---

## Stage 5 — `processAnswerMapping` (Panopticon)

**Trigger entry:** `src/triggers/on-submission-created.ts:12`
(`onDocumentCreated`) when `pipelineStatus === 'uploaded'` and
`answerSheets.images` non-empty (lines 27-35). It flips
`pipelineStatus: 'scouting'` then calls `processAnswerMapping`.

**Worker:** `src/pipeline/process-answer-mapping.ts:17`.

### Reads (must match Stage 1/2/4 writes)

- `getSubmission(tenantId, submissionId)` → reads from `Stage 4` shape
- `getExam(tenantId, submission.examId)` → reads from `Stage 1/2` shape, must
  have `.questionPaper.images`
- `getExamQuestions(tenantId, submission.examId)` → reads `Stage 2` per-question
  docs

### LLM call (mapping.ts:67-94)

- `purpose: 'answer_mapping'`, `operation: 'panopticonScouting'`,
  `temperature: 0.1`, `maxTokens: 16384`
- Returns
  `{ routing_map: { [questionId]: pageIndex[] }, confidence: { [questionId]: number }, notes? }`
- Parsed by `parsePanopticonResponse` (prompts/panopticon.ts:67) which:
  - Strips Gemini "Q" prefix if needed (lines 79-97)
  - Applies the **Sandwich Rule** (lines 99-117)
  - Drops out-of-range page indices

### Firestore writes

**Per question:** `tenants/{t}/submissions/{s}/questionSubmissions/{questionId}`
(mapping.ts:109-139):

```ts
{
  id: questionId, submissionId, questionId, examId,
  mapping: {
    pageIndices: number[],                      // 0-based, indexes into submission.answerSheets.images
    imageUrls: string[],                        // = pageIndices.map(i => submission.answerSheets.images[i])
    scoutedAt: serverTimestamp
  },
  gradingStatus: 'pending',
  gradingRetryCount: 0,
  createdAt, updatedAt
}
```

**Submission update** (lines 142-151):

```ts
{
  scoutingResult: { routingMap, confidence, completedAt },
  pipelineStatus: 'scouting_complete',
  updatedAt
}
```

### Hand-off

The `'scouting_complete'` transition fires `onSubmissionUpdated`
(`src/triggers/on-submission-updated.ts:69-76`) which flips
`pipelineStatus: 'grading'`. The subsequent `'grading'` transition fires the
same trigger again (lines 78-82) which runs `processAnswerGrading`.

> **Verified by test (`e2e-pipeline.test.ts`):**
> `qs.mapping.imageUrls === qs.mapping.pageIndices.map(i => submission.answerSheets.images[i])`.
> This is the single most important hand-off invariant — the grader downloads
> from `qs.mapping.imageUrls` directly.

---

## Stage 6 — `processAnswerGrading` (RELMS)

**Worker:** `src/pipeline/process-answer-grading.ts:50`.

### Reads

- `getSubmission`, `getExam`, `getExamQuestions`
- `getQuestionSubmissions(tenantId, submissionId)` — only acts on
  `gradingStatus === 'pending'` (line 89)
- `getEvaluationSettings` chain: `exam.gradingConfig.evaluationSettingsId` →
  `tenant.settings.defaultEvaluationSettingsId` → none
- Dynamic `await import('@levelup/shared-services/ai')` → `checkUsageQuota`
  (lines 58-77). Failures swallowed; quota block writes
  `pipelineStatus: 'manual_review_needed'` and returns.

### LLM call (per question; lines 347-364)

- `purpose: 'answer_grading'`, `operation: 'relmsEvaluation'`,
  `resourceId: '<submissionId>/<questionId>'`, `temperature: 0.1`,
  `maxTokens: 8192`
- Built by `buildRELMSUserPrompt(question, rubric, dimensions)` —
  prompts/relms.ts:23
- Returns the RELMS JSON shape (see `parseRELMSResponse` — relms.ts:126).

### Per-question writes

**Before call** (grading.ts:303): `{ gradingStatus: 'processing', updatedAt }`
**On success** (grading.ts:420-425):

```ts
{
  gradingStatus: 'graded'|'needs_review',   // confidence-routed
  reviewSuggested: boolean,
  evaluation: {
    score, maxScore, correctness, percentage,
    structuredFeedback, strengths, weaknesses, missingConcepts,
    rubricBreakdown, summary, confidence,
    mistakeClassification,
    tokensUsed: { input, output },
    costUsd, latencyMs,
    timingMs: { imageDownload, llmCall, total },
    model,
    dimensionsUsed,
    gradedAt
  },
  updatedAt
}
```

**On failure** after retries (lines 158-187): mark `failed` or `needs_review`,
write a DLQ doc to `tenants/{t}/gradingDeadLetter/{auto-id}`.

### Terminal aggregation (transaction; grading.ts:208-281)

Counts question statuses, then flips the submission:

- any `pending` left → no-op (still processing)
- `failed > 0` AND `gradedCount > 0` → `pipelineStatus: 'grading_partial'`
- `failed > 0` AND `gradedCount == 0` → `pipelineStatus: 'manual_review_needed'`
- `gradedCount === total` → `pipelineStatus: 'grading_complete'` (+
  `summary.needsReviewCount`)
- Also increments `exams/{e}.stats.totalGradingCostUsd`.

### Hand-off

`'grading_complete'` fires `onSubmissionUpdated` → `finalizeSubmission` (Stage
7). Concurrently, every per-question update fires
`onQuestionSubmissionUpdatedV2` which performs **the same status aggregation
logic** as the inline transaction
(`src/triggers/on-question-submission-updated.ts:39-98`). This is intentional —
see FE-resolution #5 below.

---

## Stage 7 — `finalizeSubmission`

**Worker:** `src/pipeline/finalize-submission.ts:12`.

### Reads

- Submission doc, then `getQuestionSubmissions` and `getExamQuestions`.

### Computation

`calculateSubmissionSummary` (`utils/grading-helpers.ts:43`):

- `totalScore = Σ manualOverride.score ?? evaluation.score` for
  `graded|manual|overridden|needs_review`
- `maxScore = Σ evaluation.maxScore`
- `percentage`, `grade = calculateGrade(percentage)` (A+ ≥90, A ≥80, B+ ≥70,
  ...)

### Firestore writes

**Submission** (finalize.ts:38-46):

```ts
{
  summary: {
    totalScore, maxScore, percentage, grade,
    questionsGraded, totalQuestions,
    completedAt: serverTimestamp,
    linkedSpaceFeedback?
  },
  pipelineStatus: 'ready_for_review',
  updatedAt
}
```

**Exam** (lines 49-53): `stats.gradedSubmissions += 1`.

### Side effects

Async notifications to teacher (per-sub + batch summary). Non-blocking; failures
logged.

---

## Stage 8 — `saveExam` (release results)

Endpoint same as Stage 1. **Trigger arm:** `save-exam.ts:197-289`.

### Request shape

```ts
{ tenantId, id: examId, data: { status: 'results_released', classIds?: string[] } }
```

### Preconditions

- `exam.status ∈ { 'grading', 'completed', 'grading_complete', 'results_released' }`
  (line 200) _(Note: `'grading_complete'` is a submission status — included
  defensively. Exam statuses are
  `draft|question_paper_uploaded|question_paper_extracted|published|grading|completed|results_released|archived`.)_

### Firestore writes

For each matching submission with
`pipelineStatus ∈ { 'grading_complete', 'ready_for_review', 'reviewed' }` (line
229):

```ts
{ resultsReleased: true, resultsReleasedAt, resultsReleasedBy: caller.uid, updatedAt }
```

Then exam: `{ status: 'results_released', updatedAt }`.

### Side effects

- `sendBulkNotifications` to all student UIDs (best-effort)
- Trigger `onResultsReleased` (`src/triggers/on-results-released.ts:15`) fires
  on the exam status change, sending separate notifications to students +
  parents + the creating teacher.

---

# Frontend-contract resolutions

These are the 6 questions raised by the teacher-web audit
(`apps/teacher-web/AUTOGRADE_FRONTEND_AUDIT.md`). Each is answered with a
backend citation.

## 1. Storage path mismatch — Storage triggers don't fire for the teacher-web flow

| Side                | Path written                                                             | Cite                                                       |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| FE (question paper) | `tenants/{tenantId}/question-papers/{ts}_{name}`                         | `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx:84`   |
| FE (answer sheets)  | `tenants/{tenantId}/submissions/{examId}/{ts}_{name}`                    | `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx:126` |
| BE trigger watches  | `tenants/{tenantId}/exams/{examId}/question-paper/{filename}`            | `src/triggers/on-question-paper-upload.ts:15`              |
| BE trigger watches  | `tenants/{tenantId}/exams/{examId}/answer-sheets/{studentId}/{filename}` | `src/triggers/on-answer-sheet-upload.ts:20`                |

**Resolution:** the Storage triggers are **alternative entry points** intended
for scanner/GCS bulk uploads — see `on-answer-sheet-upload.ts:6-14` ("Note: For
the primary upload flow (web/scanner), the uploadAnswerSheets callable is
preferred. This Storage trigger serves as an alternative path for bulk file
uploads via GCS or automated scanning pipelines."). The teacher-web flow does
NOT depend on them.

**The contract that DOES matter:**

- FE uploads the file to `tenants/{tenantId}/question-papers/...`
- FE then calls
  `saveExam({ data: { questionPaperImages: ['<that storage path>'] } })`
- saveExam stores the paths into `exam.questionPaper.images`
  (`save-exam.ts:114-117`)
- `extractQuestions` downloads from those paths via
  `bucket.file(imagePath).download()` (`extract-questions.ts:58-66`)

Same for answer sheets: FE uploads to
`tenants/{tenantId}/submissions/{examId}/...` then calls
`uploadAnswerSheets({ imageUrls: [...] })` — `upload-answer-sheets.ts:28-36`
enforces the prefix `tenants/${tenantId}/`. The actual subfolder is
unconstrained because the bucket reads by exact path.

**BUT — REAL BUG FOUND (likely the autograde-not-working root cause)**

While building this test I discovered the compiled `@levelup/shared-types` dist
that ships to functions runtime has **stale validation** for
`questionPaperImages`:

| Source (`packages/shared-types/src/schemas/callable-schemas.ts:624`) | Compiled dist that was being loaded            |
| -------------------------------------------------------------------- | ---------------------------------------------- |
| `z.array(z.string().min(1).max(500)).max(50).nullish()`              | `z.array(z.string().url()).max(50).optional()` |

The FE sends Storage paths (not URLs), so `parseRequest` in `saveExam` was
rejecting every create call with:

```
Invalid request: data.questionPaperImages.0: Invalid URL
```

`imageUrls` in `UploadAnswerSheetsRequestSchema` was correct in the dist
(`.min(1).max(500)`), so answer-sheet uploads worked. But exam creation itself
was broken at the schema gate. **I rebuilt the dist** as part of this work
(`packages/shared-types/dist/index.{js,mjs}`) and copied it into the
pnpm-resolved location to make the E2E test exercise the actual source-of-truth
contract. The publish team should `pnpm install` (or rebuild + republish)
`@levelup/shared-types` to propagate this fix to all consumers; flagging to
coordinator.

## 2. Is `pipelineStatus: 'reviewed'` a recognized state?

**Yes.** The `SubmissionSchema` enum at
`packages/shared-types/src/schemas/index.ts:293-309` includes `'reviewed'`.
Backend behavior on `'reviewed'`:

- `save-exam.ts:229` releasableStatuses include `'reviewed'` — release-results
  works on it.
- `finalize-submission.ts:79` counts `'reviewed'` as graded for the
  batch-complete heuristic.
- `on-submission-updated.ts:40-92` has no `'reviewed'` arm — that's terminal; no
  automated transition out of it. **Safe** for FE bulk-approve to write directly
  (`GradingReviewPage.tsx:307`).

## 3. Does `gradeQuestion` accept/ignore an extra `examId` in manual mode?

**Ignored harmlessly.** `GradeQuestionRequestSchema` (callable-schemas.ts:628)
declares `examId: firestoreId.optional()`. `handleManualGrade`
(grade-question.ts:64-167) never reads `data.examId` — it derives the exam via
`submission.examId` (line 85). The Zod schema is `.object(...)` (not
`.strict()`), so unknown fields would also be tolerated. FE can keep sending it.

## 4. Is `validStatuses` at `save-exam.ts:200-206` the authoritative whitelist for which prior exam status can release results?

**Yes.** That array is the only gate:

```ts
const validStatuses = ['grading', 'completed', 'grading_complete', 'results_released'];
if (!validStatuses.includes(exam.status)) throw HttpsError('failed-precondition', ...);
```

Anything not in that list throws. (Note: `'grading_complete'` is technically a
_submission_ pipeline status, not an exam status — it's defensive and dead code
for the exam path. Real exam statuses passing the gate are `grading`,
`completed`, `results_released`.)

## 5. Is `submission.summary` recomputed synchronously by manual `gradeQuestion`, or only via the `onQuestionSubmissionUpdatedV2` trigger?

**Both — synchronously in `gradeQuestion`'s own transaction, AND eventually
again via the trigger.**

- Synchronous path: `grade-question.ts:142-157` opens a `db.runTransaction`,
  reads all `questionSubmissions`, calls `calculateSubmissionSummary`, and
  writes `submission.summary` + `pipelineStatus`. So the submission is
  up-to-date by the time the callable resolves.
- Async trigger: `onQuestionSubmissionUpdatedV2`
  (`on-question-submission-updated.ts:9`) fires from the per-question `update`.
  It re-aggregates and writes
  `pipelineStatus`/`summary.questionsGraded`/`summary.needsReviewCount` (lines
  79-97) — but **does NOT recompute totalScore/percentage/grade**. So there's no
  double-counting of `totalScore`.

**Risk for FE:** if the FE listens to `submission.summary` and reacts
immediately on either fire, the synchronous path may briefly show the trigger's
partial fields (`questionsGraded`) before the full summary lands — but the
callable's `await` already includes the synchronous write, so a request/response
flow always sees the final shape. The listener-only path (FE expecting eventual
consistency) is also safe.

## 6. `extractQuestions` returns `questions: unknown[]` — does the callable guarantee Firestore is written BEFORE it resolves?

**Yes — atomic batch write before return.** `extract-questions.ts:192-276`
builds a single Firestore batch with:

- `batch.set(qRef, questionDoc)` for every question
- `batch.update(examRef, { status: 'question_paper_extracted', ... })`

then `await batch.commit()` at line 276, before the function returns. So when
the callable resolves, the FE is guaranteed that:

- `tenants/{t}/exams/{e}/questions/*` exists for every returned question
- `exams/{e}.status` is `'question_paper_extracted'`
- `exams/{e}.questionPaper.questionCount` is set

The FE pattern of "callable writes, FE re-fetches from Firestore" is **safe** —
no async race. The same atomic batch pattern is used in `processAnswerMapping`
(mapping.ts:152-156).

---

# E2E Test Summary

**File:** `src/__tests__/e2e-pipeline.test.ts` **Mocking:** in-hoist in-memory
Firestore + Storage; `MockLLMWrapper` dispatches by `metadata.purpose`
(`question_extraction` | `answer_mapping` | `answer_grading`). **Run:**
`npm test` — **all 170 tests pass**, `npm run typecheck` clean.

The test drives stages 1→8 in a single `it()` and asserts:

- exam.status transitions at every stage
- `exam.questionPaper.images` survives into `extract-questions`
- `extract-questions` writes 2 question docs with rubric sums = maxMarks
- saveExam(publish) gated on extracted rubrics
- `uploadAnswerSheets` writes `submission.answerSheets.images`,
  `summary.maxScore = exam.totalMarks`, exam→grading
- `processAnswerMapping` writes one `questionSubmission` per question with
  `mapping.imageUrls === pageIndices.map(i => submission.answerSheets.images[i])`
- `processAnswerGrading` lands each `evaluation` with score, maxScore,
  percentage, confidence; submission→grading_complete
- `finalizeSubmission` aggregates to `totalScore=9/10, A+, 90%`,
  submission→ready_for_review
- `saveExam(results_released)` flips submission.resultsReleased=true and
  exam.status=results_released

A second narrower test pins the `mapping.imageUrls === pageIndices.map(...)`
invariant explicitly so future refactors break the test, not prod.

---

# Findings the coordinator should action

1. **🚨 Stale `@levelup/shared-types` dist** — `questionPaperImages` was
   `z.string().url()` in the shipped dist (source is
   `z.string().min(1).max(500)`). This silently blocked every exam-create call
   from the teacher-web flow with `Invalid URL`. I rebuilt + propagated the dist
   as part of this task. Frontend should retest exam create end-to-end; the
   broken state has been live since the source was updated without a republish.
2. **Confirmed contract integrity** — once the schema bug is fixed, every stage
   hand-off shape is consistent with what the next stage reads.
3. **Storage triggers are not the autograde-not-working culprit** — they are
   alternative scanner/GCS entry points, not the teacher-web pipeline.
