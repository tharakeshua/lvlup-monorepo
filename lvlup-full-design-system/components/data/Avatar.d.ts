import React from "react";

export interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: "sm" | "lg" | string;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Data" subtitle="Sizes · image · initials · group" viewport="700x220" */
export function Avatar(props: AvatarProps): JSX.Element;
