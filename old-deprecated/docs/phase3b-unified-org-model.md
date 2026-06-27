# Phase 3B: Unified Organization & Multi-Tenancy Architecture

**Date**: 2026-02-19 **Analyst**: LevelUp Expert (Maestro Worker) **Status**:
Architecture Design — Ready for Review **Purpose**: Define the unified
org/multi-tenancy model for the combined LevelUp + AutoGrade platform, covering
the Organization > School > Class > Section hierarchy, tenant isolation
strategy, subscription model, content access model, and teacher-class-student
assignments.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State — What Each System Has Today](#2-current-state--what-each-system-has-today)
3. [Unified Organizational Hierarchy](#3-unified-organizational-hierarchy)
4. [AutoGrade Client Model → Unified Org Mapping](#4-autograde-client-model--unified-org-mapping)
5. [LevelUp Org Model → Unified Org Mapping](#5-levelup-org-model--unified-org-mapping)
6. [Unified Entity Designs (TypeScript)](#6-unified-entity-designs-typescript)
7. [Tenant Data Isolation Strategy](#7-tenant-data-isolation-strategy)
8. [Unified Firestore Schema](#8-unified-firestore-schema)
9. [Role Hierarchy & Permissions](#9-role-hierarchy--permissions)
10. [Subscription & Billing Model](#10-subscription--billing-model)
11. [Content (Spaces) in Org Context](#11-content-spaces-in-org-context)
12. [Teacher-Class-Student Assignment Model](#12-teacher-class-student-assignment-model)
13. [Firestore Security Rules Design](#13-firestore-security-rules-design)
14. [Migration Strategy from Current Systems](#14-migration-strategy-from-current-systems)
15. [Open Questions & Design Decisions](#15-open-questions--design-decisions)
    - 15.1 Decisions Required
    - 15.2 Cross-Document Reconciliation (Phase 3A vs 3B naming)
    - 15.3 Risks

---

## 1. Executive Summary

The unified platform merges two distinct tenancy models:

| Dimension      | AutoGrade                               | LevelUp                         | Unified Target                     |
| -------------- | --------------------------------------- | ------------------------------- | ---------------------------------- |
| Top entity     | `Client` (school)                       | `Organization` (loose)          | `Tenant` (school/institution)      |
| Data isolation | Strict — `/clients/{clientId}/...`      | Loose — `orgId` field on docs   | Strict — `/tenants/{tenantId}/...` |
| Hierarchy      | Client > Class                          | Org > OrgGroup > Course         | Tenant > School > Class > Section  |
| User-org link  | `UserMembership` (strong)               | `UserOrgs` + `UserRoles` (weak) | `UserMembership` (strong, unified) |
| Access model   | Role-based (clientAdmin, teacher, etc.) | Code-based (join org by code)   | Role-based + code join             |
| Billing        | Per-client, plan-based                  | Not yet formalized              | Per-tenant, feature-flag-based     |

**Key Design Decisions:**

1. Adopt **AutoGrade's strict isolation model** (`/tenants/{tenantId}/...`) for
   all data
2. Adopt **LevelUp's join-by-code UX** for user onboarding (students enter
   school code)
3. Add `School` and `Section` layers to support larger educational groups
4. Move LevelUp's `courses` → `spaces` under the tenant namespace
5. Unify all role/membership data into a single `userMemberships` collection

---

## 2. Current State — What Each System Has Today

### 2.1 AutoGrade Multi-Tenancy (Strong, Mature)

```
/clients/{clientId}           ← The isolation boundary (= a school)
  /classes/{classId}          ← Subject-year-section groupings
  /students/{studentId}
  /teachers/{teacherId}
  /parents/{parentId}
  /exams/{examId}
    /questions/{questionId}
  /submissions/{submissionId}
    /questionSubmissions/{qId}
  /evaluationSettings/{id}

/userMemberships/{uid}_{clientId}  ← Links user ↔ client with role
/users/{uid}                        ← Auth identity
```

**Strengths:**

- Complete Firestore path isolation per school
- `UserMembership` enables one Auth UID → multiple schools
- School code login provides tenant routing at login time
- Roles embedded in membership doc (not global)

**Gaps:**

- No hierarchy above `Client` (cannot group schools into a network/chain)
- No `Section` within a class
- No academic year concept on the client entity
- No content (courses) — that's LevelUp's domain

### 2.2 LevelUp Org Model (Loose, Evolving)

```
/orgs/{orgId}             ← Top-level, but NOT a strict isolation boundary
/orgGroups/{groupId}      ← Optional course grouping within an org
/courses/{courseId}       ← Has orgId field (loose coupling)
/userOrgs/{uid}_{orgId}   ← Org membership (no strong role)
/userRoles/{uid}          ← Global role doc (orgAdmin map, courseAdmin map)

/users/{uid}
/storyPoints/{storyPointId}
/userProgress/*
/timedTestSessions/*
```

**Strengths:**

- Public/private org visibility
- Join-by-code UX
- OrgGroup for curriculum organization (cohort groupings)
- Role hierarchy exists (superAdmin > orgAdmin > courseAdmin)

**Gaps:**

- Data NOT isolated per org — courses, progress docs are global collections
- No `Class`, `Student`, `Teacher` entities (it's B2C, not B2B)
- OrgAdmin can't manage users (no user management UI)
- No academic hierarchy (year, section)
- No subscription/billing

---

## 3. Unified Organizational Hierarchy

The unified platform needs to support two usage patterns simultaneously:

**Pattern A — School Direct (AutoGrade-style):**

```
Tenant (School)  → Classes → Exams + Spaces
```

**Pattern B — Educational Network (Future B2B+):**

```
Organization (District/Chain) → School (Branch) → Class → Section
```

### 3.1 Hierarchy Diagram

```
Platform (Super Admin)
  │
  └── Tenant (= School / Institution)          ← Top billing/isolation boundary
        │
        ├── [tenantAdmin] — manages the entire tenant
        │
        ├── School  (optional sub-unit for multi-campus tenants)
        │     │
        │     └── Class  (e.g., "Grade 10 — Mathematics 2024-25")
        │           │
        │           ├── Section  (e.g., "Section A", "Section B")  [optional]
        │           │
        │           ├── Teachers → assigned to class
        │           ├── Students → enrolled in class
        │           └── Content:
        │                 ├── Spaces (LevelUp interactive content)
        │                 └── Exams (AutoGrade handwritten grading)
        │
        ├── Academic Sessions  (e.g., "2024-25", "Jan 2025 Batch")
        │
        └── Subscription (plan, API keys, feature flags)
```

### 3.2 Hierarchy Entity Summary

| Entity                     | AutoGrade Equivalent | LevelUp Equivalent    | Unified Name         |
| -------------------------- | -------------------- | --------------------- | -------------------- |
| Billing/isolation boundary | `Client`             | `Organization`        | `Tenant`             |
| Sub-unit (campus/branch)   | _(none)_             | _(none)_              | `School` (optional)  |
| Cohort/section             | `Class`              | `OrgGroup`            | `Class`              |
| Sub-class grouping         | _(none)_             | _(none)_              | `Section` (optional) |
| Learning period            | _(none)_             | _(none)_              | `AcademicSession`    |
| Learning content           | _(none)_             | `Course` → `Space`    | `Space`              |
| Assessment                 | `Exam`               | `TimedTest` (partial) | `Exam`               |

---

## 4. AutoGrade Client Model → Unified Org Mapping

### Direct Field Mapping

| AutoGrade `Client` Field | Unified `Tenant` Field  | Notes                            |
| ------------------------ | ----------------------- | -------------------------------- |
| `id`                     | `id` (tenantId)         | Same concept, rename variable    |
| `name`                   | `name`                  | Same                             |
| `schoolCode`             | `tenantCode`            | Used for login routing           |
| `email`                  | `contactEmail`          | Renamed for clarity              |
| `adminUid`               | `ownerUid`              | Primary admin UID                |
| `geminiApiKey`           | `settings.geminiApiKey` | Moved to nested settings         |
| `status`                 | `status`                | Same values                      |
| `subscriptionPlan`       | `subscription.plan`     | Moved to nested subscription     |
| `metadata.address`       | `address`               | Top-level                        |
| `metadata.contactPerson` | `contactPerson`         | Top-level                        |
| `stats`                  | `stats`                 | Same, extended                   |
| _(none)_                 | `features`              | NEW: feature flags per plan      |
| _(none)_                 | `schoolId?`             | NEW: for multi-campus (optional) |

### AutoGrade `Class` → Unified `Class` Mapping

| AutoGrade `Class` Field | Unified `Class` Field        | Notes                           |
| ----------------------- | ---------------------------- | ------------------------------- |
| `id`                    | `id`                         | Same                            |
| `clientId`              | `tenantId`                   | Renamed                         |
| `name`                  | `name`                       | Same                            |
| `subject`               | `subject`                    | Same                            |
| `academicYear`          | `academicSessionId`          | Links to AcademicSession entity |
| `grade?`                | `grade?`                     | Same                            |
| `section?`              | Promoted to `Section` entity | Optional sub-entity             |
| `teacherIds?`           | `teacherIds?`                | Same                            |
| `createdBy`             | `createdBy`                  | Same                            |
| `studentCount`          | `studentCount`               | Same (denormalized)             |

### AutoGrade `UserMembership` → Unified `UserMembership` Mapping

| AutoGrade `UserMembership` Field | Unified `UserMembership` Field | Notes                             |
| -------------------------------- | ------------------------------ | --------------------------------- |
| `id` (uid_clientId)              | `id` (uid_tenantId)            | Pattern same, tenantId now        |
| `uid`                            | `uid`                          | Same                              |
| `clientId`                       | `tenantId`                     | Renamed                           |
| `schoolCode`                     | `tenantCode`                   | Renamed                           |
| `role`                           | `role`                         | Extended with LevelUp roles       |
| `status`                         | `status`                       | Same                              |
| `teacherId?`                     | `teacherId?`                   | Same                              |
| `studentId?`                     | `studentId?`                   | Same                              |
| `parentId?`                      | `parentId?`                    | Same                              |
| `scannerId?`                     | `scannerId?`                   | Same                              |
| `permissions?`                   | `permissions`                  | Extended with LevelUp permissions |
| _(none)_                         | `schoolId?`                    | NEW: for multi-campus             |

---

## 5. LevelUp Org Model → Unified Org Mapping

### LevelUp `OrgDTO` → Unified `Tenant`

| LevelUp `OrgDTO` Field | Unified `Tenant` Field                            | Notes                          |
| ---------------------- | ------------------------------------------------- | ------------------------------ |
| `id`                   | `id` (tenantId)                                   | Concept maps 1:1               |
| `name`                 | `name`                                            | Same                           |
| `title`                | `shortName`                                       | Renamed                        |
| `slug`                 | `slug`                                            | Same                           |
| `description`          | `description`                                     | Same                           |
| `imageUrl`             | `logoUrl`                                         | Renamed                        |
| `bannerUrl`            | `bannerUrl`                                       | Same                           |
| `code`                 | `tenantCode`                                      | Now used for 2-step login      |
| `isPublic`             | _(removed)_                                       | B2B tenants are always private |
| `adminUids[]`          | Replaced by `UserMembership.role = 'tenantAdmin'` | Normalized                     |
| `ownerUid`             | `ownerUid`                                        | Same                           |
| `contactEmail`         | `contactEmail`                                    | Same                           |
| `address`              | `address`                                         | Same                           |

### LevelUp `OrgGroupDTO` → Unified `Class`

LevelUp's `OrgGroup` was used to cluster courses within an org (e.g., "Fall 2024
Cohort"). In the unified model, this concept becomes a `Class` — a defined group
of students with a curriculum.

| LevelUp `OrgGroupDTO` Field | Unified `Class` Field              | Notes                               |
| --------------------------- | ---------------------------------- | ----------------------------------- |
| `id`                        | `id`                               | Same                                |
| `orgId`                     | `tenantId`                         | Renamed                             |
| `name`                      | `name`                             | e.g., "Grade 10 — Physics"          |
| `description`               | `description`                      | Same                                |
| `displayOrder`              | `displayOrder`                     | Same                                |
| `courseIds[]`               | Replaced by Space-Class assignment | Normalized (Space has `classIds[]`) |

### LevelUp `UserOrgRecord` → Unified `UserMembership`

| LevelUp `UserOrgRecord` Field | Unified `UserMembership` Field | Notes                       |
| ----------------------------- | ------------------------------ | --------------------------- |
| `id` (userId_orgId)           | `id` (uid_tenantId)            | Same pattern                |
| `userId`                      | `uid`                          | Renamed                     |
| `orgId`                       | `tenantId`                     | Renamed                     |
| `joinedAt`                    | `createdAt`                    | Renamed                     |
| `source`                      | `joinSource`                   | Same values + 'bulk_import' |
| `orgName`                     | _(denormalization removed)_    | Query tenant doc instead    |
| `isArchived`                  | `status: 'inactive'`           | Normalized                  |

### LevelUp `UserRolesDTO` → Unified `UserMembership.role + permissions`

The LevelUp `userRoles` global doc (with orgAdmin map and courseAdmin map) is
replaced by:

- `UserMembership.role` — the primary role within the tenant
- `UserMembership.permissions` — granular overrides

| LevelUp `UserRolesDTO` Field | Unified Equivalent                                              |
| ---------------------------- | --------------------------------------------------------------- |
| `isSuperAdmin`               | `UserMembership` with `role: 'superAdmin'` (platform-level)     |
| `orgAdmin[orgId]`            | `UserMembership` with `role: 'tenantAdmin'` for that `tenantId` |
| `courseAdmin[courseId]`      | `UserMembership` with `permissions.managedSpaceIds: [spaceId]`  |

---

## 6. Unified Entity Designs (TypeScript)

### 6.1 `Tenant` (Top-Level Isolation Boundary)

```typescript
interface Tenant {
  id: string; // tenantId — Firestore auto-ID
  name: string; // "Springfield High School"
  shortName?: string; // "Springfield HS"
  slug: string; // URL-friendly: "springfield-high-2024"
  description?: string;

  // Identity
  tenantCode: string; // Unique code for 2-step login: "SPR001"
  ownerUid: string; // Firebase Auth UID of primary admin

  // Contact & Branding
  contactEmail: string;
  contactPhone?: string;
  contactPerson?: string;
  logoUrl?: string;
  bannerUrl?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };

  // Account Status
  status: "active" | "suspended" | "trial" | "expired";

  // Subscription (see Section 10)
  subscription: {
    plan: "trial" | "basic" | "premium" | "enterprise";
    expiresAt?: Timestamp;
    maxStudents?: number;
    maxTeachers?: number;
    maxSpaces?: number;
    maxExamsPerMonth?: number;
  };

  // Feature Flags (controlled by subscription plan)
  features: {
    autoGradeEnabled: boolean; // AutoGrade exam grading
    levelUpEnabled: boolean; // LevelUp interactive spaces
    scannerAppEnabled: boolean; // Physical scanner device support
    aiChatEnabled: boolean; // AI tutoring in spaces
    aiGradingEnabled: boolean; // Automated exam grading
    analyticsEnabled: boolean; // Advanced analytics dashboard
    parentPortalEnabled: boolean; // Parent access
    bulkImportEnabled: boolean; // CSV student import
    apiAccessEnabled: boolean; // REST API access
  };

  // AI Config
  settings: {
    geminiApiKey?: string; // Encrypted, per-tenant API key
    defaultEvaluationSettingsId?: string;
    defaultAiModel?: string;
    timezone?: string;
    locale?: string;
    gradingPolicy?: string;
  };

  // Denormalized stats (updated by Cloud Functions)
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalSpaces: number;
    totalExams: number;
    activeStudentsLast30Days?: number;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 6.2 `School` (Optional Multi-Campus Sub-Unit)

```typescript
// Only needed if a Tenant has multiple physical campuses
interface School {
  id: string;
  tenantId: string;
  name: string; // "Main Campus", "Annexe Campus"
  code?: string; // Short identifier
  address?: Address;
  adminUid?: string; // School-specific admin (optional)
  status: "active" | "inactive";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 6.3 `AcademicSession`

```typescript
interface AcademicSession {
  id: string;
  tenantId: string;
  name: string; // "2024-25", "Jan 2025 Batch", "Semester 1"
  startDate: Timestamp;
  endDate: Timestamp;
  status: "upcoming" | "active" | "completed";
  isDefault: boolean; // The currently active session
  createdAt: Timestamp;
}
```

### 6.4 `Class` (Core Grouping Unit)

```typescript
interface Class {
  id: string;
  tenantId: string;
  schoolId?: string; // Optional: which campus

  name: string; // "Grade 10 — Physics", "Class 12 — Math A"
  subject?: string; // Primary subject (for subject-specific classes)
  grade?: string; // "10", "12", "Undergraduate Year 1"
  displayOrder?: number;

  academicSessionId?: string; // Links to AcademicSession

  // Assignments
  teacherIds: string[]; // Lead teachers for this class
  studentCount: number; // Denormalized count

  // Content assigned to this class
  // (Spaces and Exams store classIds[], not the reverse)

  status: "active" | "archived";
  createdBy: string; // tenantAdmin uid who created it
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 6.5 `Section` (Optional Sub-Class)

```typescript
// For large classes split into sections (A, B, C)
interface Section {
  id: string;
  tenantId: string;
  classId: string; // Parent class

  name: string; // "Section A", "Morning Batch"
  teacherIds: string[]; // Section-specific teacher(s)
  studentCount: number;

  createdAt: Timestamp;
}
```

### 6.6 `UserMembership` (Unified Role Bridge)

```typescript
interface UserMembership {
  id: string; // "${uid}_${tenantId}"
  uid: string; // Firebase Auth UID
  tenantId: string;
  tenantCode: string; // Cached for login verification
  schoolId?: string; // If user belongs to a specific campus

  // Role within this tenant
  role:
    | "superAdmin"
    | "tenantAdmin"
    | "teacher"
    | "student"
    | "parent"
    | "scanner";
  status: "active" | "inactive" | "suspended";

  // How they joined
  joinSource: "admin_created" | "bulk_import" | "invite_code" | "self_register";

  // Links to domain entities
  teacherId?: string; // → /tenants/{tenantId}/teachers/{teacherId}
  studentId?: string; // → /tenants/{tenantId}/students/{studentId}
  parentId?: string; // → /tenants/{tenantId}/parents/{parentId}
  scannerId?: string; // → /scanners/{scannerId}

  // Granular permissions (teacher-specific overrides)
  permissions?: {
    // AutoGrade
    canCreateExams?: boolean;
    canEditRubrics?: boolean;
    canManuallyGrade?: boolean;
    canViewAllExams?: boolean;

    // LevelUp
    canCreateSpaces?: boolean;
    canManageContent?: boolean;
    canViewAnalytics?: boolean;
    canConfigureAgents?: boolean;

    // Scoped content access
    managedSpaceIds?: string[]; // Specific spaces this teacher can edit
    managedClassIds?: string[]; // Classes this teacher manages (auto from Teacher.classIds)
  };

  createdAt: Timestamp;
  lastActive?: Timestamp;
  updatedAt: Timestamp;
}
```

### 6.7 `Student` (Unified Entity)

```typescript
interface Student {
  id: string;
  tenantId: string;
  schoolId?: string;

  // Identity
  authUid?: string; // Firebase Auth UID (nullable for offline/paper students)
  email?: string;
  phone?: string;
  tempPassword?: string; // Encrypted initial password

  // Profile
  firstName: string;
  lastName: string;
  rollNumber: string; // Unique within tenant
  displayName?: string; // Auto-computed: "${firstName} ${lastName}"

  // Enrollment
  classIds: string[]; // Can be in multiple classes (e.g., Math + Science)
  sectionIds?: string[]; // If sections are used
  parentIds: string[];

  // Status
  status: "active" | "inactive" | "graduated";
  lastLogin?: Timestamp;

  metadata?: {
    dateOfBirth?: Timestamp;
    address?: string;
    gender?: string;
    admissionYear?: string;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 6.8 `Teacher` (Unified Entity)

```typescript
interface Teacher {
  id: string;
  tenantId: string;
  schoolId?: string;

  // Identity
  authUid?: string;
  email?: string;
  phone?: string;
  tempPassword?: string;

  // Profile
  firstName: string;
  lastName: string;
  displayName?: string;
  employeeId?: string;
  department?: string;

  // Assignment
  classIds: string[]; // Primary classes they teach
  sectionIds?: string[];
  subjects: string[]; // Subjects they're qualified to teach

  status: "active" | "inactive";
  lastLogin?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 6.9 `Space` (Unified LevelUp Content Container, formerly Course)

```typescript
interface Space {
  id: string;
  tenantId: string; // All spaces are tenant-scoped (no more global courses)

  // Basic Info
  title: string;
  description?: string;
  thumbnailUrl?: string;
  slug?: string;

  // Type
  type: "standard" | "practice_range" | "assessment";

  // Assignment (like Exam.classIds in AutoGrade)
  classIds: string[]; // Which classes have access to this space
  sectionIds?: string[]; // Optional: restrict to specific sections
  teacherIds: string[]; // Teachers who manage this space

  // Access Control
  accessType: "class_assigned" | "tenant_wide" | "public_store";
  isPublic?: boolean; // Only for public_store type (legacy LevelUp support)

  // Content Configuration
  labels?: string[]; // Subject tags
  defaultEvaluatorAgentId?: string;

  // Academic Context
  academicSessionId?: string; // Which session this space belongs to

  // Stats
  stats?: {
    totalItems: number;
    totalStudents: number;
    avgCompletionRate?: number;
  };

  createdBy: string; // Teacher/admin uid
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 7. Tenant Data Isolation Strategy

### 7.1 Core Principle

**All tenant-specific data lives under `/tenants/{tenantId}/...`**

This is AutoGrade's proven isolation strategy, applied universally. No
cross-tenant queries are possible. A user from `tenant_abc` cannot accidentally
read data from `tenant_xyz` — enforced at both Firestore rules and query level.

### 7.2 Isolation Levels

```
Level 1 — Document Isolation (Strongest)
  All business data under /tenants/{tenantId}/
  No cross-tenant document reads possible

Level 2 — Firebase Auth Custom Claims
  Custom claims embed tenantId, role
  Token cannot be forged client-side
  Claims: { tenantId, tenantCode, role, teacherId?, studentId?, ... }

Level 3 — Firestore Security Rules
  All rules check belongsToTenant(tenantId)
  Rule reads UserMembership to verify active status
  No rule bypasses possible from client SDK

Level 4 — Cloud Functions (Admin SDK)
  Backend uses Admin SDK (no rules)
  Tenant scoping enforced in function logic
  All Cloud Task payloads include tenantId for worker isolation
```

### 7.3 Global vs. Tenant-Scoped Collections

```
GLOBAL COLLECTIONS (no tenant scope):
/users/{uid}                    ← Auth identity only (email, phone, authProvider)
/userMemberships/{uid}_{tenantId}  ← Role bridge (uid ↔ tenant)
/scanners/{scannerId}           ← Scanner devices (belongs to tenant via clientId field)
/evaluationSettings/{id}        ← Global presets (read-only for tenants)
/llm-usage/{logId}              ← Cost audit (tenantId field for filtering, not isolation)
/platformStats                  ← Aggregate platform stats

TENANT-SCOPED COLLECTIONS (strict isolation):
/tenants/{tenantId}             ← Tenant config document
/tenants/{tenantId}/schools/{schoolId}
/tenants/{tenantId}/academicSessions/{sessionId}
/tenants/{tenantId}/classes/{classId}
/tenants/{tenantId}/sections/{sectionId}
/tenants/{tenantId}/students/{studentId}
/tenants/{tenantId}/teachers/{teacherId}
/tenants/{tenantId}/parents/{parentId}

AUTOGRADE DATA (Tenant-scoped):
/tenants/{tenantId}/exams/{examId}
/tenants/{tenantId}/exams/{examId}/questions/{questionId}
/tenants/{tenantId}/submissions/{submissionId}
/tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{qId}
/tenants/{tenantId}/evaluationSettings/{settingsId}

LEVELUP DATA (Tenant-scoped):
/tenants/{tenantId}/spaces/{spaceId}
/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}
/tenants/{tenantId}/spaces/{spaceId}/items/{itemId}
/tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}

PROGRESS DATA (Tenant-scoped):
/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}
/tenants/{tenantId}/timedTestSessions/{sessionId}
/tenants/{tenantId}/chatSessions/{sessionId}

ANALYTICS (Tenant-scoped):
/tenants/{tenantId}/leaderboards/{spaceId}
/tenants/{tenantId}/metrics/{metricId}
```

### 7.4 Cross-Tenant Scenarios

| Scenario                                | Approach                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Teacher belongs to two schools          | Two `UserMembership` docs (one per tenantId). Login with school code routes to correct context.                         |
| Student transfers between schools       | Old membership → `status: 'inactive'`. New membership created at new school. Data remains in old tenant for audit.      |
| Global content (LevelUp public courses) | `accessType: 'public_store'`, stored in special tenant `platform_public` or separate global `/publicSpaces/` collection |
| Super admin viewing all tenants         | Admin SDK Cloud Functions bypass rules; frontend uses super admin role claim                                            |

---

## 8. Unified Firestore Schema

### 8.1 Full Collection Hierarchy

```
# ─── GLOBAL ───────────────────────────────────────────────────────────
/users/{uid}
  Fields: uid, email, phone, authProvider, currentTenantId, createdAt, lastLogin

/userMemberships/{uid}_{tenantId}
  Fields: id, uid, tenantId, tenantCode, schoolId?, role, status,
          joinSource, teacherId?, studentId?, parentId?, scannerId?,
          permissions{}, createdAt, lastActive, updatedAt

/scanners/{scannerId}
  Fields: id, authUid?, tenantId, username, firstName, lastName, status,
          createdAt, updatedAt

/evaluationSettings/{settingsId}
  Fields: id, name, isPublic, enabledDimensions[], displaySettings{},
          createdAt, updatedAt

/llm-usage/{logId}
  Fields: tenantId, uid, role, purpose, model, tokens{}, cost{}, timing{},
          success, createdAt, callStartedAt, callCompletedAt, tags[]

/platformStats
  Fields: totalTenants, activeTenants, totalStudents, totalExamsGraded,
          totalLlmCost, lastUpdated

# ─── TENANT (All tenant-specific data) ────────────────────────────────
/tenants/{tenantId}
  Fields: (see Tenant entity, Section 6.1)

/tenants/{tenantId}/schools/{schoolId}
  Fields: (see School entity, Section 6.2)

/tenants/{tenantId}/academicSessions/{sessionId}
  Fields: (see AcademicSession entity, Section 6.3)

/tenants/{tenantId}/classes/{classId}
  Fields: (see Class entity, Section 6.4)

/tenants/{tenantId}/sections/{sectionId}
  Fields: (see Section entity, Section 6.5)

/tenants/{tenantId}/students/{studentId}
  Fields: (see Student entity, Section 6.7)

/tenants/{tenantId}/teachers/{teacherId}
  Fields: (see Teacher entity, Section 6.8)

/tenants/{tenantId}/parents/{parentId}
  Fields: id, tenantId, authUid?, email, phone, tempPassword?,
          firstName, lastName, studentIds[], status, createdAt, lastLogin

# ─── AUTOGRADE DATA ───────────────────────────────────────────────────
/tenants/{tenantId}/exams/{examId}
  Fields: id, tenantId, classIds[], sectionIds?,
          title, subject, topics[], examDate, duration, totalMarks, passingMarks,
          status, questionPaper{}, questionPaperType, gradingConfig{},
          evaluationSettingsId?, academicSessionId?, createdAt, updatedAt

/tenants/{tenantId}/exams/{examId}/questions/{questionId}
  Fields: id, examId, text, maxMarks, order, rubric{}, type,
          evaluationGuidance?, createdAt

/tenants/{tenantId}/submissions/{submissionId}
  Fields: id, tenantId, examId, studentId, studentName, rollNumber, classId,
          sectionId?, answerSheets{}, scoutingResult?, summary{}, createdAt

/tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{questionId}
  Fields: id, submissionId, questionId, examId, mapping{}, evaluation?,
          status, createdAt, updatedAt

/tenants/{tenantId}/evaluationSettings/{settingsId}
  Fields: (same as global preset, but tenant-specific)

# ─── LEVELUP DATA ─────────────────────────────────────────────────────
/tenants/{tenantId}/spaces/{spaceId}
  Fields: (see Space entity, Section 6.9)

/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}
  Fields: id, spaceId, tenantId, title, description, orderIndex,
          type ('standard'|'timed_test'|'practice'), sections[],
          createdAt, updatedAt

/tenants/{tenantId}/spaces/{spaceId}/items/{itemId}
  Fields: id, storyPointId, sectionId, tenantId, type, payload{},
          meta{totalPoints, tags[]}, createdAt, updatedAt

/tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}
  Fields: id, spaceId, tenantId, type ('tutor'|'evaluator'),
          systemPrompt, modelConfig{}, createdAt

# ─── PROGRESS DATA ─────────────────────────────────────────────────────
/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}
  Fields: id, userId, spaceId, tenantId, status, pointsEarned, totalPoints,
          items{itemId: ItemProgressEntry}, updatedAt

/tenants/{tenantId}/timedTestSessions/{sessionId}
  Fields: id, userId, spaceId, storyPointId, tenantId,
          status, startedAt, endedAt, durationMinutes,
          questionOrder[], submissions{itemId: UserAnswer}, createdAt

/tenants/{tenantId}/chatSessions/{sessionId}
  Fields: id, userId, itemId, tenantId, messages[], systemPrompt,
          createdAt, updatedAt

# ─── ANALYTICS ─────────────────────────────────────────────────────────
/tenants/{tenantId}/leaderboards/{spaceId}
  Fields: spaceId, tenantId, entries[], updatedAt

/tenants/{tenantId}/metrics/{metricId}
  Fields: metricId, tenantId, type, value, period, createdAt
```

### 8.2 Key Index Patterns

```json
{
  "indexes": [
    // UserMemberships — find all tenants for a user
    {
      "collection": "userMemberships",
      "fields": [{ "field": "uid" }, { "field": "status" }]
    },

    // UserMemberships — find all users in a tenant
    {
      "collection": "userMemberships",
      "fields": [
        { "field": "tenantId" },
        { "field": "role" },
        { "field": "status" }
      ]
    },

    // Classes by tenant + session
    {
      "collection": "classes",
      "fields": [
        { "field": "tenantId" },
        { "field": "academicSessionId" },
        { "field": "createdAt", "dir": "DESC" }
      ]
    },

    // Students by class membership
    {
      "collection": "students",
      "fields": [
        { "field": "classIds", "arrayConfig": "CONTAINS" },
        { "field": "createdAt", "dir": "DESC" }
      ]
    },

    // Exams by class
    {
      "collection": "exams",
      "fields": [
        { "field": "classIds", "arrayConfig": "CONTAINS" },
        { "field": "examDate", "dir": "DESC" }
      ]
    },

    // Spaces by class
    {
      "collection": "spaces",
      "fields": [
        { "field": "classIds", "arrayConfig": "CONTAINS" },
        { "field": "createdAt", "dir": "DESC" }
      ]
    },

    // Submissions by exam
    {
      "collection": "submissions",
      "fields": [{ "field": "examId" }, { "field": "createdAt", "dir": "DESC" }]
    },

    // Space progress by user
    {
      "collection": "spaceProgress",
      "fields": [{ "field": "userId" }, { "field": "status" }]
    },

    // LLM usage by tenant + date
    {
      "collection": "llm-usage",
      "fields": [
        { "field": "tenantId" },
        { "field": "createdAt", "dir": "DESC" }
      ]
    }
  ]
}
```

---

## 9. Role Hierarchy & Permissions

### 9.1 Role Definitions

```
Super Admin  (Platform Operator)
  Scope: Platform-wide
  Access: All tenants, all data (via Admin SDK)
  Capabilities:
    ✅ Create/suspend/delete tenants
    ✅ Manage subscription plans
    ✅ View platform analytics and costs
    ✅ Assign tenant admin roles
    ✅ Access any tenant's data
    ✅ Manage global evaluation presets
    ✅ Manage scanner device registration

Tenant Admin  (School Administrator)
  Scope: Their tenant only
  Access: All data within /tenants/{tenantId}/
  Capabilities:
    ✅ Create/manage schools, classes, sections, academic sessions
    ✅ Create/manage teachers, students, parents
    ✅ Bulk import students via CSV
    ✅ Create/assign spaces and exams to classes
    ✅ Configure AI settings (Gemini API key)
    ✅ Configure evaluation settings
    ✅ View all analytics within tenant
    ✅ Manage scanner devices for their school
    ✅ Grant teacher-specific permissions

Teacher  (Educator)
  Scope: Their assigned classes within tenant
  Access: Class-scoped content, class-scoped student data
  Default Capabilities:
    ✅ View students in their assigned classes
    ✅ View spaces assigned to their classes
    ✅ View exams for their classes
    ✅ View submission results for their class students
    ❌ Cannot create exams (unless granted canCreateExams)
    ❌ Cannot create spaces (unless granted canCreateSpaces)
    ❌ Cannot view other teachers' classes
  Optional (granted per-teacher):
    ⚙️ canCreateExams
    ⚙️ canEditRubrics
    ⚙️ canManuallyGrade
    ⚙️ canCreateSpaces
    ⚙️ canManageContent
    ⚙️ canViewAnalytics
    ⚙️ canConfigureAgents

Student  (Learner)
  Scope: Their enrolled classes within tenant
  Access: Content assigned to their classes, own progress/results
  Capabilities:
    ✅ Access spaces assigned to their enrolled classes
    ✅ View own exam results and AI feedback
    ✅ Track own learning progress
    ✅ Use AI chat tutor (if enabled)
    ❌ Cannot view other students' data
    ❌ Cannot access admin or teacher features

Parent  (Guardian)
  Scope: Their linked children within tenant
  Access: Children's progress and results only
  Capabilities:
    ✅ View linked children's space progress
    ✅ View linked children's exam results
    ✅ Receive notifications about results
    ❌ Cannot access any other student data

Scanner  (Device Account)
  Scope: Their registered tenant
  Access: Upload answer sheets only
  Capabilities:
    ✅ Upload answer sheet images for assigned exams
    ✅ Select exam and student for upload
    ❌ Cannot view results, content, or student profiles
```

### 9.2 Firebase Auth Custom Claims

```typescript
// Super Admin
{ role: 'superAdmin' }

// Tenant Admin
{
  role: 'tenantAdmin',
  tenantId: 'ten_abc123',
  tenantCode: 'SPR001'
}

// Teacher
{
  role: 'teacher',
  tenantId: 'ten_abc123',
  tenantCode: 'SPR001',
  teacherId: 'tch_xyz',
  classIds: ['cls_1', 'cls_2'],   // Cached for quick access checks
  permissions: {                   // Cached subset of permissions
    canCreateExams: true,
    canCreateSpaces: false
  }
}

// Student
{
  role: 'student',
  tenantId: 'ten_abc123',
  tenantCode: 'SPR001',
  studentId: 'stu_xyz',
  classIds: ['cls_1']
}

// Parent
{
  role: 'parent',
  tenantId: 'ten_abc123',
  tenantCode: 'SPR001',
  parentId: 'par_xyz',
  studentIds: ['stu_a', 'stu_b']
}

// Scanner
{
  role: 'scanner',
  tenantId: 'ten_abc123',
  tenantCode: 'SPR001',
  scannerId: 'sc_xyz'
}
```

### 9.3 Permission Matrix

| Capability                 | Super Admin | Tenant Admin | Teacher (default) | Teacher (+perms) | Student | Parent | Scanner |
| -------------------------- | :---------: | :----------: | :---------------: | :--------------: | :-----: | :----: | :-----: |
| Manage tenants             |     ✅      |      ❌      |        ❌         |        ❌        |   ❌    |   ❌   |   ❌    |
| Create classes             |     ✅      |      ✅      |        ❌         |        ❌        |   ❌    |   ❌   |   ❌    |
| Bulk import students       |     ✅      |      ✅      |        ❌         |        ❌        |   ❌    |   ❌   |   ❌    |
| Create exams               |     ✅      |      ✅      |        ❌         |        ✅        |   ❌    |   ❌   |   ❌    |
| Create spaces              |     ✅      |      ✅      |        ❌         |        ✅        |   ❌    |   ❌   |   ❌    |
| Grade submissions          |     ✅      |      ✅      |        ❌         |        ✅        |   ❌    |   ❌   |   ❌    |
| Upload answer sheets       |     ✅      |      ✅      |    Class-only     |    Class-only    |   ❌    |   ❌   |   ✅    |
| View class analytics       |     ✅      |      ✅      |    Class-only     |    Class-only    |   ❌    |   ❌   |   ❌    |
| View own results           |     ✅      |      ✅      |        ✅         |        ✅        |   ✅    |   ❌   |   ❌    |
| View child results         |      —      |      —       |         —         |        —         |    —    |   ✅   |   ❌    |
| Configure AI/eval settings |     ✅      |      ✅      |        ❌         |        ❌        |   ❌    |   ❌   |   ❌    |
| Manage scanner devices     |     ✅      |      ✅      |        ❌         |        ❌        |   ❌    |   ❌   |   ❌    |

---

## 10. Subscription & Billing Model

### 10.1 Plans

| Plan         | Price Tier    | Target                      | Key Limits                                        |
| ------------ | ------------- | --------------------------- | ------------------------------------------------- |
| `trial`      | Free / 30-day | New schools evaluating      | 50 students, 5 exams, 2 spaces                    |
| `basic`      | ₹X/month      | Small schools               | 200 students, 20 exams/month, 10 spaces           |
| `premium`    | ₹XX/month     | Growing schools             | 1,000 students, 100 exams/month, unlimited spaces |
| `enterprise` | Custom        | Large institutions / chains | Unlimited, multi-campus, dedicated support        |

### 10.2 Feature Flag Matrix by Plan

| Feature                |    trial     | basic |  premium  | enterprise |
| ---------------------- | :----------: | :---: | :-------: | :--------: |
| `levelUpEnabled`       |      ✅      |  ✅   |    ✅     |     ✅     |
| `autoGradeEnabled`     | ✅ (limited) |  ✅   |    ✅     |     ✅     |
| `aiChatEnabled`        |      ❌      |  ✅   |    ✅     |     ✅     |
| `aiGradingEnabled`     | ✅ (5/month) |  ✅   |    ✅     |     ✅     |
| `analyticsEnabled`     |      ❌      | Basic | Advanced  |   Custom   |
| `scannerAppEnabled`    |      ❌      |  ✅   |    ✅     |     ✅     |
| `parentPortalEnabled`  |      ❌      |  ❌   |    ✅     |     ✅     |
| `bulkImportEnabled`    |      ❌      |  ✅   |    ✅     |     ✅     |
| `apiAccessEnabled`     |      ❌      |  ❌   |    ❌     |     ✅     |
| `maxStudents`          |      50      |  200  |   1,000   | Unlimited  |
| `maxExamsPerMonth`     |      5       |  20   |    100    | Unlimited  |
| `maxSpaces`            |      2       |  10   | Unlimited | Unlimited  |
| Multi-campus (Schools) |      ❌      |  ❌   |    ❌     |     ✅     |
| Custom AI models       |      ❌      |  ❌   |    ❌     |     ✅     |

### 10.3 Billing Entity Design

```typescript
// Billing is part of Tenant.subscription (Section 6.1)
// Additional billing tracking:
interface BillingRecord {
  id: string;
  tenantId: string;
  period: string; // "2025-02" (year-month)
  plan: string;
  aiCost: number; // USD total AI spend this period
  examsGraded: number;
  studentsActive: number;
  invoiceStatus: "pending" | "paid" | "overdue";
  createdAt: Timestamp;
}
// Path: /tenants/{tenantId}/billing/{period}
```

### 10.4 API Key Management

- Each tenant provides their own Gemini API key (`settings.geminiApiKey`,
  encrypted at rest)
- Platform can provide a shared key for `trial` plan with rate limiting
- AI costs tracked per-tenant in `/llm-usage` collection with `tenantId` field
- Cloud Functions enforce cost limits by plan (reject calls if monthly budget
  exceeded)

---

## 11. Content (Spaces) in Org Context

### 11.1 How LevelUp Courses → Spaces Transition to Tenant Scope

**Before (LevelUp global model):**

```
/courses/{courseId}    ← Global. Anyone who redeems code gets access.
  orgId?: string       ← Optional loose link to org
```

**After (Unified tenant model):**

```
/tenants/{tenantId}/spaces/{spaceId}  ← Strict tenant scope
  classIds: string[]                   ← Assigned to specific classes
  accessType: 'class_assigned' | 'tenant_wide' | 'public_store'
```

### 11.2 Content Access Decision Tree

```
Student requests access to Space:
  │
  ├── Is student's authUid in UserMembership for this tenantId?
  │     No → Deny (403)
  │     Yes ↓
  │
  ├── Is space.accessType = 'tenant_wide'?
  │     Yes → GRANT (all tenant members get access)
  │     No ↓
  │
  ├── Is space.accessType = 'class_assigned'?
  │     Yes → Does student.classIds intersect space.classIds?
  │             Yes → GRANT
  │             No  → Deny (403)
  │
  └── Is space.accessType = 'public_store'?
        Yes → GRANT (public content, no auth needed)
```

### 11.3 Space-Class Assignment Patterns

```
Pattern 1: Class-Specific Space
  Space "Physics Mechanics — Chapter 1"
    classIds: ['cls_grade10_physics_a', 'cls_grade10_physics_b']
  → Only Grade 10 Physics students in Section A and B can access

Pattern 2: Tenant-Wide Space
  Space "School Welcome Guide"
    accessType: 'tenant_wide'
    classIds: []
  → All students in the tenant can access

Pattern 3: Practice Range (all students)
  Space "JEE Practice Bank — Physics PYQs"
    accessType: 'tenant_wide'
    type: 'practice_range'
  → All students can drill on practice questions

Pattern 4: Teacher-Created Content
  Space "My Custom Lesson Plan"
    classIds: ['cls_grade11_math_b']
    teacherIds: ['tch_john_doe']
    createdBy: 'tch_john_doe_uid'
  → Only John's class can access; John can edit
```

### 11.4 Content Hierarchy Within a Space

```
Space (= Course in LevelUp)
  └── StoryPoint  (= Chapter/Lesson, ordered by orderIndex)
        └── Section  (= Sub-section grouping, embedded array)
              └── Item  (= Actual content piece)
                    ├── type: 'question'   (MCQ, code, text, MCAQ, numerical, etc.)
                    ├── type: 'material'   (rich text, video, blog-style)
                    └── type: 'assessment' (graded assessment items)
```

### 11.5 Space-Exam Integration

```
Teacher creates Exam for Class 10 Physics:
  Exam.classIds = ['cls_grade10_physics_a']

After grading, AutoGrade reports missingConcepts = ['Wave Optics', 'Thermodynamics']

System (or teacher) can:
  1. Find Space covering 'Wave Optics' topic
  2. Create targeted practice range
  3. Assign it to Class 10 Physics students who scored < 60%

Data linking:
  Submission.missingConcepts[] → Space.labels[] (topic matching)
  Student.classIds → Space.classIds (access control)
```

---

## 12. Teacher-Class-Student Assignment Model

### 12.1 Core Assignment Entity Relationships

```
Teacher
  ├── classIds[]    → Teacher is assigned to teach these classes
  └── subjects[]    → Subjects they're qualified for

Class
  ├── teacherIds[]  → Teachers assigned to this class
  └── (students enrolled via Student.classIds)

Student
  └── classIds[]    → Classes the student is enrolled in

Space (Content)
  ├── classIds[]    → Classes that can access this space
  └── teacherIds[]  → Teachers who manage/own this space

Exam
  ├── classIds[]    → Classes taking this exam
  └── (created by teacher or admin)
```

### 12.2 Assignment Flows

**Flow 1: Admin Creates a Class**

```
1. TenantAdmin creates Class { name: "Grade 10 A — Physics", subject: "Physics" }
2. TenantAdmin assigns Teacher(s) to class: Class.teacherIds = ['tch_1', 'tch_2']
3. Teacher documents updated: Teacher.classIds += [classId]
4. Custom claims refreshed: teacher's token includes new classId
```

**Flow 2: Student Enrolls**

```
1. Admin creates Student record with classIds: ['cls_grade10_physics_a']
   OR
   Admin bulk imports CSV → Students auto-created with class assignments

2. Firebase Auth account created (or existing account linked)
3. Student custom claims set: { studentId, classIds }
4. Student.classIds stored in Firestore Student doc
```

**Flow 3: Teacher Assigns Space to Class**

```
1. Teacher (with canCreateSpaces) creates Space
2. Teacher assigns Space to their classes: Space.classIds = ['cls_grade10_a']
   OR
   TenantAdmin assigns any Space to any class

3. Students in cls_grade10_a automatically get access (no individual grants)
4. Space visible on student's dashboard via classIds intersection check
```

**Flow 4: Multi-Teacher Class**

```
Class: "Grade 12 — Combined Science"
  teacherIds: ['tch_physics', 'tch_chemistry', 'tch_biology']

Each teacher sees:
  - All students in this class
  - Can create/assign content to this class

Content is subject-tagged to distinguish:
  Space "Optics Revision" { labels: ['physics'], teacherIds: ['tch_physics'] }
  Space "Organic Chemistry" { labels: ['chemistry'], teacherIds: ['tch_chemistry'] }
```

### 12.3 Section-Level Assignments (Optional)

```
When a class is split into sections (e.g., large lecture + small tutorials):

Class: "Grade 11 Mathematics" (40 students)
  Sections:
    - Section A (20 students) → Teacher: tch_johnson
    - Section B (20 students) → Teacher: tch_smith

Student.sectionIds = ['sec_grade11_math_a']

Space assignment can be class-wide or section-specific:
  Space.sectionIds = ['sec_grade11_math_a']  ← Only Section A sees this
  Space.classIds = ['cls_grade11_math']       ← Entire class sees this
```

### 12.4 Academic Session Scoping

```
AcademicSession "2024-25"
  ├── Class "Grade 10 A — Physics"    (academicSessionId = '2024-25')
  ├── Class "Grade 10 B — Physics"    (academicSessionId = '2024-25')
  └── Space "Physics Year Plan"        (academicSessionId = '2024-25')

When session "2024-25" ends:
  - Classes archived (status: 'archived')
  - New classes created for "2025-26"
  - Spaces can be duplicated/re-assigned to new classes
  - Historical progress data preserved

Query: "Show all active classes"
  .where('tenantId', '==', tenantId)
  .where('status', '==', 'active')
  .where('academicSessionId', '==', currentSessionId)
```

---

## 13. Firestore Security Rules Design

### 13.1 Helper Functions

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─── HELPER FUNCTIONS ─────────────────────────────────────────────

    function isAuthenticated() {
      return request.auth != null;
    }

    function getToken() {
      return request.auth.token;
    }

    function isSuperAdmin() {
      return isAuthenticated() && getToken().role == 'superAdmin';
    }

    function isTenantAdmin(tenantId) {
      return isAuthenticated() &&
        getToken().role == 'tenantAdmin' &&
        getToken().tenantId == tenantId;
    }

    function isTeacher(tenantId) {
      return isAuthenticated() &&
        getToken().role == 'teacher' &&
        getToken().tenantId == tenantId;
    }

    function isStudent(tenantId) {
      return isAuthenticated() &&
        getToken().role == 'student' &&
        getToken().tenantId == tenantId;
    }

    function isParent(tenantId) {
      return isAuthenticated() &&
        getToken().role == 'parent' &&
        getToken().tenantId == tenantId;
    }

    function belongsToTenant(tenantId) {
      return isAuthenticated() && getToken().tenantId == tenantId;
    }

    function hasActiveMembership(tenantId) {
      // Check membership document for active status
      return belongsToTenant(tenantId) &&
        exists(/databases/$(database)/documents/userMemberships/$(request.auth.uid + '_' + tenantId)) &&
        get(/databases/$(database)/documents/userMemberships/$(request.auth.uid + '_' + tenantId)).data.status == 'active';
    }

    function hasTeacherPermission(tenantId, perm) {
      return isTeacher(tenantId) &&
        get(/databases/$(database)/documents/userMemberships/$(request.auth.uid + '_' + tenantId)).data.permissions[perm] == true;
    }

    function teachesClass(classId) {
      return isAuthenticated() &&
        (getToken().classIds is list) &&
        classId in getToken().classIds;
    }

    function isEnrolledInClass(classId) {
      return isAuthenticated() &&
        (getToken().classIds is list) &&
        classId in getToken().classIds;
    }

    function isMyStudent(studentId) {
      return isAuthenticated() &&
        (getToken().studentIds is list) &&
        studentId in getToken().studentIds;
    }
```

### 13.2 Collection Rules

```javascript
    // ─── USERS ────────────────────────────────────────────────────────
    match /users/{uid} {
      allow read: if isAuthenticated() && (request.auth.uid == uid || isSuperAdmin());
      allow create, update: if isAuthenticated() && request.auth.uid == uid;
      allow delete: if false; // Admin SDK only
    }

    // ─── USER MEMBERSHIPS ──────────────────────────────────────────────
    match /userMemberships/{membershipId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == resource.data.uid ||
        isTenantAdmin(resource.data.tenantId) ||
        isSuperAdmin()
      );
      // Memberships created/managed via Admin SDK (Cloud Functions)
      allow create, update, delete: if false;
    }

    // ─── TENANTS ───────────────────────────────────────────────────────
    match /tenants/{tenantId} {
      // Tenant members can read their own tenant
      allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
      // Only super admin can create/modify tenants
      allow create, update: if isSuperAdmin();
      allow delete: if isSuperAdmin();

      // ─── SCHOOLS ────────────────────────────────────────────────────
      match /schools/{schoolId} {
        allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
        allow write: if isSuperAdmin() || isTenantAdmin(tenantId);
      }

      // ─── ACADEMIC SESSIONS ──────────────────────────────────────────
      match /academicSessions/{sessionId} {
        allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
        allow write: if isSuperAdmin() || isTenantAdmin(tenantId);
      }

      // ─── CLASSES ─────────────────────────────────────────────────────
      match /classes/{classId} {
        allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
        allow write: if isSuperAdmin() || isTenantAdmin(tenantId);
      }

      // ─── STUDENTS ─────────────────────────────────────────────────────
      match /students/{studentId} {
        // Admins, teachers in same class, student themselves, linked parents
        allow read: if isSuperAdmin() ||
                       isTenantAdmin(tenantId) ||
                       (isTeacher(tenantId) && teachesClass(resource.data.classIds[0])) ||
                       (isStudent(tenantId) && getToken().studentId == studentId) ||
                       (isParent(tenantId) && isMyStudent(studentId));
        allow write: if isSuperAdmin() || isTenantAdmin(tenantId);
      }

      // ─── TEACHERS ──────────────────────────────────────────────────
      match /teachers/{teacherId} {
        allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
        allow write: if isSuperAdmin() || isTenantAdmin(tenantId);
      }

      // ─── SPACES (LevelUp Content) ───────────────────────────────────
      match /spaces/{spaceId} {
        allow read: if isSuperAdmin() ||
                       isTenantAdmin(tenantId) ||
                       (isTeacher(tenantId) && (
                         teachesClass(resource.data.classIds[0]) ||
                         request.auth.uid in resource.data.teacherIds
                       )) ||
                       (isStudent(tenantId) && (
                         resource.data.accessType == 'tenant_wide' ||
                         (resource.data.classIds is list &&
                          (getToken().classIds is list) &&
                          resource.data.classIds.hasAny(getToken().classIds))
                       ));

        // Admins can always write; teachers with permission can write to their spaces
        allow create: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                         hasTeacherPermission(tenantId, 'canCreateSpaces');
        allow update: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                         (hasTeacherPermission(tenantId, 'canManageContent') &&
                          request.auth.uid in resource.data.teacherIds);
        allow delete: if isSuperAdmin() || isTenantAdmin(tenantId);

        // Space sub-collections
        match /storyPoints/{storyPointId} {
          allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
          allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                          hasTeacherPermission(tenantId, 'canManageContent');
        }

        match /items/{itemId} {
          allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
          allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                          hasTeacherPermission(tenantId, 'canManageContent');
        }

        match /agents/{agentId} {
          allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
          allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                          hasTeacherPermission(tenantId, 'canConfigureAgents');
        }
      }

      // ─── EXAMS (AutoGrade) ──────────────────────────────────────────
      match /exams/{examId} {
        allow read: if isSuperAdmin() ||
                       isTenantAdmin(tenantId) ||
                       (isTeacher(tenantId) && teachesClass(resource.data.classIds[0])) ||
                       (isStudent(tenantId) && (getToken().classIds is list) &&
                        resource.data.classIds.hasAny(getToken().classIds));
        allow create: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                         hasTeacherPermission(tenantId, 'canCreateExams');
        allow update: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                         (hasTeacherPermission(tenantId, 'canCreateExams') &&
                          teachesClass(resource.data.classIds[0]));
        allow delete: if isSuperAdmin() || isTenantAdmin(tenantId);

        match /questions/{questionId} {
          allow read: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                         (isTeacher(tenantId) && teachesClass(
                           get(/databases/$(database)/documents/tenants/$(tenantId)/exams/$(examId)).data.classIds[0]
                         ));
          allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                          hasTeacherPermission(tenantId, 'canCreateExams');
        }
      }

      // ─── SUBMISSIONS ────────────────────────────────────────────────
      match /submissions/{submissionId} {
        allow read: if isSuperAdmin() ||
                       isTenantAdmin(tenantId) ||
                       (isTeacher(tenantId) && teachesClass(resource.data.classId)) ||
                       (isStudent(tenantId) && getToken().studentId == resource.data.studentId) ||
                       (isParent(tenantId) && isMyStudent(resource.data.studentId));
        allow create, update: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                                  hasTeacherPermission(tenantId, 'canManuallyGrade') ||
                                  getToken().role == 'scanner';
        allow delete: if isSuperAdmin() || isTenantAdmin(tenantId);

        match /questionSubmissions/{questionId} {
          allow read: if isSuperAdmin() ||
                         isTenantAdmin(tenantId) ||
                         (isTeacher(tenantId)) ||
                         (isStudent(tenantId) && getToken().studentId ==
                           get(/databases/$(database)/documents/tenants/$(tenantId)/submissions/$(submissionId)).data.studentId) ||
                         (isParent(tenantId) && isMyStudent(
                           get(/databases/$(database)/documents/tenants/$(tenantId)/submissions/$(submissionId)).data.studentId));
          allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                          hasTeacherPermission(tenantId, 'canManuallyGrade');
        }
      }

      // ─── PROGRESS DATA ──────────────────────────────────────────────
      match /spaceProgress/{progressId} {
        allow read: if isSuperAdmin() ||
                       isTenantAdmin(tenantId) ||
                       (isTeacher(tenantId)) ||
                       (isAuthenticated() && request.auth.uid == resource.data.userId);
        allow write: if isAuthenticated() && request.auth.uid == resource.data.userId;
      }

      // ─── EVALUATION SETTINGS ────────────────────────────────────────
      match /evaluationSettings/{settingsId} {
        allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
        allow write: if isSuperAdmin() || isTenantAdmin(tenantId);
      }
    }

    // ─── SCANNERS (Global, but tenant-scoped by data) ──────────────────
    match /scanners/{scannerId} {
      allow read: if isSuperAdmin() ||
                     (isTenantAdmin(resource.data.tenantId)) ||
                     (request.auth.uid == resource.data.authUid);
      allow write: if isSuperAdmin() || isTenantAdmin(resource.data.tenantId);
    }

    // ─── GLOBAL EVALUATION SETTINGS (Read-only presets) ───────────────
    match /evaluationSettings/{settingsId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }

  }
}
```

---

## 14. Migration Strategy from Current Systems

### 14.1 AutoGrade Migration (`/clients/` → `/tenants/`)

AutoGrade has clean, isolated data — migration is straightforward:

**Phase A — Rename (Non-breaking):**

```
Data Migration Steps (per client):
1. Read /clients/{clientId}  →  Write /tenants/{tenantId}   (new doc)
2. For each subcollection (classes, students, teachers, etc.):
   Read /clients/{clientId}/{coll}/{id}
   Write /tenants/{tenantId}/{coll}/{id}  (same data, new path)
3. Update /userMemberships: clientId field → tenantId field
4. Verify all Cloud Functions updated to use /tenants/ paths
5. Delete old /clients/ data after verification

Estimated effort: Script + Cloud Function updates, ~1-2 days per dev
Rollback: Keep /clients/ collection until verified, then delete
```

**Phase B — Extended Fields:**

```
New fields to add (all nullable, so non-breaking):
- Tenant.subscription{}  (replaces Tenant.subscriptionPlan)
- Tenant.features{}      (new feature flags)
- Tenant.settings{}      (replaces direct fields)
- Class.academicSessionId (nullable)
- Student.sectionIds[]   (nullable)
```

### 14.2 LevelUp Migration (Global → Tenant-Scoped)

LevelUp data is currently in global collections — this requires more work:

**Phase A — Create Tenant Records:**

```
1. For each /orgs/{orgId}:
   a. Create /tenants/{newTenantId} from OrgDTO fields
   b. Set tenantCode = org.code
   c. Map adminUids to UserMembership docs with role: 'tenantAdmin'

2. For each /userOrgs/{userId}_{orgId}:
   a. Create /userMemberships/{uid}_{newTenantId}
   b. Set role: 'student' (default for org members)
   c. Migrate UserRolesDTO orgAdmin map → role: 'tenantAdmin'
   d. Migrate UserRolesDTO courseAdmin map → permissions.managedSpaceIds
```

**Phase B — Migrate Course Data:**

```
For each /courses/{courseId} with an orgId:
1. Look up mapping: orgId → tenantId
2. Write /tenants/{tenantId}/spaces/{spaceId} from CourseDTO
3. Create /tenants/{tenantId}/classes/{classId} from OrgGroupDTO
4. Set Space.classIds = [classId] for each OrgGroup → Course link
5. Migrate /storyPoints/ → /tenants/{tenantId}/spaces/{spaceId}/storyPoints/
6. Migrate /items/ → /tenants/{tenantId}/spaces/{spaceId}/items/

For courses without orgId (public/personal):
  Option A: Move to special platform_public tenant
  Option B: Keep in global /publicSpaces/ collection
  Option C: Keep individual users' courses under a personal tenant (per user)
  → RECOMMENDATION: Option A (platform_public tenant) simplest
```

**Phase C — Migrate Progress Data:**

```
/userProgress/ → /tenants/{tenantId}/spaceProgress/
/timedTestSessions/ → /tenants/{tenantId}/timedTestSessions/
/chatSessions/ → /tenants/{tenantId}/chatSessions/

Note: Progress data needs userId + spaceId to determine tenantId
```

### 14.3 Migration Timeline

| Phase                              | Scope                        | Effort         | Risk   |
| ---------------------------------- | ---------------------------- | -------------- | ------ |
| Phase A: AutoGrade rename          | Path rename, field additions | Low (scripted) | Low    |
| Phase B: LevelUp tenant creation   | New tenant + membership docs | Medium         | Low    |
| Phase C: LevelUp content migration | Move global → tenant-scoped  | High           | Medium |
| Phase D: Progress data migration   | Move user progress           | Medium         | Medium |
| Phase E: Cloud Functions update    | Update all function paths    | Medium         | Low    |
| Phase F: Security rules update     | New rules for /tenants/      | Low            | Low    |
| Phase G: Frontend updates          | Update all Firestore queries | High           | High   |

### 14.4 Backward Compatibility Strategy

```
1. DUAL READ during migration:
   Code reads from both old and new paths during transition
   Writes go to NEW paths only
   Old data kept read-only until migration verified

2. FEATURE FLAGS in frontend:
   const useTenantPath = featureFlags.unifiedTenancy
   Query path selected at runtime

3. GRADUAL TENANT MIGRATION:
   Migrate one school at a time
   New schools created directly in /tenants/
   Old schools migrated school-by-school with per-school rollout

4. ZERO DOWNTIME:
   Migration scripts run with Admin SDK (no rules bypass needed)
   New data model deployed alongside old
   Schools switched over via a feature flag per tenantId
```

---

## 15. Open Questions & Design Decisions

### 15.1 Decisions Required

| #   | Question                                                                                         | Options                                                                                      | Recommendation                                                                                      |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | **Public LevelUp courses** — Where do global/public courses live?                                | A: `platform_public` tenant, B: Global `/publicSpaces/` collection, C: Deprecate public mode | **Option A** (simplest, consistent model)                                                           |
| 2   | **Teacher creates content** — Do teachers have their own "personal" tenant for drafting?         | A: Yes (draft in personal space, publish to class), B: No (always create in class context)   | **Option B** (simpler, reduces complexity)                                                          |
| 3   | **Section entity** — Is a full Section sub-entity needed now, or just a string field on Student? | A: Full Section entity (flexible), B: `sectionName` string field on Student/Class            | **Start with B**, promote to A if multi-teacher per section is needed                               |
| 4   | **AcademicSession** — Mandatory or optional?                                                     | A: Required on classes/spaces, B: Optional nullable field                                    | **Option B** (optional) — don't block adoption by requiring sessions                                |
| 5   | **Scanner app** — Stays separate app or integrated into teacher app?                             | A: Separate lightweight PWA (current), B: Role-based view in teacher app                     | **Option A** for now (mobile-first UX matters for scanner operators)                                |
| 6   | **LevelUp existing public users** — Users without school codes who used public LevelUp           | A: Migrate to `platform_public` tenant, B: Keep separate consumer mode                       | **Defer** — mark as Consumer Path, design separately                                                |
| 7   | **Multi-campus** — Enable School entity from day 1 or schema-only?                               | A: Full multi-campus support now, B: Schema only, UI deferred to Enterprise tier             | **Option B** — add `schoolId?` field, but don't build multi-campus admin UI until enterprise demand |
| 8   | **Class definition** — Is a class subject-specific or a homeroom group?                          | A: Subject-specific (Physics Grade 10), B: Homeroom (Grade 10 A, enrolled in all subjects)   | **Option A** (AutoGrade pattern) — allows different teachers per subject                            |

### 15.2 Cross-Document Reconciliation: Phase 3A vs Phase 3B Naming

**Issue**: Phase 3A (Unified User & Auth Architecture) was designed in parallel
with this document. Phase 3A uses `/organizations/{orgId}/...` as the Firestore
path and `Organization` as the entity type name, while Phase 3B establishes
`/tenants/{tenantId}/...` and `Tenant` as the canonical naming.

**Resolution**: Phase 3B's naming takes precedence for the following reasons:

| Concern             | Phase 3A                     | Phase 3B (Authoritative)       | Rationale                                                                                           |
| ------------------- | ---------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Firestore root path | `/organizations/{orgId}/...` | `/tenants/{tenantId}/...`      | "Tenant" is the standard SaaS/multi-tenancy term; avoids confusion with LevelUp's loose org concept |
| Top entity type     | `Organization`               | `Tenant`                       | A "Tenant" is unambiguous — one school, one isolation boundary                                      |
| Membership field    | `orgId` on `UserMembership`  | `tenantId` on `UserMembership` | Consistent with path                                                                                |
| Auth claims field   | `activeOrgId`                | `tenantId`                     | Consistent with path                                                                                |
| Role: admin         | `orgAdmin`                   | `tenantAdmin`                  | Consistent with entity name                                                                         |

**Action for Phase 3A**: When implementing, update the Phase 3A types and rules
to use `tenantId`/`tenantAdmin`/`Tenant` vocabulary instead of
`orgId`/`orgAdmin`/`Organization`. The structural design in Phase 3A (membership
model, claims shape, security rules pattern) remains valid — only the naming
changes.

**Mapping table for implementation teams:**

| Phase 3A Term                  | Phase 3B / Canonical Term  |
| ------------------------------ | -------------------------- |
| `Organization` entity          | `Tenant` entity            |
| `/organizations/{orgId}` path  | `/tenants/{tenantId}` path |
| `orgId` field                  | `tenantId` field           |
| `orgAdmin` role                | `tenantAdmin` role         |
| `activeOrgId` claim            | `tenantId` claim           |
| `schoolCode` on `Organization` | `tenantCode` on `Tenant`   |

---

### 15.3 Risks

| Risk                                         | Severity  | Mitigation                                           |
| -------------------------------------------- | --------- | ---------------------------------------------------- |
| LevelUp public users breaking                | 🔴 High   | Maintain consumer path; only migrate org-linked data |
| Progress data migration losing records       | 🔴 High   | Batch migration with verification checksums          |
| Security rule complexity growing             | 🟡 Medium | Modular rule functions, comprehensive tests          |
| Custom claims cache stale after class change | 🟡 Medium | Force token refresh after admin updates classIds     |
| Firestore costs during dual-read migration   | 🟡 Medium | Set time-bounded migration windows, monitor costs    |
| Tenant code collision                        | 🟢 Low    | Enforce unique constraint via Cloud Function         |

---

## Summary

The unified org/multi-tenancy model adopts:

1. **`/tenants/{tenantId}/...`** as the strict isolation boundary (AutoGrade's
   model wins)
2. **`UserMembership`** as the single source of truth for user-tenant-role
   relationships
3. **`Tenant` > `School`? > `Class` > `Section`?** as the optional-depth
   hierarchy
4. **Feature flags** on each Tenant to gate LevelUp vs AutoGrade capabilities by
   subscription plan
5. **`classIds[]`** on Spaces and Exams as the content-to-class assignment
   mechanism (no duplication)
6. **School code login** for all users — tenant routing via `tenantCode` at
   login time
7. **Granular teacher permissions** via `UserMembership.permissions` for
   flexible delegation

The migration path preserves all existing data, migrates AutoGrade first (lower
risk), then incrementally migrates LevelUp org-scoped data, deferring the
public/consumer LevelUp use case to a separate design track.

---

_Document produced from analysis of:_

- _`/LevelUp-App/docs/org-centric-model.md`_
- _`/LevelUp-App/docs/orgs-implementation-plan.md`_
- _`/LevelUp-App/docs/levelup-domain-model.md`_
- _`/docs/autograde-domain-model.md`_
- _`/docs/phase1-autograde-extraction.md` (full AutoGrade domain extraction)_
- _`/docs/phase1-levelup-extraction.md` (full LevelUp domain extraction)_
- _`/docs/UNIFIED_PLATFORM_BRAINSTORM.md`_
- _`/docs/LEVELUP_AUTOGRADE_CORE_TEAM_AND_E2E_ARCHITECTURE.md`_
- _`/docs/phase3a-unified-user-auth.md` (cross-reference for naming
  reconciliation)_

**Document Sessions:**

- _Initial document: `sess_1771516556606_vra2rz0ye` (LevelUp Expert worker)_
- _Cross-doc reconciliation (Section 15.2): `sess_1771518392014_y8h116kzf`
  (Phase 3B worker)_
- _Task: `task_1771515605347_3xas25pw7`_
