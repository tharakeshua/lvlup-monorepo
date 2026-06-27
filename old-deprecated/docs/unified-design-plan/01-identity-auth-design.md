# Identity & Authentication Module — Design Plan

## Unified LevelUp + AutoGrade B2B SaaS Platform

**Version:** 1.1 **Date:** 2026-02-23 **Author:** Identity & Auth Engineer
**Status:** Design Plan — Review Fixes Applied, Ready for Implementation
**References:**

- `docs/UNIFIED-ARCHITECTURE-BLUEPRINT.md` (sections 3.2, 5, 8)
- `docs/BLUEPRINT-REVIEW-RESPONSES-AND-EXTENSIONS.md` (sections 1.1, 1.2,
  3.1-3.3)
- `docs/phase3a-unified-user-auth.md`

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Entity Schemas](#2-entity-schemas)
3. [Auth Flow Designs](#3-auth-flow-designs)
4. [Custom Claims Design](#4-custom-claims-design)
5. [Cloud Function Specifications](#5-cloud-function-specifications)
6. [Firestore Security Rules](#6-firestore-security-rules)
7. [Bulk CSV Student Import Pipeline](#7-bulk-csv-student-import-pipeline)
8. [Multi-Org Switcher Design](#8-multi-org-switcher-design)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Testing Strategy](#10-testing-strategy)
11. [Dependencies on Other Modules](#11-dependencies-on-other-modules)
12. [Open Questions](#12-open-questions)

---

## 1. Overview & Scope

### What This Module Owns

The Identity & Auth module is the foundation layer of the unified platform. It
provides:

- **User identity**: Single Firebase Auth UID per person, platform-wide
  `/users/{uid}` profile
- **Multi-tenant membership**: `/userMemberships/{uid}_{tenantId}` linking users
  to schools with roles
- **Tenant management**: `/tenants/{tenantId}` CRUD for schools/institutions
- **Tenant code uniqueness**: `/tenantCodes/{code}` atomic uniqueness index
- **Auth flows**: School-code login, consumer login, roll-number login,
  multi-org switching
- **Custom claims**: Slim JWT claims for Firestore rule evaluation
- **Cloud Functions**: Auth lifecycle hooks and admin operations
- **Bulk import**: CSV student/teacher import with automatic Auth account
  creation
- **Firestore security rules**: Identity-layer collections protection

### What This Module Does NOT Own

- Tenant-scoped content (spaces, exams, submissions) — owned by Content &
  Assessment module
- AI/LLM infrastructure — owned by AI module
- Progress tracking & analytics — owned by Progress module
- Frontend app shells and routing — owned by Frontend module

### Design Decisions (Confirmed)

| Decision               | Choice                                               | Rationale                                                            |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Claims classIds source | `permissions.managedClassIds`                        | Explicit admin control; avoids syncing entity doc classIds to claims |
| Org switch mechanism   | Cloud Function + claims update + token refresh       | Secure; claims enable fast-path Firestore rule checks                |
| CSV import auth        | Immediate Auth account creation with synthetic email | Students can log in immediately; consistent identity model           |
| Migration              | None — fresh build                                   | No legacy data migration; greenfield implementation                  |
| Tenant naming          | `Tenant` (not Organization/Client)                   | Standard SaaS term per ADR-001                                       |
| Roll number email      | `{rollNumber}@{tenantId}.levelup.internal`           | Uses immutable tenantId, not mutable tenantCode                      |
| Claims size cap        | 15 classIds max, overflow flag                       | Stays within 1000-byte JWT limit                                     |

---

## 2. Entity Schemas

### 2.1 `/users/{uid}` — UnifiedUser (Platform Identity)

```typescript
interface UnifiedUser {
  uid: string; // Firebase Auth UID = document ID
  email?: string; // Primary email (from Auth)
  phone?: string; // Phone number
  authProviders: AuthProvider[]; // ['email', 'phone', 'google', 'apple']

  displayName: string; // Full display name
  firstName?: string;
  lastName?: string;
  photoURL?: string;

  // Consumer-specific (LevelUp B2C)
  country?: string;
  age?: number;
  grade?: string; // Self-reported grade level
  onboardingCompleted?: boolean;
  preferences?: Record<string, unknown>;

  // Platform flags
  isSuperAdmin: boolean; // Set only via Cloud Function
  consumerProfile?: ConsumerProfile;

  // Lifecycle
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLogin?: Timestamp;
  status: "active" | "suspended" | "deleted";
}

interface ConsumerProfile {
  plan: "free" | "pro" | "premium";
  enrolledSpaceIds: string[]; // Public/purchased space references
}

type AuthProvider = "email" | "phone" | "google" | "apple";
```

**Key rules:**

- Document ID = Firebase Auth UID (deterministic lookup)
- No role or tenantId stored here — those live in `userMemberships`
- `isSuperAdmin` can only be set via Admin SDK (Cloud Function)
- Consumer fields are optional/nullable for school users

### 2.2 `/userMemberships/{uid}_{tenantId}` — UserMembership (Role Bridge)

```typescript
interface UserMembership {
  id: string; // "${uid}_${tenantId}"
  uid: string; // Firebase Auth UID
  tenantId: string; // Tenant document ID
  tenantCode: string; // Cached for login verification display

  role: TenantRole;
  status: "active" | "inactive" | "suspended";
  joinSource: "admin_created" | "bulk_import" | "invite_code" | "self_register";

  // Links to role-specific entity docs (only one set per membership)
  teacherId?: string; // → /tenants/{tenantId}/teachers/{teacherId}
  studentId?: string; // → /tenants/{tenantId}/students/{studentId}
  parentId?: string; // → /tenants/{tenantId}/parents/{parentId}
  scannerId?: string; // → /scanners/{scannerId}
  schoolId?: string; // If multi-campus

  // Granular permissions (teacher-specific)
  permissions?: TeacherPermissions;

  // Parent-specific: teacher who is also a parent in same tenant
  parentLinkedStudentIds?: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActive?: Timestamp;
}

type TenantRole =
  | "superAdmin"
  | "tenantAdmin"
  | "teacher"
  | "student"
  | "parent"
  | "scanner";

interface TeacherPermissions {
  canCreateExams?: boolean;
  canEditRubrics?: boolean;
  canManuallyGrade?: boolean;
  canViewAllExams?: boolean;
  canCreateSpaces?: boolean;
  canManageContent?: boolean;
  canViewAnalytics?: boolean;
  canConfigureAgents?: boolean;
  managedSpaceIds?: string[];
  managedClassIds?: string[]; // SOURCE for claims classIds
}
```

**Key rules:**

- Composite key `{uid}_{tenantId}` enforces one role per tenant per user
- `permissions.managedClassIds` is the source of truth for claims `classIds`
- Teacher-parent edge case handled via `parentLinkedStudentIds` (no dual
  membership)
- All writes go through Admin SDK (Cloud Functions only)

**Default teacher permissions (on creation):**

```typescript
const DEFAULT_TEACHER_PERMISSIONS: TeacherPermissions = {
  canCreateExams: true,
  canEditRubrics: true,
  canManuallyGrade: true,
  canViewAllExams: false,
  canCreateSpaces: false,
  canManageContent: false,
  canViewAnalytics: false,
  canConfigureAgents: false,
  managedSpaceIds: [],
  managedClassIds: [],
};
```

### 2.3 `/tenants/{tenantId}` — Tenant (School/Institution)

```typescript
interface Tenant {
  id: string;
  name: string;
  shortName?: string;
  slug: string; // URL-friendly
  description?: string;
  tenantCode: string; // Unique login code (e.g., "SPR001")
  ownerUid: string; // Primary admin Firebase UID

  contactEmail: string;
  contactPhone?: string;
  contactPerson?: string;
  logoUrl?: string;
  bannerUrl?: string;
  website?: string;
  address?: TenantAddress;

  status: "active" | "suspended" | "trial" | "expired";

  subscription: TenantSubscription;
  features: TenantFeatures;
  settings: TenantSettings;
  stats: TenantStats;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TenantAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

interface TenantSubscription {
  plan: "trial" | "basic" | "premium" | "enterprise";
  expiresAt?: Timestamp;
  maxStudents?: number;
  maxTeachers?: number;
  maxSpaces?: number;
  maxExamsPerMonth?: number;
}

interface TenantFeatures {
  autoGradeEnabled: boolean;
  levelUpEnabled: boolean;
  scannerAppEnabled: boolean;
  aiChatEnabled: boolean;
  aiGradingEnabled: boolean;
  analyticsEnabled: boolean;
  parentPortalEnabled: boolean;
  bulkImportEnabled: boolean;
  apiAccessEnabled: boolean;
}

interface TenantSettings {
  geminiKeyRef?: string; // Secret Manager reference path
  geminiKeySet: boolean; // Whether a Gemini API key is configured
  defaultEvaluationSettingsId?: string;
  defaultAiModel?: string;
  timezone?: string;
  locale?: string;
  gradingPolicy?: string;
}

interface TenantStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSpaces: number;
  totalExams: number;
  activeStudentsLast30Days?: number;
}
```

### 2.4 `/tenantCodes/{code}` — Tenant Code Uniqueness Index

```typescript
interface TenantCodeIndex {
  tenantId: string; // References /tenants/{tenantId}
  createdAt: Timestamp;
}
```

**Purpose:** Atomic uniqueness enforcement for tenant codes. Created in a
transaction with the tenant document. The document ID is the tenant code itself
(e.g., `/tenantCodes/SPR001`).

### 2.5 Firebase Auth Custom Claims — PlatformClaims

```typescript
interface PlatformClaims {
  role?: TenantRole; // Active role in current tenant
  tenantId?: string; // Active tenant ID
  tenantCode?: string; // Active tenant code (for display)
  teacherId?: string; // If role is teacher
  studentId?: string; // If role is student
  parentId?: string; // If role is parent
  scannerId?: string; // If role is scanner
  classIds?: string[]; // From permissions.managedClassIds (max 15)
  classIdsOverflow?: boolean; // True if user has >15 classes
  studentIds?: string[]; // Parent's linked children
}
```

**Size budget (1000 bytes max):**

| Field                   | Estimated Size | Notes                  |
| ----------------------- | -------------- | ---------------------- |
| `role`                  | ~15 bytes      | Longest: "tenantAdmin" |
| `tenantId`              | ~25 bytes      | Firestore auto-ID      |
| `tenantCode`            | ~15 bytes      | Short code             |
| `teacherId/studentId`   | ~25 bytes      | Only one set           |
| `classIds` (15 entries) | ~400 bytes     | 15 \* ~25 chars        |
| `classIdsOverflow`      | ~25 bytes      | Boolean field          |
| `studentIds` (parent)   | ~150 bytes     | Max ~5 children        |
| JSON overhead           | ~100 bytes     | Keys, braces, quotes   |
| **Total estimate**      | **~755 bytes** | Within 1000-byte limit |

---

## 3. Auth Flow Designs

### 3.1 School User Login (B2B)

Used by: TenantAdmin, Teacher, Student, Parent

```
┌─────────────────────────────────────────────────────────────────┐
│                     SCHOOL LOGIN FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Enter School Code                                     │
│  ┌─────────────────────┐                                       │
│  │  School Code: [____] │                                      │
│  └──────────┬──────────┘                                       │
│             │                                                   │
│             ▼                                                   │
│  Query: /tenantCodes/{code}                                    │
│    ├─ NOT FOUND → Show "School not found" error                │
│    └─ FOUND → Get tenantId → Read /tenants/{tenantId}          │
│                 │                                               │
│                 ▼                                               │
│  Show tenant name + logo for confirmation                      │
│                                                                 │
│  Step 2: Enter Credentials                                     │
│  ┌─────────────────────────────┐                               │
│  │  Email or Roll Number: [___] │                              │
│  │  Password: [___]             │                              │
│  └──────────┬──────────────────┘                               │
│             │                                                   │
│             ▼                                                   │
│  Is input an email?                                            │
│    ├─ YES → Use email directly                                 │
│    └─ NO  → Derive: {rollNumber}@{tenantId}.levelup.internal   │
│             │                                                   │
│             ▼                                                   │
│  Firebase Auth: signInWithEmailAndPassword(email, password)    │
│    ├─ FAIL → Show "Invalid credentials" error                  │
│    └─ OK   → Get uid from auth result                          │
│               │                                                 │
│               ▼                                                 │
│  Step 3: Resolve Membership                                    │
│  Query: /userMemberships/{uid}_{tenantId}                      │
│    ├─ NOT FOUND → Show "No access to this school" error        │
│    ├─ status != 'active' → Show "Account suspended" error      │
│    └─ FOUND + active → Extract role                            │
│                          │                                      │
│                          ▼                                      │
│  Step 4: Check Multi-Org                                       │
│  Query: /userMemberships where uid == auth.uid, status='active'│
│    ├─ 1 membership → Auto-select, proceed                     │
│    └─ 2+ memberships → Show org picker (see §8)               │
│                          │                                      │
│                          ▼                                      │
│  Step 5: Set Context                                           │
│  - If claims stale → call switchActiveTenant CF                │
│  - Force token refresh: getIdToken(true)                       │
│  - Set Zustand store: { tenantId, role, membership }           │
│  - Navigate to role-specific dashboard                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation notes:**

- School code lookup uses `/tenantCodes/{code}` (O(1) read) not a `where` query
- Roll number detection: if input does not contain `@`, treat as roll number
- After login, always verify membership exists for the selected tenant
- Claims may be stale from previous session — check and refresh if `tenantId`
  doesn't match

### 3.2 Consumer Login (B2C)

Used by: Individual learners not affiliated with any school

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONSUMER LOGIN FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Option A: Email/Password                                      │
│  ┌─────────────────────┐                                       │
│  │  Email: [___]        │                                      │
│  │  Password: [___]     │                                      │
│  └──────────┬──────────┘                                       │
│             ▼                                                   │
│  signInWithEmailAndPassword(email, password)                   │
│                                                                 │
│  Option B: Social Login                                        │
│  ┌─────────────────────┐                                       │
│  │  [Sign in w/ Google] │                                      │
│  │  [Sign in w/ Apple]  │                                      │
│  └──────────┬──────────┘                                       │
│             ▼                                                   │
│  signInWithPopup(provider)                                     │
│                                                                 │
│  On Auth Success:                                              │
│    Read /users/{uid}                                           │
│    ├─ NOT FOUND → New user (onUserCreated trigger creates doc) │
│    │              → Redirect to onboarding flow                │
│    └─ FOUND → Check consumerProfile                            │
│               ├─ Has consumerProfile → Load consumer dashboard │
│               └─ No consumerProfile → Check userMemberships    │
│                    ├─ Has memberships → Redirect to school app │
│                    └─ No memberships → Set up consumer profile │
│                                                                 │
│  NO school code needed. NO claims update needed.               │
│  Consumer identity determined by: no active memberships +      │
│  consumerProfile present on /users/{uid}                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Roll Number Login (Students)

```
┌─────────────────────────────────────────────────────────────────┐
│                  ROLL NUMBER LOGIN FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Student enters:                                               │
│    School Code: "SPR001"                                       │
│    Roll Number: "2024035"                                      │
│    Password: "********"                                        │
│                                                                 │
│  System derives:                                               │
│    1. Look up tenantId from /tenantCodes/SPR001                │
│       → tenantId = "ten_abc123"                                │
│                                                                 │
│    2. Derive synthetic email:                                  │
│       "2024035@ten_abc123.levelup.internal"                    │
│                                                                 │
│    3. signInWithEmailAndPassword(syntheticEmail, password)      │
│                                                                 │
│  Why tenantId not tenantCode?                                  │
│    - tenantId is immutable (Firestore doc ID)                  │
│    - tenantCode can change (school rebranding)                 │
│    - Eliminates collision risk entirely                        │
│                                                                 │
│  Student NEVER sees the synthetic email. UI shows:             │
│    "Roll Number" and "School Code" fields only.               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Edge cases:**

- Roll number with special characters: sanitize to alphanumeric + hyphens before
  email derivation
- Student changes school: old synthetic email becomes invalid; new account
  created at new school
- Student has both real email AND roll number: real email takes priority for
  login; roll number login is the fallback

### 3.4 SuperAdmin Login

```
SuperAdmin logs in with standard email/password.
No school code needed.

Identity marker:
  /users/{uid}.isSuperAdmin == true
  Custom claims: { role: 'superAdmin' } (no tenantId)

Setting isSuperAdmin:
  - Initial SuperAdmin seeded via one-time Cloud Function init script
  - Additional SuperAdmins created only by existing SuperAdmin
  - Firestore rules BLOCK any client write to isSuperAdmin field
```

---

## 4. Custom Claims Design

### 4.1 Claims Philosophy

Claims are the **hot path** for Firestore security rules. They contain the
absolute minimum needed to evaluate read/write permissions without additional
Firestore lookups.

**What goes in claims:**

- `role` — needed for every rule check
- `tenantId` — needed for tenant-scoping every rule
- `classIds` (capped at 15) — needed for class-scoped content access
- Entity IDs — needed for "own data" checks

**What stays in Firestore (NOT in claims):**

- Full permissions object — too volatile, too large
- All tenant memberships list — too large for multi-org users
- Detailed profile data — not needed for rule evaluation

### 4.2 Claims Setting Logic

```typescript
const MAX_CLAIM_CLASS_IDS = 15;

async function buildClaimsForMembership(
  membership: UserMembership
): Promise<PlatformClaims> {
  const classIds = membership.permissions?.managedClassIds ?? [];

  const claims: PlatformClaims = {
    role: membership.role,
    tenantId: membership.tenantId,
    tenantCode: membership.tenantCode,
  };

  // Set role-specific entity ID
  switch (membership.role) {
    case "teacher":
      claims.teacherId = membership.teacherId;
      claims.classIds = classIds.slice(0, MAX_CLAIM_CLASS_IDS);
      claims.classIdsOverflow = classIds.length > MAX_CLAIM_CLASS_IDS;
      break;
    case "student":
      claims.studentId = membership.studentId;
      claims.classIds = classIds.slice(0, MAX_CLAIM_CLASS_IDS);
      claims.classIdsOverflow = classIds.length > MAX_CLAIM_CLASS_IDS;
      break;
    case "parent":
      claims.parentId = membership.parentId;
      claims.studentIds = membership.parentLinkedStudentIds ?? [];
      break;
    case "scanner":
      claims.scannerId = membership.scannerId;
      break;
    case "tenantAdmin":
      // TenantAdmin has full access — no classIds needed
      break;
  }

  return claims;
}
```

### 4.3 Claims Refresh Triggers

| Event                         | Action                              | Initiator                     |
| ----------------------------- | ----------------------------------- | ----------------------------- |
| User created in org           | Set initial claims                  | `createOrgUser` CF            |
| User switches tenant          | Update claims to new tenant context | `switchActiveTenant` CF       |
| Teacher permissions updated   | Refresh claims with new classIds    | `updateTeacherPermissions` CF |
| User role changed             | Update role + entity IDs in claims  | Admin action via CF           |
| User suspended                | Clear all claims                    | Admin action via CF           |
| Student enrolled in new class | Refresh classIds in claims          | `updateStudentClasses` CF     |

### 4.4 classIds Overflow Handling

When a user has more than 15 managed classes:

```
Fast path (claims): classIds in token, checked first
  ↓ miss
Slow path (Firestore): read userMemberships doc, check permissions.managedClassIds
  ↓
Result: allow/deny
```

Firestore rule implementation:

```javascript
function canAccessClass(tenantId, classId) {
  // Fast path: check claims (no Firestore read)
  return request.auth.token.classIds.hasAny([classId])
    // Slow path: Firestore read (only if overflow flag set)
    || (request.auth.token.classIdsOverflow == true
        && exists(/databases/$(database)/documents/userMemberships/$(request.auth.uid)_$(tenantId))
        && get(/databases/$(database)/documents/userMemberships/$(request.auth.uid)_$(tenantId))
            .data.permissions.managedClassIds.hasAny([classId]));
}
```

---

## 5. Cloud Function Specifications

### 5.1 `onUserCreated` — Auth Trigger

| Property      | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| **Trigger**   | `functions.auth.user().onCreate`                                       |
| **Runs when** | Any new Firebase Auth account is created                               |
| **Input**     | Firebase `UserRecord` (uid, email, displayName, photoURL, phoneNumber) |
| **Output**    | Creates `/users/{uid}` document                                        |
| **Errors**    | Log and continue (non-blocking)                                        |

```typescript
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const userDoc: UnifiedUser = {
    uid: user.uid,
    email: user.email ?? null,
    phone: user.phoneNumber ?? null,
    authProviders: [determineProvider(user)],
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "",
    firstName: null,
    lastName: null,
    photoURL: user.photoURL ?? null,
    isSuperAdmin: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastLogin: FieldValue.serverTimestamp(),
    status: "active",
  };

  await admin.firestore().doc(`users/${user.uid}`).set(userDoc);
});

function determineProvider(user: admin.auth.UserRecord): AuthProvider {
  if (user.providerData.some((p) => p.providerId === "google.com"))
    return "google";
  if (user.providerData.some((p) => p.providerId === "apple.com"))
    return "apple";
  if (user.phoneNumber) return "phone";
  return "email";
}
```

### 5.2 `createOrgUser` — Callable Function

| Property         | Value                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| **Trigger**      | `functions.https.onCall`                                                                          |
| **Caller**       | TenantAdmin (or SuperAdmin)                                                                       |
| **Auth check**   | Caller must have `role: 'tenantAdmin'` for target tenant, or `isSuperAdmin`                       |
| **Input**        | `{ tenantId, role, email?, rollNumber?, firstName, lastName, password?, classIds?, ...roleData }` |
| **Output**       | `{ uid, entityId, membershipId }`                                                                 |
| **Side effects** | Creates: Auth account, /users/{uid}, role entity doc, userMembership, sets claims                 |

```typescript
interface CreateOrgUserRequest {
  tenantId: string;
  role: "tenantAdmin" | "teacher" | "student" | "parent" | "scanner";
  email?: string;
  rollNumber?: string; // For students without email
  firstName: string;
  lastName: string;
  password?: string; // If not provided, generate temp password
  phone?: string;
  classIds?: string[]; // For teacher/student class assignment
  subjects?: string[]; // For teachers
  linkedStudentIds?: string[]; // For parents
}

export const createOrgUser = functions.https.onCall(async (data, context) => {
  // 1. AUTH CHECK
  const callerUid = context.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const callerMembership = await getMembership(callerUid, data.tenantId);
  const callerUser = await getUser(callerUid);
  if (!callerUser?.isSuperAdmin && callerMembership?.role !== "tenantAdmin") {
    throw new HttpsError(
      "permission-denied",
      "Must be TenantAdmin or SuperAdmin"
    );
  }

  // 2. VALIDATE TENANT
  const tenant = await getTenant(data.tenantId);
  if (!tenant || tenant.status !== "active") {
    throw new HttpsError("not-found", "Tenant not found or inactive");
  }

  // 3. DETERMINE EMAIL
  let email = data.email;
  if (!email && data.rollNumber) {
    email = `${sanitizeRollNumber(data.rollNumber)}@${data.tenantId}.levelup.internal`;
  }
  if (!email)
    throw new HttpsError("invalid-argument", "Email or roll number required");

  const password = data.password ?? generateTempPassword();

  // 4. CREATE FIREBASE AUTH ACCOUNT
  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${data.firstName} ${data.lastName}`,
    });
  } catch (err: any) {
    if (err.code === "auth/email-already-exists") {
      // User exists — look up by email, create membership only
      userRecord = await admin.auth().getUserByEmail(email);
    } else {
      throw new HttpsError("internal", `Auth creation failed: ${err.message}`);
    }
  }

  // 5. CREATE ROLE-SPECIFIC ENTITY DOC
  const entityRef = await createRoleEntity(data.tenantId, data.role, {
    authUid: userRecord.uid,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email, // Store real email, not synthetic
    phone: data.phone,
    rollNumber: data.rollNumber,
    classIds: data.classIds ?? [],
    subjects: data.subjects ?? [],
    linkedStudentIds: data.linkedStudentIds ?? [],
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 6. CREATE USER MEMBERSHIP
  const membershipId = `${userRecord.uid}_${data.tenantId}`;
  const membership: UserMembership = {
    id: membershipId,
    uid: userRecord.uid,
    tenantId: data.tenantId,
    tenantCode: tenant.tenantCode,
    role: data.role,
    status: "active",
    joinSource: "admin_created",
    [`${data.role}Id`]: entityRef.id,
    permissions:
      data.role === "teacher"
        ? {
            ...DEFAULT_TEACHER_PERMISSIONS,
            managedClassIds: data.classIds ?? [],
          }
        : undefined,
    parentLinkedStudentIds:
      data.role === "parent" ? data.linkedStudentIds : undefined,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await admin
    .firestore()
    .doc(`userMemberships/${membershipId}`)
    .set(membership);

  // 7. SET CUSTOM CLAIMS
  const claims = await buildClaimsForMembership(membership);
  await admin.auth().setCustomUserClaims(userRecord.uid, claims);

  // 8. UPDATE TENANT STATS
  await updateTenantStats(data.tenantId, data.role, "increment");

  return { uid: userRecord.uid, entityId: entityRef.id, membershipId };
});
```

### 5.3 `switchActiveTenant` — Callable Function

| Property         | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| **Trigger**      | `functions.https.onCall`                                  |
| **Caller**       | Any authenticated user                                    |
| **Auth check**   | Caller must have an active membership for target tenant   |
| **Input**        | `{ tenantId: string }`                                    |
| **Output**       | `{ success: true, role: string }`                         |
| **Side effects** | Updates custom claims, updates `lastActive` on membership |

```typescript
export const switchActiveTenant = functions.https.onCall(
  async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Must be logged in");

    const { tenantId } = data;
    if (!tenantId)
      throw new HttpsError("invalid-argument", "tenantId required");

    // 1. VALIDATE MEMBERSHIP
    const membershipRef = admin
      .firestore()
      .doc(`userMemberships/${uid}_${tenantId}`);
    const membershipDoc = await membershipRef.get();

    if (!membershipDoc.exists) {
      throw new HttpsError(
        "permission-denied",
        "No membership for this tenant"
      );
    }

    const membership = membershipDoc.data() as UserMembership;
    if (membership.status !== "active") {
      throw new HttpsError("permission-denied", "Membership is not active");
    }

    // 2. VALIDATE TENANT IS ACTIVE
    const tenant = await getTenant(tenantId);
    if (
      !tenant ||
      tenant.status === "suspended" ||
      tenant.status === "expired"
    ) {
      throw new HttpsError("failed-precondition", "Tenant is not active");
    }

    // 3. BUILD AND SET CLAIMS
    const claims = await buildClaimsForMembership(membership);
    await admin.auth().setCustomUserClaims(uid, claims);

    // 4. UPDATE LAST ACTIVE
    await membershipRef.update({
      lastActive: FieldValue.serverTimestamp(),
    });

    return { success: true, role: membership.role };
  }
);
```

**Client-side after calling:**

```typescript
// Force token refresh to pick up new claims
await firebase.auth().currentUser!.getIdToken(/* forceRefresh */ true);
// Update Zustand store
setActiveTenant(tenantId, membership);
// Navigate to role dashboard
navigateToDashboard(membership.role);
```

### 5.4 `onUserDeleted` — Auth Trigger

| Property      | Value                                              |
| ------------- | -------------------------------------------------- |
| **Trigger**   | `functions.auth.user().onDelete`                   |
| **Runs when** | Firebase Auth account is deleted                   |
| **Input**     | Firebase `UserRecord`                              |
| **Output**    | Soft-deletes user doc, deactivates all memberships |

```typescript
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const batch = admin.firestore().batch();

  // 1. SOFT-DELETE USER DOC
  const userRef = admin.firestore().doc(`users/${user.uid}`);
  batch.update(userRef, {
    status: "deleted",
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 2. DEACTIVATE ALL MEMBERSHIPS
  const membershipsQuery = await admin
    .firestore()
    .collection("userMemberships")
    .where("uid", "==", user.uid)
    .get();

  for (const doc of membershipsQuery.docs) {
    batch.update(doc.ref, {
      status: "inactive",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  // 3. UPDATE TENANT STATS (outside batch for simplicity)
  for (const doc of membershipsQuery.docs) {
    const m = doc.data() as UserMembership;
    await updateTenantStats(m.tenantId, m.role, "decrement");
  }
});
```

**Downstream cascade handling:** When a user is deleted and memberships are
deactivated, downstream modules should handle orphaned data:

| Module        | Affected Data                                                    | Handling                                                                                                                                                              |
| ------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AutoGrade** | In-progress submissions (`pipelineStatus` != `results_released`) | Submissions remain in their current state. Grading pipeline continues if already started. Results are preserved for teacher/admin review. No auto-cleanup.            |
| **Analytics** | Student progress summaries, leaderboard entries                  | Progress summaries remain (historical data). Leaderboard entries marked stale on next refresh cycle. The `name` field may persist until the next leaderboard rebuild. |
| **LevelUp**   | Space progress (`spaceProgress` docs)                            | Progress docs remain (historical data). Active timed test sessions are abandoned (no auto-submit).                                                                    |

Downstream modules should listen for membership `status` changes (via Firestore
triggers on `userMemberships`) rather than relying solely on `onUserDeleted`,
since soft-delete (membership deactivation) is more common than hard-delete.

```

```

### 5.5 `updateTeacherPermissions` — Callable Function

| Property         | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| **Trigger**      | `functions.https.onCall`                                             |
| **Caller**       | TenantAdmin (or SuperAdmin)                                          |
| **Input**        | `{ tenantId, teacherUid, permissions: Partial<TeacherPermissions> }` |
| **Output**       | `{ success: true }`                                                  |
| **Side effects** | Updates membership permissions, refreshes claims if classIds changed |

```typescript
export const updateTeacherPermissions = functions.https.onCall(
  async (data, context) => {
    // Auth check: caller must be tenantAdmin or superAdmin
    const callerUid = context.auth?.uid;
    await assertTenantAdminOrSuperAdmin(callerUid, data.tenantId);

    const { tenantId, teacherUid, permissions } = data;
    const membershipRef = admin
      .firestore()
      .doc(`userMemberships/${teacherUid}_${tenantId}`);
    const membershipDoc = await membershipRef.get();

    if (!membershipDoc.exists || membershipDoc.data()?.role !== "teacher") {
      throw new HttpsError("not-found", "Teacher membership not found");
    }

    const currentMembership = membershipDoc.data() as UserMembership;
    const currentPerms = currentMembership.permissions ?? {};

    // Merge permissions
    const updatedPerms: TeacherPermissions = {
      ...currentPerms,
      ...permissions,
    };

    // Update membership
    await membershipRef.update({
      permissions: updatedPerms,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Refresh claims if classIds changed
    const classIdsChanged =
      JSON.stringify(currentPerms.managedClassIds) !==
      JSON.stringify(updatedPerms.managedClassIds);

    if (classIdsChanged) {
      const updatedMembership = {
        ...currentMembership,
        permissions: updatedPerms,
      };
      const claims = await buildClaimsForMembership(updatedMembership);
      await admin.auth().setCustomUserClaims(teacherUid, claims);
    }

    return { success: true, claimsRefreshed: classIdsChanged };
  }
);
```

**Important — Claims refresh notification:** After an admin changes a teacher's
permissions, the teacher's JWT claims may be stale (cached up to 1 hour). The
Cloud Function returns `claimsRefreshed: true` when classIds changed. The
frontend must handle this:

1. If the **admin** is updating permissions for a teacher who is currently
   **online**, send a real-time notification (e.g., Firestore listener on
   `/userMemberships/{uid}_{tenantId}`) telling the teacher to refresh.
2. The teacher's client should call `getIdToken(true)` when it receives the
   notification, or display a banner: _"Your permissions were updated. Click
   here to refresh."_
3. Until the teacher refreshes, Firestore rules relying on `classIds` claims may
   deny access to newly assigned classes.

```

```

### 5.6 `setTenantApiKey` — Callable Function

| Property         | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| **Trigger**      | `functions.https.onCall`                                           |
| **Caller**       | TenantAdmin                                                        |
| **Input**        | `{ tenantId, apiKey: string }`                                     |
| **Output**       | `{ success: true }`                                                |
| **Side effects** | Stores key in Secret Manager, updates tenant.settings.geminiKeyRef |

```typescript
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const secretClient = new SecretManagerServiceClient();

export const setTenantApiKey = functions.https.onCall(async (data, context) => {
  await assertTenantAdminOrSuperAdmin(context.auth?.uid, data.tenantId);

  const { tenantId, apiKey } = data;
  if (!apiKey || apiKey.length < 10) {
    throw new HttpsError("invalid-argument", "Invalid API key");
  }

  const secretId = `tenant-${tenantId}-gemini`;
  const parent = `projects/${process.env.GCLOUD_PROJECT}`;

  try {
    // Try to create the secret (first time)
    await secretClient.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  } catch (err: any) {
    if (err.code !== 6) throw err; // 6 = ALREADY_EXISTS, which is fine
  }

  // Add new version with the key
  await secretClient.addSecretVersion({
    parent: `${parent}/secrets/${secretId}`,
    payload: { data: Buffer.from(apiKey, "utf8") },
  });

  // Update tenant doc
  await admin.firestore().doc(`tenants/${tenantId}`).update({
    "settings.geminiKeyRef": secretId,
    "settings.geminiKeySet": true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});
```

### 5.7 `createTenant` — Callable Function

| Property         | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| **Trigger**      | `functions.https.onCall`                                               |
| **Caller**       | SuperAdmin                                                             |
| **Input**        | `{ name, tenantCode, contactEmail, ownerUid, subscription, features }` |
| **Output**       | `{ tenantId }`                                                         |
| **Side effects** | Creates tenant doc + tenantCode index atomically                       |

```typescript
export const createTenant = functions.https.onCall(async (data, context) => {
  // Only SuperAdmin can create tenants
  const callerUser = await getUser(context.auth?.uid);
  if (!callerUser?.isSuperAdmin) {
    throw new HttpsError("permission-denied", "SuperAdmin only");
  }

  const { name, tenantCode, contactEmail, ownerUid, subscription, features } =
    data;

  // ATOMIC: create tenant + tenantCode index in transaction
  const tenantRef = admin.firestore().collection("tenants").doc();
  const tenantCodeRef = admin
    .firestore()
    .doc(`tenantCodes/${tenantCode.toUpperCase()}`);

  await admin.firestore().runTransaction(async (tx) => {
    // Check uniqueness
    const existingCode = await tx.get(tenantCodeRef);
    if (existingCode.exists) {
      throw new HttpsError(
        "already-exists",
        `Tenant code "${tenantCode}" is already in use`
      );
    }

    const tenantDoc: Tenant = {
      id: tenantRef.id,
      name,
      slug: generateSlug(name),
      tenantCode: tenantCode.toUpperCase(),
      ownerUid,
      contactEmail,
      status: "active",
      subscription: subscription ?? { plan: "trial" },
      features: features ?? {
        autoGradeEnabled: true,
        levelUpEnabled: true,
        scannerAppEnabled: false,
        aiChatEnabled: false,
        aiGradingEnabled: false,
        analyticsEnabled: true,
        parentPortalEnabled: false,
        bulkImportEnabled: true,
        apiAccessEnabled: false,
      },
      settings: { geminiKeySet: false },
      stats: {
        totalStudents: 0,
        totalTeachers: 0,
        totalClasses: 0,
        totalSpaces: 0,
        totalExams: 0,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    tx.set(tenantRef, tenantDoc);
    tx.set(tenantCodeRef, {
      tenantId: tenantRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  // Create tenantAdmin membership for the owner
  if (ownerUid) {
    const membershipId = `${ownerUid}_${tenantRef.id}`;
    await admin.firestore().doc(`userMemberships/${membershipId}`).set({
      id: membershipId,
      uid: ownerUid,
      tenantId: tenantRef.id,
      tenantCode: tenantCode.toUpperCase(),
      role: "tenantAdmin",
      status: "active",
      joinSource: "admin_created",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await admin.auth().setCustomUserClaims(ownerUid, {
      role: "tenantAdmin",
      tenantId: tenantRef.id,
      tenantCode: tenantCode.toUpperCase(),
    });
  }

  return { tenantId: tenantRef.id };
});
```

---

## 6. Firestore Security Rules

### 6.1 Helper Functions

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Platform Helpers ──────────────────────────────────
    function isAuthenticated() {
      return request.auth != null;
    }

    function isSuperAdmin() {
      return isAuthenticated()
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isSuperAdmin == true;
    }

    // ── Tenant Helpers ────────────────────────────────────
    function belongsToTenant(tenantId) {
      return isAuthenticated()
        && request.auth.token.tenantId == tenantId;
    }

    function getMembership(tenantId) {
      let membershipId = request.auth.uid + '_' + tenantId;
      return get(/databases/$(database)/documents/userMemberships/$(membershipId)).data;
    }

    function hasActiveMembership(tenantId) {
      return belongsToTenant(tenantId)
        || (exists(/databases/$(database)/documents/userMemberships/$(request.auth.uid + '_' + tenantId))
            && getMembership(tenantId).status == 'active');
    }

    function hasRole(tenantId, role) {
      return belongsToTenant(tenantId)
        && request.auth.token.role == role;
    }

    function isTenantAdmin(tenantId) {
      return hasRole(tenantId, 'tenantAdmin') || isSuperAdmin();
    }

    function isTeacher(tenantId) {
      return hasRole(tenantId, 'teacher');
    }

    function isStudent(tenantId) {
      return hasRole(tenantId, 'student');
    }

    function isParent(tenantId) {
      return hasRole(tenantId, 'parent');
    }

    // ── Class Access (with overflow handling) ─────────────
    function canAccessClass(tenantId, classId) {
      return request.auth.token.classIds.hasAny([classId])
        || (request.auth.token.classIdsOverflow == true
            && getMembership(tenantId).permissions.managedClassIds.hasAny([classId]));
    }

    function hasTeacherPermission(tenantId, perm) {
      return isTeacher(tenantId)
        && getMembership(tenantId).permissions[perm] == true;
    }

    // ── Space Access (for LevelUp class-scoped spaces) ───
    function canAccessSpace(tenantId) {
      return isTenantAdmin(tenantId)
        || isTeacher(tenantId)
        || (isStudent(tenantId) && (
            resource.data.accessType == 'tenant_wide'
            || resource.data.classIds.hasAny(request.auth.token.classIds)
        ));
    }
  }
}
```

### 6.2 Identity Collection Rules

```javascript
    // ── /users/{uid} ─────────────────────────────────────
    match /users/{uid} {
      allow read: if isAuthenticated()
        && (request.auth.uid == uid || isSuperAdmin());

      allow create: if isAuthenticated()
        && request.auth.uid == uid;

      allow update: if isAuthenticated()
        && request.auth.uid == uid
        // BLOCK self-elevation to superAdmin
        && (!('isSuperAdmin' in request.resource.data)
            || request.resource.data.isSuperAdmin == resource.data.isSuperAdmin)
        // BLOCK self-status change
        && request.resource.data.status == resource.data.status
        // BLOCK self-modification of enrolled spaces (payment must go through CF)
        && (!('consumerProfile' in request.resource.data)
            || !('enrolledSpaceIds' in request.resource.data.consumerProfile)
            || request.resource.data.consumerProfile.enrolledSpaceIds
               == resource.data.consumerProfile.enrolledSpaceIds);

      allow delete: if isSuperAdmin();
    }

    // ── /userMemberships/{membershipId} ──────────────────
    match /userMemberships/{membershipId} {
      // Users can read their own memberships
      // TenantAdmins can read memberships for their tenant
      allow read: if isAuthenticated()
        && (request.auth.uid == resource.data.uid
            || isSuperAdmin());

      // ALL writes via Admin SDK (Cloud Functions) only
      allow write: if false;
    }

    // ── /tenants/{tenantId} ──────────────────────────────
    match /tenants/{tenantId} {
      allow read: if isSuperAdmin()
        || hasActiveMembership(tenantId);

      allow create: if isSuperAdmin();

      allow update: if isSuperAdmin()
        || isTenantAdmin(tenantId);

      allow delete: if isSuperAdmin();
    }

    // ── /tenantCodes/{code} ──────────────────────────────
    match /tenantCodes/{code} {
      // Anyone can read (for school-code login lookup)
      allow read: if true;

      // Only Cloud Functions write
      allow write: if false;
    }

    // ── /tenants/{tenantId}/students/{studentId} ─────────
    match /tenants/{tenantId}/students/{studentId} {
      allow read: if isSuperAdmin()
        || isTenantAdmin(tenantId)
        || isTeacher(tenantId)
        || (isStudent(tenantId) && request.auth.token.studentId == studentId)
        || (isParent(tenantId)
            && request.auth.token.studentIds.hasAny([studentId]));

      allow create, update: if isSuperAdmin()
        || isTenantAdmin(tenantId);

      allow delete: if isSuperAdmin()
        || isTenantAdmin(tenantId);
    }

    // ── /tenants/{tenantId}/teachers/{teacherId} ─────────
    match /tenants/{tenantId}/teachers/{teacherId} {
      allow read: if isSuperAdmin()
        || hasActiveMembership(tenantId);

      allow create, update: if isSuperAdmin()
        || isTenantAdmin(tenantId);

      allow delete: if isSuperAdmin()
        || isTenantAdmin(tenantId);
    }

    // ── /tenants/{tenantId}/parents/{parentId} ───────────
    match /tenants/{tenantId}/parents/{parentId} {
      allow read: if isSuperAdmin()
        || isTenantAdmin(tenantId)
        || (isParent(tenantId) && request.auth.token.parentId == parentId);

      allow create, update: if isSuperAdmin()
        || isTenantAdmin(tenantId);

      allow delete: if isSuperAdmin()
        || isTenantAdmin(tenantId);
    }

    // ── /tenants/{tenantId}/classes/{classId} ────────────
    match /tenants/{tenantId}/classes/{classId} {
      allow read: if isSuperAdmin()
        || hasActiveMembership(tenantId);

      allow create, update: if isSuperAdmin()
        || isTenantAdmin(tenantId);

      allow delete: if isSuperAdmin()
        || isTenantAdmin(tenantId);
    }

    // ── /scanners/{scannerId} ────────────────────────────
    match /scanners/{scannerId} {
      allow read: if isSuperAdmin()
        || (isAuthenticated() && resource.data.authUid == request.auth.uid);

      // Only Cloud Functions write
      allow write: if false;
    }

    // ── Answer Keys (LevelUp) — Admin SDK only ────────────
    // Pre-emptive rule for downstream module: answer keys must
    // never be client-readable during active tests.
    match /tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/answerKeys/{keyId} {
      // Client-unreadable. Access via Admin SDK (Cloud Functions) only.
      allow read, write: if false;
    }

    // ── platform_public tenant (consumer access) ─────────
    match /tenants/platform_public/spaces/{spaceId} {
      allow read: if isAuthenticated()
        && resource.data.accessType == 'public_store';
    }
```

### 6.3 RTDB Security Rules (Identity-Relevant)

```json
{
  "rules": {
    "practiceProgress": {
      "$tenantId": {
        ".read": "auth != null && auth.token.tenantId === $tenantId",
        "$userId": {
          ".write": "auth != null && auth.uid === $userId && auth.token.tenantId === $tenantId",
          ".read": "auth != null && (auth.uid === $userId || auth.token.role === 'teacher' || auth.token.role === 'tenantAdmin')"
        }
      }
    },
    "leaderboards": {
      "$tenantId": {
        ".read": "auth != null && auth.token.tenantId === $tenantId",
        ".write": false
      }
    }
  }
}
```

### 6.4 Security Rules Design Notes

- **`get()` cost**: Each `getMembership()` call in rules costs 1 Firestore read.
  Function results are cached within a single rule evaluation, so calling
  `getMembership()` twice in the same rule only costs 1 read.
- **Claims-first strategy**: Rules check `request.auth.token.*` (free, from JWT)
  before falling back to `get()` (costs a read).
- **Membership writes are server-only**: `allow write: if false` on
  `/userMemberships` — all writes go through Cloud Functions with Admin SDK.
  This prevents any client-side role escalation.
- **tenantCodes are publicly readable**: Needed for the school-code login flow.
  Contains only the mapping `code → tenantId`.

---

## 7. Bulk CSV Student Import Pipeline

### 7.1 Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              BULK CSV IMPORT PIPELINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Upload CSV (Client)                                   │
│  TenantAdmin uploads CSV file via Admin UI                     │
│  Max size: 10 MB                                               │
│  Accepted formats: .csv, .xlsx                                 │
│                                                                 │
│  Step 2: Parse & Validate (Cloud Function)                     │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ For each row:                                        │       │
│  │   - Required: firstName, lastName, rollNumber        │       │
│  │   - Optional: email, phone, classId, parentName,     │       │
│  │              parentEmail, parentPhone                 │       │
│  │   - Validate: rollNumber unique within tenant        │       │
│  │   - Validate: email format (if provided)             │       │
│  │   - Validate: classId exists in tenant               │       │
│  │   - Validate: no duplicate rollNumbers in batch      │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  Step 3: Preview & Confirm (Client)                            │
│  Show: {valid} students to create, {errors} rows with issues   │
│  Admin reviews and confirms                                    │
│                                                                 │
│  Step 4: Execute Import (Cloud Function)                       │
│  For each valid row:                                           │
│    a. Create Firebase Auth account                             │
│       - Email: row.email ?? {rollNumber}@{tenantId}.internal   │
│       - Password: generated temp password                      │
│    b. Create /tenants/{tenantId}/students/{studentId}          │
│    c. Create /userMemberships/{uid}_{tenantId}                 │
│    d. Set custom claims                                        │
│    e. If parentEmail provided:                                 │
│       - Create/find parent Auth account                        │
│       - Create parent entity + membership                      │
│       - Link student to parent                                 │
│                                                                 │
│  Step 5: Report (Client)                                       │
│  Show: {created} students, {skipped} duplicates, {errors}      │
│  Downloadable: credentials CSV (rollNumber, tempPassword)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 CSV Schema

| Column            | Required | Description                         | Validation                           |
| ----------------- | -------- | ----------------------------------- | ------------------------------------ |
| `firstName`       | Yes      | Student first name                  | Non-empty string, max 100 chars      |
| `lastName`        | Yes      | Student last name                   | Non-empty string, max 100 chars      |
| `rollNumber`      | Yes      | Roll number (unique per tenant)     | Alphanumeric + hyphens, max 20 chars |
| `email`           | No       | Student email                       | Valid email format                   |
| `phone`           | No       | Student phone                       | Valid phone format                   |
| `classId`         | No       | Class to enroll in                  | Must exist in tenant's classes       |
| `className`       | No       | Class name (alternative to classId) | Fuzzy-matched to existing classes    |
| `section`         | No       | Section identifier                  | String                               |
| `parentFirstName` | No       | Parent first name                   | Non-empty if parent fields present   |
| `parentLastName`  | No       | Parent last name                    | Non-empty if parent fields present   |
| `parentEmail`     | No       | Parent email                        | Valid email format                   |
| `parentPhone`     | No       | Parent phone                        | Valid phone format                   |

### 7.3 Cloud Function: `bulkImportStudents`

```typescript
interface BulkImportRequest {
  tenantId: string;
  students: StudentImportRow[];
  dryRun: boolean; // If true, validate only; don't create
}

interface StudentImportRow {
  firstName: string;
  lastName: string;
  rollNumber: string;
  email?: string;
  phone?: string;
  classId?: string;
  className?: string;
  section?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPhone?: string;
}

interface BulkImportResult {
  totalRows: number;
  created: number;
  skipped: number;
  errors: ImportError[];
  credentials: { rollNumber: string; password: string }[];
}

interface ImportError {
  rowIndex: number;
  rollNumber: string;
  error: string;
}
```

**Processing logic:**

1. Validate caller is TenantAdmin
2. Check tenant subscription limit: `tenant.subscription.maxStudents`
3. Batch-validate all rows (duplicates, format, class existence)
4. If `dryRun`, return validation results only
5. Process in batches of 50 (avoid Firestore batch limit of 500 operations)
6. For each batch: create Auth accounts, student docs, memberships, set claims
7. Collect credentials for download
8. Return summary report

### 7.4 Rate Limiting & Limits

| Limit                         | Value                 | Rationale                                        |
| ----------------------------- | --------------------- | ------------------------------------------------ |
| Max rows per import           | 500                   | Avoid function timeout (540s)                    |
| Max file size                 | 10 MB                 | Reasonable for CSV                               |
| Concurrent imports per tenant | 1                     | Prevent race conditions on rollNumber uniqueness |
| Temp password format          | 8 chars, alphanumeric | Balance security and usability                   |

---

## 8. Multi-Org Switcher Design

### 8.1 Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-ORG SWITCHER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Trigger: Login with 2+ active memberships                     │
│           OR user clicks org switcher in app header             │
│                                                                 │
│  Step 1: Load Memberships                                      │
│  Query: /userMemberships where uid == auth.uid, status='active'│
│  Result: [{tenantId, tenantCode, role, tenantName}, ...]       │
│                                                                 │
│  Step 2: Display Picker                                        │
│  ┌─────────────────────────────────────────┐                   │
│  │  Select Organization:                    │                   │
│  │                                          │                   │
│  │  ┌────────────────────────────────────┐  │                   │
│  │  │ 🏫 Springfield Academy (SPR001)    │  │                   │
│  │  │    Role: Teacher                   │  │                   │
│  │  └────────────────────────────────────┘  │                   │
│  │  ┌────────────────────────────────────┐  │                   │
│  │  │ 🏫 Riverside School (RVS002)       │  │                   │
│  │  │    Role: Parent                    │  │                   │
│  │  └────────────────────────────────────┘  │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
│  Step 3: User Selects                                          │
│  → Call switchActiveTenant({ tenantId: selected })             │
│  → CF updates claims                                           │
│  → Client: getIdToken(true) // force refresh                   │
│  → Update Zustand: { tenantId, role, membership }              │
│  → Navigate to role-specific dashboard                         │
│                                                                 │
│  Step 4: App Header Shows Active Org                           │
│  [🏫 Springfield Academy ▾]  ← click to open switcher         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Client-Side State Management

```typescript
// Zustand auth store
interface AuthState {
  user: UnifiedUser | null;
  currentMembership: UserMembership | null;
  allMemberships: UserMembership[];
  currentTenantId: string | null;
  loading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  loadMemberships: () => Promise<void>;
}
```

### 8.3 Edge Cases

| Scenario                                          | Handling                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| User's only membership is suspended               | Show "Account suspended" message, no access                                   |
| User switches to a tenant that was just suspended | `switchActiveTenant` CF validates tenant status, rejects                      |
| Token refresh fails after switch                  | Retry once; if still fails, force re-login                                    |
| Membership deleted while user is active           | Next Firestore read fails with permission denied; catch and redirect to login |

---

## 9. Error Handling Patterns

### 9.1 Cloud Function Error Codes

All Cloud Functions use `functions.https.HttpsError` with consistent codes:

| Code                  | When                                                   |
| --------------------- | ------------------------------------------------------ |
| `unauthenticated`     | No auth token provided                                 |
| `permission-denied`   | User lacks required role/permission                    |
| `not-found`           | Tenant, membership, or entity not found                |
| `already-exists`      | Tenant code collision, duplicate membership            |
| `invalid-argument`    | Missing or malformed input                             |
| `failed-precondition` | Tenant suspended, subscription expired, limit exceeded |
| `internal`            | Unexpected server error                                |
| `resource-exhausted`  | Rate limit or quota exceeded                           |

### 9.2 Client-Side Error Handling

```typescript
// Wrapper for calling auth Cloud Functions
async function callAuthFunction<T>(
  name: string,
  data: Record<string, unknown>
): Promise<T> {
  try {
    const fn = httpsCallable<typeof data, T>(functions, name);
    const result = await fn(data);
    return result.data;
  } catch (error: any) {
    const code = error.code ?? "unknown";
    const message = error.message ?? "An unexpected error occurred";

    switch (code) {
      case "functions/unauthenticated":
        // Force re-login
        await auth.signOut();
        throw new AuthError("Session expired. Please log in again.");

      case "functions/permission-denied":
        throw new AuthError("You do not have permission for this action.");

      case "functions/not-found":
        throw new AuthError(message);

      case "functions/already-exists":
        throw new AuthError(message);

      case "functions/failed-precondition":
        throw new AuthError(message);

      default:
        console.error(`Cloud Function error [${name}]:`, error);
        throw new AuthError("Something went wrong. Please try again.");
    }
  }
}
```

### 9.3 Claims Staleness Window

Custom claims are cached in the JWT and refresh every hour. After a
claims-changing operation:

1. Cloud Function updates claims via Admin SDK (immediate on server)
2. Client calls `getIdToken(true)` to force-refresh (immediate)
3. If client doesn't refresh, claims remain stale for up to 1 hour

**Mitigation:**

- Always force-refresh after `switchActiveTenant` and `updateTeacherPermissions`
- Firestore rules that need fresh data fall back to reading membership docs
- UI shows a "refreshing permissions" indicator during token refresh

---

## 10. Testing Strategy

### 10.1 Test Categories

| Category                  | Tool                             | Scope                                        | Coverage Target                        |
| ------------------------- | -------------------------------- | -------------------------------------------- | -------------------------------------- |
| Cloud Function unit tests | Vitest + firebase-functions-test | Each CF in isolation (mocked Firestore/Auth) | 80%+                                   |
| Firestore rule tests      | `@firebase/rules-unit-testing`   | All rule branches for identity collections   | 100% branch coverage                   |
| Integration tests         | Vitest + Firebase Emulator Suite | Full auth flows end-to-end                   | All happy paths + critical error paths |
| Claims logic tests        | Vitest                           | `buildClaimsForMembership`, overflow logic   | 100%                                   |
| CSV import tests          | Vitest                           | Validation, parsing, batch processing        | All validation rules + edge cases      |

### 10.2 Firestore Rule Test Cases

```
/users/{uid}:
  ✅ User can read own doc
  ✅ User can update own doc (non-sensitive fields)
  ❌ User cannot read other user's doc
  ❌ User cannot set isSuperAdmin to true
  ❌ User cannot change own status
  ✅ SuperAdmin can read any user doc
  ✅ SuperAdmin can delete user doc

/userMemberships/{id}:
  ✅ User can read own membership
  ❌ User cannot read another user's membership
  ❌ User cannot write to memberships (any operation)
  ✅ SuperAdmin can read any membership

/tenants/{tenantId}:
  ✅ Active member can read tenant
  ✅ TenantAdmin can update tenant
  ❌ Teacher cannot update tenant
  ❌ Non-member cannot read tenant
  ✅ SuperAdmin can CRUD tenants

/tenantCodes/{code}:
  ✅ Anyone (authenticated or not) can read
  ❌ No client can write

/tenants/{tenantId}/students/{studentId}:
  ✅ TenantAdmin can CRUD
  ✅ Teacher can read students in their tenant
  ✅ Student can read own doc
  ✅ Parent can read linked student
  ❌ Student cannot read other student
  ❌ Student cannot update any student
  ❌ Parent cannot read unlinked student
```

### 10.3 Cloud Function Test Cases

```
onUserCreated:
  ✅ Creates /users/{uid} with correct defaults
  ✅ Handles user with no email (phone auth)
  ✅ Handles user with no displayName
  ✅ Correctly detects auth provider (email, google, apple, phone)

createOrgUser:
  ✅ Creates Auth account + student + membership + claims (happy path)
  ✅ Creates teacher with default permissions
  ✅ Creates student with roll-number synthetic email
  ✅ Links existing Auth account (email already exists)
  ✅ Creates parent with linked students
  ❌ Rejects non-TenantAdmin caller
  ❌ Rejects invalid tenant
  ❌ Rejects missing required fields
  ❌ Rejects if tenant subscription limit exceeded

switchActiveTenant:
  ✅ Updates claims and returns success
  ✅ Updates lastActive timestamp
  ❌ Rejects if no membership exists
  ❌ Rejects if membership is inactive
  ❌ Rejects if tenant is suspended

updateTeacherPermissions:
  ✅ Updates permissions on membership
  ✅ Refreshes claims when classIds change
  ✅ Does NOT refresh claims when non-classId perm changes
  ❌ Rejects non-TenantAdmin caller
  ❌ Rejects if target is not a teacher

bulkImportStudents:
  ✅ Imports 50 students successfully
  ✅ Creates parent accounts when parentEmail provided
  ✅ Handles dryRun (validate only)
  ✅ Skips rows with duplicate rollNumbers
  ✅ Reports errors per row
  ❌ Rejects if exceeds subscription limit
  ❌ Rejects files over 500 rows
```

### 10.4 Integration Test Scenarios

```
Full Login Flow:
  1. Create tenant via CF
  2. Create teacher via CF
  3. Login as teacher (school code + email + password)
  4. Verify claims contain correct tenantId, role, classIds
  5. Read /tenants/{tenantId} — succeeds
  6. Read /tenants/{otherTenantId} — fails (permission denied)

Multi-Org Switch:
  1. Create 2 tenants
  2. Create user with memberships in both
  3. Login → auto-select first tenant
  4. Switch to second tenant via CF
  5. Verify claims updated
  6. Verify can read second tenant data
  7. Verify cannot read first tenant data anymore

Roll Number Login:
  1. Create tenant
  2. Bulk import student with rollNumber, no email
  3. Login with schoolCode + rollNumber + tempPassword
  4. Verify auth succeeds with synthetic email
  5. Verify membership loaded correctly

Consumer Path:
  1. Sign up via email (no school code)
  2. Verify /users/{uid} created by onUserCreated
  3. Verify zero memberships
  4. Set consumerProfile
  5. Verify can read platform_public spaces
  6. Verify cannot read any tenant data
```

---

## 11. Dependencies on Other Modules

### 11.1 This Module Provides (Downstream Dependencies)

| Consuming Module         | What They Need From Us                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Content & Assessment** | `tenantId` from claims for all scoped reads; `canAccessClass()` rule helper; teacher permission checks |
| **AI/LLM**               | `tenant.settings.geminiKeyRef` for per-tenant API key; `tenantId` for cost attribution                 |
| **Progress & Analytics** | `studentId` from claims for progress writes; `teacherId` for analytics reads                           |
| **Frontend Apps**        | Auth state (Zustand store), `useCurrentUser()`, `useCurrentMembership()`, `usePermissions()` hooks     |
| **Notifications**        | `uid` for recipient lookup; membership role for channel preferences                                    |

### 11.2 This Module Needs (Upstream Dependencies)

| Module                       | What We Need                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------ |
| **Monorepo/Infra (Phase 0)** | Firebase project setup, shared-types package, shared-services package skeleton |
| **Google Cloud**             | Secret Manager API enabled (for Gemini key storage)                            |
| **Firebase**                 | Auth, Firestore, Cloud Functions v2 configured                                 |

### 11.3 Shared Type Exports

This module defines and exports from `packages/shared-types/src/identity/`:

```
identity/
├── user.ts           — UnifiedUser, AuthProvider, ConsumerProfile
├── membership.ts     — UserMembership, TenantRole, TeacherPermissions
├── tenant.ts         — Tenant, TenantAddress, TenantSubscription, TenantFeatures, TenantSettings, TenantStats
├── claims.ts         — PlatformClaims
├── tenantCode.ts     — TenantCodeIndex
└── index.ts          — barrel export
```

---

## 12. Open Questions

| #   | Question                                    | Context                                                            | Recommendation                                                                                                         | Status                  |
| --- | ------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | **Consumer-to-school transition**           | Consumer signs up, then school creates account with same email     | Email match: link existing UID to new membership                                                                       | Needs decision          |
| 2   | **Password reset for roll-number students** | Students with synthetic emails can't receive password reset emails | TenantAdmin resets password via CF, or student uses phone OTP                                                          | Needs decision          |
| 3   | **tenantCode change (rebranding)**          | What happens when a school changes its code?                       | Update `/tenantCodes/` index atomically. Existing student synthetic emails use tenantId (immutable), so no Auth impact | Accepted approach       |
| 4   | **Session concurrency**                     | Should a user be allowed in multiple tabs with different tenants?  | Allow it — each tab tracks its own tenant context in Zustand. Claims reflect the last-switched tenant                  | Needs validation        |
| 5   | **Account deactivation vs deletion**        | TenantAdmin removes a student                                      | Soft-delete: set membership status to 'inactive', keep Auth account. Hard-delete only via SuperAdmin                   | Recommended             |
| 6   | **SuperAdmin initial seeding**              | How is the first SuperAdmin created?                               | One-time init script: `admin.auth().setCustomUserClaims(uid, {})` + set `isSuperAdmin: true` on user doc               | Accepted                |
| 7   | **Scanner auth model**                      | Device authentication                                              | Custom Token: device registers via admin, gets secret, exchanges for Firebase custom token per session                 | Decided (per blueprint) |

---

## Appendix A: Composite Indexes Required

```json
{
  "indexes": [
    {
      "collectionGroup": "userMemberships",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "userMemberships",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

## Appendix B: Utility Functions

```typescript
// Sanitize roll number for email derivation
function sanitizeRollNumber(rollNumber: string): string {
  return rollNumber.replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();
}

// Generate temporary password
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Assert caller is TenantAdmin or SuperAdmin
async function assertTenantAdminOrSuperAdmin(
  callerUid: string | undefined,
  tenantId: string
): Promise<void> {
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const callerUser = await getUser(callerUid);
  if (callerUser?.isSuperAdmin) return;

  const membership = await getMembership(callerUid, tenantId);
  if (membership?.role !== "tenantAdmin" || membership?.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "Must be TenantAdmin or SuperAdmin"
    );
  }
}
```

---

**End of Design Plan**

**Document Version:** 1.1 **Date:** 2026-02-23 **Status:** Design Plan — Review
Fixes Applied, Ready for Implementation
