# AutoGrade Module — Comprehensive Design Plan

## Unified LevelUp + AutoGrade B2B SaaS Platform — Phase 3

**Version:** 1.0 **Date:** 2026-02-19 **Author:** AutoGrade Engineer **Status:**
Design Plan — Ready for Implementation **Reference Docs:**

- `docs/UNIFIED-ARCHITECTURE-BLUEPRINT.md` (sections 4.3, 9.1–9.5, 10.1–10.3)
- `docs/BLUEPRINT-REVIEW-RESPONSES-AND-EXTENSIONS.md` (sections 4.2, 4.5, 4.6)
- `docs/phase1-autograde-extraction.md`
- `docs/autograde-domain-model.md`
- `docs/phase3c-unified-content-assessment.md` (sections 5, 7, 8)

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Shared Domain Model — Unified Question & Rubric Types](#2-shared-domain-model--unified-question--rubric-types)
3. [Entity Schemas](#3-entity-schemas)
4. [Exam Lifecycle Flow](#4-exam-lifecycle-flow)
5. [Submission Pipeline](#5-submission-pipeline)
6. [Grading Pipeline State Machine](#6-grading-pipeline-state-machine)
7. [Cloud Function Specifications](#7-cloud-function-specifications)
8. [AI Integration Design](#8-ai-integration-design)
9. [Scanner App Architecture](#9-scanner-app-architecture)
10. [Rubric Editing UI](#10-rubric-editing-ui)
11. [Manual Grade Override](#11-manual-grade-override)
12. [Result Release Flow](#12-result-release-flow)
13. [Exam Analytics](#13-exam-analytics)
14. [PDF Result Export](#14-pdf-result-export)
15. [Firestore Security Rules](#15-firestore-security-rules)
16. [Error Handling & Retry Patterns](#16-error-handling--retry-patterns)
17. [Migration Plan](#17-migration-plan)
18. [Testing Strategy](#18-testing-strategy)
19. [Dependencies on Other Modules](#19-dependencies-on-other-modules)
20. [Future: Extensible Exam Type System](#20-future-extensible-exam-type-system)

---

## 1. Overview & Scope

### What This Module Covers

The AutoGrade module is the AI-powered exam grading pipeline within the unified
platform. It handles the complete lifecycle of paper-based exams: from exam
creation and question paper upload, through AI-powered question extraction and
rubric generation, to answer sheet upload, automated grading, teacher review,
and result release.

### Core Capabilities

| Capability              | Description                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Exam CRUD**           | Create, read, update, archive exams under `/tenants/{tenantId}/exams/{examId}` |
| **Question Management** | AI extraction from question papers + manual rubric editing                     |
| **Submission Pipeline** | Upload answer sheets → OCR → scouting → grading → review                       |
| **Panopticon Scouting** | AI-powered page-to-question mapping using Gemini's 1M context window           |
| **RELMS Grading**       | Per-question AI grading with structured, dimension-based feedback              |
| **Manual Override**     | Teacher can override any AI grade with a mandatory reason                      |
| **Result Release**      | Controlled release of grades to students and parents                           |
| **Exam Analytics**      | Score distributions, question difficulty, pass rates                           |
| **PDF Export**          | Downloadable result PDFs per student                                           |
| **Evaluation Settings** | Configurable feedback dimensions per tenant/exam                               |

### Design Decisions from User

| Decision                   | Choice                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Grading failure handling   | Both retry + manual (retry first, then manual fallback)                                      |
| Scanner app offline        | Online-only for now (no offline queue)                                                       |
| Dead-letter queue alerting | In-app only (dashboard badge for pending DLQ items)                                          |
| Exam types                 | Type 1 (Standard) only for now; architecture supports extensible exam type system for future |

### Key Architectural Constraint — Shared Domain Model

**CRITICAL:** AutoGrade and LevelUp share the SAME question and rubric types.
The unified `UnifiedItem` and `UnifiedRubric` from `packages/shared-types` are
the canonical models. AutoGrade's `ExamQuestion` uses `UnifiedRubric` for its
rubric field. The grading pipeline (Panopticon, RELMS) operates on these shared
types. See Section 2 for details.

---

## 2. Shared Domain Model — Unified Question & Rubric Types

### 2.1 Design Principle

Both LevelUp and AutoGrade use the SAME type system for questions and rubrics.
LevelUp's architecture is the BASE model:

- **UnifiedItem** — the canonical content atom (questions, materials, etc.)
- **UnifiedRubric** — the canonical grading criteria structure (4 scoring
  modes + inheritance)

AutoGrade adapts to these types rather than maintaining separate domain models.

### 2.2 UnifiedRubric (Shared — `packages/shared-types/src/content/rubric.ts`)

```typescript
interface UnifiedRubric {
  // ── Marking Criteria (AutoGrade model) ───────────────────────────
  criteria?: RubricCriterion[];

  // ── Evaluation Dimensions (RELMS + Agent model) ───────────────────
  dimensions?: EvaluationDimension[];

  // ── Scoring Mode ─────────────────────────────────────────────────
  scoringMode: RubricScoringMode;

  // ── Passing Threshold ────────────────────────────────────────────
  passingPercentage?: number;

  // ── Answer Display ───────────────────────────────────────────────
  showModelAnswer?: boolean;
  modelAnswer?: string;

  // ── Evaluator Guidance ───────────────────────────────────────────
  evaluatorGuidance?: string;
}

type RubricScoringMode =
  | "criteria_based" // Marks allocated per criterion (AutoGrade default)
  | "dimension_based" // Holistic dimension-based (RELMS default)
  | "holistic" // Single score, no breakdown
  | "hybrid"; // criteria + dimensions combined

interface RubricCriterion {
  description: string;
  marks: number;
}

interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  icon?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  promptGuidance: string;
  enabled: boolean;
  isDefault: boolean;
  isCustom: boolean;
  expectedFeedbackCount?: number;
  createdAt?: Timestamp;
  createdBy?: string;
}
```

### 2.3 Rubric Inheritance Chain

```
Tenant.settings.defaultEvaluationSettingsId
  └── EvaluationSettings (tenant-level dimensions)
        └── Exam.evaluationSettingsId (exam-level override)
              └── ExamQuestion.rubric (question-level override)
```

**Resolution at grading time:**

```typescript
function resolveRubric(context: GradingContext): UnifiedRubric {
  return (
    context.question?.rubric ?? // Question-level rubric
    context.examEvaluationSettings ?? // Exam-level settings
    context.tenantDefaultEvaluationSettings // Tenant default
  );
}
```

### 2.4 How AutoGrade Uses UnifiedRubric

| AutoGrade Context                         | scoringMode      | criteria                               | dimensions                           |
| ----------------------------------------- | ---------------- | -------------------------------------- | ------------------------------------ |
| AI-extracted rubric (from question paper) | `criteria_based` | AI-generated marking criteria          | Empty (added later if RELMS enabled) |
| RELMS grading prompt                      | `hybrid`         | Original criteria for score allocation | Tenant's enabled feedback dimensions |
| Manual rubric (teacher-authored)          | `criteria_based` | Teacher-defined criteria               | Optional                             |

### 2.5 ExamQuestion and UnifiedItem Relationship

AutoGrade's `ExamQuestion` is a lightweight, exam-specific entity that uses
`UnifiedRubric`. It is NOT a full `UnifiedItem` — exam questions are extracted
from physical papers and lack the rich metadata of digital content items.

However, an `ExamQuestion` can be linked to a `UnifiedItem` via `linkedItemId`
for cross-domain features (e.g., linking a paper exam question to digital
practice content).

```
ExamQuestion (paper exam domain)
  ├── rubric: UnifiedRubric          ← SHARED type
  ├── linkedItemId?: string          ← Optional link to UnifiedItem
  └── text, maxMarks, order, ...     ← Exam-specific fields

UnifiedItem (digital content domain)
  ├── rubric?: UnifiedRubric         ← SHARED type
  ├── linkedQuestionId?: string      ← Optional link to ExamQuestion
  └── payload, meta, ...             ← Rich content fields
```

---

## 3. Entity Schemas

### 3.1 Exam (`/tenants/{tenantId}/exams/{examId}`)

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

  // Question paper metadata
  questionPaper?: {
    images: string[]; // Cloud Storage URLs
    extractedAt: Timestamp;
    questionCount: number;
    examType: "standard"; // Type 1 only for now; extensible
  };

  // Grading configuration
  gradingConfig: {
    autoGrade: boolean;
    allowRubricEdit: boolean;
    evaluationSettingsId?: string; // Override tenant default
    allowManualOverride: boolean;
    requireOverrideReason: boolean;
    releaseResultsAutomatically: boolean;
  };

  // Cross-domain linkage
  linkedSpaceId?: string;
  linkedStoryPointId?: string;

  // Lifecycle
  status: ExamStatus;

  // Evaluation settings reference
  evaluationSettingsId?: string;

  // Denormalized stats
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
  | "question_paper_extracted"
  | "published" // Ready for answer sheet uploads
  | "grading" // Submissions being graded
  | "completed" // All grading done
  | "results_released" // Results visible to students
  | "archived";
```

### 3.2 ExamQuestion (`/tenants/{tenantId}/exams/{examId}/questions/{questionId}`)

```typescript
interface ExamQuestion {
  id: string; // e.g., "Q1", "Q2"
  examId: string;

  // Question content
  text: string; // LaTeX or plain text
  imageUrls?: string[]; // Extracted question images

  // Scoring
  maxMarks: number;
  order: number; // Display order (0-indexed)

  // Rubric — uses SHARED UnifiedRubric type
  rubric: UnifiedRubric;

  // AutoGrade pipeline metadata
  questionType?: "standard" | "diagram" | "multi-part";
  subQuestions?: SubQuestion[];

  // Cross-domain linkage
  linkedItemId?: string; // Link to UnifiedItem for digital practice

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

### 3.3 Submission (`/tenants/{tenantId}/submissions/{submissionId}`)

```typescript
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
    uploadSource: "web" | "scanner";
  };

  // Scouting result (from Panopticon)
  scoutingResult?: {
    routingMap: Record<string, number[]>; // questionId → page indices
    confidence: Record<string, number>; // questionId → confidence (0-1)
    completedAt: Timestamp;
  };

  // Summary
  summary: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    grade: string; // "A+", "A", "B+", etc.
    questionsGraded: number;
    totalQuestions: number;
    completedAt?: Timestamp;
  };

  // Pipeline state
  pipelineStatus: SubmissionPipelineStatus;
  pipelineError?: string;
  retryCount: number;

  // Result release
  resultsReleased: boolean;
  resultsReleasedAt?: Timestamp;
  resultsReleasedBy?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type SubmissionPipelineStatus =
  | "uploaded" // Answer sheets uploaded, awaiting processing
  | "ocr_processing" // OCR/image preprocessing
  | "ocr_failed" // OCR failed (will retry)
  | "scouting" // Panopticon mapping in progress
  | "scouting_failed" // Scouting failed (will retry)
  | "scouting_complete" // Mapping done, ready for grading
  | "grading" // RELMS grading in progress
  | "grading_partial" // Some questions graded, some failed
  | "grading_complete" // All questions graded
  | "ready_for_review" // Awaiting teacher review
  | "reviewed" // Teacher has reviewed
  | "failed" // Terminal failure (in dead-letter queue)
  | "manual_review_needed"; // Requires manual intervention
```

### 3.4 QuestionSubmission (`/tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{questionId}`)

```typescript
interface QuestionSubmission {
  id: string; // Same as questionId
  submissionId: string;
  questionId: string;
  examId: string;

  // Mapping data (from scouting phase)
  mapping: {
    pageIndices: number[];
    imageUrls: string[];
    scoutedAt: Timestamp;
  };

  // Evaluation result — uses SHARED UnifiedEvaluationResult
  evaluation?: UnifiedEvaluationResult;

  // Per-question grading status
  gradingStatus: QuestionGradingStatus;
  gradingError?: string;
  gradingRetryCount: number;

  // Manual override
  manualOverride?: {
    score: number;
    reason: string;
    overriddenBy: string; // Teacher UID
    overriddenAt: Timestamp;
    originalScore: number; // AI score before override
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type QuestionGradingStatus =
  | "pending" // Awaiting grading
  | "processing" // Currently being graded
  | "graded" // AI grading complete
  | "failed" // Grading failed
  | "manual" // Manually graded by teacher
  | "overridden"; // AI graded, then teacher overrode
```

### 3.5 UnifiedEvaluationResult (Shared — `packages/shared-types/src/content/evaluation.ts`)

```typescript
interface UnifiedEvaluationResult {
  score: number; // Marks awarded
  maxScore: number;
  correctness: number; // 0–1 normalized
  percentage: number; // 0–100

  // Structured feedback (RELMS dimensions)
  structuredFeedback?: Record<string, FeedbackItem[]>;

  // Simple arrays (backward compatible)
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];

  // Rubric breakdown
  rubricBreakdown?: RubricBreakdownItem[];

  // Summary
  summary?: {
    keyTakeaway: string;
    overallComment: string;
  };

  // Metadata
  confidence: number; // 0–1
  mistakeClassification?:
    | "Conceptual"
    | "Silly Error"
    | "Knowledge Gap"
    | "None";

  // Cost tracking
  tokensUsed?: { input: number; output: number };
  costUsd?: number;

  // Traceability
  evaluationRubricId?: string;
  dimensionsUsed?: string[];

  gradedAt: Timestamp;
}

interface RubricBreakdownItem {
  criterion: string;
  awarded: number;
  max: number;
  feedback?: string;
}

interface FeedbackItem {
  issue: string;
  whyItMatters?: string;
  howToFix: string;
  severity: "critical" | "major" | "minor";
  relatedConcept?: string;
}
```

### 3.6 EvaluationSettings (`/tenants/{tenantId}/evaluationSettings/{settingsId}`)

```typescript
interface EvaluationFeedbackRubric {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isPublic?: boolean; // Global presets (SuperAdmin)

  // Enabled feedback dimensions
  enabledDimensions: EvaluationDimension[];

  // Display settings
  displaySettings: {
    showStrengths: boolean;
    showKeyTakeaway: boolean;
    prioritizeByImportance: boolean;
  };

  createdBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.7 GradingDeadLetterEntry (`/tenants/{tenantId}/gradingDeadLetter/{entryId}`)

```typescript
interface GradingDeadLetterEntry {
  id: string;
  submissionId: string;
  questionSubmissionId?: string;
  pipelineStep: "ocr" | "scouting" | "grading";
  error: string;
  errorStack?: string;
  attempts: number;
  lastAttemptAt: Timestamp;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolutionMethod?: "retry_success" | "manual_grade" | "dismissed";
  createdAt: Timestamp;
}
```

### 3.8 ExamAnalytics (`/tenants/{tenantId}/examAnalytics/{examId}`)

```typescript
interface ExamAnalytics {
  id: string; // Same as examId
  tenantId: string;
  examId: string;

  // Overall stats
  totalSubmissions: number;
  gradedSubmissions: number;
  avgScore: number;
  avgPercentage: number;
  passRate: number;
  medianScore: number;

  // Score distribution (histogram buckets)
  scoreDistribution: {
    buckets: { min: number; max: number; count: number }[];
  };

  // Per-question analytics
  questionAnalytics: Record<
    string,
    {
      questionId: string;
      avgScore: number;
      maxScore: number;
      avgPercentage: number;
      difficultyIndex: number; // 0–1 (0 = hardest)
      discriminationIndex: number; // How well question separates high/low performers
      commonMistakes: string[];
      commonStrengths: string[];
    }
  >;

  // Per-class breakdown
  classBreakdown: Record<
    string,
    {
      classId: string;
      className: string;
      avgScore: number;
      passRate: number;
      submissionCount: number;
    }
  >;

  // Topic performance
  topicPerformance: Record<
    string,
    {
      topic: string;
      avgPercentage: number;
      weakStudentCount: number;
    }
  >;

  computedAt: Timestamp;
  lastUpdatedAt: Timestamp;
}
```

---

## 4. Exam Lifecycle Flow

```
┌──────────┐    ┌─────────────────────┐    ┌────────────────────────┐
│  CREATE   │───▶│ UPLOAD QUESTION     │───▶│ AI EXTRACT QUESTIONS   │
│  EXAM     │    │ PAPER               │    │ (Cloud Function)       │
│           │    │                     │    │                        │
│ draft     │    │ question_paper_     │    │ question_paper_        │
│
  │    │ uploaded            │    │ extracted              │
└──────────┘    └─────────────────────┘    └────────────────────────┘
                                                     │
                                                     ▼
                                          ┌────────────────────────┐
                                          │ REVIEW & EDIT RUBRICS  │
                                          │ (Teacher UI)           │
                                          │                        │
                                          │ Teacher reviews AI-    │
                                          │ extracted questions,   │
                                          │ edits rubric criteria  │
                                          └────────────────────────┘
                                                     │
                                                     ▼
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────┐
│ RESULTS RELEASED │◀───│ GRADING COMPLETE     │◀───│ PUBLISH EXAM │
│                  │    │                     │    │              │
│ results_released │    │ completed           │    │ published    │
│                  │    │                     │    │              │
│ Students/parents │    │ All submissions     │    │ Ready for    │
│ can view results │    │ graded & reviewed   │    │ answer sheet │
└──────────────────┘    └─────────────────────┘    │ uploads      │
                              ▲                    └──────────────┘
                              │                           │
                        ┌─────┴──────────┐               │
                        │ TEACHER REVIEW │               │
                        │                │               │
                        │ Review grades, │               ▼
                        │ override if    │    ┌─────────────────────┐
                        │ needed         │    │ UPLOAD ANSWER       │
                        │                │    │ SHEETS              │
                        │ ready_for_     │    │ (web or scanner)    │
                        │ review         │    │                     │
                        └────────────────┘    │ → triggers AI       │
                              ▲               │   grading pipeline  │
                              │               └─────────────────────┘
                              │                           │
                              │                           ▼
                              │               ┌─────────────────────┐
                              └───────────────│ AI GRADING          │
                                              │ PIPELINE            │
                                              │                     │
                                              │ Panopticon scout    │
                                              │ → RELMS grade       │
                                              │ → aggregate scores  │
                                              └─────────────────────┘
```

### 4.1 Step-by-Step

1. **Create Exam** — Teacher/Admin creates exam with metadata (title, subject,
   classes, marks, date). Status: `draft`.

2. **Upload Question Paper** — Upload PDF/images of the physical question paper.
   Images stored in Cloud Storage at
   `tenants/{tenantId}/exams/{examId}/question-papers/`. Status:
   `question_paper_uploaded`.

3. **AI Question Extraction** — Cloud Function `extractQuestions` sends question
   paper images to Gemini 2.5 Flash. AI extracts: question text (with LaTeX),
   maxMarks, rubric criteria. Questions saved as subcollection documents.
   Status: `question_paper_extracted`.

4. **Rubric Review & Edit** — Teacher reviews AI-extracted questions in the UI.
   Can edit: question text, marks allocation, rubric criteria. Each question's
   `rubric` field is a `UnifiedRubric` with `scoringMode: 'criteria_based'`.

5. **Publish Exam** — Teacher marks exam as ready for submissions. Status:
   `published`.

6. **Upload Answer Sheets** — Teacher, Admin, or Scanner uploads answer sheet
   images per student. Creates a `Submission` document. Triggers the grading
   pipeline.

7. **AI Grading Pipeline** — Automated pipeline: Panopticon scouting → RELMS
   grading per question. See Section 6 for state machine details.

8. **Teacher Review** — Teacher reviews AI-graded results. Can override any
   grade with a reason. Submission moves to `reviewed`.

9. **Result Release** — Teacher/Admin releases results. Status:
   `results_released`. Students and parents can now view grades.

---

## 5. Submission Pipeline

### 5.1 Answer Sheet Upload Flow

```
Source: Teacher (web upload) OR Scanner operator (scanner app)
         │
         ▼
┌────────────────────────────────────────┐
│ 1. Upload images to Cloud Storage      │
│    Path: tenants/{tenantId}/exams/     │
│    {examId}/submissions/{submissionId}/│
│    answer-sheets/{filename}.jpg        │
│                                        │
│ 2. Create Submission document          │
│    pipelineStatus: 'uploaded'          │
│    retryCount: 0                       │
│                                        │
│ 3. Trigger: onSubmissionCreated        │
│    → Enqueue Cloud Task for mapping    │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 4. processAnswerMapping (worker)       │
│    Panopticon scouting                 │
│    → Build interleaved context         │
│    → Call Gemini 2.5 Flash             │
│    → Parse routing map                 │
│    → Create QuestionSubmission docs    │
│    pipelineStatus: 'scouting_complete' │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 5. processAnswerGrading (worker)       │
│    For each QuestionSubmission:        │
│    → Load evaluation settings          │
│    → Build dynamic RELMS prompt        │
│    → Call Gemini 2.5 Flash             │
│    → Parse structured feedback         │
│    → Save UnifiedEvaluationResult      │
│    pipelineStatus: 'grading_complete'  │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ 6. finalizeSubmission                  │
│    → Aggregate all question scores     │
│    → Calculate total, percentage, grade│
│    → Update exam stats (denormalized)  │
│    pipelineStatus: 'ready_for_review'  │
└────────────────────────────────────────┘
```

### 5.2 Student-Submission Matching

When uploading answer sheets, the uploader must select:

1. **Exam** (from published exams)
2. **Student** (from students enrolled in exam's classes)

The system creates a `Submission` document linking `examId` + `studentId` +
`classId`. One submission per student per exam (enforced by application logic;
query before creating).

### 5.3 Batch Upload

For bulk grading, the teacher uploads answer sheets for multiple students in
sequence. Each student's answer sheets create a separate `Submission`, each
triggering an independent pipeline run. Pipelines execute in parallel (up to
Cloud Tasks concurrency limits).

---

## 6. Grading Pipeline State Machine

### 6.1 State Diagram

```
                        submission_uploaded
                              │
                              ▼
                        ocr_processing ──[fail]──▶ ocr_failed
                              │                        │
                           [success]              [retry ≤ 3x]
                              │                        │
                              ▼                   [max retries]
                        scouting ──[fail]──▶ scouting_failed
                              │                        │
                           [success]              [retry ≤ 3x]
                              │                        │
                              ▼                   [max retries]
                        scouting_complete                │
                              │                        ▼
                              ▼              manual_review_needed
                        grading ──────────────────▶ (DLQ entry created)
                              │                    (teacher notified)
                   ┌──────────┴──────────┐
                   │                     │
              [all pass]         [partial fail]
                   │                     │
                   ▼                     ▼
            grading_complete      grading_partial
                   │                     │
                   │          ┌──────────┴──────────┐
                   │          │                     │
                   │    [teacher retries     [teacher manually
                   │     failed Qs]          grades failed Qs]
                   │          │                     │
                   │          ▼                     ▼
                   │    grading_complete      grading_complete
                   │          │                     │
                   └──────────┴──────────┬──────────┘
                                         │
                                         ▼
                                  ready_for_review
                                         │
                                    [teacher reviews]
                                         │
                                         ▼
                                      reviewed
                                         │
                                  [release results]
                                         │
                                         ▼
                                  results_released
```

### 6.2 State Transition Table

| Current State       | Event                        | Next State             | Action                                |
| ------------------- | ---------------------------- | ---------------------- | ------------------------------------- |
| `uploaded`          | Pipeline start               | `ocr_processing`       | Download images, validate format      |
| `ocr_processing`    | OCR success                  | `scouting`             | Enqueue scouting task                 |
| `ocr_processing`    | OCR fail (retries left)      | `ocr_failed`           | Retry with exponential backoff        |
| `ocr_failed`        | Retry triggered              | `ocr_processing`       | Re-attempt OCR                        |
| `ocr_failed`        | Max retries exceeded         | `manual_review_needed` | Create DLQ entry, notify teacher      |
| `scouting`          | Scouting success             | `scouting_complete`    | Save routing map                      |
| `scouting`          | Scouting fail (retries left) | `scouting_failed`      | Retry with exponential backoff        |
| `scouting_failed`   | Retry triggered              | `scouting`             | Re-attempt scouting                   |
| `scouting_failed`   | Max retries exceeded         | `manual_review_needed` | Create DLQ entry, notify teacher      |
| `scouting_complete` | Grading started              | `grading`              | Enqueue per-question grading tasks    |
| `grading`           | All questions graded         | `grading_complete`     | Aggregate scores                      |
| `grading`           | Some questions failed        | `grading_partial`      | Mark failed questions, notify teacher |
| `grading_partial`   | Teacher retries failed Qs    | `grading`              | Re-enqueue failed questions only      |
| `grading_partial`   | Teacher manually grades      | `grading_complete`     | Save manual grades                    |
| `grading_complete`  | Finalization done            | `ready_for_review`     | Calculate totals, update stats        |
| `ready_for_review`  | Teacher approves             | `reviewed`             | Mark as reviewed                      |
| `reviewed`          | Results released             | `results_released`     | Notify students/parents               |

### 6.3 Per-Question Grading States

Each `QuestionSubmission` has its own independent `gradingStatus`:

```
pending → processing → graded
                    → failed → [retry] → processing
                             → [manual] → manual
graded → [teacher override] → overridden
```

This enables **partial grading**: if 8/10 questions grade successfully and 2
fail, the teacher sees the 8 graded results immediately and can choose to retry
or manually grade the failed 2.

---

## 7. Cloud Function Specifications

### 7.1 Callable Functions

#### `extractQuestions`

```typescript
// Trigger: Callable (by Teacher/Admin)
// Region: us-central1
// Timeout: 540s (9 min)
// Memory: 2 GiB

interface ExtractQuestionsRequest {
  tenantId: string;
  examId: string;
}

interface ExtractQuestionsResponse {
  success: boolean;
  questions: ExamQuestion[];
  metadata: {
    questionCount: number;
    tokensUsed: number;
    cost: number;
    extractedAt: string;
  };
}

// Flow:
// 1. Validate caller has permission (tenantAdmin or teacher with canCreateExams)
// 2. Load exam document, verify status is 'question_paper_uploaded'
// 3. Download question paper images from Cloud Storage as base64
// 4. Call Gemini 2.5 Flash with extraction prompt
// 5. Parse JSON response, validate rubric criteria sum to maxMarks
// 6. Create ExamQuestion documents in subcollection
//    - rubric field uses UnifiedRubric with scoringMode: 'criteria_based'
// 7. Update exam status to 'question_paper_extracted'
// 8. Log LLM usage
// 9. Update RTDB progress for real-time UI feedback
```

#### `uploadAnswerSheets`

```typescript
// Trigger: Callable (by Teacher/Admin/Scanner)
// Region: us-central1
// Timeout: 300s

interface UploadAnswerSheetsRequest {
  tenantId: string;
  examId: string;
  studentId: string;
  classId: string;
  imageUrls: string[]; // Cloud Storage URLs (client uploads first)
}

// Flow:
// 1. Validate caller has permission
// 2. Verify exam is 'published' status
// 3. Verify student is enrolled in one of exam's classes
// 4. Check for existing submission (prevent duplicates)
// 5. Create Submission document with pipelineStatus: 'uploaded'
// 6. Enqueue Cloud Task for answer mapping
```

#### `retryFailedQuestions`

```typescript
// Trigger: Callable (by Teacher/Admin)

interface RetryFailedQuestionsRequest {
  tenantId: string;
  submissionId: string;
  questionIds?: string[]; // Specific questions, or all failed if omitted
}

// Flow:
// 1. Load submission, verify it's in 'grading_partial' state
// 2. Find failed QuestionSubmissions
// 3. Reset their gradingStatus to 'pending'
// 4. Enqueue grading Cloud Tasks for each
// 5. Update submission pipelineStatus to 'grading'
```

#### `manualGradeQuestion`

```typescript
// Trigger: Callable (by Teacher/Admin with canManuallyGrade)

interface ManualGradeRequest {
  tenantId: string;
  submissionId: string;
  questionId: string;
  score: number;
  reason: string;
}

// Flow:
// 1. Validate permission
// 2. Validate score <= question.maxMarks
// 3. Save manualOverride to QuestionSubmission
// 4. Update gradingStatus to 'overridden' (if AI graded) or 'manual' (if new)
// 5. Recalculate submission totals
// 6. Check if all questions now graded → update pipeline status
```

#### `releaseExamResults`

```typescript
// Trigger: Callable (by Teacher/Admin)

interface ReleaseResultsRequest {
  tenantId: string;
  examId: string;
  classIds?: string[]; // Release per-class, or all if omitted
}

// Flow:
// 1. Validate permission
// 2. Update all matching submissions: resultsReleased = true
// 3. Update exam status to 'results_released'
// 4. Create in-app notifications for affected students
// 5. If parent portal enabled, notify parents too
```

### 7.2 Worker Functions (HTTP, invoked by Cloud Tasks)

#### `processAnswerMapping`

```typescript
// Trigger: Cloud Task (answer-mapping queue)
// Timeout: 540s
// Memory: 4 GiB
// Max attempts: 3
// Backoff: exponential (5s, 15s, 45s)

// Input: { tenantId, submissionId }
//
// Algorithm (Panopticon):
// 1. Load exam, questions, submission, tenant data
// 2. Fetch tenant's Gemini API key from Secret Manager
// 3. Download all question paper + answer sheet images as base64
// 4. Build interleaved content:
//    === QUESTION PAPER START ===
//    [Question Paper Page 0] ... [Question Paper Page N]
//    === QUESTION PAPER END ===
//    === ANSWER SHEETS START ===
//    [Answer Sheet Page 0] ... [Answer Sheet Page M]
//    === ANSWER SHEETS END ===
// 5. Send to Gemini 2.5 Flash with Panopticon system + user prompts
// 6. Parse JSON response → routing_map, confidence, notes
// 7. Apply "Sandwich Rule": if Q appears on pages 2 and 5,
//    infer pages 3-4 also belong to Q
// 8. Create QuestionSubmission documents for each question
// 9. Save scoutingResult to submission
// 10. Update pipelineStatus to 'scouting_complete'
// 11. Enqueue grading Cloud Tasks for each question
```

#### `processAnswerGrading`

```typescript
// Trigger: Cloud Task (answer-grading queue)
// Timeout: 300s
// Memory: 1 GiB
// Max attempts: 3
// Backoff: exponential (5s, 15s, 45s)

// Input: { tenantId, submissionId, questionId }
//
// Algorithm (RELMS):
// 1. Idempotency check — skip if already graded
// 2. Load QuestionSubmission (for page mapping)
// 3. Load ExamQuestion (for text, rubric)
// 4. Resolve rubric: question.rubric ?? exam.evaluationSettings ?? tenant.default
// 5. Download answer images (from mapping.imageUrls) as base64
// 6. Load tenant's EvaluationSettings (enabled dimensions)
// 7. Build dynamic RELMS prompt:
//    - System prompt: evaluator persona
//    - User prompt: question text + rubric criteria + enabled dimensions
//    - Images: answer page images
// 8. Call Gemini 2.5 Flash (temperature: 0.1, responseMimeType: 'application/json')
// 9. Parse structured JSON response
// 10. Transform to UnifiedEvaluationResult
// 11. Save evaluation to QuestionSubmission
// 12. Update gradingStatus to 'graded'
// 13. Log LLM usage to llmCallLogs
// 14. Check if all questions graded → finalize submission if so
//
// On failure:
// - If retries left → Cloud Tasks auto-retries with backoff
// - If max retries → set gradingStatus to 'failed'
// - Update submission to 'grading_partial' if any question failed
// - Create GradingDeadLetterEntry
```

#### `finalizeSubmission`

```typescript
// Called internally after last question is graded

// Steps:
// 1. Load all QuestionSubmissions for this submission
// 2. Calculate: totalScore = sum(evaluation.score for graded Qs)
// 3. Calculate: percentage, grade (A+, A, B+, B, C, F)
// 4. Update submission.summary
// 5. Update submission.pipelineStatus to 'ready_for_review'
// 6. Atomically increment exam.stats.gradedSubmissions
// 7. Update examAnalytics (debounced via Cloud Tasks)
```

### 7.3 Trigger Functions

#### `onSubmissionCreated`

```typescript
// Trigger: Firestore onDocumentCreated
// Path: tenants/{tenantId}/submissions/{submissionId}

// Action:
// 1. Validate submission has answerSheets.images
// 2. Update pipelineStatus to 'ocr_processing'
// 3. Enqueue Cloud Task: processAnswerMapping
//    Queue: answer-mapping
//    URL: /processAnswerMapping
//    Body: { tenantId, submissionId }
```

#### `onExamStatusChanged`

```typescript
// Trigger: Firestore onDocumentUpdated
// Path: tenants/{tenantId}/exams/{examId}

// Action (on status change to 'results_released'):
// 1. Trigger notification creation for affected students
```

### 7.4 Cloud Tasks Queue Configuration

```yaml
# Answer Mapping Queue
answer-mapping:
  location: us-central1
  maxConcurrentDispatches: 5
  maxDispatchesPerSecond: 10
  maxAttempts: 3
  minBackoff: 5s
  maxBackoff: 45s
  maxRetryDuration: 600s

# Answer Grading Queue
answer-grading:
  location: us-central1
  maxConcurrentDispatches: 20
  maxDispatchesPerSecond: 50
  maxAttempts: 3
  minBackoff: 5s
  maxBackoff: 45s
  maxRetryDuration: 300s
```

---

## 8. AI Integration Design

### 8.1 LLMWrapper Usage

All AI calls go through the shared `LLMWrapper` class:

```typescript
// Initialize per-call with tenant's API key
const apiKey = await getGeminiApiKey(tenantId); // From Secret Manager
const llm = new LLMWrapper({
  provider: "gemini",
  apiKey,
  defaultModel: "gemini-2.5-flash",
  enableLogging: true,
});

// Call with full metadata for audit trail
const result = await llm.call(
  prompt,
  {
    clientId: tenantId,
    userId: callerUid,
    userRole: "teacher",
    purpose: "answer_grading",
    operation: "relmsEvaluation",
    resourceType: "questionSubmission",
    resourceId: questionSubmissionId,
    model: "gemini-2.5-flash",
    temperature: 0.1,
    maxTokens: 4096,
  },
  {
    images: answerImages,
    systemPrompt: relmsSystemPrompt,
    responseMimeType: "application/json",
  }
);
```

### 8.2 Prompt Specifications

#### Question Extraction Prompt

**Purpose:** Extract questions + rubric from question paper images **Model:**
Gemini 2.5 Flash **Temperature:** 0.1 **Max tokens:** 4096 **Input:** Question
paper images (base64)

**Output schema:**

```json
{
  "questions": [
    {
      "questionNumber": "Q1",
      "text": "Calculate the integral... (LaTeX supported)",
      "maxMarks": 5,
      "hasDiagram": false,
      "rubric": {
        "criteria": [
          { "description": "Correct setup of integral", "marks": 2 },
          { "description": "Correct evaluation", "marks": 2 },
          { "description": "Final answer with units", "marks": 1 }
        ]
      }
    }
  ]
}
```

**Key prompt instructions:**

- Extract ALL questions with complete accuracy
- Generate rubric criteria that sum exactly to maxMarks
- Use LaTeX notation for math expressions
- Return ONLY valid JSON

#### Panopticon Scouting Prompt

**Purpose:** Map answer pages to questions using global context **Model:**
Gemini 2.5 Flash (1M context window) **Temperature:** 0.1 **Input:** Interleaved
question paper + answer sheet images

**System prompt emphasis:**

- You are a perfect pattern recognition system
- Identify question-answer mappings even with jumbled uploads
- Handle unlabeled continuation pages
- Use page INDICES (0-based), not labels

**Output schema:**

```json
{
  "routing_map": { "Q1": [0, 1], "Q2": [2], "Q3": [3, 4] },
  "confidence": { "Q1": 0.95, "Q2": 0.88, "Q3": 0.92 },
  "notes": { "Q1": "Answer spans 2 pages", "Q2": "Partial answer" }
}
```

#### RELMS Dynamic Evaluation Prompt

**Purpose:** Grade a single question with structured feedback **Model:** Gemini
2.5 Flash **Temperature:** 0.1 **Input:** Answer images + question text +
rubric + enabled dimensions

**Dynamic prompt generation:**

```typescript
function buildDynamicRELMSPrompt(
  question: ExamQuestion,
  rubric: UnifiedRubric,
  enabledDimensions: EvaluationDimension[]
): string {
  // 1. Include question text and marks
  // 2. Include rubric criteria (from UnifiedRubric.criteria)
  // 3. For each enabled dimension (sorted by priority):
  //    - Include dimension name, description, promptGuidance
  //    - Specify expected feedback format
  // 4. Include scoring instructions
  // 5. Include output JSON schema
}
```

**Output schema:**

```json
{
  "rubric_score": 8,
  "max_rubric_score": 10,
  "confidence_score": 0.92,
  "rubric_breakdown": [
    {
      "criterion": "Correct setup",
      "awarded": 2,
      "max": 2,
      "feedback": "Well done"
    },
    {
      "criterion": "Evaluation",
      "awarded": 1,
      "max": 2,
      "feedback": "Sign error in step 3"
    }
  ],
  "structuredFeedback": {
    "critical_issues": [
      {
        "issue": "Sign error in integration",
        "whyItMatters": "Changes final answer",
        "howToFix": "Check signs when substituting limits",
        "severity": "major"
      }
    ],
    "structure_flow": [
      {
        "issue": "Good logical progression",
        "howToFix": "N/A",
        "severity": "minor"
      }
    ]
  },
  "strengths": ["Clear working shown", "Correct method choice"],
  "weaknesses": ["Sign error in evaluation"],
  "missingConcepts": [],
  "summary": {
    "keyTakeaway": "Review sign conventions when evaluating definite integrals",
    "overallComment": "Strong understanding of integration method, minor calculation error"
  },
  "mistake_classification": "Silly Error"
}
```

### 8.3 API Key Management

```
TenantAdmin sets API key
    → Cloud Function: setTenantApiKey()
        → Stores in Google Cloud Secret Manager
        → Saves reference path in Tenant.settings.geminiKeyRef
        → Sets Tenant.settings.geminiKeySet = true

At grading time:
    → Cloud Function reads Secret Manager using geminiKeyRef
    → Passes key to LLMWrapper
    → Key NEVER stored in Firestore, NEVER in client bundle
```

### 8.4 Cost Tracking

Every LLM call is logged to `/tenants/{tenantId}/llmCallLogs/{callId}`:

```typescript
interface LLMCallLog {
  callId: string;
  tenantId: string;
  userId: string;
  purpose:
    | "question_extraction"
    | "answer_mapping"
    | "answer_grading"
    | "ai_chat";
  operation: string;
  resourceType: string;
  resourceId: string;
  model: string;
  tokens: { input: number; output: number; total: number };
  cost: { input: number; output: number; total: number; currency: "USD" };
  timing: { latencyMs: number };
  success: boolean;
  error?: string;
  createdAt: Timestamp;
}
```

---

## 9. Scanner App Architecture

### 9.1 Overview

The scanner app is a mobile-first web application (PWA-ready) for scanner
operators to capture and upload answer sheet images. **For the initial
implementation, the scanner app operates online-only.** Offline support may be
added in a future phase.

### 9.2 App Flow

```
Login (school code → scanner credentials)
    │
    ▼
Dashboard
    │
    ▼
Select Exam (from published exams for scanner's tenant)
    │
    ▼
Select Student (from students enrolled in exam's classes)
    │
    ▼
Capture Answer Sheets
    ├── Camera capture (device camera)
    └── File upload (gallery/file picker)
    │
    ▼
Review & Submit
    ├── Image preview (swipe through pages)
    ├── Client-side compression (resize to 2048px max, 80% quality)
    └── Upload to Cloud Storage
    │
    ▼
Confirmation
    └── Submission created, pipeline triggered
```

### 9.3 Scanner Authentication

```
1. TenantAdmin registers scanner device in Admin UI
   → Cloud Function creates /scanners/{scannerId} + Firebase Auth account
   → Returns one-time setup code

2. Scanner enters setup code
   → Cloud Function validates, generates custom token
   → Scanner stores refresh token locally

3. Custom token TTL: 1 hour (auto-refresh)

4. Device revocation:
   → TenantAdmin marks scanner as 'revoked'
   → Cloud Function deletes Firebase Auth account
   → Next token refresh fails → scanner locked out
```

### 9.4 Image Handling

- **Accepted formats:** JPEG, PNG, PDF
- **Max size per image:** 10 MB
- **Max pages per submission:** 40
- **Client-side processing:** Resize to 2048px max dimension, compress to 80%
  JPEG quality
- **Storage path:**
  `tenants/{tenantId}/exams/{examId}/submissions/{submissionId}/answer-sheets/{page_N}.jpg`

---

## 10. Rubric Editing UI

### 10.1 Rubric Editor Component

After AI extraction, the teacher reviews and edits questions in the Exam Editor
screen. Each question displays:

```
┌─────────────────────────────────────────────────────┐
│ Question 1                                    [5 marks] │
│ ─────────────────────────────────────────────────── │
│ Text: "Calculate the definite integral of..."       │
│ [Edit Text]                                         │
│                                                     │
│ Rubric (criteria_based):                            │
│ ┌─────────────────────────────────────────────┐     │
│ │ ☑ Correct setup of integral       [2] marks │     │
│ │ ☑ Correct evaluation              [2] marks │     │
│ │ ☑ Final answer with units         [1] marks │     │
│ │                                             │     │
│ │ Total: 5/5 marks ✓                         │     │
│ │ [+ Add Criterion]                           │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│ Model Answer (optional):                            │
│ [                                              ]    │
│                                                     │
│ [Save Changes]  [Reset to AI-Extracted]             │
└─────────────────────────────────────────────────────┘
```

### 10.2 Rubric Validation Rules

- Sum of criterion marks MUST equal `question.maxMarks`
- Each criterion must have a non-empty description
- At least one criterion per question
- `scoringMode` is always `criteria_based` for AI-extracted rubrics
- Teacher can optionally add `evaluatorGuidance` (free-text instructions for the
  AI grader)
- Teacher can add a `modelAnswer` for reference

### 10.3 Bulk Rubric Operations

- **Apply template:** Apply a saved rubric template to multiple questions
- **Reset to AI-extracted:** Revert a question's rubric to the original AI
  extraction
- **Copy rubric:** Copy one question's rubric to another

---

## 11. Manual Grade Override

### 11.1 Override Flow

```
Teacher views graded submission
    │
    ▼
Clicks question → sees AI grade + feedback
    │
    ▼
Clicks "Override Grade"
    │
    ▼
┌─────────────────────────────────────────┐
│ Override Grade for Q3                    │
│                                         │
│ AI Score: 6/10                          │
│                                         │
│ New Score: [___] / 10                   │
│                                         │
│ Reason (required):                      │
│ [                                  ]    │
│ [                                  ]    │
│                                         │
│ [Cancel]  [Submit Override]             │
└─────────────────────────────────────────┘
    │
    ▼
QuestionSubmission updated:
  - manualOverride: { score, reason, overriddenBy, overriddenAt, originalScore }
  - gradingStatus: 'overridden'
    │
    ▼
Submission totals recalculated
```

### 11.2 Override Rules

- `gradingConfig.allowManualOverride` must be `true` on the exam
- `gradingConfig.requireOverrideReason` controls whether reason is mandatory
  (default: true)
- Override score must be ≤ `question.maxMarks` and ≥ 0
- Original AI score and full evaluation are preserved in
  `manualOverride.originalScore`
- Override is audited: who, when, original score, new score, reason
- The override score is used in final grade calculations, not the AI score

---

## 12. Result Release Flow

### 12.1 Release Process

```
Teacher navigates to Exam Detail → Results tab
    │
    ▼
Sees grading progress:
  - Total submissions: 45
  - Graded: 42
  - Pending: 3
  - Average: 72%
    │
    ▼
[Release Results] button (enabled when ≥1 submission is grading_complete/reviewed)
    │
    ▼
Confirmation dialog:
  "Release results for 42 graded submissions?"
  "Students and parents will be able to view grades."
    │
    ▼
Cloud Function: releaseExamResults
  1. Update all graded submissions: resultsReleased = true
  2. Update exam.status = 'results_released'
  3. Create in-app notifications for students in affected classes
    │
    ▼
Students see results in Student Portal
Parents see results in Parent Portal
```

### 12.2 Selective Release

- Teacher can release results per-class (not all-or-nothing)
- Unreleased submissions remain hidden from students/parents
- Already-released results cannot be "un-released" (but grades can still be
  overridden)

### 12.3 Student Result View

```
┌─────────────────────────────────────────────────────┐
│ Mathematics Final Exam — Grade 10                    │
│ Date: Feb 15, 2026                                   │
│                                                      │
│ ┌────────────────────────────────────────┐           │
│ │  Score: 78/100  │  Grade: B+  │  78%  │           │
│ └────────────────────────────────────────┘           │
│                                                      │
│ Question 1 (5 marks)                     Score: 5/5  │
│ ┌──────────────────────────────────────────────┐     │
│ │ ✅ Strengths:                                │     │
│ │    - Clear working shown                     │     │
│ │    - Correct method choice                   │     │
│ │                                              │     │
│ │ 📋 Key Takeaway:                             │     │
│ │    Excellent integral evaluation             │     │
│ └──────────────────────────────────────────────┘     │
│                                                      │
│ Question 2 (10 marks)                    Score: 6/10 │
│ ┌──────────────────────────────────────────────┐     │
│ │ ❌ Critical Issues:                          │     │
│ │    - Sign error in step 3                    │     │
│ │      Why it matters: Changes final answer    │     │
│ │      How to fix: Check signs at limits       │     │
│ │                                              │     │
│ │ ✅ Strengths:                                │     │
│ │    - Good problem setup                      │     │
│ │                                              │     │
│ │ 📋 Key Takeaway:                             │     │
│ │    Review sign conventions                   │     │
│ └──────────────────────────────────────────────┘     │
│                                                      │
│ [Download PDF]                                       │
└─────────────────────────────────────────────────────┘
```

### 12.4 Parent Result View

Same as student view, accessed through parent portal after selecting a child.
Shows all released exam results for the linked student(s).

---

## 13. Exam Analytics

### 13.1 Analytics Computation

`ExamAnalytics` is computed by a Cloud Function triggered when:

- All submissions for an exam reach `grading_complete` or `reviewed` status
- On-demand when teacher requests analytics view
- Nightly batch recomputation (Cloud Scheduler)

### 13.2 Analytics Dashboard (Teacher View)

```
┌─────────────────────────────────────────────────────┐
│ Exam Analytics: Mathematics Final — Grade 10         │
│                                                      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│ │ Avg: 72% │ │ Pass: 85%│ │ Graded:  │ │ Median: │ │
│ │          │ │          │ │ 42/45    │ │ 75%     │ │
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
│                                                      │
│ Score Distribution:                                  │
│ ┌──────────────────────────────────────────────┐     │
│ │ 90-100: ████████ 8                           │     │
│ │ 80-89:  ████████████ 12                      │     │
│ │ 70-79:  ██████████ 10                        │     │
│ │ 60-69:  ██████ 6                             │     │
│ │ 50-59:  ████ 4                               │     │
│ │ <50:    ██ 2                                 │     │
│ └──────────────────────────────────────────────┘     │
│                                                      │
│ Per-Question Analysis:                               │
│ ┌──────────┬────────────┬────────────┬──────────┐   │
│ │ Question │ Avg Score  │ Difficulty │ Common   │   │
│ │          │            │ Index      │ Mistake  │   │
│ ├──────────┼────────────┼────────────┼──────────┤   │
│ │ Q1 (5m)  │ 4.2 (84%) │ 0.84       │ -        │   │
│ │ Q2 (10m) │ 6.1 (61%) │ 0.61       │ Sign err │   │
│ │ Q3 (15m) │ 9.8 (65%) │ 0.65       │ Missing  │   │
│ │          │            │            │ proof    │   │
│ └──────────┴────────────┴────────────┴──────────┘   │
│                                                      │
│ Per-Class Breakdown:                                 │
│ ┌──────────────────────┬─────────┬──────────┐       │
│ │ Class                │ Avg     │ Pass Rate│       │
│ ├──────────────────────┼─────────┼──────────┤       │
│ │ Grade 10 - Section A │ 75%     │ 90%      │       │
│ │ Grade 10 - Section B │ 68%     │ 78%      │       │
│ └──────────────────────┴─────────┴──────────┘       │
│                                                      │
│ Weak Topics: [Definite Integrals] [Trigonometric    │
│               Identities]                            │
└─────────────────────────────────────────────────────┘
```

### 13.3 Analytics Cloud Function

```typescript
// computeExamAnalytics
// Trigger: Cloud Task (debounced, 3-minute window)
// Input: { tenantId, examId }

// Steps:
// 1. Load all submissions for exam where pipelineStatus in
//    ['grading_complete', 'reviewed', 'results_released']
// 2. For each submission, load all QuestionSubmissions
// 3. Compute: avgScore, medianScore, passRate, scoreDistribution
// 4. Per-question: avgScore, difficultyIndex, discriminationIndex
// 5. Per-class: avgScore, passRate
// 6. Topic performance: aggregate by exam.topics
// 7. Write/update ExamAnalytics document
```

---

## 14. PDF Result Export

### 14.1 PDF Generation

PDF generation is a Cloud Function that renders a student's exam results as a
downloadable PDF.

```typescript
// generateResultPDF
// Trigger: Callable (by Teacher/Admin/Student/Parent)
// Input: { tenantId, submissionId }
// Output: { downloadUrl: string }

// Steps:
// 1. Validate caller has access (student can download own, parent can download child's,
//    teacher/admin can download any in their tenant)
// 2. Load: submission, all questionSubmissions, exam, student, tenant
// 3. Generate PDF with:
//    - School branding (tenant logo, name)
//    - Student info (name, roll number, class)
//    - Exam info (title, subject, date, total marks)
//    - Overall score, grade, percentage
//    - Per-question breakdown:
//      - Question text (first 200 chars)
//      - Score / maxMarks
//      - Rubric breakdown
//      - Key feedback (strengths, weaknesses, key takeaway)
// 4. Upload PDF to Cloud Storage (temp path, signed URL with 24h expiry)
// 5. Return download URL
```

### 14.2 PDF Layout

```
┌───────────────────────────────────────┐
│ [School Logo]  EXAMINATION REPORT     │
│                                       │
│ Student: John Doe (Roll: 10A-023)     │
│ Class: Grade 10 - Section A           │
│ Exam: Mathematics Final Exam          │
│ Date: February 15, 2026              │
│                                       │
│ ════════════════════════════════       │
│ OVERALL RESULT                        │
│ Score: 78/100  │  Grade: B+  │  78%  │
│ ════════════════════════════════       │
│                                       │
│ QUESTION-WISE BREAKDOWN               │
│ ───────────────────────────           │
│ Q1 (5 marks): 5/5                     │
│ ✓ Correct setup of integral: 2/2     │
│ ✓ Correct evaluation: 2/2           │
│ ✓ Final answer with units: 1/1      │
│ Strengths: Clear working shown        │
│                                       │
│ Q2 (10 marks): 6/10                   │
│ ✓ Correct setup: 2/2                │
│ ✗ Evaluation: 1/2                    │
│   → Sign error in step 3             │
│ ✓ Final answer: 1/1                 │
│ Key Takeaway: Review sign conventions │
│                                       │
│ ... (continued for all questions)     │
│                                       │
│ ────────────────────────────────      │
│ Generated by LevelUp + AutoGrade     │
│ Date: Feb 19, 2026                   │
└───────────────────────────────────────┘
```

### 14.3 PDF Library

Use `@react-pdf/renderer` (server-side rendering in Cloud Functions) or
`pdfmake` for PDF generation. The Cloud Function runs headless — no browser
needed.

---

## 15. Firestore Security Rules

### 15.1 Exam Rules

```javascript
match /tenants/{tenantId}/exams/{examId} {
  // Read: any active member of tenant
  allow read: if isAuthenticated()
    && belongsToTenant(tenantId);

  // Create: tenantAdmin or teacher with canCreateExams
  allow create: if isAuthenticated()
    && (isTenantAdmin(tenantId) || hasTeacherPermission(tenantId, 'canCreateExams'));

  // Update: tenantAdmin or teacher with canCreateExams (only for their classes)
  allow update: if isAuthenticated()
    && (isTenantAdmin(tenantId) || hasTeacherPermission(tenantId, 'canCreateExams'));

  // Delete: tenantAdmin only
  allow delete: if isAuthenticated() && isTenantAdmin(tenantId);

  // Questions subcollection
  match /questions/{questionId} {
    allow read: if isAuthenticated() && belongsToTenant(tenantId);
    allow write: if isAuthenticated()
      && (isTenantAdmin(tenantId) || hasTeacherPermission(tenantId, 'canEditRubrics'));
  }
}
```

### 15.2 Submission Rules

```javascript
match /tenants/{tenantId}/submissions/{submissionId} {
  // Read: tenantAdmin, teacher (class-scoped), student (own), parent (child's)
  allow read: if isAuthenticated() && (
    isTenantAdmin(tenantId)
    || isTeacherForSubmission(tenantId, submissionId)
    || isStudentOwner(tenantId, submissionId)
    || isParentOfStudent(tenantId, submissionId)
  );

  // Student/parent reads restricted to released results only
  // (enforced in application layer, not rules — rules check tenant membership)

  // Write: tenantAdmin, teacher, scanner (create only)
  allow create: if isAuthenticated()
    && (isTenantAdmin(tenantId)
        || isTeacher(tenantId)
        || isScanner(tenantId));

  allow update: if isAuthenticated()
    && (isTenantAdmin(tenantId) || isTeacher(tenantId));

  // QuestionSubmissions subcollection
  match /questionSubmissions/{qId} {
    allow read: if isAuthenticated() && belongsToTenant(tenantId);
    // Writes only via Admin SDK (Cloud Functions)
    allow write: if false;
  }
}
```

### 15.3 Evaluation Settings Rules

```javascript
match /tenants/{tenantId}/evaluationSettings/{settingsId} {
  allow read: if isAuthenticated() && belongsToTenant(tenantId);
  allow write: if isAuthenticated() && isTenantAdmin(tenantId);
}
```

### 15.4 Dead Letter Queue Rules

```javascript
match /tenants/{tenantId}/gradingDeadLetter/{entryId} {
  allow read: if isAuthenticated()
    && (isTenantAdmin(tenantId) || isTeacher(tenantId));
  // Writes only via Admin SDK (Cloud Functions)
  allow write: if false;
}
```

### 15.5 Exam Analytics Rules

```javascript
match /tenants/{tenantId}/examAnalytics/{examId} {
  allow read: if isAuthenticated()
    && (isTenantAdmin(tenantId) || isTeacher(tenantId));
  // Writes only via Admin SDK (Cloud Functions)
  allow write: if false;
}
```

### 15.6 Helper Functions

```javascript
function isScanner(tenantId) {
  return (
    request.auth.token.role == "scanner" &&
    request.auth.token.tenantId == tenantId
  );
}

function isStudentOwner(tenantId, submissionId) {
  return (
    request.auth.token.role == "student" &&
    request.auth.token.tenantId == tenantId &&
    resource.data.studentId == request.auth.token.studentId &&
    resource.data.resultsReleased == true
  );
}

function isParentOfStudent(tenantId, submissionId) {
  return (
    request.auth.token.role == "parent" &&
    request.auth.token.tenantId == tenantId &&
    resource.data.resultsReleased == true &&
    request.auth.token.studentIds.hasAny([resource.data.studentId])
  );
}

function isTeacherForSubmission(tenantId, submissionId) {
  return (
    isTeacher(tenantId) &&
    request.auth.token.classIds.hasAny([resource.data.classId])
  );
}
```

---

## 16. Error Handling & Retry Patterns

### 16.1 Retry Configuration

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffMs: [5000, 15000, 45000], // Exponential: 5s, 15s, 45s
  deadLetterAfterMaxRetries: true,
};
```

### 16.2 Retry Implementation

Retries are handled at two levels:

1. **Cloud Tasks level:** The Cloud Tasks queue is configured with
   `maxAttempts: 3` and exponential backoff. If a worker function throws an
   error or returns a non-2xx status, Cloud Tasks automatically retries.

2. **Application level:** For per-question grading failures, the application
   tracks `gradingRetryCount` on each `QuestionSubmission`. If a question fails
   after Cloud Tasks exhausts its retries, the question is marked as `failed`
   and a DLQ entry is created.

### 16.3 Dead Letter Queue

When a grading step fails after all retries:

1. Create `GradingDeadLetterEntry` in `/tenants/{tenantId}/gradingDeadLetter/`
2. Update submission `pipelineStatus` to `grading_partial` or
   `manual_review_needed`
3. Show badge in teacher dashboard: "3 grading failures need attention"
4. Teacher can:
   - **Retry:** Click "Retry" on failed question → re-enqueue grading task
   - **Manual grade:** Enter score manually → mark as `manual`
   - **Dismiss:** Mark DLQ entry as resolved without action

### 16.4 Error Categories

| Error Type                             | Retry?             | Resolution                   |
| -------------------------------------- | ------------------ | ---------------------------- |
| Gemini API rate limit (429)            | Yes (with backoff) | Auto-retry                   |
| Gemini API timeout                     | Yes                | Auto-retry                   |
| Gemini API invalid response (bad JSON) | Yes (1 retry)      | DLQ if persists              |
| Image download failure                 | Yes                | Auto-retry                   |
| Firestore write failure                | Yes                | Auto-retry                   |
| Question not found in answer           | No                 | Mark as "not_found", score 0 |
| Invalid rubric (criteria sum mismatch) | No                 | Flag to teacher              |

### 16.5 Monitoring

- DLQ count displayed as badge in teacher dashboard
- DLQ items older than 24 hours highlighted as urgent
- Admin dashboard shows aggregate DLQ count across all exams

---

## 17. Migration Plan

### 17.1 Scope

Migrate existing AutoGrade data from `/clients/{clientId}/...` to
`/tenants/{tenantId}/...`.

### 17.2 Collection Mapping

| Old Path                                                            | New Path                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/clients/{clientId}`                                               | `/tenants/{tenantId}`                                               |
| `/clients/{clientId}/classes/{classId}`                             | `/tenants/{tenantId}/classes/{classId}`                             |
| `/clients/{clientId}/students/{studentId}`                          | `/tenants/{tenantId}/students/{studentId}`                          |
| `/clients/{clientId}/teachers/{teacherId}`                          | `/tenants/{tenantId}/teachers/{teacherId}`                          |
| `/clients/{clientId}/parents/{parentId}`                            | `/tenants/{tenantId}/parents/{parentId}`                            |
| `/clients/{clientId}/exams/{examId}`                                | `/tenants/{tenantId}/exams/{examId}`                                |
| `/clients/{clientId}/exams/{examId}/questions/{qId}`                | `/tenants/{tenantId}/exams/{examId}/questions/{qId}`                |
| `/clients/{clientId}/submissions/{subId}`                           | `/tenants/{tenantId}/submissions/{subId}`                           |
| `/clients/{clientId}/submissions/{subId}/questionSubmissions/{qId}` | `/tenants/{tenantId}/submissions/{subId}/questionSubmissions/{qId}` |
| `/clients/{clientId}/evaluationSettings/{id}`                       | `/tenants/{tenantId}/evaluationSettings/{id}`                       |

### 17.3 Field Transformations

```typescript
// Client → Tenant
{
  // Rename
  clientId → tenantId,
  schoolCode → tenantCode,
  adminUid → ownerUid,

  // Add new fields
  slug: generateSlug(client.name),
  subscription: {
    plan: client.subscriptionPlan,
    expiresAt: null,
    maxStudents: planLimits[client.subscriptionPlan].maxStudents,
  },
  features: {
    autoGradeEnabled: true,
    levelUpEnabled: false,         // Not yet enabled for existing AutoGrade clients
    scannerAppEnabled: true,
    aiGradingEnabled: true,
    // ... other features based on plan
  },
  settings: {
    geminiKeyRef: migrateApiKey(client.geminiApiKey), // Move to Secret Manager
    geminiKeySet: !!client.geminiApiKey,
  },
}

// Exam.status expansion
'question_paper_uploaded' → 'question_paper_uploaded'  // unchanged
'in_progress' → 'published'                            // rename for clarity
'completed' → 'completed'                              // unchanged

// Question rubric → UnifiedRubric
{
  criteria: question.rubric.criteria,   // unchanged
  scoringMode: 'criteria_based',        // new field
  dimensions: [],                       // empty initially
}

// Submission fields
{
  pipelineStatus: derivePipelineStatus(submission.summary.status),
  retryCount: 0,
  resultsReleased: false,              // All results unreleased initially
}
```

### 17.4 API Key Migration

Existing `client.geminiApiKey` (stored in Firestore) must be migrated to Secret
Manager:

```typescript
async function migrateApiKey(
  clientId: string,
  geminiApiKey: string
): Promise<string> {
  const secretName = `tenant-${clientId}-gemini`;
  // Create secret in Secret Manager
  await secretManager.createSecret(secretName);
  await secretManager.addSecretVersion(secretName, geminiApiKey);
  // Return reference path
  return secretName;
}
```

### 17.5 Migration Execution

```
Phase A: Dual-Write (1 week)
  1. Deploy new Cloud Functions that write to both /clients/ and /tenants/
  2. Run migration script: copy all existing data from /clients/ to /tenants/
  3. Migrate API keys to Secret Manager
  4. Verify: document counts match, field-by-field sampling

Phase B: Read-New (1 week)
  1. Switch app reads to /tenants/ paths
  2. Continue dual-writing
  3. Monitor for errors

Phase C: Cleanup (after 2-week verification)
  1. Stop writing to /clients/
  2. Take Firestore export snapshot
  3. Delete /clients/ collection (after explicit sign-off)
```

### 17.6 Migration Risk Mitigation

- Migrate one client/tenant at a time (feature flag per tenantId)
- Automated comparison script runs every 6 hours during dual-write
- Rollback procedure: flip read path back to /clients/ via feature flag
- Zero-downtime: both paths work simultaneously during transition

---

## 18. Testing Strategy

### 18.1 Test Layers

| Layer                                | Tool                           | Scope                                                                                           |
| ------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Unit tests**                       | Vitest                         | Rubric validation, score calculation, grade assignment, prompt building, evaluation transformer |
| **Cloud Function integration tests** | Vitest + Firebase Emulator     | Full pipeline: extraction, scouting, grading, finalization                                      |
| **Firestore rule tests**             | `@firebase/rules-unit-testing` | All exam/submission/question security rules                                                     |
| **E2E tests**                        | Playwright                     | Exam creation → upload → grading → result view                                                  |
| **Migration tests**                  | Custom scripts + Emulator      | Data integrity per migration step                                                               |

### 18.2 Key Test Cases

#### Unit Tests

- `resolveRubric()` — correct inheritance chain resolution
- `calculateGrade()` — boundary cases (A+ at 90%, F at <40%)
- `buildDynamicRELMSPrompt()` — correct dimension inclusion
- `transformEvaluation()` — LLM response → UnifiedEvaluationResult
- `applyManualOverride()` — score recalculation
- `validateRubric()` — criteria sum matches maxMarks

#### Integration Tests (Firebase Emulator)

- Full exam lifecycle: create → extract → publish → submit → grade → release
- Partial grading: 8/10 succeed, 2 fail → grading_partial state
- Manual override: AI grade 6 → teacher overrides to 8 → totals recalculate
- Retry flow: failed question → retry → success
- DLQ: 3 retries fail → DLQ entry created
- Result release: only released submissions visible to students

#### Security Rule Tests

- Student cannot read unreleased results
- Parent can only read linked child's results
- Scanner can create submissions but not update grades
- Teacher can only access submissions for their classes
- Cross-tenant access denied

### 18.3 Coverage Targets

- Cloud Functions: 70%+ line coverage
- Shared utilities: 80%+ line coverage
- Firestore rules: 100% branch coverage
- E2E: Top 5 critical flows

---

## 19. Dependencies on Other Modules

### 19.1 Hard Dependencies (Must Be Built First)

| Module                         | Dependency                               | Reason                                                      |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------------------- |
| **Phase 0: Foundation**        | Monorepo, shared-types package           | `UnifiedRubric`, `UnifiedEvaluationResult` type definitions |
| **Phase 1: Identity & Tenant** | `/users`, `/userMemberships`, `/tenants` | Auth, roles, tenant context                                 |
| **Phase 2: Tenant Operations** | `/classes`, `/students`, `/teachers`     | Exam assignment, student enrollment                         |

### 19.2 Soft Dependencies (Can Be Built In Parallel)

| Module                        | Dependency                   | Reason                                                          |
| ----------------------------- | ---------------------------- | --------------------------------------------------------------- |
| **LevelUp Core**              | `UnifiedItem` type           | Cross-domain linkage (exam question ↔ digital item)             |
| **Cross-System Intelligence** | ExamAnalytics                | Feeds into studentProgressSummaries, weak topic recommendations |
| **Notification System**       | Result release notifications | In-app notifications to students/parents                        |

### 19.3 Shared Type Contracts

AutoGrade depends on these shared types from `packages/shared-types`:

```typescript
// From content/rubric.ts
import {
  UnifiedRubric,
  RubricCriterion,
  EvaluationDimension,
  RubricScoringMode,
} from "@shared/types";

// From content/evaluation.ts
import {
  UnifiedEvaluationResult,
  FeedbackItem,
  RubricBreakdownItem,
} from "@shared/types";

// From content/exam.ts (AutoGrade-owned)
export { Exam, ExamQuestion, SubQuestion } from "@shared/types";

// From content/submission.ts (AutoGrade-owned)
export { Submission, QuestionSubmission } from "@shared/types";
```

---

## 20. Future: Extensible Exam Type System

### 20.1 Design for Extensibility

The current implementation supports only Type 1 (Standard) exams. The
architecture is designed to support additional exam types in the future via an
extensible pattern:

```typescript
// Future exam type registry
type ExamType = "standard" | "diagram_heavy" | "high_volume" | "manual_rubric";

interface ExamTypeConfig {
  type: ExamType;
  label: string;
  description: string;

  // Pipeline configuration
  pipeline: {
    extractionEnabled: boolean; // Does this type use AI extraction?
    scoutingStrategy: "panopticon" | "simple_page_mapping" | "none";
    gradingStrategy: "relms" | "visual_evaluation" | "manual_only";
  };

  // Type-specific question fields
  additionalQuestionFields?: string[];

  // Type-specific UI components
  questionEditorComponent?: string;
  gradingViewComponent?: string;
}

// Registry
const EXAM_TYPES: Record<ExamType, ExamTypeConfig> = {
  standard: {
    type: "standard",
    label: "Standard Exam",
    description: "Separate answer sheets, text-based answers",
    pipeline: {
      extractionEnabled: true,
      scoutingStrategy: "panopticon",
      gradingStrategy: "relms",
    },
  },
  diagram_heavy: {
    type: "diagram_heavy",
    label: "Diagram-Heavy Exam",
    description: "Students answer on question paper, visual responses",
    pipeline: {
      extractionEnabled: true,
      scoutingStrategy: "simple_page_mapping",
      gradingStrategy: "visual_evaluation",
    },
    additionalQuestionFields: [
      "questionType",
      "expectedElements",
      "evaluationGuidance",
      "pageIndex",
    ],
  },
  // ... more types
};
```

### 20.2 How to Add a New Exam Type

1. Add type to `ExamType` union
2. Define `ExamTypeConfig` in registry
3. Implement extraction prompt (if different from standard)
4. Implement scouting strategy (if different)
5. Implement grading strategy (if different)
6. Add UI components for question editing and grading review
7. No changes needed to Submission or QuestionSubmission schemas

---

## Appendix A: Firestore Indexes for AutoGrade

```json
{
  "indexes": [
    {
      "collectionGroup": "exams",
      "fields": [
        { "fieldPath": "classIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "examDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "exams",
      "fields": [
        { "fieldPath": "linkedSpaceId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "fields": [
        { "fieldPath": "examId", "order": "ASCENDING" },
        { "fieldPath": "classId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "fields": [
        { "fieldPath": "studentId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "fields": [
        { "fieldPath": "examId", "order": "ASCENDING" },
        { "fieldPath": "pipelineStatus", "order": "ASCENDING" }
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
      "collectionGroup": "gradingDeadLetter",
      "fields": [
        { "fieldPath": "resolvedAt", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## Appendix B: Cloud Storage Paths

```
tenants/{tenantId}/
  exams/{examId}/
    question-papers/
      page_{N}.jpg                     // Uploaded question paper images
    submissions/{submissionId}/
      answer-sheets/
        page_{N}.jpg                   // Uploaded answer sheet images
    results/
      {submissionId}_result.pdf        // Generated result PDFs (temp, signed URLs)
```

## Appendix C: Grade Calculation

```typescript
function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}
```

Grade thresholds are configurable per exam via `Exam.gradingConfig` (future
enhancement). Default thresholds shown above.

---

**Document Version:** 1.0 **Date:** 2026-02-19 **Status:** Design Plan — Ready
for Implementation
