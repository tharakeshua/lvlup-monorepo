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
} from "@levelup/shared-ui";
import {
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Trophy,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Sparkles,
  Lock,
  AlertTriangle,
} from "lucide-react";
import type { Space, StoryPoint, StoryPointProgress, SpaceProgress } from "@levelup/shared-types";
import SpaceReviewSection from "../components/spaces/SpaceReviewSection";
import {
  SpaceCover,
  TypeChip,
  DifficultyChip,
  MasteryBadge,
  TYPE_META,
} from "../components/common/lyceum";

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
        if (isTest) return { link: `${base}/test/${sp.id}`, storyPointId: sp.id };
        if (isPractice) return { link: `${base}/practice/${sp.id}`, storyPointId: sp.id };
        return { link: `${base}/story-points/${sp.id}`, storyPointId: sp.id };
      }
    }
    return null;
  }, [storyPoints, progress, spaceId]);

  if (spaceLoading || spLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-40" />
        <div className="border-subtle bg-surface overflow-hidden rounded-xl border">
          <Skeleton className="h-24 w-full rounded-none" />
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full max-w-lg" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (spaceError) {
    return (
      <div className="border-error/30 bg-error/5 rounded-xl border p-10 text-center">
        <AlertCircle className="text-error/60 mx-auto mb-3 h-10 w-10" />
        <p className="font-display text-fg text-lg">We couldn&apos;t load this space</p>
        <p className="text-fg-secondary mt-1 text-sm">
          It&apos;s not you — let&apos;s try that again.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetchSpace()} className="mt-4 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="border-subtle bg-surface rounded-xl border p-12 text-center">
        <BookOpen className="text-strong mx-auto mb-3 h-10 w-10" />
        <p className="font-display text-fg text-lg">This space isn&apos;t available</p>
        <p className="text-fg-secondary mt-1 text-sm">It may have moved or been removed.</p>
        <Button variant="outline" size="sm" asChild className="mt-4">
          <Link to="/spaces">Back to Spaces</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-ly-rise space-y-6">
      {/* Celebration for 100% completion */}
      <CelebrationBurst
        trigger={overallPercentage === 100 && !celebrationShown}
        variant="confetti"
        onComplete={() => setCelebrationShown(true)}
      />

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

      {/* Hero */}
      <section className="border-subtle bg-surface shadow-e1 overflow-hidden rounded-xl border">
        <SpaceCover
          seed={space.subject ?? space.title}
          title={space.title}
          thumbnailUrl={space.thumbnailUrl}
          className="h-24 sm:h-28"
        />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {space.subject && (
              <span className="border-subtle bg-surface-sunken text-fg-secondary rounded-pill text-2xs border px-2 py-0.5 font-medium">
                {space.subject}
              </span>
            )}
          </div>
          <h1 className="font-display text-fg mt-2 text-2xl">{space.title}</h1>
          {space.description && (
            <p className="text-fg-secondary max-w-reading mt-2 text-sm leading-relaxed">
              {space.description}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md flex-1">
              <ProgressBar
                value={overallPercentage}
                label="Your journey"
                color={overallPercentage === 100 ? "green" : "blue"}
                animate
              />
            </div>
            <div className="flex items-center gap-3">
              {totalPoints > 0 && (
                <div className="border-spark/30 bg-spark-subtle flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Trophy className="text-spark h-4 w-4" aria-hidden />
                  <div className="text-sm">
                    <span className="text-fg font-mono font-semibold tabular-nums">
                      {pointsEarned}
                    </span>
                    <span className="text-fg-muted font-mono tabular-nums">
                      {" "}
                      / {totalPoints} pts
                    </span>
                  </div>
                </div>
              )}
              {overallPercentage >= 100 ? (
                <span className="text-mastery-mastered inline-flex items-center gap-1.5 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> You&apos;ve completed this space
                </span>
              ) : (
                resumeTarget && (
                  <Button onClick={() => navigate(resumeTarget.link)} className="gap-1.5">
                    {overallPercentage > 0 ? "Resume" : "Start learning"}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tabs: Contents / Overview / Insights */}
      <Tabs defaultValue="contents">
        <TabsList>
          <TabsTrigger value="contents">Contents</TabsTrigger>
          <TabsTrigger value="overview">
            <BarChart3 className="mr-1 h-3.5 w-3.5" aria-hidden /> Overview
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden /> Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contents" className="mt-5">
          {!storyPoints?.length ? (
            <div className="border-subtle bg-surface rounded-xl border p-10 text-center">
              <p className="font-display text-fg text-lg">This journey is still being built</p>
              <p className="text-fg-secondary mt-1 text-sm">
                Your teacher is adding content here. Check back soon — it&apos;ll be worth the wait.
              </p>
            </div>
          ) : (
            <ol className="list-none">
              {storyPoints.map((sp, index) => (
                <StoryPointNode
                  key={sp.id}
                  storyPoint={sp}
                  spaceId={space.id}
                  isLast={index === storyPoints.length - 1}
                  isUpNext={resumeTarget?.storyPointId === sp.id}
                  progress={progress?.storyPoints[sp.id]}
                />
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="overview" className="mt-5 space-y-4">
          <ModuleOverview storyPoints={storyPoints ?? []} progress={progress} />
        </TabsContent>

        <TabsContent value="insights" className="mt-5 space-y-4">
          <InsightsSection
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

/* ── StoryPointTrack node — the vertical learning-path spine ──────────── */

function StoryPointNode({
  storyPoint,
  spaceId,
  isLast,
  isUpNext,
  progress,
}: {
  storyPoint: StoryPoint;
  spaceId: string;
  isLast: boolean;
  isUpNext: boolean;
  progress?: StoryPointProgress;
}) {
  const isTest = storyPoint.type === "timed_test" || storyPoint.type === "test";
  const isPractice = storyPoint.type === "practice";
  const percentage = progress?.percentage ?? 0;
  const isCompleted = progress?.status === "completed";
  const isInProgress = !isCompleted && (progress?.status === "in_progress" || percentage > 0);

  const linkBase = `/spaces/${spaceId}`;
  const link = isTest
    ? `${linkBase}/test/${storyPoint.id}`
    : isPractice
      ? `${linkBase}/practice/${storyPoint.id}`
      : `${linkBase}/story-points/${storyPoint.id}`;

  const { Icon } = TYPE_META[storyPoint.type] ?? TYPE_META.standard;

  return (
    <li className="relative flex gap-4 pb-4 last:pb-0">
      {/* spine */}
      {!isLast && <span aria-hidden className="bg-subtle absolute bottom-0 left-5 top-12 w-px" />}
      {/* marker */}
      <span
        aria-hidden
        className={`z-[1] mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
          isCompleted
            ? "border-mastery-mastered bg-mastery-mastered text-fg-on-accent"
            : isInProgress
              ? "border-mastery-in-progress bg-surface text-mastery-in-progress"
              : "border-strong bg-surface text-fg-muted"
        } ${isUpNext ? "ring-brand/30 ring-4" : ""}`}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Icon className="h-[18px] w-[18px]" />
        )}
      </span>

      {/* node card */}
      <Link
        to={link}
        aria-label={`${storyPoint.title}, ${TYPE_META[storyPoint.type]?.label ?? storyPoint.type}, ${
          isCompleted
            ? "mastered"
            : isInProgress
              ? `in progress, ${Math.round(percentage)} percent`
              : "not started"
        }`}
        className={`border-subtle bg-surface shadow-e1 hover:shadow-e2 focus-visible:ring-brand/40 duration-fast ease-standard group min-w-0 flex-1 rounded-xl border p-4 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${
          isUpNext ? "border-brand-muted" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-fg text-sm font-semibold">{storyPoint.title}</h3>
              <TypeChip type={storyPoint.type} />
              <DifficultyChip difficulty={storyPoint.difficulty} />
              {isUpNext && !isCompleted && (
                <span className="bg-spark-subtle text-spark-hover rounded-pill text-2xs px-2 py-0.5 font-semibold">
                  Up next
                </span>
              )}
            </div>
            {storyPoint.description && (
              <p className="text-fg-secondary mt-1 line-clamp-1 text-xs">
                {storyPoint.description}
              </p>
            )}
            <div className="text-fg-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {storyPoint.stats && (
                <>
                  <span>
                    <span className="font-mono tabular-nums">{storyPoint.stats.totalItems}</span>{" "}
                    items
                  </span>
                  <span>
                    <span className="font-mono tabular-nums">{storyPoint.stats.totalPoints}</span>{" "}
                    pts
                  </span>
                </>
              )}
              {storyPoint.assessmentConfig?.durationMinutes && (
                <span>
                  <span className="font-mono tabular-nums">
                    {storyPoint.assessmentConfig.durationMinutes}
                  </span>{" "}
                  min · timed
                </span>
              )}
            </div>

            {/* Type-specific affordances */}
            {isTest &&
              (isCompleted ? (
                <p className="text-mastery-mastered mt-2 inline-flex items-center gap-1 text-xs font-medium">
                  <CheckCircle2 className="h-3 w-3" aria-hidden /> Completed —{" "}
                  <span className="font-mono tabular-nums">{Math.round(percentage)}%</span>
                </p>
              ) : (
                <p className="text-fg-muted mt-2 inline-flex items-center gap-1 text-xs">
                  <Lock className="h-3 w-3" aria-hidden /> Answers stay sealed until you finish
                </p>
              ))}
            {(storyPoint.type === "standard" || storyPoint.type === "quiz") && (
              <div className="mt-2.5 max-w-xs">
                <ProgressBar
                  value={percentage}
                  size="sm"
                  showPercent={false}
                  color={isCompleted ? "green" : "blue"}
                />
              </div>
            )}
            {isPractice && storyPoint.stats && (
              <p className="text-fg-muted mt-2 text-xs">
                <span className="font-mono tabular-nums">
                  {progress?.completedItems ?? 0}/{storyPoint.stats.totalItems}
                </span>{" "}
                solved
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <MasteryBadge status={progress?.status} percentage={percentage} />
            {progress && progress.pointsEarned > 0 && (
              <span className="text-fg-secondary font-mono text-xs tabular-nums">
                {progress.pointsEarned} pts
              </span>
            )}
            <ChevronRight
              className="text-strong group-hover:text-brand duration-fast h-4 w-4 transition-all group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
        </div>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Overview — what's in this space, difficulty mix
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
      const label = TYPE_META[sp.type]?.label ?? sp.type;
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
        {[
          { label: "Modules", value: storyPoints.length },
          { label: "Total items", value: totalItems },
          { label: "Total points", value: totalPoints },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-subtle bg-surface rounded-xl border p-5 text-center"
          >
            <p className="text-fg font-mono text-2xl tabular-nums">{stat.value}</p>
            <p className="text-fg-muted text-2xs tracking-caps mt-1 font-semibold uppercase">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Type Breakdown */}
      <div className="border-subtle bg-surface rounded-xl border p-5">
        <h3 className="font-display text-fg mb-4 text-base">What&apos;s in this space</h3>
        <div className="space-y-3">
          {Object.entries(typeCounts).map(([type, { total, completed }]) => (
            <div key={type} className="flex items-center justify-between gap-4">
              <span className="text-fg text-sm">{type}</span>
              <div className="flex items-center gap-3">
                <span className="text-fg-muted font-mono text-xs tabular-nums">
                  {completed}/{total} done
                </span>
                <div className="bg-surface-sunken rounded-pill h-1.5 w-24 overflow-hidden">
                  <div
                    className="bg-brand rounded-pill duration-slow ease-standard h-full transition-all"
                    style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Difficulty Distribution */}
      <div className="border-subtle bg-surface rounded-xl border p-5">
        <h3 className="font-display text-fg mb-4 text-base">Difficulty mix</h3>
        <div className="flex h-24 items-end gap-3">
          {(["easy", "medium", "hard", "expert"] as const).map((level) => {
            const count = difficultyCounts[level] ?? 0;
            const maxCount = Math.max(...Object.values(difficultyCounts), 1);
            const heightPct = (count / maxCount) * 100;
            const colors: Record<string, string> = {
              easy: "bg-success",
              medium: "bg-warning",
              hard: "bg-error",
              expert: "bg-brand",
            };
            return (
              <div key={level} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-fg font-mono text-xs tabular-nums">{count}</span>
                <div
                  className="w-full rounded-t-md"
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                >
                  <div className={`h-full w-full rounded-t-md ${colors[level]} opacity-80`} />
                </div>
                <span className="text-fg-muted text-2xs capitalize">{level}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Insights — progress-derived signals, honestly labeled (not AI)
// ---------------------------------------------------------------------------

function InsightsSection({
  storyPoints,
  progress,
  overallPercentage,
}: {
  storyPoints: StoryPoint[];
  progress: SpaceProgress | null;
  overallPercentage: number;
}) {
  const insights = useMemo(() => {
    const result: { label: string; value: string; tone: string; Icon: typeof Sparkles }[] = [];

    const completed = storyPoints.filter(
      (sp) => progress?.storyPoints[sp.id]?.status === "completed"
    ).length;
    result.push({
      label: "You've completed",
      value: `${storyPoints.length > 0 ? Math.round((completed / storyPoints.length) * 100) : 0}%`,
      tone:
        completed === storyPoints.length && storyPoints.length > 0
          ? "text-mastery-mastered"
          : "text-brand",
      Icon: BarChart3,
    });

    const scores = storyPoints
      .map((sp) => progress?.storyPoints[sp.id])
      .filter((p): p is StoryPointProgress => !!p && p.totalPoints > 0)
      .map((p) => (p.pointsEarned / p.totalPoints) * 100);
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    result.push({
      label: "Average score",
      value: `${avgScore}%`,
      tone:
        avgScore >= 80 ? "text-mastery-mastered" : avgScore >= 50 ? "text-warning" : "text-error",
      Icon: Trophy,
    });

    let strongest: { name: string; score: number } | null = null;
    let weakest: { name: string; score: number } | null = null;
    for (const sp of storyPoints) {
      const p = progress?.storyPoints[sp.id];
      if (p && p.totalPoints > 0) {
        const score = (p.pointsEarned / p.totalPoints) * 100;
        if (!strongest || score > strongest.score)
          strongest = { name: sp.title, score: Math.round(score) };
        if (!weakest || score < weakest.score)
          weakest = { name: sp.title, score: Math.round(score) };
      }
    }
    if (strongest) {
      result.push({
        label: "Your strong suit",
        value: `${strongest.name} (${strongest.score}%)`,
        tone: "text-mastery-mastered",
        Icon: Sparkles,
      });
    }
    if (weakest && (!strongest || weakest.name !== strongest.name)) {
      result.push({
        label: "Let's look at this one again",
        value: `${weakest.name} (${weakest.score}%)`,
        tone: "text-warning",
        Icon: AlertTriangle,
      });
    }

    return result;
  }, [storyPoints, progress]);

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    const incomplete = storyPoints.filter(
      (sp) => progress?.storyPoints[sp.id]?.status !== "completed"
    );

    if (overallPercentage === 100) {
      recs.push("Beautiful work — you've finished every module here.");
    } else if (overallPercentage >= 75) {
      recs.push(
        `So close — just ${incomplete.length} module${incomplete.length > 1 ? "s" : ""} to go.`
      );
    } else if (overallPercentage >= 25) {
      recs.push(
        incomplete.length > 0
          ? `Nice momentum. Next up: ${incomplete[0].title}.`
          : "Nice momentum — keep going."
      );
    } else {
      recs.push("Let's begin with the first module and build from there.");
    }

    const weak = storyPoints
      .filter((sp) => {
        const p = progress?.storyPoints[sp.id];
        return p && p.totalPoints > 0 && p.pointsEarned / p.totalPoints < 0.5;
      })
      .slice(0, 2);
    if (weak.length > 0) {
      recs.push(`Worth revisiting: ${weak.map((sp) => sp.title).join(", ")}`);
    }

    return recs;
  }, [storyPoints, progress, overallPercentage]);

  return (
    <>
      {/* Insight cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {insights.map((insight) => (
          <div key={insight.label} className="border-subtle bg-surface rounded-xl border p-5">
            <p className="text-fg-muted flex items-center gap-1.5 text-xs">
              <insight.Icon className="h-3.5 w-3.5" aria-hidden /> {insight.label}
            </p>
            <p className={`mt-1.5 truncate text-lg font-semibold ${insight.tone}`}>
              {insight.value}
            </p>
          </div>
        ))}
      </div>

      {/* Per-module scores */}
      <div className="border-subtle bg-surface rounded-xl border p-5">
        <h3 className="font-display text-fg mb-4 text-base">How you&apos;re doing</h3>
        <div className="space-y-3">
          {storyPoints.map((sp) => {
            const p = progress?.storyPoints[sp.id];
            const pct =
              p && p.totalPoints > 0 ? Math.round((p.pointsEarned / p.totalPoints) * 100) : 0;
            const done = p?.status === "completed";
            return (
              <div key={sp.id} className="flex items-center gap-3">
                <span className="text-fg flex-1 truncate text-sm">{sp.title}</span>
                <span
                  className={`font-mono text-xs tabular-nums ${done ? "text-mastery-mastered" : "text-fg-muted"}`}
                >
                  {pct}%
                </span>
                <div className="bg-surface-sunken rounded-pill h-1.5 w-20 overflow-hidden">
                  <div
                    className={`rounded-pill duration-slow ease-standard h-full transition-all ${
                      done ? "bg-mastery-mastered" : "bg-brand"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next steps */}
      {recommendations.length > 0 && (
        <div className="border-brand-muted bg-brand-subtle/50 rounded-xl border p-5">
          <h3 className="font-display text-fg mb-2 text-base">Next steps</h3>
          <ul className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-fg-secondary flex gap-2 text-sm">
                <span className="text-brand font-bold" aria-hidden>
                  ·
                </span>
                {rec}
              </li>
            ))}
          </ul>
          <p className="text-fg-muted text-2xs mt-3">Estimated from your progress so far.</p>
        </div>
      )}
    </>
  );
}
