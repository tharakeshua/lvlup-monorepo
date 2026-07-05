# SDK Review A — LEARNING / CONTENT Domain & API (deep design audit)

**Scope:** courses/spaces, story-points, exams, content items, questions (all 15
types), story-point + material + assessment payloads, rubrics, answer keys,
evaluation results, progress / test-sessions / attempts — across
`packages/domain`, `packages/api-contract`, and their consumption in
`packages/repositories` / `packages/api-client` / `packages/query`.

**Mode:** READ-ONLY. No code changed. Findings + target-design sketches only.
**Branch:** staging · **Reviewer:** be-sdk (tm_1782508112019_1yz8039fd) ·
**Date:** 2026-06-27 **Mandate priority order:** (1) proper design, (2)
extensibility, (3) modularity/composability, (4) good code.

---

## 1. Executive summary

The LEARNING/CONTENT core is, on the whole, a **well-architected domain layer**
— clearly above the bar for most production LMS schemas. The strengths are real
and worth protecting:

- **Real two-level discriminated unions.** Item `type` (7) → nested
  `questionType` (15) / `materialType` (7) are genuine `z.discriminatedUnion`s,
  giving O(1) parse + exhaustive type-narrowing — exactly the recommended
  modeling for heterogeneous question types
  ([Zod docs](https://zod.dev/api?id=discriminated-unions)).
- **Strict-by-construction.** Every entity is authored through
  `zObject = z.object(shape).strict()` and a lint test bans raw `z.object(` in
  `src/entities/**` — a strong drift killer.
- **Single-source-of-truth seam.** `api-contract` _projects_ domain schemas
  (`ItemViewSchema = UnifiedItemSchema`, etc.) rather than re-declaring them,
  and downstream (`repositories`/`api-client`/`query`) does **not** re-declare
  or branch on content types at all (verified — see §3.6). No shotgun shapes
  downstream.
- **Shared content primitives across bounded contexts.** `UnifiedRubric` and
  `UnifiedEvaluationResult` are shared by both levelup (digital) and autograde
  (paper-scan) — no fork.
- **Security-conscious projection.** Answer-bearing fields are extracted
  server-side into a deny-all `AnswerKey` subcollection; `getItemForEdit` is the
  single sanctioned re-merge, cached under a non-persisted scope.

**The central weakness, and the one that most directly contradicts the
extensibility/ composability mandate, is the _answer axis_.** While the
_question-prompt_ axis is richly, typed-per-variant, the **answer axis is
modeled three incompatible ways at once**:

1. inlined into the prompt payload as `.optional()` answer fields (`isCorrect`,
   `correctAnswer`, `modelAnswer`, `correctOrder`, …),
2. collapsed to `z.unknown()` in the separate `AnswerKey` entity, and
3. collapsed to `z.unknown()` again as the learner's `answer` in submissions /
   attempts.

The consequence: (a) the "answer-stripped" public view is enforced **by server
convention, not by type** — `ItemView` and the full authoring item are the _same
TypeScript type_, so a stripping bug is invisible to the compiler and to schema
validation; (b) adding a new question type gives you **no typed answer or
grading contract** — only the prompt is type-safe; (c) the answer shape is not a
reusable primitive, so it cannot be "built from smaller blocks."

The secondary theme is **extension fan-out**: adding one question type today
touches ~5 locations across 2 files (enum, two evaluation-classification arrays,
the schema, the union array, plus a test), with no single registry binding
`{literal → schema, answer, grading-mode}`. This is localized to `domain` (good)
but is not the "one small change" the mandate asks for, and the parallel
classification arrays can silently drift from the schema set.

Net: **0 P0, 2 P1, 8 P2, 11 P3.** Nothing is runtime-broken; the findings are
about making the design's strongest idea (discriminated unions + projection)
cover the answer/grading axis and collapse the per-type extension cost to a
single registry entry.

---

## 2. Method & best-practice research (web)

Patterns gathered before auditing, with sources:

| #   | Pattern                                                                                                                          | Takeaway applied to this audit                                                                                                                                                                                                          | Source                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | **Discriminated unions for heterogeneous types**                                                                                 | A shared discriminant key (`type`/`questionType`) with `z.literal` members gives O(1) validation + narrowing — the right base for question modeling. The codebase already does this well.                                               | [Zod — Discriminated Unions](https://zod.dev/api?id=discriminated-unions)                                                                                                                                                                                                                              |
| R2  | **Closed unions are wrong for _open_ extension; use a registry/strategy**                                                        | "The closed-set property that makes discriminated unions safe is what makes them wrong for the open-extension case. A registry of strategy instances is the right shape there." → drive the union + behaviour tables from one registry. | [Strategy Pattern in TS: Discriminated Unions Beat Subclasses](https://dev.to/gabrielanhaia/the-strategy-pattern-in-typescript-discriminated-unions-beat-subclasses-17na), [Confluent schema-evolution](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) |
| R3  | **QTI separates _itemBody_ (prompt) from _responseDeclaration/correctResponse_ (answer key) and _responseProcessing_ (grading)** | The answer and grading model should be first-class and _separate_ from the prompt — never inlined into the body. Validates the "answers belong only in AnswerKey, typed" recommendation.                                                | [QTI 3.0 ASI Information Model](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html), [QTI 3.0 Overview](https://www.imsglobal.org/spec/qti/v3p0/oview)                                                                                                                          |
| R4  | **QTI extensibility via well-defined extension points (PCI / custom interactions)**                                              | A spec can't enumerate every interaction; design an explicit extension seam rather than editing the core for each new type.                                                                                                             | [QTI v3 Best Practices](https://www.imsglobal.org/spec/qti/v3p0/impl)                                                                                                                                                                                                                                  |
| R5  | **Mastery / spaced-repetition state (FSRS: stability + difficulty per item, retention as the metric)**                           | Progress models gain extensibility when "mastery" is a small, named state object per (user,item) rather than ad-hoc flat counters; new metrics attach to that object.                                                                   | [FSRS / awesome-fsrs](https://github.com/open-spaced-repetition/awesome-fsrs), [Domenic Denicola — SRS](https://domenic.me/fsrs/)                                                                                                                                                                      |
| R6  | **Schema evolution: keep new fields optional/defaulted, version explicitly, derive views by projection**                         | Add-only changes, full-compat, and `.omit()`/`.pick()` projections keep the SSOT single. The codebase's "project, don't re-declare" rule matches this; the gap is no explicit schema version field.                                     | [Confluent best practices](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html), [Solace schema-registry best practices](https://docs.solace.com/Schema-Registry/schema-registry-best-practices.htm)                                                         |

---

## 3. Current-model map (file:line)

### 3.1 Items & payloads (the content core)

- `UnifiedItem` — `packages/domain/src/entities/content/item.ts:33-61`. Branded
  ids, two-level `payload`, `rubric` snapshot + `rubricId`, cross-domain
  `linkedQuestionId: ExamQuestionId`, `meta`/`analytics` value objects,
  `archivedAt` nullable soft-delete.
- `ItemPayload` (top-level `type` union, 7 members) —
  `packages/domain/src/entities/content/item-payload.ts:102-110`. Material is a
  nested `materialType` union (7) at `:49-57`; `interactive`/`assessment`/
  `discussion`/`project`/`checkpoint` are flat at `:65-100`.
- `QuestionTypeData` (nested `questionType` union, 15 members) —
  `packages/domain/src/entities/content/question-payload.ts:134-150`. Answer
  fields inlined per variant (`McqOption.isCorrect :15`,
  `TrueFalse.correctAnswer :35`, `modelAnswer` on text/
  paragraph/code/audio/image/chat, `BlankSlot.correctAnswer :68`,
  `Jumbled.correctOrder :99`).
- `ItemMetadata` / `ItemAnalytics` —
  `packages/domain/src/entities/content/item-metadata.ts:16-42`.
- `ItemType` (7) / `QuestionType` (15) / `MaterialType` (7) /
  `AUTO_EVALUATABLE_TYPES` (9) / `AI_EVALUATABLE_TYPES` (6) / `RICH_BLOCK_TYPES`
  (9) — `packages/domain/src/enums/content.ts:4-108`.

### 3.2 Answer key & grading

- `AnswerKey` (server-only, deny-all) —
  `packages/domain/src/entities/content/answer-key.ts:12-23`.
  `correctAnswer: z.unknown()`, `acceptableAnswers: z.array(z.unknown())`.
- `UnifiedRubric` (+ criterion/level/dimension) —
  `packages/domain/src/entities/content/rubric.ts:11-52`.
- `RubricPreset` —
  `packages/domain/src/entities/content/rubric-preset.ts:11-23`.
- `UnifiedEvaluationResult` (server-authoritative grading output) —
  `packages/domain/src/entities/content/evaluation-result.ts:27-46`.
- `StoredEvaluation` (compact projection for revisit) —
  `packages/domain/src/entities/content/stored-evaluation.ts:17-28`.

### 3.3 Spaces, story-points, question bank, versions

- `Space` (+ `SpaceStats`, `SpaceRatingAggregate`) —
  `packages/domain/src/entities/levelup/space.ts:23-75`. `defaultRubric`
  snapshot + `defaultRubricId` source.
- `StoryPoint` (+ `StoryPointSection`, `AssessmentConfig`, `AdaptiveConfig`,
  `RetryConfig`, `AssessmentSchedule`) —
  `packages/domain/src/entities/levelup/story-point.ts:20-86`.
- `QuestionBankItem` —
  `packages/domain/src/entities/content/question-bank-item.ts:13-33`.
- `ContentVersion` —
  `packages/domain/src/entities/content/content-version.ts:10-20`.

### 3.4 Exams (autograde, paper-scan world)

- `Exam` (+ `ExamQuestionPaper`, `ExamGradingConfig`, `ExamStats`) —
  `packages/domain/src/entities/autograde/exam.ts:26-77`.
- `ExamQuestion` (+ `SubQuestion`) —
  `packages/domain/src/entities/autograde/exam.ts:79-105`. Note: `questionType`
  is **optional and structurally unused** (`:95`); no `questionData` union.
- `Submission` / `QuestionSubmission` (+ pipeline embeds) —
  `packages/domain/src/entities/autograde/submission.ts:57-110`.
- `EvaluationSettings` / `GradingDeadLetterEntry` —
  `packages/domain/src/entities/autograde/evaluation-settings.ts:38-75`.
- `ExamStatus` (7) — `packages/domain/src/enums/exam.ts:4-12`.

### 3.5 Progress & test-sessions

- `DigitalTestSession` (+ `TestSubmission` subcollection, `AdaptiveState`,
  `TestAnalytics`) —
  `packages/domain/src/entities/levelup/test-session.ts:57-113`.
  `answer: z.unknown()` (`:104`).
- `SpaceProgress` / `StoryPointProgress` / `StoryPointProgressDoc` /
  `ItemProgressEntry` / `QuestionProgressData` / `AttemptRecord` —
  `packages/domain/src/entities/progress/progress.ts:23-109`.
  `AttemptRecord.answer: z.unknown()` (`:38`),
  `ItemProgressEntry.lastAnswer: z.unknown()` (`:61`).
- `StudentProgressSummary` / `ClassProgressSummary` / `LearningInsight` —
  `packages/domain/src/entities/progress/summaries.ts:73-132`.
- Enums: `packages/domain/src/enums/test-session.ts:5-30`,
  `packages/domain/src/enums/grading.ts:3-36`.

### 3.6 The api-contract seam & downstream consumption

- Projection kit (View schemas) —
  `packages/api-contract/src/callables/levelup/_shared.ts:67-199`.
  `SpaceViewSchema = SpaceSchema` (`:70`), `ItemViewSchema = UnifiedItemSchema`
  (`:77`), `ItemEditViewSchema = UnifiedItemSchema.extend({ answerKey })`
  (`:81-84`).
- `saveItem` request re-declares a _subset_ of item fields by hand —
  `packages/api-contract/src/callables/levelup/save-item.ts:20-36` (see LD-09).
- `CallableDef` contract unit —
  `packages/api-contract/src/callable-def.ts:40-79`.
- **Downstream verified clean** (Explore sweep): `api-client` maps types
  structurally off the `CALLABLES` registry
  (`packages/api-client/src/types.ts:8-36`); `repositories/levelup-content`
  returns `unknown` and never re-declares item/question shapes
  (`packages/repositories/src/levelup-content/item.ts:62-72`); `query` hooks are
  `<T = unknown>` and narrow at the app
  (`packages/query/src/levelup-content/queries.ts:103-141`). The **only**
  type-driven branch in the three consumer packages is a one-way
  `storyPointType → testSessionType` label map
  (`packages/repositories/src/testsession-progress/story-point-type.ts:16-27`) —
  no `switch (questionType)` anywhere downstream. Query keys are auto-generated
  by a unified factory (`packages/query/src/keys/key-factory.ts:17-29`,
  `registry.ts:17-62`). **No content-related TODO/FIXME/@ts-ignore** in any of
  the three packages.

---

## 4. Findings

> Format: `id · severity · area — location` then issue / recommendation /
> citation.

### LD-01 · P1 · Answer-stripping is enforced by convention, not by type

**Location:** `packages/api-contract/src/callables/levelup/_shared.ts:77`
(`ItemViewSchema = UnifiedItemSchema`); answer fields are `.optional()` in
`question-payload.ts:15,35,42,48,55,63,68,99,107,112,131`. **Issue:** The
public, answer-stripped `ItemView` and the full authoring item are the
**identical TypeScript type and identical Zod schema**. Because every answer
field is `.optional()`, a payload _with_ answers and one _without_ both validate
against `ItemViewSchema`. There is therefore **no compile-time, no schema-time,
and no test-time guarantee** that `listItems`/`getItem` responses are actually
stripped — the guarantee lives entirely in hand-written server projection code.
A regression that forgets to strip is invisible to the contract. This is the
highest-leverage design gap: the domain's strongest idea (typed discriminated
unions) is _not_ applied to the very axis that most needs "illegal states
unrepresentable." **Recommendation:** Make the public view a _distinct type that
structurally cannot carry answers_. Two compatible options (see §5.1): (A)
remove answer fields from the prompt payload union entirely — they already
belong in `AnswerKey` — so the union _is_ the public view and authoring sends
answers in a separate field; or (B) derive `PublicQuestionData` by per-variant
`.omit()` of the answer keys, and type `ItemViewSchema` from it. Either makes a
stripping bug a compile error. **Citation:** QTI separates `itemBody` from
`responseDeclaration/correctResponse`
([QTI 3.0 ASI](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html));
make-illegal-states-unrepresentable.

### LD-02 · P1 · The answer/grading axis is untyped (`z.unknown()`) end-to-end

**Location:** `answer-key.ts:16-17` (`correctAnswer: z.unknown()`,
`acceptableAnswers: z.array(z.unknown())`); `test-session.ts:104`
(`TestSubmission.answer: z.unknown()`); `progress.ts:38,61`
(`AttemptRecord.answer`, `ItemProgressEntry.lastAnswer`);
`record-item-attempt.ts:21` (`answer: z.unknown()`). **Issue:** Every question
type has a _structured_ correct answer and a _structured_ learner answer (an MCQ
answer is an option-id set; numerical is a number+tolerance; matching is a
pair-map; jumbled is an index order). All of it is collapsed to `z.unknown()`.
So the prompt axis is 15-way typed while the answer axis is fully untyped — an
asymmetry that defeats composability ("blocks from smaller blocks": the answer
shape is not a reusable, typed block) and extensibility (a new question type
ships with **no** typed answer or grading contract; correctness depends on
stringly server logic). It also blocks shared client-side auto-grading of the 9
`AUTO_EVALUATABLE_TYPES`. **Recommendation:** Introduce a
`questionType`-discriminated **`AnswerKeyData`** and **`LearnerAnswer`** union
mirroring the prompt union, bound to each type in one registry (§5.2).
`AnswerKey.correctAnswer` and every `answer: z.unknown()` then narrow by
`questionType`. **Citation:**
[QTI responseDeclaration/correctResponse](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html);
[Zod discriminated unions](https://zod.dev/api?id=discriminated-unions).

### LD-03 · P2 · No single registry binds a question type to its schema + grading mode

**Location:** `enums/content.ts:21-60` (`QUESTION_TYPES`,
`AUTO_EVALUATABLE_TYPES`, `AI_EVALUATABLE_TYPES`) vs
`question-payload.ts:134-150` (the union array). **Issue:** Adding one question
type requires edits in ~5 places: (1) `QUESTION_TYPES`, (2) one of
`AUTO_EVALUATABLE_TYPES`/`AI_EVALUATABLE_TYPES`, (3) a new `…DataSchema`, (4)
appending it to the `discriminatedUnion` array, (5) the test's
`minimalQuestionData` switch — plus server answer-key/grading handling. The
grading-mode classification is a **parallel array** maintained separately from
the schema set, so a type can silently be in neither (ungraded) or be added to
the union but forgotten in both classification arrays. This is the
open-extension case where a closed union alone is insufficient (R2).
**Recommendation:** A single
`QUESTION_TYPE_REGISTRY: Record<QuestionType, QuestionTypeSpec>` carrying
`{ promptSchema, answerSchema, learnerAnswerSchema, evaluation: 'auto'|'ai', label, defaultRubricCategory }`.
Derive `QUESTION_TYPES`, the discriminated union, and the AUTO/AI arrays _from_
the registry, so adding a type is **one registry entry** (§5.2). **Citation:**
[Strategy/registry over closed unions](https://dev.to/gabrielanhaia/the-strategy-pattern-in-typescript-discriminated-unions-beat-subclasses-17na);
[QTI extension points](https://www.imsglobal.org/spec/qti/v3p0/impl).

### LD-04 · P2 · "points" vs "marks" — two scoring currencies coexist unreconciled

**Location:** `test-session.ts:80-84` (both `pointsEarned/totalPoints` **and**
`marksEarned/totalMarks` on one session); `progress.ts:99-103` (`SpaceProgress`
carries both); levelup uses `points` (`item-payload.ts:19 basePoints`),
autograde uses `marks` (`exam.ts:64,93 totalMarks/maxMarks`). **Issue:** Two
parallel scoring vocabularies live on the same entities with no defined
relationship or conversion. Consumers must guess which is authoritative;
summaries (`summaries.ts`) duplicate the split again (`StudentAutogradeMetrics`
in marks, `StudentLevelupMetrics` in points). This is a cohesion + composability
smell — there is no shared `Score` primitive. **Recommendation:** Define one
`ScoreSchema { earned, total, percentage }` value object (optionally a
`unit: 'points'|'marks'` label) and compose it wherever a score appears, instead
of repeating four loose numeric fields. Keep both surfaces if the product truly
needs two currencies, but make the relationship explicit. **Citation:**
Composition over repeated primitives
([schema-registry best practices](https://docs.solace.com/Schema-Registry/schema-registry-best-practices.htm)).

### LD-05 · P2 · Three overlapping "assessment / timing / passing" models, not composed

**Location:** `story-point.ts:48-57` (`AssessmentConfig`:
durationMinutes/maxAttempts/passingPercentage/ adaptive/schedule/retry);
`item-payload.ts:73-78` (`assessment` item: assessmentType/durationMinutes/
passingPercentage); `exam.ts:52-77`
(duration/totalMarks/passingMarks/gradingConfig). **Issue:** "Duration",
"passing threshold", and "attempts" are modeled three times with three field
sets and **two different names for the same concept** (`passingPercentage` vs
`passingMarks`). There is also a conceptual overlap between a `StoryPoint` of
`type: 'timed_test'` and an `ItemPayload` of `type: 'assessment'` — both
describe a timed, graded unit — with no documented boundary. **Recommendation:**
Extract shared primitives `TimingConfig { durationMinutes? }` and
`PassingPolicy { passingPercentage? }` (and reuse `AdaptiveConfig`/`RetryConfig`
which are already factored well) and compose them into all three. Clarify or
collapse the timed_test-storypoint vs assessment-item overlap. **Citation:**
"Blocks built from smaller blocks" (mandate §3);
[QTI assessmentTest/section/item layering](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html).

### LD-06 · P2 · Two parallel "question" abstractions with only loose linkage

**Location:** levelup `QuestionPayload` (`item-payload.ts:17-21` → 15-type
`questionData`) vs autograde `ExamQuestion` (`exam.ts:87-105`: flat
`text/imageUrls/maxMarks/rubric/subQuestions`, `questionType` optional+unused).
Cross-links: `UnifiedItem.linkedQuestionId` (`item.ts:52`),
`ExamQuestion.linkedItemId` (`exam.ts:97`). **Issue:** "Question" means two
structurally unrelated things. That is defensible (interactive digital vs
scanned paper), but they share **no common `QuestionCore`** (text/prompt,
points/marks, rubric, topics), so improvements (e.g. a shared rubric-resolution
rule, a shared point primitive) must be made twice, and the cross-domain link is
a pair of _optional_ ids with no integrity contract. **Recommendation:** Factor
a `QuestionCore { text, rubric?, points }` (composing the LD-04 `Score`
primitive) reused by both; treat `ExamQuestion` as
`QuestionCore + scan-mapping`, and the levelup question as
`QuestionCore + interactive questionData`. Define the link cardinality/integrity
explicitly. **Citation:** Composition/DRY across bounded contexts;
[QTI shared item model](https://www.imsglobal.org/spec/qti/v3p0/oview).

### LD-07 · P2 · `RichMaterial.blocks` is `z.array(z.unknown())` although `RICH_BLOCK_TYPES` exists

**Location:** `item-payload.ts:44-47` (`blocks: z.array(z.unknown())`) vs
`enums/content.ts:88-100` (`RICH_BLOCK_TYPES`:
heading/paragraph/image/video/audio/code/quote/list/divider). **Issue:** Rich
block _types_ are enumerated but the block _shape_ is unmodeled (`unknown[]`),
while sibling material variants (story slides `:42`) are typed inline ad-hoc.
Inconsistent modeling depth in the same union; rich content gets no validation
or narrowing. **Recommendation:** A `RichBlock` discriminated union keyed by
`RICH_BLOCK_TYPES`
(`{ blockType: 'heading', level, text } | { blockType: 'image', url, alt? } | …`),
composed into `RichMaterialSchema.blocks`. Standardize story slides into the
same block vocabulary. **Citation:**
[Discriminated unions for heterogeneous content](https://zod.dev/api?id=discriminated-unions).

### LD-08 · P2 · The `{ snapshot + sourceId }` rubric binding is copy-pasted on 3 entities

**Location:** `space.ts:55-56` (`defaultRubric` + `defaultRubricId`),
`story-point.ts:75-76` (same), `item.ts:50-51` (`rubric` + `rubricId`). Note
also naming drift: Space/StoryPoint use `defaultRubric*`, Item uses `rubric*`.
**Issue:** The "denormalized snapshot + source preset id" pattern (and its
resolution semantics — which wins, when is the snapshot refreshed) is duplicated
three times rather than expressed as one composable fragment. Naming differs
between the item and its containers. **Recommendation:** Extract
`RubricBinding { rubric?: UnifiedRubric, rubricId?: RubricPresetId }` (or a
`makeRubricBinding(prefix)` shape helper) and compose; unify the field naming;
document the snapshot-vs-source precedence once. **Citation:** Composition over
copy-paste (mandate §3);
[schema-evolution: project, don't repeat](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html).

### LD-09 · P2 · `saveItem` request re-declares a subset of item fields by hand

**Location:** `save-item.ts:20-36` (`SaveItemDataSchema` lists
`title/content/difficulty/topics/labels/ orderIndex/sectionId/meta/rubricId/linkedQuestionId/deleted`
literally) — contradicting the module's own rule "the contract never re-declares
an entity shape, it projects it" (`_shared.ts:5-8`). **Issue:** The authoring
request is a hand-maintained partial of `UnifiedItem`. If `UnifiedItem` gains an
authorable field, this request silently omits it (and `.strict()` will _reject_
it), so the entity and its write contract drift. It also duplicates the field
list maintained in the entity. **Recommendation:** Derive it:
`UnifiedItemSchema.pick({...}).partial().extend({ payload: ItemPayloadSchema, deleted: … })`
(or a shared `AUTHORABLE_ITEM_KEYS` mask), so authorable fields have one source.
Same check applies to `SaveExamDataSchema` (`save-exam.ts:28-46`) which
hand-mirrors `Exam`. **Citation:**
[Zod `.pick`/`.partial` projection](https://zod.dev/api?id=discriminated-unions);
SSOT.

### LD-10 · P2 · Progress detail is a flat "bag of optionals," not discriminated by `itemType`

**Location:** `progress.ts:46-65` — `ItemProgressEntry` carries `itemType`
**and** both question-only (`questionData?`) and material-only
(`progress?/score?/feedback?`) fields flat on one object. **Issue:** It mirrors
the _item payload_ concept but, unlike `ItemPayloadSchema`, is **not** a
discriminated union — so illegal combinations (a `material` entry with
`questionData`, a `question` entry with material `progress`) are representable
and unvalidated. The model is less safe than the thing it tracks.
**Recommendation:** Make the detail a `z.discriminatedUnion('itemType', …)` (or
at least a `detail: QuestionProgress | MaterialProgress` discriminated
sub-object), reusing the item type list. **Citation:**
[Discriminated unions to forbid illegal states](https://zod.dev/api?id=discriminated-unions).

### LD-11 · P3 · `StoryPointProgress` and `StoryPointProgressDoc` are near-duplicates

**Location:** `progress.ts:67-91` — 7 identical fields; `Doc` only adds
`updatedAt` + `items`. **Recommendation:**
`StoryPointProgressDocSchema = StoryPointProgressSchema.extend({ updatedAt, items })`
(noting `Doc` drops the embedded `storyPointId` duplication question). Removes a
maintenance fork.

### LD-12 · P3 · Item difficulty/topics/successRate duplicated across item / meta / analytics

**Location:** `item.ts:42-48` (`difficulty: zDifficulty`, `topics`, `labels`) vs
`item-metadata.ts:21-30` (`bloomsLevel`, `skillsAssessed`, `successRate`) vs
`:35-41` (`analytics.difficulty: z.number()`, `analytics.topics`,
`analytics.averageScore`). **Issue:** `difficulty` exists as both an enum
(top-level) and a number (analytics); `topics` exists 2–3×; `successRate` (meta)
vs `averageScore` (analytics) overlap. Ambiguous source of truth + drift risk.
**Recommendation:** One field per concept — authored difficulty/topics on the
item, _computed_ difficulty/success metrics only in `analytics`, and document
that `analytics.*` are derived.

### LD-13 · P3 · URLs and storage paths are all bare `z.string()`

**Location:** `imageUrl` (`question-payload.ts:13`),
`url`/`embedUrl`/`promptAudioUrl`/`referenceImageUrls` (`item-payload.ts`,
`question-payload.ts:104,111`), `thumbnailUrl`/`storeThumbnailUrl`
(`space.ts:43,61`), `Exam.questionPaper.images` ("tenant storage paths",
`exam.ts:27`), `Submission.answerSheets.images`. **Issue:** No validation and —
more importantly — no type distinction between a **public URL** and a **tenant
storage path**, although the code comments rely on that distinction. Easy to
pass the wrong one. **Recommendation:** Branded `Url` and `StoragePath`
primitives (you already have a branded-id pattern at
`primitives/branded-id.zod.ts`); at minimum `z.string().url()` for true URLs.

### LD-14 · P3 · Option / criterion / dimension ids are unbranded `z.string()`

**Location:** `McqOption.id` (`question-payload.ts:11`), `BlankSlot.id` (`:67`),
`GroupOptionItem.id` (`:116`), `RubricCriterion.id` (`rubric.ts:19`),
`EvaluationDimension.id` (`rubric.ts:30`). **Issue:** Inconsistent branding
depth — top-level ids are branded, intra-document ids are plain strings, so an
option id and a blank id are interchangeable to the type system (they're
referenced by answer keys). **Recommendation:** Either brand intra-doc ids
(`OptionId`, `BlankId`) or document the deliberate choice; consistency matters
most where answer keys reference these ids by value.

### LD-15 · P3 · `ExamQuestionPaper.examType = z.literal("standard")` — a dead extensibility seam

**Location:** `exam.ts:30` (`examType: z.literal("standard")`). **Issue:** A
single-member "enum" that is always `"standard"` and is not used as a
discriminant. Either a vestigial placeholder or an intended future seam with no
second member — currently pure noise. **Recommendation:** Drop it, or promote to
a real `zEnum` discriminant if multiple exam-paper shapes are actually planned.

### LD-16 · P3 · `SubQuestion` has no id and no point-reconciliation contract

**Location:** `exam.ts:79-85` — `{ label, text, maxMarks, rubric? }`, no branded
id; nothing ties `Σ subQuestion.maxMarks` to the parent `ExamQuestion.maxMarks`.
**Recommendation:** Add a stable `id`; document/encode the marks-sum invariant
(or mark it server-enforced).

### LD-17 · P3 · `AnswerKey.questionType` can drift from the item's payload questionType

**Location:** `answer-key.ts:15` stores its own `questionType`, separate from
the item payload's `questionData.questionType`. **Issue:** Two copies of the
same discriminant in two documents with no enforced equality — a class of bug
where the key's type and the prompt's type disagree. **Recommendation:** Under
the LD-02/LD-03 registry, the key's shape _is_ selected by the item's
`questionType`; keep a single source and validate equality server-side on save.

### LD-18 · P3 · No explicit schema/version field on content entities for evolution

**Location:** entities carry `version: z.number().int().optional()` as a
_content revision_ counter (`item.ts:54`, `space.ts:68`) but there is no
**schema version** discriminator. **Issue:** R6 best practice is to stamp a
schema version so migrations/back-compat are explicit. Today the `.strict()`
rule (good for drift) makes silent additive evolution harder without a version
gate. **Recommendation:** Add a small `schemaVersion` (literal/int) to top-level
content entities to anchor future migrations; pairs with the `ContentVersion`
change-log already present. **Citation:**
[Schema evolution & compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html).

### LD-19 · P3 · Adaptive/mastery state is ad-hoc, not a reusable mastery object

**Location:** `test-session.ts:24-30` (`AdaptiveState`:
consecutiveCorrect/Incorrect, byDifficulty) + `story-point.ts:40-46`
(`AdaptiveConfig`: thresholds) + `progress.ts:23-34` (`QuestionProgressData`:
bestScore/attemptsCount/solved). **Issue:** "Mastery" is spread across three
ad-hoc shapes. Modern mastery/SRS models keep a small named per-(user,item)
state (e.g. FSRS `stability`+`difficulty`, or a mastery probability) that new
metrics attach to. Current shape makes adding a "next-review-at" or "retention"
metric a cross-entity edit. **Recommendation:** If spaced-repetition/mastery is
on the roadmap, introduce a `MasteryState` value object on
`QuestionProgressData` as the extension point; otherwise document that
adaptivity is session-scoped only. **Citation:**
[FSRS stability/difficulty model](https://github.com/open-spaced-repetition/awesome-fsrs);
[Domenic — SRS](https://domenic.me/fsrs/).

### LD-20 · P3 · `interactive` modeled twice (item type _and_ material subtype)

**Location:** `item-payload.ts:36-39` (`materialType: 'interactive'` with
`embedUrl`) vs `:65-70` (top-level `type: 'interactive'` with
`interactiveType` + `config` + `embedUrl`). **Issue:** Two overlapping
"interactive" concepts; `config: z.record(z.string(), z.unknown())` is also
untyped. Ambiguous which to author for an embed. **Recommendation:** Pick one
home for "interactive embed," or document the distinction (material-embed vs
first-class interactive item) and tighten `config`.

### LD-21 · P3 · `StoredEvaluation` re-declares 6 fields of `UnifiedEvaluationResult`

**Location:** `stored-evaluation.ts:17-28` repeats
`score/maxScore/correctness/percentage/strengths/ weaknesses/missingConcepts/mistakeClassification`
from `evaluation-result.ts:27-46`. **Issue:** A compact projection re-typed by
hand; if the full result's field types change, the compact one drifts. (This is
a _projection_, so it's the mildest case.) **Recommendation:** Derive via
`UnifiedEvaluationResultSchema.pick({...})` then add the `summary` reshape, so
the shared fields have one definition.

---

## 5. Target-design sketches (prioritized)

### 5.1 — Make the answer-stripped view _typed_ (fixes LD-01) — **highest priority**

The cleanest fix also resolves LD-02/LD-17: **answers do not belong in the
prompt payload at all** — they already live in `AnswerKey`. Remove them from the
union so the union _is_ the public view.

```ts
// question-payload.ts — PROMPT ONLY (no isCorrect / correctAnswer / modelAnswer / correctOrder …)
const McqPromptSchema = zObject({
  questionType: z.literal("mcq"),
  options: z.array(zObject({ id: zOptionId, text: z.string(), imageUrl: zUrl.optional() })),
  shuffleOptions: z.boolean().optional(),
});
// … 15 prompt schemas, answer-free …
export const QuestionPromptSchema = z.discriminatedUnion("questionType", [ McqPromptSchema, … ]);

// answer-key.ts — TYPED, discriminated, mirrors the prompt union
const McqAnswerSchema = zObject({ questionType: z.literal("mcq"), correctOptionIds: z.array(zOptionId) });
const NumericalAnswerSchema = zObject({ questionType: z.literal("numerical"), value: z.number(), tolerance: z.number().optional() });
// …
export const AnswerKeyDataSchema = z.discriminatedUnion("questionType", [ McqAnswerSchema, NumericalAnswerSchema, … ]);
```

Now `ItemViewSchema` (public) literally cannot carry an answer — a stripping bug
is a **compile error**, not a silent leak. `getItemForEdit` returns
`{ item: ItemView, answerKey: AnswerKeyData }` — answers travel on a separate,
gated field (matches QTI's body/responseDeclaration split, R3).

_If removing inline answers is too invasive short-term_, the interim is option
(B): keep authoring fields but type the public view by projection —
`PublicQuestionData = <per-variant .omit(answerKeys)>` — so `ItemViewSchema` is
provably answer-free even while the authoring schema still carries them.

### 5.2 — One registry per question type (fixes LD-02/LD-03, enables LD-17) — **high priority**

```ts
// question-types/registry.ts — the SINGLE place a question type is defined
export interface QuestionTypeSpec {
  prompt:        z.ZodType;            // answer-free prompt schema
  answer:        z.ZodType;            // typed correct-answer schema (AnswerKeyData member)
  learnerAnswer: z.ZodType;            // typed submitted-answer schema
  evaluation:    "auto" | "ai";        // replaces the parallel AUTO_/AI_ arrays
  label:         string;
  defaultRubricCategory?: RubricPresetCategory;
}

export const QUESTION_TYPE_REGISTRY = {
  mcq:        { prompt: McqPromptSchema, answer: McqAnswerSchema, learnerAnswer: McqLearnerSchema, evaluation: "auto", label: "Multiple choice" },
  numerical:  { … evaluation: "auto" … },
  paragraph:  { … evaluation: "ai" … },
  // … 15 entries …
} as const satisfies Record<string, QuestionTypeSpec>;

// EVERYTHING else is derived — no parallel lists to drift:
export const QUESTION_TYPES         = Object.keys(QUESTION_TYPE_REGISTRY) as (keyof typeof QUESTION_TYPE_REGISTRY)[];
export const QuestionPromptSchema   = z.discriminatedUnion("questionType", QUESTION_TYPES.map(t => QUESTION_TYPE_REGISTRY[t].prompt) as [...]);
export const AnswerKeyDataSchema    = z.discriminatedUnion("questionType", QUESTION_TYPES.map(t => QUESTION_TYPE_REGISTRY[t].answer)  as [...]);
export const LearnerAnswerSchema    = z.discriminatedUnion("questionType", QUESTION_TYPES.map(t => QUESTION_TYPE_REGISTRY[t].learnerAnswer) as [...]);
export const AUTO_EVALUATABLE_TYPES = QUESTION_TYPES.filter(t => QUESTION_TYPE_REGISTRY[t].evaluation === "auto");
export const AI_EVALUATABLE_TYPES   = QUESTION_TYPES.filter(t => QUESTION_TYPE_REGISTRY[t].evaluation === "ai");
```

> **Adding a new question type becomes ONE registry entry** (+ its 3 small
> schemas). The enum, the three unions, and the AUTO/AI classification all
> regenerate. This is the literal realization of the mandate's extensibility
> ("small, localized change") and composability goals. (R2 — registry for open
> extension.) The `z.discriminatedUnion(..., [...] as [...])` tuple-spread needs
> a tiny typed helper; an exhaustiveness test over `QUESTION_TYPE_REGISTRY` keys
> replaces the hand-written switch.

Then `TestSubmission.answer`, `AttemptRecord.answer`,
`recordItemAttempt.answer`, and `AnswerKey.correctAnswer` all become typed by
`questionType` instead of `z.unknown()` (LD-02).

### 5.3 — Shared scoring & assessment primitives (fixes LD-04/LD-05/LD-06)

```ts
// primitives/score.ts
export const ScoreSchema = zObject({
  earned: z.number(),
  total: z.number(),
  percentage: z.number(),
});

// content/assessment-config.ts — compose, don't repeat
export const TimingConfigSchema = zObject({
  durationMinutes: z.number().int().optional(),
});
export const PassingPolicySchema = zObject({
  passingPercentage: z.number().optional(),
});

// content/question-core.ts — shared by levelup question payload AND autograde ExamQuestion
export const QuestionCoreSchema = zObject({
  text: z.string(),
  rubric: UnifiedRubricSchema.optional(),
  score: ScoreSchema.partial().optional(), // single point/mark currency
  topics: z.array(z.string()).optional(),
});
```

`AssessmentConfig` and the `assessment` item payload then
`…extend(TimingConfigSchema).extend(PassingPolicySchema)`;
`ExamQuestion = QuestionCoreSchema.extend({ imageUrls, subQuestions, … })` and
the levelup question payload
`= QuestionCoreSchema.extend({ questionData: QuestionPromptSchema })`.

### 5.4 — Smaller composability wins

```ts
// content/rubric-binding.ts (LD-08)
export const RubricBindingSchema = zObject({
  rubric: UnifiedRubricSchema.optional(),
  rubricId: zRubricPresetId.optional(),
});
//  Space/StoryPoint/Item → …extend(RubricBindingSchema)  (unify default* vs plain naming)

// item-payload.ts (LD-07) — model rich blocks
const RichBlockSchema = z.discriminatedUnion("blockType", [
  zObject({
    blockType: z.literal("heading"),
    level: z.number().int(),
    text: z.string(),
  }),
  zObject({
    blockType: z.literal("image"),
    url: zUrl,
    alt: z.string().optional(),
  }),
  // … one per RICH_BLOCK_TYPES …
]);

// progress.ts (LD-10) — discriminate progress detail by itemType
export const ItemProgressDetailSchema = z.discriminatedUnion("itemType", [
  zObject({
    itemType: z.literal("question"),
    questionData: QuestionProgressDataSchema,
  }),
  zObject({
    itemType: z.literal("material"),
    progress: z.number(),
    score: z.number().optional(),
  }),
  // …
]);

// stored-evaluation.ts (LD-21) / save-item.ts (LD-09) — derive, don't re-declare
export const StoredEvaluationSchema = UnifiedEvaluationResultSchema.pick({
  score: true,
  maxScore: true,
  correctness: true,
  percentage: true,
  strengths: true,
  weaknesses: true,
  missingConcepts: true,
  mistakeClassification: true,
}).extend({ summary: StoredEvaluationSummarySchema.optional() });
export const SaveItemDataSchema = UnifiedItemSchema.pick({
  type: true,
  title: true,
  content: true,
  difficulty: true,
  topics: true,
  labels: true,
  orderIndex: true,
  sectionId: true,
  meta: true,
  rubricId: true,
  linkedQuestionId: true,
})
  .partial()
  .extend({ payload: ItemPayloadSchema, deleted: z.boolean().optional() });
```

---

## 6. Prioritized action list

| Priority               | Findings                          | Theme                                                                                                   | Effort                           |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **P1 (do first)**      | LD-01, LD-02                      | Type the answer/grading axis; make stripped view answer-free by type                                    | M–L (domain + server projection) |
| **P2 (extensibility)** | LD-03                             | Question-type registry → one-entry extension                                                            | M                                |
| **P2 (cohesion)**      | LD-04, LD-05, LD-06, LD-08, LD-09 | Shared Score / Timing / PassingPolicy / QuestionCore / RubricBinding primitives; derive write contracts | M                                |
| **P2 (modeling)**      | LD-07, LD-10                      | Type rich blocks; discriminate progress detail                                                          | S–M                              |
| **P3 (polish)**        | LD-11..LD-21                      | Branding, URL types, dedup fields, version stamp, dead seams                                            | S each                           |

**Bottom line:** the prompt/content modeling is genuinely good and idiomatic;
the work that most advances the mandate is to extend that same
discriminated-union + projection discipline to the **answer/grading axis**
(LD-01/LD-02) and to collapse per-type extension into a **single registry**
(LD-03) — after which "add a new question type" is one small, local change with
full type-safety on prompt, answer, learner-answer, and grading mode.

---

## Sources

- [Zod — Discriminated Unions](https://zod.dev/api?id=discriminated-unions)
- [The Strategy Pattern in TypeScript: Discriminated Unions Beat Subclasses (registry for open extension)](https://dev.to/gabrielanhaia/the-strategy-pattern-in-typescript-discriminated-unions-beat-subclasses-17na)
- [QTI 3.0 Overview](https://www.imsglobal.org/spec/qti/v3p0/oview) ·
  [QTI 3.0 ASI Information Model](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html)
  ·
  [QTI v3 Best Practices / extension points](https://www.imsglobal.org/spec/qti/v3p0/impl)
- [Confluent — Schema Evolution & Compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html)
  ·
  [Solace — Schema Registry Best Practices](https://docs.solace.com/Schema-Registry/schema-registry-best-practices.htm)
- [open-spaced-repetition / awesome-fsrs](https://github.com/open-spaced-repetition/awesome-fsrs)
  ·
  [Domenic Denicola — Spaced Repetition Systems Have Gotten Way Better](https://domenic.me/fsrs/)
