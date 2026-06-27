/**
 * `parentRepo` — cross-entity VIEW repo for the parent dashboard
 * (SDK-LAYERS-PLAN §4.1, analytics.md §parentRepo). Under
 * `src/analytics/views/**` (R6 exception).
 *
 * Collapses the per-child fan-out the review flagged in parent-web:
 *   • `listChildren()` → ONE `v1.analytics.listLinkedChildren` read (server reads
 *     the `parentLinkedStudentIds` claim — D10 — and shapes every linked child in
 *     a single paginated response; listing children NEVER triggers K per-child
 *     summary calls).
 *   • `getChildSummary(studentId)` → ONE `v1.analytics.getChildSummary` (server
 *     aggregates `{studentSummary, recentInsights}` — one round-trip vs
 *     getSummary + listInsights separately; the parent link is enforced
 *     server-side from `ctx.studentIds`).
 *   • `computeChildCards(page)` → dashboard grid view-model (derived).
 *
 * Composes only `api` (never sibling repos) — declared view repo.
 */
import type { StudentId } from "@levelup/domain";
import type {
  ApiClient,
  ChildSummaryRow,
  GetChildSummaryResponse,
  ListLinkedChildrenRequest,
} from "../api-types.js";
import { listOnce, paginate, type PageBag } from "../paginate.js";
import type { PageResponse } from "../api-types.js";

/** A parent-dashboard child card view-model (derived). */
export interface ChildCard {
  studentId: StudentId;
  name: string;
  classLine: string;
  overallScore: number;
  isAtRisk: boolean;
}

export interface ParentRepo {
  listChildren(filter?: ListLinkedChildrenRequest): Promise<PageResponse<ChildSummaryRow>>;
  paginate(filter?: ListLinkedChildrenRequest): Promise<PageBag<ChildSummaryRow>>;
  getChildSummary(studentId: StudentId): Promise<GetChildSummaryResponse>;
  /** Map a linked-children page to dashboard cards (derived). */
  computeChildCards(rows: readonly ChildSummaryRow[]): ChildCard[];
}

export function createParentRepo(api: ApiClient): ParentRepo {
  return {
    // ONE batched read for K linked children — no per-child fan-out (PC-14).
    listChildren: (filter) =>
      listOnce((req) => api.analytics.listLinkedChildren(req), filter ?? {}),

    paginate: (filter) => paginate((req) => api.analytics.listLinkedChildren(req), filter ?? {}),

    getChildSummary: (studentId) => api.analytics.getChildSummary({ studentId }),

    computeChildCards: (rows) =>
      rows.map((r) => ({
        studentId: r.studentId,
        name: r.name,
        classLine: r.classNames.join(", "),
        overallScore: r.overallScore,
        isAtRisk: r.isAtRisk,
      })),
  };
}
