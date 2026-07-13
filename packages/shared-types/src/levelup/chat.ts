/**
 * ChatSession — AI tutor conversation.
 * Collection: /tenants/{tenantId}/chatSessions/{sessionId}
 * @module levelup/chat
 */

import type { FirestoreTimestamp } from "../identity/user";

export type ChatMessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  text: string;
  timestamp: string;
  mediaUrls?: string[];
  tokensUsed?: { input: number; output: number };
}

export interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  questionType?: string;

  // Agent
  agentId?: string;
  agentName?: string;

  // Session metadata
  sessionTitle: string;
  previewMessage: string;
  messageCount: number;
  language: string;
  isActive: boolean;

  // Conversation
  messages: ChatMessage[];
  systemPrompt: string;

  // Audit
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
