/**
 * `studentRepo` (SDK-LAYERS-PLAN §4.1, identity.md "studentRepo").
 *
 * Per-entity repo: `list`/`get`/`save`/`archive`/`getMany` + a `canArchive`
 * entity-status pre-check. `getMany` collapses the N+1 into ONE batched read
 * callable carrying the full id list — the 10/30-id `in`-chunking lives
 * SERVER-side in repository-admin (§5.5, DX-14); the client never chunks. A zero
 * id list short-circuits to an empty result with NO wire call.
 */
import type { Student, StudentId } from "@levelup/domain";
import type {
  ApiClient,
  ListStudentsRequest,
  SaveInput,
  SaveResponse,
} from "../internal/api-types.js";
import { paginate, type PageBag } from "../internal/paginate.js";
import { can } from "../internal/transitions.js";

export interface StudentRepo {
  list(filter?: ListStudentsRequest): Promise<PageBag<Student>>;
  paginate(filter?: ListStudentsRequest): Promise<PageBag<Student>>;
  get(id: StudentId | string): Promise<Student>;
  /** Batched N+1 collapse — ONE wire call carrying every id (no client chunking). */
  getMany(ids: readonly (StudentId | string)[]): Promise<Student[]>;
  save(input: SaveInput<Partial<Student>>): Promise<SaveResponse>;
  archive(id: StudentId | string): Promise<SaveResponse>;
  /** Pure entity-status pre-check (active → archived). No wire call. */
  canArchive(student: { status?: string }): boolean;
}

export function createStudentRepo(api: ApiClient): StudentRepo {
  return {
    list: (filter = {}) => paginate(api.identity.listStudents, filter),
    paginate: (filter = {}) => paginate(api.identity.listStudents, filter),
    get: (id) => api.identity.getStudent({ id: id as StudentId }),
    async getMany(ids) {
      if (ids.length === 0) return [];
      const page = await api.identity.listStudents({ ids: ids as string[] });
      return page.items;
    },
    save: (input) => api.identity.saveStudent(input),
    archive: (id) => api.identity.saveStudent({ id: id as string, delete: true }),
    canArchive: (student) => can("entityStatus", student.status, "archived"),
  };
}
