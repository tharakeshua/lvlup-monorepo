/**
 * Evaluation Core — the ONE AI-evaluation engine (AI-EVALUATION-CORE-PLAN.md).
 * Consumers: levelup practice/test (online), autograde RELMS (offline), and
 * chat-agent transcript finalization. Callers own persistence/authz/idempotency;
 * this module owns config resolution + prompt + schema + normalized outcome.
 */
export * from "./types.js";
export { buildEvaluationPrompt } from "./prompt.js";
export { buildEvaluationResponseSchema, enabledDimensionIds } from "./response-schema.js";
export {
  resolveLevelupEvaluationConfig,
  freezeLevelupEvaluationConfig,
  getEvaluationSettings,
  getDefaultEvaluationSettings,
} from "./resolve.js";
export { evaluateWithAi } from "./evaluate.js";
