# Phase 1A: AutoGrade Full Feature & Domain Extraction

**Date**: 2026-02-19 **Analyst**: AutoGrade Expert (Maestro Worker) **Source
Codebase**: `/Users/subhang/Desktop/Projects/auto-levleup/autograde`
**Purpose**: Complete domain extraction for LevelUp integration planning

---

## Table of Contents

1. [System Overview & Business Model](#1-system-overview--business-model)
2. [Domain Entities — Full Field Listings](#2-domain-entities--full-field-listings)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Feature Workflows](#4-feature-workflows)
5. [UI Screens & Pages](#5-ui-screens--pages)
6. [B2B Multi-Tenancy Model](#6-b2b-multi-tenancy-model)
7. [Integration Points](#7-integration-points)
8. [Architecture Strengths](#8-architecture-strengths)
9. [Key Pain Points & Limitations](#9-key-pain-points--limitations)
10. [LevelUp Integration Surface](#10-levelup-integration-surface)

---

## 1. System Overview & Business Model

AutoGrade is a **B2B SaaS exam management and AI-powered grading platform**
built on Firebase/Firestore. It targets schools (called "clients") and provides:

- **Answer sheet digitization** via scanner devices or direct upload
- **AI-powered grading** using Google Gemini models
- **Structured feedback** for students and parents
- **Multi-role access**: Super Admin → Client Admin → Teacher → Student → Parent

### Technology Stack

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| Frontend       | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend        | Firebase Cloud Functions (Node.js)          |
| Database       | Firebase Firestore (NoSQL)                  |
| Auth           | Firebase Authentication + Custom Claims     |
| Storage        | Firebase Cloud Storage                      |
| AI/LLM         | Google Gemini 2.5 Flash / Pro               |
| PDF Processing | pdfjs-dist (client-side)                    |
| Monorepo       | NPM Workspaces                              |

### Applications

| App                 | Purpose                                                                              | Port |
| ------------------- | ------------------------------------------------------------------------------------ | ---- |
| `apps/client-admin` | School admin, teacher, student, parent portal                                        | 3000 |
| `apps/super-admin`  | Platform operator dashboard                                                          | 3001 |
| `apps/scanner-app`  | Mobile PWA for physical scanner devices                                              | —    |
| `developer-admin/`  | Internal developer tools for platform administration (separate app outside monorepo) | —    |

### Shared Packages

| Package             | Contents                               |
| ------------------- | -------------------------------------- |
| `packages/types`    | Shared Firestore type definitions      |
| `packages/firebase` | Shared Firestore/Storage query helpers |
| `packages/ui`       | Shared UI component library            |
| `packages/utils`    | Shared utilities                       |

---

## 2. Domain Entities — Full Field Listings

### Firestore Collection Layout

```
Root-level:
  /clients                        → Client
  /users                          → User (auth identity)
  /userMemberships                → UserMembership
  /scanners                       → Scanner
  /evaluationSettings             → EvaluationFeedbackRubric (global presets)
  /llm-usage                      → LLMUsageLog

Client-scoped (all data isolated per school):
  /clients/{clientId}/classes     → Class
  /clients/{clientId}/students    → Student
  /clients/{clientId}/teachers    → Teacher
  /clients/{clientId}/parents     → Parent
  /clients/{clientId}/exams       → Exam
  /clients/{clientId}/submissions → Submission
  /clients/{clientId}/evaluationSettings → EvaluationFeedbackRubric

Subcollections:
  /clients/{clientId}/exams/{examId}/questions                                  → Question
  /clients/{clientId}/submissions/{submissionId}/questionSubmissions             → QuestionSubmission
```

---

### Entity: Client (Tenant)

_Collection_: `/clients/{clientId}` _Represents_: A school or school group — the
top-level billing/isolation boundary.

| Field                          | Type                                              | Notes                                              |
| ------------------------------ | ------------------------------------------------- | -------------------------------------------------- |
| `id`                           | string                                            | Firestore auto-ID                                  |
| `name`                         | string                                            | School full name                                   |
| `schoolCode`                   | string                                            | Unique short code (e.g., "SCH001"), used for login |
| `email`                        | string                                            | Admin contact email                                |
| `adminUid`                     | string                                            | Firebase Auth UID of the client admin              |
| `geminiApiKey`                 | string                                            | Client's own Gemini API key (stored encrypted)     |
| `status`                       | `'active' \| 'suspended' \| 'trial' \| 'expired'` | Account status                                     |
| `subscriptionPlan`             | `'trial' \| 'basic' \| 'premium'`                 | Billing tier                                       |
| `createdAt`                    | Timestamp                                         |                                                    |
| `updatedAt`                    | Timestamp                                         |                                                    |
| `metadata`                     | `{ address?, phone?, contactPerson? }`            | Optional contact info                              |
| `defaultEvaluationSettingsId?` | string                                            | Default eval settings for this client              |
| `stats?`                       | `{ totalStudents, totalTeachers, totalExams }`    | Denormalized counts                                |

---

### Entity: Class

_Collection_: `/clients/{clientId}/classes/{classId}` _Represents_: A section or
cohort within a school (e.g., "Grade 10 - Section A - Math").

| Field          | Type      | Notes                          |
| -------------- | --------- | ------------------------------ |
| `id`           | string    |                                |
| `clientId`     | string    | Parent client                  |
| `name`         | string    | Display name                   |
| `subject`      | string    | Subject (e.g., "Mathematics")  |
| `academicYear` | string    | e.g., "2024-2025"              |
| `grade?`       | string    | Grade level                    |
| `section?`     | string    | Section identifier             |
| `teacherIds?`  | string[]  | Assigned teachers              |
| `createdBy`    | string    | adminUid who created it        |
| `createdAt`    | Timestamp |                                |
| `updatedAt?`   | Timestamp |                                |
| `studentCount` | number    | Denormalized for quick display |

---

### Entity: Student

_Collection_: `/clients/{clientId}/students/{studentId}`

| Field           | Type                                    | Notes                                             |
| --------------- | --------------------------------------- | ------------------------------------------------- |
| `id`            | string                                  |                                                   |
| `clientId`      | string                                  |                                                   |
| `authUid?`      | string                                  | Firebase Auth UID (nullable for non-app students) |
| `email?`        | string                                  | Login email                                       |
| `phone?`        | string                                  | Login phone (alternative to email)                |
| `tempPassword?` | string                                  | Initial generated password                        |
| `firstName`     | string                                  |                                                   |
| `lastName`      | string                                  |                                                   |
| `rollNumber`    | string                                  | Unique within client                              |
| `classIds`      | string[]                                | Can belong to multiple classes                    |
| `parentIds`     | string[]                                | Linked parent accounts                            |
| `createdAt`     | Timestamp                               |                                                   |
| `lastLogin?`    | Timestamp                               |                                                   |
| `status`        | `'active' \| 'inactive' \| 'graduated'` |                                                   |
| `metadata?`     | `{ dateOfBirth?, address? }`            |                                                   |

---

### Entity: Teacher

_Collection_: `/clients/{clientId}/teachers/{teacherId}`

| Field           | Type                           | Notes                       |
| --------------- | ------------------------------ | --------------------------- |
| `id`            | string                         |                             |
| `clientId`      | string                         |                             |
| `authUid?`      | string                         | Firebase Auth UID           |
| `email?`        | string                         |                             |
| `phone?`        | string                         |                             |
| `tempPassword?` | string                         |                             |
| `firstName`     | string                         |                             |
| `lastName`      | string                         |                             |
| `classIds`      | string[]                       | Assigned classes            |
| `subjects`      | string[]                       | Subjects they teach         |
| `phone?`        | string                         |                             |
| `employeeId?`   | string                         | School-specific employee ID |
| `createdAt`     | Timestamp                      |                             |
| `lastLogin?`    | Timestamp                      |                             |
| `status`        | `'active' \| 'inactive'`       |                             |
| `metadata?`     | `{ employeeId?, department? }` |                             |

---

### Entity: Parent

_Collection_: `/clients/{clientId}/parents/{parentId}`

| Field           | Type                     | Notes             |
| --------------- | ------------------------ | ----------------- |
| `id`            | string                   |                   |
| `clientId`      | string                   |                   |
| `authUid?`      | string                   | Firebase Auth UID |
| `email?`        | string                   |                   |
| `phone?`        | string                   |                   |
| `tempPassword?` | string                   |                   |
| `firstName`     | string                   |                   |
| `lastName`      | string                   |                   |
| `studentIds`    | string[]                 | Linked children   |
| `createdAt`     | Timestamp                |                   |
| `lastLogin?`    | Timestamp                |                   |
| `status`        | `'active' \| 'inactive'` |                   |

---

### Entity: Exam

_Collection_: `/clients/{clientId}/exams/{examId}` _Key architectural note_:
Exams are root-level under the client (NOT nested under classes), allowing one
exam to be assigned to multiple classes.

| Field                   | Type                                                                                       | Notes                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `id`                    | string                                                                                     |                                                                                |
| `clientId`              | string                                                                                     |                                                                                |
| `classIds`              | string[]                                                                                   | Multiple classes can share one exam                                            |
| `title`                 | string                                                                                     | Exam display name                                                              |
| `subject`               | string                                                                                     |                                                                                |
| `topics`                | string[]                                                                                   | Topic tags                                                                     |
| `examDate`              | Timestamp                                                                                  |                                                                                |
| `duration`              | number                                                                                     | Minutes                                                                        |
| `totalMarks`            | number                                                                                     |                                                                                |
| `passingMarks`          | number                                                                                     |                                                                                |
| `createdAt`             | Timestamp                                                                                  |                                                                                |
| `updatedAt?`            | Timestamp                                                                                  |                                                                                |
| `status`                | `'draft' \| 'question_paper_uploaded' \| 'in_progress' \| 'completed'`                     | Lifecycle state                                                                |
| `questionPaper?`        | `{ images: string[]; extractedAt: Timestamp; questionCount: number }`                      | Uploaded paper metadata                                                        |
| `questionPaperType?`    | `QuestionPaperType`                                                                        | `'standard' \| 'integrated-diagram-heavy' \| 'high-volume' \| 'manual-rubric'` |
| `typeConfig?`           | object                                                                                     | Config for specific exam types                                                 |
| `gradingConfig`         | `{ autoGrade: boolean; allowRubricEdit: boolean; customRubrics?: Record<string, Rubric> }` |                                                                                |
| `evaluationSettingsId?` | string                                                                                     | Override evaluation settings for this exam                                     |

---

### Entity: Question

_Collection_: `/clients/{clientId}/exams/{examId}/questions/{questionId}`
_Stored separately from Exam document to avoid 1MB Firestore limit._

| Field                 | Type                                                               | Notes                                      |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `id`                  | string                                                             |                                            |
| `examId`              | string                                                             |                                            |
| `text`                | string                                                             | Question text (may contain LaTeX)          |
| `maxMarks`            | number                                                             |                                            |
| `order`               | number                                                             | Display order                              |
| `rubric`              | Rubric                                                             | Evaluation criteria                        |
| `type?`               | `QuestionType`                                                     | `'standard' \| 'mcq' \| 'diagram-heavy'`   |
| `createdAt`           | Timestamp                                                          |                                            |
| `pageIndex?`          | number                                                             | For Type 2 (which page the question is on) |
| `questionType?`       | `'matching' \| 'labeling' \| 'fill-blank' \| 'diagram-completion'` | Type 2 sub-type                            |
| `diagramDescription?` | string                                                             | For diagram-heavy questions                |
| `expectedElements?`   | string[]                                                           | What should be in the visual answer        |
| `evaluationGuidance?` | string                                                             | AI instructions for evaluation             |
| `rubricSource?`       | string                                                             | For manual rubric type                     |
| `completeAnswer?`     | string                                                             | Model answer                               |
| `rubricPages?`        | string[]                                                           | Images of rubric pages                     |

**Rubric sub-types:**

```typescript
interface Rubric {
  criteria: RubricCriterion[];
}

interface RubricCriterion {
  description: string;
  marks: number;
}
```

---

### Entity: Submission

_Collection_: `/clients/{clientId}/submissions/{submissionId}` _Represents_: One
student's attempt at one exam.

| Field             | Type                                                                                                   | Notes                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `id`              | string                                                                                                 |                                      |
| `clientId`        | string                                                                                                 |                                      |
| `examId`          | string                                                                                                 |                                      |
| `studentId`       | string                                                                                                 |                                      |
| `studentName`     | string                                                                                                 | Denormalized                         |
| `rollNumber`      | string                                                                                                 | Denormalized                         |
| `classId`         | string                                                                                                 | Which class this student belongs to  |
| `answerSheets`    | `{ images: string[]; uploadedAt: Timestamp; uploadedBy: string }`                                      | Storage URLs                         |
| `scoutingResult?` | `{ routingMap: Record<string, number[]>; completedAt: Timestamp }`                                     | Question→page mapping                |
| `summary`         | `{ totalScore, maxScore, percentage, grade, status, questionsGraded?, totalQuestions?, completedAt? }` |                                      |
| `gradingResults?` | `Record<string, GradingResult>`                                                                        | Per-question results (legacy inline) |
| `createdAt`       | Timestamp                                                                                              |                                      |

**Submission status values**:
`'pending' \| 'scouting' \| 'grading' \| 'completed' \| 'failed'`

---

### Entity: QuestionSubmission

_Collection_:
`/clients/{clientId}/submissions/{submissionId}/questionSubmissions/{questionId}`
_Represents_: The evaluation of one question within a student's submission.

| Field          | Type                                                                              | Notes                     |
| -------------- | --------------------------------------------------------------------------------- | ------------------------- |
| `id`           | string                                                                            | Same as questionId        |
| `submissionId` | string                                                                            |                           |
| `questionId`   | string                                                                            |                           |
| `examId`       | string                                                                            |                           |
| `mapping`      | `{ pageIndices: number[]; imageUrls: string[]; scoutedAt: Timestamp }`            | Which pages answer this Q |
| `evaluation?`  | QuestionEvaluation (see below)                                                    | AI grading result         |
| `status`       | `'scouted' \| 'mapped' \| 'grading' \| 'graded' \| 'failed' \| 'manual_override'` |                           |
| `createdAt`    | Timestamp                                                                         |                           |
| `updatedAt`    | Timestamp                                                                         |                           |

**QuestionEvaluation fields:**

| Field                     | Type                                  |
| ------------------------- | ------------------------------------- |
| `score`                   | number                                |
| `maxScore`                | number                                |
| `strengths`               | string[]                              |
| `weaknesses`              | string[]                              |
| `missingConcepts`         | string[]                              |
| `rubricBreakdown`         | `RubricScore[]`                       |
| `aiReasoning?`            | string                                |
| `gradedAt`                | Timestamp                             |
| `structuredFeedback?`     | `Record<dimensionId, FeedbackItem[]>` |
| `summary?`                | `{ keyTakeaway, overallComment }`     |
| `confidence_score?`       | number                                |
| `mistake_classification?` | string                                |
| `evaluationRubricId?`     | string                                |
| `dimensionsUsed?`         | string[]                              |
| `tokensUsed?`             | `{ input, output }`                   |
| `cost?`                   | number                                |

---

### Entity: EvaluationFeedbackRubric

_Collections_: `/evaluationSettings/{id}` (global presets) and
`/clients/{clientId}/evaluationSettings/{id}` (client-specific)

| Field               | Type                                                         | Notes                            |
| ------------------- | ------------------------------------------------------------ | -------------------------------- |
| `id`                | string                                                       |                                  |
| `clientId`          | string                                                       | null for global presets          |
| `name`              | string                                                       |                                  |
| `description?`      | string                                                       |                                  |
| `isDefault`         | boolean                                                      |                                  |
| `isPublic?`         | boolean                                                      |                                  |
| `enabledDimensions` | `FeedbackDimension[]`                                        | Which feedback dimensions to use |
| `displaySettings`   | `{ showStrengths, showKeyTakeaway, prioritizeByImportance }` |                                  |
| `createdAt`         | Timestamp                                                    |                                  |
| `updatedAt`         | Timestamp                                                    |                                  |
| `createdBy?`        | string                                                       |                                  |

**Default Feedback Dimensions** (4 built-in):

1. **Critical Issues** (HIGH priority) — Technical accuracy, missing concepts,
   conceptual errors
2. **Structure & Flow** (MEDIUM) — Organization, logical progression
3. **Clarity & Communication** (MEDIUM) — Presentation, notation, units
4. **Completeness** (HIGH) — Coverage of all parts, verification steps

---

### Entity: User (Auth Identity)

_Collection_: `/users/{uid}`

| Field              | Type                 | Notes                 |
| ------------------ | -------------------- | --------------------- |
| `uid`              | string               | Firebase Auth UID     |
| `email?`           | string               |                       |
| `phone?`           | string               |                       |
| `authProvider`     | `'email' \| 'phone'` |                       |
| `currentClientId?` | string               | Active client context |
| `createdAt`        | Timestamp            |                       |
| `lastLogin?`       | Timestamp            |                       |

---

### Entity: UserMembership

_Collection_: `/userMemberships/{id}` (id = `${uid}_${clientId}`) _Enables_: A
single Firebase Auth user to belong to multiple clients.

| Field            | Type                                                               | Notes                                 |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `id`             | string                                                             | `${uid}_${clientId}`                  |
| `uid`            | string                                                             | Firebase Auth UID                     |
| `clientId`       | string                                                             |                                       |
| `schoolCode`     | string                                                             | For login verification                |
| `role`           | `'clientAdmin' \| 'teacher' \| 'student' \| 'parent' \| 'scanner'` |                                       |
| `status`         | `'active' \| 'inactive' \| 'suspended'`                            |                                       |
| `clientAdminId?` | string                                                             | Links to /clients/{clientId} admin    |
| `teacherId?`     | string                                                             | Links to teacher document             |
| `studentId?`     | string                                                             | Links to student document             |
| `parentId?`      | string                                                             | Links to parent document              |
| `scannerId?`     | string                                                             | Links to scanner device               |
| `permissions?`   | object                                                             | Teacher-specific permission overrides |
| `createdAt`      | Timestamp                                                          |                                       |
| `lastActive`     | Timestamp                                                          |                                       |

---

### Entity: Scanner

_Collection_: `/scanners/{scannerId}` _Represents_: A physical scanner device
registered to a client.

| Field           | Type                     | Notes                                |
| --------------- | ------------------------ | ------------------------------------ |
| `id`            | string                   |                                      |
| `authUid?`      | string                   | Firebase Auth UID for device account |
| `clientId`      | string                   | Which school owns this device        |
| `username`      | string                   | Scanner login username               |
| `tempPassword?` | string                   |                                      |
| `firstName`     | string                   | Device name/label                    |
| `lastName`      | string                   |                                      |
| `status`        | `'active' \| 'inactive'` |                                      |
| `createdAt`     | Timestamp                |                                      |
| `updatedAt?`    | Timestamp                |                                      |

---

### Entity: LLMUsageLog

_Collection_: `/llm-usage/{logId}` _Purpose_: Track all Gemini API calls for
cost accounting and debugging.

| Field              | Type                              |
| ------------------ | --------------------------------- |
| `clientId`         | string                            |
| `userId`           | string                            |
| `userRole`         | string                            |
| `purpose`          | string                            |
| `operation`        | string                            |
| `resourceType`     | string                            |
| `resourceId`       | string                            |
| `provider`         | string                            |
| `model`            | string                            |
| `temperature?`     | number                            |
| `maxTokens?`       | number                            |
| `hasImages`        | boolean                           |
| `imageCount?`      | number                            |
| `promptLength`     | number                            |
| `tokens`           | `{ input, output, total }`        |
| `cost`             | `{ input, output, total }`        |
| `timing`           | `{ latencyMs, tokensPerSecond? }` |
| `success`          | boolean                           |
| `finishReason?`    | string                            |
| `error?`           | string                            |
| `createdAt`        | Timestamp                         |
| `callStartedAt`    | Timestamp                         |
| `callCompletedAt?` | Timestamp                         |
| `tags?`            | string[]                          |
| `notes?`           | string                            |

---

## 3. User Roles & Permissions

### Role Hierarchy

```
Super Admin (Platform Operator)
  └── Client Admin (School Admin)
        ├── Teacher
        ├── Student
        └── Parent
              (linked to Student)
Scanner Device (Special device account)
```

### Role Capabilities Matrix

| Capability                 | Super Admin | Client Admin |   Teacher    | Student | Parent | Scanner |
| -------------------------- | :---------: | :----------: | :----------: | :-----: | :----: | :-----: |
| Create/manage clients      |     ✅      |      ❌      |      ❌      |   ❌    |   ❌   |   ❌    |
| Assign Gemini API keys     |     ✅      |      ❌      |      ❌      |   ❌    |   ❌   |   ❌    |
| View platform analytics    |     ✅      |      ❌      |      ❌      |   ❌    |   ❌   |   ❌    |
| Suspend clients            |     ✅      |      ❌      |      ❌      |   ❌    |   ❌   |   ❌    |
| Manage classes             |     ✅      |      ✅      |      ❌      |   ❌    |   ❌   |   ❌    |
| Bulk import students       |     ✅      |      ✅      |      ❌      |   ❌    |   ❌   |   ❌    |
| Create/manage exams        |     ✅      |      ✅      |   Partial    |   ❌    |   ❌   |   ❌    |
| Upload answer sheets       |     ✅      |      ✅      |   Partial    |   ❌    |   ❌   |   ✅    |
| Grade submissions          |     ✅      |      ✅      |   Partial    |   ❌    |   ❌   |   ❌    |
| View all students' results |     ✅      |      ✅      | Class-scoped |   ❌    |   ❌   |   ❌    |
| View own results           |      —      |      —       |      —       |   ✅    |   ❌   |   ❌    |
| View child's results       |      —      |      —       |      —       |   ❌    |   ✅   |   ❌    |
| Configure eval settings    |     ✅      |      ✅      |      ❌      |   ❌    |   ❌   |   ❌    |
| Manage scanner devices     |     ✅      |      ✅      |      ❌      |   ❌    |   ❌   |   ❌    |

### Firebase Auth Custom Claims Structure

```typescript
// Super Admin
{ role: 'superAdmin' }

// Client Admin
{ role: 'clientAdmin', clientId: 'xxx', schoolCode: 'SCH001' }

// Teacher
{ role: 'teacher', clientId: 'xxx', schoolCode: 'SCH001', teacherId: 'yyy', classIds: ['c1','c2'] }

// Student
{ role: 'student', clientId: 'xxx', schoolCode: 'SCH001', studentId: 'zzz' }

// Parent
{ role: 'parent', clientId: 'xxx', schoolCode: 'SCH001', parentId: 'ppp', studentIds: ['s1','s2'] }

// Scanner
{ role: 'scanner', clientId: 'xxx', schoolCode: 'SCH001', scannerId: 'sc1' }
```

### Authentication Flow (School-Code Based)

1. User visits login page
2. **Step 1**: Enters school code (e.g., `SCH001`)
3. System verifies school code in Firestore
4. **Step 2**: User enters email/password (or phone/password)
5. Firebase Auth returns token with custom claims
6. Frontend reads role from claims → redirects to role-appropriate portal

---

## 4. Feature Workflows

### 4.1 Exam Lifecycle

```
DRAFT
  │  (Admin fills exam metadata)
  ▼
QUESTION_PAPER_UPLOADED
  │  (Admin uploads question paper PDF/images → AI extracts questions)
  ▼
IN_PROGRESS
  │  (Answer sheets being uploaded & graded)
  ▼
COMPLETED
     (All submissions graded, results available)
```

### 4.2 Question Extraction Pipeline (Type 1 — Standard)

**Trigger**: Admin uploads question paper PDF/images on CreateExam page

**Steps**:

1. Admin uploads question paper (PDF or images)
2. Files converted to images (client-side via pdfjs-dist or server-side)
3. Images uploaded to Firebase Cloud Storage
4. **Phase 0 (Blueprinting)**: `extractQuestionPaper` Cloud Function called
   - Fetches client's Gemini API key from Firestore
   - Sends images + prompt to Gemini 2.5 Flash
   - AI extracts: question text, max marks, rubric criteria, question order
5. Questions saved as subcollection under exam
6. Admin reviews and can edit questions/rubrics
7. Exam status advances to `question_paper_uploaded`

**Question Paper Types**:

- **Type 1 (Standard)**: Separate answer sheets, text-based answers, ~20
  subjective questions, full rubric generation
- **Type 2 (Integrated Diagram-Heavy)**: Students answer on question paper,
  visual responses (matching, labeling, fill-blank, diagram-completion), no
  rubric generation, cheaper
- **Type 3 (High Volume)**: High question count optimization
- **Type 4 (Manual Rubric)**: Admin uploads rubric pages manually

### 4.3 Answer Sheet Ingestion Pipeline

**Source**: Scanner device (mobile PWA) or direct admin upload

#### Via Scanner App:

1. Scanner operator logs in with school code + credentials
2. Selects exam from list
3. Selects student
4. Captures answer sheet pages (camera or file upload)
5. Images auto-compressed client-side
6. Uploaded to Cloud Storage at:
   `clients/{clientId}/exams/{examId}/submissions/{submissionId}/answer-sheets/`
7. Submission document created in Firestore

#### Via Admin Upload (Evaluate page):

1. Admin navigates to `/admin/evaluate`
2. Selects exam (filtered: has questions, not draft)
3. Selects student (filtered: enrolled in exam's classes)
4. Uploads answer sheet images
5. Submission created, scouting triggered automatically

### 4.4 Scouting/Mapping Pipeline (Type 1)

**Purpose**: Map exam answer pages to their respective questions (since students
write answers across multiple pages)

**"Panopticon" Scout Algorithm**:

```
For each uploaded page image:
  → Convert to base64
  → Send to Gemini Flash with question list
  → Gemini identifies: which questions are answered on this page
  → Returns array of question IDs

After all pages scouted:
  → Build routingMap: { questionId: [pageIndices] }
  → Apply "Sandwich Rule":
    - If Question X appears on pages 2 and 5,
      and pages 3-4 have no detected questions,
      then infer pages 3-4 also contain Question X
  → Save routingMap to Firestore submission
  → Create QuestionSubmission docs per question
  → Advance submission status
```

**Type 2 Mapping** (Zero-cost):

- Since students answer directly on question papers, page N question → page N
  answer
- Simple `simplePageMapping()` function, no LLM call, instant

### 4.5 AI Grading Pipeline

**Trigger**: Admin clicks "Grade All" or "Evaluate" on individual question

**Per-question grading steps**:

1. Fetch client's Gemini API key
2. Get answer page URLs for this question (from routingMap)
3. Convert image URLs to base64
4. Load client's EvaluationFeedbackRubric settings
5. Build dynamic RELMS evaluation prompt (based on enabled dimensions)
6. Call Gemini with: question text, rubric, answer images, evaluation prompt
7. Parse structured JSON response
8. Transform response → QuestionEvaluation format
9. Save to Firestore QuestionSubmission
10. Update status to `'graded'`
11. Log LLM usage to `/llm-usage`

**Type 2 Grading** (Visual evaluation):

- Uses `evaluateVisualAnswer()` function
- Sends: filled answer image + question context (type, expected elements,
  guidance)
- Does NOT need original question image
- Returns RELMS-compatible structured feedback

**RELMS Evaluation Output Format**:

```json
{
  "rubric_score": 8,
  "max_rubric_score": 10,
  "confidence_score": 0.92,
  "structuredFeedback": {
    "critical_issues": [{ "issue": "...", "whyItMatters": "...", "howToFix": "...", "severity": "critical" }],
    "structure_flow": [{ "issue": "...", "howToFix": "...", "severity": "minor" }]
  },
  "strengths": ["Clear diagram", "Correct units"],
  "summary": { "keyTakeaway": "...", "overallComment": "..." },
  "rubric_breakdown": [...],
  "mistake_classification": "Conceptual"
}
```

### 4.6 Bulk Student Onboarding

1. Admin downloads CSV template
2. Fills in: firstName, lastName, rollNumber, email/phone, classIds,
   parentEmail, parentFirstName, parentLastName
3. Uploads CSV to client admin portal
4. System previews import (student count, parent count)
5. On confirm:
   - Firebase Auth accounts created for students and parents
   - Temp passwords auto-generated
   - Custom claims set via Cloud Functions
   - Firestore documents created
   - Students linked to parents via `parentIds` / `studentIds`
6. Admin downloads credentials CSV to share

### 4.7 AI Tutor Chat (Experimental)

**Trigger**: Student or admin clicks chat interface (experimental feature, UI
presence unclear)

**Backend flow**:

1. Client calls `chatWithAI` Cloud Function with
   `(clientId, examId?, questionId?, message)`
2. Function optionally loads exam + question context from Firestore for
   grounding
3. Sends message + context to `gemini-2.5-flash-lite` (temperature: 0.7, max
   1024 tokens)
4. Returns AI response text
5. LLM usage logged to `/llm-usage`

**Use case**: Students asking follow-up questions about their exam results or
requesting explanation of concepts they got wrong.

### 4.8 Result Viewing

**Student flow**:

1. Login with school code + credentials
2. View `/student/exams` — list of all exams with scores
3. Click exam → `/student/submissions/:id` — question-by-question breakdown
4. See: score, grade, strengths, weaknesses, structured feedback

**Parent flow**:

1. Login → see linked children
2. Click child → see their exam list
3. Drill into any exam result

_Note_: Both Teacher and Parent portals have route definitions and placeholder
text but feature directories (`features/admin/teachers/` and
`features/admin/parents/`) are empty. Neither is implemented.

---

## 5. UI Screens & Pages

### 5.1 Client Admin Portal (`/admin/*`)

| Route                            | Screen                     | Purpose                                                                        |
| -------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `/login`                         | Login Page                 | 2-step: school code → email+password                                           |
| `/admin/dashboard`               | Dashboard                  | Stats: classes, students, exams, graded count                                  |
| `/admin/classes`                 | Classes List               | Grid/list of all classes                                                       |
| `/admin/classes/:id`             | Class Detail               | Tabs: Students, Exams enrolled in class                                        |
| `/admin/students`                | Students List              | All students, search/filter, bulk import button                                |
| `/admin/exams`                   | Exams List                 | All exams with status badges                                                   |
| `/admin/exams/new`               | Create Exam                | Multi-step: metadata → question paper upload → AI extraction → question review |
| `/admin/exams/:id`               | Exam Detail                | Tabs: Overview, Upload Answers, Results; submission status per student         |
| `/admin/exams/:id/edit`          | Exam Edit                  | Edit exam metadata and questions                                               |
| `/admin/exams/:id/grade`         | Submission Grading         | Grade all questions for a submission; view AI feedback                         |
| `/admin/evaluate`                | Evaluate (Legacy)          | Select exam+student, upload sheets, trigger scouting+grading                   |
| `/admin/scanners`                | Scanner Management         | List and manage scanner devices                                                |
| `/admin/settings/evaluation`     | Evaluation Settings List   | List all evaluation rubric configurations                                      |
| `/admin/settings/evaluation/:id` | Evaluation Settings Detail | Configure feedback dimensions, enable/disable, add custom                      |
| `/admin/teachers`                | Teachers                   | Teacher management (skeleton — empty feature directory, 0% implemented)        |
| `/admin/parents`                 | Parents                    | Parent management (skeleton — empty feature directory, 0% implemented)         |
| `/admin/submissions`             | Submissions                | (Coming Soon — route registered but no page)                                   |
| `/dev/cleanup-duplicates`        | Cleanup Duplicates         | Dev-only utility page for cleaning duplicate Firestore documents               |

### 5.2 Student Portal (`/student/*`)

| Route                      | Screen            | Purpose                                   |
| -------------------------- | ----------------- | ----------------------------------------- |
| `/student/dashboard`       | Student Dashboard | Overview stats                            |
| `/student/exams`           | My Exams          | List of all exams taken, with scores      |
| `/student/submissions`     | Submissions List  | All submissions                           |
| `/student/submissions/:id` | Submission Detail | Full question-by-question grading results |

### 5.3 Super Admin Portal (separate app)

| Route            | Screen             | Purpose                                                 |
| ---------------- | ------------------ | ------------------------------------------------------- |
| Dashboard        | Platform Dashboard | Total clients, students, exams graded                   |
| `/clients`       | Client List        | All schools, status, search/filter                      |
| `/clients/:id`   | Client Detail      | Stats, API usage, billing, recent activity              |
| Add Client Modal | Create School      | School name, admin email, Gemini key, subscription plan |

### 5.4 Scanner App (mobile PWA)

| Screen            | Purpose                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Login             | School code + scanner username/password                                                  |
| Dashboard         | Scanner overview, nav                                                                    |
| Exam Selection    | List exams for scanner's client                                                          |
| Student Selection | List students in exam's classes                                                          |
| Upload Page       | Camera capture or file upload of answer sheets; image compression + Cloud Storage upload |

### 5.5 Key UI Components

| Component                   | Location                 | Purpose                                             |
| --------------------------- | ------------------------ | --------------------------------------------------- |
| `QuestionCard`              | `components/questions/`  | Displays question with rubric (adapts for Type 1/2) |
| `StructuredFeedbackDisplay` | `components/evaluation/` | Rich feedback viewer with dimension sections        |
| `DashboardLayout`           | `components/layout/`     | Admin sidebar + header layout                       |
| `StudentLayout`             | `components/layout/`     | Student-specific layout                             |
| `ProtectedRoute`            | `components/shared/`     | Role-based route guard                              |

---

## 6. B2B Multi-Tenancy Model

### Hierarchy Diagram

```
Platform (AutoGrade)
  └── Super Admin (1 per platform)
        └── Clients/Schools (unlimited)
              ├── Client Admin (1 per school)
              ├── Teachers (many per school)
              │     └── Assigned to Classes
              ├── Classes (many per school)
              │     └── Multiple per exam possible
              ├── Students (many per school)
              │     ├── Belong to 1+ Classes
              │     └── Linked to Parents
              ├── Parents (many per school)
              │     └── Linked to 1+ Students
              ├── Exams (many per school)
              │     ├── Assigned to 1+ Classes
              │     └── Contains Questions (subcollection)
              ├── Submissions (one per student per exam)
              │     └── Contains QuestionSubmissions (subcollection)
              └── Scanner Devices (physical hardware)
```

### Isolation Strategy

- **All client data** lives under `/clients/{clientId}/...`
- Firestore rules enforce `belongsToClient(clientId)` checks
- Cross-client data access is impossible by design
- Single Firestore database, but logically isolated per client

### Multi-School User Support

- A single Firebase Auth user UID can have multiple `UserMembership` documents
- Allows teachers/admins to belong to multiple schools
- `currentClientId` in User document tracks active session
- School code at login routes user to correct client context

### School Code Login Pattern

- Each school has a unique `schoolCode` (e.g., "SCH001")
- Login is 2-step: school code first, then credentials
- School code verifies which client the user belongs to
- Prevents credential reuse across schools

---

## 7. Integration Points

### 7.1 Google Gemini AI

**Models Used**:

- `gemini-2.5-flash` — Question extraction, scouting (fast, cost-effective)
- `gemini-2.5-pro` — Complex grading requiring deeper reasoning (optional)

**Integration Architecture**:

- Each client has their own `geminiApiKey` stored in Firestore
- Cloud Functions fetch the key server-side for Cloud Function-based flows
- Browser-based flows (Type 2) fetch key from Firestore and call Gemini directly

**Key Operations**:

| Operation                 | Function/Prompt                     | Model                 | Purpose                                             |
| ------------------------- | ----------------------------------- | --------------------- | --------------------------------------------------- |
| Question Extraction       | `question-extraction.ts`            | gemini-2.5-flash      | Extract questions + rubrics from question paper     |
| Page Scouting             | `panopticon-scouting.ts`            | gemini-2.5-flash      | Map answer pages to questions                       |
| Standard Grading          | `relms-evaluation-dynamic.ts`       | gemini-2.5-flash      | Grade text-based answers with RELMS                 |
| Type 2 Context Extraction | `type2-basic-context-extraction.ts` | gemini-2.5-flash      | Extract visual question context                     |
| Type 2 Evaluation         | `type2-single-image-evaluation.ts`  | gemini-2.5-flash      | Grade visual answers (diagrams, labels, fill-blank) |
| AI Tutor Chat             | `ai-chat.ts` callable               | gemini-2.5-flash-lite | Low-cost conversational tutoring feature            |

**Prompt Engineering Notes**:

- Dynamic prompts built from client's enabled feedback dimensions
- System + User prompt pattern used consistently
- Temperature: 0.1–0.2 (low for consistency)
- Max tokens: 2048–4096 depending on operation
- JSON schema enforced for structured outputs

### 7.2 Firebase Storage

**Storage Paths**:

```
clients/{clientId}/exams/{examId}/question-papers/     — Question paper images
clients/{clientId}/exams/{examId}/submissions/{submissionId}/answer-sheets/  — Answer images
```

**Key Operations**:

- `uploadAnswerSheets()` — Uploads from scanner or admin
- `urlToBase64()` — Downloads image for AI processing
- `compressImage()` — Client-side compression (scanner app)

### 7.3 Firebase Realtime Database (RTDB)

**Purpose**: Real-time progress updates during long-running grading/scouting
operations (to avoid Firestore read costs for polling).

**Status**: Utility module exists (`functions/src/utils/rtdb.ts`) and is
designed into the architecture, but is not yet actively used in the grading
pipeline (listed as "planned" in feature gap table).

**Intended use case**:

- During scouting: broadcast progress as each page is mapped
  (`submission/{id}/progress: { pagesScanned: N, total: M }`)
- During grading: broadcast per-question completion in real time
- Frontend listens via `onValue()` to show live progress bars without polling
  Firestore

### 7.4 Firebase Cloud Functions

**Callable Functions** (`functions/src/callable/`) — _currently deployed_:

| Function                | Signature                                                 | Purpose                                                                                   |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `bulkCreateStudents`    | `(clientId, students[])`                                  | Create multiple students with Firebase Auth + Firestore + UserMembership                  |
| `bulkCreateTeachers`    | `(clientId, teachers[])`                                  | Create multiple teachers similarly                                                        |
| `generateCredentials`   | `(clientId, type)`                                        | Generate login credentials for a role                                                     |
| `createStudentWithAuth` | `(clientId, studentData)`                                 | Single student creation                                                                   |
| `extractQuestions`      | `(clientId, examId)`                                      | AI question extraction from question paper (Type 1 + Type 2). Timeout: 9min, Memory: 2GiB |
| `createScanner`         | `(username, firstName, lastName, tempPassword, clientId)` | Register physical scanner device                                                          |
| `deleteScanner`         | `(scannerId, clientId)`                                   | Remove scanner device account                                                             |
| `chatWithAI`            | `(clientId, examId?, questionId?, message)`               | AI tutor chat using gemini-2.5-flash-lite (temp 0.7, max 1024 tokens)                     |

**Cloud Function Triggers** (`functions/src/triggers/`) — ⚠️ _COMMENTED OUT —
requires Event Arc setup_:

| Trigger                   | Event                  | Purpose                                |
| ------------------------- | ---------------------- | -------------------------------------- |
| `onQuestionPaperUploaded` | Exam doc updated       | Auto-trigger question extraction       |
| `onSubmissionCreated`     | Submission doc created | Enqueue Cloud Task for answer mapping  |
| `onClientCreated`         | Client doc created     | Initialize default evaluation settings |
| `onScannerCreated`        | Scanner doc created    | Initialize scanner device settings     |

**Workers** (`functions/src/workers/`) — ⚠️ _COMMENTED OUT — requires Cloud
Tasks setup_:

| Worker                 | Timeout     | Purpose                                                                 |
| ---------------------- | ----------- | ----------------------------------------------------------------------- |
| `processAnswerMapping` | 5 min       | Panopticon scouting; builds routingMap; creates QuestionSubmission docs |
| `processAnswerGrading` | 5 min, 1GiB | RELMS per-question evaluation; idempotent; logs to /llm-usage           |

**LLM Infrastructure** (`functions/src/core/llm/`):

- `llm-wrapper.ts` — Provider-agnostic LLM abstraction layer (swap providers
  without changing callers)
- `providers/gemini-provider.ts` — Concrete Gemini integration (`@google/genai`
  v1.37.0)
- `logger/firestore-logger.ts` — Writes every LLM call to `/llm-usage`
- `utils/cost-calculator.ts` — Token-based cost tracking (input/output/total)

**AI Prompt Templates** (`functions/src/prompts/`):

- `question-extraction.ts` — Extract questions + rubrics from question paper
  images
- `panopticon-scouting.ts` — Map answer pages to questions
- `relms-evaluation.ts` — Static RELMS grading prompt
- `relms-evaluation-dynamic.ts` — Dynamic RELMS prompt (adapts per enabled
  feedback dimensions)
- `type2-basic-context-extraction.ts` — Extract visual question expectations
- `type2-single-image-evaluation.ts` — Grade visual answers (matching, labeling,
  diagrams)

### 7.5 Scanner Devices (Physical Hardware)

- Physical scanners register as Firebase Auth accounts with `role: 'scanner'`
- Scanner App is a mobile PWA (installable on tablets/phones)
- Scanner operators: login → select exam → select student → capture pages →
  upload
- Images compressed client-side before upload (saves bandwidth/storage)
- Optional: QR code scanning for automatic exam/student selection

---

## 8. Architecture Strengths

1. **Strict Multi-Tenant Isolation**: `/clients/{clientId}` pattern enforced at
   data and security rule level

2. **Root-Level Exams**: Exams are NOT nested under classes — allows one exam to
   be assigned to multiple classes, avoiding duplication

3. **Separate Question Storage**: Questions stored as subcollection, not
   embedded in Exam document — avoids Firestore 1MB limit even for exams with
   many questions and rubrics

4. **Type 2 Zero-Cost Mapping**: Browser-based page mapping for diagram
   questions, no LLM call needed, saves $0.05–0.15 per submission

5. **Dynamic Evaluation Prompts**: Feedback dimensions configurable per client —
   AI prompt adapts to enabled dimensions automatically

6. **AppContext Documentation**: Exceptional LLM-focused documentation for
   AI-assisted development

7. **Multi-School Users**: Single Firebase Auth UID can belong to multiple
   clients via UserMembership

8. **Cost Accounting**: Every LLM call logged in `/llm-usage` with full
   attribution

9. **Backward Compatible Evaluation**: New structured feedback coexists with
   legacy simple arrays

---

## 9. Key Pain Points & Limitations

### 9.1 Architectural Limitations

| Issue                                  | Severity    | Details                                                                                     |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| **No automated tests**                 | 🔴 Critical | Zero test coverage; bugs discovered in production                                           |
| **No monitoring/observability**        | 🔴 Critical | No dashboards, alerting, or structured logging                                              |
| **API key in browser**                 | 🟡 Medium   | Type 2 flow exposes Gemini API key to browser JS                                            |
| **No cost controls**                   | 🟡 Medium   | No per-client spending limits; could be abused                                              |
| **Users collection key inconsistency** | 🟡 Medium   | Functions use `uid` as doc ID; `packages/firebase/user.ts` uses `email` as doc ID           |
| **Uncovered Firestore collections**    | 🟡 Medium   | `/userMemberships`, `/scanners`, `/evaluationSettings`, `/llm-usage` have no security rules |
| **No CI/CD pipeline**                  | 🟡 Medium   | Manual deployment                                                                           |
| **No staging environment**             | 🟡 Medium   | Direct to production                                                                        |

### 9.2 Feature Gaps

| Gap                                           | Status                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Teacher portal features (view classes, grade) | 30% complete                                                               |
| Student portal (view results, download PDFs)  | 20% complete                                                               |
| Parent portal (view children's results)       | 20% complete                                                               |
| Password reset / forgot password flow         | Not implemented                                                            |
| Bulk student import via CSV                   | Defined in architecture, implementation status unclear                     |
| Real-time grading progress (RTDB)             | RTDB utility exists (`utils/rtdb.ts`), not yet wired into grading pipeline |
| QR code scanning in scanner app               | Not implemented                                                            |
| Offline support for scanner                   | Not implemented                                                            |
| Batch upload across multiple students         | Not implemented                                                            |
| Manual grade override UI                      | Not implemented                                                            |
| Analytics dashboard for teachers/students     | Not implemented                                                            |
| Email notifications (results ready)           | Not implemented                                                            |
| PDF report generation                         | Partially implemented                                                      |

### 9.3 Known Bugs/Inconsistencies

1. **User document keying**: `/users` collection is inconsistently keyed — Cloud
   Functions expect UID as doc ID, but `packages/firebase/user.ts` writes using
   email as doc ID

2. **`/admin/scanners` route registered twice** in `App.tsx` (line 54-55) —
   minor but indicates unclean code

3. **`PlatformStats`** collection documented in types and planning docs but has
   no confirmed code usage paths

4. **storage.rules** was moved to `/docs/storage.rules` and needs to be copied
   back to project root for deployment

5. **Type inconsistencies** between `packages/types/firestore.ts` (shared) and
   `apps/client-admin/src/types/firestore.ts` (V2 extended) — some fields differ

### 9.4 Scalability Concerns

- **Sequential grading**: Questions graded one-by-one; no parallelization with
  rate limiting
- **Linear image processing**: ~2-3 seconds per page for scouting
- **No Cloud Tasks**: Planned but not implemented for high-volume workloads
- **Client-side API calls**: Type 2 makes Gemini calls from browser — could
  cause issues with CORS, rate limits at scale

### 9.5 Cost Estimation

| Scenario                        | Type 1 Cost   | Type 2 Cost   |
| ------------------------------- | ------------- | ------------- |
| Per submission (10 questions)   | $0.20–$0.30   | $0.10–$0.15   |
| 100 students × 10 exams/month   | $200–$300     | $100–$150     |
| 1,000 students × 20 exams/month | $4,000–$6,000 | $2,000–$3,000 |

---

## 10. LevelUp Integration Surface

_These are the natural connection points where AutoGrade would interface with
the LevelUp interactive learning platform._

### What AutoGrade Provides (Outputs for LevelUp)

| AutoGrade Output                                          | LevelUp Opportunity                                   |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `QuestionEvaluation.missingConcepts[]`                    | Trigger targeted learning modules for identified gaps |
| `QuestionEvaluation.weaknesses[]`                         | Recommend practice content aligned to weak areas      |
| `QuestionEvaluation.structuredFeedback.critical_issues[]` | Map to LevelUp knowledge graph nodes                  |
| `Submission.summary.percentage`                           | Feed into LevelUp student performance analytics       |
| `QuestionEvaluation.rubricBreakdown[]`                    | Show mastery per rubric criterion in LevelUp          |
| `Student.classIds[]`                                      | Map to LevelUp course enrollment                      |
| `Exam.topics[]`                                           | Map to LevelUp curriculum topics                      |
| `Exam.subject`                                            | Map to LevelUp subject structure                      |

### What LevelUp Would Provide (Inputs to AutoGrade)

| LevelUp Input                    | AutoGrade Use                                |
| -------------------------------- | -------------------------------------------- |
| Student learning history         | Personalize AI feedback tone/complexity      |
| Course/topic structure           | Auto-suggest exam topics when creating exams |
| Interactive practice results     | Supplement AI grading context                |
| Student profile (learning style) | Adapt feedback dimensions                    |

### Shared Domain Mapping

| AutoGrade Concept     | LevelUp Equivalent       |
| --------------------- | ------------------------ |
| `Client` (School)     | Organization/Tenant      |
| `Class`               | Course/Section           |
| `Student`             | Learner                  |
| `Exam`                | Assessment/TimedTest     |
| `Question`            | Question/ProblemSet item |
| `Submission`          | AssessmentAttempt        |
| `QuestionSubmission`  | QuestionAttempt          |
| `RubricCriterion`     | LearningObjective        |
| `missingConcepts`     | KnowledgeGap             |
| `feedback dimensions` | FeedbackCategory         |

### Integration Architecture Recommendation

```
AutoGrade                    Shared Data Layer              LevelUp
   │                              │                            │
   │  Exam completed              │                            │
   ├──── Push submission ─────────►                            │
   │     results                  │                            │
   │                              │◄─── Query student gaps ────┤
   │                              │                            │
   │                              ├──── Return missingConcepts►│
   │                              │                            │
   │                              │     LevelUp recommends     │
   │                              │     targeted content       │
```

**Preferred integration approach**: Shared Firestore sub-namespace or Firestore
triggers → Cloud Functions → LevelUp API, rather than direct coupling.

---

## 11. Key Architectural Evolution (Design Decisions & Migrations)

This section captures the important structural decisions made during development
— critical context for understanding why the data model looks the way it does.

### 11.1 Firestore Restructure: Exams Moved from Class-Nested to Root-Level

**Previous**: `/clients/{clientId}/classes/{classId}/exams/{examId}`
**Current**: `/clients/{clientId}/exams/{examId}` with `classIds: string[]` on
the Exam document

**Why**: An exam could only belong to one class. Schools often want the same
exam across multiple sections/classes. Moving to root-level with a `classIds`
array enables multi-class exams without duplication.

**Impact on queries**: Filter exams by class using `array-contains` on
`classIds` field.

### 11.2 Question Storage Restructure: Array in Exam Doc → Subcollection

**Previous**: `exam.questionPaper.questions: Question[]` (embedded array in Exam
document) **Current**:
`/clients/{clientId}/exams/{examId}/questions/{questionId}` (separate documents)

**Why**: Firestore has a 1MB document limit. Large exams with many questions +
rubrics could exceed the limit. Also, updating a single question required
rewriting the entire array.

**Benefits**: Unlimited questions, efficient individual updates, orderable via
`order` field, better CDN delivery for question paper images.

### 11.3 Image Storage Restructure: Base64 → Firebase Storage

**Previous**: Question paper images stored as base64 strings directly in
Firestore **Current**: Images stored in Firebase Storage; only URL references
stored in Firestore

**Storage paths**:

```
clients/{clientId}/exams/{examId}/question-papers/{filename}.jpg
clients/{clientId}/exams/{examId}/submissions/{submissionId}/answer-sheets/{filename}.jpg
```

**Why**: Firestore 1MB document limit, no CDN delivery for base64, higher
Firestore read costs.

### 11.4 Submission Collection Restructure: Nested Under Exam → Root Under Client

**Previous**: `/clients/{clientId}/exams/{examId}/submissions/{submissionId}`
**Current**: `/clients/{clientId}/submissions/{submissionId}` with `examId`
field for relationship

**Why**: Couldn't query all submissions for a client without knowing the exam.
Scanner app and Cloud Functions were already using the flat structure;
client-admin app was the outlier.

**Status**: Backend (Cloud Functions) and Scanner App were already using the
correct flat structure. Migration plan exists for client-admin app's Firestore
helper functions.

### 11.5 Gemini SDK Migration

**Previous**: `@google-generative-ai` (old SDK), `getGenerativeModel()` pattern,
model `gemini-1.5-flash` **Current**: `@google/genai` v1.37.0,
`ai.models.generateContent()` pattern, model `gemini-2.5-flash`

**Critical configuration**: `apiVersion: 'v1alpha'` is required — without it,
`gemini-2.5-flash` is not found.

**Model mapping**: | Purpose | Model | |---------|-------| | General grading,
complex reasoning | `gemini-2.5-flash` | | Scouting, low-latency operations |
`gemini-2.5-flash-lite` | | Complex reasoning (optional) | `gemini-2.5-pro` |

### 11.6 Evaluation Feedback Upgrade: Legacy → Structured (RELMS)

**Previous**: Simple arrays — `strengths[]`, `weaknesses[]`, `missingConcepts[]`
**Current**: Structured feedback by dimension —
`structuredFeedback.critical_issues[]`, etc.

**Both formats stored simultaneously** for backward compatibility. Old
evaluations display as simple lists; new evaluations display as rich dimension
cards.

**Limitation**: Evaluation settings are school-wide, not per-exam. There is no
per-exam dimension override currently.

### 11.7 LaTeX Rendering in Questions

Question text supports LaTeX math notation. The UI uses a LaTeX renderer to
display mathematical equations properly in `QuestionCard` components. This
affects how question text is stored (raw LaTeX strings) and displayed.

---

## 12. Data Flow: Complete End-to-End Exam Lifecycle

```
PHASE 0: EXAM SETUP
━━━━━━━━━━━━━━━━━━━
Admin fills exam metadata (title, subject, topics, date, marks, classes)
    ↓
Admin uploads question paper PDF or images
    ↓
Client-side: pdfjs-dist converts PDF pages → JPEG files
    ↓
Files uploaded → Firebase Storage (question-papers/)
    ↓
Cloud Function: question-extraction.ts
    → Fetches client's Gemini API key from Firestore
    → Calls Gemini 2.5 Flash with images + extraction prompt
    → Returns: question text (with LaTeX), maxMarks, rubric criteria
    ↓
Questions saved as subcollection documents
    ↓
Exam status → 'question_paper_uploaded'

PHASE 1: ANSWER SHEET INGESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scanner device or admin uploads answer sheet images
    ↓
Images compressed client-side (scanner app) + uploaded to Firebase Storage
    ↓
Submission document created: status 'pending'
QuestionSubmission documents created per question: status 'scouted'
    ↓
TYPE 1: Panopticon Scouting
    → For each page: Gemini Flash identifies which questions appear
    → Sandwich Rule fills in gaps
    → routingMap: { questionId: [pageIndices] } saved to submission
TYPE 2: Instant Page Mapping
    → No LLM call
    → Question on page N → Answer on page N (same paper)
    → routingMap created instantly
    ↓
Submission status → 'grading'

PHASE 2: AI GRADING
━━━━━━━━━━━━━━━━━━━
For each QuestionSubmission:
    ↓
Load client's EvaluationFeedbackRubric settings
Build dynamic RELMS prompt (enabled dimensions only)
    ↓
Fetch answer images for this question (from routingMap)
Convert URLs → base64
    ↓
Call Gemini 2.5 Flash with:
    - Question text + rubric
    - Answer images (base64)
    - Dynamic evaluation prompt
    ↓
Parse structured JSON response
Transform → QuestionEvaluation format (RELMS)
    ↓
Save to Firestore QuestionSubmission
Log to /llm-usage
    ↓
Update submission totals
    ↓
Submission status → 'completed'

PHASE 3: RESULT VIEWING
━━━━━━━━━━━━━━━━━━━━━━━
Student/Parent logs in with school code + credentials
    ↓
Queries: submissions filtered by studentId
    ↓
View QuestionSubmissions subcollection for each submission
    ↓
StructuredFeedbackDisplay renders:
    - Score, grade, percentage
    - Per-question breakdown
    - Dimension-organized feedback cards
    - Strengths / Key Takeaway
```

---

## 13. Known Data Inconsistencies & Technical Debt

### 13.1 Submission Path Inconsistency (Active Issue)

The client-admin app's Firestore helpers still write submissions under
`/clients/{clientId}/exams/{examId}/submissions/`, while:

- Backend Cloud Functions use `/clients/{clientId}/submissions/`
- Scanner App uses `/clients/{clientId}/submissions/`

This means **submissions created by the admin UI are NOT readable by Cloud
Functions and vice versa** until the restructure plan
(`SUBMISSION_RESTRUCTURE_PLAN.md`) is executed.

### 13.2 Security Rules Gaps

These collections have **no Firestore security rules** (rely on Admin SDK from
server-side):

- `/userMemberships`
- `/scanners`
- `/evaluationSettings` (root-level)
- `/llm-usage`

Client-side reads of these collections will fail or be unprotected.

### 13.3 User Document Key Inconsistency

- Cloud Functions: User documents keyed by `uid` in `/users/{uid}`
- `packages/firebase/user.ts`: User documents keyed by `email` in
  `/users/{email}`

This causes a silent bug where user documents created via the package are
unreadable by Cloud Functions.

### 13.4 Route Duplication

In `App.tsx`, the `/admin/scanners` route is registered twice (lines 54-55).
Minor bug, no functional impact.

### 13.5 PlatformStats Unimplemented

`PlatformStats` collection and type is defined in multiple places but has no
write paths in the application code.

---

_Document generated from full codebase analysis including:_

- _`autograde/docs/` — 50+ documentation files (all major docs reviewed)_
- _`autograde/apps/client-admin/src/` — React app source (App.tsx, all pages)_
- _`autograde/apps/scanner-app/src/` — Scanner PWA source (all pages)_
- _`autograde/functions/src/` — Cloud Functions source (callable, workers,
  prompts, triggers)_
- _`autograde/packages/` — Shared packages (types, firebase, ui, utils)_
- _`autograde/firestore.rules` — Security rules_
- _`autograde/firestore.indexes.json` — Composite indexes_
- _`autograde/AppContext/` — LLM agent documentation_
- _Key docs reviewed: autograde-data-models.md, B2B_ARCHITECTURE_PLAN.md,
  FIRESTORE_RESTRUCTURE.md, GRADING_FEATURE_IMPLEMENTATION.md,
  EVALUATE_FEATURE.md, EVALUATION_FEEDBACK_IMPLEMENTATION.md,
  SCHOOL_LOGIN_ARCHITECTURE.md, EXAM_DETAIL_PAGE.md,
  SUBMISSION_RESTRUCTURE_PLAN.md, TYPE2_IMPLEMENTATION_COMPLETE.md,
  GEMINI_SDK_MIGRATION.md, QUESTION_STORAGE_RESTRUCTURE.md,
  EXAM_MULTI_CLASS_UI.md, PROJECT_STATE_ANALYSIS_UPDATE_2026-02-11.md,
  EXECUTIVE_SUMMARY_2026-02-11.md_
