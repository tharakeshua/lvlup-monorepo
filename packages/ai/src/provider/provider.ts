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

export interface ProviderInput {
  model: string;
  system: string;
  user: string;
  images?: ProviderImage[];
  temperature?: number;
  maxTokens?: number;
  /** JSON Schema for structured output; when set the provider must return JSON. */
  responseSchema?: unknown;
}

export interface ProviderTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ProviderOutput {
  /** Raw text completion. */
  text: string;
  /** Parsed JSON when `responseSchema` was requested (else undefined). */
  json?: unknown;
  usage: ProviderTokenUsage;
  model: string;
}

export interface LLMProvider {
  readonly name: "gemini" | "claude";
  call(input: ProviderInput): Promise<ProviderOutput>;
}
