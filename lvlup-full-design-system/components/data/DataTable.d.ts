import React from "react";

export interface DataTableColumn {
  key?: string;
  label?: React.ReactNode;
  numeric?: boolean;
  sortable?: boolean;
  render?: (row: any) => React.ReactNode;
}

export interface DataTableProps {
  columns?: DataTableColumn[];
  rows?: Array<Record<string, any> & { selected?: boolean }>;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Sortable · selected row · numeric · badges" viewport="860x480" */
export function DataTable(props: DataTableProps): JSX.Element;
