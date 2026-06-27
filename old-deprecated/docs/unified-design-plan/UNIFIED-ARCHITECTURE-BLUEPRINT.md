# Master Unified Architecture Blueprint

## LevelUp + AutoGrade — Unified B2B SaaS Platform

**Version:** 1.1 **Date:** 2026-02-19 **Status:** Architecture Blueprint — Ready
for Implementation (Updated with Review Feedback) **Synthesized from:** Phase
1A, 1B, 2, 3A, 3B, 3C, 3D architecture documents **Output of:**
`task_1771515617010_j7y7tw7j4` — Phase 4

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Vision & Design Principles](#2-platform-vision--design-principles)
3. [Complete Firestore Schema](#3-complete-firestore-schema)
4. [Full Feature List](#4-full-feature-list)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [User Journey Maps by Role](#6-user-journey-maps-by-role)
7. [App Navigation & Screen Architecture](#7-app-navigation--screen-architecture)
8. [Authentication & Identity Architecture](#8-authentication--identity-architecture)
9. [Content & Assessment Architecture](#9-content--assessment-architecture)
10. [AI & Evaluation Architecture](#10-ai--evaluation-architecture)
11. [Progress Tracking & Analytics](#11-progress-tracking--analytics)
12. [Migration Strategy](#12-migration-strategy)
13. [Phase-Wise Implementation Roadmap](#13-phase-wise-implementation-roadmap)
14. [Key Architecture Decisions (ADR Log)](#14-key-architecture-decisions-adr-log)
15. [Open Questions & Risks](#15-open-questions--risks)

---

## 1. Executive Summary

### What We Are Building

A **unified B2B SaaS platform** combining:

- **AutoGrade**: AI-powered exam grading for physical handwritten answer sheets
- **LevelUp**: Interactive digital learning spaces with AI tutoring

Both products share a **single Firebase project**, a **single user identity
system**, and a **single multi-tenant data model**. Schools (tenants) can enable
either or both products via feature flags on their subscription plan.

### Core Architecture Choices

| Decision             | Choice                                     | Rationale                                                                                                 |
| -------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Database**         | Firebase Firestore + RTDB                  | Both existing codebases are Firebase-native; minimize migration risk                                      |
| **Tenant isolation** | `/tenants/{tenantId}/...` (path-based)     | AutoGrade's proven strict isolation model; prevents cross-tenant data leaks                               |
| **Identity**         | Single Firebase Auth UID per person        | One user, one UID, multiple org memberships via `userMemberships`                                         |
| **Content model**    | Two-track coexistence (Space + Exam)       | LevelUp's Space/StoryPoint/Item and AutoGrade's Exam/Question coexist under tenant, linked but not merged |
| **Naming**           | `Tenant` (not Organization/Client)         | Standard SaaS multi-tenancy term; unambiguous                                                             |
| **AI calls**         | All server-side via Cloud Functions        | Secure API key management, cost tracking, no client-side keys                                             |
| **Scoring**          | Dual: marks (academic) + points (gamified) | Both systems' scoring models preserved; context determines display                                        |

### Technology Stack

| Layer    | Technology                                                    |
| -------- | ------------------------------------------------------------- |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui       |
| State    | Zustand + TanStack Query                                      |
| Backend  | Firebase Cloud Functions (Node.js/TypeScript)                 |
| Database | Firestore (primary) + RTDB (real-time progress, leaderboards) |
| Auth     | Firebase Authentication + Custom Claims                       |
| Storage  | Firebase Cloud Storage (answer sheets, media)                 |
| AI/LLM   | Google Gemini 2.5 Flash/Pro (tenant-provided API keys)        |
| Monorepo | NPM/pnpm Workspaces                                           |

---

## 2. Platform Vision & Design Principles

### Design Principles

| #   | Principle                          | Detail                                                                                   |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | **One user, one UID**              | A person has exactly one Firebase Auth UID across all products and tenants               |
| 2   | **Tenant isolation first**         | All school data is strictly scoped under `/tenants/{tenantId}/...`                       |
| 3   | **Membership-driven roles**        | Roles stored in Firestore `userMemberships`, not hardcoded in Auth claims                |
| 4   | **Claims for hot path only**       | Firebase custom claims carry only minimum needed for Firestore rule evaluation           |
| 5   | **Consumer users are first class** | Individual B2C users (not in any school) are fully supported for LevelUp                 |
| 6   | **Multi-org capable**              | A single user can belong to multiple tenants with different roles                        |
| 7   | **Two-track content**              | Space domain (LevelUp) and Exam domain (AutoGrade) coexist with cross-domain linkage     |
| 8   | **Server-side AI only**            | All LLM calls go through Cloud Functions for security, cost tracking, and key management |
| 9   | **Feature-flag gated**             | Products enabled per-tenant via `features` flags on the Tenant entity                    |
| 10  | **Dual scoring**                   | Both marks (academic/AutoGrade) and points (gamified/LevelUp) supported simultaneously   |

---

## 3. Complete Firestore Schema

### 3.1 Collection Hierarchy Overview

```
# ═══════════════════════════════════════════════════════════════════════════
# GLOBAL COLLECTIONS (no tenant scope)
# ═══════════════════════════════════════════════════════════════════════════

/users/{uid}                              ← Platform identity (product-agnostic)
/userMemberships/{uid}_{tenantId}         ← Role bridge (user ↔ tenant)
/scanners/{scannerId}                     ← Scanner device accounts
/evaluationSettings/{settingsId}          ← Global evaluation presets (SuperAdmin)
/llm-usage/{logId}                        ← Platform-wide AI cost audit log
/platformStats                            ← Aggregate platform statistics

# ═══════════════════════════════════════════════════════════════════════════
# TENANT-SCOPED COLLECTIONS (strict path isolation)
# ═══════════════════════════════════════════════════════════════════════════

/tenants/{tenantId}                       ← Tenant configuration (school)
  │
  ├── /schools/{schoolId}                 ← Optional multi-campus sub-unit
  ├── /academicSessions/{sessionId}       ← Academic year/semester/batch
  ├── /classes/{classId}                  ← Class (cohort: Grade + Subject)
  │
  ├── /students/{studentId}              ← Student entity (role profile)
  ├── /teachers/{teacherId}              ← Teacher entity (role profile)
  ├── /parents/{parentId}                ← Parent entity (role profile)
  │
  │   ── LEVELUP CONTENT ──
  ├── /spaces/{spaceId}                  ← Learning content container
  │   ├── /storyPoints/{storyPointId}    ← Chapter/lesson
  │   ├── /items/{itemId}                ← Content atom (question/material/etc.)
  │   └── /agents/{agentId}              ← AI evaluator/tutor configuration
  │
  │   ── AUTOGRADE CONTENT ──
  ├── /exams/{examId}                    ← Paper-based exam
  │   └── /questions/{questionId}        ← Exam question with rubric
  │
  │   ── SUBMISSIONS & SESSIONS ──
  ├── /submissions/{submissionId}        ← AutoGrade answer sheet submission
  │   └── /questionSubmissions/{qId}     ← Per-question grading result
  ├── /digitalTestSessions/{sessionId}   ← LevelUp quiz/timed test session
  │
  │   ── PROGRESS DATA ──
  ├── /spaceProgress/{userId}_{spaceId}  ← LevelUp space completion tracking
  ├── /practiceProgress/{userId}_{spaceId} ← Practice mode (flushed from RTDB)
  ├── /chatSessions/{sessionId}          ← AI tutor chat history
  │
  │   ── ANALYTICS ──
  ├── /studentProgressSummaries/{userId} ← Cross-system student summary
  ├── /classProgressSummaries/{classId}  ← Class-level analytics (teacher view)
  ├── /examAnalytics/{examId}            ← Per-exam statistical analysis
  ├── /leaderboards/{spaceId}            ← Space leaderboard
  ├── /evaluationSettings/{settingsId}   ← Tenant-specific RELMS config
  │
  │   ── AI COST TRACKING ──
  ├── /llmCallLogs/{callId}             ← Per-call AI usage log
  ├── /costSummaries/daily/{YYYY-MM-DD} ← Daily AI cost summary
  └── /costSummaries/monthly/{YYYY-MM}  ← Monthly budget + alerts

# ═══════════════════════════════════════════════════════════════════════════
# RTDB PATHS (real-time, high-frequency)
# ═══════════════════════════════════════════════════════════════════════════

practiceProgress/{tenantId}/{userId}/{spaceId}/{itemId}  ← Practice mode live data
leaderboards/{tenantId}/{spaceId}                         ← Real-time leaderboard
```

### 3.2 Entity Definitions

#### `/users/{uid}` — Platform Identity

```typescript
interface UnifiedUser {
  uid: string; // Firebase Auth UID = document ID
  email?: string;
  phone?: string;
  authProviders: ("email" | "phone" | "google" | "apple")[];
  displayName: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  country?: string;
  age?: number;
  grade?: string; // Self-reported grade level (consumer)
  onboardingCompleted?: boolean;
  preferences?: Record<string, unknown>;
  isSuperAdmin: boolean; // Set only via Cloud Function
  consumerProfile?: {
    plan: "free" | "pro" | "premium";
    enrolledSpaceIds: string[]; // Public/purchased spaces
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLogin?: Timestamp;
  status: "active" | "suspended" | "deleted";
}
```

#### `/userMemberships/{uid}_{tenantId}` — Role Bridge

```typescript
interface UserMembership {
  id: string; // "${uid}_${tenantId}"
  uid: string;
  tenantId: string;
  tenantCode: string; // Cached for login verification
  schoolId?: string; // If multi-campus

  role:
    | "superAdmin"
    | "tenantAdmin"
    | "teacher"
    | "student"
    | "parent"
    | "scanner";
  status: "active" | "inactive" | "suspended";
  joinSource:
    | "admin_created"
    | "bulk_import"
    | "invite_code"
    | "self_register"
    | "migration";

  // Links to role-specific entity docs
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;

  // Granular permissions (teacher-specific)
  permissions?: {
    canCreateExams?: boolean;
    canEditRubrics?: boolean;
    canManuallyGrade?: boolean;
    canViewAllExams?: boolean;
    canCreateSpaces?: boolean;
    canManageContent?: boolean;
    canViewAnalytics?: boolean;
    canConfigureAgents?: boolean;
    managedSpaceIds?: string[];
    managedClassIds?: string[];
  };

  createdAt: Timestamp;
  lastActive?: Timestamp;
  updatedAt: Timestamp;
}
```

#### `/tenants/{tenantId}` — Tenant (School/Institution)

```typescript
interface Tenant {
  id: string;
  name: string;
  shortName?: string;
  slug: string;
  description?: string;
  tenantCode: string; // Unique login code (e.g., "SPR001")
  ownerUid: string; // Primary admin Firebase UID

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

  status: "active" | "suspended" | "trial" | "expired";

  subscription: {
    plan: "trial" | "basic" | "premium" | "enterprise";
    expiresAt?: Timestamp;
    maxStudents?: number;
    maxTeachers?: number;
    maxSpaces?: number;
    maxExamsPerMonth?: number;
  };

  features: {
    autoGradeEnabled: boolean;
    levelUpEnabled: boolean;
    scannerAppEnabled: boolean;
    aiChatEnabled: boolean;
    aiGradingEnabled: boolean;
    analyticsEnabled: boolean;
    parentPortalEnabled: boolean;
    bulkImportEnabled: boolean;
    apiAccessEnabled: boolean;
  };

  settings: {
    geminiKeyRef?: string; // Secret Manager reference path (see addendum §1.1)
    geminiKeySet: boolean; // Whether a Gemini API key is configured
    defaultEvaluationSettingsId?: string;
    defaultAiModel?: string;
    timezone?: string;
    locale?: string;
    gradingPolicy?: string;
  };

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

#### `/tenants/{tenantId}/classes/{classId}` — Class (Cohort)

```typescript
interface Class {
  id: string;
  tenantId: string;
  schoolId?: string;
  name: string; // "Grade 10 — Physics"
  subject?: string;
  grade?: string; // "10", "12"
  displayOrder?: number;
  academicSessionId?: string;
  teacherIds: string[];
  studentCount: number; // Denormalized
  status: "active" | "archived";
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `/tenants/{tenantId}/students/{studentId}` — Student Profile

```typescript
interface Student {
  id: string;
  tenantId: string;
  schoolId?: string;
  authUid?: string; // Nullable for offline/paper-only students
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  rollNumber: string; // Unique within tenant
  displayName?: string;
  classIds: string[];
  sectionIds?: string[];
  parentIds: string[];
  status: "active" | "inactive" | "graduated" | "deleted";
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

#### `/tenants/{tenantId}/teachers/{teacherId}` — Teacher Profile

```typescript
interface Teacher {
  id: string;
  tenantId: string;
  schoolId?: string;
  authUid?: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  employeeId?: string;
  department?: string;
  classIds: string[];
  sectionIds?: string[];
  subjects: string[];
  status: "active" | "inactive" | "deleted";
  lastLogin?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `/tenants/{tenantId}/spaces/{spaceId}` — Learning Space

```typescript
interface Space {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  slug?: string;
  type: "learning" | "practice" | "assessment" | "resource" | "hybrid";
  classIds: string[];
  sectionIds?: string[];
  teacherIds: string[];
  accessType: "class_assigned" | "tenant_wide" | "public_store";
  subject?: string;
  labels?: string[];
  academicSessionId?: string;
  defaultEvaluatorAgentId?: string;
  defaultTutorAgentId?: string;
  defaultTimeLimitMinutes?: number;
  allowRetakes?: boolean;
  maxRetakes?: number;
  status: "draft" | "published" | "archived";
  publishedAt?: Timestamp;
  stats?: {
    totalStoryPoints: number;
    totalItems: number;
    totalStudents: number;
    avgCompletionRate?: number;
  };
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `/tenants/{tenantId}/exams/{examId}` — Paper Exam

```typescript
interface Exam {
  id: string;
  tenantId: string;
  title: string;
  subject: string;
  topics: string[];
  classIds: string[];
  sectionIds?: string[];
  examDate: Timestamp;
  duration: number; // Minutes
  academicSessionId?: string;
  totalMarks: number;
  passingMarks: number;
  questionPaper?: {
    images: string[];
    extractedAt: Timestamp;
    questionCount: number;
    examType: "standard" | "diagram_heavy" | "high_volume" | "manual_rubric";
  };
  gradingConfig: {
    autoGrade: boolean;
    allowRubricEdit: boolean;
    questionPaperType: string;
    evaluationSettingsId?: string;
    allowManualOverride: boolean;
    requireOverrideReason: boolean;
    releaseResultsAutomatically: boolean;
  };
  linkedSpaceId?: string; // Digital practice content link
  linkedStoryPointId?: string;
  status:
    | "draft"
    | "question_paper_uploaded"
    | "question_paper_extracted"
    | "in_progress"
    | "grading"
    | "completed"
    | "archived";
  evaluationSettingsId?: string;
  stats?: {
    totalSubmissions: number;
    gradedSubmissions: number;
    avgScore: number;
    passRate: number;
  };
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.3 Firebase Auth Custom Claims

```typescript
// Minimal claims for Firestore rule evaluation (max 1000 bytes)
interface PlatformClaims {
  role?:
    | "superAdmin"
    | "tenantAdmin"
    | "teacher"
    | "student"
    | "parent"
    | "scanner";
  tenantId?: string;
  tenantCode?: string;
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;
  classIds?: string[];
  classIdsOverflow?: boolean; // True if user has >15 classes (see addendum §3.3)
  studentIds?: string[]; // Parent's linked children
}
```

### 3.4 Key Composite Indexes

| Collection            | Fields                                          | Purpose                            |
| --------------------- | ----------------------------------------------- | ---------------------------------- |
| `userMemberships`     | `uid ASC, status ASC`                           | Find all tenants for a user        |
| `userMemberships`     | `tenantId ASC, role ASC, status ASC`            | Find all users in a tenant by role |
| `spaces`              | `classIds CONTAINS, status ASC, createdAt DESC` | Spaces for a class                 |
| `spaces`              | `teacherIds CONTAINS, status ASC`               | Spaces managed by a teacher        |
| `exams`               | `classIds CONTAINS, examDate DESC`              | Exams for a class                  |
| `submissions`         | `examId ASC, classId ASC, createdAt DESC`       | Submissions per exam per class     |
| `submissions`         | `studentId ASC, createdAt DESC`                 | Student's exam history             |
| `digitalTestSessions` | `userId ASC, storyPointId ASC, isLatest ASC`    | Latest test attempt                |
| `spaceProgress`       | `userId ASC, status ASC`                        | Student's space progress           |
| `llmCallLogs`         | `tenantId ASC, createdAt DESC`                  | AI cost by tenant                  |
| `students`            | `classIds CONTAINS, status ASC`                 | Students in a class                |
| `teachers`            | `classIds CONTAINS, status ASC`                 | Teachers for a class               |
| `exams`               | `linkedSpaceId ASC, status ASC`                 | Exams linked to a space            |

---

## 4. Full Feature List

### 4.1 Platform-Level Features

| Feature                         | Description                                    | Roles                   |
| ------------------------------- | ---------------------------------------------- | ----------------------- |
| **Tenant management**           | Create, suspend, delete tenants (schools)      | SuperAdmin              |
| **Subscription management**     | Assign plans, set limits, toggle feature flags | SuperAdmin              |
| **Global evaluation presets**   | Default RELMS feedback dimensions              | SuperAdmin              |
| **Platform analytics**          | Total tenants, students, exams graded, AI cost | SuperAdmin              |
| **Scanner device registration** | Register/manage physical scanner devices       | SuperAdmin, TenantAdmin |

### 4.2 Tenant Administration Features

| Feature                          | Description                                               | Roles       |
| -------------------------------- | --------------------------------------------------------- | ----------- |
| **School setup**                 | Configure tenant: name, code, branding, address, API keys | TenantAdmin |
| **Academic sessions**            | Create/manage semesters, academic years                   | TenantAdmin |
| **Class management**             | Create classes with subject, grade, assign teachers       | TenantAdmin |
| **User management**              | Create/edit teachers, students, parents                   | TenantAdmin |
| **Bulk student import**          | CSV upload for mass student + parent creation             | TenantAdmin |
| **Role & permission management** | Toggle teacher-specific permissions                       | TenantAdmin |
| **Evaluation settings**          | Configure RELMS feedback dimensions for tenant            | TenantAdmin |
| **AI settings**                  | Configure Gemini API key, default model                   | TenantAdmin |
| **Tenant analytics dashboard**   | Org-wide KPIs across both products                        | TenantAdmin |
| **Cost monitoring**              | AI usage costs, budget alerts                             | TenantAdmin |

### 4.3 AutoGrade Features (Exam Grading)

| Feature                           | Description                                         | Roles                                 |
| --------------------------------- | --------------------------------------------------- | ------------------------------------- |
| **Exam creation**                 | Set exam metadata, assign to classes                | TenantAdmin, Teacher (+perm)          |
| **Question paper upload**         | Upload scanned question paper images                | TenantAdmin, Teacher                  |
| **AI question extraction**        | Gemini extracts questions + marks from paper        | System (Cloud Function)               |
| **Rubric editing**                | Review/edit AI-extracted rubrics per question       | TenantAdmin, Teacher (+perm)          |
| **Answer sheet upload**           | Upload student answer sheet images                  | TenantAdmin, Teacher, Scanner         |
| **AI page scouting (Panopticon)** | AI identifies which questions on which pages        | System (Cloud Function)               |
| **AI grading (RELMS)**            | AI grades each question against rubric              | System (Cloud Function)               |
| **Manual grade override**         | Teacher overrides AI grade with reason              | TenantAdmin, Teacher (+perm)          |
| **Result release**                | Teacher releases grades to students                 | TenantAdmin, Teacher                  |
| **Student result view**           | View per-exam scores with structured feedback       | Student                               |
| **Parent result view**            | View children's exam results                        | Parent                                |
| **Exam analytics**                | Score distribution, question difficulty, pass rates | TenantAdmin, Teacher                  |
| **Type 2 diagram exams**          | Zero-LLM page mapping for diagram-heavy papers      | System                                |
| **PDF result export**             | Download student result as PDF                      | TenantAdmin, Teacher, Student, Parent |

### 4.4 LevelUp Features (Learning Spaces)

| Feature                      | Description                                                                                                                                                          | Roles                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Space creation**           | Create learning spaces with type, class assignment                                                                                                                   | TenantAdmin, Teacher (+perm) |
| **Story point authoring**    | Create chapters/lessons within spaces                                                                                                                                | TenantAdmin, Teacher (+perm) |
| **Rich content items**       | 7 item types: question, material, interactive, assessment, discussion, project, checkpoint                                                                           | TenantAdmin, Teacher         |
| **15 question types**        | MCQ, MCAQ, true-false, numerical, text, paragraph, code, fill-blanks, matching, jumbled, audio, image_evaluation, group-options, chat_agent_question, fill-blanks-dd | System                       |
| **Rich material types**      | Text, video, PDF, link, interactive, story, rich (blog-style editor)                                                                                                 | TenantAdmin, Teacher         |
| **AI evaluator agents**      | Configure per-space/per-item AI evaluation agents                                                                                                                    | TenantAdmin, Teacher (+perm) |
| **AI tutor agents**          | Configure AI tutoring chat agents per space                                                                                                                          | TenantAdmin, Teacher (+perm) |
| **Timed tests**              | Server-enforced timer, 5-status question tracking, auto-submit                                                                                                       | System                       |
| **Interactive quizzes**      | Short graded quizzes with immediate feedback                                                                                                                         | Student                      |
| **Practice mode**            | Unlimited drill, immediate feedback, RTDB-backed                                                                                                                     | Student                      |
| **AI tutoring chat**         | Context-aware multi-language AI tutor sessions                                                                                                                       | Student                      |
| **Space progress tracking**  | Per-item, per-story-point completion tracking                                                                                                                        | Student, Teacher             |
| **Real-time leaderboards**   | Course and story point leaderboards via RTDB                                                                                                                         | Student, Teacher             |
| **Multi-attempt support**    | Students can retake quizzes/tests (configurable)                                                                                                                     | Student                      |
| **Bloom's taxonomy tagging** | Items tagged with cognitive level                                                                                                                                    | Teacher (authoring)          |
| **PYQ metadata**             | Previous Year Question metadata on practice items                                                                                                                    | Teacher (authoring)          |
| **Space analytics**          | Completion rates, engagement, topic performance                                                                                                                      | TenantAdmin, Teacher         |
| **Publish workflow**         | Draft → Published → Archived lifecycle                                                                                                                               | TenantAdmin, Teacher         |

### 4.5 Cross-System Features (New)

| Feature                          | Description                                                  | Roles                    |
| -------------------------------- | ------------------------------------------------------------ | ------------------------ |
| **Exam-Space linkage**           | Link paper exams to digital practice spaces                  | Teacher                  |
| **Weak topic recommendations**   | After exam grading, recommend LevelUp spaces for weak topics | System → Student         |
| **Cross-system student summary** | Unified progress view across both products                   | Student, Teacher, Parent |
| **At-risk student detection**    | Nightly detection of students needing intervention           | System → Teacher         |
| **Topic correlation**            | LevelUp engagement ↔ AutoGrade exam performance correlation  | Teacher (analytics)      |
| **Enhanced grading feedback**    | Link AutoGrade feedback to LevelUp content for study         | System                   |
| **Unified teacher dashboard**    | Single view: all classes, spaces, exams, analytics           | Teacher                  |

### 4.6 Consumer (B2C) Features

| Feature                       | Description                                             | Roles    |
| ----------------------------- | ------------------------------------------------------- | -------- |
| **Public space browsing**     | Browse public learning spaces without school enrollment | Consumer |
| **Space purchase/enrollment** | Enroll in paid spaces via purchase                      | Consumer |
| **Practice & timed tests**    | Full access to space content                            | Consumer |
| **AI chat tutor**             | AI tutoring (if enabled on space)                       | Consumer |
| **Consumer leaderboards**     | Cross-consumer leaderboards                             | Consumer |
| **Social login**              | Google, Apple sign-in                                   | Consumer |

---

## 5. User Roles & Permissions

### 5.1 Role Hierarchy

```
Platform Level
└── SuperAdmin — manages all tenants, billing, platform ops

Tenant Level (one tenant = one school/institution)
├── TenantAdmin — manages users, classes, content, exams, settings, billing
├── Teacher — creates/manages content for assigned classes
│   └── With granular permissions: canCreateExams, canCreateSpaces, etc.
├── Student — accesses assigned content, takes tests, views results
├── Parent/Guardian — views linked children's progress and results
└── Scanner — uploads answer sheets only

Platform Level (no tenant)
└── Consumer — individual learner, accesses public/purchased LevelUp spaces
```

### 5.2 Permission Matrix

| Capability                | Super Admin | Tenant Admin | Teacher (default) | Teacher (+perms) | Student | Parent | Scanner | Consumer |
| ------------------------- | :---------: | :----------: | :---------------: | :--------------: | :-----: | :----: | :-----: | :------: |
| Manage tenants            |     ✅      |      —       |         —         |        —         |    —    |   —    |    —    |    —     |
| Create classes            |     ✅      |      ✅      |         —         |        —         |    —    |   —    |    —    |    —     |
| Create teachers/students  |     ✅      |      ✅      |         —         |        —         |    —    |   —    |    —    |    —     |
| Bulk import students      |     ✅      |      ✅      |         —         |        —         |    —    |   —    |    —    |    —     |
| Create exams              |     ✅      |      ✅      |         —         |        ✅        |    —    |   —    |    —    |    —     |
| Upload question paper     |     ✅      |      ✅      |        ✅         |        ✅        |    —    |   —    |    —    |    —     |
| Upload answer sheets      |     ✅      |      ✅      |        ✅         |        ✅        |    —    |   —    |   ✅    |    —     |
| Manual grade override     |     ✅      |      ✅      |         —         |        ✅        |    —    |   —    |    —    |    —     |
| Release exam results      |     ✅      |      ✅      |        ✅         |        ✅        |    —    |   —    |    —    |    —     |
| Create spaces             |     ✅      |      ✅      |         —         |        ✅        |    —    |   —    |    —    |    —     |
| Manage space content      |     ✅      |      ✅      |         —         |        ✅        |    —    |   —    |    —    |    —     |
| Configure AI agents       |     ✅      |      ✅      |         —         |        ✅        |    —    |   —    |    —    |    —     |
| View class analytics      |     ✅      |      ✅      |    Class-only     |    Class-only    |    —    |   —    |    —    |    —     |
| Take quizzes/tests        |      —      |      —       |         —         |        —         |   ✅    |   —    |    —    |    ✅    |
| Use AI tutor chat         |      —      |      —       |         —         |        —         |   ✅    |   —    |    —    |    ✅    |
| View own results          |      —      |      —       |         —         |        —         |   ✅    |   —    |    —    |    ✅    |
| View child's results      |      —      |      —       |         —         |        —         |    —    |   ✅   |    —    |    —     |
| View leaderboards         |     ✅      |      ✅      |        ✅         |        ✅        |   ✅    |   ✅   |    —    |    ✅    |
| Configure tenant settings |     ✅      |      ✅      |         —         |        —         |    —    |   —    |    —    |    —     |
| AI cost monitoring        |     ✅      |      ✅      |         —         |        —         |    —    |   —    |    —    |    —     |

---

## 6. User Journey Maps by Role

### 6.1 TenantAdmin Journey

```
1. ONBOARDING
   Create account → Receive tenant code from SuperAdmin → Login
   → Set up school: name, logo, address, contact
   → Configure subscription: enable AutoGrade + LevelUp features
   → Add Gemini API key → Configure evaluation settings

2. USER SETUP
   → Create academic session (e.g., "2025-26")
   → Create classes (Grade 10 Physics, Grade 12 Math, ...)
   → Create teachers (individual or bulk)
   → Create students (individual or CSV bulk import)
   → Assign teachers to classes
   → Enroll students in classes
   → Optionally create parent accounts, link to students

3. ONGOING OPERATIONS
   → Monitor tenant dashboard (students, exams, spaces, AI costs)
   → Review exam analytics after grading cycles
   → Manage teacher permissions as needed
   → Monitor at-risk students flagged by system
   → End-of-session: archive classes, create new session
```

### 6.2 Teacher Journey

```
1. LOGIN & CONTEXT
   Enter school code → Enter credentials → Auto-select org (or org picker if multi-org)
   → See teacher dashboard: assigned classes, spaces, exams

2. LEVELUP: CREATE LEARNING CONTENT
   → Create Space (title, subject, assign to class)
   → Add Story Points (chapters)
   → Add Items: material (video, text, PDF) + questions (MCQ, paragraph, code, etc.)
   → Configure assessment story points (timed test, quiz)
   → Set AI evaluator agent + rubric for subjective questions
   → Publish space → Students see it in their dashboard

3. AUTOGRADE: CREATE & GRADE EXAM
   → Create Exam (title, subject, assign to class, set marks)
   → Upload question paper images
   → AI extracts questions → Review/edit rubrics
   → Mark exam as ready
   → Upload answer sheets (or scanner operator does this)
   → AI grades automatically (Panopticon + RELMS)
   → Review AI grades → Override if needed (with reason)
   → Release results to students

4. CROSS-SYSTEM ANALYTICS
   → View class progress across both spaces and exams
   → See topic correlations (LevelUp engagement ↔ exam scores)
   → Identify at-risk students
   → Optionally link weak exam topics to recommended spaces

5. ONGOING
   → Monitor student space progress
   → Review AI tutor chat logs (if enabled)
   → Update content, create new assessments per curriculum
```

### 6.3 Student Journey

```
1. LOGIN
   Enter school code → Enter email/roll number + password
   → See student dashboard

2. LEVELUP: LEARN
   → Browse assigned spaces → Open a space
   → Navigate story points (chapters)
   → Read materials (text, video, PDF)
   → Answer questions (immediate feedback for MCQ, AI feedback for text)
   → Take timed tests (server-enforced timer, 5-status tracking)
   → Practice mode (unlimited drill, instant feedback)
   → Chat with AI tutor for help on difficult items
   → Track progress: completion %, points earned, leaderboard rank

3. AUTOGRADE: VIEW RESULTS
   → Receive notification when exam results are released
   → View per-exam scores with structured AI feedback
   → See rubric breakdown per question (marks + feedback dimensions)
   → See improvement recommendations (linked LevelUp spaces)
   → Download result PDF

4. CROSS-SYSTEM
   → Dashboard shows combined progress (spaces + exams)
   → See personalized recommendations based on exam weak topics
   → Upcoming exams listed from AutoGrade
   → Leaderboard across spaces
```

### 6.4 Parent Journey

```
1. LOGIN
   Enter school code → Enter credentials → See parent dashboard

2. VIEW CHILDREN'S DATA
   → See list of linked children (may span multiple schools via org switcher)
   → Per child: view space progress (LevelUp) + exam results (AutoGrade)
   → See structured feedback per exam question
   → See recommendations for improvement
   → Receive notifications on result releases
```

### 6.5 Scanner Operator Journey

```
1. LOGIN
   Enter school code → Enter scanner device credentials → See scanner app

2. UPLOAD ANSWER SHEETS
   → Select active exam + class
   → Scan/photograph answer sheets (per student)
   → Upload images → System creates submission
   → AI pipeline triggers automatically
```

### 6.6 Consumer Journey

```
1. SIGN UP
   → Email/password or Google/Apple social login
   → No school code needed

2. EXPLORE & LEARN
   → Browse public spaces in store
   → Enroll in free or purchased spaces
   → Full learning experience: materials, questions, timed tests, practice
   → AI tutor chat (if enabled)
   → Track progress, leaderboard rank
```

---

## 7. App Navigation & Screen Architecture

### 7.1 Application Surface Map

| App Surface                             | Target Users     | Key Screens                                                              |
| --------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| **Admin Web** (`apps/admin-web`)        | TenantAdmin      | Tenant setup, classes, users, bulk import, analytics, AI config, billing |
| **Teacher Web** (`apps/teacher-web`)    | Teacher          | Dashboard, space editor, exam editor, grading review, class analytics    |
| **Student Web** (`apps/student-web`)    | Student          | Dashboard, space viewer, test runner, results, chat tutor, leaderboard   |
| **Parent Web** (`apps/parent-web`)      | Parent           | Dashboard, child progress, exam results                                  |
| **Scanner App** (`apps/scanner-mobile`) | Scanner Operator | Exam selector, camera capture, batch upload                              |
| **Super Admin** (`apps/super-admin`)    | SuperAdmin       | Tenant management, platform analytics, global settings                   |
| **Consumer Web** (public-facing)        | Consumer         | Store, space viewer, test runner, profile, leaderboard                   |

### 7.2 Screen Architecture: Teacher Web

```
Teacher Web
├── Login (school code → credentials)
├── Dashboard
│   ├── My Classes (cards with student count, content count)
│   ├── Recent Activity (space updates, exam grading status)
│   └── Quick Actions (create space, create exam)
│
├── Class Detail (per class)
│   ├── Overview (students, teachers, content)
│   ├── Spaces Tab (LevelUp spaces assigned)
│   ├── Exams Tab (AutoGrade exams assigned)
│   ├── Students Tab (enrolled students + progress)
│   └── Analytics Tab (cross-system insights)
│
├── Space Editor
│   ├── Space Settings (title, type, class assignment)
│   ├── Story Point List (drag-to-reorder)
│   ├── Story Point Editor
│   │   ├── Section Manager
│   │   ├── Item Editor (question/material/assessment)
│   │   └── Assessment Config (timer, retakes, scoring)
│   ├── Agent Config (evaluator/tutor setup)
│   └── Publish Controls
│
├── Exam Editor
│   ├── Exam Settings (title, subject, class, marks)
│   ├── Question Paper Upload
│   ├── Question Review (extracted questions + rubrics)
│   ├── Submission Manager (upload answer sheets)
│   ├── Grading Review (per-student, per-question)
│   └── Results Release
│
├── Analytics
│   ├── Class Overview
│   ├── Exam Analytics (score distribution, per-question stats)
│   ├── Space Analytics (completion rates, engagement)
│   └── At-Risk Students
│
└── Profile & Settings
```

### 7.3 Screen Architecture: Student Web

```
Student Web
├── Login (school code → credentials)
├── Dashboard
│   ├── Progress Overview (combined LevelUp + AutoGrade)
│   ├── My Spaces (assigned learning spaces)
│   ├── My Results (exam results — AutoGrade)
│   ├── Recommendations (from Insight Engine)
│   └── Upcoming (exams, deadlines)
│
├── Space Viewer
│   ├── Space Home (story points list + progress)
│   ├── Story Point Viewer
│   │   ├── Material Reader (text/video/PDF)
│   │   ├── Question Answerer (per-question interaction)
│   │   └── Assessment Status (progress bar)
│   ├── Timed Test Runner
│   │   ├── Question Navigator (5-status grid)
│   │   ├── Answer Area (per question type)
│   │   ├── Timer Display (server-enforced)
│   │   └── Submit / Auto-submit
│   ├── Practice Mode (drill)
│   └── AI Tutor Chat (per-item context)
│
├── Exam Results
│   ├── Result Summary (score, grade, percentage)
│   ├── Per-Question Feedback (marks, rubric, AI feedback)
│   ├── Recommendations (linked spaces for weak topics)
│   └── PDF Download
│
├── Leaderboard
│   ├── Space Leaderboard
│   └── Overall Leaderboard
│
└── Profile
```

---

## 8. Authentication & Identity Architecture

### 8.1 Auth Flows

**School User Login (B2B):**

```
1. Enter school code → lookup /tenants where tenantCode == input
2. Show school name for confirmation
3. Enter email/rollNumber + password → signInWithEmailAndPassword
4. Load userMemberships for (uid, tenantId)
5. If 1 membership → auto-select
   If 2+ memberships → show org picker
6. Set active tenant in app state → redirect to role dashboard
```

**Consumer Login (B2C):**

```
1. Email/password or Google/Apple OAuth
2. No school code needed
3. Read /users/{uid} → consumer profile
```

**Roll Number Login (Students):**

```
Derive synthetic email: {rollNumber}@{tenantId}.levelup.internal
Student types: rollNumber + schoolCode + password
System uses derived email for Firebase Auth (uses immutable tenantId, not tenantCode)
```

### 8.2 Multi-Org Switcher

```
1. Auth success → query userMemberships where uid == currentUser.uid
2. If 1 membership → auto-select
3. If 2+ → show org picker
4. On switch → Cloud Function updates custom claims → force token refresh
5. App state updates → navigate to role dashboard
```

### 8.3 Custom Claims Design

Claims are **minimal** (max 1000 bytes JWT limit). Full role context always read
from Firestore.

```typescript
// Set by Cloud Functions only
{
  role: 'teacher',
  tenantId: 'ten_abc',
  tenantCode: 'SPR001',
  teacherId: 'tch_xyz',
  classIds: ['cls_1', 'cls_2']  // Cached for quick rule checks
}
```

### 8.4 Cloud Functions: Auth Lifecycle

| Function                   | Trigger                    | Action                                                      |
| -------------------------- | -------------------------- | ----------------------------------------------------------- |
| `onUserCreated`            | Firebase Auth user created | Create `/users/{uid}` document                              |
| `createOrgUser`            | Callable (by TenantAdmin)  | Create Auth account + role entity + membership + set claims |
| `switchActiveTenant`       | Callable (by user)         | Validate membership → update claims → token refresh         |
| `onUserDeleted`            | Firebase Auth user deleted | Soft-delete user doc + deactivate all memberships           |
| `updateTeacherPermissions` | Callable (by TenantAdmin)  | Update membership permissions + refresh claims              |

---

## 9. Content & Assessment Architecture

### 9.1 Two-Track Content Model

The platform maintains two distinct content tracks that coexist under the tenant
namespace:

```
TENANT NAMESPACE
├── Space Domain (LevelUp lineage)
│     Space > StoryPoint > Item
│     Assessment modes: interactive_quiz, timed_test, practice
│
└── Exam Domain (AutoGrade lineage)
      Exam > Question
      Assessment mode: paper_exam
      Optional link: exam.linkedSpaceId → Space
```

### 9.2 Four Unified Assessment Modes

| Mode                 | Entity                         | Answer Medium            | Grading Pipeline     | Timer           |
| -------------------- | ------------------------------ | ------------------------ | -------------------- | --------------- |
| **Interactive Quiz** | StoryPoint (type='quiz')       | Digital in-app           | Immediate + AI agent | Optional        |
| **Timed Test**       | StoryPoint (type='timed_test') | Digital in-app           | AI agent-based       | Server-enforced |
| **Paper Exam**       | Exam                           | Physical paper → scanned | Panopticon + RELMS   | Not enforced    |
| **Practice**         | StoryPoint (type='practice')   | Digital in-app           | Immediate feedback   | None            |

### 9.3 UnifiedItem Model

A single canonical item definition used across both Space content and Exam
question authoring:

- 7 top-level item types: `question`, `material`, `interactive`, `assessment`,
  `discussion`, `project`, `checkpoint`
- 15 question subtypes: MCQ, MCAQ, true-false, numerical, text, paragraph, code,
  fill-blanks, fill-blanks-dd, matching, jumbled, audio, image_evaluation,
  group-options, chat_agent_question
- 7 material subtypes: text, video, PDF, link, interactive, story, rich
- Dual scoring: `meta.totalPoints` (LevelUp) + `meta.maxMarks` (AutoGrade)
- Educational metadata: Bloom's taxonomy, cognitive load, skills assessed, PYQ
  info
- Per-item AI evaluator override capability

### 9.4 UnifiedRubric

Bridges both grading systems in a single structure:

```typescript
interface UnifiedRubric {
  criteria?: RubricCriterion[]; // Marks-based (AutoGrade model)
  dimensions?: EvaluationDimension[]; // RELMS/agent feedback dimensions
  scoringMode: "criteria_based" | "dimension_based" | "holistic" | "hybrid";
  passingPercentage?: number;
  showModelAnswer?: boolean;
  modelAnswer?: string;
  evaluatorGuidance?: string;
}
```

Rubric inheritance: `Tenant default → Exam/Space → StoryPoint → Item` (each
level can override)

### 9.5 Class Assignment Model

Both Spaces and Exams use identical `classIds[]` + `sectionIds[]` patterns:

```
Class
  ├── teacherIds[] → assigned teachers
  └── (students enrolled via Student.classIds[])

Space.classIds[] → classes that can access the space
Exam.classIds[]  → classes taking the exam

Assignment is always at Class level, not individual student level.
```

---

## 10. AI & Evaluation Architecture

### 10.1 AI Feature Map

| Feature                           | Pipeline            | Model                 | Cost Tier   |
| --------------------------------- | ------------------- | --------------------- | ----------- |
| Question paper extraction         | Cloud Function      | Gemini 2.5 Flash      | Medium      |
| Handwriting OCR                   | Cloud Function      | Gemini 2.5 Flash      | Medium      |
| Answer page scouting (Panopticon) | Cloud Function      | Gemini 2.5 Flash      | Medium-High |
| RELMS grading (per-question)      | Cloud Function      | Gemini 2.5 Flash      | Medium      |
| AI tutoring chat                  | Cloud Function      | Gemini 2.5 Flash Lite | Low         |
| Answer evaluation (LevelUp)       | Cloud Function      | Gemini 2.5 Flash Lite | Low         |
| Feedback enhancement              | Rule-based (no LLM) | N/A                   | Zero        |
| Insight generation                | Rule-based (no LLM) | N/A                   | Zero        |

### 10.2 Shared AI Infrastructure

- **All AI calls are server-side** via Cloud Functions using `LLMWrapper`
- **Per-tenant API keys** stored encrypted in Firestore
  (`Tenant.settings.geminiApiKey`)
- **Every call logged** to `llmCallLogs` with tokens, cost, latency, resource
  attribution
- **Cost limits enforced** by plan (reject calls if monthly budget exceeded)
- **Budget alerts**: 80% → warning email, 100% → pause AI features

### 10.3 AutoGrade Grading Pipeline (Unchanged)

```
Submission Upload → OCR → Panopticon Scouting → RELMS Grading
→ Feedback Generation → Teacher Review/Override → Result Release
```

### 10.4 LevelUp AI (Migrated Server-Side)

```
Before: Client Browser → Gemini SDK (client-side, hardcoded key)
After:  Client Browser → Cloud Function → LLMWrapper → Gemini API
                                            ↓
                                       LLMCallLog (cost tracking)
```

### 10.5 UnifiedEvaluationResult

Single output format for all grading pipelines:

```typescript
interface UnifiedEvaluationResult {
  score: number; // Marks awarded or points earned
  maxScore: number;
  correctness: number; // 0–1 normalized (universal)
  percentage: number; // 0–100
  structuredFeedback?: Record<string, FeedbackItem[]>;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  rubricBreakdown?: RubricBreakdownItem[];
  summary?: { keyTakeaway: string; overallComment: string };
  confidence: number; // 0–1
  mistakeClassification?:
    | "Conceptual"
    | "Silly Error"
    | "Knowledge Gap"
    | "None";
  tokensUsed?: { input: number; output: number };
  costUsd?: number;
  gradedAt: Timestamp;
}
```

---

## 11. Progress Tracking & Analytics

### 11.1 Progress Data Architecture

```
Student Progress Sources:
├── LevelUp: /tenants/{tenantId}/spaceProgress/{userId}_{spaceId}
│   └── Per-item granularity: points, status, attempts, time spent
├── AutoGrade: /tenants/{tenantId}/submissions/{submissionId}
│   └── Per-question: marks, AI feedback, rubric breakdown
├── Practice: RTDB practiceProgress/{tenantId}/{userId}/{spaceId}
│   └── High-frequency, periodic flush to Firestore
└── Aggregated: /tenants/{tenantId}/studentProgressSummaries/{userId}
    └── Derived by Cloud Functions, powers dashboards
```

### 11.2 StudentProgressSummary (Cross-System)

Pre-aggregated document per student, updated by Cloud Functions on every
progress change:

- **LevelUp summary**: spaces completed, overall percentage, per-subject
  performance, practice stats
- **AutoGrade summary**: exams taken, average percentage, per-subject
  performance, weak topics
- **Cross-system insights**: topic correlations (LevelUp score vs AutoGrade
  score), personalized recommendations, engagement signals

### 11.3 Analytics Pipeline

| Document                   | Update Trigger                                           | SLA      |
| -------------------------- | -------------------------------------------------------- | -------- |
| `studentProgressSummaries` | Space progress write, submission complete                | < 30s    |
| `classProgressSummaries`   | Student summary updated (3-min debounce via Cloud Tasks) | < 5min   |
| `examAnalytics`            | All submissions graded (on-demand + daily)               | < 5min   |
| `tenantAnalytics/current`  | Nightly Cloud Scheduler                                  | < 1 hour |
| RTDB leaderboards          | Item submitted                                           | < 5s     |

### 11.4 Insight Engine (Cross-System Intelligence)

Rule-based (no LLM) system generating recommendations:

1. **Exam weak topic → Space recommendation**: After grading, find LevelUp
   spaces covering weak topics
2. **Engagement-score gap analysis**: High LevelUp completion + low exam score →
   flag for applied practice
3. **At-risk detection**: Low scores + low engagement → flag for teacher
   intervention
4. **Unused space prompts**: Assigned but not-started spaces → prompt to begin

---

## 12. Migration Strategy

### 12.1 Migration Overview

Both existing apps have live production data that must be migrated to the
unified schema.

```
Migration Priority:
1. AutoGrade (lower risk — already path-isolated, clean rename)
2. LevelUp (higher effort — global collections → tenant-scoped)
```

### 12.2 AutoGrade Migration: `/clients/` → `/tenants/`

```
Phase A: Rename (Non-breaking)
  1. /clients/{clientId} → /tenants/{tenantId} (new doc, same data + new fields)
  2. All subcollections: classes, students, teachers, exams, submissions → copy to /tenants/
  3. /userMemberships: clientId → tenantId field rename
  4. Cloud Functions updated to use /tenants/ paths
  5. Add nullable new fields: subscription{}, features{}, settings{}

Phase B: Verify & Cleanup
  1. Run validation script comparing old/new data
  2. Delete old /clients/ collection after 2-week parallel run

Estimated effort: 1-2 days (scripted)
Risk: Low
```

### 12.3 LevelUp Migration: Global → Tenant-Scoped

```
Phase A: Create Tenant Records
  1. /orgs/{orgId} → /tenants/{tenantId} (field mapping from OrgDTO)
  2. Generate tenantCode for each (from org.code)
  3. /userOrgs + /userRoles → /userMemberships (unified)

Phase B: Migrate Content
  1. /courses/{courseId} with orgId → /tenants/{tenantId}/spaces/{spaceId}
  2. /storyPoints/ → /tenants/{tenantId}/spaces/{spaceId}/storyPoints/
  3. /items/ → /tenants/{tenantId}/spaces/{spaceId}/items/
  4. /course_agents/ → /tenants/{tenantId}/spaces/{spaceId}/agents/
  5. Public/orphan courses → platform_public tenant

Phase C: Migrate Progress Data
  1. /userStoryPointProgress/ → /tenants/{tenantId}/spaceProgress/
  2. /timedTestSessions/ → /tenants/{tenantId}/digitalTestSessions/
  3. /chatSessions/ → /tenants/{tenantId}/chatSessions/

Estimated effort: 1-2 weeks (revised from 3-5 days per review feedback)
Risk: Medium (large data volume, progress must be accurate)
```

### 12.4 User Identity Merge

```
For each Firebase Auth user:
  1. Read LevelUp /users/{uid} → levelupProfile
  2. Read AutoGrade /users/{uid} → autogradeProfile
     (also check /users/{email} for AutoGrade email-keyed docs)
  3. Merge into UnifiedUser:
     - displayName: levelupProfile.displayName || auth.displayName
     - country/age/grade: from levelupProfile
     - authProviders: union of both
     - createdAt: min of both
     - lastLogin: max of both
  4. Write to /users/{uid} (unified)
  5. Delete /users/{email} artifacts
```

### 12.5 Migration Execution Pattern

```
Phase A: Read from old, write to both old + new (dual-write)
Phase B: Read from new, write to both (backward compat)
Phase C: Read and write new only; delete old collections

Migrate one school at a time (feature flag per tenantId).
New schools created directly in /tenants/.
```

---

## 13. Phase-Wise Implementation Roadmap

### Phase 0: Foundation (Weeks 1-2)

**Goal**: Shared infrastructure, monorepo setup, CI/CD

| Task                           | Deliverable                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo restructure           | `apps/` (admin, teacher, student, parent, scanner, super-admin) + `packages/` (shared-types, shared-ui, shared-services, firebase) |
| Shared type definitions        | `packages/shared-types/src/` — all entities from this blueprint as TypeScript interfaces                                           |
| Firebase project configuration | Firestore rules skeleton, Storage rules, Functions project structure                                                               |
| CI/CD pipeline                 | Lint, type-check, test, deploy per app                                                                                             |
| Auth foundation                | Firebase Auth setup, login/signup UI shells                                                                                        |

### Phase 1: Identity & Tenant (Weeks 2-4)

**Goal**: Unified auth, multi-tenancy, user management

| Task                                                                    | Deliverable                                  |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| `/users/{uid}` collection + UnifiedUser entity                          | Platform identity CRUD                       |
| `/userMemberships/{uid}_{tenantId}` collection                          | Membership CRUD + Cloud Functions            |
| `/tenants/{tenantId}` collection + Tenant entity                        | Tenant CRUD (SuperAdmin)                     |
| Auth flows: school-code login, consumer login, multi-org switcher       | Login screens + Cloud Functions              |
| Custom claims: set/refresh on login, org switch, role change            | Cloud Functions                              |
| Firestore security rules: identity layer                                | Rules for /users, /userMemberships, /tenants |
| User management UI: create teachers, students, parents                  | Admin web screens                            |
| Bulk CSV import                                                         | Cloud Function + Admin web uploader          |
| **Migration**: AutoGrade users + LevelUp users → unified /users         | Migration script                             |
| **Migration**: Memberships from both systems → unified /userMemberships | Migration script                             |

### Phase 2: Tenant Operations (Weeks 4-6)

**Goal**: Classes, academic sessions, teacher-class-student assignments

| Task                                                               | Deliverable                               |
| ------------------------------------------------------------------ | ----------------------------------------- |
| `/tenants/{tenantId}/classes/{classId}`                            | Class CRUD                                |
| `/tenants/{tenantId}/students/{studentId}`                         | Student CRUD                              |
| `/tenants/{tenantId}/teachers/{teacherId}`                         | Teacher CRUD                              |
| `/tenants/{tenantId}/parents/{parentId}`                           | Parent CRUD                               |
| `/tenants/{tenantId}/academicSessions/{sessionId}`                 | Session management                        |
| Teacher-class assignment flow                                      | Admin UI + Cloud Functions                |
| Student-class enrollment flow                                      | Admin UI + Cloud Functions                |
| Parent-student linkage                                             | Admin UI + Cloud Functions                |
| Teacher permissions management                                     | Admin UI (toggle per-teacher permissions) |
| **Migration**: AutoGrade clients → tenants                         | Migration script                          |
| **Migration**: AutoGrade classes/students/teachers → tenant-scoped | Migration script                          |
| **Migration**: LevelUp orgs → tenants                              | Migration script                          |

### Phase 3: AutoGrade Core (Weeks 6-9)

**Goal**: Exam grading pipeline fully operational under `/tenants/`

| Task                                                                            | Deliverable                        |
| ------------------------------------------------------------------------------- | ---------------------------------- |
| `/tenants/{tenantId}/exams/{examId}`                                            | Exam CRUD                          |
| `/tenants/{tenantId}/exams/{examId}/questions/{qId}`                            | Question management                |
| Question paper upload + AI extraction                                           | Cloud Function + UI                |
| Rubric editing UI                                                               | Teacher/Admin web                  |
| `/tenants/{tenantId}/submissions/{submissionId}`                                | Submission pipeline                |
| Answer sheet upload (web + scanner app)                                         | Upload UI + Storage                |
| Panopticon scouting pipeline                                                    | Cloud Function                     |
| RELMS grading pipeline                                                          | Cloud Function                     |
| Manual grade override                                                           | Teacher UI                         |
| Result release flow                                                             | Teacher UI + student notifications |
| Student result view                                                             | Student web                        |
| Parent result view                                                              | Parent web                         |
| Exam analytics                                                                  | Cloud Function + Teacher UI        |
| `/tenants/{tenantId}/evaluationSettings/{settingsId}`                           | Tenant eval config                 |
| **Migration**: AutoGrade exams, submissions, evaluationSettings → tenant-scoped | Migration script                   |

### Phase 4: LevelUp Core (Weeks 9-12)

**Goal**: Learning spaces fully operational under `/tenants/`

| Task                                                                              | Deliverable                          |
| --------------------------------------------------------------------------------- | ------------------------------------ |
| `/tenants/{tenantId}/spaces/{spaceId}`                                            | Space CRUD                           |
| `/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}`                         | StoryPoint CRUD                      |
| `/tenants/{tenantId}/spaces/{spaceId}/items/{itemId}`                             | Item CRUD                            |
| `/tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}`                           | Agent config                         |
| Space editor (teacher web)                                                        | Rich content authoring UI            |
| Space viewer (student web)                                                        | Learning experience UI               |
| Timed test runner                                                                 | Student web (5-status, server timer) |
| Practice mode                                                                     | Student web + RTDB                   |
| AI tutor chat (server-side)                                                       | Cloud Function + Chat UI             |
| AI answer evaluation (server-side)                                                | Cloud Function                       |
| Space progress tracking                                                           | Firestore + RTDB                     |
| Leaderboards                                                                      | RTDB + UI                            |
| Publish workflow (draft/published/archived)                                       | Space editor                         |
| **Migration**: LevelUp courses → spaces, storyPoints → storyPoints, items → items | Migration script                     |
| **Migration**: LevelUp progress data → tenant-scoped                              | Migration script                     |

### Phase 5: Cross-System Intelligence (Weeks 12-14)

**Goal**: Unified analytics, recommendations, cross-system insights

| Task                                                      | Deliverable                     |
| --------------------------------------------------------- | ------------------------------- |
| `studentProgressSummaries` aggregation                    | Cloud Function                  |
| `classProgressSummaries` aggregation                      | Cloud Function (debounced)      |
| `examAnalytics` computation                               | Cloud Function                  |
| Exam-Space linkage                                        | Teacher UI + Exam.linkedSpaceId |
| Insight Engine (rule-based recommendations)               | Cloud Function                  |
| Enhanced grading feedback (link to LevelUp content)       | Cloud Function                  |
| At-risk student detection                                 | Nightly Cloud Scheduler         |
| Unified student dashboard                                 | Student web                     |
| Unified teacher dashboard (cross-system class view)       | Teacher web                     |
| AI cost tracking (`llmCallLogs`, daily/monthly summaries) | Cloud Functions + Admin UI      |
| Budget alert system                                       | Cloud Function + email          |

### Phase 6: Polish & Scale (Weeks 14-16)

**Goal**: Production hardening, consumer path, cleanup

| Task                                               | Deliverable           |
| -------------------------------------------------- | --------------------- |
| Consumer (B2C) path: public spaces, purchase flow  | Consumer web          |
| Scanner app update (new API paths)                 | Scanner mobile        |
| Performance optimization (query patterns, caching) | Engineering           |
| Security rules comprehensive audit                 | Engineering           |
| Old collection cleanup (delete migrated data)      | Migration script      |
| Load testing                                       | Engineering           |
| Documentation                                      | API docs, user guides |

---

## 14. Key Architecture Decisions (ADR Log)

### ADR-001: Tenant Naming — "Tenant" over "Organization" or "Client"

**Decision**: Use `Tenant` as the canonical top-level entity name.
**Rationale**: "Tenant" is the standard SaaS multi-tenancy term. "Organization"
(LevelUp) and "Client" (AutoGrade) are both ambiguous. One isolation boundary =
one tenant. **Impact**: Phase 3A's `/organizations/` references must be updated
to `/tenants/`.

### ADR-002: Path-Based Isolation over Field-Based

**Decision**: All tenant data under `/tenants/{tenantId}/...` (Firestore path
isolation). **Rationale**: AutoGrade's proven model prevents cross-tenant data
leaks at the Firestore path level, not just rules. More secure, simpler rules.
**Impact**: LevelUp's global collections (courses, items, progress) must be
migrated into tenant-scoped paths.

### ADR-003: Two-Track Content (Space + Exam Coexistence)

**Decision**: Space domain and Exam domain coexist as separate entity trees,
linked but not merged. **Rationale**: Physical paper pipeline (scan → OCR →
route → grade) and digital pipeline (answer → evaluate → feedback) are
fundamentally incompatible. Merging creates bloated, conditional schemas.
**Impact**: Four assessment modes (quiz, timed_test, practice, paper_exam) with
distinct entities and session types.

### ADR-004: Server-Side AI Only

**Decision**: All LLM calls go through Cloud Functions. No client-side AI SDK
usage. **Rationale**: Secure API key management (per-tenant keys), cost
tracking, rate limiting, and preventing key exposure in client bundles.
**Impact**: LevelUp's client-side Gemini calls must be migrated to Cloud
Functions.

### ADR-005: Dual Scoring (Marks + Points)

**Decision**: Both marks (academic) and points (gamified) coexist on items and
evaluations. **Rationale**: AutoGrade is academic (marks, grades, percentages).
LevelUp is gamified (points, streaks, leaderboards). Both are needed for their
respective contexts. Score normalization to 0–1 scale for cross-system
comparison only. **Impact**: `UnifiedItem` carries both `meta.maxMarks` and
`meta.totalPoints`. `UnifiedEvaluationResult` carries both `score` and
`correctness` (0–1).

### ADR-006: Firebase Custom Claims — Slim Design

**Decision**: Claims carry only minimum for Firestore rule evaluation. Full role
context from Firestore. **Rationale**: JWT 1000-byte limit. Claims stale for up
to 1 hour. Rich data (permissions, class lists, entity IDs) changes frequently.
**Impact**: Claims contain `role`, `tenantId`, `classIds[]` (for
teachers/students). All else read from `userMemberships` in rules/app.

### ADR-007: Consumer Users as First-Class Citizens

**Decision**: Individual B2C users (no tenant) are fully supported via
`/users/{uid}` with zero membership records. **Rationale**: LevelUp has an
existing consumer user base. These users access public/purchased spaces. No
AutoGrade access. **Impact**: Consumer path is separate from school path.
Consumer-to-school transition handled via email matching.

### ADR-008: Class-Level Content Assignment

**Decision**: Content (Spaces, Exams) is assigned to classes via `classIds[]`,
not to individual students. **Rationale**: Mirrors how schools actually operate.
Teachers assign content to their class; all students in that class get access.
Simplifies security rules and admin UX. **Impact**: Both Space and Exam use
identical `classIds[]` + `sectionIds[]` patterns.

---

## 15. Open Questions & Risks

### 15.1 Open Decisions

| #   | Question                           | Options                                                                            | Recommendation                                    | Status                             |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| 1   | **Scanner auth model**             | A) Email/password B) Custom token C) API key                                       | B (Custom Token) — most secure for devices        | **Decided** (see addendum §8)      |
| 2   | **Consumer-to-school transition**  | A) Email match B) Manual link C) Separate accounts                                 | A with B fallback                                 | Needs decision                     |
| 3   | **Roll number login**              | Synthetic email `{roll}@{code}.internal`                                           | Implement in Phase 1                              | Accepted                           |
| 4   | **Public LevelUp courses**         | A) `platform_public` tenant B) Global collection C) Deprecate                      | A (simplest)                                      | **Decided** (see addendum §8)      |
| 5   | **Section entity depth**           | A) Full entity B) String field on Student                                          | Start with B, promote to A if needed              | **Decided: B** (see addendum §2.4) |
| 6   | **Academic sessions**              | A) Required B) Optional                                                            | B (optional) — don't block adoption               | Accepted                           |
| 7   | **Answer key security**            | A) Encrypt in doc B) Server-only subcollection C) Server evaluates without storing | C for timed tests, B for item bank                | Recommended                        |
| 8   | **Practice scoring storage**       | A) Firestore only B) RTDB only C) RTDB with periodic Firestore flush               | C (best of both)                                  | Recommended                        |
| 9   | **Digital test timer enforcement** | A) Client-only B) Cloud Scheduler auto-submit C) Server validates on submit        | C (validate submittedAt <= endTime)               | Recommended                        |
| 10  | **Rubric versioning**              | A) Snapshot at grading time B) Always use latest                                   | A (snapshot) — prevents retroactive grade changes | Recommended                        |

### 15.2 Risk Matrix

| Risk                                          | Severity  | Likelihood | Mitigation                                                            |
| --------------------------------------------- | --------- | ---------- | --------------------------------------------------------------------- |
| LevelUp public user breakage during migration | 🔴 High   | Medium     | Maintain consumer path separately; only migrate org-linked data       |
| Progress data loss during migration           | 🔴 High   | Low        | Batch migration with verification checksums; 2-week parallel run      |
| Firestore rule complexity                     | 🟡 Medium | High       | Modular helper functions; comprehensive rule unit tests               |
| Custom claims cache stale after role change   | 🟡 Medium | High       | Force token refresh after admin updates; document 1-hour stale window |
| Firestore costs during dual-read migration    | 🟡 Medium | Medium     | Time-bounded migration windows; monitor costs                         |
| AI cost overruns for tenants                  | 🟡 Medium | Medium     | Budget alerts at 80%/100%; auto-pause at limit                        |
| Tenant code collision                         | 🟢 Low    | Low        | Enforce unique constraint via Cloud Function                          |
| Cross-tenant data leak                        | 🔴 High   | Low        | Path-based isolation + comprehensive security rules + audit tests     |

### 15.3 Naming Reconciliation Note

Phase 3A used `/organizations/{orgId}` while Phase 3B established
`/tenants/{tenantId}` as canonical. **Phase 3B naming takes precedence.** The
mapping:

| Phase 3A Term                | Canonical Term         |
| ---------------------------- | ---------------------- |
| `Organization`               | `Tenant`               |
| `/organizations/{orgId}`     | `/tenants/{tenantId}`  |
| `orgId`                      | `tenantId`             |
| `orgAdmin`                   | `tenantAdmin`          |
| `activeOrgId` (claim)        | `tenantId` (claim)     |
| `schoolCode` on Organization | `tenantCode` on Tenant |

Phase 3D used `/organizations/{orgId}` for some collections. During
implementation, all references should use the canonical `/tenants/{tenantId}`
path.

---

## Appendix A: Type Package Organization

```
packages/shared-types/src/
├── identity/
│   ├── user.ts              — UnifiedUser, AuthProvider
│   ├── membership.ts        — UserMembership, OrgRole, TeacherPermissions
│   ├── claims.ts            — PlatformClaims
│   └── index.ts
├── tenant/
│   ├── tenant.ts            — Tenant, OrgFeatures, Subscription
│   ├── class.ts             — Class, Section, AcademicSession
│   ├── student.ts           — Student
│   ├── teacher.ts           — Teacher
│   ├── parent.ts            — Parent
│   └── index.ts
├── content/
│   ├── space.ts             — Space, SpaceType
│   ├── storyPoint.ts        — StoryPoint, StoryPointType, Section
│   ├── item.ts              — UnifiedItem, all Payloads, QuestionType
│   ├── exam.ts              — Exam, ExamQuestion, PaperExamType
│   ├── submission.ts        — Submission, QuestionSubmission
│   ├── session.ts           — DigitalTestSession, StudentAnswer
│   ├── rubric.ts            — UnifiedRubric, RubricCriterion, EvaluationDimension
│   ├── evaluation.ts        — UnifiedEvaluationResult, EvaluationFeedbackRubric
│   └── index.ts
├── progress/
│   ├── spaceProgress.ts     — SpaceProgress, ItemProgressEntry
│   ├── summary.ts           — StudentProgressSummary, ClassProgressSummary
│   ├── analytics.ts         — ExamAnalytics, OrgAnalytics
│   └── index.ts
├── ai/
│   ├── llmCallLog.ts        — LLMCallLog, TaskType
│   ├── costSummary.ts       — DailyCostSummary, MonthlyCostSummary
│   ├── agent.ts             — AgentConfig
│   └── index.ts
└── index.ts                 — barrel export
```

## Appendix B: Firestore Security Rules Summary

All rules follow this pattern:

```javascript
// Global helper functions
function isAuthenticated() { ... }
function isSuperAdmin() { ... }
function isTenantAdmin(tenantId) { ... }
function isTeacher(tenantId) { ... }
function isStudent(tenantId) { ... }
function belongsToTenant(tenantId) { ... }
function hasActiveMembership(tenantId) { ... }
function hasTeacherPermission(tenantId, perm) { ... }
function teachesClass(classId) { ... }

// Pattern: SuperAdmin > TenantAdmin > Teacher (class-scoped) > Student (own data)
// Pattern: All writes to memberships via Admin SDK (Cloud Functions only)
// Pattern: Tenant data readable only by active members
```

Full security rules are defined in Phase 3A (identity rules), Phase 3B (tenant
rules), and Phase 3C (content/assessment rules).

## Appendix C: Source Document Reference

| Document                                                   | Phase    | Focus Area                          |
| ---------------------------------------------------------- | -------- | ----------------------------------- |
| `docs/phase1-autograde-extraction.md`                      | 1A       | AutoGrade full domain extraction    |
| `docs/phase1-levelup-extraction.md`                        | 1B       | LevelUp full domain extraction      |
| `docs/phase2-cross-domain-mapping.md`                      | 2        | Cross-domain mapping & gap analysis |
| `docs/phase3a-unified-user-auth.md`                        | 3A       | Unified user identity & auth        |
| `docs/phase3b-unified-org-model.md`                        | 3B       | Unified org/multi-tenancy model     |
| `docs/phase3c-unified-content-assessment.md`               | 3C       | Unified content & assessment        |
| `docs/phase3d-unified-progress-ai.md`                      | 3D       | Progress tracking, analytics & AI   |
| `docs/LEVELUP_AUTOGRADE_CORE_TEAM_AND_E2E_ARCHITECTURE.md` | Pre-work | High-level E2E architecture         |

---

## Appendix D: Review Addendum Reference

**v1.1 updates applied based on architecture reviews.** For full details on all
review responses, new architecture sections (notifications, AI error handling,
testing strategy, monitoring, offline/PWA, caching, RTDB security rules, rate
limiting, file upload limits), and missing entity definitions, see:

**`docs/BLUEPRINT-REVIEW-RESPONSES-AND-EXTENSIONS.md`**

---

**Document Version:** 1.1 **Original Author:** Tech Lead & Project Manager
(Maestro Worker — `sess_1771518719648_ao4akign8`) **Task:**
`task_1771515617010_j7y7tw7j4` — Phase 4: Master Unified Architecture Blueprint
**v1.1 Review Responses:** `task_1771521385441_pzt40aa8p` **Date:** 2026-02-19
**Status:** Complete — Ready for Implementation (Updated with Review Feedback)
