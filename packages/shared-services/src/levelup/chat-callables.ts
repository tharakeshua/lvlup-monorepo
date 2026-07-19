/**
 * LevelUp chat callable wrappers.
 * Covers: sendChatMessage
 */

import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "../firebase";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export interface SendChatMessageRequest {
  tenantId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  message: string;
  sessionId?: string;
  language?: string;
  agentId?: string;
}

export interface SendChatMessageResponse {
  sessionId: string;
  reply: string;
}

// ---------------------------------------------------------------------------
// Callable wrappers
// ---------------------------------------------------------------------------

function getCallable<Req, Res>(name: string) {
  const { functions } = getFirebaseServices();
  return httpsCallable<Req, Res>(functions, name);
}

export async function callSendChatMessage(
  data: SendChatMessageRequest
): Promise<SendChatMessageResponse> {
  const fn = getCallable<SendChatMessageRequest, SendChatMessageResponse>("sendChatMessage");
  const result = await fn(data);
  return result.data;
}
