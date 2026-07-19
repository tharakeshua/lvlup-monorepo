/**
 * <Reveal> — wraps a block so it eases in (opacity + rise) after `delay`. Used
 * to cascade the feedback sections ~60ms apart. Always settles visible, so the
 * static web export screenshots capture the resting layout.
 */
import type { ReactNode } from "react";
import { Animated } from "react-native";

import { useReveal } from "./motion";

export function Reveal({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  const style = useReveal(delay);
  return <Animated.View style={style}>{children}</Animated.View>;
}
