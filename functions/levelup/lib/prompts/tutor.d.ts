/**
 * AI Tutor Prompt Templates.
 *
 * Used by sendChatMessage Cloud Function for AI tutor chat.
 * Context-aware, Socratic method, multi-language support.
 */
import type { Agent, UnifiedItem, UnifiedEvaluationResult } from "../types";
/**
 * Build the system prompt for an AI tutor chat session.
 * Per design doc §10.2: current item context only.
 */
export declare function buildTutorSystemPrompt(
  agent: Agent | null,
  item: UnifiedItem,
  studentAnswer?: unknown,
  evaluationResult?: UnifiedEvaluationResult,
  language?: string
): string;
