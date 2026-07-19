/**
 * ai-question/evaluating — Surface F, the ~8s designed wait + the failure
 * recovery. The brand's hero moment: a breathing indigo orb, a slow aurora
 * sweep, rotating rubric-aware hints, and progress dots so it never feels stuck.
 * Commit-once + backgroundable (owner decision): no cancel; a calm "you can
 * leave, we'll save your result here" note.
 *
 * IMPORTANT: this surface's PRESENCE is driven by the real recordItemAttempt
 * mutation (shown while pending; replaced by the feedback surface on success or
 * the failure state on error). The internal timer only rotates cosmetic hints
 * and shifts the "taking longer" copy after ~12s — completion is never faked.
 */
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { colors, palette } from "../../theme";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { Button } from "../primitives";
import { PartsStack } from "./parts-stack";
import type { AnswerPart } from "./answer-bundle";
import { DURATION, REDUCE_MOTION } from "./tokens";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DEFAULT_HINTS = [
  "reading your reasoning",
  "weighing the key ideas",
  "checking clarity of explanation",
  "looking for what you did well",
];

/** the breathing orb + rotating aurora arc. */
function AuroraOrb() {
  const breathe = useSharedValue(0.96);
  const spin = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1.06, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    spin.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(spin);
    };
  }, [breathe, spin]);
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <View className="items-center justify-center" style={{ width: 96, height: 96 }}>
      <Animated.View style={[{ position: "absolute", width: 96, height: 96 }, ringStyle]}>
        <Svg width={96} height={96}>
          <Defs>
            <LinearGradient id="aurora" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.indigo[400]} stopOpacity="0.9" />
              <Stop offset="0.6" stopColor={palette.marigold[500]} stopOpacity="0.5" />
              <Stop offset="1" stopColor={palette.indigo[400]} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <AnimatedCircle
            cx={48}
            cy={48}
            r={42}
            stroke="url(#aurora)"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 42 * 0.66} ${2 * Math.PI * 42}`}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          {
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.indigo[500],
          },
          orbStyle,
        ]}
      >
        <Icon name="book-open" size={24} color={colors.textOnAccent} />
      </Animated.View>
    </View>
  );
}

export function EvaluatingState({
  hints,
  answerText,
  answerParts = [],
  submittedAtLabel,
}: {
  /** rubric-aware hint fragments (the actual enabled dimensions); defaults if empty. */
  hints?: string[];
  answerText?: string;
  answerParts?: AnswerPart[];
  submittedAtLabel?: string;
}) {
  const pool = hints && hints.length ? hints : DEFAULT_HINTS;
  const [tick, setTick] = useState(0);
  const [longer, setLonger] = useState(false);

  useEffect(() => {
    const rot = setInterval(() => setTick((t) => t + 1), 2500);
    const long = setTimeout(() => setLonger(true), 12000);
    return () => {
      clearInterval(rot);
      clearTimeout(long);
    };
  }, []);

  const hint = pool[tick % pool.length];
  const dotsOn = Math.min(4, 1 + (tick % 4));

  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.slow).reduceMotion(REDUCE_MOTION)}
      className="gap-4"
    >
      <View className="bg-brand-subtle items-center gap-3 overflow-hidden rounded-xl px-5 py-8">
        <AuroraOrb />
        <Text className="font-display text-brand text-lg">
          {longer ? "Still reading — almost there" : "Reading your answer…"}
        </Text>
        <Text className="text-text-secondary text-sm">
          {longer ? (
            "Thorough answers take a moment longer"
          ) : (
            <>
              Looking at <Text className="text-brand font-semibold">{hint}</Text>
            </>
          )}
        </Text>
        <View className="flex-row gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              className={cx("h-1.5 w-1.5 rounded-full", i < dotsOn ? "bg-brand" : "bg-brand-muted")}
            />
          ))}
        </View>
      </View>

      {/* backgroundable — no cancel; in-app degradation of the notify affordance */}
      <View className="border-border-subtle bg-surface-sunken flex-row items-center gap-2 rounded-md border px-3 py-2">
        <Icon name="bell" size={15} color={colors.brand} />
        <Text className="text-text-secondary flex-1 text-xs">
          You can leave — your result will be saved here when it's ready.
        </Text>
      </View>

      {/* the submitted answer, read-only */}
      {answerText || answerParts.length ? (
        <View
          className="border-border-subtle bg-surface gap-2 rounded-lg border px-4 py-3"
          style={{ opacity: 0.9 }}
        >
          <View className="flex-row items-center gap-2">
            <Icon name="file-text" size={15} color={colors.brand} />
            <Text className="text-text-primary flex-1 text-sm font-semibold">Your answer</Text>
            {submittedAtLabel ? (
              <Text className="text-text-muted text-2xs font-mono">{submittedAtLabel}</Text>
            ) : null}
          </View>
          {answerText ? (
            <Text className="text-text-secondary text-sm leading-5" numberOfLines={4}>
              {answerText}
            </Text>
          ) : null}
          <PartsStack parts={answerParts} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/* ── failure recovery (F3) ───────────────────────────────────────────────── */
export function EvaluationFailed({
  onRetry,
  onBackToAnswer,
}: {
  onRetry: () => void;
  onBackToAnswer?: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.base).reduceMotion(REDUCE_MOTION)}
      className="gap-3"
    >
      <View className="bg-marigold-50 items-center gap-3 rounded-xl px-5 py-8">
        <View className="bg-warning h-14 w-14 items-center justify-center rounded-full">
          <Icon name="cloud-off" size={24} color={colors.textOnAccent} />
        </View>
        <Text className="font-display text-text-primary text-lg">We couldn't finish grading</Text>
        <Text className="text-text-muted text-sm">Your answer is safe — nothing was lost.</Text>
      </View>
      <Button
        variant="primary"
        block
        onPress={onRetry}
        leadingIcon={<Icon name="rotate-ccw" size={16} />}
      >
        Try grading again
      </Button>
      {onBackToAnswer ? (
        <Button variant="ghost" block onPress={onBackToAnswer}>
          Back to my answer
        </Button>
      ) : null}
    </Animated.View>
  );
}
