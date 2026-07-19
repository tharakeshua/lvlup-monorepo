# AutoGrade Subsystem — Deep-Dive Analysis Report

**Scope:** `functions/autograde` (Cloud Functions) + autograde SDK layers
(`packages/{api-contract,domain,services,query,repositories,shared-services,shared-types}`)

- `apps/mobile-teacher` REVIEW grading lane + `apps/teacher-web` grading pages.
  **Mode:** Analysis only — no code modified. **Companion doc:**
  `functions/autograde/CONTRACT_REPORT.md` (per-stage contract, authoritative on
  shapes). **Date:** 2026-07-04

---

## 1. Architecture — the 8-stage grading pipeline (state machine)

The pipeline is a **document-status state machine** driven by callables (teacher
actions) and Firestore triggers (automatic hand-offs). Two parallel status
fields advance in lockstep: `exam.status` and `submission.pipelineStatus`.

```
EXAM lifecycle:
draft ─saveExam(+images)→ question_paper_uploaded ─extractQuestions(AI)→
question_paper_extracted ─saveExam({published})→ published ─uploadAnswerSheets(1st)→
grading ─saveExam({results_released})→ results_released
         (exam status 'completed' is defined in shared-types but DROPPED in domain)

SUBMISSION lifecycle (per student):
uploaded ─onSubmissionCreated→ scouting ─processAnswerMapping(AI/Panopticon)→
scouting_complete ─onSubmissionUpdated→ grading ─processAnswerGrading(AI/RELMS, per-Q)→
   ├─ grading_complete ─onSubmissionUpdated→ finalizeSubmission → ready_for_review → reviewed
   ├─ grading_partial      (some Qs failed, some graded)
   └─ manual_review_needed (all failed / quota block / circuit-breaker)
```

**Stage → code map:**

| #   | Stage                                     | Entry point                                                                     | Kind                             |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Create exam (+ question-paper images)     | `callable/save-exam.ts:64`                                                      | onCall, asia-south1, 512MiB/300s |
| 2   | Extract questions + rubrics (Gemini)      | `callable/extract-questions.ts:22`                                              | onCall, 2GiB/540s                |
| 3   | Publish exam (rubric-sum gated)           | `callable/save-exam.ts:152`                                                     | onCall                           |
| 4   | Upload answer sheets → create submission  | `callable/upload-answer-sheets.ts:17`                                           | onCall, 256MiB/300s              |
| 5   | Answer→question page mapping (Panopticon) | trigger `on-submission-created.ts:12` → `pipeline/process-answer-mapping.ts:17` | onDocumentCreated                |
| 6   | Per-question grading (RELMS)              | trigger `on-submission-updated.ts` → `pipeline/process-answer-grading.ts:50`    | onDocumentUpdated                |
| 7   | Finalize / aggregate score + grade        | `pipeline/finalize-submission.ts:12`                                            | invoked from trigger             |
| 8   | Release results                           | `callable/save-exam.ts:197`                                                     | onCall                           |

**Key hand-off invariants** (each verified by `e2e-pipeline.test.ts`):

- `exam.questionPaper.images` (Stage 1 write) is what `extractQuestions`
  downloads (Stage 2 read).
- **The single most important invariant:**
  `questionSubmission.mapping.imageUrls === mapping.pageIndices.map(i => submission.answerSheets.images[i])`
  — the grader (Stage 6) downloads directly from `mapping.imageUrls`. A
  dedicated narrow test pins this so refactors break the test, not prod.
- Stages 2 and 5 use **atomic batch writes** (all question docs + exam status
  flip commit together) so FE "callable writes → FE re-fetches" is race-free.
- Trigger chaining: `pipelineStatus` writes are the edges. `uploaded`→fires
  onSubmissionCreated; `scouting_complete`/`grading`→fires onSubmissionUpdated;
  `grading_complete`→fires finalize; every per-question update fires
  `onQuestionSubmissionUpdatedV2`.

---

## 2. Exported functions (from `functions/autograde/src/index.ts`)

**14 deployed functions**, all region `asia-south1`:

**Callables (4):**

- `saveExam` — polymorphic write: create (Stage 1) / publish (Stage 3) /
  release-results (Stage 8) / metadata update. The pipeline's main
  teacher-facing entry. Also increments tenant usage counters.
- `extractQuestions` — Gemini vision extraction of questions + rubric criteria
  from question-paper images. `mode: 'full'|'single'` (single = re-extract one
  question).
- `uploadAnswerSheets` — creates the per-student submission doc, guards against
  duplicate `(examId, studentId)`, flips exam `published`→`grading`.
- `gradeQuestion` — manual override / retry / AI-grade one question
  (discriminated by mode). Recomputes `submission.summary` synchronously in its
  own transaction.

**Storage triggers (2)** — _alternative_ bulk/scanner entry points (NOT the
teacher-web/mobile flow):

- `onQuestionPaperUpload` — watches
  `tenants/{t}/exams/{e}/question-paper/{file}`.
- `onAnswerSheetUpload` — watches
  `tenants/{t}/exams/{e}/answer-sheets/{studentId}/{file}`. Header comment
  explicitly states the `uploadAnswerSheets` callable is the preferred path.

**Firestore triggers (4):**

- `onSubmissionCreated` — `uploaded`→`scouting`, invokes `processAnswerMapping`.
- `onSubmissionUpdated` — arms `scouting_complete`→`grading` and
  `grading`→`processAnswerGrading`; `grading_complete`→`finalizeSubmission`.
- `onQuestionSubmissionUpdatedV2` — re-aggregates submission status/counters on
  each per-question grade (deliberately duplicates the inline transaction's
  aggregation — see §6.5). Named `V2` to avoid clash with a previously-deployed
  HTTPS function of the same base name.
- `onExamDeleted` — cascade cleanup.

**Notification triggers (2):** `onExamPublished`, `onResultsReleased` — fan out
student/parent/teacher notifications.

**Scheduler (1):** `staleSubmissionWatchdog` — every 15 min.

> **Note on the deployed surface:** the api-contract declares ~20 callables
> (`listExams`, `getExam`, `getSubmission`, `releaseResults`,
> `resolveDeadLetter`, `saveEvaluationSettings`, `requestUploadUrl`,
> `getSubmissionForExam`, analytics reads, DLQ reads, etc.). **Only 4 write
> callables + the triggers/scheduler are implemented in `functions/autograde`.**
> The remaining read/write callables live in the newer `packages/services` SDK
> tier (a separate function deployment, not in this package) — see §6.

---

## 3. LLM integration

Three distinct Gemini "personas", each with its own system prompt, parser, and
call metadata. All go through `LLMWrapper` (proxy in `utils/llm.ts` → real impl
`packages/shared-services/src/ai/llm-wrapper.ts`).

| Persona        | Purpose                                 | Prompt file                                  | Parser                                                                               | temp / maxTokens |
| -------------- | --------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------- |
| **Extraction** | Questions + rubric from paper images    | `prompts/extraction.ts` (166 ln)             | `parseExtractionResponse` (auto-fixes criteria-sum ≠ maxMarks)                       | 0.1 / 65536      |
| **Panopticon** | Map answer-sheet pages → questions      | `prompts/panopticon.ts` (138 ln)             | `parsePanopticonResponse` (strips "Q" prefix, **Sandwich Rule**, drops OOR page idx) | 0.1 / 16384      |
| **RELMS**      | Score one answer vs rubric + dimensions | `prompts/relms.ts` (143 ln, dynamic builder) | `parseRELMSResponse`                                                                 | 0.1 / 8192       |

**Prompt design highlights:** extraction demands LaTeX for math + rubric
criteria summing exactly to maxMarks; Panopticon uses 0-based page indices + the
"Sandwich Rule" for multi-page answers; RELMS builds a dynamic prompt injecting
the tenant's enabled `EvaluationDimension`s.

**API keys:** per-tenant, from Secret Manager — secret name
`tenant-{tenantId}-gemini` (`utils/llm.ts:139`). Project from
`GCLOUD_PROJECT`/`GCP_PROJECT`.

**Quota / cost:** `process-answer-grading.ts:54-77` dynamically imports
`checkUsageQuota` from `@levelup/shared-services/ai` before grading. If
`!allowed` → submission → `manual_review_needed` and return; warnings logged but
non-blocking. Quota-check _failures_ are swallowed (grading proceeds). Cost is
tracked per call (`cost-tracker.ts`, `llm-logger.ts` →
`incrementDailyCostSummary`) and accumulated onto
`exams/{e}.stats.totalGradingCostUsd`. Evaluation-settings can carry a
`usageQuota` (monthlyBudgetUsd, dailyCallLimit, warningThresholdPercent default
80).

**Circuit breaker** (`shared-services/src/ai/fallback-handler.ts`): per-tenant,
in-memory (resets on cold start). Threshold **3 failures** within a **5-min
window** → open; **60s cooldown** → half-open. `llm-wrapper.ts:195` checks it
before each call; records success/failure after. Grading treats
circuit-breaker/quota errors as **graceful degradation → `needs_review`** rather
than hard failure (`grading.ts:167-171`).

**Concurrency:** `utils/grading-queue.ts` — a `Semaphore` (default
`maxConcurrent=5`, `batchSize=5`) limits concurrent Gemini calls per submission
via `processBatch`.

**Mocking:** `e2e-pipeline.test.ts` `vi.mock('../utils/llm')` swaps in
`MockLLMWrapper` that dispatches on `metadata.purpose`
(`question_extraction`/`answer_mapping`/`answer_grading`) returning
deterministic JSON fixtures. The **real parsers run against mocked AI text**, so
parser logic is exercised. Storage, assertions, rate-limit, image-quality,
notifications are also mocked; Firestore is in-memory.

---

## 4. Test coverage assessment

**156 `it/test` blocks across 18 files, 23 `describe` groups** (the "~170"
figure includes parametrized `.each` expansions). `npm test` = green,
`npm run typecheck` clean (per CONTRACT_REPORT).

**Well covered:**

- Full pipeline stages 1→8 end-to-end with mocked AI (`e2e-pipeline.test.ts`, 2
  `it`s incl. the mapping-invariant pin).
- Every callable: `save-exam` (16), `grade-question` (17),
  `upload-answer-sheets` (6 + 15 storage-trigger), `extract-questions` (5),
  `create-exam` (11).
- Every pipeline worker: mapping (5), grading (8), finalize (5).
- Every trigger: submission-created (6), submission-updated (12),
  question-submission-updated (9), exam-published (7), results-released (8),
  exam-deleted (8).
- Scheduler watchdog (8).

**Gaps / not covered (analysis):**

- **No real-LLM / live-Gemini integration test** — everything is mocked, so
  prompt/response-format drift against real Gemini output is unguarded. Parser
  robustness against _unexpected_ real-world JSON is only as good as the
  fixtures.
- **Circuit breaker & quota** paths are stubbed out (`e2e` intentionally does
  not mock the workspace usage-quota path but grading swallows failures) —
  limited assertion on breaker open/half-open transitions.
- **Cross-tenant watchdog scale**: watchdog does
  `db.collection('tenants').get()` then per-tenant queries with `.limit(50)` —
  no test for the many-tenants / >50-stale case (silent cap, see §5).
- **DLQ (`gradingDeadLetter`) resolution** flow (`resolveDeadLetter`) lives in
  the services SDK tier, not tested here.
- **Concurrency/semaphore** behavior under contention not directly asserted.

---

## 5. Known bugs / risks / tech-debt

**RESOLVED (flagged for propagation):**

1. **🚨 Stale `@levelup/shared-types` dist — `questionPaperImages` validation**
   (CONTRACT*REPORT §1, Finding #1). Source is
   `z.array(z.string().min(1).max(500))` but the \_shipped dist* loaded at
   runtime was `z.array(z.string().url())`. FE sends Storage _paths_ (not URLs)
   → every exam-create rejected with
   `Invalid request: data.questionPaperImages.0: Invalid URL`. **This is the
   most likely "autograde-not-working" root cause.** Dist was rebuilt as part of
   the contract work; **action: publish team must
   `pnpm install`/rebuild+republish `@levelup/shared-types`** so all consumers
   pick it up, then retest exam-create E2E.

**OPEN — enum/schema divergence (domain vs shared-types)** — 5 mismatches (each
an FE/BE deserialization landmine):

| Enum                      | shared-types                            | domain                 | Risk                                                        |
| ------------------------- | --------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| Exam status               | includes `completed`                    | drops `completed`      | domain rejects a status shared-types can emit               |
| Submission pipelineStatus | includes `ocr_processing`, `ocr_failed` | drops both (vestigial) | legacy docs fail domain parse                               |
| Grading pipeline steps    | `ocr`\|`scouting`\|`grading`            | `scouting`\|`grading`  | DLQ `pipelineStep:'ocr'` unparseable in domain              |
| Upload source             | `web`\|`scanner`                        | `web`\|`scanner`\|`rn` | mobile-teacher/`rn` uploads fail shared-types validation    |
| Grade letters             | 7 (no `C+`)                             | 8 (adds `C+`)          | a `C+` grade fails shared-types parse; boundary/label drift |

**OTHER RISKS:**

- **Watchdog silent cap**: `.limit(50)` per (tenant, status) with no pagination
  — a backlog >50 stale submissions per tenant is silently left behind each
  15-min run (drains slowly, but no visibility). Also full `tenants` collection
  scan every run (cost scales with tenant count).
- **Storage-path trigger mismatch** (CONTRACT_REPORT §1): FE uploads to
  `tenants/{t}/question-papers/...` and `tenants/{t}/submissions/{examId}/...`,
  but the Storage triggers watch `.../exams/{examId}/question-paper/...` and
  `.../answer-sheets/{studentId}/...`. **Not a bug** — the callable flow is
  authoritative; triggers are scanner-only alt paths. But the dead-code
  appearance is a footgun for future maintainers.
- **`grading_complete` in exam release whitelist** (`save-exam.ts:200`) is a
  submission status, not an exam status — defensive dead code; harmless but
  confusing.
- **TODO**: `utils/llm.ts:7` — local LLMWrapper type declarations mirror
  shared-services because it doesn't ship `.d.ts`; replace with real imports
  once the package publishes declarations. This mirror is a drift risk.
- **Missing-callable gap**: the 4 functions/autograde callables are only part of
  the contract. Reads (`listExams`, `getSubmission`…), `releaseResults`,
  `saveEvaluationSettings`, `resolveDeadLetter`, and the
  upload-URL/`getSubmissionForExam` seams are served by `packages/services` —
  confirm that tier is deployed, or those hooks 404.

**Prior-work note (mobile-teacher build memory):** the "get-by-id / scoped-read
NOT_FOUND prefix bug" (list works, `get(id)` returns NOT_FOUND) noted during
mobile-teacher GATE-B. In current code this manifests as the **soft-miss
pattern**, not a crash: `useExamAnalytics`/`ExamAnalyticsScreen:100-114` treat
NOT_FOUND as "analytics not computed yet → friendly empty" (analytics docs only
exist post-grading). Whether an underlying scoped-read prefix bug still exists
in the services read tier was **not re-verified here** (those handlers are
outside functions/autograde) — flag for a services-tier follow-up.

---

## 6. FE–BE contract status & parity gaps

**Backend answers to the teacher-web audit (CONTRACT_REPORT §"Frontend-contract
resolutions"), all citation-backed:**

1. Storage-path mismatch → resolved (callable flow authoritative; triggers are
   alt scanner paths).
2. `pipelineStatus:'reviewed'` → **valid & terminal**; safe for FE bulk-approve
   to write directly; release-results and finalize both recognize it.
3. `gradeQuestion` extra `examId` → ignored harmlessly (schema non-strict;
   handler derives exam from `submission.examId`).
4. `save-exam.ts:200` `validStatuses` → authoritative release whitelist.
5. `submission.summary` recomputed **both** synchronously (in `gradeQuestion`'s
   transaction) **and** eventually (trigger) — trigger does NOT recompute
   totalScore, so no double-count; request/response always sees final shape.
6. `extractQuestions` → atomic batch commit before resolve; FE re-fetch is
   race-free.

**mobile-teacher REVIEW lane (read-mostly; 8 screens under
`src/screens/review/`):**

- `ExamsOverviewScreen`, `GradingReviewScreen`, `SubmissionDetailScreen`,
  `ManualOverrideScreen`, `RubricBreakdownScreen`, `ResultsReleaseScreen`,
  `GradingQueueScreen`, `ExamAnalyticsScreen`.
- Hooks: reads via `useExams`, `useExamGradingOverview`,
  `useGradingReviewBundle`, `useExamAnalytics` + **realtime**
  `useGradingStatus`/`useExamGradingProgress`; writes via `useGradeManual`
  (→`gradeQuestion` manual), `useRetryGrading` (→`gradeQuestion` retry),
  `useReleaseResults` (→`releaseResults`).
- **Mobile-teacher does NOT create exams / extract questions / upload sheets**
  (web-only). It is read + grade-review + release only. This side-steps the
  storage-path and dist-validation bugs entirely — mobile-teacher cannot hit
  them.
- **Cleaner than teacher-web**: routes all writes through callables (no direct
  Firestore writes), no optimistic-without-rollback, no `@ts-ignore`/FIXME/HACK.
  One documented contract NOTE: BUILD-CONTRACT claimed
  `useGradingReviewBundle(examId)` but the shipped hook keys on `submissionId`;
  the screen correctly uses `useExamGradingOverview(examId)` instead.
- Response validation is **OFF** in mobile-teacher's api client because backend
  response canonicalization is partial (some reads return legacy keys) — data is
  correct but schema-unclean. This is the practical face of the enum-divergence
  risk in §5.

**Parity: mobile-teacher (8 screens) vs teacher-web (6 pages):**

- Parity on: exam list, per-question grading/override/rubric, analytics.
- teacher-web-only: exam creation, question extraction/settings/publish,
  answer-sheet upload (the write-heavy lifecycle).
- mobile-teacher-only: dedicated `ResultsReleaseScreen` modal (web folds release
  into SubmissionsPage).
- teacher-web has documented **4×P0 / 6×P1** issues (direct Firestore writes in
  bulk-approve, optimistic-without-rollback, stale listeners) that
  mobile-teacher does **not** inherit. teacher-web audit doc:
  `apps/teacher-web/AUTOGRADE_FRONTEND_AUDIT.md`; no mobile equivalent (this
  report fills that gap).

---

## Action items for the coordinator (prioritized)

1. **P0 — Republish `@levelup/shared-types`** so the `questionPaperImages`
   path-vs-URL fix propagates to the functions runtime + all FE consumers; then
   retest teacher-web exam-create end-to-end. This is the highest-probability
   "autograde broken" fix.
2. **P1 — Reconcile the 5 domain↔shared-types enum divergences** (esp. `rn`
   upload source used by mobile, and `C+`/`completed`/`ocr_*`), or the
   response-validation-OFF workaround stays load-bearing and legacy docs risk
   parse failures.
3. **P1 — Confirm the `packages/services` read/write tier is deployed**
   (listExams/getSubmission/releaseResults/saveEvaluationSettings/resolveDeadLetter/upload-URL
   seams) — those hooks 404 otherwise; and re-verify the scoped-read `get(id)`
   NOT_FOUND behavior there.
4. **P2 — Watchdog**: add pagination beyond `.limit(50)`/tenant and emit a
   metric when the cap is hit; consider a collection-group query instead of
   full-tenant scan.
5. **P2 — Add a live-Gemini smoke test** (behind a flag) to catch
   prompt/response-format drift the mocked suite can't; and pay down the
   `utils/llm.ts` `.d.ts` mirror TODO once shared-services ships declarations.
