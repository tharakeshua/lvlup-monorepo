import { cn } from "../../lib/utils";

type SkeletonPreset = "lines" | "circle" | "bar-chart" | "heatmap" | "card";

export interface SkeletonShimmerProps {
  className?: string;
  lines?: number;
  /** Use a preset shape for chart/component skeletons */
  preset?: SkeletonPreset;
}

/**
 * Enhanced skeleton with CSS shimmer gradient animation.
 * Automatically respects prefers-reduced-motion via the canonical CSS.
 */
export function SkeletonShimmer({ className, lines = 3, preset = "lines" }: SkeletonShimmerProps) {
  if (preset === "circle") {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        role="status"
        aria-label="Loading"
      >
        <div className="bg-muted h-20 w-20 animate-pulse rounded-full" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (preset === "bar-chart") {
    return (
      <div
        className={cn("flex items-end gap-2", className)}
        role="status"
        aria-label="Loading chart"
      >
        {[40, 65, 30, 80, 55].map((h, i) => (
          <div key={i} className="flex-1">
            <div
              className="bg-muted w-full animate-pulse rounded-t-sm"
              style={{ height: `${h}%`, minHeight: 20 }}
            />
          </div>
        ))}
        <span className="sr-only">Loading chart...</span>
      </div>
    );
  }

  if (preset === "heatmap") {
    return (
      <div
        className={cn("grid grid-cols-4 gap-1.5", className)}
        role="status"
        aria-label="Loading heatmap"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-muted h-16 animate-pulse rounded-md" />
        ))}
        <span className="sr-only">Loading heatmap...</span>
      </div>
    );
  }

  if (preset === "card") {
    return (
      <div
        className={cn("space-y-3 rounded-lg border p-4", className)}
        role="status"
        aria-label="Loading"
      >
        <div className="bg-muted h-4 w-1/3 animate-pulse rounded-md" />
        <div className="bg-muted h-8 w-2/3 animate-pulse rounded-md" />
        <div className="bg-muted h-3 w-1/2 animate-pulse rounded-md" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // Default: lines preset
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={cn("bg-muted h-4 rounded-md", "animate-pulse", i === lines - 1 && "w-3/4")}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}
