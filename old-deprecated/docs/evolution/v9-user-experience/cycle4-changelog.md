# V9: Student, Parent & Teacher Experience — Cycle 4 Changelog

**Cycle:** 4 **Vertical:** V9 (User Experience) **Engineer:** Design Systems
Engineer **Date:** 2026-03-08 **Status:** COMPLETE

---

## Summary

Cycle 4 delivered 3 new pages, 2 new shared components, 2 new hooks, and ~15
modified files across all 3 portals. Key additions: student settings/profile,
parent child comparison with performance trends, teacher batch grading,
cross-app offline handling, leaderboard animation polish, and study planner
calendar widget.

---

## Phase A: Student Settings & Profile

### A1. StudentSettingsPage — `apps/student-web/src/pages/SettingsPage.tsx` (NEW)

- Profile section: read-only display name and email
- Notification preferences with 4 student-specific toggles: exam results,
  achievement alerts, leaderboard updates, streak reminders
- Notification channel toggles: email and push
- Appearance section with ThemeToggle
- Account section with sign out
- Uses local `useNotificationPreferences` and `useSaveNotificationPreferences`
  hooks

### A2. StudentProfilePage — `apps/student-web/src/pages/ProfilePage.tsx` (NEW)

- Initials-based avatar display (or photo if available)
- LevelBadge with XP progress bar
- StreakWidget showing current streak
- Stats cards: achievements earned, total points, overall score
- School enrollment info from tenant store
- Staggered FadeIn animations

### A3. Student nav + routes

- **`apps/student-web/src/App.tsx`** — Added `/settings` and `/profile`
  lazy-loaded routes
- **`apps/student-web/src/layouts/AppLayout.tsx`** — Added "Account" nav group
  with Profile (UserCircle icon) and Settings (Settings icon)

### A4. Student notification hooks (NEW)

- `apps/student-web/src/hooks/useNotificationPreferences.ts` — Reads from
  `tenants/{tenantId}/notificationPreferences/{userId}`
- `apps/student-web/src/hooks/useSaveNotificationPreferences.ts` — Writes prefs
  with merge, invalidates query cache

---

## Phase B: Parent Multi-Child Comparison & Trends

### B1. ChildComparisonPage — `apps/parent-web/src/pages/ChildComparisonPage.tsx` (NEW)

- Side-by-side comparison cards for up to 4 children
- Metrics compared: overall score, exam average, space completion, streak,
  points
- ProgressRing per child for visual comparison
- SimpleBarChart showing overall score comparison
- Best performer highlighted with star icon per metric
- Minimum 2 children required; EmptyState for insufficient children

### B2. PerformanceTrendsChart — `apps/parent-web/src/components/PerformanceTrendsChart.tsx` (NEW)

- SVG-based line chart showing score progression over time
- Time range selector: 7 days, 30 days, 90 days, all time
- Data sourced from exam submissions via `usePerformanceTrends` hook
- Interactive data points with tooltips

### B3. usePerformanceTrends hook — `packages/shared-hooks/src/queries/usePerformanceTrends.ts` (NEW)

- `usePerformanceTrends(tenantId, studentId, range)` — aggregates exam scores
  over time
- Returns `{ data: TrendDataPoint[], loading, error }`
- Query cache: 5 minutes
- Limits to most recent 100 submissions
- Exported from shared-hooks queries index

### B4. Parent PDF report

- **`apps/parent-web/src/pages/ChildProgressPage.tsx`** — Added
  `DownloadPDFButton` to page header
- Calls `callGenerateReport` with `type: 'student-progress-report'`
- Also added `PerformanceTrendsChart` section above subject breakdown charts

### B5. Parent nav + routes

- **`apps/parent-web/src/App.tsx`** — Added `/compare` lazy-loaded route
- **`apps/parent-web/src/layouts/AppLayout.tsx`** — Added "Compare Children" nav
  item (BarChart3 icon) in My Children group

---

## Phase C: Teacher Batch Grading & Report Export

### C1. BatchGradingPage — `apps/teacher-web/src/pages/BatchGradingPage.tsx` (NEW)

- Dedicated batch grading workflow for all pending submissions
- Filter by status: All Pending, Needs Review, Auto-Graded, Flagged
- Filter by exam
- Quick-action: Approve button per submission
- Status badges for each submission type
- Pagination with "X of Y" progress indicator
- AnimatedList for staggered entrance animations
- EmptyState when all submissions are reviewed

### C2. StudentReportPage PDF export

- **`apps/teacher-web/src/pages/StudentReportPage.tsx`** — Added
  `DownloadPDFButton` to page header
- Calls `callGenerateReport` with `type: 'student-report'`

### C3. Teacher nav + routes

- **`apps/teacher-web/src/App.tsx`** — Added `/grading` lazy-loaded route
- **`apps/teacher-web/src/layouts/AppLayout.tsx`** — Added "Batch Grading" nav
  item (CheckSquare icon) in Content group

---

## Phase D: Cross-App Resilience Patterns

### D1. useOnlineStatus hook — `packages/shared-hooks/src/ui/useOnlineStatus.ts` (NEW)

- Monitors `navigator.onLine` events
- Returns `{ isOnline, lastOnlineAt }`
- Fires callback on status change
- Exported from shared-hooks UI index

### D2. OfflineBanner component — `packages/shared-ui/src/components/layout/OfflineBanner.tsx` (NEW)

- Fixed position banner at top of viewport
- "You're offline. Some data may be outdated." message
- Dismissible with X button
- Re-shows when transitioning from online to offline
- Uses amber-500 background for visibility
- Exported from shared-ui layout index

### D3. RetryErrorCard component — `packages/shared-ui/src/components/feedback/RetryErrorCard.tsx` (NEW)

- Inline error recovery card for section-level failures
- Props: `error`, `onRetry`, `title?`, `compact?`
- Shows error message + "Try Again" button with RefreshCw icon
- Destructive color scheme for clear error indication
- Exported from new shared-ui feedback barrel

### D4. Integration — All 3 app layouts

- **`apps/student-web/src/layouts/AppLayout.tsx`** — Added `<OfflineBanner />`
- **`apps/parent-web/src/layouts/AppLayout.tsx`** — Added `<OfflineBanner />`
- **`apps/teacher-web/src/layouts/AppLayout.tsx`** — Added `<OfflineBanner />`

---

## Phase E: Leaderboard & Animation Polish

### E1. LeaderboardPage animation — `apps/student-web/src/pages/LeaderboardPage.tsx`

- Wrapped header and filter controls in `FadeIn` components
- Current user rank uses `CountUp` animation

### E1b. LeaderboardTable — `apps/student-web/src/components/leaderboard/LeaderboardTable.tsx`

- Wrapped rows in `AnimatedList` + `AnimatedListItem` for staggered entrance
- Added `CountUp` animation on point values
- Added `Pressable` hover interaction on rows
- Current user's row highlighted with primary-tinted background + ring
- Added `RankChangeIndicator` component for ▲▼ rank changes

### E2. StudyPlannerPage calendar widget — `apps/student-web/src/pages/StudyPlannerPage.tsx`

- Added `WeekCalendarStrip` component above goals list
- Shows Monday-Sunday of current week
- Goals due dates rendered as dots on calendar days
- Click day to filter active goals by that date
- Clear filter button when day is selected
- Keyboard accessible with aria labels

---

## Phase F: Accessibility & Dark Mode Audit

### F1. Focus ring consistency

- Verified global `:focus-visible` styles in
  `packages/tailwind-config/variables.css`:
  - 2px solid outline using `--ring` CSS variable
  - 2px outline offset
  - Ring color matches primary in both light and dark modes
  - High contrast mode uses darker ring color for accessibility

### F2. Dark mode component audit

- Verified all gamification components (AchievementBadge, LevelBadge,
  StreakWidget) use Tailwind dark: variants
- No hardcoded hex colors in gamification components
- Tier gradients (bronze through diamond) use proper dark: overrides
- CelebrationBurst particle colors are intentionally vivid (overlay) — no dark
  mode change needed

### F3. Keyboard navigation audit

- All new pages (SettingsPage, ProfilePage, ChildComparisonPage,
  BatchGradingPage) use standard interactive elements
- Added `aria-hidden="true"` to decorative icons across all new components
- Added `aria-label` attributes to icon-only buttons (dismiss, pagination)
- Added `role="alert"` and `aria-live="polite"` to OfflineBanner
- Added `role="tablist"` and `role="tab"` with `aria-selected` to child selector
  tabs
- WeekCalendarStrip has `role="group"` with `aria-label` and `aria-pressed`
  states
- RetryErrorCard uses `role="alert"` for screen reader announcement

---

## Build Verification

- `tsc --noEmit` passes for all 3 apps with **0 type errors**
- `turbo build` passes for all 3 apps: student-web, parent-web, teacher-web
- All new pages are lazy-loaded for code splitting
- No `any` types used

---

## Files Changed

### New Files (10)

| File                                                            | Type      |
| --------------------------------------------------------------- | --------- |
| `apps/student-web/src/pages/SettingsPage.tsx`                   | Page      |
| `apps/student-web/src/pages/ProfilePage.tsx`                    | Page      |
| `apps/student-web/src/hooks/useNotificationPreferences.ts`      | Hook      |
| `apps/student-web/src/hooks/useSaveNotificationPreferences.ts`  | Hook      |
| `apps/parent-web/src/pages/ChildComparisonPage.tsx`             | Page      |
| `apps/parent-web/src/components/PerformanceTrendsChart.tsx`     | Component |
| `apps/teacher-web/src/pages/BatchGradingPage.tsx`               | Page      |
| `packages/shared-hooks/src/queries/usePerformanceTrends.ts`     | Hook      |
| `packages/shared-hooks/src/ui/useOnlineStatus.ts`               | Hook      |
| `packages/shared-ui/src/components/layout/OfflineBanner.tsx`    | Component |
| `packages/shared-ui/src/components/feedback/RetryErrorCard.tsx` | Component |
| `packages/shared-ui/src/components/feedback/index.ts`           | Barrel    |

### Modified Files (13)

| File                                                               | Changes                                   |
| ------------------------------------------------------------------ | ----------------------------------------- |
| `apps/student-web/src/App.tsx`                                     | Added settings + profile routes           |
| `apps/student-web/src/layouts/AppLayout.tsx`                       | Added Account nav group, OfflineBanner    |
| `apps/student-web/src/pages/LeaderboardPage.tsx`                   | FadeIn, CountUp animations                |
| `apps/student-web/src/pages/StudyPlannerPage.tsx`                  | WeekCalendarStrip, day filtering          |
| `apps/student-web/src/components/leaderboard/LeaderboardTable.tsx` | AnimatedList, CountUp, Pressable          |
| `apps/parent-web/src/App.tsx`                                      | Added compare route                       |
| `apps/parent-web/src/layouts/AppLayout.tsx`                        | Added Compare Children nav, OfflineBanner |
| `apps/parent-web/src/pages/ChildProgressPage.tsx`                  | PDF button, PerformanceTrendsChart        |
| `apps/teacher-web/src/App.tsx`                                     | Added grading route                       |
| `apps/teacher-web/src/layouts/AppLayout.tsx`                       | Added Batch Grading nav, OfflineBanner    |
| `apps/teacher-web/src/pages/StudentReportPage.tsx`                 | PDF download button                       |
| `packages/shared-hooks/src/queries/index.ts`                       | Export usePerformanceTrends               |
| `packages/shared-hooks/src/ui/index.ts`                            | Export useOnlineStatus                    |
| `packages/shared-ui/src/components/layout/index.ts`                | Export OfflineBanner                      |
| `packages/shared-ui/src/index.ts`                                  | Export feedback barrel                    |
