import type { TestSubmission, UnifiedItem, UnifiedEvaluationResult } from "../types";
import type { AnswerKey } from "../types";
/**
 * Auto-evaluate a submission for deterministic question types.
 * Returns null if the question type requires AI evaluation.
 */
export declare function autoEvaluateSubmission(
  item: UnifiedItem,
  submission: TestSubmission,
  answerKey?: AnswerKey | undefined
): UnifiedEvaluationResult | null;
