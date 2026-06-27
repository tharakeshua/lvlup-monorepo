import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useSpace } from "@levelup/query";
import { useStoryPoints } from "../hooks/useStoryPoints";
import { useTestSessions } from "../hooks/useTestSession";
import ProgressBar from "../components/common/ProgressBar";
import AttemptComparison from "../components/analytics/AttemptComparison";
import StudyRecommendations from "../components/analytics/StudyRecommendations";
import type { DigitalTestSession } from "@levelup/shared-types";
import {
  Button,
  Skeleton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Badge,
} from "@levelup/shared-ui";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Award,
  ChevronLeft,
} from "lucide-react";

export default function TestAnalyticsPage() {
  const { spaceId, storyPointId } = useParams<{ spaceId: string; storyPointId: string }>();
  const { currentTenantId, user } = useAuthStore();
  const userId = user?.uid ?? null;

  const { data: space } = useSpace<{ title?: string }>(spaceId ?? "");
  const { data: storyPoints } = useStoryPoints(currentTenantId, spaceId ?? null);
  const { data: sessions, isLoading } = useTestSessions(
    currentTenantId,
    userId,
    spaceId ?? null,
    storyPointId ?? null
  );

  const storyPoint = storyPoints?.find((sp) => sp.id === storyPointId);
  const completedSessions = useMemo(
    () =>
      (sessions ?? [])
        .filter((s) => s.status === "completed")
        .sort((a, b) => a.attemptNumber - b.attemptNumber),
    [sessions]
  );

  const bestSession = useMemo(
    () =>
      completedSessions.reduce<DigitalTestSession | null>(
        (best, s) => (!best || (s.percentage ?? 0) > (best.percentage ?? 0) ? s : best),
        null
      ),
    [completedSessions]
  );

  const latestSession = completedSessions[completedSessions.length - 1] ?? null;

  // Aggregate topic performance across all attempts
  const aggregatedTopics = useMemo(() => {
    const topics: Record<string, { correct: number; total: number }> = {};
    for (const session of completedSessions) {
      if (!session.analytics?.topicBreakdown) continue;
      for (const [topic, data] of Object.entries(session.analytics.topicBreakdown)) {
        if (!topics[topic]) topics[topic] = { correct: 0, total: 0 };
        topics[topic].correct += data.correct;
        topics[topic].total += data.total;
      }
    }
    return topics;
  }, [completedSessions]);

  // Aggregate difficulty performance
  const aggregatedDifficulty = useMemo(() => {
    const diff: Record<string, { correct: number; total: number }> = {};
    for (const session of completedSessions) {
      if (!session.analytics?.difficultyBreakdown) continue;
      for (const [level, data] of Object.entries(session.analytics.difficultyBreakdown)) {
        if (!diff[level]) diff[level] = { correct: 0, total: 0 };
        diff[level].correct += data.correct;
        diff[level].total += data.total;
      }
    }
    return diff;
  }, [completedSessions]);

  // Score trend
  const scoreTrend = useMemo(
    () =>
      completedSessions.map((s) => ({
        attempt: s.attemptNumber,
        score: Math.round(s.percentage ?? 0),
      })),
    [completedSessions]
  );

  // Average time per attempt
  const averageTimes = useMemo(
    () =>
      completedSessions
        .filter((s) => s.analytics?.averageTimePerQuestion != null)
        .map((s) => ({
          attempt: s.attemptNumber,
          avgTime: s.analytics!.averageTimePerQuestion!,
        })),
    [completedSessions]
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48 rounded" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  if (completedSessions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <BarChart3 className="text-muted-foreground/30 mx-auto mb-3 h-12 w-12" />
        <p className="text-muted-foreground">No completed attempts yet.</p>
        <Button asChild className="mt-4">
          <Link to={`/spaces/${spaceId}/test/${storyPointId}`}>Take Test</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/spaces">Spaces</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/spaces/${spaceId}`}>{space?.title ?? "Space"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/spaces/${spaceId}/test/${storyPointId}`}>
                {storyPoint?.title ?? "Test"}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <BarChart3 className="text-primary h-6 w-6" />
        <div>
          <h1 className="text-xl font-bold">{storyPoint?.title} — Analytics</h1>
          <p className="text-muted-foreground text-sm">
            {completedSessions.length} attempt{completedSessions.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-card rounded-lg border p-4 text-center">
          <Award className="mx-auto mb-1 h-5 w-5 text-emerald-500" />
          <p className="text-2xl font-bold">
            {bestSession ? `${Math.round(bestSession.percentage ?? 0)}%` : "--"}
          </p>
          <p className="text-muted-foreground text-xs">Best Score</p>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <Target className="mx-auto mb-1 h-5 w-5 text-blue-500" />
          <p className="text-2xl font-bold">
            {latestSession ? `${Math.round(latestSession.percentage ?? 0)}%` : "--"}
          </p>
          <p className="text-muted-foreground text-xs">Latest Score</p>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          {scoreTrend.length >= 2 &&
          scoreTrend[scoreTrend.length - 1].score > scoreTrend[0].score ? (
            <TrendingUp className="mx-auto mb-1 h-5 w-5 text-emerald-500" />
          ) : (
            <TrendingDown className="mx-auto mb-1 h-5 w-5 text-amber-500" />
          )}
          <p className="text-2xl font-bold">{completedSessions.length}</p>
          <p className="text-muted-foreground text-xs">Attempts</p>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <Clock className="text-muted-foreground mx-auto mb-1 h-5 w-5" />
          <p className="text-2xl font-bold">
            {latestSession?.analytics?.averageTimePerQuestion
              ? `${latestSession.analytics.averageTimePerQuestion}s`
              : "--"}
          </p>
          <p className="text-muted-foreground text-xs">Avg Time/Q</p>
        </div>
      </div>

      {/* Score Progression */}
      {scoreTrend.length > 1 && (
        <div className="bg-card rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Score Progression</h2>
          <div className="flex h-32 items-end gap-2">
            {scoreTrend.map((point, i) => {
              const _maxScore = Math.max(...scoreTrend.map((p) => p.score), 1);
              const height = (point.score / 100) * 100;
              const isBest = point.score === Math.max(...scoreTrend.map((p) => p.score));

              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium">{point.score}%</span>
                  <div
                    className={`w-full rounded-t transition-all ${
                      isBest ? "bg-emerald-500" : "bg-primary/60"
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-muted-foreground text-xs">#{point.attempt}</span>
                </div>
              );
            })}
          </div>
          {storyPoint?.assessmentConfig?.passingPercentage && (
            <p className="text-muted-foreground mt-2 text-xs">
              Passing: {storyPoint.assessmentConfig.passingPercentage}%
            </p>
          )}
        </div>
      )}

      {/* Topic Performance */}
      {Object.keys(aggregatedTopics).length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Topic Performance (All Attempts)</h2>
          <div className="space-y-3">
            {Object.entries(aggregatedTopics)
              .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
              .map(([topic, data]) => {
                const pct = Math.round((data.correct / data.total) * 100);
                const isWeak = pct < 50;
                return (
                  <div key={topic}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="truncate text-sm">{topic}</span>
                      <div className="flex items-center gap-2">
                        {isWeak && (
                          <Badge variant="destructive" className="text-xs">
                            Weak
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {data.correct}/{data.total} ({pct}%)
                        </span>
                      </div>
                    </div>
                    <ProgressBar
                      value={data.correct}
                      max={data.total}
                      size="sm"
                      color={pct >= 70 ? "green" : pct >= 40 ? "orange" : "red"}
                      showPercent={false}
                    />
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Difficulty Performance */}
      {Object.keys(aggregatedDifficulty).length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Difficulty Performance (All Attempts)</h2>
          <div className="space-y-3">
            {(["easy", "medium", "hard"] as const).map((diff) => {
              const data = aggregatedDifficulty[diff];
              if (!data) return null;
              const pct = Math.round((data.correct / data.total) * 100);
              return (
                <div key={diff}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm">{diff.charAt(0).toUpperCase() + diff.slice(1)}</span>
                    <span className="text-muted-foreground text-xs">
                      {data.correct}/{data.total} ({pct}%)
                    </span>
                  </div>
                  <ProgressBar
                    value={data.correct}
                    max={data.total}
                    size="sm"
                    color={pct >= 70 ? "green" : pct >= 40 ? "orange" : "red"}
                    showPercent={false}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommended Focus Areas */}
      {latestSession?.analytics && (
        <div className="bg-card rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Recommended Focus Areas</h2>
          <StudyRecommendations analytics={latestSession.analytics} />
        </div>
      )}

      {/* Attempt Comparison */}
      {completedSessions.length >= 2 && <AttemptComparison sessions={completedSessions} />}

      {/* Time Analysis */}
      {averageTimes.length > 1 && (
        <div className="bg-card rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Time per Question Trend</h2>
          <div className="flex h-24 items-end gap-2">
            {averageTimes.map((point, i) => {
              const maxTime = Math.max(...averageTimes.map((p) => p.avgTime), 1);
              const height = (point.avgTime / maxTime) * 100;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium">{point.avgTime}s</span>
                  <div
                    className="w-full rounded-t bg-blue-400/60"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-muted-foreground text-xs">#{point.attempt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link to={`/spaces/${spaceId}/test/${storyPointId}`}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Test
          </Link>
        </Button>
        <Button asChild>
          <Link to={`/spaces/${spaceId}`}>Back to Space</Link>
        </Button>
      </div>
    </div>
  );
}
