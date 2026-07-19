import * as React from "react";

export interface StreakFlameProps {
  /** Number of consecutive days; rendered as "{days}d" next to the flame. */
  days?: number;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Gamification" subtitle="Daily streak" viewport="700x200" */
export function StreakFlame(props: StreakFlameProps): JSX.Element;
