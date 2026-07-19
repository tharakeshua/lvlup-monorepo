/**
 * LLM utilities for AutoGrade.
 *
 * Wraps the shared LLMWrapper from @levelup/shared-services.
 * Type declarations are local until shared-services ships compiled .d.ts files.
 *
 * TODO: Replace local type declarations with imports from @levelup/shared-services
 * once the package builds and publishes declaration files.
 */
export interface LLMWrapperConfig {
  provider: "gemini";
  apiKey: string;
  defaultModel?: string;
  enableLogging?: boolean;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}
export interface LLMCallMetadata {
  clientId: string;
  userId: string;
  userRole: string;
  purpose: string;
  operation: string;
  resourceType: string;
  resourceId: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
export interface LLMCallOptions {
  images?: Array<{
    base64: string;
    mimeType: string;
  }>;
  systemPrompt?: string;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
}
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}
export interface CostBreakdown {
  input: number;
  output: number;
  total: number;
  currency: string;
}
export interface LLMCallResult<T = unknown> {
  text: string;
  parsed: T | null;
  tokens: TokenUsage;
  cost: CostBreakdown;
  latencyMs: number;
  model: string;
  logId?: string;
}
interface LLMWrapperInstance {
  call<T = unknown>(
    prompt: string,
    metadata: LLMCallMetadata,
    options?: LLMCallOptions
  ): Promise<LLMCallResult<T>>;
}
/**
 * LLMWrapper class — proxy to shared-services implementation.
 */
export declare class LLMWrapper implements LLMWrapperInstance {
  private instance;
  constructor(config: LLMWrapperConfig);
  call<T = unknown>(
    prompt: string,
    metadata: LLMCallMetadata,
    options?: LLMCallOptions
  ): Promise<LLMCallResult<T>>;
}
/**
 * Retrieve a tenant's Gemini API key from Secret Manager.
 */
export declare function getGeminiApiKey(tenantId: string): Promise<string>;
export {};
