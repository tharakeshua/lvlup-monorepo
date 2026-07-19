import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function ManualOverrideControl({ label = "Manual override", children, className }) {
  return (
    <div className={cx("override", className)}>
      <Icon name="edit-3" size={16} />
      <span className="override__label">{label}</span>
      {children}
    </div>
  );
}
