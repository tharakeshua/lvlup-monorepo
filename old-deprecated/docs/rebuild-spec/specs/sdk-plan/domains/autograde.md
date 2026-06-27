# SDK Rebuild Plan — Domain: `autograde`

> **Scope.** Exams, exam-questions, answer-sheet submissions, the two-stage AI
> grading pipeline (Panopticon scouting → RELMS grading), per-question grading
> results, evaluation settings, the grading dead-letter queue (DLQ), exam
> analytics (read-side), and answer-sheet / question-paper ingestion.
>
> **Module key:** `autograde` · **Codebase:** `functions/autograde` ·
> **Region:** `asia-south1`.
>
> Grounded by: `status/be-autograde.md`,
> `packages/shared-types/src/autograde/*`, `functions/autograde/src/callable/*`,
> `status/REVIEW-domain-data-model.md` (§6 authority boundary, drift table D12),
> `specs/SDK-SERVER-DESIGN.md`, `specs/common-api.md` (§ autograde inventory,
> lines 146–151).
>
> This plan is the full vertical slice across all SDK + server layers. It is a
> **plan, not code**.

---

## Drift reconciliations applied throughout (from REVIEW)

These are the non-negotiable cleanups this domain inherits from
`REVIEW-domain-data-model.md`, applied to **every** entity/contract/service
below:

1. **ISO-8601 `Timestamp` everywhere** — replace
   `FirestoreTimestamp {seconds,nanoseconds}` (audit fields) and any
   epoch-millis with the domain `Timestamp` branded ISO string. The admin
   repository adapter is the only place that converts Firestore `Timestamp` ⇄
   ISO (D4).
2. **Branded IDs on persisted shapes** — `ExamId`, `ExamQuestionId`,
   `SubmissionId`, `QuestionSubmissionId`, `EvaluationSettingsId`,
   `DeadLetterEntryId`, plus borrowed `TenantId`, `ClassId`, `StudentId`,
   `UserId`, `SpaceId`, `StoryPointId`, `ItemId` (D8; spec §3 adds
   `ExamQuestionId`).
3. **`authUid` not `uid`** — `createdBy`, `uploadedBy`, `overriddenBy`,
   `resultsReleasedBy`, `resolvedBy` are `UserId` (the auth uid), never a
   `uid`/`authUid` schism (D3).
4. **`uploadSource` union closed** — `'web' | 'scanner' | 'rn'`; the stray
   `'gcs'` value is **dropped** along with the `onAnswerSheetUpload` GCS trigger
   (D12; common-api line 149; be-autograde rec #2).
5. **`.strict()` Zod-first** — every entity/request/response is authored as a
   `.strict()` Zod schema with types via `z.infer`; no `.passthrough()`, no
   separate hand-written interface (D9).
6. **Status taxonomy cleanup** — drop vestigial `ocr_processing` / `ocr_failed`
   pipeline statuses and the DLQ `'ocr'` step; drop the unreachable
   `'completed'` exam status (be-autograde §4, rec #4; REVIEW open-Qs).
   `ALLOWED_TRANSITIONS` is build-time-validated data against the cleaned enums.
7. **Embedded shared core kept** — `UnifiedRubric`, `UnifiedEvaluationResult`,
   `EvaluationDimension`, `RubricCriterion` stay imported from `@levelup/domain`
   content schemas (REVIEW §2 — "best-built part"). Rubric is embedded **by
   value** on questions (extraction writes a resolved snapshot); the resolution
   chain (tenant→exam→question) is resolved-and-stored, with
   `evaluationSettingsId` as the source ref.
8. **Record-map analytics tolerated read-side** —
   `ExamAnalytics.questionAnalytics/classBreakdown/...` stay `Record<...>` maps
   for now (read-only projection written by analytics-fn); flagged in open
   questions (D6).

---

## Domain entities (`@levelup/domain`)

All entities live under `@levelup/domain/autograde`. All are `.strict()` Zod
schemas; types via `z.infer`. ISO `Timestamp`, branded IDs throughout.
`AuditFields = { createdAt, updatedAt, createdBy? }`.

### Branded IDs (add to `@levelup/domain/ids`)

`ExamId`, `ExamQuestionId`, `SubmissionId`, `QuestionSubmissionId`,
`EvaluationSettingsId`, `DeadLetterEntryId`, `ExamAnalyticsId`. (Borrowed:
`TenantId`, `ClassId`, `StudentId`, `UserId`, `SpaceId`, `StoryPointId`,
`ItemId`.)

### Status enums + state machines

```ts
// @levelup/domain/autograde/enums.ts
export const EXAM_STATUSES = [
  "draft",
  "question_paper_uploaded",
  "question_paper_extracted",
  "published",
  "grading",
  "results_released",
  "archived", // 'completed' DROPPED (unreachable)
] as const;
export const SubmissionPipelineStatusSchema = z.enum([
  "uploaded",
  "scouting",
  "scouting_failed",
  "scouting_complete",
  "grading",
  "grading_partial",
  "grading_failed",
  "grading_complete",
  "finalization_failed",
  "ready_for_review",
  "reviewed",
  "failed",
  "manual_review_needed",
  // 'ocr_processing' / 'ocr_failed' DROPPED (vestigial)
]);
export const QUESTION_GRADING_STATUSES = [
  "pending",
  "processing",
  "graded",
  "needs_review",
  "failed",
  "manual",
  "overridden",
] as const;
```

**`ALLOWED_TRANSITIONS.exam`** (build-time-checked against `EXAM_STATUSES`):

```
draft                    → [question_paper_uploaded, archived]
question_paper_uploaded  → [question_paper_extracted, archived]
question_paper_extracted → [published, archived]
published                → [grading, archived]
grading                  → [results_released, archived]
results_released         → [archived]
archived                 → []
```

**`ALLOWED_TRANSITIONS.submission`** (pipeline; build-time-checked against
`SUBMISSION_PIPELINE_STATUSES`):

```
uploaded            → [scouting]
scouting            → [scouting_complete, scouting_failed]
scouting_failed     → [scouting, manual_review_needed]
scouting_complete   → [grading]
grading             → [grading_complete, grading_partial, grading_failed, manual_review_needed]
grading_partial     → [grading]                      // retry path
grading_failed      → [grading, manual_review_needed]
grading_complete    → [ready_for_review, finalization_failed]
finalization_failed → [grading_complete]
ready_for_review    → [reviewed]
reviewed            → []                              // terminal (resultsReleased is a separate flag)
manual_review_needed→ [grading, reviewed]
failed              → []
```

**`ALLOWED_TRANSITIONS.questionGrading`** (build-time-checked against
`QUESTION_GRADING_STATUSES`):

```
pending     → [processing]
processing  → [graded, needs_review, failed]
graded      → [overridden]
needs_review→ [graded, manual, overridden]
failed      → [pending, manual]
manual      → [overridden]
overridden  → []
```

### Entities

| Entity                                   | Branded ID             | Collection                                             | Key fields (post-reconciliation)                                                                                                                                                                                                                                                                                                                                 | Notes                                                                                                                                                                                 |
| ---------------------------------------- | ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`Exam`**                               | `ExamId`               | `tenants/{t}/exams/{examId}`                           | `title, subject, topics[], classIds[], sectionIds?[], examDate(ISO), duration, academicSessionId?, totalMarks, passingMarks, status(ExamStatus), questionPaper?(ExamQuestionPaper), gradingConfig(ExamGradingConfig), evaluationSettingsId?, linkedSpaceId?, linkedSpaceTitle?, linkedStoryPointId?, stats?(ExamStats), createdBy(UserId), createdAt, updatedAt` | `status` machine = `ALLOWED_TRANSITIONS.exam`; `tenantId` **removed from the entity shape** (path-scoped; server fills) — kept only as a server-side annotation, never in client req. |
| **`ExamQuestionPaper`** (embed)          | —                      | embedded on `Exam`                                     | `images: StoragePath[], extractedAt?, questionCount, examType:'standard'`                                                                                                                                                                                                                                                                                        | `images` are tenant storage paths, not URLs.                                                                                                                                          |
| **`ExamGradingConfig`** (embed)          | —                      | embedded on `Exam`                                     | `autoGrade, allowRubricEdit, evaluationSettingsId?, allowManualOverride, requireOverrideReason, releaseResultsAutomatically`                                                                                                                                                                                                                                     | server-authoritative once exam published (post-publish locked fields).                                                                                                                |
| **`ExamStats`** (embed)                  | —                      | embedded on `Exam`                                     | `totalSubmissions, gradedSubmissions, avgScore, passRate`                                                                                                                                                                                                                                                                                                        | trigger/service-maintained counter (⚷).                                                                                                                                               |
| **`ExamQuestion`**                       | `ExamQuestionId`       | `…/exams/{examId}/questions/{questionId}`              | `examId, text, imageUrls?[], maxMarks, order, rubric(UnifiedRubric), questionType?, subQuestions?(SubQuestion[]), linkedItemId?(ItemId), extractedBy?, extractedAt?, extractionConfidence?, readabilityIssue?, createdAt, updatedAt`                                                                                                                             | `rubric` = embedded resolved snapshot (shared `UnifiedRubric`). `evaluatorGuidance`/`modelAnswer` inside rubric are ⚷ projected-out for non-authoring roles.                          |
| **`SubQuestion`** (embed)                | —                      | embedded on `ExamQuestion`                             | `label, text, maxMarks, rubric?(UnifiedRubric)`                                                                                                                                                                                                                                                                                                                  |                                                                                                                                                                                       |
| **`Submission`**                         | `SubmissionId`         | `tenants/{t}/submissions/{submissionId}`               | `examId, studentId, studentName, rollNumber, classId, answerSheets(AnswerSheetData), scoutingResult?(ScoutingResult), summary(SubmissionSummary), pipelineStatus, pipelineError?, retryCount, watchdogRetryCount?, gradingProgress?, resultsReleased, resultsReleasedAt?, resultsReleasedBy?(UserId), createdAt, updatedAt`                                      | `pipelineStatus` machine = `ALLOWED_TRANSITIONS.submission` (⚷). `resultsReleased` is the visibility gate (⚷).                                                                        |
| **`AnswerSheetData`** (embed)            | —                      | embedded on `Submission`                               | `images: StoragePath[], uploadedAt, uploadedBy(UserId), uploadSource:'web'\|'scanner'\|'rn'`                                                                                                                                                                                                                                                                     | `'gcs'` dropped (D12).                                                                                                                                                                |
| **`ScoutingResult`** (embed)             | —                      | embedded on `Submission`                               | `routingMap: Record<ExamQuestionId, number[]>, confidence: Record<ExamQuestionId, number>, completedAt`                                                                                                                                                                                                                                                          | written by scouting worker only.                                                                                                                                                      |
| **`SubmissionSummary`** (embed)          | —                      | embedded on `Submission`                               | `totalScore, maxScore, percentage, grade, questionsGraded, totalQuestions, completedAt?`                                                                                                                                                                                                                                                                         | server-computed (⚷); never client-written.                                                                                                                                            |
| **`QuestionSubmission`**                 | `QuestionSubmissionId` | `…/submissions/{sid}/questionSubmissions/{questionId}` | `submissionId, questionId(ExamQuestionId), examId, mapping(QuestionMapping), evaluation?(UnifiedEvaluationResult), gradingStatus, gradingError?, gradingRetryCount, manualOverride?(ManualOverride), createdAt, updatedAt`                                                                                                                                       | `evaluation` = shared `UnifiedEvaluationResult` (⚷). `gradingStatus` machine = `ALLOWED_TRANSITIONS.questionGrading`.                                                                 |
| **`QuestionMapping`** (embed)            | —                      | embedded on `QuestionSubmission`                       | `pageIndices: number[], imageUrls: StoragePath[], scoutedAt`                                                                                                                                                                                                                                                                                                     | from scouting phase.                                                                                                                                                                  |
| **`ManualOverride`** (embed)             | —                      | embedded on `QuestionSubmission`                       | `score, reason, overriddenBy(UserId), overriddenAt, originalScore`                                                                                                                                                                                                                                                                                               | written only by `gradeQuestion(mode:'manual')` service (⚷).                                                                                                                           |
| **`EvaluationSettings`**                 | `EvaluationSettingsId` | `tenants/{t}/evaluationSettings/{settingsId}`          | `name, description?, isDefault, isPublic?, enabledDimensions(EvaluationDimension[]), displaySettings(EvaluationDisplaySettings), confidenceConfig?(EvaluationConfidenceConfig), usageQuota?(UsageQuotaConfig), createdBy?(UserId), createdAt, updatedAt`                                                                                                         | thresholds (`confidenceConfig`) + `promptGuidance` on dimensions are ⚷ authoring-role-only.                                                                                           |
| **`EvaluationDisplaySettings`** (embed)  | —                      | embedded                                               | `showStrengths, showKeyTakeaway, prioritizeByImportance`                                                                                                                                                                                                                                                                                                         |                                                                                                                                                                                       |
| **`EvaluationConfidenceConfig`** (embed) | —                      | embedded                                               | `confidenceThreshold(0.7), autoApproveThreshold(0.9), requireReviewForPartialCredit`                                                                                                                                                                                                                                                                             | drives HITL routing (⚷).                                                                                                                                                              |
| **`UsageQuotaConfig`** (embed)           | —                      | embedded                                               | `monthlyBudgetUsd, dailyCallLimit, warningThresholdPercent(80)`                                                                                                                                                                                                                                                                                                  | quota enforcement (⚷).                                                                                                                                                                |
| **`GradingDeadLetterEntry`**             | `DeadLetterEntryId`    | `tenants/{t}/gradingDeadLetter/{entryId}`              | `submissionId, questionSubmissionId?, pipelineStep:'scouting'\|'grading', error, errorStack?, attempts, lastAttemptAt, resolvedAt?, resolvedBy?(UserId), resolutionMethod?:'retry_success'\|'manual_grade'\|'dismissed', createdAt`                                                                                                                              | `'ocr'` step dropped (D6/reconciliation #6).                                                                                                                                          |
| **`ExamAnalytics`** (read-only here)     | `ExamAnalyticsId`      | `tenants/{t}/examAnalytics/{examId}`                   | `examId, totalSubmissions, gradedSubmissions, avgScore, avgPercentage, passRate, medianScore, scoreDistribution, questionAnalytics: Record<...>, classBreakdown: Record<...>, topicPerformance: Record<...>, computedAt, lastUpdatedAt`                                                                                                                          | **Written by analytics-fn**, read by autograde repos/hooks. Subscoped here as a read entity only; `Record`-maps tolerated (D6 open-Q).                                                |

**Shared content schemas (imported, not redefined):** `UnifiedRubric`,
`RubricCriterion`, `RubricCriterionLevel`, `EvaluationDimension`,
`UnifiedEvaluationResult`, `FeedbackItem`, `RubricBreakdownItem` from
`@levelup/domain/content`. These get their first real `.strict()` Zod schemas in
the domain rebuild (REVIEW §4 — currently pure interfaces, no schema).

---

## API contract (`@levelup/api-contract`)

Each callable is a `CallableDef`. **No request schema contains a `tenantId`
field** (claim-derived server-side; D2 — the #1 boundary). Combined-mode
discriminators (`gradeQuestion.mode`, `extractQuestions.mode`) are kept. Read
endpoints replace all current direct-Firestore reads from teacher-web /
parent-web / scanner.

### Writes / commands

| Callable name                                            | module    | request schema (fields)                                                                                                                                                                                                                                                                                                    | response schema                                                                                                                                                                            | authMode                      | rateTier | idempotent | invalidates[]                                                                      |
| -------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | -------- | ---------- | ---------------------------------------------------------------------------------- |
| `v1.autograde.saveExam`                                  | autograde | `{ id?: ExamId, data: { title?, subject?, topics?, classIds?, sectionIds?, examDate?(ISO), duration?, academicSessionId?, totalMarks?, passingMarks?, gradingConfig?(strict), linkedSpaceId?, linkedSpaceTitle?, linkedStoryPointId?, status?(ExamStatus), evaluationSettingsId?, questionPaperImages?(StoragePath[]) } }` | `SaveResponse { id: ExamId, created: boolean }`                                                                                                                                            | authed                        | write    | yes        | `examKeys.all`, `examKeys.detail(id)`                                              |
| `v1.autograde.extractQuestions`                          | autograde | `{ examId: ExamId, mode?: 'full'\|'single', questionNumber?: string }`                                                                                                                                                                                                                                                     | `ExtractQuestionsResponse { success, questions: ExtractedQuestion[], warnings: string[], metadata: { questionCount, tokensUsed, cost, extractedAt(ISO), imageQualityAcceptable, mode? } }` | authed                        | ai       | yes        | `examKeys.detail(examId)`, `questionKeys.list(examId)`                             |
| `v1.autograde.uploadAnswerSheets`                        | autograde | `{ examId: ExamId, studentId: StudentId, classId: ClassId, imageUrls: StoragePath[] (1..50) }`                                                                                                                                                                                                                             | `UploadAnswerSheetsResponse { submissionId: SubmissionId }`                                                                                                                                | authed (scanner role allowed) | ai       | yes        | `submissionKeys.list({examId})`, `examKeys.detail(examId)`                         |
| `v1.autograde.gradeQuestion`                             | autograde | `{ mode: 'manual'\|'retry'\|'ai', submissionId?: SubmissionId, questionId?: ExamQuestionId, score?, feedback?, examId?: ExamId, questionIds?: ExamQuestionId[] }` (discriminated by `mode`)                                                                                                                                | `GradeQuestionResponse { success, updatedScore?, gradingStatus?, retriedCount? }`                                                                                                          | authed                        | ai       | yes        | `submissionKeys.detail(submissionId)`, `questionSubmissionKeys.list(submissionId)` |
| `v1.autograde.saveEvaluationSettings` _(new)_            | autograde | `{ id?: EvaluationSettingsId, data: { name?, description?, isDefault?, isPublic?, enabledDimensions?(EvaluationDimension[]), displaySettings?, confidenceConfig?, usageQuota? } }`                                                                                                                                         | `SaveResponse { id, created }`                                                                                                                                                             | authed                        | write    | yes        | `evalSettingsKeys.all`                                                             |
| `v1.autograde.resolveDeadLetter` _(new)_                 | autograde | `{ entryId: DeadLetterEntryId, method: 'retry'\|'manual_grade'\|'dismiss' }`                                                                                                                                                                                                                                               | `{ success: boolean, resolution: DeadLetterResolutionMethod }`                                                                                                                             | authed                        | write    | yes        | `deadLetterKeys.list`, `submissionKeys.detail(...)`                                |
| `v1.autograde.releaseResults` _(carved out of saveExam)_ | autograde | `{ examId: ExamId, classIds?: ClassId[] }`                                                                                                                                                                                                                                                                                 | `{ id: ExamId, releasedCount: number, created: false }`                                                                                                                                    | authed                        | write    | yes        | `examKeys.detail(examId)`, `submissionKeys.list({examId})`                         |

> **Note on `releaseResults`.** Today result-release is overloaded into
> `saveExam` (status=`results_released`), mixing a lifecycle transition with a
> batch submission mutation + notifications. The rebuild splits it into a
> dedicated, idempotent callable backed by its own service + outbox notification
> (be-autograde §4 status-machine inconsistency: `'grading_complete'` is wrongly
> listed as a releasable _exam_ status — fixed by gating on the submission
> pipeline status only). `saveExam` retains all **other** transitions and field
> updates.

### Reads (replace direct Firestore — common-api lines 150–151)

| Callable name                                 | module    | request schema                                                                                                | response schema                                                                               | authMode | rateTier | invalidates |
| --------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- | -------- | ----------- |
| `v1.autograde.listExams`                      | autograde | `{ ...PageRequest, filter?: { status?, classId?, academicSessionId?, subject?, linkedSpaceId? } }`            | `Page<ExamListView>`                                                                          | authed   | read     | —           |
| `v1.autograde.getExam`                        | autograde | `{ id: ExamId }`                                                                                              | `ExamDetailView`                                                                              | authed   | read     | —           |
| `v1.autograde.listQuestions`                  | autograde | `{ examId: ExamId }`                                                                                          | `{ questions: ExamQuestionView[] }` (rubric guidance projected by role)                       | authed   | read     | —           |
| `v1.autograde.listSubmissions`                | autograde | `{ ...PageRequest, filter: { examId: ExamId, classId?, studentId?, pipelineStatus?, resultsReleasedOnly? } }` | `Page<SubmissionListView>`                                                                    | authed   | read     | —           |
| `v1.autograde.getSubmission`                  | autograde | `{ id: SubmissionId }`                                                                                        | `SubmissionDetailView` (released-only for student/parent; full for teacher)                   | authed   | read     | —           |
| `v1.autograde.listQuestionSubmissions`        | autograde | `{ submissionId: SubmissionId }`                                                                              | `{ questionSubmissions: QuestionSubmissionView[] }` (released-gate + answer-key projection ⚷) | authed   | read     | —           |
| `v1.autograde.getExamAnalytics`               | autograde | `{ examId: ExamId }`                                                                                          | `ExamAnalyticsView`                                                                           | authed   | read     | —           |
| `v1.autograde.listEvaluationSettings` _(new)_ | autograde | `{ includePublic?: boolean }`                                                                                 | `{ settings: EvaluationSettingsView[] }` (thresholds visible to authoring roles only)         | authed   | read     | —           |
| `v1.autograde.listDeadLetter` _(new)_         | autograde | `{ ...PageRequest, filter?: { resolved?: boolean, pipelineStep? } }`                                          | `Page<DeadLetterView>`                                                                        | authed   | read     | —           |

### SUBSCRIPTIONS (realtime seam — `@levelup/api-contract`)

```ts
SUBSCRIPTIONS = {
  "v1.autograde.gradingStatus": {
    params: z.object({ submissionId: SubmissionId }),
    payload: SubmissionStatusSchema,
  },
  // payload = { pipelineStatus, retryCount, gradingProgress?: { graded, total, batchIndex }, summary, updatedAt }
  "v1.autograde.examGrading": {
    params: z.object({ examId: ExamId }),
    payload: ExamGradingProgressSchema,
  },
  // aggregate live progress across an exam's submissions for the grading dashboard
};
```

`gradingStatus` is the live per-submission pipeline ticker (drives the teacher
grading-review UI's progress bar). `examGrading` aggregates `stats` +
per-submission status counts for the exam dashboard. Firestore listener under
the submission doc / a `submissions where examId==` query.

---

## Repositories (`@levelup/repositories`)

All repos are framework-free, depend only on `api-client` + `@levelup/domain`.
Cursor management hidden behind `paginate()`. Transition pre-checks read
`ALLOWED_TRANSITIONS` from the contract (UX only — server enforces). View repos
marked **⊕** assemble cross-entity view-models.

### `examRepo`

- `list(filter?, cursor?) → Page<ExamListView>` — over `listExams`; cursor mgmt
  hidden.
- `get(id) → ExamDetailView` — over `getExam`.
- `save(input: SaveExamInput) → SaveResponse` — over `saveExam`; fills defaults
  for `gradingConfig`.
- `extractQuestions(input) → ExtractQuestionsResponse` — over
  `extractQuestions`.
- `releaseResults(examId, classIds?) → { releasedCount }` — over
  `releaseResults`.
- **Derived / pre-checks:**
  - `canTransition(from, to): boolean` —
    `ALLOWED_TRANSITIONS.exam[from]?.includes(to)`.
  - `canPublish(exam, questions): { ok, reasons[] }` — pre-mirrors server
    `validatePublish` (≥1 question, each question rubric criteria sum ==
    maxMarks, status==`question_paper_extracted`).
  - `canReleaseResults(exam): boolean` — status ∈
    {`grading`,`results_released`}.
  - `derivePassRate(stats)`, `gradedPct(stats)` — UI computed fields.

### `examQuestionRepo`

- `list(examId) → ExamQuestionView[]` — over `listQuestions`.
- `reExtract(examId, questionNumber) → ExtractQuestionsResponse` — over
  `extractQuestions(mode:'single')`.
- **Derived:** `rubricCriteriaSum(q)`, `rubricMatchesMaxMarks(q): boolean`
  (publish pre-check helper), `isAuthoringView(q): boolean` (whether guidance
  fields are present → role-gated).

### `submissionRepo`

- `list(filter, cursor?) → Page<SubmissionListView>` — over `listSubmissions`;
  **N+1 collapse**: the server pre-joins `studentName`/`rollNumber`/`classId`
  (denormalized) so the repo never fans out per student (replaces
  parent-web/teacher-web per-row reads — REVIEW N+1 flag).
- `get(id) → SubmissionDetailView` — over `getSubmission`.
- `upload(input: UploadAnswerSheetsInput) → { submissionId }` — over
  `uploadAnswerSheets` (single canonical ingestion path; scanner-rn calls this
  exact method).
- **Derived / pre-checks:**
  - `canTransition(from, to)` — `ALLOWED_TRANSITIONS.submission`.
  - `isResultVisible(sub, role)` — `sub.resultsReleased || role==='teacher'` (UX
    gate; server enforces).
  - `pipelinePhase(status): 'ingest'|'scouting'|'grading'|'review'|'failed'|'done'`
    — UI grouping.
  - `progressPct(sub)` — from
    `summary.questionsGraded / summary.totalQuestions`.

### `questionSubmissionRepo`

- `list(submissionId) → QuestionSubmissionView[]` — over
  `listQuestionSubmissions`.
- `gradeManual({ submissionId, questionId, score, feedback }) → GradeQuestionResponse`
  — `gradeQuestion(mode:'manual')`.
- `retry({ submissionId, questionIds? }) → GradeQuestionResponse` —
  `gradeQuestion(mode:'retry')`.
- `gradeAi({ submissionId, questionId }) → GradeQuestionResponse` —
  `gradeQuestion(mode:'ai')`.
- **Derived:** `effectiveScore(qs)`
  (`manualOverride?.score ?? evaluation?.score`), `needsReview(qs)`,
  `confidenceBand(qs)` (low/mid/high vs thresholds — UI HITL badge).

### `evaluationSettingsRepo`

- `list(includePublic?) → EvaluationSettingsView[]` — over
  `listEvaluationSettings`.
- `save(input) → SaveResponse` — over `saveEvaluationSettings`.
- **Derived:** `defaultSettings(list)`, `enabledDimensionIds(s)`.

### `deadLetterRepo`

- `list(filter?, cursor?) → Page<DeadLetterView>` — over `listDeadLetter`.
- `resolve({ entryId, method }) → { resolution }` — over `resolveDeadLetter`.

### `examAnalyticsRepo` ⊕ (read-only view)

- `get(examId) → ExamAnalyticsView` — over `getExamAnalytics`.
- **Shaping:** turns `questionAnalytics`/`classBreakdown` `Record`-maps into
  sorted arrays for chart rendering; computes grade-distribution percentages;
  never written here.

### `gradingReviewRepo` ⊕ (cross-entity view repo — teacher grading dashboard)

- `getReviewBundle(submissionId) → GradingReviewView` — **batched assembly** of
  `getSubmission` + `listQuestionSubmissions` + `listQuestions` (rubric for
  display) in one repo call, collapsing what is today 3 separate client reads.
  Marks per-question `effectiveScore`, `confidenceBand`, rubric-breakdown.
- `getExamGradingOverview(examId) → ExamGradingOverview` — `getExam` +
  `listSubmissions` + `getExamAnalytics` for the per-exam grading dashboard; one
  repo method, server-batched reads.

---

## Query hooks (`@levelup/query`)

Query-key factories + invalidation graph. **Conservative optimistic
allow-list:** none of autograde's mutations qualify — grading,
publish/lifecycle, release, and upload are all authority-sensitive (§4 ⚷ rows).
Every mutation round-trips and invalidates; **no optimistic recipes** in this
domain (spec §5.5).

### Key factories

```ts
examKeys = {
  all: ["exams"],
  list: (f) => [...all, "list", f],
  detail: (id) => [...all, "detail", id],
};
questionKeys = { list: (examId) => ["exams", examId, "questions"] };
submissionKeys = {
  all: ["submissions"],
  list: (f) => [...all, "list", f],
  detail: (id) => [...all, "detail", id],
};
questionSubmissionKeys = {
  list: (submissionId) => ["submissions", submissionId, "questionSubmissions"],
};
evalSettingsKeys = {
  all: ["evaluationSettings"],
  list: (f) => [...all, "list", f],
};
deadLetterKeys = {
  all: ["gradingDeadLetter"],
  list: (f) => [...all, "list", f],
};
examAnalyticsKeys = { detail: (examId) => ["examAnalytics", examId] };
gradingReviewKeys = {
  bundle: (sid) => ["gradingReview", sid],
  overview: (examId) => ["gradingReview", "exam", examId],
};
```

### Hooks

| Hook                                     | repo method                                | type           | invalidates on success                                                                            | optimistic |
| ---------------------------------------- | ------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| `useExams(filter?)`                      | `examRepo.list`                            | infinite query | —                                                                                                 | —          |
| `useExam(id)`                            | `examRepo.get`                             | query          | —                                                                                                 | —          |
| `useSaveExam()`                          | `examRepo.save`                            | mutation       | `examKeys.all`, `examKeys.detail(id)`                                                             | ❌         |
| `useExtractQuestions()`                  | `examRepo.extractQuestions`                | mutation       | `examKeys.detail(examId)`, `questionKeys.list(examId)`                                            | ❌         |
| `useReleaseResults()`                    | `examRepo.releaseResults`                  | mutation       | `examKeys.detail(examId)`, `submissionKeys.list({examId})`                                        | ❌         |
| `useExamQuestions(examId)`               | `examQuestionRepo.list`                    | query          | —                                                                                                 | —          |
| `useReExtractQuestion()`                 | `examQuestionRepo.reExtract`               | mutation       | `questionKeys.list(examId)`                                                                       | ❌         |
| `useSubmissions(filter)`                 | `submissionRepo.list`                      | infinite query | —                                                                                                 | —          |
| `useSubmission(id)`                      | `submissionRepo.get`                       | query          | —                                                                                                 | —          |
| `useUploadAnswerSheets()`                | `submissionRepo.upload`                    | mutation       | `submissionKeys.list({examId})`, `examKeys.detail(examId)`                                        | ❌         |
| `useQuestionSubmissions(submissionId)`   | `questionSubmissionRepo.list`              | query          | —                                                                                                 | —          |
| `useGradeManual()`                       | `questionSubmissionRepo.gradeManual`       | mutation       | `questionSubmissionKeys.list(sid)`, `submissionKeys.detail(sid)`, `gradingReviewKeys.bundle(sid)` | ❌         |
| `useRetryGrading()`                      | `questionSubmissionRepo.retry`             | mutation       | same as above                                                                                     | ❌         |
| `useAiGradeQuestion()`                   | `questionSubmissionRepo.gradeAi`           | mutation       | same as above                                                                                     | ❌         |
| `useEvaluationSettings(includePublic?)`  | `evaluationSettingsRepo.list`              | query          | —                                                                                                 | —          |
| `useSaveEvaluationSettings()`            | `evaluationSettingsRepo.save`              | mutation       | `evalSettingsKeys.all`                                                                            | ❌         |
| `useDeadLetterEntries(filter?)`          | `deadLetterRepo.list`                      | infinite query | —                                                                                                 | —          |
| `useResolveDeadLetter()`                 | `deadLetterRepo.resolve`                   | mutation       | `deadLetterKeys.list`, `submissionKeys.detail(...)`                                               | ❌         |
| `useExamAnalytics(examId)`               | `examAnalyticsRepo.get`                    | query          | —                                                                                                 | —          |
| `useGradingReviewBundle(submissionId)` ⊕ | `gradingReviewRepo.getReviewBundle`        | query          | —                                                                                                 | —          |
| `useExamGradingOverview(examId)` ⊕       | `gradingReviewRepo.getExamGradingOverview` | query          | —                                                                                                 | —          |

### Realtime hooks (`@levelup/realtime`)

| Hook                             | subscription                 | drives                                       |
| -------------------------------- | ---------------------------- | -------------------------------------------- |
| `useGradingStatus(submissionId)` | `v1.autograde.gradingStatus` | live pipeline progress bar in grading-review |
| `useExamGradingProgress(examId)` | `v1.autograde.examGrading`   | exam dashboard live counts                   |

---

## Server services (`@levelup/services/{shared,server}`)

Every service is `fn(input, ctx: AuthContext): Promise<output>` — never imports
`firebase-functions`; `tenantId` comes from `ctx` (claims), never `input`.
`authorize(ctx, policyKey, resource)` from `@levelup/access`. Server-only
services (in `services/server`) own answer keys, grading/scoring, counters,
secrets, AI cost. Client-safe shaping (read projections) can live in
`services/shared` but the **authority** half stays server.

### Command services (`services/server`)

| Service                                     | policy key(s)                                  | server-only authority                                                                                                                                                                                                     | notes                                                                                 |
| ------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `saveExamService(input, ctx)`               | `exam.create` / `exam.update` / `exam.publish` | exam lifecycle `assertTransition(ALLOWED_TRANSITIONS.exam)`, `POST_PUBLISH_LOCKED_FIELDS` enforcement, `validatePublish` (rubric-sum check), `usage.examsThisMonth` counter                                               | replaces create/update/publish/link branches; `tenantId` from ctx.                    |
| `releaseResultsService(input, ctx)`         | `exam.releaseResults`                          | flips `resultsReleased` on releasable submissions (pipeline status ∈ {`grading_complete`,`ready_for_review`,`reviewed`}), sets exam `results_released`, **enqueues outbox** result-release notification                   | carved out of `saveExam`; fixes the `'grading_complete'`-as-exam-status bug.          |
| `extractQuestionsService(input, ctx)`       | `exam.create` (authoring)                      | Gemini call via `@levelup/ai` seam (per-tenant Secret Manager key), writes questions + resolved rubric snapshot, exam→`question_paper_extracted`, **AI cost rollup**                                                      | structured-output `responseSchema` + Zod parse (be-autograde rec #3).                 |
| `uploadAnswerSheetsService(input, ctx)`     | `submission.create` (+ scanner role allowed)   | validates storage-path tenant scoping (⚷), dedup-guard, denormalizes `studentName`/`rollNumber`, creates `Submission(uploaded)`, exam published→grading, `stats.totalSubmissions` counter                                 | single canonical ingestion (scanner-rn target); idempotent on `(uid,key)`.            |
| `gradeQuestionService(input, ctx)`          | `submission.grade`                             | dispatch by `mode`: `manual`→writes `ManualOverride` + recomputes `SubmissionSummary` (single writer); `retry`→resets failed QS to pending + submission→grading; `ai`→pipeline-runs one question. **Score authority** (⚷) | `needs_review` must not leak tentative score into `totalScore` (be-autograde §4 fix). |
| `saveEvaluationSettingsService(input, ctx)` | `evaluationSettings.manage`                    | upsert; single-default invariant (clears other `isDefault`)                                                                                                                                                               | thresholds/`promptGuidance` writable only by authoring roles.                         |
| `resolveDeadLetterService(input, ctx)`      | `submission.grade`                             | marks DLQ entry resolved with method; for `retry` re-enqueues the failed step                                                                                                                                             | idempotent.                                                                           |

### Pipeline / orchestration services (`services/server`, invoked by triggers/tasks)

| Service                                             | authority                                                                                               | notes (be-autograde rec #1: single orchestrator, one status writer)                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `advancePipelineService(submissionId, ctx)`         | **the single reducer** for pipeline transitions                                                         | replaces the trigger-runs-worker-inline + duplicated final-status logic. Idempotent, guarded by `pipelineStatus`. Dispatches scouting/grading/finalize. |
| `processAnswerMappingService` (Panopticon scouting) | writes `scoutingResult` + creates `QuestionSubmission`s                                                 | AI scouting via `@levelup/ai`; structured output.                                                                                                       |
| `processAnswerGradingService` (RELMS)               | per-question scoring, confidence routing, DLQ on failure, AI cost rollup                                | resolves rubric chain (tenant→exam→question), batched concurrency, quota **hard pre-check**.                                                            |
| `finalizeSubmissionService`                         | computes final `SubmissionSummary` + `grade`, sets `ready_for_review`, **enqueues outbox** notification | **the one place** final submission status is computed (delete the duplicate in `on-question-submission-updated`).                                       |
| `resolveRubricService(examId, questionId, ctx)`     | rubric inheritance resolution                                                                           | shared helper, server-only (reads `EvaluationSettings` thresholds ⚷).                                                                                   |

### Read / projection services (authority enforced server-side, shaping shareable)

| Service                                           | projection authority (⚷)                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `listExamsService` / `getExamService`             | tenant-scope from ctx; role-scope `classIds` filter.                                                                                       |
| `listQuestionsService`                            | **strips `evaluatorGuidance`/`modelAnswer`/dimension `promptGuidance`** from rubric for non-authoring roles.                               |
| `listSubmissionsService` / `getSubmissionService` | **enforces `resultsReleased` gate** for student/parent; scopes student→own, parent→linked children (`ctx.studentIds`), teacher→`classIds`. |
| `listQuestionSubmissionsService`                  | released-gate + never returns the answer key; returns `evaluation` projection only when visible.                                           |
| `getExamAnalyticsService`                         | teacher/admin only; class breakdown scoped.                                                                                                |
| `listEvaluationSettingsService`                   | thresholds visible to authoring roles only.                                                                                                |
| `listDeadLetterService`                           | teacher/admin only.                                                                                                                        |

### `authorize()` policy keys used

`exam.create`, `exam.update`, `exam.publish`, `exam.releaseResults`,
`exam.read`, `submission.create`, `submission.read`, `submission.grade`,
`questionSubmission.read`, `evaluationSettings.manage`,
`evaluationSettings.read`, `deadLetter.read`, `analytics.read`. (Map to today's
`canCreateExams`, `canGradeSubmissions`, `canReleaseResults` permission gates +
scanner-role allowance.)

---

## Function shells (callable / trigger / scheduler)

All shells are thin:
`buildAuthContext(request.auth) → parseRequest(Zod) → service(input, ctx)`.

### `onCall` adapters (`functions/autograde/src/callable/*`)

- `v1.autograde.saveExam` → `saveExamService` (512MiB, 300s)
- `v1.autograde.releaseResults` → `releaseResultsService`
- `v1.autograde.extractQuestions` → `extractQuestionsService` (2GiB, 540s)
- `v1.autograde.uploadAnswerSheets` → `uploadAnswerSheetsService` (256MiB, 300s)
- `v1.autograde.gradeQuestion` → `gradeQuestionService` (4GiB, 540s)
- `v1.autograde.saveEvaluationSettings` → `saveEvaluationSettingsService`
- `v1.autograde.resolveDeadLetter` → `resolveDeadLetterService`
- **Reads:** `listExams`, `getExam`, `listQuestions`, `listSubmissions`,
  `getSubmission`, `listQuestionSubmissions`, `getExamAnalytics`,
  `listEvaluationSettings`, `listDeadLetter` → their projection services.

### Triggers (single-writer, idempotent, outbox)

| Trigger                       | fires on                                   | thin over                                                                                                | single-writer / idempotency                                                                                         |
| ----------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `onSubmissionCreated`         | `submissions/{id}` create                  | `advancePipelineService` (start scouting)                                                                | guarded by `pipelineStatus==uploaded`.                                                                              |
| `onSubmissionUpdated`         | `submissions/{id}` `pipelineStatus` change | `advancePipelineService` (the **single** reducer)                                                        | idempotent, status-guarded; **replaces** today's inline-worker + duplicated logic.                                  |
| `onQuestionSubmissionUpdated` | `questionSubmissions/{qid}` update         | enqueues `advancePipelineService` aggregate check **only**                                               | **stops computing final status itself** (delete duplicate vs `process-answer-grading` — be-autograde §4).           |
| `onExamPublished`             | exam status→`published`                    | notification outbox service                                                                              | reliable, not fire-and-forget.                                                                                      |
| `onResultsReleased`           | exam status→`results_released`             | notification outbox service (students/parents/teacher)                                                   | outbox/retry.                                                                                                       |
| `onExamDeleted`               | exam delete                                | cascade-delete service (questions, submissions, questionSubmissions, analytics, DLQ) + `usage` decrement | batched, idempotent.                                                                                                |
| `onQuestionPaperUpload`       | GCS finalize `.../question-paper/...`      | append-image service → exam `question_paper_uploaded`                                                    | path-scoped.                                                                                                        |
| ~~`onAnswerSheetUpload`~~     | **REMOVED**                                | —                                                                                                        | replaced by `uploadAnswerSheets` callable (D12 `'gcs'` divergence eliminated; RN-compatible — be-autograde rec #2). |

### Schedulers / cron

| Scheduler                 | cadence      | thin over                                 | rebuild note                                                                                                                                                                              |
| ------------------------- | ------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staleSubmissionWatchdog` | every 15 min | `advancePipelineService` (re-drive stale) | **collection-group query** on `pipelineStatus`+`updatedAt` instead of O(tenants) scan (be-autograde rec #6). Idempotent; escalates to `manual_review_needed` after N retries; writes DLQ. |

### Cloud Tasks orchestration (multi-step)

The grading pipeline is multi-step and long-running. **Recommendation
(be-autograde rec #1):** back `advancePipelineService` with **Cloud Tasks** —
one task per stage (`scouting`, `grading`, `finalize`) — so each stage is a
durable, retryable, single-writer step instead of inline 4GiB trigger execution.
Per-question grading fan-out stays batched within the `grading` task. The DLQ
captures terminal failures; the watchdog re-enqueues stalled tasks.
(Firestore-trigger chaining stays available as the emulator fallback, per the
current explicit choice.)

---

## Authority boundary (server-only ⚷)

Maps to `REVIEW-domain-data-model.md` §6:

| Field / operation                                                                                                                                              | REVIEW item | Why server-only                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| **`AnswerKey` subcollection** (correct/model answers under questions)                                                                                          | §6.4        | deny-all to clients; never read/written by SDK; defense-in-depth rules.                                        |
| **Grading outputs** — `QuestionSubmission.evaluation`, `score`, `correctness`, `confidence`, `costUsd`, `ManualOverride`, `SubmissionSummary`                  | §6.5        | SDK submits answers; server computes/writes scores. Client can never write its own score.                      |
| **Pipeline lifecycle** — `Submission.pipelineStatus`, `retryCount`, `gradingProgress` + exam `status`, `resultsReleased`/`resultsReleasedAt`                   | §6.10       | transitions server-only via `advancePipelineService`; results visibility gated on `resultsReleased`.           |
| **Rubric guidance** — `UnifiedRubric.modelAnswer`, `evaluatorGuidance`, `EvaluationDimension.promptGuidance`, `EvaluationSettings.confidenceConfig` thresholds | §6.7        | reading leaks how to score; projected out for non-authoring roles.                                             |
| **Denormalized counters** — `Exam.stats`, tenant `usage.examsThisMonth`/`aiCallsThisMonth`, `ExamAnalytics`                                                    | §6.9        | trigger/service-maintained; SDK reads, never writes.                                                           |
| **`tenantId` for every op**                                                                                                                                    | §6.1        | claim-derived; **no `tenantId` field in any autograde request schema**.                                        |
| **AI calls / Gemini keys / cost / quota**                                                                                                                      | §6 (AI row) | per-tenant Secret Manager `tenant-{tenantId}-gemini`; never in client bundle; quota a hard pre-check.          |
| **Cross-domain link integrity** — `linkedSpaceId`/`linkedStoryPointId`/`linkedItemId`                                                                          | §6.11       | server existence-validates referent in-tenant before persisting the link.                                      |
| **Storage scoping** — answer-sheet / question-paper paths                                                                                                      | §6.13       | `uploadAnswerSheets` validates path is within `tenants/{ctx.tenantId}/`; per-path tenant+role+ownership rules. |

---

## Drift & open questions

### Reconciliations from the REVIEW drift table

- **D4 (timestamps):** all autograde audit/embedded timestamps → ISO
  `Timestamp`; admin adapter converts.
- **D8 (branded IDs):** add
  `ExamId/ExamQuestionId/SubmissionId/QuestionSubmissionId/EvaluationSettingsId/DeadLetterEntryId/ExamAnalyticsId`.
- **D9 (Zod-first `.strict()`):** all entities + req/res authored as `.strict()`
  schemas; kill interfaces + `.passthrough()`.
- **D12 (`uploadSource='gcs'` not in union):** drop `'gcs'`; close the union to
  `web|scanner|rn`; remove the GCS trigger.
- **D2 (tenantId from body):** removed from all request schemas; ctx-derived.
- **D6 (record-maps):** `ExamAnalytics` maps tolerated read-side
  (analytics-fn-owned); `ScoutingResult.routingMap`/`confidence` keyed by
  `ExamQuestionId` kept (bounded by question count, low risk).

### Open questions (carried + new)

1. **OCR stage — dead or alive?** `ocr_processing`/`ocr_failed` statuses + DLQ
   `'ocr'` step have no OCR stage (scouting/grading send images straight to
   Gemini). **Decision taken here: drop them.** Confirm no consumer (analytics,
   UI badge) depends on the `ocr_*` strings before deleting (REVIEW open-Q;
   be-autograde §4).
2. **`'completed'` exam status — unreachable.** No code sets it;
   `grading→completed→results_released` is dead. **Decision taken here: drop
   `'completed'`, transition `grading→results_released` directly.** Confirm no
   analytics rollup keys off `'completed'` (REVIEW open-Q).
3. **Pipeline transport — Cloud Tasks vs Firestore-trigger chaining.** The
   current explicit choice is triggers (emulator-friendly). The rebuild
   recommends Cloud Tasks for durability + single-writer. Open: keep both (Tasks
   in prod, triggers in emulator) behind the `advancePipelineService` seam, or
   commit to one?
4. **Rubric embed vs ref.** Decision (spec §0): store the **resolved
   `effectiveRubric` snapshot** on the question + `evaluationSettingsId` as the
   source ref. Confirm extraction writes the snapshot and grading never re-reads
   settings at grade time except for thresholds (which are ⚷ and stay
   server-side).
5. **`gradingProgress` realtime shape.** The `gradingStatus` subscription
   payload must include `gradingProgress` (batch counters) — confirm the field
   is persisted on the submission doc (it is written per-batch today) so the
   Firestore listener can surface it without a separate query.
6. **Final-status single writer.** Confirm that after consolidating into
   `finalizeSubmissionService`, `onQuestionSubmissionUpdated` only _enqueues a
   check_ and never writes submission status (kills the documented race between
   `process-answer-grading` and `on-question-submission-updated`).
7. **`needs_review` score leakage.** Confirm tentative AI scores for
   `needs_review` questions are **excluded** from `SubmissionSummary.totalScore`
   until confirmed (be-autograde §4 — two manual-summary paths bug).
8. **Scanner-rn ingestion.** Confirm scanner-rn uploads compressed images to
   Storage then calls `uploadAnswerSheets` with paths (never writes the
   submission doc) — the single canonical path (spec §6).
