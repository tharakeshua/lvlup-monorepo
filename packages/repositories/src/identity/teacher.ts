/**
 * `teacherRepo` (SDK-LAYERS-PLAN §4.1, identity.md "teacherRepo"). Mirrors
 * `studentRepo`: `list`/`get`/`save`/`archive`/`getMany` (batched N+1 collapse) +
 * `canArchive` entity-status pre-check.
 */
import type { Teacher, TeacherId } from "@levelup/domain";
import type {
  ApiClient,
  ListTeachersRequest,
  SaveInput,
  SaveResponse,
} from "../internal/api-types.js";
import { paginate, type PageBag } from "../internal/paginate.js";
import { can } from "../internal/transitions.js";

export interface TeacherRepo {
  list(filter?: ListTeachersRequest): Promise<PageBag<Teacher>>;
  paginate(filter?: ListTeachersRequest): Promise<PageBag<Teacher>>;
  get(id: TeacherId | string): Promise<Teacher>;
  getMany(ids: readonly (TeacherId | string)[]): Promise<Teacher[]>;
  save(input: SaveInput<Partial<Teacher>>): Promise<SaveResponse>;
  archive(id: TeacherId | string): Promise<SaveResponse>;
  canArchive(teacher: { status?: string }): boolean;
}

export function createTeacherRepo(api: ApiClient): TeacherRepo {
  return {
    list: (filter = {}) => paginate(api.identity.listTeachers, filter),
    paginate: (filter = {}) => paginate(api.identity.listTeachers, filter),
    get: (id) => api.identity.getTeacher({ id: id as TeacherId }),
    async getMany(ids) {
      if (ids.length === 0) return [];
      const page = await api.identity.listTeachers({ ids: ids as string[] });
      return page.items;
    },
    save: (input) => api.identity.saveTeacher(input),
    archive: (id) => api.identity.saveTeacher({ id: id as string, delete: true }),
    canArchive: (teacher) => can("entityStatus", teacher.status, "archived"),
  };
}
