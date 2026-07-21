import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser, useCurrentMembership, useCurrentTenantId } from "@levelup/shared-stores";
import {
  useSpaces,
  useSpaceProgress,
  useStudentSummary,
  useExams,
  useStudentAchievements,
  useStudentLevel,
} from "@levelup/query";
import type { UserId, StudentProgressSummary, StudentAchievement } from "@levelup/domain";
import ProgressBar from "../components/common/ProgressBar";
import SpaceCover from "../components/spaces/SpaceCover";
import RecommendationsSection from "../components/dashboard/RecommendationsSection";
import { useStoryPoints } from "../hooks/useStoryPoints";
import {
  ScoreCard,
  AtRiskBadge,
  Skeleton,
  LevelBadge,
  AchievementBadge,
  StreakWidget,
  FadeIn,
  AnimatedCard,
  CountUp,
  EmptyState,
} from "@levelup/shared-ui";
import type { Space, SpaceProgress } from "@levelup/shared-types";

type ExamLike = { id: string; title: string; examDate?: unknown };
import {
  BookOpen,
  Clock,
  ChevronRight,
  ClipboardList,
  Flame,
  Award,
  Target,
  Lightbulb,
  Calendar,
  PlayCircle,
} from "lucide-react";

function studentDisplayName(
  user: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null
): string {
  if (!user) return "Student";
  if (user.displayName?.trim()) return user.displayName.trim();
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  return user.email ?? "Student";
}

function spaceStatLabel(
  count: number | undefined | null,
  singular: string,
  plural: string
): string | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

function AssignedTestsCounter({
  tenantId,
  space,
  onCount,
}: {
  tenantId: string;
  space: { id: string };
  onCount: (spaceId: string, count: number) => void;
}) {
  const { data: storyPoints, isLoading, isFetched } = useStoryPoints(tenantId, space.id);
  const count =
    storyPoints?.filter((sp) => sp.type === "timed_test" || sp.type === "test").length ?? 0;

  useEffect(() => {
    if (!isFetched || isLoading) return;
    onCount(space.id, count);
  }, [isFetched, isLoading, space.id, count, onCount]);

  return null;
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const membership = useCurrentMembership();
  const tenantId = useCurrentTenantId();
  const firstName = studentDisplayName(user).split(" ")[0] || "Student";

  // listSpaces schema is strict — no classIds[]; server scopes by claims.
  const { data: spacesPage, isLoading: spacesLoading } = useSpaces<{ items: Space[] }>({
    status: "published",
  });
  const spaces = spacesPage?.items;
  // Analytics getSummary asserts student entity id (stu_*), not Firebase uid.
  const studentEntityId = membership?.studentId ?? user?.uid ?? "";
  const { data: summaryData, isLoading: summaryLoading } = useStudentSummary(
    studentEntityId as UserId
  );
  const summary = (summaryData as { studentSummary?: StudentProgressSummary } | undefined)
    ?.studentSummary;

  const { data: examsData } = useExams({ status: "published" });
  const exams = (
    examsData as { pages?: Array<{ items?: ExamLike[] }> } | undefined
  )?.pages?.flatMap((p) => p.items ?? []);
  const { data: achData } = useStudentAchievements();
  const recentAchievements = (
    achData as { pages?: Array<{ items?: StudentAchievement[] }> } | undefined
  )?.pages?.flatMap((p) => p.items ?? []);
  const { data: level } = useStudentLevel();

  const [testCounts, setTestCounts] = useState<Record<string, number>>({});
  const onTestCount = useCallback((spaceId: string, count: number) => {
    setTestCounts((prev) => (prev[spaceId] === count ? prev : { ...prev, [spaceId]: count }));
  }, []);
  const assignedTestsCount = useMemo(
    () => Object.values(testCounts).reduce((a, b) => a + b, 0),
    [testCounts]
  );

  // Helper to safely extract a timestamp (ms) from an exam's date (ISO string at
  // rest; legacy {seconds} shape tolerated).
  function getExamTimestamp(exam: ExamLike): number | null {
    const ts = exam.examDate;
    if (!ts) return null;
    if (typeof ts === "string") {
      const ms = Date.parse(ts);
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof ts === "object" && "seconds" in ts) {
      const s = (ts as { seconds?: number }).seconds;
      return s ? s * 1000 : null;
    }
    return null;
  }

  // Filter upcoming exams (scheduled in the future)
  const now = Date.now();
  const upcomingExams = (exams ?? [])
    .filter((exam) => {
      const startTime = getExamTimestamp(exam);
      return startTime && startTime > now;
    })
    .sort((a, b) => {
      const aTime = getExamTimestamp(a) ?? 0;
      const bTime = getExamTimestamp(b) ?? 0;
      return aTime - bTime;
    })
    .slice(0, 5);

  const recentSpaces = spaces?.slice(0, 4) ?? [];
  const continueSpace =
    (spaces ?? []).find((s) => /algebra/i.test(s.title)) ??
    (spaces ?? []).find((s) => summary?.levelup.recentActivity?.some((a) => a.spaceId === s.id)) ??
    recentSpaces[0];

  return (
    <div className="space-y-6">
      {tenantId &&
        (spaces ?? []).map((space) => (
          <AssignedTestsCounter
            key={`count-${space.id}`}
            tenantId={tenantId}
            space={space}
            onCount={onTestCount}
          />
        ))}

      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">Welcome back, {firstName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/spaces"
              className="bg-card hover:bg-muted/60 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            >
              <ClipboardList className="text-destructive h-4 w-4" />
              Assigned tests
              <span className="bg-muted rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                {assignedTestsCount}
              </span>
            </Link>
            {continueSpace && (
              <Link
                to={`/spaces/${continueSpace.id}`}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <PlayCircle className="h-4 w-4" />
                Continue learning
              </Link>
            )}
          </div>
        </div>
      </FadeIn>

      {continueSpace && (
        <FadeIn delay={0.05}>
          <ContinueLearningCard space={continueSpace} />
        </FadeIn>
      )}

      {/* Cross-system summary */}
      {summary ? (
        <>
          <FadeIn delay={0.1}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <ScoreCard
                label="Overall Score"
                value={`${Math.round(summary.overallScore * 100)}%`}
                icon={Target}
              />
              <ScoreCard
                label="Avg Exam Score"
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
              <ScoreCard
                label="Current Streak"
                value={`${summary.levelup.streakDays}d`}
                icon={Flame}
              />
            </div>
          </FadeIn>

          {/* Recent progress from summary activity */}
          {summary.levelup.recentActivity.length > 0 && (
            <FadeIn delay={0.12}>
              <div className="bg-card rounded-lg border">
                <div className="flex items-center justify-between border-b px-5 py-3">
                  <h2 className="text-sm font-semibold">Recent Progress</h2>
                  <Link
                    to="/exams"
                    className="text-primary flex items-center gap-1 text-xs hover:underline"
                  >
                    View analytics <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="divide-y">
                  {summary.levelup.recentActivity.slice(0, 4).map((activity, idx) => (
                    <Link
                      key={`${activity.spaceId}-${idx}`}
                      to={`/spaces/${activity.spaceId}`}
                      className="hover:bg-muted/40 flex items-center justify-between px-5 py-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{activity.spaceTitle}</p>
                        <p className="text-muted-foreground text-xs">
                          +{activity.pointsEarned} pts earned
                        </p>
                      </div>
                      <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* Level, Streak & Recent Achievements */}
          <FadeIn delay={0.2}>
            <div className="grid gap-4 md:grid-cols-2">
              {level && (
                <LevelBadge
                  level={level.level}
                  currentXP={level.currentXP}
                  xpToNextLevel={level.xpToNextLevel}
                  tier={level.tier}
                />
              )}
              {summary.levelup.streakDays > 0 && !level && (
                <StreakWidget currentStreak={summary.levelup.streakDays} />
              )}
              {recentAchievements && recentAchievements.length > 0 && (
                <div className="bg-card rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Award className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                      Recent Achievements
                    </h3>
                    <Link
                      to="/achievements"
                      className="text-primary flex items-center gap-1 text-xs hover:underline"
                    >
                      View all <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="flex gap-2" role="list" aria-label="Recent achievements">
                    {recentAchievements.slice(0, 5).map((ach) => (
                      <div key={ach.id} role="listitem">
                        <AchievementBadge
                          icon={ach.achievement.icon}
                          title={ach.achievement.title}
                          tier={ach.achievement.tier}
                          rarity={ach.achievement.rarity}
                          earned
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Strengths & Weaknesses + At-risk */}
          <FadeIn delay={0.25}>
            <div className="grid gap-4 md:grid-cols-2">
              {(summary.strengthAreas.length > 0 || summary.weaknessAreas.length > 0) && (
                <div className="bg-card rounded-lg border p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Strengths & Weaknesses
                  </h3>
                  {summary.strengthAreas.length > 0 && (
                    <div className="mb-2">
                      <p className="text-muted-foreground mb-1 text-xs">Strengths</p>
                      <div className="flex flex-wrap gap-1">
                        {summary.strengthAreas.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.weaknessAreas.length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs">Needs Work</p>
                      <div className="flex flex-wrap gap-1">
                        {summary.weaknessAreas.map((w) => (
                          <span
                            key={w}
                            className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-xs"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-card rounded-lg border p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Award className="text-primary h-4 w-4" />
                  Quick Stats
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned Tests</span>
                    <span className="font-medium">
                      <CountUp end={assignedTestsCount} duration={0.5} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Points</span>
                    <span className="font-medium">
                      <CountUp end={summary.levelup.totalPointsEarned} duration={0.8} />/
                      {summary.levelup.totalPointsAvailable}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exams Completed</span>
                    <span className="font-medium">
                      <CountUp end={summary.autograde.completedExams} duration={0.6} />/
                      {summary.autograde.totalExams}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <AtRiskBadge isAtRisk={summary.isAtRisk} reasons={summary.atRiskReasons} />
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Recent Exam Results */}
          {summary.autograde.recentExams.length > 0 && (
            <FadeIn delay={0.3}>
              <div className="bg-card rounded-lg border">
                <div className="flex items-center justify-between border-b px-5 py-3">
                  <h2 className="text-sm font-semibold">Recent Exam Results</h2>
                  <Link
                    to="/exams"
                    className="text-primary flex items-center gap-1 text-xs hover:underline"
                  >
                    View all <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="divide-y">
                  {summary.autograde.recentExams.slice(0, 3).map((exam) => (
                    <div key={exam.examId} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium">{exam.examTitle}</p>
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
              </div>
            </FadeIn>
          )}
        </>
      ) : !summaryLoading ? (
        /* Fallback to basic stats when no summary */
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-card rounded-lg border p-4">
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="text-primary h-4 w-4" />
              <p className="text-muted-foreground text-sm">Active Spaces</p>
            </div>
            <p className="text-2xl font-bold">{spaces?.length ?? "--"}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="mb-1 flex items-center gap-2">
              <ClipboardList className="text-destructive h-4 w-4" />
              <p className="text-muted-foreground text-sm">Assigned Tests</p>
            </div>
            <p className="text-2xl font-bold">{assignedTestsCount}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <p className="text-muted-foreground text-sm">School</p>
            </div>
            <p className="truncate text-lg font-semibold">
              {membership?.tenantCode || tenantId || "--"}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          role="status"
          aria-label="Loading stats"
        >
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Upcoming Exams & Deadlines */}
      {upcomingExams.length > 0 && (
        <FadeIn delay={0.35}>
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5 text-orange-500" /> Upcoming
            </h2>
            <div className="space-y-2">
              {upcomingExams.map((exam) => {
                const startTime = getExamTimestamp(exam);
                const date = startTime ? new Date(startTime) : null;

                return (
                  <div
                    key={exam.id}
                    className="bg-card flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                      <ClipboardList className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{exam.title}</p>
                      {date && (
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          {date.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          at{" "}
                          {date.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Recommendations */}
      {tenantId && studentEntityId && <RecommendationsSection studentId={studentEntityId} />}

      {/* My Spaces */}
      <FadeIn delay={0.4}>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Spaces</h2>
            <Link
              to="/spaces"
              className="text-primary flex items-center gap-1 text-sm hover:underline"
            >
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {spacesLoading ? (
            <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading spaces">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : !recentSpaces.length ? (
            <EmptyState
              icon={BookOpen}
              title="No spaces assigned yet"
              description="Your learning spaces will appear here once assigned by your teacher."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {recentSpaces.map((space) => (
                <DashboardSpaceCard key={space.id} space={space} />
              ))}
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}

function ContinueLearningCard({ space }: { space: Space }) {
  const { data } = useSpaceProgress(space.id);
  const percentage = (data as SpaceProgress | null)?.percentage ?? 0;
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="text-primary h-4 w-4" />
          Continue Learning
        </h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {Math.round(percentage)}%
        </span>
      </div>
      <Link
        to={`/spaces/${space.id}`}
        className="bg-primary/5 hover:bg-primary/10 flex items-center gap-4 rounded-lg p-3 transition-colors"
      >
        <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
          <PlayCircle className="text-primary h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{space.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {space.subject && `${space.subject} · `}
            Pick up where you left off
          </p>
          <div className="mt-2">
            <ProgressBar
              value={percentage}
              size="sm"
              color={percentage === 100 ? "green" : "blue"}
            />
          </div>
        </div>
        <ChevronRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />
      </Link>
    </div>
  );
}

function DashboardSpaceCard({ space }: { space: Space }) {
  const { data } = useSpaceProgress(space.id);
  const percentage = (data as SpaceProgress | null)?.percentage ?? 0;
  const modulesLabel = spaceStatLabel(space.stats?.totalStoryPoints, "module", "modules");
  const itemsLabel = spaceStatLabel(space.stats?.totalItems, "item", "items");
  return (
    <AnimatedCard>
      <Link
        to={`/spaces/${space.id}`}
        className="bg-card block rounded-lg border p-4 transition-shadow hover:shadow-md"
      >
        <SpaceCover title={space.title} subject={space.subject} />
        <h3 className="line-clamp-1 text-sm font-semibold">{space.title}</h3>
        {space.description && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{space.description}</p>
        )}
        <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
          {space.subject && <span>{space.subject}</span>}
          {modulesLabel && <span>{modulesLabel}</span>}
          {itemsLabel && <span>{itemsLabel}</span>}
        </div>
        <div className="mt-3">
          <ProgressBar value={percentage} size="sm" color={percentage === 100 ? "green" : "blue"} />
        </div>
      </Link>
    </AnimatedCard>
  );
}
