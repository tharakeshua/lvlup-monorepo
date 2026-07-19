import React from "react";
import { cx } from "../_shared/Icon";
import { StoryPointNode } from "./StoryPointNode";

export function StoryPointTrack({ nodes = [], className }) {
  const out = [];
  nodes.forEach((n, i) => {
    out.push(<StoryPointNode key={"n" + i} index={i + 1} {...n} />);
    if (i < nodes.length - 1) {
      out.push(
        <div
          key={"c" + i}
          className={cx("track__connector", n.state === "mastered" && "track__connector--done")}
        />
      );
    }
  });
  return <div className={cx("track", className)}>{out}</div>;
}
