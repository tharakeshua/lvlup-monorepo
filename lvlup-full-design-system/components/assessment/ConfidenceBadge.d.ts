import React from "react";

export interface ConfidenceBadgeProps {
  level?: "low" | "med" | "high";
  value?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Assessment" subtitle="AI routing confidence" viewport="700x220" */
export function ConfidenceBadge(props: ConfidenceBadgeProps): JSX.Element;
