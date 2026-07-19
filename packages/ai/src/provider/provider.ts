import type { JsonValue } from "@levelup/domain";

/**
 * LLMProvider — the provider seam (server-shared.md §4.3). Gemini is the one
 * concrete impl today, but the gateway depends only on this interface so a second
 * provider (e.g. Claude/Anthropic) can be slotted in without touching the gateway,
 * cost, quota, or prompt layers. The gateway is the only consumer of providers.
 */

export interface ProviderImage {
  /** Base64-encoded image bytes (no data: prefix). */
  base64: string;
  /** e.g. 'image/png', 'image/jpeg'. */
  mimeType: string;
}

/** A tool the model may call (AI-EVALUATION-CORE-PLAN.md Phase 4 — chat agents). */
export interface ProviderToolDecl {
  name: string;
  description: string;
  /** JSON Schema (Gemini OpenAPI subset) for the tool's arguments. */
  parameters?: unknown;
}

/** One tool invocation the model requested in its response.
 *
 * `callId` is gateway-owned correlation data. Gemini's legacy function-calling
 * wire format does not expose an invocation id, so its adapter creates one when
 * decoding a response and keeps it in the role-preserving history thereafter.
 */
export interface ProviderToolCall {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

/** A provider-neutral text part. Provenance is intentionally gateway-only. */
export interface ProviderTextPart {
  type: "text";
  text: string;
}

/** A provider-neutral inline image part. */
export interface ProviderImagePart {
  type: "image";
  image: ProviderImage;
}

/** An assistant function call preserved in the same model history. */
export interface ProviderToolCallPart extends ProviderToolCall {
  type: "tool_call";
}

/** A trusted tool result preserved in the same model history. */
export interface ProviderToolResultPart {
  type: "tool_result";
  callId: string;
  name: string;
  result: JsonValue;
}

/**
 * Role-preserving provider history. This is deliberately richer than Gemini's
 * legacy `user`/`model`/`function` wire roles so the gateway can keep durable
 * conversation history intact across provider implementations.
 */
export type ProviderMessage =
  | { role: "developer"; parts: ProviderTextPart[] }
  | { role: "user"; parts: Array<ProviderTextPart | ProviderImagePart> }
  | { role: "assistant"; parts: Array<ProviderTextPart | ProviderToolCallPart> }
  | { role: "tool"; parts: ProviderToolResultPart[] };

export interface ProviderInput {
  model: string;
  /** Platform prompt-registry policy only; agent configuration rides `messages`. */
  system: string;
  /** Complete, role-preserving conversation or one legacy-adapted user message. */
  messages: ProviderMessage[];
  /**
   * Legacy image attachment channel. New typed histories carry images in user
   * message parts; this field remains for existing vision callers during the
   * migration.
   */
  images?: ProviderImage[];
  temperature?: number;
  maxTokens?: number;
  /** JSON Schema for structured output; when set the provider must return JSON. */
  responseSchema?: unknown;
  /** Tool declarations (mutually exclusive with `responseSchema` on Gemini). */
  tools?: ProviderToolDecl[];
  /** Whether the model may invoke declared tools. */
  toolChoice?: "auto" | "none";
}

export interface ProviderTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Whether the provider returned usage or the adapter had to infer it. */
  source?: "provider" | "estimated" | "unavailable";
  cachedInputTokens?: number;
  reasoningTokens?: number;
  toolTokens?: number;
  imageTokens?: number;
}

export interface ProviderOutput {
  /** Raw text completion. */
  text: string;
  /** Parsed JSON when `responseSchema` was requested (else undefined). */
  json?: unknown;
  /** Tool invocations the model requested (only when `tools` were declared). */
  toolCalls?: ProviderToolCall[];
  usage: ProviderTokenUsage;
  model: string;
}

export interface LLMProvider {
  readonly name: "gemini" | "claude";
  call(input: ProviderInput): Promise<ProviderOutput>;
}
