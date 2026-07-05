/**
 * The AI gateway seam shape services see (server-shared.md §4). Declared
 * structurally so `@levelup/services` does not depend on `@levelup/ai`'s concrete
 * gateway at the type level — both the real `createAiGateway()` and the test
 * `FakeAiGateway` satisfy this. Services call `ctx.ai.generate(...)`; they never
 * construct a provider, read a Secret Manager key, or compute cost (all
 * server-authoritative, REVIEW §6 AI row).
 */

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
  /**
   * Images for vision calls (scouting / grading / extraction). Services pass
   * STORAGE PATHS (`{ storagePath }`) — the gateway resolves paths → inline
   * bytes via its injected image store (bytes never transit the service layer).
   * Pre-encoded `{ base64 }` refs are passed through untouched.
   */
  images?: ({ base64: string; mimeType: string } | { storagePath: string; mimeType?: string })[];
  /** Optional JSON-schema for structured-output parsing. */
  responseSchema?: unknown;
  model?: string;
  temperature?: number;
  maxTokens?: number;
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
  [k: string]: unknown;
}

export interface AiGenerateResult {
  text: string;
  /** Parsed structured output when `responseSchema` was supplied. */
  json?: unknown;
  tokensUsed: number;
  costUsd: number;
  model: string;
}

/**
 * The injected gateway. `generate()` resolves the per-tenant key, checks quota,
 * runs the provider, ALWAYS logs a cost record, and applies the circuit breaker.
 */
export interface AiGateway {
  generate(input: AiGenerateInput, ctx?: AiCallContext): Promise<AiGenerateResult>;
}
