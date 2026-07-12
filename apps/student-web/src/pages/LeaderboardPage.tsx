import { useState } from "react";
import { useAuthStore } from "@levelup/shared-stores";
import { useSpaces, useLeaderboard, useLeaderboardLive } from "@levelup/query";
import type { Space } from "@levelup/shared-types";
import { Trophy } from "lucide-react";
import {
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  FadeIn,
  CountUp,
} from "@levelup/shared-ui";
import {
  LeaderboardTable,
  type LeaderboardEntry,
} from "../components/leaderboard/LeaderboardTable";

export default function LeaderboardPage() {
  const { user, currentMembership } = useAuthStore();
  const userId = user?.uid ?? null;
  const classIds = currentMembership?.permissions?.managedClassIds;

  const { data: spacesPage, isLoading: spacesLoading } = useSpaces<{ items: Space[] }>({
    status: "published",
    classIds,
  });
  const spaces = spacesPage?.items;

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  // Snapshot leaderboard for the selected scope, kept live via the RTDB-backed
  // subscription (reconciles into the snapshot cache key).
  const lbFilter = selectedSpaceId
    ? { scope: "space" as const, spaceId: selectedSpaceId }
    : { scope: "tenant" as const };
  const { data: lbData, isLoading: lbLoading } = useLeaderboard(lbFilter);
  useLeaderboardLive(lbFilter);

  // Server returns ranked entries; map to the table's entry shape.
  const entries: LeaderboardEntry[] = (lbData?.entries ?? []).map((e) => ({
    userId: e.userId,
    displayName: e.displayName,
    totalPoints: e.totalPoints,
    avatarUrl: e.avatarUrl,
    rank: e.rank,
  }));

  // Find current user's rank
  const currentUserEntry = entries.find((e) => e.userId === userId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-yellow-500" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-bold">Leaderboard</h1>
              <p className="text-muted-foreground text-sm">
                See how you rank against your classmates
              </p>
            </div>
          </div>
          {currentUserEntry && (
            <div className="text-right">
              <p className="text-primary text-2xl font-bold">
                #<CountUp end={currentUserEntry.rank} duration={0.6} />
              </p>
              <p className="text-muted-foreground text-xs">Your Rank</p>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Space filter */}
      <FadeIn delay={0.1}>
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground text-sm">Filter by space:</label>
          <Select
            value={selectedSpaceId ?? "all"}
            onValueChange={(v) => setSelectedSpaceId(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Overall" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Overall</SelectItem>
              {(spaces ?? [])
                .filter((space) => !!space.id)
                .map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </FadeIn>

      {/* Leaderboard table */}
      <div className="bg-card rounded-lg border">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">
            {selectedSpaceId
              ? (spaces?.find((s) => s.id === selectedSpaceId)?.title ?? "Space")
              : "Overall"}{" "}
            Rankings
          </h2>
        </div>
        {spacesLoading || lbLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 rounded" />
            ))}
          </div>
        ) : (
          <LeaderboardTable entries={entries} currentUserId={userId} />
        )}
      </div>
    </div>
  );
}
