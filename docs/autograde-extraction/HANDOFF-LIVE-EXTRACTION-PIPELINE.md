# Handoff — Live Question-Extraction + Rubric-Generation Pipeline (architecture session)

**Audience:** the Fable 5 (1M context) session spawned to finalize the flow WITH
the user and author the architecture plan. **Do NOT start implementing** — study
both repos, finalize the flow interactively with the user (use AskUserQuestion),
then write the architecture plan as a doc under `docs/autograde-extraction/`.

---

## 1. The goal (user's words)

Teacher app → exam detail page. After question papers are uploaded and **Extract
Questions** is pressed, it should:

1. Trigger an API that runs the LLM extraction.
2. Update **RTDB** with extraction status as questions are generated and as the
   rubric is generated.
3. The UI **listens to RTDB**, renders questions as they're extracted, waits for
   the rubric, then renders the rubric — **the whole live extraction + rubric
   generation is visible in the UI**.

Currently the page shows uploaded images but extraction "does nothing on the
UI." This must become a live, staged pipeline.

### Decisions already made with the user (locked)

- **Two LLM passes (true staging):** Pass 1 extracts questions
  (text/marks/order) → they render live. Pass 2 generates rubrics per question →
  they render live. (~2× LLM cost/latency accepted.)
- **Visibility:** exam-keyed RTDB node; any teacher/staff/tenantAdmin in the
  tenant watching that exam sees the live progress (mirrors
  `gradingProgress/exam/agg`).

---

## 2. External reference repo (STUDY THIS)

Cloned at **`/tmp/subhangR-autograde/`** (github.com/subhangR/autograde). It is
the reference design + a Gemini POC:

- `Claude Code POC/00-OVERVIEW.md … 11-SIMPLIFIED-DEPLOYMENT.md` — full spec:
  data models, API spec, **Phase-1 / Phase-2 algorithms**, frontend & backend
  architecture, deployment.
- `init-context.md` — the "Map & Snipe" two-pass architecture (Scout → Sniper)
  for **grading** (Pass1 = cheap vision model maps answers to pages; Pass2 =
  high-reasoning model grades). NOTE: that two-pass is about _grading answer
  sheets_; the user's current ask is the _upstream_ **question+rubric
  extraction** live pipeline. Reconcile both in the plan.
- `frontend/`, `gemini-poc/`, `gemini-docs`, `gemini-api-keys` — the POC
  implementation to mine for the intended UX + prompt shapes.

Read the POC docs fully; the user wants their architecture incorporated/aligned.

---

## 3. Current repo state — extraction pipeline map (v1 backend)

**Extraction is currently ONE synchronous LLM call**, no RTDB, no staging:

- **Service:** `packages/services/src/autograde/extract-questions.ts` —
  `extractQuestionsService(input, ctx)`. Single
  `ctx.ai.generate({ promptKey: "questionExtraction", images: [{storagePath}], responseSchema:{type:"array"} })`
  returns questions WITH rubric+modelAnswer+evaluatorGuidance folded in
  (`foldGuidanceIntoRubric`, lines 36-49). Persists question docs
  `{examId}_q{order}` (`_kind:"examQuestion"`) + sets exam
  `status:"question_paper_extracted"`, `questionPaper.questionCount/extractedAt`
  in one `ctx.repos.tx`. Returns `{success, questions, warnings, metadata}`.
- **AI seam:** `ctx.ai.generate(input, {tenantId, uid, now, examId})` →
  `{ text, json, tokensUsed, costUsd, model }`. Interface:
  `packages/services/src/shared/ai.ts`. Gateway: `packages/ai/src/gateway.ts`.
  Prompts registry: `packages/ai/src/prompts/registry.ts` (`questionExtraction`
  prompt lines 43-63; add `examQuestionExtraction` + `examRubricGeneration` for
  the two passes — do NOT mutate `questionExtraction`, it's locked by
  `extract-questions.contract.test.ts`).
- **Callable wiring:** `functions/sdk-v1/src/autograde.ts` —
  `extractQuestions = call("v1.autograde.extractQuestions", services.extractQuestionsService)`
  → deployed id `v1-autograde-extractQuestions` (asia-south1). Contract:
  `packages/api-contract/src/callables/autograde/`.

### RTDB live-subscription infrastructure (the pattern to copy)

Existing live channel to mirror: **`v1.autograde.examGrading`** →
`gradingProgress/{t}/exam/{examId}/agg`.

- **Contract def:**
  `packages/api-contract/src/callables/subscriptions/exam-grading.ts` (+
  register in `.../subscriptions/index.ts` `SUBSCRIPTION_DEFS`). Uses
  `defineSubscription({name, module, source:"rtdb-node", params, payload})`.
  Payload MUST be a **slim projection** — no ⚷ (answer key / rubric guidance /
  cost), no pre-release scores.
- **Wire source:**
  `packages/transport-firebase/src/subscribe/subscription-sources.ts` — add
  `"v1.autograde.extractionStatus": { backend:"rtdb", resolve:({examId})=>({kind:"rtdb", nodePath:`extractionProgress/${T}/exam/${examId}/status`}) }`.
  (`T`=tenant placeholder.) Exhaustive `satisfies` map — every registered sub
  needs a source.
- **Server projection port:** template
  `packages/services/src/autograde/pipeline/grading-projection.ts`
  (`GradingProjectionPort` optional on `ctx.repos`, no-op if unwired). Create an
  `ExtractionProjectionPort` +
  `projectExtractionStatus(ctx, tenantId, examId, patch)`.
- **RTDB adapter:**
  `packages/functions-shared/src/adapters/grading-projections-rtdb.ts` → create
  `extraction-projections-rtdb.ts` (`getDatabase().ref(...).update/transaction`,
  best-effort, errors logged+swallowed).
- **Bootstrap wiring:** `functions/sdk-v1/src/bootstrap.ts` (~lines 146-152) —
  inject `createRtdbExtractionProjections()` onto `repos.extractionProjections`
  when `rtdbAvailable`.
- **RTDB rules:** `database.rules.json` — add
  `extractionProgress/$tenantId/{.read:false,.write:false}/exam/$examId/status`
  readable by teacher/staff/tenantAdmin of the tenant (copy the
  `gradingProgress/.../exam/.../agg` rule).
- **Query hook:** `packages/query/src/autograde/realtime.ts`
  (`useExamGradingProgress` template) → add `useExtractionProgress(examId)` over
  `useSubscription("v1.autograde.extractionStatus", {examId})`. Cache key in
  `packages/query/src/realtime/subscription-keys.ts`
  (`examKeys.sub(examId,"extraction")`). `useSubscription` supports an
  `onPayload(payload, qc)` callback — use it to refetch the questions list from
  Firestore on each phase transition (keeps ⚷ rubric guidance OUT of RTDB;
  authoritative role-filtered read via the existing questions callable).
- **UI:** `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx` —
  `handleExtractQuestions` (line ~394), questions render section (~700-960).
  Build the live extraction panel: subscribe via `useExtractionProgress`, show
  phase (extracting_questions → questions_extracted → generating_rubrics →
  complete/failed), stream questions in as they appear, then rubrics.

### Proposed RTDB payload (finalize with user)

`extractionProgress/{t}/exam/{examId}/status` =
`{ examId, phase, totalQuestions, extractedQuestions, rubricsGenerated, error?, updatedAt }`.
Phases:
`extracting_questions | questions_extracted | generating_rubrics | complete | failed`.
Slim only — actual question text/rubric are refetched from Firestore on phase
change (⚷ stays server-side, role-filtered).

### Open design questions to finalize WITH the user

1. **Sync-in-callable vs async job:** a single callable can run both passes
   server-side (timeout 540s) and write RTDB between them → live updates arrive
   mid-callable (RTDB pushes independently of the HTTP response). Simpler than
   Cloud Tasks. Confirm this is acceptable vs a fully async queued job.
2. **Rubric pass granularity:** one Pass-2 call for all questions vs one call
   per question (N calls, more parallelism/live-granularity, higher cost). The
   external POC favors per-question parallelism.
3. **Whether to also align/absorb the "Map & Snipe" grading pipeline from the
   reference repo, or scope THIS plan to extraction+rubric only.**
4. Failure/retry UX (partial extraction, `failed` phase, re-extract).

---

## 4. Current deployed state (already fixed + shipped by the prior session)

- Fixed "Exam not found": v1 writer omitted required `questionPaper.extractedAt`
  → strict getExam response validation threw client-side. Fixed writer +
  defensive reader. **Deployed** (`v1-autograde-saveExam`,
  `v1-autograde-getExam`).
- Fixed publish: exam stayed `draft` after upload → `draft→published` rejected.
  Added status auto-advance (`saveExamService`), extract tolerance of stuck
  `draft` (`extractQuestionsService`), frontend button gating. **Deployed**
  (`v1-autograde-saveExam`, `v1-autograde-extractQuestions`, teacher-web
  hosting).
- All changes UNCOMMITTED on `staging`. Deploy runbook: pinned firebase-tools
  **13.35.1**; sdk-v1 predeploy strips workspace deps → **restore
  `functions/sdk-v1/package.json` from `.bak` after deploy**. Deployed ids are
  `v1-<module>-<op>`.

Key memory: `validateResponses` is literal `true` in teacher-web
(`apps/teacher-web/src/sdk/api.ts:66`) — every RTDB payload AND callable
response is strict-validated client-side; slim projections must match their
schema exactly.

---

## 5. Your deliverable

1. Study `/tmp/subhangR-autograde/` (all POC docs) + this repo's extraction/RTDB
   code.
2. **Finalize the flow WITH the user** (AskUserQuestion for the open questions
   above + anything the POC surfaces).
3. Author `docs/autograde-extraction/ARCHITECTURE-PLAN.md` — the full plan: data
   model, RTDB channel + rules, two-pass service design (prompts, phases,
   projection writes), client hook + UI, contract/transport wiring, test plan,
   deploy steps. Do not implement code in this session unless the user
   explicitly asks.
