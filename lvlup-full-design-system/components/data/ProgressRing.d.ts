import React from "react";

export interface ProgressRingProps {
  value?: number;
  size?: number;
  label?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Circular percentage" viewport="700x220" */
export function ProgressRing(props: ProgressRingProps): JSX.Element;
