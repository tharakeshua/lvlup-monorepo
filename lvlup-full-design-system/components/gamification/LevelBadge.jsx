import React from "react";
import { cx } from "../_shared/Icon";

export function LevelBadge({ level = 1, spark, className, ...rest }) {
  return (
    <span className={cx("level-badge", spark && "level-badge--spark", className)} {...rest}>
      <span className="level-badge__num">{level}</span>
      <span className="level-badge__cap">lvl</span>
    </span>
  );
}
