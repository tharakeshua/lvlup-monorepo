import React from "react";
import { cx } from "../_shared/Icon";

export function ScanFrame({ hint, className }) {
  return (
    <div className={cx("scanframe", className)}>
      <div className="scanframe__guide">
        <span className="scanframe__corner scanframe__corner--tl" />
        <span className="scanframe__corner scanframe__corner--tr" />
        <span className="scanframe__corner scanframe__corner--bl" />
        <span className="scanframe__corner scanframe__corner--br" />
      </div>
      <div className="scanframe__hint">{hint || "Align the answer sheet within the frame"}</div>
    </div>
  );
}
