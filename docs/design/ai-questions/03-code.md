# 03 · `code` — code answer

The student writes code in a specified language. Graded by AI against
`modelAnswer` / `testCases` and the rubric. Same unified frame, but the writing
area becomes a **monospace code editor**.

**Registry:** `CodePrompt` —
`{ language?, starterCode?, modelAnswer?, testCases? }`, `evaluation: "ai"`.
**Today:** `CodeAnswer` — dark monospace `TextInput`, `minHeight:160`,
`bg-ink-900 text-paper-100`, no autocorrect/autocap, seeded with `starterCode`,
language label. No media. (`question-view.tsx:353-354`, `:915-936`.)

## User stories

- _As a learner_, I write code in a comfortable monospace editor that doesn't
  fight me (no autocorrect/autocapitalize).
- _As a learner_, I start from provided `starterCode` and edit it.
- _As a learner_, I can expand to a full‑screen code view for longer solutions.
- _As a learner_, I get feedback on correctness, approach, and edge cases, and
  can iterate.

## Entry points

- Lesson and Practice.

## Answering interactions

- **Code editor (primary):** monospace, dark ink surface, comfortable
  line‑height, no autocorrect/autocapitalize/spellcheck; seeded with
  `starterCode`; language chip visible. **Focus mode (Surface C, full‑screen
  code).**
- **Media (optional):** photograph a diagram/whiteboard if enabled (off by
  default).
- **Discuss‑this‑question** chat available.
- v1 assumes **no syntax highlighting engine** — flag if design wants it
  (scoping needed). Comfortable monospace is the baseline.

## Attachment flows

- Image only, if enabled. Same upload path.

## Evaluating state (~8s)

- Surface F; hints can reference "correctness… readability… edge cases…".

## Feedback / rubric presentation

- Surface G. Rubric often has code‑specific criteria (correctness, complexity,
  style). Structured feedback with suggestions is high‑value here — render
  inline and readable. If `testCases` results are surfaced by the backend,
  present pass/fail clearly (verify with Layer‑2 what's returned).

## Retry / attempt semantics

- Lesson: attempts + history. "Try again" pre‑fills the previous code (edit &
  fix). Practice: unlimited retry.

## Offline / error states

- Draft (code) preserved aggressively. Submit/eval retry with code intact.

## Accessibility

- Editor labeled as code input; language announced; avoid autocorrect
  interference; feedback via icon+label. Note: code is hard for screen readers —
  ensure the editor is navigable and the dark surface meets contrast (it does:
  `#F4EEE4` on `#1C1A16`).

## Capability matrix

|   Write    |   Code    | Audio |  Image   |
| :--------: | :-------: | :---: | :------: |
| ✅ as code | ✅ editor |   —   | optional |
