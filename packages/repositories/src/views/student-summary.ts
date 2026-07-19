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
 *   • `getMany(studentIds)` fans out `getChildSummary` (no batch callable in the
 *     v1 contract — `getStudentSummaries` was never registered). Empty id list
 *     short-circuits with zero wire calls.
 *   • `getClassView(classId)` uses `getSummary{scope:'class'}` (replaces the
 *     legacy `getClassSummary` name). Member rows are not in that response —
 *     callers that need per-student summaries should `getMany` explicitly.
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
      // v1 has no batched getStudentSummaries — fan out the live child read.
      const rows = await Promise.all(
        studentIds.map((studentId) => api.analytics.getChildSummary({ studentId }))
      );
      return rows.map((r) => r.studentSummary);
    },

    getClassView: async (classId) => {
      const res = await api.analytics.getSummary({ scope: "class", classId });
      if (res.scope !== "class") {
        throw new Error(`getSummary returned scope '${res.scope}', expected 'class'`);
      }
      return {
        classSummary: res.classSummary as GetClassSummaryResponse["classSummary"],
        members: [],
      };
    },
  };
}
