/**
 * LLM utilities for AutoGrade.
 *
 * Wraps the shared LLMWrapper from @levelup/shared-services.
 * Type declarations are local until shared-services ships compiled .d.ts files.
 *
 * TODO: Replace local type declarations with imports from @levelup/shared-services
 * once the package builds and publishes declaration files.
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

// ─── LLMWrapper types (mirror of shared-services/src/ai/llm-wrapper.ts) ─────

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
  images?: Array<{ base64: string; mimeType: string }>;
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

// ─── Dynamic import of LLMWrapper ────────────────────────────────────────────
// We use require() at runtime since shared-services is a workspace dep
// that points to raw .ts source. In production, it will be compiled.

// eslint-disable-next-line @typescript-eslint/no-var-requires
let _LLMWrapperClass: new (config: LLMWrapperConfig) => LLMWrapperInstance;

interface LLMWrapperInstance {
  call<T = unknown>(
    prompt: string,
    metadata: LLMCallMetadata,
    options?: LLMCallOptions
  ): Promise<LLMCallResult<T>>;
}

function getLLMWrapperClass(): new (config: LLMWrapperConfig) => LLMWrapperInstance {
  if (!_LLMWrapperClass) {
    try {
      // Try workspace import
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@levelup/shared-services/ai");
      _LLMWrapperClass = mod.LLMWrapper;
    } catch {
      // Fallback: try relative path (development)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require("../../../../packages/shared-services/src/ai");
        _LLMWrapperClass = mod.LLMWrapper;
      } catch {
        throw new Error(
          "Could not load LLMWrapper from @levelup/shared-services. Ensure the package is built."
        );
      }
    }
  }
  return _LLMWrapperClass;
}

/**
 * LLMWrapper class — proxy to shared-services implementation.
 */
export class LLMWrapper implements LLMWrapperInstance {
  private instance: LLMWrapperInstance;

  constructor(config: LLMWrapperConfig) {
    const Cls = getLLMWrapperClass();
    this.instance = new Cls(config);
  }

  async call<T = unknown>(
    prompt: string,
    metadata: LLMCallMetadata,
    options?: LLMCallOptions
  ): Promise<LLMCallResult<T>> {
    return this.instance.call<T>(prompt, metadata, options);
  }
}

// ─── Secret Manager helper ───────────────────────────────────────────────────

let smClient: SecretManagerServiceClient | null = null;

const PLATFORM_GEMINI_SECRET_NAME = "levelup-default-gemini";

function getSmClient(): SecretManagerServiceClient {
  if (!smClient) {
    smClient = new SecretManagerServiceClient();
  }
  return smClient;
}

/**
 * Retrieve a tenant's Gemini API key from Secret Manager.
 */
export async function getGeminiApiKey(tenantId: string): Promise<string> {
  const envKey = process.env["LEVELUP_AI_KEY"] ?? process.env["GEMINI_API_KEY"];
  if (envKey?.trim()) return envKey.trim();

  const project = process.env["GCLOUD_PROJECT"] ?? process.env["GCP_PROJECT"];
  if (!project) {
    throw new Error(
      "No default Gemini environment key or GCP project ID. Set LEVELUP_AI_KEY, GEMINI_API_KEY, GCLOUD_PROJECT, or GCP_PROJECT."
    );
  }

  const readSecret = async (secretName: string): Promise<string> => {
    const versionPath = `projects/${project}/secrets/${secretName}/versions/latest`;
    const [version] = await getSmClient().accessSecretVersion({ name: versionPath });
    const payload = version.payload?.data;

    if (!payload) {
      throw new Error(`Secret "${secretName}" has no payload data.`);
    }

    const key =
      typeof payload === "string" ? payload : new TextDecoder().decode(payload as Uint8Array);
    if (!key.trim()) throw new Error(`Secret "${secretName}" is empty.`);
    return key.trim();
  };

  try {
    return await readSecret(PLATFORM_GEMINI_SECRET_NAME);
  } catch (error: unknown) {
    const code = (error as { code?: number } | null)?.code;
    if (code !== 5 && !/NOT_FOUND/i.test(String(error))) throw error;
    return readSecret(`tenant-${tenantId}-gemini`);
  }
}
