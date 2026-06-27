# Phase 2A: Tenant Operations - Cloud Functions Implementation Report

**Date:** 2026-02-24

---

## Overview

Built the server-side Cloud Functions layer for full tenant entity lifecycle
management. This phase covers all Firebase Callable Functions and Firestore
Triggers needed to create, update, delete, query, and relate the core tenant
entities: Classes, Students, Teachers, Parents, and Academic Sessions. All
functions are deployed in the `asia-south1` region using Firebase Functions v2,
and all write operations are guarded by the `assertTenantAdminOrSuperAdmin`
authorization helper.

---

## 1. Files Created / Modified

### New Files Created (21)

| File Path                                                    | Description                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `packages/shared-types/src/tenant/class.ts`                  | `Class` interface — entity definition for tenant classes                           |
| `packages/shared-types/src/tenant/student.ts`                | `Student` interface — entity definition for tenant students                        |
| `packages/shared-types/src/tenant/teacher.ts`                | `Teacher` interface — entity definition for tenant teachers                        |
| `packages/shared-types/src/tenant/parent.ts`                 | `Parent` interface — entity definition for tenant parents                          |
| `packages/shared-types/src/tenant/academic-session.ts`       | `AcademicSession` interface — entity definition for academic sessions              |
| `packages/shared-types/src/tenant/index.ts`                  | Barrel re-export for all tenant entity types                                       |
| `functions/identity/src/callable/create-class.ts`            | Callable: create a class within a tenant                                           |
| `functions/identity/src/callable/update-class.ts`            | Callable: update class fields (name, grade, section, teachers, students)           |
| `functions/identity/src/callable/delete-class.ts`            | Callable: soft-delete (archive) a class                                            |
| `functions/identity/src/callable/list-classes.ts`            | Callable: list active classes for any tenant member                                |
| `functions/identity/src/callable/create-student.ts`          | Callable: create student profile + membership + custom claims                      |
| `functions/identity/src/callable/update-student.ts`          | Callable: update student profile fields                                            |
| `functions/identity/src/callable/delete-student.ts`          | Callable: soft-delete (archive) a student                                          |
| `functions/identity/src/callable/assign-student-to-class.ts` | Callable: atomically link a student to a class (Firestore transaction)             |
| `functions/identity/src/callable/create-teacher.ts`          | Callable: create teacher profile + membership + custom claims                      |
| `functions/identity/src/callable/update-teacher.ts`          | Callable: update teacher profile fields                                            |
| `functions/identity/src/callable/assign-teacher-to-class.ts` | Callable: atomically link a teacher to a class (Firestore batch)                   |
| `functions/identity/src/callable/create-parent.ts`           | Callable: create parent profile within a tenant                                    |
| `functions/identity/src/callable/link-parent-to-student.ts`  | Callable: atomically link a parent and student bidirectionally (Firestore batch)   |
| `functions/identity/src/callable/create-academic-session.ts` | Callable: create an academic session; enforces single-current constraint           |
| `functions/identity/src/callable/update-academic-session.ts` | Callable: update academic session; enforces single-current constraint on promotion |
| `functions/identity/src/triggers/on-class-deleted.ts`        | Firestore trigger: clean up student/teacher references when a class is archived    |
| `functions/identity/src/triggers/on-student-deleted.ts`      | Firestore trigger: clean up parent/class references when a student is archived     |

### Files Modified (2)

| File Path                            | Change Summary                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `packages/shared-types/src/index.ts` | Added re-exports for all five tenant entity types via the new `tenant/index.ts` barrel     |
| `functions/identity/src/index.ts`    | Exported all 15 new callable functions and 2 new Firestore triggers under grouped comments |

---

## 2. Shared Types Defined

All types live under `packages/shared-types/src/tenant/` and are exported from
the package root. All use `FirestoreTimestamp` (imported from
`../identity/user`) for date fields.

### `Class`

Collection path: `/tenants/{tenantId}/classes/{classId}`

| Field               | Type                     | Notes                                                    |
| ------------------- | ------------------------ | -------------------------------------------------------- |
| `id`                | `string`                 | Firestore document ID                                    |
| `tenantId`          | `string`                 | Parent tenant reference                                  |
| `name`              | `string`                 | Display name of the class                                |
| `grade`             | `string`                 | Grade/year level                                         |
| `section`           | `string?`                | Optional section/division (A, B, etc.)                   |
| `academicSessionId` | `string?`                | Optional link to an AcademicSession                      |
| `teacherIds`        | `string[]`               | IDs of assigned teacher profiles                         |
| `studentIds`        | `string[]`               | IDs of enrolled student profiles                         |
| `studentCount`      | `number`                 | Denormalized count kept in sync with `studentIds.length` |
| `status`            | `'active' \| 'archived'` | Soft-delete flag                                         |
| `createdAt`         | `FirestoreTimestamp`     | Server timestamp                                         |
| `updatedAt`         | `FirestoreTimestamp`     | Server timestamp                                         |

---

### `Student`

Collection path: `/tenants/{tenantId}/students/{studentId}`

| Field             | Type                     | Notes                                     |
| ----------------- | ------------------------ | ----------------------------------------- |
| `id`              | `string`                 | Firestore document ID                     |
| `tenantId`        | `string`                 | Parent tenant reference                   |
| `uid`             | `string`                 | Firebase Auth UID of the student user     |
| `rollNumber`      | `string?`                | School roll number                        |
| `section`         | `string?`                | Class section                             |
| `classIds`        | `string[]`               | IDs of classes the student is enrolled in |
| `parentIds`       | `string[]`               | IDs of linked parent profiles             |
| `grade`           | `string?`                | Grade/year level                          |
| `admissionNumber` | `string?`                | School admission number                   |
| `dateOfBirth`     | `string?`                | ISO date string                           |
| `status`          | `'active' \| 'archived'` | Soft-delete flag                          |
| `createdAt`       | `FirestoreTimestamp`     | Server timestamp                          |
| `updatedAt`       | `FirestoreTimestamp`     | Server timestamp                          |

---

### `Teacher`

Collection path: `/tenants/{tenantId}/teachers/{teacherId}`

| Field         | Type                     | Notes                                      |
| ------------- | ------------------------ | ------------------------------------------ |
| `id`          | `string`                 | Firestore document ID                      |
| `tenantId`    | `string`                 | Parent tenant reference                    |
| `uid`         | `string`                 | Firebase Auth UID of the teacher user      |
| `subjects`    | `string[]`               | Subjects taught                            |
| `designation` | `string?`                | Job title/role (e.g. "Head of Department") |
| `classIds`    | `string[]`               | IDs of classes the teacher is assigned to  |
| `status`      | `'active' \| 'archived'` | Soft-delete flag                           |
| `createdAt`   | `FirestoreTimestamp`     | Server timestamp                           |
| `updatedAt`   | `FirestoreTimestamp`     | Server timestamp                           |

---

### `Parent`

Collection path: `/tenants/{tenantId}/parents/{parentId}`

| Field             | Type                     | Notes                                |
| ----------------- | ------------------------ | ------------------------------------ |
| `id`              | `string`                 | Firestore document ID                |
| `tenantId`        | `string`                 | Parent tenant reference              |
| `uid`             | `string`                 | Firebase Auth UID of the parent user |
| `childStudentIds` | `string[]`               | IDs of linked student profiles       |
| `status`          | `'active' \| 'archived'` | Soft-delete flag                     |
| `createdAt`       | `FirestoreTimestamp`     | Server timestamp                     |
| `updatedAt`       | `FirestoreTimestamp`     | Server timestamp                     |

---

### `AcademicSession`

Collection path: `/tenants/{tenantId}/academicSessions/{sessionId}`

| Field       | Type                     | Notes                                                     |
| ----------- | ------------------------ | --------------------------------------------------------- |
| `id`        | `string`                 | Firestore document ID                                     |
| `tenantId`  | `string`                 | Parent tenant reference                                   |
| `name`      | `string`                 | Display name (e.g. "2024–25")                             |
| `startDate` | `FirestoreTimestamp`     | Start of the academic year                                |
| `endDate`   | `FirestoreTimestamp`     | End of the academic year                                  |
| `isCurrent` | `boolean`                | Whether this is the active session; enforced as singleton |
| `status`    | `'active' \| 'archived'` | Soft-delete flag                                          |
| `createdAt` | `FirestoreTimestamp`     | Server timestamp                                          |
| `updatedAt` | `FirestoreTimestamp`     | Server timestamp                                          |

---

## 3. Cloud Functions Created

All callable functions use `onCall({ region: 'asia-south1' })` from Firebase
Functions v2. Write operations require the caller to be a TenantAdmin for the
given tenant, or a SuperAdmin.

### Class Functions (4)

#### `createClass`

- **Purpose:** Create a new class document within a tenant.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    name: string;       // required
    grade: string;      // required
    section?: string;
    academicSessionId?: string;
    teacherIds?: string[];
  }
  ```
- **Output:** `{ classId: string }`
- **Side effects:** Increments `tenants/{tenantId}.stats.totalClasses` by 1.
- **Validation:** Tenant must exist and be `active`. `name` and `grade` are
  required.

---

#### `updateClass`

- **Purpose:** Update mutable fields on an existing class document.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    classId: string;    // required
    name?: string;
    grade?: string;
    section?: string;
    academicSessionId?: string;
    teacherIds?: string[];
    studentIds?: string[];
  }
  ```
- **Output:** `{ success: true }`
- **Side effects:** When `studentIds` is provided, `studentCount` is
  recalculated as `studentIds.length`.
- **Validation:** Class document must exist.

---

#### `deleteClass`

- **Purpose:** Soft-delete a class by setting its `status` to `'archived'`.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    classId: string;
  }
  ```
- **Output:** `{ success: true }`
- **Side effects:** Decrements `tenants/{tenantId}.stats.totalClasses` by 1.
  Triggers `onClassDeleted` Firestore trigger asynchronously.
- **Validation:** Class document must exist.

---

#### `listClasses`

- **Purpose:** Return all active classes for a tenant. Supports optional grade
  filter.
- **Auth:** Any user with an active membership in the tenant (or SuperAdmin).
  Read-only, so does not require TenantAdmin.
- **Input:**
  ```ts
  { tenantId: string; grade?: string; }
  ```
- **Output:** `{ classes: Class[] }`
- **Query:** `status == 'active'`, with optional `grade == data.grade` equality
  filter.

---

### Student Functions (4)

#### `createStudent`

- **Purpose:** Create a student entity profile, a `userMemberships` document,
  and set Firebase Auth custom claims for the student user.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    uid: string;            // required — Firebase Auth UID
    rollNumber?: string;
    section?: string;
    classId?: string;       // if provided, student is immediately added to class
    grade?: string;
    admissionNumber?: string;
    dateOfBirth?: string;   // ISO date string
  }
  ```
- **Output:** `{ studentId: string }`
- **Side effects:**
  - Creates `tenants/{tenantId}/students/{studentId}` document.
  - Creates `userMemberships/{uid}_{tenantId}` document with `role: 'student'`
    and `joinSource: 'admin_created'`.
  - Sets Firebase Auth custom claims via `buildClaimsForMembership` (includes
    `studentId`, `classIds`, `classIdsOverflow`).
  - If `classId` is provided, adds `studentId` to `classes/{classId}.studentIds`
    and increments `studentCount`.
- **Validation:** Tenant must be active. `uid` is required.

---

#### `updateStudent`

- **Purpose:** Update mutable profile fields on an existing student document.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    studentId: string;  // required
    rollNumber?: string;
    section?: string;
    classIds?: string[];
    parentIds?: string[];
    grade?: string;
    admissionNumber?: string;
    dateOfBirth?: string;
  }
  ```
- **Output:** `{ success: true }`
- **Validation:** Student document must exist.

---

#### `deleteStudent`

- **Purpose:** Soft-delete a student by setting `status` to `'archived'`.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    studentId: string;
  }
  ```
- **Output:** `{ success: true }`
- **Side effects:** Triggers `onStudentDeleted` Firestore trigger asynchronously
  to clean up class and parent back-references.
- **Validation:** Student document must exist.

---

#### `assignStudentToClass`

- **Purpose:** Atomically link a student to a class using a Firestore
  transaction to prevent double-counting.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    studentId: string;
    classId: string;
  }
  ```
- **Output:** `{ success: true }`
- **Side effects (transactional):**
  - Adds `classId` to `students/{studentId}.classIds` via `arrayUnion`.
  - Adds `studentId` to `classes/{classId}.studentIds` via `arrayUnion`.
  - Increments `classes/{classId}.studentCount` only if student was not already
    in the array (idempotency guard).
- **Validation:** Both student and class documents must exist.

---

### Teacher Functions (3)

#### `createTeacher`

- **Purpose:** Create a teacher entity profile, a `userMemberships` document,
  and set Firebase Auth custom claims.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    uid: string;            // required — Firebase Auth UID
    subjects?: string[];
    designation?: string;
    classIds?: string[];
  }
  ```
- **Output:** `{ teacherId: string }`
- **Side effects:**
  - Creates `tenants/{tenantId}/teachers/{teacherId}` document.
  - Creates `userMemberships/{uid}_{tenantId}` document with `role: 'teacher'`,
    `joinSource: 'admin_created'`, and `DEFAULT_TEACHER_PERMISSIONS` merged with
    provided `classIds`.
  - Sets Firebase Auth custom claims via `buildClaimsForMembership` (includes
    `teacherId`, `classIds`, `classIdsOverflow`).
- **Validation:** Tenant must be active. `uid` is required.

---

#### `updateTeacher`

- **Purpose:** Update mutable profile fields on an existing teacher document.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    teacherId: string;  // required
    subjects?: string[];
    designation?: string;
    classIds?: string[];
  }
  ```
- **Output:** `{ success: true }`
- **Validation:** Teacher document must exist.

---

#### `assignTeacherToClass`

- **Purpose:** Atomically link a teacher to a class using a Firestore batch
  write.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    teacherId: string;
    classId: string;
  }
  ```
- **Output:** `{ success: true }`
- **Side effects (batch):**
  - Adds `classId` to `teachers/{teacherId}.classIds` via `arrayUnion`.
  - Adds `teacherId` to `classes/{classId}.teacherIds` via `arrayUnion`.
- **Validation:** Both teacher and class documents must exist before batch is
  committed.

---

### Parent Functions (2)

#### `createParent`

- **Purpose:** Create a parent entity profile within a tenant.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    uid: string;                // required — Firebase Auth UID
    childStudentIds?: string[];
  }
  ```
- **Output:** `{ parentId: string }`
- **Side effects:** Creates `tenants/{tenantId}/parents/{parentId}` document.
- **Validation:** Tenant must be active. `uid` is required.
- **Note:** Does not create a `userMemberships` document — parent membership
  setup is handled separately by `createOrgUser`. This function records the
  parent entity profile only.

---

#### `linkParentToStudent`

- **Purpose:** Atomically create a bidirectional parent-student relationship
  using a Firestore batch write.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    parentId: string;
    studentId: string;
  }
  ```
- **Output:** `{ success: true }`
- **Side effects (batch):**
  - Adds `studentId` to `parents/{parentId}.childStudentIds` via `arrayUnion`.
  - Adds `parentId` to `students/{studentId}.parentIds` via `arrayUnion`.
- **Validation:** Both parent and student documents must exist before batch is
  committed.

---

### Academic Session Functions (2)

#### `createAcademicSession`

- **Purpose:** Create an academic session. If `isCurrent: true`, unsets the flag
  on all other sessions in the same tenant before setting the new one as
  current.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    name: string;       // required
    startDate: string;  // required — ISO date string, converted to Firestore Timestamp
    endDate: string;    // required — ISO date string, converted to Firestore Timestamp
    isCurrent?: boolean;
  }
  ```
- **Output:** `{ sessionId: string }`
- **Side effects:** If `isCurrent` is true, queries all existing sessions with
  `isCurrent == true` and unsets them in the same batch that creates the new
  session, guaranteeing atomicity of the singleton constraint.
- **Validation:** Tenant must be active. `name`, `startDate`, and `endDate` are
  all required.

---

#### `updateAcademicSession`

- **Purpose:** Update fields on an existing academic session. If
  `isCurrent: true` is passed, atomically promotes it to current while demoting
  the previous current session.
- **Auth:** `assertTenantAdminOrSuperAdmin`
- **Input:**
  ```ts
  {
    tenantId: string;
    sessionId: string;              // required
    name?: string;
    startDate?: string;             // ISO date string
    endDate?: string;               // ISO date string
    isCurrent?: boolean;
    status?: 'active' | 'archived';
  }
  ```
- **Output:** `{ success: true }`
- **Side effects:** When `isCurrent: true`, finds all sessions with
  `isCurrent == true` (excluding the target session) and unsets them in a batch
  alongside the target session update.
- **Validation:** Session document must exist.

---

## 4. Firestore Triggers Created

### `onClassDeleted`

- **Trigger:** `onDocumentUpdated` on `tenants/{tenantId}/classes/{classId}`
- **Condition:** Fires only when `before.status !== 'archived'` and
  `after.status === 'archived'` (status change to archived).
- **Purpose:** Cleans up back-references to the archived class from all linked
  students and teachers.
- **Logic:**
  1. Reads `after.studentIds` and `after.teacherIds` from the archived class
     document.
  2. Builds a list of all student and teacher document refs.
  3. Removes `classId` from each document's `classIds` array using `arrayRemove`
     in batched writes.
  4. Processes refs in chunks of 450 to stay safely under Firestore's
     500-operations-per-batch limit.
- **Error handling:** Wrapped in try/catch; errors are logged but do not
  re-throw (trigger failure does not surface to the client).

---

### `onStudentDeleted`

- **Trigger:** `onDocumentUpdated` on `tenants/{tenantId}/students/{studentId}`
- **Condition:** Fires only when `before.status !== 'archived'` and
  `after.status === 'archived'` (status change to archived).
- **Purpose:** Cleans up back-references to the archived student from all linked
  parents and classes.
- **Logic:**
  1. Reads `after.parentIds` and `after.classIds` from the archived student
     document.
  2. For each parent, removes `studentId` from `childStudentIds` via
     `arrayRemove`.
  3. For each class, removes `studentId` from `studentIds` via `arrayRemove` and
     decrements `studentCount` by 1.
  4. All operations grouped as `[ref, updateData]` pairs and processed in chunks
     of 450.
- **Error handling:** Wrapped in try/catch; errors are logged but do not
  re-throw.

---

## 5. Authorization Utilities Used

These shared utilities in `functions/identity/src/utils/` are used by the new
functions:

### `assertTenantAdminOrSuperAdmin(callerUid, tenantId)`

- Throws `HttpsError('unauthenticated')` if `callerUid` is undefined.
- Passes immediately if the caller's `User.isSuperAdmin` is `true`.
- Otherwise verifies the caller has an active `userMembership` with
  `role: 'tenantAdmin'` for the given `tenantId`.
- Throws `HttpsError('permission-denied')` if neither condition is met.

### `buildClaimsForMembership(membership: UserMembership): PlatformClaims`

- Constructs the minimal custom claims payload burned into the Firebase Auth
  JWT.
- For `teacher` and `student` roles: includes `classIds` (truncated to
  `MAX_CLAIM_CLASS_IDS`) and sets `classIdsOverflow: true` if the full list
  exceeds the limit.
- For `parent` role: includes `parentId` and `studentIds`.
- Claims are role-specific; `tenantAdmin` role has no class-level claims since
  it has full tenant access.

### `getMembership(uid, tenantId)` / `getUser(uid)` / `getTenant(tenantId)`

- Thin Firestore read helpers used for auth and tenant validation across all
  callable functions.

---

## 6. Design Decisions

### D1: Soft-Delete Pattern Throughout

All delete operations set `status: 'archived'` rather than removing documents.
This preserves historical data, avoids orphaned foreign-key references (e.g., a
submission referencing a deleted student), and allows UI filtering on
`status == 'active'`. Hard deletes are intentionally omitted from Phase 2A.

### D2: Firestore Triggers for Referential Cleanup

Rather than cleaning up back-references synchronously in the delete callable
(which would block the client response and risk timeouts on large classes),
cleanup is delegated to `onDocumentUpdated` triggers. The triggers fire
asynchronously and handle arbitrarily large reference lists via chunked batches.

### D3: Transaction for `assignStudentToClass`, Batch for `assignTeacherToClass` and `linkParentToStudent`

`assignStudentToClass` uses a full Firestore transaction because it must read
`class.studentIds` to check for idempotency (and only increment `studentCount`
if not already assigned). The teacher and parent assignment operations do not
require a read-before-write, so a lighter batch write is used instead.

### D4: Single-Current Constraint for Academic Sessions Enforced on Write

Rather than a Firestore trigger or a unique index (which Firestore does not
support), the `isCurrent` singleton constraint is enforced within
`createAcademicSession` and `updateAcademicSession` themselves. When
`isCurrent: true` is requested, both functions query for existing current
sessions and unset them in the same atomic batch, ensuring no two sessions
within a tenant ever have `isCurrent: true` simultaneously.

### D5: Custom Claims Set Immediately on `createStudent` and `createTeacher`

When a student or teacher entity is created, the function immediately merges new
Firebase Auth custom claims onto the user's existing claims. This means the user
can make authorized requests (scoped by their new role and classIds) on their
very next token refresh, without waiting for a separate claims-update step.

### D6: `listClasses` Accessible to All Tenant Members, Not Just Admins

All roles (tenantAdmin, teacher, student, parent) may need to query the classes
collection — teachers to see their assigned classes, students to see their
enrolled classes, parents to view their child's class. `listClasses` verifies
only that an active membership exists in the tenant, not that the caller is an
admin. All write operations remain admin-only.

### D7: Tenant Stat Counters on Create/Delete

`createClass` increments `stats.totalClasses` and `deleteClass` decrements it
using `FieldValue.increment()` rather than reading the current count and writing
back, making the counter update atomic and race-condition-safe.

### D8: `createParent` Does Not Create a Membership

Unlike `createStudent` and `createTeacher`, `createParent` only writes the
entity profile document. Parent membership creation (Firebase Auth user +
`userMemberships` document + custom claims) is handled upstream by
`createOrgUser`, which covers the full user onboarding flow. `createParent` is
called after `createOrgUser` to record the parent profile metadata separately.

### D9: Batch Limit of 450 in Triggers

Firestore transactions and batch writes support a maximum of 500 operations.
Triggers use a conservative chunk size of 450 to leave headroom for any
additional implicit Firestore writes and to avoid hitting the limit on edge-case
documents.

---

## 7. Build Status

### TypeScript Compilation

```
functions/identity $ node_modules/.bin/tsc --noEmit
(no output — 0 errors)
```

**Result: Clean.** All 21 new source files and the modified `index.ts` pass
TypeScript compilation with zero errors.

### Exports Verified

All new functions are exported from `functions/identity/src/index.ts` under
named group comments:

```
// Firestore triggers
onClassDeleted, onStudentDeleted

// Callable functions - Class CRUD
createClass, updateClass, deleteClass, listClasses

// Callable functions - Student CRUD
createStudent, updateStudent, deleteStudent, assignStudentToClass

// Callable functions - Teacher CRUD
createTeacher, updateTeacher, assignTeacherToClass

// Callable functions - Parent CRUD
createParent, linkParentToStudent

// Callable functions - Academic Session
createAcademicSession, updateAcademicSession
```

### Deploy Command

```bash
firebase deploy --only functions:identity
```
