/**
 * GeminiProvider — the concrete `LLMProvider` over `@google/generative-ai`
 * (server-shared.md §4.3). Built from a per-tenant API key resolved by the
 * gateway from Secret Manager; this module never reads a secret itself.
 */
import { randomUUID } from "node:crypto";
import {
  FunctionCallingMode,
  GoogleGenerativeAI,
  type Content,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
  type GenerateContentRequest,
  type Part,
  type ResponseSchema,
} from "@google/generative-ai";
import type {
  LLMProvider,
  ProviderInput,
  ProviderMessage,
  ProviderOutput,
  ProviderTokenUsage,
  ProviderToolCall,
} from "./provider.js";
import { DEFAULT_FLASH_MODEL } from "../models.js";

export interface GeminiOpts {
  /** Default model when the request omits one. */
  defaultModel?: string;
}

const DEFAULT_MODEL = DEFAULT_FLASH_MODEL;

/**
 * Convert gateway-neutral, role-preserving messages to Gemini's legacy content
 * roles. Gemini has no native developer or invocation-id fields, so developer
 * configuration remains a distinct first user content and tool call IDs stay in
 * the gateway history / function-response envelope. The platform policy itself
 * remains the sole `systemInstruction`.
 */
export function toGeminiContents(input: Pick<ProviderInput, "messages" | "images">): Content[] {
  const contents = input.messages.map(toGeminiContent);

  // Legacy vision callers still supply `images` beside their one user message.
  // Attach those bytes to the most recent user content rather than flattening
  // role-preserving typed histories.
  if (input.images && input.images.length > 0) {
    const inlineParts: Part[] = input.images.map((image) => ({
      inlineData: { data: image.base64, mimeType: image.mimeType },
    }));
    const target = [...contents].reverse().find((content) => content.role === "user");
    if (target) {
      target.parts.push(...inlineParts);
    } else {
      contents.push({ role: "user", parts: inlineParts });
    }
  }

  return contents;
}

function toGeminiContent(message: ProviderMessage): Content {
  switch (message.role) {
    case "developer":
      return {
        // The old Gemini SDK does not support a developer role. It is still
        // carried separately from the registry system policy so it cannot
        // overwrite platform instructions.
        role: "user",
        parts: message.parts.map((part) => ({
          text: `Developer configuration (subordinate to platform policy):\n${part.text}`,
        })),
      };
    case "user":
      return {
        role: "user",
        parts: message.parts.map((part) =>
          part.type === "text"
            ? { text: part.text }
            : { inlineData: { data: part.image.base64, mimeType: part.image.mimeType } }
        ),
      };
    case "assistant":
      return {
        role: "model",
        parts: message.parts.map((part) =>
          part.type === "text"
            ? { text: part.text }
            : { functionCall: { name: part.name, args: part.args } }
        ),
      };
    case "tool":
      return {
        role: "function",
        parts: message.parts.map((part) => ({
          // Gemini's legacy FunctionResponse has no call-id field. Retain the
          // gateway's ID inside the response envelope so same-name calls remain
          // auditable and the durable message history never loses correlation.
          functionResponse: {
            name: part.name,
            response: { callId: part.callId, result: part.result },
          },
        })),
      };
  }
}

function toUsage(
  meta:
    | { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
    | undefined
): ProviderTokenUsage {
  if (!meta) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, source: "unavailable" };
  }
  const inputTokens = meta.promptTokenCount ?? 0;
  const outputTokens = meta.candidatesTokenCount ?? 0;
  const totalTokens = meta.totalTokenCount ?? inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens, source: "provider" };
}

// Gemini's `functionDeclarations[].parameters` and `responseSchema` accept only a
// restricted OpenAPI 3.0 Schema subset. JSON Schemas produced from strict Zod
// objects carry keywords Gemini rejects with a 400 (`Unknown name
// "additionalProperties" at 'tools[0].function_declarations[0].parameters'`).
// Recursively drop those keywords before handing the schema to the SDK. Valid
// keywords (type/format/description/enum/items/properties/required/nullable/…)
// pass through unchanged, so legal schemas are untouched.
const GEMINI_UNSUPPORTED_SCHEMA_KEYS = new Set([
  "additionalProperties",
  "unevaluatedProperties",
  "patternProperties",
  "additionalItems",
  "$schema",
  "$id",
  "$ref",
  "$defs",
  "definitions",
]);

export function stripUnsupportedSchemaKeys<T>(schema: T): T {
  if (Array.isArray(schema)) {
    return schema.map((entry) => stripUnsupportedSchemaKeys(entry)) as unknown as T;
  }
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (GEMINI_UNSUPPORTED_SCHEMA_KEYS.has(key)) continue;
      out[key] = stripUnsupportedSchemaKeys(value);
    }
    return out as T;
  }
  return schema;
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
        // This is intentionally only the platform-owned registry policy. Agent
        // configuration travels in the typed message history below.
        systemInstruction: input.system,
      });

      const request: GenerateContentRequest = {
        contents: toGeminiContents(input),
        generationConfig: {
          ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
          ...(input.maxTokens !== undefined ? { maxOutputTokens: input.maxTokens } : {}),
          ...(input.responseSchema
            ? {
                responseMimeType: "application/json",
                responseSchema: stripUnsupportedSchemaKeys(input.responseSchema) as ResponseSchema,
              }
            : {}),
        },
        // Tool declarations. The gateway enforces `tools` + `responseSchema`
        // exclusion before this provider is constructed/called.
        ...(input.tools && input.tools.length > 0
          ? {
              tools: [
                {
                  functionDeclarations: input.tools.map(
                    (tool): FunctionDeclaration => ({
                      name: tool.name,
                      description: tool.description,
                      ...(tool.parameters
                        ? {
                            parameters: stripUnsupportedSchemaKeys(
                              tool.parameters
                            ) as FunctionDeclarationSchema,
                          }
                        : {}),
                    })
                  ),
                },
              ],
              ...(input.toolChoice !== undefined
                ? {
                    toolConfig: {
                      functionCallingConfig: {
                        mode:
                          input.toolChoice === "none"
                            ? FunctionCallingMode.NONE
                            : FunctionCallingMode.AUTO,
                      },
                    },
                  }
                : {}),
            }
          : {}),
      };

      const result = await model.generateContent(request);
      const response = result.response;
      // `response.text()` throws on candidates that carry ONLY functionCall
      // parts on some SDK versions — read defensively when tools are declared.
      let text = "";
      try {
        text = response.text();
      } catch {
        text = "";
      }
      let json: unknown;
      if (input.responseSchema) {
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          json = undefined;
        }
      }
      let toolCalls: ProviderToolCall[] | undefined;
      if (input.tools && input.tools.length > 0) {
        const calls = response.functionCalls?.() ?? [];
        if (calls.length > 0) {
          toolCalls = calls.map((call) => ({
            // The pinned Gemini SDK does not return an invocation ID. Generate
            // it at the provider boundary; all subsequent gateway/service/SDK
            // seams preserve this exact ID through tool continuation.
            callId: `gemini:${randomUUID()}`,
            name: call.name,
            args: (call.args ?? {}) as Record<string, unknown>,
          }));
        }
      }

      return {
        text,
        json,
        ...(toolCalls ? { toolCalls } : {}),
        usage: toUsage(response.usageMetadata),
        model: modelName,
      };
    },
  };
}
