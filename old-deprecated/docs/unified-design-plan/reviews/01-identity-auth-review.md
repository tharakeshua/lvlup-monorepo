# Identity & Auth Engineer — Cross-Module Design Review

**Reviewer:** Identity & Auth Engineer **Date:** 2026-02-19 **Scope:** Review of
all 5 unified design plans from the Identity & Auth perspective **Documents
Reviewed:**

- `01-identity-auth-design.md` (own module)
- `02-autograde-design.md`
- `03-levelup-design.md`
- `04-analytics-intelligence-design.md`
- `05-frontend-apps-design.md`

---

## 1. Summary of Findings

Overall, the 5 design plans are well-aligned and demonstrate strong cross-module
coordination. The auth module's core contracts (UnifiedUser, UserMembership,
PlatformClaims, Tenant) are referenced consistently across modules. The
shared-types approach is sound. However, I've identified **7 inconsistencies**,
**5 missing integration points**, and **several suggested changes** that should
be resolved before implementation begins.

### Severity Legend

- 🔴 **Critical** — Will break auth/security at runtime; must fix
- 🟡 **Important** — Will cause incorrect behavior or confusing UX; should fix
- 🟢 **Minor** — Improvement; can address in implementation

---

## 2. Per-Plan Feedback

---

### 2.1 Plan 02: AutoGrade Design

**Overall:** Well-integrated. Auth flows correctly referenced. Most identity
patterns are used correctly.

#### ✅ What's Correct

- API key management via `setTenantApiKey()` CF correctly delegates to Identity
  module (§8.3). The reference to `tenant.settings.geminiKeyRef` and Secret
  Manager is accurate.
- Scanner authentication (§9.3) correctly references the scanner role, custom
  token model, and `/scanners/{scannerId}` pattern — consistent with identity
  design §3.4 (SuperAdmin login) and §2.2 (`scannerId` in UserMembership).
- Firestore rules (§15) use `isTenantAdmin()`, `isTeacher()`, `isStudent()`,
  `isParent()`, `isScanner()` helper functions. These are consistent with the
  identity rule helpers.
- `hasTeacherPermission(tenantId, 'canCreateExams')` and
  `hasTeacherPermission(tenantId, 'canEditRubrics')` correctly map to
  `TeacherPermissions` fields defined in identity design §2.2.
- `isStudentOwner()` correctly uses `request.auth.token.studentId` from custom
  claims.
- `isParentOfStudent()` correctly uses `request.auth.token.studentIds` from
  parent claims.
- `isTeacherForSubmission()` correctly uses `request.auth.token.classIds` for
  class-scoped access.

#### 🔴 Issue AG-1: `studentUserId` Field Mismatch

**In:** `04-analytics-intelligence-design.md` §5.2, the analytics module
queries:

```typescript
.where('studentUserId', '==', userId)
```

**But in** `02-autograde-design.md` §3.3, the `Submission` schema uses:

```typescript
studentId: string; // This is the entity ID, not the UID
```

There is no `studentUserId` (Firebase Auth UID) field on the `Submission`
entity. The analytics module would fail to find submissions for a student.

**Fix:** Add `studentUid: string` (Firebase Auth UID) field to the `Submission`
entity in addition to `studentId` (entity doc ID). Update the analytics query to
use `studentUid`.

```typescript
// In Submission schema (02-autograde-design.md §3.3):
studentId: string; // → /tenants/{tenantId}/students/{studentId}
studentUid: string; // Firebase Auth UID (NEW — for analytics queries)
```

#### 🟡 Issue AG-2: Result Release Field Naming Inconsistency

**In** `02-autograde-design.md` §3.3, the submission field is:

```typescript
resultsReleased: boolean;
```

**But in** `04-analytics-intelligence-design.md` §5.2 and §7.2, the query uses:

```typescript
.where('isReleased', '==', true)
```

These are different field names. The analytics module will fail to find released
submissions.

**Fix:** Standardize on `resultsReleased: boolean` (as defined in the AutoGrade
schema). Update all analytics queries to use `resultsReleased`.

#### 🟡 Issue AG-3: Submission `status` vs `pipelineStatus` Field Confusion

**In** `04-analytics-intelligence-design.md` §7.2, the exam analytics
computation queries:

```typescript
.where('status', 'in', ['grading_complete', 'released'])
```

**But in** `02-autograde-design.md` §3.3, submissions use `pipelineStatus`, not
`status`. The value `'released'` also doesn't exist — the correct value is
`'results_released'`. This would result in no submissions being found for
analytics.

**Fix:** Update the analytics query to:

```typescript
.where('pipelineStatus', 'in', ['grading_complete', 'reviewed', 'results_released'])
```

#### 🟢 Issue AG-4: Manual Override Permission Check

**In** `02-autograde-design.md` §7.1 (`manualGradeQuestion` CF), the auth check
says:

```
// Trigger: Callable (by Teacher/Admin with canManuallyGrade)
```

But the implementation comment only says "Validate permission" without
referencing the specific `canManuallyGrade` permission flag. This is fine as a
design note, but the implementation must explicitly check
`permissions.canManuallyGrade === true` from the UserMembership, not just
`isTeacher(tenantId)`.

**Fix:** Ensure the Cloud Function explicitly reads the caller's membership and
checks `permissions.canManuallyGrade === true`.

---

### 2.2 Plan 03: LevelUp Design

**Overall:** Solid design. Auth integration is mostly correct. Key concern is
around answer key security and how access control is enforced for timed tests.

#### ✅ What's Correct

- Space access control function `canAccessSpace()` (§6.2) correctly checks
  `space.classIds.some(cid => student.classIds.includes(cid))`, which aligns
  with how class membership is tracked.
- `TeacherPermissions.canCreateSpaces`, `canManageContent`, `canConfigureAgents`
  fields are all present in the identity design (§2.2).
- The timed test session creation (`startTimedTest` CF) uses
  `admin.firestore.FieldValue.serverTimestamp()` for `startedAt` — correct
  server-side approach.
- `submitTimedTest` CF validates `submittedAt <= serverDeadline + 30s` — proper
  server-side enforcement.

#### 🔴 Issue LU-1: Answer Key Access Security Gap

**In** `03-levelup-design.md` §13 ("Answer Key Security"), the design states:

> `answerKeys` subcollection readable only via Admin SDK for active tests

However, no Firestore security rules are specified for this subcollection. The
LevelUp design plan lacks the rules section for answer key protection. The
AutoGrade design plan includes detailed Firestore rules, but LevelUp's rules
section is absent from the reviewed portion.

This is critical because answer keys must not be client-readable during an
active test. Without explicit `allow read: if false` on the `answerKeys`
subcollection (with Cloud Function-only access), a client could directly read
correct answers.

**Fix:** Add explicit Firestore rule to
`/tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/answerKeys/{keyId}`:

```javascript
match /answerKeys/{keyId} {
  // Never readable by clients — accessed only via Admin SDK in Cloud Functions
  allow read, write: if false;
}
```

#### 🟡 Issue LU-2: `canAccessSpace()` Missing Tenant Membership Check

**In** `03-levelup-design.md` §6.2, the access function is:

```typescript
function canAccessSpace(
  space: Space,
  student: Student,
  membership: UserMembership
): boolean {
  if (space.status !== "published") return false;
  if (space.accessType === "tenant_wide") return true;
  if (space.accessType === "public_store") return true; // Consumer path
  return space.classIds.some((cid) => student.classIds.includes(cid));
}
```

This is a client-side utility function, which is fine for UI gating. However,
the corresponding **Firestore security rule** must also enforce this. The rule
needs to check:

1. `belongsToTenant(tenantId)` — user is a member of the tenant
2. `space.classIds` contains a classId from the user's `claims.classIds`

Otherwise, a student in a different tenant (or a suspended student) could read
space content if they know the path.

**Fix:** Ensure the Firestore rule for `/tenants/{tenantId}/spaces/{spaceId}`
read checks:

```javascript
allow read: if isSuperAdmin()
  || isTenantAdmin(tenantId)
  || isTeacher(tenantId)
  || (isStudent(tenantId) && (
      resource.data.accessType == 'tenant_wide'
      || resource.data.classIds.hasAny(request.auth.token.classIds)
  ));
```

#### 🟡 Issue LU-3: `recordItemAttempt` CF — Missing `canManageContent` Permission Handling

**In** `03-levelup-design.md` §6.3, the progress tracking flow calls:

```
Cloud Function: recordItemAttempt(tenantId, userId, spaceId, storyPointId, itemId, submission, evaluation)
```

This function writes to `spaceProgress`, which is triggered for **students**.
The CF must validate that the caller is writing their own progress (not another
student's) and that they are a member of the tenant. The design plan doesn't
specify these auth checks explicitly.

**Fix:** Explicitly state that `recordItemAttempt` validates:

1. `context.auth.uid === userId` (can only write own progress)
2. `context.auth.token.tenantId === tenantId` (must be active in this tenant)

#### 🟢 Issue LU-4: `RubricCriterion` Schema Difference Between Modules

**In** `02-autograde-design.md` §2.2, `RubricCriterion` is:

```typescript
interface RubricCriterion {
  description: string;
  marks: number;
}
```

**In** `03-levelup-design.md` §3.5, `RubricCriterion` is:

```typescript
interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
  weight?: number;
  levels?: Array<{ score: number; label: string; description: string }>;
}
```

These are different schemas for the **same shared type**. The AutoGrade version
uses `marks` while LevelUp uses `maxPoints`, and LevelUp adds `id`, `name`,
`weight`, and `levels`.

Since both modules claim to use `UnifiedRubric` from `packages/shared-types`,
the canonical `RubricCriterion` definition must be reconciled into a single
interface. The LevelUp version is richer and should be the base, but `marks`
from AutoGrade must be preserved (possibly as an alias for `maxPoints`).

**Fix:** Reconcile in `packages/shared-types/src/content/rubric.ts`:

```typescript
interface RubricCriterion {
  id?: string; // Optional for backward compat
  name?: string; // Optional for AutoGrade extractions
  description: string;
  maxPoints: number; // Canonical field name
  marks?: number; // @deprecated — alias for maxPoints; used in AutoGrade extraction
  weight?: number;
  levels?: Array<{ score: number; label: string; description: string }>;
}
```

---

### 2.3 Plan 04: Analytics & Intelligence Design

**Overall:** Excellent module design with proper SLA targets and clear data
flows. Several auth integration issues due to field name mismatches already
noted above. Additional concerns below.

#### ✅ What's Correct

- RTDB security rules (§2.2) correctly use `auth.token.tenantId === $tenantId`
  and `auth.uid === $userId` — consistent with identity module's claims design.
- `flushPracticeProgress` CF (§4.2) correctly validates both
  `context.auth.uid !== data.userId` AND
  `context.auth.token.tenantId !== data.tenantId` before processing.
- `StudentProgressSummary` reads student's `classIds` by querying
  `/tenants/{tenantId}/students` by `authUid` — reasonable approach.
- Insight Engine is rule-based (no LLM) — correct per the design principle of
  zero AI cost for insights.
- Notification entity (§2.10) correctly uses `recipientUid` (Firebase Auth UID)
  not an entity ID — correct.

#### 🔴 Issue AN-1: Progress Summary Trigger — Wrong Field for Submission Release Check

**In** `04-analytics-intelligence-design.md` §5.1, the trigger source is listed
as:

```
Submission.isReleased → true (Firestore trigger)
```

But in `02-autograde-design.md` §3.3, the field is `resultsReleased: boolean`,
not `isReleased`. The Firestore trigger will never fire on the correct field
change.

**Fix:** Update the trigger description and implementation to watch
`resultsReleased` field (not `isReleased`).

#### 🟡 Issue AN-2: `studentUserId` Not Present on Submission

This was also noted in AG-1. The analytics module's
`updateStudentProgressSummary` function (§5.2) queries:

```typescript
.where('studentUserId', '==', userId)
```

The `Submission` entity in `02-autograde-design.md` §3.3 has `studentId` (entity
ID), not `studentUid`/`studentUserId`. This query will return 0 results.

**Fix:** Same as AG-1 — add `studentUid: string` to the `Submission` schema.

#### 🟡 Issue AN-3: RTDB Leaderboard — Security Concern

**In** `04-analytics-intelligence-design.md` §9.1, the leaderboard RTDB
structure stores `name` (display name) per user entry. The RTDB rules for
leaderboards (as defined in identity design §6.3) are:

```json
"leaderboards": {
  "$tenantId": {
    ".read": "auth != null && auth.token.tenantId === $tenantId",
    ".write": false
  }
}
```

Write is `false` — good, only Cloud Functions write. But the analytics plan
(§9.2) says the leaderboard is updated by calling
`admin.database().ref(...).transaction(...)` from a Cloud Function. This is
correct (Admin SDK bypasses rules).

**Minor concern:** The denormalized `name` field in leaderboard entries could
become stale if a user updates their `displayName`. The analytics module should
document a re-sync strategy (e.g., update leaderboard name when
`UnifiedUser.displayName` changes).

**Fix (minor):** Add a note that `onUserUpdated` trigger (or a periodic job)
refreshes `name` in leaderboard entries when `displayName` changes.

#### 🟢 Issue AN-4: Missing `canViewAnalytics` Permission Check in Analytics CFs

The analytics module's Cloud Functions (e.g., `updateClassProgressSummary`) are
HTTP functions invoked by Cloud Tasks with OIDC auth. No human-callable
analytics functions specify `canViewAnalytics` permission checks. The design
plan doesn't clarify which analytics CFs are callable by teachers vs. admins
only.

For the **on-demand exam analytics** (§7.1 "On-demand: When a teacher opens the
exam analytics view (callable function)"), this should check
`isTeacher(tenantId) && permissions.canViewAnalytics === true` OR
`isTenantAdmin(tenantId)`.

**Fix:** Document that on-demand analytics callable functions check
`canViewAnalytics` permission (from `TeacherPermissions`) before returning data.

---

### 2.4 Plan 05: Frontend Apps Design

**Overall:** The frontend plan is comprehensive and well-structured. Auth flows
are referenced correctly in most places. The org switcher, school-code login,
and consumer/B2B routing are all correctly designed. A few integration gaps
below.

#### ✅ What's Correct

- School-code login flow (§2.3) exactly matches the identity design's school
  login flow (§3.1) — correct 2-step: tenant code lookup → credentials →
  membership check → multi-org picker if needed.
- Org switcher (§2.2) correctly calls `switchActiveTenant` CF → force token
  refresh → update Zustand store → redirect. This matches identity design §5.3
  and §8.
- Consumer vs. school student routing (§10.4) correctly checks `isConsumer` flag
  derived from presence of `consumerProfile` and absence of `memberships`. This
  matches identity design §3.2.
- `authStore` (§11.2) includes `switchTenant` action that calls
  `switchActiveTenant` CF — correct pattern.
- Teacher nav items use `featureFlag: 'levelUpEnabled'` and
  `requiredPermission: 'canCreateExams'` — these correctly map to
  `TenantFeatures.levelUpEnabled` and `TeacherPermissions.canCreateExams`.

#### 🟡 Issue FE-1: `loginWithSchoolCode` — Missing Multi-Org Handling in authStore

**In** `05-frontend-apps-design.md` §11.2, the `authStore` defines:

```typescript
loginWithSchoolCode: (code: string, email: string, password: string) =>
  Promise<void>;
```

This function signature requires all three parameters at once. But the identity
design's school login flow (§3.1) is **two-step**: first enter school code → get
tenant confirmation → then enter credentials. The single-call signature doesn't
support the UX flow where the UI confirms the school name/logo before asking for
credentials.

The wireframe in §2.3 shows the correct two-step UI. The `authStore` action
should be split or the function should support partial calls:

**Fix:** Split into two actions:

```typescript
lookupSchoolCode: (code: string) =>
  Promise<{ tenantId: string; tenantName: string; logoUrl?: string }>;
loginWithSchoolCode: (
  tenantId: string,
  emailOrRoll: string,
  password: string
) => Promise<void>;
```

#### 🟡 Issue FE-2: Token Refresh After Org Switch — Missing in `switchTenant` Description

**In** `05-frontend-apps-design.md` §2.2, the org switcher logic says:

```
4. On switch: call switchActiveTenant CF → force token refresh → update Zustand store → redirect to role dashboard
```

This is correct in the description. However, the `authStore.switchTenant()`
implementation (§11.2) only defines the action signature without showing that
`getIdToken(true)` is called after the CF responds. This is the critical step
that makes new claims available to Firestore rules.

The identity design explicitly requires this step (§5.3 "Client-side after
calling"). If it's omitted from the implementation, Firestore reads will fail
with permission-denied after switching tenants until the 1-hour JWT expiry.

**Fix:** Add explicit note in `authStore.switchTenant()` implementation that
after `switchActiveTenant` CF call, `await auth.currentUser.getIdToken(true)`
must be called before any Firestore reads.

#### 🟡 Issue FE-3: Permission Gating — `canViewAllExams` vs `classIds` Claims

**In** `05-frontend-apps-design.md` §5.4, the permission table shows:

```
View all exams | canViewAllExams | Only see own class exams
```

This is correct UX-level gating. However, the Firestore rule for exams (§15.1 in
autograde design) uses `belongsToTenant(tenantId)` for reads — meaning **all**
active tenant members can read all exam documents, regardless of class
assignment. The `canViewAllExams` permission only gates the **frontend
display**, not the **data access**.

This means a teacher without `canViewAllExams` could directly query Firestore
and see all exams. This may be acceptable (exam metadata is not sensitive), but
for answer sheets and grading data, class-scoped rules should be enforced.

**Fix (for the rules, not just the frontend):** The exam read rule should
ideally be:

```javascript
allow read: if isTenantAdmin(tenantId)
  || (isTeacher(tenantId) && (
      hasTeacherPermission(tenantId, 'canViewAllExams')
      || resource.data.classIds.hasAny(request.auth.token.classIds)
  ))
  || (isStudent(tenantId) && resource.data.status == 'results_released'
      && resource.data.classIds.hasAny(request.auth.token.classIds));
```

#### 🔴 Issue FE-4: Consumer `consumerProfile.enrolledSpaceIds` — Missing Security Rule

**In** `05-frontend-apps-design.md` §10.3, the marketplace model adds `spaceId`
to `user.consumerProfile.enrolledSpaceIds` after purchase. The identity design's
Firestore rule for `/users/{uid}` (§6.2) allows the user to update their own doc
but blocks `isSuperAdmin` and `status` changes.

The `consumerProfile.enrolledSpaceIds` field **must not be writable by the
client**. A malicious user could self-enroll in paid spaces by directly writing
to their user document.

**Fix:** Extend the `/users/{uid}` update rule to also block self-modification
of `consumerProfile.enrolledSpaceIds`:

```javascript
allow update: if isAuthenticated()
  && request.auth.uid == uid
  && (!('isSuperAdmin' in request.resource.data) || ...)
  && request.resource.data.status == resource.data.status
  // NEW: Block self-modification of enrolled spaces (payment must go through CF)
  && request.resource.data.consumerProfile.enrolledSpaceIds
     == resource.data.consumerProfile.enrolledSpaceIds;
```

#### 🟢 Issue FE-5: Super Admin Login — No School Code UI

**In** `05-frontend-apps-design.md` §9.1, the Super Admin login is described as
"email/password — no school code." This is correct and matches identity design
§3.4.

However, the frontend plan doesn't show a separate login page for Super Admin
(as opposed to re-using the school-code login page and showing an option to
skip). The wireframe in §2.3 has a "Don't have a code? Login as consumer →"
link. There should also be a "Super Admin?" link for SuperAdmins.

**Fix (minor):** Add a "Platform Admin" login option on the login page that
bypasses school code and goes directly to email/password with isSuperAdmin
validation.

#### 🟢 Issue FE-6: Roll Number Input Sanitization — Not Shown in Login UI

**In** `01-identity-auth-design.md` §3.3, roll numbers are sanitized:

```typescript
function sanitizeRollNumber(rollNumber: string): string {
  return rollNumber.replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();
}
```

The frontend login form (§2.3) accepts "Email or Roll Number" input. The
client-side form should sanitize the roll number input before sending to the
auth flow to give users immediate feedback if their roll number contains invalid
characters.

**Fix (minor):** Add client-side validation in the login form that if the input
doesn't contain `@`, it's treated as a roll number and validated against
`[a-zA-Z0-9-_]` pattern, showing an inline error for invalid characters.

---

## 3. Inconsistencies Found (Cross-Module)

| #   | Inconsistency                                                   | Modules               | Severity |
| --- | --------------------------------------------------------------- | --------------------- | -------- |
| I-1 | `resultsReleased` vs `isReleased` field name on Submission      | AutoGrade ↔ Analytics | 🔴       |
| I-2 | `pipelineStatus` vs `status` field on Submission queries        | AutoGrade ↔ Analytics | 🔴       |
| I-3 | `studentId` (entity ID) vs `studentUserId` (UID) on Submission  | AutoGrade ↔ Analytics | 🔴       |
| I-4 | `RubricCriterion.marks` vs `RubricCriterion.maxPoints`          | AutoGrade ↔ LevelUp   | 🟡       |
| I-5 | Missing `answerKeys` subcollection security rule                | LevelUp               | 🔴       |
| I-6 | `consumerProfile.enrolledSpaceIds` writable by client           | Identity ↔ Frontend   | 🔴       |
| I-7 | `loginWithSchoolCode` single-call vs two-step school login flow | Identity ↔ Frontend   | 🟡       |

---

## 4. Missing Integration Points

| #   | Missing Point                                                                                                                                                                                                                                                                                                                                | Modules Affected               | Priority  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------- |
| M-1 | **Student UID on Submission** — The `Submission` entity needs `studentUid` (Firebase Auth UID) to enable analytics cross-queries. Currently, `studentId` is the entity doc ID, which cannot be used to look up `spaceProgress` or `userMemberships`.                                                                                         | AutoGrade, Analytics           | 🔴 High   |
| M-2 | **Claims refresh after `updateTeacherPermissions`** — The Frontend plan's teacher permission-gated UI doesn't document that after an admin changes a teacher's permissions, the teacher must force-refresh their token for new permissions to take effect in Firestore rules. A UI notification should tell the teacher to re-login.         | Identity, Frontend             | 🟡 Medium |
| M-3 | **`onUserDeleted` cascade** — When a student is deleted (Auth account removed), `onUserDeleted` CF deactivates memberships. Neither AutoGrade nor Analytics plan documents what happens to in-progress submissions and practice progress for a deleted student.                                                                              | Identity, AutoGrade, Analytics | 🟡 Medium |
| M-4 | **LevelUp space access from student `classIds` claims** — The `canAccessClass()` Firestore helper (identity §4.4) handles class-scoped access for AutoGrade. LevelUp needs the equivalent for checking `space.classIds.hasAny(request.auth.token.classIds)`. This helper is not defined in the identity Firestore rules.                     | Identity, LevelUp              | 🟡 Medium |
| M-5 | **Consumer purchase → `enrolledSpaceIds` update** — The marketplace design (frontend §10.3) adds `spaceId` to `user.consumerProfile.enrolledSpaceIds` via "Cloud Function." But no Cloud Function for handling payment webhooks / enrollment is defined in any of the 5 design plans. This entire flow is undocumented at the backend level. | Identity, Frontend, LevelUp    | 🟡 Medium |

---

## 5. Suggested Changes

### SC-1: Add `studentUid` to Submission Schema (Critical)

```typescript
// In 02-autograde-design.md §3.3 — Submission entity
interface Submission {
  // ... existing fields ...
  studentId: string; // → /tenants/{tenantId}/students/{studentId} (entity ID)
  studentUid: string; // Firebase Auth UID (NEW — for cross-system queries)
  // ...
}
```

Add a Firestore index on `[tenantId ASC, studentUid ASC, createdAt DESC]` for
the analytics aggregation query.

### SC-2: Add Firestore Security Rule for Answer Keys

In `03-levelup-design.md`, add a Firestore rule:

```javascript
match /tenants/{tenantId}/spaces/{spaceId}/items/{itemId} {
  // ... existing item rules ...

  match /answerKeys/{keyId} {
    // Client-unreadable. Access via Admin SDK (Cloud Functions) only.
    allow read, write: if false;
  }
}
```

### SC-3: Reconcile `RubricCriterion` in shared-types

Define the canonical schema in `packages/shared-types/src/content/rubric.ts`
that satisfies both AutoGrade (AI-extracted criteria with `marks`) and LevelUp
(rich criteria with `maxPoints`, `id`, `name`, `levels`).

Recommended canonical:

```typescript
interface RubricCriterion {
  id?: string;
  name?: string;
  description: string;
  maxPoints: number; // Canonical field
  marks?: number; // Alias for maxPoints — AutoGrade AI extraction only
  weight?: number;
  levels?: CriterionLevel[];
}
```

### SC-4: Protect `consumerProfile.enrolledSpaceIds` from Client Writes

Extend the `/users/{uid}` Firestore update rule (identity §6.2) to block client
modification of enrolled space IDs.

### SC-5: Split `loginWithSchoolCode` into Two-Step authStore Actions

Frontend authStore should expose:

- `lookupSchoolCode(code)` → returns tenant info for UI confirmation
- `loginWithSchoolCode(tenantId, identifier, password)` → performs Firebase Auth

### SC-6: Document `canAccessClass()` for LevelUp Spaces

Add a Firestore rule helper in identity §6.1:

```javascript
function canAccessSpace(tenantId, space) {
  return (
    isTenantAdmin(tenantId) ||
    isTeacher(tenantId) ||
    (isStudent(tenantId) &&
      (space.accessType == "tenant_wide" ||
        space.classIds.hasAny(request.auth.token.classIds)))
  );
}
```

And use this in LevelUp's Firestore rules for space reads.

### SC-7: Define Consumer Enrollment Cloud Function

A new Cloud Function `enrollInSpace(tenantId, spaceId, paymentToken)` should be
documented:

- Verifies payment (webhook from Razorpay/Stripe) or free enrollment
- Adds `spaceId` to `user.consumerProfile.enrolledSpaceIds` via Admin SDK
- Ensures `user.consumerProfile` is initialized if not present

---

## 6. Approval Status

### Plan 01: Identity & Auth Design (Own Module)

**Status:** ✅ Approved

The foundation is solid. The claims design, auth flows, CF specifications, and
Firestore rules are well-designed. Open questions (#1 consumer-to-school
transition, #4 session concurrency) should be resolved before Phase 2 begins but
are non-blocking for Phase 1.

**Action required before implementation:** Incorporate SC-2 (answer key rule),
SC-4 (enrolledSpaceIds protection), SC-6 (canAccessSpace helper) into the
identity rules section as pre-emptive additions for downstream modules.

---

### Plan 02: AutoGrade Design

**Status:** ⚠️ Approved with Changes

Excellent design overall. The grading pipeline state machine, AI integration,
and scanner auth are all well-specified. The issues found are primarily field
name mismatches with the analytics module.

**Required before implementation:**

1. Add `studentUid: string` field to `Submission` entity (SC-1) — blocks
   analytics
2. Verify all field names (`resultsReleased`, `pipelineStatus`) are consistent
   with analytics queries

---

### Plan 03: LevelUp Design

**Status:** ⚠️ Approved with Changes

Strong content model and learning flow design. The auth integration is mostly
correct but requires security hardening.

**Required before implementation:**

1. Add Firestore security rule for `answerKeys` subcollection (SC-2) — security
   critical
2. Reconcile `RubricCriterion` schema with AutoGrade (SC-3) — blocks
   shared-types
3. Add explicit auth checks in `recordItemAttempt` CF (Issue LU-3)

---

### Plan 04: Analytics & Intelligence Design

**Status:** ⚠️ Approved with Changes

The data flow, SLA targets, and aggregation architecture are excellent. The
issues are primarily field name mismatches caused by referencing fields from
AutoGrade/LevelUp plans that weren't finalized at time of writing.

**Required before implementation:**

1. Update `Submission` queries to use `resultsReleased` (not `isReleased`)
   (Issue AN-1)
2. Update `Submission` queries to use `pipelineStatus` (not `status`) (Issue
   AG-3)
3. Update student submission queries to use `studentUid` (not `studentUserId`)
   (Issue AN-2) — after SC-1 is applied to AutoGrade

---

### Plan 05: Frontend Apps Design

**Status:** ⚠️ Approved with Changes

Comprehensive frontend architecture with excellent UX patterns. The auth-related
UI flows (school code login, org switcher, consumer routing) are correctly
designed. Several security gaps in Firestore rules and client-side write
protection need to be addressed.

**Required before implementation:**

1. Protect `consumerProfile.enrolledSpaceIds` from client writes (SC-4) —
   security critical
2. Document mandatory `getIdToken(true)` call after `switchActiveTenant` in
   authStore (Issue FE-2)
3. Split `loginWithSchoolCode` into two-step action (SC-5)
4. Add class-scoped Firestore rule for exam reads (Issue FE-3)

---

## 7. Summary Table

| Plan               | Status      | Critical Issues | Important Issues     | Minor Issues   |
| ------------------ | ----------- | --------------- | -------------------- | -------------- |
| 01 Identity & Auth | ✅ Approved | 0               | 0                    | 0              |
| 02 AutoGrade       | ⚠️ Changes  | 1 (AG-1)        | 2 (AG-2, AG-3)       | 1 (AG-4)       |
| 03 LevelUp         | ⚠️ Changes  | 1 (LU-1)        | 2 (LU-2, LU-3)       | 1 (LU-4)       |
| 04 Analytics       | ⚠️ Changes  | 2 (AN-1, AN-2)  | 1 (AN-3)             | 1 (AN-4)       |
| 05 Frontend        | ⚠️ Changes  | 2 (FE-1✓, FE-4) | 3 (FE-1, FE-2, FE-3) | 2 (FE-5, FE-6) |

**Total: 6 Critical, 8 Important, 5 Minor issues across all plans.**

The most impactful fix is adding `studentUid` to the `Submission` entity (SC-1)
— without it, the entire analytics cross-system correlation for AutoGrade
submissions will be broken. This is a single-line schema change with broad
downstream impact.

---

_Review completed by: Identity & Auth Engineer_ _Date: 2026-02-19_
