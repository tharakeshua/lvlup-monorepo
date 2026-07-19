import React from "react";
import { cx } from "../_shared/Icon";

export function QuestionCard({
  type = "Multiple choice",
  points = 1,
  prompt,
  children,
  className,
}) {
  return (
    <div className={cx("question", className)}>
      <div className="question__head">
        <span className="question__type">{type}</span>
        <span className="question__points">{points + " pts"}</span>
      </div>
      <div className="question__prompt">{prompt}</div>
      {children}
    </div>
  );
}
