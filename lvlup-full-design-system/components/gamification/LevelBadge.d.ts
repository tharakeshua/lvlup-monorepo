import * as React from "react";

export interface LevelBadgeProps {
  /** Level number rendered prominently in the badge. */
  level?: number;
  /** When true, applies the celebratory "spark" treatment. */
  spark?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Gamification" subtitle="Default + spark" viewport="700x220" */
export function LevelBadge(props: LevelBadgeProps): JSX.Element;
