import { useState } from "react";
import { useClasses, useClassSummary } from "@levelup/query";
import type { Class, ClassProgressSummary } from "@levelup/shared-types";
import { BarChart3, Users, BookOpen, ClipboardList, Trophy } from "lucide-react";
import {
  ScoreCard,
  ProgressRing,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@levelup/shared-ui";

// The @levelup/query class summary (domain `ClassProgressSummary`) has a leaner
// shape than the legacy denormalized summary this page renders: it exposes
// `autograde.{averageScore,averagePercentage,passRate}` /
// `levelup.{averageCompletion,activeStudents}` but NOT the top/bottom-performer or
// top-point-earner lists, nor an explicit completion-rate. We adapt to the legacy
// shape, mapping what exists and defaulting the dropped lists to [] so the UI
// degrades gracefully. (PARITY GAP — flagged to Frontend-Lead.)
function adaptClassSummary(raw: unknown): ClassProgressSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as {
    id?: string;
    tenantId?: string;
    classId?: string;
    className?: string;
    studentCount?: number;
    atRiskCount?: number;
    atRiskStudentIds?: string[];
    lastUpdatedAt?: unknown;
    autograde?: { averageScore?: number; averagePercentage?: number; passRate?: number };
    levelup?: { averageCompletion?: number; activeStudents?: number };
  };
  const studentCount = s.studentCount ?? 0;
  return {
    id: s.id ?? s.classId ?? "",
    tenantId: s.tenantId ?? "",
    classId: s.classId ?? "",
    className: s.className ?? "",
    studentCount,
    autograde: {
      averageClassScore: (s.autograde?.averagePercentage ?? 0) / 100,
      examCompletionRate: s.autograde?.passRate ?? 0,
      topPerformers: [],
      bottomPerformers: [],
    },
    levelup: {
      averageClassCompletion: s.levelup?.averageCompletion ?? 0,
      activeStudentRate: studentCount > 0 ? (s.levelup?.activeStudents ?? 0) / studentCount : 0,
      topPointEarners: [],
    },
    atRiskStudentIds: s.atRiskStudentIds ?? [],
    atRiskCount: s.atRiskCount ?? 0,
    lastUpdatedAt: s.lastUpdatedAt as ClassProgressSummary["lastUpdatedAt"],
  };
}

export default function ClassAnalyticsPage() {
  const { data: classData } = useClasses();
  const classes = ((classData as { items?: Class[] } | undefined)?.items ?? []) as Class[];
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const activeClassId = selectedClassId || classes[0]?.id || null;
  const { data: rawSummary, isLoading } = useClassSummary((activeClassId ?? "") as never);
  const classSummary = adaptClassSummary(rawSummary);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Class Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Cross-system performance overview per class
          </p>
        </div>
        <Select
          value={activeClassId ?? "__none__"}
          onValueChange={(v) => setSelectedClassId(v === "__none__" ? null : v)}
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

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface-sunken h-24 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : !classSummary ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="text-muted-foreground mx-auto h-10 w-10" />
          <p className="text-muted-foreground mt-3 text-sm">
            {classes.length === 0
              ? "No classes created yet."
              : "No analytics data yet. Data will appear after exams are graded and spaces are used."}
          </p>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <ScoreCard label="Students" value={classSummary.studentCount} icon={Users} />
            <ScoreCard
              label="Avg Exam Score"
              value={`${Math.round(classSummary.autograde.averageClassScore * 100)}%`}
              icon={ClipboardList}
            />
            <ScoreCard
              label="Avg Space Completion"
              value={`${Math.round(classSummary.levelup.averageClassCompletion)}%`}
              icon={BookOpen}
            />
            <ScoreCard
              label="At-Risk Students"
              value={classSummary.atRiskCount}
              icon={Users}
              trend={classSummary.atRiskCount > 0 ? "down" : "neutral"}
              trendValue={classSummary.atRiskCount > 0 ? "Needs attention" : "All on track"}
            />
          </div>

          {/* AutoGrade + LevelUp side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* AutoGrade Section */}
            <div className="bg-card border-subtle shadow-e1 space-y-4 rounded-lg border p-5">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-brand h-4 w-4" />
                <h2 className="font-semibold">AutoGrade</h2>
              </div>
              <div className="flex items-center gap-6">
                <ProgressRing
                  value={classSummary.autograde.averageClassScore * 100}
                  label="Avg Score"
                />
                <div className="space-y-1 text-sm">
                  <p>
                    Completion Rate:{" "}
                    <span className="font-mono font-medium">
                      {Math.round(classSummary.autograde.examCompletionRate * 100)}%
                    </span>
                  </p>
                </div>
              </div>

              {/* Top Performers */}
              {classSummary.autograde.topPerformers.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 flex items-center gap-1 text-xs font-medium">
                    <Trophy className="h-3 w-3" /> Top Performers
                  </p>
                  <div className="space-y-1">
                    {classSummary.autograde.topPerformers.slice(0, 3).map((s) => (
                      <div key={s.studentId} className="flex items-center justify-between text-sm">
                        <span>{s.name || s.studentId.slice(0, 8)}</span>
                        <span className="font-mono font-medium">
                          {Math.round(s.avgScore * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Performers */}
              {classSummary.autograde.bottomPerformers.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    Needs Improvement
                  </p>
                  <div className="space-y-1">
                    {classSummary.autograde.bottomPerformers.slice(0, 3).map((s) => (
                      <div key={s.studentId} className="flex items-center justify-between text-sm">
                        <span>{s.name || s.studentId.slice(0, 8)}</span>
                        <span className="text-error font-mono font-medium">
                          {Math.round(s.avgScore * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* LevelUp Section */}
            <div className="bg-card border-subtle shadow-e1 space-y-4 rounded-lg border p-5">
              <div className="flex items-center gap-2">
                <BookOpen className="text-mastery-mastered h-4 w-4" />
                <h2 className="font-semibold">LevelUp</h2>
              </div>
              <div className="flex items-center gap-6">
                <ProgressRing
                  value={classSummary.levelup.averageClassCompletion}
                  label="Avg Completion"
                />
                <div className="space-y-1 text-sm">
                  <p>
                    Active Rate:{" "}
                    <span className="font-mono font-medium">
                      {Math.round(classSummary.levelup.activeStudentRate * 100)}%
                    </span>
                  </p>
                </div>
              </div>

              {/* Top Point Earners */}
              {classSummary.levelup.topPointEarners.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 flex items-center gap-1 text-xs font-medium">
                    <Trophy className="h-3 w-3" /> Top Point Earners
                  </p>
                  <div className="space-y-1">
                    {classSummary.levelup.topPointEarners.slice(0, 5).map((s) => (
                      <div key={s.studentId} className="flex items-center justify-between text-sm">
                        <span>{s.name || s.studentId.slice(0, 8)}</span>
                        <span className="font-mono font-medium">{s.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
