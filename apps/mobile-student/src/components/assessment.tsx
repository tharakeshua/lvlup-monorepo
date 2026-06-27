/**
 * Shared assessment bits used across the learn item-viewer and the tests runner:
 * TimerBar (countdown) and GradePill (score chip). Test-domain composites
 * (rubric breakdown, answer-key lock, etc.) live in the tests screen lane.
 */
import { Text, View } from "react-native";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon, renderIcon } from "./Icon";
import type { GradePillProps, TimerBarProps } from "./_types";

// --- TimerBar ---------------------------------------------------------------
const TIMER_TONE: Record<string, { fill: string; text: string; iconColor: string }> = {
  normal: { fill: "bg-brand", text: "text-text-secondary", iconColor: colors.textSecondary },
  warning: { fill: "bg-warning", text: "text-warning", iconColor: colors.warning },
  critical: { fill: "bg-error", text: "text-error", iconColor: colors.error },
};

export function TimerBar({ percent = 0, time, tone = "normal", className }: TimerBarProps) {
  const t = TIMER_TONE[tone] ?? TIMER_TONE.normal;
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <View className={cx("gap-1.5", className)}>
      <View className="flex-row items-center gap-1.5">
        <Icon name="clock" size={14} color={t.iconColor} />
        <Text className={cx("font-mono text-sm font-semibold", t.text)}>{time}</Text>
      </View>
      <View className="rounded-pill bg-surface-sunken h-1.5 w-full overflow-hidden">
        <View style={{ width: `${pct}%` }} className={cx("rounded-pill h-full", t.fill)} />
      </View>
    </View>
  );
}

// --- GradePill --------------------------------------------------------------
const GRADE_TONE: Record<string, { box: string; text: string; iconColor: string }> = {
  success: { box: "bg-green-200", text: "text-success", iconColor: colors.success },
  warning: { box: "bg-marigold-200", text: "text-warning", iconColor: colors.warning },
  error: { box: "bg-red-200", text: "text-error", iconColor: colors.error },
  neutral: {
    box: "bg-surface-sunken",
    text: "text-text-secondary",
    iconColor: colors.textSecondary,
  },
};

export function GradePill({ grade, tone = "neutral", icon, className }: GradePillProps) {
  const t = GRADE_TONE[tone] ?? GRADE_TONE.neutral;
  return (
    <View
      className={cx(
        "rounded-pill flex-row items-center gap-1.5 self-start px-3 py-1",
        t.box,
        className
      )}
    >
      {renderIcon(icon, { size: 14, color: t.iconColor })}
      <Text className={cx("font-ui text-sm font-bold", t.text)}>{grade}</Text>
    </View>
  );
}
