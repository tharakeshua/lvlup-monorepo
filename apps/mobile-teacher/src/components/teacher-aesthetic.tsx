import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon } from "./Icon";

export function TeacherPageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <View className={cx("flex-row items-end justify-between gap-4", className)}>
      <View className="min-w-0 flex-1 gap-1">
        {eyebrow ? (
          <Text className="font-ui text-brand tracking-caps text-2xs font-semibold uppercase">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="font-display text-text-primary text-2xl leading-8">{title}</Text>
        {subtitle ? (
          <Text className="font-ui text-text-secondary text-sm leading-5">{subtitle}</Text>
        ) : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

export function TeacherHero({
  eyebrow,
  title,
  subtitle,
  children,
  icon = "sparkles",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  icon?: string;
  className?: string;
}) {
  return (
    <View
      className={cx(
        "border-brand-muted bg-brand-subtle relative overflow-hidden rounded-xl border p-5",
        className
      )}
    >
      <View className="border-brand-muted absolute -right-8 -top-10 h-32 w-32 rounded-full border" />
      <View className="border-brand-muted/70 absolute -bottom-14 right-8 h-28 w-28 rounded-full border" />
      <View className="relative gap-4">
        <View className="flex-row items-start gap-3">
          <View className="bg-brand h-10 w-10 items-center justify-center rounded-lg shadow-sm">
            <Icon name={icon} size={19} color={colors.textOnAccent} />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            {eyebrow ? (
              <Text className="font-ui text-brand tracking-caps text-2xs font-semibold uppercase">
                {eyebrow}
              </Text>
            ) : null}
            <Text className="font-display text-text-primary text-xl leading-7">{title}</Text>
            {subtitle ? (
              <Text className="font-ui text-text-secondary text-sm leading-5">{subtitle}</Text>
            ) : null}
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}

const ACTION_TONES = {
  brand: {
    frame: "border-brand-muted bg-brand-subtle",
    icon: "bg-brand",
    tint: colors.textOnAccent,
  },
  spark: {
    frame: "border-marigold-200 bg-marigold-50",
    icon: "bg-spark",
    tint: colors.textPrimary,
  },
  sky: {
    frame: "border-sky-500/25 bg-sky-500/10",
    icon: "bg-info",
    tint: colors.textOnAccent,
  },
} as const;

export function FeatureActionCard({
  icon,
  title,
  description,
  eyebrow,
  badge,
  tone = "brand",
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  eyebrow?: string;
  badge?: string;
  tone?: keyof typeof ACTION_TONES;
  onPress: () => void;
}) {
  const meta = ACTION_TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cx(
        "min-h-[148px] overflow-hidden rounded-xl border p-4 shadow-sm active:opacity-90",
        meta.frame
      )}
    >
      <View className="flex-1 gap-3">
        <View className="flex-row items-center justify-between">
          <View className={cx("h-10 w-10 items-center justify-center rounded-lg", meta.icon)}>
            <Icon name={icon} size={19} color={meta.tint} />
          </View>
          {badge ? (
            <View className="bg-surface/80 rounded-pill px-2 py-1">
              <Text className="font-ui text-brand text-2xs font-semibold">{badge}</Text>
            </View>
          ) : null}
        </View>
        <View className="gap-1">
          {eyebrow ? (
            <Text className="font-ui text-text-muted tracking-caps text-2xs font-semibold uppercase">
              {eyebrow}
            </Text>
          ) : null}
          <Text className="font-display text-text-primary text-lg leading-6">{title}</Text>
          <Text className="font-ui text-text-secondary text-xs leading-5">{description}</Text>
        </View>
      </View>
      <View className="absolute bottom-4 right-4">
        <Icon name="arrow-up-right" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}
