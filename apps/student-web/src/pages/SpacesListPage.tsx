import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSpaces, useSpaceProgress } from "@levelup/query";
import { asSpaceId } from "@levelup/domain";
import { BookOpen, AlertCircle, RefreshCw, Star, ArrowRight, CheckCircle2 } from "lucide-react";
import { Skeleton, Button } from "@levelup/shared-ui";
import type { Space, SpaceProgress } from "@levelup/shared-types";
import { SpaceCover, ProgressRing, Kicker } from "../components/common/lyceum";

export default function SpacesListPage() {
  // listSpaces is Zod .strict() — classIds[] is rejected and the query fails.
  // Server scopes published spaces from the learner's claims / membership.
  const {
    data: spacesPage,
    isLoading,
    isError,
    refetch,
  } = useSpaces<{ items: Space[] }>({ status: "published" });
  const spaces = spacesPage?.items;
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const s of spaces ?? []) if (s.subject) set.add(s.subject);
    return [...set].sort();
  }, [spaces]);

  const filtered = useMemo(
    () =>
      subjectFilter ? (spaces ?? []).filter((s) => s.subject === subjectFilter) : (spaces ?? []),
    [spaces, subjectFilter]
  );

  const header = (
    <header>
      <Kicker>Your library</Kicker>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-fg text-3xl">My Spaces</h1>
        {!!spaces?.length && (
          <span className="text-fg-muted font-mono text-sm tabular-nums">
            {spaces.length} {spaces.length === 1 ? "space" : "spaces"}
          </span>
        )}
      </div>
      <p className="text-fg-secondary mt-1 text-sm">Pick up where you left off.</p>
    </header>
  );

  if (isLoading) {
    return (
      <div className="animate-ly-rise space-y-6">
        {header}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border-subtle bg-surface overflow-hidden rounded-xl border">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="animate-ly-rise space-y-6">
        {header}
        <div className="border-error/30 bg-error/5 rounded-xl border p-10 text-center">
          <AlertCircle className="text-error/60 mx-auto mb-3 h-10 w-10" />
          <p className="font-display text-fg text-lg">We couldn&apos;t load your spaces</p>
          <p className="text-fg-secondary mt-1 text-sm">Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-ly-rise space-y-6">
      {header}

      {subjects.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by subject"
        >
          <FilterChip active={subjectFilter === null} onClick={() => setSubjectFilter(null)}>
            All
          </FilterChip>
          {subjects.map((s) => (
            <FilterChip
              key={s}
              active={subjectFilter === s}
              onClick={() => setSubjectFilter(subjectFilter === s ? null : s)}
            >
              {s}
            </FilterChip>
          ))}
        </div>
      )}

      {!spaces?.length ? (
        <div className="border-subtle bg-surface rounded-xl border p-12 text-center">
          <BookOpen className="text-strong mx-auto mb-3 h-10 w-10" />
          <p className="font-display text-fg text-lg">No spaces yet</p>
          <p className="text-fg-secondary mx-auto mt-1 max-w-sm text-sm">
            Your teacher hasn&apos;t assigned any learning spaces to your class yet. Check back soon
            — they&apos;ll show up here the moment they do.
          </p>
        </div>
      ) : !filtered.length ? (
        <div className="border-subtle bg-surface rounded-xl border p-10 text-center">
          <p className="text-fg-secondary text-sm">No spaces match this filter.</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSubjectFilter(null)}>
            Clear filter
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-pill duration-fast ease-standard border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-brand bg-brand text-fg-on-accent"
          : "border-subtle bg-surface text-fg-secondary hover:border-strong hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function SpaceCard({ space }: { space: Space }) {
  const { data: progress } = useSpaceProgress(asSpaceId(space.id));
  const percentage = (progress as SpaceProgress | null)?.percentage ?? 0;
  const mastered = percentage >= 100;

  return (
    <Link
      to={`/spaces/${space.id}`}
      aria-label={`${space.title}, ${percentage > 0 ? `${Math.round(percentage)}% mastered` : "not started"}`}
      className="border-subtle bg-surface shadow-e1 hover:shadow-e2 focus-visible:ring-brand/40 duration-fast ease-standard group block overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
    >
      <SpaceCover
        seed={space.subject ?? space.title}
        title={space.title}
        thumbnailUrl={space.thumbnailUrl}
        className="h-36"
      />
      <div className="p-5">
        <h3 className="font-display text-fg line-clamp-1 text-lg leading-snug">{space.title}</h3>
        {space.description && (
          <p className="text-fg-secondary mt-1.5 line-clamp-2 text-sm">{space.description}</p>
        )}
        <div className="text-fg-muted mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {space.subject && (
            <>
              <span>{space.subject}</span>
              <span aria-hidden>·</span>
            </>
          )}
          {space.stats && (
            <span>
              <span className="font-mono tabular-nums">{space.stats.storyPointCount}</span> story
              points
            </span>
          )}
          {space.ratingAggregate && space.ratingAggregate.totalReviews > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Star className="fill-spark text-spark h-3 w-3" aria-hidden />
                <span className="font-mono tabular-nums">
                  {space.ratingAggregate.averageRating}
                </span>
              </span>
            </>
          )}
        </div>
        <div className="border-subtle mt-4 flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-3">
            <ProgressRing value={percentage} size={40} />
            {mastered ? (
              <span className="text-mastery-mastered inline-flex items-center gap-1 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Mastered
              </span>
            ) : (
              <span className="text-fg-secondary text-xs">
                {percentage > 0 ? `${Math.round(percentage)}% mastered` : "Ready when you are"}
              </span>
            )}
          </div>
          <span className="text-brand duration-fast ease-standard inline-flex items-center gap-1 text-xs font-medium opacity-0 transition-all group-hover:opacity-100">
            Continue{" "}
            <ArrowRight
              className="duration-fast h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
