# Bug handoff — "AI provider call failed" on question extraction (prod)

**Symptom.** In deployed teacher-web, pressing **Extract Questions** fails at
Pass 1 with the UI banner: _"Question extraction failed. AI provider call
failed. Retry extraction."_ Repro exam:
https://lvlup-ff6fa-teacher.web.app/exams/66QG4dh1rXsCvXCa5n6U (caller
`subhang.rocklee@gmail.com`).

**Exact server error** (Cloud Functions log, `v1-autograde-extractQuestions`,
asia-south1, project `lvlup-ff6fa`):

```
[mapError] UNCLASSIFIED error → INTERNAL_ERROR: AiGatewayError: AI provider call failed
    at providerFailed (lib/index.js)              // packages/ai/src/errors.ts
    at Object.generate (gateway)                  // packages/ai/src/gateway.ts
    at runQuestionPass                            // packages/services/src/autograde/extract-questions.ts
    at extractQuestionsService
```

The function itself is healthy (deployed, 1024Mi/540s, auth VALID). The failure
is the **underlying LLM provider call**, and its real cause is being **masked**
by the generic `providerFailed("AI provider call failed")` wrapper — surfacing
that real cause is step 1.

---

## Where to look

- **Gateway**: `packages/ai/src/gateway.ts` — `createAiGateway().generate()`.
  - (4) key resolution `secretResolver.getApiKey(ctx.tenantId)` then
    `provider = providerFactory(apiKey, model)` (~L418-428). A key/config
    failure throws `providerFailed("AI provider configuration failed", {cause})`
    (~L433) — NOTE our message is "AI provider **call** failed", i.e. the actual
    `provider.generate` inside the retry (~L497), not config.
  - Retry/circuit-breaker wraps `provider.generate`; on failure it throws
    `providerFailed("AI provider call failed", …)` and records the circuit
    failure. The **original provider error is in the `cause`/`sanitizeError`
    path** — dig it out (add a `logger.error` of the cause at the wrap site, or
    read `sanitizeError` output) to see the true Gemini error.
- **Provider**: `packages/ai/src/provider/gemini.ts` —
  `model.generateContent(request)` with
  `generationConfig: { responseMimeType: "application/json", responseSchema: input.responseSchema as ResponseSchema }`.
- **Prompts** (mine, Pass 1/2): `packages/ai/src/prompts/registry.ts` →
  `examQuestionExtraction`, `examRubricGeneration`.
- **Caller**: `packages/services/src/autograde/extract-questions.ts` →
  `runQuestionPass` passes `responseSchema: { type: "array" }` and
  `images: [{ storagePath }]`.
- **Model defaults**: `packages/ai/src/models.ts` —
  `DEFAULT_PRO_MODEL = resolveModelDefaults(process.env).pro` (env-overridable;
  gemini-1.5 retired → 2.5 defaults). Verify the resolved model id is one the
  project's key can actually call.

## Leading hypotheses (in priority order)

1. **Invalid `responseSchema: { type: "array" }` for Gemini.** Gemini's
   structured-output `responseSchema` requires a fully-specified schema; a bare
   `{ type: "array" }` with **no `items`** is rejected by `generateContent` (400
   INVALID_ARGUMENT). Both passes use this shape, so both would fail. **Most
   likely.** Fix options: give a real array schema
   (`{ type: "array", items: { type: "object", properties: {…} } }`), or drop
   `responseSchema` and rely on `responseMimeType: application/json` + the
   prompt's explicit JSON instruction (the prompts already fully specify the
   JSON), then parse. Check whether the gemini provider or gateway
   sanitizes/validates the schema.
2. **Per-tenant Gemini API key missing/invalid in Secret Manager** for this
   exam's tenant → Gemini 401/403 during `generateContent`. Confirm the tenant
   has a stored key (per-tenant Secret Manager ref; there's also a possible env
   override). Cross-ref memory `[E2E-1 chaitanya real-data findings]`
   (key-never-stored was one of 6 P0 seam gaps) and `[FIX-1 AI image seam]`.
3. **Model id not accessible** — `DEFAULT_PRO_MODEL` resolves to a model the
   key/project can't call. Verify the env-resolved value.
4. Image inlining: `{ storagePath }` → bytes resolution in the gateway image
   store (`createAdminImageStore`, default bucket). Less likely to throw
   "provider call failed" (it throws PRECONDITION_FAILED when unwired), but
   confirm the paper images resolve.

## How to reproduce / verify

- Logs:
  `npx firebase functions:log --only v1-autograde-extractQuestions --project lvlup-ff6fa | tail -60`.
- The extraction service is unit-tested with a **fake** AI gateway (green:
  `packages/services/src/autograde/extract-questions*.test.ts`, autograde 78/78)
  — so this is a **real-provider-only** failure; the fix is in the ai package /
  config, not the service logic.
- After a fix to `packages/ai`, rebuild the chain (domain → api-contract →
  **ai** → services → functions-shared → transport-firebase → query → sdk-v1)
  and redeploy **only** `functions:sdk-v1:v1-autograde-extractQuestions` (+
  `v1-autograde-...` peers if the gemini provider changed). **Deploy runbook:
  pinned firebase-tools 13.35.1; after deploy restore
  `functions/sdk-v1/package.json` from `.bak`**
  (`mv functions/sdk-v1/package.json.bak functions/sdk-v1/package.json`).
  Deployed ids are `v1-<module>-<op>`.

## Context: what just shipped

The live two-pass extraction pipeline (Part A) + rubric-completion gate + Map &
Snipe mapping + evaluation were deployed today
(`docs/autograde-extraction/ARCHITECTURE-PLAN.md`). Everything is green with the
**fake** gateway; this is the first **real-LLM** exercise of the new
`examQuestionExtraction` prompt, and it fails at the provider boundary. The
whole tree is **uncommitted on `staging`**.

## Deliverable

1. Surface the real underlying provider error (un-mask `providerFailed`'s
   cause).
2. Fix the root cause (schema, key, or model).
3. Rebuild + redeploy the affected functions (runbook above) and confirm
   extraction succeeds on exam `66QG4dh1rXsCvXCa5n6U` (watch the RTDB
   `extractionProgress` node / the teacher-web live panel go
   extracting_questions → questions_extracted → generating_rubrics → complete).
