import { cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { SkeletonShimmer } from "../motion/SkeletonShimmer";

export interface HeatmapCell {
  label: string;
  value: number;
  /** Optional sublabel shown in tooltip */
  sublabel?: string;
}

export interface ClassHeatmapProps {
  title?: string;
  cells: HeatmapCell[];
  /** Maximum value for scaling (default: 100) */
  maxValue?: number;
  /** Columns per row (default: auto based on count) */
  columns?: number;
  className?: string;
  /** Show loading skeleton instead of heatmap */
  loading?: boolean;
}

function getHeatColor(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.8) return "bg-emerald-500 dark:bg-emerald-600 text-white";
  if (ratio >= 0.6)
    return "bg-emerald-300 dark:bg-emerald-700 text-emerald-900 dark:text-emerald-100";
  if (ratio >= 0.4) return "bg-yellow-300 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100";
  if (ratio >= 0.2) return "bg-orange-300 dark:bg-orange-700 text-orange-900 dark:text-orange-100";
  return "bg-red-300 dark:bg-red-700 text-red-900 dark:text-red-100";
}

export function ClassHeatmap({
  title,
  cells,
  maxValue = 100,
  columns,
  className,
  loading = false,
}: ClassHeatmapProps) {
  if (loading) {
    return <SkeletonShimmer preset="heatmap" className={className} />;
  }
  const cols = columns ?? Math.min(cells.length, 6);

  return (
    <div className={cn("space-y-2", className)}>
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      <TooltipProvider delayDuration={200}>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          role="grid"
          aria-label={title ?? "Performance heatmap"}
        >
          {cells.map((cell, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex flex-col items-center justify-center rounded-md p-2 text-center transition-transform hover:scale-105",
                    getHeatColor(cell.value, maxValue)
                  )}
                  role="gridcell"
                  aria-label={`${cell.label}: ${Math.round(cell.value)}%`}
                >
                  <span className="w-full truncate text-xs font-medium">{cell.label}</span>
                  <span className="text-lg font-bold">{Math.round(cell.value)}%</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{cell.label}</p>
                <p className="text-xs">Score: {Math.round(cell.value)}%</p>
                {cell.sublabel && <p className="text-muted-foreground text-xs">{cell.sublabel}</p>}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="text-muted-foreground flex items-center gap-2 text-xs" aria-hidden="true">
        <span>Low</span>
        <div className="flex gap-0.5">
          <div className="h-3 w-6 rounded-sm bg-red-300 dark:bg-red-700" />
          <div className="h-3 w-6 rounded-sm bg-orange-300 dark:bg-orange-700" />
          <div className="h-3 w-6 rounded-sm bg-yellow-300 dark:bg-yellow-700" />
          <div className="h-3 w-6 rounded-sm bg-emerald-300 dark:bg-emerald-700" />
          <div className="h-3 w-6 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
