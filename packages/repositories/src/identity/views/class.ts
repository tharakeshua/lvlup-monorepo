/**
 * `classRepo` — cross-entity VIEW repo (SDK-LAYERS-PLAN §4.1, identity.md
 * "classRepo (view)"). Lives under `views/` — the ONLY composition surface (R6
 * exception). It assembles a `ClassDetailView` (class + roster + teachers) in a
 * BOUNDED number of wire calls and NEVER fans out one read per student/teacher
 * id (PC-14): `getClass` returns counts + the first roster page; the rest pages
 * via `listStudents{classId}`.
 *
 * To stay R6-clean it composes via the batched read CALLABLES directly (no
 * sibling-repo import) — the server fans in the `in`-chunking (§5.5).
 */
import type { Class, ClassId } from "@levelup/domain";
import type {
  ApiClient,
  ClassDetailView,
  SaveInput,
  SaveResponse,
} from "../../internal/api-types.js";
import { paginate, type PageBag } from "../../internal/paginate.js";
import { can } from "../../internal/transitions.js";

export interface ClassRepo {
  list(filter?: {
    academicSessionId?: string;
    status?: string;
    cursor?: string;
    limit?: number;
  }): Promise<PageBag<Class>>;
  /** Assemble class + first roster page + teachers — bounded (PC-14). */
  get(input: { classId: ClassId | string }): Promise<ClassDetailView>;
  save(input: SaveInput<Partial<Class>>): Promise<SaveResponse>;
  archive(id: ClassId | string): Promise<SaveResponse>;
  /** Derived: roster size from the detail view. Local. */
  computeRosterCount(detail: ClassDetailView): number;
  canArchive(klass: { status?: string }): boolean;
}

export function createClassRepo(api: ApiClient): ClassRepo {
  return {
    list: (filter = {}) =>
      paginate(api.identity.listClasses, {
        academicSessionId: filter.academicSessionId as never,
        status: filter.status as never,
        cursor: filter.cursor,
        limit: filter.limit,
      }),
    get: ({ classId }) => api.identity.getClass({ id: classId as ClassId }),
    save: (input) => api.identity.saveClass(input),
    archive: (id) => api.identity.saveClass({ id: id as string, delete: true }),
    computeRosterCount: (detail) => {
      if (detail.roster?.items) return detail.roster.items.length;
      if (detail.students) return detail.students.length;
      return detail.class?.studentCount ?? detail.class?.studentIds?.length ?? 0;
    },
    canArchive: (klass) => can("entityStatus", klass.status, "archived"),
  };
}
