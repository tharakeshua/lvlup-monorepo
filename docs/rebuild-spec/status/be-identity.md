# Status Report: `functions/identity` (Identity & Auth Backend)

> Audit date: 2026-06-19 Scope: `functions/identity/**`, with domain model in
> `packages/shared-types/src/identity/**` and the access model in
> `firestore.rules`. Owns: Firebase Auth lifecycle, the platform user document,
> tenants, tenant codes, memberships, custom claims, tenant-scoped entities
> (student/teacher/parent/staff/scanner/class/academic-session), tenant
> lifecycle, bulk import, data export, announcements, notifications.

---

## 1. What exists & how it's architected

### 1.1 Deployment shape

- A single Firebase Functions codebase exported from
  `functions/identity/src/index.ts`. Everything runs in region `asia-south1`.
- Build: plain `tsc` (CommonJS, ES2022, strict) → `lib/`. No bundler. Tests via
  `vitest` (extensive `src/__tests__/**` covering nearly every callable,
  trigger, scheduled job and util).
- Dependencies: `firebase-admin@13`, `firebase-functions@6`,
  `@google-cloud/secret-manager@5`, plus workspace packages
  `@levelup/shared-types` (domain types + Zod schemas) and
  `@levelup/functions-shared` (shared `parseRequest` + `enforceRateLimit`).

### 1.2 Function inventory (all in `src/index.ts`)

**Auth triggers (Gen 1 / `firebase-functions/v1`):**

- `onUserCreated` (`triggers/on-user-created.ts`) — on Auth account create,
  writes `/users/{uid}`.
- `onUserDeleted` (`triggers/on-user-deleted.ts`) — soft-deletes user doc,
  deactivates all memberships, decrements tenant stats.

**Firestore triggers (Gen 2):**

- `onClassArchived` (`triggers/on-class-deleted.ts`)
- `onStudentArchived` (`triggers/on-student-deleted.ts`) — fan-out removal of
  `studentId` from parent/class arrays.
- `onTenantDeactivated` (`triggers/on-tenant-deactivated.ts`) — when tenant
  status → `suspended`/`expired`, suspends all active memberships. Validates
  docs with `TenantSchema.safeParse`.
- `cleanupExpiredExports` (scheduled, `triggers/cleanup-expired-exports.ts`) —
  every 30 min, deletes Storage export files past their `deleteAfter` metadata.

**Scheduled jobs:**

- `tenantLifecycleCheck` (`scheduled/tenant-lifecycle.ts`) — daily;
  trial→expired transition + flags long-expired tenants.
- `monthlyUsageReset` (`scheduled/usage-reset.ts`) — monthly; resets
  `usage.examsThisMonth`/`aiCallsThisMonth`.

**Callable endpoints (Gen 2 `onCall`, all `cors: true`):**

- Tenant: `saveTenant`, `deactivateTenant`, `reactivateTenant`,
  `exportTenantData`, `uploadTenantAsset`
- Entities (consolidated upsert): `saveStudent`, `saveTeacher`, `saveParent`,
  `saveStaff`, `saveClass`, `saveAcademicSession`
- Multi-tenant user mgmt: `createOrgUser`, `switchActiveTenant`, `joinTenant`
- Bulk: `bulkImportStudents`, `bulkImportTeachers`, `bulkUpdateStatus`,
  `rolloverSession`
- Misc: `manageNotifications`, `saveAnnouncement`, `listAnnouncements`,
  `searchUsers` (SuperAdmin), `saveGlobalEvaluationPreset` (SuperAdmin)

### 1.3 Request pipeline (consistent pattern)

Each callable follows: `request.auth?.uid` check →
`parseRequest(request.data, ZodSchema)` (`utils/parse-request.ts` →
`functions-shared`) → authorization assertion (`assertTenantAdminOrSuperAdmin` /
explicit `isSuperAdmin`) → `enforceRateLimit` (Firestore sliding window in
`functions-shared/rate-limit.ts`) → optional `assertTenantAccessible` /
`assertQuota` / `assertFeatureEnabled` → Firestore writes →
`setCustomUserClaims` → stats/usage counters → `logTenantAction` (tenant
audit) + `writePlatformActivity` (platform log).

### 1.4 Identity model (end to end)

**Three-document identity spine:**

1. `/users/{uid}` — `UnifiedUser` (`shared-types/identity/user.ts`).
   Platform-wide identity. Holds `isSuperAdmin`, `activeTenantId`,
   `consumerProfile` (B2C), `status`. Created by `onUserCreated` for ALL Auth
   accounts.
2. `/userMemberships/{uid}_{tenantId}` — `UserMembership`
   (`shared-types/identity/membership.ts`). Composite-key doc enforcing **one
   role per (user, tenant)**. Holds `role`, `status`, `joinSource`, links to
   role entity (`studentId`/`teacherId`/`parentId`/`staffId`/`scannerId`), and
   granular `permissions` (teacher) / `staffPermissions`.
3. **Custom claims** — built by `buildClaimsForMembership` (`utils/claims.ts`)
   into `PlatformClaims` (`shared-types/identity/claims.ts`). This is the "hot
   path" read by `firestore.rules`. Per role it sets `role`, `tenantId`,
   `tenantCode`, plus role-specific ids/permissions and (for teacher/student)
   `classIds` capped at `MAX_CLAIM_CLASS_IDS = 15` with a `classIdsOverflow`
   flag.

**Roles** (`TenantRole`):
`superAdmin | tenantAdmin | teacher | student | parent | scanner | staff`. Note:
platform-level superadmin is actually carried by `UnifiedUser.isSuperAdmin`, not
by a membership — `superAdmin` rarely appears as a membership role.

**Tenant model:** `/tenants/{tenantId}` (`Tenant` in
`shared-types/identity/tenant.ts`) with nested `subscription`, `features`,
`settings`, `stats`, `usage`, `branding`, `onboarding`, `deactivation`.
`/tenantCodes/{CODE}` is a uniqueness index (`TenantCodeIndex`) created
transactionally with the tenant and used for pre-auth login lookup and
`joinTenant`.

**Key auth flows:**

- _Tenant creation_ (`saveTenant`, no `id`): SuperAdmin only. Transaction
  creates tenant + tenantCode + creator's `tenantAdmin` membership, then sets
  creator claims. Derives `tenantCode` from `shortName`/`name` (uppercased,
  alphanum, ≤12). Stores Gemini API key in Secret Manager.
- _Org user creation_ (`createOrgUser`): TenantAdmin/SuperAdmin. Creates Auth
  user → tenant entity doc → membership → claims → stats/usage → user doc. Has
  rollback (`auth().deleteUser`) if entity creation fails. Students without
  email get a synthetic email `{rollNumber}@{tenantId}.levelup.internal`.
- _Self-join_ (`joinTenant`): user supplies a tenant code → creates a `student`
  membership (`joinSource: 'tenant_code'`), reactivates if previously
  deactivated, sets claims, sets `activeTenantId` if empty.
- _Tenant switch_ (`switchActiveTenant`): validates active membership → rebuilds
  claims for that tenant → updates `activeTenantId`. This is how a multi-tenant
  user changes context (claims are single-tenant at a time).
- _Entity upserts_ (`saveStudent`/`saveTeacher`/`saveParent`): create-or-update
  via presence of `id`; on create they also create membership + claims and keep
  denormalized rosters (`class.studentIds`/`studentCount`, `student.parentIds`)
  in sync.

### 1.5 Cross-cutting utils (`src/utils/`)

- `claims.ts` — claim builder.
- `auth-helpers.ts` — `sanitizeRollNumber`, `generateTempPassword`,
  `generateSlug`, `determineProvider`.
- `firestore-helpers.ts` — `getUser`, `getMembership`, `getTenant`,
  `updateTenantStats`.
- `assertions.ts` — `assertTenantAccessible` (write vs access status gates),
  `assertTenantAdminOrSuperAdmin`.
- `quota.ts` — `assertQuota` (subscription limits from `stats`).
- `feature-gate.ts` — `assertFeatureEnabled`.
- `usage.ts` — atomic `incrementUsage` / `incrementUsageMultiple` (real-time
  counters).
- `rate-limit.ts` / `parse-request.ts` — thin re-exports of `functions-shared`.
- `audit-log.ts` — `/tenants/{tenantId}/auditLogs` (best-effort).
- `platform-activity.ts` — `/platformActivityLog` (best-effort, resolves actor
  email).
- `notifications/notification-sender.ts` — Firestore notification + RTDB unread
  badge (single + bulk).

---

## 2. Entities / schemas / collections / APIs (file paths)

### Collections

- `/users/{uid}` — `UnifiedUser` — `shared-types/identity/user.ts`
- `/userMemberships/{uid}_{tenantId}` — `UserMembership` —
  `shared-types/identity/membership.ts`
- `/tenants/{tenantId}` — `Tenant` — `shared-types/identity/tenant.ts`
- `/tenantCodes/{CODE}` — `TenantCodeIndex` —
  `shared-types/identity/tenant-code.ts`
- `/tenants/{tid}/students/{id}` — `Student` — `shared-types/tenant/student.ts`
- `/tenants/{tid}/teachers/{id}` — `Teacher` — `shared-types/tenant/teacher.ts`
- `/tenants/{tid}/parents/{id}` — `Parent` — `shared-types/tenant/parent.ts`
- `/tenants/{tid}/staff/{id}`, `/scanners/{id}` — written inline in
  `create-org-user.ts` (no shared type)
- `/tenants/{tid}/classes/{id}` — `Class` — `shared-types/tenant/class.ts`
- `/tenants/{tid}/academicSessions/{id}` — `AcademicSession`
- `/tenants/{tid}/auditLogs` (also `/auditLog` — see pain points),
  `/notifications`, `/announcements`, `/rateLimits`
- `/platformActivityLog`, `/announcements`, `/globalEvaluationPresets`
- RTDB: `notifications/{tenantId}/{recipientId}/{unreadCount,latest}`
- Storage: `exports/{tenantId}/...` (credentials + data export, short-lived
  signed URLs)

### Custom claims (`PlatformClaims`)

`role, tenantId, tenantCode, teacherId, studentId, parentId, scannerId, staffId, classIds[], classIdsOverflow, studentIds[], permissions{}, staffPermissions{}`
— `shared-types/identity/claims.ts`, built in `utils/claims.ts`.

### Callable APIs & their schemas

- Request validation Zod schemas: `shared-types/src/schemas/callable-schemas.ts`
  (most) + `shared-types/src/schemas/announcement.schema.ts`. A few callables
  define inline Zod (`searchUsers`, `bulkUpdateStatus`, `rolloverSession`,
  `uploadTenantAsset`, `bulkImportTeachers`).
- Request/response TS interfaces: `shared-types/src/callable-types.ts`.
- Client wrappers: `packages/shared-services/src/auth/auth-callables.ts` calls
  these by string name via `httpsCallable`.

### Access model (`firestore.rules`)

- Helpers: `isSuperAdmin()` (reads `/users/{uid}.isSuperAdmin`),
  `belongsToTenant` (claim `tenantId`), `hasRole` (claim `role`),
  `getMembership` (reads membership doc for overflow/permission fallbacks),
  `canAccessClass` (claim `classIds` with overflow fallback to
  `getMembership().permissions.managedClassIds`),
  `hasTeacherPermission`/`hasStaffPermission`.
- `/userMemberships` is `write: if false` (Admin SDK only); reads gated to owner
  or SuperAdmin.
- `/tenants` + `/tenantCodes` allow `get: if true` (pre-auth login lookup) but
  `list` requires auth; writes are SuperAdmin or callable-only.

---

## 3. Strengths worth keeping

1. **Clean separation of identity layers.** The `UnifiedUser` (who you are) /
   `UserMembership` (what you are in a tenant) / `PlatformClaims` (cached
   hot-path) triad is a solid, well-reasoned model that cleanly supports
   multi-tenancy.
2. **Claims kept deliberately minimal** with a documented JWT-size cap
   (`MAX_CLAIM_CLASS_IDS`) and an overflow flag that rules degrade to a
   membership-doc lookup. This is the right tradeoff and security rules already
   implement the fallback.
3. **Consolidated upsert ("save\*") pattern.**
   `saveTenant/saveStudent/saveTeacher/...` collapse create/update/delete/assign
   into one endpoint keyed by `id` presence — fewer functions, consistent shape,
   `SaveResponse { id, created }`.
4. **Defense-in-depth + good hygiene.** Zod validation at the boundary,
   per-action rate limiting, quota + feature gates, tenant-status gating
   (`write` vs `access`), SuperAdmin self-elevation blocked in rules, secrets in
   Secret Manager, credentials delivered via short-lived signed URLs (never
   plaintext in response) with a scheduled cleanup job.
5. **Atomic counters.** `usage.ts` strictly uses `FieldValue.increment` (no
   read-modify-write), documented rationale.
6. **Rollback on partial failure** in `createOrgUser` (deletes the orphan Auth
   user).
7. **Trigger-based consistency** for fan-out cleanup (membership suspension on
   tenant deactivation, roster cleanup on student archive) plus dual
   write-time + trigger-time enforcement.
8. **Excellent test coverage** — nearly every callable/trigger/scheduled/util
   has a vitest suite.
9. **Audit + activity logging** is wired through almost every mutating endpoint
   and is best-effort (never blocks the main op).

---

## 4. Pain points / tech debt / inconsistencies

1. **`uid` vs `authUid` schism on entity docs.** `Teacher` type declares
   `authUid` (with `uid` `@deprecated`), but `create-org-user.ts`,
   `save-teacher.ts`, `save-student.ts` all write `uid`.
   `bulk-import-students.ts` writes `uid` for the student but `authUid` for the
   auto-created parent (`parentRef.set({ authUid: ... })`) — within ONE file.
   Downstream lookups (`save-teacher` permission update reads `teacherData.uid`)
   assume `uid`. This is a latent data-integrity bug.
2. **Audit log path inconsistency.** `utils/audit-log.ts` writes
   `/tenants/{tid}/auditLogs`, but `scheduled/tenant-lifecycle.ts` writes
   `/tenants/{tid}/auditLog` (singular). Two divergent collections for the same
   concept.
3. **Membership creation duplicated and divergent.** `createOrgUser` gives a
   student membership `permissions: { managedClassIds }` (odd for a student),
   while `saveStudent` does the same; `joinTenant` creates a student membership
   with **no entity doc and no `studentId`** (just a placeholder role) — so a
   code-joined "student" has a membership but no `/students/{id}` profile. Three
   creation paths with subtly different shapes and no single factory.
4. **`onUserCreated` vs `createOrgUser` write different user shapes.** The
   trigger writes `authProviders: [...]` (array, matching the type);
   `createOrgUser`'s inline user doc writes `authProvider` (singular, not in the
   type) and omits `status`/`authProviders`. Also `createOrgUser` only creates
   the `/users/{uid}` doc "if it doesn't exist" — but the Auth trigger has
   usually already created it, so the richer firstName/lastName in
   `createOrgUser` may be silently dropped (race/ordering dependent).
5. **No transactional integrity across the multi-write flows.**
   `createOrgUser`/`saveStudent`/`bulkImport` perform sequential `await` writes
   (entity → membership → claims → counters → user doc) without a transaction or
   saga. A mid-flow failure leaves partial state (e.g., membership without
   claims, or class roster updated but membership failed). Only the Auth user is
   rolled back.
6. **Counter drift risk.** Two parallel counter systems: `stats.total*` (via
   `updateTenantStats`) and `usage.current*` (via `incrementUsage`). They are
   incremented in different places (e.g., `onUserDeleted` decrements `stats` but
   not `usage`; `joinTenant` increments neither). They will diverge over time;
   nothing reconciles them.
7. **Schema duplication / drift.** Some callables import schemas from
   `shared-types` while others redefine inline Zod (`searchUsers`,
   `bulkUpdateStatus`, `rolloverSession`, `uploadTenantAsset`,
   `bulkImportTeachers` re-declare `firestoreId`/`MAX_SHORT_TEXT`). The
   `*Request` TS interfaces in `callable-types.ts` are maintained separately
   from the Zod schemas — two sources of truth that can drift (and
   `createOrgUser` has both an interface AND a duplicate inline
   `CreateOrgUserRequest`).
8. **Gen 1 Auth triggers.** `onUserCreated`/`onUserDeleted` use
   `firebase-functions/v1`. Mixing Gen 1 and Gen 2 complicates deploys and the
   eventual Auth-blocking-functions migration. Auth triggers also can't run in a
   transaction with the calling client.
9. **`searchUsers` is O(N) per result** — for each found user it issues a
   separate membership query (N+1). Also relies on prefix search over
   `email`/`displayName` (no real search index), and reads
   `lastLoginAt`/`createdAt` though the type uses `lastLogin`/`createdAt`.
10. **`scanner`/`staff` entities have no shared type.** Their docs are
    constructed ad-hoc inline in `create-org-user.ts`; there is a planned
    scanner-app in `requirements/` but no typed contract.
11. **`tenantCode` derivation is collision-prone.** Derived purely from
    name/shortName (uppercased alphanum, ≤12) with only a transactional
    existence check that throws — no auto-suffix/retry. Two "Springfield"
    tenants → second creation just fails.
12. **CSV export is naive.** `export-tenant-data.ts` derives CSV headers from
    the first row's keys only; rows with extra/missing fields produce misaligned
    columns, and nested objects are JSON-stringified inconsistently.
13. **No idempotency keys** on any mutating callable — a retried
    `createOrgUser`/`bulkImport` can create duplicate Auth users / entities
    (bulk import partially guards via `getUserByEmail` fallback, but the
    entity/membership writes are not idempotent).
14. **`Record<string, boolean>` claim permissions** lose their precise types
    once in `PlatformClaims` (`permissions?: Record<string, boolean>`), so rules
    and TS callers can't be type-checked against the real
    `TeacherPermissions`/`StaffPermissions` keys.

---

## 5. Recommendations for a fresh rebuild

**Keep the core concepts:** the `User / Membership / Claims` triad, composite
`{uid}_{tenantId}` membership key, minimal claims + overflow fallback, the
consolidated upsert ergonomics, Zod-at-the-boundary, rate-limit/quota/feature
gates, secrets in Secret Manager, signed-URL credential delivery.

**Concrete changes:**

1. **Adopt a common API layer / domain-service split.** Put all identity
   business logic in framework-agnostic service modules
   (`createOrgUser(input, ctx)`, `joinTenant`, `switchTenant`, `upsertEntity`)
   that take an explicit `AuthContext`. Expose them through thin adapters:
   Firebase `onCall` today, and an HTTP/REST (or tRPC) gateway tomorrow. This is
   what lets the future React Native apps and a shared API surface call the same
   logic without depending on the Firebase callable SDK. Validate every entry
   with the same shared Zod schemas regardless of transport.

2. **Single source of truth for contracts.** Derive the `*Request`/`*Response`
   TS types from the Zod schemas with `z.infer` and delete the hand-written
   interfaces in `callable-types.ts`. One schema → types + runtime validation +
   (optionally) OpenAPI for the REST gateway and RN client codegen.

3. **One membership/entity factory.** Replace the three divergent creation paths
   (`createOrgUser`, `save*` create branch, `joinTenant`) with a single
   `provisionMembership({ role, links, permissions, joinSource })` so every
   membership has the same shape and every role has (or explicitly does not
   have) a backing entity doc. Decide and document: does a `joinTenant` student
   get a `/students/{id}` profile (recommended: yes, created lazily).

4. **Make multi-write flows transactional / saga-based.** Wrap
   entity+membership+counter writes in a Firestore transaction where possible;
   for Auth-user + Firestore (which can't share a transaction), use a documented
   compensating-action saga (already partially present in `createOrgUser`) and
   an idempotency key per request to make retries safe.

5. **Normalize the link field once and for all.** Pick `authUid` everywhere (or
   `uid` everywhere) for entity→Auth linkage and migrate. Remove the
   `@deprecated` dual field. Add a typed `TenantEntity` base with `tenantId`,
   `authUid`, `status`, timestamps; give `staff`/`scanner` real shared types.

6. **Unify the counter model.** Either derive `stats.total*` from authoritative
   counts on read (or via a scheduled reconciler), or collapse `stats` and
   `usage` into one counter set updated through a single
   `adjustTenantCounters(delta)` helper called from every
   create/delete/join/leave path (including `joinTenant` and the deletion
   trigger).

7. **Type the claim permissions.** Replace
   `permissions?: Record<string, boolean>` with the real
   `TeacherPermissions`/`StaffPermissions` shapes (or a discriminated union on
   `role`) so claims, rules-generation, and callers stay type-safe.

8. **Migrate Auth triggers to Gen 2 / blocking functions.** Use
   `beforeUserCreated`/`beforeSignIn` blocking functions for synchronous claim
   seeding and to eliminate the `onUserCreated`-vs-`createOrgUser` user-doc
   race. Standardize on `authProviders` array.

9. **Fix the small correctness bugs now so they don't migrate:** single
   audit-log collection name; `tenantCode` auto-suffix on collision; robust CSV
   export (union of all keys for headers); `searchUsers` to a batched
   `where('uid','in',...)` membership fetch and a real search index (or keep it
   admin-only and acknowledged-slow).

10. **Externalize config & regions.** Region (`asia-south1`) and limits
    (`MAX_CLAIM_CLASS_IDS`, rate-limit ceilings, quota defaults, tenant default
    `features`) are scattered as literals across files — centralize into a
    config module so the REST gateway and functions share them.
