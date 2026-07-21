/**
 * RecordStage — the audio-question capture hero (D1 idle → D2 recording), the
 * `.rec-stage / .rec-btn / .rec-timer / .wave--live` cluster from
 * `capability-variants.card.html`.
 *
 *  • Idle: an 88px spark record button (gently breathing) + "Tap to record" hint.
 *  • Recording: mono timer with a blinking dot, a live level meter, and the same
 *    88px target flipped to a pulsing red Stop. The state is announced for a11y
 *    (never signalled by colour/meter alone — 04-audio.md).
 *
 * Recorded clips are NOT shown here — they render as part cards below (the parent
 * composes RecordStage + the parts stack). Reduced-motion disables the pulses.
 */
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, Text, View } from "react-native";

import { colors } from "../../../theme";
import { Icon } from "../../../components/Icon";
import { Waveform } from "./Waveform";
import type { AudioRecorderState } from "../useAudioRecorder";

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface RecordStageProps {
  recorder: AudioRecorderState;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  hint?: string;
}

export function RecordStage({ recorder, onStart, onStop, disabled, hint }: RecordStageProps) {
  const { isRecording, durationMs, level } = recorder;
  const breathe = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      if (isRecording) {
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1,
              duration: 800,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulse, {
              toValue: 0,
              duration: 800,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
      } else {
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(breathe, {
              toValue: 1.03,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(breathe, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
      }
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [isRecording, breathe, pulse]);

  const label = isRecording
    ? `Recording, ${Math.floor(durationMs / 1000)} seconds. Tap to stop.`
    : "Record your spoken answer";

  return (
    <View className="items-center gap-4 py-6" accessibilityLiveRegion="polite">
      {isRecording ? (
        <>
          <View className="flex-row items-center gap-2">
            <Animated.View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: colors.error,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }),
              }}
            />
            <Text
              className="text-text-primary font-mono"
              style={{ fontSize: 22 }}
              accessibilityLabel={label}
            >
              {fmt(durationMs)}
            </Text>
          </View>
          <Waveform bars={24} height={40} live level={level} />
        </>
      ) : null}

      <View style={{ width: 108, height: 108, alignItems: "center", justifyContent: "center" }}>
        {isRecording ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 108,
              height: 108,
              borderRadius: 54,
              borderWidth: 2,
              borderColor: colors.error,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) },
              ],
            }}
          />
        ) : null}
        <Animated.View style={{ transform: [{ scale: isRecording ? 1 : breathe }] }}>
          <Pressable
            onPress={isRecording ? onStop : onStart}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? "Stop recording" : label}
            accessibilityState={{ disabled }}
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isRecording ? colors.error : colors.spark,
              shadowColor: isRecording ? colors.error : colors.spark,
              shadowOpacity: 0.4,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Icon
              name={isRecording ? "square" : "mic"}
              size={34}
              color={isRecording ? colors.textOnAccent : colors.textPrimary}
            />
          </Pressable>
        </Animated.View>
      </View>

      <Text className="font-ui text-text-muted text-sm">
        {isRecording ? "Recording… tap to stop" : (hint ?? "Tap to record — up to 3 minutes")}
      </Text>
    </View>
  );
}
