# AutoGrade Module -- Code Review Report

**Reviewer:** AutoGrade Engineer (Claude Opus 4.6) **Date:** 2026-02-24
**Scope:** Full AutoGrade pipeline, prompts, shared types, teacher-web UI,
shared hooks **Verdict:** Solid architecture with several issues requiring
attention before production scale

---

## Summary

The AutoGrade module implements a 3-stage AI grading pipeline (scouting ->
grading -> finalization) driven by Firestore triggers. The overall design is
well-structured with clear separation of concerns, proper multi-tenant
isolation, and a thoughtful rubric resolution chain. However, there are critical
issues around race conditions in the pipeline state machine, missing error
handling for the grading phase, a security gap in the frontend that bypasses
server-side access controls, and several edge cases in LLM response parsing that
could cause silent data corruption.

**Findings by Severity:**

- Critical: 5
- Major: 8
- Minor: 7
- Suggestion: 6

---

## Critical Findings

### C1. Pipeline grading errors are silently swallowed -- no status transition on failure

**File:** `functions/autograde/src/triggers/on-submission-updated.ts:94-106`

The `catch` block in the trigger only handles errors for the `scouting` status
case. When `processAnswerGrading` (status `grading`) or `finalizeSubmission`
(status `grading_complete`) throws, the error is logged but no status transition
occurs. The submission gets stuck in `grading` or `grading_complete` permanently
with no DLQ entry and no user-visible failure state.

```typescript
// Line 94-106: catch block
catch (error) {
  // ...
  if (newStatus === 'scouting') {
    // Only this case is handled!
    await db.doc(...).update({ pipelineStatus: 'scouting_failed', ... });
  }
  // grading and grading_complete errors are silently lost
}
```

**Impact:** Submissions can become permanently stuck. Teachers will see a
submission in "grading" state forever with no way to recover.

**Recommendation:** Add error handling for `grading` and `grading_complete`
status transitions. Consider a `grading_failed` status with DLQ entry, and a
`finalization_failed` status.

---

### C2. Race condition: onQuestionSubmissionUpdated fires during sequential grading

**File:** `functions/autograde/src/triggers/on-question-submission-updated.ts`
**File:** `functions/autograde/src/pipeline/process-answer-grading.ts:75`

`processAnswerGrading` grades questions sequentially in a `for` loop (line 75).
Each graded question triggers `onQuestionSubmissionUpdated`, which checks if all
questions are in terminal states. When the first few questions are graded but
others are still `pending`, the trigger will see `pendingCount > 0` and return
early -- which is correct. However, if two questions finish grading nearly
simultaneously (e.g., due to a retry), two trigger invocations could both read
the same state and both attempt to update the submission's `pipelineStatus`,
leading to a race condition.

More critically, since grading is sequential within a single function
invocation, the trigger fires for each question update while grading is still in
progress. If the grading function errors partway through, some questions will be
`graded`, some `pending`, and the trigger may prematurely transition to
`grading_partial`.

**Impact:** Possible incorrect pipeline state transitions. A submission could be
marked `grading_complete` while some questions are still being processed.

**Recommendation:** Instead of relying on per-question triggers during grading,
have `processAnswerGrading` itself perform the final status check after all
questions are processed, or use a Firestore transaction for the final state
determination.

---

### C3. Frontend bypasses callable functions -- writes directly to Firestore

**File:** `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx:63-104` **File:**
`apps/teacher-web/src/pages/exams/SubmissionsPage.tsx:87-113` **File:**
`apps/teacher-web/src/pages/exams/ExamDetailPage.tsx:52-59`

The frontend pages write directly to Firestore using client SDK (`addDoc`,
`updateDoc`) instead of calling the callable Cloud Functions (`createExam`,
`uploadAnswerSheets`, `updateExam`). This bypasses:

1. Server-side permission checks (`assertAutogradePermission`)
2. Input validation (e.g., `createExam` validates required fields)
3. Business logic (e.g., duplicate submission check in `uploadAnswerSheets`)
4. Proper data initialization (e.g., `uploadAnswerSheets` looks up student
   name/roll from the students collection)

Specific issues:

- `ExamCreatePage` writes exam directly to Firestore at line 100 -- bypasses
  `createExam` callable
- `SubmissionsPage` creates submissions with `studentId: ""` at line 90 --
  bypasses student lookup and duplicate checks
- `ExamDetailPage.updateStatus` directly updates exam status at line 55 --
  bypasses publish validation (rubric sum checks)

**Impact:** Any authenticated user in the tenant could create exams, upload
submissions, or change exam status. The callable functions' security checks
become useless.

**Recommendation:** Replace all direct Firestore writes with calls to the
corresponding callable functions. The callables already exist and handle
validation.

---

### C4. ExamCreatePage sets incorrect `extractedAt` on question paper

**File:** `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx:91-92`

```typescript
questionPaper: uploadedUrls.length > 0
  ? {
      images: uploadedUrls,
      extractedAt: serverTimestamp(), // Wrong! Not extracted yet
      questionCount: 0,
      examType: "standard",
    }
  : undefined,
```

When creating an exam with uploaded question paper images, `extractedAt` is set
to the current timestamp even though extraction hasn't happened yet. This field
should only be set after `extractQuestions` runs. This could confuse downstream
logic that checks whether extraction has been performed.

**Impact:** Misleading metadata. If any logic checks `extractedAt` to determine
if questions have been extracted, it would incorrectly believe extraction is
complete.

**Recommendation:** Remove `extractedAt` from the initial exam creation. Let
`extractQuestions` set it after successful extraction (which it already does at
line 135 of `extract-questions.ts`).

---

### C5. Batch size limit in processAnswerMapping -- no guard for Firestore 500-op limit

**File:** `functions/autograde/src/pipeline/process-answer-mapping.ts:101-140`

The pipeline creates one `QuestionSubmission` per exam question plus one
submission update, all in a single batch. While most exams will have fewer than
500 questions, there is no guard. If an exam has more than ~498 questions
(unlikely but possible for high-volume exams like standardized tests), the batch
will exceed Firestore's 500-operation limit and fail silently or throw.

**Impact:** Large exams would fail during scouting with an opaque Firestore
error.

**Recommendation:** Either add a batch size check with overflow handling
(similar to `release-exam-results.ts` which correctly handles this at line 55)
or document the limit as a known constraint.

---

## Major Findings

### M1. `useSubmissions` hook orders by non-existent field `submittedAt`

**File:** `packages/shared-hooks/src/queries/useSubmissions.ts:28`

```typescript
constraints.push(orderBy("submittedAt", "desc"));
```

The `Submission` type has `createdAt` and `updatedAt` fields but no
`submittedAt` field. This query will either return no results (if Firestore
requires the field to exist for ordering) or silently return unordered results.

**Impact:** The submissions list on the frontend may show no results or results
in unpredictable order.

**Recommendation:** Change to `orderBy('createdAt', 'desc')` to match the actual
field name.

---

### M2. `useExams` hook filters on wrong field names

**File:** `packages/shared-hooks/src/queries/useExams.ts:19-24`

```typescript
if (options?.spaceId) {
  constraints.push(where("spaceId", "==", options.spaceId));
}
if (options?.classId) {
  constraints.push(where("classId", "==", options.classId));
}
```

The `Exam` type uses `linkedSpaceId` (not `spaceId`) and `classIds` (array, not
`classId`). The `spaceId` filter will never match. The `classId` filter should
use `array-contains` on `classIds`.

**Impact:** Filtering exams by space or class from the frontend will silently
return empty results.

**Recommendation:** Fix to `where('linkedSpaceId', '==', options.spaceId)` and
`where('classIds', 'array-contains', options.classId)`.

---

### M3. No validation of `imageUrls` in `uploadAnswerSheets` -- path traversal risk

**File:** `functions/autograde/src/callable/upload-answer-sheets.ts:11`

The `imageUrls` array is accepted from the client and stored directly in
Firestore without any validation that the URLs point to the correct tenant's
storage bucket. A malicious caller could pass URLs pointing to another tenant's
files.

```typescript
interface UploadAnswerSheetsRequest {
  // ...
  imageUrls: string[]; // No validation of these URLs
}
```

**Impact:** Cross-tenant data access. A user could reference another tenant's
answer sheet images in their submission, potentially exposing another tenant's
student data through the grading pipeline.

**Recommendation:** Validate that all `imageUrls` start with the expected prefix
(e.g., `tenants/${tenantId}/`) or are within the tenant's storage namespace.

---

### M4. `updateExam` allows arbitrary nested object injection via `gradingConfig`

**File:** `functions/autograde/src/callable/update-exam.ts:12-16`

The `ALLOWED_FIELDS` set includes `gradingConfig` as a whole, but `data.updates`
is typed as `Record<string, unknown>`. A caller could pass
`{ gradingConfig: { ...anything } }` and it would be written directly to
Firestore. More critically, Firestore dot-notation could be used to overwrite
arbitrary nested fields if the client sends keys like
`gradingConfig.evaluationSettingsId`.

**Impact:** A caller could inject unexpected fields into the exam document.
Could be used to set `evaluationSettingsId` to another tenant's evaluation
settings (though this would be validated elsewhere).

**Recommendation:** Validate the structure of nested objects like
`gradingConfig` before writing. Use a schema validator (e.g., Zod) or manually
allowlist nested fields.

---

### M5. Scanner role has overly broad access in `assertAutogradePermission`

**File:** `functions/autograde/src/utils/assertions.ts:64-67`

```typescript
if (caller.role === "scanner") {
  // Scanner has limited permissions, handled per-function
  return; // Always passes!
}
```

The scanner role always passes the permission check regardless of the
`teacherPermission` parameter. This means a scanner account could call
`retryFailedQuestions`, `manualGradeQuestion`, `releaseExamResults`, or any
other callable that uses `assertAutogradePermission` without a specific teacher
permission check.

**Impact:** A compromised scanner device could perform admin-level operations
like releasing results or manually grading questions.

**Recommendation:** The scanner role should only be allowed for specific
operations (e.g., `uploadAnswerSheets`). Add explicit scanner permission checks
or deny by default for operations that are not upload-related.

---

### M6. `linkExamToSpace` and `createExam` throw plain `Error` instead of `HttpsError`

**File:** `functions/autograde/src/callable/link-exam-to-space.ts:24,36,43`
**File:** `functions/autograde/src/callable/create-exam.ts:34`

These callables throw `new Error(...)` instead of `new HttpsError(...)`. In
Cloud Functions v2, plain errors are converted to `INTERNAL` errors with the
message hidden from the client. This makes debugging impossible for the
frontend.

```typescript
// link-exam-to-space.ts:24
throw new Error("Missing required fields: tenantId, examId, spaceId.");
// Should be:
throw new HttpsError("invalid-argument", "...");
```

**Impact:** The frontend receives generic "INTERNAL" errors with no useful
message for validation failures.

**Recommendation:** Replace all `new Error(...)` with appropriate
`new HttpsError(code, message)` in callable functions.

---

### M7. Extraction auto-fix silently modifies rubric criteria

**File:** `functions/autograde/src/prompts/extraction.ts:107-115`

```typescript
const diff = q.maxMarks - criteriaSum;
if (Math.abs(diff) <= 2 && q.rubric.criteria.length > 0) {
  q.rubric.criteria[q.rubric.criteria.length - 1].maxPoints += diff;
}
```

When the LLM returns rubric criteria that don't sum to `maxMarks`, the code
silently adjusts the last criterion's `maxPoints` by up to 2 points. This
auto-fix happens without logging or user notification.

**Impact:** Teachers may not notice that a rubric criterion was silently
modified, leading to unexpected grading behavior.

**Recommendation:** At minimum, log a warning when auto-fix is applied. Consider
returning the adjustment as metadata so the UI can flag it for teacher review.

---

### M8. `manualGradeQuestion` does not recalculate summary correctly for newly created QS

**File:** `functions/autograde/src/callable/manual-grade-question.ts:92`

When `manualGradeQuestion` creates a new `QuestionSubmission` (line 55-72) for a
question that scouting missed, it then immediately calls
`getQuestionSubmissions` to recalculate the summary. However, Firestore's
`set()` at line 55 and the subsequent `getQuestionSubmissions` read at line 92
may not be consistent (Firestore reads can lag behind writes in
non-transactional contexts). The newly created document might not appear in the
query result.

**Impact:** The submission summary could be calculated without including the
manually graded question, showing an incorrect total score.

**Recommendation:** Use a Firestore transaction that encompasses the write and
subsequent reads, or add a small delay/retry mechanism.

---

## Minor Findings

### m1. Unused `Timestamp` import in `process-answer-grading.ts`

**File:** `functions/autograde/src/pipeline/process-answer-grading.ts:9`

```typescript
import { Timestamp } from "firebase-admin/firestore";
```

This import is never used in the file.

---

### m2. `GradingReviewPage` uses `"manual"` status for bulk approve instead of `"reviewed"`

**File:** `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx:157-166`

When bulk approving, individual question submissions are set to
`gradingStatus: "manual"`, but semantically this means "manually graded" not
"reviewed and approved". This is a confusing overload of the `manual` status.
The `QuestionGradingStatus` type likely has a separate status for this.

**Impact:** Confusion about whether a question was manually graded or
teacher-reviewed. Analytics queries filtering by `gradingStatus === 'manual'`
would conflate both cases.

---

### m3. Hardcoded region `asia-south1` across all functions

**Files:** All callable and trigger files

All functions use `region: 'asia-south1'`. This is fine for production if the
primary user base is in South Asia, but makes it harder to deploy to other
regions for testing or multi-region availability.

**Recommendation:** Extract the region to a shared constant or environment
variable.

---

### m4. `FieldValue` import in types/index.ts couples domain types to firebase-admin

**File:** `functions/autograde/src/types/index.ts:6`

```typescript
import { FieldValue } from "firebase-admin/firestore";
```

The types file imports from `firebase-admin`, creating a server-side dependency
in what should be a pure type-only module. The `WithFieldValue` utility type is
the only thing using it.

**Recommendation:** Move `WithFieldValue` to a separate utility types file
within the functions package, keeping the main types file free of runtime
dependencies.

---

### m5. `processAnswerMapping` downloads images sequentially

**File:** `functions/autograde/src/pipeline/process-answer-mapping.ts:41-64`

Image downloads use sequential `for` loops with `await`. For a submission with
many pages, this adds significant latency.

**Recommendation:** Use `Promise.all` or `Promise.allSettled` with a concurrency
limiter to download images in parallel.

---

### m6. `parseExtractionResponse` regex doesn't handle all markdown fence variants

**File:** `functions/autograde/src/prompts/extraction.ts:91`

````typescript
const cleaned = text
  .replace(/^```(?:json)?\n?/m, "")
  .replace(/\n?```$/m, "")
  .trim();
````

This regex only removes the first and last fence. If the LLM returns multiple
fenced blocks or nested fences, the parse will fail. The same pattern appears in
`panopticon.ts:67` and `relms.ts:127`.

**Recommendation:** Use a more robust extraction that finds the first `{` and
last `}` in the response text, or the first `[` and last `]` for array
responses.

---

### m7. Missing `id` field on `exam` document returned by `getExam` helper

**File:** `functions/autograde/src/utils/firestore-helpers.ts:14`

```typescript
return doc.exists ? ({ id: doc.id, ...doc.data() } as Exam) : null;
```

This spread pattern works but could overwrite a stored `id` field with the
document ID. If the document's data already contains an `id` field (which it
does -- set during `createExam` at line 45), this is a no-op. However, if they
ever diverge, the spread order matters. Currently safe but fragile.

---

## Suggestions

### S1. Add structured logging for pipeline observability

The pipeline currently relies on `console.log`/`console.warn`/`console.error`.
Consider using structured logging (e.g., Cloud Logging with severity labels and
custom fields like `submissionId`, `tenantId`, `pipelineStep`) to enable better
monitoring and alerting.

---

### S2. Consider idempotency tokens for pipeline steps

If a Firestore trigger fires twice for the same status change (which can happen
with Firestore's at-least-once delivery), the pipeline step runs twice. Consider
adding an idempotency check (e.g., store a `lastProcessedVersion` or check if
the next step's output already exists) before executing pipeline logic.

---

### S3. Add cost tracking per submission

The `processAnswerGrading` function tracks cost per question (line 217:
`costUsd: result.cost.total`), but the total cost per submission is never
aggregated. Consider adding a `totalCost` field to the submission summary for
billing visibility.

---

### S4. Add Firestore composite indexes documentation

The `useExams` and `useSubmissions` hooks use multi-field queries with `where` +
`orderBy` combinations that require Firestore composite indexes. Document the
required indexes or add them to `firestore.indexes.json`.

---

### S5. Extract image download logic into a shared utility

The pattern of downloading images from Cloud Storage and converting to base64 is
repeated in `process-answer-mapping.ts`, `process-answer-grading.ts`, and
`extract-questions.ts`. Extract this into a shared utility like
`downloadImagesAsBase64(bucket, paths)`.

---

### S6. Add test coverage for critical paths

There are no tests in the autograde module. Priority test targets:

1. `parsePanopticonResponse` -- sandwich rule logic, page index validation
2. `parseRELMSResponse` -- score clamping, missing field defaults
3. `parseExtractionResponse` -- auto-fix logic, validation
4. `calculateSubmissionSummary` -- manual override handling, mixed statuses
5. `resolveRubric` -- fallback chain behavior
6. `assertAutogradePermission` -- role-based access for each role type

---

## Test Coverage Assessment

**Current test coverage: 0%**

No test files were found in or near the `functions/autograde/` directory. This
is the highest-risk gap in the module. The pipeline involves multiple async
operations, LLM response parsing, and state machine transitions -- all of which
are highly testable and prone to edge-case bugs.

---

## Architecture Notes

### Strengths

1. **Clean pipeline separation**: The 3-stage pipeline (scouting -> grading ->
   finalization) is well-decomposed with clear responsibilities.
2. **Rubric resolution chain**: The question -> exam eval settings -> tenant
   defaults fallback in `resolveRubric` is elegant.
3. **DLQ pattern**: Dead letter queue entries for permanently failed questions
   enable recovery workflows.
4. **Sandwich rule**: The Panopticon sandwich rule for filling in page mapping
   gaps is a smart heuristic.
5. **Shared types**: The `@levelup/shared-types` package provides a single
   source of truth for domain types.
6. **Batch operations**: Proper use of Firestore batch writes throughout (with
   the exception noted in C5).

### Concerns

1. **Firestore trigger-based state machine**: Using Firestore document updates
   to drive a state machine is fragile. Triggers can fire out of order, multiple
   times, or not at all. Consider Cloud Tasks or PubSub for more reliable
   pipeline orchestration.
2. **No concurrency control**: Multiple submissions for the same exam could be
   processed simultaneously, potentially causing contention on exam stats
   counters.
3. **Memory footprint**: The `onSubmissionUpdated` trigger allocates 4GiB of
   memory. If many submissions arrive simultaneously, this could be expensive.

---

## File Index

| File                                                                 | Lines | Findings |
| -------------------------------------------------------------------- | ----- | -------- |
| `functions/autograde/src/pipeline/process-answer-mapping.ts`         | 143   | C5, m5   |
| `functions/autograde/src/pipeline/process-answer-grading.ts`         | 250   | C2, m1   |
| `functions/autograde/src/pipeline/finalize-submission.ts`            | 48    | --       |
| `functions/autograde/src/triggers/on-submission-created.ts`          | 46    | --       |
| `functions/autograde/src/triggers/on-submission-updated.ts`          | 127   | C1       |
| `functions/autograde/src/triggers/on-question-submission-updated.ts` | 91    | C2       |
| `functions/autograde/src/prompts/extraction.ts`                      | 120   | M7, m6   |
| `functions/autograde/src/prompts/panopticon.ts`                      | 106   | m6       |
| `functions/autograde/src/prompts/relms.ts`                           | 143   | m6       |
| `functions/autograde/src/callable/create-exam.ts`                    | 79    | M6       |
| `functions/autograde/src/callable/update-exam.ts`                    | 55    | M4       |
| `functions/autograde/src/callable/upload-answer-sheets.ts`           | 120   | M3       |
| `functions/autograde/src/callable/extract-questions.ts`              | 153   | --       |
| `functions/autograde/src/callable/publish-exam.ts`                   | 62    | --       |
| `functions/autograde/src/callable/retry-failed-questions.ts`         | 74    | --       |
| `functions/autograde/src/callable/manual-grade-question.ts`          | 108   | M8       |
| `functions/autograde/src/callable/release-exam-results.ts`           | 94    | --       |
| `functions/autograde/src/callable/link-exam-to-space.ts`             | 59    | M6       |
| `functions/autograde/src/utils/assertions.ts`                        | 73    | M5       |
| `functions/autograde/src/utils/firestore-helpers.ts`                 | 46    | m7       |
| `functions/autograde/src/utils/grading-helpers.ts`                   | 88    | --       |
| `functions/autograde/src/utils/llm.ts`                               | 159   | --       |
| `functions/autograde/src/types/index.ts`                             | 62    | m4       |
| `packages/shared-types/src/autograde/*.ts`                           | ~180  | --       |
| `packages/shared-hooks/src/queries/useExams.ts`                      | 36    | M2       |
| `packages/shared-hooks/src/queries/useSubmissions.ts`                | 36    | M1       |
| `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx`                | 379   | C3, C4   |
| `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`                | 372   | C3       |
| `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`               | 289   | C3       |
| `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`             | 517   | m2       |
| `apps/teacher-web/src/pages/exams/ExamListPage.tsx`                  | 181   | --       |
