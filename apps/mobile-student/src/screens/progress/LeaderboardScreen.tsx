/**
 * Leaderboard — Progress lane (mobile-student).
 *
 * Friendly, low-pressure class ranking. Renders from the point-in-time snapshot
 * (`useLeaderboardSnapshot`) and keeps it warm with the realtime subscription
 * (`useGamificationLeaderboardLive`). A pinned, highlighted "you" row surfaces the
 * caller's standing even when they sit far down the board.
 *
 * Data only via @levelup/query. No firebase imports.
 */
import {
  ArrowUp,
  BookOpen,
  CloudOff,
  Crown,
  Flame,
  Globe,
  ListOrdered,
  Medal,
  RotateCw,
  Trophy,
} from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { useGamificationLeaderboardLive, useLeaderboardSnapshot } from "@levelup/query";
import type { LeaderboardEntry, LeaderboardScope } from "@levelup/domain";

import { Avatar, Badge, Card, EmptyState, Screen, Skeleton } from "../../components";
import { isHardError } from "../../lib/query-status";

// Theme token hexes (for lucide icons, which take a `color` prop not className).
const C = {
  spark: "#E8972B",
  brand: "#423A82",
  success: "#2F7D5B",
  muted: "#756E61",
  silver: "#9AA0A6",
  bronze: "#B07A3C",
} as const;

type ScopeKey = LeaderboardScope;

const SCOPES: { key: ScopeKey; label: string; Icon: typeof Globe }[] = [
  { key: "tenant", label: "Overall", Icon: Globe },
  { key: "space", label: "By Space", Icon: BookOpen },
  { key: "storyPoint", label: "By Topic", Icon: ListOrdered },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function medalColor(rank: number): string | null {
  if (rank === 1) return C.spark;
  if (rank === 2) return C.silver;
  if (rank === 3) return C.bronze;
  return null;
}

/* ----------------------------- Scope toggle ----------------------------- */
function ScopeToggle({ scope, onChange }: { scope: ScopeKey; onChange: (s: ScopeKey) => void }) {
  return (
    <View className="rounded-pill border-border-subtle bg-surface-sunken flex-row gap-1 border p-1">
      {SCOPES.map(({ key, label, Icon }) => {
        const active = key === scope;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(key)}
            className={`rounded-pill flex-1 flex-row items-center justify-center gap-1.5 px-2 py-2.5 ${
              active ? "bg-surface" : ""
            }`}
            style={
              active
                ? {
                    shadowColor: "#000",
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }
                : undefined
            }
          >
            <Icon size={15} color={active ? C.brand : C.muted} />
            <Text
              className={`text-sm ${
                active ? "font-ui text-brand font-semibold" : "font-ui text-text-secondary"
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------- Row ----------------------------------- */
function LeaderRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const top = entry.rank <= 3;
  const medal = medalColor(entry.rank);

  return (
    <View
      accessibilityLabel={`Rank ${entry.rank}, ${
        isMe ? "you, " : ""
      }${entry.displayName}, ${entry.totalPoints.toLocaleString()} points`}
      className={`border-border-subtle flex-row items-center gap-3 border-b px-4 py-3 ${
        isMe ? "bg-brand-subtle" : top ? "bg-marigold-50" : "bg-surface"
      }`}
      style={isMe ? { borderColor: C.brand, borderWidth: 1.5, borderRadius: 12 } : undefined}
    >
      {/* Rank + medal */}
      <View className="w-9 flex-row items-center gap-1">
        {entry.rank === 1 ? (
          <Crown size={15} color={C.spark} />
        ) : medal ? (
          <Medal size={15} color={medal} />
        ) : null}
        <Text
          className={`font-mono text-sm font-semibold ${
            top ? "text-spark" : "text-text-secondary"
          }`}
        >
          {entry.rank}
        </Text>
      </View>

      <Avatar initials={initialsOf(entry.displayName)} size="sm" />

      {/* Name + meta */}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className={`text-text-primary flex-shrink text-sm ${
              isMe ? "font-semibold" : "font-medium"
            }`}
          >
            {entry.displayName}
          </Text>
          {isMe ? <Badge variant="brand">You</Badge> : null}
          {top && entry.tier ? <Badge variant="spark">{entry.tier}</Badge> : null}
        </View>
        {entry.streakDays > 0 ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Flame size={11} color={C.spark} />
            <Text className="text-2xs text-text-muted">{entry.streakDays}-day streak</Text>
          </View>
        ) : null}
      </View>

      {/* Points / score */}
      <View className="items-end">
        <Text className="text-text-primary font-mono text-sm font-semibold">
          {entry.totalPoints.toLocaleString()}
          <Text className="text-2xs text-text-muted font-normal"> pts</Text>
        </Text>
        {typeof entry.overallScore === "number" ? (
          <Text className="text-2xs text-text-muted">{Math.round(entry.overallScore)} score</Text>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------- Hero ----------------------------------- */
function StandingHero({ caller }: { caller: LeaderboardEntry | null }) {
  return (
    <Card>
      <View className="p-5">
        <Text className="text-2xs text-text-muted font-semibold uppercase tracking-wider">
          Your standing
        </Text>
        {caller ? (
          <>
            <Text className="text-text-primary mt-1 font-mono text-3xl font-semibold">
              #{caller.rank}
            </Text>
            <View className="mt-2 flex-row flex-wrap items-center gap-3">
              {caller.tier ? <Badge variant="brand">{caller.tier} tier</Badge> : null}
              <Text className="text-text-primary font-mono text-sm font-semibold">
                {caller.totalPoints.toLocaleString()}
                <Text className="text-2xs text-text-muted font-normal"> pts</Text>
              </Text>
              {caller.streakDays > 0 ? (
                <View className="flex-row items-center gap-1">
                  <Flame size={13} color={C.spark} />
                  <Text className="text-spark text-xs font-semibold">
                    {caller.streakDays}-day streak
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <Text className="text-text-secondary mt-2 text-base font-semibold leading-snug">
            Not ranked yet — earn your first points to join the board.
          </Text>
        )}
      </View>
    </Card>
  );
}

/* ------------------------------- States --------------------------------- */
function LoadingState() {
  return (
    <View className="gap-4">
      <Card>
        <View className="gap-2 p-5">
          <Skeleton width={120} height={10} />
          <Skeleton width={90} height={28} />
        </View>
      </Card>
      <Card>
        <View>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              className="border-border-subtle flex-row items-center gap-3 border-b px-4 py-3"
            >
              <Skeleton variant="circle" width={22} height={22} />
              <Skeleton variant="circle" width={32} height={32} />
              <View className="flex-1">
                <Skeleton width={`${55 - i * 5}%`} height={12} />
              </View>
              <Skeleton width={56} height={12} />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

/* ------------------------------- Screen --------------------------------- */
export default function LeaderboardScreen() {
  const [scope, setScope] = useState<ScopeKey>("tenant");

  const snapshot = useLeaderboardSnapshot({ scope });
  const live = useGamificationLeaderboardLive({ scope });

  const items = snapshot.data?.items ?? [];
  const caller = snapshot.data?.callerEntry ?? null;
  const callerInList = caller != null && items.some((e) => e.userId === caller.userId);

  const scopeLabel = SCOPES.find((s) => s.key === scope)?.label ?? "Overall";
  const isLive = live.status === "live";

  const header = (
    <View className="gap-5">
      {/* Title */}
      <View className="flex-row items-center gap-3">
        <View className="bg-marigold-50 h-11 w-11 items-center justify-center rounded-lg">
          <Trophy size={24} color={C.spark} />
        </View>
        <View className="flex-1">
          <Text className="font-display text-text-primary text-3xl font-semibold">Leaderboard</Text>
          <Text className="text-text-secondary mt-0.5 text-base">
            See how you’re tracking with your class — friendly, no pressure.
          </Text>
        </View>
      </View>

      <StandingHero caller={caller} />

      <ScopeToggle scope={scope} onChange={setScope} />

      {/* List header + live pill */}
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-2xs text-text-muted font-semibold uppercase tracking-wider">
          {scopeLabel} rankings
        </Text>
        <View className="flex-row items-center gap-1.5">
          <View className={`rounded-pill h-2 w-2 ${isLive ? "bg-success" : "bg-text-muted"}`} />
          <Text className="text-text-muted text-xs">
            {isLive ? "Live" : live.status === "error" ? "Reconnecting…" : "Syncing…"}
          </Text>
        </View>
      </View>
    </View>
  );

  // ---- Error (whole board): never blame the learner ----
  // A missing snapshot for a fresh space/account is a soft miss → fall through
  // to the (defensive, empty-tolerant) list. Only a real failure errors out.
  if (isHardError(snapshot)) {
    return (
      <Screen contentClassName="gap-5">
        {header}
        <EmptyState
          icon={<CloudOff size={28} color={C.muted} />}
          title="We couldn’t load the leaderboard just now"
          body="Let’s try again — this one’s on us, not you."
          action={
            <Pressable
              onPress={() => snapshot.refetch()}
              className="rounded-pill bg-brand flex-row items-center gap-2 px-4 py-2.5"
            >
              <RotateCw size={16} color="#FFFDFA" />
              <Text className="font-ui text-text-on-accent text-sm font-semibold">Retry</Text>
            </Pressable>
          }
        />
      </Screen>
    );
  }

  // ---- Loading ----
  if (snapshot.isLoading) {
    return (
      <Screen contentClassName="gap-5">
        {header}
        <LoadingState />
      </Screen>
    );
  }

  // ---- Empty ----
  if (items.length === 0) {
    return (
      <Screen contentClassName="gap-5">
        {header}
        <EmptyState
          icon={<Trophy size={28} color={C.spark} />}
          title="No rankings yet"
          body="As you and your classmates earn points, you’ll show up here. Complete a story point to get on the board!"
        />
      </Screen>
    );
  }

  // ---- Happy path ----
  return (
    <Screen scroll={false} contentClassName="flex-1">
      <FlatList
        data={items}
        keyExtractor={(item) => item.userId}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 20 }}
        contentContainerClassName="px-4 pb-6 pt-4 gap-0"
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View
            className={`overflow-hidden ${
              index === 0
                ? "border-border-subtle rounded-t-lg border-x border-t"
                : "border-border-subtle border-x"
            } ${index === items.length - 1 ? "border-border-subtle rounded-b-lg border-b" : ""}`}
          >
            <LeaderRow entry={item} isMe={caller != null && item.userId === caller.userId} />
          </View>
        )}
        ListFooterComponent={
          caller && !callerInList ? (
            <View className="mt-3">
              <Text className="text-2xs text-text-muted mb-1.5 px-1 font-semibold uppercase tracking-wider">
                Your position
              </Text>
              <View className="overflow-hidden rounded-lg">
                <LeaderRow entry={caller} isMe />
              </View>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
