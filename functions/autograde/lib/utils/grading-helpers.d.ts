import {
  UnifiedRubric,
  QuestionSubmission,
  ExamQuestion,
  EvaluationFeedbackRubric,
  EvaluationDimension,
} from "../types";
/**
 * Calculate letter grade from percentage.
 */
export declare function calculateGrade(percentage: number): string;
/**
 * Resolve rubric chain: question → exam evaluation settings → tenant defaults.
 */
export declare function resolveRubric(
  question: ExamQuestion,
  examEvalSettings?: EvaluationFeedbackRubric | null,
  tenantDefaultSettings?: EvaluationFeedbackRubric | null
): {
  rubric: UnifiedRubric;
  dimensions: EvaluationDimension[];
};
/**
 * Calculate submission summary from all question submissions.
 */
export declare function calculateSubmissionSummary(
  questionSubmissions: QuestionSubmission[],
  totalQuestions: number
): {
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: string;
  questionsGraded: number;
  totalQuestions: number;
};
