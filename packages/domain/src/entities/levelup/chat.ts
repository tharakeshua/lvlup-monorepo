/**
 * ChatSession + ChatMessage. `ChatMessage.timestamp` unified to ISO (REVIEW D4/D12).
 * `messageCount` ⚷ counter; `systemPrompt` ⚷.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zChatSessionId,
  zChatMessageId,
  zTenantId,
  zUserId,
  zSpaceId,
  zStoryPointId,
  zItemId,
  zAgentId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zChatMessageRole, zQuestionType } from "../../enums/content.js";

export const ChatMessageSchema = zObject({
  id: zChatMessageId,
  role: zChatMessageRole,
  text: z.string(),
  timestamp: zTimestamp,
  mediaUrls: z.array(z.string()).optional(),
  tokensUsed: z.number().int().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSessionSchema = zObject({
  id: zChatSessionId,
  tenantId: zTenantId,
  userId: zUserId,
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  itemId: zItemId,
  questionType: zQuestionType.optional(),
  agentId: zAgentId.optional(),
  agentName: z.string().optional(),
  sessionTitle: z.string(),
  previewMessage: z.string(),
  messageCount: z.number().int().default(0),
  language: z.string(),
  isActive: z.boolean(),
  messages: z.array(ChatMessageSchema).default([]),
  systemPrompt: z.string().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;
