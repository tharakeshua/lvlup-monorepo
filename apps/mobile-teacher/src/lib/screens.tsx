/**
 * Screen REGISTRY (owned by the SHELL / coordinator).
 *
 * Single source mapping every teacher screen SYMBOL → its component. The
 * expo-router files under `src/app/teacher/**` import their screen from HERE, so
 * the router tree never imports lane code directly. While a lane's real module
 * is pending, the symbol resolves to a `makePlaceholder(...)` stub — the whole
 * navigation shell is mountable + walkable immediately.
 *
 * SWAP-IN (one line per screen, coordinator-only edit): when a lane lands
 *   src/screens/<section>/<Symbol>Screen.tsx   (default export)
 * flip that symbol's line from the placeholder to:
 *   export { default as <Symbol> } from '../screens/<section>/<Symbol>Screen';
 *
 * Lanes: NEVER edit this file. Create your screen module at the contracted path;
 * the coordinator flips the line. See apps/mobile-teacher/BUILD-CONTRACT.md.
 */
// All 24 teacher screens have LANDED — every symbol now re-exports its real
// lane module. (Placeholders via `makePlaceholder` are retired; see git history
// if a screen needs to be temporarily stubbed again.)

// ── TAB 1: Home (lane: M-teacher-home-insights) — LANDED ────────────
export { default as TeacherDashboardScreen } from "../screens/home/TeacherDashboardScreen";
export { default as AssignmentTrackerScreen } from "../screens/home/AssignmentTrackerScreen";

// ── TAB 2: Classes (lane: M-teacher-classes) — LANDED ───────────────
export { default as ClassesOverviewScreen } from "../screens/classes/ClassesOverviewScreen";
export { default as ClassDetailRosterScreen } from "../screens/classes/ClassDetailRosterScreen";
export { default as AssignContentScreen } from "../screens/classes/AssignContentScreen";
export { default as StudentsDirectoryScreen } from "../screens/classes/StudentsDirectoryScreen";
export { default as StudentDetailScreen } from "../screens/classes/StudentDetailScreen";

// ── TAB 3: Review / grading (lane: M-teacher-review) — LANDED ────────
export { default as ExamsOverviewScreen } from "../screens/review/ExamsOverviewScreen";
export { default as GradingQueueScreen } from "../screens/review/GradingQueueScreen";
export { default as GradingReviewScreen } from "../screens/review/GradingReviewScreen";
export { default as SubmissionDetailScreen } from "../screens/review/SubmissionDetailScreen";
export { default as ManualOverrideScreen } from "../screens/review/ManualOverrideScreen";
export { default as RubricBreakdownScreen } from "../screens/review/RubricBreakdownScreen";
export { default as ExamAnalyticsScreen } from "../screens/review/ExamAnalyticsScreen";
export { default as ResultsReleaseScreen } from "../screens/review/ResultsReleaseScreen";

// ── TAB 4: Insights (lane: M-teacher-home-insights) — LANDED ────────
export { default as ClassInsightsScreen } from "../screens/insights/ClassInsightsScreen";
export { default as AtRiskStudentsScreen } from "../screens/insights/AtRiskStudentsScreen";
export { default as ClassTestAnalyticsScreen } from "../screens/insights/ClassTestAnalyticsScreen";
export { default as SpaceAnalyticsScreen } from "../screens/insights/SpaceAnalyticsScreen";

// ── TAB 6: Create (CC-5 shell + CC-7 editors) ───────────────────────
export { default as CreateHubScreen } from "../screens/create/CreateHubScreen";
export { default as ExamWizardScreen } from "../screens/create/ExamWizardScreen";
export { default as GenerateContentScreen } from "../screens/create/GenerateContentScreen";
// CC-7 seam — modules landed; placeholders replaced with real re-exports:
export { default as ItemEditorScreen } from "../screens/create/ItemEditorScreen";
export { default as StoryPointEditorScreen } from "../screens/create/StoryPointEditorScreen";
export { default as SpaceEditorScreen } from "../screens/create/SpaceEditorScreen";
export { default as QuestionBankListScreen } from "../screens/create/QuestionBankListScreen";
export { default as QuestionBankEditorScreen } from "../screens/create/QuestionBankEditorScreen";

// ── TAB 5: More (lane: M-teacher-more) — LANDED ─────────────────────
export { default as MoreMenuScreen } from "../screens/more/MoreMenuScreen";
export { default as AnnouncementsComposeScreen } from "../screens/more/AnnouncementsComposeScreen";
export { default as NotificationsScreen } from "../screens/more/NotificationsScreen";
export { default as TeacherSettingsScreen } from "../screens/more/TeacherSettingsScreen";
export { default as TenantSwitcherScreen } from "../screens/more/TenantSwitcherScreen";
