// AI Infrastructure — barrel export
export { LLMWrapper } from "./llm-wrapper";
export type {
  LLMWrapperConfig,
  LLMCallMetadata,
  LLMCallOptions,
  LLMCallResult,
} from "./llm-wrapper";

export {
  getGeminiApiKey,
  setGeminiApiKey,
  deleteGeminiApiKey,
  getSecretName,
  PLATFORM_GEMINI_SECRET_NAME,
} from "./secret-manager";

export { logLLMCall } from "./llm-logger";
export type { LLMCallLogEntry, LogLLMCallParams } from "./llm-logger";

export {
  estimateCost,
  buildTokenUsage,
  getSupportedModels,
  estimateImageTokens,
} from "./cost-tracker";
export type { TokenUsage, CostBreakdown } from "./cost-tracker";

export {
  classifyError,
  recordFailure,
  recordSuccess,
  isCircuitOpen,
  getCircuitOpenMessage,
  getQuotaExceededMessage,
} from "./fallback-handler";
export type { LLMErrorType, ClassifiedError } from "./fallback-handler";

export { checkUsageQuota, incrementDailyCostSummary } from "./usage-quota";
export type { QuotaCheckResult } from "./usage-quota";
