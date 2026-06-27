import { Timestamp } from "firebase-admin/firestore";
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
export function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}

/**
 * Resolve rubric chain: question → exam evaluation settings → tenant defaults.
 */
export function resolveRubric(
  question: ExamQuestion,
  examEvalSettings?: EvaluationFeedbackRubric | null,
  tenantDefaultSettings?: EvaluationFeedbackRubric | null
): { rubric: UnifiedRubric; dimensions: EvaluationDimension[] } {
  const rubric = question.rubric;

  // Resolve enabled dimensions from evaluation settings
  const evalSettings = examEvalSettings ?? tenantDefaultSettings;
  const dimensions = evalSettings?.enabledDimensions?.filter((d) => d.enabled) ?? [];

  return { rubric, dimensions };
}

/**
 * Calculate submission summary from all question submissions.
 */
export function calculateSubmissionSummary(
  questionSubmissions: QuestionSubmission[],
  totalQuestions: number
): {
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: string;
  questionsGraded: number;
  totalQuestions: number;
} {
  let totalScore = 0;
  let maxScore = 0;
  let questionsGraded = 0;

  for (const qs of questionSubmissions) {
    const isGraded =
      qs.gradingStatus === "graded" ||
      qs.gradingStatus === "manual" ||
      qs.gradingStatus === "overridden" ||
      qs.gradingStatus === "needs_review";

    if (!isGraded) continue;

    questionsGraded++;

    if (qs.manualOverride && (qs.gradingStatus === "overridden" || qs.gradingStatus === "manual")) {
      totalScore += qs.manualOverride.score;
      maxScore += qs.evaluation?.maxScore ?? qs.manualOverride.score;
    } else if (qs.evaluation) {
      // needs_review questions carry a tentative AI score; include it. The
      // teacher's final review will overwrite via the manual override path.
      totalScore += qs.evaluation.score;
      maxScore += qs.evaluation.maxScore;
    }
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const grade = calculateGrade(percentage);

  return {
    totalScore,
    maxScore,
    percentage,
    grade,
    questionsGraded,
    totalQuestions,
  };
}
