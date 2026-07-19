import React from "react";
import { cx } from "../_shared/Icon";

export function Checkbox({ className, ...rest }) {
  return <input type="checkbox" className={cx("checkbox", className)} {...rest} />;
}
