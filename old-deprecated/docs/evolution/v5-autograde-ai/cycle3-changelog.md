# V5 AutoGrade & AI Pipeline — Cycle 3 Changelog

## Files Modified (6 files)

### 1. `functions/autograde/src/utils/image-quality.ts`

- Added `POSSIBLY_BLANK` detection for images < 15KB (likely blank answer
  sheets)
- Added `LOW_CONTRAST` detection for images 15–30KB (potentially illegible
  writing)
- Both flagged with severity `warning` and descriptive messages for teacher
  review
- PDF MIME type excluded from blank detection (PDFs have different size
  profiles)

### 2. `functions/autograde/src/pipeline/process-answer-grading.ts`

- Added `formatGradingError()` function mapping raw errors to user-friendly
  messages
- Error categories: quota exceeded, circuit breaker, rate limit, timeout,
  invalid response, blank answer
- All `gradingError` fields now contain human-readable messages instead of raw
  error strings
- Both retry-pending and terminal (failed/needs_review) errors use formatted
  messages

### 3. `apps/student-web/src/components/chat/ChatTutorPanel.tsx`

- Replaced static "Thinking..." loading text with animated typing indicator
- Three bouncing dots with staggered animation delays (0ms, 150ms, 300ms)
- Uses Tailwind `animate-bounce` with CSS `animationDelay` for natural typing
  feel

### 4. `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`

- Added summary stats cards (Total, Graded, In Progress, Needs Review, Avg
  Score)
- Added `PipelineSteps` component showing step-by-step progress (Upload →
  Mapping → Grading → Review)
- Added grading progress bar for submissions in `grading` status (reads
  `gradingProgress.percentComplete`)
- Pipeline steps show green (complete), animated primary (current), and muted
  (pending)
- Added `useMemo` for stats computation, `FileCheck`, `BarChart3`, `Users` icons

### 5. `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`

- **Side-by-side layout**: Expanded question view shows answer image on left, AI
  evaluation on right (desktop); stacks vertically on mobile (responsive
  `lg:grid-cols-2`)
- **Confidence visuals**: Added color-coded progress bar (green ≥90%, amber
  ≥70%, red <70%) with descriptive labels ("High Confidence", "Medium — Review
  Suggested", "Low — Review Recommended")
- **Grading error context**: Shows `gradingError` message, retry count badge,
  and "Retry limit reached" when ≥3 attempts
- **Override audit trail timeline**: Two-step timeline with visual dots (AI
  Graded → Override Applied), showing original score, confidence, new score,
  reason, and timestamps
- **High score celebration**: Gold banner with Trophy + Star icons for
  submissions scoring ≥90%
- **Retry button disabled at limit**: Retry button shows "Retry Limit Reached"
  when `gradingRetryCount ≥ 3`
- Added `Trophy`, `Star`, `Info` lucide icons

### 6. `apps/admin-web/src/pages/AIUsagePage.tsx`

- Added Dead Letter Queue section showing failed grading attempts from
  `gradingDeadLetter` collection
- Fetches latest 50 entries ordered by `lastAttemptAt` descending
- Shows: submission ID (truncated), question ID, pipeline step, error message,
  attempt count, last attempt date
- Added `Skull` icon, Firestore query imports, `useEffect` for DLQ fetching
- Gracefully handles missing collection (new tenants)
