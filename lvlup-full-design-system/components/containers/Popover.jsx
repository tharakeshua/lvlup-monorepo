import React from "react";
import { cx } from "../_shared/Icon";

export function Popover({ className, children }) {
  return <div className={cx("popover", className)}>{children}</div>;
}
