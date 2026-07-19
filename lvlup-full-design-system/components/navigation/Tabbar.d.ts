import * as React from "react";

export interface TabbarItem {
  icon: string;
  label: React.ReactNode;
  href?: string;
  active?: boolean;
}

export interface TabbarProps {
  items?: TabbarItem[];
  className?: string;
}

/** @startingPoint section="Navigation" subtitle="Bottom tab navigation" viewport="420x180" */
export function Tabbar(props: TabbarProps): JSX.Element;
