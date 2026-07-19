import * as React from "react";

export interface SpaceCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  points?: number;
  progress?: number;
  spark?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Learning" subtitle="Subject space tile" viewport="780x360" */
export function SpaceCard(props: SpaceCardProps): JSX.Element;
