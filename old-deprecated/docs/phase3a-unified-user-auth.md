# Phase 3A: Unified User & Auth Architecture

**Date:** 2026-02-19 **Status:** Architecture Design — Ready for Review
**Phase:** 3A (Data & Service Unification — Identity Foundation) **Output of
task:** `task_1771515600523_5tsr0v0un`

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [User Type Taxonomy](#2-user-type-taxonomy)
3. [Auth Flows](#3-auth-flows)
4. [Unified User Data Model](#4-unified-user-data-model)
5. [Firebase Auth: Custom Claims Design](#5-firebase-auth-custom-claims-design)
6. [Roles & Permissions Matrix](#6-roles--permissions-matrix)
7. [Multi-Org (Multi-Tenant) Membership](#7-multi-org-multi-tenant-membership)
8. [User Profile Merging: LevelUp AppUser + AutoGrade User](#8-user-profile-merging-levelup-appuser--autograde-user)
9. [Firestore Collections: Identity Layer](#9-firestore-collections-identity-layer)
10. [Firestore Security Rules Strategy](#10-firestore-security-rules-strategy)
11. [Cloud Functions: Auth Lifecycle Hooks](#11-cloud-functions-auth-lifecycle-hooks)
12. [Consumer (B2C) User Path](#12-consumer-b2c-user-path)
13. [Migration Strategy](#13-migration-strategy)
14. [Open Issues & Decisions](#14-open-issues--decisions)

---

## 1. Overview & Goals

### What We Are Building

A **single unified identity and access control system** that serves:

- **AutoGrade** (B2B, school-scoped, exam grading)
- **LevelUp** (B2C + B2B, learning content, practice, AI tutoring)

Both products share a **single Firebase project** with a **single Firebase Auth
instance**. Roles and tenant context are managed in Firestore, not just in JWT
claims.

### Design Principles

| Principle                          | Detail                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| **One user, one UID**              | A person has exactly one Firebase Auth UID across both products                          |
| **Tenant isolation first**         | All school data is strictly scoped under `organizations/{orgId}/...`                     |
| **Membership-driven roles**        | Roles are stored in Firestore `userMemberships`, not hardcoded in Auth claims            |
| **Claims for hot path only**       | Firebase custom claims carry only the minimum needed for Firestore rules (no fat claims) |
| **Consumer users are first class** | Individual B2C users (not in any school) are fully supported                             |
| **Multi-org capable**              | A single user can belong to multiple organizations with different roles                  |

### Current State Gap Analysis

| Concern              | AutoGrade Current State                                     | LevelUp Current State                                    | Gap                                          |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| User identity store  | `/users/{uid}` (slim, keyed by uid or email — inconsistent) | `/users/{uid}` (AppUser with profile data)               | Key collision if same UID, different schemas |
| Org/tenant model     | `/clients/{clientId}`                                       | `/orgs/{orgId}`                                          | Different naming and structure               |
| Role storage         | `/userMemberships/{uid}_{clientId}` + custom claims         | `/userRoles/{userId}` + `roles[]` on AppUser             | Completely different models                  |
| Multi-org membership | One user → one client (single `clientId` claim)             | One user → many orgs (via `userOrgs` + `userRoles` maps) | Need unified multi-membership                |
| Consumer users       | Not supported                                               | Primary use case                                         | Must handle both                             |
| School login flow    | School code → email/password                                | Email/password only                                      | Need to merge                                |

---

## 2. User Type Taxonomy

The unified platform has **six user types** arranged in a hierarchy:

```
Platform Level
└── SuperAdmin
    └── (manages all organizations, billing, platform ops)

Organization Level (one org = one school/institution)
├── OrgAdmin (formerly ClientAdmin in AutoGrade, orgAdmin in LevelUp)
│   └── manages users, classes, content, exams, settings, billing
├── Teacher
│   ├── creates LevelUp Spaces and AutoGrade Exams
│   ├── reviews AI-graded submissions
│   └── scoped to assigned classes
├── Student
│   ├── accesses assigned LevelUp Spaces
│   ├── views AutoGrade exam results
│   └── scoped to enrolled classes
├── Parent/Guardian
│   ├── views linked children's progress (LevelUp) and results (AutoGrade)
│   └── scoped to their linked student(s)
└── Scanner (device/operator account)
    ├── uploads answer sheets only
    └── no access to content or results

Platform Level (no org)
└── Consumer
    ├── individual learner (not in any school)
    ├── accesses public/paid LevelUp Spaces
    └── no AutoGrade access
```

### User Type Summary Table

| User Type  | School-scoped | Platform-scoped |  AutoGrade Access  |      LevelUp Access       |
| ---------- | :-----------: | :-------------: | :----------------: | :-----------------------: |
| SuperAdmin |       —       |        ✓        |  Full (all orgs)   |      Full (all orgs)      |
| OrgAdmin   |       ✓       |        —        |   Full (own org)   |      Full (own org)       |
| Teacher    |       ✓       |        —        | Scoped to classes  | Scoped to assigned spaces |
| Student    |       ✓       |        —        |  Own results only  |   Assigned spaces only    |
| Parent     |       ✓       |        —        | Children's results |    Children's progress    |
| Scanner    |       ✓       |        —        |    Upload only     |           None            |
| Consumer   |       —       |        ✓        |        None        |  Public/purchased spaces  |

---

## 3. Auth Flows

### 3.1 School User Login (B2B Flow)

Used by: OrgAdmin, Teacher, Student, Parent, Scanner

```
┌─────────────────────────────────────────────────────────┐
│                    Login Screen                          │
├─────────────────────────────────────────────────────────┤
│  [ Enter School Code ]  e.g. "SCH001"                   │
│                                                          │
│  ─── Lookup school code in /organizations ───           │
│       ↓ found → show org name/logo                      │
│       ↓ not found → "School not found" error            │
│                                                          │
│  [ Email or Roll Number ]                               │
│  [ Password ]                                            │
│                                                          │
│  ──── Firebase Auth: signInWithEmailAndPassword ────    │
│       ↓ success → load UserMembership for (uid, orgId)  │
│       ↓ get role → redirect to role-specific dashboard  │
└─────────────────────────────────────────────────────────┘
```

**Step-by-step:**

1. User enters school code → frontend queries `/organizations` where
   `schoolCode == input`
2. On match, show org name for confirmation
3. User enters email + password → `signInWithEmailAndPassword`
4. On auth success, read `userMemberships/{uid}_{orgId}` to get role + entity
   IDs
5. Set active org context in app state
6. Redirect to role-appropriate dashboard

**Fallback (student roll number login):** Some students don't have email. They
log in with:

- School code + roll number → system derives email as
  `{rollNumber}@{schoolCode}.internal`
- Or phone + OTP (future)

---

### 3.2 Consumer Login (B2C Flow)

Used by: Consumer users on LevelUp public-facing app

```
┌─────────────────────────────────────────────────────────┐
│              LevelUp Consumer Login                      │
├─────────────────────────────────────────────────────────┤
│  Email / Phone                                           │
│  Password                                                │
│  ── OR ──                                               │
│  [ Sign in with Google ]                                │
│  [ Sign in with Apple ]                                  │
│                                                          │
│  ──── Firebase Auth: standard social/email auth ────    │
│       ↓ success → read /users/{uid}                     │
│       ↓ no org context needed                           │
└─────────────────────────────────────────────────────────┘
```

Consumer users have a `/users/{uid}` document but **zero `userMemberships`
records**.

---

### 3.3 SuperAdmin Login

SuperAdmins log in with standard email/password. Their identity is indicated by:

- Custom claim `{ platform: 'superAdmin' }` (set manually or via admin function)
- No org context in claims

---

### 3.4 Multi-Org User Flow (Org Switcher)

A single user (e.g., a teacher who works at two schools) may have multiple
`userMembership` records. After login:

```
1. Auth success → query userMemberships where uid == currentUser.uid
2. If 1 membership → auto-select, proceed
3. If 2+ memberships → show org picker UI
   - User selects org
   - Set orgId in app state
   - Load org-specific data
4. User can switch orgs via org switcher in app header
```

---

### 3.5 Session Persistence & Token Refresh

- Firebase Auth handles session persistence (default: browser local storage)
- Custom claims are embedded in the ID token (refreshes every hour)
- On app load: check auth state → if authenticated, read memberships from
  Firestore (not just claims) for full role context
- Claims contain only `platform` field (for superAdmin) and `orgId` of the
  **last active org**

---

## 4. Unified User Data Model

### 4.1 Core Identity Document: `/users/{uid}`

This is the **merged successor** to both LevelUp's `AppUser` and AutoGrade's
slim `User` doc. It is product-agnostic — no roles, no org context here.

```typescript
interface UnifiedUser {
  // Identity
  uid: string; // Firebase Auth UID = document ID
  email?: string; // Primary email (from Auth)
  phone?: string; // Phone number
  authProviders: AuthProvider[]; // 'email' | 'phone' | 'google' | 'apple'

  // Profile
  displayName: string; // Full name or display name
  firstName?: string; // Optional first/last split
  lastName?: string;
  photoURL?: string; // Avatar

  // Consumer-specific (LevelUp)
  country?: string;
  age?: number;
  grade?: string; // Self-reported grade level
  onboardingCompleted?: boolean;
  preferences?: Record<string, unknown>;

  // Platform-level flags
  isSuperAdmin: boolean; // Rare, set by Cloud Function only
  consumerProfile?: {
    plan: "free" | "pro" | "premium";
    enrolledSpaceIds: string[]; // Public/purchased spaces
  };

  // Lifecycle
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLogin?: Timestamp;
  status: "active" | "suspended" | "deleted";
}

type AuthProvider = "email" | "phone" | "google" | "apple";
```

**Key design decisions:**

- Document ID = Firebase Auth UID (consistent, deterministic lookup)
- No role or orgId stored here — those live in `userMemberships`
- `isSuperAdmin` is a platform flag, not an org role
- Consumer-specific fields are optional and nullable for school users

---

### 4.2 Org Membership Document: `/userMemberships/{uid}_{orgId}`

This is the **unified successor** to AutoGrade's `UserMembership` and LevelUp's
`userOrgs`+`userRoles` combination.

```typescript
interface UserMembership {
  // Composite doc ID
  id: string; // "${uid}_${orgId}"

  // Foreign keys
  uid: string; // Firebase Auth UID
  orgId: string; // Organization ID

  // Org context (denormalized for fast reads)
  orgName: string; // Denormalized from org
  schoolCode: string; // Denormalized from org

  // Role within this org
  role: OrgRole;

  // Role-specific entity IDs
  // Only one of these will be set based on role
  orgAdminId?: string; // → /organizations/{orgId}/admins/{orgAdminId}
  teacherId?: string; // → /organizations/{orgId}/teachers/{teacherId}
  studentId?: string; // → /organizations/{orgId}/students/{studentId}
  parentId?: string; // → /organizations/{orgId}/parents/{parentId}
  scannerId?: string; // → /scanners/{scannerId}

  // Granular permissions (for teachers, overrides role defaults)
  permissions?: TeacherPermissions;

  // Enrollment context
  joinedAt: Timestamp;
  joinedBy?: string; // UID of admin who created this membership
  joinSource: "admin_created" | "invite" | "self_join" | "code" | "migration";

  // Status
  status: "active" | "inactive" | "suspended";

  // Lifecycle
  lastActive?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type OrgRole = "orgAdmin" | "teacher" | "student" | "parent" | "scanner";

interface TeacherPermissions {
  // AutoGrade permissions
  canCreateExams: boolean;
  canEditRubrics: boolean;
  canViewAllExams: boolean;
  canManuallyGrade: boolean;

  // LevelUp permissions
  canCreateSpaces: boolean;
  canManageContent: boolean;
  canViewAnalytics: boolean;
  canConfigureAgents: boolean;
}
```

---

### 4.3 Organization Document: `/organizations/{orgId}`

The unified successor to AutoGrade's `Client` and LevelUp's `Org`.

```typescript
interface Organization {
  id: string;

  // Identity
  name: string; // Full institution name
  slug: string; // URL-friendly identifier
  schoolCode: string; // Short code for login (e.g., "SCH001")

  // Contact
  email: string; // Primary contact email
  phone?: string;
  website?: string;
  address?: OrgAddress;
  contactPerson?: string;

  // Admin
  adminUid: string; // Primary admin Firebase UID

  // Subscription & billing
  status: "active" | "suspended" | "trial" | "expired";
  subscriptionPlan: "trial" | "basic" | "premium" | "enterprise";

  // Feature flags (what this org has access to)
  features: OrgFeatures;

  // AI configuration
  geminiApiKey?: string; // Encrypted; org's own Gemini key
  defaultEvaluationSettingsId?: string;

  // Stats (denormalized, updated by triggers)
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalExams: number;
    totalSpaces: number;
    totalClasses: number;
  };

  // Branding
  logoUrl?: string;
  bannerUrl?: string;

  // Lifecycle
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface OrgFeatures {
  autoGradeEnabled: boolean; // AutoGrade exam grading features
  levelUpEnabled: boolean; // LevelUp learning space features
  scannerAppEnabled: boolean; // Physical scanner device support
  aiChatEnabled: boolean; // AI tutoring chat
  aiGradingEnabled: boolean; // Automated AI grading
  parentPortalEnabled: boolean; // Parent access portal

  // Limits (null = unlimited for plan)
  maxStudents?: number;
  maxTeachers?: number;
  maxExamsPerMonth?: number;
  maxSpaces?: number;
  maxAiCallsPerMonth?: number;
}

interface OrgAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}
```

---

## 5. Firebase Auth: Custom Claims Design

### Philosophy: Slim Claims

Firebase custom claims are embedded in the JWT (max 1000 bytes). We keep them
**minimal** — they are used only for Firestore rule evaluation hot path, not for
full role context.

Full role context (permissions, entity IDs, class assignments) is always read
from Firestore `userMemberships`.

### Claim Schema

```typescript
interface PlatformClaims {
  // For SuperAdmin only
  platform?: "superAdmin";

  // For org-scoped users: set to the user's ACTIVE org at login
  // (or most recently active, if multi-org)
  activeOrgId?: string;
  activeRole?: OrgRole; // 'orgAdmin' | 'teacher' | 'student' | 'parent' | 'scanner'
}
```

**What claims are NOT used for:**

- Listing all orgs a user belongs to (too large, use Firestore query)
- Storing class IDs or student IDs (too volatile, use Firestore)
- Storing full permissions object (too large)

### Claims Refresh Trigger

Custom claims must be set via Admin SDK (Cloud Function only):

```
Triggers that update claims:
1. User created in org → setCustomClaims({ activeOrgId, activeRole })
2. User role changed → updateCustomClaims(...)
3. User switches active org → updateCustomClaims({ activeOrgId, activeRole })
4. User suspended → updateCustomClaims({ activeRole: null, suspended: true })
```

After updating claims, the client must force-refresh the ID token:

```typescript
await firebase.auth().currentUser.getIdToken(/* forceRefresh */ true);
```

---

## 6. Roles & Permissions Matrix

### 6.1 Platform-Level Permissions

| Action                            | SuperAdmin | OrgAdmin | Teacher | Student | Parent | Scanner | Consumer |
| --------------------------------- | :--------: | :------: | :-----: | :-----: | :----: | :-----: | :------: |
| Manage organizations              |     ✓      |    —     |    —    |    —    |   —    |    —    |    —     |
| View platform analytics           |     ✓      |    —     |    —    |    —    |   —    |    —    |    —     |
| Manage subscriptions              |     ✓      |    —     |    —    |    —    |   —    |    —    |    —     |
| Suspend organizations             |     ✓      |    —     |    —    |    —    |   —    |    —    |    —     |
| Manage global evaluation settings |     ✓      |    —     |    —    |    —    |   —    |    —    |    —     |
| Access public LevelUp spaces      |     ✓      |    ✓     |    ✓    |    ✓    |   —    |    —    |    ✓     |

### 6.2 Organization-Level Permissions

#### Org & User Management

| Action                          | SuperAdmin | OrgAdmin | Teacher | Student | Parent | Scanner |
| ------------------------------- | :--------: | :------: | :-----: | :-----: | :----: | :-----: |
| Create/edit/delete org settings |     ✓      |    ✓     |    —    |    —    |   —    |    —    |
| Manage API keys                 |     ✓      |    ✓     |    —    |    —    |   —    |    —    |
| Create classes                  |     ✓      |    ✓     |    —    |    —    |   —    |    —    |
| Create teachers                 |     ✓      |    ✓     |    —    |    —    |   —    |    —    |
| Create students                 |     ✓      |    ✓     |   ✓\*   |    —    |   —    |    —    |
| Create parents                  |     ✓      |    ✓     |    —    |    —    |   —    |    —    |
| Create scanner accounts         |     ✓      |    ✓     |    —    |    —    |   —    |    —    |
| View all org users              |     ✓      |    ✓     |    —    |    —    |   —    |    —    |
| View own profile                |     ✓      |    ✓     |    ✓    |    ✓    |   ✓    |    ✓    |

\*Teacher can create students only if `permissions.canCreateStudents == true`

#### AutoGrade: Exam Management

| Action                           | SuperAdmin | OrgAdmin | Teacher | Student | Parent | Scanner |
| -------------------------------- | :--------: | :------: | :-----: | :-----: | :----: | :-----: |
| Create exams                     |     ✓      |    ✓     |   ✓\*   |    —    |   —    |    —    |
| Upload question paper            |     ✓      |    ✓     |   ✓\*   |    —    |   —    |    —    |
| View all exams                   |     ✓      |    ✓     |  ✓\*\*  |    —    |   —    |    —    |
| Upload answer sheets             |     ✓      |    ✓     |    ✓    |    —    |   —    |    ✓    |
| Trigger AI grading               |     ✓      |    ✓     |    ✓    |    —    |   —    |    —    |
| Review/override grades           |     ✓      |    ✓     |   ✓\*   |    —    |   —    |    —    |
| Edit rubrics                     |     ✓      |    ✓     |   ✓\*   |    —    |   —    |    —    |
| View exam results (all students) |     ✓      |    ✓     |  ✓\*\*  |    —    |   —    |    —    |
| View own results                 |     ✓      |    ✓     |    —    |    ✓    |   —    |    —    |
| View child's results             |     ✓      |    ✓     |    —    |    —    |   ✓    |    —    |
| Download result PDFs             |     ✓      |    ✓     |    ✓    |    ✓    |   ✓    |    —    |

\*Requires `permissions.canCreateExams`, `canManuallyGrade`, `canEditRubrics`
respectively \*\*Teacher sees only exams for their assigned `classIds`

#### LevelUp: Content Management

| Action                    | SuperAdmin | OrgAdmin | Teacher | Student | Parent | Scanner | Consumer |
| ------------------------- | :--------: | :------: | :-----: | :-----: | :----: | :-----: | :------: |
| Create spaces             |     ✓      |    ✓     |   ✓\*   |    —    |   —    |    —    |    —     |
| Edit space content        |     ✓      |    ✓     |   ✓\*   |    —    |   —    |    —    |    —     |
| Assign spaces to classes  |     ✓      |    ✓     |    ✓    |    —    |   —    |    —    |    —     |
| View assigned spaces      |     ✓      |    ✓     |    ✓    |    ✓    |   —    |    —    |  ✓\*\*   |
| Take practice/timed tests |     —      |    —     |    —    |    ✓    |   —    |    —    |    ✓     |
| Use AI chat tutor         |     ✓      |    ✓     |    —    |   ✓\*   |   —    |    —    |   ✓\*    |
| View student progress     |     ✓      |    ✓     |  ✓\*\*  |    —    |   —    |    —    |    —     |
| View own progress         |     —      |    —     |    —    |    ✓    |   —    |    —    |    ✓     |
| View child's progress     |     —      |    —     |    —    |    —    |   ✓    |    —    |    —     |
| Manage AI agents          |     ✓      |    ✓     |   ✓\*   |    —    |   —    |    —    |    —     |
| View leaderboards         |     ✓      |    ✓     |    ✓    |    ✓    |   ✓    |    —    |    ✓     |

\*Requires `permissions.canCreateSpaces`, `permissions.canManageContent`,
`permissions.canConfigureAgents` respectively; `aiChatEnabled` feature flag
\*\*Teacher sees only students in their `classIds`; Consumer can only access
public/purchased spaces

### 6.3 Default Permissions by Role

When creating a teacher, their initial permissions default to:

```typescript
const defaultTeacherPermissions: TeacherPermissions = {
  // AutoGrade
  canCreateExams: true,
  canEditRubrics: true,
  canViewAllExams: false, // Only their class exams
  canManuallyGrade: true,

  // LevelUp
  canCreateSpaces: false, // Disabled by default; OrgAdmin must enable
  canManageContent: false,
  canViewAnalytics: false,
  canConfigureAgents: false,
};
```

OrgAdmin can toggle any of these per teacher.

---

## 7. Multi-Org (Multi-Tenant) Membership

### 7.1 Data Model

A user can have N membership records, one per org:

```
/userMemberships/
  uid_orgA   → { role: 'teacher', orgId: 'orgA', ... }
  uid_orgB   → { role: 'student', orgId: 'orgB', ... }
```

This covers:

- A teacher who teaches at two schools
- A student enrolled in one school and a coaching institute
- A parent with children at two different schools

### 7.2 Active Org Context

At any point, the frontend works in the context of **one active org**. The
active org is:

- Set during login (single membership → auto-select)
- Selected via org picker (multiple memberships)
- Stored in app state (Zustand store), not in local storage long-term
- Reflected in custom claims as `activeOrgId` (updated by Cloud Function on
  switch)

### 7.3 Org Switcher Flow

```typescript
// Pseudo-code for org switch
async function switchOrg(uid: string, newOrgId: string) {
  // 1. Validate the membership exists and is active
  const membership = await getMembership(uid, newOrgId);
  if (!membership || membership.status !== "active")
    throw new Error("No access");

  // 2. Update custom claims (Cloud Function call)
  await callUpdateClaims({
    uid,
    activeOrgId: newOrgId,
    activeRole: membership.role,
  });

  // 3. Force token refresh
  await auth.currentUser.getIdToken(true);

  // 4. Update Zustand store
  setActiveOrg(newOrgId, membership);

  // 5. Navigate to role-appropriate home
  navigateToDashboard(membership.role);
}
```

### 7.4 Cross-Org Data Isolation

Firestore security rules ensure a user in `orgA` **cannot read data from
`orgB`**, even if they belong to both:

```javascript
// Rule: org-scoped data requires matching activeOrgId claim
match /organizations/{orgId}/{document=**} {
  allow read: if request.auth.token.activeOrgId == orgId
              && isMemberOf(orgId);
}
```

`isMemberOf(orgId)` function checks `/userMemberships/{uid}_{orgId}` exists and
is active.

---

## 8. User Profile Merging: LevelUp AppUser + AutoGrade User

### 8.1 Current State

**LevelUp `AppUser`** (in Firestore `/users/{uid}`):

```typescript
{
  (uid,
    email,
    phone,
    fullName,
    displayName,
    photoURL,
    country,
    age,
    grade,
    onboardingCompleted,
    roles,
    createdAt,
    updatedAt);
}
```

**AutoGrade `User`** (in Firestore `/users/{uid}` — but sometimes
`/users/{email}`!):

```typescript
{
  (uid, email, phone, authProvider, currentClientId, createdAt, lastLogin);
}
```

**Critical issue:** AutoGrade's `packages/firebase/user.ts` uses **email as
document ID** while everything else uses **UID as document ID**. This is a known
inconsistency in the codebase.

### 8.2 Merge Strategy

The `UnifiedUser` (Section 4.1) supersedes both. Migration:

```
For each existing Firebase Auth user:
1. Read LevelUp /users/{uid} → levelupProfile
2. Read AutoGrade /users/{uid} → autogradeProfile
   (also check /users/{email} for the broken keying)
3. Merge into UnifiedUser:
   - uid: auth.uid
   - email: auth.email (source of truth)
   - displayName: levelupProfile.displayName || levelupProfile.fullName
                  || autogradeProfile.uid (derive from auth if no name)
   - firstName / lastName: derive from displayName if possible
   - photoURL: levelupProfile.photoURL
   - country / age / grade: from levelupProfile
   - onboardingCompleted: from levelupProfile
   - isSuperAdmin: based on old roles
   - createdAt: min(levelupProfile.createdAt, autogradeProfile.createdAt)
   - lastLogin: max(levelupProfile.updatedAt, autogradeProfile.lastLogin)
4. Write to /users/{uid} (unified)
5. Delete old /users/{email} if it exists (AutoGrade artifact)
```

### 8.3 School-Specific User Profiles

For students and teachers, richer profile data lives in the **org-scoped entity
documents**, not in `/users/{uid}`:

```
/organizations/{orgId}/students/{studentId}
  - firstName, lastName (school-registered name)
  - rollNumber
  - classIds[]
  - parentIds[]
  - authUid (→ links to /users/{uid})

/organizations/{orgId}/teachers/{teacherId}
  - firstName, lastName
  - subjects[], classIds[]
  - employeeId
  - authUid
```

The `/users/{uid}` doc is the **platform identity**. The entity docs are **role
profiles within an org**.

### 8.4 Schema Mapping Reference

| AutoGrade Field   | LevelUp Field              | Unified Field           | Notes                              |
| ----------------- | -------------------------- | ----------------------- | ---------------------------------- |
| `uid`             | `uid`                      | `uid`                   | Same                               |
| `email`           | `email`                    | `email`                 | Same                               |
| `phone`           | `phone`                    | `phone`                 | Same                               |
| `authProvider`    | —                          | `authProviders[]`       | Array (can have multiple)          |
| `currentClientId` | `orgId` (on AppUser)       | Removed from user doc   | Lives in `userMemberships` instead |
| —                 | `fullName` / `displayName` | `displayName`           | Consolidated                       |
| —                 | `photoURL`                 | `photoURL`              |                                    |
| —                 | `country`                  | `country`               |                                    |
| —                 | `age`                      | `age`                   |                                    |
| —                 | `grade`                    | `grade`                 |                                    |
| —                 | `onboardingCompleted`      | `onboardingCompleted`   |                                    |
| —                 | `roles[]`                  | Removed                 | Lives in `userMemberships`         |
| `createdAt`       | `createdAt` (ms epoch)     | `createdAt` (Timestamp) | Normalize to Timestamp             |
| `lastLogin`       | `updatedAt` (ms epoch)     | `lastLogin` (Timestamp) |                                    |

---

## 9. Firestore Collections: Identity Layer

### 9.1 Full Collection Map

```
# ─── ROOT IDENTITY COLLECTIONS ───────────────────────────────
/users/{uid}
  └── UnifiedUser document

/userMemberships/{uid}_{orgId}
  └── UserMembership document

/organizations/{orgId}
  └── Organization document

/scanners/{scannerId}
  └── Scanner device account

# ─── ORG-SCOPED USER ENTITY COLLECTIONS ──────────────────────
/organizations/{orgId}/students/{studentId}
/organizations/{orgId}/teachers/{teacherId}
/organizations/{orgId}/parents/{parentId}
/organizations/{orgId}/classes/{classId}

# ─── ORG-SCOPED CONTENT & ASSESSMENT COLLECTIONS ─────────────
/organizations/{orgId}/spaces/{spaceId}              ← LevelUp
/organizations/{orgId}/exams/{examId}                ← AutoGrade
/organizations/{orgId}/submissions/{submissionId}    ← AutoGrade
/organizations/{orgId}/evaluationSettings/{settingsId} ← AutoGrade

# ─── PLATFORM-LEVEL OPERATIONAL COLLECTIONS ──────────────────
/llm-usage/{logId}
/evaluationSettings/{settingsId}  ← global presets
/platformStats                    ← aggregate stats
```

### 9.2 Key Composite Indexes Needed

```
# userMemberships: find all memberships for a user
Collection: userMemberships
Fields: uid ASC, status ASC, createdAt DESC

# userMemberships: find all members of an org by role
Collection: userMemberships
Fields: orgId ASC, role ASC, status ASC

# students: look up by roll number within org
Collection: (organizations/{orgId}/students)
Fields: rollNumber ASC

# teachers: find by class
Collection: (organizations/{orgId}/teachers)
Fields: classIds ARRAY_CONTAINS, status ASC
```

---

## 10. Firestore Security Rules Strategy

### 10.1 Helper Functions

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Platform-level helpers ──────────────────────────────
    function isAuthenticated() {
      return request.auth != null;
    }

    function isSuperAdmin() {
      return isAuthenticated()
        && request.auth.token.platform == 'superAdmin';
    }

    function getUser() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // ── Org-level helpers ────────────────────────────────────
    function getMembership(orgId) {
      let membershipId = request.auth.uid + '_' + orgId;
      return get(/databases/$(database)/documents/userMemberships/$(membershipId)).data;
    }

    function isMemberOf(orgId) {
      let membership = getMembership(orgId);
      return membership != null && membership.status == 'active';
    }

    function hasRole(orgId, role) {
      let membership = getMembership(orgId);
      return membership != null
        && membership.role == role
        && membership.status == 'active';
    }

    function isOrgAdmin(orgId) {
      return hasRole(orgId, 'orgAdmin');
    }

    function isTeacher(orgId) {
      return hasRole(orgId, 'teacher');
    }

    function isStudent(orgId) {
      return hasRole(orgId, 'student');
    }

    function isParent(orgId) {
      return hasRole(orgId, 'parent');
    }

    function isActiveInOrg(orgId) {
      return request.auth.token.activeOrgId == orgId && isMemberOf(orgId);
    }

    function teacherHasPermission(orgId, perm) {
      let membership = getMembership(orgId);
      return membership != null
        && membership.role == 'teacher'
        && membership.permissions[perm] == true;
    }

    function teacherTeachesClass(orgId, classId) {
      let membership = getMembership(orgId);
      return isTeacher(orgId)
        && membership.classIds.hasAny([classId]);
    }

    function isStudentOwner(orgId, studentId) {
      let membership = getMembership(orgId);
      return isStudent(orgId)
        && membership.studentId == studentId;
    }

    function isParentOf(orgId, studentId) {
      let membership = getMembership(orgId);
      return isParent(orgId)
        && membership.studentIds.hasAny([studentId]);
    }
  }
}
```

### 10.2 Collection Rules

```javascript
    // ── /users/{uid} ─────────────────────────────────────────
    match /users/{uid} {
      // Users can read/write only their own doc
      allow read: if isAuthenticated() && (request.auth.uid == uid || isSuperAdmin());
      allow create: if isAuthenticated() && request.auth.uid == uid;
      allow update: if isAuthenticated()
        && request.auth.uid == uid
        // Prevent self-elevation to superAdmin
        && (!('isSuperAdmin' in request.resource.data)
            || request.resource.data.isSuperAdmin == resource.data.isSuperAdmin);
      allow delete: if isSuperAdmin();
    }

    // ── /userMemberships/{membershipId} ─────────────────────
    match /userMemberships/{membershipId} {
      allow read: if isAuthenticated()
        && (request.auth.uid == resource.data.uid || isSuperAdmin());
      // Only Cloud Functions (Admin SDK) write memberships
      allow write: if isSuperAdmin();
    }

    // ── /organizations/{orgId} ──────────────────────────────
    match /organizations/{orgId} {
      allow read: if isSuperAdmin() || isActiveInOrg(orgId);
      allow create: if isSuperAdmin();
      allow update: if isSuperAdmin() || isOrgAdmin(orgId);
      allow delete: if isSuperAdmin();

      // ── /organizations/{orgId}/students/{studentId} ───────
      match /students/{studentId} {
        allow read: if isSuperAdmin()
          || isOrgAdmin(orgId)
          || isTeacher(orgId)  // teacher sees all students (filtered client-side by classId)
          || isStudentOwner(orgId, studentId)
          || isParentOf(orgId, studentId);
        allow create, update: if isSuperAdmin() || isOrgAdmin(orgId) || isTeacher(orgId);
        allow delete: if isSuperAdmin() || isOrgAdmin(orgId);
      }

      // ── /organizations/{orgId}/teachers/{teacherId} ───────
      match /teachers/{teacherId} {
        allow read: if isSuperAdmin() || isActiveInOrg(orgId);
        allow create, update: if isSuperAdmin() || isOrgAdmin(orgId);
        allow delete: if isSuperAdmin() || isOrgAdmin(orgId);
      }

      // ── /organizations/{orgId}/parents/{parentId} ─────────
      match /parents/{parentId} {
        allow read: if isSuperAdmin()
          || isOrgAdmin(orgId)
          || (isParent(orgId) && getMembership(orgId).parentId == parentId);
        allow create, update: if isSuperAdmin() || isOrgAdmin(orgId);
        allow delete: if isSuperAdmin() || isOrgAdmin(orgId);
      }

      // ── /organizations/{orgId}/classes/{classId} ──────────
      match /classes/{classId} {
        allow read: if isSuperAdmin() || isActiveInOrg(orgId);
        allow create, update: if isSuperAdmin() || isOrgAdmin(orgId);
        allow delete: if isSuperAdmin() || isOrgAdmin(orgId);
      }

      // ── /organizations/{orgId}/exams/{examId} ─────────────
      match /exams/{examId} {
        allow read: if isSuperAdmin()
          || isOrgAdmin(orgId)
          || (isTeacher(orgId) && teacherTeachesClass(orgId, resource.data.classIds[0]));
          // Note: student/parent read their own exam results via /submissions, not /exams directly
        allow create: if isSuperAdmin()
          || isOrgAdmin(orgId)
          || teacherHasPermission(orgId, 'canCreateExams');
        allow update: if isSuperAdmin()
          || isOrgAdmin(orgId)
          || (isTeacher(orgId) && teacherHasPermission(orgId, 'canCreateExams'));
        allow delete: if isSuperAdmin() || isOrgAdmin(orgId);

        match /questions/{questionId} {
          allow read: if isSuperAdmin() || isOrgAdmin(orgId) || isTeacher(orgId);
          allow write: if isSuperAdmin() || isOrgAdmin(orgId)
            || teacherHasPermission(orgId, 'canEditRubrics');
        }
      }

      // ── /organizations/{orgId}/submissions/{submissionId} ─
      match /submissions/{submissionId} {
        allow read: if isSuperAdmin()
          || isOrgAdmin(orgId)
          || isTeacher(orgId)
          || (isStudent(orgId) && getMembership(orgId).studentId == resource.data.studentId)
          || (isParent(orgId) && getMembership(orgId).studentIds.hasAny([resource.data.studentId]));
        allow create: if isSuperAdmin() || isOrgAdmin(orgId) || isTeacher(orgId)
          || hasRole(orgId, 'scanner');
        allow update: if isSuperAdmin() || isOrgAdmin(orgId) || isTeacher(orgId);
        allow delete: if isSuperAdmin() || isOrgAdmin(orgId);

        match /questionSubmissions/{qsId} {
          allow read: if isSuperAdmin()
            || isOrgAdmin(orgId)
            || isTeacher(orgId)
            || (isStudent(orgId) && getMembership(orgId).studentId == get(/databases/$(database)/documents/organizations/$(orgId)/submissions/$(submissionId)).data.studentId)
            || (isParent(orgId) && getMembership(orgId).studentIds.hasAny([get(/databases/$(database)/documents/organizations/$(orgId)/submissions/$(submissionId)).data.studentId]));
          allow write: if isSuperAdmin() || isOrgAdmin(orgId) || isTeacher(orgId);
        }
      }

      // ── /organizations/{orgId}/spaces/{spaceId} ───────────
      match /spaces/{spaceId} {
        allow read: if isSuperAdmin()
          || isOrgAdmin(orgId)
          || isTeacher(orgId)
          || isStudent(orgId);  // filtered to assigned spaces client-side or via query
        allow create: if isSuperAdmin()
          || isOrgAdmin(orgId)
          || teacherHasPermission(orgId, 'canCreateSpaces');
        allow update: if isSuperAdmin()
          || isOrgAdmin(orgId)
          || (isTeacher(orgId) && teacherHasPermission(orgId, 'canManageContent'));
        allow delete: if isSuperAdmin() || isOrgAdmin(orgId);
      }

      // ── /organizations/{orgId}/evaluationSettings ─────────
      match /evaluationSettings/{settingsId} {
        allow read: if isSuperAdmin() || isActiveInOrg(orgId);
        allow write: if isSuperAdmin() || isOrgAdmin(orgId)
          || teacherHasPermission(orgId, 'canEditRubrics');
      }
    }

    // ── /scanners/{scannerId} ────────────────────────────────
    match /scanners/{scannerId} {
      allow read: if isSuperAdmin()
        || (isAuthenticated() && resource.data.authUid == request.auth.uid);
      allow write: if isSuperAdmin();
    }

    // ── /llm-usage/{logId} ───────────────────────────────────
    match /llm-usage/{logId} {
      allow read: if isSuperAdmin();
      allow create: if isAuthenticated();  // Logged by Cloud Functions (or client)
      allow update, delete: if false;      // Immutable audit log
    }

    // ── /evaluationSettings/{settingsId} (global presets) ───
    match /evaluationSettings/{settingsId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }
```

### 10.3 Rules Design Notes

- **Avoid `get()` chaining deeply**: reading membership docs inside rules is a 1
  read/request; keep chain depth ≤ 2 to manage costs.
- **`getMembership()` is called at most once per rule** due to function caching
  in the same rule evaluation.
- **Parent viewing child's question submissions** requires a cross-document
  lookup (get submission → check studentId against parentIds). This is
  expensive; consider denormalizing `parentIds` onto the submission document.
- **Scanner**: scanner accounts are stored in `/scanners/{scannerId}` at root,
  not under the org. Their `userMembership` record has `role: 'scanner'` and
  `scannerId`.

---

## 11. Cloud Functions: Auth Lifecycle Hooks

### 11.1 `onUserCreated` Trigger

```typescript
// Fires on every new Firebase Auth account
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  // Create the /users/{uid} document with defaults
  await admin
    .firestore()
    .doc(`users/${user.uid}`)
    .set({
      uid: user.uid,
      email: user.email ?? null,
      phone: user.phoneNumber ?? null,
      authProviders: [determineProvider(user)],
      displayName: user.displayName ?? "",
      photoURL: user.photoURL ?? null,
      isSuperAdmin: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      status: "active",
    });
});
```

### 11.2 `createOrgUser` Callable Function

Called by OrgAdmin to create a new teacher/student/parent:

```typescript
export const createOrgUser = functions.https.onCall(async (data, context) => {
  // Auth check: caller must be orgAdmin of the target org
  const { orgId, role, email, firstName, lastName, ...roleSpecificData } = data;

  // 1. Create Firebase Auth account
  const userRecord = await admin
    .auth()
    .createUser({ email, password: generateTempPassword() });

  // 2. Create /users/{uid} via trigger (or here for atomicity)

  // 3. Create role-specific entity doc in /organizations/{orgId}/{role}s/{entityId}
  const entityRef = await admin
    .firestore()
    .collection(`organizations/${orgId}/${role}s`)
    .add({
      authUid: userRecord.uid,
      firstName,
      lastName,
      ...roleSpecificData,
      createdAt: FieldValue.serverTimestamp(),
    });

  // 4. Create /userMemberships/{uid}_{orgId}
  await admin
    .firestore()
    .doc(`userMemberships/${userRecord.uid}_${orgId}`)
    .set({
      id: `${userRecord.uid}_${orgId}`,
      uid: userRecord.uid,
      orgId,
      orgName: org.name, // denormalized
      schoolCode: org.schoolCode, // denormalized
      role,
      [`${role}Id`]: entityRef.id,
      status: "active",
      joinedAt: FieldValue.serverTimestamp(),
      joinedBy: context.auth?.uid,
      joinSource: "admin_created",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      permissions: role === "teacher" ? defaultTeacherPermissions : undefined,
    });

  // 5. Set custom claims
  await admin.auth().setCustomUserClaims(userRecord.uid, {
    activeOrgId: orgId,
    activeRole: role,
  });

  return { uid: userRecord.uid, entityId: entityRef.id };
});
```

### 11.3 `switchActiveOrg` Callable Function

```typescript
export const switchActiveOrg = functions.https.onCall(async (data, context) => {
  const { newOrgId } = data;
  const uid = context.auth?.uid;

  // Validate membership
  const membershipDoc = await admin
    .firestore()
    .doc(`userMemberships/${uid}_${newOrgId}`)
    .get();

  if (!membershipDoc.exists || membershipDoc.data()?.status !== "active") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No active membership"
    );
  }

  const membership = membershipDoc.data()!;

  // Update claims
  await admin.auth().setCustomUserClaims(uid, {
    activeOrgId: newOrgId,
    activeRole: membership.role,
  });

  // Update lastActive
  await membershipDoc.ref.update({ lastActive: FieldValue.serverTimestamp() });

  return { success: true };
});
```

### 11.4 `onUserDeleted` Trigger

```typescript
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  // Soft-delete /users/{uid}
  await admin.firestore().doc(`users/${user.uid}`).update({
    status: "deleted",
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Deactivate all memberships
  const membershipsQuery = await admin
    .firestore()
    .collection("userMemberships")
    .where("uid", "==", user.uid)
    .get();

  const batch = admin.firestore().batch();
  membershipsQuery.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: "inactive",
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
});
```

---

## 12. Consumer (B2C) User Path

### 12.1 Consumer Identity

Consumer users:

- Have a `/users/{uid}` document (same schema as school users)
- Have **zero** `/userMemberships` records
- `isSuperAdmin: false`
- `consumerProfile` field is populated

### 12.2 Consumer Space Access

LevelUp public spaces are accessed via:

- **Public spaces**: `isPublic: true` flag on the space document; no auth
  required to browse, auth required to track progress
- **Purchased spaces**: stored in `consumerProfile.enrolledSpaceIds[]`
- **Org spaces**: NOT accessible to consumers (strict org isolation)

### 12.3 Consumer-Only Features

| Feature                       | Supported for Consumer  |
| ----------------------------- | :---------------------: |
| Browse public spaces          |            ✓            |
| Purchase/enroll in spaces     |            ✓            |
| Practice & timed tests        |            ✓            |
| AI chat tutor                 | ✓ (if enabled on space) |
| Leaderboards (cross-consumer) |            ✓            |
| AutoGrade exam features       |            ✗            |
| School-scoped content         |            ✗            |
| Organization membership       |            ✗            |

---

## 13. Migration Strategy

### 13.1 Pre-Migration Audit

Before running any migration scripts, audit:

1. **AutoGrade user key inconsistency**: Find all documents in `/users` where
   document ID ≠ uid field → these are the `/users/{email}` keyed docs that need
   fixing.
2. **LevelUp userRoles collection**: Enumerate all `isSuperAdmin: true` entries
   → these become platform-level SuperAdmins.
3. **LevelUp userOrgs collection**: Map `{userId}_{orgId}` → new
   `userMembership` format.
4. **AutoGrade userMemberships**: Already in correct format; just need org
   renaming (`clientId → orgId`).
5. **Org/client naming conflict**: AutoGrade uses `clients`, LevelUp uses
   `orgs`. Both need migration to `organizations`.

### 13.2 Migration Steps

```
Step 1: Create /organizations from AutoGrade /clients
  - Copy Client docs to Organization format
  - Add missing fields (features, stats, slug)
  - Map clientId → orgId in all references

Step 2: Create /organizations from LevelUp /orgs
  - Copy Org docs to Organization format
  - Generate schoolCode for each (if not already present)
  - Set feature flags: levelUpEnabled=true, autoGradeEnabled=false (default)

Step 3: Merge /users documents
  - For each Firebase Auth user, run merge logic from Section 8.2
  - Write to /users/{uid} (by uid, always)
  - Delete /users/{email} artifacts

Step 4: Create unified userMemberships
  - From AutoGrade /userMemberships: remap clientId→orgId, role names
  - From LevelUp /userOrgs + /userRoles: derive role, create membership docs

Step 5: Migrate org-scoped data
  - AutoGrade: /clients/{clientId}/... → /organizations/{orgId}/...
  - LevelUp: /courses/{courseId} (global) → /organizations/{orgId}/spaces/{spaceId}

Step 6: Update custom claims for all existing users
  - Batch update via Admin SDK

Step 7: Validate with Firestore rules audit
  - Run rule simulation tests
  - Verify cross-tenant isolation
```

### 13.3 Dual-Write / Adapter Pattern During Migration

To avoid a big-bang cutover:

```
Phase A: Read from old collections, write to both old + new
Phase B: Read from new collections, write to both (backward compat)
Phase C: Read and write new only; delete old collections
```

Adapter functions in `shared-services` translate between old and new schemas
during phases A-B.

---

## 14. Open Issues & Decisions

### DECISION-001: Scanner App Auth Model

**Question**: Scanner accounts — should they use real Firebase email/password
auth, or a device-based API key?

**Options**:

- A) Firebase email/password (current) — user: `scanner@sch001.internal`, role:
  'scanner' in claims
- B) Firebase Custom Token — backend issues a short-lived token to device using
  a device secret key
- C) API Key in header — scanner app sends requests to a Cloud Function with a
  pre-shared key

**Recommendation**: Option B (Custom Token) is most secure. Device registers via
admin, gets a secret, exchanges for Firebase custom token on each scan session.
Avoids storing passwords on devices.

**Status**: Needs decision from team.

---

### DECISION-002: Consumer-to-School User Transition

**Question**: If a consumer user later joins a school (e.g., a student who signs
up on their own and then their school also creates an account for them) — how do
we merge?

**Options**:

- A) Email match: if school creates a student with same email as existing
  consumer user → create membership linking to existing UID
- B) Manual link: admin explicitly links existing consumer account to student
  entity
- C) Separate accounts: always, no merging

**Recommendation**: Option A with Option B as fallback. Email match is attempted
first; on conflict (different email), admin can use explicit link.

**Status**: Needs decision.

---

### DECISION-003: Roll Number as Login Credential

**Question**: Should students be able to log in with roll number + school code
instead of email?

**Implementation path**: Derive a synthetic email:
`{rollNumber}@{schoolCode}.autograde.internal` — create Firebase Auth account
with this as email. Student doesn't need to know the email; they just type roll
number + school code + password.

**Concern**: This synthetic email pattern could cause confusion if student also
has a real email. Need to handle the email change flow carefully.

**Status**: Recommended to implement in Phase 3B; not blocking this
architecture.

---

### DECISION-004: Parent Viewing Multiple Children Across Multiple Orgs

**Question**: If a parent has children at two different schools, do they get one
account with two memberships, or two separate accounts?

**Recommendation**: One Firebase Auth account, two `userMembership` documents
(one per org). The parent app shows an org switcher.

**Status**: Accepted in this design. Implement multi-org switcher in parent app.

---

### DECISION-005: SuperAdmin Account Lifecycle

**Question**: How is the `isSuperAdmin: true` flag set, and who can do it?

**Recommendation**: Only via Firebase Admin SDK in Cloud Functions, callable
only by an existing SuperAdmin. Not via Firestore rules (Firestore write to set
`isSuperAdmin: true` is blocked by rules). Initial SuperAdmin is seeded manually
via a one-time init script.

**Status**: Agreed.

---

## Appendix A: TypeScript Type Index

```typescript
// All types defined in this document live in:
// packages/shared-types/src/identity/

export type { UnifiedUser } from "./user";
export type { UserMembership } from "./membership";
export type { Organization } from "./organization";
export type { OrgFeatures } from "./organization";
export type { TeacherPermissions } from "./membership";
export type { OrgRole } from "./membership";
export type { PlatformClaims } from "./claims";
export type { AuthProvider } from "./user";
```

---

## Appendix B: Firestore Index Requirements

```json
{
  "indexes": [
    {
      "collectionGroup": "userMemberships",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "userMemberships",
      "fields": [
        { "fieldPath": "orgId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "students",
      "fields": [
        { "fieldPath": "orgId", "order": "ASCENDING" },
        { "fieldPath": "rollNumber", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "teachers",
      "fields": [
        { "fieldPath": "classIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

**Document Version:** 1.0 **Author:** AutoGrade Expert (Maestro Worker —
`sess_1771516543485_x53gh8b5k`) **Task:** `task_1771515600523_5tsr0v0un` — Phase
3A: Unified User & Auth Architecture Doc **Status:** Complete — Ready for team
review
