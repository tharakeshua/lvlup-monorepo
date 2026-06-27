/**
 * `academicSessionRepo` (SDK-LAYERS-PLAN §4.1, identity.md). `list`/`save`/
 * `rollover` (→ `rolloverSession`, an explicit multi-step lifecycle verb, never a
 * `save()` flip) + a `canArchive` entity-status pre-check.
 */
import type { AcademicSession, AcademicSessionId } from "@levelup/domain";
import type {
  ApiClient,
  ListAcademicSessionsRequest,
  RolloverSessionRequest,
  RolloverSessionResponse,
  SaveInput,
  SaveResponse,
} from "../internal/api-types.js";
import { paginate, type PageBag } from "../internal/paginate.js";
import { can } from "../internal/transitions.js";

export interface AcademicSessionRepo {
  list(filter?: ListAcademicSessionsRequest): Promise<PageBag<AcademicSession>>;
  paginate(filter?: ListAcademicSessionsRequest): Promise<PageBag<AcademicSession>>;
  save(input: SaveInput<Partial<AcademicSession>>): Promise<SaveResponse>;
  rollover(input: RolloverSessionRequest): Promise<RolloverSessionResponse>;
  canArchive(session: { status?: string }): boolean;
}

export function createAcademicSessionRepo(api: ApiClient): AcademicSessionRepo {
  return {
    list: (filter = {}) => paginate(api.identity.listAcademicSessions, filter),
    paginate: (filter = {}) => paginate(api.identity.listAcademicSessions, filter),
    save: (input) => api.identity.saveAcademicSession(input),
    rollover: (input) => api.identity.rolloverSession(input),
    canArchive: (session) => can("entityStatus", session.status, "archived"),
  };
}
