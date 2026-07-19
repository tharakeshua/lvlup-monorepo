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
import RecommendationsSection from "../components/dashboard/RecommendationsSection";
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
} from "lucide-react";

export default function DashboardPage() {
  const user = useCurrentUser();
  const membership = useCurrentMembership();
  const tenantId = useCurrentTenantId();

  // listSpaces is Zod .strict() — classIds[] is rejected and empties the query.
  const { data: spacesPage, isLoading: spacesLoading } = useSpaces<{ items: Space[] }>({
    status: "published",
  });
  const spaces = spacesPage?.items;
  const { data: summaryData, isLoading: summaryLoading } = useStudentSummary(
    (user?.uid ?? "") as UserId
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

  return (
    <div className="space-y-6">
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

          {/* Resume Learning — show most recent in-progress space */}
          {recentSpaces.length > 0 && (
            <FadeIn delay={0.15}>
              <div className="bg-card rounded-lg border p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="text-primary h-4 w-4" />
                  Resume Learning
                </h3>
                <Link
                  to={`/spaces/${recentSpaces[0].id}`}
                  className="bg-primary/5 hover:bg-primary/10 flex items-center gap-4 rounded-lg p-3 transition-colors"
                >
                  <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                    <BookOpen className="text-primary h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{recentSpaces[0].title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {recentSpaces[0].subject && `${recentSpaces[0].subject} · `}
                      Continue where you left off
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />
                </Link>
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
                    to="/results"
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
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-card rounded-lg border p-4">
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="text-primary h-4 w-4" />
              <p className="text-muted-foreground text-sm">Active Spaces</p>
            </div>
            <p className="text-2xl font-bold">{spaces?.length ?? "--"}</p>
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
      ) : null}

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
      {tenantId && user?.uid && <RecommendationsSection studentId={user.uid} />}

      {/* My Spaces */}
      <FadeIn delay={0.4}>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Spaces</h2>
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

function DashboardSpaceCard({ space }: { space: Space }) {
  const { data } = useSpaceProgress(space.id);
  const percentage = (data as SpaceProgress | null)?.percentage ?? 0;
  return (
    <AnimatedCard>
      <Link
        to={`/spaces/${space.id}`}
        className="bg-card block rounded-lg border p-4 transition-shadow hover:shadow-md"
      >
        {space.thumbnailUrl && (
          <img
            src={space.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="mb-3 h-32 w-full rounded-md object-cover"
          />
        )}
        <h3 className="line-clamp-1 text-sm font-semibold">{space.title}</h3>
        {space.description && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{space.description}</p>
        )}
        <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
          {space.subject && <span>{space.subject}</span>}
          {space.stats && (
            <>
              <span>{space.stats.totalStoryPoints} modules</span>
              <span>{space.stats.totalItems} items</span>
            </>
          )}
        </div>
        <div className="mt-3">
          <ProgressBar value={percentage} size="sm" color={percentage === 100 ? "green" : "blue"} />
        </div>
      </Link>
    </AnimatedCard>
  );
}
