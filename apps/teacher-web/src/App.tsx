import { useEffect, lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuthStore, useTenantStore } from "@levelup/shared-stores";
import { PageLoader, RouteErrorBoundary } from "@levelup/shared-ui";
import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import RequireAuth from "./guards/RequireAuth";
import LoginPage from "./pages/LoginPage";

// Lazy-loaded pages
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SpaceListPage = lazy(() => import("./pages/spaces/SpaceListPage"));
const SpaceEditorPage = lazy(() => import("./pages/spaces/SpaceEditorPage"));
const ExamListPage = lazy(() => import("./pages/exams/ExamListPage"));
const ExamCreatePage = lazy(() => import("./pages/exams/ExamCreatePage"));
const ExamDetailPage = lazy(() => import("./pages/exams/ExamDetailPage"));
const SubmissionsPage = lazy(() => import("./pages/exams/SubmissionsPage"));
const GradingReviewPage = lazy(() => import("./pages/exams/GradingReviewPage"));
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const ClassAnalyticsPage = lazy(() => import("./pages/ClassAnalyticsPage"));
const ExamAnalyticsPage = lazy(() => import("./pages/ExamAnalyticsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ClassDetailPage = lazy(() => import("./pages/ClassDetailPage"));
const ClassesPage = lazy(() => import("./pages/ClassesPage"));
const SpaceAnalyticsPage = lazy(() => import("./pages/SpaceAnalyticsPage"));
const QuestionBankPage = lazy(() => import("./pages/spaces/QuestionBankPage"));
const AssignmentTrackerPage = lazy(() => import("./pages/AssignmentTrackerPage"));
const StudentReportPage = lazy(() => import("./pages/StudentReportPage"));
const ClassTestAnalyticsPage = lazy(() => import("./pages/ClassTestAnalyticsPage"));
const RubricPresetsPage = lazy(() => import("./pages/RubricPresetsPage"));
const TestPreviewPage = lazy(() => import("./pages/TestPreviewPage"));
const BatchGradingPage = lazy(() => import("./pages/BatchGradingPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

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
        <Route element={<RequireAuth allowedRoles={["teacher", "tenantAdmin"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<RouteErrorBoundary><DashboardPage /></RouteErrorBoundary>} />
            {/* Spaces */}
            <Route path="/spaces" element={<RouteErrorBoundary><SpaceListPage /></RouteErrorBoundary>} />
            <Route path="/spaces/:spaceId/edit" element={<RouteErrorBoundary><SpaceEditorPage /></RouteErrorBoundary>} />
            <Route path="/spaces/:spaceId/story-points/:storyPointId/preview" element={<RouteErrorBoundary><TestPreviewPage /></RouteErrorBoundary>} />
            <Route path="/question-bank" element={<RouteErrorBoundary><QuestionBankPage /></RouteErrorBoundary>} />
            <Route path="/rubric-presets" element={<RouteErrorBoundary><RubricPresetsPage /></RouteErrorBoundary>} />
            {/* Exams */}
            <Route path="/exams" element={<RouteErrorBoundary><ExamListPage /></RouteErrorBoundary>} />
            <Route path="/exams/new" element={<RouteErrorBoundary><ExamCreatePage /></RouteErrorBoundary>} />
            <Route path="/exams/:examId" element={<RouteErrorBoundary><ExamDetailPage /></RouteErrorBoundary>} />
            <Route path="/exams/:examId/submissions" element={<RouteErrorBoundary><SubmissionsPage /></RouteErrorBoundary>} />
            <Route path="/exams/:examId/submissions/:submissionId" element={<RouteErrorBoundary><GradingReviewPage /></RouteErrorBoundary>} />
            {/* Classes */}
            <Route path="/classes" element={<RouteErrorBoundary><ClassesPage /></RouteErrorBoundary>} />
            <Route path="/classes/:classId" element={<RouteErrorBoundary><ClassDetailPage /></RouteErrorBoundary>} />
            {/* Analytics */}
            <Route path="/analytics/classes" element={<RouteErrorBoundary><ClassAnalyticsPage /></RouteErrorBoundary>} />
            <Route path="/analytics/exams" element={<RouteErrorBoundary><ExamAnalyticsPage /></RouteErrorBoundary>} />
            <Route path="/analytics/spaces" element={<RouteErrorBoundary><SpaceAnalyticsPage /></RouteErrorBoundary>} />
            <Route path="/analytics/tests" element={<RouteErrorBoundary><ClassTestAnalyticsPage /></RouteErrorBoundary>} />
            {/* Assignments */}
            <Route path="/assignments" element={<RouteErrorBoundary><AssignmentTrackerPage /></RouteErrorBoundary>} />
            {/* Batch Grading */}
            <Route path="/grading" element={<RouteErrorBoundary><BatchGradingPage /></RouteErrorBoundary>} />
            {/* Students */}
            <Route path="/students" element={<RouteErrorBoundary><StudentsPage /></RouteErrorBoundary>} />
            <Route path="/students/:studentId/report" element={<RouteErrorBoundary><StudentReportPage /></RouteErrorBoundary>} />
            <Route path="/settings" element={<RouteErrorBoundary><SettingsPage /></RouteErrorBoundary>} />
            <Route path="/notifications" element={<RouteErrorBoundary><NotificationsPage /></RouteErrorBoundary>} />
            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
