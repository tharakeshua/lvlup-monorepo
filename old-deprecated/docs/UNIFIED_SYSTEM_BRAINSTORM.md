# Unified LevelUp + AutoGrade System - Comprehensive Brainstorming

**Document Version:** 1.0 **Created:** 2026-02-11 **Purpose:** Strategic
planning for combining LevelUp and AutoGrade into a unified educational platform

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Systems Analysis](#current-systems-analysis)
3. [Unified Vision](#unified-vision)
4. [User Management Unification](#user-management-unification)
5. [Domain Model Integration](#domain-model-integration)
6. [Feature Integration Strategy](#feature-integration-strategy)
7. [Architecture Proposal](#architecture-proposal)
8. [Migration Strategy](#migration-strategy)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Challenges & Solutions](#challenges--solutions)

---

## 1. Executive Summary

### Current State

**LevelUp:**

- Interactive digital learning platform
- Focus: Course creation, digital questions (MCQ, code, text), timed tests
- User base: Students, Course Creators, Organization Admins
- Content: Story points with items (questions, materials, assessments)

**AutoGrade:**

- AI-powered answer sheet grading platform
- Focus: Handwritten exam grading, question extraction, RELMS evaluation
- User base: Schools, Teachers, Students, Parents, Scanners
- Content: Exams with questions, answer sheet submissions, AI grading

### Unified Vision

Create a **comprehensive educational ecosystem** that supports:

- ✅ Digital interactive learning (LevelUp)
- ✅ Traditional exam creation and AI-powered grading (AutoGrade)
- ✅ Unified user management across schools, organizations, and individuals
- ✅ Seamless transition between digital practice and formal assessments
- ✅ Single platform for complete learning lifecycle

---

## 2. Current Systems Analysis

### 2.1 LevelUp Strengths

| Feature                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| **Interactive Learning** | Rich question types (MCQ, code, text, fill-blanks, matching) |
| **Content Flexibility**  | Item-based architecture supports multiple content types      |
| **Practice Modes**       | Timed tests, practice ranges, standard learning paths        |
| **Organization Support** | Multi-tenant with organizations and groups                   |
| **Progress Tracking**    | Detailed item-level and story-point-level progress           |
| **Modern Tech Stack**    | React 18, TypeScript, shadcn/ui, TanStack Query              |

### 2.2 AutoGrade Strengths

| Feature                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| **AI Grading**          | Gemini-powered evaluation of handwritten answers |
| **RELMS Feedback**      | Structured multi-dimensional feedback system     |
| **Multi-Tenant SaaS**   | Complete school data isolation                   |
| **Question Extraction** | AI extracts questions from uploaded papers       |
| **Answer Mapping**      | Panopticon algorithm maps answers to questions   |
| **Scanner App**         | Dedicated mobile app for high-volume scanning    |
| **Role-Based Access**   | Fine-grained permissions for different roles     |

### 2.3 Overlapping Concepts

| Concept               | LevelUp                  | AutoGrade                     | Unified                    |
| --------------------- | ------------------------ | ----------------------------- | -------------------------- |
| **Content Container** | Course                   | Client                        | **Space** (supports both)  |
| **Lesson/Exam**       | Story Point              | Exam                          | **Learning Unit**          |
| **Question**          | ItemDTO (type: question) | Question + QuestionSubmission | **Unified Question Model** |
| **User**              | User                     | Student/Teacher               | **Unified User**           |
| **Organization**      | OrgDTO                   | Client                        | **Organization**           |
| **Progress**          | UserStoryPointProgress   | Submission                    | **Unified Progress**       |

### 2.4 Complementary Features

```
┌─────────────────────────────────────────────────────────┐
│                   UNIFIED PLATFORM                       │
├─────────────────────────────────────────────────────────┤
│  LevelUp Brings:              AutoGrade Brings:         │
│  • Digital practice           • Physical exam support   │
│  • Interactive content        • AI grading              │
│  • Timed tests                • Answer sheet scanning   │
│  • Rich materials             • Multi-school SaaS       │
│  • Code questions             • Parent portal           │
│  • Organization groups        • Question extraction     │
│  • Practice ranges            • RELMS feedback          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Unified Vision

### 3.1 Platform Name

**"EduSphere"** or **"LevelUp Pro"** _(Working name - can be refined)_

### 3.2 Core Value Proposition

> A complete educational platform that combines interactive digital learning
> with AI-powered traditional exam grading, enabling schools and educators to
> deliver comprehensive education from practice to assessment.

### 3.3 Target Users

1. **Schools & Colleges** (Primary)
   - Need both digital learning and exam grading
   - Want unified student management
   - Require parent visibility

2. **Individual Educators** (Secondary)
   - Create and sell courses (LevelUp model)
   - Need exam grading for their students

3. **Students** (End Users)
   - Practice digitally
   - Take formal exams
   - Track progress across both modes

4. **Parents** (Stakeholders)
   - Monitor child's digital learning
   - View exam results and feedback

### 3.4 Key Use Cases

#### Use Case 1: School's Complete Learning Cycle

```
1. Teacher creates course with story points (digital content)
2. Students practice on platform (LevelUp features)
3. Teacher schedules formal exam
4. Students take handwritten exam
5. Scanner uploads answer sheets
6. AI grades and provides feedback (AutoGrade features)
7. Students review results and continue learning
8. Parents receive notifications and reports
```

#### Use Case 2: Hybrid Learning Path

```
1. Student enrolls in "JEE Main 2025" course
2. Learns through interactive story points (digital)
3. Takes practice tests (digital, auto-graded)
4. Takes mock exams (handwritten, AI-graded)
5. Receives comprehensive analytics across both modes
```

#### Use Case 3: Individual Course Creator

```
1. Educator creates course with digital content
2. Students worldwide enroll and practice
3. For serious students, offer proctored exams
4. Students take exam at authorized centers
5. Answer sheets scanned and AI-graded
6. Certificates issued based on combined performance
```

---

## 4. User Management Unification

### 4.1 Proposed Unified Role System

```typescript
enum UserRole {
  // Platform-level
  SUPER_ADMIN = "super_admin", // Platform owner (AutoGrade team)

  // Organization-level
  ORG_ADMIN = "org_admin", // School/college administrator
  ORG_OWNER = "org_owner", // Organization creator

  // Functional roles
  TEACHER = "teacher", // Can create content and grade
  STUDENT = "student", // Primary learner
  PARENT = "parent", // Student guardian
  SCANNER = "scanner", // Dedicated answer sheet scanner

  // Course-level
  COURSE_ADMIN = "course_admin", // Individual course creator
  COURSE_MODERATOR = "course_moderator", // Assists course admin
}
```

### 4.2 Unified User Model

```typescript
interface UnifiedUser {
  // Identity
  id: string; // Firebase Auth UID
  email?: string;
  phone?: string;

  // Profile
  firstName: string;
  lastName: string;
  fullName: string; // Computed
  avatarUrl?: string;
  age?: number;
  grade?: string; // For students

  // Organization memberships
  memberships: UserMembership[];

  // Preferences
  preferences?: {
    language?: string;
    theme?: "light" | "dark";
    notifications?: NotificationSettings;
  };

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLogin?: Timestamp;
}

interface UserMembership {
  id: string; // ${userId}_${orgId}
  userId: string;
  orgId: string;
  orgName: string; // Denormalized
  orgType: "school" | "college" | "institute" | "individual";

  role: UserRole;
  status: "active" | "inactive" | "suspended";

  // Role-specific IDs
  teacherId?: string; // If role = TEACHER
  studentId?: string; // If role = STUDENT
  parentId?: string; // If role = PARENT
  scannerId?: string; // If role = SCANNER

  // Permissions (fine-grained)
  permissions?: {
    canCreateCourses?: boolean;
    canCreateExams?: boolean;
    canEditRubrics?: boolean;
    canViewAllStudents?: boolean;
    canManuallyGrade?: boolean;
    canManageUsers?: boolean;
    canViewReports?: boolean;
  };

  // Context
  classIds?: string[]; // For students/teachers
  subjectIds?: string[]; // For teachers
  childIds?: string[]; // For parents

  joinedAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.3 Organization Model

```typescript
interface Organization {
  id: string;
  name: string;
  slug: string; // URL-friendly identifier
  type: "school" | "college" | "institute" | "individual";

  // Contact
  email: string;
  phone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };

  // Branding
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;

  // Access
  code: string; // Join code (AutoGrade schoolCode)
  isPublic?: boolean;

  // Subscription (for SaaS model)
  subscriptionPlan?: "trial" | "basic" | "premium" | "enterprise";
  subscriptionStatus?: "active" | "suspended" | "expired";
  geminiApiKey?: string; // For AI grading

  // Admin
  ownerUid: string;
  adminUids: string[];

  // Stats
  stats?: {
    totalStudents: number;
    totalTeachers: number;
    totalCourses: number;
    totalExams: number;
  };

  // Groups (from LevelUp)
  groups?: OrgGroup[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface OrgGroup {
  id: string;
  orgId: string;
  name: string; // e.g., "Grade 10 - Section A"
  description?: string;
  imageUrl?: string;
  displayOrder: number;
  courseIds: string[]; // Assigned courses
  memberIds: string[]; // Student/teacher IDs
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.4 Authentication Flow

```
1. User enters organization code (school code) + email/phone + password
2. System authenticates via Firebase Auth
3. Query userMemberships WHERE uid = user.uid AND orgId matches code
4. Load membership with role and permissions
5. If multiple memberships, show organization switcher
6. Set active organization context
7. Load role-specific dashboard
```

### 4.5 Multi-Organization Support

**Scenario:** A teacher teaches at multiple schools

```typescript
// User memberships
[
  {
    userId: "teacher_uid",
    orgId: "school_a",
    role: "teacher",
    classIds: ["10A", "10B"],
    subjects: ["Math", "Physics"],
  },
  {
    userId: "teacher_uid",
    orgId: "school_b",
    role: "teacher",
    classIds: ["9C"],
    subjects: ["Math"],
  },
];
```

**UI:** Organization switcher in header, context persisted in localStorage

---

## 5. Domain Model Integration

### 5.1 Unified Content Hierarchy

```
Organization
├── Spaces (Courses)
│   ├── Learning Units (Story Points / Exams)
│   │   ├── Sections (from LevelUp)
│   │   │   └── Items (Questions, Materials, Assessments)
│   │   └── Questions (from AutoGrade, linked to Items)
│   └── Settings
│       ├── Default Evaluator Agent
│       ├── Access Codes
│       └── Grading Configuration
└── Classes (from AutoGrade)
    └── Students (enrolled)
```

### 5.2 Unified Space Model

```typescript
interface Space {
  id: string;
  orgId: string;
  orgName: string; // Denormalized

  // Identity
  title: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;

  // Type determines behavior
  type: "course" | "exam_series" | "practice_range" | "hybrid";

  // Classification
  difficulty?: "easy" | "medium" | "hard" | "expert";
  subject?: string;
  topics?: string[];
  labels?: string[];

  // Access control
  isPublic?: boolean;
  priceCents?: number;
  accessCodes?: string[];

  // Assignment
  classIds?: string[]; // For school-wide courses
  groupIds?: string[]; // For specific groups

  // Configuration
  settings: {
    // LevelUp settings
    allowResume?: boolean;
    showProgress?: boolean;
    enableLeaderboard?: boolean;
    defaultEvaluatorAgentId?: string;

    // AutoGrade settings
    autoGrade?: boolean;
    allowRubricEdit?: boolean;
    evaluationSettingsId?: string; // RELMS configuration
    allowManualGrading?: boolean;
  };

  // Owner
  ownerUid: string;
  adminUids?: string[];

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}
```

### 5.3 Unified Learning Unit Model

```typescript
interface LearningUnit {
  id: string;
  spaceId: string;
  orgId: string;

  // Identity
  title: string;
  description?: string;

  // Type determines behavior
  type: "story_point" | "exam" | "timed_test" | "practice_set";

  // Organization
  orderIndex: number;
  difficulty?: "easy" | "medium" | "hard" | "expert";

  // Sections (for story points)
  sections?: Section[];

  // Exam-specific (from AutoGrade)
  examConfig?: {
    examDate?: Timestamp;
    duration?: number; // minutes
    totalMarks: number;
    passingMarks: number;
    questionPaperType?: "standard" | "integrated-diagram-heavy" | "high-volume";
    questionPaper?: {
      images: string[]; // Cloud Storage URLs
      extractedAt: Timestamp;
      questionCount: number;
    };
    status: "draft" | "question_paper_uploaded" | "in_progress" | "completed";
  };

  // Timed test specific (from LevelUp)
  timedTestConfig?: {
    duration: number;
    questionCount: number;
    randomizeQuestions?: boolean;
    showResults?: "immediate" | "after_completion" | "scheduled";
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Section {
  id: string;
  learningUnitId: string;
  title: string;
  description?: string;
  orderIndex: number;
  createdAt: Timestamp;
}
```

### 5.4 Unified Item/Question Model

```typescript
interface UnifiedItem {
  id: string;
  spaceId: string;
  learningUnitId: string;
  sectionId?: string;
  orgId: string;

  // Type determines structure
  type: ItemType; // 'question' | 'material' | 'assessment' | etc.

  // Content
  title?: string;
  content?: string;
  explanation?: string;

  // Classification
  difficulty?: "easy" | "medium" | "hard" | "expert";
  topics?: string[];
  labels?: string[];

  // For PYQ tracking
  pyqInfo?: {
    exam: string; // "JEE Advanced"
    year: number;
    session?: string;
  }[];

  // Ordering
  orderIndex: number;

  // Type-specific payload
  payload: ItemPayload; // Polymorphic based on type

  // Grading configuration
  gradingConfig?: {
    maxMarks: number;
    rubric?: Rubric; // From AutoGrade
    evaluationType: "auto" | "ai" | "manual" | "hybrid";
    evaluatorAgentId?: string;
  };

  // Analytics
  analytics?: {
    totalAttempts: number;
    correctAttempts: number;
    averageScore: number;
    averageTimeSpent: number;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type ItemType =
  | "question" // Digital question (MCQ, code, text, etc.)
  | "material" // Reading, video, rich content
  | "assessment" // Formal assessment
  | "exam_question" // Physical exam question (for handwritten answers)
  | "discussion" // Discussion prompt
  | "project" // Assignment
  | "checkpoint"; // Progress marker

type ItemPayload =
  | QuestionPayload // Digital question data (LevelUp)
  | MaterialPayload // Material content (LevelUp)
  | ExamQuestionPayload // Physical exam question (AutoGrade)
  | AssessmentPayload
  | DiscussionPayload
  | ProjectPayload
  | CheckpointPayload;

interface ExamQuestionPayload {
  // From AutoGrade Question model
  text: string; // LaTeX or plain text
  questionType?: "subjective" | "mcq" | "matching" | "labeling" | "fill-blank";

  // Options (if applicable)
  hasOptions?: boolean;
  options?: string[];

  // Diagram context
  hasDiagram?: boolean;
  diagramContext?: string;

  // For Type 2 exams
  diagramDescription?: string;
  expectedElements?: string[];
  evaluationGuidance?: string;
  pageIndex?: number; // Which page in question paper

  // Grading
  rubric: Rubric;
}

interface Rubric {
  criteria: RubricCriterion[];
}

interface RubricCriterion {
  description: string;
  marks: number;
}
```

### 5.5 Unified Progress Model

```typescript
interface UserLearningProgress {
  id: string; // ${userId}_${learningUnitId}
  userId: string;
  spaceId: string;
  learningUnitId: string;
  orgId: string;

  // Overall status
  status: "not_started" | "in_progress" | "completed";

  // Scoring
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  grade?: string; // A, B+, etc.

  // Item-level progress
  items: Record<string, ItemProgress>; // Keyed by itemId

  // For physical exams (AutoGrade integration)
  submission?: {
    submissionId: string;
    answerSheets?: {
      images: string[];
      uploadedAt: Timestamp;
      uploadedBy: string;
    };
    scoutingResult?: {
      routingMap: Record<string, number[]>; // questionId → page indices
      completedAt: Timestamp;
    };
    gradingStatus: "pending" | "scouting" | "grading" | "completed" | "failed";
    completedAt?: Timestamp;
  };

  // Timestamps
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  lastActivityAt: Timestamp;
  updatedAt: Timestamp;
}

interface ItemProgress {
  itemId: string;
  itemType: ItemType;

  // Completion
  completed: boolean;
  completedAt?: Timestamp;

  // Engagement
  timeSpent?: number;
  interactions?: number;
  attempts?: number;

  // For digital questions
  digitalData?: {
    status: "pending" | "correct" | "incorrect" | "partial";
    bestScore: number;
    pointsEarned: number;
    totalPoints: number;
    lastAttemptId?: string;
    submissions: SubmissionEntry[];
  };

  // For exam questions (handwritten)
  examData?: {
    mapping?: {
      pageIndices: number[];
      imageUrls: string[];
      scoutedAt: Timestamp;
    };
    evaluation?: {
      score: number;
      maxScore: number;
      strengths: string[];
      weaknesses: string[];
      missingConcepts: string[];
      structuredFeedback?: Record<string, FeedbackItem[]>; // RELMS
      rubricBreakdown: {
        criterion: string;
        awarded: number;
        max: number;
      }[];
      aiReasoning?: string;
      gradedAt: Timestamp;
    };
    status: "pending" | "mapped" | "grading" | "graded" | "manual_override";
  };

  lastUpdatedAt: Timestamp;
}

interface SubmissionEntry {
  attemptId: string;
  submittedAt: Timestamp;
  answer: any;
  score: number;
  maxScore: number;
  correct: boolean;
  feedback?: string;
}
```

### 5.6 Class Model

```typescript
interface Class {
  id: string;
  orgId: string;

  // Identity
  name: string; // "10-A"
  grade: string; // "10"
  section: string; // "A"
  academicYear: string; // "2025-2026"

  // Members
  teacherIds: string[];
  studentIds: string[];

  // Stats
  studentCount: number; // Denormalized

  // Assignments
  assignedSpaceIds: string[]; // Courses/exams assigned to this class

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 6. Feature Integration Strategy

### 6.1 Feature Matrix

| Feature Area          | LevelUp                         | AutoGrade                      | Unified Approach                  |
| --------------------- | ------------------------------- | ------------------------------ | --------------------------------- |
| **User Onboarding**   | Email signup                    | School code + credentials      | Hybrid: Support both flows        |
| **Content Creation**  | Story points with items         | Exam with question extraction  | Unified editor with mode toggle   |
| **Question Types**    | 10+ digital types               | Subjective + MCQ (handwritten) | Support all types                 |
| **Assessment**        | Auto-graded digital             | AI-graded handwritten          | Choose per item                   |
| **Progress Tracking** | Item-level with analytics       | Submission-based               | Merged view                       |
| **Feedback**          | Correct/incorrect + explanation | RELMS multi-dimensional        | RELMS for all (configurable)      |
| **Reports**           | Dashboard analytics             | PDF reports                    | Both                              |
| **Mobile**            | Responsive web                  | Dedicated scanner app          | Keep scanner app + responsive web |
| **AI Integration**    | Chat tutoring                   | Grading + extraction           | Expand both                       |

### 6.2 Hybrid Features

#### Feature 1: Unified Content Editor

**Mode Selection:**

```
When creating a learning unit:
[ ] Digital Learning Path (story point with interactive items)
[ ] Physical Exam (question paper upload + AI grading)
[ ] Hybrid (digital practice + final handwritten exam)
```

**Digital Mode:**

- Use LevelUp's item creation interface
- Support all digital question types
- Enable auto-evaluation or agent-based evaluation

**Physical Exam Mode:**

- Upload question paper (AutoGrade flow)
- AI extracts questions
- Configure grading rubrics
- Enable answer sheet submission

**Hybrid Mode:**

- Create digital items for practice
- Mark specific items as "exam questions"
- Generate printable question paper from digital items
- Support both digital submission and handwritten submission

#### Feature 2: Unified Assessment Workflow

```
1. Teacher creates "Algebra Chapter Test"
2. Chooses "Hybrid" mode
3. Creates 10 digital practice questions
4. Creates 5 exam questions (will be handwritten)
5. Publishes unit

Student Experience:
Phase 1 - Practice (Digital):
- Student practices 10 questions online
- Gets instant feedback
- Tracks progress

Phase 2 - Exam (Physical):
- Student takes handwritten exam (5 questions)
- Scanner uploads answer sheets
- AI grades using RELMS
- Student sees comprehensive feedback

Phase 3 - Review:
- Combined dashboard showing practice + exam performance
- Recommendations for improvement
```

#### Feature 3: Smart Question Bank

**Concept:** Questions can exist in multiple modes

```typescript
interface SmartQuestion extends UnifiedItem {
  // Can be used in multiple contexts
  modes: ("digital" | "handwritten" | "both")[];

  // Digital variant
  digitalPayload?: QuestionPayload;

  // Handwritten variant
  handwrittenPayload?: ExamQuestionPayload;

  // Conversion settings
  printable?: boolean;
  exportFormats?: ("pdf" | "docx" | "latex")[];
}
```

**Use Cases:**

- Teacher creates question digitally
- Exports as PDF for handwritten exam
- Students practice digitally OR take on paper
- Same rubric applies to both modes

#### Feature 4: Unified Analytics Dashboard

**Student Dashboard:**

```
┌─────────────────────────────────────────────────┐
│  Your Performance - Mathematics Grade 10        │
├─────────────────────────────────────────────────┤
│  Digital Practice:                              │
│  • Questions Solved: 245 / 300 (82%)            │
│  • Average Score: 87%                           │
│  • Strengths: Algebra, Trigonometry             │
│  • Needs Work: Calculus                         │
│                                                 │
│  Physical Exams:                                │
│  • Exams Taken: 5                               │
│  • Average Score: 78%                           │
│  • Latest: Mid-term (85/100) - A grade          │
│  • Feedback: 12 areas identified                │
│                                                 │
│  Combined Insights:                             │
│  • Digital practice correlates with exam scores │
│  • Recommended: Practice more Calculus          │
│  • Next Milestone: 90% in final exam            │
└─────────────────────────────────────────────────┘
```

**Teacher Dashboard:**

```
┌─────────────────────────────────────────────────┐
│  Class Performance - Grade 10 Section A         │
├─────────────────────────────────────────────────┤
│  Digital Engagement:                            │
│  • Active Students: 42 / 45 (93%)               │
│  • Average Practice Time: 3.5 hrs/week          │
│  • Completion Rate: 78%                         │
│                                                 │
│  Exam Performance:                              │
│  • Latest Exam: Algebra Test                    │
│  • Class Average: 76%                           │
│  • Submissions: 45 / 45 (100%)                  │
│  • Grading Status: 45 graded (AI: 40, Manual: 5)│
│                                                 │
│  Question Analytics:                            │
│  • Most Difficult: Q7 (Calculus) - 34% correct  │
│  • Most Common Mistakes: Conceptual errors      │
│  • Recommended: Review session on Q7 topic      │
└─────────────────────────────────────────────────┘
```

### 6.3 Parent Portal Integration

**New Feature: Parent Dashboard**

```typescript
interface ParentDashboard {
  children: {
    childId: string;
    childName: string;
    grade: string;

    // Digital learning
    digitalActivity: {
      weeklyHours: number;
      questionsAttempted: number;
      averageScore: number;
      coursesEnrolled: number;
      recentActivity: Activity[];
    };

    // Exam performance
    examPerformance: {
      examsTaken: number;
      averageScore: number;
      latestExam: {
        title: string;
        score: number;
        grade: string;
        date: Timestamp;
        feedback: string[];
      };
      trends: {
        improving: string[];
        needsAttention: string[];
      };
    };

    // Combined insights
    recommendations: string[];
    upcomingExams: Exam[];
    teacherNotes: TeacherNote[];
  }[];
}
```

**Parent Features:**

- View child's digital practice activity
- See exam results and AI feedback
- Receive notifications for low performance
- Schedule parent-teacher meetings
- Track homework completion
- View attendance (if integrated)

---

## 7. Architecture Proposal

### 7.1 Application Structure

```
┌─────────────────────────────────────────────────────────┐
│                   UNIFIED PLATFORM                       │
│                  "EduSphere" / "LevelUp Pro"             │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌───────────────┐
│  Web App      │  │  Admin Portal  │  │  Scanner App  │
│  (Student/    │  │  (Org Admin +  │  │  (Mobile)     │
│   Teacher/    │  │   Course Admin)│  │               │
│   Parent)     │  │                │  │               │
└───────────────┘  └────────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
        ┌─────────────────────────────────────┐
        │      Firebase Services              │
        ├─────────────────────────────────────┤
        │  • Firestore (primary data)         │
        │  • RTDB (real-time progress)        │
        │  • Cloud Storage (images/PDFs)      │
        │  • Cloud Functions (backend logic)  │
        │  • Firebase Auth (authentication)   │
        │  • Firebase Hosting (deployment)    │
        └─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌───────────────┐
│  Gemini API   │  │  Claude API    │  │  External APIs│
│  (AI Grading  │  │  (Chat Tutor)  │  │  (Payment,    │
│   + Extract)  │  │                │  │   Email, etc) │
└───────────────┘  └────────────────┘  └───────────────┘
```

### 7.2 Firestore Data Organization

```
/organizations/{orgId}
  - Organization document

/organizations/{orgId}/classes/{classId}
  - Class documents

/organizations/{orgId}/spaces/{spaceId}
  - Space (Course/Exam) documents

/organizations/{orgId}/learningUnits/{unitId}
  - Learning Unit (Story Point/Exam) documents

/organizations/{orgId}/learningUnits/{unitId}/sections/{sectionId}
  - Section documents

/items/{itemId}
  - Item documents (global, referenced by learningUnitId)

/items/{itemId}/submissions/{userId}
  - User submissions for items

/users/{userId}
  - User profile documents

/userMemberships/{userId}_{orgId}
  - User membership in organizations

/userProgress/{userId}_{learningUnitId}
  - User progress for learning units

/scanners/{scannerId}
  - Scanner user documents (global)

/evaluationSettings/{settingsId}
  - RELMS configuration documents

/agents/{agentId}
  - AI agent configurations

/redemptionCodes/{code}
  - Access codes for courses/spaces
```

**Key Principles:**

1. **Organization-scoped data:** Most data under `/organizations/{orgId}`
2. **Global items:** Items are global but reference orgId and learningUnitId
3. **User data separation:** User profiles global, memberships link to orgs
4. **Progress isolation:** Progress documents unique per user+unit

### 7.3 Cloud Functions Architecture

```typescript
// Callable Functions (synchronous)
functions/
  ├── user-management/
  │   ├── createUser.ts
  │   ├── updateUserRole.ts
  │   └── addUserToOrg.ts
  │
  ├── content-management/
  │   ├── extractQuestions.ts        // AutoGrade: AI question extraction
  │   ├── generateQuestions.ts       // LevelUp: AI question generation
  │   └── exportToPDF.ts
  │
  ├── evaluation/
  │   ├── evaluateDigitalAnswer.ts   // LevelUp: Auto-grade digital
  │   ├── evaluateWithAgent.ts       // LevelUp: Agent-based evaluation
  │   └── triggerAIGrading.ts        // AutoGrade: Trigger grading workflow
  │
  ├── ai-services/
  │   ├── aiChat.ts                  // LevelUp: Chat tutoring
  │   └── aiAssistant.ts
  │
  └── admin/
      ├── generateReports.ts
      └── bulkOperations.ts

// Background Workers (event-driven)
workers/
  ├── onSubmissionCreated.ts         // AutoGrade: Trigger mapping + grading
  ├── answerMapping.ts               // AutoGrade: Panopticon algorithm
  ├── answerGrading.ts               // AutoGrade: RELMS grading
  └── progressAggregation.ts         // Update stats and leaderboards

// Scheduled Functions
scheduled/
  ├── dailyReports.ts                // Send daily summaries
  ├── weeklyDigest.ts                // Parent notifications
  └── cleanupExpired.ts              // Cleanup old sessions
```

### 7.4 Real-Time Database Usage

**Use RTDB for:**

- Timed test session state (active timer, current question)
- Live progress updates during grading
- Presence detection (who's online)
- Temporary ephemeral data

**Use Firestore for:**

- All permanent data
- Complex queries
- User profiles, courses, items, progress

**Hybrid Pattern:**

```typescript
// During timed test:
// 1. Write to RTDB for instant updates
await rtdb
  .ref(`timedTestSessions/${sessionId}/currentQuestion`)
  .set(questionId);

// 2. Periodically sync to Firestore for persistence
await firestore.collection("timedTestSessions").doc(sessionId).update({
  currentQuestion: questionId,
  lastSyncedAt: FieldValue.serverTimestamp(),
});

// 3. On completion, write final state to Firestore only
```

---

## 8. Migration Strategy

### 8.1 Data Migration Approach

**Option A: Gradual Migration (Recommended)**

```
Phase 1: Extend LevelUp (3-4 weeks)
├─ Add AutoGrade domain models to LevelUp
├─ Implement user membership system
├─ Add organization multi-tenancy
└─ Keep both codebases running

Phase 2: Feature Integration (4-6 weeks)
├─ Integrate scanner app with LevelUp backend
├─ Add handwritten submission workflow
├─ Implement AI grading pipeline
├─ Merge admin interfaces
└─ Unified authentication

Phase 3: Data Consolidation (2-3 weeks)
├─ Migrate AutoGrade clients to organizations
├─ Convert exams to learning units
├─ Merge user accounts
└─ Archive old AutoGrade data

Phase 4: Testing & Rollout (2 weeks)
├─ End-to-end testing
├─ Pilot with select schools
├─ Gather feedback
└─ Full production deployment
```

**Option B: Clean Rewrite**

Start fresh with unified architecture, migrate data in one go.

- **Pros:** Clean architecture, no legacy issues
- **Cons:** High risk, longer timeline, possible data loss

**Recommendation:** Option A (Gradual Migration)

### 8.2 Code Migration Plan

#### Step 1: Repository Structure

```
mono-repo/
├── packages/
│   ├── shared/                    # Shared types and utilities
│   │   ├── types/                 # Unified TypeScript interfaces
│   │   ├── constants/
│   │   └── utils/
│   │
│   ├── web-app/                   # Main web application
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── digital-learning/     # LevelUp features
│   │   │   │   ├── exam-grading/         # AutoGrade features
│   │   │   │   └── shared/
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   └── package.json
│   │
│   ├── admin-portal/              # Unified admin interface
│   ├── scanner-app/               # Keep AutoGrade scanner app
│   └── cloud-functions/           # Merged backend
│
├── docs/
│   ├── architecture/
│   ├── api/
│   └── user-guides/
│
└── package.json                   # Root workspace
```

#### Step 2: Service Layer Unification

**Merge Services:**

```typescript
// Before (separate):
// LevelUp: CoursesService
// AutoGrade: ClientsService

// After (unified):
services/
  ├── organizations.service.ts     // Merged
  ├── spaces.service.ts            // Merged (courses + exams)
  ├── learningUnits.service.ts     // Merged (story points + exams)
  ├── items.service.ts             // Merged (items + questions)
  ├── progress.service.ts          // Merged
  ├── users.service.ts             // Merged
  ├── submissions.service.ts       // New (handles both digital + handwritten)
  └── grading/
      ├── digital-evaluator.ts     // LevelUp logic
      ├── ai-grader.ts             // AutoGrade logic
      └── hybrid-evaluator.ts      // Unified
```

#### Step 3: Component Unification

**Example: Unified Question Display**

```typescript
// UnifiedQuestionView.tsx
interface Props {
  item: UnifiedItem;
  mode: 'practice' | 'exam' | 'review';
  onSubmit: (answer: any) => void;
}

export function UnifiedQuestionView({ item, mode, onSubmit }: Props) {
  // Render based on item type
  if (item.type === 'question') {
    // Digital question (LevelUp logic)
    return <DigitalQuestionRenderer item={item} onSubmit={onSubmit} />;
  }

  if (item.type === 'exam_question' && mode === 'review') {
    // Showing graded handwritten answer (AutoGrade logic)
    return <GradedAnswerViewer item={item} />;
  }

  if (item.type === 'exam_question' && mode === 'exam') {
    // Taking handwritten exam - show instructions
    return <ExamInstructions item={item} />;
  }

  // ... other types
}
```

### 8.3 User Migration

**For Existing AutoGrade Users:**

```
1. Export user data from AutoGrade Firestore
2. Create corresponding User documents
3. Create UserMembership documents
4. Link to existing Client (now Organization)
5. Preserve all progress and submissions
6. Send migration notification emails
```

**For Existing LevelUp Users:**

```
1. Keep existing User documents
2. If part of organization, create membership
3. Otherwise, create personal organization
4. Preserve all progress
5. No disruption to service
```

**Deduplication:**

```
1. Match by email/phone
2. If same user in both systems:
   - Merge user profiles
   - Create memberships for both orgs
   - Preserve progress from both
3. User can switch between organizations
```

### 8.4 Data Migration Scripts

```typescript
// scripts/migrate-autograde-to-unified.ts

async function migrateAutoGradeClient(clientId: string) {
  // 1. Load client data
  const client = await autoGradeDb.collection("clients").doc(clientId).get();

  // 2. Create organization
  const orgData: Organization = {
    id: clientId, // Keep same ID
    name: client.name,
    slug: slugify(client.name),
    type: "school",
    code: client.schoolCode,
    subscriptionPlan: client.subscriptionPlan,
    subscriptionStatus: client.status,
    geminiApiKey: client.geminiApiKey,
    ownerUid: client.adminUid,
    adminUids: [client.adminUid],
    // ... map other fields
  };

  await unifiedDb.collection("organizations").doc(orgData.id).set(orgData);

  // 3. Migrate classes
  const classes = await autoGradeDb
    .collection(`clients/${clientId}/classes`)
    .get();

  for (const classDoc of classes.docs) {
    const classData = classDoc.data();
    await unifiedDb
      .collection(`organizations/${orgData.id}/classes`)
      .doc(classDoc.id)
      .set(classData);
  }

  // 4. Migrate students
  const students = await autoGradeDb
    .collection(`clients/${clientId}/students`)
    .get();

  for (const studentDoc of students.docs) {
    const studentData = studentDoc.data();

    // Create/update user
    await createOrUpdateUser(studentData);

    // Create membership
    await createUserMembership({
      userId: studentData.authUid || studentData.id,
      orgId: orgData.id,
      role: "student",
      studentId: studentDoc.id,
      classIds: studentData.classIds,
    });
  }

  // 5. Migrate exams → learning units
  // 6. Migrate questions → items
  // 7. Migrate submissions → progress

  console.log(`✅ Migrated client ${clientId} to organization ${orgData.id}`);
}

// Run migration
async function main() {
  const clients = await autoGradeDb.collection("clients").get();

  for (const client of clients.docs) {
    try {
      await migrateAutoGradeClient(client.id);
    } catch (error) {
      console.error(`❌ Failed to migrate ${client.id}:`, error);
    }
  }
}

main();
```

---

## 9. Implementation Roadmap

### 9.1 Phase 1: Foundation (Weeks 1-4)

**Goal:** Establish unified data models and authentication

**Tasks:**

- [ ] Design finalized unified schemas
- [ ] Set up monorepo structure
- [ ] Create shared types package
- [ ] Implement unified user model
- [ ] Implement organization model
- [ ] Implement user membership system
- [ ] Set up multi-org authentication flow
- [ ] Create database migration scripts
- [ ] Write unit tests for data models

**Deliverables:**

- Unified TypeScript type definitions
- Authentication system supporting both flows
- Data migration scripts (tested on staging)

### 9.2 Phase 2: Service Layer Integration (Weeks 5-8)

**Goal:** Merge backend services and business logic

**Tasks:**

- [ ] Merge CoursesService and ClientsService → SpacesService
- [ ] Merge StoryPointsService → LearningUnitsService
- [ ] Merge ItemsService and QuestionService → UnifiedItemsService
- [ ] Create unified ProgressService
- [ ] Integrate AI grading pipeline
- [ ] Integrate digital evaluation
- [ ] Create unified SubmissionService
- [ ] Set up Cloud Functions architecture
- [ ] Implement API endpoints
- [ ] Write integration tests

**Deliverables:**

- Unified services layer
- Cloud Functions with both AutoGrade and LevelUp logic
- Comprehensive API documentation

### 9.3 Phase 3: UI/UX Integration (Weeks 9-14)

**Goal:** Build unified web application interface

**Tasks:**

- [ ] Design unified UI/UX (Figma mockups)
- [ ] Create shared component library
- [ ] Build organization switcher
- [ ] Implement unified dashboard (student view)
- [ ] Implement unified dashboard (teacher view)
- [ ] Implement unified dashboard (parent view)
- [ ] Build hybrid content editor
- [ ] Integrate scanner app with unified backend
- [ ] Build unified analytics views
- [ ] Implement unified settings page
- [ ] Build admin portal (org admin)
- [ ] Build admin portal (super admin)
- [ ] Responsive design for all screens
- [ ] Accessibility audit (WCAG AA)

**Deliverables:**

- Unified web application
- Updated scanner app
- Unified admin portal
- Design system documentation

### 9.4 Phase 4: Feature Expansion (Weeks 15-18)

**Goal:** Implement advanced hybrid features

**Tasks:**

- [ ] Implement hybrid learning units
- [ ] Build smart question bank
- [ ] Implement question mode conversion (digital ↔ handwritten)
- [ ] Build unified analytics engine
- [ ] Implement parent portal
- [ ] Add notification system
- [ ] Build reporting system
- [ ] Implement leaderboards (unified)
- [ ] Add gamification elements
- [ ] Implement course marketplace
- [ ] Add payment integration
- [ ] Build certificate generation

**Deliverables:**

- Advanced hybrid features
- Parent portal
- Marketplace
- Payment system

### 9.5 Phase 5: Migration & Testing (Weeks 19-21)

**Goal:** Migrate existing data and test thoroughly

**Tasks:**

- [ ] Run data migration on staging
- [ ] Validate migrated data
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Load testing (1000+ concurrent users)
- [ ] Security audit
- [ ] User acceptance testing (UAT) with pilot schools
- [ ] Bug fixes based on UAT
- [ ] Documentation (user guides)
- [ ] Training materials for schools

**Deliverables:**

- Migrated production data
- Test reports
- User documentation
- Training videos

### 9.6 Phase 6: Launch & Rollout (Weeks 22-24)

**Goal:** Production deployment and rollout

**Tasks:**

- [ ] Deploy to production
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Monitor performance and errors
- [ ] Gather user feedback
- [ ] Quick iteration on critical issues
- [ ] Marketing campaign
- [ ] Onboard new schools
- [ ] Customer support setup
- [ ] Post-launch retrospective

**Deliverables:**

- Production system live
- User feedback report
- Post-launch plan

### 9.7 Timeline Summary

| Phase                        | Duration | Cumulative |
| ---------------------------- | -------- | ---------- |
| Phase 1: Foundation          | 4 weeks  | 4 weeks    |
| Phase 2: Service Layer       | 4 weeks  | 8 weeks    |
| Phase 3: UI/UX Integration   | 6 weeks  | 14 weeks   |
| Phase 4: Feature Expansion   | 4 weeks  | 18 weeks   |
| Phase 5: Migration & Testing | 3 weeks  | 21 weeks   |
| Phase 6: Launch & Rollout    | 3 weeks  | 24 weeks   |

**Total Timeline: ~6 months**

---

## 10. Challenges & Solutions

### Challenge 1: Data Model Conflicts

**Problem:** LevelUp and AutoGrade have different ways of representing similar
concepts.

**Solution:**

- Create abstraction layer (UnifiedItem can be digital or exam question)
- Use type discriminators (`type` field determines behavior)
- Preserve original data in `payload` field for backward compatibility
- Gradual migration with dual-write pattern during transition

### Challenge 2: Different User Expectations

**Problem:** LevelUp users expect instant feedback; AutoGrade users expect
AI-graded handwritten submissions.

**Solution:**

- Clearly distinguish modes in UI
- Set expectations upfront (digital = instant, handwritten = AI-graded)
- Provide estimated grading time for handwritten submissions
- Offer hybrid mode where users can practice digitally before exam

### Challenge 3: Performance with Large Schools

**Problem:** AutoGrade clients have 1000s of students, LevelUp hasn't been
tested at that scale.

**Solution:**

- Implement pagination and virtual scrolling
- Use Firestore composite indexes for complex queries
- Leverage RTDB for real-time updates (lighter than Firestore listeners)
- Implement caching layer (Redis) for frequently accessed data
- Use Cloud Functions for heavy operations
- Optimize bundle size with code splitting

### Challenge 4: Conflicting UI Paradigms

**Problem:** LevelUp has modern React patterns; AutoGrade has different
component structure.

**Solution:**

- Adopt LevelUp's architecture as base (more modern)
- Rebuild AutoGrade components using shadcn/ui
- Create feature flags to gradually roll out new UI
- Maintain visual consistency with shared design system

### Challenge 5: AI Cost Management

**Problem:** AI grading for handwritten answers is expensive at scale.

**Solution:**

- Token optimization (efficient prompts)
- Batching (grade multiple questions in one call where possible)
- Caching (reuse evaluations for identical answers)
- Tiered pricing (schools pay per graded submission)
- Option for manual grading to supplement AI
- Set quotas per subscription plan

### Challenge 6: Mobile Experience

**Problem:** Scanner app is separate from main app; need cohesive mobile
experience.

**Solution:**

- Keep scanner app as specialized tool (optimized for scanning)
- Make web app fully responsive
- Implement PWA features (offline support, install prompt)
- Add "Scan Answer Sheet" feature in web app (for light usage)
- Scanner app can be optional (power users only)

### Challenge 7: Migration Risk

**Problem:** Risk of data loss or corruption during migration.

**Solution:**

- Comprehensive backups before migration
- Gradual rollout (migrate 10 schools, validate, then continue)
- Dual-write period (write to both old and new databases)
- Rollback plan at every phase
- Extensive testing on staging with real data copies
- Keep old systems running in read-only mode for 3 months post-migration

### Challenge 8: Feature Parity

**Problem:** Users of each system expect their current features to remain.

**Solution:**

- Feature matrix audit (ensure all features mapped)
- No feature removals, only additions
- Communicate clearly what's new vs. preserved
- Provide migration guides for users
- Beta testing with power users from both platforms

### Challenge 9: Team Coordination

**Problem:** Potentially different teams working on LevelUp and AutoGrade.

**Solution:**

- Unified product team structure
- Shared codebase in monorepo
- Weekly sync meetings
- Shared task tracking (Jira/Linear)
- Clear ownership matrix
- Pair programming for complex integrations

### Challenge 10: Backward Compatibility

**Problem:** Existing integrations and workflows must keep working.

**Solution:**

- Maintain legacy API endpoints (marked deprecated)
- Provide API versioning (`/v1/` vs. `/v2/`)
- Gradual deprecation timeline (6-12 months)
- Clear migration guides for API consumers
- Support legacy data formats during transition period

---

## 11. Success Metrics

### 11.1 Technical Metrics

- [ ] **Migration Success Rate:** 100% of data migrated without loss
- [ ] **API Response Time:** < 200ms (p95)
- [ ] **Page Load Time:** < 2s (p95)
- [ ] **Uptime:** 99.9%
- [ ] **Error Rate:** < 0.1%
- [ ] **Test Coverage:** > 80%

### 11.2 User Metrics

- [ ] **User Retention:** > 90% of migrated users remain active
- [ ] **NPS Score:** > 50
- [ ] **Feature Adoption:** > 60% use hybrid features within 3 months
- [ ] **Support Tickets:** < 5% of user base per month
- [ ] **Time to First Value:** < 30 minutes for new schools

### 11.3 Business Metrics

- [ ] **New School Acquisition:** 20+ schools in first 3 months post-launch
- [ ] **Revenue Growth:** 30% increase in 6 months
- [ ] **Average Contract Value:** $5000/school/year
- [ ] **Churn Rate:** < 5% annually
- [ ] **AI Grading Accuracy:** > 90% agreement with manual grading

---

## 12. Next Steps

### Immediate Actions (This Week)

1. **Stakeholder Alignment**
   - Present this document to key stakeholders
   - Gather feedback and concerns
   - Finalize unified vision

2. **Technical Validation**
   - Prototype unified data models
   - Test migration script on sample data
   - Validate AI grading cost estimates

3. **Resource Planning**
   - Assess team size and skills needed
   - Identify knowledge gaps (training needed)
   - Plan hiring if needed

4. **Risk Assessment**
   - Detailed risk analysis
   - Mitigation strategies
   - Contingency plans

### Short-term (Next 2 Weeks)

1. **Finalize Architecture**
   - Detailed technical design documents
   - API specifications
   - Database schemas
   - Security review

2. **Set Up Infrastructure**
   - Create staging environment
   - Set up CI/CD pipelines
   - Configure monitoring tools
   - Set up error tracking (Sentry)

3. **Begin Phase 1**
   - Start implementing unified data models
   - Set up monorepo
   - Create shared packages

### Medium-term (Month 2-3)

1. **Service Layer Development**
   - Build unified services
   - Implement Cloud Functions
   - Create API documentation
   - Integration testing

2. **UI/UX Design**
   - Create design system
   - Build Figma prototypes
   - User testing with mockups
   - Gather feedback

---

## 13. Open Questions

1. **Pricing Model:**
   - How to price the unified platform?
   - Separate pricing for digital vs. AI grading?
   - Bundled pricing vs. à la carte?

2. **Branding:**
   - Keep "LevelUp" name or rebrand?
   - Position as "LevelUp Pro" (premium tier)?
   - Market as entirely new product?

3. **Feature Prioritization:**
   - Which hybrid features to build first?
   - What can be deferred to v2?

4. **Go-to-Market:**
   - Target AutoGrade schools or LevelUp users first?
   - Pilot program structure?
   - Marketing messaging?

5. **Support Model:**
   - In-house vs. outsourced support?
   - Self-service vs. white-glove for schools?
   - Training program for schools?

6. **Internationalization:**
   - Support multiple languages from start?
   - Right-to-left (RTL) support?
   - Localized content?

---

## 14. Conclusion

Combining LevelUp and AutoGrade represents a significant opportunity to create a
**comprehensive educational ecosystem** that serves the complete learning
lifecycle—from digital practice to formal assessments with AI-powered grading.

**Key Strengths of Unified System:**

1. ✅ **Complete Solution:** Schools get both digital learning and exam grading
   in one platform
2. ✅ **Seamless Experience:** Students transition smoothly from practice to
   exams
3. ✅ **Rich Analytics:** Combined insights from digital + handwritten
   performance
4. ✅ **Cost Efficiency:** Single platform reduces overhead for schools
5. ✅ **Modern Tech Stack:** Built on proven, scalable technologies
6. ✅ **AI-Powered:** Leverages AI for both tutoring and grading

**Primary Risks:**

1. ⚠️ **Complexity:** Integrating two systems is technically challenging
2. ⚠️ **Migration Risk:** Data migration must be flawless
3. ⚠️ **User Adoption:** Users of each system must embrace the unified platform
4. ⚠️ **Timeline:** 6-month timeline is ambitious

**Recommendation:** **Proceed with gradual migration approach** outlined in this
document. Start with Phase 1 (Foundation) to validate architecture and data
models before committing to full integration.

**Success Criteria:**

- Zero data loss during migration
- Feature parity with both legacy systems
- Positive user feedback from pilot schools
- Scalable to 10,000+ students per organization
- AI grading accuracy > 90%

---

**Document Status:** ✅ Ready for Review **Next Review Date:** 2026-02-18
**Owner:** Product & Engineering Team **Version:** 1.0

---

## Appendix A: Glossary

| Term              | Definition                                                    |
| ----------------- | ------------------------------------------------------------- |
| **Space**         | Unified term for Course (LevelUp) or Exam Series (AutoGrade)  |
| **Learning Unit** | Unified term for Story Point (LevelUp) or Exam (AutoGrade)    |
| **Item**          | Unified content entity (question, material, assessment, etc.) |
| **RELMS**         | Structured multi-dimensional feedback system from AutoGrade   |
| **Panopticon**    | AutoGrade's algorithm for mapping answers to questions        |
| **Organization**  | School, college, or institute using the platform              |
| **Membership**    | User's role and permissions within an organization            |
| **Hybrid Mode**   | Learning unit supporting both digital and handwritten         |

---

**End of Document**
