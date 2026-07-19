/**
 * LLM Logger — Logs every LLM call to Firestore for audit, cost tracking, and analytics.
 *
 * Collection: /tenants/{tenantId}/llmCallLogs/{callId}
 *
 * Schema matches docs/unified-design-plan/02-autograde-design.md §8.4.
 */

import * as admin from "firebase-admin";
import type { firestore as adminFirestore } from "firebase-admin";
import type { TokenUsage, CostBreakdown } from "./cost-tracker";
import { incrementDailyCostSummary } from "./usage-quota";

export interface LLMCallLogEntry {
  callId: string;
  tenantId: string;
  userId: string;
  userRole: string;
  purpose: string;
  operation: string;
  resourceType: string;
  resourceId: string;
  model: string;
  tokens: TokenUsage;
  cost: CostBreakdown;
  timing: { latencyMs: number };
  success: boolean;
  error?: string;
  createdAt: admin.firestore.Timestamp;
}

export interface LogLLMCallParams {
  tenantId: string;
  userId: string;
  userRole: string;
  purpose: string;
  operation: string;
  resourceType: string;
  resourceId: string;
  model: string;
  tokens: TokenUsage;
  cost: CostBreakdown;
  latencyMs: number;
  success: boolean;
  error?: string;
}

let firestoreOverride: adminFirestore.Firestore | null = null;

/**
 * Log an LLM call to Firestore.
 *
 * Writes to /tenants/{tenantId}/llmCallLogs/{callId}
 */
export async function logLLMCall(params: LogLLMCallParams): Promise<string> {
  const db = firestoreOverride ?? admin.firestore();
  const colRef = db.collection(`tenants/${params.tenantId}/llmCallLogs`);
  const docRef = colRef.doc();
  const callId = docRef.id;

  const entry: LLMCallLogEntry = {
    callId,
    tenantId: params.tenantId,
    userId: params.userId,
    userRole: params.userRole,
    purpose: params.purpose,
    operation: params.operation,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    model: params.model,
    tokens: params.tokens,
    cost: params.cost,
    timing: { latencyMs: params.latencyMs },
    success: params.success,
    createdAt: admin.firestore.Timestamp.now(),
  };

  if (params.error) {
    entry.error = params.error;
  }

  await docRef.set(entry);

  // Increment daily cost summary with model breakdown (fire-and-forget)
  if (params.success && params.cost.total > 0) {
    incrementDailyCostSummary(
      params.tenantId,
      params.cost.total,
      params.tokens.input,
      params.tokens.output,
      params.purpose,
      params.model
    ).catch((err) => {
      console.error("[LLMLogger] Failed to increment daily cost summary:", err);
    });
  }

  return callId;
}

/**
 * Override the Firestore instance (useful for testing or when using firebase-admin).
 */
export function _setFirestoreForTesting(db: adminFirestore.Firestore): void {
  firestoreOverride = db;
}
