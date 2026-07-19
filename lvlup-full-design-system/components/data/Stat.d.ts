import React from "react";

export interface StatProps {
  label?: React.ReactNode;
  value?: React.ReactNode;
  delta?: React.ReactNode;
  trend?: "up" | "down";
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Value · up & down deltas" viewport="780x240" */
export function Stat(props: StatProps): JSX.Element;
