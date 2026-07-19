import * as React from "react";

export interface TutorChatBubbleProps {
  from?: "tutor" | "student" | string;
  author?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Learning" subtitle="Tutor + student turns" viewport="700x360" */
export function TutorChatBubble(props: TutorChatBubbleProps): JSX.Element;
