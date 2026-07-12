/**
 * `examRepo` (SDK-LAYERS-PLAN §4.1, domain plan autograde.md §Repositories).
 *
 *   list(filter?)              — paginated, opaque cursor (over listExams)
 *   paginate(filter?)          — cursor-managing PageBag walker
 *   get(id)                    — single getExam, shaped ExamDetailView
 *   save(input)                — metadata only (D2: never injects tenantId)
 *   recordExtraction(input)    — AI question extraction (authoritySensitive)
 *   releaseResults(...)        — explicit lifecycle verb (DX-5; carved out of saveExam)
 *   canTransition(from,to)     — pure ALLOWED_TRANSITIONS.exam read (UX)
 *   canPublish(exam,questions) — pre-mirror of server validatePublish
 *   canReleaseResults(exam)    — status ∈ {grading, results_released}
 *   computePassRate / computeGradedPct — UI computed fields over stats
 *
 * Per-entity repo — imports `api` + `@levelup/domain` ONLY; never a sibling repo
 * (R6). The server is the authority; pre-checks are UX-only.
 */
import { canTransition } from "@levelup/domain";
import type {
  ApiClient,
  ExamDetailView,
  ExamFilter,
  ExamListView,
  ExamQuestionView,
  ExamStats,
  ExtractQuestionsRequest,
  ExtractQuestionsResponse,
  ListExamsRequest,
  PageResponse,
  ReleaseResultsResponse,
  SaveExamInput,
  SaveResponse,
} from "./api-types.js";
import { listOnce, paginate, type PageBag } from "./paginate.js";

/** The publish-readiness pre-check verdict (mirrors server `validatePublish`). */
export interface PublishCheck {
  ok: boolean;
  reasons: string[];
}

/** Minimal exam shape the derived pre-checks read. */
interface ExamLike {
  status?: string;
}

/** Minimal question shape the publish pre-check reads (rubric-sum check). */
interface QuestionLike {
  maxMarks?: number;
  rubric?: { criteria?: { points?: number; maxPoints?: number }[] } | null;
}

export interface ExamRepo {
  list(filter?: ExamFilter): Promise<PageResponse<ExamListView>>;
  paginate(filter?: ExamFilter): Promise<PageBag<ExamListView>>;
  get(id: string): Promise<ExamDetailView>;
  save(input: SaveExamInput): Promise<SaveResponse>;
  recordExtraction(input: ExtractQuestionsRequest): Promise<ExtractQuestionsResponse>;
  releaseResults(input: { examId: string; classIds?: string[] }): Promise<ReleaseResultsResponse>;

  // pre-checks (pure reads of ALLOWED_TRANSITIONS — no wire call)
  canTransition(from: string, to: string): boolean;
  canPublish(exam: ExamLike, questions: readonly QuestionLike[]): PublishCheck;
  canReleaseResults(exam: ExamLike): boolean;

  // derived (computed once; server is the authority)
  computePassRate(stats: Pick<ExamStats, "passRate"> | null | undefined): number;
  computeGradedPct(
    stats: Pick<ExamStats, "totalSubmissions" | "gradedSubmissions"> | null | undefined
  ): number;
}

function rubricCriteriaSum(q: QuestionLike): number {
  const criteria = q.rubric?.criteria ?? [];
  return criteria.reduce((sum, c) => sum + (c.maxPoints ?? c.points ?? 0), 0);
}

/** Canonical exam statuses — used to fan-out when unconstrained listExams fails
 *  response validation on legacy `completed` rows still present in prod data. */
const EXAM_STATUS_FANOUT = [
  "draft",
  "question_paper_uploaded",
  "question_paper_extracted",
  "published",
  "grading",
  "results_released",
  "archived",
] as const;

export function createExamRepo(api: ApiClient): ExamRepo {
  const ag = api.autograde;

  const toReq = (filter: ExamFilter = {}): ListExamsRequest => {
    const next: ListExamsRequest = {};
    const f: Record<string, unknown> = {};
    if (filter.status) f.status = filter.status;
    if (filter.classId) f.classId = filter.classId;
    if (filter.academicSessionId) f.academicSessionId = filter.academicSessionId;
    if (filter.subject) f.subject = filter.subject;
    if (filter.linkedSpaceId) f.linkedSpaceId = filter.linkedSpaceId;
    if (Object.keys(f).length > 0) next.filter = f as ListExamsRequest["filter"];
    return next;
  };

  const listOnceSafe = async (filter: ExamFilter = {}): Promise<PageResponse<ExamListView>> => {
    try {
      return await listOnce<ListExamsRequest, ExamListView>(
        (req) => ag.listExams(req),
        toReq(filter),
      );
    } catch (err) {
      // Live listExams response-validates the page; legacy status `completed`
      // still present in some tenants fails unconstrained reads. Fan-out by
      // canonical status so admin/teacher overview still loads.
      if (filter.status) throw err;
      const pages = await Promise.all(
        EXAM_STATUS_FANOUT.map((status) =>
          listOnce<ListExamsRequest, ExamListView>(
            (req) => ag.listExams(req),
            toReq({ ...filter, status }),
          ).catch(() => ({ items: [] as ExamListView[], nextCursor: null })),
        ),
      );
      const seen = new Set<string>();
      const items: ExamListView[] = [];
      for (const page of pages) {
        for (const item of page.items) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          items.push(item);
        }
      }
      return { items, nextCursor: null };
    }
  };

  return {
    list: (filter = {}) => listOnceSafe(filter),
    paginate: (filter = {}) =>
      paginate<ListExamsRequest, ExamListView>((req) => ag.listExams(req), toReq(filter)),
    get: (id) => ag.getExam({ id: id as never }),
    save: (input) => ag.saveExam(input),
    recordExtraction: (input) => ag.extractQuestions(input),
    releaseResults: (input) =>
      ag.releaseResults({ examId: input.examId as never, classIds: input.classIds as never }),

    canTransition: (from, to) => canTransition("exam", from as never, to),

    canPublish: (exam, questions) => {
      const reasons: string[] = [];
      // status gate (UX mirror of server assertTransition).
      if (!canTransition("exam", (exam.status ?? "draft") as never, "published")) {
        reasons.push("exam is not in question_paper_extracted status");
      }
      if (questions.length === 0) {
        reasons.push("exam has no questions");
      }
      // each question's rubric criteria must sum to its maxMarks.
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]!;
        const max = q.maxMarks;
        if (typeof max === "number") {
          const sum = rubricCriteriaSum(q);
          if (sum !== max) {
            reasons.push(`question ${i + 1}: rubric sum ${sum} != maxMarks ${max}`);
          }
        }
      }
      return { ok: reasons.length === 0, reasons };
    },

    // Mirrors the §3.6 `grading → results_released` edge — a pure read of
    // ALLOWED_TRANSITIONS (no wire call). True only when the exam can still
    // transition INTO results_released (i.e. status === 'grading'); an exam
    // already in results_released cannot be released again.
    canReleaseResults: (exam) =>
      canTransition("exam", (exam.status ?? "draft") as never, "results_released"),

    computePassRate: (stats) => stats?.passRate ?? 0,
    computeGradedPct: (stats) => {
      const total = stats?.totalSubmissions ?? 0;
      const graded = stats?.gradedSubmissions ?? 0;
      return total > 0 ? Math.round((graded / total) * 100) : 0;
    },
  };
}

// (kept exported so the publish pre-check helper is unit-testable.)
export { rubricCriteriaSum as _rubricCriteriaSum };
export type { ExamQuestionView };
