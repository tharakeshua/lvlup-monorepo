/**
 * Evaluation Core types (AI-EVALUATION-CORE-PLAN.md D1). One request shape for
 * every AI-evaluated answer — online practice/test (levelup), offline RELMS
 * (autograde), and chat-agent transcript finalization. The config triad
 * (agent persona / question rubric / evaluation settings) arrives as RAW docs
 * (repos return unvalidated `Doc`s); the core reads them defensively.
 */

export type Doc = Record<string, unknown>;

/**
 * Stable server-resolved model policies accepted by the AI gateway. Assessment
 * finalization must explicitly use its frozen evaluator policy rather than the
 * policy that drove the interviewer/runtime turn loop.
 */
export type EvaluationModelPolicyId =
  | "conversation.fast"
  | "conversation.quality"
  | "evaluation.quality";

/** One chat turn in a chat-agent-question transcript. */
export interface TranscriptTurn {
  role: string;
  content: string;
}

/** A per-turn dimension observation recorded by the chat agent (D6). */
export interface AgentObservation {
  dimensionId: string;
  evidence: string;
  provisionalScore?: number;
  at?: string;
}

/** The question being evaluated (already resolved from the item/exam doc). */
export interface EvaluationQuestion {
  text: string;
  /** Normalized question subtype (short_answer / long_answer / code / audio / …). */
  questionType: string;
  maxScore: number;
  /**
   * Type-specific extras read from the question payload (correctAnswer /
   * acceptableAnswers / language / starterCode / testCases / objectives …).
   */
  typeData?: Doc;
}

/** The learner's answer — text, transcript (chat), and/or attached media. */
export interface EvaluationAnswer {
  text?: string;
  transcript?: TranscriptTurn[];
  /** Storage paths of attached media (already tenant-scope-validated by caller). */
  media?: { storagePath: string; mimeType?: string }[];
  /** Rolling scorecard from the chat agent (transcript finalization only). */
  observations?: AgentObservation[];
  /**
   * Grader-directed note rendered OUTSIDE the <student_answer> guard (e.g.
   * autograde's "the answer is in the N attached answer-sheet pages; pages may
   * also contain other questions — grade ONLY this one").
   */
  note?: string;
}

export interface EvaluationRequest {
  question: EvaluationQuestion;
  answer: EvaluationAnswer;
  /** Evaluator agent doc (persona) — null ⇒ built-in default persona. */
  agent?: Doc | null;
  /** UnifiedRubric snapshot (per-question; incl. ⚷ modelAnswer/evaluatorGuidance). */
  rubric?: Doc | null;
  /** EvaluationSettings doc (enabledDimensions drive the response schema). */
  settings?: Doc | null;
  /** interactive = learner waiting (online); batch = pipeline (autograde/test). */
  mode: "interactive" | "batch";
  /** Audit label for the gateway cost log. */
  operation: string;
  /**
   * Optional centrally-resolved policy. Conversation assessment finalization
   * passes the frozen evaluator policy here; ordinary practice keeps its
   * existing gateway default behavior.
   */
  modelPolicyId?: EvaluationModelPolicyId;
  /**
   * LLM-tracking feature attribution forwarded onto the gateway request
   * (LLM-TRACKING-FRAMEWORK-PLAN.md): e.g. `autograde.answer_sheet`,
   * `levelup.practice`, `levelup.timed_test`, `levelup.agent_question`. Omitted ⇒
   * the gateway derives a default from the promptKey.
   */
  feature?: string;
}

/** Normalized outcome — UnifiedEvaluationResult minus at-rest-only fields. */
export interface EvaluationOutcome {
  score: number;
  maxScore: number;
  correctness: number;
  percentage: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  /** Keyed by enabled-dimension id → feedback items. */
  structuredFeedback?: Record<string, { severity: string; message: string; suggestion?: string }[]>;
  rubricBreakdown?: {
    criterionId?: string;
    criterionName: string;
    score: number;
    maxScore: number;
    comment?: string;
  }[];
  summary?: { keyTakeaway: string; overallComment: string };
  mistakeClassification?: string;
  /** Dimension ids the schema requested (audit/display). */
  dimensionsUsed?: string[];
  /** ⚷ cost telemetry — callers strip before client emission. */
  tokensUsed?: number;
  costUsd?: number;
  model?: string;
}

/** Where each leg of the config triad was resolved from (UI transparency). */
export interface EvaluationConfigProvenance {
  agentSource: "item" | "space" | "exam" | "tenant_default" | "none";
  rubricSource: "item" | "space" | "exam" | "tenant_default" | "none";
  settingsSource: "item" | "space" | "exam" | "tenant_default" | "none";
}

/** The resolved config triad for one levelup item (resolve.ts). */
export interface ResolvedEvaluationConfig {
  agent: Doc | null;
  rubric: Doc | null;
  settings: Doc | null;
  provenance: EvaluationConfigProvenance;
}

/** Version pin retained alongside an Evaluation Core configuration snapshot. */
export interface SourceVersion {
  resourceType: string;
  resourceId: string;
  version: number;
}

/**
 * Deep-copied Evaluation Core inputs retained at conversation start. This is a
 * persistence-neutral shape: Conversation Runtime adds its assessment-specific
 * question, answer-key, and independent evaluator policy around it.
 */
export interface FrozenEvaluationConfig {
  agent: Doc | null;
  rubric: Doc | null;
  settings: Doc | null;
  provenance: EvaluationConfigProvenance;
  sourceVersions: SourceVersion[];
}
