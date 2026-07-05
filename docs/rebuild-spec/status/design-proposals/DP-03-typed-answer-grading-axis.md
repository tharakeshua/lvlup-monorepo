# DP-3 · Typed answer/grading axis + QTI item split + server re-validation

**Wave:** W0 (the strip-fix is urgent) + W2 (the typed split) · **Status:**
design-only · **Evidence:** `SDK-RR-T3-answer-axis.md`, A-LD-01/02/10,
F-SSOT-04.

## Problem (most serious correctness + security item)

**A live answer leak to learners, today.** The server strips answers by a
hard-coded _name list_ `ANSWER_KEY_FIELDS` (`content.ts:27`) =
`[answerKey, correctAnswer, acceptableAnswers, modelAnswer, evaluationGuidance, evaluatorGuidance]`
— which is **disjoint from 3 of the schema's own answer fields**: `isCorrect`
(mcq/mcaq), `correctOrder` (jumbled), `MatchPair.right` (matching).
`normalizeItemPayload`'s legacy `kind:'question'` branch rebuilds answer-free
(safe), but the **canonical pass-through branch** (`content.ts:264-266`) only
runs name-based stripping → `isCorrect`/`correctOrder`/`right` **leak to
learners via `listItems`/`getItem` on canonical items now.**

Nothing catches it: (1) `ItemViewSchema === UnifiedItemSchema` (same TS type,
`_shared.ts:77`); (2) answer fields are `.optional()` so stripped + unstripped
both Zod-validate; (3) the only stripping test exercises the _legacy_ branch,
checks just `correctAnswer`/`acceptableAnswers`, and never the read path. Side
defect: canonical MCQ `isCorrect` isn't extracted into the key on save → grader
finds no key (`aiPending`).

**Answer axis is `z.unknown()` end-to-end** (6 sites): `AnswerKey.correctAnswer`
(`answer-key.ts:16-17`), `TestSubmission.answer:104`,
`AttemptRecord.answer:38`/`lastAnswer:61`, `recordItemAttempt:21`,
`save-test-answer:14`, `evaluate-answer:17`, `_shared:96`. The server
**coerces** (`String()`/`Number()`/`Array.isArray()` in `grading.ts:74-83`;
`JSON.stringify` in `practice.ts`) instead of re-validating; the answer is
persisted verbatim (`test-session.ts:136`) with no shape/size bound.

## Target design (QTI `itemBody` / `responseDeclaration` split)

**(a) W0 immediate:** make `ANSWER_KEY_FIELDS` complete _and_ route the
canonical branch through the same answer-free rebuild as the legacy branch —
stop the live leak now, extract `isCorrect` into the key on save. (Tactical;
superseded by (b).)

**(b) W2 structural — remove answer fields from the prompt union entirely.** The
prompt schema (and thus `ItemView`) becomes _structurally_ answer-free → a leak
is a **compile error**; `stripAnswerFields`/`ANSWER_KEY_FIELDS` become
deletable.

- Answers live only in the typed `AnswerKeyData` discriminated union (from
  DP-2's registry), in the deny-all `AnswerKey` subcollection, re-merged solely
  by `getItemForEdit`.
- `LearnerAnswer` becomes a typed discriminated union (registry-bound) replacing
  all 6 `z.unknown()` sites.
- **Server guard `parseLearnerAnswer(questionType, raw)`** at the top of
  `recordItemAttempt`/`evaluateAnswer`/`saveTestAnswer`/`submitTestSession` —
  re-validates per type before grade/persist (closes F-SSOT-04; bounds storage;
  fixes coercion-driven correctness flips).
- Progress detail (`LD-10`) becomes discriminated by `itemType` rather than a
  flat bag-of-optionals.

```ts
// itemBody (public, answer-free) — narrowed by questionType
const McqPrompt = zObject({
  questionType: z.literal("mcq"),
  stem: z.string(),
  options: z.array(zOption),
});
// responseDeclaration (deny-all subcollection only)
const McqKey = zObject({
  questionType: z.literal("mcq"),
  correctOptionIds: z.array(zId),
});
const McqAns = zObject({
  questionType: z.literal("mcq"),
  selectedOptionIds: z.array(zId),
});
```

## Migration / compat

- Legacy stored answers won't satisfy strict unions → `schemaVersion`-gated
  upgrade coercer or seed backfill.
- Canonical items already carrying leaked fields → backfill to strip + populate
  keys.
- SUB001 migration must emit the typed split (coordinate with be-data-seed).
- Removing inline prompt fields is a **wire break** → ship behind the
  api-contract seam (DP-1); interim = per-variant `.omit` projection.

## Tests

- `ItemView` is answer-free (type-level + a runtime assert that no answer key
  appears in a public read).
- A read-path stripping test per question type (currently absent).
- `parseLearnerAnswer` rejects malformed/oversized answers per type.

## Closes

LD-01 (incl. the live leak), LD-02, LD-10, F-SSOT-04.
