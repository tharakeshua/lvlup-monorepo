import { useEffect, lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { NotFoundPage, PageLoader, RouteErrorBoundary } from "@levelup/shared-ui";
import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import RequireAuth from "./guards/RequireAuth";

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TenantsPage = lazy(() => import("./pages/TenantsPage"));
const TenantDetailPage = lazy(() => import("./pages/TenantDetailPage"));
const GlobalPresetsPage = lazy(() => import("./pages/GlobalPresetsPage"));
const SystemHealthPage = lazy(() => import("./pages/SystemHealthPage"));
const UserAnalyticsPage = lazy(() => import("./pages/UserAnalyticsPage"));
const FeatureFlagsPage = lazy(() => import("./pages/FeatureFlagsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const LLMUsagePage = lazy(() => import("./pages/LLMUsagePage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const GlobalUsersPage = lazy(() => import("./pages/GlobalUsersPage"));

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<RequireAuth />}>
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
              path="/tenants"
              element={
                <RouteErrorBoundary>
                  <TenantsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/tenants/:tenantId"
              element={
                <RouteErrorBoundary>
                  <TenantDetailPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/analytics"
              element={
                <RouteErrorBoundary>
                  <UserAnalyticsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/feature-flags"
              element={
                <RouteErrorBoundary>
                  <FeatureFlagsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/presets"
              element={
                <RouteErrorBoundary>
                  <GlobalPresetsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/llm-usage"
              element={
                <RouteErrorBoundary>
                  <LLMUsagePage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/system"
              element={
                <RouteErrorBoundary>
                  <SystemHealthPage />
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
              path="/announcements"
              element={
                <RouteErrorBoundary>
                  <AnnouncementsPage />
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/users"
              element={
                <RouteErrorBoundary>
                  <GlobalUsersPage />
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
