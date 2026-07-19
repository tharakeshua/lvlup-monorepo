import React from "react";

export interface ProgressBarProps {
  value?: number;
  variant?: "spark" | "success" | string;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Brand · spark · success" viewport="700x240" */
export function ProgressBar(props: ProgressBarProps): JSX.Element;
