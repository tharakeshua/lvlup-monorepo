import { cn } from "../../lib/utils";
import { SkeletonShimmer } from "../motion/SkeletonShimmer";

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface SimpleBarChartProps {
  data: BarChartItem[];
  maxValue?: number;
  height?: number;
  className?: string;
  showValues?: boolean;
  valueFormatter?: (v: number) => string;
  /** Show loading skeleton instead of chart */
  loading?: boolean;
}

/**
 * Lightweight CSS-based bar chart. Use this for simple visualizations
 * where recharts would be overkill.
 */
export function SimpleBarChart({
  data,
  maxValue,
  height = 200,
  className,
  showValues = true,
  valueFormatter = (v) => `${Math.round(v)}%`,
  loading = false,
}: SimpleBarChartProps) {
  if (loading) {
    return <SkeletonShimmer preset="bar-chart" className={className} />;
  }

  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  // Generate accessible text summary
  const summary = data.map((d) => `${d.label}: ${valueFormatter(d.value)}`).join(", ");

  return (
    <div
      className={cn("flex items-end gap-2", className)}
      style={{ height }}
      role="img"
      aria-label={`Bar chart: ${summary}`}
    >
      {data.map((item) => {
        const barHeight = (item.value / max) * 100;
        return (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-1">
            {showValues && (
              <span className="text-muted-foreground text-[10px] font-medium">
                {valueFormatter(item.value)}
              </span>
            )}
            <div className="flex w-full items-end" style={{ height: height - 40 }}>
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${barHeight}%`,
                  backgroundColor: item.color ?? "hsl(var(--primary))",
                  minHeight: item.value > 0 ? 4 : 0,
                }}
              />
            </div>
            <span className="text-muted-foreground max-w-full truncate text-center text-[10px]">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
