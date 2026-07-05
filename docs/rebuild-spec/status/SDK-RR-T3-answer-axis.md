# SDK Re-Review T3 — Answer / Grading Axis (stripping safety · typed contract · server re-validation)

**Task:** `task_1782557497812_sbytv8x91` (parent `task_1782552238337_fnoliexxz`)
**Mode:** READ-ONLY deep second pass. No code changed. **Branch:** staging ·
**Reviewer:** be-sdk (`tm_1782508112019_1yz8039fd`) · **Date:** 2026-06-27
**Sources verified:** `SDK-REVIEW-A-LEARNING-DOMAIN.md` (LD-01/LD-02 §4, §5) ·
`SDK-REVIEW-PHASE1.md` (F-SSOT-04).

> **Verdict on the three known findings:** all three **CONFIRMED**, and the
> re-review **escalates LD-01 from "stripping is convention-not-type" to an
> actual live data leak**: the server's strip list is a hard-coded set of field
> _names_ that is **disjoint** from three of the schema's own answer fields
> (`isCorrect`, `correctOrder`, matching `right`). For a canonical-shaped item
> those answers are **emitted to learners today**, and nothing (compiler, Zod
> schema, or the single stripping test) catches it.

---

## 0. TL;DR for the coordinator

| Theme            | Finding                                                                                                    | Status                | Severity    |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | --------------------- | ----------- |
| Stripping safety | `ItemView === UnifiedItem` → stripped/unstripped are the same type & schema                                | CONFIRMED (LD-01)     | P1          |
| Stripping safety | strip list `ANSWER_KEY_FIELDS` omits `isCorrect`/`correctOrder`/`right` → **live leak on canonical items** | **NEW / escalated**   | **P0-leak** |
| Typed contract   | answer axis is `z.unknown()` at 6 sites end-to-end                                                         | CONFIRMED (LD-02)     | P1          |
| Re-validation    | server **coerces** the untyped `answer`, never re-validates per `questionType`                             | CONFIRMED (F-SSOT-04) | P1          |
| Coverage         | exactly **one** stripping test; legacy shape only; checks 2 of 6 fields; **never tests the read path**     | NEW                   | P1          |

---

## 1. Full data-flow map of the answer axis (file:line at every hop)

Five hops. The type degrades to `unknown` at the seam and stays there; the only
place a _typed_ answer exists is the inline `.optional()` fields on the
authoring prompt union — the exact fields that are supposed to be stripped.

```
AUTHORING (typed-ish, inline)        SEAM (untyped)            STORAGE              GRADING (coerced)
─────────────────────────────       ───────────────           ───────              ────────────────
question-payload.ts answer fields ─► saveItem.data: unknown ─► item (stripped)  ─┐
  McqOption.isCorrect        :15      (save-item.ts)            answerKeys/{id}   │  autoEvaluateDeterministic
  TrueFalse.correctAnswer    :35                                .correctAnswer    │   (grading.ts:49)
  Numerical.correctAnswer    :40                                = z.unknown()     ├─► String()/Number()/
  Text/Para/Code/Audio/Img/Chat                                 (answer-key.ts:16)│    Array.isArray() — NO
    .modelAnswer  :48,55,62,106,112,131                                           │    questionType parse
  BlankSlot.correctAnswer    :68                                                  │
  Jumbled.correctOrder       :99     learner submit ──────────► TestSubmission    │
                                      .answer = z.unknown()      .answer:unknown ─┘
                                      (4 callables, below)       (test-session.ts:104)
                                                                 AttemptRecord.answer:unknown
                                                                 (progress.ts:38)
                                                                 ItemProgressEntry.lastAnswer
                                                                 (progress.ts:61)
```

### 1.1 Hop A — authoring: the _only_ typed answer, inline on the prompt union

`packages/domain/src/entities/content/question-payload.ts` — answer-bearing
fields are `.optional()` members of the prompt schemas:

- `McqOption.isCorrect` `:15` (shared by `mcq` `:21` and `mcaq` `:27`)
- `TrueFalseData.correctAnswer` `:35`
- `NumericalData.correctAnswer` `:40` (+ `tolerance` `:41`)
- `modelAnswer` on `text:48`, `paragraph:55`, `code:62`, `audio:106`,
  `image_evaluation:112`, `chat_agent_question:131`
- `BlankSlot.correctAnswer` `:68` + `acceptableAnswers` `:69`
- `JumbledData.correctOrder` `:99`
- `MatchPair.right` `:87` (the right column **is** the answer for `matching`)

### 1.2 Hop B — extraction on save (the strip seam)

`packages/services/src/levelup/content.ts`

- `ANSWER_KEY_FIELDS` `:27-34` =
  `["answerKey","correctAnswer","acceptableAnswers","modelAnswer","evaluationGuidance","evaluatorGuidance"]`
- `stripAnswerFields()` `:37-50` — deep recursion that drops keys **by name** if
  they are in that set.
- `extractAnswerKey()` `:272-301` — deep-collects the same named fields into the
  answer-key bag.
- `saveItemService()` `:399-440` — `extractAnswerKey(data)` `:411`,
  `stripAnswerFields(data)` `:412`, persists stripped item `:426`, writes key to
  deny-all subcollection `:429-436`.

### 1.3 Hop C — the answer key entity (type degrades)

`packages/domain/src/entities/content/answer-key.ts`

- `correctAnswer: z.unknown()` `:16`, `acceptableAnswers: z.array(z.unknown())`
  `:17`, plus `modelAnswer`/`evaluationGuidance` strings `:19-20`. Carries its
  own `questionType` `:15` (LD-17: can drift from the item's).

### 1.4 Hop D — public read projection (the stripping that must hold)

`packages/services/src/levelup/content.ts`

- `listItemsService()` `:461-478` → `projectItem(it, authoring)` `:476`.
- `getItemForEditService()` `:443-458` — the ONE sanctioned re-merge `:454-456`
  (`{...item, answerKey: key}`).
- `projectItem()` `:486-514` — `stripAnswerFields(item)` `:487`, then
  `normalizeItemPayload` `:506`.
- `normalizeItemPayload()` `:221-269` — **two branches that behave differently**
  (the hole, §2):
  - legacy `kind:"question"` `:228` → `buildQuestionData(qt, p)` `:120-173`
    rebuilds an **allow-list** answer-free payload (only `id/text/imageUrl` via
    `asOptions` `:107-117`; `matching` blanks `right` to `""` `:151-157`).
    **Safe.**
  - already-canonical `type:"…"` `:264` → `stripAnswerFields(p)` `:265` only.
    **Name-based deny-list → leaks (§2).**
- Contract view: `_shared.ts:77` `ItemViewSchema = UnifiedItemSchema` (same
  type); `_shared.ts:81-84`
  `ItemEditViewSchema = UnifiedItemSchema.extend({ answerKey })`.

### 1.5 Hop E — learner submission + grading (untyped end-to-end)

Contract seam — student `answer = z.unknown()` at 4 callables:

- `record-item-attempt.ts:21` · `save-test-answer.ts:14` ·
  `evaluate-answer.ts:17` · plus `_shared.ts:96`
  (`TestSubmissionResultView.answer`).

Storage:

- `test-session.ts:104` `TestSubmission.answer: z.unknown()`
- `progress.ts:38` `AttemptRecord.answer: z.unknown()` · `progress.ts:61`
  `ItemProgressEntry.lastAnswer: z.unknown()`

Grading (server-authoritative; never trusts a client score — CD13):

- `grading.ts` `autoEvaluateDeterministic()` `:49-98` — consumes `answer` via
  `normalize()→String()` `:33`, `Number()` `:78`, `Array.isArray()` `:74`. No
  `questionType` schema parse.
- `practice.ts` `scoreOne()` `:58-167` — resolves a grading subtype from 5
  fallbacks `:87-94`, deterministic path `:99-101`, exact-match path `:107-127`,
  AI path `:143-166`. Persists `answer: input.answer` verbatim
  (`test-session.ts:136` saveTestAnswer; via `applyProgress`).
- `submitTestSessionService` `:167-277` batch-grades `:202-231`.

---

## 2. Proof of the stripping-safety hole (concrete, not hypothetical)

### 2.1 The deny-list is disjoint from the schema's own answer fields

`ANSWER_KEY_FIELDS` (content.ts:27) strips by name:
`answerKey, correctAnswer, acceptableAnswers, modelAnswer, evaluationGuidance, evaluatorGuidance`.

The schema's answer fields (question-payload.ts) include three that are **not**
in that set:

| Schema answer field                             | Question type                        | In strip list?      |
| ----------------------------------------------- | ------------------------------------ | ------------------- |
| `correctAnswer` (TrueFalse/Numerical/BlankSlot) | true-false, numerical, fill-blanks   | ✅ stripped         |
| `modelAnswer`                                   | text/paragraph/code/audio/image/chat | ✅ stripped         |
| `acceptableAnswers`                             | fill-blanks                          | ✅ stripped         |
| **`isCorrect`** (`McqOption :15`)               | **mcq, mcaq**                        | ❌ **NOT stripped** |
| **`correctOrder`** (`Jumbled :99`)              | **jumbled**                          | ❌ **NOT stripped** |
| **`right`** (`MatchPair :87`)                   | **matching**                         | ❌ **NOT stripped** |

### 2.2 The leak fires on the canonical read path

`projectItem` (content.ts:486) → `stripAnswerFields` (deny-list by name) →
`normalizeItemPayload`. For an **already-canonical** item (`payload.type`
present), `normalizeItemPayload` hits the pass-through branch
(content.ts:264-266) which **only** runs `stripAnswerFields` — it does **not**
go through the answer-free `buildQuestionData` rebuilder. So a canonical item
whose payload is `payload.questionData.options[].isCorrect` (mcq/mcaq),
`…correctOrder` (jumbled), or `…pairs[].right` (matching) is recursed
key-by-key, none of those names match the deny-list, and **the correct-answer
data is returned in the `listItems` / `getItem` response to a learner.**

> The legacy `kind:"question"` branch is safe (allow-list rebuild). The
> canonical branch — the shape the SDK is migrating _toward_ — is the leaky one.
> This is a regression-by-omission that grows as content becomes canonical.

A secondary correctness defect rides along: `extractAnswerKey` (content.ts:272)
also collects by the same name set, so on **save** a canonical MCQ's `isCorrect`
is neither extracted into the deny-all key **nor** stripped from the item — the
grader later finds no `correctAnswer` key for that MCQ
(`autoEvaluateDeterministic` key=null → `aiPending`, grading.ts:55), while the
answer simultaneously leaks on read.

### 2.3 Why nothing catches it — three blind layers

1. **Compiler:** `ItemViewSchema = UnifiedItemSchema` (`_shared.ts:77`). The
   public view and the full authoring item are the **identical TS type**.
   `ItemView` _can_ hold `isCorrect`, so emitting it is type-correct. A
   stripping omission is invisible to `tsc`.
2. **Zod schema:** every answer field is `.optional()`, so a payload **with**
   answers and one **without** both `.parse()` clean against `ItemViewSchema`.
   Validation cannot distinguish a stripped response from a leaking one.
3. **Tests:** there is exactly **one** stripping test
   (`services.unit.test.ts:27-48`). It (a) uses the **legacy**
   `payload.kind:"question"` shape (the safe branch), (b) asserts only that the
   string `"secret"` — i.e. `correctAnswer` / `acceptableAnswers` — is absent,
   and (c) **never exercises the read path** (`projectItem` / `listItems`) at
   all. It would stay green while `isCorrect`/`correctOrder`/`right` leak.

**Regression shape:** any new answer-bearing field added to the prompt union, or
any content authored in the canonical two-level shape with
`isCorrect`/`correctOrder`/`right`, leaks silently. The guarantee lives entirely
in a hand-maintained string array kept in sync by nobody.

---

## 3. Server re-validation gap (F-SSOT-04) — CONFIRMED

**Claim under test:** because the student `answer` is `z.unknown()` at the seam,
the server **MUST** re-validate it per `questionType`. **Finding: it does not —
it coerces.**

- No `questionType`-keyed schema parse exists anywhere in the grading path.
  `autoEvaluateDeterministic` (grading.ts:49) and `scoreOne` (practice.ts:58)
  consume `answer` purely through coercion: `String(answer)` (grading.ts:33,81 /
  practice.ts:114), `Number(answer)` (grading.ts:78), `Array.isArray(answer)`
  (grading.ts:74), `JSON.stringify(answer)` (practice.ts:51,151).
- The untyped `answer` is **persisted verbatim** — `saveTestAnswer` writes
  `answer: input.answer` (test-session.ts:136);
  `recordItemAttempt`/`evaluateAnswer` hash it (`answerHash`, practice.ts:50)
  and store the resulting attempt — with **no shape guard**.

**Security assessment (bounded, but real):**

- _Score inflation is blocked_ by CD13 — the client never sends a score; the
  server always re-scores against its own deny-all key. So the untyped answer
  cannot **directly** forge a grade. This is why it is P1, not a straight P0
  auth bypass.
- _But the gap is exploitable as:_
  1. **Coercion-driven correctness flips.** Grading branches on the _runtime
     shape_ of `answer` (the
     `Array.isArray(answer) && Array.isArray(correctAnswer)` branch,
     grading.ts:74). A learner submitting a scalar where an array is expected
     (or vice-versa) silently takes a different code path; `String({})` →
     `"[object Object]"`; `Number([])` → `0`. Correctness depends on the
     learner's answer _shape_ lining up with the key's shape — exactly the
     invariant a typed contract would enforce and that nothing enforces today.
  2. **Unbounded / malformed storage injection.** Any JSON value (a 10 MB
     string, a deeply-nested object) is accepted and persisted into
     `submissions/`, `attempts`, and `lastAnswer`. No size, depth, or shape
     bound.
  3. **No per-type acceptance contract.** A new question type ships with zero
     answer validation; correctness rests on "stringly" server logic and the
     migration maps (`QT_TO_GRADING` practice.ts:31, `QUESTION_TYPE_MAP`
     content.ts:61) staying aligned with the answer shape.

**Where re-validation must slot in:** at the seam, immediately after
`requireTenant`/`authorize` and **before** `scoreOne` /
`autoEvaluateDeterministic` / any persist — parse `input.answer` with the
`questionType`-selected `LearnerAnswer` member (resolved from the item's payload
`questionType`), failing with `VALIDATION_ERROR` on mismatch. See §4.3.

---

## 4. Target design (Zod sketches)

Three coordinated moves. (a) and (b) together make the stripping hole a
**compile error** and the re-validation a **typed parse**; (c) is where the
server enforces it. Ties into the proposed `QUESTION_TYPE_REGISTRY` from
`SDK-REVIEW-A` §5.2 / LD-03 (not yet in code — verified absent; referenced here
as the binding home).

### 4.1 (a) Remove answer fields from the public prompt union — QTI body/responseDeclaration split

Answers do not belong in the prompt payload; they already live in `AnswerKey`.
Make the prompt union _answer-free_ so the public view **cannot** carry an
answer.

```ts
// question-payload.ts — PROMPT ONLY (itemBody). No isCorrect / correctAnswer / modelAnswer /
// correctOrder / acceptableAnswers / MatchPair.right.
const McqOptionSchema   = zObject({ id: zOptionId, text: z.string(), imageUrl: zUrl.optional() }); // isCorrect GONE
const McqPromptSchema   = zObject({ questionType: z.literal("mcq"), options: z.array(McqOptionSchema), shuffleOptions: z.boolean().optional() });
const TrueFalsePrompt   = zObject({ questionType: z.literal("true-false") });           // correctAnswer GONE
const NumericalPrompt   = zObject({ questionType: z.literal("numerical"), unit: z.string().optional() }); // correctAnswer/tolerance GONE
const JumbledPrompt     = zObject({ questionType: z.literal("jumbled"), tokens: z.array(z.string()) });   // correctOrder GONE
const MatchPairPrompt   = zObject({ left: z.string() });                                 // right GONE
// …15 prompt schemas, answer-free…
export const QuestionPromptSchema = z.discriminatedUnion("questionType", [ McqPromptSchema, … ]);
```

Then `_shared.ts`:

```ts
export const ItemViewSchema = UnifiedItemSchema; // now structurally answer-free — leak = compile error
export const ItemEditViewSchema = UnifiedItemSchema.extend({
  answerKey: AnswerKeyDataSchema.optional(),
});
```

`getItemForEdit` returns `{ item: ItemView, answerKey: AnswerKeyData }` —
answers travel on a separate, deny-all field (QTI `responseDeclaration`).
`stripAnswerFields` and `ANSWER_KEY_FIELDS` **can be deleted** — there is
nothing left in the prompt to strip.

> _Interim (less invasive)_: keep authoring fields but type the view by
> projection —
> `PublicQuestionData = <per-variant .omit({isCorrect,correctAnswer,modelAnswer,correctOrder,right,acceptableAnswers})>`,
> and `ItemViewSchema` from it. Still makes a leak a compile error, but keeps
> the dual shape.

### 4.2 (b) Typed, discriminated answer + learner-answer + grading contract

```ts
// answer-key.ts — TYPED correct-answer union, mirrors the prompt union by questionType
const McqAnswer = zObject({
  questionType: z.literal("mcq"),
  correctOptionIds: z.array(zOptionId),
});
const McaqAnswer = zObject({
  questionType: z.literal("mcaq"),
  correctOptionIds: z.array(zOptionId),
});
const TrueFalseAnswer = zObject({
  questionType: z.literal("true-false"),
  correct: z.boolean(),
});
const NumericalAnswer = zObject({
  questionType: z.literal("numerical"),
  value: z.number(),
  tolerance: z.number().optional(),
});
const JumbledAnswer = zObject({
  questionType: z.literal("jumbled"),
  correctOrder: z.array(z.number().int()),
});
const MatchingAnswer = zObject({
  questionType: z.literal("matching"),
  pairs: z.array(zObject({ leftId: z.string(), rightId: z.string() })),
});
const ModelAnswer = zObject({
  questionType: z.enum([
    "text",
    "paragraph",
    "code",
    "audio",
    "image_evaluation",
    "chat_agent_question",
  ]),
  modelAnswer: z.string().optional(),
  guidance: z.string().optional(),
});
export const AnswerKeyDataSchema = z.discriminatedUnion("questionType", [
  McqAnswer,
  McaqAnswer,
  TrueFalseAnswer,
  NumericalAnswer,
  JumbledAnswer,
  MatchingAnswer /*…*/,
]);

// learner-answer.ts — TYPED submitted-answer union (what the seam parses)
const McqLearner = zObject({
  questionType: z.literal("mcq"),
  selectedOptionIds: z.array(zOptionId).length(1),
});
const McaqLearner = zObject({
  questionType: z.literal("mcaq"),
  selectedOptionIds: z.array(zOptionId),
});
const NumericalLearner = zObject({
  questionType: z.literal("numerical"),
  value: z.number(),
});
const JumbledLearner = zObject({
  questionType: z.literal("jumbled"),
  order: z.array(z.number().int()),
});
const TextLearner = zObject({
  questionType: z.enum(["text", "paragraph", "code"]),
  text: z.string().max(50_000),
}); // bounded
export const LearnerAnswerSchema = z.discriminatedUnion("questionType", [
  McqLearner,
  McaqLearner,
  NumericalLearner,
  JumbledLearner,
  TextLearner /*…*/,
]);
```

Bind all three per type in one registry (LD-03 / §5.2), so adding a type is
**one entry** and the enum, the three unions, and the AUTO/AI classification all
regenerate:

```ts
export const QUESTION_TYPE_REGISTRY = {
  mcq: {
    prompt: McqPromptSchema,
    answer: McqAnswer,
    learnerAnswer: McqLearner,
    evaluation: "auto",
    label: "Multiple choice",
  },
  // …15 entries…
} as const satisfies Record<QuestionType, QuestionTypeSpec>;
```

Then the 6 `z.unknown()` sites narrow:
`AnswerKey.correctAnswer → AnswerKeyDataSchema`; `TestSubmission.answer`,
`AttemptRecord.answer`, `ItemProgressEntry.lastAnswer`, and the 4 callables'
`answer` → `LearnerAnswerSchema`.

### 4.3 (c) Where server re-validation slots in

A single guard at the top of every answer-accepting service, before
grading/persist:

```ts
// shared/answer.ts
export function parseLearnerAnswer(questionType: QuestionType, raw: unknown) {
  const spec = QUESTION_TYPE_REGISTRY[questionType];
  if (!spec) fail("VALIDATION_ERROR", `unknown questionType ${questionType}`);
  const r = spec.learnerAnswer.safeParse(raw);
  if (!r.success)
    fail("VALIDATION_ERROR", `answer shape invalid for ${questionType}`);
  return r.data;
}
```

Call sites: `recordItemAttemptService` (practice.ts:211, before `scoreOne`
:224), `evaluateAnswerService` (practice.ts:170, before :182),
`saveTestAnswerService` (test-session.ts:115, before persisting `:132-138`), and
the batch loop in `submitTestSessionService` (test-session.ts:202). The
`questionType` is read from the server-loaded item's payload (never the
request). Then `autoEvaluateDeterministic` / `scoreOne` operate on a **typed**
answer + **typed** key — the `String()/Number()/Array.isArray()` coercion
gymnastics (grading.ts:74-83) collapse into typed comparisons per registry
entry.

### 4.4 Migration / compat implications

- **Stored answer keys** (`correctAnswer: unknown`) and **stored learner
  answers** (`submissions.answer`, `attempts`, `lastAnswer`) are historical
  untyped blobs. Parsing them with the new strict unions **will reject legacy
  shapes**. Mitigate with a per-type _upgrade_ coercer run on read (a
  `.catch()`/`.transform()` adapter mapping old → new), gated by a
  `schemaVersion` stamp (LD-18), or a one-shot backfill migration in
  `packages/seed`.
- **Canonical content with leaked fields:** any already-stored canonical item
  that still carries `isCorrect`/`correctOrder`/`right` in its payload needs a
  backfill that moves them into the typed `AnswerKeyData` and removes them from
  the item (the save path never did this for the canonical shape).
- **Real SUB001 data** (unprefixed `tenants/tenant_subhang`, hand-authored)
  predates the v2 shapes — the migration (`migrate-subhang-to-v2.mjs`) must emit
  the typed answer-key split, not inline answers.
- **Wire compat:** removing inline prompt answer fields (§4.1) is a breaking
  change to any client reading `payload.questionData.*Answer*`; ship behind the
  SSOT seam (`api-contract`) so all apps move together. The interim projection
  variant (§4.1 note) avoids the wire break short-term.

---

## 5. Coverage gap (test the invariant, not the happy path)

Beyond the type fix, the read-path stripping invariant needs a test that:

1. saves a **canonical** two-level item with `isCorrect`/`correctOrder`/`right`
   populated,
2. reads it back through `listItemsService` **and** `getItemService` as a
   **student**,
3. asserts none of
   `isCorrect`/`correctOrder`/`right`/`correctAnswer`/`modelAnswer` appear,
4. and asserts `getItemForEditService` (teacher) **does** return them.

Today only step-0 of the legacy variant exists (`services.unit.test.ts:27`).
Under the §4.1 design this test becomes mostly redundant (the type makes the
leak impossible), but until then it is the only net catching the live leak — and
it currently has a hole the exact size of the bug.

---

## 6. Citations

- QTI 3.0 ASI — `itemBody` vs `responseDeclaration/correctResponse` separation:
  <https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html>
- Zod discriminated unions: <https://zod.dev/api?id=discriminated-unions>
- Registry/strategy over closed unions for open extension:
  <https://dev.to/gabrielanhaia/the-strategy-pattern-in-typescript-discriminated-unions-beat-subclasses-17na>
- Schema evolution (version + project, don't repeat):
  <https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html>
  </content> </invoke>
