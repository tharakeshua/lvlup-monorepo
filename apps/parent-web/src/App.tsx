import { useEffect, lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuthStore, useTenantStore } from "@levelup/shared-stores";
import { NotFoundPage, PageLoader, RouteErrorBoundary } from "@levelup/shared-ui";
import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import RequireAuth from "./guards/RequireAuth";
import LoginPage from "./pages/LoginPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ChildrenPage = lazy(() => import("./pages/ChildrenPage"));
const ChildProgressPage = lazy(() => import("./pages/ChildProgressPage"));
const ExamResultsPage = lazy(() => import("./pages/ExamResultsPage"));
const SpaceProgressPage = lazy(() => import("./pages/SpaceProgressPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const PerformanceAlertsPage = lazy(() => import("./pages/PerformanceAlertsPage"));
const ChildComparisonPage = lazy(() => import("./pages/ChildComparisonPage"));

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
        <Route element={<RequireAuth allowedRoles={["parent"]} />}>
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
              path="/children"
              element={
                <RouteErrorBoundary>
                  <ChildrenPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/results"
              element={
                <RouteErrorBoundary>
                  <ExamResultsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/progress"
              element={
                <RouteErrorBoundary>
                  <SpaceProgressPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/child-progress"
              element={
                <RouteErrorBoundary>
                  <ChildProgressPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/alerts"
              element={
                <RouteErrorBoundary>
                  <PerformanceAlertsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/compare"
              element={
                <RouteErrorBoundary>
                  <ChildComparisonPage />
                </RouteErrorBoundary>
              }
            />
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
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
