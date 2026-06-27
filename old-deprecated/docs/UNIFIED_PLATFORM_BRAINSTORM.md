# Unified Platform: LevelUp + AutoGrade — Brainstorming Document

> **Date**: 2026-02-11 **Status**: Brainstorming / Architecture Proposal
> **Goal**: Combine LevelUp (learning/content platform) and AutoGrade
> (AI-powered exam grading) into a single unified project with common user
> management.

---

## 1. Executive Summary

**LevelUp** is a learning management platform focused on interactive content
delivery — courses, story points, questions (MCQ, code, text), timed tests,
practice ranges, progress tracking, and AI tutoring.

**AutoGrade** is an AI-powered exam grading platform for schools — question
paper extraction, answer sheet scanning, AI grading (RELMS), multi-class exams,
and structured feedback.

**The Unified Platform** combines these into a single educational ecosystem
where:

- Schools/institutions manage users centrally
- Teachers create both **learning content** (LevelUp Spaces) and **exams**
  (AutoGrade)
- Students learn through interactive content AND get their handwritten exams
  graded by AI
- Parents track both learning progress and exam performance
- A single auth and user system governs everything

---

## 2. What Each System Brings

### LevelUp Strengths

- Rich content system (ItemDTO with questions, materials, interactive,
  assessments)
- 15+ question types (MCQ, MCAQ, code, text, matching, fill-blanks, numerical,
  audio, image_evaluation, etc.)
- Course → StoryPoint → Section → Item hierarchy
- Practice ranges for focused drilling (PYQs, etc.)
- Timed tests with session management
- AI chat tutoring
- Leaderboards and gamification
- Code editor integration (CodeMirror)
- Organization + group structure
- Access codes / redemption system

### AutoGrade Strengths

- Multi-tenant architecture with strict data isolation per school
- AI question extraction from scanned question papers
- Handwritten answer sheet scanning + processing
- AI grading with structured multi-dimensional feedback (RELMS)
- Panopticon answer mapping (question → page mapping)
- Multiple exam types (standard, diagram-heavy, high-volume)
- Scanner app (mobile-first)
- PDF report generation
- Cost tracking per AI operation
- Teacher override/review workflow

---

## 3. Unified User Management Model

### Current State Comparison

| Concept          | AutoGrade                                                  | LevelUp                                      |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------- |
| Top-level entity | Client (School)                                            | Organization                                 |
| Admin            | clientAdmin                                                | orgAdmin                                     |
| User roles       | superAdmin, clientAdmin, teacher, student, parent, scanner | superAdmin, orgAdmin, courseAdmin (implicit) |
| Auth             | Firebase Auth + schoolCode login                           | Firebase Auth (email/password)               |
| Multi-tenant     | Strict: `/clients/{clientId}/...`                          | Loose: `orgId` field on courses              |
| Role storage     | `userMemberships/{uid}_{clientId}`                         | `userRoles/{userId}`                         |

### Proposed Unified Role Hierarchy

```
Super Admin (Platform)
├── Can manage all clients/orgs
├── Can view platform analytics
└── Can manage subscription plans

Client Admin (School/College Admin)
├── Manages their institution
├── Creates teachers, students, parents, scanners
├── Manages classes/groups
├── Manages subscription + API keys
└── Can assign courses and exams to classes

Teacher (Client-scoped)
├── Creates LevelUp Spaces (courses with interactive content)
├── Creates AutoGrade Exams (handwritten paper grading)
├── Reviews AI-graded submissions
├── Manages class content assignments
└── Has configurable permissions (per teacher)

Student (Client-scoped)
├── Accesses assigned LevelUp Spaces
├── Takes timed tests / practice ranges
├── Views AutoGrade exam results + feedback
├── Tracks progress across both systems
└── Can be in multiple classes

Parent (Client-scoped)
├── Views child's LevelUp progress
├── Views child's AutoGrade results
└── Receives notifications

Scanner (Client-scoped or Global)
├── Uploads answer sheets
├── Mobile-first scanning interface
└── No access to content/results
```

### Proposed Unified UserMembership

```typescript
interface UserMembership {
  id: string; // "${uid}_${clientId}"
  uid: string; // Firebase Auth UID
  clientId: string;
  schoolCode: string;

  role:
    | "superAdmin"
    | "clientAdmin"
    | "teacher"
    | "student"
    | "parent"
    | "scanner";
  status: "active" | "inactive";

  // Role-specific entity IDs
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;

  // Granular permissions (mainly teachers)
  permissions?: {
    // AutoGrade permissions
    canCreateExams?: boolean;
    canEditRubrics?: boolean;
    canViewAllExams?: boolean;
    canManuallyGrade?: boolean;

    // LevelUp permissions
    canCreateSpaces?: boolean; // NEW
    canManageContent?: boolean; // NEW
    canViewAnalytics?: boolean; // NEW
    canConfigureAgents?: boolean; // NEW
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 4. Architecture Options

### Option A: Monorepo with Shared Core (Recommended)

```
unified-platform/
├── packages/
│   ├── shared-types/          # Shared TypeScript types
│   ├── shared-ui/             # Shared UI components (design system)
│   ├── shared-services/       # Shared Firebase services (auth, users, clients)
│   └── shared-utils/          # Shared utilities
│
├── apps/
│   ├── student-app/           # Student-facing app (LevelUp content + exam results)
│   ├── teacher-app/           # Teacher-facing app (create content + exams, review)
│   ├── client-admin/          # School admin dashboard
│   ├── super-admin/           # Platform admin
│   ├── scanner-app/           # Mobile scanning app
│   └── parent-app/            # Parent dashboard (optional, could be part of student-app)
│
├── functions/                 # Cloud Functions (unified backend)
│   ├── src/
│   │   ├── auth/              # User management, role assignment
│   │   ├── autograde/         # Question extraction, answer mapping, grading
│   │   ├── levelup/           # AI chat, question generation
│   │   └── shared/            # Common utilities
│   └── ...
│
├── firebase.json
├── firestore.rules
└── package.json               # Workspace root
```

**Pros:**

- Clean separation of concerns
- Shared code via packages
- Independent deployment per app
- Unified Firebase project

**Cons:**

- More complex build setup
- Need to manage workspace dependencies

### Option B: Single App with Module-Based Architecture

```
unified-platform/
├── src/
│   ├── core/                  # Auth, users, clients, shared state
│   ├── modules/
│   │   ├── levelup/           # All LevelUp features
│   │   │   ├── spaces/
│   │   │   ├── content/
│   │   │   ├── questions/
│   │   │   ├── practice/
│   │   │   └── timed-tests/
│   │   ├── autograde/         # All AutoGrade features
│   │   │   ├── exams/
│   │   │   ├── submissions/
│   │   │   ├── grading/
│   │   │   └── reports/
│   │   └── admin/             # Admin dashboards
│   ├── shared/                # Shared components, hooks, utils
│   └── ...
├── functions/
└── ...
```

**Pros:**

- Simpler setup
- Easier to share state
- Single deployment

**Cons:**

- Larger bundle (needs aggressive code splitting)
- All roles in one app
- Harder to maintain boundaries

### Option C: Micro-Frontend Architecture

Each module (LevelUp, AutoGrade, Admin) as independently deployed
micro-frontends composed at runtime.

**Pros:** Independent deployment, team scaling **Cons:** High complexity, not
worth it at current scale

### Recommendation: **Option A (Monorepo with Shared Core)**

This is the best fit because:

1. AutoGrade already has 3 separate apps (client-admin, super-admin, scanner)
2. LevelUp has separate admin apps (admin, org-admin)
3. Role-based access naturally maps to separate apps
4. Shared packages prevent code duplication
5. Firebase already supports multi-site hosting

---

## 5. Unified Data Model

### Firestore Structure

```
# ─── GLOBAL COLLECTIONS ───
/userMemberships/{uid}_{clientId}     # Unified auth/role mapping
/scanners/{scannerId}                 # Global scanner accounts

# ─── CLIENT-SCOPED COLLECTIONS (Multi-tenant) ───
/clients/{clientId}                    # School/institution
/clients/{clientId}/classes/{classId}  # Classes/sections
/clients/{clientId}/students/{studentId}
/clients/{clientId}/teachers/{teacherId}
/clients/{clientId}/parents/{parentId}

# ─── AUTOGRADE DATA (Client-scoped) ───
/clients/{clientId}/exams/{examId}
/clients/{clientId}/exams/{examId}/questions/{questionId}
/clients/{clientId}/submissions/{submissionId}
/clients/{clientId}/submissions/{submissionId}/questionSubmissions/{qId}
/clients/{clientId}/evaluationSettings/{settingsId}

# ─── LEVELUP DATA (Client-scoped) ───
/clients/{clientId}/spaces/{spaceId}                    # Was: courses
/clients/{clientId}/spaces/{spaceId}/storyPoints/{spId}
/clients/{clientId}/spaces/{spaceId}/items/{itemId}
/clients/{clientId}/spaces/{spaceId}/agents/{agentId}
/clients/{clientId}/spaces/{spaceId}/redeemCodes/{codeId}

# ─── PROGRESS DATA (Client-scoped) ───
/clients/{clientId}/userProgress/{userId}_{spaceId}     # LevelUp progress
/clients/{clientId}/practiceProgress/{userId}_{spaceId} # Practice range progress
/clients/{clientId}/timedTestSessions/{sessionId}       # Timed test sessions
/clients/{clientId}/chatSessions/{sessionId}            # AI chat sessions

# ─── ANALYTICS (Client-scoped) ───
/clients/{clientId}/leaderboards/{spaceId}
/clients/{clientId}/metrics/{metricId}
```

### Key Design Decisions

1. **Everything under `/clients/{clientId}`**: Adopt AutoGrade's strict
   multi-tenancy model for ALL data. This is critical for school data isolation.

2. **`courses` → `spaces`**: Rename LevelUp's "courses" to "spaces" to avoid
   confusion with academic courses. A "Space" is a learning environment that can
   contain story points, practice ranges, etc.

3. **Unified class assignments**: Both Spaces and Exams assigned to classes via
   `classIds[]` array.

4. **Shared student/teacher entities**: Single student/teacher record per
   client, used by both AutoGrade and LevelUp features.

### Unified Client Entity

```typescript
interface Client {
  id: string;
  name: string;
  schoolCode: string;
  email: string;
  adminUid: string;

  // Subscription
  status: "active" | "suspended" | "trial" | "expired";
  subscriptionPlan: "trial" | "basic" | "premium" | "enterprise";

  // Feature flags
  features: {
    autoGradeEnabled: boolean; // AutoGrade features
    levelUpEnabled: boolean; // LevelUp features
    scannerAppEnabled: boolean; // Scanner app access
    aiChatEnabled: boolean; // AI tutoring
    maxStudents?: number; // Plan limit
    maxExamsPerMonth?: number; // Plan limit
    maxSpaces?: number; // Plan limit
  };

  // API keys
  geminiApiKey: string; // Encrypted

  // Stats
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalExams: number;
    totalSpaces: number; // NEW
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Unified Space (formerly Course) Entity

```typescript
interface Space {
  id: string;
  clientId: string;

  // Basic info
  title: string;
  description?: string;
  thumbnailUrl?: string;
  slug: string;

  // Assignment
  classIds: string[]; // Assigned classes (like AutoGrade exams)
  teacherIds: string[]; // Assigned teachers

  // Type
  type: "default" | "practice_range";

  // Configuration
  isPublic?: boolean; // Visible in store
  labels?: string[];

  // Agent configuration
  defaultEvaluatorAgentId?: string;

  // Access control
  accessType: "assigned" | "code" | "public";

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 6. Unified App Experiences

### Student Experience

```
┌─────────────────────────────────────────────────┐
│                 Student Dashboard                │
├──────────────────┬──────────────────────────────┤
│  My Spaces       │  My Exams                    │
│  ────────────    │  ──────────                  │
│  📚 Physics 101  │  📝 Mid-Term Physics         │
│  📚 Math Prep    │     Score: 85/100            │
│  📚 JEE Practice │     Grade: A                 │
│                  │  📝 Weekly Quiz               │
│  [Browse Store]  │     Status: Grading...        │
│                  │                               │
│  Progress: 65%   │  [View All Results]           │
└──────────────────┴──────────────────────────────┘
```

Students see:

- **My Spaces**: LevelUp learning content assigned to their classes
- **My Exams**: AutoGrade exam results with AI feedback
- **Progress**: Unified progress across both
- **Practice**: Practice ranges for drilling

### Teacher Experience

```
┌─────────────────────────────────────────────────┐
│                 Teacher Dashboard                │
├──────────────────┬──────────────────────────────┤
│  My Spaces       │  My Exams                    │
│  ────────────    │  ──────────                  │
│  📚 Physics 101  │  📝 Mid-Term Physics         │
│  [Create Space]  │     45/50 graded             │
│  [Manage Content]│  📝 Weekly Quiz              │
│                  │     Status: Draft             │
│  Class: 10-A     │  [Create Exam]               │
│  Class: 10-B     │  [Upload Question Paper]     │
│                  │  [Review Submissions]         │
└──────────────────┴──────────────────────────────┘
```

Teachers can:

- Create and manage LevelUp Spaces (interactive content)
- Create AutoGrade Exams (upload question papers)
- Review AI-graded submissions
- Track student progress across both systems
- Use AI chat for assistance

### Client Admin Experience

```
┌─────────────────────────────────────────────────┐
│               School Admin Dashboard             │
├──────────────┬──────────────┬───────────────────┤
│  Users       │  Content     │  Analytics        │
│  ─────       │  ───────     │  ─────────        │
│  Teachers: 25│  Spaces: 12  │  Active: 450/500  │
│  Students:450│  Exams: 35   │  Exams Today: 3   │
│  Parents: 200│  Classes: 20 │  Avg Score: 72%   │
│  Scanners: 5 │              │  AI Cost: $45     │
│              │              │                    │
│  [Manage     │  [Assign to  │  [View Reports]   │
│   Users]     │   Classes]   │                    │
└──────────────┴──────────────┴───────────────────┘
```

---

## 7. Migration Strategy

### Phase 1: Foundation (Week 1-2)

1. Set up monorepo with workspace tooling (npm/pnpm workspaces)
2. Create `shared-types` package with unified type definitions
3. Create `shared-services` package with:
   - Firebase config/initialization
   - Auth service (unified login with school code)
   - User management service
   - Client management service
4. Create `shared-ui` package with design system base

### Phase 2: User Management Unification (Week 2-3)

1. Adopt AutoGrade's multi-tenant data model (`/clients/{clientId}/...`)
2. Migrate LevelUp's `organizations` → `clients` concept
3. Unify `userRoles` + `userMemberships` into single `userMemberships`
   collection
4. Implement unified login flow (school code + email/password)
5. Write Firestore security rules for unified model

### Phase 3: LevelUp Migration (Week 3-5)

1. Move LevelUp's `courses` → `spaces` under `/clients/{clientId}/spaces/`
2. Move `storyPoints` under space subcollection or keep flat with `spaceId`
3. Move `items` under space subcollection
4. Move progress data under client scope
5. Migrate LevelUp frontend to use new data paths
6. Ensure all LevelUp features work under new multi-tenant model

### Phase 4: AutoGrade Integration (Week 4-6)

1. Bring AutoGrade's exam/submission/grading system into unified project
2. Cloud Functions: Merge both projects' functions
3. Connect AutoGrade exams to unified class/student entities
4. Connect grading results to unified student profiles

### Phase 5: Unified Apps (Week 6-8)

1. Build unified student app (LevelUp content + AutoGrade results)
2. Build unified teacher app (content creation + exam management)
3. Merge admin dashboards
4. Test scanner app with unified backend

### Phase 6: Cross-Feature Integration (Week 8+)

1. Unified analytics dashboard
2. Cross-system insights (e.g., "students who scored low on exam X could benefit
   from Space Y")
3. Auto-assign practice spaces based on exam weakness areas
4. Parent notification system covering both progress and exam results

---

## 8. Technical Decisions to Make

### 8.1 State Management

- **AutoGrade**: Zustand
- **LevelUp**: Redux Toolkit + TanStack Query
- **Recommendation**: Standardize on **Zustand + TanStack Query** (simpler,
  modern, AutoGrade already uses Zustand). Migrate LevelUp's Redux slices to
  Zustand stores.

### 8.2 Build Tooling

- Both use Vite — keep Vite
- Add Turborepo or Nx for monorepo orchestration
- pnpm workspaces for package management

### 8.3 Routing

- Both use React Router v6 — straightforward merge
- Role-based route guards using unified membership

### 8.4 Firebase Project

- **Option A**: Single Firebase project (simpler, shared auth)
- **Option B**: Separate Firebase projects with shared auth (more isolation)
- **Recommendation**: **Single Firebase project** since both already use
  Firebase and multi-tenancy is handled at the data level

### 8.5 Cloud Functions Strategy

- Merge into single `functions/` directory
- Organize by domain: `functions/src/autograde/`, `functions/src/levelup/`,
  `functions/src/shared/`
- Shared middleware for auth, client validation, rate limiting

### 8.6 UI Component Library

- AutoGrade: Custom + Headless UI
- LevelUp: shadcn/ui + Radix UI
- **Recommendation**: Standardize on **shadcn/ui + Radix UI** (better DX, more
  components, active community)

---

## 9. Cross-System Integration Opportunities

### 9.1 Exam → Practice Space Pipeline

When a teacher grades exams, the system can:

1. Identify common weak topics across the class
2. Auto-generate a LevelUp Practice Space targeting those topics
3. Assign it to students who scored below threshold

### 9.2 Unified Progress Dashboard

```
Student: John Doe | Class: 10-A
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Physics:
  📚 Space Progress: 72% (14/19 items)
  📝 Mid-Term: 85/100 (A)
  📝 Weekly Quiz 1: 18/20
  📝 Weekly Quiz 2: 15/20

  Weak areas: Thermodynamics, Wave Optics
  Recommended: Practice Range → Wave Optics PYQs
```

### 9.3 AI Chat + Exam Feedback

After grading, students can chat with AI about their specific mistakes:

- "Explain why my answer to Q3 was wrong"
- AI has access to the question, rubric, student's answer, and grading feedback
- Bridges AutoGrade's evaluation with LevelUp's tutoring

### 9.4 Teacher Workflow Unification

Teachers create content and exams from the same dashboard:

- Create a Physics Space with learning materials
- Create an exam for the same topic
- After grading, system shows correlation between space engagement and exam
  scores

---

## 10. Risk Assessment

| Risk                                    | Impact | Mitigation                                  |
| --------------------------------------- | ------ | ------------------------------------------- |
| Data migration errors                   | HIGH   | Incremental migration with rollback scripts |
| Breaking existing AutoGrade users       | HIGH   | Feature flags, parallel running             |
| Breaking existing LevelUp users         | MEDIUM | URL redirects, data backward compat         |
| Scope creep                             | HIGH   | Strict phase-based approach, MVP first      |
| Performance under multi-tenant queries  | MEDIUM | Composite indexes, query optimization       |
| Bundle size explosion                   | MEDIUM | Aggressive code splitting per app           |
| Firebase billing spike during migration | LOW    | Incremental migration, batch operations     |

---

## 11. Open Questions for Discussion

1. **Naming**: Should we call the unified platform something new? (e.g.,
   "EduPlatform", "LearnGrade", or keep "LevelUp" as the brand?)

2. **Public spaces**: AutoGrade is strictly school-scoped. LevelUp has public
   courses. Should we keep public spaces outside the client scope, or make them
   client-specific?

3. **Scanner app**: Should this remain a separate mobile-first app, or become a
   mode within the teacher app?

4. **Parent app**: Separate app or a role-based view within the student app?

5. **Offline support**: LevelUp practice ranges could benefit from offline mode.
   Worth investing in PWA capabilities?

6. **Billing model**: Should AutoGrade and LevelUp be separate add-ons in the
   subscription, or bundled?

7. **Data retention**: How long to keep AI grading results and progress data?

8. **LevelUp's existing public users**: If LevelUp currently has public users
   without school codes, how do we handle backward compatibility?

---

## 12. Recommended First Steps

1. **Set up the monorepo** with a `packages/shared-types` package containing
   unified type definitions
2. **Build the unified auth flow** (school code + email login, UserMembership
   model)
3. **Prototype the unified teacher dashboard** showing both Spaces and Exams
4. **Migrate one school's data** as a proof-of-concept
5. **Get user feedback** before proceeding with full migration

---

**Document Version**: 1.0 **Author**: Claude Code (Maestro Worker) **Status**:
Ready for Review
