import React from "react";
import { cx } from "../_shared/Icon";

export function GradePill({ grade = "A", score, className }) {
  if (score != null) {
    return (
      <span
        className={cx(
          "grade-pill",
          "grade-pill--" + (grade || "b").toLowerCase(),
          "grade-pill--score",
          className
        )}
      >
        {score}
      </span>
    );
  }
  const g = (grade || "A").toLowerCase();
  return (
    <span className={cx("grade-pill", "grade-pill--" + g, className)}>
      {(grade || "A").toUpperCase()}
    </span>
  );
}
