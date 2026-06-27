/**
 * `gradingReviewRepo` ⊕ — cross-entity VIEW repo (SDK-LAYERS-PLAN §4.1, §4.3
 * PC-14, domain plan autograde.md). Lives under `src/views/**` — the only
 * sanctioned composition surface (R6 exception, asserted by
 * repo-isolation.static.test.ts).
 *
 *   getReviewBundle(submissionId) → GradingReviewView
 *     Batched assembly of getSubmission + listQuestionSubmissions + listQuestions
 *     in ONE repo call, collapsing today's 3 separate client reads. Marks per-QS
 *     `effectiveScore`/`confidenceBand`/`rubricBreakdown` for the grading UI.
 *
 *   getExamGradingOverview(examId) → ExamGradingOverview
 *     getExam + listSubmissions + getExamAnalytics for the per-exam dashboard.
 *
 * Prefers a server composite (PC-14: getGradingReviewBundle / getExamGradingOverview)
 * — ONE call. Otherwise composes a SMALL FIXED set of batched reads (≤3), never an
 * O(N) per-question fan-out. Calls the injected api-client directly; never imports
 * sibling repo modules.
 */
import type {
  ApiClient,
  AutogradeNamespace,
  ExamAnalyticsView,
  ExamDetailView,
  ExamGradingOverview,
  ExamQuestionView,
  GradingReviewView,
  QuestionSubmissionView,
  SubmissionDetailView,
  SubmissionListView,
} from "../autograde/api-types.js";

/** A per-question grading row enriched with derived display fields. */
export interface GradedQuestionRow {
  questionSubmission: QuestionSubmissionView;
  question?: ExamQuestionView;
  effectiveScore: number | null;
  confidenceBand: "low" | "mid" | "high";
}

/** The shaped grading-review bundle the teacher UI consumes. */
export interface GradingReviewBundleView {
  submission: SubmissionDetailView;
  rows: GradedQuestionRow[];
}

export interface GradingReviewRepo {
  getReviewBundle(input: { submissionId: string }): Promise<GradingReviewBundleView>;
  getExamGradingOverview(input: { examId: string }): Promise<ExamGradingOverview>;
}

function hasReviewComposite(
  ag: AutogradeNamespace
): ag is AutogradeNamespace & {
  getGradingReviewBundle: NonNullable<AutogradeNamespace["getGradingReviewBundle"]>;
} {
  return typeof ag.getGradingReviewBundle === "function";
}
function hasOverviewComposite(
  ag: AutogradeNamespace
): ag is AutogradeNamespace & {
  getExamGradingOverview: NonNullable<AutogradeNamespace["getExamGradingOverview"]>;
} {
  return typeof ag.getExamGradingOverview === "function";
}

function effectiveScoreOf(qs: QuestionSubmissionView): number | null {
  const o = qs as {
    manualOverride?: { score?: number } | null;
    evaluation?: { score?: number } | null;
  };
  return o.manualOverride?.score ?? o.evaluation?.score ?? null;
}
function confidenceBandOf(qs: QuestionSubmissionView): "low" | "mid" | "high" {
  const c = (qs as { evaluation?: { confidence?: number } | null }).evaluation?.confidence;
  if (typeof c !== "number") return "low";
  if (c >= 0.9) return "high";
  if (c >= 0.7) return "mid";
  return "low";
}

function shapeBundle(raw: GradingReviewView): GradingReviewBundleView {
  const questionsById = new Map<string, ExamQuestionView>();
  for (const q of raw.questions) {
    const id = (q as { id?: string }).id;
    if (typeof id === "string") questionsById.set(id, q);
  }
  const rows: GradedQuestionRow[] = raw.questionSubmissions.map((qs) => {
    const questionId = (qs as { questionId?: string }).questionId;
    const question = typeof questionId === "string" ? questionsById.get(questionId) : undefined;
    const row: GradedQuestionRow = {
      questionSubmission: qs,
      effectiveScore: effectiveScoreOf(qs),
      confidenceBand: confidenceBandOf(qs),
    };
    if (question !== undefined) row.question = question;
    return row;
  });
  return { submission: raw.submission, rows };
}

export function createGradingReviewRepo(api: ApiClient): GradingReviewRepo {
  const ag = api.autograde;

  return {
    getReviewBundle: async ({ submissionId }) => {
      // Preferred: ONE server composite call (PC-14).
      if (hasReviewComposite(ag)) {
        const raw = await ag.getGradingReviewBundle({ submissionId: submissionId as never });
        return shapeBundle(raw);
      }
      // Fallback: a SMALL FIXED set of batched reads (≤3) — no per-question fan-out.
      const submission = (await ag.getSubmission({
        id: submissionId as never,
      })) as SubmissionDetailView;
      const examId = (submission as { examId?: string }).examId;
      const questionSubmissions = (
        await ag.listQuestionSubmissions({ submissionId: submissionId as never })
      ).questionSubmissions;
      const questions =
        typeof examId === "string"
          ? (await ag.listQuestions({ examId: examId as never })).questions
          : [];
      return shapeBundle({ submission, questionSubmissions, questions });
    },

    getExamGradingOverview: async ({ examId }) => {
      // Preferred: ONE server composite call (PC-14).
      if (hasOverviewComposite(ag)) {
        return ag.getExamGradingOverview({ examId: examId as never });
      }
      // Fallback: a SMALL FIXED set of batched reads (≤3).
      const exam = (await ag.getExam({ id: examId as never })) as ExamDetailView;
      const submissions: SubmissionListView[] = (
        await ag.listSubmissions({ filter: { examId: examId as never } })
      ).items;
      let analytics: ExamAnalyticsView | null = null;
      try {
        analytics = await ag.getExamAnalytics({ examId: examId as never });
      } catch {
        analytics = null; // analytics doc may not exist yet (pre-grading).
      }
      return { exam, submissions, analytics };
    },
  };
}
