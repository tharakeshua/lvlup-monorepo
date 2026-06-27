import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useStudent, useExams, useSubmissions, useGenerateReport, useRepos } from "@levelup/query";
import type { Exam, Submission, Student, StudentProgressSummary } from "@levelup/shared-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ProgressRing,
  ScoreCard,
  AtRiskBadge,
  SimpleBarChart,
  Skeleton,
  FadeIn,
  DownloadPDFButton,
} from "@levelup/shared-ui";
import type { BarChartItem } from "@levelup/shared-ui";
import { User, Target, ClipboardList, BookOpen, Flame, TrendingUp, Award } from "lucide-react";

export default function StudentReportPage() {
  const { studentId } = useParams<{ studentId: string }>();

  // Entity + summary reads are tenant-scoped server-side via claims. The student
  // progress summary has no batch query hook, so read the analytics summaryRepo
  // imperatively via useRepos() (same pattern as the dashboard class summaries).
  const { data: studentRaw, isLoading: studentLoading } = useStudent(studentId ?? "");
  const student = (studentRaw ?? null) as Student | null;

  const repos = useRepos();
  const { data: summaryRaw, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics", "studentSummary", studentId ?? ""],
    queryFn: () =>
      (
        repos as unknown as { summaryRepo: { getStudent(id: string): Promise<unknown> } }
      ).summaryRepo.getStudent(studentId ?? ""),
    enabled: Boolean(studentId),
  });
  const summary = (summaryRaw ?? null) as StudentProgressSummary | null;

  const generateReport = useGenerateReport();

  const { data: subsRaw } = useSubmissions({});
  const submissions = (
    (subsRaw as { pages?: { items?: Submission[] }[] } | undefined)?.pages ?? []
  ).flatMap((p) => p.items ?? []) as Submission[];
  const { data: examsRaw } = useExams();
  const exams = ((examsRaw as { pages?: { items?: Exam[] }[] } | undefined)?.pages ?? []).flatMap(
    (p) => p.items ?? []
  ) as Exam[];

  const studentSubmissions = submissions?.filter((s) => s.studentId === studentId) ?? [];
  const gradedSubmissions = studentSubmissions.filter(
    (s) => s.status === "grading_complete" || s.status === "reviewed"
  );

  const isLoading = studentLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Build subject breakdown for chart
  const subjectScores: Record<string, { total: number; count: number }> = {};
  for (const sub of gradedSubmissions) {
    const exam = exams?.find((e) => e.id === sub.examId);
    const subject = exam?.subject ?? "Other";
    if (!subjectScores[subject]) subjectScores[subject] = { total: 0, count: 0 };
    const pct = ((sub.totalScore ?? 0) / (exam?.totalMarks || 1)) * 100;
    subjectScores[subject].total += pct;
    subjectScores[subject].count += 1;
  }
  const subjectChartData: BarChartItem[] = Object.entries(subjectScores).map(([label, data]) => ({
    label,
    value: data.count > 0 ? data.total / data.count : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center gap-4">
          <div
            className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <User className="text-primary h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">
                {student?.displayName ?? student?.name ?? "Student Report"}
              </h1>
              {studentId && (
                <DownloadPDFButton
                  onGenerate={async () => {
                    const res = await generateReport.mutateAsync({
                      kind: "progress",
                      studentId: studentId as never,
                    });
                    return { downloadUrl: (res as { pdfUrl: string }).pdfUrl };
                  }}
                  label="Download PDF"
                />
              )}
            </div>
            <div className="text-muted-foreground flex items-center gap-3 text-sm">
              {student?.rollNo && <span>Roll: {student.rollNo}</span>}
              {student?.grade && <span>Grade {student.grade}</span>}
              {student?.section && <span>Sec {student.section}</span>}
              {summary && (
                <AtRiskBadge isAtRisk={summary.isAtRisk} reasons={summary.atRiskReasons} />
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Score Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ScoreCard
            label="Overall Score"
            value={`${Math.round(summary.overallScore * 100)}%`}
            icon={Target}
          />
          <ScoreCard
            label="Exam Average"
            value={`${Math.round(summary.autograde.averagePercentage)}%`}
            suffix={`(${summary.autograde.completedExams} exams)`}
            icon={ClipboardList}
          />
          <ScoreCard
            label="Space Completion"
            value={`${Math.round(summary.levelup.averageCompletion)}%`}
            suffix={`(${summary.levelup.completedSpaces}/${summary.levelup.totalSpaces})`}
            icon={BookOpen}
          />
          <ScoreCard label="Current Streak" value={`${summary.levelup.streakDays}d`} icon={Flame} />
        </div>
      )}

      {/* Performance Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Progress Ring */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center gap-8">
              <div className="text-center">
                <ProgressRing
                  value={Math.round(summary.overallScore * 100)}
                  size={100}
                  label="Overall"
                />
              </div>
              <div className="text-center">
                <ProgressRing
                  value={Math.round(summary.autograde.averagePercentage)}
                  size={100}
                  label="Exams"
                />
              </div>
              <div className="text-center">
                <ProgressRing
                  value={Math.round(summary.levelup.averageCompletion)}
                  size={100}
                  label="Spaces"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subject Breakdown */}
        {subjectChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Award className="h-4 w-4" />
                Subject Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={subjectChartData} height={180} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Strengths & Weaknesses */}
      {summary && (summary.strengthAreas.length > 0 || summary.weaknessAreas.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Strengths & Weaknesses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {summary.strengthAreas.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium">Strengths</p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.strengthAreas.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {summary.weaknessAreas.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    Needs Improvement
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.weaknessAreas.map((w) => (
                      <span
                        key={w}
                        className="text-destructive rounded-full bg-red-500/10 px-2.5 py-1 text-xs"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Exam Results */}
      {summary && summary.autograde.recentExams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Exam Results</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {summary.autograde.recentExams.map((exam) => (
                <div key={exam.examId} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{exam.examTitle}</p>
                    <p className="text-muted-foreground text-xs">
                      {exam.score}/{exam.maxScore} marks
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      exam.percentage >= 70
                        ? "text-emerald-600 dark:text-emerald-400"
                        : exam.percentage >= 40
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-destructive"
                    }`}
                  >
                    {Math.round(exam.percentage)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
