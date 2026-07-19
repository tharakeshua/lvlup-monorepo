/**
 * Query/RTDB bridge for a mounted conversation.
 *
 * `useConversationBump` carries no transcript/status payload. It only
 * invalidates the detail query; `useConversation` then fetches the authoritative
 * callable projection, which is applied to the local controller state here.
 */
import { useEffect } from "react";
import { useConversation, useConversationBump } from "@levelup/query";

import type { ConversationController, ConversationPage } from "./types";

export interface ConversationProjectionSyncProps {
  controller: ConversationController;
}

function ActiveConversationProjectionSync({
  controller,
  sessionId,
}: ConversationProjectionSyncProps & { sessionId: string }) {
  const detail = useConversation(sessionId, { throwOnError: false });
  // Signal-only listener: its trailing 250ms invalidation refreshes `detail`.
  useConversationBump(sessionId);
  const applyServerPage = controller.applyServerPage;
  const reportReadFailure = controller.reportReadFailure;

  useEffect(() => {
    if (!detail.data) return;
    applyServerPage(detail.data as unknown as ConversationPage);
  }, [applyServerPage, detail.data]);

  useEffect(() => {
    if (!detail.error) return;
    reportReadFailure(detail.error);
  }, [detail.error, reportReadFailure]);

  return null;
}

/** Mount only for resumable state; terminal views have no reason to subscribe. */
export function ConversationProjectionSync({ controller }: ConversationProjectionSyncProps) {
  const session = controller.session;
  if (!session || session.status === "completed" || session.status === "abandoned") return null;
  return (
    <ActiveConversationProjectionSync
      key={session.id}
      controller={controller}
      sessionId={session.id}
    />
  );
}
