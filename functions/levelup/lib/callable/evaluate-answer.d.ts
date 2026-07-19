import type { UnifiedEvaluationResult } from "../types";
/**
 * AI-evaluate a single answer using Gemini.
 *
 * For question types: text, paragraph, code, audio, image_evaluation, chat_agent_question.
 * Resolves evaluator agent and rubric via inheritance chain.
 * Rate limited: 10 AI operations/min per user.
 */
export declare const evaluateAnswer: import("firebase-functions/https").CallableFunction<
  any,
  Promise<UnifiedEvaluationResult>,
  unknown
>;
