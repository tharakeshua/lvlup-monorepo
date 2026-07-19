import React from "react";

export interface FileDropProps {
  active?: boolean;
  icon?: string;
  title?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}

/** @startingPoint section="Forms" subtitle="Idle · active drag" viewport="700x280" */
export function FileDrop(props: FileDropProps): JSX.Element;
