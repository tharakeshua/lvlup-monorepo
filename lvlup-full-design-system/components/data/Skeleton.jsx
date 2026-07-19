import React from "react";
import { cx } from "../_shared/Icon";

export function Skeleton({ width, height, variant, style, className }) {
  const merged = Object.assign({ width: width || "100%", height: height || "0.75rem" }, style);
  return (
    <div className={cx("skeleton", variant && "skeleton--" + variant, className)} style={merged} />
  );
}
