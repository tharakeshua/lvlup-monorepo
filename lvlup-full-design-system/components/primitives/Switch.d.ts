import React from "react";

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Forms" subtitle="On · off · with label" viewport="700x180" */
export function Switch(props: SwitchProps): JSX.Element;
