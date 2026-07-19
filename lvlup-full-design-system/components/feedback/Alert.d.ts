import * as React from "react";

export interface AlertProps {
  /** Severity, drives icon + color. @default "info" */
  variant?: "success" | "error" | "warning" | "info";
  /** Optional bold heading above the body. */
  title?: React.ReactNode;
  /** Alert body content. */
  children?: React.ReactNode;
  className?: string;
}

/** @startingPoint section="Feedback" subtitle="Four severities" viewport="780x380" */
export function Alert(props: AlertProps): JSX.Element;
