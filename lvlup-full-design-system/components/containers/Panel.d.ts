import * as React from "react";

export interface PanelProps {
  /** Heading shown in the panel header. */
  title?: React.ReactNode;
  /** Optional actions (e.g. buttons) rendered to the right of the title. */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Containers" subtitle="Titled panel with header actions" viewport="780x320" */
export function Panel(props: PanelProps): JSX.Element;
