import { cn } from "../../lib/utils";
import type { AchievementTier, AchievementRarity } from "@levelup/shared-types";

export interface AchievementBadgeProps {
  icon: string;
  title: string;
  tier: AchievementTier;
  rarity: AchievementRarity;
  earned?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

const tierColors: Record<AchievementTier, string> = {
  bronze: "from-amber-600 to-amber-800",
  silver: "from-slate-300 to-slate-500",
  gold: "from-yellow-400 to-amber-500",
  platinum: "from-cyan-300 to-blue-500",
  diamond: "from-violet-400 to-purple-600",
};

const tierBorderColors: Record<AchievementTier, string> = {
  bronze: "border-amber-600/50",
  silver: "border-slate-400/50",
  gold: "border-yellow-400/50",
  platinum: "border-cyan-400/50",
  diamond: "border-violet-400/50",
};

const rarityGlow: Record<AchievementRarity, string> = {
  common: "",
  uncommon: "shadow-sm",
  rare: "shadow-md shadow-blue-500/20",
  epic: "shadow-lg shadow-purple-500/30",
  legendary: "shadow-xl shadow-yellow-500/40",
};

const sizeClasses = {
  sm: "h-10 w-10 text-lg",
  md: "h-14 w-14 text-2xl",
  lg: "h-20 w-20 text-3xl",
};

export function AchievementBadge({
  title,
  tier,
  rarity,
  earned = true,
  size = "md",
  className,
  onClick,
}: AchievementBadgeProps) {
  const tierEmoji: Record<AchievementTier, string> = {
    bronze: "\u{1F949}",
    silver: "\u{1F948}",
    gold: "\u{1F947}",
    platinum: "\u{1F48E}",
    diamond: "\u{2B50}",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={`${title} - ${tier} tier${earned ? ", earned" : ", locked"}`}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full border-2 bg-gradient-to-br transition-all",
        sizeClasses[size],
        earned ? tierColors[tier] : "from-muted to-muted/80",
        earned ? tierBorderColors[tier] : "border-muted-foreground/20",
        earned ? rarityGlow[rarity] : "opacity-40 grayscale",
        onClick && "cursor-pointer hover:scale-110",
        !onClick && "cursor-default",
        className
      )}
    >
      <span className={cn(!earned && "opacity-50")} aria-hidden="true">
        {tierEmoji[tier]}
      </span>
    </button>
  );
}
