# Platform, Auth, Roles & Infra — Rebuild Spec

> **Scope.** The non-functional foundation of the rebuilt Auto-LevelUp platform:
> authentication & session, the roles/permissions/claims authorization matrix
> (super-admin, tenant-admin, teacher, student, parent, scanner, staff), tenant
> provisioning & lifecycle, the monorepo & build tooling (pnpm + Turbo), CI/CD &
> deploy, the testing strategy (unit / integration / e2e / contract / seeding),
> and environments.
>
> **Design principle.** Keep every core concept that works today — the
> three-layer identity model (`UnifiedUser` / `UserMembership` /
> `PlatformClaims`), composite `{uid}_{tenantId}` membership keys,
> minimal-claims-with-overflow-fallback, the consolidated `save*` upsert
> pattern, defense-in-depth (Zod + rate-limit + quota + feature gates + RLS
> rules), secrets in Secret Manager, signed-URL credential delivery, the per-app
> Firebase hosting model, and the layered test pyramid. Fix the _structural_
> problems that block a single shared API layer and React Native parity:
> triplicated authorization logic, claim/membership drift, wide-open storage
> rules, hand-copied route guards, no token revocation, an island integration
> suite, and an un-runnable e2e harness.
>
> **Companion sections.** This spec depends on and references: `common-api.md`
> (the `api-contract` / `api-client` / `shared-firebase` packages and the
> `AuthContext` → service split), `domain-and-data.md` (entity model &
> migration), and `backend-services.md`. Authorization here is the _policy_
> layer; the wire contract lives in `common-api.md`.

---

## 1. Goals & Non-Goals

### Goals

1. **One authorization policy, all enforcement layers.** A single
   `@levelup/access` package is the source of truth for roles, permission keys,
   and `authorize(caller, action, resource)` decisions. Firestore/RTDB/Storage
   rules, callable asserts, and client guards all derive from it — no
   hand-synced copies.
2. **One client identity store.** A single framework-agnostic
   `@levelup/auth-client` (Zustand) is the only source of
   auth/membership/tenant/claims state, reused verbatim by web and React Native.
3. **Claims never drift.** Every role/status/class/permission change runs
   through one `syncMembershipClaims()` primitive, backed by a Firestore trigger
   so callables cannot forget.
4. **Lifecycle-safe sessions.** Token revocation on
   suspend/deactivate/role-change closes the stale-claims window; rules honor
   `auth_time`.
5. **Deterministic infra.** One package manager (pnpm), one Vitest workspace,
   one Firebase project per environment, emulator-first local dev, a runnable
   seeded e2e harness, and CI that can actually execute every gate.
6. **RN-ready foundations.** Auth, guards expressed as data, the route manifest,
   and the test seed engine all run unchanged under React Native.

### Non-Goals (this section)

- The API wire contract & SDK shape (`common-api.md`).
- The AI/LLM gateway and per-tenant key isolation internals (`ai-spec.md`) —
  referenced only where provisioning seeds a tenant Gemini key.
- Domain entity normalization and the SQL target model (`domain-and-data.md`).

---

## 2. Identity Model (keep, harden)

The three-layer identity spine is retained verbatim; it is the platform's
strongest asset.

```
 ┌─────────────────────────────┐   one per human (platform-global)
 │ /users/{uid}                │   UnifiedUser
 │  isSuperAdmin, platformRole │   activeTenantId, consumerProfile (B2C), status
 └──────────────┬──────────────┘
                │ 0..N
 ┌──────────────▼──────────────┐   one per (user, tenant) — composite key {uid}_{tenantId}
 │ /userMemberships/{uid}_{tid}│   UserMembership = SOURCE OF TRUTH for role + permissions
 │  role, status, joinSource   │   teacherId|studentId|parentId|staffId|scannerId
 │  permissions / staffPerms   │   parentLinkedStudentIds
 └──────────────┬──────────────┘
                │ projected onto JWT (cache)
 ┌──────────────▼──────────────┐   hot path read by security rules
 │ PlatformClaims (custom JWT) │   role, tenantId, tenantCode, *Id, classIds[+overflow],
 │  + NEW: platformRole,       │   studentIds, permissions, staffPermissions, authTime
 │    authTime                 │
 └─────────────────────────────┘
                │ each membership backs exactly one entity doc
 ┌─────────────────────────────┐
 │ /tenants/{tid}/{students|teachers|parents|staff|scanners}/{entityId}
 └─────────────────────────────┘
```

### 2.1 What changes vs. today

| Concern                  | Today                                                                    | Rebuild                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| superAdmin               | `users.isSuperAdmin` boolean read via rules `get()` each eval            | A real **claim** `platformRole: 'superAdmin'`; rules read the claim (no `get()`). `isSuperAdmin` stays on `/users` as the durable source that _seeds_ the claim.                                      |
| Claim permissions typing | `permissions?: Record<string,boolean>` (loses key types)                 | Typed `TeacherPermissions` / `StaffPermissions` (or a role-discriminated union) shared between TS, rules generation, and callers.                                                                     |
| Entity → Auth link       | `uid` vs `authUid` schism (`uid` written, `authUid` declared)            | **`authUid` everywhere**, on a typed `TenantEntity` base; `uid` retired.                                                                                                                              |
| Membership creation      | 3 divergent paths (`createOrgUser`, `save*` create branch, `joinTenant`) | One `provisionMembership({role, links, permissions, joinSource})` factory; every role has (or explicitly lacks) a backing entity doc. `joinTenant` students get a lazily-created `/students` profile. |
| Scanner role             | Tenant-subcollection doc + top-level rule that disagree                  | Unified under `/tenants/{tid}/scanners/{id}` with a typed shape (`authUid`, `tenantId`, `status`) and matching rules.                                                                                 |
| Claim refresh            | Missing on `saveStudent`/`saveTeacher` class reassignment                | One `syncMembershipClaims()` primitive + a `/userMemberships` write trigger.                                                                                                                          |
| Token revocation         | None (≤1h stale window)                                                  | `revokeRefreshTokens(uid)` on suspend/deactivate/role-change; rules honor `auth_time`.                                                                                                                |

### 2.2 PlatformClaims (rebuilt)

```ts
// packages/shared-types/src/identity/claims.ts
export const MAX_CLAIM_CLASS_IDS = 15; // JWT ~1KB budget guard (kept)

export interface PlatformClaims {
  platformRole?: "superAdmin"; // NEW — replaces rules get() on isSuperAdmin
  role?: TenantRole; // tenant role (active tenant)
  tenantId?: string;
  tenantCode?: string;
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;
  staffId?: string;
  classIds?: string[]; // capped at MAX_CLAIM_CLASS_IDS
  classIdsOverflow?: boolean; // rules fall back to membership doc
  studentIds?: string[]; // parent → linked children
  permissions?: TeacherPermissions; // typed, not Record<string,boolean>
  staffPermissions?: StaffPermissions; // typed
  // authTime is a Firebase-managed standard claim; rules read request.auth.token.auth_time
}
```

Claims remain a _cache_ of the membership doc. The overflow pattern
(`classIdsOverflow` → rules `get()` the membership) is kept exactly — it is the
correct answer to the JWT size limit.

---

## 3. Authentication & Session

### 3.1 Providers & account creation

- **Provider:** Firebase Authentication. Supported `AuthProvider`: `email`,
  `phone`, `google`, `apple`. Standardize on the **`authProviders: string[]`**
  array (drop the singular `authProvider` that `createOrgUser` writes today).
- **Account mirror:** Replace the Gen-1 `onUserCreated` trigger with a **Gen-2
  blocking function** `beforeUserCreated` that synchronously creates
  `/users/{uid}` (`isSuperAdmin: false`, `status: 'active'`, `authProviders`)
  and seeds baseline claims. This removes the `onUserCreated`-vs-`createOrgUser`
  user-doc race (be-identity §4.4) and lets us reject disallowed sign-ups
  synchronously.
- **Roll-number students** keep the synthetic-email scheme: `createOrgUser`
  mints `{sanitizedRollNumber}@{tenantId}.levelup.internal`; the client derives
  the identical address in `loginWithSchoolCode`. This is centralized in one
  `deriveStudentEmail(tenantId, rollNumber)` util in `@levelup/auth-client`
  shared by web + RN.

### 3.2 Login modalities (all preserved)

| Modality             | Flow                                                                                                                                         | Used by                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Email/password       | direct Firebase sign-in                                                                                                                      | admin, teacher, parent, consumer |
| Google / Apple OAuth | Firebase OAuth                                                                                                                               | consumer, optionally staff       |
| School-code (2-step) | (1) unauthenticated `resolveTenantByCode(code)` callable → `{tenantId, name, status, branding}` projection; (2) email/password within tenant | students, parents                |
| Roll-number          | school code + roll number → synthetic email + password                                                                                       | roll-number students             |

**Security fix (auth-access §4.7):** pre-auth tenant resolution moves into a
dedicated **unauthenticated `resolveTenantByCode` callable** returning only a
minimal projection. `/tenants/{t}` and `/tenantCodes/{code}` `get` then require
auth, closing the tenant-enumeration leak.

### 3.3 Session & multi-tenant context

- One tenant context lives in the JWT at a time. `switchActiveTenant(tenantId)`
  validates an active membership + accessible tenant, rebuilds claims, writes
  `users/{uid}.activeTenantId`, then the client force-refreshes the ID token
  (`getIdToken(true)`).
- **Single client store.** Collapse today's two parallel sources (`useAuthStore`
  Zustand + React-Query `useAuth`) into **one** `@levelup/auth-client` store
  exposing:
  ```ts
  interface AuthClient {
    // state
    firebaseUser, user (UnifiedUser), currentMembership, allMemberships,
    currentTenantId, claims (parsed PlatformClaims), loading, isConsumer;
    // actions
    initialize(); login(email, pwd); loginWithSchoolCode(code, ...);
    loginWithGoogle(); logout(); switchTenant(tid); refreshToken();
    // selectors
    useUserRole(); useClaims(); useCan(permission); useCurrentTenantId();
  }
  ```
  Zero DOM/router deps → reused verbatim in RN. `useCan(permission)` is the
  single client-side capability check (drives nav visibility + UX guards).

### 3.4 Token revocation (new)

On any of: membership `status → suspended/inactive`, tenant `deactivateTenant`,
or a role/permission change, the responsible service calls
`admin.auth().revokeRefreshTokens(uid)`. Security rules add an `isTokenFresh()`
helper comparing `request.auth.token.auth_time` against a per-user
`tokensValidAfter` stamp (mirrored to `/users/{uid}.tokensValidAfter`), denying
access for tokens minted before revocation. This closes the ≤1h stale-claims
window (auth-access §4.4).

---

## 4. Roles, Permissions & Claims Matrix

### 4.1 Canonical role set (unchanged)

`superAdmin | tenantAdmin | teacher | student | parent | scanner | staff`

- `superAdmin` is platform-global, expressed as `platformRole` claim (NOT a
  membership row). Delete the stale `AppRole` union in `shared-ui`; import
  `TenantRole` everywhere.
- `scanner` and `staff` are first-class tenant roles (already in `TenantRole`);
  `scanner` powers the new answer-sheet intake RN app.

### 4.2 Permission keys (one typed registry)

Define a single enum-like registry in `@levelup/access`, consumed by TS, rules
codegen, and `useCan`:

```ts
export const TEACHER_PERMISSIONS = [
  "canCreateExams",
  "canEditRubrics",
  "canManuallyGrade",
  "canViewAllExams",
  "canCreateSpaces",
  "canManageContent",
  "canViewAnalytics",
  "canConfigureAgents",
] as const; // + managedSpaceIds[], managedClassIds[] (scopes, not booleans)

export const STAFF_PERMISSIONS = [
  "canManageUsers",
  "canManageClasses",
  "canManageBilling",
  "canViewAnalytics",
  "canManageSettings",
  "canExportData",
] as const;
export type TeacherPermissionKey = (typeof TEACHER_PERMISSIONS)[number];
export type StaffPermissionKey = (typeof STAFF_PERMISSIONS)[number];
```

This kills the stringly-typed `permissions[perm]` in rules (auth-access §4.8): a
typo no longer silently mis-gates because both the rules fragment and the TS
callers are generated from this list.

### 4.3 Role → capability matrix

| Capability                                   |   super   | tenantAdmin |                      teacher                       |       student        |        parent        |       scanner       |                 staff                  |
| -------------------------------------------- | :-------: | :---------: | :------------------------------------------------: | :------------------: | :------------------: | :-----------------: | :------------------------------------: |
| Provision/deactivate tenants                 |    ✅     |      —      |                         —                          |          —           |          —           |          —          |                   —                    |
| Manage tenant settings/features/billing      |    ✅     |     ✅      |                         —                          |          —           |          —           |          —          | `canManageSettings`/`canManageBilling` |
| Create/import users (teacher/student/parent) |    ✅     |     ✅      |                         —                          |          —           |          —           |          —          |            `canManageUsers`            |
| Manage classes & sessions                    |    ✅     |     ✅      |                         —                          |          —           |          —           |          —          |           `canManageClasses`           |
| Author spaces / content                      | ✅ (read) |     ✅      | `canCreateSpaces`+`canManageContent` (own/managed) |          —           |          —           |          —          |                   —                    |
| Create exams / rubrics                       | ✅ (read) |     ✅      |         `canCreateExams`/`canEditRubrics`          |          —           |          —           |          —          |                   —                    |
| Grade submissions (AI review/override)       | ✅ (read) |     ✅      |           `canManuallyGrade` (own class)           |          —           |          —           |          —          |                   —                    |
| Upload answer sheets (intake)                |     —     |     ✅      |                         ✅                         |          —           |          —           | ✅ (`allowScanner`) |                   —                    |
| Take tests / practice / chat tutor           |     —     |      —      |                         —                          | ✅ (own class scope) |          —           |          —          |                   —                    |
| View child progress/results (released)       |     —     |  ✅ (read)  |                         —                          |          —           | ✅ (linked children) |          —          |                   —                    |
| View analytics                               |    ✅     |     ✅      |                 `canViewAnalytics`                 |         own          |     own children     |          —          |           `canViewAnalytics`           |
| Export tenant data                           |    ✅     |     ✅      |                         —                          |          —           |          —           |          —          |            `canExportData`             |
| Configure AI agents                          |    ✅     |     ✅      |                `canConfigureAgents`                |          —           |          —           |          —          |                   —                    |

Scope qualifiers (`own class`, `managed`, `linked children`) are enforced via
`classIds`/`studentIds` claims with overflow fallback.

### 4.4 Claims projection per role

| Role        | Claims set by `buildClaimsForMembership`                                         |
| ----------- | -------------------------------------------------------------------------------- |
| superAdmin  | `platformRole: 'superAdmin'` (+ optional tenant context if also a member)        |
| tenantAdmin | `role, tenantId, tenantCode`                                                     |
| teacher     | + `teacherId, classIds(=managedClassIds, capped), classIdsOverflow, permissions` |
| student     | + `studentId, classIds, classIdsOverflow`                                        |
| parent      | + `parentId, studentIds`                                                         |
| scanner     | + `scannerId`                                                                    |
| staff       | + `staffId, staffPermissions`                                                    |

### 4.5 The single authorization seam

All authorization decisions funnel through one module so the three
currently-divergent layers (rules, identity asserts, autograde asserts)
converge:

```ts
// packages/access/src/authorize.ts
type Action = 'space.write' | 'exam.grade' | 'submission.upload'
            | 'user.create' | 'tenant.deactivate' | /* ... */ ;
function authorize(caller: AuthContext, action: Action, resource: ResourceRef):
  AuthDecision;   // { allow: boolean; reason?: AppErrorCode }
```

- **Callables** call `authorize(ctx, action, ref)` (replaces the per-module
  `assertTenantAdminOrSuperAdmin` / `assertAutogradePermission` copies).
- **Firestore/RTDB/Storage rules** are _generated_ from the same policy
  definitions as build artifacts (auth-access §5.10) so they cannot drift.
- **Client `useCan()`** evaluates the read-side subset for UX only (never
  trusted).

`AuthContext` (shared with `common-api.md`):

```ts
interface AuthContext {
  uid: string;
  platformRole?: "superAdmin";
  tenantId?: string;
  role?: TenantRole;
  claims: PlatformClaims;
  permissions?: TeacherPermissions;
  staffPermissions?: StaffPermissions;
}
```

### 4.6 Row-level security (RLS) rules — improvements (keep defense-in-depth)

Rules remain enforced (defense-in-depth) but improved:

1. **Generated, not hand-written.** `firestore.rules`, `database.rules.json`,
   `storage.rules` compiled from `@levelup/access`.
2. **Storage lockdown (top security fix, auth-access §4.1).** Replace blanket
   `if request.auth != null` with per-path tenant + role + ownership scoping:
   ```
   match /tenants/{tid}/answerSheets/{sid}/{file=**} {
     allow read:  if belongsToTenant(tid) && (isTeacher(tid) || isTenantAdmin(tid));
     allow write: if belongsToTenant(tid) && (hasRole(tid,'scanner') || isOwningStudent(tid, sid));
   }
   match /tenants/{tid}/exports/{file=**} {
     allow read: if isTenantAdmin(tid) || isSuperAdmin();   // admin-only
   }
   match /tenants/{tid}/branding/{file=**} {
     allow read: if true;                                   // public logos
     allow write: if isTenantAdmin(tid);
   }
   ```
3. **Denormalize to cut `get()` chains (auth-access §4.9).** Write
   `accessType` + `classIds` onto `storyPoints`/`items`/`questions` at save time
   so child read rules don't re-`get()` the parent space/exam. Removes the rules
   `get()`-budget risk on large list reads.
4. **`superAdmin` via claim** removes the per-eval `get()` on `/users`.
5. **Token freshness:** `isTokenFresh()` honored on sensitive collections.

---

## 5. Tenant Provisioning & Lifecycle

### 5.1 Provisioning (`saveTenant`, create branch — superAdmin only)

Transactional and idempotent, keeping today's strengths and fixing the collision
bug:

```
saveTenant(create):
  1. resolve unique tenantCode:
       base = slug(shortName||name) uppercased alnum ≤12
       if /tenantCodes/{base} exists → append -2, -3 ... (NEW: auto-suffix, no throw)
  2. TRANSACTION:
       create /tenants/{tid}            (Tenant: subscription, features(defaults from
                                          ONE registry), settings, stats, usage,
                                          branding, onboarding{completed:false}, status:'trial')
       create /tenantCodes/{CODE}       (uniqueness index, TenantCodeIndex)
       create /userMemberships/{creator}_{tid}  (role tenantAdmin, status active)
  3. setCustomUserClaims(creator)       (via syncMembershipClaims)
  4. store tenant Gemini key in Secret Manager (tenant-{tid}-gemini)
  5. logTenantAction + writePlatformActivity (best-effort)
```

- **Default features** come from one canonical `DEFAULT_TENANT_FEATURES`
  registry in `@levelup/access`/`shared-types`, consumed by `saveTenant`, the
  super-admin feature-flags UI, and settings (kills the 3-divergent-copies
  problem flagged in be-super-admin).
- **Idempotency key** required on the create call so a retried provision does
  not duplicate tenant/code/memberships (be-identity §4.13).

### 5.2 Org-user creation (`createOrgUser`) & membership factory

```
createOrgUser:
  1. authorize(ctx, 'user.create', {tenantId})
  2. provisionMembership():
       create Auth user (or reuse by email)        ← idempotency key
       create /tenants/{tid}/{role-collection}/{id} (TenantEntity base: authUid, tenantId, status)
       create /userMemberships/{uid}_{tid}          (one factory, identical shape)
       syncMembershipClaims(uid, tid)
       adjustTenantCounters(+1)                      ← ONE counter helper (see §5.4)
  3. compensating rollback (deleteUser) on partial failure
```

`joinTenant` and the `save*` create branches call the **same**
`provisionMembership` factory — no divergent shapes (be-identity §4.3).
Self-join (`joinTenant` by code) defaults to `student` and lazily creates a
`/students` profile.

### 5.3 Claim sync primitive (fixes drift — auth-access §4.2)

```ts
// called by saveStudent/saveTeacher/saveStaff (incl. class-reassignment branches),
// switchActiveTenant, createOrgUser, joinTenant, bulkImport*, role/status changes
async function syncMembershipClaims(uid: string, tenantId: string) {
  const m = await getMembership(uid, tenantId);
  const claims = buildClaimsForMembership(m); // re-derives managedClassIds from authoritative docs
  await admin.auth().setCustomUserClaims(uid, claims);
}
```

Backed by a **Firestore trigger on `/userMemberships/{id}`** that re-syncs
claims on every write, so a callable that forgets to call it cannot leave claims
stale. (Trigger is the safety net; callables still call it for immediate
consistency.)

### 5.4 Counters (unify — be-identity §4.6)

Collapse the two drifting systems (`stats.total*` and `usage.current*`) behind
one `adjustTenantCounters(tid, delta)` helper called from **every**
create/delete/join/leave path including `joinTenant` and deletion triggers. A
scheduled `reconcileTenantCounters` job recomputes from authoritative counts
nightly as a backstop.

### 5.5 Lifecycle

- **Trial → expired:** `tenantLifecycleCheck` (daily).
- **Monthly usage reset:** `monthlyUsageReset`.
- **Deactivate/reactivate:** `deactivateTenant` sets status
  `suspended`/`expired`, the `onTenantDeactivated` trigger suspends all active
  memberships, **and `revokeRefreshTokens` is called for each affected uid**
  (new — closes the trusted-JWT window). `reactivateTenant` restores
  memberships + re-syncs claims.
- **Export:** `exportTenantData` writes to Storage `exports/{tid}/...`, delivers
  a short-lived signed URL, cleaned by `cleanupExpiredExports`. CSV header bug
  fixed (union of all keys, be-identity §4.12).
- **Audit:** single collection name `/tenants/{tid}/auditLogs` (fix the
  `auditLog` singular drift, be-identity §4.2) + `/platformActivityLog`.

---

## 6. Routing, Guards & App Shell (foundation)

(Full route inventories live in `webapps-design.md`; here is the
auth/guard/shell foundation.)

### 6.1 One config-driven route guard (delete the 5 copies)

```ts
// packages/shared-routing/RequireAuth.tsx (web) + RN equivalent
<RequireAuth
  allow={['teacher','tenantAdmin']}        // TenantRole[]
  requireTenantMatch                       // admin's stricter check, opt-in everywhere
  requireSuperAdminClaim={false}           // super-admin app sets true (verifies live claim)
  onConsumerRedirect="/consumer"           // student-web B2B/B2C split
  gates={[onboardingGate]}                 // composable predicate array (replaces inline OnboardingGuard)
  fallback={<PageLoader/>}
/>
```

All apps get the strongest behavior (tenant-match + claim verification) by
opt-in flags. Encodes super-admin's dual check (`users.isSuperAdmin` AND live
`platformRole` claim) as a flag.

### 6.2 Typed route manifest (per app)

```ts
type RouteDef = { path; lazyImport; allow?: TenantRole[]; gates?; navMeta? };
```

The `<Routes>` tree, sidebar `NavGroup[]`, prefetch map, and `isActive` are all
_derived_ from this one manifest — eliminating the three-way stringly-typed
duplication. Web renders via `react-router-dom`; RN renders the same manifest
via `react-navigation` (the injectable `LinkComponent` pattern already proves
feasibility).

### 6.3 Single `<PlatformLayout config={...}>`

Promote chrome into one shared layout taking
`{appName, navGroups, headerRight, features:{breadcrumbs, branding, roleSwitcher, offlineBanner, pwaBanner}}`.
Each app shrinks from ~250-line `AppLayout.tsx` to a config object. `AuthLayout`
and `ConsumerLayout` become shared components.

---

## 7. Monorepo & Build Tooling

### 7.1 Workspace topology (pnpm + Turbo, cleaned)

- **Single source of truth:** `pnpm-workspace.yaml` covering `apps/*`,
  `packages/*`, `functions/*`, `scripts`, `website`, `tests/*`. **Delete the
  vestigial npm `workspaces` field** from root `package.json` (testing-infra §4:
  it omits `scripts`/`website` and conflicts).
- Package manager pinned `pnpm@9+`, Node `>=20`.
- **New packages** (from `common-api.md` + this spec): `packages/api-contract`,
  `packages/api-client`, `packages/shared-firebase`, `packages/access`,
  `packages/auth-client`, `packages/shared-routing`, `packages/seed`.
- **Retire legacy trees:** move `LevelUp-App/` and `autograde/` out of the
  active workspace (archive or fold into the platform). There must be exactly
  **one canonical `firebase.json`** and one build/test graph (testing-infra
  §4.14, routing §4.9).

### 7.2 Turbo task graph

```jsonc
// turbo.json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", "lib/**"] },
    "dev": { "persistent": true, "cache": false },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "test:contract": { "dependsOn": ["^build"] },
    "deploy": { "dependsOn": ["build"] },
  },
}
```

### 7.3 Functions deploy resolution

Keep the 4-codebase split (`identity`, `levelup`, `autograde`, `analytics`) for
small blast radius. **Replace** the `prepare-functions-deploy.ts` `.local-deps`
rewrite dance with a bundler (**esbuild/tsup**) that inlines `workspace:*` deps
at build time — removing the fragile `package.json.bak` / `.local-deps` cleanup
(testing-infra §5.7). If the script is retained interim, wrap cleanup in
`trap`/`finally`.

### 7.4 Build hygiene

- **Stop committing** `functions/*/lib` and any `dist` — add to `.gitignore`,
  build in CI/predeploy only (testing-infra §4.7).
- **Remove & rotate** the committed Firebase Admin service-account JSON at repo
  root; use Workload Identity Federation / CI secrets (testing-infra §4.12).

---

## 8. CI/CD & Deploy

### 8.1 Pipeline (`.github/workflows/ci.yml`)

Fast required PR gate vs. expensive nightly:

```
PR (required, fast):  lint → typecheck → build → unit → integration(emulator) → contract
Nightly / label-gated: e2e (Playwright) → visual-regression → lighthouse
Deploy (push main):   deploy-functions → deploy-hosting   (preview channels on PR)
```

| Job           | What                                                                                                                                                                                                 | Gate          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `lint`        | eslint + prettier --check                                                                                                                                                                            | required      |
| `typecheck`   | turbo typecheck                                                                                                                                                                                      | required      |
| `build`       | turbo build; upload `*/dist` artifacts                                                                                                                                                               | required      |
| `unit`        | Vitest workspace, coverage → Codecov; **`json-summary` reporter** so Vitest built-in `thresholds` fail fast (drop the fragile `bc` bash gate, testing-infra §4.9)                                    | required      |
| `integration` | `firebase emulators:exec --only auth,firestore,functions --project demo-levelup` → seed → run; **same project id everywhere** (fix the `lvlup-ff6fa` vs `demo-levelup` mismatch, testing-infra §4.2) | required      |
| `contract`    | request+response Zod validation per callable against emulator (replaces the single thin `callable-schemas.test.ts`)                                                                                  | required      |
| `e2e`         | Playwright with a real `webServer` that boots emulators + seeds + starts all apps                                                                                                                    | nightly/label |
| `lighthouse`  | ports aligned to canonical 4567–4571, warn-only                                                                                                                                                      | nightly       |

### 8.2 Deploy (`deploy.yml`)

- `deploy-functions`: build (bundled) → `firebase deploy --only functions`.
- `deploy-hosting`: `firebase deploy --only hosting` (6 targets — 5 apps +
  website).
- `preview-deploy`: PR hosting preview channels (7d).
- **Generate `firebase.json` hosting + `.firebaserc` targets from one app
  registry** so apps/ports/sites never drift (routing §5.10).
- Auth: Workload Identity Federation (not a long-lived `FIREBASE_TOKEN` if
  avoidable).

---

## 9. Testing Strategy

Keep the layered pyramid; make every layer runnable and add the missing layers.

```
        ▲  e2e (Playwright, nightly)            durable per-role + cross-role regression
        │  visual regression / lighthouse       (delete the *-cycle-N evolution specs)
        │  ─────────────────────────────────
        │  contract tests (per callable)        req+res Zod vs emulator — DURABLE backend gate
        │  integration (emulator)               security-rules matrix + pipeline flows
        │  ─────────────────────────────────
        │  unit (Vitest)                         services (in-memory repo fakes) + frontend (RTL/jsdom)
        ▼
```

### 9.1 Unit

- **Backend:** extract DB access behind a thin repository interface in
  `functions/shared`; unit-test business services against in-memory fakes —
  **eliminate the 30+ hand-rolled `firebase-admin` mocks** (testing-infra
  §4.10). Reserve real SDK behavior for emulator integration.
- **Frontend (new — currently zero):** Vitest + React Testing Library (jsdom)
  for `@levelup/auth-client`, `shared-hooks`, `shared-routing` guards,
  `shared-ui` primitives, and critical app components. Target 60–70% on shared
  packages.
- One **Vitest workspace `projects`** config + one base for shared thresholds
  (replace deprecated `defineWorkspace` + scattered per-package configs).

### 9.2 Integration (emulator) — fold into the workspace

- **Drop the private npm lockfile**; bring `tests/integration` into the pnpm
  graph (kills version drift, testing-infra §4.3).
- One Firebase project id (`demo-levelup`) in both `setup.ts` and CI.
- **Keep the security-rules suites** (`role-access`, `tenant-isolation`,
  `write-validation`) — the crown jewel. **Expand to a full role × collection ×
  action matrix** including cross-tenant denial and **stale-claim /
  post-revocation** cases (auth-access §5.11).

### 9.3 Contract (new durable gate)

For every callable in `api-contract`'s registry: validate a representative
request and the live response shape against the Zod schema, run under the
emulator. This is the testable seam that protects web ↔ RN ↔ functions from
drift.

### 9.4 E2E

- **Add a `webServer`** (or orchestration script) so `pnpm test:e2e` boots
  emulators, seeds, and starts all apps deterministically — locally and in CI
  (today the CI e2e job is dead weight, testing-infra §4.1).
- **Delete/archive** the `*-cycle-N` evolution specs/configs/JSON; split the
  150KB monolith specs by feature. Keep a lean per-role + cross-role regression
  suite.
- **Re-enable parallelism** via per-suite idempotent seeded tenants (generalize
  `autograde-seed.ts`); cap per-test timeout to ~90s.
- Standardize `data-testid` selectors and structure helpers as a
  transport-agnostic page-object layer so future RN suites (Detox/Maestro) reuse
  seed + auth helpers + the typed API client.

### 9.5 Seeding (`packages/seed`)

Promote the config-driven pattern (`scripts/seed-configs/`) into a first-class
engine: declarative tenant/class/space/exam configs + a
`BatchWriter`/`ensureAuthUser` core that **builds correct custom claims with
`MAX_CLAIM_CLASS_IDS` overflow** (the existing logic is reusable). Idempotent,
**one code path env-switched** between emulator and prod. Consolidate the ~15
ad-hoc `seed-*/fix-*/migrate-*` scripts into **versioned named migrations** with
a small runner.

---

## 10. Environments

| Env            | Firebase project                                                                        | Data                       | Auth               | Used for                                |
| -------------- | --------------------------------------------------------------------------------------- | -------------------------- | ------------------ | --------------------------------------- |
| **local**      | `demo-levelup` (emulators: auth 9099, firestore 8080, functions 5001, db 9000, UI 4000) | seeded via `packages/seed` | emulator           | dev + integration + e2e                 |
| **staging**    | `lvlup-staging` (new)                                                                   | seeded staging tenants     | real Firebase Auth | QA, preview channels, RN device testing |
| **production** | `lvlup-ff6fa`                                                                           | live                       | real               | production                              |

- **Local dev is emulator-first.** Fix `start.sh` to **default to emulators**
  with an explicit `--prod` opt-in (today it points dev at _production_ Firebase
  — risky, routing §4.10). Single package manager (pnpm) across all apps.
- **Ports from one shared config** consumed by both `vite.config.ts` and the
  launcher (no drift). Prefer Turbo/pnpm tasks over the bespoke bash PID
  launcher.
- **Region:** `asia-south1` for all functions, centralized in one config module
  (with `MAX_CLAIM_CLASS_IDS`, rate-limit ceilings, quota defaults, default
  features) shared by functions and any future REST gateway (be-identity §5.10).
- Per-env `.env` (no secrets in repo); secrets in Secret Manager / CI secret
  store.

---

## 11. Migration Notes (from current code)

1. **Claims:** add `platformRole` claim; backfill all super-admins
   (`users.isSuperAdmin === true` → set claim). Update rules `isSuperAdmin()` to
   read the claim. Migrate `permissions` claim from `Record<string,boolean>` to
   typed shape (shape is identical at runtime — type-only change + regenerate
   rules).
2. **Entity link field:** one-time migration `uid → authUid` across
   `/tenants/{t}/{students,teachers,parents,staff,scanners}`; drop `uid`. Add
   `TenantEntity` base.
3. **Claim sync:** introduce `syncMembershipClaims` + the `/userMemberships`
   trigger; backfill by re-running it for all active memberships (also
   self-heals the `saveStudent`/`saveTeacher` reassignment drift).
4. **Storage rules:** deploy the scoped `storage.rules` (§4.6) — audit existing
   Storage paths first and migrate any cross-tenant files into
   `tenants/{tid}/...` layout before flipping rules to deny.
5. **Token revocation:** add `tokensValidAfter` to `/users`; wire
   `revokeRefreshTokens` into deactivate/suspend/role-change; add
   `isTokenFresh()` to rules (deploy rules + functions together).
6. **Scanner unification:** migrate any top-level `/scanners/{id}` docs into
   `/tenants/{tid}/scanners/{id}` with `authUid`; deploy matching rules; delete
   the orphan top-level rule.
7. **Counters:** run `reconcileTenantCounters` once to true-up drifted
   `stats`/`usage`; route all future mutations through `adjustTenantCounters`.
8. **Auth trigger:** migrate `onUserCreated`/`onUserDeleted` (Gen 1) to Gen-2
   blocking functions; standardize on `authProviders` array; migrate any
   `authProvider` singular fields.
9. **Tenant code:** add auto-suffix collision handling (no behavior change for
   existing unique codes).
10. **Infra cleanup:** gitignore + delete tracked `functions/*/lib`; rotate &
    remove the committed service-account JSON; delete the npm `workspaces`
    field; create the `lvlup-staging` project; unify integration project id to
    `demo-levelup`.
11. **Guards/routing:** replace the 5 `RequireAuth.tsx` copies with the shared
    config-driven guard; introduce per-app route manifests; collapse `useAuth` +
    `useAuthStore` into `@levelup/auth-client`.
12. **Legacy retirement:** archive `LevelUp-App/` and decide `autograde/`'s fate
    (fold into platform or formally separate) — remove from the active
    workspace.

```

```
