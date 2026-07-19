import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function StoryPointNode({ state = "not-started", index, label }) {
  const icon = state === "mastered" ? "check" : state === "locked" ? "lock" : null;
  return (
    <div className="track__node">
      <div
        className={cx(
          "node",
          state === "in-progress" && "node--in-progress",
          state === "mastered" && "node--mastered",
          state === "locked" && "node--locked"
        )}
      >
        {icon ? <Icon name={icon} size={18} /> : index != null ? index : ""}
      </div>
      {label && <div className="node__label">{label}</div>}
    </div>
  );
}
