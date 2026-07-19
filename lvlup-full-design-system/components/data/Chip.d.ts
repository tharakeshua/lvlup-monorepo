import React from "react";

export interface ChipProps {
  active?: boolean;
  removable?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Default · active · removable" viewport="780x220" */
export function Chip(props: ChipProps): JSX.Element;
