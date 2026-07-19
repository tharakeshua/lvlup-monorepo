import React from "react";
import { cx } from "../_shared/Icon";

export function Panel({ title, actions, className, children }) {
  return (
    <div className={cx("panel", className)}>
      {(title || actions) && (
        <div className="panel__head">
          <div className="panel__title">{title}</div>
          {actions}
        </div>
      )}
      <div className="panel__body">{children}</div>
    </div>
  );
}
