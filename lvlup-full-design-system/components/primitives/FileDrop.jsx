import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function FileDrop({ active, icon = "upload-cloud", title, hint, className }) {
  return (
    <div className={cx("filedrop", active && "filedrop--active", className)}>
      <Icon name={icon} size={28} />
      <div
        style={{
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          color: "var(--text-primary)",
        }}
      >
        {title || "Drop files or click to upload"}
      </div>
      {hint && <div className="u-caption">{hint}</div>}
    </div>
  );
}
