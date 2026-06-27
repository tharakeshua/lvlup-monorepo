import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { NotFoundPage, PageLoader, RouteErrorBoundary } from "@levelup/shared-ui";
import { useCurrentMembership, useCurrentTenant, useCurrentUser } from "@/sdk/identity";
import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import RequireAuth from "./guards/RequireAuth";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ClassesPage = lazy(() => import("./pages/ClassesPage"));
const ExamsOverviewPage = lazy(() => import("./pages/ExamsOverviewPage"));
const SpacesOverviewPage = lazy(() => import("./pages/SpacesOverviewPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AcademicSessionPage = lazy(() => import("./pages/AcademicSessionPage"));
const AIUsagePage = lazy(() => import("./pages/AIUsagePage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const CoursesPage = lazy(() => import("./pages/CoursesPage"));
const StaffPage = lazy(() => import("./pages/StaffPage"));
const OnboardingWizardPage = lazy(() => import("./pages/OnboardingWizardPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const ClassDetailPage = lazy(() => import("./pages/ClassDetailPage"));
const DataExportPage = lazy(() => import("./pages/DataExportPage"));

/**
 * Redirects tenantAdmin users to /onboarding if onboarding is not complete.
 * SuperAdmin users bypass this check.
 */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const tenantQ = useCurrentTenant();
  const membership = useCurrentMembership();
  const isSuperAdmin = useCurrentUser()?.isSuperAdmin ?? false;

  // Allow onboarding page itself
  if (location.pathname === "/onboarding") {
    return <>{children}</>;
  }

  const tenant = (tenantQ.data ?? null) as {
    onboarding?: { completed?: boolean };
  } | null;

  // Only redirect tenantAdmin users with incomplete onboarding. Wait for the
  // tenant record to load before deciding (avoid a flash-redirect).
  if (
    tenant &&
    !isSuperAdmin &&
    membership?.role === "tenantAdmin" &&
    tenant.onboarding?.completed !== true
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  // Auth bootstrap is owned by <SessionProvider> (firebase auth state) and tenant
  // data flows reactively through `@levelup/query` hooks — no manual store wiring.
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<RequireAuth allowedRoles={["tenantAdmin"]} />}>
          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <DashboardPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/users"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <UsersPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/classes"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <ClassesPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/classes/:classId"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <ClassDetailPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/exams"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <ExamsOverviewPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/spaces"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <SpacesOverviewPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/ai-usage"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <AIUsagePage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/settings"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <SettingsPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/academic-sessions"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <AcademicSessionPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/reports"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <ReportsPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/analytics"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <AnalyticsPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/courses"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <CoursesPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/notifications"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <NotificationsPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/staff"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <StaffPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/announcements"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <AnnouncementsPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/data-export"
              element={
                <RouteErrorBoundary>
                  <OnboardingGuard>
                    <DataExportPage />
                  </OnboardingGuard>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/onboarding"
              element={
                <RouteErrorBoundary>
                  <OnboardingWizardPage />
                </RouteErrorBoundary>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
