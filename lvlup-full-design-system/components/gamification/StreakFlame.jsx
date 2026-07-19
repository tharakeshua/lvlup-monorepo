import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function StreakFlame({ days = 0, className, ...rest }) {
  return (
    <span className={cx("streak", className)} {...rest}>
      <span className="streak__flame">
        <Icon name="flame" size={18} />
      </span>
      <span className="streak__count">{days + "d"}</span>
    </span>
  );
}
