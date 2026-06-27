/**
 * AttemptBar — the numbered item-progress strip at the top of the learning
 * content view (design: the `NumNode` row). Each node reflects the learner's
 * mastery on that item; tap to jump. Horizontally scrollable for long tracks.
 */
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon } from "./Icon";
import type { AttemptBarItem, AttemptBarProps, AttemptItemStatus } from "./_types";

const STATUS_META: Record<
  AttemptItemStatus,
  { box: string; text: string; icon?: string; iconColor?: string }
> = {
  mastered: {
    box: "bg-success border-success",
    text: "text-text-on-accent",
    icon: "check",
    iconColor: colors.textOnAccent,
  },
  partial: { box: "bg-marigold-200 border-warning", text: "text-warning" },
  incorrect: { box: "bg-red-200 border-error", text: "text-error" },
  current: { box: "bg-surface border-brand", text: "text-brand" },
  none: { box: "bg-surface border-border-strong", text: "text-text-muted" },
};

export function AttemptBar({ items = [], current, onSelect, className }: AttemptBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row items-center gap-2 px-1 py-1"
      className={cx("flex-grow-0", className)}
    >
      {items.map((it: AttemptBarItem, i) => {
        const isCurrent = current === i;
        const status: AttemptItemStatus = isCurrent ? "current" : (it.status ?? "none");
        const m = STATUS_META[status];
        return (
          <Pressable
            key={i}
            onPress={onSelect ? () => onSelect(i) : undefined}
            className={cx(
              "h-9 w-9 items-center justify-center rounded-full border-2",
              m.box,
              isCurrent && "shadow-sm"
            )}
            accessibilityRole="button"
            accessibilityState={{ selected: isCurrent }}
          >
            {m.icon ? (
              <Icon name={m.icon} size={16} color={m.iconColor} strokeWidth={2.6} />
            ) : (
              <Text className={cx("font-ui text-sm font-bold", m.text)}>{i + 1}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
