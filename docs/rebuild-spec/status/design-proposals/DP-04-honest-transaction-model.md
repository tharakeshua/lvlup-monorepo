# DP-4 · Honest transaction model (authority layer)

**Wave:** W0 (independent pure-correctness; can land first) · **Status:**
design-only · **Evidence:** `SDK-RR-T4-authority-tx.md`, SVC-1/2/3/4.

## Problem

`TxHandle` (`repo-admin/tx.ts`) exposes only `get`/`upsert` for the 13 entity
collections + `enqueueOutbox`. It has **no raw-path write and never surfaces the
real Firestore `Transaction`**. So any authority repo whose storage is a
top-level collection (`consumerProfiles`, `impersonationSessions`, `audit`) or a
subcollection (test submissions, achievements, level) **physically cannot join
the tx** → 6 sites do `void tx` + direct `.set().catch(()=>undefined)`
(fire-and-forget).

Consequences (concrete):

- **SVC-1 (P0):** `FLAT_COLLECTION.testSessions='testSessions'` (`tx.ts:34`) but
  reads bind `entity('digitalTestSessions')` (`index.ts:163`) → in-tx writes
  land in an **orphan collection** → `saveTestAnswer` tracking + `isLatest`
  demotion silently lost.
- **SVC-2 `purchaseSpace`/enroll** (`extended.ts:139`): returns success +
  `withIdempotency` **commits** that success while the `consumerProfiles` write
  is fire-and-forget. If it fails → **user paid, txnId minted, NOT enrolled, no
  error, and idempotency now blocks retry → permanently stuck.**
- **SVC-2 `testSubmissions.put`** (`extended.ts:321`): answer write
  fire-and-forget → student sees "saved", answer lost → scored 0 at submit.
- **SVC-2 `awardAchievement`/`applyLevelDelta`** (`extended.ts:370,401`):
  confirmed but **no live caller** (callers are empty stubs — NEW-2) — latent
  landmine.
- **SVC-2/SVC-3 impersonation** (`extended.ts:548,558`; `index.ts:142`):
  "fail-closed transactional ledger+audit" is **entirely fake** —
  `runTransaction` commits empty, ledger `.catch`-swallowed, audit is `void`
  fire-and-forget **hardcoded to `__platform__`** (ignores `meta.tenantId`).
  Super-admin can impersonate with **no audit trail/ledger** (SEC-04). Plus a
  3-uncorrelated-ids bug (`sessionToken` ≠ ledger doc id ≠
  `ctx.impersonationSessionId`).
- **SVC-4 `listDeadLetter`** (READ, `autograde/reads.ts:340`): calls
  `outbox.drain()` (marks ALL pending delivered) then re-enqueues as NEW docs
  with `attempts` reset → poison rows never dead-letter, races the worker,
  duplicate deliveries.
- **NEW-1 `resolveDeadLetterService`** (`autograde/resolve-dead-letter.ts:30`):
  same destructive drain on a command path but re-enqueues only the target →
  **silently drops the rest of the tenant outbox.** Strictly worse.
- **NEW-2** (`gamification.ts:232,262`): `awardAchievementsService` +
  `recomputeStudyGoalProgressService` run a real but **empty tx**
  (`void earned; void tx`) → award/recompute nothing.

**Verdict:** all 3 flagged are provably atomizable — the blocker is the
`TxHandle` surface, not Firestore (cross-collection/subcollection tx is fully
supported).

## Target design

1. **Raw escape hatch on `TxHandle`:** `getRaw(path)`, `setRaw(path, data)`,
   `newId(coll)` staging on the _real_ `Transaction`. Rewrite all 6 SVC-2/3
   sites to stage on the tx, **drop `.catch` swallow**, use the real `tenantId`
   (not `__platform__`) and token-as-doc-id.
2. **SVC-1:** `FLAT_COLLECTION.testSessions='digitalTestSessions'` + a parity
   test (`FLAT_COLLECTION` ↔ `createRepos` map for every entity key).
3. **`purchaseSpace`:** commit idempotency **after** the tx commits (or stage it
   inside the tx); release on throw.
4. **Outbox:** add non-destructive `outbox.list()`; repoint
   `listDeadLetter`+`resolveDeadLetter` to it (remove `drain` from both); give
   the DLQ its own collection/lifecycle; harden the worker `drain()` to a
   **leased per-row `pending→inflight→delivered`** claim that preserves
   `attempts`.
5. **Saga carve-out** only for non-Firestore effects (Admin Auth claims/revoke,
   Secret Manager, RTDB leaderboard) — surface failures explicitly.
   (Impersonation already correctly awaits `revokeRefreshTokens` _outside_ the
   tx.)
6. Implement or explicitly delete the empty gamification stubs.

## Tests

- `FLAT_COLLECTION` ↔ repo-map parity (SVC-1).
- enroll/purchase: simulate the second-write failure → assert the whole op rolls
  back and idempotency is NOT committed.
- impersonation: assert ledger + audit rows exist with the correct `tenantId`
  and correlated ids.
- `listDeadLetter` does not mutate outbox state.

## Closes

SVC-1, SVC-2, SVC-3, SVC-4, RR-T4 NEW-1, NEW-2, SEC-04.
