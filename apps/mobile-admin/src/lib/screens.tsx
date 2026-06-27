/**
 * Screen registry (shell lane) — the single seam between the router tree and the
 * screen lanes.
 *
 * Every route file in `src/app` mounts its screen by re-exporting ONE symbol
 * from here. Lanes write the real modules at `src/screens/<section>/<Symbol>.tsx`
 * (default export); the shell flips the import below from `./placeholder` to the
 * real module — one line per symbol — with zero router churn.
 *
 * Each screen is wrapped with `withScreenBoundary` (a per-screen
 * `ApiErrorBoundary` + native fallback) so a render-time throw on real data
 * degrades to a friendly card instead of red-screening the app. Reads degrade
 * NOT_FOUND/UNAUTHENTICATED to empty via `lib/query-status` (SdkProvider sets
 * `throwReadErrorsToBoundary=false`).
 *
 * Canonical mount paths + default-export names are the contract for the lanes;
 * see [[routes]] for matching navigation builders, and BUILD-CONTRACT.md.
 */
import { withScreenBoundary } from "./ScreenBoundary";
import { makePlaceholder } from "./placeholder";

// ── tab: Home  (lane: M-admin-home-insights → src/screens/home/*) ────
import AdminDashboardScreenImpl from "../screens/home/AdminDashboardScreen";

// ── tab: People  (lane: M-admin-people → src/screens/people/*) ───────
import UserManagementScreenImpl from "../screens/people/UserManagementScreen";
import StaffManagementScreenImpl from "../screens/people/StaffManagementScreen";
import RolesPermissionsScreenImpl from "../screens/people/RolesPermissionsScreen";
import ParentLinkingScreenImpl from "../screens/people/ParentLinkingScreen";
import UserDetailScreenImpl from "../screens/people/UserDetailScreen";

// ── tab: Academics  (lane: M-admin-academics → src/screens/academics/*) ─
import ClassManagementScreenImpl from "../screens/academics/ClassManagementScreen";
import ClassDetailScreenImpl from "../screens/academics/ClassDetailScreen";
import SpacesOverviewScreenImpl from "../screens/academics/SpacesOverviewScreen";
import CoursesScreenImpl from "../screens/academics/CoursesScreen";
import ExamsOverviewScreenImpl from "../screens/academics/ExamsOverviewScreen";
import AcademicSessionsScreenImpl from "../screens/academics/AcademicSessionsScreen";

// ── tab: Insights  (lane: M-admin-home-insights → src/screens/insights/*) ─
import AnalyticsScreenImpl from "../screens/insights/AnalyticsScreen";
import ReportsScreenImpl from "../screens/insights/ReportsScreen";
import AiUsageCostScreenImpl from "../screens/insights/AiUsageCostScreen";

// ── tab: More  (lane: M-admin-more → src/screens/more/*) ─────────────
import MoreMenuScreenImpl from "../screens/more/MoreMenuScreen";
import AnnouncementsScreenImpl from "../screens/more/AnnouncementsScreen";
import NotificationsScreenImpl from "../screens/more/NotificationsScreen";
import TenantSettingsScreenImpl from "../screens/more/TenantSettingsScreen";
import DataExportScreenImpl from "../screens/more/DataExportScreen";
import OnboardingWizardScreenImpl from "../screens/more/OnboardingWizardScreen";

// keep the placeholder factory referenced (lanes may temporarily un-wire).
export { makePlaceholder };

// ── boundary-wrapped exports (router imports these; names are the contract) ──
export const AdminDashboardScreen = withScreenBoundary(AdminDashboardScreenImpl);

export const UserManagementScreen = withScreenBoundary(UserManagementScreenImpl);
export const StaffManagementScreen = withScreenBoundary(StaffManagementScreenImpl);
export const RolesPermissionsScreen = withScreenBoundary(RolesPermissionsScreenImpl);
export const ParentLinkingScreen = withScreenBoundary(ParentLinkingScreenImpl);
export const UserDetailScreen = withScreenBoundary(UserDetailScreenImpl);

export const ClassManagementScreen = withScreenBoundary(ClassManagementScreenImpl);
export const ClassDetailScreen = withScreenBoundary(ClassDetailScreenImpl);
export const SpacesOverviewScreen = withScreenBoundary(SpacesOverviewScreenImpl);
export const CoursesScreen = withScreenBoundary(CoursesScreenImpl);
export const ExamsOverviewScreen = withScreenBoundary(ExamsOverviewScreenImpl);
export const AcademicSessionsScreen = withScreenBoundary(AcademicSessionsScreenImpl);

export const AnalyticsScreen = withScreenBoundary(AnalyticsScreenImpl);
export const ReportsScreen = withScreenBoundary(ReportsScreenImpl);
export const AiUsageCostScreen = withScreenBoundary(AiUsageCostScreenImpl);

export const MoreMenuScreen = withScreenBoundary(MoreMenuScreenImpl);
export const AnnouncementsScreen = withScreenBoundary(AnnouncementsScreenImpl);
export const NotificationsScreen = withScreenBoundary(NotificationsScreenImpl);
export const TenantSettingsScreen = withScreenBoundary(TenantSettingsScreenImpl);
export const DataExportScreen = withScreenBoundary(DataExportScreenImpl);
export const OnboardingWizardScreen = withScreenBoundary(OnboardingWizardScreenImpl);
