# Unified Platform: Design Plan & Next Steps

**Version:** 1.0 **Date:** 2026-02-12 **Status:** Ready for Review

---

## 1. Executive Assessment

After deep analysis of both codebases, the existing brainstorm docs, and the
data architecture documentation, here is a practical, opinionated plan for
merging LevelUp and AutoGrade into a unified platform.

### What We Have

| Dimension          | LevelUp                                     | AutoGrade                                    |
| ------------------ | ------------------------------------------- | -------------------------------------------- |
| **Framework**      | React 18.3 + TypeScript 5.8                 | React 18.3 + TypeScript 5.6                  |
| **Build**          | Vite 5.4 (SWC)                              | Vite (standard React plugin)                 |
| **UI Library**     | shadcn/ui (Radix + Tailwind)                | Custom components + Headless UI + Tailwind   |
| **State**          | Redux Toolkit + TanStack Query + 5 Contexts | Zustand + React Hook Form                    |
| **Routing**        | React Router 6.30                           | React Router 6.28                            |
| **Backend**        | Firebase (Auth, Firestore, RTDB, Storage)   | Firebase (same stack)                        |
| **Styling**        | Tailwind 3.4 + CSS variables (HSL theming)  | Tailwind 3.4 (default theme)                 |
| **Repo Structure** | Single app                                  | Monorepo (3 apps + 4 packages)               |
| **Multi-tenancy**  | Loose (orgId field on courses)              | Strict (`/clients/{clientId}/...`)           |
| **Auth**           | Firebase Auth + custom userRoles            | Firebase Auth + schoolCode + userMemberships |
| **AI**             | Gemini + Claude (chat tutor, evaluation)    | Gemini (grading, extraction)                 |
| **Forms**          | React Hook Form 7.61 + Zod 3.25             | React Hook Form 7.70 + Zod 4.3               |
| **Charts**         | Recharts 2.15                               | Recharts 3.6                                 |
| **Icons**          | Lucide React                                | Lucide React (assumed) / Heroicons           |
| **Notifications**  | Sonner + Radix Toast                        | React Hot Toast                              |

### Key Insight

The two systems are **highly compatible** at the infrastructure level (same
Firebase, React, Tailwind, Vite stack) but differ in **architecture maturity**
in different areas:

- **AutoGrade wins** on: multi-tenancy, monorepo structure, Zustand simplicity,
  role-based access, shared packages pattern
- **LevelUp wins** on: UI component richness (52 shadcn components), content
  flexibility (Items system), theming, feature depth (15+ question types,
  practice ranges, timed tests, leaderboards)

The plan should adopt **AutoGrade's backend architecture** (strict
multi-tenancy, monorepo) while using **LevelUp's frontend foundation**
(shadcn/ui, rich component library, theming).

---

## 2. What Can Be Reused

### 2.1 Directly Reusable (Copy & Integrate)

#### From LevelUp (Frontend Foundation)

| Component/Module                       | Path                                                           | Notes                                                                                  |
| -------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **52 shadcn/ui components**            | `src/components/ui/`                                           | The entire shadcn library - buttons, dialogs, forms, tables, tabs, cards, etc.         |
| **Question renderers (31 components)** | `src/components/questions/`                                    | MCQ, code, text, matching, fill-blanks, numerical, true-false, audio, image eval, etc. |
| **Rich content system (Materials)**    | `src/types/items.ts` (MaterialPayload)                         | Rich text blocks, video, PDF, interactive content                                      |
| **Markdown + Math renderer**           | `src/components/core/MarkdownWithMath.tsx`                     | KaTeX math rendering (AutoGrade has this too - merge best of both)                     |
| **Timed test UI + session logic**      | `src/features/timed-test/`, `src/services/timedTest/`          | Complete timed test system with question navigation, timer, review marking             |
| **Practice range system**              | `src/components/practiceRange/`, `src/services/practiceRange/` | LeetCode-style practice with RTDB progress tracking                                    |
| **Leaderboard system**                 | `src/components/leaderboard/`, `src/services/leaderboard/`     | RTDB-backed leaderboards                                                               |
| **AI Chat panel**                      | `src/components/questions/AiChatPanel.tsx`                     | Chat tutoring interface                                                                |
| **Code editor integration**            | `src/components/questions/PythonEditor.tsx`                    | CodeMirror + Python execution                                                          |
| **Theme/design system**                | `src/index.css`, `tailwind.config.ts`                          | HSL-based theming with dark mode, tier colors, learning states                         |
| **Progress tracking hooks**            | `src/hooks/useStoryPointProgress.ts`                           | Real-time progress with RTDB                                                           |
| **Lazy-loaded routing**                | `src/App.tsx`                                                  | Code-split routes pattern                                                              |
| **Item analytics dimensions**          | `src/types/itemAnalytics.ts`                                   | Bloom's taxonomy, cognitive load, skill tracking                                       |

#### From AutoGrade (Backend & Architecture)

| Component/Module                 | Path                                                                       | Notes                                      |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| **Monorepo structure**           | Root `package.json` with workspaces                                        | apps/_ + packages/_ pattern                |
| **Shared packages pattern**      | `packages/types/`, `packages/firebase/`, `packages/utils/`, `packages/ui/` | Clean package separation                   |
| **Multi-tenant Firestore model** | `/clients/{clientId}/...` subcollections                                   | Strict data isolation per school           |
| **UserMembership system**        | `packages/types/auth.ts`                                                   | Role + clientId + permissions              |
| **Zustand stores**               | `apps/client-admin/src/stores/`                                            | Clean state management with persistence    |
| **Grading pipeline**             | `apps/client-admin/src/services/grading.ts`                                | Gemini Vision grading for Type 1 + Type 2  |
| **RELMS feedback system**        | `functions/src/workers/answer-grading.ts`                                  | Configurable multi-dimensional feedback    |
| **Panopticon answer mapping**    | `functions/src/workers/answer-mapping.ts`                                  | AI-powered answer-to-question routing      |
| **Question extraction**          | Cloud Functions                                                            | AI extracts questions from uploaded papers |
| **Scanner app**                  | `apps/scanner-app/`                                                        | Entire mobile scanning app                 |
| **Cloud Functions architecture** | `functions/src/`                                                           | Triggers, workers, Cloud Tasks             |
| **PDF report generation**        | `apps/client-admin/src/services/pdfGenerator.ts`                           | jsPDF-based reports                        |
| **CSV import/export**            | `packages/utils/csv.ts`                                                    | Bulk data operations                       |
| **Evaluation settings (RELMS)**  | `apps/client-admin/src/types/evaluation-feedback.ts`                       | Configurable feedback dimensions           |
| **Protected route pattern**      | `apps/client-admin/src/components/shared/ProtectedRoute.tsx`               | Role-based route guards                    |
| **Firebase security rules**      | `firestore.rules`                                                          | Client-scoped RBAC rules                   |

### 2.2 Needs Adaptation (Merge Logic, Keep Best Parts)

| Area                    | LevelUp Approach                            | AutoGrade Approach                                   | Unified Decision                                                                   |
| ----------------------- | ------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **User model**          | `AppUser` with uid, email, fullName         | `AppUser` with uid, email, userData (role, clientId) | **Merge**: LevelUp's profile fields + AutoGrade's membership/role model            |
| **Organization model**  | `OrgDTO` with adminUids, code, groups       | `Client` with schoolCode, subscription, geminiApiKey | **Merge**: Rename to `Organization`, keep Client's subscription + LevelUp's groups |
| **Content hierarchy**   | Course > StoryPoint > Section > Item        | Client > Exam > Question                             | **Keep both** under unified Organization scope                                     |
| **Progress tracking**   | `userStoryPointProgress` (Firestore) + RTDB | `Submission > QuestionSubmission`                    | **Keep both**: digital progress + exam submission models                           |
| **State management**    | Redux + TanStack Query + Contexts           | Zustand + React Hook Form                            | **Adopt Zustand + TanStack Query** (see rationale below)                           |
| **Notification system** | Sonner (toast)                              | React Hot Toast                                      | **Standardize on Sonner** (better integration with shadcn)                         |
| **Form handling**       | React Hook Form + Zod                       | React Hook Form + Zod                                | **Upgrade both to latest** (already aligned)                                       |

### 2.3 Cannot Be Reused (Must Rebuild)

| Area                                   | Reason                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| **LevelUp's flat Firestore structure** | Must move to `/organizations/{orgId}/...` for multi-tenancy  |
| **LevelUp's userRoles system**         | Must migrate to AutoGrade's `userMemberships` pattern        |
| **LevelUp's Context-heavy auth**       | 5 contexts is too many; consolidate into Zustand stores      |
| **AutoGrade's custom UI components**   | Replace with shadcn/ui equivalents (much richer library)     |
| **LevelUp's Redux store**              | Only has 1 slice (courses); not worth keeping Redux for this |
| **Separate Firebase configs**          | Must unify into single Firebase project                      |
| **LevelUp's public course discovery**  | Needs redesign for org-scoped + public hybrid model          |

---

## 3. Fixing Existing Design Flaws

### 3.1 LevelUp Flaws to Fix

| Flaw                              | Current State                                                              | Fix                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Weak multi-tenancy**            | `orgId` is just a field on courses; no data isolation                      | Adopt AutoGrade's `/clients/{clientId}/` subcollection model                         |
| **Too many Contexts (5)**         | AuthContext, OrgContext, LoginDialogContext, OnboardingContext, AppContext | Consolidate into 2-3 Zustand stores (auth, ui, org)                                  |
| **Redux for 1 slice**             | Redux Toolkit installed for a single `coursesSlice`                        | Remove Redux entirely; use TanStack Query for server state, Zustand for client state |
| **No subscription/billing model** | No concept of paid tiers or feature flags                                  | Add AutoGrade's subscription + feature flags system                                  |
| **No parent role**                | Parents cannot view student progress                                       | Add parent role from AutoGrade                                                       |
| **No teacher permissions**        | Teachers are just course admins                                            | Add granular teacher permissions from AutoGrade                                      |
| **No class concept**              | Groups exist but no formal class structure                                 | Add AutoGrade's Class model (grade, section, academic year)                          |
| **No scanner support**            | No way to handle physical exam papers                                      | Integrate AutoGrade's scanner app + submission workflow                              |
| **Flat item storage**             | Items stored globally with `courseId` reference                            | Move to org-scoped storage for proper isolation                                      |
| **Non-strict TypeScript**         | `tsconfig.json` has strict: false                                          | Enable strict mode progressively                                                     |

### 3.2 AutoGrade Flaws to Fix

| Flaw                                      | Current State                                   | Fix                                                                          |
| ----------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| **Limited UI component library**          | ~10 custom components, no design system         | Adopt LevelUp's 52 shadcn/ui components                                      |
| **No theming/dark mode**                  | Default Tailwind, no theme variables            | Adopt LevelUp's HSL-based CSS variable system                                |
| **No interactive learning**               | Only exam grading, no practice/tutoring         | Integrate LevelUp's entire learning system                                   |
| **No content flexibility**                | Only exam questions (subjective + MCQ)          | Adopt LevelUp's Items system (15+ types)                                     |
| **No real-time features**                 | Limited RTDB usage for grading progress only    | Adopt LevelUp's RTDB patterns (leaderboards, live progress, resume tracking) |
| **Teacher can't create learning content** | Teachers can only manage exams                  | Enable content creation (Spaces) for teachers                                |
| **Student experience is read-only**       | Students only view graded results               | Enable digital practice, timed tests, chat tutoring                          |
| **No gamification**                       | No leaderboards, points, or engagement features | Integrate LevelUp's leaderboard + points system                              |
| **No AI tutoring**                        | AI only used for grading                        | Add LevelUp's chat tutor + evaluator agents                                  |
| **Hardcoded Gemini**                      | AI grading tied to Gemini specifically          | Abstract AI provider for flexibility                                         |

### 3.3 Shared Flaws to Fix in Unified Platform

| Flaw                                  | Fix                                                                |
| ------------------------------------- | ------------------------------------------------------------------ |
| **No offline support**                | Add PWA capabilities for key learning features                     |
| **No notification system**            | Build unified in-app + push notification system                    |
| **No comprehensive error boundaries** | Add error boundaries at route + feature level                      |
| **No accessibility audit**            | WCAG AA compliance across all components                           |
| **No i18n support**                   | Add internationalization from the start (at least English + Hindi) |
| **No comprehensive test suite**       | Add unit tests (Vitest), integration tests, E2E (Playwright)       |
| **No API rate limiting on client**    | Add request debouncing/throttling for AI operations                |
| **No optimistic updates**             | Add optimistic UI updates via TanStack Query mutations             |

---

## 4. Unified Architecture Decision

### 4.1 State Management: Zustand + TanStack Query

**Decision:** Drop Redux, adopt Zustand + TanStack Query.

**Rationale:**

- Redux Toolkit is overkill for LevelUp's single slice
- AutoGrade already uses Zustand successfully
- TanStack Query handles all server state (caching, refetching, optimistic
  updates)
- Zustand handles client-only state (auth, UI, preferences)
- Combined, they cover 100% of state needs with less boilerplate

**Store Architecture:**

```
stores/
  auth.store.ts          # User auth, memberships, current org
  ui.store.ts            # Sidebar state, modals, theme, notifications
  learning.store.ts      # Active session state (timed test, practice)
```

**TanStack Query for:**

- All Firestore data fetching (courses, items, progress, exams, etc.)
- Mutations with optimistic updates
- Infinite scrolling / pagination
- Real-time subscriptions (via custom query hooks wrapping Firebase listeners)

### 4.2 UI Library: shadcn/ui + Tailwind + CSS Variables

**Decision:** shadcn/ui as the component foundation.

**Rationale:**

- LevelUp already has 52 shadcn components configured
- shadcn/ui is unstyled by default - fully customizable
- Radix UI primitives give accessibility for free
- AutoGrade's Headless UI components can be replaced 1:1
- CSS variables allow per-org theming (white-labeling potential)

**Migration for AutoGrade components:**

| AutoGrade Component | shadcn/ui Replacement                             |
| ------------------- | ------------------------------------------------- |
| `Button`            | `ui/button` (already exists, add variant mapping) |
| `Modal`             | `ui/dialog`                                       |
| `Table`             | `ui/table`                                        |
| `Card`              | `ui/card`                                         |
| `Badge`             | `ui/badge`                                        |
| `Dropdown`          | `ui/dropdown-menu`                                |
| `Input`             | `ui/input`                                        |
| `Tabs`              | `ui/tabs`                                         |
| `StatCard`          | Keep custom, built on `ui/card`                   |
| `Header/Sidebar`    | Rebuild with shadcn `sidebar` + `navigation-menu` |

### 4.3 Monorepo Structure

**Decision:** Adopt AutoGrade's monorepo pattern, expanded.

```
unified-platform/
  packages/
    shared-types/          # Unified TypeScript interfaces
    shared-ui/             # shadcn/ui components + design system
    shared-services/       # Firebase services, auth, user management
    shared-utils/          # PDF, CSV, formatting, validation
    shared-hooks/          # Reusable React hooks

  apps/
    web/                   # Main web app (student + teacher + parent)
    admin/                 # Organization admin dashboard
    super-admin/           # Platform admin dashboard
    scanner/               # Mobile scanning app (from AutoGrade)

  functions/               # Unified Cloud Functions
    src/
      triggers/            # Firestore triggers
      workers/             # Background workers (grading, mapping)
      callables/           # Callable functions (evaluation, extraction)
      scheduled/           # Cron jobs (reports, cleanup)
      shared/              # Shared utilities

  docs/                    # Documentation
  scripts/                 # Migration, seeding, tooling scripts
  package.json             # Workspace root
```

**Key Decision: Single `web` App vs. Separate Student/Teacher Apps**

**Recommendation: Single `web` app** with role-based routing.

**Rationale:**

- Students and teachers share many components (question views, progress,
  content)
- Role-based routing is simpler than managing separate apps
- Smaller maintenance surface
- Code splitting ensures each role only loads relevant code
- Organization admin gets a separate app because its UI is fundamentally
  different (management dashboard vs. learning interface)

### 4.4 Firestore Structure

**Decision:** AutoGrade's `/clients/{clientId}/` model as the foundation,
renamed to `/organizations/{orgId}/`.

```
# Global collections
/users/{userId}                                    # User profiles
/userMemberships/{userId}_{orgId}                  # Role + permissions
/scanners/{scannerId}                              # Scanner accounts
/platformStats/global                              # Platform-wide stats

# Organization-scoped (strict multi-tenancy)
/organizations/{orgId}                             # Organization details
/organizations/{orgId}/classes/{classId}           # Classes
/organizations/{orgId}/students/{studentId}        # Students
/organizations/{orgId}/teachers/{teacherId}        # Teachers
/organizations/{orgId}/parents/{parentId}          # Parents

# Content (Organization-scoped)
/organizations/{orgId}/spaces/{spaceId}            # Courses/practice ranges
/organizations/{orgId}/spaces/{spaceId}/storyPoints/{spId}
/organizations/{orgId}/spaces/{spaceId}/items/{itemId}
/organizations/{orgId}/spaces/{spaceId}/agents/{agentId}

# Exams (Organization-scoped)
/organizations/{orgId}/exams/{examId}              # Exams
/organizations/{orgId}/exams/{examId}/questions/{qId}

# Submissions & Progress (Organization-scoped)
/organizations/{orgId}/submissions/{submissionId}          # Exam submissions
/organizations/{orgId}/submissions/{subId}/questionSubmissions/{qId}
/organizations/{orgId}/userProgress/{userId}_{spaceId}     # Learning progress
/organizations/{orgId}/timedTestSessions/{sessionId}       # Timed test sessions
/organizations/{orgId}/chatSessions/{sessionId}            # AI chat sessions

# Configuration (Organization-scoped)
/organizations/{orgId}/evaluationSettings/{settingsId}     # RELMS config
/organizations/{orgId}/groups/{groupId}                    # Org groups

# RTDB (Real-time)
/organizations/{orgId}/leaderboards/{spaceId}/{userId}
/organizations/{orgId}/courseProgress/{userId}/{spaceId}
/organizations/{orgId}/resumeProgress/{userId}/spaces/{spaceId}
/organizations/{orgId}/practiceProgress/{userId}/{spaceId}
```

**Key Decisions:**

1. **Spaces (not courses)** to avoid confusion with academic courses
2. **Items stay under spaces** (not global) for data isolation
3. **Progress under organization** for proper scoping
4. **RTDB also org-scoped** for leaderboard isolation
5. **Public spaces** handled via a separate `/publicSpaces/{spaceId}` reference
   collection (points to org-scoped data)

### 4.5 Unified User & Role Model

```typescript
// User profile (global)
interface User {
  uid: string;
  email?: string;
  phone?: string;
  fullName: string;
  displayName?: string;
  photoURL?: string;
  age?: number;
  grade?: string;
  country?: string;
  preferences?: {
    theme: "light" | "dark" | "system";
    language: string;
    notifications: NotificationPreferences;
  };
  onboardingCompleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Membership (per org)
interface UserMembership {
  id: string; // `${uid}_${orgId}`
  uid: string;
  orgId: string;
  orgName: string; // Denormalized
  schoolCode: string;

  role:
    | "superAdmin"
    | "orgAdmin"
    | "teacher"
    | "student"
    | "parent"
    | "scanner";
  status: "active" | "inactive" | "suspended";

  // Role-specific entity IDs
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;

  // Permissions (teacher-level granularity)
  permissions: {
    // Content
    canCreateSpaces: boolean;
    canManageContent: boolean;
    canConfigureAgents: boolean;

    // Exams
    canCreateExams: boolean;
    canEditRubrics: boolean;
    canViewAllExams: boolean;
    canManuallyGrade: boolean;

    // Admin
    canViewAnalytics: boolean;
    canManageUsers: boolean;
    canManageClasses: boolean;
  };

  // Context
  classIds?: string[];
  subjectIds?: string[];
  childIds?: string[]; // For parents

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 5. Implementation Roadmap

### Phase 0: Setup (Week 1)

**Goal:** Monorepo scaffold + shared packages

- [ ] Initialize monorepo with pnpm workspaces + Turborepo
- [ ] Create `packages/shared-types/` with unified type definitions
- [ ] Create `packages/shared-ui/` - copy LevelUp's shadcn components
- [ ] Create `packages/shared-services/` - unified Firebase service layer
- [ ] Create `packages/shared-utils/` - merge utility functions
- [ ] Create `packages/shared-hooks/` - merge React hooks
- [ ] Set up unified Tailwind config with CSS variable theming
- [ ] Set up Vitest for testing
- [ ] Set up ESLint + Prettier shared config
- [ ] Enable TypeScript strict mode in shared packages

**Deliverable:** Empty monorepo that builds, with shared packages ready.

### Phase 1: Auth & User Management Unification (Weeks 2-3)

**Goal:** Single auth system supporting all roles

- [ ] Implement unified User model in `shared-types`
- [ ] Implement unified UserMembership model
- [ ] Build auth Zustand store (replacing LevelUp's 3 contexts + AutoGrade's
      store)
- [ ] Build unified login flow (school code + email/password + Google OAuth)
- [ ] Implement multi-org support (org switcher)
- [ ] Build organization management service
- [ ] Write Firestore security rules for unified model
- [ ] Implement role-based route guards
- [ ] Write migration script: LevelUp `userRoles` + `userOrgs` ->
      `userMemberships`
- [ ] Write migration script: AutoGrade users -> unified User model
- [ ] Unit tests for auth flow

**Deliverable:** Working auth with login, org switching, and role-based access.

### Phase 2: Data Model Migration (Weeks 3-5)

**Goal:** Move all data to org-scoped structure

- [ ] Write migration script: LevelUp `courses` ->
      `organizations/{orgId}/spaces`
- [ ] Write migration script: LevelUp `storyPoints` -> org-scoped
- [ ] Write migration script: LevelUp `items` -> org-scoped under spaces
- [ ] Write migration script: LevelUp progress data -> org-scoped
- [ ] Write migration script: AutoGrade `clients` -> `organizations`
- [ ] Write migration script: AutoGrade exams, questions, submissions ->
      org-scoped
- [ ] Validate all data integrity post-migration
- [ ] Update all service layer code to use org-scoped paths
- [ ] Update RTDB paths to be org-scoped
- [ ] Create Firestore indexes for new collection structure

**Deliverable:** All data migrated to unified org-scoped Firestore structure.

### Phase 3: Service Layer Unification (Weeks 5-7)

**Goal:** Single set of services for all operations

- [ ] Merge `CoursesService` -> `SpacesService` (org-scoped)
- [ ] Merge `StoryPointsService` -> `LearningUnitsService` (org-scoped)
- [ ] Merge `ItemsService` + question types -> `UnifiedItemsService`
- [ ] Build `ExamsService` (adapted from AutoGrade, now org-scoped)
- [ ] Build `SubmissionsService` (handles both digital + handwritten)
- [ ] Merge progress services -> `UnifiedProgressService`
- [ ] Merge user services -> `UserManagementService`
- [ ] Merge class/group services -> `ClassesService`
- [ ] Adapt grading services (keep AutoGrade's Gemini grading pipeline)
- [ ] Adapt evaluation services (keep LevelUp's agent-based evaluation)
- [ ] TanStack Query hooks for all services
- [ ] Integration tests for all service operations

**Deliverable:** Unified service layer with TanStack Query hooks.

### Phase 4: Cloud Functions Merge (Weeks 6-8, parallel with Phase 3)

**Goal:** Unified backend

- [ ] Merge Cloud Functions into single `functions/` directory
- [ ] Organize by domain: `triggers/`, `workers/`, `callables/`, `scheduled/`
- [ ] Port AutoGrade's submission triggers (answer mapping, grading)
- [ ] Port LevelUp's evaluation functions (agent-based, digital grading)
- [ ] Add shared middleware (auth validation, org context, rate limiting)
- [ ] Implement progress aggregation workers
- [ ] Implement notification triggers
- [ ] Deploy and test on staging

**Deliverable:** Unified Cloud Functions deployed to staging.

### Phase 5: Web App - Student & Teacher Experience (Weeks 8-12)

**Goal:** Main web application with all features

- [ ] Scaffold `apps/web/` with Vite + shared packages
- [ ] Implement unified layout (responsive, role-adaptive)
- [ ] Build organization switcher component
- [ ] **Student features:**
  - [ ] Dashboard (spaces + exams combined view)
  - [ ] Space viewer (story points, items, progress)
  - [ ] Question renderers (all 15+ types from LevelUp)
  - [ ] Timed test experience
  - [ ] Practice range experience
  - [ ] Exam results viewer (AutoGrade feedback, RELMS)
  - [ ] AI chat tutor
  - [ ] Leaderboard
  - [ ] Profile + settings
- [ ] **Teacher features:**
  - [ ] Dashboard (spaces + exams management)
  - [ ] Space creator/editor (content management)
  - [ ] Question creator (all types)
  - [ ] Exam creator (upload question paper + AI extraction)
  - [ ] Grading review interface
  - [ ] Class management
  - [ ] Student progress views
  - [ ] Analytics dashboard
- [ ] **Parent features:**
  - [ ] Dashboard (children's progress)
  - [ ] Exam results viewer
  - [ ] Learning progress viewer

**Deliverable:** Fully functional web app for students, teachers, parents.

### Phase 6: Admin Apps (Weeks 10-13, parallel with Phase 5)

**Goal:** Organization admin + super admin

- [ ] Scaffold `apps/admin/` - organization admin dashboard
  - [ ] User management (CRUD for students, teachers, parents, scanners)
  - [ ] Class management
  - [ ] Content assignment (spaces + exams to classes)
  - [ ] Subscription management
  - [ ] Evaluation settings (RELMS configuration)
  - [ ] Organization settings (branding, API keys)
  - [ ] Analytics + reports
  - [ ] Bulk import/export (CSV)
- [ ] Scaffold `apps/super-admin/` - platform admin
  - [ ] Organization management
  - [ ] User management (cross-org)
  - [ ] Platform analytics
  - [ ] Subscription management
- [ ] Port `apps/scanner/` - scanning app
  - [ ] Update to use unified auth
  - [ ] Update to use org-scoped data paths
  - [ ] Keep mobile-first UX

**Deliverable:** Admin apps + updated scanner app.

### Phase 7: Advanced Features (Weeks 13-16)

**Goal:** Cross-system intelligence + polish

- [ ] **Hybrid learning units** (digital practice + physical exam in one unit)
- [ ] **Smart question bank** (questions usable in both digital and exam modes)
- [ ] **Cross-system analytics** (correlate digital practice with exam scores)
- [ ] **Auto-generated practice** (weak exam areas -> targeted practice spaces)
- [ ] **Unified notification system** (in-app + email + push)
- [ ] **PWA support** (offline practice mode)
- [ ] **Comprehensive error boundaries + logging**
- [ ] **Performance optimization** (bundle splitting, lazy loading, image
      optimization)
- [ ] **Accessibility audit** (WCAG AA)

**Deliverable:** Polished platform with cross-system features.

### Phase 8: Testing, Migration & Launch (Weeks 16-18)

**Goal:** Production-ready

- [ ] End-to-end tests (Playwright)
- [ ] Performance testing (1000+ concurrent users)
- [ ] Security audit (Firestore rules, API access)
- [ ] Run data migration on staging with real data
- [ ] Validate migrated data integrity
- [ ] Pilot with 3-5 schools
- [ ] Bug fixes from pilot feedback
- [ ] Production deployment
- [ ] Gradual rollout (10% -> 50% -> 100%)
- [ ] Monitor + iterate

**Deliverable:** Live production system.

---

## 6. Technical Decision Summary

| Decision             | Choice                                    | Rationale                                     |
| -------------------- | ----------------------------------------- | --------------------------------------------- |
| **Monorepo tool**    | pnpm + Turborepo                          | Fast, proven, good caching                    |
| **State management** | Zustand + TanStack Query                  | Simple, powerful, no boilerplate              |
| **UI components**    | shadcn/ui (Radix + Tailwind)              | 52 components ready, accessible, customizable |
| **Theming**          | CSS variables (HSL)                       | Per-org theming, dark mode, easy to maintain  |
| **Build**            | Vite + SWC                                | Fastest dev experience                        |
| **Testing**          | Vitest + Playwright                       | Unit + E2E coverage                           |
| **Forms**            | React Hook Form + Zod                     | Already used in both projects                 |
| **Multi-tenancy**    | `/organizations/{orgId}/` subcollections  | Strict data isolation                         |
| **Auth**             | Firebase Auth + UserMemberships           | Proven pattern from AutoGrade                 |
| **AI provider**      | Gemini (primary) + Claude (tutoring)      | Keep existing, abstract for flexibility       |
| **Notifications**    | Sonner (toast) + Firebase Cloud Messaging | shadcn integration + push notifications       |
| **Charts**           | Recharts (latest)                         | Already used in both projects                 |
| **PDF**              | jsPDF + @react-pdf/renderer               | Report generation + preview                   |
| **TypeScript**       | Strict mode                               | Catch bugs early                              |
| **CSS**              | Tailwind 3.4                              | Already shared                                |
| **Firebase**         | Single project                            | Simplicity, shared auth                       |

---

## 7. Risk Mitigation

| Risk                       | Impact | Mitigation                                                                                  |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| **Data migration failure** | HIGH   | Run on staging first, keep old systems read-only for 3 months, dual-write during transition |
| **Feature regression**     | HIGH   | Feature matrix audit before and after, E2E tests for all critical paths                     |
| **Performance at scale**   | MEDIUM | Load test with 1000+ users, Firestore composite indexes, RTDB for hot data                  |
| **Team velocity**          | MEDIUM | Parallel workstreams (phases 3+4, phases 5+6), clear ownership                              |
| **Scope creep**            | HIGH   | Strict phase gates, defer "nice to have" features to v2                                     |
| **User disruption**        | MEDIUM | Gradual rollout, clear migration communication, support during transition                   |

---

## 8. Immediate Next Steps (This Week)

1. **Review and approve this plan** - Align on architecture decisions
2. **Set up the monorepo** - Initialize with Turborepo + pnpm
3. **Copy LevelUp's shadcn components** to `packages/shared-ui/`
4. **Define unified types** in `packages/shared-types/`
5. **Prototype the unified auth flow** - School code + email login with
   membership lookup
6. **Prototype one migration script** - Migrate a test organization's data to
   validate the Firestore structure

---

## 9. Open Questions Needing Decisions

1. **Platform name?** Keep "LevelUp" / rebrand to something new?
2. **Public spaces?** Should non-org users still be able to access public
   courses (LevelUp's current model)?
3. **Billing integration?** Which payment processor? Stripe? Razorpay (India)?
4. **Mobile apps?** PWA sufficient or need native apps eventually?
5. **Scanner app tech?** Keep as web app or convert to React Native?
6. **AI cost model?** Who pays for Gemini API calls? Per-org keys (current
   AutoGrade) vs. platform-subsidized?

---

**End of Document**
