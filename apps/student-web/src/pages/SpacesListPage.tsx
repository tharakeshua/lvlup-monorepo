import { Link } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useSpaces, useSpaceProgress } from "@levelup/query";
import { asSpaceId } from "@levelup/domain";
import ProgressBar from "../components/common/ProgressBar";
import { BookOpen, AlertCircle, RefreshCw, Star } from "lucide-react";
import { Skeleton, Button } from "@levelup/shared-ui";
import type { Space, SpaceProgress } from "@levelup/shared-types";

export default function SpacesListPage() {
  const { currentMembership } = useAuthStore();
  const classIds = currentMembership?.permissions?.managedClassIds;
  const {
    data: spacesPage,
    isLoading,
    isError,
    refetch,
  } = useSpaces<{ items: Space[] }>({ status: "published", classIds });
  const spaces = spacesPage?.items;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Spaces</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Spaces</h1>
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-8 text-center">
          <AlertCircle className="text-destructive/60 mx-auto mb-2 h-10 w-10" />
          <p className="text-destructive text-sm font-medium">Failed to load spaces</p>
          <p className="text-muted-foreground mt-1 text-xs">Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Spaces</h1>
      {!spaces?.length ? (
        <div className="bg-muted/50 text-muted-foreground rounded-lg border p-8 text-center">
          <BookOpen className="text-muted-foreground/30 mx-auto mb-2 h-10 w-10" />
          <p className="font-medium">No spaces assigned yet</p>
          <p className="mt-1 text-xs">
            Your teacher will assign learning spaces to your class. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      )}
    </div>
  );
}

function SpaceCard({ space }: { space: Space }) {
  const { data: progress } = useSpaceProgress(asSpaceId(space.id));
  const percentage = (progress as SpaceProgress | null)?.percentage ?? 0;
  return (
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
            <span>{space.stats.totalStoryPoints} sections</span>
            <span>{space.stats.totalItems} items</span>
          </>
        )}
        {space.ratingAggregate && space.ratingAggregate.totalReviews > 0 && (
          <span className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {space.ratingAggregate.averageRating}
          </span>
        )}
      </div>
      <div className="mt-3">
        <ProgressBar value={percentage} size="sm" color={percentage === 100 ? "green" : "blue"} />
      </div>
    </Link>
  );
}
