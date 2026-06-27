/**
 * `questionSubmissionRepo` (SDK-LAYERS-PLAN §4.1, domain plan autograde.md).
 *
 *   list(submissionId)     — over listQuestionSubmissions → QuestionSubmissionView[]
 *   gradeManual(input)     — gradeQuestion(mode:'manual') (authoritySensitive ⚷)
 *   retry(input)           — gradeQuestion(mode:'retry')
 *   gradeAi(input)         — gradeQuestion(mode:'ai')
 *   computeEffectiveScore  — manualOverride?.score ?? evaluation?.score
 *   isNeedingReview(qs)    — gradingStatus==='needs_review'
 *   computeConfidenceBand  — low/mid/high vs thresholds (UI HITL badge)
 *
 * Per-entity repo — imports `api` + `@levelup/domain` ONLY; never a sibling repo
 * (R6). The server owns score authority (⚷); the repo only submits raw inputs.
 */
import type { ApiClient, GradeQuestionResponse, QuestionSubmissionView } from "./api-types.js";

/** low/mid/high confidence band for the UI HITL badge. */
export type ConfidenceBand = "low" | "mid" | "high";

/** Minimal question-submission shape the derived helpers read. */
interface QuestionSubmissionLike {
  gradingStatus?: string;
  evaluation?: { score?: number; confidence?: number } | null;
  manualOverride?: { score?: number } | null;
}

/** Confidence thresholds (mirror EvaluationConfidenceConfig defaults — ⚷ server-owned). */
export interface ConfidenceThresholds {
  confidenceThreshold: number;
  autoApproveThreshold: number;
}
const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  confidenceThreshold: 0.7,
  autoApproveThreshold: 0.9,
};

export interface GradeManualInput {
  submissionId: string;
  questionId: string;
  score: number;
  feedback?: string;
}
export interface RetryGradingInput {
  submissionId: string;
  questionIds?: string[];
}
export interface GradeAiInput {
  submissionId: string;
  questionId: string;
}

export interface QuestionSubmissionRepo {
  list(submissionId: string): Promise<QuestionSubmissionView[]>;
  recordManualGrade(input: GradeManualInput): Promise<GradeQuestionResponse>;
  recordRetryGrade(input: RetryGradingInput): Promise<GradeQuestionResponse>;
  recordAiGrade(input: GradeAiInput): Promise<GradeQuestionResponse>;

  // derived (computed once; no wire call)
  computeEffectiveScore(qs: QuestionSubmissionLike): number | null;
  isNeedingReview(qs: QuestionSubmissionLike): boolean;
  computeConfidenceBand(
    qs: QuestionSubmissionLike,
    thresholds?: ConfidenceThresholds
  ): ConfidenceBand;
}

export function createQuestionSubmissionRepo(api: ApiClient): QuestionSubmissionRepo {
  const ag = api.autograde;

  return {
    list: async (submissionId) =>
      (await ag.listQuestionSubmissions({ submissionId: submissionId as never }))
        .questionSubmissions,

    recordManualGrade: (input) =>
      ag.gradeQuestion({
        mode: "manual",
        submissionId: input.submissionId as never,
        questionId: input.questionId as never,
        score: input.score,
        feedback: input.feedback,
      }),
    recordRetryGrade: (input) =>
      ag.gradeQuestion({
        mode: "retry",
        submissionId: input.submissionId as never,
        questionIds: input.questionIds as never,
      }),
    recordAiGrade: (input) =>
      ag.gradeQuestion({
        mode: "ai",
        submissionId: input.submissionId as never,
        questionId: input.questionId as never,
      }),

    computeEffectiveScore: (qs) => qs.manualOverride?.score ?? qs.evaluation?.score ?? null,
    isNeedingReview: (qs) => qs.gradingStatus === "needs_review",
    computeConfidenceBand: (qs, thresholds = DEFAULT_THRESHOLDS) => {
      const c = qs.evaluation?.confidence;
      if (typeof c !== "number") return "low";
      if (c >= thresholds.autoApproveThreshold) return "high";
      if (c >= thresholds.confidenceThreshold) return "mid";
      return "low";
    },
  };
}
