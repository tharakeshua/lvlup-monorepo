# V9: Student, Parent & Teacher Experience — Cycle 4 Plan

**Cycle:** 4 **Vertical:** V9 (User Experience) **Engineer:** Design Systems
Engineer **Date:** 2026-03-08 **Status:** PLANNED

---

## Current State Summary

### Completed (Cycles 1–3)

**Cycle 1 — Core Features:**

- Achievement system (types, UI components, hooks, AchievementsPage)
- Study planner (goals, tracking, StudyPlannerPage)
- Parent performance alerts (PerformanceAlertsPage)
- Teacher assignment tracker + student report pages
- Gamification shared components (LevelBadge, StreakWidget,
  AchievementBadge/Card, MilestoneCard, StudyGoalCard)

**Cycle 2 — Refinement:**

- FadeIn/AnimatedList motion integration across all V9 pages
- EmptyState adoption (7 inline patterns replaced)
- ARIA accessibility pass (aria-hidden on decorative icons)

**Cycle 3 — Feature Completion:**

- Dashboard enhancements: Resume Learning, StreakWidget, ClassHeatmap, stagger
  cascades
- PageTransition integration in all 6 app layouts
- CelebrationBurst animations (confetti/stars/sparkle) on achievements
- CountUp on dashboard Quick Stats
- Loading state accessibility (role="status", aria-label)
- Parent "View details" per-child links, ARIA improvements
- Teacher EmptyState presets with action buttons

### Current Page Counts

- **Student Web:** 21 pages, 30+ components
- **Parent Web:** 8 pages, 11 hooks
- **Teacher Web:** 18+ pages, 9 components
- **Shared UI:** 60+ components, 7 motion components
- **Shared Hooks:** 30+ query hooks

---

## Cycle 4 Gap Analysis

Based on the C3 "Remaining Work" list and fresh audit of all three portals:

### Student Web Gaps

| Gap                                | Severity | Notes                                                          |
| ---------------------------------- | -------- | -------------------------------------------------------------- |
| No SettingsPage                    | High     | Parent & teacher have settings; student has none               |
| No notification preferences        | Medium   | Parent has toggle-based prefs; student missing                 |
| Leaderboard lacks animation polish | Low      | Static table, no entrance animations or rank-change highlights |
| Study planner has no calendar view | Medium   | Only list-based goals, no visual weekly calendar               |
| No profile page                    | Medium   | No way for student to view/edit display name or avatar         |

### Parent Web Gaps

| Gap                                       | Severity | Notes                                          |
| ----------------------------------------- | -------- | ---------------------------------------------- |
| No multi-child comparison view            | High     | Cannot compare children side-by-side           |
| No performance trend charts               | High     | Only snapshot data, no time-series progression |
| No PDF report download for child progress | Medium   | Teacher has DownloadPDFButton; parent doesn't  |
| Alert severity levels not configurable    | Low      | Alerts are derived with fixed thresholds       |

### Teacher Web Gaps

| Gap                                  | Severity | Notes                                                         |
| ------------------------------------ | -------- | ------------------------------------------------------------- |
| No batch grading queue page          | High     | Dashboard shows grading queue but no dedicated batch workflow |
| StudentReportPage lacks PDF export   | Medium   | Page exists but has no download/export option                 |
| No drag-and-drop assignment ordering | Low      | Assignments listed but not reorderable                        |

### Cross-App Gaps

| Gap                                 | Severity | Notes                                                    |
| ----------------------------------- | -------- | -------------------------------------------------------- |
| No offline handling patterns        | Medium   | No consistent offline detection or cached-data fallbacks |
| No inline error recovery            | Medium   | Errors use ErrorBoundary but no retry-in-place patterns  |
| Dark mode consistency audit         | Low      | ThemeToggle exists but component dark variants untested  |
| Focus management on page navigation | Low      | RouteAnnouncer exists; focus ring consistency varies     |

---

## Implementation Plan

### Phase A: Student Settings & Profile (Size M)

**A1. StudentSettingsPage** — `apps/student-web/src/pages/SettingsPage.tsx`

- Profile section: display name (read-only), email (read-only), school info
- Notification preferences: toggles for exam results, achievement alerts,
  leaderboard updates, streak reminders
- Appearance: theme toggle (mirrors header but accessible from settings)
- Account: sign out button
- Reuse `useNotificationPreferences` / `useSaveNotificationPreferences` from
  shared-hooks (same pattern as parent)
- Route: `/settings`, lazy-loaded

**A2. StudentProfilePage** — `apps/student-web/src/pages/ProfilePage.tsx`

- Avatar display (initials-based, matching parent card pattern)
- Level badge + XP progress bar (reuse LevelBadge)
- Current streak (reuse StreakWidget)
- Total achievements earned count
- Total points
- School enrollment info
- Route: `/profile`, lazy-loaded

**A3. Student nav update** — `apps/student-web/src/layouts/AppLayout.tsx`

- Add "Settings" to Account nav group (Settings icon)
- Add "Profile" link or make avatar clickable → `/profile`
- Update `apps/student-web/src/App.tsx` with new routes

**Files:** 2 new pages, 2 modified files **Dependencies:** shared-hooks
(existing `useNotificationPreferences`), shared-ui (existing components)

---

### Phase B: Parent Multi-Child Comparison & Trends (Size L)

**B1. ChildComparisonPage** —
`apps/parent-web/src/pages/ChildComparisonPage.tsx`

- Side-by-side comparison cards for 2–4 children
- Metrics compared: overall score, exam average, space completion, streak,
  points
- ProgressRing per child per metric for visual comparison
- SimpleBarChart showing children's scores across subjects
- Highlight best/weakest performer per metric
- Route: `/compare`, lazy-loaded

**B2. PerformanceTrendsSection** —
`apps/parent-web/src/components/PerformanceTrendsChart.tsx`

- Recharts line chart component showing score progression over time
- Time range selector: last 7 days, 30 days, 90 days, all time
- Data source: derive from exam submissions (sorted by date) + space progress
  snapshots
- Embed in ChildProgressPage as new tab or section
- Uses shared-ui Chart (Recharts wrapper)

**B3. usePerformanceTrends hook** —
`packages/shared-hooks/src/queries/usePerformanceTrends.ts`

- `usePerformanceTrends(tenantId, studentId, range)` — aggregates exam scores
  over time
- Returns `{ data: { date, score, subject }[], loading, error }`
- Query cache: 5 minutes

**B4. Parent PDF report** — `apps/parent-web/src/pages/ChildProgressPage.tsx`

- Add `DownloadPDFButton` from shared-ui to ChildProgressPage header
- Calls `callGenerateReport` with student progress data
- Same pattern as teacher ExamDetailPage

**B5. Parent nav update** — `apps/parent-web/src/layouts/AppLayout.tsx`

- Add "Compare Children" nav item (BarChart3 icon) in My Children group
- Only visible when parent has 2+ linked children

**Files:** 1 new page, 1 new component, 1 new hook, 2 modified files
**Dependencies:** shared-ui (ProgressRing, Chart, SimpleBarChart,
DownloadPDFButton), shared-services (callGenerateReport)

---

### Phase C: Teacher Batch Grading & Report Export (Size M)

**C1. BatchGradingPage** — `apps/teacher-web/src/pages/BatchGradingPage.tsx`

- Dedicated batch grading workflow pulling from all pending submissions
- Filter by exam, class, status (Needs Review, Auto-Graded, Flagged)
- Sortable by: date submitted, score, confidence level
- Quick-action buttons: Approve AI Grade, Override Score, Flag for Review
- Keyboard navigation: Enter to approve, Tab to next, Shift+Tab to previous
- Pagination with "X of Y reviewed" progress indicator
- Route: `/grading`, lazy-loaded

**C2. StudentReportPage PDF export** —
`apps/teacher-web/src/pages/StudentReportPage.tsx`

- Add `DownloadPDFButton` to page header alongside student name
- Calls `callGenerateReport` with
  `{ type: 'student-report', studentId, tenantId }`
- Small modification to existing page

**C3. Teacher nav update** — `apps/teacher-web/src/layouts/AppLayout.tsx`

- Add "Batch Grading" nav item (CheckSquare icon) in Content group
- Update `apps/teacher-web/src/App.tsx` with new route

**Files:** 1 new page, 2 modified files **Dependencies:** shared-ui (existing
components), shared-hooks (useSubmissions), shared-services (callGenerateReport)

---

### Phase D: Cross-App Resilience Patterns (Size M)

**D1. useOnlineStatus hook** — `packages/shared-hooks/src/ui/useOnlineStatus.ts`

- Monitors `navigator.onLine` + periodic fetch-based health check
- Returns `{ isOnline, lastOnlineAt }`
- Fires callback on status change
- Export from shared-hooks

**D2. OfflineBanner component** —
`packages/shared-ui/src/components/layout/OfflineBanner.tsx`

- Slim banner at top of viewport: "You're offline. Some data may be outdated."
- Uses `useOnlineStatus`
- FadeIn/FadeOut animation
- Dismissible but re-shows on page navigation if still offline
- Export from shared-ui

**D3. RetryErrorCard component** —
`packages/shared-ui/src/components/feedback/RetryErrorCard.tsx`

- Inline error recovery card replacing generic error boundaries for
  section-level failures
- Props: `error`, `onRetry`, `title?`, `compact?`
- Shows error message + "Try Again" button
- Optional "Report Issue" link
- Animated entrance with FadeIn
- Export from shared-ui

**D4. Integration** — All 3 app layouts

- Add `<OfflineBanner />` to AppLayout in student-web, parent-web, teacher-web
- Replace section-level error boundaries with `<RetryErrorCard>` in dashboard
  sections (each app's DashboardPage)

**Files:** 1 new hook, 2 new components, 6 modified files (3 layouts + 3
dashboards) **Dependencies:** shared-ui (FadeIn), shared-hooks (new hook)

---

### Phase E: Leaderboard & Animation Polish (Size S)

**E1. LeaderboardPage animation** —
`apps/student-web/src/pages/LeaderboardPage.tsx`

- Wrap leaderboard table rows in AnimatedList for staggered entrance
- Add rank-change indicator (▲▼) with CountUp animation on point values
- Highlight current user's row with primary-tinted background + Pressable hover
- FadeIn on header + filter controls

**E2. StudyPlannerPage calendar widget** —
`apps/student-web/src/pages/StudyPlannerPage.tsx`

- Add weekly calendar strip above goals list showing goal deadlines
- Use shared-ui Calendar component (already exists) in compact single-week mode
- Goals due dates rendered as dots on calendar days
- Click day to filter goals due that day

**Files:** 2 modified pages **Dependencies:** shared-ui (AnimatedList, CountUp,
FadeIn, Pressable, Calendar)

---

### Phase F: Accessibility & Dark Mode Audit (Size S)

**F1. Focus ring consistency** — `packages/shared-ui/src/index.css` or Tailwind
config

- Audit focus-visible ring styles across all interactive components
- Ensure 3:1 contrast ratio for focus indicators (WCAG 2.2 AA)
- Standardize ring width (2px), offset (2px), color (primary)

**F2. Dark mode component audit** — All shared-ui components

- Test all gamification components (AchievementBadge, LevelBadge, StreakWidget)
  in dark mode
- Fix any hardcoded color values not using CSS variable tokens
- Ensure tier gradients (bronze through diamond) render correctly in dark theme
- Verify chart colors have sufficient contrast in dark mode

**F3. Keyboard navigation** — All new pages created in Phases A–C

- Ensure all interactive elements are tab-reachable
- Add `aria-label` to icon-only buttons
- Test with screen reader (VoiceOver) for new pages
- Add skip links to any long content sections

**Files:** 3–5 modified component files, 0 new files **Dependencies:** None
(audit + fixes only)

---

## Task List

| #   | Task                                     | Package/App  | Size | Phase | Blocks |
| --- | ---------------------------------------- | ------------ | ---- | ----- | ------ |
| 1   | StudentSettingsPage                      | student-web  | S    | A     | —      |
| 2   | StudentProfilePage                       | student-web  | S    | A     | —      |
| 3   | Student nav + routes (Settings, Profile) | student-web  | S    | A     | 1, 2   |
| 4   | ChildComparisonPage                      | parent-web   | M    | B     | —      |
| 5   | PerformanceTrendsChart component         | parent-web   | M    | B     | 6      |
| 6   | usePerformanceTrends hook                | shared-hooks | S    | B     | —      |
| 7   | Parent PDF report (ChildProgressPage)    | parent-web   | S    | B     | —      |
| 8   | Parent nav + routes (Compare)            | parent-web   | S    | B     | 4      |
| 9   | BatchGradingPage                         | teacher-web  | M    | C     | —      |
| 10  | StudentReportPage PDF export             | teacher-web  | S    | C     | —      |
| 11  | Teacher nav + routes (Batch Grading)     | teacher-web  | S    | C     | 9      |
| 12  | useOnlineStatus hook                     | shared-hooks | S    | D     | —      |
| 13  | OfflineBanner component                  | shared-ui    | S    | D     | 12     |
| 14  | RetryErrorCard component                 | shared-ui    | S    | D     | —      |
| 15  | Integrate OfflineBanner + RetryErrorCard | all 3 apps   | S    | D     | 13, 14 |
| 16  | LeaderboardPage animation polish         | student-web  | S    | E     | —      |
| 17  | StudyPlannerPage calendar widget         | student-web  | S    | E     | —      |
| 18  | Focus ring & dark mode audit             | shared-ui    | S    | F     | —      |
| 19  | Keyboard navigation audit (new pages)    | all 3 apps   | S    | F     | 1–11   |
| 20  | Build verification                       | all packages | S    | F     | 1–19   |
| 21  | Cycle 4 test report                      | docs         | S    | F     | 20     |

**Total: 21 tasks (3 new pages, 2 new components, 2 new hooks, ~15 modified
files)**

---

## Execution Order

```
Parallel Group 1 (independent):
  ├── Phase A: Tasks 1, 2 → Task 3
  ├── Phase B: Tasks 6, 7 → Tasks 4, 5 → Task 8
  └── Phase C: Tasks 9, 10 → Task 11

Parallel Group 2 (after shared packages):
  ├── Phase D: Tasks 12, 14 → Task 13 → Task 15
  └── Phase E: Tasks 16, 17

Sequential:
  Phase F: Tasks 18, 19 → Task 20 → Task 21
```

---

## Architecture Decisions

1. **Reuse existing hooks:** Student notification preferences reuse
   `useNotificationPreferences` pattern from parent-web (same Firestore
   collection shape)
2. **Performance trends derived from submissions:** No new backend endpoint;
   aggregate from existing exam submission timestamps client-side with query
   caching
3. **Batch grading is client-only:** Approval/override actions call existing
   submission mutation hooks; no new Cloud Functions
4. **OfflineBanner uses navigator.onLine:** Simple, reliable approach; no
   service worker message channel needed
5. **RetryErrorCard replaces section errors only:** Global ErrorBoundary stays
   for catastrophic failures; RetryErrorCard for recoverable section data-fetch
   failures
6. **Calendar widget reuses shadcn Calendar:** No new date library; use existing
   Radix-based calendar in compact mode
7. **PDF export via existing callGenerateReport:** Same Cloud Function pipeline
   as teacher; parent passes `type: 'student-progress-report'`

---

## Risk Assessment

| Risk                                                                | Impact | Mitigation                                                             |
| ------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Performance trends query could be slow for high-submission students | Medium | Cache aggressively (5 min stale), limit to most recent 100 submissions |
| Batch grading page complexity                                       | Low    | Use existing submission hooks; no new data model                       |
| Dark mode audit may reveal widespread issues                        | Low    | Scope to V9-specific components only; log remaining issues for Cycle 5 |
| OfflineBanner could cause layout shift                              | Low    | Use fixed positioning, animate height expansion                        |

---

## Success Criteria

- [ ] All 21 tasks complete, all packages build with 0 type errors
- [ ] Student has Settings + Profile pages accessible from nav
- [ ] Parent can compare 2+ children side-by-side and view trend charts
- [ ] Parent can download PDF report from ChildProgressPage
- [ ] Teacher can batch-grade from dedicated page and export student report as
      PDF
- [ ] OfflineBanner displays when network drops across all 3 apps
- [ ] RetryErrorCard enables retry on section-level data failures
- [ ] Leaderboard has stagger animations and current-user highlight
- [ ] Study planner has compact calendar widget with goal deadlines
- [ ] Focus rings are consistent across all interactive elements
- [ ] All new pages pass keyboard navigation audit
- [ ] Gamification components render correctly in dark mode
