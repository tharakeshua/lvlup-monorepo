/**
 * AttemptBar — the numbered item-progress strip at the top of the learning
 * content view. Lyceum language: square rounded-md nodes, mono numerals,
 * status-colored (mastered green / partial amber / incorrect soft red), the
 * current node ringed in brand indigo. Tap to jump; horizontally scrollable.
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
    box: "bg-mastery-mastered border-transparent",
    text: "text-text-on-accent",
    icon: "check",
    iconColor: colors.textOnAccent,
  },
  partial: { box: "bg-warning border-transparent", text: "text-text-on-accent" },
  incorrect: { box: "bg-red-200 border-error/40", text: "text-error" },
  current: { box: "bg-surface border-brand border-2", text: "text-brand" },
  none: { box: "bg-surface-sunken border-transparent", text: "text-text-muted" },
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
        const status: AttemptItemStatus =
          isCurrent && (it.status ?? "none") === "none" ? "current" : (it.status ?? "none");
        const m = STATUS_META[status];
        return (
          <Pressable
            key={i}
            onPress={onSelect ? () => onSelect(i) : undefined}
            className={cx(
              "h-11 w-11 items-center justify-center rounded-md border",
              m.box,
              isCurrent && status !== "current" && "border-brand border-2"
            )}
            accessibilityRole="button"
            accessibilityState={{ selected: isCurrent }}
          >
            {m.icon ? (
              <Icon name={m.icon} size={16} color={m.iconColor} strokeWidth={2.6} />
            ) : (
              <Text className={cx("font-mono text-sm font-medium", m.text)}>{i + 1}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
