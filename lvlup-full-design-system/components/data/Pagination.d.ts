import React from "react";

export interface PaginationProps {
  pages?: number;
  current?: number;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Page navigation" viewport="700x180" */
export function Pagination(props: PaginationProps): JSX.Element;
