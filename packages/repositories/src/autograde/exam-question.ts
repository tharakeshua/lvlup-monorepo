/**
 * `examQuestionRepo` (SDK-LAYERS-PLAN §4.1, domain plan autograde.md).
 *
 *   list(examId)               — over listQuestions → ExamQuestionView[]
 *   recordReExtraction(examId, qNumber) — over extractQuestions(mode:'single')
 *   computeRubricCriteriaSum(q)— derived: sum of rubric criterion points
 *   isRubricMatchingMaxMarks(q)— publish pre-check helper (sum == maxMarks)
 *   isAuthoringView(q)         — guidance fields present → role-gated authoring view
 *
 * Per-entity repo — imports `api` + `@levelup/domain` ONLY; never a sibling repo
 * (R6). Reads only the answer-key-stripped projection (the server strips
 * `evaluatorGuidance`/`modelAnswer` for non-authoring roles — §6.7).
 */
import type {
  ApiClient,
  ExamQuestionView,
  ExtractQuestionsResponse,
  SaveExamQuestionInput,
  SaveExamQuestionResponse,
} from "./api-types.js";

/** Minimal question shape the derived helpers read. */
interface QuestionLike {
  maxMarks?: number;
  rubric?: {
    criteria?: { maxScore?: number; maxPoints?: number; points?: number }[];
    modelAnswer?: unknown;
    evaluatorGuidance?: unknown;
  } | null;
}

export interface ExamQuestionRepo {
  list(examId: string): Promise<ExamQuestionView[]>;
  saveQuestion(input: SaveExamQuestionInput): Promise<SaveExamQuestionResponse>;
  recordReExtraction(examId: string, questionNumber: string): Promise<ExtractQuestionsResponse>;

  // derived (computed once; no wire call)
  computeRubricCriteriaSum(q: QuestionLike): number;
  isRubricMatchingMaxMarks(q: QuestionLike): boolean;
  isAuthoringView(q: QuestionLike): boolean;
}

export function createExamQuestionRepo(api: ApiClient): ExamQuestionRepo {
  const ag = api.autograde;

  const sum = (q: QuestionLike): number =>
    (q.rubric?.criteria ?? []).reduce(
      (acc, c) => acc + (c.maxScore ?? c.maxPoints ?? c.points ?? 0),
      0
    );

  return {
    list: async (examId) => (await ag.listQuestions({ examId: examId as never })).questions,
    saveQuestion: (input) => ag.saveExamQuestion(input as never),
    recordReExtraction: (examId, questionNumber) =>
      ag.extractQuestions({ examId: examId as never, mode: "single", questionNumber }),

    computeRubricCriteriaSum: (q) => sum(q),
    isRubricMatchingMaxMarks: (q) =>
      typeof q.maxMarks === "number" ? sum(q) === q.maxMarks : false,
    isAuthoringView: (q) =>
      q.rubric?.modelAnswer !== undefined || q.rubric?.evaluatorGuidance !== undefined,
  };
}
