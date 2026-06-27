import { Link } from "react-router-dom";
import { useCurrentUser, useCurrentMembership, useCurrentTenantId } from "@levelup/shared-stores";
import { useChildSummary, useLinkedChildren } from "@levelup/query";
import type { StudentId } from "@levelup/domain";
import {
  ScoreCard,
  ProgressRing,
  AtRiskBadge,
  Badge,
  Skeleton,
  FadeIn,
  AnimatedList,
  AnimatedListItem,
  EmptyState,
} from "@levelup/shared-ui";
import type { UserMembership, StudentProgressSummary } from "@levelup/shared-types";
import {
  Users,
  ClipboardList,
  BookOpen,
  Flame,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { useLinkedStudents } from "../hooks/useLinkedStudents";
import { useStudentNames } from "../hooks/useStudentNames";
import { getInitials, getStudentDisplayName } from "../lib/helpers";

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DataFreshnessIndicator({
  dataUpdatedAt,
  onRefresh,
}: {
  dataUpdatedAt: number | undefined;
  onRefresh?: () => void;
}) {
  if (!dataUpdatedAt) return null;
  const seconds = Math.floor((Date.now() - dataUpdatedAt) / 1000);
  let timeAgo = "just now";
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      timeAgo = hours >= 24 ? `${Math.floor(hours / 24)}d ago` : `${hours}h ago`;
    } else {
      timeAgo = `${minutes}m ago`;
    }
  }

  return (
    <div className="text-muted-foreground flex items-center gap-1.5 text-xs" aria-live="polite">
      <span>Updated {timeAgo}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="hover:bg-muted rounded p-0.5"
          aria-label="Refresh data"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const membership = useCurrentMembership();
  const tenantId = useCurrentTenantId();
  const { data: linkedStudents, isLoading } = useLinkedStudents(tenantId, user?.uid ?? null);

  const studentIds = linkedStudents?.map((s) => s.uid) ?? [];
  const { data: studentNames } = useStudentNames(tenantId, studentIds);

  // Aggregates come from the batched parent-dashboard read (one round-trip;
  // carries overallScore + isAtRisk per linked child). Per-child card detail is
  // fetched by <ChildSummaryCard> below.
  const linkedChildrenQuery = useLinkedChildren();
  const childRows = (linkedChildrenQuery.data?.items ?? []) as Array<{
    isAtRisk?: boolean;
    overallScore?: number;
  }>;

  const atRiskCount = childRows.filter((c) => c.isAtRisk).length;
  const avgScore =
    childRows.length > 0
      ? childRows.reduce((sum, c) => sum + (c.overallScore ?? 0), 0) / childRows.length
      : 0;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Parent Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Welcome back, {user?.displayName || user?.email || "Parent"}
            </p>
          </div>
          <DataFreshnessIndicator
            dataUpdatedAt={linkedChildrenQuery.dataUpdatedAt}
            onRefresh={() => {
              void linkedChildrenQuery.refetch();
            }}
          />
        </div>
      </FadeIn>

      {/* Overview Cards */}
      <FadeIn delay={0.1}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreCard label="Children" value={linkedStudents?.length ?? 0} icon={Users} />
          <ScoreCard
            label="Avg Performance"
            value={summaries.length > 0 ? `${Math.round(avgScore * 100)}%` : "--"}
            icon={TrendingUp}
          />
          <ScoreCard label="School" value={membership?.tenantCode || "--"} icon={BookOpen} />
          {atRiskCount > 0 ? (
            <ScoreCard
              label="At-Risk Alerts"
              value={atRiskCount}
              icon={AlertTriangle}
              trend="down"
              trendValue="Needs attention"
            />
          ) : (
            <ScoreCard
              label="Status"
              value="All Good"
              icon={Users}
              trend="up"
              trendValue="Children on track"
            />
          )}
        </div>
      </FadeIn>

      {/* Quick Actions */}
      <FadeIn delay={0.15}>
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            to="/results"
            className="bg-card flex items-center gap-3 rounded-lg border p-4 transition-shadow hover:shadow-sm"
          >
            <ClipboardList className="text-info h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Exam Results</p>
              <p className="text-muted-foreground text-xs">View released grades</p>
            </div>
            <ArrowRight className="text-muted-foreground h-4 w-4" />
          </Link>
          <Link
            to="/progress"
            className="bg-card flex items-center gap-3 rounded-lg border p-4 transition-shadow hover:shadow-sm"
          >
            <BookOpen className="text-success h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Space Progress</p>
              <p className="text-muted-foreground text-xs">Track learning activity</p>
            </div>
            <ArrowRight className="text-muted-foreground h-4 w-4" />
          </Link>
          <Link
            to="/children"
            className="bg-card flex items-center gap-3 rounded-lg border p-4 transition-shadow hover:shadow-sm"
          >
            <Users className="text-primary h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-medium">My Children</p>
              <p className="text-muted-foreground text-xs">Enrollment details</p>
            </div>
            <ArrowRight className="text-muted-foreground h-4 w-4" />
          </Link>
        </div>
      </FadeIn>

      {/* Children List with Summaries */}
      <FadeIn delay={0.2}>
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-5 w-5" />
              <h2 className="text-lg font-semibold">Children Overview</h2>
            </div>
            <Link
              to="/children"
              className="text-primary flex items-center gap-1 text-sm hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {isLoading ? (
            <div role="status" aria-label="Loading content">
              <DashboardSkeleton />
              <span className="sr-only">Loading...</span>
            </div>
          ) : !linkedStudents?.length ? (
            <EmptyState
              icon={Users}
              title="No linked children"
              description="Your children will appear here once they are linked to your account by the school admin."
            />
          ) : (
            <AnimatedList className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {linkedStudents.map((student: UserMembership, idx: number) => (
                <ChildSummaryCard
                  key={student.id}
                  student={student}
                  displayName={getStudentDisplayName(studentNames, student, idx)}
                />
              ))}
            </AnimatedList>
          )}
        </div>
      </FadeIn>
    </div>
  );
}

function ChildSummaryCard({
  student,
  displayName,
}: {
  student: UserMembership;
  displayName: string;
}) {
  const { data: childSummary } = useChildSummary(student.uid as StudentId);
  const summary = childSummary?.studentSummary as StudentProgressSummary | undefined;

  return (
    <AnimatedListItem key={student.id}>
      <div
        className="bg-card space-y-3 rounded-lg border p-4 transition-shadow hover:shadow-sm"
        role="article"
        aria-label={`${displayName}: ${summary ? `${Math.round(summary.overallScore * 100)}% overall${summary.isAtRisk ? ", at-risk" : ""}` : "no data yet"}`}
      >
        {/* Student header */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full font-semibold">
            {getInitials(displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{displayName}</p>
            <div className="flex items-center gap-2">
              <Badge variant={student.status === "active" ? "default" : "secondary"}>
                {student.status}
              </Badge>
              {summary && (
                <AtRiskBadge isAtRisk={summary.isAtRisk} reasons={summary.atRiskReasons} />
              )}
            </div>
          </div>
        </div>

        {/* Summary data */}
        {summary ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div
                role="img"
                aria-label={`Overall score: ${Math.round(summary.overallScore * 100)}%`}
              >
                <ProgressRing
                  value={summary.overallScore * 100}
                  size={60}
                  strokeWidth={6}
                  label="Overall"
                />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-1">
                  <ClipboardList className="text-muted-foreground h-3 w-3" />
                  <span className="text-muted-foreground">Exams:</span>
                  <span className="font-medium">
                    {Math.round(summary.autograde.averagePercentage)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="text-muted-foreground h-3 w-3" />
                  <span className="text-muted-foreground">Spaces:</span>
                  <span className="font-medium">
                    {Math.round(summary.levelup.averageCompletion)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="text-muted-foreground h-3 w-3" />
                  <span className="text-muted-foreground">Streak:</span>
                  <span className="font-medium">{summary.levelup.streakDays}d</span>
                </div>
              </div>
            </div>

            {/* Recent exam results */}
            {summary.autograde.recentExams.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Latest Exam Results</p>
                <div className="space-y-1">
                  {summary.autograde.recentExams.slice(0, 2).map((e) => (
                    <div key={e.examId} className="flex items-center justify-between text-xs">
                      <span className="max-w-[140px] truncate">{e.examTitle}</span>
                      <span
                        className={`font-medium ${
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
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">No progress data available yet.</p>
        )}

        {/* View Details link */}
        <Link
          to={`/child-progress?student=${student.uid}`}
          className="text-primary flex items-center gap-1 pt-1 text-xs hover:underline"
        >
          View details <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </AnimatedListItem>
  );
}
