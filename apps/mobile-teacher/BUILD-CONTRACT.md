# Mobile TEACHER Build — Parallel Contract (disjoint lanes)

> Enables MANY maestro sessions to build `apps/mobile-teacher` concurrently
> without conflict. Each session owns a **disjoint directory subtree** and codes
> against the **shared contracts** below. The **coordinator** (TEACHER-COORD,
> sess_1782501793806_rx20rtvvc) owns `src/app` + `src/lib` + `src/sdk`,
> integrates lanes, flips the registry, runs build green, and ships the phone
> build.

App: `apps/mobile-teacher` · pkg `academy.levelup.teacher` · Expo SDK 52 / RN
0.76.9 / expo-router v4 / NativeWind 4.1.23 · **Metro port 8082** · backend prod
`lvlup-ff6fa` (asia-south1, v2\_). Base copied from the proven
`apps/mobile-student` (SDK wiring + Hermes de-risk already proven — DO NOT
re-derive).

## Hard rules

- **Lane = a directory subtree.** Never edit outside your lane. Shared files
  (`src/app/**`, `src/lib/routes.ts`, `src/lib/screens.tsx`,
  `src/components/index.ts` barrel) are owned by the **coordinator** /
  **components lane** as noted; others import, never edit them.
- **No direct Firestore.** Screens get data ONLY via `@levelup/query` hooks. No
  `firebase/firestore` imports in the app.
- **Code DEFENSIVELY.** `@levelup/query` reads THROW on not-found; the deployed
  teacher callables are only PARTIALLY live (see GATE-B below). Guard every
  nested read (`x?.a ?? fallback`), default missing values, never
  `.toFixed()`/index into a possibly-undefined object. Treat loading/empty/error
  as first-class — wrap data screens in `ScreenBoundary` (see
  `src/lib/ScreenBoundary.tsx`) and use the soft-miss→empty pattern from
  `src/lib/query-status.ts`. A pre-auth UNAUTHENTICATED read is NOT a real error
  → render empty, refetch on auth.
- **Branded IDs:** route params + `useSession().user.uid` are plain `string`;
  hooks want `UserId`/`ClassId`/`StudentId`/`ExamId`/`SpaceId`/`SubmissionId`
  from `@levelup/domain` — cast at the call boundary (`id as ClassId`).
- **Typecheck with**
  `PATH=/opt/homebrew/opt/node@20/bin:$PATH pnpm exec tsc --noEmit` (run from
  `apps/mobile-teacher`). `npx tsc` is a DECOY here.
- **Install** (if you must):
  `HUSKY=0 pnpm install --filter @levelup/mobile-teacher --ignore-scripts` then
  answer `n` to the purge prompt. NEVER run a bare `pnpm install` — it prunes
  all apps then fails on `functions/autograde` and orphans every app's RN
  symlinks.
- All sessions Opus 4.8 1M; each may run its own dynamic Workflow to fan out
  within its lane. Report at your gate.

## Folder layout (lanes)

```
apps/mobile-teacher/src/
  sdk/            [coordinator — DO NOT EDIT]  firebase RN init / api / session / SdkProvider / env
  lib/            [coordinator]                routes.ts (FROZEN), screens.tsx (registry), ScreenBoundary, placeholder, query-status
  app/            [coordinator]                expo-router tree (teacher/* tabs + flat detail routes), tab navigator, providers
  theme/          [LANE: M-teacher-components] Lyceum tokens (already ported)
  components/     [LANE: M-teacher-components] RN Lyceum library + teacher additions. Barrel: src/components/index.ts
  screens/
    home/         [LANE: M-teacher-home-insights]  TeacherDashboardScreen, AssignmentTrackerScreen
    insights/     [LANE: M-teacher-home-insights]  ClassInsightsScreen, AtRiskStudentsScreen, ClassTestAnalyticsScreen, SpaceAnalyticsScreen
    classes/      [LANE: M-teacher-classes]        ClassesOverviewScreen, ClassDetailRosterScreen, AssignContentScreen, StudentsDirectoryScreen, StudentDetailScreen
    review/       [LANE: M-teacher-review]         ExamsOverviewScreen, GradingQueueScreen, GradingReviewScreen, SubmissionDetailScreen, ManualOverrideScreen, RubricBreakdownScreen, ExamAnalyticsScreen, ResultsReleaseScreen
    more/         [LANE: M-teacher-more]           MoreMenuScreen, AnnouncementsComposeScreen, NotificationsScreen, TeacherSettingsScreen, TenantSwitcherScreen
```

**Each screen file:** `src/screens/<section>/<Symbol>Screen.tsx`, **default
export** a component named `<Symbol>Screen`. The coordinator flips
`src/lib/screens.tsx` from the placeholder to
`export { default as <Symbol>Screen } from '../screens/<section>/<Symbol>Screen';`.
Loading→Skeleton, error→friendly, empty→EmptyState in every screen.

## Component contract (LANE: M-teacher-components — STUB ALL FIRST)

The base Lyceum RN library is ALREADY in `src/components` (copied from
mobile-student):
`Screen, Card, Button, Badge/Chip, Avatar, ProgressBar, Meter/Ring, StatTile, ListRow, SectionHeader, Tabbar, TopBar, Sheet/Drawer, Skeleton, EmptyState, Pill/Tag, Divider, IconButton, SearchField, TextField, Icon`,
plus the item-render kit (`MaterialBlock, QuestionView, AttemptBar`). Verify the
barrel `src/components/index.ts` exports them. **ADD (teacher-specific),
stub-export FIRST (typed placeholder render) so screen lanes compile
immediately, then flesh out:**

- `RosterRow` (student row: avatar, name, progress, status, last-active)
- `SubmissionCard` (grading queue row: student, status pill, confidence, score)
- `ConfidenceBadge` (high/medium/low autograde confidence)
- `RubricRow` / `RubricBreakdown` (sub-question criteria + points)
- `ScoreInput` / `ScoreStepper` (manual override numeric entry)
- `MiniBarChart` / `Sparkline` / `DistributionBar` (analytics — pure RN/SVG, no
  heavy chart dep)
- `MetricCard` (insights stat with delta)
- `AtRiskRow` (student + risk reason + severity)
- `RoleTenantPill` (top-bar role/tenant switcher trigger)
- `FilterChips` (horizontal scroll filter row) Icons: `lucide-react-native`.
  Props mirror Lyceum web components in
  `docs/rebuild-spec/design/build/components/`. Match look to
  `~/Desktop/lvlup-mobile/Lyceum-Mobile-Staff.html` (teacher routes
  `#/teacher/*`) + the cards in
  `docs/rebuild-spec/design/build/prototypes/teacher/`.

## Screen → `@levelup/query` hook map (all hooks CONFIRMED present in packages/query)

### home/ + insights/ (M-teacher-home-insights)

- `TeacherDashboardScreen` (teacher-dashboard) → `useClasses`,
  `useExamGradingOverview`/`useGradingStatus`, `useInsights`, `useAnnouncements`
  (counts: classes, awaiting-review, at-risk). Cross-links to assignments +
  review.
- `AssignmentTrackerScreen` (assignment-tracker) → `useAssignments`-equiv via
  `assignmentRepo`/`useClasses` + per-class progress; status chips
  (assigned/in-progress/overdue).
- `ClassInsightsScreen` (class-analytics-insights, hub) → `useClassSummary`,
  `useLearningInsights`, `useInsights`.
- `AtRiskStudentsScreen` (at-risk-students) →
  `useInsights`(at-risk)/`useLearningInsights`; `useDismissInsight` to dismiss.
- `ClassTestAnalyticsScreen` (class-test-analytics) →
  `useExamAnalytics`/`useExams` per class.
- `SpaceAnalyticsScreen` (space-analytics) → `useSpaceProgress`/`useSpaces` +
  `useSpaceReviews`.

### classes/ (M-teacher-classes)

- `ClassesOverviewScreen` (classes-overview) → `useClasses`.
- `ClassDetailRosterScreen` (class-detail-roster) → `useClass(classId)`
  (counts + first roster page) + `useStudents({classId})`.
- `AssignContentScreen` (assign-content, sheet ⟶web) → `useSpaces` (pick
  content) + assign mutation; render monitor state + "Continue on web" Button
  for heavy authoring.
- `StudentsDirectoryScreen` (students-directory) → `useStudents`.
- `StudentDetailScreen` (student-detail-progress) → `useStudent(studentId)` +
  `useSpaceProgress`/`useStudentSummary`.

### review/ (M-teacher-review)

- `ExamsOverviewScreen` (exams-overview, teacher monitor) → `useExams` +
  `useExamGradingProgress`.
- `GradingQueueScreen` (submissions-grading-queue) →
  `useExamGradingOverview`/`useSubmissions`/`useGradingStatus`.
- `GradingReviewScreen` (grading-review, confidence-routed) →
  `useGradingReviewBundle(examId)`.
- `SubmissionDetailScreen` (submission-detail) →
  `useSubmission(examId, submissionId)` + `useQuestionSubmissions`.
- `ManualOverrideScreen` (manual-override modal) → `useGradeManual` mutation.
- `RubricBreakdownScreen` (subquestion-rubric drawer) → `useRubricPresets` + the
  submission's rubric breakdown.
- `ExamAnalyticsScreen` (exam-analytics) → `useExamAnalytics(examId)`.
- `ResultsReleaseScreen` (results-release modal, approve+publish) → release
  mutation (`evaluationRepo`/exam release) + `useRetryGrading` for stuck items.

### more/ (M-teacher-more)

- `MoreMenuScreen` → static menu list linking
  announcements/notifications/settings + role/tenant switch.
- `AnnouncementsComposeScreen` (announcements-compose) → `useAnnouncements` +
  `useSaveAnnouncement`.
- `NotificationsScreen` (notifications) → notifications hook +
  `useMarkAnnouncementRead`.
- `TeacherSettingsScreen` (teacher-settings) → `useMe`/session; theme +
  sign-out.
- `TenantSwitcherScreen` (tenant-switcher, sheet) → memberships +
  `switchActiveTenant` (multi-membership).

## ⚠ GATE-0 STATUS = PASSED (headless + on-device)

- `scripts/smoke-teacher-prod.mjs`: signed in `subhang.rocklee@gmail.com` → fat
  SDK → `spaceRepo.list` = **12 real Subhang spaces** from `lvlup-ff6fa`. On iOS
  sim: app renders the teacher identity + SDK path live.
- `.env`: `EXPO_PUBLIC_USE_EMULATORS=false` (prod) + env-gated autologin
  (`subhang.rocklee@gmail.com`/`Test@12345`).

## ⚠ GATE-B (teacher callables) — develop against the contract, don't block on it

The deployed `lvlup-ff6fa` callables are STILL student-focused. Probed LIVE on
2026-06-27:

- ✅ LIVE: `spaceRepo.list` (+ space reads — teacher authors spaces).
- ⚠️ NOT_FOUND (need deploy/canonicalization): `classRepo.list`,
  `studentRepo.list`, `examRepo.list`, `announcementRepo.list`. SDK-BUILD-COORD
  (sess_1781966725755_mbw952a6q) owns the teacher-callable deploy +
  response-canonicalization (the GATE-B slice). **Lanes: build now against the
  hook contract + design cards.** Develop/verify data against the richer
  **DEMO01** tenant (`principal@demo.levelup.academy` / `Demo@12345`, ~30
  students / 8 teachers / classes / exams) once SDK-coord confirms the teacher
  callables are deployed — the coordinator will broadcast when GATE-B lands.
  Until then your screens render loading/empty gracefully (defensive reads) and
  you wire the exact hooks from the map above.

## Coordinator (TEACHER-COORD)

Owns `src/app` (router + custom tab bar + flat detail routes per `routes.ts`),
`src/lib`, `src/sdk`, integration. Maintains this contract. Flips `screens.tsx`
per landed screen. Coordinates GATE-B with SDK-coord. Runs `pnpm exec tsc`
green, installs on OnePlus 12 (`adb 2f281218`, Metro 8082 + `adb reverse`) +
proves on iOS sim. Reports GATE 0, screens-done, installed-on-phone.
