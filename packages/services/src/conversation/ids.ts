/**
 * Deterministic identities and canonical keys for the conversation runtime.
 *
 * The ids are deliberately derived from durable client ids rather than a
 * callable envelope. That makes a retry after a mobile restart resolve to the
 * same session/turn/message document and lets the repository fence collisions.
 */
import { createHash, randomUUID } from "node:crypto";
import type {
  ConversationContext,
  ConversationEvidenceId,
  ConversationLease,
  ConversationMessageId,
  ConversationSessionId,
  ConversationTurnId,
  ItemSubmissionId,
  StartConversationContext,
} from "@levelup/domain";

type JsonPrimitive = null | boolean | number | string;
type JsonLike = JsonPrimitive | readonly JsonLike[] | { readonly [key: string]: JsonLike };

/** Stable JSON encoding for hashes persisted across process restarts. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("canonical JSON does not support non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new TypeError("canonical JSON supports only JSON values");
}

export function sha256Base64Url(...parts: readonly string[]): string {
  return createHash("sha256")
    .update(canonicalJson(parts as unknown as JsonLike))
    .digest("base64url");
}

export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("base64url");
}

export function conversationSessionId(
  tenantId: string,
  ownerUid: string,
  clientRequestId: string
): ConversationSessionId {
  return `c_${sha256Base64Url(tenantId, ownerUid, clientRequestId).slice(0, 26)}` as ConversationSessionId;
}

export function conversationTurnId(sessionId: string, clientMessageId: string): ConversationTurnId {
  return `ct_${sha256Base64Url(sessionId, clientMessageId).slice(0, 26)}` as ConversationTurnId;
}

export function learnerMessageId(
  sessionId: string,
  clientMessageId: string
): ConversationMessageId {
  return `cm_u_${sha256Base64Url(sessionId, clientMessageId).slice(0, 24)}` as ConversationMessageId;
}

export function assistantMessageId(turnId: string, ordinal: number): ConversationMessageId {
  return `cm_a_${turnId}_${ordinal}` as ConversationMessageId;
}

export function openingMessageId(sessionId: string): ConversationMessageId {
  return `cm_open_${sessionId}` as ConversationMessageId;
}

export function conversationEvidenceId(
  turnId: string,
  toolCallOrdinal: number
): ConversationEvidenceId {
  return `ce_${turnId}_${toolCallOrdinal}` as ConversationEvidenceId;
}

export function itemSubmissionId(sessionId: string): ItemSubmissionId {
  return `cis_${sha256Base64Url(sessionId).slice(0, 26)}` as ItemSubmissionId;
}

export function toolInvocationId(turnId: string, step: number, ordinal: number): string {
  return `${turnId}:${step}:${ordinal}`;
}

/** The one-resumable-session key; it is intentionally server-derived only. */
export function contextBaseKey(context: StartConversationContext | ConversationContext): string {
  switch (context.kind) {
    case "tutor":
      switch (context.scope) {
        case "space":
          return `tutor:space:${context.spaceId}`;
        case "story_point":
          return `tutor:story_point:${context.spaceId}:${context.storyPointId}`;
        case "item":
          return `tutor:item:${context.spaceId}:${context.storyPointId}:${context.itemId}`;
      }
      break;
    case "question_help":
      return `question_help:${context.spaceId}:${context.storyPointId}:${context.itemId}:${context.attemptId ?? "none"}`;
    case "agent_assessment":
      return `agent_assessment:${context.spaceId}:${context.storyPointId}:${context.itemId}`;
  }
  return assertNever(context);
}

export function contextKey(context: ConversationContext): string {
  const base = contextBaseKey(context);
  return context.kind === "agent_assessment" ? `${base}:attempt:${context.attemptNumber}` : base;
}

export function makeLease(ownerRequestId: string, now: string, leaseMs: number): ConversationLease {
  const acquiredAtMs = Date.parse(now);
  if (!Number.isFinite(acquiredAtMs)) throw new TypeError("lease requires an ISO timestamp");
  return {
    token: randomUUID(),
    ownerRequestId,
    acquiredAt: now as ConversationLease["acquiredAt"],
    expiresAt: new Date(acquiredAtMs + leaseMs).toISOString() as ConversationLease["expiresAt"],
  };
}

export function isLeaseExpired(
  lease: Pick<ConversationLease, "expiresAt"> | undefined,
  now: string
): boolean {
  return !lease || Date.parse(lease.expiresAt) <= Date.parse(now);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled conversation context: ${JSON.stringify(value)}`);
}
