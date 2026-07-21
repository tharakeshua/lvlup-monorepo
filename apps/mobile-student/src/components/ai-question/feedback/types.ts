/**
 * Feedback-result prop contract (Surface G) — the shapes W1 hands to
 * <FeedbackResult>. Kept self-contained (no `@levelup/domain` import) so the
 * feedback kit stays a pure presentational unit in the RN bundle; the field
 * names mirror the server-authoritative schemas exactly:
 *
 *   • evaluation  = StoredEvaluation (domain content/stored-evaluation.ts) — the
 *     authoritative read is `recordItemAttempt(...).progress.evaluation`. Use
 *     {@link toStoredEvaluation} to pull it out of a raw attempt result.
 *   • config      = v1.levelup.getEvaluationConfig STUDENT projection
 *     ({ rubric, settings }); holisticGuidance / modelAnswer / evaluatorGuidance
 *     are already stripped server-side (never source them). Objectives live on
 *     the item payload, not here.
 *
 * Three DISTINCT feedback channels (Layer-2 locked — do not conflate):
 *   1. rubricBreakdown[]  → SCORED per-criterion rows + level ladder.
 *   2. structuredFeedback → QUALITATIVE per-dimension items (severity, no score).
 *   3. dimensionBreakdown → the per-dimension NUMERIC score, pending owner D3.
 *      The slot is built; a ring number renders only when this arrives.
 *
 * Every section is OPTIONAL — the server applies displaySettings gating (e.g.
 * showStrengths=false ⇒ strengths empty; showKeyTakeaway=false ⇒ summary omitted)
 * — so render defensively and collapse when empty. `summary` may be a legacy bare
 * STRING in old data; tolerate object|string.
 */

export type Verdict = "correct" | "partial" | "incorrect";
export type FeedbackSeverity = "critical" | "major" | "minor";
export type MistakeClassification = "Conceptual" | "Silly Error" | "Knowledge Gap" | "None";
export type DimensionPriority = "HIGH" | "MEDIUM" | "LOW";
export type RubricScoringMode = "criteria_based" | "dimension_based" | "holistic" | "hybrid";

/* ── Evaluation payload (StoredEvaluation-tolerant) ─────────────────────── */

export interface StoredFeedbackItem {
  severity?: FeedbackSeverity | string;
  message?: string;
  /** Optional dimension label the grader tagged this item with. */
  dimension?: string;
  suggestion?: string;
}

export interface StoredRubricBreakdownItem {
  /** Optional — join to config criteria by id WHEN present, else criterionName. */
  criterionId?: string;
  criterionName?: string;
  score?: number;
  maxScore?: number;
  comment?: string;
}

/** Pending owner decision D3 — the per-dimension numeric score. */
export interface DimensionBreakdownItem {
  dimensionId: string;
  dimensionName?: string;
  score: number;
  scale?: number;
  comment?: string;
}

export type StoredSummary = { keyTakeaway?: string; overallComment?: string } | string | null;

export interface StoredEvaluationInput {
  score?: number | null;
  maxScore?: number | null;
  correctness?: number | null;
  percentage?: number | null;
  confidence?: number | null;
  summary?: StoredSummary;
  mistakeClassification?: MistakeClassification | string | null;
  strengths?: string[];
  weaknesses?: string[];
  missingConcepts?: string[];
  structuredFeedback?: Record<string, StoredFeedbackItem[]> | null;
  rubricBreakdown?: StoredRubricBreakdownItem[] | null;
  /** D3 slot — absent today; the dimension ring renders a number only if present. */
  dimensionBreakdown?: DimensionBreakdownItem[] | null;
  /** Server roll-up hint; when true the verdict is forced to "correct". */
  solved?: boolean | null;
}

/* ── Config projection (the "How you'll be evaluated" identities) ───────── */

export interface HyeLevel {
  label: string;
  description?: string;
  score: number;
}

export interface HyeCriterion {
  id?: string;
  name: string;
  description?: string;
  maxScore?: number;
  weight?: number;
  levels?: HyeLevel[];
}

export interface HyeDimension {
  id: string;
  name: string;
  description?: string;
  priority?: DimensionPriority;
  weight?: number;
  scoringScale?: number;
}

/** The student-safe slice of getEvaluationConfig we consume. */
export interface EvaluationConfigInput {
  rubric?: {
    scoringMode?: RubricScoringMode;
    criteria?: HyeCriterion[];
    dimensions?: HyeDimension[];
    passingPercentage?: number;
  } | null;
  settings?: {
    enabledDimensions?: HyeDimension[];
  } | null;
}

/* ── Callbacks (behaviour is wired by W1) ───────────────────────────────── */

export interface FeedbackActions {
  /** Owner-locked: pre-fills the student's last answer for editing. W1 wires it. */
  onTryAgain?: () => void;
  onDiscuss?: () => void;
  onHistory?: () => void;
  onNext?: () => void;
}

export interface FeedbackResultProps {
  /** The StoredEvaluation (`progress.evaluation`). */
  evaluation: StoredEvaluationInput;
  /** getEvaluationConfig student projection — closes the HYE loop + ladders. */
  config?: EvaluationConfigInput | null;
  /** Optional verdict override; otherwise derived from correctness/percentage. */
  verdict?: Verdict;
  /** Highlight this as the student's best attempt so far (Surface H trend). */
  isBestAttempt?: boolean;
  actions?: FeedbackActions;
  /** Extra classes on the scroll container. */
  className?: string;
}
