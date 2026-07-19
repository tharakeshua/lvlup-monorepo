import * as React from "react";

export interface SectionProps {
  /** Section heading rendered as an `<h3>`. */
  title?: React.ReactNode;
  /** Optional actions rendered to the right of the title. */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Containers" subtitle="Section header + content" viewport="780x260" */
export function Section(props: SectionProps): JSX.Element;
