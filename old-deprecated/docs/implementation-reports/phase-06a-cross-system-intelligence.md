# Phase 6A: Cross-System Intelligence — Progress Aggregation Cloud Functions

## Implementation Report

---

## 1. Files Created / Modified

### New Files (18 files)

#### Shared Types (`packages/shared-types/src/progress/`)

| File                    | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `progress/summary.ts`   | StudentProgressSummary, ClassProgressSummary interfaces     |
| `progress/analytics.ts` | DailyCostSummary, AtRiskDetectionResult, Notification types |
| `progress/insight.ts`   | LearningInsight types (added by coordinator post-review)    |
| `progress/index.ts`     | Barrel exports for all progress types                       |

#### Notification Types (`packages/shared-types/src/notification/`)

| File                   | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `notification/` module | Notification entity types (added by coordinator post-review) |

#### Analytics Functions (`functions/analytics/`)

| File                                           | Purpose                                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `package.json`                                 | Package config — depends on `@levelup/shared-types`, `firebase-admin`, `firebase-functions`, `pdfkit` |
| `tsconfig.json`                                | TypeScript config matching existing function packages (ES2022, commonjs)                              |
| `src/index.ts`                                 | Barrel exports for all cloud functions                                                                |
| `src/callable/get-student-summary.ts`          | Callable: retrieve student progress summary                                                           |
| `src/callable/get-class-summary.ts`            | Callable: retrieve class progress summary                                                             |
| `src/callable/generate-exam-result-pdf.ts`     | Callable: PDF generation for exam results (added by coordinator)                                      |
| `src/callable/generate-progress-report-pdf.ts` | Callable: PDF generation for progress reports (added by coordinator)                                  |
| `src/callable/generate-class-report-pdf.ts`    | Callable: PDF generation for class reports (added by coordinator)                                     |
| `src/triggers/on-submission-graded.ts`         | Trigger: recalculate autograde metrics on graded submission                                           |
| `src/triggers/on-space-progress-updated.ts`    | Trigger: recalculate levelup metrics on space progress change                                         |
| `src/triggers/on-student-summary-updated.ts`   | Trigger: recalculate class summary (5-min debounce)                                                   |
| `src/triggers/on-exam-results-released.ts`     | Trigger: compute ExamAnalytics on results release                                                     |
| `src/schedulers/nightly-at-risk-detection.ts`  | Scheduler: 2:00 AM daily at-risk scan with notifications                                              |
| `src/schedulers/daily-cost-aggregation.ts`     | Scheduler: 00:05 UTC daily LLM cost aggregation                                                       |
| `src/schedulers/generate-insights.ts`          | Scheduler: insight generation (added by coordinator)                                                  |
| `src/utils/aggregation-helpers.ts`             | Utility: weighted scoring, median, stddev, strength/weakness detection                                |
| `src/utils/at-risk-rules.ts`                   | Utility: rule-based at-risk detection engine                                                          |
| `src/utils/notification-sender.ts`             | Utility: notification dispatch (added by coordinator)                                                 |

### Modified Files (2 files)

| File                                   | Change                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `packages/shared-types/src/index.ts`   | Added `export * from './progress'` and `export * from './notification'` |
| `packages/shared-types/tsup.config.ts` | Added `'src/progress/index.ts'` to entry array                          |

### No Changes Needed

| File                  | Reason                                                          |
| --------------------- | --------------------------------------------------------------- |
| `pnpm-workspace.yaml` | Already includes `functions/*` glob — analytics auto-discovered |
| `turbo.json`          | Generic task config applies to all packages automatically       |

---

## 2. Key Types & Interfaces

### StudentProgressSummary

- **Collection**: `/tenants/{tenantId}/studentProgressSummaries/{studentId}`
- **AutoGrade section** (`StudentAutogradeMetrics`): totalExams, completedExams,
  averageScore (0-1), averagePercentage (0-100), totalMarksObtained/Available,
  subjectBreakdown, recentExams (top 10)
- **LevelUp section** (`StudentLevelupMetrics`): totalSpaces, completedSpaces,
  averageCompletion (0-100%), totalPointsEarned/Available, averageAccuracy
  (0-1), streakDays, subjectBreakdown, recentActivity (top 10)
- **Cross-system**: overallScore (weighted 60% autograde + 40% levelup),
  strengthAreas, weaknessAreas, isAtRisk, atRiskReasons

### ClassProgressSummary

- **Collection**: `/tenants/{tenantId}/classProgressSummaries/{classId}`
- **AutoGrade**: averageClassScore, examCompletionRate, topPerformers (top 5),
  bottomPerformers (bottom 5)
- **LevelUp**: averageClassCompletion, activeStudentRate, topPointEarners
  (top 5)
- **At-risk**: atRiskStudentIds, atRiskCount

### DailyCostSummary

- **Collection**: `/tenants/{tenantId}/costSummaries/daily/{YYYY-MM-DD}`
- Aggregates: totalCalls, totalInputTokens, totalOutputTokens, totalCostUsd
- Breakdowns: byPurpose, byModel
- Budget tracking: budgetLimitUsd, budgetUsedPercent, budgetAlertSent

### Supporting Types

- `AutogradeSubjectBreakdown`, `LevelupSubjectBreakdown` — per-subject
  aggregations
- `RecentExamEntry`, `RecentActivityEntry` — recent activity items
- `AtRiskReason` — union type:
  `'low_exam_score' | 'no_recent_activity' | 'low_space_completion' | 'declining_performance' | 'zero_streak'`
- `AtRiskDetectionResult` — per-student detection output

---

## 3. Cloud Functions

### Callable Functions (5)

| Function                    | Region      | Memory | Purpose                                                                                                       |
| --------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `getStudentSummary`         | asia-south1 | 256MiB | Returns pre-computed StudentProgressSummary with role-based access (students own-only, teachers/admins any)   |
| `getClassSummary`           | asia-south1 | 256MiB | Returns pre-computed ClassProgressSummary with role-based access (teachers assigned classes only, admins any) |
| `generateExamResultPdf`     | asia-south1 | 256MiB | PDF generation for individual exam results                                                                    |
| `generateProgressReportPdf` | asia-south1 | 256MiB | PDF generation for student progress reports                                                                   |
| `generateClassReportPdf`    | asia-south1 | 256MiB | PDF generation for class-level reports                                                                        |

### Firestore Triggers (4)

| Function                  | Document Path                                             | Condition                                                                    | Action                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onSubmissionGraded`      | `tenants/{tenantId}/submissions/{submissionId}`           | pipelineStatus transitions to `graded`/`grading_complete`/`results_released` | Fetches all student's graded submissions, recalculates autograde metrics, writes to studentProgressSummaries using Firestore transaction                                         |
| `onSpaceProgressUpdated`  | `tenants/{tenantId}/spaceProgress/{progressId}`           | Any write (create/update)                                                    | Fetches all student's space progress, recalculates levelup metrics, writes to studentProgressSummaries using Firestore transaction                                               |
| `onStudentSummaryUpdated` | `tenants/{tenantId}/studentProgressSummaries/{studentId}` | Any write                                                                    | Looks up student's classes, recalculates ClassProgressSummary per class (5-min debounce with `pendingRecalculation` flag)                                                        |
| `onExamResultsReleased`   | `tenants/{tenantId}/exams/{examId}`                       | status transitions to `results_released`                                     | Fetches all submissions + question submissions (parallel batches of 10), computes ExamAnalytics with score distribution, question analytics, class breakdown, grade distribution |

### Scheduled Functions (3)

| Function                 | Schedule                | Timeout | Purpose                                                                                                                                                                                                             |
| ------------------------ | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nightlyAtRiskDetection` | `0 2 * * *` (2 AM UTC)  | 540s    | Paginates all StudentProgressSummary docs (500/page), applies rule engine, batch-updates changed docs (450-op batch limit), sends notifications to teachers/parents for newly at-risk students                      |
| `dailyCostAggregation`   | `5 0 * * *` (00:05 UTC) | 300s    | Queries llmCallLogs for previous day, aggregates by purpose and model, writes daily summary, updates monthly running total using idempotent delta increments, checks budget thresholds (80% warning, 100% exceeded) |
| `generateInsights`       | Scheduled               | —       | Learning insight generation                                                                                                                                                                                         |

---

## 4. Package Structure

```
functions/analytics/
├── package.json                          # @levelup/functions-analytics
├── tsconfig.json                         # ES2022, commonjs, lib → ./lib
├── src/
│   ├── index.ts                          # Barrel: 5 callables, 4 triggers, 3 schedulers
│   ├── callable/
│   │   ├── get-student-summary.ts        # Auth + role-based access
│   │   ├── get-class-summary.ts          # Auth + teacher/admin access
│   │   ├── generate-exam-result-pdf.ts   # PDF generation
│   │   ├── generate-progress-report-pdf.ts
│   │   └── generate-class-report-pdf.ts
│   ├── triggers/
│   │   ├── on-submission-graded.ts       # Submission → StudentProgressSummary.autograde
│   │   ├── on-space-progress-updated.ts  # SpaceProgress → StudentProgressSummary.levelup
│   │   ├── on-student-summary-updated.ts # StudentSummary → ClassProgressSummary (debounced)
│   │   └── on-exam-results-released.ts   # Exam → ExamAnalytics
│   ├── schedulers/
│   │   ├── nightly-at-risk-detection.ts  # Cron: at-risk scan + notifications
│   │   ├── daily-cost-aggregation.ts     # Cron: LLM cost rollup + budget alerts
│   │   └── generate-insights.ts          # Cron: insight generation
│   └── utils/
│       ├── aggregation-helpers.ts        # Math: weighted score, median, stddev, topN, bottomN
│       ├── at-risk-rules.ts              # Rule engine: 4 rules, no LLM
│       └── notification-sender.ts        # Notification dispatch utility

packages/shared-types/src/progress/
├── index.ts                              # Barrel exports
├── summary.ts                            # StudentProgressSummary, ClassProgressSummary
├── analytics.ts                          # DailyCostSummary, AtRiskDetectionResult
└── insight.ts                            # LearningInsight types
```

---

## 5. Design Decisions

### Transactions for Concurrent Safety

- `on-submission-graded` and `on-space-progress-updated` use **Firestore
  transactions** for the read-modify-write of StudentProgressSummary. This
  prevents race conditions when both triggers fire concurrently for the same
  student (e.g., exam graded while space progress updates simultaneously).

### Debounce with Pending Flag

- `on-student-summary-updated` uses a **5-minute debounce** to prevent write
  contention on ClassProgressSummary. When debounced, it sets
  `pendingRecalculation: true` so a future invocation knows to recalculate.

### Parallel Question Submission Fetching

- `on-exam-results-released` pre-fetches question submissions in **parallel
  batches of 10** instead of sequential N+1 queries, significantly improving
  performance for exams with many submissions.

### Batch Write Limits

- `nightly-at-risk-detection` respects Firestore's **500-operation batch limit**
  by committing at 450 operations and starting a new batch.

### Idempotent Cost Aggregation

- `daily-cost-aggregation` uses **delta-based monthly increments** (new -
  previous daily value) so re-runs of the scheduler for the same day don't
  double-count costs.

### Weighted Overall Score

- Cross-system `overallScore` uses **60% AutoGrade + 40% LevelUp** weighting
  with input clamping to prevent out-of-range values.

### At-Risk Rule Engine

- Four rules, all **rule-based (no LLM)**:
  1. Average exam score < 0.4
  2. Zero streak with no activity in 7+ days (checks actual timestamp, not just
     streakDays==0 to avoid false positives when streak tracking isn't yet
     computed)
  3. Average space completion < 25%
  4. Declining performance across last 3+ exams (monotonic downward trend)

### Role-Based Access Control

- `getStudentSummary`: Students can only access their own summary; teachers and
  admins can access any student
- `getClassSummary`: Students denied; teachers restricted to assigned classes;
  admins unrestricted

### Notification Integration

- Nightly at-risk detection resolves teacher UIDs (via class → teacher mapping)
  and parent UIDs for newly flagged students, then dispatches notifications via
  the notification sender utility.

### Reuse of Existing ExamAnalytics Type

- The ExamAnalytics type from
  `packages/shared-types/src/autograde/exam-analytics.ts` is reused directly —
  no duplicate type was created in the progress module.

---

## 6. Build Verification

All **10 turbo build tasks** pass successfully from root `pnpm run build`:

- `@levelup/shared-types` (tsup) ✅
- `@levelup/shared-services` ✅
- `@levelup/functions-analytics` (tsc) ✅
- `@levelup/functions-autograde` ✅
- `@levelup/functions-levelup` ✅
- `@levelup/functions-identity` ✅
- `@levelup/teacher-web` ✅
- `@levelup/student-web` ✅
- `@levelup/shared-ui` ✅
- `@levelup/scripts` ✅
