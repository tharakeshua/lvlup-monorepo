# 01 · `text` — short constructed answer

A short written answer: a phrase, a term, a couple of sentences. Graded by AI
against `modelAnswer` / `acceptableAnswers` and the rubric. The lightest AI
surface — but it inherits the _same_ unified composer, just with the writing
area compact by default and media optional.

**Registry:** `TextPrompt` —
`{ maxLength?, modelAnswer?, acceptableAnswers?, caseSensitive? }`,
`evaluation: "ai"`. **Today:** `FreeText` with `allowMedia` (single‑line
`TextInput`), image+audio attach available. (`question-view.tsx:318-327`,
`:549-590`.)

## User stories

- _As a learner_, I answer a focused question in a sentence or two without a
  giant empty page intimidating me.
- _As a learner_, if writing isn't enough, I can snap a photo or record a quick
  clarification — same surface.
- _As a learner_, I get specific feedback on what my short answer got
  right/wrong, and can retry.

## Entry points

- Lesson (`ContentViewerScreen`) and Practice (`PracticeModeScreen`) — one item
  in a story point.

## Answering interactions

- **Write (primary, compact):** a comfortable multi‑line‑capable field that
  starts small (1–2 lines) and grows; `maxLength` respected with a gentle
  counter near the limit. Focus mode available but rarely needed.
- **Media (optional):** if enabled, `Record` / `Add photo` affordances appear;
  attachments join the part‑stack. Off by default.
- **Discuss‑this‑question** chat available.

## Attachment flows

- Image (camera/library) and audio, only if the question enables them. Upload
  via `useMediaUpload` → path in `mediaUrls`. Part‑cards with remove.

## Evaluating state (~8s)

- Standard Surface F. Answer shown read‑only above.

## Feedback / rubric presentation

- Full Surface G. For short answers, rubric may be a single criterion — still
  render the bar. Key takeaway + comment carry most of the value here.
  Strengths/weaknesses often terse.

## Retry / attempt semantics

- Lesson: attempts tracked, history available, `AttemptBar` node updates.
  Practice: unlimited retry, "Try again" then "Next question."

## Offline / error states

- Draft preserved. Media upload/submit queue or warn. Evaluation‑failed → retry,
  text preserved.

## Accessibility

- Field labeled; counter announced politely near limit; capture buttons labeled;
  feedback status conveyed by icon+label.

## Capability matrix

|   Write    | Code |  Audio   |  Image   |
| :--------: | :--: | :------: | :------: |
| ✅ compact |  —   | optional | optional |
