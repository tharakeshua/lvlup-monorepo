# Phase 11: Migration Scripts — Implementation Report

**Author:** Identity Auth Engineer **Date:** 2026-02-24 **Status:** Complete —
TypeScript compiles cleanly (`tsc --noEmit` passes) **Location:**
`scripts/migration/`

---

## 1. Files Created (22 TypeScript files)

### Package Infrastructure

| File                              | Purpose                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `scripts/migration/package.json`  | Package definition: deps on `firebase-admin`, `commander`, `tsx`, `typescript` |
| `scripts/migration/tsconfig.json` | Strict TypeScript config, ES2022 target, NodeNext module resolution            |

### Core (`scripts/migration/src/`)

| File                   | Purpose                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/config.ts`        | Firebase Admin SDK initialization, `getFirestore()`, `getAuth()`, `toTimestamp()` helper                              |
| `src/run-migration.ts` | CLI entry point using `commander` — parses `--source`, `--type`, `--client-id`, `--dry-run`, `--verify`, `--rollback` |

### Utilities (`src/utils/`)

| File                           | Purpose                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/utils/batch-processor.ts` | `processBatch()` — 500-doc Firestore batches with 1s rate limiting; `readAllDocs()` with pagination; `docExists()` idempotency check |
| `src/utils/logger.ts`          | `MigrationLogger` class — timestamped console logging, counters (created/skipped/errors/total), `printSummary()`, `generateRunId()`  |
| `src/utils/verification.ts`    | `countDocs()`, `verifyCollectionCounts()`, `spotCheckDocument()` (field-by-field comparison), `printVerificationResults()`           |

### AutoGrade Migrations (`src/autograde/`)

| File                             | Source → Target                                                                                     | Details                                                                                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrate-clients-to-tenants.ts`  | `/clients/{clientId}` → `/tenants/{tenantId}`                                                       | Maps Client schema to Tenant; creates `/tenantCodes/{code}` index; sets features (`autoGradeEnabled: true`, `levelUpEnabled: false`); preserves `clientId` as `tenantId`                                |
| `migrate-users.ts`               | `/clients/{cId}/students\|teachers\|parents` → `/users/{uid}` + `/userMemberships/{uid}_{tenantId}` | Processes all 3 user types; merge-creates `/users/{uid}` (handles existing users); creates membership with role-specific fields; maps teacher `classIds` → `permissions.managedClassIds`                |
| `migrate-exams.ts`               | `/clients/{cId}/exams/{eId}` → `/tenants/{tId}/exams/{eId}`                                         | Migrates exam + `/questions/{qId}` subcollection; maps legacy status (`in_progress` → `grading`, etc.); enriches `gradingConfig` with new fields (`allowManualOverride`, `releaseResultsAutomatically`) |
| `migrate-submissions.ts`         | `/clients/{cId}/submissions/{sId}` → `/tenants/{tId}/submissions/{sId}`                             | Migrates submission + `/questionSubmissions/{qId}` subcollection; maps legacy `summary.status` → new `pipelineStatus`; adds `uploadSource: 'web'`, `retryCount: 0`, `resultsReleased` flag              |
| `migrate-evaluation-settings.ts` | `/clients/{cId}/evaluationSettings/{esId}` → `/tenants/{tId}/evaluationSettings/{esId}`             | Direct mapping; preserves `enabledDimensions[]` and `displaySettings` intact                                                                                                                            |
| `migrate-classes.ts`             | `/clients/{cId}/classes/{clId}` → `/tenants/{tId}/classes/{clId}`                                   | Builds cross-reference maps from students/teachers → classes; creates `/tenants/{tId}/students/{sId}` and `/tenants/{tId}/teachers/{tId}` docs; populates `teacherIds[]` and `studentIds[]` on class    |

### LevelUp Migrations (`src/levelup/`)

| File                           | Source → Target                                                                              | Details                                                                                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrate-orgs-to-tenants.ts`   | `/orgs/{orgId}` → `/tenants/{tenantId}`                                                      | Maps Org schema to Tenant; creates `/tenantCodes/{code}` index; sets features (`levelUpEnabled: true`, `autoGradeEnabled: false`); creates memberships for `adminUids[]` (owner → `tenantAdmin`, others → `teacher`) |
| `migrate-users.ts`             | `/userOrgs` + `/users` + `/userRoles` → `/users/{uid}` + `/userMemberships/{uid}_{tenantId}` | Queries `userOrgs` by `orgId`; reads `userRoles` to determine role (`orgAdmin` → `tenantAdmin`, `courseAdmin` → `teacher`, default → `student`); merge-creates unified user docs; converts millis timestamps         |
| `migrate-courses-to-spaces.ts` | `/courses/{cId}` → `/tenants/{tId}/spaces/{sId}`                                             | Queries courses by `orgId`; maps `type: 'practice_range'` → `'practice'`, default → `'learning'`; maps `isPublic` → `accessType: 'public_store'`; migrates `/storyPoints` as subcollection under space               |
| `migrate-items.ts`             | `/items/{itemId}` → `/tenants/{tId}/spaces/{sId}/items/{itemId}`                             | Queries global items by `courseId` for each org course; preserves `payload`, `meta`, `analytics` intact; re-parents under tenant space                                                                               |
| `migrate-progress.ts`          | `/userStoryPointProgress/{uId}_{spId}` → `/tenants/{tId}/spaceProgress/{uId}_{sId}`          | Groups story point progress by userId; aggregates into single SpaceProgress doc per user per space; computes `pointsEarned`, `totalPoints`, `percentage`, overall `status`; merges `items` maps                      |
| `migrate-consumer-users.ts`    | `/users` (no org) → `/users/{uid}` with `consumerProfile`                                    | Identifies consumer users (no `userOrgs` membership); looks up enrolled courses via progress records; adds `consumerProfile: { plan: 'free', enrolledSpaceIds: [...] }`                                              |

### Verification Scripts (`src/verify/`)

| File                  | What It Verifies                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify-autograde.ts` | Tenant exists; count comparison for classes, exams, submissions, evaluationSettings, students, teachers; spot-checks first exam (title, totalMarks, subject)                                                              |
| `verify-levelup.ts`   | Tenant exists; courses → spaces count; userOrgs → memberships count; items count across all spaces; spot-checks first course→space (title, slug)                                                                          |
| `verify-users.ts`     | Total users/memberships count; duplicate membership detection (same `uid_tenantId`); orphaned membership check (references non-existent user); orphaned tenant check (references non-existent tenant); sampled (100 docs) |

### Rollback Scripts (`src/rollback/`)

| File                    | What It Deletes                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rollback-autograde.ts` | Deletes in reverse dependency order: questionSubmissions → submissions → questions → exams → evaluationSettings → students → teachers → classes → memberships (joinSource=migration) → tenant + tenantCode. **Only deletes docs with `_migratedFrom: 'autograde'`** |
| `rollback-levelup.ts`   | Deletes: spaceProgress → items → storyPoints → spaces → memberships (joinSource=migration) → tenant + tenantCode. **Only deletes docs with `_migratedFrom: 'levelup'`**                                                                                             |

---

## 2. CLI Usage

```bash
# ============ AutoGrade ============

# Dry run — full migration for one client
npx tsx src/run-migration.ts --source autograde --type all --client-id abc123 --dry-run

# Migrate specific type
npx tsx src/run-migration.ts --source autograde --type exams --client-id abc123

# Migrate all clients to tenants (no --client-id = all)
npx tsx src/run-migration.ts --source autograde --type tenants

# Available --type values for autograde:
#   all | tenants | users | classes | exams | submissions | evaluation-settings

# ============ LevelUp ============

# Dry run — full org migration
npx tsx src/run-migration.ts --source levelup --type all --client-id orgId123 --dry-run

# Migrate consumer users (no --client-id needed)
npx tsx src/run-migration.ts --source levelup --type consumer-users

# Available --type values for levelup:
#   all | tenants | users | spaces | items | progress | consumer-users

# ============ Verification ============

npx tsx src/run-migration.ts --verify autograde --client-id abc123
npx tsx src/run-migration.ts --verify levelup --client-id orgId123
npx tsx src/run-migration.ts --verify users

# ============ Rollback ============

npx tsx src/run-migration.ts --rollback autograde --client-id abc123 --dry-run
npx tsx src/run-migration.ts --rollback levelup --client-id orgId123
```

**`--type all` execution order:**

- AutoGrade: tenants → users → classes → exams → submissions →
  evaluation-settings
- LevelUp: tenants → users → spaces → items → progress → consumer-users

---

## 3. Batch Processing Strategy

### Core Parameters

| Parameter         | Value      | Rationale                                               |
| ----------------- | ---------- | ------------------------------------------------------- |
| Batch size        | 500 docs   | Firestore `WriteBatch` limit is 500 operations          |
| Inter-batch delay | 1,000ms    | Rate limiting to avoid Firestore 429s                   |
| Pagination size   | 1,000 docs | For `readAllDocs()` — reads source collections in pages |

### Flow

```
readAllDocs(sourceCollection)    // Paginated reads, returns all docs
    ↓
processBatch(items, processor)   // Splits into 500-doc chunks
    ↓ for each chunk:
    processor(item, batch, db)   // Adds set/update ops to WriteBatch
        ↓ checks docExists()    // Idempotency: skip if target exists
    batch.commit()               // Atomic Firestore write
    sleep(1000ms)                // Rate limiting
    ↓
logger.printSummary()            // Created / Skipped / Errors / Total
```

### Subcollection Handling

For exams (questions) and submissions (questionSubmissions), the processor reads
subcollections inline per parent doc and adds those writes to the same batch.
This means a single batch may contain parent + child writes, keeping them
atomic.

---

## 4. Key Design Decisions

### 4.1 ID Preservation

- **`clientId` → `tenantId`** (AutoGrade): 1:1 mapping. The original client ID
  becomes the tenant ID for traceability and minimal disruption.
- **`orgId` → `tenantId`** (LevelUp): Same 1:1 mapping.
- **`courseId` → `spaceId`**: Preserved. Course document ID becomes space
  document ID.
- **`examId`, `submissionId`, `classId`**: All preserved as-is.

### 4.2 `_migratedFrom` Marker

Every migrated document gets a `_migratedFrom: 'autograde' | 'levelup'` field.
This enables:

- **Safe rollback**: Rollback scripts only delete docs with this marker, never
  natively-created data.
- **Audit trail**: Easy to identify migrated vs. new data.
- Some docs also get `_migrationSourcePath` for exact provenance.

### 4.3 Idempotency

Before every write, `docExists(db, targetPath)` is called. If the target doc
already exists, it's skipped (logged as "skipped"). This means:

- Re-running a migration is safe (no duplicates, no overwrites).
- Partially-failed migrations can be resumed.

### 4.4 User Merge Strategy

Both AutoGrade and LevelUp users converge to `/users/{uid}`. When a user already
exists (e.g., same person in both systems),
`batch.set(path, data, { merge: true })` is used. This:

- Preserves existing fields (won't overwrite `consumerProfile` if already set).
- Adds new fields from the migration source.
- Only sets `createdAt` on first creation.

### 4.5 Membership `joinSource: 'migration'`

All migrated memberships are tagged with `joinSource: 'migration'`. This:

- Distinguishes migrated memberships from organically-created ones.
- Enables rollback to target only migration-created memberships.

### 4.6 Status Mapping

Legacy statuses are mapped to new enum values:

**AutoGrade Exam Status:** | Legacy | New | |--------|-----| | `draft` | `draft`
| | `question_paper_uploaded` | `question_paper_uploaded` | | `in_progress` |
`grading` | | `completed` | `completed` |

**AutoGrade Submission Pipeline Status:** | Legacy (`summary.status`) | New
(`pipelineStatus`) | |---------------------------|------------------------| |
`pending` | `uploaded` | | `scouting` | `scouting` | | `grading` | `grading` | |
`completed` | `grading_complete` | | `failed` | `failed` |

**LevelUp Course Type → Space Type:** | Legacy | New | |--------|-----| |
`practice_range` | `practice` | | default/undefined | `learning` |

### 4.7 Feature Flags on Tenants

Migrated tenants get feature flags set based on their source:

- **AutoGrade tenants**: `autoGradeEnabled: true`, `levelUpEnabled: false`,
  `scannerAppEnabled: true`, `aiGradingEnabled: true`
- **LevelUp tenants**: `levelUpEnabled: true`, `autoGradeEnabled: false`,
  `aiChatEnabled: true`

### 4.8 Teacher Permissions

AutoGrade teachers get default permissions with their existing `classIds` mapped
to `permissions.managedClassIds`. LevelUp org admins get `tenantAdmin` role;
course admins get `teacher` role.

### 4.9 Consumer User Handling

Consumer (B2C) users are identified by having zero `userOrgs` memberships. They
get a `consumerProfile: { plan: 'free', enrolledSpaceIds }` based on their
progress records. No membership docs are created for consumer users.

### 4.10 Rollback Order

Rollback scripts delete in reverse dependency order to avoid orphaned
references:

1. Leaf subcollections first (questionSubmissions, items, storyPoints)
2. Parent collections (submissions, exams, spaces)
3. Cross-references (memberships with `joinSource: 'migration'`)
4. Root tenant + tenantCode index last

---

## 5. Dependencies

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.11.0"
  }
}
```

---

## 6. Verification Output Example

```
========== Verification Results ==========
[PASS] Classes:              source=12, target=12
[PASS] Exams:                source=45, target=45
[PASS] Submissions:          source=312, target=312
[PASS] EvaluationSettings:   source=3, target=3
[PASS] Students:             source=240, target=240
[PASS] Teachers:             source=8, target=8

Overall: ALL PASSED
==========================================
```

---

## 7. What Was NOT Built (Out of Scope)

- **Dual-write proxy** (Phase A of Blueprint §12.5): This requires runtime
  middleware in Cloud Functions, not batch scripts.
- **Feature flag collection** (`/migrationFlags/{tenantId}`): Will be created by
  the runtime dual-write layer.
- **RTDB migration**: LevelUp RTDB data (leaderboards, real-time progress,
  metrics) was not migrated — these are regenerated from Firestore data at
  runtime.
- **Cloud Storage migration**: Image URLs are preserved as-is (same Firebase
  Storage bucket).
- **Migration log to Firestore** (`/migrationLogs/{runId}`): Logger writes to
  console only. Can be extended to write to Firestore if needed.
