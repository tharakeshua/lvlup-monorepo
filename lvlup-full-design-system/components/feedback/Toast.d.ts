import * as React from "react";

export interface ToastProps {
  /** Severity, drives icon + color. @default "info" */
  variant?: "success" | "error" | "warning" | "info";
  /** Bold title line. */
  title?: React.ReactNode;
  /** Optional secondary message below the title. */
  body?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Feedback" subtitle="Success · error · warning · info" viewport="780x340" */
export function Toast(props: ToastProps): JSX.Element;
