# V9: Student, Parent & Teacher Experience — Implementation Plan

## Current State Assessment

### Student Portal (20 pages)

- **Dashboard**: Score cards (Overall, Exam, Space Completion, Streak),
  recommendations, recent results
- **Progress**: Tabbed view (Overall/Exams/Spaces) with subject breakdowns
- **Leaderboard**: Space-filtered rankings with total points
- **Spaces/Tests**: Full learning flow with resume, timed tests, practice mode,
  analytics
- **Notifications**: Basic inbox with read/unread filtering
- **Chat Tutor**: AI tutoring interface

### Parent Portal (8 pages)

- **Dashboard**: Children overview cards with progress rings, at-risk indicators
- **Child Progress**: Detailed analytics with strengths/weaknesses,
  recommendations
- **Notifications**: Basic notification inbox
- **Settings**: Notification preferences

### Teacher Portal (14 pages)

- **Dashboard**: Stats, class performance chart, at-risk students, grading queue
- **Exams**: Full lifecycle (create → publish → submissions → AI grading →
  review → release)
- **Classes**: Detail view with analytics tab
- **Analytics**: Class, exam, space analytics pages

## Gap Analysis & Target State

### Phase A: Achievement System (shared-types + shared-ui + student-web)

1. Add achievement types to `shared-types`
2. Add `AchievementBadge`, `AchievementCard`, `LevelBadge`, `StreakWidget`,
   `MilestoneCard` to `shared-ui`
3. Add `useAchievements` hook to `shared-hooks`
4. Create `AchievementsPage` in student-web
5. Add achievements widget to student Dashboard

### Phase B: Study Planner (student-web)

1. Create `StudyPlannerPage` with weekly goals and schedule
2. Add study planner nav link to AppLayout
3. Add quick-access widget on Dashboard

### Phase C: Parent Portal Enhancements

1. Add multi-child comparison view to Dashboard
2. Create `PerformanceAlertsPage` for dedicated test/performance alerts
3. Add alert notification types and navigation

### Phase D: Teacher Portal Enhancements

1. Create `AssignmentTrackerPage` for cross-class assignment tracking
2. Create `StudentReportPage` for individual student progress reports
3. Enhance Dashboard with batch grading queue count and content shortcuts

### Phase E: Shared Navigation & Integration

1. Update all AppLayouts with new nav items
2. Wire new pages into routers
3. Ensure consistent patterns across all 3 portals

## Task List

| #   | Task                           | Files                                   | Size |
| --- | ------------------------------ | --------------------------------------- | ---- |
| 1   | Achievement types              | shared-types/src/gamification/          | S    |
| 2   | Achievement UI components      | shared-ui/src/components/gamification/  | M    |
| 3   | Achievement hook               | shared-hooks/src/queries/               | S    |
| 4   | AchievementsPage               | student-web/src/pages/                  | M    |
| 5   | Student Dashboard achievements | student-web/src/pages/DashboardPage.tsx | S    |
| 6   | StudyPlannerPage               | student-web/src/pages/                  | M    |
| 7   | Student nav + routes           | student-web/src/App.tsx, AppLayout.tsx  | S    |
| 8   | PerformanceAlertsPage          | parent-web/src/pages/                   | M    |
| 9   | Parent Dashboard comparison    | parent-web/src/pages/DashboardPage.tsx  | S    |
| 10  | Parent nav + routes            | parent-web/src/App.tsx, AppLayout.tsx   | S    |
| 11  | AssignmentTrackerPage          | teacher-web/src/pages/                  | M    |
| 12  | StudentReportPage              | teacher-web/src/pages/                  | M    |
| 13  | Teacher nav + routes           | teacher-web/src/App.tsx, AppLayout.tsx  | S    |
| 14  | Build verification             | All packages                            | S    |
| 15  | Test report                    | docs/evolution/v9-user-experience/      | S    |
