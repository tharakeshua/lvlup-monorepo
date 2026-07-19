import React from "react";
import { cx } from "../_shared/Icon";

export function LoadingOverlay({ className }) {
  return (
    <div className={cx("overlay", className)}>
      <div className="spinner" />
    </div>
  );
}
