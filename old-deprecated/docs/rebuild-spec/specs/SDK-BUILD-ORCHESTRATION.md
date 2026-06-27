# SDK Build — End-to-End Orchestration Mandate

> For the dedicated **SDK-build coordinator**. You own this pipeline end-to-end,
> autonomously, in phases with hard gates. Enable coordinator mode first
> (`maestro coordinator enable`). Spawn every session/agent on **Opus 4.8 1M
> (`claude-opus-4-8[1m]`)**. Use **dynamic workflows** (the Workflow tool) for
> fan-out and **maestro session spawn** for parallel sessions/teams. REPORT at
> every phase gate to the parent coordinator + user. Stay in your lane: the SDK
> lives in `packages/` — do NOT touch the `docs/rebuild-spec/design/` assembly
> track (8 app SPAs) running in parallel.

## Source of truth (read first)

- `docs/rebuild-spec/specs/SDK-SERVER-DESIGN.md` (the design — extend, don't
  contradict)
- `docs/rebuild-spec/status/REVIEW-domain-data-model.md` (data-model review)
- `docs/rebuild-spec/specs/domain-and-data.md`, `common-api.md`,
  `backend-services.md`
- `docs/rebuild-spec/COMPLETE-REBUILD-SPEC.md`
- The live domain model: `packages/shared-types/src/**` and live
  `functions/*/src/callable`
- UI to cover: `docs/rebuild-spec/design/**` (115 screen specs across 5 areas,
  the 8 `build/app/*/ROUTE-TREE.md` route trees, `specs/webapps-design.md`
  per-app page inventories)

## Guiding principles (non-negotiable, from prior design decisions)

1. **Lean UI + lean-authoritative server + FAT SDK.** Logic lives once in the
   SDK; callables, triggers, and schedulers are thin shells over
   `@levelup/services`.
2. **Trust-layered packages:** `domain` (pure, shared everywhere) ·
   `repositories` (interface + admin adapter + client/callable adapter) ·
   `services/shared` (client-safe) · `services/server` (authoritative,
   server-only — NEVER bundled to client; answer-keys, grading, counters,
   claims, secrets).
3. **No direct Firestore anywhere except the repository's admin adapter.**
   Clients never touch Firestore (reads or writes). Enforce with a
   `no-restricted-imports` lint rule.
4. **Async rules:** single-writer per derived value, idempotent handlers,
   command-vs-projection split, outbox for must-deliver side-effects, Cloud
   Tasks for multi-step orchestration. Triggers + schedulers = thin over
   `services/server`.
5. **`tenantId` from claims, never request body.** Zod-at-the-boundary.
   `ALLOWED_TRANSITIONS` as build-time data.

---

## PHASE 1 — PLAN all SDK layers (dynamic workflow, multi-domain agents)

Run a dynamic Workflow with agents fanned out across ALL domains (identity,
levelup/content, autograde, analytics, progress, gamification, notification) AND
all layers (domain, repositories, services/shared, services/server,
api-contract, api-client, query/hooks, transport, realtime seam, offline seam,
the function shells: callable/trigger/scheduler).

- Produce `docs/rebuild-spec/specs/SDK-LAYERS-PLAN.md`: every package, its
  exports, the per-domain repo + service inventory, the trigger/scheduler
  inventory (thin-over-services), and the contract registry.
- **UI-COVERAGE GATE:** build a coverage matrix proving EVERY UI data-need
  (across all 115 screens / 8 route trees / per-app inventories) maps to a
  concrete SDK capability (a repo method + query hook + callable). Any uncovered
  UI need is a plan gap to close. No screen left unserved.
- **GATE 1:** plan complete + 100% UI coverage matrix.

## PHASE 2 — REVIEW team (multi-perspective consensus + fix cycle)

Spawn a review TEAM (parallel sessions/agents), each a distinct
vertical/perspective: (a) security & trust-boundary, (b) DX & API ergonomics,
(c) performance / N+1 / caching / pagination, (d) correctness & data-model
fidelity, (e) testability, (f) UI-coverage completeness, (g)
async/realtime/offline soundness, (h) migration from current code. Each
critiques the plan independently; then drive them to CONSENSUS, log dissent, and
run a review→fix→re-review loop until converged.

- Output: `SDK-LAYERS-PLAN.md` updated + `SDK-PLAN-REVIEW.md` (findings +
  resolutions).
- **GATE 2:** consensus reached, plan frozen.

## PHASE 3 — BUILD (3 parallel sessions, each a dynamic workflow)

Spawn three sessions concurrently:

1. **Mock data** — generate the FULL mock dataset based on the ENTIRE data model
   (one realistic demo tenant/client: users, memberships, classes,
   spaces→storyPoints→items, answer-keys, exams→questions,
   submissions→question-submissions, progress, summaries, gamification,
   notifications, cost logs). Structured for Firebase seeding (a config-driven,
   idempotent seed engine). Output under `packages/seed/` + the dataset.
2. **SDK implementation** — implement the ENTIRE SDK (all frozen layers) as real
   code under `packages/`.
3. **SDK tests** — comprehensive test cases for the entire SDK (unit +
   contract + integration against the emulator).

- **GATE 3:** all three produced.

## PHASE 4 — VALIDATE tests

Run the full test suite (against the Firebase emulator + seeded mock data).
Fix-loop until ALL tests pass (re-run only failing units).

- **GATE 4:** green suite.

## PHASE 5 — INTEGRATE everything (UI + domain + SDK)

Integrate the layers end-to-end: domain ↔ repositories ↔ services ↔
api-contract/client ↔ query hooks. Verify the trust split holds (client bundle
excludes `services/server`), the no-direct-Firestore lint passes, types flow
end-to-end.

- **GATE 5:** integrated, lint + typecheck green.

## PHASE 6 — WIRE UI on the SDK + SEED Firebase

- **Seed the ENTIRE mock dataset onto Firebase** (emulator first; then the
  target project if authorized) via the `packages/seed` engine — the full
  dataset, idempotent.
- Wire the UI (the web/mobile app shells) onto the SDK: hooks/repos replace any
  direct data access; the app runs against the seeded data.
- Validate a real end-to-end vertical (e.g. teacher authors → student
  learns/tests → autograde → analytics) works against seeded Firebase through
  the SDK.
- **GATE 6 (DONE):** UI runs on the SDK against fully-seeded Firebase; report
  the final state.

## Reporting

At each GATE, report to the parent coordinator + user: what completed, what's
next, any decisions needed. Surface blocking decisions immediately (don't stall
silently). Recover from rate-limits/crashes by count-gating disk and re-running
only missing units.
