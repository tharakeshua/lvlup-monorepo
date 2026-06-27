/**
 * `evaluationRepo` (SDK-LAYERS-PLAN §4.1 per-entity list — `evaluationRepo`).
 *
 * The single-answer practice-evaluation edge: `evaluateAnswer` now persists
 * progress server-side in the same call (be-levelup rec #7) and returns the
 * compact `StoredEvaluation` ONLY — never the raw `UnifiedEvaluationResult` with
 * cost/internal fields (§6.5/§6.7). The repo issues the call and surfaces the
 * authoritative response unchanged (server computes the score).
 *
 * Per-entity repo — `api` + `@levelup/domain` only; never a sibling repo (R6).
 */
import type { StoredEvaluation } from "@levelup/domain";
import type { ApiClient, EvaluateAnswerRequest, EvaluateAnswerResponse } from "./api-types.js";

export interface EvaluationRepo {
  /** Evaluate a single answer; server scores + persists progress (rec #7). */
  recordEvaluation(input: EvaluateAnswerRequest): Promise<EvaluateAnswerResponse>;
  /** Derived: did this evaluation count as fully correct (UX-only display helper). */
  isCorrect(evaluation: Pick<StoredEvaluation, "correctness">): boolean;
}

export function createEvaluationRepo(api: ApiClient): EvaluationRepo {
  return {
    recordEvaluation: (input) => api.levelup.evaluateAnswer(input),
    // `correctness` is a 0..1 score (StoredEvaluation); fully-correct == 1.
    isCorrect: (evaluation) => evaluation.correctness >= 1,
  };
}
