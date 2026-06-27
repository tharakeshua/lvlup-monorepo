# Identity & Auth Module -- Code Review Report

**Reviewer:** Identity & Auth Engineer **Date:** 2026-02-24 **Scope:** Cloud
Functions (identity), shared-services/auth, shared-hooks/auth, shared-stores
(auth/tenant), shared-types (identity/tenant), shared-ui/auth, integration
tests, Firestore rules

---

## Summary

The Identity & Auth module is well-structured overall with strong tenant
isolation, correct use of Firestore security rules, and a clean separation
between Cloud Functions (write path) and client code (read path). The codebase
follows the Phase 3A/3B architecture docs closely, with naming correctly
reconciled to the `Tenant`/`tenantId` vocabulary.

Key strengths:

- Memberships are write-protected (client-side writes blocked by rules)
- Custom claims are kept minimal with an overflow mechanism for classIds
- Atomic tenant creation with tenantCode uniqueness enforced via transaction
- API keys stored in Secret Manager, not Firestore
- Comprehensive Firestore rules tests covering all identity collections

Key concerns:

- Insecure password generation using `Math.random()`
- Missing input validation/sanitization on multiple callable functions
- Non-atomic multi-document writes risk data inconsistency
- Several security rule gaps compared to the architecture docs
- Incomplete test coverage for Cloud Functions

---

## Findings

### CRITICAL

#### C1. Insecure password generation with `Math.random()`

**File:** `functions/identity/src/utils/auth-helpers.ts:13` **Description:**
`generateTempPassword()` uses `Math.random()` which is not cryptographically
secure. Temporary passwords generated this way are predictable if an attacker
can observe or infer the PRNG state. These passwords are used for student
accounts created via `createOrgUser` and `bulkImportStudents`, and are returned
to the admin who created them. **Impact:** An attacker with timing information
could predict generated passwords for newly created student accounts.
**Recommendation:** Use `crypto.randomBytes()` or `crypto.getRandomValues()`
from Node.js `crypto` module instead:

```typescript
import { randomBytes } from "crypto";
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
```

#### C2. Bulk import returns plaintext credentials in Cloud Function response

**File:** `functions/identity/src/callable/bulk-import-students.ts:206,240-246`
**Description:** `bulkImportStudents` collects all generated passwords in a
`credentials[]` array and returns them in the response payload. This data
transits over HTTPS but:

1. The credentials are logged in memory for the entire function execution (up to
   540s)
2. If the caller stores/logs this response, passwords are persisted in plaintext
3. The response could be intercepted by browser extensions or client-side
   logging **Impact:** Mass credential exposure if response is logged or
   intercepted. **Recommendation:** Consider a secure credential delivery
   mechanism (e.g., generate a one-time download link, store encrypted
   credentials temporarily, or email individual credentials to parent emails if
   available). At minimum, document that this response must not be logged.

#### C3. `switchActiveTenant` does not check that tenant status is fully active

**File:** `functions/identity/src/callable/switch-active-tenant.ts:35-37`
**Description:** The tenant status check allows any status except `suspended`
and `expired`:

```typescript
if (!tenant || tenant.status === 'suspended' || tenant.status === 'expired') {
```

The `Tenant.status` type includes
`'active' | 'suspended' | 'trial' | 'expired'`. The `trial` status passes this
check, which is likely intentional. However, there is no explicit handling of a
`null`/missing status field. More importantly, this differs from other functions
(e.g., `createOrgUser` line 51) which require `tenant.status !== 'active'`,
meaning a tenant in `trial` status can have users switch into it but cannot have
new users created in it via `createOrgUser`. This inconsistency could cause
confusion. **Impact:** Inconsistent tenant access behavior across different
operations. **Recommendation:** Standardize tenant status checks. Create a
shared utility `assertTenantActive(tenant)` that defines the canonical set of
allowed statuses for each operation type.

---

### MAJOR

#### M1. `createOrgUser` overwrites existing user's custom claims without merging

**File:** `functions/identity/src/callable/create-org-user.ts:137-138`
**Description:** When a user already exists (email-already-exists case at line
74-75), the function proceeds to set custom claims at line 138.
`setCustomUserClaims` completely replaces all existing claims. If the user
already had claims from a different tenant/role, those are wiped out.
**Impact:** A multi-tenant user who is added to a second tenant will lose their
active claims for the first tenant. Their next token refresh will only reflect
the new tenant context. **Recommendation:** Read existing claims first, merge
them intelligently, or at minimum document this as expected behavior (the user
must re-switch to restore their previous context). Alternatively, only set
claims if the user has no existing claims.

#### M2. `createTenant` creates owner membership outside the transaction

**File:** `functions/identity/src/callable/create-tenant.ts:110-128`
**Description:** The tenant document and tenantCode index are created atomically
inside a transaction (lines 49-107), but the owner's membership document and
custom claims are created outside the transaction (lines 110-128). If the
function fails after the transaction but before membership creation, the tenant
exists without an admin who can manage it. **Impact:** Orphaned tenant with no
admin membership, requiring manual database intervention to fix.
**Recommendation:** Move the membership creation into the transaction, or
implement a compensating cleanup mechanism.

#### M3. `listClasses` has no tenant membership verification

**File:** `functions/identity/src/callable/list-classes.ts:10-36`
**Description:** The function only checks that the caller is authenticated
(line 14) and that `tenantId` is provided (line 18-19). It does not verify that
the caller has an active membership in the requested tenant. Any authenticated
user can list classes for any tenant. **Impact:** Information disclosure -- any
logged-in user can enumerate classes across all tenants. **Recommendation:** Add
a membership check. At minimum use `getMembership(callerUid, data.tenantId)` to
verify the caller belongs to the tenant, or use `assertTenantAdminOrSuperAdmin`
if this should be admin-only.

#### M4. `onClassDeleted` and `onStudentDeleted` triggers can exceed Firestore batch limit

**File:** `functions/identity/src/triggers/on-class-deleted.ts:31-51`,
`functions/identity/src/triggers/on-student-deleted.ts:31-51` **Description:**
Both triggers iterate over arrays (`studentIds`, `teacherIds`, `parentIds`,
`classIds`) and add batch operations. Firestore batches have a 500-operation
limit. A class with >250 students and >250 teachers, or a student with >500
combined parents+classes, would exceed this limit and fail. **Impact:** Cleanup
operations silently fail for large classes/students, leaving stale references.
**Recommendation:** Chunk the batch operations into groups of 500, or use
`bulkWriter` which handles batching automatically.

#### M5. `assignStudentToClass` double-counts on re-assignment

**File:** `functions/identity/src/callable/assign-student-to-class.ts:48-53`
**Description:** The function uses `arrayUnion` for adding the studentId
(idempotent) but unconditionally increments `studentCount` (line 51). If a
student is assigned to the same class twice, `studentIds` won't change
(arrayUnion is idempotent) but `studentCount` will be incremented again.
**Impact:** `studentCount` becomes inaccurate over time, leading to incorrect
stats displayed to admins. **Recommendation:** Check if the student is already
in the class before incrementing, or use a transaction to read current
studentIds and conditionally increment.

#### M6. `createStudent` and `createTeacher` don't create UserMembership or set claims

**File:** `functions/identity/src/callable/create-student.ts`,
`functions/identity/src/callable/create-teacher.ts` **Description:** Unlike
`createOrgUser` which creates the entity doc + membership + claims in one flow,
the standalone `createStudent` and `createTeacher` callables only create the
entity document. They don't create a corresponding `UserMembership` or set
custom claims. This means students/teachers created through these endpoints
won't have proper auth context. **Impact:** Users created via these endpoints
cannot access tenant-scoped data through Firestore rules (which check
claims/membership). **Recommendation:** Either remove these functions
(consolidate into `createOrgUser`), or add membership/claims creation logic. If
these are intentionally partial (entity-only), rename them to clarify (e.g.,
`createStudentEntity`) and document the expected workflow.

#### M7. Firestore rules `isSuperAdmin()` does a `get()` on every evaluation

**File:** `firestore.rules:11-13` **Description:** The `isSuperAdmin()` helper
reads `/users/{uid}` from Firestore on every rule evaluation where it's
referenced. Since it appears in nearly every rule (via `isTenantAdmin` which
falls through to `isSuperAdmin`), this adds significant read cost and latency.
The architecture doc (Phase 3A, Section 5) specifies SuperAdmin should be
indicated via a custom claim (`platform: 'superAdmin'`), not a Firestore
document read. **Impact:** Every Firestore operation by any user potentially
triggers an extra document read. At scale this doubles Firestore read costs for
the identity layer. **Recommendation:** Check for SuperAdmin via custom claims
instead:

```javascript
function isSuperAdmin() {
  return isAuthenticated() && request.auth.token.role == "superAdmin";
}
```

Set the `role: 'superAdmin'` claim via Cloud Function when `isSuperAdmin` is set
on the user doc.

---

### MINOR

#### m1. Mixed use of v1 and v2 Firebase Functions APIs

**File:** `functions/identity/src/triggers/on-user-created.ts:2`,
`functions/identity/src/triggers/on-user-deleted.ts:2` **Description:** Auth
triggers use `firebase-functions/v1` while all callable functions and Firestore
triggers use `firebase-functions/v2`. This is because v2 does not yet support
auth triggers, so it's technically correct, but the import of `logger` from v2
in v1 trigger files (e.g., `on-user-created.ts:3`) may cause issues in some
bundling configurations. **Recommendation:** Add a comment explaining why v1 is
used for auth triggers, to prevent accidental "upgrades".

#### m2. Inconsistent field naming between `createOrgUser` entity and `createStudent` entity

**File:** `functions/identity/src/callable/create-org-user.ts:91` vs
`functions/identity/src/callable/create-student.ts:42` **Description:**
`createOrgUser` creates student entities with `authUid` field (line 91), while
`createStudent` uses `uid` field (line 42). The `Student` type in `shared-types`
defines the field as `uid`. This inconsistency means entities created via
different paths have different field names for the same concept. **Impact:**
Queries filtering on `uid` will miss entities created by `createOrgUser` (which
stored `authUid`), and vice versa. **Recommendation:** Standardize on one field
name. The `Student` type uses `uid`, so `createOrgUser` should use `uid` as well
(or update the type to use `authUid`).

#### m3. `updateTenantStats` only handles `student` and `teacher` roles

**File:** `functions/identity/src/utils/firestore-helpers.ts:35-41`
**Description:** The `fieldMap` only maps `student` and `teacher` roles. When
`createOrgUser` is called with `role: 'parent'` or `role: 'scanner'`,
`updateTenantStats` silently does nothing. The `TenantStats` type doesn't have
fields for parents or scanners, so this may be intentional, but the
`bulkImportStudents` function calls
`updateTenantStats(tenantId, 'parent', 'increment')` at line 320, which silently
does nothing. **Recommendation:** Either add `totalParents` to `TenantStats` and
handle it, or remove the call to `updateTenantStats` for parent role in
`bulkImportStudents`.

#### m4. `onUserDeleted` trigger updates stats outside the batch

**File:** `functions/identity/src/triggers/on-user-deleted.ts:42-44`
**Description:** Stats updates happen in a loop after the batch commit. If one
`updateTenantStats` call fails, subsequent ones are skipped (unhandled
rejection), leaving stats inconsistent. **Recommendation:** Wrap the stats
update loop in try/catch per iteration, or use `Promise.allSettled`.

#### m5. No date validation for academic sessions

**File:** `functions/identity/src/callable/create-academic-session.ts:53-54`
**Description:** `startDate` and `endDate` are parsed with
`new Date(data.startDate)` without validating that they produce valid dates or
that `startDate < endDate`. **Impact:** Invalid dates (e.g., `"not-a-date"`)
will create sessions with `Invalid Date` timestamps. **Recommendation:**
Validate that the dates parse correctly and that `startDate < endDate`.

#### m6. `CredentialsStep` "Forgot password?" button has no handler

**File:** `packages/shared-ui/src/components/auth/CredentialsStep.tsx:139-144`
**Description:** The "Forgot password?" button is rendered but has no `onClick`
handler, making it a non-functional UI element. **Recommendation:** Either wire
up a password reset handler via props, or remove the button until the feature is
implemented.

#### m7. `useAuth` hook creates new subscriptions on every mount

**File:** `packages/shared-hooks/src/auth/useAuth.ts:8-40` **Description:**
`useUserId` (line 45) and `useUserEmail` (line 53) each call `useAuth()`
internally, which creates a new auth state subscription each time. If multiple
components use these hooks, each gets its own subscription. **Impact:** Minor
performance concern; multiple redundant auth state listeners.
**Recommendation:** These hooks should use the `useAuthStore` from shared-stores
instead, which maintains a single subscription. The `useAuth` hook appears to be
a simpler alternative, but using both patterns creates confusion about which to
use.

#### m8. `OrgPickerDialog` has no close/dismiss mechanism

**File:** `packages/shared-ui/src/components/auth/OrgPickerDialog.tsx:36-71`
**Description:** The dialog has no close button, no ESC handler, and no backdrop
click handler. Once open, the only way to dismiss it is to select an
organization. **Recommendation:** Add an onClose prop or allow backdrop click to
dismiss, especially for cases where the user changes their mind.

#### m9. Firestore rules missing coverage for `academicSessions` and `parents` subcollections

**File:** `firestore.rules` **Description:** The rules file has rules for
`students`, `teachers`, `classes`, but no explicit rules for
`/tenants/{tenantId}/academicSessions/{sessionId}` or
`/tenants/{tenantId}/parents/{parentId}`. These are defined in the architecture
doc (Phase 3B, Section 13.2). The `parents` rule at line 164-173 does exist.
However, `academicSessions` has no rule, meaning reads/writes will be denied by
default (Firestore denies by default), which will block the
`createAcademicSession` callable from working client-side reads of sessions.
**Correction:** On re-examination, `academicSessions` is not listed in the
rules. Client-side reads of academic sessions will fail. Only Cloud Functions
(Admin SDK) bypass rules, so the callable functions themselves will work, but
clients querying sessions directly will be blocked. **Recommendation:** Add
rules for `academicSessions`:

```javascript
match /tenants/{tenantId}/academicSessions/{sessionId} {
  allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
  allow write: if isSuperAdmin() || isTenantAdmin(tenantId);
}
```

#### m10. `tenantCode` not validated for format/length in `createTenant`

**File:** `functions/identity/src/callable/create-tenant.ts:39-41`
**Description:** The `tenantCode` is checked for presence but not validated for
format. There's no minimum/maximum length, no character restrictions, and no
regex validation. An admin could create a tenant with code `" "` (whitespace) or
extremely long codes. **Recommendation:** Add format validation (e.g., 3-10
alphanumeric characters, uppercase).

---

### SUGGESTIONS

#### S1. Add Zod or similar runtime validation for callable function inputs

**Description:** All callable functions cast `request.data as SomeInterface`
without runtime validation. TypeScript types are erased at runtime, so malformed
client input (extra fields, wrong types, missing required fields) passes through
unchecked. **Files:** All files under `functions/identity/src/callable/`
**Recommendation:** Use a runtime schema validation library (Zod, io-ts, or
Superstruct) to validate `request.data` at the top of each callable. This would
catch issues like missing `tenantId`, non-string values, and injection attempts
in string fields.

#### S2. Consolidate duplicate type definitions between Cloud Functions and shared-services

**Description:** `CreateOrgUserRequest`, `StudentImportRow`,
`BulkImportRequest`, etc. are defined both in `functions/identity/src/callable/`
and in `packages/shared-services/src/auth/auth-callables.ts`. Changes to one
won't automatically be reflected in the other. **Recommendation:** Move
request/response types to `shared-types` and import from there in both
locations.

#### S3. Add rate limiting to `bulkImportStudents`

**File:** `functions/identity/src/callable/bulk-import-students.ts`
**Description:** The function allows up to 500 rows per call with no rate
limiting. A malicious or buggy admin could repeatedly call this, creating
thousands of Firebase Auth accounts. **Recommendation:** Add rate limiting via
Firebase App Check, or track import frequency in Firestore and reject rapid
successive imports.

#### S4. Add integration tests for callable functions

**File:** `tests/integration/auth-flows.test.ts` **Description:** Integration
tests cover auth flows (login, claims, rules) but do not test any of the
callable functions (`createOrgUser`, `switchActiveTenant`, `bulkImportStudents`,
etc.). The unit tests only cover utility functions (`sanitizeRollNumber`,
`generateTempPassword`, `buildClaimsForMembership`). **Recommendation:** Add
integration tests that invoke the callable functions against emulators to verify
the full create-user-and-set-claims pipeline.

#### S5. Consider adding `tenantId` validation to all callables

**Description:** Several functions accept `tenantId` from the client and use it
to construct Firestore paths (e.g., `tenants/${data.tenantId}/students`). While
Firestore rules protect against unauthorized reads from the client side, Cloud
Functions operate with Admin SDK and bypass rules entirely. A compromised or
malicious client could send a crafted `tenantId` to access or modify data in
another tenant. **Recommendation:** All callables that accept `tenantId` should
verify the caller's membership in that tenant before proceeding.
`assertTenantAdminOrSuperAdmin` handles this for admin operations, but ensure no
callable skips this check.

#### S6. `auth-store.ts` initialize() does not handle the case where token claims have no tenantId and user has multiple memberships

**File:** `packages/shared-stores/src/auth-store.ts:107-121` **Description:**
When `claimTenantId` is undefined and `memberships.length > 1`, the store does
not auto-select a tenant and does not set `currentTenantId`. This leaves the
user in a "no tenant selected" state. The UI needs to handle this by showing the
OrgPickerDialog, but there's no explicit mechanism to trigger it.
**Recommendation:** Add a `needsTenantSelection` computed/derived state that the
UI can react to, e.g.:

```typescript
export const useNeedsTenantSelection = () =>
  useAuthStore(
    (s) =>
      !s.loading &&
      s.firebaseUser !== null &&
      s.currentTenantId === null &&
      s.allMemberships.length > 1
  );
```

#### S7. Architecture doc deviation -- claims structure

**Description:** The implemented claims structure (`PlatformClaims` in
`shared-types/identity/claims.ts`) differs from both architecture docs:

- Phase 3A specifies `{ platform: 'superAdmin', activeOrgId, activeRole }`
- Phase 3B specifies
  `{ role, tenantId, tenantCode, teacherId?, classIds?, ... }`
- Implementation uses Phase 3B's richer structure, which is the correct choice
  per Section 15.2 reconciliation However, `isSuperAdmin` check in Firestore
  rules reads from Firestore document instead of claims, diverging from both
  docs. **Recommendation:** Document the authoritative claims schema in the
  codebase (not just in external docs). The current implementation's approach of
  putting `role`, `tenantId`, and entity IDs in claims is good -- just align the
  `isSuperAdmin` rule check.

---

## Test Coverage Assessment

| Area                                                 | Unit Tests | Integration Tests | Notes                                    |
| ---------------------------------------------------- | :--------: | :---------------: | ---------------------------------------- |
| `sanitizeRollNumber`                                 |    Yes     |        --         | Good edge case coverage                  |
| `generateTempPassword`                               |    Yes     |        --         | Tests randomness and charset             |
| `generateSlug`                                       |    Yes     |        --         | Good edge case coverage                  |
| `buildClaimsForMembership`                           |    Yes     |        --         | Excellent coverage, all roles + overflow |
| `createOrgUser`                                      |     No     |        No         | **Gap** -- complex function needs tests  |
| `switchActiveTenant`                                 |     No     |        No         | **Gap**                                  |
| `bulkImportStudents`                                 |     No     |        No         | **Gap** -- most complex function         |
| `createTenant`                                       |     No     |        No         | **Gap** -- transaction logic untested    |
| `setTenantApiKey`                                    |     No     |        No         | **Gap**                                  |
| CRUD callables (class/student/teacher/parent)        |     No     |        No         | **Gap**                                  |
| Auth triggers (onUserCreated/Deleted)                |     No     |        No         | **Gap**                                  |
| Firestore triggers (onClassDeleted/onStudentDeleted) |     No     |        No         | **Gap**                                  |
| School-code login flow                               |     --     |        Yes        | Good E2E coverage                        |
| Roll number login                                    |     --     |        Yes        | Tests synthetic email                    |
| Multi-org switch                                     |     --     |        Yes        | Tests claim refresh                      |
| Cross-tenant isolation                               |     --     |        Yes        | Tests deny access                        |
| Firestore rules (/users)                             |     --     |        Yes        | Read/write/elevation prevention          |
| Firestore rules (/userMemberships)                   |     --     |        Yes        | Read + write-deny                        |
| Firestore rules (/tenants)                           |     --     |        Yes        | Member/non-member/admin                  |
| Firestore rules (/tenantCodes)                       |     --     |        Yes        | Public read, no write                    |
| Firestore rules (/students)                          |     --     |        Yes        | All roles + parent-child                 |
| Firestore rules (academicSessions)                   |     --     |        No         | **Gap** -- no rules exist                |
| Auth store (Zustand)                                 |     No     |        No         | **Gap**                                  |
| Tenant store (Zustand)                               |     No     |        No         | **Gap**                                  |

**Overall test coverage is moderate.** Utility functions and Firestore rules
have good coverage. Callable Cloud Functions and stores have no tests. The most
critical gap is the lack of tests for `createOrgUser` and `bulkImportStudents`,
which are the most complex functions with the highest risk of data
inconsistency.

---

## Architecture Alignment Summary

| Architecture Spec                              | Implementation Status | Notes                                                                      |
| ---------------------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| Single UID per user                            | Aligned               | `onUserCreated` creates `/users/{uid}` correctly                           |
| Tenant isolation via `/tenants/{tenantId}/...` | Aligned               | All entity data is tenant-scoped                                           |
| Membership-driven roles                        | Aligned               | `userMemberships/{uid}_{tenantId}` pattern                                 |
| Slim claims with overflow                      | Aligned               | `MAX_CLAIM_CLASS_IDS = 15` with overflow flag                              |
| Multi-org switcher                             | Aligned               | `switchActiveTenant` + `OrgSwitcher` UI                                    |
| Consumer user path                             | Partially aligned     | `useIsConsumer` selector exists but no consumer-specific flows implemented |
| `tenantCode` uniqueness                        | Aligned               | Enforced via transaction in `createTenant`                                 |
| API key in Secret Manager                      | Aligned               | `setTenantApiKey` uses `SecretManagerServiceClient`                        |
| Roll number synthetic email                    | Aligned               | `sanitizeRollNumber + @{tenantId}.levelup.internal`                        |
| SuperAdmin via claims                          | **Not aligned**       | Rules check Firestore doc, not claims (see M7)                             |
| `tenantAdmin` can update tenant                | Aligned               | Rules allow `isTenantAdmin(tenantId)` to update                            |
| Membership write-protected                     | Aligned               | `allow write: if false` in rules                                           |

---

## Prioritized Action Items

1. **[CRITICAL]** Replace `Math.random()` with `crypto.randomBytes()` in
   `generateTempPassword`
2. **[CRITICAL]** Design secure credential delivery for bulk import (or document
   risk)
3. **[MAJOR]** Fix `listClasses` missing tenant membership check
4. **[MAJOR]** Fix `assignStudentToClass` double-counting `studentCount`
5. **[MAJOR]** Standardize `uid` vs `authUid` field naming across entity
   creation paths
6. **[MAJOR]** Add `academicSessions` rules to `firestore.rules`
7. **[MAJOR]** Move `isSuperAdmin()` in Firestore rules to claims-based check
8. **[MAJOR]** Clarify role of `createStudent`/`createTeacher` vs
   `createOrgUser` (consolidate or document)
9. **[MINOR]** Add input validation (Zod) to callable functions
10. **[MINOR]** Add date validation to academic session creation
11. **[MINOR]** Fix batch size limits in Firestore triggers
12. **[MINOR]** Add callable function integration tests
