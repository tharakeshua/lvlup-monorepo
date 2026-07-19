import React from "react";
import { cx } from "../_shared/Icon";

export function ContentRenderer({ html, math, className, children }) {
  return (
    <div
      className={cx("content", math && "content--math", className)}
      dangerouslySetInnerHTML={html ? { __html: html } : undefined}
    >
      {html ? undefined : children}
    </div>
  );
}
