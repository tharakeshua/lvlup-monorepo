# DP-6 · Identity correctness + single tenant-code resolver

**Wave:** W0 (the 3 P0s) + W2 (the structural cleanups) · **Status:**
design-only · **Evidence:** `SDK-REVIEW-B-IDENTITY-DOMAIN.md`
(B-IDN-01/02/03/20/21), RR-T2-A.

## Problem

Three correctness bugs that make the membership/claims model **silently lie**:

- **B-IDN-01 (P0):** `org-users.ts:28` + `save-entities.ts:95` read
  `tenant?.["code"]`, but the field is **`tenantCode`** (`tenant.ts:84`) — there
  is no `code`. So `tenantCode=""` for every membership minted via
  `createOrgUser` and the `saveStudent` create-branch, propagating into the
  membership doc (`provision-membership.ts:53`) and the minted claim
  (`sync-membership-claims.ts:47`). Consumers read that claim. The correct path
  exists nearby (`tenant.ts:119` uses `resolveCode`).
- **B-IDN-02 (P0):** `joinTenantService` (`org-users.ts:138`) does
  `repos.tenants.get(input.tenantCode, input.tenantCode)` — passing the **code
  as the id**. Tenant docs are keyed by `tenantId`; the code→id map is
  `tenantCodes/{code}` resolved via `resolveCode`. Only works when `code===id`.
  Sibling `lookupTenantByCodeService` (`tenant.ts:116-120`) does it right.
- **B-IDN-03 (P0):** `saveStudent`'s membership-provisioning branch
  (`save-entities.ts:96`) reads `input.data.authUid`, but the `.strict()`
  request schema (`api-contract/.../entities.ts:55-75`) **rejects `authUid`** →
  dead code; the callable advertises a `resyncsClaims` it can never honor.

Plus: `ConsumerProfile` model/storage drift (embedded in user _and_
`consumerProfiles/{uid}`) (B-IDN-21); `superAdmin` conflated into the
tenant-role enum (B-IDN-20); runtime vs seed claim-builders diverge (RR-T2-A).

## Target design

- **Single `resolveTenantByCode()` helper** used by both `joinTenant` and
  `lookupTenantByCode` — reads `tenantCodes/{code}` then `get(tenantId)`. The
  two paths can never diverge again. _(fixes B-IDN-02)_
- **`provisionMembership` resolves `tenantCode` itself** from the tenant doc →
  no caller can pass the wrong field; assert provisioned `tenantCode` is
  non-empty and equals the tenant's. _(fixes B-IDN-01)_
- **Resolve the `saveStudent` contract/impl mismatch:** either accept `authUid`
  in the request schema (if provision-on-create is intended) or remove the dead
  branch + the advertised resync. _(fixes B-IDN-03)_
- **One `buildClaimsFromMembership`** shared by runtime + seed, made data-driven
  by DP-2's `ROLE_DESCRIPTORS`. _(fixes RR-T2-A)_
- **Lift `superAdmin`** out of `TENANT_ROLES` into the platform dimension
  (`UnifiedUser.isSuperAdmin` already exists) → tenant roles become purely
  tenant-scoped. _(fixes B-IDN-20)_
- **`ConsumerProfile`:** pick one home (own doc vs embedded) and make the model
  match. _(fixes B-IDN-21)_

## What to preserve (do not regress — strong existing design)

Claim-derived `tenantId` (the `no-tenant-id-in-request` contract test), the
single `ACCESS_RULES` policy engine, the single claim-mint
(`syncMembershipClaims`) + single membership-write (`provisionMembership`)
primitives, and the `{uid}_{tenantId}` membership junction. DP-6 hardens these;
it does not change the model.

## Tests

- Provisioned-membership `tenantCode` is non-empty + equals tenant (regression
  for B-IDN-01).
- `joinTenant` succeeds when `code !== tenantId` (regression for B-IDN-02).
- `saveStudent` contract ↔ impl: the accepted request shape matches what the
  impl reads.
- runtime `buildClaimsFromMembership` == seed builder for every role.

## Closes

B-IDN-01, B-IDN-02, B-IDN-03, B-IDN-20, B-IDN-21, RR-T2-A.
