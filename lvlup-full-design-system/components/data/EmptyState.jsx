import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function EmptyState({ icon = "inbox", title, body, action, className }) {
  return (
    <div className={cx("empty", className)}>
      <div className="empty__art">
        <Icon name={icon || "inbox"} size={28} />
      </div>
      <div className="empty__title">{title}</div>
      {body && <div className="empty__body">{body}</div>}
      {action}
    </div>
  );
}
