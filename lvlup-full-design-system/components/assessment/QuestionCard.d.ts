import React from "react";

export interface QuestionCardProps {
  type?: React.ReactNode;
  points?: number;
  prompt?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Assessment" subtitle="MCQ with option states" viewport="740x480" */
export function QuestionCard(props: QuestionCardProps): JSX.Element;
