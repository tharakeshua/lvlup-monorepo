import React from "react";
import { cx } from "../_shared/Icon";

export function Slider({ className, ...rest }) {
  return <input type="range" className={cx("slider", className)} {...rest} />;
}
