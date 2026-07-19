import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function Chip({ active, removable, children, className }) {
  return (
    <span className={cx("chip", active && "chip--active", className)}>
      {children}
      {removable && (
        <span className="chip__remove">
          <Icon name="x" size={12} />
        </span>
      )}
    </span>
  );
}
