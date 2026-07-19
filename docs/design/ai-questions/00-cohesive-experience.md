# 00 · The Cohesive Experience

The single mental model, design language, and end‑to‑end journey that all six AI
question surfaces share. Everything in the per‑type docs is a specialization of
what's here.

---

## 1. Philosophy

**Answering an AI question is composing a multimodal message to a thoughtful
evaluator.** Not filling a form field. The redesign makes the whole screen feel
like an open page you can think on: room to write long, quiet chrome, generous
whitespace ("blankness"), and the ability to add your voice or a photo as
naturally as typing.

Three principles:

1. **Multimodal is native, not bolted on.** Text, audio, and images are
   **co‑equal first‑class inputs**. An answer is a _bundle_ of parts. When we
   send to the LLM, all parts go together — the model sees your writing, hears
   your recording, and reads your image in one pass. No "primary field +
   attachments" hierarchy.
2. **One composer, capabilities toggled.** There is _one_ answer surface. Each
   question type **enables/disables** capabilities on it (write / code / record
   / photograph). Disabled capabilities are cleanly absent (not greyed clutter);
   enabled ones are inviting. Config — not a different screen — is the only
   difference between a `text` answer and an `audio` answer.
3. **Feedback is growth, and it's complete.** We render the _entire_ evaluation
   payload the backend already produces (rubric, per‑dimension structured
   feedback, strengths/gaps, key takeaway, confidence, mistake type) — framed to
   help the student improve and try again, never to punish.

---

## 2. The multimodal answer model

An answer is a bundle:

```
Answer = {
  text?:      string          // prose OR code (per type)
  images?:    MediaRef[]       // camera + library, each an uploaded storage path
  audio?:     MediaRef[]       // recorded clips, each an uploaded storage path
}
```

This extends today's `{ text, mediaUrls }` shape (see `question-view.tsx`
`MediaAnswer`). **Design implication:** the composer shows a **stack of answer
parts**. The writing area is always the anchor; images and audio clips appear as
part‑cards beneath/around it. Every part is removable, re‑orderable is _not_
required. Empty parts never block submit as long as _some_ part has content.

### Capability matrix (defaults per type)

| Type                  |        Write        | Code editor |  Record audio  |   Add image    | Emphasis              |
| --------------------- | :-----------------: | :---------: | :------------: | :------------: | --------------------- |
| `text`                | ✅ (compact→expand) |      —      |    optional    |    optional    | short written answer  |
| `paragraph`           |     ✅ (large)      |      —      |    optional    |    optional    | **long‑form writing** |
| `code`                |   ✅ **as code**    |     ✅      |       —        |    optional    | code editor           |
| `audio`               |   optional notes    |      —      | ✅ **primary** |       —        | **your voice**        |
| `image_evaluation`    |   optional notes    |      —      |    optional    | ✅ **primary** | **your photo/work**   |
| `chat_agent_question` |   (chat composer)   |      —      |    (future)    |    (future)    | **conversation**      |

> "optional" = capability can be turned on per‑question by authoring config, but
> is off by default. Because everything is multimodal, the composer is built so
> **any** capability _can_ be enabled on **any** non‑chat type — the table is
> defaults, not hard limits. Owner decision point: do we expose per‑question
> toggles in authoring now, or ship type‑default capability sets first? (See
> Open Questions.)

---

## 3. The five phases (the journey)

Every AI question moves through the same five phases. Surfaces in
[07-design-surfaces.md](07-design-surfaces.md) map to these.

### Phase 1 — Intro (the question)

The prompt, presented calmly. Type badge, difficulty, points. Prompt text with
math + inline images. Any reference media the _question_ provides (reference
images, prompt audio to listen to). A clear invitation to begin.
Whitespace‑forward.

### Phase 2 — Answer (compose)

The unified composer. Anchor writing area that **expands to full screen**
("focus mode") for long answers. Enabled capability affordances (record /
photograph / add). Live part‑stack. A persistent, low‑friction **"Discuss
this"** entry to the chat layer. Draft is preserved locally. Submit = **"Check
answer"** (or "Submit for evaluation").

### Phase 3 — Evaluating (~8s of AI latency)

A _designed_ waiting state, not a spinner. The AI is "reading your answer." This
is ~8 seconds and must feel intentional and calm — progress cues, reassurance,
maybe a rotating "what the evaluator is looking at" hint tied to the rubric
dimensions. The student's answer stays visible (read‑only) above. No accidental
double‑submit. Cancellable? (owner decision — default: not cancellable, but
backgroundable).

### Phase 4 — Feedback (the rich result)

The full payload, growth‑framed. Verdict headline + score → **key takeaway** →
overall comment → **rubric breakdown** (per‑criterion score bars) →
**per‑dimension structured feedback** (severity‑tagged, with suggestions) →
strengths / where‑to‑grow / worth‑revisiting → confidence + mistake type as
quiet meta. See §5.

### Phase 5 — Growth (retry / next)

The loop. **Try again** (retains or clears the prior answer — owner decision),
**Discuss with tutor**, **See history** (prior attempts + scores), **Next
question**. Attempt semantics per host (§6). The framing is "improve and
re‑submit," attempts encouraged.

---

## 4. Design language (Lyceum "Modern Scholarly")

From `lyceum.tsx` + `theme/colors.ts`. Everything Claude Design produces must
use these tokens.

- **Palette:** warm paper canvas `#FBF8F3`, surface `#FFFDFA`, sunken `#F4EEE4`;
  ink text `#1C1A16` / secondary `#565046` / muted `#756E61`; **brand indigo**
  `#423A82` (hover `#322C63`, subtle `#EEEBF8`); **spark/marigold** accent
  `#E8972B`. Status: success `#2F7D5B`, warning `#B7791F`, error `#B23A36`, info
  `#2D6E8E`.
- **Type:** `Fraunces` serif (`font-display`) for headings/verdict titles;
  `Schibsted Grotesk` sans (`font-ui`) for body/labels; `Spline Sans Mono`
  (`font-mono`) for scores/counters. Sizes 2xs 11 → 3xl 39. Uppercase eyebrows
  use `tracking-caps` (1.5px).
- **Shape/elevation:** radius sm 6 / md 10 / lg 14 / xl 20 / pill 999. **No
  shadows** — elevation is hairline borders (`border-border-subtle #E8DFD0`,
  strong `#D6C9B4`). Cards are flat surfaces `p-4`, sections `gap-3/4`.
- **Existing components to reuse/extend:** `FeedbackPanel`, `toFeedbackProps`,
  `DifficultyChip`, `PointsChip`, `Kicker`, `ItemNavigatorRow`/`NavNode`,
  `QuestionNavBar`, `MasteryRing`. Rubric precedent: `RubricBreakdown`,
  `ConfidenceBadge`, `InsightCard` in `screens/tests/_components/bits.tsx`.
- **Whitespace direction:** current screens are dense. The redesign wants **more
  air** — larger touch targets, more line‑height in prose, fewer visible borders
  at rest, the writing area dominant. Think "a clean notebook page," not "a
  form."

---

## 5. The feedback payload (render ALL of it)

**SSOT (confirmed with Layer‑2):** the STUDENT‑facing shape is
`packages/domain/src/entities/content/stored-evaluation.ts` →
**`StoredEvaluationSchema`** — the client subset.
(`UnifiedEvaluationResultSchema` is the _at‑rest superset_;
`cost/model/tokens/gradedAt/dimensionsUsed` are **not** in the student payload.)
**Today's `FeedbackPanel` shows only the starred‑out subset — the redesign
closes that gap.**

| Field                                                | Type                                                       | Render as                                           |       Shown today?        |
| ---------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- | :-----------------------: |
| `score` / `maxScore`                                 | number                                                     | mono `score / max pts`                              |            ✅             |
| `percentage`                                         | number 0–100                                               | progress bar + mono %                               |            ✅             |
| `correctness`                                        | number 0–1                                                 | (drives verdict)                                    |            ✅             |
| `summary.keyTakeaway`                                | string                                                     | **headline** insight, distinct from comment         |        ❌ **add**         |
| `summary.overallComment`                             | string                                                     | grader's paragraph                                  |            ✅             |
| `strengths[]`                                        | string[]                                                   | "What you did well" (sparkles)                      |            ✅             |
| `weaknesses[]`                                       | string[]                                                   | "Where to grow" (sprout)                            |            ✅             |
| `missingConcepts[]`                                  | string[]                                                   | "Worth revisiting" (book)                           |            ✅             |
| `rubricBreakdown[]`                                  | `{criterionId?, criterionName, score, maxScore, comment?}` | **per‑criterion rows w/ score bars**                |        ❌ **add**         |
| `structuredFeedback`                                 | `Record<dimId, FeedbackItem[]>`                            | **per‑dimension, severity‑tagged, w/ `suggestion`** |        ❌ **add**         |
| `confidence?`                                        | number 0–1                                                 | quiet confidence badge (high/med/review)            |        ❌ **add**         |
| `mistakeClassification?`                             | `Conceptual\|Silly Error\|Knowledge Gap\|None`             | quiet chip when not "None"                          |        ❌ **add**         |
| _(planned, pending owner D3)_ `dimensionBreakdown[]` | `{dimensionId, dimensionName, score, scale, comment}`      | **per‑dimension score ring/bar**                    | ❌ **design room for it** |

`FeedbackItem = { severity: "critical"|"major"|"minor", message, dimension?, suggestion? }`.
Severity → color (critical=error, major=warning, minor=info). `summary` may
arrive as a bare string from not‑yet‑redeployed backends — **always read both
shapes** (see `readEvalSummary`).

**Dimension labels:** `structuredFeedback` keys **are** the enabled‑dimension
ids (that's your `dimensionsUsed` = `Object.keys(structuredFeedback)`). To get
human **labels**, join those ids against `enabledDimensions` from
`getEvaluationConfig` (see [09](09-evaluation-config-visibility.md)) — there is
no `dimensionsUsed[]` field in the student subset.

**Display gating is applied SERVER‑SIDE before you receive the payload**
(`EvaluationDisplaySettings`): if `showStrengths=false` → `strengths[]` arrives
**empty**; if `showKeyTakeaway=false` → `summary` is **omitted**. So treat
`strengths`/`weaknesses`/`summary`/`confidence`/`rubricBreakdown`/`structuredFeedback`
as **all optional** — design must degrade gracefully when any section is
empty/absent.

**Layer‑2 pending item (D3):** for `dimension_based`/`hybrid` rubrics,
per‑dimension _scores_ today evaporate; Layer‑2 will add `dimensionBreakdown[]`
once the owner rules on D3. **Design the feedback surface to accommodate a
per‑dimension score ring/bar now** so it slots in without rework; Layer‑2 locks
the exact shape after the decision.

---

## 6. Attempts, hosts & data flow

- **Two online hosts:** `ContentViewerScreen` (lessons, `AttemptBar`, history of
  prior attempts) and `PracticeModeScreen` (drill, unlimited retry, no agent
  questions). Both submit via
  `recordItemAttempt.mutate({ spaceId, storyPointId, itemId, answer, timeSpent })`;
  the authoritative result is at **`progress.evaluation`** (per mob‑eval‑fix —
  _not_ `lastEvaluation`; that mismatch was the "shows nothing" bug). Contract
  is `.strict()` — **media rides inside `answer` as `{text, mediaUrls}`**, no
  top‑level media field.
- **Build ON mob‑eval‑fix's landed code (shipped 0.5.1/vc8):**
  `ContentViewerScreen` now has honest **onError / pending / feedback‑mapping**
  states reading `progress.evaluation`. The redesign must **not regress** these
  — extend them, don't replace the correct read path. G13 is deployed, so the
  student‑safe `getEvaluationConfig` projection (incl. criterion `levels`) is
  live for the config‑icon work.
- **Offline exam results:** `ExamResultsViewScreen` renders per‑question
  `evaluation` (`UnifiedEvaluationResult`) read‑only — teacher‑driven, already
  the best rubric precedent.
- **`chat_agent_question`:** server‑owned session; answer is a
  `{questionType, sessionId, submissionId?}` reference; graded on "Finish
  interview," not "Check answer." Never enters Practice.
- **Grading is server‑authoritative everywhere** — answer keys never reach the
  device.
- **Media upload:** `useMediaUpload` →
  `storageRepo.uploadImage({ kind:"answer-sheet", … })` returns a storage path
  stored in `mediaUrls`. (Seam note: only the `answer-sheet` upload kind is
  deployed; itemId used as the scope id.)

---

## 7. Cross‑cutting states

- **Offline / no‑network:** composer stays usable, drafts persist; media upload
  and submit queue or warn clearly; the conversation runtime already surfaces
  offline‑aware states — match that language.
- **Errors:** upload failure (retry inline), evaluation failure (retry submit),
  grading‑pending / grading‑failed (conversation has precedent cards). Never
  lose the student's written work.
- **Loading:** the ~8s evaluating phase is a _designed_ surface (§Phase 3), not
  a bare spinner.
- **Accessibility:** every status conveyed by **more than color** (icon + label
  — the kit already does this, e.g. `MasteryBadge`); large tappable targets;
  screen‑reader labels on capture buttons and score bars; audio has transcript
  affordance where available; respect dynamic type; focus management when the
  composer expands to full screen and when feedback appears.

---

## 8. Owner decisions (locked 2026‑07‑19)

1. **Per‑question capability toggles — YES, now.** Authoring exposes
   enable/disable of write/audio/image **per question**. The capability matrix
   in §2 is the _default_ per type; the composer must be built so any capability
   can be turned on for any non‑chat type. Design the "capability row" to render
   whatever set is enabled.
2. **Try again — PRE‑FILL the previous answer.** "Try again" loads the student's
   prior answer (text/code/media) so they edit & improve. Applies across
   text/paragraph/code (and keep media for image/audio unless the student clears
   it).
3. **Focus mode — FULL‑SCREEN BY DEFAULT for `paragraph`.** Long‑form opens
   straight into the distraction‑free full‑screen writing surface (Surface B);
   other types get opt‑in expand.
4. **Evaluating — COMMIT‑ONCE, BACKGROUNDABLE.** Once submitted it grades; the
   student may navigate away and be **notified when done**, but cannot cancel
   the grade (no wasted LLM calls). Design Surface F accordingly (no cancel
   button; a "you can leave, we'll ping you" affordance).

5. **Discuss‑this‑question chat — ALWAYS available** on every AI question
   (low‑friction entry), for v1.
6. **Audio answers — raw audio → LLM only** for v1 (no on‑device transcription
   shown to the student).
7. **Holistic descriptive icon — NOT needed for v1.** Holistic rubrics show
   mode + max + pass % only; the Layer‑2 `holisticSummary` enrichment is
   deferred.

### Still open

8. **Layer‑2 D3 / `dimensionBreakdown[]`:** confirm we surface per‑dimension
   _scores_ (rings/bars) once Layer‑2 locks the shape.
