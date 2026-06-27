/**
 * Progress lane · Gamification — XP & Streaks
 *
 * Server-authoritative gamification "home": level badge + tier, an XP meter
 * (currentXP vs xpToNextLevel), the streak chip, the tenant-rank tile, a recent
 * achievements row, and the active-goals mini-list. Everything here is READ
 * state — the client never increments XP/level/streak/rank.
 *
 * Data: `useGamificationSummary` (composed home) + `useStudentLevel` (the
 * authoritative XP/level summary). No firebase imports; hooks only.
 */
import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import {
  Award,
  Check,
  ChevronRight,
  Crown,
  Diamond,
  Flame,
  Gem,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { useGamificationSummary, useStudentLevel } from "@levelup/query";
import type {
  AchievementTier,
  GamificationSummary,
  StudentAchievement,
  StudentLevel,
  StudyGoal,
  StudyGoalTargetType,
  UserId,
} from "@levelup/domain";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
  StreakChip,
} from "../../components";
import { useSession } from "../../sdk/session";
import { isHardError } from "../../lib/query-status";

// ---------------------------------------------------------------------------
// Tier model (bronze → silver → gold → platinum → diamond)
// ---------------------------------------------------------------------------
const TIER_ORDER: AchievementTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];

const TIER_META: Record<AchievementTier, { label: string; Icon: LucideIcon }> = {
  bronze: { label: "Bronze", Icon: Shield },
  silver: { label: "Silver", Icon: Shield },
  gold: { label: "Gold", Icon: Crown },
  platinum: { label: "Platinum", Icon: Gem },
  diamond: { label: "Diamond", Icon: Diamond },
};

const TARGET_LABEL: Record<StudyGoalTargetType, string> = {
  spaces: "spaces",
  story_points: "story points",
  items: "items",
  exams: "exams",
  minutes: "minutes",
};

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function GamificationRewardsScreen() {
  const { user } = useSession();
  const userId = user?.uid as unknown as UserId | undefined;

  const summaryQ = useGamificationSummary(userId);
  const levelQ = useStudentLevel(userId);

  const summary = summaryQ.data;
  // Prefer the dedicated level read; fall back to the composed summary's copy.
  const level: StudentLevel | undefined = levelQ.data ?? summary?.level;

  const isLoading = summaryQ.isLoading || levelQ.isLoading;
  // A fresh account has no gamification docs yet (NOT_FOUND) — that's a soft
  // miss, not a failure: fall through to the graceful "level on its way" zero
  // state below. Only a genuine error on BOTH reads shows the error state.
  const isError = isHardError(summaryQ) && isHardError(levelQ) && !summary && !level;

  if (isLoading) {
    return (
      <Screen contentClassName="px-5 py-4 gap-5">
        <Header />
        <LoadingState />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen contentClassName="px-5 py-4 gap-5">
        <Header />
        <ErrorState
          onRetry={() => {
            void summaryQ.refetch();
            void levelQ.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen contentClassName="px-5 py-4 gap-6">
      <Header />

      {level ? (
        <HeroXpCard level={level} />
      ) : (
        <Card className="p-6">
          <Text className="font-display text-text-primary text-lg">Your level is on its way.</Text>
          <Text className="text-text-secondary mt-1 text-sm">
            Complete a story point to start earning XP.
          </Text>
        </Card>
      )}

      <StreakTile days={summary?.currentStreakDays ?? 0} />

      {level ? <TierTrack currentTier={level.tier} /> : null}

      <RankTile rank={summary?.tenantRank ?? null} />

      <RecentAchievements
        items={summary?.recentAchievements ?? []}
        unseenCount={summary?.unseenCount ?? 0}
      />

      <ActiveGoals goals={summary?.activeGoals ?? []} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header() {
  return (
    <View>
      <Text className="font-display text-text-primary text-3xl font-semibold">Your progress</Text>
      <Text className="text-text-secondary mt-1 text-base">Keep the spark going.</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero — level badge + tier + XP meter
// ---------------------------------------------------------------------------
function HeroXpCard({ level }: { level: StudentLevel }) {
  const tier = TIER_META[level.tier] ?? TIER_META.bronze;
  const TierIcon = tier.Icon;

  const total = level.currentXP + level.xpToNextLevel;
  const pct = total > 0 ? clampPct((level.currentXP / total) * 100) : 0;

  return (
    <Card className="gap-5 p-6">
      <View className="flex-row items-center gap-4">
        {/* Level badge */}
        <View className="rounded-pill border-spark bg-brand-subtle h-16 w-16 items-center justify-center border-2">
          <Text className="font-display text-brand text-2xl font-bold leading-none">
            {level.level}
          </Text>
          <Text className="text-2xs text-text-muted font-mono uppercase tracking-wider">lvl</Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-display text-text-primary text-xl font-semibold">
              Level {level.level}
            </Text>
            <Badge variant="spark" icon={<TierIcon size={13} color="#E8972B" />}>
              {tier.label}
            </Badge>
          </View>
          <Text className="text-spark mt-0.5 font-mono text-sm">
            {level.currentXP} / {total} XP to Level {level.level + 1}
          </Text>
        </View>
      </View>

      {/* XP meter */}
      <View>
        <View className="flex-row items-baseline gap-2">
          <Text className="font-display text-text-primary text-4xl font-bold">
            {level.currentXP.toLocaleString()}
          </Text>
          <Text className="text-text-muted font-mono text-2xl">/</Text>
          <Text className="text-text-secondary font-mono text-base">
            {total.toLocaleString()} XP
          </Text>
        </View>
        <View className="mt-3">
          <ProgressBar value={pct} variant="spark" height={14} />
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <Sparkles size={16} color="#E8972B" />
        <Text className="text-text-secondary text-sm">
          <Text className="text-text-primary font-medium">{level.totalXP.toLocaleString()}</Text> XP
          earned all-time
        </Text>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------
function StreakTile({ days }: { days: number }) {
  const cold = days <= 0;
  return (
    <Card className="items-center gap-2 p-6">
      <View
        className={
          "rounded-pill h-[72px] w-[72px] items-center justify-center border-2 " +
          (cold ? "border-border-subtle bg-surface-sunken" : "border-marigold-200 bg-brand-subtle")
        }
      >
        <Flame size={34} color={cold ? "#756E61" : "#E8972B"} />
      </View>

      {cold ? (
        <>
          <Text className="text-text-muted font-mono text-4xl font-semibold leading-none">0</Text>
          <Text className="text-text-secondary text-center text-sm">
            Start a streak today — every day counts.
          </Text>
        </>
      ) : (
        <>
          <Text className="text-spark font-mono text-4xl font-semibold leading-none">{days}</Text>
          <Text className="text-text-secondary text-center text-sm">
            day streak — keep the spark going.
          </Text>
          <View className="mt-1">
            <StreakChip days={days} />
          </View>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tier progression rail
// ---------------------------------------------------------------------------
function TierTrack({ currentTier }: { currentTier: AchievementTier }) {
  const curIdx = TIER_ORDER.indexOf(currentTier);
  const next = TIER_ORDER[curIdx + 1];

  return (
    <Card className="gap-3 p-5">
      <View className="gap-1">
        <Text className="text-text-secondary text-sm font-semibold uppercase tracking-wide">
          Tier progression
        </Text>
        {next ? (
          <Text className="text-text-secondary font-mono text-sm">
            Next up: <Text className="text-spark">{TIER_META[next].label}</Text> — keep earning XP.
          </Text>
        ) : (
          <Text className="text-text-secondary font-mono text-sm">
            Top tier reached — you{"'"}re a legend.
          </Text>
        )}
      </View>

      <View className="flex-row items-start justify-between">
        {TIER_ORDER.map((t, i) => {
          const state = i < curIdx ? "done" : i === curIdx ? "current" : "locked";
          const meta = TIER_META[t];
          const NodeIcon = state === "done" ? Check : meta.Icon;

          const dotClass =
            state === "current"
              ? "border-spark bg-brand-subtle"
              : state === "done"
                ? "border-brand bg-brand-subtle"
                : "border-border-subtle bg-surface-sunken";
          const iconColor =
            state === "current" ? "#E8972B" : state === "done" ? "#423A82" : "#756E61";
          const nameClass =
            state === "current" ? "text-spark font-semibold" : "text-text-secondary";

          return (
            <View key={t} className="flex-1 items-center gap-2">
              <View
                className={"rounded-pill h-9 w-9 items-center justify-center border-2 " + dotClass}
              >
                <NodeIcon size={16} color={iconColor} />
              </View>
              <Text className={"text-2xs " + nameClass}>{meta.label}</Text>
              {state === "current" ? (
                <Text className="text-2xs text-spark font-mono uppercase tracking-wider">You</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tenant rank tile
// ---------------------------------------------------------------------------
function RankTile({ rank }: { rank: number | null }) {
  return (
    <Card className="flex-row items-center gap-4 p-5">
      <View className="bg-brand-subtle h-12 w-12 items-center justify-center rounded-lg">
        <Trophy size={22} color="#423A82" />
      </View>
      <View className="flex-1">
        <Text className="text-text-secondary text-sm">Your rank</Text>
        {rank != null ? (
          <Text className="font-display text-text-primary text-2xl font-semibold">
            #{rank}
            <Text className="text-text-muted text-sm font-normal"> in your academy</Text>
          </Text>
        ) : (
          <Text className="text-text-primary mt-0.5 text-base">
            Not ranked yet — earn some points to join the board.
          </Text>
        )}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Recent achievements row
// ---------------------------------------------------------------------------
function RecentAchievements({
  items,
  unseenCount,
}: {
  items: StudentAchievement[];
  unseenCount: number;
}) {
  return (
    <View className="gap-3">
      <SectionHeader
        title="Recent achievements"
        action={unseenCount > 0 ? <Badge variant="spark">{unseenCount} new</Badge> : undefined}
      />

      {items.length === 0 ? (
        <Card className="p-5">
          <View className="flex-row items-center gap-3">
            <Award size={22} color="#756E61" />
            <View className="flex-1">
              <Text className="text-text-primary text-sm font-medium">
                No badges yet — your first one is close.
              </Text>
              <Text className="text-text-secondary mt-0.5 text-xs">
                Finish a story point or pass a test to unlock one.
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(it) => it.id}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 pr-2"
          renderItem={({ item }) => <AchievementBadge item={item} />}
        />
      )}
    </View>
  );
}

function AchievementBadge({ item }: { item: StudentAchievement }) {
  const meta = TIER_META[item.achievement.tier] ?? TIER_META.bronze;
  const TierIcon = meta.Icon;
  return (
    <Card className="w-36 items-center gap-2 p-4">
      <View className="rounded-pill border-spark bg-brand-subtle h-12 w-12 items-center justify-center border-2">
        <TierIcon size={22} color="#E8972B" />
      </View>
      <Text numberOfLines={2} className="text-text-primary text-center text-xs font-medium">
        {item.achievement.title}
      </Text>
      <Badge variant="neutral">{meta.label}</Badge>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Active goals mini-list
// ---------------------------------------------------------------------------
function ActiveGoals({ goals }: { goals: StudyGoal[] }) {
  const active = useMemo(() => goals.filter((g) => !g.completed), [goals]);

  return (
    <View className="gap-3">
      <SectionHeader title="Active goals" />

      {active.length === 0 ? (
        <EmptyState
          icon={<Target size={28} color="#423A82" />}
          title="No active goals."
          body="Set a goal to give your XP a direction."
        />
      ) : (
        <View className="gap-3">
          {active.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </View>
      )}
    </View>
  );
}

function GoalRow({ goal }: { goal: StudyGoal }) {
  const pct = goal.targetCount > 0 ? clampPct((goal.currentCount / goal.targetCount) * 100) : 0;
  return (
    <Card className="gap-2 p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text numberOfLines={1} className="text-text-primary flex-1 text-sm font-medium">
          {goal.title}
        </Text>
        <Text className="text-text-muted font-mono text-xs">
          {goal.currentCount}/{goal.targetCount} {TARGET_LABEL[goal.targetType] ?? goal.targetType}
        </Text>
      </View>
      <ProgressBar value={pct} variant="brand" height={8} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading / Error states
// ---------------------------------------------------------------------------
function LoadingState() {
  return (
    <View className="gap-5" accessibilityLabel="Loading your progress">
      <Card className="gap-4 p-6">
        <View className="flex-row items-center gap-4">
          <Skeleton variant="circle" width={64} height={64} />
          <View className="flex-1 gap-2">
            <Skeleton width="50%" height={18} />
            <Skeleton width="70%" height={12} />
          </View>
        </View>
        <Skeleton width="100%" height={14} radius={8} />
        <Skeleton width="40%" height={12} />
      </Card>
      <Card className="items-center gap-3 p-6">
        <Skeleton variant="circle" width={72} height={72} />
        <Skeleton width="40%" height={28} />
        <Skeleton width="60%" height={12} />
      </Card>
      <Card className="gap-3 p-5">
        <Skeleton width="45%" height={12} />
        <Skeleton width="100%" height={36} radius={8} />
      </Card>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="gap-3 p-6">
      <Text className="font-display text-text-primary text-lg font-semibold">
        We couldn{"'"}t load your progress just now.
      </Text>
      <Text className="text-text-secondary text-sm">
        Your XP, streak and badges are safe on our side — this is just a hiccup fetching them.
      </Text>
      <View className="mt-1 flex-row">
        <Button
          variant="secondary"
          leadingIcon={<RefreshCw size={15} color="#423A82" />}
          onPress={onRetry}
        >
          Try again
        </Button>
      </View>
    </Card>
  );
}
