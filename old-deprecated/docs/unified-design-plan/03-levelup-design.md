# LevelUp Learning Spaces — Comprehensive Design Plan

## Unified B2B SaaS Platform — Phase 4

**Version:** 1.0 **Date:** 2026-02-19 **Status:** Design Plan — Ready for
Implementation **Author:** LevelUp Engineer **References:**

- `docs/UNIFIED-ARCHITECTURE-BLUEPRINT.md` (sections 4.4, 9.1–9.5, 10.4)
- `docs/BLUEPRINT-REVIEW-RESPONSES-AND-EXTENSIONS.md` (section 3.1)
- `docs/phase1-levelup-extraction.md`
- `docs/levelup-data-architecture.md`

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Design Decisions Summary](#2-design-decisions-summary)
3. [Entity Schemas](#3-entity-schemas)
4. [Space Lifecycle](#4-space-lifecycle)
5. [Content Authoring — Space Editor (Teacher Web)](#5-content-authoring--space-editor-teacher-web)
6. [Content Consumption — Space Viewer (Student Web)](#6-content-consumption--space-viewer-student-web)
7. [Timed Test Runner](#7-timed-test-runner)
8. [Practice Mode](#8-practice-mode)
9. [Interactive Quizzes](#9-interactive-quizzes)
10. [AI Tutor Chat](#10-ai-tutor-chat)
11. [AI Answer Evaluation](#11-ai-answer-evaluation)
12. [UnifiedRubric System](#12-unifiedrubric-system)
13. [Answer Key Security](#13-answer-key-security)
14. [Cloud Function Specifications](#14-cloud-function-specifications)
15. [Firestore & RTDB Schema Design](#15-firestore--rtdb-schema-design)
16. [Migration Plan](#16-migration-plan)
17. [Testing Strategy](#17-testing-strategy)
18. [Dependencies on Other Modules](#18-dependencies-on-other-modules)

---

## 1. Overview & Scope

### What This Module Covers

The LevelUp Learning Spaces module is the entire digital learning experience
within the unified platform. It encompasses:

- **Space CRUD** with publish workflow (draft → published → archived)
- **StoryPoint CRUD** with drag-to-reorder
- **UnifiedItem CRUD** — 7 top-level types, 15 question subtypes, 7 material
  subtypes
- **AI Evaluator + Tutor agent configuration**
- **UnifiedRubric** — 4 scoring modes with inheritance chain
- **Space Editor** (teacher web) — full content authoring
- **Space Viewer** (student web) — learning experience
- **Timed Test Runner** — server-enforced timer, 5-status question tracking,
  auto-submit
- **Practice Mode** — RTDB-backed, immediate feedback, unlimited drill
- **Interactive Quizzes** — short graded quizzes with immediate feedback
- **AI Tutor Chat** — context-aware, multi-language, server-side
- **AI Answer Evaluation** — server-side per-question evaluation
- **Multi-attempt support** for quizzes and tests
- **Bloom's taxonomy tagging** and PYQ metadata
- **Answer key security** — server-only for timed tests, client-readable for
  practice
- **Migration** — LevelUp courses → spaces, all dependent entities

### Module Boundaries

This module owns all paths under:

```
/tenants/{tenantId}/spaces/{spaceId}/...
/tenants/{tenantId}/digitalTestSessions/{sessionId}
/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}
/tenants/{tenantId}/practiceProgress/{userId}_{spaceId}
/tenants/{tenantId}/chatSessions/{sessionId}
```

RTDB paths:

```
practiceProgress/{tenantId}/{userId}/{spaceId}/{itemId}
leaderboards/{tenantId}/{spaceId}
```

### What This Module Does NOT Own

- Tenant/user/class management (Phase 1–2)
- Exam/submission pipeline (Phase 3 — AutoGrade)
- Cross-system analytics and Insight Engine (Phase 5)
- Consumer B2C path specifics (Phase 6)

---

## 2. Design Decisions Summary

| Decision                     | Choice                                                                  | Rationale                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Publish workflow edits**   | In-place edits on published spaces                                      | Simpler, matches LMS norms. Teachers can add/edit items without republishing.                                                        |
| **Rubric inheritance**       | Full override (child replaces parent)                                   | Simple mental model: item > storyPoint > space > tenant default. No merge complexity.                                                |
| **Timer enforcement**        | Server-validate on submit + client auto-submit                          | Client timer triggers submit. Server validates `submittedAt <= startedAt + duration + 30s`. Periodic cleanup expires stale sessions. |
| **AI chat context**          | Current item context only                                               | Item content + student answer + evaluation + agent persona. Keeps prompts small, low cost.                                           |
| **Answer key security**      | Server-only subcollection for timed tests; client-readable for practice | Per blueprint §3.1: `answerKeys` subcollection readable only via Admin SDK for active tests.                                         |
| **Practice scoring storage** | RTDB with periodic Firestore flush                                      | Per blueprint: RTDB for live updates, 10-min + session-end flush to Firestore.                                                       |
| **AI calls**                 | All server-side via Cloud Functions                                     | Per ADR-004: secure key management, cost tracking, no client-side keys.                                                              |
| **Dual scoring**             | Marks (maxMarks) + Points (totalPoints) on items                        | Per ADR-005: both scoring models preserved.                                                                                          |

---

## 3. Entity Schemas

### 3.1 Space

**Path:** `/tenants/{tenantId}/spaces/{spaceId}`

```typescript
interface Space {
  id: string;
  tenantId: string;

  // Core
  title: string;
  description?: string;
  thumbnailUrl?: string;
  slug?: string;

  // Classification
  type: SpaceType;
  subject?: string;
  labels?: string[];

  // Assignment
  classIds: string[];
  sectionIds?: string[];
  teacherIds: string[];
  accessType: "class_assigned" | "tenant_wide" | "public_store";
  academicSessionId?: string;

  // AI configuration
  defaultEvaluatorAgentId?: string;
  defaultTutorAgentId?: string;

  // Assessment defaults
  defaultTimeLimitMinutes?: number;
  allowRetakes?: boolean;
  maxRetakes?: number;
  showCorrectAnswers?: boolean; // After submission, reveal correct answers

  // Rubric (space-level default, overrides tenant default)
  defaultRubric?: UnifiedRubric;

  // Lifecycle
  status: "draft" | "published" | "archived";
  publishedAt?: Timestamp;
  archivedAt?: Timestamp;

  // Denormalized stats
  stats?: {
    totalStoryPoints: number;
    totalItems: number;
    totalStudents: number;
    avgCompletionRate?: number;
  };

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type SpaceType = "learning" | "practice" | "assessment" | "resource" | "hybrid";
```

### 3.2 StoryPoint

**Path:** `/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}`

```typescript
interface StoryPoint {
  id: string;
  spaceId: string;
  tenantId: string;

  // Core
  title: string;
  description?: string;
  orderIndex: number; // For drag-to-reorder

  // Type determines UX mode
  type: StoryPointType;

  // Sections (embedded, lightweight)
  sections: StoryPointSection[];

  // Assessment config (for timed_test, quiz, practice types)
  assessmentConfig?: {
    durationMinutes?: number; // Timer duration
    instructions?: string; // Pre-test instructions
    maxAttempts?: number; // 0 = unlimited
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    showResultsImmediately?: boolean;
    passingPercentage?: number; // 0-100
  };

  // Rubric (storyPoint-level, overrides space default)
  defaultRubric?: UnifiedRubric;

  // Metadata
  difficulty?: "easy" | "medium" | "hard" | "expert";
  estimatedTimeMinutes?: number;

  // Denormalized stats
  stats?: {
    totalItems: number;
    totalQuestions: number;
    totalMaterials: number;
    totalPoints: number;
  };

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type StoryPointType =
  | "standard" // Mixed content: materials + questions
  | "timed_test" // Strict timer, 5-status tracking, auto-submit
  | "quiz" // Interactive quiz, immediate feedback
  | "practice" // Unlimited drill, immediate feedback
  | "test"; // Alias for timed_test (legacy compat)

interface StoryPointSection {
  id: string;
  title: string;
  orderIndex: number;
  description?: string;
}
```

### 3.3 UnifiedItem

**Path:** `/tenants/{tenantId}/spaces/{spaceId}/items/{itemId}`

```typescript
interface UnifiedItem {
  id: string;
  spaceId: string;
  storyPointId: string;
  sectionId?: string;
  tenantId: string;

  // Type system
  type: ItemType;
  payload: ItemPayload; // Discriminated union by type

  // Display
  title?: string;
  content?: string; // Optional description/instructions

  // Classification
  difficulty?: "easy" | "medium" | "hard";
  topics?: string[];
  labels?: string[];

  // Ordering
  orderIndex: number; // Within section (or story point if no section)

  // Metadata
  meta?: ItemMetadata;

  // Analytics dimensions
  analytics?: ItemAnalytics;

  // Rubric (item-level, overrides storyPoint default)
  rubric?: UnifiedRubric;

  // Audit
  createdBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────
// 7 Top-Level Item Types
// ─────────────────────────────────────────────────────
type ItemType =
  | "question"
  | "material"
  | "interactive"
  | "assessment"
  | "discussion"
  | "project"
  | "checkpoint";

// Discriminated union payload
type ItemPayload =
  | QuestionPayload
  | MaterialPayload
  | InteractivePayload
  | AssessmentPayload
  | DiscussionPayload
  | ProjectPayload
  | CheckpointPayload;

// ─────────────────────────────────────────────────────
// 15 Question Subtypes
// ─────────────────────────────────────────────────────
interface QuestionPayload {
  questionType: QuestionType;
  title?: string;
  content: string; // Question prompt (supports markdown + LaTeX)
  explanation?: string; // Post-answer explanation
  basePoints?: number; // Points for this question
  difficulty?: "easy" | "medium" | "hard";
  questionData: QuestionTypeData; // Type-specific data
}

type QuestionType =
  | "mcq" // Multiple Choice (single correct)
  | "mcaq" // Multiple Choice (multiple correct)
  | "true-false" // True/False
  | "numerical" // Numeric answer (tolerance-based)
  | "text" // Short text answer
  | "paragraph" // Long-form text (AI-evaluated)
  | "code" // Code with test cases
  | "fill-blanks" // Fill in the blanks (typed)
  | "fill-blanks-dd" // Fill in the blanks (dropdown)
  | "matching" // Match pairs
  | "jumbled" // Arrange in order
  | "audio" // Audio recording answer
  | "image_evaluation" // Image upload answer
  | "group-options" // Categorize items into groups
  | "chat_agent_question"; // AI chat-based question

// ─────────────────────────────────────────────────────
// Question Type-Specific Data Structures
// ─────────────────────────────────────────────────────

interface MCQData {
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
  shuffleOptions?: boolean;
}

interface MCAQData {
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
  minSelections?: number;
  maxSelections?: number;
  shuffleOptions?: boolean;
}

interface TrueFalseData {
  correctAnswer: boolean;
  explanation?: string;
}

interface NumericalData {
  correctAnswer: number;
  tolerance?: number; // Acceptable deviation
  unit?: string;
  decimalPlaces?: number;
}

interface TextData {
  correctAnswer?: string; // For auto-evaluation
  caseSensitive?: boolean;
  acceptableAnswers?: string[]; // Multiple valid answers
  maxLength?: number;
}

interface ParagraphData {
  maxLength?: number;
  minLength?: number;
  modelAnswer?: string; // Reference answer for AI evaluation
  evaluationGuidance?: string; // Instructions for AI evaluator
}

interface CodeData {
  language: string; // 'javascript' | 'python' | 'java' | etc.
  starterCode?: string;
  testCases: Array<{
    id: string;
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
    description?: string;
    points?: number;
  }>;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

interface FillBlanksData {
  textWithBlanks: string; // "The {0} is {1}" — indexed placeholders
  blanks: Array<{
    id: string;
    correctAnswer: string;
    acceptableAnswers?: string[];
    caseSensitive?: boolean;
  }>;
}

interface FillBlanksDDData {
  textWithBlanks: string;
  blanks: Array<{
    id: string;
    correctOptionId: string;
    options: Array<{ id: string; text: string }>;
  }>;
}

interface MatchingData {
  pairs: Array<{
    id: string;
    left: string;
    right: string;
  }>;
  shufflePairs?: boolean;
}

interface JumbledData {
  correctOrder: string[]; // Correct sequence of item IDs
  items: Array<{
    id: string;
    text: string;
  }>;
}

interface AudioData {
  maxDurationSeconds?: number;
  language?: string;
  evaluationGuidance?: string;
}

interface ImageEvaluationData {
  instructions: string; // What the image should contain
  maxImages?: number;
  evaluationGuidance?: string;
}

interface GroupOptionsData {
  groups: Array<{
    id: string;
    name: string;
    correctItems: string[];
  }>;
  items: Array<{
    id: string;
    text: string;
  }>;
}

interface ChatAgentQuestionData {
  agentId?: string; // Specific agent for this question
  objectives: string[]; // What student should demonstrate
  conversationStarters?: string[]; // Suggested first messages
  maxTurns?: number;
  evaluationGuidance?: string;
}

type QuestionTypeData =
  | MCQData
  | MCAQData
  | TrueFalseData
  | NumericalData
  | TextData
  | ParagraphData
  | CodeData
  | FillBlanksData
  | FillBlanksDDData
  | MatchingData
  | JumbledData
  | AudioData
  | ImageEvaluationData
  | GroupOptionsData
  | ChatAgentQuestionData;

// ─────────────────────────────────────────────────────
// 7 Material Subtypes
// ─────────────────────────────────────────────────────
interface MaterialPayload {
  materialType: MaterialType;
  url?: string; // External URL (video, PDF, link)
  duration?: number; // Estimated time in minutes
  downloadable?: boolean;
  content?: string; // Embedded text/markdown content
  richContent?: RichContentBlock; // Blog-style rich content
}

type MaterialType =
  | "text" // Markdown/plain text
  | "video" // Hosted or embedded video
  | "pdf" // PDF document
  | "link" // External link
  | "interactive" // Embedded interactive (iframe)
  | "story" // Story-format narrative
  | "rich"; // Blog-style rich article

interface RichContentBlock {
  title?: string;
  subtitle?: string;
  coverImage?: string;
  blocks: Array<{
    id: string;
    type:
      | "heading"
      | "paragraph"
      | "image"
      | "video"
      | "audio"
      | "code"
      | "quote"
      | "list"
      | "divider";
    content: string;
    metadata?: Record<string, any>;
    styles?: Record<string, any>;
  }>;
  tags?: string[];
  author?: { name: string; avatar?: string; bio?: string };
  readingTime?: number;
}

// ─────────────────────────────────────────────────────
// Other Payload Types
// ─────────────────────────────────────────────────────
interface InteractivePayload {
  interactiveType: "simulation" | "demo" | "tool" | "game";
  url: string;
  embeddable?: boolean;
  parameters?: Record<string, any>;
  instructions?: string;
}

interface AssessmentPayload {
  assessmentType: "quiz" | "exam" | "project" | "peer_review";
  timeLimit?: number;
  attempts?: number;
  passingScore?: number;
  itemReferences?: string[];
  rubric?: Array<{ criterion: string; maxPoints: number; description: string }>;
}

interface DiscussionPayload {
  prompt: string;
  threadType: "open" | "guided";
  moderationEnabled?: boolean;
}

interface ProjectPayload {
  instructions: string;
  deliverables: string[];
  dueDate?: Timestamp;
  teamSize?: number;
  rubric?: Array<{ criterion: string; maxPoints: number; description: string }>;
}

interface CheckpointPayload {
  requiredItemIds?: string[]; // Items that must be completed
  requiredPercentage?: number; // Minimum completion %
  message?: string; // Congratulatory/checkpoint message
}

// ─────────────────────────────────────────────────────
// Item Metadata
// ─────────────────────────────────────────────────────
interface ItemMetadata {
  totalPoints?: number; // LevelUp gamified points
  maxMarks?: number; // AutoGrade academic marks
  estimatedTime?: number; // Minutes
  tags?: string[];

  // Educational metadata
  learningObjectives?: string[];
  skillsAssessed?: string[];
  bloomsLevel?: BloomsLevel;
  prerequisites?: string[]; // Item IDs

  // Retries
  isRetriable?: boolean; // Default: true

  // AI evaluator override (takes precedence over storyPoint/space default)
  evaluatorAgentId?: string;

  // PYQ (Previous Year Question) metadata
  pyqInfo?: Array<{
    exam: string; // "JEE-Main", "NEET", "SAT"
    year: number;
    session?: string; // "January", "June"
    questionNumber?: string;
  }>;

  // Analytics
  featured?: boolean;
  viewCount?: number;
  successRate?: number;

  // Migration
  migrationSource?: {
    type: "levelup_item" | "levelup_question" | "autograde_question";
    sourceId: string;
    sourceCollection: string;
  };
}

type BloomsLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

// ─────────────────────────────────────────────────────
// Item Analytics Dimensions
// ─────────────────────────────────────────────────────
interface ItemAnalytics {
  difficulty?: "easy" | "medium" | "hard";
  topics?: string[];
  labels?: string[];
  bloomsLevel?: BloomsLevel;
  bloomsSubLevel?: string;
  cognitiveLoad?: "low" | "medium" | "high";
  skillsAssessed?: string[];
  primarySkill?: string;
  secondarySkills?: string[];
  conceptCategory?: string;
  learningObjective?: string;
  applicationDomain?: "theory" | "practical" | "real-world" | "conceptual";
  questionComplexity?:
    | "single-concept"
    | "multi-concept"
    | "synthesis"
    | "integration";
  prerequisiteTopics?: string[];
  relatedTopics?: string[];
  conceptImportance?:
    | "foundational"
    | "important"
    | "advanced"
    | "optional"
    | "bonus";
  commonMistakes?: string[];
  hintsAvailable?: boolean;
  curriculumStandards?: string[];
  examRelevance?: string[];
  customDimensions?: Record<string, string | string[] | number>;
}
```

### 3.4 Agent

**Path:** `/tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}`

```typescript
interface Agent {
  id: string;
  spaceId: string;
  tenantId: string;

  type: AgentType;
  name: string;
  identity: string; // Persona description

  // Tutor-specific
  systemPrompt?: string; // System instructions for tutor
  supportedLanguages?: string[]; // e.g., ['english', 'hindi']
  defaultLanguage?: string;
  maxConversationTurns?: number;

  // Evaluator-specific
  rules?: string; // Grading rules text
  evaluationObjectives?: EvaluationObjective[];
  strictness?: "lenient" | "moderate" | "strict";
  feedbackStyle?: "brief" | "detailed" | "encouraging";

  // Shared
  modelOverride?: string; // Override tenant default model
  temperatureOverride?: number; // 0.0-1.0

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type AgentType = "tutor" | "evaluator";

interface EvaluationObjective {
  id: string;
  name: string;
  points: number;
  description?: string;
}
```

### 3.5 UnifiedRubric

```typescript
interface UnifiedRubric {
  // Scoring mode determines which fields are used
  scoringMode: RubricScoringMode;

  // Criteria-based (marks allocation — AutoGrade model)
  criteria?: RubricCriterion[];

  // Dimension-based (RELMS feedback dimensions)
  dimensions?: EvaluationDimension[];

  // Holistic
  holisticGuidance?: string;
  holisticMaxScore?: number;

  // Shared settings
  passingPercentage?: number;
  showModelAnswer?: boolean;
  modelAnswer?: string;
  evaluatorGuidance?: string; // Free-text instructions for AI evaluator
}

type RubricScoringMode =
  | "criteria_based" // Score per criterion (traditional rubric)
  | "dimension_based" // RELMS-style feedback dimensions
  | "holistic" // Single holistic score
  | "hybrid"; // Criteria + dimensions combined

interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
  weight?: number; // Relative weight (defaults to 1)
  levels?: Array<{
    score: number;
    label: string; // "Excellent", "Good", "Needs Work"
    description: string;
  }>;
}

interface EvaluationDimension {
  id: string;
  name: string; // e.g., "Accuracy", "Completeness", "Clarity"
  description?: string;
  weight: number; // 0-1, all dimensions sum to 1
  scoringScale: number; // e.g., 5 (1-5 scale) or 10 (1-10 scale)
}
```

### 3.6 DigitalTestSession

**Path:** `/tenants/{tenantId}/digitalTestSessions/{sessionId}`

```typescript
interface DigitalTestSession {
  id: string;
  tenantId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;

  // Session metadata
  sessionType: "timed_test" | "quiz" | "practice";
  attemptNumber: number;
  status: TestSessionStatus;
  isLatest: boolean; // For querying latest attempt

  // Timing
  startedAt: Timestamp; // Server timestamp
  endedAt?: Timestamp;
  durationMinutes: number; // Configured duration
  serverDeadline?: Timestamp; // startedAt + duration (precomputed)

  // Question tracking
  totalQuestions: number;
  answeredQuestions: number;
  questionOrder: string[]; // Item IDs in display order

  // 5-Status tracking maps
  visitedQuestions: Record<string, boolean>;
  submissions: Record<string, TestSubmission>;
  markedForReview: Record<string, boolean>;

  // Scores (computed on submit)
  pointsEarned?: number;
  totalPoints?: number;
  marksEarned?: number; // Academic marks
  totalMarks?: number;
  percentage?: number;

  // Results
  analytics?: TestAnalytics; // Dimensional breakdown

  // Audit
  submittedAt?: Timestamp; // When student clicked submit
  autoSubmitted?: boolean; // True if timer expired
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type TestSessionStatus =
  | "in_progress"
  | "completed"
  | "expired" // Server expired stale session
  | "abandoned"; // Student never returned

interface TestSubmission {
  itemId: string;
  questionType: QuestionType;
  answer: any; // Normalized answer data
  submittedAt: number;
  timeSpentSeconds: number;

  // Evaluation (filled after grading)
  evaluation?: UnifiedEvaluationResult;
  correct?: boolean;
  pointsEarned?: number;
  totalPoints?: number;
}
```

### 3.7 SpaceProgress

**Path:** `/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}`

```typescript
interface SpaceProgress {
  id: string; // ${userId}_${spaceId}
  userId: string;
  tenantId: string;
  spaceId: string;

  status: "not_started" | "in_progress" | "completed";

  // Aggregate scores
  pointsEarned: number;
  totalPoints: number;
  marksEarned?: number;
  totalMarks?: number;
  percentage: number; // 0-1

  // Per-story-point progress
  storyPoints: Record<string, StoryPointProgress>;

  // Per-item progress (flat map for quick lookup)
  items: Record<string, ItemProgressEntry>;

  // Timestamps
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  updatedAt: Timestamp;
}

interface StoryPointProgress {
  storyPointId: string;
  status: "not_started" | "in_progress" | "completed";
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  completedAt?: number;
}

interface ItemProgressEntry {
  itemId: string;
  itemType: ItemType;
  completed: boolean;
  completedAt?: number;
  timeSpent?: number; // Seconds
  interactions?: number;
  lastUpdatedAt: number;

  // Question-specific
  questionData?: {
    status: "pending" | "correct" | "incorrect" | "partial";
    attemptsCount: number;
    bestScore: number;
    pointsEarned: number;
    totalPoints: number;
    percentage: number;
    solved: boolean;
  };

  // Material-specific
  progress?: number; // 0-100 for media consumption
  score?: number;
  feedback?: string;
}
```

### 3.8 ChatSession

**Path:** `/tenants/{tenantId}/chatSessions/{sessionId}`

```typescript
interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  questionType?: string;

  // Agent
  agentId?: string;
  agentName?: string;

  // Session metadata
  sessionTitle: string;
  previewMessage: string;
  messageCount: number;
  language: string;
  isActive: boolean;

  // Conversation
  messages: ChatMessage[];
  systemPrompt: string;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string; // ISO 8601
  mediaUrls?: string[]; // Attached images/audio
  tokensUsed?: { input: number; output: number };
}
```

---

## 4. Space Lifecycle

### 4.1 Status Transitions

```
                    ┌──────────┐
           create   │          │   publish
       ────────────▶│  draft   │──────────────▶ published
                    │          │                     │
                    └──────────┘                     │
                         ▲                           │
                         │ unarchive                 │ archive
                         │                           ▼
                    ┌────┴─────┐              ┌──────────┐
                    │  draft   │◀─────────────│ archived │
                    └──────────┘  clone-as    └──────────┘
                                   -draft
```

### 4.2 Transition Rules

| Transition              | Guard                              | Side Effects                                                                                          |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `draft → published`     | At least 1 story point with 1 item | Set `publishedAt`, students gain access, notification sent                                            |
| `published → published` | (in-place edits)                   | Items/storyPoints editable directly. No status change needed.                                         |
| `published → archived`  | Teacher/admin action               | Students lose access to new sessions. Existing in-progress sessions complete. Progress data retained. |
| `archived → draft`      | Teacher/admin action               | Creates a new draft copy. Original archived space retained for audit.                                 |

### 4.3 Publish Validation Rules

Before a space can transition from `draft` to `published`:

1. Space must have a `title`
2. At least one `storyPoint` exists
3. Each timed_test storyPoint must have `assessmentConfig.durationMinutes > 0`
4. At least one item exists per story point
5. All question items must have valid `questionData` (at minimum: content +
   answer key for auto-evaluated types)

### 4.4 In-Place Edit Rules (Published Spaces)

- Teachers can add/edit/delete items and story points freely
- Changes are live immediately for students
- Deleting an item that has progress data: item is soft-deleted (hidden from new
  sessions), progress data retained
- Reordering story points: update `orderIndex` via batch write

### 4.5 Cloud Functions

```typescript
// Publish space
publishSpace(tenantId: string, spaceId: string): Promise<void>
  // 1. Validate publish rules
  // 2. Update space.status = 'published', space.publishedAt = now
  // 3. Send notification to students in assigned classes

// Archive space
archiveSpace(tenantId: string, spaceId: string): Promise<void>
  // 1. Update space.status = 'archived', space.archivedAt = now
  // 2. Expire all in-progress timed test sessions (status → 'expired')
  // 3. Keep progress data intact
```

---

## 5. Content Authoring — Space Editor (Teacher Web)

### 5.1 Screen Architecture

```
Space Editor (/teacher/spaces/:spaceId/edit)
├── Space Settings
│   ├── Title, Description, Thumbnail
│   ├── Type selector (learning, practice, assessment, resource, hybrid)
│   ├── Class assignment (multi-select from teacher's classes)
│   ├── Subject, Labels
│   ├── Default assessment settings (time limit, retakes, show answers)
│   └── Default rubric configuration
│
├── Story Point List (drag-to-reorder)
│   ├── Add Story Point button
│   ├── Story Point cards (title, type, item count, drag handle)
│   └── Each card → opens Story Point Editor
│
├── Story Point Editor (slide-over panel or full page)
│   ├── Title, Description, Type
│   ├── Assessment Config (if type = timed_test/quiz/practice)
│   │   ├── Duration (minutes)
│   │   ├── Max attempts
│   │   ├── Shuffle questions/options
│   │   ├── Show results immediately
│   │   └── Passing percentage
│   ├── Section Manager
│   │   ├── Add Section
│   │   ├── Drag-to-reorder sections
│   │   └── Items listed under sections
│   └── Item List (per section)
│       ├── Add Item button (type picker dialog)
│       ├── Item cards (drag-to-reorder within section)
│       └── Each card → opens Item Editor
│
├── Item Editor (modal or full page)
│   ├── Type-specific editor (see §5.2)
│   ├── Metadata panel (points, marks, Bloom's, PYQ, tags)
│   ├── Rubric override (optional)
│   └── Preview toggle
│
├── Agent Config
│   ├── Evaluator Agents list (create/edit/delete)
│   │   ├── Name, Identity, Rules
│   │   ├── Evaluation Objectives
│   │   └── Set as default evaluator
│   └── Tutor Agents list (create/edit/delete)
│       ├── Name, Identity, System Prompt
│       ├── Supported Languages
│       └── Set as default tutor
│
└── Publish Controls
    ├── Status badge (draft/published/archived)
    ├── Publish button (with validation)
    └── Archive button
```

### 5.2 Item Type Editors

| Question Type    | Editor Components                                                            |
| ---------------- | ---------------------------------------------------------------------------- |
| MCQ / MCAQ       | Rich text prompt + options list (add/remove/reorder) + correct answer toggle |
| True-False       | Rich text prompt + true/false toggle                                         |
| Numerical        | Rich text prompt + correct answer input + tolerance + unit                   |
| Text             | Rich text prompt + acceptable answers list + case-sensitivity toggle         |
| Paragraph        | Rich text prompt + model answer + evaluation guidance + min/max length       |
| Code             | Rich text prompt + language selector + starter code + test cases editor      |
| Fill-blanks      | Template editor with blank placeholders + correct answers                    |
| Fill-blanks-dd   | Template editor with blank placeholders + dropdown options per blank         |
| Matching         | Pairs editor (left column / right column)                                    |
| Jumbled          | Items list + correct order definition                                        |
| Audio            | Instructions + max duration + language                                       |
| Image evaluation | Instructions + max images + evaluation guidance                              |
| Group options    | Groups editor + items editor + correct categorization                        |
| Chat agent       | Agent selector + objectives + conversation starters                          |

| Material Type | Editor Components                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Text          | Markdown editor                                                                                       |
| Video         | URL input + duration                                                                                  |
| PDF           | File upload to Cloud Storage + URL                                                                    |
| Link          | URL input + description                                                                               |
| Interactive   | Embed URL + parameters                                                                                |
| Story         | Narrative text editor                                                                                 |
| Rich          | Block-based rich content editor (heading, paragraph, image, video, audio, code, quote, list, divider) |

### 5.3 Drag-to-Reorder Implementation

**Story Points:**

```typescript
// On drag end, batch update orderIndex for all affected story points
async function reorderStoryPoints(
  tenantId: string,
  spaceId: string,
  orderedIds: string[]
): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    const ref = doc(
      db,
      `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${id}`
    );
    batch.update(ref, { orderIndex: index, updatedAt: Timestamp.now() });
  });
  await batch.commit();
}
```

**Items within sections:** Same pattern, updating `orderIndex` per item. Moving
items between sections updates both `sectionId` and `orderIndex`.

---

## 6. Content Consumption — Space Viewer (Student Web)

### 6.1 Screen Architecture

```
Space Viewer (/student/spaces/:spaceId)
├── Space Home
│   ├── Space title, description, thumbnail
│   ├── Overall progress bar (points earned / total)
│   ├── Story Point list (ordered, with progress indicators)
│   │   ├── Standard: progress bar + item count
│   │   ├── Timed test: "Start Test" / "View Results" / attempt badges
│   │   ├── Quiz: progress bar + score
│   │   └── Practice: items solved / total
│   └── Leaderboard preview (top 5)
│
├── Story Point Viewer (standard type)
│   ├── Section navigation (sidebar or tabs)
│   ├── Item list per section
│   │   ├── Material items → inline reader/viewer
│   │   └── Question items → interactive answerer
│   └── Progress tracker (items completed / total)
│
├── Material Reader
│   ├── Text → markdown renderer
│   ├── Video → embedded player
│   ├── PDF → PDF viewer
│   ├── Link → iframe or external redirect
│   ├── Rich → block-based article renderer
│   └── Mark as read button
│
├── Question Answerer
│   ├── Question display (content + media)
│   ├── Answer input (type-specific)
│   ├── Submit button
│   ├── Feedback panel (correct/incorrect, explanation, AI feedback)
│   ├── Points earned display
│   ├── AI Chat button (opens tutor panel)
│   └── Retry button (if retriable)
│
├── Timed Test Runner → See §7
├── Practice Mode → See §8
├── Interactive Quiz → See §9
│
└── AI Tutor Chat Panel → See §10
```

### 6.2 Access Control

Students can access a space if:

```typescript
function canAccessSpace(
  space: Space,
  student: Student,
  membership: UserMembership
): boolean {
  if (space.status !== "published") return false;
  if (space.accessType === "tenant_wide") return true;
  if (space.accessType === "public_store") return true; // Consumer path
  // class_assigned: student must be in one of the assigned classes
  return space.classIds.some((cid) => student.classIds.includes(cid));
}
```

### 6.3 Progress Tracking Flow

```
Student submits answer
  │
  ├─ Auto-evaluated (MCQ, true-false, numerical, fill-blanks, matching, jumbled, group-options)
  │   └─ Client-side evaluation → immediate result
  │
  └─ AI-evaluated (text, paragraph, code, audio, image_evaluation, chat_agent)
      └─ Cloud Function call → evaluateAnswer() → result returned
  │
  ▼
Record attempt (if outside timed test):
  Cloud Function: recordItemAttempt(tenantId, userId, spaceId, storyPointId, itemId, submission, evaluation)
    1. Write to /tenants/{tenantId}/spaceProgress/{userId}_{spaceId}
       - Update items[itemId] with new score (keep best)
       - Recalculate storyPoint aggregate
       - Recalculate space aggregate
    2. Update RTDB leaderboard (if points changed)
    3. Return updated progress to client
```

---

## 7. Timed Test Runner

### 7.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TIMED TEST RUNNER                         │
│                                                             │
│  ┌──────────┐  ┌─────────────────┐  ┌───────────────────┐  │
│  │  Timer    │  │ Question Panel  │  │ Question Navigator│  │
│  │ Display   │  │ (per type)      │  │ (5-status grid)   │  │
│  │ (countdown│  │                 │  │                   │  │
│  │  from     │  │ • Question text │  │ ■ Not Visited     │  │
│  │  server   │  │ • Answer input  │  │ ■ Not Answered    │  │
│  │  deadline)│  │ • Save button   │  │ ■ Answered        │  │
│  │           │  │                 │  │ ■ Marked Review   │  │
│  │  Auto-    │  │                 │  │ ■ Answered+Marked │  │
│  │  submit   │  │                 │  │                   │  │
│  │  at 0     │  │                 │  │ Click → navigate  │  │
│  └──────────┘  └─────────────────┘  └───────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Controls: Save & Next │ Mark for Review │ Clear │ Submit│ │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Session Lifecycle

```
1. LANDING PAGE
   - Show: test name, duration, instructions, previous attempts
   - "Start New Attempt" button
   - Guard: check maxAttempts

2. START TEST
   Cloud Function: startTimedTest(tenantId, userId, spaceId, storyPointId)
   → Create DigitalTestSession:
     - status: 'in_progress'
     - startedAt: admin.firestore.FieldValue.serverTimestamp()
     - serverDeadline: startedAt + durationMinutes * 60 * 1000
     - questionOrder: shuffled item IDs (if shuffle enabled)
     - isLatest: true (mark previous attempts isLatest: false)
   → Return sessionId + startedAt (server time)

3. QUESTION NAVIGATION
   - Client calculates remaining time from: serverDeadline - serverNow
   - Free navigation between questions
   - Each question opened → set visitedQuestions[itemId] = true
   - Each answer saved → update submissions[itemId]
   - Mark for review → toggle markedForReview[itemId]

4. ANSWER SAVING (per question)
   Client writes directly to Firestore session document:
   - Update submissions[itemId] = { answer, submittedAt, timeSpentSeconds }
   - Update answeredQuestions count
   - NO evaluation during test (answers are raw)

5. SUBMIT TEST
   a. Manual submit: User clicks "Submit Test" → confirmation dialog
   b. Auto-submit: Client timer reaches 0 → auto-trigger submit
   c. Both call Cloud Function: submitTimedTest(tenantId, sessionId)

6. SERVER VALIDATION & GRADING
   Cloud Function: submitTimedTest(tenantId, sessionId)
   → Validate: submittedAt <= serverDeadline + 30s grace period
   → If invalid: reject submission (session stays in_progress for manual resolution)
   → If valid:
     a. Load all items for this storyPoint (from server, with answer keys)
     b. For each submission:
        - Auto-evaluate auto-gradeable types (MCQ, true-false, etc.)
        - Queue AI evaluation for subjective types (paragraph, image, audio)
     c. Compute scores: pointsEarned, totalPoints, percentage
     d. Update session: status='completed', endedAt, scores
     e. Update spaceProgress for this user
     f. Update RTDB leaderboard
   → Return results

7. RESULTS PAGE
   - Score summary (points, percentage, time taken)
   - Per-question breakdown (correct/incorrect, points, time spent)
   - Dimensional analytics (by topic, difficulty, Bloom's level)
   - "Correct answers" shown if space.showCorrectAnswers === true
   - Previous attempt comparison
```

### 7.3 5-Status Question Tracking

```typescript
function getQuestionStatus(
  itemId: string,
  session: DigitalTestSession
): QuestionStatus {
  const visited = session.visitedQuestions[itemId] ?? false;
  const answered = itemId in session.submissions;
  const marked = session.markedForReview[itemId] ?? false;

  if (answered && marked) return "answered_and_marked"; // Purple
  if (answered) return "answered"; // Green
  if (marked) return "marked_for_review"; // Amber
  if (visited) return "not_answered"; // Orange
  return "not_visited"; // Gray
}

type QuestionStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked_for_review"
  | "answered_and_marked";
```

### 7.4 Stale Session Cleanup

```typescript
// Cloud Scheduler: every 30 minutes
async function cleanupStaleTimedTestSessions(): Promise<void> {
  const staleThreshold = Timestamp.fromMillis(
    Date.now() - 24 * 60 * 60 * 1000 // 24 hours past deadline
  );

  // Query sessions that are in_progress with serverDeadline < 24h ago
  const query = db
    .collectionGroup("digitalTestSessions")
    .where("status", "==", "in_progress")
    .where("serverDeadline", "<", staleThreshold);

  const stale = await query.get();
  const batch = db.batch();

  for (const doc of stale.docs) {
    batch.update(doc.ref, {
      status: "expired",
      endedAt: Timestamp.now(),
      autoSubmitted: true,
      updatedAt: Timestamp.now(),
    });
    // Note: no grading for expired sessions — teacher can manually trigger
  }

  await batch.commit();
}
```

### 7.5 Timer Synchronization

The client must not rely on local clock for timer display:

```typescript
// On session start, client receives server startedAt
// Client fetches server time offset once:
const serverTimeOffset = await getServerTimeOffset(); // Firebase server timestamp - local Date.now()

// Timer calculation:
function getRemainingSeconds(session: DigitalTestSession): number {
  const serverNow = Date.now() + serverTimeOffset;
  const deadline = session.serverDeadline.toMillis();
  return Math.max(0, Math.floor((deadline - serverNow) / 1000));
}
```

---

## 8. Practice Mode

### 8.1 Overview

Practice mode provides unlimited, no-pressure drill with immediate feedback. Key
characteristics:

- No timer
- Unlimited attempts per question
- Immediate feedback after each answer (correct answer + explanation shown)
- Answer keys are client-readable (not hidden)
- Progress stored in RTDB for fast writes, flushed to Firestore periodically
- No formal session — students can enter/exit freely

### 8.2 RTDB Data Structure

```
practiceProgress/{tenantId}/{userId}/{spaceId}/
  items/
    {itemId}/
      s: 'c' | 'i' | 'a' | 'p'        // status: correct, incorrect, attempted, pending
      t: number                          // completedAt timestamp
      a: number                          // attempts count
      b?: number                         // bestScore (0-100)
  stats/
    itemsCompleted: number
    totalItems: number
    pointsEarned: number
    lastActiveAt: number
```

### 8.3 Practice Flow

```
1. Student opens practice storyPoint
2. Load items from Firestore (with answer keys — practice mode allows this)
3. Load progress from RTDB: practiceProgress/{tenantId}/{userId}/{spaceId}
4. Display items with filters:
   - Difficulty (easy/medium/hard)
   - Topics/tags
   - Status (solved/unsolved/attempted)
   - PYQ filter
5. Student selects item → answer area opens
6. Student submits answer:
   a. Auto-evaluated types: evaluate client-side immediately
   b. AI-evaluated types: Cloud Function call (evaluateAnswer)
7. Show feedback: correct/incorrect, explanation, AI feedback
8. Update RTDB progress: practiceProgress/{tenantId}/{userId}/{spaceId}/items/{itemId}
9. Update RTDB stats
```

### 8.4 RTDB → Firestore Flush

Three flush triggers (per blueprint §4.3):

1. **Session end:** Student clicks "Done" or navigates away → client calls
   `flushPracticeProgress` Cloud Function
2. **Browser close:** `beforeunload` → `navigator.sendBeacon()` to flush
   endpoint (best-effort)
3. **Periodic flush:** Cloud Scheduler every 10 minutes →
   `flushStalePracticeProgress` scans RTDB for entries with
   `lastActiveAt > 10 min ago`, flushes to Firestore `spaceProgress`

```typescript
// Cloud Function: flushPracticeProgress
async function flushPracticeProgress(
  tenantId: string,
  userId: string,
  spaceId: string
): Promise<void> {
  // 1. Read all item progress from RTDB
  const rtdbRef = rtdb.ref(`practiceProgress/${tenantId}/${userId}/${spaceId}`);
  const snapshot = await rtdbRef.once("value");
  const data = snapshot.val();
  if (!data) return;

  // 2. Read current spaceProgress from Firestore
  const progressId = `${userId}_${spaceId}`;
  const progressRef = db.doc(`tenants/${tenantId}/spaceProgress/${progressId}`);
  const progressDoc = await progressRef.get();

  // 3. Merge RTDB progress into Firestore progress
  const existingItems = progressDoc.exists ? progressDoc.data()!.items : {};
  const mergedItems = { ...existingItems };

  for (const [itemId, rtdbItem] of Object.entries(data.items || {})) {
    const existing = mergedItems[itemId];
    // Keep best score
    mergedItems[itemId] = {
      itemId,
      itemType: "question",
      completed: rtdbItem.s === "c",
      lastUpdatedAt: rtdbItem.t,
      questionData: {
        status: rtdbItem.s === "c" ? "correct" : "incorrect",
        attemptsCount: rtdbItem.a,
        bestScore: Math.max(
          rtdbItem.b || 0,
          existing?.questionData?.bestScore || 0
        ),
        pointsEarned: rtdbItem.b || 0,
        totalPoints: 100,
        percentage: (rtdbItem.b || 0) / 100,
        solved: rtdbItem.s === "c",
      },
    };
  }

  // 4. Recompute aggregates
  const totalItems = Object.keys(mergedItems).length;
  const completedItems = Object.values(mergedItems).filter(
    (i) => i.completed
  ).length;

  // 5. Write to Firestore
  await progressRef.set(
    {
      id: progressId,
      userId,
      tenantId,
      spaceId,
      status: completedItems === totalItems ? "completed" : "in_progress",
      pointsEarned: data.stats?.pointsEarned || 0,
      totalPoints: data.stats?.totalItems ? data.stats.totalItems * 100 : 0,
      percentage: totalItems > 0 ? completedItems / totalItems : 0,
      items: mergedItems,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  // 6. Mark RTDB entries as flushed (update lastFlushedAt)
  await rtdbRef.child("meta/lastFlushedAt").set(Date.now());
}
```

---

## 9. Interactive Quizzes

### 9.1 Overview

Interactive quizzes are short, graded assessments with immediate per-question
feedback. Differences from timed tests:

| Aspect              | Timed Test                    | Interactive Quiz               |
| ------------------- | ----------------------------- | ------------------------------ |
| Timer               | Required, server-enforced     | Optional                       |
| Feedback            | After full submission only    | After each question            |
| Navigation          | Free (jump to any question)   | Sequential (next after answer) |
| Answer key security | Server-only                   | Revealed after each attempt    |
| Evaluation          | Batch (all at once on submit) | Per-question as answered       |

### 9.2 Quiz Flow

```
1. Student opens quiz storyPoint → landing page
2. Click "Start Quiz" → Create DigitalTestSession (sessionType='quiz')
3. Display first question
4. Student answers → immediately evaluate (auto or AI)
5. Show feedback (correct/incorrect, explanation, points)
6. "Next" button → next question
7. After last question → show quiz summary
8. Session status → 'completed'
9. Update spaceProgress
```

### 9.3 Multi-Attempt Support

```typescript
// Check if student can start a new attempt
function canStartNewAttempt(
  sessions: DigitalTestSession[],
  maxAttempts: number
): boolean {
  if (maxAttempts === 0) return true; // Unlimited
  const completedAttempts = sessions.filter(
    (s) => s.status === "completed" || s.status === "expired"
  ).length;
  return completedAttempts < maxAttempts;
}

// Attempt numbering
function getNextAttemptNumber(sessions: DigitalTestSession[]): number {
  return sessions.length + 1;
}
```

---

## 10. AI Tutor Chat

### 10.1 Architecture

```
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐
│ Student Web   │────▶│ Cloud Function  │────▶│ LLMWrapper       │
│ Chat Panel    │     │ sendChatMessage │     │ (Gemini 2.5      │
│               │◀────│                │◀────│  Flash Lite)     │
│ • Messages    │     │ • Rate limit   │     │                  │
│ • Input       │     │ • Build prompt │     │ • Cost tracking  │
│ • Agent pick  │     │ • Save to FS   │     │ • Token logging  │
└──────────────┘     └────────────────┘     └──────────────────┘
```

### 10.2 Context Building

The chat context is built server-side per the design decision (current item
context only):

```typescript
function buildChatContext(
  agent: Agent,
  item: UnifiedItem,
  studentAnswer?: any,
  evaluationResult?: UnifiedEvaluationResult,
  language: string = "english"
): string {
  return `
${agent.systemPrompt || agent.identity}

CONTEXT:
You are helping a student with the following question.
Respond in ${language}.

QUESTION:
${item.payload.content}
${item.payload.questionType ? `Type: ${item.payload.questionType}` : ""}

${studentAnswer ? `STUDENT'S ANSWER:\n${JSON.stringify(studentAnswer)}` : ""}

${
  evaluationResult
    ? `
EVALUATION RESULT:
Score: ${evaluationResult.score}/${evaluationResult.maxScore}
Feedback: ${evaluationResult.strengths?.join(", ")}
Weaknesses: ${evaluationResult.weaknesses?.join(", ")}
`
    : ""
}

RULES:
- Do NOT give the direct answer. Guide the student.
- Use the Socratic method — ask leading questions.
- If the student is stuck, give hints, not answers.
- Be encouraging and supportive.
`.trim();
}
```

### 10.3 Cloud Function: sendChatMessage

```typescript
// Callable Cloud Function
async function sendChatMessage(data: {
  tenantId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  sessionId?: string; // Existing session or null to create new
  message: string;
  language?: string;
  agentId?: string;
}): Promise<{ sessionId: string; reply: string }> {
  // 1. Rate limit: 10 messages/min per user
  await enforceRateLimit(data.tenantId, context.auth.uid, "chat", 10);

  // 2. Load agent (resolve: explicit > space default > platform default)
  const agent = await resolveAgent(data);

  // 3. Load item
  const item = await loadItem(data.tenantId, data.spaceId, data.itemId);

  // 4. Load or create session
  let session: ChatSession;
  if (data.sessionId) {
    session = await loadSession(data.tenantId, data.sessionId);
  } else {
    session = await createSession(data);
  }

  // 5. Build prompt with item context
  const systemPrompt = buildChatContext(agent, item, null, null, data.language);

  // 6. Prepare messages for LLM
  const llmMessages = [
    { role: "system", content: systemPrompt },
    ...session.messages.map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: data.message },
  ];

  // 7. Call LLM via LLMWrapper
  const reply = await LLMWrapper.chat({
    tenantId: data.tenantId,
    model: agent.modelOverride || "gemini-2.5-flash-lite",
    messages: llmMessages,
    temperature: agent.temperatureOverride ?? 0.7,
    taskType: "tutor_chat",
    resourceId: data.itemId,
  });

  // 8. Save messages to session
  await appendMessages(data.tenantId, session.id, [
    { role: "user", text: data.message, timestamp: new Date().toISOString() },
    {
      role: "assistant",
      text: reply.text,
      timestamp: new Date().toISOString(),
      tokensUsed: reply.usage,
    },
  ]);

  return { sessionId: session.id, reply: reply.text };
}
```

### 10.4 Agent Resolution Chain

```
1. Explicit agentId passed in request → use that agent
2. Item.meta.evaluatorAgentId → use (only for evaluator, not tutor)
3. Space.defaultTutorAgentId → use
4. Platform default tutor → built-in system prompt
```

---

## 11. AI Answer Evaluation

### 11.1 Architecture

```
Student submits answer
  │
  ├── Auto-evaluatable? ───Yes──▶ Client-side evaluation (instant)
  │   (MCQ, MCAQ, true-false,          │
  │    numerical, fill-blanks,          ├── Return result
  │    fill-blanks-dd, matching,        └── No server call needed
  │    jumbled, group-options)
  │
  └── AI-evaluatable? ───Yes──▶ Cloud Function: evaluateAnswer()
      (text, paragraph, code,           │
       audio, image_evaluation,         ├── Resolve evaluator agent
       chat_agent_question)             ├── Build evaluation prompt
                                        ├── Call LLMWrapper (Gemini 2.5 Flash Lite)
                                        ├── Parse structured response
                                        ├── Return UnifiedEvaluationResult
                                        └── Log to llmCallLogs
```

### 11.2 Cloud Function: evaluateAnswer

```typescript
async function evaluateAnswer(data: {
  tenantId: string;
  spaceId: string;
  itemId: string;
  answer: any; // Student's answer
  mediaUrls?: string[]; // For audio/image types
}): Promise<UnifiedEvaluationResult> {
  // 1. Rate limit: 5 evaluations/min per user
  await enforceRateLimit(data.tenantId, context.auth.uid, "evaluation", 5);

  // 2. Load item (server-side, with answer key access)
  const item = await loadItemWithAnswerKey(
    data.tenantId,
    data.spaceId,
    data.itemId
  );

  // 3. Resolve evaluator agent
  const agent = await resolveEvaluatorAgent(data.tenantId, data.spaceId, item);

  // 4. Resolve rubric (inheritance chain)
  const rubric = await resolveRubric(data.tenantId, data.spaceId, item);

  // 5. Build evaluation prompt based on question type
  const prompt = buildEvaluationPrompt(
    item,
    data.answer,
    rubric,
    agent,
    data.mediaUrls
  );

  // 6. Call LLM
  const response = await LLMWrapper.generate({
    tenantId: data.tenantId,
    model: agent?.modelOverride || "gemini-2.5-flash-lite",
    prompt,
    temperature: agent?.temperatureOverride ?? 0.3, // Low temp for evaluation
    responseFormat: "json",
    taskType: "answer_evaluation",
    resourceId: data.itemId,
  });

  // 7. Parse and normalize to UnifiedEvaluationResult
  const result = parseEvaluationResponse(response, item);

  return result;
}
```

### 11.3 UnifiedEvaluationResult

```typescript
interface UnifiedEvaluationResult {
  score: number; // Points/marks awarded
  maxScore: number;
  correctness: number; // 0-1 normalized
  percentage: number; // 0-100

  // Structured feedback
  structuredFeedback?: Record<string, FeedbackItem[]>;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];

  // Rubric breakdown (if rubric was applied)
  rubricBreakdown?: Array<{
    criterionId: string;
    criterionName: string;
    score: number;
    maxScore: number;
    feedback: string;
  }>;

  // Summary
  summary?: {
    keyTakeaway: string;
    overallComment: string;
  };

  // Quality metrics
  confidence: number; // 0-1
  mistakeClassification?:
    | "Conceptual"
    | "Silly Error"
    | "Knowledge Gap"
    | "None";

  // Cost tracking
  tokensUsed?: { input: number; output: number };
  costUsd?: number;
  gradedAt: Timestamp;
}
```

### 11.4 Evaluator Agent Resolution

```
1. Item.meta.evaluatorAgentId → use that specific agent
2. StoryPoint has no agent config (inherit up)
3. Space.defaultEvaluatorAgentId → use
4. No agent → use platform default evaluation prompt (no custom persona)
```

---

## 12. UnifiedRubric System

### 12.1 Four Scoring Modes

| Mode              | Use Case                         | Scoring Method                               |
| ----------------- | -------------------------------- | -------------------------------------------- |
| `criteria_based`  | Traditional rubric with criteria | Sum of criterion scores                      |
| `dimension_based` | RELMS-style feedback dimensions  | Weighted dimension scores                    |
| `holistic`        | Single overall score             | One score based on holistic guidance         |
| `hybrid`          | Criteria + dimensions combined   | Criteria for marks + dimensions for feedback |

### 12.2 Inheritance Chain (Full Override)

```
Tenant default rubric (evaluationSettings)
  └── Space.defaultRubric (overrides tenant)
      └── StoryPoint.defaultRubric (overrides space)
          └── Item.rubric (overrides storyPoint)
```

Resolution algorithm:

```typescript
async function resolveRubric(
  tenantId: string,
  spaceId: string,
  item: UnifiedItem
): Promise<UnifiedRubric | null> {
  // Walk up the chain, return first non-null
  if (item.rubric) return item.rubric;

  const storyPoint = await loadStoryPoint(tenantId, spaceId, item.storyPointId);
  if (storyPoint?.defaultRubric) return storyPoint.defaultRubric;

  const space = await loadSpace(tenantId, spaceId);
  if (space?.defaultRubric) return space.defaultRubric;

  const tenant = await loadTenant(tenantId);
  const tenantSettings = await loadEvaluationSettings(
    tenantId,
    tenant.settings?.defaultEvaluationSettingsId
  );
  return tenantSettings?.defaultRubric ?? null;
}
```

### 12.3 Rubric Integration with AI Evaluation

When a rubric is resolved, it is injected into the evaluation prompt:

```typescript
function injectRubricIntoPrompt(
  rubric: UnifiedRubric,
  basePrompt: string
): string {
  if (rubric.scoringMode === "criteria_based" && rubric.criteria) {
    const criteriaText = rubric.criteria
      .map((c) => `- ${c.name} (${c.maxPoints} pts): ${c.description || ""}`)
      .join("\n");
    return `${basePrompt}\n\nGRADING RUBRIC:\n${criteriaText}\n\nScore each criterion separately.`;
  }

  if (rubric.scoringMode === "dimension_based" && rubric.dimensions) {
    const dimText = rubric.dimensions
      .map(
        (d) =>
          `- ${d.name} (weight: ${d.weight}, scale: 1-${d.scoringScale}): ${d.description || ""}`
      )
      .join("\n");
    return `${basePrompt}\n\nEVALUATION DIMENSIONS:\n${dimText}\n\nRate each dimension on its scale.`;
  }

  if (rubric.scoringMode === "holistic") {
    return `${basePrompt}\n\nHOLISTIC EVALUATION:\n${rubric.holisticGuidance}\nMax score: ${rubric.holisticMaxScore}`;
  }

  // hybrid: include both criteria and dimensions
  return basePrompt;
}
```

---

## 13. Answer Key Security

### 13.1 Security Model

| Mode                 | Answer Key Location                                                              | Client Access                                       |
| -------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Timed Test**       | Server-only subcollection: `/spaces/{spaceId}/items/{itemId}/answerKeys/{keyId}` | DENIED — Cloud Function evaluates server-side       |
| **Practice**         | Directly in `item.payload.questionData`                                          | ALLOWED — immediate feedback requires client access |
| **Interactive Quiz** | In `item.payload.questionData`                                                   | ALLOWED after submission — revealed per question    |

### 13.2 Implementation

**Answer Key Subcollection:**

```typescript
// Path: /tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/answerKeys/{keyId}
interface AnswerKey {
  id: string;
  itemId: string;
  questionType: QuestionType;
  correctAnswer: any; // Type-specific correct answer
  acceptableAnswers?: any[]; // Alternative valid answers
  evaluationGuidance?: string; // AI evaluation guidance
  modelAnswer?: string; // Reference answer for subjective types
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Firestore Security Rules:**

```javascript
match /tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/answerKeys/{keyId} {
  // NEVER readable by students
  allow read: if false;
  // Only writable via Admin SDK (Cloud Functions)
  allow write: if false;
}
```

**When creating a timed_test item:**

Cloud Function `createTimedTestItem`:

1. Write item document to `/spaces/{spaceId}/items/{itemId}` WITHOUT answer key
   data in `questionData`
2. Write answer key to `/spaces/{spaceId}/items/{itemId}/answerKeys/{auto-id}`
3. Client receives item without correct answers

**When creating a practice item:**

Cloud Function `createPracticeItem`:

1. Write item document WITH full `questionData` including correct answers
2. No separate answerKey document needed
3. Firestore rules allow student read for practice storyPoints

### 13.3 Answer Key Read for Teacher Editing

Teachers need to see answer keys in the editor:

```typescript
// Cloud Function: getItemWithAnswerKey (callable, teacher-only)
async function getItemWithAnswerKey(
  tenantId: string,
  spaceId: string,
  itemId: string
) {
  // Verify caller is teacher with canManageContent permission
  const item = await loadItem(tenantId, spaceId, itemId);
  const answerKeys = await loadAnswerKeys(tenantId, spaceId, itemId);

  // Merge answer key back into questionData for editor display
  return {
    ...item,
    payload: {
      ...item.payload,
      questionData: mergeAnswerKey(item, answerKeys),
    },
  };
}
```

### 13.4 Post-Test Answer Reveal

After a timed test is submitted and graded, correct answers may be shown based
on `space.showCorrectAnswers`:

```typescript
// Cloud Function: getTestResults (includes answers if allowed)
async function getTestResults(tenantId: string, sessionId: string) {
  const session = await loadSession(tenantId, sessionId);
  if (session.status !== "completed") throw new Error("Test not completed");

  const space = await loadSpace(tenantId, session.spaceId);
  const items = await loadItems(
    tenantId,
    session.spaceId,
    session.storyPointId
  );

  if (space.showCorrectAnswers) {
    // Load answer keys and attach to results
    const answerKeys = await loadAllAnswerKeys(
      tenantId,
      session.spaceId,
      items.map((i) => i.id)
    );
    return { session, items, answerKeys }; // Include correct answers
  }

  return { session, items }; // No answer keys
}
```

---

## 14. Cloud Function Specifications

### 14.1 Space Management Functions

| Function       | Trigger  | Auth                       | Description                            |
| -------------- | -------- | -------------------------- | -------------------------------------- |
| `createSpace`  | Callable | Teacher (+canCreateSpaces) | Create space, set as draft             |
| `updateSpace`  | Callable | Teacher (owner/admin)      | Update space settings                  |
| `publishSpace` | Callable | Teacher (owner/admin)      | Validate + publish space               |
| `archiveSpace` | Callable | Teacher (owner/admin)      | Archive space, expire active sessions  |
| `deleteSpace`  | Callable | TenantAdmin only           | Soft-delete space + all subcollections |

### 14.2 Content Management Functions

| Function               | Trigger  | Auth                  | Description                                   |
| ---------------------- | -------- | --------------------- | --------------------------------------------- |
| `createStoryPoint`     | Callable | Teacher (space admin) | Create story point                            |
| `updateStoryPoint`     | Callable | Teacher (space admin) | Update story point                            |
| `reorderStoryPoints`   | Callable | Teacher (space admin) | Batch update orderIndex                       |
| `deleteStoryPoint`     | Callable | Teacher (space admin) | Delete SP + cascade items                     |
| `createItem`           | Callable | Teacher (space admin) | Create item (split answer key for timed test) |
| `updateItem`           | Callable | Teacher (space admin) | Update item + answer key                      |
| `deleteItem`           | Callable | Teacher (space admin) | Soft-delete item                              |
| `reorderItems`         | Callable | Teacher (space admin) | Batch update orderIndex                       |
| `getItemWithAnswerKey` | Callable | Teacher (space admin) | Load item + answer key for editor             |

### 14.3 Assessment Functions

| Function                        | Trigger           | Auth              | Description                               |
| ------------------------------- | ----------------- | ----------------- | ----------------------------------------- |
| `startTimedTest`                | Callable          | Student           | Create test session, set server timestamp |
| `submitTimedTest`               | Callable          | Student           | Validate timing, grade, compute scores    |
| `startQuiz`                     | Callable          | Student           | Create quiz session                       |
| `evaluateAnswer`                | Callable          | Student           | AI evaluate a single answer               |
| `recordItemAttempt`             | Callable          | Student           | Record attempt for non-test items         |
| `flushPracticeProgress`         | Callable/HTTP     | Student/Scheduler | Flush RTDB → Firestore                    |
| `cleanupStaleTimedTestSessions` | Scheduled (30min) | System            | Expire abandoned sessions                 |
| `flushStalePracticeProgress`    | Scheduled (10min) | System            | Flush stale RTDB practice data            |

### 14.4 AI Functions

| Function          | Trigger  | Auth                          | Description                                |
| ----------------- | -------- | ----------------------------- | ------------------------------------------ |
| `sendChatMessage` | Callable | Student                       | AI tutor chat (rate limited: 10/min)       |
| `evaluateAnswer`  | Callable | Student                       | AI answer evaluation (rate limited: 5/min) |
| `createAgent`     | Callable | Teacher (+canConfigureAgents) | Create evaluator/tutor agent               |
| `updateAgent`     | Callable | Teacher (+canConfigureAgents) | Update agent config                        |
| `deleteAgent`     | Callable | Teacher (+canConfigureAgents) | Delete agent                               |

### 14.5 Progress Functions

| Function               | Trigger           | Auth   | Description                                    |
| ---------------------- | ----------------- | ------ | ---------------------------------------------- |
| `onSpaceProgressWrite` | Firestore trigger | System | Update space stats, leaderboard                |
| `updateLeaderboard`    | Internal          | System | Atomic RTDB leaderboard update                 |
| `computeTestAnalytics` | Internal          | System | Compute dimensional analytics for test results |

---

## 15. Firestore & RTDB Schema Design

### 15.1 Firestore Collections

```
/tenants/{tenantId}/
  ├── spaces/{spaceId}                   ← Space entity
  │   ├── storyPoints/{storyPointId}     ← StoryPoint entity
  │   ├── items/{itemId}                 ← UnifiedItem entity
  │   │   └── answerKeys/{keyId}         ← Server-only answer keys (timed tests)
  │   └── agents/{agentId}              ← AI agent config
  │
  ├── digitalTestSessions/{sessionId}    ← Test/quiz session tracking
  ├── spaceProgress/{userId}_{spaceId}   ← Space completion data
  ├── practiceProgress/{userId}_{spaceId} ← Flushed practice data
  └── chatSessions/{sessionId}           ← AI tutor conversations
```

### 15.2 Composite Indexes

| Collection            | Fields                                            | Purpose                     |
| --------------------- | ------------------------------------------------- | --------------------------- |
| `spaces`              | `classIds CONTAINS, status ASC, createdAt DESC`   | Spaces for a class          |
| `spaces`              | `teacherIds CONTAINS, status ASC`                 | Spaces managed by a teacher |
| `spaces`              | `tenantId ASC, status ASC, type ASC`              | Filter spaces by type       |
| `storyPoints`         | `spaceId ASC, orderIndex ASC`                     | Ordered story points        |
| `items`               | `storyPointId ASC, sectionId ASC, orderIndex ASC` | Ordered items per section   |
| `items`               | `spaceId ASC, type ASC`                           | Items by type in space      |
| `digitalTestSessions` | `userId ASC, storyPointId ASC, isLatest ASC`      | Latest test attempt         |
| `digitalTestSessions` | `userId ASC, spaceId ASC, status ASC`             | Active sessions per space   |
| `spaceProgress`       | `userId ASC, status ASC`                          | Student's space progress    |
| `chatSessions`        | `userId ASC, itemId ASC, updatedAt DESC`          | User's chats per item       |

### 15.3 RTDB Paths

```
practiceProgress/
  {tenantId}/
    {userId}/
      {spaceId}/
        items/
          {itemId}/
            s: string      // status
            t: number       // timestamp
            a: number       // attempts
            b: number       // best score
        stats/
          itemsCompleted: number
          totalItems: number
          pointsEarned: number
          lastActiveAt: number
        meta/
          lastFlushedAt: number

leaderboards/
  {tenantId}/
    {spaceId}/
      {userId}/
        points: number
        displayName: string
        avatarUrl: string
        completionPercent: number
        updatedAt: number
```

### 15.4 RTDB Security Rules

Per blueprint §3.2:

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

### 15.5 Firestore Security Rules (LevelUp subset)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuth() { return request.auth != null; }
    function isTenantMember(tenantId) { return isAuth() && request.auth.token.tenantId == tenantId; }
    function isTeacher(tenantId) { return isTenantMember(tenantId) && request.auth.token.role == 'teacher'; }
    function isStudent(tenantId) { return isTenantMember(tenantId) && request.auth.token.role == 'student'; }
    function isTenantAdmin(tenantId) { return isTenantMember(tenantId) && request.auth.token.role == 'tenantAdmin'; }
    function isOwnerOrAdmin(tenantId) { return isTenantAdmin(tenantId) || isSuperAdmin(); }
    function isSuperAdmin() { return isAuth() && request.auth.token.role == 'superAdmin'; }

    // Spaces
    match /tenants/{tenantId}/spaces/{spaceId} {
      allow read: if isTenantMember(tenantId);
      allow create: if isTeacher(tenantId) || isTenantAdmin(tenantId);
      allow update: if isTeacher(tenantId) || isTenantAdmin(tenantId);
      allow delete: if isTenantAdmin(tenantId);

      // StoryPoints
      match /storyPoints/{spId} {
        allow read: if isTenantMember(tenantId);
        allow write: if isTeacher(tenantId) || isTenantAdmin(tenantId);
      }

      // Items
      match /items/{itemId} {
        allow read: if isTenantMember(tenantId);
        allow write: if isTeacher(tenantId) || isTenantAdmin(tenantId);

        // Answer Keys — NEVER readable by client
        match /answerKeys/{keyId} {
          allow read: if false;
          allow write: if false;
          // Only accessible via Admin SDK in Cloud Functions
        }
      }

      // Agents
      match /agents/{agentId} {
        allow read: if isTenantMember(tenantId);
        allow write: if isTeacher(tenantId) || isTenantAdmin(tenantId);
      }
    }

    // Digital Test Sessions
    match /tenants/{tenantId}/digitalTestSessions/{sessionId} {
      allow read: if isAuth() && (
        resource.data.userId == request.auth.uid  // Own sessions
        || isTeacher(tenantId)                     // Teacher can view
        || isTenantAdmin(tenantId)
      );
      // Write via Cloud Functions only (Admin SDK)
      allow write: if false;
    }

    // Space Progress
    match /tenants/{tenantId}/spaceProgress/{progressId} {
      allow read: if isAuth() && (
        progressId.matches(request.auth.uid + '_.*')  // Own progress
        || isTeacher(tenantId)
        || isTenantAdmin(tenantId)
      );
      // Write via Cloud Functions only
      allow write: if false;
    }

    // Chat Sessions
    match /tenants/{tenantId}/chatSessions/{sessionId} {
      allow read: if isAuth() && resource.data.userId == request.auth.uid;
      // Write via Cloud Functions only
      allow write: if false;
    }
  }
}
```

---

## 16. Migration Plan

### 16.1 Source → Target Mapping

| Source (LevelUp)               | Target (Unified)                                          | Notes                                                    |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------- |
| `/courses/{courseId}`          | `/tenants/{tenantId}/spaces/{spaceId}`                    | Map `courseId` → `spaceId`, `orgId` → `tenantId`         |
| `/storyPoints/{spId}`          | `/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}` | Nest under space                                         |
| `/items/{itemId}`              | `/tenants/{tenantId}/spaces/{spaceId}/items/{itemId}`     | Nest under space, split answer keys for timed test items |
| `/course_agents/{agentId}`     | `/tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}`   | Nest under space                                         |
| `/userStoryPointProgress/{id}` | `/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}`    | Flatten and re-aggregate                                 |
| `/timedTestSessions/{id}`      | `/tenants/{tenantId}/digitalTestSessions/{id}`            | Add tenantId, map courseId → spaceId                     |
| `/chatSessions/{id}`           | `/tenants/{tenantId}/chatSessions/{id}`                   | Add tenantId, map courseId → spaceId                     |
| RTDB `userCourseProgress/`     | RTDB `practiceProgress/{tenantId}/`                       | Re-scope under tenant                                    |
| RTDB leaderboards              | RTDB `leaderboards/{tenantId}/`                           | Re-scope under tenant                                    |
| `/practiceRangeItems/`         | `/tenants/{tenantId}/spaces/{spaceId}/items/`             | Merge into unified items                                 |

### 16.2 Field Mapping: Course → Space

```typescript
function migrateCoursToSpace(
  course: CourseDTO,
  tenantId: string
): Partial<Space> {
  return {
    tenantId,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    slug: course.slug,
    type: course.type === "practice_range" ? "practice" : "learning",
    classIds: [], // Must be assigned post-migration
    teacherIds: [course.ownerUid, ...(course.adminUids || [])],
    accessType: course.orgId ? "class_assigned" : "public_store",
    labels: course.labels,
    defaultEvaluatorAgentId: course.defaultEvaluatorAgentId,
    status: "published", // Existing courses are live
    publishedAt: Timestamp.fromMillis(course.createdAt),
    createdBy: course.ownerUid,
    createdAt: Timestamp.fromMillis(course.createdAt),
    updatedAt: Timestamp.fromMillis(course.updatedAt),
  };
}
```

### 16.3 Field Mapping: StoryPoint → StoryPoint

```typescript
function migrateStoryPoint(
  sp: StoryPointDTO,
  spaceId: string,
  tenantId: string
): Partial<StoryPoint> {
  return {
    spaceId,
    tenantId,
    title: sp.title,
    description: sp.description,
    orderIndex: sp.orderIndex,
    type: mapStoryPointType(sp.type),
    sections: sp.sections || [],
    assessmentConfig:
      sp.type === "timed_test" || sp.type === "test"
        ? {
            durationMinutes: sp.testDurationMinutes || sp.durationMinutes,
            instructions: sp.testInstructions || sp.content,
            maxAttempts: 0, // Default unlimited
            shuffleQuestions: false,
          }
        : undefined,
    difficulty: sp.difficulty,
    createdAt: Timestamp.fromMillis(sp.createdAt),
    updatedAt: Timestamp.fromMillis(sp.updatedAt),
  };
}

function mapStoryPointType(type?: string): StoryPointType {
  switch (type) {
    case "timed_test":
      return "timed_test";
    case "test":
      return "timed_test"; // Alias
    case "practice":
      return "practice";
    default:
      return "standard";
  }
}
```

### 16.4 Migration Execution

```
Phase A: Read from old, write to both (dual-write)
  Per tenant (identified by orgId in courses):

  Step 1: Migrate courses → spaces
    - Query: courses WHERE orgId = {migrated-orgId}
    - For each course:
      a. Create space document under /tenants/{tenantId}/spaces/
      b. Store ID mapping: courseId → spaceId

  Step 2: Migrate storyPoints → storyPoints (nested)
    - Query: storyPoints WHERE courseId IN {migrated-courseIds}
    - For each storyPoint:
      a. Create under /tenants/{tenantId}/spaces/{spaceId}/storyPoints/
      b. Store ID mapping

  Step 3: Migrate items → items (nested)
    - Query: items WHERE courseId IN {migrated-courseIds}
    - For each item:
      a. Create under /tenants/{tenantId}/spaces/{spaceId}/items/
      b. For timed_test items: extract answer key → create answerKeys subcollection doc
      c. Map courseId → spaceId, storyPointId maintained

  Step 4: Migrate agents → agents (nested)
    - Query: course_agents WHERE courseId IN {migrated-courseIds}
    - For each agent:
      a. Create under /tenants/{tenantId}/spaces/{spaceId}/agents/

  Step 5: Migrate progress data
    - Query: userStoryPointProgress for migrated storyPoints
    - Aggregate into spaceProgress documents per user per space

  Step 6: Migrate test sessions
    - Query: timedTestSessions WHERE courseId IN {migrated-courseIds}
    - Create digitalTestSessions under tenant

  Step 7: Migrate chat sessions
    - Query: chatSessions WHERE courseId IN {migrated-courseIds}
    - Create under tenant, map courseId → spaceId

  Step 8: Migrate RTDB data
    - Copy userCourseProgress → tenant-scoped paths
    - Copy leaderboards → tenant-scoped paths
    - Copy practice progress → tenant-scoped paths

Phase B: Read from new, write to both (2 weeks)
Phase C: Delete old collections (after verification)
```

### 16.5 Consumer/Public Course Migration

Courses with `orgId === null` (consumer courses):

- Migrate to `/tenants/platform_public/spaces/`
- Update user `consumerProfile.enrolledSpaceIds` with new space IDs
- Consumer access via Firestore rules on `platform_public` tenant

### 16.6 Verification Script

```typescript
async function verifyMigration(
  tenantId: string,
  courseId: string,
  spaceId: string
) {
  // 1. Count comparison
  const oldSPCount = await countDocs("storyPoints", "courseId", courseId);
  const newSPCount = await countDocs(
    `tenants/${tenantId}/spaces/${spaceId}/storyPoints`
  );
  assert(
    oldSPCount === newSPCount,
    `StoryPoint count mismatch: ${oldSPCount} vs ${newSPCount}`
  );

  const oldItemCount = await countDocs("items", "courseId", courseId);
  const newItemCount = await countDocs(
    `tenants/${tenantId}/spaces/${spaceId}/items`
  );
  assert(
    oldItemCount === newItemCount,
    `Item count mismatch: ${oldItemCount} vs ${newItemCount}`
  );

  // 2. Sample comparison (100 random items)
  const samples = await sampleDocs("items", "courseId", courseId, 100);
  for (const sample of samples) {
    const newItem = await getDoc(
      `tenants/${tenantId}/spaces/${spaceId}/items/${sample.id}`
    );
    assertFieldsMatch(sample, newItem, [
      "title",
      "type",
      "payload.questionType",
      "payload.content",
    ]);
  }

  // 3. Progress verification
  // Verify that progress totals match after aggregation

  return { status: "pass", tenantId, spaceId };
}
```

---

## 17. Testing Strategy

### 17.1 Unit Tests (Vitest)

| Module                         | Tests                                                                     |
| ------------------------------ | ------------------------------------------------------------------------- |
| Rubric resolution              | Test inheritance chain: item > storyPoint > space > tenant                |
| Question status calculation    | Test all 5 status combinations                                            |
| Timer validation               | Test grace period, edge cases                                             |
| Answer evaluation (auto types) | MCQ, true-false, numerical, fill-blanks, matching, jumbled, group-options |
| Progress aggregation           | Test score rollup from items → storyPoint → space                         |
| Migration field mapping        | Test Course→Space, StoryPoint, Item mappings                              |

### 17.2 Firestore Rule Tests (@firebase/rules-unit-testing)

| Test                             | Description                                           |
| -------------------------------- | ----------------------------------------------------- |
| Answer key denied                | Students cannot read answerKeys subcollection         |
| Space read by class member       | Student in assigned class can read published space    |
| Space read denied for non-member | Student not in class cannot read class_assigned space |
| Test session own-only read       | Student can only read their own test sessions         |
| Teacher can read any progress    | Teacher with class access can read student progress   |
| Progress write denied            | Students cannot write spaceProgress directly          |

### 17.3 Cloud Function Integration Tests (Firebase Emulator)

| Test                             | Description                                           |
| -------------------------------- | ----------------------------------------------------- |
| publishSpace validation          | Reject publish with no story points or items          |
| startTimedTest                   | Creates session with server timestamp, correct fields |
| submitTimedTest within time      | Accepts submission, grades, updates progress          |
| submitTimedTest past deadline    | Rejects submission after grace period                 |
| evaluateAnswer MCQ               | Returns correct evaluation for auto-evaluated type    |
| evaluateAnswer paragraph         | Calls LLM, returns structured evaluation              |
| sendChatMessage                  | Creates session, calls LLM, saves messages            |
| flushPracticeProgress            | RTDB data correctly flushed to Firestore              |
| cleanupStaleTimedTestSessions    | Expires abandoned sessions                            |
| createItem with answer key split | Timed test items split answer key into subcollection  |

### 17.4 E2E Tests (Playwright)

| Journey                       | Steps                                                                       |
| ----------------------------- | --------------------------------------------------------------------------- |
| Teacher creates space         | Login → create space → add story point → add items → publish                |
| Student takes timed test      | Login → open space → start test → answer questions → submit → view results  |
| Student uses practice mode    | Login → open practice SP → answer questions → see feedback → check progress |
| Student uses AI tutor         | Login → open question → open chat → send message → receive response         |
| Teacher edits published space | Login → open published space → add item → verify student sees it            |

### 17.5 Migration Tests

| Test                      | Description                                      |
| ------------------------- | ------------------------------------------------ |
| Course → Space mapping    | Verify all fields mapped correctly               |
| Item answer key split     | Verify timed_test items have separate answerKeys |
| Progress aggregation      | Verify migrated progress totals match original   |
| RTDB path migration       | Verify RTDB data at new tenant-scoped paths      |
| Consumer course migration | Verify platform_public tenant has correct spaces |

---

## 18. Dependencies on Other Modules

### 18.1 Hard Dependencies (must be complete before LevelUp)

| Module                            | Phase   | What LevelUp Needs                                    |
| --------------------------------- | ------- | ----------------------------------------------------- |
| **Monorepo + Shared Types**       | Phase 0 | TypeScript interfaces, shared services package        |
| **Auth + Identity**               | Phase 1 | Firebase Auth, custom claims, login flows             |
| **Tenant Model**                  | Phase 1 | `/tenants/{tenantId}` CRUD, tenant settings           |
| **User Memberships**              | Phase 1 | Role verification for access control                  |
| **Classes + Students + Teachers** | Phase 2 | Class assignment, student roster, teacher permissions |

### 18.2 Soft Dependencies (can build in parallel, integrate later)

| Module                     | Phase    | Integration Point                                    |
| -------------------------- | -------- | ---------------------------------------------------- |
| **Notifications**          | Phase 2+ | Send notifications on space publish, test completion |
| **Cross-System Analytics** | Phase 5  | SpaceProgress feeds into studentProgressSummaries    |
| **Insight Engine**         | Phase 5  | LevelUp engagement data feeds recommendations        |
| **Cost Tracking**          | Phase 5  | LLM call logs from evaluation + chat                 |
| **Consumer Path**          | Phase 6  | Public space browsing, purchase flow                 |

### 18.3 What LevelUp Provides to Other Modules

| Consumer Module               | What LevelUp Provides                                 |
| ----------------------------- | ----------------------------------------------------- |
| **Cross-System Analytics**    | `spaceProgress` data, test session results            |
| **Insight Engine**            | Topic performance data for weak-topic recommendations |
| **Exam-Space Linkage**        | Space IDs for `Exam.linkedSpaceId`                    |
| **Unified Student Dashboard** | Space progress, leaderboard data                      |
| **Parent Portal**             | Child's space progress (via `spaceProgress`)          |

---

## Appendix A: Evaluation Prompt Templates

### A.1 Paragraph Evaluation Prompt

```
You are an AI evaluator grading a student's written response.

QUESTION:
{question.content}

MODEL ANSWER (reference):
{rubric.modelAnswer || questionData.modelAnswer}

STUDENT'S ANSWER:
{studentAnswer}

{rubricSection}

INSTRUCTIONS:
1. Compare the student's answer against the model answer and rubric.
2. Identify strengths, weaknesses, and missing concepts.
3. Classify any mistakes: Conceptual, Silly Error, Knowledge Gap, or None.
4. Provide a confidence score (0-1) for your evaluation.

Respond in this exact JSON format:
{
  "score": <number>,
  "maxScore": <number>,
  "correctness": <0-1>,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "missingConcepts": ["..."],
  "mistakeClassification": "Conceptual" | "Silly Error" | "Knowledge Gap" | "None",
  "confidence": <0-1>,
  "summary": { "keyTakeaway": "...", "overallComment": "..." },
  "rubricBreakdown": [{ "criterionId": "...", "score": <n>, "maxScore": <n>, "feedback": "..." }]
}
```

### A.2 Image Evaluation Prompt

```
You are evaluating a student's image-based submission.

QUESTION:
{question.content}

EVALUATION CRITERIA:
{questionData.evaluationGuidance}

The student has uploaded {mediaUrls.length} image(s).

{rubricSection}

Evaluate the submission based on the criteria above.
Respond in the standard JSON evaluation format.
```

---

## Appendix B: Error Handling

### B.1 AI Evaluation Failures

| Scenario                      | Handling                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| LLM timeout (>30s)            | Retry once. If still fails, return `{ error: 'evaluation_timeout', message: 'AI evaluation timed out. Try again.' }`          |
| LLM rate limit (429)          | Exponential backoff (5s, 15s, 45s). Return rate limit error to client after 3 retries.                                        |
| Invalid JSON response         | Retry with stricter prompt. If still fails, log to dead letter, return generic evaluation with score=0 and guidance to retry. |
| Budget exceeded               | Return `{ error: 'budget_exceeded', message: 'AI features temporarily unavailable. Contact your school admin.' }`             |
| No evaluator agent configured | Use platform default evaluation prompt.                                                                                       |

### B.2 Timed Test Edge Cases

| Scenario                     | Handling                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Browser crash mid-test       | Session remains `in_progress`. Student can resume from same session on reload (load from Firestore).         |
| Network loss during submit   | Client retries submit. Server is idempotent (checks if already completed).                                   |
| Dual submit (race condition) | Server checks `session.status === 'in_progress'` before grading. Second call gets "already completed" error. |
| Server time drift            | Client syncs with server time offset once on session start. All timer calculations use offset.               |

---

**Document Version:** 1.0 **Date:** 2026-02-19 **Status:** Design Plan — Ready
for Implementation **Author:** LevelUp Engineer
