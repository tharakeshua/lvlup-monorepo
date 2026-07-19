import React from "react";
import { cx } from "../_shared/Icon";

export function Avatar({ src, alt, initials, size, className }) {
  return (
    <span className={cx("avatar", size && "avatar--" + size, className)}>
      {src ? <img src={src} alt={alt || ""} /> : initials || "?"}
    </span>
  );
}
