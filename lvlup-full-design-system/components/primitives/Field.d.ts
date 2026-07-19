import React from "react";

export interface FieldProps {
  label?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  error?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Forms" subtitle="Label · required · hint · error" viewport="700x340" */
export function Field(props: FieldProps): JSX.Element;
