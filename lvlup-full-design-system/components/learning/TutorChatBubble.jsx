import React from "react";
import { cx } from "../_shared/Icon";

export function TutorChatBubble({ from = "tutor", author, className, children }) {
  return (
    <div className={cx("bubble", "bubble--" + from, className)}>
      {author && <div className="bubble__author">{author}</div>}
      {children}
    </div>
  );
}
