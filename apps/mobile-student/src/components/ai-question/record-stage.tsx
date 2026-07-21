/**
 * ai-question/record-stage — the audio record hero (capability-variants D). The
 * record affordance is the hero: idle marigold button that breathes gently, a
 * live recording state (pulsing ring, blinking dot + mono timer, live level
 * bars), stop snaps to a crisp preview card (rendered by PartsStack). Presentational
 * — recording control is driven by props (W3's capture hook owns the machinery).
 */
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import { colors } from "../../theme";
import { Icon } from "../Icon";
import { GLOW_SPARK } from "./tokens";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** one live level bar — its own component so the hook order stays legal. */
function LiveBar({ t, index }: { t: Animated.SharedValue<number>; index: number }) {
  const style = useAnimatedStyle(() => {
    const base = 20 + ((index * 37) % 60);
    const swing = 24 * Math.sin((t.value + index * 0.35) * Math.PI * 2);
    return { height: `${Math.max(8, Math.min(100, base + swing))}%` };
  });
  return <Animated.View style={[{ width: 3, borderRadius: 999 }, style]} className="bg-spark" />;
}

/** live level bars — cheap animated heights while recording. */
function LiveWave() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(t);
  }, [t]);
  return (
    <View className="flex-row items-center gap-[3px]" style={{ height: 40 }}>
      {Array.from({ length: 24 }).map((_, i) => (
        <LiveBar key={i} t={t} index={i} />
      ))}
    </View>
  );
}

export function RecordStage({
  recording,
  elapsedSec,
  onStart,
  onStop,
  disabled,
  hint,
}: {
  recording: boolean;
  elapsedSec: number;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  const breathe = useSharedValue(1);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (recording) {
      cancelAnimation(breathe);
      breathe.value = 1;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
      breathe.value = withRepeat(
        withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
    }
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(pulse);
    };
  }, [recording, breathe, pulse]);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recording ? 1 : breathe.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 0.9 + pulse.value * 0.45 }],
  }));

  return (
    <View className="items-center gap-4 py-6">
      {recording ? (
        <>
          <View className="flex-row items-center gap-2">
            <View className="bg-error h-2.5 w-2.5 rounded-full" />
            <Text className="text-text-primary font-mono text-xl">{fmt(elapsedSec)}</Text>
          </View>
          <LiveWave />
        </>
      ) : null}

      <View className="items-center justify-center" style={{ width: 96, height: 96 }}>
        {recording ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                width: 96,
                height: 96,
                borderRadius: 48,
                borderWidth: 2,
                borderColor: colors.error,
              },
              ringStyle,
            ]}
          />
        ) : null}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={recording ? onStop : onStart}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={recording ? "Stop recording" : "Record your answer"}
            style={[
              {
                width: 88,
                height: 88,
                borderRadius: 44,
                alignItems: "center",
                justifyContent: "center",
              },
              recording
                ? { backgroundColor: colors.error }
                : { backgroundColor: colors.spark, ...GLOW_SPARK },
            ]}
          >
            <Icon
              name={recording ? "square" : "mic"}
              size={34}
              color={recording ? colors.textOnAccent : colors.textPrimary}
            />
          </Pressable>
        </Animated.View>
      </View>

      <Text className="text-text-muted text-sm">
        {recording ? "Recording… tap to stop" : (hint ?? "Tap to record")}
      </Text>
    </View>
  );
}
