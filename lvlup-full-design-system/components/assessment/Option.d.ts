import React from "react";

export interface OptionProps {
  selected?: boolean;
  state?: "correct" | "incorrect" | string;
  marker?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function Option(props: OptionProps): JSX.Element;
