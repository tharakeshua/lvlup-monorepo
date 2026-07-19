import * as React from "react";

export interface ModalProps {
  /** Whether the dialog is shown; renders `null` when false. */
  open?: boolean;
  /** Called when the scrim is clicked (clicks inside the dialog are stopped). */
  onClose?: () => void;
  /** Dialog title. */
  title?: React.ReactNode;
  /** Footer content (e.g. action buttons). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/** @startingPoint section="Containers" subtitle="Centered dialog (open state)" viewport="860x560" */
export function Modal(props: ModalProps): JSX.Element;
