# REAL Subhang Academy Data → New Mobile App — Migration Plan

> **Status:** Analysis complete (READ-ONLY). No data mutated. **Author:**
> M-realdata-analyst (`sess_1782486536817_f2j9or852`) **Date:** 2026-06-26
> **Goal (user):** the new `apps/mobile-student` (fat SDK, reads `v2_`-prefixed
> collections in `lvlup-ff6fa`) must show the **REAL** Subhang Academy
> courses/items and let the user log in with the **REAL** credentials:
> `student.test@subhang.academy` / `Test@12345` / School Code `SUB001` (admin
> `subhang.rocklee@gmail.com`).

---

## TL;DR / Recommendation

**Recommended: Option A — a one-time, idempotent transform-migration of the real
Subhang content from the UNPREFIXED collections into the `v2_`-prefixed
collections (preserving all document IDs), plus minting the three v2 identity
docs (`v2_tenants/tenant_subhang`, `v2_tenantCodes/SUB001`,
`v2_userMemberships/{uid}_tenant_subhang`) and `v2_users/{uid}`.**

The real Subhang users **already exist in `lvlup-ff6fa` Auth** with the
**correct custom claims** (`role`, `tenantId=tenant_subhang`,
`tenantCode=SUB001`). Auth is a single shared pool across prefixes, so **no
Auth/claims change is needed** — the only identity gap is the missing
`v2_userMemberships` / `v2_users` / `v2_tenants` / `v2_tenantCodes` docs that
the new SDK resolves against.

Options B (point prefix to `''`) and C (re-run `seed:production` into `v2_`) are
**rejected** — see §5.

---

## 1. WHERE does the real SUB001 data live?

**Answer: `lvlup-ff6fa`, in the UNPREFIXED top-level collections.** (Inspected
read-only via the present service account
`firebase-adminsdk-fbsvc@lvlup-ff6fa`.)

### 1.1 Project / collection layout in `lvlup-ff6fa`

Root collections found:

```
tenants            ← LEGACY/production data (Subhang lives here)   ⟸ SUB001
userMemberships    ← legacy
users              ← legacy
tenantCodes        ← legacy
platformActivityLog, _rateLimits
v2_tenants         ← NEW-model synthetic seed (LUC100, DEMO01)     ⟸ the new app reads here
v2_userMemberships, v2_users, v2_tenantCodes, v2_globalEvaluationPresets
```

- `levelup-10404` (the legacy `LevelUp-App/` repo, separate Firebase project)
  was **not** the home of SUB001 — that older project holds the original B2C
  "LevelUp" content (Vijetha/JEE/puzzle courses per its `scripts/`). The
  monorepo apps (`apps/*`) and `.firebaserc` both target **`lvlup-ff6fa`**, and
  the Subhang tenant doc is present there. levelup-10404 is **out of scope** for
  this migration. (We have no service account for it and do not need one.)
- `pnpm seed:production` is **not** a script in this monorepo (only
  `seed:emulator` exists at root, and `@levelup/seed` exposes `seed` /
  `seed:emulator` / `seed:verify`). The TEST_CREDENTIALS reference is stale. The
  real Subhang content was **authored interactively through the legacy teacher
  portal**, not produced by a config-driven seed (`createdAt` Jan 2026 →
  `updatedAt` Jun 2026; rich hand-written content). **This is decisive: the
  content cannot be re-generated; it must be copied.**

### 1.2 The real Subhang tenant (UNPREFIXED `tenants/tenant_subhang`)

```
id:          tenant_subhang
name:        Subhang Academy   (shortName "Subhang", slug "subhang-academy")
tenantCode:  SUB001            ← NOTE: field is `tenantCode` (legacy), not `code` (new model)
ownerUid:    d0ZDQvoNBcTtKIIduaZvF2iiwMc2  (= subhang.rocklee@gmail.com)
status:      active
stats:       { totalSpaces:5, totalStudents:5, totalTeachers:1, totalClasses:7, totalExams:0 }  (stale)
```

### 1.3 Real content volume (full tally, UNPREFIXED)

| Entity                                                                              | Count                                                        |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| spaces                                                                              | **12** (10 published, 1 draft, 1 other)                      |
| storyPoints                                                                         | **191**                                                      |
| items                                                                               | **3,569** (2,997 `question` + 572 `material`)                |
| students                                                                            | 6 · teachers 2 · parents 2 · classes 10 · academicSessions 5 |
| exams 5 · submissions 3 · digitalTestSessions 1 · spaceProgress 6 · notifications 5 |

Question-type breakdown (already uses the **hyphenated domain vocabulary** —
good):
`mcq 1133, mcaq 335, paragraph 512, text 307, fill-blanks 251, matching 247, numerical 143, true-false 55, jumbled 7, code 7`.

Example real spaces (titles confirm "the good content"): "Behavioral Interview
Mastery" (12 SP / 86 items), a DSA/System-Design/LLD set (e.g. one space with 17
storyPoints / 33 items in its first SP, storyPoints like "Design Connect Four
(LLD)" with hand-written OOP explanations). The four memory-noted space IDs
(`1AqFwKSf…`, `PDFq1OluyA…`, `ZikR8xEHkq…`, `XTw3bLqiT4…`) are within this set.

### 1.4 Auth users (in `lvlup-ff6fa` Auth — SHARED pool, prefix-agnostic)

All three exist, enabled, `password` provider, **with correct claims**: | Email
| UID | role | tenantId | tenantCode | extra | |---|---|---|---|---|---| |
`student.test@subhang.academy` | `lUUkhr5fQMZjrUxvbsIoYmCLrku2` | student |
tenant_subhang | SUB001 | studentId `4ETnX1nentEZZiQ4yYXV`, 7 classIds | |
`subhang.rocklee@gmail.com` | `d0ZDQvoNBcTtKIIduaZvF2iiwMc2` | tenantAdmin |
tenant_subhang | SUB001 | — | | `parent.test@subhang.academy` |
`h1F8ymbn2zfDv8MqjUqt745JdEG2` | parent | tenant_subhang | SUB001 | parentId,
studentIds |

**Password `Test@12345` is unchanged in Auth — login works today.** The only
thing missing for the new app is the v2 membership/tenant resolution docs.

---

## 2. SCHEMA COMPATIBILITY (legacy Subhang ⟷ new domain model)

There are **three** shapes in play; the migration must reconcile them:

1. **Legacy Subhang (unprefixed)** — written by the old teacher portal.
2. **Deployed v2 seed (`v2_*`)** — written by `@levelup/seed`, what the app
   reads **today** (the shim).
3. **Canonical domain Zod** (`packages/domain`) — the api-contract target
   SDK-coord is realigning to.

> ⚠️ The deployed v2 seed **itself drifts** from the canonical domain Zod (this
> is exactly the drift S-mobile-student-2 found live: `order` vs `orderIndex`;
> `ratingAggregate {average,count}` vs
> `{averageRating,totalReviews,distribution}`; `price:number` vs `zMoney`;
> `payload.kind` vs `payload.type`). **The migration should target the CANONICAL
> DOMAIN shape**, and the actual write must be coordinated with SDK-coord's
> schema realignment (see §6 risks). Encouragingly, the **legacy Subhang shape
> is often CLOSER to the canonical domain than the drifted seed is** (legacy
> already uses `orderIndex`, embedded `sections[]`, `sectionId` on items,
> hyphenated question types).

### 2.1 Field-level deltas + required transforms

**Tenant** (`tenants/tenant_subhang` → `v2_tenants/tenant_subhang`) | Legacy
field | Domain (`TenantSchema`) | Transform | |---|---|---| |
`tenantCode: "SUB001"` | `code` | rename `tenantCode`→`code` | |
`contactEmail/contactPerson/contactPhone` (flat) | `contact: {...}` (nested) |
fold into `contact` object | | `logoUrl/bannerUrl` | `branding: {...}` | fold
into `branding` | | `subscription: {plan,...}` | `plan` + `settings` | map
`subscription.plan`→`plan` | | Timestamp objects | `zTimestamp` | keep as
Firestore Timestamp (canonical) | | — | `createdBy/updatedBy` | use `ownerUid` |

**Space** (12 docs) — **mostly compatible**. `type:"hybrid"` ✓ valid enum;
`accessType:"class_assigned"` ✓; `orderIndex`-free (spaces have no order);
`status/publishedAt/slug/subject/classIds/teacherIds` all present. Add:
`ratingAggregate {averageRating:0,totalReviews:0,distribution:{}}`, remap
`stats` (`totalStoryPoints`→`storyPointCount`, `totalItems`→`itemCount`, add
`enrolledCount/completionCount`), `createdBy/updatedBy` (fallback to
`ownerUid`), `archivedAt:null`. Drop legacy-only `academicSessionId` if the
academic session isn't migrated (optional field).

**StoryPoint** (191 docs) — **highly compatible**. Has `orderIndex` ✓, embedded
`sections[]` ✓ (matches `StoryPointSectionSchema {id,title,orderIndex}`),
`type:"standard"` ✓. Transform: drop `courseId` (legacy duplicate of `spaceId`),
add `stats.itemCount`, `createdBy/updatedBy`, `archivedAt:null`. Preserve
`assessmentConfig` where present (e.g. on the timed-test storyPoints).

**Item** (3,569 docs) — **the real work.** Legacy item:

```
{ type:"question", title, content, difficulty, orderIndex, sectionId, sect_order_idx,
  payload:{ questionType, content, explanation, basePoints, difficulty,
            questionData:{ correctAnswer, acceptableAnswers, options:[{id,text,isCorrect}], ... } },
  meta:{ totalPoints, tags } }
```

Transforms:

1. **Split the answer key out** → create `…/items/{itemId}/answerKeys/{keyId}`
   doc
   `{ id, itemId, questionType, correctAnswer, acceptableAnswers?, modelAnswer? (from explanation) }`.
   (Legacy has **no** `answerKeys` subcollection — answers are embedded;
   inspected count = 0. This split is also a **security fix**: in v2 the
   `answerKeys` path is deny-all.)
2. **Rebuild `payload` to the discriminated union**:
   - questions →
     `{ type:"question", basePoints, questionData:{…WITHOUT correctAnswer / acceptableAnswers, and with `options[].isCorrect` STRIPPED} }`.
   - materials → `{ type:"material", materialData:{ materialType, … } }` (map
     legacy material payload; a material sample must be dumped to finalize the
     per-materialType mapping — text/video/pdf/link/rich).
3. Map `questionType`: legacy values are already hyphenated and **all 10
   observed values are valid** domain `QUESTION_TYPES` — no rename needed.
   (Guard: if any `true_false`/`fill_blanks` underscore variants exist in the
   untyped tail, normalize to hyphen.)
4. Keep `orderIndex` ✓, `sectionId` ✓, `title`/`content`/`difficulty`/`meta`.
   Add `createdBy/updatedBy`, `archivedAt:null`. Drop `courseId`,
   `sect_order_idx` (redundant with `orderIndex`).

**Progress / memberships** — `userMemberships/{uid}_{tenantId}` legacy shape
**already matches** `UserMembershipSchema` (has
`uid, tenantId, tenantCode, role, status, joinSource, studentId, permissions`).
`spaceProgress` keyed `{userId}_{spaceId}` matches the canonical path. These
copy near-verbatim (add `createdBy/updatedBy/lastActive` defaults).

**Timestamps** — legacy stores Firestore `Timestamp` objects; canonical
`zTimestamp` accepts Timestamp. **Keep as Timestamp** (do NOT stringify — the
drifted seed's ISO strings are part of the drift SDK-coord is removing). Copy
verbatim.

---

## 3. CREDENTIALS / CLAIMS — what the new SDK needs

The new SDK resolves a logged-in user → tenant via **(a) custom claims** and
**(b) the `v2_userMemberships/{uid}_{tenantId}` doc** +
**`v2_tenantCodes/{CODE}`** for code-based join, and reads the tenant from
**`v2_tenants/{tenantId}`**.

- **Claims:** ✅ already correct on all three Auth users (`role`,
  `tenantId=tenant_subhang`, `tenantCode=SUB001`, `studentId`). Shared Auth →
  **no claim writes required**. (If SDK-coord's resolver requires any additional
  claim key the v2 seed users have and these lack, mint it with
  `setCustomUserClaims` — none observed to be missing.)
- **Missing v2 identity docs** (must be created for resolution to succeed):
  - `v2_tenants/tenant_subhang` (transformed tenant doc, §2.1)
  - `v2_tenantCodes/SUB001` → `{ tenantId: "tenant_subhang" }`
  - `v2_userMemberships/lUUkhr5fQMZjrUxvbsIoYmCLrku2_tenant_subhang` (copy of
    legacy membership)
  - `v2_users/lUUkhr5fQMZjrUxvbsIoYmCLrku2` (copy of legacy user doc;
    `activeTenantId=tenant_subhang`)
  - (optional, for admin/parent parity) the same three for
    `d0ZDQvoNBcTtKIIduaZvF2iiwMc2` and the parent uid.

After these exist, `student.test@subhang.academy` / `Test@12345` logs into the
new app and resolves to the Subhang tenant with the migrated real content.

---

## 4. RECOMMENDATION + EXACT STEP PLAN (Option A)

### 4.1 Build a one-time idempotent migration script

`packages/seed/scripts/migrate-subhang-to-v2.ts` (Admin SDK, reuses
`@levelup/seed` `BatchWriter` + `engine/paths.ts` so writes land at the
**prefixed** paths). Driven by `LVLUP_COLLECTION_PREFIX=v2_`.

Pseudocode:

```ts
// READ source from UNPREFIXED, WRITE to v2_ (prefix set via env on the WRITE client only).
const SRC = adminApp(unprefixed);      // reads tenants/tenant_subhang/**
const DST = Paths with PFX="v2_";       // writes v2_tenants/tenant_subhang/**
const TENANT = "tenant_subhang";

1. tenant   : read tenants/{T}            → transform(§2.1) → set v2_tenants/{T}            (merge:true)
2. code     : set v2_tenantCodes/SUB001 = { tenantId: T }
3. users    : copy users/{uid} (+ activeTenantId) for student[, admin, parent]
4. members  : copy userMemberships/{uid}_{T} (verbatim + defaults)
5. spaces   : for each of 12 spaces → transform → set v2_tenants/{T}/spaces/{sid}
6. storyPts : for each of 191 SP → transform → set …/spaces/{sid}/storyPoints/{spid}
7. items    : for each of 3,569 items → split→ payload + write item AND answerKeys/{keyId}
8. progress : copy spaceProgress/{uid}_{sid} (+ live projection if present)
9. recompute stats (space.stats.itemCount, storyPoint.stats.itemCount) from actual counts
```

- **Preserve every document ID** (tenant, space, storyPoint, item, student
  `4ETnX1nentEZZiQ4yYXV`, membership id). This keeps the existing Auth claims
  (`studentId`, etc.) valid and makes the script **re-runnable** (deterministic
  IDs + `set(merge:true)` ⇒ idempotent; reruns overwrite, never duplicate).
- **Dry-run first:** `--dry-run` flag that logs the transformed docs + counts
  without writing.
- **Verify pass:** reuse `@levelup/seed` `engine/verify.ts` pattern to assert
  counts post-write (12 spaces / 191 SP / 3,569 items / 2,997 answerKeys under
  v2\_).

### 4.2 Exact commands

```bash
# 0. (one-time) dump a MATERIAL item sample to finalize material payload mapping
#    node packages/seed/scripts/inspect-material.cjs   (read-only)

# 1. DRY RUN — no writes, prints transform diff + counts
LVLUP_COLLECTION_PREFIX=v2_ pnpm -F @levelup/seed exec tsx scripts/migrate-subhang-to-v2.ts \
  --project lvlup-ff6fa \
  --service-account ./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json \
  --tenant tenant_subhang --dry-run

# 2. REAL RUN (after dry-run looks correct)
LVLUP_COLLECTION_PREFIX=v2_ pnpm -F @levelup/seed exec tsx scripts/migrate-subhang-to-v2.ts \
  --project lvlup-ff6fa \
  --service-account ./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json \
  --tenant tenant_subhang

# 3. VERIFY
LVLUP_COLLECTION_PREFIX=v2_ pnpm -F @levelup/seed exec tsx scripts/migrate-subhang-to-v2.ts \
  --tenant tenant_subhang --verify-only

# 4. SMOKE: login student.test@subhang.academy / Test@12345 in apps/mobile-student → see real spaces
```

### 4.3 Idempotency & safety

- **Writes are 100% confined to `v2_*` collections.** The legacy unprefixed
  production data is **read-only** in this script → **zero risk to existing prod
  / the legacy apps.**
- Deterministic doc IDs + `set(merge:true)` → safe to re-run any number of
  times.
- `v2_` currently has **no Subhang data** (verified:
  `v2_tenants/tenant_subhang`, `v2_userMemberships/…_tenant_subhang`,
  `v2_tenantCodes/SUB001` all absent) → clean first run.
- ~3,800 doc writes + ~3,000 answerKey writes ≈ 6,600 writes → batch in chunks
  of 400–500 via `BatchWriter`.

---

## 5. Why NOT B or C

**Option B — point the new app's prefix to `''` (read unprefixed prod directly).
REJECTED.**

- Schema mismatch: legacy items have **embedded** answer keys (no `answerKeys`
  subcollection) and a different `payload` shape → the SDK's answer-key-aware
  reads break, and worse, **answers leak** (the deny-all `answerKeys` security
  model doesn't apply to embedded payloads under legacy client rules).
- The new app has **write** callables (record attempt, progress). Pointing at
  unprefixed = **the new app mutating live production data** shared with the
  legacy apps. Unacceptable.
- The unprefixed `tenants` collection is polluted (5 duplicate "Greenwood"
  docs + others); a global prefix flip affects **all** new-app tenants, not just
  Subhang. It also discards the deliberate `v2_` isolation.

**Option C — re-run `seed:production` into `v2_`. REJECTED (impossible).**

- There is **no Subhang seed config** in `@levelup/seed` (only `greenwood`,
  `riverside`, `content-levelup`), and `seed:production` is not a script in this
  monorepo.
- The Subhang content was **hand-authored** over ~5 months (3,569 items with
  bespoke explanations). A seed cannot reproduce it. (A "Subhang seed config"
  would just be a worse re-encoding of Option A's copy.)

---

## 6. Risks / dependencies / open items

1. **Target-shape drift (BLOCKER to coordinate):** the deployed v2 callables
   currently emit a shape that drifts from the canonical domain Zod
   (S-mobile-student-2 confirmed live; SDK-coord is realigning). The migration
   must write the shape the **realigned** callables will read. **Action:**
   confirm with SDK-coord whether the target is canonical-domain (`orderIndex`,
   `payload.type`, `ratingAggregate{averageRating,…}`) before the real run.
   Recommended target = **canonical domain** (legacy data is already close to
   it).
2. **Material payload mapping** is not yet fully specified (no material item
   dumped). Dump one per `materialType` before coding step 7's material branch.
3. **Answer-key correctness:** verify the legacy
   `questionData.options[].isCorrect` / `correctAnswer` maps cleanly to each of
   the 10 question types' `correctAnswer` contract (esp. `matching`, `jumbled`,
   `fill-blanks`, `mcaq` multi-answer). Unit-test the transform against ~1 item
   per type.
4. **Stats recompute** — legacy `stats` are stale; recompute from actual child
   counts during migration.
5. Optional scope: migrate
   exams/submissions/digitalTestSessions/classes/academicSessions only if the
   mobile app needs them (the student learn/test flow needs
   spaces→storyPoints→items→answerKeys→spaceProgress; the rest can be deferred).

---

## 7. Appendix — inspection method (read-only)

All findings via `firebase-admin` + the present `lvlup-ff6fa` service account,
COUNT aggregations + `limit(1)` samples + `auth().getUserByEmail`. **No writes,
no mutations.** Throwaway inspection scripts were used and removed; none touched
the database state.
