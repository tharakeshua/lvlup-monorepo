import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  className?: string;
}

/** @startingPoint section="Forms" subtitle="Default · error · disabled" viewport="700x300" */
export function Textarea(props: TextareaProps): JSX.Element;
