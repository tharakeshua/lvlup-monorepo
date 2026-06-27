import { useState, useMemo } from "react";
import { useClasses, useSpaces, useExams, useExamAnalytics } from "@levelup/query";
import { BarChart3, Users, Target, TrendingUp, AlertTriangle, BookOpen } from "lucide-react";
import {
  ScoreCard,
  Badge,
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
  Skeleton,
} from "@levelup/shared-ui";
import type { Exam, Space, ExamAnalytics, Class } from "@levelup/shared-types";

export default function ClassTestAnalyticsPage() {
  const { data: classesRaw } = useClasses();
  const classes = ((classesRaw as { items?: Class[] } | undefined)?.items ?? []) as Class[];
  const { data: examsRaw } = useExams();
  const exams = ((examsRaw as { pages?: { items?: Exam[] }[] } | undefined)?.pages ?? []).flatMap(
    (p) => p.items ?? []
  ) as Exam[];
  const { data: spacesRaw } = useSpaces({});
  const spaces = ((spacesRaw as { items?: Space[] } | undefined)?.items ?? []) as Space[];
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const activeClassId = selectedClassId || classes[0]?.id || null;

  // Filter exams and spaces by class
  const classExams = useMemo(
    () => exams.filter((e: Exam) => activeClassId && e.classIds?.includes(activeClassId)),
    [exams, activeClassId]
  );

  const classSpaces = useMemo(
    () =>
      spaces.filter(
        (s: Space) =>
          activeClassId && s.classIds?.includes(activeClassId) && s.status === "published"
      ),
    [spaces, activeClassId]
  );

  // Count tests (timed_test / test type story points) across spaces
  const gradedExams = classExams.filter(
    (e: Exam) => e.status === "graded" || e.status === "results_released"
  );

  // Exam analytics for the first graded exam (to show aggregate)
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const activeExamId = selectedExamId || gradedExams[0]?.id || null;
  const { data: analyticsRaw, isLoading: analyticsLoading } = useExamAnalytics(
    (activeExamId ?? "") as never
  );
  const analytics = (analyticsRaw ?? null) as ExamAnalytics | null;

  // Compute class aggregate stats
  const classStats = useMemo(() => {
    const totalExams = classExams.length;
    const completedExams = gradedExams.length;
    const totalSpaces = classSpaces.length;

    let avgPassRate = 0;
    let avgScore = 0;
    let examsWithStats = 0;

    for (const exam of gradedExams) {
      if (exam.stats) {
        avgPassRate += exam.stats.passRate ?? 0;
        avgScore += exam.stats.avgScore ?? 0;
        examsWithStats++;
      }
    }

    if (examsWithStats > 0) {
      avgPassRate = avgPassRate / examsWithStats;
      avgScore = avgScore / examsWithStats;
    }

    return { totalExams, completedExams, totalSpaces, avgPassRate, avgScore };
  }, [classExams, gradedExams, classSpaces]);

  // Build class breakdown from analytics
  const _classBreakdown = analytics?.classBreakdown ? Object.entries(analytics.classBreakdown) : [];

  // Topic weaknesses
  const weakTopics = analytics?.topicPerformance
    ? Object.entries(analytics.topicPerformance)
        .filter(([, perf]) => perf.avgPercentage < 50)
        .sort(([, a], [, b]) => a.avgPercentage - b.avgPercentage)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Class Test Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Test performance and student insights per class
          </p>
        </div>
        <Select
          value={activeClassId ?? "__none__"}
          onValueChange={(v) => {
            setSelectedClassId(v === "__none__" ? null : v);
            setSelectedExamId(null);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {classes.length === 0 && (
              <SelectItem value="__none__" disabled>
                No classes
              </SelectItem>
            )}
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Class Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ScoreCard label="Total Exams" value={classStats.totalExams} icon={BarChart3} />
        <ScoreCard label="Learning Spaces" value={classStats.totalSpaces} icon={BookOpen} />
        <ScoreCard
          label="Avg Pass Rate"
          value={classStats.avgPassRate > 0 ? `${Math.round(classStats.avgPassRate * 100)}%` : "--"}
          icon={Target}
        />
        <ScoreCard
          label="Avg Score"
          value={classStats.avgScore > 0 ? Math.round(classStats.avgScore).toString() : "--"}
          icon={TrendingUp}
        />
      </div>

      {/* Exam Selector + Analytics */}
      {gradedExams.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Exam Deep Dive</h2>
            <Select
              value={activeExamId ?? "__none__"}
              onValueChange={(v) => setSelectedExamId(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select exam" />
              </SelectTrigger>
              <SelectContent>
                {gradedExams.map((e: Exam) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {analyticsLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : analytics ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <ScoreCard label="Submissions" value={analytics.totalSubmissions} icon={Users} />
                <ScoreCard
                  label="Avg Score"
                  value={`${Math.round(analytics.avgPercentage)}%`}
                  icon={TrendingUp}
                />
                <ScoreCard
                  label="Pass Rate"
                  value={`${Math.round(analytics.passRate * 100)}%`}
                  icon={Target}
                />
                <ScoreCard
                  label="Graded"
                  value={`${analytics.gradedSubmissions}/${analytics.totalSubmissions}`}
                  icon={BarChart3}
                />
              </div>

              {/* Weak Topics Alert */}
              {weakTopics.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      Topics Needing Attention
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {weakTopics.map(([topic, perf]) => (
                      <Badge
                        key={topic}
                        variant="outline"
                        className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                      >
                        {topic}: {Math.round(perf.avgPercentage)}%
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Performance Distribution */}
              {analytics.scoreDistribution.buckets.length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                  <h3 className="mb-3 text-sm font-semibold">Score Distribution</h3>
                  <div className="flex h-32 items-end gap-1">
                    {analytics.scoreDistribution.buckets.map((bucket, i) => {
                      const maxCount = Math.max(
                        ...analytics.scoreDistribution.buckets.map((b) => b.count),
                        1
                      );
                      const height = (bucket.count / maxCount) * 100;
                      const color =
                        bucket.min >= 70
                          ? "bg-emerald-500"
                          : bucket.min >= 40
                            ? "bg-amber-500"
                            : "bg-red-500";
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          {bucket.count > 0 && (
                            <span className="text-[10px] font-medium">{bucket.count}</span>
                          )}
                          <div
                            className={`w-full rounded-t ${color}`}
                            style={{ height: `${Math.max(height, 2)}%` }}
                          />
                          <span className="text-muted-foreground text-[10px]">{bucket.min}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Per-Question Analysis Table */}
              {Object.keys(analytics.questionAnalytics).length > 0 && (
                <div className="bg-card rounded-lg border">
                  <div className="border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Question-Level Insights</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Q#</TableHead>
                        <TableHead>Avg Score</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>Discrimination</TableHead>
                        <TableHead>Common Mistakes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(analytics.questionAnalytics)
                        .sort((a, b) => a.difficultyIndex - b.difficultyIndex)
                        .map((q) => (
                          <TableRow key={q.questionId}>
                            <TableCell className="font-medium">Q{q.questionId}</TableCell>
                            <TableCell>
                              <span
                                className={
                                  q.avgPercentage >= 70
                                    ? "text-green-600"
                                    : q.avgPercentage >= 40
                                      ? "text-amber-600"
                                      : "text-red-600"
                                }
                              >
                                {Math.round(q.avgPercentage)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  q.difficultyIndex >= 0.7
                                    ? "secondary"
                                    : q.difficultyIndex >= 0.4
                                      ? "outline"
                                      : "destructive"
                                }
                              >
                                {q.difficultyIndex >= 0.7
                                  ? "Easy"
                                  : q.difficultyIndex >= 0.4
                                    ? "Medium"
                                    : "Hard"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs">
                                {q.discriminationIndex != null
                                  ? q.discriminationIndex.toFixed(2)
                                  : "--"}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs">
                              {q.commonMistakes?.slice(0, 2).join("; ") || "--"}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <BarChart3 className="text-muted-foreground/30 mx-auto h-8 w-8" />
              <p className="text-muted-foreground mt-2 text-sm">No analytics data yet.</p>
            </div>
          )}
        </div>
      )}

      {gradedExams.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="text-muted-foreground/30 mx-auto h-10 w-10" />
          <p className="text-muted-foreground mt-3 text-sm">
            No graded exams for this class yet. Analytics appear after exam results are released.
          </p>
        </div>
      )}
    </div>
  );
}
