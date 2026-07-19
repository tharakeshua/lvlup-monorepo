import React from "react";
import { cx } from "../_shared/Icon";

export function ProgressRing({ value = 0, size = 56, label, className }) {
  return (
    <div
      className={cx("ring", className)}
      style={{ "--ring-pct": value || 0, "--ring-size": (size || 56) + "px" }}
    >
      <span className="ring__label">{label != null ? label : (value || 0) + "%"}</span>
    </div>
  );
}
