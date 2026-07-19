import * as React from "react";

export interface InsightCardProps {
  icon?: string;
  title?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Learning" subtitle="AI insight callout" viewport="740x280" */
export function InsightCard(props: InsightCardProps): JSX.Element;
