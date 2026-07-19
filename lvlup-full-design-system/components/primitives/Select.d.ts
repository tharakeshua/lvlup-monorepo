import React from "react";

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Forms" subtitle="Default · disabled" viewport="700x240" */
export function Select(props: SelectProps): JSX.Element;
