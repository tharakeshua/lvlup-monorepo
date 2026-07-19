import React from "react";
import { cx } from "../_shared/Icon";

export function Card({ interactive, className, children, ...rest }) {
  return (
    <div className={cx("card", interactive && "card--interactive", className)} {...rest}>
      {children}
    </div>
  );
}
