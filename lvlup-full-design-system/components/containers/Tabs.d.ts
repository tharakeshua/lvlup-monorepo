import * as React from "react";

export interface TabsItem {
  label: React.ReactNode;
  content: React.ReactNode;
}

export interface TabsProps {
  /** Tab definitions; each has a `label` and `content` panel. */
  items?: TabsItem[];
  /** Index of the tab selected on mount. */
  defaultIndex?: number;
  /** Render the pill variant (`tabs--pill`) instead of the underline default. */
  pill?: boolean;
  className?: string;
}

/** @startingPoint section="Containers" subtitle="Underline + pill variants" viewport="780x320" */
export function Tabs(props: TabsProps): JSX.Element;
