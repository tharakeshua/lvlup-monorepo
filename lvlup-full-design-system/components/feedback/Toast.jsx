import React from "react";
import { Icon, cx } from "../_shared/Icon";

const ICONS = {
  success: "check-circle",
  error: "x-circle",
  warning: "alert-triangle",
  info: "info",
};

export function Toast({ variant = "info", title, body, className }) {
  const name = ICONS[variant] || "info";
  return (
    <div className={cx("toast", "toast--" + variant, className)}>
      <span className="toast__icon">
        <Icon name={name} size={18} />
      </span>
      <div>
        <div className="toast__title">{title}</div>
        {body && <div className="toast__body">{body}</div>}
      </div>
    </div>
  );
}
