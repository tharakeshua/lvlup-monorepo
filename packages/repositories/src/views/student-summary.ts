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
 *   • `get(studentId)` → `v1.analytics.getSummary` (scope=student). Learner
 *     self-reads MUST NOT call `getChildSummary` — that callable is parent-link
 *     gated and returns 403 for students.
 *   • `getMany(studentIds)` fans out the same student-scope getSummary (parent/
 *     teacher dashboards). Empty id list short-circuits with zero wire calls.
 *   • `getClassView(classId)` uses `getSummary{scope:'class'}`.
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

async function studentScopeSummary(
  api: ApiClient,
  studentId: UserId
): Promise<GetChildSummaryResponse> {
  const res = await api.analytics.getSummary({ scope: "student", studentId });
  if (res.scope !== "student") {
    throw new Error(`getSummary returned scope '${res.scope}', expected 'student'`);
  }
  return {
    studentSummary: res.studentSummary as StudentProgressSummary,
    recentInsights: [],
  };
}

export function createStudentSummaryRepo(api: ApiClient): StudentSummaryRepo {
  return {
    get: (studentId) => studentScopeSummary(api, studentId),

    getMany: async (studentIds) => {
      // Zero ids ⇒ no wire call (DX-14 short-circuit).
      if (studentIds.length === 0) return [];
      const rows = await Promise.all(
        studentIds.map(async (id) => (await studentScopeSummary(api, id)).studentSummary)
      );
      return rows;
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
