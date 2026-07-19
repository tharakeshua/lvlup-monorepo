import React from "react";
import { cx } from "../_shared/Icon";

export function Input({ error, className, ...rest }) {
  return <input className={cx("input", error && "input--error", className)} {...rest} />;
}
