import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  className?: string;
}

/** @startingPoint section="Forms" subtitle="Default · focus · error · disabled" viewport="700x300" */
export function Input(props: InputProps): JSX.Element;
