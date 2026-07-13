/**
 * AI Evaluator Prompt Templates.
 *
 * Used by evaluateAnswer Cloud Function for AI-evaluated question types:
 * text, paragraph, code, audio, image_evaluation, chat_agent_question.
 */
import type { UnifiedItem, UnifiedRubric, Agent } from "../types";
/**
 * Build the evaluation prompt for a given question type.
 */
export declare function buildEvaluationPrompt(
  item: UnifiedItem,
  studentAnswer: unknown,
  rubric: UnifiedRubric | null,
  agent: Agent | null,
  mediaUrls?: string[]
): string;
