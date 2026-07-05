# Vertical Analysis — Agentic / Chat-Agent Questions

**Scope:** Questions/experiences where an AI agent _chats_ with the student to
complete an objective (multi-turn), then scores — versus single-shot Q&A.
**Type:** Read-only architecture brief. No code changed. **Date:** 2026-07-04

---

## TL;DR

The platform has the **plumbing** for chat and the **design scaffolding** for
agentic questions, but the **agentic brain does not exist yet**. Concretely:

- ✅ A working chat-message pipeline (send → LLM → persist → read-back → live
  stream) with SDK hooks and UI renderers in both mobile-student and
  student-web.
- ✅ A `chat_agent_question` **item type** (schema stub) and a rich `saveAgent`
  **contract** (tutor/evaluator agent with `evaluationObjectives`,
  `maxConversationTurns`, `strictness`, `systemPrompt`).
- ❌ **No agent loop** — `sendChatMessage` is one user message → one LLM reply.
  No objectives injected, no completion detection, no tool calls.
- ❌ **No objective-scoring** — a `chat_agent_question` submission is _not_
  graded against objectives; if it reached the grader it would score an empty
  answer.
- ❌ The `saveAgent` contract has **no backing service, no domain entity, no
  repo, and is not wired into functions** — it is a designed-but-unbuilt stub.
- 🐞 The tutor reply is **currently non-functional in production** (wrong prompt
  key + wrong variables → gateway throws → hardcoded fallback "Let me help you
  with that."). Any agentic build must fix this seam first.

---

## 1. What conversational capability EXISTS today vs what's needed

### Exists — the "chat tutor"

A one-shot conversational tutor scoped to a practice item. The learner types,
the server runs **one** LLM call, appends the reply, and the client reads it
back / streams it live. There is **no notion of an objective the agent must
drive the learner toward, and no scoring of the conversation.** It is a
help-desk chat, not a goal-seeking agent.

**Wired & functional (plumbing):**

- Callables: `v1.levelup.sendChatMessage`, `getChatSession`, `listChatSessions`
  (`functions/sdk-v1/src/levelup.ts` → `@levelup/services/levelup/chat.ts`).
- Subscription: `v1.levelup.chatStream` (Firestore-query over the messages
  subcollection).
- Repo: `packages/repositories/src/levelup-content/chat.ts` (unwraps the
  `{session}` envelope — the prior Issue-7 read-back fix is in place).
- Query hooks: `useChatSessions`, `useChatSession`, `useSendChatMessage`
  (optimistic user append), `useChatStream`
  (`packages/query/src/levelup-content/*`).
- UI: mobile `AiTutorChatScreen` + `ChatAgentQuestion.tsx`; web
  `ChatTutorPanel` + `ChatAgentAnswerer.tsx` (routed from `question-view.tsx` /
  `QuestionAnswerer.tsx` on `case "chat_agent_question"`).

### Design scaffolding — the "agent" abstraction (STUBBED, not built)

- **Item type** `chat_agent_question` in the SSOT registry
  (`packages/domain/.../question-types/registry.ts`): `evaluation: "ai"`, prompt
  carries `{ agentInstructions?, maxTurns?, modelAnswer? }`, learnerAnswer
  carries `{ transcript?: {role, content}[] }`.
- **Agent entity contract** `v1.levelup.saveAgent`
  (`packages/api-contract/.../save-agent.ts`): `type: tutor|evaluator`,
  `systemPrompt`, `rules[]`, **`evaluationObjectives: string[]`**, `strictness`,
  `feedbackStyle`, `maxConversationTurns`, `modelOverride` — flagged
  `authoritySensitive`.
- `AGENT_TYPES = ["tutor","evaluator"]` enum; `ChatSession` carries optional
  `agentId`/`agentName`/`questionType`.

### Needed for objective-driven agentic questions (the gap)

1. The agent must be **seeded with objectives** and a system prompt each turn.
2. The agent must **detect when the objective is met** (or turns exhausted).
3. On completion, a **separate grader** scores the _transcript_ against the
   objectives/rubric → `StoredEvaluation` → progress. None of 1–3 exists.

---

## 2. Chat message flow, end-to-end (today)

```
Client (useSendChatMessage, optimistic append of user msg)
  → v1.levelup.sendChatMessage  (rateTier: "ai")
     sendChatMessageService (packages/services/.../chat.ts):
       authorize("space.read")
       resolve/lazily-create ChatSession   (messages = always a subcollection)
       append USER message (role:"user", text, timestamp[, mediaUrls])
       ctx.ai.generate({ promptKey:"tutorChat", variables:{text,spaceId,itemId} })   ← see §BUG
         gateway: moderate → quota → circuit-breaker → secret key → provider.call
                  → cost/usage log  (all server-authoritative, per-tenant)
       append ASSISTANT message (role:"assistant", text[, tokensUsed])
       return { sessionId, message, tokensUsed }
Read-back:  getChatSession → { session: {..., messages[]} }   (systemPrompt ⚷ stripped)
Live:       chatStream (Firestore subscription over the messages subcollection)
Client merge: mergeById(server, optimistic, streamed) dedupes by id; optimistic dropped on echo
```

The AI result-shape seam (`ai.data` vs services' `ai.json`, `tokenUsage` vs
`tokensUsed`) is reconciled by the **bootstrap result-adapter**
(`functions/sdk-v1/src/bootstrap.ts`), so the `ai.json`/`ai.tokensUsed` reads in
`chat.ts` resolve correctly at runtime.

### 🐞 BUG — the tutor reply is effectively dead in production

`chat.ts` calls `promptKey: "tutorChat"`, but the PROMPTS registry
(`packages/ai/src/prompts/registry.ts`) has no such key — the tutor prompt is
named **`aiChat`**. At runtime the gateway does `PROMPTS["tutorChat"]` →
`undefined` → `template.defaultModel` throws `TypeError`.
`sendChatMessageService` wraps the call in `try/catch` and falls back to a
hardcoded **"Let me help you with that."** — so the real LLM tutor never runs.
Compounding it:

- the passed variables `{text, spaceId, itemId}` don't match `aiChat`'s required
  `{itemContext, message, language}` (render would throw "missing required
  variable"), and
- **no conversation history is passed** (`aiChat` expects a `history` var) — so
  there is no multi-turn context even in principle.

Service unit tests stub `ctx.ai.generate` directly, so they never exercised the
real registry — the mismatch slipped past the Issue-7 read-back tests. **This
must be fixed before any agentic feature; it is also the smallest, highest-value
fix in this vertical.**

---

## 3. Gap analysis — reusable vs net-new

### Reusable as-is

- `ChatSession` / `ChatMessage` model + always-subcollection messages.
- `sendChatMessage` plumbing, `chatStream`, chat repo, all four query hooks,
  both UI renderers.
- AI gateway (moderation, per-tenant quota, cost logging, circuit breaker,
  secret resolution).
- `evaluateAnswer` / `recordItemAttempt` → `applyProgress` → `StoredEvaluation`
  (server-scoring
  - idempotency + progress persistence, single round-trip).
- `AGENT_TYPES` enum, `ChatSession.agentId/agentName/questionType`, `answerKeys`
  repo.

### Net-new (must build)

1. **Converge the item schema.** Two divergent shapes exist:
   - domain registry: `{ agentInstructions?, maxTurns?, modelAnswer? }`
   - shared-types `ChatAgentQuestionData`
     (`packages/shared-types/src/content/item.ts`, used by both web apps +
     teacher-web editor):
     `{ agentId?, objectives: string[],   conversationStarters?, maxTurns?, evaluationGuidance? }`
     These are different contracts for the same type. Pick the
     objective-carrying shape and align the registry, shared-types, and the
     `saveAgent` `evaluationObjectives`.
2. **Agent CRUD backend.** `saveAgent` is a contract-only stub — build the
   domain `Agent` entity, repo, `saveAgentService`, and wire
   `saveAgent`/`getAgent`/`listAgents` into `functions/sdk-v1/src/levelup.ts`.
3. **Agent-turn service.** Per user turn: inject
   `{objectives, systemPrompt, history, rules, maxTurns}` into a new prompt; run
   the gateway; append reply; return `{objectiveMet, turnsLeft}` as
   **authoritative server state** (not client-inferred).
4. **Objective grader.** A new prompt (e.g. `objectiveGrading`) that scores the
   full transcript against the objectives/rubric → `StoredEvaluation`, wired so
   `evaluateAnswer`/ `recordItemAttempt` route `chat_agent_question` to it
   instead of the empty-answer `answerGrading` path (see §crux). Today
   `scoreOne` would send the `{transcript}` object to `answerGrading` with an
   empty `answer` string → garbage/zero score.
5. **New prompt templates** (`agentTurn`, `objectiveGrading`) + fix `aiChat`
   wiring (§BUG).
6. **Server-side `maxTurns` enforcement** (currently the composer is sealed
   client-side only).
7. **Completion → progress linkage** for a finished `chat_agent_question`
   session.

---

## 4. Where the agent loop should live — the crux

**Backend service (`@levelup/services/levelup`), NOT the SDK/query layer.**
Rationale:

- **Server-authoritative scoring** is a hard platform rule (§6.5 — no
  client-supplied score). Objective-completion and the final grade must be
  decided server-side.
- **Secrets never leave the server.** Objectives, `systemPrompt`, `rules`,
  `modelAnswer`, rubric are authority-sensitive (`saveAgent` is already flagged
  `authoritySensitive`; `ChatSession` already ⚷-strips `systemPrompt` from
  reads). The client must never see them.
- **Cost/quota/moderation/circuit-breaker** only exist behind the server-side
  `ctx.ai` gateway.
- **Progress + idempotency** (`applyProgress`, `withIdempotency`) already live
  server-side.

**Shape of the loop:** _not_ one blocking function that iterates many LLM calls
(Cloud Functions timeout + bad UX). Instead the loop is **spread across turns**:
each user message is one `sendAgentTurn` call = one LLM turn; loop **state lives
in the `ChatSession`** (turn count, objective-met flag, agentId). When the agent
signals completion (structured-output flag) or `maxTurns` is hit, a **final
`objectiveGrading` call** grades the transcript and writes progress. The
SDK/query layer stays thin: optimistic append + live streaming + rendering the
server-authoritative `objectiveMet`/`turnsLeft`.

---

## 5. Risks

- **Cost / latency / quota (multi-turn).** An agentic item is N× LLM calls vs 1
  for a normal question; a chatty learner can burn the per-tenant monthly/daily
  budget. Mitigate: hard server-side per-session turn cap, cheap model (flash)
  for turns + stronger model only for the final grade, and count the grading
  call against quota explicitly.
- **Prompt injection / jailbreak.** The learner's free text drives the agent.
  Never place objectives/model answer/rubric in client-readable session fields.
  **Do not let the conversational agent self-declare "objective met"** —
  completion must be judged by a _separate_ grader call the student can't
  influence. Moderation is already default-on for `ai_chat`.
- **Grading a conversation.** Non-deterministic; the idempotency `answerHash`
  changes every turn (transcript grows), so the dedupe key strategy must key on
  session + turn count, not the raw answer. Decide _when_ to grade (explicit
  "done" vs `maxTurns`) and how to award partial credit across multiple
  objectives. `StoredEvaluation` fits, but the transcript→score prompt is
  net-new.
- **State races.** Optimistic + streamed + server-echo merging is already
  handled by `mergeById` in the UI; agent mode adds an `objectiveMet` state that
  must always come from the server, not be inferred client-side.
- **Foundational dead-tutor bug.** The `tutorChat`/`aiChat` prompt-key +
  variables + missing- history seam (§BUG) means the _existing_ tutor never
  really calls the LLM. Fix this before building agentic questions on top of it.

---

## Key file map

| Concern             | Path                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Chat service        | `packages/services/src/levelup/chat.ts`                                                                       |
| Chat callables      | `packages/api-contract/src/callables/levelup/{send-chat-message,get-chat-session,list-chat-sessions}.ts`      |
| Chat stream sub     | `packages/api-contract/src/callables/subscriptions/chat-stream.ts`                                            |
| Chat repo           | `packages/repositories/src/levelup-content/chat.ts`                                                           |
| Query hooks         | `packages/query/src/levelup-content/{queries,mutations,subscriptions}.ts`                                     |
| ChatSession model   | `packages/domain/src/entities/levelup/chat.ts`                                                                |
| Question-type SSOT  | `packages/domain/src/entities/content/question-types/registry.ts`                                             |
| Agent contract stub | `packages/api-contract/src/callables/levelup/save-agent.ts`                                                   |
| AI gateway          | `packages/ai/src/gateway.ts`                                                                                  |
| Prompt registry     | `packages/ai/src/prompts/registry.ts`                                                                         |
| Eval / scoring      | `packages/services/src/levelup/practice.ts` (`scoreOne`)                                                      |
| Functions wiring    | `functions/sdk-v1/src/levelup.ts`, `bootstrap.ts`                                                             |
| Mobile UI           | `apps/mobile-student/src/components/questions/ChatAgentQuestion.tsx`, `screens/profile/AiTutorChatScreen.tsx` |
| Web UI              | `apps/student-web/src/components/questions/ChatAgentAnswerer.tsx`, `components/chat/ChatTutorPanel.tsx`       |

_Note:_ `cleanupInactiveChats` exists only in the **legacy** `functions/levelup`
codebase; it was **not** ported into the new `functions/sdk-v1` fold (which
schedules only `expireTestSessions` + `cleanupStaleSessions`). Inactive chat
sessions are currently not swept in the SDK-v1 runtime.
