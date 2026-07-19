import * as React from "react";

export interface DrawerProps {
  /** Whether the drawer is open (controls scrim + pointer events). */
  open?: boolean;
  /** Called when the scrim or close button is clicked. */
  onClose?: () => void;
  /** Slide-in side; `"left"` adds `drawer--left`, default slides from the right. */
  side?: "left" | "right";
  /** Header title. */
  title?: React.ReactNode;
  children?: React.ReactNode;
}

/** @startingPoint section="Containers" subtitle="Right slide-over (open state)" viewport="860x560" */
export function Drawer(props: DrawerProps): JSX.Element;
