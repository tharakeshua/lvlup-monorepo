import React from "react";
import { cx } from "../_shared/Icon";

export function Badge({ variant, dot, icon, children, className }) {
  return (
    <span className={cx("badge", variant && "badge--" + variant, dot && "badge--dot", className)}>
      {icon}
      {children}
    </span>
  );
}
