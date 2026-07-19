import * as React from "react";

export interface AtRiskBadgeProps {
  level?: "watch" | "at-risk" | string;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Learning" subtitle="At-risk + watch" viewport="700x220" */
export function AtRiskBadge(props: AtRiskBadgeProps): JSX.Element;
