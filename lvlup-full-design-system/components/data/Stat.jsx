import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function Stat({ label, value, delta, trend = "up", className }) {
  return (
    <div className={cx("stat", className)}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {delta && (
        <div className={cx("stat__delta", "stat__delta--" + (trend || "up"))}>
          <Icon name={trend === "down" ? "trending-down" : "trending-up"} size={12} />
          {delta}
        </div>
      )}
    </div>
  );
}
