import * as React from "react";

export interface CardProps {
  /** Adds the `card--interactive` hover/focus affordance. */
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

/** @startingPoint section="Containers" subtitle="Rest · interactive · header + actions" viewport="780x360" */
export function Card(props: CardProps): JSX.Element;
