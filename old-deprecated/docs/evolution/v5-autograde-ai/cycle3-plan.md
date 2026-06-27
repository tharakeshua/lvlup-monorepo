# V5 AutoGrade & AI Pipeline — Cycle 3: Combined Pass 1

## Prior Work Summary

**Cycle 1** established the full V5 infrastructure: OCR extraction with image
quality checks, Panopticon answer mapping, RELMS grading pipeline with batch
processing, confidence-based review routing, AI chat tutoring with
subject-specific prompts and safety filters, LLM observability with cost
tracking and quota enforcement, and graceful API fallback with circuit breaker.

**Cycle 2** added refinements: override score validation, bulk approve
confirmation dialog, cost projection in admin dashboard, and review priority
sorting.

## Cycle 3 Scope — 4-Theme Approach

### Theme 1: Feature Completion (3 tasks)

**Task 1.1: Blank Sheet & Illegible Writing Detection**

- File: `functions/autograde/src/utils/image-quality.ts`
- Add `POSSIBLY_BLANK` detection: images < 15KB with image/\* MIME → flag with
  severity 'warning'
- Add `LOW_CONTRAST` heuristic: images between 15–30KB → potential illegible
  writing
- Pipeline uses this to set `gradingStatus: 'needs_review'` with descriptive
  error for blank sheets
- Acceptance: Blank/tiny images flagged with descriptive warnings before grading

**Task 1.2: Enhanced Grading Error Messages**

- File: `functions/autograde/src/pipeline/process-answer-grading.ts`
- Map error types to user-friendly messages in `gradingError` field
- Categories: quota exceeded, circuit breaker active, timeout, invalid response,
  blank answer
- Acceptance: `gradingError` contains human-readable messages instead of raw
  error strings

**Task 1.3: Dead Letter Queue Visibility**

- File: `apps/admin-web/src/pages/AIUsagePage.tsx`
- Add new section showing failed grading attempts from `gradingDeadLetter`
  collection
- Show: submission ID, question, error reason, attempt count, timestamp
- Acceptance: Admin can see failed grading attempts in the AI Usage dashboard

### Theme 2: Integration (2 tasks)

**Task 2.1: Pipeline Progress Bar on Submissions Page**

- File: `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`
- Show grading progress when submission is in `grading` status
- Display `gradingProgress.percentComplete` as a progress bar overlay
- Show step-by-step pipeline indicator: Upload → OCR → Mapping → Grading →
  Review
- Acceptance: Teachers see real-time grading progress for active submissions

**Task 2.2: Grading Summary Stats on Submissions Page**

- File: `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`
- Add summary cards above submissions list: total submissions, graded count, avg
  score, needs review count
- Acceptance: Teachers see aggregate stats at a glance

### Theme 3: Quality (2 tasks)

**Task 3.1: Enhanced Grading Retry with Clear Error Context**

- File: `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- Show `gradingError` message on failed/needs_review questions
- Add retry count badge to show how many retries attempted
- Show "Retry limit reached" when `gradingRetryCount >= 3`
- Acceptance: Teachers understand why grading failed and whether retry is
  available

**Task 3.2: Override Audit Trail Timeline**

- File: `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- Expand manual override section to show full audit history
- Show timeline: AI graded → Override applied → timestamp chain
- Include original AI confidence, original score, new score, reason
- Acceptance: Complete override history visible with timestamps (from combined
  cycle3 Task 5.1)

### Theme 4: UX Polish (4 tasks)

**Task 4.1: Typing Indicator for AI Chat**

- File: `apps/student-web/src/components/chat/ChatTutorPanel.tsx`
- Replace static "Thinking..." with animated typing dots indicator
- Three bouncing dots with staggered animation
- Acceptance: Animated typing indicator shown while AI responds

**Task 4.2: Side-by-Side Grading Review Layout**

- File: `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- When expanded, show answer image on left and AI evaluation on right (on
  desktop)
- Stack vertically on mobile
- Acceptance: Side-by-side layout for efficient review on desktop

**Task 4.3: Confidence Visuals Enhancement**

- File: `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- Add colored progress bar for confidence score (green/yellow/red)
- Add confidence label text: "High Confidence" / "Medium" / "Low — Review
  Recommended"
- Acceptance: Confidence is visually prominent with color-coded bar + label

**Task 4.4: Celebrate High Scores**

- File: `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- Show celebration badge/animation for submissions scoring ≥90%
- Gold star or trophy icon with congratulatory message in summary card
- Acceptance: High-performing submissions get visual celebration

## Files Modified (Summary)

| File                                                         | Tasks                   |
| ------------------------------------------------------------ | ----------------------- |
| `functions/autograde/src/utils/image-quality.ts`             | 1.1                     |
| `functions/autograde/src/pipeline/process-answer-grading.ts` | 1.2                     |
| `apps/admin-web/src/pages/AIUsagePage.tsx`                   | 1.3                     |
| `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`       | 2.1, 2.2                |
| `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`     | 3.1, 3.2, 4.2, 4.3, 4.4 |
| `apps/student-web/src/components/chat/ChatTutorPanel.tsx`    | 4.1                     |

## Implementation Order

1. Task 1.1 (blank detection) → Task 1.2 (error messages) — backend first
2. Task 4.1 (typing indicator) — independent, quick
3. Task 2.1 + 2.2 (submissions page) — integration
4. Task 1.3 (DLQ visibility) — admin
5. Task 3.1 + 3.2 + 4.2 + 4.3 + 4.4 (grading review page) — grouped edits
