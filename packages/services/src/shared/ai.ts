import type { JsonValue } from "@levelup/domain";

/**
 * The AI gateway seam shape services see (server-shared.md §4). Declared
 * structurally so `@levelup/services` does not depend on `@levelup/ai`'s concrete
 * gateway at the type level — both the real `createAiGateway()` and the test
 * `FakeAiGateway` satisfy this. Services call `ctx.ai.generate(...)`; they never
 * construct a provider, read a Secret Manager key, or compute cost (all
 * server-authoritative, REVIEW §6 AI row).
 */

export type AiDeveloperMessage = {
  role: "developer";
  parts: Array<{ type: "text"; text: string; provenance: "agent_config" }>;
};

export type AiUserMessage = {
  role: "user";
  parts: Array<
    | { type: "text"; text: string; provenance: "learner" | "trusted_context" }
    | {
        type: "image";
        image: { base64: string; mimeType: string } | { storagePath: string; mimeType?: string };
      }
  >;
};

export type AiAssistantMessage = {
  role: "assistant";
  parts: Array<
    | { type: "text"; text: string; provenance: "model_output" }
    | { type: "tool_call"; callId: string; name: string; args: Record<string, unknown> }
  >;
};

export type AiToolMessage = {
  role: "tool";
  parts: Array<{
    type: "tool_result";
    callId: string;
    name: string;
    result: JsonValue;
  }>;
};

/** Structural mirror of `@levelup/ai`'s role-preserving typed history. */
export type AiMessage = AiDeveloperMessage | AiUserMessage | AiAssistantMessage | AiToolMessage;

export interface AiGenerateInput {
  /** Prompt registry key (extraction / panopticon / relms / evaluator / tutor / insights). */
  promptKey?: string;
  /** Logical operation name (used for cost-logging + circuit-breaker keys). */
  operation?: string;
  /** Raw prompt fallback. */
  prompt?: string;
  /** Structured variables interpolated into the prompt (concrete gateway reads `variables`). */
  variables?: unknown;
  /** Legacy alias for `variables`. */
  input?: unknown;
  /** Stable centrally-resolved policy for conversation/evaluation calls. */
  modelPolicyId?: "conversation.fast" | "conversation.quality" | "evaluation.quality";
  /** Complete typed history; legacy calls without it adapt to one user message. */
  messages?: AiMessage[];
  /**
   * Images for vision calls (scouting / grading / extraction). Services pass
   * STORAGE PATHS (`{ storagePath }`) — the gateway resolves paths → inline
   * bytes via its injected image store (bytes never transit the service layer).
   * Pre-encoded `{ base64 }` refs are passed through untouched.
   */
  images?: ({ base64: string; mimeType: string } | { storagePath: string; mimeType?: string })[];
  /** Optional JSON-schema for structured-output parsing. */
  responseSchema?: unknown;
  /**
   * Tool declarations (chat agents). Mutually exclusive with `responseSchema`;
   * requested invocations come back on `AiGenerateResult.toolCalls`.
   */
  tools?: { name: string; description: string; parameters?: unknown }[];
  /** Whether declared tools may be called by the model. */
  toolChoice?: "auto" | "none";
  model?: string;
  temperature?: number;
  maxTokens?: number;
  feature?: string;
  promptVersion?: string;
  purpose?: string;
  moderate?: boolean;
  [k: string]: unknown;
}

/**
 * Per-call context the gateway needs (server clock + tenant/uid for quota + cost
 * logging). The concrete `@levelup/ai` gateway is `generate(req, ctx)`; services
 * pass this from their `AuthContext` (`{ tenantId, uid, now }`).
 */
export interface AiCallContext {
  tenantId: string;
  uid?: string;
  now?: () => string;
  examId?: string;
  spaceId?: string;
  role?: string;
  resourceType?: string;
  resourceId?: string;
  submissionId?: string;
  questionId?: string;
  storyPointId?: string;
  itemId?: string;
  chatSessionId?: string;
  testSessionId?: string;
  attemptId?: string;
  usage?: {
    actorUserId?: string;
    actorRole?: string;
    initiatedByUserId?: string;
    subjectUserId?: string;
    billingUserId?: string;
    initiatorRole?: string;
    rootRequestId?: string;
    parentRequestId?: string;
    traceId?: string;
    agentId?: string;
    related?: Record<string, string | undefined>;
  };
  credentialOwner?: "platform" | "tenant" | "user";
  [k: string]: unknown;
}

export interface AiTokenUsageMetadata {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  toolTokens?: number;
  imageTokens?: number;
  source?: "provider" | "estimated" | "unavailable";
}

export interface AiCostMetadata {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  currency: string;
  pricingVersion?: string;
  pricingFallback?: boolean;
}

export interface AiGenerateResult {
  text: string;
  /** Parsed structured output when `responseSchema` was supplied. */
  json?: unknown;
  /** Tool invocations the model requested (only when `tools` were declared). */
  toolCalls?: { callId: string; name: string; args: Record<string, unknown> }[];
  tokensUsed: number;
  costUsd: number;
  model: string;
  /** Concrete gateway request correlation; absent only for legacy test doubles. */
  requestId?: string;
  /** Full token metadata preserves cached-input attribution for turn aggregates. */
  tokenUsage?: AiTokenUsageMetadata;
  /** Full server-computed cost metadata; callers must not expose it to clients. */
  cost?: AiCostMetadata;
  moderation?: { input: string[]; output: string[] };
}

/**
 * The injected gateway. `generate()` resolves the per-tenant key, checks quota,
 * runs the provider, ALWAYS logs a cost record, and applies the circuit breaker.
 */
export interface AiGateway {
  generate(input: AiGenerateInput, ctx?: AiCallContext): Promise<AiGenerateResult>;
}
