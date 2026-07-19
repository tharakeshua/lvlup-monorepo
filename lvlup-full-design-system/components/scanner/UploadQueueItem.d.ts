import React from "react";

export interface UploadQueueItemProps {
  status?: "queued" | "uploading" | "done" | "failed";
  name?: string;
  progress?: number;
  meta?: string;
  className?: string;
  children?: React.ReactNode;
}

/** @startingPoint section="Scanner" subtitle="Offline upload states" viewport="740x360" */
export function UploadQueueItem(props: UploadQueueItemProps): JSX.Element;
