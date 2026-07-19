import React from "react";

export interface GradePillProps {
  grade?: "A" | "B" | "C" | "D" | "F" | string;
  score?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Assessment" subtitle="Letter A–F + score" viewport="700x220" */
export function GradePill(props: GradePillProps): JSX.Element;
