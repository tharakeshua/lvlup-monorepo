import React from "react";

export interface BadgeProps {
  variant?: "brand" | "success" | "warning" | "error" | "info" | "spark" | string;
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="All status variants + dot" viewport="780x240" */
export function Badge(props: BadgeProps): JSX.Element;
