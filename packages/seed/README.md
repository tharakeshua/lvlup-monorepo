# @levelup/seed

Config-driven, **idempotent** Firebase Admin-SDK seeding engine for
Auto-LevelUp, plus a full, cross-referenced mock dataset that exercises every
domain entity (identity, content/levelup, autograde, testsession-progress,
analytics, gamification, notification).

The engine is **emulator-first** (detects `FIRESTORE_EMULATOR_HOST` /
`FIREBASE_AUTH_EMULATOR_HOST`), falls back to a real project, and writes through
`firebase-admin` (admin-side seeding — **not** the SDK client path). Every write
is a deterministic-id upsert, so re-running the seed reconciles instead of
duplicating.

---

## Quick start (emulator)

```bash
# 1) start the Firebase emulators (Firestore + Auth) from the repo root
firebase emulators:start --only firestore,auth

# 2) seed the bundled dataset into the emulators
pnpm -F @levelup/seed seed:emulator

# 3) (optional) verify counts without writing
pnpm -F @levelup/seed seed:verify
```

`seed:emulator` defaults `FIRESTORE_EMULATOR_HOST=localhost:8080` and
`FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` if they are not already set, then
runs the CLI against the bundled, assembled `seedConfig`.

### Real project

```bash
# point at a real project (NO emulator host env vars set) with a service account
pnpm -F @levelup/seed seed \
  --project lvlup-ff6fa \
  --service-account ./service-account.json
```

> When no emulator host is detected and `--dry-run` is not set, the engine logs
> a loud warning ("writing to a REAL Firestore project — not the emulator")
> before writing.

### CLI flags

| Flag                       | Meaning                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `--project <id>`           | Firebase projectId (default `GCLOUD_PROJECT` / `lvlup-local`).        |
| `--config <path>`          | JSON `SeedConfig` file. Default: the bundled, assembled `seedConfig`. |
| `--service-account <path>` | Service-account JSON (real project only).                             |
| `--database-url <url>`     | RTDB url (only if seeding RTDB read-models).                          |
| `--dry-run`                | Count + log only; no writes.                                          |
| `--verify-only`            | Re-read and assert counts; no writes.                                 |
| `--log <level>`            | `silent` \| `error` \| `warn` \| `info` \| `debug` (default `info`).  |
| `--real-clock`             | Use wall-clock instead of the deterministic fixed clock.              |

> Rich derived analytics docs (ExamAnalytics, summaries, leaderboards, cost/LLM
> logs) only ship with the bundled dataset. A custom `--config` JSON seeds its
> own entities only.

---

## Idempotency guarantees

The seed is safe to run any number of times — a re-run is a **no-op** at the
data level:

1. **Deterministic IDs.** `seedId(kind, key)` maps a `(kind, logical-key)` pair
   to a stable, Firestore-safe document id (readable prefix + slug + a stable
   SHA-256 suffix). No randomness — the same key always yields the same id.
   Composite ids (`{uid}_{tenantId}`, `{userId}_{spaceId}`) follow the same
   rule.
2. **Ensure-semantics.** Every write goes through `ensureDoc` /
   `ensureCollection` as a `set(..., { merge: true })` keyed by that
   deterministic id. A second run re-sets the same docs instead of appending new
   ones.
3. **Deterministic Auth uids.** `ensureAuthUser` binds each account to its
   `seedId('user', …)` uid, so re-running create-or-updates the same Auth user
   (never a duplicate), and claims are minted through the single shared
   `buildPlatformClaims` path (identical to the server's
   `syncMembershipClaims`).
4. **Fixed clock.** By default a fixed clock pins every `createdAt`/`updatedAt`,
   so the produced tree is byte-reproducible (`--real-clock` opts into
   wall-clock for real-project seeding).
5. **Verify gate.** After writing, `verify()` re-reads collection counts and
   asserts `actual >= expected`; `--verify-only` re-runs just this check.

Cross-fragment **FK consistency** is asserted at assembly time
(`assertFkConsistency`): every `classKeys` / `studentKey` / `examKey` /
`recipientKey` / … reference must resolve to a declared key within its tenant,
and tenant keys/codes + super-admin keys/emails must be globally unique. A typo
fails fast on import — before any write.

---

## Demo credentials

All demo-tenant entity accounts share the password **`Demo@12345`**. (The
platform super-admin uses a stronger password.) Tenant **LevelUp Demo Academy**
— join code **`DEMO01`**.

| Role                   | Email                                 | Password               |
| ---------------------- | ------------------------------------- | ---------------------- |
| Super-admin (platform) | `superadmin@demo.levelup.academy`     | `Demo@SuperAdmin#2025` |
| Tenant admin           | `principal@demo.levelup.academy`      | `Demo@12345`           |
| Teacher                | `latha.krishnan@demo.levelup.academy` | `Demo@12345`           |
| Student                | `aarav.patel@demo.levelup.academy`    | `Demo@12345`           |
| Parent                 | `parent.patel@demo.levelup.academy`   | `Demo@12345`           |

> The `parent.patel` parent is linked to the `aarav.patel` student
> (`parentLinkedStudentIds`, D10), so the parent portal shows that child's
> progress. Other tenants (Greenwood, Riverside, Northgate, Content Studio) use
> their own per-tenant email domains and passwords — see the data fragments.

---

## Dataset manifest

The bundled `seedConfig` composes **5 tenants** + 2 platform super-admins + 1
global preset. Counts are aggregate across all tenants. (A 6th
`testsessionProgressTenant` ships separately — it reuses real-world parent
emails that would collide with Greenwood in Auth, so it is **opt-in** and seeded
standalone.)

### Tenants

| Tenant                  | Code     | Focus                                                                                     |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------- |
| LevelUp Demo Academy    | `DEMO01` | Canonical demo logins (super-admin / admin / teacher / student / parent).                 |
| Greenwood Academy       | `GRN001` | Full end-to-end tenant: exams, spaces, submissions, analytics overlay.                    |
| Riverside High          | `RVS002` | Smaller second tenant — proves multi-tenant key isolation.                                |
| Northgate Public School | `NGP003` | Autograde-heavy: 4 exams across all statuses, ~30 submissions, dead-letter queue.         |
| LevelUp Content Studio  | `LUC100` | Content-heavy: 9 spaces, every question/material/story-point type, B2C store space, chat. |

### Entity counts (pipeline-written)

| Collection                             | Count |
| -------------------------------------- | ----- |
| tenants                                | 5     |
| Auth users (total)                     | 100   |
| userMemberships                        | 98    |
| superAdmins (platform users)           | 2     |
| globalEvaluationPresets                | 1     |
| academicSessions                       | 5     |
| classes                                | 11    |
| teachers                               | 14    |
| students                               | 53    |
| parents                                | 17    |
| staff (incl. tenant admins)            | 12    |
| scanners                               | 2     |
| agents                                 | 3     |
| rubricPresets                          | 5     |
| questionBank                           | 12    |
| spaces                                 | 9     |
| storyPoints                            | 22    |
| items                                  | 82    |
| answerKeys (server-only subcollection) | 64    |
| spaceReviews                           | 3     |
| chatSessions                           | 2     |
| chatMessages (subcollection)           | 6     |
| evaluationSettings                     | 3     |
| exams                                  | 5     |
| examQuestions (subcollection)          | 20    |
| submissions                            | 30    |
| questionSubmissions (subcollection)    | 108   |
| gradingDeadLetter                      | 2     |
| digitalTestSessions                    | 3     |
| testSession answers (subcollection)    | 7     |
| spaceProgress                          | 5     |
| storyPointProgress                     | 13    |
| achievements                           | 15    |
| studentLevel docs                      | 9     |
| studentAchievements                    | 18    |
| studyGoals                             | 4     |
| studySessions                          | 11    |
| announcements                          | 5     |
| announcement reads (subcollection)     | 5     |
| notifications                          | 20    |
| insights                               | 8     |
| costSummaries (inline)                 | 24    |

### Derived docs (analytics/gamification projections, written after the pipeline)

These are the read-model entities a server trigger/scheduler would have
computed. They are written with the same `Paths.*` / `seedId(...)` conventions
(so ids line up byte-for-byte) via a thin idempotent `ensureDoc` loop. **61 docs
total:**

| Collection                                          | Count |
| --------------------------------------------------- | ----- |
| examAnalytics                                       | 1     |
| studentProgressSummaries                            | 6     |
| classProgressSummaries                              | 4     |
| insights (rich)                                     | 4     |
| costSummaries (daily+monthly, byModel)              | 15    |
| llmCallLogs                                         | 12    |
| notificationPreferences                             | 6     |
| leaderboardEntries (tenant/space/storyPoint scopes) | 12    |

---

## Programmatic use

```ts
import { seed, verifySeed } from "@levelup/seed";
import {
  seedConfig,
  derivedSeedDocs,
  buildSeedConfig,
} from "@levelup/seed/config";

// seed the assembled dataset + its derived analytics docs
const result = await seed(seedConfig, {
  projectId: "lvlup-local",
  derivedDocs: derivedSeedDocs(),
});
console.log(result.counts, result.verify.ok);

// re-assemble with options (e.g. base fragments only, no analytics overlay)
const baseOnly = buildSeedConfig({ withoutAnalyticsOverlay: true });
```

### Architecture (the config → database pipeline)

```
SeedConfig (assembled, validated)
  → SeedContext (admin app, fixed clock, BatchWriter)
    → SeedPipeline.run() — dependency-ordered writes:
        tenant → users+auth+claims → memberships → sessions/classes
          → agents/rubrics/questionBank → spaces → storyPoints → items → answerKeys
          → reviews → chatSessions → evaluationSettings → exams → examQuestions
          → submissions → questionSubmissions → testSessions → progress → summaries
          → gamification → announcements → notifications → insights → costSummaries
      → derivedDocs (analytics projections) — thin idempotent ensureDoc loop
  → verify() — re-read counts, assert actual ≥ expected
```

Build / test:

```bash
pnpm -F @levelup/seed build       # tsup (cjs + esm + dts)
pnpm -F @levelup/seed typecheck   # tsc --noEmit
pnpm -F @levelup/seed test        # vitest (determinism + idempotency)
```
