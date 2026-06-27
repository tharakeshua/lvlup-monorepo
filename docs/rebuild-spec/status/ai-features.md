# AI Features — Status Report

> Audit scope: every AI/LLM-backed capability across the `auto-levelup` monorepo
> — content generation, autograding/evaluation, AI tutoring/chat, insights
> generation, and the LLM-call infrastructure (cost logging, quota, circuit
> breaker, secret management). Repo root:
> `/Users/subhang/Desktop/Projects/auto-levleup`.

---

## 1. What currently exists & how it's architected

All production AI runs on **Google Gemini** through a single shared wrapper.
There is **no OpenAI/Anthropic** usage anywhere in the active codebase.
Architecturally, there is one shared LLM infrastructure layer
(`packages/shared-services/src/ai/`) consumed by two Cloud Functions services
(`levelup`, `autograde`) plus an unrelated legacy implementation in
`LevelUp-App/`.

### 1.1 Shared LLM infrastructure — `packages/shared-services/src/ai/`

The canonical abstraction. Barrel: `packages/shared-services/src/ai/index.ts`.

- **`llm-wrapper.ts`** — `LLMWrapper` class. Wraps `@google/generative-ai`
  (`GoogleGenerativeAI`). One public method
  `call<T>(prompt, metadata, options)`. Supports: system prompt
  (`systemInstruction`), inline base64 images,
  `responseMimeType: 'application/json'`, `responseSchema`,
  temperature/maxTokens. Built-in retry with exponential backoff + jitter
  (retryable on 429/500/502/503/504/`overloaded`/`MAX_TOKENS`), per-tenant
  circuit breaker, total-call timeout (default 5 min), token usage + cost
  capture, automatic audit logging. Default model `gemini-2.5-flash`
  (`llm-wrapper.ts:113`).
- **`cost-tracker.ts`** — `estimateCost(model, tokens)`. Hard-coded per-1M-token
  pricing table for 7 Gemini models (`cost-tracker.ts:16`), conservative
  fallback pricing for unknown models, image-token heuristic
  (`estimateImageTokens`).
- **`llm-logger.ts`** — `logLLMCall()` writes one document per call to
  `/tenants/{tenantId}/llmCallLogs/{callId}` and fires
  `incrementDailyCostSummary` (fire-and-forget).
- **`usage-quota.ts`** — `checkUsageQuota(tenantId)` (monthly budget % + daily
  call limit, soft warning at 80%) and `incrementDailyCostSummary()` (atomic
  `FieldValue.increment` rollups by purpose + model).
- **`fallback-handler.ts`** — `classifyError()` maps raw errors to
  `{type, userMessage, retryable}`; in-memory per-tenant circuit breaker
  (threshold 3 failures / 5-min window / 60s cooldown, half-open probe).
- **`secret-manager.ts`** — per-tenant Gemini key retrieval. Pattern
  `tenant-{tenantId}-gemini` in GCP Secret Manager; falls back to
  `GEMINI_API_KEY` env var.

### 1.2 LevelUp AI features — `functions/levelup/src/`

- **AI answer evaluation** (`callable/evaluate-answer.ts`, exported
  `evaluateAnswer`): For subjective types (`text`, `paragraph`, `code`, `audio`,
  `image_evaluation`, `chat_agent_question`). Deterministic types short-circuit
  to `autoEvaluateSubmission` (no LLM). Resolves an evaluator `Agent` (item →
  space default) and a `UnifiedRubric` via inheritance chain, builds the prompt
  via `prompts/evaluator.ts:buildEvaluationPrompt`, calls Gemini at temp 0.3 /
  maxTokens 4096, returns `UnifiedEvaluationResult`. Rate-limited 10 AI ops/min.
- **AI tutor chat** (`callable/send-chat-message.ts`, exported
  `sendChatMessage`): Socratic tutor. System prompt from
  `prompts/tutor.ts:buildTutorSystemPrompt` (agent persona + per-subject
  guidance + Socratic + safety rules). Messages stored in
  `chatSessions/{id}/messages` subcollection + a preview array on the parent
  doc. Three distinct LLM calls per long conversation: (1) the tutor reply
  (`gemini-2.5-flash`, temp 0.7), (2) **conversation summarization** when
  history > 20 messages, cached on the session (`gemini-2.5-flash-lite`), (3)
  **fire-and-forget learning-insight extraction** per exchange writing
  `learningInsights.{conceptsTouched, masterySignals, struggleSignals}`
  (`gemini-2.5-flash-lite`, temp 0.1). Pre-LLM safety gate via
  `utils/chat-safety.ts`.
- **Prompt architecture (`prompts/evaluator.ts`, `prompts/tutor.ts`)**:
  prompt-builder functions that assemble strings from item/rubric/agent.
  Evaluator emits a fixed JSON contract (`EVALUATION_OUTPUT_FORMAT`,
  `evaluator.ts:208`) including `score`, `rubricBreakdown`,
  `mistakeClassification`, `confidence`. Tutor injects subject-specific guidance
  for 7 subjects via a `Record<string,string>` lookup.

### 1.3 AutoGrade AI pipeline — `functions/autograde/src/`

Three-stage vision pipeline over scanned exam papers, all Gemini-2.5-flash
vision calls:

1. **Extraction** (`callable/extract-questions.ts` → `prompts/extraction.ts`):
   teacher-triggered. Sends question-paper images, extracts questions +
   auto-generated rubric criteria whose `maxPoints` sum to `maxMarks` (with
   auto-fix in `parseExtractionResponse`). `maxTokens` up to 65536 for full
   mode; supports `single`-question re-extraction. Pre-checks image quality via
   `utils/image-quality.ts`.
2. **Mapping / "Panopticon"** (`pipeline/process-answer-mapping.ts` →
   `prompts/panopticon.ts`): maps answer-sheet pages → question IDs using
   Gemini's large context window, "Sandwich Rule" gap-filling, confidence per
   mapping, `maxTokens: 16384`, temp 0.1. Creates one
   `questionSubmissions/{questionId}` doc per question.
3. **Grading / "RELMS"** (`pipeline/process-answer-grading.ts` →
   `prompts/relms.ts`): per-question grading. Resolves rubric + enabled
   `EvaluationDimension`s, downloads answer images, calls Gemini (temp 0.1,
   `maxTokens: 8192` to leave room for 2.5 "thinking" tokens), parses to
   `UnifiedEvaluationResult`. **Confidence-based routing**:
   `< confidenceThreshold (0.7)` → `needs_review`;
   `>= autoApproveThreshold (0.9)` → `graded`; middle → `graded` +
   `reviewSuggested`. Batched at 5 with `Promise.allSettled`, per-batch progress
   writes, quota check, DLQ (`gradingDeadLetter`), graceful degradation to
   manual review on service errors, per-exam cost accumulation.

### 1.4 Insights generation — `functions/analytics/src/`

- **`schedulers/generate-insights.ts`** + **`utils/insight-rules.ts`**: nightly
  (02:30 UTC) student insights. **This is rule-based, not LLM-backed** —
  `generateInsightsForStudent` runs deterministic heuristics over
  `studentProgressSummaries`/`spaceProgress` and writes up to 5 active insights
  per student to `/tenants/{tenantId}/insights`.
- **`schedulers/daily-cost-aggregation.ts`**: rolls `llmCallLogs` of the prior
  day into `costSummaries/daily/{date}` + `costSummaries/monthly/{month}`,
  checks tenant budget.
- **`callable/get-summary.ts`**: surfaces `llmCallLogs` error stats for
  analytics dashboards.

### 1.5 Legacy AI — `LevelUp-App/`

Independent, older Gemini integration via `@google/genai` (different SDK).
`src/integrations/llm/GeminiModel.ts`
(text/structured/function-calling/audio/multi-image) and
`src/integrations/questions/QuestionGenerationService.ts` (adaptive AI question
generation, `gemini-2.0-flash-001`). **This is the only AI content-generation
code that exists, and it is in the legacy app, not the new platform.**

---

## 2. Entities / schemas / collections / APIs / routes

### Callable Cloud Functions (region `asia-south1`)

| Function           | File                                                    | Purpose                                |
| ------------------ | ------------------------------------------------------- | -------------------------------------- |
| `evaluateAnswer`   | `functions/levelup/src/callable/evaluate-answer.ts`     | AI evaluate one subjective answer      |
| `sendChatMessage`  | `functions/levelup/src/callable/send-chat-message.ts`   | AI tutor chat turn                     |
| `extractQuestions` | `functions/autograde/src/callable/extract-questions.ts` | Vision question extraction             |
| `gradeQuestion`    | `functions/autograde/src/callable/grade-question.ts`    | Manual single-question regrade trigger |

### Pipeline workers (invoked by triggers)

- `functions/autograde/src/pipeline/process-answer-mapping.ts` (Panopticon)
- `functions/autograde/src/pipeline/process-answer-grading.ts` (RELMS)

### Schedulers

- `functions/analytics/src/schedulers/generate-insights.ts`
- `functions/analytics/src/schedulers/daily-cost-aggregation.ts`

### Domain types / schemas

- `packages/shared-types/src/levelup/agent.ts` — `Agent`
  (`type: 'tutor'|'evaluator'`, `identity`, `systemPrompt`, `rules`,
  `strictness`, `feedbackStyle`, `modelOverride`, `temperatureOverride`).
  Collection `/tenants/{t}/spaces/{s}/agents/{id}`.
- `packages/shared-types/src/levelup/chat.ts` — `ChatSession` + `ChatMessage`.
  Collection `/tenants/{t}/chatSessions/{id}` with `messages` subcollection.
- `packages/shared-types/src/content/rubric.ts` — `UnifiedRubric`,
  `RubricCriterion`, `EvaluationDimension` (`promptGuidance`, `priority`,
  `weight`, `scoringScale`).
- `packages/shared-types/src/autograde/evaluation-settings.ts` —
  `EvaluationSettings` (enabled dimensions, `EvaluationConfidenceConfig`,
  `UsageQuotaConfig`). Collection `/tenants/{t}/evaluationSettings/{id}`.
- `UnifiedEvaluationResult` (in `functions/*/src/types`) — shared grading output
  shape.
- Prompt-local result types: `ExtractionResult`/`ExtractedQuestion`
  (`extraction.ts`), `PanopticonResult` (`panopticon.ts`), `RELMSResult`
  (`relms.ts`).

### Firestore collections (AI-related)

- `/tenants/{t}/llmCallLogs/{id}` — per-call audit (CF write-only; read by
  admins/`canViewAnalytics`). Rules at `firestore.rules:576`.
- `/tenants/{t}/costSummaries/...` — **three inconsistent path shapes** (see
  pain points).
- `/tenants/{t}/chatSessions/{id}` + `messages` subcollection. Rules at
  `firestore.rules:529`.
- `/tenants/{t}/spaces/{s}/agents/{id}`, `/tenants/{t}/evaluationSettings/{id}`,
  `/tenants/{t}/insights/{id}`, `/tenants/{t}/gradingDeadLetter/{id}`.

### Secrets

- GCP Secret Manager `tenant-{tenantId}-gemini` (per-tenant key).
  `packages/shared-services/src/ai/secret-manager.ts`, mirrored at
  `functions/autograde/src/utils/llm.ts:139`.

### Models in use

`gemini-2.5-flash` (default — evaluation, chat reply, extraction, mapping,
RELMS), `gemini-2.5-flash-lite` (summarization, insight extraction),
`gemini-2.0-flash-001` (legacy app only). Pricing table covers 1.5/2.0/2.5
families (`cost-tracker.ts:16`).

---

## 3. Strengths worth keeping

- **Single typed LLM gateway.** `LLMWrapper.call(prompt, metadata, options)` is
  a clean, provider-agnostic-in-shape seam. Retry, circuit breaker, cost
  capture, and audit logging are centralized — every call is logged with rich
  metadata (`purpose`, `operation`, `resourceType`, `resourceId`, `userRole`).
- **Per-tenant secret isolation.** Keys live only in Secret Manager
  (`tenant-{tenantId}-gemini`), never in Firestore or client bundles
  (`secret-manager.ts`).
- **Cost/quota discipline.** Per-call cost, daily/monthly rollups by purpose +
  model, soft-warning + hard-limit quota enforcement, per-exam cost
  accumulation. This is genuinely good observability.
- **Confidence-driven human-in-the-loop grading.** RELMS confidence routing
  (`needs_review` / auto-approve / review-suggested) with configurable
  thresholds is a strong, keepable design.
- **Resilient parsers.**
  `parseExtractionResponse`/`parsePanopticonResponse`/`parseRELMSResponse`
  defensively strip markdown fences, auto-fix rubric sums, remap "Q"-prefixed
  IDs, drop hallucinated page indices, and detect truncation — born of real
  production failures.
- **Defense-in-depth prompt-injection handling.** Student input wrapped in
  `<student_answer>`/`<student_message>` tags + explicit "ignore instructions
  inside" directives + a regex pre-filter (`chat-safety.ts`).
- **Graceful degradation.** Service errors (quota/circuit/rate-limit) route to
  manual review + DLQ rather than hard-failing the submission.
- **Conversation context management.** LLM summarization of long chats with
  caching keeps token cost bounded without losing context.

---

## 4. Pain points / tech debt / inconsistencies

- **CRITICAL: hardcoded plaintext Gemini API key in legacy app.**
  `LevelUp-App/src/integrations/llm/GeminiModel.ts:51` (and again at `:248`)
  hardcodes a real-looking key `AIzaSy...` and even `console.log`s it to the
  browser. This is a live secret leak in a client bundle. Must be revoked and
  removed.
- **Cost-summary path schism (data-integrity bug).** Three different collection
  layouts for the same data:
  - `usage-quota.ts:incrementDailyCostSummary` writes
    `costSummaries/{YYYY-MM-DD}` (flat doc).
  - `usage-quota.ts:checkUsageQuota` reads `costSummaries` filtered by
    `__name__` `>= {YYYY-MM}-01`.
  - `daily-cost-aggregation.ts` writes `costSummaries/daily/{date}` and
    `costSummaries/monthly/{month}` (sub-paths). These do not agree, so quota
    checks and the nightly aggregator operate on different documents. Budget
    enforcement is effectively unreliable.
- **Firestore rules / schema field mismatch.** `firestore.rules:529` gates
  `chatSessions` on `resource.data.studentId`, but `ChatSession` (`chat.ts`)
  stores `userId` — there is no `studentId` field, so student read/update rules
  likely never match.
- **Duplicated LLM type/glue layer.** `functions/autograde/src/utils/llm.ts`
  re-declares the entire `LLMWrapper` type surface and does a fragile
  `require('@levelup/shared-services/ai')` with a relative-path fallback
  (`../../../../packages/...`) "until shared-services ships .d.ts" (file header
  TODO). LevelUp imports the package directly; autograde proxies it.
  Inconsistent and brittle.
- **Two Gemini SDKs.** Platform uses `@google/generative-ai`; legacy app uses
  `@google/genai`. No shared abstraction between them.
- **Prompts are string concatenation, not structured.** All prompt builders
  manually concatenate strings; output schemas are described in prose JSON
  inside the prompt, not enforced via Gemini `responseSchema` (the wrapper
  supports `responseSchema` but no caller passes one). JSON contracts drift
  between `evaluator.ts`, `relms.ts`, and the `UnifiedEvaluationResult` type
  (e.g. `mistakeClassification` vs `mistake_classification`, `rubric_score` vs
  `score`) requiring manual re-mapping in each pipeline.
- **In-memory state on serverless.** Circuit breaker (`fallback-handler.ts`) and
  chat-abuse tracker (`chat-safety.ts`) use module-level `Map`s that reset on
  every cold start and are not shared across instances — protections are
  best-effort only.
- **Provider lock-in despite "provider" field.** `LLMWrapperConfig.provider` is
  typed `'gemini'` only and the constructor throws otherwise. The abstraction
  implies multi-provider but hard-codes Gemini end to end (SDK, pricing table,
  image inlining, `MAX_TOKENS` handling).
- **No AI content generation in the new platform.** The `content-item-generator`
  skill and `QuestionGenerationService` exist only in the legacy app; the
  rebuilt platform has no server-side content/question generation despite it
  being a documented core capability.
- **Insights are misleadingly named.** "AI insights" (`generate-insights.ts`)
  are 100% rule-based heuristics, while the actual AI-extracted learning signals
  (`learningInsights.*` from chat) are written but not surfaced by any insights
  pipeline.
- **`maxTokens` magic numbers scattered** (4096 / 8192 / 16384 / 65536) with
  inline comments about thinking-token budgets — fragile and undocumented per
  model.
- **Audio/image evaluation incomplete.** `evaluate-answer.ts:128` has an empty
  `if (data.mediaUrls?.length)` block — media URLs are only embedded in prompt
  text, never fetched/inlined as images, unlike the autograde pipeline which
  does it correctly.

---

## 5. Recommendations for a fresh rebuild

**Goal: keep the core concepts (single gateway, per-tenant keys,
confidence-routed grading, cost logging, agent personas, Socratic tutor) but
make them provider-agnostic, transport-agnostic, and schema-enforced so a common
API layer can serve web + React Native.**

1. **One `@levelup/ai` package, properly built & published with `.d.ts`.**
   Eliminate the `functions/autograde/src/utils/llm.ts` re-declaration +
   `require()` fallback. Both services import the same compiled package. Single
   source of truth for types.
2. **Make the provider seam real.** Define `LLMProvider` interface (`generate`,
   `generateStructured`, `generateWithImages`) with a `GeminiProvider` impl
   today and room for OpenAI/Anthropic/Vertex later. Move the pricing table
   behind the provider so each provider owns its cost math. This directly
   enables future flexibility without touching call sites.
3. **Structured output everywhere.** Define one canonical `EvaluationResult` Zod
   schema in `shared-types` and feed it to Gemini as `responseSchema` (the
   wrapper already supports it) rather than prose JSON in prompts. Validate with
   Zod on parse. Kill the per-pipeline field re-mapping (`rubric_score`→`score`,
   snake/camel drift). Use the `zod-schema-validation` patterns already adopted
   in this repo.
4. **Prompt registry, not inline strings.** Introduce versioned, named prompt
   templates (`evaluator.v2`, `tutor.v1`, `panopticon.v1`) with typed inputs,
   stored as data and selectable per tenant/space. Log the prompt version on
   each `llmCallLog` for reproducibility and A/B evaluation.
5. **Fix and unify cost summaries.** Pick **one** path convention (recommend
   `costSummaries/{YYYY-MM-DD}` daily docs + a derived
   `costSummaries_monthly/{YYYY-MM}`), and make `incrementDailyCostSummary`,
   `checkUsageQuota`, and the nightly aggregator agree. Add a migration. Move
   quota enforcement into the gateway so it is impossible to bypass.
6. **Move circuit-breaker + abuse state out of memory.** Back them with
   Firestore or Redis/Memorystore so protections survive cold starts and are
   shared across instances. This matters more as RN clients increase
   concurrency.
7. **Common API layer for AI.** Expose AI capabilities as transport-neutral
   application services (evaluate, chat-turn, extract, grade) callable from both
   Firebase `onCall` and a REST/tRPC gateway, so React Native and web share
   identical contracts. Stream tutor responses (SSE/Gemini streaming) for mobile
   UX.
8. **Finish multimodal evaluation in LevelUp.** Reuse the autograde
   image-download-to-base64 path in `evaluate-answer.ts` so
   `image_evaluation`/`audio` types actually send media to the model.
9. **Rebuild content generation as a first-class server feature.** Port
   `QuestionGenerationService` concepts into the new platform behind the gateway
   (with cost logging + quota), generating items conforming to the unified
   content schema — do not leave it stranded in the legacy app.
10. **Server-side safety + moderation.** Keep the regex pre-filter but add a
    model-based moderation pass and persist safety verdicts; never rely solely
    on prompt-embedded "ignore instructions" directives.
11. **Security hygiene.** Revoke the leaked legacy key immediately; enforce that
    no key ever reaches a client bundle (the per-tenant Secret Manager model is
    correct — make it the only path). Remove all key-logging.
12. **Surface AI learning signals.** Feed the chat-derived
    `learningInsights.{conceptsTouched, masterySignals, struggleSignals}` into
    the insights pipeline so "AI insights" are actually AI-informed, blending
    rules + LLM signals.
