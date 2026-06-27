import { Link } from "react-router-dom";
import { useCurrentUser, useCurrentTenantId } from "@levelup/shared-stores";
import { useChildSummary } from "@levelup/query";
import type { StudentId } from "@levelup/domain";
import {
  ProgressRing,
  AtRiskBadge,
  Badge,
  Card,
  CardContent,
  Skeleton,
  EmptyState,
} from "@levelup/shared-ui";
import type { UserMembership, StudentProgressSummary } from "@levelup/shared-types";
import { Users, BookOpen, ClipboardList, Flame, ArrowRight } from "lucide-react";
import { useLinkedStudents } from "../hooks/useLinkedStudents";
import { useStudentNames } from "../hooks/useStudentNames";
import { getInitials, getStudentDisplayName } from "../lib/helpers";

function ChildrenSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading content">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-lg border p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default function ChildrenPage() {
  const user = useCurrentUser();
  const tenantId = useCurrentTenantId();
  const { data: linkedStudents, isLoading } = useLinkedStudents(tenantId, user?.uid ?? null);

  const studentIds = linkedStudents?.map((s) => s.uid) ?? [];
  const { data: studentNames } = useStudentNames(tenantId, studentIds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Children</h1>
        <p className="text-muted-foreground text-sm">
          View detailed information about your children's enrollment and progress
        </p>
      </div>

      {isLoading ? (
        <ChildrenSkeleton />
      ) : !linkedStudents?.length ? (
        <EmptyState
          icon={Users}
          title="No children linked"
          description="Contact your school admin to link your children to your account."
        />
      ) : (
        <div className="space-y-4">
          {linkedStudents.map((student: UserMembership, idx: number) => (
            <ChildCard
              key={student.id}
              student={student}
              displayName={getStudentDisplayName(studentNames, student, idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildCard({ student, displayName }: { student: UserMembership; displayName: string }) {
  const { data: childSummary } = useChildSummary(student.uid as StudentId);
  const summary = childSummary?.studentSummary as StudentProgressSummary | undefined;

  return (
    <Card key={student.id}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold">
              {getInitials(displayName)}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{displayName}</h3>
              <div className="mt-0.5 flex items-center gap-2">
                <Badge variant={student.status === "active" ? "default" : "secondary"}>
                  {student.status}
                </Badge>
                {summary && (
                  <AtRiskBadge isAtRisk={summary.isAtRisk} reasons={summary.atRiskReasons} />
                )}
              </div>
            </div>
          </div>
          {summary && (
            <div
              role="img"
              aria-label={`Overall score: ${Math.round(summary.overallScore * 100)}%`}
            >
              <ProgressRing
                value={summary.overallScore * 100}
                size={56}
                strokeWidth={5}
                label="Overall"
              />
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Exam Average</span>
            </div>
            <p className="mt-1 text-lg font-semibold">
              {summary ? `${Math.round(summary.autograde.averagePercentage)}%` : "--"}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Space Completion</span>
            </div>
            <p className="mt-1 text-lg font-semibold">
              {summary ? `${Math.round(summary.levelup.averageCompletion)}%` : "--"}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Flame className="h-3.5 w-3.5" />
              <span>Streak</span>
            </div>
            <p className="mt-1 text-lg font-semibold">
              {summary ? `${summary.levelup.streakDays} days` : "--"}
            </p>
          </div>
        </div>

        {/* Recent exam results */}
        {summary && summary.autograde.recentExams.length > 0 && (
          <div className="mt-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">Latest Exam Results</p>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {summary.autograde.recentExams.slice(0, 3).map((e) => (
                <div
                  key={e.examId}
                  className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2"
                >
                  <span className="max-w-[160px] truncate text-sm">{e.examTitle}</span>
                  <span
                    className={`text-sm font-medium ${
                      e.percentage >= 70
                        ? "text-success"
                        : e.percentage >= 40
                          ? "text-warning"
                          : "text-destructive"
                    }`}
                  >
                    {Math.round(e.percentage)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <Link
            to={`/child-progress?student=${student.uid}`}
            className="hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium"
          >
            View Full Progress <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            to={`/results?student=${student.uid}`}
            className="hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium"
          >
            Exam Results <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
