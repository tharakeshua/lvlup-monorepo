import React from "react";

export interface TimelineItem {
  time?: React.ReactNode;
  label?: React.ReactNode;
  variant?: "success" | "muted" | string;
}

export interface TimelineProps {
  items?: TimelineItem[];
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Activity feed" viewport="700x380" */
export function Timeline(props: TimelineProps): JSX.Element;
