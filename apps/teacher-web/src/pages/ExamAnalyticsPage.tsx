import { useMemo, useState } from "react";
import { useExams, useExamAnalytics } from "@levelup/query";
import { BarChart3, ClipboardList, Users, Target, TrendingUp } from "lucide-react";
import {
  ScoreCard,
  SimpleBarChart,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@levelup/shared-ui";
import type { Exam } from "@levelup/shared-types";

/** Normalize a query hook result (bare array | PageResponse | infinite query) → array. */
function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as { items?: T[]; pages?: { items?: T[] }[] };
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.pages)) return o.pages.flatMap((p) => p.items ?? []);
  }
  return [];
}

interface QuestionAnalytic {
  questionId: string;
  avgScore: number;
  maxScore: number;
  avgPercentage: number;
  difficultyIndex: number;
  commonMistakes: string[];
}
interface ExamAnalyticsLike {
  totalSubmissions: number;
  avgPercentage: number;
  passRate: number;
  medianScore: number;
  scoreDistribution: { buckets: { min: number; max: number; count: number }[] };
  questionAnalytics: Record<string, QuestionAnalytic>;
  topicPerformance: Record<string, { avgPercentage: number }>;
}

export default function ExamAnalyticsPage() {
  // Query hooks are claims-scoped server-side — no tenantId arg.
  const { data: examsData } = useExams();
  const exams = useMemo(() => asArray<Exam>(examsData), [examsData]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const gradedExams = exams.filter(
    (e: Exam) => e.status === "graded" || e.status === "results_released"
  );
  const activeExamId = selectedExamId || gradedExams[0]?.id || null;
  const { data: analyticsData, isLoading } = useExamAnalytics(activeExamId ?? "");
  const analytics = analyticsData as ExamAnalyticsLike | undefined;

  // Build score distribution chart data
  const distributionData =
    analytics?.scoreDistribution.buckets.map((b) => ({
      label: `${b.min}-${b.max}%`,
      value: b.count,
      color: b.min >= 70 ? "var(--grade-a)" : b.min >= 40 ? "var(--grade-c)" : "var(--grade-f)",
    })) ?? [];

  // Question analytics sorted by difficulty
  const questionEntries = analytics
    ? Object.values(analytics.questionAnalytics).sort(
        (a, b) => a.difficultyIndex - b.difficultyIndex
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Exam Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Per-exam grade distribution and question analysis
          </p>
        </div>
        <Select
          value={activeExamId ?? "__none__"}
          onValueChange={(v) => setSelectedExamId(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select exam" />
          </SelectTrigger>
          <SelectContent>
            {gradedExams.length === 0 && (
              <SelectItem value="__none__" disabled>
                No graded exams
              </SelectItem>
            )}
            {gradedExams.map((e: Exam) => (
              <SelectItem key={e.id} value={e.id}>
                {e.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface-sunken h-24 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : !analytics ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="text-muted-foreground mx-auto h-10 w-10" />
          <p className="text-muted-foreground mt-3 text-sm">
            {gradedExams.length === 0
              ? "No graded exams yet. Analytics appear after exam results are released."
              : "No analytics data for this exam yet."}
          </p>
        </div>
      ) : (
        <>
          {/* Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <ScoreCard label="Total Submissions" value={analytics.totalSubmissions} icon={Users} />
            <ScoreCard
              label="Average Score"
              value={`${Math.round(analytics.avgPercentage)}%`}
              icon={TrendingUp}
            />
            <ScoreCard
              label="Pass Rate"
              value={`${Math.round(analytics.passRate * 100)}%`}
              icon={Target}
            />
            <ScoreCard label="Median Score" value={analytics.medianScore} icon={ClipboardList} />
          </div>

          {/* Score Distribution */}
          {distributionData.length > 0 && (
            <div className="bg-card border-subtle shadow-e1 rounded-lg border p-5">
              <h2 className="mb-4 font-semibold">Grade Distribution</h2>
              <SimpleBarChart
                data={distributionData}
                height={220}
                showValues
                valueFormatter={(v) => `${v}`}
              />
            </div>
          )}

          {/* Per-Question Analysis */}
          {questionEntries.length > 0 && (
            <div className="bg-card border-subtle shadow-e1 rounded-lg border">
              <div className="border-b px-5 py-3">
                <h2 className="font-semibold">Per-Question Analysis</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Avg Score</TableHead>
                    <TableHead>Avg %</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Common Mistakes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questionEntries.map((q) => (
                    <TableRow key={q.questionId}>
                      <TableCell className="font-medium">Q{q.questionId}</TableCell>
                      <TableCell className="font-mono">
                        {q.avgScore.toFixed(1)}/{q.maxScore}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-mono ${
                            q.avgPercentage >= 70
                              ? "text-grade-a"
                              : q.avgPercentage >= 40
                                ? "text-grade-c"
                                : "text-grade-f"
                          }`}
                        >
                          {Math.round(q.avgPercentage)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-pill inline-flex px-2 py-0.5 text-xs font-medium ${
                            q.difficultyIndex >= 0.7
                              ? "bg-success-subtle text-success"
                              : q.difficultyIndex >= 0.4
                                ? "bg-warning-subtle text-warning"
                                : "bg-error-subtle text-error"
                          }`}
                        >
                          {q.difficultyIndex >= 0.7
                            ? "Easy"
                            : q.difficultyIndex >= 0.4
                              ? "Medium"
                              : "Hard"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                        {q.commonMistakes.slice(0, 2).join("; ") || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Topic Performance */}
          {Object.keys(analytics.topicPerformance).length > 0 && (
            <div className="bg-card border-subtle shadow-e1 rounded-lg border p-5">
              <h2 className="mb-4 font-semibold">Topic Performance</h2>
              <SimpleBarChart
                data={Object.entries(analytics.topicPerformance).map(([topic, perf]) => ({
                  label: topic,
                  value: perf.avgPercentage,
                  color:
                    perf.avgPercentage >= 70
                      ? "var(--grade-a)"
                      : perf.avgPercentage >= 40
                        ? "var(--grade-c)"
                        : "var(--grade-f)",
                }))}
                maxValue={100}
                height={180}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
