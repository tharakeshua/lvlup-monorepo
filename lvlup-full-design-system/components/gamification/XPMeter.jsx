import React from "react";
import { cx } from "../_shared/Icon";

export function XPMeter({ level = 1, xp = 0, next = 100, className, ...rest }) {
  const pct = Math.min(100, (xp / next) * 100);
  return (
    <div className={cx("xpmeter", className)} {...rest}>
      <div className="xpmeter__head">
        <span className="xpmeter__level">{"Level " + level}</span>
        <span className="xpmeter__count">{xp + " / " + next + " XP"}</span>
      </div>
      <div className="xpmeter__bar">
        <div className="xpmeter__fill" style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}
