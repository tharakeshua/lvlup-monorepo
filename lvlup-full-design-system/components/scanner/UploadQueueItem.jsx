import React from "react";
import { Icon, cx } from "../_shared/Icon";
import { ProgressBar } from "../data/ProgressBar";

export function UploadQueueItem({ status = "queued", name, progress, meta, className }) {
  const icon = {
    queued: "clock",
    uploading: "loader",
    done: "check",
    failed: "alert-triangle",
  }[status];
  return (
    <div className={cx("upload-item", className)}>
      <span className={cx("upload-item__icon", "upload-item__icon--" + status)}>
        <Icon name={icon} size={18} />
      </span>
      <div className="upload-item__body">
        <div className="upload-item__name">{name}</div>
        {status === "uploading" ? (
          <ProgressBar value={progress || 40} />
        ) : (
          <div className="u-caption">{meta || status}</div>
        )}
      </div>
    </div>
  );
}
