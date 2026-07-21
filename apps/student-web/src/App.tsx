import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore, useTenantStore } from "@levelup/shared-stores";
import { PageLoader, RouteErrorBoundary, NotFoundPage } from "@levelup/shared-ui";
import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import ConsumerLayout from "./layouts/ConsumerLayout";
import RequireAuth from "./guards/RequireAuth";

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ConsumerDashboardPage = lazy(() => import("./pages/ConsumerDashboardPage"));
const SpacesListPage = lazy(() => import("./pages/SpacesListPage"));
const SpaceViewerPage = lazy(() => import("./pages/SpaceViewerPage"));
const StoryPointViewerPage = lazy(() => import("./pages/StoryPointViewerPage"));
const TimedTestPage = lazy(() => import("./pages/TimedTestPage"));
const PracticeModePage = lazy(() => import("./pages/PracticeModePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const StoreListPage = lazy(() => import("./pages/StoreListPage"));
const StoreDetailPage = lazy(() => import("./pages/StoreDetailPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ConsumerProfilePage = lazy(() => import("./pages/ConsumerProfilePage"));
const ExamsPage = lazy(() => import("./pages/ExamsPage"));
const ExamPage = lazy(() => import("./pages/ExamPage"));
const ExamResultPage = lazy(() => import("./pages/ExamResultPage"));
const TestAnalyticsPage = lazy(() => import("./pages/TestAnalyticsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const currentTenantId = useAuthStore((s) => s.currentTenantId);
  const subscribeTenant = useTenantStore((s) => s.subscribe);
  const resetTenant = useTenantStore((s) => s.reset);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  useEffect(() => {
    if (currentTenantId) {
      const unsubscribe = subscribeTenant(currentTenantId);
      return unsubscribe;
    }
    resetTenant();
  }, [currentTenantId, subscribeTenant, resetTenant]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        {/* Student routes (B2B school context) */}
        <Route element={<RequireAuth allowedRoles={["student"]} />}>
          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={
                <RouteErrorBoundary>
                  <DashboardPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/spaces"
              element={
                <RouteErrorBoundary>
                  <SpacesListPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/spaces/:spaceId"
              element={
                <RouteErrorBoundary>
                  <SpaceViewerPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/spaces/:spaceId/modules/:storyPointId"
              element={
                <RouteErrorBoundary>
                  <StoryPointViewerPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/spaces/:spaceId/story-points/:storyPointId"
              element={
                <RouteErrorBoundary>
                  <StoryPointViewerPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/spaces/:spaceId/test/:storyPointId"
              element={
                <RouteErrorBoundary>
                  <TimedTestPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/spaces/:spaceId/test/:storyPointId/analytics"
              element={
                <RouteErrorBoundary>
                  <TestAnalyticsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/spaces/:spaceId/practice/:storyPointId"
              element={
                <RouteErrorBoundary>
                  <PracticeModePage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/exams"
              element={
                <RouteErrorBoundary>
                  <ExamsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/exams/:examId"
              element={
                <RouteErrorBoundary>
                  <ExamPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/exams/:examId/results"
              element={
                <RouteErrorBoundary>
                  <ExamResultPage />
                </RouteErrorBoundary>
              }
            />
            <Route path="/tests" element={<Navigate to="/spaces" replace />} />
            <Route path="/results" element={<Navigate to="/" replace />} />
            <Route path="/leaderboard" element={<Navigate to="/" replace />} />
            <Route path="/achievements" element={<Navigate to="/profile" replace />} />
            <Route
              path="/notifications"
              element={
                <RouteErrorBoundary>
                  <NotificationsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/settings"
              element={
                <RouteErrorBoundary>
                  <SettingsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/profile"
              element={
                <RouteErrorBoundary>
                  <ProfilePage />
                </RouteErrorBoundary>
              }
            />
          </Route>
        </Route>
        {/* Consumer routes (B2C — no tenant role needed) */}
        <Route element={<RequireAuth />}>
          <Route element={<ConsumerLayout />}>
            <Route
              path="/consumer"
              element={
                <RouteErrorBoundary>
                  <ConsumerDashboardPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/my-spaces"
              element={
                <RouteErrorBoundary>
                  <ConsumerDashboardPage />
                </RouteErrorBoundary>
              }
            />
            {/* Consumer space viewer routes — shared with B2B */}
            <Route
              path="/consumer/spaces/:spaceId"
              element={
                <RouteErrorBoundary>
                  <SpaceViewerPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/consumer/spaces/:spaceId/modules/:storyPointId"
              element={
                <RouteErrorBoundary>
                  <StoryPointViewerPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/consumer/spaces/:spaceId/story-points/:storyPointId"
              element={
                <RouteErrorBoundary>
                  <StoryPointViewerPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/consumer/spaces/:spaceId/test/:storyPointId"
              element={
                <RouteErrorBoundary>
                  <TimedTestPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/consumer/spaces/:spaceId/test/:storyPointId/analytics"
              element={
                <RouteErrorBoundary>
                  <TestAnalyticsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/consumer/spaces/:spaceId/practice/:storyPointId"
              element={
                <RouteErrorBoundary>
                  <PracticeModePage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/store"
              element={
                <RouteErrorBoundary>
                  <StoreListPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/store/checkout"
              element={
                <RouteErrorBoundary>
                  <CheckoutPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/store/:spaceId"
              element={
                <RouteErrorBoundary>
                  <StoreDetailPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/consumer/profile"
              element={
                <RouteErrorBoundary>
                  <ConsumerProfilePage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/consumer/notifications"
              element={
                <RouteErrorBoundary>
                  <NotificationsPage />
                </RouteErrorBoundary>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
