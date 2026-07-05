# RR-T4 — Authority-layer transactions: fake tx, swallowed failures, read-side outbox mutation

**Scope:** READ-ONLY deep re-review of the authority-layer transaction theme
(SVC-2/3/4 from `SDK-REVIEW-PHASE1.md`). No code changed. **Branch:** staging ·
**Root:** `/Users/subhang/Desktop/Projects/auto-levleup` · **Reviewer:**
be-backend (services/server owner) **Verdict headline:** All three findings
CONFIRMED and worse than flagged. **Two NEW instances found** (a second
read-side `drain()` that silently DROPS sibling rows; two empty-stub tx bodies).
**All three flagged writes CAN be made truly atomic** — the blocker is the
`TxHandle` abstraction surface, not Firestore.

---

## 0. The two primitives under review (root cause for all of SVC-2/3)

### `TxHandle` (repo-admin/types.ts:99, makeTx in tx.ts)

The handle `tx()` hands to a service body exposes exactly three operations:

```
get(coll: EntityCollectionName, tenantId, id)      // 13 entity collections only
upsert(coll: EntityCollectionName, tenantId, data) // 13 entity collections only
enqueueOutbox(tenantId, entry)                      // outboxPath(tenantId)
```

`refFor()` (tx.ts:45) routes only the 13 `FLAT_COLLECTION` keys
(spaces…announcements). **There is NO way to write an arbitrary doc path through
the handle** — not a top-level collection (`consumerProfiles/{uid}`,
`impersonationSessions/{id}`, audit), not a subcollection
(`digitalTestSessions/{sid}/submissions/{itemId}`,
`students/{uid}/achievements/{id}`, `…/level/current`). The raw
`transaction: Transaction` (which _could_ write any of these) is never surfaced.

**Consequence:** every authority repo whose canonical storage is NOT one of the
13 entity collections physically cannot participate in the tx. The "solution"
the codebase reached for was to take a `tx` param, `void tx` it, and do a direct
fire-and-forget write — which is the SVC-2/SVC-3 anti-pattern. So SVC-2/3 are
not six independent bugs; they are six call-sites of one missing primitive: **a
transactional raw-path write/read on `TxHandle`.**

### `OutboxRepo` (repo-admin/types.ts:82, authority.ts:154)

Only two methods:

```
enqueue(tenantId, entry)  // coll.add(...) — always a NEW doc, status:'pending', attempts:0
drain(tenantId)           // read all status=='pending' → mark ALL 'delivered' → return rows
```

`drain()` is **destructive** ("read + clear"). There is **no non-destructive
`list/query`**. So any code that wants to _inspect_ outbox/DLQ rows is forced to
call the worker's clearing primitive — that is the root of SVC-4.

---

## 1. SVC-2 — `void tx` + `.catch(()=>undefined)` fake transactions

### Exact control flow

Pattern at
`extended.ts:139 (enroll), 321 (testSubmissions.put), 370 (awardAchievement), 401 (applyLevelDelta), 548/558 (impersonation openSession/endSession)`:

```ts
method(tx: TxLike, …): void {        // SYNC, returns void
  void tx;                            // tx discarded
  coll.doc(id).set(toFirestore({…}), { merge:true })
      .catch(() => undefined);        // promise NOT returned, NOT awaited, errors swallowed
}
```

Callers wrap these in `await ctx.repos.tx(async (tx) => { repo.method(tx, …) })`
believing the write joins the transaction. In reality:

1. The repo method returns `void` synchronously → the tx body resolves
   immediately.
2. `firestore.runTransaction` commits an **empty** transaction (no reads, no
   writes staged on `transaction`).
3. The real `.set()` runs **outside** the tx, asynchronously, often AFTER the
   callable has already returned success to the client.
4. `.catch(()=>undefined)` discards any failure
   (network/permission/quota/validation).

So "atomic" is false on every axis: not atomic, not ordered w.r.t. the response,
not awaited, not surfaced.

### Per-site failure scenario + blast radius

| Site                                                 | Live caller                                                                                                                           | Concrete failure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Blast radius                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **enroll** (139)                                     | `purchaseSpaceService` (levelup/purchase.ts:79), callable `v1.levelup.purchaseSpace`                                                  | `purchaseSpace` returns `{success:true, transactionId, enrolledSpaceId}` and `withIdempotency` **commits that success** (idempotency.ts:25) while the enrollment write is still in flight. If the `consumerProfiles/{uid}` write fails, the user is told they bought the space, a `transactionId` was minted (payment "succeeded"), but `enrolled_{spaceId}` was never written → **paid, not enrolled, no error**. Worse: the idempotency record is now `committed`, so a retry returns the cached success **without re-attempting enrollment** → user is _permanently_ stuck. | B2C purchase / store enrollment. Money-touching. The single worst case in the theme. |
| **testSubmissions.put** (321)                        | `saveTestAnswerService` (test-session.ts:132) and `submitTestSessionService` (test-session.ts:225)                                    | saveTestAnswer returns `{saved:true, answeredQuestions}`; the answer write to `digitalTestSessions/{sid}/submissions/{itemId}` is fire-and-forget. On failure the student sees "saved" but the answer is gone → at submit time that item is absent → scored 0 / ungraded. **Silent loss of student exam answers.** At submit (225) the per-question `evaluation` write-back is fire-and-forget too → session score is correct but per-question detail missing → `listQuestionSubmissions` shows ungraded while the session says graded.                                        | Digital test-taking + grading durability. Student-facing data loss.                  |
| **awardAchievement** (370)                           | **none today** — the only would-be caller `awardAchievementsService` is an empty stub (see §4 NEW-2).                                 | No live blast radius now, but it is wired into `GamificationRepo` (extended-repos.ts:114). The moment someone implements the stub to call `gamification.awardAchievement(tx,…)`, they inherit the swallow with zero signal.                                                                                                                                                                                                                                                                                                                                                    | Latent landmine; gamification (§6.9).                                                |
| **applyLevelDelta** (401)                            | **none today** (interface-only, extended-repos.ts:116).                                                                               | Same latent-landmine status; also note the body writes `{xpDelta, updatedAt}` (stores the _delta_, not an accumulated xp) — separate correctness smell.                                                                                                                                                                                                                                                                                                                                                                                                                        | Latent; StudentLevel xp authority.                                                   |
| **impersonation.openSession / endSession** (548/558) | `startImpersonationService` / `endImpersonationService` (identity/admin.ts:128,164), callables `v1.identity.{start,end}Impersonation` | See SVC-3 — the whole impersonation "fail-closed transactional ledger+audit" is fake.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Security/compliance (SEC-04).                                                        |

---

## 2. SVC-3 — `writeInTx` is the opposite of fail-closed (impersonation audit)

### Exact control flow (`repo-admin/index.ts:142`)

```ts
audit: Object.assign(auditRepo, {
  writeInTx(_tx, actorUid, action, target, meta?) {
    void auditRepo.write("__platform__", {
      actorUid,
      action,
      target,
      ...(meta ?? {}),
    });
  }, //  ^ void = fire-and-forget    ^^^^^^^^^^^ hardcoded tenant, ignores meta.tenantId
});
```

Combined with the impersonation repo (also `void tx` fire-and-forget, §1), the
`startImpersonation` "transaction" (admin.ts:127–148) stages **nothing** on the
real Firestore transaction. The header comment _"Fail-closed: ledger + audit
written transactionally WITH the mint"_ is false on three counts:

1. **Not transactional** — `_tx` is ignored; `runTransaction` commits empty.
   Ledger doc and audit row are two independent un-awaited writes.
2. **Failures dropped** — `void` (audit) and `.catch(()=>undefined)` (ledger)
   mean either or both can fail with no signal; the callable still returns
   `{sessionToken, expiresAt}` and proceeds to revoke the target's refresh
   tokens (admin.ts:151).
3. **Wrong tenant** — audit is hardcoded to `__platform__` even though
   `meta.tenantId = input.tenantOverride` is passed in. The impersonated
   tenant's audit log gets nothing.

### Failure scenario

A super-admin impersonates a user in tenant T. The session token is minted and
the target's tokens revoked, but the impersonation-session ledger write and the
audit row both silently fail (or land in `__platform__` instead of T). Result:
**impersonation succeeded with no audit trail and no ledger record** — the exact
accountability the feature exists to provide is the thing that's best-effort.
This is a SEC-04 hole, not a fail-closed control.

### Bonus correctness bug spotted in the same flow

`openSession` generates a fresh random doc id
(`impersonationSessionsCollection().doc().id`) and returns `{sessionId}`, but
`startImpersonation` **ignores that return** and returns its own `sessionToken`
(admin.ts:124,152). The ledger doc id ≠ the token the client holds.
`endImpersonation` later ends `ctx.impersonationSessionId` — a third value. The
three ids are uncorrelated; ending a session by token would never match the
ledger doc. Flagging for the target design (use the token as the doc id).

---

## 3. SVC-4 — destructive `outbox.drain()` on the read/command path

### Exact control flow

`drain()` (authority.ts:168) reads every `status=='pending'` row, marks **ALL of
them** `delivered`, and returns them. It is the delivery worker's clear
primitive. It is called in **three** places:

| Caller                                                           | Kind                                                                            | What it does after drain                                                                           | Effect            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------- |
| `outboxDrainService` (notification/triggers.ts:121)              | **worker** (correct)                                                            | delivers each row; re-enqueues failures with backoff                                               | legitimate        |
| `listDeadLetterService` (autograde/reads.ts:346)                 | **READ** (`v1.autograde.listDeadLetter`)                                        | filters to `_kind:'gradingDeadLetter'`, then re-enqueues **all** drained `entries` via `enqueue()` | see below         |
| `resolveDeadLetterService` (autograde/resolve-dead-letter.ts:30) | **COMMAND** (`v1.autograde.resolveDeadLetter`) — **NEW, not in original SVC-4** | finds the one target DLQ entry, re-enqueues **only that one**                                      | see below — worse |

### `listDeadLetterService` (the originally-flagged one) — failure scenario

A plain _read_ mutates global delivery state:

- Marks **every** pending outbox row `delivered` — including real, undelivered
  notification rows that the worker hadn't gotten to yet → those side effects
  are skipped (the worker won't re-pick a `delivered` row).
- Then `enqueue()`s the drained rows back as **brand-new docs** (`coll.add()` →
  new id) with `attempts` reset to `0` and fresh `createdAt/enqueuedAt`. So: (a)
  **attempt counters wiped** → poison rows never reach
  `MAX_ATTEMPTS`/dead-letter; (b) a concurrent worker `drain` + this `drain`
  both grab the same pending set and both re-enqueue → **duplicate rows /
  duplicate deliveries**; (c) the re-enqueue runs after the response,
  un-transactional, so a crash between drain and re-enqueue **loses every
  pending row**.

### `resolveDeadLetterService` (NEW) — strictly worse

`drain()` marks **all** pending rows delivered, but the handler re-enqueues
**only the single resolved entry**. **Every other pending outbox row — real
notifications and other DLQ entries — is marked `delivered` and never
re-enqueued → silently dropped/lost.** Resolving one dead letter therefore
swallows the entire rest of the tenant's pending outbox. Higher blast radius
than the read case.

### Blast radius

Tenant-wide outbox/notification delivery integrity. Any teacher/admin opening
the DLQ view (`listDeadLetter`) or resolving one entry (`resolveDeadLetter`)
races the notification drain worker and can drop or duplicate unrelated pending
notifications.

---

## 4. NEW instances found (beyond the three flagged)

- **NEW-1 — `resolveDeadLetterService` (autograde/resolve-dead-letter.ts:30)**:
  same destructive-`drain()`-on-a-command-path as SVC-4, and it DROPS all
  non-target pending rows (§3). Should be bundled into SVC-4.
- **NEW-2 — empty-stub tx bodies (levelup/gamification.ts:232–235, 262–265)**:
  `awardAchievementsService` and `recomputeStudyGoalProgressService` run
  `await ctx.repos.tx(async (tx) => { void earned; void tx; })` — a real (empty)
  transaction that awards/recomputes **nothing**. These are trigger-invoked
  single-writers (`onProgressWrite_awardAchievements`, recompute orchestrator)
  that are silently no-ops. This is _why_ `awardAchievement`/`applyLevelDelta`
  (§1) have no live callers. Different severity (unimplemented, not swallowed)
  but same theme: a tx that looks authoritative and isn't.
- **Swept and CLEARED:** I grepped all of `services/src` for
  `void tx`/`void _tx`, `.catch(()=>undefined)`, `void <write>`, and `.drain(`.
  The `.catch(()=>undefined)` hits outside extended.ts are benign
  (idempotency.release best-effort delete; an analytics-doc cleanup; a watchdog
  advance; test files). No additional fake-tx or read-side-mutation sites beyond
  those listed.

---

## 5. Can these be made truly transactional? — verdict: **YES for all 3 flagged; one genuine carve-out**

Firestore transactions are **cross-collection and subcollection capable** in a
single database (up to 500 writes, reads-before-writes). Nothing about enroll /
testSubmissions / impersonation-ledger+audit is structurally un-atomic — they
are all plain Firestore doc writes:

| Write                              | Path                                                              | Firestore tx-able? | Why it isn't today                               |
| ---------------------------------- | ----------------------------------------------------------------- | ------------------ | ------------------------------------------------ |
| enroll                             | `consumerProfiles/{uid}` (top-level)                              | ✅                 | `TxHandle` only routes the 13 entity collections |
| testSubmissions.put                | `…/digitalTestSessions/{sid}/submissions/{itemId}` (subcoll)      | ✅                 | handle has no raw-path write                     |
| awardAchievement / applyLevelDelta | `…/students/{uid}/achievements/{id}`, `…/level/current` (subcoll) | ✅                 | same                                             |
| impersonation ledger               | `impersonationSessions/{id}` (top-level)                          | ✅                 | same                                             |
| impersonation audit                | `…/auditLogs` (tenant-scoped)                                     | ✅                 | same                                             |

**The structural limit is the `TxHandle` surface, not the Firestore tx model.**
Give the handle a transactional raw-path read/write and every one of these
becomes a true participant.

**Genuine carve-out (cannot be in a Firestore tx):** non-Firestore side effects
— Admin **Auth** (`setCustomUserClaims`, `revokeRefreshTokens`, `createUser`,
`updateUser`), **Secret Manager** (`secrets.put`), and **RTDB** (leaderboard).
These need the saga/outbox pattern (commit intent in the tx, reconcile the
external effect after, idempotently). Note `startImpersonation` already
correctly does `claims.revokeRefreshTokens` _after_ the tx (admin.ts:151) and
awaits it — that part is fine; only the ledger+audit need to move _into_ a real
tx.

---

## 6. Target design

### 6.1 Extend `TxHandle` with a transactional escape hatch (fixes all of SVC-2/3)

```ts
interface TxHandle {
  // …existing get/upsert/enqueueOutbox…
  getRaw(path: string): Promise<Doc | null>; // transaction.get(firestore.doc(path))
  setRaw(path: string, data: Doc, opts?: { merge?: boolean }): void; // transaction.set(...)
  newId(collectionPath: string): string; // for auto-id docs (audit, ledger)
}
```

Then rewrite each repo method to **stage on the tx and stop swallowing**:

- `enroll` → `tx.setRaw(consumerProfilesDoc(uid), {…}, { merge:true })`; drop
  `void tx` + `.catch`.
- `testSubmissions.put` →
  `tx.setRaw(submissionDoc(t,sid,itemId), {…}, { merge:true })`.
- `awardAchievement` / `applyLevelDelta` → `tx.setRaw(...)` (and fix
  applyLevelDelta to read-modify-write accumulated xp, not store a bare delta —
  needs `tx.getRaw` first, reads-before-writes).
- `openSession`/`endSession` → `tx.setRaw(impersonationSessionDoc(token), {…})`
  using the **token as the doc id** (fixes the §2 id-mismatch); return that id.
- `audit.writeInTx` →
  `const id = tx.newId(auditPath(tenantId)); tx.setRaw(\`${auditPath(tenantId)}/${id}\`,
  {…})`with the **real tenantId** (thread it through; stop hardcoding`**platform**`).

Because these become synchronous _staging_ calls on the real transaction, a
failure in any one rolls back the whole `runTransaction` and propagates to the
caller — `purchaseSpace`/`startImpersonation` will actually fail instead of
lying.

### 6.2 Idempotency / rollback (purchaseSpace)

Keep the enrollment write inside the same `tx`. Move the idempotency commit so
it only records success **after** the tx commits; on tx throw, call
`idempotency.release` (already exists, authority.ts:140) so a retry can re-run.
(Today `withIdempotency` commits success unconditionally after `body()` returns
— that's what makes the enroll failure permanent.) Best: stage the `idempotency`
doc transition inside the same tx as the enrollment so dedupe + enrollment are
atomic. Enrollment is naturally idempotent (merge on `consumerProfiles/{uid}`),
so retries are safe.

### 6.3 Outbox: separate read from drain (fixes SVC-4 + NEW-1)

1. Add a **non-destructive**
   `outbox.list(tenantId, { kind?, status?, cursor?, limit? })` that only
   queries (no status mutation).
2. Repoint `listDeadLetterService` and `resolveDeadLetterService` to `list()` —
   **remove `drain()` from both**. The read path must never mutate delivery
   state; the command path must mutate only its own target row (a transactional
   `update` of that one DLQ doc), never its siblings.
3. Give the **DLQ its own lifecycle** distinct from the delivery outbox: DLQ
   entries (`_kind:'gradingDeadLetter'`) should live in a dedicated
   collection/repo (`deadLetters`) with `list` + `resolve(entryId)` that never
   touch delivery rows. Sharing `status:'pending'` with the delivery worker is
   the coupling that causes the cross-contamination.
4. Harden `drain()` itself for the worker: replace "read-all-pending +
   batch-mark-all-delivered" with a **leased/transactional claim** — flip
   `pending→inflight` (with a lease) per row in a tx, deliver, then
   `inflight→delivered`; expire stale `inflight` leases back to `pending`. This
   makes concurrent drains safe (no double-grab), makes attempts monotonic
   (re-enqueue must **preserve** `attempts`, not reset to 0), and makes delivery
   idempotent on row id.

### 6.4 Gamification stubs (NEW-2)

Implement `awardAchievementsService` / `recomputeStudyGoalProgressService` to
actually call the (now-honest) `gamification.awardAchievement` /
`applyLevelDelta` inside the tx, or explicitly mark them `// TODO unimplemented`
and have the triggers skip them — today they silently no-op while looking
authoritative.

---

## 7. Summary table

| ID                                     | Site                      | Status                                                  | Truly atomic possible? | Fix                                          |
| -------------------------------------- | ------------------------- | ------------------------------------------------------- | ---------------------- | -------------------------------------------- |
| SVC-2 enroll                           | extended.ts:139           | CONFIRMED — paid-not-enrolled + idempotency-locks-retry | ✅                     | `tx.setRaw` + idempotency commit-after-tx    |
| SVC-2 testSubmissions                  | extended.ts:321           | CONFIRMED — silent student answer loss                  | ✅                     | `tx.setRaw`                                  |
| SVC-2 awardAchievement/applyLevelDelta | extended.ts:370,401       | CONFIRMED — latent (no live caller; stubs)              | ✅                     | `tx.setRaw` (+ xp read-modify-write)         |
| SVC-2 impersonation open/end           | extended.ts:548,558       | CONFIRMED — no ledger durability                        | ✅                     | `tx.setRaw`, token-as-id                     |
| SVC-3 writeInTx                        | index.ts:142              | CONFIRMED — non-tx, fire-and-forget, wrong tenant       | ✅                     | real tx stage + real tenantId                |
| SVC-4 listDeadLetter                   | reads.ts:346              | CONFIRMED — read mutates global delivery state          | n/a (read)             | use `outbox.list`, no drain                  |
| **NEW-1** resolveDeadLetter            | resolve-dead-letter.ts:30 | NEW — DROPS all sibling pending rows                    | n/a                    | use `list` + transactional single-row update |
| **NEW-2** gamification stubs           | gamification.ts:232,262   | NEW — empty-tx no-op single-writers                     | n/a                    | implement or mark unimplemented              |
