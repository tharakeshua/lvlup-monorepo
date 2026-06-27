/**
 * Achievements — the learner's "trophy room": a wall of badge cards, earned
 * ones richly colored by rarity, locked ones muted with their how-to-earn copy.
 * Category filter pills scope the wall. Newly-earned (unseen) unlocks get a spark
 * treatment and are acknowledged via `useMarkAchievementsSeen({ all:true })` once
 * the wall mounts.
 *
 * Data (NO firebase — only @levelup/query):
 *   • useStudentAchievements()  — infinite; the caller's unlock records (earned).
 *   • useAchievementCatalog()   — infinite; full definition wall + earned flag (locked).
 *   • useMarkAchievementsSeen() — mark-read mutation (clears the "new" treatment).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Lucide from "lucide-react-native";
import type {
  Achievement,
  AchievementCategory,
  AchievementRarity,
  AchievementTier,
  StudentAchievement,
} from "@levelup/domain";
import {
  useAchievementCatalog,
  useMarkAchievementsSeen,
  useStudentAchievements,
  type GamificationAchievementWithEarnedState,
} from "@levelup/query";
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Screen,
  SectionHeader,
  Sheet,
  Skeleton,
} from "../../components";
import { isHardError } from "../../lib/query-status";

// ---------------------------------------------------------------------------
// rarity / tier visual maps (always icon + word + color — never color alone)
// ---------------------------------------------------------------------------
type BadgeVariant = "brand" | "neutral" | "success" | "warning" | "error" | "info" | "spark";

const RARITY: Record<
  AchievementRarity,
  { label: string; hex: string; badge: BadgeVariant; glyph: string }
> = {
  common: { label: "Common", hex: "#756E61", badge: "neutral", glyph: "circle" },
  uncommon: { label: "Uncommon", hex: "#2F7D5B", badge: "success", glyph: "sparkles" },
  rare: { label: "Rare", hex: "#2D6E8E", badge: "info", glyph: "gem" },
  epic: { label: "Epic", hex: "#423A82", badge: "brand", glyph: "diamond" },
  legendary: { label: "Legendary", hex: "#E8972B", badge: "spark", glyph: "crown" },
};

const TIER: Record<AchievementTier, { label: string; glyph: string }> = {
  bronze: { label: "Bronze", glyph: "shield" },
  silver: { label: "Silver", glyph: "shield-half" },
  gold: { label: "Gold", glyph: "shield-check" },
  platinum: { label: "Platinum", glyph: "shield-plus" },
  diamond: { label: "Diamond", glyph: "gem" },
};

const CATEGORY_META: Record<AchievementCategory, { label: string; glyph: string }> = {
  learning: { label: "Learning", glyph: "book-open" },
  consistency: { label: "Consistency", glyph: "flame" },
  excellence: { label: "Excellence", glyph: "target" },
  exploration: { label: "Exploration", glyph: "compass" },
  social: { label: "Social", glyph: "users" },
  milestone: { label: "Milestone", glyph: "flag" },
};

const CATEGORY_ORDER: AchievementCategory[] = [
  "learning",
  "consistency",
  "excellence",
  "exploration",
  "social",
  "milestone",
];

// ---------------------------------------------------------------------------
// lucide kebab-name → component resolver (Achievement.icon is a free string)
// ---------------------------------------------------------------------------
type LucideComp = (p: { size?: number; color?: string; strokeWidth?: number }) => JSX.Element;

function resolveIcon(name?: string): LucideComp {
  if (!name) return Lucide.Award as unknown as LucideComp;
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const lib = Lucide as unknown as Record<string, LucideComp | undefined>;
  return lib[pascal] ?? (Lucide.Award as unknown as LucideComp);
}

const withAlpha = (hex: string, alpha: string) => `${hex}${alpha}`;

// Coerce any deployed/canonical timestamp shape (Firestore Timestamp,
// {seconds}, ISO string, epoch ms) → Date|null. Never throws. (Migration §2.4)
const toDateSafe = (t: unknown): Date | null => {
  if (t == null) return null;
  const maybe = t as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === "function") {
    try {
      const d = maybe.toDate();
      return Number.isNaN(d?.getTime?.()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof maybe.seconds === "number") return new Date(maybe.seconds * 1000);
  const d = new Date(t as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDate = (iso: unknown): string => {
  const d = toDateSafe(iso);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
};

// ---------------------------------------------------------------------------
// medal — the circular badge glyph (colored when earned, muted when locked)
// ---------------------------------------------------------------------------
function Medal({
  achievement,
  locked,
  highlight,
}: {
  achievement: Achievement;
  locked: boolean;
  highlight?: boolean;
}) {
  const rarity = RARITY[achievement.rarity] ?? RARITY.common;
  const Glyph = resolveIcon(achievement.icon);
  const Lock = resolveIcon("lock");
  return (
    <View
      className="rounded-pill h-16 w-16 items-center justify-center border"
      style={{
        backgroundColor: locked ? "#F4EEE4" : withAlpha(rarity.hex, "1F"),
        borderColor: locked ? "#D6C9B4" : rarity.hex,
        ...(highlight ? { shadowColor: "#E8972B", shadowOpacity: 0.5, shadowRadius: 10 } : null),
      }}
    >
      <Glyph size={28} color={locked ? "#A89C86" : rarity.hex} strokeWidth={1.9} />
      {locked ? (
        <View
          className="rounded-pill border-border-subtle absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center border"
          style={{ backgroundColor: "#FFFDFA" }}
        >
          <Lock size={12} color="#756E61" strokeWidth={2} />
        </View>
      ) : null}
    </View>
  );
}

function RarityTierRow({ achievement }: { achievement: Achievement }) {
  const rarity = RARITY[achievement.rarity] ?? RARITY.common;
  const tier = TIER[achievement.tier] ?? TIER.bronze;
  const RarityGlyph = resolveIcon(rarity.glyph);
  const TierGlyph = resolveIcon(tier.glyph);
  return (
    <View className="flex-row flex-wrap items-center justify-center gap-1.5">
      <Badge variant={rarity.badge} icon={<RarityGlyph size={11} color={rarity.hex} />}>
        {rarity.label}
      </Badge>
      <Badge variant="neutral" icon={<TierGlyph size={11} color="#756E61" />}>
        {tier.label}
      </Badge>
    </View>
  );
}

// ---------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------
type WallItem =
  | { kind: "earned"; achievement: Achievement; earnedAt: unknown; seen: boolean; key: string }
  | { kind: "locked"; achievement: Achievement; key: string };

function EarnedCard({
  achievement,
  earnedAt,
  isNew,
  onPress,
}: {
  achievement: Achievement;
  earnedAt: unknown;
  isNew: boolean;
  onPress: () => void;
}) {
  const Cal = resolveIcon("calendar-check");
  const Spark = resolveIcon("sparkles");
  const Zap = resolveIcon("zap");
  return (
    <Pressable onPress={onPress} className="mb-3 w-[48%]" accessibilityRole="button">
      <Card
        className="items-center px-3 pb-4 pt-5"
        style={isNew ? { borderColor: "#E8972B", borderWidth: 1.5 } : undefined}
      >
        {isNew ? (
          <View className="rounded-pill bg-spark/15 absolute right-2 top-2 flex-row items-center gap-1 px-2 py-0.5">
            <Spark size={10} color="#E8972B" />
            <Text className="text-2xs font-ui text-spark font-semibold uppercase">New</Text>
          </View>
        ) : null}
        <Medal achievement={achievement} locked={false} highlight={isNew} />
        <Text
          className="font-display text-text-primary mt-3 text-center text-base font-semibold"
          numberOfLines={2}
        >
          {achievement.title}
        </Text>
        <View className="mt-2">
          <RarityTierRow achievement={achievement} />
        </View>
        <View className="mt-3 flex-row items-center gap-1">
          <Cal size={12} color="#756E61" />
          <Text className="text-2xs text-text-muted font-mono">Earned {fmtDate(earnedAt)}</Text>
        </View>
        {achievement.pointsReward > 0 ? (
          <View className="mt-2">
            <Badge variant="spark" icon={<Zap size={11} color="#E8972B" />}>
              +{achievement.pointsReward} XP
            </Badge>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function LockedCard({ achievement, onPress }: { achievement: Achievement; onPress: () => void }) {
  const Target = resolveIcon("target");
  return (
    <Pressable onPress={onPress} className="mb-3 w-[48%]" accessibilityRole="button">
      <Card className="items-center px-3 pb-4 pt-5">
        <Medal achievement={achievement} locked />
        <Text
          className="font-display text-text-secondary mt-3 text-center text-base font-semibold"
          numberOfLines={2}
        >
          {achievement.title}
        </Text>
        <View className="mt-2">
          <RarityTierRow achievement={achievement} />
        </View>
        <View className="mt-3 w-full flex-row items-center justify-center gap-1">
          <Target size={12} color="#756E61" />
          <Text className="font-ui text-text-secondary text-center text-xs" numberOfLines={2}>
            {achievement.description}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// detail sheet
// ---------------------------------------------------------------------------
function DetailSheet({ item, onClose }: { item: WallItem | null; onClose: () => void }) {
  if (!item) return null;
  const a = item.achievement;
  const locked = item.kind === "locked";
  const rarity = RARITY[a.rarity] ?? RARITY.common;
  const Glyph = resolveIcon(a.icon);
  const Check = resolveIcon("check-circle-2");
  const Cal = resolveIcon("calendar-check");
  const Zap = resolveIcon("zap");
  return (
    <Sheet open onClose={onClose} title={a.title} side="bottom">
      <View className="gap-4 pb-2">
        <View className="flex-row items-center gap-4">
          <Medal achievement={a} locked={locked} />
          <View className="flex-1">
            <Text className="font-display text-text-primary text-xl font-semibold">{a.title}</Text>
            <Text className="font-ui text-text-secondary mt-1 text-sm">{a.description}</Text>
          </View>
        </View>

        <View className="flex-row flex-wrap items-center gap-2">
          <RarityTierRow achievement={a} />
          {a.pointsReward > 0 ? (
            <Badge variant="spark" icon={<Zap size={11} color="#E8972B" />}>
              +{a.pointsReward} XP
            </Badge>
          ) : null}
        </View>

        <View className="bg-surface-sunken rounded-md px-4 py-3">
          <View className="flex-row items-start gap-2">
            <Check size={15} color={rarity.hex} />
            <Text className="font-ui text-text-secondary flex-1 text-sm">
              <Text className="text-text-primary font-semibold">How to earn it: </Text>
              {criteriaCopy(a)}
            </Text>
          </View>
        </View>

        {locked ? (
          <Text className="font-ui text-text-secondary text-base">
            Keep going — every story point, streak day and exam nudges you closer.
          </Text>
        ) : item.kind === "earned" && fmtDate(item.earnedAt) ? (
          <View className="flex-row items-center gap-2">
            <Cal size={15} color="#2F7D5B" />
            <Text className="font-ui text-text-secondary text-base">
              Earned on {fmtDate(item.earnedAt)} — nicely done.
            </Text>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

function criteriaCopy(a: Achievement): string {
  const n = a.criteria?.threshold ?? 1;
  switch (a.criteria?.type) {
    case "spaces_completed":
      return `Complete ${n} space${n > 1 ? "s" : ""}.`;
    case "story_points_completed":
      return `Complete ${n} story point${n > 1 ? "s" : ""}.`;
    case "exams_passed":
      return `Pass ${n} graded exam${n > 1 ? "s" : ""}.`;
    case "perfect_scores":
      return `Score 100% on ${n} exam${n > 1 ? "s" : ""}.`;
    case "streak_days":
      return `Keep a ${n}-day learning streak alive.`;
    case "total_points":
      return `Earn ${n.toLocaleString()} total points.`;
    case "items_completed":
      return `Finish ${n} learning item${n > 1 ? "s" : ""}.`;
    case "chat_sessions":
      return `Have ${n} tutor chat session${n > 1 ? "s" : ""}.`;
    case "leaderboard_top3":
      return `Reach the top 3 on the leaderboard.`;
    case "login_days":
      return `Show up to learn on ${n} day${n > 1 ? "s" : ""}.`;
    default:
      return a.description;
  }
}

// ---------------------------------------------------------------------------
// states
// ---------------------------------------------------------------------------
function ChipsSkeleton() {
  return (
    <View className="flex-row gap-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} width={84} height={32} radius={16} />
      ))}
    </View>
  );
}

function GridSkeleton() {
  return (
    <View className="flex-row flex-wrap justify-between">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="mb-3 w-[48%]">
          <Card className="items-center gap-3 px-3 pb-4 pt-5">
            <Skeleton variant="circle" width={64} height={64} />
            <Skeleton width="60%" height={16} />
            <Skeleton width="80%" height={12} />
            <Skeleton width="100%" height={12} />
          </Card>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// screen
// ---------------------------------------------------------------------------
export default function AchievementsScreen() {
  const [category, setCategory] = useState<"all" | AchievementCategory>("all");
  const [detail, setDetail] = useState<WallItem | null>(null);

  const earnedQuery = useStudentAchievements();
  const catalogQuery = useAchievementCatalog();
  const markSeen = useMarkAchievementsSeen();

  // NOTE: these hooks are useInfiniteQuery at runtime (data = { pages: [{ items }] }),
  // but the SDK annotates the return as UseInfiniteQueryResult<Item> (first generic =
  // final data type), so `data` is mis-typed as a single item. Cast through unknown to
  // the real runtime shape and flatten. (types-lie per GATE-0 / migration note.)
  const earnedAll: StudentAchievement[] = useMemo(() => {
    const d = earnedQuery.data as unknown as
      | { pages?: Array<{ items?: StudentAchievement[] }> }
      | undefined;
    return d?.pages?.flatMap((p) => p.items ?? []) ?? [];
  }, [earnedQuery.data]);
  const catalogAll: GamificationAchievementWithEarnedState[] = useMemo(() => {
    const d = catalogQuery.data as unknown as
      | { pages?: Array<{ items?: GamificationAchievementWithEarnedState[] }> }
      | undefined;
    return d?.pages?.flatMap((p) => p.items ?? []) ?? [];
  }, [catalogQuery.data]);

  // acknowledge unseen unlocks once they've loaded.
  const ackedRef = useRef(false);
  const unseenCount = earnedAll.filter((e) => !e.seen).length;
  useEffect(() => {
    if (ackedRef.current) return;
    if (unseenCount > 0 && !markSeen.isPending) {
      ackedRef.current = true;
      markSeen.mutate({ all: true });
    }
  }, [unseenCount, markSeen]);

  // category counts from the full catalog (definition wall is authoritative).
  const categoryCounts = useMemo(() => {
    const m = new Map<AchievementCategory, number>();
    for (const a of catalogAll) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return m;
  }, [catalogAll]);

  const inCat = (c: AchievementCategory) => category === "all" || category === c;

  const earnedShown = useMemo(
    () =>
      earnedAll
        .filter((e) => inCat(e.achievement.category))
        // unseen first, then most-recent
        .sort((a, b) => {
          if (a.seen !== b.seen) return a.seen ? 1 : -1;
          return (
            (toDateSafe(b.earnedAt)?.getTime() ?? 0) - (toDateSafe(a.earnedAt)?.getTime() ?? 0)
          );
        }),
    [earnedAll, category]
  );

  const lockedShown = useMemo(
    () => catalogAll.filter((a) => !a.earned && inCat(a.category)),
    [catalogAll, category]
  );

  const isLoading = earnedQuery.isLoading || catalogQuery.isLoading;
  // Soft misses (no earned-unlocks doc yet / pre-autologin) fall through to the
  // catalog with an empty earned set; only a genuine failure on both reads errors.
  const isError = isHardError(earnedQuery) && isHardError(catalogQuery);
  const catalogEmpty = !catalogQuery.isLoading && !catalogQuery.isError && catalogAll.length === 0;
  const totalCatalog = catalogAll.length;
  const earnedCount = earnedAll.length;

  const Trophy = resolveIcon("trophy");
  const Grid = resolveIcon("grid-3x3");
  const Rocket = resolveIcon("rocket");
  const Cloud = resolveIcon("cloud-off");
  const Gift = resolveIcon("gift");
  const Spark = resolveIcon("sparkles");

  // ---- whole-screen states ----
  if (isLoading) {
    return (
      <Screen contentClassName="px-4 py-4 gap-5">
        <View className="gap-1">
          <Text className="font-display text-text-primary text-3xl font-semibold">
            Your achievements
          </Text>
          <Text className="font-ui text-text-secondary text-base">Loading your trophy room…</Text>
        </View>
        <ChipsSkeleton />
        <GridSkeleton />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen contentClassName="px-4 py-4 gap-5">
        <Text className="font-display text-text-primary text-3xl font-semibold">
          Your achievements
        </Text>
        <EmptyState
          icon={<Cloud size={28} color="#B23A36" />}
          title="We're having trouble loading your trophy room"
          body="Let's try again — this one's on us, not you."
          action={
            <Button
              variant="primary"
              leadingIcon="rotate-cw"
              onPress={() => {
                void earnedQuery.refetch();
                void catalogQuery.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      </Screen>
    );
  }

  if (catalogEmpty && earnedCount === 0) {
    return (
      <Screen contentClassName="px-4 py-4 gap-5">
        <Text className="font-display text-text-primary text-3xl font-semibold">
          Your achievements
        </Text>
        <EmptyState
          icon={<Gift size={28} color="#423A82" />}
          title="Achievements are on their way to your school"
          body="Your school hasn't set up badges yet — check back soon and your wins will start collecting here."
        />
      </Screen>
    );
  }

  const categoryHasNothing = earnedShown.length === 0 && lockedShown.length === 0;

  return (
    <Screen contentClassName="px-4 py-4 gap-6">
      {/* header */}
      <View className="gap-1">
        <Text className="font-display text-text-primary text-3xl font-semibold">
          Your achievements
        </Text>
        <View className="flex-row flex-wrap items-center gap-1">
          <Text className="text-text-secondary font-mono text-base">
            {earnedCount} of {Math.max(totalCatalog, earnedCount)} earned
          </Text>
          {unseenCount > 0 ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-text-secondary"> · </Text>
              <Spark size={13} color="#E8972B" />
              <Text className="font-ui text-spark text-base font-semibold">
                {unseenCount} new this week
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* category filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        <Chip active={category === "all"} onPress={() => setCategory("all")}>
          All {totalCatalog > 0 ? totalCatalog : ""}
        </Chip>
        {CATEGORY_ORDER.filter((c) => (categoryCounts.get(c) ?? 0) > 0).map((c) => {
          const meta = CATEGORY_META[c];
          const Glyph = resolveIcon(meta.glyph);
          return (
            <Chip
              key={c}
              active={category === c}
              leadingIcon={<Glyph size={13} color={category === c ? "#FFFDFA" : "#565046"} />}
              onPress={() => setCategory(c)}
            >
              {meta.label} {categoryCounts.get(c)}
            </Chip>
          );
        })}
      </ScrollView>

      {/* catalog partially failed but earned loaded — soft note */}
      {catalogQuery.isError && !earnedQuery.isError ? (
        <Card className="px-4 py-3">
          <Text className="font-ui text-text-secondary text-sm">
            Your earned badges are all here. We couldn't load the full collection right now.{" "}
            <Text className="text-brand font-semibold" onPress={() => void catalogQuery.refetch()}>
              Retry
            </Text>
          </Text>
        </Card>
      ) : null}

      {categoryHasNothing ? (
        <EmptyState
          icon={<Trophy size={28} color="#E8972B" />}
          title="Nothing here yet — but it's coming"
          body="Keep learning and badges in this category will show up here."
          action={
            <Button
              variant="secondary"
              leadingIcon={<Grid size={16} color="#423A82" />}
              onPress={() => setCategory("all")}
            >
              Back to all
            </Button>
          }
        />
      ) : (
        <>
          {/* EARNED */}
          {earnedShown.length > 0 ? (
            <View className="gap-3">
              <SectionHeader title={`Earned (${earnedShown.length})`} />
              <View className="flex-row flex-wrap justify-between">
                {earnedShown.map((e) => (
                  <EarnedCard
                    key={e.id}
                    achievement={e.achievement}
                    earnedAt={e.earnedAt}
                    isNew={!e.seen}
                    onPress={() =>
                      setDetail({
                        kind: "earned",
                        achievement: e.achievement,
                        earnedAt: e.earnedAt,
                        seen: e.seen,
                        key: e.id,
                      })
                    }
                  />
                ))}
              </View>
              {earnedQuery.hasNextPage ? (
                <Button
                  variant="ghost"
                  loading={earnedQuery.isFetchingNextPage}
                  onPress={() => void earnedQuery.fetchNextPage()}
                >
                  Show more earned
                </Button>
              ) : null}
            </View>
          ) : earnedCount === 0 && category === "all" ? (
            <EmptyState
              icon={<Trophy size={28} color="#E8972B" />}
              title="Your first badge is closer than you think"
              body="Finish a story point or keep your streak alive to start your collection."
              action={
                <Button variant="spark" leadingIcon={<Rocket size={16} color="#FFFDFA" />}>
                  Start a story point
                </Button>
              }
            />
          ) : null}

          {/* KEEP GOING (locked) */}
          {lockedShown.length > 0 ? (
            <View className="gap-3">
              <SectionHeader title={`Keep going (${lockedShown.length})`} />
              <View className="flex-row flex-wrap justify-between">
                {lockedShown.map((a) => (
                  <LockedCard
                    key={a.id}
                    achievement={a}
                    onPress={() => setDetail({ kind: "locked", achievement: a, key: a.id })}
                  />
                ))}
              </View>
              {catalogQuery.hasNextPage ? (
                <Button
                  variant="ghost"
                  loading={catalogQuery.isFetchingNextPage}
                  onPress={() => void catalogQuery.fetchNextPage()}
                >
                  Show more
                </Button>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <View className="h-6" />

      <DetailSheet item={detail} onClose={() => setDetail(null)} />
    </Screen>
  );
}
