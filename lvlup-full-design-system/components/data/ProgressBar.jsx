import React from "react";
import { cx } from "../_shared/Icon";

export function ProgressBar({ value = 0, variant, className }) {
  return (
    <div className={cx("progress", className)} role="progressbar" aria-valuenow={value}>
      <div
        className={cx("progress__fill", variant && "progress__fill--" + variant)}
        style={{ width: (value || 0) + "%" }}
      />
    </div>
  );
}
