import { useMemo } from "react";
import { useCurrentUser, useCurrentTenantId } from "@levelup/shared-stores";
import { useLinkedStudents } from "../hooks/useLinkedStudents";
import { useStudentNames } from "../hooks/useStudentNames";
import { useChildSubmissions } from "../hooks/useChildSubmissions";
import { useChildSummary } from "@levelup/query";
import type { StudentId } from "@levelup/domain";
import type { StudentProgressSummary } from "@levelup/shared-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  AtRiskBadge,
  Skeleton,
  FadeIn,
  EmptyState,
} from "@levelup/shared-ui";
import { AlertTriangle, TrendingDown, Clock, CheckCircle2, ClipboardList } from "lucide-react";

export default function PerformanceAlertsPage() {
  const tenantId = useCurrentTenantId();
  const user = useCurrentUser();
  const parentId = user?.uid ?? null;

  const { data: linkedStudents, isLoading: studentsLoading } = useLinkedStudents(
    tenantId,
    parentId
  );
  const studentUids = useMemo(() => linkedStudents?.map((s) => s.uid) ?? [], [linkedStudents]);
  const { data: studentNames } = useStudentNames(tenantId, studentUids);
  const { data: submissions } = useChildSubmissions(tenantId, studentUids);

  if (studentsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Performance Alerts</h1>
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden="true" />
            Performance Alerts
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track alerts and performance issues across all your children
          </p>
        </div>
      </FadeIn>

      {/* Per-child alerts */}
      {studentUids.map((uid) => (
        <ChildAlertSection
          key={uid}
          tenantId={tenantId}
          studentId={uid}
          studentName={studentNames?.[uid] ?? "Student"}
          submissions={submissions?.filter((s) => s.studentId === uid) ?? []}
        />
      ))}

      {studentUids.length === 0 && (
        <EmptyState
          icon={CheckCircle2}
          title="No children linked"
          description="Your children will appear here once they are linked to your account by the school admin."
        />
      )}
    </div>
  );
}

function ChildAlertSection({
  tenantId: _tenantId,
  studentId,
  studentName,
  submissions,
}: {
  tenantId: string | null;
  studentId: string;
  studentName: string;
  submissions: Array<{
    examTitle?: string;
    summary?: { percentage?: number; totalScore?: number; maxScore?: number };
  }>;
}) {
  const { data: childSummary } = useChildSummary(studentId as StudentId);
  const summary = childSummary?.studentSummary as StudentProgressSummary | undefined;

  // Derive alerts
  const alerts: Array<{
    type: "danger" | "warning" | "info";
    icon: React.ElementType;
    message: string;
  }> = [];

  if (summary?.isAtRisk) {
    for (const reason of summary.atRiskReasons ?? []) {
      alerts.push({ type: "danger", icon: AlertTriangle, message: reason });
    }
  }

  // Low exam scores
  const lowScoreExams = submissions.filter((s) => (s.summary?.percentage ?? 0) < 40);
  for (const exam of lowScoreExams.slice(0, 3)) {
    alerts.push({
      type: "warning",
      icon: TrendingDown,
      message: `Scored ${Math.round(exam.summary?.percentage ?? 0)}% on ${exam.examTitle ?? "an exam"}`,
    });
  }

  // Low streak
  if (summary && summary.levelup.streakDays === 0) {
    alerts.push({
      type: "info",
      icon: Clock,
      message: "No learning activity recorded recently. Encourage daily practice!",
    });
  }

  // Low space completion
  if (summary && summary.levelup.averageCompletion < 20 && summary.levelup.totalSpaces > 0) {
    alerts.push({
      type: "warning",
      icon: ClipboardList,
      message: `Only ${Math.round(summary.levelup.averageCompletion)}% average space completion`,
    });
  }

  const typeStyles = {
    danger: "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20",
    warning: "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
    info: "border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20",
  };

  const iconStyles = {
    danger: "text-red-600",
    warning: "text-amber-600",
    info: "text-blue-600",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{studentName}</CardTitle>
          {summary && <AtRiskBadge isAtRisk={summary.isAtRisk} reasons={summary.atRiskReasons} />}
        </div>
        {summary && (
          <div className="text-muted-foreground flex gap-4 text-xs">
            <span>Score: {Math.round(summary.overallScore * 100)}%</span>
            <span>Streak: {summary.levelup.streakDays}d</span>
            <span>Exams: {summary.autograde.completedExams}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            No alerts — everything looks good!
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, i) => {
              const Icon = alert.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-md border p-3 ${typeStyles[alert.type]}`}
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${iconStyles[alert.type]}`}
                    aria-hidden="true"
                  />
                  <p className="text-sm">{alert.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
