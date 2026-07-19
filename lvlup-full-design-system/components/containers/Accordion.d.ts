import * as React from "react";

export interface AccordionItem {
  title: React.ReactNode;
  content: React.ReactNode;
}

export interface AccordionProps {
  /** Accordion sections; each has a `title` and collapsible `content`. */
  items?: AccordionItem[];
  /** Index of the section open on mount (use -1 / null for all collapsed). */
  defaultOpen?: number;
  className?: string;
}

/** @startingPoint section="Containers" subtitle="Expand / collapse" viewport="700x380" */
export function Accordion(props: AccordionProps): JSX.Element;
