# 05 · `image_evaluation` — photograph / upload work

The student submits an image of their work — handwritten solution, sketch,
diagram, worked math — for the multimodal LLM to evaluate. Image is the
**primary, first‑class** input; optional text notes can accompany.

**Registry:** AI‑eval composite handling; `evaluation: "ai"`. **Today:**
`Composite` with image capture on (audio off), multiline text present; shows
`data.referenceImageUrls` links. (`question-view.tsx:340-352`, `:620-635`.)

## User stories

- _As a learner_, I photograph my handwritten work and submit it directly.
- _As a learner_, I compare against a reference image the question provides.
- _As a learner_, I can add several images (e.g. multi‑page working) and review
  them before submitting.
- _As a learner_, I get feedback that references what's in my image.

## Entry points

- Lesson and Practice.

## Answering interactions

- **Capture (primary — Surface E):** `Camera` + `Photo library`; captured images
  as tappable tiles (tap → view large), remove ✕. Multiple images supported.
- **Reference images:** if `referenceImageUrls` set, show as a compare strip at
  the top.
- **Notes (optional):** short text field if enabled.
- **Discuss‑this‑question** chat available.

## Attachment flows

- Image via `expo-image-picker` (library + camera, quality 0.7) →
  `useMediaUpload` → path in `mediaUrls`. Camera permission handled gracefully.

## Evaluating state (~8s)

- Surface F. Submitted images shown read‑only above.

## Feedback / rubric presentation

- Surface G. Feedback often references specific parts of the work — render
  structured feedback with suggestions prominently. Rubric bars per criterion.

## Retry / attempt semantics

- Lesson: attempts + history. "Try again" → capture again (keep or clear prior
  images — owner decision). Practice: unlimited retry.

## Offline / error states

- **Camera permission denied:** kind recovery prompt. Image captured but
  upload‑failed → retry, don't lose it. Draft (images + notes) preserved.

## Accessibility

- Capture buttons labeled; image tiles have alt/description affordance; large
  view mode; feedback via icon+label; ensure images have accessible labels
  ("Your submitted image 1").

## Capability matrix

|     Write      | Code | Audio |   Image    |
| :------------: | :--: | :---: | :--------: |
| optional notes |  —   |   —   | ✅ primary |
