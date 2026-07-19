/**
 * Chat safety filter for student AI interactions.
 *
 * Detects prompt injection attempts, non-educational content requests,
 * and rate limit abuse before sending messages to the LLM.
 */
export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  warning?: string;
}
/**
 * Check if a student message is safe to send to the AI tutor.
 */
export declare function checkMessageSafety(message: string): SafetyCheckResult;
/**
 * Track user message frequency and detect abuse patterns.
 * Returns a warning if the user is approaching the abuse threshold.
 */
export declare function checkRateLimitAbuse(userId: string): SafetyCheckResult;
