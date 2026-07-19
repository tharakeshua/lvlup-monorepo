# LLM Call Layer — Design (Layer 3)

**Owner design partner:** this session (`sess_1784443759325_zwrghhn4t`)
**Status:** DRAFT v0.1 — first pass for owner (Subhang) iteration. No mass
implementation until sign-off. **Date:** 2026-07-19 **Scope boundary:** how we
_invoke_ LLMs through the framework we built. Prompt _content_ is Layer-2's;
mobile UX is Layer-1's; the telemetry/cost _framework_ decisions are the LLM
Tracking Framework owner's (this doc consumes and proposes-against them, it does
not redefine them).

---

## 0. TL;DR for the owner

We have a genuinely good invocation stack: one gateway (`ctx.ai.generate`), one
provider seam, server-authoritative cost/quota/moderation/telemetry, and a
fail-closed BYOK credential hierarchy. Today's three incidents all trace to
**one root cause plus two thin spots**:

1. **Root cause (CONV-P0-03):** the pinned `@google/generative-ai@0.21.0` SDK
   cannot parse Gemini 3.x tool-calling responses. We worked around it by
   pinning _conversation_ policies to `gemini-2.5-flash`. The durable fix is the
   `@google/genai` migration (**AI-SDK-MIGRATE**). This doc's centerpiece is
   that migration plan.
2. **Thin spot A — model availability is validated for _shape_, not
   _existence_.** `validateProviderModel` checks a name is on an allowlist; it
   never checks the model is actually reachable on _this project_ with _these
   credentials_. That is exactly how `gemini-2.5-pro` (404 "no longer available
   to new users") and the 3.x preview default slipped into prod defaults
   undetected until a real-key smoke test hit them.
3. **Thin spot B — preview models are the _default_**. `LEVELUP_AI_MODEL_PRO`
   defaults to `gemini-3.1-pro-preview` and `LEVELUP_AI_MODEL_FLASH` to
   `gemini-3.5-flash`. Preview models are the least stable surface to pin a
   default to, and grading/extraction run on the pro default.

Everything below maps the current state precisely, then proposes fixes and asks
you to make ~7 decisions (§7).

---

## 1. Current-state architecture map

### 1.1 The call path (one function, `createAiGateway().generate`)

Every AI call in the platform funnels through **`packages/ai/src/gateway.ts`** →
`generate(req, ctx)`. Services never touch a provider, a Secret Manager key, or
a cost number. The sequence:

```
validate req (tools XOR responseSchema, modelPolicyId XOR model, toolChoice, messages)
  → resolve model (policy | legacy model | template.defaultModel) + validateProviderModel
  → conversation guard (messages/conversation* promptKeys MUST moderate:true)
  → resolve credential owner (user BYOK lookup)   [before quota — BYOK bypasses quota]
  → telemetry.createRequest (status "reserved", schemaVersion 2)
  → (1) moderate input  (default-on for ai_chat; mandatory for conversation)
  → (2) hard quota pre-check (monthly budget + daily cap)   [SKIPPED for BYOK]
  → (3) circuit-breaker guard (key = `${tenantId}:${model}`)
  → (4) resolve API key (user ref | tenant→platform) + build provider + render prompt
  → build provider messages (resolve {storagePath}→base64 images, one shared byte budget)
  → withRetry( provider.call ) — records an attempt row per try
      → recordSuccess / recordFailure on circuit
  → (5) moderate output (record + redact, never block mid-flow)
  → (6) logLLMCall (legacy llmCallLogs row) + telemetry.finalizeRequest
  → return { data, text, toolCalls?, tokenUsage, cost, model, requestId, moderation? }
```

Key design properties worth preserving:

- **Telemetry is isolated** — every telemetry write is wrapped so an
  observability failure never changes the product response (`writeTelemetry`
  swallows + routes to `onTelemetryError`).
- **Image bytes never transit services** — services pass `{ storagePath }`; the
  gateway resolves to inline base64 right before the provider call, under a
  single 14 MB budget shared across legacy `images` and typed-message image
  parts.
- **Retry is _inside_ the provider leg but _outside_ image resolution** — a
  transient retry never re-downloads bytes or rebuilds history.
- **Tools XOR responseSchema** is enforced at the gateway with a fast, clear
  error (Gemini 400s on the combination).

### 1.2 The provider seam

`packages/ai/src/provider/provider.ts` defines `LLMProvider` (`name`,
`call(ProviderInput): ProviderOutput`) with a **role-preserving** message model
(`developer | user | assistant | tool`) richer than Gemini's legacy
`user/model/function` wire roles. This is the seam that lets a second provider
(Claude) slot in without touching gateway/cost/quota/prompt layers.

`packages/ai/src/provider/gemini.ts` is the one concrete impl, over
`@google/generative-ai`. Notable current behaviors:

- **`toGeminiContents`** flattens developer→prefixed-user, assistant
  tool_call→`functionCall`, tool result→`functionResponse` (carrying our
  `callId` inside the response envelope since the legacy wire format has none).
- **`stripUnsupportedSchemaKeys`** (the CONV-P0-02 fix) — recursively strips
  `additionalProperties`, `$schema`, `$ref`, `$defs`, etc. from JSON Schemas
  before handing them to Gemini's OpenAPI-3.0-subset
  `responseSchema`/`functionDeclarations[].parameters`. Applied to **both**
  response schemas and tool parameter schemas.
- **Defensive text read** — `response.text()` throws on candidates that carry
  _only_ functionCall parts, so it's wrapped in try/catch → `""`. This is a
  _symptom-masking_ guard for exactly the CONV-P0-03 SDK gap.
- **Synthetic callIds** — `gemini:${randomUUID()}` because the legacy SDK
  returns no invocation id.

### 1.3 Model policies + resolution (`packages/ai/src/models.ts`)

Two layers:

- **Env-overridable defaults**: `LEVELUP_AI_MODEL_PRO` (default
  `gemini-3.1-pro-preview`), `LEVELUP_AI_MODEL_FLASH` (default
  `gemini-3.5-flash`), `LEVELUP_AI_MODEL_CONVERSATION` / `_CONVERSATION_FAST`
  (default `gemini-2.5-flash`).
- **Three product policies** (`ModelPolicyId`): `conversation.fast` (temp 0.6,
  1024 tok), `conversation.quality` (temp 0.5, 2048 tok), `evaluation.quality`
  (temp 0, 4096 tok → pro default). Policies bind temperature + token budget so
  a runtime can't smuggle an override past the boundary. Each asserts its
  `purpose` (`ai_chat` vs `answer_grading`).
- **`validateProviderModel`** — fail-closed _shape_ check: explicit allowlist
  env (`LEVELUP_AI_ALLOWED_GEMINI_MODELS`) if set, else a built-in set of
  "supported" Gemini names + the env-selected defaults. Rejects
  `gpt-*`/`claude-*` while Gemini is active.

**The CONV-P0-03 workaround lives here:** both conversation policies currently
resolve to `gemini-2.5-flash` regardless of the 3.x defaults, because (a) the
SDK can't parse 3.x tool calls and (b) `gemini-2.5-pro` 404s on this project.
`evaluation.quality` stays on the pro default because it runs responseSchema
JSON mode (no tools) and parses fine.

### 1.4 Credential hierarchy (BYOK → tenant → platform, fail-closed)

`packages/ai/src/secrets/secret-manager.ts`:

- **User BYOK** (highest): resolved in the gateway via injected
  `userKeyLookup.getEligibleUserKey(uid)` →
  `userSecretResolver.getKeyByRef(user-{uid}-{provider})`. **Fail-closed**: a
  user who opted into BYOK never silently falls back to tenant/platform; a
  failing _lookup_ (not key) is treated as "no user key" to preserve
  availability. BYOK **bypasses tenant/platform quota** (owner decision
  2026-07-18).
- **Tenant** (`tenant-{tenantId}-gemini`) → **Platform**
  (`levelup-default-gemini`) fallback, in `createSecretResolver`. Reads are
  **uncached** (rotate/revoke is immediately consistent across warm instances).
- **Emulator/local override** — `LEVELUP_AI_KEY` / `GEMINI_API_KEY`
  short-circuits Secret Manager everywhere (resolver, writer, user resolver).
- **Writers** — `secretNameFor` is the single SSOT for the name pattern; a prior
  P0 (writer/resolver name divergence) is now unified here.

### 1.5 Cost & usage tracking

- **`cost/cost-tracker.ts`** — `MODEL_PRICING` per-1M-token USD table; unknown
  models fall back to conservative pricing (never bills as free) and flag
  `pricingFallback`. `PRICING_VERSION = "gemini-public-2026-07-18"`, snapshotted
  on every attempt (no retroactive recompute).
- **`cost/llm-logger.ts`** — append-only `llmCallLogs` row (the legacy
  cost-rollup source the `aggregateDailyCost` scheduler reads).
- **`telemetry/types.ts`** — the **schemaVersion-2 two-table ledger** (owned by
  the LLM Tracking Framework): `LlmRequestRecord` (one per logical request) +
  `LlmAttemptRecord` (append-only per provider try) + `LlmRequestFinalization`.
  Rich attribution (`actor/initiated/subject/billing` user ids, `feature`,
  canonical `purpose`, `related` resources,
  `traceId`/`rootRequestId`/`parentRequestId`). Wired to a Supabase sink in
  `bootstrap.ts` when configured. **Metadata only — prompts, completions,
  answers, media never cross this seam.**
- **`cost/usage-quota.ts`** — hard pre-check: monthly budget (default $100) +
  daily call cap (default 5000), tenant-overridable, summary fast-path → raw sum
  fallback.

### 1.6 Reliability

- **`retry.ts`** — exponential backoff + jitter: `maxAttempts` 3, base 250 ms,
  max 4000 ms, `delay = min(max, base·2^(n-1)) + 0.25·delay·rng()`. Only retries
  caller-classified transients.
- **`fallback-handler.ts`** — `classifyError` transient set = HTTP
  429/500/502/503/504 or messages matching
  `timeout|etimedout|econnreset|overloaded|unavailable|rate limit`. Circuit
  breaker `closed→open→half_open→closed`, threshold 5 consecutive failures, 30 s
  cooldown, keyed per `tenantId:model`.
- **`errors.ts`** — `aiDisabled` / `providerFailed` taxonomy; `sanitizeError`
  truncates to 240 chars + maps provider status → `PROVIDER_{status}` /
  `PROVIDER_TIMEOUT` / `PROVIDER_ERROR`; `providerErrorForLog` redacts `key=`,
  `AIza…`, `Bearer …` before Cloud Logging.

### 1.7 The services seam + wiring

- **`packages/services/src/shared/ai.ts`** — the _structural_ seam services
  depend on
  (`AiGenerateResult = { text, json, tokensUsed, costUsd, model, ... }`).
  Deliberately not a nominal dep on `@levelup/ai`.
- **`functions/sdk-v1/src/ai-seam.ts`** — `adaptAiResult`: maps concrete
  `AiResponse.data → json`, `tokenUsage.totalTokens → tokensUsed`,
  `cost.totalCostUsd → costUsd`. **This adapter exists because of the Issue-3
  bug** (services read `ai.json` but the gateway returns `ai.data`; the
  `as unknown as` cast silenced it, zeroing every grade). Unit-pinned in
  `__tests__/ai-seam.adapter.test.ts`.
- **`functions/sdk-v1/src/bootstrap.ts`** — the one composition root: wires real
  `createAiGateway({ repos, projectId, imageStore, userKeyLookup, telemetry, onTelemetryError })`;
  emulator/test injects stub provider + stub secret resolvers + stub image
  store.

### 1.8 Complete AI operation inventory

| #   | operation                  | promptKey                                                                   | feature                                        | responseSchema | tools | images | model policy / default       |
| --- | -------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- | :------------: | :---: | :----: | ---------------------------- |
| 1   | questions.extract          | `examQuestionExtraction`                                                    | autograde.question_paper                       |       ✓        |   —   |   ✓    | pro default                  |
| 2   | questions.generate_rubrics | `examRubricGeneration`                                                      | autograde.question_paper                       |       ✓        |   —   |   —    | pro default                  |
| 3   | (single-pass) extract      | `questionExtraction`                                                        | autograde.question_paper                       |       ✓        |   —   |   ✓    | pro default                  |
| 4   | answer.mapping (per-page)  | `answerMappingPage`                                                         | autograde.answer_sheet                         |       ✓        |   —   |   ✓    | flash default                |
| 5   | (legacy monolithic map)    | `answerMapping`                                                             | autograde.answer_sheet                         |       ✓        |   —   |   ✓    | flash default                |
| 6   | answer grading (RELMS)     | `answerGrading`                                                             | autograde.answer_sheet                         |       ✓        |   —   |   —    | pro default                  |
| 7   | practice.evaluate / RELMS  | `unifiedEvaluation`                                                         | levelup.practice                               |       ✓        |   —   |   ✓    | **evaluation.quality**       |
| 8   | chat.tutorTurn (legacy)    | `aiChat`                                                                    | levelup.tutor                                  |       —        |   —   |   ✓    | flash default                |
| 9   | chat.agentTurn (legacy)    | `agentChat`                                                                 | levelup.agent_question                         |       —        |   ✓   |   —    | flash default + raw override |
| 10  | conversation.turn (v2)     | `conversationTutor` / `conversationQuestionHelp` / `conversationAssessment` | levelup.tutor / question_help / agent_question |       —        |   ✓   | (refs) | **from session snapshot**    |
| 11  | levelup.generateContent    | `contentDraft`                                                              | levelup.authoring                              |       ✓        |   —   |  opt   | pro default                  |
| 12  | analytics insights         | `insights`                                                                  | analytics.insights                             |       ✓        |   —   |   —    | flash default                |

**Two invocation modalities that the SDK migration must both preserve:**

- **Structured output (responseSchema JSON mode):** ops 1–7, 11, 12. Currently
  working on 2.5/3.x.
- **Tool-calling (function declarations):** ops 9, 10. **Currently broken on
  3.x** → the whole reason for AI-SDK-MIGRATE.

---

## 2. Incident-derived weaknesses (today: 2026-07-19)

### W1 — Model availability is never validated against the live project (CONV-P0-03b, 2.5-pro 404)

`validateProviderModel` proves a name is _allowlisted_, not that the model
_exists for this GCP project with these credentials_. `gemini-2.5-pro` is 404
"no longer available to new users"; a preview 3.x default could vanish the same
way. There is **no pre-deploy gate** that does a real 1-token probe per
configured model. Result: model availability is discovered by a production smoke
test (or a user-facing failure), not by CI.

### W2 — SDK parse coverage is a silent gap masked by defensive guards (CONV-P0-03)

The pinned SDK returns `thinking + functionCall` parts for 3.x that the legacy
client reads as empty text / no calls. The provider's `try/catch → text=""` and
`functionCalls?.() ?? []` _mask_ this into a benign-looking empty response
instead of a loud error. There's a sanitizer test (P0-02) and a conversation
gateway test, but **no test that asserts a real 3.x tool-calling response is
actually parsed** — because the pinned SDK can't produce one. The gap is
structural: our test doubles can't reproduce the exact failure, so it escaped to
prod.

### W3 — Preview models are the pinned defaults (CONV-P0-03 blast radius)

`gemini-3.1-pro-preview` / `gemini-3.5-flash` are _defaults_, and
grading/extraction (revenue-critical, correctness-critical) ride the pro
default. Preview surfaces get retired/renamed with little notice — exactly the
W1 failure mode, aimed at the highest-stakes ops.

### W4 — Schema sanitizer is allow-by-omission, not validated against the real spec

`stripUnsupportedSchemaKeys` maintains a _denylist_
(`GEMINI_UNSUPPORTED_SCHEMA_KEYS`). Any _new_ unsupported keyword Gemini adds,
or any keyword we didn't think of, passes straight through to a 400. It's a
hand-maintained list with no cross-check against the actual OpenAPI subset
Gemini accepts.

### W5 — Policy/legacy split means most ops bypass governed policies

Only ops 7 and 10 use `ModelPolicyId`. Ops 1–6, 8, 9, 11, 12 resolve through
`template.defaultModel` → raw env defaults, so temperature/token/model
governance (the whole point of policies) doesn't apply to extraction, grading
(RELMS legacy path), authoring, or insights. Op 9 even allows a raw per-request
`model` override.

### W6 — No canary/staged rollout for a model or SDK change

A model repoint or SDK swap is an all-tenants-at-once config/deploy. There is no
"route 5% of traffic / one tenant to the new model, compare, then promote" path.
Given W1–W3, a bad model change is a full-fleet incident.

---

## 3. The `@google/genai` migration plan (AI-SDK-MIGRATE)

**Goal:** replace `@google/generative-ai@0.21.0` with `@google/genai` inside
`packages/ai` **only**, behind compatibility tests, so that (a) 3.x tool-calling
parses correctly, (b) we can restore 3.x / an available pro-tier model for
conversation quality, and (c) explicit context caching (LLD §15 / CAI-022)
becomes unblockable.

> ⚠️ **Verify against current SDK docs before implementing.** `@google/genai` is
> the newer unified Google GenAI SDK; its response shape, function-calling
> accessors, and `responseSchema` handling differ from the legacy client. The
> implementer must read the current `@google/genai` reference (models,
> `generateContent`, `functionCalls`, `usageMetadata`, cached-content) rather
> than assume parity. This plan defines _what must hold_, not the exact API
> calls.

### 3.1 Scope (what changes / what does NOT)

**Changes — contained entirely to `packages/ai/src/provider/gemini.ts` + its
tests:**

- Swap the client construction and `generateContent` call.
- Re-implement `toGeminiContents` mapping against the new content/parts shape.
- Re-implement tool declaration + `functionCalls` extraction against the new
  response shape (this is the fix — real callIds if the new SDK exposes them;
  else keep the synthetic-id strategy).
- Re-implement `usageMetadata → ProviderTokenUsage` (map any new fields:
  cached-input, thinking/reasoning tokens).
- Re-validate `stripUnsupportedSchemaKeys` against the new SDK's schema
  acceptance (it may accept more/fewer keywords, or take a native schema
  object).

**Explicitly does NOT change (the seam holds):**

- `LLMProvider` interface, `ProviderInput`/`ProviderOutput`/`ProviderMessage` —
  unchanged.
- The gateway, cost, quota, moderation, telemetry, secrets — untouched.
- The `AiRequest`/`AiResponse` service seam — untouched.
- Model policy _IDs_ — unchanged (the _values_ they resolve to may change
  post-migration; see §4).

### 3.2 Test matrix — must cover EVERY AI op across BOTH modalities

The migration's acceptance gate is a provider-level compatibility suite that
exercises every capability the inventory (§1.8) uses. Two tiers:

**Tier 1 — offline/contract tests (CI, no network):** assert the adapter builds
the right request shape and decodes a captured/synthetic response for:

| capability                   | covering ops        | assertion                                                                                                                        |
| ---------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| responseSchema JSON mode     | 1,2,3,4,5,6,7,11,12 | request carries sanitized schema + `responseMimeType`; response `json` parses                                                    |
| tool-calling (function decl) | 9,10                | request carries `functionDeclarations` (sanitized params) + `toolConfig` mode; response `toolCalls[]` decoded with ids preserved |
| tools + text in one turn     | 10                  | assistant turn with both `functionCall` and text parts round-trips                                                               |
| tool result continuation     | 10                  | `tool` role → functionResponse envelope preserves `callId`                                                                       |
| multi-image inline           | 1,3,4,7,8           | `images[]` + typed image parts both attach as inlineData                                                                         |
| developer role subordination | 10                  | developer content stays separate from systemInstruction                                                                          |
| usage/token mapping          | all                 | `usageMetadata` → input/output/total; cached-input & reasoning fields mapped if present                                          |
| temperature/maxTokens        | all                 | policy values reach `generationConfig`                                                                                           |

**Tier 2 — real-key smoke (gated, manual/CI-with-secret):** one live call per
**distinct (model, modality)** pair against the real project, asserting a
non-empty parse. This is the test that would have caught 2.5-pro-404 and the 3.x
parse gap. Minimum pairs:

- `evaluation.quality` model × responseSchema
- flash default × responseSchema (scout)
- conversation model × tool-calling (the P0-03 case)
- conversation model × tool+text
- pro default × responseSchema + images (extraction)

**Regression bar:** the existing `gemini-tool-schema-sanitize.test.ts`,
`gemini-messages.test.ts`, `gateway-conversation.test.ts`,
`gateway-images.test.ts` must stay green (ported to the new shape where they
assert provider internals).

### 3.3 Streaming & caching readiness (design-forward, not in initial scope)

- **Streaming:** the current `LLMProvider.call` is unary
  (`Promise<ProviderOutput>`). Conversation UX will eventually want token
  streaming. The migration should _not_ add streaming, but should **not
  foreclose it**: note where a `callStream()` seam would attach (a sibling
  method on `LLMProvider`, gateway loops the same moderation/telemetry around
  the final aggregated result). Decision D6.
- **Context caching (LLD §15, CAI-022):** explicit provider caching stays
  **off** until this migration lands and cache economics are proven.
  Post-migration, the design enabler is **stable-prefix ordering**: platform
  system instruction → developer config → durable history → volatile tail, so an
  explicit cache can key on the stable prefix. The gateway already orders
  messages this way structurally; the migration should record
  `cachedInputTokens` from `usageMetadata` so we can _measure_ implicit-cache
  hit rates before deciding on explicit caches. Decision D5.

### 3.4 Rollout sequence

1. Land the adapter + Tier-1 suite behind the unchanged seam. Ship dark (no
   default change) — `@google/genai` present, still resolving 2.5-flash for
   conversation.
2. Run Tier-2 real-key smoke across the model×modality matrix on the real
   project. Record which models actually work.
3. **Only then** repoint conversation policies off the 2.5-flash workaround to
   an available, parse-verified pro/quality model (§4), via env override first
   (no redeploy), then default change.
4. Enable `cachedInputTokens` measurement; revisit explicit caching after ≥1
   week of hit-rate data.

---

## 4. Model-policy governance proposal

### 4.1 The problem

Model availability changes out from under us (2.5-pro 404, preview churn).
Defaults are set in code, validated only for _shape_, promoted to prod by
deploy, and discovered-broken by smoke test. Ownership of "which model backs
which policy" is implicit.

### 4.2 Proposal — three-part governance

**(a) A live availability gate in CI/pre-deploy (fixes W1).** Add a
`validateModelsAvailable` step that, for every model a deploy would use
(`LEVELUP_AI_MODEL_PRO/FLASH/CONVERSATION[_FAST]` + the allowlist), issues a
real 1-token probe against the target project with the platform key and fails
the deploy on 404/permission/parse errors. This makes "model exists and
responds" a **deploy gate**, not a prod discovery. Runs in the release-train
pipeline (coordinate with conv-release-train — they own the deploy sequence
today).

**(b) A single MODEL-POLICY registry doc as SSOT for _intent_ (fixes W5
ownership).** One table: policy/default → intended tier → currently-bound model
→ last-verified date → owner. Code stays the mechanism; this doc is the
human-governance record of "why this model, who signed off, when we last proved
it works." Every model repoint updates it.

**(c) Promote high-stakes ops onto governed policies (addresses W5).** Introduce
`evaluation.fast` (scout/mapping), `extraction.quality`
(paper→questions/rubric), and optionally `authoring.quality` / `insights.fast`
so extraction and grading stop riding raw `template.defaultModel`. This
centralizes temperature/token/model governance for the correctness-critical ops.
**This is additive and can be staged after the SDK migration.** Decision D3.

**(d) Move preview models off the default slot (fixes W3).** Default
`LEVELUP_AI_MODEL_PRO`/`FLASH` to the most recent **GA** models that pass the
availability gate; treat 3.x preview as an opt-in via env override for
tenants/experiments, not the fleet default. Decision D2.

### 4.3 Ownership map (proposed)

- **Provider adapter + SDK** (gemini.ts, migration): AI Gateway & Provider
  Engineer / this layer.
- **Model defaults + availability gate**: this layer proposes; **release-train
  owns the deploy gate wiring**.
- **Policy _values_ (which model/temp/tokens per policy)**: owner (Subhang)
  sign-off, recorded in the MODEL-POLICY doc.
- **Telemetry/cost framework + pricing catalog**: LLM Tracking Framework owner
  (`sess_1784368194906_0wpwk01dn`) — this layer _consumes_, does not redefine.
  Any new `feature`/`purpose`/policy that affects rollups must be agreed there.
- **`models.ts`/`turn.ts` edits**: conv-core + release-train own these
  mid-release — **do not edit while their redeploy is pending.**

---

## 5. Smaller hardening items (not decisions, just backlog)

- **H1** — Turn the SDK-parse defensive guards (W2) into _observable_ events:
  when `text()` throws or `functionCalls()` is empty _and tools were declared_,
  emit a telemetry attempt-error (`PROVIDER_EMPTY_RESPONSE`) instead of silently
  returning `""`. Makes a future parse regression loud.
- **H2** — Add a `pricingFallback` alert: any attempt with
  `pricingFallback: true` means we billed a model at conservative fallback
  pricing → signals an un-priced (often new/unexpected) model in prod.
- **H3** — Consider caching the tenant/platform _negative_ lookup briefly
  (currently every request re-reads Secret Manager; correct for rotation but a
  hot path cost). Coordinate with Security/Rotation owner — probably leave as-is
  for correctness.
- **H4** — `validateProviderModel`'s built-in supported set duplicates knowledge
  that the availability gate (§4.2a) would own; once the gate exists, thin the
  built-in list to avoid drift.

---

## 6. What I deliberately did NOT touch

- Prompt content / system instructions (Layer-2).
- Conversation runtime `turn.ts` semantics, mobile chat UX (Layer-1 /
  conv-core).
- The telemetry ledger schema and Supabase rollup design (LLM Tracking Framework
  owner).
- `models.ts` / `turn.ts` edits — conv-core + release-train hold these
  mid-release.

---

## 7. Open decisions for the owner

| #      | Decision                                                    | Options                                                                                                          | My lean                                                                                                                                                |
| ------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D1** | Priority/sequencing of AI-SDK-MIGRATE vs governance gate    | (a) migration first, (b) availability gate first, (c) parallel                                                   | **(c)** — availability gate is small and would have caught today's incidents; migration is the durable fix. Gate first-to-land, migration in parallel. |
| **D2** | Default model tier                                          | (a) keep 3.x preview defaults, (b) move defaults to latest GA, preview via override                              | **(b)** — stop pinning revenue-critical grading to preview.                                                                                            |
| **D3** | Promote extraction/grading/scout onto governed policies     | (a) yes now, (b) after migration, (c) leave legacy                                                               | **(b)** — additive, lower risk after SDK is stable.                                                                                                    |
| **D4** | Add a second provider (Claude) now or keep the seam dormant | (a) build Claude adapter, (b) seam-ready only                                                                    | **(b)** — seam is ready; no demand signal yet. Revisit if BYOK users want it.                                                                          |
| **D5** | Explicit context caching                                    | (a) enable post-migration if ROI, (b) stay off indefinitely                                                      | **(a)** — measure `cachedInputTokens` first, decide on data.                                                                                           |
| **D6** | Streaming for conversation                                  | (a) design the `callStream` seam in this migration, (b) defer entirely                                           | **(b)** design-note only now; real work after migration + Layer-1 asks for it.                                                                         |
| **D7** | Canary/staged model rollout (W6)                            | (a) build one-tenant canary path, (b) accept fleet-wide config risk with the availability gate as the safety net | **(b)** for now — the availability gate covers the biggest risk cheaply; canary is a larger build.                                                     |

---

## 8. Coordination log

- **LLM Tracking Framework owner** (`sess_1784368194906_0wpwk01dn`): must agree
  any change touching `feature`/`purpose`/policy taxonomy or pricing (§4.2b/c,
  §5 H2). Not yet contacted — pending owner go on which proposals to pursue.
- **conv-release-train** (`sess_1784405228034_7fae3ct76`): owns the deploy
  sequence → availability gate (§4.2a) wires into their pipeline; owns
  `models.ts`/`turn.ts` mid-release (do-not-edit).
- **conv-core-convergence** (`sess_1784401951500_skimip830`): owns conversation
  `turn.ts`.

---

_Next step: owner reviews §7 decisions; I refine into an implementation-ready
plan for the chosen items. No implementation until sign-off._
