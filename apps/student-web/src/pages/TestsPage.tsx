import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useSpaces } from "@levelup/query";
import { useStoryPoints } from "../hooks/useStoryPoints";
import { ClipboardList, Clock, ChevronRight, PlayCircle, CalendarClock, Lock } from "lucide-react";
import { Skeleton, Badge } from "@levelup/shared-ui";
import type { StoryPoint } from "@levelup/shared-types";

function getScheduleStatus(config: StoryPoint["assessmentConfig"]): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} | null {
  const schedule = config?.schedule;
  if (!schedule) return null;
  const now = Date.now();
  // Timestamps project as ISO strings at runtime (types claim {seconds}); tolerate
  // both so schedule badges actually render instead of silently no-op'ing.
  const toMs = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const ms = Date.parse(v);
      return Number.isNaN(ms) ? null : ms;
    }
    const s = (v as { seconds?: number }).seconds;
    return typeof s === "number" ? s * 1000 : null;
  };
  const startMs = toMs(schedule.startAt);
  const endMs = toMs(schedule.endAt);

  if (startMs && now < startMs) {
    return { label: "Scheduled", variant: "secondary" };
  }
  if (endMs && now > endMs) {
    return { label: "Closed", variant: "destructive" };
  }
  if (startMs || endMs) {
    return { label: "Active", variant: "default" };
  }
  return null;
}

function questionCount(sp: StoryPoint): number | null {
  const stats = sp.stats as { totalQuestions?: number; itemCount?: number } | undefined;
  const n = stats?.totalQuestions ?? stats?.itemCount;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function TestCard({
  storyPoint,
  spaceId,
  spaceTitle,
}: {
  storyPoint: StoryPoint;
  spaceId: string;
  spaceTitle: string;
}) {
  const config = storyPoint.assessmentConfig;
  const scheduleStatus = getScheduleStatus(config);
  const qCount = questionCount(storyPoint);
  const rawStart = config?.schedule?.startAt as unknown;
  const startAtMs =
    rawStart == null
      ? null
      : typeof rawStart === "string"
        ? Number.isNaN(Date.parse(rawStart))
          ? null
          : Date.parse(rawStart)
        : typeof (rawStart as { seconds?: number }).seconds === "number"
          ? (rawStart as { seconds: number }).seconds * 1000
          : null;

  return (
    <Link
      to={`/spaces/${spaceId}/test/${storyPoint.id}`}
      className="bg-card flex items-center gap-4 rounded-lg border p-4 transition-shadow hover:shadow-sm"
    >
      <div className="bg-destructive/10 flex h-10 w-10 items-center justify-center rounded-full">
        {scheduleStatus?.label === "Closed" ? (
          <Lock className="text-muted-foreground h-5 w-5" />
        ) : scheduleStatus?.label === "Scheduled" ? (
          <CalendarClock className="h-5 w-5 text-blue-500" />
        ) : (
          <PlayCircle className="text-destructive h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">{storyPoint.title}</h3>
          {scheduleStatus && (
            <Badge variant={scheduleStatus.variant} className="text-xs">
              {scheduleStatus.label}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground truncate text-xs">{spaceTitle}</p>
        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
          {config?.durationMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {config.durationMinutes} min
            </span>
          )}
          {qCount != null && <span>{qCount} questions</span>}
          {config?.maxAttempts && <span>Max {config.maxAttempts} attempts</span>}
          {scheduleStatus?.label === "Scheduled" && startAtMs != null && (
            <span className="text-blue-600 dark:text-blue-400">
              Opens {new Date(startAtMs).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />
    </Link>
  );
}

function SpaceTests({
  tenantId,
  space,
  onTestsLoaded,
}: {
  tenantId: string;
  space: { id: string; title: string };
  onTestsLoaded?: (spaceId: string, count: number) => void;
}) {
  const { data: storyPoints, isLoading, isFetched } = useStoryPoints(tenantId, space.id);
  const tests = storyPoints?.filter((sp) => sp.type === "timed_test" || sp.type === "test") ?? [];

  useEffect(() => {
    if (!isFetched || isLoading) return;
    onTestsLoaded?.(space.id, tests.length);
  }, [isFetched, isLoading, space.id, tests.length, onTestsLoaded]);

  if (tests.length === 0) return null;

  return (
    <>
      {tests.map((sp) => (
        <TestCard key={sp.id} storyPoint={sp} spaceId={space.id} spaceTitle={space.title} />
      ))}
    </>
  );
}

export default function TestsPage() {
  const { currentTenantId } = useAuthStore();
  // listSpaces schema is strict — no classIds[]; Zod rejects and the query fails empty.
  // Server scopes published spaces by the learner's claims / class membership.
  const { data: spacesPage, isLoading } = useSpaces<{
    items: Array<{ id: string; title: string }>;
  }>({
    status: "published",
  });
  const spaces = spacesPage?.items ?? [];
  const [counts, setCounts] = useState<Record<string, number>>({});

  const onTestsLoaded = useCallback((spaceId: string, count: number) => {
    setCounts((prev) => (prev[spaceId] === count ? prev : { ...prev, [spaceId]: count }));
  }, []);

  const allSpacesReported =
    spaces.length > 0 && spaces.every((s) => Object.prototype.hasOwnProperty.call(counts, s.id));
  const totalTests = Object.values(counts).reduce((a, b) => a + b, 0);
  const showEmpty = !isLoading && (spaces.length === 0 || (allSpacesReported && totalTests === 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="text-destructive h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Tests</h1>
          <p className="text-muted-foreground text-sm">
            All available timed tests across your spaces
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : showEmpty ? (
        <div className="bg-muted/50 text-muted-foreground rounded-lg border p-8 text-center">
          <ClipboardList className="text-muted-foreground/30 mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">No tests available yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {spaces.map((space) => (
            <SpaceTests
              key={space.id}
              tenantId={currentTenantId!}
              space={space}
              onTestsLoaded={onTestsLoaded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
