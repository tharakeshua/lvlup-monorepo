/**
 * `parentRepoEntity` (SDK-LAYERS-PLAN §4.1, identity.md "parentRepo"). The
 * identity per-entity parent repo (distinct from the analytics PARENT VIEW repo
 * that collapses the N+1 child-summary fetch — that lives under `views/`). Named
 * `parentRepoEntity` in the assembly so it does not collide with the analytics
 * `parentRepo` view (_harness PER_ENTITY_REPO_NAMES).
 *
 * `list`/`get`/`save`/`archive`/`getMany` + `byStudent(studentId)` parent-portal
 * linkage + `canArchive`.
 */
import type { Parent, ParentId, StudentId } from "@levelup/domain";
import type {
  ApiClient,
  ListParentsRequest,
  SaveInput,
  SaveResponse,
} from "../internal/api-types.js";
import { paginate, type PageBag } from "../internal/paginate.js";
import { can } from "../internal/transitions.js";

export interface ParentEntityRepo {
  list(filter?: ListParentsRequest): Promise<PageBag<Parent>>;
  paginate(filter?: ListParentsRequest): Promise<PageBag<Parent>>;
  getMany(ids: readonly (ParentId | string)[]): Promise<Parent[]>;
  save(input: SaveInput<Partial<Parent>>): Promise<SaveResponse>;
  archive(id: ParentId | string): Promise<SaveResponse>;
  /** Parents linked to a given student (parent-portal linkage). */
  listByStudent(studentId: StudentId | string): Promise<PageBag<Parent>>;
  canArchive(parent: { status?: string }): boolean;
}

export function createParentEntityRepo(api: ApiClient): ParentEntityRepo {
  return {
    list: (filter = {}) => paginate(api.identity.listParents, filter),
    paginate: (filter = {}) => paginate(api.identity.listParents, filter),
    async getMany(ids) {
      if (ids.length === 0) return [];
      const page = await api.identity.listParents({ ids: ids as string[] });
      return page.items;
    },
    save: (input) => api.identity.saveParent(input),
    archive: (id) => api.identity.saveParent({ id: id as string, delete: true }),
    listByStudent: (studentId) =>
      paginate(api.identity.listParents, { studentId: studentId as StudentId }),
    canArchive: (parent) => can("entityStatus", parent.status, "archived"),
  };
}
