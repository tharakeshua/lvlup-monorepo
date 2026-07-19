# AI Grading — Prompt Construction Design (Layer 2)

> **Status:** DRAFT v0.1 — first-pass current-state map + proposed architecture
> for owner review. **Owner design partner:** this session (Layer-2). **Scope:**
> how the LLM _evaluation_ prompt is assembled from every grading parameter.
> **Not in scope:** transport/model/caching mechanics (Layer-3), mobile feedback
> rendering (Layer-1). Contracts with both are in §5.
>
> **Reviewer:** Subhang. Nothing here is implemented — this is the map + the
> proposal + the open decisions. No mass changes without sign-off.

---

## 0. TL;DR for the owner

Today, **one function** — `buildEvaluationPrompt(req)` in
`packages/services/src/evaluation/prompt.ts` — turns the whole grading config
(persona + question + answer + rubric + dimensions + scoring) into a single flat
string, and **one function** — `buildEvaluationResponseSchema(settings, rubric)`
in `response-schema.ts` — turns the enabled dimensions + rubric criteria into
the JSON output schema. All three grading paths (online practice/test, offline
autograde/RELMS, conversational-assessment finalization) converge on the same
`evaluateWithAi()` → `unifiedEvaluation` prompt key.

That convergence is genuinely good. The problems are all in **what gets
injected, how, and whether it is versioned**:

1. Four different "objectives" concepts, and the two most important ones for
   conversational assessment (**public** + **private** evaluation objectives)
   are silently dropped from the eval prompt.
2. **Rubric criterion `levels`** — the natural per-score calibration anchors —
   exist in the schema and the config view but are **never injected** into the
   grading prompt.
3. **Dimension-based scoring is asked-for but un-captured**: the prompt tells
   the model to "rate each dimension on a 1-N scale," but the response schema
   has **no field** to hold those ratings (only free-text feedback items). So
   dimension scores evaporate.
4. **`strictness`, dimension `priority` (HIGH/MEDIUM/LOW), and `weight`** are
   printed as raw values with **no behavioral meaning** given to the model.
5. **No prompt version / fingerprint** on the online + autograde paths (only the
   frozen assessment path pins one). A composition change silently re-grades
   everything.
6. **Per-question-type variation is one `if (code)` branch** — audio, image, and
   chat-agent questions get no type-specific framing.
7. The **canonical answer key** (`answerKeys` collection, typed per registry) is
   **not merged** into the online eval prompt — only `rubric.modelAnswer` is.

The proposal: replace the flat-string builder with a **typed, ordered block
model** (`PromptBlock[]`), a **per-question-type eval spec registry** derived
from the existing `QUESTION_TYPE_REGISTRY`, a **richer dimension-aware response
schema** that captures per-dimension scores, an explicit **calibration layer**
(criterion levels + strictness mapping + optional few-shot), and a **composition
version + fingerprint** frozen with every result.

---

## 1. Current-state map — exact code paths

### 1.1 The convergence point

```
                         ┌─────────────────────────────────────────────┐
 online practice/test ──►│ scoreOne()  levelup/practice.ts             │
   (evaluateAnswer,      │   → resolveLevelupEvaluationConfig()        │
    recordItemAttempt,   │   → evaluateWithAi(ai, callCtx, req)        │─┐
    submitTestSession)   └─────────────────────────────────────────────┘ │
                         ┌─────────────────────────────────────────────┐ │
 offline autograde ─────►│ processAnswerGradingService()               │ │
   (RELMS per-Q,         │   autograde/pipeline/process-answer-grading │ │
    scanned sheets)      │   → resolveRubricService()                  │ │
                         │   → evaluateWithAi(ai, callCtx, req)        │─┤
                         └─────────────────────────────────────────────┘ │
                         ┌─────────────────────────────────────────────┐ │
 conversational ────────►│ evaluateFrozenSubmission()                  │ │
   assessment finalize   │   conversation/submission-evaluation.ts     │ │
   (finishConversation)  │   → buildFrozenEvaluationPacket()           │ │
                         │   → evaluateWithAi(ai, callCtx, req)        │─┘
                         └─────────────────────────────────────────────┘
                                            │
                                            ▼
        packages/services/src/evaluation/evaluate.ts  evaluateWithAi()
          1. buildEvaluationPrompt(req)              → prompt.ts    (the STRING)
          2. buildEvaluationResponseSchema(set,rub)  → response-schema.ts (the SCHEMA)
          3. enabledDimensionIds(settings)
          4. ai.generate({ promptKey:"unifiedEvaluation",
                           variables:{ evaluationPrompt },
                           responseSchema, images?, model?, temperature? })
          5. normalize → clamped EvaluationOutcome
```

All three paths supply the **same `EvaluationRequest` shape**
(`evaluation/types.ts`):
`{ question, answer, agent, rubric, settings, mode, operation, feature, modelPolicyId? }`.
The config triad (`agent` persona / `rubric` / `settings`) arrives as **raw
`Doc`s**; the core reads them defensively (`str()`/`num()`/`arr()` guards).

### 1.2 The prompt string — `buildEvaluationPrompt()` block order

`prompt.ts` concatenates, **in this fixed order**:

| #   | Block             | Source field(s)                                                                                                    | Notes                                                                                                                                                        |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `personaBlock`    | `agent.identity\|name`, `agent.rules[]`, `agent.evaluationObjectives[]`, `agent.strictness`, `agent.feedbackStyle` | Emitted as `EVALUATOR IDENTITY / GRADING RULES / EVALUATION OBJECTIVES / STRICTNESS (0..1) / FEEDBACK STYLE`.                                                |
| 2   | `questionBlock`   | `question.text`, `question.questionType`, `typeData.*`                                                             | **Only `code` is special-cased** (language, starterCode, testCases). Everything else emits `correctAnswer`/`acceptableAnswers`/`objectives` from `typeData`. |
| 3   | `answerBlock`     | `answer.text` / `answer.transcript[]` / `answer.media[]` / `answer.observations[]` / `answer.note`                 | Student content wrapped in `<student_answer>…</student_answer>`. Grader-directed `note` sits **outside** the guard.                                          |
| 4   | `rubricBlock`     | `rubric.scoringMode`, `.criteria[]`, `.dimensions[]`, `.holistic*`, `.modelAnswer` ⚷, `.evaluatorGuidance` ⚷       | Renders by `scoringMode`. **Does NOT render criterion `levels`.**                                                                                            |
| 5   | `dimensionsBlock` | `settings.enabledDimensions[]` (id, name, description, priority, `promptGuidance` ⚷)                               | "For EACH dimension provide feedback items under its id in `structuredFeedback`."                                                                            |
| 6   | Scoring footer    | `question.maxScore`                                                                                                | Static partial-credit / confidence instructions.                                                                                                             |

The `unifiedEvaluation` registry template
(`packages/ai/src/prompts/registry.ts`) owns only the **system instruction**
(untrusted-data guard, "score only against the rubric", "respond with JSON
matching the schema") and renders `user: "{{evaluationPrompt}}"`.
`defaultModel: DEFAULT_PRO_MODEL`, `defaultTemperature: 0`, **no `version`
field**.

### 1.3 The response schema — `buildEvaluationResponseSchema()`

Targets the **Gemini structured-output subset**
(`type`/`properties`/`required`/`items`/`enum` only — no
`additionalProperties`/`patternProperties`). Always includes: `score`,
`maxScore`, `correctness`, `percentage`, `confidence`, `strengths[]`,
`weaknesses[]`, `missingConcepts[]`, `summary{keyTakeaway, overallComment}`,
`mistakeClassification` (enum).

Conditionally:

- **If `rubric.criteria.length > 0`** → adds `rubricBreakdown[]` =
  `{criterionId?, criterionName, score, maxScore, comment?}` (required).
- **If `settings.enabledDimensions.length > 0`** → adds
  `structuredFeedback{ <dimId>: FeedbackItem[] }` with **each enabled dim id as
  a required property** (this is the "schema-force every dimension" mechanism).
  `FeedbackItem = {severity(enum), message, suggestion?}`.

> **Key observation:** the schema derives from **`settings.enabledDimensions`**
> (feedback dimensions) and **`rubric.criteria`** (score breakdown) — but
> **NOT** from `rubric.dimensions` (dimension-based scoring). See gap G3.

### 1.4 Normalization — `evaluateWithAi()` result handling

Clamps `score∈[0,maxScore]`, derives `correctness`/`percentage`, whitelists
`structuredFeedback` to enabled dim ids (drops model-invented keys), normalizes
`summary` (handles legacy string form), tolerates legacy flat `feedback`.
Attaches `tokensUsed`/`costUsd`/`model` (⚷ stripped downstream by
`stripEvaluationCost`). `modelOverride`/`temperatureOverride` are read off the
**agent** doc.

### 1.5 Per-path specifics

**Online (`scoreOne`, practice.ts):**

- Deterministic types short-circuit before AI (`DETERMINISTIC_TYPES`,
  `autoEvaluateDeterministic`).
- `short_answer`/`fill_blank` **with a server answer key** are
  exact/acceptable-match — **no LLM**.
- `chat_agent_question` **hard-fails** here (`PRECONDITION_FAILED`) — must go
  through `finishConversation`.
- Subjective → resolves config triad, passes
  `typeData: {...question, ...questionData}`, attaches captured media
  (tenant-scoped filter), transcript-shaped answers become `answer.transcript`.
- Feature attribution: `levelup.agent_question` / `levelup.timed_test` /
  `levelup.practice`.

**Autograde (`processAnswerGradingService`):**

- `agent: null` (**no persona today**). `rubric` = resolved snapshot stored on
  the question at extraction; `settings` re-read from the exam's
  `evaluationSettings` for thresholds + dimensions.
- Answer is the **mapped answer-sheet image pages** (`mapping.imageUrls`) as
  `answer.media`, plus a grader `note` ("grade ONLY what's in these N pages;
  ignore other questions Q3, Q5…").
- Confidence → HITL routing (`confidence < confidenceThreshold` ⇒
  `needs_review`).
- `rubric.modelAnswer`/`evaluatorGuidance` come from the **extraction** step
  (`examRubricGeneration` prompt puts them _inside_ the rubric object — the
  "AD-11 channel").

**Conversational assessment (`buildFrozenEvaluationPacket`):**

- Reads the **frozen** `evaluatorContext` (question, answerKey, rubric,
  evaluationSettings, evaluatorAgent) from the immutable submission snapshot —
  **never re-resolves** live config.
- Folds answer-key `modelAnswer`→`rubric.modelAnswer` and
  `evaluationGuidance`→`rubric.evaluatorGuidance`.
- Adapts the frozen transcript into `answer.transcript` + `answer.media` (stable
  `[image:N]` placeholders), **deliberately omits `observations`** (interviewer
  evidence is audit-only, not a second scoring signal — LLD §13.3).
- Pins the frozen `evaluatorModelPolicyId: "evaluation.quality"` and
  `evaluatorPromptVersion`.

### 1.6 The parallel agent-turn prompt (interviewer runtime)

`evaluation/agent-chat.ts` (`buildAgentTurnPrompt` + `buildAgentTools`) composes
the persona-driven **conversation turn** (`agentChat` prompt key) — persona →
question → objectives → dimensions → history → learner message, with
`record_observation` / `end_conversation` tools. LLD §13.3 states this **becomes
a legacy adapter**; Conversation Runtime's typed-history
`conversationTutor`/`conversationQuestionHelp`/`conversationAssessment` prompts
(which _are_ versioned) are the forward path. **This turn-loop prompt is a
Layer-3 / conv-runtime boundary, not Layer-2** — noted here only because it
shares `evaluation/` and the persona/dimension inputs.

---

## 2. The parameter surface (what we compose from)

### 2.1 Rubric (`UnifiedRubric`, `entities/content/rubric.ts`)

`scoringMode: criteria_based | dimension_based | holistic | hybrid`

- `criteria[]`: `{id?, name, description?, maxScore, weight?, levels[]}` where
  `levels[] = {label, description?, score}` ← **the calibration anchors**.
- `dimensions[]`:
  `{id, name, description?, priority(HIGH|MED|LOW), weight?, scoringScale?, promptGuidance?⚷}`.
- `holisticGuidance?`, `holisticMaxScore?`, `passingPercentage?`,
  `showModelAnswer?`, `modelAnswer?⚷`, `evaluatorGuidance?⚷`.

### 2.2 Evaluation settings (`EvaluationSettings`, `entities/autograde/evaluation-settings.ts`)

- `enabledDimensions[]` (same `EvaluationDimension` shape) — drives feedback +
  response schema.
- `displaySettings{showStrengths, showKeyTakeaway, prioritizeByImportance}` —
  **display only today; never injected into the prompt** (applied at projection:
  `submission-evaluation.ts::toStoredEvaluation`).
- `confidenceConfig{confidenceThreshold(.7), autoApproveThreshold(.9), requireReviewForPartialCredit}`
  ⚷ — HITL routing only.
- `usageQuota{…}` — Layer-3 concern.

### 2.3 Agent persona (`ConversationAgent`, LLD §5.4 / `entities/levelup/agent.ts`)

`type: tutor | interviewer | evaluator`; `identity?`, `systemPrompt?⚷`,
`rules[]⚷`, `evaluationObjectives[]?` (evaluator-persona only, **not** item
objectives), `strictness?(0..1)`, `feedbackStyle?`, `modelPolicyId`,
`temperatureOverride?`, `modelOverride?`.

### 2.4 The four "objectives" (naming collision — see G1)

| Concept                         | Lives on                                                                                   | Injected today?                           |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `agent.evaluationObjectives[]`  | evaluator persona                                                                          | ✅ `personaBlock`                         |
| `typeData.objectives[]`         | question payload (non-code)                                                                | ✅ `questionBlock`                        |
| `publicLearningObjectives[]`    | `chat_agent_question` prompt (learner-safe)                                                | ❌ **dropped**                            |
| `privateEvaluationObjectives[]` | assessment **answer key** ⚷ (`{id, rubricDimensionId, description, evidenceRequirement?}`) | ❌ **only via modelAnswer/guidance fold** |

### 2.5 Question types (`QUESTION_TYPE_REGISTRY`, `entities/content/question-types/registry.ts`)

15 types; `evaluation: "auto" | "ai"`. **AI-graded set (6):** `text`,
`paragraph`, `code`, `audio`, `image_evaluation`, `chat_agent_question`. Each
carries typed `prompt`/`answer`/`learnerAnswer` schemas. Answer-bearing fields
(`modelAnswer`, `testCases`, `evaluationGuidance`, …) currently live on both
`prompt` and `answer` schemas (DP-3 will strip them from `prompt`).

---

## 3. Gaps & inconsistencies

> Ranked by grading-correctness impact. `⚷` = touches secret-projection
> boundary.

**G1 — "Objectives" collision; assessment objectives structurally dropped
(fidelity gap, not a breakage).** _Verified against
`buildFrozenEvaluationPacket` (`submission-evaluation.ts:184–231`):_ it folds
**only** `answerKey.modelAnswer → rubric.modelAnswer` and
`answerKey.evaluationGuidance → rubric.evaluatorGuidance`, and sets
`typeData: cloneDoc(question)` (which carries `publicLearningObjectives`). But
`questionBlock` reads only `typeData.objectives`, so
**`publicLearningObjectives[]` ride in unread** and
**`privateEvaluationObjectives[]`** (with their `rubricDimensionId` +
`evidenceRequirement`) **are never injected as a structured block**. →
Conversational assessments **still grade correctly** — the rubric dimensions +
folded modelAnswer/evaluationGuidance carry the signal (this is why conv-core's
real-key smoke produced a real evaluation). The gap is **fidelity**: the
_authored, dimension-linked_ objectives and their explicit evidence requirements
never reach the prompt in structured form, so the grader can't tie evidence to
the specific objective/dimension the author intended. Same underlying cause
affects the generic online path (`typeData.objectives` is the only objectives
channel). This is an enrichment opportunity, not a P0 — see §4.2.

**G2 — Criterion `levels` never injected.** `RubricCriterion.levels[]` =
`{label, description, score}` are textbook scoring anchors (e.g. "5 = complete
proof, 3 = correct approach minor gaps, 1 = attempts"). `toRubricView` (config
view) includes them; `rubricBlock` (grading prompt) **omits them entirely**. The
single richest calibration signal we already author is invisible to the grader.

**G3 — Dimension-based scoring is asked-for but un-captured.** For
`dimension_based`/`hybrid`, `rubricBlock` emits "RUBRIC DIMENSIONS (rate each):
… (scale 1-N, weight W)". But `buildEvaluationResponseSchema` derives the
breakdown **only from `rubric.criteria`**, never from `rubric.dimensions`. There
is **no schema field** for per-dimension scores. The model is told to rate on a
scale, produces nothing structured, and the single `score` number has to encode
the whole rubric with no visible decomposition.
`weight`/`scoringScale`/`priority` therefore have **no mechanical effect** on
the output.

**G4 — Strictness / priority / weight are inert hints.** `strictness: 0.8`
prints with a one-line legend but no behavioral calibration (what does 0.8
_do_?). Dimension `priority: HIGH` prints as raw text; `prioritizeByImportance`
(a display setting) is the only place priority matters, and only for UI
ordering. `weight` prints but the model is given no aggregation rule. These read
as decoration.

**G5 — No composition version / fingerprint on online + autograde paths.**
`unifiedEvaluation` has no `version`; `buildEvaluationPrompt`'s logic is
unversioned. Only the frozen **assessment** path pins `evaluatorPromptVersion`.
A change to `prompt.ts` or the system instruction silently alters _all_
practice + exam grading with no audit trail, no reproducibility, no A/B seam.

**G6 — Per-type variation is a single `if (code)`.** `audio` gets no
"transcribe, then judge pronunciation/fluency/content" framing;
`image_evaluation` gets no "describe what you see, compare to
reference/criteria" framing; `chat_agent_question` gets no "evaluate the STUDENT
turns as evidence against objectives" framing beyond the generic transcript
note. `testCases` are shown for `code` but the model is never told to _trace_
them.

**G7 — Answer-key sourcing is inconsistent across paths.** Online `scoreOne`
passes `typeData:{...question, ...questionData}` and relies on
`rubric.modelAnswer` — it does **not** merge the canonical `answerKeys` doc's
`modelAnswer`/`acceptableAnswers` into the AI prompt (it reads the key only for
the deterministic short-answer branch). Autograde relies on extraction-time
rubric.modelAnswer. Assessment folds the answer key into the rubric explicitly.
Three different provenances for "the reference answer."

**G8 — Answer precedes rubric (ordering).** The student answer (block 3) is
rendered **before** the rubric/criteria (block 4). Criteria-first generally
primes more faithful grading, and — critically for Layer-3 — **stable blocks
(system, persona, rubric) should precede the volatile answer** to maximize
provider prompt-prefix cache hits. Current order defeats both.

**G9 — Holistic max-score double-source.** `rubricBlock` prints
`holisticMaxScore` while the scoring footer prints `question.maxScore`. If they
disagree, the model sees two ceilings. No reconciliation.

**G10 — `passingPercentage` never used** in the prompt (the grader is never told
the pass bar, which can matter for `mistakeClassification` and tone).

**G11 — Two persona vocabularies.** `personaBlock` (eval) reads
`agent.identity|name` + `evaluationObjectives`; `buildAgentTurnPrompt` (turn)
reads `agent.systemPrompt|identity|name` + `rules`. Same doc, different field
precedence. Reconcile once agent-chat.ts is demoted to a legacy adapter (LLD
§13.3).

**G12 — Raw string concatenation is untestable at the block level.** No way to
unit-test "did the rubric block render levels for a hybrid rubric" without
asserting on a giant string. No typed contract between blocks.

**G13 — `holisticGuidance` leaked to the student view — ✅ FIXED & LIVE IN PROD
(2026-07-19, sdk-v1 deployed via mob-eval-fix; student.test live-verified).** ⚷
`projectRubric` (`shared/projections.ts`) deletes `modelAnswer`,
`evaluatorGuidance`, dimension `promptGuidance`, and criterion
`evaluatorGuidance` for non-authoring roles — but **not
`rubric.holisticGuidance`**. `toRubricView` includes it, so the
**student-callable** `getEvaluationConfig` returns holisticGuidance verbatim.
For a `holistic` rubric this text often _is_ the scoring guidance ("award full
marks when the essay…"). Surfaced during the Layer-1 config-display contract
(learners will render rubric config as icons). **Fix landed:**
`holisticGuidance` added to the `projectRubric` non-authoring strip list +
projection test (student omits / authoring retains) — `services` tsc clean,
focused test 5/5. Carried to prod in the next sdk-v1 cut (mob-eval-fix).
**Phase-A enrichment — OWNER RULED: NOT for v1 (deprioritized 2026-07-19).** The
learner-safe `holisticSummary` split (a student-shown holistic description
separate from ⚷ `holisticGuidance`) is **not needed for v1**; holistic rubrics
show `{scoringMode, holisticMaxScore, passingPercentage}` only, which the
current projection already supports. Kept here as a future option, not a backlog
item.

---

## 4. Proposed canonical prompt architecture

### 4.1 Typed block model (replaces the flat string)

Introduce an ordered, typed pipeline. Each block is a **pure function** of typed
inputs → a rendered fragment (or `null` to omit), tagged with `kind` and a
`stability` hint (for Layer-3 caching).

```ts
type BlockStability = "static" | "config" | "volatile";
interface PromptBlock {
  kind:
    | "system_policy" // static  — untrusted-data guard, JSON-schema contract
    | "persona" // config  — evaluator identity/rules (⚷ systemPrompt)
    | "task_framing" // config  — per-question-type instructions (§4.3)
    | "question" // config  — question text + type extras
    | "rubric" // config  — criteria(+levels)/dimensions/holistic + ⚷ modelAnswer/guidance
    | "dimensions" // config  — feedback dimensions (settings.enabledDimensions)
    | "objectives" // config  — unified objectives (§4.2)
    | "calibration" // config  — strictness mapping, few-shot anchors (§4.5)
    | "answer" // volatile — <student_answer> guarded content + media pointers
    | "scoring"; // static  — max score, partial credit, confidence, output contract
  stability: BlockStability;
  render(ctx: EvalPromptContext): string | null;
}
```

**Proposed order** (stable → volatile, addresses G8 + Layer-3 caching):
`system_policy → persona → task_framing → question → objectives → rubric → dimensions → calibration → answer → scoring`.

The composer walks the array, drops nulls, and joins. `buildEvaluationPrompt`
becomes `composeBlocks(defaultEvalBlocks, ctx)`. Each block is independently
unit-testable (fixes G12).

> **Injection boundary (authoritative refs — resolved by coordinator):** the
> prompt-construction / injection-boundary material lives in
> **`STUDENT-CONVERSATIONAL-AI-ARCHITECTURE-PLAN.md §14` (Prompt construction
> and injection boundaries)**; the equivalent in the authoritative LLD is **§12
> (Context and prompt construction)**; where they conflict, **LLD §1
> (precedence)** + **LLD §13.3 (Evaluation-Core boundary)** govern. The rule:
> platform policy (system_policy, scoring) is highest priority and **never
> tenant-authored**; developer config (persona, rubric, dimensions, objectives,
> calibration) is subordinate; the **answer block is untrusted data** inside
> `<student_answer>` and any instructions inside it are ignored. This precedence
> is asserted in the system instruction AND structurally by keeping the answer
> last.

### 4.2 Unified objectives block (fixes G1)

A single `objectives` block that merges all sources with clear labels and
provenance, deduped by id:

- `question.objectives[]` (generic) → "LEARNING OBJECTIVES the answer should
  demonstrate".
- `publicLearningObjectives[]` (assessment) → same list, id-keyed.
- `privateEvaluationObjectives[]` ⚷ (assessment answer key) → "PRIVATE
  EVALUATION OBJECTIVES (server-only): objective `<id>` maps to rubric dimension
  `<rubricDimensionId>`; evidence required: `<evidenceRequirement>`" — so each
  objective is **tied to its dimension** and its evidence bar is explicit. This
  is what makes dimension scores (§4.4) meaningful for conversational
  assessment.
- `agent.evaluationObjectives[]` stay in the **persona** block (they describe
  the grader, not the item).

### 4.3 Per-question-type eval spec (fixes G6, derived from the SSOT)

Extend `QUESTION_TYPE_REGISTRY` (or a sibling map keyed off it) with an
`evalSpec` for AI types:

```ts
interface QuestionEvalSpec {
  taskFraming: string; // "Judge the spoken response: transcribe first, then assess…"
  typeDataFields: string[]; // which prompt fields to surface (language, testCases, referenceImageUrls…)
  mediaMode?: "image" | "audio" | "none";
  extraScoring?: string; // "Trace each test case; note pass/fail per case."
}
```

One entry per AI type (`text`, `paragraph`, `code`, `audio`, `image_evaluation`,
`chat_agent_question`). The `task_framing` block renders `evalSpec.taskFraming`;
`question` block uses `evalSpec.typeDataFields`. Auto types never reach here.
Because it's derived from the registry, adding a 16th type is a single entry
(compile-error if omitted, matching the existing `satisfies` pattern).

### 4.4 Dimension-aware response schema (fixes G3, G4)

Extend `buildEvaluationResponseSchema` to emit a **`dimensionBreakdown[]`** when
the rubric is `dimension_based`/`hybrid` (derived from **`rubric.dimensions`**,
currently ignored):

```ts
dimensionBreakdown: {
  type: "array",
  items: { type:"object",
    properties: { dimensionId:STRING, dimensionName:STRING,
                  score:NUMBER, scale:NUMBER, comment:STRING },
    required: ["dimensionId","score","scale"] },
}
```

Then decide (OPEN-D2) whether the **final `score` is model-computed** (weighted
sum, model does the math) or **server-computed** from `dimensionBreakdown` +
`weight`/`scoringScale` (deterministic aggregation in `evaluateWithAi`, model
only rates). Server-side aggregation makes `weight`/`scale` mechanically real
and reproducible; model-side is simpler but opaque. **Recommendation:
server-side aggregation** for dimension_based (deterministic, auditable),
model-side for holistic.

`priority` (HIGH/MED/LOW) becomes a real signal by (a) mapping to a weight
multiplier in server aggregation and/or (b) an explicit instruction
("HIGH-priority dimensions dominate the overall judgment; a serious HIGH failure
caps the score"). `structuredFeedback` (feedback items) stays as-is and remains
keyed by dimension id for Layer-1.

### 4.5 Calibration layer (fixes G2, G4; new capability)

Three sub-parts, each independently switchable:

1. **Criterion levels as anchors** (G2): the `rubric` block renders each
   criterion's `levels[]` as a scoring ladder —
   `[5] complete proof · [3] correct approach, minor gaps · [1] attempt only`.
   This is the highest-ROI change and needs no new authoring.
2. **Strictness → behavioral mapping** (G4): translate `strictness∈[0,1]`
   (and/or a `EvaluationSettings.strictness`, OPEN-D4 on where it lives) into
   calibrated prose bands — e.g. `≤0.3` lenient ("reward partial understanding,
   forgive minor errors"), `0.4–0.7` balanced, `≥0.8` strict ("require
   precision; penalize unstated assumptions"). One canonical mapping so the
   number is reproducible.
3. **Few-shot / exemplars** (OPEN-D5): optional per-**rubric-preset** anchor
   examples (a graded sample answer + its score + why). Deferred by default —
   build the hook, populate for one preset as a spike, measure calibration lift
   before scaling.

### 4.6 Versioning & fingerprint (fixes G5)

- Give `unifiedEvaluation` a `version` (like the conversation prompts).
- Add a **composition version** constant in the block module
  (`EVAL_COMPOSITION_VERSION`) bumped on any block/template change.
- Compute a **fingerprint** = hash(composition version + system-instruction
  version + enabled block kinds + config `sourceVersions[]`). Freeze it
  alongside **every** graded result (not just assessment), reusing
  `freezeLevelupEvaluationConfig`'s `sourceVersions` pattern. Enables
  reproducibility, drift detection, and A/B on the online path.

### 4.7 Answer-key normalization (fixes G7)

One helper `resolveReferenceAnswer(question, rubric, answerKey)` that yields a
single `{modelAnswer?, acceptableAnswers?, testCases?, guidance?}` from a
documented precedence (answer key ⚷ > rubric.modelAnswer >
typeData.modelAnswer), used by **all three** paths so "the reference answer" has
one provenance. Online path merges the `answerKeys` doc; assessment keeps its
frozen fold; autograde keeps extraction-time rubric.

### 4.8 What stays exactly as-is (don't break)

Gemini schema subset; the `<student_answer>` untrusted guard; `answer.note`
outside the guard; media-as-storagePath (Layer-3 inlines bytes); cost stripping;
confidence→HITL routing; the frozen assessment lease/idempotency machinery;
deterministic + exact-match short-circuits before AI.

---

## 5. Contracts with the other layers

### 5.1 → Layer-3 (transport / model / caching) — _agree before either builds_

Layer-2 **emits** (per call):
`{ systemInstruction, promptBlocks[] (or composed string), responseSchema, images[] (storagePath+mime), modelHints{model?, temperature?, modelPolicyId?}, promptVersion, compositionFingerprint }`.
Layer-3 **owns** the provider call, ret/caching, cost. Two asks on Layer-3:

- **Prefix caching:** honor block `stability` ordering (static/config first,
  volatile answer last) so shared prefixes (system + persona + rubric) cache
  across a batch of learners on the same item.
- **Model policy:** `evaluation.quality` etc. resolve in Layer-3; Layer-2 only
  forwards the frozen id.

### 5.2 → Layer-1 (mobile feedback UI) — _what we emit must render_ — CONTRACT AGREED 2026-07-19

**(a) Feedback payload — student-facing = `StoredEvaluation`, NOT the fuller
`UnifiedEvaluationResult`.** SSOT:
`packages/domain/src/entities/content/stored-evaluation.ts`. Fields:
`score/maxScore/correctness/percentage`,
`strengths[]/weaknesses[]/missingConcepts[]`,
`summary?{keyTakeaway,overallComment}`, `mistakeClassification?`, `confidence?`,
`structuredFeedback?{<dimId>:FeedbackItem[]}`
(`FeedbackItem={severity(critical|major|minor),message,suggestion?,dimension}`),
`rubricBreakdown?[]` (`{criterionId?,criterionName,score,maxScore,comment?}`).
Cost/model/tokens/`gradedAt`/`dimensionsUsed` are **not** in the student subset
— `structuredFeedback` keys _are_ the dimensions-used set.

- **No renames/drops planned.** One **proposed addition** pending owner **D3**:
  `dimensionBreakdown[]` = `{dimensionId, dimensionName, score, scale, comment}`
  (per-dimension scores — today they evaporate, gap G3). Layer-1 to leave room
  for a per-dimension score UI; shape locked after D3.
- `displaySettings{showStrengths, showKeyTakeaway, prioritizeByImportance}`
  applied **server-side** (`toStoredEvaluation`): `strengths[]`/`summary` may
  arrive empty/omitted by config — render defensively.
- `structuredFeedback`/`dimensionBreakdown` keys are dim **ids**; labels come
  from the config view's `enabledDimensions` (join on id). `dimensionBreakdown`
  carries `dimensionName` inline for convenience.

**(b) Config-display read ("how you'll be judged" icons) — NO new backend
needed.** Use the existing student-callable `v1.levelup.getEvaluationConfig`
(`{spaceId, itemId?} → {config:{agent,rubric,settings,provenance}}`; autograde
twin `v1.autograde.getEvaluationConfig`). Gate `space.read` = `any-authed`;
role-projects automatically (`authoring=false` for students strips all ⚷ secrets
— the projection is the guarantee).

- **Student-safe:** rubric
  `{scoringMode, criteria[]{id,name,description,maxScore,weight,levels[]{label,description,score}}, dimensions[]{id,name,description,priority,weight,scoringScale}, passingPercentage, showModelAnswer}`;
  settings `{enabledDimensions[…same dim shape], displaySettings}`; agent
  `{id,type,name,publicDescription,identity,openingMessage,strictness,feedbackStyle,…}`.
- **Never student-safe (stripped):** `modelAnswer`, `evaluatorGuidance`,
  dimension `promptGuidance`, criterion `evaluatorGuidance`, `confidenceConfig`,
  agent `systemPrompt/rules/evaluationObjectives`, and
  `privateEvaluationObjectives` (answer-key ⚷ — never in this view at all).
- **Objectives icons** come from the **item payload**, not this callable:
  `publicLearningObjectives[]{id,label}` (chat_agent_question, learner-safe by
  design) / `typeData.objectives[]` (generic AI types).
- **⚠️ G13 caveat:** `holisticGuidance` is currently **not** stripped — Layer-1
  should not surface it until the projection is patched (see G13).

### 5.3 In-flight collision avoidance

`evaluation/agent-chat.ts` and the conversation-runtime prompts are owned by
conv-core / release-train. Layer-2 will **not** modify the interviewer turn-loop
prompt; §4 changes are scoped to `evaluate.ts` / `prompt.ts` /
`response-schema.ts` / `resolve.ts` and a new per-type spec. Any `models.ts`
touch is Layer-3.

---

## 6. Open decisions for the owner

| #       | Decision                                                                | Options                                                                        | Lean                                     |
| ------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------- |
| **D1**  | Block ordering: rubric before answer?                                   | (a) keep answer-first (b) **criteria-first** (helps grading + caching)         | **(b)**                                  |
| **D2**  | Dimension-based final score                                             | (a) model-computed (b) **server-aggregated from dimensionBreakdown + weights** | **(b)** for dimension_based              |
| **D3**  | Capture per-dimension scores at all?                                    | (a) feedback-only (status quo) (b) **add `dimensionBreakdown[]`**              | **(b)**                                  |
| **D4**  | Where does `strictness` live?                                           | agent only / **also `EvaluationSettings`** / rubric                            | confirm — drives the calibration mapping |
| **D5**  | Few-shot exemplars                                                      | build now / **hook now, populate 1 preset as spike** / defer entirely          | **spike**                                |
| **D6**  | Merge canonical answer key into online eval prompt (G7)                 | yes / no                                                                       | **yes** (parity with assessment)         |
| **D7**  | Version + fingerprint every result, not just assessment (G5)            | yes / no                                                                       | **yes**                                  |
| **D9**  | Give the **evaluator persona** a role in autograde (today `agent:null`) | keep none / allow a default rigor persona                                      | discuss                                  |
| **D10** | `priority` semantics                                                    | prose-only / **weight multiplier + cap rule**                                  | **weight+cap**                           |

> **D8 resolved** by coordinator (injection-boundary reference →
> ARCHITECTURE-PLAN §14 / LLD §12, governed by LLD §1 + §13.3 — see §4.1).
> Dropped from the owner list; **9 decisions** remain (D1–D7, D9, D10).
> Numbering preserved to keep §4/§7 cross-references stable.

---

## 7. Proposed build sequence (after sign-off — NOT started)

1. **Phase A (low-risk, high-ROI, behavior-improving):** inject criterion
   `levels` (G2), unified objectives block incl. public/private assessment
   objectives (G1), per-type task framing (G6), answer-key normalization (G7).
   Pure prompt enrichment; response schema unchanged.
2. **Phase B (typed refactor):** extract the block model (§4.1) behind the exact
   same output for the default set (golden-string test to prove byte-parity
   first, then reorder per D1).
3. **Phase C (schema evolution):** `dimensionBreakdown` + server aggregation
   (D2/D3) + strictness/priority mapping (D4/D10). Coordinated with Layer-1 (new
   field) + Layer-3 (unchanged).
4. **Phase D (versioning):** composition version + fingerprint frozen everywhere
   (D7); calibration few-shot hook (D5).

Each phase is independently shippable and reversible.
