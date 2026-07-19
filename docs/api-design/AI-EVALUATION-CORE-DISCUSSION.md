# AI Evaluation Core — Architecture Discussion (v0, 2026-07-18)

Status: DISCUSSION — current-state audit + proposed direction + open questions
for the owner. Scope: the unified AI grading pipeline across spaces (online) and
autograde (offline), the three configuration concepts (Agents, Question Rubric,
Evaluation Settings), the AI question types (short answer / descriptive / code /
image / audio / chat-agent), and LLM latency.

---

## 1. The owner's mental model vs. what the code actually does

The three-concept model is correct, and — importantly — **it already exists in
the data model**. What's missing is the runtime honoring it. The schemas are
~70% of the way to the target design; the execution paths are ~30%.

| Concept                         | Schema (exists today)                                                                                                                                                                                                                                                                                                                                         | Runtime (what actually happens)                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent (persona)**             | `AgentSchema` — space-scoped, `type: tutor\|evaluator`, `identity`, `systemPrompt` (⚷), `rules[]`, `evaluationObjectives[]`, `strictness`, `feedbackStyle`, `modelOverride`, `temperatureOverride` (`packages/domain/src/entities/levelup/agent.ts`). Space has `defaultEvaluatorAgentId` / `defaultTutorAgentId`. CRUD services exist (`agents-presets.ts`). | **Never used in v1 evaluation.** `packages/services/src/levelup/practice.ts` builds the grading prompt from question/maxMarks/rubric/answer only. The chat service uses the generic `aiChat` prompt. Only the _legacy_ `functions/levelup/src/callable/evaluate-answer.ts` + `prompts/evaluator.ts` inject agent identity/rules/strictness — and that stack is slated for deletion. |
| **Question Rubric**             | `UnifiedRubricSchema` — shared by exams and items; `scoringMode: criteria_based\|dimension_based\|holistic\|hybrid`, `criteria[]`, `dimensions[]`, ⚷ `modelAnswer`/`evaluatorGuidance` (`packages/domain/src/entities/content/rubric.ts`). Hierarchical resolution item→storyPoint→space→tenant (levelup) and question-snapshot→exam→tenant (autograde).      | **Half-used.** Both paths pass the rubric to the LLM — but as a raw `JSON.stringify` blob into a generic prompt. The legacy evaluator prompt had scoringMode-aware rendering (criteria list / dimension scales / holistic guidance); v1 lost that.                                                                                                                                  |
| **Evaluation Settings (RELMS)** | `EvaluationSettingsSchema` — tenant-level; `enabledDimensions[]` (the LLM output dimensions: grammar/structure/clarity-style), `displaySettings`, ⚷ `confidenceConfig`, `usageQuota` (`packages/domain/src/entities/autograde/evaluation-settings.ts`). Exams reference via `evaluationSettingsId`.                                                           | **Only the confidence thresholds are consumed** (autograde `resolve-rubric.ts` → HITL routing). `enabledDimensions` never shape the LLM `responseSchema` anywhere. v1 online evaluation passes `responseSchema: { type: "object" }` — i.e. "any JSON object". The output structure the owner wants Evaluation Settings to define is currently unconstrained.                        |

There is also a canonical **output** schema already in domain:
`UnifiedEvaluationResultSchema`
(`packages/domain/src/entities/content/evaluation-result.ts`) with
`structuredFeedback` keyed by dimension, `rubricBreakdown[]` per criterion,
`confidence`, `mistakeClassification`, summary, ⚷ cost fields. The v1 online
path returns a looser ad-hoc `{score,maxScore,strengths,...}` instead.

## 2. Current evaluation flows (audited 2026-07-18)

### Shared substrate (already unified — keep)

- **AI gateway** `packages/ai` — single `generate()` seam: prompt registry with
  `{{var}}` interpolation, Gemini 2.5 pro/flash (env-overridable, `models.ts`),
  per-tenant quota + circuit breaker + retry, cost audit to `llmCallLogs`,
  moderation, `AiImageStore` storagePath→bytes (14MB budget). Both autograde and
  levelup call `ctx.ai.generate({promptKey: "answerGrading", ...})`.
- **Projections**: `stripEvaluationCost`, `projectRubric` (strips ⚷
  modelAnswer/evaluatorGuidance for non-authoring) shared.
- **Gaps in the gateway**: **no streaming**, **no tool/function calling**,
  providers = Gemini only.

### Online (spaces) — synchronous

- `v1.levelup.evaluateAnswer` → `practice.ts scoreOne`: deterministic key-based
  scoring when an answer key exists; else one blocking `answerGrading` LLM call.
  Media (audio/image) attached as tenant-scoped storage paths, MIME guessed by
  extension, Gemini reads bytes natively (no transcription step). Client waits
  for the full LLM response.
- Test mode: `saveTestAnswer` is write-through; `submitTestSession` grades
  deterministic items inline and marks AI items `aiPending` with a **zero-score
  placeholder** — the async AI grading leg for tests is effectively a stub.
- Chat (`sendChatMessage`): generic tutor prompt; `itemContext` is **only IDs**
  (`Space: {id}, Lesson: {id}, Item: {id}`) — the model never sees the question
  content, the rubric, or a persona. `agentInstructions` on
  `chat_agent_question` is schema-only (grep: zero service reads). Transcript is
  stored, but there is no dedicated transcript-evaluation flow.

### Offline (autograde) — async pipeline

- upload → scouting (`answerMapping`, flash) → per-question RELMS grading
  (`answerGrading`, pro, handwritten pages as images) → confidence-routed HITL
  (`needs_review` below threshold) → finalize (summary, single-writer) → teacher
  review/override/regrade → release gate. Cloud Tasks dedupe, watchdog re-drive,
  DLQ, RTDB status ticker (never scores).

### The real difference between the two worlds

Input acquisition and delivery semantics — **not** evaluation semantics:

|              | Online (spaces)                                        | Offline (autograde)                                          |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------ |
| Input        | typed text / recorded media, already digital, per-item | handwritten pages needing extraction + page→question mapping |
| Timing       | interactive, learner waits (sync)                      | batch, nobody waits (async, retries, DLQ, watchdog)          |
| Trust flow   | instant feedback to learner                            | HITL confidence routing, teacher review, release gate        |
| Cost posture | latency-sensitive, per-attempt                         | throughput-sensitive, batch                                  |

The middle — resolve persona + rubric + dimensions, build prompt, call model,
get structured result, route by confidence — is conceptually identical and
should be one engine.

## 3. Proposed architecture direction

### 3.1 One Evaluation Core

A single `evaluate(request)` service (in `packages/services/src/evaluation/` or
a new `packages/evaluation`) consumed by four callers: practice sync path,
test-session batch grader (fixes the `aiPending` stub), autograde RELMS stage,
and chat-agent transcript finalization.

```
EvaluationRequest {
  agent:      resolved evaluator Agent (item.meta → storyPoint → space → tenant default → built-in)
  rubric:     UnifiedRubric snapshot (existing resolution chains)
  settings:   EvaluationSettings (enabledDimensions + displaySettings + confidenceConfig)
  subject:    { question, maxMarks, questionType }
  answer:     { text? , mediaRefs? (storage paths), transcript? (chat) }
  mode:       "interactive" | "batch"   // drives model tier + timeout posture
}
→ UnifiedEvaluationResult (the domain schema, everywhere)
```

Three deterministic builders inside the core:

1. **Persona builder**: agent → system prompt segment (identity, rules,
   strictness, feedbackStyle, evaluationObjectives). Port the legacy
   `functions/levelup/src/prompts/evaluator.ts` scoringMode- aware rendering
   into the services layer — it's the best prompt code in the repo and it's
   about to be deleted with the legacy stack.
2. **Rubric renderer**: scoringMode-aware (criteria list / dimension scales /
   holistic / hybrid), ⚷ fields included server-side only.
3. **Schema builder**: `EvaluationSettings.enabledDimensions` + rubric criteria
   → a **concrete JSON responseSchema** (structuredFeedback keys = dimension
   ids, rubricBreakdown entries = criterion ids, required confidence). This is
   what makes Evaluation Settings actually "the output structure of the AI
   response" instead of `{type:"object"}`.

### 3.2 Agent tools (gateway extension)

The gateway needs a tool-calling seam (`tools[]` in `ProviderInput`, tool-loop
in the gateway, executor injected by the caller). Two distinct uses:

- **Single-shot evaluation** (short answer, descriptive, code, image, audio,
  autograde): a strict responseSchema is cheaper, faster, and more reliable than
  a tool loop. Recommendation: **keep single-shot structured output here**;
  tools add round-trips for no benefit.
- **Chat-agent questions**: this is where tools genuinely matter. Proposed
  evaluator-side tools for the conversational agent:
  - `record_observation(dimensionId, evidence, provisionalScore)` — the
    "dynamically scores each evaluation setting in tool calls" behavior the
    owner described; builds a rolling scorecard across turns.
  - `end_conversation(reason)` — agent-initiated close (besides maxTurns/learner
    close).
  - `finalize_evaluation(...)` — or close the session and hand the transcript +
    accumulated observations to the same single-shot Evaluation Core for the
    final UnifiedEvaluationResult (recommended: keeps final scoring consistent
    with every other question type).
  - Future (v-later, per owner): retrieval/library tools, code-execution for
    code questions, community agent tools.

### 3.3 Ability parity questions surfaced by unification

- Online could inherit autograde's **confidence→HITL** routing (provisional
  feedback + teacher review queue) — product decision needed.
- Autograde could inherit **per-dimension structured feedback** (currently its
  breakdown is looser) — comes free with the schema builder.
- Test-mode AI grading becomes a real batch call into the core instead of the
  zero placeholder.

## 4. Latency

Today's chain: cold start (minInstances is 0 everywhere; nothing sets it in
`functions/sdk-v1`) → blocking callable → single non-streaming `generateContent`
on **gemini-2.5-pro** for grading → full response before anything returns. So
no, it is **not** just time-to-first-byte — the client receives nothing until
the entire evaluation finishes. Worst case = cold start (seconds) + pro- model
full generation (can be 10–30s with thinking).

Levers, in recommended order:

1. **Streaming callables** — `firebase-functions` is already `^6.0.0`, which
   supports streaming `onCall` (`response.sendChunk` / client `.stream()`).
   Biggest perceived-latency win, essential for chat turns; for evaluation,
   feedback sections can render progressively.
2. **minInstances: 1** on the hot AI callables (evaluateAnswer, sendChatMessage)
   — eliminates cold start for a few dollars/month each.
3. **Model tiering by mode**: flash for interactive chat turns and short-answer
   checks; pro reserved for batch/autograde/complex descriptive. Agent
   `modelOverride` already models this.
4. **Do NOT move evaluation client-side.** Evaluation prompts embed ⚷
   `modelAnswer` / `evaluatorGuidance` — the answer key. A direct-from-frontend
   LLM call (Firebase AI Logic / client Gemini + App Check) ships the answer key
   to the device. Only the _tutor chat_ flow is secret-free enough for
   client-direct, and even there we'd lose the moderation/quota/cost-audit
   hooks. Recommendation: stay server-side + streaming; revisit client-direct
   only for tutor chat if streaming isn't enough.

## 5. Notable defects found during this audit

1. v1 online evaluation ignores Agents and Evaluation Settings entirely
   (practice.ts).
2. `responseSchema: {type:"object"}` — LLM output shape unconstrained in v1.
3. Chat tutor prompt context = bare IDs; model never sees question
   content/persona; `agentInstructions` never read.
4. Chat-agent transcript final-scoring flow effectively unwired.
5. Test-session AI items: zero-score placeholder, no async grading leg.
6. `EvaluationSettings.enabledDimensions` consumed by nothing.
7. Legacy `functions/levelup` evaluator prompt (the richest persona/scoringMode
   implementation) lives only in the to-be-deleted stack.
8. Gateway: no streaming, no tools.

## 6. Open questions for the owner

See task report / session message — grouped: agent scoping & authorship, chat
scoring semantics, evaluation-settings placement, HITL parity, latency targets,
tool scope v-now vs v-later, model-choice exposure, audio transcription.
