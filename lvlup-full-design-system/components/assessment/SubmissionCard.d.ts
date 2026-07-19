import React from "react";

export interface SubmissionCardProps {
  initials?: string;
  name?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Assessment" subtitle="Student submission row" viewport="740x300" */
export function SubmissionCard(props: SubmissionCardProps): JSX.Element;
