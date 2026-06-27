# Phase 1B: LevelUp Full Feature & Domain Extraction

> **Purpose**: Complete domain audit of the LevelUp QuestForge codebase —
> entities, roles, feature workflows, screens, org/B2B model, integrations, and
> limitations. This document serves as the definitive reference for the unified
> platform design effort.
>
> **Source**: `/Users/subhang/Desktop/Projects/auto-levleup/LevelUp-App`
> **Date**: 2026-02-19 **Status**: Complete

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [All Domain Entities](#2-all-domain-entities)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Feature Workflows](#4-feature-workflows)
5. [UI Screens & Pages](#5-ui-screens--pages)
6. [Org/B2B Model](#6-orgb2b-model)
7. [Integration Points](#7-integration-points)
8. [Key Strengths](#8-key-strengths)
9. [Key Limitations & Gaps](#9-key-limitations--gaps)
10. [Firestore Collections Reference](#10-firestore-collections-reference)

---

## 1. System Overview

LevelUp QuestForge is a **Firebase/React interactive learning platform**
designed primarily for self-directed learners (consumer/B2C). It is evolving
toward an org-centric (B2B) model supporting schools, institutes, and training
organizations.

### Tech Stack

| Layer      | Technology                                                |
| ---------- | --------------------------------------------------------- |
| Frontend   | React 18 + TypeScript                                     |
| Routing    | React Router v6                                           |
| State      | Redux Toolkit + React Context + TanStack Query            |
| UI         | shadcn/ui + Tailwind CSS + Radix UI                       |
| Forms      | React Hook Form + Zod validation                          |
| Backend    | Firebase (Firestore + Realtime Database + Auth + Storage) |
| AI/LLM     | Gemini/Claude via Cloud Functions                         |
| Charts     | Recharts                                                  |
| Animations | Framer Motion                                             |

### Architecture Layers

```
┌────────────────────────────────────────┐
│         Pages / Routes                 │  React Router pages
├────────────────────────────────────────┤
│         Feature Modules                │  Self-contained feature units
├────────────────────────────────────────┤
│     Components (UI + Business)         │  Reusable components
├────────────────────────────────────────┤
│         Services Layer                 │  All data access & business logic
├────────────────────────────────────────┤
│   State (Redux + Context + Query)      │  Global + local state
├────────────────────────────────────────┤
│  Firebase (Firestore + RTDB + Auth)    │  Data persistence
└────────────────────────────────────────┘
```

### Applications in Monorepo

| App                   | Location                   | Purpose                    | Port |
| --------------------- | -------------------------- | -------------------------- | ---- |
| Main LevelUp App      | `/LevelUp-App` (root)      | Student-facing learning    | 5173 |
| Super Admin Dashboard | `apps/admin`               | Global platform management | 5175 |
| Org Admin Dashboard   | `apps/org-admin` (planned) | Org/B2B administration     | 5176 |

---

## 2. All Domain Entities

### 2.1 `AppUser`

**File**: `src/services/users/UsersService.ts` **Firestore Collection**: `users`

| Field                 | Type                       | Description                       |
| --------------------- | -------------------------- | --------------------------------- |
| `uid`                 | `string`                   | Firebase Auth UID (document ID)   |
| `displayName`         | `string`                   | Full name                         |
| `email`               | `string`                   | Email address                     |
| `photoURL`            | `string?`                  | Profile photo URL                 |
| `hunter`              | `string?`                  | Unique social username (@ handle) |
| `onboardingCompleted` | `boolean`                  | Whether initial setup is done     |
| `roles`               | `string[]?`                | Global roles (e.g., `'admin'`)    |
| `age`                 | `number?`                  | Age                               |
| `grade`               | `string?`                  | School grade/level                |
| `preferences`         | `Record<string, unknown>?` | User preferences                  |
| `createdAt`           | `TimestampISO`             | Account creation time             |

---

### 2.2 `CourseDTO`

**File**: `src/services/courses/CoursesService.ts` **Firestore Collection**:
`courses`

| Field                     | Type             | Description                          |
| ------------------------- | ---------------- | ------------------------------------ |
| `id`                      | `string?`        | Unique identifier                    |
| `ownerUid`                | `string`         | Creator's UID                        |
| `slug`                    | `string`         | URL-friendly identifier              |
| `title`                   | `string`         | Display title                        |
| `description`             | `string?`        | Course description                   |
| `thumbnailUrl`            | `string?`        | Cover image URL                      |
| `priceCents`              | `number?`        | Price in cents (0 = free)            |
| `progressPercent`         | `number?`        | Denormalized completion %            |
| `isPublic`                | `boolean?`       | Visible in public store              |
| `labels`                  | `CourseLabel[]?` | Categories (programming, math, etc.) |
| `type`                    | `SpaceType?`     | `'default'` or `'practice_range'`    |
| `orgId`                   | `string?`        | Parent organization (B2B)            |
| `orgGroupIds`             | `string[]?`      | Groups within org                    |
| `orgName`                 | `string?`        | Denormalized org name                |
| `adminUids`               | `string[]?`      | Course admin UIDs                    |
| `defaultEvaluatorAgentId` | `string?`        | Default AI evaluator agent           |
| `createdAt`               | `number`         | Unix timestamp                       |
| `updatedAt`               | `number`         | Unix timestamp                       |

---

### 2.3 `StoryPointDTO`

**File**: `src/services/storyPoints/StoryPointsService.ts` **Firestore
Collection**: `storyPoints`

| Field                 | Type                             | Description                                                |
| --------------------- | -------------------------------- | ---------------------------------------------------------- |
| `id`                  | `string?`                        | Unique identifier                                          |
| `courseId`            | `string`                         | Parent course ID                                           |
| `title`               | `string`                         | Display title                                              |
| `description`         | `string?`                        | Summary                                                    |
| `orderIndex`          | `number`                         | Position within course                                     |
| `type`                | `StoryPointType`                 | `'standard'` \| `'timed_test'` \| `'test'` \| `'practice'` |
| `testDurationMinutes` | `number?`                        | Duration for test-type story points                        |
| `testInstructions`    | `string?`                        | Instructions for timed tests                               |
| `sections`            | `Array<{id, title, orderIndex}>` | Embedded sections (organizers)                             |
| `difficulty`          | `SpaceDifficulty?`               | `easy` \| `medium` \| `hard` \| `expert`                   |
| `createdAt`           | `number`                         | Unix timestamp                                             |
| `updatedAt`           | `number`                         | Unix timestamp                                             |

---

### 2.4 `ItemDTO` — The Central Content Model

**File**: `src/types/items.ts` **Firestore Collection**: `items`

This is the **most important model** — a generic container for all learning
content.

#### Core Fields

| Field            | Type                            | Description                               |
| ---------------- | ------------------------------- | ----------------------------------------- |
| `id`             | `string?`                       | Unique identifier                         |
| `courseId`       | `string`                        | Parent course (denormalized for querying) |
| `storyPointId`   | `string`                        | Parent story point                        |
| `sectionId`      | `string?`                       | Section within story point                |
| `type`           | `ItemType`                      | Content type (see below)                  |
| `title`          | `string?`                       | Optional display title                    |
| `content`        | `string?`                       | Optional main content                     |
| `difficulty`     | `'easy' \| 'medium' \| 'hard'?` | Difficulty level                          |
| `topics`         | `string[]?`                     | Topic identifiers                         |
| `labels`         | `string[]?`                     | Free-form tags                            |
| `payload`        | `ItemPayload`                   | Type-specific data (see below)            |
| `meta`           | `ItemMetadata?`                 | UI and system metadata                    |
| `analytics`      | `ItemAnalytics?`                | Analytics dimensions                      |
| `sect_order_idx` | `number?`                       | Order within section                      |
| `orderIndex`     | `number?`                       | Legacy global order                       |
| `createdAt`      | `number`                        | Unix timestamp                            |
| `updatedAt`      | `number`                        | Unix timestamp                            |

#### ItemType Enum

```typescript
type ItemType =
  | "question" // MCQ, code, text, etc.
  | "material" // Reading, videos, PDFs
  | "interactive" // Simulations, demos, tools
  | "assessment" // Formal quizzes/exams
  | "discussion" // Forum prompts
  | "project" // Assignments
  | "checkpoint"; // Progress milestones
```

#### Question Payload (when `type === 'question'`)

| Field          | Type                            | Description                                    |
| -------------- | ------------------------------- | ---------------------------------------------- |
| `questionType` | `string`                        | See question types below                       |
| `title`        | `string?`                       | Optional title                                 |
| `content`      | `string`                        | Question prompt                                |
| `explanation`  | `string?`                       | Answer explanation                             |
| `basePoints`   | `number?`                       | Point value                                    |
| `difficulty`   | `'easy' \| 'medium' \| 'hard'?` | Difficulty                                     |
| `questionData` | `any`                           | Type-specific data (options, test cases, etc.) |

**Supported Question Types** (15 types): `mcq`, `mcaq`, `true-false`, `text`,
`code`, `material`, `matching`, `fill-blanks`, `fill-blanks-dd`, `paragraph`,
`jumbled`, `audio`, `group-options`, `chat_agent_question`, `numerical`,
`image_evaluation`

#### Material Payload (when `type === 'material'`)

| Field          | Type           | Description                                                                |
| -------------- | -------------- | -------------------------------------------------------------------------- |
| `materialType` | `string`       | `text` \| `video` \| `pdf` \| `link` \| `interactive` \| `story` \| `rich` |
| `url`          | `string?`      | External URL                                                               |
| `duration`     | `number?`      | Video length or reading time (minutes)                                     |
| `downloadable` | `boolean?`     | Allow downloads                                                            |
| `content`      | `string?`      | Embedded text content                                                      |
| `richContent`  | `RichContent?` | Blog-style article structure                                               |

**Rich Content Block Types**: `heading`, `paragraph`, `image`, `video`, `audio`,
`code`, `quote`, `list`, `divider`

#### Assessment Payload (when `type === 'assessment'`)

| Field            | Type                                          | Description                                    |
| ---------------- | --------------------------------------------- | ---------------------------------------------- |
| `assessmentType` | `string`                                      | `quiz` \| `exam` \| `project` \| `peer_review` |
| `timeLimit`      | `number?`                                     | Time limit in minutes                          |
| `attempts`       | `number?`                                     | Allowed attempts                               |
| `passingScore`   | `number?`                                     | Minimum score to pass (0-100)                  |
| `itemReferences` | `string[]?`                                   | Referenced item IDs                            |
| `rubric`         | `Array<{criterion, maxPoints, description}>?` | Grading rubric                                 |

#### ItemMetadata

| Field                | Type                | Description                                                                  |
| -------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `totalPoints`        | `number?`           | Maximum points for this item                                                 |
| `estimatedTime`      | `number?`           | Time estimate in minutes                                                     |
| `tags`               | `string[]?`         | Additional tags                                                              |
| `learningObjectives` | `string[]?`         | Educational objectives                                                       |
| `skillsAssessed`     | `string[]?`         | Skills evaluated                                                             |
| `bloomsLevel`        | `string?`           | `remember` \| `understand` \| `apply` \| `analyze` \| `evaluate` \| `create` |
| `prerequisites`      | `string[]?`         | Item IDs required before this                                                |
| `isRetriable`        | `boolean?`          | Can users retry? (default true)                                              |
| `evaluatorAgentId`   | `string?`           | Per-item AI evaluator override                                               |
| `migrationSource`    | `{type, sourceId}?` | Links to legacy Question                                                     |
| `featured`           | `boolean?`          | Highlight in UI                                                              |
| `viewCount`          | `number?`           | Analytics counter                                                            |
| `successRate`        | `number?`           | % users who succeed                                                          |

---

### 2.5 `UserStoryPointProgressDoc`

**File**: `src/types/items.ts`,
`src/services/progress/UserStoryPointProgressService.ts` **Firestore
Collection**: `userStoryPointProgress`

| Field          | Type                                | Description                                   |
| -------------- | ----------------------------------- | --------------------------------------------- |
| `id`           | `string?`                           | Composite: `${userId}_${storyPointId}`        |
| `userId`       | `string`                            | User ID                                       |
| `courseId`     | `string`                            | Parent course ID                              |
| `storyPointId` | `string`                            | Parent story point ID                         |
| `status`       | `string`                            | `not_started` \| `in_progress` \| `completed` |
| `pointsEarned` | `number`                            | Sum of best scores per item                   |
| `totalPoints`  | `number`                            | Sum of all item max points                    |
| `percentage`   | `number`                            | pointsEarned/totalPoints (0..1)               |
| `items`        | `Record<string, ItemProgressEntry>` | Map: itemId → progress entry                  |
| `updatedAt`    | `number`                            | Unix timestamp                                |
| `completedAt`  | `number?`                           | Completion timestamp                          |

#### ItemProgressEntry

| Field           | Type                | Description                                   |
| --------------- | ------------------- | --------------------------------------------- |
| `itemId`        | `string`            | Item ID                                       |
| `itemType`      | `ItemType`          | Item type                                     |
| `completed`     | `boolean`           | Completion status                             |
| `completedAt`   | `number?`           | Completion timestamp                          |
| `timeSpent`     | `number?`           | Seconds spent                                 |
| `interactions`  | `number?`           | Number of interactions                        |
| `lastUpdatedAt` | `number`            | Last update timestamp                         |
| `questionData`  | `QuestionProgress?` | For question items (status, attempts, scores) |
| `score`         | `number?`           | 0-100 for assessments                         |
| `feedback`      | `string?`           | Instructor feedback                           |
| `progress`      | `number?`           | 0-100 for media items                         |

---

### 2.6 `ChatSession`

**File**: `src/types/chatSession.ts` **Firestore Collection**: `chatSessions`

| Field            | Type            | Description                  |
| ---------------- | --------------- | ---------------------------- |
| `id`             | `string`        | Session ID                   |
| `userId`         | `string`        | User ID                      |
| `courseId`       | `string`        | Parent course                |
| `storyPointId`   | `string`        | Parent story point           |
| `itemId`         | `string`        | Linked content item          |
| `questionType`   | `string`        | Question type context        |
| `sessionTitle`   | `string`        | Auto-generated title         |
| `previewMessage` | `string`        | First user message (preview) |
| `createdAt`      | `Timestamp`     | Firestore timestamp          |
| `updatedAt`      | `Timestamp`     | Firestore timestamp          |
| `messageCount`   | `number`        | Total messages               |
| `language`       | `string`        | Response language            |
| `isActive`       | `boolean`       | Soft delete flag             |
| `messages`       | `ChatMessage[]` | Full conversation history    |
| `systemPrompt`   | `string`        | AI tutor instructions        |

---

### 2.7 `TimedTestSession`

**File**: `src/types/timedTest.ts` **Firestore Collection**: `timedTestSessions`

| Field               | Type                                  | Description                                              |
| ------------------- | ------------------------------------- | -------------------------------------------------------- |
| `id`                | `string`                              | Session ID                                               |
| `userId`            | `string`                              | User ID                                                  |
| `courseId`          | `string`                              | Parent course                                            |
| `storyPointId`      | `string`                              | Parent story point                                       |
| `attemptNumber`     | `number`                              | 1, 2, 3…                                                 |
| `status`            | `string`                              | `in_progress` \| `completed` \| `expired` \| `abandoned` |
| `startedAt`         | `number`                              | Server timestamp (start)                                 |
| `endedAt`           | `number?`                             | End timestamp                                            |
| `durationMinutes`   | `number`                              | Configured duration                                      |
| `totalQuestions`    | `number`                              | Total question count                                     |
| `answeredQuestions` | `number`                              | Answered count                                           |
| `pointsEarned`      | `number?`                             | Score (computed on submit)                               |
| `totalPoints`       | `number?`                             | Max possible score                                       |
| `percentage`        | `number?`                             | Score percentage                                         |
| `questionOrder`     | `string[]`                            | Item IDs in display order                                |
| `submissions`       | `Record<string, TimedTestSubmission>` | Answers keyed by itemId                                  |
| `markedForReview`   | `Record<string, boolean>`             | Review flags per question                                |
| `visitedQuestions`  | `Record<string, boolean>`             | Visited state per question                               |
| `createdAt`         | `number`                              | Unix timestamp                                           |
| `updatedAt`         | `number`                              | Unix timestamp                                           |

---

### 2.8 `OrgDTO` (Organization)

**File**: `src/types/organizations.ts` **Firestore Collection**: `orgs`

| Field          | Type          | Description                                              |
| -------------- | ------------- | -------------------------------------------------------- |
| `id`           | `string?`     | Unique identifier                                        |
| `name`         | `string`      | Organization name                                        |
| `title`        | `string?`     | Short title/abbreviation                                 |
| `slug`         | `string`      | URL-friendly identifier                                  |
| `description`  | `string?`     | About the org                                            |
| `imageUrl`     | `string?`     | Logo/thumbnail                                           |
| `bannerUrl`    | `string?`     | Banner image                                             |
| `contactEmail` | `string?`     | Contact email                                            |
| `contactPhone` | `string?`     | Contact phone                                            |
| `website`      | `string?`     | Website URL                                              |
| `address`      | `OrgAddress?` | Physical address (street, city, state, country, zipCode) |
| `code`         | `string`      | Join code (unique, auto-generated)                       |
| `isPublic`     | `boolean?`    | Discoverable in explore page                             |
| `adminUids`    | `string[]`    | Org admin UIDs (denormalized)                            |
| `ownerUid`     | `string`      | Creator UID                                              |
| `createdAt`    | `number`      | Unix timestamp                                           |
| `updatedAt`    | `number`      | Unix timestamp                                           |

---

### 2.9 `OrgGroupDTO`

**File**: `src/types/organizations.ts` **Firestore Collection**: `orgGroups`

| Field          | Type       | Description                                 |
| -------------- | ---------- | ------------------------------------------- |
| `id`           | `string?`  | Unique identifier                           |
| `orgId`        | `string`   | Parent organization                         |
| `name`         | `string`   | Group name (e.g., "Grade 10", "Semester 1") |
| `description`  | `string?`  | Group description                           |
| `imageUrl`     | `string?`  | Group thumbnail                             |
| `displayOrder` | `number`   | Sort order                                  |
| `courseIds`    | `string[]` | Courses in this group                       |
| `createdAt`    | `number`   | Unix timestamp                              |
| `updatedAt`    | `number`   | Unix timestamp                              |

---

### 2.10 `UserOrgRecord`

**File**: `src/types/organizations.ts` **Firestore Collection**: `userOrgs`

| Field         | Type            | Description                                   |
| ------------- | --------------- | --------------------------------------------- |
| `id`          | `string?`       | Composite: `${userId}_${orgId}`               |
| `userId`      | `string`        | User ID                                       |
| `orgId`       | `string`        | Organization ID                               |
| `joinedAt`    | `number`        | Join timestamp                                |
| `source`      | `UserOrgSource` | `code` \| `invite` \| `admin` \| `owner`      |
| `roles`       | `string[]?`     | Roles within org (e.g., `['admin', 'tutor']`) |
| `orgName`     | `string`        | Denormalized org name                         |
| `orgImageUrl` | `string?`       | Denormalized org logo                         |
| `isArchived`  | `boolean?`      | Soft delete                                   |
| `archivedAt`  | `number?`       | Archive timestamp                             |

---

### 2.11 `UserRolesDTO`

**File**: `src/types/organizations.ts` **Firestore Collection**: `userRoles`

| Field          | Type                                | Description                        |
| -------------- | ----------------------------------- | ---------------------------------- |
| `id`           | `string?`                           | Same as userId                     |
| `userId`       | `string`                            | User ID                            |
| `isSuperAdmin` | `boolean`                           | Global super admin flag            |
| `canCreateOrg` | `boolean?`                          | Permission to create organizations |
| `orgAdmin`     | `Record<orgId, OrgAdminRole>`       | Map of org admin roles             |
| `courseAdmin`  | `Record<courseId, CourseAdminRole>` | Map of course admin roles          |
| `createdAt`    | `number`                            | Unix timestamp                     |
| `updatedAt`    | `number`                            | Unix timestamp                     |

---

### 2.12 `AgentDTO`

**File**: `src/services/agents/AgentsService.ts` **Firestore Collection**:
`course_agents`

| Field                  | Type                          | Description                             |
| ---------------------- | ----------------------------- | --------------------------------------- |
| `id`                   | `string?`                     | Unique identifier                       |
| `courseId`             | `string`                      | Parent course ID                        |
| `type`                 | `AgentType`                   | `'tutor'` \| `'evaluator'`              |
| `name`                 | `string`                      | Display name                            |
| `identity`             | `string`                      | Persona description                     |
| `systemPrompt`         | `string?`                     | Instructions                            |
| `rules`                | `string?`                     | Specific grading rules (for evaluators) |
| `evaluationObjectives` | `Array<{id?, name, points}>?` | Grading criteria (evaluators only)      |
| `createdAt`            | `number`                      | Unix timestamp                          |
| `updatedAt`            | `number`                      | Unix timestamp                          |

---

### 2.13 `PracticeRangeItemDTO`

**File**: `src/services/practiceRange/` **Firestore Collection**:
`practiceRangeItems`

| Field            | Type                        | Description                              |
| ---------------- | --------------------------- | ---------------------------------------- |
| `id`             | `string?`                   | Unique identifier                        |
| `spaceId`        | `string`                    | Parent practice range space              |
| `type`           | `ItemType`                  | Content type                             |
| `payload`        | `ItemPayload`               | Type-specific content                    |
| `title`          | `string`                    | Display title                            |
| `difficulty`     | `string`                    | `easy` \| `medium` \| `hard` \| `expert` |
| `tags`           | `string[]`                  | Classification tags                      |
| `pyqInfo`        | `PreviousYearOccurrence[]?` | Previous Year Question info              |
| `acceptanceRate` | `number?`                   | % users who solve correctly              |
| `attemptCount`   | `number?`                   | Total attempts                           |
| `createdAt`      | `number`                    | Unix timestamp                           |
| `updatedAt`      | `number`                    | Unix timestamp                           |

---

### 2.14 WillApp Models (Habit Tracker Sub-Domain)

**File**: `src/will-app/types.ts`, `src/will-app/database/types.ts`

| Model            | Storage           | Description                                        |
| ---------------- | ----------------- | -------------------------------------------------- |
| `UserHabit`      | Firestore         | Habit configuration (target, will points, type)    |
| `Group`          | Firestore         | Group of habits (personal or collaborative)        |
| `RTDBHabitData`  | Realtime Database | Daily progress for a single habit (high-frequency) |
| `RTDBDailyStats` | Realtime Database | Daily summary across all habits                    |

**UserHabit Fields**: name, target (reps), willPerRep, maxWill, startingWill,
isNegative (bad habit), type (tracked, timed, counted)

---

### 2.14b `ItemAnalytics` (Embedded in ItemDTO)

**File**: `src/types/itemAnalytics.ts`

This type attaches rich analytics metadata to each item, enabling
multidimensional test analysis.

| Field                 | Type                                                                    | Description                                                         |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `difficulty`          | `'easy' \| 'medium' \| 'hard'?`                                         | Difficulty classification                                           |
| `topics`              | `string[]?`                                                             | Topic identifiers (e.g., `["solana", "ownership-model"]`)           |
| `labels`              | `string[]?`                                                             | Free-form labels (e.g., `["high-priority", "revision"]`)            |
| `bloomsLevel`         | `BloomsLevel?`                                                          | Bloom's taxonomy level                                              |
| `bloomsSubLevel`      | `string?`                                                               | Sub-level (e.g., `"apply-procedure"`)                               |
| `cognitiveLoad`       | `'low' \| 'medium' \| 'high'?`                                          | Cognitive demand                                                    |
| `skillsAssessed`      | `string[]?`                                                             | Skills evaluated (e.g., `["problem-solving", "critical-thinking"]`) |
| `primarySkill`        | `string?`                                                               | Most important skill                                                |
| `secondarySkills`     | `string[]?`                                                             | Supporting skills                                                   |
| `conceptCategory`     | `string?`                                                               | Category (e.g., `"fundamentals"`, `"advanced-concepts"`)            |
| `learningObjective`   | `string?`                                                               | Specific learning goal                                              |
| `applicationDomain`   | `'theory' \| 'practical' \| 'real-world' \| 'conceptual'?`              | Application type                                                    |
| `questionComplexity`  | `'single-concept' \| 'multi-concept' \| 'synthesis' \| 'integration'?`  | Complexity level                                                    |
| `prerequisiteTopics`  | `string[]?`                                                             | Topics required before this                                         |
| `relatedTopics`       | `string[]?`                                                             | Related concept topics                                              |
| `conceptImportance`   | `'foundational' \| 'important' \| 'advanced' \| 'optional' \| 'bonus'?` | Importance level                                                    |
| `commonMistakes`      | `string[]?`                                                             | Known common errors                                                 |
| `hintsAvailable`      | `boolean?`                                                              | Whether hints are available                                         |
| `curriculumStandards` | `string[]?`                                                             | Curriculum alignment (e.g., `"NCERT-Class10-Math-Ch2"`)             |
| `examRelevance`       | `string[]?`                                                             | Relevant exams (e.g., `"JEE-Main"`, `"NEET"`, `"SAT"`)              |
| `customDimensions`    | `Record<string, string \| string[] \| number>?`                         | Extensible custom fields                                            |

**Preset Templates**: `conceptual_easy`, `application_medium`, `analysis_hard`
(standardize common item configurations)

---

### 2.15 Analytics Models (Planned)

**Files**: Per `orgAdminDashboardApp.md`

| Model                | Collection         | Description                                           |
| -------------------- | ------------------ | ----------------------------------------------------- |
| `OrgAnalyticsDoc`    | `orgAnalytics`     | Pre-computed org-level daily/weekly/monthly analytics |
| `CourseAnalyticsDoc` | `courseAnalytics`  | Pre-computed course-level analytics                   |
| `ActivityLogEntry`   | `activityLog`      | Raw user activity events                              |
| `OrgSubscriptionDoc` | `orgSubscriptions` | Subscription plan/seat tracking                       |

---

### 2.15b `AttemptDTO`

**File**: `src/services/progress/AttemptsService.ts` **Firestore Collection**:
`attempts`

| Field             | Type       | Description                                                     |
| ----------------- | ---------- | --------------------------------------------------------------- |
| `id`              | `string?`  | Unique identifier                                               |
| `userId`          | `string`   | User ID                                                         |
| `courseId`        | `string`   | Parent course                                                   |
| `storyPointId`    | `string`   | Parent story point                                              |
| `itemId`          | `string`   | Item attempted                                                  |
| `itemType`        | `ItemType` | Type of item                                                    |
| `mode`            | `string`   | `'tutorial'` \| `'challenge'` \| `'practice'` \| `'assessment'` |
| `submission`      | `any`      | Normalized answer data                                          |
| `evaluation`      | `any?`     | Evaluation results from evaluator                               |
| `correctness`     | `number`   | 0–1 (partial credit supported)                                  |
| `pointsEarned`    | `number`   | Points earned on this attempt                                   |
| `timeSeconds`     | `number?`  | Time spent on attempt                                           |
| `interactionData` | `any?`     | Additional interaction metadata                                 |
| `createdAt`       | `number`   | Unix timestamp                                                  |

---

### 2.15c `UserCourseRecord` (Inventory)

**File**: `src/services/courses/UserCourseInventoryService.ts` **Firestore
Collection**: `user_courses`

| Field      | Type       | Description                                                         |
| ---------- | ---------- | ------------------------------------------------------------------- |
| `userId`   | `string`   | User ID                                                             |
| `courseId` | `string`   | Course ID                                                           |
| `roles`    | `string[]` | User's roles for this course                                        |
| `source`   | `string`   | `'owned'` \| `'admin'` \| `'redeem'` \| `'purchased'` \| `'invite'` |

---

### 2.15d `UserProgressDTO`

**File**: `src/services/progress/ProgressService.ts` **Firestore Collection**:
`progress`

| Field           | Type      | Description                                                       |
| --------------- | --------- | ----------------------------------------------------------------- |
| `id`            | `string?` | Unique identifier                                                 |
| `userId`        | `string`  | User ID                                                           |
| `scope`         | `string`  | `'course'` \| `'storyPoint'` \| `'question'`                      |
| `scopeId`       | `string`  | ID of the scoped entity                                           |
| `status`        | `string`  | `'locked'` \| `'not_started'` \| `'in_progress'` \| `'completed'` |
| `completedMode` | `string?` | `'tutorial'` \| `'challenge'`                                     |
| `startedAt`     | `number?` | Start timestamp                                                   |
| `completedAt`   | `number?` | Completion timestamp                                              |
| `updatedAt`     | `number`  | Last update timestamp                                             |

---

### 2.16 Legacy Models

| Model                                             | Status                | Notes                                                                                                                      |
| ------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `QuestionDTO`                                     | **Legacy**            | Superseded by `ItemDTO`. Migration script exists (`scripts/migrate-to-items.ts`). Service kept for backward compatibility. |
| `domain/models.ts` (`Space`, `Quest`, `Question`) | **Conceptual/Legacy** | Early abstract representations. Not used for data storage.                                                                 |
| `QuestionTypeRegistry`                            | **Unused**            | Was for programmatic question generation. Not integrated in main flow.                                                     |

---

## 3. User Roles & Permissions

### 3.1 Role Hierarchy

```
SuperAdmin (global)
  └── OrgAdmin (per organization)
        └── CourseAdmin (per course)
              └── Member/Student (per org)
                    └── Consumer (public, individual)
```

### 3.2 Role Details

| Role            | Scope        | Key Permissions                                                                  | Assignment                                                          |
| --------------- | ------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **SuperAdmin**  | Global       | Everything — create orgs, manage all users, all data                             | Manual (in `userRoles.isSuperAdmin`)                                |
| **OrgAdmin**    | Organization | Manage org members, courses, AI agents, analytics, settings                      | SuperAdmin grants via `userRoles.orgAdmin[orgId]`                   |
| **CourseAdmin** | Course       | Edit course content, manage story points/items, manage AI agents, view analytics | SuperAdmin or OrgAdmin grants via `userRoles.courseAdmin[courseId]` |
| **Member**      | Organization | Access all org courses (no code required), see My Organization dashboard         | Joining via org join code, invite, or admin                         |
| **Consumer**    | Self         | Purchase/redeem individual courses, track personal progress                      | Self (via redemption code or public store)                          |

### 3.3 Permission Storage

Two parallel storage mechanisms:

1. **`userRoles` collection** (global, centralized): `isSuperAdmin`,
   `orgAdmin[orgId]`, `courseAdmin[courseId]`
2. **`userOrgs` collection** (org-scoped, emerging): `roles: string[]` per
   membership record (supports delegated role management by OrgAdmins)

### 3.4 Access Control Rules

**Course Access**:

```
hasAccess = userInventory.includes(courseId)   // B2C: individual purchase
         || userOrgMemberships.some(m => m.orgId === course.orgId)  // B2B: org member
```

**Course Admin Operations**: Require `userRoles.courseAdmin[courseId]` OR
`course.ownerUid === userId` OR `course.adminUids.includes(userId)`

**Agent Management**: Course owners + course admins can write `course_agents`

**Org Admin Dashboard Access**: `userRoles.isSuperAdmin` OR
`userRoles.orgAdmin[orgId]` OR `userOrgs.roles.includes('admin')`

---

## 4. Feature Workflows

### 4.1 User Registration & Onboarding

```
1. User clicks "Sign Up" → LoginDialog opens (modal)
2. Firebase Auth creates account (email/password or Google)
3. OnboardingContext detects new user → OnboardingDialog opens
4. User fills profile: name, age, grade → UsersService.create()
5. `onboardingCompleted` set to true
6. Redirect to Home page
```

### 4.2 Course Access (B2C) — Redemption Flow

```
1. User browses /home or /store (public catalog)
2. User clicks course → /courses/:id
3. System checks: UserCourseInventoryService.hasCourse(userId, courseId)
4. If NOT in inventory:
   a. Show "Redeem Code" input OR "Buy" button
   b. User enters code → RedemptionService.redeemCode(userId, code)
   c. Code validates → UserCourseInventoryService.addCourse(userId, courseId)
5. User accesses course content (story points, items)
```

### 4.3 Course Access (B2B) — Org Join Flow

```
1. User visits /orgs or receives invite link
2. User enters org join code OR clicks invite link
3. System: UserOrgsService.joinOrg(userId, orgId, source='code')
4. User record created in userOrgs: {userId, orgId, joinedAt, source}
5. User redirected to org dashboard → sees all courses in org
6. Access to any org course: NO code required
7. Access check: userOrgMemberships.some(m => m.orgId === course.orgId)
```

### 4.4 Learning Flow (Story Point)

```
1. User selects story point → /courses/:id/sp/:storyPointId
2. System loads:
   - StoryPointsService.getById(storyPointId)
   - ItemsService.listByStoryPoint(storyPointId)
   - UserStoryPointProgressService.getProgress(userId, storyPointId)
3. Items displayed grouped by sections (SectionList → ItemCard)
4. User clicks item → navigate to /courses/:id/sp/:storyPointId/item/:itemId
5. Item renders based on type (QuestionPage / MaterialView / etc.)
6. User submits answer:
   a. Frontend validation (answerValidation.ts)
   b. Evaluation: local evaluator OR AI agent (AgentResolver)
   c. AttemptsService.recordAttempt(userId, itemId, submission)
   d. UserStoryPointProgressService.updateItemProgress(...)
7. Feedback shown (correct/incorrect, explanation, sound effect)
8. Story point progress updated in real-time
```

### 4.5 Question Submission Flow

```
1. User views question → useQuestionState loads item
2. User enters answer
3. User clicks "Submit"
4. Frontend validation
5. Route by evaluation method:
   a. Auto-evaluated (MCQ, true-false, fill-blanks, numerical):
      → AnswerEvaluator.evaluateAnswer() [client-side]
   b. AI-evaluated (text, descriptive, image, audio, code):
      → resolveEvaluatorAgent() → AgentResolver
      → AnswerEvaluationService.evaluate() [Cloud Function]
6. Record attempt: AttemptsService.recordAttempt()
7. Update progress: UserStoryPointProgressService.updateItemProgress()
8. Display: feedback panel, points, explanation
9. Sound effect: feedbackSounds.ts (correct/incorrect)
10. UI updates: score badge, completion status
```

### 4.5b Timed Test — 5-Status Question Tracking System

Each question in a timed test maintains one of 5 statuses, driving the sidebar
and controls:

| Status                | Color  | Trigger                                       |
| --------------------- | ------ | --------------------------------------------- |
| **Not Visited**       | Gray   | Question exists but user hasn't opened it     |
| **Not Answered**      | Orange | User opened the question, no answer submitted |
| **Answered**          | Green  | User submitted an answer                      |
| **Marked for Review** | Amber  | User flagged question for later review        |
| **Answered & Marked** | Purple | User answered AND flagged for review          |

**Status Priority** (for display): Answered & Marked > Answered > Marked for
Review > Not Answered > Not Visited

**Database tracking fields** in `TimedTestSession`:

- `visitedQuestions: Record<itemId, boolean>` — auto-set on open
- `submissions: Record<itemId, TimedTestSubmission>` — set on answer save
- `markedForReview: Record<itemId, boolean>` — toggled by user

**User Controls**: Save & Next, Mark for Review, Clear Response (reverts to Not
Answered)

---

### 4.6 Timed Test Flow

```
1. User sees story point with type='timed_test' or 'test'
2. User clicks "Start Test" → navigate to /...timed-test or /...test-landing
3. Landing page shows: duration, instructions, previous attempts
4. User clicks "Start New Attempt":
   → TimedTestSessionService.createSession(userId, courseId, storyPointId)
   → Session document created with server timestamp
5. Navigate to first question
6. Client-side timer countdown (based on server startedAt)
7. User answers questions:
   - Navigate freely between questions
   - Mark for review
   - Answers synced per submission
8. Submit options:
   a. Manual: User clicks "Submit Test" → confirmation dialog → confirm
   b. Auto: Timer reaches 0 → auto-submit
9. Session status updated to 'completed' or 'expired'
10. Navigate to results page:
    - Score, time spent, per-question breakdown
    - Visual Analytics Dashboard (6 tabs):
      AI Insights, Overview, Performance, Topics, Cognitive, Timeline
```

### 4.7 Practice Range Flow

```
1. User navigates to /practice/:id (practice_range type course)
2. Load: PracticeRangeItemsService.listBySpace(spaceId)
3. Load progress: PracticeRangeProgressService.getProgress() [RTDB]
4. Display items with filters:
   - Difficulty (easy/medium/hard/expert)
   - Tags/topics
   - Status (solved/unsolved)
   - PYQ (Previous Year Questions) filter
5. User clicks item → /practice/:id/item/:itemId
6. User solves item → submit answer
7. Progress updated in RTDB (fast write for high-frequency):
   → PracticeRangeProgressService.updateItemStatus()
8. Submission stored in Firestore (rich data):
   → PracticeRangeProgressService.recordSubmission()
9. Return to practice range with updated status
```

### 4.8 AI Tutoring (Chat) Flow

```
1. User opens AI Chat panel on any question page
2. System loads tutor agents for course:
   → AgentsService.listTutorsByCourse(courseId)
3. User selects agent (or uses "Default Tutor")
4. User types message
5. System builds prompt:
   - Agent identity + systemPrompt
   - Language preference
   - Media context (question images, submission images, audio, code)
   - Conversation history
   - Question + student answer context
6. Prompt sent to AI (Gemini/Claude) via Cloud Function
7. Response streamed back to UI
8. Message saved to ChatSession in Firestore
9. Session history accessible for future reference
```

### 4.9 Course Admin / Content Creation Flow

```
1. Course admin navigates to /courses/:id/admin
2. Dashboard tabs:
   - Analytics: enrollment, completion rates
   - Story Points: create/edit/reorder story points
   - Agents: manage AI tutors and evaluators
   - Access Codes: generate/manage redemption codes
3. Create story point:
   → AddStoryPointDialog: title, description, type, duration
   → StoryPointsService.create(data)
4. Add items to story point:
   → QuestionCreateDialog / ItemCreationDialog
   → ItemsService.create(item)
5. Organize items into sections:
   → SectionManagement: create sections, drag-and-drop items
6. Configure AI agents:
   → AgentEditorDialog: name, type, identity, system prompt
   → AgentsService.create(agent)
7. Set default evaluator:
   → CoursesService.setDefaultEvaluator(courseId, agentId)
8. Generate access codes:
   → RedemptionService.generateCode(courseId, expiresAt?, maxUses?)
```

### 4.10 Organization Admin Flow

```
1. Org Admin navigates to /orgs/:orgId/admin (or apps/org-admin)
2. Dashboard shows: member count, active courses, avg completion
3. Manage courses:
   - Create course (auto-sets orgId)
   - Assign existing courses to org groups
4. Manage members:
   - List all members (from userOrgs)
   - Add member by email (creates userOrgs record)
   - Manage roles (orgAdmin, courseAdmin per course)
5. Analytics:
   - Org-wide DAU/WAU/MAU
   - Course comparison table
   - Individual member progress drill-down
6. Settings:
   - Edit org info (name, logo, description)
   - Regenerate join code
   - Manage org groups (Grade 10, Semester 1, etc.)
```

### 4.11 WillApp (Habit Tracker) Flow

```
1. User navigates to /will
2. 4-tab navigation: Today / Analytics / Goals / Profile
3. Today screen:
   - View all habits with progress bars
   - Click + to increment reps → Will points calculated
   - Will points formula: (reps × willPerRep), capped at maxWill
   - RTDB updated in real-time for high-frequency writes
4. Analytics screen:
   - Last 7/30/365 days of will gained/lost
   - Top performing habits ranked
   - Area charts via Recharts
5. Goals screen:
   - Goals group multiple habits
   - Circular progress indicators
6. Profile screen:
   - Total Will, streak, achievements
```

---

## 5. UI Screens & Pages

### 5.1 Main App Pages

| Route                        | File                    | Description                                              |
| ---------------------------- | ----------------------- | -------------------------------------------------------- |
| `/home`                      | `Home.tsx`              | Course catalog — enrolled courses + public store preview |
| `/store`                     | `Store.tsx`             | Public course marketplace                                |
| `/settings`                  | `Settings.tsx`          | User profile and preferences                             |
| `/orgs`                      | `OrgsPage.tsx`          | Organizations listing + join by code                     |
| `/orgs/:orgId/admin`         | `OrgAdminPage.tsx`      | In-app org admin panel                                   |
| `/super-admin`               | `SuperAdminPage.tsx`    | Super admin panel                                        |
| `/scan/:tagId`               | `Scan.tsx`              | QR code course scanner                                   |
| `/will`                      | `WillApp.tsx`           | Habit tracker (WillApp)                                  |
| `/practice/:id`              | `PracticeRange.tsx`     | Practice range home with filters                         |
| `/practice/:id/item/:itemId` | `PracticeRangeItem.tsx` | Individual practice item                                 |

### 5.2 Course Pages

| Route                                        | File             | Description                                |
| -------------------------------------------- | ---------------- | ------------------------------------------ |
| `/courses/:id`                               | `Course.tsx`     | Course detail — story point list, progress |
| `/courses/:id/admin`                         | `course-admin/`  | Course admin dashboard                     |
| `/courses/:id/sp/:storyPointId`              | `StoryPoint.tsx` | Story point detail — item list by sections |
| `/courses/:id/sp/:storyPointId/admin`        | `story-point/`   | Story point admin dashboard                |
| `/courses/:id/sp/:storyPointId/item/:itemId` | Feature pages    | Individual item (question/material)        |

### 5.3 Timed Test Pages

| Route                             | File                                | Description                                 |
| --------------------------------- | ----------------------------------- | ------------------------------------------- |
| `…/timed-test`                    | `TimedTestStoryPointDetail.tsx`     | Test overview + rules                       |
| `…/timed-test/question/:itemId`   | `TimedTestQuestionPage.tsx`         | Immersive test question page                |
| `…/timed-test/results/:sessionId` | `TimedTestResults.tsx`              | Results with visual analytics dashboard     |
| `…/timed-test/practice`           | `TimedTestPracticeQuestionPage.tsx` | Practice mode for timed test items          |
| `…/test-landing`                  | `MockTestLanding.tsx`               | Mock test landing (instructions + attempts) |
| `…/test/:sessionId`               | `MockTestQuestionFlow.tsx`          | Mock test question flow with timer          |
| `…/results/:sessionId`            | `MockTestResults.tsx`               | Mock test results page                      |

### 5.4 Feature Module Structure

```
src/features/
├── questions/          # Question viewing, submission, evaluation
│   ├── pages/QuestionPage.tsx
│   ├── components/page/ (Layout, Header, Content, Feedback, Toolbar)
│   └── hooks/ (useQuestionState, useQuestionSubmission, useQuestionNavigation, useQuestionTracking)
│
├── story-point/        # Story point browsing, item management
│   ├── components/ (header, items, sections, access, tests, shared)
│   └── hooks/ (useItemsLoader, useSectionManagement, useAccessControl, useOverviewStats, useTestSession)
│
├── timed-test/         # Timed test experience
│   └── (timer, question navigation, session management)
│
└── mock-test/          # Mock test (identical to timed-test, separate collection)
```

### 5.5 Key Component Areas

| Component Area   | Path                                                    | Purpose                        |
| ---------------- | ------------------------------------------------------- | ------------------------------ |
| AI Chat Panel    | `src/components/questions/AiChatPanel.tsx`              | AI tutor chat interface        |
| Agent Management | `src/components/agents/AgentsList.tsx`                  | Create/manage AI agents        |
| Redemption       | `src/features/story-point/components/access/`           | Code-based access system       |
| Visual Analytics | `src/components/analytics/VisualAnalyticsDashboard.tsx` | 6-tab test analytics           |
| Rich Text Editor | `src/components/content/`                               | Blog-style material authoring  |
| Question Types   | `src/components/questions/`                             | All 15 question type renderers |

---

## 6. Org/B2B Model

### 6.1 Current State

The org/B2B model is **partially implemented** with core data structures in
place but access control and UI partially complete.

#### What's Built

| Feature                                          | Status                       |
| ------------------------------------------------ | ---------------------------- |
| `orgs` Firestore collection                      | ✅ Complete                  |
| `orgGroups` for course grouping                  | ✅ Complete                  |
| `userOrgs` membership records                    | ✅ Complete                  |
| `userRoles` (global roles)                       | ✅ Complete                  |
| OrgAdmin page in main app (`/orgs/:orgId/admin`) | ✅ Basic UI                  |
| OrgsPage (public listing + join by code)         | ✅ Basic UI                  |
| Course `orgId` / `orgGroupIds` fields            | ✅ Schema done               |
| Org-based course access control                  | 🔶 Partial — not fully wired |
| Org Admin Dashboard (separate app)               | 🔶 Designed, not built       |
| Role management by org admins                    | 🔶 Partial                   |

#### Org Hierarchy (Current)

```
Organization (OrgDTO)
├── OrgGroups (OrgGroupDTO)
│   └── Courses (CourseDTO with orgId)
│       └── StoryPoints → Items
└── Members (UserOrgRecord)
    └── Roles: ['admin', 'tutor', 'course_admin']
```

### 6.2 Target Org Model (Planned)

#### Join Flow (Target)

```
User → enter join code or click invite link
     → UserOrgsService.joinOrg(userId, orgId)
     → userOrgs document created
     → Access to ALL org courses (no individual redemption)
```

#### Access Control (Target)

```typescript
const hasAccess =
  userInventory.includes(courseId) || // B2C legacy
  userOrgMemberships.some((m) => m.orgId === course.orgId); // B2B new
```

#### Planned Org Admin Dashboard (`apps/org-admin`)

**Pages**:

- `/` — Dashboard (DAU, courses, avg completion, recent activity)
- `/courses` — Manage org courses (create, list, filter)
- `/courses/:courseId` — Course analytics (tabs: Overview, Analytics, Students,
  Content, AI Agents)
- `/members` — Membership management (add, role management)
- `/members/:userId` — Individual student progress drill-down
- `/analytics` — Org-wide analytics (DAU charts, funnels, leaderboards)
- `/settings` — Org info, join code, groups, admin management
- `/subscription` — Plan status, seat usage (read-only)

#### Analytics Model (Planned, Cloud Function–computed)

```
orgAnalytics/{orgId}_{date}
  - totalMembers, activeMembers, newMembers
  - totalCourses, activeCourses
  - totalSubmissions, avgScore, avgCompletionRate
  - courseMetrics: { courseId → metrics }
  - topStudents: [{ userId, userName, pointsEarned }]

courseAnalytics/{courseId}_{date}
  - enrollment funnel (not started, in progress, completed)
  - storyPointMetrics, itemMetrics
  - avgTimeToComplete, avgScore
```

### 6.3 Multi-School/Multi-Org Gaps

- **No School > Class hierarchy** — current model is flat (Org > Groups >
  Courses)
- **No Teacher role** distinct from CourseAdmin
- **No Student roster management** (bulk import from CSV)
- **No SAML/SSO** for enterprise auth
- **No subscription/billing management** (planned but not built)
- **No LMS integrations** (Canvas, Moodle, etc.)
- **No Student-to-Teacher messaging**

---

## 7. Integration Points

### 7.0 Redemption Code System

LevelUp uses a **dual code model** for B2C course access:

| Code Type        | Reusability              | Tracking                      |
| ---------------- | ------------------------ | ----------------------------- |
| **Master Code**  | Multiple uses, unlimited | Tracks all users who redeemed |
| **Regular Code** | Single use, single user  | One-time grant only           |

**Flow**: `RedemptionService.redeem(code, uid)` → validates code →
`UserCourseInventoryService.add(userId, courseId, 'redeem')` → records in
`user_courses` → tracks metrics

---

### 7.1 Firebase (Primary Backend)

| Service                      | Usage                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| **Firestore**                | Primary data store — all collections (users, courses, items, progress, sessions, orgs, etc.) |
| **Realtime Database (RTDB)** | High-frequency writes — WillApp habit progress, live leaderboards                            |
| **Firebase Auth**            | Authentication (email/password, Google OAuth)                                                |
| **Firebase Storage**         | Image/file uploads (thumbnails, question images)                                             |
| **Cloud Functions**          | AI evaluation calls, analytics computation, server-side validation                           |
| **Firebase Hosting**         | App hosting (multiple targets: main, admin, org-admin)                                       |

### 7.2 AI / LLM

| Component                   | Usage                                                                        |
| --------------------------- | ---------------------------------------------------------------------------- |
| **Gemini / Claude**         | Question evaluation (text, descriptive, image, audio), AI tutoring chat      |
| **AnswerEvaluationService** | Centralized evaluation functions for all AI-graded question types            |
| **AgentResolver**           | Resolves which evaluator agent to use (question-level → course-level → none) |
| **EvaluationContext**       | Carries agent, media context, temperature settings to evaluation functions   |

**AI Evaluation Supported Types**: | Question Type | Evaluation Function |
Supports Objectives |
|--------------|---------------------|---------------------| | Text/short answer
| `evaluateShortOrDescriptiveAnswer()` | No | | Descriptive |
`evaluateDescriptiveWithObjectives()` | Yes | | Image evaluation |
`evaluateImageAnswerWithObjectives()` | Yes | | Audio recording |
`evaluateAudioAnswer()` | No |

**Dual Evaluation System**: When an evaluator agent has `evaluationObjectives`,
results show two separate scores: "Question X/Y" (question-defined criteria) +
"Agent X/Y" (agent-defined criteria).

### 7.3 Analytics

| Component                    | Usage                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------- |
| **Recharts**                 | Data visualization (bar, line, area, pie, radar, scatter, heatmap charts)         |
| **VisualAnalyticsDashboard** | 6-tab results analytics for timed tests                                           |
| **AdvancedInsightsPanel**    | AI-powered pattern detection (7 categories, learning paths)                       |
| **MetricsService**           | Tracks course views, story point views, item views, submissions                   |
| **ItemAnalytics**            | Per-item analytics dimensions (difficulty, topic, Bloom's, skill, cognitive load) |

### 7.4 Content Rendering

| Component            | Usage                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| **LaTeX Rendering**  | Math equations via KaTeX/MathJax                                              |
| **Rich Text Editor** | Blog-style material authoring (heading, paragraph, image, code, video blocks) |
| **PDF Churner**      | PDF to question extraction pipeline (scripts)                                 |
| **Image Caching**    | `ImageCacheService.ts` — caches images for performance                        |

---

## 8. Key Strengths

### Architecture

- **Flexible Item System**: Single `ItemDTO` with typed payloads handles 7
  content types and 15 question types
- **Feature-Based Structure**: Self-contained feature modules (questions,
  story-point, timed-test) with own components, hooks, and utilities
- **Service Layer**: Clean separation — all Firestore access via typed services
- **Type Safety**: Comprehensive TypeScript with Zod validation schemas

### Content & Learning

- **Rich Content Authoring**: Blog-style rich content editor with 9 block types
  (competing with Medium)
- **15 Question Types**: Covers MCQ, code, fill-blanks, matching, jumbled,
  audio, image evaluation, group options, chat-agent
- **Bloom's Taxonomy Integration**: Items tagged with cognitive levels for deep
  analytics
- **Previous Year Questions (PYQ)**: Built-in PYQ tracking for competitive exam
  prep

### AI Integration

- **AI Tutor Chat**: Context-aware, multi-language AI tutor with agent selection
- **AI Evaluation**: Multi-modal evaluation (text, images, audio) with custom
  objectives
- **Dual Evaluation**: Question objectives + agent objectives shown separately
- **Evaluator Agent Hierarchy**: Question-level → Course-level → Default

### Testing

- **Timed Tests**: Full test-taking experience with server-side timing,
  auto-submit, multi-attempt tracking
- **Visual Analytics**: 15+ chart types, 7 insight categories, 3-phase learning
  paths
- **Mock Tests**: Separate mock test system with identical features
- **Practice Range**: PYQ-focused flat item list with RTDB-backed fast progress

### Org Model

- **Multi-Org Support**: Users can be admins of multiple organizations
- **Role Hierarchy**: SuperAdmin → OrgAdmin → CourseAdmin → Member
- **Flexible Grouping**: OrgGroups allow course organization (Grade 10, Semester
  1, etc.)

---

## 9. Key Limitations & Gaps

### B2B / Org Model Gaps

| Gap                                       | Severity | Notes                                                     |
| ----------------------------------------- | -------- | --------------------------------------------------------- |
| No School > Class hierarchy               | High     | Flat Org model; no Teacher/Student classroom relationship |
| No Teacher role distinct from CourseAdmin | High     | Teachers need different UX than content admins            |
| No student bulk import                    | Medium   | No CSV upload for student enrollment                      |
| No SAML/SSO                               | Medium   | Required for enterprise school IT                         |
| Org access control partially wired        | High     | `useAccessControl` not updated for org-based access       |
| No org-level subscription/billing         | Medium   | Seat management planned but not built                     |
| Org Admin Dashboard not built             | High     | Only designed; `apps/org-admin` is planned                |

### Analytics Gaps

| Gap                            | Severity | Notes                                            |
| ------------------------------ | -------- | ------------------------------------------------ |
| No pre-computed org analytics  | High     | Would require Cloud Functions for aggregation    |
| No cohort analysis             | Medium   | Designed but not implemented                     |
| No LMS-style gradebook         | Medium   | No export to CSV/PDF for grades                  |
| Analytics only for timed tests | Medium   | No aggregated analytics for story point learning |
| No real-time active user count | Low      | RTDB integration possible but not done           |

### Content & UX Gaps

| Gap                                              | Severity | Notes                                         |
| ------------------------------------------------ | -------- | --------------------------------------------- |
| No drag-and-drop item reordering in story points | Medium   | Manual order index editing                    |
| No course content preview for admins             | Medium   | No "preview as student" mode                  |
| No bulk item import                              | Medium   | Items created one-by-one                      |
| Discussion and Project item types                | Low      | Types defined but renderers likely incomplete |
| Checkpoint and Interactive types                 | Low      | Types defined but renderers likely incomplete |
| WillApp uses mock data                           | High     | Firebase integration not completed per doc    |

### Architecture Gaps

| Gap                                     | Severity | Notes                                          |
| --------------------------------------- | -------- | ---------------------------------------------- |
| TimedTest and MockTest duplication      | Low      | Identical schemas; two separate collections    |
| Legacy QuestionDTO not fully deprecated | Low      | Old service still exists alongside new ItemDTO |
| Missing teacher-student messaging       | Medium   | No in-app communication system                 |
| No notification system                  | Medium   | No email/push notifications for events         |
| No scheduled/recurring assessments      | Medium   | Tests are on-demand only                       |

---

## 10. Firestore Collections Reference

| Collection               | Key                         | Description                                      |
| ------------------------ | --------------------------- | ------------------------------------------------ |
| `users`                  | userId                      | User profiles                                    |
| `userRoles`              | userId                      | Global roles (superAdmin, orgAdmin, courseAdmin) |
| `courses`                | courseId                    | Course catalog                                   |
| `user_courses`           | `${userId}_${courseId}`     | B2C course inventory                             |
| `storyPoints`            | storyPointId                | Story points within courses                      |
| `items`                  | itemId                      | All learning content items                       |
| `userStoryPointProgress` | `${userId}_${storyPointId}` | Detailed progress per user per story point       |
| `attempts`               | attemptId                   | Individual submission attempts                   |
| `chatSessions`           | sessionId                   | AI tutor conversation history                    |
| `timedTestSessions`      | sessionId                   | Timed test attempts                              |
| `mockTestSessions`       | sessionId                   | Mock test attempts (identical schema)            |
| `course_agents`          | agentId                     | AI tutor and evaluator agents                    |
| `redemptionCodes`        | codeId                      | Access codes for courses                         |
| `leaderboards`           | composite                   | Course/story point leaderboards                  |
| `orgs`                   | orgId                       | Organizations                                    |
| `orgGroups`              | groupId                     | Course groups within orgs                        |
| `userOrgs`               | `${userId}_${orgId}`        | User-org membership records                      |
| `practiceRangeItems`     | itemId                      | Practice range content                           |
| `orgAnalytics`           | `${orgId}_${date}`          | Pre-computed org analytics (planned)             |
| `courseAnalytics`        | `${courseId}_${date}`       | Pre-computed course analytics (planned)          |
| `activityLog`            | auto                        | User activity events (planned)                   |
| `orgSubscriptions`       | orgId                       | Org subscription status (planned)                |

**Realtime Database (RTDB)**:

| RTDB Path                                                      | Description                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| `userCourseProgress/{userId}/{courseId}`                       | Real-time course progress (points, percentage, tier counts) |
| `storyPointLeaderboard/{storyPointId}`                         | Story point rankings                                        |
| `courseLeaderboard/{courseId}`                                 | Course-level leaderboard                                    |
| `userStoryPointProgress/{userId}/{storyPointId}`               | Story point completion flags                                |
| `habitProgress/{userId}/{date}/{habitId}`                      | WillApp: daily habit logs (high-frequency)                  |
| `dailyStats/{userId}/{date}`                                   | WillApp: daily summary stats                                |
| Practice range: `practiceProgress/{userId}/{spaceId}/{itemId}` | Practice item status (fast writes)                          |

---

## Summary

LevelUp is a **feature-rich consumer learning platform** that has been evolving
toward B2B. Its **core strengths** are:

- Flexible item-based content model (15 question types, 7 content types)
- Rich AI tutoring and evaluation (multi-modal, custom agents)
- Complete timed test experience with deep analytics
- Well-structured service layer and TypeScript type system

Its **primary gaps** for the unified AutoGrade platform are:

- Org hierarchy doesn't have School → Class → Student depth
- No distinct Teacher role
- Org-based access control not fully wired
- No pre-computed org analytics
- Org Admin Dashboard not yet built
- No gradebook / LMS-standard reporting

---

_Document generated by: LevelUp Expert (Phase 1B)_ _Based on: Full codebase
analysis of `/Users/subhang/Desktop/Projects/auto-levleup/LevelUp-App`_
