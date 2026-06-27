import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCurrentUser, useCurrentTenantId } from "@levelup/shared-stores";
import { useChildSummary } from "@levelup/query";
import type { StudentId } from "@levelup/domain";
import {
  ScoreCard,
  SimpleBarChart,
  Skeleton,
  EmptyState,
  DownloadPDFButton,
} from "@levelup/shared-ui";
import { callGenerateReport } from "@levelup/shared-services";
import type { StudentProgressSummary } from "@levelup/shared-types";
import {
  ClipboardList,
  BookOpen,
  Flame,
  TrendingUp,
  Target,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { PerformanceTrendsChart } from "../components/PerformanceTrendsChart";
import { useLinkedStudents } from "../hooks/useLinkedStudents";
import { useStudentNames } from "../hooks/useStudentNames";
import { getInitials, getStudentDisplayName } from "../lib/helpers";

function ChildProgressSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading content">
      <div className="flex gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default function ChildProgressPage() {
  const user = useCurrentUser();
  const tenantId = useCurrentTenantId();
  const [searchParams] = useSearchParams();
  const studentFromUrl = searchParams.get("student");
  const { data: linkedStudents, isLoading } = useLinkedStudents(tenantId, user?.uid ?? null);

  const studentIds = linkedStudents?.map((s) => s.uid) ?? [];
  const { data: studentNames } = useStudentNames(tenantId, studentIds);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(studentFromUrl);

  // Per-child summary for the active selection (defaults to the first linked child).
  const activeStudentId = selectedStudentId ?? linkedStudents?.[0]?.uid ?? null;
  const { data: childSummary } = useChildSummary((activeStudentId ?? "") as StudentId);
  const selectedSummary =
    (childSummary?.studentSummary as StudentProgressSummary | undefined) ?? null;

  const selectedStudent = linkedStudents?.find((s) => s.uid === activeStudentId);

  // Subject breakdown chart for exams
  const examSubjectData = selectedSummary
    ? Object.entries(selectedSummary.autograde.subjectBreakdown)
        .map(([subject, data]) => ({
          label: subject,
          value: Math.round(data.avgScore * 100),
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  // Subject breakdown chart for spaces
  const spaceSubjectData = selectedSummary
    ? Object.entries(selectedSummary.levelup.subjectBreakdown)
        .map(([subject, data]) => ({
          label: subject,
          value: Math.round(data.avgCompletion),
          color: "hsl(var(--primary))",
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {selectedStudent
              ? `Progress — ${getStudentDisplayName(studentNames, selectedStudent)}`
              : "Child Progress"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Detailed progress and performance for each child
          </p>
        </div>
        {tenantId && activeStudentId && (
          <DownloadPDFButton
            onGenerate={async () => {
              const res = await callGenerateReport({
                tenantId: tenantId!,
                type: "student-progress-report",
                studentId: activeStudentId,
              });
              return { downloadUrl: res.pdfUrl };
            }}
            label="Download Report"
          />
        )}
      </div>

      {isLoading ? (
        <ChildProgressSkeleton />
      ) : !linkedStudents?.length ? (
        <EmptyState
          icon={Target}
          title="No linked children"
          description="Contact your school admin to link children to your account."
        />
      ) : (
        <>
          {/* Child Selector */}
          {linkedStudents.length > 1 && (
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              role="tablist"
              aria-label="Select child"
            >
              {linkedStudents.map((student, idx) => {
                const name = getStudentDisplayName(studentNames, student, idx);
                const isSelected = activeStudentId === student.uid;
                return (
                  <button
                    key={student.id}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedStudentId(student.uid)}
                    className={`flex flex-shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      isSelected ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    <div className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
                      {getInitials(name)}
                    </div>
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          {selectedSummary ? (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                <ScoreCard
                  label="Overall Score"
                  value={`${Math.round(selectedSummary.overallScore * 100)}%`}
                  icon={Target}
                />
                <ScoreCard
                  label="Exam Average"
                  value={`${Math.round(selectedSummary.autograde.averagePercentage)}%`}
                  icon={ClipboardList}
                />
                <ScoreCard
                  label="Space Completion"
                  value={`${Math.round(selectedSummary.levelup.averageCompletion)}%`}
                  icon={BookOpen}
                />
                <ScoreCard
                  label="Streak"
                  value={`${selectedSummary.levelup.streakDays}d`}
                  icon={Flame}
                />
                <ScoreCard
                  label="Points Earned"
                  value={selectedSummary.levelup.totalPointsEarned}
                  icon={TrendingUp}
                />
              </div>

              {/* At-Risk indicator */}
              {selectedSummary.isAtRisk && (
                <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-destructive h-4 w-4" />
                    <h3 className="text-destructive font-semibold">At-Risk Alert</h3>
                  </div>
                  <ul className="text-destructive mt-2 space-y-1 text-sm">
                    {selectedSummary.atRiskReasons.map((reason, i) => (
                      <li key={i}>- {reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid gap-4 md:grid-cols-2">
                {selectedSummary.strengthAreas.length > 0 && (
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="text-success mb-2 font-semibold">Strengths</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedSummary.strengthAreas.map((area) => (
                        <span
                          key={area}
                          className="bg-success/10 text-success rounded-full px-3 py-1 text-xs font-medium"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSummary.weaknessAreas.length > 0 && (
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="text-warning mb-2 font-semibold">Areas for Improvement</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedSummary.weaknessAreas.map((area) => (
                        <span
                          key={area}
                          className="bg-warning/10 text-warning rounded-full px-3 py-1 text-xs font-medium"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Improvement Recommendations */}
              {selectedSummary.weaknessAreas.length > 0 && (
                <div className="border-info/20 bg-info/5 rounded-lg border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Lightbulb className="text-info h-4 w-4" />
                    <h3 className="text-info font-semibold">Recommendations for Improvement</h3>
                  </div>
                  <ul className="text-info space-y-2 text-sm">
                    {selectedSummary.weaknessAreas.map((area) => (
                      <li key={area} className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0">-</span>
                        <span>
                          Practice more <strong>{area}</strong> topics in the LevelUp learning
                          spaces to strengthen understanding
                        </span>
                      </li>
                    ))}
                    {selectedSummary.autograde.averagePercentage < 40 && (
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0">-</span>
                        <span>
                          Consider reviewing foundational concepts before attempting advanced
                          problems
                        </span>
                      </li>
                    )}
                    {selectedSummary.levelup.averageCompletion < 50 && (
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0">-</span>
                        <span>
                          Encourage completing more learning spaces to build a stronger foundation
                        </span>
                      </li>
                    )}
                    {selectedSummary.levelup.streakDays < 3 && (
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0">-</span>
                        <span>
                          Build a daily learning habit — even 15 minutes a day can make a big
                          difference
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Performance Trends */}
              <PerformanceTrendsChart tenantId={tenantId} studentId={activeStudentId} />

              {/* Subject Breakdown Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                {examSubjectData.length > 0 && (
                  <div className="bg-card rounded-lg border p-5">
                    <h3 className="mb-4 font-semibold">Exam Scores by Subject</h3>
                    <SimpleBarChart
                      data={examSubjectData}
                      maxValue={100}
                      height={200}
                      valueFormatter={(v) => `${v}%`}
                    />
                  </div>
                )}
                {spaceSubjectData.length > 0 && (
                  <div className="bg-card rounded-lg border p-5">
                    <h3 className="mb-4 font-semibold">Space Completion by Subject</h3>
                    <SimpleBarChart
                      data={spaceSubjectData}
                      maxValue={100}
                      height={200}
                      valueFormatter={(v) => `${v}%`}
                    />
                  </div>
                )}
              </div>

              {/* Exam & Space Details */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Exams */}
                <div className="bg-card rounded-lg border p-5">
                  <h3 className="mb-3 font-semibold">Recent Exam Results</h3>
                  {selectedSummary.autograde.recentExams.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSummary.autograde.recentExams.map((exam) => (
                        <div
                          key={exam.examId}
                          className="bg-muted/50 flex items-center justify-between rounded px-3 py-2"
                        >
                          <span className="flex-1 truncate text-sm">{exam.examTitle}</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="bg-muted h-1.5 w-16 rounded-full"
                              role="progressbar"
                              aria-valuenow={Math.round(exam.percentage)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Score: ${Math.round(exam.percentage)}%`}
                            >
                              <div
                                className={`h-1.5 rounded-full ${
                                  exam.percentage >= 70
                                    ? "bg-success"
                                    : exam.percentage >= 40
                                      ? "bg-warning"
                                      : "bg-destructive"
                                }`}
                                style={{
                                  width: `${Math.min(100, exam.percentage)}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`min-w-[3rem] text-right text-sm font-medium ${
                                exam.percentage >= 70
                                  ? "text-success"
                                  : exam.percentage >= 40
                                    ? "text-warning"
                                    : "text-destructive"
                              }`}
                            >
                              {Math.round(exam.percentage)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No exam results yet</p>
                  )}
                  <div className="text-muted-foreground mt-3 text-xs">
                    {selectedSummary.autograde.completedExams}/
                    {selectedSummary.autograde.totalExams} exams completed | Total marks:{" "}
                    {selectedSummary.autograde.totalMarksObtained}/
                    {selectedSummary.autograde.totalMarksAvailable}
                  </div>
                </div>

                {/* Recent Space Activity */}
                <div className="bg-card rounded-lg border p-5">
                  <h3 className="mb-3 font-semibold">Recent Activity</h3>
                  {selectedSummary.levelup.recentActivity.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSummary.levelup.recentActivity.slice(0, 6).map((activity, idx) => (
                        <div
                          key={`${activity.spaceId}-${idx}`}
                          className="bg-muted/50 flex items-center justify-between rounded px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{activity.spaceTitle}</p>
                            <p className="text-muted-foreground text-xs capitalize">
                              {activity.action.replace(/_/g, " ")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No recent activity</p>
                  )}
                  <div className="text-muted-foreground mt-3 text-xs">
                    {selectedSummary.levelup.completedSpaces}/{selectedSummary.levelup.totalSpaces}{" "}
                    spaces completed | Accuracy:{" "}
                    {Math.round(selectedSummary.levelup.averageAccuracy * 100)}%
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Target}
              title="No progress data available yet"
              description="Progress will appear here as your child completes exams and spaces."
            />
          )}
        </>
      )}
    </div>
  );
}
