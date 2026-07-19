# MOB-EVAL-FIX — mobile AI evaluation shows nothing on submit

**P0:** Student submits an answer to an AI-graded question (AI Assessment Lab,
tenant_subhang) on mobile 0.5.0/vc7 → no feedback, no error, nothing.

## Root cause — CLIENT-ONLY (NOT a server / api-contract drift)

Reproduced against **PROD** as `student.test@subhang.academy` calling
`v1.levelup.recordItemAttempt` with `validateResponses`
(getCallable(name).responseSchema.parse), exactly as the app does. Evidence
(`tmp-mob-eval-fix/`):

| case                                   | server                                                                      | validation (current source) |
| -------------------------------------- | --------------------------------------------------------------------------- | --------------------------- |
| text (short answer, deterministic key) | 3.2s, score 0, minimal eval                                                 | ✅ PASS                     |
| paragraph (real gemini, 9.7s)          | rich: summary OBJECT, structuredFeedback, mistakeClassification, confidence | ✅ PASS                     |
| code (real gemini, 7.7s)               | score 1/1, 3 strengths                                                      | ✅ PASS                     |

**The server + api-contract + domain already emit/accept the correct
`StoredEvaluation` shape.** The coordinator's suspected "evaluation payload
exceeds the contract schema" drift does **not** exist in current source
(`confidence`/`structuredFeedback`/`rubricBreakdown`/`summary`-object are all in
`StoredEvaluationSchema` and validation passes cleanly). **No sdk-v1 / services
/ contract change is needed.**

The silent-nothing is two client bugs in `apps/mobile-student`:

1. **No `onError`** on `recordAttempt.mutate` (ContentViewerScreen submit()).
   The shipped 0.5.0/vc7 APK bundled an OLDER strict schema (pre-enrichment)
   that **threw** on the new rich evaluation → mutation error → no handler →
   outcome never set → **rendered as literally nothing** (matches owner's
   report).
2. **Wrong payload paths.** `toOutcome` (ContentViewerScreen) and
   `toFeedbackProps` (lyceum.tsx) read `progress.questionData.status` /
   `progress.lastEvaluation.feedback` — but the authoritative shape is
   `progress.evaluation` (StoredEvaluation) + top-level `solved`/`percentage`.
   So even when validation passes, every AI grade rendered a **blank wrong
   "incorrect"** with no strengths/weaknesses/summary.

### Live proof of the fix (good answers → correctness 1, solved=true)

```
paragraph GOOD: server 1/1 solved=true
  NEW → verdict=correct + comment + 3 strengths ✅
  OLD → verdict=(undef→incorrect) comment=null 0 strengths  ❌ (blank wrong verdict)
code GOOD: server 1/1 solved=true
  NEW → verdict=correct + comment + 3 strengths ✅
  OLD → verdict=(undef→incorrect) comment=null 0 strengths  ❌
```

## Fix (apps/mobile-student only)

- **ContentViewerScreen.tsx**
  - `toOutcome` now reads `progress.evaluation` + `solved`/`percentage`; derives
    correct/partial/incorrect from `correctness`/`solved` (partial no longer
    collapses to wrong).
  - `submit()` gains `onError` → honest, retryable error card (never a silent
    no-op); UNAUTHENTICATED gets a session-expired message.
  - Visible **"Evaluating your answer…"** banner tied to
    `recordAttempt.isPending` (for the ~8s AI latency), plus a retry button on
    the error card.
  - `submitErrors` state cleared on new submit / Try again.
- **lyceum.tsx** `toFeedbackProps` reads `progress.evaluation` + object
  `summary.overallComment`/`keyTakeaway` so FeedbackPanel renders score,
  strengths, weaknesses, missingConcepts, and the AI summary.

Types covered: text, paragraph, code (directive minimum). audio &
image_evaluation ride the identical `submit()` → `recordItemAttempt` →
`toOutcome`/`toFeedbackProps` path with the same StoredEvaluation shape, so the
mapping fix covers them equally.

## Gates

- ✅ Prod repro evidence captured
- ✅ `apps/mobile-student` tsc (with all deps) — clean
- ✅ `expo export --platform android` — bundles/mounts clean
- ✅ Live verification: correct verdict + rich AI feedback renders (NEW vs OLD)
- N/A services/api-contract/query — **no changes there** (client-only diff)

## Follow-up

- **APK re-push REQUIRED** (UI changes). Bump `android/app/build.gradle`
  versionCode 7→8 (+ app.json version) and re-push to Firebase App Distribution.
  Coordinate the bump with conv-release-train (owns the release train). NO
  sdk-v1 deploy dependency.
