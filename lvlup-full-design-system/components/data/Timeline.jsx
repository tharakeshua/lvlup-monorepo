import React from "react";
import { cx } from "../_shared/Icon";

export function Timeline({ items = [], className }) {
  return (
    <div className={cx("timeline", className)}>
      {items.map((it, i) => (
        <div key={i} className="timeline__item">
          <span className={cx("timeline__dot", it.variant && "timeline__dot--" + it.variant)} />
          <div className="timeline__time">{it.time}</div>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-primary)",
              marginTop: 2,
            }}
          >
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}
