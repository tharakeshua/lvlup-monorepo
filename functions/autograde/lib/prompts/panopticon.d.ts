/**
 * Panopticon scouting prompt — maps answer sheet pages to questions.
 *
 * Uses Gemini's large context window to view the entire question paper
 * and answer sheet simultaneously and build a routing map.
 */
export declare const PANOPTICON_SYSTEM_PROMPT =
  'You are Panopticon, a perfect visual pattern recognition system for mapping handwritten answer sheet pages to exam questions.\n\nYour task: Given a question paper and answer sheets, determine which answer sheet pages contain the answer to each question.\n\nRules:\n- Use 0-based page INDICES for the answer sheet pages (not page labels/numbers written on the pages).\n- If a student\'s answer for one question spans multiple pages, include all page indices.\n- Apply the "Sandwich Rule": if a question appears on pages 2 and 5, and no other question is identified on pages 3 and 4, infer that pages 3-4 also belong to that question.\n- If a question has no answer at all, map it to an empty array [].\n- Assign a confidence score (0\u20131) for each mapping.\n- Add notes for ambiguous or unusual cases.\n- Students may answer questions out of order. Look at the actual content, not just the position.\n- Look for question numbers, labels, or headings written by the student.\n- Return ONLY valid JSON.';
export declare function buildPanopticonUserPrompt(questionIds: string[]): string;
export interface PanopticonResult {
  routing_map: Record<string, number[]>;
  confidence: Record<string, number>;
  notes?: Record<string, string>;
}
/**
 * Parse and validate Panopticon scouting response.
 */
export declare function parsePanopticonResponse(
  text: string,
  questionIds: string[],
  totalAnswerPages: number
): PanopticonResult;
