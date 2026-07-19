import { useEffect, useMemo, useState } from "react";
import { useSpaceAnalytics, useSpaces, type GetSpaceAnalyticsResponse } from "@levelup/query";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Label,
  ProgressRing,
  ScoreCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@levelup/shared-ui";
import type { Space } from "@levelup/shared-types";

type StudentRow = GetSpaceAnalyticsResponse["students"][number];

const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return "0 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const formatActivity = (value: string | null): string => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const statusCopy: Record<StudentRow["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

function AnalyticsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading space analytics">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="border-error/40 bg-error-subtle rounded-lg border p-8 text-center">
      <AlertCircle className="text-error mx-auto h-9 w-9" aria-hidden />
      <h2 className="mt-3 font-semibold">Analytics could not be loaded</h2>
      <p className="text-muted-foreground mx-auto mt-1 max-w-xl text-sm">{message}</p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden /> Try again
      </Button>
    </div>
  );
}

function StudentProgressTable({ students }: { students: StudentRow[] }) {
  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Users className="text-muted-foreground mx-auto h-9 w-9" aria-hidden />
        <h3 className="mt-3 font-semibold">No learners assigned</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Assign this space to a class or wait for the first learner to enroll.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[880px] border-collapse text-left text-sm">
        <caption className="sr-only">
          Per-student completion and recorded engagement for the selected space
        </caption>
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Learner
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="w-52 px-4 py-3 font-medium">
              Completion
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Points
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Recorded time
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Attempts
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Last activity
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.map((student) => (
            <tr key={student.studentId} className="hover:bg-muted/30">
              <th scope="row" className="px-4 py-3 font-medium">
                {student.name}
                {student.classIds.length > 0 && (
                  <span className="text-muted-foreground mt-0.5 block font-mono text-xs">
                    {student.classIds.join(", ")}
                  </span>
                )}
              </th>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={
                    student.status === "completed"
                      ? "border-success/40 bg-success-subtle text-success"
                      : student.status === "in_progress"
                        ? "border-info/40 bg-info-subtle text-info"
                        : "text-muted-foreground"
                  }
                >
                  {statusCopy[student.status]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <progress
                    max={100}
                    value={student.completionPct}
                    aria-label={`${student.name} completion`}
                    className="h-2 flex-1 accent-[hsl(var(--brand))]"
                  />
                  <span className="w-12 text-right font-mono tabular-nums">
                    {Math.round(student.completionPct)}%
                  </span>
                </div>
                {student.totalItems > 0 && (
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {student.completedItems} of {student.totalItems} items
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-mono tabular-nums">
                {student.totalPoints > 0 ? `${student.pointsEarned}/${student.totalPoints}` : "—"}
              </td>
              <td className="px-4 py-3">{formatDuration(student.timeSpentSeconds)}</td>
              <td className="px-4 py-3 font-mono tabular-nums">{student.attempts}</td>
              <td className="text-muted-foreground px-4 py-3">
                {formatActivity(student.lastActivityAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SpaceAnalyticsPage() {
  const {
    data: spacesPage,
    isLoading: spacesLoading,
    isError: spacesFailed,
    error: spacesError,
    refetch: refetchSpaces,
  } = useSpaces<{ items: Space[] }>({ status: "published" });
  const spaces = useMemo(() => spacesPage?.items ?? [], [spacesPage?.items]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const activeSpaceId = selectedSpaceId || spaces[0]?.id || "";
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isFetching,
    isError: analyticsFailed,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useSpaceAnalytics(activeSpaceId);

  useEffect(() => {
    if (selectedSpaceId && !spaces.some((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId("");
    }
  }, [selectedSpaceId, spaces]);

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Space Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Canonical completion and recorded engagement from learner progress.
          </p>
        </div>
        <div className="w-full space-y-1.5 sm:w-64">
          <Label htmlFor="space-analytics-select">Published space</Label>
          <Select
            value={activeSpaceId || "__none__"}
            onValueChange={(value) => setSelectedSpaceId(value === "__none__" ? "" : value)}
            disabled={spacesLoading || spaces.length === 0}
          >
            <SelectTrigger id="space-analytics-select" className="w-full">
              <SelectValue placeholder="Select a space" />
            </SelectTrigger>
            <SelectContent>
              {spaces.length === 0 && (
                <SelectItem value="__none__" disabled>
                  No published spaces
                </SelectItem>
              )}
              {spaces.map((space) => (
                <SelectItem key={space.id} value={space.id}>
                  {space.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {spacesLoading ? (
        <AnalyticsLoading />
      ) : spacesFailed ? (
        <ErrorState
          message={spacesError instanceof Error ? spacesError.message : "Unable to list spaces."}
          onRetry={() => void refetchSpaces()}
        />
      ) : !activeSpace ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="text-muted-foreground mx-auto h-10 w-10" aria-hidden />
          <h2 className="mt-3 font-semibold">No published spaces yet</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Publish a space to begin collecting completion and engagement analytics.
          </p>
        </div>
      ) : analyticsLoading ? (
        <AnalyticsLoading />
      ) : analyticsFailed || !analytics ? (
        <ErrorState
          message={
            analyticsError instanceof Error
              ? analyticsError.message
              : "The canonical progress summary is unavailable."
          }
          onRetry={() => void refetchAnalytics()}
        />
      ) : (
        <>
          <section aria-label="Space summary" className="grid gap-4 md:grid-cols-4">
            <ScoreCard
              label="Assigned Learners"
              value={analytics.summary.totalStudents}
              icon={Users}
            />
            <ScoreCard
              label="Average Completion"
              value={`${Math.round(analytics.summary.avgCompletionPct)}%`}
              icon={CheckCircle2}
            />
            <ScoreCard
              label="Active · 7 days"
              value={analytics.summary.activeStudents7d}
              icon={Activity}
            />
            <ScoreCard
              label="Total Attempts"
              value={analytics.summary.totalAttempts}
              icon={BarChart3}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="bg-card border-subtle shadow-e1 space-y-4 rounded-lg border p-5">
              <h2 className="font-semibold">Completion Overview</h2>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <ProgressRing value={analytics.summary.avgCompletionPct} label="Avg completion" />
                <dl className="grid flex-1 grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Started</dt>
                    <dd className="mt-0.5 font-mono text-lg font-semibold">
                      {analytics.summary.startedStudents}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd className="mt-0.5 font-mono text-lg font-semibold">
                      {analytics.summary.completedStudents}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Space</dt>
                    <dd className="mt-0.5 font-medium">{activeSpace.title}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="bg-card border-subtle shadow-e1 space-y-4 rounded-lg border p-5">
              <h2 className="font-semibold">Recorded Engagement</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4" aria-hidden /> Avg time
                  </dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {formatDuration(analytics.summary.avgTimeSpentSeconds)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-4 w-4" aria-hidden /> Active recently
                  </dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {analytics.summary.activeStudents7d}
                    <span className="text-muted-foreground ml-1 text-sm font-normal">
                      / {analytics.summary.totalStudents}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="text-muted-foreground text-xs">
                Time and attempts include only activity recorded by canonical progress writers.
                Updated {formatActivity(analytics.generatedAt)}.
              </p>
            </div>
          </section>

          <section aria-labelledby="student-progress-title" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="student-progress-title" className="font-semibold">
                  Learner Progress
                </h2>
                <p className="text-muted-foreground text-sm">
                  Completion, points, time, attempts, and last recorded activity.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetchAnalytics()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin motion-reduce:animate-none" : ""}`}
                  aria-hidden
                />
                Refresh
              </Button>
            </div>
            <StudentProgressTable students={analytics.students} />
          </section>
        </>
      )}
    </main>
  );
}
