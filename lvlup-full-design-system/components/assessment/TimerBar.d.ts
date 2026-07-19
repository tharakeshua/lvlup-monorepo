import React from "react";

export interface TimerBarProps {
  tone?: "warning" | "critical" | string;
  time?: React.ReactNode;
  percent?: number;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Assessment" subtitle="Normal · warning · critical" viewport="740x260" */
export function TimerBar(props: TimerBarProps): JSX.Element;
