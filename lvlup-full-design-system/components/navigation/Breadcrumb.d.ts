import * as React from "react";

export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
}

export interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  children?: React.ReactNode;
  className?: string;
}

/** @startingPoint section="Navigation" subtitle="Hierarchical path" viewport="780x140" */
export function Breadcrumb(props: BreadcrumbProps): JSX.Element;
