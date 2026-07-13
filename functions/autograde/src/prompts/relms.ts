/**
 * RELMS dynamic evaluation prompt builder.
 *
 * Constructs a per-question grading prompt that includes the question text,
 * rubric criteria, and enabled evaluation dimensions from the tenant's settings.
 */

import { ExamQuestion, UnifiedRubric, EvaluationDimension } from "../types";

export const RELMS_SYSTEM_PROMPT = `You are RELMS, an expert exam answer evaluator. You grade student answers with precision, fairness, and structured feedback.

Core principles:
- Be accurate: Award marks strictly based on rubric criteria.
- Be fair: Give credit for partial correctness. Recognize valid alternative approaches.
- Be constructive: Provide actionable feedback that helps the student learn.
- Be structured: Use the provided dimensions to organize feedback.
- Never hallucinate: If the student's answer is blank or unreadable, score 0 and note it.
- Return ONLY valid JSON. No additional text.`;

/**
 * Build a dynamic RELMS user prompt from question data and rubric.
 */
export function buildRELMSUserPrompt(
  question: ExamQuestion,
  rubric: UnifiedRubric,
  enabledDimensions: EvaluationDimension[]
): string {
  const criteriaBlock =
    rubric.criteria
      ?.map(
        (c: { name: string; description?: string; maxPoints: number }, i: number) =>
          `  ${i + 1}. ${c.description ?? c.name} [${c.maxPoints} marks]`
      )
      .join("\n") ?? "  (No criteria defined)";

  const sortedDimensions = [...enabledDimensions].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.priority] - order[b.priority];
  });

  const dimensionsBlock =
    sortedDimensions.length > 0
      ? sortedDimensions
          .map(
            (d) =>
              `  - **${d.name}** [${d.priority}]: ${d.description}\n    Guidance: ${d.promptGuidance}\n    Expected feedback items: ${d.expectedFeedbackCount ?? "any"}`
          )
          .join("\n")
      : "  (No dimensions configured — provide general feedback)";

  const guidanceBlock = rubric.evaluatorGuidance
    ? `\nAdditional evaluator guidance from the teacher:\n${rubric.evaluatorGuidance}\n`
    : "";

  const modelAnswerBlock = rubric.modelAnswer
    ? `\nModel answer (for reference, do not penalize valid alternatives):\n${rubric.modelAnswer}\n`
    : "";

  return `Grade the student's answer for the following question.

## Question
${question.text}

**Maximum Marks:** ${question.maxMarks}

## Rubric Criteria
${criteriaBlock}

## Feedback Dimensions
${dimensionsBlock}
${guidanceBlock}${modelAnswerBlock}
## Grading Instructions
1. Examine the student's handwritten answer in the attached image(s).
2. Award marks for EACH rubric criterion based on what the student wrote.
3. For each enabled feedback dimension, provide structured feedback items.
4. Classify the primary mistake type if any.
5. Provide strengths, weaknesses, and a key takeaway.

## Required Output Format (JSON)
{
  "rubric_score": <number>,
  "max_rubric_score": ${question.maxMarks},
  "confidence_score": <0-1>,
  "rubric_breakdown": [
    { "criterion": "<description>", "awarded": <number>, "max": <number>, "feedback": "<brief explanation>" }
  ],
  "structuredFeedback": {
${sortedDimensions.map((d) => `    "${d.id}": [{ "issue": "...", "whyItMatters": "...", "howToFix": "...", "severity": "critical|major|minor" }]`).join(",\n") || '    "general": [{ "issue": "...", "howToFix": "...", "severity": "..." }]'}
  },
  "strengths": ["..."],
  "weaknesses": ["..."],
  "missingConcepts": ["..."],
  "summary": {
    "keyTakeaway": "...",
    "overallComment": "..."
  },
  "mistake_classification": "Conceptual|Silly Error|Knowledge Gap|None"
}`;
}

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
export function parseRELMSResponse(text: string, maxMarks: number): RELMSResult {
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();
  const parsed = JSON.parse(cleaned) as RELMSResult;

  if (typeof parsed.rubric_score !== "number") {
    throw new Error("Missing rubric_score in RELMS response.");
  }

  // Clamp score to valid range
  parsed.rubric_score = Math.max(0, Math.min(parsed.rubric_score, maxMarks));

  // Ensure arrays exist
  parsed.strengths = parsed.strengths ?? [];
  parsed.weaknesses = parsed.weaknesses ?? [];
  parsed.missingConcepts = parsed.missingConcepts ?? [];

  return parsed;
}
