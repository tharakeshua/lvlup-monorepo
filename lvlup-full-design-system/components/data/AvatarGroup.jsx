import React from "react";
import { cx } from "../_shared/Icon";

export function AvatarGroup({ children, className }) {
  return <span className={cx("avatar-group", className)}>{children}</span>;
}
