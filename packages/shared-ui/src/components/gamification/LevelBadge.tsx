import { cn } from "../../lib/utils";
import type { AchievementTier } from "@levelup/shared-types";

export interface LevelBadgeProps {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  tier: AchievementTier;
  className?: string;
}

const tierStyles: Record<AchievementTier, { bg: string; text: string; bar: string }> = {
  bronze: {
    bg: "bg-amber-100 dark:bg-amber-950",
    text: "text-amber-700 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  silver: {
    bg: "bg-slate-100 dark:bg-slate-900",
    text: "text-slate-600 dark:text-slate-300",
    bar: "bg-slate-400",
  },
  gold: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    text: "text-yellow-700 dark:text-yellow-400",
    bar: "bg-yellow-500",
  },
  platinum: {
    bg: "bg-cyan-50 dark:bg-cyan-950",
    text: "text-cyan-700 dark:text-cyan-400",
    bar: "bg-cyan-500",
  },
  diamond: {
    bg: "bg-violet-50 dark:bg-violet-950",
    text: "text-violet-700 dark:text-violet-400",
    bar: "bg-violet-500",
  },
};

export function LevelBadge({ level, currentXP, xpToNextLevel, tier, className }: LevelBadgeProps) {
  const styles = tierStyles[tier];
  const progress = xpToNextLevel > 0 ? (currentXP / xpToNextLevel) * 100 : 100;

  return (
    <div className={cn("rounded-lg border p-3", styles.bg, className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("text-xl font-bold", styles.text)}>Lv. {level}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              styles.text,
              styles.bg
            )}
          >
            {tier}
          </span>
        </div>
        <span className="text-muted-foreground text-xs">
          {currentXP} / {xpToNextLevel} XP
        </span>
      </div>
      <div
        className="bg-muted/40 mt-2 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={Math.round(Math.min(100, progress))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${level} progress: ${currentXP} of ${xpToNextLevel} XP`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", styles.bar)}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
}
