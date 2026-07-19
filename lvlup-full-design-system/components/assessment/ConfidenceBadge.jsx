import React from "react";
import { cx } from "../_shared/Icon";

export function ConfidenceBadge({ level = "high", value, className }) {
  const label = { low: "Review", med: "Spot-check", high: "Auto" }[level];
  return (
    <span className={cx("confidence", "confidence--" + level, className)}>
      <span className="confidence__dot" />
      {value != null ? value : label}
    </span>
  );
}
