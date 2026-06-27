# Real Subhang Data → v2\_ Migration — GATE REPORT

> **Status:** ✅ APPLIED + VERIFIED + LIVE-READ PROVEN (2026-06-26). Migration
> COMPLETE. **Author:** realdata-migrator (`sess_1782487100421_317ybckka`)
> **Date:** 2026-06-26 **Script:**
> `packages/seed/scripts/migrate-subhang-to-v2.mjs` **Reports:**
> `packages/seed/scripts/out/migration-dryrun-report.json` (full transformed
> samples + any errors)

## What ran (read-only)

`node scripts/migrate-subhang-to-v2.mjs` (dry-run is the **default**; `--apply`
required to write). Reads UNPREFIXED `tenants/tenant_subhang/**` (+
`users`/`userMemberships`/`tenantCodes`), builds `v2_`-prefixed docs in the
**canonical `@levelup/domain` shape**, validates **every** built doc against the
real domain Zod schemas, and runs a deep answer-leak guard. **Source is never
mutated.**

## Result

| Metric                              | Value                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Source spaces / storyPoints / items | **12 / 191 / 3,569** (2,997 question + 572 material)                                                                             |
| Material types present              | `rich` (570) + `video` (2) only                                                                                                  |
| Question types                      | mcq 1133, mcaq 335, paragraph 512, text 307, fill-blanks 251, matching 247, numerical 143, true-false 55, jumbled 7, code 7      |
| **Built v2\_ writes**               | **6,777** = 1 tenant + 1 tenantCode + 3 users + 3 memberships + 12 spaces + 191 storyPoints + 3,569 items + **2,997 answerKeys** |
| Zod validation errors               | **0** (against actual `packages/domain` schemas)                                                                                 |
| Answer-field leaks in item payloads | **0** (deep guard: no `isCorrect`/`correctAnswer`/`correctOrder`/`modelAnswer`/`explanation` anywhere)                           |

## Transforms applied

- **Doc IDs preserved verbatim** (tenant, spaces, storyPoints, items, sections,
  student/teacher/parent ids, memberships).
- **Answer keys split** out of item docs into deny-all
  `items/{id}/answerKeys/{id}` (keyId = itemId):
  - mcq → correct option **id**; mcaq → array of correct option **ids** (from
    `options[].isCorrect` **or** Shape-B `correctOptionId`/`correctOptionIds`).
  - true-false / numerical → value (+ `tolerance` for numerical).
  - fill-blanks → structured
    `[{id, correctAnswer, acceptableAnswers?, caseSensitive?}]`.
  - matching → correct `[{id, left, right}]` pairing; jumbled → ordered tokens.
  - `explanation` (+ paragraph `rubric`) → `evaluationGuidance` (server-only).
- **Item payload rebuilt** to the canonical two-level discriminated union
  (whitelist construction → no stray fields).
- **Two legacy item shapes handled:** Shape A (answers under
  `payload.questionData`) and Shape B (~60 older items: answers at
  payload-level, `payload.question`, `correctOptionId`, `points`).
- **Stats recomputed** from real child counts (space
  `storyPointCount`/`itemCount`, storyPoint `itemCount`).
- **Identity minted:** `v2_tenants/tenant_subhang`,
  `v2_tenantCodes/SUB001 = {tenantId, createdAt}`,
  `v2_userMemberships/{uid}_tenant_subhang` + `v2_users/{uid}` for student **+
  admin + parent**. Auth/claims untouched (already correct, shared pool).
- **Idempotent:** deterministic IDs + full-replace `set` (no merge) →
  re-runnable, no duplicates, no stale answer fields.

## 3 canonical corrections vs migration-plan §2 (followed ACTUAL domain Zod, per "target canonical")

1. **Timestamps = ISO-8601 strings at rest** (NOT Firestore Timestamps). Per
   `repo-admin/firestore.ts` (D4 adapter converts Timestamp↔ISO on write/read)
   and `zTimestamp = z.string().regex(ISO_8601_UTC)`. The plan's "keep
   Timestamps" is wrong for the realigned reads. Written via domain
   `toTimestamp`.
2. **Tenant keeps `tenantCode` + flat `contactEmail`/`contactPhone`** (NOT
   `code`/nested `contact`) — canonical `TenantSchema`.
3. **Required-nullable fields populated:** `subscription.renewsAt`,
   `usage.resetAt`, `onboarding.completedAt`, `space.ratingAggregate`,
   `archivedAt`, `membership.lastActive`, `user.lastLogin`.

## SDK-coord confirmation (2026-06-26) — all CONFIRMED + bug fixed

SDK-coord confirmed: (1) ISO-string timestamps at rest, (2) answerKey doc core +
denormalized `{tenantId,spaceId,storyPointId}` superset, and **fixed** the
`makeAnswerKeyRepo.get` prefix bug (`startsWith(tenantDoc(tenantId)+'/')`) —
which was also blocking `recordItemAttempt` grading under `v2_`. Redeploying
`v1-levelup`.

### Path correction from SDK-coord (now applied)

- **storyPoints are a FLAT tenant-scoped collection**
  `v2_tenants/{t}/storyPoints/{id}` (with a `spaceId` field) — NOT nested under
  `spaces`. Confirmed in committed code: `repo-admin/index.ts` registers
  `storyPoints: entity('storyPoints')` → `makeEntityRepo` uses
  `tenantCollection(t,'storyPoints')`; the callable `listStoryPoints` queries it
  `where spaceId == …`. (The nested `storyPointDoc()` helper in `paths.ts` is
  stale for storyPoint docs.) **Items stay NESTED** at
  `v2_tenants/{t}/spaces/{s}/storyPoints/{sp}/items/{id}` and are resolved by
  the callables via `collectionGroup('items')`; answer keys via
  `collectionGroup('answerKeys')`.
- The migration writes storyPoints flat, items+answerKeys nested. The verify
  step now counts items/answerKeys via the SAME `collectionGroup` resolution the
  deployed callables use (proves the app's read path resolves them).

## Flag — RESOLVED by SDK-coord

- `makeAnswerKeyRepo.get` prefix bug — **fixed by SDK-coord** (see above).
- **Matching items** keep `pairs:{left,right}` on the item per canonical
  `MatchPairSchema` (the answer is hidden by client-side shuffle of the right
  column); the correct pairing also lives in the answerKey for grading.

## Deferred (optional scope)

- `spaceProgress` (6 legacy docs, fat-map shape ≠ canonical D6 per-item
  progress; the test student has no progress doc anyway). Recommend defer unless
  mobile app needs it.

## Next

`node scripts/migrate-subhang-to-v2.mjs --apply` → writes v2\_ only, then
auto-verifies counts + leak-check. Then `--verify-only` re-checkable any time.

---

## APPLY GATE — DONE ✅ (2026-06-26)

Ran `node scripts/migrate-subhang-to-v2.mjs --apply` (coordinator-approved).
**Wrote 6,777 docs to `v2_` only; unprefixed source untouched.**

**Post-write verify (index-free direct reads):** | Entity | Count | Expected |
|---|---|---| | tenant / tenantCode | 1 / 1 | ✓ | | users / memberships
(student+admin+parent) | 3 / 3 | ✓ | | spaces | 12 | ✓ | | storyPoints (flat,
all with `spaceId`) | 191 / 191 | ✓ | | items (2,997 question + 572 material) |
3,569 | ✓ | | answerKeys | 2,997 | ✓ | | answer-field leaks (300 sampled written
items) | **0** | ✓ |

**Idempotency:** a 2nd `--apply` re-wrote 6,777 docs (full-replace) with counts
**unchanged** → stable no-op, no duplicates.

**LIVE-READ PROOF (deployed callables, asia-south1, signed in as
`student.test@subhang.academy`/`Test@12345`):**

- `v1.levelup.listSpaces` → **11 real published Subhang spaces** (Behavioral
  Interview Mastery, System Design, LLD, Low-Level Design & OOP, DSA,
  Domain-Driven Design, Java, HLD, DDIA, …) with canonical recomputed stats. The
  12th space (draft) is correctly hidden by student access-scoping.
- Drill-down `listStoryPoints` (12 SP) → `listItems` (7 items) works end-to-end.
- **Trust boundary: ✅ no answer field**
  (`correctAnswer`/`isCorrect`/`modelAnswer`/etc.) in any item the student
  receives.

**Scripts:** `migrate-subhang-to-v2.mjs` (migration + verify),
`inspect-subhang.mjs`/`scan-odd-items.mjs` (read-only inspection),
`live-read-proof.mjs` (deployed-callable proof). Reports in
`packages/seed/scripts/out/`.

**Deferred (as approved):** `spaceProgress` (legacy fat-map ≠ canonical D6
per-item; test student has none).

---

## Post-completion: flat-path stub items (grading false-alarm, 2026-06-26)

SDK-coord hit a `recordItemAttempt` grading failure on item
`dPTqKIhlczsSTkiMr7Nw`. Investigation:

- That id is an **empty abandoned stub** (`title:"New Question"`, `options:[]`,
  no answer) stored at a **FLAT** legacy path
  `tenants/{t}/spaces/{s}/items/{id}` (directly under the space, not under a
  storyPoint).
- Across all 12 spaces there are exactly **11 such flat orphan drafts** (4 in
  DSA `ZikR8xEHkqIaIsugmdQg`, 7 in HLD-V2 `zRMBmxWdz2yEENbwg1Ka`) — all empty
  `New Question`/`New Material` stubs, **0 overlap** with the 3,569 real nested
  items. They are teacher-portal "added but never filled in" drafts.
- **Decision:** NOT migrated (ungradeable — no answer key possible — and would
  surface as broken empty items in the student UI). The 3,569 real items
  (nested) are fully migrated. Probe scripts: `probe-repro-item.mjs`,
  `scan-flat-items.mjs`.
- **Resolution for the grading test:** use a real item, e.g. DSA
  `spaceId=ZikR8xEHkqIaIsugmdQg`, `storyPointId=1pEg2NCNaajNJcTHxbJy`,
  `itemId=3OOEGlERQyHDARweKXq0` (mcq, `answerKey.correctAnswer="a"`) — verified
  resolvable via `collectionGroup('items')` + `collectionGroup('answerKeys')`.
  DSA has 20/20 mcq with answerKeys.
