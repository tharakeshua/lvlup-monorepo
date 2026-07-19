import React from "react";

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

/** @startingPoint section="Forms" subtitle="Range control" viewport="700x180" */
export function Slider(props: SliderProps): JSX.Element;
