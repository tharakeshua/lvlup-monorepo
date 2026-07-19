/**
 * Screen registry (shell lane) — the single seam between the router tree and the
 * screen lanes.
 *
 * Every route file in `src/app` mounts its screen by re-exporting one symbol from
 * here. ALL 25 learner screens are LANDED (real modules); the integration is
 * complete.
 *
 * Each screen is wrapped with `withScreenBoundary` (a per-screen
 * `ApiErrorBoundary` + native fallback) so a residual render-time throw on real
 * data degrades to a friendly card instead of red-screening the whole app. Data
 * reads no longer throw here — `SdkProvider` turns off `throwReadErrorsToBoundary`
 * and screens degrade NOT_FOUND/UNAUTHENTICATED to a zero/empty state via
 * `lib/query-status`. The boundary is the belt to that suspenders.
 *
 * Export names are unchanged, so the router (`src/app`) is unaffected. The
 * `./placeholder` factory remains available to temporarily un-wire a screen.
 *
 * Canonical mount paths + default-export names are the contract broadcast to the
 * lanes; see [[routes]] for the matching navigation builders.
 */
import { withScreenBoundary } from "./ScreenBoundary";

// ── tab: Home  (lane: M-home-profile → src/screens/home/*) — LANDED ✓ ─
import HomeScreenImpl from "../screens/home/HomeScreen";
import ConsumerDashboardScreenImpl from "../screens/home/ConsumerDashboardScreen";

// ── tab: Learn  (lane: M-learn → src/screens/learn/*) — LANDED ✓ ─────
import SpacesListScreenImpl from "../screens/learn/SpacesListScreen";
import SpaceDetailScreenImpl from "../screens/learn/SpaceDetailScreen";
import ContentViewerScreenImpl from "../screens/learn/ContentViewerScreen";
import PracticeModeScreenImpl from "../screens/learn/PracticeModeScreen";

// ── tab: Tests  (lane: M-tests → src/screens/tests/*) — LANDED ✓ ─────
import TestsListScreenImpl from "../screens/tests/TestsListScreen";
import ExamsListScreenImpl from "../screens/tests/ExamsListScreen";
import TimedTestLandingScreenImpl from "../screens/tests/TimedTestLandingScreen";
import TimedTestRunnerScreenImpl from "../screens/tests/TimedTestRunnerScreen";
import TestResultsReviewScreenImpl from "../screens/tests/TestResultsReviewScreen";
import TestSessionAnalyticsScreenImpl from "../screens/tests/TestSessionAnalyticsScreen";
import ExamResultsViewScreenImpl from "../screens/tests/ExamResultsViewScreen";

// ── tab: Progress  (lane: M-progress → src/screens/progress/*) — LANDED ✓ ─
import ProgressAnalyticsScreenImpl from "../screens/progress/ProgressAnalyticsScreen";
import GamificationRewardsScreenImpl from "../screens/progress/GamificationRewardsScreen";
import AchievementsScreenImpl from "../screens/progress/AchievementsScreen";
import LeaderboardScreenImpl from "../screens/progress/LeaderboardScreen";
import GoalsScreenImpl from "../screens/progress/GoalsScreen";

// ── tab: Profile  (lane: M-home-profile → src/screens/profile/*) — LANDED ✓ ─
import ProfileScreenImpl from "../screens/profile/ProfileScreen";
import SettingsScreenImpl from "../screens/profile/SettingsScreen";
import ConsumerProfileScreenImpl from "../screens/profile/ConsumerProfileScreen";

// ── modals / drawers  (lane: M-home-profile → src/screens/profile/*) — LANDED ✓ ─
import NotificationsScreenImpl from "../screens/profile/NotificationsScreen";
import AiTutorChatScreenImpl from "../screens/profile/AiTutorChatScreen";

// ── store (B2C)  (lane: M-home-profile → src/screens/profile/*) — LANDED ✓ ─
import StoreBrowseScreenImpl from "../screens/profile/StoreBrowseScreen";
import StoreSpaceDetailScreenImpl from "../screens/profile/StoreSpaceDetailScreen";
import CheckoutScreenImpl from "../screens/profile/CheckoutScreen";

// ── boundary-wrapped exports (router imports these; names unchanged) ─────────
export const HomeScreen = withScreenBoundary(HomeScreenImpl);
export const ConsumerDashboardScreen = withScreenBoundary(ConsumerDashboardScreenImpl);

export const SpacesListScreen = withScreenBoundary(SpacesListScreenImpl);
export const SpaceDetailScreen = withScreenBoundary(SpaceDetailScreenImpl);
export const ContentViewerScreen = withScreenBoundary(ContentViewerScreenImpl);
export const PracticeModeScreen = withScreenBoundary(PracticeModeScreenImpl);

export const TestsListScreen = withScreenBoundary(TestsListScreenImpl);
export const ExamsListScreen = withScreenBoundary(ExamsListScreenImpl);
export const TimedTestLandingScreen = withScreenBoundary(TimedTestLandingScreenImpl);
export const TimedTestRunnerScreen = withScreenBoundary(TimedTestRunnerScreenImpl);
export const TestResultsReviewScreen = withScreenBoundary(TestResultsReviewScreenImpl);
export const TestSessionAnalyticsScreen = withScreenBoundary(TestSessionAnalyticsScreenImpl);
export const ExamResultsViewScreen = withScreenBoundary(ExamResultsViewScreenImpl);

export const ProgressAnalyticsScreen = withScreenBoundary(ProgressAnalyticsScreenImpl);
export const GamificationRewardsScreen = withScreenBoundary(GamificationRewardsScreenImpl);
export const AchievementsScreen = withScreenBoundary(AchievementsScreenImpl);
export const LeaderboardScreen = withScreenBoundary(LeaderboardScreenImpl);
export const GoalsScreen = withScreenBoundary(GoalsScreenImpl);

export const ProfileScreen = withScreenBoundary(ProfileScreenImpl);
export const SettingsScreen = withScreenBoundary(SettingsScreenImpl);
export const ConsumerProfileScreen = withScreenBoundary(ConsumerProfileScreenImpl);

export const NotificationsScreen = withScreenBoundary(NotificationsScreenImpl);
export const AiTutorChatScreen = withScreenBoundary(AiTutorChatScreenImpl);

export const StoreBrowseScreen = withScreenBoundary(StoreBrowseScreenImpl);
export const StoreSpaceDetailScreen = withScreenBoundary(StoreSpaceDetailScreenImpl);
export const CheckoutScreen = withScreenBoundary(CheckoutScreenImpl);
