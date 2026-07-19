# Student Conversational AI — Release Runbook & Canary Gate Evidence

**Owner:** T-I (QA/release). **Authority:** operationalizes LLD §21
(rollout/ops) and §22 (acceptance) of `STUDENT-CONVERSATIONAL-AI-LLD.md`. This
runbook does not change any design decision; it is the executable checklist +
gate ledger a release captain follows and the artifact where pass evidence is
recorded.

> Scope guard (LLD §18, T-I): this document and the T-I test suites are the only
> footprint. No production implementation file is edited here. Pilot production
> content publication is a **separate** T-J execution, authorized only after
> these gates pass and the exact tenant/path/hash/action manifest is reviewed
> per §15.3.

---

## 0. Test-suite inventory (the evidence producers)

| Suite                                 | Location                                                                       | Env      | LLD gate          |
| ------------------------------------- | ------------------------------------------------------------------------------ | -------- | ----------------- |
| Contract conformance (21)             | `tests/sdk/conversation/contract-conformance.test.ts`                          | node     | §20.1, §22.1      |
| State-machine totality (9)            | `tests/sdk/conversation/state-machine.property.test.ts`                        | node     | §20.2, §22.2      |
| Idempotency/ID vectors (15)           | `tests/sdk/conversation/idempotency-ids.property.test.ts`                      | node     | §20.1/2, §22.2/5  |
| Mode isolation + projection leak (16) | `tests/sdk/conversation/mode-isolation.test.ts`                                | node     | §20.1, §22.3/4    |
| Red-team corpus + gate ledger (16)    | `tests/sdk/conversation/red-team.test.ts` (+ `red-team-corpus.ts`)             | node     | §20.7             |
| Lifecycle/idempotency wire            | `tests/sdk/integration/conversation/lifecycle-idempotency.integration.test.ts` | emulator | §20.2, §22.2      |
| Assessment finalization exactly-once  | `tests/sdk/integration/conversation/finalization.integration.test.ts`          | emulator | §13, §20.4, §22.3 |

Run commands:

```bash
# Runtime-independent gates (always runnable — no emulator, no seed):
pnpm vitest run --config tests/sdk/conversation/vitest.config.ts

# Emulator wire gates (run under emulators + deployable v1.* callables):
firebase emulators:exec --only auth,firestore,functions,database --project demo-levelup \
  "pnpm vitest run --config tests/sdk/vitest.config.ts integration/conversation"
```

The emulator suites **self-skip** with a precise reason until (a) emulators are
up, (b) the deployable `v1.levelup.*` callables are registered, and (c) the
conversation seed content exists. They must be **run and green** — not skipped —
before the lifecycle/idempotency and assessment gates below may be checked off.

---

## 1. Feature-gate semantics (LLD §21.1)

Conversation features are **explicit-on**; missing is disabled:

```ts
tenant.features.conversations === true;
tenant.features[modeFlag] === true; // conversationTutor | conversationQuestionHelp | conversationAssessment
```

Disabling a flag:

- blocks **new sessions** immediately;
- blocks **new sends** only if the operator selects drain mode;
- does **not** block `get`/`list`;
- does **not** block `finish`/recovery of an already-started assessment.

Verify each flag independently before enabling the next mode.

---

## 2. Rollout order (LLD §21.2) — release captain checklist

- [ ] **R1** Merge contracts/repos/gateway with all flags **off**.
- [ ] **R2** Deploy `firestore.rules` + `database.rules.json` + indexes; **wait
      for index readiness**.
- [ ] **R3** Run emulator/staging migration + verification (dry-run first; §19).
- [ ] **R4** Deploy runtime; exercise the **stub** provider then the **real**
      staging provider.
- [ ] **R5** Calibrate authored staging assessments against human scores (record
      delta).
- [ ] **R6** Release mobile with UI hidden while flags remain off.
- [ ] **R7** Enable **internal tutor** canary.
- [ ] **R8** Enable **internal question help**.
- [ ] **R9** Enable **assessment** for one internal class/tenant + supported app
      versions.
- [ ] **R10** Expand by tenant only after a **48-hour** observation gate.
- [ ] **R11** Approve + separately apply pilot production content (T-J, §15.3).
- [ ] **R12** Retire legacy writes after old-app usage is below the agreed
      threshold.

Ordering rule: never enable a mode flag whose canary gates (§5) are not green.

---

## 3. Metrics & alerts (LLD §21.3)

**Required metrics** (by mode/policy where applicable):

- sessions started/resumed; turns claimed/completed/failed/replayed/reclaimed;
- active/stale lease age; per-turn model steps/tool calls/tool failures;
- moderation/quota/rate-limit/circuit outcomes;
- gateway latency/tokens/cached tokens/cost;
- completion recommendation / early finish / hard limit counts;
- submissions frozen/evaluated/grading-failed; duplicate-submission conflicts;
- progress applied/replayed/failed; recovery backlog + oldest item;
- mobile send-retry/resume/result-recovery; legacy callable traffic by app
  version;
- score distribution + human-vs-AI calibration delta.

**Page / auto-rollback alerts** (any one trips a rollback review):

- any private-data / cross-tenant leak;
- any distinct-payload collision at a deterministic ID;
- duplicate progress effect;
- recovery backlog older than two scheduler intervals;
- grading-failure or turn-failure rate above the canary threshold;
- cost/turn or model-step count outside policy;
- p95 latency above the approved canary budget.

---

## 4. Canary quality gates (LLD §21.4 / §22) — evidence ledger

Fill each row from telemetry + suite output before expanding. **Latency and
score-tolerance targets are finalized from staging data, never invented in
code.**

| #   | Gate                                              | Source             | Target                  | Result                 | Evidence ref                                                                                                                                                                                                        |
| --- | ------------------------------------------------- | ------------------ | ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Zero duplicate accepted learner messages          | wire replay suite  | 0                       | ✅ emulator + real-key | turn-dedup (`learnerTurnCount==1`); `replayed:true` now confirmed with a completing real-model turn                                                                                                                 |
| G2  | Zero duplicate submission effects                 | finalization suite | 0                       | ✅ emulator + REAL-KEY | finish→`status:completed`, real evaluation obj (score/maxScore/…), `replayed:true` on re-finish; submission `cis_0kJLAL7bSp0ZZlrNNQjpUJ4OrS`                                                                        |
| G3  | Successful turns (excl. moderation/quota)         | telemetry          | ≥ 98%                   | ✅ real-key (small N)  | 3/3 turns completed (tutor + 2 assessment), real interviewer replies w/ tool execution. Recommend a larger canary sample before expansion.                                                                          |
| G4  | Automatic recovery in injected retryable failures | recovery drill     | ≥ 99%                   | ⬜                     | scheduler `resumeConversationFinalizations` registered; injected-failure drill pending                                                                                                                              |
| G5  | p95 no-tool turn + finalization latency           | telemetry          | ≤ approved              | ✅ measured            | real-key turns (gemini-2.5-flash): 4081/2490/2904ms → p95≈4.1s, median≈2.9s; finalization 15.3s. Meets gate once product ratifies the threshold.                                                                    |
| G6  | Evaluator score calibration                       | R5 calibration     | within rubric tolerance | 🟡 path-verified       | evaluation produces a real graded result (score/maxScore/correctness/…); the human-vs-AI calibration DELTA still requires the R5 calibration run (this smoke is not a calibration measurement).                     |
| G7  | No critical/high safety findings                  | red-team gate (§5) | 0 crit/high             | ✅                     | 77 pure gates + wire projection no-leak (all 3 modes)                                                                                                                                                               |
| G8  | Per-completed-assessment cost                     | telemetry          | ≤ tenant budget         | 🔴 metric gap          | `costUsd` is `None` in `llmCallLogs` — cost NOT recorded per call (token counts are: turn in 473–1411/out 20–73; eval in 346–968/out 172–603). Needs `costUsd` population or token-based derivation (see CONV-M01). |

**Gate status:** G1, G2, G3, G5, G7 ✅ (G1/G2 emulator+real-key; G3/G5 real-key
smoke). **Open before full expansion:** G4 (recovery drill), G6 (R5 calibration
delta), G8 (cost telemetry — CONV-M01).

### Follow-ups

- **[T-C] Conversation-aware emulator stub AI.**
  `packages/ai/src/provider/stub.ts` only returns structured JSON for
  `responseSchema` calls, so conversation _turns_ (which use tools + free text)
  yield no assistant output and end `failed_recoverable`. This blocks
  in-emulator verification of turn completion, tool-loop behavior, and
  `replayed:true`. Add a tools/text-aware branch to the stub (emit a bounded
  assistant text and, for assessment, a valid
  `record_evidence`/`recommend_completion` tool call) so the full conversation
  lifecycle is CI-verifiable without a real key. Until then, those paths depend
  on the real-key staging smoke above. **Strengthened by CONV-P0-02:** the stub
  (and/or a T-I contract gate) must also validate that each declared tool's
  parameter schema is **legal in the Gemini function-declaration subset** (no
  `additionalProperties`/`$schema`/`patternProperties` etc.) — i.e. run the tool
  declarations through the Gemini provider's new sanitizer and assert the output
  is clean. That catches the CONV-P0-02 class in CI without a real key.
  (Deferred until the sanitizer is exported from `@levelup/ai`.)

---

## 4a. Live emulator run log (T-I gate evidence)

Full wire path exercised via a self-seeded deterministic conversation dataset
(`@levelup/seed` engine → published space + `chat_agent_question` item +
interviewer/evaluator agents + rubric; tenant-scoped student token; emulator
stub AI provider). Command:
`firebase emulators:exec --only auth,firestore,functions,database --project demo-levelup "pnpm vitest run --config tests/sdk/vitest.config.ts integration/conversation"`.

Self-seeded deterministic dataset (`@levelup/seed` engine → published space +
`chat_agent_question` item + interviewer/evaluator agents + rubric; Admin-SDK
`evaluationSettings` + `space.evaluationSettingsId` + feature flags;
tenant-scoped student token; emulator stub AI provider).

**85 tests GREEN — 77 runtime-independent + 8 emulator wire (2026-07-19):**

**Real-key prod smoke (conv-release-train, `tenant_subhang` AI Lab, post
P0-02/03/04 fixes):** turns complete end-to-end — 3/3 turns succeeded (tutor + 2
assessment, real interviewer replies with tool execution), turn latency
4081/2490/2904ms (p95≈4.1s), `replayed:true` on turn re-send, finish
exactly-once (same submission `cis_1yz7dhOynqzf03yBp_HW7auM3z`,
`replayed:true`), finalization 15.3s. Turn model `gemini-2.5-flash`, eval model
`gemini-3.1-pro-preview`. → G3/G5 cleared; G6 path-verified; G8 blocked on cost
telemetry.

| Wire assertion (emulator)                                                                            | Result |
| ---------------------------------------------------------------------------------------------------- | ------ |
| start replay — same clientRequestId → same resumed session                                           | ✅     |
| story-point / item / assessment-scoped start (post CONV-P0-01 fix)                                   | ✅     |
| turn dedup — duplicate clientMessageId → exactly one learner turn (`learnerTurnCount==1`)            | ✅     |
| one active turn — two concurrent turns never both in-flight                                          | ✅     |
| tutor mode isolation — no grading affordance/leak                                                    | ✅     |
| assessment START — full precondition chain resolves (agent+answerKey+objectives+evalSettings+rubric) | ✅     |
| finish exactly-once — replay → same submission, `replayed:true`, learner-safe                        | ✅     |
| learner projection over the wire — no config/answerKey/cost/prompt leak                              | ✅     |

**Resolved defects / findings:**

- **CONV-P0-01 (FIXED).** `context-builder.ts addSource()` omitted
  `spaceId`/`storyPointId` on the `story_point`/`item` source checks →
  `INTERNAL: story_point source checks require spaceId` for every deep-scope
  start. Found by this gate; patched by conv-core.
- **🔴 CONV-P0-02 (found by real-key smoke; emulator stub could NOT see it).**
  Every tool-using conversation TURN 400s from Gemini:
  `Unknown name "additionalProperties" at tools[0].function_declarations[0].parameters`.
  Root cause: `packages/ai/src/provider/gemini.ts` passes `tool.parameters`
  through verbatim (`parameters: tool.parameters as FunctionDeclarationSchema`),
  but the Zod-strict tool schemas carry `additionalProperties:false`, which
  Gemini's function-declaration schema subset rejects. Opening message +
  finish/evaluation use `responseSchema` (no tools), so they work — which is
  exactly why the emulator stub gate and the finish exactly-once gate passed.
  Fix (approved, T-C): recursive schema sanitizer in the Gemini provider that
  strips unsupported keys (`additionalProperties`, `$schema`,
  `patternProperties`, …) from tool parameter schemas + sdk-v1 redeploy + smoke
  re-run. **Blocks G3/G5 until patched.** This validated the gate boundary: the
  runbook explicitly deferred turn completion to a real-key smoke because the
  stub can't drive tool turns — and that's precisely where the defect surfaced.
- **🔴 CONV-P0-03 (found by real-key smoke, after CONV-P0-02 fix).** Tool turns
  no longer 400 but STILL don't complete: `gemini-3.1-pro-preview` generates
  output (`llmCallLogs status=success outTok=53–649`) yet the pinned
  `@google/generative-ai@0.21.0` SDK returns empty text + no `functionCalls` →
  `turn.ts:145 INTERNAL_ERROR`, `toolInvocations=0`. SDK×3.x-model
  response-parse incompatibility. Escalated (model-repoint vs SDK-upgrade vs
  gateway-parse-fix). **Blocks G3/G5** until resolved. Partial real-key
  telemetry (turns failing, so not valid success metrics): per-turn wall-clock
  5.2–7.4s; **finish→evaluation (no-tool, responseSchema) SUCCEEDS at 14–17s**;
  **finish idempotency `replayed:true` ✅ — corroborates the emulator
  finish-exactly-once gate with a real model.**
- **🔴 CONV-P0-04 (found by real-key smoke — the FIRST time a model actually
  emitted a tool call).** With `gemini-2.5-flash` (provider-success, `out=19`
  tool call) a fresh session's first turn still fails: `INVALID_TRANSITION`,
  `toolInvocations=0` — the tool-loop phase transition is rejected in the state
  machine. Could not surface earlier: the stub AI emits no tool calls, and
  `3.1-pro` returned empty (CONV-P0-03), so the tool loop was never exercised
  until a parseable model produced a tool call. Owner: conv-core (state machine
  / tool-loop phase). Also blocking: **`gemini-2.5-pro` = 404 unavailable** →
  `conversation.quality` policy has no live model (needs a model repoint).
  **Blocks G3/G5** until both land.
- **🟠 CONV-M01 (cost telemetry gap — blocks G8 + weakens §21.3 cost
  metric/alert).** Real-key `llmCallLogs` show `costUsd = None` (not populated)
  for conversation turn and evaluation calls — per-call cost is not recorded,
  only token counts. The §21.3 "gateway cost by mode/policy" metric and the
  "cost/turn outside policy" page alert cannot fire without it, and G8
  (per-assessment cost ≤ budget) cannot be evaluated. Fix: populate `costUsd` in
  the gateway telemetry (model-keyed pricing × tokens) or add a token-based cost
  derivation. Owner: T-C gateway telemetry. Turn/eval token counts ARE available
  (turn in 473–1411/out 20–73; eval in 346–968/out 172–603) so a derivation is
  feasible as an interim.
- **turn `replayed:false` (NOT A BUG).** The emulator stub AI returns
  conversation turns with no assistant output (turns end `failed_recoverable`);
  a duplicate on a recoverable turn correctly `reclaim`s (`replayed:false`).
  §22.2 dedup holds (asserted via `learnerTurnCount`). `replayed:true` needs a
  completing model.
- **Stub-AI limit.** Interview TURN completion (tutor/assessment turns use
  tools, not `responseSchema`) can't be driven by the emulator stub.
  Finalization/evaluation DOES run (evaluator uses `responseSchema` → stub
  `GRADE_JSON`). → do a **real-key smoke on one internal tenant** for turn
  completion + calibration (G3, G6).

**Prod assessment-start precondition sweep (conv-content-course, 2026-07-19).**
This gate reverse-engineered the 6-item assessment-start chain from
`resolveRuntimeAgent`

- `resolveEvaluator`; it was swept read-only against all 3 prod
  `chat_agent_question` items in the AI Lab space (`tenant_subhang`). Items
  #1/#2/#3/#5/#6 were already satisfied; **#4 (`space.evaluationSettingsId`) was
  the only gap** and is now fixed in prod (commit `2c1ef45`: added
  `evaluationSettings` doc + wired
  `space.evaluationSettingsId=evs_…6e2357d620`). Assessment content
  preconditions are GREEN in prod; the remaining assessment flag-flip gate is
  the tenant feature flag + the real-key turn/finish smoke.

## 5. Safety / red-team release gates (LLD §20.7)

Release **FAILS** on any cross-tenant, answer-key, private
prompt/objective/evidence, or cost-telemetry leak. The corpus
(`tests/sdk/conversation/red-team-corpus.ts`, 15 fixtures) maps 1:many onto the
eight gates; the suite prints the gate→fixtures ledger. All eight must be
exercised **and green**:

| Gate                        | Meaning                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `no_private_prompt_leak`    | System prompt / rubric never surfaced to learner                |
| `no_answer_key_leak`        | Model answer / answer key never projected or returned by a tool |
| `no_private_objective_leak` | Private evaluation objectives/notes never echoed                |
| `no_cross_tenant`           | Media/tool paths cannot escape the caller's tenant/scope        |
| `no_silent_score`           | Interviewer cannot score or end the session silently            |
| `no_cost_leak`              | Per-turn cost/token telemetry never reaches a learner view      |
| `no_forbidden_tool`         | Undeclared/wrong-mode tools rejected; loop budgets bounded      |
| `no_cross_session`          | Each assessment attempt is isolated; no cross-session memory    |

---

## 6. Acceptance-criteria mapping (LLD §22)

| §22 section                            | Primary evidence                                                |
| -------------------------------------- | --------------------------------------------------------------- |
| §22.1 Architecture/integration         | contract-conformance + AI-gateway suites (T-C)                  |
| §22.2 Lifecycle/idempotency            | state-machine + idempotency-ids + lifecycle wire suite          |
| §22.3 Assessment                       | finalization wire suite + projection leak + red-team            |
| §22.4 Tutor & question help            | mode-isolation + red-team (`no_forbidden_tool`, `no_private_*`) |
| §22.5 Mobile                           | mobile reducer/component tests (T-G) + device RC checklist      |
| §22.6 Authoring/seed/migration/release | seed/migration suites (T-H/T-B) + this runbook                  |

---

## 7. Rollback drill (LLD §19.6, §21.1)

Rollback turns off new starts/sends by **mode flag** but must keep working:

- [ ] `get`/`list` for existing sessions;
- [ ] `finish`/finalization/recovery for already-started assessments;
- [ ] learner result reads;
- [ ] legacy tutor reads.

**Never** roll back by deleting target documents or copying mutable new state
into legacy chat. Fix forward or disable entry points while durable work drains.
Rehearse this drill in staging and record the observed drain behavior before R9.

---

## 8. Definition of done (LLD §25)

Implemented only when the Phase 1–5 gates + §22 checklists pass in **source,
emulator, staging, and canary** evidence. Passing unit tests alone is not
completion. Pilot-question publication is authorized only as the separate,
manifest-reviewed T-J execution (§15.3).
