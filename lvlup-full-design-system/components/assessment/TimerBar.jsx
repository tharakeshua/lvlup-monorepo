import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function TimerBar({ tone, time = "00:00", percent = 100, className }) {
  return (
    <div className={cx("timer", tone && "timer--" + tone, className)}>
      <span className="timer__clock">{time}</span>
      <div className="timer__bar">
        <div className="timer__fill" style={{ width: (percent != null ? percent : 100) + "%" }} />
      </div>
      <span className="timer__server-tag">
        <Icon name="server" size={11} />
        server time
      </span>
    </div>
  );
}
