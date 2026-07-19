import React from "react";
import { cx } from "../_shared/Icon";

export function Kbd({ children, className }) {
  return <kbd className={cx("kbd", className)}>{children}</kbd>;
}
