import * as React from "react";

export interface NavItemProps {
  href?: string;
  active?: boolean;
  icon?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** @startingPoint section="Navigation" subtitle="Role-driven nav" viewport="320x720" */
export function NavItem(props: NavItemProps): JSX.Element;
