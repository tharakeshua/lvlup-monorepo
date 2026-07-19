import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function Achievement({ icon = "award", name, locked, className, ...rest }) {
  return (
    <div className={cx("achievement", locked && "achievement--locked", className)} {...rest}>
      <span className="achievement__medal">
        <Icon name={icon} size={28} />
      </span>
      <span className="achievement__name">{name}</span>
    </div>
  );
}
