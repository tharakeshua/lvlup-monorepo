import * as React from "react";

export interface AchievementProps {
  /** Lucide icon name for the medal. Defaults to "award". */
  icon?: string;
  /** Achievement label shown under the medal. */
  name?: string;
  /** When true, renders the dimmed/locked state. */
  locked?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Gamification" subtitle="Unlocked + locked" viewport="720x260" */
export function Achievement(props: AchievementProps): JSX.Element;
