import { useCallback, useEffect, useState } from "react";
import { useCurrentUser, useCurrentTenantId } from "@levelup/shared-stores";
import { useChildSummary } from "@levelup/query";
import type { StudentId } from "@levelup/domain";
import {
  ProgressRing,
  SimpleBarChart,
  Skeleton,
  EmptyState,
  Card,
  CardContent,
  FadeIn,
} from "@levelup/shared-ui";
import type { StudentProgressSummary, UserMembership } from "@levelup/shared-types";
import { Users } from "lucide-react";
import { useLinkedStudents } from "../hooks/useLinkedStudents";
import { useStudentNames } from "../hooks/useStudentNames";
import { getInitials, getStudentDisplayName } from "../lib/helpers";

function ComparisonSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading comparison">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface MetricRow {
  label: string;
  getValue: (s: StudentProgressSummary) => number;
  format: (v: number) => string;
}

const METRICS: MetricRow[] = [
  {
    label: "Overall Score",
    getValue: (s) => Math.round(s.overallScore * 100),
    format: (v) => `${v}%`,
  },
  {
    label: "Exam Average",
    getValue: (s) => Math.round(s.autograde.averagePercentage),
    format: (v) => `${v}%`,
  },
  {
    label: "Space Completion",
    getValue: (s) => Math.round(s.levelup.averageCompletion),
    format: (v) => `${v}%`,
  },
  {
    label: "Streak",
    getValue: (s) => s.levelup.streakDays,
    format: (v) => `${v}d`,
  },
  {
    label: "Points",
    getValue: (s) => s.levelup.totalPointsEarned,
    format: (v) => v.toLocaleString(),
  },
];

export default function ChildComparisonPage() {
  const user = useCurrentUser();
  const tenantId = useCurrentTenantId();
  const { data: linkedStudents, isLoading } = useLinkedStudents(tenantId, user?.uid ?? null);

  const studentIds = linkedStudents?.map((s) => s.uid) ?? [];
  const { data: studentNames } = useStudentNames(tenantId, studentIds);

  // Cross-child comparison needs every child's full summary at once, but the
  // per-child SDK hook can't be called in a loop — so each <ComparisonCard>
  // fetches its own summary and lifts it here for the "best metric" + chart calcs.
  const [summaryMap, setSummaryMap] = useState<Record<string, StudentProgressSummary>>({});
  const reportSummary = useCallback((id: string, s: StudentProgressSummary) => {
    setSummaryMap((prev) => (prev[id] === s ? prev : { ...prev, [id]: s }));
  }, []);
  const summaries = Object.values(summaryMap);

  if (isLoading) return <ComparisonSkeleton />;

  if (!linkedStudents || linkedStudents.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Compare Children</h1>
          <p className="text-muted-foreground text-sm">Side-by-side performance comparison</p>
        </div>
        <EmptyState
          icon={Users}
          title="Not enough children to compare"
          description="You need at least 2 linked children to use the comparison view."
        />
      </div>
    );
  }

  // Build chart data for subject comparison
  const subjectChartData = summaries.map((s) => {
    const name = getStudentDisplayName(
      studentNames,
      linkedStudents?.find((ls) => ls.uid === s.studentId)
    );
    return {
      label: name.split(" ")[0] ?? name,
      value: Math.round(s.overallScore * 100),
    };
  });

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold">Compare Children</h1>
          <p className="text-muted-foreground text-sm">
            Side-by-side performance comparison across all metrics
          </p>
        </div>
      </FadeIn>

      {/* Comparison Cards */}
      <FadeIn delay={0.1}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {linkedStudents.slice(0, 4).map((student, idx) => (
            <ComparisonCard
              key={student.id}
              student={student}
              name={getStudentDisplayName(studentNames, student, idx)}
              allSummaries={summaries}
              onLoad={reportSummary}
            />
          ))}
        </div>
      </FadeIn>

      {/* Bar Chart Comparison */}
      {subjectChartData.length > 0 && (
        <FadeIn delay={0.15}>
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 font-semibold">Overall Score Comparison</h3>
              <SimpleBarChart
                data={subjectChartData}
                maxValue={100}
                height={200}
                valueFormatter={(v) => `${v}%`}
              />
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}

function ComparisonCard({
  student,
  name,
  allSummaries,
  onLoad,
}: {
  student: UserMembership;
  name: string;
  allSummaries: StudentProgressSummary[];
  onLoad: (id: string, s: StudentProgressSummary) => void;
}) {
  const { data: childSummary } = useChildSummary(student.uid as StudentId);
  const s = childSummary?.studentSummary as StudentProgressSummary | undefined;

  useEffect(() => {
    if (s) onLoad(student.uid, s);
  }, [s, student.uid, onLoad]);

  const summaries = allSummaries;

  return (
    <Card key={student.id}>
      <CardContent className="space-y-4 p-4">
        {/* Avatar + Name */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold">
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
          </div>
        </div>

        {/* Progress Ring */}
        {s && (
          <div className="flex justify-center">
            <ProgressRing value={Math.round(s.overallScore * 100)} size={80} label="Overall" />
          </div>
        )}

        {/* Metrics */}
        {s ? (
          <div className="space-y-2">
            {METRICS.map((metric) => {
              const val = metric.getValue(s);
              const allVals = summaries.map(metric.getValue);
              const isBest =
                val === Math.max(...allVals) && allVals.filter((v) => v === val).length === 1;

              return (
                <div key={metric.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{metric.label}</span>
                  <span className={`font-medium ${isBest ? "text-success" : ""}`}>
                    {metric.format(val)}
                    {isBest && <span className="ml-1 text-xs">★</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-center text-sm">No data yet</p>
        )}
      </CardContent>
    </Card>
  );
}
