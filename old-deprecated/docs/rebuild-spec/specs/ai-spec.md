# AI Features — Fresh-Build Spec

> Section of the Auto-LevelUp rebuild spec. Scope: every LLM-backed capability —
> **content generation**, **autograding / answer evaluation**, **AI tutoring &
> chat agents**, and **insights & at-risk detection** — plus the cross-cutting
> **AI infrastructure** (gateway, prompt architecture, model selection, cost &
> call logging, quota, guardrails).
>
> Grounded in the status reports: `status/ai-features.md`,
> `status/be-levelup.md`, `status/be-autograde.md`, `status/be-analytics.md`.
> Every core concept from the current system is preserved; the design is
> restructured so a single **transport-agnostic API layer** serves web + new
> React Native apps identically.

---

## 0. Design principles (non-negotiable)

1. **One AI gateway, one source of truth.** All LLM access flows through a
   single compiled `@levelup/ai` package. No service re-declares the wrapper, no
   `require()` relative-path fallbacks (kills the
   `functions/autograde/src/utils/llm.ts` re-declaration debt).
2. **Provider-agnostic.** A real `LLMProvider` interface with a `GeminiProvider`
   today and room for `ClaudeProvider` / `VertexProvider`. Provider + model are
   _configuration_, not literals.
3. **Schema-enforced I/O.** Every structured LLM call passes a `responseSchema`
   and its output is Zod-validated. No prose-JSON contracts, no per-pipeline
   snake/camel re-mapping.
4. **Transport-agnostic application services.** AI capabilities are plain async
   service functions taking a typed `AiContext`. Firebase `onCall` and a future
   REST/tRPC gateway are thin adapters. RN and web call the _same_ contract.
5. **Cost & safety are gateway concerns, not call-site concerns.** Quota
   enforcement, circuit breaking, cost logging, and moderation cannot be
   bypassed because they live inside the gateway, not in each caller.
6. **Server-only keys.** Per-tenant Gemini/Claude keys live only in Secret
   Manager. No key ever reaches a client bundle. (Legacy hardcoded key —
   `LevelUp-App/src/integrations/llm/GeminiModel.ts:51` — is revoked and
   deleted.)

---

## 1. Capability map

| #   | Capability                                            | Current location                                   | Rebuild home (service)           | LLM?                            |
| --- | ----------------------------------------------------- | -------------------------------------------------- | -------------------------------- | ------------------------------- |
| C1  | Question/rubric **extraction** from scanned papers    | `functions/autograde/extract-questions.ts`         | `ai.extraction.extractQuestions` | yes (vision)                    |
| C2  | Answer-sheet **page→question mapping** ("Panopticon") | `pipeline/process-answer-mapping.ts`               | `ai.grading.mapPages`            | yes (vision)                    |
| C3  | Per-question **AI grading** ("RELMS")                 | `pipeline/process-answer-grading.ts`               | `ai.grading.gradeQuestion`       | yes (vision)                    |
| C4  | **Subjective answer evaluation** (LevelUp)            | `functions/levelup/evaluate-answer.ts`             | `ai.evaluation.evaluateAnswer`   | yes                             |
| C5  | **AI tutor chat** (Socratic)                          | `functions/levelup/send-chat-message.ts`           | `ai.chat.sendTurn`               | yes                             |
| C6  | Conversation **summarization**                        | inline in C5                                       | `ai.chat.summarize`              | yes (cheap model)               |
| C7  | Chat **learning-signal extraction**                   | inline in C5                                       | `ai.chat.extractSignals`         | yes (cheap model)               |
| C8  | **Content / question generation**                     | legacy app only                                    | `ai.generation.generateItems`    | yes                             |
| C9  | **At-risk detection**                                 | `functions/analytics/nightly-at-risk-detection.ts` | `analytics.atRisk.evaluate`      | **no — rules**                  |
| C10 | **Insights generation**                               | `functions/analytics/generate-insights.ts`         | `analytics.insights.generate`    | **hybrid (rules + C7 signals)** |
| C11 | **Moderation** (new)                                  | regex only today                                   | `ai.safety.moderate`             | hybrid (regex + model)          |

C1–C8, C11 are LLM-backed and live in `@levelup/ai`. C9 is pure rules. C10 is
rules _enriched_ with the AI-extracted signals from C7 (the current system
writes those signals but never surfaces them — the rebuild closes that loop).

---

## 2. AI infrastructure — `@levelup/ai`

### 2.1 Package layout

```
packages/ai/
  src/
    provider/
      types.ts            # LLMProvider interface, request/response DTOs
      gemini-provider.ts   # @google/generative-ai impl
      claude-provider.ts   # @anthropic-ai/sdk impl (latest Claude)
      registry.ts          # name -> provider factory
    gateway/
      gateway.ts           # callLLM(): quota -> moderate -> provider -> validate -> log -> cost
      circuit-breaker.ts   # Firestore/Redis-backed (NOT in-memory)
      cost-tracker.ts       # per-provider pricing tables
      llm-logger.ts         # writes llmCallLogs (+ atomic cost rollup)
      usage-quota.ts        # checkQuota / enforceQuota
      secret-manager.ts     # per-tenant key retrieval
      moderation.ts         # regex pre-filter + model moderation pass
    prompts/
      registry.ts           # versioned named templates
      evaluator.v2.ts
      tutor.v1.ts
      extraction.v1.ts
      panopticon.v1.ts
      relms.v2.ts
      generation.v1.ts
    schemas/                # Zod responseSchemas (also exported to shared-types)
  dist/                     # compiled JS + .d.ts (ALWAYS shipped)
```

Both `functions/levelup` and `functions/autograde` import `@levelup/ai` as a
normal workspace dependency consuming compiled `.d.ts`. **No `require()`
fallback.**

### 2.2 Provider interface

```ts
// packages/ai/src/provider/types.ts
export type LLMProviderName = "gemini" | "claude" | "vertex";

export interface LLMImage {
  base64: string;
  mimeType: string;
}

export interface LLMGenerateParams<TSchema = unknown> {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  images?: LLMImage[]; // multimodal — works for C1–C4
  temperature?: number;
  maxOutputTokens?: number;
  /** When set, provider MUST request structured JSON conforming to this schema. */
  responseSchema?: TSchema; // JSON-schema shape
  timeoutMs?: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMGenerateResult {
  text: string;
  usage: LLMUsage;
  finishReason: "stop" | "max_tokens" | "safety" | "other";
  modelUsed: string;
}

export interface LLMProvider {
  readonly name: LLMProviderName;
  generate(p: LLMGenerateParams): Promise<LLMGenerateResult>;
  /** Streaming for tutor chat / RN UX (SSE-friendly). */
  generateStream(
    p: LLMGenerateParams
  ): AsyncIterable<{ delta: string; done: boolean; usage?: LLMUsage }>;
  /** Provider-owned cost math, $/1M tokens by model. */
  estimateCost(model: string, usage: LLMUsage, imageCount?: number): number;
  /** Default + cheap model names this provider exposes. */
  models(): { default: string; cheap: string; vision: string };
}
```

### 2.3 Gateway — single entry point

`callLLM` is the ONLY way any service touches a model. It enforces the full
pipeline so no call-site can skip quota or logging.

```ts
// packages/ai/src/gateway/gateway.ts
export interface AiContext {
  tenantId: string;
  userId: string;
  userRole: string; // teacher | student | system
  provider?: LLMProviderName; // resolved from tenant settings if absent
}

export interface LlmRequest<TParsed> {
  purpose: AiPurpose; // 'answer_grading' | 'ai_chat' | ...
  operation: string; // 'relmsEvaluation' | 'tutorReply' | ...
  resourceType: string;
  resourceId: string;
  promptTemplate: PromptRef; // { name, version } from prompt registry
  promptVars: Record<string, unknown>;
  responseSchema: z.ZodType<TParsed>; // canonical Zod schema
  images?: LLMImage[];
  modelTier?: "default" | "cheap" | "vision";
  temperature?: number;
  maxOutputTokens?: number;
  stream?: boolean;
}

export interface LlmResponse<TParsed> {
  parsed: TParsed; // already Zod-validated
  raw: string;
  usage: LLMUsage;
  costUsd: number;
  latencyMs: number;
  model: string;
  promptVersion: string; // logged for reproducibility/A-B
  logId: string;
}

export async function callLLM<T>(
  ctx: AiContext,
  req: LlmRequest<T>
): Promise<LlmResponse<T>>;
```

**Gateway pipeline (in order):**

```
callLLM(ctx, req)
  │
  ├─ 1. resolveProvider(ctx, tenant settings)          → LLMProvider
  ├─ 2. enforceQuota(tenantId, purpose)                → throws AI_QUOTA_EXCEEDED if hard-cap
  ├─ 3. isCircuitOpen(tenantId, provider)              → throws AI_CIRCUIT_OPEN if open
  ├─ 4. moderate(ctx, promptVars) [if user-content]    → throws AI_CONTENT_BLOCKED on violation
  ├─ 5. renderPrompt(req.promptTemplate, promptVars)   → {system,user}
  ├─ 6. jsonSchema = zodToJsonSchema(req.responseSchema)
  ├─ 7. provider.generate({... responseSchema: jsonSchema, retry+backoff})
  ├─ 8. parsed = req.responseSchema.parse(JSON.parse(stripFences(text)))   ← Zod, fail loud
  ├─ 9. cost = provider.estimateCost(model, usage, images?.length)
  ├─ 10. recordSuccess(circuit); logLLMCall(...) + atomic cost rollup (fire-safe)
  └─ return LlmResponse
   (on retryable error: backoff+jitter; on terminal: recordFailure(circuit), classifyError, rethrow)
```

Retry policy (kept from current wrapper): exponential backoff + jitter,
retryable on 429/500/502/503/504/`overloaded`/`resource exhausted`/`MAX_TOKENS`;
max 3 attempts; total-call timeout default 5 min.

### 2.4 Model selection

Model is resolved per call via a tenant-configurable tier, never a literal.

```ts
// tenant.settings.ai (new) — defaults shown
{
  provider: 'gemini',                       // 'gemini' | 'claude'
  models: {
    default: 'gemini-2.5-flash',            // grading, eval, chat reply, extraction, mapping
    cheap:   'gemini-2.5-flash-lite',       // summarization, signal extraction, insights enrich
    vision:  'gemini-2.5-flash'             // C1–C3 image stages
  },
  maxOutputTokens: {                        // replaces scattered magic numbers
    grading: 8192, mapping: 16384, extractionFull: 65536,
    extractionSingle: 8192, chat: 2048, evaluation: 4096, generation: 16384
  },
  temperatures: { grading: 0.1, mapping: 0.1, evaluation: 0.3, chat: 0.7, signals: 0.1, generation: 0.4 }
}
```

If the platform standardizes on Claude, set `provider: 'claude'`,
`models.default` to the latest Claude model; nothing else changes. The
gateway/prompts/schemas are provider-neutral. **Default deployment uses the
latest Gemini Flash** (as in production today) with the Claude provider
available as a drop-in.

### 2.5 Cost & call logging (unified — fixes the path schism)

**ONE canonical path scheme.** The current three-way disagreement
(`costSummaries/{date}`, `costSummaries` filtered by `__name__`,
`costSummaries/daily/{date}` + `monthly/{month}`) is replaced by:

```
/tenants/{t}/llmCallLogs/{callId}                  # one doc per call (audit)
/tenants/{t}/costSummaries/daily/{YYYY-MM-DD}       # daily rollup
/tenants/{t}/costSummaries/monthly/{YYYY-MM}        # monthly rollup
```

`logLLMCall`, `enforceQuota` (read), and `dailyCostAggregation` (scheduler) all
use these exact paths — single helper
`costSummaryRef(tenantId, granularity, key)` so they cannot drift.

`LLMCallLog` doc (extend existing):

```ts
interface LLMCallLog {
  id: string;
  tenantId: string;
  userId: string;
  userRole: string;
  provider: LLMProviderName;
  model: string;
  purpose: AiPurpose;
  operation: string;
  resourceType: string;
  resourceId: string;
  promptName: string; // NEW — reproducibility
  promptVersion: string; // NEW — A/B + audit
  tokens: { input: number; output: number };
  costUsd: number;
  latencyMs: number;
  status: "success" | "error";
  errorType?: string; // from classifyError
  createdAt: Timestamp;
}
```

`enforceQuota(tenantId, purpose)`:

- reads current month rollup; soft-warns at 80% of
  `subscription.monthlyBudgetUsd` (emits `ai_budget_alert` notification — fixes
  the current "warn-only" gap), hard-blocks at 100% by throwing
  `AI_QUOTA_EXCEEDED`.
- enforces a daily call cap. **Quota is a hard, typed pre-check inside the
  gateway** — not a swallowed dynamic import (`process-answer-grading.ts:61`
  debt).

### 2.6 Circuit breaker & abuse limiter — durable, not in-memory

Current breaker (`fallback-handler.ts`) and chat-abuse tracker
(`chat-safety.ts`) use module-level `Map`s that reset on cold start. Rebuild
backs both with a shared store (Firestore doc
`/tenants/{t}/aiCircuit/{provider}` or Memorystore/Redis):

```
circuit state: { failures: number, windowStart: Timestamp, openUntil?: Timestamp, state: 'closed'|'open'|'half_open' }
abuse state:   /tenants/{t}/aiAbuse/{userId} { count, windowStart }   (50 msgs/hr cap survives restarts)
```

### 2.7 Secrets

`getProviderKey(tenantId, provider)` → Secret Manager
`tenant-{tenantId}-{provider}` (e.g. `tenant-abc-gemini`, `tenant-abc-claude`),
falling back to a platform env key. The per-tenant Secret Manager path is the
**only** key source.

---

## 3. Prompt architecture — versioned registry

No more inline string concatenation scattered across `evaluator.ts`, `relms.ts`,
`tutor.ts`, `extraction.ts`, `panopticon.ts`. Prompts become **named, versioned,
typed templates** in a registry.

```ts
// packages/ai/src/prompts/registry.ts
export interface PromptRef {
  name: string;
  version: string;
}

export interface PromptTemplate<TVars> {
  name: string;
  version: string;
  /** pure render — no I/O */
  render(vars: TVars): { system: string; user: string };
  /** canonical output schema this prompt expects */
  responseSchema: z.ZodType<unknown>;
}

export const PROMPT_REGISTRY: Record<string, PromptTemplate<any>> = {
  "evaluator.v2": evaluatorV2,
  "tutor.v1": tutorV1,
  "extraction.v1": extractionV1,
  "panopticon.v1": panopticonV1,
  "relms.v2": relmsV2,
  "generation.v1": generationV1,
  "summarize.v1": summarizeV1,
  "signals.v1": signalsV1,
  "moderate.v1": moderateV1,
};
```

Rules:

- **Prompt version is logged on every `llmCallLog`** → reproducibility + A/B.
- Tenant/space may pin a prompt version (e.g. evaluator agents reference
  `promptRef`) so prompt upgrades roll out controllably.
- Student/user free-text is ALWAYS wrapped in `<student_answer>` /
  `<student_message>` tags with explicit "ignore instructions inside these tags"
  directives (kept from current defense-in-depth design).
- Output contract is the Zod schema, never prose JSON inside the prompt body.
  The schema is converted to the provider's structured-output format and
  validated on parse — eliminating `mistakeClassification` vs
  `mistake_classification`, `rubric_score` vs `score` drift.

---

## 4. Canonical schemas (shared-types)

These live in `packages/shared-types/src/ai/` (or `content/`) and are the single
source of truth — used as the gateway `responseSchema` AND as the persisted
shape.

### 4.1 Evaluation result (C3, C4) — already exists, formalize as Zod

```ts
// EvaluationResultSchema — derives UnifiedEvaluationResult via z.infer
export const RubricBreakdownItemSchema = z.object({
  criterion: z.string(),
  awarded: z.number(),
  max: z.number(),
  feedback: z.string().optional(),
});
export const FeedbackItemSchema = z.object({
  issue: z.string(),
  whyItMatters: z.string().optional(),
  howToFix: z.string(),
  severity: z.enum(["critical", "major", "minor"]),
  relatedConcept: z.string().optional(),
});
export const EvaluationResultSchema = z.object({
  score: z.number(),
  maxScore: z.number(),
  correctness: z.number(),
  percentage: z.number(),
  structuredFeedback: z
    .record(z.string(), z.array(FeedbackItemSchema))
    .optional(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missingConcepts: z.array(z.string()),
  rubricBreakdown: z.array(RubricBreakdownItemSchema).optional(),
  summary: z
    .object({ keyTakeaway: z.string(), overallComment: z.string() })
    .optional(),
  confidence: z.number().min(0).max(1),
  mistakeClassification: z
    .enum(["Conceptual", "Silly Error", "Knowledge Gap", "None"])
    .optional(),
  dimensionsUsed: z.array(z.string()).optional(),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
// (costUsd / tokensUsed / gradedAt / evaluationRubricId attached server-side, not by the model)
```

The model returns ONLY the semantic fields above; `costUsd`, `tokensUsed`,
`gradedAt`, `evaluationRubricId`, `confidence`-derived routing are attached by
the service after parse. This is the contract `UnifiedEvaluationResult` (current
`content/evaluation.ts`) must converge on.

### 4.2 Extraction result (C1)

```ts
export const ExtractedQuestionSchema = z.object({
  questionNumber: z.string(),
  questionText: z.string(),
  maxMarks: z.number(),
  rubricCriteria: z.array(
    z.object({
      criterion: z.string(),
      maxPoints: z.number(),
      guidance: z.string().optional(),
    })
  ),
  subQuestions: z.array(z.lazy(() => ExtractedQuestionSchema)).optional(),
});
export const ExtractionResultSchema = z.object({
  questions: z.array(ExtractedQuestionSchema),
  warnings: z.array(z.string()).optional(),
});
```

Service-side post-validation keeps the existing **rubric-sum auto-fix**
(criteria `maxPoints` must sum to `maxMarks`) as a normalizer after Zod parse.

### 4.3 Mapping result (C2)

```ts
export const PageMappingSchema = z.object({
  questionId: z.string(),
  pageIndices: z.array(z.number().int().nonnegative()),
  confidence: z.number().min(0).max(1),
});
export const MappingResultSchema = z.object({
  mappings: z.array(PageMappingSchema),
});
```

Keep "Sandwich Rule" gap-fill + out-of-range page drop as deterministic
post-processors (not prompt prose).

### 4.4 Generation result (C8)

```ts
export const GeneratedItemSchema = z.object({
  itemType: z.enum(["question", "material"]),
  questionType: QuestionTypeSchema.optional(), // one of the 15
  title: z.string(),
  payload: UnifiedItemPayloadSchema, // discriminated union — validated!
  bloomsLevel: z.string().optional(),
  topics: z.array(z.string()).optional(),
  suggestedRubric: UnifiedRubricSchema.optional(),
});
export const GenerationResultSchema = z.object({
  items: z.array(GeneratedItemSchema),
});
```

---

## 5. Capability specs

### 5.1 Autograding pipeline (C1–C3) — keep two-stage, fix orchestration

Core concepts **kept**: two-stage Panopticon (page→question scouting) → RELMS
(per-question grading); rubric resolution chain (question rubric → exam
`EvaluationSettings` → tenant default → enabled `EvaluationDimension`s);
confidence-based human-in-the-loop routing; DLQ + watchdog resilience;
per-tenant secret/quota isolation.

**Fixes baked into the spec:**

- **Single orchestrator, one status writer.** Replace
  trigger-runs-worker-inline + duplicated final-status math
  (`process-answer-grading.ts` txn vs `on-question-submission-updated.ts`) with
  one `advancePipeline(submissionId)` reducer (Cloud Tasks per stage). Final
  submission status computed in exactly one idempotent place, guarded by
  `pipelineStatus`.
- **Structured output.** Extraction/mapping/grading pass `responseSchema` and
  Zod-validate — no fence-stripping + key remap.
- **Confidence routing (kept, configurable per tenant via
  `EvaluationSettings`):**
  ```
  conf < confidenceThreshold (0.7)            -> status 'needs_review'
  confidenceThreshold <= conf < autoApprove   -> status 'graded' + reviewSuggested=true
  conf >= autoApproveThreshold (0.9)          -> status 'graded'
  service error (quota/circuit/rate-limit)    -> status 'needs_review' + gradingDeadLetter entry
  ```
- **Image handling once.** Download/normalize each answer image once during
  scouting; reuse bytes in grading (no per-question re-download).
- **One ingestion path.** `uploadAnswerSheets` (explicit submit-with-paths) is
  the single canonical path for web + scanner + RN. Demote the
  `onAnswerSheetUpload` GCS trigger (removes the `'gcs'` uploadSource /
  `classId[0]` divergence).
- **Clean status taxonomy.** Drop vestigial `ocr_*` states and unreachable
  `completed` exam status; validate transition tables against type unions at
  build.

Pipeline diagram (orchestrated):

```
uploadAnswerSheets ──> Submission(uploaded) ──> [task] mapPages(C2) ──> scouting_complete
   creates questionSubmissions per mapped question                         │
                                                                           ▼
                                            [task fan-out] gradeQuestion(C3) per qSub
                                                  │ (batched, confidence-routed)
                                                  ▼
                                          advancePipeline reducer (ONE writer)
                                                  │
                                  all graded? ──> ready_for_review ──> teacher review/override ──> results_released
```

### 5.2 Answer evaluation (C4 — LevelUp) — finish multimodal

- Deterministic types (9 `AUTO_EVALUATABLE_TYPES`) short-circuit to non-LLM
  `autoEvaluate` (kept — keeps cost down, instant feedback).
- AI types (6 `AI_EVALUATABLE_TYPES`: text, paragraph, code, audio,
  image_evaluation, chat_agent_question) go through
  `ai.evaluation.evaluateAnswer`: resolve evaluator `Agent` (item → space
  default) + `UnifiedRubric` (inheritance), render `evaluator.v2`, `callLLM`
  with `EvaluationResultSchema`.
- **Finish multimodal** (current `evaluate-answer.ts:128` empty media block):
  fetch `mediaUrls` → base64 → pass as `images` in `LlmRequest` (reuse the
  autograde download path). `image_evaluation`/`audio` are genuinely graded.
- **Persist in one call.** `evaluateAnswer` writes progress itself via the
  unified progress-updater and returns the result — removes the second
  `recordItemAttempt` round-trip and the cost-without-progress window.
  Idempotency key `sessionId+itemId+attempt`.

### 5.3 AI tutor chat (C5–C7) — Socratic, streaming

- System prompt from `tutor.v1` (agent persona + per-subject guidance map +
  Socratic directives + safety rules). Kept.
- **Three LLM calls remain conceptually** but are explicit gateway calls:
  1. `ai.chat.sendTurn` — tutor reply (default model, temp 0.7). **Streaming**
     (`generateStream`) for RN/web typing UX (SSE / Gemini streaming).
  2. `ai.chat.summarize` — when history > 20 messages, cheap model, cached on
     session (`summarize.v1`).
  3. `ai.chat.extractSignals` — fire-and-forget, cheap model, writes
     `learningInsights.{conceptsTouched, masterySignals, struggleSignals}`
     (`signals.v1`, temp 0.1). **These signals now feed C10 insights** (current
     system writes but never surfaces them).
- **Pre-LLM safety gate**: `ai.safety.moderate` (regex pre-filter + model
  moderation pass; persist safety verdict). Abuse counter is the durable
  Firestore/Redis limiter (§2.6), not in-memory.
- **Fix rules/schema mismatch.** `firestore.rules` gates `chatSessions` on
  `studentId` but the schema stores `userId` — rebuild standardizes on `userId`
  in both schema and rules so student reads actually match.

Storage: `chatSessions/{id}` (+ `messages/` subcollection + preview array).
Kept.

### 5.4 Content / question generation (C8) — first-class, server-side

Currently only in the legacy app (`QuestionGenerationService`,
`gemini-2.0-flash-001`). Rebuild promotes it to a first-class gateway
capability.

- New callable `generateContent` (`functions/levelup`):
  ```
  generateContent({ tenantId, spaceId?, storyPointId?, mode, source }) -> { items: GeneratedItem[] }
    mode:   'from_topic' | 'from_pdf' | 'adaptive_followup'
    source: { topic?, difficulty?, count?, bloomsLevels?, pdfStoragePaths?, seedItemIds? }
  ```
- Runs through the gateway (cost logging + quota apply) using `generation.v1`
  and `GenerationResultSchema`. Output `payload` is validated against the
  **discriminated `UnifiedItemPayload` union** (fixes the `z.record(unknown)`
  boundary hole noted in `be-levelup.md`).
- Generated items are **drafts** — never auto-published; teacher reviews/edits
  before `saveItem`. Same answer-key isolation applies on save.
- PDF source path reuses the autograde image/PDF download-to-base64 pipeline.

### 5.5 At-risk detection (C9) — pure rules, kept

- No LLM. `analytics.atRisk.evaluate` runs the 4-rule engine over
  `studentProgressSummaries`/`spaceProgress` (`at-risk-rules.ts` — already
  pure + tested; portable verbatim).
- **Fixes:** resolve student UIDs via `where(authUid in [...])` or denormalized
  `teacherUids`/`parentUids` on the summary (not O(N) in-memory `.find()`).
  `onProgressMilestone` (driven by `isAtRisk` transition) is the **only**
  at-risk notification fan-out; the nightly scheduler only sets flags (removes
  the double-notify). Fix `AtRiskReason` enum drift (`no_recent_activity`
  declared but `zero_streak` emitted — pick one).

### 5.6 Insights (C10) — hybrid rules + AI signals

- `analytics.insights.generate` runs the 6-rule engine (`insight-rules.ts`) but
  is now **enriched with C7 chat-derived signals** (`learningInsights.*`), so
  "AI insights" are genuinely AI-informed rather than 100% heuristic.
- **Fixes:** correct the capping math — write
  `min(slotsAvailable, seeds.length)` (current `Math.max(...)` always writes
  everything, defeating the 5-active cap); deterministic delete by `createdAt`.
  Either implement real exam↔space correlation or drop the stubbed
  `cross_system_correlation` rule + fixed `{gap:0.2}` value rather than show a
  fake number.

### 5.7 Moderation (C11) — new explicit capability

- `ai.safety.moderate(ctx, text)` → `{ allowed, categories, action }`.
- Layer 1: regex pre-filter (kept from `chat-safety.ts`).
- Layer 2: model moderation pass for borderline content.
- Persist safety verdicts; never rely solely on prompt-embedded "ignore
  instructions" directives. Used by C5 (chat) and optionally C4/C8 inputs.

---

## 6. Common API layer (web + React Native)

All AI capabilities are exposed as **transport-neutral application services**
that take an `AiContext`. Firebase `onCall` adapters wrap them today; the same
services back a future REST/tRPC gateway. RN and web import the identical
request/response DTOs from `shared-types`, validated on both ends.

| Callable (current names kept)   | Service                          | Notes                         |
| ------------------------------- | -------------------------------- | ----------------------------- |
| `evaluateAnswer`                | `ai.evaluation.evaluateAnswer`   | persists result; idempotent   |
| `sendChatMessage`               | `ai.chat.sendTurn`               | streaming variant for RN      |
| `extractQuestions`              | `ai.extraction.extractQuestions` | `mode: full \| single`        |
| `gradeQuestion`                 | `ai.grading.gradeQuestion`       | `mode: manual \| retry \| ai` |
| `uploadAnswerSheets`            | ingestion → `advancePipeline`    | single canonical ingest       |
| `generateContent` _(new)_       | `ai.generation.generateItems`    | drafts only                   |
| `getSummary` / `generateReport` | analytics services               | surface insights/at-risk      |

Contract conventions (consistent with the `api-layer` spec): one Zod schema per
callable colocated with its `z.infer` type; `tenantId` derived from auth claims
server-side (override only for super-admin); responses Zod-validated behind a
dev flag to catch drift between web/RN and server. Streaming (tutor) exposed
over SSE so RN reuses the same contract with an incremental transport.

---

## 7. Migration notes (from current code)

1. **Create `@levelup/ai`** from `packages/shared-services/src/ai/*`; **compile
   and ship `.d.ts`**. Delete `functions/autograde/src/utils/llm.ts` (the
   re-declared wrapper + `require()` relative-path fallback). Both function
   packages import the compiled package.
2. **Wrap the existing Gemini SDK** as `GeminiProvider` behind the new
   `LLMProvider` interface; add `ClaudeProvider` (latest Claude via
   `@anthropic-ai/sdk`). Move the hardcoded pricing table behind each provider.
   Remove the `provider: 'gemini'`-only throw.
3. **Promote prompts** (`evaluator.ts`, `tutor.ts`, `extraction.ts`,
   `panopticon.ts`, `relms.ts`) into the versioned `PROMPT_REGISTRY`. Replace
   prose JSON contracts with `responseSchema` + Zod parse; delete per-pipeline
   key remapping.
4. **Unify cost summaries** onto `costSummaries/daily/{date}` +
   `costSummaries/monthly/{month}` via a single `costSummaryRef` helper; migrate
   any flat `costSummaries/{date}` docs. Move quota enforcement into the
   gateway. Wire `dailyCostAggregation` to emit `ai_budget_alert` notifications.
5. **Move circuit breaker + chat abuse counter** out of in-memory `Map`s to a
   shared Firestore/Redis store.
6. **Fix `chatSessions` rule/schema mismatch** — standardize on `userId`.
7. **Replace the autograde inline-trigger orchestration** with the
   `advancePipeline` reducer; delete duplicated final-status logic; make
   `uploadAnswerSheets` the single ingestion path (demote
   `onAnswerSheetUpload`).
8. **Finish multimodal eval** in `evaluateAnswer` (fetch+inline media) and
   persist the result in one call.
9. **Port content generation** from `LevelUp-App/src/integrations/questions/*`
   into `generateContent` behind the gateway with the discriminated-union
   payload schema.
10. **Surface chat learning signals** into the insights pipeline (C10 ← C7).
11. **Security:** revoke + delete the hardcoded legacy Gemini key
    (`LevelUp-App/src/integrations/llm/GeminiModel.ts:51/:248`), remove all key
    logging, enforce Secret-Manager-only key access.
12. **Fix analytics correctness bugs** in the same pass: insight cap math,
    at-risk O(N) student resolution + double-notify, `AtRiskReason` enum drift,
    stubbed `discriminationIndex`/`streakDays`/correlation (implement or
    remove).

---

## 8. Guardrails summary (consolidated)

| Guardrail                  | Mechanism                                                | Where                        |
| -------------------------- | -------------------------------------------------------- | ---------------------------- |
| Prompt injection           | tagged user input + ignore-directives + regex pre-filter | prompt registry + `moderate` |
| Content moderation         | regex + model pass, verdict persisted                    | `ai.safety.moderate`         |
| Cost overrun               | per-tenant monthly budget, 80% alert / 100% hard block   | gateway `enforceQuota`       |
| Abuse / spam               | durable per-user msg rate limit (50/hr)                  | gateway abuse store          |
| Provider outage            | durable circuit breaker (closed/open/half-open)          | gateway circuit breaker      |
| Bad model output           | `responseSchema` + Zod parse, fail loud                  | gateway step 8               |
| Wrong/hallucinated grading | confidence routing → human review + DLQ                  | grading service              |
| Key leakage                | Secret Manager only, never client-side, no logging       | `secret-manager`             |
| Reproducibility            | prompt name+version on every `llmCallLog`                | `llm-logger`                 |

```

```
