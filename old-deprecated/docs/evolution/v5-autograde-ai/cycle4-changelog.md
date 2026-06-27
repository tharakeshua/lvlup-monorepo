# V5 AutoGrade & AI Pipeline — Cycle 4 Changelog

**Cycle:** 4 **Vertical:** V5 — AutoGrade & AI Pipeline **Date:** 2026-03-08

---

## Theme 1: Extraction Quality & Teacher Editing

### Task 1.1: Extraction Review & Edit UI

- **File:** `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`
- Added editable question list when exam is in `question_paper_extracted` status
- Each question shows extraction confidence badge (green/amber/red) and
  readability issue flag
- Inline editing of question text and maxMarks with save/cancel
- "Confirm & Publish" banner for reviewing extracted questions before publishing
- "Re-extract" button on low-confidence questions (< 70%)

### Task 1.2: Per-Question Re-Extraction Endpoint

- **Files:** `functions/autograde/src/callable/extract-questions.ts`,
  `packages/shared-types/src/schemas/callable-schemas.ts`,
  `packages/shared-services/src/autograde/exam-callables.ts`
- Added `mode: 'single'` option to `extractQuestions` callable
- Takes `questionNumber` parameter, sends focused prompt to re-extract a single
  question
- Updates existing question document with new extraction results
- Schema extended with `mode` and `questionNumber` fields

### Task 1.3: Question Text Preview in Grading Review

- **File:** `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- Added collapsible "Question" section in expanded question view
- Shows original question text, maxMarks, and rubric criteria alongside student
  answer
- Uses `<details>` element for clean collapse/expand

---

## Theme 2: Grading Pipeline Robustness

### Task 2.1: Concurrency Limiter in Batch Processing

- **File:** `functions/autograde/src/utils/grading-queue.ts`
- Implemented `Semaphore` class for concurrency control
- `processBatch` now uses semaphore to limit concurrent promises within each
  batch to `maxConcurrent`
- Previously all items within a batch ran concurrently via `Promise.allSettled`;
  now throttled to prevent API 429s

### Task 2.2: Per-Question Timing Metrics

- **File:** `functions/autograde/src/pipeline/process-answer-grading.ts`
- Added `timingMs` field to evaluation result:
  `{ imageDownload, llmCall, total }`
- Tracks image download duration, LLM call duration, and total processing time
  per question
- Added `model` field to evaluation for model attribution

### Task 2.3: Stale Submission Watchdog

- **Files:** `functions/autograde/src/schedulers/stale-submission-watchdog.ts`
  (new), `functions/autograde/src/index.ts`
- New scheduled Cloud Function running every 15 minutes
- Detects submissions stuck in `scouting` or `grading` for > 10 minutes
- Retries by resetting to previous pipeline stage (up to 3 watchdog retries)
- Escalates to `manual_review_needed` if max retries exceeded
- Scans all tenants with 50-submission limit per status per tenant

---

## Theme 3: AI Chat Intelligence

### Task 3.1: LLM-Powered Conversation Summarization

- **File:** `functions/levelup/src/callable/send-chat-message.ts`
- Replaced naive text-truncation summarization with LLM call using
  `gemini-2.5-flash-lite`
- Generates structured summary: key topics, understanding level,
  mastered/struggling concepts
- Caches summary in `session.conversationSummary`, regenerates only after 10+
  new messages
- Graceful fallback to naive truncation if LLM summary fails

### Task 3.2: Session Learning Insights

- **File:** `functions/levelup/src/callable/send-chat-message.ts`
- Added `extractLearningInsights()` function (fire-and-forget,
  `gemini-2.5-flash-lite`)
- After each exchange, extracts: concept discussed, showed understanding
  (boolean), struggled (boolean)
- Stores in session: `learningInsights.conceptsTouched` (array),
  `masterySignals` (counter), `struggleSignals` (counter)

---

## Theme 4: Cost Tracking Granularity

### Task 4.1: Model-Level Cost Breakdown

- **Files:** `packages/shared-services/src/ai/usage-quota.ts`,
  `packages/shared-services/src/ai/llm-logger.ts`
- Extended `incrementDailyCostSummary` with optional `model` parameter
- Daily cost summaries now include `byModel.{modelName}.calls` and
  `byModel.{modelName}.costUsd`
- Model name sanitized for Firestore field paths (dots/slashes replaced)
- `logLLMCall` now passes model through to cost summary

### Task 4.2: Per-Exam Cost Tracking

- **Files:** `functions/autograde/src/pipeline/process-answer-grading.ts`,
  `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`
- After grading completes, aggregates total cost from all question evaluations
- Writes `stats.totalGradingCostUsd` to exam document (atomic increment per
  submission)
- ExamDetailPage shows AI grading cost in stats cards when available

---

## Theme 5: Teacher UX Enhancements

### Task 5.1: Keyboard Navigation in Grading Review

- **File:** `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- Added keyboard shortcuts: `j`/`↓` next, `k`/`↑` previous, `Enter`
  expand/collapse, `a` accept grade, `o` focus override input, `?` toggle help
- Keyboard hint panel toggleable via `?` key or toolbar icon
- Input/textarea fields excluded from shortcuts to avoid interference

### Task 5.2: Grading Results Export (CSV)

- **File:** `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`
- Added "Export CSV" button in submissions header
- Client-side CSV generation with columns: Student Name, Roll Number, Class,
  Pipeline Status, Total Score, Max Score, Percentage, Grade
- Proper CSV escaping for commas, quotes, and newlines

### Task 5.3: Grading Completion Notification

- **File:** `functions/autograde/src/pipeline/finalize-submission.ts`
- After finalizing a submission, sends notification to exam creator (teacher)
- Message: "{studentName}'s submission has been graded: {score}/{maxScore}
  ({grade})"
- Batch notification: when all submissions for an exam are graded, sends summary
  notification
- Uses existing `sendNotification` utility; fire-and-forget to avoid blocking
  finalization

---

## Files Modified

| File                                                              | Tasks     |
| ----------------------------------------------------------------- | --------- |
| `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`             | 1.1, 4.2  |
| `functions/autograde/src/callable/extract-questions.ts`           | 1.2       |
| `packages/shared-types/src/schemas/callable-schemas.ts`           | 1.2       |
| `packages/shared-services/src/autograde/exam-callables.ts`        | 1.2       |
| `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`          | 1.3, 5.1  |
| `functions/autograde/src/utils/grading-queue.ts`                  | 2.1       |
| `functions/autograde/src/pipeline/process-answer-grading.ts`      | 2.2, 4.2  |
| `functions/autograde/src/schedulers/stale-submission-watchdog.ts` | 2.3 (new) |
| `functions/autograde/src/index.ts`                                | 2.3       |
| `functions/levelup/src/callable/send-chat-message.ts`             | 3.1, 3.2  |
| `packages/shared-services/src/ai/usage-quota.ts`                  | 4.1       |
| `packages/shared-services/src/ai/llm-logger.ts`                   | 4.1       |
| `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`            | 5.2       |
| `functions/autograde/src/pipeline/finalize-submission.ts`         | 5.3       |

## Build Status

- `functions/autograde` — PASSES
- `functions/levelup` — PASSES
- `packages/shared-types` — PASSES
- `packages/shared-services` — PASSES
- `apps/teacher-web` — TS type-check PASSES (vite build has pre-existing
  `@tiptap/react` issue in shared-ui)
- `apps/parent-web` — pre-existing `@tiptap/react` issue (unrelated to Cycle 4)
