# Analytics & Intelligence Module — Design Plan

## Unified LevelUp + AutoGrade B2B SaaS Platform

**Version:** 1.0 **Date:** 2026-02-19 **Author:** Analytics & Intelligence
Engineer **Phase:** 5 of Implementation Roadmap **Status:** Design Plan — Ready
for Implementation

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Entity Schemas](#2-entity-schemas)
3. [Progress Tracking Architecture](#3-progress-tracking-architecture)
4. [RTDB to Firestore Flush Mechanism](#4-rtdb-to-firestore-flush-mechanism)
5. [Cross-System Summary Aggregation](#5-cross-system-summary-aggregation)
6. [Class Summary Aggregation](#6-class-summary-aggregation)
7. [Exam Analytics](#7-exam-analytics)
8. [Tenant Analytics](#8-tenant-analytics)
9. [Real-Time Leaderboards](#9-real-time-leaderboards)
10. [Insight Engine](#10-insight-engine)
11. [Notification Service](#11-notification-service)
12. [AI Infrastructure — LLMWrapper](#12-ai-infrastructure--llmwrapper)
13. [Cost Tracking & Budget Management](#13-cost-tracking--budget-management)
14. [Rate Limiting](#14-rate-limiting)
15. [Denormalized Counter Maintenance](#15-denormalized-counter-maintenance)
16. [Cloud Functions Specification](#16-cloud-functions-specification)
17. [Cloud Scheduler Specification](#17-cloud-scheduler-specification)
18. [Migration Plan](#18-migration-plan)
19. [Testing Strategy](#19-testing-strategy)
20. [Dependencies on Other Modules](#20-dependencies-on-other-modules)

---

## 1. Overview & Scope

### 1.1 Module Purpose

The Analytics & Intelligence module is the data aggregation, insight generation,
AI infrastructure, and notification backbone of the unified platform. It
transforms raw progress events from both LevelUp (digital learning) and
AutoGrade (paper exam grading) into actionable dashboards, recommendations, and
alerts for students, teachers, parents, and administrators.

### 1.2 Scope

This module owns:

| Component                      | Description                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| **Space Progress Tracking**    | Per-item granularity: points, status, attempts, time spent                         |
| **Practice Progress (RTDB)**   | High-frequency writes during practice sessions                                     |
| **RTDB→Firestore Flush**       | 3-trigger mechanism: client session-end, Cloud Scheduler (6h), sendBeacon fallback |
| **Student Progress Summaries** | Cross-system aggregated (LevelUp + AutoGrade + insights), <30s SLA                 |
| **Class Progress Summaries**   | 3-minute debounce via Cloud Tasks                                                  |
| **Exam Analytics**             | Score distribution, question difficulty, pass rates                                |
| **Tenant Analytics**           | Nightly Cloud Scheduler aggregation                                                |
| **Real-Time Leaderboards**     | RTDB-backed, <5s SLA                                                               |
| **Insight Engine**             | Rule-based (no LLM): weak topics, engagement gaps, at-risk detection               |
| **Notification Service**       | In-app, push (FCM), email (SendGrid)                                               |
| **LLMWrapper Cloud Function**  | Server-side AI calls, per-tenant key retrieval from Secret Manager                 |
| **LLM Call Logs**              | Per-call logging: tokens, cost, latency, resource attribution                      |
| **Cost Summaries**             | Daily (Cloud Scheduler 00:05 UTC) and monthly aggregation                          |
| **Rate Limiting**              | Per-user + per-tenant + per-plan limits via RTDB counters                          |
| **Budget Alerts**              | 80% warning, 100% graceful pause                                                   |
| **Denormalized Counters**      | Tenant.stats, Class.studentCount, Space.stats via FieldValue.increment             |

### 1.3 Design Principles

1. **Source of truth stays in its domain** — LevelUp progress in
   `spaceProgress`, AutoGrade submissions in `submissions`. Summaries are
   derived, never authoritative.
2. **Pre-aggregate for read performance** — Dashboards read one document, not
   fan-out queries.
3. **RTDB for hot path, Firestore for persistence** — Practice mode uses RTDB;
   dashboards read Firestore.
4. **Rule-based intelligence, not LLM** — Insight Engine uses deterministic
   rules. Zero AI cost.
5. **Graceful degradation** — If aggregation fails, source data is unaffected.
   Summaries rebuild on next trigger.
6. **Tenant isolation** — All analytics data scoped under
   `/tenants/{tenantId}/...`.

### 1.4 SLA Targets

| Metric                         | Target                                   |
| ------------------------------ | ---------------------------------------- |
| Student summary update latency | < 30 seconds after source write          |
| Class summary update latency   | < 5 minutes (3-min debounce + compute)   |
| Leaderboard update latency     | < 5 seconds after item submission        |
| Exam analytics compute         | < 5 minutes after all submissions graded |
| Tenant analytics               | < 1 hour (nightly batch)                 |
| Notification delivery (in-app) | < 10 seconds                             |
| Notification delivery (push)   | < 30 seconds                             |
| Notification delivery (email)  | < 5 minutes                              |

---

## 2. Entity Schemas

### 2.1 SpaceProgress

**Collection:** `/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}`

This is the per-space progress document for a student in a LevelUp space. It
contains item-level granularity embedded as a map.

```typescript
interface SpaceProgress {
  // Identity
  id: string; // "${userId}_${spaceId}"
  userId: string; // Firebase Auth UID
  tenantId: string;
  spaceId: string;

  // Status
  status: "not_started" | "in_progress" | "completed";
  startedAt?: Timestamp;
  completedAt?: Timestamp;

  // Scoring
  pointsEarned: number;
  totalPoints: number;
  percentage: number; // 0.0–1.0

  // Story point level progress
  storyPoints: Record<string, StoryPointProgressEntry>;

  // Item-level progress map (embedded, not subcollection)
  items: Record<string, ItemProgressEntry>;

  // Metadata
  lastActiveAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface StoryPointProgressEntry {
  storyPointId: string;
  status: "not_started" | "in_progress" | "completed";
  pointsEarned: number;
  totalPoints: number;
  percentage: number; // 0.0–1.0
  completedAt?: Timestamp;
  lastActiveAt: Timestamp;
}

interface ItemProgressEntry {
  itemId: string;
  storyPointId: string;
  itemType:
    | "question"
    | "material"
    | "interactive"
    | "assessment"
    | "discussion"
    | "project"
    | "checkpoint";
  completed: boolean;
  completedAt?: Timestamp;
  timeSpentSeconds: number;
  interactions: number;
  lastActiveAt: Timestamp;

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

  // For material items
  materialData?: {
    viewed: boolean;
    viewedAt?: Timestamp;
    viewDurationSeconds: number;
  };
}

interface QuestionSubmissionEntry {
  submittedAt: Timestamp;
  answer: unknown; // Type-specific answer payload
  evaluation?: {
    correct: boolean;
    score: number; // 0.0–1.0
    feedback?: string;
    pointsEarned: number;
    confidence?: number; // AI confidence 0.0–1.0
    llmCallLogId?: string; // Links to LLMCallLog if AI-evaluated
  };
}
```

**Document Size Consideration:** A single `spaceProgress` document embeds all
items. For spaces with >500 items, the document could approach Firestore's 1MB
limit. Mitigation: spaces are typically 20–100 items. If a space exceeds 500
items, the `items` map will be paginated into subcollections in a future
iteration. For now, embedded map is the simplest approach.

**Indexes Required:** | Fields | Purpose | |--------|---------| |
`tenantId ASC, userId ASC, status ASC` | Student's active spaces | |
`tenantId ASC, spaceId ASC, status ASC` | All students' progress for a space | |
`tenantId ASC, userId ASC, updatedAt DESC` | Recent progress for dashboard |

### 2.2 PracticeProgress (RTDB)

**Path:** `practiceProgress/{tenantId}/{userId}/{spaceId}/{itemId}`

RTDB is used for practice mode because it supports high-frequency writes (every
answer attempt) with low latency. Data is eventually flushed to Firestore
`spaceProgress`.

```typescript
// RTDB structure (abbreviated keys for bandwidth)
interface PracticeProgressRTDB {
  // Path: practiceProgress/{tenantId}/{userId}/{spaceId}
  items: Record<
    string,
    {
      s: "c" | "i" | "a" | "p"; // correct, incorrect, attempted, pending
      t: number; // completedAt timestamp (epoch ms)
      a: number; // attempts count
      sc: number; // best score 0–100 (integer for RTDB)
      bt?: number; // best time in seconds
    }
  >;
  stats: {
    ic: number; // itemsCompleted
    ti: number; // totalItems
    pe: number; // pointsEarned
    aa: number; // averageAccuracy 0–100 (integer)
    la: number; // lastActiveAt epoch ms
  };
  _meta: {
    flushedAt?: number; // Last Firestore flush epoch ms
    dirty: boolean; // Has unflushed changes
    sessionStart: number; // Current session start epoch ms
  };
}
```

**RTDB Security Rules:**

```json
{
  "rules": {
    "practiceProgress": {
      "$tenantId": {
        ".read": "auth != null && auth.token.tenantId === $tenantId",
        ".write": false,
        "$userId": {
          ".write": "auth != null && auth.uid === $userId && auth.token.tenantId === $tenantId",
          ".read": "auth != null && (auth.uid === $userId || auth.token.role === 'teacher' || auth.token.role === 'tenantAdmin')",
          "$spaceId": {
            ".validate": "newData.hasChildren(['items', 'stats', '_meta'])"
          }
        }
      }
    }
  }
}
```

### 2.3 StudentProgressSummary

**Collection:** `/tenants/{tenantId}/studentProgressSummaries/{userId}`

Pre-aggregated document per student. Updated by Cloud Functions on every
progress change. Powers the student dashboard with a single document read.

```typescript
interface StudentProgressSummary {
  userId: string;
  tenantId: string;
  classIds: string[]; // Denormalized for filtering
  updatedAt: Timestamp;

  // ─── LevelUp Summary ─────────────────────────────────────
  levelup: {
    totalSpaces: number;
    completedSpaces: number;
    inProgressSpaces: number;
    totalStoryPoints: number;
    completedStoryPoints: number;
    overallPointsEarned: number;
    overallTotalPoints: number;
    overallPercentage: number; // 0.0–1.0

    // Per-space summary (all assigned spaces)
    spaces: Record<string, SpaceSummaryEntry>;

    // Per-subject roll-up (from space.subject + item topics)
    subjectPerformance: Record<
      string,
      {
        subject: string;
        averageScore: number; // 0.0–1.0
        itemsCompleted: number;
        totalItems: number;
        spacesInSubject: number;
      }
    >;

    practiceStats: {
      spacesAttempted: number;
      totalItemsCompleted: number;
      averageAccuracy: number; // 0.0–1.0
    };

    // Engagement metrics
    totalTimeSpentMinutes: number;
    streakDays: number;
    lastActiveAt: Timestamp;
  };

  // ─── AutoGrade Summary ────────────────────────────────────
  autograde: {
    totalExams: number;
    gradedExams: number;
    averagePercentage: number; // 0–100
    bestPercentage: number;

    // Per-exam summary (last 20 exams)
    exams: Record<string, ExamSummaryEntry>;

    // Per-subject aggregation
    subjectPerformance: Record<
      string,
      {
        subject: string;
        averagePercentage: number; // 0–100
        examsCount: number;
        weakTopics: string[]; // Topics where score < 50%
      }
    >;
  };

  // ─── Cross-System Insights ────────────────────────────────
  insights: {
    // Topic-level correlation: LevelUp score vs AutoGrade score
    topicCorrelations: TopicCorrelation[];

    // Recommendations from Insight Engine
    recommendations: Recommendation[];

    // Risk assessment
    riskLevel: "none" | "low" | "medium" | "high";
    riskFactors: string[];

    // Engagement score (0.0–1.0, computed from activity patterns)
    engagementScore: number;
  };
}

interface SpaceSummaryEntry {
  spaceId: string;
  spaceName: string; // Denormalized
  subject?: string;
  percentage: number; // 0.0–1.0
  status: "not_started" | "in_progress" | "completed";
  lastActiveAt: Timestamp;
  storyPointsCompleted: number;
  totalStoryPoints: number;
  pointsEarned: number;
  totalPoints: number;
}

interface ExamSummaryEntry {
  examId: string;
  examTitle: string; // Denormalized
  subject: string;
  examDate: Timestamp;
  percentage: number; // 0–100
  grade: string;
  totalMarks: number;
  scoredMarks: number;
  isReleased: boolean;
  weakTopics: string[];
}

interface TopicCorrelation {
  topic: string;
  levelupScore: number; // 0.0–1.0
  autogradeScore: number; // 0.0–1.0
  gapDirection: "levelup_ahead" | "autograde_ahead" | "aligned";
  gapMagnitude: number; // Absolute difference
}

interface Recommendation {
  id: string; // Deterministic: hash(type + topic + source)
  type: "practice" | "review" | "exam_prep" | "start_space";
  topic: string;
  reason: string; // Human-readable explanation
  suggestedSpaceId?: string;
  suggestedSpaceName?: string; // Denormalized
  sourceExamId?: string; // If recommendation came from exam results
  priority: "high" | "medium" | "low";
  dismissed: boolean; // Student can dismiss recommendations
  generatedAt: Timestamp;
}
```

**Indexes Required:** | Fields | Purpose | |--------|---------| |
`tenantId ASC, userId ASC` | Direct lookup (primary) | |
`tenantId ASC, classIds CONTAINS, updatedAt DESC` | Class-level student listing
| | `tenantId ASC, insights.riskLevel ASC` | At-risk student queries |

### 2.4 ClassProgressSummary

**Collection:** `/tenants/{tenantId}/classProgressSummaries/{classId}`

Aggregated view for a class. Updated with 3-minute debounce via Cloud Tasks when
any student summary in the class changes.

```typescript
interface ClassProgressSummary {
  classId: string;
  tenantId: string;
  className: string; // Denormalized
  studentCount: number;
  updatedAt: Timestamp;

  // ─── LevelUp Class Stats ─────────────────────────────────
  levelup: {
    // Per-space stats for this class
    spaces: Record<string, ClassSpaceStats>;

    // Per-topic class performance
    topicPerformance: Record<
      string,
      {
        topic: string;
        classAverageScore: number; // 0.0–1.0
        studentsBelowThreshold: number; // Score < 0.5
        studentsAboveThreshold: number;
      }
    >;

    // Class-wide engagement
    averageEngagement: number; // 0.0–1.0
    activeStudentsLast7Days: number;
  };

  // ─── AutoGrade Class Stats ────────────────────────────────
  autograde: {
    // Per-exam stats
    exams: Record<string, ClassExamStats>;

    // Aggregate
    averageExamPercentage: number;
    totalExamsAssigned: number;
    totalExamsGraded: number;
  };

  // ─── Teacher Insights ─────────────────────────────────────
  insights: {
    topStudents: StudentRankEntry[]; // Top 5 by combined score
    atRiskStudents: AtRiskEntry[]; // Students needing intervention
    weakTopicsClassWide: string[]; // Topics where class average < 50%
    suggestedSpaces: string[]; // SpaceIds recommended for class remediation
    highPerformers: string[]; // UserIds of top performers
    recentTrend: "improving" | "stable" | "declining";
  };
}

interface ClassSpaceStats {
  spaceId: string;
  spaceName: string;
  averagePercentage: number; // 0.0–1.0
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  distributionBuckets: {
    "0-25": number;
    "25-50": number;
    "50-75": number;
    "75-100": number;
  };
}

interface ClassExamStats {
  examId: string;
  examTitle: string;
  subject: string;
  submittedCount: number;
  gradedCount: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  passRate: number; // 0.0–1.0
  distributionBuckets: {
    "0-25": number;
    "25-50": number;
    "50-75": number;
    "75-100": number;
  };
  questionStats: Record<
    string,
    {
      questionId: string;
      averageScore: number; // 0.0–1.0
      attemptedCount: number;
      commonMistakeType?: string;
    }
  >;
}

interface StudentRankEntry {
  userId: string;
  displayName: string;
  combinedScore: number; // Weighted: 0.5 * levelup + 0.5 * autograde
}

interface AtRiskEntry {
  userId: string;
  displayName: string;
  riskLevel: "low" | "medium" | "high";
  riskFactors: string[];
  lastActiveAt: Timestamp;
}
```

### 2.5 ExamAnalytics

**Collection:** `/tenants/{tenantId}/examAnalytics/{examId}`

Generated on-demand when a teacher views exam results, and refreshed by daily
Cloud Scheduler.

```typescript
interface ExamAnalytics {
  examId: string;
  tenantId: string;
  examTitle: string; // Denormalized
  subject: string;
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
    passRate: number; // 0.0–1.0
    gradeDistribution: Record<string, number>; // { "A": 12, "B": 23, ... }
  };

  // Per-question analytics
  questions: Record<string, QuestionAnalytics>;

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

  // Topic weak spots
  topicInsights: Array<{
    topic: string;
    classAverageScore: number; // 0.0–1.0
    studentsBelow50: number;
    suggestedSpaceId?: string; // Recommended LevelUp space
    suggestedSpaceName?: string;
  }>;
}

interface QuestionAnalytics {
  questionId: string;
  questionNumber: number;
  maxMarks: number;
  averageScore: number;
  averageScorePercent: number; // 0.0–1.0
  attemptRate: number; // Fraction who attempted vs skipped
  difficultyRating: "easy" | "medium" | "hard"; // Based on averageScorePercent
  commonWeaknesses: string[];
  commonStrengths: string[];
  mistakeClassification: Record<string, number>; // { "Conceptual": 5, "Silly Error": 12 }
  confidenceDistribution: {
    high: number; // AI confidence >= 0.80
    medium: number; // 0.50–0.79
    low: number; // < 0.50
  };
}
```

### 2.6 TenantAnalytics

**Collection:** `/tenants/{tenantId}/tenantAnalytics/current`

Nightly Cloud Scheduler job. Single document representing current period.

```typescript
interface TenantAnalytics {
  tenantId: string;
  computedAt: Timestamp;
  period: "current_month";

  students: {
    total: number;
    active: number; // At least one activity in last 30 days
    averageEngagementScore: number; // 0.0–1.0
    newThisMonth: number;
  };

  levelup: {
    totalSpacesPublished: number;
    totalSpacesDraft: number;
    totalStoryPointsCompleted: number; // Across all students
    averageCompletionRate: number; // 0.0–1.0
    topSpacesByEngagement: Array<{
      spaceId: string;
      spaceName: string;
      engagementScore: number;
      studentsActive: number;
    }>;
    aiChatSessions: number;
    averageChatTurns: number;
    practiceItemsCompleted: number;
  };

  autograde: {
    totalExams: number;
    totalSubmissions: number;
    gradedSubmissions: number;
    averageGradingTimeMinutes: number;
    averageScore: number;
    examsByStatus: Record<string, number>;
    reviewQueueSize: number; // Pending human moderation
  };

  ai: {
    totalLLMCalls: number;
    totalTokensUsed: number;
    totalCostUSD: number;
    costByTask: Record<string, number>; // Task type → cost
    averageCostPerSubmission: number;
    averageCostPerChatSession: number;
    budgetUsagePercent: number;
  };

  classes: {
    total: number;
    averageStudentsPerClass: number;
    mostActiveClasses: Array<{
      classId: string;
      className: string;
      activityScore: number;
    }>;
  };
}
```

### 2.7 LLMCallLog

**Collection:** `/tenants/{tenantId}/llmCallLogs/{callId}`

Every AI call is logged here. This is the source of truth for cost tracking.

```typescript
type TaskType =
  // AutoGrade tasks
  | "question_extraction"
  | "answer_mapping"
  | "ocr_handwriting"
  | "answer_grading"
  | "feedback_summary"
  | "feedback_enhancement"
  // LevelUp tasks
  | "tutoring_chat"
  | "answer_evaluation"
  | "question_generation"
  | "context_summarization"
  // System tasks
  | "insight_generation"
  | "rubric_design";

interface LLMCallLog {
  // Identity
  callId: string;
  tenantId: string;
  userId?: string; // The user who triggered the call
  userRole?: "teacher" | "student" | "admin" | "system";

  // Task classification
  task: TaskType;

  // Provider details
  provider: "gemini";
  model: string; // e.g., 'gemini-2.5-flash', 'gemini-2.5-flash-lite'
  promptTemplateId?: string;
  promptTemplateVersion?: string;

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
  errorCode?: string;

  // Context linking
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

  // Timestamps
  createdAt: Timestamp;
  callStartedAt: Timestamp;
  callCompletedAt?: Timestamp;

  // Custom tags for reporting
  tags?: string[];
}
```

**Indexes Required:** | Fields | Purpose | |--------|---------| |
`tenantId ASC, createdAt DESC` | Chronological log view | |
`tenantId ASC, task ASC, createdAt DESC` | Cost by task type | |
`tenantId ASC, relatedResourceType ASC, relatedResourceId ASC` | Cost per
resource | | `tenantId ASC, userId ASC, createdAt DESC` | Cost per user | |
`tenantId ASC, success ASC, createdAt DESC` | Error log view |

### 2.8 CostSummary (Daily)

**Collection:** `/tenants/{tenantId}/costSummaries/daily/{YYYY-MM-DD}`

```typescript
interface DailyCostSummary {
  tenantId: string;
  date: string; // YYYY-MM-DD
  computedAt: Timestamp;

  totalCostUSD: number;
  totalTokens: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;

  // Breakdown by task type
  byTask: Record<
    TaskType,
    {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      costUSD: number;
      averageLatencyMs: number;
      successRate: number; // 0.0–1.0
    }
  >;

  // Breakdown by model
  byModel: Record<
    string,
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

### 2.9 CostSummary (Monthly)

**Collection:** `/tenants/{tenantId}/costSummaries/monthly/{YYYY-MM}`

```typescript
interface MonthlyCostSummary {
  tenantId: string;
  month: string; // YYYY-MM
  computedAt: Timestamp;

  totalCostUSD: number;
  totalTokens: number;
  totalCalls: number;

  budgetLimitUSD: number; // From tenant subscription plan
  budgetUsagePercent: number; // totalCost / budgetLimit * 100
  projectedMonthEndCostUSD: number; // Linear projection from current spend

  // Daily trend (for charts)
  dailyTrend: Array<{
    date: string;
    costUSD: number;
    calls: number;
  }>;

  // Alert history
  alertsSent: Array<{
    threshold: number; // 0.80 or 1.00
    type: "warning" | "critical" | "anomaly";
    sentAt: Timestamp;
    channel: "email" | "in_app" | "push";
    recipientUid: string;
  }>;

  // Status
  isPaused: boolean; // AI features paused due to budget
  pausedAt?: Timestamp;
  pausedReason?: string;
}
```

### 2.10 Notification

**Collection:** `/tenants/{tenantId}/notifications/{notificationId}`

```typescript
type NotificationType =
  | "result_released"
  | "space_published"
  | "at_risk_alert"
  | "budget_warning"
  | "budget_critical"
  | "exam_ready"
  | "recommendation"
  | "grading_complete"
  | "grading_failed"
  | "weekly_digest"
  | "system";

interface Notification {
  id: string;
  tenantId: string;
  recipientUid: string;

  type: NotificationType;
  title: string;
  body: string;
  iconType?: "info" | "success" | "warning" | "error";

  // Deep link params for navigation
  data?: {
    route?: string; // e.g., '/spaces/{spaceId}'
    examId?: string;
    spaceId?: string;
    classId?: string;
    studentId?: string;
    [key: string]: string | undefined;
  };

  // Delivery configuration
  channels: ("in_app" | "push" | "email")[];
  deliveryStatus: {
    in_app?: "sent" | "failed";
    push?: "sent" | "failed" | "skipped"; // Skipped if no FCM token
    email?: "sent" | "failed" | "skipped";
  };

  // Read tracking
  read: boolean;
  readAt?: Timestamp;

  // Metadata
  priority: "low" | "normal" | "high" | "urgent";
  expiresAt?: Timestamp; // Auto-cleanup after expiry
  groupKey?: string; // For grouping related notifications
  createdAt: Timestamp;
}
```

**Indexes Required:** | Fields | Purpose | |--------|---------| |
`tenantId ASC, recipientUid ASC, read ASC, createdAt DESC` | Unread
notifications for user | | `tenantId ASC, recipientUid ASC, createdAt DESC` |
All notifications for user | | `tenantId ASC, type ASC, createdAt DESC` |
Notifications by type |

---

## 3. Progress Tracking Architecture

### 3.1 Data Flow Overview

```
Student Activity Sources:
├── LevelUp Interactive
│   ├── Material viewed → SpaceProgress.items[itemId].materialData.viewed
│   ├── Question answered → SpaceProgress.items[itemId].questionData
│   ├── Story point completed → SpaceProgress.storyPoints[spId].status
│   └── Space completed → SpaceProgress.status = 'completed'
│
├── LevelUp Practice Mode (RTDB)
│   └── Practice answer → RTDB practiceProgress/{tenantId}/{userId}/{spaceId}
│       └── Flushed to SpaceProgress (see Section 4)
│
├── LevelUp Timed Test
│   └── Test completed → /tenants/{tenantId}/digitalTestSessions/{sessionId}
│       └── Triggers SpaceProgress update
│
└── AutoGrade Exam
    └── Grade released → /tenants/{tenantId}/submissions/{submissionId}
        └── Triggers StudentProgressSummary update
```

### 3.2 SpaceProgress Write Path

```
Client submits answer
    │
    ├─ Interactive/Assessment mode:
    │   └─ Cloud Function: evaluateAnswer()
    │       ├─ AI evaluates (for subjective) or auto-grades (for MCQ/etc.)
    │       ├─ Writes to SpaceProgress.items[itemId].questionData
    │       ├─ Recalculates SpaceProgress story point totals
    │       ├─ Recalculates SpaceProgress overall percentage
    │       └─ Returns result to client
    │
    └─ Practice mode:
        └─ Client writes directly to RTDB (low-latency)
            └─ Flushed to Firestore later (see Section 4)
```

### 3.3 SpaceProgress Firestore Trigger

When `spaceProgress` is written, a Firestore trigger fires to update the student
summary:

```typescript
// Trigger: onWrite /tenants/{tenantId}/spaceProgress/{progressId}
export const onSpaceProgressWrite = functions.firestore
  .document("tenants/{tenantId}/spaceProgress/{progressId}")
  .onWrite(async (change, context) => {
    const { tenantId, progressId } = context.params;
    const userId = progressId.split("_")[0];

    // 1. Update StudentProgressSummary (< 30s SLA)
    await updateStudentProgressSummary(tenantId, userId);

    // 2. Update denormalized Space.stats.totalStudents if this is a new progress doc
    if (!change.before.exists) {
      const spaceId = progressId.split("_")[1];
      await incrementSpaceStudentCount(tenantId, spaceId);
    }

    // 3. Update real-time leaderboard
    const after = change.after.data();
    if (after) {
      await updateLeaderboard(
        tenantId,
        after.spaceId,
        userId,
        after.pointsEarned
      );
    }
  });
```

---

## 4. RTDB to Firestore Flush Mechanism

### 4.1 Design

Practice mode uses RTDB for low-latency writes. The data must eventually be
flushed to Firestore for persistence and analytics. Three flush triggers ensure
no data is lost:

```
Flush Triggers:
│
├── Trigger 1: Client Session End (explicit "Done" button or route navigation)
│   └── Client calls Cloud Function: flushPracticeProgress(tenantId, userId, spaceId)
│       └── Reads RTDB → Writes to Firestore spaceProgress → Marks RTDB as flushed
│
├── Trigger 2: Browser Close (beforeunload event)
│   └── navigator.sendBeacon() to flush HTTP endpoint
│       └── Best-effort: may not complete for large payloads
│       └── Includes: tenantId, userId, spaceId in beacon body
│
└── Trigger 3: Cloud Scheduler (every 6 hours)
    └── Cloud Function: flushStalePracticeProgress()
        └── Scans ALL RTDB practiceProgress paths
        └── For entries where _meta.dirty === true AND _meta.la < (now - 6h)
        └── Flushes each to Firestore
        └── Sets _meta.dirty = false, _meta.flushedAt = now
```

### 4.2 Flush Cloud Function

```typescript
// Callable: flushPracticeProgress
export const flushPracticeProgress = functions.https.onCall(
  async (
    data: { tenantId: string; userId: string; spaceId: string },
    context
  ) => {
    // Auth check
    if (!context.auth || context.auth.uid !== data.userId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not authorized"
      );
    }
    if (context.auth.token.tenantId !== data.tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Tenant mismatch"
      );
    }

    const { tenantId, userId, spaceId } = data;
    const rtdbPath = `practiceProgress/${tenantId}/${userId}/${spaceId}`;

    // 1. Read RTDB practice data
    const snapshot = await admin.database().ref(rtdbPath).once("value");
    if (!snapshot.exists()) return { flushed: false, reason: "no_data" };

    const practiceData = snapshot.val();
    if (!practiceData._meta?.dirty)
      return { flushed: false, reason: "already_flushed" };

    // 2. Read existing Firestore spaceProgress
    const progressRef = admin
      .firestore()
      .doc(`tenants/${tenantId}/spaceProgress/${userId}_${spaceId}`);
    const progressDoc = await progressRef.get();

    // 3. Merge practice data into spaceProgress
    const existingItems = progressDoc.exists ? progressDoc.data()!.items : {};
    const mergedItems = mergePracticeIntoProgress(
      existingItems,
      practiceData.items
    );

    // 4. Recalculate totals
    const totals = calculateProgressTotals(mergedItems);

    // 5. Write to Firestore
    await progressRef.set(
      {
        id: `${userId}_${spaceId}`,
        userId,
        tenantId,
        spaceId,
        status: totals.percentage >= 1.0 ? "completed" : "in_progress",
        pointsEarned: totals.pointsEarned,
        totalPoints: totals.totalPoints,
        percentage: totals.percentage,
        items: mergedItems,
        lastActiveAt: admin.firestore.Timestamp.fromMillis(
          practiceData.stats.la
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 6. Mark RTDB as flushed
    await admin.database().ref(`${rtdbPath}/_meta`).update({
      dirty: false,
      flushedAt: Date.now(),
    });

    return {
      flushed: true,
      itemsFlushed: Object.keys(practiceData.items).length,
    };
  }
);
```

### 4.3 Stale Flush Cloud Scheduler

```typescript
// Scheduled: every 6 hours
export const flushStalePracticeProgress = functions.pubsub
  .schedule("every 6 hours")
  .onRun(async () => {
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

    // Scan all tenants' practice progress
    const tenantsSnapshot = await admin
      .database()
      .ref("practiceProgress")
      .once("value");

    if (!tenantsSnapshot.exists()) return;

    const flushPromises: Promise<void>[] = [];

    tenantsSnapshot.forEach((tenantSnap) => {
      const tenantId = tenantSnap.key!;
      tenantSnap.forEach((userSnap) => {
        const userId = userSnap.key!;
        userSnap.forEach((spaceSnap) => {
          const spaceId = spaceSnap.key!;
          const meta = spaceSnap.child("_meta").val();

          if (meta?.dirty && meta.la < sixHoursAgo) {
            flushPromises.push(
              flushSinglePracticeProgress(tenantId, userId, spaceId)
            );
          }
        });
      });
    });

    // Process in batches of 50 to avoid timeouts
    const BATCH_SIZE = 50;
    for (let i = 0; i < flushPromises.length; i += BATCH_SIZE) {
      await Promise.allSettled(flushPromises.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `Flushed ${flushPromises.length} stale practice progress entries`
    );
  });
```

### 4.4 sendBeacon Fallback (Client-Side)

```typescript
// Client-side: called on beforeunload
window.addEventListener("beforeunload", () => {
  const pendingFlushes = getPendingPracticeFlushes(); // From local state

  for (const { tenantId, userId, spaceId } of pendingFlushes) {
    const payload = JSON.stringify({ tenantId, userId, spaceId });

    // sendBeacon is fire-and-forget, survives page close
    navigator.sendBeacon(
      `${CLOUD_FUNCTIONS_URL}/flushPracticeProgressBeacon`,
      new Blob([payload], { type: "application/json" })
    );
  }
});
```

### 4.5 Data Consistency

- **RTDB is source of truth** during an active practice session.
- **Firestore spaceProgress** reflects the last flush.
- **UI reads from RTDB** during practice, from **Firestore for
  dashboards/analytics**.
- **Merge strategy:** When flushing, if a Firestore item entry already exists
  (from interactive mode), practice data is merged using "best score wins"
  logic. Practice attempts are appended, not overwritten.

---

## 5. Cross-System Summary Aggregation

### 5.1 StudentProgressSummary Update Flow

```
Trigger Sources:
├── SpaceProgress written (Firestore trigger) ──────┐
├── Submission.isReleased → true (Firestore trigger) ┤
├── DigitalTestSession completed (Firestore trigger) ┤
└── Practice progress flushed (from Section 4) ──────┘
                                                      │
                                                      ▼
                              Cloud Function: updateStudentProgressSummary()
                                                      │
                              ┌────────────────────────┴─────────────────────────┐
                              │  1. Read all spaceProgress for user              │
                              │  2. Read all released submissions for user       │
                              │  3. Aggregate LevelUp summary                    │
                              │  4. Aggregate AutoGrade summary                  │
                              │  5. Run Insight Engine (Section 10)              │
                              │  6. Compute engagement score                     │
                              │  7. Write StudentProgressSummary                 │
                              │  8. Enqueue class summary update (Cloud Task)    │
                              └──────────────────────────────────────────────────┘
```

### 5.2 Implementation

```typescript
async function updateStudentProgressSummary(
  tenantId: string,
  userId: string
): Promise<void> {
  const db = admin.firestore();

  // 1. Read all space progress for this student
  const spaceProgressSnap = await db
    .collection(`tenants/${tenantId}/spaceProgress`)
    .where("userId", "==", userId)
    .get();

  // 2. Read all released submissions for this student
  const submissionsSnap = await db
    .collection(`tenants/${tenantId}/submissions`)
    .where("studentUserId", "==", userId)
    .where("isReleased", "==", true)
    .get();

  // 3. Read student's class memberships
  const studentDoc = await db
    .collection(`tenants/${tenantId}/students`)
    .where("authUid", "==", userId)
    .limit(1)
    .get();

  const classIds = studentDoc.empty ? [] : studentDoc.docs[0].data().classIds;

  // 4. Aggregate LevelUp summary
  const levelupSummary = aggregateLevelUpSummary(spaceProgressSnap.docs);

  // 5. Aggregate AutoGrade summary
  const autogradeSummary = await aggregateAutoGradeSummary(
    tenantId,
    submissionsSnap.docs
  );

  // 6. Generate insights (rule-based, no LLM)
  const insights = generateInsights(levelupSummary, autogradeSummary, tenantId);

  // 7. Write summary
  const summaryRef = db.doc(
    `tenants/${tenantId}/studentProgressSummaries/${userId}`
  );
  await summaryRef.set({
    userId,
    tenantId,
    classIds,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    levelup: levelupSummary,
    autograde: autogradeSummary,
    insights,
  });

  // 8. Enqueue class summary updates (debounced via Cloud Tasks)
  for (const classId of classIds) {
    await enqueueClassSummaryUpdate(tenantId, classId);
  }
}
```

### 5.3 SLA Enforcement

The <30s SLA is met by:

1. **Firestore trigger fires within ~1s** of source write.
2. **Parallel reads** of spaceProgress and submissions (Promise.all).
3. **No LLM calls** — insight generation is pure rule-based computation.
4. **Single summary write** — one document, not fan-out.

If the function exceeds 30s (e.g., student has hundreds of spaces), it will
still complete but may breach SLA. Mitigation: limit aggregation to last 50
active spaces, with a nightly full-recompute job.

---

## 6. Class Summary Aggregation

### 6.1 3-Minute Debounce via Cloud Tasks

When a `studentProgressSummary` is updated, instead of immediately recomputing
the class summary (which would cause write contention during simultaneous
submissions), a Cloud Task is enqueued with a 3-minute delay.

```typescript
async function enqueueClassSummaryUpdate(
  tenantId: string,
  classId: string
): Promise<void> {
  const taskId = `class-summary-${tenantId}-${classId}`;
  const client = new CloudTasksClient();
  const queuePath = client.queuePath(
    PROJECT_ID,
    REGION,
    "class-summary-updates"
  );

  // Check if task already exists (idempotent)
  try {
    await client.getTask({ name: `${queuePath}/tasks/${taskId}` });
    // Task already exists — debounce in effect, do nothing
    return;
  } catch (err: any) {
    if (err.code !== 5) throw err; // 5 = NOT_FOUND, which is expected
  }

  // Create task with 3-minute delay
  await client.createTask({
    parent: queuePath,
    task: {
      name: `${queuePath}/tasks/${taskId}`,
      scheduleTime: {
        seconds: Math.floor(Date.now() / 1000) + 180, // 3 minutes
      },
      httpRequest: {
        httpMethod: "POST",
        url: `${CLOUD_FUNCTIONS_URL}/updateClassProgressSummary`,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify({ tenantId, classId })).toString(
          "base64"
        ),
        oidcToken: { serviceAccountEmail: SERVICE_ACCOUNT_EMAIL },
      },
    },
  });
}
```

### 6.2 Class Summary Computation

```typescript
// HTTP function triggered by Cloud Task
export const updateClassProgressSummary = functions.https.onRequest(
  async (req, res) => {
    // Validate OIDC token (Cloud Tasks auth)
    const { tenantId, classId } = req.body;

    // 1. Read all student summaries for this class
    const studentSummaries = await admin
      .firestore()
      .collection(`tenants/${tenantId}/studentProgressSummaries`)
      .where("classIds", "array-contains", classId)
      .get();

    if (studentSummaries.empty) {
      res.status(200).send("No students in class");
      return;
    }

    // 2. Read class metadata
    const classDoc = await admin
      .firestore()
      .doc(`tenants/${tenantId}/classes/${classId}`)
      .get();
    const className = classDoc.data()?.name || "Unknown";

    // 3. Aggregate into ClassProgressSummary
    const classSummary = computeClassSummary(
      classId,
      tenantId,
      className,
      studentSummaries.docs
    );

    // 4. Write class summary
    await admin
      .firestore()
      .doc(`tenants/${tenantId}/classProgressSummaries/${classId}`)
      .set(classSummary);

    res.status(200).send("OK");
  }
);
```

### 6.3 Write Contention Mitigation

The 3-minute debounce prevents this scenario:

- 50 students submit a test at the same time
- Each triggers a student summary update
- Each student summary update would try to rewrite the class summary
- Without debounce: 50 writes to one document → write contention errors

With debounce: first student's update enqueues a Cloud Task. Subsequent 49
updates find the task already exists and skip. After 3 minutes, one class
summary recompute runs with all 50 students' latest data.

---

## 7. Exam Analytics

### 7.1 Trigger Points

Exam analytics are computed:

1. **On-demand:** When a teacher opens the exam analytics view (callable
   function).
2. **Daily refresh:** Cloud Scheduler recomputes analytics for all exams with
   status `completed` in the last 7 days.

### 7.2 Computation

```typescript
async function computeExamAnalytics(
  tenantId: string,
  examId: string
): Promise<ExamAnalytics> {
  const db = admin.firestore();

  // 1. Read exam metadata
  const examDoc = await db.doc(`tenants/${tenantId}/exams/${examId}`).get();
  const exam = examDoc.data()!;

  // 2. Read all graded submissions
  const submissions = await db
    .collection(`tenants/${tenantId}/submissions`)
    .where("examId", "==", examId)
    .where("status", "in", ["grading_complete", "released"])
    .get();

  // 3. Read question submissions for each
  const questionData: Map<string, any[]> = new Map();
  for (const sub of submissions.docs) {
    const qSubs = await db
      .collection(
        `tenants/${tenantId}/submissions/${sub.id}/questionSubmissions`
      )
      .get();
    for (const qs of qSubs.docs) {
      const qId = qs.data().questionId;
      if (!questionData.has(qId)) questionData.set(qId, []);
      questionData.get(qId)!.push(qs.data());
    }
  }

  // 4. Compute score distribution
  const scores = submissions.docs.map((s) => s.data().summary.percentage);
  const scoreDistribution = computeScoreDistribution(
    scores,
    (exam.passingMarks / exam.totalMarks) * 100
  );

  // 5. Compute per-question analytics
  const questions = computeQuestionAnalytics(questionData, exam);

  // 6. Compute class breakdown
  const classBreakdown = computeClassBreakdown(submissions.docs);

  // 7. Compute topic insights with LevelUp space recommendations
  const topicInsights = await computeTopicInsights(tenantId, questions);

  return {
    examId,
    tenantId,
    examTitle: exam.title,
    subject: exam.subject,
    computedAt: admin.firestore.Timestamp.now(),
    submissionCount: submissions.size,
    gradedCount: submissions.docs.filter((s) =>
      ["grading_complete", "released"].includes(s.data().status)
    ).length,
    scoreDistribution,
    questions,
    classBreakdown,
    topicInsights,
  };
}
```

---

## 8. Tenant Analytics

### 8.1 Nightly Aggregation

Cloud Scheduler runs at **00:05 UTC daily**. Aggregates data for each active
tenant.

```typescript
// Scheduled: daily at 00:05 UTC
export const computeNightlyTenantAnalytics = functions.pubsub
  .schedule("5 0 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    // 1. Get all active tenants
    const tenants = await admin
      .firestore()
      .collection("tenants")
      .where("status", "==", "active")
      .get();

    // 2. Process each tenant (batched for memory)
    const BATCH_SIZE = 10;
    for (let i = 0; i < tenants.docs.length; i += BATCH_SIZE) {
      const batch = tenants.docs.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((doc) => computeTenantAnalyticsSingle(doc.id))
      );
    }
  });

async function computeTenantAnalyticsSingle(tenantId: string): Promise<void> {
  const db = admin.firestore();

  // Read counts
  const [students, spaces, exams, submissions, chatSessions, llmCalls] =
    await Promise.all([
      db
        .collection(`tenants/${tenantId}/students`)
        .where("status", "==", "active")
        .count()
        .get(),
      db
        .collection(`tenants/${tenantId}/spaces`)
        .where("status", "==", "published")
        .count()
        .get(),
      db.collection(`tenants/${tenantId}/exams`).count().get(),
      db.collection(`tenants/${tenantId}/submissions`).count().get(),
      db.collection(`tenants/${tenantId}/chatSessions`).count().get(),
      aggregateLLMCosts(tenantId),
    ]);

  // Active students (activity in last 30 days)
  const thirtyDaysAgo = admin.firestore.Timestamp.fromMillis(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  );
  const activeStudents = await db
    .collection(`tenants/${tenantId}/studentProgressSummaries`)
    .where("levelup.lastActiveAt", ">=", thirtyDaysAgo)
    .count()
    .get();

  const analytics: TenantAnalytics = {
    tenantId,
    computedAt: admin.firestore.Timestamp.now(),
    period: "current_month",
    students: {
      total: students.data().count,
      active: activeStudents.data().count,
      averageEngagementScore: 0, // Computed from student summaries
      newThisMonth: 0, // Computed from student createdAt
    },
    levelup: {
      /* ... aggregated from space progress */
    },
    autograde: {
      /* ... aggregated from submissions */
    },
    ai: llmCalls,
    classes: {
      /* ... aggregated from classes */
    },
  };

  await db.doc(`tenants/${tenantId}/tenantAnalytics/current`).set(analytics);
}
```

---

## 9. Real-Time Leaderboards

### 9.1 Architecture

**RTDB Path:** `leaderboards/{tenantId}/{spaceId}`

Leaderboards use RTDB for <5s update latency. The leaderboard is updated by
Cloud Functions (not client-side) to prevent manipulation.

```typescript
// RTDB structure
interface LeaderboardRTDB {
  // leaderboards/{tenantId}/{spaceId}
  entries: Record<
    string,
    {
      uid: string;
      name: string; // Denormalized display name
      score: number; // Total points earned
      rank: number; // Computed on write
      lastUpdated: number; // Epoch ms
      avatarUrl?: string;
    }
  >;
  metadata: {
    totalParticipants: number;
    lastUpdated: number;
    spaceTitle: string;
  };
}
```

### 9.2 Update Flow

```typescript
async function updateLeaderboard(
  tenantId: string,
  spaceId: string,
  userId: string,
  pointsEarned: number
): Promise<void> {
  const leaderboardRef = admin
    .database()
    .ref(`leaderboards/${tenantId}/${spaceId}/entries/${userId}`);

  // Atomic update with transaction
  await leaderboardRef.transaction((current) => {
    if (!current) {
      return {
        uid: userId,
        name: "", // Will be set below
        score: pointsEarned,
        rank: 0, // Computed separately
        lastUpdated: Date.now(),
      };
    }
    return {
      ...current,
      score: Math.max(current.score, pointsEarned), // Best score wins
      lastUpdated: Date.now(),
    };
  });

  // Set display name if new entry
  const userDoc = await admin.firestore().doc(`users/${userId}`).get();
  if (userDoc.exists) {
    await leaderboardRef.update({
      name: userDoc.data()!.displayName || "Anonymous",
      avatarUrl: userDoc.data()!.photoURL || null,
    });
  }

  // Update participant count
  await admin
    .database()
    .ref(`leaderboards/${tenantId}/${spaceId}/metadata/totalParticipants`)
    .transaction((count) => (count || 0) + (count === null ? 1 : 0));
}
```

### 9.3 RTDB Security Rules for Leaderboards

```json
{
  "leaderboards": {
    "$tenantId": {
      ".read": "auth != null && auth.token.tenantId === $tenantId",
      ".write": false,
      "$spaceId": {
        ".read": "auth != null && auth.token.tenantId === $tenantId",
        "entries": {
          ".write": false
        },
        "metadata": {
          ".write": false
        }
      }
    }
  }
}
```

All leaderboard writes go through Cloud Functions (Admin SDK). Client reads are
allowed for tenant members.

---

## 10. Insight Engine

### 10.1 Design

The Insight Engine is a **rule-based** system (no LLM). It generates actionable
recommendations by correlating LevelUp and AutoGrade data. It runs as part of
the `updateStudentProgressSummary` function.

### 10.2 Rule Definitions

| #   | Rule                                  | Trigger                                                   | Threshold              | Output                                                    |
| --- | ------------------------------------- | --------------------------------------------------------- | ---------------------- | --------------------------------------------------------- |
| 1   | **Weak Topic → Space Recommendation** | Exam graded with score < 50% on topic                     | Fixed 50%              | `type: 'practice'`, links to LevelUp space covering topic |
| 2   | **Engagement-Score Gap**              | LevelUp score > 70% AND AutoGrade < 50% on same topic     | 70%/50%                | `type: 'review'`, suggests applied practice               |
| 3   | **At-Risk Detection**                 | AutoGrade < 40% on last exam AND LevelUp engagement < 20% | 40%/20%                | `riskLevel: 'high'`, teacher notified                     |
| 4   | **Unused Space Prompt**               | Assigned space not started after 7 days                   | 7 days                 | `type: 'start_space'`, prompt to begin                    |
| 5   | **Low Practice Engagement**           | < 5 practice items in 7 days                              | 5 items / 7 days       | `riskLevel: 'low'`                                        |
| 6   | **Declining Trend**                   | Last 3 exam scores each lower than previous               | 3 consecutive declines | `type: 'review'`, flag for teacher                        |

### 10.3 Implementation

```typescript
function generateInsights(
  levelup: StudentProgressSummary["levelup"],
  autograde: StudentProgressSummary["autograde"],
  tenantId: string
): StudentProgressSummary["insights"] {
  const recommendations: Recommendation[] = [];
  const topicCorrelations: TopicCorrelation[] = [];
  const riskFactors: string[] = [];

  // ─── Rule 1: Weak Topic → Space Recommendation ────────────
  for (const [subject, agPerf] of Object.entries(
    autograde.subjectPerformance
  )) {
    for (const weakTopic of agPerf.weakTopics) {
      // Find LevelUp space covering this topic
      const matchingSpace = findSpaceForTopic(levelup.spaces, weakTopic);
      if (matchingSpace) {
        recommendations.push({
          id: deterministicHash("practice", weakTopic, matchingSpace.spaceId),
          type: "practice",
          topic: weakTopic,
          reason: `You scored below 50% on "${weakTopic}" in recent exams. Practice in "${matchingSpace.spaceName}" to improve.`,
          suggestedSpaceId: matchingSpace.spaceId,
          suggestedSpaceName: matchingSpace.spaceName,
          priority: "high",
          dismissed: false,
          generatedAt: admin.firestore.Timestamp.now(),
        });
      }
    }
  }

  // ─── Rule 2: Engagement-Score Gap ─────────────────────────
  for (const [subject, lvPerf] of Object.entries(levelup.subjectPerformance)) {
    const agPerf = autograde.subjectPerformance[subject];
    if (agPerf && lvPerf.averageScore > 0.7 && agPerf.averagePercentage < 50) {
      recommendations.push({
        id: deterministicHash("review", subject),
        type: "review",
        topic: subject,
        reason: `You complete ${subject} content well (${Math.round(lvPerf.averageScore * 100)}%) but underperform on exams (${agPerf.averagePercentage}%). Focus on applied problem-solving.`,
        priority: "high",
        dismissed: false,
        generatedAt: admin.firestore.Timestamp.now(),
      });

      topicCorrelations.push({
        topic: subject,
        levelupScore: lvPerf.averageScore,
        autogradeScore: agPerf.averagePercentage / 100,
        gapDirection: "levelup_ahead",
        gapMagnitude: lvPerf.averageScore - agPerf.averagePercentage / 100,
      });
    }
  }

  // ─── Rule 3: At-Risk Detection ────────────────────────────
  const lastExam = getLastExam(autograde.exams);
  const hasLowExamScore = lastExam && lastExam.percentage < 40;
  const hasLowEngagement = levelup.overallPercentage < 0.2;

  if (hasLowExamScore && hasLowEngagement) {
    riskFactors.push("Low exam score AND low LevelUp engagement");
  } else if (hasLowExamScore) {
    riskFactors.push(`Last exam score: ${lastExam!.percentage}%`);
  } else if (hasLowEngagement) {
    riskFactors.push("LevelUp engagement below 20%");
  }

  // ─── Rule 4: Unused Space Prompt ──────────────────────────
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [spaceId, space] of Object.entries(levelup.spaces)) {
    if (space.status === "not_started") {
      recommendations.push({
        id: deterministicHash("start_space", spaceId),
        type: "start_space",
        topic: space.spaceName,
        reason: `You haven't started "${space.spaceName}" yet.`,
        suggestedSpaceId: spaceId,
        suggestedSpaceName: space.spaceName,
        priority: "medium",
        dismissed: false,
        generatedAt: admin.firestore.Timestamp.now(),
      });
    }
  }

  // ─── Compute Risk Level ───────────────────────────────────
  let riskLevel: "none" | "low" | "medium" | "high" = "none";
  if (hasLowExamScore && hasLowEngagement) riskLevel = "high";
  else if (hasLowExamScore || hasLowEngagement) riskLevel = "medium";
  else if (levelup.practiceStats.totalItemsCompleted < 5) riskLevel = "low";

  // ─── Compute Engagement Score ─────────────────────────────
  const engagementScore = computeEngagementScore(levelup);

  return {
    topicCorrelations,
    recommendations: recommendations.slice(0, 10), // Max 10 recommendations
    riskLevel,
    riskFactors,
    engagementScore,
  };
}

function computeEngagementScore(
  levelup: StudentProgressSummary["levelup"]
): number {
  // Weighted score based on activity signals
  const weights = {
    completionRate: 0.3,
    practiceActivity: 0.2,
    recency: 0.2,
    streak: 0.15,
    timeSpent: 0.15,
  };

  const completionRate = levelup.overallPercentage;
  const practiceActivity = Math.min(
    1,
    levelup.practiceStats.totalItemsCompleted / 50
  );
  const daysSinceActive = levelup.lastActiveAt
    ? (Date.now() - levelup.lastActiveAt.toMillis()) / (24 * 60 * 60 * 1000)
    : 30;
  const recency = Math.max(0, 1 - daysSinceActive / 30);
  const streak = Math.min(1, levelup.streakDays / 14);
  const timeSpent = Math.min(1, levelup.totalTimeSpentMinutes / 600); // Cap at 10 hours

  return (
    weights.completionRate * completionRate +
    weights.practiceActivity * practiceActivity +
    weights.recency * recency +
    weights.streak * streak +
    weights.timeSpent * timeSpent
  );
}
```

---

## 11. Notification Service

### 11.1 Architecture

```
Notification Flow:
                                                    ┌─────────────────┐
 Cloud Function ──▶ NotificationService.send() ──┬──▶│ Firestore       │  (in-app)
 (trigger event)                                  │  │ /notifications/ │
                                                  │  └─────────────────┘
                                                  │  ┌─────────────────┐
                                                  ├──▶│ FCM             │  (push)
                                                  │  │ (Firebase Cloud  │
                                                  │  │  Messaging)      │
                                                  │  └─────────────────┘
                                                  │  ┌─────────────────┐
                                                  └──▶│ SendGrid        │  (email)
                                                     │ (transactional)  │
                                                     └─────────────────┘
```

### 11.2 Notification Triggers

| Event                      | Recipient(s)                 | Channels              | Priority |
| -------------------------- | ---------------------------- | --------------------- | -------- |
| Exam results released      | Students + Parents in class  | in_app + push + email | high     |
| Space published            | Students in assigned classes | in_app + push         | normal   |
| At-risk student detected   | Assigned teachers            | in_app                | normal   |
| AI budget at 80%           | TenantAdmin(s)               | in_app + email        | high     |
| AI budget at 100% (paused) | TenantAdmin(s)               | in_app + email + push | urgent   |
| New recommendation         | Student                      | in_app                | low      |
| Grading pipeline failed    | TenantAdmin + Teacher        | in_app                | high     |
| Weekly progress digest     | Parents (opted in)           | email                 | low      |

### 11.3 NotificationService Implementation

```typescript
class NotificationService {
  private db = admin.firestore();
  private messaging = admin.messaging();

  async send(params: {
    tenantId: string;
    recipientUid: string;
    type: NotificationType;
    title: string;
    body: string;
    channels: ("in_app" | "push" | "email")[];
    priority?: "low" | "normal" | "high" | "urgent";
    data?: Record<string, string>;
  }): Promise<string> {
    const notificationId = this.db
      .collection(`tenants/${params.tenantId}/notifications`)
      .doc().id;

    const notification: Notification = {
      id: notificationId,
      tenantId: params.tenantId,
      recipientUid: params.recipientUid,
      type: params.type,
      title: params.title,
      body: params.body,
      channels: params.channels,
      deliveryStatus: {},
      read: false,
      priority: params.priority || "normal",
      data: params.data,
      createdAt: admin.firestore.Timestamp.now(),
    };

    // 1. Always write to Firestore (in-app)
    if (params.channels.includes("in_app")) {
      await this.db
        .doc(`tenants/${params.tenantId}/notifications/${notificationId}`)
        .set(notification);
      notification.deliveryStatus.in_app = "sent";
    }

    // 2. Push notification via FCM
    if (params.channels.includes("push")) {
      try {
        const fcmToken = await this.getFCMToken(params.recipientUid);
        if (fcmToken) {
          await this.messaging.send({
            token: fcmToken,
            notification: { title: params.title, body: params.body },
            data: params.data || {},
            android: { priority: "high" },
            webpush: { headers: { Urgency: "high" } },
          });
          notification.deliveryStatus.push = "sent";
        } else {
          notification.deliveryStatus.push = "skipped";
        }
      } catch (err) {
        notification.deliveryStatus.push = "failed";
        console.error(`FCM failed for ${params.recipientUid}:`, err);
      }
    }

    // 3. Email via SendGrid
    if (params.channels.includes("email")) {
      try {
        const userEmail = await this.getUserEmail(params.recipientUid);
        if (userEmail) {
          await this.sendEmail(
            userEmail,
            params.title,
            params.body,
            params.type
          );
          notification.deliveryStatus.email = "sent";
        } else {
          notification.deliveryStatus.email = "skipped";
        }
      } catch (err) {
        notification.deliveryStatus.email = "failed";
        console.error(`Email failed for ${params.recipientUid}:`, err);
      }
    }

    // Update delivery status
    await this.db
      .doc(`tenants/${params.tenantId}/notifications/${notificationId}`)
      .update({ deliveryStatus: notification.deliveryStatus });

    return notificationId;
  }

  async sendBulk(params: {
    tenantId: string;
    recipientUids: string[];
    type: NotificationType;
    title: string;
    body: string;
    channels: ("in_app" | "push" | "email")[];
    priority?: "low" | "normal" | "high" | "urgent";
    data?: Record<string, string>;
  }): Promise<void> {
    // Process in batches of 500 (Firestore batch write limit)
    const BATCH_SIZE = 500;
    for (let i = 0; i < params.recipientUids.length; i += BATCH_SIZE) {
      const batch = params.recipientUids.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((uid) => this.send({ ...params, recipientUid: uid }))
      );
    }
  }

  private async getFCMToken(uid: string): Promise<string | null> {
    const doc = await this.db.doc(`users/${uid}`).get();
    return doc.data()?.fcmToken || null;
  }

  private async getUserEmail(uid: string): Promise<string | null> {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord.email || null;
  }

  private async sendEmail(
    to: string,
    subject: string,
    body: string,
    type: NotificationType
  ): Promise<void> {
    // SendGrid integration
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    await sgMail.send({
      to,
      from: "notifications@levelup.app",
      subject,
      text: body,
      templateId: EMAIL_TEMPLATES[type],
      dynamicTemplateData: { subject, body },
    });
  }
}

// Email templates mapped by notification type
const EMAIL_TEMPLATES: Partial<Record<NotificationType, string>> = {
  result_released: "d-abc123...",
  budget_warning: "d-def456...",
  budget_critical: "d-ghi789...",
  weekly_digest: "d-jkl012...",
};
```

---

## 12. AI Infrastructure — LLMWrapper

### 12.1 Architecture

All AI calls go through the `LLMWrapper` Cloud Function. No client-side AI SDK
usage.

```
Client Request → Cloud Function → LLMWrapper → Gemini API
                                      │
                                      ├── Reads API key from Secret Manager
                                      ├── Enforces rate limits (RTDB counters)
                                      ├── Checks budget (monthly cost summary)
                                      ├── Logs call to llmCallLogs
                                      └── Returns result to Cloud Function
```

### 12.2 LLMWrapper Implementation

```typescript
class LLMWrapper {
  private secretManager: SecretManagerServiceClient;
  private db = admin.firestore();
  private rtdb = admin.database();

  constructor() {
    this.secretManager = new SecretManagerServiceClient();
  }

  async call(params: {
    tenantId: string;
    userId?: string;
    userRole?: string;
    task: TaskType;
    model?: string;
    prompt: string;
    images?: string[];
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    relatedResourceType?: string;
    relatedResourceId?: string;
    tags?: string[];
  }): Promise<LLMCallResult> {
    const startTime = Date.now();
    const callId = this.db
      .collection(`tenants/${params.tenantId}/llmCallLogs`)
      .doc().id;

    // 1. Check rate limits
    await this.enforceRateLimits(params.tenantId, params.userId, params.task);

    // 2. Check budget
    await this.checkBudget(params.tenantId);

    // 3. Get API key from Secret Manager
    const apiKey = await this.getApiKey(params.tenantId);

    // 4. Select model
    const model = params.model || this.getDefaultModel(params.task);

    // 5. Call Gemini
    let result: any;
    let success = true;
    let errorMessage: string | undefined;
    let finishReason: string | undefined;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const genModel = genAI.getGenerativeModel({
        model,
        systemInstruction: params.systemInstruction,
      });

      const parts: any[] = [{ text: params.prompt }];
      if (params.images) {
        for (const imageUrl of params.images) {
          const imageData = await this.fetchImage(imageUrl);
          parts.push({
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.base64,
            },
          });
        }
      }

      const genResult = await genModel.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: params.temperature ?? 0.3,
          maxOutputTokens: params.maxOutputTokens ?? 4096,
        },
      });

      result = genResult.response;
      finishReason = result.candidates?.[0]?.finishReason || "STOP";
    } catch (err: any) {
      success = false;
      errorMessage = err.message;
      finishReason = "ERROR";
    }

    // 6. Calculate cost
    const usage = result?.usageMetadata || {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
    };
    const inputTokens = usage.promptTokenCount || 0;
    const outputTokens = usage.candidatesTokenCount || 0;
    const cost = calculateCost(model, inputTokens, outputTokens);

    // 7. Log call
    const callLog: LLMCallLog = {
      callId,
      tenantId: params.tenantId,
      userId: params.userId,
      userRole: params.userRole as any,
      task: params.task,
      provider: "gemini",
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      inputCostUSD: cost.inputCost,
      outputCostUSD: cost.outputCost,
      totalCostUSD: cost.totalCost,
      latencyMs: Date.now() - startTime,
      success,
      finishReason: finishReason as any,
      errorMessage,
      relatedResourceType: params.relatedResourceType as any,
      relatedResourceId: params.relatedResourceId,
      hasImages: !!params.images?.length,
      imageCount: params.images?.length || 0,
      createdAt: admin.firestore.Timestamp.now(),
      callStartedAt: admin.firestore.Timestamp.fromMillis(startTime),
      callCompletedAt: admin.firestore.Timestamp.now(),
      tags: params.tags,
    };

    // Write log (non-blocking)
    this.db
      .doc(`tenants/${params.tenantId}/llmCallLogs/${callId}`)
      .set(callLog)
      .catch((err) => console.error("Failed to log LLM call:", err));

    if (!success) {
      throw new functions.https.HttpsError(
        "internal",
        `AI call failed: ${errorMessage}`
      );
    }

    return {
      text: result.text(),
      callId,
      tokens: { input: inputTokens, output: outputTokens },
      costUSD: cost.totalCost,
      latencyMs: Date.now() - startTime,
    };
  }

  private async getApiKey(tenantId: string): Promise<string> {
    // Read key reference from tenant settings
    const tenantDoc = await this.db.doc(`tenants/${tenantId}`).get();
    const keyRef = tenantDoc.data()?.settings?.geminiKeyRef;

    if (!keyRef) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No AI API key configured for this tenant"
      );
    }

    // Read from Secret Manager
    const [version] = await this.secretManager.accessSecretVersion({
      name: `projects/${PROJECT_ID}/secrets/${keyRef}/versions/latest`,
    });

    return version.payload!.data!.toString();
  }

  private getDefaultModel(task: TaskType): string {
    const LITE_TASKS: TaskType[] = [
      "tutoring_chat",
      "answer_evaluation",
      "feedback_summary",
      "context_summarization",
    ];
    return LITE_TASKS.includes(task)
      ? "gemini-2.5-flash-lite"
      : "gemini-2.5-flash";
  }
}

interface LLMCallResult {
  text: string;
  callId: string;
  tokens: { input: number; output: number };
  costUSD: number;
  latencyMs: number;
}
```

### 12.3 Cost Calculation

```typescript
// Gemini pricing (as of 2026, update as needed)
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gemini-2.5-flash": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gemini-2.5-flash-lite": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10.0 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
) {
  const pricing = PRICING[model] || PRICING["gemini-2.5-flash"];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}
```

---

## 13. Cost Tracking & Budget Management

### 13.1 Daily Cost Aggregation

Cloud Scheduler runs at **00:05 UTC** daily.

```typescript
export const aggregateDailyCosts = functions.pubsub
  .schedule("5 0 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    const yesterday = getYesterdayDateString(); // YYYY-MM-DD

    const tenants = await admin
      .firestore()
      .collection("tenants")
      .where("status", "==", "active")
      .where("settings.geminiKeySet", "==", true)
      .get();

    for (const tenantDoc of tenants.docs) {
      await aggregateTenantDailyCost(tenantDoc.id, yesterday);
    }
  });

async function aggregateTenantDailyCost(
  tenantId: string,
  date: string
): Promise<void> {
  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const logs = await admin
    .firestore()
    .collection(`tenants/${tenantId}/llmCallLogs`)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
    .get();

  if (logs.empty) return;

  // Aggregate by task, model, role
  const byTask: Record<string, any> = {};
  const byModel: Record<string, any> = {};
  const byRole: Record<string, any> = {};
  let totalCost = 0,
    totalTokens = 0,
    totalCalls = 0,
    successfulCalls = 0;

  for (const doc of logs.docs) {
    const log = doc.data() as LLMCallLog;
    totalCost += log.totalCostUSD;
    totalTokens += log.totalTokens;
    totalCalls++;
    if (log.success) successfulCalls++;

    // Aggregate by task
    if (!byTask[log.task]) {
      byTask[log.task] = {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUSD: 0,
        totalLatency: 0,
        successes: 0,
      };
    }
    byTask[log.task].calls++;
    byTask[log.task].inputTokens += log.inputTokens;
    byTask[log.task].outputTokens += log.outputTokens;
    byTask[log.task].costUSD += log.totalCostUSD;
    byTask[log.task].totalLatency += log.latencyMs;
    if (log.success) byTask[log.task].successes++;

    // Similar for byModel and byRole...
  }

  // Finalize averages
  for (const task of Object.keys(byTask)) {
    byTask[task].averageLatencyMs =
      byTask[task].totalLatency / byTask[task].calls;
    byTask[task].successRate = byTask[task].successes / byTask[task].calls;
    delete byTask[task].totalLatency;
    delete byTask[task].successes;
  }

  const dailySummary: DailyCostSummary = {
    tenantId,
    date,
    computedAt: admin.firestore.Timestamp.now(),
    totalCostUSD: totalCost,
    totalTokens,
    totalCalls,
    successfulCalls,
    failedCalls: totalCalls - successfulCalls,
    byTask,
    byModel,
    byRole,
    topExamsByAICost: [], // Computed separately
  };

  await admin
    .firestore()
    .doc(`tenants/${tenantId}/costSummaries/daily/${date}`)
    .set(dailySummary);

  // Update monthly summary
  await updateMonthlyCostSummary(tenantId, date, totalCost);
}
```

### 13.2 Budget Alert Thresholds

| Threshold              | Action                                                  | Channels              |
| ---------------------- | ------------------------------------------------------- | --------------------- |
| 80% of monthly budget  | Warning notification                                    | in_app + email        |
| 100% of monthly budget | **Graceful pause**: no new AI calls, in-flight complete | in_app + email + push |
| Single call > $1 USD   | Anomaly log                                             | in_app (TenantAdmin)  |
| Daily spend > $10      | Warning notification                                    | in_app + email        |
| Daily spend > $50      | Critical alert                                          | in_app + email + push |

### 13.3 Graceful Pause Implementation

When budget hits 100%, the system performs a **graceful pause**:

- No new AI calls are accepted (LLMWrapper returns 429 with message)
- In-flight operations (active grading pipeline, ongoing chat responses) are
  allowed to complete
- TenantAdmin is notified with option to request budget increase
- `MonthlyCostSummary.isPaused = true` and `pausedAt` set

```typescript
private async checkBudget(tenantId: string): Promise<void> {
  const currentMonth = getCurrentMonthString(); // YYYY-MM
  const monthlyDoc = await this.db
    .doc(`tenants/${tenantId}/costSummaries/monthly/${currentMonth}`)
    .get();

  if (!monthlyDoc.exists) return; // No data yet, allow calls

  const monthly = monthlyDoc.data() as MonthlyCostSummary;

  if (monthly.isPaused) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'AI features are paused due to budget limits. Contact your administrator to increase the budget.'
    );
  }

  // Check 80% warning (send alert once)
  if (monthly.budgetUsagePercent >= 80 && monthly.budgetUsagePercent < 100) {
    const alreadySent = monthly.alertsSent?.some(a => a.threshold === 0.80);
    if (!alreadySent) {
      await this.sendBudgetAlert(tenantId, 80, 'warning');
    }
  }

  // Check 100% — initiate graceful pause
  if (monthly.budgetUsagePercent >= 100) {
    await this.db
      .doc(`tenants/${tenantId}/costSummaries/monthly/${currentMonth}`)
      .update({
        isPaused: true,
        pausedAt: admin.firestore.Timestamp.now(),
        pausedReason: 'Monthly AI budget exceeded',
      });
    await this.sendBudgetAlert(tenantId, 100, 'critical');

    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Monthly AI budget has been exceeded. AI features are now paused.'
    );
  }
}
```

---

## 14. Rate Limiting

### 14.1 Strategy

Rate limits are enforced at **both** per-user and per-tenant levels
simultaneously using RTDB counters with sliding windows.

### 14.2 Rate Limit Configuration

```typescript
interface RateLimits {
  perUser: {
    chatMessagesPerMinute: 10;
    evaluationsPerMinute: 5;
    totalCallsPerMinute: 15;
  };
  perTenant: {
    gradingCallsPerMinute: 50;
    chatCallsPerMinute: 100;
    totalCallsPerMinute: 200;
  };
  perPlan: {
    trial: { monthlyBudgetUsd: 5 };
    basic: { monthlyBudgetUsd: 50 };
    premium: { monthlyBudgetUsd: 200 };
    enterprise: { monthlyBudgetUsd: number }; // Custom per contract
  };
}
```

### 14.3 RTDB Counter Implementation

```typescript
// RTDB paths for rate limiting
// rateLimits/{tenantId}/user/{userId}/{minute_bucket}
// rateLimits/{tenantId}/tenant/{minute_bucket}

async function enforceRateLimits(
  tenantId: string,
  userId: string | undefined,
  task: TaskType
): Promise<void> {
  const minuteBucket = Math.floor(Date.now() / 60000).toString();

  // 1. Per-user limit
  if (userId) {
    const userCountRef = admin
      .database()
      .ref(`rateLimits/${tenantId}/user/${userId}/${minuteBucket}`);

    const newCount = await userCountRef.transaction((current) => {
      return (current || 0) + 1;
    });

    const limit = isGradingTask(task) ? 5 : 10;
    if (newCount.snapshot.val() > limit) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded: max ${limit} AI calls per minute. Please wait and try again.`
      );
    }

    // Set TTL: auto-delete after 2 minutes
    await userCountRef.onDisconnect().remove();
  }

  // 2. Per-tenant limit
  const tenantCountRef = admin
    .database()
    .ref(`rateLimits/${tenantId}/tenant/${minuteBucket}`);

  const newTenantCount = await tenantCountRef.transaction((current) => {
    return (current || 0) + 1;
  });

  const tenantLimit = isGradingTask(task) ? 50 : 200;
  if (newTenantCount.snapshot.val() > tenantLimit) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Organization AI rate limit exceeded. Too many concurrent requests. Please try again shortly."
    );
  }
}

function isGradingTask(task: TaskType): boolean {
  return [
    "answer_grading",
    "answer_mapping",
    "ocr_handwriting",
    "question_extraction",
  ].includes(task);
}
```

### 14.4 RTDB Cleanup

Rate limit counters are cleaned up by a scheduled function every hour:

```typescript
export const cleanupRateLimitCounters = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async () => {
    const twoMinutesAgo = Math.floor(Date.now() / 60000) - 2;

    // Remove all minute buckets older than 2 minutes
    // This is done per-tenant to avoid scanning all data
    const tenantsSnap = await admin.database().ref("rateLimits").once("value");
    if (!tenantsSnap.exists()) return;

    const updates: Record<string, null> = {};
    tenantsSnap.forEach((tenantSnap) => {
      // Clean user counters
      tenantSnap.child("user").forEach((userSnap) => {
        userSnap.forEach((bucketSnap) => {
          if (parseInt(bucketSnap.key!) < twoMinutesAgo) {
            updates[
              `rateLimits/${tenantSnap.key}/user/${userSnap.key}/${bucketSnap.key}`
            ] = null;
          }
        });
      });
      // Clean tenant counters
      tenantSnap.child("tenant").forEach((bucketSnap) => {
        if (parseInt(bucketSnap.key!) < twoMinutesAgo) {
          updates[`rateLimits/${tenantSnap.key}/tenant/${bucketSnap.key}`] =
            null;
        }
      });
    });

    if (Object.keys(updates).length > 0) {
      await admin.database().ref().update(updates);
    }
  });
```

---

## 15. Denormalized Counter Maintenance

### 15.1 Counter Map

| Counter                        | Location   | Update Trigger             | Mechanism                                                           |
| ------------------------------ | ---------- | -------------------------- | ------------------------------------------------------------------- |
| `Tenant.stats.totalStudents`   | Tenant doc | Student created/deleted    | Firestore trigger `onStudentWrite` + `FieldValue.increment()`       |
| `Tenant.stats.totalTeachers`   | Tenant doc | Teacher created/deleted    | Firestore trigger `onTeacherWrite` + `FieldValue.increment()`       |
| `Tenant.stats.totalClasses`    | Tenant doc | Class created/archived     | Firestore trigger `onClassWrite` + `FieldValue.increment()`         |
| `Tenant.stats.totalSpaces`     | Tenant doc | Space created/deleted      | Firestore trigger `onSpaceWrite` + `FieldValue.increment()`         |
| `Tenant.stats.totalExams`      | Tenant doc | Exam created/deleted       | Firestore trigger `onExamWrite` + `FieldValue.increment()`          |
| `Class.studentCount`           | Class doc  | Student.classIds changed   | Firestore trigger `onStudentWrite` + `FieldValue.increment()`       |
| `Space.stats.totalStudents`    | Space doc  | New SpaceProgress created  | Firestore trigger `onSpaceProgressWrite` + `FieldValue.increment()` |
| `Space.stats.totalStoryPoints` | Space doc  | StoryPoint created/deleted | Firestore trigger `onStoryPointWrite` + `FieldValue.increment()`    |
| `Space.stats.totalItems`       | Space doc  | Item created/deleted       | Firestore trigger `onItemWrite` + `FieldValue.increment()`          |

### 15.2 Implementation Pattern

All counter updates use `FieldValue.increment()` for atomicity:

```typescript
// Example: Student counter on Tenant
export const onStudentWrite = functions.firestore
  .document("tenants/{tenantId}/students/{studentId}")
  .onWrite(async (change, context) => {
    const { tenantId } = context.params;
    const tenantRef = admin.firestore().doc(`tenants/${tenantId}`);

    const before = change.before.data();
    const after = change.after.data();

    // New student created (active)
    if (!before && after && after.status === "active") {
      await tenantRef.update({
        "stats.totalStudents": admin.firestore.FieldValue.increment(1),
      });
    }
    // Student deleted or deactivated
    else if (
      before?.status === "active" &&
      (!after || after.status === "deleted")
    ) {
      await tenantRef.update({
        "stats.totalStudents": admin.firestore.FieldValue.increment(-1),
      });
    }

    // Class.studentCount update
    if (before && after) {
      const removedClasses = (before.classIds || []).filter(
        (c: string) => !(after.classIds || []).includes(c)
      );
      const addedClasses = (after.classIds || []).filter(
        (c: string) => !(before.classIds || []).includes(c)
      );

      const batch = admin.firestore().batch();
      for (const classId of removedClasses) {
        batch.update(
          admin.firestore().doc(`tenants/${tenantId}/classes/${classId}`),
          { studentCount: admin.firestore.FieldValue.increment(-1) }
        );
      }
      for (const classId of addedClasses) {
        batch.update(
          admin.firestore().doc(`tenants/${tenantId}/classes/${classId}`),
          { studentCount: admin.firestore.FieldValue.increment(1) }
        );
      }
      await batch.commit();
    }
  });
```

### 15.3 Contention Handling

For high-contention counters (e.g., `Space.stats.totalStudents` during bulk
enrollment where >1 write/second):

**Strategy:** Use `FieldValue.increment()` which is atomic and handles
contention automatically. Firestore guarantees serialization of increments. If
contention exceeds Firestore's internal retry (extremely rare — >500 writes/sec
to same doc), fall back to **distributed counters**:

```typescript
// Distributed counter pattern (only if needed for >500 writes/sec)
// /tenants/{tenantId}/spaces/{spaceId}/counters/shard_{0-9}
// Read: sum all shards. Write: increment random shard.

async function incrementDistributed(
  docPath: string,
  field: string,
  numShards: number = 10
): Promise<void> {
  const shardId = Math.floor(Math.random() * numShards);
  const shardRef = admin
    .firestore()
    .doc(`${docPath}/counters/shard_${shardId}`);

  await shardRef.set(
    { [field]: admin.firestore.FieldValue.increment(1) },
    { merge: true }
  );
}

async function readDistributed(
  docPath: string,
  field: string,
  numShards: number = 10
): Promise<number> {
  const shards = await admin
    .firestore()
    .collection(`${docPath}/counters`)
    .get();

  return shards.docs.reduce((sum, doc) => sum + (doc.data()[field] || 0), 0);
}
```

**Current recommendation:** Start with simple `FieldValue.increment()`. Monitor
for contention errors in Cloud Function logs. Only implement distributed
counters if contention is observed in production.

---

## 16. Cloud Functions Specification

### 16.1 Firestore Triggers

| Function Name                  | Trigger Path                                             | Purpose                                          |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------ |
| `onSpaceProgressWrite`         | `tenants/{tenantId}/spaceProgress/{progressId}`          | Update student summary, leaderboard, space stats |
| `onSubmissionStatusChange`     | `tenants/{tenantId}/submissions/{submissionId}`          | Update student summary when grades released      |
| `onDigitalTestSessionComplete` | `tenants/{tenantId}/digitalTestSessions/{sessionId}`     | Update space progress with test results          |
| `onStudentWrite`               | `tenants/{tenantId}/students/{studentId}`                | Update tenant stats, class student counts        |
| `onTeacherWrite`               | `tenants/{tenantId}/teachers/{teacherId}`                | Update tenant stats                              |
| `onClassWrite`                 | `tenants/{tenantId}/classes/{classId}`                   | Update tenant stats                              |
| `onSpaceWrite`                 | `tenants/{tenantId}/spaces/{spaceId}`                    | Update tenant stats                              |
| `onExamWrite`                  | `tenants/{tenantId}/exams/{examId}`                      | Update tenant stats                              |
| `onStoryPointWrite`            | `tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}` | Update space stats                               |
| `onItemWrite`                  | `tenants/{tenantId}/spaces/{spaceId}/items/{itemId}`     | Update space stats                               |

### 16.2 Callable Functions

| Function Name                | Auth Required         | Purpose                               |
| ---------------------------- | --------------------- | ------------------------------------- |
| `flushPracticeProgress`      | Student (own data)    | Flush RTDB practice data to Firestore |
| `computeExamAnalytics`       | Teacher / TenantAdmin | On-demand exam analytics computation  |
| `dismissRecommendation`      | Student               | Mark a recommendation as dismissed    |
| `markNotificationRead`       | Any authenticated     | Mark notification as read             |
| `getUnreadNotificationCount` | Any authenticated     | Get count of unread notifications     |

### 16.3 HTTP Functions (Cloud Tasks targets)

| Function Name                 | Triggered By                | Purpose                    |
| ----------------------------- | --------------------------- | -------------------------- |
| `updateClassProgressSummary`  | Cloud Task (3-min debounce) | Recompute class summary    |
| `flushPracticeProgressBeacon` | sendBeacon from client      | Best-effort practice flush |

---

## 17. Cloud Scheduler Specification

| Job Name                        | Schedule        | Purpose                                     | Max Runtime |
| ------------------------------- | --------------- | ------------------------------------------- | ----------- |
| `flushStalePracticeProgress`    | Every 6 hours   | Flush stale RTDB practice data to Firestore | 5 min       |
| `computeNightlyTenantAnalytics` | Daily 00:05 UTC | Aggregate tenant-level analytics            | 10 min      |
| `aggregateDailyCosts`           | Daily 00:05 UTC | Aggregate AI costs from llmCallLogs         | 5 min       |
| `refreshExamAnalytics`          | Daily 02:00 UTC | Refresh exam analytics for recent exams     | 10 min      |
| `detectAtRiskStudents`          | Daily 03:00 UTC | Run at-risk detection across all tenants    | 10 min      |
| `cleanupRateLimitCounters`      | Hourly          | Remove stale RTDB rate limit counters       | 2 min       |
| `cleanupExpiredNotifications`   | Daily 04:00 UTC | Delete notifications older than 90 days     | 5 min       |

---

## 18. Migration Plan

### 18.1 Progress Data Migration

Progress data from both existing systems must be migrated to the unified
tenant-scoped structure.

#### LevelUp Progress Migration

```
Source:
  /userStoryPointProgress/{userId}_{storyPointId}  (global)
  /userCourseProgress/{userId}_{courseId}           (global)
  RTDB: courseProgress/{userId}/{courseId}           (global)
  RTDB: practiceProgress/{userId}/{courseId}         (global)

Target:
  /tenants/{tenantId}/spaceProgress/{userId}_{spaceId}  (tenant-scoped)
  RTDB: practiceProgress/{tenantId}/{userId}/{spaceId}   (tenant-scoped)
```

**Steps:**

1. For each LevelUp user with org membership:
   - Read all `userStoryPointProgress` docs where `courseId` matches a migrated
     space
   - Group by `courseId` (now `spaceId`)
   - Transform `UserStoryPointProgress` → `SpaceProgress` (combine all story
     point progress into one space progress doc)
   - Write to `/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}`
2. Migrate RTDB practice progress:
   - Read `practiceProgress/{userId}/{courseId}` → Write to
     `practiceProgress/{tenantId}/{userId}/{spaceId}`
3. Backfill `studentProgressSummaries` by running `updateStudentProgressSummary`
   for each migrated student

#### AutoGrade Progress Migration

AutoGrade submissions are already tenant-scoped
(`/clients/{clientId}/submissions/...`). Migration is a path rename:

```
Source: /clients/{clientId}/submissions/{submissionId}
Target: /tenants/{tenantId}/submissions/{submissionId}
```

No schema transformation needed — just path change.

### 18.2 Migration Validation

```typescript
async function validateProgressMigration(
  tenantId: string
): Promise<MigrationReport> {
  const report: MigrationReport = {
    tenantId,
    errors: [],
    warnings: [],
    stats: {},
  };

  // 1. Count source docs vs target docs
  const sourceCount = await countSourceProgressDocs(tenantId);
  const targetCount = await admin
    .firestore()
    .collection(`tenants/${tenantId}/spaceProgress`)
    .count()
    .get();

  if (sourceCount !== targetCount.data().count) {
    report.errors.push(
      `Count mismatch: source=${sourceCount}, target=${targetCount.data().count}`
    );
  }

  // 2. Sample 100 random docs and compare field-by-field
  const sampleDocs = await sampleTargetDocs(tenantId, 100);
  for (const doc of sampleDocs) {
    const sourceDoc = await findSourceDoc(doc.data());
    if (!sourceDoc) {
      report.errors.push(`Target doc ${doc.id} has no source match`);
      continue;
    }
    const diff = compareProgressDocs(sourceDoc, doc.data());
    if (diff.length > 0) {
      report.warnings.push(`Doc ${doc.id} has diffs: ${diff.join(", ")}`);
    }
  }

  // 3. Verify all students have summaries
  const studentsWithProgress = new Set<string>();
  const progressDocs = await admin
    .firestore()
    .collection(`tenants/${tenantId}/spaceProgress`)
    .get();
  progressDocs.docs.forEach((d) => studentsWithProgress.add(d.data().userId));

  for (const userId of studentsWithProgress) {
    const summary = await admin
      .firestore()
      .doc(`tenants/${tenantId}/studentProgressSummaries/${userId}`)
      .get();
    if (!summary.exists) {
      report.warnings.push(`Student ${userId} has progress but no summary`);
    }
  }

  return report;
}
```

### 18.3 Migration Execution Order

1. Migrate AutoGrade submissions (path rename) — Low risk
2. Migrate LevelUp progress data (transform + path change) — Medium risk
3. Run `updateStudentProgressSummary` for all students — Backfill
4. Run `updateClassProgressSummary` for all classes — Backfill
5. Compute exam analytics for all completed exams — Backfill
6. Migrate RTDB data (practice progress, leaderboards) — Medium risk
7. Run validation scripts
8. 2-week parallel monitoring before cleanup

---

## 19. Testing Strategy

### 19.1 Unit Tests

| Component                      | Test Focus                                                | Tool   |
| ------------------------------ | --------------------------------------------------------- | ------ |
| `updateStudentProgressSummary` | Aggregation logic, edge cases (empty data, single system) | Vitest |
| `generateInsights`             | All 6 rules, threshold boundaries, empty states           | Vitest |
| `computeExamAnalytics`         | Score distribution math, percentile calculation           | Vitest |
| `computeClassSummary`          | Aggregation across multiple students                      | Vitest |
| `LLMWrapper.calculateCost`     | Cost calculation for all models                           | Vitest |
| `enforceRateLimits`            | Counter logic, limit enforcement                          | Vitest |
| `mergePracticeIntoProgress`    | Merge strategy, best-score-wins logic                     | Vitest |
| `computeEngagementScore`       | Weight calculation, boundary values                       | Vitest |
| `NotificationService.send`     | Channel selection, error handling                         | Vitest |

### 19.2 Integration Tests (Firebase Emulator)

| Test Scenario                               | Description                                                  |
| ------------------------------------------- | ------------------------------------------------------------ |
| SpaceProgress write → Summary update        | Write progress, verify summary updated within 30s            |
| Submission release → Summary update         | Release grades, verify AutoGrade summary populated           |
| Student summary → Class summary (debounced) | Update multiple students, verify single class summary update |
| Practice flush → SpaceProgress merge        | Write RTDB data, flush, verify Firestore merge               |
| Budget exceeded → AI pause                  | Simulate budget overage, verify new calls rejected           |
| Rate limit enforcement                      | Rapid-fire AI calls, verify 429 after limit                  |
| Notification delivery                       | Trigger event, verify Firestore notification created         |
| Leaderboard update                          | Submit answer, verify RTDB leaderboard updated               |
| Counter maintenance                         | Create/delete students, verify Tenant.stats accurate         |

### 19.3 Cloud Scheduler Tests

| Job                             | Test Method                                               |
| ------------------------------- | --------------------------------------------------------- |
| `flushStalePracticeProgress`    | Create stale RTDB entries, trigger manually, verify flush |
| `computeNightlyTenantAnalytics` | Seed test data, trigger manually, verify analytics doc    |
| `aggregateDailyCosts`           | Seed llmCallLogs, trigger manually, verify daily summary  |
| `detectAtRiskStudents`          | Seed low-score students, trigger, verify flags            |

### 19.4 Performance Tests

| Test                           | Target                                      |
| ------------------------------ | ------------------------------------------- |
| Student summary update latency | < 30s for student with 50 spaces + 20 exams |
| Class summary compute          | < 10s for class with 100 students           |
| Exam analytics compute         | < 30s for exam with 500 submissions         |
| Leaderboard update             | < 5s for concurrent updates from 50 users   |
| Nightly tenant analytics       | < 5 min for tenant with 1000 students       |

### 19.5 Migration Tests

| Test                             | Description                                                    |
| -------------------------------- | -------------------------------------------------------------- |
| LevelUp progress transform       | Verify UserStoryPointProgress → SpaceProgress mapping fidelity |
| AutoGrade submission path rename | Verify all fields preserved after path change                  |
| RTDB practice migration          | Verify tenant-scoping applied correctly                        |
| Summary backfill                 | Verify all migrated students have summaries                    |
| Idempotency                      | Run migration twice, verify no duplicates                      |
| Rollback                         | Migrate, rollback, verify source data intact                   |

---

## 20. Dependencies on Other Modules

### 20.1 Upstream Dependencies (This Module Reads From)

| Module                | Collection                                     | What We Read                                       | Why                                   |
| --------------------- | ---------------------------------------------- | -------------------------------------------------- | ------------------------------------- |
| **Identity & Auth**   | `/users/{uid}`                                 | displayName, photoURL, fcmToken                    | Leaderboards, notifications           |
| **Identity & Auth**   | `/userMemberships/{id}`                        | classIds, role                                     | Filter summaries by class             |
| **Tenant Operations** | `/tenants/{tenantId}`                          | subscription.plan, settings.geminiKeyRef, features | Budget limits, API key, feature flags |
| **Tenant Operations** | `/tenants/{tenantId}/students/{id}`            | classIds, authUid, displayName                     | Class membership, summary linking     |
| **Tenant Operations** | `/tenants/{tenantId}/classes/{id}`             | name, teacherIds                                   | Class summary metadata                |
| **Content**           | `/tenants/{tenantId}/spaces/{id}`              | title, subject, labels, stats                      | Space metadata for summaries          |
| **Content**           | `/tenants/{tenantId}/exams/{id}`               | title, subject, topics, totalMarks, passingMarks   | Exam metadata for analytics           |
| **Content**           | `/tenants/{tenantId}/submissions/{id}`         | scores, grades, questionSubmissions                | AutoGrade progress data               |
| **Content**           | `/tenants/{tenantId}/digitalTestSessions/{id}` | scores, completion status                          | Timed test results                    |

### 20.2 Downstream Dependencies (Other Modules Read From Us)

| Module          | What They Read                   | Collection                         |
| --------------- | -------------------------------- | ---------------------------------- |
| **Student Web** | Dashboard data, recommendations  | `studentProgressSummaries`         |
| **Student Web** | Practice progress (real-time)    | RTDB `practiceProgress`            |
| **Student Web** | Leaderboard rankings             | RTDB `leaderboards`                |
| **Student Web** | Notifications                    | `notifications`                    |
| **Teacher Web** | Class overview, at-risk students | `classProgressSummaries`           |
| **Teacher Web** | Exam analytics                   | `examAnalytics`                    |
| **Admin Web**   | Tenant KPIs, AI costs            | `tenantAnalytics`, `costSummaries` |
| **Parent Web**  | Child progress                   | `studentProgressSummaries`         |

### 20.3 Infrastructure Dependencies

| Dependency                     | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| Google Cloud Secret Manager    | Per-tenant Gemini API key storage                    |
| Google Cloud Tasks             | Class summary 3-minute debounce queue                |
| Google Cloud Scheduler         | Nightly analytics, 6-hourly flush, hourly cleanup    |
| Firebase Cloud Messaging (FCM) | Push notifications                                   |
| SendGrid                       | Transactional email notifications                    |
| Firebase RTDB                  | Practice progress, leaderboards, rate limit counters |

---

## Appendix A: Firestore Composite Indexes

```
# spaceProgress
tenants/{tenantId}/spaceProgress: userId ASC, status ASC
tenants/{tenantId}/spaceProgress: spaceId ASC, status ASC
tenants/{tenantId}/spaceProgress: userId ASC, updatedAt DESC

# studentProgressSummaries
tenants/{tenantId}/studentProgressSummaries: classIds CONTAINS, updatedAt DESC
tenants/{tenantId}/studentProgressSummaries: insights.riskLevel ASC, updatedAt DESC

# llmCallLogs
tenants/{tenantId}/llmCallLogs: createdAt DESC
tenants/{tenantId}/llmCallLogs: task ASC, createdAt DESC
tenants/{tenantId}/llmCallLogs: relatedResourceType ASC, relatedResourceId ASC
tenants/{tenantId}/llmCallLogs: userId ASC, createdAt DESC
tenants/{tenantId}/llmCallLogs: success ASC, createdAt DESC

# notifications
tenants/{tenantId}/notifications: recipientUid ASC, read ASC, createdAt DESC
tenants/{tenantId}/notifications: recipientUid ASC, createdAt DESC
tenants/{tenantId}/notifications: type ASC, createdAt DESC

# costSummaries
tenants/{tenantId}/costSummaries/daily: date ASC
```

## Appendix B: RTDB Paths Summary

```
practiceProgress/{tenantId}/{userId}/{spaceId}/        # Practice session data
leaderboards/{tenantId}/{spaceId}/                     # Real-time leaderboards
rateLimits/{tenantId}/user/{userId}/{minuteBucket}     # Per-user rate counters
rateLimits/{tenantId}/tenant/{minuteBucket}            # Per-tenant rate counters
```

## Appendix C: Cost Model Reference

| Model                 | Input (per 1M tokens) | Output (per 1M tokens) | Typical Use             |
| --------------------- | --------------------- | ---------------------- | ----------------------- |
| gemini-2.5-flash      | $0.15                 | $0.60                  | Grading, OCR, mapping   |
| gemini-2.5-flash-lite | $0.075                | $0.30                  | Chat, evaluation        |
| gemini-2.5-pro        | $1.25                 | $10.00                 | Reserved for future use |

## Appendix D: Notification Templates

| Type              | Title Template            | Body Template                                                        |
| ----------------- | ------------------------- | -------------------------------------------------------------------- |
| `result_released` | "Exam Results Available"  | "Results for {examTitle} have been released. Check your dashboard."  |
| `space_published` | "New Learning Space"      | "{spaceName} is now available for you."                              |
| `at_risk_alert`   | "Student Needs Attention" | "{studentName} in {className} shows declining performance."          |
| `budget_warning`  | "AI Budget Warning (80%)" | "Your organization has used 80% of the monthly AI budget."           |
| `budget_critical` | "AI Budget Exceeded"      | "Monthly AI budget exceeded. AI features are paused."                |
| `recommendation`  | "Study Recommendation"    | "Based on your exam results, try practicing {topic} in {spaceName}." |

---

**Document Version:** 1.0 **Date:** 2026-02-19 **Status:** Design Plan — Ready
for Implementation
