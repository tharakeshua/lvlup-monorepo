/**
 * Feedback-surface motion (ports the card `frame__note`s): the verdict lands
 * first, the percentage bar DRAWS, then sections cascade ~60ms apart, and score
 * bars fill. Built on RN's Animated so every element is guaranteed to settle at
 * its final visible state — even on the static web export used for screenshots
 * (no dependence on layout-animation firing). Durations/easings mirror the
 * Lyceum motion tokens (--dur-*, --ease-*).
 */
import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

/** --ease-entrance / --ease-standard from tokens/lyceum.css. */
export const EASE_ENTRANCE = Easing.bezier(0.05, 0.7, 0.1, 1);
export const EASE_STANDARD = Easing.bezier(0.2, 0, 0, 1);

/** Section cascade: base offset + 60ms per index (design: "60ms apart"). */
export const STAGGER_BASE = 90;
export const STAGGER_STEP = 60;
export const staggerDelay = (index: number) => STAGGER_BASE + index * STAGGER_STEP;

/** A value that eases 0→1 on mount after `delay`. Opacity + rise transform. */
export function useReveal(delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 320,
      delay,
      easing: EASE_ENTRANCE,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, delay]);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
}

/**
 * A width percentage that DRAWS from 0 to `pct` after `delay`. Returned as an
 * interpolated "%" string for the fill of a bar. useNativeDriver:false because
 * width is a layout prop.
 */
export function useDrawWidth(pct: number | null, delay = 120) {
  const target = Math.max(0, Math.min(100, pct ?? 0));
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: target,
      duration: 560,
      delay,
      easing: EASE_STANDARD,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [v, target, delay]);
  return v.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
}

/**
 * A one-shot shimmer sweep for the "Got it!" verdict icon (design: the only
 * celebratory flourish, ~600ms). Returns an opacity pulse; harmless no-op tone
 * for the other verdicts (caller passes enabled=false).
 */
export function useShimmer(enabled: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return;
    const a = Animated.sequence([
      Animated.delay(220),
      Animated.timing(v, {
        toValue: 1,
        duration: 300,
        easing: EASE_STANDARD,
        useNativeDriver: true,
      }),
      Animated.timing(v, {
        toValue: 0,
        duration: 300,
        easing: EASE_STANDARD,
        useNativeDriver: true,
      }),
    ]);
    a.start();
    return () => a.stop();
  }, [v, enabled]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });
}
