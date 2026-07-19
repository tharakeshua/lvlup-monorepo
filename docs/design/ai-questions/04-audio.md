# 04 · `audio` — spoken answer

The student answers by speaking — explaining aloud, a language/pronunciation
task, a verbal walkthrough. Audio is the **primary, first‑class** input; the
recording goes to the multimodal LLM directly. Optional text notes can
accompany.

**Registry:** shares the AI‑eval `paragraph`/composite handling;
`evaluation: "ai"`. **Today:** `Composite` with audio capture on (image off),
multiline text also present; plays `data.promptAudioUrl` if set.
(`question-view.tsx:340-352`, `:611-619`.)

## User stories

- _As a learner_, I tap record, speak my answer, and submit — my voice is the
  answer.
- _As a learner_, I can listen to a prompt audio first, then respond.
- _As a learner_, I can re‑record if I fumble, and preview before submitting.
- _As a learner_, I optionally add a short written note alongside my recording.

## Entry points

- Lesson and Practice.

## Answering interactions

- **Record (primary, hero — Surface D):** big, obvious record control; live
  recording state with timer + level meter; stop; recorded‑clip card with
  waveform, duration, play, re‑record, remove.
- **Prompt audio:** if `promptAudioUrl` set, a clear play/scrub control at the
  top to listen first.
- **Notes (optional):** a short text field if enabled.
- **Discuss‑this‑question** chat available.

## Attachment flows

- Audio via `expo-av` HIGH_QUALITY → `useMediaUpload` → path in `mediaUrls`. Mic
  permission handled gracefully. Multiple clips allowed; each a part‑card.

## Evaluating state (~8s)

- Surface F. Recording preview stays visible.

## Feedback / rubric presentation

- Surface G. Rubric criteria are often delivery/content specific (clarity,
  fluency, correctness). Present per‑dimension feedback clearly. **v1: raw audio
  → LLM only — no on‑device transcription shown to the student** (owner
  decision).

## Retry / attempt semantics

- Lesson: attempts + history. "Try again" → new recording. Practice: unlimited
  retry.

## Offline / error states

- **Mic permission denied:** clear, kind recovery prompt. Recording captured but
  upload‑failed → retry, don't lose the clip. Draft (notes + local recording)
  preserved.

## Accessibility

- Record button large + labeled; recording state announced ("Recording, 12
  seconds"); playback controls labeled; never rely on the level meter alone to
  signal recording (also text + color + icon). (No student‑facing transcript in
  v1.)

## Capability matrix

|     Write      | Code |   Audio    | Image |
| :------------: | :--: | :--------: | :---: |
| optional notes |  —   | ✅ primary |   —   |
