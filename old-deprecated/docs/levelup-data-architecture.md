# LevelUp App - Data Architecture Documentation

**Generated:** 2026-02-11 **Project:** LevelUp Learning Platform **Version:**
Based on current codebase analysis

---

## Table of Contents

1. [Overview](#overview)
2. [Database Technologies](#database-technologies)
3. [Core Domain Models](#core-domain-models)
4. [Firestore Collections](#firestore-collections)
5. [Realtime Database (RTDB) Structure](#realtime-database-rtdb-structure)
6. [Data Types Reference](#data-types-reference)
7. [Database Access Patterns](#database-access-patterns)

---

## Overview

LevelUp is a learning platform built with Firebase (Firestore + Realtime
Database) backend. The architecture follows a hybrid approach:

- **Firestore**: Primary storage for structured data (courses, items, users,
  progress)
- **RTDB (Realtime Database)**: Real-time data (leaderboards, live progress
  updates, metrics)
- **Firebase Storage**: Media files (images, videos, etc.)
- **Firebase Auth**: User authentication

### Key Architectural Concepts

1. **Space/Course**: Top-level learning container
2. **Story Points**: Chapters/modules within a course
3. **Items**: Flexible content units (questions, materials, assessments, etc.)
4. **Sections**: Optional groupings within story points
5. **Progress Tracking**: Multi-level (course → story point → item)

---

## Database Technologies

### Firebase Firestore (Primary Database)

**Collections:**

- `users` - User profiles
- `courses` - Course/Space definitions
- `storyPoints` - Story points (chapters/modules)
- `items` - Learning content items
- `userStoryPointProgress` - User progress per story point
- `attempts` - Submission attempts
- `progress` - Generic progress tracking
- `chatSessions` - AI chat session history
- `orgs` - Organizations
- `orgGroups` - Organization groups
- `userOrgs` - User-organization relationships
- `userRoles` - User role assignments
- `course_agents` - AI evaluator agents
- `redemption_codes` - Course access codes
- `practiceItems` - Practice range items
- `practiceSubmissions` - Practice submissions
- `timedTestSessions` - Timed test sessions
- `sections` - Legacy sections collection

### Firebase Realtime Database (RTDB)

**Paths:**

- `userCourseProgress/{userId}/{courseId}` - Real-time course progress
- `resumeProgress/{userId}/courses/{courseId}` - Resume tracking
- `storyPointLeaderboard/{storyPointId}` - Story point leaderboards
- `courseLeaderboard/{courseId}` - Course leaderboards
- `metrics/{courseId}/{storyPointId}/{itemId}` - Analytics metrics
- `users/{userId}/practice/{spaceId}` - Practice range progress

---

## Core Domain Models

### User

```typescript
// Location: src/domain/models.ts
export interface User {
  id: UUID;
  email?: string;
  phone?: string;
  fullName: string;
  age?: number;
  grade?: string;
  preferences?: Record<string, unknown>;
  createdAt: TimestampISO;
}

// Firestore implementation: src/services/users/UsersService.ts
export type AppUser = {
  id?: string;
  uid: string; // Firebase Auth UID
  email?: string;
  phone?: string;
  fullName?: string;
  displayName?: string; // Community display name
  photoURL?: string;
  country?: string;
  age?: number;
  grade?: string;
  onboardingCompleted?: boolean;
  roles?: string[]; // Global roles
  createdAt: number;
  updatedAt: number;
};
```

**Storage:** Firestore collection `users` **Document ID:** Firebase Auth UID
**Access Pattern:** Direct lookup by UID

### Space (Course)

```typescript
// Location: src/domain/models.ts
export interface Space {
  id: UUID;
  title: string;
  description: string;
  difficulty?: SpaceDifficulty;
  metadata?: Record<string, unknown>;
  type?: SpaceType; // 'default' | 'practice_range'
}

// Firestore implementation: src/services/courses/CoursesService.ts
export type CourseDTO = {
  id?: string;
  ownerUid: string;
  slug: string; // URL-friendly identifier
  title: string;
  description?: string;
  thumbnailUrl?: string;
  priceCents?: number;
  progressPercent?: number;
  isPublic?: boolean;
  labels?: CourseLabel[]; // 'programming' | 'logic_puzzles' | 'health' | 'math'
  type?: SpaceType; // 'default' | 'practice_range'

  // Organization fields
  orgId?: string;
  orgGroupIds?: string[];
  orgName?: string;
  adminUids?: string[];

  // AI configuration
  defaultEvaluatorAgentId?: string;

  createdAt: number;
  updatedAt: number;
};
```

**Storage:** Firestore collection `courses` **Access Patterns:**

- By ID: `CoursesService.getById(id)`
- By owner: `CoursesService.listByOwner(ownerUid)`
- By organization: `CoursesService.listByOrg(orgId)`
- Public courses: `CoursesService.listPublic()`

### Story Point

```typescript
// Location: src/domain/models.ts
export interface StoryPoint {
  id: UUID;
  spaceId: UUID; // Parent course ID
  title: string;
  description: string;
  orderIndex: number;
  difficulty?: SpaceDifficulty;
  sections?: Array<{
    id: UUID;
    title: string;
    orderIndex: number;
  }>;
}

// Firestore implementation: src/services/storyPoints/StoryPointsService.ts
export type StoryPointDTO = {
  id?: string;
  courseId: string; // Parent course
  title: string;
  description?: string;
  orderIndex: number;
  difficulty?: "easy" | "medium" | "hard";
  type?: StoryPointType; // 'standard' | 'timed_test' | 'practice'
  durationMinutes?: number; // For timed tests
  content?: string; // Instructions/landing page content
  sections?: Array<{ id: string; title: string; orderIndex: number }>;
  createdAt: number;
  updatedAt: number;
};
```

**Storage:** Firestore collection `storyPoints` **Access Patterns:**

- By course: `StoryPointsService.listByCourse(courseId)`
- By ID: `StoryPointsService.getById(id)`
- Real-time subscription:
  `StoryPointsService.subscribeByCourse(courseId, callback)`

### Item (Content Unit)

Items are the core flexible content system in LevelUp. They replace the legacy
question-only model.

```typescript
// Location: src/types/items.ts
export type ItemType =
  | "question" // Learning questions (MCQ, code, etc.)
  | "material" // Reading material, videos
  | "interactive" // Simulations, demos
  | "assessment" // Formal evaluations
  | "discussion" // Discussion prompts
  | "project" // Hands-on projects
  | "checkpoint"; // Progress markers

export interface ItemDTO {
  // Core Identity
  id?: string;
  courseId: string;
  storyPointId: string;
  sectionId?: string; // Optional section grouping

  // Item Type & Content
  type: ItemType;
  title?: string;
  content?: string;
  difficulty?: "easy" | "medium" | "hard";
  topics?: string[]; // Topic tags
  labels?: string[]; // Custom labels

  // Type-specific payload
  payload: ItemPayload; // Varies by item type

  // Metadata
  meta?: ItemMetadata;
  analytics?: ItemAnalytics; // Performance tracking dimensions

  // Ordering
  sect_order_idx?: number; // Per-section order
  orderIndex?: number; // Legacy global order

  // Timestamps
  createdAt: number;
  updatedAt: number;
}
```

**Storage:** Firestore collection `items` **Access Patterns:**

- By story point: `ItemsService.listByStoryPoint(storyPointId)`
- By ID: `ItemsService.getById(id)`
- By course and section: Query with `courseId` and `sectionId`

#### Item Payload Types

##### Question Payload

```typescript
export interface QuestionPayload {
  questionType:
    | "mcq"
    | "mcaq"
    | "true-false"
    | "text"
    | "code"
    | "material"
    | "matching"
    | "fill-blanks"
    | "fill-blanks-dd"
    | "paragraph"
    | "jumbled"
    | "audio"
    | "group-options"
    | "chat_agent_question"
    | "numerical"
    | "image_evaluation";
  title?: string;
  content: string;
  explanation?: string;
  basePoints?: number;
  difficulty?: "easy" | "medium" | "hard";
  questionData: any; // Type-specific data (options, test cases, etc.)
}
```

##### Material Payload

```typescript
export interface MaterialPayload {
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
  prerequisites?: string[];
  content?: string;
  richContent?: {
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
  };
}
```

##### Assessment Payload

```typescript
export interface AssessmentPayload {
  assessmentType: "quiz" | "exam" | "project" | "peer_review";
  timeLimit?: number; // Minutes
  attempts?: number;
  passingScore?: number; // 0-100
  itemReferences?: string[]; // Referenced item IDs
  rubric?: Array<{
    criterion: string;
    maxPoints: number;
    description: string;
  }>;
}
```

---

## Firestore Collections

### Collection: `users`

**Document ID:** Firebase Auth UID **Purpose:** User profile and account
information

```typescript
{
  uid: string;
  email?: string;
  phone?: string;
  fullName?: string;
  displayName?: string;
  photoURL?: string;
  country?: string;
  age?: number;
  grade?: string;
  onboardingCompleted?: boolean;
  roles?: string[];
  createdAt: number;
  updatedAt: number;
}
```

**Indexes:** None (direct lookup by document ID)

### Collection: `courses`

**Document ID:** Auto-generated or prefixed with `course_` **Purpose:**
Course/Space definitions

```typescript
{
  ownerUid: string;
  slug: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  priceCents?: number;
  progressPercent?: number;
  isPublic?: boolean;
  labels?: CourseLabel[];
  type?: 'default' | 'practice_range';
  orgId?: string;
  orgGroupIds?: string[];
  orgName?: string;
  adminUids?: string[];
  defaultEvaluatorAgentId?: string;
  createdAt: number;
  updatedAt: number;
}
```

**Indexes:**

- `ownerUid` (for listing user's courses)
- `isPublic` (for public course discovery)
- `orgId` (for organization courses)

### Collection: `storyPoints`

**Document ID:** Auto-generated **Purpose:** Story points (chapters/modules)
within courses

```typescript
{
  courseId: string;
  title: string;
  description?: string;
  orderIndex: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  type?: 'standard' | 'timed_test' | 'practice';
  durationMinutes?: number;
  content?: string;
  sections?: Array<{
    id: string;
    title: string;
    orderIndex: number;
  }>;
  createdAt: number;
  updatedAt: number;
}
```

**Indexes:**

- `courseId` + `orderIndex` (composite - for ordered listing)

### Collection: `items`

**Document ID:** Auto-generated **Purpose:** Flexible content units (questions,
materials, assessments, etc.)

```typescript
{
  courseId: string;
  storyPointId: string;
  sectionId?: string;
  type: ItemType;
  title?: string;
  content?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  topics?: string[];
  labels?: string[];
  payload: ItemPayload;
  meta?: ItemMetadata;
  analytics?: ItemAnalytics;
  sect_order_idx?: number;
  orderIndex?: number;
  createdAt: number;
  updatedAt: number;
}
```

**Indexes:**

- `storyPointId` + `createdAt` (composite - for ordered listing)
- `courseId` (for course-wide queries)
- `sectionId` (for section queries)

### Collection: `userStoryPointProgress`

**Document ID:** `${userId}_${storyPointId}` **Purpose:** Track user progress
within a story point

```typescript
{
  userId: string;
  courseId: string;
  storyPointId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  pointsEarned: number;
  totalPoints: number;
  percentage: number; // 0-1

  // Items-based progress
  items: Record<string, ItemProgressEntry>; // Keyed by itemId

  updatedAt: number;
  completedAt?: number;
}
```

**ItemProgressEntry Structure:**

```typescript
{
  itemId: string;
  itemType: ItemType;
  completed: boolean;
  completedAt?: number;
  timeSpent?: number; // Seconds
  interactions?: number;
  lastUpdatedAt: number;

  // For question items
  questionData?: {
    questionId: string;
    status: 'pending' | 'correct' | 'incorrect' | 'partial';
    attemptsCount: number;
    bestScore: number;
    pointsEarned: number;
    totalPoints: number;
    percentage: number; // 0-1
    solved: boolean;
    submissions: SubmissionEntry[];
  };

  // For other items
  score?: number; // 0-100
  feedback?: string;
  attachments?: Array<any>;
  posts?: number; // For discussions
}
```

**Indexes:** Document ID is composite key (no additional indexes needed)

### Collection: `attempts`

**Document ID:** Auto-generated **Purpose:** Individual submission attempts for
questions

```typescript
{
  userId: string;
  courseId: string;
  storyPointId: string;
  questionId: string;
  itemId: string;
  questionType: string;
  mode: 'tutorial' | 'challenge' | 'practice' | 'assessment';
  submission: any; // Normalized submission data
  evaluation?: any; // Evaluation results
  correctness: number; // 0-1
  pointsEarned: number;
  totalPoints: number;
  createdAt: number;
}
```

**Indexes:**

- `userId` + `questionId` (for user's attempts on a question)
- `userId` + `storyPointId` (for user's attempts in a story point)

### Collection: `chatSessions`

**Document ID:** Auto-generated **Purpose:** AI chat session history

```typescript
{
  userId: string;
  courseId: string;
  storyPointId: string;
  itemId: string;
  questionType: string;
  sessionTitle: string;
  previewMessage: string;
  messageCount: number;
  language: string;
  isActive: boolean;
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    text: string;
    timestamp: string; // ISO 8601
  }>;
  systemPrompt: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes:**

- `userId` + `itemId` (for user's chats on an item)
- `userId` + `updatedAt` (for recent chats)

### Collection: `orgs`

**Document ID:** Auto-generated **Purpose:** Organization (school/institute)
definitions

```typescript
{
  name: string;
  title?: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  bannerUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  code: string; // Join code
  isPublic?: boolean;
  adminUids: string[];
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
}
```

**Indexes:**

- `ownerUid` (for owner's organizations)
- `adminUids` (array-contains for admin access)
- `code` (for join code lookup)
- `isPublic` (for public org discovery)

### Collection: `userOrgs`

**Document ID:** `${userId}_${orgId}` **Purpose:** User-organization membership
relationships

```typescript
{
  userId: string;
  orgId: string;
  joinedAt: number;
  source: 'code' | 'invite' | 'admin' | 'owner';
  roles?: string[]; // Org-level roles
  orgName: string; // Denormalized
  orgImageUrl?: string; // Denormalized
  isArchived?: boolean;
  archivedAt?: number;
}
```

### Collection: `userRoles`

**Document ID:** User ID **Purpose:** Centralized role management

```typescript
{
  userId: string;
  isSuperAdmin: boolean;
  canCreateOrg?: boolean;

  // Map of orgId -> role details
  orgAdmin: Record<string, {
    orgId: string;
    orgName: string;
    orgImageUrl?: string;
    assignedAt: number;
    assignedBy: string;
  }>;

  // Map of courseId -> role details
  courseAdmin: Record<string, {
    courseId: string;
    courseName: string;
    courseImageUrl?: string;
    orgId?: string;
    assignedAt: number;
    assignedBy: string;
  }>;

  createdAt: number;
  updatedAt: number;
}
```

### Collection: `practiceItems`

**Document ID:** Auto-generated **Purpose:** Practice range items
(LeetCode-style problems)

```typescript
{
  spaceId: string; // Parent practice range space
  type: ItemType;
  payload: ItemPayload;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  tags: string[]; // Topic tags
  pyqInfo?: Array<{
    exam: string;
    year: number;
    session?: string;
  }>;
  acceptanceRate?: number;
  attemptCount?: number;
  createdAt: number;
  updatedAt: number;
}
```

### Collection: `timedTestSessions`

**Document ID:** Auto-generated session ID **Purpose:** Timed test sessions and
submissions

```typescript
{
  userId: string;
  courseId: string;
  storyPointId: string;
  attemptNumber: number;
  status: 'in_progress' | 'completed' | 'expired' | 'abandoned';
  startedAt: number;
  endedAt?: number;
  durationMinutes: number;
  totalQuestions: number;
  answeredQuestions: number;
  pointsEarned?: number;
  totalPoints?: number;
  percentage?: number;
  questionOrder: string[]; // Item IDs in order
  submissions: Record<string, {
    itemId: string;
    questionType: string;
    submittedAt: number;
    timeSpentSeconds: number;
    answer: any;
    evaluation?: any;
    correct: boolean;
    pointsEarned: number;
    totalPoints: number;
    markedForReview?: boolean;
  }>;
  markedForReview: Record<string, boolean>;
  visitedQuestions: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
}
```

---

## Realtime Database (RTDB) Structure

### Path: `userCourseProgress/{userId}/{courseId}`

**Purpose:** Real-time course-level progress aggregation

```typescript
{
  userId: string;
  courseId: string;
  pointsEarned: number;
  totalPoints: number;
  percentage: number; // 0-1
  storyPointsCompleted: number;
  countsByTier?: {
    silver: number;
    gold: number;
    platinum: number;
    diamond: number;
  };
  countsByType?: Record<string, number>;
  storyPoints?: Record<string, any>; // Aggregated story point data
  createdAt: number;
  updatedAt: number;
}
```

**Access Pattern:** Real-time subscription for live progress updates

### Path: `resumeProgress/{userId}/courses/{courseId}`

**Purpose:** Track where user left off in a course

```typescript
{
  lastAccessedAt: number;
  storyPoints: {
    [storyPointId]: {
      lastAccessedAt: number;
      sections?: {
        [sectionId]: {
          lastAccessedAt: number;
          lastItemId?: string;
        }
      }
    }
  }
}
```

**Access Pattern:** Read on course entry, update on navigation

### Path: `storyPointLeaderboard/{storyPointId}`

**Purpose:** Story point leaderboards

```typescript
{
  [userId]: {
    points: number;
    displayName: string;
    avatarUrl?: string;
    completionPercent?: number;
    updatedAt: number;
  }
}
```

**Access Pattern:** Read for leaderboard display, incremental updates on
progress

### Path: `courseLeaderboard/{courseId}`

**Purpose:** Course-wide leaderboards

```typescript
{
  [userId]: {
    points: number;
    displayName: string;
    avatarUrl?: string;
    completionPercent?: number;
    storyPointsCompleted: number;
    updatedAt: number;
  }
}
```

### Path: `users/{userId}/practice/{spaceId}`

**Purpose:** Practice range progress (RTDB for speed)

```typescript
{
  items: {
    [itemId]: {
      s: 'c' | 'i' | 'a' | 'p', // status: correct, incorrect, attempted, pending
      t: number, // completedAt timestamp
      a: number, // attempts count
      b?: number  // bestTime in seconds
    }
  },
  stats: {
    itemsCompleted: number;
    totalItems: number;
    pointsEarned: number;
    lastActiveAt: number;
  }
}
```

**Access Pattern:** Real-time reads for dashboard, incremental updates on
submissions

### Path: `metrics/{courseId}/{storyPointId}/{itemId}`

**Purpose:** Analytics and metrics tracking

```typescript
{
  viewCount: number;
  submissionCount: number;
  averageScore: number;
  averageTimeSeconds: number;
  lastViewAt: number;
  lastSubmissionAt: number;
  updatedAt: number;
}
```

---

## Data Types Reference

### Enums and Constants

```typescript
// Difficulty levels
export enum SpaceDifficulty {
  Easy = "easy",
  Medium = "medium",
  Hard = "hard",
  Expert = "expert",
}

// Item types
export type ItemType =
  | "question"
  | "material"
  | "interactive"
  | "assessment"
  | "discussion"
  | "project"
  | "checkpoint";

// Story point types
export type StoryPointType = "standard" | "timed_test" | "practice";

// Space types
export type SpaceType = "default" | "practice_range";

// Progress statuses
export type ProgressStatus = "not_started" | "in_progress" | "completed";

// Question statuses
export type QuestionStatus = "pending" | "correct" | "incorrect" | "partial";

// Learning modes
export type LearningMode = "tutorial" | "challenge" | "practice" | "assessment";
```

### ItemAnalytics Structure

Comprehensive analytics dimensions for performance tracking:

```typescript
export interface ItemAnalytics {
  // Core classification
  difficulty?: "easy" | "medium" | "hard";
  topics?: string[];
  labels?: string[];

  // Educational taxonomy
  bloomsLevel?:
    | "remember"
    | "understand"
    | "apply"
    | "analyze"
    | "evaluate"
    | "create";
  bloomsSubLevel?: string;
  cognitiveLoad?: "low" | "medium" | "high";

  // Skills & competencies
  skillsAssessed?: string[];
  primarySkill?: string;
  secondarySkills?: string[];

  // Content categorization
  conceptCategory?: string;
  learningObjective?: string;
  applicationDomain?: "theory" | "practical" | "real-world" | "conceptual";

  // Complexity
  questionComplexity?:
    | "single-concept"
    | "multi-concept"
    | "synthesis"
    | "integration";
  prerequisiteTopics?: string[];
  relatedTopics?: string[];

  // Importance
  conceptImportance?:
    | "foundational"
    | "important"
    | "advanced"
    | "optional"
    | "bonus";
  commonMistakes?: string[];
  hintsAvailable?: boolean;

  // Standards alignment
  curriculumStandards?: string[];
  examRelevance?: string[];

  // Custom dimensions
  customDimensions?: Record<string, string | string[] | number>;
}
```

---

## Database Access Patterns

### User Authentication Flow

1. User signs in via Firebase Auth
2. `UsersService.upsert(uid, userData)` creates/updates user profile
3. User profile stored in Firestore `users` collection with UID as document ID

### Course Discovery and Access

**Public Course Listing:**

```typescript
// Query public courses
const courses = await CoursesService.listPublic();
// Firestore query: WHERE isPublic == true
```

**User's Courses:**

```typescript
// Query courses owned by user
const courses = await CoursesService.listByOwner(userId);
// Firestore query: WHERE ownerUid == userId
```

**Organization Courses:**

```typescript
// Query courses in organization
const courses = await CoursesService.listByOrg(orgId);
// Firestore query: WHERE orgId == orgId
```

### Content Loading Flow

**Course → Story Points → Items:**

```typescript
// 1. Load course
const course = await CoursesService.getById(courseId);

// 2. Load story points for course (ordered)
const storyPoints = await StoryPointsService.listByCourse(courseId);
// Firestore query: WHERE courseId == courseId ORDER BY orderIndex

// 3. Load items for a story point
const items = await ItemsService.listByStoryPoint(storyPointId);
// Firestore query: WHERE storyPointId == storyPointId ORDER BY createdAt
```

### Progress Tracking Flow

**Reading Progress:**

```typescript
// 1. Get user's story point progress (Firestore)
const progressDocId = `${userId}_${storyPointId}`;
const progress = await getDoc(doc(db, "userStoryPointProgress", progressDocId));

// 2. Get real-time course progress (RTDB)
const progressRef = ref(rtdb, `userCourseProgress/${userId}/${courseId}`);
const snapshot = await get(progressRef);
```

**Updating Progress on Submission:**

```typescript
// 1. Save attempt to Firestore
await AttemptsService.create({
  userId,
  courseId,
  storyPointId,
  questionId,
  submission,
  evaluation,
  correctness,
  pointsEarned,
  // ...
});

// 2. Update story point progress (Firestore)
await UserStoryPointProgressService.updateOnItemSubmission({
  userId,
  courseId,
  storyPointId,
  itemId,
  itemType: "question",
  correctness,
  pointsEarned,
  totalPoints,
  // ...
});

// 3. Aggregate to course progress (RTDB)
// Cloud function or client-side aggregation updates:
// userCourseProgress/{userId}/{courseId}
// storyPointLeaderboard/{storyPointId}
// courseLeaderboard/{courseId}
```

### Practice Range Access Pattern

**Loading Practice Items:**

```typescript
// Get practice items for a space
const items = await PracticeRangeItemsService.listBySpace(spaceId);
// Firestore query: WHERE spaceId == spaceId
```

**Progress Tracking (RTDB for speed):**

```typescript
// Read user's practice progress from RTDB
const progressRef = ref(rtdb, `users/${userId}/practice/${spaceId}`);
const snapshot = await get(progressRef);

// Progress structure:
{
  items: {
    [itemId]: {
      s: 'c', // status: correct
      t: 1234567890, // timestamp
      a: 3, // attempts
      b: 120 // best time (seconds)
    }
  },
  stats: {
    itemsCompleted: 45,
    totalItems: 100,
    pointsEarned: 450,
    lastActiveAt: 1234567890
  }
}
```

### Timed Test Flow

**Starting a Test:**

```typescript
// 1. Create session
const sessionId = await TimedTestSessionService.create({
  userId,
  courseId,
  storyPointId,
  durationMinutes: 60,
  questionOrder: itemIds,
  // ...
});

// 2. Load items for test
const items = await ItemsService.listByStoryPoint(storyPointId);

// 3. Track session state (Firestore)
// Document: timedTestSessions/{sessionId}
```

**Submitting Answers:**

```typescript
// Update session with submission
await TimedTestSessionService.updateSubmission(sessionId, itemId, {
  submittedAt: Date.now(),
  answer,
  evaluation,
  correct,
  pointsEarned,
  totalPoints,
});
```

**Completing Test:**

```typescript
// Finalize session
await TimedTestSessionService.complete(sessionId);
// Aggregates results, updates status to 'completed'
// Updates user progress in userStoryPointProgress
```

### Leaderboard Access Pattern

**Reading Leaderboards (RTDB):**

```typescript
// Story point leaderboard
const leaderboardRef = ref(rtdb, `storyPointLeaderboard/${storyPointId}`);
const snapshot = await get(leaderboardRef);

// Course leaderboard
const courseLeaderboardRef = ref(rtdb, `courseLeaderboard/${courseId}`);
const snapshot = await get(courseLeaderboardRef);

// Data structure:
{
  [userId]: {
    points: 450,
    displayName: "John Doe",
    avatarUrl: "https://...",
    completionPercent: 0.75,
    updatedAt: 1234567890
  }
}
```

**Updating Leaderboards:**

```typescript
// Typically done via Cloud Functions or client-side after progress update
// Incremental update to avoid full recalculation
const userRef = ref(rtdb, `storyPointLeaderboard/${storyPointId}/${userId}`);
await update(userRef, {
  points: newPoints,
  displayName: user.displayName,
  updatedAt: Date.now(),
});
```

### Organization Management

**Creating Organization:**

```typescript
// 1. Create org document
const orgId = await OrgsService.create({
  name: "Example School",
  slug: "example-school",
  ownerUid: userId,
  // ...
});

// 2. Auto-join creator
await UserOrgsService.join(userId, orgId, "owner");

// 3. Grant org admin role
await UserRolesService.grantOrgAdmin(userId, orgId, {
  orgName: "Example School",
  assignedBy: userId,
});
```

**Joining Organization:**

```typescript
// 1. Find org by code
const org = await OrgsService.getByCode(joinCode);

// 2. Create membership
await UserOrgsService.join(userId, org.id, "code");

// 3. User can now access org courses
const courses = await CoursesService.listByOrg(org.id);
```

### Chat Session Management

**Creating Chat Session:**

```typescript
const sessionId = await ChatSessionService.create({
  userId,
  courseId,
  storyPointId,
  itemId,
  questionType,
  language: "english",
  systemPrompt: "...",
  initialMessage: "Help me with this question",
});
```

**Appending Messages:**

```typescript
await ChatSessionService.appendMessage(sessionId, {
  role: "assistant",
  text: "Sure! Let me help you...",
  timestamp: new Date().toISOString(),
});
```

**Listing User's Sessions:**

```typescript
const sessions = await ChatSessionService.listUserSessions({
  userId,
  itemId,
  limit: 20,
  orderBy: "updatedAt",
  orderDirection: "desc",
});
```

---

## Summary

### Key Design Patterns

1. **Composite Document IDs**: Many progress documents use composite keys like
   `${userId}_${storyPointId}` for deterministic access and avoiding duplicates.

2. **Denormalization**: Frequently accessed data (org names, user display names)
   is denormalized for performance.

3. **Hybrid Storage**: Firestore for structured data, RTDB for real-time and
   frequently updated data (leaderboards, live progress).

4. **Embedded Arrays**: Sections are often embedded in story point documents to
   reduce query complexity.

5. **Flexible Payload System**: Items use a type-discriminated union for
   payload, allowing extensibility without schema changes.

6. **Analytics Dimensions**: Comprehensive analytics metadata enables
   multi-dimensional performance analysis.

### Performance Optimizations

- **RTDB for Leaderboards**: Real-time updates without Firestore query costs
- **Composite Indexes**: Pre-configured for common query patterns
- **Denormalized Counts**: Aggregated statistics stored to avoid repeated
  calculations
- **Real-time Subscriptions**: Used selectively for live updates (course
  progress, leaderboards)

### Scalability Considerations

- **Sharded Leaderboards**: Can be sharded by time period (weekly, monthly,
  all-time)
- **Paginated Queries**: Service methods support limit parameters
- **Cached Aggregations**: Course progress aggregated in RTDB, updated
  incrementally
- **Batch Operations**: Used for bulk item creation and updates

---

**End of Documentation**
