import React from "react";
import { Icon, cx } from "../_shared/Icon";

const ICONS = {
  success: "check-circle",
  error: "x-circle",
  warning: "alert-triangle",
  info: "info",
};

export function Alert({ variant = "info", title, className, children }) {
  return (
    <div className={cx("alert", "alert--" + variant, className)}>
      <span className="alert__icon">
        <Icon name={ICONS[variant]} size={18} />
      </span>
      <div>
        {title && <div className="alert__title">{title}</div>}
        <div className="alert__body">{children}</div>
      </div>
    </div>
  );
}
