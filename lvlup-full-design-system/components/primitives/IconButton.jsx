import React from "react";
import { cx } from "../_shared/Icon";

export function IconButton({ size, solid, icon, label, className, children, ...rest }) {
  return (
    <button
      className={cx("icon-btn", size && "icon-btn--" + size, solid && "icon-btn--solid", className)}
      aria-label={label}
      {...rest}
    >
      {icon || children}
    </button>
  );
}
