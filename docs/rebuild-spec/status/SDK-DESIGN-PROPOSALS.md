# Fat-SDK — Holistic Design Proposals (target architecture)

**Author:** Program-Lead 🧭 · **Date:** 2026-06-27 · **Branch:** `staging` ·
**Status:** DESIGN-ONLY — no code changed, awaiting USER approval.

This document is the **rethink** requested after Phase-1 review + the 4 deep
re-reviews. It does not list fixes patch-by-patch; it steps back and proposes
the **solid target design** that resolves every finding _by construction_, then
maps each proposal back to the findings it closes and sequences the rollout.

**Source evidence:** `SDK-REVIEW-PHASE1.md` (+R1–R4),
`SDK-REVIEW-A-LEARNING-DOMAIN.md`, `SDK-REVIEW-B-IDENTITY-DOMAIN.md`,
`SDK-RR-T1-canonical-seam.md`, `SDK-RR-T2-registries.md`,
`SDK-RR-T3-answer-axis.md`, `SDK-RR-T4-authority-tx.md`.

---

## 0. The five design principles (everything below follows from these)

1. **One source of truth, derive the rest.** No shape declared twice. Enums,
   unions, maps, claim fields, classification arrays are _derived_ from a single
   declaration via `as const satisfies`. Drift becomes impossible, not merely
   discouraged.
2. **Make illegal states unrepresentable.** Security and correctness invariants
   should be _types_, not conventions. A public item that _cannot_ hold an
   answer. A transaction handle that _cannot_ do a non-atomic write. A claim
   that _cannot_ carry an empty tenantCode.
3. **Honest effects.** An API that returns "success" must have _committed_
   success. A `tx` parameter must mean atomic. A read must not mutate. Failures
   surface; they are never `.catch(()=>undefined)`.
4. **Layer purity, enforced.**
   `domain ← api-contract ← api-client ← repositories ← query`; apps touch only
   `query` + `domain`. The lint gate is **green and load-bearing**, not
   committed red.
5. **The foundation is sound — extend it, don't replace it.** The dep graph,
   strict-Zod chokepoint, discriminated unions, table-driven access policy,
   claim-derived tenancy, and single-mint primitives are _good_. Every proposal
   builds on them.

---

## DP-1 · Canonical transport seam lives in `@levelup/api-contract`

**Problem it solves:** 8 canonical types hand-copied across 24 sites, 6 with
real drift; `transport-http` not swappable with `transport-firebase`;
**`createApiClient` never wires `.storage` → TypeError on first upload (live
runtime bug)**.

**Design:** create `packages/api-contract/src/transport/` as the single home for
`Transport`, `StorageTransport`, `SubscriptionHandle`, `SubscriptionCallbacks`,
`SubscriptionStatus`, and the wire envelope
`PageRequest`/`PageResponse`/`SaveResponse`/`Callable`. Every implementer
(`transport-firebase`, `transport-http`, `realtime`) and every consumer
(`api-client`, all `repositories/**/api-types.ts`, `query/provider`) imports
from there. _Not_ a new `@levelup/seam` leaf — these types reference
api-contract-owned generics (`CallableName`, `ReqOf`, `ApiErrorDetails`), so a
leaf would depend on api-contract anyway (zero gain, +6 edges). **Zero cycle
risk** (api-contract deps = domain + zod; all consumers already import it).

**By-construction wins:** the one `Transport` carries `storage` →
`transport-http`'s missing storage becomes a _compile error_ (correct signal
it's a stub); wiring `transport.storage` in `createApiClient` kills the runtime
bug; `ApiClientLike` becomes `Pick<ApiClient,…>` of the _real_ surface (no
hand-copy).

**Keep separate (do not over-unify):** query's intentionally-widened
`invoke(string, unknown)`; domain's branded `PageParams/Cursor` (wire boundary);
the AiGateway port — its home is `@levelup/ai`, not api-contract
(`functions-shared` adds an `@levelup/ai` dep; fixes the
`promptTokens`-vs-`inputTokens` + missing-`text` bug).

**Closes:** TR-1, TR-2 (incl. runtime bug), REPO-4, MISC-3, MISC-11,
LB-03/Q-DUP-1, + ~8 dup clusters (~13 findings).

---

## DP-2 · Registry-driven extensibility (the core of the mandate)

**Problem it solves:** adding a question type = ~9 edit points / 5 files with
two parallel grading arrays that silently drift; adding a role = ~18 sites; live
drift already exists (`TEACHER/STAFF_PERMISSION_KEYS` differ between domain and
seed; runtime vs seed claim-builders diverge; `scanner` omitted in 2 places).

**Design A — `QUESTION_TYPE_REGISTRY`** (in `domain`), one entry per type:

```ts
const QUESTION_TYPE_REGISTRY = {
  mcq: { prompt: McqPrompt, answer: McqAnswerKey, learnerAnswer: McqLearnerAnswer,
         evaluation: 'auto', label: 'Multiple choice', sample: () => ({...}) },
  // …14 more
} as const satisfies Record<string, QuestionTypeDef>
```

The registry **is** the SSOT. Derive from it:
`QuestionType = keyof typeof REGISTRY`, `zQuestionType`, the three discriminated
unions (`QuestionPromptSchema` / `AnswerKeyDataSchema` / `LearnerAnswerSchema`),
and the `AUTO_*` / `AI_*` classification arrays. A 16th type = **one entry**
(proven). Legacy `QUESTION_TYPE_MAP`/`buildQuestionData` stay as an
anti-corruption adapter for old vocab only.

**Design B — `ROLE_DESCRIPTORS`** (spanning `domain` + `access`), one entry per
role:

```ts
const ROLE_DESCRIPTORS = [
  {
    role: "teacher",
    rank: 40,
    idField: "teacherId",
    idBrand: zTeacherId,
    repoKey: "teachers",
    profileSchema: TeacherProfile,
    scope: "tenant",
    provisionable: true,
    authoring: true,
    permissionSet: TEACHER_PERMISSION_KEYS,
  },
  // …
] as const satisfies readonly RoleDescriptor[];
```

Derive: `TENANT_ROLES`, `ROLE_RANK`, `isAuthoringRole`, the `EntityIds` type,
`repoKeyForRole`/`idFieldForRole` (kills the `org-users` ternary +
`entityRepoByRole` literal), and the per-role id fields on
claims/membership/links. A new role = **one descriptor append + one branded-id
line + N intentional `ACCESS_RULES` lines**.

**Stays manual by design:** the per-type Zod schemas (intrinsic content — but
they _live inside the one entry_); `ACCESS_RULES` authorization intent (a
security decision, must never be auto-derived). One small tuple/brand cast
helper per registry is the only static-typing friction (runtime is already
correct).

**Closes:** LD-03, B-IDN-12, B-IDN-13, B-IDN-23, RR-T2-A/B/C; and structurally
prevents this entire bug class going forward.

---

## DP-3 · Typed answer/grading axis + QTI-style item split + server re-validation

**Problem it solves (the most serious correctness/security item):**
`ItemView === UnifiedItem` (same type) + `.optional()` answer fields → the
public view is stripped by a hard-coded _name list_ (`ANSWER_KEY_FIELDS`) that
is **disjoint from `isCorrect`/`correctOrder`/`MatchPair.right`** → **those
answer fields leak to learners today** on canonical items. The answer axis is
`z.unknown()` end-to-end (6 sites); the server **coerces** rather than
re-validates.

**Design (QTI `itemBody`/`responseDeclaration` split):**

- **Remove answer fields from the prompt union entirely.** The prompt schema
  (and thus `ItemView`) becomes _structurally_ answer-free → a leak is a
  **compile error**; `stripAnswerFields`/`ANSWER_KEY_FIELDS` become deletable.
- **Answers live only in the typed `AnswerKeyData` discriminated union** (from
  DP-2's registry), in the deny-all `AnswerKey` subcollection, re-merged solely
  by `getItemForEdit`.
- **`LearnerAnswer` is a typed discriminated union** (registry-bound) replacing
  all 6 `z.unknown()` sites.
- **Server guard `parseLearnerAnswer(questionType, raw)`** at the top of
  `recordItemAttempt` / `evaluateAnswer` / `saveTestAnswer` /
  `submitTestSession` — re-validates per type before grade/persist (closes
  F-SSOT-04; bounds storage; fixes coercion-driven correctness flips).

**Migration:** legacy stored answers won't satisfy strict unions →
`schemaVersion`-gated upgrade coercer or seed backfill; canonical items already
carrying leaked fields need a backfill; the SUB001 migration must emit the typed
split; removing inline prompt fields is a wire break → ship behind the
api-contract seam (interim = per-variant `.omit` projection).

**Closes:** LD-01 (incl. the live leak), LD-02, F-SSOT-04, LD-10.

---

## DP-4 · Honest transaction model (authority layer)

**Problem it solves:** `TxHandle` exposes only get/upsert for the 13 entity
collections — **no raw-path write, never surfaces the real `Transaction`** → 6
authority sites do `void tx` + direct `.set().catch(()=>undefined)`.
Consequences: `purchaseSpace` → **user pays, isn't enrolled, no error, retry
blocked by idempotency**; `saveTestAnswer` → silent student-answer loss;
impersonation ledger+audit **entirely fake** (SEC-04, no audit trail) +
3-uncorrelated-ids bug; `resolveDeadLetter`/`listDeadLetter` **destructively
drain the outbox**; 2 gamification single-writers run an empty tx.

**Design:**

1. **Add a raw escape hatch to `TxHandle`:** `getRaw(path)`,
   `setRaw(path, data)`, `newId(coll)` that stage on the _real_ Firestore
   `Transaction`. Rewrite all 6 SVC-2/3 sites to stage on the tx, drop `.catch`
   swallow, use the real `tenantId` (not hardcoded `__platform__`) and
   token-as-doc-id. **All 3 are provably atomizable** — they're plain Firestore
   writes; cross-collection/subcollection tx is fully supported.
2. **`purchaseSpace`:** commit the idempotency record _after_ the tx commits (or
   stage it _inside_ the tx); release on throw.
3. **Outbox:** add non-destructive `outbox.list()`; repoint `listDeadLetter` +
   `resolveDeadLetter` to it (remove `drain` from both); give the DLQ its own
   collection/lifecycle; harden the worker `drain()` to a **leased per-row
   `pending→inflight→delivered`** claim that _preserves_ `attempts`.
4. **Genuine saga carve-out** only for non-Firestore effects (Admin Auth
   claims/revoke, Secret Manager, RTDB leaderboard) — surface failures
   explicitly. (Impersonation already correctly awaits `revokeRefreshTokens`
   _outside_ the tx.)
5. Implement or explicitly delete the empty gamification stubs.

**Closes:** SVC-1 (the testSessions collection P0 fits here too), SVC-2, SVC-3,
SVC-4, RR-T4 NEW-1, NEW-2, SEC-04.

---

## DP-5 · Composable domain primitives ("blocks from smaller blocks")

**Problem it solves:** `withAudit`/`zAuditFields`/`zTenantScoped` ship but
**zero entities use them**; `firstName/lastName/email/phone` copy-pasted across
6 schemas; `points` vs `marks` coexist with no `Score`; rubric `{snapshot+id}`
duplicated on 3 entities; no `QuestionCore` shared between the 15-type and
scan-based question models.

**Design:** establish and _actually use_ a primitives layer in `domain`:

- `zTenantScoped` + `withAudit` composed into **every** tenant entity (replaces
  hand-inlined `tenantId` + 4 audit fields).
- `PersonName` + `ContactInfo` composed into `UnifiedUser` and all role
  profiles.
- `Score` primitive defining the `points`↔`marks` relationship; `RubricBinding`
  for the `{snapshot+id}` pattern; `QuestionCore` shared by both question
  abstractions; `TimingConfig` + `PassingPolicy` to collapse the 3 overlapping
  assessment/timing/passing models.
- Write-contracts (`SaveItemData`, `SaveX` requests, `StoredEvaluation`)
  **derived via `.pick()/.partial()`** from the entity SSOT instead of
  hand-redeclared.

**Closes:** B-IDN-10, B-IDN-11, LD-04, LD-05, LD-06, LD-07, LD-08, LD-09,
F-SSOT-03.

---

## DP-6 · Identity correctness + single tenant-code resolution

**Problem it solves:** 3 P0s — `tenant["code"]` typo (field is `tenantCode`)
zeroes every minted claim; `joinTenant` uses code-as-id; `saveStudent`
provisioning branch is dead code (`authUid` rejected by strict schema). Plus
`ConsumerProfile` model/storage drift, `superAdmin` conflated into the
tenant-role enum, runtime vs seed claim-builders diverge.

**Design:**

- **Single `resolveTenantByCode()` helper** used by both `joinTenant` and
  `lookupTenantByCode` (reads the `tenantCodes/{code}` index, then
  `get(tenantId)`) — the two paths can never diverge again.
- **`provisionMembership` resolves `tenantCode` itself** from the tenant doc →
  no caller can pass the wrong field; add an assertion that a provisioned
  membership's `tenantCode` is non-empty.
- **Fix the `saveStudent` contract/impl mismatch** — either accept `authUid` in
  the request schema (if provisioning-on-create is intended) or remove the dead
  branch + the advertised resync.
- **One `buildClaimsFromMembership`** shared by runtime _and_ seed (DP-2's
  `ROLE_DESCRIPTORS` makes it data-driven) — kills RR-T2-A divergence.
- **Lift `superAdmin`** out of the tenant-role enum into the platform-flag
  dimension (`UnifiedUser.isSuperAdmin` already exists) — roles become purely
  tenant-scoped.
- **`ConsumerProfile`:** pick one home (own doc vs embedded) and make the model
  match.

**Closes:** B-IDN-01, B-IDN-02, B-IDN-03, B-IDN-20, B-IDN-21, RR-T2-A.

---

## DP-7 · Boundary integrity — `createLevelUpSdk()` factory + green gate

**Problem it solves:** all 8 apps import
`api-client`+`repositories`+`transport-firebase` directly from
`apps/*/src/sdk/`; the lint boundary test is **committed RED** (catches no
regressions); the wiring is duplicated 8×.

**Design:** extract a single **composition package** exporting
`createLevelUpSdk(config)` that wires transport → api-client → repositories →
query provider once. Apps import **only `@levelup/query` + `@levelup/domain`**.
Then the boundary test goes **green and load-bearing** (no carve-out needed).
Register `functions-shared`→`functions-adapters` in the TIERS map so upward-dep
regressions are actually caught.

**Closes:** LB-01/Q-GUARD-1, LB-02, LB-04, LB-05, and the 8× wiring duplication.
_(This one also touches all 8 apps — it is the natural bridge into Phase 2.)_

---

## DP-8 · Dedupe wave + live realtime + delete dead runtimes

**Problem it solves:** synonym `DomainName` roots
(`evalSettings`+`evaluationSettings`…) → silent cache staleness; duplicate
`LeaderboardRepo`/`ExamAnalyticsRepo` colliding on bag keys (winner = spread
order); duplicate `dismissInsight`; realtime keys write `"me"` where reads key
`"self"` → live updates no-op; `@levelup/realtime` + `@levelup/offline` runtimes
are **dead** and duplicated divergently.

**Design:** run the deferred dedupe wave — collapse synonym domain roots to one
canonical name; one impl per repo bag key; one `dismissInsight`. Introduce **one
exported `SELF` sentinel** so realtime write-keys == read-keys. Decide each dead
runtime: either route the live path through `@levelup/realtime`'s
refcount/dedupe/warm-replay manager (and the api-client offline copy through
`@levelup/offline`) **or** delete the unused package — no divergent duplicate
may remain.

**Closes:** CON-2, CON-4, REPO-5, REPO-6, QRY-1, QRY-2, QRY-5, MISC-1, MISC-2.

---

## DP-9 · Deploy-safety: prefix-aware subscriptions + timestamp wire sweep

**Problem it solves (blocks any `v2_` client deploy):** `transport-firebase`
subscriptions hardcode `tenants/${T}/…` with **no prefix awareness** → under
`v2_`, writes go to `v2_tenants` but live reads hit `tenants` (realtime
split-brain); ~20 wire timestamp fields are bare `z.string()` (a third flavor)
instead of canonical `zTimestamp`.

**Design:** thread `collectionPrefix()` into `transport-firebase` subscription
path construction (single source, mirrored by the existing paths test extended
to subscriptions); sweep the ~20 `*At`/deadline fields to `zTimestamp` and add a
lint rule banning bare `z.string()` on `*At` fields; make the `timestamp.zod.ts`
docblock match reality.

**Closes:** F-NS-01, F-NS-02, F-TS-01.

---

## DP-10 · Test & build hygiene matched to risk

**Problem it solves:** the two fattest, most critical packages are least tested
(`services` 11.3k LOC / 11 tests; `functions-adapters` 0 tests); inconsistent
typecheck strategy (tsc-against-stale-dist footgun); `query` vitest false-RED
under `NODE_ENV=production`.

**Design:** prioritized coverage on `services` (grading, repo-admin writes,
idempotency — DI-friendly, fakes are tractable) and `functions-adapters` (error
mapping, dedupe, the on-call/on-document/schedule adapters). Add the **parity
tests** that the design makes cheap: `FLAT_COLLECTION` ↔ `createRepos` map
(SVC-1), registry-derives-all (DP-2), `ItemView` answer-free (DP-3),
provisioned-membership tenantCode non-empty (DP-6). Standardize source-mapped
typecheck across packages; pin `query` vitest `NODE_ENV`.

**Closes:** Q-TEST-1/2/3, Q-BUILD-1/2/3, Q-DEP-1/2.

---

## How it composes into one solid design

These are not 10 independent patches — they reinforce each other:

- **DP-2 (registries) is the spine.** DP-3's typed answer unions and DP-6's
  data-driven claim-builder both _derive from_ the registries. Do DP-2 first and
  DP-3/DP-6 get smaller.
- **DP-1 (canonical seam) is the enabler.** It makes the wire types honest,
  which DP-3 (answer wire split) and DP-9 (timestamp wire sweep) build on.
- **DP-5 (primitives) + DP-2 (registries)** together are the literal expression
  of "blocks from smaller blocks": primitives are the small blocks, registries
  compose them per-variant.
- **DP-4 (honest tx)** is independent and pure-correctness — it can land first
  as a safety fix without waiting on the structural work.
- **DP-7 (factory)** is the clean hand-off into Phase 2 (apps), since it's what
  apps will consume.

### Proposed rollout order (each step typechecks + tests green before the next)

| Wave                   | Proposals                                                                     | Why this order                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **W0 — Correctness**   | the 4 P0s + DP-4 + DP-3's live-leak strip-list fix                            | Stop active data loss / answer leak / payment-stuck. Smallest diffs, highest urgency. |
| **W1 — Spine**         | DP-1 (canonical seam) → DP-2 (registries)                                     | The two highest-leverage structural moves; everything else gets easier after.         |
| **W2 — Type the axes** | DP-3 (answer split) + DP-5 (primitives) + DP-6 (identity)                     | All derive from W1; deliver the extensibility/composability mandate.                  |
| **W3 — Integrity**     | DP-7 (factory + green gate) + DP-8 (dedupe + realtime) + DP-9 (deploy-safety) | Restore guardrails; unblock `v2_` deploy.                                             |
| **W4 — Confidence**    | DP-10 (coverage + hygiene)                                                    | Lock the new invariants in tests.                                                     |

### Risk & guardrails

- DP-3 and DP-9 are **wire breaks** → must ship behind the api-contract seam +
  coordinated client deploy + data backfill (be-data-seed owns the SUB001
  backfill).
- DP-7 touches all 8 apps → it is the Phase-1/Phase-2 seam; do it last in Phase
  1, verify per-app in Phase 2.
- Everything stays on `staging`; no push/PR without coordinator + user approval.

---

## Decision needed from the user

1. **Approve the design direction** (these 10 proposals as the target) — yes /
   changes?
2. **Pick the fix scope to start:** (a) **W0 only** (stop the bleeding — P0s +
   honest tx + leak strip), (b) **W0 + W1** (correctness + the structural
   spine), or (c) **full W0→W4** sequenced.
3. Any proposal to **drop, defer, or re-scope** before we turn approved waves
   into applied fixes.

_Design-only. No code changed, nothing pushed._
