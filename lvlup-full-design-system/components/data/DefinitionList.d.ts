import React from "react";

export interface DefinitionListItem {
  term?: React.ReactNode;
  value?: React.ReactNode;
}

export interface DefinitionListProps {
  items?: DefinitionListItem[];
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Key/value pairs" viewport="700x280" */
export function DefinitionList(props: DefinitionListProps): JSX.Element;
