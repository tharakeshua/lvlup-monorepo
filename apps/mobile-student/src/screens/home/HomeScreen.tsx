/**
 * Student Home Dashboard (mobile-student)
 * ----------------------------------------
 * The learner's landing screen. Translates the web `student-home-dashboard`
 * prototype into idiomatic RN + NativeWind (Lyceum "Modern Scholarly").
 *
 * Data (all via `@levelup/query` — never Firestore directly):
 *  - `useStudentSummary(uid)`  → cross-domain learner summary
 *      `{ studentSummary: StudentProgressSummary, recentInsights: [] }`.
 *      Drives the KPI strip, "pick up where you left off", and quick stats.
 *  - `useSpaces()`             → the learner's spaces list (My Spaces section).
 *  - `useStudentLevel(uid)`    → gamification card (level / XP / streak).
 *
 * Hook payloads are typed `unknown`, so every field is read through the small
 * defensive helpers below — a missing field degrades to a gentle fallback,
 * never a crash. Renders loading / error / empty / success states.
 *
 * The signed-in uid comes from the session, not from any query.
 */
import React from "react";
import { View, Text, Pressable } from "react-native";

import { useStudentSummary, useSpaces, useStudentLevel } from "@levelup/query";
import { asUserId } from "@levelup/domain";
import { useRouter } from "expo-router";

import {
  Screen,
  Card,
  Button,
  IconButton,
  Icon,
  Avatar,
  Badge,
  Ring,
  StatTile,
  SectionHeader,
  Skeleton,
  EmptyState,
  XPChip,
  StreakChip,
  Divider,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { useSession } from "../../sdk/session";

// ── defensive readers (hook data is `unknown`) ──────────────────────────────
const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** A list hook may return `T[]`, `{ items: T[] }`, or `{ spaces: T[] }`. */
const asList = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  const o = obj(v);
  if (Array.isArray(o.items)) return o.items;
  if (Array.isArray(o.spaces)) return o.spaces;
  if (Array.isArray(o.data)) return o.data;
  return [];
};

const pct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

const firstName = (full: string): string => {
  const t = full.trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? t;
};

const greetingPrefix = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

// ── normalized view shapes ──────────────────────────────────────────────────
interface SpaceView {
  id: string;
  title: string;
  description: string;
  points: number;
  progress: number;
  spark: boolean;
}

const toSpaceView = (raw: unknown): SpaceView => {
  const s = obj(raw);
  const progressSrc = s.progress ?? s.progressPct ?? s.completion ?? s.averageCompletion ?? 0;
  return {
    id: str(s.id ?? s.spaceId),
    title: str(s.title ?? s.name, "Untitled space"),
    description: str(s.description ?? s.summary),
    points: num(s.totalStoryPoints ?? s.storyPointCount ?? s.points),
    progress: pct(num(progressSrc)),
    spark: Boolean(s.spark),
  };
};

// ── small presentational helpers ────────────────────────────────────────────
function KpiSkeleton(): React.JSX.Element {
  return (
    <View className="mb-3 w-[48%]">
      <Card>
        <Skeleton width="60%" height={12} />
        <View className="h-2" />
        <Skeleton width="45%" height={26} />
        <View className="h-2" />
        <Skeleton width="75%" height={10} />
      </Card>
    </View>
  );
}

function CardSkeleton(): React.JSX.Element {
  return (
    <Card className="mb-4">
      <Skeleton width="50%" height={16} />
      <View className="h-3" />
      <Skeleton width="100%" height={10} />
      <View className="h-2" />
      <Skeleton width="85%" height={10} />
      <View className="h-4" />
      <Skeleton width="40%" height={40} radius={12} />
    </Card>
  );
}

// ── screen ──────────────────────────────────────────────────────────────────
export default function StudentHomeDashboard(): React.JSX.Element {
  const router = useRouter();
  const { user } = useSession();
  // Auth ids arrive as plain strings; the progress/gamification hooks want a
  // branded UserId. The auth boundary IS the trust boundary — brand via factory.
  const uid = asUserId(user?.uid ?? "");

  const summaryQuery = useStudentSummary(uid);
  const spacesQuery = useSpaces();
  const levelQuery = useStudentLevel(uid);

  // ── derive summary fields (defensively) ──
  const summaryRoot = obj(summaryQuery.data);
  const summary = obj(summaryRoot.studentSummary ?? summaryRoot);
  const autograde = obj(summary.autograde);
  const levelup = obj(summary.levelup);

  const overallScore = pct(num(summary.overallScore) * 100);
  const avgExam = pct(num(autograde.averagePercentage));
  const spaceCompletion = pct(num(levelup.averageCompletion));
  const streakDays = num(levelup.streakDays);
  const bestStreak = num(levelup.bestStreakDays ?? levelup.longestStreakDays);
  const totalPoints = num(levelup.totalPointsEarned);
  const completedExams = num(autograde.completedExams);
  const completedSpaces = num(levelup.completedSpaces);
  const totalSpacesCount = num(levelup.totalSpaces);
  const isAtRisk = Boolean(summary.isAtRisk);

  const recentActivity = arr(levelup.recentActivity);
  const firstRecent = obj(recentActivity[0]);

  // ── gamification level ──
  const level = obj(levelQuery.data);
  const levelNum = num(level.level);
  const currentXP = num(level.currentXP);
  const xpToNext = num(level.xpToNextLevel);
  const totalXP = num(level.totalXP);
  const xpRingValue = xpToNext > 0 ? pct((currentXP / (currentXP + xpToNext)) * 100) : 0;

  // ── spaces ──
  const spaces: SpaceView[] = asList(spacesQuery.data)
    .map(toSpaceView)
    .filter((s) => s.id.length > 0);

  // ── greeting name ──
  const displayName =
    firstName(str(user?.displayName)) ||
    firstName(str(summary.studentName ?? summary.name)) ||
    "there";

  // ── resume target: most-recent activity, else first space ──
  const resumeSpaceId = str(firstRecent.spaceId) || spaces[0]?.id || "";
  const resumeTitle = str(firstRecent.spaceTitle) || spaces[0]?.title || "Your first space";
  const resumeProgress = resumeSpaceId
    ? (spaces.find((s) => s.id === resumeSpaceId)?.progress ?? pct(num(firstRecent.progress)))
    : 0;

  // ── top bar (shared across all states) ──
  const topBar = (
    <View className="mb-4 flex-row items-center justify-between">
      <View className="mr-3 flex-1 flex-row items-center">
        <Avatar initials={(displayName[0] ?? "S").toUpperCase()} size="sm" />
        <View className="ml-3 flex-1">
          <Text className="font-ui text-text-primary text-sm font-semibold" numberOfLines={1}>
            {str(user?.displayName) || displayName}
          </Text>
          <Text className="text-text-muted text-xs" numberOfLines={1}>
            Student
          </Text>
        </View>
      </View>
      <IconButton
        icon="bell"
        label="Notifications"
        onPress={() => router.push(routes.notifications())}
      />
    </View>
  );

  // ── tutor FAB (floats over the scroll) ──
  const tutorFab = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open tutor"
      onPress={() => router.push(routes.tutorPicker())}
      className="bg-brand rounded-pill absolute bottom-6 right-5 items-center justify-center"
      style={{
        width: 56,
        height: 56,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Icon name="message-circle" size={24} color="#FFFFFF" />
    </Pressable>
  );

  // ── LOADING ──
  if (summaryQuery.isLoading || spacesQuery.isLoading) {
    return (
      <View className="bg-canvas flex-1">
        <Screen>
          {topBar}
          <Skeleton width="65%" height={28} />
          <View className="h-2" />
          <Skeleton width="45%" height={14} />
          <View className="h-5" />
          <View className="flex-row flex-wrap justify-between">
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </View>
          <View className="h-2" />
          <CardSkeleton />
          <CardSkeleton />
        </Screen>
      </View>
    );
  }

  // ── ERROR ──
  // A fresh real account has no derived summary/level doc yet (NOT_FOUND) and a
  // pre-autologin read is UNAUTHENTICATED — neither is a real failure, so they
  // fall through to render the dashboard with zeroed stats (the defensive
  // readers above already default every field). Only a genuine error shows this.
  if (isHardError(summaryQuery) || isHardError(spacesQuery)) {
    const retry = () => {
      if (summaryQuery.isError) void summaryQuery.refetch();
      if (spacesQuery.isError) void spacesQuery.refetch();
    };
    return (
      <View className="bg-canvas flex-1">
        <Screen>
          {topBar}
          <EmptyState
            icon="cloud-off"
            title="We’re having trouble loading your dashboard"
            body="Let’s try again — this one’s on us, not you."
            action={
              <Button variant="primary" leadingIcon="rotate-cw" onPress={retry}>
                Retry
              </Button>
            }
          />
        </Screen>
      </View>
    );
  }

  // ── EMPTY (no spaces) ──
  if (spaces.length === 0) {
    return (
      <View className="bg-canvas flex-1">
        <Screen>
          {topBar}
          <Text className="font-display text-text-primary text-2xl">
            {greetingPrefix()}, {displayName} 👋
          </Text>
          <Text className="text-text-secondary mb-5 mt-1">
            Ready to pick up where you left off?
          </Text>
          <EmptyState
            icon="book-open"
            title="No spaces yet"
            body="Your learning spaces will appear here once your teacher assigns them. In the meantime, explore your profile."
            action={
              <Button
                variant="secondary"
                leadingIcon="user"
                onPress={() => router.push(routes.profile())}
              >
                Explore your profile
              </Button>
            }
          />
        </Screen>
        {tutorFab}
      </View>
    );
  }

  // ── SUCCESS ──
  return (
    <View className="bg-canvas flex-1">
      <Screen>
        {topBar}

        {/* GREETING */}
        <View className="mb-5">
          <Text className="font-display text-text-primary text-3xl">
            {greetingPrefix()}, {displayName} 👋
          </Text>
          <Text className="text-text-secondary mt-1">
            {streakDays > 0
              ? `You’re on a ${streakDays}-day streak — let’s keep it going 🔥`
              : "Let’s make today count."}
          </Text>
        </View>

        {/* KPI STRIP */}
        <View className="flex-row flex-wrap justify-between">
          <View className="mb-3 w-[48%]">
            <StatTile icon="gauge" label="Overall Score" value={`${overallScore}%`} />
          </View>
          <View className="mb-3 w-[48%]">
            <StatTile icon="file-check" label="Avg Exam Score" value={`${avgExam}%`} />
          </View>
          <View className="mb-3 w-[48%]">
            <StatTile icon="book-open" label="Space Completion" value={`${spaceCompletion}%`} />
          </View>
          <View className="mb-3 w-[48%]">
            <StatTile icon="flame" label="Current Streak" value={`${streakDays}d`} />
          </View>
        </View>

        {/* PICK UP WHERE YOU LEFT OFF */}
        {resumeSpaceId.length > 0 && (
          <Card className="mb-4 mt-2">
            <Text className="text-text-muted text-xs font-semibold uppercase">
              Next best action
            </Text>
            <Text className="font-display text-text-primary mt-1 text-xl">
              Pick up where you left off
            </Text>
            <View className="mt-4 flex-row items-center">
              <Ring value={resumeProgress} size={64} label={`${resumeProgress}%`} />
              <View className="ml-4 flex-1">
                <Text
                  className="font-ui text-text-primary text-base font-semibold"
                  numberOfLines={2}
                >
                  {resumeTitle}
                </Text>
                <View className="mt-2 flex-row">
                  <Badge variant="brand" icon="zap">
                    In progress
                  </Badge>
                </View>
              </View>
            </View>
            <View className="mt-4">
              <Button
                variant="spark"
                size="lg"
                trailingIcon="arrow-right"
                block
                onPress={() => router.push(routes.space(resumeSpaceId))}
              >
                Continue
              </Button>
            </View>
          </Card>
        )}

        {/* GAMIFICATION */}
        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Ring value={xpRingValue} size={56} label={`L${levelNum}`} />
              <View className="ml-3">
                <Text className="font-ui text-text-primary text-base font-semibold">
                  Level {levelNum}
                </Text>
                <Text className="text-text-muted text-xs">
                  {xpToNext > 0 ? `${xpToNext} XP to next level` : `${totalXP} XP total`}
                </Text>
              </View>
            </View>
            <XPChip xp={currentXP > 0 ? currentXP : totalXP} />
          </View>
          <Divider className="my-3" />
          <View className="flex-row items-center justify-between">
            <Text className="font-ui text-text-secondary text-sm font-semibold">Streak</Text>
            <StreakChip days={streakDays} />
          </View>
        </Card>

        {/* QUICK STATS */}
        <Card className="mb-4">
          <View className="mb-3 flex-row items-center">
            {isAtRisk ? (
              <Badge variant="warning" icon="alert-triangle">
                A couple of exams are coming up — want to review?
              </Badge>
            ) : (
              <Badge variant="success" icon="target">
                You’re on track 🎯
              </Badge>
            )}
          </View>
          <View className="flex-row justify-between">
            <View className="flex-1">
              <Text className="text-text-muted text-xs">Points earned</Text>
              <Text className="text-text-primary mt-1 font-mono text-2xl">
                {totalPoints.toLocaleString()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-text-muted text-xs">Exams completed</Text>
              <Text className="text-text-primary mt-1 font-mono text-2xl">{completedExams}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text-muted text-xs">Spaces done</Text>
              <Text className="text-text-primary mt-1 font-mono text-2xl">
                {completedSpaces}
                {totalSpacesCount > 0 ? `/${totalSpacesCount}` : ""}
              </Text>
            </View>
          </View>
          {bestStreak > 0 && (
            <Text className="text-text-muted mt-3 text-xs">Best streak: {bestStreak} days</Text>
          )}
        </Card>

        {/* MY SPACES */}
        <SectionHeader title="My Spaces" />
        <View className="mt-2">
          {spaces.map((space) => (
            <Card
              key={space.id}
              className="mb-3"
              onPress={() => router.push(routes.space(space.id))}
            >
              <View className="flex-row items-center">
                <View className="mr-3 flex-1">
                  <Text
                    className="font-ui text-text-primary text-base font-semibold"
                    numberOfLines={1}
                  >
                    {space.title}
                  </Text>
                  {space.description.length > 0 && (
                    <Text className="text-text-muted mt-1 text-xs" numberOfLines={2}>
                      {space.description}
                    </Text>
                  )}
                  {space.points > 0 && (
                    <Text className="text-text-muted mt-1 text-xs">
                      {space.points} story points
                    </Text>
                  )}
                </View>
                <Ring
                  value={space.progress}
                  size={48}
                  label={space.progress >= 100 ? "✓" : `${space.progress}%`}
                />
              </View>
            </Card>
          ))}
        </View>

        <View className="h-16" />
      </Screen>

      {tutorFab}
    </View>
  );
}
