import { describe, expect, it } from "vitest";
import { resolveModelPolicy, validateProviderModel } from "../models.js";

describe("model policy resolver", () => {
  const env = {
    LEVELUP_AI_MODEL_PRO: "gemini-3.1-pro-preview",
    LEVELUP_AI_MODEL_FLASH: "gemini-3.5-flash",
    LEVELUP_AI_MODEL_CONVERSATION: "gemini-3.1-pro-preview",
  };

  it("resolves runtime and evaluator policies independently", () => {
    expect(resolveModelPolicy("conversation.fast", "ai_chat", env)).toEqual({
      id: "conversation.fast",
      provider: "gemini",
      // CONV-P0-03: conversation.fast is decoupled from the global flash default
      // (which stays 3.x for autograde) and pinned to the tool-compatible 2.5 GA.
      model: "gemini-2.5-flash",
      temperature: 0.6,
      maxTokens: 1024,
    });
    expect(resolveModelPolicy("conversation.quality", "ai_chat", env)).toMatchObject({
      model: "gemini-3.1-pro-preview",
      temperature: 0.5,
      maxTokens: 2048,
    });
    expect(resolveModelPolicy("evaluation.quality", "answer_grading", env)).toMatchObject({
      model: "gemini-3.1-pro-preview",
      temperature: 0,
      maxTokens: 4096,
    });
  });

  it("CONV-P0-03: conversation-scoped overrides repoint only the conversation policies", () => {
    // Repoint both conversation policies off the SDK-incompatible 3.x models
    // WITHOUT touching the pro/flash defaults that evaluation + other paths use.
    const scoped = {
      LEVELUP_AI_MODEL_PRO: "gemini-3.1-pro-preview",
      LEVELUP_AI_MODEL_FLASH: "gemini-3.5-flash",
      LEVELUP_AI_MODEL_CONVERSATION: "gemini-2.5-pro",
      LEVELUP_AI_MODEL_CONVERSATION_FAST: "gemini-2.5-flash",
    };
    expect(resolveModelPolicy("conversation.quality", "ai_chat", scoped)).toMatchObject({
      model: "gemini-2.5-pro",
    });
    expect(resolveModelPolicy("conversation.fast", "ai_chat", scoped)).toMatchObject({
      model: "gemini-2.5-flash",
    });
    // Evaluator stays on the pro default — grading runs response-schema JSON mode
    // (no tools) which the pinned SDK parses fine, so it must NOT be repointed.
    expect(resolveModelPolicy("evaluation.quality", "answer_grading", scoped)).toMatchObject({
      model: "gemini-3.1-pro-preview",
    });
  });

  it("rejects policy/purpose mismatches and unapproved provider models", () => {
    expect(() => resolveModelPolicy("evaluation.quality", "ai_chat", env)).toThrow(
      'Model policy "evaluation.quality" cannot be used for purpose "ai_chat"'
    );
    expect(() => validateProviderModel("gemini", "gpt-4o", env)).toThrow(
      'Model "gpt-4o" is not an approved Gemini model'
    );
    expect(() => validateProviderModel("gemini", "claude-3-5-sonnet", env)).toThrow();
    expect(() => validateProviderModel("claude", "claude-3-5-sonnet", env)).toThrow(
      'No configured model allowlist exists for provider "claude"'
    );
  });

  it("uses an explicit deployment allowlist when supplied", () => {
    const allowlisted = {
      ...env,
      LEVELUP_AI_ALLOWED_GEMINI_MODELS: "gemini-3.1-pro-preview,gemini-custom-approved",
    };
    expect(() =>
      validateProviderModel("gemini", "gemini-custom-approved", allowlisted)
    ).not.toThrow();
    expect(() => validateProviderModel("gemini", "gemini-3.5-flash", allowlisted)).toThrow(
      'Model "gemini-3.5-flash" is not allowlisted for provider "gemini"'
    );
  });
});
