import { useState } from "react";
import { useAuthStore } from "@levelup/shared-stores";
import { useSpaces, useSpaceProgress, useStudentSummary } from "@levelup/query";
import type { UserId, StudentProgressSummary } from "@levelup/domain";
import { Link } from "react-router-dom";
import ProgressBar from "../components/common/ProgressBar";
import {
  Skeleton,
  ProgressRing,
  ScoreCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@levelup/shared-ui";
import { BarChart3, BookOpen, Award, ClipboardList, Target } from "lucide-react";
import type { Space, SpaceProgress } from "@levelup/shared-types";

type TabId = "overall" | "exams" | "spaces";

export default function ProgressPage() {
  const { user } = useAuthStore();
  const userId = user?.uid ?? "";
  // listSpaces schema is strict — no classIds[]; server scopes by claims.
  const { data: spacesPage, isLoading } = useSpaces<{ items: Space[] }>({
    status: "published",
  });
  const spaces = spacesPage?.items;
  const { data: summaryData } = useStudentSummary(userId as UserId);
  const summary = (summaryData as { studentSummary?: StudentProgressSummary } | undefined)
    ?.studentSummary;
  const [activeTab, setActiveTab] = useState<TabId>("overall");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Progress</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-primary h-6 w-6" />
        <h1 className="text-2xl font-bold">My Progress</h1>
      </div>

      <div className="flex gap-1 border-b" role="tablist">
        {(
          [
            { id: "overall", label: "Overall" },
            { id: "exams", label: "Exams" },
            { id: "spaces", label: "Spaces" },
          ] as { id: TabId; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {/* Overall Tab */}
        {activeTab === "overall" && (
          <div className="space-y-6">
            {summary ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <ScoreCard
                    label="Overall Score"
                    value={`${Math.round(summary.overallScore * 100)}%`}
                    icon={Target}
                  />
                  <ScoreCard
                    label="Avg Exam Score"
                    value={`${Math.round(summary.autograde.averagePercentage)}%`}
                    icon={ClipboardList}
                  />
                  <ScoreCard
                    label="Space Completion"
                    value={`${Math.round(summary.levelup.averageCompletion)}%`}
                    icon={BookOpen}
                  />
                </div>

                {/* Subject breakdown */}
                {Object.keys(summary.autograde.subjectBreakdown).length > 0 && (
                  <div className="bg-card rounded-lg border p-5">
                    <h3 className="mb-3 text-sm font-semibold">Exam Performance by Subject</h3>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(summary.autograde.subjectBreakdown).map(([subject, data]) => (
                        <div
                          key={subject}
                          className="flex items-center gap-3 rounded-md border p-3"
                        >
                          <ProgressRing value={data.avgScore * 100} size={50} strokeWidth={5} />
                          <div>
                            <p className="text-sm font-medium">{subject}</p>
                            <p className="text-muted-foreground text-xs">
                              {data.examCount} exam{data.examCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                No overall progress data yet. Complete exams and spaces to see your combined
                metrics.
              </p>
            )}
          </div>
        )}

        {/* Exams Tab */}
        {activeTab === "exams" && (
          <div className="space-y-4">
            {summary?.autograde.recentExams.length ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.autograde.recentExams.map((exam) => (
                      <TableRow key={exam.examId}>
                        <TableCell className="font-medium">{exam.examTitle}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {exam.score.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-medium ${
                              exam.percentage >= 70
                                ? "text-emerald-600 dark:text-emerald-400"
                                : exam.percentage >= 40
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-destructive"
                            }`}
                          >
                            {Math.round(exam.percentage)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No exam results yet.</p>
            )}
          </div>
        )}

        {/* Spaces Tab */}
        {activeTab === "spaces" && (
          <div className="space-y-4">
            {!spaces?.length ? (
              <p className="text-muted-foreground">No spaces to track.</p>
            ) : (
              spaces.map((space) => <SpaceProgressCard key={space.id} space={space} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SpaceProgressCard({ space }: { space: Space }) {
  const { data } = useSpaceProgress(space.id);
  const progress = data as SpaceProgress | null;
  const percentage = progress?.percentage ?? 0;
  const pointsEarned = progress?.pointsEarned ?? 0;
  const totalPoints = progress?.totalPoints ?? 0;
  const status = progress?.status ?? "not_started";
  const spCount = Object.keys(progress?.storyPoints ?? {}).length;
  const completedSPs = Object.values(progress?.storyPoints ?? {}).filter(
    (sp) => sp.status === "completed"
  ).length;

  return (
    <Link
      to={`/spaces/${space.id}`}
      className="bg-card block rounded-lg border p-4 transition-shadow hover:shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{space.title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            status === "completed"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : status === "in_progress"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {status === "not_started"
            ? "Not Started"
            : status === "in_progress"
              ? "In Progress"
              : "Completed"}
        </span>
      </div>

      <ProgressBar value={percentage} color={status === "completed" ? "green" : "blue"} />

      <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <Award className="h-3 w-3" /> {pointsEarned}/{totalPoints} pts
        </span>
        <span className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> {completedSPs}/{spCount} sections
        </span>
      </div>
    </Link>
  );
}
