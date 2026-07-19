# 07 · Design Surfaces — the Claude Design brief

**This is the document to paste into Claude Design.** It lists every
_standalone_ surface to design for the AI‑question experience, each with
purpose, states, content, data, interactions, and design direction. Design them
as a coherent set — same Lyceum language
([00 §4](00-cohesive-experience.md#4-design-language-lyceum-modern-scholarly)),
same multimodal model
([00 §2](00-cohesive-experience.md#2-the-multimodal-answer-model)).

**Platform:** React Native (Expo) phone screens, portrait. **Language:** Lyceum
"Modern Scholarly" — warm paper, indigo brand, Fraunces/Schibsted/Spline‑Mono,
hairline borders (no shadows), generous whitespace. **North star:** feels like a
clean notebook page you think on, not a form.

> **Read alongside this brief:**
> [08 · Experience, Motion & Delight](08-experience-and-motion.md) (the required
> feel — beautiful, magical, responsive; a shared action palette + signature
> motion for every state) and
> [09 · Evaluation Config Visibility](09-evaluation-config-visibility.md) (every
> AI surface shows "How you'll be evaluated" — objectives/rubric/dimensions as
> fun icons). Both are part of every surface's spec below.

---

## Surface A — Question Intro / Answer page (the core)

The primary surface. One screen that holds the prompt and the **unified
multimodal composer**.

**Purpose:** present the question calmly; let the student compose a multimodal
answer (write long, record, photograph) with lots of room.

**Zones (top → bottom):**

1. **Slim top bar** — back, question position (`3 / 12`), points chip, an
   unobtrusive "Discuss" affordance. Minimal.
2. **Prompt block** — type eyebrow + difficulty chip; prompt text (supports
   math + inline images); any reference media (reference images as tappable
   tiles; prompt audio as a play control). Collapsible so it can shrink once the
   student starts writing.
   - **"How you'll be evaluated" card** (see
     [09](09-evaluation-config-visibility.md)) — a glanceable icon row of
     objectives + rubric criteria + enabled dimensions, expandable to
     descriptions. Present on every AI surface; visibly the _same_ dimensions
     that appear in feedback (Surface G).
3. **The composer (anchor):** a large, quiet writing area with a soft
   placeholder ("Write your answer… take your time"). Expands. A **"focus
   mode"** control blows it up to full screen (prompt collapses to a one‑line
   header).
4. **Answer parts stack:** below the writing area, cards for each attached image
   and audio clip (thumbnail / waveform, duration, remove ✕). Empty when nothing
   attached.
5. **Capability row:** inline affordances for the _enabled_ capabilities only —
   e.g. `Record`, `Add photo`, `Camera`. Disabled capabilities are absent. Which
   are on is **per‑question authoring config** (owner decision), defaulting per
   type — so design the row to render _any_ subset of {write, code, record,
   photo/camera}.
6. **Primary action:** full‑width **Check answer** / **Submit for evaluation**.
   Secondary: Save draft is implicit.

**States to design:** empty (just placeholder) · writing (text present) ·
with‑attachments (parts stack populated) · focus/expanded mode ·
capability‑disabled variants (text‑only vs. with record vs. with camera) ·
keyboard‑open layout · draft‑restored banner · validation ("add something before
submitting").

**Design direction:** the writing area should dominate. Fewer borders at rest.
Big line‑height. The type‑specific differences are just which capability
affordances appear — keep the skeleton identical across types.

---

## Surface B — The multimodal composer, expanded ("focus mode")

A dedicated full‑screen writing surface (Surface A's composer, maximized).

**Purpose:** distraction‑free long‑form writing. **`paragraph` opens into this
full‑screen by default** (owner decision); other types get an opt‑in expand
control.

**Content:** one‑line collapsed prompt header (tap to peek full prompt) · the
full‑bleed writing area · a slim bottom bar with capability affordances (record
/ photo) + word count (for `paragraph`, show min/max target if set) +
**Done/Collapse** · Submit reachable from here too.

**States:** empty · writing · near/over word target (gentle, not blocking) ·
attachment added from within focus mode · keyboard open.

**Design direction:** maximum blankness. This is the "freedom to write long
things" surface. Warm paper, generous margins, a cursor and your words — almost
nothing else.

---

## Surface C — Code answer editor (variant of A)

**Purpose:** answer a `code` question with editor ergonomics.

**Content:** prompt block with language label (e.g. "Python") · a **monospace
editor** on a dark ink surface (`bg-ink-900 text-paper-100`), seeded with
`starterCode` if provided · no autocorrect/autocapitalize · optional image
attach (photograph a diagram) if enabled · Submit.

**States:** starter‑seeded · edited · empty · focus/expanded (full‑screen code)
· keyboard open. (No syntax‑highlighting engine assumed for v1 — monospace +
comfortable line‑height; note if design wants highlighting so we can scope it.)

**Design direction:** the one place we invert to a dark surface for legibility
of code. Keep the rest of the Lyceum frame warm around it.

---

## Surface D — Audio answer capture (variant of A)

**Purpose:** speak your answer (`audio` primary).

**Content:** prompt block (may include a **prompt audio** to listen to first —
clear play/scrub control) · a **prominent record control** (idle → recording
with live timer + level, → stop) · recorded clip card with waveform, duration,
play/re‑record/remove · optional short text notes field if enabled · Submit.

**States:** idle · recording (live "● Recording… 0:12") · recorded/preview ·
playing back · re‑record · permission‑denied (mic) · upload‑in‑progress ·
upload‑failed (retry).

**Design direction:** the record affordance is the hero. Calm, confident,
obviously tappable. Recording state must be unmistakable and easy to stop.

---

## Surface E — Image / work capture (variant of A)

**Purpose:** photograph or upload work for `image_evaluation` (handwritten
solutions, diagrams).

**Content:** prompt block (may include **reference images** to compare against)
· capture affordances **Camera** + **Photo library** · captured image cards
(thumbnail, tap to view large, remove) · optional short text notes if enabled ·
Submit.

**States:** empty · one/multiple images · viewing an image large ·
camera‑permission‑denied · upload‑in‑progress · upload‑failed (retry) · library
vs camera entry.

**Design direction:** image tiles feel like pinned pages. Easy to add several,
easy to review before submitting.

---

## Surface F — Evaluating state (~8s AI latency)

A **designed waiting surface**, shown after Submit while the AI grades. ~8
seconds — must feel intentional.

**Purpose:** hold the moment calmly; reassure; set expectations for rich
feedback.

**Content:** the student's submitted answer, read‑only, above · a warm, animated
"reading your answer" state · optional rotating hint tied to what's being
evaluated (e.g. rubric dimensions: "Looking at clarity of explanation…"). No
harsh spinner. **Commit‑once, backgroundable (owner decision):** no cancel —
include a calm "you can leave, we'll notify you when it's ready" affordance.

**States:** evaluating (default) · taking‑longer‑than‑usual (after ~12s) ·
failed (retry submit, answer preserved) · success → transitions to Surface G.

**Design direction:** this is a brand moment. Quiet motion, indigo, the sense of
a careful reader. Never feels stuck.

---

## Surface G — Feedback / rich result (the payoff)

Renders the **full** evaluation payload
([00 §5](00-cohesive-experience.md#5-the-feedback-payload-render-all-of-it)),
growth‑framed.

**Purpose:** show the student exactly how they did and how to improve, warmly.

**Content (top → bottom):**

1. **Verdict header** — Got it! / You're close / Not quite yet (icon + Fraunces
   title, warm growth framing) + mono `score / max pts`.
2. **Percentage bar** + **confidence** badge (quiet) + **mistake type** chip
   (only if not "None").
3. **Key takeaway** — one‑line headline insight (`summary.keyTakeaway`),
   visually distinct.
4. **Overall comment** — the grader's paragraph (`summary.overallComment`).
5. **Rubric breakdown** — per‑criterion rows: name + optional comment +
   `score/max` + a score bar (success ≥67% / warning ≥34% / error below). This
   is **new** and important — the owner wants rubric visibility.
6. **Per‑dimension structured feedback** — grouped by dimension (join dim ids →
   names via `getEvaluationConfig.enabledDimensions`), each item severity‑tagged
   (critical/major/minor color) with its `message` and actionable `suggestion`.
   **New.** Echo the _same_ dimensions the student saw up front in the "How
   you'll be evaluated" card ([09](09-evaluation-config-visibility.md)).
   - **Per‑dimension score ring/bar** — leave room for
     `dimensionBreakdown[]{dimensionId, dimensionName, score, scale, comment}`
     (Layer‑2 addition pending owner decision D3). Design it now; it slots in
     without rework.
7. **Growth sections** — "What you did well" (strengths) · "Where to grow"
   (weaknesses) · "Worth revisiting" (missingConcepts).
8. **Growth actions** — **Try again** (pre‑fills the student's prior answer to
   edit & improve — owner decision) · **Discuss with tutor** · **See attempt
   history** · **Next question**.

**States:** correct · partial · incorrect · sections empty/hidden (graceful) ·
summary‑as‑string legacy shape · long feedback (scroll) · low‑confidence
("review" badge).

**Design direction:** the richest surface, but must not overwhelm. Progressive
disclosure is fine (rubric/dimension detail can be expandable). Warm,
encouraging, never red‑alarm. Reuse `FeedbackPanel`'s language and extend it.

---

## Surface H — Attempt history

**Purpose:** show prior attempts for a question (lesson host) — the growth
trail.

**Content:** list of prior attempts with score/verdict, timestamp, and
tap‑to‑view that attempt's feedback. Current attempt highlighted.

**States:** first attempt (empty/one) · several attempts (improving trend
celebrated) · best‑score marker.

---

## Surface I — Discuss‑this‑question chat (assist layer)

**Purpose:** talk through _any_ AI question to get unstuck — does **not** submit
the answer. **Always available** on every AI surface for v1 (owner decision),
low‑friction entry from the answer page. (Today: `QuestionHelpSheet`,
`mode: "question_help"`.)

**Content:** a bottom sheet / drawer over the answer page · chat transcript
(assistant + student bubbles) · composer · the drawer knows the student's
current draft (read‑only context) · clear "this is help, not your submission"
framing.

**States:** entry (empty, with a friendly prompt) · conversation in progress ·
assistant typing · sending/failed message · offline.

**Design direction:** feels like a helpful margin note, lighter than the pure
chat question. Reuse the conversation visual language (Surface J) but in a
compact drawer.

---

## Surface J — Pure chat question (`chat_agent_question`)

**Purpose:** the whole question is a multi‑turn interview/conversation; the
transcript is the answer, graded on finish. **Visual integration only** — the
runtime logic (`src/components/conversation/*`, `src/features/conversation/`) is
owned by the release pipeline; design must match/upgrade its _look_, not its
behavior.

**Content (existing scaffold to restyle, not rebuild):**

- **Intro header** — mode eyebrow ("Conversation assessment"), title, context, a
  shield‑check disclaimer, optional **scenario** card, **"What to cover"**
  objectives (checklist), and up to 3 tappable **conversation starters** that
  pre‑fill the composer.
- **Interview progress** — "Interview progress · N of M turns" + a **Finish
  interview** affordance when allowed.
- **Status card** — the current state (bootstrapping / ready‑to‑finish /
  finalizing / grading‑pending / grading‑failed / abandoned), with contextual
  actions.
- **Transcript** — assistant (left, surface) vs learner (right, brand) bubbles;
  per‑message sending/failed states with retry; image‑attached chips; citation
  rows; turn‑active "Interviewer is working on this turn…" indicator; empty
  state.
- **Composer** — multiline input + send; "sent only when you choose Send" note;
  **sealed** state (locked strip) once finalizing/completed.
- **Finish confirm** — modal "Finish interview early?" with turn‑count warning.
- **Result** — on completion, the completed card: "Interview complete," score
  pill, summary, feedback, "progress updated."

**States to (re)design:** intro/pre‑start · active conversation ·
turn‑in‑progress · ready‑to‑finish · finish‑confirm modal ·
finalizing/grading‑pending · grading‑failed · completed result · abandoned ·
offline/send‑failed · sealed composer.

**Design direction:** warmer, more spacious version of today's conversation UI
in the Lyceum language. The transcript should breathe. Bubbles generous. This is
the "chatting experience on questions" the owner wants — make it feel like a
real, calm conversation with a thoughtful interviewer.

---

## Cross‑surface components (design once, reuse)

- **Verdict header + score** (Surface G) — three tones.
- **Score bar** — the rubric/percentage bar, three thresholds.
- **Severity tag** — critical/major/minor chip for structured feedback.
- **Confidence badge** — high/med/review/low.
- **Media part‑card** — image thumbnail card + audio waveform card (used in
  A/D/E and chat).
- **Record control** — idle/recording/preview.
- **Capability affordance** — the inline "Record / Add photo / Camera" pills.
- **Evaluating animation** — the ~8s waiting motif.
- **"How you'll be evaluated" card** — the iconified
  objectives/rubric/dimensions config panel (glanceable row + expanded detail),
  present on every AI surface (see [09](09-evaluation-config-visibility.md)).

---

## What NOT to change

- Server‑authoritative grading (no answer keys on device).
- The conversation runtime's _logic_ and state machine — restyle only.
- The `recordItemAttempt` submit contract (media inside `answer`).

## Deliverables requested from Claude Design

For each surface above: the resting layout, the key states listed, and the
reusable components. Portrait phone. Lyceum tokens. Prioritize **A, B, F, G, J**
(the core answer → evaluate → feedback → chat spine); C/D/E are capability
variants of A; H/I are supporting.
