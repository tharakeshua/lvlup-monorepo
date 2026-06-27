/**
 * Gamification: XPChip, StreakChip, XPMeter, StreakFlame, LevelBadge.
 * Marigold "spark" energy over the indigo brand base.
 */
import { Text, View } from "react-native";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { ProgressBar } from "./data";
import type {
  LevelBadgeProps,
  StreakChipProps,
  StreakFlameProps,
  XPChipProps,
  XPMeterProps,
} from "./_types";

// --- XPChip -----------------------------------------------------------------
export function XPChip({ xp, value, className }: XPChipProps) {
  const amount = xp ?? value ?? 0;
  return (
    <View
      className={cx(
        "rounded-pill bg-marigold-50 flex-row items-center gap-1 self-start px-2.5 py-1",
        className
      )}
    >
      <Icon name="zap" size={13} color={colors.spark} strokeWidth={2.4} />
      <Text className="font-ui text-marigold-600 text-xs font-bold">
        {amount.toLocaleString()} XP
      </Text>
    </View>
  );
}

// --- StreakChip -------------------------------------------------------------
export function StreakChip({ days = 0, className }: StreakChipProps) {
  return (
    <View
      className={cx(
        "rounded-pill flex-row items-center gap-1 self-start bg-red-200/60 px-2.5 py-1",
        className
      )}
    >
      <Icon name="flame" size={13} color={colors.error} strokeWidth={2.4} />
      <Text className="font-ui text-error text-xs font-bold">{days}d</Text>
    </View>
  );
}

// --- StreakFlame (larger display) ------------------------------------------
export function StreakFlame({ days = 0, className }: StreakFlameProps) {
  return (
    <View className={cx("flex-row items-center gap-2", className)}>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-red-200/60">
        <Icon name="flame" size={22} color={colors.error} strokeWidth={2.2} />
      </View>
      <View>
        <Text className="font-display text-text-primary text-xl font-bold">{days}</Text>
        <Text className="font-ui text-2xs text-text-muted">day streak</Text>
      </View>
    </View>
  );
}

// --- XPMeter ----------------------------------------------------------------
export function XPMeter({ level = 1, xp = 0, next = 100, className }: XPMeterProps) {
  const pct = next > 0 ? Math.min(100, Math.round((xp / next) * 100)) : 0;
  return (
    <View className={cx("gap-2", className)}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <LevelBadge level={level} />
          <Text className="font-ui text-text-secondary text-sm font-semibold">Level {level}</Text>
        </View>
        <Text className="font-ui text-text-muted text-xs">
          {xp.toLocaleString()} / {next.toLocaleString()} XP
        </Text>
      </View>
      <ProgressBar value={pct} variant="spark" />
    </View>
  );
}

// --- LevelBadge -------------------------------------------------------------
export function LevelBadge({ level = 1, spark, className }: LevelBadgeProps) {
  return (
    <View
      className={cx(
        "h-9 w-9 items-center justify-center rounded-lg",
        spark ? "bg-spark" : "bg-brand",
        className
      )}
    >
      <Text
        className={cx(
          "font-display text-base font-bold",
          spark ? "text-ink-900" : "text-text-on-accent"
        )}
      >
        {level}
      </Text>
    </View>
  );
}
