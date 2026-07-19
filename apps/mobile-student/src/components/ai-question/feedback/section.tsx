/**
 * FeedbackCard — the bordered surface section (`.fb-sec`) with an icon + title
 * head and optional trailing slot (e.g. a mono `7 / 10`). Shared by the rubric,
 * dimension, and growth blocks so they read as one family.
 */
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Icon } from "../../Icon";
import { cx } from "../../cx";
import { tone } from "./tone";

export function FeedbackCard({
  icon,
  title,
  trailing,
  tint,
  children,
}: {
  icon: string;
  title: string;
  trailing?: ReactNode;
  /** Optional accent for the head icon (defaults to brand). */
  tint?: string;
  children: ReactNode;
}) {
  return (
    <View className={cx("border-border-subtle bg-surface rounded-lg border px-4 py-3")}>
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={16} color={tint ?? tone.brand} />
        <Text className="font-ui text-text-primary flex-1 text-sm font-semibold">{title}</Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}
