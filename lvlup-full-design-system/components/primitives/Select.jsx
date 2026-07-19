import React from "react";
import { cx } from "../_shared/Icon";

export function Select({ options, className, children, ...rest }) {
  return (
    <select className={cx("select", className)} {...rest}>
      {options
        ? options.map((o, i) => (
            <option key={i} value={o.value}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
}
