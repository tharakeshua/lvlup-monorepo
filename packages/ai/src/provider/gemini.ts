/**
 * GeminiProvider — the concrete `LLMProvider` over `@google/generative-ai`
 * (server-shared.md §4.3). Built from a per-tenant API key resolved by the
 * gateway from Secret Manager; this module never reads a secret itself.
 */
import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Part,
  type ResponseSchema,
} from "@google/generative-ai";
import type { LLMProvider, ProviderInput, ProviderOutput, ProviderTokenUsage } from "./provider.js";
import { DEFAULT_FLASH_MODEL } from "../models.js";

export interface GeminiOpts {
  /** Default model when the request omits one. */
  defaultModel?: string;
}

const DEFAULT_MODEL = DEFAULT_FLASH_MODEL;

function toParts(input: ProviderInput): Part[] {
  const parts: Part[] = [{ text: input.user }];
  for (const img of input.images ?? []) {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
  }
  return parts;
}

function toUsage(
  meta:
    | { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
    | undefined
): ProviderTokenUsage {
  const inputTokens = meta?.promptTokenCount ?? 0;
  const outputTokens = meta?.candidatesTokenCount ?? 0;
  const totalTokens = meta?.totalTokenCount ?? inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

export function createGeminiProvider(apiKey: string, opts: GeminiOpts = {}): LLMProvider {
  const client = new GoogleGenerativeAI(apiKey);
  const fallbackModel = opts.defaultModel ?? DEFAULT_MODEL;

  return {
    name: "gemini",
    async call(input: ProviderInput): Promise<ProviderOutput> {
      const modelName = input.model || fallbackModel;
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: input.system,
      });

      const request: GenerateContentRequest = {
        contents: [{ role: "user", parts: toParts(input) }],
        generationConfig: {
          ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
          ...(input.maxTokens !== undefined ? { maxOutputTokens: input.maxTokens } : {}),
          ...(input.responseSchema
            ? {
                responseMimeType: "application/json",
                responseSchema: input.responseSchema as ResponseSchema,
              }
            : {}),
        },
      };

      const result = await model.generateContent(request);
      const response = result.response;
      const text = response.text();
      let json: unknown;
      if (input.responseSchema) {
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          json = undefined;
        }
      }

      return {
        text,
        json,
        usage: toUsage(response.usageMetadata),
        model: modelName,
      };
    },
  };
}
