import * as React from "react";

export interface CommandPaletteItem {
  icon?: string;
  label: React.ReactNode;
  kbd?: React.ReactNode;
}

export interface CommandPaletteProps {
  placeholder?: string;
  items?: CommandPaletteItem[];
  selected?: number;
  className?: string;
}

/** @startingPoint section="Navigation" subtitle="⌘K quick switcher" viewport="640x460" */
export function CommandPalette(props: CommandPaletteProps): JSX.Element;
