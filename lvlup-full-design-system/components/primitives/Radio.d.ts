import React from "react";

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function Radio(props: RadioProps): JSX.Element;
