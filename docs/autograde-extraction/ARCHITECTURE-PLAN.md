# Architecture Plan — Live Question-Extraction + Rubric-Generation Pipeline (+ Map & Snipe grading alignment)

**Status:** FINALIZED with the owner (2026-07-18 design session). Decisions
below marked **[LOCKED]** were confirmed interactively; everything else is the
architect's binding design following those locks.

**Scope:** Part A = the live two-pass extraction + rubric pipeline (implement
first). Part B = the grading-pipeline redesign aligning the deployed v1 pipeline
with the reference repo's Map & Snipe architecture
(github.com/subhangR/autograde). Part B is architecture-final here but ships as
a separate implementation wave after Part A.

**Companion doc:** `HANDOFF-LIVE-EXTRACTION-PIPELINE.md` (current-state map).
Reference specs studied: `/tmp/subhangR-autograde/Claude Code POC/00–11*.md`,
`init-context.md`, `gemini-poc/architecture_and_plan.md`,
`frontend/src/services/*`.

---

## 0. Locked decisions

| #   | Decision           | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | LLM passes         | **[LOCKED]** Two passes: Pass 1 extracts questions (text/marks/order/type), Pass 2 generates rubrics. ~2× cost/latency accepted.                                                                                                                                                                                                                                                                                                                                                                                      |
| 2   | Visibility         | **[LOCKED]** Exam-keyed RTDB node; any teacher/staff/tenantAdmin in the tenant sees live progress (mirrors `gradingProgress/{t}/exam/{examId}/agg`).                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | Execution model    | **[LOCKED]** Synchronous callable with a **540s** timeout for AI-tier callables. RTDB pushes progress mid-call; the callable still returns the final result, so the `extractQuestions` contract response shape is unchanged.                                                                                                                                                                                                                                                                                          |
| 4   | Pass-1 granularity | **[LOCKED]** ONE LLM call over all question-paper images. Questions land all at once at the `questions_extracted` transition (no per-page stitching risk). UI shows an active "reading paper" phase, then renders all questions together.                                                                                                                                                                                                                                                                             |
| 5   | Pass-2 granularity | **[LOCKED]** **Batched**: questions are grouped into batches of `RUBRIC_BATCH_SIZE` (default **5**); one LLM call per batch; batches run in parallel capped at `RUBRIC_BATCH_CONCURRENCY` (default **3**). Each batch completion ticks RTDB (`rubricsGenerated += batch size`) and upserts that batch's question docs — the rubric phase is genuinely incremental in the UI.                                                                                                                                          |
| 6   | Grading scope      | **[LOCKED]** This plan ALSO redesigns the grading pipeline to the POC's Map & Snipe shape — **but split by ownership** (owner directive 2026-07-18): THIS plan owns the **mapping side** (per-page scout, deterministic aggregation w/ sandwich rule, review queue). The **actual per-question evaluation** is owned by the AI-Evaluation-Core session (`docs/api-design/AI-EVALUATION-CORE-PLAN.md` is the plan of record for grading internals); Part B here integrates against its published seam contract (§3.4). |

---

## 1. End-to-end flow (Part A)

```
Teacher clicks "Extract Questions" (ExamDetailPage)
        │  useExtractQuestions.mutateAsync({examId})           (client waits ≤540s)
        ▼
v1-autograde-extractQuestions  (sync callable, asia-south1, timeoutSeconds 540)
        │
        ├─ project RTDB  phase: "extracting_questions"          ─┐
        │                                                        │  extractionProgress/{t}/exam/{examId}/status
        ├─ PASS 1  ctx.ai.generate(examQuestionExtraction,       │        ▲
        │          all paper images, ONE call)                   │        │ useExtractionProgress(examId)
        │                                                        │        │ (RTDB onValue → phase transitions
        ├─ tx: upsert question docs (placeholder rubrics,        │        │  → refetch listQuestions)
        │      rubricStatus:"pending") + exam status             │        │
        │      → question_paper_extracted                        │   ExamDetailPage live panel:
        ├─ project RTDB  phase: "questions_extracted",           │   • phase chips / progress bar
        │      totalQuestions: N                                ─┤   • questions render at questions_extracted
        │                                                        │   • rubric badges fill per batch tick
        ├─ PASS 2  batches of 5, ≤3 in flight                    │   • error banner + targeted retry
        │    for each finished batch:                            │
        │      • upsert batch question docs (real rubric,        │
        │        modelAnswer/evaluatorGuidance INSIDE rubric,    │
        │        rubricStatus:"generated")                       │
        │      • project RTDB rubricsGenerated += batch         ─┤
        │                                                        │
        ├─ project RTDB  phase: "complete" (or "failed")        ─┘
        ▼
returns { success, questions, warnings, metadata }   (contract shape unchanged)
```

`⚷` invariant throughout: **no question text, no rubric content, no
modelAnswer/evaluatorGuidance, no cost ever rides RTDB** — the channel is slim
counters + phase only. Content is always refetched through
`v1.autograde.listQuestions`, which role-filters the ⚷ fields server-side.

---

## 2. Part A — server design

### 2.1 Extraction phase machine

New vocabulary (extraction-projection-local; does NOT touch the exam status
enum):

```
idle → extracting_questions → questions_extracted → generating_rubrics → complete
                    │                                        │
                    └──────────────► failed ◄────────────────┘
```

- `failed` carries
  `{ error, failedPhase: "questions" | "rubrics", rubricsGenerated }` so the UI
  can offer the right retry (full re-extract vs rubric-only resume).
- Exam **document** status still advances
  `question_paper_uploaded → question_paper_extracted` right after Pass 1
  persists (questions are usable/editable even while rubrics stream). Rubric
  completion is recorded on the exam as `questionPaper.rubricsGeneratedAt` (new
  optional field) — no new exam-status enum values, no state-machine churn.

### 2.2 RTDB channel

**Node:** `extractionProgress/{tenantId}/exam/{examId}/status` (leaf read by
clients; the parent stays deny-all, mirroring `gradingProgress`).

**Payload (`ExtractionStatusSchema` — slim, strict; remember teacher-web runs
`validateResponses: true`, so this must match exactly):**

```ts
zObject({
  examId: zExamId,
  phase: z.enum([
    "extracting_questions",
    "questions_extracted",
    "generating_rubrics",
    "complete",
    "failed",
  ]),
  totalQuestions: z.number().int().min(0), // 0 until Pass 1 lands
  rubricsGenerated: z.number().int().min(0),
  mode: z.enum(["full", "single", "rubrics"]).optional(),
  error: z.string().optional(), // failed only; message, never stack
  failedPhase: z.enum(["questions", "rubrics"]).optional(),
  updatedAt: z.string(),
});
```

(`extractedQuestions` from the handoff's draft is dropped: with the locked
single Pass-1 call it always equals `totalQuestions` the moment it's nonzero —
`totalQuestions` + `phase` carry the same information. Per-question rubric state
lives on the question docs as `rubricStatus`, fetched via `listQuestions`, not
in RTDB.)

**Rules (`database.rules.json`)** — copy of the
`gradingProgress/.../exam/.../agg` rule:

```json
"extractionProgress": {
  "$tenantId": {
    ".read": false, ".write": false,
    "exam": {
      "$examId": {
        ".write": false,
        "status": {
          ".read": "auth != null && (auth.token.isSuperAdmin === true || (auth.token.tenantId === $tenantId && (auth.token.role === 'teacher' || auth.token.role === 'staff' || auth.token.role === 'tenantAdmin')))"
        }
      }
    }
  }
}
```

**Write semantics:** last-write-wins overwrite of the whole `status` node per
transition (`ref.set`), except rubric ticks which use a **transaction**
incrementing `rubricsGenerated` (parallel batches complete concurrently; two
plain `update`s could lose a tick). Node is overwritten at the start of every
new run (no stale `failed` residue). Best-effort: every write is try/catch +
`logger.error` + swallow — extraction NEVER fails because the ticker couldn't
tick (identical posture to `grading-projections-rtdb.ts`).

### 2.3 Projection port + adapter + bootstrap

Mirror the AG-5 seam exactly:

- **Port**
  (`packages/services/src/autograde/pipeline/extraction-projection.ts`):
  ```ts
  export interface ExtractionStatusProjection {
    /* payload shape above */
  }
  export interface ExtractionProjectionPort {
    setStatus(
      tenantId: string,
      examId: string,
      status: ExtractionStatusProjection
    ): Promise<void>;
    bumpRubrics(
      tenantId: string,
      examId: string,
      delta: number,
      now: string
    ): Promise<void>;
  }
  export async function projectExtractionStatus(
    ctx,
    tenantId,
    examId,
    patch
  ): Promise<void>;
  // no-op when ctx.repos.extractionProjections is unwired (tests / bare emulator)
  ```
- **Adapter**
  (`packages/functions-shared/src/adapters/extraction-projections-rtdb.ts`):
  `createRtdbExtractionProjections()` — `getDatabase().ref(...)`, `set` for
  `setStatus`, `transaction` for `bumpRubrics`, log+swallow.
- **Bootstrap** (`functions/sdk-v1/src/bootstrap.ts`, inside the existing
  `if (rtdbAvailable)` block next to `gradingProjections`): inject
  `repos.extractionProjections = createRtdbExtractionProjections()`.
  Emulator-wired when `FIREBASE_DATABASE_EMULATOR_HOST` is set (same as the
  other tickers — keeps the channel e2e-testable).

### 2.4 Prompts (registry additions — do NOT mutate `questionExtraction`)

`questionExtraction` is locked by `extract-questions.contract.test.ts`; it stays
registered (marked deprecated in a comment) and the service stops using it. Two
new templates in `packages/ai/src/prompts/registry.ts`:

- **`examQuestionExtraction`** (Pass 1) — purpose `question_extraction`,
  `defaultModel: DEFAULT_PRO_MODEL`, temperature 0, structured.
  - System: extraction engine; never invent questions; preserve
    numbering/sub-parts.
  - User vars (`requiredVariables`): `examTitle`, `examType`, `totalMarks`,
    `mode`, `questionNumber` (single-mode).
  - Output per question: `text`, `maxMarks`, `order`, `questionType`,
    `subQuestions?`, `extractionConfidence`, `readabilityIssue` — **explicitly
    instructed NOT to emit rubric / modelAnswer / guidance** (that's Pass 2's
    job; keeps Pass-1 output small and fast).
- **`examRubricGeneration`** (Pass 2, batched) — purpose `question_extraction`,
  `defaultModel: DEFAULT_PRO_MODEL`, temperature 0, structured. Text-only (NO
  images — rubrics derive from question text; cheap batch calls).
  - User vars: `examTitle`, `examType`, `questions` (JSON array of
    `{order, text, maxMarks, questionType, subQuestions?}` for THIS batch).
  - Output per question, keyed by `order`: a `UnifiedRubric` —
    `scoringMode: "criteria_based"`, `criteria[]` with `modelAnswer` and
    `evaluatorGuidance` INSIDE the rubric object (the AD-11 ⚷ channel), and
    optionally `holisticGuidance`. Prompt borrows the POC's rubric anatomy
    (`01-DATA-MODELS.md` KeyPoint/partialCreditRules/commonMistakes):
    partial-credit rules and common mistakes fold into `evaluatorGuidance` text;
    keywords fold into criterion `description`.
  - **Evaluation-Core consumption contract** (agreed with the AI-evaluation-core
    session 2026-07-18 — its evaluator consumes these rubrics with zero further
    coordination; the prompt MUST enforce all of this):
    - Field names are the DOMAIN names: `criteria[].maxScore` (never `maxPoints`
      — known legacy drift), summing **exactly** to the question's `maxMarks`.
    - **Stable `criteria[].id`** on every criterion (`q{order}_c1`,
      `q{order}_c2`, …) — the evaluator's `rubricBreakdown[]` correlates on
      `criterionId`.
    - `modelAnswer`: concise; when multiple valid approaches exist, enumerate
      them (the grader accepts alternative valid solutions).
    - `evaluatorGuidance`: plain prose (partial-credit rules, common mistakes,
      acceptable variations) — **no JSON inside the string**.
    - Per-question `dimensions[]` optional; exam-level OUTPUT dimensions come
      from `EvaluationSettings.enabledDimensions`, not the per-question rubric.

### 2.5 Service redesign (`packages/services/src/autograde/extract-questions.ts`)

`extractQuestionsService` becomes a thin orchestrator over two **pure
pass-runner functions** (exported for unit tests and for a future async task
handler — the sanctioned upgrade path if 540s ever becomes insufficient):

```
runQuestionPass(exam, images, mode, questionNumber, ctx)  → ExtractedQuestionRaw[]
runRubricPass(questions, exam, ctx, onBatchDone)          → Map<order, UnifiedRubric>
```

Flow (mode `"full"`):

1. Preconditions unchanged (exam exists, images present, authorize
   `questions.extract`). Reset + project `extracting_questions` (totalQuestions
   0).
2. **Pass 1**: one
   `ctx.ai.generate({promptKey: "examQuestionExtraction", images: paths, responseSchema: {type:"array"}})`.
3. **Persist Pass 1** in one `ctx.repos.tx` (same deterministic
   `{examId}_q{order}` upsert ids — re-extract stays idempotent, P2-H): question
   docs with placeholder rubric
   `{ scoringMode: "criteria_based", criteria: [] }` + `rubricStatus: "pending"`
   (new optional doc/view field), exam → `status: "question_paper_extracted"`,
   `questionPaper.questionCount/extractedAt`. Existing draft-recovery +
   `assertTransition` logic unchanged.
4. Project `questions_extracted` (totalQuestions N).
5. **Pass 2**: chunk into batches of `RUBRIC_BATCH_SIZE=5`; run with
   `RUBRIC_BATCH_CONCURRENCY=3` (both env-overridable,
   `LEVELUP_RUBRIC_BATCH_SIZE/_CONCURRENCY`). Project `generating_rubrics`
   before the first batch. Per finished batch: upsert that batch's question docs
   (real rubric via the existing `foldGuidanceIntoRubric` semantics — guidance
   lives INSIDE `rubric`, never top-level; `rubricStatus: "generated"`), then
   `bumpRubrics(+batchCount)`.
6. All batches OK → set `questionPaper.rubricsGeneratedAt`, project `complete`.
   Return the contract response (questions now include generated rubrics;
   `metadata.tokensUsed/cost` = both passes summed).

**Failure model:**

- Pass 1 throws → project `failed {failedPhase:"questions", error}`; rethrow
  (client gets the error; exam doc untouched). Retry = press Extract again (full
  rerun).
- A Pass-2 batch fails → retry that batch once; still failing → continue
  remaining batches, then project
  `failed {failedPhase:"rubrics", rubricsGenerated: k}`. Questions stay usable
  (`question_paper_extracted` stands); docs missing rubrics keep
  `rubricStatus:"pending"`.
- **New request mode `"rubrics"`** (additive enum value on
  `EXTRACT_QUESTIONS_MODES`): skips Pass 1, loads persisted questions, runs Pass
  2 ONLY for `rubricStatus:"pending"` questions. This is the resume path the
  UI's "Retry rubric generation" button calls. `totalQuestions` projects the
  full count, `rubricsGenerated` starts at the already-generated count.
- Mode `"single"` (re-extract one question) runs Pass 1 (single-question
  variables) + a one-question Pass 2 batch, projecting the same phases with
  `mode:"single"` so watchers see the flicker but the UI can render it as a
  per-question spinner instead of the full panel.

**Callable timeout** (`packages/functions-shared/src/adapters/on-call.ts`):
`onCall({ region: REGION, cors: true, ...(def.rateTier === "ai" ? { timeoutSeconds: 540 } : {}) }, ...)`
— def-driven, no per-callable special case.

**Client timeout**
(`packages/transport-firebase/src/invoke/invoke-via-callable.ts`):
firebase-js-sdk's `httpsCallable` default deadline is **70s** and would kill the
sync call client-side. Contract-driven fix:
`httpsCallable(functions, id, CALLABLES[name].rateTier === "ai" ? { timeout: 540_000 } : undefined)`.
(Server keeps running past a client disconnect regardless — RTDB still completes
the story if the tab closes; on reopen the panel re-hydrates from the node.)

### 2.6 Contract + transport + query wiring

| Layer            | File                                                                           | Change                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscription def | `packages/api-contract/src/callables/subscriptions/extraction-status.ts` (new) | `defineSubscription({ name: "v1.autograde.extractionStatus", module: "autograde", source: "rtdb-node", params: zObject({examId: zExamId}), payload: ExtractionStatusSchema })`                |
| Registry         | `.../subscriptions/index.ts`                                                   | export + add to `SUBSCRIPTION_DEFS` (9 → 10 channels; update the header count comment)                                                                                                        |
| Wire source      | `packages/transport-firebase/src/subscribe/subscription-sources.ts`            | `"v1.autograde.extractionStatus": { backend:"rtdb", resolve: ({examId}) => ({kind:"rtdb", nodePath: \`extractionProgress/${T}/exam/${examId}/status\`}) }`(exhaustive`satisfies` forces this) |
| Cache key        | `packages/query/src/realtime/subscription-keys.ts`                             | `"v1.autograde.extractionStatus": (p) => examKeys.sub(str(p.examId), "extraction")`                                                                                                           |
| Hook             | `packages/query/src/autograde/realtime.ts`                                     | `useExtractionProgress(examId, onPayload?)` → `useSubscription("v1.autograde.extractionStatus", {examId}, onPayload)`                                                                         |
| Request enum     | `packages/api-contract/src/callables/autograde/extract-questions.ts`           | `EXTRACT_QUESTIONS_MODES = ["full","single","rubrics"]` (additive)                                                                                                                            |
| Question view    | `packages/api-contract/src/callables/autograde/_shared.ts`                     | `ExamQuestionViewSchema` + `ExtractedQuestionSchema`: add `rubricStatus: z.enum(["pending","generated"]).optional()`                                                                          |
| Exam view        | same                                                                           | `ExamQuestionPaperSchema`: add `rubricsGeneratedAt: zTimestamp.optional()` (writer must include it → remember the `extractedAt` strict-validation incident; add to the defensive reader too)  |

### 2.7 UI — ExamDetailPage live extraction panel

`apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`:

- Subscribe: `useExtractionProgress(examId, onPayload)`. The `onPayload` handler
  (custom, so the default cache write is replaced — still write the payload to
  `examKeys.sub(examId,"extraction")` first) triggers **authoritative refetches
  on phase transitions**: `questions_extracted` → `refetchQuestions()` +
  `refetch()` (exam); each `rubricsGenerated` change → debounced (~400ms)
  `refetchQuestions()`; `complete`/`failed` → final refetch of both. ⚷ content
  thus always arrives role-filtered via `listQuestions`, never via RTDB.
- Panel states:
  - `extracting_questions`: skeleton question cards + "Reading question paper…"
    shimmer over the uploaded page thumbnails.
  - `questions_extracted` / `generating_rubrics`: real question cards render
    (text/marks/type editable immediately); each card shows a rubric badge —
    spinner (`rubricStatus:"pending"`) → "Rubric ready" (`"generated"`); a
    progress bar `rubricsGenerated / totalQuestions`.
  - `complete`: panel collapses to the normal questions view (+ toast).
  - `failed`: error banner; `failedPhase:"questions"` → "Retry extraction" (mode
    full); `failedPhase:"rubrics"` → "Retry rubric generation" (mode
    `"rubrics"`, resumes missing only).
- `handleExtractQuestions` keeps `mutateAsync` (sync callable is still the
  authority + error surface) but the button/spinner state should key off the
  RTDB phase when live (fall back to local `extracting` state while
  `status !== "live"`).
- Stale-marker cleanup: the "PARITY GAP: no saveExamQuestion callable" comments
  are outdated — `v1.autograde.saveExamQuestion` exists and is wired;
  rubric/text edits after generation should persist through it (in-scope for the
  implementation wave since teachers will immediately edit generated rubrics).

### 2.8 Security invariants (Part A)

1. RTDB payload = counters + phase + error string only. Never question text,
   rubric, modelAnswer, evaluatorGuidance, cost.
2. Rules readable only by teacher/staff/tenantAdmin of the tenant (+
   superAdmin); parent node deny-all; `.write` false everywhere (Admin SDK
   bypasses).
3. ⚷ guidance persists only INSIDE `rubric` (AD-11 projection strips it for
   non-authoring roles via `listQuestions`) — `foldGuidanceIntoRubric` posture
   unchanged.
4. Strict client validation (`validateResponses: true`) means the RTDB payload
   schema and every touched response schema must match exactly — new fields must
   be optional or written by the server writer from day one.

---

## 3. Part B — grading pipeline redesign (Map & Snipe alignment)

### 3.1 Current vs POC gap analysis

| Dimension           | POC (reference repo)                                                                 | Current v1 pipeline                                                                                              | Gap                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Scout input         | ONE page per call + **full question paper text** (semantic matching: diagrams→topic) | ONE call, ALL pages, **question IDs only** (`questions.map(q => q["id"])` — the model never sees question text!) | **P0-class quality gap**: semantic matching is impossible today; unlabeled answers can't be routed  |
| Scout parallelism   | All pages in parallel (semaphore-capped)                                             | Single monolithic call                                                                                           | Latency + context-window pressure on 20–40-page sheets                                              |
| Scout output        | Per-page `found_content[]` w/ match_type, confidence, location, is_partial           | `routingMap` + per-question confidence                                                                           | No edge-case signals to aggregate on                                                                |
| Aggregation         | Deterministic layer: sandwich rule, mixed-page fan-out, orphan pages → review queue  | None (model's routingMap taken verbatim)                                                                         | Unmapped/continuation pages silently unrouted → "needs review, possibly unanswered" false negatives |
| Grading parallelism | All questions in parallel                                                            | Sequential `for` loop                                                                                            | Wall-clock: N × per-question latency                                                                |
| Context isolation   | Prompt lists other questions sharing the pages ("ignore Q3 content")                 | Absent                                                                                                           | Cross-question bleed on mixed pages                                                                 |
| Review queue        | Orphan pages + low-confidence flagged for human audit                                | needs_review on low grade-confidence + DLQ on failure (exists, good)                                             | Missing the _scout-level_ review inputs                                                             |
| Live progress       | WebSocket status events                                                              | `gradingProgress` RTDB ticker (exists, good)                                                                     | None — keep as-is                                                                                   |

Rows 1–4 (scout + aggregation) are closed by THIS plan (§3.2–3.3). Rows 5–7
(grading parallelism, context isolation, richer evaluation) are the Evaluation
Core's territory (§3.4): per-dimension structured output + rubricBreakdown come
with its schema builder; parallelism is explicitly deferred by that session;
context isolation becomes possible once it consumes my
`mapping.otherQuestionIds`.

### 3.2 Scout v2 — per-page, full-context (`processAnswerMappingService`)

- New prompt **`answerMappingPage`** (registry addition; keep `answerMapping`
  registered/deprecated): input = ONE page image + `questionsContext` = full
  JSON of `{id, order, text, maxMarks, questionType}` (from the now-rich
  extraction) + `pageIndex`/`pageCount`. Output = the POC `PageMapping` shape:
  `{ pageIndex, foundContent: [{questionId, matchType: "explicit_marker"|"semantic_context"|"continuation"|"mixed", confidence, isPartial, location?}], hasUnknownContent }`.
  Model: `DEFAULT_FLASH_MODEL` (the Scout is the cheap pass — this is the POC's
  core cost optimization; today's scout burns a Pro-sized context on all pages
  at once).
- Execution: per-page calls, concurrency-capped (reuse the Pass-2 batching
  utility from Part A; cap ~4). Per-page failure → retry once → treat page as
  unmapped (feeds the orphan flow) instead of failing the whole scout.
- Persist raw page mappings on the submission (`scoutingResult.pageMappings`)
  for the debug/audit view.

### 3.3 Aggregation layer (new, deterministic — no LLM)

New module `packages/services/src/autograde/pipeline/build-routing-map.ts`, a
pure function port of the POC algorithm (`03-ALGORITHM-PHASE1.md`):

1. Direct mapping: `questionToPages` / `pageToQuestions` from `foundContent`
   (confidence-filtered at ≥0.5).
2. **Sandwich rule**: unmapped page between two pages mapped to the same
   question → assign to that question (`edgeCases += sandwich_filled`).
3. **Mixed pages**: page with >1 question → page rides ALL those questions'
   image lists (`edgeCases += mixed_page`); record `otherQuestionsOnPages` for
   grader context isolation.
4. **Orphans**: still-unmapped pages →
   `edgeCases += orphan_page, needsReview: true`. Surface:
   `scoutingResult.unmappedPages` + a submission-level `needsScoutReview: true`
   flag when orphans exist; the review UI lists orphan page thumbnails for
   manual assignment (manual assignment writes to the qsub `mapping` via a small
   new callable — or v1: teachers see the flag + pages in the submission detail
   and use existing manual grading; manual page re-assignment is a fast-follow).
5. Output feeds the existing `QuestionSubmission` creation unchanged
   (`mapping.pageIndices/imageUrls` invariant P0-C preserved), plus each qsub
   gains `mapping.otherQuestionIds` (context isolation input).

`scoutingResult` gains
`{ pageMappings, unmappedPages, edgeCases, aggregateConfidence }` — server-only
detail; the slim RTDB ticker is untouched.

### 3.4 Question evaluation — DELEGATED to the Evaluation Core (integration contract)

**Ownership split (owner directive):** the actual per-question evaluation is
owned by the AI-Evaluation-Core session —
`docs/api-design/AI-EVALUATION-CORE-PLAN.md` (D1–D9) is the plan of record for
grading internals. This plan does NOT redesign `processAnswerGradingService`'s
evaluation logic, prompts, or output shape. Part B here = **mapping only**
(§3.2–3.3), integrating against the seam contract published by that session
(2026-07-18):

- **Seam unchanged:**
  `processAnswerGradingService({submissionId, questionIds?})` + the
  `advancePipeline` `grading` step + Cloud Tasks `(submissionId, step)` dedupe +
  watchdog re-drive all stay; internally it delegates to
  `packages/services/src/evaluation/`. Per-question execution stays
  **sequential** this phase (parallelization deferred by the evaluation session;
  each question is one independent gateway call, so it's trivial later).
- **What the evaluator reads (doc contracts my side must honor):**
  - `ExamQuestion`: `text`, `maxMarks`, `questionType`, and the **rubric
    snapshot stored at extraction time** (Part A's output) — `scoringMode`,
    `criteria[]` (correlated by `criteria[].id`), `dimensions[]?`,
    `holisticGuidance?`, ⚷ `rubric.modelAnswer` + `rubric.evaluatorGuidance`
    (inside the rubric object, AD-11). §2.4's consumption contract makes Part-A
    rubrics directly consumable.
  - `QuestionSubmission.mapping.imageUrls`: **real tenant-scoped storage paths
    (P0-C invariant preserved by my scout/aggregation rewrite)** — attached as
    `{storagePath}` gateway refs. Empty `imageUrls` ⇒ evaluator writes score 0 +
    `needs_review` (never grades blind) — so my aggregation can safely leave
    truly-unmapped questions empty.
  - `Exam.evaluationSettingsId` (top-level canonical; legacy nested fallback) →
    `EvaluationSettings.enabledDimensions` now generates the LLM responseSchema.
- **What the evaluator writes back:** richer back-compatible
  `QuestionSubmission.evaluation`
  (`score/maxScore/confidence/feedback/breakdown` +
  `strengths/weaknesses/missingConcepts/structuredFeedback/rubricBreakdown` + ⚷
  cost); `gradingStatus` vocabulary unchanged; `confidenceThreshold` HITL
  routing (default 0.7), `gradingProgress` RTDB ticks, and DLQ semantics kept
  exactly as-is. Nothing in my Part A/B UI or projections needs to change for
  this.
- **Prompt ownership:** the evaluation session owns grading prompt keys
  (`unifiedEvaluation`, PRO/temp-0; `answerGrading` back-compat). I do NOT touch
  grading prompts.
- **Context-isolation handoff (CONFIRMED both sides, 2026-07-18):** my
  aggregation writes `mapping.otherQuestionIds` (additive optional field) — the
  other questions sharing this question's mapped pages. The Evaluation Core's
  autograde prompt composer **will consume it**, appending a context-isolation
  note ("attached pages may also contain answers to {otherQuestionIds}; grade
  ONLY this question" — POC `04-ALGORITHM-PHASE2.md` Approach 1) when present;
  inert if absent.
- **Rubric-completion GATE (owner directive 2026-07-18, supersedes the earlier
  tolerate-pending stance):** an exam becomes **eligible for grading only after
  rubric generation is complete** (`questionPaper.rubricsGeneratedAt` set ⇔
  every question `rubricStatus:"generated"`). Enforcement is layered:
  1. `uploadAnswerSheetsService` precondition:
     `FAILED_PRECONDITION "rubric generation incomplete — re-run extraction (mode:'rubrics') before uploading answer sheets"`
     when `rubricsGeneratedAt` is absent.
  2. Teacher-web gates the upload/grade actions on the same field (button
     disabled + tooltip while extraction phase ≠ `complete`).
  3. The Evaluation Core's pending-rubric holistic-by-maxMarks fallback REMAINS
     as defense-in-depth only (e.g. legacy exams extracted before this pipeline,
     manual doc surgery) — it is no longer a sanctioned concurrent window.
- **Prompt-key ownership (CONFIRMED):** this plan owns `examQuestionExtraction`,
  `examRubricGeneration`, `answerMappingPage`; the Evaluation Core owns
  `unifiedEvaluation` (+ legacy `answerGrading` until retired).

### 3.5 Part B file-touch inventory (mapping side only — evaluation files owned by AI-EVALUATION-CORE-PLAN.md)

| File                                                                                                                                                        | Change                                                                                                                   | Owner                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `packages/ai/src/prompts/registry.ts`                                                                                                                       | + `answerMappingPage` (scout only; grading prompts NOT touched)                                                          | this plan                                 |
| `packages/services/src/autograde/pipeline/process-answer-mapping.ts`                                                                                        | per-page fan-out + aggregation call; `mapping.imageUrls` stays real storage paths (P0-C); + `mapping.otherQuestionIds`   | this plan                                 |
| `packages/services/src/autograde/pipeline/build-routing-map.ts` (new)                                                                                       | pure POC aggregation algorithm + unit tests (sandwich/mixed/orphan fixtures from `03-ALGORITHM-PHASE1.md`'s walkthrough) | this plan                                 |
| `packages/services/src/shared/concurrency.ts` (new, shared w/ Part A)                                                                                       | `mapWithConcurrency(items, limit, fn)` (Part A rubric batches + scout fan-out)                                           | this plan                                 |
| submission read schemas (`reads.ts`, `_shared.ts`)                                                                                                          | `scoutingResult` enrichment + `mapping.otherQuestionIds` (optional — additive)                                           | this plan                                 |
| `packages/services/src/autograde/pipeline/process-answer-grading.ts`, `resolve-rubric.ts`, `packages/services/src/evaluation/*`, `unifiedEvaluation` prompt | evaluation internals                                                                                                     | **AI-EVALUATION-CORE-PLAN.md Phases 1+3** |

---

## 4. Test plan

**Part A units (packages/services):**

- Pass orchestration: phases projected in order; RTDB spy receives
  `extracting_questions → questions_extracted → generating_rubrics → (ticks) → complete`;
  batch math (7 questions → batches of 5+2 → ticks +5, +2).
- Failure paths: Pass-1 throw → `failed/questions` + rethrow + no question docs;
  one batch fails → others complete, `failed/rubrics`, `rubricStatus` split
  persisted; `mode:"rubrics"` resumes ONLY pending.
- Idempotency: re-extract upserts same `{examId}_q{order}` ids; `mode:"single"`
  doesn't clobber `questionCount` (existing test extended).
- ⚷: generated guidance lands inside `rubric`; RTDB spy payloads never contain
  text/rubric keys (schema-strict assert).
- Prompt-contract tests for the two new templates (requiredVariables locked).
- Port no-op: everything passes with `extractionProjections` unwired.
- `on-call.ts`: ai-tier defs get `timeoutSeconds: 540`; others untouched.
  `invoke-via-callable`: ai-tier gets `{timeout: 540000}`.

**Part A e2e (emulator, pinned CLI 13.35.1 for emulators):** seed exam + images
→ call extractQuestions with fake AI gateway → REST-probe the RTDB node between
phases (the CHAT-1 probe pattern) → assert rules (student token denied, teacher
token allowed, cross-tenant denied).

**Part B units (mapping side):** `build-routing-map` against the POC walkthrough
fixtures (pages 3/8 stay orphan; page 6 mixed Q2+Q3; sandwich fill); per-page
scout fan-out degrades a failed page to unmapped (orphan flow) instead of
failing the scout; `mapping.imageUrls` remain real storage paths +
`otherQuestionIds` populated on mixed pages. Evaluation-side tests are owned by
AI-EVALUATION-CORE-PLAN.md. **Joint integration test:** Part-A-generated rubric
snapshot (stable criterion ids, maxScore sums) flows through the evaluator's
rubricBreakdown correlation.

**Contract coverage:** subscription registered ⇒ sources/keys exhaustiveness
tests pass automatically (they fail the build if forgotten — that's the point of
the `satisfies` maps).

---

## 5. Deploy runbook (per the standing gotchas)

1. Build order: domain → api-contract → services (fresh `dist` — stale-dist
   gotcha) → ai → functions-shared → transport-firebase → query → sdk-v1.
2. Deploy functions with pinned firebase-tools **13.35.1**; sdk-v1 predeploy
   strips workspace deps → **restore `functions/sdk-v1/package.json` from `.bak`
   after deploy**. Changed ids: `v1-autograde-extractQuestions` (now 540s).
3. `firebase deploy --only database` (rules) BEFORE the hosting flip
   (subscribers must be able to read the node the moment the UI ships).
4. Teacher-web hosting flip last.
5. Part B ships as its own wave with the same order; no rules changes needed
   (reuses `gradingProgress`).

---

## 6. POC → repo concept mapping (appendix)

| POC concept                                                | This repo                                                                                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 "Blueprinting" (Model C: QP → questions + rubrics) | Part A two-pass extraction (`examQuestionExtraction` + `examRubricGeneration`)                                                                  |
| Scout / Pass 1 (Flash, per-page, full QP context)          | Part B `answerMappingPage` + per-page fan-out (`DEFAULT_FLASH_MODEL`)                                                                           |
| Aggregation layer (sandwich/mixed/orphan)                  | Part B `build-routing-map.ts` (pure)                                                                                                            |
| Sniper / Pass 2 (Pro, per-question, context isolation)     | Evaluation Core (`AI-EVALUATION-CORE-PLAN.md` Phase 3) via `processAnswerGrading`; isolation input = my `mapping.otherQuestionIds`              |
| Review queue (unmapped pages)                              | `scoutingResult.unmappedPages` + `needsScoutReview` + existing needs_review/DLQ HITL (evaluator writes score-0 + needs_review on empty mapping) |
| Job status polling / WebSocket                             | RTDB projections (`extractionProgress` new, `gradingProgress` existing) — strictly better                                                       |
| KeyPoint/partialCreditRules/commonMistakes rubric          | `UnifiedRubric.criteria[]` + `evaluatorGuidance` (folded)                                                                                       |
| gemini-1.5-flash/pro                                       | `DEFAULT_FLASH_MODEL`/`DEFAULT_PRO_MODEL` (env-overridable 2.5 defaults; 1.5 retired)                                                           |

## 7. Deferred (explicitly out of scope)

- Async Cloud-Tasks execution of extraction (upgrade path preserved via the pure
  pass-runners; revisit if papers >540s appear).
- Token-level streaming of Pass-1 output (gateway doesn't stream;
  single-transition UX locked instead).
- Manual orphan-page re-assignment callable (fast-follow after Part B).
- Image-aware rubric generation for diagram-referencing questions (config flag
  idea; text-only locked for v1).
