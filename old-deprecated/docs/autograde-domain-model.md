# Autograde Domain Model Documentation

## Table of Contents

1. [Overview](#overview)
2. [Core Data Types](#core-data-types)
3. [Database Schema](#database-schema)
4. [Database Queries](#database-queries)
5. [Evaluation Feedback System](#evaluation-feedback-system)
6. [Data Flow](#data-flow)
7. [Security Rules](#security-rules)

---

## Overview

Autograde is an AI-powered exam grading system built on Firebase (Firestore +
Cloud Functions). The system uses:

- **Firestore** for structured data storage
- **Cloud Storage** for images (question papers and answer sheets)
- **Cloud Functions** for serverless processing
- **Gemini AI** for intelligent grading and mapping

### Key Features

- Multi-tenant architecture (clients/schools)
- Role-based access control (Super Admin, Client Admin, Teacher, Student,
  Parent)
- AI-powered question paper extraction
- Panopticon algorithm for answer mapping
- RELMS (Rubric-Enabled Learning Management System) for grading
- Configurable feedback dimensions

---

## Core Data Types

### Authentication Types

#### UserRole

```typescript
type UserRole = "superAdmin" | "clientAdmin" | "teacher" | "student" | "parent";
```

#### UserData

```typescript
interface UserData {
  role: UserRole;
  clientId?: string; // School ID
  schoolCode?: string; // School code for login
  studentId?: string;
  parentId?: string;
  teacherId?: string;
  studentIds?: string[]; // For parents with multiple children
  classIds?: string[]; // For teachers - classes they teach
  updatedAt?: Timestamp;
}
```

#### AppUser

```typescript
interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  userData: UserData | null;
  emailVerified: boolean;
}
```

---

### Core Domain Types

#### Client (School)

```typescript
interface Client {
  id: string;
  name: string;
  schoolCode: string; // Unique code for school login (e.g., "SCH001")
  email: string;
  adminUid: string;
  geminiApiKey: string; // Encrypted
  status: "active" | "suspended" | "trial";
  subscriptionPlan: "trial" | "basic" | "premium";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata: {
    address?: string;
    phone?: string;
    contactPerson?: string;
  };
}
```

#### Class

```typescript
interface Class {
  id: string;
  clientId: string;
  name: string;
  subject: string;
  academicYear: string;
  createdBy: string; // adminUid
  createdAt: Timestamp;
  studentCount: number;
}
```

#### Student

```typescript
interface Student {
  id: string;
  clientId: string;
  authUid?: string; // Firebase Auth UID
  email: string;
  tempPassword?: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  classIds: string[];
  parentIds: string[];
  createdAt: Timestamp;
  lastLogin?: Timestamp;
  status: "active" | "inactive";
  metadata?: {
    dateOfBirth?: Timestamp;
    phone?: string;
  };
}
```

#### Teacher

```typescript
interface Teacher {
  id: string;
  clientId: string;
  authUid?: string; // Firebase Auth UID
  email: string;
  tempPassword?: string;
  firstName: string;
  lastName: string;
  classIds: string[]; // Classes they teach
  subjects: string[]; // Subjects they teach
  phone?: string;
  createdAt: Timestamp;
  lastLogin?: Timestamp;
  status: "active" | "inactive";
  metadata?: {
    employeeId?: string;
    department?: string;
  };
}
```

#### Parent

```typescript
interface Parent {
  id: string;
  clientId: string;
  authUid?: string; // Firebase Auth UID
  email: string;
  tempPassword?: string;
  firstName: string;
  lastName: string;
  studentIds: string[]; // Can have multiple children
  phone?: string;
  createdAt: Timestamp;
  lastLogin?: Timestamp;
  status: "active" | "inactive";
}
```

---

### Exam Types

#### Exam

```typescript
interface Exam {
  id: string;
  clientId: string;
  classIds: string[]; // Array of class IDs - exam can be for multiple classes
  title: string;
  subject: string;
  topics: string[];
  examDate: Timestamp;
  duration: number; // in minutes
  totalMarks: number;
  passingMarks: number;
  createdAt: Timestamp;
  status: "draft" | "question_paper_uploaded" | "in_progress" | "completed";
  questionPaper?: {
    images: string[]; // Firebase Storage URLs
    extractedAt: Timestamp;
    questionCount: number; // Total number of questions
  };
  gradingConfig: {
    autoGrade: boolean;
    allowRubricEdit: boolean;
    customRubrics?: Record<string, Rubric>;
  };
}
```

#### Question

**Path:** `/clients/{clientId}/exams/{examId}/questions/{questionId}`

```typescript
interface Question {
  id: string; // e.g., "Q1", "Q2"
  examId: string;
  text: string; // LaTeX or plain text
  maxMarks: number;
  order: number; // Display order (0-indexed)
  rubric: Rubric;
  createdAt: Timestamp;
}
```

#### Rubric & RubricCriterion

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

### Submission Types

#### Submission

**Path:** `/clients/{clientId}/submissions/{submissionId}`

```typescript
interface Submission {
  id: string;
  clientId: string;
  examId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string; // Which class this student is from
  answerSheets: {
    images: string[]; // Cloud Storage URLs
    uploadedAt: Timestamp;
    uploadedBy: string; // adminUid
  };
  scoutingResult?: {
    routingMap: Record<string, number[]>; // questionId → page indices
    completedAt: Timestamp;
  };
  summary: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    grade: string; // "A", "B+", etc.
    status: "pending" | "scouting" | "grading" | "completed" | "failed";
    questionsGraded?: number; // Number of questions graded
    totalQuestions?: number; // Total number of questions in exam
    completedAt?: Timestamp;
  };
  createdAt: Timestamp;
}
```

#### QuestionSubmission

**Path:**
`/clients/{clientId}/submissions/{submissionId}/questionSubmissions/{questionId}`

```typescript
interface QuestionSubmission {
  id: string; // Same as questionId (e.g., "Q1")
  submissionId: string;
  questionId: string;
  examId: string;

  // Mapping data (from scouting phase)
  mapping: {
    pageIndices: number[]; // [0, 1, 2] - pages containing this answer
    imageUrls: string[]; // Direct Firebase Storage URLs for these pages
    scoutedAt: Timestamp;
  };

  // Evaluation results (from grading phase, optional)
  evaluation?: QuestionEvaluation;

  status: "scouted" | "graded" | "manual_override";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Evaluation Feedback System

### Overview

The RELMS (Rubric-Enabled Learning Management System) provides configurable,
modular feedback for student evaluations.

### Feedback Dimension Types

#### FeedbackPriority

```typescript
type FeedbackPriority = "HIGH" | "MEDIUM" | "LOW";
```

#### FeedbackSeverity

```typescript
type FeedbackSeverity = "critical" | "major" | "minor";
```

#### FeedbackDimension

```typescript
interface FeedbackDimension {
  id: string; // e.g., "critical_issues", "structure_flow"

  // Display information
  name: string; // "Critical Issues", "Structure & Flow"
  description: string; // What this evaluates
  icon?: string; // Emoji or icon identifier (e.g., "❌", "📋")

  // Evaluation guidance
  priority: FeedbackPriority;
  promptGuidance: string; // Instructions for the LLM on how to evaluate

  // Configuration
  enabled: boolean; // Whether this dimension is currently active
  isDefault: boolean; // Default dimensions cannot be deleted
  isCustom: boolean; // Client-created custom dimension

  // Expected output format
  expectedFeedbackCount?: number; // Target number of feedback items

  // Metadata (for custom dimensions)
  createdAt?: Timestamp;
  createdBy?: string; // User ID who created this custom dimension
}
```

#### FeedbackItem

```typescript
interface FeedbackItem {
  issue: string; // Clear, specific description
  whyItMatters?: string; // Context and impact explanation
  howToFix: string; // Specific improvement step
  severity: FeedbackSeverity;
  relatedConcept?: string; // Concept name (used for missing concepts tracking)
}
```

#### StructuredFeedback

```typescript
// Key = dimension ID, Value = array of feedback items for that dimension
type StructuredFeedback = Record<string, FeedbackItem[]>;
```

### Evaluation Settings

#### EvaluationDisplaySettings

```typescript
interface EvaluationDisplaySettings {
  showStrengths: boolean; // Show strengths section in PDF/UI
  showKeyTakeaway: boolean; // Show key takeaway summary
  prioritizeByImportance: boolean; // Order feedback by priority level
}
```

#### EvaluationFeedbackRubric

**Path:** `/clients/{clientId}/evaluationSettings/{settingsId}`

```typescript
interface EvaluationFeedbackRubric {
  id: string; // Unique settings ID (e.g., "default", "physics_lab")
  clientId: string;

  // Named settings support
  name: string; // Display name (e.g., "Default Settings")
  description?: string; // Optional description
  isDefault: boolean; // Exactly one must be true per client
  isPublic?: boolean; // If true, available to all clients (global presets)

  // Enabled dimensions for this client
  enabledDimensions: FeedbackDimension[];

  // Display settings
  displaySettings: EvaluationDisplaySettings;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string; // User ID who created this settings config
}
```

### Evaluation Structure

#### QuestionEvaluation

```typescript
interface QuestionEvaluation {
  // Basic Scoring
  score: number; // Total score awarded
  maxScore: number; // Maximum possible score

  // Structured Feedback by Dimension
  structuredFeedback: StructuredFeedback;

  // Simple Arrays (backwards compatible, used for PDF/analytics)
  strengths: string[]; // Array of specific strengths
  weaknesses: string[]; // Array of specific weaknesses
  missingConcepts: string[]; // Array of missing concepts

  // Rubric Breakdown
  rubricBreakdown: RubricBreakdownItem[];

  // Summary
  summary: EvaluationSummary;

  // Metadata
  confidence_score: number; // LLM's confidence (0.0 to 1.0)
  mistake_classification?: MistakeClassification;

  // Traceability
  evaluationRubricId: string; // Which feedback rubric was used
  dimensionsUsed: string[]; // IDs of dimensions that were evaluated

  // Tokens & Cost
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number; // USD

  // Timestamp
  gradedAt: Timestamp;
}
```

#### RubricBreakdownItem

```typescript
interface RubricBreakdownItem {
  criterion: string; // Rubric criterion text
  awarded: number; // Marks awarded
  max: number; // Maximum marks for this criterion
  feedback?: string; // Brief feedback for this criterion
}
```

#### EvaluationSummary

```typescript
interface EvaluationSummary {
  keyTakeaway: string; // One sentence - most important improvement to focus on
  overallComment: string; // 2-3 sentences summarizing overall performance
}
```

#### MistakeClassification

```typescript
type MistakeClassification =
  | "Conceptual"
  | "Silly Error"
  | "Knowledge Gap"
  | "None";
```

---

## Database Schema

### Collection Hierarchy

```
/clients/{clientId}
  - Client document

  /classes/{classId}
    - Class document

  /students/{studentId}
    - Student document

  /teachers/{teacherId}
    - Teacher document

  /parents/{parentId}
    - Parent document

  /exams/{examId}
    - Exam document

    /questions/{questionId}
      - Question document

  /submissions/{submissionId}
    - Submission document

    /questionSubmissions/{questionId}
      - QuestionSubmission document

  /evaluationSettings/{settingsId}
    - EvaluationFeedbackRubric document

/users/{userId}
  - UserData document

/platformStats
  - PlatformStats document
```

### Firestore Indexes

The system uses the following composite indexes:

```json
{
  "indexes": [
    {
      "collectionGroup": "teachers",
      "fields": [
        { "fieldPath": "clientId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "students",
      "fields": [
        { "fieldPath": "clientId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "classes",
      "fields": [
        { "fieldPath": "clientId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "exams",
      "fields": [
        { "fieldPath": "clientId", "order": "ASCENDING" },
        { "fieldPath": "examDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "exams",
      "fields": [
        { "fieldPath": "classIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "questions",
      "fields": [
        { "fieldPath": "examId", "order": "ASCENDING" },
        { "fieldPath": "order", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "fields": [
        { "fieldPath": "examId", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "fields": [
        { "fieldPath": "classId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Database Queries

### Client Operations

#### Get Client

```typescript
getClient(clientId: string): Promise<Client>
// Path: /clients/{clientId}
```

#### Get Client by School Code

```typescript
getClientBySchoolCode(schoolCode: string): Promise<Client | null>
// Query: collection('clients').where('schoolCode', '==', schoolCode)
```

#### Get All Clients

```typescript
getClients(): Promise<Client[]>
// Query: collection('clients').orderBy('createdAt', 'desc')
```

#### Create Client

```typescript
createClient(clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<{id: string}>
```

#### Update Client

```typescript
updateClient(clientId: string, updates: Partial<Client>): Promise<void>
```

### Class Operations

#### Get Classes for Client

```typescript
getClasses(clientId: string): Promise<Class[]>
// Query: collection('clients/{clientId}/classes').orderBy('createdAt', 'desc')
```

#### Create Class

```typescript
createClass(clientId: string, classData: Omit<Class, 'id' | 'clientId' | 'createdAt'>): Promise<{id: string}>
```

### Student Operations

#### Get Students for Client

```typescript
getStudents(clientId: string): Promise<Student[]>
// Query: collection('clients/{clientId}/students').orderBy('createdAt', 'desc')
```

#### Create Student

```typescript
createStudent(clientId: string, studentData: Omit<Student, 'id' | 'clientId' | 'createdAt'>): Promise<{id: string}>
```

### Teacher Operations

#### Get Teachers for Client

```typescript
getTeachers(clientId: string): Promise<Teacher[]>
// Query: collection('clients/{clientId}/teachers').orderBy('createdAt', 'desc')
```

### Exam Operations

#### Get Exams for Client

```typescript
getExams(clientId: string): Promise<Exam[]>
// Query: collection('clients/{clientId}/exams').orderBy('createdAt', 'desc')
```

#### Get Exams for Class

```typescript
getExamsForClass(clientId: string, classId: string): Promise<Exam[]>
// Query: collection('clients/{clientId}/exams')
//        .where('classIds', 'array-contains', classId)
//        .orderBy('createdAt', 'desc')
```

#### Get Single Exam

```typescript
getExam(clientId: string, examId: string): Promise<Exam>
// Path: /clients/{clientId}/exams/{examId}
```

#### Create Exam

```typescript
createExam(clientId: string, examData: Omit<Exam, 'id' | 'clientId' | 'createdAt'>): Promise<{id: string}>
```

#### Update Exam

```typescript
updateExam(clientId: string, examId: string, data: Partial<Exam>): Promise<void>
```

### Question Operations

#### Get Questions for Exam

```typescript
getQuestions(clientId: string, examId: string): Promise<Question[]>
// Query: collection('clients/{clientId}/exams/{examId}/questions')
//        .orderBy('order', 'asc')
```

#### Get Single Question

```typescript
getQuestion(clientId: string, examId: string, questionId: string): Promise<Question>
// Path: /clients/{clientId}/exams/{examId}/questions/{questionId}
```

#### Save Questions (Batch)

```typescript
saveQuestions(clientId: string, examId: string, questions: Question[]): Promise<void>
// Uses Firestore batch write
```

### Submission Operations

#### Get Submission

```typescript
getSubmission(clientId: string, submissionId: string): Promise<Submission>
// Path: /clients/{clientId}/submissions/{submissionId}
```

#### Get Submissions for Exam

```typescript
getSubmissions(clientId: string, examId: string): Promise<Submission[]>
// Query: collection('clients/{clientId}/submissions')
//        .where('examId', '==', examId)
//        .orderBy('createdAt', 'desc')
```

#### Get Submissions for Class

```typescript
getSubmissionsForClass(clientId: string, examId: string, classId: string): Promise<Submission[]>
// Query: collection('clients/{clientId}/submissions')
//        .where('classId', '==', classId)
//        .orderBy('createdAt', 'desc')
```

#### Update Submission

```typescript
updateSubmission(clientId: string, submissionId: string, data: Partial<Submission>): Promise<void>
```

#### Finalize Submission

```typescript
finalizeSubmission(clientId: string, submissionId: string): Promise<void>
// Aggregates all question scores, calculates grade, and updates submission
```

### QuestionSubmission Operations

#### Get Question Submission

```typescript
getQuestionSubmission(clientId: string, submissionId: string, questionId: string): Promise<QuestionSubmission>
// Path: /clients/{clientId}/submissions/{submissionId}/questionSubmissions/{questionId}
```

#### Create Question Submission

```typescript
createQuestionSubmission(clientId: string, submissionId: string, questionId: string, data: any): Promise<void>
```

#### Update Question Submission

```typescript
updateQuestionSubmission(clientId: string, submissionId: string, questionId: string, data: Partial<QuestionSubmission>): Promise<void>
```

#### Count Graded Questions

```typescript
countGradedQuestions(clientId: string, submissionId: string): Promise<number>
// Query: collection('clients/{clientId}/submissions/{submissionId}/questionSubmissions')
//        .where('status', '==', 'graded')
//        .count()
```

#### Count Total Questions

```typescript
countTotalQuestions(clientId: string, submissionId: string): Promise<number>
// Query: collection('clients/{clientId}/submissions/{submissionId}/questionSubmissions')
//        .count()
```

### Evaluation Settings Operations

#### Get Evaluation Settings

```typescript
getEvaluationSettings(clientId: string, settingsId: string = 'default'): Promise<EvaluationFeedbackRubric>
// Path: /clients/{clientId}/evaluationSettings/{settingsId}
// Auto-creates default settings if not found
```

#### Initialize Default Settings

```typescript
initializeDefaultEvaluationSettings(clientId: string): Promise<EvaluationFeedbackRubric>
```

#### Update Evaluation Settings

```typescript
updateEvaluationSettings(clientId: string, updates: Partial<EvaluationFeedbackRubric>): Promise<void>
```

#### Add Custom Dimension

```typescript
addCustomDimension(clientId: string, dimension: FeedbackDimension): Promise<void>
```

#### Remove Custom Dimension

```typescript
removeCustomDimension(clientId: string, dimensionId: string): Promise<void>
```

#### Toggle Dimension

```typescript
toggleDimension(clientId: string, dimensionId: string, enabled: boolean): Promise<void>
```

#### Get Enabled Dimensions (Sorted)

```typescript
getEnabledDimensionsSorted(clientId: string): Promise<FeedbackDimension[]>
// Returns enabled dimensions sorted by priority: HIGH -> MEDIUM -> LOW
```

---

## Data Flow

### 1. Exam Creation Flow

```
1. Admin creates exam → Exam document created
2. Admin uploads question paper images → Stored in Cloud Storage
3. Question extraction triggered → Questions extracted and saved
4. Questions stored in /exams/{examId}/questions subcollection
```

### 2. Submission Processing Flow (Panopticon + RELMS)

```
1. Admin uploads answer sheets → Submission document created
   ↓
2. onSubmissionCreated trigger fires
   ↓
3. Cloud Task created for answer mapping (Panopticon)
   ↓
4. processAnswerMapping worker executes:
   - Downloads question paper images
   - Downloads answer sheet images
   - Builds global context (interleaved content)
   - Calls Gemini with Panopticon prompt
   - Creates QuestionSubmission docs with mapping data
   ↓
5. For each question, Cloud Task created for grading
   ↓
6. processAnswerGrading worker executes (RELMS):
   - Loads QuestionSubmission with mapped images
   - Gets evaluation settings for client
   - Builds dynamic RELMS prompt with enabled dimensions
   - Calls Gemini for evaluation
   - Transforms response to QuestionEvaluation
   - Saves evaluation to QuestionSubmission
   ↓
7. When all questions graded:
   - finalizeSubmission calculates total score
   - Determines grade (A+, A, B, etc.)
   - Updates submission status to 'completed'
```

### 3. Real-time Progress Tracking

- RTDB (Realtime Database) tracks submission progress
- Updates phase, status, progress percentage
- Shows current step to users in real-time

---

## Security Rules

### Overview

Firestore security rules implement role-based access control:

### Helper Functions

```javascript
function isAuthenticated() {
  return request.auth != null;
}

function getUserData() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}

function isSuperAdmin() {
  return isAuthenticated() && getUserData().role == 'superAdmin';
}

function isClientAdmin() {
  return isAuthenticated() && getUserData().role == 'clientAdmin';
}

function isTeacher() {
  return isAuthenticated() && getUserData().role == 'teacher';
}

function belongsToClient(clientId) {
  return getUserData().clientId == clientId;
}
```

### Access Control Rules

#### Users Collection

```javascript
match /users/{userId} {
  allow read: if isAuthenticated();  // Any authenticated user can read
  allow create, update: if isAuthenticated() && request.auth.uid == userId;
  allow delete: if false;  // Admin SDK only
}
```

#### Clients Collection

```javascript
match /clients/{clientId} {
  allow read, write: if isSuperAdmin();  // Super admin only
}
```

#### Classes, Students, Teachers

```javascript
match /clients/{clientId}/classes/{classId} {
  allow read: if isAuthenticated() && (belongsToClient(clientId) || isSuperAdmin());
  allow write: if isAuthenticated() && (isClientAdmin() || isSuperAdmin()) && belongsToClient(clientId);
}
```

#### Exams

```javascript
match /clients/{clientId}/exams/{examId} {
  allow read: if isAuthenticated() && (belongsToClient(clientId) || isSuperAdmin());
  allow write: if isAuthenticated() && (isClientAdmin() || isTeacher() || isSuperAdmin()) && belongsToClient(clientId);

  match /questions/{questionId} {
    allow read: if isAuthenticated() && (belongsToClient(clientId) || isSuperAdmin());
    allow write: if isAuthenticated() && (isClientAdmin() || isTeacher() || isSuperAdmin()) && belongsToClient(clientId);
  }
}
```

#### Submissions

```javascript
match /clients/{clientId}/submissions/{submissionId} {
  allow read: if isAuthenticated() && (belongsToClient(clientId) || isSuperAdmin());
  allow write: if isAuthenticated() && (belongsToClient(clientId) || isSuperAdmin());

  match /questionSubmissions/{questionId} {
    allow read: if isAuthenticated() && (belongsToClient(clientId) || isSuperAdmin());
    allow write: if isAuthenticated() && (belongsToClient(clientId) || isSuperAdmin());
  }
}
```

---

## Key Algorithms

### Panopticon (Global Context Mapping)

- **Purpose:** Map all questions to answer sheet pages in ONE API call
- **Input:** Question paper images + Answer sheet images
- **Process:**
  1. Interleave all images with text markers
  2. Send to Gemini with global context
  3. LLM analyzes entire context at once
  4. Returns routing map: `{questionId: [pageIndices]}`
- **Output:** QuestionSubmission documents with page mappings

### RELMS (Rubric-Enabled Learning Management System)

- **Purpose:** Evaluate student answers with structured, configurable feedback
- **Input:** Answer images + Question + Rubric + Enabled Feedback Dimensions
- **Process:**
  1. Load client's evaluation settings
  2. Build dynamic prompt with enabled dimensions
  3. Send to Gemini for evaluation
  4. Parse structured feedback by dimension
  5. Calculate score, extract strengths/weaknesses
- **Output:** QuestionEvaluation with score, structured feedback, rubric
  breakdown

---

## Statistics & Analytics

### Platform Statistics

```typescript
interface PlatformStats {
  totalClients: number;
  activeClients: number;
  totalStudents: number;
  totalExamsGraded: number;
  totalApiCalls: number;
  lastUpdated: Timestamp;
}
```

### Client Statistics

- Classes count
- Students count
- Exams count
- Submissions count

---

## File Locations

### Type Definitions

- **Core types:** `packages/types/firestore.ts`
- **Auth types:** `packages/types/auth.ts`
- **Evaluation types:** `functions/src/types/evaluation-feedback.ts`

### Database Operations

- **Frontend queries:** `packages/firebase/firestore.ts`
- **Backend queries:** `functions/src/utils/firestore.ts`
- **Evaluation settings:** `functions/src/utils/evaluation-settings.ts`

### Business Logic

- **Submission triggers:** `functions/src/triggers/submission-triggers.ts`
- **Answer mapping worker:** `functions/src/workers/answer-mapping.ts`
- **Answer grading worker:** `functions/src/workers/answer-grading.ts`

### Configuration

- **Firestore rules:** `firestore.rules`
- **Firestore indexes:** `firestore.indexes.json`
- **Firebase config:** `firebase.json`

---

## Notes

### Multi-tenancy

- All data is scoped under `/clients/{clientId}`
- Each client (school) is isolated
- Super admins can access all clients
- Regular users can only access their own client's data

### Scalability

- Cloud Tasks queue work for parallel processing
- Firestore subcollections for hierarchical data
- Composite indexes for efficient queries
- Cloud Storage for images (not in Firestore)

### AI Integration

- Each client has their own Gemini API key (encrypted)
- LLM calls are logged for cost tracking
- Token usage and cost tracked per evaluation
- Configurable models (gemini-2.5-flash, gemini-3-flash-preview)

### Evaluation Flexibility

- Multiple evaluation settings per client (e.g., "default", "physics_lab",
  "quick_quiz")
- Custom feedback dimensions can be added
- Default dimensions can be enabled/disabled but not deleted
- Global preset settings can be shared across clients
