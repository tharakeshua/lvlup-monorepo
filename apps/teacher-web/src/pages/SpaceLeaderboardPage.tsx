/**
 * SpaceLeaderboardPage — gamification leaderboard for a chosen learning space.
 *
 * Route: /leaderboards/spaces (wired by coordinator)
 * Backend: useLeaderboard({ scope: "space", spaceId, limit: 50 })
 *          useLeaderboardLive for RTDB realtime reconciliation
 * Space list: useSpaces() → { items: Space[] }
 */
import { useState, useEffect, useMemo } from "react";
import { useSpaces, useLeaderboard, useLeaderboardLive } from "@levelup/query";
import type { LeaderboardEntry, AchievementTier } from "@levelup/domain";
import type { Space } from "@levelup/domain";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@levelup/shared-ui";
import {
  Trophy,
  Medal,
  Award,
  Flame,
  AlertTriangle,
  BookOpen,
  Star,
  BarChart2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

const TIER_VARIANT: Record<
  AchievementTier,
  "default" | "secondary" | "outline" | "destructive"
> = {
  bronze: "outline",
  silver: "secondary",
  gold: "default",
  platinum: "default",
  diamond: "default",
};

const TIER_CLASS: Record<AchievementTier, string> = {
  bronze: "border-amber-700 text-amber-700",
  silver: "text-slate-500",
  gold: "bg-yellow-500/10 text-yellow-700 border-yellow-400",
  platinum: "bg-cyan-500/10 text-cyan-700 border-cyan-400",
  diamond: "bg-purple-500/10 text-purple-700 border-purple-400",
};

// ---------------------------------------------------------------------------
// Podium card (top 3)
// ---------------------------------------------------------------------------

const PODIUM_ORDER = [1, 0, 2] as const; // gold | silver | bronze visual order
const PODIUM_HEIGHTS = ["h-20", "h-28", "h-16"] as const; // visual pillar height
const PODIUM_ICONS = [
  <Medal className="h-5 w-5 text-slate-400" aria-hidden="true" />,
  <Trophy className="h-6 w-6 text-yellow-500" aria-hidden="true" />,
  <Award className="h-5 w-5 text-amber-600" aria-hidden="true" />,
] as const;
const PODIUM_RING = [
  "ring-slate-300",
  "ring-yellow-400",
  "ring-amber-500",
] as const;

interface PodiumCardProps {
  entry: LeaderboardEntry;
  position: 0 | 1 | 2; // 0=gold, 1=silver, 2=bronze
  isMe: boolean;
}

function PodiumCard({ entry, position, isMe }: PodiumCardProps) {
  const [visualIndex] = [PODIUM_ORDER.indexOf(position) as 0 | 1 | 2];
  const pillarHeight = PODIUM_HEIGHTS[visualIndex];
  const icon = PODIUM_ICONS[position];
  const ring = PODIUM_RING[position];

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative flex h-14 w-14 items-center justify-center rounded-full ring-2 ${ring} ${
          isMe ? "ring-offset-2" : ""
        }`}
      >
        <Avatar className="h-14 w-14">
          {entry.avatarUrl && (
            <AvatarImage src={entry.avatarUrl} alt={entry.displayName} />
          )}
          <AvatarFallback
            className={`text-base font-semibold ${
              position === 0
                ? "bg-yellow-50 text-yellow-700"
                : position === 1
                  ? "bg-slate-50 text-slate-600"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {initials(entry.displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold shadow">
          #{entry.rank}
        </span>
      </div>
      <div className="text-center">
        <p
          className={`max-w-[7rem] truncate text-sm font-semibold ${
            isMe ? "text-brand" : ""
          }`}
          title={entry.displayName}
        >
          {entry.displayName}
        </p>
        <p className="text-muted-foreground text-xs font-mono">
          {entry.totalPoints.toLocaleString()} pts
        </p>
      </div>
      <div
        className={`w-16 rounded-t-md ${pillarHeight} ${
          position === 0
            ? "bg-yellow-400/70"
            : position === 1
              ? "bg-slate-300/70"
              : "bg-amber-500/60"
        } flex items-center justify-center`}
      >
        {icon}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row in the ranked list (rank ≥ 4)
// ---------------------------------------------------------------------------

interface EntryRowProps {
  entry: LeaderboardEntry;
  isMe: boolean;
}

function EntryRow({ entry, isMe }: EntryRowProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        isMe ? "bg-brand/5 ring-brand/20 ring-1" : "hover:bg-muted/40"
      }`}
    >
      {/* Rank */}
      <span className="text-muted-foreground w-7 shrink-0 text-right text-xs font-mono tabular-nums">
        #{entry.rank}
      </span>

      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {entry.avatarUrl && (
          <AvatarImage src={entry.avatarUrl} alt={entry.displayName} />
        )}
        <AvatarFallback className="bg-muted text-xs font-semibold">
          {initials(entry.displayName)}
        </AvatarFallback>
      </Avatar>

      {/* Name + badges */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`truncate text-sm font-medium ${isMe ? "text-brand" : ""}`}
          >
            {entry.displayName}
          </span>
          {isMe && (
            <Badge variant="outline" className="border-brand text-brand h-4 px-1 text-[10px]">
              You
            </Badge>
          )}
          {entry.isAtRisk && (
            <span
              title="At risk"
              className="flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              At risk
            </span>
          )}
        </div>
        {/* Sub-stats row */}
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {entry.streakDays > 0 && (
            <span className="flex items-center gap-0.5">
              <Flame className="h-3 w-3 text-orange-400" aria-hidden="true" />
              {entry.streakDays}d streak
            </span>
          )}
          {entry.spaceCompletion != null && (
            <span className="flex items-center gap-0.5">
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              {Math.round(entry.spaceCompletion * 100)}%
            </span>
          )}
          {entry.examAvg != null && (
            <span className="flex items-center gap-0.5">
              <BarChart2 className="h-3 w-3" aria-hidden="true" />
              {Math.round(entry.examAvg)}% avg
            </span>
          )}
        </div>
      </div>

      {/* Points + tier */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular-nums font-mono">
          {entry.totalPoints.toLocaleString()}
          <span className="text-muted-foreground ml-1 text-xs font-normal">pts</span>
        </span>
        {entry.tier && (
          <Badge
            variant={TIER_VARIANT[entry.tier]}
            className={`h-4 px-1 text-[10px] ${TIER_CLASS[entry.tier]}`}
          >
            <Star className="mr-0.5 h-2 w-2" aria-hidden="true" />
            {TIER_LABELS[entry.tier]}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LeaderboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Podium skeleton */}
      <div className="flex items-end justify-center gap-6 py-4">
        {[1, 0, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className={`w-16 rounded-t-md ${PODIUM_HEIGHTS[i as 0 | 1 | 2]}`} />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SpaceLeaderboardPage() {
  const { data: spacesPage, isLoading: spacesLoading } = useSpaces<{
    items: Space[];
  }>({ status: undefined });
  const spaces = useMemo(() => spacesPage?.items ?? [], [spacesPage]);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | "">("");

  // Default to first space when list loads and nothing is selected yet.
  useEffect(() => {
    if (!selectedSpaceId && spaces.length === 1) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [spaces, selectedSpaceId]);

  const lbFilter = selectedSpaceId
    ? { scope: "space" as const, spaceId: selectedSpaceId, limit: 50 }
    : { scope: "tenant" as const, limit: 0 }; // disabled path — enabled guard uses scope+spaceId

  const { data: lbData, isLoading: lbLoading } = useLeaderboard(
    selectedSpaceId
      ? { scope: "space" as const, spaceId: selectedSpaceId, limit: 50 }
      : { scope: "tenant" as const } // won't fire — enabled = Boolean(filter.scope && spaceId)
  );

  // Wire live RTDB reconciliation (no-op when no spaceId — subscription silently skips).
  useLeaderboardLive(lbFilter);

  const entries: LeaderboardEntry[] = lbData?.entries ?? [];
  const myEntry = lbData?.myEntry;

  const podiumEntries = entries.slice(0, 3);
  const listEntries = entries.slice(3);

  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Space Leaderboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-brand text-xs font-semibold uppercase tracking-[0.16em]">
            Gamification
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">
            Space Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            See how students rank within a specific learning space — updated in real time.
          </p>
        </div>
      </div>

      {/* Space picker */}
      <div className="bg-card border-subtle flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
        <label
          htmlFor="space-picker"
          className="text-muted-foreground shrink-0 text-sm"
        >
          Choose a space:
        </label>
        {spacesLoading ? (
          <Skeleton className="h-9 w-56 rounded-md" />
        ) : (
          <Select
            value={selectedSpaceId || "__none__"}
            onValueChange={(v) => setSelectedSpaceId(v === "__none__" ? "" : v)}
          >
            <SelectTrigger id="space-picker" className="w-full sm:w-72 min-h-11 sm:min-h-9">
              <SelectValue placeholder="Select a space…" />
            </SelectTrigger>
            <SelectContent>
              {spaces.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No spaces found
                </SelectItem>
              ) : (
                spaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Content area */}
      {!selectedSpaceId ? (
        /* Pick-a-space empty state */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-20 text-center">
          <span className="bg-surface-sunken text-brand flex h-14 w-14 items-center justify-center rounded-xl">
            <Trophy className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="font-display mt-3 text-lg">Select a space to view its leaderboard</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Pick a learning space from the dropdown above to see how your students rank.
          </p>
        </div>
      ) : lbLoading ? (
        <Card>
          <CardContent className="p-5">
            <LeaderboardSkeleton />
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        /* Empty leaderboard state */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-20 text-center">
          <span className="bg-surface-sunken text-brand flex h-14 w-14 items-center justify-center rounded-xl">
            <BookOpen className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="font-display mt-3 text-lg">No leaderboard data for this space yet</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Students will appear here once they start working through{" "}
            <span className="font-medium">{selectedSpace?.title ?? "this space"}</span>.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-5">
            {/* Podium (top 3) */}
            {podiumEntries.length > 0 && (
              <div
                className="flex items-end justify-center gap-4 pb-6 sm:gap-8"
                aria-label="Top 3 students"
              >
                {/* Render order: silver (1st in array = rank 2), gold (0th = rank 1), bronze (2nd = rank 3) */}
                {(() => {
                  const gold = podiumEntries[0];
                  const silver = podiumEntries[1];
                  const bronze = podiumEntries[2];
                  const display = [silver, gold, bronze].filter(Boolean) as LeaderboardEntry[];
                  const positions: (0 | 1 | 2)[] = [1, 0, 2];
                  return display.map((entry, i) => (
                    <PodiumCard
                      key={entry.userId}
                      entry={entry}
                      position={positions[i]}
                      isMe={myEntry?.userId === entry.userId}
                    />
                  ));
                })()}
              </div>
            )}

            {/* Divider between podium and list */}
            {podiumEntries.length > 0 && listEntries.length > 0 && (
              <div className="border-subtle mb-4 border-t" />
            )}

            {/* Ranked list (rank 4+) */}
            {listEntries.length > 0 && (
              <div
                className="space-y-1"
                role="list"
                aria-label="Leaderboard rankings"
              >
                {listEntries.map((entry) => (
                  <div key={entry.userId} role="listitem">
                    <EntryRow
                      entry={entry}
                      isMe={myEntry?.userId === entry.userId}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* My entry highlight if not in top list */}
            {myEntry && !entries.some((e) => e.userId === myEntry.userId) && (
              <>
                <div className="border-subtle my-3 border-t border-dashed" />
                <div className="px-3">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Your rank</p>
                  <EntryRow entry={myEntry} isMe />
                </div>
              </>
            )}

            {/* Footer meta */}
            <p className="text-muted-foreground mt-4 text-right text-[11px]">
              Showing top {entries.length} student{entries.length !== 1 ? "s" : ""} •{" "}
              {selectedSpace?.title}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
