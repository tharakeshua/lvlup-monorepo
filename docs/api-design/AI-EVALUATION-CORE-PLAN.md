# AI Evaluation Core — Implementation Plan (v1, 2026-07-18)

> **STATUS (2026-07-18, end of session): IMPLEMENTED — Phases 1–5 landed, all
> gates green.**
>
> - Phase 1 Evaluation Core: `packages/services/src/evaluation/` (types / prompt
>   / response-schema / resolve / evaluate / agent-chat) + `unifiedEvaluation` &
>   `agentChat` registry prompts.
> - Phase 2 online: `practice.ts scoreOne` → core (agents + settings +
>   transcript answers); `submitTestSession` grades AI items for real
>   (zero-placeholder only on gateway failure).
> - Phase 3 autograde: `process-answer-grading` → core; `resolve-rubric` returns
>   full settings (FIXED: was reading the wrong collection — settings/thresholds
>   silently never resolved); `mapping.otherQuestionIds` context isolation
>   consumed.
> - Phase 4 chat agents: gateway tool seam (`tools`/`toolCalls` through
>   provider→gateway→services seam→sdk-v1 ai-seam adapter, fail-fast on
>   tools+responseSchema); `sendChatMessage` persona turns with
>   `record_observation` rolling scorecard (learner-visible, persisted on
>   session) + `end_conversation`/maxTurns finalization through the core
>   (progress persisted); tutor path now sends real item content + history (was
>   bare IDs). Contract: `observations` / `conversationEnded` / `evaluation` on
>   the sendChatMessage response.
> - Phase 5: `Space.evaluationSettingsId` (domain + saveSpace contract +
>   projections); `StoredEvaluation` gained optional
>   confidence/structuredFeedback/rubricBreakdown.
> - Cross-session integrations: extraction-architect seam contract (rubric field
>   names, stable criterion ids, rubricsGeneratedAt gate), LLM-tracking
>   framework (feature + usage attribution threaded by the dedicated Opus
>   session; tool calls = one cost row per attempt).
> - NOT in scope / follow-ups: frontend consumption of the new response fields
>   (scorecard UI, structuredFeedback rendering), autograde evaluator personas
>   (agent=null v-now), streaming (latency deferred by owner), legacy
>   `functions/levelup`+`functions/autograde` deletion.

Owner directives (2026-07-18): all AI questions working perfectly; clean,
consistent architecture across spaces and autograde; ignore latency/streaming
for now; no teacher-HITL for online (autograde keeps its existing confidence
routing + reports); rubric stays a question-level concept; for everything else,
best-judgment decisions below.

## Decisions (locked)

- **D1 — One Evaluation Core.** `packages/services/src/evaluation/` owns
  persona+rubric+dimensions prompt composition, response-schema generation, and
  result normalization. Consumers: levelup practice (`scoreOne`), test-session
  submit (replaces the `aiPending` zero-placeholder), autograde RELMS
  (`process-answer-grading`), chat-agent finalization.
- **D2 — Rubric is per-question.** The question/item rubric snapshot is
  authoritative; the existing default chains (item→storyPoint→space→tenant;
  question-snapshot→exam→tenant) are fallback only. No schema change.
- **D3 — Evaluation Settings: one tenant-level pool, shared.** Exams keep
  `evaluationSettingsId`. Spaces get an optional `evaluationSettingsId`
  (domain + contract). Resolution: space.evaluationSettingsId → tenant default
  (`isDefault: true`) → none (schema falls back to the base result shape).
  `enabledDimensions` now actually generate the LLM `responseSchema` — the
  owner's "Evaluation Settings = output structure of the AI response".
- **D4 — Agents stay space-scoped (v-now).** Evaluator resolution:
  `item.meta.evaluatorAgentId` → `space.defaultEvaluatorAgentId` → null
  (built-in default persona text). Autograde runs with agent=null for now (no
  space); tenant-level agent library is v-later.
- **D5 — Single-shot evaluation uses strict structured output, not tools.** The
  response schema is built from settings.enabledDimensions + rubric.criteria.
  Tools are reserved for the chat agent, where they are semantically necessary.
- **D6 — Chat agent gets a real persona + tools.** Gateway grows a minimal tool
  seam (Gemini functionDeclarations). Chat tools:
  `record_observation(dimensionId, evidence, provisionalScore)` (rolling
  scorecard, persisted on the session, returned to the client — owner said
  scorecard is visible) and `end_conversation(reason)`. Conversation ends by
  student action, `maxConversationTurns`, or the agent's `end_conversation` —
  all three. Final scoring: transcript + accumulated observations → the same
  Evaluation Core single-shot call.
- **D7 — Output converges on `UnifiedEvaluationResult`.** `StoredEvaluation`
  gains optional `structuredFeedback` / `rubricBreakdown` / `confidence`
  (non-breaking optionals) so online results can carry the richer shape;
  autograde evaluation keeps its stored fields and adds the same. Cost fields
  stay ⚷ stripped.
- **D8 — Port the legacy prompt builder.**
  `functions/levelup/src/prompts/evaluator.ts` (persona block,
  `<student_answer>` injection guard, type-specific context, scoringMode-aware
  rubric rendering, canonical output format) is ported into the core and retired
  with the legacy stack.
- **D9 — Latency work deferred** (streaming/minInstances/tiering documented in
  the discussion doc, not in scope).

## Phases

### Phase 1 — Evaluation Core (packages/services/src/evaluation/)

- `types.ts`: `EvaluationRequest` { question: {text, type, maxScore, typeData?},
  answer: {text?, transcript?, mediaCount}, agent?, rubric?, settings?, mode:
  "interactive"|"batch" }, `EvaluationOutcome` (normalized
  UnifiedEvaluationResult minus cost).
- `prompt.ts`: `buildEvaluationPrompt(req)` → single user-prompt string (ported
  legacy builder + dimension guidance from settings + agent persona). System
  prompt stays the registry's.
- `response-schema.ts`: `buildEvaluationResponseSchema(settings, rubric)` →
  concrete JSON schema (required
  score/maxScore/confidence/strengths/weaknesses/missingConcepts/summary;
  structuredFeedback properties = enabled dimension ids; rubricBreakdown when
  criteria exist).
- `evaluate.ts`: `evaluateWithAi(ai, callCtx, req)` → calls gateway with a new
  registry prompt `unifiedEvaluation` (user template = `{{evaluationPrompt}}`;
  system = rigorous-fair-grader + injection guard), normalizes/clamps the
  result, derives correctness/percentage, stamps gradedAt.
- `resolve.ts`: `resolveLevelupEvaluationConfig(ctx, tenantId, spaceId, item)` →
  {agent, rubric, settings} using the chains in D3/D4;
  `resolveTenantDefaultSettings` helper shared with autograde.
- Registry: add `unifiedEvaluation` prompt (purpose `answer_grading`, pro model,
  temp 0).
- Unit tests: prompt composition per scoringMode/persona, schema builder, result
  normalization.

### Phase 2 — Online wiring (levelup)

- `practice.ts scoreOne`: gains `spaceId`; subjective path resolves config via
  Phase 1 and calls the core. Persists enriched StoredEvaluation (D7). Media
  handling unchanged (tenant-scoped storage paths, MIME guess).
- `test-session.ts submitTestSession`: AI items graded for real via the core
  (sequential batch, mode "batch"); `aiPending` only remains true on gateway
  failure (graceful degradation), and the graded notification fires when nothing
  is pending.
- Domain: StoredEvaluation optional fields; projections pass-through.

### Phase 3 — Autograde wiring

- `resolve-rubric.ts`: also return the full EvaluationSettings
  (enabledDimensions), falling back to tenant default settings when the exam has
  none.
- `process-answer-grading.ts`: prompt + responseSchema from the core builders
  (agent=null); evaluation doc gains
  strengths/weaknesses/structuredFeedback/rubricBreakdown; confidence routing,
  DLQ, progress ticker untouched. Reports keep working with richer per-dimension
  data.

### Phase 4 — Chat agent questions

- Gateway (`packages/ai`): `tools?: AiToolDecl[]` on request/ProviderInput;
  Gemini functionDeclarations; result gains `toolCalls?: {name, args}[]`;
  bounded 2-round loop when the model returns tool calls without user-facing
  text. Services seam (`shared/ai.ts`) mirrors the fields. Stub/Fake gateways:
  no toolCalls → chat degrades to plain tutor turn.
- `chat.ts sendChatMessage`: loads the item; if `chat_agent_question`, system
  context becomes persona (space agent or `agentInstructions`) + question
  content + objectives + enabled dimensions to observe + never-reveal guard;
  tools attached; observations persisted on the session doc and returned
  (visible scorecard); `end_conversation` or maxTurns → final evaluation via the
  core over the transcript + observations, progress persisted via
  `applyProgress`, evaluation returned in the response.
- `practice.ts`: chat transcripts submitted through `evaluateAnswer` (registry
  learner shape `{transcript}`) evaluate via the core transcript path
  (student-initiated end).
- Contract: optional response fields on sendChatMessage (`observations`,
  `conversationEnded`, `evaluation`) + optional `agentInstructions` passthrough;
  strict schemas updated.

### Phase 5 — Settings placement + verification

- Domain space schema + saveSpace contract: optional `evaluationSettingsId`.
- Full build (tsc) + test suite across domain/api-contract/services/ai; contract
  pin tests.
- E2E smoke vs emulator where feasible.

## Verification gates (per memory: build+test, not vitest alone)

Each phase: `pnpm -F @levelup/<pkg> build && test`; final: full workspace
build + services+ai+domain test suites green; no new strict-contract violations.
