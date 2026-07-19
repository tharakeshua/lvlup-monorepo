import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function AtRiskBadge({ level, className, children }) {
  return (
    <span className={cx("at-risk", level === "watch" && "at-risk--watch", className)}>
      <Icon name="alert-triangle" size={13} />
      {children || (level === "watch" ? "Watch" : "At risk")}
    </span>
  );
}
