import * as React from "react";

export interface XPMeterProps {
  /** Current level number shown in the header. */
  level?: number;
  /** Current XP amount; fill ratio is xp / next. */
  xp?: number;
  /** XP required for the next level. */
  next?: number;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Gamification" subtitle="Level progress" viewport="700x240" */
export function XPMeter(props: XPMeterProps): JSX.Element;
