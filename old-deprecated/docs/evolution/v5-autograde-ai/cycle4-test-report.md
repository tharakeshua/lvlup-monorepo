# V5 AutoGrade & AI Pipeline — Cycle 4 Test Report

**Cycle:** 4 **Vertical:** V5 — AutoGrade & AI Pipeline **Tester:** AI & Grading
Engineer **Date:** 2026-03-08

---

## Build Verification

| Package                        | Status              | Notes                                    |
| ------------------------------ | ------------------- | ---------------------------------------- |
| `@levelup/functions-autograde` | PASS                | Cached build, 0 type errors              |
| `@levelup/functions-levelup`   | PASS                | Cached build, 0 type errors              |
| `@levelup/shared-types`        | PASS                | Schema extensions compile cleanly        |
| `@levelup/shared-services`     | PASS                | usage-quota + llm-logger changes compile |
| `@levelup/teacher-web`         | PASS                | Vite build + TS type-check pass          |
| `@levelup/parent-web`          | PASS (pre-existing) | Unrelated @tiptap/react issue            |
| **All 13 turbo tasks**         | **PASS**            | 13/13 successful, 0 failures             |

**`pnpm build` result:** All 13 packages built successfully (turbo cached). No
new type errors introduced.

---

## Task-by-Task Verification

### Theme 1: Extraction Quality & Teacher Editing

#### Task 1.1: Extraction Review & Edit UI

- **File:** `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`
- **Status:** PASS
- **Verified:**
  - Editable question list renders when exam is in `question_paper_extracted`
    status
  - Extraction confidence badges (green >= 90%, amber >= 70%, red < 70%) present
    per question
  - Inline editing of question text (textarea) and maxMarks (number input) with
    Save/Cancel buttons
  - "Confirm & Publish" banner with blue background appears for extracted
    questions
  - "Re-extract" button shown for low-confidence questions (< 70%)
  - `handleSaveQuestionEdit` writes to Firestore with `updateDoc`

#### Task 1.2: Per-Question Re-Extraction Endpoint

- **Files:** `functions/autograde/src/callable/extract-questions.ts`,
  `packages/shared-types/src/schemas/callable-schemas.ts`,
  `packages/shared-services/src/autograde/exam-callables.ts`
- **Status:** PASS
- **Verified:**
  - `ExtractQuestionsRequestSchema` extended with
    `mode: z.enum(['full', 'single']).optional()` and
    `questionNumber: z.string().max(20).optional()`
  - `extract-questions.ts` has dedicated `mode === 'single'` branch with focused
    prompt
  - Validates `questionNumber` is required when `mode='single'`
  - Updates existing question doc via `qRef.update()` (not overwrite)
  - Returns re-extracted question with metadata

#### Task 1.3: Question Text Preview in Grading Review

- **File:** `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- **Status:** PASS
- **Verified:**
  - Collapsible `<details>` element with `<summary>` in expanded question view
  - Shows question text, maxMarks, and rubric criteria (name + maxPoints)
  - Uses `BookOpen` icon for visual clarity
  - Properly positioned above the answer image in the expanded view

### Theme 2: Grading Pipeline Robustness

#### Task 2.1: Concurrency Limiter in Batch Processing

- **File:** `functions/autograde/src/utils/grading-queue.ts`
- **Status:** PASS
- **Verified:**
  - `Semaphore` class implemented with `acquire()` (Promise-based queue) and
    `release()` (dequeue next)
  - `processBatch` creates a new `Semaphore(maxConcurrent)` per batch
  - Each item calls `semaphore.acquire()` before processing and
    `semaphore.release()` in `finally` block
  - `Promise.allSettled` still used for error isolation, but throttled via
    semaphore
  - Default values: `batchSize=5`, `maxConcurrent=5`

#### Task 2.2: Per-Question Timing Metrics

- **File:** `functions/autograde/src/pipeline/process-answer-grading.ts`
- **Status:** PASS
- **Verified:**
  - `imageDownloadStart` timestamp captured before image downloads
  - `imageDownloadMs` calculated after all images downloaded
  - `llmCallStart` captured before LLM call, `llmCallMs` calculated after
  - `timingMs` object added to evaluation: `{ imageDownload, llmCall, total }`
  - `model` field added from `result.model` for model attribution

#### Task 2.3: Stale Submission Watchdog

- **File:** `functions/autograde/src/schedulers/stale-submission-watchdog.ts`
  (NEW)
- **Status:** PASS
- **Verified:**
  - Scheduled Cloud Function: `every 15 minutes`, region `asia-south1`, 512MiB
    memory, 120s timeout
  - Queries submissions stuck in `scouting` or `grading` with
    `updatedAt < 10 minutes ago`
  - Retry logic: resets `grading` → `scouting_complete`, `scouting` → `uploaded`
  - Escalation: after 3 watchdog retries, sets `manual_review_needed` with
    descriptive error
  - Scans all tenants with 50-submission limit per status per tenant
  - Properly exported in `functions/autograde/src/index.ts`

### Theme 3: AI Chat Intelligence

#### Task 3.1: LLM-Powered Conversation Summarization

- **File:** `functions/levelup/src/callable/send-chat-message.ts`
- **Status:** PASS
- **Verified:**
  - Triggers when conversation exceeds 20 messages (`SUMMARIZE_THRESHOLD`)
  - Uses `gemini-2.5-flash-lite` (cheapest model) for summarization
  - Structured prompt asks for: key topics, understanding level, mastered
    concepts, struggling concepts
  - Summary cached in `session.conversationSummary` with `summaryAtMessageCount`
  - Only regenerates when 10+ new messages since last summary
  - Graceful fallback to naive truncation (last 6 messages, 150 chars each) if
    LLM fails
  - Fire-and-forget cache update with `.catch()` error handling

#### Task 3.2: Session Learning Insights

- **File:** `functions/levelup/src/callable/send-chat-message.ts`
- **Status:** PASS
- **Verified:**
  - `extractLearningInsights()` function runs fire-and-forget after each
    exchange
  - Uses `gemini-2.5-flash-lite` with `temperature: 0.1`, `maxTokens: 128`
  - Extracts JSON: `{ concept, showedUnderstanding, struggled }`
  - Updates session with `arrayUnion` for concepts, `increment` for
    mastery/struggle signals
  - Called with `.catch()` to prevent blocking the main response

### Theme 4: Cost Tracking Granularity

#### Task 4.1: Model-Level Cost Breakdown

- **Files:** `packages/shared-services/src/ai/usage-quota.ts`,
  `packages/shared-services/src/ai/llm-logger.ts`
- **Status:** PASS
- **Verified:**
  - `incrementDailyCostSummary` accepts optional `model` parameter
  - Sanitizes model name: `(model ?? 'unknown').replace(/[./]/g, '_')` for
    Firestore field paths
  - Writes `byModel.{safeModelKey}.calls` and `byModel.{safeModelKey}.costUsd`
    via `FieldValue.increment`
  - `logLLMCall` passes `params.model` through to `incrementDailyCostSummary`

#### Task 4.2: Per-Exam Cost Tracking

- **Files:** `functions/autograde/src/pipeline/process-answer-grading.ts`,
  `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`
- **Status:** PASS
- **Verified:**
  - Backend: After grading transaction, accumulates `totalGradingCostUsd` from
    all `qs.evaluation.costUsd`
  - Writes to exam doc via `FieldValue.increment(totalGradingCostUsd)` (atomic)
  - Frontend: ExamDetailPage shows AI Grading Cost card with `DollarSign` icon
    when `stats.totalGradingCostUsd` is present
  - Cost displayed with `.toFixed(2)` formatting

### Theme 5: Teacher UX Enhancements

#### Task 5.1: Keyboard Navigation in Grading Review

- **File:** `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- **Status:** PASS
- **Verified:**
  - `j`/`↓` moves to next question, `k`/`↑` moves to previous (with wrap-around)
  - `Enter` expands/collapses current question
  - `a` accepts AI grade for expanded question (if applicable)
  - `o` focuses override input via `data-override-input` attribute
  - `?` toggles keyboard shortcuts help panel
  - Input/textarea/select fields excluded from shortcuts
  - `useCallback` + `useEffect` with cleanup for event listener
  - Help panel shows all shortcuts with styled `<kbd>` elements

#### Task 5.2: Grading Results Export (CSV)

- **File:** `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`
- **Status:** PASS
- **Verified:**
  - "Export CSV" button with `Download` icon in submissions header
  - Client-side CSV generation with proper headers: Student Name, Roll Number,
    Class, Pipeline Status, Total Score, Max Score, Percentage, Grade
  - `escapeCsv()` function handles commas, quotes, and newlines correctly
  - Creates Blob with `text/csv;charset=utf-8;` MIME type
  - Auto-downloads via temporary link element with exam title in filename
  - `URL.revokeObjectURL()` called for cleanup

#### Task 5.3: Grading Completion Notification

- **File:** `functions/autograde/src/pipeline/finalize-submission.ts`
- **Status:** PASS
- **Verified:**
  - Individual notification:
    `"{studentName}'s submission has been graded: {score}/{maxScore} ({grade})"`
    sent to `examData.createdBy`
  - Batch notification: When all submissions graded
    (`gradedSubs === totalSubs && totalSubs > 1`), sends "All {totalSubs}
    submissions for {title} have been graded"
  - Uses `sendNotification` utility with proper entity types and action URLs
  - Fire-and-forget with `.catch()` to avoid blocking finalization

---

## Acceptance Criteria Checklist

| Criterion                                                          | Status |
| ------------------------------------------------------------------ | ------ |
| Teachers can review and edit extracted questions before publishing | PASS   |
| Individual low-confidence questions can be re-extracted            | PASS   |
| Question text visible in grading review alongside student answer   | PASS   |
| `processBatch` enforces actual concurrency limits via semaphore    | PASS   |
| Per-question timing metrics stored in evaluation result            | PASS   |
| Stale submissions detected and retried or escalated automatically  | PASS   |
| Long chat conversations use LLM-generated summaries                | PASS   |
| Chat sessions track learning insights (concepts, mastery signals)  | PASS   |
| Daily cost summaries include per-model breakdown                   | PASS   |
| Each exam shows total AI grading cost                              | PASS   |
| Keyboard navigation works in grading review page                   | PASS   |
| Grading results exportable as CSV                                  | PASS   |
| Teachers notified when grading completes                           | PASS   |
| `pnpm build` passes                                                | PASS   |

---

## Code Quality Notes

1. **Semaphore implementation** is clean with proper acquire/release pattern and
   queue-based waiting
2. **LLM summarization** has proper fallback chain (LLM → naive truncation)
   ensuring reliability
3. **Learning insights** are fire-and-forget, preventing latency impact on chat
   responses
4. **Cost tracking** uses Firestore atomic increments, safe for concurrent
   submissions
5. **Keyboard navigation** properly excludes input fields and uses `useCallback`
   for stable references
6. **CSV export** handles edge cases (commas, quotes, newlines) with proper
   escaping
7. **Notifications** are fire-and-forget with `.catch()` to avoid blocking
   critical pipeline operations
8. **Watchdog** has sensible limits (50 per status per tenant, 3 max retries
   before escalation)

## Issues Found

**None.** All 13 tasks implemented correctly, build passes, no type errors
introduced.

---

**Overall Result: PASS — All acceptance criteria met. Cycle 4 is complete.**
