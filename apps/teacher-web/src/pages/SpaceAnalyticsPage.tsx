import { useState } from "react";
import { useSpaces } from "@levelup/query";
import { BookOpen, Users, BarChart3 } from "lucide-react";
import {
  ScoreCard,
  ProgressRing,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@levelup/shared-ui";
import type { Space } from "@levelup/shared-types";

export default function SpaceAnalyticsPage() {
  // @levelup/query hooks are tenant-scoped server-side; result is a `{ items }` page.
  const { data: spacesPage } = useSpaces<{ items: Space[] }>({ status: "published" });
  const spaces = spacesPage?.items ?? [];
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const activeSpaceId = selectedSpaceId || spaces[0]?.id || null;
  const activeSpace = spaces.find((s: Space) => s.id === activeSpaceId);

  // PARITY GAP (flagged to Frontend-Lead): the legacy page aggregated the raw
  // per-space `progress` subcollection across ALL students (completion +
  // engagement). @levelup/query has no space-wide progress aggregation —
  // `getSpaceProgress` returns only the CURRENT user's progress. Until a backend
  // "space progress summary" callable exists, we surface the space's own
  // server-maintained `stats` and degrade gracefully.
  const stats = activeSpace?.stats;
  const totalStudents = stats?.totalStudents ?? 0;
  const avgCompletion = stats?.avgCompletionRate ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Space Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Completion rates and engagement metrics per space
          </p>
        </div>
        <Select
          value={activeSpaceId ?? "__none__"}
          onValueChange={(v) => setSelectedSpaceId(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select space" />
          </SelectTrigger>
          <SelectContent>
            {spaces.length === 0 && (
              <SelectItem value="__none__" disabled>
                No published spaces
              </SelectItem>
            )}
            {spaces.map((s: Space) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!activeSpace ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="text-muted-foreground mx-auto h-10 w-10" />
          <p className="text-muted-foreground mt-3 text-sm">
            No published spaces yet. Publish a space to see analytics.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <ScoreCard label="Total Students" value={totalStudents} icon={Users} />
            <ScoreCard label="Story Points" value={stats?.totalStoryPoints ?? 0} icon={BookOpen} />
            <ScoreCard label="Items" value={stats?.totalItems ?? 0} icon={BookOpen} />
            <ScoreCard
              label="Avg Completion"
              value={`${Math.round(avgCompletion)}%`}
              icon={BarChart3}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-card border-subtle shadow-e1 space-y-4 rounded-lg border p-5">
              <h2 className="font-semibold">Completion Overview</h2>
              <div className="flex items-center gap-6">
                <ProgressRing value={avgCompletion} label="Avg Completion" />
                <div className="space-y-2 text-sm">
                  <p>
                    Space: <span className="font-medium">{activeSpace.title}</span>
                  </p>
                  <p>
                    Type: <span className="font-medium capitalize">{activeSpace.type}</span>
                  </p>
                  {activeSpace.subject && (
                    <p>
                      Subject: <span className="font-medium">{activeSpace.subject}</span>
                    </p>
                  )}
                  <p>
                    Story Points:{" "}
                    <span className="font-mono font-medium">{stats?.totalStoryPoints ?? 0}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border-subtle shadow-e1 space-y-4 rounded-lg border p-5">
              <h2 className="font-semibold">Engagement Metrics</h2>
              <p className="text-muted-foreground text-sm">
                Detailed per-student completion and engagement metrics are not yet available via the
                SDK. They require a backend space-progress summary endpoint.
              </p>
              <div className="space-y-2 text-sm">
                <p>
                  Enrolled Students: <span className="font-mono font-medium">{totalStudents}</span>
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
