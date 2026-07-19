# 02 · `paragraph` — long‑form written answer

The flagship "bigger widget" case. The student writes an extended, structured
answer — an explanation, an argument, a design write‑up. This is where "freedom
to write long things" and "more blankness on the page" matter most.

**Registry:** `ParagraphPrompt` —
`{ minWords?, maxWords?, modelAnswer?, evaluationGuidance? }`,
`evaluation: "ai"`. **Today:** `Composite` multiline `TextInput`,
`minHeight:120`, image+audio attach both on. (`question-view.tsx:340-352`,
`:592-657`.)

## User stories

- _As a learner_, I have a spacious, calm page to write a long answer without
  cramped scrolling.
- _As a learner_, I can enter a full‑screen focus mode and just write.
- _As a learner_, I can enrich my written answer with a diagram photo or a
  spoken addendum — all sent together.
- _As a learner_, I see rubric‑level feedback across dimensions so I know
  exactly how to raise my score.

## Entry points

- Lesson and Practice.

## Answering interactions

- **Write (primary, large):** the anchor. Starts tall and grows; **focus mode
  (Surface B)** is the headline interaction — full‑screen, minimal chrome, word
  count vs. `minWords`/`maxWords` (gentle guidance, never blocks submit).
- **Media (optional, on by default here):** `Record` + `Add photo` in the
  capability row; parts stack below.
- **Discuss‑this‑question** chat available.

## Attachment flows

- Image + audio via `useMediaUpload`; part‑cards with remove; can attach from
  within focus mode.

## Evaluating state (~8s)

- Surface F, with rubric‑dimension rotating hints ("Looking at structure…
  clarity… evidence…"). Answer read‑only above.

## Feedback / rubric presentation

- The richest Surface G: multi‑criterion **rubric breakdown** with score bars,
  **per‑dimension structured feedback** (severity + suggestions), key takeaway,
  strengths / where‑to‑grow / worth‑revisiting. This type most needs full
  payload rendering.

## Retry / attempt semantics

- Lesson: attempts + history + `AttemptBar`. "Try again" should let the student
  **edit their previous long answer** (pre‑fill) — owner decision, but strongly
  preferred for long‑form. Practice: unlimited retry.

## Offline / error states

- **Never lose long writing** — aggressive local draft persistence, restore
  banner. Submit/upload queue when offline; evaluation‑failed → retry with text
  intact.

## Accessibility

- Full‑screen focus mode manages focus correctly; word‑count announced politely;
  large targets; feedback via icon+label; long feedback navigable by screen
  reader.

## Capability matrix

|         Write         | Code |     Audio     |     Image     |
| :-------------------: | :--: | :-----------: | :-----------: |
| ✅ large + focus mode |  —   | on by default | on by default |
