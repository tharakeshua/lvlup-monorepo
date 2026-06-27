/**
 * `submissionRepo` (SDK-LAYERS-PLAN §4.1, domain plan autograde.md).
 *
 *   list(filter, cursor?)  — over listSubmissions; N+1 collapse: server pre-joins
 *                            studentName/rollNumber/classId (no per-row fan-out)
 *   paginate(filter)       — cursor-managing PageBag walker
 *   get(id)                — over getSubmission → SubmissionDetailView
 *   upload(input)          — over uploadAnswerSheets (single canonical ingestion;
 *                            scanner-rn calls this exact method)
 *   canTransition(from,to) — pure ALLOWED_TRANSITIONS.submission read (UX)
 *   isResultVisible(sub,r) — UX gate (sub.resultsReleased || role==='teacher')
 *   computePipelinePhase   — UI grouping bucket
 *   computeProgressPct     — from summary.questionsGraded / totalQuestions
 *
 * Per-entity repo — imports `api` + `@levelup/domain` ONLY; never a sibling repo
 * (R6). The server enforces the result-visibility gate; this is UX-only.
 */
import { canTransition } from "@levelup/domain";
import type {
  ApiClient,
  ListSubmissionsRequest,
  PageResponse,
  SubmissionDetailView,
  SubmissionFilter,
  SubmissionListView,
  UploadAnswerSheetsRequest,
  UploadAnswerSheetsResponse,
} from "./api-types.js";
import { listOnce, paginate, type PageBag } from "./paginate.js";

/** UI pipeline-phase buckets the dashboard groups submissions into. */
export type PipelinePhase = "ingest" | "scouting" | "grading" | "review" | "failed" | "done";

/** Minimal submission shape the derived pre-checks read. */
interface SubmissionLike {
  pipelineStatus?: string;
  resultsReleased?: boolean;
  summary?: { questionsGraded?: number; totalQuestions?: number } | null;
}

export interface SubmissionRepo {
  list(filter: SubmissionFilter): Promise<PageResponse<SubmissionListView>>;
  paginate(filter: SubmissionFilter): Promise<PageBag<SubmissionListView>>;
  get(id: string): Promise<SubmissionDetailView>;
  upload(input: UploadAnswerSheetsRequest): Promise<UploadAnswerSheetsResponse>;

  // pre-checks (pure reads — no wire call)
  canTransition(from: string, to: string): boolean;
  isResultVisible(sub: SubmissionLike, role: string): boolean;

  // derived (computed once)
  computePipelinePhase(status: string | undefined): PipelinePhase;
  computeProgressPct(sub: SubmissionLike): number;
}

const PHASE_MAP: Record<string, PipelinePhase> = {
  uploaded: "ingest",
  scouting: "scouting",
  scouting_failed: "failed",
  scouting_complete: "scouting",
  grading: "grading",
  grading_partial: "grading",
  grading_failed: "failed",
  grading_complete: "grading",
  finalization_failed: "failed",
  ready_for_review: "review",
  reviewed: "done",
  manual_review_needed: "review",
  failed: "failed",
};

export function createSubmissionRepo(api: ApiClient): SubmissionRepo {
  const ag = api.autograde;

  return {
    list: (filter) =>
      listOnce<ListSubmissionsRequest, SubmissionListView>((req) => ag.listSubmissions(req), {
        filter,
      }),
    paginate: (filter) =>
      paginate<ListSubmissionsRequest, SubmissionListView>((req) => ag.listSubmissions(req), {
        filter,
      }),
    get: (id) => ag.getSubmission({ id: id as never }),
    upload: (input) => ag.uploadAnswerSheets(input),

    canTransition: (from, to) => canTransition("submission", from as never, to),
    isResultVisible: (sub, role) => sub.resultsReleased === true || role === "teacher",

    computePipelinePhase: (status) => (status ? (PHASE_MAP[status] ?? "ingest") : "ingest"),
    computeProgressPct: (sub) => {
      const total = sub.summary?.totalQuestions ?? 0;
      const graded = sub.summary?.questionsGraded ?? 0;
      return total > 0 ? Math.round((graded / total) * 100) : 0;
    },
  };
}
