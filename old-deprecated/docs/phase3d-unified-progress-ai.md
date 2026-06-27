# Phase 3D: Unified Progress Tracking, Analytics & AI Architecture

**Version:** 1.0 **Date:** 2026-02-19 **Status:** Architecture Design — Ready
for Implementation **Scope:** Unified Platform — LevelUp + AutoGrade

---

## Table of Contents

1. [Overview](#1-overview)
2. [Unified Progress Model](#2-unified-progress-model)
3. [Progress Data Schema](#3-progress-data-schema)
4. [Analytics Architecture](#4-analytics-architecture)
5. [AI Feature Unification](#5-ai-feature-unification)
6. [AI Usage Tracking](#6-ai-usage-tracking)
7. [Cross-System Intelligence](#7-cross-system-intelligence)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Appendix: Query Patterns](#9-appendix-query-patterns)

---

## 1. Overview

### 1.1 The Unification Challenge

LevelUp and AutoGrade track student progress in fundamentally different ways:

| Dimension              | LevelUp                                  | AutoGrade                                     |
| ---------------------- | ---------------------------------------- | --------------------------------------------- |
| **Unit of Progress**   | `UserStoryPointProgress` per story point | `Submission` per exam                         |
| **Granularity**        | Item-level (per question/material)       | Question-level (per exam question)            |
| **Scoring Model**      | Points-based (0–N, accumulated)          | Marks-based (0–100%, percentage + grade)      |
| **AI Feedback**        | Real-time tutoring (chat, in-session)    | Post-hoc grading feedback (RELMS)             |
| **Time Tracking**      | Per-item time spent (seconds)            | Exam duration + per-question time             |
| **Retry Semantics**    | Multiple attempts, best score kept       | One submission per exam (teacher can regrade) |
| **Completion Trigger** | Student completes all items              | Teacher releases grade                        |

The unified model must:

1. Preserve both systems' data fidelity (no lossy merging)
2. Enable cross-system queries (e.g., "student progress across all physics
   content")
3. Support a single student dashboard aggregating both sources
4. Provide teachers with correlated insights (exam score ↔ course engagement)

### 1.2 Design Principles

- **Source of truth stays in its domain** — LevelUp progress lives in
  `userStoryPointProgress`; AutoGrade submissions live in `submissions`. Neither
  is merged into the other.
- **A lightweight aggregation layer** bridges both into a unified view.
- **Org-scoped multi-tenancy** applies to all progress and analytics data.
- **RTDB handles hot reads** (live progress, leaderboards); Firestore handles
  persistence.

---

## 2. Unified Progress Model

### 2.1 Conceptual Model

```
Organization (Client)
└── User (Student)
    ├── LevelUp Progress
    │   ├── Space (Course) Progress       ← aggregated
    │   │   └── StoryPoint Progress       ← per story point
    │   │       └── Item Progress         ← per item (embedded in SP progress doc)
    │   └── Practice Range Progress       ← per space (RTDB)
    │
    ├── AutoGrade Progress
    │   └── Submission (per exam)         ← per exam attempt
    │       └── QuestionSubmission        ← per question in that exam
    │
    └── Unified Profile (aggregated)      ← cross-system summary
        ├── subject_performance           ← score by subject (both systems)
        ├── engagement_score              ← LevelUp engagement
        └── exam_performance              ← AutoGrade exam history
```

### 2.2 Progress Record Linkage

The key linkage between the two systems is at the **subject/topic** level. Both
systems tag content with subjects and topics, enabling cross-system queries
without merging schemas:

```
LevelUp Item → topics: ["thermodynamics", "heat_transfer"]
AutoGrade Question → rubric.expectedConcepts: ["thermodynamics", "specific_heat"]
```

The `StudentProgressSummary` aggregation document (Section 3.3) joins these by
topic to produce insights like "Student scored 42% on exam thermodynamics
questions, but has 78% LevelUp completion on thermodynamics story points."

### 2.3 Unified Scoring Normalization

To compare progress across systems, all scores are normalized to a **0.0–1.0
scale** in the aggregation layer only. Source data is never modified.

| System                  | Source Field                             | Normalized Formula   |
| ----------------------- | ---------------------------------------- | -------------------- |
| LevelUp (question item) | `pointsEarned / totalPoints`             | Direct (already 0–1) |
| LevelUp (story point)   | `percentage`                             | Direct (already 0–1) |
| AutoGrade (submission)  | `summary.percentage / 100`               | `/100`               |
| AutoGrade (question)    | `evaluation.score / evaluation.maxScore` | Division             |

---

## 3. Progress Data Schema

### 3.1 LevelUp Progress (Existing, Org-Scoped)

**Collection:**
`/organizations/{orgId}/userStoryPointProgress/{userId}_{storyPointId}`

This is the existing LevelUp progress document, moved into org-scope in the
unified platform.

```typescript
interface UserStoryPointProgress {
  // Identity
  id: string; // "${userId}_${storyPointId}"
  userId: string; // maps to auth.uid
  orgId: string; // tenant scope
  courseId: string; // parent space
  storyPointId: string;

  // Status
  status: "not_started" | "in_progress" | "completed";
  startedAt?: number; // epoch ms
  completedAt?: number;

  // Scoring
  pointsEarned: number;
  totalPoints: number;
  percentage: number; // 0.0–1.0

  // Item-level progress map (embedded, not subcollection)
  items: Record<string, ItemProgressEntry>; // key = itemId

  // Metadata
  updatedAt: number;
}

interface ItemProgressEntry {
  itemId: string;
  itemType: ItemType;
  completed: boolean;
  completedAt?: number;
  timeSpentSeconds?: number;
  interactions?: number;
  lastUpdatedAt: number;

  // For question items
  questionData?: {
    status: "pending" | "correct" | "incorrect" | "partial";
    attemptsCount: number;
    bestScore: number; // 0.0–1.0
    pointsEarned: number;
    totalPoints: number;
    solved: boolean;
    submissions: QuestionSubmissionEntry[];
  };
}

interface QuestionSubmissionEntry {
  submittedAt: number;
  answer: unknown; // type-specific
  evaluation?: {
    correct: boolean;
    score: number; // 0.0–1.0
    feedback?: string;
    pointsEarned: number;
  };
}
```

### 3.2 AutoGrade Progress (Existing, Org-Scoped)

**Collection:** `/organizations/{orgId}/submissions/{submissionId}`
**Subcollection:**
`/organizations/{orgId}/submissions/{submissionId}/questionSubmissions/{qId}`

This is the AutoGrade submission model (unchanged schema, org-scoped).

```typescript
interface Submission {
  id: string;
  orgId: string;
  examId: string;
  studentId: string; // maps to userMembership.id
  studentUserId: string; // maps to auth.uid
  classId: string;

  // Answer sheets
  answerSheets: {
    images: string[]; // Cloud Storage URLs
    uploadedAt: Timestamp;
    uploadedBy: string;
  };

  // Grading pipeline state
  status: SubmissionStatus; // see AI_SYSTEM_ARCHITECTURE.md §3.2
  gradingJobId?: string;

  // Results
  summary: {
    totalScore: number;
    maxScore: number;
    percentage: number; // 0–100
    grade: string; // A, B, C, D, F
    questionsGraded: number;
    totalQuestions: number;
    completedAt?: Timestamp;
  };

  // Flags
  flaggedForReview: boolean;
  isReleased: boolean; // visible to student?

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface QuestionSubmission {
  id: string;
  submissionId: string;
  questionId: string;
  examId: string;

  // Answer mapping
  mapping: {
    pageIndices: number[];
    imageUrls: string[];
    scoutedAt: Timestamp;
  };

  // RELMS evaluation
  evaluation?: {
    score: number;
    maxScore: number;
    confidenceScore: number; // 0.0–1.0
    rubricBreakdown: RubricScore[];
    structuredFeedback: Record<string, FeedbackItem[]>;
    strengths: string[];
    summary: { keyTakeaway: string; overallComment: string };
    mistakeClassification:
      | "Conceptual"
      | "Silly Error"
      | "Knowledge Gap"
      | "None";
    aiReasoning?: string;
    gradedAt: Timestamp;
  };

  // Human override
  manualOverride?: {
    score: number;
    note: string;
    overriddenBy: string;
    overriddenAt: Timestamp;
  };

  status: "scouted" | "grading" | "graded" | "failed" | "manual_override";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.3 Unified Student Progress Summary (New — Aggregation Layer)

**Collection:** `/organizations/{orgId}/studentProgressSummaries/{userId}`

This document is **derived**, not authoritative. It is maintained by Cloud
Functions that react to changes in `userStoryPointProgress` and `submissions`.
It powers dashboard views without expensive cross-collection queries.

```typescript
interface StudentProgressSummary {
  userId: string;
  orgId: string;
  classIds: string[]; // denormalized for filtering
  updatedAt: Timestamp;

  // ─── LevelUp Summary ─────────────────────────────────────────────────────
  levelup: {
    totalSpaces: number;
    completedSpaces: number;
    totalStoryPoints: number;
    completedStoryPoints: number;
    overallPointsEarned: number;
    overallTotalPoints: number;
    overallPercentage: number; // 0.0–1.0

    // Per-space summary (last 10 active, paginated in queries)
    spaces: Record<
      string,
      {
        spaceId: string;
        spaceName: string; // denormalized
        percentage: number;
        status: "not_started" | "in_progress" | "completed";
        lastActiveAt: number;
        storyPointsCompleted: number;
        totalStoryPoints: number;
      }
    >;

    // Per-subject roll-up (from item.topics)
    subjectPerformance: Record<
      string,
      {
        subject: string;
        averageScore: number; // 0.0–1.0
        itemsCompleted: number;
        totalItems: number;
      }
    >;

    practiceStats: {
      spacesAttempted: number;
      totalItemsCompleted: number;
      averageAccuracy: number;
    };
  };

  // ─── AutoGrade Summary ────────────────────────────────────────────────────
  autograde: {
    totalExams: number;
    gradedExams: number;
    averagePercentage: number; // 0–100
    bestGrade: string;

    // Per-exam summary
    exams: Record<
      string,
      {
        examId: string;
        examTitle: string; // denormalized
        subject: string;
        examDate: Timestamp;
        percentage: number;
        grade: string;
        status: SubmissionStatus;
        isReleased: boolean;
      }
    >;

    // Per-subject aggregation from exam questions
    subjectPerformance: Record<
      string,
      {
        subject: string;
        averagePercentage: number;
        examsCount: number;
        weakTopics: string[]; // topics with score < 50%
      }
    >;
  };

  // ─── Unified Cross-System Insights ────────────────────────────────────────
  insights: {
    // Topic-level correlation: LevelUp score vs AutoGrade score
    topicCorrelations: Array<{
      topic: string;
      levelupScore: number; // 0.0–1.0
      autogradeScore: number; // 0.0–1.0
      gapDirection: "levelup_ahead" | "autograde_ahead" | "aligned";
    }>;

    // Recommendations generated by insight engine
    recommendations: Array<{
      type: "practice" | "review" | "exam_prep";
      topic: string;
      reason: string;
      suggestedSpaceId?: string; // recommended LevelUp space
      priority: "high" | "medium" | "low";
      generatedAt: Timestamp;
    }>;

    // Engagement signals
    streakDays: number;
    lastActiveAt: Timestamp;
    totalTimeSpentMinutes: number; // LevelUp only (AutoGrade is exam-bound)
  };
}
```

### 3.4 Class-Level Progress Summary (New — Teacher View)

**Collection:** `/organizations/{orgId}/classProgressSummaries/{classId}`

Maintained by Cloud Functions aggregating all student summaries for a class.

```typescript
interface ClassProgressSummary {
  classId: string;
  orgId: string;
  updatedAt: Timestamp;
  studentCount: number;

  // ─── LevelUp Class Stats ──────────────────────────────────────────────────
  levelup: {
    // Per-space stats for this class
    spaces: Record<
      string,
      {
        spaceId: string;
        spaceName: string;
        averagePercentage: number;
        completedCount: number; // students who finished
        inProgressCount: number;
        notStartedCount: number;
        distributionBuckets: {
          // for histogram
          "0-25": number;
          "25-50": number;
          "50-75": number;
          "75-100": number;
        };
      }
    >;

    // Per-topic class performance
    topicPerformance: Record<
      string,
      {
        topic: string;
        classAverageScore: number;
        studentsBelowThreshold: number; // score < 0.5
      }
    >;
  };

  // ─── AutoGrade Class Stats ────────────────────────────────────────────────
  autograde: {
    // Per-exam stats
    exams: Record<
      string,
      {
        examId: string;
        examTitle: string;
        submittedCount: number;
        gradedCount: number;
        averagePercentage: number;
        highestScore: number;
        lowestScore: number;
        passRate: number; // percentage who passed
        distributionBuckets: {
          "0-25": number;
          "25-50": number;
          "50-75": number;
          "75-100": number;
        };
        // Per-question difficulty (from QuestionSubmissions)
        questionStats: Record<
          string,
          {
            questionId: string;
            averageScore: number;
            mostCommonMistake: string;
            attemptedCount: number;
          }
        >;
      }
    >;
  };

  // ─── Correlation Insights (Teacher-Facing) ────────────────────────────────
  insights: {
    topStudents: string[]; // top 5 userIds by combined score
    atRiskStudents: string[]; // students needing intervention
    weakTopicsClassWide: string[]; // topics where class average < 50%
    suggestedSpaces: string[]; // spaceIds recommended for class
  };
}
```

### 3.5 Timed Test Session (LevelUp, Org-Scoped)

**Collection:** `/organizations/{orgId}/timedTestSessions/{sessionId}`

```typescript
interface TimedTestSession {
  id: string;
  orgId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;
  attemptNumber: number;

  status: "in_progress" | "completed" | "expired" | "abandoned";
  startedAt: number;
  endedAt?: number;
  durationMinutes: number;
  totalQuestions: number;
  answeredQuestions: number;

  pointsEarned?: number;
  totalPoints?: number;
  percentage?: number; // 0.0–1.0

  // Ordered list of item IDs (randomized or fixed)
  questionOrder: string[];

  // Answer map: itemId → submission
  submissions: Record<
    string,
    {
      itemId: string;
      questionType: string;
      submittedAt: number;
      timeSpentSeconds: number;
      answer: unknown;
      evaluation?: {
        correct: boolean;
        score: number;
        pointsEarned: number;
        totalPoints: number;
      };
      markedForReview: boolean;
    }
  >;

  visitedItems: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
}
```

### 3.6 Practice Range Progress (RTDB, Real-Time)

**Path:** `organizations/{orgId}/practiceProgress/{userId}/{spaceId}`

```
{
  items: {
    [itemId]: {
      s: 'c' | 'i' | 'a' | 'p',      // correct, incorrect, attempted, pending
      t: number,                       // completedAt timestamp (epoch ms)
      a: number,                       // attempts count
      b?: number                       // best time in seconds
    }
  },
  stats: {
    itemsCompleted: number,
    totalItems: number,
    pointsEarned: number,
    averageAccuracy: number,           // 0.0–1.0
    lastActiveAt: number
  }
}
```

---

## 4. Analytics Architecture

### 4.1 Analytics Data Flow

```
┌───────────────────────────────────────────────────────────────────┐
│  SOURCE EVENTS (Firestore writes / RTDB updates)                  │
│                                                                   │
│  LevelUp: userStoryPointProgress updated                          │
│  AutoGrade: submission.status → 'complete'                        │
│  AutoGrade: questionSubmission graded                             │
│  LevelUp: timedTestSession completed                              │
│  LevelUp: practiceProgress updated (RTDB)                         │
└────────────────────────────┬──────────────────────────────────────┘
                             │ Firestore triggers / RTDB listeners
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│  AGGREGATION LAYER (Cloud Functions)                              │
│                                                                   │
│  1. StudentProgressSummary updater                                │
│     - Recomputes student-level summary                            │
│     - Triggers on: SP progress, submission, timed test            │
│                                                                   │
│  2. ClassProgressSummary updater                                  │
│     - Fan-out: one student change → class summary recalculated    │
│     - Batched: debounced 30s to avoid thundering herd             │
│                                                                   │
│  3. LLMUsageAggregator                                            │
│     - Daily cost summary per client                               │
│     - Runs on schedule (Cloud Scheduler, midnight)                │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│  ANALYTICS READS (Dashboard queries)                              │
│                                                                   │
│  Student Dashboard: /studentProgressSummaries/{userId}            │
│  Teacher Dashboard: /classProgressSummaries/{classId}             │
│  Exam Reports:      /organizations/{orgId}/examAnalytics/{examId} │
│  Admin Dashboard:   /organizations/{orgId}/orgAnalytics/current   │
│  Cost Tracking:     /organizations/{orgId}/costSummaries/daily/*  │
└───────────────────────────────────────────────────────────────────┘
```

### 4.2 Exam Analytics Document

**Collection:** `/organizations/{orgId}/examAnalytics/{examId}`

```typescript
interface ExamAnalytics {
  examId: string;
  orgId: string;
  computedAt: Timestamp;
  submissionCount: number;
  gradedCount: number;

  // Overall distribution
  scoreDistribution: {
    mean: number;
    median: number;
    standardDeviation: number;
    p25: number;
    p75: number;
    min: number;
    max: number;
    passRate: number; // percentage
    gradeDistribution: Record<string, number>; // A: 12, B: 23, ...
  };

  // Per-question analytics
  questions: Record<
    string,
    {
      questionId: string;
      questionText: string; // denormalized
      maxMarks: number;
      averageScore: number;
      averageScorePercent: number;
      attemptRate: number; // fraction who attempted vs skipped
      commonWeaknesses: string[];
      commonStrengths: string[];
      confidenceDistribution: {
        high: number; // count of AI grading with confidence >= 0.80
        medium: number;
        low: number;
      };
    }
  >;

  // Class breakdown
  classBreakdown: Record<
    string,
    {
      classId: string;
      className: string;
      averagePercentage: number;
      studentCount: number;
      passRate: number;
    }
  >;

  // Topic weak spots (for teacher remediation)
  topicInsights: Array<{
    topic: string;
    classAverageScore: number;
    suggestedSpaceId?: string; // recommended LevelUp space for remediation
  }>;
}
```

### 4.3 Organization-Level Analytics

**Collection:** `/organizations/{orgId}/orgAnalytics/current`

```typescript
interface OrgAnalytics {
  orgId: string;
  computedAt: Timestamp;
  period: "current_month";

  students: {
    total: number;
    active: number; // at least one activity in last 30 days
    averageEngagementScore: number;
  };

  levelup: {
    totalSpacesAssigned: number;
    totalStoryPointsCompleted: number;
    averageCompletionRate: number;
    topSpacesByEngagement: Array<{
      spaceId: string;
      spaceName: string;
      engagementScore: number;
    }>;
    aiChatSessions: number;
    averageChatTurns: number;
  };

  autograde: {
    totalExams: number;
    totalSubmissions: number;
    gradedSubmissions: number;
    averageGradingTimeMinutes: number;
    averageScore: number;
    examsByStatus: Record<string, number>;
    reviewQueueSize: number; // pending human moderation
  };

  ai: {
    totalLLMCalls: number;
    totalTokensUsed: number;
    totalCostUSD: number;
    costByTask: Record<string, number>;
    averageCostPerSubmission: number;
    averageCostPerChatSession: number;
  };
}
```

### 4.4 Analytics Update Strategy

| Summary Document           | Update Trigger                         | Strategy                                 | SLA      |
| -------------------------- | -------------------------------------- | ---------------------------------------- | -------- |
| `studentProgressSummaries` | SP progress write, submission complete | Real-time Cloud Function                 | < 30s    |
| `classProgressSummaries`   | Student summary updated                | Debounced Cloud Function (30s)           | < 2min   |
| `examAnalytics`            | All submissions for exam graded        | On-demand (teacher triggers) + daily job | < 5min   |
| `orgAnalytics/current`     | Cloud Scheduler                        | Nightly batch job (3 AM local)           | < 1 hour |
| RTDB leaderboards          | LevelUp item submitted                 | Real-time RTDB update                    | < 5s     |

### 4.5 Materialized Views for Teacher Dashboard

The teacher dashboard needs fast access to:

- All students in a class + their progress
- Comparison across exams in a subject
- Identification of at-risk students

Rather than running expensive multi-document queries at read time, the
`ClassProgressSummary` document acts as a materialized view. Teachers read one
document per class.

For the student detail drilldown view, the teacher reads:

1. `studentProgressSummaries/{studentId}` — for overall summary
2. `submissions?examId={examId}&studentId={studentId}` — for specific exam

---

## 5. AI Feature Unification

### 5.1 Feature Map

| Feature                            | Current System                      | Unified Strategy                      |
| ---------------------------------- | ----------------------------------- | ------------------------------------- |
| **Exam question extraction**       | AutoGrade (Gemini, Cloud Functions) | Unchanged — already server-side       |
| **Handwriting OCR**                | AutoGrade (Gemini multi-image)      | Unchanged                             |
| **Answer mapping (Panopticon)**    | AutoGrade (Gemini 1M context)       | Unchanged                             |
| **RELMS grading**                  | AutoGrade (Gemini, per-question)    | Unchanged                             |
| **Feedback generation**            | AutoGrade (RELMS output)            | Extended: link to LevelUp content     |
| **AI tutoring chat**               | LevelUp (Gemini, client-side)       | Migrate to server-side Cloud Function |
| **Question answer evaluation**     | LevelUp (Gemini, evaluator agent)   | Migrate to server-side                |
| **Question generation**            | LevelUp (unused/legacy)             | Deferred                              |
| **Exam → Practice recommendation** | None                                | New: Insight Engine                   |

### 5.2 Shared AI Infrastructure

Both systems share the `shared-ai` package (from AI_SYSTEM_ARCHITECTURE.md §2).
Key points:

**All AI calls are server-side.** LevelUp currently makes Gemini calls from the
client browser. In the unified platform, all AI calls go through Cloud Functions
using the `LLMWrapper`, which:

- Uses per-client API keys stored in Firestore (server-side only)
- Logs every call to `llmCallLogs`
- Tracks cost against the client's quota

### 5.3 AutoGrade Grading AI (Unchanged Architecture)

The AutoGrade grading pipeline from `AI_SYSTEM_ARCHITECTURE.md` is preserved
as-is:

```
Submission → OCR → Answer Mapping → RELMS Grading → Feedback → Moderation → Release
```

Key grading-related tables remain:

- `/organizations/{orgId}/submissions/{id}` — submission state machine
- `/organizations/{orgId}/submissions/{id}/questionSubmissions/{id}` —
  per-question grading
- `/organizations/{orgId}/moderationQueue/{id}` — human review queue

**Post-grading enhancement (new):** After grades are released, the system runs
an `InsightEngine` that cross-references weak topics with available LevelUp
spaces and populates `StudentProgressSummary.insights.recommendations`.

### 5.4 LevelUp AI Tutoring (Server-Side Migration)

#### Before (Current LevelUp)

```
Client Browser → Gemini SDK (client-side) → Gemini API
                 ↑ hardcoded API key in bundle
```

#### After (Unified Platform)

```
Client Browser → callSendChatMessage (Cloud Function) → LLMWrapper → Gemini API
                                                          ↓
                                                       LLMCallLog (Firestore)
```

**Migration steps:**

1. Move `GeminiModel.ts` logic into `functions/src/levelup/chat-handler.ts`
2. Replace client-side Gemini calls with HTTPS callable function
   `sendChatMessage`
3. `sendChatMessage` reads API key from client's Firestore document
4. Add logging via `LLMWrapper`
5. Remove `GeminiModel.ts` and API key from client bundle

#### Chat Session Schema (Updated for Unified Platform)

**Collection:** `/organizations/{orgId}/chatSessions/{sessionId}`

```typescript
interface ChatSession {
  sessionId: string;
  orgId: string; // tenant scope (new field)
  userId: string;
  userMembershipId: string; // links to org membership

  // Content context
  spaceId: string; // was courseId
  storyPointId?: string;
  itemId?: string;

  // Agent configuration
  agentId: string;
  agentSnapshot: AgentConfig; // snapshot at session creation time

  // Session metadata
  title: string;
  preview: string; // first 100 chars of first user message
  language: string;
  isActive: boolean;
  messageCount: number;

  // Full message history (stored in Firestore)
  messages: ChatMessage[];

  // System prompt (snapshot)
  systemPrompt: string;

  // AI call tracking
  totalTokensUsed: number;
  totalCostUSD: number;
  llmCallCount: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: MessageContent;
  timestamp: Timestamp;

  // For assistant messages
  tokensUsed?: number;
  latencyMs?: number;
  model?: string;
  llmCallLogId?: string; // links to the LLMCallLog document

  // For evaluator-agent messages
  evaluationResult?: {
    score: number; // 0.0–1.0
    feedback: string;
    criteria: Array<{ name: string; passed: boolean }>;
    confidence: number;
  };
}

type MessageContent =
  | { type: "text"; text: string }
  | { type: "media"; text?: string; media: MediaItem[] };
```

### 5.5 Evaluator Agent Flow (LevelUp, Server-Side)

When a student submits a text/code answer within a tutoring session:

```
Student submits answer (callable function: evaluateAnswer)
      │
      ▼
Cloud Function reads:
  - ItemDTO (question + payload + correct answer)
  - AgentConfig (evaluator rules + objectives)
  - Recent session context (last 10 messages)
      │
      ▼
LLMWrapper.call('answer_evaluation', {
  prompt: evaluatorPrompt.build({ question, answer, rubric, rules }),
  model: 'gemini-2.5-flash-lite'
})
      │
      ▼
EvaluationResult stored on ChatMessage
Session.items[itemId].questionData updated (ItemProgressEntry)
UserStoryPointProgress updated
      │
      ▼
Cloud Function returns result to client (real-time feedback)
```

### 5.6 Post-Grading AI: Exam Feedback Enhancement

After RELMS grading is complete and teacher releases grades, an optional
enhancement phase runs:

```typescript
// Cloud Function trigger: submission.isReleased transitions to true

async function enhanceGradingFeedback(submission: Submission): Promise<void> {
  // 1. For each questionSubmission with low score...
  const weakQuestions = await getWeakQuestions(submission);

  for (const qs of weakQuestions) {
    // 2. Find related LevelUp items by topic
    const relatedItems = await findLevelUpItemsByTopics(
      submission.orgId,
      qs.evaluation.relatedTopics
    );

    // 3. Update QuestionSubmission with content links
    await updateQuestionSubmission(qs.id, {
      feedbackEnhancements: {
        relatedLevelUpItems: relatedItems.map((i) => ({
          itemId: i.id,
          spaceId: i.spaceId,
          title: i.title,
          relevanceScore: i.relevanceScore,
        })),
        suggestedReviewTopics: qs.evaluation.missingConcepts,
      },
    });
  }

  // 4. Update StudentProgressSummary.insights.recommendations
  await updateStudentRecommendations(
    submission.studentUserId,
    submission.orgId
  );
}
```

### 5.7 Insight Engine (New — Cross-System Intelligence)

The Insight Engine generates actionable recommendations by correlating LevelUp
and AutoGrade data.

**Trigger:** Runs after each AutoGrade exam is fully graded AND whenever
`studentProgressSummaries` is updated.

```typescript
// Cloud Function: generateInsights(studentId, orgId)

async function generateInsights(
  studentId: string,
  orgId: string
): Promise<Insight[]> {
  const [summary, spaces, exams] = await Promise.all([
    getStudentProgressSummary(studentId, orgId),
    getAssignedSpaces(studentId, orgId),
    getStudentExamHistory(studentId, orgId),
  ]);

  const insights: Insight[] = [];

  // Pattern 1: Exam weak topic → recommend LevelUp space
  for (const examSummary of Object.values(summary.autograde.exams)) {
    const weakTopics = examSummary.weakTopics; // already computed
    for (const topic of weakTopics) {
      const bestSpace = await findBestSpaceForTopic(topic, orgId, spaces);
      if (bestSpace) {
        insights.push({
          type: "practice",
          topic,
          reason: `You scored below 50% on ${topic} in ${examSummary.examTitle}`,
          suggestedSpaceId: bestSpace.id,
          priority: "high",
          generatedAt: Timestamp.now(),
        });
      }
    }
  }

  // Pattern 2: High LevelUp engagement, low exam score → gap analysis
  for (const [topic, lvPerf] of Object.entries(
    summary.levelup.subjectPerformance
  )) {
    const agPerf = summary.autograde.subjectPerformance[topic];
    if (agPerf && lvPerf.averageScore > 0.7 && agPerf.averagePercentage < 50) {
      insights.push({
        type: "review",
        topic,
        reason: `You complete ${topic} content well (${Math.round(lvPerf.averageScore * 100)}%) but underperform on exams (${agPerf.averagePercentage}%). Focus on applied problem-solving.`,
        priority: "high",
        generatedAt: Timestamp.now(),
      });
    }
  }

  // Pattern 3: Low engagement on assigned space → prompt to start
  for (const [spaceId, spaceData] of Object.entries(summary.levelup.spaces)) {
    if (spaceData.status === "not_started") {
      insights.push({
        type: "exam_prep",
        topic: spaceData.spaceName,
        reason: `You haven't started ${spaceData.spaceName} yet`,
        suggestedSpaceId: spaceId,
        priority: "medium",
        generatedAt: Timestamp.now(),
      });
    }
  }

  return insights;
}
```

**Note:** The Insight Engine does NOT call an LLM. Insights are rule-based to
avoid cost and latency. LLM-powered insights are a future enhancement gated
behind a client feature flag.

---

## 6. AI Usage Tracking

### 6.1 LLM Call Log (Unified)

**Collection:** `/organizations/{orgId}/llmCallLogs/{callId}`

This extends AutoGrade's existing log schema to cover LevelUp's AI calls.

```typescript
interface LLMCallLog {
  // Identity
  callId: string;
  orgId: string;
  userId?: string;
  userRole?: "teacher" | "student" | "admin" | "system";

  // Task classification
  task: TaskType;
  /*
    AutoGrade tasks:
      'question_extraction' | 'answer_mapping' | 'ocr_handwriting' |
      'answer_grading' | 'feedback_summary' | 'feedback_enhancement'

    LevelUp tasks:
      'tutoring_chat' | 'answer_evaluation' | 'question_generation' |
      'context_summarization'

    System tasks:
      'insight_generation' | 'rubric_design'
  */

  // Provider details
  provider: "gemini" | "claude" | "openai";
  model: string;
  promptTemplateId?: string; // from PromptTemplate.id
  promptTemplateVersion?: string; // e.g. "1.2.0"

  // Token accounting
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;

  // Cost (USD)
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostUSD: number;

  // Performance
  latencyMs: number;
  tokensPerSecond?: number;

  // Outcome
  success: boolean;
  finishReason?: "STOP" | "MAX_TOKENS" | "SAFETY" | "ERROR";
  errorMessage?: string;

  // Context linking (one of these, depending on task)
  relatedResourceType?:
    | "submission"
    | "questionSubmission"
    | "chatSession"
    | "item"
    | "exam"
    | "storyPoint";
  relatedResourceId?: string;

  // Flags
  hasImages: boolean;
  imageCount?: number;
  promptHash?: string; // SHA256 for cache hit detection

  // Timestamps
  createdAt: Timestamp;
  callStartedAt: Timestamp;
  callCompletedAt?: Timestamp;

  // Custom tags (for filtering/reporting)
  tags?: string[];
}
```

### 6.2 Daily Cost Summary

**Collection:** `/organizations/{orgId}/costSummaries/daily/{YYYY-MM-DD}`

```typescript
interface DailyCostSummary {
  orgId: string;
  date: string; // YYYY-MM-DD
  computedAt: Timestamp;

  totalCostUSD: number;
  totalTokens: number;
  totalCalls: number;

  // Breakdown by task type
  byTask: Record<
    TaskType,
    {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      costUSD: number;
      averageLatencyMs: number;
      successRate: number;
    }
  >;

  // Breakdown by provider
  byProvider: Record<
    ProviderName,
    {
      calls: number;
      tokens: number;
      costUSD: number;
    }
  >;

  // Breakdown by user role
  byRole: Record<
    string,
    {
      calls: number;
      tokens: number;
      costUSD: number;
    }
  >;

  // Top cost drivers
  topExamsByAICost: Array<{
    examId: string;
    examTitle: string;
    costUSD: number;
    submissionsGraded: number;
  }>;
}
```

**Computation:** A Cloud Scheduler job runs at midnight (per timezone of org's
country) and aggregates `llmCallLogs` for the previous day using Firestore
aggregation queries.

### 6.3 Monthly Budget & Alerts

**Collection:** `/organizations/{orgId}/costSummaries/monthly/{YYYY-MM}`

```typescript
interface MonthlyCostSummary {
  orgId: string;
  month: string; // YYYY-MM
  computedAt: Timestamp;

  totalCostUSD: number;
  budgetLimitUSD?: number; // set by super admin per plan
  budgetUsagePercent: number; // totalCost / budgetLimit

  projectedMonthEndCostUSD: number;
  alertsSent: Array<{
    threshold: number; // e.g., 0.80 (80% of budget)
    sentAt: Timestamp;
    recipientEmail: string;
  }>;
}
```

**Alert thresholds (enforced by Cloud Functions):**

| Threshold              | Action                                 |
| ---------------------- | -------------------------------------- |
| 80% of monthly budget  | Warning email to client admin          |
| 100% of monthly budget | Critical alert + pause AI features     |
| Single call > $1 USD   | Anomaly log + super admin notification |
| Daily spend > $10      | Warning email                          |
| Daily spend > $50      | Critical alert + pause AI              |

### 6.4 Per-Submission AI Cost Tracking

For cost attribution, the `Submission` document stores a cost summary:

```typescript
// Added to Submission
aicostSummary?: {
  totalCostUSD: number;
  totalTokens: number;
  callCount: number;
  breakdown: {
    ocr: number;
    mapping: number;
    grading: number;
    feedback: number;
  };
};
```

For LevelUp chat sessions, the `ChatSession` document already stores
`totalCostUSD` and `llmCallCount` (see §5.4).

---

## 7. Cross-System Intelligence

### 7.1 Exam → LevelUp Recommendation Pipeline

```
Exam grading complete → Teacher releases grades
      │
      ▼
Cloud Function: examGradingComplete(examId, orgId)
      │
      ▼
For each student with released submission:
  1. Compute weak topics (questions with score < 50%)
  2. Query available LevelUp spaces for those topics
  3. Check if student is already enrolled in relevant spaces
  4. Generate recommendations (rule-based, no LLM)
  5. Update StudentProgressSummary.insights.recommendations
  6. If teacher has "auto-assign" enabled:
     - Assign recommended space to student's class
      │
      ▼
Student dashboard refreshes (Firestore real-time listener)
Student sees: "Based on your exam results, we recommend: [Space Name]"
```

### 7.2 Space Performance → Exam Prediction

For the teacher analytics dashboard, a simple correlation is computed:

```
For each class + subject:
  1. Get all students' LevelUp completion percentage for spaces in that subject
  2. Get all students' AutoGrade exam scores for exams in that subject
  3. Compute Pearson correlation (client-side, data already in summaries)
  4. If correlation > 0.5: display "Students who complete [Space] score X% higher on exams"
  5. If correlation < 0.2: flag for teacher to review content alignment
```

This is computed in the browser from pre-aggregated data — no server-side ML
required.

### 7.3 At-Risk Student Detection

A student is flagged as "at-risk" when any of these conditions are met (Cloud
Function runs nightly):

| Signal               | Threshold                               | Action                                                 |
| -------------------- | --------------------------------------- | ------------------------------------------------------ |
| AutoGrade exam score | < 40% on last exam                      | Flag in `ClassProgressSummary.insights.atRiskStudents` |
| LevelUp engagement   | < 20% completion after 2 weeks assigned | Flag + notify teacher                                  |
| Both systems         | Low LevelUp + Low exam scores           | High priority flag                                     |
| Timed test           | Expired without completion (2x)         | Flag                                                   |
| Practice range       | < 5 items completed in 7 days           | Low-priority flag                                      |

### 7.4 Student Dashboard Unified View

```
Student Dashboard Data Sources:
┌──────────────────────────────────────────────────────────────────┐
│  Primary data source: studentProgressSummaries/{userId}           │
│  (One Firestore read — all dashboard data)                        │
│                                                                  │
│  Drilldown:                                                       │
│  - Space detail: userStoryPointProgress (query by spaceId)       │
│  - Exam detail: submissions (query by studentId + examId)        │
│  - Practice detail: RTDB read (real-time)                        │
└──────────────────────────────────────────────────────────────────┘

Dashboard Sections:
1. Progress Overview (from summary.levelup + summary.autograde)
2. Recent Activity (from summary.levelup.spaces + summary.autograde.exams)
3. Recommendations (from summary.insights.recommendations)
4. Upcoming Exams (query: /exams where classIds contains student.classIds)
5. Leaderboard (RTDB: storyPointLeaderboard)
```

---

## 8. Implementation Roadmap

### Phase 3D.1 — Foundation (Week 1–2)

**Goal:** Establish aggregation infrastructure without breaking existing
systems.

1. Create `studentProgressSummaries` collection and schema
2. Write Cloud Function: `updateStudentProgressSummary`
   - Trigger: `userStoryPointProgress` write
   - Trigger: `submission` status → complete
3. Backfill existing data (script: recalculate all summaries from source)
4. Add `orgId` to `chatSessions` documents (migration)
5. Write Cloud Function: `updateClassProgressSummary` (debounced)

### Phase 3D.2 — LevelUp AI Migration (Week 2–3)

**Goal:** Move LevelUp AI calls server-side, add cost tracking.

1. Create `functions/src/levelup/chat-handler.ts`
   - Callable function: `sendChatMessage`
   - Uses `LLMWrapper` and `ContextManager`
   - Logs to `llmCallLogs`
2. Create `functions/src/levelup/answer-evaluator.ts`
   - Callable function: `evaluateAnswer`
   - Supports all LevelUp question types
3. Update client to call Cloud Functions instead of Gemini SDK directly
4. Remove client-side API key from LevelUp bundle
5. Test: verify cost logging, response quality parity

### Phase 3D.3 — Analytics Pipeline (Week 3–4)

**Goal:** Enable teacher analytics dashboards.

1. Write `examAnalytics` aggregation function
   - Trigger: all questionSubmissions for exam reach 'graded' status
   - Also: on-demand callable for teacher
2. Write nightly `orgAnalytics` job (Cloud Scheduler)
3. Write nightly `costSummary/daily` job
4. Write monthly `costSummary/monthly` + alert system
5. Implement cost alert thresholds (email via Firebase Extensions or SendGrid)

### Phase 3D.4 — Cross-System Intelligence (Week 4–5)

**Goal:** Deliver Insight Engine and recommendations.

1. Write `InsightEngine` (rule-based, no LLM)
   - Function: `generateStudentInsights(studentId, orgId)`
   - Trigger: `studentProgressSummaries` updated + `submission.isReleased`
     becomes true
2. Integrate `LevelUp Content Indexer`:
   - Index: `items.topics[]` → available spaces (for recommendation lookup)
   - Stored in: `/organizations/{orgId}/topicIndex/{topic}` → spaceIds[]
3. Write at-risk student detection (nightly Cloud Scheduler)
4. Update `ClassProgressSummary.insights.atRiskStudents`

### Phase 3D.5 — Enhanced Grading Feedback (Week 5–6)

**Goal:** Link AutoGrade feedback to LevelUp content.

1. Write `enhanceGradingFeedback` Cloud Function
   - Trigger: `submission.isReleased` transitions to true
   - Adds `feedbackEnhancements.relatedLevelUpItems` to questionSubmissions
2. Update student exam result view to show "Study this topic" links
3. A/B test: measure student click-through on recommendations

---

## 9. Appendix: Query Patterns

### 9.1 Student Dashboard Load

```typescript
// One read for all dashboard data
const summary = await getDoc(
  doc(db, "organizations", orgId, "studentProgressSummaries", userId)
);

// Real-time practice progress
const practiceRef = ref(
  rtdb,
  `organizations/${orgId}/practiceProgress/${userId}`
);
const practiceSnapshot = onValue(practiceRef, callback);
```

### 9.2 Teacher: Class Overview

```typescript
// One read per class
const classProgress = await getDoc(
  doc(db, "organizations", orgId, "classProgressSummaries", classId)
);

// Drilldown: specific exam in this class
const examAnalytics = await getDoc(
  doc(db, "organizations", orgId, "examAnalytics", examId)
);
```

### 9.3 Teacher: Individual Student Detail

```typescript
// Student summary (pre-aggregated)
const studentSummary = await getDoc(
  doc(db, "organizations", orgId, "studentProgressSummaries", studentId)
);

// Specific exam submission for this student
const submissions = await getDocs(
  query(
    collection(db, "organizations", orgId, "submissions"),
    where("studentUserId", "==", studentId),
    where("examId", "==", examId)
  )
);
```

### 9.4 LevelUp Progress for a Space

```typescript
// All story point progress for this user + space
const storyPointProgress = await getDocs(
  query(
    collection(db, "organizations", orgId, "userStoryPointProgress"),
    where("userId", "==", userId),
    where("spaceId", "==", spaceId),
    orderBy("updatedAt", "desc")
  )
);
```

### 9.5 AI Cost Report for Client Admin

```typescript
// Last 30 days of daily cost summaries
const costSummaries = await getDocs(
  query(
    collection(db, "organizations", orgId, "costSummaries", "daily"),
    where("date", ">=", thirtyDaysAgo),
    orderBy("date", "asc")
  )
);
```

### 9.6 LLM Usage for a Specific Exam

```typescript
// All AI calls related to a specific submission
const llmCalls = await getDocs(
  query(
    collection(db, "organizations", orgId, "llmCallLogs"),
    where("relatedResourceType", "==", "submission"),
    where("relatedResourceId", "==", submissionId)
  )
);
```

### 9.7 At-Risk Students in a Class

```typescript
// Read from pre-aggregated class summary (no per-student query)
const classProgress = await getDoc(
  doc(db, "organizations", orgId, "classProgressSummaries", classId)
);
const atRiskStudentIds = classProgress.data().insights.atRiskStudents;

// Batch get student summaries for display
const studentSummaries = await Promise.all(
  atRiskStudentIds.map((sid) =>
    getDoc(doc(db, "organizations", orgId, "studentProgressSummaries", sid))
  )
);
```

---

## Appendix A: Progress Tracking Comparison

| Property        | LevelUp `UserStoryPointProgress` | AutoGrade `Submission`          |
| --------------- | -------------------------------- | ------------------------------- |
| **Cardinality** | One per user per story point     | One per student per exam        |
| **Updates**     | Frequent (per item interaction)  | Rare (once, on grade release)   |
| **Granularity** | Item-level embedded map          | Question-level subcollection    |
| **Score type**  | Points (accumulated)             | Marks (0–100%)                  |
| **Retry**       | Yes (multiple attempts)          | No (one submission)             |
| **AI feedback** | Real-time (in-session)           | Post-hoc (after grading)        |
| **Storage**     | Firestore (single doc per SP)    | Firestore (doc + subcollection) |
| **Real-time**   | Yes (Firestore listener)         | RTDB for grading progress       |
| **Org-scoped**  | Yes (after migration)            | Yes (always)                    |

## Appendix B: AI Task Classification

| Task                    | System    | Model                 | Trigger                | Cost Tier   |
| ----------------------- | --------- | --------------------- | ---------------------- | ----------- |
| `ocr_handwriting`       | AutoGrade | gemini-2.5-flash      | Submission uploaded    | Medium      |
| `answer_mapping`        | AutoGrade | gemini-2.5-flash      | OCR complete           | Medium-High |
| `answer_grading`        | AutoGrade | gemini-2.5-flash      | Mapping complete       | Medium      |
| `question_extraction`   | AutoGrade | gemini-2.5-flash      | Teacher uploads paper  | Medium      |
| `feedback_summary`      | AutoGrade | gemini-2.5-flash-lite | Grading complete       | Low         |
| `feedback_enhancement`  | Unified   | N/A (rule-based)      | Grade released         | Zero        |
| `tutoring_chat`         | LevelUp   | gemini-2.5-flash-lite | Student sends message  | Low         |
| `answer_evaluation`     | LevelUp   | gemini-2.5-flash-lite | Student submits answer | Low         |
| `context_summarization` | LevelUp   | gemini-2.5-flash-lite | Session > 20 messages  | Low         |
| `insight_generation`    | Unified   | N/A (rule-based)      | Nightly / on demand    | Zero        |

## Appendix C: Firestore Collection Index Requirements

| Collection               | Index                                         | Pattern                   |
| ------------------------ | --------------------------------------------- | ------------------------- |
| `userStoryPointProgress` | `(orgId, userId, updatedAt DESC)`             | Student dashboard history |
| `userStoryPointProgress` | `(orgId, spaceId, userId)`                    | Space progress query      |
| `submissions`            | `(orgId, studentUserId, createdAt DESC)`      | Student exam list         |
| `submissions`            | `(orgId, examId, classId, status)`            | Teacher exam management   |
| `submissions`            | `(orgId, examId, isReleased, createdAt DESC)` | Released results          |
| `llmCallLogs`            | `(orgId, task, createdAt DESC)`               | Cost by task report       |
| `llmCallLogs`            | `(orgId, relatedResourceId, createdAt DESC)`  | Cost per submission       |
| `llmCallLogs`            | `(orgId, userId, createdAt DESC)`             | Cost per user             |
| `chatSessions`           | `(orgId, userId, updatedAt DESC)`             | Student's recent chats    |
| `chatSessions`           | `(orgId, itemId, userId)`                     | Chat for specific item    |
| `timedTestSessions`      | `(orgId, userId, storyPointId, status)`       | User's test history       |
| `costSummaries/daily`    | `(orgId, date ASC)`                           | Cost trend chart          |

---

**Document End**

_This document is the Phase 3D deliverable for the unified LevelUp + AutoGrade
platform._ _For database schema details (Supabase/PostgreSQL), see
`SUPABASE_SCHEMA.md`._ _For AI provider abstraction and grading pipeline
details, see `architecture/AI_SYSTEM_ARCHITECTURE.md`._ _For Firestore
collection hierarchy and security rules, see
`architecture/DATABASE_ARCHITECTURE.md`._
