import * as React from "react";

export interface LeaderboardRowProps {
  /** Rank position; ranks <= 3 get the "top" highlight. */
  rank?: number;
  /** Initials shown in the composed Avatar. */
  initials?: string;
  /** Display name of the learner. */
  name?: string;
  /** XP total rendered on the trailing edge. */
  xp?: number;
  /** When true, highlights this row as the current viewer. */
  me?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Gamification" subtitle="Ranked list with the 'me' row highlighted" viewport="500x380" */
export function LeaderboardRow(props: LeaderboardRowProps): JSX.Element;
