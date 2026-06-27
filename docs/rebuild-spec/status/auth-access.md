# STATUS REPORT — Auth, Roles, Permissions & Access Control

Scope: the authentication, authorization, role/claims model, tenant isolation
and row-level security (RLS) of the auto-levelup monorepo. Sources read
directly: `firestore.rules`, `firestore.indexes.json`, `database.rules.json`,
`storage.rules`, `packages/shared-types/src/identity/*`,
`functions/identity/src/*`, `functions/autograde/src/utils/assertions.ts`,
`packages/shared-services/src/auth/auth-callables.ts`,
`packages/shared-stores/src/auth-store.ts`, and per-app route guards.

---

## 1. What Currently Exists & How It Is Architected

### 1.1 Authentication backbone

- Firebase Authentication is the identity provider. Supported providers per
  `AuthProvider` (`packages/shared-types/src/identity/user.ts:19`): `email`,
  `phone`, `google`, `apple`.
- On Auth account creation, a v1 auth trigger
  (`functions/identity/src/triggers/on-user-created.ts`) mirrors the account
  into a platform user doc `/users/{uid}` (`UnifiedUser`). `isSuperAdmin`
  defaults to `false`; there is no client path to elevate it (rules block
  self-elevation — see §1.5).
- School/student login does NOT use a real email for roll-number students.
  `createOrgUser` synthesizes `…@{tenantId}.levelup.internal` emails
  (`functions/identity/src/callable/create-org-user.ts:85-89`); the client
  derives the same address via `deriveStudentEmail` during `loginWithSchoolCode`
  (`packages/shared-stores/src/auth-store.ts:184-223`).

### 1.2 The three-layer identity model

Identity is split across three Firestore documents, which is the central design
of the system:

1. `/users/{uid}` — `UnifiedUser` (platform-global; one per human).
   `packages/shared-types/src/identity/user.ts:43`. Holds `isSuperAdmin`,
   `activeTenantId`, optional `consumerProfile` (B2C).
2. `/userMemberships/{uid}_{tenantId}` — `UserMembership` (the join row that
   grants a role inside a tenant).
   `packages/shared-types/src/identity/membership.ts:92`. Composite key enforces
   one role per (user, tenant). Source of truth for roles and granular
   permissions.
3. `/tenants/{tenantId}/{students|teachers|parents|staff|scanners}/{entityId}` —
   role-specific entity docs created by `createOrgUser`
   (`create-org-user.ts:126-168`).

The membership doc is projected onto the Firebase Auth JWT as **custom claims**
(the "hot path" read by security rules).

### 1.3 Custom claims (the JWT projection)

- Shape: `PlatformClaims` (`packages/shared-types/src/identity/claims.ts:15`):
  `role`, `tenantId`, `tenantCode`,
  `teacherId`/`studentId`/`parentId`/`scannerId`/`staffId`, `classIds[]`,
  `classIdsOverflow`, `studentIds[]`, `permissions{}`, `staffPermissions{}`.
- Built by `buildClaimsForMembership`
  (`functions/identity/src/utils/claims.ts:11`). Role-switched: teacher/student
  get `classIds` (source = `permissions.managedClassIds`), parent gets
  `studentIds`, staff gets `staffPermissions`, scanner gets `scannerId`,
  tenantAdmin gets nothing extra.
- JWT size guard: `MAX_CLAIM_CLASS_IDS = 15` (`claims.ts:9`). Beyond 15 classes,
  claims are truncated and `classIdsOverflow=true` is set; rules then fall back
  to reading `getMembership().permissions.managedClassIds` from Firestore
  (`firestore.rules:69-73`, `canAccessClass`).
- Claims are set/refreshed by: `createOrgUser`, `saveTeacher`, `saveStudent`,
  `joinTenant`, `switchActiveTenant`, and bulk-import callables. They are NEVER
  writable from the client.

### 1.4 Multi-tenant context switching

- A user can belong to multiple tenants. Only ONE tenant context lives in the
  JWT at a time. `switchActiveTenant`
  (`functions/identity/src/callable/switch-active-tenant.ts`) validates an
  active membership + accessible tenant, rebuilds claims for the new tenant, and
  writes `users/{uid}.activeTenantId`. The client then force-refreshes the ID
  token (`auth-store.ts:271-274`).
- `joinTenant` (`functions/identity/src/callable/join-tenant.ts`) lets an
  authenticated user self-join by tenant code, defaulting to role `student`
  (reactivates a deactivated membership if one exists).

### 1.5 Firestore security rules (`firestore.rules`) — the real enforcement layer

Helper functions (`firestore.rules:6-88`):

- `isSuperAdmin()` — reads `/users/{uid}.isSuperAdmin` via `get()` (NOT a
  claim).
- `belongsToTenant(t)` — `request.auth.token.tenantId == t` (claim-based).
- `hasRole(t, role)` — tenant match AND `token.role == role`.
- `isTenantAdmin/isTeacher/isStudent/isParent/isStaff` — role wrappers.
- `hasActiveMembership(t)` — claim tenant match OR membership doc lookup
  (`get()` on `/userMemberships/{uid}_{t}` with `status == 'active'`).
- `hasStaffPermission(t, perm)` / `hasTeacherPermission(t, perm)` — read the
  membership doc's permission maps.
- `canAccessClass(t, classId)` — claim `classIds.hasAny([classId])` with
  overflow fallback to membership doc.
- `canAccessSpace(t)` — admin/teacher always; student only if space
  `accessType == 'tenant_wide'` OR `classIds` intersect the student's claim
  classIds.
- `isTenantActive(t)` — reads `tenants/{t}.status in ['active','trial']` for
  write defense-in-depth.

User-doc self-protection (`firestore.rules:95-116`): a user can update their own
`/users/{uid}` but rules block self-elevation of `isSuperAdmin`, self-change of
`status`, and self-modification of `consumerProfile.enrolledSpaceIds` (purchases
must go through the `purchaseSpace` Cloud Function,
`functions/levelup/src/callable/purchase-space.ts`).

`/userMemberships` is **read-own / write-never-from-client**
(`firestore.rules:119-126`): all membership writes go through Admin SDK (Cloud
Functions). Same for `/tenantCodes` and `/scanners` (`write: if false`).

### 1.6 Callable-layer authorization

- Identity functions use `assertTenantAdminOrSuperAdmin`
  (`functions/identity/src/utils/assertions.ts:34`) which checks the `/users`
  doc for SuperAdmin then the membership doc for `tenantAdmin` + `active`.
- AutoGrade functions use claim-based checks via `getCallerMembership` +
  `assertAutogradePermission` (`functions/autograde/src/utils/assertions.ts`):
  reads `token.tenantId`/`token.role`/`token.permissions`, enforces cross-tenant
  denial, and gates teacher actions by named permission, with an optional
  `allowScanner` flag for upload operations.
- Client-side callables are thin wrappers in
  `packages/shared-services/src/auth/auth-callables.ts` (e.g.
  `callCreateOrgUser`, `callSwitchActiveTenant`, `callJoinTenant`).

### 1.7 Client route guards

- Each web app has a `RequireAuth` guard (e.g.
  `apps/admin-web/src/guards/RequireAuth.tsx`) that checks `firebaseUser`,
  `currentMembership.role ∈ allowedRoles`, and
  `currentMembership.tenantId === currentTenantId`. This is UX only; real
  enforcement is in rules + callables.
- Auth state is centralized in the Zustand `useAuthStore`
  (`packages/shared-stores/src/auth-store.ts`): subscribes to
  `onAuthStateChange`, loads memberships, restores tenant context from claims,
  exposes `useUserRole`, `useCurrentTenantId`, `useIsConsumer`. A separate
  React-Query `useAuth` hook (`packages/shared-hooks/src/auth/useAuth.ts`)
  tracks only the raw Firebase user — two parallel auth state sources.

### 1.8 Realtime DB & Storage rules

- `database.rules.json` covers `practiceProgress`, `leaderboards`,
  `notifications` with claim-based tenant + uid checks (writes mostly
  server-only).
- `storage.rules` is **wide open to any authenticated user**:
  `allow read, write: if request.auth != null;` for `{allPaths=**}`. No tenant
  scoping, no per-path ownership. This is the single largest gap.

---

## 2. Entities / Schemas / Collections / APIs / Routes

### Roles (`TenantRole`, `membership.ts:9`)

`superAdmin | tenantAdmin | teacher | student | parent | scanner | staff` (Note:
`superAdmin` is a valid role enum value but in practice super-admin is expressed
as the `isSuperAdmin` boolean on `/users`, not a membership row.)

### Collections & their rule files

| Collection                                                                                              | File / rule                                   | Write path                                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| `/users/{uid}`                                                                                          | `firestore.rules:95-116`; `user.ts:43`        | Self (guarded) + CF                                 |
| `/userMemberships/{uid}_{tenantId}`                                                                     | `firestore.rules:119-126`; `membership.ts:92` | CF only                                             |
| `/tenants/{tenantId}`                                                                                   | `firestore.rules:129-144`; `tenant.ts:98`     | SuperAdmin only                                     |
| `/tenantCodes/{code}`                                                                                   | `firestore.rules:147-155`                     | CF only                                             |
| `/tenants/{t}/students,teachers,parents,classes,staff`                                                  | `firestore.rules:157-222`                     | TenantAdmin / staff-perm                            |
| `/scanners/{scannerId}` (top-level)                                                                     | `firestore.rules:225-231`                     | CF only                                             |
| `/tenants/{t}/spaces/**` (+ storyPoints/items)                                                          | `firestore.rules:262-343`                     | TenantAdmin / owning teacher                        |
| `…/items/{id}/answerKeys/**`                                                                            | `firestore.rules:314-316,339-341`             | **deny all (Admin SDK only)**                       |
| `/tenants/{t}/exams/**` (+ questions)                                                                   | `firestore.rules:350-392`                     | TenantAdmin / owning teacher                        |
| `/tenants/{t}/submissions/**` (+ questionSubmissions)                                                   | `firestore.rules:395-432`                     | Student create-own, teacher by class                |
| `/tenants/{t}/spaceProgress/**` , `/progress`, `/testSessions`, `/digitalTestSessions`, `/chatSessions` | `firestore.rules:438-544`                     | Student own-data only                               |
| `/tenants/{t}/notifications`, `/notificationPreferences`                                                | `firestore.rules:234-255`                     | Recipient read; CF create                           |
| `/tenants/{t}/academicSessions`, `/evaluationSettings`, `/llmCallLogs`, `/auditLogs`                    | `firestore.rules:550-592`                     | TenantAdmin; logs CF-only                           |
| `/tenants/platform_public/spaces`                                                                       | `firestore.rules:595-598`                     | Public store (read if `accessType=='public_store'`) |
| `/globalEvaluationPresets`                                                                              | `firestore.rules:600-604`                     | SuperAdmin write                                    |

### Claims & permission maps

- `PlatformClaims` — `claims.ts:15`.
- `TeacherPermissions` (8 booleans + `managedSpaceIds` + `managedClassIds`) —
  `membership.ts:19`, defaults `membership.ts:34`.
- `StaffPermissions` (6 booleans) — `membership.ts:48`, defaults
  `membership.ts:58`.
- `UserMembershipSchema` (Zod, `.passthrough()`) —
  `packages/shared-types/src/schemas/index.ts:584`.

### Key callable APIs (region `asia-south1`, `cors:true`)

- Identity: `createOrgUser`, `joinTenant`, `switchActiveTenant`, `saveTeacher`,
  `saveStudent`, `saveParent`, `saveStaff`, `saveClass`, `saveTenant`,
  `bulkImportStudents`, `bulkImportTeachers`, `bulkUpdateStatus`,
  `deactivateTenant`, `reactivateTenant`, `exportTenantData`, `searchUsers`,
  `rolloverSession`, `saveGlobalEvaluationPreset`, `saveAcademicSession`,
  `manageNotifications`, `uploadTenantAsset`
  (`functions/identity/src/callable/*`).
- AutoGrade auth helpers: `getCallerMembership`, `assertAutogradePermission`
  (`functions/autograde/src/utils/assertions.ts`).

---

## 3. Strengths Worth Keeping

1. **Clean three-layer identity split** (global user / membership / role
   entity). A single human can hold different roles in different tenants without
   document duplication, and B2C consumer (`consumerProfile`) coexists with B2B
   tenant memberships on the same `UnifiedUser`.
2. **Claims as a cache of the membership doc, with a doc fallback.** The
   `classIdsOverflow` + Firestore-fallback pattern (`canAccessClass`,
   `claims.ts:25-26`) is a thoughtful answer to the 1 KB JWT limit.
3. **Defense-in-depth.** Sensitive writes (memberships, tenant codes, answer
   keys, audit/LLM logs, scanners) are all `write: if false` at the rules layer
   and only mutated by Admin SDK; callables independently re-check
   authorization. Answer keys are fully invisible to clients
   (`firestore.rules:314-316`).
4. **Self-elevation hardening on `/users`** (`firestore.rules:104-113`): blocks
   `isSuperAdmin`, `status`, and `enrolledSpaceIds` tampering from the client.
5. **Tenant-status gating** baked into both rules (`isTenantActive`) and
   callables (`assertTenantAccessible` with distinct `write` vs `access` status
   sets).
6. **Cross-tenant denial is explicit** in callables (`assertions.ts:45-50`).
7. **Strong typing + Zod validation** of the membership/claims shapes shared
   across functions and apps via `@levelup/shared-types`.

---

## 4. Pain Points / Tech Debt / Inconsistencies

1. **Storage rules are effectively public-to-any-logged-in-user.**
   `storage.rules` grants `read, write` for `{allPaths=**}` to any authenticated
   user — no tenant scoping, no ownership. A student in tenant A can
   read/overwrite another tenant's answer-sheet uploads, tenant logos, exports.
   This contradicts the carefully-scoped Firestore model and is the top security
   risk.

2. **Claims/membership drift on class reassignment (silent stale access).**
   - `saveStudent` UPDATE branch reassigns `classIds` on the student + class
     docs but never updates `membership.permissions.managedClassIds` nor
     refreshes custom claims
     (`functions/identity/src/callable/save-student.ts:134-168`). A student
     moved to a new class keeps old `classIds` in their JWT and cannot see the
     new class's spaces/exams (and may still see the old one) until claims are
     refreshed by another path.
   - `saveTeacher` updates teacher `classIds` but only refreshes claims when
     `data.permissions` is also passed (`save-teacher.ts:106-168`). Updating the
     teacher's classes alone leaves `managedClassIds`/claims stale.

3. **Scanner role is half-orphaned.** `createOrgUser` writes the scanner entity
   to `tenants/{tenantId}/scanners/{id}` (`create-org-user.ts:162-168`), but the
   only scanner rule is a **top-level** `/scanners/{scannerId}` matching
   `resource.data.authUid` (`firestore.rules:225-231`). The tenant-subcollection
   scanner doc has no matching rule (default deny), and the created doc has no
   `authUid` field. The scanner read model and the create path disagree.

4. **No claims-refresh mechanism / token-revocation strategy.** Claims only
   change on the next forced `getIdToken(true)`. There is no
   `revokeRefreshTokens` call on deactivation or permission change, so a
   suspended user keeps valid claims for up to ~1 hour. `deactivateTenant`
   suspends memberships but the JWT is still trusted by rules until refresh.

5. **`isSuperAdmin()` rule does a `get()` per evaluation** instead of reading a
   claim. Every super-admin path pays an extra document read and is slower;
   super admin is also not represented as a claim, so the `superAdmin` value in
   the `TenantRole` enum is essentially dead (claims never carry
   `role:'superAdmin'`).

6. **Two parallel client auth sources of truth.** `useAuthStore`
   (`auth-store.ts`) and the React-Query `useAuth` hook
   (`packages/shared-hooks/src/auth/useAuth.ts`) both track auth independently
   and can diverge. Guards read the store; some pages read the hook.

7. **`/tenants/{t}` and `/tenantCodes/{code}` allow unauthenticated `get`**
   (`firestore.rules:133,149`) to support the pre-auth school-code lookup. This
   leaks tenant existence/branding/status by ID enumeration. `list` is
   auth-gated but `get` by guessed ID is open.

8. **Permission maps are stringly-typed in rules.** `permissions[perm]` /
   `staffPermissions[perm]` (`firestore.rules:65,77`) rely on map keys matching
   TS constants; a typo in either layer silently denies/allows. There is no
   single shared enum of permission keys enforced across rules + TS.

9. **Rules deeply nested `get()` chains.** storyPoint/item read rules each issue
   2 `get()` lookups on the parent space (`firestore.rules:283-285,300-303`),
   multiplying read cost and risking the rules `get()` budget on large reads.

10. **`hasActiveMembership` mixes claim and doc reads inconsistently.** Some
    collections gate by `hasActiveMembership` (doc fallback), most gate by raw
    `hasRole` (claim only). A user whose claims are stale but membership active
    gets inconsistent access across collections.

11. **Realtime DB rules duplicate, in JS strings, role logic that lives in
    Firestore** (`database.rules.json`), with its own copy of `auth.token.role`
    checks — a third place to keep in sync.

12. **Legacy `LevelUp-App`** carries a pre-unification `organizations` +
    `AuthContext` model (`LevelUp-App/src/contexts/AuthContext.tsx`,
    `LevelUp-App/src/types/organizations.ts`) that does not use the
    membership/claims model at all — dead/divergent auth code to retire.

---

## 5. Recommendations for the Fresh Rebuild

Keep the core concepts (unified user + per-tenant membership + claims
projection + RLS via rules) but fix the structural gaps and prepare for a common
API layer and React Native clients.

1. **Introduce a real API/BFF layer and treat rules as defense-in-depth only.**
   For RN + web parity, route all writes (and most reads of sensitive data)
   through a versioned callable/HTTPS API (or tRPC/REST gateway) that
   centralizes authorization in one shared `authorize(caller, action, resource)`
   policy module. Today authorization logic is triplicated (rules,
   identity-callable asserts, autograde asserts). Consolidate into one shared
   policy package (e.g. `@levelup/access`) imported by every function.

2. **Make `superAdmin` a claim and define a canonical permission matrix.** Put
   `isSuperAdmin`/`platformRole` in custom claims so rules check a claim (no
   `get()`), and export a single typed enum of permission keys
   (`TeacherPermissionKey`, `StaffPermissionKey`) consumed by both TS and a
   generated rules fragment. Eliminate the stringly-typed `permissions[perm]`.

3. **Fix claim/membership drift with a single claims-sync primitive.** Every
   callable that changes role, status, class membership, or permissions must
   call one `syncMembershipClaims(uid, tenantId)` helper that re-derives
   `managedClassIds` from the authoritative class/teacher/student docs and
   rewrites claims. Wire it into `saveStudent` and `saveTeacher`
   class-reassignment branches (currently missing — §4.2). Consider a Firestore
   trigger on `/userMemberships` that rebuilds claims automatically so callables
   can't forget.

4. **Lock down Storage with tenant + role + ownership scoping.** Replace the
   blanket `if request.auth != null` with per-path rules: `/{tenantId}/...`
   gated by `request.auth.token.tenantId == tenantId`, answer-sheet uploads
   writable only by the owning student or scanner, exports readable only by
   admins. Mirror the Firestore RLS model in `storage.rules`.

5. **Add token revocation on lifecycle events.** On membership suspend / tenant
   deactivate / role change, call `admin.auth().revokeRefreshTokens(uid)` and
   set rules to honor `auth.token.auth_time`. This closes the ~1h stale-claims
   window.

6. **Unify scanner under the tenant subcollection** (or fully top-level) — pick
   one. If tenant-scoped, add `/tenants/{t}/scanners/{id}` rules and store
   `authUid` + `tenantId`; if device-level, keep top-level and have
   `createOrgUser` write there. Remove the current mismatch (§4.3).

7. **Single client auth store.** Collapse `useAuth` (React-Query) and
   `useAuthStore` (Zustand) into one source of truth that also exposes a
   parsed-claims selector (`useClaims()`), so RN and web share identical auth
   state. Expose a framework-agnostic `@levelup/auth-client` so RN can reuse it.

8. **Reduce rules `get()` depth.** Denormalize `accessType` + `classIds` onto
   child docs (storyPoints/items/questions) at write time so child read rules
   don't have to re-`get()` the parent space/exam (§4.9). This also lowers read
   cost and removes the `get()`-budget risk on large list reads.

9. **Stop leaking tenant docs to unauthenticated callers.** Move the pre-auth
   school-code → tenantId resolution into a dedicated unauthenticated callable
   that returns only `{tenantId, name, status, branding}` (no full doc), and set
   `/tenants/{t}` `get` to require auth. Keep `/tenantCodes` lookup inside that
   callable.

10. **Generate rules + RTDB rules from the shared policy.** Treat
    `firestore.rules`, `database.rules.json`, and the storage rules as build
    artifacts compiled from the same `@levelup/access` policy definitions to
    keep the three (currently hand-synced) layers consistent.

11. **Add an integration test matrix per role × collection × action** (the unit
    tests in `functions/identity/src/__tests__` cover callables but not the
    rules themselves). Use the Firebase rules emulator to assert the full RLS
    matrix, including cross-tenant denial and stale-claim scenarios.

12. **Retire the legacy `LevelUp-App` auth model** (`organizations` +
    `AuthContext`) and migrate any remaining users onto the unified
    membership/claims model.
