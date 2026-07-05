# Phase 1 — Fat-SDK Architecture + LLD Review · CONSOLIDATED (HUMAN GATE)

**Coordinator:** Program-Lead 🧭 · **Mode:** READ-ONLY — findings only, **no
code changed, nothing pushed.** **Branch:** `staging` · **Date:** 2026-06-27 ·
**Status:** awaiting USER direction at the Phase-1 gate.

This consolidates three independent read-only workstreams into one backlog.
Source reports:

| Stream                                      | Scope                                                      | File                                                                   | Counts                       |
| ------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| **SDK general** (Backend-Lead, 4 reviewers) | layering · foundation · module-LLD · quality, all packages | [`SDK-REVIEW-PHASE1.md`](./SDK-REVIEW-PHASE1.md) (+ R1–R4)             | 1 P0 · 29 P1 · 53 P2 · 33 P3 |
| **Deep-audit A — Learning/Content**         | courses · spaces · exams · items · questions · progress    | [`SDK-REVIEW-A-LEARNING-DOMAIN.md`](./SDK-REVIEW-A-LEARNING-DOMAIN.md) | 0 P0 · 2 P1 · 8 P2 · 11 P3   |
| **Deep-audit B — Identity/Org**             | client · tenant · roles · teachers · students              | [`SDK-REVIEW-B-IDENTITY-DOMAIN.md`](./SDK-REVIEW-B-IDENTITY-DOMAIN.md) | 3 P0 · 4 P1 · 8 P2 · 4 P3    |

---

## The one-paragraph verdict

**The foundation is sound and should not be torn up.** The dependency graph is
acyclic and correctly directed, `domain` is a pure leaf, schemas are
strict-by-construction with real discriminated unions, all 13 packages typecheck
clean and all 16 build targets pass, and the security-critical identity core
(claim-derived `tenantId`, table-driven access policy, single
claim-mint/membership-write primitives) is genuinely well-designed. **The
defects are not architectural rot — they cluster at the seams** and split into
two buckets: (1) **a handful of real correctness bugs** (4 P0s) introduced
largely by the worktree merge, and (2) **the extensibility/composability mandate
is asserted but not realized** — shared primitives exist but are bypassed,
canonical types are promised but hand-copied and drifting, and adding a new
question-type or role is a multi-site shotgun edit instead of one registry
entry.

---

## The 4 P0s — correctness bugs that silently lose/corrupt data (fix first, low-risk)

| ID           | Location                                                   | What breaks                                                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SVC-1**    | `services/src/repo-admin/tx.ts:34` vs `index.ts:163`       | `testSessions` in-tx writes land in an **orphan collection no read touches** → `saveTestAnswer` tracking + `isLatest` demotion silently lost. 1-line fix (`testSessions`→`digitalTestSessions`) + parity test. |
| **B-IDN-01** | `identity/org-users.ts:28`, `save-entities.ts:95`          | Reads `tenant["code"]` but the field is `tenantCode` → **every minted membership/claim gets `tenantCode=""`**. Consumers read that claim.                                                                      |
| **B-IDN-02** | `identity/org-users.ts:138`                                | `joinTenant` passes the **code as the id** → only works when `code===id`, else 404s. Sibling `lookupTenantByCode` does it right via `resolveCode`.                                                             |
| **B-IDN-03** | `save-entities.ts:96` vs `api-contract/.../entities.ts:55` | `saveStudent`'s membership-provisioning branch is **dead code** — reads `authUid` that the `.strict()` request schema rejects; callable advertises a resync it can never perform.                              |

---

## The structural themes — where the extensibility/composability mandate is unmet

**These are the heart of what you asked for ("proper design, extensibility,
blocks from smaller blocks").** Several were found independently by multiple
reviewers (high confidence).

### 1. Canonical types promised everywhere, built nowhere → drift (highest leverage)

`Transport`, the wire envelope
(`PageRequest/PageResponse/SaveResponse/Callable`), the subscribe seam, and the
AI-gateway port are each **hand-copied 3–5×** across transport-firebase /
transport-http / api-client / repositories / query — and have **already
drifted** (e.g. `cursor: string` vs `string|null`, firebase `Transport` carries
`storage` and isn't swappable). **One fix — promote a single canonical seam into
`@levelup/api-contract` (or a zero-dep `@levelup/seam` leaf) and delete the
copies — resolves ~25 findings.**

### 2. The answer/grading axis is untyped (Learning domain — LD-01/LD-02)

The _prompt_ axis is beautifully modeled (15-way discriminated union). The
_answer_ axis is modeled **three incompatible ways at once** (inline
`.optional()` fields, `z.unknown()` AnswerKey, `z.unknown()` submission).
Consequences: the public `ItemView` **is the same TypeScript type as the full
authoring item**, so answer-stripping is enforced by server convention, not by
the compiler — a stripping bug is invisible; and a new question type ships with
**no typed answer or grading contract**. _(Converges with SDK general's
F-SSOT-04: `answer` is `z.unknown()` at the SSOT seam.)_

### 3. Per-type / per-role extension is a shotgun edit (LD-03, B-IDN-12)

Adding a **question type** touches ~5 sites (enum, two parallel
grading-classification arrays that can silently drift, schema, union, test).
Adding a **role** touches ~12 sites (enum, rank map, branded-id, claims,
membership, EntityIds, links, provisionMembership, org-users maps, profiles,
contract, ACCESS_RULES). Neither has a **registry** binding
`{literal → schema/answer/grading-mode}` or `{role → rank/ids/claims/perms}`.
The mandate's "one small change" is not yet achievable.

### 4. Composable primitives exist but are bypassed (B-IDN-10/11, LD-04..08)

`withAudit` / `zAuditFields` / `zTenantScoped` ship in `primitives/audit.zod.ts`
— **zero identity entities use them**; every entity hand-inlines audit +
tenantId. No shared `PersonName`/`ContactInfo`, no `Score` primitive (`points`
vs `marks` coexist), no `QuestionCore`, rubric `{snapshot+id}` copy-pasted on 3
entities. "Blocks from smaller blocks" is the stated pattern and the bypassed
one.

### 5. Other architecture debt (from SDK general)

- **Boundary lint gate committed RED** — all 8 apps bypass `@levelup/query`,
  importing api-client/repositories/transport directly; guard catches no
  regressions while red.
- **Deferred dedupe wave never ran** — synonym `DomainName` roots
  (`evalSettings`+`evaluationSettings`) → silent cache staleness; duplicate
  repos colliding on bag keys (winner = spread order).
- **Realtime keys write where nothing reads** (`"me"` vs `"self"`) → live
  updates no-op; `@levelup/realtime` + `@levelup/offline` runtimes are **dead**
  (duplicated divergently).
- **Authority "tx" is a lie** — enroll/awardAchievement void the tx + swallow
  failures; a list endpoint drains+re-enqueues the outbox (read-side mutation).
- **`v2_` prefix not applied in transport-firebase subscriptions** → realtime
  split-brain; ~20 timestamp wire fields are bare `z.string()`. _(Blocks any
  `v2_` client deploy.)_
- **Coverage inverted vs risk** — `services` (11.3k LOC / 11 tests) and
  `functions-adapters` (0 tests) are the fattest + least tested.

---

## Proposed remediation sequencing (NOT yet approved — for the gate decision)

1. **4 P0s** — smallest diffs, pure correctness, low risk. _(SVC-1,
   B-IDN-01/02/03)_
2. **Promote the canonical seam into api-contract** (Theme 1) — resolves ~25
   findings, unblocks honest typing.
3. **Two registries** — `QUESTION_TYPE_REGISTRY` (LD-03) + `ROLE_DESCRIPTORS`
   (B-IDN-12) — delivers the bulk of the extensibility mandate.
4. **Type the answer/grading axis** + remove answer fields from the public
   prompt union (LD-01/02) — makes stripping a compile error.
5. **Compose from shared primitives** (audit/person/score/rubric) — the
   composability mandate.
6. **Green the boundary gate** (shared `createLevelUpSdk()` factory or bounded
   carve-out).
7. **Dedupe wave** (kill synonym roots + repo shadowing).
8. **Foundation seams before any `v2_` client deploy** (subscription prefix +
   timestamp sweep + `answer` re-validation).
9. **Honest tx + stop read-side mutation; fix realtime keys; delete dead
   runtimes.**
10. **Coverage on services + functions-adapters; hygiene.**

---

## GATE — decision needed from the user

Per the Phase-1 human-in-the-loop constraint, **nothing below the line is
started without your say-so.** Options on the table:

- **Re-review depth** — go deeper on any theme/package before designing.
- **Design** — have the team turn approved themes into concrete target-design
  proposals (Zod sketches already drafted for the registries + answer split in
  reports A §5 and B §4).
- **Fix scope** — which buckets to actually apply (e.g. "just the 4 P0s now" vs
  "P0s + the two registries" vs "full sequence").

_End of consolidated report. Read-only; no code changed, nothing pushed._
