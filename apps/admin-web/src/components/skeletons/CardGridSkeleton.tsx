import { Skeleton } from "@levelup/shared-ui";

interface CardGridSkeletonProps {
  count?: number;
  columns?: string;
}

export function CardGridSkeleton({
  count = 6,
  columns = "md:grid-cols-2 lg:grid-cols-3",
}: CardGridSkeletonProps) {
  return (
    <div className={`grid gap-4 ${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card space-y-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
