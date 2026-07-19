import { cn } from "../../lib/utils";
import { Flame } from "lucide-react";

export interface StreakWidgetProps {
  currentStreak: number;
  longestStreak?: number;
  className?: string;
}

export function StreakWidget({ currentStreak, longestStreak, className }: StreakWidgetProps) {
  const isHot = currentStreak >= 7;
  const isOnFire = currentStreak >= 30;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3",
        isOnFire
          ? "border-orange-400/50 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30"
          : isHot
            ? "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20"
            : "bg-card",
        className
      )}
      role="status"
      aria-label={`${currentStreak} day streak${isOnFire ? ", on fire!" : isHot ? ", hot!" : ""}`}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full",
          isOnFire
            ? "bg-gradient-to-br from-orange-400 to-red-500 text-white"
            : isHot
              ? "bg-amber-100 text-amber-600 dark:bg-amber-900/50"
              : "bg-muted text-muted-foreground"
        )}
        aria-hidden="true"
      >
        <Flame className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold">{currentStreak}</span>
          <span className="text-muted-foreground text-sm">day streak</span>
        </div>
        {longestStreak !== undefined && longestStreak > currentStreak && (
          <p className="text-muted-foreground text-xs">Best: {longestStreak} days</p>
        )}
      </div>
    </div>
  );
}
