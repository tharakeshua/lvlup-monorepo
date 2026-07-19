# Student Conversational AI Architecture and Mobile-First Plan

**Status:** Discussion draft — architecture is not yet approved  
**Date:** 2026-07-18  
**Scope:** Student mobile first; shared foundation for tutor chat, contextual
question help, and agent-assessed chat questions  
**Implementation:** No implementation or production-data changes are authorized
by this document

## 1. Executive decision

The current chat-agent-question feature is **not production-ready end to end on
student mobile**.

The local branch now has meaningful backend work: agent configuration, a bounded
tool-like turn, transcript evaluation, progress writes, and a mobile chat
component. Targeted tests pass. However, the deployed academy has no
`chat_agent_question` content, the mobile client does not honor the server
lifecycle or evaluation result, reconnect/resume is incomplete, and the current
finalization path can evaluate and apply progress twice.

The proposed direction is one product-owned **Conversation Runtime** with three
explicitly separated modes:

1. `tutor` — course or academy tutoring.
2. `question_help` — contextual help while answering any supported question,
   including AI-graded questions.
3. `agent_assessment` — the conversation itself is the assessed submission.

They should share transport, session/message storage, turn execution, context
retrieval, safety, telemetry, and a reusable mobile conversation UI. They must
not share hidden context, tool permissions, memory policy, completion policy, or
grading authority.

For the first version, use a small deterministic runtime owned by Subhang
Academy behind the existing provider gateway. Do not make LangGraph, Google ADK,
Claude Agent SDK, or OpenAI Agents SDK the system of record yet. Add a framework
adapter boundary so a workflow engine can be introduced when the product
genuinely needs branching, resumable multi-agent workflows, or human approval
steps.

## 2. Goals

- Make 4–5 chat-agent questions work reliably from authoring through mobile
  completion, evaluation, submission, and progress.
- Use the same underlying architecture for tutoring and contextual help without
  conflating their permissions or grading behavior.
- Preserve provider choice and keep Firestore/product records authoritative.
- Make every user turn idempotent, resumable, observable, and safe to retry.
- Store an immutable assessed submission separately from the mutable
  conversation and derived learner progress.
- Keep hidden rubrics, model answers, evaluator instructions, and private
  observations out of learner-visible prompts and APIs.
- Allow the conversational agent to gather evidence without making it the
  authoritative grader.

## 3. Non-goals for the first release

- General-purpose autonomous agents with filesystem, shell, arbitrary HTTP, or
  browser access.
- Multi-agent delegation or agent-to-agent conversation.
- Long-term learner memory in assessments.
- Real-time token streaming before the lifecycle and retry model is correct.
- Cross-provider model routing based solely on free-form model names.
- Replacing the existing Evaluation Core.
- Web implementation before mobile acceptance is complete.

## 4. What exists today

### 4.1 Local backend

The current local backend can:

- detect a `chat_agent_question`;
- load an agent and evaluation configuration;
- prompt the model with question, persona, objectives, rubric dimensions, and
  history;
- expose `record_observation` and `end_conversation` function declarations;
- parse function calls;
- persist messages, turn counts, observations, and session status;
- auto-evaluate the transcript when the conversation ends;
- write the evaluation to the session and apply learner progress.

The Evaluation Core uses structured output and a stronger final grading pass.
This is the right separation in principle: the interviewer/tutor gathers
evidence, while the evaluator makes the final judgment.

The current tool handling is not yet a complete agent loop. The application
parses model function calls, but it does not execute a validated tool, send its
result back to the same conversation, and continue the bounded loop. A separate
follow-up generation is used when a tool call has no learner-facing text.

### 4.2 Local mobile app

The mobile app has a `ChatAgentQuestion` component and sends messages through
the shared callable. It renders a transcript, composer, and client-derived turn
count.

It does not yet:

- react to server-provided `conversationEnded`;
- render or retain the returned final `evaluation`;
- recover observations or evaluation on session reload;
- retain the backend `sessionId` in the item answer;
- reliably resume the same conversation after navigation or process restart;
- show a recoverable send error or retry state;
- prevent a second submission/evaluation through the normal **Check answer**
  flow;
- use a true per-turn activity status for the typing indicator.

### 4.3 Local test evidence

The following targeted suites pass in the current checkout:

- services chat-agent, chat, and Evaluation Core tests: **30/30**;
- AI gateway tests: **10/10**;
- SDK v1 adapter tests: **5/5**;
- mobile-student TypeScript check.

These prove local units and types, not deployed end-to-end behavior.

### 4.4 Production read-only audit

For `tenant_subhang`, the live academy currently contains:

- 12 spaces;
- 191 nested story points;
- 3,563 nested content items;
- **0** `chat_agent_question` items;
- **0** chat sessions in the v2 area;
- 4 v2 agents, but no complete system prompts, rules, objectives, or turn
  policies;
- agent model overrides using `gpt-4`, while the current provider implementation
  is Gemini-only.

System Design currently has four story points and 32 items, with no chat-agent
question.

No production writes or mutations were made during this audit.

## 5. Critical gaps

### P0 — must be resolved before seeding content

1. **Canonical data path**
   - Production functions use a `v2_` collection prefix.
   - Live content items are nested in the unprefixed hierarchy.
   - The item repository uses a tenant-filtered collection-group query that can
     cross those roots.
   - Duplicate records could be selected non-deterministically.
   - Decide and enforce one canonical hierarchy before creating new content.

2. **Question and agent schema**
   - The domain prompt schema exposes `agentInstructions`, `maxTurns`, and
     `modelAnswer`.
   - Teacher authoring uses `agentId`, `objectives[]`, starters, max turns, and
     evaluation guidance.
   - The adapter joins objectives into `agentInstructions` and drops the formal
     `agentId` relationship.
   - Public learning goals, private evaluation objectives, persona, scenario,
     and evaluator settings need distinct fields.

3. **Server-authoritative lifecycle**
   - The mobile UI derives completion from local turn count.
   - The server can end earlier and then rejects another message.
   - Server status and completion must be the only authority.

4. **Exactly-once finalization**
   - Backend completion currently grades and applies progress.
   - The enclosing content screen can call `recordItemAttempt`, grade again, and
     apply progress again.
   - One finalization transaction/lease must create one submission and one
     progress update.

5. **Idempotent turns**
   - A network retry can duplicate learner messages or model turns.
   - Every turn needs a stable `clientMessageId` and server-side idempotency
     record.

6. **Resume and recovery**
   - Session identity, status, observations, and evaluation are not represented
     consistently in persisted answers and read APIs.
   - A learner must be able to leave, reconnect, and continue or view the
     completed result.

7. **Provider/model validation**
   - Model identifiers must be selected from provider-specific configuration.
   - A Gemini request must never receive an OpenAI model name.

8. **Immutable assessed submission**
   - Progress currently stores only a best-score rollup.
   - The evaluated transcript, versioned configuration, and final evaluation
     require an immutable submission artifact.

### P1 — required for a robust first release

- Proper function execution loop with validation, authorization, timeout,
  bounded output, result injection, and audit.
- Structured role/content messages instead of serializing all learner text into
  one prompt string.
- Stronger prompt-injection boundaries and safe encoding of learner-controlled
  transcript data.
- Correct tutor context contract; a standalone tutor cannot rely on empty
  item/story-point identifiers.
- Context-scoped session lists rather than selecting the most recent chat
  globally.
- Recoverable mobile send states and true turn-scoped typing status.
- Evaluation and agent versions frozen at session start/finalization.
- End-to-end emulator and mobile tests for retry, resume, early completion, max
  turns, and one-time grading.

## 6. Unified conversation modes

| Concern                     | Tutor                                             | Question help                                   | Agent assessment                                                      |
| --------------------------- | ------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| Primary outcome             | Explain and teach                                 | Help the learner progress on the current answer | Collect an assessable conversational response                         |
| Context                     | Course/space, selected materials, learner request | Learner-visible item plus current draft/attempt | Question, scenario, public goals, private objectives and rubric       |
| Hidden answer/rubric access | No                                                | No                                              | Evaluator only; interviewer gets objectives, not model-answer leakage |
| Cross-session memory        | Optional, explicit, sanitized                     | None                                            | None                                                                  |
| Writes progress             | No                                                | No                                              | Only during finalization                                              |
| Authoritative grader        | None                                              | None                                            | Separate Evaluation Core                                              |
| Completion                  | Learner ends or inactivity policy                 | Learner closes help                             | Learner finishes, agent recommends readiness, or hard limit           |
| Transcript role             | Learning history                                  | Attempt support metadata                        | The submitted answer                                                  |

The mode must be immutable for the life of a session. A tutor session cannot be
converted into an assessment submission.

## 7. Proposed runtime architecture

```text
Mobile Conversation UI
        |
        v
Conversation API
  start / send / finish / get / list
        |
        v
Conversation Runtime (deterministic state machine)
  - authorization and mode policy
  - idempotency and turn ledger
  - context builder / retrieval
  - prompt + agent version resolution
  - bounded tool dispatcher
  - provider gateway
  - safety and telemetry
        |
        +------------------+
        |                  |
        v                  v
Conversation Store     Finalization Service
sessions/messages/     immutable submission
turns/observations     -> Evaluation Core
                       -> progress rollup
```

### Ownership boundaries

- **Conversation Runtime:** orchestration and lifecycle.
- **Provider gateway:** model-specific request/response translation, usage,
  caching metadata, and provider errors.
- **Tool dispatcher:** validates and executes a small product-owned allowlist.
- **Evaluation Core:** authoritative grading from a frozen submission.
- **Repositories:** canonical durable state.
- **Mobile client:** renders server state; it does not infer completion or
  grading.

## 8. Conversation state machine

```text
active
  -> awaiting_agent
      -> active
      -> ready_to_finish
      -> failed_recoverable
  -> finalizing
      -> completed
      -> failed_recoverable
  -> abandoned
```

Rules:

- Only one turn may be `awaiting_agent` per session.
- A duplicate `clientMessageId` returns the existing turn result.
- `recommend_completion` moves the session to `ready_to_finish`; it does not
  grade.
- A hard maximum can force `ready_to_finish`.
- `finishConversation` acquires a finalization lease and is safe to retry.
- `completed` sessions are immutable except for operational redaction/retention
  workflows.
- A failed model call retains the learner message and a retryable turn state; it
  never silently duplicates it.

### Completion recommendation

Recommended behavior:

- The agent may signal that enough evidence has been gathered.
- The learner sees a clear **Finish interview** action.
- The learner may finish before the recommendation, with a confirmation about
  incomplete coverage.
- At the hard maximum, the app transitions to finalization without accepting
  another turn.

This is more predictable than allowing a model tool call to unilaterally end the
learner's UI.

## 9. Data model

Names are conceptual and should follow the final repository convention.

### `conversationSessions/{sessionId}`

- tenant, learner, and immutable `mode`;
- status and lifecycle timestamps;
- typed context:
  - tutor: space/course/material scope;
  - question help: item and attempt;
  - assessment: item and attempt number;
- active `agentId` and frozen `agentVersion`;
- prompt, policy, toolset, rubric, and evaluation-setting version references;
- turn counters and hard limits;
- `readyToFinishReason`;
- finalization lease/status;
- summary pointer for long tutor conversations;
- latest safe client projection.

### `conversationSessions/{sessionId}/messages/{messageId}`

- monotonically increasing sequence;
- role: learner, agent, tool, or system-event;
- typed content blocks;
- `clientMessageId`, `turnId`, and delivery status;
- created/accepted/completed timestamps;
- redaction and moderation metadata.

Store learner-visible messages and required tool records, but never private
chain-of-thought.

### `conversationSessions/{sessionId}/turns/{turnId}`

- idempotency key and lifecycle status;
- provider/model;
- prompt, agent, context, and toolset versions;
- bounded tool invocations and sanitized results;
- input/output/cached-token counts;
- latency, retry count, error category, and trace ID.

### Private evidence

Store assessment observations in a server-only collection or field:

- objective/dimension ID;
- evidence reference to message sequence;
- confidence and notes;
- recorder and version.

Do not return raw private evaluator notes or provisional numeric scores to the
learner.

### `itemSubmissions/{submissionId}`

- immutable learner/item/session/attempt identity;
- ordered transcript snapshot or immutable reference plus hash;
- question, agent, prompt, rubric, evaluator, and settings versions;
- finalization reason;
- evaluation status and structured result;
- provider/model/usage metadata;
- submitted and graded timestamps.

Learner progress is a derived rollup of submissions. The progress record must
not be the only assessment record.

### Learner memory

If introduced later, learner memory must be:

- separate from raw chat history;
- tutor-only;
- opt-in and inspectable/deletable;
- sanitized and purpose-limited;
- never injected into an assessment.

## 10. API surface

### `startConversation`

Input:

```ts
{
  mode: "tutor" | "question_help" | "agent_assessment";
  context: TutorContext | QuestionHelpContext | AgentAssessmentContext;
  idempotencyKey: string;
}
```

The server resolves authorization, canonical records, configuration versions,
opening message, and any existing resumable session.

### `sendConversationTurn`

Input:

```ts
{
  sessionId: string;
  clientMessageId: string;
  text: string;
  media?: ConversationMedia[];
}
```

Response:

```ts
{
  session: ConversationClientProjection;
  acceptedMessage: ConversationMessage;
  agentMessages: ConversationMessage[];
  turn: {
    id: string;
    status: "completed" | "failed_recoverable";
  };
}
```

### `finishConversation`

Input contains `sessionId` and an idempotency key. For assessment mode it
creates or returns the one immutable submission, invokes evaluation, applies
progress once, and returns the final client result.

### Reads

- `getConversation(sessionId)`
- `listConversations({ mode, context, status, cursor })`
- optional `retryConversationTurn(turnId)` if resending the same request is not
  sufficient
- `abandonConversation(sessionId)`

The existing `sendChatMessage` can be kept temporarily as an adapter, then
deprecated.

## 11. Agent configuration model

Separate configuration by concern:

```ts
type ConversationAgentVersion = {
  id: string;
  version: number;
  mode: ConversationMode;
  name: string;
  publicDescription?: string;
  persona: string;
  behaviorRules: string[];
  openingMessage?: string;
  conversationStarters?: string[];
  modelPolicyId: string;
  toolsetVersionId: string;
  safetyPolicyId: string;
  completionPolicy: CompletionPolicy;
};
```

Assessment question configuration:

```ts
type AgentAssessmentPrompt = {
  scenario: string;
  publicLearningObjectives: string[];
  privateEvaluationObjectives: EvaluationObjective[];
  interviewerAgentVersionId: string;
  rubricId: string;
  evaluationSettingsId: string;
  minTurns?: number;
  maxTurns: number;
};
```

Do not overload `agentInstructions` with objectives or show private evaluator
instructions in the learner UI.

## 12. Tools and agent turns

The first-release tool allowlist should be small and product-specific.

### Shared tool-runtime requirements

- Zod/JSON-schema argument validation.
- Explicit mode, tenant, learner, and resource authorization.
- Timeouts and bounded result sizes.
- No arbitrary URL, filesystem, shell, database, or callable execution.
- Sanitized tool results.
- Persisted invocation/result audit.
- Maximum model/tool steps per learner turn.
- Tool result returned to the model before it produces the final learner-facing
  response.

### Tutor tools

- `retrieve_course_context`
- `get_learner_visible_progress_summary`
- `recommend_learning_content`
- optional approved calculator/glossary tools

### Question-help tools

- `retrieve_item_context` using only the learner-visible projection
- `retrieve_course_context`
- optional hint-state tool that records hint use without evaluating the answer

Question help must never fetch a model answer, hidden rubric, private objective,
or previous evaluator reasoning.

### Agent-assessment tools

- `record_evidence({ objectiveId, messageRefs, note, confidence })`
- `recommend_completion({ reason, coveredObjectiveIds, missingObjectiveIds })`
- optional constrained domain tools if the question explicitly assesses their
  use

The assessment agent does not have a `write_score` or `update_progress` tool.

## 13. Context, history, and memory

### Assessment

- Keep the full short transcript for the expected 4–10 turns.
- Do not summarize or compact it before grading.
- Do not use cross-session memory.
- Freeze the exact transcript and configuration versions at submission.

### Question help

- Include the learner-visible item, current draft/attempt, selected course
  context, and this help session.
- Do not include unrelated learner history.
- Store that help was used as attempt metadata if product analytics require it.

### Tutor

- Retain the full original history for audit and learner access.
- Send recent messages plus a versioned summary after a configured threshold.
- Retrieve relevant course passages instead of stuffing the entire course into
  every prompt.
- Treat any future learner memory as separate, opt-in data.

## 14. Prompt construction and injection boundaries

Build provider messages from typed blocks:

1. platform safety and mode policy;
2. frozen agent persona and rules;
3. learner-readable retrieved context;
4. private assessment objectives when allowed;
5. role-preserving conversation history;
6. current learner message.

Learner-controlled content and retrieved documents must be marked as untrusted
data, encoded safely, and never interpolated as pseudo-system instructions.
XML-like wrappers are insufficient unless delimiters are escaped. Tool results
also require sanitization.

Store prompt-template versions, not the full secret prompt in client-readable
records.

## 15. Context caching and cost

Use caching as an optimization, never as session state.

- Put stable content first: platform policy, agent version, question version,
  tool schemas, and stable course context.
- Put conversation history and the newest learner message last.
- Key explicit caches by provider, model, prompt version, agent version,
  question/context version, toolset version, and locale.
- Use explicit caches only when the stable prefix exceeds provider thresholds
  and will be reused enough to justify lifecycle complexity.
- Otherwise rely on provider implicit caching where available.
- Capture input, output, and cached-token usage per turn.
- Invalidate by version changes rather than mutable timestamps.

The repository should migrate from the older `@google/generative-ai` package to
Google's current `@google/genai` SDK before relying on current cache/chat
capabilities.

## 16. Evaluation architecture

The conversational agent and authoritative evaluator remain separate.

### During the conversation

- The interviewer asks, probes, and records objective-linked evidence.
- Observations are provisional evidence only.
- The learner may see neutral coverage/turn progress, not private notes or
  provisional scores.

### At finalization

1. Acquire the session's finalization lease.
2. Freeze and persist the immutable submission.
3. Build the evaluator input from the frozen transcript and versioned rubric.
4. Run structured evaluation at deterministic settings.
5. Validate the response schema and score bounds.
6. Persist the evaluation on the submission.
7. update progress exactly once using the submission ID as the idempotency key;
8. mark the session completed and return the learner-safe result.

If evaluation fails, the submission remains in a retryable `grading_failed` or
`grading_pending` state. The transcript must not be lost and the learner must
not be asked to repeat the interview.

### Evaluation settings

Version:

- rubric dimensions and weights;
- score scale and pass/mastery thresholds;
- evaluator prompt template;
- evaluator model policy;
- strictness and evidence requirements;
- feedback format and learner-visible fields;
- retry/fallback policy.

## 17. Mobile experience

Build one reusable `ConversationScaffold` with mode-specific composition.

### Shared UI

- context header and clear mode label;
- opening message and optional conversation starters;
- role-accessible transcript;
- composer with disabled/sending/failed/retry states;
- per-turn agent activity indicator;
- offline and reconnect state;
- resume from the authoritative server session;
- explicit completion/finalization state;
- final learner-safe result;
- accessibility labels, dynamic type support, and keyboard-safe layout.

### Tutor

- full-screen, persistent conversation;
- visible course/material scope;
- session/history picker scoped by course;
- source/reference cards where the answer used course retrieval.

### Question help

- bottom sheet or full-screen view using the same scaffold;
- current question context remains visible;
- returning to the item preserves the learner's draft;
- clear language that help is guidance, not grading.

### Agent assessment

- interview/scenario card before starting;
- visible public objectives;
- turn range or neutral progress;
- explicit **Finish interview** action;
- confirmation if finishing before recommended coverage;
- hard-limit handling;
- a **Finalizing** state that cannot be double-submitted;
- final rubric feedback from the immutable submission;
- no generic **Check answer** action after backend finalization.

## 18. Framework decision

### Recommended first-release choice

Use a thin product-owned TypeScript runtime with:

- an explicit state machine;
- the Conversation Store as the durable authority;
- a provider-neutral model interface;
- a bounded tool dispatcher;
- a framework adapter interface for future migration.

This fits the near-term workflow: one learner turn, zero or a few validated tool
steps, one response, and a separate final evaluator. It avoids introducing a
second session/checkpoint database before the product model is stable.

### LangGraph

Best fit when the runtime develops branching graphs, resumable multi-agent
workflows, human approval, or long-running jobs. Its persistence model includes
thread-scoped checkpoints and a cross-thread store. Adopting it now would
require deciding how its checkpoints relate to Firestore conversation and
submission records.

Decision: keep as the leading future workflow-engine candidate, not the
first-release system of record.

### Google ADK

Strong future fit for a Gemini/GCP-heavy stack: TypeScript agents, tools, graph
workflows, sessions, state, and memory. The current TypeScript quickstart
requires a newer Node runtime than the repository's Firebase Functions Node 20
target, so adoption likely means a runtime upgrade or a separate Cloud Run
service.

Decision: evaluate after the core conversation contracts are stable and
deployment/runtime strategy is decided.

### Claude Agent SDK

Claude Agent SDK exposes the Claude Code-style agent loop and powerful built-in
filesystem, shell, and web capabilities. Its default local sessions are
process/filesystem oriented. Those capabilities and storage semantics are a poor
default for a tightly permissioned mobile-learning callable.

Decision: do not use it as the core assessment/tutor runtime. If Claude is
added, implement a provider adapter or use Anthropic's bounded tool-runner
pattern behind the product runtime.

### OpenAI Agents SDK

It provides an agent loop, tools, guardrails, sessions, and tracing, including
custom session storage. It is capable, but would make the orchestration layer
OpenAI-centric and overlap with the existing gateway, session model, and
telemetry.

Decision: keep as a provider-specific adapter option if OpenAI becomes a primary
provider.

## 19. Proposed first story point

After the architecture and data-path decision are approved, add one practice
story point to System Design.

Working title: **Interactive System Design Interview: URL Shortener**

Five agent-assessed questions:

1. **Clarify requirements and SLAs**
   - identify functional scope, scale, latency, availability, and consistency
     needs;
   - 4–5 conversational turns.

2. **Estimate capacity**
   - traffic, read/write ratio, storage, bandwidth, and key assumptions;
   - 4–6 turns.

3. **Design APIs and data model**
   - endpoints, identifiers, schema, collision strategy, and expiry;
   - 4–6 turns.

4. **Choose caching and consistency behavior**
   - cache topology, invalidation/TTL, hot keys, read path, and trade-offs;
   - 4–6 turns.

5. **Handle failures and operate the system**
   - bottlenecks, regional failure, replication, observability, abuse, and
     evolution;
   - 4–6 turns.

Suggested persona: a supportive senior systems interviewer who asks one focused
follow-up at a time, challenges unsupported assumptions, does not reveal an
answer, records evidence against explicit objectives, and recommends completion
when sufficient evidence is present.

Each question needs:

- public objectives;
- private evaluation objectives;
- weighted rubric;
- opening prompt and optional starters;
- minimum/maximum turn policy;
- versioned interviewer agent;
- versioned evaluator settings;
- authored reference/evidence guidance;
- expected safe/tool policy;
- mobile acceptance fixtures.

## 20. Implementation sequence after approval

### Phase 0 — decisions and canonical data

- Approve mode boundaries and framework choice.
- Select the canonical Firestore hierarchy and remove cross-root ambiguity.
- Define versioned agent/question/evaluation schemas.
- Define learner-visible versus server-only projections.

### Phase 1 — conversation foundation

- Add conversation/session/message/turn repositories.
- Add idempotent start/send/get/list APIs.
- Implement state machine, turn lease, and recovery.
- Implement provider/model validation and typed message conversion.
- Add bounded tool dispatcher and audit.

### Phase 2 — assessment finalization

- Add immutable submission model.
- Make finalization exactly once.
- Connect the existing Evaluation Core to frozen submissions.
- Make progress a submission-derived idempotent rollup.
- Remove the second generic attempt path for agent assessment.

### Phase 3 — mobile assessment experience

- Build the reusable conversation scaffold.
- Make server lifecycle authoritative.
- Add resume, error/retry, early finish, hard limit, finalizing, and result
  states.
- Replace the generic answer-check flow for agent assessment.
- Add analytics and accessibility.

### Phase 4 — authoring and seed content

- Update teacher authoring to the approved schema.
- Validate agent, objectives, rubric, limits, and evaluator configuration.
- Create the five System Design interview items.
- Verify tenant/course/story-point publication and mobile visibility.

### Phase 5 — quality gate

- Unit tests for state transitions, idempotency, permissions, tools, and
  finalization.
- Emulator integration tests across authoring, conversation, submission, and
  progress.
- Mobile tests for retry, resume, offline recovery, and exactly-once completion.
- Safety and prompt-injection red-team fixtures.
- Controlled staging evaluation calibration against human-scored sample
  transcripts.
- Production canary with cost, latency, failure, and score-distribution
  monitoring.

### Phase 6 — tutor and contextual help

- Move the existing tutor UI onto the shared runtime/scaffold.
- Add correct course/material context and scoped history.
- Add `question_help` for supported AI-graded questions.
- Keep mode-specific tools, prompts, and memory policies separate.

## 21. Mobile-first acceptance criteria

The first story point is complete only when:

- all 4–5 questions are published and visible to an authorized student;
- the student can start, leave, resume, and complete each conversation;
- every learner turn is safe to retry and appears once;
- agent activity, errors, retry, and offline state are understandable;
- server status controls completion;
- the agent cannot reveal hidden rubrics/model answers through its allowed
  context or tools;
- early finish, recommended finish, and hard maximum all behave
  deterministically;
- one completion creates exactly one immutable submission;
- one submission creates at most one progress application;
- the final evaluation is recoverable after navigation/relogin;
- the transcript and exact configuration versions are auditable;
- evaluation output conforms to the rubric schema and score bounds;
- no assessment memory leaks across attempts or learners;
- provider/model misconfiguration fails safely before a billable turn;
- emulator/mobile E2E tests cover the happy path and failure paths;
- production telemetry reports usage, cached tokens, latency, retries, tools,
  grading failures, and finalization duplication attempts.

## 22. Decisions to finalize with the product owner

Recommended defaults are shown first.

1. **Runtime**
   - Recommend: product-owned runtime now, with a framework adapter; reassess
     LangGraph/ADK later.
   - Alternative: adopt a framework immediately and accept its extra
     persistence/deployment decisions.

2. **Assessment completion**
   - Recommend: agent recommends completion, learner explicitly finishes, hard
     max forces finalization.
   - Alternative: agent may end the assessment automatically.

3. **During-interview feedback**
   - Recommend: show turn/neutral coverage progress only; reveal rubric scores
     after finalization.
   - Alternative: expose provisional dimension progress, with risk of gaming and
     misleading interim scores.

4. **Tutor memory**
   - Recommend: no cross-session memory in v1; add explicit opt-in learner
     memory later.
   - Alternative: enable summarized tutor memory in the first release.

5. **Pilot content**
   - Recommend: System Design → URL Shortener → five linked interview questions.
   - Alternative: select another course/problem or make the five questions
     independent scenarios.

6. **Deployment location for a future framework**
   - Recommend: keep the first release in existing functions; evaluate Cloud Run
     if ADK/LangGraph or longer-running turns are adopted.
   - Alternative: move the new runtime to Cloud Run immediately.

## 23. References

- Existing local Evaluation Core plan:
  `docs/api-design/AI-EVALUATION-CORE-PLAN.md`
- Existing earlier vertical audit:
  `docs/analysis/agentic-chat-question-vertical.md`
- [LangGraph persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [Google ADK](https://adk.dev/)
- [Google ADK TypeScript quickstart](https://adk.dev/get-started/typescript/)
- [Google ADK sessions and memory](https://adk.dev/sessions/)
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Anthropic tool runner](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner)
- [OpenAI Agents SDK for TypeScript](https://openai.github.io/openai-agents-js/)
- [OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-js/guides/sessions/)
- [Gemini context caching](https://ai.google.dev/gemini-api/docs/caching)
- [Google Gen AI JavaScript/TypeScript SDK](https://googleapis.github.io/js-genai/)
- [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling)

## 24. Decision log

| Date       | Decision                                                                                                                          | Status            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 2026-07-18 | Use one underlying conversation architecture for tutor, contextual question help, and agent assessment, with strict mode policies | Proposed          |
| 2026-07-18 | Mobile student is the first implementation surface                                                                                | Confirmed by task |
| 2026-07-18 | Do not implement until architecture and plan are discussed and approved                                                           | Confirmed by task |
| 2026-07-18 | Keep the final evaluator separate from the conversational agent                                                                   | Proposed          |
| 2026-07-18 | Store immutable submissions separately from sessions and progress                                                                 | Proposed          |
| 2026-07-18 | Use a product-owned runtime before adopting a full agent framework                                                                | Proposed          |
