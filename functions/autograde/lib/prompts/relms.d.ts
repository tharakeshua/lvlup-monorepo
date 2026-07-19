/**
 * RELMS dynamic evaluation prompt builder.
 *
 * Constructs a per-question grading prompt that includes the question text,
 * rubric criteria, and enabled evaluation dimensions from the tenant's settings.
 */
import { ExamQuestion, UnifiedRubric, EvaluationDimension } from "../types";
export declare const RELMS_SYSTEM_PROMPT =
  "You are RELMS, an expert exam answer evaluator. You grade student answers with precision, fairness, and structured feedback.\n\nCore principles:\n- Be accurate: Award marks strictly based on rubric criteria.\n- Be fair: Give credit for partial correctness. Recognize valid alternative approaches.\n- Be constructive: Provide actionable feedback that helps the student learn.\n- Be structured: Use the provided dimensions to organize feedback.\n- Never hallucinate: If the student's answer is blank or unreadable, score 0 and note it.\n- Return ONLY valid JSON. No additional text.";
/**
 * Build a dynamic RELMS user prompt from question data and rubric.
 */
export declare function buildRELMSUserPrompt(
  question: ExamQuestion,
  rubric: UnifiedRubric,
  enabledDimensions: EvaluationDimension[]
): string;
export interface RELMSResult {
  rubric_score: number;
  max_rubric_score: number;
  confidence_score: number;
  rubric_breakdown: Array<{
    criterion: string;
    awarded: number;
    max: number;
    feedback?: string;
  }>;
  structuredFeedback?: Record<
    string,
    Array<{
      issue: string;
      whyItMatters?: string;
      howToFix: string;
      severity: "critical" | "major" | "minor";
      relatedConcept?: string;
    }>
  >;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  summary?: {
    keyTakeaway: string;
    overallComment: string;
  };
  mistake_classification?: string;
}
/**
 * Parse and validate RELMS grading response.
 */
export declare function parseRELMSResponse(text: string, maxMarks: number): RELMSResult;
