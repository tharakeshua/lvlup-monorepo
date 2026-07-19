import React from "react";
import { cx } from "../_shared/Icon";

export function Radio({ className, ...rest }) {
  return <input type="radio" className={cx("radio", className)} {...rest} />;
}
