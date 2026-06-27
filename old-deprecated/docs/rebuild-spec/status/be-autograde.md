# Status Report: `functions/autograde` (AutoGrade Backend)

> Audit date: 2026-06-19. Source of truth: real code under
> `functions/autograde/src/`, `packages/shared-types/src/autograde/`,
> `firestore.rules`, `firestore.indexes.json`, plus the original POC under
> top-level `autograde/`.

AutoGrade is the AI-driven exam-grading subsystem: teachers upload a scanned
question paper, the system extracts questions + rubrics with Gemini, students'
scanned answer sheets are uploaded, an AI "scouting" pass maps answer pages to
questions, and a per-question AI evaluation pass grades each answer against a
rubric. Teachers review/override, then release results.

---

## 1. What exists & how it's architected

A Firebase Cloud Functions (v2) TS package, region `asia-south1`, entrypoint
`functions/autograde/src/index.ts`. All exports fall into 4 kinds:

### Callable functions (HTTPS `onCall`)

| Function             | File                                   | Purpose                                                                                                                                                     |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saveExam`           | `src/callable/save-exam.ts`            | Consolidated CRUD + status machine for exams (replaces old `createExam`/`updateExam`/`publishExam`/`releaseExamResults`/`linkExamToSpace`). `512MiB`, 300s. |
| `gradeQuestion`      | `src/callable/grade-question.ts`       | Consolidated `mode: 'manual' \| 'retry' \| 'ai'` (replaces `manualGradeQuestion`/`retryFailedQuestions`). `4GiB`, 540s.                                     |
| `extractQuestions`   | `src/callable/extract-questions.ts`    | Gemini question + rubric extraction from QP images; `mode: 'full' \| 'single'`. `2GiB`, 540s.                                                               |
| `uploadAnswerSheets` | `src/callable/upload-answer-sheets.ts` | Creates a `submission` doc from already-uploaded storage paths; allows scanner role. `256MiB`, 300s.                                                        |

### Pipeline workers (plain async fns, not deployed; invoked by triggers)

| Worker                 | File                                     | Stage                                                                      |
| ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| `processAnswerMapping` | `src/pipeline/process-answer-mapping.ts` | Panopticon scouting → builds `routing_map`, creates `questionSubmissions`. |
| `processAnswerGrading` | `src/pipeline/process-answer-grading.ts` | RELMS per-question grading, batched concurrency, DLQ, confidence routing.  |
| `finalizeSubmission`   | `src/pipeline/finalize-submission.ts`    | Aggregates scores, sets `ready_for_review`, sends notifications.           |

### Firestore + Storage + Schedule triggers

| Trigger                         | File                                             | Fires on                                                                                           |
| ------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `onSubmissionCreated`           | `src/triggers/on-submission-created.ts`          | `submissions/{id}` create → start scouting inline.                                                 |
| `onSubmissionUpdated`           | `src/triggers/on-submission-updated.ts`          | `pipelineStatus` change → state-machine dispatcher (scouting→grading→finalize, retries, DLQ).      |
| `onQuestionSubmissionUpdatedV2` | `src/triggers/on-question-submission-updated.ts` | `questionSubmissions/{qid}` update → aggregate question statuses → set submission pipeline status. |
| `onExamPublished`               | `src/triggers/on-exam-published.ts`              | exam status → `published` → notify students.                                                       |
| `onResultsReleased`             | `src/triggers/on-results-released.ts`            | exam status → `results_released` → notify students/parents/teacher.                                |
| `onExamDeleted`                 | `src/triggers/on-exam-deleted.ts`                | exam delete → cascade delete questions, submissions, questionSubmissions, analytics.               |
| `onQuestionPaperUpload`         | `src/triggers/on-question-paper-upload.ts`       | GCS finalize on `.../question-paper/...` → append image, set `question_paper_uploaded`.            |
| `onAnswerSheetUpload`           | `src/triggers/on-answer-sheet-upload.ts`         | GCS finalize on `.../answer-sheets/{studentId}/...` → create/append submission (alt to callable).  |
| `staleSubmissionWatchdog`       | `src/schedulers/stale-submission-watchdog.ts`    | Every 15 min → finds `scouting`/`grading` submissions stale > 10 min, retries or escalates.        |

### Prompts (AI evaluation)

- `src/prompts/extraction.ts` — `EXTRACTION_SYSTEM_PROMPT` /
  `EXTRACTION_USER_PROMPT` + `parseExtractionResponse`.
- `src/prompts/panopticon.ts` — page→question routing prompt +
  `parsePanopticonResponse` (Q-prefix remap, "sandwich rule" gap-fill,
  out-of-range page filtering).
- `src/prompts/relms.ts` — dynamic per-question grading prompt built from
  question text + rubric criteria + enabled `EvaluationDimension`s;
  `parseRELMSResponse` (clamps score, fills arrays).

### Utils

`assertions.ts` (claims-based authz), `firestore-helpers.ts` (Zod-validated
reads), `grading-helpers.ts` (`calculateGrade`, `resolveRubric`,
`calculateSubmissionSummary`), `grading-queue.ts` (semaphore + `processBatch`),
`llm.ts` (`LLMWrapper` proxy to `@levelup/shared-services/ai` via `require()`,
`getGeminiApiKey` from Secret Manager `tenant-{tenantId}-gemini`),
`image-quality.ts`, `notification-sender.ts`, `rate-limit.ts` (re-export of
`@levelup/functions-shared`), `parse-request.ts` (Zod parse → `HttpsError`),
`secret-manager.ts`.

### Pipeline state machine (key design)

Pipeline chaining uses **Firestore triggers, not Cloud Tasks/PubSub** — an
explicit choice (see comment in `on-submission-created.ts`) so it works in the
emulator. Flow: `uploaded` → (`onSubmissionCreated` runs `processAnswerMapping`
inline) → `scouting_complete` → (`onSubmissionUpdated`) → `grading` →
(`processAnswerGrading`) → `grading_complete` → (`finalizeSubmission`) →
`ready_for_review` → teacher `reviewed`/release. Failure branches:
`scouting_failed`, `grading_partial`, `grading_failed`, `finalization_failed`,
`manual_review_needed`.

### Original POC (top-level `autograde/`)

A separate, older standalone monorepo: `autograde/functions/src/index.ts` shows
the POC **commented out all triggers/workers** because Cloud Tasks/EventArc
caused deploy conflicts — only callables (`extractQuestions`, user/scanner mgmt,
`chatWithAI`) were live. POC types live in
`autograde/packages/types/firestore.ts`. It also contains `apps/scanner-app`,
`apps/super-admin`, `apps/client-admin`, `developer-admin` (Vite). The current
`functions/autograde` is the evolved, trigger-based reimplementation; the POC is
effectively dead/reference code.

---

## 2. Entities / schemas / collections / APIs (file paths)

### Firestore collections (all tenant-scoped)

| Collection path                                                  | Entity                                                                    | Type def                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `tenants/{t}/exams/{examId}`                                     | `Exam`                                                                    | `packages/shared-types/src/autograde/exam.ts`                                   |
| `tenants/{t}/exams/{examId}/questions/{questionId}`              | `ExamQuestion` (+ `SubQuestion`)                                          | `.../autograde/exam-question.ts`                                                |
| `tenants/{t}/submissions/{submissionId}`                         | `Submission` (+ `AnswerSheetData`, `ScoutingResult`, `SubmissionSummary`) | `.../autograde/submission.ts`                                                   |
| `tenants/{t}/submissions/{sid}/questionSubmissions/{questionId}` | `QuestionSubmission` (+ `QuestionMapping`, `ManualOverride`)              | `.../autograde/question-submission.ts`                                          |
| `tenants/{t}/evaluationSettings/{settingsId}`                    | `EvaluationSettings`                                                      | `.../autograde/evaluation-settings.ts`                                          |
| `tenants/{t}/gradingDeadLetter/{entryId}`                        | `GradingDeadLetterEntry`                                                  | `.../autograde/dead-letter.ts`                                                  |
| `tenants/{t}/examAnalytics/{examId}`                             | `ExamAnalytics`                                                           | `.../autograde/exam-analytics.ts` (written by analytics-fn, deleted on cascade) |

Shared content types (`UnifiedRubric`, `RubricCriterion`, `EvaluationDimension`,
`UnifiedEvaluationResult`, `FeedbackItem`, `RubricBreakdownItem`) live in
`packages/shared-types/src/content/`. AutoGrade re-exports everything via
`functions/autograde/src/types/index.ts`.

### Status enums — `packages/shared-types/src/constants/grades.ts`

- `EXAM_STATUSES`: draft, question_paper_uploaded, question_paper_extracted,
  published, grading, completed, results_released, archived.
- `SUBMISSION_PIPELINE_STATUSES`: uploaded, ocr_processing, ocr_failed,
  scouting, scouting_failed, scouting_complete, grading, grading_partial,
  grading_failed, grading_complete, finalization_failed, ready_for_review,
  reviewed, failed, manual_review_needed.
- `QUESTION_GRADING_STATUSES`: pending, processing, graded, needs_review,
  failed, manual, overridden.

### Callable request schemas — `packages/shared-types/src/schemas/callable-schemas.ts`

`SaveExamRequestSchema` (L581), `GradeQuestionRequestSchema` (L628),
`ExtractQuestionsRequestSchema` (L640), `UploadAnswerSheetsRequestSchema`
(L649). Response types `SaveResponse`, `GradeQuestionResponse` from
shared-types.

### Access model

- `firestore.rules` L349-432: exams + questions + submissions +
  questionSubmissions rules (role + `createdBy`/`classIds`/`studentId` checks;
  status-gated student/parent reads). `evaluationSettings` at L562.
- `firestore.indexes.json`: composite indexes on `exams` and `submissions` (e.g.
  `submissions` by `examId`+`resultsReleased`, `examId`+`studentId`).
- Authz in code: `getCallerMembership` + `assertAutogradePermission`
  (`src/utils/assertions.ts`) reads `tenantId`/`role`/`permissions` from custom
  claims; permission gates: `canCreateExams`, `canGradeSubmissions`,
  `canReleaseResults`; scanner allowed only via `{ allowScanner: true }`.

---

## 3. Strengths worth keeping

- **Clean two-stage AI architecture (Panopticon scouting → RELMS grading).**
  Separating "which pages answer which question" from "grade this answer" is the
  right decomposition and works well with a large-context multimodal model. Keep
  this conceptually.
- **Rubric resolution chain** (`resolveRubric`): question rubric + exam-level
  `EvaluationSettings` + tenant-default settings → enabled
  `EvaluationDimension`s. Flexible and well-layered.
- **Confidence-based routing** (`process-answer-grading.ts` L403-418): low
  confidence → `needs_review`, very high → auto-approve, middle →
  graded+`reviewSuggested`. Thresholds configurable per-tenant. Good
  human-in-the-loop design.
- **Graceful degradation + DLQ**: service errors (quota/circuit/rate-limit)
  become `needs_review` (manually gradeable) instead of hard `failed`;
  `gradingDeadLetter` collection captures failures with attempts/step.
  `formatGradingError` maps raw errors to teacher-friendly text.
- **Stale-submission watchdog** + per-batch progress writes
  (`gradingProgress.*`) give resilience and real-time UI.
- **Consolidated callables** (`saveExam`, `gradeQuestion`) reduce surface area;
  `saveExam` enforces server-side status transitions and post-publish field
  locking (`POST_PUBLISH_LOCKED_FIELDS`).
- **Zod-validated reads** in `firestore-helpers.ts` catch data drift early.
- **Cost & token accounting** captured per-question (`evaluation.costUsd`,
  `tokensUsed`, `timingMs`) and rolled up to `exam.stats.totalGradingCostUsd`
  and tenant `usage.aiCallsThisMonth`.
- **Multi-tenant secret isolation**: per-tenant Gemini key via Secret Manager.

---

## 4. Pain points / tech debt / inconsistencies

- **Pipeline orchestration is duplicated and racy.** Final-status computation
  exists in BOTH `process-answer-grading.ts` (transaction L209-282) AND
  `on-question-submission-updated.ts` (L33-99) — they re-implement the same
  graded/failed/pending counting with subtly different logic. The grading worker
  also runs **inline inside the `onSubmissionUpdated` trigger** (a 4GiB/540s
  function), while `onQuestionSubmissionUpdatedV2` fires on every question
  write. This means the same submission's final status can be written by
  multiple concurrent handlers. The code admits this ("idempotent because it
  filters to pending"), but it's fragile.
- **Status-machine inconsistencies.** `saveExam` releasable statuses include
  `'grading_complete'` (L201) which is NOT an `ExamStatus` (it's a
  `SubmissionPipelineStatus`). `VALID_STATUS_TRANSITIONS` (L22-30) defines
  `grading→completed→results_released`, but no code ever sets exam status to
  `completed`; `uploadAnswerSheets` jumps exam `published→grading` directly.
  Dead/unreachable transition states.
- **`ocr` step is vestigial.** `DeadLetterPipelineStep` and pipeline statuses
  include `ocr_processing`/`ocr_failed`/`'ocr'`, but there is no OCR stage —
  scouting+grading send images straight to Gemini. Leftover from POC.
- **Two answer-sheet ingestion paths that diverge.** `uploadAnswerSheets`
  (callable) sets `uploadSource: 'web'|'scanner'`, but `onAnswerSheetUpload`
  (GCS trigger) sets `uploadSource: 'gcs'` and `uploadedBy: 'storage-trigger'` —
  `'gcs'` is not in the `AnswerSheetData.uploadSource` union
  (`'web'|'scanner'`). The trigger also derives `classId` from
  `student.classIds[0]` and skips the `classIds.includes` validation the
  callable enforces. Duplicate, drift-prone.
- **`LLMWrapper` loaded via `require()` with relative-path fallback**
  (`src/utils/llm.ts` L82-103) and locally re-declared types ("until
  shared-services ships .d.ts" — TODO L7). Brittle module resolution, type
  duplication.
- **Prompt parsing is hand-rolled**
  (`parseRELMSResponse`/`parsePanopticonResponse`/`parseExtractionResponse`):
  strip markdown fences, `JSON.parse`, ad-hoc key remapping. No schema-validated
  structured output despite `responseMimeType: 'application/json'`; the Gemini
  `responseSchema` option exists in `LLMCallOptions` but is unused.
- **`maxTokens` magic numbers** scattered with explanatory comments about Gemini
  2.5 thinking-token truncation (16384, 8192, 65536, 4096). Model name
  `gemini-2.5-flash` is hardcoded in 3 places.
- **N+1 image downloads.** Both scouting and grading download every image from
  GCS to base64 sequentially; grading re-downloads per question. No caching
  across stages.
- **`staleSubmissionWatchdog` scans ALL tenants every 15 min** with a
  per-tenant, per-status query — O(tenants) reads, won't scale.
- **Cross-domain coupling is implicit/string-based.**
  `linkedSpaceId`/`linkedStoryPointId` on `Exam`, `linkedItemId` on
  `ExamQuestion`, denormalized `studentName`/`rollNumber`/`classId` on
  submissions — no FK integrity; `finalizeSubmission` builds linked-space
  feedback from string concat.
- **Quota check is best-effort via dynamic import** (`process-answer-grading.ts`
  L61) and silently continues on failure.
- **Two manual-summary recalculation paths** (`grade-question.ts` manual mode vs
  `finalizeSubmission`) — `needs_review` is counted as "graded" in some places
  for pipeline progress but tentative AI scores leak into `totalScore`.
- **No API versioning, no DTO/transport layer.** Callables return raw shapes;
  clients (teacher-web, parent-web, future RN) talk to Firebase callables
  directly with no stable contract beyond the Zod request schemas.

---

## 5. Recommendations for a fresh rebuild

**Keep the core concepts:** the two-stage scouting→grading pipeline, rubric
resolution chain (question→exam→tenant), confidence-based human-in-the-loop
routing, per-tenant secret/quota isolation, DLQ + watchdog resilience, and the
entity model (`Exam` / `ExamQuestion` / `Submission` / `QuestionSubmission` /
`EvaluationSettings`). These are sound.

**Concrete improvements:**

1. **Single orchestrator, one source of truth for status.** Replace the
   trigger-runs-worker-inline pattern with one explicit orchestrator (a durable
   workflow: Cloud Tasks queue per stage, or Cloud Workflows, or a single
   `advancePipeline(submissionId)` reducer). Compute final submission status in
   exactly ONE place; delete the duplicated logic in
   `on-question-submission-updated.ts` vs `process-answer-grading.ts`. Make
   every transition idempotent and guarded by `pipelineStatus`.

2. **Introduce a thin common API layer (transport-agnostic).** Put grading/exam
   use-cases behind a service module with versioned DTOs (`v1`) so teacher-web,
   parent-web, scanner-app, and **future React Native** apps share one contract.
   Expose it as callables today; the same service layer can back an HTTP/REST or
   tRPC gateway later. RN cannot rely on GCS Storage triggers the way web does,
   so make `uploadAnswerSheets` (explicit submit-with-paths) the single
   canonical ingestion path and demote/remove the `onAnswerSheetUpload` GCS
   trigger (eliminating the `'gcs'`/`classId[0]` divergence).

3. **Use provider structured output.** Pass a JSON schema (`responseSchema`) to
   Gemini for extraction/scouting/grading and validate responses with Zod
   instead of regex-stripping fences and remapping keys. Move `gemini-2.5-flash`
   and `maxTokens` into config/`EvaluationSettings`, not literals.

4. **Clean up the status taxonomy.** Drop the vestigial `ocr*` states and the
   unreachable `completed` exam status (or actually use it). Make
   `AnswerSheetData.uploadSource` include every real source. Validate transition
   tables against the type unions at build time.

5. **Stabilize the LLM dependency.** Ship compiled `.d.ts` from
   `@levelup/shared-services` and import `LLMWrapper` normally; remove the
   `require()` + relative-path fallback + locally duplicated interfaces.

6. **Scale the watchdog & image handling.** Drive the watchdog off a
   collection-group query with a `pipelineStatus`+`updatedAt` index instead of
   iterating all tenants. Download each answer image once during scouting, store
   resized/normalized bytes (or signed refs) and reuse in grading.

7. **Make cross-domain links first-class.** Model
   `linkedSpace`/`linkedStoryPoint` and per-question `linkedItem` as typed
   references with integrity checks, and centralize the "practice this space"
   feedback generation rather than string concatenation in `finalizeSubmission`.

8. **Tighten the financial/quota path.** Make the quota gate a hard, well-typed
   pre-check (not a swallowed dynamic import) and accumulate cost in a single
   transactional rollup.

9. **Retire the top-level `autograde/` POC** from the active tree (or archive
   it) to remove confusion between the Cloud-Tasks POC and the trigger-based
   current implementation.
