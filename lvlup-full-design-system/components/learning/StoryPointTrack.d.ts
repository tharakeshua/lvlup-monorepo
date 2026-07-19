import * as React from "react";
import { StoryPointState } from "./StoryPointNode";

export interface StoryPointTrackNode {
  state?: StoryPointState;
  label?: React.ReactNode;
}

export interface StoryPointTrackProps {
  nodes?: StoryPointTrackNode[];
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Learning" subtitle="Learning path · mastery states" viewport="900x240" */
export function StoryPointTrack(props: StoryPointTrackProps): JSX.Element;
