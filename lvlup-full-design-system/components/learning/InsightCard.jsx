import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function InsightCard({ icon = "sparkles", title, className, children }) {
  return (
    <div className={cx("insight", className)}>
      <span className="insight__icon">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <div className="insight__title">{title}</div>
        <div className="insight__body">{children}</div>
      </div>
    </div>
  );
}
