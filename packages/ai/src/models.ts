/**
 * Default Gemini model ids and the central model-policy resolver. Model
 * availability changes over time, so the platform defaults live HERE, in one
 * place, and are env-overridable so a future retirement is a config change, not
 * a redeploy of every prompt:
 *
 *   LEVELUP_AI_MODEL_PRO          — deep-reasoning tier (extraction / grading)
 *   LEVELUP_AI_MODEL_FLASH        — fast tier (scouting / chat / insights)
 *   LEVELUP_AI_MODEL_CONVERSATION — approved quality conversation tier
 *
 * The prompt registry's per-template `defaultModel` and the Gemini provider's
 * fallback both read these. New conversation/evaluation callers submit a stable
 * policy ID; only legacy callers may supply a raw, allowlisted model name.
 */
import type { AiPurpose } from "./prompts/registry.js";

/** Mirrors the canonical domain union without making package build ordering brittle. */
export type ModelPolicyId = "conversation.fast" | "conversation.quality" | "evaluation.quality";

export interface ModelDefaults {
  pro: string;
  flash: string;
}

export interface ResolvedModelPolicy {
  id: ModelPolicyId;
  provider: "gemini";
  model: string;
  temperature: number;
  maxTokens: number;
}

/** Resolve the model defaults from the environment (exported for tests). */
export function resolveModelDefaults(env: Record<string, string | undefined>): ModelDefaults {
  return {
    pro: env["LEVELUP_AI_MODEL_PRO"] || "gemini-3.1-pro-preview",
    flash: env["LEVELUP_AI_MODEL_FLASH"] || "gemini-3.5-flash",
  };
}

// Functions env is fixed at deploy time, so module-load resolution is safe.
const DEFAULTS = resolveModelDefaults(process.env);

export const DEFAULT_PRO_MODEL: string = DEFAULTS.pro;
export const DEFAULT_FLASH_MODEL: string = DEFAULTS.flash;

type ModelEnv = NodeJS.ProcessEnv;

/**
 * Resolve the only product-level model policies. The numeric defaults are
 * deliberately centralized as well: a conversation runtime cannot smuggle a
 * raw model or temperature override past this policy boundary.
 */
export function resolveModelPolicy(
  policyId: ModelPolicyId,
  purpose: AiPurpose,
  env: ModelEnv = process.env
): ResolvedModelPolicy {
  const defaults = resolveModelDefaults(env);
  // CONV-P0-03: the conversation runtime is tool-driven (function calling), which
  // the pinned `@google/generative-ai` SDK cannot parse for the 3.x model
  // generation (it returns thinking + functionCall parts the legacy client reads
  // as empty text/no calls). The evaluation/grading paths stay on the pro default
  // because they run response-schema JSON mode (no tools) and parse fine. These
  // conversation-scoped overrides repoint ONLY the two conversation policies to a
  // tool-compatible generation without touching global pro/flash defaults.
  // CONV-P0-03b: real-key smoke found `gemini-2.5-pro` returns 404 ("no longer
  // available to new users") on this project, so BOTH conversation policies
  // currently resolve to `gemini-2.5-flash` (the only confirmed available +
  // tool-parseable model). Quality keeps its own temperature/token budget below.
  // Durable fix (LLD §15): migrate to `@google/genai` (task AI-SDK-MIGRATE), then
  // repoint quality to an available pro-tier model and restore 3.x if desired.
  const conversationModel = env.LEVELUP_AI_MODEL_CONVERSATION?.trim() || "gemini-2.5-flash";
  const conversationFastModel =
    env.LEVELUP_AI_MODEL_CONVERSATION_FAST?.trim() || "gemini-2.5-flash";

  switch (policyId) {
    case "conversation.fast":
      assertPolicyPurpose(policyId, purpose, "ai_chat");
      validateProviderModel("gemini", conversationFastModel, env);
      return {
        id: policyId,
        provider: "gemini",
        model: conversationFastModel,
        temperature: 0.6,
        maxTokens: 1_024,
      };
    case "conversation.quality":
      assertPolicyPurpose(policyId, purpose, "ai_chat");
      validateProviderModel("gemini", conversationModel, env);
      return {
        id: policyId,
        provider: "gemini",
        model: conversationModel,
        temperature: 0.5,
        maxTokens: 2_048,
      };
    case "evaluation.quality":
      assertPolicyPurpose(policyId, purpose, "answer_grading");
      validateProviderModel("gemini", defaults.pro, env);
      return {
        id: policyId,
        provider: "gemini",
        model: defaults.pro,
        temperature: 0,
        maxTokens: 4_096,
      };
  }
}

/**
 * Fail closed before secret resolution, quota, or a provider request. The
 * configured explicit allowlist is authoritative; absent that setting, the
 * current supported Gemini generations are accepted by a conservative built-in
 * allowlist
 * together with the env-selected defaults. This deliberately rejects gpt-* and
 * claude-* names while Gemini is the active provider.
 */
export function validateProviderModel(
  provider: "gemini" | "claude",
  model: string,
  env: ModelEnv = process.env
): void {
  const normalized = model.trim();
  if (!normalized) throw new Error("AI model must be a non-empty configured model name");

  const explicit = splitModelList(
    provider === "gemini"
      ? env.LEVELUP_AI_ALLOWED_GEMINI_MODELS
      : env.LEVELUP_AI_ALLOWED_CLAUDE_MODELS
  );
  if (explicit.length > 0) {
    if (!explicit.includes(normalized)) {
      throw new Error(`Model "${normalized}" is not allowlisted for provider "${provider}"`);
    }
    return;
  }

  if (provider === "claude") {
    // Claude has no configured adapter in this package. It can only become
    // valid when deployment explicitly supplies its own allowlist above.
    throw new Error(`No configured model allowlist exists for provider "${provider}"`);
  }

  const defaults = resolveModelDefaults(env);
  const approvedConversation = env.LEVELUP_AI_MODEL_CONVERSATION?.trim();
  const configured = [defaults.pro, defaults.flash, approvedConversation].filter(
    (candidate): candidate is string => Boolean(candidate)
  );
  const supportedLegacyGeminiModels = new Set([
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-3.5-flash",
  ]);
  if (!configured.includes(normalized) && !supportedLegacyGeminiModels.has(normalized)) {
    throw new Error(`Model "${normalized}" is not an approved Gemini model`);
  }
}

function assertPolicyPurpose(
  policyId: ModelPolicyId,
  purpose: AiPurpose,
  expected: AiPurpose
): void {
  if (purpose !== expected) {
    throw new Error(`Model policy "${policyId}" cannot be used for purpose "${purpose}"`);
  }
}

function splitModelList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}
