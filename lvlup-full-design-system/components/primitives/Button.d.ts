import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "spark";
  size?: "sm" | "lg";
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Buttons" subtitle="5 variants · sizes · icon · loading · disabled" viewport="720x300" */
export function Button(props: ButtonProps): JSX.Element;
