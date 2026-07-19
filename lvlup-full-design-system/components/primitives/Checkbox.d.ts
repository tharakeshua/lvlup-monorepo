import React from "react";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

/** @startingPoint section="Forms" subtitle="Checked · unchecked · disabled" viewport="700x240" */
export function Checkbox(props: CheckboxProps): JSX.Element;
