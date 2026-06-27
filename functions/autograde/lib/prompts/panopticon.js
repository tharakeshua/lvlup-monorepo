"use strict";
/**
 * Panopticon scouting prompt — maps answer sheet pages to questions.
 *
 * Uses Gemini's large context window to view the entire question paper
 * and answer sheet simultaneously and build a routing map.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PANOPTICON_SYSTEM_PROMPT = void 0;
exports.buildPanopticonUserPrompt = buildPanopticonUserPrompt;
exports.parsePanopticonResponse = parsePanopticonResponse;
exports.PANOPTICON_SYSTEM_PROMPT = `You are Panopticon, a perfect visual pattern recognition system for mapping handwritten answer sheet pages to exam questions.

Your task: Given a question paper and answer sheets, determine which answer sheet pages contain the answer to each question.

Rules:
- Use 0-based page INDICES for the answer sheet pages (not page labels/numbers written on the pages).
- If a student's answer for one question spans multiple pages, include all page indices.
- Apply the "Sandwich Rule": if a question appears on pages 2 and 5, and no other question is identified on pages 3 and 4, infer that pages 3-4 also belong to that question.
- If a question has no answer at all, map it to an empty array [].
- Assign a confidence score (0–1) for each mapping.
- Add notes for ambiguous or unusual cases.
- Students may answer questions out of order. Look at the actual content, not just the position.
- Look for question numbers, labels, or headings written by the student.
- Return ONLY valid JSON.`;
function buildPanopticonUserPrompt(questionIds) {
  // Build the example using the actual question IDs to anchor the model on
  // the real key format. Previously this used "Q1","Q2","Q3" placeholders,
  // which caused Gemini to prefix every key with `Q` regardless of input.
  const sampleIds = questionIds.slice(0, Math.min(3, questionIds.length));
  const routingExample = Object.fromEntries(
    sampleIds.map((id, i) => [id, i === 2 ? [3, 4] : i === 0 ? [0, 1] : [2]])
  );
  const confidenceExample = Object.fromEntries(
    sampleIds.map((id, i) => [id, [0.95, 0.88, 0.92][i] ?? 0.9])
  );
  const notesExample =
    sampleIds.length >= 2
      ? { [sampleIds[0]]: "Answer spans 2 pages", [sampleIds[1]]: "Partial answer only" }
      : {};
  return `Map each exam question to the answer sheet page(s) that contain the student's response.

Questions to map: ${JSON.stringify(questionIds)}

CRITICAL: Use the EXACT question IDs from the list above as the keys in your response. Do NOT add prefixes like "Q" or change the format in any way. If a question ID is "1", the key must be "1", not "Q1".

Return a JSON object with this exact schema (example uses your actual question IDs):
{
  "routing_map": ${JSON.stringify(routingExample, null, 2)},
  "confidence": ${JSON.stringify(confidenceExample, null, 2)},
  "notes": ${JSON.stringify(notesExample, null, 2)}
}

The images are provided in this order:
1. QUESTION PAPER pages (for reference)
2. ANSWER SHEET pages (to be mapped)

Map answer sheet pages using 0-based indices relative to the ANSWER SHEET images only (not the question paper pages).`;
}
/**
 * Parse and validate Panopticon scouting response.
 */
function parsePanopticonResponse(text, questionIds, totalAnswerPages) {
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed.routing_map) {
    throw new Error("Missing routing_map in Panopticon response.");
  }
  // Normalize keys: Gemini sometimes prefixes IDs with "Q" (e.g. returns "Q5"
  // when the real question id is "5"). Remap any unknown key onto the matching
  // real id when we can find one via prefix/suffix stripping.
  const realIds = new Set(questionIds);
  const remap = (obj) => {
    if (!obj) return;
    for (const key of Object.keys(obj)) {
      if (realIds.has(key)) continue;
      // Try stripping common prefixes
      const stripped = key.replace(/^[Qq]\.?\s*/, "");
      if (realIds.has(stripped) && !(stripped in obj)) {
        obj[stripped] = obj[key];
        delete obj[key];
      }
    }
  };
  remap(parsed.routing_map);
  remap(parsed.confidence);
  remap(parsed.notes);
  // Apply sandwich rule
  for (const qId of questionIds) {
    const pages = parsed.routing_map[qId];
    if (!pages || pages.length < 2) continue;
    const sorted = [...pages].sort((a, b) => a - b);
    const filled = [];
    for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) {
      // Only fill gaps that aren't claimed by another question
      const claimedByOther = questionIds.some(
        (otherId) => otherId !== qId && parsed.routing_map[otherId]?.includes(i)
      );
      if (!claimedByOther) {
        filled.push(i);
      }
    }
    parsed.routing_map[qId] = filled;
  }
  // Drop out-of-range page indices. The model occasionally hallucinates pages
  // that don't exist; previously this threw and failed the whole submission.
  // Now we filter and warn so the rest of the mapping is preserved.
  for (const [qId, pages] of Object.entries(parsed.routing_map)) {
    const valid = pages.filter((p) => p >= 0 && p < totalAnswerPages);
    if (valid.length !== pages.length) {
      const dropped = pages.filter((p) => !valid.includes(p));
      console.warn(
        `[panopticon] Dropped out-of-range page indices ${JSON.stringify(dropped)} ` +
          `for ${qId} (total answer pages: ${totalAnswerPages}).`
      );
    }
    parsed.routing_map[qId] = valid;
  }
  return parsed;
}
//# sourceMappingURL=panopticon.js.map
