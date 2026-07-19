# W2 — Feedback Result (Surface G) handoff for W1

**Owner:** AIQ-W2 · **Location:**
`apps/mobile-student/src/components/ai-question/feedback/**` **Consumes:**
`feedback-result.card.html` (visual truth) · StoredEvaluation (domain
`content/stored-evaluation.ts`) · `v1.levelup.getEvaluationConfig` student
projection. **Do NOT edit `ContentViewerScreen` / `PracticeModeScreen` — W1
wires this in.**

## 1. What to import

```ts
import {
  FeedbackResult,
  toStoredEvaluation,
} from "../../components/ai-question/feedback";
```

`index.ts` also re-exports sub-components (`VerdictHeader`, `PercentBar`,
`ScoredHyeStrip`, `RubricBreakdown`, `DimensionFeedback`, `GrowthSections`,
`GrowthActions`, `ConfidenceBadge`, …) if you ever need a partial (e.g. a
compact verdict row in attempt history — W5).

## 2. Wiring (replaces the legacy `AttemptFeedback`/`FeedbackPanel` block)

`FeedbackResult` renders the FULL evaluation, growth-framed. Feed it the
**authoritative** read — `progress.evaluation` — plus the config:

```tsx
<FeedbackResult
  evaluation={progress.evaluation} // StoredEvaluation (the authoritative read)
  config={evalConfig?.config} // getEvaluationConfig student projection ({ rubric, settings })
  isBestAttempt={isBest} // optional (Surface H trend)
  actions={{
    onTryAgain: () => prefillLastAnswer(), // owner-locked: pre-fills the prior answer to edit
    onDiscuss: () => openTutorSheet(),
    onHistory: () => openHistory(),
    onNext: () => goToNextItem(),
  }}
/>
```

- If you only have the **raw `recordItemAttempt` result**, pass it through
  `toStoredEvaluation(raw)` first (it reads `raw.progress.evaluation` and folds
  in the top-level `solved`/`percentage` roll-ups). Returns `null` if there's no
  evaluation yet — render your pending/onError states (yours to own) instead.
- **Verdict** is derived from the score band (Got it! ≥90% · You're close 40–89%
  · Not quite yet <40% / no score). Override with the `verdict` prop if you have
  an authoritative `solved` roll-up that should win.
- Every action is optional — only the ones with a handler render. A correct
  verdict suppresses "Try again" and promotes "Next question" to primary.

## 3. Prop contract

Full types + doc in `feedback/types.ts` (`FeedbackResultProps`). Shapes mirror
the server schemas field-for-field, but the kit is **self-contained** (no
`@levelup/domain` import) and **tolerant**:

- `summary` accepts object `{keyTakeaway, overallComment}` **or** a legacy bare
  string (old/needs_review rows) — normalized internally.
- Every section is gated: absent field ⇒ section hidden (respects server
  `displaySettings`; showStrengths=false ⇒ strengths empty ⇒ no card).
- `structuredFeedback` keys are dimension **ids**; labels join via
  `config.settings.enabledDimensions[].name` (fallback: rubric dims, then the
  item's own tag, then a prettified id).
- `rubricBreakdown` rows join to `config.rubric.criteria` by `criterionId` when
  present, else by `criterionName` (criterionId is optional) — that's how the
  level ladder + achieved step appear.

## 4. Layer-2 locked semantics (already implemented)

- `rubricBreakdown[]` = **scored** per-criterion rows + level ladder.
- `structuredFeedback` = **qualitative** per-dimension items (severity + message
  - suggestion) — **not** a score.
- **`dimensionBreakdown[]` (per-dimension numeric score) is pending owner D3.**
  The dim ring is built as a **shell** (dash placeholder); a number renders ONLY
  if a future `dimensionBreakdown` arrives. No fabricated scores.
- `holisticGuidance` / modelAnswer / evaluatorGuidance are never sourced (server
  strips them). Holistic rubrics carry no safe prose — the kit just won't render
  a ladder for them.

## 5. The loop closes

`ScoredHyeStrip` re-renders the SAME criterion/dimension identities the student
saw in the up-front "How you'll be evaluated" card (W1's `hye-card.tsx`), now
scored. Keep the up-front chip visuals aligned (icon + label + tone) so asking
and grading feel like one rubric. Criterion chips carry `score/max`; dimension
chips carry a state dot (no number until D3).

## 6. Verified

- `tsc --noEmit` clean (0 errors).
- Screenshots (headless, `scripts/aiq-feedback-shots.mjs` →
  `/dev/feedback-preview`):
  `screenshots/aiq-feedback/{partial,correct,incorrect,legacy}.png` — matches
  card G1/G2/G3 + string-summary tolerance.
- Fixtures (`feedback/fixtures.ts`) are shaped to real prod payloads; W3
  independently confirmed the live Gemini media-eval StoredEvaluation shape
  matches (summary object, structuredFeedback grouped by question-dependent
  dimension keys, no dimensionBreakdown).

## 7. Notes

- Dev-only route `src/app/dev/feedback-preview.tsx` renders the kit against
  fixtures for screenshots — not linked from any user flow (safe to keep or
  strip at release).
- Motion: verdict lands first, sections cascade ~60ms apart (section-level
  `Reveal`), a one-shot spark shimmer sweeps the "Got it!" icon. Bar fills are
  static widths (reliable on RN + web); the cascade carries the "draw" feel.
