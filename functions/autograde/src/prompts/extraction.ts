/**
 * Question extraction prompt for Gemini.
 * Takes question paper images and extracts questions + rubric criteria.
 */

export const EXTRACTION_SYSTEM_PROMPT = `You are an expert exam question extractor. Your job is to analyze question paper images and extract every question with precise accuracy.

Rules:
- Extract ALL questions. Do not miss any question or sub-question.
- For each question, extract the full text, including LaTeX notation for math expressions.
- Identify the maximum marks for each question (look for marks in brackets, parentheses, or at the end of questions).
- Generate rubric criteria whose maxPoints sum EXACTLY to the question's maxMarks.
- Each rubric criterion should describe a specific, assessable aspect of a correct answer.
- If a question has sub-questions (a, b, c, or i, ii, iii), extract them as subQuestions.
- Use LaTeX notation for all mathematical expressions (e.g., \\int, \\frac, \\sum).
- If a question includes a diagram, set hasDiagram: true.
- Return ONLY valid JSON. No additional text, no markdown fences.

Paper Format Handling:
- PRINTED text: Extract verbatim. Preserve formatting, numbering, and structure.
- HANDWRITTEN text: Read carefully. If any word or symbol is unclear, include your best interpretation and set "readabilityIssue": true on that question.
- MIXED (printed questions with handwritten annotations): Extract the printed text as primary. Note handwritten annotations in the question text if they modify the question.
- If an image is blurry, rotated, or has poor contrast, still attempt extraction. Flag issues via "readabilityIssue": true.

Quality Assessment:
- For each question, assess your confidence in the extraction accuracy (0-1).
- Set "extractionConfidence" to a value reflecting how certain you are of the text and marks.
- If marks are not explicitly stated, estimate based on question complexity and set extractionConfidence < 0.7.`;

export const EXTRACTION_USER_PROMPT = `Analyze the attached question paper image(s) and extract all questions.

Return a JSON object with this exact schema:
{
  "questions": [
    {
      "questionNumber": "Q1",
      "text": "Full question text with LaTeX for math",
      "maxMarks": 5,
      "hasDiagram": false,
      "questionType": "standard",
      "rubric": {
        "criteria": [
          { "name": "Correct setup of integral", "maxPoints": 2 },
          { "name": "Correct evaluation", "maxPoints": 3 }
        ]
      },
      "subQuestions": [
        {
          "label": "a",
          "text": "Sub-question text",
          "maxMarks": 2,
          "rubric": {
            "criteria": [
              { "name": "Criterion description", "maxPoints": 2 }
            ]
          }
        }
      ]
    }
  ]
}

Important:
- The sum of all criteria maxPoints MUST equal maxMarks for each question.
- If there are no sub-questions, omit the subQuestions field.
- questionType is "standard" for text-based, "diagram" for diagram-heavy, "multi-part" for questions with labeled sub-parts.
- Include "extractionConfidence" (0-1) for each question reflecting your certainty.
- Include "readabilityIssue" (boolean) if any part of the question was hard to read.`;

export interface ExtractedCriterion {
  name: string;
  description?: string;
  maxPoints: number;
}

export interface ExtractedQuestion {
  questionNumber: string;
  text: string;
  maxMarks: number;
  hasDiagram: boolean;
  questionType?: "standard" | "diagram" | "multi-part";
  extractionConfidence?: number;
  readabilityIssue?: boolean;
  rubric: {
    criteria: ExtractedCriterion[];
  };
  subQuestions?: Array<{
    label: string;
    text: string;
    maxMarks: number;
    rubric?: {
      criteria: ExtractedCriterion[];
    };
  }>;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
}

/**
 * Parse and validate the extraction response from Gemini.
 */
export function parseExtractionResponse(text: string): ExtractionResult {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  let parsed: ExtractionResult;
  try {
    const raw: unknown = JSON.parse(cleaned);
    // Handle case where response is an array directly instead of { questions: [...] }
    if (Array.isArray(raw)) {
      parsed = { questions: raw as ExtractedQuestion[] };
    } else {
      parsed = raw as ExtractionResult;
    }
  } catch (err) {
    // Check if response appears truncated
    const trimmed = cleaned.trimEnd();
    if (!trimmed.endsWith("}") && !trimmed.endsWith("]")) {
      throw new Error(
        `Extraction response appears truncated (${cleaned.length} chars, ends with: "${trimmed.slice(-30)}"). ` +
          `This usually means maxOutputTokens is too low. Raw start: ${trimmed.slice(0, 200)}...`
      );
    }
    throw err;
  }

  // Log response structure for diagnostics
  const topKeys = Object.keys(parsed);
  console.log(
    `[parseExtractionResponse] Parsed keys: ${topKeys.join(", ")}. questions type: ${typeof parsed.questions}, isArray: ${Array.isArray(parsed.questions)}, length: ${Array.isArray(parsed.questions) ? parsed.questions.length : "N/A"}`
  );

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error(
      `No questions extracted from response. Top-level keys: [${topKeys.join(", ")}]. First 500 chars: ${cleaned.slice(0, 500)}`
    );
  }

  // Validate each question - skip invalid ones instead of throwing
  const validQuestions: ExtractedQuestion[] = [];
  for (const q of parsed.questions) {
    if (!q.text || !q.maxMarks || !q.rubric?.criteria?.length) {
      console.warn(
        `Skipping invalid question: ${q.questionNumber ?? "unknown"} — missing required fields (text: ${!!q.text}, maxMarks: ${q.maxMarks}, criteria: ${q.rubric?.criteria?.length ?? 0}).`
      );
      continue;
    }
    validQuestions.push(q);

    const criteriaSum = q.rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0);
    if (criteriaSum !== q.maxMarks) {
      // Auto-fix: adjust last criterion
      const diff = q.maxMarks - criteriaSum;
      if (q.rubric.criteria.length > 0) {
        const lastCriterion = q.rubric.criteria[q.rubric.criteria.length - 1];
        console.warn(
          `Extraction auto-fix: Question ${q.questionNumber} rubric criteria sum (${criteriaSum}) != maxMarks (${q.maxMarks}). ` +
            `Adjusting last criterion "${lastCriterion.name}" by ${diff > 0 ? "+" : ""}${diff} (${lastCriterion.maxPoints} -> ${lastCriterion.maxPoints + diff}).`
        );
        q.rubric.criteria[q.rubric.criteria.length - 1].maxPoints += diff;
      }
    }
  }

  if (validQuestions.length === 0) {
    throw new Error("No valid questions extracted from response.");
  }

  return { questions: validQuestions };
}
