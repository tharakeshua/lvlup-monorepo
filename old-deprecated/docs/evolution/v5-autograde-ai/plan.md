# V5: AutoGrade & AI Pipeline — Evolution Plan

**Cycle:** 1 **Vertical:** V5 — AutoGrade & AI Pipeline **Engineer:** AI &
Grading Engineer **Dependencies:** V1 (Type System), V2 (API Redesign), V3
(Error Handling) — all complete **Parallel with:** V4 (Learning Platform)

---

## Audit Summary

### Current State

The AutoGrade + AI pipeline is **functionally complete** with:

- Question extraction via Gemini (OCR from question paper images)
- Panopticon answer-to-question mapping (scouting)
- RELMS per-question grading with structured multi-dimensional feedback
- LLM accountability framework (logging, cost tracking, retry logic)
- Firestore-trigger-based pipeline state machine (uploaded → scouting → grading
  → review)
- Dead letter queue for failed grading entries
- Manual override + grade review UI
- AI chat tutoring (Socratic method, Gemini-powered)
- AI answer evaluation (multi-type: text, paragraph, code, audio, image, chat)
- Admin AI usage dashboard with daily cost trends

### Gaps Identified

1. **OCR Accuracy:** No validation step after extraction — malformed or
   partially-extracted questions silently pass through. No image quality
   pre-checks (blur, rotation, skew). No support for distinguishing printed vs.
   handwritten vs. mixed content.

2. **Grading Queue:** Pipeline runs synchronously via Firestore triggers. No
   rate limiting on concurrent LLM calls. All questions in a submission grade
   sequentially. No batch processing controls for large exam cohorts.

3. **Confidence & Review:** Confidence scores exist but are not used to flag
   low-confidence grades for human review. No partial credit support in the
   review UI. No confidence threshold configuration.

4. **AI Chat Tutoring:** Conversation history is flat text concatenation (no
   proper multi-turn). No subject-specific system prompts. No safety filters for
   student AI interactions.

5. **LLM Observability:** Daily cost summaries exist but no usage quotas per
   tenant. No alerting. No model-level or operation-level breakdown in the admin
   dashboard. No response quality metrics.

6. **API Fallback:** LLM wrapper has retry + exponential backoff but no graceful
   degradation when API is down. No user-facing error messages for AI failures.

---

## Implementation Plan

### Module 1: OCR Extraction Accuracy & Image Quality (functions/autograde)

**Files to modify:**

- `functions/autograde/src/prompts/extraction.ts` — enhanced prompts
- `functions/autograde/src/callable/extract-questions.ts` — validation step
- `functions/autograde/src/utils/image-quality.ts` — NEW: image quality checks
- `packages/shared-types/src/autograde/exam.ts` — add quality metadata types

**Changes:**

1. **Image quality pre-check utility** (`image-quality.ts`):
   - Analyze image dimensions (min 800x600 resolution check)
   - Detect likely format (printed/handwritten/mixed) from image metadata
   - Return quality assessment with warnings (blurry, too dark, too small)
   - This is metadata-level — not ML-based, works on image dimensions and MIME
     types

2. **Enhanced extraction prompt** (`extraction.ts`):
   - Add explicit instructions for handling handwritten, printed, and mixed
     content
   - Add instruction to flag unclear/unreadable sections with
     `"readabilityIssue": true`
   - Add instruction for diagram-heavy papers to note diagram regions

3. **Post-extraction validation step** (`extract-questions.ts`):
   - After parsing, validate: all questions have text, marks, and criteria
   - Check criteria sum matches maxMarks (already exists, keep)
   - Validate question numbering is sequential
   - Add `extractionConfidence` field to each saved question
   - Return warnings array for teacher review (e.g., "Q3 may be partially
     unreadable")

4. **Types** (`exam.ts`):
   - Add `ExtractionQualityReport` type with image quality and extraction
     warnings

### Module 2: Grading Queue & Batch Processing (functions/autograde)

**Files to modify:**

- `functions/autograde/src/pipeline/process-answer-grading.ts` — batch + rate
  limit
- `functions/autograde/src/pipeline/process-answer-mapping.ts` — concurrency
  control
- `functions/autograde/src/utils/grading-queue.ts` — NEW: queue management
- `functions/autograde/src/triggers/on-submission-updated.ts` — batch awareness

**Changes:**

1. **Grading queue utility** (`grading-queue.ts`):
   - `GradingRateLimiter` class with configurable concurrent call limit per
     tenant
   - Semaphore-based concurrency control (max 5 concurrent LLM calls per
     submission)
   - Batch size configuration (process N questions at a time)
   - Tenant-level throughput tracking via Firestore counter

2. **Batch processing in grading** (`process-answer-grading.ts`):
   - Process questions in configurable batches (default 5) using
     `Promise.allSettled`
   - Per-batch progress updates to Firestore (for real-time UI updates)
   - Respect tenant-level rate limits
   - Add per-question timing metrics to evaluation result

3. **Concurrency control in mapping** (`process-answer-mapping.ts`):
   - Add tenant-level semaphore check before starting scouting
   - Prevent multiple submissions from overwhelming Gemini API simultaneously

4. **Pipeline trigger batch awareness** (`on-submission-updated.ts`):
   - Track grading batch progress
   - Support `grading_failed` status transition to DLQ properly

### Module 3: Confidence Scoring & Human-in-the-Loop Review (functions/autograde + apps)

**Files to modify:**

- `functions/autograde/src/pipeline/process-answer-grading.ts` — confidence
  thresholds
- `functions/autograde/src/utils/grading-helpers.ts` — confidence-based routing
- `packages/shared-types/src/autograde/evaluation-settings.ts` — confidence
  config types
- `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx` — review UI
  enhancements

**Changes:**

1. **Confidence threshold configuration** (`evaluation-settings.ts` types):
   - Add `confidenceThreshold` to `EvaluationSettings` (default 0.7)
   - Add `autoApproveThreshold` (default 0.9) — grades above this skip review
   - Add `requireReviewForPartialCredit` boolean

2. **Confidence-based routing** (`process-answer-grading.ts` +
   `grading-helpers.ts`):
   - After grading, check confidence against threshold
   - If confidence < threshold → set `gradingStatus: 'needs_review'` (new
     status)
   - If confidence >= autoApproveThreshold → keep as `graded`
   - Between thresholds → keep as `graded` but flag with `reviewSuggested: true`
   - Add `needs_review` to `QuestionGradingStatus` type

3. **Partial credit support** (`grading-helpers.ts`):
   - Already supported via rubric breakdown — ensure UI surfaces it
   - Add `partialCreditAwarded` flag when score is between 0 and maxScore

4. **Review UI enhancements** (`GradingReviewPage.tsx`):
   - Add confidence badge (color-coded: green > 0.9, amber 0.7-0.9, red < 0.7)
   - Filter: "Show low-confidence only" toggle
   - Highlight questions with `reviewSuggested: true`
   - Show rubric breakdown inline with edit capability per criterion
   - Add "Accept AI Grade" and "Override" buttons per question

### Module 4: AI Chat Tutoring Enhancements (functions/levelup)

**Files to modify:**

- `functions/levelup/src/callable/send-chat-message.ts` — context memory +
  safety
- `functions/levelup/src/prompts/tutor.ts` — subject-specific prompts + safety
  rules
- `functions/levelup/src/utils/chat-safety.ts` — NEW: safety filter utility

**Changes:**

1. **Subject-specific system prompts** (`tutor.ts`):
   - Add subject-aware prompt sections based on item/space subject metadata
   - Math: include LaTeX formatting instructions, step-by-step solving guidance
   - Science: include experiment reasoning, hypothesis testing
   - Language: include grammar rules, writing style feedback
   - Default fallback for generic subjects

2. **Context memory improvements** (`send-chat-message.ts`):
   - Already uses subcollection for messages — good
   - Load last N messages from subcollection (not just preview array) for full
     context
   - Add conversation summarization: after 20 messages, summarize earlier
     context
   - Track topic shifts within a session

3. **Safety filter for student AI interactions** (`chat-safety.ts`):
   - Input sanitization: strip prompt injection attempts (already partially done
     with `<student_message>` wrapping)
   - Content filter: detect and block requests for non-educational content
   - Add safety system prompt section: "You MUST refuse to assist with anything
     unrelated to the current academic topic"
   - Rate limit abuse detection: flag users with > 50 messages/hour
   - Return `{ safe: boolean; reason?: string }` — block unsafe messages before
     LLM call

### Module 5: LLM Observability & Cost Tracking (packages/shared-services + functions/analytics)

**Files to modify:**

- `packages/shared-services/src/ai/llm-logger.ts` — enhanced logging
- `packages/shared-services/src/ai/cost-tracker.ts` — quota support
- `packages/shared-services/src/ai/usage-quota.ts` — NEW: quota enforcement
- `apps/admin-web/src/pages/AIUsagePage.tsx` — enhanced dashboard
- `packages/shared-types/src/autograde/evaluation-settings.ts` — quota types

**Changes:**

1. **Usage quota enforcement** (`usage-quota.ts`):
   - `UsageQuota` type:
     `{ monthlyBudgetUsd: number; dailyCallLimit: number; warningThresholdPercent: number }`
   - Check current month's spending before each LLM call
   - Soft limit (warning at 80%) and hard limit (block at 100%)
   - Per-tenant quota stored in `tenants/{tenantId}/settings`
   - Return `{ allowed: boolean; remaining: number; warningMessage?: string }`

2. **Enhanced LLM logging** (`llm-logger.ts`):
   - Add `promptTokenEstimate` for pre-call cost estimation
   - Add `modelVersion` field for model versioning tracking
   - Add daily cost aggregation (increment counter doc on each call)
   - Daily aggregation doc at `tenants/{tenantId}/costSummaries/{YYYY-MM-DD}`

3. **Enhanced cost tracker** (`cost-tracker.ts`):
   - Add `gemini-2.5-flash-lite` pricing (for chat)
   - Add image token estimation (based on image dimensions)

4. **Enhanced admin dashboard** (`AIUsagePage.tsx`):
   - Add quota progress bar (used/limit with color coding)
   - Add per-operation breakdown table (extraction, mapping, grading, chat,
     evaluation)
   - Add model breakdown (which models are being used most)
   - Add average cost per grading operation metric
   - Add warning banner when approaching quota limit

### Module 6: Graceful API Fallback (packages/shared-services)

**Files to modify:**

- `packages/shared-services/src/ai/llm-wrapper.ts` — fallback logic
- `packages/shared-services/src/ai/fallback-handler.ts` — NEW: fallback
  utilities
- `functions/autograde/src/pipeline/process-answer-grading.ts` — graceful
  degradation
- `functions/levelup/src/callable/send-chat-message.ts` — user-facing error
  messages

**Changes:**

1. **Fallback handler** (`fallback-handler.ts`):
   - Classify errors: `transient` (retry), `quota` (wait), `auth` (config
     issue), `model` (model unavailable)
   - Map error types to user-friendly messages
   - Track error patterns: if > 3 failures in 5 minutes for a tenant, activate
     circuit breaker
   - Circuit breaker: skip LLM calls for 60 seconds, return cached/fallback
     response

2. **Enhanced LLM wrapper** (`llm-wrapper.ts`):
   - Integrate fallback handler for error classification
   - Add `onError` callback option for custom error handling
   - Return structured error result instead of throwing when circuit breaker
     active
   - Add timeout handling (abort long-running calls after configurable duration)

3. **Graceful grading degradation** (`process-answer-grading.ts`):
   - On API failure after retries: mark question as `needs_review` instead of
     `failed`
   - Include partial result if available (e.g., "AI grading unavailable, manual
     review required")
   - Continue processing remaining questions even if one fails

4. **User-facing error messages** (chat + evaluation callables):
   - Replace generic "internal error" with specific messages:
     - Quota exceeded: "AI grading quota reached for this month. Contact your
       administrator."
     - API down: "AI service is temporarily unavailable. Please try again in a
       few minutes."
     - Auth issue: "AI service configuration error. Please contact support."

---

## Implementation Order

1. **Module 1** — OCR Extraction (foundation, no dependencies)
2. **Module 6** — API Fallback (needed by all AI operations)
3. **Module 2** — Grading Queue (depends on fallback handler)
4. **Module 5** — Observability & Quotas (enhances monitoring)
5. **Module 3** — Confidence & Review (builds on grading pipeline)
6. **Module 4** — Chat Enhancements (independent, can be last)

## Files Created (New)

| File                                                  | Purpose                            |
| ----------------------------------------------------- | ---------------------------------- |
| `functions/autograde/src/utils/image-quality.ts`      | Image quality pre-check utility    |
| `functions/autograde/src/utils/grading-queue.ts`      | Queue management + rate limiting   |
| `functions/levelup/src/utils/chat-safety.ts`          | Safety filter for student AI chat  |
| `packages/shared-services/src/ai/usage-quota.ts`      | Per-tenant usage quota enforcement |
| `packages/shared-services/src/ai/fallback-handler.ts` | Graceful API error handling        |

## Files Modified (Existing)

| File                                                         | Changes                                        |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `functions/autograde/src/prompts/extraction.ts`              | Enhanced prompts for handwritten/mixed         |
| `functions/autograde/src/callable/extract-questions.ts`      | Post-extraction validation step                |
| `functions/autograde/src/pipeline/process-answer-grading.ts` | Batch processing, confidence routing, fallback |
| `functions/autograde/src/pipeline/process-answer-mapping.ts` | Concurrency control                            |
| `functions/autograde/src/utils/grading-helpers.ts`           | Confidence-based routing helpers               |
| `functions/autograde/src/triggers/on-submission-updated.ts`  | Batch awareness                                |
| `functions/levelup/src/callable/send-chat-message.ts`        | Context memory, safety filter                  |
| `functions/levelup/src/prompts/tutor.ts`                     | Subject-specific prompts, safety rules         |
| `packages/shared-services/src/ai/llm-wrapper.ts`             | Fallback integration, circuit breaker          |
| `packages/shared-services/src/ai/llm-logger.ts`              | Enhanced logging, daily aggregation            |
| `packages/shared-services/src/ai/cost-tracker.ts`            | New model pricing, image tokens                |
| `packages/shared-types/src/autograde/evaluation-settings.ts` | Confidence config, quota types                 |
| `apps/admin-web/src/pages/AIUsagePage.tsx`                   | Quota display, operation breakdown             |
| `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`     | Confidence badges, review filters              |

## Coding Standards

- TypeScript strict mode, zero `any`
- Use existing Zod schemas and branded types from `@levelup/shared-types`
- Follow existing patterns: `HttpsError` for callable errors, `admin.firestore`
  for DB access
- All new types exported from `@levelup/shared-types`
- All new AI utilities exported from `@levelup/shared-services/ai`
- Non-blocking logging (fire-and-forget for audit logs)
- Must pass `pnpm build` and `pnpm lint`

## Acceptance Criteria

- [ ] Question extraction includes validation step with quality warnings
- [ ] Image quality metadata captured before extraction
- [ ] Grading processes questions in batches with configurable concurrency
- [ ] Rate limiting prevents Gemini API overload per tenant
- [ ] Low-confidence grades flagged for human review
- [ ] Confidence threshold configurable per tenant
- [ ] GradingReviewPage shows confidence badges and review filters
- [ ] AI chat has subject-specific prompting
- [ ] Safety filter blocks non-educational content in chat
- [ ] Per-tenant usage quotas enforced with warning/hard limits
- [ ] Daily cost aggregation auto-incremented on each LLM call
- [ ] Admin dashboard shows quota progress and operation breakdown
- [ ] Circuit breaker activates after repeated API failures
- [ ] User-facing error messages replace generic internal errors
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
