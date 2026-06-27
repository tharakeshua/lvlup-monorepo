/**
 * `studentSummaryRepo` — cross-entity VIEW repo (SDK-LAYERS-PLAN §4.1, domain
 * plan §Repositories). Lives under `src/views/**` — the ONLY repos allowed to
 * compose cross-domain reads (R6 exception).
 *
 * `StudentProgressSummary` is authored by analytics triggers; this domain's
 * learner/parent/teacher dashboards consume it, so the read lives behind a view
 * repo over the `v1.analytics.*` read endpoints (domain plan open-Q #3 — no
 * duplicate `levelup` read endpoint is added).
 *
 *   • `get(studentId)` → one child-summary read.
 *   • `getMany(studentIds)` collapses the parent/teacher per-child fan-out into
 *     ONE batched read (§4.1 / REVIEW parent fan-out). `getMany([])`
 *     short-circuits — zero ids ⇒ zero wire calls. NO client-side `in`-chunking
 *     of 10/30 ids: the full id list goes in one request; the server fans in.
 *   • `getClassView(classId)` assembles `ClassProgressSummary` + member summaries
 *     in one shaped call (BOUNDED — never one read per member, PC-14).
 *
 * Composes only `api` (not sibling repos) — but is still a declared view repo so
 * the R6 import-isolation scan classifies it under views/**.
 */
import type { StudentProgressSummary, UserId } from "@levelup/domain";
import type {
  ApiClient,
  GetChildSummaryResponse,
  GetClassSummaryResponse,
} from "../testsession-progress/api-types.js";

export interface StudentSummaryRepo {
  get(studentId: UserId): Promise<GetChildSummaryResponse>;
  getMany(studentIds: readonly UserId[]): Promise<StudentProgressSummary[]>;
  getClassView(classId: string): Promise<GetClassSummaryResponse>;
}

export function createStudentSummaryRepo(api: ApiClient): StudentSummaryRepo {
  return {
    get: (studentId) => api.analytics.getChildSummary({ studentId }),

    getMany: async (studentIds) => {
      // Zero ids ⇒ no wire call (DX-14 short-circuit).
      if (studentIds.length === 0) return [];
      // ONE batched read carrying the FULL id list — the server does the
      // 10/30-id `in`-chunking + cap (repository-admin), never the client.
      const res = await api.analytics.getStudentSummaries({
        studentIds: [...studentIds] as UserId[],
      });
      return res.items;
    },

    getClassView: (classId) => api.analytics.getClassSummary({ classId }),
  };
}
