/**
 * Utility functions for answer key extraction and payload stripping.
 * Used by saveItem to separate answer data into a server-only subcollection
 * for timed test items, so students cannot inspect correct answers client-side.
 */
/**
 * Extracts the answer key data from a question payload for server-only storage.
 * Returns null if the question type has no extractable answer key (e.g., AI-evaluated types).
 */
export declare function extractAnswerKey(payload: Record<string, unknown>): {
  correctAnswer: unknown;
  acceptableAnswers?: unknown[];
} | null;
/**
 * Strips answer information from the payload so clients cannot see correct answers.
 * Returns a new payload object with answer data removed.
 */
export declare function stripAnswerFromPayload(
  payload: Record<string, unknown>
): Record<string, unknown>;
