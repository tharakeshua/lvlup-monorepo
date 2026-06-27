/**
 * Learning composites: SpaceCard, StoryPointNode, StoryPointTrack.
 * Mirror the Lyceum web learning components (mastery states, progress).
 */
import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "../theme";
import { Card } from "./primitives";
import { ProgressBar } from "./data";
import { cx } from "./cx";
import { Icon, renderIcon } from "./Icon";
import type {
  SpaceCardProps,
  StoryPointNodeProps,
  StoryPointState,
  StoryPointTrackProps,
} from "./_types";

// --- SpaceCard --------------------------------------------------------------
export function SpaceCard({
  title,
  description,
  points,
  progress,
  icon = "book-open",
  spark,
  onPress,
  className,
}: SpaceCardProps) {
  return (
    <Card onPress={onPress} className={cx("gap-3", className)}>
      <View className="flex-row items-start gap-3">
        <View
          className={cx(
            "h-11 w-11 items-center justify-center rounded-lg",
            spark ? "bg-marigold-50" : "bg-brand-subtle"
          )}
        >
          {renderIcon(icon, { size: 22, color: spark ? colors.spark : colors.brand })}
        </View>
        <View className="flex-1">
          <Text
            className="font-display text-text-primary text-base font-semibold"
            numberOfLines={2}
          >
            {title}
          </Text>
          {description != null && (
            <Text className="font-ui text-text-muted mt-0.5 text-sm" numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
      </View>
      {(progress != null || points != null) && (
        <View className="gap-1.5">
          {progress != null && <ProgressBar value={progress} variant={spark ? "spark" : "brand"} />}
          <View className="flex-row items-center justify-between">
            {points != null ? (
              <Text className="font-ui text-2xs text-text-muted">{points} story points</Text>
            ) : (
              <View />
            )}
            {progress != null && (
              <Text className="font-ui text-2xs text-text-secondary font-semibold">
                {Math.round(progress)}%
              </Text>
            )}
          </View>
        </View>
      )}
    </Card>
  );
}

// --- StoryPointNode ---------------------------------------------------------
const NODE_META: Record<
  StoryPointState,
  { box: string; ring: string; icon?: string; iconColor?: string; text: string }
> = {
  mastered: {
    box: "bg-success",
    ring: "border-success",
    icon: "check",
    iconColor: colors.textOnAccent,
    text: "text-text-on-accent",
  },
  "in-progress": { box: "bg-brand", ring: "border-brand", text: "text-text-on-accent" },
  "not-started": { box: "bg-surface", ring: "border-border-strong", text: "text-text-muted" },
  locked: {
    box: "bg-surface-sunken",
    ring: "border-border-subtle",
    icon: "lock",
    iconColor: colors.textMuted,
    text: "text-text-muted",
  },
};

export function StoryPointNode({
  state = "not-started",
  index,
  label,
  onPress,
  className,
}: StoryPointNodeProps) {
  const m = NODE_META[state];
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap onPress={onPress} className={cx("items-center gap-1", className)}>
      <View
        className={cx("h-9 w-9 items-center justify-center rounded-full border-2", m.box, m.ring)}
      >
        {m.icon ? (
          <Icon name={m.icon} size={16} color={m.iconColor} strokeWidth={2.6} />
        ) : (
          <Text className={cx("font-ui text-sm font-bold", m.text)}>
            {index != null ? index + 1 : ""}
          </Text>
        )}
      </View>
      {label != null && (
        <Text
          style={{ maxWidth: 64 }}
          className="font-ui text-2xs text-text-muted text-center"
          numberOfLines={2}
        >
          {label}
        </Text>
      )}
    </Wrap>
  );
}

// --- StoryPointTrack --------------------------------------------------------
export function StoryPointTrack({ nodes = [], onSelect, className }: StoryPointTrackProps) {
  return (
    <View className={cx("flex-row items-start", className)}>
      {nodes.map((n, i) => {
        const done = n.state === "mastered";
        return (
          <Fragment key={i}>
            {i > 0 && (
              <View
                className={cx(
                  "mt-4 h-0.5 flex-1",
                  done || nodes[i - 1]?.state === "mastered" ? "bg-success" : "bg-border-strong"
                )}
              />
            )}
            <StoryPointNode
              state={n.state}
              index={i}
              label={n.label}
              onPress={onSelect ? () => onSelect(i) : undefined}
            />
          </Fragment>
        );
      })}
    </View>
  );
}
