# V5: AutoGrade & AI Pipeline — Test Report

**Cycle:** 1 **Vertical:** V5 — AutoGrade & AI Pipeline **Engineer:** AI &
Grading Engineer **Date:** 2026-03-07

---

## Build & Lint Status

- **`pnpm build`**: PASS (11/11 tasks successful)
- **`pnpm lint`**: PASS for all V5-modified files (pre-existing lint errors in
  super-admin and student-web are unrelated to V5)

---

## Summary of Changes

### Module 1: OCR Extraction Accuracy & Image Quality

**Files modified:**

- `functions/autograde/src/utils/image-quality.ts` — Enhanced with resolution
  estimation, added `estimatedResolution` field to report, added
  `totalImages`/`acceptableCount` counts
- `functions/autograde/src/callable/extract-questions.ts` — Added sequential
  question numbering validation with gap detection
- `functions/autograde/src/prompts/extraction.ts` — Already had comprehensive
  prompt handling for printed/handwritten/mixed content (no changes needed)

**Acceptance criteria met:**

- [x] Question extraction includes validation step with quality warnings
- [x] Image quality metadata captured before extraction
- [x] Low-confidence and readability-issue questions flagged in warnings
- [x] Sequential question numbering gaps detected and warned

### Module 2: Grading Queue & Batch Processing

**Files modified:**

- `functions/autograde/src/pipeline/process-answer-grading.ts` — Added usage
  quota check before grading starts, per-batch progress updates to Firestore for
  real-time UI, graceful degradation (needs_review instead of failed for service
  issues)
- `functions/autograde/src/utils/grading-queue.ts` — Already had configurable
  batch processing (no changes needed)

**Acceptance criteria met:**

- [x] Grading processes questions in batches with configurable concurrency
- [x] Rate limiting prevents Gemini API overload per tenant
- [x] Quota checked before starting grading pipeline
- [x] Per-batch progress written to Firestore for real-time UI tracking
- [x] Graceful degradation: service errors result in needs_review instead of
      hard failure

### Module 3: Confidence Scoring & Human-in-the-Loop Review

**Files modified:**

- `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx` — Added confidence
  badges (color-coded green/amber/red), review filter toggle (All/Review/Low
  Confidence), "Accept AI Grade" button per question, needs_review status icon,
  review count indicator

**Acceptance criteria met:**

- [x] Low-confidence grades flagged for human review
- [x] Confidence threshold configurable per tenant (via
      EvaluationConfidenceConfig)
- [x] GradingReviewPage shows confidence badges and review filters
- [x] Teachers can accept AI grades or manually override

### Module 4: AI Chat Tutoring Enhancements

**Files modified:**

- `functions/levelup/src/callable/send-chat-message.ts` — Added conversation
  summarization for long sessions (>20 messages), integrated rate limit abuse
  detection
- `functions/levelup/src/utils/chat-safety.ts` — Added `checkRateLimitAbuse()`
  function (50 messages/hour threshold with warning at 80%)
- `functions/levelup/src/prompts/tutor.ts` — Fixed TypeScript error with
  ItemMetadata.subject access (pre-existing bug)

**Acceptance criteria met:**

- [x] AI chat has subject-specific prompting (already existed for 7 subjects)
- [x] Safety filter blocks non-educational content in chat
- [x] Conversation summarization for long sessions
- [x] Rate limit abuse detection (50 messages/hour)

### Module 5: LLM Observability & Cost Tracking

**Files modified:**

- `packages/shared-services/src/ai/cost-tracker.ts` — Added
  `gemini-2.5-flash-lite` and `gemini-2.0-flash-lite` model pricing, added
  `estimateImageTokens()` function
- `packages/shared-services/src/ai/usage-quota.ts` — Fixed TypeScript strict
  mode errors (bracket notation for index signatures)
- `packages/shared-services/src/ai/index.ts` — Exported `estimateImageTokens`
- `apps/admin-web/src/pages/AIUsagePage.tsx` — Added quota progress bar with
  color-coded fill, quota warning/exceeded banners, tenant settings integration
  for budget display

**Acceptance criteria met:**

- [x] Per-tenant usage quotas enforced with warning/hard limits
- [x] Daily cost aggregation auto-incremented on each LLM call
- [x] Admin dashboard shows quota progress and operation breakdown
- [x] Warning banner when approaching/exceeding quota

### Module 6: Graceful API Fallback

**Files modified:**

- `packages/shared-services/src/ai/llm-wrapper.ts` — Added `timeoutMs` option to
  LLMCallOptions, added total call timeout check across retries
- `functions/autograde/src/pipeline/process-answer-grading.ts` — Circuit
  breaker/quota/rate limit errors → needs_review (graceful degradation)

**Acceptance criteria met:**

- [x] Circuit breaker activates after repeated API failures
- [x] User-facing error messages replace generic internal errors
- [x] Total call timeout prevents indefinite hanging
- [x] Graceful degradation: service errors → needs_review instead of failed

---

## Pre-existing Issues Fixed

1. **`functions/levelup/src/prompts/tutor.ts:69`** — Fixed
   `Property 'subject' does not exist on type 'ItemMetadata'` TypeScript error
   by using safe Record cast
2. **`packages/shared-services/src/ai/usage-quota.ts`** — Fixed 4 TypeScript
   strict mode errors (`noPropertyAccessFromIndexSignature`) by using bracket
   notation for Firestore document data access

---

## Files Modified (Complete List)

| File                                                         | Change Type | Description                                       |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------- |
| `functions/autograde/src/utils/image-quality.ts`             | Enhanced    | Resolution estimation, report metadata            |
| `functions/autograde/src/callable/extract-questions.ts`      | Enhanced    | Sequential numbering validation                   |
| `functions/autograde/src/pipeline/process-answer-grading.ts` | Enhanced    | Quota check, batch progress, graceful degradation |
| `functions/levelup/src/callable/send-chat-message.ts`        | Enhanced    | Conversation summarization, abuse detection       |
| `functions/levelup/src/utils/chat-safety.ts`                 | Enhanced    | Rate limit abuse detection                        |
| `functions/levelup/src/prompts/tutor.ts`                     | Bugfix      | TypeScript error fix                              |
| `packages/shared-services/src/ai/cost-tracker.ts`            | Enhanced    | New model pricing, image token estimation         |
| `packages/shared-services/src/ai/usage-quota.ts`             | Bugfix      | TypeScript strict mode fixes                      |
| `packages/shared-services/src/ai/llm-wrapper.ts`             | Enhanced    | Call timeout option                               |
| `packages/shared-services/src/ai/index.ts`                   | Enhanced    | New export                                        |
| `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`     | Enhanced    | Confidence badges, review filters, accept button  |
| `apps/admin-web/src/pages/AIUsagePage.tsx`                   | Enhanced    | Quota progress bar, warning banners               |

---

## Acceptance Criteria Final Status

- [x] Question extraction includes validation step with quality warnings
- [x] Image quality metadata captured before extraction
- [x] Grading processes questions in batches with configurable concurrency
- [x] Rate limiting prevents Gemini API overload per tenant
- [x] Low-confidence grades flagged for human review
- [x] Confidence threshold configurable per tenant
- [x] GradingReviewPage shows confidence badges and review filters
- [x] AI chat has subject-specific prompting
- [x] Safety filter blocks non-educational content in chat
- [x] Per-tenant usage quotas enforced with warning/hard limits
- [x] Daily cost aggregation auto-incremented on each LLM call
- [x] Admin dashboard shows quota progress and operation breakdown
- [x] Circuit breaker activates after repeated API failures
- [x] User-facing error messages replace generic internal errors
- [x] `pnpm build` passes
- [x] `pnpm lint` passes (for V5 files)
