import * as React from "react";

export type StoryPointState = "not-started" | "in-progress" | "mastered" | "locked";

export interface StoryPointNodeProps {
  state?: StoryPointState;
  index?: number;
  label?: React.ReactNode;
  className?: string;
}

export function StoryPointNode(props: StoryPointNodeProps): JSX.Element;
