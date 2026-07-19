# AI Questions — Mobile Experience Redesign

**Owner:** Subhang · **Session:** Layer‑1 (student‑mobile AI question UX) ·
**Status:** first‑pass draft for owner review

This doc set is the **design brief for Claude Design**. It finalizes the six
AI‑evaluated question types — what they are, how they work, and their full
requirements — and specifies the **standalone app surfaces** to design.
Workflow:

> **finalize requirements (this doc set) → Claude Design produces the surfaces →
> owner hands surfaces back → Layer‑1 implements them in
> `apps/mobile-student`.**

## The core idea

**One unified multimodal answer UI, not six bolted-on widgets.** Because the LLM
is multimodal, **text, audio, and images are all first‑class citizens** of a
single answer. A student's answer is a **multimodal bundle** — prose + recorded
audio + photographed/uploaded images — that we send to the LLM together. Each
question type simply **enables or disables** capabilities on that same composer
(e.g. `code` turns on the monospace editor; `audio` emphasizes recording;
`image_evaluation` emphasizes the camera). The surface should feel **open and
generous** — lots of blankness, room to write long answers, minimal chrome — and
offer a **chat/discussion** layer, plus support **purely chat‑based questions**.

## Documents

**Read in order.**

| Doc                                                                          | What it defines                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[00-cohesive-experience.md](00-cohesive-experience.md)**                   | The philosophy + the unified journey (Intro → Answer → Evaluating → Feedback → Growth), the design language, the multimodal answer model, and the feedback payload we render. **Start here.** |
| **[07-design-surfaces.md](07-design-surfaces.md)**                           | **The Claude Design brief** — every standalone surface to design, its states, content, and direction. This is what you paste into Claude Design.                                              |
| **[08-experience-and-motion.md](08-experience-and-motion.md)**               | **Experience, motion & delight requirements** — the shared action palette, feedback effects, signature moments; beautiful/creative/magical/futuristic feel. Applies to every surface.         |
| **[09-evaluation-config-visibility.md](09-evaluation-config-visibility.md)** | **"How you'll be evaluated" requirement** — show objectives + rubric + dimensions as fun icons on every AI surface. Contract owned by Layer‑2.                                                |
| [01-text.md](01-text.md)                                                     | `text` capability profile + requirements                                                                                                                                                      |
| [02-paragraph.md](02-paragraph.md)                                           | `paragraph` — flagship long‑form "bigger widget"                                                                                                                                              |
| [03-code.md](03-code.md)                                                     | `code` — monospace editor ergonomics                                                                                                                                                          |
| [04-audio.md](04-audio.md)                                                   | `audio` — spoken answer capture                                                                                                                                                               |
| [05-image-evaluation.md](05-image-evaluation.md)                             | `image_evaluation` — photograph/upload work                                                                                                                                                   |
| [06-chat-agent-question.md](06-chat-agent-question.md)                       | `chat_agent_question` — pure multi‑turn interview/chat                                                                                                                                        |

Each per‑type doc follows the same template: **user stories · entry points ·
answering interactions · attachment flows · evaluating state (~8s) ·
feedback/rubric presentation · retry/attempt semantics · offline/error states ·
accessibility · capability matrix**.

## The 6 surfaces (registry: `packages/domain/.../question-types/registry.ts`, `evaluation: "ai"`)

`text` · `paragraph` · `code` · `audio` · `image_evaluation` ·
`chat_agent_question`

## Two chat concepts (kept distinct)

1. **Discuss‑this‑question chat** — an optional assist/discussion layer
   available on _any_ AI question (today: `QuestionHelpSheet`,
   `mode: "question_help"`). Talk it through, get unstuck; does **not** submit
   the answer.
2. **Pure chat question** (`chat_agent_question`) — the whole question _is_ a
   conversation; the transcript is the answer, graded when the interview
   finishes. Uses the server‑authoritative conversation runtime.

## Ground truth

- **Design kit:** `apps/mobile-student/src/components/lyceum.tsx` +
  `src/theme/colors.ts` (Lyceum "Modern Scholarly").
- **Evaluation payload (student SSOT, confirmed w/ Layer‑2):**
  `packages/domain/src/entities/content/stored-evaluation.ts` →
  `StoredEvaluationSchema` (client subset; `UnifiedEvaluationResultSchema` is
  the at‑rest superset).
- **Config‑display read (confirmed):** callable `v1.levelup.getEvaluationConfig`
  — student‑safe by server‑side projection; objectives from item payload.
- **Current hosts:** `ContentViewerScreen.tsx`, `PracticeModeScreen.tsx`,
  `ExamResultsViewScreen.tsx`.
- **Conversation runtime:** `src/components/conversation/*` +
  `src/features/conversation/` — **visual integration only, logic owned by
  release pipeline.**

## Coordination (live)

- `ContentViewerScreen.tsx` — being edited by **mob‑eval‑fix**; coordinate
  before touching.
- Rubric/feedback fields must match **Layer‑2** output; contract =
  `UnifiedEvaluationResultSchema`.

## Status

- [x] Context absorbed · [x] First‑pass docs drafted
- [ ] Owner review + iteration → [ ] Claude Design surfaces → [ ] Implementation
      (after sign‑off)
