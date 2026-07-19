import React from "react";
import { cx } from "../_shared/Icon";
import { Avatar } from "../data/Avatar";

export function SubmissionCard({ initials, name, meta, children, className }) {
  return (
    <div className={cx("submission", className)}>
      <Avatar initials={initials} size="sm" />
      <div className="submission__meta">
        <div className="submission__name">{name}</div>
        <div className="submission__sub">{meta}</div>
      </div>
      {children}
    </div>
  );
}
