# Core B2B Domain — Scope Analysis Brief

**Vertical:** Multi-tenant identity & org backbone (the layer everything else
sits on) **Scope:** Read-only analysis. No code was modified. **Author:** Worker
session `sess_1783164263750_edrjq5wg5` · Task `task_1783164228572_mqousc7ts`
**Date:** 2026-07-04

---

## 0. TL;DR

The platform is a **multi-tenant B2B education SaaS**. One Firebase project
hosts many _tenants_ (schools/academies). Everything a tenant owns lives
**path-prefixed under `/tenants/{tenantId}/…`** in Firestore, so isolation is
structural, not just field-filtered.

Identity has **three layers**:

1. **Domain (`@levelup/domain`)** — the Zod schemas + the `ROLE_DESCRIPTORS`
   SSOT that defines the 7 roles and derives everything (the role enum, ranks,
   per-role id fields, repo keys).
2. **Access (`@levelup/access`)** — the _one_ server-side authority decision,
   `authorize(ctx, action, resource)`, backed by the declarative `ACCESS_RULES`
   table.
3. **Backend (`functions/identity`)** — 23 callables + 6 triggers + 2 schedulers
   that provision tenants/users, mint custom claims, and maintain denormalized
   counters.

**Authz = custom claims (hot path, in the JWT) + `ACCESS_RULES` (server
callables) + `firestore.rules` (direct client reads).** The two known open items
are both **claim/permission convergence** problems (RR-T2-A and RR-T2-B),
detailed in §6.

---

## 1. The Tenant / Org Model

```
Tenant  (a school/academy — /tenants/{tenantId})
  ├── AcademicSession   (a term/year — /tenants/{id}/academicSessions/{sid})   isCurrent flag
  ├── Class             (grade+section — /tenants/{id}/classes/{cid})
  │      teacherIds[]  studentIds[]  studentCount   (denorm, trigger-maintained)
  ├── Students / Teachers / Parents / Staff / Scanners  (role entity docs, one subcollection each)
  └── (content: spaces, exams, submissions, progress, …)   ← other verticals

User    (a human — /users/{uid})           global, cross-tenant
  └── UserMembership  (/userMemberships/{uid}_{tenantId})   ← the join row: user × tenant × role
```

**The key relationships, plainly:**

- A **Tenant** is the top-level org. It carries `subscription` (plan + quotas:
  maxStudents/maxTeachers/ maxExamsPerMonth/maxAiCallsPerMonth), `features`
  (autograde/levelup/analytics/store toggles), `settings`
  (timezone/locale/**`geminiKeyRef`** — a Secret Manager _reference_, never the
  key value), `stats` + `usage` (trigger-maintained counters), `branding`,
  `onboarding`, and `deactivation`. Status ∈
  `active | suspended | trial | expired | deactivated`. Plan ∈
  `free | trial | basic | premium | enterprise`.
  (`packages/domain/src/entities/identity/tenant.ts`)

- A **User** (`UnifiedUser`, `/users/{uid}`) is the global human identity — one
  per Firebase Auth user, spanning all tenants they belong to. Carries
  `isSuperAdmin`, `activeTenantId`, and an optional B2C `consumerProfile`
  (enrolled/purchased spaces). Created by the `onUserCreated` auth trigger.

- A **UserMembership** (`/userMemberships/{uid}_{tenantId}`) is **the pivot of
  the whole model** — the join row binding _one user_ to _one tenant_ with _one
  role_. It holds `role`, `status` (`active|inactive|suspended`), `joinSource`,
  the per-role id (`studentId`/`teacherId`/…), the granular `permissions`
  (teacher) / `staffPermissions` (staff), and `parentLinkedStudentIds`.
  **Admin-SDK write only** — clients can never forge one. This doc is the source
  that custom claims are minted _from_.

- **Role entity docs** (Student/Teacher/Parent/Staff/Scanner, one subcollection
  per role under the tenant) hold the _business_ profile (name, roll number,
  classIds, subjects, etc.). They carry an optional `authUid` back-reference to
  the Auth user. `studentIds`/`studentCount`/`classIds` denorm arrays on
  Class/Student/Parent are **projections maintained by triggers**, not source of
  truth.

- A user can belong to **many tenants** (many membership rows) but has exactly
  **one active tenant** at a time (`user.activeTenantId` + the claims currently
  minted into their JWT). Switching = re-minting claims.

---

## 2. Roles, Claims & Permissions — how authz works

### 2.1 The 7 roles (the SSOT)

`ROLE_DESCRIPTORS` in `packages/domain/src/entities/identity/role-registry.ts`
is **the single source of truth**. One entry per role carries `rank`, `idField`,
branded `idBrand`, `repoKey`, `scope`, `provisionable`, `authoring`,
`permissionSet`. **Everything else derives from it** — the `TENANT_ROLES` enum,
`ROLE_RANK`, the `EntityIds` shape, the repo/id-field lookups, and the per-role
id Zod fields that appear on `PlatformClaimsSchema` / `UserMembershipSchema`
(via `roleIdFields`).

| role        | rank | idField   | repoKey  | scope    | provisionable | authoring | permissionSet |
| ----------- | ---- | --------- | -------- | -------- | ------------- | --------- | ------------- |
| superAdmin  | 6    | —         | —        | platform | no            | no        | —             |
| tenantAdmin | 5    | —         | —        | tenant   | no            | yes       | —             |
| staff       | 4    | staffId   | staff    | tenant   | yes           | yes       | staff         |
| teacher     | 3    | teacherId | teachers | tenant   | yes           | yes       | teacher       |
| scanner     | 2    | scannerId | scanners | tenant   | yes           | no        | —             |
| parent      | 1    | parentId  | parents  | tenant   | yes           | no        | —             |
| student     | 0    | studentId | students | tenant   | yes           | no        | —             |

> Note: the task framed this as "6 roles" — there are in fact **7** (scanner is
> the QR/answer-sheet upload device actor). `superAdmin` is **platform-scoped**;
> all others are tenant-scoped. Rank drives `isStaffOrAbove` (≥ staff) and
> `isTeacherOrAbove` (≥ teacher). Adding a role = 1 descriptor append + 1
> branded-id line + N _intentional, manual_ `ACCESS_RULES` lines (kept manual on
> purpose — it's a security decision).

### 2.2 Custom claims — the hot path (`PlatformClaims`)

`PlatformClaimsSchema` (`.../identity/claims.ts`) is the JWT projection minted
server-side and read on every request. Fields: `role`, `tenantId`, `tenantCode`,
per-role ids (derived from `roleIdFields`), `classIds` (+ `classIdsOverflow`),
`studentIds`, `permissions` (teacher map), `staffPermissions`, `isSuperAdmin`.
**`classIds` is capped at `MAX_CLAIM_CLASS_IDS = 15`** — beyond that,
`classIdsOverflow=true` is set and consumers fall back to reading the full list
from Firestore (the JWT has a size ceiling). _(Verified: 15 across domain,
shared-types, and seed — one earlier draft misreported 64.)_

### 2.3 Three enforcement surfaces

1. **`authorize()` — the ONE server decision**
   (`packages/access/src/policy.ts`). Every backend callable funnels through it.
   It throws `AccessError('PERMISSION_DENIED')` on deny, returns void on allow.
   Decision order (8 gates):
   1. **impersonation guard** — an impersonated session can never re-impersonate
      or `claims.sync`.
   2. **public** actions — always allowed.
   3. **real-super-admin bypass** — a _genuine_ super-admin (`isSuperAdmin`, not
      `<system>`, not impersonating) short-circuits role/permission gates — but
      **still honors an explicit cross-tenant resource mismatch**.
   4. **authentication** — non-public needs a uid.
   5. **tenant scope** — if the resource carries a `tenantId`, it must equal
      `ctx.tenantId`. _This is what stops a `<system>` trigger actor
      (super-admin-equivalent, but tenant-scoped) from acting cross-tenant._
   6. **role gate** — `ctx.role ∈ rule.roles`.
   7. **permission / staffPermission gate** — granular teacher/staff flags.
      **Lenient by design**: a permission is treated as GRANTED unless the
      caller carries the map AND it explicitly maps the key to `false`.
      Permissions only _demote_; the role gate is primary authority.
   8. **ownership gate** — `self` / `class-member` / `linked-child` /
      `space-enrolled`.

   The `ACCESS_RULES` table (`Record<Action, AccessRule>`) is **data,
   unit-tested for completeness against the `Action` union** (61 actions). Rule
   shape:
   `{ roles, permission?, staffPermission?, tenantScoped, ownershipCheck?, superAdminBypass? }`.
   `roles` may be a concrete list or a wildcard (`public` / `any-authed` /
   `super-admin-only`).

2. **`firestore.rules`** (618 lines) — governs **direct client reads/writes**
   that bypass callables. It reads the same claims
   (`request.auth.token.role/tenantId/classIds/studentIds/…`) via helpers
   `isSignedIn()`, `isSuperAdmin()`, `belongsToTenant()`, `hasRole()`,
   `isTenantActive()`, `getMembership()`, `hasStaffPermission()`,
   `hasTeacherPermission()`, `canAccessClass()`, `canAccessSpace()`.
   Default-deny; sensitive writes (memberships, notifications create, chat
   messages, answer keys, audit logs) are **Admin-SDK-only**.

3. **The granular permission maps** — `TEACHER_PERMISSION_KEYS` (8) and
   `STAFF_PERMISSION_KEYS` (6) in `packages/domain/src/enums/permissions.ts`.
   These are the _canonical_ key vocabularies that both `ACCESS_RULES` and the
   claims schema reference.

**The crux / SSOT:** two canonical lists own everything — `ROLE_DESCRIPTORS`
(what a role _is_) and the permission-key enums (what a role _may do_).
`ACCESS_RULES` is the manual, security-reviewed table that maps every action to
a role/permission gate. That's the whole authz model in three files.

---

## 3. Lifecycle Flows (backend — `functions/identity`)

All write callables funnel through `assertTenantAdminOrSuperAdmin` /
`assertTenantAccessible` (writes need tenant `status=active`; access allows
`active|trial`), plus quota + feature gates + rate limiting.

- **Provision a tenant** — `saveTenant` (CREATE = **super-admin only**; UPDATE =
  tenantAdmin/superAdmin, privileged fields super-admin only). Creates the
  tenant doc, the `tenantCodes/{code}` lookup, the owner's initial `tenantAdmin`
  UserMembership, stashes the Gemini key in Secret Manager, and mints the
  owner's claims.

- **Onboard users** — `createOrgUser` (tenantAdmin/superAdmin): one flow creates
  the Firebase Auth user + the role entity doc + the UserMembership + claims,
  checks subscription quota, bumps `tenant.stats`. Per-role saves
  (`saveStudent/saveTeacher/saveParent/saveStaff`) are consolidated
  create/update endpoints that also reconcile `classIds` ↔ class rosters,
  parent↔child links, and re-mint claims when class/permission changes affect
  the JWT. (These absorbed the old `assignStudentToClass` /
  `assignTeacherToClass` / `linkParentToStudent` / `updateTeacherPermissions`
  callables.)

- **Self-service join** — `joinTenant` (any authed user + a tenant code):
  creates/re-activates a `student`-role membership (`joinSource="tenant_code"`),
  mints claims, sets `activeTenantId` if unset. Admin can later elevate the
  role.

- **Switch tenant** — `switchActiveTenant`: validates an _active_ membership in
  the target tenant, **rebuilds claims from that membership**
  (`buildClaimsForMembership`), overwrites the global custom claims, and updates
  `user.activeTenantId`. Because claims are global to the Auth user, switching
  is a full claim re-mint — this is the multi-tenant pivot point.

- **Bulk import** — `bulkImportStudents` (≤500 rows) / `bulkImportTeachers`
  (≤200 rows): dry-run validation, batched Auth-user creation,
  entity+membership+claims per row, roster + stats updates, parent auto-linking
  (students), and a **credentials CSV written to Cloud Storage behind a
  short-lived signed URL** (never returned inline). Feature-gated + quota-gated;
  540s/1GiB. `bulkUpdateStatus` batch-flips active/archived on
  students/teachers/classes.

- **Academic rollover** — `saveAcademicSession` (create/update; auto-unsets
  `isCurrent` on siblings) and `rolloverSession` (clones classes into a new
  session, optionally promotes students + copies teacher assignments;
  540s/1GiB). `session.rollover` is gated to `tenantAdmin | staff`.

- **Deactivate / reactivate** — `deactivateTenant` / `reactivateTenant`
  (**super-admin only**): flip tenant status and cascade-suspend/restore all
  memberships. Data is preserved for reactivation.

- **Other** — `exportTenantData` (JSON/CSV to signed URL, 1h),
  `uploadTenantAsset` (signed branding-upload URL),
  `saveAnnouncement`/`listAnnouncements` (platform scope=super-admin, tenant
  scope=tenantAdmin), `searchUsers` (**super-admin only**, global),
  `manageNotifications`, `saveGlobalEvaluationPreset` (super-admin only).

**Triggers (`triggers/`):**

- `onUserCreated` — mints `/users/{uid}` on Auth signup.
- `onUserDeleted` — soft-deletes user, deactivates memberships, decrements
  stats.
- `onStudentArchived` / `onClassArchived` — **denorm cleanup** (pull ids from
  parents/classes/students/teachers).
- `onTenantDeactivated` — suspends active memberships when a tenant goes
  suspended/expired.
- `cleanupExpiredExports` — 30-min sweep of expired signed-URL storage files.

**Schedulers (`scheduled/`):**

- `tenantLifecycleCheck` — **daily 00:00 UTC**: expires past-due trials, flags
  long-idle tenants.
- `monthlyUsageReset` — **1st of month 00:00 UTC**: zeroes
  `usage.examsThisMonth` / `usage.aiCallsThisMonth`.

---

## 4. Multi-Tenant Isolation in Firestore

**Model: hierarchical path-prefixing under `/tenants/{tenantId}/…`** — isolation
is structural. A document's tenant is encoded in its _path_, and
`firestore.rules` require `request.auth.token.tenantId == {tenantId}` (via
`belongsToTenant()`) for tenant-scoped reads.

- **Top-level (cross-tenant / pre-auth) collections:** `/users`,
  `/userMemberships`, `/tenants`, `/tenantCodes`, `/scanners`,
  `/globalEvaluationPresets`, `/tenants/platform_public/spaces` (consumer
  store).
- **Tenant-scoped subcollections:** everything else (students, teachers,
  parents, staff, classes, academicSessions,
  spaces/exams/submissions/progress/notifications/auditLogs/…).

**Isolation guarantees & patterns:**

- **Claim-based scoping** — the JWT `tenantId` claim must match the path; the
  active tenant is single-valued.
- **`tenantCodes` / `tenants` GET is open pre-auth** (login/join needs to
  resolve a school by code) but **LIST is auth-only** (anti-enumeration), and
  **writes are super-admin / Admin-SDK only**.
- **`userMemberships` is Admin-SDK-write-only** — the trust root; forging one
  would forge a role. Reads are self or super-admin.
- **Self-access & parent→child** — users read their own docs; parents read
  linked children via `studentIds` in the token; teachers via `classIds`;
  status-gated visibility on exams/submissions.
- **Self-elevation blocked** — rules forbid a client editing its own
  `isSuperAdmin` / `status` / `enrolledSpaceIds`.
- **The `<system>` actor** — trigger/scheduler code runs as
  super-admin-_equivalent_ but is still bound by the tenant-scope gate, so
  backend automation can't cross tenants either.
- **Composite indexes** (`firestore.indexes.json`) are overwhelmingly
  tenant-scoped, role-keyed queries — e.g.
  `userMemberships (tenantId, role, status)` and `(uid, status)`,
  `students (classIds⊇, status)`, `classes (academicSessionId, status)`,
  `academicSessions (isCurrent, status)` — the shape you'd expect for per-tenant
  roster/membership lookups.

---

## 5. Consumers

- **super-admin app** (`apps/super-admin`) — platform ops: tenant CRUD,
  deactivate/reactivate, global presets, cross-tenant `searchUsers` /
  `tenant.list`. The only surface allowed the real-super-admin bypass.
- **admin-web** (`apps/admin-web`) — tenant-admin console: user/class/session
  management, bulk import, rollover, announcements, branding, export. On
  `@levelup/query` (migration DONE per memory).
- **mobile-admin** (`apps/mobile-admin`) — Expo tenant-admin app mirroring the
  admin surface.
- Teacher/parent/student surfaces consume identity read-only (roster reads,
  memberships) plus the content verticals.

**Real-data note:** the canonical tenant lives at **`lvlup-ff6fa` →
`tenants/tenant_subhang` (code SUB001)** — hand-authored, _unprefixed_ (not
under a `v2_` namespace). The deployed v2 seed drifts from the canonical domain
Zod; a transform-migration (`migrate-subhang-to-v2.mjs`, "Option A") is the
recommended reconciliation. Relevant here because it's the live shape any
identity change must not break.

---

## 6. Known Open Items & Risks

### RR-T2-A — Claim-builder convergence (**CONFIRMED divergence, live**)

There are **multiple claim builders that do not agree**, and the backend one is
wired to the **legacy package**:

- `functions/identity/src/utils/claims.ts` — `buildClaimsForMembership()`
  imports `PlatformClaims`, `MembershipClaimsInput`, `MAX_CLAIM_CLASS_IDS` from
  **`@levelup/shared-types`** (legacy), _not_ the canonical
  **`@levelup/domain`**.
- `packages/seed/src/engine/claims.ts` — a **second, independent** builder used
  by seeding.
- `packages/functions-shared/src/context/build-auth-context.ts` — the read-side
  that reconstructs ctx from claims (handles the `classIdsOverflow` fallback).

**The concrete hazard is the permission-key vocabularies diverge.** The backend
builder writes teacher claims with keys
`canCreateExams, canEditRubrics, canManuallyGrade, canViewAllExams, canCreateSpaces, canManageContent, canViewAnalytics, canConfigureAgents`
— but the **domain SSOT `TEACHER_PERMISSION_KEYS`** is
`canManageSpaces, canManageStudents, canManageClasses, canCreateExams, canGradeExams, canViewAnalytics, canManageContent, canReleaseResults`.
Only 3 keys overlap. Staff diverges similarly (backend writes
`canManageBilling/canManageSettings`; domain has
`canImportData/canManageAnnouncements`). So a claim minted by the backend can
carry permission flags that `authorize()`/`ACCESS_RULES` (which speak the
_domain_ vocabulary) never check — and vice versa, `ACCESS_RULES` gates on keys
the backend never mints. Since the permission gate is _lenient_
(grant-unless-explicit-false), this currently fails **open**, not closed — the
risk is latent, not yet a breach, but it means granular permission gating is
effectively **not enforced** for the non-overlapping keys. **Convergence = point
every claim builder at the `@levelup/domain` SSOT and unify the key set.** (P2
per memory, but the divergence is real and worth flagging to SDK-coord.)

### RR-T2-B — Permission-key conflict (**BLOCKED on product decision**)

`canManageClasses` and `canViewAnalytics` appear in **both**
`TEACHER_PERMISSION_KEYS` and `STAFF_PERMISSION_KEYS`. At runtime they're
disambiguated (separate `permissions` vs `staffPermissions` maps; `ACCESS_RULES`
uses `permission` vs `staffPermission`), so it's not a live bug. The blocked
question is **semantic/product**: should "manage classes" be _one_ shared
capability or _two_ role-scoped ones with possibly different meaning? Until
product decides, the duplicate keys stay and the key-vocabulary can't be fully
normalized (which also entangles RR-T2-A's unification).

### Other risks / observations

- **Claims are global to the Auth user, single-active-tenant.** Every
  membership/permission/class change that affects the JWT requires an explicit
  re-mint; miss one and the JWT goes stale (rules read stale claims until
  refresh). The save-callables do re-mint on the paths that matter, but this is
  a standing correctness burden.
- **`classIds` cap = 15.** A teacher/student in >15 classes relies on the
  `classIdsOverflow` fallback path in both rules (`canAccessClass` →
  `managedClassIds`) and `build-auth-context`. Any consumer that reads
  `classIds` directly without honoring the overflow flag will silently
  under-authorize.
- **Legacy `@levelup/shared-types` still in the identity backend.** The claim
  builder (and its `PlatformClaims`/`MAX_CLAIM_CLASS_IDS` imports) predate the
  domain SSOT. Same-named types in two packages invite exactly the drift seen in
  RR-T2-A.
- **Trigger-maintained denorm is source-of-truth-adjacent.** `studentCount`,
  `stats`, roster arrays are eventually-consistent projections; a dropped
  trigger leaves them wrong without failing any write.
- **`profileSchema` intentionally omitted** from `ROLE_DESCRIPTORS` (cycle
  avoidance) — wire it in only when the role-addition save-callable factory
  (Tier 4) is built.

---

## 7. Key File Map

| Concern                                   | Path                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Role SSOT                                 | `packages/domain/src/entities/identity/role-registry.ts`                |
| Claims schema                             | `packages/domain/src/entities/identity/claims.ts`                       |
| Membership schema                         | `packages/domain/src/entities/identity/membership.ts`                   |
| Tenant/session/class/user/profile schemas | `packages/domain/src/entities/identity/{tenant,class,user,profiles}.ts` |
| Tenant/role/status enums                  | `packages/domain/src/enums/tenant.ts`                                   |
| Permission key enums                      | `packages/domain/src/enums/permissions.ts`                              |
| Authority decision                        | `packages/access/src/policy.ts` (`authorize`, `ACCESS_RULES`)           |
| Action registry                           | `packages/access/src/actions.ts`                                        |
| Role predicates                           | `packages/access/src/keys/roles.ts`                                     |
| Firestore isolation rules                 | `firestore.rules`                                                       |
| Tenant-scoped indexes                     | `firestore.indexes.json`                                                |
| Backend callables                         | `functions/identity/src/callable/*` (23)                                |
| Backend claim builder (divergent)         | `functions/identity/src/utils/claims.ts`                                |
| Auth/Firestore triggers                   | `functions/identity/src/triggers/*` (6)                                 |
| Schedulers                                | `functions/identity/src/scheduled/*` (2)                                |
