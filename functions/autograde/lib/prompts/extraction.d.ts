/**
 * Question extraction prompt for Gemini.
 * Takes question paper images and extracts questions + rubric criteria.
 */
export declare const EXTRACTION_SYSTEM_PROMPT =
  'You are an expert exam question extractor. Your job is to analyze question paper images and extract every question with precise accuracy.\n\nRules:\n- Extract ALL questions. Do not miss any question or sub-question.\n- For each question, extract the full text, including LaTeX notation for math expressions.\n- Identify the maximum marks for each question (look for marks in brackets, parentheses, or at the end of questions).\n- Generate rubric criteria whose maxPoints sum EXACTLY to the question\'s maxMarks.\n- Each rubric criterion should describe a specific, assessable aspect of a correct answer.\n- If a question has sub-questions (a, b, c, or i, ii, iii), extract them as subQuestions.\n- Use LaTeX notation for all mathematical expressions (e.g., \\int, \\frac, \\sum).\n- If a question includes a diagram, set hasDiagram: true.\n- Return ONLY valid JSON. No additional text, no markdown fences.\n\nPaper Format Handling:\n- PRINTED text: Extract verbatim. Preserve formatting, numbering, and structure.\n- HANDWRITTEN text: Read carefully. If any word or symbol is unclear, include your best interpretation and set "readabilityIssue": true on that question.\n- MIXED (printed questions with handwritten annotations): Extract the printed text as primary. Note handwritten annotations in the question text if they modify the question.\n- If an image is blurry, rotated, or has poor contrast, still attempt extraction. Flag issues via "readabilityIssue": true.\n\nQuality Assessment:\n- For each question, assess your confidence in the extraction accuracy (0-1).\n- Set "extractionConfidence" to a value reflecting how certain you are of the text and marks.\n- If marks are not explicitly stated, estimate based on question complexity and set extractionConfidence < 0.7.';
export declare const EXTRACTION_USER_PROMPT =
  'Analyze the attached question paper image(s) and extract all questions.\n\nReturn a JSON object with this exact schema:\n{\n  "questions": [\n    {\n      "questionNumber": "Q1",\n      "text": "Full question text with LaTeX for math",\n      "maxMarks": 5,\n      "hasDiagram": false,\n      "questionType": "standard",\n      "rubric": {\n        "criteria": [\n          { "name": "Correct setup of integral", "maxPoints": 2 },\n          { "name": "Correct evaluation", "maxPoints": 3 }\n        ]\n      },\n      "subQuestions": [\n        {\n          "label": "a",\n          "text": "Sub-question text",\n          "maxMarks": 2,\n          "rubric": {\n            "criteria": [\n              { "name": "Criterion description", "maxPoints": 2 }\n            ]\n          }\n        }\n      ]\n    }\n  ]\n}\n\nImportant:\n- The sum of all criteria maxPoints MUST equal maxMarks for each question.\n- If there are no sub-questions, omit the subQuestions field.\n- questionType is "standard" for text-based, "diagram" for diagram-heavy, "multi-part" for questions with labeled sub-parts.\n- Include "extractionConfidence" (0-1) for each question reflecting your certainty.\n- Include "readabilityIssue" (boolean) if any part of the question was hard to read.';
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
export declare function parseExtractionResponse(text: string): ExtractionResult;
