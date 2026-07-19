import React from "react";
import { cx } from "../_shared/Icon";

export function Textarea({ error, className, ...rest }) {
  return <textarea className={cx("textarea", error && "textarea--error", className)} {...rest} />;
}
