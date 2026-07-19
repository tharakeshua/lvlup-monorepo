/**
 * LLMWrapper — Shared AI infrastructure for the unified LevelUp + AutoGrade platform.
 *
 * Provides a unified interface for LLM calls with:
 *   - Real Gemini 2.5 Flash API integration via @google/generative-ai SDK
 *   - Base64 image inputs (for question paper / answer sheet processing)
 *   - System + user prompts
 *   - responseMimeType for structured JSON output
 *   - Temperature configuration
 *   - Retry with exponential backoff
 *   - Full audit metadata logging (via llm-logger)
 *   - Token counting & cost estimation (via cost-tracker)
 *
 * Reference: docs/unified-design-plan/02-autograde-design.md §8.1
 */

import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type GenerateContentRequest,
  type Content,
  type Part,
  type GenerationConfig,
} from "@google/generative-ai";

import { estimateCost, buildTokenUsage, type TokenUsage, type CostBreakdown } from "./cost-tracker";
import { logLLMCall, type LogLLMCallParams } from "./llm-logger";
import {
  classifyError,
  recordFailure,
  recordSuccess,
  isCircuitOpen,
  getCircuitOpenMessage,
  type ClassifiedError,
} from "./fallback-handler";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface LLMWrapperConfig {
  /** The AI provider to use. Currently only 'gemini' is supported. */
  provider: "gemini";
  /** API key for the provider. Retrieved from Secret Manager per-tenant. */
  apiKey: string;
  /** Default model to use when not specified per-call. */
  defaultModel?: string;
  /** Whether to log every call to Firestore. Defaults to true. */
  enableLogging?: boolean;
  /** Max retry attempts on transient failures. Defaults to 3. */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff. Defaults to 1000. */
  retryBaseDelayMs?: number;
}

export interface LLMCallMetadata {
  /** Tenant ID (maps to clientId in the design doc). */
  clientId: string;
  /** UID of the user who triggered this call. */
  userId: string;
  /** Role of the calling user (teacher, student, system). */
  userRole: string;
  /** High-level purpose (question_extraction, answer_mapping, answer_grading, ai_chat). */
  purpose: string;
  /** Specific operation name (e.g., relmsEvaluation, panopticonScouting). */
  operation: string;
  /** Type of resource being processed (exam, questionSubmission, etc.). */
  resourceType: string;
  /** ID of the resource being processed. */
  resourceId: string;
  /** Model override for this specific call. */
  model?: string;
  /** Temperature override (0-2). Lower = more deterministic. */
  temperature?: number;
  /** Max output tokens. */
  maxTokens?: number;
}

export interface LLMCallOptions {
  /** Base64-encoded images to include in the prompt. */
  images?: Array<{ base64: string; mimeType: string }>;
  /** System-level instruction prompt. */
  systemPrompt?: string;
  /** Response MIME type — use 'application/json' for structured JSON output. */
  responseMimeType?: string;
  /** JSON schema for structured output (Gemini responseSchema). */
  responseSchema?: Record<string, unknown>;
  /** Timeout in ms for the entire call (including retries). Defaults to 300000 (5 min). */
  timeoutMs?: number;
}

export interface LLMCallResult<T = unknown> {
  /** The raw text response from the model. */
  text: string;
  /** Parsed JSON response (if responseMimeType was 'application/json'). */
  parsed: T | null;
  /** Token usage breakdown. */
  tokens: TokenUsage;
  /** Cost breakdown in USD. */
  cost: CostBreakdown;
  /** Latency in milliseconds. */
  latencyMs: number;
  /** The model that was actually used. */
  model: string;
  /** Firestore log document ID (if logging enabled). */
  logId?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Implementation
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;

/** HTTP status codes / gRPC codes that are worth retrying. */
const RETRYABLE_ERROR_CODES = new Set([429, 500, 502, 503, 504]);

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // Google AI SDK wraps HTTP errors with status codes in the message
    if (
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("503") ||
      msg.includes("overloaded") ||
      msg.includes("resource exhausted")
    ) {
      return true;
    }
    // Check for a status property
    const status = (err as { status?: number }).status;
    if (status && RETRYABLE_ERROR_CODES.has(status)) {
      return true;
    }
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class LLMWrapper {
  private genAI: GoogleGenerativeAI;
  private config: Required<
    Pick<
      LLMWrapperConfig,
      "provider" | "apiKey" | "defaultModel" | "enableLogging" | "maxRetries" | "retryBaseDelayMs"
    >
  >;

  constructor(config: LLMWrapperConfig) {
    if (config.provider !== "gemini") {
      throw new Error(
        `[LLMWrapper] Unsupported provider "${config.provider}". Only "gemini" is supported.`
      );
    }

    this.config = {
      provider: config.provider,
      apiKey: config.apiKey,
      defaultModel: config.defaultModel ?? DEFAULT_MODEL,
      enableLogging: config.enableLogging ?? true,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryBaseDelayMs: config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
    };

    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
  }

  /**
   * Make an LLM call with full audit trail.
   *
   * Usage (from design doc §8.1):
   * ```ts
   * const result = await llm.call(prompt, {
   *   clientId: tenantId,
   *   userId: callerUid,
   *   userRole: 'teacher',
   *   purpose: 'answer_grading',
   *   operation: 'relmsEvaluation',
   *   resourceType: 'questionSubmission',
   *   resourceId: questionSubmissionId,
   *   temperature: 0.1,
   *   maxTokens: 4096,
   * }, {
   *   images: answerImages,
   *   systemPrompt: relmsSystemPrompt,
   *   responseMimeType: 'application/json',
   * });
   * ```
   */
  async call<T = unknown>(
    prompt: string,
    metadata: LLMCallMetadata,
    options: LLMCallOptions = {}
  ): Promise<LLMCallResult<T>> {
    const model = metadata.model ?? this.config.defaultModel;
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 300_000; // Default 5 minutes
    let lastError: Error | null = null;

    // Check circuit breaker before making the call
    if (isCircuitOpen(metadata.clientId)) {
      const cbError = new Error(getCircuitOpenMessage());
      if (this.config.enableLogging) {
        await this.log(
          metadata,
          model,
          buildTokenUsage(0, 0),
          estimateCost(model, buildTokenUsage(0, 0)),
          0,
          false,
          "Circuit breaker open"
        ).catch(() => {
          /* swallow logging errors */
        });
      }
      throw cbError;
    }

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      // Check if we've exceeded total timeout across retries
      if (Date.now() - startTime > timeoutMs) {
        const timeoutError = new Error(
          `[LLMWrapper] Total call timeout exceeded (${timeoutMs}ms) after ${attempt} attempts.`
        );
        recordFailure(metadata.clientId);
        const classified = classifyError(timeoutError);
        const latencyMs = Date.now() - startTime;
        if (this.config.enableLogging) {
          await this.log(
            metadata,
            model,
            buildTokenUsage(0, 0),
            estimateCost(model, buildTokenUsage(0, 0)),
            latencyMs,
            false,
            timeoutError.message
          ).catch(() => {
            /* swallow logging errors */
          });
        }
        const userFacingError = new Error(classified.userMessage);
        (userFacingError as Error & { classified: ClassifiedError }).classified = classified;
        throw userFacingError;
      }

      try {
        const result = await this.executeCall<T>(prompt, model, metadata, options);

        // Record success for circuit breaker
        recordSuccess(metadata.clientId);

        // Log success
        if (this.config.enableLogging) {
          result.logId = await this.log(
            metadata,
            model,
            result.tokens,
            result.cost,
            result.latencyMs,
            true
          );
        }

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.config.maxRetries && isRetryable(err)) {
          const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
          const jitter = Math.random() * delay * 0.1;
          console.warn(
            `[LLMWrapper] Retryable error on attempt ${attempt + 1}/${this.config.maxRetries + 1}: ${lastError.message}. Retrying in ${Math.round(delay + jitter)}ms...`
          );
          await sleep(delay + jitter);
          continue;
        }

        // Non-retryable or exhausted retries — record failure for circuit breaker
        recordFailure(metadata.clientId);

        // Classify error for better diagnostics
        const classified = classifyError(lastError);
        console.error(`[LLMWrapper] ${classified.type} error: ${classified.originalError}`);

        // Log failure
        const latencyMs = Date.now() - startTime;
        if (this.config.enableLogging) {
          await this.log(
            metadata,
            model,
            buildTokenUsage(0, 0),
            estimateCost(model, buildTokenUsage(0, 0)),
            latencyMs,
            false,
            lastError.message
          ).catch((logErr) => {
            console.error("[LLMWrapper] Failed to log error:", logErr);
          });
        }

        // Throw with user-friendly message
        const userFacingError = new Error(classified.userMessage);
        (userFacingError as Error & { classified: ClassifiedError }).classified = classified;
        throw userFacingError;
      }
    }

    // Should not reach here, but TypeScript needs it
    throw lastError ?? new Error("[LLMWrapper] Unexpected: exhausted retries with no error.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async executeCall<T>(
    prompt: string,
    modelName: string,
    metadata: LLMCallMetadata,
    options: LLMCallOptions
  ): Promise<LLMCallResult<T>> {
    const startTime = Date.now();

    // Build generation config
    const generationConfig: GenerationConfig = {};
    if (metadata.temperature !== undefined) {
      generationConfig.temperature = metadata.temperature;
    }
    if (metadata.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = metadata.maxTokens;
    }
    if (options.responseMimeType) {
      generationConfig.responseMimeType = options.responseMimeType;
    }
    if (options.responseSchema) {
      (generationConfig as GenerationConfig & { responseSchema?: unknown }).responseSchema =
        options.responseSchema;
    }

    // Get the generative model
    const genModel: GenerativeModel = this.genAI.getGenerativeModel({
      model: modelName,
      ...(options.systemPrompt ? { systemInstruction: options.systemPrompt } : {}),
      generationConfig,
    });

    // Build content parts
    const parts: Part[] = [];

    // Add images first (base64 inline data)
    if (options.images?.length) {
      for (const img of options.images) {
        parts.push({
          inlineData: {
            data: img.base64,
            mimeType: img.mimeType,
          },
        });
      }
    }

    // Add text prompt
    parts.push({ text: prompt });

    // Build the request
    const request: GenerateContentRequest = {
      contents: [{ role: "user", parts } as Content],
    };

    // Make the API call
    const response = await genModel.generateContent(request);
    const result = response.response;

    // Log finish reason for diagnostics
    const finishReason = result.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      console.warn(
        `[LLMWrapper] Non-STOP finish reason: ${finishReason} (model: ${modelName}, operation: ${metadata.operation})`
      );
    }

    // Extract text
    const text = result.text();
    console.log(
      `[LLMWrapper] Response length: ${text.length} chars, finishReason: ${finishReason ?? "unknown"}, operation: ${metadata.operation}`
    );

    // If response was truncated due to token limit, throw a retryable error
    if (finishReason === "MAX_TOKENS") {
      throw Object.assign(
        new Error(
          `[LLMWrapper] Response truncated (MAX_TOKENS). Got ${text.length} chars. Consider increasing maxTokens.`
        ),
        { status: 503 } // Mark as retryable
      );
    }

    // Extract token usage from response metadata
    const usageMetadata = result.usageMetadata;
    const tokens = buildTokenUsage(
      usageMetadata?.promptTokenCount ?? 0,
      usageMetadata?.candidatesTokenCount ?? 0
    );

    const cost = estimateCost(modelName, tokens);
    const latencyMs = Date.now() - startTime;

    // Try to parse JSON if response mime type was JSON
    let parsed: T | null = null;
    if (options.responseMimeType === "application/json") {
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        console.warn(
          "[LLMWrapper] Failed to parse JSON response. Raw text will be available in result.text."
        );
      }
    }

    return {
      text,
      parsed,
      tokens,
      cost,
      latencyMs,
      model: modelName,
    };
  }

  private async log(
    metadata: LLMCallMetadata,
    model: string,
    tokens: TokenUsage,
    cost: CostBreakdown,
    latencyMs: number,
    success: boolean,
    error?: string
  ): Promise<string> {
    const params: LogLLMCallParams = {
      tenantId: metadata.clientId,
      userId: metadata.userId,
      userRole: metadata.userRole,
      purpose: metadata.purpose,
      operation: metadata.operation,
      resourceType: metadata.resourceType,
      resourceId: metadata.resourceId,
      model,
      tokens,
      cost,
      latencyMs,
      success,
    };
    if (error) {
      params.error = error;
    }
    return logLLMCall(params);
  }
}
