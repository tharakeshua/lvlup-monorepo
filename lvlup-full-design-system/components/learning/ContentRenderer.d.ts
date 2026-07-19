import * as React from "react";

export interface ContentRendererProps {
  html?: string;
  math?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Learning" subtitle="Markdown + math + code" viewport="780x480" */
export function ContentRenderer(props: ContentRendererProps): JSX.Element;
