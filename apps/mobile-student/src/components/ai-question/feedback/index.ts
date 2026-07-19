/**
 * Feedback-result kit (Surface G) — the self-contained scored-feedback surface
 * owned by W2. W1 imports <FeedbackResult> (and, if handed a raw attempt result,
 * `toStoredEvaluation`) to replace the legacy FeedbackPanel in ContentViewer /
 * PracticeMode. See ./types (FeedbackResultProps) for the full prop contract.
 */
export { FeedbackResult } from "./feedback-result";
export { toStoredEvaluation, buildEvaluationView } from "./adapter";
export type {
  EvaluationView,
  RubricRowView,
  DimensionGroupView,
  ScoredChipView,
  ConfidenceLevel,
  ScoreState,
} from "./adapter";
export type {
  FeedbackResultProps,
  FeedbackActions,
  StoredEvaluationInput,
  EvaluationConfigInput,
  Verdict,
  FeedbackSeverity,
  DimensionBreakdownItem,
  HyeCriterion,
  HyeDimension,
} from "./types";

// Sub-components — exported so W1/W5 can compose partials (e.g. a compact
// verdict row in attempt history) without re-deriving the view.
export { VerdictHeader } from "./verdict-header";
export { PercentBar, ScoreBar } from "./score-bar";
export { ConfidenceBadge, MistakeChip, SeverityTag, ReviewBanner } from "./chips";
export { ScoredHyeStrip } from "./scored-hye";
export { RubricBreakdown } from "./rubric-breakdown";
export { DimensionFeedback } from "./dimension-feedback";
export { GrowthSections } from "./growth-sections";
export { GrowthActions } from "./actions";
export { KeyTakeaway, OverallComment } from "./takeaway";
