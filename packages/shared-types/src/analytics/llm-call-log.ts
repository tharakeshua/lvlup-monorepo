/**
 * LLM Call Log — Audit record for every LLM invocation.
 * Collection: /tenants/{tenantId}/llmCallLogs/{logId}
 */

import type { FirestoreTimestamp } from "../identity/user";

export interface LLMCallLog {
  id: string;
  tenantId: string;
  functionName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUSD: number;
  latencyMs: number;
  status: "success" | "error";
  errorMessage?: string;
  userId?: string;
  examId?: string;
  spaceId?: string;
  createdAt: FirestoreTimestamp;
}
