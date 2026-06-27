import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useSpace, useSpaceProgress } from "@levelup/query";
import { asSpaceId } from "@levelup/domain";
import { useStoryPoints } from "../hooks/useStoryPoints";
import ProgressBar from "../components/common/ProgressBar";
import {
  Button,
  Skeleton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  CelebrationBurst,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
} from "@levelup/shared-ui";
import {
  BookOpen,
  Clock,
  ClipboardList,
  Dumbbell,
  Zap,
  ChevronRight,
  PlayCircle,
  Award,
  CheckCircle2,
  Trophy,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Brain,
} from "lucide-react";
import type { Space, StoryPoint, StoryPointProgress, SpaceProgress } from "@levelup/shared-types";
import SpaceReviewSection from "../components/spaces/SpaceReviewSection";

export default function SpaceViewerPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const {
    data: spaceData,
    isLoading: spaceLoading,
    isError: spaceError,
    refetch: refetchSpace,
  } = useSpace<{ space: Space }>(spaceId ?? "");
  const space = spaceData?.space;
  const { data: storyPoints, isLoading: spLoading } = useStoryPoints(null, spaceId ?? null);
  const { data: progressData } = useSpaceProgress(asSpaceId(spaceId ?? ""));
  const progress = (progressData ?? null) as SpaceProgress | null;

  const overallPercentage = progress?.percentage ?? 0;
  const pointsEarned = progress?.pointsEarned ?? 0;
  const totalPoints = progress?.totalPoints ?? 0;
  const [celebrationShown, setCelebrationShown] = useState(false);

  // Find the first incomplete item for resume
  const resumeTarget = useMemo(() => {
    if (!storyPoints?.length || !progress) return null;
    for (const sp of storyPoints) {
      const spProgress = progress.storyPoints[sp.id];
      if (!spProgress || spProgress.status !== "completed") {
        const isTest = sp.type === "timed_test" || sp.type === "test";
        const isPractice = sp.type === "practice";
        const base = `/spaces/${spaceId}`;
        if (isTest) return `${base}/test/${sp.id}`;
        if (isPractice) return `${base}/practice/${sp.id}`;
        return `${base}/story-points/${sp.id}`;
      }
    }
    return null;
  }, [storyPoints, progress, spaceId]);

  if (spaceLoading || spLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (spaceError) {
    return (
      <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-8 text-center">
        <AlertCircle className="text-destructive/60 mx-auto mb-2 h-10 w-10" />
        <p className="text-destructive text-sm font-medium">Failed to load space</p>
        <p className="text-muted-foreground mt-1 text-xs">Check your connection and try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetchSpace()} className="mt-3 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="bg-muted/50 rounded-lg border p-8 text-center">
        <BookOpen className="text-muted-foreground/30 mx-auto mb-2 h-10 w-10" />
        <p className="text-muted-foreground text-sm">Space not found or has been removed.</p>
        <Button variant="outline" size="sm" asChild className="mt-3">
          <a href="/spaces">Back to Spaces</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Celebration for 100% completion */}
      <CelebrationBurst
        trigger={overallPercentage === 100 && !celebrationShown}
        variant="confetti"
        onComplete={() => setCelebrationShown(true)}
      />

      {/* Header */}
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/spaces">Spaces</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{space.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-2 text-2xl font-bold">{space.title}</h1>
        {space.description && (
          <p className="text-muted-foreground mt-1 text-sm">{space.description}</p>
        )}

        {/* Progress + Points Summary */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
          <div className="max-w-md flex-1">
            <ProgressBar
              value={overallPercentage}
              label="Overall Progress"
              color={overallPercentage === 100 ? "green" : "blue"}
              animate
            />
          </div>
          <div className="flex items-center gap-4">
            {totalPoints > 0 && (
              <div className="bg-card flex items-center gap-2 rounded-lg border px-3 py-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <div className="text-sm">
                  <span className="font-bold">{pointsEarned}</span>
                  <span className="text-muted-foreground">/{totalPoints} pts</span>
                </div>
              </div>
            )}
            {resumeTarget && overallPercentage < 100 && (
              <Button size="sm" onClick={() => navigate(resumeTarget)} className="gap-1.5">
                <ArrowRight className="h-3.5 w-3.5" />
                Resume
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: Contents / Overview */}
      <Tabs defaultValue="contents">
        <TabsList>
          <TabsTrigger value="contents">Contents</TabsTrigger>
          <TabsTrigger value="overview">
            <BarChart3 className="mr-1 h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="ai-analytics">
            <Brain className="mr-1 h-3.5 w-3.5" /> AI Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contents" className="mt-4 space-y-3">
          {!storyPoints?.length ? (
            <p className="text-muted-foreground text-sm">No content available yet.</p>
          ) : (
            storyPoints.map((sp, index) => (
              <StoryPointCard
                key={sp.id}
                storyPoint={sp}
                spaceId={space.id}
                index={index}
                total={storyPoints.length}
                progress={progress?.storyPoints[sp.id]}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <ModuleOverview storyPoints={storyPoints ?? []} progress={progress} />
        </TabsContent>

        <TabsContent value="ai-analytics" className="mt-4 space-y-4">
          <AIAnalyticsSection
            storyPoints={storyPoints ?? []}
            progress={progress}
            overallPercentage={overallPercentage}
          />
        </TabsContent>
      </Tabs>

      {/* Reviews */}
      {spaceId && <SpaceReviewSection spaceId={spaceId} ratingAggregate={space.ratingAggregate} />}
    </div>
  );
}

const typeIcons: Record<string, React.ReactNode> = {
  standard: <BookOpen className="text-primary h-5 w-5" />,
  timed_test: <Clock className="text-destructive h-5 w-5" />,
  test: <ClipboardList className="text-destructive h-5 w-5" />,
  quiz: <Zap className="h-5 w-5 text-yellow-500" />,
  practice: <Dumbbell className="h-5 w-5 text-emerald-500" />,
};

const typeLabels: Record<string, string> = {
  standard: "Learning",
  timed_test: "Timed Test",
  test: "Test",
  quiz: "Quiz",
  practice: "Practice",
};

function StoryPointCard({
  storyPoint,
  spaceId,
  progress,
}: {
  storyPoint: StoryPoint;
  spaceId: string;
  index: number;
  total: number;
  progress?: StoryPointProgress;
}) {
  const isTest = storyPoint.type === "timed_test" || storyPoint.type === "test";
  const isPractice = storyPoint.type === "practice";
  const isQuiz = storyPoint.type === "quiz";
  const percentage = progress?.percentage ?? 0;
  const isCompleted = progress?.status === "completed";

  const linkBase = `/spaces/${spaceId}`;
  const link = isTest
    ? `${linkBase}/test/${storyPoint.id}`
    : isPractice
      ? `${linkBase}/practice/${storyPoint.id}`
      : `${linkBase}/story-points/${storyPoint.id}`;

  return (
    <Link
      to={link}
      className="bg-card flex items-center gap-4 rounded-lg border p-4 transition-shadow hover:shadow-sm"
    >
      {/* Completion badge */}
      <div className="flex-shrink-0">
        {isCompleted ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        ) : (
          <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
            {typeIcons[storyPoint.type] ?? typeIcons.standard}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{storyPoint.title}</h3>
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium">
            {typeLabels[storyPoint.type] ?? storyPoint.type}
          </span>
        </div>
        {storyPoint.description && (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
            {storyPoint.description}
          </p>
        )}
        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
          {storyPoint.stats && (
            <>
              <span>{storyPoint.stats.totalItems} items</span>
              <span>{storyPoint.stats.totalPoints} pts</span>
            </>
          )}
          {storyPoint.assessmentConfig?.durationMinutes && (
            <span>{storyPoint.assessmentConfig.durationMinutes} min</span>
          )}
          {storyPoint.difficulty && <span className="capitalize">{storyPoint.difficulty}</span>}
        </div>
        {/* Type-specific display */}
        {isTest && (
          <div className="mt-2">
            {isCompleted ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Award className="h-3 w-3" /> Completed — {percentage}%
              </span>
            ) : (
              <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
                <PlayCircle className="h-3 w-3" /> Start Test
              </span>
            )}
          </div>
        )}
        {(storyPoint.type === "standard" || isQuiz) && (
          <div className="mt-2 max-w-xs">
            <ProgressBar value={percentage} size="sm" showPercent={false} />
          </div>
        )}
        {isPractice && storyPoint.stats && (
          <p className="text-muted-foreground mt-1 text-xs">
            {progress?.completedItems ?? 0}/{storyPoint.stats.totalItems} solved
          </p>
        )}
      </div>

      {/* Points earned for this story point */}
      {progress && progress.pointsEarned > 0 && (
        <div className="flex-shrink-0 text-right">
          <div className="text-sm font-bold">{progress.pointsEarned}</div>
          <div className="text-muted-foreground text-[10px]">pts</div>
        </div>
      )}

      <ChevronRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Module Overview — question type analysis, difficulty breakdown
// ---------------------------------------------------------------------------

function ModuleOverview({
  storyPoints,
  progress,
}: {
  storyPoints: StoryPoint[];
  progress: SpaceProgress | null;
}) {
  const typeCounts = useMemo(() => {
    const counts: Record<string, { total: number; completed: number }> = {};
    for (const sp of storyPoints) {
      const label = typeLabels[sp.type] ?? sp.type;
      if (!counts[label]) counts[label] = { total: 0, completed: 0 };
      counts[label].total++;
      if (progress?.storyPoints[sp.id]?.status === "completed") {
        counts[label].completed++;
      }
    }
    return counts;
  }, [storyPoints, progress]);

  const difficultyCounts = useMemo(() => {
    const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0, expert: 0 };
    for (const sp of storyPoints) {
      if (sp.difficulty) counts[sp.difficulty] = (counts[sp.difficulty] ?? 0) + 1;
    }
    return counts;
  }, [storyPoints]);

  const totalItems = storyPoints.reduce((sum, sp) => sum + (sp.stats?.totalItems ?? 0), 0);
  const totalPoints = storyPoints.reduce((sum, sp) => sum + (sp.stats?.totalPoints ?? 0), 0);

  return (
    <>
      {/* Summary Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{storyPoints.length}</p>
            <p className="text-muted-foreground text-xs">Modules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalItems}</p>
            <p className="text-muted-foreground text-xs">Total Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalPoints}</p>
            <p className="text-muted-foreground text-xs">Total Points</p>
          </CardContent>
        </Card>
      </div>

      {/* Type Breakdown */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Module Type Breakdown</h3>
        <div className="space-y-2">
          {Object.entries(typeCounts).map(([type, { total, completed }]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="text-sm">{type}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {completed}/{total} completed
                </span>
                <div className="bg-muted h-2 w-24 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Difficulty Distribution */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Difficulty Distribution</h3>
        <div className="flex h-24 items-end gap-3">
          {(["easy", "medium", "hard", "expert"] as const).map((level) => {
            const count = difficultyCounts[level] ?? 0;
            const maxCount = Math.max(...Object.values(difficultyCounts), 1);
            const heightPct = (count / maxCount) * 100;
            const colors: Record<string, string> = {
              easy: "bg-emerald-500",
              medium: "bg-yellow-500",
              hard: "bg-orange-500",
              expert: "bg-red-500",
            };
            return (
              <div key={level} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-medium">{count}</span>
                <div className="w-full rounded-t" style={{ height: `${Math.max(heightPct, 4)}%` }}>
                  <div className={`h-full w-full rounded-t ${colors[level]}`} />
                </div>
                <span className="text-muted-foreground text-[10px] capitalize">{level}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// AI Analytics — dynamic insights based on progress
// ---------------------------------------------------------------------------

function AIAnalyticsSection({
  storyPoints,
  progress,
  overallPercentage,
}: {
  storyPoints: StoryPoint[];
  progress: SpaceProgress | null;
  overallPercentage: number;
}) {
  const insights = useMemo(() => {
    const result: { label: string; value: string; color: string }[] = [];

    // Completion rate
    const completed = storyPoints.filter(
      (sp) => progress?.storyPoints[sp.id]?.status === "completed"
    ).length;
    result.push({
      label: "Completion Rate",
      value: `${storyPoints.length > 0 ? Math.round((completed / storyPoints.length) * 100) : 0}%`,
      color: completed === storyPoints.length ? "text-emerald-600" : "text-primary",
    });

    // Average score
    const scores = storyPoints
      .map((sp) => progress?.storyPoints[sp.id])
      .filter((p): p is StoryPointProgress => !!p && p.totalPoints > 0)
      .map((p) => (p.pointsEarned / p.totalPoints) * 100);
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    result.push({
      label: "Avg Score",
      value: `${avgScore}%`,
      color:
        avgScore >= 80
          ? "text-emerald-600"
          : avgScore >= 50
            ? "text-yellow-600"
            : "text-destructive",
    });

    // Weakest module
    let weakest: { name: string; score: number } | null = null;
    for (const sp of storyPoints) {
      const p = progress?.storyPoints[sp.id];
      if (p && p.totalPoints > 0) {
        const score = (p.pointsEarned / p.totalPoints) * 100;
        if (!weakest || score < weakest.score) {
          weakest = { name: sp.title, score: Math.round(score) };
        }
      }
    }
    if (weakest) {
      result.push({
        label: "Needs Attention",
        value: `${weakest.name} (${weakest.score}%)`,
        color: "text-orange-600",
      });
    }

    // Strongest module
    let strongest: { name: string; score: number } | null = null;
    for (const sp of storyPoints) {
      const p = progress?.storyPoints[sp.id];
      if (p && p.totalPoints > 0) {
        const score = (p.pointsEarned / p.totalPoints) * 100;
        if (!strongest || score > strongest.score) {
          strongest = { name: sp.title, score: Math.round(score) };
        }
      }
    }
    if (strongest) {
      result.push({
        label: "Strongest Area",
        value: `${strongest.name} (${strongest.score}%)`,
        color: "text-emerald-600",
      });
    }

    return result;
  }, [storyPoints, progress]);

  // Recommendations
  const recommendations = useMemo(() => {
    const recs: string[] = [];
    const incomplete = storyPoints.filter(
      (sp) => progress?.storyPoints[sp.id]?.status !== "completed"
    );

    if (overallPercentage === 100) {
      recs.push("Excellent work! You have completed all modules in this space.");
    } else if (overallPercentage >= 75) {
      recs.push(
        `Almost there! ${incomplete.length} module${incomplete.length > 1 ? "s" : ""} remaining.`
      );
    } else if (overallPercentage >= 25) {
      recs.push(`Good progress. Focus on completing the remaining ${incomplete.length} modules.`);
    } else {
      recs.push("Get started by working through the modules in order.");
    }

    // Suggest weakest areas
    const weak = storyPoints
      .filter((sp) => {
        const p = progress?.storyPoints[sp.id];
        return p && p.totalPoints > 0 && p.pointsEarned / p.totalPoints < 0.5;
      })
      .slice(0, 2);
    if (weak.length > 0) {
      recs.push(`Consider revisiting: ${weak.map((sp) => sp.title).join(", ")}`);
    }

    return recs;
  }, [storyPoints, progress, overallPercentage]);

  return (
    <>
      {/* Insights Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {insights.map((insight) => (
          <Card key={insight.label}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{insight.label}</p>
              <p className={`mt-1 text-lg font-bold ${insight.color} truncate`}>{insight.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-module scores */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Brain className="text-primary h-4 w-4" /> Module Performance
        </h3>
        <div className="space-y-2">
          {storyPoints.map((sp) => {
            const p = progress?.storyPoints[sp.id];
            const pct =
              p && p.totalPoints > 0 ? Math.round((p.pointsEarned / p.totalPoints) * 100) : 0;
            const status = p?.status;
            return (
              <div key={sp.id} className="flex items-center gap-3">
                <span className="flex-1 truncate text-sm">{sp.title}</span>
                <span
                  className={`text-xs font-medium ${
                    status === "completed" ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  {pct}%
                </span>
                <div className="bg-muted h-2 w-20 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${
                      status === "completed" ? "bg-emerald-500" : "bg-primary"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Brain className="text-primary h-4 w-4" /> AI Recommendations
          </h3>
          <ul className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-muted-foreground flex gap-2 text-sm">
                <span className="text-primary font-bold">·</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
