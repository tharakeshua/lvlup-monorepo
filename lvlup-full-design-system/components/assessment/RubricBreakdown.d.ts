import React from "react";

export interface RubricCriterion {
  label?: React.ReactNode;
  desc?: React.ReactNode;
  score?: number;
  max?: number;
}

export interface RubricBreakdownProps {
  criteria?: RubricCriterion[];
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Assessment" subtitle="Criteria scoring" viewport="740x400" */
export function RubricBreakdown(props: RubricBreakdownProps): JSX.Element;
