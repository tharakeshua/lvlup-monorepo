/**
 * ai-question/banners — the draft-restored and validation banners (Surface A5)
 * plus the shared shake hook for the disabled-Check-answer nudge. Warm, calm,
 * never alarming; the draft banner never loses written work.
 */
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors } from "../../theme";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { DURATION, EASE, REDUCE_MOTION } from "./tokens";

/* ── draft restored ──────────────────────────────────────────────────────── */
export function DraftRestoredBanner({
  onStartFresh,
  label = "Draft restored.",
}: {
  onStartFresh?: () => void;
  label?: string;
}) {
  return (
    <Animated.View
      entering={FadeInUp.duration(DURATION.base).reduceMotion(REDUCE_MOTION)}
      className="border-border-subtle bg-surface-sunken flex-row items-center gap-2 rounded-md border px-3 py-2"
    >
      <Icon name="history" size={15} color={colors.brand} />
      <Text className="text-text-secondary flex-1 text-xs">{label}</Text>
      {onStartFresh ? (
        <Pressable onPress={onStartFresh} accessibilityRole="button" hitSlop={6}>
          <Text className="text-brand text-xs font-semibold">Start fresh</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/* ── validation warn ─────────────────────────────────────────────────────── */
export function ValidationBanner({
  message = "Add something first — write, record, or attach a photo.",
}: {
  message?: string;
}) {
  return (
    <Animated.View
      entering={FadeInUp.duration(DURATION.base).reduceMotion(REDUCE_MOTION)}
      className="border-warning bg-marigold-50 flex-row items-center gap-2 rounded-md border px-3 py-2"
    >
      <Icon name="pencil" size={15} color={colors.warning} />
      <Text className="text-warning flex-1 text-xs">{message}</Text>
    </Animated.View>
  );
}

/* ── permission-denied (mic / camera) ────────────────────────────────────── */
export function PermissionBanner({
  message,
  onOpenSettings,
  icon = "mic-off",
}: {
  message: string;
  onOpenSettings?: () => void;
  icon?: string;
}) {
  return (
    <Animated.View
      entering={FadeInUp.duration(DURATION.base).reduceMotion(REDUCE_MOTION)}
      className="border-warning bg-marigold-50 flex-row items-center gap-2 rounded-md border px-3 py-2"
    >
      <Icon name={icon} size={15} color={colors.warning} />
      <Text className="text-warning flex-1 text-xs">{message}</Text>
      {onOpenSettings ? (
        <Pressable onPress={onOpenSettings} accessibilityRole="button" hitSlop={6}>
          <Text className="text-warning text-xs font-semibold">Open Settings</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/* ── shake hook for the disabled-check nudge (A5) ────────────────────────── */
export function useShake() {
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = () => {
    x.value = withSequence(
      withTiming(-8, { duration: 50, easing: EASE.standard }),
      withTiming(8, { duration: 50, easing: EASE.standard }),
      withTiming(-6, { duration: 50, easing: EASE.standard }),
      withTiming(6, { duration: 50, easing: EASE.standard }),
      withTiming(0, { duration: 50, easing: EASE.standard })
    );
  };
  return { style, shake };
}

/** Wrap the submit dock so it can shake on a blocked tap. */
export function Shakeable({
  shakeStyle,
  className,
  children,
}: {
  shakeStyle: ReturnType<typeof useAnimatedStyle>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Animated.View style={shakeStyle} className={cx(className)}>
      {children}
    </Animated.View>
  );
}
