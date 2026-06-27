# Phase 3C: Unified Content & Assessment Architecture

**Date**: 2026-02-19 **Analyst**: Firebase Architect (Maestro Worker —
`sess_1771516572882_y57kpzbit`) **Status**: Architecture Design — Ready for
Review **Phase**: 3C (Data & Service Unification — Content & Assessment Domain)
**Dependencies**: Builds on Phase 3A (User/Auth), Phase 3B (Org/Tenancy)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State — Two Content Domains](#2-current-state--two-content-domains)
3. [Core Design Decision: Coexistence, Not Merger](#3-core-design-decision-coexistence-not-merger)
4. [Unified Content Domain: Space Architecture](#4-unified-content-domain-space-architecture)
5. [Unified Item Model](#5-unified-item-model)
6. [Unified Assessment Types](#6-unified-assessment-types)
7. [AutoGrade Exam Domain (Physical Paper Path)](#7-autograde-exam-domain-physical-paper-path)
8. [Unified Rubric & Grading Configuration](#8-unified-rubric--grading-configuration)
9. [Content Authoring Workflows](#9-content-authoring-workflows)
10. [Class Assignment Model](#10-class-assignment-model)
11. [Firestore Schema — Complete Collection Reference](#11-firestore-schema--complete-collection-reference)
12. [Composite Index Requirements](#12-composite-index-requirements)
13. [Firestore Security Rules](#13-firestore-security-rules)
14. [TypeScript Type Definitions](#14-typescript-type-definitions)
15. [Migration Path](#15-migration-path)
16. [Open Questions & Design Decisions](#16-open-questions--design-decisions)

---

## 1. Executive Summary

The unified platform merges two fundamentally different content and assessment
paradigms:

| Dimension         | LevelUp (Before)                 | AutoGrade (Before)            | Unified Platform             |
| ----------------- | -------------------------------- | ----------------------------- | ---------------------------- |
| Content container | `CourseDTO` (global)             | _(none)_                      | `Space` (tenant-scoped)      |
| Lesson unit       | `StoryPointDTO`                  | _(none)_                      | `StoryPoint`                 |
| Content atom      | `ItemDTO` (15 types)             | `Question` (marks-based)      | `UnifiedItem`                |
| Assessment        | `StoryPoint` (type='timed_test') | `Exam` (physical paper)       | Both coexist with linkage    |
| Evaluation        | Agent-based (digital, real-time) | RELMS (image-based, post-hoc) | Mode-split evaluation config |
| Scoring           | Points (gamified)                | Marks (academic)              | Dual-score: marks + points   |
| Assignment        | `orgId` field (loose)            | `classIds[]` on Exam          | `classIds[]` on Space + Exam |

**Key Design Decisions (this document):**

1. **Two-track content**: LevelUp's `Space > StoryPoint > Item` hierarchy and
   AutoGrade's `Exam > Question` hierarchy **coexist** under the tenant
   namespace — they are not merged into one entity. Instead, they are linked.
2. **Four unified assessment modes**: `interactive_quiz`, `timed_test`,
   `paper_exam`, `practice` — each maps to a concrete entity and pipeline.
3. **`UnifiedItem` supersedes both** `ItemDTO` and `Question` as the shared item
   definition that both tracks can reference (AutoGrade adopts the extended item
   model for digital question authoring).
4. **`UnifiedRubric` bridges both grading systems**: RELMS feedback dimensions
   (AutoGrade) + agent evaluation objectives (LevelUp) are stored in a single
   `UnifiedRubric` structure configurable at tenant, exam, space, or item level.
5. **Exam-Space linkage**: An `Exam` can optionally link to a `Space` for
   providing digital counterpart learning content (e.g., practice problems
   linked to a paper exam topic).
6. **Teacher authoring** is the single entry point — teachers create content in
   Spaces and assessments via a unified Exam/Assessment editor.

---

## 2. Current State — Two Content Domains

### 2.1 LevelUp Content Model

```
/courses/{courseId}                  ← Global (no tenant scope)
  id, ownerUid, title, isPublic, labels

/storyPoints/{storyPointId}          ← Global
  id, courseId, title, type, sections[]

/items/{itemId}                      ← Global
  id, storyPointId, sectionId, type, payload{}, meta{}
  type: question | material | interactive | assessment | discussion | project | checkpoint
  questionType: mcq | mcaq | true-false | text | code | matching | fill-blanks |
                paragraph | jumbled | audio | group-options | numerical | image_evaluation
```

**Strengths:**

- Rich 7-type item taxonomy (question, material, interactive, assessment,
  discussion, project, checkpoint)
- 15 question subtypes
- Deep educational metadata (bloomsLevel, cognitiveLoad, skillsAssessed)
- Per-item AI evaluator agent override
- Section-based organization within story points

**Gaps:**

- Not tenant-scoped (security risk)
- No `classIds[]` assignment (can't assign to a class)
- No marks/rubric model (only points)
- No physical paper handling
- Minimal authoring workflow (ad-hoc creation, no publish/draft lifecycle)

### 2.2 AutoGrade Content Model

```
/clients/{clientId}/exams/{examId}   ← Tenant-scoped (but old path)
  id, classIds[], title, subject, topics[], examDate, duration
  totalMarks, passingMarks, status, questionPaper{}, gradingConfig{}

/clients/{clientId}/exams/{examId}/questions/{questionId}
  id, text, maxMarks, order, rubric{ criteria[{description, marks}] }
```

**Strengths:**

- Tenant-scoped (strong isolation)
- Class assignment via `classIds[]`
- Marks-based scoring with rubric criteria
- AI-graded with RELMS (image-based)
- Multi-class exam assignment

**Gaps:**

- No rich content types (only text questions)
- No digital interactive modes
- No learning material types
- No pedagogical metadata (no Bloom's, no cognitive load)
- Single attempt only (no multi-attempt)
- No per-question agent override
- No practice or timed-test modes without physical paper

---

## 3. Core Design Decision: Coexistence, Not Merger

### 3.1 Why Not Merge Into One Entity?

The temptation is to create a single `Assessment` entity that covers both paper
exams and digital tests. **This is rejected** for the following reasons:

1. **Pipeline incompatibility**: Physical paper requires image upload →
   Panopticon scouting → RELMS image-based grading. Digital requires digital
   answer capture → agent evaluation. Mixing these into one entity creates
   bloated, conditional schema.

2. **Lifecycle incompatibility**: Paper exams have
   `draft → question_paper_uploaded → in_progress → completed` (teacher-driven).
   Digital timed tests have `not_started → in_progress → completed`
   (student-driven). These statuses do not unify cleanly.

3. **Scoring semantic mismatch**: Paper exams are academic (marks, percentage,
   letter grade). Digital interactive content is gamified (points, streaks,
   leaderboard). Both are needed.

4. **Organizational alignment**: Teachers think of "creating a class test"
   (exam) differently from "creating a learning activity" (space). The UI must
   reflect this natural distinction.

### 3.2 The Coexistence + Linkage Model

```
TENANT NAMESPACE
├── Space Domain (LevelUp lineage)
│     /tenants/{tenantId}/spaces/{spaceId}
│     /tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spacePointId}
│     /tenants/{tenantId}/spaces/{spaceId}/items/{itemId}
│     → Assessment modes: interactive_quiz, timed_test, practice
│
└── Exam Domain (AutoGrade lineage)
      /tenants/{tenantId}/exams/{examId}
      /tenants/{tenantId}/exams/{examId}/questions/{questionId}
      → Assessment mode: paper_exam
      → Optional link: exam.linkedSpaceId → a Space with related content

Cross-domain links:
  Exam.linkedSpaceId?       → Space (e.g., practice content for the same exam)
  Item.linkedExamId?        → Exam (e.g., a digital practice version of a paper exam)
  Question.itemId?          → Item (if question was authored in Space first, then pinned to exam)
```

### 3.3 What Is Shared

Despite the coexistence, these are **shared across both domains**:

| Shared Component                 | Used By                                        |
| -------------------------------- | ---------------------------------------------- |
| `UnifiedRubric`                  | Both exam questions and space items            |
| `EvaluationConfig`               | Both RELMS pipeline and agent-based evaluation |
| `classIds[]` assignment          | Both Space and Exam                            |
| `UnifiedItem` definition         | Space items + can be referenced in Exams       |
| `subjects[]`, `topics[]` tagging | Both (for cross-domain analytics)              |
| AI evaluation output format      | Both (unified `EvaluationResult`)              |

---

## 4. Unified Content Domain: Space Architecture

### 4.1 Space Entity (Formerly Course)

A `Space` is the top-level container for all LevelUp learning content within a
tenant. It replaces LevelUp's global `CourseDTO` and is always tenant-scoped.

```typescript
interface Space {
  id: string;
  tenantId: string; // Strict tenant scope

  // Identity
  title: string;
  description?: string;
  thumbnailUrl?: string;
  slug?: string;

  // Type determines the dominant UX mode
  type: SpaceType;

  // Class assignment (same pattern as Exam.classIds)
  classIds: string[]; // Which classes can access this space
  sectionIds?: string[]; // Optional: restrict to specific sections
  teacherIds: string[]; // Teachers who own/manage this space
  accessType: "class_assigned" | "tenant_wide" | "public_store";

  // Content metadata
  subject?: string; // Primary subject (matches Class.subject for alignment)
  labels?: string[]; // Free-form subject tags
  academicSessionId?: string; // Which academic session

  // AI configuration (from LevelUp AgentDTO model)
  defaultEvaluatorAgentId?: string; // Default evaluator agent for items in this space
  defaultTutorAgentId?: string; // Default AI tutor for items in this space

  // Assessment config (when type includes timed_test)
  defaultTimeLimitMinutes?: number;
  allowRetakes?: boolean;
  maxRetakes?: number;

  // Exam linkage (cross-domain)
  linkedExamIds?: string[]; // Paper exams this space supplements

  // Publish workflow
  status: "draft" | "published" | "archived";
  publishedAt?: Timestamp;

  // Stats (denormalized by Cloud Function)
  stats?: {
    totalStoryPoints: number;
    totalItems: number;
    totalStudents: number;
    avgCompletionRate?: number;
  };

  // Lifecycle
  createdBy: string; // Teacher/admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type SpaceType =
  | "learning" // Standard learning path (chapters + exercises)
  | "practice" // Flat practice bank (PYQ, drill questions)
  | "assessment" // Assessment-only space (quizzes, tests — digital)
  | "resource" // Reference materials only (no questions)
  | "hybrid"; // Mix of learning + assessment (most common)
```

### 4.2 StoryPoint Entity (Formerly StoryPointDTO)

A `StoryPoint` is a chapter or lesson within a `Space`. Its `type` field
determines the assessment behaviour when a student enters it.

```typescript
interface StoryPoint {
  id: string;
  spaceId: string;
  tenantId: string;

  // Display
  title: string;
  description?: string;
  thumbnailUrl?: string;

  // Order within the space
  orderIndex: number;

  // The mode this story point operates in
  type: StoryPointType;

  // Sections (embedded — ordered groupings of items)
  sections: Section[];

  // Assessment config (applies when type is 'timed_test' or 'quiz')
  assessment?: {
    timeLimitMinutes?: number; // null = untimed
    passingScore?: number; // 0-100 percentage to pass
    allowRetakes?: boolean;
    maxRetakes?: number; // null = unlimited
    questionOrder: "fixed" | "random"; // fixed = orderIndex, random = shuffled
    showAnswersAfter: "never" | "submission" | "grading";
    allowReview: boolean; // Can student review after submission?
  };

  // Evaluator config override (overrides Space default)
  evaluatorAgentId?: string;

  // Bloom's / curriculum alignment
  learningObjectives?: string[];
  bloomsDistribution?: Record<BloomsLevel, number>; // e.g., {remember:2, apply:5}

  // Publish workflow
  status: "draft" | "published" | "archived";

  // Stats
  stats?: {
    totalItems: number;
    totalPoints: number;
    estimatedMinutes: number;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type StoryPointType =
  | "standard" // Read + practice, no timer
  | "timed_test" // Server-enforced timer, auto-submit on expiry
  | "practice" // Unlimited retries, immediate feedback, no timer
  | "quiz" // Short graded quiz, results shown immediately
  | "assessment"; // Formal graded assessment, results shown after teacher release

interface Section {
  id: string;
  title: string;
  description?: string;
  orderIndex: number;
  // itemIds are stored on items, not here — this is just metadata
}

type BloomsLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";
```

---

## 5. Unified Item Model

The `UnifiedItem` is the single canonical item definition used across both Space
content and (optionally) Exam question authoring. It is a superset of both
LevelUp's `ItemDTO` and AutoGrade's `Question`.

### 5.1 UnifiedItem Entity

```typescript
// Path: /tenants/{tenantId}/spaces/{spaceId}/items/{itemId}
interface UnifiedItem {
  id: string;
  spaceId: string;
  storyPointId: string;
  sectionId?: string;
  tenantId: string;

  // ── Item Classification ─────────────────────────────────────────
  type: UnifiedItemType; // Top-level type
  title?: string; // Optional display title
  content?: string; // Optional summary/description

  // Common classification
  difficulty?: "easy" | "medium" | "hard";
  topics?: string[]; // Topic identifiers (e.g. "wave-optics", "thermodynamics")
  labels?: string[]; // Free-form tags

  // ── Type-specific Payload ───────────────────────────────────────
  payload: UnifiedItemPayload; // Discriminated union by type

  // ── Educational Metadata (from LevelUp) ─────────────────────────
  meta?: {
    // Points / scoring (LevelUp-style gamified)
    totalPoints?: number;
    estimatedMinutes?: number;

    // Pedagogical tagging
    bloomsLevel?: BloomsLevel;
    cognitiveLoad?: "low" | "medium" | "high";
    skillsAssessed?: string[];
    learningObjectives?: string[];
    prerequisites?: string[]; // item IDs that should be done first

    // Marks / academic scoring (AutoGrade-style)
    maxMarks?: number; // If set, item is marks-scored (exam context)
    order?: number; // Question paper order (for exam-linked items)

    // Previous Year Question info (LevelUp PYQ feature)
    pyqInfo?: PreviousYearOccurrence[];

    // AI config overrides
    evaluatorAgentId?: string; // Item-level override of space/story point default
    tutorAgentId?: string;

    // Flags
    isRetriable?: boolean;
    featured?: boolean;
    deprecated?: boolean;

    // Migration tracking
    migrationSource?: {
      system: "levelup" | "autograde";
      sourceId: string;
      sourceType: string;
    };
  };

  // ── Rubric / Grading Config (unified) ───────────────────────────
  rubric?: UnifiedRubric; // Item-level rubric (overrides storyPoint/space/exam rubric)

  // ── Cross-domain Linkage ─────────────────────────────────────────
  linkedQuestionId?: string; // If this item was created from / is linked to an Exam Question
  linkedExamId?: string; // Which exam this item belongs to (if any)

  // ── Analytics ────────────────────────────────────────────────────
  analytics?: ItemAnalytics; // Aggregate performance stats

  // ── Ordering ─────────────────────────────────────────────────────
  sectionOrderIndex?: number; // Order within section
  globalOrderIndex?: number; // Global order within storyPoint (legacy)

  // ── Lifecycle ────────────────────────────────────────────────────
  status: "draft" | "published" | "archived";
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type UnifiedItemType =
  // Question types (interactive, auto-graded or AI-graded)
  | "question"
  // Rich learning material (text, video, PDF, rich blog, etc.)
  | "material"
  // Embedded interactive simulations, tools, games
  | "interactive"
  // Formal graded assessments (references other items)
  | "assessment"
  // Discussion prompts and peer interaction
  | "discussion"
  // Hands-on project / assignment
  | "project"
  // Progress milestone / self-check
  | "checkpoint";
```

### 5.2 Question Payload (Extended)

```typescript
interface QuestionPayload {
  // ── Question Subtype ────────────────────────────────────────────
  questionType: QuestionType;

  // ── Display ─────────────────────────────────────────────────────
  content: string; // LaTeX, Markdown, or plain text
  explanation?: string; // Solution explanation shown after attempt
  hint?: string; // Optional hint (shown on demand)
  imageUrls?: string[]; // Attached images (for diagram questions)

  // ── Question Data ───────────────────────────────────────────────
  questionData: QuestionTypeData; // Union — see below

  // ── Scoring ──────────────────────────────────────────────────────
  basePoints?: number; // LevelUp-style points (gamified)
  maxMarks?: number; // AutoGrade-style marks (academic)
  negativeMarks?: number; // For competitive exams (e.g. JEE: -1 for wrong MCQ)

  // ── Answer Key ───────────────────────────────────────────────────
  // Stored encrypted or in server-side only subcollection for exam security
  answerKeyLocation?: "embedded" | "server_only";
}

type QuestionType =
  | "mcq" // Single-correct MCQ
  | "mcaq" // Multiple-correct MCQ
  | "true-false" // True or False
  | "numerical" // Numeric answer (exact or range)
  | "text" // Short written answer (AI-graded)
  | "paragraph" // Long written answer (AI-graded with rubric)
  | "code" // Coding question (test-cases)
  | "fill-blanks" // Fill in the blanks (typed)
  | "fill-blanks-dd" // Fill in the blanks (dropdown)
  | "matching" // Match columns
  | "jumbled" // Rearrange items in correct order
  | "audio" // Audio-response question
  | "image_evaluation" // Image answer (draw / photograph)
  | "group-options" // Grouped option question
  | "chat_agent_question"; // Conversational AI question
```

### 5.3 Material Payload (unchanged from LevelUp)

```typescript
interface MaterialPayload {
  materialType:
    | "text"
    | "video"
    | "pdf"
    | "link"
    | "interactive"
    | "story"
    | "rich";
  url?: string;
  duration?: number; // Minutes
  downloadable?: boolean;
  content?: string;
  richContent?: RichContent; // Medium-style article structure
}
```

### 5.4 Assessment Payload (formal graded assessment item)

```typescript
interface AssessmentPayload {
  assessmentType: "quiz" | "test" | "assignment" | "peer_review";
  itemReferences?: string[]; // IDs of UnifiedItem questions in this assessment
  rubric?: UnifiedRubric;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  passingScore?: number; // 0-100 %
  releaseResultsAfter?: "submission" | "grading" | "date";
  releaseDate?: Timestamp;
}
```

---

## 6. Unified Assessment Types

The four unified assessment types represent distinct modes of student
evaluation. Each maps to a specific entity type and AI/grading pipeline.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       UNIFIED ASSESSMENT TYPES                               │
├───────────────────┬──────────────────┬────────────────┬─────────────────────┤
│ Mode              │ Entity           │ Answer Medium  │ Grading Pipeline    │
├───────────────────┼──────────────────┼────────────────┼─────────────────────┤
│ interactive_quiz  │ StoryPoint(quiz) │ Digital in-app │ Immediate / Agent   │
│ timed_test        │ StoryPoint(timed)│ Digital in-app │ Agent-based         │
│ paper_exam        │ Exam             │ Physical paper │ Panopticon + RELMS  │
│ practice          │ StoryPoint(pract)│ Digital in-app │ Immediate feedback  │
└───────────────────┴──────────────────┴────────────────┴─────────────────────┘
```

### 6.1 Interactive Quiz (`StoryPoint.type = 'quiz'`)

- **Purpose**: Short graded quiz embedded in a learning flow
- **Timer**: Optional (configured per story point)
- **Answers**: Digital — MCQ, numerical, short text
- **Grading**: Immediate for objective types; AI agent for subjective types
- **Attempts**: Typically 1-3; teacher configures `maxRetakes`
- **Results**: Shown immediately after submission
- **Progress tracking**: `spaceProgress` document updated in real-time
- **Session entity**: `DigitalTestSession` (see §6.5)

**Typical flow:**

```
Student opens quiz StoryPoint
  → Client creates DigitalTestSession { status: 'in_progress', startedAt }
  → Student answers items one by one (or all at once)
  → Client submits DigitalTestSession { endedAt, answers{} }
  → Cloud Function grades immediate types, queues agent evaluation for subjective
  → Results shown to student, teacher notified
  → spaceProgress updated
```

### 6.2 Timed Test (`StoryPoint.type = 'timed_test'`)

- **Purpose**: Formal timed assessment with server-enforced timer
- **Timer**: Server-side — `endTime = startedAt + timeLimitMinutes * 60`;
  auto-submits on expiry
- **Answers**: Digital — all 15 question types supported
- **Question order**: Server-set (random or fixed), not revealed until session
  starts
- **5-status tracking**: Not Visited / Not Answered / Answered / Marked for
  Review / Answered+Marked
- **Grading**: Agent-based evaluation + immediate for objective types
- **Attempts**: Configurable; multi-attempt supported (best score kept)
- **Results**: Configurable — immediate or after teacher releases
- **Session entity**: `DigitalTestSession`

**Key difference from quiz**: Timer is strictly enforced server-side. Session
auto-submits if time expires. Question order can be randomized (anti-cheating).

### 6.3 Paper Exam (`Exam` entity)

- **Purpose**: Physical paper-based assessment with AI grading
- **Timer**: Recorded as metadata (`duration` in minutes) — not server-enforced
- **Answers**: Physical handwritten paper → scanned images → uploaded to Storage
- **Pipeline**: Panopticon (answer routing) → RELMS (AI image grading)
- **Grading**: AI grading with teacher override capability
- **Attempts**: One submission per student per exam
- **Results**: Released by teacher after grading completes
- **Session entity**: `Submission` (AutoGrade model, retained)

**Sub-types of paper exam** (from AutoGrade):

```typescript
type PaperExamType =
  | "standard" // Normal paper — AI routes + grades all questions
  | "diagram_heavy" // Type 2: page-N-question → page-N-answer (no routing AI)
  | "high_volume" // Many questions, optimized batching
  | "manual_rubric"; // Admin sets rubric manually, AI grades with it
```

### 6.4 Practice Mode (`StoryPoint.type = 'practice'`)

- **Purpose**: Unlimited drill / PYQ bank for exam prep
- **Timer**: None (untimed)
- **Answers**: Digital — immediate feedback shown after each question
- **Grading**: Immediate for objective types; lightweight AI for subjective
- **Attempts**: Unlimited — each attempt tracked, best score kept
- **Results**: Immediate (no teacher release required)
- **Progress tracking**: RTDB for high-frequency updates (same as existing
  LevelUp WillApp pattern)
- **Session entity**: Practice session is stateless — each question attempt
  stored as `QuickAttempt`

**Key differences from quiz/test**:

- No concept of "session" — each question is answered independently
- RTDB (not Firestore) for real-time progress updates to avoid 1-write/sec
  Firestore limit
- Students can pause and resume freely
- High attempt volume expected (100s of questions per student)

### 6.5 DigitalTestSession Entity

Used for `quiz` and `timed_test` story points (not for `practice` or
`paper_exam`).

```typescript
// Path: /tenants/{tenantId}/digitalTestSessions/{sessionId}
interface DigitalTestSession {
  id: string;
  tenantId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;
  classId?: string; // For class-assigned sessions (reporting)

  // Attempt info
  attemptNumber: number; // 1 = first attempt, 2 = second, etc.
  isLatest: boolean; // True if this is the most recent attempt

  // Timing (server-set)
  startedAt: Timestamp;
  endTime?: Timestamp; // startedAt + timeLimitMinutes (for timed tests)
  submittedAt?: Timestamp; // When student submitted
  autoSubmittedAt?: Timestamp; // If timer expired

  // Session state
  status: "in_progress" | "submitted" | "grading" | "completed" | "expired";

  // Question management (server-set on session creation)
  questionOrder: string[]; // Ordered list of itemIds
  questionStatus: Record<string, QuestionStatus>; // per-item 5-status tracking

  // Answers (written by client during session)
  answers: Record<string, StudentAnswer>; // key: itemId

  // Results (written by grading pipeline after submission)
  results?: {
    totalScore: number;
    totalMarks: number; // If marks-based scoring used
    totalPoints: number; // If points-based scoring used
    percentage: number;
    grade?: string; // Letter grade (if exam context)
    passed?: boolean;
    itemResults: Record<string, ItemResult>;
    releasedAt?: Timestamp; // When teacher released results
    releasedBy?: string;
  };

  // Grading pipeline state
  gradingStatus?: {
    immediateGraded: number; // Objective types graded immediately
    agentQueued: number; // Subjective types queued for AI
    agentCompleted: number;
    failed: number;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type QuestionStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked_for_review"
  | "answered_and_marked";

interface StudentAnswer {
  itemId: string;
  questionType: QuestionType;
  submission: any; // Type-specific answer data
  timeSpentSeconds?: number;
  submittedAt: Timestamp;
}

interface ItemResult {
  itemId: string;
  correctness: number; // 0–1 (LevelUp model)
  pointsEarned: number;
  marksAwarded?: number; // If marks-based
  maxMarks?: number;
  evaluation?: EvaluationResult; // AI feedback (if applicable)
  isCorrect?: boolean; // For objective types
}
```

---

## 7. AutoGrade Exam Domain (Physical Paper Path)

The `Exam` entity is retained from AutoGrade, migrated to the `/tenants/` path,
and extended with cross-domain linkage.

### 7.1 Exam Entity (Extended)

```typescript
// Path: /tenants/{tenantId}/exams/{examId}
interface Exam {
  id: string;
  tenantId: string;

  // Core identity
  title: string;
  subject: string;
  topics: string[];

  // Class assignment (same pattern as Space)
  classIds: string[]; // Which classes take this exam
  sectionIds?: string[];

  // Scheduling
  examDate: Timestamp;
  duration: number; // In minutes (metadata, not enforced)
  academicSessionId?: string;

  // Scoring
  totalMarks: number;
  passingMarks: number;

  // Question paper
  questionPaper?: {
    images: string[]; // Cloud Storage URLs
    extractedAt: Timestamp;
    questionCount: number;
    examType: PaperExamType;
  };

  // Grading configuration
  gradingConfig: ExamGradingConfig;

  // Cross-domain linkage
  linkedSpaceId?: string; // A Space providing digital practice content for this exam
  linkedStoryPointId?: string; // Specific StoryPoint (e.g., a practice set)

  // Workflow status
  status: ExamStatus;

  // Evaluation settings (RELMS)
  evaluationSettingsId?: string; // Override tenant default; null = use tenant default

  // Stats (denormalized)
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

type ExamStatus =
  | "draft"
  | "question_paper_uploaded"
  | "question_paper_extracted" // NEW: questions extracted, rubrics ready for review
  | "in_progress" // Answer sheets being uploaded/graded
  | "grading"
  | "completed"
  | "archived";

type PaperExamType =
  | "standard"
  | "diagram_heavy"
  | "high_volume"
  | "manual_rubric";

interface ExamGradingConfig {
  autoGrade: boolean;
  allowRubricEdit: boolean; // Teachers can edit AI-extracted rubrics
  questionPaperType: PaperExamType;

  // RELMS configuration
  evaluationSettingsId?: string; // Which EvaluationFeedbackRubric to use
  // null = use tenant's defaultEvaluationSettingsId

  // Manual override settings
  allowManualOverride: boolean;
  requireOverrideReason: boolean;

  // Result release
  releaseResultsAutomatically: boolean;
  // false = teacher must manually release results to students
}
```

### 7.2 Exam Question Entity (Extended)

```typescript
// Path: /tenants/{tenantId}/exams/{examId}/questions/{questionId}
interface ExamQuestion {
  id: string; // e.g., "Q1", "Q2" — sequential
  examId: string;

  // Question content (matches UnifiedItem.QuestionPayload for consistency)
  text: string; // LaTeX or plain text
  imageUrls?: string[]; // Extracted question images (sub-images of question paper)

  // Scoring
  maxMarks: number;
  order: number; // Display order (0-indexed)

  // Rubric (per-question, overrides exam-level rubric)
  rubric: UnifiedRubric;

  // AutoGrade pipeline metadata
  questionType?: "standard" | "diagram" | "multi-part";
  subQuestions?: SubQuestion[]; // For multi-part questions

  // Cross-domain linkage
  linkedItemId?: string; // If this question has a digital counterpart (UnifiedItem)

  // Extraction metadata
  extractedBy?: "ai" | "manual";
  extractedAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface SubQuestion {
  label: string; // "a", "b", "i", "ii"
  text: string;
  maxMarks: number;
  rubric?: UnifiedRubric;
}
```

### 7.3 Submission & QuestionSubmission (Retained with Extensions)

```typescript
// Path: /tenants/{tenantId}/submissions/{submissionId}
interface Submission {
  id: string;
  tenantId: string;
  examId: string;
  studentId: string;
  studentName: string; // Denormalized
  rollNumber: string; // Denormalized
  classId: string;

  // Answer sheet images
  answerSheets: {
    images: string[]; // Cloud Storage URLs
    uploadedAt: Timestamp;
    uploadedBy: string;
  };

  // Panopticon scouting result
  scoutingResult?: {
    routingMap: Record<string, number[]>; // questionId → page indices
    completedAt: Timestamp;
    method: "panopticon" | "type2_page_match"; // Type 2 = diagram-heavy bypass
  };

  // Summary
  summary: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    grade: string;
    passed: boolean;
    status: SubmissionStatus;
    questionsGraded?: number;
    totalQuestions?: number;
    completedAt?: Timestamp;
    releasedAt?: Timestamp; // When teacher released to student
    releasedBy?: string;
  };

  // AI grading pipeline tracking
  gradingPipeline?: {
    phase: "scouting" | "grading" | "finalizing";
    progress: number; // 0-100%
    failedQuestions?: string[];
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type SubmissionStatus =
  | "pending"
  | "scouting"
  | "grading"
  | "completed"
  | "failed"
  | "released"; // NEW: teacher has released results to student

// Path: /tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{questionId}
interface QuestionSubmission {
  id: string;
  submissionId: string;
  questionId: string;
  examId: string;

  // Image mapping (from scouting)
  mapping: {
    pageIndices: number[];
    imageUrls: string[];
    scoutedAt: Timestamp;
  };

  // Evaluation (from RELMS grading)
  evaluation?: UnifiedEvaluationResult;

  // Manual override
  manualOverride?: {
    overriddenScore: number;
    reason: string;
    overriddenBy: string; // Teacher UID
    overriddenAt: Timestamp;
    previousScore: number;
  };

  status: "scouted" | "grading" | "graded" | "manual_override" | "failed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 8. Unified Rubric & Grading Configuration

### 8.1 The Problem

AutoGrade and LevelUp store grading criteria in incompatible formats:

| System          | Structure                                             | Scope             | Unit               |
| --------------- | ----------------------------------------------------- | ----------------- | ------------------ |
| AutoGrade       | `RubricCriterion[]{description, marks}`               | Per exam question | Marks              |
| AutoGrade RELMS | `FeedbackDimension[]{name, priority, promptGuidance}` | Per tenant        | Dimension coverage |
| LevelUp         | `evaluationObjectives[]{name, points}` on `AgentDTO`  | Per course/item   | Points             |

### 8.2 UnifiedRubric Design

The `UnifiedRubric` is a superset that carries both marking criteria (AutoGrade
model) and evaluation dimensions (RELMS/agent model). It can be stored at any
level: tenant → exam/space → storyPoint/question → item.

```typescript
interface UnifiedRubric {
  // ── Marking Criteria (AutoGrade model) ───────────────────────────
  // Explicit point/mark allocation per criterion — used for deterministic scoring
  criteria?: RubricCriterion[];

  // ── Evaluation Dimensions (RELMS + Agent model) ───────────────────
  // Thematic areas the AI evaluator should assess — holistic, not mark-by-mark
  dimensions?: EvaluationDimension[];

  // ── Scoring Mode ─────────────────────────────────────────────────
  scoringMode: RubricScoringMode;

  // ── Passing Threshold ────────────────────────────────────────────
  passingPercentage?: number; // 0-100; null = no pass/fail

  // ── Answer Display ───────────────────────────────────────────────
  showModelAnswer?: boolean;
  modelAnswer?: string; // Reference answer for evaluator

  // ── Evaluator Instructions ────────────────────────────────────────
  evaluatorGuidance?: string; // Free-form instructions to AI evaluator

  // Source tracking
  extractedBy?: "ai" | "manual" | "imported";
  lockedForEdit?: boolean; // Prevent teacher edits after grading starts
}

type RubricScoringMode =
  | "criteria_based" // Score = sum of awarded marks per criterion
  | "dimension_based" // Score = weighted sum across dimensions
  | "holistic" // AI assigns a single score based on overall quality
  | "hybrid"; // criteria_based for marks + dimension_based for feedback

interface RubricCriterion {
  id: string;
  description: string; // What this criterion measures
  marks: number; // Maximum marks for this criterion
  points?: number; // LevelUp equivalent (optional dual-score)
  guidance?: string; // How to award/deduct marks
  weight?: number; // 0–1 weight (for dimension-based scoring)
}

interface EvaluationDimension {
  id: string;
  name: string; // "Critical Issues", "Structure & Flow", etc.
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  promptGuidance: string; // Instructions for the AI evaluator
  enabled: boolean;
  isDefault: boolean; // Platform default dimension
  expectedFeedbackCount?: number; // Target number of feedback items to generate
  icon?: string;
}
```

### 8.3 Rubric Inheritance Hierarchy

Rubrics cascade from tenant-level down to item-level, with each level able to
override:

```
Tenant.defaultEvaluationSettingsId
  └── EvaluationFeedbackRubric (dimensions, displaySettings)
        ↑ can be overridden per exam or per space

Exam.gradingConfig.evaluationSettingsId
  └── ExamQuestion.rubric (criteria + dimensions for this question)

Space.defaultEvaluatorAgentId
  └── AgentDTO (evaluationObjectives = dimensions)
        ↑ can be overridden per storyPoint or per item

StoryPoint.evaluatorAgentId
  └── UnifiedItem.rubric (criteria + dimensions for this item)
```

**Resolution at grading time:**

```typescript
function resolveRubric(context: GradingContext): UnifiedRubric {
  return (
    context.item?.rubric ??
    context.storyPointRubric ??
    context.agentObjectivesAsRubric ??
    context.exam?.evaluationSettings ??
    context.tenantDefaultRubric ??
    PLATFORM_DEFAULT_RUBRIC
  );
}
```

### 8.4 EvaluationFeedbackRubric (Extended from AutoGrade)

```typescript
// Path: /tenants/{tenantId}/evaluationSettings/{settingsId}
// Also: /evaluationSettings/{settingsId}  (global presets, SuperAdmin only)
interface EvaluationFeedbackRubric {
  id: string;
  tenantId?: string; // null for global presets
  name: string; // "Default", "Physics Lab", "Quick Quiz"
  description?: string;
  isDefault: boolean; // One per tenant
  isPublic?: boolean; // Global preset visible to all tenants

  // The four default RELMS dimensions + custom additions
  enabledDimensions: EvaluationDimension[];

  // Display settings
  displaySettings: {
    showStrengths: boolean;
    showKeyTakeaway: boolean;
    prioritizeByImportance: boolean;
    showMistakeClassification: boolean;
    showRubricBreakdown: boolean;
  };

  // Scoring config
  defaultScoringMode: RubricScoringMode;

  createdBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 8.5 UnifiedEvaluationResult

A single output format for all grading pipelines (RELMS + agent-based):

```typescript
interface UnifiedEvaluationResult {
  // ── Scores ──────────────────────────────────────────────────────
  score: number; // AutoGrade: marks awarded; LevelUp: points earned
  maxScore: number; // AutoGrade: maxMarks; LevelUp: totalPoints
  correctness: number; // 0–1 normalized score (universal)
  percentage: number; // 0–100

  // ── Structured Feedback (RELMS model — per dimension) ────────────
  structuredFeedback?: Record<string, FeedbackItem[]>; // dimensionId → feedback[]

  // ── Simple Arrays (backward compat, analytics) ────────────────────
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];

  // ── Rubric Breakdown (marks per criterion) ─────────────────────
  rubricBreakdown?: RubricBreakdownItem[];

  // ── Summary ──────────────────────────────────────────────────────
  summary?: {
    keyTakeaway: string;
    overallComment: string;
  };

  // ── AI Metadata ──────────────────────────────────────────────────
  confidence: number; // 0–1; LLM's confidence in evaluation
  mistakeClassification?:
    | "Conceptual"
    | "Silly Error"
    | "Knowledge Gap"
    | "None";
  evaluationRubricId?: string; // Which rubric was used
  evaluatorAgentId?: string; // Which agent evaluated (LevelUp path)
  dimensionsUsed?: string[];

  // ── Cost Tracking ─────────────────────────────────────────────
  tokensUsed?: { input: number; output: number };
  costUsd?: number;

  // Timestamp
  gradedAt: Timestamp;
}
```

---

## 9. Content Authoring Workflows

### 9.1 Workflow A: Teacher Creates a Learning Space

```
Teacher opens "Create Space" in teacher dashboard
  │
  ├── 1. SET SPACE METADATA
  │     - Title, description, subject, labels
  │     - Type: learning | practice | assessment | hybrid
  │     - Assign to class(es): classIds[]
  │     - Status: draft (won't be visible to students yet)
  │
  ├── 2. CREATE STORY POINTS
  │     - Add story points (chapters/units)
  │     - Set orderIndex and type (standard | timed_test | quiz | practice)
  │     - For assessment story points: set timeLimitMinutes, maxRetakes, etc.
  │
  ├── 3. ADD ITEMS TO STORY POINTS
  │     Within each story point:
  │     ├── Add material items (video, rich text, PDF link)
  │     ├── Add question items (select questionType, author content)
  │     ├── Add assessment items (reference other questions)
  │     └── Optionally link to existing Exam questions (cross-domain)
  │
  ├── 4. CONFIGURE EVALUATION
  │     - Set default evaluator agent for space (or per story point)
  │     - Set rubric for question items (criteria + dimensions)
  │     - AI can suggest rubric for text/paragraph questions
  │
  └── 5. PUBLISH
        - Set status: published
        - Students in assigned classIds can now access
        - Optionally schedule (publish after date)
```

### 9.2 Workflow B: Teacher Creates a Paper Exam

```
Teacher opens "Create Exam" in AutoGrade section
  │
  ├── 1. SET EXAM METADATA
  │     - Title, subject, topics[], examDate
  │     - Assign to class(es): classIds[]
  │     - Duration, totalMarks, passingMarks
  │     - Evaluation settings: which RELMS config to use
  │     - Exam type: standard | diagram_heavy | high_volume | manual_rubric
  │
  ├── 2. UPLOAD QUESTION PAPER (images)
  │     - Upload scanned question paper pages
  │     - System triggers AI question extraction (Gemini)
  │     - Questions auto-created in /exams/{examId}/questions/
  │
  ├── 3. REVIEW & EDIT EXTRACTED QUESTIONS
  │     - Review each extracted question (text, maxMarks)
  │     - Edit rubric criteria if needed
  │     - AI suggests rubric based on question text + marks
  │     - Approve final rubric per question
  │
  ├── 4. OPTIONALLY LINK TO DIGITAL CONTENT
  │     - Link this exam to a Space: exam.linkedSpaceId
  │     - System suggests Spaces with matching subject + topics
  │     - Students can access linked Space for pre-exam practice
  │
  └── 5. MARK AS READY
        - Status: 'question_paper_extracted'
        - Teachers/admin can now upload answer sheets
```

### 9.3 Workflow C: Admin Uploads Answer Sheets

```
Exam must be in status: 'question_paper_extracted' or 'in_progress'
  │
  ├── 1. SELECT EXAM + CLASS
  │     - Select which exam and which class batch is being uploaded
  │
  ├── 2. UPLOAD ANSWER SHEETS (per student)
  │     - Via web app (admin) or scanner app (scanner device)
  │     - Upload one or multiple pages per student
  │     - Associate with student (rollNumber or name)
  │     - Submission document created
  │
  ├── 3. AUTOMATIC AI PIPELINE (triggered by onSubmissionCreated)
  │     - Standard: Panopticon scouting → RELMS grading (per question)
  │     - Type 2: Page-N matching → RELMS grading (no scouting AI call)
  │
  └── 4. REVIEW + RELEASE
        - Admin/teacher reviews AI grades
        - Optionally override individual question marks
        - Set status: released (students can view results)
```

### 9.4 Workflow D: AI-Assisted Question Authoring

```
Teacher opens "Add Question" in Space editor
  │
  ├── Option 1: Author from scratch
  │     - Select questionType (e.g., mcq, paragraph)
  │     - Type content in rich text editor (LaTeX support)
  │     - Configure answer options, rubric, points
  │
  ├── Option 2: Generate with AI
  │     - Describe topic / paste text
  │     - AI generates question + answer options + rubric
  │     - Teacher reviews and edits before saving
  │
  ├── Option 3: Import from Exam
  │     - Browse questions from existing exams in the same tenant
  │     - Select question → creates UnifiedItem linked to ExamQuestion
  │
  └── Option 4: Import PYQ (Previous Year Questions)
        - Browse PYQ bank (if tenant has it)
        - Select questions → creates UnifiedItem with pyqInfo metadata
```

### 9.5 Workflow E: Publishing & Access Control

```
DRAFT: visible only to creator (teacher) and tenant admins
PUBLISHED: visible to students in assigned classes (classIds)
ARCHIVED: hidden from students, visible to admins for reference

Student access gate:
  1. Student authenticated (valid UserMembership for tenantId)
  2. Student's classIds intersects Space.classIds
     OR Space.accessType = 'tenant_wide'
  3. Space.status = 'published'
  → Student sees Space in their dashboard

Exam access gate (different from space):
  Exams are not browsed by students
  Students receive notification when results are released
  Students access results via student portal (not via Space browser)
```

---

## 10. Class Assignment Model

### 10.1 Assignment Entities

Both `Space` and `Exam` use the same `classIds[]` + `sectionIds[]` assignment
pattern established in Phase 3B:

```
Class (Cohort)
  ├── teachers[]: Teacher → teacherIds[]
  └── students[]: Student → Student.classIds[]

Space
  ├── classIds[]: Classes that can access this space
  └── teacherIds[]: Teachers who manage this space

Exam
  └── classIds[]: Classes taking this exam

Assignment rules:
  - A Space assigned to classIds=['cls_grade10_physics_a'] is visible to all
    students whose Student.classIds contains 'cls_grade10_physics_a'
  - An Exam assigned to classIds=['cls_grade10_physics_a'] creates Submissions
    for all students in that class
  - Assignment is always done at Class level (not individual student level)
  - Teachers can only assign to classes in their Teacher.classIds[]
    (unless they have canViewAllExams/canCreateSpaces permission)
```

### 10.2 Bulk Assignment

Admin can assign a Space or Exam to multiple classes at once:

```typescript
// Batch assignment (Cloud Function)
async function assignContentToClasses(
  tenantId: string,
  contentType: "space" | "exam",
  contentId: string,
  classIds: string[]
): Promise<void> {
  // Update Space.classIds or Exam.classIds
  // Trigger: spaceAssigned Cloud Task per class (for notifications)
  // Trigger: updateSpaceStats (total students count)
}
```

### 10.3 Academic Session Scoping

Content can be scoped to an academic session:

```typescript
// Query: All spaces for a class in current session
collection("tenants/{tenantId}/spaces")
  .where("classIds", "array-contains", classId)
  .where("academicSessionId", "==", currentSessionId)
  .where("status", "==", "published")
  .orderBy("createdAt", "desc");
```

### 10.4 Cross-Domain Assignment View (Teacher Dashboard)

Teachers see both Spaces and Exams assigned to their classes in a unified "My
Content" view:

```
Class: "Grade 10 — Physics 2024-25"
  │
  ├── SPACES (LevelUp)
  │     - "Wave Optics" (published) → 45 students · 72% completed
  │     - "Thermodynamics" (draft)
  │
  └── EXAMS (AutoGrade)
        - "Mid-Term Physics" (completed) → 45 students · avg 67%
        - "Unit Test 3" (in_progress) → 12 submissions received
```

---

## 11. Firestore Schema — Complete Collection Reference

### 11.1 Space Domain Collections

```
# ── SPACES ──────────────────────────────────────────────────────────────────
/tenants/{tenantId}/spaces/{spaceId}
  Fields: id, tenantId, title, description, thumbnailUrl, slug,
          type, classIds[], sectionIds?, teacherIds[], accessType,
          subject?, labels[], academicSessionId?,
          defaultEvaluatorAgentId?, defaultTutorAgentId?,
          defaultTimeLimitMinutes?, allowRetakes?, maxRetakes?,
          linkedExamIds?,
          status, publishedAt?,
          stats{totalStoryPoints, totalItems, totalStudents, avgCompletionRate},
          createdBy, createdAt, updatedAt

# ── STORY POINTS ─────────────────────────────────────────────────────────────
/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}
  Fields: id, spaceId, tenantId, title, description, thumbnailUrl,
          orderIndex, type,
          sections[{id, title, description, orderIndex}],
          assessment{timeLimitMinutes, passingScore, allowRetakes, maxRetakes,
                     questionOrder, showAnswersAfter, allowReview}?,
          evaluatorAgentId?,
          learningObjectives[], bloomsDistribution{},
          status,
          stats{totalItems, totalPoints, estimatedMinutes},
          createdAt, updatedAt

# ── ITEMS ────────────────────────────────────────────────────────────────────
/tenants/{tenantId}/spaces/{spaceId}/items/{itemId}
  Fields: id, spaceId, storyPointId, sectionId?, tenantId,
          type, title?, content?,
          difficulty?, topics[], labels[],
          payload{type, data},
          meta{totalPoints, maxMarks, bloomsLevel, cognitiveLoad,
               skillsAssessed[], learningObjectives[], prerequisites[],
               pyqInfo[], evaluatorAgentId?, isRetriable, featured,
               migrationSource{system,sourceId,sourceType}},
          rubric{criteria[], dimensions[], scoringMode, ...}?,
          linkedQuestionId?, linkedExamId?,
          analytics{},
          sectionOrderIndex?, globalOrderIndex?,
          status, createdBy, createdAt, updatedAt

# ── AGENTS (AI Configuration) ────────────────────────────────────────────────
/tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}
  Fields: id, spaceId, tenantId,
          type ('evaluator'|'tutor'),
          name, description,
          systemPrompt, modelConfig{model, temperature, ...},
          evaluationObjectives[{id, name, points, description}],
          createdAt, updatedAt
```

### 11.2 Exam Domain Collections

```
# ── EXAMS ────────────────────────────────────────────────────────────────────
/tenants/{tenantId}/exams/{examId}
  Fields: id, tenantId,
          title, subject, topics[],
          classIds[], sectionIds?,
          examDate, duration, academicSessionId?,
          totalMarks, passingMarks,
          questionPaper{images[], extractedAt, questionCount, examType}?,
          gradingConfig{autoGrade, allowRubricEdit, questionPaperType,
                        evaluationSettingsId?, allowManualOverride,
                        requireOverrideReason, releaseResultsAutomatically},
          linkedSpaceId?, linkedStoryPointId?,
          status,
          evaluationSettingsId?,
          stats{totalSubmissions, gradedSubmissions, avgScore, passRate},
          createdBy, createdAt, updatedAt

# ── EXAM QUESTIONS ────────────────────────────────────────────────────────────
/tenants/{tenantId}/exams/{examId}/questions/{questionId}
  Fields: id, examId,
          text, imageUrls[]?,
          maxMarks, order,
          rubric{criteria[], dimensions[], scoringMode, ...},
          questionType?,
          subQuestions[]?,
          linkedItemId?,
          extractedBy?, extractedAt?,
          createdAt, updatedAt

# ── SUBMISSIONS ───────────────────────────────────────────────────────────────
/tenants/{tenantId}/submissions/{submissionId}
  Fields: id, tenantId, examId, studentId, studentName, rollNumber, classId,
          answerSheets{images[], uploadedAt, uploadedBy},
          scoutingResult{routingMap{}, completedAt, method}?,
          summary{totalScore, maxScore, percentage, grade, passed,
                  status, questionsGraded?, totalQuestions?,
                  completedAt?, releasedAt?, releasedBy?},
          gradingPipeline{phase, progress, failedQuestions[]}?,
          createdAt, updatedAt

# ── QUESTION SUBMISSIONS ──────────────────────────────────────────────────────
/tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{questionId}
  Fields: id, submissionId, questionId, examId,
          mapping{pageIndices[], imageUrls[], scoutedAt},
          evaluation{score, maxScore, correctness, percentage,
                     structuredFeedback{}, strengths[], weaknesses[],
                     missingConcepts[], rubricBreakdown[], summary{},
                     confidence, mistakeClassification?,
                     evaluationRubricId?, dimensionsUsed[],
                     tokensUsed{}, costUsd?, gradedAt}?,
          manualOverride{overriddenScore, reason, overriddenBy, overriddenAt, previousScore}?,
          status, createdAt, updatedAt
```

### 11.3 Assessment Session Collections

```
# ── DIGITAL TEST SESSIONS (quiz + timed_test) ─────────────────────────────────
/tenants/{tenantId}/digitalTestSessions/{sessionId}
  Fields: id, tenantId, userId, spaceId, storyPointId, classId?,
          attemptNumber, isLatest,
          startedAt, endTime?, submittedAt?, autoSubmittedAt?,
          status,
          questionOrder[], questionStatus{itemId: status},
          answers{itemId: {itemId, questionType, submission, timeSpentSeconds, submittedAt}},
          results{totalScore, totalMarks?, totalPoints?, percentage, grade?,
                  passed?, itemResults{itemId: ItemResult}, releasedAt?, releasedBy?}?,
          gradingStatus{immediateGraded, agentQueued, agentCompleted, failed}?,
          createdAt, updatedAt

# ── QUICK ATTEMPTS (practice mode — high-frequency) ────────────────────────────
# NOTE: These are written via RTDB for high-frequency updates, periodically
# flushed to Firestore for persistence and analytics.

RTDB path: practiceProgress/{tenantId}/{userId}/{spaceId}/{itemId}
  Fields: attempts, lastScore, bestScore, totalTimeSeconds, lastAttemptAt

Firestore path (flushed periodically):
/tenants/{tenantId}/practiceProgress/{userId}_{spaceId}
  Fields: userId, spaceId, tenantId, items{itemId: {attempts, bestScore, ...}},
          lastUpdatedAt

# ── SPACE PROGRESS ─────────────────────────────────────────────────────────────
/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}
  Fields: id, userId, spaceId, tenantId, status,
          pointsEarned, totalPoints, percentage,
          storyPointProgress{storyPointId: {status, percentage, completedAt}},
          items{itemId: ItemProgressEntry},
          updatedAt, completedAt?

# ── CHAT SESSIONS ──────────────────────────────────────────────────────────────
/tenants/{tenantId}/chatSessions/{sessionId}
  Fields: id, userId, itemId, spaceId?, tenantId,
          messages[], systemPrompt,
          agentId?, model?,
          tokensUsed{}, costUsd?,
          createdAt, updatedAt
```

### 11.4 Evaluation Settings Collections

```
# ── TENANT-LEVEL EVALUATION SETTINGS (RELMS config) ───────────────────────────
/tenants/{tenantId}/evaluationSettings/{settingsId}
  Fields: id, tenantId, name, description, isDefault, isPublic?,
          enabledDimensions[{id, name, description, priority,
                              promptGuidance, enabled, isDefault, isCustom,
                              expectedFeedbackCount?, icon?}],
          displaySettings{showStrengths, showKeyTakeaway,
                           prioritizeByImportance, showMistakeClassification,
                           showRubricBreakdown},
          defaultScoringMode,
          createdBy?, createdAt, updatedAt

# ── GLOBAL EVALUATION PRESETS (platform-level, SuperAdmin only) ────────────────
/evaluationSettings/{settingsId}
  Fields: same as above but tenantId is null
```

---

## 12. Composite Index Requirements

```json
{
  "indexes": [
    // ── SPACE QUERIES ──────────────────────────────────────────────────────
    {
      "collectionGroup": "spaces",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "classIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "spaces",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "subject", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "spaces",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "academicSessionId", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "spaces",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "teacherIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },

    // ── STORY POINT QUERIES ───────────────────────────────────────────────
    {
      "collectionGroup": "storyPoints",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "spaceId", "order": "ASCENDING" },
        { "fieldPath": "orderIndex", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "storyPoints",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "spaceId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },

    // ── ITEM QUERIES ──────────────────────────────────────────────────────
    {
      "collectionGroup": "items",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "storyPointId", "order": "ASCENDING" },
        { "fieldPath": "sectionOrderIndex", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "items",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "spaceId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "items",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "topics", "arrayConfig": "CONTAINS" },
        { "fieldPath": "difficulty", "order": "ASCENDING" }
      ]
    },

    // ── EXAM QUERIES ──────────────────────────────────────────────────────
    {
      "collectionGroup": "exams",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "classIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "examDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "exams",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "subject", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "exams",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "academicSessionId", "order": "ASCENDING" },
        { "fieldPath": "examDate", "order": "DESCENDING" }
      ]
    },

    // ── QUESTION QUERIES ──────────────────────────────────────────────────
    {
      "collectionGroup": "questions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "examId", "order": "ASCENDING" },
        { "fieldPath": "order", "order": "ASCENDING" }
      ]
    },

    // ── SUBMISSION QUERIES ────────────────────────────────────────────────
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "examId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "examId", "order": "ASCENDING" },
        { "fieldPath": "classId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "studentId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },

    // ── DIGITAL TEST SESSION QUERIES ──────────────────────────────────────
    {
      "collectionGroup": "digitalTestSessions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "storyPointId", "order": "ASCENDING" },
        { "fieldPath": "isLatest", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "digitalTestSessions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "spaceId", "order": "ASCENDING" },
        { "fieldPath": "classId", "order": "ASCENDING" },
        { "fieldPath": "startedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "digitalTestSessions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startedAt", "order": "DESCENDING" }
      ]
    },

    // ── SPACE PROGRESS QUERIES ────────────────────────────────────────────
    {
      "collectionGroup": "spaceProgress",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "spaceProgress",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "spaceId", "order": "ASCENDING" },
        { "fieldPath": "percentage", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 13. Firestore Security Rules

### 13.1 Content Domain Rules

```javascript
// ─── SPACES ───────────────────────────────────────────────────────────────
match /tenants/{tenantId}/spaces/{spaceId} {
  // Students: can read if assigned to their class OR tenant_wide
  // Teachers: can read if they teach a class the space is assigned to
  // TenantAdmin: full access
  allow read: if isSuperAdmin() ||
                 isTenantAdmin(tenantId) ||
                 (isTeacher(tenantId) && (
                   request.auth.uid in resource.data.teacherIds ||
                   resource.data.classIds.hasAny(getToken().classIds)
                 )) ||
                 (isStudent(tenantId) && (
                   resource.data.accessType == 'tenant_wide' ||
                   resource.data.classIds.hasAny(getToken().classIds)
                 )) &&
                 resource.data.status == 'published';

  allow create: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                   hasTeacherPermission(tenantId, 'canCreateSpaces');

  allow update: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                   (hasTeacherPermission(tenantId, 'canManageContent') &&
                    request.auth.uid in resource.data.teacherIds);

  allow delete: if isSuperAdmin() || isTenantAdmin(tenantId);

  // ── STORY POINTS ──────────────────────────────────────────────────────
  match /storyPoints/{storyPointId} {
    allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
    allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                    hasTeacherPermission(tenantId, 'canManageContent');
  }

  // ── ITEMS ─────────────────────────────────────────────────────────────
  match /items/{itemId} {
    allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
    allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                    hasTeacherPermission(tenantId, 'canManageContent');
  }

  // ── AGENTS ───────────────────────────────────────────────────────────
  match /agents/{agentId} {
    allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
    allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                    hasTeacherPermission(tenantId, 'canConfigureAgents');
  }
}

// ─── DIGITAL TEST SESSIONS ────────────────────────────────────────────────
match /tenants/{tenantId}/digitalTestSessions/{sessionId} {
  allow read: if isSuperAdmin() ||
                 isTenantAdmin(tenantId) ||
                 isTeacher(tenantId) ||
                 (isAuthenticated() && request.auth.uid == resource.data.userId);

  // Students can create their own sessions
  allow create: if isAuthenticated() &&
                   (isStudent(tenantId) || isTenantAdmin(tenantId) || isSuperAdmin()) &&
                   request.resource.data.userId == request.auth.uid;

  // Students can update their own in-progress sessions (write answers)
  allow update: if (isAuthenticated() &&
                    request.auth.uid == resource.data.userId &&
                    resource.data.status == 'in_progress') ||
                   // Teachers/admins can update results (release grades)
                   isTenantAdmin(tenantId) || isTeacher(tenantId) || isSuperAdmin();

  allow delete: if isSuperAdmin() || isTenantAdmin(tenantId);
}

// ─── EXAMS ───────────────────────────────────────────────────────────────
match /tenants/{tenantId}/exams/{examId} {
  allow read: if isSuperAdmin() ||
                 isTenantAdmin(tenantId) ||
                 (isTeacher(tenantId) && resource.data.classIds.hasAny(getToken().classIds)) ||
                 // Students can read exam metadata (not questions/answers) for assigned exams
                 (isStudent(tenantId) && resource.data.classIds.hasAny(getToken().classIds) &&
                  // Only after results are released
                  resource.data.status == 'completed');

  allow create: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                   hasTeacherPermission(tenantId, 'canCreateExams');

  allow update: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                   (hasTeacherPermission(tenantId, 'canCreateExams') &&
                    resource.data.classIds.hasAny(getToken().classIds));

  allow delete: if isSuperAdmin() || isTenantAdmin(tenantId);

  // ── EXAM QUESTIONS ────────────────────────────────────────────────────
  match /questions/{questionId} {
    // Only teachers and admins can read questions (not students — anti-cheat)
    allow read: if isSuperAdmin() || isTenantAdmin(tenantId) || isTeacher(tenantId);
    allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                    hasTeacherPermission(tenantId, 'canEditRubrics');
  }
}

// ─── SUBMISSIONS ──────────────────────────────────────────────────────────
match /tenants/{tenantId}/submissions/{submissionId} {
  allow read: if isSuperAdmin() ||
                 isTenantAdmin(tenantId) ||
                 (isTeacher(tenantId) && teachesClass(resource.data.classId)) ||
                 // Student reads own submission only after results are released
                 (isStudent(tenantId) &&
                  getToken().studentId == resource.data.studentId &&
                  resource.data.summary.status == 'released') ||
                 // Parent reads their child's submission
                 (isParent(tenantId) && isMyStudent(resource.data.studentId) &&
                  resource.data.summary.status == 'released');

  allow create: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                   isTeacher(tenantId) || getToken().role == 'scanner';

  allow update: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                   (isTeacher(tenantId) &&
                    teachesClass(resource.data.classId));

  allow delete: if isSuperAdmin() || isTenantAdmin(tenantId);

  // ── QUESTION SUBMISSIONS ──────────────────────────────────────────────
  match /questionSubmissions/{questionId} {
    allow read: if isSuperAdmin() ||
                   isTenantAdmin(tenantId) ||
                   isTeacher(tenantId) ||
                   (isStudent(tenantId) &&
                    getToken().studentId ==
                      get(/databases/$(database)/documents/tenants/$(tenantId)/submissions/$(submissionId)).data.studentId &&
                    get(/databases/$(database)/documents/tenants/$(tenantId)/submissions/$(submissionId)).data.summary.status == 'released');
    allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                    hasTeacherPermission(tenantId, 'canManuallyGrade');
  }
}

// ─── SPACE PROGRESS ───────────────────────────────────────────────────────
match /tenants/{tenantId}/spaceProgress/{progressId} {
  allow read: if isSuperAdmin() ||
                 isTenantAdmin(tenantId) ||
                 isTeacher(tenantId) ||
                 (isAuthenticated() && request.auth.uid == resource.data.userId);

  allow write: if isAuthenticated() &&
                  request.auth.uid == resource.data.userId;
}

// ─── EVALUATION SETTINGS ─────────────────────────────────────────────────
match /tenants/{tenantId}/evaluationSettings/{settingsId} {
  allow read: if isSuperAdmin() || hasActiveMembership(tenantId);
  allow write: if isSuperAdmin() || isTenantAdmin(tenantId) ||
                  hasTeacherPermission(tenantId, 'canEditRubrics');
}

// ─── GLOBAL EVALUATION PRESETS ────────────────────────────────────────────
match /evaluationSettings/{settingsId} {
  allow read: if isAuthenticated();
  allow write: if isSuperAdmin();
}
```

---

## 14. TypeScript Type Definitions

### 14.1 Type File Organization

```
packages/shared-types/src/content/
  ├── space.ts           — Space, SpaceType
  ├── storyPoint.ts      — StoryPoint, StoryPointType, Section
  ├── item.ts            — UnifiedItem, UnifiedItemType, all Payloads
  ├── exam.ts            — Exam, ExamQuestion, PaperExamType
  ├── submission.ts      — Submission, QuestionSubmission
  ├── session.ts         — DigitalTestSession, StudentAnswer, ItemResult
  ├── rubric.ts          — UnifiedRubric, RubricCriterion, EvaluationDimension
  ├── evaluation.ts      — UnifiedEvaluationResult, EvaluationFeedbackRubric
  ├── progress.ts        — SpaceProgress, ItemProgressEntry, DigitalTestSession
  └── index.ts           — barrel export
```

### 14.2 Key Type Exports

```typescript
// packages/shared-types/src/content/index.ts

// Space Domain
export type { Space, SpaceType } from "./space";
export type { StoryPoint, StoryPointType, Section } from "./storyPoint";
export type {
  UnifiedItem,
  UnifiedItemType,
  QuestionPayload,
  MaterialPayload,
  AssessmentPayload,
  InteractivePayload,
  DiscussionPayload,
  ProjectPayload,
  CheckpointPayload,
  UnifiedItemPayload,
  ItemMetadata,
  ItemAnalytics,
} from "./item";

// Exam Domain
export type {
  Exam,
  ExamStatus,
  PaperExamType,
  ExamGradingConfig,
  ExamQuestion,
  SubQuestion,
} from "./exam";
export type {
  Submission,
  SubmissionStatus,
  QuestionSubmission,
} from "./submission";

// Assessment Sessions
export type {
  DigitalTestSession,
  QuestionStatus,
  StudentAnswer,
  ItemResult,
} from "./session";

// Rubric & Evaluation
export type {
  UnifiedRubric,
  RubricScoringMode,
  RubricCriterion,
  EvaluationDimension,
} from "./rubric";
export type {
  UnifiedEvaluationResult,
  EvaluationFeedbackRubric,
  FeedbackItem,
  FeedbackDimension,
} from "./evaluation";

// Progress
export type { SpaceProgress, ItemProgressEntry } from "./progress";
```

---

## 15. Migration Path

### 15.1 LevelUp Content Migration

```
Current: /courses/{courseId} (global)
Target:  /tenants/{tenantId}/spaces/{spaceId}

Step 1: For each CourseDTO with an orgId:
  a. Map orgId → tenantId (from org migration in Phase 3B)
  b. Create Space from CourseDTO fields:
     - title = course.title
     - description = course.description
     - type = 'hybrid' (default)
     - classIds = [] (start unassigned, let admin reassign)
     - subject = course.labels[0] (if any)
     - labels = course.labels
     - status = course.isPublic ? 'published' : 'draft'
     - defaultEvaluatorAgentId = course.defaultEvaluatorAgentId

Step 2: For each StoryPointDTO:
  a. Create StoryPoint under the migrated space
  b. type mapping:
     - 'standard' → 'standard'
     - 'timed_test' → 'timed_test'
     - 'practice' → 'practice'

Step 3: For each ItemDTO:
  a. Create UnifiedItem under the migrated space
  b. Payload mapping: identical (ItemDTO → UnifiedItem.payload)
  c. meta mapping:
     - totalPoints → meta.totalPoints
     - bloomsLevel → meta.bloomsLevel
     - evaluatorAgentId → meta.evaluatorAgentId
     - migrationSource = { system: 'levelup', sourceId: item.id, sourceType: item.type }

Step 4: For each AgentDTO (in course_agents collection):
  a. Create Agent under the migrated space

Step 5: Migrate userProgress → spaceProgress
  a. Map courseId → spaceId
  b. Preserve all ItemProgressEntry data

Step 6: Migrate TimedTestSession → DigitalTestSession
  a. status mapping:
     - 'in_progress' → 'in_progress'
     - 'completed' → 'completed'
     - 'expired' → 'expired'
  b. Add new fields: attemptNumber=1, isLatest=true, classId (from student record)

Estimated effort: Cloud Function migration script (1 day)
Rollback: Preserve original collections until verified (2-week parallel run)
```

### 15.2 AutoGrade Exam Migration

```
Current: /clients/{clientId}/exams/{examId}
Target:  /tenants/{tenantId}/exams/{examId}

Step 1: Map clientId → tenantId (from Phase 3B)

Step 2: For each Exam:
  a. Copy to /tenants/{tenantId}/exams/{examId}
  b. Add missing fields:
     - status upgrade: 'question_paper_uploaded' → 'question_paper_extracted'
       (if questions already extracted)
     - linkedSpaceId = null (no link initially)
     - academicSessionId = null (can be set by admin later)

Step 3: For each Question (in exam subcollection):
  a. Convert Rubric to UnifiedRubric:
     - rubric.criteria[] → UnifiedRubric.criteria[]
       (description → description, marks → marks)
     - scoringMode = 'criteria_based'
     - dimensions = [] (no RELMS dimensions at question level initially)

Step 4: For each Submission:
  a. Copy to /tenants/{tenantId}/submissions/{submissionId}
  b. Add: summary.releasedAt (null initially, admin sets post-migration)

Step 5: For each QuestionSubmission:
  a. Convert QuestionEvaluation to UnifiedEvaluationResult:
     - score → score
     - maxScore → maxScore
     - score/maxScore → correctness
     - structuredFeedback → structuredFeedback
     - strengths → strengths
     - weaknesses → weaknesses
     - missingConcepts → missingConcepts
     - rubricBreakdown → rubricBreakdown
     - summary → summary
     - confidence_score → confidence
     - mistake_classification → mistakeClassification
     - evaluationRubricId → evaluationRubricId
     - dimensionsUsed → dimensionsUsed
     - tokensUsed → tokensUsed
     - cost → costUsd
     - gradedAt → gradedAt

Step 6: Migrate EvaluationFeedbackRubric:
  a. Copy to /tenants/{tenantId}/evaluationSettings/{settingsId}
  b. Add defaultScoringMode = 'dimension_based'

Estimated effort: Cloud Function migration script (1 day)
Rollback: Same dual-write pattern as Phase 3B
```

### 15.3 Migration Sequence

```
1. Phase 3B migration completes (tenants created, userMemberships set)
   ↓
2. Create LevelUp Spaces from Courses (per tenant)
   ↓
3. Create StoryPoints and Items under Spaces
   ↓
4. Migrate AutoGrade Exams and Questions
   ↓
5. Migrate Submissions and QuestionSubmissions
   ↓
6. Migrate Progress data (spaceProgress, digitalTestSessions)
   ↓
7. Migrate EvaluationSettings
   ↓
8. Update Cloud Functions to use new paths
   ↓
9. Update Frontend queries (feature flag per tenant for gradual rollout)
   ↓
10. Delete old collections after verification
```

---

## 16. Open Questions & Design Decisions

| #   | Question                                                                                                                                                | Options                                                                                                                                         | Recommendation                                                                                                      | Status         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | **Answer key security** — Where to store correct answers for MCQ exams to prevent student access?                                                       | A: Encrypt in item doc. B: Server-only subcollection. C: Cloud Function evaluates without storing.                                              | **Option C** for timed tests (server evaluates on submit); Option B for item bank                                   | Needs decision |
| 2   | **Practice vs quiz scoring** — Should practice mode track scores in Firestore or only RTDB?                                                             | A: Firestore always. B: RTDB for practice, Firestore for quiz/test. C: RTDB with periodic Firestore flush.                                      | **Option C** — RTDB for real-time, nightly Cloud Function flushes to Firestore for analytics                        | Recommended    |
| 3   | **Exam-Space digital counterpart** — Should teachers be able to create a "digital version" of a paper exam (same questions, digital answer submission)? | A: Yes — `linkedSpaceId` creates a digital twin. B: No — paper and digital remain separate.                                                     | **Option A**, but as a premium feature (Phase 4); for now, just store the link                                      | Deferred       |
| 4   | **Sub-questions in paper exams** — Type "Q5(a)(b)(c)" in AutoGrade are currently flat. Should we model sub-questions explicitly?                        | A: Flat questions with label "Q5a". B: Nested SubQuestion[] in ExamQuestion.                                                                    | **Option B** — `SubQuestion[]` is already modeled in schema above; implement if rubric needs per-sub-question marks | Recommended    |
| 5   | **Cross-tenant item library** — Should platform provide a shared item bank (platform_public) accessible to all tenants?                                 | A: Yes — global `/itemBank/` collection. B: No — items always tenant-scoped.                                                                    | **Option A** for PYQs and curated content, but Phase 4 scope                                                        | Deferred       |
| 6   | **Digital test timer enforcement** — How to handle tab switches / connection drops?                                                                     | A: Client-side only (honor-based). B: Server tracks `endTime`, auto-submit on Cloud Scheduler. C: Cloud Function validates timestamp on submit. | **Option C** — server validates `submittedAt <= endTime` on submit; reject late submissions                         | Recommended    |
| 7   | **Multi-part exam upload** — If a class has 45 students, upload workflow must be efficient. Batch upload or per-student?                                | A: Per-student upload (current). B: Bulk zip upload with AI OCR to identify students.                                                           | **Option A** now; **Option B** as scanner app enhancement (Phase 4)                                                 | Deferred       |
| 8   | **Rubric version control** — If teacher edits rubric after grading starts, which rubric version does each submission use?                               | A: Snapshot rubric at time of grading into QuestionSubmission. B: Always use latest rubric (re-grade on change).                                | **Option A** — snapshot rubric at grading time (`evaluationRubricId` points to snapshot)                            | Recommended    |

---

## Summary

The unified content/assessment architecture establishes:

1. **Two-track model**: Space domain (LevelUp lineage) and Exam domain
   (AutoGrade lineage) coexist under `/tenants/{tenantId}/...` with cross-domain
   linkage via `linkedSpaceId` / `linkedExamId`.

2. **Four assessment modes**: `interactive_quiz`, `timed_test`, `practice` (all
   digital, Space domain) and `paper_exam` (physical, Exam domain) — each with
   distinct session entities and grading pipelines.

3. **`UnifiedItem`**: Single canonical item definition replacing both `ItemDTO`
   (LevelUp) and `Question` (AutoGrade) for digital content; carries both
   `totalPoints` (gamified) and `maxMarks` (academic) scoring fields.

4. **`UnifiedRubric`**: Bridges `RubricCriterion[]` (AutoGrade marks-based) and
   `EvaluationDimension[]` (RELMS/agent-based) in a single structure
   configurable at every level of the hierarchy.

5. **`UnifiedEvaluationResult`**: Single output format for both RELMS (image
   grading) and agent-based (digital grading) pipelines — including
   `correctness` (0–1 universal), `score`, `maxScore`, `structuredFeedback`,
   `rubricBreakdown`.

6. **Teacher authoring**: Unified workflow for creating Spaces (LevelUp path)
   and Exams (AutoGrade path) with optional cross-domain linking, AI-assisted
   rubric generation, and class-based assignment via `classIds[]`.

7. **Class assignment**: Both Spaces and Exams use identical `classIds[]` +
   `sectionIds[]` patterns, enabling consistent security rules and unified
   "Content for my class" views.

---

_Document produced from analysis of:_

- `docs/phase1-autograde-extraction.md` (AutoGrade domain extraction)
- `docs/phase1-levelup-extraction.md` (LevelUp domain extraction)
- `docs/phase2-cross-domain-mapping.md` (Cross-domain conflict analysis)
- `docs/phase3a-unified-user-auth.md` (User/Auth architecture)
- `docs/phase3b-unified-org-model.md` (Org/Tenancy architecture)
- `autograde/packages/types/firestore.ts` (AutoGrade Firestore types)
- `LevelUp-App/src/types/items.ts` (LevelUp ItemDTO)
- `autograde/docs/autograde-data-models.md` (AutoGrade domain model)
- `LevelUp-App/docs/levelup-domain-model.md` (LevelUp domain model)

_Author: Firebase Architect (Maestro Worker — `sess_1771516572882_y57kpzbit`)_
_Task: `task_1771515608269_1lmd2l3ib` — Phase 3C: Unified Content & Assessment
Architecture Doc_ _Date: 2026-02-19_ _Status: Complete — Ready for team review_
