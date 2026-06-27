# V5 AutoGrade & AI Pipeline — Cycle 4 Plan

**Cycle:** 4 **Vertical:** V5 — AutoGrade & AI Pipeline **Engineer:** AI &
Grading Engineer **Date:** 2026-03-08

---

## Prior Work Summary

**Cycle 1** established the full V5 infrastructure: image quality pre-checks,
post-extraction validation with quality warnings, grading queue with batch
processing + rate limiting, confidence-based review routing (needs_review /
auto-approve thresholds), subject-specific AI tutoring with safety filters, LLM
usage quotas with daily cost aggregation, circuit breaker + graceful API
fallback, and user-facing error messages. GradingReviewPage received confidence
badges, review filter toggles, and accept/override buttons.

**Cycle 2** refined: override score validation (0..maxMarks), bulk approve
confirmation dialog, cost projection in admin dashboard, and review priority
sorting.

**Cycle 3** added: blank sheet / illegible writing detection, formatted grading
error messages, DLQ visibility in admin dashboard, pipeline progress bar on
SubmissionsPage, grading summary stats, enhanced retry with error context,
override audit trail timeline, animated typing indicator, side-by-side grading
review layout, confidence progress bars with labels, and high-score celebration.

---

## Audit — Current State & Remaining Gaps

After 3 cycles, the pipeline is functionally mature. This audit identifies
deeper quality gaps, operational robustness issues, and UX gaps that remain:

### Gap 1: OCR Multi-Pass Extraction Accuracy

- Image quality checks are metadata-only (file size heuristics). No actual
  visual quality analysis.
- The extraction prompt handles printed/handwritten/mixed content well, but
  there is **no second-pass extraction** for low-confidence questions. Questions
  flagged with `readabilityIssue: true` or `extractionConfidence < 0.7` are
  saved as-is.
- **No teacher-side extraction editing** — teachers can't fix AI-extracted
  question text, marks, or rubric criteria before grading starts. They must wait
  for grading to complete, then override.

### Gap 2: Grading Queue Observability & Control

- `grading-queue.ts` has `maxConcurrent` config but never enforces it —
  `processBatch` processes all items within a batch concurrently via
  `Promise.allSettled`. The semaphore-based concurrency control mentioned in
  Cycle 1 plan was never implemented.
- No ability for teachers to **pause/cancel** an in-progress grading run.
- No per-question timing metrics logged (Cycle 1 acceptance criteria mentioned
  this but not implemented).

### Gap 3: AI Chat Context Memory & Multi-Turn Quality

- Conversation summarization exists (>20 messages) but is a naive text
  truncation — it takes the last 6 of the older messages, truncated to 150 chars
  each. No actual LLM-based summarization.
- No concept of **topic tracking** — the system doesn't detect topic shifts
  within a session.
- Chat sessions have no **learning progress tracking** — no way to track which
  concepts the student has mastered vs. struggled with during a session.

### Gap 4: LLM Cost Tracking Granularity

- Daily cost summaries aggregate by `purpose` but not by **model** — no way to
  see which model is driving costs.
- No per-submission or per-exam cost tracking — can't tell how much a specific
  exam's grading cost.
- Image token estimation (`estimateImageTokens`) is not used in the actual cost
  tracking path — the Gemini API reports actual token counts which are used
  instead.

### Gap 5: Grading Pipeline Resilience

- Pipeline trigger (`on-submission-updated.ts`) has error handling for
  scouting/grading failures, but `grading_failed` status has no automatic
  recovery path — it just creates a DLQ entry.
- No **stale submission detection** — if a submission gets stuck in `grading` or
  `scouting` status (e.g., Cloud Function timeout), there's no watchdog to
  detect and retry.
- `finalization_failed` submissions have no recovery path.

### Gap 6: Teacher UX for Grading Review

- No **keyboard navigation** for reviewing questions (arrow keys to expand
  next/previous).
- No **batch export** of grading results (CSV/PDF).
- No inline view of the **original question text** alongside the student answer
  in the review page — teachers have to mentally map question numbers.

---

## Implementation Plan

### Theme 1: Extraction Quality & Teacher Editing (3 tasks)

**Task 1.1: Extraction Review & Edit UI**

- File: `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`
- After extraction (`question_paper_extracted` status), show extracted questions
  in an editable list
- Each question shows: question text (editable textarea), maxMarks (editable
  number), rubric criteria (add/remove/edit)
- Confidence indicator per question (green/amber/red badge based on
  `extractionConfidence`)
- "Re-extract" button per question for low-confidence items
- "Confirm & Publish" button that saves edits and transitions exam to
  `published` status
- Acceptance: Teachers can review and edit extracted questions before grading
  starts

**Task 1.2: Per-Question Re-Extraction Endpoint**

- File: `functions/autograde/src/callable/extract-questions.ts`
- Add a `mode: 'single'` option that re-extracts a single question from the
  question paper
- Takes `questionNumber` parameter, sends the question paper images with a
  focused prompt: "Re-extract question N only"
- Updates the existing question document with new extraction results
- Acceptance: Individual low-confidence questions can be re-extracted without
  redoing the entire paper

**Task 1.3: Question Text Preview in Grading Review**

- File: `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- In the expanded question view, show the original question text (from
  `ExamQuestion.text`) above the student answer
- Collapsible section: "Question" with the full text, maxMarks, and rubric
  criteria
- Acceptance: Teachers see the original question alongside the student answer
  during review

### Theme 2: Grading Pipeline Robustness (3 tasks)

**Task 2.1: Concurrency Limiter in Batch Processing**

- File: `functions/autograde/src/utils/grading-queue.ts`
- Implement actual concurrency control in `processBatch`: use a semaphore
  pattern so within each batch, only `maxConcurrent` promises run simultaneously
  instead of all at once
- This prevents Gemini API 429s when batch size > API rate limit
- Acceptance: `processBatch` respects `maxConcurrent` with semaphore-based
  throttling

**Task 2.2: Per-Question Timing Metrics**

- File: `functions/autograde/src/pipeline/process-answer-grading.ts`
- Add `timingMs` field to the evaluation result saved to Firestore
- Track: LLM call duration, image download duration, total processing time
- Acceptance: Each graded question has `evaluation.timingMs` with breakdown

**Task 2.3: Stale Submission Watchdog**

- File: `functions/autograde/src/triggers/on-submission-updated.ts` (or new
  scheduled function)
- Add a scheduled Cloud Function (runs every 15 minutes) that queries
  submissions stuck in `scouting` or `grading` status for > 10 minutes
- For stale submissions: increment retryCount, reset to previous stage trigger,
  or move to `manual_review_needed` if max retries exceeded
- Acceptance: Submissions stuck in processing states are automatically detected
  and retried or escalated

### Theme 3: AI Chat Intelligence (2 tasks)

**Task 3.1: LLM-Powered Conversation Summarization**

- File: `functions/levelup/src/callable/send-chat-message.ts`
- Replace the naive text-truncation summarization with an actual LLM call
- When conversation exceeds 20 messages, call Gemini with
  `gemini-2.5-flash-lite` (cheapest model) to produce a structured summary: key
  topics discussed, student's understanding level, concepts mastered, concepts
  still struggling with
- Cache the summary in the chat session document (`session.conversationSummary`)
- Only regenerate when 10+ new messages have been added since last summary
- Acceptance: Long conversations use LLM-generated summaries for better context
  continuity

**Task 3.2: Session Learning Insights**

- File: `functions/levelup/src/callable/send-chat-message.ts`
- After each AI response, extract lightweight learning signals: did the student
  show understanding? Did they struggle? What concept was discussed?
- Store in chat session:
  `session.learningInsights: { conceptsTouched: string[], masterySignals: number, struggleSignals: number }`
- Use `gemini-2.5-flash-lite` with a focused extraction prompt (cheap, fast)
- Acceptance: Chat sessions track which concepts were covered and student's
  apparent mastery

### Theme 4: Cost Tracking Granularity (2 tasks)

**Task 4.1: Model-Level Cost Breakdown**

- File: `packages/shared-services/src/ai/usage-quota.ts`
- Extend `incrementDailyCostSummary` to also increment
  `byModel.{modelName}.calls` and `byModel.{modelName}.costUsd` fields
- Acceptance: Daily cost summaries include per-model breakdown

**Task 4.2: Per-Exam Cost Tracking**

- File: `functions/autograde/src/pipeline/process-answer-grading.ts`
- After grading completes for a submission, aggregate the total cost from all
  question evaluations
- Write to `tenants/{tenantId}/exams/{examId}` document:
  `stats.totalGradingCostUsd` (incremented per submission)
- Show in ExamDetailPage alongside other stats
- Acceptance: Each exam shows its total AI grading cost

### Theme 5: Teacher UX Enhancements (3 tasks)

**Task 5.1: Keyboard Navigation in Grading Review**

- File: `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- Add keyboard shortcuts: `j`/`k` or `↓`/`↑` to move to next/previous question,
  `Enter` to expand/collapse, `a` to accept AI grade, `o` to focus override
  input
- Add `useEffect` with `keydown` listener, scoped to review page
- Show keyboard shortcut hint at top of question list
- Acceptance: Teachers can navigate and act on questions without mouse

**Task 5.2: Grading Results Export (CSV)**

- File: `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`
- Add "Export Results" button that generates a CSV with columns: Student Name,
  Roll Number, Q1 Score, Q2 Score, ..., Total, Percentage, Grade
- Include grading status and confidence per question
- Use client-side CSV generation (no backend needed)
- Acceptance: Teachers can download grading results as CSV

**Task 5.3: Grading Completion Notification**

- File: `functions/autograde/src/pipeline/finalize-submission.ts`
- After finalizing a submission, send a notification to the exam creator
  (teacher)
- Use existing `sendNotification` utility
- Message: "{studentName}'s submission has been graded: {score}/{maxScore}
  ({grade})"
- Batch notification: when all submissions for an exam are graded, send a
  summary notification
- Acceptance: Teachers are notified when grading completes

---

## Files Modified (Summary)

| File                                                                              | Tasks    |
| --------------------------------------------------------------------------------- | -------- |
| `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`                             | 1.1      |
| `functions/autograde/src/callable/extract-questions.ts`                           | 1.2      |
| `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`                          | 1.3, 5.1 |
| `functions/autograde/src/utils/grading-queue.ts`                                  | 2.1      |
| `functions/autograde/src/pipeline/process-answer-grading.ts`                      | 2.2, 4.2 |
| `functions/autograde/src/triggers/on-submission-updated.ts` (or new scheduled fn) | 2.3      |
| `functions/levelup/src/callable/send-chat-message.ts`                             | 3.1, 3.2 |
| `packages/shared-services/src/ai/usage-quota.ts`                                  | 4.1      |
| `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`                            | 5.2      |
| `functions/autograde/src/pipeline/finalize-submission.ts`                         | 5.3      |

## Implementation Order

1. **Task 2.1** (concurrency limiter) — Foundation fix, no dependencies
2. **Task 2.2** (timing metrics) — Quick backend enhancement
3. **Task 4.1** (model-level cost) — Quick backend enhancement
4. **Task 1.2** (re-extraction endpoint) — Backend for extraction editing
5. **Task 1.1** (extraction review UI) — Depends on 1.2
6. **Task 1.3** (question text in review) — Quick UI addition
7. **Task 5.1** (keyboard navigation) — Quick UI enhancement
8. **Task 3.1** (LLM summarization) — Independent backend
9. **Task 3.2** (learning insights) — Builds on 3.1 patterns
10. **Task 4.2** (per-exam cost) — Backend enhancement
11. **Task 2.3** (stale watchdog) — Independent scheduled function
12. **Task 5.2** (CSV export) — Independent UI feature
13. **Task 5.3** (grading notification) — Independent backend

## Acceptance Criteria

- [ ] Teachers can review and edit extracted questions before publishing
- [ ] Individual low-confidence questions can be re-extracted
- [ ] Question text visible in grading review alongside student answer
- [ ] `processBatch` enforces actual concurrency limits via semaphore
- [ ] Per-question timing metrics stored in evaluation result
- [ ] Stale submissions detected and retried or escalated automatically
- [ ] Long chat conversations use LLM-generated summaries
- [ ] Chat sessions track learning insights (concepts, mastery signals)
- [ ] Daily cost summaries include per-model breakdown
- [ ] Each exam shows total AI grading cost
- [ ] Keyboard navigation works in grading review page
- [ ] Grading results exportable as CSV
- [ ] Teachers notified when grading completes
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes (for modified files)
