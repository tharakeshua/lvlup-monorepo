import React from "react";
import { cx } from "../_shared/Icon";

export function Switch({ className, children, ...rest }) {
  return (
    <label className={cx("switch", className)}>
      <input type="checkbox" {...rest} />
      <span className="switch__track" />
    </label>
  );
}
