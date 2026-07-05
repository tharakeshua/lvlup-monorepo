# SDK Review B — IDENTITY / ORG Domain + API (deep design audit)

**Reviewer:** `be-sdk` (worker session `sess_1782552876191_th6igixg6`)
**Scope:** the IDENTITY/ORG core of the fat-SDK — client/account, tenant
(multi-tenancy), roles & permissions (RBAC/claims), teachers, students, parents,
staff, scanner, users/profiles, memberships/enrollments. **Packages audited:**
`packages/domain` (Zod entities/enums/primitives), `packages/api-contract`
(callable SSOT seam), `packages/access` (RBAC policy),
`packages/services/src/{identity,shared,repo-admin}`
(claims/paths/provisioning). **Mode:** READ-ONLY. No code changed, no fixes
applied. Findings + target-design sketches only. **Method:** (A) web research of
best-in-class patterns → (B) code audit vs those patterns + the human's mandate
(proper design ▸ extensibility ▸ modularity/composability ▸ good code).

---

## 1. Executive summary

The identity/org slice is, on the whole, **a strong and security-conscious
design** that already nails several hard multi-tenant problems. What it does
_not_ yet do is live up to the mandate's #2/#3 priorities — **extensibility and
composability** — and it ships with **three concrete correctness bugs** that
silently defeat its own membership/claims model.

**What is genuinely good (keep, do not regress):**

- **`tenantId` is claim-derived, never client-supplied.** Enforced structurally:
  `AuthContext.tenantId` comes from claims (`shared/context.ts:33`,
  `requireTenant`), every service uses `requireTenant(ctx)`, and a contract test
  (`api-contract/src/__tests__/no-tenant-id-in-request.test.ts`) forbids
  `tenantId` in any request body. Super-admin cross-tenant ops travel as an
  explicit `tenantOverride`. This matches the consensus best practice exactly
  ("the tenantId must appear as a verified claim in the token, not a
  client-supplied parameter").
- **One authority decision, expressed as data.** `packages/access/src/policy.ts`
  reduces every authority-sensitive op to a single declarative `ACCESS_RULES`
  table over an exhaustive `Action` union, unit-tested for completeness. This is
  the "centralized policy engine" the literature recommends.
- **Single claim-mint primitive + single membership-write factory.**
  `syncMembershipClaims` is the only claims writer; `provisionMembership` is the
  only membership writer. Claims are explicitly a _projection_ of the
  authoritative membership doc — exactly the "derive claims from trusted source,
  never drift" principle.
- **`UserMembership` keyed `{uid}_{tenantId}`** is a proper many-to-many
  junction between users and tenants, carrying per-tenant `role`/`permissions`.
  "Same user, different role per tenant" is modeled correctly.
- **Branded IDs flow into Zod** (`primitives/branded-id.zod.ts`), schemas are
  `.strict()`, secrets are Secret-Manager refs only, answer-keys are deny-all
  subcollections, impersonation is constrained.

**Where it falls short of the mandate:**

1. **Composability is asserted but not realized.** The repo _already ships_
   composable primitives — `withAudit`, `zAuditFields`, `zTenantScoped`,
   `zSoftDeletable` in `primitives/audit.zod.ts`, whose own docstring says
   "every entity schema appends audit uniformly" — and **not a single identity
   entity uses them** (B-IDN-10). Every entity hand-inlines the same 4 audit
   fields + `tenantId`. The "blocks from smaller blocks" pattern exists and is
   bypassed.
2. **No shared identity/person primitive.**
   `firstName/lastName/displayName/email/phone` are copy-pasted across
   `UnifiedUser` and all five role profiles (B-IDN-11). There is no
   `PersonName`/`ContactInfo` block composed up.
3. **Adding a role is a ~12-site change, not a localized one** (B-IDN-12) — the
   single most important extensibility finding. There is no role
   _registry/descriptor_; role identity is spread across an enum, a rank map, a
   branded-id, two schemas, a context bag, a links schema, two service mappings,
   the profiles file, the contract, and several `ACCESS_RULES` role groups.
4. **Two parallel permission subsystems** (teacher vs staff) with separate
   enums, separate claim fields, and separate policy gates (B-IDN-13). A third
   role wanting granular permissions needs a third copy of everything.

**Top correctness bugs (P0):** the `tenant["code"]` field typo zeroes out
`tenantCode` in minted memberships/claims (B-IDN-01); `joinTenant` looks up a
tenant by passing the _code_ as the _id_ (B-IDN-02); `saveStudent`'s
membership-provisioning branch is dead code because `authUid` is rejected by the
strict request schema (B-IDN-03).

Counts: **3 × P0, 4 × P1, 8 × P2, 4 × P3.**

---

## 2. Per-entity current-model map (file:line)

| Entity / concept                          | Schema location                                   | Storage path                                                       | Notes                                                                                                 |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **UnifiedUser** (global identity)         | `domain/src/entities/identity/user.ts:38-62`      | `users/{uid}` (`repo-admin/paths.ts:161`)                          | carries `uid`, contact, `isSuperAdmin`, `activeTenantId`, embedded `consumerProfile`                  |
| **ConsumerProfile** (B2C embed)           | `user.ts:23-29`                                   | embedded in user **and** `consumerProfiles/{uid}` (`paths.ts:188`) | model/storage drift (B-IDN-21)                                                                        |
| **UserMembership** (user↔tenant junction) | `identity/membership.ts:31-53`                    | `userMemberships/{uid}_{tenantId}` (`paths.ts:169-177`)            | the M:N join; source of truth for role/permissions                                                    |
| **PlatformClaims** (JWT projection)       | `identity/claims.ts:20-36`                        | JWT only (minted `sync-membership-claims.ts:74`)                   | projection of membership; never a doc                                                                 |
| **Tenant** (+ 8 nested embeds)            | `identity/tenant.ts:79-103`                       | `tenants/{tenantId}` (`paths.ts:47`)                               | `tenantCode`, `ownerUid`, subscription/features/settings/stats/usage/branding/onboarding/deactivation |
| **TenantCodeIndex**                       | `tenant.ts:105-109`                               | `tenantCodes/{code}` (`paths.ts:179`)                              | public code→tenantId map; resolved by `resolveCode`                                                   |
| **TenantPublicView**                      | `tenant.ts:111-117`                               | projection (pre-auth)                                              | the only pre-auth shape                                                                               |
| **Student**                               | `identity/profiles.ts:24-45`                      | `tenants/{t}/students/{id}`                                        | `authUid?`, `classIds[]`, `parentIds[]`                                                               |
| **Teacher**                               | `profiles.ts:47-69`                               | `tenants/{t}/teachers/{id}`                                        | `authUid?`, `classIds[]`, `sectionIds?`                                                               |
| **Parent**                                | `profiles.ts:71-89`                               | `tenants/{t}/parents/{id}`                                         | `authUid?`, `studentIds[]`, `linkedStudentNames?` (denorm)                                            |
| **Staff** (new)                           | `profiles.ts:91-106`                              | `tenants/{t}/staff/{id}`                                           | `authUid?`, `department?`                                                                             |
| **Scanner** (new)                         | `profiles.ts:108-119`                             | `tenants/{t}/scanners/{id}`                                        | `authUid` **required**; orphaned in write path (B-IDN-23)                                             |
| **Class**                                 | `identity/class.ts:19-35`                         | `tenants/{t}/classes/{id}`                                         | reciprocal `teacherIds[]`/`studentIds[]` + `studentCount` denorm                                      |
| **AcademicSession**                       | `class.ts:37-50`                                  | `tenants/{t}/academicSessions/{id}`                                | `isCurrent`                                                                                           |
| **Role enum** `TENANT_ROLES`              | `domain/src/enums/tenant.ts:12-22`                | —                                                                  | `superAdmin,tenantAdmin,teacher,student,parent,scanner,staff`                                         |
| **Role rank / predicates**                | `access/src/keys/roles.ts:17-45`                  | —                                                                  | hardcoded `ROLE_RANK` Record                                                                          |
| **Teacher perms enum**                    | `domain/src/enums/permissions.ts:7-18`            | —                                                                  | 8 keys                                                                                                |
| **Staff perms enum**                      | `permissions.ts:20-29`                            | —                                                                  | 6 keys (separate subsystem)                                                                           |
| **Access policy table**                   | `access/src/policy.ts:54-141`                     | —                                                                  | `ACCESS_RULES: Record<Action, AccessRule>`                                                            |
| **Path/prefix builders**                  | `repo-admin/paths.ts:30-215`                      | —                                                                  | `collectionPrefix()` env-driven `v2_`; mirrors seed `engine/paths.ts`                                 |
| **Claims build/sync**                     | `services/src/identity/sync-membership-claims.ts` | —                                                                  | `buildClaimsFromMembership` + `syncMembershipClaims`                                                  |
| **Membership factory**                    | `services/src/identity/provision-membership.ts`   | —                                                                  | single writer                                                                                         |

---

## 3. Structured findings

Severity: **P0** = correctness bug defeating stated design · **P1** = design
flaw directly against the mandate (extensibility/composability) · **P2** =
meaningful design/consistency issue · **P3** = polish.

### P0 — correctness bugs

---

**B-IDN-01 · area: claims/membership integrity · severity: P0** **Location:**
`services/src/identity/org-users.ts:28`,
`services/src/identity/save-entities.ts:95` **Issue:** Both read the tenant code
as `tenant?.["code"]`, but the `Tenant` schema field is **`tenantCode`**
(`tenant.ts:84`); there is no `code` field. So `tenantCode` resolves to `""` for
every membership minted via `createOrgUser` and the `saveStudent` create-branch.
That empty string then propagates into the membership doc
(`provision-membership.ts:53`) and into the minted claim
(`sync-membership-claims.ts:47`). `tenantCode` is a real claim consumers read.
The correct path already exists nearby: `tenant.ts:119` uses `resolveCode`/the
`tenantCode` field correctly. **Recommendation:** Read `tenant["tenantCode"]`.
Add a unit assertion that a provisioned membership's `tenantCode` is non-empty
and equals the tenant's `tenantCode`. Consider making `provisionMembership`
resolve `tenantCode` itself from the tenant doc so no caller can pass the wrong
field. **Citation:** Claims must be derived from the trusted source of truth and
not silently degrade —
[WorkOS: design multi-tenant RBAC](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas).

---

**B-IDN-02 · area: tenant join / code resolution · severity: P0** **Location:**
`services/src/identity/org-users.ts:138` (`joinTenantService`) **Issue:**
`await ctx.repos.tenants.get(input.tenantCode, input.tenantCode)` passes the
**tenantCode as the tenantId**. Tenant docs are keyed by `tenantId`, not by
code; the code→id map lives in `tenantCodes/{code}` and is resolved via
`resolveCode` (`tenant-repo.ts:116`). So `joinTenant` only succeeds in the
accidental case where `tenantCode === tenantId`; otherwise it 404s. The sibling
`lookupTenantByCodeService` (`tenant.ts:116-120`) does it correctly. Two code
paths, one right, one wrong — a copy-paste divergence. **Recommendation:**
Resolve through `resolveCode(input.tenantCode)` first, then
`get(tenantId, tenantId)` (mirror `tenant.ts:119`). Factor a single
`resolveTenantByCode()` helper so join + lookup cannot diverge again.
**Citation:** Junction/index collections are the idiomatic Firestore
code-lookup; read through the index, don't guess the key —
[Firestore many-to-many modeling](https://medium.com/firebase-tips-tricks/how-to-secure-many-to-many-relationships-in-firestore-d19f972fd4d3).

---

**B-IDN-03 · area: contract/domain drift — dead provisioning branch · severity:
P0** **Location:** `services/src/identity/save-entities.ts:96` vs
`api-contract/src/callables/identity/entities.ts:55-75` **Issue:**
`saveStudentService` does `const authUid = input.data["authUid"]` and only
provisions a membership + claims if `authUid` is present. But
`SaveStudentRequestSchema.data` is `.strict()` and **does not declare
`authUid`** — a strict parse rejects it. So `authUid` is always `undefined` and
the entire membership/claims branch (`save-entities.ts:97-110`) is
**unreachable** via the real wire path. The callable advertises
`resyncsClaims: true` + `invalidates: ["memberships","claims"]`, which it can
therefore never honor. (The same latent gap exists for
`saveTeacher/Parent/Staff`, which don't provision at all.) **Recommendation:**
Decide the contract: either (a) add `authUid?` to the strict request schemas and
make the create-branch authoritative, or (b) declare that role _profiles_ never
mint memberships and that account-linking is exclusively `createOrgUser`'s job —
then drop the dead branch and the misleading `resyncsClaims`/`invalidates`.
Whichever is chosen, the contract flags and the service must agree (this is the
SSOT seam's whole purpose). **Citation:** Contract and implementation must not
drift; a `.strict()` schema is the boundary —
[Zod strict schemas](https://zod.dev/api).

---

### P1 — extensibility & composability (the mandate core)

---

**B-IDN-10 · area: composability — unused shared primitives · severity: P1**
**Location:** `domain/src/primitives/audit.zod.ts` (defines `zAuditFields`,
`zTenantScoped`, `zSoftDeletable`, `withAudit`) vs every identity entity
(`user.ts:56-61`, `tenant.ts:98-101`, `profiles.ts` ×5, `class.ts:30-33`,
`membership.ts:47-51`). **Issue:** The composable "blocks" the mandate asks for
**already exist** — `withAudit`'s own docstring is _"so every entity schema
appends audit uniformly"_ — yet a grep shows **zero importers** across
`domain/entities` and `api-contract`. Instead, each entity hand-copies
`createdAt/updatedAt/createdBy/updatedBy` (and `tenantId`), inconsistently: most
omit the `archivedAt` that `zSoftDeletable` provides even though they implement
archive via `status`. This is duplication the mandate explicitly calls out, with
the fix already sitting in the tree unused. **Recommendation:** Adopt the
existing mixins.
`StudentSchema = zObject({ ...zTenantScoped, ...studentFields, ...zAuditFields })`.
Prefer **spread composition** over `.extend()` chains (compiler-cheaper at
scale). Add a lint test asserting every tenant-scoped entity composes
`zTenantScoped` + `zAuditFields` so future entities can't drift. **Citation:**
Define common pieces once and reference them; spread is more compiler-efficient
than chained `.extend()` —
[Zod schema composition](https://stevekinney.com/courses/full-stack-typescript/structuring-zod-schemas-efficiently),
[Total TypeScript: composing objects](https://www.totaltypescript.com/tutorials/zod/zod-section/composing-objects/solution).

---

**B-IDN-11 · area: composability — no shared person/identity primitive ·
severity: P1** **Location:** `user.ts:43-47` and `profiles.ts:24-119`
(Student/Teacher/Parent/Staff/Scanner) **Issue:** `firstName`, `lastName`,
`displayName`, `email`, `phone` are independently re-declared on `UnifiedUser`
and on each role profile (with subtle inconsistencies — e.g. `Student.firstName`
is optional, `Teacher.firstName` required; `displayName` optional everywhere;
phone present on Teacher/Parent but not Student). There is no
`PersonName`/`ContactInfo` block. This is precisely the "data is duplicated
multiple times" anti-pattern; identity facts have no single home, so they drift
per role. **Recommendation:** Extract `PersonNameSchema`
(`{firstName,lastName,displayName?}`) and `ContactInfoSchema`
(`{email?,phone?}`) primitives and compose them into both `UnifiedUser` and
every role profile. Decide one canonical optionality rule and enforce it through
the shared block. This also clarifies identity-vs-profile (B-IDN-20 below).
**Citation:** A single data entry per data point, pushed to profiles, not
duplicated —
[identity/profile separation patterns (USPTO 10,812,602; Salesforce unified profiles)](https://trailhead.salesforce.com/content/learn/modules/data-and-identity-in-salesforce-cdp/get-to-know-unified-profiles).

---

**B-IDN-12 · area: extensibility — adding a role is not localized · severity:
P1** **Location (the ~12 sites a new role touches):** `enums/tenant.ts:12`
(enum) · `access/keys/roles.ts:17` (`ROLE_RANK`) · `branded-id.zod.ts` (new
`zXId`) · `identity/claims.ts:21-27` (per-role id claim) ·
`identity/membership.ts:39-43` (per-role id) · `shared/context.ts:18-24`
(`EntityIds`) · `api-contract/.../users.ts:222-229`
(`ChangeMembershipRoleRequest.links`) · `provision-membership.ts:19-25`
(`entityIds`) · `org-users.ts:33-47,83-90` (role→repo + entityIds maps) ·
`identity/profiles.ts` (new schema) · `api-contract/.../entities.ts` (new
`save*`) · `access/policy.ts:43-48` (role groups). **Issue:** Role identity is
_spread_, not _registered_. The mandate's #2 ("adding a new role must be a
small, localized change") is not met — it's a dozen-file change with several
stringly-typed maps (`entityRepoByRole`, the nested ternary at
`org-users.ts:83-90`) that fail open/silently if a role is missed.
**Recommendation:** Introduce a **role descriptor registry** — one array of
`{ role, idBrand, profileSchema, repoKey, claimIdField, permissionSet? }` from
which the enum, the `EntityIds` shape, the role→repo map, the claims id-fields,
and the contract `links` are _derived_. Adding a role becomes appending one
descriptor (+ its profile schema). Replace the `org-users.ts`
ternary/`entityRepoByRole` literals with lookups into the registry. See sketch
§4.2. **Citation:** Extensible RBAC = add an entry/mapping, not edit many
privileges; centralize so enforcement stays consistent —
[IBM RBAC](https://www.ibm.com/think/topics/rbac),
[extensible RBAC model (USPTO 8,402,266)](https://patents.google.com/patent/US8402266).

---

**B-IDN-13 · area: extensibility — two parallel permission subsystems ·
severity: P1** **Location:** `enums/permissions.ts:7-29` (two enums) ·
`identity/claims.ts:32-33` (`permissions` + `staffPermissions`) ·
`membership.ts:44-45` · `access/policy.ts:31-34,171-192` (separate `permission`
vs `staffPermission` gates) · `AccessContext` `permissions`/`staffPermissions`
(`actions.ts:189-190`). **Issue:** Teacher and staff granular permissions are
_entirely separate_ pipelines: two key enums, two claim fields, two membership
fields, two `AccessRule` gate fields, two context fields, two filter passes. A
third role that needs granular permissions (parent? scanner? a future
"examiner"?) requires a third copy of all six. The permission _concept_ is not
composable. **Recommendation:** Unify into one **namespaced permission key
space** — e.g. keys like `teacher:canGradeExams`, `staff:canManageUsers` in a
single `PERMISSION_KEYS` registry, carried in one claim field
`permissions: Record<PermissionKey, boolean>` and gated by one
`rule.permission?: PermissionKey`. Per-role validity is a lookup in the
registry, not a separate type. This collapses six parallel structures to one and
makes "add a permission" a one-line registry append. See sketch §4.3.
**Citation:** A single permission map reviewed/edited centrally beats parallel
hardcoded sets —
[Aerospike RBAC guide](https://aerospike.com/blog/role-based-access-control-rbac-guide/),
[WorkOS multi-tenant RBAC](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas).

---

### P2 — design & consistency

---

**B-IDN-20 · area: identity-vs-profile / role modeling — superAdmin conflation ·
severity: P2** **Location:** `enums/tenant.ts:13` (`superAdmin` in
`TENANT_ROLES`) + `user.ts:52` (`isSuperAdmin` boolean) + `claims.ts:34`
(`isSuperAdmin` claim). **Issue:** Super-admin is modeled **twice and at two
layers**: as a tenant-scoped role inside `TENANT_ROLES` _and_ as a
platform-level `isSuperAdmin` boolean on the user/claim. But super-admin is
inherently _platform-level_ (cross-tenant), not tenant-scoped — the policy
engine even keys it off `isSuperAdmin`, never `role==='superAdmin'`
(`policy.ts:144-146`). Likewise `tenantAdmin` is the real top tenant role.
Carrying `superAdmin` in the tenant-role union invites a membership with
`role:'superAdmin'` that the policy ignores. **Recommendation:** Separate the
axes: a platform-scope flag (`isSuperAdmin`) distinct from the `TenantRole`
union; drop `superAdmin` from `TENANT_ROLES` (top tenant role = `tenantAdmin`).
This is the "roles in the functional sense vs responsibilities/scope"
separation. **Citation:** Roles must be tenant-scoped and the platform/tenant
scopes kept distinct —
[Aserto: multi-tenant RBAC](https://www.aserto.com/blog/authorization-101-multi-tenant-rbac),
[SSOJet multi-tenant identity](https://ssojet.com/blog/multi-tenant-identity-management).

---

**B-IDN-21 · area: model/storage drift — ConsumerProfile · severity: P2**
**Location:** `user.ts:23-29,53` (embedded `consumerProfile`) vs
`paths.ts:188-193` (`consumerProfiles/{uid}` top-level collection). **Issue:**
The domain schema embeds `consumerProfile` inside `UnifiedUser`, but the path
layer provisions a _separate_ `consumerProfiles/{uid}` collection. One of these
is the real home; consumers can't tell which. B2C consumer fields are also
flagged "server-only" in the file header but live on the same schema clients
read. **Recommendation:** Pick one home. If B2C consumer state is a distinct
profile (recommended — it parallels the role-profile pattern), model it as its
own `ConsumerProfile` _entity_ at `consumerProfiles/{uid}` and remove the embed
from `UnifiedUser`; expose it via a dedicated read. This also reinforces
identity-vs-profile (one identity, many profiles). **Citation:** Separate
profiles from the core identity; don't duplicate the same data point in two
places —
[unified profiles & data strategy](https://trailhead.salesforce.com/content/learn/modules/data-and-identity-in-salesforce-cdp/get-to-know-unified-profiles).

---

**B-IDN-22 · area: consistency — asymmetric membership permission shapes ·
severity: P2** **Location:** `membership.ts:24-29,44-45` **Issue:**
`permissions` is a _wrapped object_ (`TeacherPermissionsSchema` =
`{permissions, managedSpaceIds, managedClassIds}`) while `staffPermissions` is a
_bare_ `Record<StaffPermissionKey,boolean>`. So "permissions" means two
different shapes depending on role. `managedSpaceIds`/`managedClassIds` (scoping
data, i.e. ABAC attributes) are also smuggled inside a field named
"permissions." **Recommendation:** Make both the same shape (a bare keyed
record), and move `managedSpaceIds`/`managedClassIds` to a clearly-named
`scoping`/`grants` field. Folds naturally into the unified permission registry
(B-IDN-13). Separating "what actions" (RBAC) from "on which resources" (scoping)
is the recommended hybrid RBAC/ABAC split. **Citation:** Separate allowed
actions from the resources they apply to; hybrid RBAC+ABAC for fine-grained
scope —
[Auth0: choose an authz model](https://auth0.com/blog/how-to-choose-the-right-authorization-model-for-your-multi-tenant-saas-application/).

---

**B-IDN-23 · area: extensibility — Scanner role orphaned in write path ·
severity: P2** **Location:** `profiles.ts:108-119` (schema exists) vs
`org-users.ts:33-47` (`entityRepoByRole` has no `scanner`) and
`api-contract/.../entities.ts` (no `saveScanner`). **Issue:** `scanner` is a
first-class role in the enum/claims/membership and has a required-`authUid`
profile schema, but **no callable creates one** and `createOrgUser` rejects it
(`org-users.ts:49`). A role exists in the type system that the system cannot
actually provision — a direct symptom of B-IDN-12 (no registry to keep these in
lockstep). **Recommendation:** Either add the scanner write path or remove the
half-built role. With the role registry (§4.2), this inconsistency becomes
structurally impossible — the write path is derived from the same descriptor
list as the enum. **Citation:** Consistent enforcement across the stack requires
deriving from one source, not parallel hand-maintained lists —
[IBM RBAC](https://www.ibm.com/think/topics/rbac).

---

**B-IDN-24 · area: tenant isolation — prefix mirrored by hand · severity: P2**
**Location:** `repo-admin/paths.ts:30-37` (`collectionPrefix`/`topLevel`) +
docstring "MUST stay mirrored with `@levelup/seed` `engine/paths.ts`".
**Issue:** The `v2_` prefix logic is centralized _within_ services (good) but
**duplicated** in the seed engine's `paths.ts` and kept in sync only by a
comment. A drift between the two writes seeded data and runtime reads to
different prefixed collections — a silent tenant-data-visibility bug. Prefix
handling is "in one place" per package but not across the two packages that must
agree. **Recommendation:** Hoist the prefix/path contract into a single shared
module (e.g. a tiny `@levelup/paths` or an export from `domain`) that both
`services/repo-admin` and `seed/engine` import, so there is exactly one
`collectionPrefix()` and one set of top-level builders. Add a cross-package test
asserting identical resolved paths. **Citation:** Every read/write must share
one tenant-scoping implementation; a missed/forked one leaks across boundaries —
[LoginRadius: multi-tenant authz without data leaks](https://www.loginradius.com/blog/identity/what-is-multi-tenant-authorization).

---

**B-IDN-25 · area: scale — reciprocal class arrays / activeTenant drift ·
severity: P2** **Location:** `class.ts:27-28` (`studentIds[]` + `studentCount`),
`profiles.ts:34` (`Student.classIds[]`); `user.ts:54` (`activeTenantId`) vs
`org-users.ts:114-131` (`switchActiveTenant` mints claims but never writes
`activeTenantId`). **Issue (a):** Student↔Class is a reciprocal-array
many-to-many. The claim side is bounded (`MAX_CLAIM_CLASS_IDS=15` overflow
handling, good), but `Class.studentIds` is **unbounded** against Firestore's 1
MB doc limit — a class of thousands will eventually fail writes. **Issue (b):**
`UnifiedUser.activeTenantId` exists but `switchActiveTenant` only re-mints
claims; the user doc's `activeTenantId` is never updated, so it drifts from the
claim (which is the real active-tenant source). **Recommendation:** (a) For
potentially-large classes, model enrollment as a junction subcollection
(`classes/{id}/enrollments/{studentId}`) and treat `studentIds`/`studentCount`
strictly as a trigger-maintained projection (the file already says they're "not
source of truth" — make storage match). (b) Either persist `activeTenantId` on
switch, or drop the field and treat the claim as the only active-tenant source.
**Citation:** Reciprocal arrays hit the 1 MB limit; junction/subcollection for
large M:N; design for read patterns —
[Firestore M:N modeling](https://oneuptime.com/blog/post/2026-02-17-how-to-design-firestore-data-models-for-complex-many-to-many-relationships/view),
[Firestore structure-data guide](https://firebase.google.com/docs/firestore/manage-data/structure-data).

---

**B-IDN-26 · area: naming/cohesion — `uid` vs `authUid` · severity: P2**
**Location:** `user.ts:39` (`uid`) vs `profiles.ts` (`authUid?`),
`membership.ts:33` (`uid`). **Issue:** The same concept — the Firebase Auth UID
— is `uid` on user/membership and `authUid` on role profiles. Two names for one
foreign key raises the cognitive cost of every join and invites the historical
"`Student.uid` runtime drift" already noted in project memory.
**Recommendation:** Standardize on one name (`authUid` reads clearest as the FK
to the auth account; `uid` is fine as the PK of `UnifiedUser`). Whichever is
chosen, apply it everywhere a profile references the account, and bake it into
the shared identity primitive (B-IDN-11). **Citation:** Consistent naming for
the identity FK is part of clean identity/profile separation —
[USPTO 7,343,628 authorization data model](https://patents.google.com/patent/US7343628).

---

**B-IDN-27 · area: data integrity — name denormalization · severity: P2**
**Location:** `profiles.ts:81` (`Parent.linkedStudentNames?`), `class.ts:28`
(`studentCount`). **Issue:** Denormalized human-readable names
(`linkedStudentNames`) and counts duplicate facts owned elsewhere and drift on
rename/transfer. Acceptable as read-optimizations _if_ trigger-maintained, but
`linkedStudentNames` has no documented owner (unlike
`studentIds`/`studentCount`, which are marked trigger-maintained).
**Recommendation:** Mark every denorm field explicitly as a projection with a
named maintaining trigger, or drop it in favor of a join read. Don't let denorm
fields be client-writable. **Citation:** Denormalize deliberately for read
patterns, and own the write-back; otherwise prefer a join —
[Firestore query best practices](https://estuary.dev/blog/firestore-query-best-practices/).

---

### P3 — polish

- **B-IDN-30 · P3** — `EntityIds` (`shared/context.ts:18-24`), the membership
  per-role ids, and `ChangeMembershipRoleRequest.links` (`users.ts:222-229`) are
  three hand-maintained copies of the same
  `{teacherId?,studentId?,parentId?,staffId?,scannerId?}` bag. Derive all three
  from the role registry (§4.2).
- **B-IDN-31 · P3** — `SaveResponse` doc-comment drift: `entities.ts:8` says
  `{id,created,archived?}` but the actual `SaveResponseSchema` (`_shared.ts:26`)
  is `{id,created?,deleted?}`. Align the comment.
- **B-IDN-32 · P3** — `_shared.ts:11` admits
  `SaveResponseSchema`/`EmptyRequest`/`looseRecord` are duplicated here
  "byte-identical" pending a fold onto `callables/core/_shared`. Complete the
  fold; one definition.
- **B-IDN-33 · P3** — `JOIN_SOURCES` enum (`tenant.ts:28-37`) lists
  `self_register`,`tenant_code`,`invite_code` but services emit `self_joined`
  (`org-users.ts:150`) — a value **not in the enum**. Either widen the enum or
  fix the literal; today a strict parse of that membership would fail.

---

## 4. Target-design sketches (prioritized)

### 4.1 Compose entities from shared blocks (fixes B-IDN-10, B-IDN-11, B-IDN-26)

```ts
// domain/src/primitives/person.zod.ts  (NEW shared blocks)
export const zPersonName = {
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().optional(),
} as const;
export const zContactInfo = {
  email: z.string().optional(),
  phone: z.string().optional(),
} as const;
export const zAccountLink = { authUid: zUserId.optional() } as const; // one canonical FK name

// profiles.ts — every role profile becomes "blocks composed up"
export const StudentSchema = zObject({
  id: zStudentId,
  ...zTenantScoped, // { tenantId }            (already exists, audit.zod.ts)
  ...zAccountLink, // { authUid? }
  ...zPersonName,
  ...zContactInfo,
  rollNumber: z.string().optional(),
  classIds: z.array(zClassId).default([]),
  parentIds: z.array(zParentId).default([]),
  // …student-specific only…
  status: zEntityStatus,
  ...zAuditFields, // { createdAt,updatedAt,createdBy,updatedBy } (already exists)
});
```

Spread composition (not chained `.extend()`) per the Zod perf guidance. Add a
lint test: every tenant-scoped entity must contain `zTenantScoped` +
`zAuditFields`.

### 4.2 Role descriptor registry (fixes B-IDN-12, B-IDN-23, B-IDN-30)

```ts
// domain/src/identity/role-registry.ts  (NEW — single source for "what is a role")
export const ROLE_DESCRIPTORS = [
  {
    role: "student",
    rank: 0,
    idField: "studentId",
    repoKey: "students",
    profileSchema: StudentSchema,
    provisionable: true,
  },
  {
    role: "teacher",
    rank: 3,
    idField: "teacherId",
    repoKey: "teachers",
    profileSchema: TeacherSchema,
    provisionable: true,
    permissionSet: "teacher",
  },
  {
    role: "scanner",
    rank: 2,
    idField: "scannerId",
    repoKey: "scanners",
    profileSchema: ScannerSchema,
    provisionable: true,
  },
  // …parent, staff, tenantAdmin…
] as const;

// EVERYTHING below is DERIVED — adding a role = appending one descriptor:
export const TENANT_ROLES = ROLE_DESCRIPTORS.map((d) => d.role);
export const ROLE_RANK = Object.fromEntries(
  ROLE_DESCRIPTORS.map((d) => [d.role, d.rank])
);
export type EntityIds = Partial<
  Record<(typeof ROLE_DESCRIPTORS)[number]["idField"], string>
>;
export const repoForRole = (r) =>
  ROLE_DESCRIPTORS.find((d) => d.role === r)?.repoKey;
```

`org-users.ts`'s `entityRepoByRole` literal and the `entityIds` ternary collapse
to `repoForRole(role)` / `{ [descriptor.idField]: entityId }`. The contract
`links` schema and `claims` id-fields are generated from the same `idField` set.
Platform `superAdmin` leaves the tenant-role list (B-IDN-20).

### 4.3 Unified, namespaced permission registry (fixes B-IDN-13, B-IDN-22)

```ts
// one key space, role-namespaced — replaces TEACHER_/STAFF_PERMISSION_KEYS
export const PERMISSION_KEYS = [
  "teacher:canGradeExams", "teacher:canManageSpaces", /* … */
  "staff:canManageUsers",  "staff:canImportData",     /* … */
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

// claims & membership carry ONE field:
permissions?: z.record(zPermissionKey, z.boolean()).optional();
// scoping (ABAC attrs) lives in its OWN field, not inside "permissions":
grants?: z.object({ managedSpaceIds: z.array(zSpaceId).optional(),
                    managedClassIds: z.array(zClassId).optional() }).optional();

// AccessRule gate: one field instead of two
interface AccessRule { roles: …; permission?: PermissionKey; tenantScoped: boolean; … }
```

`policy.ts`'s twin `permission`/`staffPermission` gates and the two filter
passes (`permissionAllowed`) collapse to one. Adding a permission = appending
one registry key; per-role validity is a registry lookup.

### 4.4 Identity-vs-profile, made explicit (fixes B-IDN-20, B-IDN-21)

```
UnifiedUser  (users/{uid})          ← ONE global identity: auth facts + isSuperAdmin (platform scope)
   └─ composes zPersonName/zContactInfo (the canonical copy)
ConsumerProfile (consumerProfiles/{uid})   ← a PROFILE, not embedded in UnifiedUser
UserMembership (userMemberships/{uid}_{tenantId})  ← per-tenant ROLE binding (the M:N junction) — unchanged, it's good
Role profiles (tenants/{t}/{role}s/{id})   ← per-tenant, per-role profile, authUid → UnifiedUser
```

One identity, many profiles, role bound per tenant via the membership junction —
the textbook "persona/role" separation, and it leaves the already-correct
membership/claims projection untouched.

---

## 5. Closing note

The hard, security-critical half of this domain — claim-derived tenant
isolation, a single data-driven policy engine, single claim-mint and single
membership-write primitives — is **done well and should not be disturbed**. The
work the mandate is really asking for is _refactoring toward composition_: adopt
the primitives that already exist (B-IDN-10), extract the person block
(B-IDN-11), and replace the spread-out role/permission definitions with two
registries (B-IDN-12/13) so that "add a role / add a permission / add a
tenant-scoped entity" each become a one-line, one-file change. Fix the three P0s
first — they currently make the membership/claims model silently lie about
`tenantCode` and break tenant-join.

_All findings are READ-ONLY observations. No code was modified._
