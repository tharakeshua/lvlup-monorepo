# tests/sdk/conversation — Conversational-AI QA suites (T-I)

Cross-package QA evidence for the Student Conversational AI runtime, authored
against the FROZEN contracts in
`docs/api-design/STUDENT-CONVERSATIONAL-AI-LLD.md` (§20 test strategy, §21
rollout, §22 acceptance). Owned by workstream **T-I**; contains only new
cross-cutting test/release files — no production implementation.

## Two layers

### 1. Runtime-independent (this directory) — always runnable

No emulator, no seed, no running services. Imports the FROZEN schemas from
`@levelup/domain` + `@levelup/api-contract` (built dist) and the pure service
logic from `packages/services/src/conversation/*` **source** (vitest transpiles
TS; no `dist` required). Its own vitest project so it never boots the emulator.

```bash
pnpm vitest run --config tests/sdk/conversation/vitest.config.ts
```

| File                                      | Tests | Proves (LLD)                                                                                                                                                                                                                          |
| ----------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract-conformance.test.ts`            | 21    | strict/unknown-key rejection; mode↔context union; status/turn enum totality; **no tenantId in any request**; StartContext omits `attemptNumber`; callable idempotency/authority flags (§20.1, §22.1)                                  |
| `state-machine.property.test.ts`          | 9     | `canSend/canFinish/canAbandon` over the full status×activeTurn×hardLimit cross-product; terminal blocks all; hard-limit assessment can finish but not abandon; turn-status totality; assessment-only `ready_to_finish` (§20.2, §22.2) |
| `idempotency-ids.property.test.ts`        | 15    | deterministic session/turn/message/submission IDs + collision-mismatch; `contextKey` attempt isolation; lease fencing math; canonical-hash order-independence (§20.1/2, §22.2/5)                                                      |
| `mode-isolation.test.ts`                  | 16    | per-mode tool allowlists; assessment has no context-retrieval/scoring tool; learner projection **leak-scan** (session/summary/turn/message, all 3 modes); action affordances (§20.1, §22.3/4)                                         |
| `red-team.test.ts` + `red-team-corpus.ts` | 16    | 15-fixture prompt-injection corpus over 8 §20.7 release gates: cross-tenant media path, wrong-mode draft, input/draft/media limits, forbidden-tool allowlist, projection leak/cost gates                                              |

Private-data leak proofs use greppable sentinels seeded into `_fixtures.ts`
(`PRIVATE_SENTINELS`); a single deep JSON scan fails on ANY appearance of a
system prompt, answer key, private rubric/objective, evaluator policy, config
snapshot, or cost telemetry in a learner projection.

### 2. Emulator wire suites — `tests/sdk/integration/conversation/`

Full client → transport → `v1.levelup.*` callable → services → Firestore path.
Picked up by the existing `sdk-integration` vitest project. **Self-skip** with a
precise reason until emulators + deployable callables + conversation seed
content are ready (conv-core convergence green), so they are safe to land during
the parallel build. They must be **run and green** — not skipped — before the
lifecycle/idempotency and assessment canary gates are checked off.

```bash
firebase emulators:exec --only auth,firestore,functions,database --project demo-levelup \
  "pnpm vitest run --config tests/sdk/vitest.config.ts integration/conversation"
```

- `lifecycle-idempotency.integration.test.ts` — start replay (resumed), turn
  duplicate-clientMessageId replay (one accepted message), one-active-turn,
  wire-projection leak scan, tutor mode isolation.
- `finalization.integration.test.ts` — finish replay = one immutable submission;
  learner-safe finish result; generic practice cannot regrade. Needs an
  assessment (`chat_agent_question`) seed — probes for it and skips until
  present.

## Release evidence

Gate ledger, rollout order, canary quality gates, metrics/alerts, and the
rollback drill live in `docs/api-design/CONVERSATION-RELEASE-RUNBOOK.md`.
