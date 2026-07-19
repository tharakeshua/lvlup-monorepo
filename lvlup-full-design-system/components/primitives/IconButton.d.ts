import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm";
  solid?: boolean;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Buttons" subtitle="Default · solid · sizes" viewport="700x200" */
export function IconButton(props: IconButtonProps): JSX.Element;
