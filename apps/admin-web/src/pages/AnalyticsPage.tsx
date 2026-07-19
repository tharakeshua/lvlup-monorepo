import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useClasses, useStudents, useApi, analyticsQueryKeys } from "@levelup/query";
import type { Class, Student, ClassProgressSummary } from "@levelup/shared-types";
import { ScoreCard, SimpleBarChart, ProgressRing } from "@levelup/shared-ui";
import { BarChart3, Users, AlertTriangle, TrendingUp, GraduationCap } from "lucide-react";
import { pageItems } from "@/lib/utils";

/**
 * Per-class progress summaries via the query SDK (tenant-implicit / claims-scoped).
 * `useClassSummary` is single-class; this fans it out over the class ids with
 * `useQueries` (rules-of-hooks-safe for a dynamic list), mirroring the legacy
 * `useClassSummaries`.
 */
function useClassSummaries(classIds: string[]) {
  const { repos } = useApi();
  const summaryRepo = (
    repos as unknown as {
      summaryRepo: { getClass(classId: string): Promise<ClassProgressSummary> };
    }
  ).summaryRepo;
  return useQueries({
    queries: classIds.map((classId) => ({
      queryKey: analyticsQueryKeys.classSummary(classId),
      queryFn: () => summaryRepo.getClass(classId),
    })),
  });
}

export default function AnalyticsPage() {
  const classes = pageItems<Class>(useClasses({}).data);
  const students = pageItems<Student>(useStudents({}).data);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const classIds = classes.map((c) => c.id);
  const classSummaryResults = useClassSummaries(classIds);
  const classSummaries = classSummaryResults.map((r) => r.data).filter(Boolean);

  const totalAtRisk = classSummaries.reduce((sum, cs) => sum + (cs?.atRiskCount ?? 0), 0);

  const avgClassScore =
    classSummaries.length > 0
      ? classSummaries.reduce((sum, cs) => sum + (cs?.autograde.averageClassScore ?? 0), 0) /
        classSummaries.length
      : 0;

  const avgCompletion =
    classSummaries.length > 0
      ? classSummaries.reduce((sum, cs) => sum + (cs?.levelup.averageClassCompletion ?? 0), 0) /
        classSummaries.length
      : 0;

  // Class performance comparison chart
  const classPerformanceData = classSummaries
    .filter((cs) => cs != null)
    .map((cs) => ({
      label: cs!.className || cs!.classId.slice(0, 8),
      value: Math.round((cs!.autograde.averageClassScore ?? 0) * 100),
    }))
    .sort((a, b) => b.value - a.value);

  // Class completion chart
  const classCompletionData = classSummaries
    .filter((cs) => cs != null)
    .map((cs) => ({
      label: cs!.className || cs!.classId.slice(0, 8),
      value: Math.round(cs!.levelup.averageClassCompletion ?? 0),
      color: "hsl(var(--primary))",
    }))
    .sort((a, b) => b.value - a.value);

  // At-risk students by class — theme-aware color
  const atRiskByClass = classSummaries
    .filter((cs) => cs != null && cs.atRiskCount > 0)
    .map((cs) => ({
      label: cs!.className || cs!.classId.slice(0, 8),
      value: cs!.atRiskCount,
      color: "hsl(var(--destructive))",
    }))
    .sort((a, b) => b.value - a.value);

  const selectedSummary = selectedClassId
    ? classSummaries.find((cs) => cs?.classId === selectedClassId)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Student performance, class comparisons, and at-risk indicators
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ScoreCard
          label="Avg Exam Score"
          value={`${Math.round(avgClassScore * 100)}%`}
          icon={BarChart3}
        />
        <ScoreCard
          label="Avg Space Completion"
          value={`${Math.round(avgCompletion)}%`}
          icon={TrendingUp}
        />
        <ScoreCard
          label="At-Risk Students"
          value={totalAtRisk}
          icon={AlertTriangle}
          trend={totalAtRisk > 0 ? "down" : "neutral"}
          trendValue={totalAtRisk > 0 ? "Needs attention" : "All good"}
        />
        <ScoreCard label="Total Students" value={students.length} icon={Users} />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Exam Performance by Class */}
        {classPerformanceData.length > 0 && (
          <div className="bg-card rounded-lg border p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="text-muted-foreground h-4 w-4" />
              <h2 className="font-semibold">Exam Performance by Class</h2>
            </div>
            <div role="img" aria-label="Bar chart comparing exam performance across classes">
              <SimpleBarChart
                data={classPerformanceData}
                maxValue={100}
                height={220}
                valueFormatter={(v) => `${v}%`}
              />
            </div>
          </div>
        )}

        {/* Space Completion by Class */}
        {classCompletionData.length > 0 && (
          <div className="bg-card rounded-lg border p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="text-muted-foreground h-4 w-4" />
              <h2 className="font-semibold">Space Completion by Class</h2>
            </div>
            <div role="img" aria-label="Bar chart comparing space completion rates across classes">
              <SimpleBarChart
                data={classCompletionData}
                maxValue={100}
                height={220}
                valueFormatter={(v) => `${v}%`}
              />
            </div>
          </div>
        )}
      </div>

      {/* At-Risk Distribution */}
      {atRiskByClass.length > 0 && (
        <div className="bg-card rounded-lg border p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="text-destructive h-4 w-4" />
            <h2 className="font-semibold">At-Risk Students by Class</h2>
          </div>
          <div role="img" aria-label="Bar chart showing at-risk student counts by class">
            <SimpleBarChart data={atRiskByClass} height={180} />
          </div>
        </div>
      )}

      {/* Class Drill-Down */}
      <div className="bg-card rounded-lg border p-5">
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="text-muted-foreground h-4 w-4" />
          <h2 className="font-semibold">Class Detail</h2>
        </div>

        {/* Class selector */}
        <div className="mb-4 flex flex-wrap gap-2">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(selectedClassId === cls.id ? null : cls.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedClassId === cls.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cls.name}
            </button>
          ))}
        </div>

        {selectedSummary ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div
                  role="img"
                  aria-label={`Exam average score: ${Math.round((selectedSummary.autograde.averageClassScore ?? 0) * 100)}%`}
                >
                  <ProgressRing
                    value={(selectedSummary.autograde.averageClassScore ?? 0) * 100}
                    size={64}
                    strokeWidth={6}
                    label="Exam Avg"
                  />
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-muted-foreground text-sm">Students</p>
                <p className="text-2xl font-bold">{selectedSummary.studentCount}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-muted-foreground text-sm">At-Risk</p>
                <p className="text-destructive text-2xl font-bold">{selectedSummary.atRiskCount}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-muted-foreground text-sm">Completion Rate</p>
                <p className="text-2xl font-bold">
                  {Math.round(selectedSummary.autograde.examCompletionRate * 100)}%
                </p>
              </div>
            </div>

            {/* Top & Bottom Performers */}
            <div className="grid gap-4 md:grid-cols-2">
              {selectedSummary.autograde.topPerformers.length > 0 && (
                <div>
                  <h4 className="text-primary mb-2 text-sm font-medium">Top Performers</h4>
                  <div className="space-y-1">
                    {selectedSummary.autograde.topPerformers.slice(0, 5).map((p) => (
                      <div
                        key={p.studentId}
                        className="bg-primary/10 flex items-center justify-between rounded px-3 py-1.5 text-sm"
                      >
                        <span>{p.name || p.studentId.slice(0, 10)}</span>
                        <span className="text-primary font-medium">
                          {Math.round(p.avgScore * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedSummary.autograde.bottomPerformers.length > 0 && (
                <div>
                  <h4 className="text-destructive mb-2 text-sm font-medium">Needs Improvement</h4>
                  <div className="space-y-1">
                    {selectedSummary.autograde.bottomPerformers.slice(0, 5).map((p) => (
                      <div
                        key={p.studentId}
                        className="bg-destructive/10 flex items-center justify-between rounded px-3 py-1.5 text-sm"
                      >
                        <span>{p.name || p.studentId.slice(0, 10)}</span>
                        <span className="text-destructive font-medium">
                          {Math.round(p.avgScore * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {classes.length > 0
              ? "Select a class above to view detailed analytics"
              : "No classes available"}
          </p>
        )}
      </div>
    </div>
  );
}
