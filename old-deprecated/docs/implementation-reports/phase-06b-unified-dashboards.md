# Phase 6B: Cross-System Intelligence - Unified Dashboards & Analytics UI

## Implementation Report

**Completed by:** Frontend Apps Engineer **Date:** 2026-02-24 **Task ID:**
task_1771884314508_ihxfct5t6

---

## 1. Files Created

### Shared Chart Components (`packages/shared-ui/src/components/charts/`)

| File                 | Description                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `ScoreCard.tsx`      | Card with large number, label, optional icon, and trend indicator (up/down/neutral)                   |
| `ProgressRing.tsx`   | SVG circular progress indicator with percentage display, auto-colored by value threshold              |
| `AtRiskBadge.tsx`    | Red "At Risk" / green "On Track" badge with tooltip for reasons                                       |
| `SimpleBarChart.tsx` | Lightweight CSS-based bar chart (no recharts dependency), supports custom colors and value formatting |
| `index.ts`           | Barrel export for all chart components                                                                |

### TanStack Query Hooks (`packages/shared-hooks/src/queries/`)

| File                   | Hooks Exported                                                                                  | Firestore Path                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `useStudentSummary.ts` | `useStudentProgressSummary(tenantId, studentId)`, `useStudentSummaries(tenantId, studentIds[])` | `/tenants/{tenantId}/studentProgressSummaries/{studentId}` |
| `useClassSummary.ts`   | `useClassProgressSummary(tenantId, classId)`, `useClassSummaries(tenantId, classIds[])`         | `/tenants/{tenantId}/classProgressSummaries/{classId}`     |
| `useExamAnalytics.ts`  | `useExamAnalytics(tenantId, examId)`                                                            | `/tenants/{tenantId}/examAnalytics/{examId}`               |
| `useCostSummary.ts`    | `useDailyCostSummaries(tenantId, dateRange)`, `useMonthlyCostSummary(tenantId, month)`          | `/tenants/{tenantId}/dailyCostSummaries`                   |

### New App Pages

| File                                                | Description                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `apps/teacher-web/src/pages/ClassAnalyticsPage.tsx` | Class selector, AutoGrade section (avg score, top/bottom performers), LevelUp section (completion, active rate, top earners) |
| `apps/teacher-web/src/pages/ExamAnalyticsPage.tsx`  | Exam selector, grade distribution chart, per-question analysis table, topic performance chart                                |
| `apps/admin-web/src/pages/AIUsagePage.tsx`          | Monthly cost overview, daily cost trend chart, cost-by-purpose breakdown, daily breakdown table with month navigation        |

---

## 2. Files Modified

### Package Infrastructure

| File                                                     | Change                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/shared-hooks/src/queries/index.ts`             | Added exports for 4 new query hook modules                                                              |
| `packages/shared-ui/src/index.ts`                        | Added `export * from './components/charts'`                                                             |
| `packages/shared-ui/package.json`                        | Added `@levelup/shared-utils: workspace:*` dependency (fix for BulkImportDialog import)                 |
| `packages/shared-ui/src/components/BulkImportDialog.tsx` | Fixed import path: `@levelup/shared-utils/src/csv` → `@levelup/shared-utils/csv` (pre-existing bug fix) |

### Teacher Web

| File                                           | Change                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/teacher-web/src/pages/DashboardPage.tsx` | **Enhanced:** Added ScoreCard grid (Students, Exams, Spaces, At-Risk), class performance bar chart from ClassProgressSummary, at-risk student alerts section |
| `apps/teacher-web/src/App.tsx`                 | Added lazy imports + routes for `/analytics/classes` and `/analytics/exams`                                                                                  |
| `apps/teacher-web/src/layouts/AppLayout.tsx`   | Added "Analytics" nav group with Class Analytics and Exam Analytics items                                                                                    |

### Student Web

| File                                           | Change                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/student-web/src/pages/DashboardPage.tsx` | **Enhanced:** Added cross-system summary from StudentProgressSummary (overall score, avg exam score, space completion, streak), strengths/weaknesses tags, quick stats card, recent exam results list. Falls back to basic stats when no summary exists. |
| `apps/student-web/src/pages/ProgressPage.tsx`  | **Enhanced:** Added tabbed view (Overall / Exams / Spaces). Overall tab shows subject breakdown with ProgressRing per subject. Exams tab shows exam history table. Spaces tab retains original space progress cards.                                     |

### Parent Web

| File                                          | Change                                                                                                                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/parent-web/src/pages/DashboardPage.tsx` | **Enhanced:** Added overview ScoreCards (children count, school, at-risk alerts). Each child card now shows ProgressRing with overall score, exam avg, space completion, streak, at-risk badge, and latest 2 exam results. Uses `useStudentSummaries()` batch hook. |

### Admin Web

| File                                         | Change                                                                                                                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin-web/src/pages/DashboardPage.tsx` | **Enhanced:** Added 6-column ScoreCard grid (students, teachers, classes, spaces, exams, at-risk). Added class performance bar chart. Added AI cost summary card (today's spend + calls). Retained tenant info and features sections. |
| `apps/admin-web/src/App.tsx`                 | Added import + route for `/ai-usage` → AIUsagePage                                                                                                                                                                                    |
| `apps/admin-web/src/layouts/AppLayout.tsx`   | Added "Analytics" nav group with AI Usage item (DollarSign icon)                                                                                                                                                                      |

---

## 3. Query Hooks Detail

### useStudentProgressSummary

- **Signature:**
  `(tenantId: string | null, studentId: string | null) → UseQueryResult<StudentProgressSummary | null>`
- **Stale time:** 30s
- **Used in:** student-web DashboardPage, student-web ProgressPage

### useStudentSummaries (batch)

- **Signature:**
  `(tenantId: string | null, studentIds: string[]) → UseQueryResult[]`
- **Implementation:** `useQueries()` — fires parallel doc reads
- **Stale time:** 30s
- **Used in:** parent-web DashboardPage

### useClassProgressSummary

- **Signature:**
  `(tenantId: string | null, classId: string | null) → UseQueryResult<ClassProgressSummary | null>`
- **Stale time:** 5 min
- **Used in:** teacher-web ClassAnalyticsPage

### useClassSummaries (batch)

- **Signature:**
  `(tenantId: string | null, classIds: string[]) → UseQueryResult[]`
- **Implementation:** `useQueries()` — fires parallel doc reads
- **Stale time:** 5 min
- **Used in:** teacher-web DashboardPage, admin-web DashboardPage

### useExamAnalytics

- **Signature:**
  `(tenantId: string | null, examId: string | null) → UseQueryResult<ExamAnalytics | null>`
- **Stale time:** 5 min
- **Used in:** teacher-web ExamAnalyticsPage

### useDailyCostSummaries

- **Signature:**
  `(tenantId: string | null, dateRange?: { start, end }) → UseQueryResult<DailyCostSummary[]>`
- **Stale time:** 5 min
- **Used in:** admin-web DashboardPage, admin-web AIUsagePage

### useMonthlyCostSummary

- **Signature:**
  `(tenantId: string | null, month: string | null) → { data: { totalCost, totalCalls, totalInputTokens, totalOutputTokens, days[] } | null }`
- **Implementation:** Wraps `useDailyCostSummaries` with date range derived from
  YYYY-MM, aggregates totals client-side

---

## 4. Chart Components Detail

### ScoreCard

- Props: `label, value, suffix?, trend?, trendValue?, icon?, className?`
- Trend shows colored arrow (green up / red down / gray neutral)
- Used for overview stat cards across all dashboards

### ProgressRing

- Props: `value (0-100), size?, strokeWidth?, className?, label?, color?`
- SVG-based, auto-colors: green ≥70, yellow ≥40, red <40
- Used in ClassAnalyticsPage, parent-web child cards, student-web subject
  breakdown

### AtRiskBadge

- Props: `isAtRisk, reasons?, className?`
- Shows "At Risk" (red with AlertTriangle icon) or "On Track" (green)
- Tooltip shows reasons array
- Used in teacher/student/parent dashboards

### SimpleBarChart

- Props:
  `data: BarChartItem[], maxValue?, height?, className?, showValues?, valueFormatter?`
- Pure CSS implementation — no recharts dependency needed
- Each bar is a flex column with proportional height
- Used for class performance, grade distribution, cost trends

---

## 5. Design Decisions

### CSS-based SimpleBarChart vs Recharts

Chose a lightweight CSS bar chart for simple visualizations to avoid pulling
recharts into every render path. The existing shadcn `chart.tsx` (which wraps
recharts) remains available for complex interactive charts but is not used in
the new pages. This keeps bundle impact minimal.

### Batch Fetching with useQueries

Used TanStack Query's `useQueries()` for batch-fetching student and class
summaries. Each document gets its own cache entry with individual stale times,
enabling efficient incremental refetching. Alternative (collection query with
`where('id', 'in', ids)`) was rejected because Firestore `in` queries are
limited to 30 values.

### Graceful Degradation

All enhanced dashboards check for null summary data and fall back to basic stats
(the original UI). This ensures dashboards work before Phase 6A cloud functions
have run and populated the summary documents.

### No Recharts in New Components

The new chart components (SimpleBarChart, ProgressRing) are pure CSS/SVG. This
was a deliberate choice to keep the shared-ui package lightweight. The shadcn
chart.tsx wrapper around recharts is available for any future pages needing
interactive charts with tooltips/legends.

### Stale Time Strategy

- **Student summaries:** 30s (changes frequently as students interact)
- **Class summaries:** 5 min (aggregated, less volatile)
- **Exam analytics:** 5 min (changes only when new submissions are graded)
- **Cost summaries:** 5 min (updated by daily aggregation function)

### No Cross-App File Conflicts

Followed the directive to avoid editing
`apps/admin-web/src/pages/ClassesPage.tsx` and `UsersPage.tsx` (owned by another
session). All admin-web changes are confined to DashboardPage, new AIUsagePage,
App.tsx router, and AppLayout sidebar.

---

## 6. Build Verification

All 4 apps build successfully:

```
@levelup/teacher-web    ✓ built in 8.86s  (1710 modules)
@levelup/student-web    ✓ built in 8.02s  (1745 modules)
@levelup/parent-web     ✓ built in 7.91s  (1715 modules)
@levelup/admin-web      ✓ built in 9.72s  (1705 modules)
```

### Pre-existing Issues Fixed

- `BulkImportDialog.tsx`: Fixed import `@levelup/shared-utils/src/csv` →
  `@levelup/shared-utils/csv`
- `shared-ui/package.json`: Added missing `@levelup/shared-utils: workspace:*`
  dependency

### Pre-existing Issues NOT Fixed (out of scope)

- `functions/autograde`: Build fails on missing `notification-sender` module
  (notification system WIP by another session)
