/**
 * ai-question — the unified multimodal AI-question kit (Surfaces A–F).
 * The public surface consumed by ContentViewerScreen / PracticeModeScreen and by
 * sibling AIQ workers (tokens + the AnswerPart seam are the shared contracts).
 */

// shared contracts (consumed by W2–W5)
export * from "./tokens";
export * from "./answer-bundle";
export * from "./capability";

// data adapters
export { buildHyeModel } from "./hye-card";
export type { HyeModel, HyeCriterion, HyeDimension, HyeLadderStep } from "./hye-card";

// composable pieces
export { QuestionPrompt, CollapsedPrompt, AiTopBar, splitPromptImages } from "./prompt";
export { HowYoullBeEvaluated } from "./hye-card";
export { WriteArea, CodeArea } from "./composer";
export type { WordTarget } from "./composer";
export { CapabilityPills } from "./capability-pills";
export { PartsStack } from "./parts-stack";
export { RecordStage } from "./record-stage";
export { FocusComposer } from "./focus-mode";
export {
  DraftRestoredBanner,
  ValidationBanner,
  PermissionBanner,
  Shakeable,
  useShake,
} from "./banners";
export { EvaluatingState, EvaluationFailed } from "./evaluating";

// the composed answering region
export { AiAnswerSurface } from "./ai-answer-surface";
export type { AiAnswerSurfaceProps } from "./ai-answer-surface";
