# 06 · `chat_agent_question` — pure chat / interview question

The whole question **is** a multi‑turn conversation with an AI interviewer. The
transcript is the answer; it's graded when the interview finishes. This is the
"chat type questions which are purely chat based" the owner described.

**Registry:** `AgentAssessment*` schemas; `evaluation: "ai"`. Answer is a
session reference `{ questionType, sessionId, submissionId? }`. **Today:**
`ChatAgentQuestion.tsx` →
`useConversationController({ mode: "agent_assessment" })` →
`ConversationScaffold`. Server‑authoritative session; **never enters Practice**;
graded on "Finish interview," not "Check answer."
(`components/questions/ChatAgentQuestion.tsx`, `components/conversation/*`.)

> **CRITICAL:** the runtime logic and state machine
> (`src/components/conversation/*`, `src/features/conversation/`) are **owned by
> the release pipeline**. This surface is **visual integration only** — restyle
> to the Lyceum language and add delight; do **not** rewrite behavior.

## User stories

- _As a learner_, I have a real, flowing conversation with an interviewer that
  adapts to my answers.
- _As a learner_, I see what topics I need to cover and my progress through the
  interview.
- _As a learner_, I can use suggested starters when I don't know how to begin.
- _As a learner_, I decide when to finish, with a clear warning if I finish
  early.
- _As a learner_, when it's done I get a clear score and summary, and my
  progress updates.

## Entry points

- Lesson only (excluded from Practice). Opens the conversation surface (Surface
  J).

## Answering interactions (existing scaffold, restyled)

- **Intro:** scenario card, "What to cover" objectives, up to 3 tappable
  **starters** that pre‑fill the composer.
- **Transcript:** assistant (left) vs learner (right) bubbles; per‑message
  sending/failed + retry; image chips; citations; turn‑active indicator.
- **Composer:** multiline + send; "sent only when you choose Send"; **sealed**
  once finalizing/complete.
- **Progress:** "Interview progress · N of M turns"; **Finish interview** when
  allowed → confirm modal.
- **Discuss‑this‑question help sheet:** not applicable — the whole surface is
  already a chat.

## Attachment flows

- Composer is text‑only today. Image/audio in‑conversation is a **future**
  enhancement (the multimodal ambition applies here too — flag as a later phase;
  do not block v1 on it).

## Evaluating state

- Not the ~8s single‑shot flow. Uses conversation lifecycle states: **finalizing
  → grading‑pending → completed/grading‑failed**, each with a status card +
  contextual action. Design these as calm, trustworthy states.

## Feedback / rubric presentation

- On completion: the **result card** — "Interview complete," score pill
  (`score / maxScore`), summary (`{keyTakeaway, overallComment}` object or
  legacy string — read both), feedback, "progress updated." Consider surfacing
  rubric breakdown / structured feedback here too if the payload carries it
  (align with Layer‑2).

## Retry / attempt semantics

- Server‑owned; a session can be resumed from a prior answer's `sessionId`.
  Re‑attempt semantics are backend‑governed — surface clearly, don't invent
  client logic.

## Offline / error states

- The runtime already surfaces offline‑aware `send_failed`, `grading_failed`,
  `abandoned`, `fatal` states with retry/refresh — **restyle these**, keep the
  behavior.

## Accessibility

- Bubbles readable by screen reader in order; turn‑active announced; send/failed
  states announced; starters are labeled buttons; finish‑confirm modal
  focus‑trapped.

## Capability matrix

|      Write       | Code | Audio  | Image  |
| :--------------: | :--: | :----: | :----: |
| ✅ chat composer |  —   | future | future |
