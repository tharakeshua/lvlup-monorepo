import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function AnswerKeyLock({ title = "Answer key hidden", children, className }) {
  return (
    <div className={cx("keylock", className)}>
      <span className="keylock__icon">
        <Icon name="lock" size={18} />
      </span>
      <div className="keylock__text">
        <strong>{title}</strong> {children || "Server-only — never sent to the client."}
      </div>
    </div>
  );
}
