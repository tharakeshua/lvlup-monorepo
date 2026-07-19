/**
 * ai-question/capability-pills — the inline capability affordance row (Surface A
 * zone 5, `.cap-row`/`.cap`). Only the ENABLED capabilities render, per the
 * resolved CapabilityConfig; disabled ones are absent. Capture pills carry the
 * marigold (spark) accent; the focus-mode pill carries brand indigo.
 */
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { colors } from "../../theme";
import { cx } from "../cx";
import { Icon } from "../Icon";
import type { CapabilityConfig } from "./capability";
import { DURATION, REDUCE_MOTION } from "./tokens";

function Cap({
  icon,
  label,
  onPress,
  disabled,
  tone = "spark",
  index = 0,
  compact,
}: {
  icon: string;
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "spark" | "brand" | "danger";
  index?: number;
  compact?: boolean;
}) {
  const tint = tone === "brand" ? colors.brand : tone === "danger" ? colors.error : colors.spark;
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40)
        .duration(DURATION.base)
        .reduceMotion(REDUCE_MOTION)}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? icon}
        className={cx(
          "border-border-subtle bg-surface rounded-pill active:bg-surface-sunken flex-row items-center gap-2 border px-4",
          compact ? "h-9" : "h-11",
          disabled && "opacity-50"
        )}
      >
        <Icon name={icon} size={17} color={tint} />
        {label ? (
          <Text className="font-ui text-text-primary text-sm font-medium">{label}</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function CapabilityPills({
  config,
  onRecord,
  onCamera,
  onPhoto,
  onAddNote,
  onFocus,
  showNote,
  noteActive,
  disabled,
  compact,
}: {
  config: CapabilityConfig;
  onRecord?: () => void;
  onCamera?: () => void;
  onPhoto?: () => void;
  onAddNote?: () => void;
  onFocus?: () => void;
  /** whether the "Add a note" affordance is relevant (writeOptional + not yet shown). */
  showNote?: boolean;
  noteActive?: boolean;
  disabled?: boolean;
  /** keyboard-open compact height (A6). */
  compact?: boolean;
}) {
  let i = 0;
  const pills: React.ReactNode[] = [];

  // audio: record is the hero — it lives in the RecordStage, not here — but a
  // re-record affordance appears once a clip exists (handled by the stage).
  if (config.record && config.primary !== "record") {
    pills.push(
      <Cap
        key="rec"
        icon="mic"
        label="Record"
        onPress={onRecord}
        disabled={disabled}
        index={i++}
        compact={compact}
      />
    );
  }
  if (config.camera) {
    pills.push(
      <Cap
        key="cam"
        icon="camera"
        label={config.variant === "code" ? "Photograph a diagram" : "Camera"}
        onPress={onCamera}
        disabled={disabled}
        index={i++}
        compact={compact}
      />
    );
  }
  if (config.photo) {
    pills.push(
      <Cap
        key="photo"
        icon="image"
        label={config.primary === "camera" ? "Photo library" : "Add photo"}
        onPress={onPhoto}
        disabled={disabled}
        index={i++}
        compact={compact}
      />
    );
  }
  // opt-in text note for audio/image
  if (config.writeOptional && showNote && !noteActive) {
    pills.push(
      <Cap
        key="note"
        icon="type"
        label="Add a note"
        tone="brand"
        onPress={onAddNote}
        disabled={disabled}
        index={i++}
        compact={compact}
      />
    );
  }

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {pills}
      {onFocus ? (
        <>
          <View className="flex-1" />
          <Cap
            key="focus"
            icon="maximize-2"
            tone="brand"
            onPress={onFocus}
            disabled={disabled}
            index={i}
            compact={compact}
          />
        </>
      ) : null}
    </View>
  );
}
