import React from "react";

export interface EmptyStateProps {
  icon?: string;
  title?: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="No-data with CTA" viewport="700x360" */
export function EmptyState(props: EmptyStateProps): JSX.Element;
