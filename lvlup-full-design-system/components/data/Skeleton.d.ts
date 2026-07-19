import React from "react";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: "text" | "circle" | string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Loading placeholders" viewport="700x280" */
export function Skeleton(props: SkeletonProps): JSX.Element;
