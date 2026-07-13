import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader } from "./card";
import { Skeleton } from "./skeleton";
import { cn } from "../../lib/utils";

export interface StatCardTrend {
  direction: "up" | "down" | "neutral";
  value: string;
}

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  trend?: StatCardTrend;
  loading?: boolean;
  className?: string;
}

const trendConfig = {
  up: { Icon: TrendingUp, color: "text-success" },
  down: { Icon: TrendingDown, color: "text-destructive" },
  neutral: { Icon: Minus, color: "text-muted-foreground" },
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  subtext,
  trend,
  loading,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-4 pb-1 pt-4">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="mt-1 h-3 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-4 pb-1 pt-4">
        <Icon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">{label}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold">{value}</p>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                trendConfig[trend.direction].color
              )}
            >
              {(() => {
                const TrendIcon = trendConfig[trend.direction].Icon;
                return <TrendIcon className="h-3 w-3" aria-hidden="true" />;
              })()}
              {trend.value}
            </span>
          )}
        </div>
        {subtext && <p className="text-muted-foreground text-xs">{subtext}</p>}
      </CardContent>
    </Card>
  );
}
