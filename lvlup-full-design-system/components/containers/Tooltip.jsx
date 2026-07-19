import React from "react";
import { cx } from "../_shared/Icon";

export function Tooltip({ className, children }) {
  return <span className={cx("tooltip", className)}>{children}</span>;
}
